"use client";

import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  FileDown,
  FileText,
  Film,
  Image as ImageIcon,
  Images,
  Layers,
  Mountain,
  Package,
  RefreshCw,
  Trash2,
  UserCircle,
  Video,
} from 'lucide-react';

type WorkflowMessage = {
  id: string;
  role: 'system' | 'assistant' | 'user' | 'info' | 'success' | 'error';
  content: string;
  step?: string;
  msgType?: 'progress' | 'success' | 'error' | 'info';
  nextStep?: string;
  timestamp: number;
};

export type FilmGenerationLogStatus = 'generating' | 'completed' | 'error' | 'waiting';

export type FilmGenerationLogEntry = {
  id: string;
  shotIndex: number;
  shotLabel: string;
  action: string;
  status: FilmGenerationLogStatus;
  progress: number;
  startTime: string;
  endTime?: string;
  duration?: string;
  error?: string;
};

type FilmCreationLogPanelProps = {
  panelRef: React.RefObject<HTMLDivElement | null>;
  workflowMessages: WorkflowMessage[];
  generationLogs: FilmGenerationLogEntry[];
  logFilter: string;
  isGenerationLogsExpanded: boolean;
  hasCreativeInput: boolean;
  hasExistingPlan: boolean;
  hasAnyEntityCards: boolean;
  hasAnyShot: boolean;
  hasScriptOrCards: boolean;
  onClearLogs: () => void;
  onLogFilterChange: (value: string) => void;
  onToggleGenerationLogs: () => void;
  onNeedCreativeInput: () => void;
  onNeedPlan: (label: string) => void;
  onNeedShots: (label: string) => void;
  onWorkflowCommand: (command: string) => void;
  onExportPDF: () => void;
};

const LOG_TABS = [
  { key: 'all', label: '全部' },
  { key: 'progress', label: '进行中' },
  { key: 'success', label: '已完成' },
  { key: 'error', label: '异常' },
  { key: 'info', label: '信息' },
];

const QUICK_ACTIONS = [
  { label: '生成剧本', cmd: '生成创作规划', icon: FileText, needsCreative: true },
  { label: '增强角色', cmd: '增强角色', icon: UserCircle },
  { label: '增强场景', cmd: '增强场景', icon: Mountain },
  { label: '生成道具', cmd: '生成道具', icon: Package },
  { label: '三视图', cmd: '三视图', icon: Images },
  { label: '生成画面', cmd: '生成分镜图', icon: ImageIcon },
  { label: '批量素材', cmd: '批量素材', icon: Layers },
  { label: '生成视频', cmd: '生成视频', icon: Video },
  { label: '合成', cmd: '合成', icon: Film },
  { label: '重新合成', cmd: '重新合成', icon: RefreshCw },
];

const CARD_REQUIRED_ACTIONS = ['增强角色', '增强场景', '生成道具', '三视图', '批量素材'];
const SHOT_REQUIRED_ACTIONS = ['生成分镜图', '生成视频', '合成'];

function getMessageStepLabel(message: WorkflowMessage) {
  if (message.step === 'planning') return '规划';
  if (message.step === 'step') return '步骤';
  if (message.step === 'suggestion') return '建议';
  if (message.role === 'system') return '系统';
  if (message.role === 'user') return '用户';
  return '创作';
}

function getFilteredGenerationLogs(logs: FilmGenerationLogEntry[], logFilter: string) {
  if (logFilter === 'all') return logs;
  const status = logFilter === 'progress' ? 'generating' : logFilter === 'success' ? 'completed' : logFilter;
  return logs.filter(log => log.status === status);
}

function estimateRemaining(log: FilmGenerationLogEntry) {
  if (log.status !== 'generating' || log.progress <= 0 || log.progress >= 100) return '';
  try {
    const start = new Date(log.startTime).getTime();
    const elapsed = (Date.now() - start) / 1000;
    const rate = log.progress / elapsed;
    const remaining = (100 - log.progress) / rate;
    return remaining > 60 ? `${Math.round(remaining / 60)}分` : `${Math.round(remaining)}秒`;
  } catch {
    return '';
  }
}

export function FilmCreationLogPanel({
  panelRef,
  workflowMessages,
  generationLogs,
  logFilter,
  isGenerationLogsExpanded,
  hasCreativeInput,
  hasExistingPlan,
  hasAnyEntityCards,
  hasAnyShot,
  hasScriptOrCards,
  onClearLogs,
  onLogFilterChange,
  onToggleGenerationLogs,
  onNeedCreativeInput,
  onNeedPlan,
  onNeedShots,
  onWorkflowCommand,
  onExportPDF,
}: FilmCreationLogPanelProps) {
  const activeGenerationCount = generationLogs.filter(log => log.status === 'generating').length;
  const filteredWorkflowMessages = logFilter === 'all'
    ? workflowMessages
    : workflowMessages.filter(message => message.msgType === logFilter);
  const filteredGenerationLogs = getFilteredGenerationLogs(generationLogs, logFilter);

  return (
    <div ref={panelRef} id="right-log-panel" className="w-[320px] flex flex-col min-h-0 border-l border-border/70">
      <div className="px-3 py-2.5 border-b border-border/70 flex items-center gap-2 flex-shrink-0">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-red-500 flex items-center justify-center">
          <Activity className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium text-foreground/80">创作日志</span>
        {activeGenerationCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium animate-pulse">
            {activeGenerationCount} 进行中
          </span>
        )}
        <button
          onClick={onClearLogs}
          className="ml-auto p-1.5 rounded-lg text-foreground/30 hover:text-foreground/60 hover:bg-accent/20 transition-all"
          title="清空日志"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex gap-0.5 px-3 py-1.5 border-b border-border/40 bg-secondary/20 flex-shrink-0">
        {LOG_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => onLogFilterChange(tab.key)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
              logFilter === tab.key
                ? 'bg-red-500/10 text-red-500'
                : 'text-foreground/40 hover:text-foreground/60 hover:bg-accent/20'
            }`}
          >
            {tab.label}
            {tab.key !== 'all' && (
              <span className="ml-0.5 text-[9px]">
                ({workflowMessages.filter(message => message.msgType === tab.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-1">
        {workflowMessages.length === 0 && generationLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-foreground/25">
            <Activity className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-[11px]">暂无创作日志</span>
            <span className="text-[10px] mt-0.5">开始创作后自动记录</span>
          </div>
        ) : (
          <>
            {filteredWorkflowMessages.map(message => (
              <div
                key={message.id}
                className={`rounded-lg p-2 text-[11px] border transition-all ${
                  message.msgType === 'progress' ? 'bg-amber-500/5 border-amber-500/20' :
                  message.msgType === 'success' ? 'bg-emerald-500/5 border-emerald-500/10' :
                  message.msgType === 'error' ? 'bg-red-500/5 border-red-500/20' :
                  message.role === 'system' ? 'bg-blue-500/5 border-blue-500/10' :
                  'bg-secondary/30 border-border/30'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {message.msgType === 'progress' ? (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                  ) : message.msgType === 'success' ? (
                    <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  ) : message.msgType === 'error' ? (
                    <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                  ) : message.role === 'system' ? (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-foreground/20 flex-shrink-0" />
                  )}
                  <span className="font-medium text-foreground/70 truncate text-[10px]">
                    {getMessageStepLabel(message)}
                  </span>
                  <span className="ml-auto text-[9px] text-foreground/25">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-foreground/60 leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                </div>
                {message.nextStep && (
                  <div className="mt-1 text-[9px] text-red-500/60 flex items-center gap-0.5">
                    <ArrowRight className="w-2.5 h-2.5" /> {message.nextStep}
                  </div>
                )}
              </div>
            ))}

            {generationLogs.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={onToggleGenerationLogs}
                  className="flex items-center gap-1 text-[10px] text-foreground/40 hover:text-foreground/60 transition-colors w-full"
                >
                  {isGenerationLogsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  生成进度详情 ({generationLogs.length})
                </button>
                {isGenerationLogsExpanded && (
                  <div className="space-y-1 mt-1">
                    {filteredGenerationLogs.map(log => {
                      const estimatedRemaining = estimateRemaining(log);
                      return (
                        <div
                          key={log.id}
                          className={`rounded-lg p-2 text-[11px] border transition-all ${
                            log.status === 'generating' ? 'bg-red-500/5 border-red-500/20' :
                            log.status === 'completed' ? 'bg-emerald-500/5 border-emerald-500/10' :
                            log.status === 'error' ? 'bg-red-500/5 border-red-500/20' :
                            'bg-amber-500/5 border-amber-500/10'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            {log.status === 'generating' ? (
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                            ) : log.status === 'completed' ? (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                            ) : log.status === 'error' ? (
                              <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                            )}
                            <span className="font-medium text-foreground/80 truncate">{log.shotLabel} {log.action}</span>
                            {log.status === 'generating' && log.progress > 0 && (
                              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
                                {log.progress}%
                              </span>
                            )}
                            {log.status === 'completed' && (
                              <Check className="w-3 h-3 text-emerald-500 ml-auto flex-shrink-0" />
                            )}
                            {log.status === 'error' && (
                              <AlertTriangle className="w-3 h-3 text-red-400 ml-auto flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[9px] text-foreground/35 flex-wrap">
                            <span>{log.startTime}</span>
                            {log.duration && <span>用时 {log.duration}</span>}
                            {estimatedRemaining && (
                              <span className="text-amber-500/70">预计剩余 {estimatedRemaining}</span>
                            )}
                          </div>
                          {log.status === 'generating' && log.progress > 0 && (
                            <div className="w-full h-1 bg-accent/30 rounded-full overflow-hidden mt-1">
                              <div className="h-full bg-[#EF4444] rounded-full transition-all duration-500" style={{ width: `${log.progress}%` }} />
                            </div>
                          )}
                          {log.error && (
                            <div className="text-[9px] text-red-400/80 mt-0.5 truncate">{log.error}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border/70 space-y-1.5 flex-shrink-0">
        <div className="flex gap-1 flex-wrap">
          {QUICK_ACTIONS.map(action => (
            <button
              key={action.cmd}
              onClick={() => {
                if (action.needsCreative && !hasCreativeInput && !hasExistingPlan) {
                  onNeedCreativeInput();
                  return;
                }
                if (CARD_REQUIRED_ACTIONS.includes(action.label) && !hasAnyEntityCards) {
                  onNeedPlan(action.label);
                  return;
                }
                if (SHOT_REQUIRED_ACTIONS.includes(action.label) && !hasAnyShot) {
                  onNeedShots(action.label);
                  return;
                }
                onWorkflowCommand(action.cmd);
              }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-accent/30 text-foreground/50 hover:bg-[#EF4444]/10 hover:text-[#EF4444] transition-all"
            >
              <action.icon className="w-2.5 h-2.5" />
              {action.label}
            </button>
          ))}
        </div>

        {hasScriptOrCards && (
          <div className="flex justify-end">
            <button
              onClick={onExportPDF}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] text-foreground/30 hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="导出PDF"
            >
              <FileDown className="w-2.5 h-2.5" /> 导出PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
