import type { ChatHistoryEntry, ChatMessage } from '@/lib/smart-assistant-panel-model';
import type { VimaxProductionPlan } from './vimax-production-plan';

type UnknownRecord = Record<string, unknown>;

export interface RecoveredVimaxTaskProject {
  project: ChatHistoryEntry;
  messages: ChatMessage[];
}

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const number = (value: unknown, fallback = 0) => Number.isFinite(value) ? Number(value) : fallback;

export function shouldMountVimaxTaskBackedControls(
  message: Pick<ChatMessage, 'generatedVideo' | 'generationStatus'>,
): boolean {
  return message.generationStatus === 'completed' && !text(message.generatedVideo?.url);
}

export function needsPersistedVimaxRenderRecovery(task: unknown): boolean {
  if (!isRecord(task) || text(task.status) !== 'completed') return false;
  const result = isRecord(task.result) ? task.result : null;
  if (!result || readLockedVideo(result)) return false;
  const video = isRecord(result.vimaxVideoResult) ? result.vimaxVideoResult : null;
  return Boolean(
    isRecord(result.productionPlan)
    && isRecord(result.productionProject)
    && isRecord(result.assemblyPlan)
    && text(video?.videoUrl),
  );
}

export function applyRecoveredVimaxProductionPlan(task: unknown, productionPlan: unknown): unknown {
  if (!isRecord(task) || !isRecord(task.result) || !isRecord(productionPlan)) return task;
  return {
    ...task,
    result: {
      ...task.result,
      productionPlan,
    },
  };
}

export function normalizeRecoveredVimaxCompletedPlan(plan: VimaxProductionPlan): VimaxProductionPlan {
  if (plan.governance.status !== 'delivery-ready' || plan.render.status !== 'completed') return plan;
  return {
    ...plan,
    checkpoints: plan.checkpoints.map(checkpoint => ({
      ...checkpoint,
      status: checkpoint.status === 'skipped' ? 'skipped' : 'completed',
    })),
  };
}

function readLockedVideo(result: UnknownRecord) {
  const productionPlan = isRecord(result.productionPlan) ? result.productionPlan : null;
  const render = productionPlan && isRecord(productionPlan.render) ? productionPlan.render : null;
  const continuity = productionPlan && isRecord(productionPlan.continuity) ? productionPlan.continuity : null;
  const locked = render && isRecord(render.lastSuccessfulResult) ? render.lastSuccessfulResult : null;
  const video = isRecord(result.vimaxVideoResult) ? result.vimaxVideoResult : null;
  const artifactVersion = text(locked?.artifactVersion);
  const currentRevision = text(continuity?.artifactRevision);
  const lockedUrl = text(locked?.videoUrl);
  const videoUrl = text(video?.videoUrl);
  if (!productionPlan || !video || !lockedUrl || lockedUrl !== videoUrl) return null;
  if (currentRevision && artifactVersion !== currentRevision) return null;
  return {
    productionPlan: normalizeRecoveredVimaxCompletedPlan(productionPlan as unknown as VimaxProductionPlan),
    video,
    videoUrl,
  };
}

function readReferenceResult(result: UnknownRecord) {
  const productionPlan = isRecord(result.productionPlan) ? result.productionPlan : null;
  const plan = isRecord(result.vimaxPlan) ? result.vimaxPlan : null;
  const rawReferences = Array.isArray(result.vimaxReferenceAssets)
    ? result.vimaxReferenceAssets.filter(item => isRecord(item) && text(item.url))
    : [];
  if (!productionPlan || !plan || rawReferences.length === 0) return null;
  const uniqueReferences = [...new Map(rawReferences.map(item => [text(item.url), item])).values()];
  const planShots = Array.isArray(plan.shots) ? plan.shots.filter(isRecord) : [];
  const hasShotMetadata = uniqueReferences.some(item => text(item.kind) === 'shot' && number(item.shotIndex, 0) > 0);
  const references = !hasShotMetadata && planShots.length > 0 && uniqueReferences.length === planShots.length
    ? uniqueReferences.map((item, index) => ({
        ...item,
        kind: 'shot',
        shotIndex: number(planShots[index]?.index, index + 1),
      }))
    : uniqueReferences;
  const routes = Array.isArray(productionPlan.providerRoutes)
    ? productionPlan.providerRoutes.filter(isRecord)
    : [];
  const imageRoute = routes.find(route => text(route.stage) === 'reference_assets');
  const completedShotIndices = new Set(references.flatMap(item => {
    const shotIndex = number(item.shotIndex, 0);
    return text(item.kind) === 'shot' && shotIndex > 0 ? [shotIndex] : [];
  }));
  const missingShotIndices = planShots.flatMap((shot, index) => {
    const shotIndex = number(shot.index, index + 1);
    return completedShotIndices.has(shotIndex) ? [] : [shotIndex];
  });
  return {
    productionPlan: productionPlan as unknown as VimaxProductionPlan,
    plan,
    references,
    missingShotIndices,
    imageModel: text(imageRoute?.model) || '图像模型',
  };
}

export function recoverVimaxTaskProject(task: unknown): RecoveredVimaxTaskProject | null {
  if (!isRecord(task)) return null;
  const status = text(task.status);
  const taskId = text(task.id);
  const config = isRecord(task.config) ? task.config : {};
  if (!taskId) return null;
  if (
    (status === 'cancelled' || status === 'failed')
    && text(config.workflow) === 'vimax-agent'
    && text(config.phase) === 'plan'
  ) {
    const prompt = text(config.prompt) || '继续短剧规划';
    const createdAt = number(task.createdAt, Date.now());
    const cancelled = status === 'cancelled';
    const messages: ChatMessage[] = [{
      id: `${taskId}:prompt`,
      role: 'user',
      content: prompt,
      timestamp: createdAt,
    }, {
      id: `${taskId}:planning-${status}`,
      role: 'assistant',
      content: cancelled
        ? '本次规划已取消。原输入、参考素材和项目均已保留，可重新生成。'
        : '本次规划未完成。原输入、参考素材和项目均已保留，可重新生成。',
      timestamp: number(task.lastUpdatedAt, createdAt),
      generationStatus: 'failed',
      generationProgress: 100,
      generationType: 'storyboard',
      generationStepInfo: {
        step: 'vimax-agent-plan',
        progress: 100,
        totalSteps: 4,
        currentStepLabel: cancelled ? '规划已取消' : '规划失败',
      },
      quickOptions: ['重新生成'],
      vimaxAgent: {
        phase: 'plan',
        title: '短剧制作计划',
        summary: prompt,
        model: text(config.model) || '规划模型',
        costState: 'blocked',
        nextAction: '重新生成只会启动一次新的规划，不会进入参考图或视频阶段。',
        taskId,
      },
    }];
    return {
      project: {
        id: `task:${taskId}`,
        title: prompt.slice(0, 30) || '短剧规划',
        time: number(task.lastUpdatedAt, createdAt),
        messages,
        params: { recoveredTaskId: taskId },
      },
      messages,
    };
  }
  if (status !== 'completed') return null;
  const result = isRecord(task.result) ? task.result : null;
  if (!result) return null;
  const locked = readLockedVideo(result);
  const referenceResult = locked ? null : readReferenceResult(result);

  const productionProject = isRecord(result.productionProject) ? result.productionProject : {};
  const prompt = text(config.prompt) || text(result.creationPrompt) || '恢复已完成的短剧项目';
  const title = text(productionProject.title) || prompt.slice(0, 30) || '已恢复短剧';
  const createdAt = number(task.createdAt, Date.now());

  if (referenceResult) {
    const planShots = Array.isArray(referenceResult.plan.shots)
      ? referenceResult.plan.shots.filter(isRecord)
      : [];
    const referenceByShot = new Map(referenceResult.references.flatMap(item => {
      const shotIndex = number(item.shotIndex, 0);
      return shotIndex > 0 ? [[shotIndex, text(item.url)] as const] : [];
    }));
    const referencesComplete = referenceResult.missingShotIndices.length === 0;
    const recoveredShotCount = referenceByShot.size;
    const assistant: ChatMessage = {
      id: `${taskId}:references`,
      role: 'assistant',
      content: referencesComplete
        ? `已恢复短剧「${title}」的 ${recoveredShotCount} 张分镜参考图，可继续确认并生成视频。`
        : `已恢复短剧「${title}」并保留 ${recoveredShotCount} 张分镜参考图；镜头 ${referenceResult.missingShotIndices.join('、')} 尚未完成。重试只会生成缺失镜头。`,
      timestamp: number(task.lastUpdatedAt, createdAt),
      generationStatus: referencesComplete ? 'completed' : 'failed',
      generationProgress: 100,
      generationType: 'image',
      generatedImages: referenceResult.references.map((item, index) => ({
        url: text(item.url),
        prompt: text(item.prompt) || undefined,
        label: text(item.label) || `参考素材${index + 1}`,
      })),
      assetType: '分镜',
      quickOptions: referencesComplete
        ? ['确认参考图，继续生成视频', '调整分镜']
        : ['仅重试缺失参考图', '调整分镜', '取消'],
      vimaxAgent: {
        phase: 'reference_assets',
        title,
        summary: text(referenceResult.plan.summary) || prompt,
        model: referenceResult.imageModel,
        costState: 'incurred',
        nextAction: referencesComplete
          ? '确认参考素材后进入视频生成。'
          : `仅重试缺失镜头 ${referenceResult.missingShotIndices.join('、')}。`,
        taskId,
        productionPlan: referenceResult.productionPlan,
        assets: referenceResult.references.map((item, index) => ({
          kind: ['character', 'scene', 'prop', 'shot', 'reference'].includes(text(item.kind))
            ? text(item.kind) as 'character' | 'scene' | 'prop' | 'shot' | 'reference'
            : 'reference',
          label: text(item.label) || `参考素材${index + 1}`,
          prompt: text(item.prompt) || undefined,
          url: text(item.url),
          shotIndex: number(item.shotIndex, 0) || undefined,
          status: 'generated',
        })),
        shots: planShots.map((item, index) => {
          const shotIndex = number(item.index, index + 1);
          const referenceUrl = referenceByShot.get(shotIndex);
          return {
            index: shotIndex,
            title: text(item.title) || `镜头 ${index + 1}`,
            duration: number(item.duration, 5),
            camera: text(item.camera) || '连续镜头',
            prompt: text(item.prompt),
            referenceUrl,
            status: referenceUrl ? 'reference' as const : 'planned' as const,
          };
        }),
      },
    };
    const messages: ChatMessage[] = [{
      id: `${taskId}:prompt`,
      role: 'user',
      content: prompt,
      timestamp: createdAt,
    }, assistant];
    return {
      project: {
        id: `task:${taskId}`,
        title,
        time: number(task.lastUpdatedAt, createdAt),
        messages,
        params: { recoveredTaskId: taskId },
      },
      messages,
    };
  }

  if (!locked) {
    const productionPlan = isRecord(result.productionPlan)
      ? result.productionPlan as unknown as VimaxProductionPlan
      : null;
    const plan = isRecord(result.vimaxPlan) ? result.vimaxPlan : null;
    if (!productionPlan || !plan) return null;
    const planAssets = Array.isArray(plan.assets) ? plan.assets.filter(isRecord) : [];
    const planShots = Array.isArray(plan.shots) ? plan.shots.filter(isRecord) : [];
    const assistant: ChatMessage = {
      id: `${taskId}:planned`,
      role: 'assistant',
      content: `已恢复短剧「${title}」的当前故事与分镜。旧参考图和视频不会复用，请确认当前版本后重新生成。`,
      timestamp: number(task.lastUpdatedAt, createdAt),
      generationStatus: 'completed',
      generationProgress: 100,
      generationType: 'storyboard',
      quickOptions: ['确认计划', '调整分镜', '取消'],
      vimaxAgent: {
        phase: 'plan',
        title,
        summary: text(plan.summary) || prompt,
        model: text(productionPlan.providerRoutes.find(route => route.stage === 'plan')?.model) || '规划模型',
        costState: 'not-yet',
        nextAction: '确认当前故事和分镜后重新生成参考图。',
        taskId,
        productionPlan,
        assets: planAssets.map((item, index) => ({
          kind: ['character', 'scene', 'prop', 'reference'].includes(text(item.kind))
            ? text(item.kind) as 'character' | 'scene' | 'prop' | 'reference'
            : 'reference',
          label: text(item.label) || `素材 ${index + 1}`,
          prompt: text(item.prompt) || undefined,
          status: 'planned',
        })),
        shots: planShots.map((item, index) => ({
          index: number(item.index, index + 1),
          title: text(item.title) || `镜头 ${index + 1}`,
          duration: number(item.duration, 5),
          camera: text(item.camera) || '连续镜头',
          prompt: text(item.prompt),
          status: 'planned',
        })),
      },
    };
    const messages: ChatMessage[] = [{
      id: `${taskId}:prompt`,
      role: 'user',
      content: prompt,
      timestamp: createdAt,
    }, assistant];
    return {
      project: {
        id: `task:${taskId}`,
        title,
        time: number(task.lastUpdatedAt, createdAt),
        messages,
        params: { recoveredTaskId: taskId },
      },
      messages,
    };
  }

  const model = text(locked.video.model) || '视频模型';
  const segments = Array.isArray(locked.video.segments) ? locked.video.segments.filter(isRecord) : [];
  const references = Array.isArray(result.vimaxReferenceAssets) ? result.vimaxReferenceAssets.filter(isRecord) : [];
  const assistant: ChatMessage = {
    id: `${taskId}:result`,
    role: 'assistant',
    content: `已恢复完整短剧「${title}」（${number(locked.video.duration, segments.reduce((sum, item) => sum + number(item.duration), 0))}秒，${segments.length} 段视频片段）。`,
    timestamp: number(task.lastUpdatedAt, createdAt),
    generationStatus: 'completed',
    generationProgress: 100,
    generationType: 'video',
    generatedVideo: {
      url: locked.videoUrl,
      duration: number(locked.video.duration) || undefined,
      prompt,
    },
    quickOptions: ['查看成片', '调整分镜'],
    vimaxAgent: {
      phase: 'video',
      title,
      summary: prompt,
      model,
      costState: 'incurred',
      nextAction: '完整短剧已恢复，可播放、下载或继续编辑。',
      taskId,
      productionPlan: locked.productionPlan,
      assets: references.map((item, index) => ({
        kind: ['character', 'scene', 'prop', 'reference'].includes(text(item.kind))
          ? text(item.kind) as 'character' | 'scene' | 'prop' | 'reference'
          : 'reference',
        label: text(item.label) || `参考素材${index + 1}`,
        url: text(item.url) || undefined,
        status: text(item.url) ? 'generated' : 'planned',
      })),
      shots: segments.map((item, index) => ({
        index: number(item.shotIndex, index + 1),
        title: text(item.shotTitle) || `镜头 ${index + 1}`,
        duration: number(item.duration, 5),
        camera: '连续镜头',
        prompt: text(item.prompt),
        videoUrl: text(item.videoUrl) || undefined,
        status: 'video',
      })),
    },
  };
  const messages: ChatMessage[] = [{
    id: `${taskId}:prompt`,
    role: 'user',
    content: prompt,
    timestamp: createdAt,
  }, assistant];
  const project: ChatHistoryEntry = {
    id: `task:${taskId}`,
    title,
    time: number(task.lastUpdatedAt, createdAt),
    messages,
    params: { recoveredTaskId: taskId },
  };
  return { project, messages };
}
