import { buildProductionAssemblyPlan } from './production-assembly-plan';
import { applySegmentAssetWriteback } from './production-segment-assets';
import { buildProductionProject } from './production-project';
import { generateShotsFromUserPrompt } from './storyboard-generator';
import type { BackgroundTask, TaskResult } from './task-manager';
import type { ProductionAsset, ProductionGraphEdge, ProductionProject } from './production-project';

interface ArchiveVideoTaskParams {
  task: BackgroundTask;
}

export interface ArchivedVideoTaskResult {
  result: TaskResult;
  productionProjectId: string;
  segmentAssetCount: number;
  finalVideoAssetCount: number;
  assemblyStatus: string;
}

function parseDurationSeconds(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const match = value.match(/\d+/);
    if (match) return Number(match[0]);
  }
  return fallback;
}

function segmentDurationAt(task: BackgroundTask, index: number, totalSegments: number) {
  const segment = task.result?.segments?.[index];
  if (typeof segment?.duration === 'number' && Number.isFinite(segment.duration)) return segment.duration;
  const resultDuration = parseDurationSeconds(task.result?.duration, 10);
  const duration = parseDurationSeconds(task.config.duration, resultDuration);
  return Math.max(5, Math.round(duration / Math.max(1, totalSegments)));
}

function segmentPromptAt(task: BackgroundTask, index: number) {
  const segmentPrompt = task.result?.segments?.[index]?.prompt;
  if (typeof segmentPrompt === 'string' && segmentPrompt.trim()) return segmentPrompt;
  const prompt = typeof task.config.prompt === 'string' ? task.config.prompt : '';
  return prompt || `真实视频片段 ${index + 1}`;
}

function createArchiveProject(task: BackgroundTask) {
  const prompt = typeof task.config.prompt === 'string' && task.config.prompt.trim()
    ? task.config.prompt
    : '已完成真实视频任务归档';
  const segments = task.result?.segments || [];
  const resultDuration = parseDurationSeconds(task.result?.duration, 10);
  const duration = parseDurationSeconds(task.config.duration, resultDuration);
  const segmentDuration = segmentDurationAt(task, 0, segments.length || 1);
  const generated = generateShotsFromUserPrompt(prompt, duration, {
    maxShotDuration: segmentDuration,
    preferredSceneType: typeof task.config.sceneType === 'string' ? task.config.sceneType : undefined,
  });

  const shots = (segments.length > 0 ? segments : generated.shots).map((segment, index) => {
    const sourceShot = generated.shots[index] || generated.shots[generated.shots.length - 1];
    return {
      ...sourceShot,
      id: `archived-shot-${index + 1}`,
      index: index + 1,
      prompt: segmentPromptAt(task, index),
      duration: segmentDurationAt(task, index, segments.length || generated.shots.length || 1),
      status: 'planned' as const,
    };
  });

  return buildProductionProject({
    taskId: task.id,
    prompt,
    duration,
    segmentDuration,
    style: typeof task.config.style === 'string' ? task.config.style : '真实案例归档',
    sceneType: typeof task.config.sceneType === 'string' ? task.config.sceneType : 'drama',
    ratio: typeof task.config.ratio === 'string' ? task.config.ratio : '16:9',
    entities: generated.entities,
    visualAnchors: generated.visualAnchors,
    narrativeSummary: generated.narrativeSummary,
    subtitleSuggestion: generated.subtitleSuggestion,
    narrationSuggestion: generated.narrationSuggestion,
    shots,
  });
}

function upsertAsset(assets: ProductionAsset[], asset: ProductionAsset) {
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

function addEdgeOnce(edges: ProductionGraphEdge[], edge: ProductionGraphEdge) {
  if (edges.some(item => item.from === edge.from && item.to === edge.to && item.relation === edge.relation)) {
    return edges;
  }
  return [...edges, edge];
}

function buildFinalVideoAsset(task: BackgroundTask, productionProject: ProductionProject): ProductionAsset {
  const videoSegmentIds = productionProject.assets
    .filter(asset => asset.kind === 'videoSegment')
    .map(asset => asset.id);
  return {
    id: 'final-video',
    kind: 'finalVideo',
    name: '最终成片',
    status: 'completed',
    summary: `任务 ${task.id} 已合成为最终成片，可作为首页案例、素材和导出资产复用。`,
    source: 'task',
    relatedShotIds: productionProject.storyboard.shots.map(shot => shot.id),
    metadata: {
      taskId: task.id,
      videoUrl: task.result?.videoUrl,
      duration: parseDurationSeconds(task.config.duration, productionProject.duration),
      segmentAssetIds: videoSegmentIds,
      segmentAssetCount: videoSegmentIds.length,
      completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : new Date().toISOString(),
      prompt: task.config.prompt,
      resolution: task.config.resolution,
      ratio: task.config.ratio,
    },
  };
}

function applyFinalVideoAssetWriteback(task: BackgroundTask, productionProject: ProductionProject): ProductionProject {
  const finalVideoAsset = buildFinalVideoAsset(task, productionProject);
  const deliverableAssetId = productionProject.semanticPlan.assetLinks.deliverableAssetId;
  const videoSegmentIds = productionProject.assets
    .filter(asset => asset.kind === 'videoSegment')
    .map(asset => asset.id);
  const edgesWithSegments = videoSegmentIds.reduce(
    (edges, segmentId) => addEdgeOnce(edges, { from: segmentId, to: finalVideoAsset.id, relation: 'feeds' }),
    productionProject.graph.edges,
  );
  const graphNodes = productionProject.graph.nodes.some(node => node.id === finalVideoAsset.id)
    ? productionProject.graph.nodes.map(node => (
        node.id === finalVideoAsset.id
          ? { id: finalVideoAsset.id, kind: finalVideoAsset.kind, name: finalVideoAsset.name, status: finalVideoAsset.status }
          : node
      ))
    : [
        ...productionProject.graph.nodes,
        { id: finalVideoAsset.id, kind: finalVideoAsset.kind, name: finalVideoAsset.name, status: finalVideoAsset.status },
      ];
  const graphEdges = addEdgeOnce(edgesWithSegments, { from: finalVideoAsset.id, to: deliverableAssetId, relation: 'tracks' });

  return {
    ...productionProject,
    assets: upsertAsset(productionProject.assets, finalVideoAsset),
    graph: {
      nodes: graphNodes,
      edges: graphEdges,
    },
    stages: productionProject.stages.map(stage => {
      if (stage.id !== 'delivery') return stage;
      return {
        ...stage,
        status: 'completed',
        summary: '最终成片已归档为可复用资产，可进入首页案例、素材库和导出链路。',
        assetIds: Array.from(new Set([...stage.assetIds, finalVideoAsset.id])),
      };
    }),
    output: {
      ...productionProject.output,
      status: 'completed',
      canProceedToVideo: false,
      nextStep: '最终成片和片段资产均已归档，可进入首页案例、素材库和导出链路。',
    },
    semanticPlan: {
      ...productionProject.semanticPlan,
      dag: {
        nodes: productionProject.semanticPlan.dag.nodes.map(node => {
          if (node.nodeId !== 'n_assembly') return node;
          return {
            ...node,
            status: 'completed',
            result: {
              ...node.result,
              finalVideoAssetId: finalVideoAsset.id,
              videoUrl: task.result?.videoUrl,
              completedAt: finalVideoAsset.metadata?.completedAt,
            },
          };
        }),
      },
    },
  };
}

export function archiveCompletedVideoTaskAsProductionProject(params: ArchiveVideoTaskParams): ArchivedVideoTaskResult {
  const { task } = params;
  if (task.type !== 'video') {
    throw new Error('只能归档 video 类型任务');
  }
  if (task.status !== 'completed' || !task.result?.videoUrl) {
    throw new Error('只能归档已完成且有最终 videoUrl 的任务');
  }
  const segments = task.result.segments || [];
  if (segments.length === 0) {
    throw new Error('任务缺少可归档的 segments，无法生成 videoSegment 资产');
  }

  let productionProject = task.result.productionProject
    ? task.result.productionProject as ReturnType<typeof createArchiveProject>
    : createArchiveProject(task);
  let assemblyPlan = task.result.assemblyPlan
    ? task.result.assemblyPlan as ReturnType<typeof buildProductionAssemblyPlan>
    : buildProductionAssemblyPlan({
      productionProject,
      sourceTaskId: task.id,
    });

  for (const segment of segments) {
    if (!segment.videoUrl) continue;
    const index = Number.isFinite(segment.index) ? segment.index : segments.indexOf(segment);
    const writeback = applySegmentAssetWriteback({
      productionProject,
      assemblyPlan,
      segmentIndex: index,
      patch: {
        status: 'completed',
        completedAt: new Date(task.completedAt || Date.now()).toISOString(),
        expectedOutputs: {
          taskId: segment.taskId || `${task.id}-segment-${index + 1}`,
          providerTaskId: segment.providerTaskId || null,
          videoUrl: segment.videoUrl,
          lastFrameUrl: segment.lastFrameUrl || null,
        },
      },
    });
    productionProject = writeback.productionProject || productionProject;
    assemblyPlan = writeback.assemblyPlan;
  }

  productionProject = applyFinalVideoAssetWriteback(task, productionProject);

  const segmentAssetCount = productionProject.assets.filter(asset => asset.kind === 'videoSegment').length;
  const finalVideoAssetCount = productionProject.assets.filter(asset => asset.kind === 'finalVideo').length;
  const result: TaskResult = {
    ...task.result,
    productionProject,
    assemblyPlan,
    archivedProductionCase: {
      version: 'yh-archived-production-case-v1',
      sourceTaskId: task.id,
      segmentAssetCount,
      finalVideoAssetCount,
      archivedAt: new Date().toISOString(),
    },
  };

  return {
    result,
    productionProjectId: productionProject.id,
    segmentAssetCount,
    finalVideoAssetCount,
    assemblyStatus: assemblyPlan.status,
  };
}
