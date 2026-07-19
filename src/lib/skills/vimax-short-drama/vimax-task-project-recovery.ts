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
  return { productionPlan: productionPlan as unknown as VimaxProductionPlan, video, videoUrl };
}

export function recoverVimaxTaskProject(task: unknown): RecoveredVimaxTaskProject | null {
  if (!isRecord(task) || text(task.status) !== 'completed') return null;
  const taskId = text(task.id);
  const result = isRecord(task.result) ? task.result : null;
  if (!taskId || !result) return null;
  const locked = readLockedVideo(result);
  if (!locked) return null;

  const config = isRecord(task.config) ? task.config : {};
  const productionProject = isRecord(result.productionProject) ? result.productionProject : {};
  const prompt = text(config.prompt) || text(result.creationPrompt) || '恢复已完成的短剧项目';
  const title = text(productionProject.title) || prompt.slice(0, 30) || '已恢复短剧';
  const model = text(locked.video.model) || '视频模型';
  const segments = Array.isArray(locked.video.segments) ? locked.video.segments.filter(isRecord) : [];
  const references = Array.isArray(result.vimaxReferenceAssets) ? result.vimaxReferenceAssets.filter(isRecord) : [];
  const createdAt = number(task.createdAt, Date.now());
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
