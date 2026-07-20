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
  method?: 'POST' | 'DELETE';
  body?: Record<string, unknown>;
}

export interface VimaxSegmentTaskSnapshot {
  status?: string;
  progress?: number;
  stage?: string;
}

export interface VimaxSegmentedProductionSegmentView {
  index: number;
  title: string;
  duration: number;
  status: string;
  taskId: string | null;
  progress: number;
  stage: string;
  error: string | null;
  retryAction: VimaxSegmentedProductionAction | null;
  cancelAction: VimaxSegmentedProductionAction | null;
}

export interface VimaxSegmentedProductionView {
  taskId: string;
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

function resolveState(
  segments: VimaxSegmentedProductionSegmentView[],
  hasQueue: boolean,
): VimaxSegmentedProductionView['state'] {
  if (!hasQueue) return 'ready';
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
  taskSnapshots: Record<string, VimaxSegmentTaskSnapshot> = {},
): VimaxSegmentedProductionView {
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
  const canQueue = productionPlan?.workflow.operationOrder.includes('segments.queue') === true
    && (productionPlan.governance.status === 'ready' || productionPlan.governance.status === 'delivery-ready');
  const segments = (result?.assemblyPlan?.segments || []).map(segment => {
    const childTaskId = segment.expectedOutputs?.taskId || undefined;
    const childTask = childTaskId ? taskSnapshots[childTaskId] : undefined;
    const childStatus = childTask?.status === 'pending' || childTask?.status === 'reconnecting'
      ? 'queued'
      : childTask?.status;
    const status = childStatus || segment.status;
    return {
      index: segment.index,
      title: `片段 ${segment.index + 1}`,
      duration: segment.duration,
      status,
      taskId: childTaskId || null,
      progress: Math.max(0, Math.min(100, childTask?.progress || 0)),
      stage: childTask?.stage || '',
      error: status === 'failed' ? '该片段未完成，可单独重试。' : null,
      retryAction: status === 'failed' || status === 'cancelled' ? {
        path: '/api/production/assembly-plan/segment/retry',
        body: {
          parentTaskId: taskId,
          segmentIndex: segment.index,
          ...(childTaskId ? { childTaskId } : {}),
        },
      } : null,
      cancelAction: childTaskId && (status === 'queued' || status === 'running') ? {
        path: `/api/tasks/${encodeURIComponent(childTaskId)}`,
        method: 'DELETE' as const,
      } : null,
    };
  });
  const state = resolveState(segments, Boolean(result?.assemblyQueue));

  return {
    taskId,
    state,
    statusLabel: STATUS_LABELS[state],
    segments,
    primaryAction: state === 'ready' && canQueue ? {
      label: '创建分段任务',
      path: '/api/production/assembly-plan/queue',
      body: { taskId },
    } : null,
    exportPath: canExport ? `/api/production/export?taskId=${encodeURIComponent(taskId)}` : null,
  };
}

export function applyVimaxSegmentTaskSnapshot(
  view: VimaxSegmentedProductionView,
  taskId: string,
  snapshot: VimaxSegmentTaskSnapshot,
): VimaxSegmentedProductionView {
  const segments = view.segments.map(segment => {
    if (segment.taskId !== taskId) return segment;
    const status = snapshot.status === 'pending' || snapshot.status === 'reconnecting'
      ? 'queued'
      : snapshot.status || segment.status;
    return {
      ...segment,
      status,
      progress: Math.max(0, Math.min(100, snapshot.progress ?? segment.progress)),
      stage: snapshot.stage ?? segment.stage,
      error: status === 'failed' ? '该片段未完成，可单独重试。' : null,
      retryAction: status === 'failed' || status === 'cancelled' ? {
        path: '/api/production/assembly-plan/segment/retry',
        body: { parentTaskId: view.taskId, segmentIndex: segment.index, childTaskId: taskId },
      } : null,
      cancelAction: status === 'queued' || status === 'running' ? {
        path: `/api/tasks/${encodeURIComponent(taskId)}`,
        method: 'DELETE' as const,
      } : null,
    };
  });
  return {
    ...view,
    state: resolveState(segments, true),
    statusLabel: STATUS_LABELS[resolveState(segments, true)],
    segments,
  };
}
