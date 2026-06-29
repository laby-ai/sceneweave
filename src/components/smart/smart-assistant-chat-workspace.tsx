'use client';

import type React from 'react';
import {
  AlertCircle,
  Bot,
  BookmarkPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Clock,
  Copy,
  Eye,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  MapPin,
  MessageSquareQuote,
  Paperclip,
  Pencil,
  Quote,
  RotateCcw,
  Send,
  Sparkles,
  Tag,
  ThumbsDown,
  ThumbsUp,
  User,
  Users,
  Video,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { SmartAssistantTransferData } from '@/types/film';
import type { ChatMessage } from '@/lib/smart-assistant-panel-model';

type AttachedMedia = Array<{ type: 'image' | 'video'; url: string; name: string }> | null;

interface SmartAssistantChatWorkspaceProps {
  analysisType: 'describe' | 'prompt' | 'tag';
  attachedMedia: AttachedMedia;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  collectTransferData: () => SmartAssistantTransferData;
  copiedId: string | null;
  copiedMsgId: string | null;
  creationParams: Record<string, any>;
  currentStep: number;
  editingText: string;
  editingMsgId: string | null;
  fetchCreationPlanStream: (...args: any[]) => any;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleCancel: () => void;
  handleCopy: (text: string, id: string) => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleGenerationConfirm: (...args: any[]) => void;
  handleRegenerate: (messageIndex: number) => void;
  handleSend: (...args: any[]) => void;
  handleStoryboardConfirm: (messageId: string, storyboardData: ChatMessage['storyboardData']) => void;
  inputValue: string;
  isAtBottom: boolean;
  isLoading: boolean;
  messageRefs: React.RefObject<Map<string, HTMLDivElement>>;
  messages: ChatMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onNavigate?: (section: string, prompt?: string, transferData?: SmartAssistantTransferData) => void;
  pendingSuggestionRef: React.RefObject<boolean>;
  removeAttachedMedia: (index: number) => void;
  scrollToBottom: () => void;
  setAnalysisType: React.Dispatch<React.SetStateAction<'describe' | 'prompt' | 'tag'>>;
  setCopiedMsgId: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  setEditingText: React.Dispatch<React.SetStateAction<string>>;
  setEditingMsgId: React.Dispatch<React.SetStateAction<string | null>>;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLightboxImage: React.Dispatch<React.SetStateAction<string | null>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export function SmartAssistantChatWorkspace(props: SmartAssistantChatWorkspaceProps) {
  const {
    analysisType,
    attachedMedia,
    chatContainerRef,
    collectTransferData,
    copiedId,
    copiedMsgId,
    creationParams,
    currentStep,
    editingText,
    editingMsgId,
    fetchCreationPlanStream,
    fileInputRef,
    handleCancel,
    handleCopy,
    handleFileUpload,
    handleGenerationConfirm,
    handleRegenerate,
    handleSend,
    handleStoryboardConfirm,
    inputValue,
    isAtBottom,
    isLoading,
    messageRefs,
    messages,
    messagesEndRef,
    onNavigate,
    pendingSuggestionRef,
    removeAttachedMedia,
    scrollToBottom,
    setAnalysisType,
    setCopiedMsgId,
    setCurrentStep,
    setEditingText,
    setEditingMsgId,
    setInputValue,
    setIsLoading,
    setLightboxImage,
    setMessages,
  } = props;

  return (
    <>
        {/* ===== 中间：对话区 ===== */}
        <div className="flex-1 min-w-0 flex flex-col relative">
          {/* 消息列表 */}
          <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-6 py-5 space-y-5">
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                ref={(el) => { if (el) messageRefs.current.set(msg.id, el); }}
                className={`flex gap-3 transition-all duration-300 px-1 -mx-1 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* 头像 */}
                <div className={`w-9 h-9 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-sm ${
                  msg.role === 'assistant'
                    ? 'bg-gradient-to-br from-red-500 to-rose-600'
                    : 'bg-[#70E0FF]/20'
                }`}>
                  {msg.role === 'assistant' ? (
                    <span className="text-white text-sm font-bold">映</span>
                  ) : (
                    <User className="w-4 h-4 text-[#70E0FF]" />
                  )}
                </div>

                {/* 消息内容 */}
                <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* 媒体附件 */}
                  {msg.mediaAttachments && msg.mediaAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {msg.mediaAttachments.map((media, idx) => (
                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-border/50">
                          {media.type === 'image' ? (
                            <img
                              src={media.url}
                              alt={media.name || '图片'}
                              className="max-w-[200px] max-h-[160px] object-cover"
                            />
                          ) : (
                            <video
                              src={media.url}
                              className="max-w-[200px] max-h-[160px] object-cover"
                              controls
                            />
                          )}
                          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                            {media.type === 'image' ? '图片' : '视频'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 分析类型标签 */}
                  {msg.analysisType && (
                    <div className="mb-1.5 flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                        {msg.analysisType === 'describe' && <><Eye className="w-2.5 h-2.5" />内容描述</>}
                        {msg.analysisType === 'prompt' && <><Wand2 className="w-2.5 h-2.5" />提示词提取</>}
                        {msg.analysisType === 'tag' && <><Tag className="w-2.5 h-2.5" />标签分析</>}
                      </span>
                    </div>
                  )}
                  <div className={`px-4 py-3.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'assistant'
                      ? 'bg-accent/40 text-foreground/80 rounded-tl-md shadow-sm'
                      : 'bg-[#70E0FF]/15 text-foreground/80 rounded-tr-md shadow-sm'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="markdown-body prose prose-sm max-w-none dark:prose-invert
                        prose-headings:text-foreground/90 prose-headings:font-normal prose-headings:text-[1em] prose-headings:mt-2 prose-headings:mb-1 prose-headings:tracking-normal
                        prose-h2:font-normal prose-h2:text-[1em] prose-h2:mt-2 prose-h2:mb-1 prose-h2:pb-0 prose-h2:border-b-0
                        prose-h3:font-normal prose-h3:text-[1em] prose-h3:mt-1 prose-h3:mb-0.5
                        prose-p:my-1 prose-p:leading-relaxed
                        prose-ul:my-1 prose-ul:space-y-0.5 prose-li:text-foreground/80 prose-li:marker:text-foreground/50
                        prose-ol:my-1 prose-ol:space-y-0.5
                        prose-strong:text-foreground/85 prose-strong:font-medium
                        prose-code:text-primary/80 prose-code:bg-primary/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-[''] prose-code:after:content-['']
                        prose-pre:bg-card prose-pre:border prose-pre:border-border/50 prose-pre:rounded-lg prose-pre:my-2
                        prose-blockquote:border-l-primary/40 prose-blockquote:text-foreground/60 prose-blockquote:italic
                        prose-hr:border-border/30 prose-hr:my-3
                      ">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>

                  {msg.vimaxAgent && (
                    <div className="mt-3 ml-1 max-w-[720px] rounded-2xl border border-[#70E0FF]/25 bg-card/80 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#70E0FF]/12 px-2 py-1 text-[11px] font-medium text-[#70E0FF]">
                              <Sparkles className="h-3 w-3" />
                              {msg.vimaxAgent.phase === 'plan' ? '真实 AgentPlan' : msg.vimaxAgent.phase === 'reference_assets' ? 'Seedream 参考素材' : '视频费用确认'}
                            </span>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                              msg.vimaxAgent.costState === 'incurred'
                                ? 'bg-amber-500/15 text-amber-500'
                                : msg.vimaxAgent.costState === 'blocked'
                                  ? 'bg-red-500/15 text-red-500'
                                  : 'bg-foreground/10 text-muted-foreground'
                            }`}>
                              {msg.vimaxAgent.costState === 'incurred' ? '已触发真实模型' : msg.vimaxAgent.costState === 'blocked' ? '阶段阻塞' : '尚未触发费用'}
                            </span>
                          </div>
                          <h3 className="mt-2 text-base font-semibold text-foreground">{msg.vimaxAgent.title}</h3>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{msg.vimaxAgent.summary}</p>
                        </div>
                        <div className="shrink-0 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-right">
                          <div className="text-[10px] text-muted-foreground">模型</div>
                          <div className="max-w-[160px] truncate text-xs font-medium text-foreground">{msg.vimaxAgent.model}</div>
                        </div>
                      </div>

                      {msg.vimaxAgent.assets && msg.vimaxAgent.assets.filter(a => a.kind !== 'shot').length > 0 && (
                        <div className="mt-4">
                          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <ImageIcon className="h-3.5 w-3.5" />
                            角色 / 场景设定
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {msg.vimaxAgent.assets.filter(a => a.kind !== 'shot').slice(0, 6).map((asset, assetIdx) => (
                              <div key={`${asset.label}-${assetIdx}`} className="rounded-xl border border-border/50 bg-background/45 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-sm font-medium text-foreground">{asset.label}</span>
                                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
                                    asset.status === 'generated'
                                      ? 'bg-green-500/15 text-green-500'
                                      : asset.status === 'blocked'
                                        ? 'bg-red-500/15 text-red-500'
                                        : 'bg-foreground/10 text-muted-foreground'
                                  }`}>
                                    {asset.status === 'generated' ? '已生成' : asset.status === 'blocked' ? '失败' : '待确认'}
                                  </span>
                                </div>
                                {asset.prompt && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{asset.prompt}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {msg.vimaxAgent.shots && msg.vimaxAgent.shots.length > 0 && (
                        <div className="mt-4">
                          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Clapperboard className="h-3.5 w-3.5" />
                            分镜（参考图与成片挂在各自 Clip 下）
                          </div>
                          <div className="space-y-2">
                            {msg.vimaxAgent.shots.map(shot => (
                              <div key={shot.index} className="rounded-xl border border-border/50 bg-background/45 p-2.5">
                                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                  <span className="rounded-md bg-[#70E0FF]/12 px-1.5 py-0.5 text-[11px] text-[#70E0FF]">Clip {shot.index}</span>
                                  <span className="truncate">{shot.title}</span>
                                  {shot.status === 'video' && (
                                    <span className="shrink-0 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] text-green-500">已出片</span>
                                  )}
                                  {shot.status === 'reference' && (
                                    <span className="shrink-0 rounded-full bg-[#70E0FF]/15 px-1.5 py-0.5 text-[10px] text-[#70E0FF]">已出参考图</span>
                                  )}
                                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{shot.duration}s</span>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">{shot.camera}</div>
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{shot.prompt}</p>
                                {(shot.referenceUrl || shot.videoUrl) && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {shot.referenceUrl && (
                                      <div className="relative cursor-pointer overflow-hidden rounded-lg border border-border/40" onClick={() => setLightboxImage(shot.referenceUrl!)}>
                                        <img src={shot.referenceUrl} alt={`Clip ${shot.index} 参考图`} className="h-24 w-auto object-cover" />
                                        <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-0.5 text-[10px] text-white">参考首帧</span>
                                      </div>
                                    )}
                                    {shot.videoUrl && (
                                      <div className="relative overflow-hidden rounded-lg border border-border/40">
                                        <video src={shot.videoUrl} controls className="h-24 w-auto object-cover" />
                                        <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-0.5 text-[10px] text-white">成片</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 rounded-xl border border-border/50 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
                        下一步：{msg.vimaxAgent.nextAction}
                      </div>
                    </div>
                  )}

                  {/* AI消息操作按钮：复制/引用/修改 */}
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-0.5 mt-1 ml-1 transition-opacity duration-200">
                      <button
                        onClick={() => { navigator.clipboard.writeText(msg.content).catch(() => {}); setCopiedMsgId(msg.id); setTimeout(() => setCopiedMsgId(null), 1500); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-foreground/25 hover:text-foreground/60 hover:bg-accent/30 transition-all"
                        title="复制"
                      >
                        {copiedMsgId === msg.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        {copiedMsgId === msg.id ? '已复制' : '复制'}
                      </button>
                      <button
                        onClick={() => { setInputValue(msg.content.substring(0, 200)); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-foreground/25 hover:text-foreground/60 hover:bg-accent/30 transition-all"
                        title="引用"
                      >
                        <Quote className="w-3 h-3" />
                        引用
                      </button>
                      <button
                        onClick={() => { setEditingMsgId(msg.id); setEditingText(msg.content); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-foreground/25 hover:text-foreground/60 hover:bg-accent/30 transition-all"
                        title="修改"
                      >
                        <Pencil className="w-3 h-3" />
                        修改
                      </button>
                    </div>
                  )}

                  {/* 编辑模式 */}
                  {editingMsgId === msg.id && (
                    <div className="mt-2 ml-1">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full min-h-[80px] p-3 rounded-lg bg-card border border-border text-sm text-foreground/80 resize-y focus:outline-none focus:border-primary/50"
                      />
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          onClick={() => {
                            const idx = messages.findIndex(m => m.id === msg.id);
                            if (idx >= 0) {
                              const updated = [...messages];
                              updated[idx] = { ...updated[idx], content: editingText };
                              setMessages(updated);
                            }
                            setEditingMsgId(null);
                          }}
                          className="px-3 py-1 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/80 transition-colors"
                        >保存</button>
                        <button
                          onClick={() => setEditingMsgId(null)}
                          className="px-3 py-1 rounded-md bg-accent/50 text-foreground/50 text-xs hover:text-foreground/70 transition-colors"
                        >取消</button>
                      </div>
                    </div>
                  )}

                  {/* 待确认生成卡片（支持多项并行） */}
                  {(msg.pendingGenerations?.length || msg.pendingGeneration) && (() => {
                    const pgs = msg.pendingGenerations?.length ? msg.pendingGenerations : msg.pendingGeneration ? [msg.pendingGeneration] : [];
                    return pgs.length > 0 ? (
                      <div className="mt-2.5 ml-1 max-w-[400px] rounded-xl border border-border/60 bg-card p-3.5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#70E0FF]/10 text-[#70E0FF]">
                            {pgs.length > 1 ? `${pgs.length}项待生成` :
                              pgs[0].type === 'character' ? '角色' :
                              pgs[0].type === 'scene' ? '场景' :
                              pgs[0].type === 'prop' ? '道具' : '图片'}
                          </span>
                          <span className="text-xs text-muted-foreground">确认后生成</span>
                        </div>
                        {pgs.length > 1 ? (
                          <div className="space-y-1.5 mb-3">
                            {pgs.map((pg, i) => (
                              <div key={i} className="text-sm text-foreground/75 leading-relaxed">
                                <span className="text-[11px] font-medium bg-accent/50 text-foreground/60 px-1.5 py-0.5 rounded mr-1.5">
                                  {pg.type === 'character' ? '角色' : pg.type === 'scene' ? '场景' : pg.type === 'prop' ? '道具' : '图片'}
                                </span>
                                <span className="line-clamp-1">{pg.label || pg.prompt}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-foreground/75 line-clamp-3 mb-3 leading-relaxed">
                              {pgs[0].prompt}
                            </p>
                            {pgs[0].negativePrompt && (
                              <p className="text-xs text-muted-foreground/70 line-clamp-2 mb-3">
                                排除: {pgs[0].negativePrompt}
                              </p>
                            )}
                          </>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleGenerationConfirm(msg.id)}
                            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[#70E0FF] text-white hover:bg-[#70E0FF]/80 transition-colors"
                          >
                            确认生成{pgs.length > 1 ? ` (${pgs.length}项)` : ''}
                          </button>
                          <button
                            onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pendingGenerations: undefined, pendingGeneration: undefined } : m))}
                            className="px-4 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* 生成进度条 — 增强版含步骤指示 */}
                  {msg.generationStatus && msg.generationStatus !== 'completed' && (
                    <div className="mt-2.5 ml-1 max-w-[400px]">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                        {msg.generationStatus === 'generating' ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin text-[#70E0FF]" />
                            <span className="text-foreground/70 font-medium">
                              {msg.generationStepInfo?.currentStepLabel ||
                                (msg.generationType === 'storyboard' ? '正在生成分镜图...' :
                                msg.generationType === 'character' ? '正在生成角色图...' :
                                msg.generationType === 'scene' ? '正在生成场景图...' :
                                msg.generationType === 'video' ? '正在生成视频...' :
                                msg.generationType === 'image' ? '正在生成图片...' :
                                '正在生成...')}
                            </span>
                          </>
                        ) : msg.generationStatus === 'pending' ? (
                          <><Clock className="w-3.5 h-3.5 text-amber-500" /><span>排队中...</span></>
                        ) : msg.generationStatus === 'failed' ? (
                          <><AlertCircle className="w-3.5 h-3.5 text-red-500" /><span className="text-red-500 font-medium">生成失败</span></>
                        ) : null}
                        {msg.generationProgress != null && msg.generationStatus === 'generating' && (
                          <span className="ml-auto font-mono text-foreground/50">{msg.generationProgress}%</span>
                        )}
                      </div>
                      <div className="h-2 bg-accent/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#70E0FF] to-rose-500 rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${msg.generationProgress ?? 0}%` }}
                        />
                      </div>
                      {/* 步骤进度指示器 */}
                      {msg.generationStepInfo && msg.generationStepInfo.totalSteps > 1 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          {Array.from({ length: msg.generationStepInfo.totalSteps }, (_, idx) => {
                            const stepInfo = msg.generationStepInfo!;
                            const isCurrentStep = idx === Math.floor((msg.generationProgress ?? 0) / (100 / stepInfo.totalSteps));
                            const isDoneStep = idx < Math.floor((msg.generationProgress ?? 0) / (100 / stepInfo.totalSteps));
                            return (
                              <div key={idx} className={`h-1 flex-1 rounded-full transition-all ${
                                isDoneStep ? 'bg-green-500' :
                                isCurrentStep ? 'bg-[#70E0FF]' :
                                'bg-accent/40'
                              }`} />
                            );
                          })}
                        </div>
                      )}
                      {/* 生成中继续选项 */}
                      {msg.generationStatus === 'generating' && (
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => { setInputValue('继续聊'); }}
                            className="px-3 py-1.5 text-xs rounded-lg bg-[#70E0FF]/8 text-[#70E0FF] hover:bg-[#70E0FF]/15 transition-colors font-medium"
                          >继续聊</button>
                          <button
                            onClick={() => { setInputValue('调整方向'); }}
                            className="px-3 py-1.5 text-xs rounded-lg bg-accent/40 text-foreground/60 hover:bg-accent/60 hover:text-foreground/80 transition-colors"
                          >调整方向</button>
                          <button
                            onClick={() => { setInputValue('再生成一组'); }}
                            className="px-3 py-1.5 text-xs rounded-lg bg-accent/40 text-foreground/60 hover:bg-accent/60 hover:text-foreground/80 transition-colors"
                          >再生成一组</button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 资产卡片 — 包裹生成结果（ViMAX 消息的图片改为挂在各 Clip 下，这里不重复展示） */}
                  {msg.generatedImages && msg.generatedImages.length > 0 && msg.generationStatus === 'completed' && !msg.vimaxAgent && (
                    <div className="mt-3 ml-1 rounded-xl border border-border/60 bg-card overflow-hidden max-w-[540px] shadow-sm">
                      {/* 卡片头部：类型标签+状态+操作 */}
                      <div className="flex items-center justify-between px-3 py-2 bg-accent/30 border-b border-border/40">
                        <div className="flex items-center gap-2">
                          {msg.assetType && (
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              msg.assetType === '角色' ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400' :
                              msg.assetType === '场景' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
                              msg.assetType === '道具' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' :
                              'bg-accent/40 text-muted-foreground'
                            }`}>{msg.assetType}</span>
                          )}
                          <span className="text-sm font-medium text-foreground/80">
                            {msg.generationType === 'character' ? msg.characterDesignSheet?.characterName || '角色设计' :
                             msg.generationType === 'scene' ? '场景参考' :
                             msg.generationType === 'storyboard' ? '分镜画面' : '创作成果'}
                          </span>
                          <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full font-medium">已生成</span>
                          <span className="text-xs text-muted-foreground">{msg.generatedImages.length}张</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const urls = msg.generatedImages?.map(i => i.url).join('\n') || '';
                              if (urls) navigator.clipboard.writeText(urls);
                            }}
                            className="p-1 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-all"
                            title="复制图片链接"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setLightboxImage(msg.generatedImages![0].url)}
                            className="p-1 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-all"
                            title="查看大图"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {/* 图片画廊 */}
                      <div className={`flex ${msg.characterDesignSheet ? 'flex-col' : 'flex-row gap-3 overflow-x-auto p-3'} scrollbar-thin`} style={msg.characterDesignSheet ? {} : { maxWidth: '520px' }}>
                        {/* 角色设计参考图优先展示 */}
                        {msg.characterDesignSheet && (
                          <div className="relative group cursor-pointer p-2" onClick={() => setLightboxImage(msg.characterDesignSheet!.imageUrl)}>
                            <img
                              src={msg.characterDesignSheet.imageUrl}
                              alt={`${msg.characterDesignSheet.characterName}角色设计参考图`}
                              className="w-full max-w-[360px] rounded-lg object-contain mx-auto"
                            />
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-black/60 text-xs text-white font-medium opacity-0 group-hover:opacity-100 transition-all">
                              点击查看大图
                            </div>
                          </div>
                        )}
                        {/* 其他图片（正面图/分镜等） */}
                        {msg.generatedImages.filter(img => !msg.characterDesignSheet || img.label !== '角色设计参考图').map((img, imgIdx) => (
                          <div key={imgIdx} className="flex-shrink-0 relative group rounded-lg overflow-hidden border border-border/30 bg-background/50 cursor-pointer"
                            style={msg.characterDesignSheet ? { width: '180px' } : { width: '220px' }}
                            onClick={() => setLightboxImage(img.url)}
                          >
                            <img
                              src={img.url}
                              alt={img.label || `生成图${imgIdx + 1}`}
                              className="w-full aspect-video object-cover"
                            />
                            {img.label && (
                              <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent">
                                <span className="text-[11px] text-white font-medium">{img.label}</span>
                              </div>
                            )}
                            <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
                              <span className="text-[10px] text-white font-bold">{imgIdx + 1}</span>
                            </div>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <span className="px-2 py-1 rounded bg-white/90 text-xs text-foreground font-medium">查看</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* 提示词预览条 */}
                      {msg.assetPrompt && (
                        <div className="px-3 py-2 border-t border-border/30 bg-accent/15">
                          <div className="flex items-start gap-1.5">
                            <FileText className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{msg.assetPrompt}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* 生成中/失败的图片展示（未完成时用旧格式；ViMAX 消息走 Clip 内联展示） */}
                  {msg.generatedImages && msg.generatedImages.length > 0 && msg.generationStatus !== 'completed' && !msg.vimaxAgent && (
                    <div className="mt-3 ml-1">
                      <div className="flex items-center gap-1.5 mb-2">
                        <ImageIcon className="w-4 h-4 text-[#70E0FF]" />
                        <span className="text-sm font-medium text-foreground/80">
                          {msg.generationType === 'storyboard' ? '分镜画面' :
                            msg.generationType === 'character' ? '角色设计' :
                            msg.generationType === 'scene' ? '场景图' : '创作成果'}
                        </span>
                        <span className="text-xs text-muted-foreground bg-accent/40 px-1.5 py-0.5 rounded-full">{msg.generatedImages.length}张</span>
                      </div>
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin" style={{ maxWidth: '520px' }}>
                        {msg.generatedImages.map((img, imgIdx) => (
                          <div key={imgIdx} className="flex-shrink-0 relative group rounded-xl overflow-hidden border border-border/50 bg-background/50 cursor-pointer" style={{ width: '240px' }}
                            onClick={() => setLightboxImage(img.url)}
                          >
                            <img src={img.url} alt={img.label || `生成图${imgIdx + 1}`} className="w-full aspect-video object-cover" />
                            {img.label && (
                              <div className="absolute bottom-0 left-0 right-0 px-2.5 py-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                                <span className="text-xs text-white font-medium">{img.label}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 生成的视频内容（ViMAX 消息的成片挂在对应 Clip 下） */}
                  {msg.generatedVideo && !msg.vimaxAgent && (
                    <div className="mt-3 ml-1">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Video className="w-4 h-4 text-[#70E0FF]" />
                        <span className="text-sm font-medium text-foreground/80">生成视频</span>
                        {msg.generatedVideo.duration && (
                          <span className="text-xs text-muted-foreground bg-accent/40 px-1.5 py-0.5 rounded-full">{msg.generatedVideo.duration}秒</span>
                        )}
                      </div>
                      <div className="relative rounded-xl overflow-hidden border border-border/50 bg-background/50 max-w-[400px]">
                        <video
                          src={msg.generatedVideo.url}
                          poster={msg.generatedVideo.coverUrl}
                          controls
                          className="w-full aspect-video object-cover"
                        />
                      </div>
                    </div>
                  )}

                  {/* 生成完成状态标记 */}
                  {msg.generationStatus === 'completed' && (msg.generatedImages || msg.generatedVideo) && (
                    <div className="mt-2 ml-1 flex items-center gap-1.5">
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/15">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-xs text-green-600 font-medium">生成完成</span>
                      </div>
                      {(msg.generatedImages?.length ?? 0) > 0 && (
                        <span className="text-xs text-muted-foreground">{msg.generatedImages!.length}张画面已就绪</span>
                      )}
                    </div>
                  )}

                  {/* 对话调整引导 — 完成后显示操作按钮 */}
                  {msg.generationStatus === 'completed' && (msg.generatedImages || msg.generatedVideo) && (
                    <div className="mt-2 ml-1 flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          const adjustPrompt = msg.generationType === 'video'
                            ? '调整视频风格/节奏/镜头'
                            : msg.generationType === 'character'
                            ? '调整角色外观/服装/表情'
                            : msg.generationType === 'scene'
                            ? '调整场景氛围/光线/构图'
                            : '调整画面细节';
                          pendingSuggestionRef.current = true;
                          setInputValue(adjustPrompt);
                        }}
                        className="px-4 py-1.5 rounded-full text-xs bg-[#70E0FF]/10 text-[#70E0FF] hover:bg-[#70E0FF]/20 border border-[#70E0FF]/20 transition-all flex items-center gap-1.5 font-medium"
                      >
                        <Wand2 className="w-3 h-3" />
                        对话调整
                      </button>
                      <button
                        onClick={() => {
                          if (msg.generatedImages) {
                            const urls = msg.generatedImages.map(i => i.url).join('\n');
                            navigator.clipboard.writeText(urls);
                          } else if (msg.generatedVideo) {
                            navigator.clipboard.writeText(msg.generatedVideo.url);
                          }
                        }}
                        className="px-3 py-1.5 rounded-full text-xs bg-accent/30 text-muted-foreground hover:bg-accent/50 border border-border/50 transition-all flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        复制链接
                      </button>
                      {onNavigate && (
                        <button
                          onClick={() => {
                            const transferData = collectTransferData();
                            onNavigate('film', undefined, transferData);
                          }}
                          className="px-4 py-1.5 rounded-full text-xs bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 transition-all flex items-center gap-1.5 font-medium shadow-sm"
                        >
                          <Film className="w-3 h-3" />
                          生成视频
                        </button>
                      )}
                    </div>
                  )}

                  {/* 操作栏 */}
                  {msg.role === 'assistant' && msg.content && (
                    <div className="flex items-center gap-1 mt-1.5 ml-1">
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        title="复制"
                        className="p-1 rounded-md text-foreground/20 hover:text-muted-foreground hover:bg-accent/50 transition-all"
                      >
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => handleRegenerate(idx)}
                        title="重新生成"
                        className="p-1 rounded-md text-foreground/20 hover:text-muted-foreground hover:bg-accent/50 transition-all"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          const el = e.currentTarget;
                          el.classList.add('text-green-500');
                          setTimeout(() => el.classList.remove('text-green-500'), 1500);
                        }}
                        title="点赞"
                        className="p-1 rounded-md text-foreground/20 hover:text-green-500 hover:bg-accent/50 transition-all"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          const el = e.currentTarget;
                          el.classList.add('text-red-400');
                          setTimeout(() => el.classList.remove('text-red-400'), 1500);
                        }}
                        title="踩"
                        className="p-1 rounded-md text-foreground/20 hover:text-red-400 hover:bg-accent/50 transition-all"
                      >
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* 消息操作按钮（复制/引用/修改） */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex gap-3 mt-2 ml-0.5">
                      {msg.actions.map(action => (
                        <button
                          key={action}
                          onClick={() => {
                            if (action === '复制') {
                              navigator.clipboard?.writeText(msg.content);
                            } else if (action === '引用') {
                              setInputValue(`> ${msg.content.slice(0, 50)}...\n`);
                            } else if (action === '修改') {
                              setEditingMsgId(msg.id);
                              setEditingText(msg.content);
                            }
                          }}
                          className="text-[11px] text-foreground/30 hover:text-foreground/60 transition-colors"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 建议芯片 */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 ml-0.5">
                      {msg.suggestions.map((s, idx) => {
                        const chipStyles = [
                          'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200/60',
                          'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200/60',
                          'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200/60',
                          'bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200/60',
                        ];
                        const chipStyle = chipStyles[idx % chipStyles.length];
                        return (
                          <button
                            key={s}
                            onClick={() => {
                              pendingSuggestionRef.current = true;
                              setInputValue(s);
                            }}
                            className={`px-3.5 py-1.5 rounded-xl text-xs border ${chipStyle} transition-all font-medium`}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 快速选项按钮 — AI主动提供的选项 */}
                  {msg.quickOptions && msg.quickOptions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 ml-1">
                      {msg.quickOptions.map(opt => (
                        <button
                          key={opt}
                          onClick={() => {
                            pendingSuggestionRef.current = true;
                            setInputValue(opt);
                          }}
                          className="px-4 py-1.5 rounded-lg text-sm bg-[#70E0FF]/8 text-foreground/80 hover:bg-[#70E0FF]/15 hover:text-[#70E0FF] border border-[#70E0FF]/15 hover:border-[#70E0FF]/30 transition-all font-medium"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 分镜确认卡片 — 导演方案展示，含角色卡/场景卡/分镜详情，确认后按导演工作流生成 */}
                  {msg.storyboardData && !msg.storyboardConfirmed && (
                    <div className="mt-3 ml-1 p-4 rounded-xl border border-[#70E0FF]/20 bg-accent/20 max-w-[560px]">
                      <div className="flex items-center gap-2 mb-3">
                        <Clapperboard className="w-5 h-5 text-[#70E0FF]" />
                        <span className="font-bold text-foreground text-base">{msg.storyboardData.title}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#70E0FF]/10 text-[#70E0FF] font-medium">待确认</span>
                        {msg.storyboardData.totalDuration && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/50 text-muted-foreground ml-auto">{msg.storyboardData.totalDuration}秒</span>
                        )}
                      </div>

                      {/* 角色卡列表 — 含MBTI/弧光/一致性约束 */}
                      {msg.storyboardData.characters.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> 角色 ({msg.storyboardData.characters.length})
                          </div>
                          <div className="space-y-1.5">
                            {msg.storyboardData.characters.map((char, ci) => (
                              <div key={ci} className="p-2 rounded-lg bg-background/50 border border-[#70E0FF]/10">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-xs font-medium text-foreground">{char.name || `角色${ci + 1}`}</span>
                                  {char.mbti && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 font-medium">{char.mbti}</span>
                                  )}
                                  {char.anchor && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium truncate max-w-[120px]">{char.anchor}</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-foreground/60 leading-relaxed line-clamp-2">{char.description}</p>
                                {char.consistencyRules && (char.consistencyRules.mustInclude?.length || char.consistencyRules.mustExclude?.length) && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {char.consistencyRules.mustInclude?.map((rule, ri) => (
                                      <span key={ri} className="text-[10px] px-1 py-0.5 rounded bg-green-500/10 text-green-600">{rule}</span>
                                    ))}
                                    {char.consistencyRules.mustExclude?.map((rule, ri) => (
                                      <span key={ri} className="text-[10px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 line-through">{rule}</span>
                                    ))}
                                  </div>
                                )}
                                {char.arc && (
                                  <p className="text-[10px] text-foreground/40 mt-1 italic">弧光: {char.arc.length > 40 ? char.arc.slice(0, 40) + '...' : char.arc}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 场景卡列表 — 含五感/象征/光线 */}
                      {msg.storyboardData.scenes.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> 场景 ({msg.storyboardData.scenes.length})
                          </div>
                          <div className="space-y-1.5">
                            {msg.storyboardData.scenes.map((sc, si) => (
                              <div key={si} className="p-2 rounded-lg bg-background/50 border border-blue-500/10">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-xs font-medium text-foreground">{sc.name || `场景${si + 1}`}</span>
                                  {sc.lighting && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 truncate max-w-[150px]">{sc.lighting.length > 20 ? sc.lighting.slice(0, 20) + '...' : sc.lighting}</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-foreground/60 leading-relaxed line-clamp-2">{sc.description}</p>
                                {sc.environment && (sc.environment.visual || sc.environment.auditory || sc.environment.symbolism) && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {sc.environment.visual && <span className="text-[10px] px-1 py-0.5 rounded bg-sky-500/10 text-sky-600">视:{sc.environment.visual.length > 12 ? sc.environment.visual.slice(0, 12) + '..' : sc.environment.visual}</span>}
                                    {sc.environment.auditory && <span className="text-[10px] px-1 py-0.5 rounded bg-teal-500/10 text-teal-600">听:{sc.environment.auditory.length > 12 ? sc.environment.auditory.slice(0, 12) + '..' : sc.environment.auditory}</span>}
                                    {sc.environment.symbolism && <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-600">象征:{sc.environment.symbolism.length > 12 ? sc.environment.symbolism.slice(0, 12) + '..' : sc.environment.symbolism}</span>}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 分镜列表 — 含对白/旁白/BGM/色彩叙事 */}
                      <div className="space-y-2 mb-3">
                        <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <Film className="w-3.5 h-3.5" /> 分镜规划 ({msg.storyboardData.shots.length}个镜头)
                        </div>
                        {msg.storyboardData.shots.map((shot, si) => (
                          <div key={si} className="p-2.5 rounded-lg bg-background/50 border border-border/50">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-[#70E0FF]/15 text-[#70E0FF] text-[10px] font-bold flex items-center justify-center">{si + 1}</span>
                                <span className="text-xs font-medium text-foreground">{shot.shotId}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/40 text-muted-foreground">{shot.shotType}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">{shot.duration}秒</span>
                            </div>
                            <p className="text-xs text-foreground/70 leading-relaxed">{shot.description}</p>
                            {shot.dialogue && <p className="text-[11px] text-foreground/50 mt-1 italic border-l-2 border-[#70E0FF]/20 pl-2">{shot.dialogue}</p>}
                            {shot.narration && <p className="text-[11px] text-foreground/40 mt-0.5 italic border-l-2 border-blue-500/20 pl-2">旁白: {shot.narration.length > 50 ? shot.narration.slice(0, 50) + '...' : shot.narration}</p>}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {shot.characterIds.length > 0 && shot.characterIds.map((cid, ci2) => (
                                <span key={ci2} className="text-[10px] px-1.5 py-0.5 rounded bg-[#70E0FF]/8 text-[#70E0FF]/70">{cid}</span>
                              ))}
                              {shot.sceneName && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/8 text-blue-500/70">{shot.sceneName}</span>
                              )}
                              {shot.colorNarrative && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500/70">{shot.colorNarrative.length > 15 ? shot.colorNarrative.slice(0, 15) + '..' : shot.colorNarrative}</span>
                              )}
                              {shot.bgmCue && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600/70">BGM</span>
                              )}
                              <span className="text-[10px] text-muted-foreground ml-auto">{shot.camera}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 生成流程说明 */}
                      <div className="mb-3 p-2 rounded-lg bg-background/30 border border-dashed border-border/50">
                        <div className="text-[10px] text-muted-foreground font-medium mb-1">确认后按顺序来：</div>
                        <div className="flex items-center gap-1 text-[10px] text-foreground/50">
                          <span className="px-1.5 py-0.5 rounded bg-[#70E0FF]/10 text-[#70E0FF]/70">1. 画角色</span>
                          <span>→</span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500/70">2. 画场景</span>
                          <span>→</span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500/70">3. 画分镜</span>
                        </div>
                      </div>

                      {/* 确认/调整按钮 */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStoryboardConfirm(msg.id, msg.storyboardData)}
                          className="flex-1 px-4 py-2 rounded-lg bg-[#70E0FF] text-white text-sm font-medium hover:bg-[#38BDF8] transition-all flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-4 h-4" /> 确认，开始吧
                        </button>
                        <button
                          onClick={() => {
                            pendingSuggestionRef.current = true;
                            setInputValue('调整分镜内容');
                          }}
                          className="px-4 py-2 rounded-lg border border-border text-sm text-foreground/70 hover:bg-accent/30 transition-all"
                        >
                          调整
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && !messages[messages.length - 1]?.content && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-accent/30">
                  <Loader2 className="w-4 h-4 text-foreground/70 animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 滚动到底部按钮 */}
          {!isAtBottom && (
            <button
              onClick={() => scrollToBottom()}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/95 border border-border shadow-lg text-xs text-foreground/80 hover:bg-accent/30 transition-all backdrop-blur-sm"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              回到最新
            </button>
          )}

          {/* 输入区 */}
          <div className="flex-shrink-0 p-4 border-t border-border">
            {/* 已附加媒体预览 */}
            {attachedMedia && attachedMedia.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2 p-2 bg-accent/20 rounded-xl">
                {attachedMedia.map((media, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-border/50">
                    {media.type === 'image' ? (
                      <img src={media.url} alt={media.name} className="w-16 h-16 object-cover" />
                    ) : (
                      <div className="w-16 h-16 bg-accent/50 flex items-center justify-center">
                        <Video className="w-6 h-6 text-foreground/50" />
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachedMedia(idx)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/60 text-white text-[8px] truncate">
                      {media.name}
                    </div>
                  </div>
                ))}
                {/* 分析类型选择 */}
                <div className="flex flex-col gap-1 ml-1">
                  <span className="text-[10px] text-foreground/50">分析方式:</span>
                  <div className="flex gap-1">
                    {[
                      { key: 'describe' as const, label: '描述', icon: Eye },
                      { key: 'prompt' as const, label: '提示词', icon: Wand2 },
                      { key: 'tag' as const, label: '标签', icon: Tag },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setAnalysisType(opt.key)}
                        className={`flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] transition-colors ${
                          analysisType === opt.key
                            ? 'bg-primary/20 text-primary font-medium'
                            : 'bg-accent/30 text-foreground/50 hover:text-foreground/70'
                        }`}
                      >
                        <opt.icon className="w-2.5 h-2.5" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-end gap-2">
              {/* 上传按钮 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent/30 border border-border/50 flex items-center justify-center text-foreground/40 hover:text-primary hover:border-primary/30 hover:bg-accent/50 transition-all"
                title="上传图片/视频进行分析"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <div className="flex-1 relative">
                <textarea
                  value={inputValue}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={currentStep >= 6 ? "确认方案后点击右侧生成按钮..." : attachedMedia ? "可选：输入自定义分析要求..." : "告诉我你想创作什么..."}
                  rows={1}
                  className="w-full px-4 py-3 rounded-2xl bg-accent/20 border border-border/40 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 resize-none max-h-[120px] transition-all"
                  style={{ minHeight: '44px' }}
                />
              </div>
              {/* 一键生成按钮（第3步起显示，越早出现越好） */}
              {currentStep >= 3 || messages.length >= 4 ? (
                <button
                  onClick={async () => {
                    setIsLoading(true);
                    const progressMsgId = `gen-progress-${Date.now()}`;
                    try {
                      // 1. 添加进度消息
                      setMessages(prev => [...prev, {
                        id: progressMsgId,
                        role: 'assistant' as const,
                        content: '正在想方案...',
                        timestamp: Date.now(),
                        generationStatus: 'generating' as const,
                        generationStepInfo: { step: 'planning', progress: 15, totalSteps: 5, currentStepLabel: '想方案' },
                      } as ChatMessage]);

                      // 2. 流式获取创作规划
                      const plan = await fetchCreationPlanStream(
                        messages.filter(m => m.id !== 'welcome').map(m => ({ role: m.role, content: m.content })),
                        creationParams,
                        (update: Record<string, any>) => {
                          // 实时更新确认卡片
                          setMessages(prev => prev.map(m => {
                            if (m.id !== progressMsgId) return m;
                            const currentData = m.storyboardData || { title: '', shots: [], characters: [], scenes: [] };
                            return {
                              ...m,
                              content: update.title
                                ? `方案「${update.title}」正在规划...`
                                : '正在想方案...',
                              generationStepInfo: update.phase === 'done'
                                ? undefined
                                : { step: 'planning', progress: Math.min(15 + (update.characters?.length || 0) * 5 + (update.shots?.length || 0) * 3, 50), totalSteps: 5, currentStepLabel: update.title ? `方案: ${update.title}` : '想方案' },
                              storyboardData: {
                                title: update.title || currentData.title || '规划中...',
                                shots: update.shots || currentData.shots,
                                characters: update.characters || currentData.characters,
                                scenes: update.scenes || currentData.scenes,
                                style: update.style || (currentData as Record<string, unknown>).style,
                                totalDuration: update.totalDuration || (currentData as Record<string, unknown>).totalDuration as number | undefined,
                                narration: update.narration || (currentData as Record<string, unknown>).narration as Record<string, unknown> | undefined,
                                bgm: update.bgm || (currentData as Record<string, unknown>).bgm as Record<string, unknown> | undefined,
                                consistency: update.consistency || (currentData as Record<string, unknown>).consistency as Record<string, unknown> | undefined,
                              },
                              storyboardConfirmed: false,
                            } as ChatMessage;
                          }));
                        },
                      );

                      if (!plan) {
                        setMessages(prev => prev.map(m => m.id === progressMsgId ? {
                          ...m, content: '方案没出成功，再描述一下你的想法吧',
                          generationStatus: 'failed' as const,
                          generationStepInfo: { step: 'failed', progress: 0, totalSteps: 5, currentStepLabel: '生成失败' },
                        } : m));
                        return;
                      }

                      // 3. 最终更新确认卡片
                      setMessages(prev => prev.map(m => {
                        if (m.id !== progressMsgId) return m;
                        const currentData = m.storyboardData || { title: '', shots: [], characters: [], scenes: [] };
                        const characters = currentData.characters || [];
                        const scenes = currentData.scenes || [];
                        const shots = currentData.shots || [];
                        return {
                          ...m,
                          content: `方案「${(plan.title as string) || '未命名'}」好了，${characters.length} 个角色、${scenes.length} 个场景、${shots.length} 个镜头。看看没问题就确认，我开始画图。`,
                          generationStatus: undefined,
                          generationProgress: undefined,
                          generationStepInfo: undefined,
                          storyboardData: {
                            title: (plan.title as string) || '未命名创作',
                            shots,
                            characters,
                            scenes,
                            style: plan.style || (currentData as Record<string, unknown>).style,
                            totalDuration: (plan.totalDuration as number) || (currentData as Record<string, unknown>).totalDuration as number | undefined,
                            narration: plan.narration || (currentData as Record<string, unknown>).narration as Record<string, unknown> | undefined,
                            bgm: plan.bgm || (currentData as Record<string, unknown>).bgm as Record<string, unknown> | undefined,
                            consistency: plan.consistency || (currentData as Record<string, unknown>).consistency as Record<string, unknown> | undefined,
                          },
                          storyboardConfirmed: false,
                          suggestions: ['确认方案，开始吧！', '调整分镜内容'],
                        } as ChatMessage;
                      }));

                      setCurrentStep(5);
                    } catch {
                      setMessages(prev => prev.map(m => m.id === progressMsgId ? {
                        ...m, content: '生成过程出现错误，请重试',
                        generationStatus: 'failed' as const,
                        generationStepInfo: { step: 'failed', progress: 0, totalSteps: 5, currentStepLabel: '生成失败' },
                      } : m));
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  className="flex-shrink-0 h-10 px-4 flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-white text-sm font-medium hover:from-red-600 hover:to-rose-600 disabled:opacity-40 transition-all shadow-lg shadow-red-500/20"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>一键生成</span>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={(!inputValue.trim() && !attachedMedia) || isLoading}
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-20 disabled:bg-primary/30 transition-all shadow-sm"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
              {/* AI快速按钮 */}
              {!creationParams.scriptType && (
                <button
                  onClick={() => {
                    const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
                    if (textarea) textarea.focus();
                  }}
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-rose-400/20 text-foreground/70 hover:from-primary/30 hover:to-rose-400/30 border border-primary/10 transition-all shadow-sm"
                  title="AI辅助"
                >
                  <span className="text-xs font-bold">AI</span>
                </button>
              )}
              {/* 取消生成按钮 */}
              {isLoading && (
                <button
                  onClick={handleCancel}
                  className="flex-shrink-0 h-10 px-3 flex items-center justify-center gap-1.5 rounded-full border border-red-300 dark:border-red-800 text-red-500 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                >
                  <XCircle className="w-4 h-4" />
                  <span>取消</span>
                </button>
              )}
            </div>
          </div>
        </div>
    </>
  );
}
