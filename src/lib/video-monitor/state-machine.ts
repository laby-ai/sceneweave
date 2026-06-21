/**
 * 任务状态机引擎
 * 实现六态模型：pending → processing → assembling → post_processing → completed / failed
 */

import type {
  MonitorTask,
  MonitorTaskStatus,
  StatusTransition,
  StateChangeResult,
  OperationLog,
} from './types';
import { TRANSITION_RULES, STATUS_PROGRESS_RANGE, STATUS_STEP_DESCRIPTIONS } from './constants';

export class StateMachine {
  /**
   * 尝试转换任务状态
   */
  static tryTransition(
    task: MonitorTask,
    event: StatusTransition,
    reason?: string,
  ): StateChangeResult {
    const rule = TRANSITION_RULES.find(
      (r) => r.from === task.status && r.event === event,
    );

    if (!rule) {
      return {
        success: false,
        previousStatus: task.status,
        newStatus: task.status,
        timestamp: Date.now(),
        reason: `不允许的状态流转: ${task.status} + ${event}`,
      };
    }

    // 执行守卫检查
    if (rule.guard && !rule.guard(task)) {
      return {
        success: false,
        previousStatus: task.status,
        newStatus: task.status,
        timestamp: Date.now(),
        reason: '守卫条件不满足',
      };
    }

    const previousStatus = task.status;
    task.status = rule.to;
    task.updatedAt = Date.now();

    // 自动更新进度和步骤描述
    const range = STATUS_PROGRESS_RANGE[rule.to];
    if (task.progress < range[0]) {
      task.progress = range[0];
    }
    task.currentStep = STATUS_STEP_DESCRIPTIONS[rule.to];

    return {
      success: true,
      previousStatus,
      newStatus: rule.to,
      timestamp: Date.now(),
      reason,
    };
  }

  /**
   * 获取当前状态的合法下一步流转
   */
  static getAvailableTransitions(status: MonitorTaskStatus): StatusTransition[] {
    return TRANSITION_RULES
      .filter((r) => r.from === status)
      .map((r) => r.event);
  }

  /**
   * 获取当前状态的合法目标状态
   */
  static getNextStatuses(status: MonitorTaskStatus): MonitorTaskStatus[] {
    return TRANSITION_RULES
      .filter((r) => r.from === status)
      .map((r) => r.to);
  }

  /**
   * 判断是否为终态
   */
  static isTerminal(status: MonitorTaskStatus): boolean {
    return status === 'completed' || status === 'failed';
  }

  /**
   * 判断是否为活跃状态
   */
  static isActive(status: MonitorTaskStatus): boolean {
    return ['processing', 'assembling', 'post_processing'].includes(status);
  }

  /**
   * 创建状态变更的操作日志
   */
  static createTransitionLog(
    taskId: string,
    result: StateChangeResult,
  ): OperationLog {
    return {
      logId: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      taskId,
      operationType: 'status_change',
      fromStatus: result.previousStatus,
      toStatus: result.newStatus,
      detail: result.reason || `状态变更: ${result.previousStatus} → ${result.newStatus}`,
      createdAt: Date.now(),
    };
  }
}
