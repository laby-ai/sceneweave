/**
 * 服务端任务管理器 - 文件存储版本
 * 使用文件系统持久化任务状态，解决服务端重启导致任务丢失的问题
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export type TaskType = 'video' | 'image' | 'copywriting' | 'poster' | 'avatar' | 'storyboard';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

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
  // 注意：abortController 不能序列化，不存储到文件
  abortController?: AbortController;
}

// 任务存储目录。HUIYING_TASKS_FILE 让 QA/本地探针可以隔离任务文件，避免污染真实任务中心。
const TASKS_FILE = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const TASKS_DIR = path.dirname(TASKS_FILE);

// 内存缓存（用于提高性能，但会以文件为准）
let taskCache: Map<string, BackgroundTask> | null = null;
let lastLoadTime = 0;
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
        abortController: undefined, // 重启后无法恢复
      });
    });
    
    return taskMap;
  } catch (error) {
    console.error('[TaskManager] 从文件加载任务失败:', error);
    return new Map();
  }
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
    console.error('[TaskManager] 保存任务到文件失败:', error);
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
export function createTask(typeOrOptions: TaskType | { type: TaskType; params?: TaskConfig }, config?: TaskConfig): string {
  let type: TaskType;
  let taskConfig: TaskConfig;
  
  if (typeof typeOrOptions === 'string') {
    // 方式1: createTask(type, config)
    type = typeOrOptions;
    taskConfig = config || {};
  } else {
    // 方式2: createTask({ type, params })
    type = typeOrOptions.type;
    taskConfig = typeOrOptions.params || {};
  }
  
  const taskId = uuidv4();
  const task: BackgroundTask = {
    id: taskId,
    type,
    status: 'pending',
    config: taskConfig,
    progress: 0,
    createdAt: Date.now(),
  };
  
  const store = getTaskStore();
  store.set(taskId, task);
  saveTasksToFile(store);
  
  console.log(`[TaskManager] 创建任务: ${taskId}, 类型: ${type}`);
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
    console.warn(`[TaskManager] 更新任务失败，任务不存在: ${taskId}`);
    return undefined;
  }

  const updatedTask = { 
    ...task, 
    ...updates,
    lastUpdatedAt: Date.now(), // 自动更新最后更新时间
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
  
  if (!task) {
    console.warn(`[TaskManager] 启动任务失败，任务不存在: ${taskId}`);
    return false;
  }

  store.set(taskId, {
    ...task,
    status: 'running',
    startedAt: Date.now(),
    abortController: abortController || new AbortController(),
  });
  
  saveTasksToFile(store);
  console.log(`[TaskManager] 任务开始运行: ${taskId}`);
  return true;
}

/**
 * 完成任务
 */
export function completeTask(taskId: string, result: TaskResult): boolean {
  const store = getTaskStore();
  const task = store.get(taskId);
  
  if (!task) {
    console.warn(`[TaskManager] 完成任务失败，任务不存在: ${taskId}`);
    return false;
  }

  store.set(taskId, {
    ...task,
    status: 'completed',
    progress: 100,
    stage: '已完成',
    result,
    completedAt: Date.now(),
    abortController: undefined,
  });
  
  saveTasksToFile(store);
  console.log(`[TaskManager] 任务完成: ${taskId}`);
  return true;
}

/**
 * 标记任务失败
 */
export function failTask(taskId: string, error: string): boolean {
  const store = getTaskStore();
  const task = store.get(taskId);
  
  if (!task) {
    console.warn(`[TaskManager] 标记任务失败失败，任务不存在: ${taskId}`);
    return false;
  }

  store.set(taskId, {
    ...task,
    status: 'failed',
    stage: '生成失败',
    error,
    completedAt: Date.now(),
    abortController: undefined,
  });
  
  saveTasksToFile(store);
  console.log(`[TaskManager] 任务失败: ${taskId}, 错误: ${error}`);
  return true;
}

/**
 * 取消任务
 */
export function cancelTask(taskId: string): boolean {
  const store = getTaskStore();
  const task = store.get(taskId);
  
  if (!task) {
    console.warn(`[TaskManager] 取消任务失败，任务不存在: ${taskId}`);
    return false;
  }

  // 触发取消信号
  if (task.abortController) {
    task.abortController.abort();
  }

  store.set(taskId, {
    ...task,
    status: 'cancelled',
    stage: '已取消',
    completedAt: Date.now(),
    abortController: undefined,
  });
  
  saveTasksToFile(store);
  console.log(`[TaskManager] 任务已取消: ${taskId}`);
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
    console.log(`[TaskManager] 删除任务: ${taskId}`);
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
    console.warn(`[TaskManager] 重试任务失败，任务不存在: ${taskId}`);
    return undefined;
  }

  // 只有失败或已取消的任务可以重试
  if (task.status !== 'failed' && task.status !== 'cancelled') {
    console.warn(`[TaskManager] 重试任务失败，任务状态不允许重试: ${taskId}, status=${task.status}`);
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
  };

  store.set(taskId, updatedTask);
  saveTasksToFile(store);

  console.log(`[TaskManager] 重试任务: ${taskId}, 第${retryCount}次重试`);
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

  store.forEach((task, taskId) => {
    // 清理已完成/失败/取消超过24小时的任务
    if (task.completedAt && (now - task.completedAt) > 24 * 60 * 60 * 1000) {
      expiredTasks.push(taskId);
    }
    // 将运行中超过30分钟未更新的任务标记为僵尸任务（延长超时时间以支持60秒长视频）
    else if (task.status === 'running') {
      const lastUpdate = task.lastUpdatedAt || task.startedAt || task.createdAt;
      if (lastUpdate && (now - lastUpdate) > 30 * 60 * 1000) {
        zombieTasks.push(taskId);
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
        abortController: undefined,
      });
    }
  });

  if (expiredTasks.length > 0 || zombieTasks.length > 0) {
    saveTasksToFile(store);
    console.log(`[TaskManager] 清理了 ${expiredTasks.length} 个过期任务，标记了 ${zombieTasks.length} 个僵尸任务`);
  }

  return expiredTasks.length + zombieTasks.length;
}

// 定期清理过期任务（每30分钟）
if (typeof globalThis !== 'undefined') {
  const cleanupInterval = setInterval(() => {
    cleanupExpiredTasks();
  }, 30 * 60 * 1000);
  cleanupInterval.unref?.();
}

// 服务端启动时：加载任务并恢复状态
console.log('[TaskManager] 任务管理器初始化，存储路径:', TASKS_FILE);

// 启动时先清理一次，避免重启后历史僵尸任务继续显示为运行中。
cleanupExpiredTasks();

// 加载任务并统计
const store = getTaskStore();
const runningCount = Array.from(store.values()).filter(t => t.status === 'running').length;
const pendingCount = Array.from(store.values()).filter(t => t.status === 'pending').length;

if (store.size > 0) {
  console.log(`[TaskManager] 已加载 ${store.size} 个历史任务（${runningCount} 个运行中，${pendingCount} 个等待中）`);
  console.log(`[TaskManager] 运行中的任务将继续显示，如果已超时会被自动清理`);
}
