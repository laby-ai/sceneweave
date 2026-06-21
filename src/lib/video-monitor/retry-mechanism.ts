/**
 * 重试与容错服务
 * 指数退避 + 抖动 + 熔断器
 */

import type {
  ErrorRecoverability,
  RetryPolicy,
  RetryDecision,
  CircuitState,
  CircuitBreakerConfig,
  MonitorTaskStatus,
} from './types';
import { DEFAULT_RETRY_POLICY, CATEGORY_RETRY_POLICIES, DEFAULT_CIRCUIT_BREAKER } from './constants';
import { ErrorHandler } from './error-handler';

export class RetryMechanism {
  /**
   * 判断错误可恢复性
   */
  static classifyRecoverability(rawError: string): ErrorRecoverability {
    const permanentlyUnrecoverable = [
      /invalid.*parameter|invalid.*prompt/i,
      /model.*not.*found|不.*支持/i,
      /authentication.*fail|权限/i,
      /permission.*denied/i,
      /content.*policy|安全/i,
      /insufficient.*credit|积分不足/i,
    ];

    const resourceExhausted = [
      /cuda.*out.of.memory|OOM/i,
      /gpu.*pool|资源/i,
      /rate.*limit|限流/i,
    ];

    const temporarilyUnavailable = [
      /service.*unavailable|维护/i,
      /502|503|504/i,
      /timeout|超时/i,
      /circuit.*break|熔断/i,
    ];

    for (const p of permanentlyUnrecoverable) {
      if (p.test(rawError)) return 'permanent';
    }
    for (const p of resourceExhausted) {
      if (p.test(rawError)) return 'resource_exhausted';
    }
    for (const p of temporarilyUnavailable) {
      if (p.test(rawError)) return 'temporarily_unavailable';
    }

    return 'recoverable';
  }

  /**
   * 计算重试延迟（指数退避 + 抖动）
   */
  static calculateDelay(retryCount: number, policy: RetryPolicy): number {
    const exponentialDelay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, retryCount);
    const cappedDelay = Math.min(exponentialDelay, policy.maxDelayMs);
    const jitter = Math.random() * policy.jitterMs;
    return cappedDelay + jitter;
  }

  /**
   * 做出重试决策
   */
  static decide(
    rawError: string,
    currentRetryCount: number,
    policy?: RetryPolicy,
  ): RetryDecision {
    const recoverability = this.classifyRecoverability(rawError);
    const errorDef = ErrorHandler.classifyError(rawError);
    const effectivePolicy = policy || CATEGORY_RETRY_POLICIES[errorDef.category] || DEFAULT_RETRY_POLICY;

    if (recoverability === 'permanent') {
      return {
        shouldRetry: false,
        delayMs: 0,
        reason: '不可恢复错误，不建议重试',
        nextRetryCount: currentRetryCount,
      };
    }

    if (currentRetryCount >= effectivePolicy.maxRetries) {
      return {
        shouldRetry: false,
        delayMs: 0,
        reason: `已达最大重试次数 (${effectivePolicy.maxRetries})`,
        nextRetryCount: currentRetryCount,
      };
    }

    const delayMs = this.calculateDelay(currentRetryCount, effectivePolicy);
    const reasonMap: Record<ErrorRecoverability, string> = {
      recoverable: '可恢复错误，建议重试',
      permanent: '不可恢复错误',
      resource_exhausted: '资源暂时不足，等待后重试',
      temporarily_unavailable: '服务暂时不可用，等待后重试',
    };

    return {
      shouldRetry: true,
      delayMs: Math.round(delayMs),
      reason: reasonMap[recoverability],
      nextRetryCount: currentRetryCount + 1,
    };
  }
}

/**
 * 熔断器
 */
export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private state: CircuitState = 'closed';
  private lastFailureTime = 0;
  private halfOpenRequests = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER, ...config };
  }

  /**
   * 判断是否允许请求通过
   */
  canExecute(): boolean {
    switch (this.state) {
      case 'closed':
        return true;
      case 'open': {
        const elapsed = Date.now() - this.lastFailureTime;
        if (elapsed >= this.config.resetTimeoutMs) {
          this.state = 'half_open';
          this.halfOpenRequests = 0;
          return true;
        }
        return false;
      }
      case 'half_open':
        return this.halfOpenRequests < this.config.halfOpenMaxRequests;
    }
  }

  /**
   * 记录成功
   */
  recordSuccess(): void {
    if (this.state === 'half_open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  /**
   * 记录失败
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === 'half_open') {
      this.state = 'open';
      this.halfOpenRequests = 0;
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  /**
   * 获取当前熔断器状态
   */
  getState(): { state: CircuitState; failures: number; successes: number } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
    };
  }

  /**
   * 重置熔断器
   */
  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.state = 'closed';
    this.halfOpenRequests = 0;
  }
}
