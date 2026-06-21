/**
 * 剧情剪辑分析 API
 * 融合 NarratoAI 的字幕分析 + 剧情提取 + 剪辑逻辑
 */
import { NextRequest, NextResponse } from 'next/server';
import { cozeChat } from '@/lib/coze-api';

/** 剧情分析请求 */
interface PlotAnalysisRequest {
  script: string;
  style?: 'short_drama' | 'documentary' | 'film';
  targetDuration?: number;
}

/** 字幕分析请求 */
interface SubtitleAnalysisRequest {
  subtitles: Array<{
    text: string;
    startTime: number;
    endTime: number;
    speaker?: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'analyze_plot': {
        const { script, style = 'short_drama', targetDuration = 60 } = body as PlotAnalysisRequest;
        const result = await analyzePlot(script, style, targetDuration);
        return NextResponse.json({ success: true, result });
      }

      case 'analyze_subtitles': {
        const { subtitles } = body as SubtitleAnalysisRequest;
        const result = analyzeSubtitles(subtitles);
        return NextResponse.json({ success: true, result });
      }

      case 'suggest_clips': {
        const { plotSegments, totalDuration } = body as {
          plotSegments: Array<{
            summary: string;
            pacing: string;
            suggestedDuration: number;
            keyFrameDescription: string;
          }>;
          totalDuration: number;
        };
        const result = suggestClipTransitions(plotSegments, totalDuration);
        return NextResponse.json({ success: true, result });
      }

      default:
        return NextResponse.json(
          { error: '未知操作，支持: analyze_plot, analyze_subtitles, suggest_clips' },
          { status: 400 },
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '剪辑分析失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** 剧情分析 — 调用 LLM 将剧本拆分为剧情段落 */
async function analyzePlot(
  script: string,
  style: string,
  targetDuration: number,
) {
  const systemPrompt = `你是一位专业的影视剪辑分析师。根据剧本内容，将其拆分为若干剧情段落，每个段落包含：
- summary: 剧情摘要（一句话）
- emotion: 情感基调（紧张/悲伤/欢快/愤怒/温柔/庄严/悬疑）
- pacing: 节奏标签（fast/medium/slow）
- keyFrameDescription: 关键帧画面描述（用于AI生成参考图）
- characterIds: 涉及角色名列表
- suggestedShotCount: 建议镜头数
- suggestedDuration: 建议时长（秒）
- dialogues: 对白列表，每项包含 character(角色名), text(台词), emotion(情绪)

风格类型：${style}
目标总时长：${targetDuration}秒

请以 JSON 数组格式输出，不要输出其他内容。`;

  const userPrompt = `分析以下剧本并拆分为剧情段落：\n\n${script}`;

  const response = await cozeChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  const content = response.content;

  try {
    // 尝试解析 LLM 返回的 JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // 解析失败返回原始文本
  }

  return { rawAnalysis: content };
}

/** 字幕分析 — 统计分析字幕数据 */
function analyzeSubtitles(
  subtitles: SubtitleAnalysisRequest['subtitles'],
) {
  const totalSubtitles = subtitles.length;
  let totalDuration = 0;
  let dialogueCount = 0;
  let narrationCount = 0;
  let totalChars = 0;

  for (const sub of subtitles) {
    const duration = sub.endTime - sub.startTime;
    totalDuration += duration;
    totalChars += sub.text.length;

    if (sub.speaker) {
      dialogueCount++;
    } else {
      narrationCount++;
    }
  }

  const dialogueRatio = totalSubtitles > 0 ? dialogueCount / totalSubtitles : 0;
  const narrationRatio = totalSubtitles > 0 ? narrationCount / totalSubtitles : 0;
  const averagePace = totalDuration > 0 ? totalChars / totalDuration : 0;

  return {
    totalSubtitles,
    totalDuration,
    dialogueRatio: Math.round(dialogueRatio * 100) / 100,
    narrationRatio: Math.round(narrationRatio * 100) / 100,
    averagePace: Math.round(averagePace * 10) / 10,
    segments: subtitles,
  };
}

/** 建议剪辑过渡 — 根据剧情段落节奏建议过渡效果 */
function suggestClipTransitions(
  plotSegments: Array<{
    summary: string;
    pacing: string;
    suggestedDuration: number;
    keyFrameDescription: string;
  }>,
  targetDuration: number,
) {
  const suggestions = plotSegments.map((segment, index) => {
    // 根据节奏和相邻段落推荐过渡效果
    let transition: string;
    let transitionDuration: number;

    if (index === 0) {
      transition = 'fade_black';
      transitionDuration = 1.5;
    } else if (index === plotSegments.length - 1) {
      transition = 'fade_black';
      transitionDuration = 2.0;
    } else {
      const prevPacing = plotSegments[index - 1].pacing;
      const currPacing = segment.pacing;

      if (prevPacing === 'slow' && currPacing === 'fast') {
        transition = 'cut';
        transitionDuration = 0;
      } else if (prevPacing === 'fast' && currPacing === 'slow') {
        transition = 'dissolve';
        transitionDuration = 1.0;
      } else if (prevPacing === currPacing) {
        transition = 'cut';
        transitionDuration = 0;
      } else {
        transition = 'dissolve';
        transitionDuration = 0.5;
      }
    }

    return {
      segmentIndex: index,
      summary: segment.summary,
      duration: segment.suggestedDuration,
      transition,
      transitionDuration,
      keyFrameDescription: segment.keyFrameDescription,
    };
  });

  const totalSegmentDuration = plotSegments.reduce(
    (sum, s) => sum + s.suggestedDuration, 0,
  );
  const totalTransitionDuration = suggestions.reduce(
    (sum, s) => sum + s.transitionDuration, 0,
  );

  return {
    suggestions,
    totalSegmentDuration,
    totalTransitionDuration,
    estimatedTotalDuration: totalSegmentDuration + totalTransitionDuration,
    targetDuration,
    pacingAdvice: totalSegmentDuration > targetDuration
      ? '建议压缩慢节奏段落或减少镜头数'
      : totalSegmentDuration < targetDuration * 0.8
      ? '建议增加环境镜头或情感特写'
      : '时长分配合理',
  };
}
