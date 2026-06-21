import { NextRequest, NextResponse } from 'next/server';
import {
  SCENE_TYPE_LABELS,
  decomposeBySceneType,
  extractVisualAnchors,
  type SceneType,
  type SegmentPhase,
} from '@/lib/prompt-decompose-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      prompt,
      duration = 20,
      segmentCount,
      segmentDuration,
      sceneType = 'portrait' as SceneType,
      productDisplayModes,
    } = body;

    // 参数校验
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: prompt' },
        { status: 400 }
      );
    }

    const safeDuration = Math.max(5, Math.min(300, Number(duration) || 20));
    
    // 计算段数：优先使用传入值，否则按时长计算
    let safeSegmentCount: number;
    if (segmentCount && Number(segmentCount) > 0) {
      safeSegmentCount = Math.min(Math.max(Number(segmentCount), 1), 30);
    } else if (segmentDuration && Number(segmentDuration) > 0) {
      safeSegmentCount = Math.ceil(safeDuration / Math.max(Number(segmentDuration), 5));
    } else {
      // 默认策略：≤10s不分段，11-20s分2段，21-40s分3段，>40s按8s一段
      if (safeDuration <= 10) {
        safeSegmentCount = 1;
      } else if (safeDuration <= 20) {
        safeSegmentCount = 2;
      } else if (safeDuration <= 40) {
        safeSegmentCount = 3;
      } else {
        safeSegmentCount = Math.ceil(safeDuration / 8);
      }
    }

    console.log(`[Decompose] 参数确认: prompt="${prompt.substring(0, 50)}...", duration=${safeDuration}s, segments=${safeSegmentCount}, sceneType=${sceneType}`);

    // 单段直接返回原始prompt
    if (safeSegmentCount <= 1) {
      return NextResponse.json({
        success: true,
        segments: [{
          index: 0,
          phase: 'resolving' as SegmentPhase,
          phaseLabel: '单段完整',
          focus: '完整呈现原始提示词的所有内容',
          prompt: prompt,
          continuityAnchors: extractVisualAnchors(prompt, sceneType),
          cameraPreference: '标准构图',
          durationWeight: 1.0,
        }],
        totalSegments: 1,
        sceneType,
        visualAnchors: extractVisualAnchors(prompt, sceneType),
        rhythmSummary: '单段模式，无需分段',
        originalPrompt: prompt,
      });
    }

    // 多段：调用对应场景类型的分解引擎
    const result = decomposeBySceneType(
      prompt.trim(),
      safeDuration,
      safeSegmentCount,
      sceneType,
      { productDisplayModes }
    );

    console.log(`[Decompose] 分解完成: ${result.totalSegments}个片段, sceneType=${result.sceneType}`);
    console.log(`[Decompose] 节奏: ${result.rhythmSummary}`);
    result.segments.forEach((seg, idx) => {
      console.log(`[Decompose]   Seg[${idx}] phase=${seg.phase} weight=${seg.durationWeight} focus=${seg.focus.substring(0, 40)}...`);
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Decompose] 分解失败:', error);
    return NextResponse.json(
      { success: false, error: `提示词分解失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// 支持GET请求用于调试
export async function GET() {
  return NextResponse.json({
    message: '提示词时序分解API',
    usage: 'POST /api/prompt/decompose',
    params: {
      prompt: 'string (required) - 原始提示词',
      duration: 'number (optional, default=20) - 总时长(秒)',
      segmentCount: 'number (optional) - 目标段数',
      segmentDuration: 'number (optional) - 每段时长(秒)',
      sceneType: 'string (optional, default="portrait") - portrait/product/landscape/food/drama/abstract/interior',
      productDisplayModes: 'string[] (optional) - 产品展示模式(hero/lifestyle/detail)',
    },
    supportedSceneTypes: Object.keys(SCENE_TYPE_LABELS),
  });
}
