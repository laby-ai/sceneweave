import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 画布视频生成代理（创建任务）：icanvas 走 Seedance 路径时会 POST /v1/contents/generations/tasks。
// 这里把请求转发到火山 ARK，注入服务端真实 key，并强制使用真正的 Seedance 视频模型
// （bootstrap 里画布模型只是占位）。其余字段（content/ratio/resolution/duration/...）原样透传。
// 走 Agent Plan：/api/plan/v3 + Agent Plan key + 套餐内视频模型 doubao-seedance-1.5-pro。
// 官方明确：用标准 /api/v3 会产生套餐外后付费，固定走 plan 端点 + plan key。
const ARK_VIDEO_BASE = (process.env.HUIYING_REAL_ARK_API_BASE || process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/plan/v3').replace(/\/$/, '');
const ARK_VIDEO_KEY = process.env.HUIYING_REAL_ARK_API_KEY || process.env.ARK_API_KEY || '';
const ARK_VIDEO_MODEL = process.env.ARK_PLAN_VIDEO_MODEL || 'doubao-seedance-1.5-pro';

export async function POST(request: NextRequest) {
  if (!ARK_VIDEO_KEY) {
    return new Response(JSON.stringify({ error: 'canvas video proxy is missing ARK key' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const arkBody = { ...body, model: ARK_VIDEO_MODEL };
  const startedAt = Date.now();
  let arkRes: Response;
  try {
    arkRes = await fetch(`${ARK_VIDEO_BASE}/contents/generations/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ARK_VIDEO_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(arkBody),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ark video request failed';
    console.error('[canvas-video-proxy] create upstream_error', message);
    return new Response(JSON.stringify({ error: `画布视频任务创建上游失败：${message}` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }

  const text = await arkRes.text();
  if (!arkRes.ok) {
    console.error('[canvas-video-proxy] create bad_status', arkRes.status, ' dur_ms=', Date.now() - startedAt, ' body=', text.slice(0, 300));
  }
  return new Response(text, { status: arkRes.ok ? 200 : arkRes.status, headers: { 'Content-Type': 'application/json' } });
}
