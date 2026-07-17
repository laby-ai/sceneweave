import type { TaskResult } from '@/lib/task-manager';
import { parseVimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';

export type VimaxSegmentedProductionTaskResult = Pick<TaskResult, 'assemblyPlan' | 'assemblyQueue'> & {
  productionPlan?: unknown;
  productionProject?: {
    assets?: Array<{ kind?: string; metadata?: { videoUrl?: string } }>;
  };
};

export interface VimaxSegmentedProductionAction {
  label?: string;
  path: string;
  body: Record<string, unknown>;
}

export interface VimaxSegmentedProductionSegmentView {
  index: number;
  title: string;
  duration: number;
  status: string;
  error: string | null;
  retryAction: VimaxSegmentedProductionAction | null;
}

export interface VimaxSegmentedProductionView {
  state: 'ready' | 'queued' | 'running' | 'partial' | 'failed' | 'completed';
  statusLabel: string;
  segments: VimaxSegmentedProductionSegmentView[];
  primaryAction: VimaxSegmentedProductionAction | null;
  exportPath: string | null;
}

const STATUS_LABELS: Record<VimaxSegmentedProductionView['state'], string> = {
  ready: '分镜已就绪',
  queued: '片段已排队',
  running: '片段制作中',
  partial: '部分片段已完成',
  failed: '有片段需要重试',
  completed: '全部片段已完成',
};

function resolveState(result?: TaskResult): VimaxSegmentedProductionView['state'] {
  const segments = result?.assemblyPlan?.segments || [];
  if (!result?.assemblyQueue) return 'ready';
  if (segments.some(segment => segment.status === 'failed')) return 'failed';
  if (segments.length > 0 && segments.every(segment => segment.status === 'completed')) return 'completed';
  if (segments.some(segment => segment.status === 'running')) return 'running';
  if (segments.some(segment => segment.status === 'completed')) return 'partial';
  if (segments.some(segment => segment.status === 'queued')) return 'queued';
  return 'ready';
}

export function buildVimaxSegmentedProductionView(
  taskId: string,
  result?: VimaxSegmentedProductionTaskResult,
): VimaxSegmentedProductionView {
  const state = resolveState(result);
  const productionPlan = parseVimaxProductionPlan(result?.productionPlan);
  const hasSuccessfulFinalVideo = result?.productionProject?.assets?.some(asset => (
    asset.kind === 'finalVideo'
    && typeof asset.metadata?.videoUrl === 'string'
    && asset.metadata.videoUrl.length > 0
  )) === true;
  const canExport = hasSuccessfulFinalVideo || (
    productionPlan?.governance.status === 'delivery-ready'
    && productionPlan.render.status === 'draft-ready'
  );
  const segments = (result?.assemblyPlan?.segments || []).map(segment => {
    const childTaskId = segment.expectedOutputs?.taskId || undefined;
    return {
      index: segment.index,
      title: `片段 ${segment.index + 1}`,
      duration: segment.duration,
      status: segment.status,
      error: segment.error || null,
      retryAction: segment.status === 'failed' ? {
        path: '/api/production/assembly-plan/segment/retry',
        body: {
          parentTaskId: taskId,
          segmentIndex: segment.index,
          ...(childTaskId ? { childTaskId } : {}),
        },
      } : null,
    };
  });

  return {
    state,
    statusLabel: STATUS_LABELS[state],
    segments,
    primaryAction: state === 'ready' ? {
      label: '创建分段任务',
      path: '/api/production/assembly-plan/queue',
      body: { taskId },
    } : null,
    exportPath: canExport ? `/api/production/export?taskId=${encodeURIComponent(taskId)}` : null,
  };
}
