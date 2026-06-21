import { NextRequest, NextResponse } from 'next/server';

function generateFallback(text: string, mode: string, nScenes: number, stylePrefix?: string, title?: string) {
  const prefix = stylePrefix ? `${stylePrefix}, ` : '';

  if (mode === 'fixed') {
    const chunks = text.split(/[。！？\n；;]/).filter((s: string) => s.trim());
    const narrations = Array.from({ length: nScenes }, (_, i) =>
      chunks[i]?.trim() || `第${i + 1}段内容`
    );
    const imagePrompts = narrations.map((n: string, i: number) =>
      `${prefix}scene ${i + 1}: ${n.slice(0, 50)}, cinematic composition, detailed, high quality`
    );
    return { title: title || text.slice(0, 20), narrations, imagePrompts };
  }

  // AI mode - generate structured narrations from the topic
  const narrations = Array.from({ length: nScenes }, (_, i) => {
    const openings = ['你知道吗？', '其实，', '很多人不知道的是，', '想想看，'];
    const bodies = [
      `${text}——这个话题值得深入探讨。`,
      `每个人都有不同的理解和感受。`,
      `关键在于我们如何看待和处理。`,
      `这正是我们今天要聊的核心。`,
      `相信你也有同感。`,
      `让我们一起来看看。`,
      `这背后有着深刻的道理。`,
      `值得我们认真思考。`,
      `或许答案就在我们身边。`,
      `这也许就是最好的答案。`,
    ];
    if (i === 0) return `${openings[i % openings.length]}${bodies[0]}`;
    if (i === nScenes - 1) return `${bodies[nScenes - 1]}你怎么看呢？`;
    return `${bodies[i % bodies.length]}`;
  });

  const imagePrompts = narrations.map((n: string, i: number) =>
    `${prefix}scene ${i + 1}: ${text.slice(0, 30)}, ${n.slice(0, 40)}, cinematic composition, detailed, high quality, beautiful lighting`
  );

  return { title: title || `关于${text.slice(0, 15)}的思考`, narrations, imagePrompts };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, mode, n_scenes, style_prompt_prefix, title } = body as {
      text: string;
      mode: 'ai' | 'fixed';
      n_scenes: number;
      style_prompt_prefix?: string;
      title?: string;
    };

    if (!text?.trim()) {
      return NextResponse.json({ error: '请输入主题或文案' }, { status: 400 });
    }

    // Local deterministic structure; cloud LLM generation must use request-level BYOK paths.
    const fallback = generateFallback(text, mode, n_scenes, style_prompt_prefix, title);
    return NextResponse.json(fallback);

  } catch (error) {
    console.error('[ShortVideo] Error:', error);
    return NextResponse.json({ error: '文案生成失败' }, { status: 500 });
  }
}
