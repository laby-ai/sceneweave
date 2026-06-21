import type { DirectorChainResult } from './smart-director-chain';
import type { ProductionAsset, ProductionProject } from './production-project';
import type { ProductionAssemblyPlan } from './production-assembly-plan';
import type { StoryReadabilityScore } from './production-story-readability';
import { buildSegmentBridgePlan, buildTrailerBeatSheet } from './trailer-beat-sheet';

type CanvasNodeType = 'script' | 'storyboard' | 'image' | 'video' | 'audio' | 'camera' | 'character' | 'scene' | 'agent' | 'quality';
type ProductionAssetStatus = ProductionAsset['status'];
type ProductionSegmentStatus = ProductionAssemblyPlan['segments'][number]['status'];

interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  label?: string;
  markerEnd?: { type: 'arrowclosed' };
}

interface BuildProductionCanvasParams {
  productionProject: ProductionProject;
  directorChain?: DirectorChainResult | null;
  assemblyPlan?: ProductionAssemblyPlan | null;
  storyReadability?: StoryReadabilityScore | null;
  taskId?: string;
}

export interface ProductionCanvas {
  version: 'yh-production-canvas-v1';
  source: 'productionProject';
  reference: {
    primary: 'Toonflow-app';
    adaptedIdeas: string[];
  };
  productionProjectId: string;
  taskId?: string;
  summary: {
    nodeCount: number;
    edgeCount: number;
    assetCount: number;
    agentCount: number;
    storyboardShotCount: number;
    totalDuration: number;
    storyReadabilityScore?: number;
    storyReadabilityPass?: boolean;
  };
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

function statusToNodeStatus(status: ProductionAssetStatus | undefined) {
  if (status === 'ready' || status === 'completed') return 'success';
  if (status === 'running') return 'loading';
  if (status === 'failed') return 'error';
  return 'idle';
}

function segmentStatusToNodeStatus(status: ProductionSegmentStatus | undefined) {
  if (status === 'completed') return 'success';
  if (status === 'running') return 'loading';
  if (status === 'failed') return 'error';
  return 'idle';
}

function assetNodeType(asset: ProductionAsset): CanvasNodeType {
  if (asset.kind === 'script') return 'script';
  if (asset.kind === 'storyboard') return 'storyboard';
  if (asset.kind === 'character') return 'character';
  if (asset.kind === 'scene') return 'scene';
  if (asset.kind === 'videoSegment') return 'video';
  if (asset.kind === 'finalVideo') return 'video';
  if (asset.kind === 'deliverable') return 'video';
  if (asset.kind === 'task') return 'agent';
  return 'image';
}

function assetPosition(asset: ProductionAsset, ordinal: number) {
  const byKind: Record<string, { x: number; y: number }> = {
    script: { x: 80, y: 250 },
    character: { x: 420, y: 80 + ordinal * 150 },
    scene: { x: 420, y: 440 + ordinal * 150 },
    prop: { x: 760, y: 110 + ordinal * 150 },
    storyboard: { x: 1120, y: 250 },
    task: { x: 1460, y: 80 + ordinal * 135 },
    videoSegment: { x: 1460, y: 250 + ordinal * 180 },
    finalVideo: { x: 1840, y: 260 },
    deliverable: { x: 1840, y: 470 },
  };
  return byKind[asset.kind] || { x: 760, y: 110 + ordinal * 150 };
}

function storyboardRows(project: ProductionProject) {
  return project.storyboard.shots.map(shot => ({
    id: shot.id,
    index: shot.index,
    description: shot.prompt,
    prompt: shot.prompt,
    duration: shot.duration,
    cameraAngle: shot.shotTypeLabel || shot.shotType || '镜头',
    shotType: shot.shotType,
    phase: shot.phase,
    phaseLabel: shot.phaseLabel,
    subtitleText: shot.subtitleText,
    narrationText: shot.narrationText,
    status: statusToNodeStatus(shot.status),
  }));
}

function agentNodeId(role: string) {
  return `agent-${role}`;
}

export function buildProductionCanvas(params: BuildProductionCanvasParams): ProductionCanvas {
  const { productionProject, directorChain, assemblyPlan, storyReadability, taskId } = params;
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  const agentCount = directorChain?.agents.length || 0;
  const assetOrdinals = new Map<string, number>();
  const videoSegmentKeys = new Set<string>();

  productionProject.assets.forEach((asset) => {
    const ordinal = assetOrdinals.get(asset.kind) || 0;
    assetOrdinals.set(asset.kind, ordinal + 1);
    const nodeType = assetNodeType(asset);
    const data: Record<string, unknown> = {
      label: asset.name,
      type: nodeType,
      status: statusToNodeStatus(asset.status),
      prompt: asset.summary,
      productionProjectId: productionProject.id,
      productionTaskId: taskId,
      productionAssetId: asset.id,
      productionAssetKind: asset.kind,
      assetKind: asset.kind,
      productionSource: asset.source,
      relatedShotIds: asset.relatedShotIds || [],
      metadata: asset.metadata || {},
    };

    if (asset.kind === 'storyboard') {
      data.storyboard = storyboardRows(productionProject);
      data.totalDuration = productionProject.storyboard.totalDuration;
      data.shotCount = productionProject.storyboard.shotCount;
    }

    if (asset.kind === 'deliverable') {
      data.prompt = productionProject.output.nextStep || asset.summary;
      data.status = statusToNodeStatus(productionProject.output.status);
      data.taskId = productionProject.output.taskId;
      data.canProceedToVideo = productionProject.output.canProceedToVideo;
      if (assemblyPlan) {
        data.assemblyPlan = {
          version: assemblyPlan.version,
          segmentCount: assemblyPlan.segmentCount,
          totalDuration: assemblyPlan.totalDuration,
          status: assemblyPlan.status,
          nextAction: assemblyPlan.nextAction,
          readiness: assemblyPlan.readiness,
          recovery: assemblyPlan.recovery,
          segments: assemblyPlan.segments.map(segment => ({
            id: segment.id,
            index: segment.index,
            shotId: segment.shotId,
            duration: segment.duration,
            status: segment.status,
            shotFrameContract: segment.shotFrameContract
              ? {
                  version: segment.shotFrameContract.version,
                  variationType: segment.shotFrameContract.variationType,
                  readiness: segment.shotFrameContract.readiness,
                }
              : null,
          })),
        };
      }
    }

    if (asset.kind === 'videoSegment') {
      const metadata = asset.metadata || {};
      if (metadata.segmentId) videoSegmentKeys.add(String(metadata.segmentId));
      if (metadata.segmentIndex !== undefined) videoSegmentKeys.add(`index:${String(metadata.segmentIndex)}`);
      if (metadata.shotId) videoSegmentKeys.add(`shot:${String(metadata.shotId)}`);
      data.videoUrl = metadata.videoUrl;
      data.lastFrameUrl = metadata.lastFrameUrl;
      data.taskId = metadata.childTaskId;
      data.childTaskId = metadata.childTaskId;
      data.providerTaskId = metadata.providerTaskId;
      data.duration = metadata.duration;
      data.segmentId = metadata.segmentId;
      data.segmentIndex = metadata.segmentIndex;
      data.shotId = metadata.shotId;
      data.audioCue = metadata.audioCue;
      data.hasAudio = metadata.hasAudio;
      data.storyStateCue = metadata.storyStateCue;
      data.audioEventContract = metadata.audioEventContract;
    }

    if (asset.kind === 'finalVideo') {
      const metadata = asset.metadata || {};
      data.videoUrl = metadata.videoUrl;
      data.taskId = metadata.taskId;
      data.duration = metadata.duration;
      data.segmentAssetIds = metadata.segmentAssetIds;
      data.segmentAssetCount = metadata.segmentAssetCount;
      data.completedAt = metadata.completedAt;
    }

    nodes.push({
      id: `production-${asset.id}`,
      type: nodeType,
      position: assetPosition(asset, ordinal),
      data,
    });
  });

  const trailerBeatSheet = productionProject.storyBible.trailerBeatSheet || buildTrailerBeatSheet(productionProject);
  if (trailerBeatSheet) {
    const trailerNodeId = 'production-trailer-beat-sheet';
    nodes.push({
      id: trailerNodeId,
      type: 'storyboard',
      position: { x: 1120, y: -160 },
      data: {
        label: `${trailerBeatSheet.structure} 节拍表`,
        type: 'storyboard',
        status: 'success',
        prompt: trailerBeatSheet.beats.map(beat => `${beat.timeRange} ${beat.label}: ${beat.requiredVisual}`).join('\n'),
        productionProjectId: productionProject.id,
        productionTaskId: taskId,
        productionAssetKind: 'trailerBeatSheet',
        assetKind: 'trailerBeatSheet',
        productionSource: 'productionProject.storyBible.trailerBeatSheet',
        structure: trailerBeatSheet.structure,
        duration: trailerBeatSheet.duration,
        beatCount: trailerBeatSheet.beats.length,
        beats: trailerBeatSheet.beats,
        continuityRules: trailerBeatSheet.continuityRules,
        metadata: {
          version: trailerBeatSheet.version,
          reference: trailerBeatSheet.reference,
        },
      },
    });

    edges.push({
      id: `edge-production-script-1-${trailerNodeId}`,
      source: 'production-script-1',
      target: trailerNodeId,
      animated: true,
      label: 'trailer beats',
      markerEnd: { type: 'arrowclosed' },
    });

    edges.push({
      id: `edge-${trailerNodeId}-production-storyboard-1`,
      source: trailerNodeId,
      target: 'production-storyboard-1',
      animated: true,
      label: 'beat sheet',
      markerEnd: { type: 'arrowclosed' },
    });
  }

  if (assemblyPlan) {
    const segmentBridgePlan = assemblyPlan.bridgePlan || buildSegmentBridgePlan(productionProject, trailerBeatSheet);
    if (segmentBridgePlan) {
      const bridgeNodeId = 'production-segment-bridge-plan';
      nodes.push({
        id: bridgeNodeId,
        type: 'quality',
        position: { x: 1460, y: -150 },
        data: {
          label: `段落桥接计划 ${segmentBridgePlan.bridges.length}`,
          type: 'quality',
          status: 'success',
          prompt: segmentBridgePlan.bridges
            .map(bridge => [
              `${bridge.index + 1}. ${bridge.fromBeat} -> ${bridge.toBeat}: ${bridge.bridgeAction}`,
              `观众检查点：${bridge.viewerCheckpoint}`,
              `上一帧记忆：${bridge.previousFrameMemory}`,
              `下一段触发：${bridge.nextFrameTrigger}`,
            ].join('\n'))
            .join('\n'),
          productionProjectId: productionProject.id,
          productionTaskId: taskId || assemblyPlan.sourceTaskId,
          productionAssetKind: 'segmentBridgePlan',
          assetKind: 'segmentBridgePlan',
          productionSource: 'assemblyPlan.bridgePlan',
          bridgeCount: segmentBridgePlan.bridges.length,
          bridges: segmentBridgePlan.bridges,
          metadata: {
            version: segmentBridgePlan.version,
            reference: segmentBridgePlan.reference,
            derivedForLegacyTask: !assemblyPlan.bridgePlan,
          },
        },
      });

      edges.push({
        id: `edge-production-trailer-beat-sheet-${bridgeNodeId}`,
        source: trailerBeatSheet ? 'production-trailer-beat-sheet' : 'production-storyboard-1',
        target: bridgeNodeId,
        animated: true,
        label: 'bridge plan',
        markerEnd: { type: 'arrowclosed' },
      });

      edges.push({
        id: `edge-${bridgeNodeId}-production-deliverable-1`,
        source: bridgeNodeId,
        target: 'production-deliverable-1',
        animated: true,
        label: 'continuity',
        markerEnd: { type: 'arrowclosed' },
      });
    }

    if (assemblyPlan.readiness) {
      const readinessNodeId = 'production-assembly-readiness';
      nodes.push({
        id: readinessNodeId,
        type: 'quality',
        position: { x: 1460, y: 60 },
        data: {
          label: assemblyPlan.readiness.pass
            ? `首尾帧合约通过 ${assemblyPlan.segments.length}/${assemblyPlan.segments.length}`
            : `首尾帧合约阻断 ${assemblyPlan.readiness.blockerCount}`,
          type: 'quality',
          status: assemblyPlan.readiness.pass ? 'success' : 'error',
          prompt: assemblyPlan.readiness.pass
            ? '每段都具备机器可读的首帧、尾帧、可见角色、参考资产和动作连续性合约；可进入无费用排队。'
            : assemblyPlan.readiness.issues.slice(0, 4).map(issue => issue.message).join('\n'),
          productionProjectId: productionProject.id,
          productionTaskId: taskId || assemblyPlan.sourceTaskId,
          productionAssetKind: 'assemblyReadiness',
          assetKind: 'assemblyReadiness',
          productionSource: 'assemblyPlan.readiness',
          pass: assemblyPlan.readiness.pass,
          blockerCount: assemblyPlan.readiness.blockerCount,
          warningCount: assemblyPlan.readiness.warningCount,
          issues: assemblyPlan.readiness.issues,
          nextAction: assemblyPlan.readiness.nextAction,
          metadata: {
            version: assemblyPlan.readiness.version,
            source: assemblyPlan.readiness.source,
            reference: 'ViMAX ShotDescription ff/lf visible character contract',
          },
        },
      });

      edges.push({
        id: `edge-production-storyboard-1-${readinessNodeId}`,
        source: 'production-storyboard-1',
        target: readinessNodeId,
        animated: !assemblyPlan.readiness.pass,
        label: 'shot frame gate',
        markerEnd: { type: 'arrowclosed' },
      });

      edges.push({
        id: `edge-${readinessNodeId}-production-deliverable-1`,
        source: readinessNodeId,
        target: 'production-deliverable-1',
        animated: assemblyPlan.readiness.pass,
        label: assemblyPlan.readiness.pass ? 'ready' : 'blocked',
        markerEnd: { type: 'arrowclosed' },
      });
    }

    assemblyPlan.segments.forEach((segment) => {
      const representedByAsset =
        videoSegmentKeys.has(segment.id) ||
        videoSegmentKeys.has(`index:${segment.index}`) ||
        videoSegmentKeys.has(`shot:${segment.shotId}`);

      if (representedByAsset) return;

      const nodeId = `assembly-segment-${segment.index + 1}`;
      nodes.push({
        id: nodeId,
        type: 'video',
        position: assetPosition({ kind: 'videoSegment' } as ProductionAsset, segment.index),
        data: {
          label: `片段任务 ${segment.index + 1}`,
          type: 'video',
          status: segmentStatusToNodeStatus(segment.status),
          prompt: segment.error || segment.prompt,
          productionProjectId: productionProject.id,
          productionTaskId: taskId || assemblyPlan.sourceTaskId,
          productionAssetKind: 'assemblySegment',
          assetKind: 'assemblySegment',
          productionSource: 'assemblyPlan.segments',
          relatedShotIds: [segment.shotId],
          segmentId: segment.id,
          segmentIndex: segment.index,
          segmentStatus: segment.status,
          shotId: segment.shotId,
          duration: segment.duration,
          taskId: segment.expectedOutputs.taskId,
          childTaskId: segment.expectedOutputs.taskId,
          videoUrl: segment.expectedOutputs.videoUrl,
          lastFrameUrl: segment.expectedOutputs.lastFrameUrl,
          providerTaskId: segment.expectedOutputs.providerTaskId,
          audioCue: segment.expectedOutputs.audioCue || segment.audioState?.audioCue,
          hasAudio: segment.expectedOutputs.hasAudio,
          storyStateCue: segment.expectedOutputs.storyStateCue,
          audioEventContract: segment.storySegmentContract.audioContract.audioEventContract,
          error: segment.error,
          retryable: segment.retryPolicy.retryable,
          shotFrameContract: segment.shotFrameContract,
          shotFrameReadiness: segment.shotFrameContract?.readiness,
          shotVariationType: segment.shotFrameContract?.variationType,
          firstFrameContract: segment.shotFrameContract?.firstFrame,
          lastFrameContract: segment.shotFrameContract?.lastFrame,
          metadata: {
            segmentId: segment.id,
            segmentIndex: segment.index,
            shotId: segment.shotId,
            status: segment.status,
            source: 'assemblyPlan.segments',
            shotFrameContractVersion: segment.shotFrameContract?.version,
            shotFrameReadinessPass: segment.shotFrameContract?.readiness.pass,
          },
        },
      });

      edges.push({
        id: `edge-production-storyboard-1-${nodeId}`,
        source: 'production-storyboard-1',
        target: nodeId,
        animated: segment.status === 'running',
        label: 'segment',
        markerEnd: { type: 'arrowclosed' },
      });

      edges.push({
        id: `edge-${nodeId}-production-deliverable-1`,
        source: nodeId,
        target: 'production-deliverable-1',
        animated: segment.status === 'completed',
        label: segment.status,
        markerEnd: { type: 'arrowclosed' },
      });
    });
  }

  if (storyReadability) {
    const qualityNodeId = 'production-story-readability';
    nodes.push({
      id: qualityNodeId,
      type: 'quality',
      position: { x: 1120, y: 40 },
      data: {
        label: storyReadability.pass
          ? `故事可读性 ${storyReadability.score}`
          : `故事可读性 ${storyReadability.score} 未通过`,
        type: 'quality',
        status: storyReadability.pass ? 'success' : 'error',
        prompt: storyReadability.pass
          ? '脚本具备可见主角、目标、危险、动作结果和分段桥接，可进入真实生成前检查。'
          : storyReadability.nextActions.slice(0, 3).join('\n'),
        productionProjectId: productionProject.id,
        productionTaskId: taskId,
        productionAssetKind: 'storyReadability',
        assetKind: 'storyReadability',
        productionSource: 'storyReadability',
        score: storyReadability.score,
        pass: storyReadability.pass,
        threshold: storyReadability.threshold,
        checks: storyReadability.checks,
        issues: storyReadability.issues,
        nextActions: storyReadability.nextActions,
        metadata: {
          version: storyReadability.version,
          blockerCount: storyReadability.issues.filter(issue => issue.severity === 'blocker').length,
          warningCount: storyReadability.issues.filter(issue => issue.severity === 'warning').length,
        },
      },
    });

    edges.push({
      id: `edge-production-storyboard-1-${qualityNodeId}`,
      source: 'production-storyboard-1',
      target: qualityNodeId,
      animated: !storyReadability.pass,
      label: 'readability gate',
      markerEnd: { type: 'arrowclosed' },
    });

    edges.push({
      id: `edge-${qualityNodeId}-production-deliverable-1`,
      source: qualityNodeId,
      target: 'production-deliverable-1',
      animated: storyReadability.pass,
      label: storyReadability.pass ? 'pass' : 'blocked',
      markerEnd: { type: 'arrowclosed' },
    });
  }

  if (directorChain) {
    directorChain.agents.forEach((agent, index) => {
      const id = agentNodeId(agent.role);
      nodes.push({
        id,
        type: 'agent',
        position: { x: 760, y: 340 + index * 160 },
        data: {
          label: agent.title,
          type: 'agent',
          status: 'success',
          prompt: agent.objective,
          productionProjectId: productionProject.id,
          directorAgentRole: agent.role,
          decisions: agent.decisions,
          output: agent.output,
          reference: directorChain.reference,
        },
      });

      edges.push({
        id: `edge-production-script-1-${id}`,
        source: 'production-script-1',
        target: id,
        animated: true,
        label: '导演链路',
        markerEnd: { type: 'arrowclosed' },
      });

      edges.push({
        id: `edge-${id}-production-storyboard-1`,
        source: id,
        target: 'production-storyboard-1',
        animated: true,
        label: '结构输出',
        markerEnd: { type: 'arrowclosed' },
      });
    });
  }

  for (const edge of productionProject.graph.edges) {
    edges.push({
      id: `edge-production-${edge.from}-production-${edge.to}`,
      source: `production-${edge.from}`,
      target: `production-${edge.to}`,
      animated: ['feeds', 'tracks'].includes(edge.relation),
      label: edge.relation,
      markerEnd: { type: 'arrowclosed' },
    });
  }

  return {
    version: 'yh-production-canvas-v1',
    source: 'productionProject',
    reference: {
      primary: 'Toonflow-app',
      adaptedIdeas: [
        '把剧本、角色、场景、道具、分镜、任务和成片变成可见节点资产',
        '按制作泳道稳定排布节点，避免真实项目资产被全局索引挤到一起',
        '节点保留 productionAssetId 和 relatedShotIds，便于复用到生成链路',
        '导演链路 Agent 以节点形式连接到分镜资产，避免智能助手输出游离在聊天里',
        'assemblyPlan 中尚未产出 videoSegment 资产的片段也映射为片段任务节点，失败/排队状态可见',
        '故事可读性门禁以节点形式连接分镜和交付，真实生成前先暴露看不懂的原因',
        '预告片节拍表和段落桥接计划以节点形式进入画布，避免只靠拖拉拽摆节点而没有叙事结构',
        'ViMAX 式镜头首尾帧合约以 readiness 节点和片段节点数据进入画布，生成前暴露不能衔接的原因',
      ],
    },
    productionProjectId: productionProject.id,
    taskId,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      assetCount: productionProject.assets.length,
      agentCount,
      storyboardShotCount: productionProject.storyboard.shotCount,
      totalDuration: productionProject.storyboard.totalDuration,
      storyReadabilityScore: storyReadability?.score,
      storyReadabilityPass: storyReadability?.pass,
    },
    nodes,
    edges,
  };
}
