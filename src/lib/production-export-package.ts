import type { ProductionAssemblyPlan } from './production-assembly-plan';
import type { ProductionProject } from './production-project';
import { describeStorySegmentCue } from './production-story-segment-contract';
import type { BackgroundTask } from './task-manager';

type ExportAsset = {
  id: string;
  kind: string;
  name: string;
  status: string;
  summary: string;
  videoUrl?: string;
  lastFrameUrl?: string;
  duration?: number | null;
  childTaskId?: string;
  providerTaskId?: string;
  audioCue?: string;
  storyStateCue?: string;
  hasAudio?: boolean;
  audioTrackCount?: number | null;
  audioEventContract?: unknown;
  audioState?: unknown;
  segmentAssetIds?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function deriveStoryStateCue(segment?: ProductionAssemblyPlan['segments'][number]) {
  if (!segment) return undefined;
  if (segment.expectedOutputs.storyStateCue) return segment.expectedOutputs.storyStateCue;
  if (segment.storySegmentContract) return describeStorySegmentCue(segment.storySegmentContract);
  const prompt = typeof segment.prompt === 'string'
    ? segment.prompt.replace(/\s+/g, ' ').slice(0, 120)
    : '';
  return [
    `片段=${segment.index + 1}`,
    `镜头=${segment.shotId}`,
    prompt ? `剧情=${prompt}` : null,
  ].filter(Boolean).join('；');
}

function exportAsset(
  asset: ProductionProject['assets'][number],
  segment?: ProductionAssemblyPlan['segments'][number]
): ExportAsset {
  const metadata = isRecord(asset.metadata) ? asset.metadata : {};
  const storyStateCue = deriveStoryStateCue(segment);
  return {
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    status: asset.status,
    summary: asset.summary,
    videoUrl: asString(metadata.videoUrl),
    lastFrameUrl: asString(metadata.lastFrameUrl),
    duration: asNumber(metadata.duration),
    childTaskId: asString(metadata.childTaskId),
    providerTaskId: asString(metadata.providerTaskId),
    audioCue: asString(metadata.audioCue) || segment?.expectedOutputs.audioCue || segment?.audioState?.audioCue || undefined,
    storyStateCue: asString(metadata.storyStateCue) || storyStateCue || undefined,
    hasAudio: asBoolean(metadata.hasAudio) ?? asBoolean(segment?.expectedOutputs.hasAudio),
    audioTrackCount: asNumber(metadata.audioTrackCount),
    audioEventContract: metadata.audioEventContract || segment?.storySegmentContract?.audioContract?.audioEventContract,
    audioState: metadata.audioState || segment?.audioState,
    segmentAssetIds: Array.isArray(metadata.segmentAssetIds)
      ? metadata.segmentAssetIds.filter((id): id is string => typeof id === 'string')
      : undefined,
  };
}

function segmentForAsset(
  asset: ProductionProject['assets'][number],
  assemblyPlan?: ProductionAssemblyPlan
) {
  if (!assemblyPlan || asset.kind !== 'videoSegment') return undefined;
  const metadata = isRecord(asset.metadata) ? asset.metadata : {};
  const segmentIndex = typeof metadata.segmentIndex === 'number'
    ? metadata.segmentIndex
    : Number(String(asset.id).match(/video-segment-(\d+)/)?.[1] || NaN) - 1;
  const childTaskId = asString(metadata.childTaskId);
  return assemblyPlan.segments.find(segment =>
    segment.index === segmentIndex
    || (childTaskId && segment.expectedOutputs.taskId === childTaskId)
    || segment.id === asString(metadata.segmentId)
  );
}

export function buildProductionCutDraftJson(task: BackgroundTask) {
  const result = isRecord(task.result) ? task.result : {};
  const productionProject = result.productionProject as ProductionProject | undefined;
  if (!productionProject) {
    throw new Error(`任务 ${task.id} 缺少 productionProject，无法导出制作草稿`);
  }

  const assemblyPlan = result.assemblyPlan as ProductionAssemblyPlan | undefined;
  const assets = productionProject.assets.map(asset => exportAsset(asset, segmentForAsset(asset, assemblyPlan)));
  const finalVideos = assets.filter(asset => asset.kind === 'finalVideo' && asset.videoUrl);
  const videoSegments = assets.filter(asset => asset.kind === 'videoSegment' && asset.videoUrl);

  return {
    version: 'yh-cut-draft-json-v1',
    generatedAt: new Date().toISOString(),
    reference: {
      primary: 'ArcReel',
      adaptedIdeas: [
        '将分段生成结果和最终成片导出为可复核草稿包',
        '保留失败恢复、片段状态和素材引用，便于后续剪辑工程接入',
      ],
      secondary: ['Toonflow-app', 'ViMAX'],
    },
    task: {
      id: task.id,
      type: task.type,
      status: task.status,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      prompt: task.config?.prompt,
      duration: task.config?.duration,
      ratio: task.config?.ratio,
      resolution: task.config?.resolution,
    },
    project: {
      id: productionProject.id,
      title: productionProject.title,
      duration: productionProject.duration,
      ratio: productionProject.ratio,
      style: productionProject.style,
      narrativeSummary: productionProject.narrativeSummary,
      storyBible: productionProject.storyBible,
      stages: productionProject.stages,
    },
    storyboard: productionProject.storyboard,
    assets: {
      finalVideos,
      videoSegments,
      all: assets,
    },
    assemblyPlan: assemblyPlan
      ? {
          version: assemblyPlan.version,
          status: assemblyPlan.status,
          totalDuration: assemblyPlan.totalDuration,
          segmentCount: assemblyPlan.segmentCount,
          assembly: assemblyPlan.assembly,
          recovery: assemblyPlan.recovery,
          segments: assemblyPlan.segments.map(segment => ({
            id: segment.id,
            index: segment.index,
            shotId: segment.shotId,
            duration: segment.duration,
            status: segment.status,
            error: segment.error,
            expectedInputs: segment.expectedInputs,
            expectedOutputs: segment.expectedOutputs,
            audioState: segment.audioState,
            storyStateCue: deriveStoryStateCue(segment),
            audioCue: segment.expectedOutputs.audioCue || segment.audioState?.audioCue,
            storyContinuityPrompt: segment.expectedInputs.storyContinuityPrompt,
            audioContinuityPrompt: segment.expectedInputs.audioContinuityPrompt,
          })),
        }
      : null,
    exportReadiness: {
      hasFinalVideo: finalVideos.length > 0,
      completedSegmentCount: videoSegments.length,
      canOpenInCanvas: true,
      nextFormat: 'jianying-draft-zip',
      warnings: [
        finalVideos.length > 0 ? null : '缺少 finalVideo，当前只能导出片段草稿',
        assemblyPlan ? null : '缺少 assemblyPlan，无法记录完整片段恢复状态',
      ].filter(Boolean),
    },
  };
}
