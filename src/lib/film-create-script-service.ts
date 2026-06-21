import type { CreateScriptRequest, CreateScriptResponse, FilmScript, FilmCharacter, FilmScene, ScreenplayScene, DirectorSceneCard } from '@/types/film';
import { aiService } from '@/lib/ai-service-adapter';
import { parseFilmScriptJson } from '@/lib/film-script-json';
import { fillMissingFilmScriptFields, generateShotsFromScenes } from '@/lib/film-script-normalizer';
import { DegradeError } from '@/lib/model-router';
import type { BYOKConnection } from '@/lib/byok-provider';

/**
 * 影视创作 - 编剧Agent (SSE流式版)
 * 拆分为两次LLM调用：
 *   第一次 → screenplay + shots（剧本+分镜）
 *   第二次 → characterCards + sceneCards（导演方案）
 */

// ============================================================
// 第一部分 Prompt：剧本+分镜
// ============================================================
const SCREENPLAY_SYSTEM_PROMPT = `你是一位资深影视编剧。将故事文本转化为专业好莱坞格式剧本+分镜。

【输出格式】严格输出合法JSON。字符串值中禁止使用双引号，改用单引号或中文引号。

screenplay[]每个场景必须包含：
- sceneNumber/title/interior/location/timeOfDay
- stageDirections：3-5句画面描述(走位/光效/情绪/构图)
- dialogues[]：每条含character(角色名)/line(完整台词)/direction(动作/表情)
- cameraDirections：运镜指示
- soundDesign：环境音+音效+静默
- transition：转场方式

shots[]每个分镜必须包含：
- id/sceneId/sceneNumber/shotNumber/shotType/cameraAngle/cameraMovement
- description：5-8句中文描述
- contentEn：[Character:hair+eyes+top+bottom]+[Scene:color+light+mood]
- dialogue/narrationDirection/soundDesign/bgmCue/transition/duration(3-8)
- characters[]/emotionTag/emotionIntensity/colorNarrative

【一致性铁律】
- 同一角色在所有shot中appearance/outfit必须逐字一致
- contentEn必须含[Character:hair+eyes+top+bottom]+[Scene:color+light+mood]
- shots的sceneNumber必须与screenplay的场景编号对应
- 每个sceneplay场景至少2个shot

【分镜叙事一致性规则 - 最高优先级】
- shots必须严格按照screenplay的叙事顺序展开，不得偏离、跳过或自行创作剧情
- 每个shot的description必须忠实反映对应screenplay场景的stageDirections和dialogues内容
- shot的dialogue必须直接来源于对应screenplay场景中的dialogues，不得编造或遗漏台词
- shot的emotionTag必须与对应screenplay场景的mood/氛围一致
- shot的cameraMovement/shotType必须与对应screenplay的cameraDirections一致
- 整体分镜走向必须完整呈现故事的开端→发展→高潮→结局，不得遗漏关键剧情转折
- 禁止在分镜中添加剧本未提及的剧情、角色行为或场景变化`;

function buildScreenplayPrompt(req: CreateScriptRequest): string {
  const { text, style = '写实电影感', duration = 60, platform = '通用', characterCount, domain, mood, directorGuidance, filmVisualStyle } = req;
  const domainNote = domain ? `\n- 内容领域：${domain === 'film' ? '影视剧情' : domain === 'anime' ? '动漫动画' : domain === 'market' ? '营销广告' : domain === 'short' ? '短视频' : domain === 'mv' ? '音乐MV' : domain === 'doc' ? '纪录片' : '舞台剧'}` : '';
  const moodNote = mood ? `\n- 情绪基调：${mood}` : '';
  const sceneCount = Math.max(3, Math.ceil(duration / 20));
  const shotCount = Math.ceil(duration / 8);
  const dg = directorGuidance;
  const directorNote = dg ? `
【自动化导演方案指引 - 必须遵循】
- 内容类型：${dg.contentType || '通用'}
- 建议场景数：${sceneCount}个场景，${dg.shotCount || shotCount}个分镜
- 情感曲线：${dg.emotionCurve || '平稳起伏'}
${dg.styleTags?.length ? `- 风格标签：${dg.styleTags.join('、')}` : ''}
${dg.cameraDirections?.length ? `- 摄像机运动建议：${dg.cameraDirections.join(' → ')}` : ''}
${dg.transitionStyles?.length ? `- 转场风格：${dg.transitionStyles.join('、')}` : ''}
${dg.riskNotes?.length ? `- 风险提示（必须规避）：${dg.riskNotes.join('；')}` : ''}` : '';
  const styleLockNote = filmVisualStyle ? `
【全局视觉风格锁定 - 最高优先级，所有生成必须遵循】
- 视觉风格：${filmVisualStyle}
- 规则1：每个shots的imagePrompt/contentEn必须以风格锁定词开头
- 规则2：所有角色描述和imagePrompt中必须包含"${filmVisualStyle}"风格关键词
- 规则3：所有场景描述和imagePrompt中必须包含"${filmVisualStyle}"风格关键词
- 规则4：严禁出现与"${filmVisualStyle}"冲突的其他风格词（如动画vs写实、卡通vs照片级等）
- 规则5：全场所有画面必须统一为${filmVisualStyle}，不允许任何镜头偏离
- 规则6：如果风格为写实/电影感，contentEn中严禁出现anime/cartoon/illustration/painting/2d等词
- 规则7：如果风格为卡通/动画，contentEn中严禁出现photorealistic/cinematic/real photo等词
- 规则8：场景的stageDirections描述环境氛围即可，不要在场景画面中出现人物（人物只在分镜shots中出现）` : '';

  return `请将以下故事转化为完整影视剧本+分镜：

【故事文本】
${text}

【创作要求】
- 风格：${style}，时长：约${duration}秒，平台：${platform}${domainNote}${moodNote}
${characterCount ? `- 角色数：不超过${characterCount}个` : ''}
- 必须生成${sceneCount}个以上screenplay场景，对应至少${shotCount}个shots
${directorNote}
${styleLockNote}

⚠️ 按此JSON格式输出（不要输出JSON以外的文字。字符串值中禁止使用双引号，改用单引号）：
{
  "title":"标题","coreTheme":"核心主题","style":"${style}","totalDuration":${duration},
  "colorNarrativeLine":"各幕主色+饱和度","emotionCurve":"情绪曲线",
  "screenplay":[
    {"sceneNumber":1,"title":"场景标题","interior":true,"location":"地点","timeOfDay":"日",
     "stageDirections":"3-5句画面描述(走位+光效+情绪+构图)",
     "dialogues":[{"character":"角色名","line":"完整台词","direction":"动作/表情"}],
     "cameraDirections":"运镜指示","soundDesign":"环境音+音效","transition":"转场"}
  ],
  "shots":[
    {"id":"shot_1_1","sceneId":"scene_1","sceneNumber":1,"shotNumber":1,
     "shotType":"景别","cameraAngle":"角度","cameraMovement":"运镜",
     "description":"5-8句中文描述","contentEn":"[Character:hair+eyes+top+bottom][Scene:color+light+mood]",
     "dialogue":"","narrationDirection":"","soundDesign":"",
     "bgmCue":"","transition":"","duration":5,
     "characters":["char_1"],"emotionTag":"","emotionIntensity":7,"colorNarrative":""}
  ],
  "narrationScript":"完整旁白(标注语速/停顿)","bgmSuggestion":"分段配乐","subtitleSuggestion":"字体/颜色/位置"
}`;
}

// ============================================================
// 第二部分 Prompt：导演方案（角色卡+场景卡）
// ============================================================
const DIRECTOR_SYSTEM_PROMPT = `你是一位资深导演。根据已有的剧本和分镜信息，生成专业导演方案。

【输出格式】严格输出合法JSON。字符串值中禁止使用双引号，改用单引号或中文引号。

characterCards[]每个角色卡：
- id/name/age/gender/mbti/arc(从...到...)/motivation/relationships{}/signatureDetail
- appearance：生图级精确描述(发型颜色长度造型+瞳色+身高体型)
- outfit：生图级精确描述(上装+下装+鞋+配饰)
- consistencyRules：{mustInclude:[],mustExclude:[]}

sceneCards[]每个场景卡：
- id/sceneNumber/name/location/timeOfDay/interior
- visualDescription：主色调+光源+构图+天气+空间感（注意：场景图中不得出现任何人物，只描述环境氛围）
- fiveSenses：{sight,hearing,touch?,smell?,taste?}
- symbolism/mood/keyProps/colorPalette

propCards[]每个道具卡：
- id/name/category(武器/饰品/容器/文书/工具/食物/交通工具/其他)/material/color/size
- significance：剧情意义（该道具在故事中的象征或推动作用）
- closeup：是否需要特写镜头(boolean)
- appearance：生图级精确外观描述(材质纹理+光泽+色彩+细节+磨损痕迹)
- propEn：英文生图提示词`;

function buildDirectorPrompt(script: Partial<FilmScript>): string {
  const chars = script.characters || [];
  const scenes = script.scenes || [];
  const shots = script.shots || [];
  const sp = script.screenplay || [];

  const screenplaySummary = (Array.isArray(sp) ? sp : []).map(s =>
    `场景${s.sceneNumber}「${s.title}」(${s.interior ? '内' : '外'}·${s.location}·${s.timeOfDay})`
  ).join('\n');

  const shotSummary = shots.slice(0, 30).map(s =>
    `镜头${s.shotNumber}(场景${s.sceneNumber}): ${s.content?.substring(0, 60) || ''} | 角色:${s.characters?.join(',') || '无'} | ${s.emotionTag || ''}`
  ).join('\n');

  const charSummary = chars.map(c =>
    `${c.id}: ${c.name} - ${c.appearance || ''} | ${c.outfit || ''}`
  ).join('\n');

  const sceneSummary = scenes.map(s =>
    `${s.id}: 场景${s.sceneNumber}「${s.name}」- ${s.location} | ${s.mood || ''}`
  ).join('\n');

  return `根据以下剧本信息，生成完整导演方案：

【剧本标题】${script.title || '原创'}
【核心主题】${script.coreTheme || ''}

【场景剧本概要】
${screenplaySummary || '无'}

【角色】
${charSummary || '无'}

【场景】
${sceneSummary || '无'}

【分镜概要】
${shotSummary || '无'}

⚠️ 按此JSON格式输出（不要输出JSON以外的文字。字符串值中禁止使用双引号）：
{
  "characterCards":[
    {"id":"char_1","name":"角色名","age":"","gender":"","mbti":"ISTJ",
     "arc":"从...到...","motivation":"动机","relationships":{},"signatureDetail":"标志性细节",
     "appearance":"发型+颜色+长度+造型、瞳色、身高体型",
     "outfit":"上装+下装+鞋+配饰",
     "consistencyRules":{"mustInclude":[],"mustExclude":[]}}
  ],
  "sceneCards":[
    {"id":"scene_1","sceneNumber":1,"name":"","location":"","timeOfDay":"日","interior":false,
     "visualDescription":"主色调+光源+构图+天气+空间感",
     "fiveSenses":{"sight":"","hearing":"","touch":"","smell":"","taste":""},
     "symbolism":"","mood":"","keyProps":"","colorPalette":""}
  ],
  "propCards":[
    {"id":"prop_1","name":"道具名","category":"类型","material":"材质","color":"颜色","size":"尺寸",
     "significance":"剧情意义","closeup":false,
     "appearance":"生图级精确外观描述(材质纹理+光泽+色彩+细节+磨损痕迹)",
     "propEn":"英文生图提示词"}
  ],
  "consistencyConstraints":"人物一致性约束总结"
}`;
}


function sendSSE(
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: string,
  data: unknown
): void {
  try {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(encoder.encode(msg));
  } catch {
    // Stream already closed.
  }
}

export function createFilmScriptStream(
  body: CreateScriptRequest,
  byokConnection?: BYOKConnection
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        if (!body.text || body.text.trim().length === 0) {
          sendSSE(encoder, controller, 'error', { error: '请提供故事文本' });
          controller.close();
          return;
        }

        const targetDuration = body.duration || 60;

        // 发送开始事件
        sendSSE(encoder, controller, 'progress', {
          stage: 'start',
          progress: 5,
          message: 'AI编剧开始构思...',
        });

        const MAX_RETRIES = byokConnection ? 0 : 2;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            // =============================================
            // 第一次LLM调用：生成 screenplay + shots（流式输出）
            // =============================================
            sendSSE(encoder, controller, 'progress', {
              stage: 'generating',
              progress: 10 + attempt * 5,
              message: `AI编剧正在创作剧本+分镜（尝试 ${attempt + 1}/${MAX_RETRIES + 1}）...`,
              attempt: attempt + 1,
              maxAttempts: MAX_RETRIES + 1,
            });

            const messages: Array<{ role: 'system' | 'user'; content: string }> = [
              { role: 'system', content: SCREENPLAY_SYSTEM_PROMPT },
            ];
            messages.push({ role: 'user', content: buildScreenplayPrompt(body) });

            if (attempt > 0) {
              messages.push({
                role: 'user',
                content: `【重要提醒】上次生成失败。请务必：1. 只输出纯JSON 2. shots数组必须至少${Math.ceil(targetDuration / 8)}个元素 3. screenplay数组必须完整 4. 字符串值中禁止使用双引号`,
              });
            }

            // 使用流式LLM调用，实时转发文本到前端
            let fullContent = '';
            try {
              if (byokConnection) {
                const chatResult = await aiService.chat({
                  messages,
                  temperature: attempt > 0 ? 0.5 : 0.7,
                  maxTokens: 8192,
                  byokConnection,
                });
                fullContent = chatResult.data.content || '';
                sendSSE(encoder, controller, 'text', { chunk: fullContent });
              } else {
                const llmStream = aiService.chatStream({
                  messages,
                  temperature: attempt > 0 ? 0.5 : 0.7,
                  maxTokens: 8192,
                });

                const llmReader = llmStream.getReader();
                const llmDecoder = new TextDecoder();
                let llmBuffer = '';

                while (true) {
                  const { done, value } = await llmReader.read();
                  if (done) break;

                  llmBuffer += llmDecoder.decode(value, { stream: true });

                  // 解析SSE事件
                  const lines = llmBuffer.split('\n');
                  llmBuffer = lines.pop() || '';

                  for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data:')) continue;

                    const dataStr = trimmed.startsWith('data: ')
                      ? trimmed.slice(6)
                      : trimmed.slice(5);

                    if (dataStr === '[DONE]') continue;

                    try {
                      const data = JSON.parse(dataStr);
                      const chunk = data.content || data.text || data.chunk || '';
                      if (chunk) {
                        fullContent += chunk;
                        sendSSE(encoder, controller, 'text', { chunk });
                      }
                    } catch {
                      // 非JSON行忽略
                    }
                  }
                }
                // 处理剩余buffer
                if (llmBuffer.trim()) {
                  const remaining = llmBuffer.trim();
                  if (remaining.startsWith('data:')) {
                    const dataStr = remaining.startsWith('data: ')
                      ? remaining.slice(6)
                      : remaining.slice(5);
                    if (dataStr !== '[DONE]') {
                      try {
                        const data = JSON.parse(dataStr);
                        const chunk = data.content || data.text || data.chunk || '';
                        if (chunk) {
                          fullContent += chunk;
                          sendSSE(encoder, controller, 'text', { chunk });
                        }
                      } catch { /* ignore */ }
                    }
                  }
                }
              }
            } catch (streamErr) {
              // 流式调用失败，降级到非流式
              console.warn('[Film Script Agent] Stream failed, falling back to non-stream:', (streamErr as Error).message);
              const chatResult = await aiService.chat({
                messages,
                temperature: attempt > 0 ? 0.5 : 0.7,
                maxTokens: 8192,
                byokConnection,
              });
              fullContent = chatResult.data.content || '';
            }

            const content = fullContent;
            console.log('[Film Script Agent] LLM-1 response length:', content.length);
            console.log('[Film Script Agent] LLM-1 first 500:', content.substring(0, 500));
            console.log('[Film Script Agent] LLM-1 last 300:', content.substring(content.length - 300));

            sendSSE(encoder, controller, 'progress', {
              stage: 'parsing',
              progress: 50,
              message: 'AI编剧完成剧本创作，正在解析...',
            });

            // 解析第一次LLM的结果
            const parsed = parseFilmScriptJson(content);

            // 构建基础 FilmScript
            const script: FilmScript = {
              title: (parsed.title as string) || '未命名作品',
              coreTheme: (parsed.coreTheme as string) || '',
              style: (parsed.style as string) || body.style || '写实电影感',
              totalDuration: (parsed.totalDuration as number) || targetDuration,
              targetPlatform: body.platform || '通用',
              colorNarrativeLine: (parsed.colorNarrativeLine as string) || '',
              emotionCurve: (parsed.emotionCurve as string) || '',
              characters: [],
              scenes: [],
              shots: [],
              narrationScript: (parsed.narrationScript as string) || '',
              bgmSuggestion: (parsed.bgmSuggestion as string) || '',
              subtitleSuggestion: (parsed.subtitleSuggestion as string) || '',
              aspectRatio: '16:9',
              screenplay: Array.isArray(parsed.screenplay) ? parsed.screenplay as ScreenplayScene[] : [],
            };

            // 从 parsed 提取 characters（从 shots 中推断）
            const parsedShots = Array.isArray(parsed.shots) ? parsed.shots : [];
            const parsedCharacters = Array.isArray(parsed.characters) ? parsed.characters : [];
            const parsedScenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];

            // 规范化 shots
            script.shots = parsedShots.map((shot: Record<string, unknown>, index: number) => ({
              id: (shot.id as string) || `shot_${shot.sceneNumber || 1}_${index + 1}`,
              sceneId: (shot.sceneId as string) || `scene_${shot.sceneNumber || 1}`,
              sceneNumber: (shot.sceneNumber as number) || 1,
              shotNumber: (shot.shotNumber as number) || index + 1,
              shotType: (shot.shotType as string) || '中景',
              cameraAngle: (shot.cameraAngle as string) || '平视',
              cameraMovement: (shot.cameraMovement as string) || '固定',
              content: (shot.description as string) || (shot.content as string) || '',
              contentEn: (shot.contentEn as string) || '',
              dialogue: (shot.dialogue as string) || '',
              narration: (shot.narrationDirection as string) || (shot.narration as string) || '',
              action: (shot.action as string) || '',
              soundEffect: (shot.soundEffect as string) || (shot.soundDesign as string) || '',
              duration: (shot.duration as number) || 5,
              characters: Array.isArray(shot.characters) ? shot.characters as string[] : [],
              status: 'pending' as const,
              emotionTag: (shot.emotionTag as string) || '',
              emotionIntensity: (shot.emotionIntensity as number) || 5,
              colorNarrative: (shot.colorNarrative as string) || '',
              soundDesign: (shot.soundDesign as string) || '',
              bgmChange: (shot.bgmCue as string) || (shot.bgmChange as string) || '',
            }));

            // 规范化 characters
            script.characters = parsedCharacters.map((ch: Record<string, unknown>, index: number) => ({
              id: (ch.id as string) || `char_${index + 1}`,
              name: (ch.name as string) || `角色${index + 1}`,
              age: (ch.age as string) || '未知',
              gender: ((ch.gender === '男' || ch.gender === '女') ? ch.gender : '不限') as FilmCharacter['gender'],
              appearance: (ch.appearance as string) || '待补充',
              personality: (ch.personality as string) || '待补充',
              seed: (ch.seed as number) || Math.floor(Math.random() * 1000000),
              outfit: (ch.outfit as string) || '',
              characterArc: (ch.characterArc as string) || (ch.arc as string) || '',
              motivation: (ch.motivation as string) || '',
              relationships: (ch.relationships as Record<string, string>) || {},
              signatureDetail: (ch.signatureDetail as string) || '',
            }));

            // 规范化 scenes
            script.scenes = parsedScenes.map((sc: Record<string, unknown>, index: number) => ({
              id: (sc.id as string) || `scene_${index + 1}`,
              sceneNumber: (sc.sceneNumber as number) || index + 1,
              name: (sc.name as string) || `场景${index + 1}`,
              location: (sc.location as string) || '待补充',
              timeOfDay: ((['日', '夜', '晨', '黄昏'].includes(sc.timeOfDay as string) ? sc.timeOfDay : '日') as FilmScene['timeOfDay']),
              indoor: (sc.indoor as boolean) ?? false,
              description: (sc.description as string) || '待补充',
              mood: (sc.mood as string) || '中性',
              colorPalette: (sc.colorPalette as string) || '',
            }));

            // 如果 shots 为空，尝试补充
            if (script.shots.length === 0 && script.scenes.length > 0) {
              sendSSE(encoder, controller, 'progress', {
                stage: 'supplementing_shots',
                progress: 55,
                message: '分镜为空，正在自动补充...',
              });
              script.shots = generateShotsFromScenes(script.scenes, script.characters, targetDuration);
            }

            // =============================================
            // 第二次LLM调用：生成 characterCards + sceneCards（导演方案）
            // =============================================
            sendSSE(encoder, controller, 'progress', {
              stage: 'director_plan',
              progress: 65,
              message: '正在生成导演方案（角色卡+场景卡）...',
            });

            try {
              const directorMessages: Array<{ role: 'system' | 'user'; content: string }> = [
                { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
                { role: 'user', content: buildDirectorPrompt(script) },
              ];

              // 流式生成导演方案
              let directorFullContent = '';
              try {
                if (byokConnection) {
                  const directorResult = await aiService.chat({
                    messages: directorMessages,
                    temperature: 0.6,
                    maxTokens: 4096,
                    byokConnection,
                  });
                  directorFullContent = directorResult.data.content || '';
                  sendSSE(encoder, controller, 'director_text', { chunk: directorFullContent });
                } else {
                  const directorStream = aiService.chatStream({
                    messages: directorMessages,
                    temperature: 0.6,
                    maxTokens: 4096,
                  });

                  const dReader = directorStream.getReader();
                  const dDecoder = new TextDecoder();
                  let dBuffer = '';

                  while (true) {
                    const { done, value } = await dReader.read();
                    if (done) break;

                    dBuffer += dDecoder.decode(value, { stream: true });
                    const lines = dBuffer.split('\n');
                    dBuffer = lines.pop() || '';

                    for (const line of lines) {
                      const trimmed = line.trim();
                      if (!trimmed || !trimmed.startsWith('data:')) continue;

                      const dataStr = trimmed.startsWith('data: ')
                        ? trimmed.slice(6)
                        : trimmed.slice(5);

                      if (dataStr === '[DONE]') continue;

                      try {
                        const data = JSON.parse(dataStr);
                        const chunk = data.content || data.text || data.chunk || '';
                        if (chunk) {
                          directorFullContent += chunk;
                          sendSSE(encoder, controller, 'director_text', { chunk });
                        }
                      } catch { /* ignore */ }
                    }
                  }
                  // 处理剩余buffer
                  if (dBuffer.trim() && dBuffer.trim().startsWith('data:')) {
                    const dataStr = dBuffer.trim().startsWith('data: ')
                      ? dBuffer.trim().slice(6)
                      : dBuffer.trim().slice(5);
                    if (dataStr !== '[DONE]') {
                      try {
                        const data = JSON.parse(dataStr);
                        const chunk = data.content || data.text || data.chunk || '';
                        if (chunk) {
                          directorFullContent += chunk;
                          sendSSE(encoder, controller, 'director_text', { chunk });
                        }
                      } catch { /* ignore */ }
                    }
                  }
                }
              } catch (directorStreamErr) {
                console.warn('[Film Script Agent] Director stream failed, falling back:', (directorStreamErr as Error).message);
                const directorResult = await aiService.chat({
                  messages: directorMessages,
                  temperature: 0.6,
                  maxTokens: 4096,
                  byokConnection,
                });
                directorFullContent = directorResult.data.content || '';
              }

              const directorContent = directorFullContent;
              console.log('[Film Script Agent] LLM-2 (director) response length:', directorContent.length);

              const directorParsed = parseFilmScriptJson(directorContent);

              // 构建导演方案
              const charCards = Array.isArray(directorParsed.characterCards) ? directorParsed.characterCards : [];
              const sceneCards = Array.isArray(directorParsed.sceneCards) ? directorParsed.sceneCards : [];
              const propCards = Array.isArray(directorParsed.propCards) ? directorParsed.propCards : [];

              script.directorPlan = {
                characterCards: charCards.map((c: Record<string, unknown>) => ({
                  id: (c.id as string) || `char_${(c.name as string) || '1'}`,
                  name: (c.name as string) || '角色',
                  age: (c.age as string) || '未知',
                  gender: (c.gender as string) || '不限',
                  mbti: (c.mbti as string) || '',
                  arc: (c.arc as string) || '',
                  motivation: (c.motivation as string) || '',
                  relationships: (c.relationships as Record<string, string>) || {},
                  signatureDetail: (c.signatureDetail as string) || '',
                  appearance: (c.appearance as string) || '待补充',
                  outfit: (c.outfit as string) || '待补充',
                  consistencyRules: {
                    mustInclude: Array.isArray((c.consistencyRules as Record<string, unknown>)?.mustInclude)
                      ? ((c.consistencyRules as Record<string, unknown>).mustInclude as string[])
                      : [],
                    mustExclude: Array.isArray((c.consistencyRules as Record<string, unknown>)?.mustExclude)
                      ? ((c.consistencyRules as Record<string, unknown>).mustExclude as string[])
                      : [],
                  },
                })),
                sceneCards: sceneCards.map((s: Record<string, unknown>) => ({
                  id: (s.id as string) || `scene_${s.sceneNumber || 1}`,
                  sceneNumber: (s.sceneNumber as number) || 1,
                  name: (s.name as string) || `场景${s.sceneNumber || 1}`,
                  location: (s.location as string) || '待补充',
                  timeOfDay: (s.timeOfDay as string) || '日',
                  interior: (s.interior as boolean) ?? false,
                  visualDescription: (s.visualDescription as string) || (s.description as string) || '',
                  fiveSenses: (s.fiveSenses as DirectorSceneCard['fiveSenses']) || {
                    sight: '', hearing: '', touch: '', smell: '', taste: '',
                  },
                  symbolism: (s.symbolism as string) || '',
                  mood: (s.mood as string) || '中性',
                  keyProps: (s.keyProps as string) || '',
                  colorPalette: (s.colorPalette as string) || '',
                })),
                propCards: propCards.map((p: Record<string, unknown>) => ({
                  id: (p.id as string) || `prop_${p.name || '1'}`,
                  name: (p.name as string) || '道具',
                  category: (p.category as string) || '其他',
                  material: (p.material as string) || '',
                  color: (p.color as string) || '',
                  size: (p.size as string) || '',
                  significance: (p.significance as string) || '',
                  closeup: (p.closeup as boolean) ?? false,
                  appearance: (p.appearance as string) || '',
                  propEn: (p.propEn as string) || '',
                })),
                consistencyNotes: (directorParsed.consistencyConstraints as string) || '',
              };

              // 如果 directorPlan 提供了角色，用 characterCards 增强/补充 characters
              if (script.directorPlan.characterCards.length > 0) {
                // 构建名字/ID映射表，用于将 shots 中的角色引用统一为真实名字
                const charIdToName = new Map<string, string>();
                script.directorPlan.characterCards.forEach(cc => {
                  if (cc.id) charIdToName.set(cc.id, cc.name);
                  charIdToName.set(cc.name, cc.name);
                });

                // 用 characterCards 全量替换 characters（characterCards 信息更完整）
                script.characters = script.directorPlan.characterCards.map((c, i) => ({
                  id: c.id || `char_${i + 1}`,
                  name: c.name,
                  age: c.age,
                  gender: (c.gender === '男' || c.gender === '女' ? c.gender : '不限') as FilmCharacter['gender'],
                  appearance: c.appearance,
                  personality: '待补充',
                  seed: Math.floor(Math.random() * 1000000),
                  outfit: c.outfit,
                  characterArc: c.arc,
                  motivation: c.motivation,
                  relationships: c.relationships,
                  signatureDetail: c.signatureDetail,
                }));

                // 统一 shots 中的 characters 引用为真实名字
                for (const shot of script.shots) {
                  if (Array.isArray(shot.characters)) {
                    shot.characters = shot.characters.map(chId => {
                      // 1. 精确匹配
                      const mapped = charIdToName.get(chId);
                      if (mapped) return mapped;
                      // 2. 去掉 char_ 前缀后匹配
                      if (chId.startsWith('char_')) {
                        const stripped = chId.replace('char_', '');
                        const mappedStripped = charIdToName.get(stripped);
                        if (mappedStripped) return mappedStripped;
                        // 3. 如果 stripped 是数字（如 char_1 -> "1"），尝试按索引匹配
                        const idx = parseInt(stripped, 10);
                        if (!isNaN(idx) && idx >= 1 && script.directorPlan && idx <= script.directorPlan.characterCards.length) {
                          return script.directorPlan.characterCards[idx - 1].name;
                        }
                      }
                      return chId;
                    });
                  }
                }
              }

              // 如果 directorPlan 提供了场景，用 sceneCards 替换 scenes（sceneCards 信息更完整）
              if (script.directorPlan.sceneCards.length > 0) {
                script.scenes = script.directorPlan.sceneCards.map(s => ({
                  id: s.id || `scene_${s.sceneNumber}`,
                  sceneNumber: s.sceneNumber,
                  name: s.name,
                  location: s.location,
                  timeOfDay: (['日', '夜', '晨', '黄昏'].includes(s.timeOfDay) ? s.timeOfDay : '日') as FilmScene['timeOfDay'],
                  indoor: s.interior,
                  description: s.visualDescription || s.mood,
                  mood: s.mood,
                  colorPalette: s.colorPalette,
                }));
              }

              console.log('[Film Script Agent] Director plan: charCards=', script.directorPlan.characterCards.length, 'sceneCards=', script.directorPlan.sceneCards.length, 'propCards=', script.directorPlan.propCards?.length || 0);
            } catch (directorErr) {
              console.error('[Film Script Agent] Director plan generation failed:', directorErr);
              // 导演方案生成失败不阻断流程，fillMissingFields 会兜底
            }

            // 补充缺失字段
            fillMissingFilmScriptFields(script, targetDuration);

            // 计算实际总时长
            let actualDuration = script.shots.reduce((sum, s) => sum + (s.duration || 5), 0);
            if (actualDuration > 0 && actualDuration < targetDuration * 0.8) {
              const scale = targetDuration / actualDuration;
              script.shots.forEach(s => {
                s.duration = Math.round((s.duration || 5) * scale);
              });
              actualDuration = script.shots.reduce((sum, s) => sum + (s.duration || 5), 0);
            }
            script.totalDuration = actualDuration || targetDuration;

            const responseResult: CreateScriptResponse & { success: true; provider?: string; degraded?: boolean; attempt?: number } = {
              success: true,
              script,
              message: `剧本《${script.title}》生成完成，共${script.scenes.length}个场景、${script.shots.length}个分镜、${script.characters.length}个角色，预估时长${actualDuration}秒。`,
              provider: undefined,
              degraded: false,
              attempt: attempt > 0 ? attempt : undefined,
            };

            sendSSE(encoder, controller, 'progress', {
              stage: 'completed',
              progress: 100,
              message: responseResult.message,
            });

            sendSSE(encoder, controller, 'result', responseResult);
            controller.close();
            return;
          } catch (parseErr) {
            lastError = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
            console.error(`[Film Script Agent] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);

            if (attempt < MAX_RETRIES) {
              sendSSE(encoder, controller, 'progress', {
                stage: 'retrying',
                progress: 15 + attempt * 10,
                message: `第${attempt + 1}次尝试失败，正在重试...`,
                error: lastError.message,
              });
              await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
          }
        }

        // 所有重试失败
        const errMsg = lastError?.message || '剧本生成失败';
        sendSSE(encoder, controller, 'error', { error: `剧本生成失败: ${errMsg}` });
        controller.close();
      } catch (error) {
        console.error('[Film Script Agent] Fatal error:', error);
        const message = error instanceof DegradeError
          ? error.toUserMessage()
          : (error instanceof Error ? error.message : '未知错误');
        sendSSE(encoder, controller, 'error', { error: `剧本生成失败: ${message}` });
        controller.close();
      }
    },
  });

}
