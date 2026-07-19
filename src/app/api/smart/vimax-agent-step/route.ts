import { NextRequest, NextResponse } from 'next/server';
import { mergeVideosWithLocalFfmpeg } from '@/lib/local-video-merge';
import { extractLastFrameForHandoff } from '@/lib/video-frame-extraction';
import { resolvePaperHostCreationOwnerFromRequest } from '@/lib/task-access';
import { createTask, getTaskForOwner, updateTask, type TaskOwner } from '@/lib/task-manager';
import type { VimaxAgentPlan, VimaxAgentReferenceAsset, VimaxAgentStepBody } from '@/lib/skills/vimax-short-drama/vimax-agent-contract';
import { VIMAX_PLAN_MODEL } from '@/lib/skills/vimax-short-drama/vimax-generation-preferences';
import { buildProductionBackedVimaxPlan } from '@/lib/skills/vimax-short-drama/vimax-plan-artifacts';
import { persistVimaxPlanTask } from '@/lib/skills/vimax-short-drama/vimax-plan-task';
import { resolveCanonicalVimaxStageInput } from '@/lib/skills/vimax-short-drama/vimax-canonical-stage-input';
import { assertVimaxProductionPlanForPhase, buildVimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';
import { resolveVimaxSkillRuntimeBinding } from '@/lib/skills/vimax-short-drama/vimax-skill-runtime-binding';
import {
  resolveVimaxSkillPresetForRuntime,
  type VimaxSkillPreset,
} from '@/lib/skills/vimax-short-drama/vimax-skill-presets';
import {
  chatWithBYOK,
  extractBYOKConnection,
  extractBYOKVideoConnection,
  type BYOKConnection,
} from '@/lib/byok-provider';
import { callHappyHorseVimaxVideo, recoverHappyHorseVimaxVideo } from '@/lib/skills/vimax-short-drama/happyhorse-vimax-video';
import { callVimaxReferenceImages } from '@/lib/skills/vimax-short-drama/vimax-reference-assets';
import {
  buildVimaxContinuityContract,
  buildVimaxFrameProviderPrompt,
  resolveVimaxProviderHandoffMode,
  type VimaxContinuityContract,
} from '@/lib/skills/vimax-short-drama/vimax-continuity-contract';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getArkConfig() {
  // Text model uses the plan/v3 endpoint with the agent key.
  const apiKey = process.env.HUIYING_AGENTPLAN_ARK_API_KEY_SECONDARY || process.env.HUIYING_AGENTPLAN_ARK_API_KEY_PRIMARY || process.env.HUIYING_REAL_ARK_API_KEY || process.env.ARK_API_KEY;
  // minimax-m3 is an AgentPlan model and is ONLY valid on the /api/plan/v3 endpoint.
  // OS-level env vars (ARK_API_BASE / HUIYING_REAL_ARK_API_BASE) may point at the
  // standard /api/v3 endpoint and override .env.local, which yields a 401. Force the
  // plan endpoint unless the configured base already targets /plan/.
  const rawBase = (process.env.HUIYING_REAL_ARK_API_BASE || process.env.ARK_API_BASE || '').replace(/\/$/, '');
  const apiBase = rawBase.includes('/plan/') ? rawBase : 'https://ark.cn-beijing.volces.com/api/plan/v3';
  const textModel = VIMAX_PLAN_MODEL;

  // Image/video models use the standard v3 endpoint with a separate key
  const imageApiKey = process.env.ARK_IMAGE_API_KEY || process.env.HUIYING_REAL_ARK_API_KEY || process.env.ARK_API_KEY;
  const imageApiBase = 'https://ark.cn-beijing.volces.com/api/v3';
  // UI alias doubao-seedream-5.0-lite maps to the callable Ark model id below
  // (Ark only accepts the hyphenated, date-suffixed endpoint id, not the friendly name).
  const imageModel = process.env.ARK_IMAGE_MODEL || 'doubao-seedream-5-0-260128';
  // UI alias doubao-seedance-1.5-pro maps to the callable Ark video model id below.
  const videoModel = process.env.ARK_VIDEO_MODEL || 'doubao-seedance-1-5-pro-251215';

  const selectorModel = process.env.HUIYING_VIMAX_SELECTOR_MODEL || process.env.ARK_VISION_MODEL;
  return { apiKey, apiBase, textModel, selectorModel, imageApiKey, imageApiBase, imageModel, videoModel };
}

function buildPlanSystemPrompt(preset: VimaxSkillPreset) {
  return [
  `你是创作工作台的“${preset.name}”制作 Agent，只输出 JSON，不要任何解释、验收话术、QA 语言或兜底路径。`,
  `当前预设目标：${preset.description}。场景类型=${preset.sceneType}；视觉风格=${preset.style}。`,
  '严格按照下面的 schema 输出，字段名和类型都不能改，assets 和 shots 必须是数组，不能写成对象：',
  '{',
  '  "title": "作品标题，string",',
  '  "summary": "一句话创作梗概，string",',
  '  "assets": [',
  '    { "kind": "character|scene|prop|reference", "label": "资产名称 string", "prompt": "用于图像模型的画面描述 string" }',
  '  ],',
  '  "shots": [',
  '    { "index": 1, "title": "镜头标题 string", "duration": 6, "camera": "运镜描述 string", "prompt": "画面内容描述 string" }',
  '  ],',
  '  "nextAction": "下一步建议 string"',
  '}',
  'duration 必须是数字（秒），不能是 "0-5s" 这种字符串区间。',
  preset.id === 'storyboard-director'
    ? 'assets 给 3-6 个（角色/场景/道具/参考帧），shots 给 4-8 个；本预设只交付分镜与参考素材，不进入视频生成。'
    : 'assets 给 3-6 个（角色/场景/道具/参考帧），shots 给 4-8 个，全部用于后续视频生成。',
  '输出硬性要求：只输出一个 JSON 对象，不要 markdown 代码块、不要注释、不要前后多余文字；',
  '所有字符串值里的双引号和换行必须转义（\\" 和 \\n）；对象与数组元素之间必须有逗号，结尾不要多余逗号；务必输出完整闭合的 JSON。',
].join('\n');
}

function buildPlanMessages(prompt: string, preset: VimaxSkillPreset) {
  return [
    { role: 'system', content: buildPlanSystemPrompt(preset) },
    { role: 'user', content: `请严格按 brief 指定的总时长、clip 数量和每段时长生成“${preset.name}”制作计划；如果 brief 写了 30 秒、6 个 5 秒 clip，就必须返回 6 个 duration=5 的 shots。只返回符合上面 schema 的 JSON：\n${prompt}` },
  ];
}

function assertPrompt(prompt: unknown): string {
  const text = typeof prompt === 'string' ? prompt.trim() : '';
  if (text.length < 4) {
    throw new Error('请先输入明确的创作 brief，至少包含主体、目标或场景。');
  }
  return text;
}

type LooseRecord = Record<string, unknown>;

function asNum(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asStr(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

const ALLOWED_ASSET_KINDS = ['script', 'character', 'scene', 'prop', 'shot', 'reference'];

/**
 * 从数组字段里抽出「已完整闭合」的对象，忽略被截断的尾部对象。
 * 用字符串/转义状态机做括号配对，避免字符串里的引号/括号干扰。
 */
function extractCompleteObjects(raw: string, key: string): LooseRecord[] {
  const marker = new RegExp(`"${key}"\\s*:\\s*\\[`).exec(raw);
  if (!marker) return [];
  let i = marker.index + marker[0].length;
  const objects: LooseRecord[] = [];
  while (i < raw.length) {
    while (i < raw.length && /[\s,]/.test(raw[i])) i++;
    if (i >= raw.length || raw[i] === ']') break;
    if (raw[i] !== '{') break;
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    const start = i;
    for (; i < raw.length; i++) {
      const c = raw[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) { end = i; i++; break; }
      }
    }
    if (end < 0) break;
    try {
      objects.push(JSON.parse(raw.slice(start, end + 1)) as LooseRecord);
    } catch {
      break;
    }
  }
  return objects;
}

function normalizePlan(parsed: LooseRecord): VimaxAgentPlan {
  const title = asStr(parsed.title).trim();
  const rawShots = Array.isArray(parsed.shots) ? (parsed.shots as LooseRecord[]) : [];
  if (!title || rawShots.length === 0) {
    throw new Error('真实模型返回缺少 title 或 shots。');
  }
  const rawAssets = Array.isArray(parsed.assets) ? (parsed.assets as LooseRecord[]) : [];
  return {
    title,
    summary: asStr(parsed.summary),
    assets: rawAssets.slice(0, 12).map(asset => {
      const kind = asStr(asset.kind);
      return {
        kind: (ALLOWED_ASSET_KINDS.includes(kind) ? kind : 'reference') as VimaxAgentPlan['assets'][number]['kind'],
        label: asStr(asset.label, '参考素材'),
        prompt: asStr(asset.prompt),
      };
    }),
    shots: rawShots.slice(0, 8).map((shot, index) => ({
      index: asNum(shot.index, index + 1),
      title: asStr(shot.title, `镜头 ${index + 1}`),
      duration: asNum(shot.duration, 6),
      camera: asStr(shot.camera, '固定镜头'),
      prompt: asStr(shot.prompt),
    })),
    nextAction: asStr(parsed.nextAction, '确认分镜后进入参考素材生成。'),
  };
}

/**
 * 鲁棒解析真实模型输出：严格解析 → 轻量修复（去尾逗号 / 补对象间逗号）→ 字段级容错抽取。
 * 最后一级用括号配对扫描已闭合的镜头对象，即便尾部被截断也能稳定闭环 30s/多镜头分镜。
 * 全程基于模型真实输出，不注入任何假数据。
 */
function extractJsonObject(text: string): VimaxAgentPlan {
  const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  const candidate = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;

  // 1) 严格解析
  try {
    return normalizePlan(JSON.parse(candidate) as LooseRecord);
  } catch { /* 进入修复 */ }

  // 2) 轻量修复：去掉数组/对象结尾多余逗号，补上相邻对象之间漏写的逗号
  try {
    const repaired = candidate
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/}\s*{/g, '},{')
      .replace(/]\s*\[/g, '],[');
    return normalizePlan(JSON.parse(repaired) as LooseRecord);
  } catch { /* 进入字段级抽取 */ }

  // 3) 字段级容错抽取：标题/梗概用正则，assets/shots 用括号配对扫描，丢弃被截断的尾部对象
  const decode = (value: string) => value.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  const titleMatch = /"title"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(clean);
  const summaryMatch = /"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(clean);
  const nextMatch = /"nextAction"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(clean);
  const assets = extractCompleteObjects(clean, 'assets');
  const shots = extractCompleteObjects(clean, 'shots');
  if (!titleMatch || shots.length === 0) {
    throw new Error('真实模型未返回可解析的结构化创作计划（标题或分镜缺失）。');
  }
  return normalizePlan({
    title: decode(titleMatch[1]),
    summary: summaryMatch ? decode(summaryMatch[1]) : '',
    assets,
    shots,
    nextAction: nextMatch ? decode(nextMatch[1]) : undefined,
  });
}

async function callArkText(prompt: string, preset: VimaxSkillPreset, modelOverride?: string, connection?: BYOKConnection): Promise<{ model: string; plan: VimaxAgentPlan; rawText: string }> {
  const { apiKey, apiBase, textModel } = getArkConfig();
  const model = connection?.model || (modelOverride && modelOverride.trim()) || textModel;
  if (connection) {
    const result = await chatWithBYOK(connection, {
      model,
      temperature: 0.2,
      maxTokens: 4000,
      messages: buildPlanMessages(prompt, preset) as Array<{ role: 'system' | 'user'; content: string }>,
    });
    return { model: result.model, plan: extractJsonObject(result.content), rawText: result.content };
  }
  if (!apiKey) {
    throw new Error('缺少 ARK_API_KEY 或 HUIYING_REAL_ARK_API_KEY，无法进入真实 AgentPlan 阶段。');
  }

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 4000,
      messages: buildPlanMessages(prompt, preset),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error?.message === 'string' ? data.error.message : response.statusText;
    throw new Error(`Ark AgentPlan 调用失败：${message}`);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Ark AgentPlan 未返回文本内容。');
  }
  if (process.env.VIMAX_DEBUG_RAW === '1') {
    console.error('[vimax-plan] finish_reason=', data?.choices?.[0]?.finish_reason, ' rawText=', text.slice(0, 2500));
  }
  return { model, plan: extractJsonObject(text), rawText: text };
}

function buildVimaxPlanEnvelope(
  prompt: string,
  model: string,
  basePlan: VimaxAgentPlan,
  body: VimaxAgentStepBody,
  taskId: string,
  planConnection?: BYOKConnection,
  videoConnection?: BYOKConnection,
) {
  const { plan, productionProject, assemblyPlan } = buildProductionBackedVimaxPlan(prompt, basePlan, body, taskId);
  const config = getArkConfig();
  const workflow = resolveVimaxSkillRuntimeBinding({ skillId: body.skillId });
  const planModel = planConnection?.model || model;
  const imageModel = planConnection?.imageModel || config.imageModel;
  const videoModel = videoConnection?.videoModel || config.videoModel;
  const continuity = buildVimaxContinuityContract({
    productionProject,
    assemblyPlan,
    imageModel: config.imageModel,
    providerHandoff: resolveVimaxProviderHandoffMode({
      provider: videoConnection?.provider || 'ark-video-v3',
      model: videoModel,
    }),
  });
  const productionPlan = buildVimaxProductionPlan({
    title: plan.title,
    ratio: body.ratio || '16:9',
    resolution: body.resolution || '720p',
    planModel,
    imageModel,
    videoModel,
    providerReadiness: {
      plan: Boolean(planConnection?.apiKey || config.apiKey),
      referenceAssets: Boolean((planConnection?.apiKey && planConnection.imageModel) || config.imageApiKey),
      video: Boolean(videoConnection?.videoModel && videoConnection.apiKey) || Boolean(config.imageApiKey),
    },
    referenceAssetsRequired: videoConnection?.provider !== 'happyhorse-dashscope',
    assets: plan.assets,
    shots: plan.shots,
    workflow,
    continuity,
  });
  return { plan, productionPlan, productionProject, assemblyPlan };
}

function createPersistedPlanEnvelope(
  owner: TaskOwner,
  prompt: string,
  model: string,
  basePlan: VimaxAgentPlan,
  body: VimaxAgentStepBody,
  planConnection?: BYOKConnection,
  videoConnection?: BYOKConnection,
) {
  const taskId = createTask('storyboard', {
    prompt,
    duration: `${body.duration || 30}s`,
    ratio: body.ratio || '16:9',
    resolution: body.resolution || '720p',
    style: body.style || '电影感短剧',
    sceneType: body.sceneType || 'drama',
    workflow: 'vimax-agent',
    skillId: body.skillId,
  }, owner);
  const { plan, productionPlan, productionProject, assemblyPlan } = buildVimaxPlanEnvelope(
    prompt,
    model,
    basePlan,
    body,
    taskId,
    planConnection,
    videoConnection,
  );
  persistVimaxPlanTask({
    taskId,
    prompt,
    plan,
    productionPlan,
    productionProject,
    assemblyPlan,
  });
  return { taskId, plan, productionPlan };
}

// 流式 plan：原生 fetch + SSE，逐 token 把 delta 透传给前端
async function callArkTextStream(prompt: string, preset: VimaxSkillPreset, modelOverride: string | undefined, writer: (delta: string) => void, connection?: BYOKConnection): Promise<{ model: string; plan: VimaxAgentPlan; rawText: string }> {
  const { apiKey, apiBase, textModel } = getArkConfig();
  const model = connection?.model || (modelOverride && modelOverride.trim()) || textModel;
  const resolvedApiKey = connection?.apiKey || apiKey;
  const resolvedApiBase = (connection?.apiBase || apiBase).replace(/\/+$/, '');
  if (!resolvedApiKey) throw new Error('缺少 API Key，无法进入 AgentPlan 阶段。');

  const response = await fetch(`${resolvedApiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resolvedApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 4000,
      stream: true,
      messages: buildPlanMessages(prompt, preset),
    }),
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    const message = typeof data?.error?.message === 'string' ? data.error.message : response.statusText;
    throw new Error(`Ark 调用失败：${message}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let rawText = '';
  let streamReadError: unknown;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) {
            rawText += delta;
            writer(delta);
          }
        } catch {
          // 单条 SSE 分片可能不完整，忽略后等待后续拼接
        }
      }
    }
  } catch (error) {
    streamReadError = error;
  }

  if (!rawText.trim()) {
    if (streamReadError) throw streamReadError;
    throw new Error('Ark 未返回文本内容。');
  }
  try {
    return { model, plan: extractJsonObject(rawText), rawText };
  } catch (error) {
    if (streamReadError) throw streamReadError;
    throw error;
  }
}


function clampVideoDuration(value: unknown): number {
  const seconds = Math.floor(Number(value) || 5);
  // Seedance duration 取值范围 2-12 秒。
  return Math.max(2, Math.min(12, seconds));
}

// 真实 Seedance 视频任务：按分镜生成多个片段，再用本地 FFmpeg 合成完整短剧。
// 这样视频阶段与“30 秒 / 6 镜头”验收目标一致，不再只返回首镜样片。
interface SeedanceShotSegment {
  shotIndex: number;
  shotTitle: string;
  duration: number;
  taskId: string;
  videoUrl: string;
  lastFrameUrl?: string;
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//.test(value);
}

function referenceForShot(assets: VimaxAgentReferenceAsset[], shot: VimaxAgentPlan['shots'][number], index: number) {
  const validAssets = assets.filter(asset => isHttpUrl(asset.url));
  return validAssets.find(asset => asset.shotIndex === shot.index)
    || validAssets[index]
    || validAssets[0];
}

async function submitSeedanceShotTask(
  plan: VimaxAgentPlan,
  shot: VimaxAgentPlan['shots'][number],
  index: number,
  assets: VimaxAgentReferenceAsset[],
  preset: VimaxSkillPreset,
  continuity: VimaxContinuityContract,
  opts: { ratio?: string; resolution?: string; previousLastFrameUrl?: string },
) {
  const { imageApiKey, imageApiBase, videoModel } = getArkConfig();
  if (!imageApiKey) {
    throw new Error('缺少视频模型 API Key，无法进入 Seedance 视频生成阶段。');
  }

  const promptText = buildVimaxFrameProviderPrompt({
    basePrompt: shot.prompt || `${shot.title}，${plan.summary || plan.title}`,
    camera: shot.camera,
    presetName: preset.name,
    presetDescription: preset.description,
    presetStyle: preset.style,
    continuity,
    shotIndex: index,
    handoffFromPrevious: Boolean(opts.previousLastFrameUrl),
  });
  if (!promptText) {
    throw new Error(`缺少可用于视频生成的镜头提示词：Clip ${shot.index}`);
  }

  const frame = referenceForShot(assets, shot, index);
  const firstFrameUrl = opts.previousLastFrameUrl || frame?.url;
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: promptText }];
  if (firstFrameUrl) {
    content.push({ type: 'image_url', image_url: { url: firstFrameUrl }, role: 'first_frame' });
  }

  const duration = clampVideoDuration(shot.duration);
  const submitResponse = await fetch(`${imageApiBase}/contents/generations/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${imageApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: videoModel,
      content,
      ratio: opts.ratio || '16:9',
      resolution: opts.resolution || '720p',
      duration,
      watermark: false,
      generate_audio: false,
    }),
  });
  const submitData = await submitResponse.json().catch(() => ({}));
  if (!submitResponse.ok) {
    const message = typeof submitData?.error?.message === 'string'
      ? submitData.error.message
      : (submitData?.msg || submitResponse.statusText);
    throw new Error(`Seedance 视频任务创建失败（Clip ${shot.index}）：${message}`);
  }
  const taskId: string | undefined = submitData?.id || submitData?.data?.id;
  if (!taskId) {
    throw new Error(`Seedance 接口没有返回视频任务 ID（Clip ${shot.index}）。`);
  }
  return {
    model: videoModel,
    taskId,
    shotIndex: shot.index,
    shotTitle: shot.title || `Clip ${shot.index}`,
    duration,
  };
}

async function ensureSeedanceLastFrame(segment: SeedanceShotSegment): Promise<SeedanceShotSegment> {
  if (segment.lastFrameUrl) return segment;
  const extracted = await extractLastFrameForHandoff(segment.videoUrl);
  if (!extracted.lastFrameUrl) return segment;
  return {
    ...segment,
    lastFrameUrl: extracted.lastFrameUrl,
  };
}

async function pollSeedanceShotTask(task: { taskId: string; shotIndex: number; shotTitle: string; duration: number }): Promise<SeedanceShotSegment> {
  const { imageApiKey, imageApiBase } = getArkConfig();
  if (!imageApiKey) {
    throw new Error('缺少视频模型 API Key，无法查询 Seedance 视频任务。');
  }
  const maxAttempts = 96;
  const delayMs = 5000;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    const pollResponse = await fetch(`${imageApiBase}/contents/generations/tasks/${encodeURIComponent(task.taskId)}`, {
      headers: { Authorization: `Bearer ${imageApiKey}` },
    });
    const pollData = await pollResponse.json().catch(() => ({}));
    if (!pollResponse.ok) {
      const message = typeof pollData?.error?.message === 'string' ? pollData.error.message : (pollData?.msg || pollResponse.statusText);
      throw new Error(`Seedance 视频任务查询失败（Clip ${task.shotIndex}）：${message}`);
    }
    const item = pollData?.data && typeof pollData.data === 'object' ? pollData.data : pollData;
    const status: string | undefined = item?.status;
    if (status === 'succeeded') {
      const videoUrl: string | undefined = item?.content?.video_url;
      if (!videoUrl) {
        throw new Error(`Seedance 任务成功但没有返回视频 URL（Clip ${task.shotIndex}）。`);
      }
      return {
        shotIndex: task.shotIndex,
        shotTitle: task.shotTitle,
        duration: task.duration,
        taskId: task.taskId,
        videoUrl,
        lastFrameUrl: typeof item?.content?.last_frame_url === 'string' ? item.content.last_frame_url : undefined,
      };
    }
    if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      const message = typeof item?.error?.message === 'string' ? item.error.message : status;
      throw new Error(`Seedance 视频生成${status === 'expired' ? '超时' : '失败'}（Clip ${task.shotIndex}）：${message}`);
    }
  }
  throw new Error(`Seedance 视频生成超时（Clip ${task.shotIndex}，约 8 分钟未完成）。`);
}

async function callSeedanceVideo(
  plan: VimaxAgentPlan,
  assets: VimaxAgentReferenceAsset[],
  preset: VimaxSkillPreset,
  continuity: VimaxContinuityContract,
  opts: { ratio?: string; resolution?: string },
) {
  const { videoModel } = getArkConfig();
  const shots = (Array.isArray(plan.shots) ? plan.shots : [])
    .filter(shot => shot && (shot.prompt || shot.title))
    .slice(0, 8);
  if (!shots.length) {
    throw new Error('缺少可用于视频生成的分镜。');
  }

  const segments: SeedanceShotSegment[] = [];
  let previousLastFrameUrl: string | undefined;
  for (let index = 0; index < shots.length; index += 1) {
    const task = await submitSeedanceShotTask(plan, shots[index], index, assets, preset, continuity, {
      ...opts,
      previousLastFrameUrl,
    });
    const segment = await ensureSeedanceLastFrame(await pollSeedanceShotTask(task));
    segments.push(segment);
    previousLastFrameUrl = segment.lastFrameUrl;
  }
  const totalDuration = segments.reduce((sum, segment) => sum + segment.duration, 0);

  let videoUrl = segments[0]?.videoUrl;
  let merge: { bytes?: number; segmentCount?: number } = {};
  if (segments.length > 1) {
    const mergeResult = await mergeVideosWithLocalFfmpeg(segments.map(segment => segment.videoUrl));
    videoUrl = mergeResult.videoUrl;
    merge = { bytes: mergeResult.bytes, segmentCount: mergeResult.segmentCount };
  }
  if (!videoUrl) {
    throw new Error('视频片段已生成，但没有可返回的成片 URL。');
  }

  return {
    model: videoModel,
    videoUrl,
    duration: totalDuration,
    segments,
    segmentCount: segments.length,
    merge,
    shotTitle: segments.length > 1 ? '完整成片' : segments[0]?.shotTitle,
  };
}

export async function POST(request: NextRequest) {
  const access = await resolvePaperHostCreationOwnerFromRequest(request);
  if (!access) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const { owner } = access;
  try {
    const body = (await request.json().catch(() => ({}))) as VimaxAgentStepBody;
    const phase = body.phase || 'plan';

    if (phase === 'plan') {
      const prompt = assertPrompt(body.prompt);
      const preset = resolveVimaxSkillPresetForRuntime(body.skillId);
      const trustedBody: VimaxAgentStepBody = {
        ...body,
        skillId: preset.id,
        sceneType: preset.sceneType,
        style: preset.style,
      };
      const wantStream = body.stream === true;
      const planConnection = extractBYOKConnection(request.headers);
      const videoConnection = extractBYOKVideoConnection(request.headers);

      if (wantStream) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            try {
              send('plan.start', { phase: 'plan' });
              const result = await callArkTextStream(prompt, preset, body.model, (delta) => {
                send('plan.delta', { delta });
              }, planConnection);
              const envelope = createPersistedPlanEnvelope(
                owner,
                prompt,
                result.model,
                result.plan,
                trustedBody,
                planConnection,
                videoConnection,
              );
              send('plan.complete', { success: true, phase: 'plan', model: result.model, ...envelope });
            } catch (error) {
              send('plan.error', { error: error instanceof Error ? error.message : 'unknown' });
            } finally {
              controller.close();
            }
          },
        });
        return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
      }

      const result = await callArkText(prompt, preset, body.model, planConnection);
      const envelope = createPersistedPlanEnvelope(
        owner,
        prompt,
        result.model,
        result.plan,
        trustedBody,
        planConnection,
        videoConnection,
      );
      return NextResponse.json({
        success: true,
        phase,
        usedRealKey: true,
        incurredCost: true,
        model: result.model,
        ...envelope,
      });
    }

    if (phase === 'reference_assets') {
      const canonical = resolveCanonicalVimaxStageInput({ taskId: body.taskId || '', owner });
      const config = getArkConfig();
      const planConnection = extractBYOKConnection(request.headers);
      const productionPlan = assertVimaxProductionPlanForPhase(canonical.productionPlan, 'reference_assets', {
        plan: planConnection?.model || config.textModel,
        referenceAssets: planConnection?.imageModel || config.imageModel,
        video: config.videoModel,
      });
      const preset = resolveVimaxSkillPresetForRuntime(productionPlan.workflow.presetId);
      if (!productionPlan.continuity) {
        throw new Error('制作计划缺少连续性契约，请返回计划阶段重新确认。');
      }
      const result = await callVimaxReferenceImages({
        plan: canonical.plan,
        preset,
        continuity: productionPlan.continuity,
        config: {
          imageApiKey: config.imageApiKey || '',
          imageApiBase: config.imageApiBase,
          imageModel: config.imageModel,
          selectorApiKey: config.apiKey || '',
          selectorApiBase: config.apiBase,
          selectorModel: config.selectorModel,
        },
      });
      const task = getTaskForOwner(canonical.taskId, owner);
      if (!task) throw new Error('创作项目不存在或无权访问，参考素材无法保存。');
      if (!updateTask(task.id, {
        result: {
          ...(task.result || {}),
          vimaxReferenceAssets: result.assets,
          vimaxSubjectReferenceRegistry: result.subjectRegistry,
        },
      })) throw new Error('角色定妆与参考素材保存失败。');
      return NextResponse.json({
        success: true,
        phase,
        usedRealKey: true,
        incurredCost: true,
        model: result.model,
        assets: result.assets,
        subjectRegistry: result.subjectRegistry,
      });
    }

    if (phase === 'video') {
      // 视频生成阶段需要用户在界面显式确认费用、模型、时长和参考素材后，才会调用视频模型。
      if (body.confirm !== true && body.recover !== true) {
        return NextResponse.json(
          {
            success: false,
            phase,
            error: '视频生成会按真实费用调用 Seedance，必须在界面显式确认后才会执行。',
          },
          { status: 409 },
        );
      }
      const canonical = resolveCanonicalVimaxStageInput({ taskId: body.taskId || '', owner });
      const config = getArkConfig();
      const planConnection = extractBYOKConnection(request.headers);
      const videoConnection = extractBYOKVideoConnection(request.headers);
      const videoModel = videoConnection?.videoModel || config.videoModel;
      const productionPlan = assertVimaxProductionPlanForPhase(canonical.productionPlan, 'video', {
        plan: planConnection?.model || config.textModel,
        referenceAssets: config.imageModel,
        video: videoModel,
      });
      const preset = resolveVimaxSkillPresetForRuntime(productionPlan.workflow.presetId);
      const task = getTaskForOwner(canonical.taskId, owner);
      const persistedAssets = Array.isArray(task?.result?.vimaxReferenceAssets)
        ? task.result.vimaxReferenceAssets as VimaxAgentReferenceAsset[]
        : [];
      const assets = Array.isArray(body.assets) && body.assets.length > 0
        ? body.assets
        : persistedAssets;
      const generationPreferences = productionPlan.preferences;
      if (!productionPlan.continuity) {
        throw new Error('制作计划缺少连续性契约，请返回计划阶段重新确认。');
      }
      if (body.recover === true && videoConnection?.provider !== 'happyhorse-dashscope') {
        throw new Error('当前视频供应商不支持按异步任务列表恢复。');
      }
      const result = body.recover === true && videoConnection?.provider === 'happyhorse-dashscope'
        ? await recoverHappyHorseVimaxVideo(canonical.plan, videoConnection, { createdAfter: task?.createdAt || Date.now() })
        : videoConnection?.provider === 'happyhorse-dashscope'
          ? await callHappyHorseVimaxVideo(canonical.plan, preset, videoConnection, generationPreferences, productionPlan.continuity)
        : await callSeedanceVideo(canonical.plan, assets, preset, productionPlan.continuity, generationPreferences);
      updateTask(canonical.taskId, {
        result: {
          ...(task?.result || {}),
          vimaxVideoResult: result,
        },
      });
      return NextResponse.json({
        success: true,
        phase,
        usedRealKey: true,
        incurredCost: body.recover !== true,
        recovered: body.recover === true,
        model: result.model,
        videoUrl: result.videoUrl,
        duration: result.duration,
        shotTitle: result.shotTitle,
        segmentCount: result.segmentCount,
        segments: result.segments,
        merge: result.merge,
      });
    }

    return NextResponse.json(
      {
        success: false,
        phase,
        error: '未知的创作阶段。',
      },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创作阶段执行失败',
      },
      { status: 502 },
    );
  }
}
