/**
 * AI视频生成后台监测系统 - 常量与错误码体系
 * 基于 ai-video-monitor skill v1.0
 */

import type {
  MonitorTaskStatus,
  StatusTransition,
  TransitionRule,
  ErrorDefinition,
  ErrorCategory,
  RetryPolicy,
  CircuitBreakerConfig,
} from './types';

// ============================================================
// 状态机常量
// ============================================================

/** 状态中文标签 */
export const STATUS_LABELS: Record<MonitorTaskStatus, string> = {
  pending: '排队中',
  processing: '生成中',
  assembling: '组装中',
  post_processing: '后处理',
  completed: '已完成',
  failed: '失败',
  paused: '已暂停',
  cancelled: '已取消',
};

/** 状态颜色 */
export const STATUS_COLORS: Record<MonitorTaskStatus, string> = {
  pending: 'bg-gray-500',
  processing: 'bg-red-500',
  assembling: 'bg-red-500',
  post_processing: 'bg-red-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  paused: 'bg-red-500',
  cancelled: 'bg-neutral-500',
};

/** 状态Tag颜色（shadcn variant） */
export const STATUS_TAG_VARIANTS: Record<MonitorTaskStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  processing: 'default',
  assembling: 'default',
  post_processing: 'default',
  completed: 'secondary',
  failed: 'destructive',
  paused: 'outline',
  cancelled: 'outline',
};

/** 合法状态流转规则 */
export const TRANSITION_RULES: TransitionRule[] = [
  { from: 'pending', to: 'processing', event: 'allocate_gpu' },
  { from: 'processing', to: 'assembling', event: 'generation_done' },
  { from: 'processing', to: 'failed', event: 'timeout' },
  { from: 'processing', to: 'failed', event: 'circuit_break' },
  { from: 'processing', to: 'failed', event: 'error' },
  { from: 'processing', to: 'paused', event: 'pause' },
  { from: 'pending', to: 'paused', event: 'pause' },
  { from: 'assembling', to: 'post_processing', event: 'assembly_done' },
  { from: 'assembling', to: 'failed', event: 'error' },
  { from: 'post_processing', to: 'completed', event: 'post_done' },
  { from: 'post_processing', to: 'failed', event: 'error' },
  { from: 'paused', to: 'processing', event: 'resume' },
  { from: 'paused', to: 'cancelled', event: 'cancel' },
  { from: 'pending', to: 'cancelled', event: 'cancel' },
  { from: 'processing', to: 'cancelled', event: 'cancel' },
];

/** 各状态进度范围 */
export const STATUS_PROGRESS_RANGE: Record<MonitorTaskStatus, [number, number]> = {
  pending: [0, 5],
  processing: [5, 60],
  assembling: [60, 80],
  post_processing: [80, 95],
  completed: [95, 100],
  failed: [0, 0],
  paused: [0, 0],
  cancelled: [0, 0],
};

/** 各状态步骤描述 */
export const STATUS_STEP_DESCRIPTIONS: Record<MonitorTaskStatus, string> = {
  pending: '任务排队中，等待GPU资源分配...',
  processing: 'AI模型推理中，生成分镜头画面...',
  assembling: 'FFmpeg组装中，合并分镜视频...',
  post_processing: '后处理中，画质增强/插帧/添加水印...',
  completed: '视频生成完成！',
  failed: '生成失败',
  paused: '任务已暂停',
  cancelled: '任务已取消',
};

// ============================================================
// 错误码体系
// ============================================================

/** 错误码类别前缀 */
export const ERROR_CATEGORY_PREFIX: Record<ErrorCategory, string> = {
  resource: 'E1',
  network: 'E2',
  business: 'E3',
  system: 'E4',
  ai_model: 'E5',
};

/** 完整错误码映射表 */
export const ERROR_MAP: Record<string, ErrorDefinition> = {
  // ========== E1xxx: 资源类错误 ==========
  E1001: {
    code: 'E1001',
    severity: 'error',
    category: 'resource',
    userMessage: '视频分辨率太高，GPU显存不够用了',
    technicalDetail: 'CUDA OOM when allocating tensor for video generation',
    suggestions: ['降低视频分辨率（1080P → 720P）', '缩短视频时长（30秒 → 15秒）', '减少同时生成数量'],
    autoActions: ['auto_reduce_resolution'],
    httpStatus: 503,
    retryable: true,
  },
  E1002: {
    code: 'E1002',
    severity: 'warning',
    category: 'resource',
    userMessage: 'GPU资源紧张，需要排队等待',
    technicalDetail: 'GPU pool exhausted, task queued',
    suggestions: ['耐心等待，通常1-3分钟内分配', '选择非高峰时段生成'],
    autoActions: ['auto_queue'],
    httpStatus: 202,
    retryable: true,
  },
  E1003: {
    code: 'E1003',
    severity: 'error',
    category: 'resource',
    userMessage: '存储空间不足',
    technicalDetail: 'Disk space insufficient for video output',
    suggestions: ['清理历史作品释放空间', '联系管理员扩容'],
    autoActions: ['auto_cleanup_temp'],
    httpStatus: 507,
    retryable: false,
  },

  // ========== E2xxx: 网络类错误 ==========
  E2001: {
    code: 'E2001',
    severity: 'warning',
    category: 'network',
    userMessage: '网络连接超时，正在重试...',
    technicalDetail: 'Connection timeout to generation API',
    suggestions: ['检查网络连接', '稍后重试'],
    autoActions: ['auto_retry_with_backoff'],
    httpStatus: 504,
    retryable: true,
  },
  E2002: {
    code: 'E2002',
    severity: 'error',
    category: 'network',
    userMessage: '服务暂时不可用',
    technicalDetail: '503 Service Unavailable from upstream',
    suggestions: ['等待1-2分钟后重试', '查看服务状态页面'],
    autoActions: ['auto_retry_with_backoff'],
    httpStatus: 503,
    retryable: true,
  },

  // ========== E3xxx: 业务类错误 ==========
  E3001: {
    code: 'E3001',
    severity: 'error',
    category: 'business',
    userMessage: '提示词包含不当内容，请修改后重试',
    technicalDetail: 'Content policy violation detected in prompt',
    suggestions: ['修改提示词，移除敏感内容', '使用更中性的描述'],
    autoActions: [],
    httpStatus: 400,
    retryable: false,
  },
  E3002: {
    code: 'E3002',
    severity: 'error',
    category: 'business',
    userMessage: '积分不足，请充值后继续',
    technicalDetail: 'Insufficient credits for generation',
    suggestions: ['充值积分', '减少视频时长/分辨率降低消耗'],
    autoActions: [],
    httpStatus: 402,
    retryable: false,
  },
  E3003: {
    code: 'E3003',
    severity: 'warning',
    category: 'business',
    userMessage: '该模型不支持此分辨率',
    technicalDetail: 'Model does not support requested resolution',
    suggestions: ['选择支持的分辨率', '切换到支持该分辨率的模型'],
    autoActions: ['auto_switch_model'],
    httpStatus: 400,
    retryable: true,
  },

  // ========== E4xxx: 系统类错误 ==========
  E4001: {
    code: 'E4001',
    severity: 'critical',
    category: 'system',
    userMessage: '系统异常，请联系客服',
    technicalDetail: 'Internal server error in task processing',
    suggestions: ['稍后重试', '联系客服并提供错误码'],
    autoActions: ['auto_notify_admin'],
    httpStatus: 500,
    retryable: true,
  },
  E4002: {
    code: 'E4002',
    severity: 'error',
    category: 'system',
    userMessage: '任务数据异常',
    technicalDetail: 'Task data corruption detected',
    suggestions: ['重新创建任务', '联系客服恢复数据'],
    autoActions: [],
    httpStatus: 500,
    retryable: false,
  },

  // ========== E5xxx: AI模型类错误 ==========
  E5001: {
    code: 'E5001',
    severity: 'error',
    category: 'ai_model',
    userMessage: 'AI生成失败，请调整参数重试',
    technicalDetail: 'Model inference failed',
    suggestions: ['调整提示词', '更换模型', '降低生成参数'],
    autoActions: ['auto_fallback_model'],
    httpStatus: 500,
    retryable: true,
  },
  E5002: {
    code: 'E5002',
    severity: 'warning',
    category: 'ai_model',
    userMessage: '生成结果质量不佳，建议重新生成',
    technicalDetail: 'Quality assessment score below threshold',
    suggestions: ['调整提示词', '更换风格预设', '增加负面提示词'],
    autoActions: ['auto_enhance_prompt'],
    httpStatus: 200,
    retryable: true,
  },
  E5003: {
    code: 'E5003',
    severity: 'error',
    category: 'ai_model',
    userMessage: '模型正在维护中，请稍后重试',
    technicalDetail: 'Model temporarily unavailable for maintenance',
    suggestions: ['等待10-30分钟后重试', '选择其他可用模型'],
    autoActions: ['auto_switch_model'],
    httpStatus: 503,
    retryable: true,
  },
};

// ============================================================
// 重试策略默认值
// ============================================================

/** 默认重试策略 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterMs: 200,
};

/** 按错误类别的重试策略 */
export const CATEGORY_RETRY_POLICIES: Record<ErrorCategory, RetryPolicy> = {
  resource: { maxRetries: 5, baseDelayMs: 2000, maxDelayMs: 60000, backoffMultiplier: 2, jitterMs: 500 },
  network: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, backoffMultiplier: 2, jitterMs: 200 },
  business: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 0, jitterMs: 0 },
  system: { maxRetries: 2, baseDelayMs: 5000, maxDelayMs: 60000, backoffMultiplier: 3, jitterMs: 1000 },
  ai_model: { maxRetries: 3, baseDelayMs: 2000, maxDelayMs: 30000, backoffMultiplier: 2, jitterMs: 300 },
};

/** 熔断器默认配置 */
export const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  resetTimeoutMs: 30000,
  halfOpenMaxRequests: 2,
};

// ============================================================
// 内容安全常量
// ============================================================

/** 安全分数阈值 */
export const SAFETY_SCORE_THRESHOLD = 0.7;

/** 敏感内容类别 */
export const BLOCKED_CONTENT_CATEGORIES = [
  'violence',
  'sexual',
  'hate_speech',
  'self_harm',
  'illegal_activity',
] as const;

/** 版权检查级别 */
export const COPYRIGHT_CHECK_LEVELS = {
  basic: '基础检查（水印+哈希）',
  standard: '标准检查（+音乐指纹+视觉相似度）',
  strict: '严格检查（+区块链存证+AI深度分析）',
} as const;

/** 错误码用户友好提示 */
export const ERROR_CODE_USER_MESSAGES: Record<string, string> = {
  E1001: 'GPU资源暂时不可用，请稍后重试',
  E1002: '模型加载失败，系统正在切换备用模型',
  E1003: '队列超时，任务已自动重排',
  E2001: '生成内容与提示词不一致，请调整描述',
  E2002: '画质异常，系统将自动重新生成',
  E3001: '视频组装失败，正在重试',
  E3002: '音频合成失败，将使用备用音频',
  E4001: '内容安全检查未通过，请修改提示词',
  E4002: '版权检测异常，请确认素材授权',
  E5001: '服务内部错误，请稍后重试',
  E5002: '网络连接异常，请检查网络',
};
