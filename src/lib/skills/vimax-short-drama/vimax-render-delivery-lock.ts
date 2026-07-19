import type { ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import { computeProductionArtifactRevision } from '@/lib/production-artifact-stale';
import type { ProductionProject } from '@/lib/production-project';

import {
  parseVimaxProductionPlan,
  type VimaxProductionPlan,
  type VimaxRenderReport,
} from './vimax-production-plan';

interface VimaxRenderContext {
  productionProject: unknown;
  assemblyPlan: unknown;
}

function resolveVimaxRenderContext(context: VimaxRenderContext): {
  productionProject: ProductionProject;
  assemblyPlan: ProductionAssemblyPlan;
} {
  const productionProject = context.productionProject as Partial<ProductionProject> | undefined;
  const assemblyPlan = context.assemblyPlan as Partial<ProductionAssemblyPlan> | undefined;
  if (!productionProject
    || typeof productionProject.id !== 'string'
    || !Array.isArray(productionProject.assets)
    || !Array.isArray(productionProject.storyboard?.shots)
    || assemblyPlan?.version !== 'yh-assembly-plan-v1'
    || !Array.isArray(assemblyPlan.segments)) {
    throw new Error('当前项目缺少完整制作合约，不能进入成片合成。');
  }
  return {
    productionProject: productionProject as ProductionProject,
    assemblyPlan: assemblyPlan as ProductionAssemblyPlan,
  };
}

function assertCurrentAssemblyArtifacts(context: VimaxRenderContext) {
  const { productionProject, assemblyPlan } = resolveVimaxRenderContext(context);
  const artifactVersion = computeProductionArtifactRevision(productionProject);
  const invalidSegment = assemblyPlan.segments.find(segment => (
    segment.status !== 'completed'
    || !segment.expectedOutputs.videoUrl
    || !segment.artifactReadiness
    || segment.artifactReadiness.stale
    || segment.artifactReadiness.sourceRevision !== artifactVersion
  ));
  if (assemblyPlan.status !== 'completed' || invalidSegment) {
    throw new Error('当前版本仍有未完成或已失效的片段，不能进入成片合成。');
  }
  return artifactVersion;
}

export function approveVimaxProductionRender(
  value: unknown,
  context: VimaxRenderContext,
): VimaxProductionPlan {
  const plan = parseVimaxProductionPlan(value);
  if (!plan) throw new Error('制作计划已失效，请重新规划。');
  if (plan.governance.status !== 'ready' || plan.estimatedCost.status !== 'confirmed') {
    throw new Error('请先确认制作计划与真实费用，再确认成片合成。');
  }
  const artifactVersion = assertCurrentAssemblyArtifacts(context);
  if (plan.render.checkpointDecision?.artifactVersion === artifactVersion) return plan;
  const approvedAt = new Date().toISOString();
  return {
    ...plan,
    checkpoints: plan.checkpoints.map(checkpoint => checkpoint.id === 'render'
      ? { ...checkpoint, status: 'pending' as const }
      : checkpoint),
    governance: {
      ...plan.governance,
      decisionLog: [
        ...plan.governance.decisionLog,
        { checkpoint: 'render', action: 'approved', at: approvedAt },
      ],
    },
    render: {
      ...plan.render,
      status: 'not-started',
      checkpointDecision: { status: 'approved', artifactVersion, approvedAt },
    },
  };
}

export function assertVimaxProductionRenderCheckpoint(
  value: unknown,
  context: VimaxRenderContext,
): VimaxProductionPlan {
  const plan = parseVimaxProductionPlan(value);
  if (!plan) throw new Error('制作计划已失效，请重新规划。');
  const artifactVersion = assertCurrentAssemblyArtifacts(context);
  if (plan.render.checkpointDecision?.status !== 'approved'
    || plan.render.checkpointDecision.artifactVersion !== artifactVersion) {
    throw new Error('请先确认当前版本的成片合成。');
  }
  return plan;
}

export function recordVimaxSuccessfulRender(
  value: unknown,
  input: VimaxRenderContext & {
    videoUrl: string;
    completedAt: string;
    renderReport?: Omit<VimaxRenderReport, 'artifactVersion'>;
  },
): VimaxProductionPlan {
  const plan = assertVimaxProductionRenderCheckpoint(value, input);
  const { productionProject, assemblyPlan } = resolveVimaxRenderContext(input);
  const artifactVersion = computeProductionArtifactRevision(productionProject);
  if (!input.videoUrl.trim()) throw new Error('成片地址为空，不能记录成功交付。');
  const report = input.renderReport;
  const durationTolerance = Math.max(1, assemblyPlan.totalDuration * 0.1);
  if (!report
    || report.version !== 'sceneweave-render-report-v1'
    || report.status !== 'passed'
    || report.runtime !== plan.render.runtime
    || typeof report.checkedAt !== 'string'
    || !report.checkedAt
    || !Number.isSafeInteger(report.segmentCount)
    || report.segmentCount !== assemblyPlan.segmentCount
    || !Number.isFinite(report.expectedDurationSeconds)
    || !Number.isFinite(report.actualDurationSeconds)
    || Math.abs(report.expectedDurationSeconds - assemblyPlan.totalDuration) > 0.01
    || Math.abs(report.actualDurationSeconds - assemblyPlan.totalDuration) > durationTolerance
    || !Number.isSafeInteger(report.outputBytes)
    || report.outputBytes < 1024) {
    throw new Error('成片质量核验未通过，不能记录成功交付。');
  }
  return {
    ...plan,
    checkpoints: plan.checkpoints.map(checkpoint => checkpoint.id === 'render'
      ? { ...checkpoint, status: 'completed' as const }
      : checkpoint),
    governance: { ...plan.governance, status: 'delivery-ready' },
    render: {
      ...plan.render,
      status: 'completed',
      lastSuccessfulResult: {
        artifactVersion,
        videoUrl: input.videoUrl,
        completedAt: input.completedAt,
        renderReport: { ...report, artifactVersion },
      },
    },
  };
}

export function assertVimaxProductionFinalDelivery(
  value: unknown,
  input: { productionProject: unknown; videoUrl: string },
): VimaxProductionPlan {
  const plan = parseVimaxProductionPlan(value);
  const productionProject = input.productionProject as Partial<ProductionProject> | undefined;
  if (!productionProject
    || typeof productionProject.id !== 'string'
    || !Array.isArray(productionProject.assets)
    || !Array.isArray(productionProject.storyboard?.shots)) {
    throw new Error('当前项目缺少完整制作合约，不能交付成片。');
  }
  const artifactVersion = computeProductionArtifactRevision(productionProject as ProductionProject);
  if (!plan?.render.lastSuccessfulResult
    || plan.render.lastSuccessfulResult.artifactVersion !== artifactVersion) {
    throw new Error('最后一次成功成片与当前项目版本不一致，请重新合成。');
  }
  if (plan.render.lastSuccessfulResult.videoUrl !== input.videoUrl) {
    throw new Error('请求交付的成片与最后一次成功成片不一致。');
  }
  const report = plan.render.lastSuccessfulResult.renderReport;
  if (!report
    || report.status !== 'passed'
    || report.runtime !== plan.render.runtime
    || report.artifactVersion !== artifactVersion) {
    throw new Error('最后一次成功成片缺少当前版本的质量核验，不能交付。');
  }
  return plan;
}
