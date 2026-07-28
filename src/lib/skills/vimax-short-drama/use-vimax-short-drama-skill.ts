'use client';

import { useCallback, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { genId, type ChatMessage } from '@/lib/smart-assistant-panel-model';
import {
  buildVimaxPlanRequest,
  resolveVimaxGenerationSettings,
  type VimaxGenerationSettings,
} from '@/lib/skills/vimax-short-drama/vimax-generation-preferences';
import {
  createVimaxRunCoordinator,
  VIMAX_REFERENCE_REQUEST_TIMEOUT_MS,
  VIMAX_REFERENCE_RUN_TIMEOUT_MS,
  type VimaxRunCoordinator,
  type VimaxRunToken,
} from '@/lib/skills/vimax-short-drama/vimax-project-session';
import {
  parseVimaxProductionPlan,
  skipsVimaxReferenceAssets,
  type VimaxProductionPlan,
} from '@/lib/skills/vimax-short-drama/vimax-production-plan';
import { waitForVimaxBackgroundVideoTask } from '@/lib/skills/vimax-short-drama/vimax-background-video-task';
import { waitForVimaxBackgroundReferenceTask } from '@/lib/skills/vimax-short-drama/vimax-background-reference-task';
import { waitForPersistedVimaxPlan } from '@/lib/skills/vimax-short-drama/vimax-plan-stream-recovery';
import { resolveVimaxVideoInputAssets } from '@/lib/skills/vimax-short-drama/vimax-video-input-assets';
import { formatProviderError } from '@/lib/byok-client';
import { clientApiFetch, clientApiRequest, ClientRequestError } from '@/lib/client-api';

/**
 * ViMAX 短剧制作 = Agent 驱动的一个 skill。
 * 这里把分阶段真实模型链路（plan → reference_assets）从 2500+ 行的 smart-assistant-panel
 * 里抽出来，面板只负责唤起这个 skill，不再承载短剧编排逻辑。
 *
 * 阶段约束（不可放宽）：
 * - plan：真实 Ark AgentPlan / Doubao，失败直接报错，不切假规划、不回退旧 director-chain。
 * - reference_assets：需要参考图时真实调用图像模型；服务端计划明确跳过时使用文本连续性约束。
 * - 视频/语音阶段必须用户显式确认费用，这里不触发。
 */

export const VIMAX_REFERENCE_CONFIRM_REGEX = /确认分镜|生成参考图|仅重试缺失参考图|进入\s*(?:Seedream|千问图像)|参考素材生成/;

export function findVimaxReferencePlanMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find(message => {
    const phase = message.vimaxAgent?.phase;
    return (phase === 'plan' || phase === 'reference_assets') && Boolean(message.vimaxAgent?.assets?.length);
  });
}

/**
 * 视频确认意图。仅当对话里已存在带真实参考图 URL 的 ViMAX 消息时，
 * 面板才会用它把请求路由到真实 Seedance 视频阶段，避免和导演链路里的
 * 泛化「生成视频」建议冲突。
 */
export const VIMAX_VIDEO_CONFIRM_REGEX = /继续生成视频|生成视频|生成首镜|生成其余镜头|重做首镜/;

export interface VimaxPlanContext {
  prompt: string;
  duration: number;
  style: string;
  skillId?: string;
  sceneType?: string;
  segmentDuration?: number;
  segmentCount?: number;
  settings?: VimaxGenerationSettings;
  referenceIds?: string[];
  projectId?: string;
  projectAttachmentIds?: string[];
}

type VimaxAssetKind = NonNullable<NonNullable<ChatMessage['vimaxAgent']>['assets']>[number]['kind'];

interface PartialPlan {
  title?: string;
  summary?: string;
  story?: NonNullable<ChatMessage['vimaxAgent']>['story'];
  characters?: NonNullable<ChatMessage['vimaxAgent']>['characters'];
  scenes?: NonNullable<ChatMessage['vimaxAgent']>['scenes'];
  props?: NonNullable<ChatMessage['vimaxAgent']>['props'];
  assets: Array<{ kind?: VimaxAssetKind; label?: string; prompt?: string }>;
  shots: Array<{
    index?: number;
    title?: string;
    duration?: number;
    camera?: string;
    prompt?: string;
    description?: string;
    actionStart?: string;
    actionEnd?: string;
    dialogue?: string;
    narration?: string;
    spatialRelation?: 'same-scene' | 'new-scene';
    temporalRelation?: 'continuous' | 'elapsed' | 'time-jump';
    routeConfidence?: 'high' | 'medium' | 'low';
    conflictFlags?: string[];
  }>;
}

function isUnauthorized(error: unknown): error is ClientRequestError {
  return error instanceof ClientRequestError && error.code === 'unauthorized';
}

/** 从数组字段里抽出「已完整闭合」的对象，未闭合的尾部对象直接忽略，实现逐条出现。 */
function extractCompleteObjects(raw: string, key: string): Array<Record<string, unknown>> {
  const marker = new RegExp(`"${key}"\\s*:\\s*\\[`).exec(raw);
  if (!marker) return [];
  let i = marker.index + marker[0].length;
  const objects: Array<Record<string, unknown>> = [];
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
      objects.push(JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>);
    } catch {
      break;
    }
  }
  return objects;
}

/** 容错解析流式输出，只返回当前已完整的字段/条目，绝不把原始 JSON 透传给用户。 */
function parsePartialPlan(raw: string): PartialPlan {
  const clean = raw.replace(/```json/g, '').replace(/```/g, '');
  const titleMatch = /"title"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(clean);
  const summaryMatch = /"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(clean);
  const decode = (value: string) => value.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  return {
    title: titleMatch ? decode(titleMatch[1]) : undefined,
    summary: summaryMatch ? decode(summaryMatch[1]) : undefined,
    assets: extractCompleteObjects(clean, 'assets') as PartialPlan['assets'],
    shots: extractCompleteObjects(clean, 'shots') as PartialPlan['shots'],
  };
}

interface VimaxShortDramaSkillDeps {
  messagesRef: MutableRefObject<ChatMessage[]>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setIsLoading: (loading: boolean) => void;
  setInputValue: (value: string) => void;
  setCurrentStep: (step: number) => void;
  runCoordinator?: VimaxRunCoordinator;
  requestHeaders?: Record<string, string>;
  onAuthenticationRequired?: (reason: string) => void;
  onTaskIdAvailable?: (taskId: string) => void;
}

export interface VimaxShortDramaSkill {
  handlePlanStep: (context: VimaxPlanContext) => Promise<void>;
  handleReferenceAssetsStep: (options?: { recover?: boolean; cancel?: boolean }) => Promise<void>;
  handleVideoStep: (options?: {
    recover?: boolean;
    resume?: boolean;
    cancel?: boolean;
    confirmRouteDecisions?: boolean;
  }) => Promise<void>;
  cancelCurrentRun: () => boolean;
}

export function useVimaxShortDramaSkill(deps: VimaxShortDramaSkillDeps): VimaxShortDramaSkill {
  const {
    messagesRef,
    setMessages,
    setIsLoading,
    setInputValue,
    setCurrentStep,
    runCoordinator: providedRunCoordinator,
    requestHeaders,
    onAuthenticationRequired,
    onTaskIdAvailable,
  } = deps;
  const fallbackRunCoordinatorRef = useRef<VimaxRunCoordinator | null>(null);
  const planningReadinessPendingRef = useRef(false);
  const activePlanningTaskIdRef = useRef<string | null>(null);
  const activeReferenceTaskIdRef = useRef<string | null>(null);
  const activeVideoTaskIdRef = useRef<string | null>(null);
  const pendingPlanningCancelRef = useRef(false);
  if (!fallbackRunCoordinatorRef.current) fallbackRunCoordinatorRef.current = createVimaxRunCoordinator();
  const runCoordinator = providedRunCoordinator || fallbackRunCoordinatorRef.current;

  const updateRunMessages = useCallback((run: VimaxRunToken, update: (messages: ChatMessage[]) => ChatMessage[]) => {
    if (!runCoordinator.isCurrent(run)) return;
    setMessages(update);
  }, [runCoordinator, setMessages]);

  const handlePlanStep = useCallback(async (context: VimaxPlanContext) => {
    const prompt = context.prompt;
    const generationSettings = context.settings || resolveVimaxGenerationSettings({});
    const userMsgId = genId();
    const progressMsgId = `vimax-agent-plan-${Date.now()}`;
    if (planningReadinessPendingRef.current) return;
    planningReadinessPendingRef.current = true;
    try {
      const readinessResponse = await clientApiRequest('/api/smart/vimax-agent-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...requestHeaders },
        body: JSON.stringify({ phase: 'planning_readiness' }),
        signal: AbortSignal.timeout(10_000),
        redirectOnUnauthorized: false,
      });
      const readiness = await readinessResponse.json().catch(() => null) as { ready?: boolean } | null;
      if (!readinessResponse.ok || readiness?.ready !== true) {
        const failureMessage = formatProviderError(readiness, '规划暂时不可用，请稍后重试。');
        setMessages(prev => [...prev,
          { id: userMsgId, role: 'user', content: prompt, timestamp: Date.now() },
          {
            id: progressMsgId,
            role: 'assistant',
            content: `${failureMessage}\n输入和项目已保留，可更换规划模型后重试。`,
            timestamp: Date.now(),
            generationStatus: 'failed',
            generationProgress: 100,
            generationStepInfo: { step: 'vimax-agent-plan', progress: 100, totalSteps: 4, currentStepLabel: '规划未就绪' },
          },
        ]);
        setInputValue(prompt);
        return;
      }
    } catch (error) {
      const authenticationRequired = isUnauthorized(error);
      if (authenticationRequired) onAuthenticationRequired?.('当前创作需要登录后继续，已保留本页内容。');
      setMessages(prev => [...prev,
        { id: userMsgId, role: 'user', content: prompt, timestamp: Date.now() },
        {
          id: progressMsgId,
          role: 'assistant',
          content: authenticationRequired
            ? '当前创作需要登录后继续，输入和项目已保留。'
            : '规划暂时失败，输入和项目已保留，请稍后重试或更换规划模型。',
          timestamp: Date.now(),
          generationStatus: 'failed',
          generationProgress: 100,
          generationStepInfo: { step: 'vimax-agent-plan', progress: 100, totalSteps: 4, currentStepLabel: '规划未就绪' },
        },
      ]);
      setInputValue(prompt);
      return;
    } finally {
      planningReadinessPendingRef.current = false;
    }
    const run = runCoordinator.begin({
      projectId: messagesRef.current[0]?.id || userMsgId,
      phase: 'plan',
      messageId: progressMsgId,
      timeoutMs: 60_000,
    });
    activePlanningTaskIdRef.current = null;
    pendingPlanningCancelRef.current = false;
    setIsLoading(true);
    setInputValue('');
    setMessages(prev => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        content: prompt,
        timestamp: Date.now(),
      },
      {
        id: progressMsgId,
        role: 'assistant',
        content: '正在规划你的短剧分镜…',
        timestamp: Date.now(),
        generationStatus: 'generating',
        generationProgress: 18,
        generationStepInfo: {
          step: 'vimax-agent-plan',
          progress: 18,
          totalSteps: 4,
          currentStepLabel: '剧本规划',
        },
      },
    ]);

    try {
      const response = await clientApiRequest('/api/smart/vimax-agent-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...requestHeaders },
        body: JSON.stringify(buildVimaxPlanRequest({
          ...context,
          settings: generationSettings,
          requestId: run.requestId,
        })),
        signal: run.signal,
        redirectOnUnauthorized: false,
      });
      if (!response.ok || !response.body) {
        const failure = await response.json().catch(() => null);
        throw new Error(formatProviderError(failure, '规划暂时不可用，请稍后重试。'));
      }

      // 流式读取 SSE，逐 delta 解析出「已完整的镜头/资产」，逐条渲染成卡片，
      // 绝不把原始 JSON 文本透传到对话气泡里。
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let rawPlanText = '';
      let plan: PartialPlan & { nextAction?: string } = { assets: [], shots: [] };
      let assets: PartialPlan['assets'] = [];
      let shots: PartialPlan['shots'] = [];
      let planModel = '';
      let planTaskId = '';
      let persistedTaskId = '';
      let productionPlan: VimaxProductionPlan | undefined;
      let streamError = '';

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const blocks = sseBuffer.split('\n\n');
          sseBuffer = blocks.pop() || '';
          for (const block of blocks) {
            const lines = block.split('\n');
            let event = '';
            let dataStr = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) event = line.slice(7).trim();
              else if (line.startsWith('data: ')) dataStr = line.slice(6);
            }
            if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (event === 'plan.delta' && data.delta) {
                rawPlanText += data.delta;
                const partial = parsePartialPlan(rawPlanText);
                const planned = Math.min(15 + partial.assets.length * 6 + partial.shots.length * 8, 95);
                updateRunMessages(run, prev => prev.map(m => m.id === progressMsgId ? {
                  ...m,
                  content: partial.title
                    ? `正在规划「${partial.title}」… 已生成 ${partial.shots.length} 个镜头`
                    : '正在逐条规划你的短剧分镜…',
                  generationProgress: planned,
                  generationStepInfo: {
                    step: 'vimax-agent-plan',
                    progress: planned,
                    totalSteps: 4,
                    currentStepLabel: partial.title ? `规划：${partial.title}` : '剧本规划',
                  },
                  vimaxAgent: {
                    phase: 'plan',
                    title: partial.title || '短剧制作计划',
                    summary: partial.summary || '',
                    model: '规划中…',
                    generationSettings,
                    costState: 'incurred',
                    nextAction: '正在逐条生成分镜，请稍候。',
                    assets: partial.assets.map(asset => ({
                      kind: (asset.kind as NonNullable<NonNullable<ChatMessage['vimaxAgent']>['assets']>[number]['kind']) || 'reference',
                      label: asset.label || '参考素材',
                      prompt: asset.prompt || '',
                      status: 'planned' as const,
                    })),
                    shots: partial.shots.map((shot, index) => ({
                      index: Number(shot.index) || index + 1,
                      title: shot.title || `Clip ${index + 1}`,
                      duration: Number(shot.duration) || 6,
                      camera: shot.camera || '固定镜头',
                      prompt: shot.prompt || '',
                      status: 'planned' as const,
                    })),
                  },
                } : m));
              } else if (event === 'plan.accepted') {
                persistedTaskId = typeof data.taskId === 'string' ? data.taskId : '';
                if (persistedTaskId) {
                  activePlanningTaskIdRef.current = persistedTaskId;
                  onTaskIdAvailable?.(persistedTaskId);
                  updateRunMessages(run, current => current.map(message => message.id === progressMsgId ? {
                    ...message,
                    vimaxAgent: {
                      phase: 'plan',
                      title: '短剧制作计划',
                      summary: prompt,
                      model: generationSettings.planModel,
                      taskId: persistedTaskId,
                      generationSettings,
                      costState: 'incurred',
                      nextAction: '正在生成故事与分镜。',
                    },
                  } : message));
                  if (pendingPlanningCancelRef.current) {
                    void clientApiRequest(`/api/tasks/${encodeURIComponent(persistedTaskId)}`, {
                      method: 'DELETE',
                      headers: requestHeaders,
                      redirectOnUnauthorized: false,
                    }).catch(() => undefined);
                  }
                }
              } else if (event === 'plan.complete') {
                plan = data.plan || {};
                assets = Array.isArray(plan.assets) ? plan.assets : [];
                shots = Array.isArray(plan.shots) ? plan.shots : [];
                planModel = data.model || '';
                planTaskId = typeof data.taskId === 'string' ? data.taskId : '';
                persistedTaskId = planTaskId || persistedTaskId;
                if (persistedTaskId) onTaskIdAvailable?.(persistedTaskId);
                productionPlan = parseVimaxProductionPlan(data.productionPlan);
              } else if (event === 'plan.error') {
                streamError = formatProviderError(data, '规划暂时不可用，请稍后重试。');
                if (typeof data.taskId === 'string') persistedTaskId = data.taskId;
              }
            } catch { /* skip */ }
          }
        }
      } catch (error) {
        if (run.signal.aborted) throw error;
        streamError = '规划结果连接中断，正在从已保存的项目恢复。';
      }

      if (persistedTaskId && (streamError || !plan.title || !productionPlan)) {
        try {
          const recovered = await waitForPersistedVimaxPlan({
            taskId: persistedTaskId,
            signal: run.signal,
            loadTask: async taskId => {
              const persisted = await clientApiFetch<{ task?: unknown }>(
                `/api/tasks/${encodeURIComponent(taskId)}`,
                { headers: requestHeaders, signal: run.signal, redirectOnUnauthorized: false },
              );
              return persisted.task;
            },
          });
          if (recovered) {
            plan = recovered.plan;
            assets = recovered.plan.assets;
            shots = recovered.plan.shots;
            planModel = generationSettings.planModel;
            planTaskId = recovered.taskId;
            productionPlan = recovered.productionPlan;
            streamError = '';
          }
        } catch {
          // The owner-scoped task route fails closed; preserve the original stream error.
        }
      }

      if (streamError) throw new Error(streamError);
      if (!plan.title) throw new Error('模型未返回有效的分镜规划。');
      if (!productionPlan) throw new Error('制作计划契约缺失，请重新规划。');
      updateRunMessages(run, prev => prev.map(message => message.id === progressMsgId ? {
        ...message,
        content: plan.summary || '已生成短剧分镜规划，请预览并确认。',
        resultType: 'film',
        generationStatus: 'completed',
        generationProgress: 100,
        generationStepInfo: {
          step: 'vimax-agent-plan',
          progress: 100,
          totalSteps: 4,
          currentStepLabel: '分镜规划完成',
        },
        vimaxAgent: {
          phase: 'plan',
          title: plan.title || '短剧制作计划',
          summary: plan.summary || '',
          model: planModel || 'Ark AgentPlan',
          taskId: planTaskId || undefined,
          generationSettings,
          productionPlan,
          story: plan.story,
          characters: plan.characters,
          scenes: plan.scenes,
          props: plan.props,
          costState: 'incurred',
          nextAction: plan.nextAction || '确认分镜后进入千问参考素材生成。',
          assets: assets.map((asset: { kind?: NonNullable<NonNullable<ChatMessage['vimaxAgent']>['assets']>[number]['kind']; label?: string; prompt?: string }) => ({
            kind: asset.kind || 'reference',
            label: asset.label || '参考素材',
            prompt: asset.prompt || '',
            status: 'planned',
          })),
          shots: shots.map((shot: {
            index?: number;
            title?: string;
            duration?: number;
            camera?: string;
            prompt?: string;
            description?: string;
            actionStart?: string;
            actionEnd?: string;
            dialogue?: string;
            narration?: string;
            spatialRelation?: 'same-scene' | 'new-scene';
            temporalRelation?: 'continuous' | 'elapsed' | 'time-jump';
            routeConfidence?: 'high' | 'medium' | 'low';
            conflictFlags?: string[];
          }, index: number) => ({
            index: Number(shot.index) || index + 1,
            title: shot.title || `Clip ${index + 1}`,
            duration: Number(shot.duration) || 6,
            camera: shot.camera || '固定镜头',
            prompt: shot.description || shot.prompt || '',
            actionStart: shot.actionStart,
            actionEnd: shot.actionEnd,
            dialogue: shot.dialogue,
            narration: shot.narration,
            spatialRelation: shot.spatialRelation,
            temporalRelation: shot.temporalRelation,
            routeConfidence: shot.routeConfidence,
            conflictFlags: shot.conflictFlags,
            status: 'planned' as const,
          })),
        },
        quickOptions: skipsVimaxReferenceAssets(productionPlan)
          ? ['继续生成视频', '调整时长和节奏', '补充角色或场景']
          : ['确认分镜，生成参考图', '调整时长和节奏', '补充角色或场景'],
        actions: ['复制', '引用', '修改'],
      } : message));
      setCurrentStep(5);
    } catch (error) {
      if (!runCoordinator.isCurrent(run)) return;
      if (isUnauthorized(error)) onAuthenticationRequired?.('当前创作需要登录后继续，已保留本页内容。');
      const rawMessage = error instanceof Error ? error.message : '';
      const failureMessage = isUnauthorized(error)
        ? '当前创作需要登录后继续。'
        : /^(规划模型连接不可用|规划模型暂不可用|规划暂时失败)/.test(rawMessage)
        ? rawMessage
        : formatProviderError({ provider: 'planning', code: 'planning_provider_failed' }, '规划暂时不可用，请稍后重试。');
      setInputValue(prompt);
      updateRunMessages(run, prev => prev.map(message => message.id === progressMsgId ? {
        ...message,
        content: `${failureMessage}\n输入和项目已保留，可更换规划模型后重试。`,
        generationStatus: 'failed',
        generationProgress: 100,
        generationStepInfo: {
          step: 'vimax-agent-plan',
          progress: 100,
          totalSteps: 4,
          currentStepLabel: '规划失败',
        },
      } : message));
    } finally {
      if (runCoordinator.finish(run)) {
        activePlanningTaskIdRef.current = null;
        pendingPlanningCancelRef.current = false;
        setIsLoading(false);
      }
    }
  }, [messagesRef, onAuthenticationRequired, onTaskIdAvailable, requestHeaders, runCoordinator, setMessages, setIsLoading, setInputValue, setCurrentStep, updateRunMessages]);

  const handleReferenceAssetsStep = useCallback(async (options: { recover?: boolean; cancel?: boolean } = {}) => {
    const planMessage = findVimaxReferencePlanMessage(messagesRef.current);
    const plan = planMessage?.vimaxAgent;
    if (!plan) {
      setMessages(prev => [...prev, {
        id: genId(),
        role: 'assistant',
        content: '请先完成分镜规划，再生成参考图。',
        timestamp: Date.now(),
        generationStatus: 'failed',
        generationStepInfo: { step: 'blocked', progress: 0, totalSteps: 4, currentStepLabel: '需要先规划' },
      }]);
      return;
    }

    if (skipsVimaxReferenceAssets(plan.productionPlan)) {
      setMessages(prev => [...prev, {
        id: genId(),
        role: 'assistant',
        content: '当前视频模型使用文本连续性约束，不需要生成参考图。角色、服饰、道具、动作起止与构图锚点会按制作计划传入每个镜头。',
        timestamp: Date.now(),
        generationStatus: 'completed',
        generationProgress: 100,
        generationStepInfo: { step: 'reference-skipped', progress: 100, totalSteps: 4, currentStepLabel: '参考素材无需生成' },
        quickOptions: ['继续生成视频', '调整分镜', '取消'],
        vimaxAgent: {
          ...plan,
          phase: 'reference_assets',
          costState: 'not-yet',
          nextAction: '确认视频费用后按文本连续性约束逐镜生成。',
        },
      } as ChatMessage]);
      return;
    }

    const recoveredReferenceTaskId = options.recover
      ? [...messagesRef.current].reverse().find(message => message.vimaxAgent?.referenceTaskId)?.vimaxAgent?.referenceTaskId
      : undefined;
    if (options.recover && !recoveredReferenceTaskId) {
      setMessages(prev => [...prev, {
        id: genId(),
        role: 'assistant',
        content: '没有找到可恢复的参考图任务，请重新生成缺失参考图。',
        timestamp: Date.now(),
        generationStatus: 'failed',
        quickOptions: ['仅重试缺失参考图', '调整分镜'],
      }]);
      return;
    }

    if (options.cancel) {
      const referenceTaskId = [...messagesRef.current].reverse()
        .find(message => message.vimaxAgent?.referenceTaskId)?.vimaxAgent?.referenceTaskId;
      if (!referenceTaskId) {
        setMessages(prev => [...prev, {
          id: genId(),
          role: 'assistant',
          content: '没有找到仍可取消的参考图任务。',
          timestamp: Date.now(),
          generationStatus: 'failed',
        }]);
        return;
      }
      const response = await clientApiRequest(`/api/tasks/${encodeURIComponent(referenceTaskId)}`, {
        method: 'DELETE',
        headers: requestHeaders,
        redirectOnUnauthorized: false,
      });
      const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
      setMessages(prev => prev.map(message => (
        message.vimaxAgent?.referenceTaskId === referenceTaskId
          ? {
            ...message,
            content: response.ok
              ? '本次参考图生成已取消；分镜、项目素材和已保存结果均已保留。'
              : payload.error || '参考图任务已经结束，无法再次取消。',
            generationStatus: 'failed',
            quickOptions: ['仅重试缺失参考图', '调整分镜'],
          }
          : message
      )));
      return;
    }

    const progressMsgId = `vimax-seedream-${Date.now()}`;
    const run = runCoordinator.begin({
      projectId: messagesRef.current[0]?.id || progressMsgId,
      phase: 'reference_assets',
      messageId: progressMsgId,
      timeoutMs: VIMAX_REFERENCE_RUN_TIMEOUT_MS,
    });
    activeReferenceTaskIdRef.current = recoveredReferenceTaskId || null;
    setIsLoading(true);
    setMessages(prev => [...prev, {
      id: progressMsgId,
      role: 'assistant',
      content: options.recover ? '正在恢复同一批参考图…' : '正在生成参考图…',
      timestamp: Date.now(),
      generationStatus: 'generating',
      generationProgress: 20,
      generationType: 'image',
      generationStepInfo: { step: 'seedream-reference', progress: 20, totalSteps: 4, currentStepLabel: '参考图生成' },
      vimaxAgent: {
        ...plan,
        phase: 'reference_assets',
        referenceTaskId: recoveredReferenceTaskId,
        costState: 'incurred',
        nextAction: options.recover ? '正在查看已保存的参考图任务。' : '等待千问图像返回参考素材。',
      },
    } as ChatMessage]);

    try {
      let backgroundTaskId = recoveredReferenceTaskId;
      let acceptedData: Record<string, unknown> = {};
      if (!backgroundTaskId) {
        const response = await clientApiRequest('/api/smart/vimax-agent-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...requestHeaders },
          body: JSON.stringify({
            taskId: plan.taskId,
            phase: 'reference_assets',
            productionPlan: plan.productionPlan,
            plan: {
              title: plan.title,
              summary: plan.summary,
              assets: (plan.assets || []).map(asset => ({
                kind: asset.kind,
                label: asset.label,
                prompt: asset.prompt || '',
              })),
              shots: (plan.shots || []).map(shot => ({
                index: shot.index,
                title: shot.title,
                duration: shot.duration,
                camera: shot.camera,
                prompt: shot.prompt,
                referenceUrl: shot.referenceUrl,
              })),
              nextAction: plan.nextAction,
            },
          }),
          timeoutMs: VIMAX_REFERENCE_REQUEST_TIMEOUT_MS,
          signal: run.signal,
          redirectOnUnauthorized: false,
        });
        acceptedData = await response.json().catch(() => ({}));
        if (response.status !== 202 || acceptedData.success !== true || acceptedData.accepted !== true) {
          throw new Error(typeof acceptedData.error === 'string' ? acceptedData.error : '参考图任务提交失败');
        }
        backgroundTaskId = typeof acceptedData.backgroundTaskId === 'string'
          ? acceptedData.backgroundTaskId
          : undefined;
        if (!backgroundTaskId) throw new Error('参考图任务已受理，但没有返回可恢复的任务号。');
      }
      activeReferenceTaskIdRef.current = backgroundTaskId;
      updateRunMessages(run, current => current.map(message => message.id === progressMsgId ? {
        ...message,
        vimaxAgent: {
          ...plan,
          phase: 'reference_assets',
          referenceTaskId: backgroundTaskId,
          costState: 'incurred',
          nextAction: '参考图正在生成，页面刷新后仍可继续查看。',
        },
      } : message));

      const result = await waitForVimaxBackgroundReferenceTask({
        taskId: backgroundTaskId,
        requestId: run.requestId,
        headers: requestHeaders || {},
        signal: run.signal,
        onProgress: (progress, stage, message) => {
          updateRunMessages(run, current => current.map(item => item.id === progressMsgId ? {
            ...item,
            content: message || item.content,
            generationProgress: progress,
            generationStepInfo: {
              step: 'seedream-reference',
              progress,
              totalSteps: 4,
              currentStepLabel: stage || '参考图生成中',
            },
          } : item));
        },
      });
      const data = { ...acceptedData, ...result, success: true };

      const generatedAssets = Array.isArray(data.assets) ? data.assets : [];
      const portraitCount = generatedAssets.filter((asset: { subjectView?: unknown }) => typeof asset.subjectView === 'string').length;
      const shotReferenceCount = generatedAssets.filter((asset: { shotIndex?: unknown }) => typeof asset.shotIndex === 'number').length;
      const failedShotIndices = Array.isArray(data.failedShotIndices)
        ? data.failedShotIndices.filter((value: unknown): value is number => typeof value === 'number')
        : [];
      const referencesComplete = data.complete !== false && failedShotIndices.length === 0;
      // 把每张参考图按 shotIndex 归位到对应 Clip 上，让图片显示在分镜下方。
      const refByShot = new Map<number, string>();
      for (const asset of generatedAssets as Array<{ url?: string; shotIndex?: number }>) {
        if (typeof asset.url === 'string' && typeof asset.shotIndex === 'number') {
          refByShot.set(asset.shotIndex, asset.url);
        }
      }
      const shotsWithRef = (plan.shots || []).map(shot => ({
        ...shot,
        referenceUrl: refByShot.get(shot.index) ?? shot.referenceUrl,
        status: (refByShot.get(shot.index) ? 'reference' : shot.status) as NonNullable<NonNullable<ChatMessage['vimaxAgent']>['shots']>[number]['status'],
      }));
      updateRunMessages(run, prev => prev.map(message => message.id === progressMsgId ? {
        ...message,
        content: referencesComplete
          ? `已生成 ${portraitCount} 张角色定妆参考和 ${shotReferenceCount} 张分镜参考图；分镜图已挂到对应 Clip。预览满意后可继续生成视频。`
          : `已保留 ${shotReferenceCount} 张分镜参考图；镜头 ${failedShotIndices.join('、')} 尚未完成。重试只会生成缺失镜头，不会重复调用已成功结果。`,
        generationStatus: referencesComplete ? 'completed' : 'failed',
        generationProgress: 100,
        generatedImages: generatedAssets.flatMap(asset => (
          typeof asset.url === 'string'
            ? [{ url: asset.url, prompt: asset.prompt, label: asset.label || '参考素材' }]
            : []
        )),
        assetType: '分镜',
        generationStepInfo: { step: 'seedream-reference', progress: 100, totalSteps: 4, currentStepLabel: '参考图已生成' },
        quickOptions: referencesComplete
          ? ['确认参考图，继续生成视频', '重做某张参考图', '补充参考图']
          : ['仅重试缺失参考图', '调整分镜', '取消'],
        vimaxAgent: {
          ...plan,
          phase: 'reference_assets',
          referenceTaskId: backgroundTaskId,
          model: data.model || plan.model,
          costState: 'incurred',
          nextAction: referencesComplete
            ? '确认参考素材后进入视频模型费用确认。'
            : `仅重试缺失镜头 ${failedShotIndices.join('、')}。`,
          shots: shotsWithRef,
          assets: generatedAssets.map(asset => ({
            kind: (asset.kind as VimaxAssetKind) || 'reference',
            label: asset.label || '参考素材',
            prompt: asset.prompt,
            url: asset.url,
            shotIndex: asset.shotIndex,
            subjectId: asset.subjectId,
            subjectView: asset.subjectView,
            status: 'generated',
          })),
        },
      } : message));
    } catch (error) {
      if (!runCoordinator.isCurrent(run)) return;
      if (isUnauthorized(error)) onAuthenticationRequired?.('当前创作需要登录后继续，已保留分镜计划。');
      updateRunMessages(run, prev => prev.map(message => message.id === progressMsgId ? {
        ...message,
        content: isUnauthorized(error)
          ? '当前创作需要登录后继续，分镜计划已保留。'
          : `参考图生成失败：${error instanceof Error ? error.message : '未知错误'}\n可调整描述后重试。`,
        generationStatus: 'failed',
        generationProgress: 100,
        generationStepInfo: { step: 'seedream-reference', progress: 100, totalSteps: 4, currentStepLabel: '参考图失败' },
        vimaxAgent: {
          ...plan,
          phase: 'reference_assets',
          referenceTaskId: activeReferenceTaskIdRef.current || undefined,
          costState: 'blocked',
          nextAction: '修正千问图像配置或素材 prompt 后重试。',
        },
      } : message));
    } finally {
      if (runCoordinator.finish(run)) {
        activeReferenceTaskIdRef.current = null;
        setIsLoading(false);
      }
    }
  }, [messagesRef, onAuthenticationRequired, requestHeaders, runCoordinator, setMessages, setIsLoading, updateRunMessages]);

  const handleVideoStep = useCallback(async (options: {
    recover?: boolean;
    resume?: boolean;
    cancel?: boolean;
    confirmRouteDecisions?: boolean;
  } = {}) => {
    const recoverCompleted = options.recover === true;
    const resumeExisting = options.resume === true;
    const reversed = [...messagesRef.current].reverse();
    const activeVideoAgent = reversed.find(message => message.vimaxAgent?.videoTaskId)?.vimaxAgent;
    if (options.cancel) {
      const videoTaskId = activeVideoAgent?.videoTaskId || activeVideoTaskIdRef.current;
      if (!videoTaskId) return;
      await clientApiRequest(`/api/tasks/${encodeURIComponent(videoTaskId)}`, {
        method: 'DELETE',
        headers: requestHeaders,
        redirectOnUnauthorized: false,
      });
      activeVideoTaskIdRef.current = null;
      setMessages(current => current.map(message => message.vimaxAgent?.videoTaskId === videoTaskId ? {
        ...message,
        content: `${message.content}\n已取消本次成片任务；已完成片段、分镜和参考素材均已保留。`,
        generationStatus: 'failed',
        generationProgress: 100,
        quickOptions: ['找回已完成片段', '调整分镜'],
      } : message));
      setIsLoading(false);
      return;
    }
    // 真实参考图 URL：优先用 generatedImages（恢复历史后最可靠），回退到 vimaxAgent.assets。
    const refMessage = reversed.find(message => (message.generatedImages || []).some(image => image.url))
      || reversed.find(message => (message.vimaxAgent?.assets || []).some(asset => asset.url));
    // 分镜与标题来源：最近一条带 shots 的 vimaxAgent 消息。
    const planAgent = reversed.find(message => (message.vimaxAgent?.shots || []).length)?.vimaxAgent;
    const referenceAssets = resolveVimaxVideoInputAssets({
      generatedImages: refMessage?.generatedImages,
      assets: refMessage?.vimaxAgent?.assets,
      shots: planAgent?.shots,
    });
    const referenceUrls = referenceAssets.map(asset => asset.url).filter((url): url is string => Boolean(url));
    const referenceAssetsSkipped = skipsVimaxReferenceAssets(planAgent?.productionPlan);
    if (!planAgent || (!referenceUrls.length && !referenceAssetsSkipped)) {
      setMessages(prev => [...prev, {
        id: genId(),
        role: 'assistant',
        content: '请先完成参考图生成，再生成视频。',
        timestamp: Date.now(),
        generationStatus: 'failed',
        generationStepInfo: { step: 'blocked', progress: 0, totalSteps: 4, currentStepLabel: '需要先生成参考图' },
        quickOptions: ['确认分镜，生成参考图', '调整分镜', '取消'],
      }]);
      return;
    }
    const agent = planAgent;
    const recoveryOrigin = messagesRef.current.find(message => (
      message.vimaxAgent?.taskId === agent.taskId
      && (message.vimaxAgent?.shots || []).length > 0
    ));
    const generationSettings = agent.generationSettings || resolveVimaxGenerationSettings({});

    const progressMsgId = `vimax-video-${Date.now()}`;
    const run = runCoordinator.begin({
      projectId: messagesRef.current[0]?.id || progressMsgId,
      phase: 'video',
      messageId: progressMsgId,
      timeoutMs: 900_000,
    });
    setIsLoading(true);
    setMessages(prev => [...prev, {
      id: progressMsgId,
      role: 'assistant',
      content: recoverCompleted
        ? '正在找回本项目已完成的视频片段并合成为完整短剧，不会重新提交生成…'
        : resumeExisting
          ? '正在继续查看同一成片任务，不会重新提交视频模型或合成任务…'
        : '正在调用当前视频模型逐段生成完整短剧，预计 4-10 分钟…',
      timestamp: Date.now(),
      generationStatus: 'generating',
      generationProgress: 30,
      generationType: 'video',
      generationStepInfo: { step: 'seedance-video', progress: 30, totalSteps: 4, currentStepLabel: '视频生成中' },
      vimaxAgent: {
        ...agent,
        phase: 'video',
        videoTaskId: resumeExisting ? activeVideoAgent?.videoTaskId : agent.videoTaskId,
        costState: 'incurred',
        nextAction: recoverCompleted ? '等待已完成片段恢复并合成。' : '等待视频模型返回成片。',
      },
    } as ChatMessage]);

    try {
      const response = resumeExisting ? null : await clientApiRequest('/api/smart/vimax-agent-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...requestHeaders },
          body: JSON.stringify({
            taskId: agent.taskId,
            phase: 'video',
            confirm: !recoverCompleted,
            confirmRouteDecisions: options.confirmRouteDecisions === true,
            recover: recoverCompleted,
            background: true,
            recoverCreatedAfter: recoverCompleted ? recoveryOrigin?.timestamp : undefined,
            productionPlan: agent.productionPlan,
            ratio: generationSettings.ratio,
            resolution: generationSettings.resolution,
            plan: {
              title: agent.title,
              summary: agent.summary,
              shots: (agent.shots || []).map(shot => ({
                index: shot.index,
                title: shot.title,
                duration: shot.duration,
                camera: shot.camera,
                prompt: shot.prompt,
                spatialRelation: shot.spatialRelation,
                temporalRelation: shot.temporalRelation,
                routeConfidence: shot.routeConfidence,
                conflictFlags: shot.conflictFlags,
                referenceUrl: shot.referenceUrl,
              })),
              assets: referenceUrls.map((url, index) => ({
                kind: 'reference' as const,
                label: `参考素材${index + 1}`,
                prompt: '',
                url,
              })),
              nextAction: agent.nextAction,
            },
            assets: referenceAssets,
          }),
          signal: run.signal,
          redirectOnUnauthorized: false,
        });
      let data = response
        ? await response.json().catch(() => ({}))
        : {
            success: true,
            accepted: true,
            backgroundTaskId: activeVideoAgent?.videoTaskId,
            recovered: true,
          };
      if (response?.status === 410 && data.code === 'legacy-plan-not-supported') {
        updateRunMessages(run, prev => prev.map(message => message.id === progressMsgId ? {
          ...message,
          content: data.error || '旧项目已停止生成，请新建项目后重新规划。',
          generationStatus: 'failed',
          generationProgress: 100,
          generationStepInfo: {
            step: 'blocked',
            progress: 100,
            totalSteps: 4,
            currentStepLabel: '旧项目已停止',
          },
          quickOptions: ['新建项目'],
          vimaxAgent: {
            ...agent,
            phase: 'video',
            costState: 'blocked',
            nextAction: '新建项目并使用新版镜头衔接合同重新规划。',
          },
        } : message));
        return;
      }
      if (response?.status === 409 && data.code === 'shot-route-confirmation-required') {
        const issues = Array.isArray(data.routeIssues)
          ? data.routeIssues.map((issue: { shotIndex?: number; reason?: string }) => (
            `Clip ${issue.shotIndex || '?'}：${issue.reason || '需要确认生成路线'}`
          )).join('\n')
          : '';
        updateRunMessages(run, prev => prev.map(message => message.id === progressMsgId ? {
          ...message,
          content: [
            '以下镜头的衔接判断存在冲突或置信度不足，尚未调用视频模型：',
            issues,
            '请检查后确认路线，或返回调整分镜。',
          ].filter(Boolean).join('\n'),
          generationStatus: 'failed',
          generationProgress: 100,
          generationStepInfo: {
            step: 'blocked',
            progress: 100,
            totalSteps: 4,
            currentStepLabel: '等待路线确认',
          },
          quickOptions: ['确认镜头路线，继续生成', '调整分镜', '取消'],
          vimaxAgent: {
            ...agent,
            phase: 'video',
            costState: 'blocked',
            nextAction: '确认冲突镜头路线后再调用视频模型。',
          },
        } : message));
        return;
      }
      if ((resumeExisting || response?.status === 202) && data.success && data.accepted) {
        if (typeof data.backgroundTaskId !== 'string' || !data.backgroundTaskId) {
          throw new Error('后台视频任务已受理，但没有返回可恢复的任务号。');
        }
        activeVideoTaskIdRef.current = data.backgroundTaskId;
        updateRunMessages(run, prev => prev.map(message => message.id === progressMsgId ? {
          ...message,
          vimaxAgent: {
            ...agent,
            phase: 'video',
            videoTaskId: data.backgroundTaskId,
            costState: 'incurred',
            nextAction: '成片任务正在执行，刷新后可继续查看或取消。',
          },
        } : message));
        const backgroundResult = await waitForVimaxBackgroundVideoTask({
          taskId: data.backgroundTaskId,
          requestId: run.requestId,
          headers: requestHeaders || {},
          signal: run.signal,
          onProgress: event => {
            const progress = event.progress ?? 0;
            updateRunMessages(run, prev => prev.map(message => message.id === progressMsgId ? {
              ...message,
              content: event.message || message.content,
              generationProgress: progress,
              generationStepInfo: {
                step: 'seedance-video',
                progress,
                totalSteps: 4,
                currentStepLabel: event.stage || '视频生成中',
              },
            } : message));
          },
        });
        data = { ...data, ...backgroundResult, success: true };
      }
      if ((response && !response.ok) || !data.success || !data.videoUrl) {
        throw new Error(data.error || '视频模型生成失败');
      }

      const generatedSegments = Array.isArray(data.segments) ? data.segments : [];
      updateRunMessages(run, prev => prev.map(message => message.id === progressMsgId ? {
        ...message,
        content: `${data.recovered ? '已找回并合成' : '已生成'}完整短剧「${agent.title || data.shotTitle || '短剧成片'}」（${data.duration || ''}秒，${data.segmentCount || generatedSegments.length || 1} 段真实视频片段）。`,
        generationStatus: 'completed',
        generationProgress: 100,
        generatedVideo: {
          url: data.videoUrl,
          duration: typeof data.duration === 'number' ? data.duration : undefined,
          prompt: agent.summary || agent.shots?.map(shot => shot.title).join(' / '),
        },
        generationStepInfo: { step: 'seedance-video', progress: 100, totalSteps: 4, currentStepLabel: '30秒成片已生成' },
        quickOptions: ['查看成片', '重做视频', '调整分镜'],
        vimaxAgent: {
          ...agent,
          taskId: typeof data.taskId === 'string' ? data.taskId : agent.taskId,
          phase: 'video',
          videoTaskId: typeof data.backgroundTaskId === 'string' ? data.backgroundTaskId : agent.videoTaskId,
          model: data.model || requestHeaders?.['x-yh-video-model'] || 'doubao-seedance-1.5-pro',
          costState: 'incurred',
          nextAction: '完整短剧已生成，可下载、复用或调整分镜后重做。',
          shots: (agent.shots || []).map((shot, index) => {
            const segment = generatedSegments.find((item: { shotIndex?: number }) => Number(item.shotIndex) === shot.index) || generatedSegments[index];
            return segment?.videoUrl
              ? { ...shot, videoUrl: segment.videoUrl as string, status: 'video' as const }
              : shot;
          }),
        },
      } : message));
    } catch (error) {
      if (!runCoordinator.isCurrent(run)) return;
      if (isUnauthorized(error)) onAuthenticationRequired?.('当前成片生成需要登录后继续，分镜与参考素材已保留。');
      updateRunMessages(run, prev => prev.map(message => message.id === progressMsgId ? {
        ...message,
        content: isUnauthorized(error)
          ? '当前成片生成需要登录后继续，分镜与参考素材已保留。'
          : `视频生成失败：${error instanceof Error ? error.message : '未知错误'}\n可调整分镜或连续性约束后重试。`,
        generationStatus: 'failed',
        generationProgress: 100,
        generationStepInfo: { step: 'seedance-video', progress: 100, totalSteps: 4, currentStepLabel: recoverCompleted ? '片段恢复失败' : '视频生成失败' },
        quickOptions: requestHeaders?.['x-yh-video-provider'] === 'happyhorse-dashscope'
          || requestHeaders?.['x-yh-provider'] === 'happyhorse-dashscope'
          ? ['找回已完成片段', '调整分镜']
          : ['调整分镜'],
        vimaxAgent: {
          ...agent,
          phase: 'video',
          videoTaskId: activeVideoTaskIdRef.current || agent.videoTaskId,
          costState: 'blocked',
          nextAction: '修正视频模型配置或参考素材后重试。',
        },
      } : message));
    } finally {
      activeVideoTaskIdRef.current = null;
      if (runCoordinator.finish(run)) setIsLoading(false);
    }
  }, [messagesRef, onAuthenticationRequired, requestHeaders, runCoordinator, setMessages, setIsLoading, updateRunMessages]);

  const cancelCurrentRun = useCallback(() => {
    const currentRun = runCoordinator.current();
    const cancelled = runCoordinator.cancel({ abort: currentRun?.phase !== 'plan' });
    if (!cancelled) return false;
    if (cancelled.phase === 'plan') {
      pendingPlanningCancelRef.current = true;
      const taskId = activePlanningTaskIdRef.current;
      if (taskId) {
        void clientApiRequest(`/api/tasks/${encodeURIComponent(taskId)}`, {
          method: 'DELETE',
          headers: requestHeaders,
          redirectOnUnauthorized: false,
        }).catch(() => undefined);
      }
    }
    if (cancelled.phase === 'reference_assets') {
      const knownReferenceTaskId = activeReferenceTaskIdRef.current;
      const parentTaskId = [...messagesRef.current].reverse()
        .find(message => message.id === cancelled.messageId || message.vimaxAgent?.phase === 'reference_assets')
        ?.vimaxAgent?.taskId;
      activeReferenceTaskIdRef.current = null;
      void (async () => {
        let referenceTaskId = knownReferenceTaskId;
        if (!referenceTaskId && parentTaskId) {
          const parentResponse = await clientApiRequest(`/api/tasks/${encodeURIComponent(parentTaskId)}`, {
            headers: requestHeaders,
            redirectOnUnauthorized: false,
          }).catch(() => null);
          const parentPayload = await parentResponse?.json().catch(() => ({})) as {
            task?: { result?: { vimaxReferenceTaskId?: string } };
          } | undefined;
          referenceTaskId = parentPayload?.task?.result?.vimaxReferenceTaskId || null;
        }
        if (!referenceTaskId) return;
        await clientApiRequest(`/api/tasks/${encodeURIComponent(referenceTaskId)}`, {
          method: 'DELETE',
          headers: requestHeaders,
          redirectOnUnauthorized: false,
        }).catch(() => undefined);
      })();
    }
    if (cancelled.phase === 'video') {
      const knownVideoTaskId = activeVideoTaskIdRef.current;
      const parentTaskId = [...messagesRef.current].reverse()
        .find(message => message.id === cancelled.messageId || message.vimaxAgent?.phase === 'video')
        ?.vimaxAgent?.taskId;
      activeVideoTaskIdRef.current = null;
      void (async () => {
        let videoTaskId = knownVideoTaskId;
        if (!videoTaskId && parentTaskId) {
          const parentResponse = await clientApiRequest(`/api/tasks/${encodeURIComponent(parentTaskId)}`, {
            headers: requestHeaders,
            redirectOnUnauthorized: false,
          }).catch(() => null);
          const parentPayload = await parentResponse?.json().catch(() => ({})) as {
            task?: { result?: { vimaxVideoTaskId?: string } };
          } | undefined;
          videoTaskId = parentPayload?.task?.result?.vimaxVideoTaskId || null;
        }
        if (!videoTaskId) return;
        await clientApiRequest(`/api/tasks/${encodeURIComponent(videoTaskId)}`, {
          method: 'DELETE',
          headers: requestHeaders,
          redirectOnUnauthorized: false,
        }).catch(() => undefined);
      })();
    }
    setMessages(current => current.map(message => message.id === cancelled.messageId ? {
      ...message,
      content: cancelled.phase === 'reference_assets'
        ? `${message.content}\n已取消本次参考图生成；分镜、项目素材和已保存结果均已保留。`
        : cancelled.phase === 'video'
          ? `${message.content}\n已取消本次成片任务；已完成片段、分镜和参考素材均已保留。`
          : `${message.content}\n已取消本次规划；原输入、参考素材和项目已保留，可重新生成。`,
      generationStatus: 'failed',
      quickOptions: cancelled.phase === 'reference_assets'
        ? ['仅重试缺失参考图', '调整分镜']
        : cancelled.phase === 'video'
          ? ['找回已完成片段', '调整分镜']
          : ['重新生成'],
    } : message));
    setIsLoading(false);
    return true;
  }, [messagesRef, requestHeaders, runCoordinator, setIsLoading, setMessages]);

  return { handlePlanStep, handleReferenceAssetsStep, handleVideoStep, cancelCurrentRun };
}
