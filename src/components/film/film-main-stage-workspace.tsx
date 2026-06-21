"use client";

import React from 'react';
import {
  AlertCircle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Clapperboard, Clock,
  Eye, FileDown, FileText, Film, History, Image as ImageIcon, ImagePlus, LayoutGrid, Loader2,
  Mountain, Package, Palette, Paperclip, Play, RefreshCw, Send, Sparkles, Users, Video, Wand2, X,
  type LucideIcon,
} from 'lucide-react';
import { FilmChatMessage } from '@/components/film/film-creation-chat';
import { FilmCompliancePanel, FilmDirectorAnalysisPanel } from '@/components/film/film-quality-panels';
import { FilmDirectorPlanPanel } from '@/components/film/film-director-plan-panel';
import { FilmEntityPlanningGrid } from '@/components/film/film-entity-planning-grid';
import { FilmScreenplayPanel } from '@/components/film/film-screenplay-panel';
import { FilmScriptProgressPanel } from '@/components/film/film-script-progress-panel';
import { FilmVisualStageToolbar } from '@/components/film/film-visual-stage-toolbar';
import { FilmVisualStageHeader } from '@/components/film/film-visual-stage-header';
import { FilmVisualProgressPanel } from '@/components/film/film-visual-progress-panel';
import { FilmVisualCardSection } from '@/components/film/film-visual-card-section';
import { FilmComposeStageHeader } from '@/components/film/film-compose-stage-header';
import { FilmComposeShotList } from '@/components/film/film-compose-shot-list';
import { FilmEditableField, type FilmEditableFieldProps } from '@/components/film/film-editable-field';
import { renderSafe, type ChatMessage, type EntityCard, type WorkflowPhase } from '@/lib/film-creation-panel-model';

type UploadedFileItem = {
  id: string;
  name: string;
  type: string;
  localPreview?: string;
  uploading?: boolean;
};

type FilmMainStageWorkspaceProps = Record<string, any> & {
  chatMessages: ChatMessage[];
  entityCards: EntityCard[];
  expandedShotIds: Set<string>;
  phase: WorkflowPhase;
  stats: Record<string, number> & { imagesGenerated: number; totalNeedImage: number };
  typeConfig: Record<string, { label: string; color: string; icon: LucideIcon }>;
  uploadedFiles: UploadedFileItem[];
};

export function FilmMainStageWorkspace(props: FilmMainStageWorkspaceProps) {
  const {
    chatEndRef, chatInput, chatInputHighlight, chatInputRef, chatMessages, chatPlaceholder, complianceResult, composeProgress, directorAnalysis, entityCards, entityCardsGridRef, error, expandedShotIds, fileInputRef, filmHistory, filmVisualStyle, finalVideoUrl, generationProgress, generationStage, handleBatchGenerateFrames, handleComposeFilm, handleExportPDF, handleFileUpload, handleGenerateAllImages, handleGenerateEndFrame, handleGenerateImage, handleGenerateNineGrid, handleGeneratePrompt, handleGenerateStartFrame, handleGenerateShotVideo, handleQuickCmd, handleRegenerateVideo, handleSelectNineGridImage, handleSendChat, handleSwitchOutfit, inputText, isChatStreaming, isGenerating, middleAiStatus, phase, progressMsg, script, scriptDirectorRef, scriptScreenplayRef, selectedCardId, setChatInput, setComposeStatus, setError, setExpandedShotIds, setFilmVisualStyle, setFinalVideoUrl, setMiddleAiStatus, setNineGridDialogCardId, setPhase, setPromptManagerOpen, setSelectedCardId, setShowChatMessages, setShowDirectorPanel, setShowHistoryPanel, setShowLogPanel, setUploadedFiles, setShotViewMode, setWardrobeDialogCardId, setWsPreviewUrl, shotViewMode, showChatMessages, showDirectorPanel, showLogPanel, stats, streamingScriptText, typeConfig, updateCardField, uploadedFiles, videoDuration, goToPhase, setShowScriptPreview,
  } = props;

  const EditableField = ({ cardId, field, value, multiline, className }: Omit<FilmEditableFieldProps, 'onUpdate'>) => (
    <FilmEditableField
      cardId={cardId}
      field={field}
      value={value}
      multiline={multiline}
      className={className}
      onUpdate={updateCardField}
    />
  );

  return (
    <>
      {/* ============================================ */}
      {/* 中栏: 主内容区（按阶段切换） */}
      {/* ============================================ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* 阶段内容 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {error && (
            <div className="mx-4 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto"><X className="w-3 h-3" /></button>
            </div>
          )}

          {/* ===== 阶段1：创作规划 ===== */}
          {phase === 'planning' && (
            <div className="flex flex-col h-full">
              {/* 顶部标题区 — 剧本名称+统计+操作按钮 */}
              <div className="flex-shrink-0 flex items-start justify-between px-6 pt-5 pb-3">
                <div>
                  <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-white">{script?.title || '未命名剧本'}</h2>
                  {(script || entityCards.length > 0) && (
                    <p className="text-sm text-[#666] dark:text-white/60 mt-0.5">
                      {stats.characters}个人物 · {stats.scenes}个场景 · {entityCards.filter(c => c.type === 'prop').length}个道具 · {stats.shots}个分镜
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  {/* 预览剧本 */}
                  {(script || entityCards.length > 0) && (
                    <button
                      onClick={() => setShowScriptPreview(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-sm text-[#555] dark:text-white/70 transition-colors"
                    >
                      <Eye className="w-4 h-4 text-[#EF4444]" /> 预览剧本
                    </button>
                  )}
                  {/* 导出剧本 */}
                  {(script || entityCards.length > 0) && (
                    <button
                      onClick={handleExportPDF}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-medium transition-colors shadow-sm"
                    >
                      <FileDown className="w-4 h-4" /> 导出剧本
                    </button>
                  )}
                  {/* 下一步：画面生成 */}
                  <button
                    onClick={() => goToPhase('visual')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-sm text-[#555] dark:text-white/70 transition-colors"
                  >
                    下一步：画面生成 <ArrowRight className="w-4 h-4" />
                  </button>
                  {/* 历史记录 */}
                  <div className="relative flex flex-col items-center ml-1">
                    <button
                      onClick={() => setShowHistoryPanel(true)}
                      className="relative p-2 rounded-lg hover:bg-accent/30 transition-colors"
                    >
                      <History className="w-5 h-5 text-[#888] dark:text-white/50" />
                      {filmHistory.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#EF4444] rounded-full border-2 border-white dark:border-card" />
                      )}
                    </button>
                    <span className="text-[10px] text-[#999] dark:text-white/40 mt-0.5">历史记录</span>
                  </div>
                </div>
              </div>

              {/* 状态统计条 — 规划阶段统计剧本要素完成情况 */}
              <div className="flex-shrink-0 mx-6 mb-4 px-0 py-0 bg-white dark:bg-card rounded-lg border border-[#E5E7EB] dark:border-border overflow-hidden">
                <div className="flex items-center divide-x divide-[#E5E7EB] dark:divide-border">
                  <div className="flex items-center gap-1.5 px-4 py-2.5 flex-1">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-[#666] dark:text-white/60">已完成</span>
                    <span className="text-sm font-semibold text-green-500">{entityCards.filter(c => c.type !== 'plot' && c.name && c.description).length}/{entityCards.filter(c => c.type !== 'plot').length}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-4 py-2.5 flex-1">
                    <Loader2 className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-[#666] dark:text-white/60">生成中</span>
                    <span className="text-sm font-semibold text-orange-500">{isGenerating ? 1 : 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-4 py-2.5 flex-1">
                    <Clock className="w-4 h-4 text-[#999] dark:text-white/40" />
                    <span className="text-sm text-[#666] dark:text-white/60">等待</span>
                    <span className="text-sm font-semibold text-[#888] dark:text-white/50">{Math.max(0, entityCards.filter(c => c.type !== 'plot').length - entityCards.filter(c => c.type !== 'plot' && c.name && c.description).length - (isGenerating ? 1 : 0))}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-4 py-2.5 flex-1">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-[#666] dark:text-white/60">失败</span>
                    <span className="text-sm font-semibold text-red-500">0</span>
                  </div>
                  <div className="flex items-center justify-center px-4 py-2.5">
                    <button
                      onClick={() => setShowLogPanel((v: boolean) => !v)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-50 dark:bg-accent/30 hover:bg-gray-100 dark:hover:bg-accent/50 transition-colors text-xs text-[#888] dark:text-white/50"
                    >
                      <FileText className="w-3.5 h-3.5" /> {showLogPanel ? '隐藏日志' : '查看日志'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 滚动内容区 */}
              <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-4 space-y-3">
              {/* 流式文本输出 + 进度条 — 中间栏实时展示 */}
              <FilmScriptProgressPanel
                isGenerating={isGenerating}
                progressMsg={progressMsg}
                streamingScriptText={streamingScriptText}
              />
              {/* AI 对话状态指示 */}
              {middleAiStatus && entityCards.length === 0 && !streamingScriptText && (
                <div className="mx-3 mb-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className={`text-xs font-medium ${middleAiStatus.type === 'error' ? 'text-destructive' : middleAiStatus.type === 'done' ? 'text-green-500' : 'text-primary'}`}>{middleAiStatus.text}</span>
                  </div>
                </div>
              )}
              {entityCards.length === 0 ? (
                <div className="text-center py-16 text-foreground/30">
                  <Clapperboard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <div className="text-sm font-medium mb-1">输入创作需求，开始影视创作</div>
                  <div className="text-xs">AI 将自动生成剧情、人物、场景、分镜等完整规划</div>
                </div>
              ) : (
                <>
                  {/* 自动化导演分析面板 */}
                  {showDirectorPanel && directorAnalysis && (
                    <FilmDirectorAnalysisPanel
                      analysis={directorAnalysis}
                      onClose={() => setShowDirectorPanel(false)}
                    />
                  )}

                  {/* AIGC 合规检测结果 */}
                  {complianceResult && <FilmCompliancePanel result={complianceResult} />}

                  {/* 导演方案入口（如果折叠状态下需要访问） */}
                  {directorAnalysis && !showDirectorPanel && (
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => setShowDirectorPanel(true)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-all"
                      >
                        <Clapperboard className="w-3 h-3" /> 查看导演方案
                      </button>
                    </div>
                  )}

                  {/* ===== 第一部分：场景剧本 ===== */}
                  <div ref={scriptScreenplayRef}>
                    <FilmScreenplayPanel
                      script={script}
                      fallbackShotCount={entityCards.filter(c => c.type === 'shot').length}
                      onBackToCanvas={() => entityCardsGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    />
                  </div>

                  <div ref={scriptDirectorRef}>
                    <FilmDirectorPlanPanel
                      script={script}
                      onBackToCanvas={() => entityCardsGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    />
                  </div>

                  <FilmEntityPlanningGrid
                    entityCards={entityCards}
                    selectedCardId={selectedCardId}
                    videoDuration={videoDuration}
                    onSelectedCardChange={setSelectedCardId}
                    onSetChatInput={setChatInput}
                    onGeneratePrompt={handleGeneratePrompt}
                    onUpdateCardField={updateCardField}
                  />
                </>
              )}
              </div>{/* 滚动内容区结束 */}
            </div>
          )}

          {/* ===== 阶段2：画面生成 ===== */}
          {phase === 'visual' && (
            <div className="flex flex-col h-full">
              <FilmVisualStageHeader
                stats={stats}
                isGenerating={isGenerating}
                hasHistory={filmHistory.length > 0}
                showLogPanel={showLogPanel}
                onBackToScript={() => {
                  goToPhase('planning');
                  setTimeout(() => scriptScreenplayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
                }}
                onGenerateAllImages={handleGenerateAllImages}
                onGoToCompose={() => goToPhase('compose')}
                onOpenHistory={() => setShowHistoryPanel(true)}
                onToggleLogPanel={() => setShowLogPanel((v: boolean) => !v)}
              />

              {/* 滚动内容区 */}
              <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-4 space-y-3">
              <FilmVisualProgressPanel
                middleAiStatus={middleAiStatus}
                generationStage={generationStage}
                generationProgress={generationProgress}
                isGenerating={isGenerating}
                progressMsg={progressMsg}
                onClearMiddleAiStatus={() => setMiddleAiStatus(null)}
              />

              <FilmVisualStageToolbar
                filmVisualStyle={filmVisualStyle}
                shotViewMode={shotViewMode}
                onFilmVisualStyleChange={setFilmVisualStyle}
                onShotViewModeChange={setShotViewMode}
                onOpenPromptManager={() => setPromptManagerOpen(true)}
              />

              {/* 人物/场景/道具/分镜画面卡片 */}
              {['character', 'scene', 'prop', 'shot'].map(type => {
                const cards = entityCards.filter(c => c.type === type);
                // 道具栏始终显示（即使为空），其他类型有卡片才显示
                if (type !== 'prop' && cards.length === 0) return null;
                const cfg = typeConfig[type];
                const Icon = cfg.icon;
                return (
                  <FilmVisualCardSection
                    key={type}
                    label={cfg.label}
                    color={cfg.color}
                    Icon={Icon}
                    generatedCount={cards.filter(c => c.imageUrl).length}
                    totalCount={cards.length}
                    showEmptyPropNotice={type === 'prop' && cards.length === 0}
                  >
                    {/* ===== 关键帧视图 (BigBanana Keyframe-Driven) ===== */}
                    {type === 'shot' && shotViewMode === 'keyframe' ? (
                      <div className="space-y-3">
                        {cards.map((card, shotIdx) => {
                          // 剧本验证：镜头必须有剧本内容（promptEn或promptCn）才能展示关键帧
                          const hasScriptContent = !!(card.promptEn || card.promptCn || card.description);
                          const status = card.shotStatus || 'pending';
                          const statusLabel: Record<string, { text: string; color: string }> = {
                            pending: { text: '待构图', color: 'text-foreground/30' },
                            framing: { text: '构图中', color: 'text-amber-500' },
                            start_ready: { text: '首帧就绪', color: 'text-blue-500' },
                            end_ready: { text: '首尾帧就绪', color: 'text-emerald-500' },
                            video_ready: { text: '视频就绪', color: 'text-primary' },
                            completed: { text: '已完成', color: 'text-emerald-500' },
                          };
                          const st = statusLabel[status] || statusLabel.pending;
                          return (
                            <React.Fragment key={card.id}>
                            <div className="p-3 rounded-xl border border-border/50 bg-accent/5 hover:border-primary/20 transition-all">
                              {!hasScriptContent ? (
                                /* 未通过剧本验证 — 显示等待提示 */
                                <div className="flex flex-col items-center justify-center py-8 text-foreground/30">
                                  <FileText className="w-8 h-8 mb-2" />
                                  <span className="text-xs">等待剧本内容验证</span>
                                  <span className="text-[10px] mt-1">请先在剧本中添加镜头描述</span>
                                </div>
                              ) : (
                              <>
                              {/* 镜头标题行 */}
                              <div className="flex items-center gap-2 mb-2.5">
                                <span className="w-5 h-5 rounded-full bg-[#EF4444]/10 text-[#EF4444] text-[10px] font-bold flex items-center justify-center">{shotIdx + 1}</span>
                                <EditableField cardId={card.id} field="name" value={card.name} className="font-medium text-xs text-foreground/90" />
                                <span className={`text-[9px] font-medium ${st.color}`}>{st.text}</span>
                                <div className="flex-1" />
                                {/* 九宫格构图按钮 */}
                                <button
                                  onClick={() => handleGenerateNineGrid(card.id)}
                                  disabled={card.nineGridGenerating || !card.promptEn}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 text-[9px] font-medium hover:bg-amber-500/20 transition-all disabled:opacity-40"
                                  title="生成9个候选视角选择最佳构图"
                                >
                                  {card.nineGridGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <LayoutGrid className="w-3 h-3" />}
                                  九宫格
                                </button>
                              </div>

                              {/* 首帧 + 尾帧 双栏 */}
                              <div className="grid grid-cols-2 gap-3">
                                {/* 起始帧 */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-semibold text-blue-500 uppercase tracking-wider">起始帧 (Start)</span>
                                    {!card.startFrameUrl && (
                                      <button
                                        onClick={() => handleGenerateStartFrame(card.id)}
                                        disabled={card.startFrameGenerating || !card.promptEn}
                                        className="text-[9px] text-blue-500 hover:text-blue-400 flex items-center gap-0.5 disabled:opacity-40"
                                      >
                                        {card.startFrameGenerating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <ImagePlus className="w-2.5 h-2.5" />}
                                        生成
                                      </button>
                                    )}
                                  </div>
                                  <div className="aspect-video rounded-lg overflow-hidden bg-accent/20 border border-blue-500/20 relative flex items-center justify-center">
                                    {card.startFrameUrl ? (
                                      <img src={card.startFrameUrl} alt="Start Frame" className="w-full h-full object-cover" />
                                    ) : card.imageUrl ? (
                                      <img src={card.imageUrl} alt="Reference" className="w-full h-full object-cover opacity-60" />
                                    ) : (
                                      <div className="text-[9px] text-foreground/20">{!card.startFrameUrl ? '首帧未生成' : '参考图'}</div>
                                    )}
                                    {card.startFrameGenerating && (
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                      </div>
                                    )}
                                    {card.startFrameUrl && (
                                      <button
                                        onClick={() => handleGenerateStartFrame(card.id)}
                                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-all"
                                      >
                                        <RefreshCw className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* 结束帧 */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wider">结束帧 (End)</span>
                                    {!card.endFrameUrl && (
                                      <button
                                        onClick={() => handleGenerateEndFrame(card.id)}
                                        disabled={card.endFrameGenerating || !card.promptEn}
                                        className="text-[9px] text-emerald-500 hover:text-emerald-400 flex items-center gap-0.5 disabled:opacity-40"
                                      >
                                        {card.endFrameGenerating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <ImagePlus className="w-2.5 h-2.5" />}
                                        生成
                                      </button>
                                    )}
                                  </div>
                                  <div className="aspect-video rounded-lg overflow-hidden bg-accent/20 border border-emerald-500/20 relative flex items-center justify-center">
                                    {card.endFrameUrl ? (
                                      <img src={card.endFrameUrl} alt="End Frame" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="text-[9px] text-foreground/20">尾帧自动链入下一镜头</div>
                                    )}
                                    {card.endFrameGenerating && (
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                                      </div>
                                    )}
                                    {card.endFrameUrl && (
                                      <button
                                        onClick={() => handleGenerateEndFrame(card.id)}
                                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-all"
                                      >
                                        <RefreshCw className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* 帧间动画指示器 */}
                              {card.startFrameUrl && card.endFrameUrl && (
                                <div className="flex items-center justify-center gap-2 mt-2 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
                                  <img src={card.startFrameUrl} alt="" className="w-10 h-7 rounded object-cover" />
                                  <div className="flex items-center gap-1">
                                    <ArrowRight className="w-3 h-3 text-primary" />
                                    <span className="text-[9px] text-primary font-medium">插值生成视频</span>
                                    <ArrowRight className="w-3 h-3 text-primary" />
                                  </div>
                                  <img src={card.endFrameUrl} alt="" className="w-10 h-7 rounded object-cover" />
                                  <button
                                    onClick={() => handleGenerateShotVideo(card.id)}
                                    disabled={card.isGenerating}
                                    className="ml-2 px-2.5 py-1 rounded-md bg-[#EF4444] text-white text-[9px] font-medium hover:bg-[#EF4444]/80 transition-all disabled:opacity-40 flex items-center gap-1"
                                  >
                                    {card.isGenerating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                                    生成视频
                                  </button>
                                </div>
                              )}

                              {/* 九宫格候选区 */}
                              {card.nineGridImages && card.nineGridImages.length > 0 && (
                                <div className="mt-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                  <div className="text-[9px] text-amber-600 font-medium mb-1.5 flex items-center gap-1">
                                    <LayoutGrid className="w-3 h-3" /> 选择最佳构图作为首帧
                                  </div>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {card.nineGridImages.map((img, i) => (
                                      <button
                                        key={i}
                                        onClick={() => handleSelectNineGridImage(card.id, i)}
                                        className={`aspect-video rounded overflow-hidden border-2 transition-all hover:border-primary hover:scale-[1.02] ${
                                          card.nineGridSelectedIndex === i ? 'border-[#EF4444] ring-1 ring-[#EF4444]/30' : 'border-transparent'
                                        }`}
                                      >
                                        <img src={img} alt={`候选${i + 1}`} className="w-full h-full object-cover" />
                                      </button>
                                    ))}
                                  </div>
                                  {card.nineGridGenerating && (
                                    <div className="mt-1.5 flex items-center gap-1 text-[9px] text-amber-500">
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      正在生成候选图 ({card.nineGridImages.length}/9)...
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 提示词编辑区（参考画面页风格） */}
                              <div className="mt-2 pt-2 border-t border-border/30 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] text-foreground/30 font-medium">画面描述</span>
                                  <button
                                    onClick={() => handleGenerateStartFrame(card.id)}
                                    disabled={card.startFrameGenerating || card.endFrameGenerating}
                                    className="px-2 py-0.5 rounded bg-[#EF4444] text-white text-[9px] font-medium hover:bg-[#EF4444]/80 transition-all disabled:opacity-40 flex items-center gap-1"
                                  >
                                    {card.startFrameGenerating ? <Loader2 className="w-2 h-2 animate-spin" /> : <Wand2 className="w-2 h-2" />}
                                    重新生成
                                  </button>
                                </div>
                                <EditableField cardId={card.id} field="promptEn" value={card.promptEn} multiline className="text-[10px] text-foreground/50 leading-relaxed" />
                              </div>
                              </>
                              )}
                            </div>
                            {/* FLF2V链路：当前尾帧→下一镜头首帧 */}
                            {card.endFrameUrl && (() => {
                              const shotCards = entityCards.filter(c => c.type === 'shot');
                              const currentIdx = shotCards.findIndex(c => c.id === card.id);
                              const nextShot = shotCards[currentIdx + 1];
                              if (!nextShot) return null;
                              return (
                                <div className="flex items-center justify-center gap-2 py-2 my-1 rounded-lg bg-primary/5 border border-dashed border-primary/20">
                                  <div className="text-[9px] text-foreground/30">镜头{currentIdx + 1}尾帧</div>
                                  <ArrowRight className="w-4 h-4 text-primary" />
                                  <div className="text-[9px] text-primary font-medium">自动链入</div>
                                  <ArrowRight className="w-4 h-4 text-primary" />
                                  <div className="text-[9px] text-foreground/30">镜头{currentIdx + 2}首帧</div>
                                </div>
                              );
                            })()}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    ) : type === 'shot' && shotViewMode === 'grid' ? (
                      /* ===== 网格工作台视图 (BigBanana Shot Workbench) ===== */
                      <div className="grid grid-cols-3 gap-2">
                        {cards.map((card, shotIdx) => {
                          const status = card.shotStatus || 'pending';
                          const hasImage = !!card.imageUrl || !!card.startFrameUrl;
                          const hasVideo = !!card.videoUrl;
                          return (
                            <div
                              key={card.id}
                              className="rounded-xl overflow-hidden border border-border/50 bg-accent/5 hover:border-primary/20 transition-all group relative"
                            >
                              {/* 缩略图区 */}
                              <div className="aspect-video bg-accent/20 relative flex items-center justify-center">
                                {hasVideo ? (
                                  <video src={card.videoUrl} className="w-full h-full object-cover" muted />
                                ) : hasImage ? (
                                  <img src={card.startFrameUrl || card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                                ) : card.isGenerating || card.startFrameGenerating ? (
                                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                ) : (
                                  <ImageIcon className="w-5 h-5 text-foreground/15" />
                                )}
                                {/* 状态指示器 */}
                                <div className="absolute top-1 left-1">
                                  <span className={`px-1 py-0.5 rounded text-[7px] font-bold leading-tight ${
                                    hasVideo ? 'bg-emerald-500 text-white' :
                                    hasImage ? 'bg-blue-500 text-white' :
                                    status === 'framing' ? 'bg-amber-500 text-white' :
                                    'bg-foreground/10 text-foreground/30'
                                  }`}>
                                    {hasVideo ? '视频' : hasImage ? '首帧' : status === 'framing' ? '构图中' : '待生成'}
                                  </span>
                                </div>
                                {/* 镜头编号 */}
                                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/50 text-white text-[8px] font-bold flex items-center justify-center">
                                  {shotIdx + 1}
                                </div>
                                {/* 悬停操作 */}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                  {!card.scriptValidated ? (
                                    <span className="px-2 py-1 rounded bg-foreground/20 text-foreground/50 text-[9px]">
                                      需先填写剧本
                                    </span>
                                  ) : (
                                  <>
                                  {!hasImage && (
                                    <button
                                      onClick={() => {
                                        if (!card.isPromptGenerated) handleGeneratePrompt(card.id).then(() => handleGenerateImage(card.id));
                                        else handleGenerateImage(card.id);
                                      }}
                                      className="px-2 py-1 rounded bg-primary text-white text-[9px] font-medium hover:bg-primary/80"
                                    >
                                      生成
                                    </button>
                                  )}
                                  {hasImage && !hasVideo && (
                                    <button
                                      onClick={() => handleGenerateShotVideo(card.id)}
                                      className="px-2 py-1 rounded bg-[#EF4444] text-white text-[9px] font-medium hover:bg-[#EF4444]/80"
                                    >
                                      视频
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setNineGridDialogCardId(card.id)}
                                    className="px-2 py-1 rounded bg-amber-500 text-white text-[9px] font-medium hover:bg-amber-500/80"
                                    title="九宫格构图"
                                  >
                                    9格
                                  </button>
                                  </>
                                  )}
                                </div>
                              </div>
                              {/* 信息行 */}
                              <div className="p-1.5">
                                <div className="text-[10px] text-foreground/70 truncate">{card.name}</div>
                                <div className="flex items-center gap-1 text-[8px] text-foreground/30">
                                  {card.shotType && <span>{card.shotType}</span>}
                                  {card.duration && <span>{card.duration}s</span>}
                                  {card.dialogue && <span className="truncate max-w-[60px]">"{card.dialogue}"</span>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : shotViewMode === 'list' ? (
                      /* ===== 列表视图（表格化详细展示） ===== */
                      <div className="space-y-1">
                        {/* 表头 */}
                        <div className="grid grid-cols-[32px_1fr_1fr_1fr_auto] gap-2 px-2 py-1 text-[9px] font-bold text-foreground/40 border-b border-border/30">
                          <span>#</span>
                          <span>名称</span>
                          <span>描述</span>
                          <span>提示词</span>
                          <span>操作</span>
                        </div>
                        {cards.map((card, idx) => (
                          <div
                            key={card.id}
                            className={`grid grid-cols-[32px_1fr_1fr_1fr_auto] gap-2 px-2 py-1.5 items-center text-[10px] border-l-2 rounded hover:bg-accent/20 transition-colors ${selectedCardId === card.id ? 'bg-primary/5 border-l-primary' : ''}`}
                            style={{ borderLeftColor: type === 'character' ? '#f97316' : type === 'scene' ? '#3b82f6' : type === 'prop' ? '#a855f7' : '#22c55e' }}
                            onClick={() => setSelectedCardId(card.id)}
                          >
                            {/* 序号+缩略图 */}
                            <div className="flex items-center gap-1">
                              <span className="text-foreground/30 font-mono">{idx + 1}</span>
                              {card.imageUrl && <img src={card.imageUrl} alt="" className="w-5 h-5 rounded object-cover" />}
                            </div>
                            {/* 名称+元数据标签 */}
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                <span className={`px-1 py-0 rounded text-[7px] font-bold ${cfg.color}`}>
                                  <Icon className="w-2 h-2 inline" />
                                </span>
                                <EditableField cardId={card.id} field="name" value={card.name} className="font-medium text-foreground/80" />
                              </div>
                              {/* 类型特定标签 */}
                              {card.type === 'shot' && (
                                <div className="flex flex-wrap gap-0.5">
                                  {card.shotType && <span className="text-[7px] px-0.5 bg-emerald-500/10 text-emerald-400">{card.shotType}</span>}
                                  {card.cameraAngle && <span className="text-[7px] px-0.5 bg-blue-500/10 text-blue-400">{card.cameraAngle}</span>}
                                  {card.cameraMovement && <span className="text-[7px] px-0.5 bg-violet-500/10 text-violet-400">{card.cameraMovement}</span>}
                                  {card.duration && <span className="text-[7px] px-0.5 bg-amber-500/10 text-amber-400">{card.duration}s</span>}
                                  {card.emotionIntensity && <span className="text-[7px] px-0.5 bg-rose-500/10 text-rose-400">情感{card.emotionIntensity}</span>}
                                  {card.soundDesign && <span className="text-[7px] px-0.5 bg-teal-500/10 text-teal-400 truncate max-w-[60px]">{card.soundDesign}</span>}
                                </div>
                              )}
                              {card.type === 'character' && (
                                <div className="flex flex-wrap gap-0.5">
                                  {card.age && <span className="text-[7px] px-0.5 bg-orange-500/10 text-orange-400">{card.age}</span>}
                                  {card.gender && <span className="text-[7px] px-0.5 bg-orange-500/10 text-orange-400">{card.gender}</span>}
                                  {card.characterArc && <span className="text-[7px] px-0.5 bg-amber-500/10 text-amber-400 truncate max-w-[80px]">{renderSafe(card.characterArc)}</span>}
                                </div>
                              )}
                              {card.type === 'scene' && (
                                <div className="flex flex-wrap gap-0.5">
                                  {card.location && <span className="text-[7px] px-0.5 bg-blue-500/10 text-blue-400 truncate max-w-[60px]">{card.location}</span>}
                                  {card.timeOfDay && <span className="text-[7px] px-0.5 bg-amber-500/10 text-amber-400">{card.timeOfDay}</span>}
                                  {card.mood && <span className="text-[7px] px-0.5 bg-violet-500/10 text-violet-400 truncate max-w-[60px]">{card.mood}</span>}
                                </div>
                              )}
                            </div>
                            {/* 描述 */}
                            <EditableField cardId={card.id} field="description" value={card.description} multiline className="text-foreground/40 line-clamp-2" />
                            {/* 提示词 */}
                            <div className="space-y-0.5">
                              {card.promptEn && (
                                <EditableField cardId={card.id} field="promptEn" value={card.promptEn} multiline className="text-foreground/30 line-clamp-2" />
                              )}
                              {card.promptVersions && card.promptVersions.length > 0 && (
                                <span className="text-[7px] text-foreground/20">v{card.promptVersions.length}</span>
                              )}
                            </div>
                            {/* 操作按钮 */}
                            <div className="flex items-center gap-1">
                              {!card.imageUrl ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!card.isPromptGenerated) {
                                      handleGeneratePrompt(card.id).then(() => handleGenerateImage(card.id));
                                    } else {
                                      handleGenerateImage(card.id);
                                    }
                                  }}
                                  className="p-1 rounded hover:bg-primary/10 text-primary"
                                  title="生成画面"
                                >
                                  <ImagePlus className="w-3 h-3" />
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setWsPreviewUrl(card.imageUrl!); }}
                                    className="p-1 rounded hover:bg-primary/10 text-foreground/40"
                                    title="预览"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleGenerateImage(card.id); }}
                                    className="p-1 rounded hover:bg-primary/10 text-foreground/40"
                                    title="重新生成"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                              {card.type === 'character' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setWardrobeDialogCardId(card.id); }}
                                  className="p-1 rounded hover:bg-primary/10 text-foreground/30"
                                  title="衣橱"
                                >
                                  <Palette className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* ===== 卡片视图（2列视觉卡片） ===== */
                      <div className={`grid gap-2 ${type === 'shot' ? 'grid-cols-2' : 'grid-cols-2'}`}>
                        {cards.map(card => (
                        <div
                          key={card.id}
                          className="rounded-xl overflow-hidden border border-border/50 bg-accent/5 hover:border-primary/20 transition-all border-l-2"
                          style={{ borderLeftColor: type === 'character' ? '#f97316' : type === 'scene' ? '#3b82f6' : type === 'prop' ? '#a855f7' : '#22c55e' }}
                        >
                          {/* 图片预览 */}
                          <div className="aspect-video bg-accent/20 relative flex items-center justify-center">
                            {/* 类型色带 + 名称标识（始终显示） */}
                            <div className="absolute top-0 left-0 right-0 flex items-center gap-1.5 px-2 py-1 bg-gradient-to-b from-black/40 to-transparent z-10">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold leading-tight ${cfg.color}`}>
                                <Icon className="w-2.5 h-2.5 inline mr-0.5" />
                                {card.name}
                              </span>
                            </div>
                            {card.imageUrl ? (
                              <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                            ) : card.isGenerating ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                <span className="text-[10px] text-foreground/40">生成中...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-foreground/20">
                                <ImageIcon className="w-6 h-6" />
                                <button
                                  onClick={() => {
                                    if (!card.isPromptGenerated) {
                                      handleGeneratePrompt(card.id).then(() => handleGenerateImage(card.id));
                                    } else {
                                      handleGenerateImage(card.id);
                                    }
                                  }}
                                  className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1"
                                >
                                  <ImagePlus className="w-3 h-3" /> 生成画面
                                </button>
                              </div>
                            )}
                            {/* 重新生成按钮 */}
                            {card.imageUrl && !card.isGenerating && (
                              <button
                                onClick={() => handleGenerateImage(card.id)}
                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-all"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          {/* 卡片信息（可编辑） */}
                          <div className="p-2 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <EditableField cardId={card.id} field="name" value={card.name} className="font-medium text-[11px] text-foreground/80" />
                              {/* 衣橱按钮（仅角色） */}
                              {card.type === 'character' && (
                                <button
                                  onClick={() => setWardrobeDialogCardId(card.id)}
                                  className="p-1 rounded hover:bg-primary/10 text-foreground/30 hover:text-primary transition-colors"
                                  title="衣橱管理"
                                >
                                  <Palette className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            {/* 镜头元数据标签行 */}
                            {card.type === 'shot' && (
                              <div className="flex flex-wrap gap-1">
                                {card.shotType && <span className="text-[8px] px-1 py-0 rounded bg-emerald-500/10 text-emerald-400">{card.shotType}</span>}
                                {card.cameraAngle && <span className="text-[8px] px-1 py-0 rounded bg-blue-500/10 text-blue-400">{card.cameraAngle}</span>}
                                {card.cameraMovement && <span className="text-[8px] px-1 py-0 rounded bg-violet-500/10 text-violet-400">{card.cameraMovement}</span>}
                                {card.duration && <span className="text-[8px] px-1 py-0 rounded bg-amber-500/10 text-amber-400">{card.duration}s</span>}
                                {card.emotionIntensity && <span className="text-[8px] px-1 py-0 rounded bg-rose-500/10 text-rose-400">情感{card.emotionIntensity}/10</span>}
                                {card.colorNarrative && <span className="text-[8px] px-1 py-0 rounded bg-pink-500/10 text-pink-400 truncate max-w-[80px]">{card.colorNarrative}</span>}
                              </div>
                            )}
                            {/* 角色元数据标签行 */}
                            {card.type === 'character' && (
                              <div className="flex flex-wrap gap-1">
                                {card.age && <span className="text-[8px] px-1 py-0 rounded bg-orange-500/10 text-orange-400">{card.age}</span>}
                                {card.gender && <span className="text-[8px] px-1 py-0 rounded bg-orange-500/10 text-orange-400">{card.gender}</span>}
                                {card.characterArc && <span className="text-[8px] px-1 py-0 rounded bg-amber-500/10 text-amber-400 truncate max-w-[100px]">{card.characterArc}</span>}
                              </div>
                            )}
                            {/* 场景元数据标签行 */}
                            {card.type === 'scene' && (
                              <div className="flex flex-wrap gap-1">
                                {card.location && <span className="text-[8px] px-1 py-0 rounded bg-blue-500/10 text-blue-400 truncate max-w-[80px]">{card.location}</span>}
                                {card.timeOfDay && <span className="text-[8px] px-1 py-0 rounded bg-amber-500/10 text-amber-400">{card.timeOfDay}</span>}
                                {card.mood && <span className="text-[8px] px-1 py-0 rounded bg-violet-500/10 text-violet-400 truncate max-w-[80px]">{card.mood}</span>}
                                {card.atmosphere && <span className="text-[8px] px-1 py-0 rounded bg-cyan-500/10 text-cyan-400 truncate max-w-[80px]">{card.atmosphere}</span>}
                              </div>
                            )}
                            <EditableField cardId={card.id} field="description" value={card.description} multiline className="text-[10px] text-foreground/40" />
                            {card.promptEn && (
                              <div className="flex items-center gap-1">
                                <EditableField cardId={card.id} field="promptEn" value={card.promptEn} multiline className="mt-1 text-[9px] text-foreground/30 flex-1" />
                                {/* 版本数标记 */}
                                {card.promptVersions && card.promptVersions.length > 0 && (
                                  <span className="text-[8px] text-foreground/20 flex-shrink-0" title={`${card.promptVersions.length}个历史版本`}>
                                    v{card.promptVersions.length}
                                  </span>
                                )}
                              </div>
                            )}
                            {/* 衣橱造型缩略图（仅角色） */}
                            {card.type === 'character' && card.wardrobeOutfits && card.wardrobeOutfits.length > 0 && (
                              <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-border/20">
                                <span className="text-[8px] text-foreground/25">造型:</span>
                                {card.wardrobeOutfits.map((outfit, oi) => (
                                  <button
                                    key={oi}
                                    onClick={() => handleSwitchOutfit(card.id, oi)}
                                    className={`w-6 h-6 rounded overflow-hidden border transition-all ${
                                      card.activeOutfitIndex === oi ? 'border-[#EF4444] ring-1 ring-[#EF4444]/30' : 'border-border/30 hover:border-primary/40'
                                    }`}
                                    title={outfit.name}
                                  >
                                    {outfit.imageUrl ? (
                                      <img src={outfit.imageUrl} alt={outfit.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-accent/20 flex items-center justify-center text-[6px] text-foreground/20">{outfit.name[0]}</div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    )}
                  </FilmVisualCardSection>
                );
              })}
              </div>{/* end scrollable content */}
            </div>
          )}

          {/* ===== 阶段3：视频合成 ===== */}
          {phase === 'compose' && (
            <div className="flex-1 flex flex-col min-h-0">
              <FilmComposeStageHeader
                completedShots={entityCards.filter(c => c.type === 'shot' && c.imageUrl && !c.isGenerating).length}
                totalShots={entityCards.filter(c => c.type === 'shot').length}
                generatingShots={entityCards.filter(c => c.type === 'shot' && c.isGenerating).length}
                waitingShots={entityCards.filter(c => c.type === 'shot' && !c.imageUrl && !c.isGenerating).length}
                isGenerating={isGenerating}
                hasHistory={filmHistory.length > 0}
                showLogPanel={showLogPanel}
                onBackToVisual={() => setPhase('visual')}
                onBatchGenerateFrames={handleBatchGenerateFrames}
                onOpenHistory={() => setShowHistoryPanel(true)}
                onToggleLogPanel={() => setShowLogPanel((v: boolean) => !v)}
              />

              {/* AI 状态指示 */}
              {middleAiStatus && (
                <div className="flex-shrink-0 mx-6 mb-3 px-4 py-3 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 rounded-xl border border-red-100 dark:border-red-900/30">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${middleAiStatus.type === 'error' ? 'text-destructive' : middleAiStatus.type === 'done' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>{middleAiStatus.text}</p>
                  </div>
                </div>
              )}

              <FilmComposeShotList
                shotCards={entityCards.filter(c => c.type === 'shot')}
                expandedShotIds={expandedShotIds}
                composeProgress={composeProgress}
                finalVideoUrl={finalVideoUrl}
                isGenerating={isGenerating}
            onToggleShotExpanded={(cardId: string) => {
                  const next = new Set(expandedShotIds);
                  if (next.has(cardId)) next.delete(cardId); else next.add(cardId);
                  setExpandedShotIds(next);
                }}
                onGenerateStartFrame={handleGenerateStartFrame}
                onGenerateEndFrame={handleGenerateEndFrame}
                onGenerateShotVideo={handleGenerateShotVideo}
                onRegenerateVideo={handleRegenerateVideo}
                onRecomposeFinalVideo={() => {
                  setComposeStatus('idle');
                  setFinalVideoUrl(null);
                  setTimeout(() => handleComposeFilm(), 50);
                }}
              />

              {/* 浮动对话栏（与规划/画面阶段格式一致） */}
              <div className="sticky bottom-0 left-0 right-0 z-10">
                <div className="bg-card/90 dark:bg-card/90 backdrop-blur-xl border-t border-border/30 px-4 pt-3 pb-3 space-y-2">
                  {/* 对话消息区 */}
                  {chatMessages.length > 0 && (
                    <div className="space-y-1">
                      <button
                        onClick={() => setShowChatMessages(!showChatMessages)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
                      >
                        {showChatMessages ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                        {showChatMessages ? '收起对话' : `${chatMessages.length}条对话`}
                      </button>
                      {showChatMessages && (
                        <div className="overflow-y-auto px-2 py-1 space-y-1.5 max-h-[25vh] bg-secondary/30 rounded-xl border border-border/30">
                          {chatMessages.map(m => <FilmChatMessage key={m.id} msg={m} onQuickOption={(opt) => { setChatInput(opt); setTimeout(() => handleSendChat(), 50); }} entityCards={entityCards} script={script} />)}
                        </div>
                      )}
                    </div>
                  )}
                  {/* 快捷命令行 */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => handleQuickCmd('generate_script')} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary dark:bg-accent/50 text-[11px] text-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors">
                      <FileText className="w-3 h-3" />生成脚本
                    </button>
                    <button onClick={() => handleQuickCmd('enhance_character')} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary dark:bg-accent/50 text-[11px] text-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors">
                      <Users className="w-3 h-3" />增强角色
                    </button>
                    <button onClick={() => handleQuickCmd('batch_generate')} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary dark:bg-accent/50 text-[11px] text-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors">
                      <LayoutGrid className="w-3 h-3" />批量生成
                    </button>
                    <button onClick={() => handleQuickCmd('compose_video')} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary dark:bg-accent/50 text-[11px] text-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors">
                      <Film className="w-3 h-3" />合成视频
                    </button>
                  </div>
                  {/* 输入行 */}
                  <div className={`flex items-center gap-2 bg-accent/20 dark:bg-accent/20 rounded-xl border px-3 py-2 transition-all duration-300 ${chatInputHighlight ? 'border-primary ring-2 ring-primary/30' : 'border-border/50'}`}>
                    <input
                      ref={chatInputRef}
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                      placeholder={chatPlaceholder}
                      className="flex-1 bg-transparent outline-none text-sm text-foreground/90 placeholder:text-muted-foreground"
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-md hover:bg-accent/30 transition-colors" title="上传附件">
                      <Paperclip className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => {
                        if (script) {
                          setChatInput((prev: string) => prev + (prev ? '\n' : '') + `[脚本: ${script.title || '创作规划'}]`);
                        } else if (inputText.trim()) {
                          setChatInput((prev: string) => prev + (prev ? '\n' : '') + `[创意: ${inputText.slice(0, 50)}]`);
                        }
                      }}
                      className="p-1.5 rounded-md hover:bg-accent/30 transition-colors"
                      title="插入脚本引用"
                    >
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={handleSendChat}
                      disabled={!chatInput.trim() || isChatStreaming}
                      className="w-7 h-7 rounded-full bg-primary hover:bg-primary/80 flex items-center justify-center text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isChatStreaming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    </button>
                  </div>
                  {/* 上传文件预览 */}
                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {uploadedFiles.map(f => (
                        <div key={f.id} className="relative group flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-secondary/50 text-[10px] max-w-[120px]">
                          {f.type === 'image' && f.localPreview ? (
                            <img src={f.localPreview} alt={f.name} className="w-4 h-4 rounded object-cover flex-shrink-0" />
                          ) : f.type === 'video' ? (
                            <Video className="w-3 h-3 text-red-400 flex-shrink-0" />
                          ) : (
                            <FileText className="w-3 h-3 text-red-400 flex-shrink-0" />
                          )}
                          <span className="truncate text-foreground/70">{f.name}</span>
                          {f.uploading && <Loader2 className="w-2.5 h-2.5 animate-spin text-foreground/40 flex-shrink-0" />}
                          <button
                            onClick={() => setUploadedFiles((prev: UploadedFileItem[]) => prev.filter((x: UploadedFileItem) => x.id !== f.id))}
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                          >
                            <X className="w-2.5 h-2.5 text-foreground/40 hover:text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== 对话栏（规划/画面阶段底部） ===== */}
        {phase !== 'compose' && (
        <div className="flex-shrink-0 bg-card/90 dark:bg-card/90 flex flex-col" style={{ maxHeight: '40vh' }}>
          {/* 对话消息区 + 快捷命令行 */}
          {chatMessages.length > 0 && (
            <div className="px-3 pt-2 space-y-0">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowChatMessages(!showChatMessages)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showChatMessages ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                  {showChatMessages ? '收起对话' : `${chatMessages.length}条对话`}
                </button>
              </div>
              {showChatMessages && (
            <div className="overflow-y-auto px-2 py-1 space-y-1.5 flex-1 min-h-0" style={{ maxHeight: '22vh' }}>
              {chatMessages.map(m => <FilmChatMessage key={m.id} msg={m} onQuickOption={(opt) => { setChatInput(opt); setTimeout(() => handleSendChat(), 50); }} entityCards={entityCards} script={script} />)}
              <div ref={chatEndRef} />
            </div>
              )}
            </div>
          )}
          {/* 快捷命令行 + 输入行 */}
          <div className="flex-shrink-0 px-3 py-2 space-y-2">
          {/* 快捷命令行 - 与对话计数同行 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {phase === 'planning' && (
              <>
                <button onClick={() => handleQuickCmd('generate_script')} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary dark:bg-accent/50 text-[11px] text-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors">
                  <FileText className="w-3 h-3" />生成脚本
                </button>
                <button onClick={() => handleQuickCmd('enhance_character')} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary dark:bg-accent/50 text-[11px] text-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors">
                  <Users className="w-3 h-3" />增强角色
                </button>
                <button onClick={() => handleQuickCmd('enhance_scene')} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary dark:bg-accent/50 text-[11px] text-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors">
                  <Mountain className="w-3 h-3" />增强场景
                </button>
                <button onClick={() => handleQuickCmd('generate_props')} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary dark:bg-accent/50 text-[11px] text-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors">
                  <Package className="w-3 h-3" />提取道具
                </button>
              </>
            )}
            {phase === 'visual' && (
              <>
                <button onClick={() => handleQuickCmd('batch_generate')} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary dark:bg-accent/50 text-[11px] text-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors">
                  <LayoutGrid className="w-3 h-3" />批量生成
                </button>
                <button onClick={() => handleQuickCmd('generate_start_frame')} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary dark:bg-accent/50 text-[11px] text-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors">
                  <ImageIcon className="w-3 h-3" />生成起始帧
                </button>
                <button onClick={() => handleQuickCmd('extend_prompt')} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary dark:bg-accent/50 text-[11px] text-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors">
                  <Wand2 className="w-3 h-3" />提示词扩展
                </button>
                <button onClick={() => handleQuickCmd('compose_video')} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary dark:bg-accent/50 text-[11px] text-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors">
                  <Film className="w-3 h-3" />合成视频
                </button>
              </>
            )}
          </div>
          {/* 输入行 */}
          <div className={`flex items-center gap-2 bg-accent/20 dark:bg-accent/30 rounded-xl px-4 py-2.5 border transition-all duration-300 ${chatInputHighlight ? 'border-primary ring-2 ring-primary/30' : 'border-border/50'}`}>
            <input
              ref={chatInputRef}
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              placeholder={chatPlaceholder}
              className="flex-1 bg-transparent outline-none text-sm text-foreground/80 placeholder:text-foreground/30"
            />
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* 附件 */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,video/*,.pdf,.txt,.doc,.docx"
                onChange={e => { if (e.target.files) handleFileUpload(e.target.files); e.target.value = ''; }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-lg text-foreground/30 hover:text-primary hover:bg-primary/10 transition-colors"
                title="上传附件"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              {/* 插入脚本 */}
              <button
                onClick={() => {
                  if (script) {
                    setChatInput((prev: string) => prev + (prev ? '\n' : '') + `[脚本: ${script.title || '创作规划'}]`);
                  } else if (inputText.trim()) {
                    setChatInput((prev: string) => prev + (prev ? '\n' : '') + `[创意: ${inputText.slice(0, 50)}]`);
                  }
                }}
                className="p-1.5 rounded-lg text-foreground/30 hover:text-primary hover:bg-primary/10 transition-colors"
                title="插入脚本"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
              {/* 红色发送按钮 */}
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim() || isChatStreaming}
                className="w-7 h-7 rounded-full bg-[#EF4444] flex items-center justify-center text-white hover:bg-[#EF4444]/80 transition-all disabled:opacity-40"
              >
                {isChatStreaming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              </button>
            </div>
            </div>
          </div>
          {/* 上传文件预览 */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {uploadedFiles.map(f => (
                <div key={f.id} className="relative group flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-secondary/50 text-[10px] max-w-[120px]">
                  {f.type === 'image' && f.localPreview ? (
                    <img src={f.localPreview} alt={f.name} className="w-4 h-4 rounded object-cover flex-shrink-0" />
                  ) : f.type === 'video' ? (
                    <Video className="w-3 h-3 text-red-400 flex-shrink-0" />
                  ) : (
                    <FileText className="w-3 h-3 text-red-400 flex-shrink-0" />
                  )}
                  <span className="truncate text-foreground/70">{f.name}</span>
                  {f.uploading && <Loader2 className="w-2.5 h-2.5 animate-spin text-foreground/40 flex-shrink-0" />}
                  <button
                    onClick={() => setUploadedFiles((prev: UploadedFileItem[]) => prev.filter((x: UploadedFileItem) => x.id !== f.id))}
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                  >
                    <X className="w-2.5 h-2.5 text-foreground/40 hover:text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>
    </>

  );
}
