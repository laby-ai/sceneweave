import { NextRequest } from 'next/server';
import { aiService } from '@/lib/ai-service-adapter';
import { DegradeError } from '@/lib/model-router';
import { extractBYOKConnection } from '@/lib/byok-provider';
import { buildBYOKConfigErrorResponse, isBYOKConfigError } from '@/lib/byok-response';

/**
 * 影视创作 - AI对话助手 (SSE流式)
 * 支持多轮对话 + 结构化参数抽取
 * 自动降级: Minimax LLM → legacy provider LLM
 * 
 * 返回两种SSE事件：
 * - data: {"content": "..."}  — 对话文本流
 * - data: {"params": {...}}   — 抽取的结构化参数（流结束后发送一次）
 */

const FILM_CHAT_SYSTEM = `你是「绘影工作室」的搭档，不是AI助手，是一个真正懂创作的朋友。

## ⚠️ 严禁
- 不要重复用户说过的话，不要重复自己说过的内容
- 不要每次都列出完整角色/场景信息，只说变化的部分，不变的用"XX跟之前一样"带过
- 回复要简短，200字以内，除非在详细描述角色/场景/分镜
- 禁止使用emoji，包括✨🎨🎬📌✅等任何装饰性符号
- 禁止说"我来帮你""让我来""我会为你"这类服务性用语
- 禁止用"一是...二是...三是..."这种列举式说话
- 给选项时不要解释选项，直接抛出来让用户选

## 排版规则（必须遵守）
- 不用标题（## ###），不用加粗（**），只写正文
- 不用编号列表（1. 2. 3.），统一用短横线 - 
- 列表项末尾用分号 ;
- 首句自然陈述+冒号引出，比如"关于角色，可以这样定："
- 信息密度要高，每句话都有实质内容，不写空话
- 对话型回复不用列表，直接写2-3句自然段落

## 说话方式
- 像跟朋友闲聊，不是在做汇报。短句为主，语气随意
- 给方向时用短横线列表，比如：
  旅行Vlog想要什么感觉：
  - 治愈慢生活的松弛感；
  - 打卡逛吃的爽快感；
  - 公路旅行的自由氛围感。
- 不要"给你三个方向选"这种开场白，直接问+列选项
- 回复控制在2-4句话，别写小作文

## 聊天流程
1. 先聊聊创意 → 问感觉+给2-3个方向
2. 选定方向后 → 先讲一个故事梗概（3-5句，像讲故事一样，有起承转合），然后问用户"这个方向行吗？想调整哪里？"
3. 梗概定了 → 聊角色，一个个聊，每个角色：长什么样(像写小说那样3-5句)+性格+想要的变化感 → 聊定了就画出来
4. 聊场景 → 一个个聊，每个场景：氛围+光线+什么感觉 → 聊定了就画出来
5. 聊镜头 → 建议风格+规划镜头(📸 镜头N：景别 角度 时长s — 画面5-8句(角色@场景) 运镜 | 旁白+语速 | 音效 | BGM | 情感N/10 | 色彩叙事 | 转场)
6. 确认 → 输出<<GENERATE_PLAN>>触发确认

## 聊天原则
- 一次只聊一件事，给选择而不是问开放式问题
- 选了方向后先讲故事梗概，让用户对故事有画面感，再聊细节
- 定了就画，让用户实时看到东西
- 用户说"直接来吧"→跳到第6步
- 用户说"不像/变了"→分析问题并输出<<ADJUST>>调整
- 说人话，别说"基于您的需求""根据分析"这种话

## 信号（自然说出来，不解释是什么）
- 定了角色外观后：<<GENERATE_CHARACTER>>英文提示词, must include "character design reference sheet, multiple views, front view, side view, back view, full body, white background"(含age/hair/outfit/demeanor/lighting/style)<</GENERATE_CHARACTER>>
- 定了场景后：<<GENERATE_SCENE>>英文提示词, must include "4-panel grid layout, 2x2 arrangement, panel1:wide establishing shot, panel2:medium shot, panel3:close-up detail, panel4:atmospheric mood"(含elements/mood/shot type/lighting)<</GENERATE_SCENE>>
- 定了道具后：<<GENERATE_PROP>>英文提示词<</GENERATE_PROP>>
- 通用生图：<<GENERATE_IMAGE>>英文提示词<</GENERATE_IMAGE>>
- 调整：<<ADJUST>>类型(shot/style/character/scene)|编号|描述<</ADJUST>>
- 生成：<<GENERATE_PLAN>>
- 每次回复末尾：<<QUICK_OPTIONS>>选项A|选项B|选项C<</QUICK_OPTIONS>>
- 并行生成：可以在一条回复中输出多个信号（如同时定了一个角色和一个场景），它们会并行生成，加快速度

## 参数自动抽取
从对话中提取：scriptType/visualStyle/targetDuration/inputText/characters/scenes/mood/cameraStyle`;

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json();
    const byokConnection = extractBYOKConnection(request.headers);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: '请提供对话消息' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 构建上下文消息
    const systemContent = context
      ? `${FILM_CHAT_SYSTEM}\n\n当前创作上下文：\n${context}`
      : FILM_CHAT_SYSTEM;

    const chatMessages = [
      { role: 'system' as const, content: systemContent },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullContent = '';
        try {
          if (byokConnection) {
            const chatResult = await aiService.chat({
              messages: chatMessages,
              temperature: 0.8,
              byokConnection,
            });
            fullContent = chatResult.data.content || '';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: fullContent })}\n\n`));
          } else {
            // 消费适配器返回的 SSE 流
            const chatStream = aiService.chatStream({
              messages: chatMessages,
              temperature: 0.8,
              // 不指定模型，让适配器根据当前provider自动选择
            });
            const reader = chatStream.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;

                const data = trimmed.slice(5).trim();
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    fullContent += parsed.content;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: parsed.content })}\n\n`));
                  }
                  if (parsed.error) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: parsed.error })}\n\n`));
                  }
                } catch {
                  // 忽略解析错误的行
                }
              }
            }
          }

          // 流式对话结束后，用LLM做参数抽取（使用非流式）
          try {
            const extractionMessages = [
              {
                role: 'system' as const,
                content: `从以下影视创作对话中提取结构化参数。只返回JSON，不要其他文字。
可提取字段：scriptType, visualStyle, wordCount, targetDuration, inputText, selectedService, characters, scenes, mood, cameraStyle, genre, shotCount
如果某字段在对话中未提及，设为null。

scriptType可选值：短剧剧本/广告脚本/MV脚本/纪录片/宣传视频
visualStyle可选值：真人写实风格/宫崎骏水彩/赛博朋克/复古胶片/黑白艺术/动漫风格/油画质感/极简现代/古风国风/暗黑哥特
targetDuration可选值：30/45/60/90/180
selectedService可选值：storyboard_script/character_prompt/character_views/scene_generation/prop_generation
characters格式：角色名:描述，多个用分号分隔，如"小红:穿红裙的少女;老王:白发老人"
scenes格式：场景名:描述，多个用分号分隔
mood可选值：温暖/紧张/浪漫/悬疑/欢乐/忧伤/壮阔
cameraStyle可选值：手持纪实/稳定器流畅/固定机位/航拍/跟拍
genre可选值：古风/都市/科幻/悬疑/治愈/搞笑/纪录
shotCount：整数，根据时长和分镜复杂度推断

返回格式：{"scriptType":null,"visualStyle":null,"wordCount":null,"targetDuration":null,"inputText":"...","selectedService":null,"characters":null,"scenes":null,"mood":null,"cameraStyle":null,"genre":null,"shotCount":null}`,
              },
              ...messages.map((m: { role: string; content: string }) => ({
                role: m.role as 'system' | 'user' | 'assistant',
                content: m.content,
              })),
            ];

            const extractionResult = await aiService.chat({
              messages: extractionMessages,
              temperature: 0.1,
              byokConnection,
            });

            const extractionText = extractionResult.data.content;

            // 解析抽取结果
            const jsonMatch = extractionText.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
              try {
                const params = JSON.parse(jsonMatch[0]);
                // 验证抽取的参数有效性
                const validParams: Record<string, unknown> = {};
                if (params.scriptType && typeof params.scriptType === 'string') validParams.scriptType = params.scriptType;
                if (params.visualStyle && typeof params.visualStyle === 'string') validParams.visualStyle = params.visualStyle;
                if (params.wordCount && typeof params.wordCount === 'string') validParams.wordCount = params.wordCount;
                if (params.targetDuration !== null && params.targetDuration !== undefined) {
                  const dur = typeof params.targetDuration === 'number' ? params.targetDuration : parseInt(String(params.targetDuration), 10);
                  if (!isNaN(dur)) validParams.targetDuration = dur;
                }
                if (params.inputText && typeof params.inputText === 'string' && params.inputText.length > 2) validParams.inputText = params.inputText;
                if (params.selectedService && typeof params.selectedService === 'string') validParams.selectedService = params.selectedService;
                if (params.characters && typeof params.characters === 'string') {
                  validParams.characters = params.characters.split(';').map((c: string) => c.trim()).filter(Boolean);
                }
                if (params.scenes && typeof params.scenes === 'string') {
                  validParams.scenes = params.scenes.split(';').map((s: string) => s.trim()).filter(Boolean);
                }
                if (params.mood && typeof params.mood === 'string') validParams.mood = params.mood;
                if (params.cameraStyle && typeof params.cameraStyle === 'string') validParams.cameraStyle = params.cameraStyle;
                if (params.genre && typeof params.genre === 'string') validParams.genre = params.genre;
                if (params.shotCount !== null && params.shotCount !== undefined) {
                  const sc = typeof params.shotCount === 'number' ? params.shotCount : parseInt(String(params.shotCount), 10);
                  if (!isNaN(sc) && sc > 0) validParams.shotCount = sc;
                }

                if (Object.keys(validParams).length > 0) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ params: validParams })}\n\n`));
                }
              } catch {
                // JSON解析失败，忽略
              }
            }
          } catch {
            // 参数抽取失败不影响对话体验
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          const errorMsg = err instanceof DegradeError
            ? err.toUserMessage()
            : (err instanceof Error ? err.message : '流式输出异常');
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    if (isBYOKConfigError(err)) {
      return buildBYOKConfigErrorResponse(err);
    }
    console.error('[FilmChat] Error:', err);
    const errorMsg = err instanceof DegradeError
      ? err.toUserMessage()
      : (err instanceof Error ? err.message : '对话服务异常');
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
