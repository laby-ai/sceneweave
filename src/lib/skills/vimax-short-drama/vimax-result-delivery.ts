import type { ChatMessage } from '@/lib/smart-assistant-panel-model';

export type VimaxDeliveryStageId = 'plan' | 'storyboard' | 'reference' | 'video';
export type VimaxDeliveryStageState = 'pending' | 'active' | 'completed' | 'failed';

export interface VimaxDeliveryStage {
  id: VimaxDeliveryStageId;
  label: string;
  state: VimaxDeliveryStageState;
}

export interface VimaxDeliveryDownload {
  kind: 'image' | 'video';
  label: string;
  url: string;
  filename: string;
}

export interface VimaxDeliveryInventoryItem {
  kind: string;
  label: string;
  status: 'planned' | 'generated' | 'blocked';
  url?: string;
}

export interface VimaxResultIterationContext {
  sourceMessageId: string;
  sourcePrompt: string;
  sourceTitle: string;
  nextAttempt: number;
}

export function resolveVimaxResultIteration(
  messages: ChatMessage[],
  sourceMessageId: string,
): VimaxResultIterationContext | null {
  const sourceIndex = messages.findIndex(message => message.id === sourceMessageId);
  if (sourceIndex < 0) return null;
  const source = messages[sourceIndex];
  if (source.role !== 'assistant' || source.generationStatus !== 'completed' || !source.vimaxAgent) return null;
  const sourcePrompt = [...messages.slice(0, sourceIndex)].reverse().find(message => message.role === 'user')?.content.trim();
  if (!sourcePrompt) return null;
  const completedAttempts = messages.slice(0, sourceIndex + 1).filter(message => message.role === 'assistant'
    && message.generationStatus === 'completed'
    && Boolean(message.vimaxAgent)).length;
  return { sourceMessageId, sourcePrompt, sourceTitle: source.vimaxAgent.title, nextAttempt: completedAttempts + 1 };
}

export function buildVimaxContinueEditPrompt(context: VimaxResultIterationContext): string {
  return `基于上一版「${context.sourceTitle}」继续修改：\n原始需求：${context.sourcePrompt}\n\n修改要求：`;
}

function isSafeResultUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function extensionFor(url: string, fallback: string) {
  try {
    const match = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
    return match?.[1]?.toLowerCase() || fallback;
  } catch {
    return fallback;
  }
}

function stageState(
  message: ChatMessage,
  id: VimaxDeliveryStageId,
  completed: boolean,
): VimaxDeliveryStageState {
  if (completed) return 'completed';
  const agent = message.vimaxAgent;
  if (!agent) return 'pending';
  const current = id === 'reference' ? 'reference_assets' : id === 'storyboard' ? 'plan' : id;
  if (message.generationStatus === 'failed' && agent.phase === current) return 'failed';
  if (message.generationStatus === 'generating' && agent.phase === current) return 'active';
  return 'pending';
}

export function buildVimaxResultDelivery(message: ChatMessage) {
  const agent = message.vimaxAgent;
  const shots = agent?.shots || [];
  const imageUrls = [
    ...(message.generatedImages || []).map(image => image.url),
    ...(agent?.assets || []).filter(asset => asset.kind === 'reference').map(asset => asset.url),
    ...shots.map(shot => shot.referenceUrl),
  ].filter(isSafeResultUrl);
  const clipUrls = shots.map(shot => shot.videoUrl).filter(isSafeResultUrl);
  const finalVideoUrl = isSafeResultUrl(message.generatedVideo?.url) ? message.generatedVideo.url : undefined;
  const failedVideo = agent?.phase === 'video' && message.generationStatus === 'failed';

  const planCompleted = Boolean(agent && (agent.assets?.length || agent.shots?.length));
  const storyboardCompleted = Boolean(agent?.shots?.length);
  const referenceCompleted = imageUrls.length > 0;
  const videoCompleted = !failedVideo && Boolean(finalVideoUrl || clipUrls.length);

  const stages: VimaxDeliveryStage[] = [
    { id: 'plan', label: '制作计划', state: stageState(message, 'plan', planCompleted) },
    { id: 'storyboard', label: '分镜', state: stageState(message, 'storyboard', storyboardCompleted) },
    { id: 'reference', label: '参考素材', state: stageState(message, 'reference', referenceCompleted) },
    { id: 'video', label: '视频', state: stageState(message, 'video', videoCompleted) },
  ];

  const downloads: VimaxDeliveryDownload[] = [];
  if (finalVideoUrl) {
    downloads.push({
      kind: 'video',
      label: '完整成片',
      url: finalVideoUrl,
      filename: `final-video.${extensionFor(finalVideoUrl, 'mp4')}`,
    });
  }
  clipUrls.forEach((url, index) => {
    downloads.push({
      kind: 'video',
      label: `镜头 ${index + 1}`,
      url,
      filename: `clip-${String(index + 1).padStart(2, '0')}.${extensionFor(url, 'mp4')}`,
    });
  });
  if (downloads.length === 0) {
    [...new Set(imageUrls)].forEach((url, index) => {
      downloads.push({
        kind: 'image',
        label: `参考素材 ${index + 1}`,
        url,
        filename: `${String(index + 1).padStart(2, '0')}-shot-${index + 1}.${extensionFor(url, 'jpg')}`,
      });
    });
  }

  return {
    stages,
    inventory: (agent?.assets || []).filter(asset => asset.kind !== 'shot').map(asset => ({
      kind: asset.kind,
      label: asset.label,
      status: asset.status,
      url: asset.url,
    })) satisfies VimaxDeliveryInventoryItem[],
    downloads,
  };
}

export function createVimaxManifestDataUrl(message: ChatMessage) {
  const agent = message.vimaxAgent;
  const delivery = buildVimaxResultDelivery(message);
  const manifest = {
    schema: 'sceneweave.vimax.delivery.v1',
    project: {
      title: agent?.title || '未命名创作',
      summary: agent?.summary || message.content,
      model: agent?.model,
      phase: agent?.phase,
      generationSettings: agent?.generationSettings,
      costState: agent?.costState,
      nextAction: agent?.nextAction,
    },
    stages: delivery.stages,
    inventory: delivery.inventory,
    storyboard: agent?.shots || [],
    results: {
      images: delivery.downloads.filter(item => item.kind === 'image').map(item => item.url),
      finalVideoUrl: message.generatedVideo?.url,
      clips: (agent?.shots || []).map(shot => shot.videoUrl).filter(isSafeResultUrl),
    },
  };
  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(manifest, null, 2))}`;
}
