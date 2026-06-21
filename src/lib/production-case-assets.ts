import { getAllTasksFresh, type BackgroundTask } from '@/lib/task-manager';

export interface ProductionCaseAsset {
  id: string;
  title: string;
  type: string;
  taskId: string;
  projectId: string;
  projectTitle: string;
  segmentId: string;
  shotId?: string;
  videoUrl: string;
  posterUrl: string;
  durationSeconds: number | null;
  durationLabel: string;
  createdAt: number;
  source: 'productionProject.assets.videoSegment' | 'productionProject.assets.finalVideo';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return '00:00';
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remain = rounded % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

function classifyCaseType(text: string) {
  if (/最终成片|成片|final/i.test(text)) return '真实成片资产';
  if (/营销|广告|增长|市场|品牌|投放/.test(text)) return '真实片段资产';
  if (/二次元|动漫|调律|冒险|幻想|开放世界/.test(text)) return '真实片段资产';
  if (/短剧|剧场|录像带|悬疑|便利店/.test(text)) return '真实片段资产';
  return '真实片段资产';
}

function fallbackPosterFor(text: string) {
  if (/营销|广告|增长|市场|品牌/.test(text)) return '/home/huiying-ad-perfume.png';
  if (/二次元|动漫|调律|冒险|幻想/.test(text)) return '/home/huiying-hero-cosmic-reel-v2.png';
  if (/短剧|剧场|录像带|悬疑|便利店/.test(text)) return '/home/huiying-story-aware-10s-poster.jpg';
  return '/home/huiying-hero-cinematic-flow.png';
}

function collectTaskCases(task: BackgroundTask): ProductionCaseAsset[] {
  const result = isRecord(task.result) ? task.result : {};
  const project = isRecord(result.productionProject) ? result.productionProject : null;
  if (!project || !Array.isArray(project.assets)) return [];

  const projectTitle = asString(project.title) || task.config?.prompt || '制作项目';
  const projectId = asString(project.id) || task.id;
  let videoSegmentIndex = 0;

  return project.assets.flatMap((rawAsset) => {
    if (!isRecord(rawAsset)) return [];
    if ((rawAsset.kind !== 'videoSegment' && rawAsset.kind !== 'finalVideo') || !isRecord(rawAsset.metadata)) return [];
    const metadata = rawAsset.metadata;
    const videoUrl = asString(metadata.videoUrl);
    if (!videoUrl) return [];

    const isFinalVideo = rawAsset.kind === 'finalVideo';
    if (!isFinalVideo) videoSegmentIndex += 1;
    const assetId = asString(rawAsset.id) || (isFinalVideo ? `${task.id}-final-video` : `${task.id}-video-segment-${videoSegmentIndex}`);
    const assetName = asString(rawAsset.name) || (isFinalVideo ? '最终成片' : `视频片段 ${videoSegmentIndex}`);
    const segmentId = asString(metadata.segmentId) || assetId;
    const shotId = asString(metadata.shotId);
    const durationSeconds = asNumber(metadata.duration);
    const titleBase = projectTitle || assetName;
    const title = isFinalVideo ? `${titleBase.slice(0, 18)} · 成片` : `${titleBase.slice(0, 18)} · 片段 ${videoSegmentIndex}`;
    const textForClassify = `${projectTitle} ${task.config?.prompt || ''} ${assetName}`;

    return [{
      id: `${task.id}:${assetId}`,
      title,
      type: classifyCaseType(textForClassify),
      taskId: task.id,
      projectId,
      projectTitle,
      segmentId,
      shotId,
      videoUrl,
      posterUrl: asString(metadata.lastFrameUrl) || fallbackPosterFor(textForClassify),
      durationSeconds,
      durationLabel: formatDuration(durationSeconds),
      createdAt: task.completedAt || task.createdAt,
      source: isFinalVideo ? 'productionProject.assets.finalVideo' as const : 'productionProject.assets.videoSegment' as const,
    }];
  });
}

export function listProductionCaseAssets(options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(options.limit || 12, 50));
  const cases = getAllTasksFresh()
    .flatMap(collectTaskCases)
    .sort((a, b) => {
      if (a.source !== b.source) {
        return a.source === 'productionProject.assets.finalVideo' ? -1 : 1;
      }
      return b.createdAt - a.createdAt;
    });

  return cases.slice(0, limit);
}
