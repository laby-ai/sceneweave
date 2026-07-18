import { buildProductionAssemblyPlan, type ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import type { ProductionProject } from '@/lib/production-project';
import { getTaskForOwner, updateTask, type TaskOwner } from '@/lib/task-manager';
import {
  parseVimaxProductionPlan,
  refreshVimaxProductionPlanContinuity,
  type VimaxProductionPlan,
} from '@/lib/skills/vimax-short-drama/vimax-production-plan';

export interface VimaxProductionDirectionPatch {
  artStyle?: unknown;
  directorManual?: unknown;
  [key: string]: unknown;
}

export interface VimaxProductionDirectionWriteback {
  productionProject: ProductionProject;
  productionPlan: VimaxProductionPlan;
  assemblyPlan: ProductionAssemblyPlan;
}

function compact(value: unknown, fallback: string, maxLength: number) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return (text || fallback).slice(0, maxLength);
}

export function resolveVimaxProductionDirection(project: ProductionProject) {
  return {
    artStyle: compact(project.creativeDirection?.artStyle, project.style || '电影感短剧', 300),
    directorManual: compact(
      project.creativeDirection?.directorManual,
      '遵循已确认的角色、场景、道具、轴线和动作连续性。',
      1000,
    ),
  };
}

export function updateVimaxProductionDirectionForTask(input: {
  taskId: string;
  owner: TaskOwner;
  patch: VimaxProductionDirectionPatch;
}): VimaxProductionDirectionWriteback {
  const task = getTaskForOwner(input.taskId, input.owner);
  if (!task) throw new Error('创作项目不存在或无权访问');
  const project = task.result?.productionProject as ProductionProject | undefined;
  const persistedPlan = parseVimaxProductionPlan(task.result?.productionPlan);
  if (!project || !Array.isArray(project.assets) || !persistedPlan) {
    throw new Error('当前项目缺少完整制作合约');
  }

  const current = resolveVimaxProductionDirection(project);
  const artStyle = compact(input.patch.artStyle, current.artStyle, 300);
  const directorManual = compact(input.patch.directorManual, current.directorManual, 1000);
  const changed = artStyle !== current.artStyle || directorManual !== current.directorManual;
  const productionProject: ProductionProject = changed ? {
    ...project,
    style: artStyle,
    creativeDirection: {
      version: 'sceneweave-creative-direction-v1',
      artStyle,
      directorManual,
      revision: (project.creativeDirection?.revision || 0) + 1,
      updatedAt: new Date().toISOString(),
    },
  } : project;
  const assemblyPlan = changed
    ? buildProductionAssemblyPlan({ productionProject, sourceTaskId: task.id })
    : task.result?.assemblyPlan as ProductionAssemblyPlan;
  if (!assemblyPlan) throw new Error('当前项目缺少分段制作合约');
  const productionPlan = refreshVimaxProductionPlanContinuity({
    productionPlan: persistedPlan,
    productionProject,
    assemblyPlan,
  });

  if (changed) {
    const updated = updateTask(task.id, {
      result: { ...(task.result || {}), productionProject, productionPlan, assemblyPlan },
    });
    if (!updated) throw new Error('制作方向写回失败');
  }
  return { productionProject, productionPlan, assemblyPlan };
}
