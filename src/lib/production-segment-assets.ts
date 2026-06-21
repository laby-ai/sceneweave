import type { ProductionAssemblyPlan, ProductionSegmentPlan } from './production-assembly-plan';
import type { BoundaryBridgePlan } from './trailer-beat-sheet';
import type { ProductionAsset, ProductionGraphEdge, ProductionProject } from './production-project';
import {
  describeStorySegmentCue,
  patchStorySegmentContractInputs,
} from './production-story-segment-contract';
import type { DAGNode } from './video-production/types';

type SegmentPatchStatus = ProductionSegmentPlan['status'];

export interface SegmentAssetWritebackPatch {
  status: SegmentPatchStatus;
  error?: string | null;
  startedAt?: string;
  completedAt?: string;
  expectedInputs?: Partial<ProductionSegmentPlan['expectedInputs']>;
  expectedOutputs?: Partial<ProductionSegmentPlan['expectedOutputs']>;
}

export interface SegmentAssetWritebackParams {
  productionProject?: ProductionProject | null;
  assemblyPlan: ProductionAssemblyPlan;
  segmentIndex: number;
  patch: SegmentAssetWritebackPatch;
}

export interface SegmentAssetWritebackResult {
  productionProject?: ProductionProject;
  assemblyPlan: ProductionAssemblyPlan;
  completedSegmentCount: number;
  failedSegmentCount: number;
}

function updateSegment(
  segment: ProductionSegmentPlan,
  patch: SegmentAssetWritebackPatch
): ProductionSegmentPlan {
  return {
    ...segment,
    ...patch,
    expectedInputs: {
      ...segment.expectedInputs,
      ...patch.expectedInputs,
    },
    expectedOutputs: {
      ...segment.expectedOutputs,
      ...patch.expectedOutputs,
    },
  };
}

function deriveAssemblyStatus(segments: ProductionSegmentPlan[]): ProductionAssemblyPlan['status'] {
  const completedCount = segments.filter(segment => segment.status === 'completed').length;
  const failedCount = segments.filter(segment => segment.status === 'failed').length;
  const runningCount = segments.filter(segment => segment.status === 'running').length;

  if (failedCount > 0) return 'failed';
  if (segments.length > 0 && completedCount === segments.length) return 'completed';
  if (runningCount > 0 || completedCount > 0) return 'partial';
  return 'planned';
}

function deriveResumeFromSegmentIndex(segments: ProductionSegmentPlan[]) {
  const failedSegments = segments.filter(segment => segment.status === 'failed');
  if (failedSegments.length > 0) {
    return Math.min(...failedSegments.map(segment => segment.index));
  }
  return segments.filter(segment => segment.status === 'completed').length;
}

function videoSegmentAssetId(segment: ProductionSegmentPlan) {
  return `video-segment-${segment.index + 1}`;
}

function segmentStoryStateCue(segment: ProductionSegmentPlan) {
  return segment.expectedOutputs.storyStateCue
    || (segment.storySegmentContract ? describeStorySegmentCue(segment.storySegmentContract) : null);
}

function updateNextSegmentHandoff(
  segments: ProductionSegmentPlan[],
  completedSegment: ProductionSegmentPlan
): ProductionSegmentPlan[] {
  const lastFrameUrl = completedSegment.expectedOutputs.lastFrameUrl;
  const audioCue = completedSegment.expectedOutputs.audioCue || completedSegment.audioState?.audioCue || null;
  const storyStateCue = segmentStoryStateCue(completedSegment);
  if (completedSegment.status !== 'completed' || (!lastFrameUrl && !audioCue && !storyStateCue)) return segments;

  return segments.map(segment => {
    if (segment.index !== completedSegment.index + 1) return segment;
    const nextInputs = {
      ...segment.expectedInputs,
      firstFrameUrl: lastFrameUrl || segment.expectedInputs.firstFrameUrl,
      previousLastFrameUrl: lastFrameUrl || segment.expectedInputs.previousLastFrameUrl,
      sourceSegmentId: completedSegment.id,
      sourceAssetId: videoSegmentAssetId(completedSegment),
      continuityPrompt: [
        `使用片段 ${completedSegment.index + 1} 的最后一帧作为本段首帧参考。`,
        '开头1-2秒先复现上一段末尾的角色站位、视线方向、手部动作和关键道具状态，再推进新信息。',
      ].join(''),
      previousAudioCue: audioCue,
      audioContinuityPrompt: audioCue
        ? [
            `承接片段 ${completedSegment.index + 1} 的声音状态：${audioCue}`,
            '开头先保持上一段的环境声、角色语气和情绪余韵，再进入本段新的对白/音效。',
          ].join('')
        : segment.expectedInputs.audioContinuityPrompt,
      previousStoryStateCue: storyStateCue,
      storyContinuityPrompt: storyStateCue
        ? [
            `承接片段 ${completedSegment.index + 1} 的故事状态：${storyStateCue}`,
            '开头先复现上一段的目标、冲突、道具状态、情绪和出口画面，再推进本段唯一新信息。',
          ].join('')
        : segment.expectedInputs.storyContinuityPrompt,
      boundaryBridgeId: segment.expectedInputs.boundaryBridgeId,
      boundaryBridgePrompt: segment.expectedInputs.boundaryBridgePrompt
        ? [
            segment.expectedInputs.boundaryBridgePrompt,
            `已取得片段 ${completedSegment.index + 1} 的尾帧，可先生成或校验边界桥接，再启动本段主体。`,
          ].join('\n')
        : segment.expectedInputs.boundaryBridgePrompt,
      bridgeFirstFrameUrl: lastFrameUrl || segment.expectedInputs.bridgeFirstFrameUrl,
      bridgeStrategy: segment.expectedInputs.bridgeStrategy || 'transition-bridge',
    };
    return {
      ...segment,
      expectedInputs: nextInputs,
      storySegmentContract: segment.storySegmentContract
        ? patchStorySegmentContractInputs({
            contract: segment.storySegmentContract,
            firstFrameUrl: nextInputs.firstFrameUrl,
            previousLastFrameUrl: nextInputs.previousLastFrameUrl,
            sourceSegmentId: nextInputs.sourceSegmentId,
            sourceAssetId: nextInputs.sourceAssetId,
            previousAudioCue: nextInputs.previousAudioCue,
            previousStoryStateCue: nextInputs.previousStoryStateCue,
          })
        : segment.storySegmentContract,
    };
  });
}

function cascadeDependentSegmentsAfterFailure(
  segments: ProductionSegmentPlan[],
  failedSegment: ProductionSegmentPlan
): ProductionSegmentPlan[] {
  if (failedSegment.status !== 'failed') return segments;

  return segments.map(segment => {
    if (segment.index <= failedSegment.index || segment.status === 'completed' || segment.status === 'failed') {
      return segment;
    }

    return {
      ...segment,
      status: 'skipped' as const,
      error: `依赖第 ${failedSegment.index + 1} 段失败，已停止级联启动；先重试上一段并写回 lastFrameUrl。`,
      expectedInputs: {
        ...segment.expectedInputs,
        firstFrameUrl: null,
        previousLastFrameUrl: null,
        sourceSegmentId: failedSegment.id,
        sourceAssetId: null,
        continuityPrompt: `等待第 ${failedSegment.index + 1} 段重试完成并写回 lastFrameUrl 后再启动。`,
        previousAudioCue: null,
        audioContinuityPrompt: `等待第 ${failedSegment.index + 1} 段重试完成并写回声音状态后再启动。`,
        previousStoryStateCue: null,
        storyContinuityPrompt: `等待第 ${failedSegment.index + 1} 段重试完成并写回故事状态后再启动。`,
        boundaryBridgeId: segment.expectedInputs.boundaryBridgeId,
        boundaryBridgePrompt: segment.expectedInputs.boundaryBridgePrompt,
        bridgeFirstFrameUrl: null,
        bridgeStrategy: segment.expectedInputs.bridgeStrategy || 'transition-bridge',
      },
      storySegmentContract: segment.storySegmentContract
        ? patchStorySegmentContractInputs({
            contract: segment.storySegmentContract,
            firstFrameUrl: null,
            previousLastFrameUrl: null,
            sourceSegmentId: failedSegment.id,
            sourceAssetId: null,
            previousAudioCue: null,
            previousStoryStateCue: null,
          })
        : segment.storySegmentContract,
      expectedOutputs: {
        ...segment.expectedOutputs,
        videoUrl: null,
        lastFrameUrl: null,
        providerTaskId: null,
      },
    };
  });
}

function updateBoundaryBridgePlanAfterSegment(
  boundaryBridgePlan: BoundaryBridgePlan | undefined,
  segment: ProductionSegmentPlan,
  segments: ProductionSegmentPlan[]
): BoundaryBridgePlan | undefined {
  if (!boundaryBridgePlan) return boundaryBridgePlan;
  const lastFrameUrl = segment.expectedOutputs.lastFrameUrl || null;

  return {
    ...boundaryBridgePlan,
    boundaries: boundaryBridgePlan.boundaries.map(boundary => {
      if (segment.status === 'completed' && boundary.previousSegmentId === segment.id) {
        const nextSegment = segments.find(item => item.id === boundary.nextSegmentId);
        return {
          ...boundary,
          sourceLastFrameUrl: lastFrameUrl,
          targetFirstFrameUrl: nextSegment?.expectedInputs.bridgeFirstFrameUrl
            || nextSegment?.expectedInputs.firstFrameUrl
            || lastFrameUrl,
          status: lastFrameUrl ? 'ready' as const : 'blocked' as const,
          readiness: lastFrameUrl
            ? {
                pass: true,
                blockers: [],
                warnings: ['bridge-video-not-generated-yet', 'next-segment-currently-uses-direct-tail-frame-fallback'],
              }
            : {
                pass: false,
                blockers: ['previous-last-frame-missing'],
                warnings: ['bridge-video-not-generated-yet'],
              },
        };
      }

      if (segment.status === 'failed' && boundary.index >= segment.index) {
        return {
          ...boundary,
          status: 'stale' as const,
          bridgeVideoUrl: null,
          bridgeLastFrameUrl: null,
          newCameraImageUrl: null,
          readiness: {
            pass: false,
            blockers: [`segment-${segment.index + 1}-failed`],
            warnings: ['downstream-boundary-invalidated'],
          },
        };
      }

      return boundary;
    }),
  };
}

function updateAssemblyPlan(
  assemblyPlan: ProductionAssemblyPlan,
  segmentIndex: number,
  patch: SegmentAssetWritebackPatch
) {
  const patchedSegments = assemblyPlan.segments.map(segment =>
    segment.index === segmentIndex ? updateSegment(segment, patch) : segment
  );
  const patchedSegment = patchedSegments.find(segment => segment.index === segmentIndex);
  const segments = patchedSegment
    ? patchedSegment.status === 'failed'
      ? cascadeDependentSegmentsAfterFailure(patchedSegments, patchedSegment)
      : updateNextSegmentHandoff(patchedSegments, patchedSegment)
    : patchedSegments;
  const status = deriveAssemblyStatus(segments);
  const completedSegmentCount = segments.filter(segment => segment.status === 'completed').length;
  const failedSegmentCount = segments.filter(segment => segment.status === 'failed').length;
  const boundaryBridgePlan = patchedSegment
    ? updateBoundaryBridgePlanAfterSegment(assemblyPlan.boundaryBridgePlan, patchedSegment, segments)
    : assemblyPlan.boundaryBridgePlan;

  const updatedPlan: ProductionAssemblyPlan = {
    ...assemblyPlan,
    status,
    boundaryBridgePlan,
    segments,
    recovery: {
      ...assemblyPlan.recovery,
      resumeFromSegmentIndex: deriveResumeFromSegmentIndex(segments),
    },
    nextAction: status === 'completed'
      ? '所有片段已完成，可进入合成和导出；不要用单个片段冒充最终成片。'
      : status === 'failed'
        ? '至少一个片段失败。保留已完成片段，只重试失败片段后再合成。'
        : assemblyPlan.nextAction,
  };

  return { updatedPlan, completedSegmentCount, failedSegmentCount };
}

function buildVideoSegmentAsset(segment: ProductionSegmentPlan): ProductionAsset | null {
  const videoUrl = segment.expectedOutputs.videoUrl;
  if (segment.status !== 'completed' || !videoUrl) return null;

  return {
    id: videoSegmentAssetId(segment),
    kind: 'videoSegment',
    name: `片段 ${segment.index + 1}`,
    status: 'completed',
    summary: `镜头 ${segment.shotId} 已生成 ${segment.duration}s 视频片段，可复用到合成和导出。`,
    source: 'task',
    relatedShotIds: [segment.shotId],
    metadata: {
      segmentId: segment.id,
      segmentIndex: segment.index,
      shotId: segment.shotId,
      childTaskId: segment.expectedOutputs.taskId,
      providerTaskId: segment.expectedOutputs.providerTaskId,
      videoUrl,
      lastFrameUrl: segment.expectedOutputs.lastFrameUrl,
      audioCue: segment.expectedOutputs.audioCue || segment.audioState?.audioCue,
      hasAudio: segment.expectedOutputs.hasAudio,
      storyStateCue: segmentStoryStateCue(segment),
      audioEventContract: segment.storySegmentContract?.audioContract?.audioEventContract,
      audioState: segment.audioState,
      duration: segment.duration,
      completedAt: segment.completedAt,
      prompt: segment.prompt,
    },
  };
}

function upsertAsset(assets: ProductionAsset[], asset: ProductionAsset | null) {
  if (!asset) return assets;
  const exists = assets.some(item => item.id === asset.id);
  if (exists) {
    return assets.map(item => (item.id === asset.id ? { ...item, ...asset } : item));
  }

  const deliverableIndex = assets.findIndex(item => item.kind === 'deliverable');
  if (deliverableIndex < 0) return [...assets, asset];
  return [
    ...assets.slice(0, deliverableIndex),
    asset,
    ...assets.slice(deliverableIndex),
  ];
}

function upsertGraphNode(project: ProductionProject, asset: ProductionAsset | null) {
  if (!asset) return project.graph.nodes;
  const node = {
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    status: asset.status,
  };
  const exists = project.graph.nodes.some(item => item.id === asset.id);
  return exists
    ? project.graph.nodes.map(item => (item.id === asset.id ? node : item))
    : [...project.graph.nodes, node];
}

function addEdgeOnce(edges: ProductionGraphEdge[], edge: ProductionGraphEdge) {
  if (edges.some(item => item.from === edge.from && item.to === edge.to && item.relation === edge.relation)) {
    return edges;
  }
  return [...edges, edge];
}

function updateGraphEdges(project: ProductionProject, segment: ProductionSegmentPlan, asset: ProductionAsset | null) {
  if (!asset) return project.graph.edges;
  const storyboardAssetId = project.semanticPlan.assetLinks.storyboardAssetId;
  const deliverableAssetId = project.semanticPlan.assetLinks.deliverableAssetId;
  return addEdgeOnce(
    addEdgeOnce(project.graph.edges, { from: storyboardAssetId, to: asset.id, relation: 'feeds' }),
    { from: asset.id, to: deliverableAssetId, relation: 'tracks' }
  );
}

function updateAssemblyStage(project: ProductionProject, segmentAssetIds: string[], failedSegmentCount: number) {
  return project.stages.map(stage => {
    if (stage.id !== 'assembly') return stage;
    return {
      ...stage,
      status: failedSegmentCount > 0 ? 'failed' as const : segmentAssetIds.length > 0 ? 'running' as const : stage.status,
      summary: failedSegmentCount > 0
        ? `已有 ${segmentAssetIds.length} 个片段可复用，仍有 ${failedSegmentCount} 个片段需要重试`
        : segmentAssetIds.length > 0
          ? `已回写 ${segmentAssetIds.length} 个真实视频片段，等待其余片段或合成`
          : stage.summary,
      assetIds: Array.from(new Set([...stage.assetIds, ...segmentAssetIds])),
    };
  });
}

function updateStoryboardShotStatus(
  project: ProductionProject,
  segment: ProductionSegmentPlan
): ProductionProject['storyboard']['shots'] {
  return project.storyboard.shots.map(shot => {
    if (shot.id !== segment.shotId) return shot;
    return {
      ...shot,
      status: segment.status === 'completed'
        ? 'completed'
        : segment.status === 'failed'
          ? 'failed'
          : segment.status === 'running'
            ? 'running'
            : shot.status,
    };
  });
}

function updateDagNode(node: DAGNode, segment: ProductionSegmentPlan): DAGNode {
  if (node.nodeId !== `n_video_${segment.shotId}`) return node;
  const now = Date.now();
  return {
    ...node,
    status: segment.status === 'queued' ? 'pending' : segment.status,
    startTime: segment.startedAt ? node.startTime || now : node.startTime,
    endTime: segment.status === 'completed' || segment.status === 'failed' ? now : node.endTime,
    error: segment.status === 'failed' ? segment.error || '片段生成失败' : undefined,
    result: {
      ...node.result,
      segmentId: segment.id,
      segmentIndex: segment.index,
      childTaskId: segment.expectedOutputs.taskId,
      providerTaskId: segment.expectedOutputs.providerTaskId,
      videoUrl: segment.expectedOutputs.videoUrl,
      lastFrameUrl: segment.expectedOutputs.lastFrameUrl,
      audioCue: segment.expectedOutputs.audioCue || segment.audioState?.audioCue,
      hasAudio: segment.expectedOutputs.hasAudio,
      storyStateCue: segmentStoryStateCue(segment),
      audioEventContract: segment.storySegmentContract?.audioContract?.audioEventContract,
      duration: segment.duration,
      completedAt: segment.completedAt,
    },
  };
}

function updateAssemblyDagNode(node: DAGNode, segments: ProductionSegmentPlan[]): DAGNode {
  if (node.nodeId !== 'n_assembly') return node;
  const completedCount = segments.filter(segment => segment.status === 'completed').length;
  const failedCount = segments.filter(segment => segment.status === 'failed').length;
  return {
    ...node,
    status: failedCount > 0 ? 'pending' : completedCount === segments.length ? 'ready' : node.status,
    result: {
      ...node.result,
      completedSegmentCount: completedCount,
      failedSegmentCount: failedCount,
      readyForAssembly: failedCount === 0 && completedCount === segments.length,
    },
  };
}

function updateProductionProject(
  project: ProductionProject,
  updatedPlan: ProductionAssemblyPlan,
  segment: ProductionSegmentPlan,
  failedSegmentCount: number
): ProductionProject {
  const videoAsset = buildVideoSegmentAsset(segment);
  const assets = upsertAsset(project.assets, videoAsset);
  const segmentAssetIds = assets.filter(asset => asset.kind === 'videoSegment').map(asset => asset.id);
  const outputStatus = failedSegmentCount > 0
    ? 'failed'
    : updatedPlan.status === 'completed'
      ? 'ready'
      : segmentAssetIds.length > 0
        ? 'running'
        : project.output.status;

  return {
    ...project,
    assets,
    stages: updateAssemblyStage(project, segmentAssetIds, failedSegmentCount),
    graph: {
      nodes: upsertGraphNode(project, videoAsset),
      edges: updateGraphEdges(project, segment, videoAsset),
    },
    storyboard: {
      ...project.storyboard,
      shots: updateStoryboardShotStatus(project, segment),
    },
    semanticPlan: {
      ...project.semanticPlan,
      dag: {
        nodes: project.semanticPlan.dag.nodes
          .map(node => updateDagNode(node, segment))
          .map(node => updateAssemblyDagNode(node, updatedPlan.segments)),
      },
    },
    output: {
      ...project.output,
      status: outputStatus,
      canProceedToVideo: updatedPlan.status !== 'completed',
      nextStep: updatedPlan.status === 'completed'
        ? '所有片段已成为可复用资产，下一步进入合成和导出。'
        : failedSegmentCount > 0
          ? '保留已完成片段，重试失败片段后再合成。'
          : `已回写 ${segmentAssetIds.length} 个视频片段，继续生成剩余片段。`,
    },
  };
}

export function applySegmentAssetWriteback(params: SegmentAssetWritebackParams): SegmentAssetWritebackResult {
  const { updatedPlan, completedSegmentCount, failedSegmentCount } = updateAssemblyPlan(
    params.assemblyPlan,
    params.segmentIndex,
    params.patch
  );
  const updatedSegment = updatedPlan.segments.find(segment => segment.index === params.segmentIndex);
  const productionProject = params.productionProject && updatedSegment
    ? updateProductionProject(params.productionProject, updatedPlan, updatedSegment, failedSegmentCount)
    : params.productionProject || undefined;

  return {
    productionProject,
    assemblyPlan: updatedPlan,
    completedSegmentCount,
    failedSegmentCount,
  };
}
