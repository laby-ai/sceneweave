"use client";

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Box, Check, CheckCircle2, Clapperboard, FileDown, FileText, Film, History, ImagePlus,
  Images, LayoutGrid, Loader2, Mountain, Palette, PenLine, Plus,
  Trash2, Type, UserCircle, Users, Video, X,
} from 'lucide-react';
import type { FilmScript } from '@/types/film';
import type { FilmHistoryItem, EntityCardSnapshot } from '@/hooks/useFilmHistory';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WardrobeAddForm } from '@/components/film/film-creation-chat';
import type { EntityCard, WorkflowPhase } from '@/lib/film-creation-panel-model';

type WorkflowMessageRole = 'system' | 'assistant' | 'user' | 'info' | 'success' | 'error';
type WorkflowMessageType = 'progress' | 'success' | 'error' | 'info';

type FilmCreationDialogsProps = Record<string, any> & {
  addWorkflowMsg: (role: WorkflowMessageRole, content: string, step?: string, msgType?: WorkflowMessageType, nextStep?: string) => void;
  clearFilmHistory: () => void;
  deleteFilmHistory: (id: string) => void;
  entityCards: EntityCard[];
  filmHistory: FilmHistoryItem[];
  handleAddWardrobeOutfit: (cardId: string, outfit: { name: string; description: string }) => void;
  handleExportPDF: () => void;
  handleGenerateNineGrid: (cardId: string) => void | Promise<void>;
  handleGenerateOutfitImage: (cardId: string, outfitIndex: number) => void | Promise<void>;
  handleNewConversation: () => void;
  handleRollbackPrompt: (cardId: string, versionIndex: number) => void;
  handleSelectNineGridImage: (cardId: string, index: number) => void;
  handleSwitchOutfit: (cardId: string, outfitIndex: number) => void;
  nineGridDialogCardId: string | null;
  previewImageUrl: string | null;
  promptManagerOpen: boolean;
  script: FilmScript | null;
  setEntityCards: React.Dispatch<React.SetStateAction<EntityCard[]>>;
  setFilmVisualStyle: (style: string) => void;
  setNineGridDialogCardId: (id: string | null) => void;
  setPhase: (phase: WorkflowPhase) => void;
  setPreviewImageUrl: (url: string | null) => void;
  setPromptManagerOpen: (open: boolean) => void;
  setScript: (script: FilmScript | null) => void;
  setShowHistoryPanel: (open: boolean) => void;
  setShowScriptPreview: (open: boolean) => void;
  setWardrobeDialogCardId: (id: string | null) => void;
  setWsPreviewUrl: (url: string | null) => void;
  showHistoryPanel: boolean;
  showScriptPreview: boolean;
  stats: Record<string, number>;
  typeConfig: Record<string, { label: string; color: string; icon: LucideIcon }>;
  wardrobeDialogCardId: string | null;
  wsPreviewUrl: string | null;
};

export function FilmCreationDialogs(props: FilmCreationDialogsProps) {
  const {
    addWorkflowMsg, clearFilmHistory, deleteFilmHistory, entityCards, filmHistory,
    handleAddWardrobeOutfit, handleExportPDF, handleGenerateNineGrid, handleGenerateOutfitImage,
    handleNewConversation, handleRollbackPrompt, handleSelectNineGridImage, handleSwitchOutfit,
    nineGridDialogCardId, previewImageUrl, promptManagerOpen, script, setEntityCards,
    setFilmVisualStyle, setNineGridDialogCardId, setPhase, setPreviewImageUrl,
    setPromptManagerOpen, setScript, setShowHistoryPanel, setShowScriptPreview,
    setWardrobeDialogCardId, setWsPreviewUrl, showHistoryPanel, showScriptPreview,
    stats, typeConfig, wardrobeDialogCardId, wsPreviewUrl,
  } = props;

  return (
    <>
      {/* ===== 剧本预览弹窗 ===== */}
      <Dialog open={showScriptPreview} onOpenChange={setShowScriptPreview}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#EF4444]" />
              {script?.title || '创作规划'} - 剧本预览
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {/* 基本信息 */}
            {(script?.narrationScript || script?.style || script?.contentType) && (
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <h4 className="text-sm font-semibold text-foreground/90 mb-2 flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-[#EF4444]" /> 基本信息
                </h4>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {script?.contentType && <div><span className="text-foreground/40">类型：</span><span className="text-foreground/80">{script.contentType}</span></div>}
                  {script?.style && <div><span className="text-foreground/40">风格：</span><span className="text-foreground/80">{script.style}</span></div>}
                  <div><span className="text-foreground/40">总元素：</span><span className="text-foreground/80">{stats.characters}人物 · {stats.scenes}场景 · {entityCards.filter(c => c.type === 'prop').length}道具 · {stats.shots}分镜</span></div>
                </div>
                {script?.narrationScript && <p className="text-xs text-foreground/60 mt-2 leading-relaxed whitespace-pre-line">{script.narrationScript}</p>}
              </div>
            )}

            {/* 剧情概述 */}
            {entityCards.filter(c => c.type === 'plot').map(card => (
              <div key={card.id} className="bg-card rounded-xl p-4 border border-border/50">
                <h4 className="text-sm font-semibold text-foreground/90 mb-2 flex items-center gap-1.5">
                  <Type className="w-4 h-4 text-[#EF4444]" /> 剧情概述
                </h4>
                <p className="text-xs text-foreground/70 leading-relaxed whitespace-pre-line">{card.promptCn || card.description}</p>
              </div>
            ))}

            {/* 角色列表 */}
            {entityCards.filter(c => c.type === 'character').length > 0 && (
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <h4 className="text-sm font-semibold text-foreground/90 mb-3 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#EF4444]" /> 角色设定
                </h4>
                <div className="space-y-3">
                  {entityCards.filter(c => c.type === 'character').map(card => (
                    <div key={card.id} className="bg-accent/5 rounded-lg p-3 border border-border/30">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-semibold text-xs text-foreground/90">{card.name}</span>
                        {card.gender && <span className="text-[10px] text-foreground/40">{card.gender}</span>}
                        {card.age && <span className="text-[10px] text-foreground/40">{card.age}</span>}
                        {card.imageUrl && <CheckCircle2 className="w-3 h-3 text-red-500" />}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        {card.appearance && <div><span className="text-foreground/40">外貌：</span><span className="text-foreground/70">{card.appearance}</span></div>}
                        {card.personality && <div><span className="text-foreground/40">性格：</span><span className="text-foreground/70">{card.personality}</span></div>}
                        {card.outfit && <div><span className="text-foreground/40">服装：</span><span className="text-foreground/70">{card.outfit}</span></div>}
                        {card.promptCn && <div className="col-span-2"><span className="text-foreground/40">提示词：</span><span className="text-foreground/70">{card.promptCn}</span></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 场景列表 */}
            {entityCards.filter(c => c.type === 'scene').length > 0 && (
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <h4 className="text-sm font-semibold text-foreground/90 mb-3 flex items-center gap-1.5">
                  <Mountain className="w-4 h-4 text-[#EF4444]" /> 场景设定
                </h4>
                <div className="space-y-3">
                  {entityCards.filter(c => c.type === 'scene').map(card => (
                    <div key={card.id} className="bg-accent/5 rounded-lg p-3 border border-border/30">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-semibold text-xs text-foreground/90">{card.name}</span>
                        {card.location && <span className="text-[10px] text-foreground/40">{card.location}</span>}
                        {card.timeOfDay && <span className="text-[10px] text-foreground/40">{card.timeOfDay}</span>}
                        {card.imageUrl && <CheckCircle2 className="w-3 h-3 text-red-500" />}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        {card.mood && <div><span className="text-foreground/40">氛围：</span><span className="text-foreground/70">{card.mood}</span></div>}
                        {card.promptCn && <div className="col-span-2"><span className="text-foreground/40">提示词：</span><span className="text-foreground/70">{card.promptCn}</span></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 分镜列表 */}
            {entityCards.filter(c => c.type === 'shot').length > 0 && (
              <div className="bg-card rounded-xl p-4 border border-border/50">
                <h4 className="text-sm font-semibold text-foreground/90 mb-3 flex items-center gap-1.5">
                  <Images className="w-4 h-4 text-[#EF4444]" /> 分镜脚本
                </h4>
                <div className="space-y-2">
                  {entityCards.filter(c => c.type === 'shot').map((card, idx) => (
                    <div key={card.id} className="bg-accent/5 rounded-lg p-3 border border-border/30">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-[#EF4444]/10 text-[#EF4444] text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                        <span className="font-semibold text-xs text-foreground/90">{card.name}</span>
                        {card.shotType && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{card.shotType}</span>}
                        {card.cameraAngle && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">{card.cameraAngle}</span>}
                        {card.imageUrl && <CheckCircle2 className="w-3 h-3 text-red-500" />}
                      </div>
                      <div className="text-[11px] space-y-0.5 pl-7">
                        {card.action && <div><span className="text-foreground/40">动作：</span><span className="text-foreground/70">{card.action}</span></div>}
                        {card.dialogue && <div><span className="text-foreground/40">对白：</span><span className="text-foreground/80 italic">"{card.dialogue}"</span></div>}
                        {card.narration && <div><span className="text-foreground/40">旁白：</span><span className="text-foreground/60 italic">〔{card.narration}〕</span></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 底部操作栏 */}
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <span className="text-[10px] text-foreground/30">
              {entityCards.length} 个元素 · 生成于 {new Date().toLocaleDateString()}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowScriptPreview(false); handleExportPDF(); }}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[#EF4444] text-white text-xs font-medium hover:bg-[#DC2626] transition-all"
              >
                <FileDown className="w-3.5 h-3.5" /> 导出PDF
              </button>
              <button
                onClick={() => setShowScriptPreview(false)}
                className="px-4 py-2 rounded-lg bg-accent text-foreground/70 text-xs font-medium hover:bg-accent/80 transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== 历史记录弹窗 ===== */}
      <Dialog open={showHistoryPanel} onOpenChange={setShowHistoryPanel}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#EF4444]" />
                创作历史记录
              </div>
              <button
                onClick={handleNewConversation}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                新对话
              </button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {filmHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-foreground/30">
                <History className="w-10 h-10 mb-3" />
                <p className="text-sm">暂无创作历史</p>
                <p className="text-xs mt-1">开始创作后，记录将自动保存在这里</p>
                <button
                  onClick={handleNewConversation}
                  className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  开始新对话
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-end">
                  <button
                    onClick={() => { clearFilmHistory(); }}
                    className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> 清空全部
                  </button>
                </div>
                {filmHistory.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/50 p-4 hover:border-primary/20 transition-all cursor-pointer group"
                    onClick={() => {
                      // 恢复历史记录状态
                      if (item.script) {
                        setScript(item.script as unknown as FilmScript | null);
                      }
                      if (item.entityCards) {
                        setEntityCards(item.entityCards as EntityCard[]);
                      }
                      if (item.phase) {
                        setPhase(item.phase);
                      }
                      if (item.filmVisualStyle) {
                        setFilmVisualStyle(item.filmVisualStyle);
                      }
                      setShowHistoryPanel(false);
                      addWorkflowMsg('assistant', `已恢复「${item.title}」的创作状态`, undefined, 'info');
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-foreground/90 truncate">{(item.script as Record<string, unknown>)?.title as string || item.title}</h4>
                        <p className="text-[10px] text-foreground/40 mt-0.5 truncate">{item.prompt}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] text-foreground/30 flex items-center gap-0.5">
                            <UserCircle className="w-3 h-3" /> {item.entityCards?.filter((c: EntityCardSnapshot) => c.type === 'character').length || 0} 人物
                          </span>
                          <span className="text-[10px] text-foreground/30 flex items-center gap-0.5">
                            <Box className="w-3 h-3" /> {item.entityCards?.filter((c: EntityCardSnapshot) => c.type === 'scene').length || 0} 场景
                          </span>
                          <span className="text-[10px] text-foreground/30 flex items-center gap-0.5">
                            <Clapperboard className="w-3 h-3" /> {item.entityCards?.filter((c: EntityCardSnapshot) => c.type === 'shot').length || 0} 分镜
                          </span>
                          {item.imagesGenerated > 0 && (
                            <span className="text-[10px] text-green-500">{item.imagesGenerated}张图</span>
                          )}
                          {item.videosGenerated > 0 && (
                            <span className="text-[10px] text-blue-500">{item.videosGenerated}个视频</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        <span className="text-[10px] text-foreground/30">
                          {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteFilmHistory(item.id); }}
                          className="p-1 rounded hover:bg-red-500/10 text-foreground/20 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* 缩略图预览 */}
                    {item.entityCards?.some((c: EntityCardSnapshot) => c.imageUrl) && (
                      <div className="flex gap-1.5 mt-2 overflow-x-auto">
                        {item.entityCards
                          .filter((c: EntityCardSnapshot) => c.imageUrl)
                          .slice(0, 6)
                          .map((c: EntityCardSnapshot) => (
                            <div key={c.id} className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-accent/20">
                              <img src={c.imageUrl!} alt={c.name} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        {item.entityCards.filter((c: EntityCardSnapshot) => c.imageUrl).length > 6 && (
                          <div className="w-12 h-12 rounded-md bg-accent/20 flex items-center justify-center flex-shrink-0 text-[9px] text-foreground/30">
                            +{item.entityCards.filter((c: EntityCardSnapshot) => c.imageUrl).length - 6}
                          </div>
                        )}
                      </div>
                    )}
                    {/* 阶段标签 */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        item.phase === 'planning' ? 'bg-blue-500/10 text-blue-500' :
                        item.phase === 'visual' ? 'bg-green-500/10 text-green-500' :
                        'bg-purple-500/10 text-purple-500'
                      }`}>
                        {item.phase === 'planning' ? '创作规划' : item.phase === 'visual' ? '画面生成' : '视频合成'}
                      </span>
                      {item.finalVideoUrl && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#EF4444]/10 text-[#EF4444] font-medium flex items-center gap-0.5">
                          <Film className="w-2.5 h-2.5" /> 已完成
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== BigBanana: 衣橱管理弹窗 ===== */}
      <Dialog open={wardrobeDialogCardId !== null} onOpenChange={(open) => { if (!open) setWardrobeDialogCardId(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-[#EF4444]" />
              衣橱管理 — {wardrobeDialogCardId ? entityCards.find(c => c.id === wardrobeDialogCardId)?.name : ''}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const card = entityCards.find(c => c.id === wardrobeDialogCardId);
            if (!card) return null;
            const outfits = card.wardrobeOutfits || [];
            return (
              <div className="space-y-3 py-2">
                <div className="text-[10px] text-foreground/40">
                  为角色管理多套造型，确保不同场景中角色身份一致。切换造型后，后续镜头将自动使用当前造型。
                </div>
                {/* 已有造型列表 */}
                {outfits.length > 0 && (
                  <div className="space-y-2">
                    {outfits.map((outfit, oi) => (
                      <div key={oi} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                        card.activeOutfitIndex === oi ? 'border-[#EF4444]/40 bg-[#EF4444]/5' : 'border-border/50 bg-accent/5 hover:border-primary/20'
                      }`}>
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-accent/20 flex-shrink-0 flex items-center justify-center">
                          {outfit.imageUrl ? (
                            <img src={outfit.imageUrl} alt={outfit.name} className="w-full h-full object-cover" />
                          ) : (
                            <UserCircle className="w-6 h-6 text-foreground/20" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-foreground/80">{outfit.name}</span>
                            {card.activeOutfitIndex === oi && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#EF4444] text-white">当前</span>
                            )}
                          </div>
                          <div className="text-[10px] text-foreground/50 mt-0.5 truncate">{outfit.description}</div>
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          {!outfit.imageUrl && (
                            <button
                              onClick={() => handleGenerateOutfitImage(card.id, oi)}
                              className="text-[9px] text-primary hover:text-primary/80 flex items-center gap-0.5"
                            >
                              <ImagePlus className="w-2.5 h-2.5" />生成图
                            </button>
                          )}
                          {card.activeOutfitIndex !== oi && (
                            <button
                              onClick={() => handleSwitchOutfit(card.id, oi)}
                              className="text-[9px] text-[#EF4444] hover:text-[#EF4444]/80 flex items-center gap-0.5"
                            >
                              <Check className="w-2.5 h-2.5" />切换
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* 添加新造型 */}
                <div className="p-3 rounded-xl border border-dashed border-border/50 bg-accent/5">
                  <WardrobeAddForm cardId={card.id} onAdd={handleAddWardrobeOutfit} />
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ===== BigBanana: 九宫格构图弹窗 ===== */}
      <Dialog open={nineGridDialogCardId !== null} onOpenChange={(open) => { if (!open) setNineGridDialogCardId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-amber-500" />
              九宫格构图 — {nineGridDialogCardId ? entityCards.find(c => c.id === nineGridDialogCardId)?.name : ''}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const card = entityCards.find(c => c.id === nineGridDialogCardId);
            if (!card) return null;
            const gridImages = card.nineGridImages || [];
            const isGenerating = card.nineGridGenerating;
            return (
              <div className="space-y-3 py-2">
                <div className="text-[10px] text-foreground/40">
                  先生成9个候选视角，选择最佳构图作为镜头首帧。不同视角帮你找到最合适的画面构图。
                </div>
                {/* 生成按钮 */}
                <button
                  onClick={() => handleGenerateNineGrid(card.id)}
                  disabled={isGenerating || !card.promptEn}
                  className="w-full py-2.5 rounded-xl bg-amber-500 text-white font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-amber-600 transition-all disabled:opacity-40"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" />}
                  {gridImages.length > 0 ? '重新生成九宫格' : '生成九宫格构图'}
                  {isGenerating && <span className="text-xs">({gridImages.length}/9)</span>}
                </button>
                {/* 九宫格预览 */}
                {gridImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {gridImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectNineGridImage(card.id, i)}
                        className={`aspect-video rounded-xl overflow-hidden border-2 transition-all hover:border-primary hover:scale-[1.02] ${
                          card.nineGridSelectedIndex === i ? 'border-[#EF4444] ring-2 ring-[#EF4444]/30' : 'border-border/30'
                        }`}
                      >
                        <img src={img} alt={`候选${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                    {/* 未生成的格子 */}
                    {Array.from({ length: 9 - gridImages.length }, (_, i) => (
                      <div key={`empty-${i}`} className="aspect-video rounded-xl bg-accent/20 border border-dashed border-border/30 flex items-center justify-center">
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin text-foreground/20" />
                        ) : (
                          <span className="text-[9px] text-foreground/15">待生成</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {card.nineGridSelectedIndex !== undefined && (
                  <div className="text-center text-[10px] text-foreground/40">
                    已选择第 {card.nineGridSelectedIndex + 1} 格作为首帧
                  </div>
                )}
                {/* 提示词预览 */}
                <div className="p-2 rounded-lg bg-accent/10">
                  <div className="text-[9px] text-foreground/30 mb-0.5">当前提示词</div>
                  <div className="text-[10px] text-foreground/50">{card.promptEn || '无提示词'}</div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ===== BigBanana: 提示词管理中心弹窗 ===== */}
      <Dialog open={promptManagerOpen} onOpenChange={setPromptManagerOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-5 h-5 text-[#EF4444]" />
              提示词管理中心
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-[10px] text-foreground/40 mb-2">
              集中查看和管理所有实体的提示词，支持版本回滚。当生成质量不稳定时，可以在这里定位并修正问题。
            </div>
            {/* 按类型分组 */}
            {['character', 'scene', 'prop', 'shot'].map(type => {
              const cards = entityCards.filter(c => c.type === type && (c.promptEn || c.promptCn));
              if (cards.length === 0) return null;
              const cfg = typeConfig[type];
              const Icon = cfg.icon;
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                      <Icon className="w-3 h-3 inline mr-1" />{cfg.label}
                    </span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    {cards.map(card => (
                      <div key={card.id} className="p-2.5 rounded-xl border border-border/50 bg-accent/5">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-foreground/80">{card.name}</span>
                            {card.promptVersions && card.promptVersions.length > 0 && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                {card.promptVersions.length} 个版本
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {card.imageUrl && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                            {card.videoUrl && <Video className="w-3 h-3 text-primary" />}
                          </div>
                        </div>
                        {/* 当前提示词 */}
                        <div className="text-[10px] text-foreground/50 bg-accent/20 rounded p-2 mb-1.5 max-h-[60px] overflow-y-auto">
                          {card.promptEn || card.promptCn || '暂无提示词'}
                        </div>
                        {/* 版本历史 */}
                        {card.promptVersions && card.promptVersions.length > 0 && (
                          <details className="text-[9px]">
                            <summary className="text-foreground/30 cursor-pointer hover:text-foreground/50">查看版本历史</summary>
                            <div className="mt-1 space-y-1">
                              {card.promptVersions.map((v, vi) => (
                                <div key={vi} className="flex items-start gap-2 p-1.5 rounded bg-accent/10 hover:bg-accent/20 transition-colors">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-foreground/40">v{v.version} · {new Date(v.timestamp).toLocaleTimeString()}</div>
                                    <div className="text-foreground/30 truncate">{v.content}</div>
                                  </div>
                                  <button
                                    onClick={() => handleRollbackPrompt(card.id, vi)}
                                    className="text-[8px] text-primary hover:text-primary/80 px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 flex-shrink-0"
                                  >
                                    回滚
                                  </button>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* 资产工坊图片预览 */}
      {wsPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setWsPreviewUrl(null)}>
          <div className="relative max-w-3xl max-h-[80vh]" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <img src={wsPreviewUrl} alt="预览" className="max-w-full max-h-[80vh] rounded-lg" />
            <button onClick={() => setWsPreviewUrl(null)} className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs hover:bg-foreground/80">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 帧预览弹窗 */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-80 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImageUrl}
              alt="帧预览"
              className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
