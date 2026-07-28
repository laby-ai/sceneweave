/**
 * 服务端任务管理器 - 文件存储版本
 * 使用文件系统持久化任务状态，解决服务端重启导致任务丢失的问题
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { emitOperationalSystemEvent, emitTaskStateEvent } from './operational-observability';
import {
  isCompletedTaskExpired,
  migrateLegacyHuiyingTasksFile,
  resolveHuiyingTasksFile,
} from './task-store-path';

export type TaskType = 'video' | 'image' | 'copywriting' | 'poster' | 'avatar' | 'storyboard';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export class TaskAdmissionError extends Error {
  readonly status = 429;
  readonly code = 'member_task_concurrency_exceeded';

  constructor() {
    super('当前运行中的生成任务较多，请等待一个任务完成后再试。');
    this.name = 'TaskAdmissionError';
  }
}

export interface TaskOwner {
  tenantId: string;
  memberId: string;
}

export interface TaskConfig {
  prompt?: string;
  duration?: string;
  style?: string;
  mood?: string;
  filter?: string;
  colorTheme?: string;
  resolution?: string;
  ratio?: string;
  modelId?: string;
  voiceType?: string;
  background?: string;
  useBackground?: boolean;
  customImageUrl?: string;
  retryCount?: number;
  originalTaskId?: string;
  [key: string]: unknown;
}

export interface StoryboardShotResult {
  id?: string;
  prompt: string;
  duration: number;
  referenceImage?: string;
  nineGridImages?: string[];
  videoUrl?: string;
  lastFrameUrl?: string;
  status?: string;
  [key: string]: unknown;
}

export interface TaskResult {
  videoUrl?: string;
  imageUrls?: string[];
  content?: string;
  assemblyPlan?: {
    version: string;
    productionProjectId: string;
    sourceTaskId: string;
    totalDuration: number;
    segmentCount: number;
    status: string;
    segments: Array<{
      id: string;
      index: number;
      shotId: string;
      duration: number;
      prompt: string;
      status: string;
      error?: string | null;
      startedAt?: string;
      completedAt?: string;
      expectedOutputs?: {
        videoUrl: string | null;
        lastFrameUrl: string | null;
        taskId: string | null;
        providerTaskId?: string | null;
      };
    }>;
    recovery?: Record<string, unknown>;
    nextAction?: string;
  };
  assemblyQueue?: {
    version: string;
    sourceTaskId: string;
    status: string;
    queuedSegmentCount: number;
    childTaskIds: string[];
    updatedAt: string;
  };
  directorChain?: {
    version: string;
    agents: Array<{
      role: string;
      title: string;
      objective: string;
      decisions: string[];
      output?: Record<string, unknown>;
    }>;
    handoff?: {
      productionProjectId: string;
      taskId: string;
      readyAssetKinds: string[];
      nextRoute: string;
      nextAction: string;
    };
    qualityGates?: string[];
  };
  shots?: StoryboardShotResult[];
  // 分段视频相关
  segments?: Array<{
    index: number;
    taskId?: string;
    status?: 'pending' | 'running' | 'completed' | 'failed';
    prompt?: string;
    duration?: number;
    ratio?: string;
    videoModel?: string;
    providerTaskId?: string;
    videoUrl?: string;
    lastFrameUrl?: string;
    lastFrameSource?: 'provider' | 'extracted' | null;
    audioCue?: string | null;
    hasAudio?: boolean | null;
    storyStateCue?: string | null;
    error?: string;
  }>;
  handoff?: {
    requiresTailFrame?: boolean;
    lastFrameUrlPresent?: boolean;
    lastFrameSource?: 'provider' | 'extracted' | null;
    punchThroughReady?: boolean;
  };
  isPartial?: boolean;
  failedSegments?: number[];
  successSegmentCount?: number;
  segmentCount?: number;
  failedSegmentsDetails?: Array<{
    index: number;
    error?: string;
    errorType?: string;
    fixStrategy?: string;
    retryCount?: number;
  }>;
  [key: string]: unknown;
}

export interface BackgroundTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  config: TaskConfig;
  progress: number;
  stage?: string;
  message?: string;
  result?: TaskResult;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  lastUpdatedAt?: number; // 最后更新时间，用于判断僵尸任务
  eventSeq?: number; // 单调递增的任务事件游标，用于断线后增量恢复
  // 服务端可信会话派生的所有权。旧任务没有 owner 时一律对用户接口隐藏。
  owner?: TaskOwner;
  idempotencyHash?: string;
  // 注意：abortController 不能序列化，不存储到文件
  abortController?: AbortController;
}

function nextTaskEventSeq(task: BackgroundTask): number {
  return Math.max(0, Number.isSafeInteger(task.eventSeq) ? Number(task.eventSeq) : 0) + 1;
}

// 生产默认落到 release 的 shared artifacts；QA 可用环境变量隔离。
const TASKS_FILE = resolveHuiyingTasksFile();
const TASKS_DIR = path.dirname(TASKS_FILE);

// 内存缓存（用于提高性能，但会以文件为准）
let taskCache: Map<string, BackgroundTask> | null = null;
let lastLoadTime = 0;
let startupRecoveryPending = true;
const CACHE_TTL = 1000; // 缓存1秒
const SAVE_RETRY_COUNT = 8;
const SAVE_RETRY_DELAY_MS = 80;

/**
 * 确保存储目录存在
 */
function ensureDirectory() {
  if (!fs.existsSync(TASKS_DIR)) {
    fs.mkdirSync(TASKS_DIR, { recursive: true });
  }
}

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function replaceTaskFileWithRetry(tempFile: string, targetFile: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < SAVE_RETRY_COUNT; attempt += 1) {
    try {
      fs.renameSync(tempFile, targetFile);
      return;
    } catch (error) {
      lastError = error;
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(String(code))) {
        throw error;
      }
      sleepSync(SAVE_RETRY_DELAY_MS * (attempt + 1));
    }
  }

  try {
    fs.copyFileSync(tempFile, targetFile);
    fs.rmSync(tempFile, { force: true });
  } catch {
    throw lastError;
  }
}

/**
 * 从文件加载所有任务
 */
function loadTasksFromFile(): Map<string, BackgroundTask> {
  try {
    ensureDirectory();
    migrateLegacyHuiyingTasksFile(TASKS_FILE);
    
    if (!fs.existsSync(TASKS_FILE)) {
      return new Map();
    }

    const data = fs.readFileSync(TASKS_FILE, 'utf-8');
    const tasks = JSON.parse(data) as BackgroundTask[];
    
    // 转换回 Map
    const taskMap = new Map<string, BackgroundTask>();
    tasks.forEach(task => {
      // 恢复运行时不能序列化的字段
      taskMap.set(task.id, {
        ...task,
        eventSeq: Math.max(1, Number.isSafeInteger(task.eventSeq) ? Number(task.eventSeq) : 1),
        abortController: undefined, // 重启后无法恢复
      });
    });
    
    return taskMap;
  } catch (error) {
    emitOperationalSystemEvent('task.store_load_failed', {
      level: 'error',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    return new Map();
  }
}

function taskHasSubmittedProviderJob(task: BackgroundTask) {
  if (typeof task.result?.providerTaskId === 'string' && task.result.providerTaskId.trim()) return true;
  return Array.isArray(task.result?.segments)
    && task.result.segments.some(segment => typeof segment.providerTaskId === 'string' && segment.providerTaskId.trim());
}

function recoverInterruptedTask(task: BackgroundTask, timestamp: number): BackgroundTask {
  const isAssemblySegment = task.config.workflow === 'production-assembly-segment';
  const hasProviderJob = isAssemblySegment && taskHasSubmittedProviderJob(task);
  if (isAssemblySegment && !hasProviderJob) {
    return {
      ...task,
      status: 'pending',
      progress: 0,
      stage: '服务恢复，片段已回到队列',
      message: '该片段尚未提交供应商，可从当前项目继续执行，不会重复扣费。',
      error: undefined,
      startedAt: undefined,
      completedAt: undefined,
      lastUpdatedAt: timestamp,
      eventSeq: nextTaskEventSeq(task),
      abortController: undefined,
    };
  }

  return {
    ...task,
    status: 'failed',
    stage: hasProviderJob ? '服务恢复，供应商任务待续查' : '服务重启，任务已安全停止',
    error: hasProviderJob ? 'task_interrupted_with_provider_job' : 'task_interrupted_by_restart',
    completedAt: timestamp,
    lastUpdatedAt: timestamp,
    eventSeq: nextTaskEventSeq(task),
    abortController: undefined,
  };
}

function reconcileVimaxVideoTaskStates(tasks: Map<string, BackgroundTask>, timestamp: number) {
  let reconciled = false;
  for (const [taskId, task] of tasks) {
    const childTaskId = typeof task.result?.vimaxVideoTaskId === 'string'
      ? task.result.vimaxVideoTaskId
      : '';
    if (!childTaskId) continue;
    const child = tasks.get(childTaskId);
    if (!child
      || child.config.workflow !== 'vimax-agent-video'
      || task.result?.vimaxVideoTaskStatus === child.status) continue;
    tasks.set(taskId, {
      ...task,
      result: {
        ...(task.result || {}),
        vimaxVideoTaskStatus: child.status,
      },
      lastUpdatedAt: timestamp,
      eventSeq: nextTaskEventSeq(task),
    });
    reconciled = true;
  }
  return reconciled;
}

function syncVimaxParentVideoTaskStatus(
  tasks: Map<string, BackgroundTask>,
  child: BackgroundTask,
  status: TaskStatus,
  timestamp: number,
) {
  if (child.config.workflow !== 'vimax-agent-video') return;
  const parentTaskId = typeof child.config.parentTaskId === 'string' ? child.config.parentTaskId : '';
  const parent = parentTaskId ? tasks.get(parentTaskId) : undefined;
  if (!parent || !child.owner || !taskBelongsToOwner(parent, child.owner)) return;
  tasks.set(parentTaskId, {
    ...parent,
    result: {
      ...(parent.result || {}),
      vimaxVideoTaskId: child.id,
      vimaxVideoTaskStatus: status,
    },
    lastUpdatedAt: timestamp,
    eventSeq: nextTaskEventSeq(parent),
  });
}

/**
 * 保存所有任务到文件
 */
function saveTasksToFile(tasks: Map<string, BackgroundTask>) {
  try {
    ensureDirectory();
    
    // 转换为数组并移除不能序列化的字段
    const tasksArray = Array.from(tasks.values()).map(task => ({
      ...task,
      abortController: undefined,
    }));
    
    // 原子写入：先写入进程唯一临时文件，再重命名；Windows 上目标文件短暂被
    // 轮询/杀毒/预览占用时会返回 EPERM，因此做有限退避重试。
    const tempFile = `${TASKS_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(tasksArray, null, 2), 'utf-8');
    replaceTaskFileWithRetry(tempFile, TASKS_FILE);
    
    // 更新缓存
    taskCache = new Map(tasks);
    lastLoadTime = Date.now();
  } catch (error) {
    emitOperationalSystemEvent('task.store_save_failed', {
      level: 'error',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    throw error;
  }
}

/**
 * 获取任务存储（优先使用缓存，必要时从文件加载）
 */
function getTaskStore(): Map<string, BackgroundTask> {
  const now = Date.now();
  
  // 如果缓存过期或不存在，从文件加载
  if (!taskCache || now - lastLoadTime > CACHE_TTL) {
    taskCache = loadTasksFromFile();
    if (startupRecoveryPending) {
      startupRecoveryPending = false;
      const timestamp = Date.now();
      let recovered = false;
      for (const [taskId, task] of taskCache) {
        if (task.status === 'pending' || task.status === 'running') {
          taskCache.set(taskId, recoverInterruptedTask(task, timestamp));
          recovered = true;
        }
      }
      if (reconcileVimaxVideoTaskStates(taskCache, timestamp)) recovered = true;
      if (recovered) saveTasksToFile(taskCache);
    }
    lastLoadTime = now;
  }
  
  return taskCache;
}

/**
 * 创建新任务
 * 支持两种调用方式：
 * 1. createTask(type, config) - 传统方式
 * 2. createTask({ type, params }) - 对象方式（用于向后兼容）
 */
export function createTask(
  typeOrOptions: TaskType | { type: TaskType; params?: TaskConfig; owner?: TaskOwner },
  config?: TaskConfig,
  explicitOwner?: TaskOwner,
): string {
  let type: TaskType;
  let taskConfig: TaskConfig;
  let owner: TaskOwner | undefined;
  
  if (typeof typeOrOptions === 'string') {
    // 方式1: createTask(type, config)
    type = typeOrOptions;
    taskConfig = config || {};
    owner = explicitOwner;
  } else {
    // 方式2: createTask({ type, params })
    type = typeOrOptions.type;
    taskConfig = typeOrOptions.params || {};
    owner = typeOrOptions.owner;
  }

  if (!owner && typeof taskConfig.parentTaskId === 'string') {
    owner = getTaskStore().get(taskConfig.parentTaskId)?.owner;
  }

  const rawIdempotencyKey = typeof taskConfig.idempotencyKey === 'string' ? taskConfig.idempotencyKey.trim() : '';
  const idempotencyHash = owner && /^[A-Za-z0-9._:-]{8,128}$/.test(rawIdempotencyKey)
    ? createHash('sha256').update(`${owner.tenantId}|${owner.memberId}|${type}|${rawIdempotencyKey}`).digest('hex')
    : undefined;
  const sanitizedConfig = { ...taskConfig };
  delete sanitizedConfig.idempotencyKey;

  const store = getTaskStore();
  if (idempotencyHash) {
    const existing = [...store.values()].find(task => task.idempotencyHash === idempotencyHash);
    if (existing) return existing.id;
  }
  if (owner && typeof sanitizedConfig.parentTaskId !== 'string') {
    const maxActive = Math.max(1, Number(process.env.HUIYING_MEMBER_TASK_CONCURRENCY || 2));
    const active = [...store.values()].filter(task => task.owner?.tenantId === owner?.tenantId
      && task.owner?.memberId === owner?.memberId
      && (task.status === 'pending' || task.status === 'running')
      && typeof task.config.parentTaskId !== 'string').length;
    if (active >= maxActive) throw new TaskAdmissionError();
  }
  
  const taskId = uuidv4();
  const task: BackgroundTask = {
    id: taskId,
    type,
    status: 'pending',
    config: sanitizedConfig,
    progress: 0,
    eventSeq: 1,
    createdAt: Date.now(),
    ...(owner ? { owner: { tenantId: owner.tenantId, memberId: owner.memberId } } : {}),
    ...(idempotencyHash ? { idempotencyHash } : {}),
  };

  store.set(taskId, task);
  saveTasksToFile(store);
  
  emitTaskStateEvent({ owner: task.owner, taskId, taskType: type, status: 'queued' });
  return taskId;
}

/**
 * 获取任务
 */
export function getTask(taskId: string): BackgroundTask | undefined {
  const store = getTaskStore();
  return store.get(taskId);
}

/**
 * 强制从文件读取任务。
 * 用于“刚写入后立即被另一个 API 串联读取”的制作链路，避免短 TTL 缓存返回旧任务快照。
 */
export function getTaskFresh(taskId: string): BackgroundTask | undefined {
  const store = loadTasksFromFile();
  taskCache = store;
  lastLoadTime = Date.now();
  return store.get(taskId);
}

/**
 * 获取所有任务
 */
export function getAllTasks(): BackgroundTask[] {
  const store = getTaskStore();
  return Array.from(store.values()).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 强制从文件读取所有任务。
 */
export function getAllTasksFresh(): BackgroundTask[] {
  const store = loadTasksFromFile();
  taskCache = store;
  lastLoadTime = Date.now();
  return Array.from(store.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function publicTask(task: BackgroundTask | undefined) {
  if (!task) return null;
  const { abortController: _abortController, owner: _owner, idempotencyHash: _idempotencyHash, ...taskInfo } = task;
  void _abortController;
  void _owner;
  void _idempotencyHash;
  return taskInfo;
}

function taskBelongsToOwner(task: BackgroundTask | undefined, owner: TaskOwner): task is BackgroundTask {
  return Boolean(task?.owner
    && task.owner.tenantId === owner.tenantId
    && task.owner.memberId === owner.memberId);
}

export function getTaskForOwner(taskId: string, owner: TaskOwner): BackgroundTask | undefined {
  const task = getTaskFresh(taskId);
  return taskBelongsToOwner(task, owner) ? task : undefined;
}

export function getAllTasksForOwner(owner: TaskOwner): BackgroundTask[] {
  return getAllTasksFresh().filter(task => taskBelongsToOwner(task, owner));
}

export function deleteTaskForOwner(taskId: string, owner: TaskOwner): boolean {
  if (!taskBelongsToOwner(getTaskFresh(taskId), owner)) return false;
  return deleteTask(taskId);
}

/**
 * 更新任务状态
 */
export function updateTask(
  taskId: string,
  updates: Partial<Omit<BackgroundTask, 'id' | 'createdAt'>>
): BackgroundTask | undefined {
  const store = getTaskStore();
  const task = store.get(taskId);
  
  if (!task) {
    return undefined;
  }

  const updatedTask = { 
    ...task, 
    ...updates,
    lastUpdatedAt: Date.now(), // 自动更新最后更新时间
    eventSeq: nextTaskEventSeq(task),
  };
  store.set(taskId, updatedTask);
  saveTasksToFile(store);
  
  return updatedTask;
}

/**
 * 开始执行任务
 */
export function startTask(taskId: string, abortController?: AbortController): boolean {
  const store = getTaskStore();
  const task = store.get(taskId);
  
  if (!task || task.status !== 'pending') {
    return false;
  }

  const runningTask: BackgroundTask = {
    ...task,
    status: 'running',
    startedAt: Date.now(),
    eventSeq: nextTaskEventSeq(task),
    abortController: abortController || new AbortController(),
  };
  store.set(taskId, runningTask);
  
  saveTasksToFile(store);
  emitTaskStateEvent({ owner: runningTask.owner, taskId, taskType: task.type, status: 'running' });
  return true;
}

/**
 * 完成任务
 */
export function completeTask(taskId: string, result: TaskResult): boolean {
  const store = getTaskStore();
  const task = store.get(taskId);
  
  if (!task || task.status !== 'running') {
    return false;
  }

  const completedTask: BackgroundTask = {
    ...task,
    status: 'completed',
    progress: 100,
    stage: '已完成',
    result,
    completedAt: Date.now(),
    eventSeq: nextTaskEventSeq(task),
    abortController: undefined,
  };
  store.set(taskId, completedTask);
  
  saveTasksToFile(store);
  emitTaskStateEvent({
    owner: completedTask.owner,
    taskId,
    taskType: task.type,
    status: 'succeeded',
    startedAt: task.startedAt,
  });
  return true;
}

/**
 * Completes a failed task after a no-cost recovery step rebuilt its missing
 * delivery metadata. A normal failed task cannot use this transition.
 */
export function completeFailedTaskRecovery(
  taskId: string,
  result: TaskResult,
  owner?: TaskOwner,
): boolean {
  const store = getTaskStore();
  const task = store.get(taskId);

  if (!task || task.status !== 'failed' || (owner && !taskBelongsToOwner(task, owner))) {
    return false;
  }

  const completedTask: BackgroundTask = {
    ...task,
    status: 'completed',
    progress: 100,
    stage: '已完成',
    result,
    error: undefined,
    completedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    eventSeq: nextTaskEventSeq(task),
    abortController: undefined,
  };
  store.set(taskId, completedTask);
  saveTasksToFile(store);
  emitTaskStateEvent({
    owner: completedTask.owner,
    taskId,
    taskType: task.type,
    status: 'succeeded',
    startedAt: task.startedAt,
  });
  return true;
}

/**
 * 标记任务失败
 */
export function failTask(taskId: string, error: string): boolean {
  const store = getTaskStore();
  const task = store.get(taskId);
  
  if (!task || task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
    return false;
  }

  const failedTask: BackgroundTask = {
    ...task,
    status: 'failed',
    stage: '生成失败',
    error,
    completedAt: Date.now(),
    eventSeq: nextTaskEventSeq(task),
    abortController: undefined,
  };
  store.set(taskId, failedTask);
  
  saveTasksToFile(store);
  emitTaskStateEvent({
    owner: failedTask.owner,
    taskId,
    taskType: task.type,
    status: 'failed',
    startedAt: task.startedAt,
    errorType: 'TaskFailure',
  });
  return true;
}

/**
 * 取消任务
 */
export function cancelTask(taskId: string): boolean {
  const store = getTaskStore();
  const task = store.get(taskId);
  
  if (!task) {
    return false;
  }
  if (task.status === 'cancelled') return true;
  if (task.status === 'completed' || task.status === 'failed') return false;

  // 触发取消信号
  if (task.abortController) {
    task.abortController.abort();
  }

  const cancelledTask: BackgroundTask = {
    ...task,
    status: 'cancelled',
    stage: '已取消',
    completedAt: Date.now(),
    eventSeq: nextTaskEventSeq(task),
    abortController: undefined,
  };
  store.set(taskId, cancelledTask);
  syncVimaxParentVideoTaskStatus(store, cancelledTask, 'cancelled', Date.now());
  
  saveTasksToFile(store);
  emitTaskStateEvent({
    owner: cancelledTask.owner,
    taskId,
    taskType: task.type,
    status: 'cancelled',
    startedAt: task.startedAt,
  });
  return true;
}

/**
 * 删除任务
 */
export function deleteTask(taskId: string): boolean {
  const store = getTaskStore();
  const existed = store.delete(taskId);
  
  if (existed) {
    saveTasksToFile(store);
  }
  
  return existed;
}

/**
 * 重试任务 — 重置状态为 pending，保留原始配置
 * 返回更新后的任务，如果任务不存在或不允许重试则返回 undefined
 */
export function retryTask(taskId: string): BackgroundTask | undefined {
  const store = getTaskStore();
  const task = store.get(taskId);

  if (!task) {
    return undefined;
  }

  // 只有失败或已取消的任务可以重试
  if (task.status !== 'failed' && task.status !== 'cancelled') {
    return undefined;
  }

  const retryCount = (task.config.retryCount || 0) + 1;

  const updatedTask: BackgroundTask = {
    ...task,
    status: 'pending',
    progress: 0,
    stage: '等待重试',
    error: undefined,
    result: undefined,
    completedAt: undefined,
    abortController: undefined,
    config: {
      ...task.config,
      retryCount,
      originalTaskId: task.config.originalTaskId || taskId,
    },
    lastUpdatedAt: Date.now(),
    eventSeq: nextTaskEventSeq(task),
  };

  store.set(taskId, updatedTask);
  syncVimaxParentVideoTaskStatus(store, updatedTask, 'pending', updatedTask.lastUpdatedAt || Date.now());
  saveTasksToFile(store);

  emitTaskStateEvent({ owner: updatedTask.owner, taskId, taskType: task.type, status: 'queued' });
  return updatedTask;
}

/**
 * 更新任务进度
 */
export function updateTaskProgress(
  taskId: string,
  progress: number,
  stage: string,
  message?: string
): void {
  updateTask(taskId, { progress, stage, message });
}

/**
 * 清理过期任务
 * 1. 删除已完成/失败/取消超过24小时的任务
 * 2. 将运行中超过30分钟未更新的任务标记为僵尸任务（60秒视频可能需要较长时间）
 */
export function cleanupExpiredTasks(): number {
  const now = Date.now();
  const store = getTaskStore();
  const expiredTasks: string[] = [];
  const zombieTasks: string[] = [];
  // 长期处于 pending 但从未真正启动的任务：视为失效。
  // 否则前端会持续把它们当成“活跃任务”并为每个建立 SSE 流，占满浏览器连接、拖垮整体协同。
  const stalePending: string[] = [];

  store.forEach((task, taskId) => {
    if (task.completedAt && isCompletedTaskExpired(task.completedAt, now)) {
      expiredTasks.push(taskId);
    }
    // 将运行中超过30分钟未更新的任务标记为僵尸任务（延长超时时间以支持60秒长视频）
    else if (task.status === 'running') {
      const lastUpdate = task.lastUpdatedAt || task.startedAt || task.createdAt;
      if (lastUpdate && (now - lastUpdate) > 30 * 60 * 1000) {
        zombieTasks.push(taskId);
      }
    }
    // pending 超过 15 分钟且期间没有被重新排队/重试，判定为失效任务。
    // 分段任务可能等待上一镜与边界桥接超过 15 分钟；queue/retry 会刷新 lastUpdatedAt，
    // 此时不能按最初 createdAt 把仍在当前编排里的下游镜头误判为失效。
    else if (task.status === 'pending') {
      const lastActivity = task.lastUpdatedAt || task.createdAt;
      if (lastActivity && (now - lastActivity) > 15 * 60 * 1000) {
        stalePending.push(taskId);
      }
    }
  });

  // 删除过期任务
  expiredTasks.forEach(taskId => {
    store.delete(taskId);
  });

  // 标记僵尸任务为失败
  zombieTasks.forEach(taskId => {
    const task = store.get(taskId);
    if (task) {
      store.set(taskId, {
        ...task,
        status: 'failed',
        stage: '任务超时',
        error: '任务运行超过30分钟无响应，可能已中断',
        completedAt: now,
        eventSeq: nextTaskEventSeq(task),
        abortController: undefined,
      });
    }
  });

  // 标记长期未启动的 pending 任务为失败
  stalePending.forEach(taskId => {
    const task = store.get(taskId);
    if (task) {
      store.set(taskId, {
        ...task,
        status: 'failed',
        stage: '任务失效',
        error: '任务长时间未开始，已自动失效',
        completedAt: now,
        eventSeq: nextTaskEventSeq(task),
        abortController: undefined,
      });
    }
  });

  const changed = expiredTasks.length + zombieTasks.length + stalePending.length;
  if (changed > 0) {
    saveTasksToFile(store);
    emitOperationalSystemEvent('task.cleanup_completed', { count: changed });
  }

  return changed;
}

// 定期清理过期任务（每30分钟）
if (typeof globalThis !== 'undefined') {
  const cleanupInterval = setInterval(() => {
    cleanupExpiredTasks();
  }, 30 * 60 * 1000);
  cleanupInterval.unref?.();
}

// 服务端启动时：加载任务并恢复状态
emitOperationalSystemEvent('task.store_initialized', {});

// 启动时先清理一次，避免重启后历史僵尸任务继续显示为运行中。
cleanupExpiredTasks();

// 加载任务并统计
const store = getTaskStore();

if (store.size > 0) {
  emitOperationalSystemEvent('task.store_loaded', { count: store.size });
}

export function reloadTaskStoreForTest() {
  taskCache = null;
  lastLoadTime = 0;
  startupRecoveryPending = true;
  return getTaskStore();
}
