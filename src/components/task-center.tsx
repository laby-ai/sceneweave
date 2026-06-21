'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Trash2,
  Video,
  Image as ImageIcon,
  FileText,
  Palette,
  ExternalLink,
  X,
  RefreshCw,
  CheckSquare,
  Square,
  Settings,
  Image,
  Mic,
  Type,
  UserCircle,
  Grid3X3,
  Film,
  Download,
  Play,
  Copy,
  ZoomIn,
  Music
} from 'lucide-react';
import { useTasks } from '@/contexts/TaskContext';
import { BackgroundTask, TaskType, TaskStatus } from '@/types/task';
import { getBYOKRequestHeaders } from '@/lib/byok-client';
import { deriveProductionSegmentUiState } from '@/lib/production-segment-ui';
import { useTaskCenterProviderRecovery } from '@/hooks/useTaskCenterProviderRecovery';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { NineGridViewer } from './NineGridViewer';
import { TaskCenterSegmentActions } from './tasks/task-center-segment-actions';

interface TaskCenterProps {
  onClose?: () => void;
  onViewConfig?: (task: BackgroundTask) => void;
  onOpenResult?: (task: BackgroundTask) => void;
  onRegenerate?: (task: BackgroundTask) => void;
}

const typeIcons: Record<TaskType, typeof Video> = {
  video: Video,
  image: ImageIcon,
  poster: Palette,
  copywriting: FileText,
  avatar: UserCircle,
  storyboard: Film,
  douyin: Music,
};

const typeLabels: Record<TaskType, string> = {
  video: '视频',
  image: '图片',
  poster: '海报',
  copywriting: '文案',
  avatar: '数字人',
  storyboard: '分镜头',
  douyin: '抖音',
};

const statusConfig: Record<TaskStatus, { label: string; color: string; icon: typeof Loader2 }> = {
  pending: { label: '等待中', color: 'bg-amber-500', icon: Clock },
  running: { label: '生成中', color: 'bg-[#4F6CFF]', icon: Loader2 },
  completed: { label: '已完成', color: 'bg-emerald-500', icon: CheckCircle },
  failed: { label: '失败', color: 'bg-amber-600', icon: XCircle },
  cancelled: { label: '已取消', color: 'bg-slate-500', icon: XCircle },
};

function getRecoveryHint(task: BackgroundTask) {
  if (task.status !== 'failed') return null;
  const details = `${task.stage || ''} ${task.error || ''}`;
  if (/超时|中断|超过30分钟|无响应/.test(details)) {
    return '系统已把长时间无响应任务恢复为失败状态。建议先查看配置，确认素材和模型后重新生成。';
  }
  if (/API|Key|Base|模型|provider|供应商/i.test(details)) {
    return '这通常是模型供应商配置问题。请先到设置检查 API Base、API Key 和模型名，再重试任务。';
  }
  return '请查看配置确认输入内容，必要时调整提示词或素材后重新生成。';
}

function getStreamLabel(task: BackgroundTask) {
  if (task.status !== 'running' && task.status !== 'pending') return null;

  switch (task.streamStatus) {
    case 'live':
      return '实时同步';
    case 'connecting':
      return '连接进度中';
    case 'reconnecting':
      return '重连中，已保留轮询';
    case 'error':
      return '事件流异常，已轮询';
    default:
      return '轮询同步';
  }
}

function formatElapsed(seconds?: number) {
  if (!seconds || seconds < 1) return null;
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  if (minutes <= 0) return `${restSeconds}秒`;
  return `${minutes}分${restSeconds}秒`;
}

function getRecoverableSegments(task: BackgroundTask) {
  if (!Array.isArray(task.result?.segments)) return [];
  return task.result.segments.filter(segment => Boolean(segment.videoUrl));
}

function getRestorableSegments(task: BackgroundTask) {
  if (!Array.isArray(task.result?.segments)) return [];
  return task.result.segments.filter(segment =>
    !segment.videoUrl &&
    Boolean(segment.prompt) &&
    Boolean(segment.duration) &&
    (segment.status === 'failed' || Array.isArray(task.result?.failedSegments) && task.result.failedSegments.includes(segment.index))
  );
}

function getProductionProject(task: BackgroundTask) {
  return task.result?.productionProject;
}

function getAssemblyPlan(task: BackgroundTask) {
  return task.result?.assemblyPlan;
}

function getAssemblyQueue(task: BackgroundTask) {
  return task.result?.assemblyQueue;
}

function getStoryReadability(task: BackgroundTask) {
  return task.result?.storyReadability;
}

function getProductionVideoSegmentAssets(task: BackgroundTask) {
  const project = getProductionProject(task);
  if (!project?.assets?.length) return [];
  return project.assets.filter(asset => asset.kind === 'videoSegment' && typeof asset.metadata?.videoUrl === 'string');
}

function getProductionFinalVideoAssets(task: BackgroundTask) {
  const project = getProductionProject(task);
  if (!project?.assets?.length) return [];
  return project.assets.filter(asset => asset.kind === 'finalVideo' && typeof asset.metadata?.videoUrl === 'string');
}

function formatSegmentDuration(duration: unknown) {
  const numericDuration = typeof duration === 'number' ? duration : Number(duration);
  return Number.isFinite(numericDuration) ? `${numericDuration.toFixed(1)}s` : '?s';
}

interface TaskItemProps {
  task: BackgroundTask;
  onSync: () => void;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  showCheckbox: boolean;
  onViewConfig?: (task: BackgroundTask) => void;
  onOpenResult?: (task: BackgroundTask) => void;
  onViewNineGrid?: (task: BackgroundTask) => void;
  onRegenerate?: (task: BackgroundTask) => void;
}

function TaskItem({ task, onSync, isSelected, onSelect, showCheckbox, onViewConfig, onOpenResult, onViewNineGrid, onRegenerate }: TaskItemProps) {
  const { cancelTask, removeTask } = useTasks();
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [segmentRetryingKey, setSegmentRetryingKey] = useState<string | null>(null);
  const [segmentResumeKey, setSegmentResumeKey] = useState<string | null>(null);
  const [mergeRetrying, setMergeRetrying] = useState(false);
  const {
    segmentProviderRecoveryKey,
    recoverAssemblyProviderTask,
  } = useTaskCenterProviderRecovery({ taskId: task.id, onSync });
  const TypeIcon = typeIcons[task.type] || FileText;
  const status = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const recoveryHint = getRecoveryHint(task);
  const streamLabel = getStreamLabel(task);
  const elapsedLabel = formatElapsed(task.elapsedSeconds);
  const recoverableSegments = getRecoverableSegments(task);
  const restorableSegments = getRestorableSegments(task);
  const hasRecoverableSegments = recoverableSegments.length > 0;
  const hasRestorableSegments = restorableSegments.length > 0;
  const productionProject = getProductionProject(task);
  const assemblyPlan = getAssemblyPlan(task);
  const assemblyQueue = getAssemblyQueue(task);
  const storyReadability = getStoryReadability(task);
  const productionVideoSegmentAssets = getProductionVideoSegmentAssets(task);
  const productionFinalVideoAssets = getProductionFinalVideoAssets(task);
  const hasAssemblySegments = Boolean(assemblyPlan?.segments?.length);

  const handleCancel = async () => {
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        cancelTask(task.id);
        onSync();
      } else {
        const error = await response.json();
        alert(error.error || '取消任务失败');
      }
    } catch (error) {
      console.error('取消任务失败:', error);
      alert('取消任务失败，请重试');
    }
  };

  const handleViewConfig = () => {
    setShowConfigDialog(true);
  };

  const handleOpenResult = () => {
    if (task.result) {
      setShowResultDialog(true);
    } else {
      alert('该任务暂无结果可查看');
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const [retrying, setRetrying] = useState(false);

  const handleRetryAssemblySegment = async (segmentIndex: number, childTaskId?: string | null) => {
    const retryKey = `${task.id}:${segmentIndex}`;
    setSegmentRetryingKey(retryKey);
    try {
      const res = await fetch('/api/production/assembly-plan/segment/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentTaskId: task.id,
          segmentIndex,
          childTaskId: childTaskId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || '片段重新排队失败');
        return;
      }
      await onSync();
    } catch {
      alert('网络错误，片段重新排队失败');
    } finally {
      setSegmentRetryingKey(null);
    }
  };

  const handleRetryMergeSegments = async () => {
    setMergeRetrying(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/merge-segments`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || '片段合成失败，请稍后重试');
        return;
      }
      await onSync();
      alert('已使用保留片段合成成片，未重新调用视频生成供应商。');
    } catch {
      alert('网络错误，片段合成失败');
    } finally {
      setMergeRetrying(false);
    }
  };

  const handleCheckResumeSegment = async (segmentIndex: number) => {
    const resumeKey = `${task.id}:${segmentIndex}:dry-run`;
    setSegmentResumeKey(resumeKey);
    try {
      const res = await fetch(`/api/tasks/${task.id}/resume-segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentIndex, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || '片段恢复检查失败');
        return;
      }
      await onSync();
      alert(`已确认：可只补第 ${data.segmentIndex + 1} 个片段，已成功的 ${data.successSegmentCount}/${data.segmentCount} 个片段不会重跑。`);
    } catch {
      alert('网络错误，片段恢复检查失败');
    } finally {
      setSegmentResumeKey(null);
    }
  };

  const handleResumeSegmentWithCost = async (segmentIndex: number) => {
    const byokHeaders = getBYOKRequestHeaders() as Record<string, string>;
    if (!byokHeaders['x-yh-api-key'] || !byokHeaders['x-yh-api-base'] || !byokHeaders['x-yh-provider']) {
      alert('请先在设置里保存 Ark API Base、API Key 和视频模型，再真实补段。');
      return;
    }

    const confirmed = window.confirm(`将真实提交第 ${segmentIndex + 1} 个片段到供应商生成，可能产生费用。已完成片段不会重跑。是否继续？`);
    if (!confirmed) return;

    const resumeKey = `${task.id}:${segmentIndex}:real`;
    setSegmentResumeKey(resumeKey);
    try {
      const res = await fetch(`/api/tasks/${task.id}/resume-segment`, {
        method: 'POST',
        headers: {
          ...byokHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          segmentIndex,
          dryRun: false,
          allowRealCost: true,
          mergeAfterComplete: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || '真实补段失败');
        await onSync();
        return;
      }
      await onSync();
      alert(data.merged ? '失败片段已补齐，并已合成为成片。' : '失败片段已补齐，仍有其他片段待处理。');
    } catch {
      alert('网络错误，真实补段失败');
    } finally {
      setSegmentResumeKey(null);
    }
  };

  const handleRegenerate = async () => {
    setRetrying(true);
    try {
      // 调用后端重试API，自动切换可用服务重试
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      });
      const data = await res.json();
      if (data.success) {
        onSync(); // 刷新任务列表
      } else {
        // 后端重试失败，尝试前端回调方式
        if (onRegenerate) {
          onRegenerate(task);
        } else {
          alert(data.error || '重试失败，请稍后再试');
        }
      }
    } catch {
      // 网络错误，尝试前端回调方式
      if (onRegenerate) {
        onRegenerate(task);
      } else {
        alert('网络错误，重试失败');
      }
    } finally {
      setRetrying(false);
    }
  };

  const getConfigSummary = () => {
    const parts: string[] = [];
    if (task.config?.style && task.config.style !== 'none') parts.push(task.config.style);
    if (task.config?.mood && task.config.mood !== 'none') parts.push(task.config.mood);
    if (task.config?.duration) parts.push(`${task.config.duration}秒`);
    if (task.config?.resolution) parts.push(task.config.resolution);
    if (task.config?.size) parts.push(task.config.size);
    
    if (task.config?.materials && task.config.materials.length > 0) {
      parts.push(`${task.config.materials.length}个素材`);
    }
    
    if (task.config?.enableSubtitle) {
      const subtitleInfo = ['字幕'];
      if (task.config?.generateVoice) subtitleInfo.push('配音');
      parts.push(subtitleInfo.join('+'));
    }
    
    if (task.config?.watermark === false) {
      parts.push('无水印');
    }
    
    return parts.length > 0 ? parts.join(' · ') : '查看详细配置';
  };

  return (
    <div className="p-4 border rounded-lg hover:bg-card transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {showCheckbox && ['completed', 'failed', 'cancelled'].includes(task.status) && (
            <Checkbox 
              checked={isSelected}
              onCheckedChange={onSelect}
              className="mt-1"
            />
          )}
          <div className="p-2 bg-muted rounded-lg">
            <TypeIcon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{typeLabels[task.type] || '任务'}生成</span>
              <Badge variant="secondary" className={`${status.color} text-white text-xs`}>
                <StatusIcon className={`w-3 h-3 mr-1 ${task.status === 'running' ? 'animate-spin' : ''}`} />
                {status.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate" title={getConfigSummary()}>
              {getConfigSummary()}
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-foreground/70">
              <span>{task.createdAt ? formatDistanceToNow(task.createdAt, { addSuffix: true, locale: zhCN }) : '未知时间'}</span>
              {task.progress > 0 && task.status === 'running' && (
                <span className="text-[#70E0FF]">{Math.round(task.progress)}%</span>
              )}
            </div>
            {(task.status === 'running' || task.status === 'pending') && (
              <div className="mt-2">
                <div className="w-full bg-accent rounded-full h-1.5">
                  <div 
                    className="bg-gradient-to-r from-[#4F6CFF] to-[#70E0FF] h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${task.progress || 0}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                  <p className="min-w-0 truncate text-muted-foreground">{task.stage || '处理中...'}</p>
                  {streamLabel && (
                    <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[11px] text-cyan-100">
                      {streamLabel}
                    </span>
                  )}
                </div>
                {task.message && task.message !== task.stage && (
                  <p className="mt-1 text-xs text-foreground/70">{task.message}</p>
                )}
                {(task.waitingHint || elapsedLabel) && (
                  <div className="mt-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-50">
                    <div className="flex items-start gap-2">
                      <Clock className="mt-0.5 h-3.5 w-3.5 flex-none text-cyan-200" />
                      <div className="min-w-0 space-y-1">
                        {task.waitingHint && <p className="leading-relaxed">{task.waitingHint}</p>}
                        {elapsedLabel && (
                          <p className="text-cyan-100/70">已运行 {elapsedLabel}，可留在后台继续生成。</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {(task.error || recoveryHint) && (
              <div className="mt-2 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                {task.error && (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-300" />
                    <span className="leading-relaxed">{task.error}</span>
                  </div>
                )}
                {recoveryHint && (
                  <p className="mt-1 leading-relaxed text-amber-100/80">{recoveryHint}</p>
                )}
              </div>
            )}
            {hasRecoverableSegments && (
              <div className="mt-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-50">
                <div className="flex items-start gap-2">
                  <Film className="mt-0.5 h-3.5 w-3.5 flex-none text-cyan-200" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">已保留 {recoverableSegments.length} 个可恢复片段</p>
                    <p className="mt-1 text-cyan-100/70">
                      合成失败时不会丢失已生成镜头，可先打开片段检查内容，之后再重试合成或重新生成。
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {recoverableSegments.slice(0, 4).map((segment, index) => (
                        <Button
                          key={`${segment.taskId || segment.index}-${index}`}
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(segment.videoUrl, '_blank')}
                          className="h-7 border-cyan-300/25 bg-black/20 px-2 text-[11px] text-cyan-50 hover:bg-cyan-300/15"
                        >
                          <Play className="mr-1 h-3 w-3" />
                          片段 {segment.index + 1}
                        </Button>
                      ))}
                      {recoverableSegments.length > 4 && (
                        <span className="self-center text-[11px] text-cyan-100/60">+{recoverableSegments.length - 4}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {hasRestorableSegments && (
              <div className="mt-2 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs text-amber-50">
                <div className="flex items-start gap-2">
                  <RefreshCw className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-200" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">待补 {restorableSegments.length} 个失败片段</p>
                    <p className="mt-1 text-amber-100/75">
                      可先检查恢复范围，再确认是否真实提交；已完成片段不会重新生成。
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {restorableSegments.slice(0, 3).map(segment => (
                        <Button
                          key={`resume-check-${task.id}-${segment.index}`}
                          variant="outline"
                          size="sm"
                          onClick={() => handleCheckResumeSegment(segment.index)}
                          disabled={segmentResumeKey === `${task.id}:${segment.index}:dry-run`}
                          className="h-7 border-amber-300/25 bg-black/20 px-2 text-[11px] text-amber-50 hover:bg-amber-300/15 disabled:opacity-50"
                        >
                          <RefreshCw className={`mr-1 h-3 w-3 ${segmentResumeKey === `${task.id}:${segment.index}:dry-run` ? 'animate-spin' : ''}`} />
                          检查片段 {segment.index + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {productionProject && (
              <div className="mt-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs text-sky-50">
                <div className="flex items-start gap-2">
                  <Grid3X3 className="mt-0.5 h-3.5 w-3.5 flex-none text-sky-200" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">制作项目：{productionProject.title}</p>
                    <p className="mt-1 text-sky-100/70">
                      {productionProject.stages.length} 个阶段 · {productionProject.assets.length} 个资产 · {productionProject.storyboard?.shotCount || 0} 个镜头 · {productionVideoSegmentAssets.length} 个视频片段 · {productionFinalVideoAssets.length} 个最终成片
                    </p>
                    {productionProject.output?.nextStep && (
                      <p className="mt-1 text-sky-100/60">{productionProject.output.nextStep}</p>
                    )}
                    {storyReadability && (
                      <div className={`mt-2 rounded-md border p-2 ${
                        storyReadability.pass
                          ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-50'
                          : 'border-amber-300/25 bg-amber-300/10 text-amber-50'
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">故事可读性</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              storyReadability.pass
                                ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                                : 'border-amber-300/25 bg-amber-300/10 text-amber-100'
                            }`}
                          >
                            {storyReadability.score}/{storyReadability.threshold}
                          </Badge>
                        </div>
                        {storyReadability.issues?.length ? (
                          <p className="mt-1 text-[11px] leading-relaxed opacity-75">
                            {storyReadability.issues.slice(0, 2).map(issue => issue.message).join(' / ')}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] leading-relaxed opacity-75">
                            已具备主角、目标、危险、动作结果和段落衔接，可进入真实生成前检查。
                          </p>
                        )}
                      </div>
                    )}
                    {productionFinalVideoAssets.length > 0 && (
                      <div className="mt-2 rounded-md border border-cyan-300/25 bg-black/25 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-cyan-50">已归档最终成片</span>
                          <Badge variant="outline" className="border-cyan-300/25 bg-cyan-300/10 text-[10px] text-cyan-100">
                            {productionFinalVideoAssets.length} 条
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {productionFinalVideoAssets.slice(0, 2).map((asset) => {
                            const metadata = asset.metadata || {};
                            const videoUrl = String(metadata.videoUrl || '');
                            const segmentCount = metadata.segmentAssetCount || metadata.segmentAssetIds?.length || 0;
                            return (
                              <Button
                                key={asset.id}
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(videoUrl, '_blank')}
                                className="h-7 border-cyan-300/25 bg-black/20 px-2 text-[11px] text-cyan-50 hover:bg-cyan-300/15"
                              >
                                <Play className="mr-1 h-3 w-3" />
                                成片 · {formatSegmentDuration(metadata.duration)} · {segmentCount} 段
                              </Button>
                            );
                          })}
                          {productionFinalVideoAssets.length > 2 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleOpenResult}
                              className="h-7 border-sky-300/20 bg-black/20 px-2 text-[11px] text-sky-50 hover:bg-sky-300/15"
                            >
                              查看全部
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    {productionVideoSegmentAssets.length > 0 && (
                      <div className="mt-2 rounded-md border border-emerald-300/20 bg-black/20 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-emerald-50">已归档视频片段</span>
                          <Badge variant="outline" className="border-emerald-300/25 bg-emerald-300/10 text-[10px] text-emerald-100">
                            {productionVideoSegmentAssets.length} 段
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {productionVideoSegmentAssets.slice(0, 3).map((asset, index) => {
                            const metadata = asset.metadata || {};
                            const videoUrl = String(metadata.videoUrl || '');
                            const segmentLabel = metadata.segmentId || metadata.shotId || index + 1;
                            return (
                              <Button
                                key={asset.id}
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(videoUrl, '_blank')}
                                className="h-7 border-emerald-300/25 bg-black/20 px-2 text-[11px] text-emerald-50 hover:bg-emerald-300/15"
                              >
                                <Film className="mr-1 h-3 w-3" />
                                片段 {String(segmentLabel)} · {formatSegmentDuration(metadata.duration)}
                              </Button>
                            );
                          })}
                          {productionVideoSegmentAssets.length > 3 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleOpenResult}
                              className="h-7 border-sky-300/20 bg-black/20 px-2 text-[11px] text-sky-50 hover:bg-sky-300/15"
                            >
                              查看全部
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {task.status === 'running' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-400/10"
            >
              取消
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewConfig}
            className="h-8 text-xs"
          >
            <Settings className="w-3 h-3 mr-1" />
            查看配置
          </Button>
          {(task.status === 'failed' || task.status === 'cancelled') && onViewConfig && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewConfig(task)}
              className="h-8 text-xs text-[#70E0FF] hover:text-cyan-100 hover:bg-cyan-400/10"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              编辑配置
            </Button>
          )}
          {task.status === 'completed' && task.result?.nineGridImages && Array.isArray(task.result.nineGridImages) && task.result.nineGridImages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (onViewNineGrid) {
                  onViewNineGrid(task);
                }
              }}
              className="h-8 text-xs text-[#70E0FF] hover:text-cyan-100 hover:bg-cyan-400/10"
            >
              <Grid3X3 className="w-3 h-3 mr-1" />
              查看九宫格
            </Button>
          )}
          
          {task.status === 'completed' && task.result && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenResult}
              className="h-8 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              {task.type === 'video' ? (
                <><Video className="w-3 h-3 mr-1" />打开视频</>
              ) : task.type === 'image' ? (
                <><ImageIcon className="w-3 h-3 mr-1" />打开图片</>
              ) : (
                <><ExternalLink className="w-3 h-3 mr-1" />打开结果</>
              )}
            </Button>
          )}
          {task.status === 'failed' && hasRecoverableSegments && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenResult}
              className="h-8 text-xs text-cyan-100 hover:bg-cyan-400/10"
            >
              <Film className="w-3 h-3 mr-1" />
              查看片段
            </Button>
          )}
          {task.status === 'failed' && hasRestorableSegments && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCheckResumeSegment(restorableSegments[0].index)}
              disabled={segmentResumeKey === `${task.id}:${restorableSegments[0].index}:dry-run`}
              className="h-8 text-xs text-amber-200 hover:bg-amber-400/10 disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${segmentResumeKey === `${task.id}:${restorableSegments[0].index}:dry-run` ? 'animate-spin' : ''}`} />
              只补失败段
            </Button>
          )}
          {['completed', 'failed', 'cancelled'].includes(task.status) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegenerate}
              disabled={retrying}
              className="h-8 text-xs text-[#70E0FF] hover:text-cyan-100 hover:bg-cyan-400/10 disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? '重试中...' : '重新生成'}
            </Button>
          )}
          {['completed', 'failed', 'cancelled'].includes(task.status) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeTask(task.id)}
              className="h-8 text-xs text-foreground/70 hover:text-muted-foreground"
              title="删除任务"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              详细配置
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">提示词</label>
              <p className="text-sm bg-slate-100 text-slate-900 p-2 rounded whitespace-pre-wrap break-words border border-slate-200">
                {task.config?.prompt || '无'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {task.config?.duration && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">时长</label>
                  <p className="text-sm">{task.config?.duration}秒</p>
                </div>
              )}
              {task.config?.resolution && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">分辨率</label>
                  <p className="text-sm">{task.config?.resolution}</p>
                </div>
              )}
              {task.config?.ratio && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">比例</label>
                  <p className="text-sm">{task.config?.ratio}</p>
                </div>
              )}
              {task.config?.size && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">尺寸</label>
                  <p className="text-sm">{task.config?.size}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {task.config?.style && task.config?.style !== 'none' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">风格</label>
                  <p className="text-sm">{task.config?.style}</p>
                </div>
              )}
              {task.config?.mood && task.config?.mood !== 'none' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">氛围</label>
                  <p className="text-sm">{task.config?.mood}</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 结果预览对话框 */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {task.type === 'video' ? <Video className="w-5 h-5" /> :
               task.type === 'image' ? <ImageIcon className="w-5 h-5" /> :
               task.type === 'poster' ? <Palette className="w-5 h-5" /> :
               task.type === 'avatar' ? <UserCircle className="w-5 h-5" /> :
               <FileText className="w-5 h-5" />}
              {typeLabels[task.type] || '任务'}结果
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 space-y-4">
            {productionProject && (
              <div className="space-y-3 rounded-lg border border-sky-300/20 bg-sky-300/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-sky-50">制作项目结构</p>
                    <p className="mt-1 text-xs text-sky-100/70">
                      统一追踪剧本、角色、场景、道具、分镜、任务和成片阶段，避免创作资产散落在不同入口。
                    </p>
                  </div>
                  <Badge variant="outline" className="border-sky-300/30 bg-sky-300/10 text-sky-100">
                    {productionProject.duration}s
                  </Badge>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {productionProject.stages.map(stage => (
                    <div key={stage.id} className="rounded-md border border-sky-300/15 bg-black/20 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-sky-50">{stage.name}</span>
                        <span className="rounded bg-sky-300/10 px-1.5 py-0.5 text-[10px] text-sky-100/70">{stage.status}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-sky-100/65">{stage.summary}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-sky-50">项目资产</p>
                  <div className="flex flex-wrap gap-2">
                    {productionProject.assets.slice(0, 12).map(asset => (
                      <span key={asset.id} className="rounded-full border border-sky-300/15 bg-black/25 px-2 py-1 text-[11px] text-sky-100/75">
                        {asset.kind} · {asset.name}
                      </span>
                    ))}
                    {productionProject.assets.length > 12 && (
                      <span className="rounded-full border border-sky-300/15 bg-black/25 px-2 py-1 text-[11px] text-sky-100/50">
                        +{productionProject.assets.length - 12}
                      </span>
                    )}
                  </div>
                </div>
                {productionProject.storyboard?.shots?.length ? (
                  <div>
                    <p className="mb-2 text-xs font-medium text-sky-50">镜头队列</p>
                    <div className="grid gap-2">
                      {productionProject.storyboard.shots.slice(0, 4).map(shot => (
                        <div key={shot.id} className="rounded-md border border-sky-300/10 bg-black/20 p-2 text-xs text-sky-100/75">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span>镜头 {shot.index} · {shot.duration}s</span>
                            <span className="text-[11px] text-sky-100/50">{shot.phaseLabel || shot.shotTypeLabel || shot.status}</span>
                          </div>
                          <p className="line-clamp-2 text-[11px] leading-relaxed text-sky-100/60">{shot.prompt}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {productionVideoSegmentAssets.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-sky-50">真实视频片段资产</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {productionVideoSegmentAssets.map(asset => {
                        const metadata = asset.metadata || {};
                        const videoUrl = String(metadata.videoUrl || '');
                        const lastFrameUrl = typeof metadata.lastFrameUrl === 'string' ? metadata.lastFrameUrl : '';
                        return (
                          <div key={asset.id} className="rounded-md border border-emerald-300/15 bg-emerald-300/10 p-2 text-xs text-emerald-50">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="font-medium">{asset.name}</span>
                              <span className="text-[11px] text-emerald-100/60">{formatSegmentDuration(metadata.duration)}</span>
                            </div>
                            <p className="line-clamp-2 text-[11px] leading-relaxed text-emerald-100/65">{asset.summary}</p>
                            <div className="mt-2 grid gap-1 text-[10px] text-emerald-100/55">
                              {metadata.childTaskId && <span>子任务：{String(metadata.childTaskId).slice(0, 8)}</span>}
                              {metadata.providerTaskId && <span>供应商任务：{String(metadata.providerTaskId).slice(0, 12)}</span>}
                              {metadata.shotId && <span>镜头资产：{String(metadata.shotId)}</span>}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(videoUrl, '_blank')}
                                className="h-7 border-emerald-300/25 bg-black/20 text-[11px] text-emerald-50 hover:bg-emerald-300/15"
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />打开
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyUrl(videoUrl)}
                                className="h-7 border-emerald-300/25 bg-black/20 text-[11px] text-emerald-50 hover:bg-emerald-300/15"
                              >
                                <Copy className="mr-1 h-3 w-3" />{copied ? '已复制' : '复制'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(videoUrl, `${asset.id}.mp4`)}
                                className="h-7 border-emerald-300/25 bg-black/20 text-[11px] text-emerald-50 hover:bg-emerald-300/15"
                              >
                                <Download className="mr-1 h-3 w-3" />下载
                              </Button>
                              {lastFrameUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(lastFrameUrl, '_blank')}
                                  className="h-7 border-emerald-300/25 bg-black/20 text-[11px] text-emerald-50 hover:bg-emerald-300/15"
                                >
                                  <ImageIcon className="mr-1 h-3 w-3" />尾帧
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {productionFinalVideoAssets.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-sky-50">真实最终成片资产</p>
                    <div className="grid gap-2">
                      {productionFinalVideoAssets.map(asset => {
                        const metadata = asset.metadata || {};
                        const videoUrl = String(metadata.videoUrl || '');
                        const segmentAssetIds = Array.isArray(metadata.segmentAssetIds) ? metadata.segmentAssetIds : [];
                        return (
                          <div key={asset.id} className="rounded-md border border-cyan-300/15 bg-cyan-300/10 p-2 text-xs text-cyan-50">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">{asset.name}</span>
                              <span className="text-[11px] text-cyan-100/60">
                                {formatSegmentDuration(metadata.duration)} · {metadata.segmentAssetCount || segmentAssetIds.length || 0} 段
                              </span>
                            </div>
                            <video
                              src={videoUrl}
                              controls
                              className="aspect-video w-full rounded bg-black object-contain"
                              preload="metadata"
                            />
                            <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-cyan-100/65">{asset.summary}</p>
                            <div className="mt-2 grid gap-1 text-[10px] text-cyan-100/55">
                              {metadata.taskId && <span>来源任务：{String(metadata.taskId).slice(0, 8)}</span>}
                              {metadata.completedAt && <span>归档时间：{String(metadata.completedAt)}</span>}
                              {segmentAssetIds.length > 0 && <span>片段资产：{segmentAssetIds.slice(0, 3).join('、')}{segmentAssetIds.length > 3 ? ` 等 ${segmentAssetIds.length} 段` : ''}</span>}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(videoUrl, '_blank')}
                                className="h-7 border-cyan-300/25 bg-black/20 text-[11px] text-cyan-50 hover:bg-cyan-300/15"
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />打开
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyUrl(videoUrl)}
                                className="h-7 border-cyan-300/25 bg-black/20 text-[11px] text-cyan-50 hover:bg-cyan-300/15"
                              >
                                <Copy className="mr-1 h-3 w-3" />{copied ? '已复制' : '复制'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(videoUrl, `${asset.id}.mp4`)}
                                className="h-7 border-cyan-300/25 bg-black/20 text-[11px] text-cyan-50 hover:bg-cyan-300/15"
                              >
                                <Download className="mr-1 h-3 w-3" />下载
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {hasRecoverableSegments && (
              <div className="space-y-3 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-cyan-50">已保留的镜头片段</p>
                    <p className="mt-1 text-xs text-cyan-100/70">
                      最终合成失败时，这些片段仍可打开、复制或下载，用于检查内容、重试合成或继续剪辑。
                    </p>
                  </div>
                  {!task.result?.videoUrl && recoverableSegments.length >= 2 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetryMergeSegments}
                      disabled={mergeRetrying}
                      className="h-8 border-cyan-300/30 bg-black/25 text-xs text-cyan-50 hover:bg-cyan-300/15"
                      title="使用已生成片段进行本地合成，不重新调用视频生成供应商"
                    >
                      <Film className="mr-1 h-3 w-3" />
                      {mergeRetrying ? '合成中...' : '重试合成成片'}
                    </Button>
                  )}
                </div>
                {!task.result?.videoUrl && recoverableSegments.length >= 2 && (
                  <p className="mt-1 text-xs text-cyan-100/70">
                    本地合成只复用已生成片段，不会重新消耗视频生成额度。若成功，任务会恢复为已完成并生成本地成片链接。
                  </p>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  {recoverableSegments.map((segment, index) => (
                    <div key={`${segment.taskId || segment.index}-${index}`} className="rounded-md border border-cyan-300/15 bg-black/20 p-2">
                      <div className="mb-2 flex items-center justify-between text-xs text-cyan-50">
                        <span>片段 {segment.index + 1}</span>
                        <span className="text-cyan-100/60">{segment.status || 'completed'}</span>
                      </div>
                      <video
                        src={segment.videoUrl}
                        controls
                        className="aspect-video w-full rounded bg-black object-contain"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => window.open(segment.videoUrl, '_blank')} className="h-7 text-xs">
                          <ExternalLink className="mr-1 h-3 w-3" />打开
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleCopyUrl(segment.videoUrl!)} className="h-7 text-xs">
                          <Copy className="mr-1 h-3 w-3" />{copied ? '已复制' : '复制'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownload(segment.videoUrl!, `segment-${task.id}-${segment.index + 1}.mp4`)} className="h-7 text-xs">
                          <Download className="mr-1 h-3 w-3" />下载
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hasRestorableSegments && (
              <div className="space-y-3 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-amber-50">待恢复失败片段</p>
                    <p className="mt-1 text-xs text-amber-100/75">
                      这些片段保留了 prompt、时长、比例和模型快照。先检查恢复范围；确认后可只提交该片段，不重跑已完成片段。
                    </p>
                  </div>
                  <Badge variant="outline" className="border-amber-300/30 bg-amber-300/10 text-amber-100">
                    {restorableSegments.length} 待补
                  </Badge>
                </div>
                <div className="grid gap-2">
                  {restorableSegments.map(segment => (
                    <div key={`restorable-${task.id}-${segment.index}`} className="rounded-md border border-amber-300/15 bg-black/20 p-2">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-50">
                        <span className="font-medium">片段 {segment.index + 1} · {segment.duration}s · {segment.status || '待恢复'}</span>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCheckResumeSegment(segment.index)}
                            disabled={segmentResumeKey === `${task.id}:${segment.index}:dry-run`}
                            className="h-7 border-amber-300/25 bg-black/25 text-[11px] text-amber-50 hover:bg-amber-300/15 disabled:opacity-50"
                          >
                            <RefreshCw className={`mr-1 h-3 w-3 ${segmentResumeKey === `${task.id}:${segment.index}:dry-run` ? 'animate-spin' : ''}`} />
                            检查
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResumeSegmentWithCost(segment.index)}
                            disabled={segmentResumeKey === `${task.id}:${segment.index}:real`}
                            className="h-7 border-amber-300/25 bg-amber-300/10 text-[11px] text-amber-50 hover:bg-amber-300/20 disabled:opacity-50"
                            title="会读取浏览器设置中的 BYOK 配置并真实提交该片段，可能产生供应商费用"
                          >
                            <Video className={`mr-1 h-3 w-3 ${segmentResumeKey === `${task.id}:${segment.index}:real` ? 'animate-pulse' : ''}`} />
                            真实补段
                          </Button>
                        </div>
                      </div>
                      <p className="line-clamp-3 text-[11px] leading-relaxed text-amber-100/65">{segment.prompt}</p>
                      {segment.error && (
                        <p className="mt-1 rounded bg-black/20 px-2 py-1 text-[11px] leading-relaxed text-amber-100">
                          失败原因：{segment.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hasAssemblySegments && (
              <div className="space-y-3 rounded-lg border border-violet-300/20 bg-violet-300/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-violet-50">分段生成队列</p>
                    <p className="mt-1 text-xs text-violet-100/70">
                      每个分镜片段都对应一个可追踪子任务。长视频生成失败时，只需要定位失败片段并重试，不会把第一段伪装成最终成片。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-violet-300/30 bg-violet-300/10 text-violet-100">
                      {assemblyPlan?.totalDuration || 0}s
                    </Badge>
                    {assemblyQueue && (
                      <Badge variant="outline" className="border-violet-300/30 bg-black/25 text-violet-100">
                        {assemblyQueue.childTaskIds.length} 子任务
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  {assemblyPlan!.segments.map(segment => {
                    const segmentUi = deriveProductionSegmentUiState(segment);
                    return (
                      <div
                        key={segment.id}
                        className={`rounded-md border p-2 ${segmentUi.statusClassName}`}
                      >
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-medium">
                            片段 {segment.index + 1} · {segment.duration}s · {segmentUi.statusLabel}
                          </span>
                          <TaskCenterSegmentActions
                            taskId={task.id}
                            segment={segment}
                            segmentUi={segmentUi}
                            retryingKey={segmentRetryingKey}
                            providerRecoveryKey={segmentProviderRecoveryKey}
                            onRetry={handleRetryAssemblySegment}
                            onRecoverProviderTask={recoverAssemblyProviderTask}
                          />
                        </div>
                        <p className="line-clamp-2 text-[11px] leading-relaxed text-violet-100/65">
                          {segment.prompt}
                        </p>
                        {segmentUi.errorText && (
                          <p className="mt-1 rounded bg-black/20 px-2 py-1 text-[11px] leading-relaxed text-amber-100">
                            失败原因：{segmentUi.errorText}
                          </p>
                        )}
                        {(segmentUi.canOpenVideo || segmentUi.canOpenLastFrame || segmentUi.providerLabel) && (
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-violet-100/65">
                            {segmentUi.providerLabel && (
                              <span className="rounded bg-black/20 px-2 py-0.5">
                                {segmentUi.providerLabel}
                              </span>
                            )}
                            {segmentUi.canOpenVideo && segment.expectedOutputs?.videoUrl && (
                              <button
                                type="button"
                                onClick={() => window.open(segment.expectedOutputs!.videoUrl!, '_blank')}
                                className="rounded bg-black/20 px-2 py-0.5 hover:text-white"
                              >
                                打开视频
                              </button>
                            )}
                            {segmentUi.canOpenLastFrame && segment.expectedOutputs?.lastFrameUrl && (
                              <button
                                type="button"
                                onClick={() => window.open(segment.expectedOutputs!.lastFrameUrl!, '_blank')}
                                className="rounded bg-black/20 px-2 py-0.5 hover:text-white"
                              >
                                打开尾帧
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {assemblyPlan?.nextAction && (
                  <p className="rounded-md border border-violet-300/10 bg-black/20 px-3 py-2 text-xs leading-relaxed text-violet-100/70">
                    下一步：{assemblyPlan.nextAction}
                  </p>
                )}
              </div>
            )}
            {/* 视频预览 */}
            {task.type === 'video' && task.result?.videoUrl && (
              <div className="space-y-3">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    src={task.result.videoUrl}
                    controls
                    className="w-full h-full object-contain"
                    poster={task.result.coverUrl}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(task.result!.videoUrl!, `video-${task.id}.mp4`)}
                    className="text-xs"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    下载视频
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyUrl(task.result!.videoUrl!)}
                    className="text-xs"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    {copied ? '已复制' : '复制链接'}
                  </Button>
                </div>
              </div>
            )}

            {/* 图片预览 */}
            {task.type === 'image' && task.result?.imageUrls && task.result.imageUrls.length > 0 && (
              <div className="space-y-3">
                <div className={`grid gap-3 ${task.result.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {task.result.imageUrls.map((url: string, idx: number) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden bg-muted border border-border">
                      <img
                        src={url}
                        alt={`生成图片 ${idx + 1}`}
                        className="w-full h-auto object-contain max-h-[400px]"
                      />
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => window.open(url, '_blank')}
                          className="h-7 w-7 p-0"
                        >
                          <ZoomIn className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDownload(url, `image-${task.id}-${idx + 1}.png`)}
                          className="h-7 w-7 p-0"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {task.result.imageUrls.length > 1 && (
                  <p className="text-xs text-muted-foreground">共 {task.result.imageUrls.length} 张图片</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyUrl(task.result!.imageUrls![0])}
                  className="text-xs"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  {copied ? '已复制' : '复制图片链接'}
                </Button>
              </div>
            )}

            {/* 海报预览 */}
            {task.type === 'poster' && task.result?.posterUrl && (
              <div className="space-y-3">
                <div className="rounded-lg overflow-hidden border border-border bg-muted">
                  <img
                    src={task.result.posterUrl}
                    alt="海报"
                    className="w-full h-auto object-contain max-h-[500px]"
                  />
                </div>
                {task.result.text && (
                  <div className="bg-muted p-3 rounded-lg">
                    <label className="text-xs font-medium text-muted-foreground">文案内容</label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{task.result.text}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDownload(task.result!.posterUrl!, `poster-${task.id}.png`)} className="text-xs">
                    <Download className="w-3 h-3 mr-1" />下载海报
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleCopyUrl(task.result!.posterUrl!)} className="text-xs">
                    <Copy className="w-3 h-3 mr-1" />{copied ? '已复制' : '复制链接'}
                  </Button>
                </div>
              </div>
            )}

            {/* 数字人预览 */}
            {task.type === 'avatar' && task.result?.videoUrl && (
              <div className="space-y-3">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    src={task.result.videoUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => handleDownload(task.result!.videoUrl!, `avatar-${task.id}.mp4`)} className="text-xs">
                  <Download className="w-3 h-3 mr-1" />下载视频
                </Button>
              </div>
            )}

            {/* 文案结果 */}
            {(task.type === 'copywriting' || task.type === 'storyboard') && task.result?.text && (
              <div className="space-y-3">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{task.result.text}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(task.result!.text); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-xs">
                  <Copy className="w-3 h-3 mr-1" />{copied ? '已复制' : '复制文案'}
                </Button>
              </div>
            )}

            {/* 提示词信息 */}
            {task.config?.prompt && (
              <div className="border-t border-border pt-3">
                <label className="text-xs font-medium text-muted-foreground">原始提示词</label>
                <p className="text-xs text-foreground/70 mt-1 bg-muted p-2 rounded break-words">{task.config.prompt}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TaskCenter({ onClose, onViewConfig, onOpenResult, onRegenerate }: TaskCenterProps) {
  const { 
    tasks, 
    removeTasks,
    clearCompletedTasks, 
    clearFailedTasks,
    clearCancelledTasks,
    clearAllTasks, 
    getRunningTasks, 
    getCompletedTasks, 
    updateTask,
    syncFromServer,
    lastCleanupCount,
    lastSyncedAt,
    lastSyncError
  } = useTasks();
  const [activeTab, setActiveTab] = useState<'all' | 'running' | 'completed'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [hasCleared, setHasCleared] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  
  const [showNineGrid, setShowNineGrid] = useState(false);
  const [nineGridTask, setNineGridTask] = useState<BackgroundTask | null>(null);

  const runningCount = getRunningTasks().length;
  const completedCount = getCompletedTasks().length;
  const displaySyncTime = lastSyncTime ?? (lastSyncedAt ? new Date(lastSyncedAt) : null);

  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'running') return task.status === 'running' || task.status === 'pending';
    if (activeTab === 'completed') return ['completed', 'failed', 'cancelled'].includes(task.status);
    return true;
  });

  const selectableTasks = filteredTasks.filter(task => 
    ['completed', 'failed', 'cancelled'].includes(task.status)
  );

  const toggleSelectAll = () => {
    if (selectedTasks.size === selectableTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(selectableTasks.map(t => t.id)));
    }
  };

  const toggleSelectTask = (taskId: string, selected: boolean) => {
    const newSet = new Set(selectedTasks);
    if (selected) {
      newSet.add(taskId);
    } else {
      newSet.delete(taskId);
    }
    setSelectedTasks(newSet);
  };

  const deleteSelectedTasks = async () => {
    if (selectedTasks.size === 0) return;
    
    if (confirm(`确定要删除选中的 ${selectedTasks.size} 个任务吗？`)) {
      await removeTasks(Array.from(selectedTasks));
      setSelectedTasks(new Set());
      setIsBatchMode(false);
    }
  };

  const syncTasksFromServer = useCallback(async () => {
    if (hasCleared) {
      console.log('[TaskCenter] 刚清空过任务，跳过同步');
      return;
    }
    
    try {
      setIsLoading(true);
      setSyncStatus('syncing');
      console.log('[TaskCenter] 开始手动同步任务...');
      
      await syncFromServer();
      
      setSyncStatus('success');
      setLastSyncTime(new Date());
      
      // 2秒后恢复idle状态
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (error) {
      console.error('[TaskCenter] 同步任务列表失败:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      setIsLoading(false);
    }
  }, [syncFromServer, hasCleared]);

  const pollRunningTasks = useCallback(async () => {
    const runningTasks = getRunningTasks();
    
    if (runningTasks.length === 0) return;

    for (const task of runningTasks) {
      try {
        const response = await fetch(`/api/tasks/${task.id}`);
        
        if (response.ok) {
          const { task: serverTask } = await response.json();
          
          if (serverTask.status !== task.status || 
              serverTask.progress !== task.progress ||
              serverTask.stage !== task.stage) {
            updateTask(task.id, {
              status: serverTask.status,
              progress: serverTask.progress,
              stage: serverTask.stage,
              message: serverTask.message,
              result: serverTask.result,
              error: serverTask.error,
              completedAt: serverTask.completedAt,
            });
          }
        }
      } catch (error) {
        console.error(`轮询任务 ${task.id} 状态失败:`, error);
      }
    }
  }, [getRunningTasks, updateTask]);

  useEffect(() => {
    if (!hasCleared) {
      syncTasksFromServer();
    }
  }, []);

  useEffect(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    if (runningCount > 0) {
      pollIntervalRef.current = setInterval(pollRunningTasks, 3000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [runningCount, pollRunningTasks]);

  useEffect(() => {
    setIsBatchMode(false);
    setSelectedTasks(new Set());
  }, [activeTab]);

  const handleViewNineGrid = useCallback((task: BackgroundTask) => {
    setNineGridTask(task);
    setShowNineGrid(true);
  }, []);

  return (
    <>
      <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              任务中心
              {runningCount > 0 && (
                <Badge variant="default" className="bg-[#4F6CFF]">
                  {runningCount} 进行中
                </Badge>
              )}
            </CardTitle>
            {displaySyncTime && (
              <p className="text-xs text-muted-foreground mt-1">
                上次同步: {formatDistanceToNow(displaySyncTime, { addSuffix: true, locale: zhCN })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => syncTasksFromServer()}
              disabled={isLoading}
              className="h-8 text-xs flex items-center gap-1"
            >
              {syncStatus === 'syncing' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : syncStatus === 'success' ? (
                <CheckCircle className="w-3 h-3 text-emerald-400" />
              ) : syncStatus === 'error' ? (
                <XCircle className="w-3 h-3 text-amber-400" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              {syncStatus === 'syncing' ? '同步中...' : 
               syncStatus === 'success' ? '已同步' : 
               syncStatus === 'error' ? '同步失败' : '刷新'}
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden flex flex-col">
          {(lastCleanupCount > 0 || lastSyncError) && (
            <div className="mb-3 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-50">
              {lastCleanupCount > 0 && (
                <div className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-none text-cyan-300" />
                  <span>
                    系统刚恢复了 {lastCleanupCount} 个超时任务，已标记为失败。你可以在任务列表查看原因、编辑配置或重新生成。
                  </span>
                </div>
              )}
              {lastSyncError && (
                <div className="flex items-start gap-2 text-amber-100">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-300" />
                  <span>同步失败：{lastSyncError}</span>
                </div>
              )}
            </div>
          )}

          {/* Tab 切换 */}
          <div className="flex gap-1 mb-4 border-b">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'all' 
                  ? 'border-[#70E0FF] text-[#70E0FF]' 
                  : 'border-transparent text-foreground/70 hover:text-foreground/70'
              }`}
            >
              全部 ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab('running')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'running' 
                  ? 'border-[#70E0FF] text-[#70E0FF]' 
                  : 'border-transparent text-foreground/70 hover:text-foreground/70'
              }`}
            >
              进行中 ({runningCount})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'completed' 
                  ? 'border-[#70E0FF] text-[#70E0FF]' 
                  : 'border-transparent text-muted-foreground hover:text-foreground/70'
              }`}
            >
              已完成 ({completedCount})
            </button>
          </div>

          {/* 批量操作栏 */}
          {activeTab === 'completed' && selectableTasks.length > 0 && (
            <div className="flex items-center justify-between mb-3 p-2 bg-card rounded-lg">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsBatchMode(!isBatchMode)}
                  className="text-xs"
                >
                  {isBatchMode ? (
                    <><X className="w-3 h-3 mr-1" />退出批量</>
                  ) : (
                    <><CheckSquare className="w-3 h-3 mr-1" />批量管理</>
                  )}
                </Button>
                {isBatchMode && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleSelectAll}
                      className="text-xs"
                    >
                      {selectedTasks.size === selectableTasks.length ? (
                        <><CheckSquare className="w-3 h-3 mr-1" />取消全选</>
                      ) : (
                        <><Square className="w-3 h-3 mr-1" />全选</>
                      )}
                    </Button>
                    {selectedTasks.size > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={deleteSelectedTasks}
                        className="border-amber-300/25 bg-black/20 text-xs text-amber-100 hover:bg-amber-300/15"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        删除选中 ({selectedTasks.size})
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-foreground/70">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">暂无任务</p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  onSync={syncTasksFromServer}
                  isSelected={selectedTasks.has(task.id)}
                  onSelect={(selected) => toggleSelectTask(task.id, selected)}
                  showCheckbox={isBatchMode}
                  onViewConfig={onViewConfig}
                  onOpenResult={onOpenResult}
                  onViewNineGrid={handleViewNineGrid}
                  onRegenerate={onRegenerate}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {nineGridTask && nineGridTask.result?.nineGridImages && (
        <NineGridViewer
          open={showNineGrid}
          onOpenChange={setShowNineGrid}
          images={nineGridTask.result.nineGridImages}
          prompt={nineGridTask.config.prompt}
          usedUserImages={nineGridTask.result.usedUserImages}
        />
      )}
    </>
  );
}
