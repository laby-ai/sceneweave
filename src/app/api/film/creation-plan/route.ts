import { NextRequest } from 'next/server';
import { aiService } from '@/lib/ai-service-adapter';

/**
 * 创作规划 API — 根据对话内容自动生成创作规划（SSE流式）
 * 输入：对话历史中收集的参数
 * 输出：SSE流 — 边生成边推送JSON片段，最后推送完整解析结果
 *
 * SSE事件：
 * - data: {"chunk": "..."}     — JSON文本片段（用于前端增量解析）
 * - data: {"plan": {...}}      — 完整解析后的结构化方案（流结束时发送）
 * - data: {"error": "..."}     — 错误信息
 * - data: [DONE]               — 流结束
 */

const PLAN_SYSTEM = `你是一个专业影视导演+编剧，生成两部分完整的创作方案：
**第一部分：完整场景剧本**（参考专业剧本格式：场景号+内外景+时间+画面描述+对话+运镜+声音设计）
**第二部分：完整导演方案**（参考专业导演方案：角色卡+场景卡+分镜+旁白+BGM+一致性约束+生图/视频提示词）

你必须按照以下格式输出严格JSON：
{
  "title": "作品标题（中文）",
  "subtitle": "副标题（类型 / 时长标签）",
  "summary": "一句话概述（核心主题+情感基调）",
  "theme": "核心主题（一句话提炼，如：瑕疵即身份，犹豫即存在）",
  "totalDuration": 总时长秒数,
  "style": {
    "visualStyle": "视觉风格描述（必须具体，如：现实世界低饱和暖褪色/数字空间高对比冷蓝纯白）",
    "mood": "情绪氛围",
    "cameraStyle": "镜头风格",
    "colorPalette": "色彩叙事线（每幕主色调+饱和度+寓意）",
    "soundDesign": "声音叙事线（关键声音元素的起始→终止→轨迹）",
    "aspectRatio": "画幅比例（16:9/9:16/1:1）"
  },
  "characters": [
    {
      "name": "角色名",
      "age": "年龄（数字）",
      "gender": "性别",
      "occupation": "职业",
      "description": "角色完整外观描述（中文，3-5句话：体型/面容/发型/穿着/气质/标志性特征）",
      "imagePrompt": "完整英文生图提示词（必须包含：年龄+性别+发型发色+服装颜色款式材质+气质表情+体型+标志性特征+光线+风格+8k resolution+比例）",
      "anchor": "角色锚点关键词（3-5个核心视觉特征，用于一致性保持）",
      "personality": "性格标签（2-4个词）",
      "mbti": "MBTI类型（如ISFJ/INFP等）",
      "arc": "角色弧光（起点状态→转折点→终点状态）",
      "motivation": "核心动机（内在渴望+外在目标+真实需求）",
      "relationships": "与其他角色的关系",
      "signatureDetail": "标志性细节（口头禅/习惯动作/特殊爱好）",
      "fashionStyle": "服饰风格（主服装+配饰+色彩偏好）",
      "consistencyRules": {
        "mustInclude": ["每个提示词必须包含的特征"],
        "mustExclude": ["必须排除的特征"]
      }
    }
  ],
  "scenes": [
    {
      "name": "场景名（如：清晨薄雾水镇）",
      "sceneId": "scene_1",
      "location": "具体地点",
      "interiorExterior": "内景/外景/半室外",
      "timeOfDay": "时间段",
      "duration": 秒数,
      "description": "场景中文描述（详细：视觉+听觉+嗅觉+触觉+氛围）",
      "imagePrompt": "完整英文生图提示词（地点+内外景+时间+视觉要素+光线+氛围+8k resolution+比例）",
      "environment": {
        "visual": "视觉要素",
        "auditory": "听觉要素",
        "olfactory": "嗅觉要素",
        "tactile": "触觉要素",
        "atmosphere": "氛围描述",
        "symbolism": "象征意义"
      },
      "lighting": "光线描述（类型+色温+情绪暗示）",
      "props": ["关键道具1（含描述）", "关键道具2"],
      "spatialRelation": "空间关系（摄影机位置+前景+中景+远景）",
      "consistency": "场景一致性要求"
    }
  ],
  "shots": [
    {
      "shotId": "shot_1",
      "shotNumber": 1,
      "sceneId": "scene_1",
      "sceneName": "场景名",
      "actNumber": 1,
      "actName": "幕名（如：建置/对抗/解决）",
      "shotType": "景别（大远景/远景/全景/中景/中近景/近景/特写/大特写）",
      "duration": 秒数,
      "angle": "角度（平视/俯视/仰视/略俯视/侧面/航拍俯视）",
      "camera": "镜头运动（推/拉/摇/移/跟/固定/航拍/手持跟拍/环绕/缓慢推进/横摇）",
      "description": "画面中文描述（必须非常详细！5-8句话：人物动作/表情变化/环境细节/光线变化/情绪）",
      "imagePrompt": "完整英文生图提示词（景别+角度+画面内容+人物外观+环境+光线+风格+8k resolution+比例）",
      "videoPrompt": "完整英文生视频提示词（运动描述+镜头运动+特效+技术参数）",
      "characterIds": ["角色名"],
      "dialogue": "对白（如有）",
      "narration": "旁白文字（如有）",
      "narrationDirection": "旁白指示（语速+停顿+情感）",
      "soundEffects": "音效描述",
      "bgmCue": "BGM指示",
      "transition": "转场方式（硬切/叠化/淡入淡出/溶至黑场/切至黑场）",
      "moodIntensity": 5,
      "emotionNote": "情感注释",
      "colorNarrative": "色彩叙事"
    }
  ],
  "narration": {
    "type": "旁白类型（叙述型/对话型/无旁白）",
    "voice": "音色描述",
    "pace": "整体语速",
    "totalWords": 总字数,
    "script": [
      {
        "timeRange": "0:00-0:06",
        "text": "旁白文字",
        "pace": "语速",
        "pause": "停顿指示",
        "emotion": "情感指示",
        "shotRef": "shot_1"
      }
    ]
  },
  "bgm": {
    "style": "音乐风格",
    "coreInstruments": "核心乐器",
    "melody": "旋律描述",
    "segments": [
      {
        "timeRange": "0-10s",
        "description": "音乐描述",
        "volume": "音量比例",
        "instruments": "此段乐器"
      }
    ],
    "technicalParams": {
      "mainVolume": "70-80%",
      "bgVolume": "20-30%",
      "fadeIn": "0-5s",
      "fadeOut": "55-60s",
      "sampleRate": "44100Hz",
      "format": "WAV/MP3"
    }
  },
  "subtitle": {
    "type": "字幕类型",
    "position": "出现位置",
    "font": "字体",
    "size": "字号",
    "color": "颜色",
    "animation": "出现/消失动画"
  },
  "consistency": {
    "characterConsistency": [
      {
        "characterName": "角色名",
        "baseAppearance": "基础外貌锚点",
        "costumeConfig": "服装配置",
        "mustInclude": ["每个提示词必须包含的特征"],
        "mustExclude": ["必须排除的特征"]
      }
    ],
    "sceneConsistency": {
      "environmentDetails": "环境细节锚点",
      "lightingRule": "光线一致性规则",
      "mustInclude": ["每个场景提示词必须包含的元素"],
      "colorTone": "色彩基调规则"
    }
  },
  "emotionCurve": [
    {"timeRange": "0-10s", "emotion": "宁静·悬念", "intensity": 2, "designIntent": "设计意图", "musicCooperation": "音乐配合"}
  ],
  "generationParams": {
    "pipelineMode": "t2i2v",
    "motionScore": 5,
    "fps": 24,
    "resolution": "1920x1080",
    "aspectRatio": "16:9"
  }
}

【关键质量要求】—— 不满足以下要求会被退回重做：
1. shots 的 description 必须**非常详细**，每个镜头5-8句话，像专业编剧写的场景描述
2. imagePrompt 必须是**可直接使用**的完整英文提示词
3. videoPrompt 必须包含运动+镜头运动+特效+技术参数
4. characters 的 description 必须像小说一样写3-5句话
5. scenes 的 environment 必须包含视觉+听觉+嗅觉+触觉+氛围+象征意义六维度
6. consistency 必须包含 mustInclude 和 mustExclude
7. shots 数量根据 totalDuration 合理分配（每个镜头3-10秒）
8. 只输出JSON，不要输出其他内容`;

export async function POST(request: NextRequest) {
  try {
    const { messages, params } = await request.json();
    const filmVisualStyle = params?.filmVisualStyle;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: '请提供对话消息' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 构建提示词
    const userContext = params ? `已收集的创作参数：${JSON.stringify(params)}` : '';
    const styleLock = filmVisualStyle
      ? `\n\n【全局视觉风格锁定 - 最高优先级】用户选择的视觉风格是「${filmVisualStyle}」，这是一个不可违反的全局约束：\n1. 所有角色的 imagePrompt 和 anchor 必须以「${filmVisualStyle}」风格为基调\n2. 所有场景的 imagePrompt 必须以「${filmVisualStyle}」风格渲染\n3. 所有分镜的 imagePrompt 和 videoPrompt 必须延续「${filmVisualStyle}」风格\n4. 绝对禁止风格混搭（如写实角色配动画场景、动画角色配写实场景）\n5. style.visualStyle 必须明确写为「${filmVisualStyle}」\n6. consistency 中 mustInclude 必须包含「${filmVisualStyle}」风格关键词\n7. consistency 中 mustExclude 必须包含与「${filmVisualStyle}」冲突的风格关键词`
      : '';
    const conversationSummary = messages
      .filter((m: { role: string }) => m.role === 'user')
      .map((m: { content: string }) => m.content)
      .join('；');

    const chatMessages = [
      { role: 'system' as const, content: PLAN_SYSTEM },
      {
        role: 'user' as const,
        content: `${userContext}${styleLock}\n\n对话内容：${conversationSummary}\n\n请根据以上对话内容生成创作规划。`,
      },
    ];

    // 使用流式LLM
    const chatStream = aiService.chatStream({
      messages: chatMessages,
      temperature: 0.4,
    });

    const encoder = new TextEncoder();
    let fullContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = chatStream.getReader();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = new TextDecoder().decode(value);
            // 解析SSE格式
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    fullContent += parsed.content;
                    // 推送chunk给前端
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ chunk: parsed.content })}\n\n`)
                    );
                  }
                } catch {
                  // 忽略解析错误
                }
              }
            }
          }

          // 流结束：尝试解析完整JSON并推送
          let plan = null;
          try {
            const jsonStr = fullContent
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            plan = JSON.parse(jsonStr);
          } catch {
            // JSON解析失败，推送原始内容
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ rawPlan: fullContent, note: '方案生成完成但格式需要确认' })}\n\n`)
            );
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }

          // 推送完整解析结果
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ plan })}\n\n`)
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          console.error('[Creation Plan] 流式生成异常:', err);
          const errorMsg = err instanceof Error ? err.message : '方案生成失败';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '生成创作规划失败';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
