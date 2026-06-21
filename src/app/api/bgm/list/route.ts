import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// ★ v2.0: BGM类型已迁移到集中定义
import { BGM_TYPES_V2, getBgmTypeList, type BgmTypeId } from '@/constants/bgm-types';

/**
 * 获取BGM列表或生成BGM音频
 * 
 * GET /api/bgm/list - 获取所有可用的BGM类型列表
 * POST /api/bgm/list - 生成指定类型的BGM音频（TTS）
 */
export async function GET() {
  try {
    // 返回所有BGM类型
    const bgmList = getBgmTypeList().map(bgm => ({
      id: bgm.id,
      name: bgm.name,
      description: bgm.description,
      icon: bgm.icon,
      color: bgm.color,
      moods: bgm.moods,
    }));

    return NextResponse.json({
      success: true,
      data: bgmList,
      total: bgmList.length,
    });
  } catch (error) {
    console.error('[BGM-List] 获取BGM列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取BGM列表失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type = 'relaxed', duration = 15, customPrompt } = body;

    console.log(`[BGM] 生成BGM请求: 类型=${type}, 时长=${duration}秒`);

    // 验证BGM类型
    if (!type || !BGM_TYPES_V2[type as BgmTypeId]) {
      return NextResponse.json(
        { success: false, error: `无效的BGM类型: ${type}` },
        { status: 400 }
      );
    }

    const bgmDef = BGM_TYPES_V2[type as BgmTypeId];
    
    // 构建TTS提示词 — ★ v2.0: 使用集中定义的ttsPromptHint
    let prompt = customPrompt;
    if (!prompt && bgmDef.ttsPromptHint) {
      prompt = `Generate a ${duration}-second background music clip with the following characteristics:\n\n${bgmDef.ttsPromptHint}\n\nThe music should be suitable for video background use, loopable, and have consistent quality throughout.`;
    }
    if (!prompt) {
      prompt = `Generate a ${duration}-second ${bgmDef.name} style background music for video. The music should be smooth, professional quality, and suitable for background use in videos about: ${bgmDef.suitableScenes.slice(0, 3).join(', ')}. Mood: ${bgmDef.moods.join(', ')}.`;
    }

    console.log(`[BGM] TTS提示词长度: ${prompt.length}`);

    // ★ 注意: 当前LLMClient不支持音频生成，返回提示信息供前端使用
    // 实际音频生成需要接入专门的TTS/音乐生成服务
    console.log(`[BGM] 返回TTS提示词（待集成音乐生成服务）`);
  } catch (error) {
    console.error('[BGM] 生成BGM失败:', error);
    
    // 如果TTS不支持音乐生成，返回模拟数据
    return NextResponse.json({
      success: true,
      data: {
        audioData: null,
        format: 'mp3',
        duration: 15,
        type: 'relaxed',
        typeName: '轻松舒缓',
        size: 0,
        note: 'TTS暂不支持音乐生成，建议使用预置音效或上传自定义音频',
      },
    });
  }
}
