/**
 * 视频提示词精炼 API
 * 融入 Open-Sora 的 T2V/I2V/T2I 三模式提示词精炼策略
 * 
 * POST /api/prompt/video-refine
 * 
 * Body:
 *   prompt: string        — 原始用户提示词
 *   mode: 't2v'|'t2i'|'i2v'|'motion_score'  — 精炼模式
 *   imageDescription?: string  — 图片描述（I2V模式必填）
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  getRefineSystemPrompt,
  buildRefineUserMessage,
  type PromptRefineMode,
} from '@/lib/video-production/prompt-engineer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, mode, imageDescription } = body as {
      prompt: string;
      mode?: string;
      imageDescription?: string;
    };

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'prompt 参数必填' },
        { status: 400 },
      );
    }

    const refineMode: PromptRefineMode = (['t2v', 't2i', 'i2v', 'motion_score'].includes(mode ?? '')
      ? mode
      : 't2v') as PromptRefineMode;

    // 构建精炼请求
    const systemPrompt = getRefineSystemPrompt(refineMode);
    const userMessage = buildRefineUserMessage(refineMode, prompt, imageDescription);

    // 使用 Coze SDK 调用 LLM 进行精炼
    const { CozeAPI } = await import('@/lib/coze-api');
    let refinedText: string;

    try {
      const result = await CozeAPI.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        { model: 'doubao-seed-2-0-pro-260215' },
      );
      refinedText = result.content || prompt;
    } catch {
      // LLM 调用失败时返回原始提示词
      refinedText = prompt;
    }

    return NextResponse.json({
      success: true,
      originalPrompt: prompt,
      refinedPrompt: refinedText,
      mode: refineMode,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[video-refine] Error:', message);
    return NextResponse.json(
      { error: '提示词精炼失败', detail: message },
      { status: 500 },
    );
  }
}
