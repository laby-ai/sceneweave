'use client';

import React from 'react';
import { Loader2, Sparkles, X, Download, Copy, ExternalLink, Play, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import type { ConsoleTask } from '../generation-console';

interface TaskListProps {
  tasks: ConsoleTask[];
  onNavigate?: (section: string, sub?: string, data?: Record<string, unknown>) => void;
}

export function TaskList({ tasks, onNavigate }: TaskListProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-2 mb-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`rounded-xl text-sm border overflow-hidden ${
            task.status === 'completed'
              ? 'bg-green-50/80 dark:bg-green-950/30 border-green-200 dark:border-green-800'
              : task.status === 'failed'
              ? 'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-800'
              : 'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-800'
          }`}
        >
          {/* 状态行 */}
          <div className="flex items-center gap-3 px-4 py-2.5">
            {task.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-red-500" />}
            {task.status === 'completed' && <Sparkles className="w-4 h-4 text-green-500" />}
            {task.status === 'failed' && <X className="w-4 h-4 text-red-500" />}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-foreground/80">{task.message}</p>
              {task.degraded && task.status === 'completed' && (
                <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  已自动切换到备用服务
                </span>
              )}
              {task.status === 'processing' && (
                <div className="mt-1 h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all duration-300"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 完成后结果预览 */}
          {task.status === 'completed' && task.resultUrl && (
            <div className="border-t border-border/30 bg-card/50 px-4 py-3">
              {task.type === 'image' ? (
                <div className="flex gap-2 items-start">
                  <div className="relative group flex-shrink-0">
                    <img
                      src={task.resultUrl}
                      alt="生成结果"
                      className="w-16 h-16 object-cover rounded-lg border border-border/50"
                    />
                    <button
                      onClick={() => {
                        if (onNavigate) onNavigate('media', 'image', { imageUrls: [task.resultUrl], prompt: task.prompt });
                      }}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{task.prompt}</p>
                    <div className="flex gap-1.5 mt-1.5">
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = task.resultUrl!;
                          link.target = '_blank';
                          link.click();
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-all"
                      >
                        <Download className="w-2.5 h-2.5" />
                        下载
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(task.resultUrl!)}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-secondary text-muted-foreground rounded-md hover:bg-muted transition-all"
                      >
                        <Copy className="w-2.5 h-2.5" />
                        复制链接
                      </button>
                    </div>
                  </div>
                </div>
              ) : task.type === 'video' ? (
                <div className="flex gap-2 items-start">
                  <div className="relative group flex-shrink-0 w-24 h-14 bg-black/5 dark:bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                    <video
                      src={task.resultUrl}
                      className="w-full h-full object-cover"
                      muted
                    />
                    <button
                      onClick={() => {
                        if (onNavigate) onNavigate('video', undefined, { videoUrl: task.resultUrl });
                      }}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Play className="w-4 h-4 text-white fill-white" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{task.prompt}</p>
                    <div className="flex gap-1.5 mt-1.5">
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = task.resultUrl!;
                          link.target = '_blank';
                          link.click();
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-all"
                      >
                        <Download className="w-2.5 h-2.5" />
                        下载
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(task.resultUrl!)}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-secondary text-muted-foreground rounded-md hover:bg-muted transition-all"
                      >
                        <Copy className="w-2.5 h-2.5" />
                        复制链接
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
