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
  relatedShotIds?: unknown;
  versionAction?: unknown;
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

type AssetVersionStatus = 'draft' | 'approved' | 'superseded' | 'failed';

interface AssetVersionMetadata {
  rootAssetId: string;
  parentAssetId: string | null;
  number: number;
  status: AssetVersionStatus;
}

function asVersionAction(value: unknown) {
  if (value === undefined) return undefined;
  if (value !== 'derive' && value !== 'approve') {
    throw new Error(`versionAction 不受支持：${String(value)}`);
  }
  return value;
}

function readAssetVersion(asset: ProductionAsset): AssetVersionMetadata | undefined {
  const candidate = asset.metadata?.assetVersion;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return undefined;
  const value = candidate as Partial<AssetVersionMetadata>;
  if (typeof value.rootAssetId !== 'string'
    || (value.parentAssetId !== null && typeof value.parentAssetId !== 'string')
    || typeof value.number !== 'number'
    || !['draft', 'approved', 'superseded', 'failed'].includes(String(value.status))) return undefined;
  return value as AssetVersionMetadata;
}

function withAssetVersion(asset: ProductionAsset, version: AssetVersionMetadata): ProductionAsset {
  return {
    ...asset,
    metadata: {
      ...(asset.metadata || {}),
      assetVersion: version,
      updatedFromCanvasAt: new Date().toISOString(),
    },
  };
}

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

function asRelatedShotIds(value: unknown, productionProject: ProductionProject) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0
    || !value.every(shotId => typeof shotId === 'string' && shotId.trim())) {
    throw new Error('relatedShotIds 必须是非空镜头 ID 数组');
  }
  const allowedShotIds = new Set(productionProject.storyboard.shots.map(shot => shot.id));
  const shotIds = [...new Set(value.map(shotId => shotId.trim()))];
  const unknownShotId = shotIds.find(shotId => !allowedShotIds.has(shotId));
  if (unknownShotId) throw new Error(`镜头 ${unknownShotId} 不存在`);
  return shotIds;
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
  const versionAction = asVersionAction(params.patch.versionAction);

  if (versionAction === 'derive') {
    const currentVersion = readAssetVersion(currentAsset);
    const rootAssetId = currentVersion?.rootAssetId || currentAsset.id;
    const family = productionProject.assets.filter(asset =>
      asset.id === rootAssetId || readAssetVersion(asset)?.rootAssetId === rootAssetId,
    );
    const nextNumber = Math.max(1, ...family.map(asset => readAssetVersion(asset)?.number || 1)) + 1;
    const derivedId = `${rootAssetId}-v${nextNumber}`;
    if (productionProject.assets.some(asset => asset.id === derivedId)) {
      throw new Error(`资产版本 ${derivedId} 已存在`);
    }
    const derivedAsset = withAssetVersion({
      ...currentAsset,
      id: derivedId,
      name: asText(params.patch.name, 'name') ?? currentAsset.name,
      summary: asText(params.patch.summary, 'summary') ?? currentAsset.summary,
      status: 'planned',
      relatedShotIds: asRelatedShotIds(params.patch.relatedShotIds, productionProject)
        ?? currentAsset.relatedShotIds,
      metadata: {
        ...(currentAsset.metadata || {}),
        ...(asMetadata(params.patch.metadata) || {}),
      },
    }, {
      rootAssetId,
      parentAssetId: currentAsset.id,
      number: nextNumber,
      status: 'draft',
    });
    const nextProject: ProductionProject = {
      ...productionProject,
      assets: [...productionProject.assets, derivedAsset],
      graph: {
        nodes: [...productionProject.graph.nodes, {
          id: derivedAsset.id,
          kind: derivedAsset.kind,
          name: derivedAsset.name,
          status: derivedAsset.status,
        }],
        edges: [...productionProject.graph.edges, {
          from: derivedAsset.id,
          to: currentAsset.id,
          relation: 'references',
        }],
      },
    };
    return persistAssetWriteback(task, nextProject, derivedAsset, ['assetVersion'], [derivedAsset.id]);
  }

  if (versionAction === 'approve') {
    const currentVersion = readAssetVersion(currentAsset);
    if (!currentVersion || currentVersion.status !== 'draft') {
      throw new Error('只有待批准的派生资产版本可以批准');
    }
    const nextAssets = productionProject.assets.map(asset => {
      const version = readAssetVersion(asset);
      const belongsToFamily = asset.id === currentVersion.rootAssetId
        || version?.rootAssetId === currentVersion.rootAssetId;
      if (!belongsToFamily) return asset;
      if (asset.id === currentAsset.id) {
        return withAssetVersion({ ...asset, status: 'ready' }, { ...currentVersion, status: 'approved' });
      }
      if (!version && asset.id === currentVersion.rootAssetId) {
        return withAssetVersion(asset, {
          rootAssetId: currentVersion.rootAssetId,
          parentAssetId: null,
          number: 1,
          status: 'superseded',
        });
      }
      return version?.status === 'approved'
        ? withAssetVersion(asset, { ...version, status: 'superseded' })
        : asset;
    });
    const approvedAsset = nextAssets.find(asset => asset.id === currentAsset.id)!;
    const nextProject: ProductionProject = {
      ...productionProject,
      assets: nextAssets,
      graph: {
        ...productionProject.graph,
        nodes: productionProject.graph.nodes.map(node =>
          node.id === approvedAsset.id ? { ...node, status: approvedAsset.status } : node,
        ),
      },
    };
    return persistAssetWriteback(
      task,
      nextProject,
      approvedAsset,
      ['assetVersion'],
      nextAssets.filter((asset, index) => asset !== productionProject.assets[index]).map(asset => asset.id),
    );
  }

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
    const version = readAssetVersion(currentAsset);
    if (status === 'failed' && version) {
      nextAsset.metadata = {
        ...(nextAsset.metadata || {}),
        assetVersion: { ...version, status: 'failed' },
      };
    }
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
      ...(nextAsset.metadata || {}),
      updatedFromCanvasAt: new Date().toISOString(),
    };
  }

  const relatedShotIds = asRelatedShotIds(params.patch.relatedShotIds, productionProject);
  if (relatedShotIds !== undefined
    && JSON.stringify(relatedShotIds) !== JSON.stringify(currentAsset.relatedShotIds || [])) {
    nextAsset.relatedShotIds = relatedShotIds;
    changedFields.push('relatedShotIds');
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
  return persistAssetWriteback(task, nextProject, nextAsset, changedFields, [assetId]);
}

function persistAssetWriteback(
  task: BackgroundTask,
  productionProject: ProductionProject,
  asset: ProductionAsset,
  changedFields: string[],
  changedAssetIds: string[],
): ProductionAssetWritebackResult {
  const stale = isStoryPlanningAssetKind(asset.kind)
    ? markAssemblyPlanStaleForProjectChange({
        productionProject,
        assemblyPlan: task.result?.assemblyPlan as ProductionAssemblyPlan | undefined,
        changedAssetIds,
        reason: 'asset-writeback',
      })
    : null;
  const updatedTask = updateTask(task.id, {
    result: {
      ...(task.result || {}),
      productionProject,
      ...(stale?.assemblyPlan ? { assemblyPlan: stale.assemblyPlan } : {}),
    },
  });
  if (!updatedTask) throw new Error(`任务 ${task.id} 写回失败`);
  return { task: updatedTask, productionProject, asset, changedFields };
}
