/**
 * 模型路由与健康状态工具。
 *
 * 这里不再维护内置供应商降级链。调用方必须显式传入 executor 顺序，
 * routeWithFallback 只负责按该顺序执行、记录健康状态和返回可审计结果。
 */

// ==================== 类型定义 ====================

export type ServiceType = 'video' | 'image' | 'llm' | 'tts';

export interface ProviderHealth {
  provider: string;
  healthy: boolean;
  lastCheck: number;
  failCount: number;
  avgLatency: number;
}

export interface RouteResult<T> {
  data: T;
  provider: string;
  latency: number;
  degraded: boolean;
  originalProvider?: string;
}

export interface RouteError {
  provider: string;
  error: string;
  code?: string;
  timestamp: number;
}

// ==================== 降级配置 ====================

export const DEGRADE_CONFIG = {
  /** 最大连续失败次数，超过后标记为不健康 */
  maxFailCount: 3,
  /** 健康检查间隔(ms) */
  healthCheckInterval: 60_000,
  /** 不健康状态恢复探针间隔(ms) - 缩短至10秒加快恢复 */
  probeInterval: 10_000,
  /** 请求超时(ms) */
  requestTimeout: {
    video: 300_000,   // 5min (视频生成耗时)
    image: 60_000,    // 1min
    llm: 30_000,      // 30s
    tts: 30_000,      // 30s
  },
} as const;

// ==================== 健康状态管理 ====================

const healthMap = new Map<string, ProviderHealth>();

function getHealthKey(provider: string, service: ServiceType): string {
  return `${provider}:${service}`;
}

function getHealth(provider: string, service: ServiceType): ProviderHealth {
  const key = getHealthKey(provider, service);
  let health = healthMap.get(key);
  if (!health) {
    health = {
      provider,
      healthy: true,
      lastCheck: 0,
      failCount: 0,
      avgLatency: 0,
    };
    healthMap.set(key, health);
  }
  return health;
}

function markUnhealthy(provider: string, service: ServiceType): void {
  const health = getHealth(provider, service);
  health.failCount++;
  health.lastCheck = Date.now();
  if (health.failCount >= DEGRADE_CONFIG.maxFailCount) {
    health.healthy = false;
    console.warn(`[Router] ${provider}/${service} 标记为不健康 (连续失败${health.failCount}次)`);
  }
}

function markHealthy(provider: string, service: ServiceType, latency: number): void {
  const health = getHealth(provider, service);
  health.healthy = true;
  health.failCount = 0;
  health.lastCheck = Date.now();
  // 指数移动平均
  health.avgLatency = health.avgLatency === 0 ? latency : health.avgLatency * 0.7 + latency * 0.3;
}

/** 探针: 尝试恢复不健康的provider */
function shouldProbe(provider: string, service: ServiceType): boolean {
  const health = getHealth(provider, service);
  if (health.healthy) return false;
  return Date.now() - health.lastCheck > DEGRADE_CONFIG.probeInterval;
}

// ==================== 核心路由器 ====================

/**
 * 按降级链执行请求，自动故障转移
 * @param service 服务类型
 * @param executor 各provider的执行函数
 * @returns 路由结果
 */
export async function routeWithFallback<T>(
  service: ServiceType,
  executor: Record<string, () => Promise<T>>
): Promise<RouteResult<T>> {
  const chain = Object.keys(executor);
  const errors: RouteError[] = [];
  const startTime = Date.now();

  if (chain.length === 0) {
    throw new DegradeError(
      `未配置${service}服务执行器`,
      service,
      []
    );
  }

  for (const provider of chain) {
    const health = getHealth(provider, service);

    // 跳过不健康的provider(除非是探针)
    if (!health.healthy && !shouldProbe(provider, service)) {
      console.log(`[Router] 跳过不健康的 ${provider}/${service}`);
      continue;
    }

    const execFn = executor[provider];
    if (!execFn) {
      console.warn(`[Router] ${provider} 无 ${service} 执行器，跳过`);
      continue;
    }

    try {
      const result = await execFn();
      const latency = Date.now() - startTime;
      markHealthy(provider, service, latency);

      const isDegraded = provider !== chain[0];
      if (isDegraded) {
        console.log(`[Router] ${service} 已降级到 ${provider} (原始: ${chain[0]})`);
      }

      return {
        data: result,
        provider,
        latency,
        degraded: isDegraded,
        originalProvider: isDegraded ? chain[0] : undefined,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[Router] ${provider}/${service} 失败:`, errorMessage);
      markUnhealthy(provider, service);
      errors.push({
        provider,
        error: errorMessage,
        timestamp: Date.now(),
      });
    }
  }

  // 所有provider都失败
  throw new DegradeError(
    `所有${service}服务不可用`,
    service,
    errors
  );
}

// ==================== 降级错误 ====================

export class DegradeError extends Error {
  public readonly service: ServiceType;
  public readonly errors: RouteError[];

  constructor(message: string, service: ServiceType, errors: RouteError[]) {
    super(message);
    this.name = 'DegradeError';
    this.service = service;
    this.errors = errors;
  }

  /** 生成用户友好的错误提示 */
  toUserMessage(): string {
    const serviceNames: Record<ServiceType, string> = {
      video: '视频生成',
      image: '图像生成',
      llm: 'AI对话',
      tts: '语音合成',
    };

    const hasContentAudit = this.errors.some(
      e => e.error.includes('1026') || e.error.includes('审核')
    );
    const hasInsufficientBalance = this.errors.some(
      e => e.error.includes('1008') || e.error.includes('余额')
    );

    if (hasContentAudit) {
      return `${serviceNames[this.service]}失败：内容审核不通过，请修改描述后重试`;
    }
    if (hasInsufficientBalance) {
      return `${serviceNames[this.service]}失败：服务余额不足，请联系管理员`;
    }

    // 检测认证/权限错误
    const hasAuthError = this.errors.some(
      e => e.error.includes('403') || e.error.includes('Forbidden') || e.error.includes('未配置') || e.error.includes('API_KEY')
    );
    if (hasAuthError) {
      const providers = this.errors.map(e => e.provider).join('/');
      return `${serviceNames[this.service]}服务暂不可用(${providers}认证失败)，请检查API密钥配置或稍后重试`;
    }

    return `${serviceNames[this.service]}服务暂时不可用，请稍后重试`;
  }
}

// ==================== 状态查询 ====================

/**
 * 获取所有provider的健康状态
 */
export function getProviderHealthStatus(): ProviderHealth[] {
  return Array.from(healthMap.values());
}

/**
 * 重置指定provider的健康状态（用于手动恢复熔断器）
 * @param provider 提供商名称，不传则重置全部
 * @param service 服务类型，不传则重置全部服务
 */
export function resetProviderHealth(provider?: string, service?: ServiceType): void {
  if (provider && service) {
    const key = getHealthKey(provider, service);
    const health = healthMap.get(key);
    if (health) {
      health.healthy = true;
      health.failCount = 0;
      health.lastCheck = 0;
      console.log(`[Router] 手动重置 ${provider}/${service} 健康状态`);
    }
  } else {
    // 重置全部
    for (const [, health] of healthMap) {
      if (provider && health.provider !== provider) continue;
      if (service && !health.provider) continue;
      health.healthy = true;
      health.failCount = 0;
      health.lastCheck = 0;
    }
    console.log(`[Router] 手动重置${provider ? ` ${provider}` : '全部'}${service ? ` ${service}` : '全部服务'}健康状态`);
  }
}

/**
 * 获取降级链的当前路由决策
 */
export function getCurrentRoute(service: ServiceType): {
  primary: string;
  current: string;
  degraded: boolean;
  chain: string[];
} {
  const chain = Array.from(healthMap.keys())
    .filter(key => key.endsWith(`:${service}`))
    .map(key => key.slice(0, -(service.length + 1)));

  if (chain.length === 0) {
    return {
      primary: 'unconfigured',
      current: 'unconfigured',
      degraded: false,
      chain: [],
    };
  }

  let current = chain[0];

  for (const provider of chain) {
    const health = getHealth(provider, service);
    if (health.healthy || shouldProbe(provider, service)) {
      current = provider;
      break;
    }
  }

  return {
    primary: chain[0],
    current,
    degraded: current !== chain[0],
    chain,
  };
}
