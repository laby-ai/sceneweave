import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 画布音频节点会 POST /v1/audio/speech。火山 ARK 的 TTS 不是 OpenAI /audio/speech 兼容接口，
// 暂未接入真实 TTS。这里返回明确的 501（而不是 404），让音频节点优雅失败、提示未接入，
// 待后续接上 ARK/其他 TTS 通道再实现转发。
export async function POST(_request: NextRequest) {
  return new Response(
    JSON.stringify({ error: '画布音频生成暂未接入（TTS 通道待配置）。图片与视频生成已可用。' }),
    { status: 501, headers: { 'Content-Type': 'application/json' } },
  );
}
