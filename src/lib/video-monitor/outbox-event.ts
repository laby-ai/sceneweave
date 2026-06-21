/**
 * Outbox事件服务
 * 保证MySQL与消息的原子性
 */

import type { OutboxEvent, OutboxEventStatus, OperationLog } from './types';

/** 内存Outbox存储（生产环境应使用数据库） */
const outboxStore: Map<string, OutboxEvent> = new Map();

export class OutboxEventService {
  /**
   * 创建Outbox事件（与状态变更好同一个事务）
   */
  static createEvent(
    eventType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): OutboxEvent {
    const event: OutboxEvent = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      eventType,
      aggregateId,
      payload,
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now(),
    };

    outboxStore.set(event.eventId, event);
    return event;
  }

  /**
   * 批量获取待投递事件
   */
  static getPendingEvents(limit = 100): OutboxEvent[] {
    return Array.from(outboxStore.values())
      .filter((e) => e.status === 'pending')
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, limit);
  }

  /**
   * 标记事件已投递
   */
  static markDelivered(eventId: string): void {
    const event = outboxStore.get(eventId);
    if (event) {
      event.status = 'delivered';
      event.deliveredAt = Date.now();
    }
  }

  /**
   * 标记事件投递失败
   */
  static markFailed(eventId: string): void {
    const event = outboxStore.get(eventId);
    if (event) {
      event.retryCount++;
      if (event.retryCount >= 3) {
        event.status = 'failed';
      }
      // 保持pending让轮询服务重试
    }
  }

  /**
   * 从操作日志创建事件
   */
  static createFromLog(log: OperationLog): OutboxEvent {
    return this.createEvent(
      `task.${log.operationType}`,
      log.taskId,
      {
        operationType: log.operationType,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        detail: log.detail,
        timestamp: log.createdAt,
      },
    );
  }

  /**
   * 获取指定聚合的所有事件
   */
  static getEventsByAggregate(aggregateId: string): OutboxEvent[] {
    return Array.from(outboxStore.values())
      .filter((e) => e.aggregateId === aggregateId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * 清理已投递的事件
   */
  static cleanup(olderThanMs = 86400000): number {
    const cutoff = Date.now() - olderThanMs;
    let cleaned = 0;
    for (const [key, event] of outboxStore) {
      if (event.status === 'delivered' && (event.deliveredAt || 0) < cutoff) {
        outboxStore.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }
}
