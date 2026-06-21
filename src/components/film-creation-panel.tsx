"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Film, Wand2, Loader2, AlertCircle, Sparkles,
  Clapperboard, UserCircle, Image as ImageIcon, Box,
  ChevronRight, ChevronLeft, Send, RotateCcw, FileText,
  MessageSquare, Type, LayoutGrid,
  CheckCircle2, Eye, ImagePlus, Paperclip, X,
  Settings, Palette, Check, PenLine,
  Upload, Link2, FileUp, Video, Plus, Trash2,
  Play, Pause, Volume2, Download, Subtitles, Music, Mic,
  ChevronDown, ArrowRight, RefreshCw, Layers, Combine,
  AlertTriangle, Bot, History, Users, Mountain, Images,
  Shield, FileDown, Zap, XCircle, BookOpen, ArrowLeft,
  Search, Globe, ExternalLink, Copy, GitMerge, Package,
  Activity, Expand, Shrink, ChevronUp, Clock,
} from 'lucide-react';
import type { FilmScript, FilmShot } from '@/types/film';
import { useFilmHistory, type FilmHistoryItem, type EntityCardSnapshot, type ChatMessageSnapshot } from '@/hooks/useFilmHistory';
import { useFilmAssetGeneration } from '@/hooks/useFilmAssetGeneration';
import { useFilmFrameGeneration } from '@/hooks/useFilmFrameGeneration';
import { useFilmChatFlow, useFilmQuickCommand, useFilmWorkflowCommand } from '@/hooks/useFilmWorkflowCommand';
import { useFilmPlanCreation } from '@/hooks/useFilmPlanCreation';
import { useFilmShotVideoGeneration } from '@/hooks/useFilmShotVideoGeneration';
import { downloadTextAsPDF } from '@/lib/pdf-export';
import { getBYOKRequestHeaders } from '@/lib/byok-client';
import { getBgmTypeList, matchBgmByKeywords, type BgmTypeId } from '@/constants/bgm-types';
import type { CharacterAnchor, GridPromptInput, ConsistencyCheckResult } from '@/lib/video-production/character-consistency-engine';
import { buildFilmAnchorContext, buildFilmReferenceImages } from '@/lib/film-reference-context';
import { FilmEditableField, type FilmEditableFieldProps } from '@/components/film/film-editable-field';
import { FilmChatMessage } from '@/components/film/film-creation-chat';
import {
  FilmCompliancePanel,
  FilmDirectorAnalysisPanel,
  type FilmComplianceResult,
  type FilmDirectorAnalysis,
} from '@/components/film/film-quality-panels';
import { FilmDirectorPlanPanel } from '@/components/film/film-director-plan-panel';
import { FilmEntityPlanningGrid } from '@/components/film/film-entity-planning-grid';
import { FilmScreenplayPanel } from '@/components/film/film-screenplay-panel';
import { FilmScriptProgressPanel } from '@/components/film/film-script-progress-panel';
import { FilmVisualStageToolbar } from '@/components/film/film-visual-stage-toolbar';
import { FilmVisualStageHeader } from '@/components/film/film-visual-stage-header';
import { FilmVisualProgressPanel, type FilmVisualGenerationStage } from '@/components/film/film-visual-progress-panel';
import { FilmVisualCardSection } from '@/components/film/film-visual-card-section';
import { FilmComposeStageHeader } from '@/components/film/film-compose-stage-header';
import { FilmComposeShotList } from '@/components/film/film-compose-shot-list';
import { FilmCreationLogPanel } from '@/components/film/film-creation-log-panel';
import { FilmWorkflowSidebar } from '@/components/film/film-workflow-sidebar';
import { FilmMainStageWorkspace } from '@/components/film/film-main-stage-workspace';
import { FilmCreationDialogs } from '@/components/film/film-creation-dialogs';
import {
  entityCardToSnapshot,
  renderSafe,
  snapshotToEntityCard,
  type ChatMessage,
  type EntityCard,
  type FilmCreationPanelProps,
  type WorkflowPhase,
} from '@/lib/film-creation-panel-model';

// 全局视觉风格映射使用共享模块
import { buildStyleLockedPrompt, buildEnhancedNegative } from '@/lib/visual-style-map';

// ============================================================
// 主组件
// ============================================================
export function FilmCreationPanel({
  initialPrompt,
  autoGenerate,
  targetService,
  transferredData,
  onScriptGenerated,
  onStoryboardGenerated,
  onVideoGenerated,
}: FilmCreationPanelProps) {
  // ---- 工具函数 ----
  const formatDuration = useCallback((seconds: number): string => {
    if (seconds < 60) return `${seconds}秒`;
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return sec > 0 ? `${min}分${sec}秒` : `${min}分钟`;
  }, []);

  // ---- 影视创作历史记录 ----
  const { filmHistory, upsertFilmHistory, deleteFilmHistory, clearFilmHistory } = useFilmHistory();
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showLogPanel, setShowLogPanel] = useState(true);
  const [showChatMessages, setShowChatMessages] = useState(true);

  // ---- 三阶段状态 ----
  const [phase, setPhase] = useState<WorkflowPhase>('planning');
  const [inputText, setInputText] = useState(initialPrompt || '');
  const [style, setStyle] = useState('写实电影感');
  const [targetDuration, setTargetDuration] = useState(180);
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoGenerateAssets, setAutoGenerateAssets] = useState(false);
  // 生成模式：sequential=顺序(最大连续性) / parallel=并行(最快速度)
  const [generationMode, setGenerationMode] = useState<'sequential' | 'parallel'>('parallel');
  // 图片预览URL
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  // 桥接首尾帧状态
  const [isBridging, setIsBridging] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState('');

  // 生成进度追踪 — 阶段化进度条
  const [generationStage, setGenerationStage] = useState<FilmVisualGenerationStage>('idle');
  const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0, currentName: '' });

  // 流式文本状态 — 用于中间栏实时展示剧本生成过程
  const [streamingScriptText, setStreamingScriptText] = useState('');
  const [middleAiStatus, setMiddleAiStatus] = useState<{text: string; type: 'thinking' | 'responding' | 'done' | 'error'} | null>(null);

  // 视觉风格
  const [filmVisualStyle, setFilmVisualStyle] = useState('');

  // 配音与BGM
  const [filmTtsVoice, setFilmTtsVoice] = useState('Chinese_Female_Gentle');
  const [filmTtsSpeed, setFilmTtsSpeed] = useState(1.0);
  const [filmBgmType, setFilmBgmType] = useState<'none' | 'gentle' | 'cheerful' | 'cinematic' | 'emotional'>('none');
  const [filmBgmVolume, setFilmBgmVolume] = useState(0.5);

  // ---- 阶段1：创作规划 ----
  const [script, setScript] = useState<FilmScript | null>(null);
  const [entityCards, setEntityCards] = useState<EntityCard[]>([]);
  // Ref用于在批量异步循环中读取最新entityCards状态
  const entityCardsRef = useRef(entityCards);
  entityCardsRef.current = entityCards;
  // buildReferenceImages ref（避免声明顺序依赖）
  const buildReferenceImagesRef = useRef<(card: EntityCard, continuityRef?: string) => string[]>(() => []);
  // 桥接首尾帧进度状态
  const [bridgeProgress, setBridgeProgress] = useState<{ current: number; total: number; phase: string } | null>(null);
  const [scriptDisplayTab, setScriptDisplayTab] = useState<'screenplay' | 'director'>('screenplay');
  const [directorAnalysis, setDirectorAnalysis] = useState<FilmDirectorAnalysis | null>(null);
  const [showDirectorPanel, setShowDirectorPanel] = useState(false);
  const [showScriptPreview, setShowScriptPreview] = useState(false);
  const screenplayRef = useRef<HTMLDivElement>(null);
  const directorPlanRef = useRef<HTMLDivElement>(null);
  const rightLogPanelRef = useRef<HTMLDivElement>(null);

  // ---- 网络搜索参考 ----
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string; title: string; source: string; url: string;
    snippet: string; summary?: string; imageUrl?: string; width?: number; height?: number;
  }>>([]);
  const [searchSummary, setSearchSummary] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchType, setSearchType] = useState<'web' | 'image'>('web');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [copyrightNotice, setCopyrightNotice] = useState('');

  // ---- 合规检测结果 ----
  const [complianceResult, setComplianceResult] = useState<FilmComplianceResult | null>(null);
  const [complianceChecking, setComplianceChecking] = useState(false);
  const entityCardsGridRef = useRef<HTMLDivElement>(null);

  // ---- 阶段2：画面生成 ----


  // ---- 阶段3：视频合成 ----
  const [composeProgress, setComposeProgress] = useState<Record<string, number>>({});
  const [expandedShotIds, setExpandedShotIds] = useState<Set<string>>(new Set());
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [composeStatus, setComposeStatus] = useState<'idle' | 'generating' | 'merging' | 'completed'>('idle');

  // ---- 合成阶段镜头自动展开/收起 ----
  useEffect(() => {
    const shotCards = entityCards.filter(c => c.type === 'shot');
    const next = new Set(expandedShotIds);
    let changed = false;
    for (const card of shotCards) {
      if (card.isGenerating && !next.has(card.id)) {
        // 正在生成 → 自动展开
        next.add(card.id);
        changed = true;
      } else if (!card.isGenerating && next.has(card.id) && card.imageUrl) {
        // 生成完成 → 自动收起
        next.delete(card.id);
        changed = true;
      }
    }
    if (changed) setExpandedShotIds(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityCards]);

  // ---- 生成日志系统 ----
  type LogStatus = 'generating' | 'completed' | 'error' | 'waiting';
  interface GenerationLogEntry {
    id: string;
    shotIndex: number;
    shotLabel: string;
    action: string;
    status: LogStatus;
    progress: number;
    startTime: string;
    endTime?: string;
    duration?: string;
    error?: string;
  }
  const [generationLogs, setGenerationLogs] = useState<GenerationLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<string>('all');
  const [enhancePanelOpen, setEnhancePanelOpen] = useState(false);
  const [expandedPhaseSection, setExpandedPhaseSection] = useState<'planning' | 'visual' | 'compose' | 'gen-logs' | null>(null);

  const addGenLog = useCallback((shotIndex: number, shotLabel: string, action: string, status: LogStatus, progress = 0, error?: string) => {
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setGenerationLogs(prev => {
      const existing = prev.find(l => l.shotIndex === shotIndex && l.action === action && l.status === 'generating');
      if (existing) {
        return prev.map(l => l.id === existing.id ? { ...l, status, progress, endTime: status !== 'generating' ? new Date().toLocaleTimeString() : undefined, duration: status !== 'generating' ? `${Math.round((Date.now() - new Date(existing.startTime).getTime()) / 1000)}秒` : undefined, error } : l);
      }
      return [{ id, shotIndex, shotLabel, action, status, progress, startTime: new Date().toLocaleTimeString(), error }, ...prev].slice(0, 50);
    });
  }, []);

  // ---- 人物一致性系统 (Wan2.1 + huobao) ----
  const [consistencyMode, setConsistencyMode] = useState<'first_frame' | 'first_last' | 'multi_ref'>('first_frame');
  const [consistencyChecking, setConsistencyChecking] = useState(false);
  const [consistencyResults, setConsistencyResults] = useState<ConsistencyCheckResult | null>(null);
  const [showConsistencyPanel, setShowConsistencyPanel] = useState(false);

  // ---- 剧本/方案跳转 ----
  const [storyTab, setStoryTab] = useState<'screenplay' | 'director'>('screenplay');
  const scriptScreenplayRef = useRef<HTMLDivElement>(null);
  const scriptDirectorRef = useRef<HTMLDivElement>(null);

  // ---- BigBanana AI Director: 镜头工作台视图模式 ----
  const [shotViewMode, setShotViewMode] = useState<'grid' | 'list' | 'keyframe'>('grid');
  const [nineGridDialogCardId, setNineGridDialogCardId] = useState<string | null>(null);
  const [wardrobeDialogCardId, setWardrobeDialogCardId] = useState<string | null>(null);
  const [promptManagerOpen, setPromptManagerOpen] = useState(false);

  // ---- 左栏 ----
  const [cfgExpand, setCfgExpand] = useState<string | null>(null);
  const [consistencySvcExpand, setConsistencySvcExpand] = useState<string | null>(null);
  const [refEntitiesExpanded, setRefEntitiesExpanded] = useState(true);
  const [assetCardsExpanded, setAssetCardsExpanded] = useState(true);
  const cfgHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [wsFilter, setWsFilter] = useState<string>('all');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const [selectedService, setSelectedService] = useState<string>('storyboard_script');
  const [visualStyle, setVisualStyle] = useState('真人写实风格');
  const [scriptType, setScriptType] = useState('短剧剧本');
  const [wordCount, setWordCount] = useState('2000');
  const [videoDuration, setVideoDuration] = useState(8);
  const [videoRatio, setVideoRatio] = useState('16:9');
  const [selectedModel, setSelectedModel] = useState('auto');
  const [voiceType, setVoiceType] = useState('女声-温柔');
  const [bgmType, setBgmType] = useState<BgmTypeId>('none');
  // 创作规划自定义内容
  const [customScriptType, setCustomScriptType] = useState('');
  const [customDuration, setCustomDuration] = useState('');
  const [customCharStyle, setCustomCharStyle] = useState('');
  const [customSceneStyle, setCustomSceneStyle] = useState('');
  const [customPropStyle, setCustomPropStyle] = useState('');
  const [bgmVolume, setBgmVolume] = useState<'low' | 'medium' | 'high'>('medium');
  const [sfxType, setSfxType] = useState<string | null>(null);
  const [sfxVolume, setSfxVolume] = useState<'low' | 'medium' | 'high'>('medium');
  const [bgmPreviewUrl, setBgmPreviewUrl] = useState<string | null>(null);
  const [bgmPreviewPlaying, setBgmPreviewPlaying] = useState(false);

  // ---- 音色试听 ----
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState<string | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);

  // ---- 素材 ----
  const [materialInput, setMaterialInput] = useState('');

  // ---- 自动根据剧本推断BGM类型 ----
  useEffect(() => {
    if (!script) return;
    // 1. 优先使用剧本的bgmSuggestion
    if (script.bgmSuggestion) {
      const matched = matchBgmByKeywords(script.bgmSuggestion);
      if (matched) { setBgmType(matched.id); return; }
    }
    // 2. 从emotionCurve推断
    if (script.emotionCurve) {
      const matched = matchBgmByKeywords(script.emotionCurve);
      if (matched) { setBgmType(matched.id); return; }
    }
    // 3. 从剧情关键词推断
    if (script.title || script.coreTheme || script.style) {
      const text = [script.style, script.coreTheme, script.title].filter(Boolean).join(' ');
      const matched = matchBgmByKeywords(text);
      if (matched) { setBgmType(matched.id); return; }
    }
  }, [script?.bgmSuggestion, script?.emotionCurve, script?.coreTheme, script?.title, script?.style]);
  const [materials, setMaterials] = useState<{ text: string; type: 'text' | 'url' | 'image'; url?: string }[]>([]);

  // ---- 上传文件 ----
  const [uploadedFiles, setUploadedFiles] = useState<{
    id: string;
    name: string;
    type: 'image' | 'video' | 'document';
    url: string;
    localPreview?: string;
    size: number;
    uploading?: boolean;
  }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);

  // ---- 图片预览 ----
  const [wsPreviewUrl, setWsPreviewUrl] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      const id = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const fileType = file.type.startsWith('image/') ? 'image' as const
        : file.type.startsWith('video/') ? 'video' as const
        : 'document' as const;
      const localPreview = fileType === 'image' ? URL.createObjectURL(file) : fileType === 'video' ? URL.createObjectURL(file) : undefined;

      // 先添加本地预览
      setUploadedFiles(prev => [...prev, {
        id, name: file.name, type: fileType,
        url: '', localPreview, size: file.size, uploading: true,
      }]);

      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload/material', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          setUploadedFiles(prev => prev.map(f =>
            f.id === id ? { ...f, url: data.url, uploading: false } : f
          ));
        } else {
          setUploadedFiles(prev => prev.map(f =>
            f.id === id ? { ...f, uploading: false } : f
          ));
        }
      } catch {
        setUploadedFiles(prev => prev.map(f =>
          f.id === id ? { ...f, uploading: false } : f
        ));
      }
    }
  }, []);

  // ---- 工作流对话（左栏）----
  const [workflowMessages, setWorkflowMessages] = useState<{
    id: string;
    role: 'system' | 'assistant' | 'user' | 'info' | 'success' | 'error';
    content: string;
    step?: string;
    msgType?: 'progress' | 'success' | 'error' | 'info';
    nextStep?: string;
    timestamp: number;
  }[]>([
    {
      id: 'wf-welcome',
      role: 'assistant',
      content: '欢迎使用影视创作！请在右侧对话栏输入指令，我会引导你完成整个流程。',
      step: 'init',
      msgType: 'info',
      nextStep: '生成创作规划',
      timestamp: Date.now(),
    },
  ]);
  const [workflowInput, setWorkflowInput] = useState('');
  const workflowEndRef = useRef<HTMLDivElement>(null);

  // ---- 右栏对话 ----
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是影视创作助手。告诉我你的创作方向和核心需求，我会帮你完成完整的影视创作流程。\n\n你也可以直接发送指令控制创作：\n• "生成创作规划" — AI自动生成剧本\n• "增强角色" — AI优化角色外貌描述\n• "增强场景" — AI增强场景并生成氛围图\n• "生成道具" — AI提取道具并生成参考图\n• "三视图" — 生成角色正面/侧面/背面参考图\n• "生成分镜图" — 为当前镜头生成画面\n• "生成视频" — 为当前镜头生成视频\n• "批量素材" — 一键生成所有角色+场景+道具+分镜图\n• "合成视频" — 将所有镜头合成为完整影片\n• "重新合成" — 重新合成影片（修改素材后使用）',
      timestamp: Date.now(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [chatPlaceholder, setChatPlaceholder] = useState('输入指令或向AI提问...');
  const [chatInputHighlight, setChatInputHighlight] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // ---- 自动保存历史记录（entityCards 或 phase 变化时） ----
  const lastSavedHistoryRef = useRef<string>('');
  useEffect(() => {
    // 仅在有实体卡片时才保存
    if (entityCards.length === 0) return;
    // 去重：相同数据不重复保存
    const fingerprint = `${inputText}|${entityCards.length}|${entityCards.filter(c => c.imageUrl).length}|${phase}`;
    if (fingerprint === lastSavedHistoryRef.current) return;
    lastSavedHistoryRef.current = fingerprint;
    // 延迟保存，避免频繁写入
    const timer = setTimeout(() => {
      upsertFilmHistory({
        title: (script?.title || inputText.trim()).slice(0, 50) || '未命名创作',
        prompt: inputText.trim(),
        script: script as unknown as Record<string, unknown>,
        phase,
        entityCards: entityCards.map(entityCardToSnapshot),
        chatMessages: chatMessages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        filmVisualStyle,
        imagesGenerated: entityCards.filter(c => c.imageUrl).length,
        videosGenerated: entityCards.filter(c => c.videoUrl).length,
        finalVideoUrl,
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [entityCards, phase, inputText, script, chatMessages, filmVisualStyle, finalVideoUrl, upsertFilmHistory]);

  // 从对话中提取的参数（SSE params事件），用于"基于对话创作"
  const [extractedParams, setExtractedParams] = useState<Record<string, string | number | null>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ---- 工作流消息辅助 ----
  const addWorkflowMsg = useCallback((
    role: 'system' | 'assistant' | 'user' | 'info' | 'success' | 'error',
    content: string,
    step?: string,
    msgType?: 'progress' | 'success' | 'error' | 'info',
    nextStep?: string
  ) => {
    setWorkflowMessages(prev => [...prev, {
      id: `wf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role, content, step, msgType: msgType || (role === 'success' ? 'success' : role === 'error' ? 'error' : role === 'info' ? 'info' : undefined), nextStep, timestamp: Date.now(),
    }]);
    // 自动滚动到底部
    setTimeout(() => workflowEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  // ---- 实体卡片字段编辑辅助 ----
  const updateCardField = useCallback((cardId: string, field: string, value: string | number | string[]) => {
    setEntityCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, [field]: value } : c
    ));
  }, []);

  const EditableField = useCallback(
    (props: Omit<FilmEditableFieldProps, 'onUpdate'>) => (
      <FilmEditableField {...props} onUpdate={updateCardField} />
    ),
    [updateCardField]
  );

  // ---- 自动生成 ----
  const autoGenerateRef = useRef(false);

  // ============================================================
  // 网络搜索参考
  // ============================================================
  const handleFilmSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    setSearchSummary('');
    setShowSearchResults(true);
    try {
      const res = await fetch('/api/film/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim(), type: searchType, count: 8 }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      if (searchType === 'image') {
        setSearchResults(data.results || []);
      } else {
        setSearchResults(data.results || []);
        setSearchSummary(data.summary || '');
      }
      setCopyrightNotice(data.copyrightNotice || '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '搜索失败';
      setError(msg);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchType]);

  // 将搜索结果引用添加到故事输入
  const appendSearchRef = useCallback((result: typeof searchResults[0]) => {
    const refText = searchType === 'image'
      ? `\n[参考图: ${result.title} - ${result.imageUrl}]`
      : `\n[参考: ${result.title} - ${result.snippet?.slice(0, 100) || ''}]`;
    setInputText(prev => prev + refText);
  }, [searchType]);

  // ============================================================
  // 合规检测 - 使用 AIGC 合规助手技能
  // ============================================================
  const handleComplianceCheck = useCallback(async (prompt: string, filmScript: FilmScript) => {
    try {
      setComplianceResult(null);
      addWorkflowMsg('assistant', '正在进行内容合规检测...', 'progress');

      const scriptText = [
        `标题：${filmScript.title}`,
        `风格：${filmScript.style}`,
        `剧情：${filmScript.narrationScript || ''}`,
        `角色列表：${(filmScript.characters || []).map((c: { name: string; description?: string }) => `${c.name}(${c.description || ''})`).join('、')}`,
        `场景列表：${(filmScript.scenes || []).map((s: { name: string; description?: string }) => `${s.name}(${s.description || ''})`).join('、')}`,
        `用户输入：${prompt}`,
      ].join('\n');

      const response = await fetch('/api/compliance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: scriptText,
          type: 'video',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || '合规检测请求失败');
      }

      const json = await response.json();
      const data = json.data || json; // 兼容 {success, data} 包装和直接返回
      setComplianceResult(data);

      if (data.overallRisk === 'high' || data.overallRisk === 'critical') {
        addWorkflowMsg('assistant', `⚠️ 合规检测发现高风险内容：${data.issues?.filter((i: { riskLevel: string }) => i.riskLevel === 'high' || i.riskLevel === 'critical').length || 0} 个高风险项，请查看详情并修改。`, 'error');
      } else if (data.overallRisk === 'medium') {
        addWorkflowMsg('assistant', `⚠️ 合规检测发现中风险内容：${data.issues?.length || 0} 个需要关注的问题。`, 'info');
      } else {
        addWorkflowMsg('assistant', '✅ 合规检测通过，内容安全，可以继续创作。', 'success');
      }
    } catch (err) {
      console.warn('合规检测失败（非阻塞）：', err);
      // 合规检测失败不阻塞创作流程
    }
  }, [addWorkflowMsg]);

  const { handlePlanCreation } = useFilmPlanCreation({
    addWorkflowMsg,
    chatMessages,
    directorAnalysis,
    extractedParams,
    filmVisualStyle,
    handleComplianceCheck,
    inputText,
    materials,
    onScriptGenerated,
    selectedModel,
    setAutoGenerateAssets,
    setDirectorAnalysis,
    setEntityCards,
    setError,
    setFilmVisualStyle,
    setIsBridging,
    setIsGenerating,
    setMiddleAiStatus,
    setPhase,
    setProgressMsg,
    setScript,
    setShowDirectorPanel,
    setShowSearchResults,
    setStreamingScriptText,
    style,
    targetDuration,
    upsertFilmHistory,
    uploadedFiles,
    videoDuration,
    videoRatio,
    visualStyle,
  });

  // 导出PDF
  const handleExportPDF = useCallback(() => {
    const sections: { title: string; content: string }[] = [];
    if (script) {
      sections.push({ title: '剧本概要', content: script.narrationScript || script.title || '' });
      if (script.shots && script.shots.length > 0) {
        sections.push({
          title: '分镜列表',
          content: script.shots.map((s: FilmShot, i: number) =>
            `镜头${i + 1}: ${s.content} | 运镜: ${s.cameraMovement} | 对白: ${s.dialogue || ''}`
          ).join('\n'),
        });
      }
    }
    // 按类型分组导出实体卡片
    const typeOrder: EntityCard['type'][] = ['plot', 'character', 'scene', 'shot'];
    const typeLabels: Record<string, string> = { plot: '剧情', character: '角色', scene: '场景', prop: '道具', shot: '分镜' };
    typeOrder.forEach(type => {
      const cards = entityCards.filter(c => c.type === type);
      if (cards.length === 0) return;
      cards.forEach(c => {
        const lines: string[] = [];
        if (c.name) lines.push(c.name);
        if (c.description) lines.push(c.description);
        if (c.promptCn) lines.push(c.promptCn);
        // 角色属性
        if (c.gender) lines.push(`性别: ${c.gender}`);
        if (c.age) lines.push(`年龄: ${c.age}`);
        if (c.appearance) lines.push(`外貌: ${c.appearance}`);
        if (c.personality) lines.push(`性格: ${c.personality}`);
        if (c.outfit) lines.push(`服装: ${c.outfit}`);
        // 场景属性
        if (c.location) lines.push(`地点: ${c.location}`);
        if (c.timeOfDay) lines.push(`时间: ${c.timeOfDay}`);
        if (c.mood) lines.push(`氛围: ${c.mood}`);
        // 分镜属性
        if (c.shotType) lines.push(`镜头类型: ${c.shotType}`);
        if (c.cameraAngle) lines.push(`摄像机角度: ${c.cameraAngle}`);
        if (c.action) lines.push(`动作: ${c.action}`);
        if (c.dialogue) lines.push(`对白: ${c.dialogue}`);
        if (c.narration) lines.push(`旁白: ${c.narration}`);
        if (c.subtitleText) lines.push(c.subtitleText);
        const content = lines.join('\n');
        if (content) {
          sections.push({ title: `[${typeLabels[type]}] ${c.name || type}`, content });
        }
      });
    });
    if (sections.length > 0) {
      downloadTextAsPDF(`影视创作_${new Date().toLocaleDateString('zh-CN')}.pdf`, sections);
    }
  }, [script, entityCards]);

  // ============================================================
  // 阶段1.5：智能增强 - 使用 character-prompt / scene-generate / character-views 增强
  // ============================================================

  // 使用 character-prompt API 增强角色描述
  const handleEnhanceCharacters = useCallback(async () => {
    const characterCards = entityCards.filter(c => c.type === 'character');
    if (characterCards.length === 0) return;

    addWorkflowMsg('assistant', '正在使用AI增强角色描述...', 'progress');
    setProgressMsg('增强角色描述...');

    try {
      const res = await fetch('/api/film/character-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
        body: JSON.stringify({
          text: inputText,
          style: visualStyle || style,
          characterCount: characterCards.length,
          filmVisualStyle: filmVisualStyle || undefined,
        }),
      });

      if (!res.ok) throw new Error('角色描述增强失败');
      const data = await res.json();

      if (data.characters?.length > 0) {
        setEntityCards(prev => prev.map(card => {
          if (card.type !== 'character') return card;
          // 匹配最接近的角色
          const matched = data.characters.find((dc: Record<string, string>) =>
            dc.name === card.name || card.name.includes(dc.name) || dc.name?.includes(card.name)
          );
          if (!matched) return card;
          // 注入风格锁定到AI增强的promptEn
          const enhancedPromptEn = matched.prompt_en
            ? (filmVisualStyle ? buildStyleLockedPrompt(matched.prompt_en, filmVisualStyle) : matched.prompt_en)
            : card.promptEn;
          return {
            ...card,
            appearance: matched.appearance || card.appearance,
            personality: matched.personality || card.personality,
            outfit: matched.outfit || card.outfit,
            promptEn: enhancedPromptEn,
            promptCn: [card.promptCn, matched.appearance ? `外貌: ${matched.appearance}` : '', matched.outfit ? `服装: ${matched.outfit}` : ''].filter(Boolean).join('\n'),
            isPromptGenerated: true,
          };
        }));
        addWorkflowMsg('assistant', `角色描述增强完成，已优化 ${data.characters.length} 个角色`, 'success', 'success', '下一步：点击角色卡片的「三视图」按钮生成参考图');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '角色描述增强失败';
      addWorkflowMsg('assistant', `角色描述增强失败：${msg}`, 'error');
    }
    setProgressMsg('');
  }, [entityCards, inputText, visualStyle, style, filmVisualStyle, addWorkflowMsg]);

  // 使用 character-views API 生成角色三视图
  const handleGenerateCharacterViews = useCallback(async (cardId: string) => {
    const card = entityCards.find(c => c.id === cardId);
    if (!card || card.type !== 'character') return;

    setEntityCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, isGenerating: true } : c
    ));
    addWorkflowMsg('assistant', `正在生成角色「${card.name}」三视图...`, 'progress');

    try {
      const res = await fetch('/api/film/character-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterName: card.name,
          promptEn: card.promptEn,
          appearance: card.appearance || card.promptCn,
          style: visualStyle || style,
          filmVisualStyle: filmVisualStyle || undefined,
        }),
      });

      if (!res.ok) throw new Error('角色三视图生成失败');
      const data = await res.json();

      if (data.success) {
        // 兼容两种格式：新格式(imageUrl)和旧格式(views数组)
        const imageUrl = data.imageUrl || (data.views?.find((v: Record<string, unknown>) => v.view === 'front')?.imageUrl) || (data.views?.[0]?.imageUrl);
        const allViewUrls = data.imageUrl ? [data.imageUrl] : (data.views?.map((v: Record<string, unknown>) => v.imageUrl).filter(Boolean) || []);

        if (imageUrl) {
          setEntityCards(prev => prev.map(c =>
            c.id === cardId ? {
              ...c,
              imageUrl,
              images: allViewUrls,
              isGenerating: false,
              isPromptGenerated: true,
            } : c
          ));
          addWorkflowMsg('assistant', `角色「${card.name}」${data.imageUrl ? '设计参考图' : '三视图'}生成完成 ✅`, 'success', 'success', '可用于后续分镜的角色一致性参考');
        } else {
          throw new Error(data.error || '未获取到图片');
        }
      } else {
        throw new Error(data.error || '生成失败');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '角色三视图生成失败';
      setEntityCards(prev => prev.map(c =>
        c.id === cardId ? { ...c, isGenerating: false } : c
      ));
      addWorkflowMsg('assistant', `角色「${card.name}」三视图生成失败：${msg}`, 'error');
    }
  }, [entityCards, visualStyle, style, filmVisualStyle, addWorkflowMsg]);

  // 使用 scene-generate API 增强场景描述并生成氛围图
  const handleEnhanceScenes = useCallback(async () => {
    const sceneCards = entityCards.filter(c => c.type === 'scene');
    if (sceneCards.length === 0) return;

    addWorkflowMsg('assistant', '正在使用AI增强场景描述并生成氛围图...', 'progress');
    setProgressMsg('增强场景描述...');

    try {
      const res = await fetch('/api/film/scene-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
        body: JSON.stringify({
          text: inputText,
          style: visualStyle || style,
          sceneCount: sceneCards.length,
          filmVisualStyle: filmVisualStyle || undefined,
        }),
      });

      if (!res.ok) throw new Error('场景增强失败');
      const data = await res.json();

      if (data.scenes?.length > 0) {
        setEntityCards(prev => prev.map(card => {
          if (card.type !== 'scene') return card;
          const matched = data.scenes.find((ds: Record<string, unknown>) =>
            ds.name === card.name || card.name.includes(ds.name as string) || (ds.name as string)?.includes(card.name)
          );
          if (!matched) return card;
          // 注入风格锁定到AI增强的promptEn + 确保无人物约束
          const rawPromptEn = matched.prompt_en as string;
          const noPeopleSuffix = ', empty scene, no people, no characters, devoid of human figures';
          const scenePromptEn = rawPromptEn
            ? (rawPromptEn.includes('no people') ? rawPromptEn : rawPromptEn + noPeopleSuffix)
            : card.promptEn;
          const enhancedPromptEn = scenePromptEn
            ? (filmVisualStyle ? buildStyleLockedPrompt(scenePromptEn, filmVisualStyle) : scenePromptEn)
            : card.promptEn;
          return {
            ...card,
            description: matched.description || card.description,
            promptEn: enhancedPromptEn,
            imageUrl: matched.imageUrl || card.imageUrl,
            promptCn: [card.promptCn, matched.description ? `\n详细描述: ${matched.description}` : ''].join(''),
            isPromptGenerated: true,
          };
        }));
        const withImages = data.scenes.filter((s: Record<string, unknown>) => s.imageUrl).length;
        addWorkflowMsg('assistant', `场景增强完成，已优化 ${data.scenes.length} 个场景，${withImages} 个已生成氛围图`, 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '场景增强失败';
      addWorkflowMsg('assistant', `场景增强失败：${msg}`, 'error');
    }
    setProgressMsg('');
  }, [entityCards, inputText, visualStyle, style, filmVisualStyle, addWorkflowMsg]);

  // 使用 generate-assets API 批量生成所有素材
  const { handleGenerateAllAssets } = useFilmAssetGeneration({
    addGenLog, addWorkflowMsg, buildReferenceImagesRef, entityCards, entityCardsRef,
    filmVisualStyle, script, setEntityCards, setGenerationProgress, setGenerationStage,
    setIsGenerating, setMiddleAiStatus, setPhase, setProgressMsg, style, visualStyle,
  });

  // ★ 自动链式生成：规划完成后自动触发资产生成
  useEffect(() => {
    if (autoGenerateAssets && !isGenerating) {
      setAutoGenerateAssets(false);
      handleGenerateAllAssets();
    }
  }, [autoGenerateAssets, isGenerating, handleGenerateAllAssets]);

  // 提取视频最后一帧（用于连贯性参考）
  const handleExtractLastFrame = useCallback(async (cardId: string) => {
    const card = entityCards.find(c => c.id === cardId);
    if (!card?.videoUrl) return;

    addWorkflowMsg('assistant', `正在提取镜头「${card.name}」最后一帧...`, undefined, 'progress');
    try {
      const res = await fetch('/api/video/extract-last-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: card.videoUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.lastFrameUrl) {
          setEntityCards(prev => prev.map(c =>
            c.id === cardId ? { ...c, lastFrameUrl: data.lastFrameUrl } : c
          ));
          addWorkflowMsg('assistant', `镜头「${card.name}」最后一帧提取完成`, undefined, 'success');
        }
      }
    } catch {
      addWorkflowMsg('assistant', `镜头「${card.name}」最后一帧提取失败（不影响主流程）`, undefined, 'info');
    }
  }, [entityCards, addWorkflowMsg]);

  // ============================================================
  // 阶段2：生成提示词 / 生成画面
  // ============================================================

  // 为单个实体生成/优化英文提示词
  const handleGeneratePrompt = useCallback(async (cardId: string) => {
    const card = entityCards.find(c => c.id === cardId);
    if (!card) return;

    addWorkflowMsg('assistant', `正在生成「${card.name}」画面...`, undefined, 'progress');
    setEntityCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, isGenerating: true } : c
    ));

    try {
      const res = await fetch('/api/prompt/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: card.promptCn }),
      });

      if (!res.ok) throw new Error('提示词生成失败');
      const data = await res.json();

      const enhancedPrompt = data.enhancedText || card.promptCn;
      // 注入风格锁定到promptEn
      const styledPromptEn = filmVisualStyle ? buildStyleLockedPrompt(enhancedPrompt, filmVisualStyle) : enhancedPrompt;
      setEntityCards(prev => prev.map(c =>
        c.id === cardId ? { ...c, promptCn: enhancedPrompt, promptEn: styledPromptEn, isPromptGenerated: true, isGenerating: false } : c
      ));
      addWorkflowMsg('assistant', `「${card.name}」提示词生成完成 ✅`, undefined, 'success');
    } catch {
      setEntityCards(prev => prev.map(c =>
        c.id === cardId ? { ...c, isGenerating: false } : c
      ));
      addWorkflowMsg('assistant', `「${card.name}」提示词生成失败`, undefined, 'error');
    }
  }, [entityCards]);

  // 为单个实体生成画面图片
  // 取消所有生成
  const handleCancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setProgressMsg('');
    // 将所有正在生成的卡片恢复状态
    setEntityCards(prev => prev.map(c =>
      c.isGenerating || c.startFrameGenerating || c.nineGridGenerating
        ? { ...c, isGenerating: false, startFrameGenerating: false, nineGridGenerating: false }
        : c
    ));
    addWorkflowMsg('info', '已取消生成');
  }, [addWorkflowMsg]);

  const handleGenerateImage = useCallback(async (cardId: string) => {
    const card = entityCards.find(c => c.id === cardId);
    if (!card || !card.promptEn) return;

    // 角色卡片优先使用三视图 API（更专业的角色参考图）
    if (card.type === 'character') {
      return handleGenerateCharacterViews(cardId);
    }

    setEntityCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, isGenerating: true, startFrameGenerating: card.type === 'shot' } : c
    ));

    try {
      // 角色已在上方走三视图逻辑，此处仅处理分镜/场景
      let enhancedPrompt = card.promptEn;
      let endFramePrompt = enhancedPrompt;

      if (card.type === 'shot') {
        // 分镜图：注入角色外观参考 + 场景视觉一致性
        const characterCards = entityCards.filter(c => c.type === 'character');
        const sceneCards = entityCards.filter(c => c.type === 'scene');

        // 角色外观参考
        const charDescParts = (card.characters || []).map((charRef: string) => {
          const ch = characterCards.find(c => c.id === charRef || c.name === charRef);
          if (!ch) return '';
          const appearance = [ch.appearance, ch.outfit].filter(Boolean).join(', ');
          return appearance ? `${ch.name}(${appearance})` : '';
        }).filter(Boolean);

        // 场景视觉参考（色调、光源、氛围）
        const sceneRef = card.sceneId
          ? sceneCards.find(s => s.id === card.sceneId)
          : sceneCards[0]; // 没有sceneId时默认使用第一个场景
        const sceneContext = sceneRef
          ? `Scene: ${sceneRef.description || sceneRef.promptEn || ''}`
          : '';

        const consistencyParts: string[] = [];
        if (charDescParts.length > 0) {
          consistencyParts.push(`featuring: ${charDescParts.join('. ')}`);
        }
        if (sceneContext) {
          consistencyParts.push(sceneContext);
        }
        consistencyParts.push('consistent character appearance and scene style');

        // Wan2.1: 注入角色视觉锚点(面部/身形/发型/服装4维描述)
        const anchorChars = (card.characters || []).map((charRef: string) => {
          const ch = characterCards.find(c => c.id === charRef || c.name === charRef);
          return ch?.anchor ? { name: ch.name, anchor: ch.anchor } : null;
        }).filter(Boolean) as { name: string; anchor: CharacterAnchor }[];
        if (anchorChars.length > 0) {
          for (const ac of anchorChars) {
            const anchorDesc = [
              ac.anchor.faceAnchor ? `face: ${Object.values(ac.anchor.faceAnchor).filter(Boolean).join(', ')}` : '',
              ac.anchor.bodyAnchor ? `body: ${Object.values(ac.anchor.bodyAnchor).filter(Boolean).join(', ')}` : '',
              ac.anchor.hairAnchor ? `hair: ${Object.values(ac.anchor.hairAnchor).filter(Boolean).join(', ')}` : '',
              ac.anchor.costumeAnchor ? `outfit: ${Object.values(ac.anchor.costumeAnchor).filter(Boolean).join(', ')}` : '',
            ].filter(Boolean).join(', ');
            if (anchorDesc) consistencyParts.push(`${ac.name} anchor: ${anchorDesc}`);
          }
        }

        if (consistencyParts.length > 1) {
          enhancedPrompt = `${card.promptEn}, ${consistencyParts.join(', ')}`;
        }
      }

      // 注入三重风格锁定 + 增强版负面提示词（确保全场风格一致）
      let negativePrompt = '';
      if (filmVisualStyle) {
        enhancedPrompt = buildStyleLockedPrompt(enhancedPrompt, filmVisualStyle);
        negativePrompt = buildEnhancedNegative(filmVisualStyle);
      }

      // 分镜首尾帧：结束帧描述镜头最终画面状态
      if (card.type === 'shot' && card.shotDescription) {
        endFramePrompt = enhancedPrompt; // 起始帧用原prompt
        // 结束帧：基于镜头描述生成最终画面，保留角色外观一致性
        const endParts = [`end of shot: ${card.shotDescription}`];
        if (card.characters?.length) {
          const characterCards = entityCards.filter(c => c.type === 'character');
          const charDescs = card.characters.map((charRef: string) => {
            const ch = characterCards.find(c => c.id === charRef || c.name === charRef);
            return ch ? `${ch.name}(${[ch.appearance, ch.outfit].filter(Boolean).join(', ')})` : '';
          }).filter(Boolean);
          if (charDescs.length) endParts.push(`featuring: ${charDescs.join('. ')}`);
        }
        endFramePrompt = `${endParts.join(', ')}, consistent character appearance`;
        if (filmVisualStyle) {
          endFramePrompt = buildStyleLockedPrompt(endFramePrompt, filmVisualStyle);
        }
      } else {
        endFramePrompt = enhancedPrompt;
      }

      // 场景图禁止出现人物：追加 no people 约束
      if (card.type === 'scene') {
        if (!enhancedPrompt.includes('no people')) {
          enhancedPrompt = `${enhancedPrompt}, empty scene, no people, no characters, devoid of human figures`;
        }
        negativePrompt = negativePrompt
          ? `${negativePrompt}, person, people, character, human, figure, man, woman, child, boy, girl`
          : 'person, people, character, human, figure, man, woman, child, boy, girl';
      }

      // 道具图：特写风格，中性背景突出物品细节
      if (card.type === 'prop') {
        if (card.propCloseup) {
          enhancedPrompt = `${enhancedPrompt}, close-up shot, detailed product photography, isolated on neutral background, macro detail`;
        } else {
          enhancedPrompt = `${enhancedPrompt}, product photography, isolated on neutral background, detailed, high quality`;
        }
        if (!negativePrompt) {
          negativePrompt = 'person, people, character, human, hand, blurry, low quality';
        }
      }

      // 收集角色+场景+道具参考图（确保画面与已有素材视觉一致）
      const refImages = (card.type === 'shot' || card.type === 'prop') ? buildReferenceImagesRef.current(card) : [];
      const primaryRef = refImages.length > 0 ? refImages[0] : undefined;
      const materialsRefs = refImages.length > 1 ? refImages.slice(1) : [];

      // 分镜类型：生成首帧+尾帧（FLF2V模式）
      if (card.type === 'shot') {
        // 1. 生成首帧（起始帧）
        const startRes = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            negative_prompt: negativePrompt || undefined,
            image: primaryRef,
            materials: materialsRefs,
          }),
        });
        if (!startRes.ok) throw new Error('首帧生成失败');
        const startData = await startRes.json();
        const startFrameUrl = startData.imageUrls?.[0] || startData.imageUrl;

        // 2. 生成尾帧（结束帧），参考首帧确保连贯性
        const endRes = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: endFramePrompt,
            negative_prompt: negativePrompt || undefined,
            image: startFrameUrl || primaryRef,  // 参考首帧
            materials: materialsRefs,
          }),
        });
        if (!endRes.ok) throw new Error('尾帧生成失败');
        const endData = await endRes.json();
        const endFrameUrl = endData.imageUrls?.[0] || endData.imageUrl;

        if (startFrameUrl || endFrameUrl) {
          setEntityCards(prev => prev.map(c =>
            c.id === cardId ? {
              ...c,
              imageUrl: startFrameUrl || endFrameUrl,
              startFrameUrl: startFrameUrl || undefined,
              endFrameUrl: endFrameUrl || undefined,
              startFrameGenerating: false,
              isGenerating: false,
            } : c
          ));
          addWorkflowMsg('assistant', `「${card.name}」首尾帧生成完成 ✅ 首帧${startFrameUrl ? '✓' : '✗'} 尾帧${endFrameUrl ? '✓' : '✗'}`, undefined, 'success');
        } else {
          throw new Error('未获取到首尾帧图片');
        }
      } else {
        // 非分镜类型：只生成单张图
        const res = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            negative_prompt: negativePrompt || undefined,
            image: primaryRef,
            materials: materialsRefs,
          }),
        });

        if (!res.ok) throw new Error('画面生成失败');
        const data = await res.json();

        const imageUrl = data.imageUrls?.[0] || data.imageUrl;
        if (imageUrl) {
          setEntityCards(prev => prev.map(c =>
            c.id === cardId ? { ...c, imageUrl, isGenerating: false } : c
          ));
          addWorkflowMsg('assistant', `「${card.name}」画面生成完成 ✅`, undefined, 'success');
        } else {
          throw new Error('未获取到图片');
        }
      }
    } catch {
      setEntityCards(prev => prev.map(c =>
        c.id === cardId ? { ...c, isGenerating: false, startFrameGenerating: false } : c
      ));
      addWorkflowMsg('assistant', `「${card.name}」画面生成失败`, undefined, 'error');
    }
  }, [entityCards, handleGenerateCharacterViews]);

  // 批量生成所有画面
  // ---- 人物一致性：生成锚点 (Wan2.1) ----
  const handleGenerateAnchor = useCallback(async (cardId: string) => {
    const card = entityCards.find(c => c.id === cardId);
    if (!card || card.type !== 'character') return;

    setEntityCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, anchorGenerating: true } : c
    ));

    try {
      const res = await fetch('/api/video/consistency-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_anchor',
          description: [card.appearance, card.outfit, card.description].filter(Boolean).join('. '),
          imageUrl: card.imageUrl,
        }),
      });
      if (!res.ok) throw new Error('锚点生成失败');
      const data = await res.json();
      if (data.success && data.anchor) {
        setEntityCards(prev => prev.map(c =>
          c.id === cardId ? { ...c, anchor: data.anchor, anchorGenerating: false } : c
        ));
        addWorkflowMsg('assistant', `角色「${card.name}」视觉锚点已生成 ✅`, 'success', 'success', '锚点包含面部/身形/发型/服装4维描述，将用于后续分镜一致性');
      }
    } catch {
      setEntityCards(prev => prev.map(c =>
        c.id === cardId ? { ...c, anchorGenerating: false } : c
      ));
    }
  }, [entityCards]);

  // ---- 人物一致性：校验全部分镜 (huobao) ----
  const handleConsistencyCheck = useCallback(async () => {
    const shotCards = entityCards.filter(c => c.type === 'shot');
    const characterCards = entityCards.filter(c => c.type === 'character');
    if (shotCards.length === 0) return;

    setConsistencyChecking(true);
    try {
      const res = await fetch('/api/video/consistency-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check',
          shots: shotCards.map(s => ({
            shotId: s.id,
            sceneId: s.sceneId,
            characterIds: s.characters || [],
            description: s.promptCn || s.description,
          })),
          characterBibles: characterCards.map(c => ({
            id: c.id,
            name: c.name,
            anchor: c.anchor,
            appearance: c.appearance,
            outfit: c.outfit,
          })),
        }),
      });
      if (!res.ok) throw new Error('一致性校验失败');
      const data = await res.json();
      if (data.success && data.result) {
        setConsistencyResults(data.result);
        setShowConsistencyPanel(true);
        const issueCount = data.result.issues?.length || 0;
        addWorkflowMsg('assistant', `一致性校验完成：发现 ${issueCount} 个问题`, issueCount > 0 ? 'error' : 'success', issueCount > 0 ? 'error' : 'success', issueCount > 0 ? '建议检查角色外观/场景光线/道具连续性' : '所有分镜视觉连续性良好');
      }
    } catch {
      addWorkflowMsg('assistant', '一致性校验请求失败', 'error');
    } finally {
      setConsistencyChecking(false);
    }
  }, [entityCards]);

  // ---- 人物一致性：提示词扩展 (Wan2.1 prompt_extend) ----
  const handleExtendPrompt = useCallback(async (cardId: string) => {
    const card = entityCards.find(c => c.id === cardId);
    if (!card || !card.promptEn) return;

    addWorkflowMsg('assistant', `正在扩展「${card.name}」提示词...`, undefined, 'progress');
    try {
      const res = await fetch('/api/video/consistency-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extend_prompt',
          prompt: card.promptEn,
          options: {
            language: 'en',
            addMotionDescription: card.type === 'shot',
            addLightingDetail: true,
            sceneType: card.type === 'scene' ? 'location' : undefined,
          },
        }),
      });
      if (!res.ok) throw new Error('提示词扩展失败');
      const data = await res.json();
      if (data.success && data.extendedPrompt) {
        setEntityCards(prev => prev.map(c =>
          c.id === cardId ? { ...c, promptEn: data.extendedPrompt } : c
        ));
        addWorkflowMsg('assistant', `「${card.name}」提示词扩展完成 ✅`, undefined, 'success');
      }
    } catch {
      addWorkflowMsg('assistant', `「${card.name}」提示词扩展失败`, undefined, 'error');
    }
  }, [entityCards, addWorkflowMsg]);

  // 生成道具：从剧本文本中提取道具描述，生成道具参考图
  const handleGenerateProps = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setProgressMsg('正在从剧本中提取道具描述...');

    try {
      // 收集剧本文本
      const storyText = entityCards
        .filter(c => c.type === 'plot' || c.type === 'shot')
        .map(c => c.promptCn || c.description || c.name)
        .filter(Boolean)
        .join('\n');

      if (!storyText.trim()) {
        setProgressMsg('请先生成剧本内容');
        setIsGenerating(false);
        return;
      }

      const res = await fetch('/api/film/prop-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: storyText,
          style: filmVisualStyle || visualStyle || '真人写实风格',
          propCount: 8,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setProgressMsg(data.error || '道具生成失败');
        setIsGenerating(false);
        return;
      }

      // 将生成的道具添加为EntityCard
      const newPropCards: EntityCard[] = (data.props || []).map((prop: {
        name: string;
        description: string;
        prompt_en: string;
        imageUrl?: string;
        material?: string;
        color?: string;
        size?: string;
        significance?: string;
      }) => ({
        id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'prop' as const,
        name: prop.name,
        description: prop.description || '',
        promptCn: prop.description || prop.name,
        promptEn: prop.prompt_en,
        imageUrl: prop.imageUrl || undefined,
        propMaterial: prop.material,
        propColor: prop.color,
        propSize: prop.size,
        propSignificance: prop.significance,
        propCloseup: false,
        isPromptGenerated: true,
      }));

      setEntityCards(prev => [...prev, ...newPropCards]);
      addWorkflowMsg('assistant', `道具生成完成！已提取 ${newPropCards.length} 个道具，${newPropCards.filter(c => c.imageUrl).length} 个已生成参考图`, 'success');
      setProgressMsg('');
    } catch (err) {
      console.error('[PropGeneration] Error:', err);
      setProgressMsg('道具生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, entityCards, filmVisualStyle, visualStyle, addWorkflowMsg]);

  const handleGenerateAllImages = useCallback(async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);
    setProgressMsg('批量生成画面（角色+场景并行）...');
    setPhase('visual');

    const characterCards = entityCards.filter(c => c.type === 'character' && !c.imageUrl && c.promptEn);
    const sceneCards = entityCards.filter(c => c.type === 'scene' && !c.imageUrl && c.promptEn);
    const propCards = entityCards.filter(c => c.type === 'prop' && !c.imageUrl && c.promptEn);
    const shotCards = entityCards.filter(c => c.type === 'shot' && !c.imageUrl && c.promptEn);

    addWorkflowMsg('assistant', `开始批量生成画面：${characterCards.length}个角色 + ${sceneCards.length}个场景 + ${propCards.length}个道具 + ${shotCards.length}个分镜`, undefined, 'progress');

    // 阶段1：角色、场景和道具并行生成
    const parallelTasks: Promise<void>[] = [];
    const totalParallel = characterCards.length + sceneCards.length + propCards.length;
    let parallelDone = 0;

    const updateParallelProgress = () => {
      parallelDone++;
      setProgressMsg(`并行生成中 (${parallelDone}/${totalParallel}) 角色+场景+道具...`);
    };

    for (const card of characterCards) {
      parallelTasks.push((async () => {
        if (controller.signal.aborted) return;
        await handleGenerateImage(card.id);
        updateParallelProgress();
      })());
    }
    for (const card of sceneCards) {
      parallelTasks.push((async () => {
        if (controller.signal.aborted) return;
        await handleGenerateImage(card.id);
        updateParallelProgress();
      })());
    }
    for (const card of propCards) {
      parallelTasks.push((async () => {
        if (controller.signal.aborted) return;
        await handleGenerateImage(card.id);
        updateParallelProgress();
      })());
    }

    await Promise.all(parallelTasks);

    // 阶段2：分镜画面（依赖角色+场景的参考图，需串行）
    for (let i = 0; i < shotCards.length; i++) {
      if (controller.signal.aborted) break;
      const card = shotCards[i];
      setProgressMsg(`生成分镜画面 (${i + 1}/${shotCards.length}): ${card.name}...`);
      await handleGenerateImage(card.id);
    }

    abortControllerRef.current = null;
    setIsGenerating(false);
    setProgressMsg('');
    addWorkflowMsg('assistant', `批量画面生成完成！共处理 ${characterCards.length + sceneCards.length + propCards.length + shotCards.length} 张`, undefined, 'success');
  }, [entityCards, handleGenerateImage, addWorkflowMsg]);

  const buildReferenceImages = useCallback((card: EntityCard, continuityRef?: string): string[] => {
    return buildFilmReferenceImages(card, entityCards, continuityRef);
  }, [entityCards]);

  const buildAnchorContext = useCallback((card: EntityCard): string => {
    return buildFilmAnchorContext(card, entityCards);
  }, [entityCards]);

  // ============================================================
  // BigBanana AI Director: 九宫格分镜预览
  // 先生成9个候选视角，再选择最佳构图作为首帧
  // ============================================================
  const handleGenerateNineGrid = useCallback(async (cardId: string) => {
    const card = entityCards.find(c => c.id === cardId);
    if (!card || !card.promptEn) return;

    addWorkflowMsg('assistant', `正在生成镜头「${card.name}」九宫格构图（9个视角候选）...`, undefined, 'progress');
    setEntityCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, nineGridGenerating: true, nineGridImages: [], shotStatus: 'framing' } : c
    ));

    // 收集参考图：角色+场景+上一镜头尾帧（首尾帧连续性）
    const refImages = buildReferenceImages(card);
    const prevCard = entityCards.find(c => c.type === 'shot' && c.shotNumber === (card.shotNumber ?? 0) - 1);
    if (prevCard?.endFrameUrl) {
      refImages.unshift(prevCard.endFrameUrl);
    }

    try {
      const nineImages: string[] = [];
      // 为9格生成不同的视角变体
      const angles = [
        'eye-level front view', 'slightly low angle', 'slightly high angle',
        'left 30 degree view', 'right 30 degree view', 'dutch angle left',
        'close-up framing', 'wide establishing shot', 'over-the-shoulder view',
      ];
      for (let i = 0; i < 9; i++) {
        const variantPrompt = `${card.promptEn}, ${angles[i]}, cinematic composition, ${visualStyle}`;
        const res = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: variantPrompt,
            aspectRatio: videoRatio,
            n: 1,
            image: refImages.length > 0 ? refImages : undefined,
            filmVisualStyle: filmVisualStyle || undefined,
            negative_prompt: filmVisualStyle ? buildEnhancedNegative(filmVisualStyle) : undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.[0]?.url) {
            nineImages.push(data.data[0].url);
          }
        }
        // 更新已生成的数量
        setEntityCards(prev => prev.map(c =>
          c.id === cardId ? { ...c, nineGridImages: [...nineImages] } : c
        ));
        await new Promise(r => setTimeout(r, 800));
      }
      setEntityCards(prev => prev.map(c =>
        c.id === cardId ? { ...c, nineGridGenerating: false } : c
      ));
      addWorkflowMsg('assistant', `镜头「${card.name}」九宫格生成完成 ✅`, undefined, 'success');
    } catch {
      setEntityCards(prev => prev.map(c =>
        c.id === cardId ? { ...c, nineGridGenerating: false } : c
      ));
      addWorkflowMsg('assistant', `镜头「${card.name}」九宫格生成失败`, undefined, 'error');
    }
  }, [entityCards, visualStyle, videoRatio, filmVisualStyle, buildAnchorContext, buildReferenceImages]);
  buildReferenceImagesRef.current = buildReferenceImages;

  // 从九宫格选择一张作为首帧
  const handleSelectNineGridImage = useCallback((cardId: string, index: number) => {
    const card = entityCards.find(c => c.id === cardId);
    if (!card || !card.nineGridImages?.[index]) return;

    const selectedUrl = card.nineGridImages[index];
    setEntityCards(prev => prev.map(c =>
      c.id === cardId ? {
        ...c,
        imageUrl: selectedUrl,
        startFrameUrl: selectedUrl,
        nineGridSelectedIndex: index,
        shotStatus: 'start_ready',
        nineGridImages: [],
      } : c
    ));
    setNineGridDialogCardId(null);
    addWorkflowMsg('assistant', `镜头「${card.name}」已选择第 ${index + 1} 个构图作为首帧 ✅`, undefined, 'success');
  }, [entityCards, addWorkflowMsg]);

  // ============================================================
  // 剧本验证：镜头内容与剧本一致性校验
  // ============================================================
  const validateShotsAgainstScript = useCallback(() => {
    if (!script) {
      // 无剧本时，所有镜头标记为未验证
      setEntityCards(prev => prev.map(c =>
        c.type === 'shot' ? { ...c, scriptValidated: false, scriptValidateMsg: '请先生成剧本' } : c
      ));
      return;
    }

    const scriptText = typeof script === 'string' ? script : JSON.stringify(script);

    setEntityCards(prev => prev.map(c => {
      if (c.type !== 'shot') return c;

      // 检查镜头名称是否在剧本中出现
      const nameInScript = scriptText.includes(c.name);
      // 检查镜头描述是否有内容
      const hasDescription = (c.description || '').trim().length > 0;
      // 检查提示词是否存在
      const hasPrompt = (c.promptEn || '').trim().length > 0 || (c.promptCn || '').trim().length > 0;
      // 检查出场角色是否在剧本中提及
      const charsInScript = (c.characters || []).every(chId => {
        const charCard = prev.find(p => p.id === chId);
        return charCard ? scriptText.includes(charCard.name) : true;
      });

      const validated = hasDescription && hasPrompt && charsInScript;
      const reasons: string[] = [];
      if (!hasDescription) reasons.push('缺少镜头描述');
      if (!hasPrompt) reasons.push('缺少提示词');
      if (!charsInScript) reasons.push('角色未在剧本中出现');
      if (!nameInScript && hasDescription) reasons.push('镜头名称未在剧本中匹配');

      return {
        ...c,
        scriptValidated: validated,
        scriptValidateMsg: validated ? undefined : (reasons.length > 0 ? reasons.join('; ') : '与剧本内容不一致'),
      };
    }));
  }, [script]);

  // 首次生成剧本或镜头变化时自动验证
  useEffect(() => {
    if (script && entityCards.some(c => c.type === 'shot')) {
      validateShotsAgainstScript();
    }
  }, [script, entityCards.filter(c => c.type === 'shot').length, validateShotsAgainstScript]);

  const {
    handleGenerateStartFrame,
    handleGenerateEndFrame,
    handleBatchGenerateFrames,
    handleBridgeFrames,
  } = useFilmFrameGeneration({
    addWorkflowMsg,
    buildAnchorContext,
    buildReferenceImages,
    entityCards,
    entityCardsRef,
    filmVisualStyle,
    generationMode,
    setBridgeProgress,
    setEntityCards,
    setGenerationProgress,
    setGenerationStage,
    setIsBridging,
    setIsGenerating,
    videoRatio,
    visualStyle,
  });

  // ============================================================
  // BigBanana AI Director: 衣橱系统
  // 为角色添加多套造型，保持一致性身份
  // ============================================================
  const handleAddWardrobeOutfit = useCallback((cardId: string, outfit: { name: string; description: string }) => {
    setEntityCards(prev => prev.map(c => {
      if (c.id !== cardId) return c;
      const existing = c.wardrobeOutfits || [];
      return { ...c, wardrobeOutfits: [...existing, { ...outfit, imageUrl: undefined, promptEn: undefined }] };
    }));
  }, []);

  const handleGenerateOutfitImage = useCallback(async (cardId: string, outfitIndex: number) => {
    const card = entityCards.find(c => c.id === cardId);
    if (!card) return;
    const outfit = card.wardrobeOutfits?.[outfitIndex];
    if (!outfit) return;

    addWorkflowMsg('assistant', `正在生成角色「${card.name}」造型「${outfit.name}」图片...`, undefined, 'progress');
    // 更新衣橱项生成状态
    setEntityCards(prev => prev.map(c => {
      if (c.id !== cardId) return c;
      const outfits = [...(c.wardrobeOutfits || [])];
      outfits[outfitIndex] = { ...outfit };
      return { ...c, wardrobeOutfits: outfits };
    }));

    try {
      const rawPrompt = `${card.name}, ${outfit.description}, character design, full body, white background`;
      const prompt = filmVisualStyle ? buildStyleLockedPrompt(rawPrompt, filmVisualStyle) : `${rawPrompt}, ${visualStyle}`;
      const negPrompt = filmVisualStyle ? buildEnhancedNegative(filmVisualStyle) : '';
      // 注入角色已有图片作为参考，确保造型一致性
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspectRatio: '3:4',
          n: 1,
          negative_prompt: negPrompt || undefined,
          image: card.imageUrl || undefined,  // 角色参考图
        }),
      });
      if (!res.ok) throw new Error('造型图生成失败');
      const data = await res.json();
      if (data.success && data.data?.[0]?.url) {
        setEntityCards(prev => prev.map(c => {
          if (c.id !== cardId) return c;
          const outfits = [...(c.wardrobeOutfits || [])];
          outfits[outfitIndex] = { ...outfits[outfitIndex], imageUrl: data.data[0].url, promptEn: prompt };
          return { ...c, wardrobeOutfits: outfits };
        }));
        addWorkflowMsg('assistant', `角色「${card.name}」造型「${outfit.name}」生成完成 ✅`, undefined, 'success');
      }
    } catch {
      addWorkflowMsg('assistant', `角色「${card.name}」造型「${outfit.name}」生成失败`, undefined, 'error');
    }
  }, [entityCards, visualStyle, filmVisualStyle, addWorkflowMsg]);

  const handleSwitchOutfit = useCallback((cardId: string, outfitIndex: number) => {
    const card = entityCards.find(c => c.id === cardId);
    setEntityCards(prev => prev.map(c => {
      if (c.id !== cardId) return c;
      const outfit = c.wardrobeOutfits?.[outfitIndex];
      return {
        ...c,
        activeOutfitIndex: outfitIndex,
        // 切换造型时更新主图和提示词
        imageUrl: outfit?.imageUrl || c.imageUrl,
        promptEn: outfit?.promptEn || c.promptEn,
      };
    }));
    if (card) addWorkflowMsg('assistant', `角色「${card.name}」切换到造型 ${outfitIndex + 1}`, undefined, 'info');
  }, [entityCards, addWorkflowMsg]);

  // ============================================================
  // BigBanana AI Director: 提示词版本管理
  // 记录提示词编辑历史，支持版本回滚
  // ============================================================
  const savePromptVersion = useCallback((cardId: string, field: string, value: string) => {
    setEntityCards(prev => prev.map(c => {
      if (c.id !== cardId) return c;
      const existing = c.promptVersions || [];
      const newVersion = {
        version: existing.length + 1,
        content: value,
        timestamp: Date.now(),
      };
      return { ...c, promptVersions: [...existing, newVersion] };
    }));
  }, []);

  const handleRollbackPrompt = useCallback((cardId: string, versionIndex: number) => {
    const card = entityCards.find(c => c.id === cardId);
    setEntityCards(prev => prev.map(c => {
      if (c.id !== cardId) return c;
      const version = c.promptVersions?.[versionIndex];
      if (!version) return c;
      return { ...c, promptEn: version.content };
    }));
    if (card) addWorkflowMsg('assistant', `已回滚「${card.name}」提示词到版本 ${versionIndex + 1}`, undefined, 'info');
  }, [entityCards, addWorkflowMsg]);

  // 增强版字段编辑 - 自动保存版本
  const updateCardFieldWithVersion = useCallback((cardId: string, field: string, value: string | number | string[]) => {
    if (field === 'promptEn' && typeof value === 'string') {
      savePromptVersion(cardId, field, value);
    }
    setEntityCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, [field]: value } : c
    ));
  }, [savePromptVersion]);

  // ============================================================
  // 三宫格桥接图异步生成（Bridge Image Async Task）
  // ============================================================

  const handleGenerateBridge = useCallback(async (prevShotId: string, currentShotId: string) => {
    const shotCards = entityCards.filter(c => c.type === 'shot');
    const prevShot = shotCards.find(c => c.id === prevShotId);
    const currentShot = shotCards.find(c => c.id === currentShotId);
    if (!prevShot || !currentShot) return;

    // 标记当前镜头桥接图正在生成
    setEntityCards(prev => prev.map(c =>
      c.id === currentShotId ? { ...c, bridgeGenerating: true, bridgeProgress: 0 } : c
    ));

    try {
      // 收集角色描述用于桥接图一致性
      const characterCards = entityCards.filter(c => c.type === 'character');
      const referencedChars = (currentShot.characters || [])
        .map((charRef: string) => characterCards.find(ch => ch.id === charRef || ch.name === charRef))
        .filter((ch): ch is EntityCard => ch !== undefined);
      const charactersDesc = referencedChars.length > 0
        ? referencedChars.map(ch => `${ch.name}: ${ch.appearance || ch.description}, wearing ${ch.outfit || 'casual clothes'}`).join('. ')
        : '';

      // 收集场景描述
      const sceneCards = entityCards.filter(c => c.type === 'scene');
      const sceneRef = currentShot.sceneId
        ? sceneCards.find(s => s.id === currentShot.sceneId)
        : sceneCards[0];
      const sceneContext = sceneRef
        ? [sceneRef.description, sceneRef.promptEn].filter(Boolean).join('. ')
        : '';

      const res = await fetch('/api/film/bridge-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prevShot: {
            id: prevShot.id,
            name: prevShot.name,
            imageUrl: prevShot.imageUrl,
            videoUrl: prevShot.videoUrl,
            lastFrameUrl: prevShot.lastFrameUrl,
            promptCn: prevShot.promptCn,
            description: prevShot.description,
          },
          currentShot: {
            id: currentShot.id,
            name: currentShot.name,
            imageUrl: currentShot.imageUrl,
            videoUrl: currentShot.videoUrl,
            lastFrameUrl: currentShot.lastFrameUrl,
            promptCn: currentShot.promptCn,
            description: currentShot.description,
          },
          sceneContext,
          characters: charactersDesc,
        }),
      });

      if (!res.ok) throw new Error('桥接图生成提交失败');
      const data = await res.json();
      const bridgeTaskId = data.taskId;

      if (bridgeTaskId) {
        // 轮询桥接图任务进度
        let attempts = 0;
        const maxAttempts = 60;
        const pollInterval = setInterval(async () => {
          attempts++;
          if (attempts > maxAttempts) {
            clearInterval(pollInterval);
            setEntityCards(prev => prev.map(c =>
              c.id === currentShotId ? { ...c, bridgeGenerating: false } : c
            ));
            return;
          }
          try {
            const taskRes = await fetch(`/api/tasks/${bridgeTaskId}`);
            const taskData = await taskRes.json();
            const task = taskData.task;
            const progress = task.progress || 0;

            setEntityCards(prev => prev.map(c =>
              c.id === currentShotId ? { ...c, bridgeProgress: progress } : c
            ));

            if (task.status === 'completed') {
              clearInterval(pollInterval);
              const bridgeImages: string[] = task.result?.bridgeImages || [];
              setEntityCards(prev => prev.map(c =>
                c.id === currentShotId
                  ? { ...c, bridgeImages, bridgeGenerating: false, bridgeProgress: 100 }
                  : c
              ));
            } else if (task.status === 'failed') {
              clearInterval(pollInterval);
              setEntityCards(prev => prev.map(c =>
                c.id === currentShotId ? { ...c, bridgeGenerating: false } : c
              ));
            }
          } catch {
            // 轮询失败继续
          }
        }, 3000);
      }
    } catch {
      setEntityCards(prev => prev.map(c =>
        c.id === currentShotId ? { ...c, bridgeGenerating: false } : c
      ));
    }
  }, [entityCards]);

  // ============================================================
  // 阶段3：生成视频（含音频字幕）
  // ============================================================
  const { handleGenerateShotVideo, handleRegenerateVideo } = useFilmShotVideoGeneration({
    addWorkflowMsg,
    consistencyMode,
    entityCards,
    filmVisualStyle,
    handleExtractLastFrame,
    handleGenerateBridge,
    setComposeProgress,
    setEntityCards,
    setProgressMsg,
    style,
    videoDuration,
    visualStyle,
  });

  // BGM试听
  const handlePreviewBgm = useCallback(async (type: BgmTypeId) => {
    if (bgmPreviewPlaying && bgmType === type) {
      bgmAudioRef.current?.pause();
      setBgmPreviewPlaying(false);
      return;
    }
    setBgmType(type);
    try {
      // 优先使用 Web Audio API 生成风格匹配音效
      const { WebAudioBgmGenerator } = await import('@/lib/bgm-manager');
      const generator = new WebAudioBgmGenerator();
      const blob = await generator.generateBgm(type as string, 15);
      if (blob) {
        if (bgmAudioRef.current) {
          bgmAudioRef.current.pause();
        }
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = bgmVolume === 'low' ? 0.2 : bgmVolume === 'high' ? 0.8 : 0.5;
        audio.onended = () => {
          setBgmPreviewPlaying(false);
          URL.revokeObjectURL(url);
        };
        bgmAudioRef.current = audio;
        audio.play().catch(() => {});
        setBgmPreviewPlaying(true);
        setBgmPreviewUrl(url);
        return;
      }
    } catch {
      // Web Audio 生成失败，降级到预设API
    }
    try {
      const res = await fetch(`/api/bgm/preset?type=${type}&random=true`);
      const data = await res.json();
      if (data.success && data.url) {
        if (bgmAudioRef.current) {
          bgmAudioRef.current.pause();
        }
        const audio = new Audio(data.url);
        audio.volume = bgmVolume === 'low' ? 0.2 : bgmVolume === 'high' ? 0.8 : 0.5;
        audio.onended = () => setBgmPreviewPlaying(false);
        bgmAudioRef.current = audio;
        audio.play().catch(() => {});
        setBgmPreviewPlaying(true);
        setBgmPreviewUrl(data.url);
      }
    } catch {
      // 试听失败静默处理
    }
  }, [bgmPreviewPlaying, bgmType, bgmVolume]);

  // ---- 音色试听 ----
  const handlePreviewVoice = useCallback(async (voiceName: string) => {
    // 如果正在播放同一音色，停止
    if (voicePreviewPlaying === voiceName) {
      voiceAudioRef.current?.pause();
      voiceAudioRef.current = null;
      setVoicePreviewPlaying(null);
      return;
    }

    // 停止之前的播放
    voiceAudioRef.current?.pause();
    voiceAudioRef.current = null;
    setVoicePreviewPlaying(voiceName);

    try {
      const res = await fetch('/api/tts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceType: voiceName }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        const audio = new Audio(data.url);
        voiceAudioRef.current = audio;
        audio.onended = () => {
          setVoicePreviewPlaying(null);
          voiceAudioRef.current = null;
        };
        audio.onerror = () => {
          setVoicePreviewPlaying(null);
          voiceAudioRef.current = null;
        };
        await audio.play();
      } else {
        setVoicePreviewPlaying(null);
      }
    } catch {
      setVoicePreviewPlaying(null);
    }
  }, [voicePreviewPlaying]);

  // 合成所有分镜视频为最终影片
  const handleComposeFilm = useCallback(async () => {
    const shotCards = entityCards.filter(c => c.type === 'shot' && c.videoUrl);
    if (shotCards.length === 0) {
      setError('没有可合成的视频，请先生成分镜视频');
      return;
    }

    setComposeStatus('merging');
    setIsGenerating(true);
    setProgressMsg('正在合成最终影片...');
    addWorkflowMsg('assistant', `开始合成影片，共 ${shotCards.length} 个镜头...`, undefined, 'progress');

    try {
      // 构建合成请求数据：直接传递已有视频URL和字幕，包含剧本情感信息
      const composeShots = shotCards.map(card => ({
        id: card.id,
        videoUrl: card.videoUrl!,
        narration: card.narration || card.dialogue,
        dialogue: card.dialogue,
        duration: card.duration || videoDuration,
        emotion: card.emotion || card.mood || '',
        shotType: card.shotType || '',
        cameraMovement: card.cameraMovement || '',
      }));

      const res = await fetch('/api/film/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shots: composeShots,
          enableSubtitle: true,
          enableVoice: true,
          bgmType,
          bgmVolume,
          sfxType,
          sfxVolume,
          style: visualStyle || style,
        }),
      });

      // 单视频直接返回JSON
      if (shotCards.length === 1) {
        const data = await res.json();
        if (data.videoUrl) {
          setFinalVideoUrl(data.videoUrl);
          setComposeStatus('completed');
          onVideoGenerated?.(data.videoUrl);
        }
        return;
      }

      // 多视频：SSE流式读取进度
      const reader = res.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let finalData: Record<string, unknown> | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.stage === 'complete') {
                finalData = data;
              } else if (data.stage === 'error') {
                throw new Error(data.error || '合成失败');
              } else {
                // 更新进度消息
                const msg = data.message || '';
                const progress = data.progress || 0;
                setProgressMsg(`${msg} (${progress}%)`);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 处理最终结果
      if (finalData?.videoUrl) {
        setFinalVideoUrl(finalData.videoUrl as string);
        setComposeStatus('completed');
        onVideoGenerated?.(finalData.videoUrl as string);
        addWorkflowMsg('assistant', '影片合成完成 ✅', undefined, 'success', '可以下载或分享影片');
        // 保存历史 - 合成完成
        upsertFilmHistory({
          title: (script?.title || inputText.trim()).slice(0, 50),
          prompt: inputText.trim(),
          script: script as unknown as Record<string, unknown>,
          phase: 'compose',
          entityCards: entityCards.map(entityCardToSnapshot),
          chatMessages: chatMessages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
          filmVisualStyle: filmVisualStyle,
          imagesGenerated: entityCards.filter(c => c.imageUrl).length,
          videosGenerated: entityCards.filter(c => c.videoUrl).length,
          finalVideoUrl: finalData.videoUrl as string,
        });
      } else {
        // 降级：用最后一个分镜视频
        const lastVideo = shotCards[shotCards.length - 1]?.videoUrl;
        if (lastVideo) {
          setFinalVideoUrl(lastVideo);
          setComposeStatus('completed');
          onVideoGenerated?.(lastVideo);
        }
      }
    } catch (err) {
      // 降级：直接使用分镜视频展示
      const firstVideo = shotCards[0]?.videoUrl;
      if (firstVideo) {
        setFinalVideoUrl(firstVideo);
        setComposeStatus('completed');
      }
      setError(err instanceof Error ? err.message : '合成失败');
      addWorkflowMsg('assistant', `影片合成失败：${err instanceof Error ? err.message : '未知错误'}`, undefined, 'error');
    } finally {
      setIsGenerating(false);
      setProgressMsg('');
    }
  }, [entityCards, visualStyle, style, onVideoGenerated, inputText, script, targetDuration, upsertFilmHistory, addWorkflowMsg, handleExtractLastFrame, handleGenerateBridge, chatMessages, filmVisualStyle]);

  // 生成所有分镜视频
  // parallel: 并行模式(先顺序确定首尾帧→再并行生成视频)
  // sequential: 连续模式(逐段生成视频，上一段lastFrameUrl作为下一段first_frame)
  const handleGenerateAllVideos = useCallback(async (mode: 'parallel' | 'sequential' = 'parallel') => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setPhase('compose');
    setComposeStatus('generating');
    setIsGenerating(true);
    addWorkflowMsg('assistant', `开始批量生成视频（${mode === 'parallel' ? '并行' : '连续'}模式），共 ${entityCards.filter(c => c.type === 'shot').length} 个镜头...`, undefined, 'progress');

    const allShotCards = entityCards.filter(c => c.type === 'shot');
    const shotCards = allShotCards;
    if (shotCards.length === 0) {
      setIsGenerating(false);
      return;
    }

    if (mode === 'parallel') {
      // ═══════════════════════════════════════════════════════════
      // 并行模式(混合策略)：先顺序确定所有首尾帧，再并行生成视频
      // 阶段1：顺序生成首尾帧 → 确保视觉连续性
      // 阶段2：并行提交视频生成 → 最大化速度
      // ═══════════════════════════════════════════════════════════
      const totalFrames = shotCards.length * 2;
      let completedFrames = 0;

      // 添加生成日志
      shotCards.forEach((card, idx) => {
        addGenLog(idx, `镜头${idx + 1}`, '首帧生成', 'generating');
      });

      // ---- 阶段1：顺序生成首尾帧 ----
      setProgressMsg(`阶段1/2：顺序生成 ${shotCards.length} 个镜头的首尾帧（确保连续性）...`);
      setGenerationStage('shot');
      setGenerationProgress({ completed: 0, total: totalFrames, currentName: '首尾帧' });

      for (let i = 0; i < shotCards.length; i++) {
        if (controller.signal.aborted) break;
        const latestCards = entityCardsRef.current.filter(c => c.type === 'shot');
        const card = latestCards[i];
        if (!card) continue;
        const prevCard = i > 0 ? latestCards[i - 1] : null;

        // 连续性规则：上一镜头尾帧注入为本镜头首帧参考
        if (prevCard?.endFrameUrl && !card.startFrameUrl) {
          setEntityCards(prev => prev.map(c =>
            c.id === card.id ? {
              ...c,
              startFrameUrl: prevCard!.endFrameUrl,
              prevShotEndFrameUrl: prevCard!.endFrameUrl,
              shotStatus: 'start_ready' as const,
            } : c
          ));
          completedFrames++;
        } else if (!card.startFrameUrl) {
          setGenerationProgress({ completed: completedFrames, total: totalFrames, currentName: `镜头${i+1}·首帧` });
          await handleGenerateStartFrame(card.id);
          completedFrames++;
        } else {
          completedFrames++; // 已有首帧，跳过
        }

        await new Promise(r => setTimeout(r, 300));

        // 生成尾帧
        const latestCard = entityCardsRef.current.find(c => c.id === card.id);
        if (latestCard && !latestCard.endFrameUrl) {
          setGenerationProgress({ completed: completedFrames, total: totalFrames, currentName: `镜头${i+1}·尾帧` });
          await handleGenerateEndFrame(card.id);
          completedFrames++;
        } else {
          completedFrames++; // 已有尾帧，跳过
        }

        setProgressMsg(`阶段1/2：已完成 ${i+1}/${shotCards.length} 个镜头的首尾帧...`);
      }

      setGenerationStage('done');
      setGenerationProgress({ completed: totalFrames, total: totalFrames, currentName: '' });
      addWorkflowMsg('assistant', `首尾帧全部确定（顺序生成，连续性已保障），开始并行生成视频...`, 'progress');

      // 等待状态更新
      await new Promise(r => setTimeout(r, 500));

      // ---- 阶段2：并行生成所有视频 ----
      if (controller.signal.aborted) { setIsGenerating(false); return; }

      const cardsWithFrames = entityCardsRef.current.filter(c => c.type === 'shot');
      const shotsToGenerate = cardsWithFrames.filter(c => !c.videoUrl);
      const totalVideos = shotsToGenerate.length;
      setProgressMsg(`阶段2/2：并行生成 ${totalVideos} 个镜头视频（首尾帧已确定）...`);

      const videoPromises = shotsToGenerate.map((card, idx) =>
        handleGenerateShotVideo(card.id)
          .then(() => {
            setProgressMsg(`阶段2/2：视频生成中 (${idx+1}/${totalVideos})...`);
          })
          .catch(() => { /* 单个失败不中断整体 */ })
      );
      await Promise.allSettled(videoPromises);

    } else if (mode === 'sequential') {
      // 顺序生成：每个视频等前一个完成后使用其lastFrameUrl作为first_frame
      const totalShots = shotCards.length;
      setProgressMsg(`顺序生成 ${totalShots} 个镜头视频（首尾帧连续性模式）...`);
      shotCards.forEach(c => setComposeProgress(prev => ({ ...prev, [c.id]: 0 })));

      for (let i = 0; i < shotCards.length; i++) {
        if (controller.signal.aborted) break;
        const card = shotCards[i];
        setProgressMsg(`生成镜头 #${card.shotNumber || (i+1)} (${i+1}/${totalShots})${i > 0 ? ' · 使用上一镜头尾帧' : ''}...`);
        try {
          await handleGenerateShotVideo(card.id);
        } catch {
          /* 单个失败不中断整体 */
        }
        // 额外等待1.5秒确保lastFrameUrl已写入entityCards
        await new Promise(r => setTimeout(r, 1500));
      }
    } else {
      // ═══════════════════════════════════════════════════════════
      // 连续模式：逐段生成视频，上一段完成后获取lastFrameUrl作为下一段first_frame
      // ═══════════════════════════════════════════════════════════
      setGenerationStage('shot');
      setGenerationProgress({ completed: 0, total: shotCards.length, currentName: '' });

      for (let i = 0; i < shotCards.length; i++) {
        if (controller.signal.aborted) break;
        const card = shotCards[i];
        const latestCards = entityCardsRef.current;
        const currentCard = latestCards.find(c => c.id === card.id);
        
        setProgressMsg(`连续模式：正在生成镜头 ${i + 1}/${shotCards.length} 的视频...`);
        setGenerationProgress(prev => ({ ...prev, completed: i, currentName: `镜头${card.shotNumber || i + 1}` }));

        try {
          await handleGenerateShotVideo(card.id);
          // 等待视频生成完成并获取lastFrameUrl
          await new Promise(r => setTimeout(r, 2000));
          
          // 将上一段的lastFrameUrl传播为下一段的firstFrame参考
          if (i < shotCards.length - 1) {
            const nextCard = shotCards[i + 1];
            const updatedCards = entityCardsRef.current;
            const thisCard = updatedCards.find(c => c.id === card.id);
            if (thisCard?.lastFrameUrl) {
              setEntityCards(prev => prev.map(c => 
                c.id === nextCard.id 
                  ? { ...c, prevShotEndFrameUrl: thisCard.lastFrameUrl } 
                  : c
              ));
              await new Promise(r => setTimeout(r, 500));
            }
          }
        } catch {
          addWorkflowMsg('system', `镜头 ${card.shotNumber || i + 1} 视频生成失败，继续下一段`);
        }
      }
      setGenerationProgress(prev => ({ ...prev, completed: shotCards.length, currentName: '' }));
    }

    abortControllerRef.current = null;
    setIsGenerating(false);
    setProgressMsg('所有镜头视频生成完成，准备合成...');
    addWorkflowMsg('assistant', '所有镜头视频生成完成 ✅ 正在准备自动合成...', undefined, 'success');

    // 所有视频生成完毕后自动合成
    if (!controller.signal.aborted) {
      setTimeout(() => handleComposeFilm(), 1500);
    }
  }, [entityCards, handleGenerateShotVideo, handleComposeFilm, handleGenerateStartFrame, handleGenerateEndFrame, addWorkflowMsg]);

  const handleWorkflowCommand = useFilmWorkflowCommand({
    addWorkflowMsg,
    chatInput,
    chatMessages,
    entityCards,
    handleComposeFilm,
    handleEnhanceCharacters,
    handleEnhanceScenes,
    handleExtractLastFrame,
    handleGenerateAllAssets,
    handleGenerateBridge,
    handleGenerateCharacterViews,
    handleGenerateImage,
    handleGenerateProps,
    handleGenerateShotVideo,
    handlePlanCreation,
    inputText,
    setChatInput,
    setChatMessages,
    setComposeStatus,
    setFinalVideoUrl,
    setInputText,
    setShowChatMessages,
    setWorkflowInput,
  });

  // ============================================================
  // 阶段切换
  // ============================================================
  const goToPhase = useCallback((p: WorkflowPhase) => {
    if (p === 'visual' && entityCards.length === 0) return;
    if (p === 'compose' && !entityCards.some(c => c.type === 'shot' && (c.imageUrl || c.promptEn))) return;
    setPhase(p);
  }, [entityCards]);

  // ============================================================
  // 对话逻辑
  // ============================================================
  const { addAssistantMessage, handleNewConversation, handleSendChat } = useFilmChatFlow({
    addWorkflowMsg,
    chatEndRef,
    chatInput,
    chatMessages,
    entityCards,
    extractedParams,
    handleGenerateImage,
    handlePlanCreation,
    handleWorkflowCommand,
    inputText,
    isChatStreaming,
    phase,
    script,
    scriptType,
    selectedService,
    visualStyle,
    setAssetCardsExpanded,
    setAutoGenerateAssets,
    setBgmType,
    setChatInput,
    setChatInputHighlight,
    setChatMessages,
    setChatPlaceholder,
    setComposeStatus,
    setEntityCards,
    setExpandedPhaseSection,
    setExpandedShotIds,
    setExtractedParams,
    setFilmVisualStyle,
    setGenerationLogs,
    setInputText,
    setIsChatStreaming,
    setLogFilter,
    setMiddleAiStatus,
    setPhase,
    setRefEntitiesExpanded,
    setScript,
    setShowChatMessages,
    setShowHistoryPanel,
    setShowLogPanel,
    setStreamingScriptText,
  });

  const handleQuickCmd = useFilmQuickCommand({
    addWorkflowMsg,
    chatInput,
    chatInputRef,
    chatMessages,
    entityCards,
    handleComposeFilm,
    handleEnhanceCharacters,
    handleEnhanceScenes,
    handleGenerateAllAssets,
    handleGenerateImage,
    handlePlanCreation,
    inputText,
    setChatInput,
    setChatInputHighlight,
    setChatMessages,
    setChatPlaceholder,
    setComposeStatus,
    setFinalVideoUrl,
    setMiddleAiStatus,
    setPhase,
    setShowChatMessages,
  });

  // ============================================================
  // 绘影精灵数据导入（自动填充+生成视频）
  // ============================================================
  const transferRef = useRef(false);
  useEffect(() => {
    if (!transferredData || transferRef.current || isGenerating) return;
    transferRef.current = true;

    const td = transferredData;

    // 1. 填充输入文本
    if (td.storySummary) {
      setInputText(td.storySummary);
    }

    // 2. 填充实体卡片
    const newCards: EntityCard[] = [];
    for (const char of td.characters) {
      const card: EntityCard = {
        id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'character',
        name: char.name,
        description: char.description,
        promptCn: char.description,
        imageUrl: char.imageUrl,
        isPromptGenerated: !!char.imageUrl,
      };
      newCards.push(card);
    }
    for (const scene of td.scenes) {
      const card: EntityCard = {
        id: `ts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'scene',
        name: scene.name,
        description: scene.description,
        promptCn: scene.description,
        imageUrl: scene.imageUrl,
        isPromptGenerated: !!scene.imageUrl,
      };
      newCards.push(card);
    }
    for (const shot of td.shots) {
      const card: EntityCard = {
        id: `tsh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'shot',
        name: shot.shotId,
        description: shot.content,
        promptCn: shot.content,
        imageUrl: shot.imageUrl,
        isPromptGenerated: !!shot.imageUrl,
      };
      newCards.push(card);
    }
    if (newCards.length > 0) {
      setEntityCards(prev => [...prev, ...newCards]);
    }

    // 3. 收集所有参考图到素材
    const allRefImages = [
      ...td.characters.filter(c => c.imageUrl).map(c => ({ url: c.imageUrl!, name: c.name })),
      ...td.scenes.filter(s => s.imageUrl).map(s => ({ url: s.imageUrl!, name: s.name })),
      ...td.shots.filter(s => s.imageUrl).map(s => ({ url: s.imageUrl!, name: s.shotId })),
    ];
    for (const img of allRefImages) {
      setMaterials(prev => [...prev, { text: `[参考图] ${img.name}`, type: 'image', url: img.url }]);
    }

    // 4. 使用故事梗概直接开始生成视频
    const prompt = td.storySummary || '';

    if (prompt.trim()) {
      // 延迟一帧让state更新后再触发生成
      setTimeout(() => {
        handlePlanCreation(prompt);
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferredData]);

  // ============================================================
  // 自动生成（从控制台跳转）
  // ============================================================
  useEffect(() => {
    if (autoGenerate && initialPrompt && !autoGenerateRef.current && !isGenerating) {
      autoGenerateRef.current = true;
      handlePlanCreation(initialPrompt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, initialPrompt]);

  // ============================================================
  // 输入变化分析
  // ============================================================
  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
  }, []);

  // ============================================================
  // 实体类型标签颜色
  // ============================================================
  const typeConfig: Record<string, { label: string; color: string; icon: typeof Film }> = {
    plot: { label: '剧情', color: 'bg-red-500/10 text-red-500', icon: FileText },
    character: { label: '人物', color: 'bg-red-500/10 text-red-500', icon: UserCircle },
    scene: { label: '场景', color: 'bg-emerald-500/10 text-emerald-500', icon: ImageIcon },
    prop: { label: '道具', color: 'bg-purple-500/10 text-purple-500', icon: Package },
    shot: { label: '分镜', color: 'bg-red-500/10 text-red-500', icon: Clapperboard },
  };

  // 统计
  const stats = useMemo(() => ({
    plot: entityCards.filter(c => c.type === 'plot').length,
    characters: entityCards.filter(c => c.type === 'character').length,
    scenes: entityCards.filter(c => c.type === 'scene').length,
    props: entityCards.filter(c => c.type === 'prop').length,
    shots: entityCards.filter(c => c.type === 'shot').length,
    imagesGenerated: entityCards.filter(c => c.imageUrl).length,
    videosGenerated: entityCards.filter(c => c.videoUrl).length,
    totalNeedImage: entityCards.filter(c => c.type !== 'plot').length,
    totalNeedVideo: entityCards.filter(c => c.type === 'shot').length,
  }), [entityCards]);

  // 组件卸载时停止BGM/音色试听
  useEffect(() => {
    return () => {
      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause();
        bgmAudioRef.current = null;
      }
      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
        voiceAudioRef.current = null;
      }
    };
  }, []);

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <div className="flex flex-col h-full bg-card rounded-xl overflow-hidden border border-border/70">
      {/* 三栏主体 */}
      <div className="flex flex-1 min-h-0">
      <FilmWorkflowSidebar
        {...{
          addWorkflowMsg, appendSearchRef, assetCardsExpanded, bgmAudioRef, bgmPreviewPlaying, bgmType, bgmVolume, cfgExpand, composeProgress, composeStatus, consistencyChecking, consistencyMode, consistencyResults, consistencySvcExpand, copyrightNotice, customCharStyle, customDuration, customPropStyle, customSceneStyle, customScriptType, enhancePanelOpen, entityCards, expandedPhaseSection, fileInputRef, filmTtsSpeed, formatDuration, generationMode, generationStage, goToPhase, handleBridgeFrames, handleComposeFilm, handleConsistencyCheck, handleEnhanceCharacters, handleEnhanceScenes, handleExtractLastFrame, handleFileUpload, handleFilmSearch, handleGenerateAllAssets, handleGenerateAllVideos, handleGenerateAnchor, handleGenerateEndFrame, handleGenerateImage, handleGenerateProps, handleGenerateShotVideo, handleGenerateStartFrame, handlePlanCreation, handlePreviewBgm, handlePreviewVoice, handleExtendPrompt, inputText, isBridging, isGenerating, isSearching, materialInput, materials, phase, refEntitiesExpanded, script, scriptDirectorRef, scriptScreenplayRef, scriptType, searchQuery, searchResults, searchSummary, searchType, selectedCardId, selectedService, setAssetCardsExpanded, setAutoGenerateAssets, setBgmPreviewPlaying, setBgmType, setBgmVolume, setCfgExpand, setConsistencyMode, setConsistencySvcExpand, setCustomCharStyle, setCustomDuration, setCustomPropStyle, setCustomSceneStyle, setCustomScriptType, setEnhancePanelOpen, setEntityCards, setExpandedPhaseSection, setFilmTtsSpeed, setGenerationMode, setInputText, setMaterialInput, setMaterials, setPhase, setRefEntitiesExpanded, setScript, setScriptType, setSearchQuery, setSearchType, setSelectedCardId, setSelectedService, setSfxType, setSfxVolume, setStoryTab, setTargetDuration, setUploadedFiles, setVideoDuration, setVideoRatio, setVisualStyle, setVoiceType, setWsFilter, setWsPreviewUrl, sfxType, sfxVolume, showSearchResults, stats, storyTab, targetDuration, typeConfig, uploadedFiles, videoDuration, videoRatio, visualStyle, voicePreviewPlaying, voiceType, wsFilter,
        }}
      />

      <FilmMainStageWorkspace
        {...{
          chatEndRef, chatInput, chatInputHighlight, chatInputRef, chatMessages, chatPlaceholder, complianceResult, composeProgress, directorAnalysis, entityCards, entityCardsGridRef, error, expandedShotIds, fileInputRef, filmHistory, filmVisualStyle, finalVideoUrl, generationProgress, generationStage, handleBatchGenerateFrames, handleComposeFilm, handleExportPDF, handleFileUpload, handleGenerateAllImages, handleGenerateEndFrame, handleGenerateImage, handleGenerateNineGrid, handleGeneratePrompt, handleSelectNineGridImage, handleGenerateStartFrame, handleGenerateShotVideo, handleQuickCmd, handleRegenerateVideo, handleSendChat, handleSwitchOutfit, inputText, isChatStreaming, isGenerating, middleAiStatus, phase, progressMsg, script, scriptDirectorRef, scriptScreenplayRef, selectedCardId, setChatInput, setComposeStatus, setError, setExpandedShotIds, setFilmVisualStyle, setFinalVideoUrl, setMiddleAiStatus, setNineGridDialogCardId, setPhase, setPromptManagerOpen, setSelectedCardId, setShowChatMessages, setShowDirectorPanel, setShowScriptPreview, setShowHistoryPanel, setShowLogPanel, setUploadedFiles, setShotViewMode, setWardrobeDialogCardId, setWsPreviewUrl, shotViewMode, showChatMessages, showDirectorPanel, showLogPanel, stats, streamingScriptText, typeConfig, updateCardField, uploadedFiles, videoDuration, goToPhase,
        }}
      />
      {/* ============================================ */}
      {/* 右栏: 创作日志 + 生成进度 */}
      {/* ============================================ */}
      {showLogPanel && (
        <FilmCreationLogPanel
          panelRef={rightLogPanelRef}
          workflowMessages={workflowMessages}
          generationLogs={generationLogs}
          logFilter={logFilter}
          isGenerationLogsExpanded={expandedPhaseSection === 'gen-logs'}
          hasCreativeInput={chatInput.trim().length > 0 || inputText.trim().length > 0}
          hasExistingPlan={entityCards.length > 0}
          hasAnyEntityCards={entityCards.length > 0}
          hasAnyShot={entityCards.some(c => c.type === 'shot')}
          hasScriptOrCards={!!script || entityCards.length > 0}
          onClearLogs={() => { setWorkflowMessages([]); setGenerationLogs([]); }}
          onLogFilterChange={setLogFilter}
          onToggleGenerationLogs={() => setExpandedPhaseSection(prev => prev === 'gen-logs' ? null : 'gen-logs')}
          onNeedCreativeInput={() => {
            addWorkflowMsg('assistant',
              '请先在底部输入创意描述，例如："一个关于时间旅行的科幻故事"。\n\n' +
              '输入后点击发送或按回车，我会自动为你生成创作规划。',
              undefined, 'info');
          }}
          onNeedPlan={(label) => {
            addWorkflowMsg('assistant', `请先生成创作规划（点击「生成剧本」），有了角色和场景数据后才能执行「${label}」。`, undefined, 'info');
          }}
          onNeedShots={(label) => {
            addWorkflowMsg('assistant', `请先生成创作规划，有了分镜数据后才能执行「${label}」。`, undefined, 'info');
          }}
          onWorkflowCommand={handleWorkflowCommand}
          onExportPDF={handleExportPDF}
        />
      )}
      </div>{/* 三栏主体结束 */}





      <FilmCreationDialogs
        {...{
          addWorkflowMsg, clearFilmHistory, deleteFilmHistory, entityCards, filmHistory,
          handleAddWardrobeOutfit, handleExportPDF, handleGenerateNineGrid, handleGenerateOutfitImage,
          handleNewConversation, handleRollbackPrompt, handleSelectNineGridImage, handleSwitchOutfit,
          nineGridDialogCardId, previewImageUrl, promptManagerOpen, script, setEntityCards,
          setFilmVisualStyle, setNineGridDialogCardId, setPhase, setPreviewImageUrl,
          setPromptManagerOpen, setScript, setShowHistoryPanel, setShowScriptPreview,
          setWardrobeDialogCardId, setWsPreviewUrl, showHistoryPanel, showScriptPreview,
          stats, typeConfig, wardrobeDialogCardId, wsPreviewUrl,
        }}
      />
    </div>
  );
}
