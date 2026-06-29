'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { BackgroundTask, TaskStatus, TaskContextType } from '@/types/task';

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const STORAGE_KEY = 'dreambox-background-tasks';
const LOCAL_TERMINAL_RETENTION_MS = 24 * 60 * 60 * 1000;
const LOCAL_OPTIMISTIC_TASK_GRACE_MS = 2 * 60 * 1000;
const PERSISTED_TASK_LIMIT = 80;
const PERSISTED_TASK_BYTES_LIMIT = 320_000;
const SERVER_TASK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isTerminalTask = (task: BackgroundTask) =>
  ['completed', 'failed', 'cancelled'].includes(task.status);

const isProbeTask = (taskId: string) => taskId.startsWith('codex-');

const isServerBackedTaskId = (taskId: string) => SERVER_TASK_ID_PATTERN.test(taskId);

const isDisconnectedLocalTask = (task: BackgroundTask) =>
  task.streamStatus === 'reconnecting' || task.streamStatus === 'error';

const shouldKeepLocalTaskAfterServerSync = (
  task: BackgroundTask,
  serverTaskIds: Set<string>,
  now: number
) => {
  if (serverTaskIds.has(task.id)) return false;
  if (isProbeTask(task.id)) return false;
  if (isServerBackedTaskId(task.id)) return false;

  if (isTerminalTask(task)) {
    const finishedAt = task.completedAt || task.createdAt;
    return now - finishedAt <= LOCAL_TERMINAL_RETENTION_MS;
  }

  // 只给刚创建的乐观本地任务一个短暂宽限期。服务端同步成功后仍缺席、
  // 或事件流已重连失败的运行中任务，不能继续冒充真实后台任务。
  return !isDisconnectedLocalTask(task) && now - task.createdAt <= LOCAL_OPTIMISTIC_TASK_GRACE_MS;
};

const toPersistedTasks = (tasks: BackgroundTask[], limit = PERSISTED_TASK_LIMIT) =>
  tasks
    .map(task => ({
      ...task,
      abortController: undefined,
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);

const saveTasksBestEffort = (tasks: BackgroundTask[]) => {
  if (typeof window === 'undefined') return;

  const limits = [PERSISTED_TASK_LIMIT, 40, 12, 0];
  for (const limit of limits) {
    try {
      if (limit === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }

      const payload = JSON.stringify(toPersistedTasks(tasks, limit));
      if (payload.length > PERSISTED_TASK_BYTES_LIMIT && limit > 12) {
        continue;
      }

      window.localStorage.setItem(STORAGE_KEY, payload);
      return;
    } catch (error) {
      if (limit <= 12) {
        console.warn('[TaskContext] 任务本地缓存写入失败，已清理过大的本地缓存', error);
      }
    }
  }
};

// 调试日志开关
const DEBUG = true;
const log = (...args: unknown[]) => {
  if (DEBUG) {
    console.log('[TaskContext]', ...args);
  }
};

interface TaskStreamPayload {
  success?: boolean;
  task?: BackgroundTask;
  error?: string;
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [syncInterval, setSyncInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastCleanupCount, setLastCleanupCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);
  const taskStreamsRef = useRef<Map<string, EventSource>>(new Map());

  // 从服务端同步任务 - 增强版
  const syncFromServer = useCallback(async (force = false) => {
    // 防止重复同步
    if (isSyncingRef.current && !force) {
      log('同步已在进行中，跳过...');
      return;
    }

    const now = Date.now();
    // 非强制模式下，至少间隔1秒
    if (!force && now - lastSyncTimeRef.current < 1000) {
      return;
    }

    isSyncingRef.current = true;
    log('开始从服务端同步任务...');

    try {
      const response = await fetch('/api/tasks');
      
      if (response.ok) {
        const data = await response.json();
        const serverTasks: BackgroundTask[] = Array.isArray(data.tasks) ? data.tasks : [];
        const cleanupCount = typeof data.cleanupCount === 'number' ? data.cleanupCount : 0;
        setLastCleanupCount(cleanupCount);
        setLastSyncedAt(Date.now());
        setLastSyncError(null);
        log(`从服务端获取到 ${serverTasks.length} 个任务`);
        if (cleanupCount > 0) {
          log(`服务端恢复了 ${cleanupCount} 个超时任务`);
        }
        
        // 合并任务：服务端任务优先。服务端已不存在的 UUID/codex 探针任务不再从 localStorage 回流。
        setTasks(prev => {
          const taskMap = new Map<string, BackgroundTask>();
          const serverTaskIds = new Set(serverTasks.map(task => task.id));
          const syncNow = Date.now();
          
          // 先保留真正的本地临时任务；服务端任务、探针和过期终态任务交给服务端列表裁决。
          prev.forEach(task => {
            if (shouldKeepLocalTaskAfterServerSync(task, serverTaskIds, syncNow)) {
              taskMap.set(task.id, task);
            } else {
              log(`移除本地历史任务: ${task.id} (${task.status})`);
            }
          });
          
          // 再用服务端任务更新（保留本地的 abortController）
          let newOrUpdated = 0;
          serverTasks.forEach((serverTask: BackgroundTask) => {
            const existingTask = prev.find(task => task.id === serverTask.id);
            if (!existingTask) {
              newOrUpdated++;
              log(`发现新任务: ${serverTask.id} (${serverTask.type})`);
            } else if (existingTask.status !== serverTask.status || 
                       existingTask.progress !== serverTask.progress) {
              newOrUpdated++;
              log(`任务更新: ${serverTask.id} ${existingTask.status} -> ${serverTask.status}`);
            }
            taskMap.set(serverTask.id, {
              ...serverTask,
              abortController: existingTask?.abortController,
            });
          });
          
          if (newOrUpdated > 0) {
            log(`共 ${newOrUpdated} 个任务有更新`);
          }
          
          // 转换为数组并按时间倒序
          const result = Array.from(taskMap.values()).sort((a, b) => b.createdAt - a.createdAt);
          log(`同步完成，当前共 ${result.length} 个任务`);
          return result;
        });
        
        lastSyncTimeRef.current = now;
      } else {
        const errorText = await response.text();
        setLastSyncError(errorText || `任务同步失败：HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('[TaskContext] 从服务端同步任务失败:', error);
      setLastSyncError(error instanceof Error ? error.message : '任务同步失败，请稍后重试');
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // 计算当前是否有运行中的任务
  const hasRunningTasks = useMemo(() => {
    return tasks.some(task => task.status === 'running' || task.status === 'pending');
  }, [tasks]);

  // 获取运行中的任务
  const getRunningTasks = useCallback(() => {
    return tasks.filter(task => task.status === 'running' || task.status === 'pending');
  }, [tasks]);

  // 获取已完成的任务
  const getCompletedTasks = useCallback(() => {
    return tasks.filter(task => ['completed', 'failed', 'cancelled'].includes(task.status));
  }, [tasks]);

  // 当有运行中的任务时，定期同步 - 更积极
  useEffect(() => {
    if (!initialized) return;

    if (hasRunningTasks) {
      log('检测到运行中的任务，启动积极同步模式（每2秒）');
      // 每2秒同步一次，更及时
      const interval = setInterval(() => {
        syncFromServer(false);
      }, 2000);
      setSyncInterval(interval);
    } else {
      // 没有运行中的任务，降低同步频率
      if (syncInterval) {
        log('没有运行中的任务，切换到保守同步模式');
        clearInterval(syncInterval);
        
        // 即使没有运行任务，也每10秒同步一次，确保不遗漏
        const slowInterval = setInterval(() => {
          syncFromServer(false);
        }, 10000);
        setSyncInterval(slowInterval);
      }
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [hasRunningTasks, initialized, syncFromServer]);

  // 从localStorage加载任务，并立即从服务端同步
  useEffect(() => {
    if (typeof window !== 'undefined') {
      log('初始化 TaskContext...');
      const stored = localStorage.getItem(STORAGE_KEY);
      let initialTasks: BackgroundTask[] = [];
      
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // 注意：这里不随意将 running 状态改为 failed，
          // 因为任务可能真的在服务端后台运行中！
          // 我们会在 syncFromServer 中从服务端获取真实状态
          initialTasks = parsed.slice(0, PERSISTED_TASK_LIMIT).map((task: BackgroundTask) => ({
            ...task,
            abortController: undefined, // AbortController无法序列化
          }));
          log(`从 localStorage 加载了 ${initialTasks.length} 个任务`);
        } catch (e) {
          console.error('加载任务失败:', e);
        }
      }
      
      setTasks(initialTasks);
      setInitialized(true);
      
      // 立即从服务端同步最新任务（获取真实状态）- 强制同步
      log('立即进行首次服务端同步...');
      syncFromServer(true);
    }
  }, [syncFromServer]);

  // 保存到localStorage
  useEffect(() => {
    if (initialized && typeof window !== 'undefined') {
      saveTasksBestEffort(tasks);
    }
  }, [tasks, initialized]);

  // 添加任务
  const addTask = useCallback((task: Omit<BackgroundTask, 'id' | 'createdAt'> & { id?: string }): string => {
    const id = task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTask: BackgroundTask = {
      ...task,
      id,
      createdAt: Date.now(),
    };
    log('添加新任务到本地:', id, newTask.type, newTask.status);
    setTasks(prev => [newTask, ...prev]);
    return id;
  }, []);

  // 更新任务
  const updateTask = useCallback((id: string, updates: Partial<BackgroundTask>) => {
    log('更新任务:', id, updates.status || updates.progress);
    setTasks(prev => {
      const taskExists = prev.some(task => task.id === id);
      if (taskExists) {
        return prev.map(task => 
          task.id === id ? { ...task, ...updates } : task
        );
      } else {
        // 如果任务不存在，创建一个新任务
        log('任务不存在，创建新任务:', id);
        const newTask: BackgroundTask = {
          id,
          type: updates.type || 'video',
          status: updates.status || 'pending',
          config: updates.config || { prompt: '' },
          progress: updates.progress || 0,
          stage: updates.stage || '',
          ...updates,
          createdAt: updates.createdAt || Date.now(),
        };
        return [newTask, ...prev];
      }
    });
  }, []);

  const updateExistingTask = useCallback((id: string, updates: Partial<BackgroundTask>) => {
    log('更新已存在任务:', id, updates.status || updates.progress || updates.streamStatus);
    setTasks(prev => {
      if (!prev.some(task => task.id === id)) {
        log('任务已被服务端同步裁决移除，跳过事件流回写:', id);
        return prev;
      }

      return prev.map(task =>
        task.id === id ? { ...task, ...updates } : task
      );
    });
  }, []);

  useEffect(() => {
    if (!initialized || typeof window === 'undefined' || !('EventSource' in window)) {
      return;
    }

    // 只为“真正活跃”的任务建立 SSE 流，保证前后端协同可控：
    // - running：一直订阅；
    // - pending：仅当最近创建（新提交，可能马上启动）才订阅；陈旧 pending 不再占用连接；
    // - 总数封顶，避免占满浏览器同源连接（约 6 条）导致生成/对话请求挂起。
    const ACTIVE_STREAM_LIMIT = 4;
    const FRESH_PENDING_MS = 10 * 60 * 1000;
    const now = Date.now();
    const active = tasks.filter(task =>
      task.status === 'running' ||
      (task.status === 'pending' && typeof task.createdAt === 'number' && now - task.createdAt < FRESH_PENDING_MS),
    );
    const runningTasks = [
      ...active.filter(task => task.status === 'running'),
      ...active.filter(task => task.status === 'pending'),
    ].slice(0, ACTIVE_STREAM_LIMIT);
    const runningIds = new Set(runningTasks.map(task => task.id));

    taskStreamsRef.current.forEach((source, taskId) => {
      if (!runningIds.has(taskId)) {
        source.close();
        taskStreamsRef.current.delete(taskId);
        updateExistingTask(taskId, { streamStatus: 'closed' });
      }
    });

    runningTasks.forEach(task => {
      if (taskStreamsRef.current.has(task.id)) {
        return;
      }

      const source = new EventSource(`/api/tasks/${task.id}/events`);
      taskStreamsRef.current.set(task.id, source);
      updateExistingTask(task.id, { streamStatus: 'connecting' });

      source.addEventListener('task', event => {
        try {
          const payload = JSON.parse(event.data) as TaskStreamPayload;
          if (payload.task?.id) {
            updateExistingTask(payload.task.id, {
              ...payload.task,
              streamStatus: 'live',
            });
          }
        } catch (error) {
          console.error('[TaskContext] 解析任务事件流失败:', error);
        }
      });

      source.addEventListener('done', event => {
        try {
          const payload = JSON.parse(event.data) as TaskStreamPayload;
          if (payload.task?.id) {
            updateExistingTask(payload.task.id, {
              ...payload.task,
              streamStatus: 'closed',
            });
          }
        } catch (error) {
          console.error('[TaskContext] 解析任务完成事件失败:', error);
        } finally {
          source.close();
          taskStreamsRef.current.delete(task.id);
        }
      });

      source.addEventListener('error', event => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as TaskStreamPayload;
          setLastSyncError(payload.error || '任务事件流连接中断，已继续使用轮询同步');
        } catch {
          setLastSyncError('任务事件流连接中断，已继续使用轮询同步');
        }
        updateExistingTask(task.id, { streamStatus: 'reconnecting' });
      });
    });
  }, [initialized, tasks, updateExistingTask]);

  useEffect(() => {
    return () => {
      taskStreamsRef.current.forEach(source => source.close());
      taskStreamsRef.current.clear();
    };
  }, []);

  // 删除单个任务
  const removeTask = useCallback((id: string) => {
    log('删除任务:', id);
    setTasks(prev => prev.filter(task => task.id !== id));
  }, []);

  // 批量删除任务
  const removeTasks = useCallback(async (ids: string[]) => {
    log('批量删除任务:', ids);
    // 调用 API 删除服务端任务
    try {
      const response = await fetch('/api/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: ids }),
      });
      if (!response.ok) {
        console.error('删除服务端任务失败:', await response.text());
      } else {
        const result = await response.json();
        log('服务端删除结果:', result);
      }
    } catch (error) {
      console.error('删除服务端任务请求失败:', error);
    }
    setTasks(prev => prev.filter(task => !ids.includes(task.id)));
  }, []);

  // 取消任务
  const cancelTask = useCallback((id: string) => {
    log('取消任务:', id);
    setTasks(prev => prev.map(task => {
      if (task.id === id) {
        // 调用abortController取消任务
        if (task.abortController) {
          task.abortController.abort();
        }
        return {
          ...task,
          status: 'cancelled' as TaskStatus,
          stage: '已取消',
          completedAt: Date.now(),
        };
      }
      return task;
    }));
  }, []);

  // 清空已完成任务
  const clearCompletedTasks = useCallback(() => {
    log('清空已完成任务');
    setTasks(prev => prev.filter(task => !['completed', 'failed', 'cancelled'].includes(task.status)));
  }, []);

  // 清空失败任务
  const clearFailedTasks = useCallback(() => {
    log('清空失败任务');
    setTasks(prev => prev.filter(task => task.status !== 'failed'));
  }, []);

  // 清空已取消任务
  const clearCancelledTasks = useCallback(() => {
    log('清空已取消任务');
    setTasks(prev => prev.filter(task => task.status !== 'cancelled'));
  }, []);

  // 清空所有任务
  const clearAllTasks = useCallback(async () => {
    log('清空所有任务...');
    
    // 先取消所有运行中的任务
    tasks.forEach(task => {
      if (task.abortController) {
        task.abortController.abort();
      }
    });
    
    // 调用 API 删除所有服务端任务
    try {
      const allTaskIds = tasks.map(task => task.id);
      log('准备删除服务端任务:', allTaskIds);
      
      if (allTaskIds.length > 0) {
        const response = await fetch('/api/tasks', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskIds: allTaskIds }),
        });
        
        if (response.ok) {
          const result = await response.json();
          log('服务端任务删除结果:', result);
        } else {
          console.error('清空服务端任务失败:', await response.text());
        }
      }
    } catch (error) {
      console.error('清空服务端任务请求失败:', error);
    }
    
    // 清空 localStorage 中的任务数据
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      log('已清空 localStorage 任务数据');
    }
    
    setTasks([]);
    log('已清空前端任务状态');
  }, [tasks]);

  const value: TaskContextType = {
    tasks,
    setTasks,
    addTask,
    updateTask,
    removeTask,
    removeTasks,
    cancelTask,
    getRunningTasks,
    getCompletedTasks,
    clearCompletedTasks,
    clearFailedTasks,
    clearCancelledTasks,
    clearAllTasks,
    syncFromServer,
    lastCleanupCount,
    lastSyncedAt,
    lastSyncError,
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
