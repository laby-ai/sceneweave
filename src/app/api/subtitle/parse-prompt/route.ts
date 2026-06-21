import { NextRequest, NextResponse } from 'next/server';
import { parseSubtitlePrompt } from '@/lib/subtitle-utils';
import type { ParsedSubtitlePrompt } from '@/lib/subtitle-utils';

/**
 * PUT /api/subtitle/parse-prompt
 * 
 * 解析 QClaw 风格字幕提示词
 * 提取动作、语言、断句规则、样式、后处理选项等结构化信息
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body as { prompt: string };

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: '请输入提示词内容' }, { status: 400 });
    }

    const result: ParsedSubtitlePrompt = parseSubtitlePrompt(prompt);

    console.log(`[Subtitle Prompt Parse] 动作=${result.action}, 置信度=${result.parseConfidence}`);

    return NextResponse.json({
      success: true,
      parsed: result,
    });
  } catch (error: any) {
    console.error('[Subtitle Prompt Parse Error]:', error);
    return NextResponse.json(
      { error: `解析失败: ${error.message || '未知错误'}` },
      { status: 500 }
    );
  }
}
