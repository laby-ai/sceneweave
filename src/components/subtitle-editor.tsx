'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubtitleEditorHeader, SubtitleEditorTabsList } from '@/components/subtitle/subtitle-editor-chrome';
import { SubtitleSegmentList } from '@/components/subtitle/subtitle-segment-list';
import { SubtitleSegmentsToolbar } from '@/components/subtitle/subtitle-segments-toolbar';
import { SubtitleStyleModeCard } from '@/components/subtitle/subtitle-style-mode-card';
import { SubtitleVideoTextEditor } from '@/components/subtitle/subtitle-video-text-editor';
import {
  Plus,
  Trash2,
  Edit,
  Play,
  Pause,
  Settings,
  Type,
  Palette,
  Clock,
  Eye,
  Wand2,
  RefreshCw,
  Layers,
  Crosshair,
  Sparkles,
  Zap,
  Upload,
  Mic,
  Download,
  CheckCircle,
  Film,
  FileText,
  FileInput,
  Link2,
} from 'lucide-react';
import {
  SubtitleSegment,
  SubtitleStyle,
  SubtitleConfig,
  VideoTextSegment,
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_COLOR_OPTIONS,
  SUBTITLE_BG_COLOR_OPTIONS,
  FONT_SIZE_MAP,
  FONT_FAMILY_OPTIONS,
  VIDEO_TEXT_FONT_SIZE_MAP,
  createDefaultSubtitleSegment,
  createDefaultVideoTextSegment,
  formatTime,
  parseTime,
  generateId,
  autoSplitSubtitle,
  autoSplitSubtitleWithStats,
  type SplitOptions,
  type SplitResult,
  getSubtitleStyleCSS,
  // 智能定位相关
  analyzeSmartPosition,
  SmartPositionResult,
  SceneType,
  // 多人访谈
  SpeakerInfo,
} from '@/constants/subtitles';
import {
  parseSRT,
  exportToSRT,
  parseSubtitlePrompt,
  proofreadSubtitle,
  type ParsedSubtitlePrompt,
} from '@/lib/subtitle-utils';

interface SubtitleEditorProps {
  config: SubtitleConfig;
  onChange: (config: SubtitleConfig) => void;
  videoDuration: number;
  disabled?: boolean;
  onAutoGenerate?: () => Promise<string>;
  isGenerating?: boolean;
  // 智能定位相关
  videoPrompt?: string; // 视频提示词，用于智能定位分析
  referenceImageUrl?: string; // 参考图片URL，用于视觉分析
}

export function SubtitleEditor({
  config,
  onChange,
  videoDuration,
  disabled = false,
  onAutoGenerate,
  isGenerating = false,
  videoPrompt = '',
  referenceImageUrl,
}: SubtitleEditorProps) {
  const [activeTab, setActiveTab] = useState('segments');
  const [previewTime, setPreviewTime] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  // 智能定位相关状态
  const [isAnalyzingPosition, setIsAnalyzingPosition] = useState(false);
  const [smartPositionResult, setSmartPositionResult] = useState<SmartPositionResult | null>(null);

  // 导入导出 & 提示词解析相关状态
  const [importStatus, setImportStatus] = useState<string>('');
  const [promptInput, setPromptInput] = useState('');
  const [promptParseResult, setPromptParseResult] = useState<ParsedSubtitlePrompt | null>(null);
  const [proofreadOptions, setProofreadOptions] = useState({
    removeFillers: true,
    normalizePunctuation: true,
  });
  // 文本导入 & ASR 相关状态
  const [textInput, setTextInput] = useState('');
  const [isImportingText, setIsImportingText] = useState(false);
  // 多人访谈相关状态
  const [showSpeakerManager, setShowSpeakerManager] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false); // 智能导入面板折叠状态
  // 智能分段配置 & 预览状态
  const [splitOptions, setSplitOptions] = useState<SplitOptions>({
    maxCharsPerSegment: 22,
    speechRate: 4.5,
    minDuration: 1.0,
    gap: 0.3,
  });
  const [splitPreview, setSplitPreview] = useState<SplitResult | null>(null);
  const [showSplitConfig, setShowSplitConfig] = useState(false);
  // 样式模式相关状态
  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false);
  const [showManualVideoTextInput, setShowManualVideoTextInput] = useState(false);
  const [manualVideoTextValue, setManualVideoTextValue] = useState('');

  // 监听语音列表变化
  useEffect(() => {
    // 初始化时获取语音列表
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    // 立即加载
    loadVoices();

    // 监听 voiceschanged 事件
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  // 更新配置
  const updateConfig = useCallback((updates: Partial<SubtitleConfig>) => {
    onChange({
      ...config,
      ...updates,
    });
  }, [config, onChange]);

  // 更新样式
  const updateStyle = useCallback((styleUpdates: Partial<SubtitleStyle>) => {
    updateConfig({
      style: {
        ...config.style,
        ...styleUpdates,
      },
    });
  }, [config.style, updateConfig]);

  // ========== 智能定位相关函数 ==========
  
  // 执行智能定位分析
  const handleAnalyzeSmartPosition = useCallback(async () => {
    if (!videoPrompt.trim()) {
      alert('请先输入视频描述内容，智能定位需要根据视频内容进行分析');
      return;
    }
    
    setIsAnalyzingPosition(true);
    
    try {
      // 模拟异步分析（实际是同步的语义分析）
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const result = analyzeSmartPosition(videoPrompt);
      setSmartPositionResult(result);
      
      // 自动保存到配置中
      updateConfig({
        smartPositionResult: result,
      });
      
      console.log('[SmartPosition] 分析完成:', result);
    } catch (error) {
      console.error('[SmartPosition] 分析失败:', error);
      alert('智能定位分析失败，请重试');
    } finally {
      setIsAnalyzingPosition(false);
    }
  }, [videoPrompt, updateConfig]);
  
  // 应用智能定位推荐到字幕样式
  const applySmartPositionToSubtitle = useCallback(() => {
    if (!smartPositionResult) return;
    
    updateStyle({
      position: smartPositionResult.recommendedPosition,
      customPositionY: smartPositionResult.suggestedY,
    });
    
    console.log('[SmartPosition] 已应用字幕位置推荐:', smartPositionResult.recommendedPosition);
  }, [smartPositionResult, updateStyle]);
  
  // 应用智能定位推荐到视频文字
  const applySmartPositionToVideoText = useCallback(() => {
    if (!smartPositionResult || config.videoTextSegments.length === 0) return;
    
    // 更新所有视频文字段的位置
    const updatedSegments = config.videoTextSegments.map(seg => ({
      ...seg,
      position: smartPositionResult.recommendedPosition as VideoTextSegment['position'],
      customPositionX: smartPositionResult.suggestedX ?? 50,
      customPositionY: smartPositionResult.suggestedY ?? 50,
    }));
    
    updateConfig({
      videoTextSegments: updatedSegments,
    });
    
    console.log('[SmartPosition] 已应用视频文字位置推荐:', smartPositionResult.recommendedPosition);
  }, [smartPositionResult, config.videoTextSegments, updateConfig]);

  // ========== 导入导出 & 提示词解析 & 校对函数 ==========

  // 导入字幕文件 (SRT/ASS)
  const handleImportSubtitle = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus('正在导入...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/subtitle/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`导入失败: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.segments && result.segments.length > 0) {
        // 将解析的字幕段应用到配置
        updateConfig({
          segments: result.segments,
          importFormat: result.detectedFormat || 'srt',
        });
        setImportStatus(`成功导入 ${result.segments.length} 条字幕 (${result.detectedFormat || 'srt'})`);
      } else {
        setImportStatus('文件中未找到有效字幕内容');
      }
    } catch (error) {
      console.error('[SubtitleImport] 导入失败:', error);
      setImportStatus(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    // 重置 input 以允许重复选择同一文件
    event.target.value = '';
  }, [updateConfig]);

  // 导出字幕文件
  const handleExportSubtitle = useCallback(async (format: 'srt' | 'ass') => {
    try {
      const params = new URLSearchParams({
        format,
        segments: JSON.stringify(config.segments),
        style: JSON.stringify(config.style),
      });

      const response = await fetch(`/api/subtitle/export?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`导出失败: ${response.statusText}`);
      }

      // 触发下载
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `subtitles.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log(`[SubtitleExport] 成功导出 ${format.toUpperCase()} 文件`);
    } catch (error) {
      console.error('[SubtitleExport] 导出失败:', error);
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, [config.segments, config.style]);

  // 解析 QClaw 提示词
  const handleParsePrompt = useCallback(async () => {
    if (!promptInput.trim()) return;

    try {
      // 前端直接调用 parseSubtitlePrompt（纯函数，无需API）
      const parsed = parseSubtitlePrompt(promptInput);
      setPromptParseResult(parsed);

      // 自动应用解析结果到配置（只提取兼容字段）
      if (parsed.style) {
        // 将 SubtitleStyleAdvanced 转换为 SubtitleStyle 兼容格式
        const compatibleStyleUpdates: Partial<SubtitleStyle> = {};
        if (parsed.style.fontFamily) compatibleStyleUpdates.fontFamily = parsed.style.fontFamily;
        if (parsed.style.fontSize !== undefined) {
          // SubtitleStyleAdvanced.fontSize 是 number，需要转换为 SubtitleStyle 格式
          compatibleStyleUpdates.fontSize = 'custom';
          compatibleStyleUpdates.fontSizeCustom = parsed.style.fontSize;
        }
        if (parsed.style.color) compatibleStyleUpdates.color = parsed.style.color;
        if (parsed.style.backgroundColor) compatibleStyleUpdates.backgroundColor = parsed.style.backgroundColor;
        if (parsed.style.position && ['bottom', 'top', 'middle', 'upper-third', 'lower-third', 'custom'].includes(parsed.style.position)) {
          compatibleStyleUpdates.position = parsed.style.position as SubtitleStyle['position'];
        }
        if (parsed.style.bottomMargin !== undefined) compatibleStyleUpdates.bottomMargin = parsed.style.bottomMargin;
        // 描边相关：SubtitleStyle 使用 hasBorder+borderWidth+borderColor
        if (parsed.style.strokeWidth !== undefined && parsed.style.strokeWidth > 0) {
          compatibleStyleUpdates.hasBorder = true;
          compatibleStyleUpdates.borderWidth = parsed.style.strokeWidth;
        }
        if (parsed.style.strokeColor) compatibleStyleUpdates.borderColor = parsed.style.strokeColor;
        updateStyle(compatibleStyleUpdates);
      }
      if (parsed.language) {
        updateConfig({ voiceLanguage: parsed.language });
      }
      if (parsed.constraints?.maxCharsPerLine) {
        updateConfig({ maxCharsPerLine: parsed.constraints.maxCharsPerLine });
      }
      if (parsed.postProcess?.proofread !== undefined) {
        setProofreadOptions(prev => ({
          ...prev,
          removeFillers: parsed.postProcess!.proofread ?? prev.removeFillers,
          normalizePunctuation: parsed.postProcess!.normalizePunctuation ?? prev.normalizePunctuation,
        }));
      }

      console.log('[PromptParse] 解析完成:', parsed);
    } catch (error) {
      console.error('[PromptParse] 解析失败:', error);
      alert('提示词解析失败，请检查格式');
    }
  }, [promptInput, updateStyle, updateConfig]);

  // 应用校对优化
  const handleApplyProofreading = useCallback(() => {
    if (config.segments.length === 0) return;

    try {
      const proofreadSegments = config.segments.map(seg => ({
        ...seg,
        text: proofreadSubtitle(seg.text, proofreadOptions),
      }));

      updateConfig({
        segments: proofreadSegments,
        enableProofread: true,
      });

      console.log('[Proofreading] 校对已应用到所有字幕段');
    } catch (error) {
      console.error('[Proofreading] 校对失败:', error);
      alert('校对处理失败');
    }
  }, [config.segments, proofreadOptions, updateConfig]);

  // ========== 文本导入 & ASR 函数 ==========

  // 纯文本智能导入（断句 + 时间轴分配）
  const handleTextImport = useCallback(async () => {
    if (!textInput.trim()) return;

    setIsImportingText(true);
    setImportStatus('正在智能断句...');

    try {
      const formData = new FormData();
      formData.append('textContent', textInput);
      formData.append('videoDuration', String(videoDuration));
      formData.append('language', config.voiceLanguage || 'zh-CN');
      formData.append('maxCharsPerLine', String(config.maxCharsPerLine || 18));

      const response = await fetch('/api/subtitle/asr', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.segments) {
        updateConfig({
          segments: result.segments,
        });
        setImportStatus(`成功生成 ${result.segments.length} 条字幕`);
        setTextInput(''); // 清空输入
      } else {
        setImportStatus(result.error || '文本导入失败');
      }
    } catch (error) {
      console.error('[TextImport] 导入失败:', error);
      setImportStatus(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsImportingText(false);
    }
  }, [textInput, videoDuration, config.voiceLanguage, config.maxCharsPerLine, updateConfig]);

  // ASR 音频文件上传
  const handleAudioASR = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus('ASR 服务尚未接入，请使用文本导入模式');
    
    // 提示用户
    alert('语音识别功能即将推出！\n\n可暂时使用"纯文本导入"：\n1. 将音频转写的文案粘贴到输入框\n2. 点击"智能导入并生成字幕"\n\n系统将自动断句并分配时间轴。');

    // 重置 input
    event.target.value = '';
  }, []);

  // ========== 多人访谈/说话人管理函数 ==========

  // 预设颜色列表
  const SPEAKER_COLORS = [
    '#EF4444', '#F97316', '#EAB308', '#22C55E',
    '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
    '#F43F5E', '#EF4444', '#6366F1', '#A855F7',
  ];

  // 添加说话人
  const handleAddSpeaker = useCallback(() => {
    const currentSpeakers = config.speakers || [];
    const newSpeaker: SpeakerInfo = {
      id: `speaker-${Date.now()}`,
      name: `说话人${currentSpeakers.length + 1}`,
      color: SPEAKER_COLORS[currentSpeakers.length % SPEAKER_COLORS.length],
      position: 'center' as const,
    };

    updateConfig({
      speakers: [...currentSpeakers, newSpeaker],
    });

    console.log('[SpeakerManager] 添加说话人:', newSpeaker);
  }, [config.speakers, updateConfig]);

  // 更新说话人信息
  const handleUpdateSpeaker = useCallback((speakerId: string, field: keyof SpeakerInfo, value: string) => {
    const currentSpeakers = config.speakers || [];
    const updatedSpeakers = currentSpeakers.map((s) =>
      s.id === speakerId ? { ...s, [field]: value } : s
    );

    updateConfig({
      speakers: updatedSpeakers,
    });
  }, [config.speakers, updateConfig]);

  // 删除说话人
  const handleDeleteSpeaker = useCallback((speakerId: string) => {
    const currentSpeakers = config.speakers || [];
    const updatedSpeakers = currentSpeakers.filter((s) => s.id !== speakerId);

    // 同时清除引用该说话人的字幕段的 speakerId
    const updatedSegments = config.segments.map((seg) =>
      seg.speakerId === speakerId ? { ...seg, speakerId: undefined } : seg
    );

    updateConfig({
      speakers: updatedSpeakers,
      segments: updatedSegments,
    });
  }, [config.speakers, config.segments, updateConfig]);

  // 初始化默认说话人（主持人 + 嘉宾）
  const handleInitDefaultSpeakers = useCallback(() => {
    const defaultSpeakers: SpeakerInfo[] = [
      { id: 'speaker-host', name: '主持人', label: '主持', color: '#3B82F6', position: 'center' },
      { id: 'speaker-guest-a', name: '嘉宾A', label: 'A', color: '#8B5CF6', position: 'left' },
      { id: 'speaker-guest-b', name: '嘉宾B', label: 'B', color: '#F97316', position: 'right' },
    ];

    updateConfig({
      speakers: defaultSpeakers,
    });

    setShowSpeakerManager(false);
    console.log('[SpeakerManager] 初始化默认说话人:', defaultSpeakers);
  }, [updateConfig]);

  // ========== 样式自动/手动双模式 ==========

  // 当前样式模式
  const currentStyleMode = config.styleMode || 'manual';

  // 自动分析并推荐样式
  const handleAutoAnalyzeStyle = useCallback(async () => {
    if (!videoPrompt.trim()) {
      alert('请先输入视频描述内容，智能样式推荐需要分析视频场景');
      return;
    }

    setIsAnalyzingStyle(true);

    try {
      // 模拟异步分析
      await new Promise(resolve => setTimeout(resolve, 600));

      // 基于视频提示词智能推荐样式
      const recommendation = analyzeVideoForStyle(videoPrompt);

      // 保存推荐结果
      updateConfig({
        autoStyleRecommendation: recommendation,
      });

      // 如果是纯 auto 模式，直接应用推荐值
      if (config.styleMode === 'auto') {
        updateStyle(recommendation);
      }

      console.log('[AutoStyle] 推荐完成:', recommendation);
    } catch (error) {
      console.error('[AutoStyle] 分析失败:', error);
      alert('样式推荐分析失败');
    } finally {
      setIsAnalyzingStyle(false);
    }
  }, [videoPrompt, config.styleMode, updateConfig, updateStyle]);

  // 切换样式模式
  const handleStyleModeChange = useCallback((mode: 'auto' | 'manual' | 'hybrid') => {
    updateConfig({ styleMode: mode });

    // 切换到 auto 或 hybrid 时，自动触发一次分析
    if ((mode === 'auto' || mode === 'hybrid') && videoPrompt.trim()) {
      // 延迟执行，让 UI 先更新
      setTimeout(() => handleAutoAnalyzeStyle(), 100);
    }
  }, [updateConfig, videoPrompt, handleAutoAnalyzeStyle]);

  // 应用推荐的某一项样式（hybrid 模式下单项应用）
  const applyRecommendedStyleField = useCallback((field: keyof SubtitleStyle, value: any) => {
    updateStyle({ [field]: value });
    console.log(`[AutoStyle] 应用手动微调: ${field} =`, value);
  }, [updateStyle]);

  /**
   * 基于视频内容分析推荐字幕样式
   * 根据场景类型、描述关键词等智能匹配最佳样式方案
   */
  function analyzeVideoForStyle(promptText: string): SubtitleStyle {
    const text = promptText.toLowerCase();

    // 场景检测关键词
    const scenePatterns = {
      dark: /暗|黑|夜景|夜晚|night|dark|星空|宇宙|太空/i,
      bright: /明亮|白天|阳光|户外|阳光|日间|bright|daylight|outdoor/i,
      product: /产品|商品|展示|广告|电商|product|commercial|ad/i,
      interview: /访谈|采访|对话|聊天|interview|对话|主持|嘉宾/i,
      documentary: /纪录片|纪实|documentary|真实|历史|人文/i,
      vlog: /vlog|日常|生活|记录|旅行|travel|daily|life/i,
      gaming: /游戏|电竞|gaming|直播|game|play/i,
      education: /教学|教程|教育|讲解|education|tutorial|learn/i,
      movie: /电影|影视|剧情|movie|film|cinema|故事/i,
      music: /音乐|MV|歌曲|演唱会|music|concert|song/i,
    };

    // 检测场景类型
    let detectedScene = 'general';
    for (const [scene, pattern] of Object.entries(scenePatterns)) {
      if (pattern.test(text)) {
        detectedScene = scene;
        break;
      }
    }

    // 场景 → 样式映射表
    const stylePresets: Record<string, Partial<SubtitleStyle>> = {
      dark: {
        fontFamily: '"PingFang SC", "苹方", sans-serif',
        fontSizeCustom: 32,
        color: '#FFFFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        hasBorder: true,
        borderWidth: 2,
        borderColor: '#000000',
        position: 'bottom',
        bottomMargin: 8,
      },
      bright: {
        fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
        fontSizeCustom: 28,
        color: '#1a1a1a',
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        hasBorder: false,
        position: 'bottom',
        bottomMargin: 6,
      },
      product: {
        fontFamily: '"Source Han Sans CN", "思源黑体", sans-serif',
        fontSizeCustom: 36,
        color: '#FFFFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        hasBorder: true,
        borderWidth: 1.5,
        borderColor: '#000000',
        position: 'lower-third',
        bottomMargin: 10,
        alignment: 'left',
      },
      interview: {
        fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
        fontSizeCustom: 30,
        color: '#FFFFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        hasBorder: true,
        borderWidth: 2,
        borderColor: '#333333',
        position: 'bottom',
        bottomMargin: 8,
      },
      documentary: {
        fontFamily: '"SimSun", "宋体", serif',
        fontSizeCustom: 26,
        color: '#F5F5DC',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        hasBorder: true,
        borderWidth: 1,
        borderColor: '#000000',
        position: 'lower-third',
        bottomMargin: 12,
      },
      vlog: {
        fontFamily: '"PingFang SC", "苹方", sans-serif',
        fontSizeCustom: 28,
        color: '#FFFFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        hasBorder: true,
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.8)',
        position: 'bottom',
        bottomMargin: 6,
      },
      gaming: {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSizeCustom: 34,
        color: '#FFD700',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        hasBorder: true,
        borderWidth: 2.5,
        borderColor: '#1a1a1a',
        position: 'upper-third',
        bottomMargin: 4,
        fontWeight: 'bold',
      },
      education: {
        fontFamily: '"Source Han Sans CN", "思源黑体", sans-serif',
        fontSizeCustom: 32,
        color: '#FFFFFF',
        backgroundColor: 'rgba(30, 58, 95, 0.85)',
        hasBorder: false,
        position: 'lower-third',
        bottomMargin: 10,
        alignment: 'center',
      },
      movie: {
        fontFamily: '"SimHei", "黑体", sans-serif',
        fontSizeCustom: 28,
        color: '#E8E8E8',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        hasBorder: true,
        borderWidth: 1.5,
        borderColor: '#222222',
        position: 'bottom',
        bottomMargin: 8,
      },
      music: {
        fontFamily: '"PingFang SC", "苹方", sans-serif',
        fontSizeCustom: 30,
        color: '#FFFFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        hasBorder: true,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        position: 'bottom',
        bottomMargin: 6,
      },
      general: {
        fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
        fontSizeCustom: 28,
        color: '#FFFFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        hasBorder: true,
        borderWidth: 2,
        borderColor: '#000000',
        position: 'bottom',
        bottomMargin: 6,
      },
    };

    const preset = stylePresets[detectedScene] || stylePresets.general;

    console.log(`[AutoStyle] 检测到场景: ${detectedScene}, 应用预设`);

    return {
      ...config.style,
      ...preset,
    };
  }

  // 获取场景类型的中文名称
  const getSceneTypeLabel = (type: SceneType): string => {
    const labels: Record<SceneType, string> = {
      people: '人物对话',
      landscape: '风景自然',
      product: '产品展示',
      action: '动作运动',
      text: '文字/PPT',
      food: '美食',
      general: '通用场景',
    };
    return labels[type] || type;
  };
  
  // 获取置信度的颜色
  const getConfidenceColor = (confidence: string): string => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-50 border-green-200';
      case 'medium': return 'text-red-600 bg-red-50 border-yellow-200';
      case 'low': return 'text-muted-foreground bg-card border-border';
      default: return 'text-muted-foreground bg-card border-border';
    }
  };
  
  // 获取置信度标签
  const getConfidenceLabel = (confidence: string): string => {
    switch (confidence) {
      case 'high': return '高置信度';
      case 'medium': return '中等置信度';
      case 'low': return '低置信度';
      default: return confidence;
    }
  };

  // 试听配音
  const handlePlaySpeech = useCallback(() => {
    const fullText = config.segments.map(s => s.text).filter(Boolean).join(' ');
    
    if (!fullText.trim()) return;

    if (isPlayingSpeech) {
      window.speechSynthesis.cancel();
      setIsPlayingSpeech(false);
      return;
    }

    const langMap: Record<string, string> = {
      zh: 'zh-CN',
      en: 'en-US',
      ja: 'ja-JP',
      ko: 'ko-KR',
      fr: 'fr-FR',
      de: 'de-DE',
      es: 'es-ES',
    };

    const utterance = new SpeechSynthesisUtterance(fullText);
    const targetLang = langMap[config.voiceLanguage] || 'zh-CN';
    utterance.lang = targetLang;
    utterance.rate = config.speechSpeed;
    
    // 打印调试信息
    console.log('[TTS] 开始试听配音');
    console.log('[TTS] 目标语言:', config.voiceLanguage, '->', targetLang);
    console.log('[TTS] 目标性别:', config.voiceType);
    console.log('[TTS] 可用语音数量:', availableVoices.length);
    
    // 打印所有可用语音（调试用）
    if (availableVoices.length > 0) {
      console.log('[TTS] 所有可用语音:');
      availableVoices.forEach((voice, index) => {
        console.log(`  [${index}] ${voice.name} (${voice.lang}) - 默认: ${voice.default}`);
      });
    }
    
    // 使用预先加载的语音列表选择合适的语音
    let selectedVoice = null;
    
    // 1. 首先尝试找匹配语言和性别的语音
    const langVoices = availableVoices.filter(voice => voice.lang.startsWith(targetLang.split('-')[0]));
    
    console.log('[TTS] 匹配语言的语音数量:', langVoices.length);
    
    if (langVoices.length > 0) {
      // 尝试根据性别关键词筛选
      const genderKeywords = config.voiceType === 'female' 
        ? ['female', 'woman', 'girl', '女', '女性', 'F', 'f', 'xiaoyi', 'xiaomo', 'xiaoxiao']
        : ['male', 'man', 'boy', '男', '男性', 'M', 'm', 'xiaoming', 'xiaogang'];
      
      console.log('[TTS] 性别关键词:', genderKeywords);
      
      // 先找完全匹配的
      for (const voice of langVoices) {
        const voiceName = voice.name.toLowerCase();
        if (genderKeywords.some(keyword => voiceName.includes(keyword))) {
          selectedVoice = voice;
          console.log('[TTS] 通过关键词找到语音:', voice.name);
          break;
        }
      }
      
      // 如果没找到，就用该语言的第一个语音
      if (!selectedVoice) {
        selectedVoice = langVoices[0];
        console.log('[TTS] 使用该语言第一个语音:', selectedVoice.name);
      }
    }
    
    // 如果还是没找到，尝试找任意匹配语言的语音
    if (!selectedVoice) {
      const anyLangVoices = availableVoices.filter(voice => 
        voice.lang.includes(config.voiceLanguage) || 
        voice.lang.includes(targetLang.split('-')[0])
      );
      if (anyLangVoices.length > 0) {
        selectedVoice = anyLangVoices[0];
        console.log('[TTS] 使用任意匹配语言的语音:', selectedVoice.name);
      }
    }
    
    // 如果还是没找到，就用第一个可用的语音
    if (!selectedVoice && availableVoices.length > 0) {
      selectedVoice = availableVoices[0];
      console.log('[TTS] 使用第一个可用语音:', selectedVoice.name);
    }
    
    // 设置语音
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log('[TTS] 最终选择的语音:', selectedVoice.name, '(', selectedVoice.lang, ')');
    } else {
      console.log('[TTS] 没有找到合适的语音，使用浏览器默认');
    }
    
    // 设置音调作为补充（即使选了语音也可以调整音调）
    utterance.pitch = config.voiceType === 'female' ? 1.3 : 0.7;
    // 根据性别调整音量
    utterance.volume = 1.0;

    utterance.onend = () => {
      console.log('[TTS] 播放完成');
      setIsPlayingSpeech(false);
    };
    utterance.onerror = (event) => {
      console.error('[TTS] 播放错误:', event);
      setIsPlayingSpeech(false);
    };

    console.log('[TTS] 开始播放...');
    window.speechSynthesis.speak(utterance);
    setIsPlayingSpeech(true);
  }, [config.segments, config.voiceLanguage, config.speechSpeed, config.voiceType, isPlayingSpeech, availableVoices]);

  // 添加分段
  const addSegment = useCallback(() => {
    const newSegment = createDefaultSubtitleSegment('', videoDuration);
    updateConfig({
      segments: [...config.segments, newSegment],
    });
    setEditingSegmentId(newSegment.id);
  }, [config.segments, videoDuration, updateConfig]);

  // 删除分段
  const deleteSegment = useCallback((segmentId: string) => {
    updateConfig({
      segments: config.segments.filter(s => s.id !== segmentId),
    });
    if (editingSegmentId === segmentId) {
      setEditingSegmentId(null);
    }
  }, [config.segments, editingSegmentId, updateConfig]);

  // 更新分段
  const updateSegment = useCallback((segmentId: string, updates: Partial<SubtitleSegment>) => {
    updateConfig({
      segments: config.segments.map(s => 
        s.id === segmentId ? { ...s, ...updates } : s
      ),
    });
  }, [config.segments, updateConfig]);

  // 智能分段：预览模式（显示结果统计，不直接应用）
  const handlePreviewSplit = useCallback(() => {
    // 合并所有段文本作为输入
    const fullText = config.segments.map(s => s.text).join('');
    if (!fullText.trim()) return;

    const result = autoSplitSubtitleWithStats(fullText, videoDuration, splitOptions);
    setSplitPreview(result);
  }, [config.segments, videoDuration, splitOptions]);

  // 智能分段：应用预览结果
  const handleApplySplit = useCallback(() => {
    if (splitPreview) {
      updateConfig({ segments: splitPreview.segments });
      setSplitPreview(null);
      setShowSplitConfig(false);
    }
  }, [splitPreview, updateConfig]);

  // 智能分段：一键应用（无预览）
  const handleAutoSplit = useCallback(() => {
    const fullText = config.segments.map(s => s.text).join('');
    if (!fullText.trim()) return;

    const segments = autoSplitSubtitle(fullText, videoDuration, splitOptions);
    updateConfig({ segments });
  }, [config.segments, videoDuration, splitOptions, updateConfig]);

  // 自动生成字幕
  const handleAutoGenerate = useCallback(async () => {
    if (onAutoGenerate) {
      const text = await onAutoGenerate();
      if (text) {
        const segments = autoSplitSubtitle(text, videoDuration);
        updateConfig({ segments, enabled: true });
      }
    }
  }, [onAutoGenerate, videoDuration, updateConfig]);

  // 添加视频文字分段
  const handleAddVideoTextSegment = useCallback(() => {
    const newSegment = createDefaultVideoTextSegment(videoDuration);
    updateConfig({
      videoTextSegments: [...config.videoTextSegments, newSegment],
    });
  }, [config.videoTextSegments, videoDuration, updateConfig]);

  // 删除视频文字分段
  const handleRemoveVideoTextSegment = useCallback((segmentId: string) => {
    updateConfig({
      videoTextSegments: config.videoTextSegments.filter(s => s.id !== segmentId),
    });
  }, [config.videoTextSegments, updateConfig]);

  // 更新视频文字分段
  const handleUpdateVideoTextSegment = useCallback((segmentId: string, updates: Partial<VideoTextSegment>) => {
    updateConfig({
      videoTextSegments: config.videoTextSegments.map(s => 
        s.id === segmentId ? { ...s, ...updates } : s
      ),
    });
  }, [config.videoTextSegments, updateConfig]);

  // 获取当前预览的字幕
  const currentPreviewSubtitle = useMemo(() => {
    return config.segments.find(
      seg => previewTime >= seg.startTime && previewTime < seg.endTime
    );
  }, [config.segments, previewTime]);

  // 预览播放控制
  const togglePreviewPlay = useCallback(() => {
    if (isPreviewPlaying) {
      setIsPreviewPlaying(false);
    } else {
      setIsPreviewPlaying(true);
      const startTime = Date.now();
      const startPreviewTime = previewTime;
      
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const newTime = startPreviewTime + elapsed;
        
        if (newTime >= videoDuration) {
          setPreviewTime(0);
          setIsPreviewPlaying(false);
        } else {
          setPreviewTime(newTime);
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }
  }, [isPreviewPlaying, previewTime, videoDuration]);

  return (
    <div className="space-y-6">
      <SubtitleEditorHeader
        config={config}
        disabled={disabled}
        handleAutoGenerate={handleAutoGenerate}
        isGenerating={isGenerating}
        onAutoGenerate={onAutoGenerate}
        updateConfig={updateConfig}
      />

      {config.enabled && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <SubtitleEditorTabsList />

          <TabsContent value="segments" className="space-y-4 mt-4">
            <SubtitleSegmentsToolbar
              addSegment={addSegment}
              config={config}
              disabled={disabled}
              handlePreviewSplit={handlePreviewSplit}
              setShowSplitConfig={setShowSplitConfig}
              showSplitConfig={showSplitConfig}
              videoDuration={videoDuration}
            />

            {showSplitConfig && (
              <div className="rounded-xl border border-[#EF4444]/20 bg-gradient-to-r from-[#EF4444]/5 via-purple-500/5 to-red-500/5 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 flex-1">
                    <Label className="text-[11px] text-muted-foreground whitespace-nowrap">每段字数</Label>
                    <Slider
                      value={[splitOptions.maxCharsPerSegment || 22]}
                      min={12}
                      max={40}
                      step={1}
                      onValueChange={(v) => setSplitOptions(prev => ({ ...prev, maxCharsPerSegment: v[0] }))}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono text-[#EF4444] w-7 text-right">{splitOptions.maxCharsPerSegment || 22}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <Label className="text-[11px] text-muted-foreground whitespace-nowrap">语速</Label>
                    <Slider
                      value={[splitOptions.speechRate || 4.5]}
                      min={2.5}
                      max={7}
                      step={0.5}
                      onValueChange={(v) => setSplitOptions(prev => ({ ...prev, speechRate: v[0] }))}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono text-muted-foreground w-8 text-right">{splitOptions.speechRate || 4.5}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handlePreviewSplit}
                    disabled={disabled}
                    className="h-8 px-3 text-xs text-[#EF4444] hover:bg-[#EF4444]/10"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    预览
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowSplitConfig(false); setSplitPreview(null); }}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </Button>
                </div>

                {splitPreview && (
                  <div className="space-y-2">
                    {/* 统计摘要 */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        预览：<strong className="text-foreground">{splitPreview.stats.totalSegments}</strong> 段
                      </span>
                      <span className="text-xs text-muted-foreground">
                        均 <strong className="text-red-300">{splitPreview.stats.avgChars}</strong> 字
                      </span>
                      <span className="text-xs text-muted-foreground">
                        范围 <strong className="text-green-300">{splitPreview.stats.minChars}-{splitPreview.stats.maxChars}</strong> 字
                      </span>
                      <span className="text-xs text-muted-foreground">
                        时长 <strong className="text-red-300">{formatTime(splitPreview.stats.totalDuration)}</strong>
                      </span>
                    </div>

                    {/* 警告提示 */}
                    {splitPreview.stats.warnings.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {splitPreview.stats.warnings.map((w, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                            ⚠ {w}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 分段预览列表（最多显示前6条） */}
                    <div className="grid gap-1 max-h-[140px] overflow-y-auto pr-1">
                      {splitPreview.segments.slice(0, 6).map((seg, i) => (
                        <div key={seg.id} className="flex items-start gap-2 p-1.5 rounded bg-black/15 text-[11px] group">
                          <span className="text-muted-foreground font-mono w-5 flex-shrink-0 pt-0.5">{i + 1}</span>
                          <span className="text-foreground/80 line-clamp-1 flex-1">{seg.text}</span>
                          <span className="font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            {formatTime(seg.startTime)}-{formatTime(seg.endTime)}
                          </span>
                        </div>
                      ))}
                      {splitPreview.segments.length > 6 && (
                        <div className="text-center text-[10px] text-muted-foreground py-1">
                          ... 还有 {splitPreview.segments.length - 6} 段
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleApplySplit}
                        disabled={disabled}
                        className="flex-1 bg-gradient-to-r from-[#EF4444]/80 to-red-500/60 hover:from-[#EF4444] hover:to-red-500 text-black text-xs font-medium h-8 border-0"
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        应用分段（{splitPreview.stats.totalSegments}段）
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAutoSplit()}
                        disabled={disabled}
                        className="text-xs h-8 bg-accent/30 hover:bg-accent border-border"
                      >
                        跳过预览直接应用
                      </Button>
                    </div>
                  </div>
                )}

                {!splitPreview && (
                  <p className="text-[11px] text-muted-foreground text-center py-2">
                    调整参数后点击「预览」查看分段效果，确认后点击「应用」
                  </p>
                )}
              </div>
            )}

            {/* ==================== 智能导入 & 文件管理（可折叠） ==================== */}
            <div className="mb-3">
              {/* 折叠/展开触发栏（始终可见，紧凑单行） */}
              <div
                className="flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r from-red-500/8 to-red-500/8 border border-red-500/15 cursor-pointer hover:border-red-500/25 transition-colors group"
                onClick={() => setShowImportPanel(!showImportPanel)}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-red-500/12 flex items-center justify-center flex-shrink-0">
                    <Wand2 className="w-3.5 h-3.5 text-red-400" />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-red-300">智能导入 & 文件管理</span>
                    {config.segments.length > 0 && (
                      <span className="text-[10px] text-muted-foreground ml-1.5">({config.segments.length}段已加载)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* 快捷操作按钮（折叠时也可用） */}
                  <input type="file" accept=".srt,.ass,.txt" onChange={handleImportSubtitle} disabled={disabled} className="hidden" id="subtitle-import-file" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); document.getElementById('subtitle-import-file')?.click(); }}
                    disabled={disabled}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                    title="导入文件"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  {/* 展开/折叠箭头 */}
                  <svg
                    className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showImportPanel ? 'rotate-180' : ''}`}
                    viewBox="0 0 16 16" fill="none"
                  >
                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* 展开内容（折叠时隐藏） */}
              {showImportPanel && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3 animate-in slide-in-from-top-2 duration-200">

                  {/* 左栏：导入工具 */}
                  <div className="space-y-3">
                    {/* 纯文本智能导入 */}
                    <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-red-500/5">
                      <CardHeader className="p-3 pb-1.5">
                        <Label className="text-xs font-medium flex items-center gap-1.5 text-red-300">
                          <Sparkles className="w-3.5 h-3.5" />
                          纯文本智能导入
                          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-[10px] font-normal">推荐</span>
                        </Label>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-2">
                        <Textarea
                          placeholder="粘贴文案内容，系统将自动按语义断句并分配时间轴..."
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          disabled={disabled}
                          rows={3}
                          className="bg-black/20 border-border text-xs resize-none focus:border-red-500/50"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleTextImport}
                            disabled={disabled || !textInput.trim() || isImportingText}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs h-7"
                          >
                            {isImportingText ? (
                              <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> 断句中...</>
                            ) : (
                              <><Sparkles className="w-3 h-3 mr-1" /> 智能断句生成字幕</>
                            )}
                          </Button>
                          {importStatus && (
                            <span className="text-[10px] text-green-400 whitespace-nowrap">{importStatus}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* QClaw 提示词解析 */}
                    <Card className="border-red-500/20 bg-red-500/5">
                      <CardHeader className="p-3 pb-1.5">
                        <Label className="text-xs font-medium flex items-center gap-1.5 text-red-300">
                          <Zap className="w-3.5 h-3.5" />
                          智能提示词解析
                          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-[10px] font-normal">QClaw</span>
                        </Label>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-2">
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          粘贴QClaw兼容提示词，例如：语言=普通话；断句=单行≤18字；样式=白字+黑描边；底部居中
                        </p>
                        <Textarea
                          placeholder="粘贴提示词..."
                          value={promptInput}
                          onChange={(e) => setPromptInput(e.target.value)}
                          disabled={disabled}
                          rows={2}
                          className="bg-black/20 border-border text-xs resize-none focus:border-red-500/50"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleParsePrompt}
                            disabled={disabled || !promptInput.trim()}
                            className="bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs h-7 px-3 border border-red-500/20"
                          >
                            解析并应用
                          </Button>
                          {promptParseResult && (
                            <span className="text-[10px] text-green-400 whitespace-nowrap">
                              ✓ {(promptParseResult.parseConfidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* 从字幕智能生成分镜 */}
                    <Card className="border-green-500/20 bg-green-500/5">
                      <CardHeader className="p-3 pb-1.5">
                        <Label className="text-xs font-medium flex items-center gap-1.5 text-green-300">
                          <Film className="w-3.5 h-3.5" />
                          智能分镜生成
                          <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-[10px] font-normal">NEW</span>
                        </Label>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-2">
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          根据字幕内容自动规划每个分镜的画面描述，分析场景、情感、动作
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              // 触发打开分镜提示词助手（通过自定义事件或状态）
                              const event = new CustomEvent('open-storyboard-from-subtitle', {
                                detail: { segments: config.segments }
                              });
                              window.dispatchEvent(event);
                            }}
                            disabled={disabled || config.segments.length === 0}
                            className="bg-green-500/15 hover:bg-green-500/25 text-green-300 text-xs h-7 px-3 border border-green-500/20"
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            {config.segments.length > 0 ? `从${config.segments.length}段字幕生成分镜` : '需要先添加字幕'}
                          </Button>
                          {config.segments.length > 0 && (
                            <span className="text-[10px] text-foreground/70 whitespace-nowrap">
                              总时长{config.segments.reduce((s, seg) => s + (seg.endTime - seg.startTime), 0).toFixed(1)}s
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* 校对优化工具 */}
                    <Card className="border-red-500/20 bg-red-500/5">
                      <CardHeader className="p-3 pb-1.5">
                        <Label className="text-xs font-medium flex items-center gap-1.5 text-red-300">
                          <Wand2 className="w-3.5 h-3.5" />
                          校对优化工具
                        </Label>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 cursor-pointer hover:bg-white/8 transition-colors">
                            <Switch
                              checked={proofreadOptions.removeFillers}
                              onCheckedChange={(checked) =>
                                setProofreadOptions(prev => ({ ...prev, removeFillers: checked }))
                              }
                              disabled={disabled}
                            />
                            <span className="text-xs">删除语气词</span>
                          </label>
                          <label className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 cursor-pointer hover:bg-white/8 transition-colors">
                            <Switch
                              checked={proofreadOptions.normalizePunctuation}
                              onCheckedChange={(checked) =>
                                setProofreadOptions(prev => ({ ...prev, normalizePunctuation: checked }))
                              }
                              disabled={disabled}
                            />
                            <span className="text-xs">规范标点</span>
                          </label>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleApplyProofreading}
                          disabled={disabled || config.segments.length === 0}
                          className="w-full bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs h-7 border border-red-500/20"
                        >
                          应用校对所有字幕 ({config.segments.length}段)
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 右栏：文件操作 */}
                  <div className="space-y-3">
                    <Card className="border-border bg-card/50">
                      <CardHeader className="p-3 pb-1.5">
                        <div className="flex items-center gap-2">
                          <Upload className="w-4 h-4 text-red-400" />
                          <Label className="text-xs font-medium">文件操作</Label>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-2.5">
                        {/* 文件输入 */}
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">文件输入 (SRT / ASS)</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('subtitle-import-file')?.click()}
                            disabled={disabled}
                            className="w-full h-8 text-xs bg-accent/30 hover:bg-accent border-dashed border-white/20"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            选择文件导入
                          </Button>
                        </div>

                        {/* 文件导出 */}
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">文件导出</Label>
                          {config.segments.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => handleExportSubtitle('srt')} disabled={disabled} className="text-xs bg-accent/30 hover:bg-accent h-8"><Download className="w-3 h-3 mr-1" />导出 SRT</Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => handleExportSubtitle('ass')} disabled={disabled} className="text-xs bg-accent/30 hover:bg-accent h-8"><Download className="w-3 h-3 mr-1" />导出 ASS</Button>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" disabled className="w-full h-8 text-xs opacity-50">暂无数据可导出</Button>
                          )}
                        </div>

                        {/* 语音识别 */}
                        <div className="space-y-1">
                          <Label className="text-[11px] flex items-center gap-1 text-muted-foreground">
                            语音识别 (ASR)
                            <span className="px-1 py-0.5 rounded bg-red-500/15 text-red-500/80 text-[9px]">Beta</span>
                          </Label>
                          <input type="file" accept=".mp3,.wav,.m4a,.ogg,.webm" onChange={handleAudioASR} disabled={disabled} className="hidden" id="subtitle-asr-file" />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('subtitle-asr-file')?.click()}
                            disabled={disabled}
                            className="w-full h-8 text-xs bg-accent/30 hover:bg-accent border-dashed border-white/20"
                          >
                            <Mic className="w-3 h-3 mr-1" />
                            上传音频识别
                          </Button>
                          <p className="text-[9px] text-muted-foreground leading-relaxed">
                            支持 MP3/WAV/M4A 格式，音频将被转写为文字并自动生成字幕
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                </div>
              )}
            </div>{/* 智能导入 & 文件管理 结束 */}

            <SubtitleSegmentList
              config={config}
              deleteSegment={deleteSegment}
              disabled={disabled}
              handleAddSpeaker={handleAddSpeaker}
              handleDeleteSpeaker={handleDeleteSpeaker}
              handleInitDefaultSpeakers={handleInitDefaultSpeakers}
              handleUpdateSpeaker={handleUpdateSpeaker}
              setShowSpeakerManager={setShowSpeakerManager}
              showSpeakerManager={showSpeakerManager}
              updateConfig={updateConfig}
              updateSegment={updateSegment}
              videoDuration={videoDuration}
            />
          </TabsContent>

          <SubtitleVideoTextEditor
            config={config}
            disabled={disabled}
            handleAddVideoTextSegment={handleAddVideoTextSegment}
            handleRemoveVideoTextSegment={handleRemoveVideoTextSegment}
            handleUpdateVideoTextSegment={handleUpdateVideoTextSegment}
            manualVideoTextValue={manualVideoTextValue}
            setManualVideoTextValue={setManualVideoTextValue}
            setShowManualVideoTextInput={setShowManualVideoTextInput}
            showManualVideoTextInput={showManualVideoTextInput}
            updateConfig={updateConfig}
            videoDuration={videoDuration}
          />
          {/* 样式设置 - 左右两栏布局 */}
          {/* 样式设置 - 单栏布局（样式模式 + 智能定位 + 基础样式） */}
          <TabsContent value="style" className="mt-4 space-y-4">

            <SubtitleStyleModeCard
              config={config}
              currentStyleMode={currentStyleMode}
              disabled={disabled}
              handleAutoAnalyzeStyle={handleAutoAnalyzeStyle}
              handleStyleModeChange={handleStyleModeChange}
              isAnalyzingStyle={isAnalyzingStyle}
              updateStyle={updateStyle}
              videoPrompt={videoPrompt}
            />

            {/* 智能定位面板 */}
            <Card className="border border-[#EF4444]/30 bg-gradient-to-r from-[#EF4444]/5 to-transparent">
              <CardHeader className="p-4 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#EF4444]" />
                    智能定位
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.autoPosition || false}
                      onCheckedChange={(checked) => updateConfig({ autoPosition: checked })}
                      disabled={disabled}
                    />
                    <span className="text-xs text-muted-foreground">启用</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <p className="text-xs text-muted-foreground">
                  根据视频内容自动分析最佳字幕/文字位置，避免遮挡重要画面元素
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAnalyzeSmartPosition}
                  disabled={disabled || isAnalyzingPosition || !videoPrompt.trim()}
                  className="w-full bg-gradient-to-r from-[#EF4444]/20 to-red-500/20 hover:from-[#EF4444]/30 hover:to-red-500/30 border border-[#EF4444]/30 text-sm"
                >
                  {isAnalyzingPosition ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> 正在分析视频内容...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> 分析并推荐位置</>
                  )}
                </Button>
                {!videoPrompt.trim() && (
                  <p className="text-[10px] text-red-400">
                    ⚠️ 需要先输入视频描述才能进行智能定位分析
                  </p>
                )}
                {smartPositionResult && (
                  <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-xs font-medium text-green-300">分析完成</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-blue-200">
                        {getConfidenceLabel(smartPositionResult.confidence)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-blue-200">
                        {getSceneTypeLabel(smartPositionResult.sceneType)}
                      </span>
                    </div>
                    <p className="text-xs">{smartPositionResult.reason}</p>
                    {smartPositionResult.suggestedX !== undefined && smartPositionResult.suggestedY !== undefined && (
                      <p className="text-[10px] font-mono">建议坐标: X={smartPositionResult.suggestedX}%, Y={smartPositionResult.suggestedY}%</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button type="button" variant="outline" size="sm" onClick={applySmartPositionToSubtitle} disabled={disabled} className="h-7 text-xs"><Type className="w-3 h-3 mr-1" /> 应用到字幕</Button>
                      <Button type="button" variant="outline" size="sm" onClick={applySmartPositionToVideoText} disabled={disabled || config.videoTextSegments.length === 0} className="h-7 text-xs"><Layers className="w-3 h-3 mr-1" /> 应用到文字</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 基础样式设置（两列网格） */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* 左：基础设置 */}
              <Card className="border-border">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm">基础设置</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  {/* 字幕位置 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">字幕位置</Label>
                    <Select value={config.style.position} onValueChange={(value: any) => updateStyle({ position: value })} disabled={disabled}>
                      <SelectTrigger className="h-8 text-xs bg-accent/30 border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom">底部</SelectItem>
                        <SelectItem value="top">顶部</SelectItem>
                        <SelectItem value="middle">中间</SelectItem>
                        <SelectItem value="upper-third">上三分之一</SelectItem>
                        <SelectItem value="lower-third">下三分之一</SelectItem>
                        <SelectItem value="custom">自定义</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* 字体族 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">字体族</Label>
                      {currentStyleMode === 'hybrid' && config.autoStyleRecommendation?.fontFamily && config.autoStyleRecommendation.fontFamily !== config.style.fontFamily && (
                        <button type="button" onClick={() => applyRecommendedStyleField('fontFamily', config.autoStyleRecommendation!.fontFamily)} disabled={disabled} className="text-[10px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30" title="应用推荐值">推荐</button>
                      )}
                    </div>
                    <Select value={config.style.fontFamily || 'Microsoft YaHei, "微软雅黑", sans-serif'} onValueChange={(value) => updateStyle({ fontFamily: value })} disabled={disabled && currentStyleMode === 'auto'}>
                      <SelectTrigger className="h-8 text-xs bg-accent/30 border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FONT_FAMILY_OPTIONS.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* 字号 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">字号 ({config.style.fontSizeCustom || 28}px)</Label>
                      {currentStyleMode === 'hybrid' && config.autoStyleRecommendation?.fontSizeCustom && config.autoStyleRecommendation.fontSizeCustom !== config.style.fontSizeCustom && (
                        <button type="button" onClick={() => applyRecommendedStyleField('fontSizeCustom', config.autoStyleRecommendation!.fontSizeCustom)} disabled={disabled} className="text-[10px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30" title="应用推荐字号">{config.autoStyleRecommendation.fontSizeCustom}px</button>
                      )}
                    </div>
                    <Slider value={[config.style.fontSizeCustom || 28]} min={16} max={72} step={2} onValueChange={(v) => updateStyle({ fontSizeCustom: v[0] })} disabled={disabled && currentStyleMode === 'auto'} />
                    <div className="flex gap-1">
                      {[20, 24, 28, 36, 48].map((size) => (
                        <button key={size} type="button" onClick={() => updateStyle({ fontSizeCustom: size })} disabled={disabled} className={`flex-1 py-1 rounded text-[10px] transition-colors ${(config.style.fontSizeCustom || 28) === size ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30' : 'bg-accent/30 text-muted-foreground hover:bg-accent border transparent'}`}>{size}</button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 右：颜色与效果 */}
              <Card className="border-border">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm">颜色与效果</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  {/* 文字颜色 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">文字颜色</Label>
                    <div className="flex gap-2">
                      <div className="flex-1 h-8 rounded-md border border-white/20 cursor-pointer relative overflow-hidden" style={{ backgroundColor: config.style.color || '#FFFFFF' }} onClick={() => document.getElementById('subtitle-text-color')?.click()}>
                        <input id="subtitle-text-color" type="color" value={config.style.color || '#FFFFFF'} onChange={(e) => updateStyle({ color: e.target.value })} disabled={disabled} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                      <Select value={config.style.color || '#FFFFFF'} onValueChange={(v) => updateStyle({ color: v })} disabled={disabled}>
                        <SelectTrigger className="h-8 w-[120px] text-xs bg-accent/30 border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SUBTITLE_COLOR_OPTIONS.map((c) => (<SelectItem key={c.value} value={c.value}><div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: c.value }} />{c.label}</div></SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* 背景颜色 */}
                  {config.style.backgroundColor && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">背景颜色</Label>
                      <Select value={config.style.backgroundColor || ''} onValueChange={(v) => updateStyle({ backgroundColor: v })} disabled={disabled}>
                        <SelectTrigger className="h-8 text-xs bg-accent/30 border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SUBTITLE_BG_COLOR_OPTIONS.map((c) => (<SelectItem key={c.value} value={c.value}><div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: c.value }} />{c.label}</div></SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {/* 描边 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">描边 ({config.style.borderWidth || 0}px)</Label>
                      {currentStyleMode === 'hybrid' && config.autoStyleRecommendation?.hasBorder && config.autoStyleRecommendation.borderWidth !== config.style.borderWidth && (
                        <button type="button" onClick={() => { applyRecommendedStyleField('hasBorder', true); applyRecommendedStyleField('borderWidth', config.autoStyleRecommendation!.borderWidth); }} disabled={disabled} className="text-[10px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30" title="应用推荐描边">{config.autoStyleRecommendation.borderWidth}px</button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Slider value={[config.style.borderWidth || 0]} min={0} max={4} step={0.5} onValueChange={(v) => updateStyle({ borderWidth: v[0] })} disabled={disabled && currentStyleMode === 'auto'} className="flex-1" />
                      <span className="text-xs text-muted-foreground w-6 text-right">{config.style.borderWidth || 0}</span>
                    </div>
                    {config.style.hasBorder && (
                      <div className="flex gap-2">
                        <div className="h-6 w-16 rounded border border-white/20 cursor-pointer relative overflow-hidden" style={{ backgroundColor: config.style.borderColor || '#000000' }} onClick={() => document.getElementById('subtitle-border-color')?.click()}>
                          <input id="subtitle-border-color" type="color" value={config.style.borderColor || '#000000'} onChange={(e) => updateStyle({ borderColor: e.target.value })} disabled={disabled} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <span className="text-[10px] text-muted-foreground self-center">边框色</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

          </TabsContent>
          <TabsContent value="preview" className="mt-4">
            <Card className="border border-border">
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">字幕预览</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      {formatTime(previewTime)} / {formatTime(videoDuration)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={togglePreviewPlay}
                      className="h-8 w-8 p-0"
                    >
                      {isPreviewPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {/* 预览画布 */}
                <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-border">
                  {/* 模拟视频背景 */}
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black" />
                  
                  {/* 时间进度条 */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent/50">
                    <div
                      className="h-full bg-[#EF4444] transition-all duration-100"
                      style={{ width: `${(previewTime / videoDuration) * 100}%` }}
                    />
                  </div>

                  {/* 字幕 */}
                  {currentPreviewSubtitle && (
                    <div style={getSubtitleStyleCSS(config.style)}>
                      {currentPreviewSubtitle.text}
                    </div>
                  )}

                  {/* 空状态提示 */}
                  {!currentPreviewSubtitle && config.segments.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-foreground/30">
                      <div className="text-center">
                        <Type className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>添加字幕后在此预览效果</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 时间滑块 */}
                <div className="mt-4">
                  <input
                    type="range"
                    min="0"
                    max={videoDuration}
                    step="0.1"
                    value={previewTime}
                    onChange={(e) => {
                      setPreviewTime(parseFloat(e.target.value));
                      setIsPreviewPlaying(false);
                    }}
                    className="w-full h-2 bg-accent/70 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* 分段列表 */}
                {config.segments.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-sm mb-2 block">时间轴分段</Label>
                    <div className="space-y-1">
                      {config.segments.map((segment, index) => (
                        <div
                          key={segment.id}
                          className={`flex items-center gap-2 p-2 rounded text-sm ${
                            currentPreviewSubtitle?.id === segment.id
                              ? 'bg-[#EF4444]/20 border border-[#EF4444]/30'
                              : 'bg-accent/30 border border-border'
                          }`}
                        >
                          <span className="w-8 text-center text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="flex-1 truncate">
                            {segment.text || '(空)'}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatTime(segment.startTime)} → {formatTime(segment.endTime)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* 配音设置 */}
      {config.enabled && (
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between p-3 bg-[#EF4444]/10 rounded-lg border border-[#EF4444]/30">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#EF4444]" />
              <Label className="text-sm font-medium cursor-pointer">
                生成配音（将字幕转为音频加入视频）
              </Label>
            </div>
            <Switch
              checked={config.generateVoice}
              onCheckedChange={(checked) => updateConfig({ generateVoice: checked })}
              disabled={disabled || config.segments.length === 0}
            />
          </div>

          {config.generateVoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">配音音色</Label>
                  <Select
                    value={config.voiceType}
                    onValueChange={(value: any) => updateConfig({ voiceType: value })}
                    disabled={disabled}
                  >
                    <SelectTrigger className="bg-accent/30 border-border h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">女声</SelectItem>
                      <SelectItem value="male">男声</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">配音语言</Label>
                  <Select
                    value={config.voiceLanguage}
                    onValueChange={(value) => updateConfig({ voiceLanguage: value })}
                    disabled={disabled}
                  >
                    <SelectTrigger className="bg-accent/30 border-border h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh">中文</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ja">日本語</SelectItem>
                      <SelectItem value="ko">한국어</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">语速</Label>
                    <span className="text-xs text-muted-foreground">
                      {config.speechSpeed.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={config.speechSpeed}
                    onChange={(e) => updateConfig({ speechSpeed: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-accent/70 rounded-lg appearance-none cursor-pointer"
                    disabled={disabled}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>慢</span>
                    <span>正常</span>
                    <span>快</span>
                  </div>
                </div>
              </div>

              {/* 语音信息和刷新按钮 */}
              <div className="p-3 bg-accent/30 border border-border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    <div>可用语音: {availableVoices.length} 个</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // 强制刷新语音列表
                      console.log('[TTS] 手动刷新语音列表');
                      const voices = window.speechSynthesis.getVoices();
                      setAvailableVoices(voices);
                      console.log('[TTS] 刷新后语音数量:', voices.length);
                    }}
                    disabled={disabled}
                    className="h-8 text-xs"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    刷新
                  </Button>
                </div>
                
                {/* 当前选择的语音信息 */}
                {(() => {
                  const langMap: Record<string, string> = {
                    zh: 'zh-CN',
                    en: 'en-US',
                    ja: 'ja-JP',
                    ko: 'ko-KR',
                    fr: 'fr-FR',
                    de: 'de-DE',
                    es: 'es-ES',
                  };
                  const targetLang = langMap[config.voiceLanguage] || 'zh-CN';
                  
                  // 查找当前应该选择的语音
                  let currentVoiceInfo = '未找到匹配语音';
                  const langVoices = availableVoices.filter(voice => voice.lang.startsWith(targetLang.split('-')[0]));
                  
                  if (langVoices.length > 0) {
                    const genderKeywords = config.voiceType === 'female' 
                      ? ['female', 'woman', 'girl', '女', '女性', 'F', 'f', 'xiaoyi', 'xiaomo', 'xiaoxiao']
                      : ['male', 'man', 'boy', '男', '男性', 'M', 'm', 'xiaoming', 'xiaogang'];
                    
                    let foundVoice = null;
                    for (const voice of langVoices) {
                      const voiceName = voice.name.toLowerCase();
                      if (genderKeywords.some(keyword => voiceName.includes(keyword))) {
                        foundVoice = voice;
                        break;
                      }
                    }
                    
                    if (foundVoice) {
                      currentVoiceInfo = foundVoice.name;
                    } else {
                      currentVoiceInfo = langVoices[0].name + ' (默认)';
                    }
                  }
                  
                  return (
                    <div className="text-xs text-muted-foreground">
                      <div>目标: {config.voiceLanguage} / {config.voiceType === 'female' ? '女声' : '男声'}</div>
                      <div className="truncate">选择: {currentVoiceInfo}</div>
                    </div>
                  );
                })()}
              </div>

              {/* 试听按钮 */}
              <div className="flex items-center justify-center p-4 bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-lg">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handlePlaySpeech}
                  disabled={disabled || config.segments.length === 0 || config.segments.every(s => !s.text)}
                  className="text-[#EF4444] hover:text-[#EF4444]/80 hover:bg-[#EF4444]/10"
                >
                  {isPlayingSpeech ? (
                    <Pause className="w-4 h-4 mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {isPlayingSpeech ? '停止试听' : '试听配音'}
                </Button>
              </div>

              {/* 生成语音旁白时是否显示字幕 */}
              <div className="flex items-center justify-between p-3 bg-accent/30 border border-border rounded-lg">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-[#EF4444]/70" />
                  <Label className="text-xs font-medium cursor-pointer">
                    同时显示字幕文字
                  </Label>
                </div>
                <Switch
                  checked={config.showSubtitleWithVoice !== false}
                  onCheckedChange={(checked) => updateConfig({ showSubtitleWithVoice: checked })}
                  disabled={disabled}
                />
              </div>
              <p className="text-[10px] text-foreground/70 pl-1">
                开启后，生成语音旁白的同时会在视频上显示字幕文字；关闭则仅保留语音
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
