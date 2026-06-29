import { NextRequest } from 'next/server';



// 画布 Agent 代理：把 icanvas 的 OpenAI Responses API 请求转成火山 ARK chat/completions。
// 让画布在线 Agent 能用 ARK 模型，不动 vendored icanvas 源码。

const ARK_BASE = (process.env.HUIYING_REAL_ARK_API_BASE || process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '');
const ARK_KEY = process.env.HUIYING_REAL_ARK_API_KEY || process.env.ARK_API_KEY || '';
const ARK_MODEL = process.env.ARK_AGENT_MODEL || process.env.ARK_TEXT_MODEL || 'minimax-m3';

type ResponseInputItem =
  | { role: 'system' | 'user' | 'assistant'; content: unknown }
  | { type: 'function_call_output'; call_id: string; output: string }
  | { type: 'function_call'; call_id: string; name: string; arguments: string }
  | { type: string; [k: string]: unknown };

type ResponseTool = { type: 'function'; name?: string; description?: string; parameters?: unknown; strict?: boolean };

// Responses input -> chat/completions messages
function toChatMessages(input: ResponseInputItem[]): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];
  for (const item of input) {
    if ('type' in item && item.type === 'function_call_output') {
      const fcItem = item as { call_id: string; output: string };
      messages.push({ role: 'tool', content: String(fcItem.output || ''), tool_call_id: fcItem.call_id });
      continue;
    }
    if ('type' in item && item.type === 'function_call') {
      const fcItem = item as { call_id: string; name: string; arguments: string };
      messages.push({ role: 'assistant', content: null, tool_calls: [{ id: fcItem.call_id, type: 'function', function: { name: fcItem.name, arguments: fcItem.arguments || '{}' } }] });
      continue;
    }
    const role = (item as { role?: string }).role;
    if (!role) continue;
    const content = (item as { content?: unknown }).content;
    const text = typeof content === 'string' ? content
      : Array.isArray(content) ? content.map((c: { text?: string } | { image_url?: { url: string } }) => (c as { text?: string }).text || `[image:${(c as { image_url?: { url: string } }).image_url?.url || ''}]`).join('')
      : '';
    messages.push({ role, content: text });
  }
  return messages;
}

function toChatTools(tools?: ResponseTool[]) {
  if (!tools?.length) return undefined;
  return tools.map(t => ({ type: 'function' as const, function: { name: t.name || 'tool', description: t.description || '', parameters: t.parameters || { type: 'object', properties: {} } } }));
}

function toChatToolChoice(choice?: string) {
  // "required" is not supported by all ARK models (e.g. kimi-k2.7-code returns 400).
  // Downgrade to "auto" for compatibility.
  if (choice === 'none') return 'none';
  return 'auto';
}

export async function POST(request: NextRequest) {
  if (!ARK_KEY) {
  }
  let body: { model?: string; input?: ResponseInputItem[]; tools?: ResponseTool[]; tool_choice?: string; stream?: boolean };
  try { body = await request.json(); } catch { return new Response('invalid json', { status: 400 }); }

  const model = (body.model && String(body.model).trim()) || ARK_MODEL;

  console.error("[agent-proxy] model=", model, " input_len=", JSON.stringify(body.input || []).length, " tools=", (body.tools || []).length, " stream=", body.stream);
  const messages = toChatMessages(body.input || []);
  const tools = toChatTools(body.tools);
  const toolChoice = toChatToolChoice(body.tool_choice);
  const wantStream = body.stream !== false;

  const arkBody: Record<string, unknown> = { model, messages, stream: wantStream };
  if (tools) { arkBody.tools = tools; arkBody.tool_choice = toolChoice; }

  const arkRes = await fetch(`${ARK_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ARK_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(arkBody),
  });

  if (!arkRes.ok) {
    const errText = await arkRes.text().catch(() => '');
    return new Response(JSON.stringify({ error: `ark ${arkRes.status}: ${errText.slice(0, 300)}` }), { status: arkRes.status, headers: { 'Content-Type': 'application/json' } });
  }

  // 非流式：直接转成 Responses payload
  if (!wantStream || !arkRes.body) {
    const data = await arkRes.json();
    const choice = data.choices?.[0];
    const msg = choice?.message || {};
    const output: unknown[] = [];
    if (msg.content) output.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: msg.content }] });
    if (msg.tool_calls?.length) for (let i = 0; i < msg.tool_calls.length; i++) {
      const tc = msg.tool_calls[i];
      output.push({ type: 'function_call', id: `fc_${i}`, call_id: tc.id || `call_${i}`, name: tc.function?.name || '', arguments: tc.function?.arguments || '{}' });
    }
    return Response.json({ id: data.id || `resp_${Date.now()}`, object: 'response', output, output_text: msg.content || '', status: 'completed' });
  }

  // 流式：icanvas 的 consumeResponseStreamBlock 只认 response.output_text.delta 和 response.completed(带 output 数组)。
  // 所以这里累积 ARK 的 content + tool_calls，流式只发 output_text.delta，结束时发 response.completed 带 output。
  const encoder = new TextEncoder();
  const reader = arkRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let textAccum = '';
  const calls: Array<{ id: string; name: string; arguments: string }> = [];
  let callIdx = -1;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send('response.created', { type: 'response.created', response: { id: `resp_${Date.now()}`, status: 'in_progress' } });
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';
        for (const block of blocks) {
          const dataLines = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim());
          const payload = dataLines.join('\n').trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const chunk = JSON.parse(payload);
            const delta = chunk.choices?.[0]?.delta;
            if (!delta) continue;
            if (typeof delta.content === 'string' && delta.content) {
              textAccum += delta.content;
              send('response.output_text.delta', { type: 'response.output_text.delta', delta: delta.content });
            }
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? (calls.length > 0 ? calls.length - 1 : 0);
                if (idx >= calls.length) {
                  calls.push({ id: tc.id || `call_${idx}`, name: tc.function?.name || '', arguments: '' });
                  callIdx = idx;
                }
                // Always accumulate name and arguments into the current call slot
                if (tc.function?.name) calls[idx].name = tc.function.name;
                if (tc.function?.arguments) calls[idx].arguments += tc.function.arguments;
                if (tc.id) calls[idx].id = tc.id;
                callIdx = idx;
              }
            }
          } catch { /* skip */ }
        }
      }
      // 结束：发 response.completed 带 output 数组，icanivas 据此 parseToolResponse 提取 message + function_call
      const output: unknown[] = [];
      if (textAccum) output.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: textAccum }] });
      for (let i = 0; i < calls.length; i++) {
        output.push({ type: 'function_call', id: `fc_${i}`, call_id: calls[i].id, name: calls[i].name, arguments: calls[i].arguments || '{}' });
      }
      send('response.completed', { type: 'response.completed', response: { id: `resp_${Date.now()}`, object: 'response', output, output_text: textAccum, status: 'completed' } });
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
}
