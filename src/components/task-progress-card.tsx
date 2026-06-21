'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Pause,
  Play,
  Trash2,
  Clock,
  ChevronDown,
  ChevronUp,
  Shield,
  ExternalLink,
} from 'lucide-react';
import type {
  MonitorTask,
  MonitorTaskStatus,
  OperationLog,
  ProgressUpdate,
  ContentSafetyCheck,
  CopyrightCheckResult,
} from '@/lib/video-monitor/types';
import {
  STATUS_LABELS,
  STATUS_STEP_DESCRIPTIONS,
  STATUS_PROGRESS_RANGE,
  ERROR_CODE_USER_MESSAGES,
} from '@/lib/video-monitor/constants';

// ============================================================
// Props
// ============================================================

interface TaskProgressCardProps {
  task: MonitorTask;
  logs?: OperationLog[];
  safetyChecks?: ContentSafetyCheck[];
  copyrightResult?: CopyrightCheckResult;
  onRetry?: (taskId: string) => void;
  onPause?: (taskId: string) => void;
  onResume?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onViewDetail?: (taskId: string) => void;
}

// ============================================================
// 状态图标映射
// ============================================================

function StatusIcon({ status }: { status: MonitorTaskStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-400" />;
    case 'paused':
      return <Pause className="w-5 h-5 text-red-400" />;
    case 'cancelled':
      return <AlertTriangle className="w-5 h-5 text-foreground/70" />;
    default:
      return <Loader2 className="w-5 h-5 text-[#EF4444] animate-spin" />;
  }
}

// ============================================================
// 进度条
// ============================================================

function ProgressBar({
  progress,
  status,
}: {
  progress: number;
  status: MonitorTaskStatus;
}) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(progress), 50);
    return () => clearTimeout(timer);
  }, [progress]);

  const barColor =
    status === 'failed'
      ? 'bg-red-500'
      : status === 'completed'
        ? 'bg-emerald-500'
        : status === 'paused'
          ? 'bg-red-500'
          : 'bg-[#EF4444]';

  return (
    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
      <div
        className={`h-full ${barColor} transition-all duration-500 ease-out rounded-full`}
        style={{ width: `${animated}%` }}
      />
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================

export function TaskProgressCard({
  task,
  logs = [],
  safetyChecks = [],
  copyrightResult,
  onRetry,
  onPause,
  onResume,
  onDelete,
  onViewDetail,
}: TaskProgressCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'safety' | 'copyright'>('logs');
  const progressRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新日志
  useEffect(() => {
    if (expanded && progressRef.current) {
      progressRef.current.scrollTop = progressRef.current.scrollHeight;
    }
  }, [expanded, logs.length]);

  const isTerminal = ['completed', 'failed', 'cancelled'].includes(task.status);
  const canRetry = task.status === 'failed' && task.retryCount < task.maxRetries;
  const canPause = ['generating', 'assembling'].includes(task.status);
  const canResume = task.status === 'paused';

  const elapsedTime = task.completedAt
    ? task.completedAt - task.createdAt
    : task.failedAt
      ? task.failedAt - task.createdAt
      : Date.now() - task.createdAt;

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}秒`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}分${s % 60}秒`;
    return `${Math.floor(m / 60)}时${m % 60}分`;
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-[#EF4444]/30 transition-colors">
      {/* 主体内容 */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* 左侧状态 + 信息 */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <StatusIcon status={task.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-medium text-foreground truncate">
                  {task.projectName || task.taskId}
                </h3>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  task.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : task.status === 'failed'
                      ? 'bg-red-500/20 text-red-400'
                      : task.status === 'paused'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-[#EF4444]/20 text-[#EF4444]'
                }`}>
                  {STATUS_LABELS[task.status]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {task.currentStep || STATUS_STEP_DESCRIPTIONS[task.status]}
              </p>
            </div>
          </div>

          {/* 右侧操作按钮 */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {canRetry && (
              <button
                onClick={() => onRetry?.(task.taskId)}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-[#EF4444] transition-colors"
                title="重试"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            {canPause && (
              <button
                onClick={() => onPause?.(task.taskId)}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-red-400 transition-colors"
                title="暂停"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
            {canResume && (
              <button
                onClick={() => onResume?.(task.taskId)}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-emerald-400 transition-colors"
                title="继续"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onViewDetail?.(task.taskId)}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="查看详情"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            {isTerminal && (
              <button
                onClick={() => onDelete?.(task.taskId)}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-red-400 transition-colors"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 进度条 */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <ProgressBar progress={task.progress} status={task.status} />
            <span className="text-xs text-muted-foreground ml-2 w-10 text-right">
              {task.progress}%
            </span>
          </div>
        </div>

        {/* 底部信息行 */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(elapsedTime)}
            </span>
            <span>{formatDate(task.createdAt)}</span>
            {task.retryCount > 0 && (
              <span className="text-red-400/70">重试{task.retryCount}次</span>
            )}
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            详情
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* 错误信息 */}
        {task.status === 'failed' && task.errorMessage && (
          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-xs text-red-400">{task.errorMessage}</p>
            {task.errorCode && (
              <p className="text-[10px] text-red-400/60 mt-1">
                错误码: {task.errorCode}
                {ERROR_CODE_USER_MESSAGES[task.errorCode as keyof typeof ERROR_CODE_USER_MESSAGES] && (
                  <span className="ml-2">
                    {ERROR_CODE_USER_MESSAGES[task.errorCode as keyof typeof ERROR_CODE_USER_MESSAGES]}
                  </span>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className="border-t border-border">
          {/* Tab 切换 */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeTab === 'logs'
                  ? 'text-[#EF4444] border-b-2 border-[#EF4444]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              操作日志
            </button>
            <button
              onClick={() => setActiveTab('safety')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeTab === 'safety'
                  ? 'text-[#EF4444] border-b-2 border-[#EF4444]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              安全检查
            </button>
            <button
              onClick={() => setActiveTab('copyright')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeTab === 'copyright'
                  ? 'text-[#EF4444] border-b-2 border-[#EF4444]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              版权合规
            </button>
          </div>

          {/* 内容区 */}
          <div ref={progressRef} className="p-3 max-h-48 overflow-y-auto scrollbar-thin">
            {activeTab === 'logs' && (
              logs.length > 0 ? (
                <div className="space-y-1.5">
                  {logs.map((log) => (
                    <div key={log.logId} className="flex items-start gap-2">
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5">
                        {formatDate(log.createdAt)}
                      </span>
                      <span className={`text-[10px] px-1 py-0.5 rounded ${
                        log.operationType === 'error'
                          ? 'bg-red-500/20 text-red-400'
                          : log.operationType === 'retry'
                            ? 'bg-amber-500/20 text-amber-400'
                            : log.operationType === 'config_save'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-secondary text-muted-foreground'
                      }`}>
                        {log.operationType}
                      </span>
                      <span className="text-[11px] text-foreground flex-1">
                        {log.detail}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">暂无操作日志</p>
              )
            )}

            {activeTab === 'safety' && (
              safetyChecks.length > 0 ? (
                <div className="space-y-2">
                  {safetyChecks.map((check, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <Shield className={`w-3.5 h-3.5 ${
                        check.result.allowed ? 'text-emerald-400' : 'text-red-400'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-foreground">{check.layer}</span>
                          <span className={`text-[10px] px-1 py-0.5 rounded ${
                            check.result.allowed
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {check.result.allowed ? '通过' : '拦截'}
                          </span>
                        </div>
                        {check.result.details && check.result.details.map((d, i) => (
                          <p key={i} className="text-[10px] text-muted-foreground mt-0.5">{d}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">暂无安全检查记录</p>
              )
            )}

            {activeTab === 'copyright' && (
              copyrightResult ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      copyrightResult.passed
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {copyrightResult.passed ? '版权合规' : '存在版权风险'}
                    </span>
                    {copyrightResult.watermarkApplied && (
                      <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                        已加水印
                      </span>
                    )}
                    {copyrightResult.blockchainHash && (
                      <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                        已存证
                      </span>
                    )}
                  </div>
                  {copyrightResult.issues.length > 0 && (
                    <div className="space-y-1">
                      {copyrightResult.issues.map((issue, idx) => (
                        <div key={idx} className="p-2 bg-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1 py-0.5 rounded ${
                              issue.severity === 'critical'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {issue.severity}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{issue.type}</span>
                          </div>
                          <p className="text-[11px] text-foreground mt-1">{issue.description}</p>
                          <p className="text-[10px] text-muted-foreground">{issue.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">暂无版权检查记录</p>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
