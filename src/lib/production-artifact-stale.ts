import type { ProductionAssemblyPlan, ProductionSegmentPlan } from './production-assembly-plan';
import type { ProductionAssetKind, ProductionProject } from './production-project';

export interface ProductionArtifactReadiness {
  version: 'yh-artifact-readiness-v1';
  sourceRevision: string;
  stale: boolean;
  staleReason: string | null;
  staleFromSegmentIndex: number | null;
  checkedAt: string;
  blockers: string[];
}

export interface MarkAssemblyPlanStaleParams {
  productionProject: ProductionProject;
  assemblyPlan?: ProductionAssemblyPlan | null;
  changedAssetIds?: string[];
  changedShotIds?: string[];
  reason: 'asset-writeback' | 'storyboard-shot-writeback' | 'project-revision';
}

export interface MarkAssemblyPlanStaleResult {
  assemblyPlan?: ProductionAssemblyPlan;
  changed: boolean;
  staleFromSegmentIndex: number | null;
  staleSegmentCount: number;
  sourceRevision: string;
}

function compact(value: unknown) {
  return String(value || '').trim();
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const storyPlanningAssetKinds = new Set<ProductionAssetKind>([
  'script',
  'character',
  'scene',
  'prop',
  'storyboard',
]);

export function isStoryPlanningAssetKind(kind: ProductionAssetKind) {
  return storyPlanningAssetKinds.has(kind);
}

export function computeProductionArtifactRevision(project: ProductionProject) {
  const assetState = project.assets
    .filter(asset => isStoryPlanningAssetKind(asset.kind))
    .map(asset => [
      asset.id,
      asset.kind,
      asset.name,
      asset.status,
      asset.summary,
      JSON.stringify(asset.metadata || {}),
    ].map(compact).join(':'))
    .sort()
    .join('|');
  const shotState = project.storyboard.shots
    .map(shot => [
      shot.id,
      shot.index,
      shot.duration,
      shot.storyBeat,
      shot.dramaticPurpose,
      shot.emotionShift,
      shot.prompt,
      shot.subtitleText,
      shot.narrationText,
      shot.status,
    ].map(compact).join(':'))
    .join('|');
  return `rev-${stableHash([
    project.id,
    project.prompt,
    project.style,
    project.ratio,
    project.sceneType,
    project.storyBible.premise,
    project.storyBible.conflict,
    assetState,
    shotState,
  ].map(compact).join('||'))}`;
}

export function freshArtifactReadiness(project: ProductionProject): ProductionArtifactReadiness {
  return {
    version: 'yh-artifact-readiness-v1',
    sourceRevision: computeProductionArtifactRevision(project),
    stale: false,
    staleReason: null,
    staleFromSegmentIndex: null,
    checkedAt: new Date().toISOString(),
    blockers: [],
  };
}

function segmentUsesChangedAsset(segment: ProductionSegmentPlan, changedAssetIds: Set<string>) {
  if (changedAssetIds.size === 0) return false;
  const deps = segment.dependencies;
  return [
    deps.scriptAssetId,
    ...deps.characterAssetIds,
    ...deps.sceneAssetIds,
    ...deps.propAssetIds,
  ].some(assetId => assetId && changedAssetIds.has(assetId));
}

function firstAffectedSegmentIndex(
  assemblyPlan: ProductionAssemblyPlan,
  changedAssetIds: string[],
  changedShotIds: string[],
) {
  const assetIds = new Set(changedAssetIds);
  const shotIds = new Set(changedShotIds);
  const affected = assemblyPlan.segments
    .filter(segment => shotIds.has(segment.shotId) || segmentUsesChangedAsset(segment, assetIds))
    .map(segment => segment.index);
  if (affected.length === 0 && (assetIds.size > 0 || shotIds.size > 0)) return 0;
  if (affected.length === 0) return null;
  return Math.min(...affected);
}

function markSegmentStale(
  segment: ProductionSegmentPlan,
  sourceRevision: string,
  staleFromSegmentIndex: number,
  reason: MarkAssemblyPlanStaleParams['reason'],
): ProductionSegmentPlan {
  if (segment.index < staleFromSegmentIndex) return segment;
  return {
    ...segment,
    status: 'queued',
    error: `上游 ${reason} 已改变，片段产物 stale，需要重新通过合约后再生成。`,
    expectedInputs: {
      ...segment.expectedInputs,
      firstFrameUrl: segment.index === 0 ? null : segment.expectedInputs.firstFrameUrl,
      previousLastFrameUrl: segment.index === 0 ? null : segment.expectedInputs.previousLastFrameUrl,
    },
    expectedOutputs: {
      ...segment.expectedOutputs,
      videoUrl: null,
      lastFrameUrl: null,
      providerTaskId: null,
      hasAudio: null,
    },
    artifactReadiness: {
      version: 'yh-artifact-readiness-v1',
      sourceRevision,
      stale: true,
      staleReason: reason,
      staleFromSegmentIndex,
      checkedAt: new Date().toISOString(),
      blockers: ['artifact-stale-after-project-writeback'],
    },
  };
}

export function markAssemblyPlanStaleForProjectChange(
  params: MarkAssemblyPlanStaleParams
): MarkAssemblyPlanStaleResult {
  const sourceRevision = computeProductionArtifactRevision(params.productionProject);
  const assemblyPlan = params.assemblyPlan || undefined;
  if (!assemblyPlan) {
    return {
      changed: false,
      staleFromSegmentIndex: null,
      staleSegmentCount: 0,
      sourceRevision,
    };
  }

  const staleFromSegmentIndex = firstAffectedSegmentIndex(
    assemblyPlan,
    params.changedAssetIds || [],
    params.changedShotIds || [],
  );
  if (staleFromSegmentIndex === null) {
    return {
      assemblyPlan,
      changed: false,
      staleFromSegmentIndex: null,
      staleSegmentCount: 0,
      sourceRevision,
    };
  }

  const segments = assemblyPlan.segments.map(segment =>
    markSegmentStale(segment, sourceRevision, staleFromSegmentIndex, params.reason)
  );
  const staleSegmentCount = segments.filter(segment => segment.artifactReadiness?.stale).length;

  return {
    assemblyPlan: {
      ...assemblyPlan,
      status: 'planned',
      readiness: {
        ...assemblyPlan.readiness,
        pass: false,
        checkedAt: new Date().toISOString(),
        blockerCount: assemblyPlan.readiness.blockerCount + 1,
        issues: [
          ...assemblyPlan.readiness.issues,
          {
            code: 'artifact-stale-after-project-writeback',
            severity: 'blocker',
            segmentIndex: staleFromSegmentIndex,
            message: `第 ${staleFromSegmentIndex + 1} 段及后续片段因 ${params.reason} 失效，需要重新生成合约和视频产物。`,
          },
        ],
        nextAction: '先重新生成 assemblyPlan/StorySegmentContract，再启动片段视频；禁止复用 stale 视频、尾帧或声音 cue。',
      },
      recovery: {
        ...assemblyPlan.recovery,
        resumeFromSegmentIndex: staleFromSegmentIndex,
      },
      segments,
      nextAction: '项目资产或分镜已变更，当前 assemblyPlan 已标记 stale；重新生成分段合约后再继续。',
    },
    changed: true,
    staleFromSegmentIndex,
    staleSegmentCount,
    sourceRevision,
  };
}
