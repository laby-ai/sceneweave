import type { BackgroundTask } from './task-manager';
import { getTaskFresh, updateTask } from './task-manager';
import {
  isStoryPlanningAssetKind,
  markAssemblyPlanStaleForProjectChange,
} from './production-artifact-stale';
import type { ProductionAssemblyPlan } from './production-assembly-plan';
import type { ProductionAsset, ProductionProject } from './production-project';

type ProductionAssetStatus = ProductionAsset['status'];

export interface ProductionAssetPatchInput {
  name?: unknown;
  summary?: unknown;
  status?: unknown;
  metadata?: unknown;
}

export interface ProductionAssetWritebackResult {
  task: BackgroundTask;
  productionProject: ProductionProject;
  asset: ProductionAsset;
  changedFields: string[];
}

const allowedStatuses = new Set<ProductionAssetStatus>([
  'planned',
  'ready',
  'running',
  'failed',
  'completed',
  'pending',
]);

function asText(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`${field} 必须是字符串`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} 不能为空`);
  }
  return trimmed;
}

function asStatus(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !allowedStatuses.has(value as ProductionAssetStatus)) {
    throw new Error(`status 不受支持：${String(value)}`);
  }
  return value as ProductionAssetStatus;
}

function asMetadata(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('metadata 必须是对象');
  }
  return value as Record<string, unknown>;
}

function getProductionProject(task: BackgroundTask) {
  const project = task.result?.productionProject;
  if (!project || typeof project !== 'object') {
    throw new Error(`任务 ${task.id} 缺少 productionProject，无法写回画布资产`);
  }
  return project as ProductionProject;
}

export function patchProductionAssetFromCanvas(params: {
  taskId: string;
  assetId: string;
  patch: ProductionAssetPatchInput;
}): ProductionAssetWritebackResult {
  const taskId = params.taskId.trim();
  const assetId = params.assetId.trim();

  if (!taskId) throw new Error('缺少 taskId');
  if (!assetId) throw new Error('缺少 assetId');

  const task = getTaskFresh(taskId);
  if (!task) {
    throw new Error(`任务 ${taskId} 不存在或已过期`);
  }

  const productionProject = getProductionProject(task);
  const assetIndex = productionProject.assets.findIndex(asset => asset.id === assetId);
  if (assetIndex < 0) {
    throw new Error(`制作项目 ${productionProject.id} 中不存在资产 ${assetId}`);
  }

  const currentAsset = productionProject.assets[assetIndex];
  const nextAsset: ProductionAsset = { ...currentAsset };
  const changedFields: string[] = [];

  const name = asText(params.patch.name, 'name');
  if (name !== undefined && name !== currentAsset.name) {
    nextAsset.name = name;
    changedFields.push('name');
  }

  const summary = asText(params.patch.summary, 'summary');
  if (summary !== undefined && summary !== currentAsset.summary) {
    nextAsset.summary = summary;
    changedFields.push('summary');
  }

  const status = asStatus(params.patch.status);
  if (status !== undefined && status !== currentAsset.status) {
    nextAsset.status = status;
    changedFields.push('status');
  }

  const metadata = asMetadata(params.patch.metadata);
  if (metadata !== undefined) {
    nextAsset.metadata = {
      ...(currentAsset.metadata || {}),
      ...metadata,
      updatedFromCanvasAt: new Date().toISOString(),
    };
    changedFields.push('metadata');
  } else if (changedFields.length > 0) {
    nextAsset.metadata = {
      ...(currentAsset.metadata || {}),
      updatedFromCanvasAt: new Date().toISOString(),
    };
  }

  if (changedFields.length === 0) {
    return { task, productionProject, asset: currentAsset, changedFields };
  }

  const nextProject: ProductionProject = {
    ...productionProject,
    assets: productionProject.assets.map((asset, index) => (index === assetIndex ? nextAsset : asset)),
    graph: {
      ...productionProject.graph,
      nodes: productionProject.graph.nodes.map(node =>
        node.id === assetId
          ? {
              ...node,
              name: nextAsset.name,
              status: nextAsset.status,
            }
          : node,
      ),
    },
  };
  const stale = isStoryPlanningAssetKind(nextAsset.kind)
    ? markAssemblyPlanStaleForProjectChange({
        productionProject: nextProject,
        assemblyPlan: task.result?.assemblyPlan as ProductionAssemblyPlan | undefined,
        changedAssetIds: [assetId],
        reason: 'asset-writeback',
      })
    : null;

  const updatedTask = updateTask(task.id, {
    result: {
      ...(task.result || {}),
      productionProject: nextProject,
      ...(stale?.assemblyPlan ? { assemblyPlan: stale.assemblyPlan } : {}),
    },
  });

  if (!updatedTask) {
    throw new Error(`任务 ${task.id} 写回失败`);
  }

  return {
    task: updatedTask,
    productionProject: nextProject,
    asset: nextAsset,
    changedFields,
  };
}
