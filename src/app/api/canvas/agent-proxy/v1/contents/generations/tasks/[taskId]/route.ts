import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 画布视频生成代理（轮询任务）：icanvas 会 GET /v1/contents/generations/tasks/{taskId} 拉状态。
// 转发到火山 ARK 并注入服务端真实 key，返回 { status, content: { video_url, last_frame_url } } 原样透传。
// 走 Agent Plan：/api/plan/v3 + Agent Plan key（与创建任务保持一致）。
const ARK_VIDEO_BASE = (process.env.HUIYING_REAL_ARK_API_BASE || process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/plan/v3').replace(/\/$/, '');
const ARK_VIDEO_KEY = process.env.HUIYING_REAL_ARK_API_KEY || process.env.ARK_API_KEY || '';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  if (!ARK_VIDEO_KEY) {
    return new Response(JSON.stringify({ error: 'canvas video proxy is missing ARK key' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  const { taskId } = await params;
  if (!taskId) {
    return new Response(JSON.stringify({ error: '缺少视频任务 ID' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  let arkRes: Response;
  try {
    arkRes = await fetch(`${ARK_VIDEO_BASE}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${ARK_VIDEO_KEY}` },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ark video poll failed';
    console.error('[canvas-video-proxy] poll upstream_error', message);
    return new Response(JSON.stringify({ error: `画布视频任务查询上游失败：${message}` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }

  const text = await arkRes.text();
  return new Response(text, { status: arkRes.ok ? 200 : arkRes.status, headers: { 'Content-Type': 'application/json' } });
}
