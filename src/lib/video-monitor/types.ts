/**
 * AI视频生成后台监测系统 - 类型定义
 * 基于 ai-video-monitor skill v1.0
 */

// ============================================================
// 任务状态机
// ============================================================

/** 任务状态模型 */
export type MonitorTaskStatus =
  | 'pending'         // 排队中，等待GPU资源
  | 'processing'      // AI模型推理中
  | 'assembling'      // FFmpeg组装/剪辑中
  | 'post_processing' // 画质增强/插帧/水印
  | 'completed'       // 成功完成
  | 'failed'          // 失败
  | 'paused'          // 暂停
  | 'cancelled';      // 取消

/** 状态流转事件 */
export type StatusTransition =
  | 'allocate_gpu'    // pending → processing
  | 'generation_done' // processing → assembling
  | 'assembly_done'   // assembling → post_processing
  | 'post_done'       // post_processing → completed
  | 'timeout'         // processing → failed
  | 'circuit_break'   // processing → failed (熔断)
  | 'error'           // * → failed
  | 'pause'           // processing/assembling → paused
  | 'resume'          // paused → pending
  | 'cancel';         // * → cancelled

/** 状态流转规则 */
export interface TransitionRule {
  from: MonitorTaskStatus;
  to: MonitorTaskStatus;
  event: StatusTransition;
  guard?: (task: MonitorTask) => boolean;
}

/** 状态变更结果 */
export interface StateChangeResult {
  success: boolean;
  previousStatus: MonitorTaskStatus;
  newStatus: MonitorTaskStatus;
  timestamp: number;
  reason?: string;
}

// ============================================================
// 监测任务模型
// ============================================================

/** 监测任务 */
export interface MonitorTask {
  taskId: string;
  userId: string;
  projectName?: string;

  // 状态与进度
  status: MonitorTaskStatus;
  progress: number;       // 0-100
  currentStep: string;

  // 结果与错误
  finalVideoUrl?: string;
  coverImageUrl?: string;
  errorMessage?: string;
  errorCode?: string;     // 友好错误码 E1xxx-E5xxx

  // 重试信息
  retryCount: number;
  maxRetries: number;
  lastRetryAt?: number;

  // 软删除与时间戳
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  failedAt?: number;
}

// ============================================================
// 配置快照
// ============================================================

/** 生成配置快照（Git式版本分支） */
export interface GenerationConfig {
  configId: string;
  taskId: string;

  // 版本分支支持
  parentConfigId?: string;
  branchName: string;       // 默认 'main'
  configVersion: number;

  // 核心提示词
  mainPrompt: string;
  negativePrompt?: string;
  scriptJson?: Record<string, unknown>;

  // 模型与超参数
  modelName?: string;
  modelVersion?: string;
  paramsJson?: Record<string, unknown>;

  // 资源消耗
  costCredits?: number;

  createdAt: number;
}

/** 配置分支信息 */
export interface ConfigBranch {
  branchName: string;
  latestVersion: number;
  configIds: string[];
}

// ============================================================
// 操作日志
// ============================================================

/** 操作类型 */
export type OperationType =
  | 'create'          // 创建任务
  | 'status_change'   // 状态变更
  | 'progress_update' // 进度更新
  | 'config_save'     // 保存配置
  | 'config_branch'   // 创建配置分支
  | 'retry'           // 重试
  | 'cancel'          // 取消
  | 'delete'          // 删除
  | 'content_check'   // 内容安全检查
  | 'copyright_check' // 版权检查
  | 'error';          // 错误

/** 操作日志 */
export interface OperationLog {
  logId: string;
  taskId: string;

  operationType: OperationType;
  fromStatus?: MonitorTaskStatus;
  toStatus?: MonitorTaskStatus;
  detail: string;
  metadata?: Record<string, unknown>;

  createdAt: number;
}

// ============================================================
// Outbox事件
// ============================================================

/** Outbox事件状态 */
export type OutboxEventStatus = 'pending' | 'delivered' | 'failed';

/** Outbox事件 */
export interface OutboxEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;    // 通常是 taskId
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  retryCount: number;
  createdAt: number;
  deliveredAt?: number;
}

// ============================================================
// 错误处理
// ============================================================

/** 错误严重级别 */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

/** 错误类别 */
export type ErrorCategory = 'resource' | 'network' | 'business' | 'system' | 'ai_model';

/** 错误定义 */
export interface ErrorDefinition {
  code: string;             // E1xxx-E5xxx
  severity: ErrorSeverity;
  category: ErrorCategory;
  userMessage: string;
  technicalDetail: string;
  suggestions: string[];
  autoActions: string[];
  httpStatus: number;
  retryable: boolean;
}

/** 错误诊断结果 */
export interface DiagnosticResult {
  errorCode: string;
  userMessage: string;
  suggestions: string[];
  autoFixAvailable: boolean;
  autoFixAction?: string;
  retryable: boolean;
}

// ============================================================
// 内容安全
// ============================================================

/** 安全检查层 */
export type SafetyLayer = 'prompt_filter' | 'gan_detection' | 'frame_monitor';

/** 安全检查结果 */
export interface SafetyResult {
  allowed: boolean;
  layer?: SafetyLayer;
  reason?: string;
  score?: number;
  details?: string[];
}

/** 内容安全检查项 */
export interface ContentSafetyCheck {
  taskId: string;
  layer: SafetyLayer;
  result: SafetyResult;
  checkedAt: number;
}

// ============================================================
// 重试机制
// ============================================================

/** 错误可恢复性 */
export type ErrorRecoverability = 'recoverable' | 'permanent' | 'resource_exhausted' | 'temporarily_unavailable';

/** 重试策略 */
export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs: number;
}

/** 重试决策 */
export interface RetryDecision {
  shouldRetry: boolean;
  delayMs: number;
  reason: string;
  nextRetryCount: number;
}

/** 熔断器状态 */
export type CircuitState = 'closed' | 'open' | 'half_open';

/** 熔断器配置 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxRequests: number;
}

// ============================================================
// 进度追踪
// ============================================================

/** 进度更新数据（WebSocket/SSE推送） */
export interface ProgressUpdate {
  taskId: string;
  status: MonitorTaskStatus;
  progress: number;
  step: string;
  currentIdx?: number;
  totalTasks?: number;
  errorMessage?: string;
  videoUrl?: string;
  timestamp: number;
}

/** 断线续追请求 */
export interface ReconnectRequest {
  taskId: string;
  lastKnownUpdatedAt: number;
}

/** 断线续追响应 */
export interface ReconnectResponse {
  task: MonitorTask;
  missedUpdates: ProgressUpdate[];
}

// ============================================================
// 版权与合规
// ============================================================

/** 版权检查结果 */
export interface CopyrightCheckResult {
  passed: boolean;
  watermarkApplied: boolean;
  blockchainHash?: string;
  issues: CopyrightIssue[];
}

/** 版权问题 */
export interface CopyrightIssue {
  type: 'music' | 'visual' | 'portrait' | 'trademark';
  severity: 'warning' | 'critical';
  description: string;
  suggestion: string;
}
