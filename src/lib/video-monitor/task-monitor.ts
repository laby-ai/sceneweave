/**
 * 任务监测服务
 * 进度追踪 + 断线续追 + 配置快照 + 操作日志
 */

import type {
  MonitorTask,
  MonitorTaskStatus,
  GenerationConfig,
  OperationLog,
  ProgressUpdate,
  ReconnectResponse,
  StateChangeResult,
} from './types';
import { StateMachine } from './state-machine';
import { ErrorHandler } from './error-handler';
import { RetryMechanism } from './retry-mechanism';
import { OutboxEventService } from './outbox-event';
import { STATUS_LABELS, STATUS_STEP_DESCRIPTIONS, STATUS_PROGRESS_RANGE, DEFAULT_RETRY_POLICY } from './constants';

/** 内存任务存储（生产环境应使用数据库） */
const taskStore: Map<string, MonitorTask> = new Map();
const configStore: Map<string, GenerationConfig> = new Map();
const logStore: Map<string, OperationLog[]> = new Map();
const progressHistory: Map<string, ProgressUpdate[]> = new Map();

export class TaskMonitor {
  // ============================================================
  // 任务CRUD
  // ============================================================

  /**
   * 创建监测任务
   */
  static createTask(userId: string, projectName?: string): MonitorTask {
    const task: MonitorTask = {
      taskId: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      projectName,
      status: 'pending',
      progress: 0,
      currentStep: STATUS_STEP_DESCRIPTIONS.pending,
      retryCount: 0,
      maxRetries: DEFAULT_RETRY_POLICY.maxRetries,
      isDeleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    taskStore.set(task.taskId, task);
    logStore.set(task.taskId, []);

    this.addLog(task.taskId, {
      operationType: 'create',
      detail: `创建任务: ${projectName || task.taskId}`,
    });

    return task;
  }

  /**
   * 获取任务
   */
  static getTask(taskId: string): MonitorTask | undefined {
    return taskStore.get(taskId);
  }

  /**
   * 获取用户的所有任务
   */
  static getUserTasks(userId: string): MonitorTask[] {
    return Array.from(taskStore.values())
      .filter((t) => t.userId === userId && !t.isDeleted)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 获取所有任务
   */
  static getAllTasks(status?: MonitorTaskStatus): MonitorTask[] {
    const tasks = Array.from(taskStore.values())
      .filter((t) => !t.isDeleted);
    if (status) {
      return tasks.filter((t) => t.status === status);
    }
    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 更新进度
   */
  static updateProgress(taskId: string, progress: number, step?: string): MonitorTask | null {
    const task = taskStore.get(taskId);
    if (!task || StateMachine.isTerminal(task.status)) return null;

    task.progress = Math.min(100, Math.max(0, progress));
    if (step) task.currentStep = step;
    task.updatedAt = Date.now();

    // 记录进度历史
    const update: ProgressUpdate = {
      taskId,
      status: task.status,
      progress: task.progress,
      step: task.currentStep,
      timestamp: Date.now(),
    };

    const history = progressHistory.get(taskId) || [];
    history.push(update);
    progressHistory.set(taskId, history);

    // 创建Outbox事件
    OutboxEventService.createEvent('progress.updated', taskId, update as unknown as Record<string, unknown>);

    return task;
  }

  /**
   * 状态转换
   */
  static transitionStatus(
    taskId: string,
    event: Parameters<typeof StateMachine.tryTransition>[1],
    reason?: string,
  ): StateChangeResult | null {
    const task = taskStore.get(taskId);
    if (!task) return null;

    const result = StateMachine.tryTransition(task, event, reason);
    if (result.success) {
      // 记录操作日志
      const log = StateMachine.createTransitionLog(taskId, result);
      const logs = logStore.get(taskId) || [];
      logs.push(log);
      logStore.set(taskId, logs);

      // 创建Outbox事件
      OutboxEventService.createFromLog(log);

      // 记录进度历史
      const update: ProgressUpdate = {
        taskId,
        status: task.status,
        progress: task.progress,
        step: task.currentStep,
        timestamp: Date.now(),
      };
      const history = progressHistory.get(taskId) || [];
      history.push(update);
      progressHistory.set(taskId, history);
    }

    return result;
  }

  /**
   * 标记失败
   */
  static markFailed(taskId: string, rawError: string): MonitorTask | null {
    const task = taskStore.get(taskId);
    if (!task) return null;

    const diagnostic = ErrorHandler.diagnose(rawError);
    task.status = 'failed';
    task.errorMessage = diagnostic.userMessage;
    task.errorCode = diagnostic.errorCode;
    task.updatedAt = Date.now();

    this.addLog(taskId, {
      operationType: 'error',
      detail: `任务失败: ${diagnostic.userMessage} (${diagnostic.errorCode})`,
      metadata: { errorCode: diagnostic.errorCode, retryable: diagnostic.retryable },
    });

    return task;
  }

  /**
   * 重试任务
   */
  static retryTask(taskId: string): { task: MonitorTask; decision: ReturnType<typeof RetryMechanism.decide> } | null {
    const task = taskStore.get(taskId);
    if (!task || task.status !== 'failed') return null;

    const decision = RetryMechanism.decide(
      task.errorMessage || 'unknown',
      task.retryCount,
    );

    if (decision.shouldRetry) {
      task.retryCount = decision.nextRetryCount;
      task.status = 'pending';
      task.progress = 0;
      task.currentStep = STATUS_STEP_DESCRIPTIONS.pending;
      task.errorMessage = undefined;
      task.errorCode = undefined;
      task.updatedAt = Date.now();

      this.addLog(taskId, {
        operationType: 'retry',
        detail: `重试任务 (第${task.retryCount}次): ${decision.reason}`,
      });
    }

    return { task, decision };
  }

  /**
   * 删除任务（软删除）
   */
  static deleteTask(taskId: string): boolean {
    const task = taskStore.get(taskId);
    if (!task) return false;

    task.isDeleted = true;
    task.updatedAt = Date.now();
    this.addLog(taskId, { operationType: 'delete', detail: '删除任务' });
    return true;
  }

  // ============================================================
  // 配置快照
  // ============================================================

  /**
   * 保存配置快照
   */
  static saveConfig(
    taskId: string,
    mainPrompt: string,
    options?: Partial<Omit<GenerationConfig, 'configId' | 'taskId' | 'createdAt'>>,
  ): GenerationConfig {
    const config: GenerationConfig = {
      configId: `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      taskId,
      parentConfigId: options?.parentConfigId,
      branchName: options?.branchName || 'main',
      configVersion: options?.configVersion || 1,
      mainPrompt,
      negativePrompt: options?.negativePrompt,
      scriptJson: options?.scriptJson,
      modelName: options?.modelName,
      modelVersion: options?.modelVersion,
      paramsJson: options?.paramsJson,
      costCredits: options?.costCredits,
      createdAt: Date.now(),
    };

    configStore.set(config.configId, config);

    this.addLog(taskId, {
      operationType: 'config_save',
      detail: `保存配置快照: ${config.branchName} v${config.configVersion}`,
      metadata: { configId: config.configId },
    });

    return config;
  }

  /**
   * 获取任务的配置历史
   */
  static getTaskConfigs(taskId: string): GenerationConfig[] {
    return Array.from(configStore.values())
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // ============================================================
  // 操作日志
  // ============================================================

  /**
   * 获取操作日志
   */
  static getTaskLogs(taskId: string): OperationLog[] {
    return logStore.get(taskId) || [];
  }

  // ============================================================
  // 断线续追
  // ============================================================

  /**
   * 断线续追：获取离线期间的状态更新
   */
  static reconnect(taskId: string, lastKnownUpdatedAt: number): ReconnectResponse | null {
    const task = taskStore.get(taskId);
    if (!task) return null;

    const history = progressHistory.get(taskId) || [];
    const missedUpdates = history.filter((u) => u.timestamp > lastKnownUpdatedAt);

    return { task, missedUpdates };
  }

  // ============================================================
  // 私有方法
  // ============================================================

  private static addLog(
    taskId: string,
    log: { operationType: OperationLog['operationType']; detail: string; metadata?: Record<string, unknown> },
  ): void {
    const logs = logStore.get(taskId) || [];
    logs.push({
      logId: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      taskId,
      ...log,
      createdAt: Date.now(),
    });
    logStore.set(taskId, logs);
  }
}
