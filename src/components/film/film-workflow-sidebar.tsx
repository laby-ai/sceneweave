"use client";

import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Box,
  Check,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Combine,
  Copy,
  Eye,
  ExternalLink,
  FileText,
  Film,
  GitMerge,
  Globe,
  Image as ImageIcon,
  Images,
  Loader2,
  Link2,
  Mountain,
  Package,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Subtitles,
  Mic,
  Music,
  Upload,
  Video,
  Volume2,
  Wand2,
  UserCircle,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { getBgmTypeList } from '@/constants/bgm-types';
import type { EntityCard, WorkflowPhase } from '@/lib/film-creation-panel-model';

type SearchResult = {
  id?: string;
  title?: string;
  source?: string;
  url?: string;
  snippet?: string;
  summary?: string;
  imageUrl?: string;
  width?: number;
  height?: number;
};

type MaterialItem = {
  type?: string;
  text?: string;
  content?: string;
  url?: string;
};

type UploadedFileItem = {
  id?: string;
  name?: string;
  type?: string;
  url?: string;
  uploading?: boolean;
};

type FilmWorkflowSidebarProps = Record<string, any> & {
  composeProgress: Record<string, number>;
  entityCards: EntityCard[];
  materials: MaterialItem[];
  searchResults: SearchResult[];
  stats: Record<string, number>;
  uploadedFiles: UploadedFileItem[];
};

export function FilmWorkflowSidebar(props: FilmWorkflowSidebarProps) {
  const {
    addWorkflowMsg, appendSearchRef, assetCardsExpanded, bgmAudioRef, bgmPreviewPlaying, bgmType, bgmVolume, cfgExpand, composeProgress, composeStatus, consistencyChecking, consistencyMode, consistencyResults, consistencySvcExpand, copyrightNotice, customCharStyle, customDuration, customPropStyle, customSceneStyle, customScriptType, enhancePanelOpen, entityCards, expandedPhaseSection, fileInputRef, filmTtsSpeed, formatDuration, generationMode, generationStage, goToPhase, handleBridgeFrames, handleComposeFilm, handleConsistencyCheck, handleEnhanceCharacters, handleEnhanceScenes, handleExtractLastFrame, handleFileUpload, handleFilmSearch, handleGenerateAllAssets, handleGenerateAllVideos, handleGenerateAnchor, handleGenerateEndFrame, handleGenerateImage, handleGenerateProps, handleGenerateShotVideo, handleGenerateStartFrame, handlePlanCreation, handlePreviewBgm, handlePreviewVoice, handleExtendPrompt, inputText, isBridging, isGenerating, isSearching, materialInput, materials, phase, refEntitiesExpanded, script, scriptDirectorRef, scriptScreenplayRef, scriptType, searchQuery, searchResults, searchSummary, searchType, selectedCardId, selectedService, setAssetCardsExpanded, setAutoGenerateAssets, setBgmPreviewPlaying, setBgmType, setBgmVolume, setCfgExpand, setConsistencyMode, setConsistencySvcExpand, setCustomCharStyle, setCustomDuration, setCustomPropStyle, setCustomSceneStyle, setCustomScriptType, setEnhancePanelOpen, setEntityCards, setExpandedPhaseSection, setFilmTtsSpeed, setGenerationMode, setInputText, setMaterialInput, setMaterials, setPhase, setRefEntitiesExpanded, setScript, setScriptType, setSearchQuery, setSearchType, setSelectedCardId, setSelectedService, setSfxType, setSfxVolume, setStoryTab, setTargetDuration, setUploadedFiles, setVideoDuration, setVideoRatio, setVisualStyle, setVoiceType, setWsFilter, setWsPreviewUrl, sfxType, sfxVolume, showSearchResults, stats, storyTab, targetDuration, typeConfig, uploadedFiles, videoDuration, videoRatio, visualStyle, voicePreviewPlaying, voiceType, wsFilter,
  } = props;

  return (
    <>
      {/* ============================================ */}
      {/* 左栏: 三阶段分组服务列表 + ConfigItem */}
      {/* ============================================ */}
      <div className="w-[320px] flex flex-col min-w-0 border-r border-border/70">

        {/* 项目头部（固定区） */}
        <div className="px-3 py-2.5 border-b border-border/70 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                <Film className="w-3 h-3 text-white" />
              </div>
              <span className="text-[12px] font-semibold text-foreground/90 truncate">{script?.title || '未命名剧本'}</span>
            </div>
            <button
              onClick={() => { setScript(null); setEntityCards([]); setPhase('planning'); setExpandedPhaseSection(null); addWorkflowMsg('assistant', '已重置创作流程，可重新开始规划', undefined, 'info'); }}
              className="text-[10px] text-red-500 hover:text-red-600 font-medium flex items-center gap-0.5 transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" />重新规划
            </button>
          </div>
          {/* 阶段Tab */}
          <div className="flex gap-1">
            {([
              { key: 'planning', label: '规划', icon: FileText },
              { key: 'visual', label: '画面', icon: ImageIcon },
              { key: 'compose', label: '合成', icon: Film },
            ] as const).map(tab => {
              const isActive = phase === tab.key;
              const isExpanded = expandedPhaseSection === tab.key;
              // 计算阶段是否完成
              const isCompleted = tab.key === 'planning'
                ? !!script && entityCards.filter(c => c.type === 'character').length > 0 && entityCards.filter(c => c.type === 'scene').length > 0 && entityCards.filter(c => c.type === 'prop').length > 0
                : tab.key === 'visual'
                ? entityCards.filter(c => c.type === 'character').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'character').length > 0
                  && entityCards.filter(c => c.type === 'scene').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'scene').length > 0
                  && entityCards.filter(c => c.type === 'shot').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'shot').length > 0
                : entityCards.filter(c => c.type === 'shot').every(c => c.videoUrl) && entityCards.filter(c => c.type === 'shot').length > 0 && composeStatus === 'completed';
              return (
                <button
                  key={tab.key}
                  className={`flex-1 flex items-center justify-center gap-0.5 py-1.5 text-[10px] rounded-md font-medium transition-all ${
                    isExpanded
                      ? 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30'
                      : isActive
                      ? 'bg-accent/50 text-foreground/70 border border-border/30'
                      : 'text-foreground/40 border border-transparent hover:bg-accent/30'
                  }`}
                  onClick={() => { setExpandedPhaseSection(isExpanded ? null : tab.key); if (!isExpanded) goToPhase(tab.key as WorkflowPhase); }}
                >
                  <tab.icon className="w-2.5 h-2.5" />
                  {tab.label}
                  {isCompleted && <Check className="w-2.5 h-2.5 text-emerald-500" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 可滚动内容区 */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-3 px-2.5 pt-2 pb-2">
          {/* ===== 阶段1·创作规划（卡片式） ===== */}
          <div className="rounded-lg bg-white dark:bg-card shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
            {/* 标题栏 */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors"
              onClick={() => setExpandedPhaseSection(expandedPhaseSection === 'planning' ? null : 'planning')}
            >
              <span className="text-sm font-medium text-[#333] dark:text-foreground/80">阶段1 · 创作规划</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-[#666] dark:text-foreground/40 tabular-nums">
                  {[script ? 1 : 0, entityCards.filter(c => c.type === 'character').length > 0 ? 1 : 0, entityCards.filter(c => c.type === 'scene').length > 0 ? 1 : 0, entityCards.filter(c => c.type === 'prop').length > 0 ? 1 : 0].reduce((a, b) => a + b, 0)}/4
                </span>
                {expandedPhaseSection === 'planning' ? <ChevronUp className="w-3 h-2 text-[#666] dark:text-foreground/30" /> : <ChevronDown className="w-3 h-2 text-[#666] dark:text-foreground/30" />}
              </div>
            </div>
            {/* 子任务列表 */}
            {expandedPhaseSection === 'planning' && (
              <div className="px-4 pb-4 space-y-0 border-t border-[#F0F0F0] dark:border-border/20 pt-3">
                {/* 分镜剧本 */}
                <div>
                  <div
                    className="flex items-center gap-3 h-10 cursor-pointer rounded-md hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors -mx-1 px-1"
                    onClick={() => { setSelectedService('storyboard_script'); setCfgExpand(cfgExpand === 'storyboard_script' ? null : 'storyboard_script'); }}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${script ? 'bg-[#E6F7ED]' : 'bg-[#E6F7ED]'}`}>
                      {script ? <Check className="w-4 h-4 text-[#36B37E]" /> : <FileText className="w-4 h-4 text-[#36B37E]" />}
                    </div>
                    <span className={`text-[13px] flex-1 ${script ? 'text-[#999] line-through' : 'text-[#333] dark:text-foreground/70'}`}>分镜剧本</span>
                    {script && <Check className="w-4 h-4 text-[#36B37E]" />}
                    {!script && <span className="text-[11px] text-[#999]">未开始</span>}
                    <ChevronDown className={`w-3 h-3 text-[#999] transition-transform ${cfgExpand === 'storyboard_script' ? 'rotate-180' : ''}`} />
                  </div>
                  {cfgExpand === 'storyboard_script' && (
                    <div className="ml-12 mr-2 mb-2 space-y-3 py-2">
                      <div>
                        <div className="text-[11px] text-[#999] mb-2 font-medium">剧本类型</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['短剧剧本', '电影剧本', '广告剧本', 'MV剧本'].map(s => (
                            <button key={s} onClick={() => { setScriptType(s); setCustomScriptType(''); }}
                              className={`text-[11px] px-3 py-2 rounded-md transition-all ${scriptType === s && !customScriptType ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20'}`}>{s}</button>
                          ))}
                          <div className="relative">
                            <input
                              type="text"
                              value={customScriptType}
                              onChange={e => { setCustomScriptType(e.target.value); if (e.target.value) setScriptType(e.target.value); }}
                              placeholder="自定义..."
                              className="text-[11px] px-3 py-2 rounded-md bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20 focus:border-[#FF5630] focus:outline-none w-24 transition-colors"
                            />
                            {customScriptType && (
                              <button onClick={() => { setCustomScriptType(''); setScriptType('短剧剧本'); }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#CCC] hover:text-[#999]">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#999] mb-2 font-medium">目标时长 <span className="text-[#CCC]">(~{Math.ceil(targetDuration / videoDuration)}镜头@{videoDuration}s)</span></div>
                        <div className="flex flex-wrap gap-1.5">
                          {[30, 60, 120, 180, 300, 600].map(d => (
                            <button key={d} onClick={() => { setTargetDuration(d); setCustomDuration(''); }}
                              className={`text-[11px] px-3 py-2 rounded-md transition-all ${targetDuration === d && !customDuration ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20'}`}>{d < 60 ? `${d}s` : `${d/60}min`}</button>
                          ))}
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              value={customDuration}
                              onChange={e => { const v = e.target.value; setCustomDuration(v); if (v) setTargetDuration(parseInt(v) || 30); }}
                              placeholder="自定义s"
                              className="text-[11px] px-3 py-2 rounded-md bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20 focus:border-[#FF5630] focus:outline-none w-20 transition-colors"
                            />
                            {customDuration && (
                              <button onClick={() => { setCustomDuration(''); setTargetDuration(60); }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#CCC] hover:text-[#999]">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => { const el = document.getElementById('film-story-area'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-[#EF4444]/60 hover:text-[#EF4444] bg-[#FFF5F5]/50 hover:bg-[#FFF5F5] rounded-md transition-all"
                      >
                        <FileText className="w-3 h-3" /> 前往故事区域 ↓
                      </button>
                    </div>
                  )}
                </div>
                {/* 人物设定 */}
                <div>
                  <div
                    className="flex items-center gap-3 h-10 cursor-pointer rounded-md hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors -mx-1 px-1"
                    onClick={() => { setSelectedService('character_prompt'); setCfgExpand(cfgExpand === 'character_prompt' ? null : 'character_prompt'); }}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#FFEBE6] flex items-center justify-center flex-shrink-0">
                      {entityCards.filter(c => c.type === 'character').length > 0 ? <Check className="w-4 h-4 text-[#FF5630]" /> : <UserCircle className="w-4 h-4 text-[#FF5630]" />}
                    </div>
                    <span className={`text-[13px] flex-1 ${entityCards.filter(c => c.type === 'character').length > 0 ? 'text-[#999] line-through' : 'text-[#333] dark:text-foreground/70'}`}>人物设定</span>
                    {entityCards.filter(c => c.type === 'character').length > 0 && <Check className="w-4 h-4 text-[#36B37E]" />}
                    {entityCards.filter(c => c.type === 'character').length === 0 && <span className="text-[11px] text-[#999]">未开始</span>}
                    <ChevronDown className={`w-3 h-3 text-[#999] transition-transform ${cfgExpand === 'character_prompt' ? 'rotate-180' : ''}`} />
                  </div>
                  {cfgExpand === 'character_prompt' && (
                    <div className="ml-12 mr-2 mb-2 space-y-3 py-2">
                      <div>
                        <div className="text-[11px] text-[#999] mb-2 font-medium">人物风格</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['真人写实', '二次元', '3D角色', '水墨人物'].map(s => (
                            <button key={s} onClick={() => { setVisualStyle(s); setCustomCharStyle(''); }}
                              className={`text-[11px] px-3 py-2 rounded-md transition-all ${visualStyle === s && !customCharStyle ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20'}`}>{s}</button>
                          ))}
                          <div className="relative">
                            <input
                              type="text"
                              value={customCharStyle}
                              onChange={e => { setCustomCharStyle(e.target.value); if (e.target.value) setVisualStyle(e.target.value); }}
                              placeholder="自定义..."
                              className="text-[11px] px-3 py-2 rounded-md bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20 focus:border-[#FF5630] focus:outline-none w-24 transition-colors"
                            />
                            {customCharStyle && (
                              <button onClick={() => { setCustomCharStyle(''); setVisualStyle('真人写实'); }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#CCC] hover:text-[#999]">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {entityCards.filter(c => c.type === 'character').length > 0 && (
                        <div>
                          <div className="text-[11px] text-[#999] mb-2 font-medium">参考人物</div>
                          <div className="grid grid-cols-3 gap-2">
                            {entityCards.filter(c => c.type === 'character').map(c => {
                              const isSelected = selectedCardId === c.id;
                              return (
                                <div
                                  key={c.id}
                                  onClick={() => setSelectedCardId(isSelected ? null : c.id)}
                                  className={`rounded-lg p-1.5 cursor-pointer transition-all text-center ${isSelected ? 'ring-2 ring-[#FF5630] ring-offset-1 bg-[#FFEBE6]/30' : 'hover:bg-[#FAFAFA]'}`}
                                >
                                  <div className="w-full aspect-square rounded-md overflow-hidden mb-1 bg-[#F5F5F5]">
                                    {c.imageUrl ? (
                                      <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center"><UserCircle className="w-5 h-5 text-[#FF5630]/30" /></div>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-[#666] truncate font-medium">{c.name}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* 场景描述 */}
                <div>
                  <div
                    className="flex items-center gap-3 h-10 cursor-pointer rounded-md hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors -mx-1 px-1"
                    onClick={() => { setSelectedService('scene_generation'); setCfgExpand(cfgExpand === 'scene_generation' ? null : 'scene_generation'); }}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#FFF1E6] flex items-center justify-center flex-shrink-0">
                      {entityCards.filter(c => c.type === 'scene').length > 0 ? <Check className="w-4 h-4 text-[#FFAB00]" /> : <Box className="w-4 h-4 text-[#FFAB00]" />}
                    </div>
                    <span className={`text-[13px] flex-1 ${entityCards.filter(c => c.type === 'scene').length > 0 ? 'text-[#999] line-through' : 'text-[#333] dark:text-foreground/70'}`}>场景描述</span>
                    {entityCards.filter(c => c.type === 'scene').length > 0 && <Check className="w-4 h-4 text-[#36B37E]" />}
                    {entityCards.filter(c => c.type === 'scene').length === 0 && <span className="text-[11px] text-[#999]">未开始</span>}
                    <ChevronDown className={`w-3 h-3 text-[#999] transition-transform ${cfgExpand === 'scene_generation' ? 'rotate-180' : ''}`} />
                  </div>
                  {cfgExpand === 'scene_generation' && (
                    <div className="ml-12 mr-2 mb-2 space-y-3 py-2">
                      <div>
                        <div className="text-[11px] text-[#999] mb-2 font-medium">场景风格</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['电影胶片感', '赛博朋克', '水墨风格', '油画风格'].map(s => (
                            <button key={s} onClick={() => { setVisualStyle(s); setCustomSceneStyle(''); }}
                              className={`text-[11px] px-3 py-2 rounded-md transition-all ${visualStyle === s && !customSceneStyle ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20'}`}>{s}</button>
                          ))}
                          <div className="relative">
                            <input
                              type="text"
                              value={customSceneStyle}
                              onChange={e => { setCustomSceneStyle(e.target.value); if (e.target.value) setVisualStyle(e.target.value); }}
                              placeholder="自定义..."
                              className="text-[11px] px-3 py-2 rounded-md bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20 focus:border-[#FF5630] focus:outline-none w-24 transition-colors"
                            />
                            {customSceneStyle && (
                              <button onClick={() => { setCustomSceneStyle(''); setVisualStyle('电影胶片感'); }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#CCC] hover:text-[#999]">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {/* 道具设计 */}
                <div>
                  <div
                    className="flex items-center gap-3 h-10 cursor-pointer rounded-md hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors -mx-1 px-1"
                    onClick={() => { setSelectedService('prop_generation'); setCfgExpand(cfgExpand === 'prop_generation' ? null : 'prop_generation'); }}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#F3E8FF] flex items-center justify-center flex-shrink-0">
                      {entityCards.filter(c => c.type === 'prop').length > 0 ? <Check className="w-4 h-4 text-[#9966FF]" /> : <Package className="w-4 h-4 text-[#9966FF]" />}
                    </div>
                    <span className={`text-[13px] flex-1 ${entityCards.filter(c => c.type === 'prop').length > 0 ? 'text-[#999] line-through' : 'text-[#333] dark:text-foreground/70'}`}>道具设计</span>
                    {entityCards.filter(c => c.type === 'prop').length > 0 && <Check className="w-4 h-4 text-[#36B37E]" />}
                    {entityCards.filter(c => c.type === 'prop').length === 0 && <span className="text-[11px] text-[#999]">未开始</span>}
                    <ChevronDown className={`w-3 h-3 text-[#999] transition-transform ${cfgExpand === 'prop_generation' ? 'rotate-180' : ''}`} />
                  </div>
                  {cfgExpand === 'prop_generation' && (
                    <div className="ml-12 mr-2 mb-2 space-y-3 py-2">
                      <div>
                        <div className="text-[11px] text-[#999] mb-2 font-medium">道具风格</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['电影写实道具', '赛博朋克道具', '复古道具', '奇幻道具'].map(s => (
                            <button key={s} onClick={() => { setVisualStyle(s); setCustomPropStyle(''); }}
                              className={`text-[11px] px-3 py-2 rounded-md transition-all ${visualStyle === s && !customPropStyle ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20'}`}>{s}</button>
                          ))}
                          <div className="relative">
                            <input
                              type="text"
                              value={customPropStyle}
                              onChange={e => { setCustomPropStyle(e.target.value); if (e.target.value) setVisualStyle(e.target.value); }}
                              placeholder="自定义..."
                              className="text-[11px] px-3 py-2 rounded-md bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20 focus:border-[#FF5630] focus:outline-none w-24 transition-colors"
                            />
                            {customPropStyle && (
                              <button onClick={() => { setCustomPropStyle(''); setVisualStyle('电影写实道具'); }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#CCC] hover:text-[#999]">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <button onClick={handleGenerateProps} disabled={isGenerating}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] bg-[#FFEBE6] text-[#FF5630] hover:bg-[#FFD9CF] rounded-md transition-all disabled:opacity-40 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20">
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                        生成道具
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ===== 阶段2·画面生成（卡片式） ===== */}
          <div className="rounded-lg bg-white dark:bg-card shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors"
              onClick={() => setExpandedPhaseSection(expandedPhaseSection === 'visual' ? null : 'visual')}
            >
              <span className="text-sm font-medium text-[#333] dark:text-foreground/80">阶段2 · 画面生成</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-[#666] dark:text-foreground/40 tabular-nums">
                  {[entityCards.filter(c => c.type === 'character').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'character').length > 0 ? 1 : 0, entityCards.filter(c => c.type === 'scene').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'scene').length > 0 ? 1 : 0, entityCards.filter(c => c.type === 'shot').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'shot').length > 0 ? 1 : 0].reduce((a, b) => a + b, 0)}/3
                </span>
                {expandedPhaseSection === 'visual' ? <ChevronUp className="w-3 h-2 text-[#666] dark:text-foreground/30" /> : <ChevronDown className="w-3 h-2 text-[#666] dark:text-foreground/30" />}
              </div>
            </div>
            {expandedPhaseSection === 'visual' && (
              <div className="px-4 pb-4 space-y-0 border-t border-[#F0F0F0] dark:border-border/20 pt-3">
                {/* 人物三视图 */}
                <div>
                  <div className="flex items-center gap-3 h-10 cursor-pointer rounded-md hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors -mx-1 px-1"
                    onClick={() => { setSelectedService('character_views'); if (phase !== 'visual') goToPhase('visual'); setCfgExpand(cfgExpand === 'character_views' ? null : 'character_views'); }}>
                    <div className="w-7 h-7 rounded-full bg-[#FFEBE6] flex items-center justify-center flex-shrink-0">
                      {entityCards.filter(c => c.type === 'character').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'character').length > 0
                        ? <Check className="w-4 h-4 text-[#FF5630]" />
                        : phase === 'visual' && generationStage === 'character'
                          ? <Loader2 className="w-4 h-4 text-[#FF5630] animate-spin" />
                          : <UserCircle className="w-4 h-4 text-[#FF5630]" />}
                    </div>
                    <span className={`text-[13px] flex-1 ${entityCards.filter(c => c.type === 'character').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'character').length > 0 ? 'text-[#999] line-through' : 'text-[#333] dark:text-foreground/70'}`}>人物三视图</span>
                    {entityCards.filter(c => c.type === 'character').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'character').length > 0 && <Check className="w-4 h-4 text-[#36B37E]" />}
                    {phase === 'visual' && generationStage === 'character' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FFEBE6] text-[#FF5630] font-medium">进行中</span>}
                    {!entityCards.filter(c => c.type === 'character').every(c => c.imageUrl) && !(phase === 'visual' && generationStage === 'character') && <span className="text-[11px] text-[#999]">未开始</span>}
                    <ChevronDown className={`w-3 h-3 text-[#999] transition-transform ${cfgExpand === 'character_views' ? 'rotate-180' : ''}`} />
                  </div>
                  {cfgExpand === 'character_views' && (
                    <div className="ml-12 mr-2 mb-2 space-y-3 py-2">
                      <div>
                        <div className="text-[11px] text-[#999] mb-2 font-medium">画幅尺寸</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['1:1', '16:9', '9:16', '4:3'].map(s => (
                            <button key={s} onClick={() => setVideoRatio(s)}
                              className={`text-[11px] px-3 py-2 rounded-md transition-all ${videoRatio === s ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20'}`}>{s === '1:1' ? '1:1' : s === '16:9' ? '16:9 宽屏' : s === '9:16' ? '9:16 竖屏' : '4:3'}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#999] mb-2 font-medium">画面风格</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['真人写实风格', '动画风格', '电影胶片感', '赛博朋克'].map(s => (
                            <button key={s} onClick={() => setVisualStyle(s)}
                              className={`text-[11px] px-3 py-2 rounded-md transition-all ${visualStyle === s ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20'}`}>{s}</button>
                          ))}
                        </div>
                      </div>
                      {entityCards.filter(c => c.type === 'character').length > 0 && (
                        <div>
                          <div className="text-[11px] text-[#999] mb-2 font-medium">参考人物</div>
                          <div className="grid grid-cols-3 gap-2">
                            {entityCards.filter(c => c.type === 'character').map(c => {
                              const isSelected = selectedCardId === c.id;
                              return (
                                <div key={c.id} onClick={() => setSelectedCardId(isSelected ? null : c.id)}
                                  className={`rounded-lg p-1.5 cursor-pointer transition-all text-center ${isSelected ? 'ring-2 ring-[#FF5630] ring-offset-1 bg-[#FFEBE6]/30' : 'hover:bg-[#FAFAFA]'}`}>
                                  <div className="w-full aspect-square rounded-md overflow-hidden mb-1 bg-[#F5F5F5]">
                                    {c.imageUrl ? <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" loading="lazy" /> : (
                                      <div className="w-full h-full flex items-center justify-center"><UserCircle className="w-5 h-5 text-[#FF5630]/30" /></div>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-[#666] truncate font-medium">{c.name}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* 场景画面 */}
                <div>
                  <div className="flex items-center gap-3 h-10 cursor-pointer rounded-md hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors -mx-1 px-1"
                    onClick={() => { setSelectedService('scene_image'); if (phase !== 'visual') goToPhase('visual'); setCfgExpand(cfgExpand === 'scene_image' ? null : 'scene_image'); }}>
                    <div className="w-7 h-7 rounded-full bg-[#FFF1E6] flex items-center justify-center flex-shrink-0">
                      {entityCards.filter(c => c.type === 'scene').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'scene').length > 0
                        ? <Check className="w-4 h-4 text-[#FFAB00]" />
                        : phase === 'visual' && generationStage === 'scene'
                          ? <Loader2 className="w-4 h-4 text-[#FFAB00] animate-spin" />
                          : <Box className="w-4 h-4 text-[#FFAB00]" />}
                    </div>
                    <span className={`text-[13px] flex-1 ${entityCards.filter(c => c.type === 'scene').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'scene').length > 0 ? 'text-[#999] line-through' : 'text-[#333] dark:text-foreground/70'}`}>场景画面</span>
                    {entityCards.filter(c => c.type === 'scene').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'scene').length > 0 && <Check className="w-4 h-4 text-[#36B37E]" />}
                    {phase === 'visual' && generationStage === 'scene' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FFEBE6] text-[#FF5630] font-medium">进行中</span>}
                    {!entityCards.filter(c => c.type === 'scene').every(c => c.imageUrl) && !(phase === 'visual' && generationStage === 'scene') && <span className="text-[11px] text-[#999]">未开始</span>}
                    <ChevronDown className={`w-3 h-3 text-[#999] transition-transform ${cfgExpand === 'scene_image' ? 'rotate-180' : ''}`} />
                  </div>
                  {cfgExpand === 'scene_image' && (
                    <div className="ml-12 mr-2 mb-2 space-y-3 py-2">
                      <div>
                        <div className="text-[11px] text-[#999] mb-2 font-medium">画面尺寸</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['1:1', '16:9', '9:16', '4:3'].map(s => (
                            <button key={s} onClick={() => setVideoRatio(s)}
                              className={`text-[11px] px-3 py-2 rounded-md transition-all ${videoRatio === s ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20'}`}>{s === '1:1' ? '1:1 正方形' : s === '16:9' ? '16:9 宽屏' : s === '9:16' ? '9:16 竖屏' : '4:3 标准'}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#999] mb-2 font-medium">画面风格</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['真人写实风格', '动画风格', '电影胶片感', '赛博朋克'].map(s => (
                            <button key={s} onClick={() => setVisualStyle(s)}
                              className={`text-[11px] px-3 py-2 rounded-md transition-all ${visualStyle === s ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20'}`}>{s}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {/* 分镜画面 */}
                <div>
                  <div className="flex items-center gap-3 h-10 cursor-pointer rounded-md hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors -mx-1 px-1"
                    onClick={() => { setSelectedService('shot_image'); if (phase !== 'visual') goToPhase('visual'); setCfgExpand(cfgExpand === 'shot_image' ? null : 'shot_image'); }}>
                    <div className="w-7 h-7 rounded-full bg-[#E6F7ED] flex items-center justify-center flex-shrink-0">
                      {entityCards.filter(c => c.type === 'shot').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'shot').length > 0
                        ? <Check className="w-4 h-4 text-[#36B37E]" />
                        : phase === 'visual' && generationStage === 'shot'
                          ? <Loader2 className="w-4 h-4 text-[#36B37E] animate-spin" />
                          : <Clapperboard className="w-4 h-4 text-[#36B37E]" />}
                    </div>
                    <span className={`text-[13px] flex-1 ${entityCards.filter(c => c.type === 'shot').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'shot').length > 0 ? 'text-[#999] line-through' : 'text-[#333] dark:text-foreground/70'}`}>分镜画面</span>
                    {entityCards.filter(c => c.type === 'shot').every(c => c.imageUrl) && entityCards.filter(c => c.type === 'shot').length > 0 && <Check className="w-4 h-4 text-[#36B37E]" />}
                    {phase === 'visual' && generationStage === 'shot' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FFEBE6] text-[#FF5630] font-medium">进行中</span>}
                    {!entityCards.filter(c => c.type === 'shot').every(c => c.imageUrl) && !(phase === 'visual' && generationStage === 'shot') && <span className="text-[11px] text-[#999]">未开始</span>}
                    <ChevronDown className={`w-3 h-3 text-[#999] transition-transform ${cfgExpand === 'shot_image' ? 'rotate-180' : ''}`} />
                  </div>
                  {cfgExpand === 'shot_image' && (
                    <div className="ml-12 mr-2 mb-2 space-y-3 py-2">
                      <div>
                        <div className="text-[11px] text-[#999] mb-2 font-medium">画面尺寸</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['1:1', '16:9', '9:16', '4:3'].map(s => (
                            <button key={s} onClick={() => setVideoRatio(s)}
                              className={`text-[11px] px-3 py-2 rounded-md transition-all ${videoRatio === s ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20'}`}>{s === '1:1' ? '1:1 正方形' : s === '16:9' ? '16:9 宽屏' : s === '9:16' ? '9:16 竖屏' : '4:3 标准'}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#999] mb-2 font-medium">画面风格</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['真人写实风格', '动画风格', '电影胶片感', '赛博朋克'].map(s => (
                            <button key={s} onClick={() => setVisualStyle(s)}
                              className={`text-[11px] px-3 py-2 rounded-md transition-all ${visualStyle === s ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20'}`}>{s}</button>
                          ))}
                        </div>
                      </div>
                      <button className="h-9 px-3 text-[11px] bg-[#FFEBE6] hover:bg-[#FFD9CF] text-[#FF5630] w-full rounded-md flex items-center justify-center font-medium dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20" onClick={handleGenerateAllAssets} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <ImageIcon className="w-3.5 h-3.5 mr-1" />}
                        批量生成画面
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ===== 阶段3·视频合成（卡片式） ===== */}
          <div className="rounded-lg bg-white dark:bg-card shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors"
              onClick={() => setExpandedPhaseSection(expandedPhaseSection === 'compose' ? null : 'compose')}
            >
              <span className="text-sm font-medium text-[#333] dark:text-foreground/80">阶段3 · 视频合成</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-[#666] dark:text-foreground/40 tabular-nums">
                  {[entityCards.filter(c => c.type === 'shot' && c.videoUrl).length > 0 ? 1 : 0, entityCards.some(c => c.subtitleText) ? 1 : 0, entityCards.some(c => c.audioUrl) ? 1 : 0, bgmType !== 'none' ? 1 : 0, sfxType ? 1 : 0, composeStatus === 'completed' ? 1 : 0].reduce((a, b) => a + b, 0)}/6
                </span>
                {expandedPhaseSection === 'compose' ? <ChevronUp className="w-3 h-2 text-[#666] dark:text-foreground/30" /> : <ChevronDown className="w-3 h-2 text-[#666] dark:text-foreground/30" />}
              </div>
            </div>
            {expandedPhaseSection === 'compose' && (
              <div className="px-4 pb-4 space-y-0 border-t border-[#F0F0F0] dark:border-border/20 pt-3">
                {/* 视频生成 */}
                <div>
                  <div className="flex items-center gap-3 h-10 cursor-pointer rounded-md hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors -mx-1 px-1"
                    onClick={() => { setSelectedService('video_generation'); if (phase !== 'compose') goToPhase('compose'); setCfgExpand(cfgExpand === 'video_generation' ? null : 'video_generation'); }}>
                    <div className="w-7 h-7 rounded-full bg-[#FFEBE6] flex items-center justify-center flex-shrink-0">
                      {entityCards.filter(c => c.type === 'shot').every(c => c.videoUrl) && entityCards.filter(c => c.type === 'shot').length > 0
                        ? <Check className="w-4 h-4 text-[#FF5630]" />
                        : phase === 'compose' && composeStatus === 'generating'
                          ? <span className="w-2 h-2 rounded-full bg-[#FF5630] animate-pulse" />
                          : <Video className="w-4 h-4 text-[#FF5630]" />}
                    </div>
                    <span className={`text-[13px] flex-1 ${entityCards.filter(c => c.type === 'shot').every(c => c.videoUrl) && entityCards.filter(c => c.type === 'shot').length > 0 ? 'text-[#999] line-through' : 'text-[#333] dark:text-foreground/70'}`}>视频生成</span>
                    {entityCards.filter(c => c.type === 'shot').every(c => c.videoUrl) && entityCards.filter(c => c.type === 'shot').length > 0 && <Check className="w-4 h-4 text-[#36B37E]" />}
                    {phase === 'compose' && composeStatus === 'generating' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FFEBE6] text-[#FF5630] font-medium">进行中</span>}
                    {!entityCards.filter(c => c.type === 'shot').every(c => c.videoUrl) && !(phase === 'compose' && composeStatus === 'generating') && <span className="text-[11px] text-[#999]">未开始</span>}
                    <ChevronDown className={`w-3 h-3 text-[#999] transition-transform ${cfgExpand === 'video_generation' ? 'rotate-180' : ''}`} />
                  </div>
                  {cfgExpand === 'video_generation' && (
                    <div className="ml-12 mr-2 mb-2 space-y-3 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] px-2.5 py-1 rounded-md bg-[#F5F5F5] text-[#666] font-medium">{videoRatio || '16:9'}</span>
                        <span className="text-[11px] px-2.5 py-1 rounded-md bg-[#F5F5F5] text-[#666] font-medium">{videoDuration || '8'}s</span>
                        <span className="text-[11px] px-2.5 py-1 rounded-md bg-[#F5F5F5] text-[#666] font-medium">{generationMode === 'sequential' ? '连续' : '并行'}</span>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#999] mb-2 font-medium">单镜头时长</div>
                        <div className="flex gap-1.5">
                          {[5, 8, 10].map(d => (
                            <button key={d} onClick={() => setVideoDuration(d)}
                              className={`flex-1 text-[11px] py-2 rounded-md transition-all ${videoDuration === d ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20'}`}>{d}s</button>
                          ))}
                        </div>
                        <div className="text-[10px] text-[#CCC] mt-1.5">
                          总时长 = {entityCards.filter(c => c.type === 'shot').length}镜头 × {videoDuration}s ≈ <span className="text-[#FF5630] font-medium">{formatDuration(entityCards.filter(c => c.type === 'shot').length * videoDuration)}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#999] mb-2 font-medium">画面比例</div>
                        <div className="flex gap-1.5">
                          {['16:9', '9:16', '1:1'].map(r => (
                            <button key={r} onClick={() => setVideoRatio(r)}
                              className={`flex-1 text-[11px] py-2 rounded-md transition-all ${videoRatio === r ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'bg-white text-[#666] hover:bg-[#FAFAFA] dark:bg-transparent dark:text-foreground/40 dark:hover:bg-white/[0.03] border border-[#F0F0F0] dark:border-border/20'}`}>{r}</button>
                          ))}
                        </div>
                      </div>
                      {composeStatus === 'generating' && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-[#999]">
                            <span>视频生成中...</span>
                            <span>{Math.round(Object.values(composeProgress).reduce((a, b) => a + b, 0) / Math.max(Object.keys(composeProgress).length, 1))}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#F0F0F0]">
                            <div className="h-1.5 rounded-full bg-[#FF5630] transition-all" style={{ width: `${Math.round(Object.values(composeProgress).reduce((a, b) => a + b, 0) / Math.max(Object.keys(composeProgress).length, 1))}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {stats.videosGenerated === 0 && entityCards.filter(c => c.type === 'shot').length > 0 && (
                          <button className="h-9 px-3 text-[11px] bg-[#FF5630] hover:bg-[#E04E28] text-white w-full rounded-md flex items-center justify-center font-medium" onClick={() => handleGenerateAllVideos()} disabled={isGenerating}>
                            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                            生成视频
                          </button>
                        )}
                        {stats.videosGenerated > 0 && (
                          <button className="h-9 px-3 text-[11px] bg-[#FF5630] hover:bg-[#E04E28] text-white w-full rounded-md flex items-center justify-center font-medium" onClick={handleComposeFilm}>
                            <Film className="w-3.5 h-3.5 mr-1" />
                            合成影片
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {/* 字幕 */}
                <div>
                  <div className="flex items-center gap-3 h-10 cursor-pointer rounded-md hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors -mx-1 px-1"
                    onClick={() => { setSelectedService('subtitle_generation'); setCfgExpand(cfgExpand === 'subtitle_generation' ? null : 'subtitle_generation'); }}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${entityCards.some(c => c.subtitleText) ? 'bg-[#E6F7ED]' : 'bg-[#E0F7FA]'}`}>
                      {entityCards.some(c => c.subtitleText) ? <Check className="w-4 h-4 text-[#36B37E]" /> : <Subtitles className="w-4 h-4 text-[#00B8D9]" />}
                    </div>
                    <span className={`text-[13px] flex-1 ${entityCards.some(c => c.subtitleText) ? 'text-[#999] line-through' : 'text-[#333] dark:text-foreground/70'}`}>字幕</span>
                    {entityCards.some(c => c.subtitleText) && <Check className="w-4 h-4 text-[#36B37E]" />}
                    {!entityCards.some(c => c.subtitleText) && <span className="text-[11px] text-[#999]">未开始</span>}
                    <ChevronDown className={`w-3 h-3 text-[#999] transition-transform ${cfgExpand === 'subtitle_generation' ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {/* 音频 */}
                <div>
                  <div className="flex items-center gap-3 h-10 cursor-pointer rounded-md hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors -mx-1 px-1"
                    onClick={() => { setSelectedService('audio_generation'); setCfgExpand(cfgExpand === 'audio_generation' ? null : 'audio_generation'); }}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${entityCards.some(c => c.audioUrl) ? 'bg-[#E6F7ED]' : 'bg-[#F3E8FF]'}`}>
                      {entityCards.some(c => c.audioUrl) ? <Check className="w-4 h-4 text-[#36B37E]" /> : <Mic className="w-4 h-4 text-[#9966FF]" />}
                    </div>
                    <span className={`text-[13px] flex-1 ${entityCards.some(c => c.audioUrl) ? 'text-[#999] line-through' : 'text-[#333] dark:text-foreground/70'}`}>音频</span>
                    {entityCards.some(c => c.audioUrl) && <Check className="w-4 h-4 text-[#36B37E]" />}
                    {!entityCards.some(c => c.audioUrl) && <span className="text-[11px] text-[#999]">未开始</span>}
                    <ChevronDown className={`w-3 h-3 text-[#999] transition-transform ${cfgExpand === 'audio_generation' ? 'rotate-180' : ''}`} />
                  </div>
                  {cfgExpand === 'audio_generation' && (
                    <div className="ml-12 mr-2 mb-2 space-y-3 py-2">
                      <div>
                        <div className="text-[11px] text-[#999] mb-2 font-medium">音色选择</div>
                        <div className="max-h-[140px] overflow-y-auto space-y-0.5 pr-1">
                          {['女声-温柔', '女声-活力', '女声-甜美', '女声-成熟', '女声-童声', '男声-沉稳', '男声-磁性', '男声-青年', '男声-老年', '男声-童声'].map(v => (
                            <div key={v} className="flex items-center gap-1">
                              <button onClick={() => setVoiceType(v)}
                                className={`flex-1 text-left text-[11px] px-3 py-1.5 rounded-md transition-all ${voiceType === v ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'text-[#666] hover:bg-[#FAFAFA] dark:text-foreground/40 dark:hover:bg-white/[0.03]'}`}>{v}</button>
                              <button onClick={() => handlePreviewVoice(v)}
                                className={`p-1 rounded transition-all ${voicePreviewPlaying === v ? 'text-[#FF5630] bg-[#FFEBE6]' : 'text-[#CCC] hover:text-[#999] hover:bg-[#FAFAFA]'}`}
                                title="试听">
                                {voicePreviewPlaying === v ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[10px] text-[#999]">语速</span>
                          <input type="range" min="0.5" max="2" step="0.1" value={filmTtsSpeed} onChange={e => setFilmTtsSpeed(parseFloat(e.target.value))} className="flex-1 h-1 accent-[#FF5630]" />
                          <span className="text-[10px] text-[#666] w-6">{filmTtsSpeed}x</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {/* BGM */}
                <div>
                  <div className="flex items-center gap-3 h-10 cursor-pointer rounded-md hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors -mx-1 px-1"
                    onClick={() => { setSelectedService('bgm'); setCfgExpand(cfgExpand === 'bgm' ? null : 'bgm'); }}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${bgmType !== 'none' ? 'bg-[#E6F7ED]' : 'bg-[#FFF1E6]'}`}>
                      {bgmType !== 'none' ? <Check className="w-4 h-4 text-[#36B37E]" /> : <Music className="w-4 h-4 text-[#FFAB00]" />}
                    </div>
                    <span className={`text-[13px] flex-1 ${bgmType !== 'none' ? 'text-[#36B37E] font-medium' : 'text-[#333] dark:text-foreground/70'}`}>BGM</span>
                    {bgmType !== 'none' && <Check className="w-4 h-4 text-[#36B37E]" />}
                    {bgmType === 'none' && <span className="text-[11px] text-[#999]">未选择</span>}
                    <ChevronDown className={`w-3 h-3 text-[#999] transition-transform ${cfgExpand === 'bgm' ? 'rotate-180' : ''}`} />
                  </div>
                  {cfgExpand === 'bgm' && (
                    <div className="ml-12 mr-2 mb-2 space-y-3 py-2">
                      <div className="text-[11px] text-[#999] mb-1 font-medium flex items-center gap-1">
                        <Music className="w-3 h-3" /> 背景音乐风格
                      </div>
                      <div className="space-y-0.5 max-h-[200px] overflow-y-auto pr-1">
                        {/* 无BGM选项 */}
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setBgmType('none'); bgmAudioRef.current?.pause(); setBgmPreviewPlaying(false); }}
                            className={`flex-1 text-left text-[11px] px-3 py-1.5 rounded-md transition-all ${bgmType === 'none' ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'text-[#666] hover:bg-[#FAFAFA] dark:text-foreground/40 dark:hover:bg-white/[0.03]'}`}>
                            🔇 无背景音乐
                          </button>
                        </div>
                        {getBgmTypeList().map(bgm => (
                          <div key={bgm.id} className="flex items-center gap-1">
                            <button onClick={() => setBgmType(bgm.id)}
                              className={`flex-1 text-left text-[11px] px-3 py-1.5 rounded-md transition-all ${bgmType === bgm.id ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'text-[#666] hover:bg-[#FAFAFA] dark:text-foreground/40 dark:hover:bg-white/[0.03]'}`}>
                              {bgm.icon} {bgm.name}
                            </button>
                            <button onClick={() => handlePreviewBgm(bgm.id)}
                              className={`p-1 rounded transition-all ${bgmPreviewPlaying && bgmType === bgm.id ? 'text-[#FF5630] bg-[#FFEBE6]' : 'text-[#CCC] hover:text-[#999] hover:bg-[#FAFAFA]'}`}
                              title="试听">
                              {bgmPreviewPlaying && bgmType === bgm.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[#999]">音量</span>
                        {(['low', 'medium', 'high'] as const).map(v => (
                          <button key={v} onClick={() => setBgmVolume(v)}
                            className={`text-[10px] px-2 py-1 rounded-md transition-all ${bgmVolume === v ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'text-[#999] hover:bg-[#FAFAFA] dark:text-foreground/30 dark:hover:bg-white/[0.03]'}`}
                          >{v === 'low' ? '低' : v === 'medium' ? '中' : '高'}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* 特效 */}
                <div>
                  <div className="flex items-center gap-3 h-10 cursor-pointer rounded-md hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors -mx-1 px-1"
                    onClick={() => { setSelectedService('sfx'); setCfgExpand(cfgExpand === 'sfx' ? null : 'sfx'); }}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${sfxType ? 'bg-[#E6F7ED]' : 'bg-[#E0F7FA]'}`}>
                      {sfxType ? <Check className="w-4 h-4 text-[#36B37E]" /> : <Volume2 className="w-4 h-4 text-[#00B8D9]" />}
                    </div>
                    <span className={`text-[13px] flex-1 ${sfxType ? 'text-[#999] line-through' : 'text-[#333] dark:text-foreground/70'}`}>特效</span>
                    {sfxType && <Check className="w-4 h-4 text-[#36B37E]" />}
                    {!sfxType && <span className="text-[11px] text-[#999]">未开始</span>}
                    <ChevronDown className={`w-3 h-3 text-[#999] transition-transform ${cfgExpand === 'sfx' ? 'rotate-180' : ''}`} />
                  </div>
                  {cfgExpand === 'sfx' && (
                    <div className="ml-12 mr-2 mb-2 space-y-3 py-2">
                      <div className="text-[11px] text-[#999] mb-1 font-medium flex items-center gap-1">
                        <Volume2 className="w-3 h-3" /> 特效音类型
                      </div>
                      <div className="space-y-0.5">
                        {[{ id: null, name: '无特效音', icon: '🔇' }, { id: 'transition', name: '转场音效', icon: '🔄' }, { id: 'impact', name: '冲击音效', icon: '💥' }, { id: 'whoosh', name: '风声呼啸', icon: '💨' }, { id: 'ambient', name: '环境氛围', icon: '🌧️' }].map(sfx => (
                          <button key={sfx.id ?? 'none'} onClick={() => setSfxType(sfx.id)}
                            className={`block w-full text-left text-[11px] px-3 py-1.5 rounded-md transition-all ${sfxType === sfx.id ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'text-[#666] hover:bg-[#FAFAFA] dark:text-foreground/40 dark:hover:bg-white/[0.03]'}`}>
                            {sfx.icon} {sfx.name}
                          </button>
                        ))}
                      </div>
                      {sfxType && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[#999]">音量</span>
                          {(['low', 'medium', 'high'] as const).map(v => (
                            <button key={v} onClick={() => setSfxVolume(v)}
                              className={`text-[10px] px-2 py-1 rounded-md transition-all ${sfxVolume === v ? 'bg-[#FFEBE6] text-[#FF5630] font-medium dark:bg-red-500/15 dark:text-red-400' : 'text-[#999] hover:bg-[#FAFAFA] dark:text-foreground/30 dark:hover:bg-white/[0.03]'}`}
                            >{v === 'low' ? '低' : v === 'medium' ? '中' : '高'}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* 合并导出 */}
                <div>
                  <div className="flex items-center gap-3 h-10 cursor-pointer rounded-md hover:bg-[#FAFAFA] dark:hover:bg-white/[0.02] transition-colors -mx-1 px-1"
                    onClick={() => { setSelectedService('compose'); setCfgExpand(cfgExpand === 'compose' ? null : 'compose'); }}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${composeStatus === 'completed' ? 'bg-[#E6F7ED]' : 'bg-[#E6F7ED]'}`}>
                      {composeStatus === 'completed' ? <Check className="w-4 h-4 text-[#36B37E]" /> :
                       composeStatus === 'merging' ? <Loader2 className="w-4 h-4 text-[#36B37E] animate-spin" /> :
                       <Combine className="w-4 h-4 text-[#36B37E]" />}
                    </div>
                    <span className={`text-[13px] flex-1 ${composeStatus === 'completed' ? 'text-[#999] line-through' : 'text-[#333] dark:text-foreground/70'}`}>合并导出</span>
                    {composeStatus === 'completed' && <Check className="w-4 h-4 text-[#36B37E]" />}
                    {composeStatus === 'merging' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FFEBE6] text-[#FF5630] font-medium">进行中</span>}
                    {composeStatus !== 'completed' && composeStatus !== 'merging' && <span className="text-[11px] text-[#999]">未开始</span>}
                    <ChevronDown className={`w-3 h-3 text-[#999] transition-transform ${cfgExpand === 'compose' ? 'rotate-180' : ''}`} />
                  </div>
                  {cfgExpand === 'compose' && (
                    <div className="ml-12 mr-2 mb-2 space-y-2 py-2">
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-[#999]">
                          <span className="flex items-center gap-1"><Music className="w-3 h-3" /> BGM</span>
                          <span className={bgmType !== 'none' ? 'text-[#FF5630]' : 'text-[#999]'}>{bgmType !== 'none' ? (() => { const t = getBgmTypeList().find(b => b.id === bgmType); return t ? `${t.icon} ${t.name}` : bgmType; })() : '🔇 无'}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#999]">
                          <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" /> 特效音</span>
                          <span className={sfxType ? 'text-[#FF5630]' : ''}>{sfxType ? { transition: '转场音效', impact: '冲击音效', whoosh: '风声呼啸', ambient: '环境氛围' }[String(sfxType)] || sfxType : '未选择'}</span>
                        </div>
                        <div className="text-[#CCC] pt-1">合并所有视频片段，含字幕、音频、BGM和特效音</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* ===== 剧本要素 ===== */}
          {entityCards.length > 0 && (
            <div className="border-t border-[#F0F0F0] dark:border-border/30 pt-3">
              <div
                className="flex items-center gap-2 px-1 mb-2 cursor-pointer select-none"
                onClick={() => setRefEntitiesExpanded((v: boolean) => !v)}
              >
                <div className="w-5 h-5 rounded-full bg-[#FFF1E6] dark:bg-[#FFAB00]/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-3 h-3 text-[#FFAB00]" />
                </div>
                <span className="text-sm font-medium text-[#333] dark:text-white">剧本要素</span>
                <span className="text-[9px] text-[#666] dark:text-white/50">人物 · 场景 · 道具</span>
                <div className="flex-1" />
                {refEntitiesExpanded
                  ? <ChevronUp className="w-3.5 h-3.5 text-[#999] dark:text-white/40" />
                  : <ChevronDown className="w-3.5 h-3.5 text-[#999] dark:text-white/40" />
                }
              </div>
              {refEntitiesExpanded && (
              <>
              {/* 人物行 */}
              {entityCards.filter(c => c.type === 'character').length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <UserCircle className="w-3 h-3 text-orange-500" />
                      <span className="text-[10px] font-medium text-foreground/60">人物</span>
                      <span className="text-[9px] text-foreground/30">{entityCards.filter(c => c.type === 'character').length}</span>
                    </div>
                    {selectedCardId && entityCards.filter(c => c.type === 'character').some(c => c.id === selectedCardId) && (
                      <button onClick={() => setSelectedCardId(null)} className="text-[9px] text-foreground/30 hover:text-foreground/50">取消选择</button>
                    )}
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                    {entityCards.filter(c => c.type === 'character').map(c => {
                      const isSelected = selectedCardId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCardId(isSelected ? null : c.id)}
                          className={`flex-shrink-0 w-[72px] rounded-lg border cursor-pointer transition-all overflow-hidden ${
                            isSelected
                              ? 'border-red-500/60 ring-2 ring-red-500/20 shadow-sm shadow-red-500/10'
                              : 'border-border/40 hover:border-border/70'
                          }`}
                        >
                          <div className="w-full h-[72px] overflow-hidden bg-accent/30">
                            {c.imageUrl ? (
                              <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-orange-500/5">
                                <UserCircle className="w-8 h-8 text-orange-500/30" />
                              </div>
                            )}
                          </div>
                          <div className="px-1 py-1 text-center">
                            <div className="text-[9px] text-foreground/70 truncate font-medium leading-tight">{c.name}</div>
                            {c.gender && <div className="text-[7px] text-foreground/30 leading-tight">{c.age || ''} {c.gender}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* 场景行 */}
              {entityCards.filter(c => c.type === 'scene').length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <Box className="w-3 h-3 text-blue-500" />
                      <span className="text-[10px] font-medium text-foreground/60">场景</span>
                      <span className="text-[9px] text-foreground/30">{entityCards.filter(c => c.type === 'scene').length}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                    {entityCards.filter(c => c.type === 'scene').map(c => {
                      const isSelected = selectedCardId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCardId(isSelected ? null : c.id)}
                          className={`flex-shrink-0 w-[72px] rounded-lg border cursor-pointer transition-all overflow-hidden ${
                            isSelected
                              ? 'border-blue-500/60 ring-2 ring-blue-500/20 shadow-sm shadow-blue-500/10'
                              : 'border-border/40 hover:border-border/70'
                          }`}
                        >
                          <div className="w-full h-[72px] overflow-hidden bg-accent/30">
                            {c.imageUrl ? (
                              <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-blue-500/5">
                                <Box className="w-8 h-8 text-blue-500/30" />
                              </div>
                            )}
                          </div>
                          <div className="px-1 py-1 text-center">
                            <div className="text-[9px] text-foreground/70 truncate font-medium leading-tight">{c.name}</div>
                            {c.timeOfDay && <div className="text-[7px] text-foreground/30 leading-tight">{c.timeOfDay}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* 道具行 */}
              {entityCards.filter(c => c.type === 'prop').length > 0 && (
                <div className="mb-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <Package className="w-3 h-3 text-purple-500" />
                      <span className="text-[10px] font-medium text-foreground/60">道具</span>
                      <span className="text-[9px] text-foreground/30">{entityCards.filter(c => c.type === 'prop').length}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                    {entityCards.filter(c => c.type === 'prop').map(c => {
                      const isSelected = selectedCardId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCardId(isSelected ? null : c.id)}
                          className={`flex-shrink-0 w-[72px] rounded-lg border cursor-pointer transition-all overflow-hidden ${
                            isSelected
                              ? 'border-purple-500/60 ring-2 ring-purple-500/20 shadow-sm shadow-purple-500/10'
                              : 'border-border/40 hover:border-border/70'
                          }`}
                        >
                          <div className="w-full h-[72px] overflow-hidden bg-accent/30">
                            {c.imageUrl ? (
                              <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-purple-500/5">
                                <Package className="w-8 h-8 text-purple-500/30" />
                              </div>
                            )}
                          </div>
                          <div className="px-1 py-1 text-center">
                            <div className="text-[9px] text-foreground/70 truncate font-medium leading-tight">{c.name}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </>
              )}
            </div>
          )}

        {/* ===== 资产卡片区（资产工坊风格展示 entityCards） ===== */}
        {entityCards.length > 0 && (
        <div className="border-t border-[#F0F0F0] dark:border-border/30 pt-3">
          {/* 标题 */}
          <div
            className="flex items-center gap-2.5 h-10 px-1 cursor-pointer select-none"
            onClick={() => setAssetCardsExpanded((v: boolean) => !v)}
          >
            <div className="w-7 h-7 rounded-full bg-[#F3E8FF] flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-[#9966FF]" />
            </div>
            <span className="text-sm font-medium text-[#333] dark:text-white flex-1">资产卡片</span>
            <span className="text-[9px] text-[#666] dark:text-white/50">{entityCards.length}个</span>
            {assetCardsExpanded
              ? <ChevronUp className="w-3.5 h-3.5 text-[#999] dark:text-white/40" />
              : <ChevronDown className="w-3.5 h-3.5 text-[#999] dark:text-white/40" />
            }
          </div>
          {assetCardsExpanded && (
          <>
          {/* 资产类型筛选+统计 */}
          <div className="px-3 py-2 flex items-center gap-2">
            {(['all', 'character', 'scene', 'prop', 'shot'] as const).map((t) => {
              const labels: Record<string, string> = { all: '全部', character: '角色', scene: '场景', prop: '道具', shot: '镜头' };
              const count = t === 'all' ? entityCards.length : entityCards.filter(c => c.type === t).length;
              const isActive = wsFilter === t;
              return (
                <button
                  key={t}
                  onClick={() => setWsFilter(t)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    isActive ? 'bg-[#EF4444]/10 text-[#EF4444]' : 'text-foreground/40 hover:bg-accent/20'
                  }`}
                >
                  {labels[t]}({count})
                </button>
              );
            })}
            <div className="flex-1" />
            <button
              onClick={handleGenerateAllAssets}
              disabled={isGenerating}
              className="px-2 py-0.5 rounded text-[10px] bg-[#EF4444] text-white hover:bg-[#EF4444]/80 disabled:opacity-40 transition-all flex items-center gap-0.5"
            >
              <Images className="w-2.5 h-2.5" /> 批量生图
            </button>
          </div>

          {/* 资产卡片网格 */}
          <div className="px-2 pb-2 max-h-[220px] overflow-y-auto space-y-1.5">
            {entityCards
              .filter(c => wsFilter === 'all' || c.type === wsFilter)
              .map(card => {
              const typeColors: Record<string, string> = {
                plot: 'bg-gray-500/10 text-gray-400',
                character: 'bg-orange-500/10 text-orange-400',
                scene: 'bg-blue-500/10 text-blue-400',
                prop: 'bg-purple-500/10 text-purple-400',
                shot: 'bg-emerald-500/10 text-emerald-400',
              };
              const typeLabels: Record<string, string> = { plot: '剧情', character: '角色', scene: '场景', prop: '道具', shot: '镜头' };
              const statusIcon = card.imageUrl
                ? <Check className="w-2.5 h-2.5 text-emerald-400" />
                : card.videoUrl
                ? <Play className="w-2.5 h-2.5 text-blue-400" />
                : <div className="w-2 h-2 rounded-full bg-foreground/20" />;
              const isSelected = selectedCardId === card.id;
              return (
                <div
                  key={card.id}
                  onClick={() => {
                    setSelectedCardId(isSelected ? null : card.id);
                    // 自动选中对应服务
                    const svcMap: Record<string, string> = { character: 'character_prompt', scene: 'scene_generation', shot: 'shot_image', prop: 'prop_generation', plot: 'storyboard_script' };
                    const targetSvc = svcMap[card.type];
                    if (targetSvc) {
                      setSelectedService(targetSvc);
                      const phaseMap: Record<string, WorkflowPhase> = { character: 'planning', scene: 'planning', shot: 'visual', prop: 'planning', plot: 'planning' };
                      const targetPhase = phaseMap[card.type] || 'planning';
                      if (phase !== targetPhase) goToPhase(targetPhase);
                      setCfgExpand(targetSvc);
                    }
                  }}
                  className={`rounded-lg border p-2 transition-all cursor-pointer ${
                    isSelected ? 'border-[#EF4444]/40 bg-[#EF4444]/5' : 'border-border/50 hover:border-border hover:bg-accent/10'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {statusIcon}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${typeColors[card.type] || typeColors.plot}`}>
                      {typeLabels[card.type] || card.type}
                    </span>
                    <span className="text-[11px] font-medium text-foreground/80 flex-1 truncate">{card.name}</span>
                    {/* 镜头信息标签 */}
                    {card.type === 'shot' && (card.shotType || card.cameraMovement) && (
                      <span className="text-[8px] text-foreground/25 bg-accent/30 px-1 py-0 rounded truncate max-w-[60px]">
                        {card.shotType || ''}{card.shotType && card.cameraMovement ? '·' : ''}{card.cameraMovement || ''}
                      </span>
                    )}
                    {/* 角色信息标签 */}
                    {card.type === 'character' && card.gender && (
                      <span className="text-[8px] text-foreground/25 bg-accent/30 px-1 py-0 rounded">{card.age || ''}{card.gender}</span>
                    )}
                    {/* 场景信息标签 */}
                    {card.type === 'scene' && card.timeOfDay && (
                      <span className="text-[8px] text-foreground/25 bg-accent/30 px-1 py-0 rounded">{card.timeOfDay}</span>
                    )}
                    {/* 道具信息标签 */}
                    {card.type === 'prop' && card.propMaterial && (
                      <span className="text-[8px] text-foreground/25 bg-accent/30 px-1 py-0 rounded">{card.propMaterial}</span>
                    )}
                    {card.type === 'prop' && card.propCloseup && (
                      <span className="text-[8px] text-purple-500/60 bg-purple-500/10 px-1 py-0 rounded">特写</span>
                    )}
                    {/* 单卡生成按钮 */}
                    {!card.imageUrl && (card.type === 'character' || card.type === 'scene' || card.type === 'shot' || card.type === 'prop') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateImage(card.id);
                        }}
                        disabled={card.isGenerating}
                        className="p-0.5 rounded hover:bg-[#EF4444]/10 text-foreground/30 hover:text-[#EF4444] transition-colors"
                        title="生成图片"
                      >
                        {card.isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                      </button>
                    )}
                    {card.imageUrl && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setWsPreviewUrl(card.imageUrl!); }}
                        className="p-0.5 rounded hover:bg-[#EF4444]/10 text-foreground/30 hover:text-[#EF4444] transition-colors"
                        title="预览图片"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {/* 导演方案标签行 */}
                  {card.type === 'character' && (
                    <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                      {(card as any).mbti && <span className="text-[8px] px-1 py-0 rounded bg-indigo-500/10 text-indigo-400 font-medium">{(card as any).mbti}</span>}
                      {card.characterArc && <span className="text-[8px] px-1 py-0 rounded bg-amber-500/10 text-amber-400 truncate max-w-[80px]">{card.characterArc}</span>}
                      {card.promptCn?.includes('一致性·必须包含') && <span className="text-[8px] px-1 py-0 rounded bg-emerald-500/10 text-emerald-400">一致性 ✓</span>}
                    </div>
                  )}
                  {card.type === 'scene' && (
                    <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                      {card.atmosphere && <span className="text-[8px] px-1 py-0 rounded bg-cyan-500/10 text-cyan-400 truncate max-w-[80px]">{card.atmosphere}</span>}
                      {card.symbolism && <span className="text-[8px] px-1 py-0 rounded bg-purple-500/10 text-purple-400 truncate max-w-[60px]">{card.symbolism}</span>}
                      {card.promptCn?.includes('视觉:') && <span className="text-[8px] px-1 py-0 rounded bg-emerald-500/10 text-emerald-400">五感 ✓</span>}
                    </div>
                  )}
                  {card.type === 'prop' && (
                    <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                      {card.propMaterial && <span className="text-[8px] px-1 py-0 rounded bg-purple-500/10 text-purple-400">{card.propMaterial}</span>}
                      {card.propColor && <span className="text-[8px] px-1 py-0 rounded bg-pink-500/10 text-pink-400">{card.propColor}</span>}
                      {card.propCloseup && <span className="text-[8px] px-1 py-0 rounded bg-amber-500/10 text-amber-400">特写</span>}
                      {card.propSignificance && <span className="text-[8px] px-1 py-0 rounded bg-emerald-500/10 text-emerald-400 truncate max-w-[60px]">{card.propSignificance}</span>}
                    </div>
                  )}
                  {card.type === 'shot' && (
                    <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                      {card.colorNarrative && <span className="text-[8px] px-1 py-0 rounded bg-rose-500/10 text-rose-400 truncate max-w-[60px]">{card.colorNarrative}</span>}
                      {card.soundDesign && <span className="text-[8px] px-1 py-0 rounded bg-teal-500/10 text-teal-400 truncate max-w-[60px]">{card.soundDesign}</span>}
                      {card.promptCn?.includes('一致性') && <span className="text-[8px] px-1 py-0 rounded bg-emerald-500/10 text-emerald-400">约束 ✓</span>}
                    </div>
                  )}
                  {card.promptCn && (
                    <div className="text-[9px] text-foreground/30 line-clamp-2">{card.promptCn}</div>
                  )}
                  {card.imageUrl && (
                    <div
                      className="mt-1 rounded overflow-hidden cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setWsPreviewUrl(card.imageUrl!); }}
                    >
                      <img src={card.imageUrl} alt={card.name} className="w-full h-16 object-cover rounded hover:opacity-80 transition-opacity" loading="lazy" />
                    </div>
                  )}
                  {card.errorMsg && (
                    <div className="mt-1 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-[9px] text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{card.errorMsg}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>
          )}
        </div>
        )}

        {/* ===== 一致性系统 ===== */}
          <div className="border-t border-[#F0F0F0] dark:border-border/30 pt-3">
            <div
              className="flex items-center gap-2.5 h-10 cursor-pointer rounded-md hover:bg-black/[0.02] transition-colors -mx-1 px-1"
              onClick={() => setCfgExpand(cfgExpand === 'consistency_system' ? null : 'consistency_system')}
            >
              <div className="w-7 h-7 rounded-full bg-[#FFF1E6] flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-[#FFAB00]" />
              </div>
              <span className="text-sm font-medium text-[#333] dark:text-white flex-1">一致性系统</span>
              <div className="flex items-center gap-1.5">
                {entityCards.filter(c => c.type === 'character' && c.anchor).length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#E6F7ED] text-[#36B37E] font-medium">{entityCards.filter(c => c.type === 'character' && c.anchor).length}/{entityCards.filter(c => c.type === 'character').length}</span>
                )}
                {cfgExpand === 'consistency_system' ? <ChevronUp className="w-3.5 h-3.5 text-[#666]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#666]" />}
              </div>
            </div>
            {cfgExpand === 'consistency_system' && (
              <div className="space-y-0.5">
                {([
                  { id: 'character_anchor' as const, icon: Shield, label: '角色锚点', color: 'text-violet-400' },
                  { id: 'consistency_check' as const, icon: Eye, label: '一致性校验', color: 'text-amber-400' },
                  { id: 'prompt_extend' as const, icon: Wand2, label: '提示词增强', color: 'text-cyan-400' },
                ]).map(svc => {
                  const isActive = selectedService === svc.id;
                  const Icon = svc.icon;
                  const anchorCount = entityCards.filter(c => c.type === 'character' && c.anchor).length;
                  const isDone = (svc.id === 'character_anchor' && anchorCount > 0) ||
                    (svc.id === 'consistency_check' && consistencyResults !== null);
                  return (
                    <div key={svc.id}>
                      <div
                        className="flex items-center gap-1.5 text-[10px] pl-1 cursor-pointer hover:bg-accent/20 rounded py-0.5 -mx-0.5"
                        onClick={() => { setSelectedService(svc.id); if (phase !== 'visual') goToPhase('visual'); setConsistencySvcExpand(consistencySvcExpand === svc.id ? null : svc.id); }}
                      >
                        <Icon className="w-2.5 h-2.5 flex-shrink-0" style={{ color: 'currentColor' }} />
                        <span className="text-foreground/50">{svc.label}</span>
                        {svc.id === 'character_anchor' && anchorCount > 0 && <span className="text-[9px] text-primary bg-primary/10 px-1 py-0 rounded ml-auto">{anchorCount}/{entityCards.filter(c => c.type === 'character').length}</span>}
                        {isDone && <Check className="w-2.5 h-2.5 text-emerald-500 ml-auto" />}
                        {!isDone && svc.id !== 'character_anchor' && <span className="text-[9px] text-foreground/25 ml-auto">未开始</span>}
                        <ChevronDown className={`w-2.5 h-2.5 text-foreground/20 transition-transform ${consistencySvcExpand === svc.id ? 'rotate-180' : ''}`} />
                      </div>
                      {consistencySvcExpand === svc.id && (
                        <div className="ml-4 mr-1 mb-1 space-y-1 py-1 border-l-2 border-red-500/20 pl-2">
                          {svc.id === 'character_anchor' && (
                            <>
                              <div className="text-[9px] text-foreground/40">为角色生成4维锚点(面部/身形/发型/服装)</div>
                              {entityCards.filter(c => c.type === 'character').map(c => (
                                <button key={c.id} onClick={() => handleGenerateAnchor(c.id)}
                                  disabled={c.anchorGenerating || !c.imageUrl}
                                  className="block w-full text-left text-[9px] px-1.5 py-0.5 rounded transition-all text-foreground/40 hover:bg-accent/20 disabled:opacity-40">
                                  {c.anchorGenerating ? <Loader2 className="w-2.5 h-2.5 inline animate-spin mr-0.5" /> : c.anchor ? <Check className="w-2.5 h-2.5 inline mr-0.5 text-emerald-500" /> : null}
                                  {c.name} {!c.imageUrl ? '(需先生成图)' : ''}
                                </button>
                              ))}
                            </>
                          )}
                          {svc.id === 'consistency_check' && (
                            <>
                              <div className="text-[9px] text-foreground/40">检查分镜间角色/光线/道具连续性</div>
                              <div className="text-[9px] text-foreground/40 mb-0.5 font-medium">网格提示词模式</div>
                              <div className="flex flex-wrap gap-0.5">
                                {(['first_frame', 'first_last', 'multi_ref'] as const).map(m => (
                                  <button key={m} onClick={() => setConsistencyMode(m)}
                                    className={`text-[9px] px-1.5 py-0.5 rounded-full transition-all ${consistencyMode === m ? 'bg-red-500/10 text-red-500 border border-red-500/30 font-medium' : 'text-foreground/40 hover:bg-accent/30 border border-transparent'}`}>
                                    {m === 'first_frame' ? '首帧引导' : m === 'first_last' ? '首尾帧(FLF2V)' : '多参考图'}
                                  </button>
                                ))}
                              </div>
                              <button onClick={handleConsistencyCheck}
                                disabled={consistencyChecking || entityCards.filter(c => c.type === 'shot').length === 0}
                                className="w-full mt-0.5 text-[9px] px-2 py-1 rounded bg-[#EF4444] text-white hover:bg-[#EF4444]/80 disabled:opacity-40 flex items-center justify-center gap-0.5">
                                {consistencyChecking ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Eye className="w-2.5 h-2.5" />}
                                开始校验
                              </button>
                            </>
                          )}
                          {svc.id === 'prompt_extend' && (
                            <>
                              <div className="text-[9px] text-foreground/40">Wan2.1 提示词扩展(运动/光线/主体)</div>
                              {entityCards.filter(c => c.type === 'shot' && c.promptEn).map(c => (
                                <button key={c.id} onClick={() => handleExtendPrompt(c.id)}
                                  className="block w-full text-left text-[9px] px-1.5 py-0.5 rounded transition-all text-foreground/40 hover:bg-accent/20">
                                  <Wand2 className="w-2.5 h-2.5 inline mr-0.5" />
                                  镜头{c.shotNumber || ''}: {(c.promptEn || '').slice(0, 20)}...
                                </button>
                              ))}
                              {entityCards.filter(c => c.type === 'shot' && c.promptEn).length === 0 && (
                                <div className="text-[9px] text-foreground/25 text-center py-0.5">暂无镜头提示词</div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ===== 生成模式 ===== */}
          <div className="border-t border-[#F0F0F0] dark:border-border/30 pt-3">
            <div
              className="flex items-center gap-2.5 h-10 cursor-pointer rounded-md hover:bg-black/[0.02] transition-colors -mx-1 px-1"
              onClick={() => setCfgExpand(cfgExpand === 'generation_mode' ? null : 'generation_mode')}
            >
              <div className="w-7 h-7 rounded-full bg-[#FFF3E0] flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-[#FF9800]" />
              </div>
              <span className="text-sm font-medium text-[#333] dark:text-white flex-1">生成模式</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FFEBE6] text-[#FF5630] font-medium">{generationMode === 'sequential' ? '连续' : '并行'}</span>
                {cfgExpand === 'generation_mode' ? <ChevronUp className="w-3.5 h-3.5 text-[#666]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#666]" />}
              </div>
            </div>
            {cfgExpand === 'generation_mode' && (
              <div className="space-y-1.5 py-1.5">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setGenerationMode('sequential')}
                    className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-2 text-[9px] rounded-lg transition-all border ${
                      generationMode === 'sequential'
                        ? 'bg-[#FFEBE6] text-[#FF5630] border-[#FF5630]/20 font-medium'
                        : 'text-[#666] border-[#F0F0F0] hover:bg-black/[0.02] dark:border-border/40 dark:text-white/50'
                    }`}
                  >
                    <Link2 className="w-4 h-4" />
                    <span>连续</span>
                  </button>
                  <button
                    onClick={() => setGenerationMode('parallel')}
                    className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-2 text-[9px] rounded-lg transition-all border ${
                      generationMode === 'parallel'
                        ? 'bg-[#FFEBE6] text-[#FF5630] border-[#FF5630]/20 font-medium'
                        : 'text-[#666] border-[#F0F0F0] hover:bg-black/[0.02] dark:border-border/40 dark:text-white/50'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>并行</span>
                  </button>
                </div>
                <div className="text-[8px] text-[#999] mt-1 px-0.5">
                  {generationMode === 'sequential'
                    ? '连续模式：逐段生成视频，上一段完成再生成下一段，最大视觉连续性'
                    : '并行模式：先确定所有首尾帧，再并行生成视频，速度更快'}
                </div>
              </div>
            )}
          </div>

          {/* ===== 参考素材 ===== */}
          <div className="border-t border-[#F0F0F0] dark:border-border/30 pt-3">
            <div
              className="flex items-center gap-2.5 h-10 cursor-pointer rounded-md hover:bg-black/[0.02] transition-colors -mx-1 px-1"
              onClick={() => setCfgExpand(cfgExpand === 'reference_materials' ? null : 'reference_materials')}
            >
              <div className="w-7 h-7 rounded-full bg-[#E6F7ED] flex items-center justify-center flex-shrink-0">
                <Upload className="w-4 h-4 text-[#36B37E]" />
              </div>
              <span className="text-sm font-medium text-[#333] dark:text-white flex-1">参考素材</span>
              <div className="flex items-center gap-1.5">
                {uploadedFiles.length > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#E6F7ED] text-[#36B37E] font-medium">{uploadedFiles.length}</span>}
                {materials.length > 0 && <span className="text-[9px] text-[#666]">{materials.length}条</span>}
                {cfgExpand === 'reference_materials' ? <ChevronUp className="w-3.5 h-3.5 text-[#666]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#666]" />}
              </div>
            </div>
            {cfgExpand === 'reference_materials' && (
              <div className="space-y-1.5 py-1.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[9px] bg-[#EF4444] hover:bg-[#EF4444]/80 text-white rounded-md transition-all"
                >
                  <Upload className="w-3 h-3" />
                  上传图片/视频/文档
                </button>
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 px-1.5 py-1 rounded bg-accent/20 text-[9px] text-foreground/60">
                    {f.type === 'image' ? <ImageIcon className="w-2.5 h-2.5 text-primary flex-shrink-0" /> :
                     f.type === 'video' ? <Video className="w-2.5 h-2.5 text-primary flex-shrink-0" /> :
                     <FileText className="w-2.5 h-2.5 text-primary flex-shrink-0" />}
                    <span className="flex-1 truncate">{f.name}</span>
                    {f.uploading && <Loader2 className="w-2.5 h-2.5 animate-spin text-primary flex-shrink-0" />}
                    {!f.uploading && <button onClick={() => setUploadedFiles((prev: UploadedFileItem[]) => prev.filter((_, j) => j !== i))} className="text-foreground/30 hover:text-red-400 flex-shrink-0"><X className="w-2.5 h-2.5" /></button>}
                  </div>
                ))}
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={materialInput}
                    onChange={e => setMaterialInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && materialInput.trim()) {
                        setMaterials((prev: MaterialItem[]) => [...prev, { text: materialInput.trim(), type: 'text' }]);
                        setMaterialInput('');
                      }
                    }}
                    placeholder="输入参考素材..."
                    className="flex-1 text-[9px] px-1.5 py-1 rounded bg-accent/20 border border-border/50 focus:outline-none focus:border-primary/50"
                  />
                  <button
                    onClick={() => {
                      if (materialInput.trim()) {
                        setMaterials((prev: MaterialItem[]) => [...prev, { text: materialInput.trim(), type: 'text' }]);
                        setMaterialInput('');
                      }
                    }}
                    className="px-1.5 py-1 rounded bg-primary/10 text-primary"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>
                {materials.map((m, i) => (
                  <div key={i} className="flex items-center gap-1 px-1.5 py-1 rounded bg-accent/20 text-[9px] text-foreground/60">
                    <span className="flex-1 truncate">{m.text}</span>
                    <button onClick={() => setMaterials((prev: MaterialItem[]) => prev.filter((_, j) => j !== i))} className="text-foreground/30 hover:text-red-400">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===== 故事区域：输入 / 剧本&方案跳转（始终可见） ===== */}
        <div id="film-story-area" className="border-b border-border/70">
          {!script ? (
            <div className="p-3 space-y-2">
              <label className="text-sm font-medium text-[#333] dark:text-foreground/80">剧本标题</label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="输入剧本标题与描述，如：小红帽去森林深处看望外婆..."
                className="w-full h-24 text-[11px] rounded-lg border border-border/40 bg-transparent px-2.5 py-1.5 resize-none focus:outline-none focus:border-[#EF4444]/50 focus:ring-1 focus:ring-[#EF4444]/20 placeholder:text-foreground/25"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePlanCreation(); }}
              />

              {/* ===== 网络搜索参考 ===== */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Globe className="w-3 h-3 text-primary/60" />
                  <span className="text-sm font-medium text-[#333] dark:text-foreground/80">搜索参考</span>
                  <span className="text-[9px] text-foreground/25">· 仅供创作灵感，注意版权</span>
                </div>
                <div className="flex gap-1">
                  <div className="flex-1 relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-foreground/25" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleFilmSearch(); }}
                      placeholder="搜索故事背景、角色设定、场景参考..."
                      className="w-full h-7 text-[10px] pl-7 pr-2 rounded-md border border-border/40 bg-transparent focus:outline-none focus:border-primary/40 placeholder:text-foreground/20"
                    />
                  </div>
                  <button
                    onClick={() => setSearchType((prev: string) => prev === 'web' ? 'image' : 'web')}
                    className={`h-7 px-1.5 rounded-md text-[9px] font-medium border transition-all ${
                      searchType === 'image'
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'border-border/30 text-foreground/40 hover:bg-accent/20'
                    }`}
                    title={searchType === 'web' ? '切换图片搜索' : '切换网页搜索'}
                  >
                    {searchType === 'web' ? <FileText className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={handleFilmSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="h-7 px-2.5 rounded-md bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : '搜索'}
                  </button>
                </div>

                {/* 搜索结果 */}
                {showSearchResults && (searchResults.length > 0 || isSearching) && (
                  <div className="border border-border/30 rounded-lg overflow-hidden">
                    {/* AI 摘要 */}
                    {searchSummary && (
                      <div className="px-2 py-1.5 bg-primary/5 border-b border-border/20">
                        <div className="text-[9px] text-primary/60 font-medium mb-0.5">AI 摘要</div>
                        <div className="text-[10px] text-foreground/70 leading-relaxed">{searchSummary}</div>
                      </div>
                    )}

                    {/* 结果列表 */}
                    <div className="max-h-48 overflow-y-auto">
                      {isSearching && searchResults.length === 0 && (
                        <div className="flex items-center justify-center py-4 gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin text-primary/50" />
                          <span className="text-[10px] text-foreground/40">搜索中...</span>
                        </div>
                      )}
                      {searchResults.map((result) => (
                        <div
                          key={result.id}
                          className="px-2 py-1.5 border-b border-border/15 last:border-0 hover:bg-accent/20 transition-colors"
                        >
                          {searchType === 'image' && result.imageUrl && (
                            <div className="mb-1">
                              <img
                                src={result.imageUrl}
                                alt={result.title}
                                className="w-full h-20 object-cover rounded"
                                loading="lazy"
                              />
                            </div>
                          )}
                          <div className="flex items-start gap-1">
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-medium text-foreground/80 truncate">{result.title}</div>
                              {result.snippet && (
                                <div className="text-[9px] text-foreground/50 line-clamp-2 mt-0.5">{result.snippet}</div>
                              )}
                              {result.source && (
                                <div className="text-[9px] text-foreground/30 mt-0.5 flex items-center gap-0.5">
                                  <ExternalLink className="w-2 h-2" />{result.source}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => appendSearchRef(result)}
                              className="shrink-0 h-5 px-1.5 rounded text-[9px] text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors"
                              title="引用到故事描述"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 版权提示 */}
                    {copyrightNotice && (
                      <div className="px-2 py-1 bg-amber-500/5 border-t border-amber-500/20">
                        <div className="flex items-start gap-1">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-500/60 shrink-0 mt-0.5" />
                          <span className="text-[8px] text-amber-600/60 leading-tight">{copyrightNotice}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => handlePlanCreation()}
                disabled={isGenerating || !inputText.trim()}
                className="w-full py-2 rounded-lg bg-[#EF4444] text-white text-[11px] font-medium hover:bg-[#EF4444]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isGenerating ? '生成中...' : '开始创作'}
              </button>
            </div>
          ) : (
            <div className="p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-foreground/70 truncate">{script.title || '未命名剧本'}</span>
                <button onClick={() => handlePlanCreation()} disabled={isGenerating} className="text-[9px] text-primary/60 hover:text-primary transition-colors">
                  {isGenerating ? '重新生成中...' : '重新规划'}
                </button>
              </div>
              {/* 剧本 & 方案跳转按钮 */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setStoryTab('screenplay'); if (phase !== 'planning') { setPhase('planning'); setTimeout(() => scriptScreenplayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300); } else { scriptScreenplayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}
                  className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all border ${
                    storyTab === 'screenplay'
                      ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
                      : 'border-border/30 text-foreground/50 hover:bg-accent/20'
                  }`}
                >
                  <span className="mr-1">🎬</span>场景剧本
                </button>
                <button
                  onClick={() => { setStoryTab('director'); if (phase !== 'planning') { setPhase('planning'); setTimeout(() => scriptDirectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300); } else { scriptDirectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}
                  className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all border ${
                    storyTab === 'director'
                      ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
                      : 'border-border/30 text-foreground/50 hover:bg-accent/20'
                  }`}
                >
                  <span className="mr-1">📋</span>导演方案
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 左栏底部：生成模式卡片 + 操作按钮 */}
        <div className="px-2.5 py-2 border-t border-[#F0F0F0] dark:border-border/70 mt-auto">
          {/* 生成模式卡片 */}
          <div className="rounded-lg bg-white dark:bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden mb-2">
            <div
              className="flex items-center gap-2.5 px-3 h-10 cursor-pointer hover:bg-black/[0.02] transition-colors"
              onClick={() => setEnhancePanelOpen(!enhancePanelOpen)}
            >
              <div className="w-7 h-7 rounded-full bg-[#FFEBE6] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-[#FF5630]" />
              </div>
              <span className="text-sm font-medium text-[#333] dark:text-white flex-1">素材增强</span>
              {enhancePanelOpen ? <ChevronUp className="w-3.5 h-3.5 text-[#666]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#666]" />}
            </div>
            {enhancePanelOpen && (
              <div className="px-3 pb-3 space-y-3 border-t border-[#F0F0F0] pt-3">
                {/* 增强操作网格 */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={handleEnhanceCharacters}
                    disabled={isGenerating || entityCards.filter(c => c.type === 'character').length === 0}
                    className="flex items-center gap-1 px-2 py-1.5 text-[9px] rounded-lg bg-[#FFEBE6] text-[#FF5630] hover:bg-[#FFEBE6]/80 transition-colors disabled:opacity-40 font-medium"
                  >
                    <Users className="w-3 h-3" /> 增强角色
                  </button>
                  <button
                    onClick={handleEnhanceScenes}
                    disabled={isGenerating || entityCards.filter(c => c.type === 'scene').length === 0}
                    className="flex items-center gap-1 px-2 py-1.5 text-[9px] rounded-lg bg-[#FFF1E6] text-[#FFAB00] hover:bg-[#FFF1E6]/80 transition-colors disabled:opacity-40 font-medium"
                  >
                    <Mountain className="w-3 h-3" /> 增强场景
                  </button>
                  <button
                    onClick={handleGenerateProps}
                    disabled={isGenerating || entityCards.filter(c => c.type === 'plot').length === 0}
                    className="flex items-center gap-1 px-2 py-1.5 text-[9px] rounded-lg bg-[#F3E8FF] text-[#9966FF] hover:bg-[#F3E8FF]/80 transition-colors disabled:opacity-40 font-medium"
                  >
                    <Package className="w-3 h-3" /> 生成道具
                  </button>
                  <button
                    onClick={handleGenerateAllAssets}
                    disabled={isGenerating || entityCards.length === 0}
                    className="flex items-center gap-1 px-2 py-1.5 text-[9px] rounded-lg bg-[#E6F7ED] text-[#36B37E] hover:bg-[#E6F7ED]/80 transition-colors disabled:opacity-40 font-medium"
                  >
                    <Images className="w-3 h-3" /> 批量素材
                  </button>
                  <button
                    onClick={() => {
                      const videoCards = entityCards.filter(c => c.type === 'shot' && c.videoUrl && !c.lastFrameUrl);
                      videoCards.forEach(c => handleExtractLastFrame(c.id));
                    }}
                    disabled={isGenerating || entityCards.filter(c => c.type === 'shot' && c.videoUrl).length === 0}
                    className="flex items-center gap-1 px-2 py-1.5 text-[9px] rounded-lg bg-[#E6F7ED] text-[#36B37E] hover:bg-[#E6F7ED]/80 transition-colors disabled:opacity-40 font-medium"
                  >
                    <Film className="w-3 h-3" /> 提取尾帧
                  </button>
                  <button
                    onClick={handleBridgeFrames}
                    disabled={isBridging || entityCards.filter(c => c.type === 'shot' && c.endFrameUrl).length < 2}
                    className="flex items-center gap-1 px-2 py-1.5 text-[9px] rounded-lg bg-[#FFF1E6] text-[#FFAB00] hover:bg-[#FFF1E6]/80 transition-colors disabled:opacity-40 font-medium"
                    title="桥接首尾帧：用上一镜头尾帧重新生成下一镜头首帧，确保相邻镜头视觉连贯"
                  >
                    <GitMerge className="w-3 h-3" /> {isBridging ? '桥接中...' : '桥接帧'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部操作栏（固定在左栏底部） */}
        <div className="px-3 py-2.5 border-t border-border/70 flex-shrink-0 bg-card">
          <div className="flex gap-2">
            <button
              onClick={handleGenerateAllAssets}
              disabled={isGenerating || entityCards.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium rounded-lg border border-red-500 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
            >
              <Images className="w-3.5 h-3.5" /> 批量生成
            </button>
            <button
              onClick={() => {
                if (entityCards.some(c => c.type === 'shot' && c.videoUrl)) {
                  goToPhase('compose');
                  setTimeout(() => handleComposeFilm(), 100);
                } else {
                  handleGenerateAllVideos();
                }
              }}
              disabled={isGenerating || entityCards.filter(c => c.type === 'shot').length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold rounded-lg bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 transition-all disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5" /> 合成影片
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
