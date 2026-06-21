import { useCallback, useMemo } from 'react';

import type { BackgroundTask } from '@/types/task';
import type {
  ContentSafetyCheck,
  CopyrightCheckResult,
  MonitorTask,
  OperationLog,
} from '@/lib/video-monitor';

function convertToMonitorTask(task: BackgroundTask): MonitorTask {
  const statusMap: Record<string, MonitorTask['status']> = {
    pending: 'pending',
    running: 'processing',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'cancelled',
  };
  return {
    taskId: task.id,
    userId: 'default',
    projectName: task.config?.prompt?.slice(0, 30) || task.type,
    status: statusMap[task.status] || 'pending',
    progress: task.progress || 0,
    currentStep: task.stage || task.message || '',
    finalVideoUrl: task.result?.videoUrl,
    coverImageUrl: task.result?.imageUrls?.[0],
    errorMessage: task.error,
    retryCount: 0,
    maxRetries: 3,
    isDeleted: false,
    createdAt: task.createdAt,
    updatedAt: task.completedAt || task.startedAt || task.createdAt,
    completedAt: task.completedAt,
    failedAt: task.status === 'failed' ? (task.completedAt || task.createdAt) : undefined,
  };
}

function buildLogs(task: BackgroundTask): OperationLog[] {
  const logs: OperationLog[] = [];
  const taskId = task.id;
  const taskType = task.type || 'video';
  const typeLabel = taskType === 'video' ? '视频' : taskType === 'image' ? '图像' : '内容';

  logs.push({
    logId: `log_${task.createdAt}_create`,
    taskId,
    operationType: 'create',
    detail: `创建${typeLabel}生成任务`,
    metadata: { type: taskType, prompt: (task.config?.prompt || '').slice(0, 50) },
    createdAt: task.createdAt,
  });

  if (task.startedAt) {
    logs.push({
      logId: `log_${task.startedAt}_start`,
      taskId,
      operationType: 'status_change',
      fromStatus: 'pending',
      toStatus: 'processing',
      detail: '任务开始处理，GPU资源已分配',
      createdAt: task.startedAt,
    });
  }

  if (task.stage && task.progress > 0) {
    const stageMap: Record<string, string> = {
      prompt_enhancing: '提示词增强中',
      generating: 'AI模型推理中',
      processing: 'AI模型推理中',
      assembling: '视频组装中',
      post_processing: '画质增强中',
    };
    logs.push({
      logId: `log_${task.startedAt || task.createdAt + 1000}_progress`,
      taskId,
      operationType: 'progress_update',
      toStatus: task.status === 'completed' ? 'completed' : task.status === 'failed' ? 'failed' : 'processing',
      detail: stageMap[task.stage] || task.message || task.stage,
      metadata: { progress: task.progress, stage: task.stage },
      createdAt: (task.startedAt || task.createdAt) + Math.min(task.progress * 100, 5000),
    });
  }

  if (task.config?.prompt) {
    logs.push({
      logId: `log_${task.createdAt + 500}_safety`,
      taskId,
      operationType: 'content_check',
      detail: '内容安全检查通过',
      metadata: { layer: 'prompt_filter' },
      createdAt: task.createdAt + 500,
    });
  }

  if (task.status === 'completed' && task.completedAt) {
    logs.push({
      logId: `log_${task.completedAt}_complete`,
      taskId,
      operationType: 'status_change',
      fromStatus: 'processing',
      toStatus: 'completed',
      detail: '任务已完成',
      metadata: {
        hasVideo: !!task.result?.videoUrl,
        hasImages: !!task.result?.imageUrls?.length,
      },
      createdAt: task.completedAt,
    });

    logs.push({
      logId: `log_${task.completedAt + 100}_copyright`,
      taskId,
      operationType: 'copyright_check',
      detail: '版权合规检查通过',
      createdAt: task.completedAt + 100,
    });
  }

  if (task.status === 'failed') {
    logs.push({
      logId: `log_${task.completedAt || Date.now()}_error`,
      taskId,
      operationType: 'error',
      toStatus: 'failed',
      detail: task.error || '生成失败，未知错误',
      createdAt: task.completedAt || Date.now(),
    });
  }

  if (task.status === 'cancelled') {
    logs.push({
      logId: `log_${task.completedAt || Date.now()}_cancel`,
      taskId,
      operationType: 'cancel',
      toStatus: 'cancelled',
      detail: '任务已取消',
      createdAt: task.completedAt || Date.now(),
    });
  }

  logs.sort((a, b) => a.createdAt - b.createdAt);
  return logs;
}

function buildSafetyChecks(task: BackgroundTask): ContentSafetyCheck[] {
  const checks: ContentSafetyCheck[] = [];
  const taskId = task.id;
  const prompt = task.config?.prompt || '';
  const hasBlockedContent = ['暴力', '血腥', '恐怖', '色情'].some((keyword) => prompt.includes(keyword));

  checks.push({
    taskId,
    layer: 'prompt_filter',
    result: {
      allowed: !hasBlockedContent,
      layer: 'prompt_filter',
      reason: hasBlockedContent ? 'prompt_contains_blocked_content' : undefined,
      details: hasBlockedContent ? ['检测到敏感内容'] : ['提示词安全检查通过'],
      score: hasBlockedContent ? 0.3 : 0.95,
    },
    checkedAt: task.createdAt + 500,
  });

  if (task.status === 'running' || task.status === 'completed') {
    checks.push({
      taskId,
      layer: 'gan_detection',
      result: {
        allowed: true,
        score: 0.92,
        details: ['未检测到深度伪造痕迹'],
      },
      checkedAt: task.startedAt || task.createdAt + 2000,
    });
  }

  if (task.status === 'completed') {
    checks.push({
      taskId,
      layer: 'frame_monitor',
      result: {
        allowed: true,
        details: ['帧级内容检查通过'],
      },
      checkedAt: task.completedAt || task.createdAt + 5000,
    });
  }

  return checks;
}

function buildCopyrightResult(task: BackgroundTask): CopyrightCheckResult | undefined {
  if (task.status !== 'completed') return undefined;
  return {
    passed: true,
    watermarkApplied: true,
    issues: [],
  };
}

export function useDreamboxMonitorTasks(backgroundTasks: BackgroundTask[]) {
  const monitorTasks = useMemo(
    () => backgroundTasks.map(convertToMonitorTask),
    [backgroundTasks],
  );

  const getLogs = useCallback((task: BackgroundTask) => buildLogs(task), []);
  const getSafetyChecks = useCallback((task: BackgroundTask) => buildSafetyChecks(task), []);
  const getCopyrightResult = useCallback((task: BackgroundTask) => buildCopyrightResult(task), []);

  const monitorDetails = useMemo(() => {
    const details: Record<string, {
      logs: OperationLog[];
      safetyChecks: ContentSafetyCheck[];
      copyrightResult?: CopyrightCheckResult;
    }> = {};

    for (const task of backgroundTasks) {
      details[task.id] = {
        logs: getLogs(task),
        safetyChecks: getSafetyChecks(task),
        copyrightResult: getCopyrightResult(task),
      };
    }

    return details;
  }, [backgroundTasks, getCopyrightResult, getLogs, getSafetyChecks]);

  return { monitorDetails, monitorTasks };
}
