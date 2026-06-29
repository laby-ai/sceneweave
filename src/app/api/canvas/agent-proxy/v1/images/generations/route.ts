import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 画布图片生成代理：icanvas 的 BYOK baseUrl 被 bootstrap 指到 /api/canvas/agent-proxy，
// 但原先这里只有 /v1/responses，导致画布图片节点请求 /v1/images/generations 直接 404。
// 这里把 OpenAI 格式的 images/generations 转发到火山 ARK（豆包 Seedream），用服务端真实 key，
// 并强制使用真正的图像模型（bootstrap 把 model 统一写成了 agent 文本模型，不能用于出图）。
// 走 Agent Plan：/api/plan/v3 + Agent Plan key + 套餐内视觉模型 doubao-seedream-5.0-lite。
// 官方明确：图片/视频走标准 /api/v3 会产生套餐外后付费，所以这里固定用 plan 端点 + plan key。
const ARK_IMAGE_BASE = (process.env.HUIYING_REAL_ARK_API_BASE || process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/plan/v3').replace(/\/$/, '');
const ARK_IMAGE_KEY = process.env.HUIYING_REAL_ARK_API_KEY || process.env.ARK_API_KEY || '';
const ARK_IMAGE_MODEL = process.env.ARK_PLAN_IMAGE_MODEL || 'doubao-seedream-5.0-lite';

// Seedream 对最小像素有要求，这里把常见比例映射到达标尺寸；已是 \d+x\d+ 的直接透传。
const RATIO_SIZE: Record<string, string> = {
  '1:1': '2048x2048',
  '16:9': '2560x1440',
  '9:16': '1440x2560',
  '4:3': '2304x1728',
  '3:4': '1728x2304',
  '3:2': '2496x1664',
  '2:3': '1664x2496',
  '21:9': '3024x1296',
};

function normalizeSize(size: unknown): string | undefined {
  if (typeof size !== 'string' || !size || size === 'auto') return undefined;
  if (/^\d+x\d+$/.test(size)) return size;
  return RATIO_SIZE[size] || '2048x2048';
}

export async function POST(request: NextRequest) {
  if (!ARK_IMAGE_KEY) {
    return new Response(JSON.stringify({ error: 'canvas image proxy is missing ARK key' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  let body: { prompt?: string; size?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return new Response(JSON.stringify({ error: '缺少图片描述 prompt' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const size = normalizeSize(body.size);
  const arkBody = {
    model: ARK_IMAGE_MODEL,
    prompt,
    response_format: 'url',
    ...(size ? { size } : {}),
  };

  const startedAt = Date.now();
  let arkRes: Response;
  try {
    arkRes = await fetch(`${ARK_IMAGE_BASE}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ARK_IMAGE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(arkBody),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ark image request failed';
    console.error('[canvas-image-proxy] upstream_error', message);
    return new Response(JSON.stringify({ error: `画布图片生成上游失败：${message}` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }

  const text = await arkRes.text();
  if (!arkRes.ok) {
    console.error('[canvas-image-proxy] upstream_bad_status', arkRes.status, ' dur_ms=', Date.now() - startedAt, ' body=', text.slice(0, 300));
    return new Response(JSON.stringify({ error: `ark ${arkRes.status}: ${text.slice(0, 300)}` }), { status: arkRes.status, headers: { 'Content-Type': 'application/json' } });
  }
  // ARK 返回 { data: [{ url }] }，与 icanvas parseImagePayload 期望的 OpenAI 形状一致，直接透传。
  return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
}
