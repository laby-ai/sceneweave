import { NextRequest, NextResponse } from 'next/server';
import {
  invokePromptAutoComplete,
  isPromptAutoCompleteProviderError,
} from '@/lib/prompt-auto-complete-client';
import { getPromptForScene, type SceneType } from '@/lib/prompt-auto-complete-prompts';

// ============================================================
// API 入口
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      subject, 
      enhanceSubject = true, 
      duration = 5,
      sceneType = 'portrait' as SceneType,
      productDisplayModes,  // 产品展示模式（多选数组）
    } = body;

    if (!subject || typeof subject !== 'string' || subject.trim().length < 2) {
      return NextResponse.json(
        { error: '请提供至少2个字符的核心主体描述' },
        { status: 400 }
      );
    }

    if (duration < 1 || duration > 60) {
      return NextResponse.json(
        { error: '视频时长必须在1-60秒之间' },
        { status: 400 }
      );
    }

    // 验证 sceneType 合法性
    const validScenes: SceneType[] = ['portrait', 'product', 'landscape', 'food', 'drama', 'abstract', 'interior'];
    if (!validScenes.includes(sceneType)) {
      return NextResponse.json(
        { error: `无效的场景类型: ${sceneType}，可选值: ${validScenes.join('/')}` },
        { status: 400 }
      );
    }

    // ★ 核心改进：根据场景类型获取差异化 System Prompt
    const { systemPrompt, requiredFields } = getPromptForScene(sceneType, duration, enhanceSubject, productDisplayModes);

    console.log(`[AutoComplete] sceneType=${sceneType}, duration=${duration}s, enhance=${enhanceSubject}, modes=${productDisplayModes || 'none'}`);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `核心主体：${subject}\n视频时长：${duration}秒` },
    ];

    const resultText = await invokePromptAutoComplete(messages, request.headers);

    let result;
    try {
      let cleanJson = resultText;
      if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
      else if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
      if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
      result = JSON.parse(cleanJson.trim());
    } catch (parseError) {
      console.error('[AutoComplete] JSON解析失败:', parseError, '原始内容:', resultText.substring(0, 200));
      return NextResponse.json(
        { error: 'AI返回格式错误，请重试' },
        { status: 500 }
      );
    }

    for (const field of requiredFields) {
      if (!result[field] || typeof result[field] !== 'string') {
        return NextResponse.json(
          { error: `AI返回缺少必要字段: ${field}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      originalSubject: subject,
      duration,
      sceneType,
      ...result,
    });
    } catch (error: unknown) {
      console.error('[AutoComplete] 错误:', error);

      if (isPromptAutoCompleteProviderError(error)) {
        return NextResponse.json(
          { error: `AI 服务错误: ${error.message}` },
          { status: error.statusCode || 500 }
        );
      }

      return NextResponse.json(
        { error: '服务器错误，请稍后重试' },
        { status: 500 }
      );
    }
}
