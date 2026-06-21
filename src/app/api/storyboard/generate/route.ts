import { NextRequest, NextResponse } from 'next/server';
import {
  generateStoryboardFromSubtitles,
  convertToStoryboardShots,
  generateShotsFromUserPrompt,
  type SubtitleSegmentInput,
  type StoryboardGenerationResult,
} from '@/lib/storyboard-generator';

/**
 * 分镜脚本数据结构
 */
export interface Storyboard {
  title: string;
  totalDuration: number;
  segments: StoryboardSegment[];
}

export interface StoryboardSegment {
  segmentNumber: number;
  duration: number;
  sceneDescription: string;
  characterAction: string;
  cameraAngle: string;
  lighting: string;
  costumeProps: string;
  transitionHint: string;
}

/**
 * POST /api/storyboard/generate
 * 
 * 智能生成分镜脚本 - 支持两种模式：
 * 
 * **模式1：基于字幕内容生成（推荐）**
 * 请求体：
 * {
 *   segments: [{ id, text, startTime, endTime }, ...],  // 字幕段落
 *   globalStyle?: string,    // 全局风格描述
 *   subjectDescription?: string,  // 主体描述
 * }
 * 
 * **模式2：基于提示词生成（传统）**
 * 请求体：
 * {
 *   prompt: string,           // 原始提示词
 *   totalDuration?: number,   // 总时长（秒，默认20）
 *   segmentDuration?: number  // 每个片段时长（秒，默认10）
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { segments, prompt, totalDuration = 20, segmentDuration = 10, globalStyle, subjectDescription, sceneType } = body;

    // ===== 模式1：基于字幕内容智能生成 =====
    if (segments && Array.isArray(segments) && segments.length > 0) {
      console.log(`[Storyboard] 使用字幕内容模式生成分镜，段数: ${segments.length}, sceneType=${sceneType || 'auto'}`);

      const subtitleInputs: SubtitleSegmentInput[] = segments.map((seg: any, idx: number) => ({
        id: seg.id || `seg-${idx}`,
        text: seg.text || '',
        startTime: Number(seg.startTime) ?? idx * segmentDuration,
        endTime: Number(seg.endTime) ?? (idx + 1) * segmentDuration,
      })).filter((s: SubtitleSegmentInput) => s.text.trim().length > 0);

      if (subtitleInputs.length === 0) {
        return NextResponse.json(
          { error: '字幕段落中没有有效文本内容' },
          { status: 400 }
        );
      }

      const result: StoryboardGenerationResult = generateStoryboardFromSubtitles(subtitleInputs, {
        globalStyle: globalStyle || '',
        subjectDescription: subjectDescription || '',
        includeSourceText: true,
      });

      console.log(`[Storyboard] 字幕分镜生成完成: ${result.shots.length}个镜头, 总时长${result.totalDuration.toFixed(1)}s`);
      console.log(`[Storyboard] 主导场景: ${result.summary.dominantScene}, 主导情感: ${result.summary.dominantEmotion}`);
      if (result.warnings.length > 0) {
        result.warnings.forEach(w => console.log(`[Storyboard] ⚠️ ${w}`));
      }

      // 转换为兼容格式返回
      const storyboard: Storyboard = {
        title: `基于字幕的分镜 (${subtitleInputs.length}段→${result.shots.length}镜)`,
        totalDuration: result.totalDuration,
        segments: result.shots.map((shot, idx) => ({
          segmentNumber: idx + 1,
          duration: shot.duration,
          sceneDescription: `[${shot.sceneType}] ${shot.prompt.substring(0, 100)}...`,
          characterAction: shot.sourceText,
          cameraAngle: shot.cameraSuggestion,
          lighting: shot.lighting,
          costumeProps: '',
          transitionHint: idx < result.shots.length - 1 ? '首帧延续前一镜头尾帧' : '画面收尾',
        })),
      };

      return NextResponse.json({
        success: true,
        mode: 'subtitle-based',
        storyboard,
        shots: convertToStoryboardShots(result.shots),  // 直接可用的镜头数组
        analysis: {
          summary: result.summary,
          warnings: result.warnings,
          shotDetails: result.shots.map(s => ({
            index: s.index,
            duration: s.duration,
            sourceText: s.sourceText,
            sceneType: s.sceneType,
            emotion: s.emotion,
            promptPreview: s.prompt.substring(0, 80) + (s.prompt.length > 80 ? '...' : ''),
          })),
        },
      });
    }

    // ===== 模式2：基于提示词生成（改进版模板）=====
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 2) {
      return NextResponse.json(
        { error: '请提供至少2个字符的描述，或提供字幕段落数据' },
        { status: 400 }
      );
    }

    console.log(`[Storyboard] 使用提示词模式v3.0生成分镜，总时长: ${totalDuration}s, 场景=${sceneType || 'auto'}`);

    // ★ v3.0：使用场景感知分镜引擎（7种场景专属策略 + 视觉锚点 + Phase弧线）
    const promptResult = generateShotsFromUserPrompt(prompt, totalDuration, {
      maxShotDuration: segmentDuration,
      preferredSceneType: sceneType,
    });
    
    console.log(`[Storyboard] 提示词分镜v3.0生成完成: ${promptResult.shots.length}个片段, 策略=${promptResult.narrativeSummary}`);
    if (promptResult.visualAnchors.length > 0) {
      console.log(`[Storyboard] 视觉锚点: ${promptResult.visualAnchors.map(a => a.element).join(', ')}`);
    }

    // 转换为兼容格式（v3.0 增强版）
    const improvedStoryboard: Storyboard = {
      title: prompt.substring(0, 30) + (prompt.length > 30 ? '...' : ''),
      totalDuration,
      segments: promptResult.shots.map((seg, idx) => ({
        segmentNumber: idx + 1,
        duration: seg.duration,
        sceneDescription: seg.prompt.substring(0, 120) + (seg.prompt.length > 120 ? '...' : ''),
        characterAction: promptResult.entities.action || '自然表达',
        cameraAngle: seg.shotTypeLabel || (idx === 0 ? '广角建立镜头' : idx === promptResult.shots.length - 1 ? '收尾定格' : '中景推进'),
        lighting: '根据场景和情感自动匹配的光线方案',
        costumeProps: promptResult.entities.subject || '风格统一的着装',
        transitionHint: idx < promptResult.shots.length - 1 ? '首帧延续前一镜头尾帧' : '画面收尾淡出',
      })),
    };

    return NextResponse.json({
      success: true,
      mode: 'prompt-based-v4',
      storyboard: improvedStoryboard,
      shots: promptResult.shots.map(seg => ({
        id: seg.id,
        prompt: seg.prompt,
        duration: seg.duration,
        phase: seg.phase,
        shotType: seg.shotType,
        phaseLabel: seg.phaseLabel,
        shotTypeLabel: seg.shotTypeLabel,
        // ★ v4.0 新增：每镜头的字幕/旁白建议
        subtitleText: seg.subtitleText,
        narrationText: seg.narrationText,
      })),
      // ★ v3.0 新增字段
      narrativeSummary: promptResult.narrativeSummary,
      visualAnchors: promptResult.visualAnchors,
      entities: promptResult.entities,
      // ★ v4.0 新增：完整字幕/旁白数据
      subtitleSuggestion: promptResult.subtitleSuggestion,
      narrationSuggestion: promptResult.narrationSuggestion,
    });

  } catch (error) {
    console.error('[Storyboard] 生成分镜脚本失败:', error);

    return NextResponse.json(
      { error: `生成分镜脚本失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
