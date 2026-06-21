import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service-adapter';

interface SubtitleSegment {
  text: string;
  startTime: number;
  endTime: number;
}

interface SubtitleGenerationResponse {
  success: boolean;
  subtitle: string;
  segments: SubtitleSegment[];
  prompt: string;
  duration: number;
  provider?: string;
  degraded?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      prompt, 
      duration = 10,
      style = 'default',
      mood = 'default',
      language = 'zh',
      generateSegments = true
    } = body;

    // 验证必填参数
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的视频描述' },
        { status: 400 }
      );
    }

    // 根据语言选择提示词
    const isEnglish = language === 'en';

    // 构建提示词
    const systemPrompt = isEnglish
      ? buildEnglishSystemPrompt(duration, style, mood, generateSegments)
      : buildChineseSystemPrompt(duration, style, mood, generateSegments);

    const userPrompt = isEnglish
      ? `Please create subtitles for the following video description (video duration: ${duration} seconds):\n\n${prompt}`
      : `请为以下视频描述创作字幕（视频时长：${duration}秒）：\n\n${prompt}`;

    const result = await aiService.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
    });

    const rawContent = result.data.content.trim();

    // 解析生成的内容
    const { fullText, segments } = parseSubtitleResponse(rawContent, duration, generateSegments);

    return NextResponse.json({
      success: true,
      subtitle: fullText,
      segments,
      prompt,
      duration,
      provider: result.provider,
      degraded: result.degraded,
    } as SubtitleGenerationResponse);
  } catch (error: unknown) {
    console.error('字幕生成错误:', error);
    const message = error instanceof Error ? error.message : '服务器错误，请稍后重试';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

function buildChineseSystemPrompt(
  duration: number, 
  style: string, 
  mood: string, 
  generateSegments: boolean
): string {
  let prompt = `你是一个专业的视频字幕创作专家。根据用户提供的视频描述，创作适合视频的字幕。

核心要求：
1. 字幕内容要与视频描述高度匹配
2. 字幕总长度要适合在${duration}秒的视频中展示
3. 语言风格要生动、吸引人，符合视频主题
4. 字幕应该简洁有力，易于阅读和理解

${style !== 'default' ? `5. 风格要求：${getStyleDescription(style)}` : ''}
${mood !== 'default' ? `6. 情感基调：${getMoodDescription(mood)}` : ''}

输出格式要求：
${generateSegments ? `请以JSON格式返回，包含完整字幕文本和分段信息：
{
  "fullText": "完整的字幕文本",
  "segments": [
    {
      "text": "第一段字幕内容",
      "startTime": 0,
      "endTime": ${Math.round(duration / 3)}
    },
    {
      "text": "第二段字幕内容", 
      "startTime": ${Math.round(duration / 3)},
      "endTime": ${Math.round(duration * 2 / 3)}
    },
    {
      "text": "第三段字幕内容",
      "startTime": ${Math.round(duration * 2 / 3)},
      "endTime": ${duration}
    }
  ]
}

分段要求：
- 根据视频时长合理分段，每段3-8秒
- 每段字幕要完整表达一个意思
- 分段之间的衔接要自然流畅
- 时间格式用秒表示，可以有小数` : '请直接返回字幕文本，不需要JSON格式。'}`;

  return prompt;
}

function buildEnglishSystemPrompt(
  duration: number, 
  style: string, 
  mood: string, 
  generateSegments: boolean
): string {
  let prompt = `You are a professional video subtitle creation expert. Create suitable subtitles for the video based on the user's video description.

Core requirements:
1. Subtitle content should highly match the video description
2. Total subtitle length should be suitable for a ${duration}-second video
3. Language style should be vivid and engaging, matching the video theme
4. Subtitles should be concise, powerful, easy to read and understand

${style !== 'default' ? `5. Style requirement: ${getStyleDescriptionEnglish(style)}` : ''}
${mood !== 'default' ? `6. Emotional tone: ${getMoodDescriptionEnglish(mood)}` : ''}

Output format requirements:
${generateSegments ? `Please return in JSON format with full subtitle text and segment information:
{
  "fullText": "Complete subtitle text",
  "segments": [
    {
      "text": "First segment subtitle",
      "startTime": 0,
      "endTime": ${Math.round(duration / 3)}
    },
    {
      "text": "Second segment subtitle", 
      "startTime": ${Math.round(duration / 3)},
      "endTime": ${Math.round(duration * 2 / 3)}
    },
    {
      "text": "Third segment subtitle",
      "startTime": ${Math.round(duration * 2 / 3)},
      "endTime": ${duration}
    }
  ]
}

Segment requirements:
- Segment reasonably based on video duration, 3-8 seconds per segment
- Each segment should completely express one idea
- Transitions between segments should be natural and smooth
- Time format in seconds, decimals allowed` : 'Please return subtitle text directly, no JSON format needed.'}`;

  return prompt;
}

function getStyleDescription(style: string): string {
  const descriptions: Record<string, string> = {
    'realistic': '写实风格，真实感强，细节丰富',
    'anime': '日系动漫风格，精美细腻',
    'cartoon': '卡通风格，简洁可爱，色彩鲜艳',
    'cinematic': '电影大片风格，专业电影级光影',
    'watercolor': '水彩画风格，柔和的水彩质感',
    'oil-painting': '油画风格，厚重的油画笔触',
    'pixel-art': '像素艺术风格，复古8-bit像素风',
    '3d-render': '3D渲染风格，高质量3D建模',
    'sketch': '素描风格，手绘质感',
    'minimalist': '极简风格，简洁现代',
    'vintage': '复古风格，怀旧质感',
    'cyberpunk': '赛博朋克风格，霓虹灯光，未来都市',
  };
  return descriptions[style] || '';
}

function getStyleDescriptionEnglish(style: string): string {
  const descriptions: Record<string, string> = {
    'realistic': 'Realistic style, strong sense of reality, rich details',
    'anime': 'Japanese anime style, exquisite and delicate',
    'cartoon': 'Cartoon style, simple and cute, bright colors',
    'cinematic': 'Cinematic style, professional movie-grade lighting',
    'watercolor': 'Watercolor style, soft watercolor texture',
    'oil-painting': 'Oil painting style, thick oil painting brushstrokes',
    'pixel-art': 'Pixel art style, retro 8-bit pixel style',
    '3d-render': '3D rendering style, high-quality 3D modeling',
    'sketch': 'Sketch style, hand-drawn texture',
    'minimalist': 'Minimalist style, simple and modern',
    'vintage': 'Vintage style, nostalgic texture',
    'cyberpunk': 'Cyberpunk style, neon lights, futuristic city',
  };
  return descriptions[style] || '';
}

function getMoodDescription(mood: string): string {
  const descriptions: Record<string, string> = {
    'happy': '快乐轻松的氛围，明亮欢快',
    'romantic': '浪漫温馨的氛围，柔和温暖',
    'mysterious': '神秘悬疑的氛围，暗色调，阴影层次',
    'epic': '宏大史诗感，壮阔的场景',
    'peaceful': '宁静祥和的氛围，柔和的光线',
    'exciting': '充满活力和激情，动感的画面',
    'dramatic': '强烈的戏剧感，戏剧性的光影',
    'whimsical': '奇幻异想天开的氛围，梦幻色彩',
    'nostalgic': '怀旧回忆感，复古色调',
    'tense': '紧张刺激的氛围，紧凑的节奏',
    'heartwarming': '温暖人心的感觉，柔和的光线',
    'futuristic': '科技未来感，现代设计',
  };
  return descriptions[mood] || '';
}

function getMoodDescriptionEnglish(mood: string): string {
  const descriptions: Record<string, string> = {
    'happy': 'Happy and relaxed atmosphere, bright and cheerful',
    'romantic': 'Romantic and warm atmosphere, soft and warm',
    'mysterious': 'Mysterious and suspenseful atmosphere, dark tones, shadow layers',
    'epic': 'Grand epic feeling, magnificent scenes',
    'peaceful': 'Peaceful and serene atmosphere, soft lighting',
    'exciting': 'Full of energy and passion, dynamic画面',
    'dramatic': 'Strong dramatic feeling, dramatic lighting',
    'whimsical': 'Fantasy and whimsical atmosphere, dreamy colors',
    'nostalgic': 'Nostalgic feeling, vintage tones',
    'tense': 'Tense and exciting atmosphere, tight rhythm',
    'heartwarming': 'Warm and touching feeling, soft lighting',
    'futuristic': 'Futuristic tech feeling, modern design',
  };
  return descriptions[mood] || '';
}

function parseSubtitleResponse(
  content: string, 
  duration: number, 
  generateSegments: boolean
): { fullText: string; segments: SubtitleSegment[] } {
  // 尝试解析JSON格式
  if (generateSegments) {
    try {
      // 清理可能的markdown代码块标记
      const cleanedContent = content
        .replace(/^```json\s*/, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      
      const parsed = JSON.parse(cleanedContent);
      
      if (parsed.fullText && parsed.segments && Array.isArray(parsed.segments)) {
        // 验证并修复分段
        const validSegments = validateAndFixSegments(parsed.segments, duration);
        return {
          fullText: parsed.fullText,
          segments: validSegments,
        };
      }
    } catch (e) {
      console.log('JSON解析失败，回退到纯文本模式:', e);
    }
  }
  
  // 如果不是JSON或不需要分段，创建默认分段
  const fullText = content.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
  
  // 根据时长自动分段
  const segments = autoSegmentText(fullText, duration);
  
  return { fullText, segments };
}

function validateAndFixSegments(segments: any[], duration: number): SubtitleSegment[] {
  const validSegments: SubtitleSegment[] = [];
  
  for (const seg of segments) {
    if (seg.text && typeof seg.text === 'string') {
      validSegments.push({
        text: seg.text.trim(),
        startTime: Math.max(0, Number(seg.startTime) || 0),
        endTime: Math.min(duration, Math.max(Number(seg.startTime) + 3, Number(seg.endTime) || duration)),
      });
    }
  }
  
  // 如果没有有效分段，创建一个默认分段
  if (validSegments.length === 0) {
    return [];
  }
  
  // 确保时间不重叠且连续
  return normalizeSegmentTiming(validSegments, duration);
}

function normalizeSegmentTiming(segments: SubtitleSegment[], duration: number): SubtitleSegment[] {
  if (segments.length === 0) return [];
  
  const normalized = [...segments];
  
  // 按开始时间排序
  normalized.sort((a, b) => a.startTime - b.startTime);
  
  // 确保第一个从0开始
  normalized[0].startTime = 0;
  
  // 确保最后一个到duration结束
  normalized[normalized.length - 1].endTime = duration;
  
  // 调整中间分段的时间，确保不重叠且连续
  for (let i = 1; i < normalized.length; i++) {
    const prev = normalized[i - 1];
    const curr = normalized[i];
    
    // 确保当前分段的开始时间等于上一个的结束时间
    curr.startTime = prev.endTime;
    
    // 确保结束时间至少比开始时间多2秒
    if (curr.endTime <= curr.startTime) {
      curr.endTime = Math.min(curr.startTime + 5, duration);
    }
  }
  
  return normalized;
}

function autoSegmentText(text: string, duration: number): SubtitleSegment[] {
  if (!text.trim()) return [];
  
  // 根据标点符号和换行符分割
  const sentences = text
    .split(/[。！？.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  if (sentences.length === 0) {
    return [{
      text,
      startTime: 0,
      endTime: duration,
    }];
  }
  
  // 计算每段的大致时长
  const segmentDuration = Math.max(3, Math.min(8, duration / Math.min(sentences.length, 10)));
  
  const segments: SubtitleSegment[] = [];
  let currentTime = 0;
  
  // 创建分段
  for (let i = 0; i < sentences.length; i++) {
    const isLast = i === sentences.length - 1;
    const endTime = isLast ? duration : Math.min(currentTime + segmentDuration, duration);
    
    if (currentTime < endTime) {
      segments.push({
        text: sentences[i],
        startTime: currentTime,
        endTime,
      });
    }
    
    currentTime = endTime;
    
    // 如果已经到达总时长，停止
    if (currentTime >= duration) break;
  }
  
  return segments;
}
