'use client';

import dynamic from 'next/dynamic';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Video,
  Image as ImageIcon,
  Sparkles,
  Diamond,
  Link as LinkIcon,
  Upload,
  Clock,
  MoreHorizontal,
  Wand2,
  Loader2,
  FileAudio,
  X,
  Copy,
  Music,
  Type,
  PenTool,
  RotateCcw,
  RefreshCw,
  Film,
  Captions,
  Volume2,
  AlertTriangle,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUp,
  ArrowDown,
  Star,
  Zap,
  Palette,
  Globe,
  Layers,
  Plus,
  ChevronDown,
  Check,
  ImagePlus,
  Maximize2,
} from 'lucide-react';
import { ConsoleTypeButton } from './generation-console/console-type-button';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatProviderError, getBYOKRequestHeaders } from '@/lib/byok-client';
import { SuggestionChip } from './generation-console/suggestion-chip';
import { TaskList } from './generation-console/task-list';
import { SmartPanel } from './generation-console/smart-panel';
import { ConfirmationPanel } from './generation-console/confirmation-panel';
import { PromptPreview, type PromptData } from './prompt-preview';
import { getBgmTypeList } from '@/constants/bgm-types';

// ============================================================
// 模型选择配置
// ============================================================
const VIDEO_MODELS = [
  { code: 'auto', name: '自动推荐', desc: 'AI根据场景自动选择最优模型', icon: Sparkles, color: 'text-[#70E0FF]' },
  { code: 'sora_2', name: 'Sora 2', desc: '顶级画质·电影叙事·10秒', icon: Star, color: 'text-[#70E0FF]' },
  { code: 'kling_2_6', name: 'Kling 2.6', desc: '高画质·音画同步·角色一致', icon: Zap, color: 'text-[#70E0FF]' },
  { code: 'seedance_2_0', name: 'Seedance 2.0', desc: '3D动画·长视频·性价比高', icon: Palette, color: 'text-[#8B5CF6]' },
  { code: 'veo_3_1', name: 'Veo 3.1', desc: '极速生成·短片段·实时预览', icon: Globe, color: 'text-[#70E0FF]' },
  { code: 'wan_2_6', name: 'Wan 2.6', desc: '低成本·快速出片·批量生产', icon: Layers, color: 'text-[#70E0FF]' },
  { code: 'mamoda_2_5', name: 'Mamoda 2.5', desc: '均衡画质·音画同步·角色一致', icon: Film, color: 'text-[#70E0FF]' },
] as const;

const IMAGE_MODELS = [
  { code: 'auto', name: '自动推荐', desc: 'AI根据场景自动选择最优模型', icon: Sparkles, color: 'text-[#70E0FF]' },
  { code: 'flux_pro', name: 'Flux Pro', desc: '顶级画质·细节丰富', icon: Star, color: 'text-[#70E0FF]' },
  { code: 'sd_xl', name: 'SD XL', desc: '高性价比·快速出图', icon: Zap, color: 'text-[#70E0FF]' },
  { code: 'midjourney_v7', name: 'MJ V7', desc: '艺术风格·创意出图', icon: Palette, color: 'text-[#8B5CF6]' },
] as const;

type ModelCode = string;

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  auto: '自动推荐',
  sora_2: 'Sora 2',
  kling_2_6: 'Kling 2.6',
  seedance_2_0: 'Seedance 2.0',
  veo_3_1: 'Veo 3.1',
  wan_2_6: 'Wan 2.6',
  mamoda_2_5: 'Mamoda 2.5',
  flux_pro: 'Flux Pro',
  sd_xl: 'SD XL',
  midjourney_v7: 'MJ V7',
};

const ALL_MODELS = [...VIDEO_MODELS, ...IMAGE_MODELS];

// ============================================================
// 类型
// ============================================================
export type ConsoleType = 'video' | 'image' | 'smart' | 'film';

export interface GeneratedImage {
  id: string;
  taskId?: string;
  imageUrls: string[];
  prompt: string;
  createdAt: number;
  size?: string;
}

export interface GeneratedVideo {
  id: string;
  taskId: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  videoUrl?: string;
  coverUrl?: string;
  createdAt: number;
}

export interface ConsoleTask {
  id: string;
  type: 'video' | 'image' | 'smart' | 'film';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  resultUrl?: string;
  prompt: string;
  createdAt: number;
  degraded?: boolean;
}

export interface GenerationConsoleProps {
  onImageGenerated?: (image: GeneratedImage) => void;
  onVideoGenerated?: (video: GeneratedVideo) => void;
  onSmartMatch?: (message: string) => void;
  onNavigate?: (section: string, sub?: string, data?: unknown) => void;
}

// ============================================================
// localStorage 持久化辅助（组件外定义，确保 useState 初始化器可用）
// ============================================================
function saveConfig<T>(key: string, val: T) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}
function readLocalConfig<T>(key: string, defaultVal: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : defaultVal; } catch { return defaultVal; }
}

// ============================================================
// 影视创作面板
// ============================================================
// 主组件
// ============================================================
export default function GenerationConsole({
  onImageGenerated,
  onVideoGenerated,
  onSmartMatch,
  onNavigate,
}: GenerationConsoleProps) {
  const { t } = useLanguage();
  // ---- 状态 ----
  // 注意：所有 useState 初始值使用硬编码默认值，避免 SSR/Client hydration mismatch
  // localStorage 中的配置在下方 useEffect 中统一恢复
  const [activeType, setActiveType] = useState<ConsoleType>('video');
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<number>(6);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showRatioDropdown, setShowRatioDropdown] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tasks, setTasks] = useState<ConsoleTask[]>([]);

  // Smart match 对话
  const [smartMessages, setSmartMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [smartOpen, setSmartOpen] = useState(false);
  const [smartInput, setSmartInput] = useState('');

  // 智能生成确认面板（绘影精灵参数确认）
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    intent: string;
    collectedParams: Record<string, unknown>;
    message: string;
  } | null>(null);

  // 提示词优化确认面板（视频/图像生成前）
  const [pendingPromptReview, setPendingPromptReview] = useState<{
    original: string;
    enhanced: string;
    type: 'video' | 'image';
  } | null>(null);

  // 视频结果展示模式：只显示视频播放器，隐藏其他UI
  const [showResultView, setShowResultView] = useState(false);
  const [showVideoOverlay, setShowVideoOverlay] = useState(false);

  // 提示词确认面板中附加内容区域的展开状态
  const [showReviewAddons, setShowReviewAddons] = useState(false);

  // 附件 & 扩展功能
  const [attachments, setAttachments] = useState<Array<{ url: string; name: string; type: string }>>([]);
  const [pasteToast, setPasteToast] = useState<string | null>(null);  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [audioScript, setAudioScript] = useState('');
  const [showAudioInput, setShowAudioInput] = useState(false);
  const [autoStyle, setAutoStyle] = useState(false);
  const [autoPostProcess, setAutoPostProcess] = useState(false);
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);
  const [promptPreviewData, setPromptPreviewData] = useState<PromptData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const configRestoredRef = useRef(false);

  // 模型选择
  const [selectedModel, setSelectedModel] = useState<string>('auto');

  // ---- 高级配置：字幕 ----
  const [subtitleEnabled, setSubtitleEnabled] = useState(false);
  const [subtitleSource, setSubtitleSource] = useState<'custom' | 'extract' | 'none'>('none');
  const [subtitlePosition, setSubtitlePosition] = useState<'bottom' | 'top' | 'center'>('bottom');
  const [subtitleFontSize, setSubtitleFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [subtitleColor, setSubtitleColor] = useState('#FFFFFF');
  const [subtitleVoiceType, setSubtitleVoiceType] = useState('xiaosi');
  const [subtitleSpeechSpeed, setSubtitleSpeechSpeed] = useState<number>(1.0);
  const [generateVoice, setGenerateVoice] = useState(false);
  const [subtitleText, setSubtitleText] = useState('');
  const [showVoiceSelect, setShowVoiceSelect] = useState(false);
  const voiceLabels: Record<string, string> = { xiaosi: '知性女声 - 温柔稳重', xiaoshu: '青年男声 - 阳光有力', xiaoyao: '活泼女声 - 轻快灵动', xiaoxing: '成熟男声 - 沉稳磁性' };

  // 音频脚本与字幕互通：当audioScript变化时自动同步到subtitleText
  useEffect(() => {
    if (audioScript.trim() && subtitleSource === 'extract') {
      setSubtitleText(audioScript);
      if (!subtitleEnabled) setSubtitleEnabled(true);
    }
  }, [audioScript, subtitleSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // 持久化到localStorage（跳过首次渲染，避免默认值覆盖 localStorage）
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_subtitleEnabled', subtitleEnabled); }, [subtitleEnabled, saveConfig]);
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_subtitleSource', subtitleSource); }, [subtitleSource, saveConfig]);
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_subtitlePosition', subtitlePosition); }, [subtitlePosition, saveConfig]);
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_subtitleFontSize', subtitleFontSize); }, [subtitleFontSize, saveConfig]);
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_subtitleColor', subtitleColor); }, [subtitleColor, saveConfig]);
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_subtitleVoiceType', subtitleVoiceType); }, [subtitleVoiceType, saveConfig]);
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_subtitleSpeechSpeed', subtitleSpeechSpeed); }, [subtitleSpeechSpeed, saveConfig]);
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_generateVoice', generateVoice); }, [generateVoice, saveConfig]);
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_autoPostProcess', autoPostProcess); }, [autoPostProcess, saveConfig]);

  // ---- 高级配置：BGM ----
  const [bgmMode, setBgmMode] = useState<'none' | 'type' | 'upload'>('none');
  const [bgmType, setBgmType] = useState('epic');
  const [bgmUrl, setBgmUrl] = useState('');

  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_bgmMode', bgmMode); }, [bgmMode, saveConfig]);
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_bgmType', bgmType); }, [bgmType, saveConfig]);

  // 持久化：基础配置
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_activeType', activeType); }, [activeType, saveConfig]);
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_duration', duration); }, [duration, saveConfig]);
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_aspectRatio', aspectRatio); }, [aspectRatio, saveConfig]);
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_showMoreOptions', showMoreOptions); }, [showMoreOptions, saveConfig]);

  // ---- 高级配置：视频文字/标注 ----
  const [videoTextEnabled, setVideoTextEnabled] = useState(false);
  const [videoTextContent, setVideoTextContent] = useState('');
  const [videoTextPosition, setVideoTextPosition] = useState('center');

  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_videoTextEnabled', videoTextEnabled); }, [videoTextEnabled, saveConfig]);
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_videoTextContent', videoTextContent); }, [videoTextContent, saveConfig]);
  useEffect(() => { if (configRestoredRef.current) saveConfig('gc_videoTextPosition', videoTextPosition); }, [videoTextPosition, saveConfig]);

  // ---- 高级配置：特效 ----
  const [animation, setAnimation] = useState<'none' | 'fade' | 'slide' | 'scale'>('none');

  // ---- 挂载时从 localStorage 恢复配置（避免 SSR hydration mismatch）----
  useEffect(() => {
    setActiveType(readLocalConfig('gc_activeType', 'video'));
    setDuration(readLocalConfig('gc_duration', 6));
    setAspectRatio(readLocalConfig('gc_aspectRatio', '9:16'));
    setShowMoreOptions(readLocalConfig('gc_showMoreOptions', false));
    setSelectedModel(readLocalConfig('gc_selectedModel', 'auto'));
    setAutoPostProcess(readLocalConfig('gc_autoPostProcess', false));
    setSubtitleEnabled(readLocalConfig('gc_subtitleEnabled', false));
    setSubtitleSource(readLocalConfig('gc_subtitleSource', 'none'));
    setSubtitlePosition(readLocalConfig('gc_subtitlePosition', 'bottom'));
    setSubtitleFontSize(readLocalConfig('gc_subtitleFontSize', 'medium'));
    setSubtitleColor(readLocalConfig('gc_subtitleColor', '#FFFFFF'));
    setSubtitleVoiceType(readLocalConfig('gc_subtitleVoiceType', 'xiaosi'));
    setSubtitleSpeechSpeed(readLocalConfig('gc_subtitleSpeechSpeed', 1.0));
    setGenerateVoice(readLocalConfig('gc_generateVoice', false));
    setBgmMode(readLocalConfig('gc_bgmMode', 'none'));
    setBgmType(readLocalConfig('gc_bgmType', 'epic'));
    setVideoTextEnabled(readLocalConfig('gc_videoTextEnabled', false));
    setVideoTextContent(readLocalConfig('gc_videoTextContent', ''));
    setVideoTextPosition(readLocalConfig('gc_videoTextPosition', 'center'));
    configRestoredRef.current = true;
  }, []);

  // ---- 清理完成的任务 ----
  useEffect(() => {
    const timer = setInterval(() => {
      setTasks((prev) => prev.filter((t) => !(t.status === 'completed' || t.status === 'failed')));
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // ---- 轮询视频任务 ----
  const pollVideoTask = useCallback(
    async (taskId: string, consoleId: string) => {
      const maxAttempts = 300;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const res = await fetch(`/api/tasks/${taskId}`);
          const data = await res.json();
          if (data.task) {
            const progress = data.task.progress || 0;
            const statusMap: Record<string, ConsoleTask['status']> = {
              pending: 'pending',
              running: 'processing',
              processing: 'processing',
              completed: 'completed',
              failed: 'failed',
            };
            const newStatus = statusMap[data.task.status] || 'processing';
            setTasks((prev) =>
              prev.map((t) =>
                t.id === consoleId
                  ? {
                      ...t,
                      status: newStatus,
                      progress,
                      message: data.task.message || t.message,
                      resultUrl: data.task.result?.videoUrl,
                    }
                  : t
              )
            );
            if (data.task.status === 'completed') {
              const isDegraded = data.task.result?.degraded === true;
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === consoleId
                    ? { ...t, status: 'completed' as const, progress: 100, resultUrl: data.task.result?.videoUrl, degraded: isDegraded }
                    : t
                )
              );
              if (onVideoGenerated) {
                onVideoGenerated({
                  id: consoleId,
                  taskId,
                  prompt: tasks.find((t) => t.id === consoleId)?.prompt || '',
                  status: 'completed',
                  progress: 100,
                  videoUrl: data.task.result?.videoUrl,
                  coverUrl: data.task.result?.lastFrameUrl,
                  createdAt: Date.now(),
                });
              }
              setShowResultView(true);
              return;
            }
            if (data.task.status === 'failed') {
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === consoleId
                    ? { ...t, status: 'failed', message: data.task.error || '生成失败' }
                    : t
                )
              );
              return;
            }
          }
        } catch (e) {
          console.error('Poll error:', e);
        }
      }
      setTasks((prev) => prev.map((t) => (t.id === consoleId ? { ...t, status: 'failed', message: '任务超时' } : t)));
    },
    [onVideoGenerated, tasks]
  );

  // ---- 上传文件 ----
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          setAttachments((prev) => [...prev, { url: data.url, name: data.name, type: data.type }]);
        } else {
          throw new Error(data.error || '上传失败');
        }
      } catch (err: unknown) {
        alert('上传失败: ' + (err instanceof Error ? err.message : '未知错误'));
      }
    }
  };

  // ---- 提取 URL 内容 ----
  const handleUrlExtract = async () => {
    if (!urlInput.trim()) return;
    try {
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (data.content) {
        setPrompt((prev) => prev + (prev ? '\n\n' : '') + '【链接内容】\n' + data.content.substring(0, 800));
      } else {
        setPrompt((prev) => prev + (prev ? '\n\n' : '') + '【链接】\n' + urlInput.trim());
      }
      setShowUrlInput(false);
      setUrlInput('');
    } catch {
      setPrompt((prev) => prev + (prev ? '\n\n' : '') + '【链接】\n' + urlInput.trim());
      setShowUrlInput(false);
      setUrlInput('');
    }
  };

  // ---- BGM 文件上传 ----
  const bgmFileInputRef = useRef<HTMLInputElement>(null);
  const handleBgmUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = Array.from(files)[0];
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setBgmUrl(data.url);
        setBgmMode('upload');
      } else {
        throw new Error(data.error || '上传失败');
      }
    } catch (err: unknown) {
      alert('BGM 上传失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  // ---- 实际视频生成 ----
  const executeVideoGenerate = async (generatePrompt: string) => {
    const consoleId = `console-${Date.now()}`;
    const enhanced = generatePrompt;
    const audioAppend = audioScript.trim() ? '\n\n【音频脚本】' + audioScript.trim() : '';
    const styleAppend = autoStyle ? '\n\n【风格】自动选择最佳视觉风格' : '';
    const attachAppend = attachments.length > 0 ? '\n\n【附件】' + attachments.map((a) => a.url).join('\n') : '';
    const fullPrompt = enhanced + audioAppend + styleAppend + attachAppend;

    setTasks((prev) => [
      ...prev,
      {
        id: consoleId,
        type: 'video',
        status: 'processing',
        progress: 0,
        message: '正在创建视频生成任务...',
        prompt: generatePrompt,
        createdAt: Date.now(),
      },
    ]);

    const videoBody: Record<string, unknown> = {
      prompt: fullPrompt,
      duration,
      materials: attachments.map((a) => a.url),
      enableSubtitle: subtitleEnabled,
      subtitlePosition: subtitlePosition,
      subtitleFontSize: subtitleFontSize === 'small' ? 14 : subtitleFontSize === 'medium' ? 18 : 24,
      subtitleColor: subtitleColor,
      subtitleVoiceType: subtitleVoiceType,
      subtitleSpeechSpeed: subtitleSpeechSpeed,
      generateVoice: generateVoice,
      autoPostProcess: autoPostProcess,
      subtitleFontType: 'noto',
      ...(bgmMode === 'type' && { backgroundBgm: bgmType }),
      ...(bgmMode === 'upload' && bgmUrl && {
        backgroundBgm: 'custom',
        customAudio: { url: bgmUrl, volume: 0.3 },
      }),
      enableVideoText: videoTextEnabled,
      ...(videoTextEnabled && {
        videoText: videoTextContent,
        videoTextPosition: videoTextPosition,
      }),
      subtitleText: subtitleSource === 'custom'
        ? subtitleText.trim()
        : subtitleSource === 'extract'
          ? (audioScript || fullPrompt)
          : '',
    };

    const res = await fetch('/api/video/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
      body: JSON.stringify(videoBody),
    });
    const data = await res.json();
    if (data.taskId) {
      setTasks((prev) =>
        prev.map((t) => (t.id === consoleId ? { ...t, message: '视频生成中...' } : t))
      );
      pollVideoTask(data.taskId, consoleId);
    } else {
      throw new Error(data.error || '创建任务失败');
    }
  };

  // ---- 实际图片生成（异步模式，写入后台任务记录） ----
  const executeImageGenerate = async (generatePrompt: string) => {
    const consoleId = `console-${Date.now()}`;
    setTasks((prev) => [
      ...prev,
      {
        id: consoleId,
        type: 'image',
        status: 'processing',
        progress: 0,
        message: '正在生成图片...',
        prompt: generatePrompt,
        createdAt: Date.now(),
      },
    ]);

    try {
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
        body: JSON.stringify({
          prompt: generatePrompt,
          size: aspectRatio === '9:16' ? '1024x1792' : aspectRatio === '16:9' ? '1792x1024' : '1024x1024',
          count: 1,
          async: true,
        }),
      });
      const data = await res.json();
      if (data.taskId) {
        // 异步模式：轮询任务状态
        pollImageTask(data.taskId, consoleId, generatePrompt);
      } else if (data.imageUrls && data.imageUrls.length > 0) {
        // 降级：同步返回
        const image: GeneratedImage = {
          id: consoleId,
          imageUrls: data.imageUrls,
          prompt: generatePrompt,
          createdAt: Date.now(),
        };
        setTasks((prev) =>
          prev.map((t) =>
            t.id === consoleId
              ? { ...t, status: 'completed', progress: 100, message: '图片生成完成', resultUrl: data.imageUrls[0] }
              : t
          )
        );
        if (onImageGenerated) onImageGenerated(image);
      } else {
        throw new Error(formatProviderError(data, '生成图片失败'));
      }
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === consoleId
            ? { ...t, status: 'failed', message: err instanceof Error ? err.message : '生成图片失败' }
            : t
        )
      );
    }
  };

  // ---- 轮询图片任务 ----
  const pollImageTask = useCallback(
    async (taskId: string, consoleId: string, generatePrompt: string) => {
      const maxAttempts = 120;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const res = await fetch(`/api/tasks/${taskId}`);
          const data = await res.json();
          if (data.task) {
            const progress = data.task.progress || 0;
            const statusMap: Record<string, ConsoleTask['status']> = {
              pending: 'pending',
              running: 'processing',
              processing: 'processing',
              completed: 'completed',
              failed: 'failed',
            };
            const newStatus = statusMap[data.task.status] || 'processing';
            const imageUrl = data.task.result?.imageUrls?.[0] || data.task.result?.image_urls?.[0];
            setTasks((prev) =>
              prev.map((t) =>
                t.id === consoleId
                  ? {
                      ...t,
                      status: newStatus,
                      progress,
                      message: data.task.message || t.message,
                      resultUrl: imageUrl,
                    }
                  : t
              )
            );
            if (data.task.status === 'completed') {
              const isDegraded = data.task.result?.degraded === true;
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === consoleId
                    ? { ...t, status: 'completed' as const, progress: 100, resultUrl: imageUrl, degraded: isDegraded }
                    : t
                )
              );
              const image: GeneratedImage = {
                id: consoleId,
                taskId,
                imageUrls: data.task.result?.imageUrls || data.task.result?.image_urls || [],
                prompt: generatePrompt,
                createdAt: Date.now(),
              };
              if (onImageGenerated) onImageGenerated(image);
              return;
            }
            if (data.task.status === 'failed') {
              return;
            }
          }
        } catch {
          // 轮询失败继续
        }
      }
    },
    [onImageGenerated]
  );

  // ---- 生成 ----
  const handleGenerate = async () => {
    if (isGenerating) return;

    const promptText = prompt.trim();

    // video 模式：跳转影视创作全屏面板，默认视频生成服务
    if (activeType === 'video') {
      onNavigate?.('video', undefined, { prompt: promptText, autoGenerate: true });
      setPrompt('');
      return;
    }

    // image 模式：跳转图像创作全屏面板并自动生成
    if (activeType === 'image') {
      const imageAttachmentUrls = attachments.filter(a => a.type.startsWith('image/')).map(a => a.url);
      // 有粘贴图片但无文字时，使用更适合图生图的默认提示词
      const effectiveImagePrompt = promptText || (imageAttachmentUrls.length > 0 ? '基于参考图片风格创作一幅新的数字艺术作品' : '一幅唯美的数字艺术作品，色彩丰富，构图精美');
      onNavigate?.('image', undefined, { prompt: effectiveImagePrompt, autoGenerate: true, imageRefs: imageAttachmentUrls });
      setPrompt('');
      setAttachments([]);
      return;
    }

    // smart 模式：跳转绘影精灵全屏面板
    if (activeType === 'smart') {
      onNavigate?.('smart', undefined, { prompt: promptText, autoGenerate: true });
      setPrompt('');
      return;
    }

    // film 模式：跳转影视创作全屏面板，默认分镜剧本服务
    if (activeType === 'film') {
      onNavigate?.('film', undefined, { prompt: promptText, autoGenerate: true, targetService: 'storyboard_script' });
      setPrompt('');
      return;
    }
  };

  // ---- 确认使用优化后的提示词 ----
  const handleConfirmPrompt = async (useEnhanced: boolean) => {
    if (!pendingPromptReview) return;
    const generatePrompt = useEnhanced ? pendingPromptReview.enhanced : pendingPromptReview.original;
    const generateType = pendingPromptReview.type;
    setPendingPromptReview(null);
    setPrompt('');

    // 跳转全屏创作面板
    if (generateType === 'video') {
      onNavigate?.('film', undefined, { prompt: generatePrompt, autoGenerate: true, targetService: 'video_generation' });
    } else {
      const imageAttachmentUrls = attachments.filter(a => a.type.startsWith('image/')).map(a => a.url);
      onNavigate?.('image', undefined, { prompt: generatePrompt, autoGenerate: true, imageRefs: imageAttachmentUrls });
      setAttachments([]);
    }
  };

  const handleCancelPromptReview = () => {
    setPendingPromptReview(null);
  };

  // ---- 确认生成：应用AI收集的参数并执行 ----
  const handleConfirmGenerate = () => {
    if (!pendingConfirmation) return;
    const { intent, collectedParams } = pendingConfirmation;
    const intentMap: Record<string, ConsoleType> = {
      generate_video: 'video',
      generate_image: 'image',
      generate_copywriting: 'video',
      generate_poster: 'image',
      generate_avatar: 'image',
    };
    const targetType = intentMap[intent];
    if (!targetType) return;

    // 应用参数
    setActiveType(targetType);
    const topic = String(collectedParams?.topic || collectedParams?.content || collectedParams?.prompt || '');
    setPrompt(topic);

    // 应用视频相关参数
    if (targetType === 'video') {
      if (collectedParams?.totalDuration) {
        const match = String(collectedParams.totalDuration).match(/(\d+)/);
        if (match) {
          const d = parseInt(match[1]);
          if (d >= 6 && d <= 30) setDuration(d);
        }
      }
      if (collectedParams?.globalStyle) {
        setAutoStyle(true);
      }
      if (collectedParams?.bgmMood && collectedParams.bgmMood !== '无') {
        setBgmMode('type');
        const bgmMap: Record<string, string> = {
          轻快: 'upbeat',
          舒缓: 'relaxing',
          史诗: 'epic',
          浪漫: 'romantic',
        };
        setBgmType(bgmMap[String(collectedParams.bgmMood)] || 'epic');
      }
      if (collectedParams?.voiceType) {
        setGenerateVoice(true);
        setSubtitleVoiceType(String(collectedParams.voiceType) === '男声' ? 'xiaosi' : 'zhimiao');
      }
      if (collectedParams?.text) {
        setAudioScript(String(collectedParams.text));
      }
    }

    // 应用图片相关参数
    if (targetType === 'image') {
      if (collectedParams?.size) {
        const sizeMap: Record<string, string> = { '1:1': '1:1', '9:16': '9:16', '16:9': '16:9' };
        setAspectRatio(sizeMap[String(collectedParams.size)] || '9:16');
      }
    }

    // 关闭确认面板和精灵面板
    setPendingConfirmation(null);
    setSmartOpen(false);

    // 跳转全屏创作面板
    const targetPanel = targetType === 'video' || intent === 'generate_film' ? 'film' : 'image';
    onNavigate?.(targetPanel, undefined, { prompt: topic, autoGenerate: true });
    setPrompt('');
  };

  const handleCancelConfirmation = () => {
    setPendingConfirmation(null);
  };

  const handleSmartSend = async () => {
    if (!smartInput.trim() || isGenerating) return;
    const userMsg = smartInput.trim();
    setSmartInput('');
    setSmartMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsGenerating(true);
    try {
      const res = await fetch('/api/subtitle/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...smartMessages.map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: userMsg }],
          dialogState: { step: smartMessages.length + 1, totalSteps: 4 },
        }),
      });
      const data = await res.json();
      const result = data.result || data;
      const aiText = result.message || '收到，请稍候...';
      setSmartMessages((prev) => [...prev, { role: 'assistant', content: aiText }]);
      if (onSmartMatch) onSmartMatch(aiText);

      // 如果参数已收集完整，显示确认面板让用户确认
      if (result.readyToExecute && result.intent) {
        setPendingConfirmation({
          intent: result.intent,
          collectedParams: result.collectedParams || {},
          message: result.message || '',
        });
      }
    } catch (err: unknown) {
      setSmartMessages((prev) => [...prev, { role: 'assistant', content: '抱歉，发生了错误：' + (err instanceof Error ? err.message : '未知错误') }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  // 获取最新完成的视频结果
  const latestVideoResult = tasks
    .filter((t) => t.type === 'video' && t.status === 'completed' && t.resultUrl)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  return (
    <div className="w-full">
      {/* 视频结果展示模式：只显示视频 */}
      {showResultView && latestVideoResult && (
        <div className="mb-4">
          {/* 视频播放器容器 */}
          <div
            className="relative bg-black rounded-2xl overflow-hidden shadow-lg shadow-black/10 cursor-pointer"
            onClick={() => setShowVideoOverlay(prev => !prev)}
          >
            {/* 视频主体 */}
            <div className="aspect-video">
              <video
                src={latestVideoResult.resultUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
                poster={latestVideoResult.resultUrl}
                onClick={(e) => { e.stopPropagation(); }}
              />
            </div>

            {/* 点击控制层：默认隐藏，点击视频区域显示/隐藏 */}
            <div
              className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${showVideoOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              onClick={(e) => { e.stopPropagation(); setShowVideoOverlay(false); }}
            >
              {/* 顶部栏 */}
              <div className="flex items-center justify-between px-4 pt-4 pb-8 bg-gradient-to-b from-black/60 to-transparent pointer-events-auto">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm text-foreground/90 font-medium truncate drop-shadow max-w-[300px]">
                    {latestVideoResult.prompt || '视频生成完成'}
                  </p>
                </div>
                <button
                  onClick={() => setShowResultView(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/70 text-foreground hover:bg-accent backdrop-blur-sm transition-all shrink-0"
                  title="关闭"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 底部操作栏 */}
              <div className="flex items-center justify-center gap-3 px-4 pt-8 pb-4 bg-gradient-to-t from-black/60 to-transparent pointer-events-auto">
                <button
                  onClick={() => setShowResultView(false)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent/70 text-foreground text-sm font-medium hover:bg-accent backdrop-blur-sm transition-all active:scale-95"
                >
                  返回控制台
                </button>
                <button
                  onClick={() => {
                    setShowResultView(false);
                    setPrompt(latestVideoResult.prompt);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-600/90 text-white text-sm font-semibold hover:bg-red-600 backdrop-blur-sm transition-all active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  重新生成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 任务进度（视频结果模式下隐藏） */}
      {!showResultView && <TaskList tasks={tasks} onNavigate={onNavigate} />}

      {/* Smart Match 对话面板（视频结果模式下隐藏） */}
      {!showResultView && (
        <SmartPanel
          open={smartOpen && activeType === 'smart'}
          messages={smartMessages}
          input={smartInput}
          onInputChange={setSmartInput}
          onSend={handleSmartSend}
          onClose={() => setSmartOpen(false)}
          isLoading={isGenerating}
        />
      )}

      {/* 智能生成确认面板 */}
      {pendingConfirmation && (
        <ConfirmationPanel
          data={pendingConfirmation}
          isGenerating={isGenerating}
          onConfirm={handleConfirmGenerate}
          onCancel={handleCancelConfirmation}
        />
      )}

      {/* 提示词优化确认面板 */}
      {pendingPromptReview && (
        <div className="mb-3 bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border/50 bg-accent/20">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="w-4 h-4 text-[#EF4444]" />
              <span>提示词优化确认</span>
              <span className="text-xs text-foreground/70 font-normal ml-auto">
                {pendingPromptReview.type === 'video' ? 'AI 视频' : 'AI 图像'}
              </span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {/* 原始提示词 */}
            <div>
              <label className="text-xs text-foreground/70 mb-1 block">原始提示词</label>
              <div className="px-2 py-1.5 rounded-lg bg-accent/20 border border-border/50 text-sm text-muted-foreground leading-relaxed">
                {pendingPromptReview.original}
              </div>
            </div>
            {/* 优化后提示词 */}
            <div>
              <label className="text-xs text-[#EF4444] font-medium mb-1 block flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI 优化后提示词
              </label>
              <div className="px-2 py-1.5 rounded-lg bg-[#EF4444]/5 border border-[#EF4444]/20 text-sm text-foreground/80 leading-relaxed">
                {pendingPromptReview.enhanced}
              </div>
            </div>
            {/* 视频附加内容确认（仅视频模式） */}
            {pendingPromptReview.type === 'video' && (
              <div className="border border-border/50 rounded-xl overflow-hidden">
                {/* 阶段一：功能快速选择 */}
                {!showReviewAddons && (
                  <div className="px-3 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-foreground/80">选择需要添加的功能</span>
                      <span className="text-[10px] text-foreground/70">
                        {[
                          subtitleEnabled && '字幕',
                          generateVoice && '旁白',
                          bgmMode !== 'none' && 'BGM',
                          videoTextEnabled && '文字',
                          autoPostProcess && '自动后期',
                        ].filter(Boolean).length} / 5 项已选
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { key: 'subtitle', label: '字幕', icon: Captions, color: 'red', enabled: subtitleEnabled, onToggle: () => setSubtitleEnabled(!subtitleEnabled) },
                        { key: 'voice', label: '旁白', icon: Volume2, color: 'amber', enabled: generateVoice, onToggle: () => setGenerateVoice(!generateVoice) },
                        { key: 'bgm', label: 'BGM', icon: Music, color: 'red', enabled: bgmMode !== 'none', onToggle: () => setBgmMode(bgmMode === 'none' ? 'type' : 'none') },
                        { key: 'text', label: '文字', icon: Type, color: 'red', enabled: videoTextEnabled, onToggle: () => setVideoTextEnabled(!videoTextEnabled) },
                        { key: 'auto', label: '自动后期', icon: Sparkles, color: 'primary', enabled: autoPostProcess, onToggle: () => setAutoPostProcess(!autoPostProcess) },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.key}
                            onClick={item.onToggle}
                            className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border transition-all ${
                              item.enabled
                                ? 'border-red-300 bg-red-500/10 text-red-500 dark:text-red-300'
                                : 'border-border bg-accent/30 text-foreground/70 hover:border-white/20 hover:bg-accent'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${item.enabled ? 'text-red-500 dark:text-red-300' : 'text-foreground/20'}`} />
                            <span className="text-[11px] font-medium">{item.label}</span>
                            <span className={`text-[9px] ${item.enabled ? 'text-red-500 dark:text-red-300' : 'text-foreground/20'}`}>
                              {item.enabled ? '已开启' : '未开启'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {/* 智能推荐提示 */}
                    {![subtitleEnabled, generateVoice, bgmMode !== 'none', videoTextEnabled, autoPostProcess].some(Boolean) && (
                      <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                        <Sparkles className="w-3 h-3 text-red-400" />
                        <span className="text-[10px] text-red-300">建议为视频添加字幕和BGM以提升观看体验</span>
                      </div>
                    )}
                    {/* 冲突检测提示 */}
                    {subtitleEnabled && videoTextEnabled && videoTextPosition === 'bottom' && (
                      <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        <span className="text-[10px] text-red-300">字幕和视频文字都位于画面底部，建议调整文字位置避免重叠</span>
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setShowReviewAddons(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-all"
                      >
                        配置详情
                      </button>
                    </div>
                  </div>
                )}

                {/* 配置面板 */}
                {showReviewAddons && (
                  <div className="p-3 space-y-3 border-t border-border/50">
                    {/* 顶部操作栏 */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-foreground/70">配置将应用到生成的视频中</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSubtitleEnabled(false);
                            setGenerateVoice(false);
                            setBgmMode('none');
                            setVideoTextEnabled(false);
                          }}
                          className="px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                          一键清空
                        </button>
                        <button
                          onClick={() => setShowReviewAddons(false)}
                          className="px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-all"
                        >
                          收起
                        </button>
                      </div>
                    </div>
                    {/* 字幕烧录 - 三选一 */}
                    <div className="rounded-lg bg-secondary border-l-2 border-red-400 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Captions className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-xs font-medium text-muted-foreground">字幕烧录</span>
                        </div>
                        <button
                          onClick={() => {
                            if (!subtitleEnabled) {
                              setSubtitleEnabled(true);
                              setSubtitleSource('custom');
                            } else {
                              setSubtitleEnabled(false);
                            }
                          }}
                          className={`relative w-9 h-5 rounded-full transition-all ${subtitleEnabled ? 'bg-red-600' : 'bg-accent'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-card rounded-full shadow transition-all ${subtitleEnabled ? 'translate-x-4' : ''}`} />
                        </button>
                      </div>
                      {subtitleEnabled && (
                        <div className="space-y-2">
                          <div className="flex gap-1.5">
                            {([
                              { key: 'custom', label: '自定义', desc: '手动输入字幕文本' },
                              { key: 'extract', label: '从提示词提取', desc: '自动使用旁白内容作为字幕' },
                            ] as const).map((opt) => (
                              <button
                                key={opt.key}
                                onClick={() => setSubtitleSource(opt.key)}
                                className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] text-left transition-all ${
                                  subtitleSource === opt.key
                                    ? 'border-red-300 bg-red-50 text-red-700'
                                    : 'border-border/50 bg-card text-muted-foreground hover:border-border'
                                }`}
                              >
                                <div className="font-medium">{opt.label}</div>
                                <div className="text-[9px] opacity-70 mt-0.5">{opt.desc}</div>
                              </button>
                            ))}
                          </div>
                          {subtitleSource === 'custom' && (
                            <div className="relative">
                              <textarea
                                value={subtitleText}
                                onChange={(e) => setSubtitleText(e.target.value)}
                                placeholder="输入字幕文本..."
                                rows={3}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-border/50 text-xs text-muted-foreground placeholder:text-muted-foreground/50 outline-none focus:border-red-300 focus:ring-1 focus:ring-red-100 resize-none min-h-[100px] overflow-y-auto"
                              />
                              <div className="absolute bottom-1 right-1.5 text-[9px] text-foreground/70">
                                {subtitleText.length} 字
                              </div>
                            </div>
                          )}
                          {subtitleSource === 'extract' && (
                            <div className="px-2.5 py-2 rounded-lg bg-red-50 border border-red-100 text-[11px] text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300">
                              字幕将自动使用旁白/提示词内容生成
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 语音旁白 */}
                    <div className="rounded-lg bg-secondary border-l-2 border-red-400 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-xs font-medium text-muted-foreground">语音旁白 (TTS)</span>
                        </div>
                        <button
                          onClick={() => setGenerateVoice(!generateVoice)}
                          className={`relative w-9 h-5 rounded-full transition-all ${generateVoice ? 'bg-red-600' : 'bg-accent'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-card rounded-full shadow transition-all ${generateVoice ? 'translate-x-4' : ''}`} />
                        </button>
                      </div>
                      {generateVoice && (
                        <div className="space-y-2">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowVoiceSelect(!showVoiceSelect)}
                              className="w-full px-2 py-1.5 rounded-lg border border-border/50 text-xs text-muted-foreground outline-none focus:border-red-300 bg-card flex items-center justify-between"
                            >
                              <span>{voiceLabels[subtitleVoiceType] || '选择语音'}</span>
                              <ChevronDown className="w-3 h-3 text-muted-foreground" />
                            </button>
                            {showVoiceSelect && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/50 rounded-lg shadow-lg z-50 overflow-hidden">
                                {[{value:'xiaosi',label:'知性女声 - 温柔稳重'},{value:'xiaoshu',label:'青年男声 - 阳光有力'},{value:'xiaoyao',label:'活泼女声 - 轻快灵动'},{value:'xiaoxing',label:'成熟男声 - 沉稳磁性'}].map(v => (
                                  <button
                                    key={v.value}
                                    type="button"
                                    onClick={() => { setSubtitleVoiceType(v.value); setShowVoiceSelect(false); }}
                                    className={`w-full text-left px-3 py-2 text-xs transition-colors ${subtitleVoiceType === v.value ? 'bg-red-500/10 text-red-500 font-medium' : 'text-muted-foreground hover:bg-accent/50'}`}
                                  >
                                    {v.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* 语速分段按钮 */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-muted-foreground">语速</span>
                              <span className="text-[10px] font-medium text-red-600">{subtitleSpeechSpeed}x</span>
                            </div>
                            <div className="flex gap-1">
                              {[0.5, 0.8, 1.0, 1.3, 1.7, 2.0].map((speed) => (
                                <button
                                  key={speed}
                                  onClick={() => setSubtitleSpeechSpeed(speed)}
                                  className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${
                                    subtitleSpeechSpeed === speed
                                      ? 'bg-red-500 text-white shadow-sm'
                                      : 'bg-card border border-border/50 text-muted-foreground hover:border-red-300'
                                  }`}
                                >
                                  {speed}x
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 背景音乐 */}
                    <div className="rounded-lg bg-secondary border-l-2 border-red-400 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Music className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-xs font-medium text-muted-foreground">背景音乐</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {(['none', 'type', 'upload'] as const).map((m) => (
                            <button
                              key={m}
                              onClick={() => setBgmMode(m)}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all border ${
                                bgmMode === m
                                  ? 'bg-red-500 text-white border-red-500 shadow-sm'
                                  : 'bg-card text-muted-foreground border-border/50 hover:border-red-300'
                              }`}
                            >
                              {m === 'none' ? '无' : m === 'type' ? '预设' : '上传'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {bgmMode === 'type' && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-1.5">
                            {getBgmTypeList().map((style) => (
                              <button
                                key={style.id}
                                onClick={() => setBgmType(style.id)}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left transition-all ${
                                  bgmType === style.id
                                    ? 'border-red-300 bg-red-50'
                                    : 'border-border/50 bg-card hover:border-red-200'
                                }`}
                              >
                                <span className="text-sm">{style.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-[11px] font-medium truncate ${bgmType === style.id ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'}`}>
                                    {style.name}
                                  </div>
                                  <div className="flex items-center gap-1 text-[9px] text-foreground/70">
                                    <span>{style.moods.slice(0, 2).join('·')}</span>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              // 触发试听
                              const previewUrl = `/api/bgm/preview?type=${bgmType}`;
                              const audio = new Audio(previewUrl);
                              audio.play().catch(() => {});
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-[11px] text-red-600 hover:bg-red-50 transition-all w-full justify-center dark:text-red-300 dark:hover:bg-red-950/30"
                          >
                            <Volume2 className="w-3 h-3" />
                            试听当前风格 (3秒)
                          </button>
                        </div>
                      )}
                      {bgmMode === 'upload' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => bgmFileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg border border-border/50 text-xs text-muted-foreground hover:bg-secondary transition-all"
                          >
                            {bgmUrl ? '更换音频' : '选择音频文件'}
                          </button>
                          {bgmUrl && (
                            <span className="text-[10px] text-foreground/70 truncate flex-1">{bgmUrl.split('/').pop()}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 视频文字标注 */}
                    <div className="rounded-lg bg-secondary border-l-2 border-red-400 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Type className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-xs font-medium text-muted-foreground">视频文字标注</span>
                        </div>
                        <button
                          onClick={() => setVideoTextEnabled(!videoTextEnabled)}
                          className={`relative w-9 h-5 rounded-full transition-all ${videoTextEnabled ? 'bg-red-600' : 'bg-accent'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-card rounded-full shadow transition-all ${videoTextEnabled ? 'translate-x-4' : ''}`} />
                        </button>
                      </div>
                      {videoTextEnabled && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={videoTextContent}
                            onChange={(e) => setVideoTextContent(e.target.value)}
                            placeholder="输入将在视频中展示的标题/注释文字"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-border/50 text-xs text-muted-foreground placeholder:text-muted-foreground/50 outline-none focus:border-red-300 focus:ring-1 focus:ring-red-100"
                          />
                          {/* 对齐按钮组 */}
                          <div className="flex gap-1">
                            {[
                              { value: 'left', label: '左对齐', Icon: AlignLeft },
                              { value: 'center', label: '居中', Icon: AlignCenter },
                              { value: 'right', label: '右对齐', Icon: AlignRight },
                              { value: 'top', label: '顶部', Icon: ArrowUp },
                              { value: 'bottom', label: '底部', Icon: ArrowDown },
                            ].map((pos) => {
                              const Icon = pos.Icon;
                              return (
                                <button
                                key={pos.value}
                                onClick={() => setVideoTextPosition(pos.value)}
                                className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${
                                  videoTextPosition === pos.value
                                    ? 'bg-red-600 text-white shadow-sm'
                                    : 'bg-card border border-border/50 text-muted-foreground hover:border-red-300'
                                }`}
                              >
                                <Icon className="w-3 h-3" />
                                {pos.label}
                              </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleConfirmPrompt(true)}
                disabled={isGenerating}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all active:scale-95"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {isGenerating ? '启动中...' : '使用优化版生成'}
              </button>
              <button
                onClick={() => handleConfirmPrompt(false)}
                disabled={isGenerating}
                className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-medium hover:bg-accent transition-all"
              >
                使用原版
              </button>
              <button
                onClick={handleCancelPromptReview}
                disabled={isGenerating}
                className="px-4 py-2.5 rounded-xl border border-border/50 text-muted-foreground text-sm font-medium hover:bg-secondary transition-all"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创作控制台（视频结果模式下隐藏） */}
      <div className={showResultView ? 'hidden' : 'flex flex-col'}>
      <div className="bg-[var(--console-bg)] backdrop-blur-xl border border-border rounded-2xl shadow-xl shadow-black/10 overflow-hidden flex flex-col">
        {/* 输入区 + 功能选项 合并 */}
        <div className="px-4 pt-3 pb-1.5">
          {/* 输入框容器：带边框+白底的圆角框 */}
          <div className="flex flex-col gap-2 bg-card border border-border rounded-xl px-3 py-2 sm:flex-row sm:items-start">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={async (e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                const imageFiles: File[] = [];
                for (const item of Array.from(items)) {
                  if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) imageFiles.push(file);
                  }
                }
                if (imageFiles.length > 0) {
                  e.preventDefault();
                  for (const file of imageFiles) {
                    try {
                      const formData = new FormData();
                      formData.append('file', file);
                      const res = await fetch('/api/upload/material', { method: 'POST', body: formData });
                      const data = await res.json();
                      if (data.success) {
                        setAttachments((prev) => [...prev, { url: data.url, name: file.name || '粘贴图片', type: file.type }]);
                        setPasteToast(`已添加${imageFiles.length > 1 ? ` ${imageFiles.length} 张` : ''}参考图片`);
                        setTimeout(() => setPasteToast(null), 2500);
                      } else {
                        throw new Error(data.error || '上传失败');
                      }
                    } catch (err: unknown) {
                      console.error('粘贴图片上传失败:', err);
                      setPasteToast('图片上传失败');
                      setTimeout(() => setPasteToast(null), 2500);
                    }
                  }
                }
              }}
              placeholder={
                activeType === 'smart'
                  ? '告诉绘影精灵你想创作什么，例如：帮我做一个科幻风格的短视频...'
                  : activeType === 'image'
                  ? '描述你想生成的图片，也可直接粘贴图片…例如：一只在星空下奔跑的机械猫...'
                  : '描述你的视频创意，例如：基于《流浪地球》情节创建科幻故事视频...'
              }
              rows={3}
              className="w-full min-w-0 flex-1 resize-none bg-transparent text-foreground/90 text-sm placeholder:text-foreground/50 outline-none leading-normal min-h-[112px] overflow-y-auto"
            />
            {/* AI图像模式粘贴提示 */}
            {activeType === 'image' && (
              <div className="flex items-center gap-1 px-2 py-1 rounded border border-border/40 text-[10px] text-muted-foreground/60 mt-0.5 shrink-0 cursor-default" title="支持 Ctrl+V 粘贴图片">
                <ImagePlus className="w-3 h-3" />
                <span>可粘贴图片</span>
              </div>
            )}
            {/* 音频脚本按钮 - 仅视频类型可用 */}
            <button
              onClick={() => {
                if (activeType === 'video') {
                  setShowAudioInput(!showAudioInput);
                }
              }}
              disabled={activeType !== 'video'}
              title={activeType !== 'video' ? '音频脚本仅在视频生成时可用' : '添加音频旁白脚本'}
              className={`flex w-fit items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium transition-all whitespace-nowrap mt-0.5 shrink-0 ${
                activeType !== 'video'
                  ? 'border-border/50 text-foreground/30 cursor-not-allowed'
                  : showAudioInput || audioScript
                  ? 'border-[#4F6CFF]/40 text-[#70E0FF] bg-[#4F6CFF]/10'
                  : 'border-border/50 text-muted-foreground hover:border-[#4F6CFF]/40 hover:text-[#70E0FF]'
              }`}
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span>音频脚本</span>
              {audioScript && activeType === 'video' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#70E0FF] ml-0.5" />
              )}
            </button>
          </div>

          {/* 附件预览 */}
          {attachments.length > 0 && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary border border-border/50 text-xs text-muted-foreground">
                  {att.type.startsWith('image/') ? (
                    <img src={att.url} alt="" className="w-8 h-8 rounded object-cover border border-border/30" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span className="max-w-[120px] truncate">{att.name}</span>
                  <button
                    onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-0.5 hover:bg-accent rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 粘贴图片提示 */}
          {pasteToast && (
            <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700 animate-in fade-in slide-in-from-bottom-1 duration-200">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              {pasteToast}
            </div>
          )}

          {/* 脚本预览条 - 未展开时显示 */}
          {audioScript && !showAudioInput && activeType === 'video' && (
            <div className="flex items-center gap-2 mt-1.5 px-2 py-1.5 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900">
              <FileAudio className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-xs text-red-700 flex-1 truncate">
                音频脚本：{audioScript.length > 40 ? audioScript.slice(0, 40) + '...' : audioScript}
              </span>
              <button
                onClick={() => setShowAudioInput(true)}
                className="text-xs text-red-600 hover:text-red-800 font-medium shrink-0"
              >
                编辑
              </button>
              <button
                onClick={() => { setAudioScript(''); setShowAudioInput(false); }}
                className="p-0.5 hover:bg-red-100 rounded shrink-0"
              >
                <X className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          )}

          {/* URL 输入框 */}
          {showUrlInput && (
            <div className="flex items-center gap-2 mt-1.5">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUrlExtract();
                  }
                }}
                placeholder="粘贴链接地址..."
                className="flex-1 px-3 py-2 bg-secondary rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-200 border border-border/50"
              />
              <button
                onClick={handleUrlExtract}
                disabled={!urlInput.trim()}
                className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                提取
              </button>
              <button
                onClick={() => { setShowUrlInput(false); setUrlInput(''); }}
                className="p-2 text-foreground/70 hover:text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 音频脚本输入框 */}
          {showAudioInput && activeType === 'video' && (
            <div className="mt-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">音频旁白脚本</span>
                <span className="text-[10px] text-foreground/70">{audioScript.length} 字</span>
              </div>
              <textarea
                value={audioScript}
                onChange={(e) => setAudioScript(e.target.value)}
                placeholder="输入音频旁白脚本，将作为视频的字幕和语音旁白内容..."
                rows={3}
                className="w-full px-3 py-2 bg-secondary rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-200 border border-border/50 resize-none placeholder:text-foreground/70 min-h-[72px] overflow-y-auto"
              />
            </div>
          )}

          {/* 功能选项 - 间距加大 */}
          <div className="flex flex-wrap items-center gap-2 mt-2 sm:gap-3">
            <button
              onClick={() => setAutoStyle(!autoStyle)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                autoStyle ? 'bg-[#4F6CFF]/10 text-[#70E0FF] border border-[#4F6CFF]/30' : 'text-muted-foreground hover:bg-secondary'
              }`}
            >
              <Diamond className="w-3.5 h-3.5 text-[#70E0FF]" />
              <span>自动风格{autoStyle ? '·开启' : ''}</span>
            </button>
            {activeType === 'video' && (
              <button
                onClick={() => setAutoPostProcess(!autoPostProcess)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  autoPostProcess ? 'bg-[#4F6CFF]/10 text-[#70E0FF] border border-[#4F6CFF]/30' : 'text-muted-foreground hover:bg-secondary'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#70E0FF]" />
                <span>自动后期{autoPostProcess ? '·开启' : ''}</span>
              </button>
            )}
            <button
              onClick={() => setShowUrlInput(!showUrlInput)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showUrlInput ? 'bg-[#4F6CFF]/10 text-[#70E0FF] border border-[#4F6CFF]/30' : 'text-muted-foreground hover:bg-secondary'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>添加链接</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>上传文件</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx,.md,.csv"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <input
              ref={bgmFileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => handleBgmUpload(e.target.files)}
            />
          </div>
        </div>

        {/* 分割线 */}
        <div className="border-t border-border/50" />

        {/* 底部操作栏 */}
        <div className="px-3 py-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          {/* 类型切换 - 深紫底大按钮 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <ConsoleTypeButton
              active={activeType === 'video'}
              onClick={() => setActiveType('video')}
              onDoubleClick={() => { setActiveType('video'); onNavigate?.('video'); }}
              icon={Video}
              label={t('panel.proVideo')}
            />
            <ConsoleTypeButton
              active={activeType === 'image'}
              onClick={() => setActiveType('image')}
              onDoubleClick={() => { setActiveType('image'); onNavigate?.('image'); }}
              icon={ImageIcon}
              label={t('panel.imageCreation')}
            />
            <ConsoleTypeButton
              active={activeType === 'smart'}
              onClick={() => setActiveType('smart')}
              onDoubleClick={() => { setActiveType('smart'); onNavigate?.('smart'); }}
              icon={Sparkles}
              label={t('panel.smartAssistant')}
            />
            <ConsoleTypeButton
              active={activeType === 'film'}
              onClick={() => setActiveType('film')}
              onDoubleClick={() => { setActiveType('film'); onNavigate?.('film'); }}
              icon={Film}
              label={t('panel.filmCreation')}
            />
          </div>

          {/* 右侧参数 + 生成 */}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {/* 时长 */}
            <button
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary transition-all"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{duration}秒</span>
            </button>

            {/* 画面比例 */}
            <div className="relative">
              <button
                onClick={() => setShowRatioDropdown(!showRatioDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary transition-all"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>{aspectRatio}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showRatioDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showRatioDropdown && (
                <div className="absolute bottom-full left-0 mb-1 rounded-lg bg-card border border-border/70 shadow-lg z-50 py-1 min-w-[100px]">
                  {['9:16', '16:9', '1:1', '4:3', '3:4'].map(r => (
                    <button
                      key={r}
                      onClick={() => { setAspectRatio(r); setShowRatioDropdown(false); }}
                      className={`w-full px-3 py-1.5 text-xs text-left hover:bg-secondary transition-colors ${aspectRatio === r ? 'text-[#70E0FF] font-medium bg-[#4F6CFF]/10' : 'text-muted-foreground'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 模型选择 - 下拉选择 */}
            <div className="relative">
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="flex min-w-[132px] items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-muted-foreground hover:bg-muted border border-border/50 w-full text-left transition-colors"
              >
                {(() => {
                  const modelList = activeType === 'image' ? IMAGE_MODELS : VIDEO_MODELS;
                  const current = modelList.find(m => m.code === selectedModel);
                  if (!current) return <span>选择模型</span>;
                  const Icon = current.icon;
                  return (
                    <>
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${current.color}`} />
                      <span className="flex-1 truncate">{current.name}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                    </>
                  );
                })()}
              </button>
              {showModelDropdown && (
                <div className="absolute bottom-full left-0 right-0 mb-1 min-w-[220px] rounded-lg bg-card border border-border/70 shadow-lg z-50 overflow-y-auto max-h-64">
                  {(activeType === 'image' ? IMAGE_MODELS : VIDEO_MODELS).map((model) => {
                    const ModelIcon = model.icon;
                    const isActive = selectedModel === model.code;
                    return (
                      <button
                        key={model.code}
                        onClick={() => {
                          setSelectedModel(model.code);
                          saveConfig('gc_selectedModel', model.code);
                          setShowModelDropdown(false);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium w-full text-left transition-colors ${
                          isActive
                            ? 'bg-gradient-to-r from-[#4F6CFF]/15 to-[#8B5CF6]/15 text-foreground'
                            : 'hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        <ModelIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-[#70E0FF]' : model.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{model.name}</div>
                          <div className="text-[10px] truncate text-muted-foreground/60">{model.desc}</div>
                        </div>
                        {isActive && <Check className="w-3.5 h-3.5 text-[#70E0FF] flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 生成按钮 - 跳转全屏面板并自动开始创作 */}
            <button
              onClick={() => {
                const sectionMap: Record<ConsoleType, string> = {
                  video: 'film',
                  image: 'image',
                  smart: 'smart',
                  film: 'film',
                };
                const targetServiceMap: Record<ConsoleType, string | undefined> = {
                  video: 'video_generation',
                  image: undefined,
                  smart: undefined,
                  film: 'storyboard_script',
                };
                const promptText = prompt.trim();
                const imageAttachmentUrls = attachments.filter(a => a.type.startsWith('image/')).map(a => a.url);
                // AI图像模式：即使无提示词也允许跳转并自动生成
                const effectivePrompt = promptText || (activeType === 'image' ? (imageAttachmentUrls.length > 0 ? '基于参考图片风格创作一幅新的数字艺术作品' : '一幅唯美的数字艺术作品，色彩丰富，构图精美') : '');
                if (!effectivePrompt) return;
                onNavigate?.(sectionMap[activeType], undefined, { prompt: effectivePrompt, autoGenerate: true, targetService: targetServiceMap[activeType], ...(activeType === 'image' && imageAttachmentUrls.length > 0 ? { imageRefs: imageAttachmentUrls } : {}) });
                setPrompt('');
                setAttachments([]);
              }}
              disabled={activeType !== 'image' && !prompt.trim()}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#4F6CFF] to-[#8B5CF6] text-white text-sm font-semibold hover:from-[#6680FF] hover:to-[#9B6CFF] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#4F6CFF]/25 transition-all active:scale-95"
            >
              <Wand2 className="w-4 h-4" />
              <span>{t('common.generate')}</span>
            </button>
          </div>
        </div>

        {/* 更多选项展开 */}
        {showMoreOptions && (
          <div
            className="px-5 pb-4 border-t border-border/50 pt-3"
            onMouseEnter={() => { if (!showMoreOptions) setShowMoreOptions(true); }}
          >
            {/* 顶部引导文案 */}
            <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100">
              <p className="text-[11px] text-red-700">以下配置将应用到生成的视频中，可自由组合字幕、配音、BGM 等附加内容</p>
            </div>
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {/* 时长 */}
              <div className="rounded-lg bg-secondary border-l-2 border-border p-3">
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">时长</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={6}
                      max={30}
                      step={1}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="flex-1 h-1.5 bg-accent rounded-full appearance-none accent-red-500"
                    />
                    <span className="text-sm font-medium text-muted-foreground w-10 text-right">{duration}秒</span>
                  </div>
              </div>

              {/* 字幕配置 */}
              <div className="rounded-lg bg-secondary border-l-2 border-red-400 p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-red-500" />
                    字幕
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSubtitleEnabled(!subtitleEnabled)}
                      className={`relative w-9 h-5 rounded-full transition-all ${subtitleEnabled ? 'bg-red-600' : 'bg-accent'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-card rounded-full shadow transition-all ${subtitleEnabled ? 'translate-x-4' : ''}`} />
                    </button>
                    {subtitleEnabled && (
                      <button
                        onClick={() => setSubtitleEnabled(false)}
                        className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-accent text-foreground/70 hover:text-muted-foreground transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                {subtitleEnabled && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-foreground/70 mb-1 block">位置</label>
                      <div className="flex gap-1">
                        {[{value:'bottom',label:'底部'},{value:'top',label:'顶部'},{value:'center',label:'中间'}].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSubtitlePosition(opt.value as 'bottom' | 'top' | 'center')}
                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-all ${subtitlePosition === opt.value ? 'bg-red-500/10 text-red-500 font-medium border border-red-500/30' : 'bg-secondary border border-border/50 text-muted-foreground hover:bg-accent/50'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-foreground/70 mb-1 block">大小</label>
                      <div className="flex gap-1">
                        {[{value:'small',label:'小'},{value:'medium',label:'中'},{value:'large',label:'大'}].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSubtitleFontSize(opt.value as 'small' | 'medium' | 'large')}
                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-all ${subtitleFontSize === opt.value ? 'bg-red-500/10 text-red-500 font-medium border border-red-500/30' : 'bg-secondary border border-border/50 text-muted-foreground hover:bg-accent/50'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-foreground/70 mb-1 block">颜色</label>
                      <div className="flex items-center gap-1.5">
                        {['#FFFFFF', '#FFFF00', '#00FF00', '#FF0000', '#00BFFF'].map((c) => (
                          <button
                            key={c}
                            onClick={() => setSubtitleColor(c)}
                            className={`w-5 h-5 rounded-full border-2 transition-all ${subtitleColor === c ? 'border-red-500 scale-110' : 'border-border/50'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-foreground/70 mb-1 block">配音</label>
                      <button
                        onClick={() => setGenerateVoice(!generateVoice)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${generateVoice ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900' : 'bg-secondary text-muted-foreground border border-border/50'}`}
                      >
                        {generateVoice ? '已开启' : '关闭'}
                      </button>
                    </div>
                  </div>

                  {/* 字幕文本 */}
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-foreground/70">字幕文本</label>
                      {audioScript && (
                        <button
                          onClick={() => setSubtitleText(audioScript)}
                          className="flex items-center gap-1 text-[10px] text-red-600 hover:text-red-700 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          同步音频脚本
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <textarea
                        value={subtitleText}
                        onChange={(e) => setSubtitleText(e.target.value)}
                        placeholder={audioScript ? "已同步音频脚本，可独立编辑" : "输入字幕文本（留空使用音频脚本）"}
                        className="w-full px-2.5 py-2 rounded-lg text-xs bg-card border border-border/50 outline-none focus:ring-1 focus:ring-red-200 focus:border-red-300 resize-none min-h-[100px] overflow-y-auto"
                        rows={3}
                      />
                      <div className="absolute bottom-1 right-1.5 text-[9px] text-foreground/70">
                        {subtitleText.length} 字
                      </div>
                    </div>
                    {audioScript && (
                      <div className="flex items-center gap-1 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        <span className="text-[10px] text-red-500">
                          与音频脚本互通：{subtitleText === audioScript ? '已同步' : '已独立编辑'}
                        </span>
                      </div>
                    )}
                  </div>
                  </>
                )}
              </div>

              {/* BGM配置 */}
              <div className="rounded-lg bg-secondary border-l-2 border-red-400 p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-red-500" />
                    背景音乐
                  </label>
                  {bgmMode !== 'none' && (
                    <button
                      onClick={() => setBgmMode('none')}
                      className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-accent text-foreground/70 hover:text-muted-foreground transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {[
                    { key: 'none', label: '无' },
                    { key: 'type', label: '预设' },
                    { key: 'upload', label: '上传' },
                  ].map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setBgmMode(m.key as 'none' | 'type' | 'upload')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        bgmMode === m.key
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                          : 'bg-card text-muted-foreground hover:bg-muted border border-border/50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {bgmMode === 'type' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      {getBgmTypeList().map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setBgmType(style.id)}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left transition-all ${
                            bgmType === style.id
                              ? 'border-red-300 bg-red-50'
                              : 'border-border/50 bg-card hover:border-red-200'
                          }`}
                        >
                          <span className="text-sm">{style.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-[11px] font-medium truncate ${bgmType === style.id ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'}`}>
                              {style.name}
                            </div>
                            <div className="flex items-center gap-1 text-[9px] text-foreground/70">
                              <span>{style.moods.slice(0, 2).join('·')}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const previewUrl = `/api/bgm/preview?type=${bgmType}`;
                        const audio = new Audio(previewUrl);
                        audio.play().catch(() => {});
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-[11px] text-red-600 hover:bg-red-50 transition-all w-full justify-center dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      <Volume2 className="w-3 h-3" />
                      试听当前风格 (3秒)
                    </button>
                  </div>
                )}
                {bgmMode === 'upload' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={bgmUrl}
                      onChange={(e) => setBgmUrl(e.target.value)}
                      placeholder="输入音频链接..."
                      className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border/50 outline-none"
                    />
                    <button
                      onClick={() => bgmFileInputRef.current?.click()}
                      className="px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border/50 hover:bg-muted"
                    >
                      选择
                    </button>
                  </div>
                )}
              </div>

              {/* 视频文字/标注 */}
              <div className="rounded-lg bg-secondary border-l-2 border-red-400 p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-red-500" />
                    视频文字 / 标注
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setVideoTextEnabled(!videoTextEnabled)}
                      className={`relative w-9 h-5 rounded-full transition-all ${videoTextEnabled ? 'bg-red-600' : 'bg-accent'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-card rounded-full shadow transition-all ${videoTextEnabled ? 'translate-x-4' : ''}`} />
                    </button>
                    {videoTextEnabled && (
                      <button
                        onClick={() => setVideoTextEnabled(false)}
                        className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-accent text-foreground/70 hover:text-muted-foreground transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                {videoTextEnabled && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={videoTextContent}
                      onChange={(e) => setVideoTextContent(e.target.value)}
                      placeholder="输入视频文字内容..."
                      className="w-full px-2 py-1.5 rounded-lg text-xs bg-card border border-border/50 outline-none focus:border-red-300"
                    />
                    {/* 对齐按钮组 */}
                    <div className="flex gap-1">
                      {[
                        { value: 'left', label: '左对齐', Icon: AlignLeft },
                        { value: 'center', label: '居中', Icon: AlignCenter },
                        { value: 'right', label: '右对齐', Icon: AlignRight },
                        { value: 'top', label: '顶部', Icon: ArrowUp },
                        { value: 'bottom', label: '底部', Icon: ArrowDown },
                      ].map((pos) => {
                        const Icon = pos.Icon;
                        return (
                          <button
                            key={pos.value}
                            onClick={() => setVideoTextPosition(pos.value)}
                            className={`flex-1 flex items-center justify-center gap-0.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                              videoTextPosition === pos.value
                                ? 'bg-red-600 text-white shadow-sm'
                                : 'bg-card border border-border/50 text-muted-foreground hover:border-red-300'
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            {pos.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 特效 */}
              <div className="rounded-lg bg-secondary border-l-2 border-red-400 p-3">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-red-500" />
                  特效
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { key: 'none', label: '无' },
                    { key: 'fade', label: '淡入' },
                    { key: 'slide', label: '滑动' },
                    { key: 'scale', label: '缩放' },
                  ].map((a) => (
                    <button
                      key={a.key}
                      onClick={() => setAnimation(a.key as 'none' | 'fade' | 'slide' | 'scale')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        animation === a.key
                          ? 'bg-red-100 text-red-700'
                          : 'bg-card text-muted-foreground hover:bg-muted border border-border/50'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* 提示词查看/修改弹窗 */}
      <PromptPreview
        open={promptPreviewOpen}
        data={promptPreviewData}
        onClose={() => setPromptPreviewOpen(false)}
        onApply={(modified, negativeModified) => {
          setPrompt(modified);
          if (negativeModified) {
            // Store negative prompt for next generation
            try { localStorage.setItem('dreambox_negative_prompt', negativeModified); } catch {}
          }
          setPromptPreviewOpen(false);
        }}
        onReEnhance={(p) => {
          setPrompt(p);
          setPromptPreviewOpen(false);
          // Trigger auto-enhance
          setAutoStyle(true);
        }}
      />
    </div>
  );
}

// ============================================================
// Suggestions 组件（独立导出）
// ============================================================
export function SuggestionsBar({ onSelect }: { onSelect: (text: string, type?: ConsoleType) => void }) {
  const suggestions = [
    {
      icon: Diamond,
      label: '生成黏土风格 AI 动画故事视频',
      type: 'video' as ConsoleType,
    },
    {
      icon: LinkIcon,
      label: '从链接生成新闻视频',
      type: 'video' as ConsoleType,
    },
    {
      icon: Copy,
      label: '通过我的脚本创建悬疑小说视频',
      type: 'smart' as ConsoleType,
    },
    {
      icon: Sparkles,
      label: '更多提示',
    },
  ];

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-foreground/70 mb-3 px-1">推荐创作</h3>
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {suggestions.map((s, i) => (
          <SuggestionChip
            key={i}
            icon={s.icon}
            label={s.label}
            onClick={() => onSelect(s.label, s.type)}
          />
        ))}
      </div>
    </div>
  );
}
