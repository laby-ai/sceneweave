import { NextRequest, NextResponse } from 'next/server';

/**
 * 绘影精灵技能调用统一路由
 * 根据技能类型分发到不同的后端能力
 */

// 技能类型定义
type SkillType =
  | 'generate_storyboard'   // 生成分镜脚本
  | 'generate_video'        // 生成视频
  | 'generate_image'        // 生成图片
  | 'enhance_prompt'        // 增强提示词
  | 'compliance_check'      // AIGC合规检测
  | 'analyze_media'         // 分析媒体(图片/视频)
  | 'generate_subtitle'     // 生成字幕
  | 'generate_bgm';         // 生成背景音乐

interface SkillCallRequest {
  skill: SkillType;
  params: Record<string, unknown>;
}

// 分镜脚本生成
async function handleStoryboard(params: Record<string, unknown>) {
  const { prompt, duration, style } = params;

  // 调用分镜生成API
  const baseUrl = process.env.INTERNAL_API_BASE || 'http://localhost:5000';
  const response = await fetch(`${baseUrl}/api/storyboard/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: prompt || '',
      duration: duration || 5,
      style: style || 'cinematic',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`分镜生成失败: ${errorText}`);
  }

  return await response.json();
}

// 视频生成
async function handleVideoGenerate(params: Record<string, unknown>) {
  const { prompt, duration, ratio, style, imageUrl } = params;

  const baseUrl = process.env.INTERNAL_API_BASE || 'http://localhost:5000';
  const response = await fetch(`${baseUrl}/api/video/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      duration: duration || 5,
      ratio: ratio || '16:9',
      style: style || 'cinematic',
      imageUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`视频生成失败: ${errorText}`);
  }

  return await response.json();
}

// 图片生成
async function handleImageGenerate(params: Record<string, unknown>) {
  const { prompt, style, size, n } = params;

  const baseUrl = process.env.INTERNAL_API_BASE || 'http://localhost:5000';
  const response = await fetch(`${baseUrl}/api/image/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      style: style || 'photorealistic',
      size: size || '1024x1024',
      n: n || 1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`图片生成失败: ${errorText}`);
  }

  return await response.json();
}

// 提示词增强
async function handleEnhancePrompt(params: Record<string, unknown>) {
  const { prompt, type } = params;

  const baseUrl = process.env.INTERNAL_API_BASE || 'http://localhost:5000';
  const response = await fetch(`${baseUrl}/api/prompt/enhance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: prompt,
      sceneType: type || 'portrait',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`提示词增强失败: ${errorText}`);
  }

  return await response.json();
}

// AIGC合规检测
async function handleComplianceCheck(params: Record<string, unknown>) {
  const { content, type } = params;

  const baseUrl = process.env.INTERNAL_API_BASE || 'http://localhost:5000';
  const response = await fetch(`${baseUrl}/api/compliance/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      type: type || 'text',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`合规检测失败: ${errorText}`);
  }

  return await response.json();
}

// 媒体分析
async function handleAnalyzeMedia(params: Record<string, unknown>) {
  const { url, type, question } = params;

  const baseUrl = process.env.INTERNAL_API_BASE || 'http://localhost:5000';
  const response = await fetch(`${baseUrl}/api/analyze/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, type, question }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`媒体分析失败: ${errorText}`);
  }

  return await response.json();
}

// 技能处理器映射
const skillHandlers: Record<SkillType, (params: Record<string, unknown>) => Promise<unknown>> = {
  generate_storyboard: handleStoryboard,
  generate_video: handleVideoGenerate,
  generate_image: handleImageGenerate,
  enhance_prompt: handleEnhancePrompt,
  compliance_check: handleComplianceCheck,
  analyze_media: handleAnalyzeMedia,
  generate_subtitle: handleStoryboard, // 字幕生成暂复用分镜逻辑
  generate_bgm: handleStoryboard,       // BGM暂复用
};

export async function POST(request: NextRequest) {
  try {
    const body: SkillCallRequest = await request.json();
    const { skill, params } = body;

    if (!skill || !skillHandlers[skill]) {
      return NextResponse.json(
        { error: `未知技能类型: ${skill}，可用技能: ${Object.keys(skillHandlers).join(', ')}` },
        { status: 400 }
      );
    }

    const handler = skillHandlers[skill];
    const result = await handler(params || {});

    return NextResponse.json({
      success: true,
      skill,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '技能调用失败';
    console.error('[SmartSkillCall] Error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
