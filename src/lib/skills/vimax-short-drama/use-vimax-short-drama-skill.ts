'use client';

import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { genId, type ChatMessage } from '@/lib/smart-assistant-panel-model';

/**
 * ViMAX 短剧制作 = Agent 驱动的一个 skill。
 * 这里把分阶段真实模型链路（plan → reference_assets）从 2500+ 行的 smart-assistant-panel
 * 里抽出来，面板只负责唤起这个 skill，不再承载短剧编排逻辑。
 *
 * 阶段约束（不可放宽）：
 * - plan：真实 Ark AgentPlan / Doubao，失败直接报错，不切假规划、不回退旧 director-chain。
 * - reference_assets：真实 Seedream 5.0 Lite，失败直接报错，不切其他图像模型。
 * - 视频/语音阶段必须用户显式确认费用，这里不触发。
 */

export const VIMAX_REFERENCE_CONFIRM_REGEX = /确认分镜|生成参考图|进入\s*Seedream|参考素材生成/;

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
  segmentDuration?: number;
  segmentCount?: number;
  /** 可选模型覆盖；为空走服务端默认（env）。 */
  model?: string;
}

interface PartialPlan {
  title?: string;
  summary?: string;
  assets: Array<{ kind?: string; label?: string; prompt?: string }>;
  shots: Array<{ index?: number; title?: string; duration?: number; camera?: string; prompt?: string }>;
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
}

export interface VimaxShortDramaSkill {
  handlePlanStep: (context: VimaxPlanContext) => Promise<void>;
  handleReferenceAssetsStep: () => Promise<void>;
  handleVideoStep: () => Promise<void>;
}

export function useVimaxShortDramaSkill(deps: VimaxShortDramaSkillDeps): VimaxShortDramaSkill {
  const { messagesRef, setMessages, setIsLoading, setInputValue, setCurrentStep } = deps;

  const handlePlanStep = useCallback(async (context: VimaxPlanContext) => {
    const prompt = context.prompt;
    const userMsgId = genId();
    const progressMsgId = `vimax-agent-plan-${Date.now()}`;
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
      const planController = new AbortController();
      const planTimeout = setTimeout(() => planController.abort(), 60_000);
      const response = await fetch('/api/smart/vimax-agent-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'plan',
          prompt,
          duration: context.duration,
          ...(context.segmentDuration ? { segmentDuration: context.segmentDuration } : {}),
          ...(context.segmentCount ? { segmentCount: context.segmentCount } : {}),
          style: context.style,
          ratio: '16:9',
          stream: true,
          ...(context.model ? { model: context.model } : {}),
        }),
        signal: planController.signal,
      });
      clearTimeout(planTimeout);

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => '');
        throw new Error('AgentPlan 调用失败：' + (errText.slice(0, 200) || response.statusText));
      }

      // 流式读取 SSE，逐 delta 解析出「已完整的镜头/资产」，逐条渲染成卡片，
      // 绝不把原始 JSON 文本透传到对话气泡里。
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let rawPlanText = '';
      let plan: any = {};
      let assets: any[] = [];
      let shots: any[] = [];
      let planModel = '';
      let streamError = '';

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
              setMessages(prev => prev.map(m => m.id === progressMsgId ? {
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
            } else if (event === 'plan.complete') {
              plan = data.plan || {};
              assets = Array.isArray(plan.assets) ? plan.assets : [];
              shots = Array.isArray(plan.shots) ? plan.shots : [];
              planModel = data.model || '';
            } else if (event === 'plan.error') {
              streamError = data.error || '流式规划失败';
            }
          } catch { /* skip */ }
        }
      }

      if (streamError) throw new Error(streamError);
      if (!plan.title) throw new Error('模型未返回有效的分镜规划。');
      setMessages(prev => prev.map(message => message.id === progressMsgId ? {
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
          costState: 'incurred',
          nextAction: plan.nextAction || '确认分镜后进入 Seedream 参考素材生成。',
          assets: assets.map((asset: { kind?: NonNullable<NonNullable<ChatMessage['vimaxAgent']>['assets']>[number]['kind']; label?: string; prompt?: string }) => ({
            kind: asset.kind || 'reference',
            label: asset.label || '参考素材',
            prompt: asset.prompt || '',
            status: 'planned',
          })),
          shots: shots.map((shot: { index?: number; title?: string; duration?: number; camera?: string; prompt?: string }, index: number) => ({
            index: Number(shot.index) || index + 1,
            title: shot.title || `Clip ${index + 1}`,
            duration: Number(shot.duration) || 6,
            camera: shot.camera || '固定镜头',
            prompt: shot.prompt || '',
            status: 'planned' as const,
          })),
        },
        quickOptions: ['确认分镜，生成参考图', '调整时长和节奏', '补充角色或场景'],
        actions: ['复制', '引用', '修改'],
      } : message));
      setCurrentStep(5);
    } catch (error) {
      setMessages(prev => prev.map(message => message.id === progressMsgId ? {
        ...message,
        content: `规划失败：${error instanceof Error ? error.message : '未知错误'}\n请调整想法后重试。`,
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
      setIsLoading(false);
    }
  }, [setMessages, setIsLoading, setInputValue, setCurrentStep]);

  const handleReferenceAssetsStep = useCallback(async () => {
    const planMessage = [...messagesRef.current].reverse().find(message => message.vimaxAgent?.phase === 'plan' && message.vimaxAgent.assets?.length);
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

    const progressMsgId = `vimax-seedream-${Date.now()}`;
    setIsLoading(true);
    setMessages(prev => [...prev, {
      id: progressMsgId,
      role: 'assistant',
      content: '正在生成参考图…',
      timestamp: Date.now(),
      generationStatus: 'generating',
      generationProgress: 20,
      generationType: 'image',
      generationStepInfo: { step: 'seedream-reference', progress: 20, totalSteps: 4, currentStepLabel: '参考图生成' },
      vimaxAgent: {
        ...plan,
        phase: 'reference_assets',
        costState: 'incurred',
        nextAction: '等待 Seedream 返回参考素材。',
      },
    } as ChatMessage]);

    try {
      const refController = new AbortController();
      const refTimeout = setTimeout(() => refController.abort(), 100_000);
      const response = await fetch('/api/smart/vimax-agent-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'reference_assets',
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
        signal: refController.signal,
      });
      clearTimeout(refTimeout);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Seedream 参考素材生成失败');
      }

      const generatedAssets = Array.isArray(data.assets) ? data.assets : [];
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
      setMessages(prev => prev.map(message => message.id === progressMsgId ? {
        ...message,
        content: `已按分镜生成 ${generatedAssets.length} 张参考图，每张已挂到对应 Clip 下。预览满意后可继续生成视频。`,
        generationStatus: 'completed',
        generationProgress: 100,
        generatedImages: generatedAssets
          .filter((asset: { url?: string }) => typeof asset.url === 'string')
          .map((asset: { url: string; prompt?: string; label?: string }) => ({
            url: asset.url,
            prompt: asset.prompt,
            label: asset.label || '参考素材',
          })),
        assetType: '分镜',
        generationStepInfo: { step: 'seedream-reference', progress: 100, totalSteps: 4, currentStepLabel: '参考图已生成' },
        quickOptions: ['确认参考图，继续生成视频', '重做某张参考图', '补充参考图'],
        vimaxAgent: {
          ...plan,
          phase: 'reference_assets',
          model: data.model || plan.model,
          costState: 'incurred',
          nextAction: '确认参考素材后进入视频模型费用确认。',
          shots: shotsWithRef,
          assets: generatedAssets.map((asset: { kind?: NonNullable<NonNullable<ChatMessage['vimaxAgent']>['assets']>[number]['kind']; label?: string; prompt?: string; url?: string; shotIndex?: number }) => ({
            kind: asset.kind || 'reference',
            label: asset.label || '参考素材',
            prompt: asset.prompt,
            url: asset.url,
            shotIndex: asset.shotIndex,
            status: 'generated',
          })),
        },
      } : message));
    } catch (error) {
      setMessages(prev => prev.map(message => message.id === progressMsgId ? {
        ...message,
        content: `参考图生成失败：${error instanceof Error ? error.message : '未知错误'}\n可调整描述后重试。`,
        generationStatus: 'failed',
        generationProgress: 100,
        generationStepInfo: { step: 'seedream-reference', progress: 100, totalSteps: 4, currentStepLabel: '参考图失败' },
        vimaxAgent: {
          ...plan,
          phase: 'reference_assets',
          costState: 'blocked',
          nextAction: '修正 Seedream 配置或素材 prompt 后重试。',
        },
      } : message));
    } finally {
      setIsLoading(false);
    }
  }, [messagesRef, setMessages, setIsLoading]);

  const handleVideoStep = useCallback(async () => {
    const reversed = [...messagesRef.current].reverse();
    // 真实参考图 URL：优先用 generatedImages（恢复历史后最可靠），回退到 vimaxAgent.assets。
    const refMessage = reversed.find(message => (message.generatedImages || []).some(image => image.url))
      || reversed.find(message => (message.vimaxAgent?.assets || []).some(asset => asset.url));
    // 分镜与标题来源：最近一条带 shots 的 vimaxAgent 消息。
    const planAgent = reversed.find(message => (message.vimaxAgent?.shots || []).length)?.vimaxAgent;
    const referenceUrls = [
      ...((refMessage?.generatedImages || []).map(image => image.url).filter(Boolean)),
      ...((refMessage?.vimaxAgent?.assets || []).map(asset => asset.url).filter((url): url is string => Boolean(url))),
    ];
    if (!referenceUrls.length || !planAgent) {
      setMessages(prev => [...prev, {
        id: genId(),
        role: 'assistant',
        content: '请先完成参考图生成，再生成视频。',
        timestamp: Date.now(),
        generationStatus: 'failed',
        generationStepInfo: { step: 'blocked', progress: 0, totalSteps: 4, currentStepLabel: '需要先生成参考图' },
      }]);
      return;
    }
    const agent = planAgent;

    const progressMsgId = `vimax-video-${Date.now()}`;
    setIsLoading(true);
    setMessages(prev => [...prev, {
      id: progressMsgId,
      role: 'assistant',
      content: '正在调用 Seedance 生成 30 秒完整短剧，预计 4-10 分钟…',
      timestamp: Date.now(),
      generationStatus: 'generating',
      generationProgress: 30,
      generationType: 'video',
      generationStepInfo: { step: 'seedance-video', progress: 30, totalSteps: 4, currentStepLabel: '视频生成中' },
      vimaxAgent: {
        ...agent,
        phase: 'video',
        costState: 'incurred',
        nextAction: '等待 Seedance 返回成片。',
      },
    } as ChatMessage]);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 900_000);
      const response = await fetch('/api/smart/vimax-agent-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'video',
          confirm: true,
          ratio: '16:9',
          resolution: '720p',
          plan: {
            title: agent.title,
            summary: agent.summary,
            shots: (agent.shots || []).map(shot => ({
              index: shot.index,
              title: shot.title,
              duration: shot.duration,
              camera: shot.camera,
              prompt: shot.prompt,
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
          assets: referenceUrls.map((url, index) => ({
            kind: 'reference' as const,
            label: `参考素材${index + 1}`,
            prompt: '',
            url,
          })),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.videoUrl) {
        throw new Error(data.error || 'Seedance 视频生成失败');
      }

      const generatedSegments = Array.isArray(data.segments) ? data.segments : [];
      setMessages(prev => prev.map(message => message.id === progressMsgId ? {
        ...message,
        content: `已生成完整短剧「${agent.title || data.shotTitle || '短剧成片'}」（${data.duration || ''}秒，${data.segmentCount || generatedSegments.length || 1} 段真实 Seedance 片段已合成）。`,
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
          phase: 'video',
          model: data.model || 'doubao-seedance-1.5-pro',
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
      setMessages(prev => prev.map(message => message.id === progressMsgId ? {
        ...message,
        content: `视频生成失败：${error instanceof Error ? error.message : '未知错误'}\n可调整分镜或参考图后重试。`,
        generationStatus: 'failed',
        generationProgress: 100,
        generationStepInfo: { step: 'seedance-video', progress: 100, totalSteps: 4, currentStepLabel: '视频生成失败' },
        vimaxAgent: {
          ...agent,
          phase: 'video',
          costState: 'blocked',
          nextAction: '修正 Seedance 配置或参考素材后重试。',
        },
      } : message));
    } finally {
      setIsLoading(false);
    }
  }, [messagesRef, setMessages, setIsLoading]);

  return { handlePlanStep, handleReferenceAssetsStep, handleVideoStep };
}
