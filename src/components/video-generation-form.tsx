'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Video, Wand2, Palette, Heart, Sparkles, Layers, Save, Languages, Volume2, Mic, Clock, AlertCircle, ChevronRight, Settings, Check, GitBranch, FileText, ExternalLink, Sparkles as SparklesIcon, Film, Music, Upload, Trash2, Library, Headphones, X, Zap, Link, Subtitles } from 'lucide-react';
import { STYLE_OPTIONS, MOOD_OPTIONS, generateEnhancedPrompt } from '@/constants/styles';
import {
  FILTER_OPTIONS,
  generateFilterPrompt
} from '@/constants/filters';
import { COLOR_THEME_OPTIONS, generateColorThemePrompt } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useTemplates } from '@/contexts/TemplateContext';
import { useTasks } from '@/contexts/TaskContext';
import { useVideoGenerationSubmit } from '@/hooks/useVideoGenerationSubmit';
import { StyleReferenceModal } from '@/components/style-reference-modal';
import { MaterialUpload, Material } from '@/components/material-upload';
import { OptionSelectorModal } from '@/components/OptionSelectorModal';
import { EnhancedPromptModal } from '@/components/EnhancedPromptModal';
import { SubtitleEditor } from '@/components/subtitle-editor';
import {
  SubtitleConfig,
  DEFAULT_SUBTITLE_STYLE,
  createDefaultSubtitleSegment,
  autoSplitSubtitle,
} from '@/constants/subtitles';
import {
  getCurrentStrategy,
  calculateEstimatedTimeWithStrategy,
  formatEstimatedTime,
  SegmentStrategyMode,
  DEFAULT_STRATEGY_MODE,
  strategyMap,
  getStrategyRecommendation
} from '@/lib/video-segment-strategy';
import { SDKDetector } from '@/components/sdk-detector';
import { PRESET_VIDEO_TEMPLATES, type GenerationTemplate } from '@/constants/templates';
import { VideoPromptGenerator } from '@/components/video-prompt-generator';
import { StoryboardEditor } from '@/components/storyboard-editor';
import type { Storyboard } from '@/types/storyboard';
import { BGM_TYPES_V2, getBgmTypeList, getRecommendedBgmForScene, type BgmTypeId } from '@/constants/bgm-types';
import { SFX_LIBRARY, SFX_CATEGORIES, getSfxByCategory, recommendSfxForScene, type SfxBinding, type SfxId } from '@/constants/sfx-types';
import MusicLibraryBrowser from '@/components/music-library-browser';
import type { LibraryTrack } from '@/constants/music-library';
import { VideoGenerationSettingsPanel } from '@/components/video/video-generation-settings-panel';
import { VideoGenerationSubmitPanel } from '@/components/video/video-generation-submit-panel';
import {
  createDefaultVideoTextSegment,
  generateVideoTextSegmentId,
  type VideoConfig,
  type VideoGenerationFormProps,
  type VideoTextSegment,
} from '@/lib/video-generation-form-model';

export function VideoGenerationForm({ 
  onGenerate, 
  isGenerating: isGeneratingProp,
  onGeneratingChange,
  onPromptEnhanced,
  initialPrompt = '',
  initialConfig
}: VideoGenerationFormProps) {
  const { themeGradient } = useTheme();
  const { addTemplate } = useTemplates();
  const { addTask, updateTask } = useTasks();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [duration, setDuration] = useState<string>('8');
  const [style, setStyle] = useState<string>('none');
  const [mood, setMood] = useState<string>('none');
  const [filter, setFilter] = useState<string>('none');
  const [colorTheme, setColorTheme] = useState<string>('none');
  const [resolution, setResolution] = useState<string>('720p');
  const [ratio, setRatio] = useState<string>('16:9');
  const [language, setLanguage] = useState<string>('zh'); // 新增语言选择状态
  const [smartEnhance, setSmartEnhance] = useState<boolean>(true);
  const [enablePromptOptimize, setEnablePromptOptimize] = useState<boolean>(true); // 提示词智能优化
  const [watermark, setWatermark] = useState<boolean>(true);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState('');
  const [generationMessage, setGenerationMessage] = useState('');
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [useNineGrid, setUseNineGrid] = useState(false); // 新增：九宫格生成模式
  const [userNineGridImages, setUserNineGridImages] = useState<string[]>([]); // 用户上传的九宫格图片
  const [qualityMode, setQualityMode] = useState<string>('balanced'); // ★ 优化模式: fast/balanced/quality

  // ★ 特效音(SFX)相关状态
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(false);
  const [sfxMode, setSfxMode] = useState<'auto' | 'manual'>('auto');
  const [sfxBindings, setSfxBindings] = useState<SfxBinding[]>([]);
  const [sfxGlobalVolume, setSfxGlobalVolume] = useState<number>(0.6);
  const [showSfxPanel, setShowSfxPanel] = useState(false);
  
  // 通用确认弹窗状态
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);
  
  // 信息提示弹窗状态
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [alertDialogConfig, setAlertDialogConfig] = useState<{
    title: string;
    description: string;
    onClose?: () => void;
  } | null>(null);
  
  // 弹窗选择器相关状态
  const [openSelector, setOpenSelector] = useState<string | null>(null);
  const [selectedValuesHistory, setSelectedValuesHistory] = useState<Record<string, string[]>>({});
  
  // 智能增强弹窗
  const [showEnhancedPromptModal, setShowEnhancedPromptModal] = useState(false);
  const [originalPromptForModal, setOriginalPromptForModal] = useState('');
  
  // 字幕相关状态（旧版 - 保持兼容性）
  const [enableSubtitle, setEnableSubtitle] = useState(false);
  const [subtitleText, setSubtitleText] = useState('');
  const [subtitlePosition, setSubtitlePosition] = useState('bottom');
  const [subtitleFontSize, setSubtitleFontSize] = useState('medium');
  const [subtitleColor, setSubtitleColor] = useState('white');
  const [subtitleVoiceType, setSubtitleVoiceType] = useState('female');
  const [subtitleSpeechSpeed, setSubtitleSpeechSpeed] = useState(1.0);
  const [generateVoice, setGenerateVoice] = useState(false);
  const [isGeneratingSubtitle, setIsGeneratingSubtitle] = useState(false);
  const [isPlayingSubtitle, setIsPlayingSubtitle] = useState(false);
  const [enableSmartSubtitle, setEnableSmartSubtitle] = useState(true);
  // 背景音乐相关状态
  const [backgroundBgm, setBackgroundBgm] = useState<string>('none');

  // ★ 公开音乐库相关状态
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [selectedLibraryTrack, setSelectedLibraryTrack] = useState<LibraryTrack | null>(null);

  // 自定义音频相关状态
  const [customAudio, setCustomAudio] = useState<{
    url: string;
    name: string;
    size: number;
  } | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  
  // 音频设置（来自StoryboardEditor）
  const [audioSettings, setAudioSettings] = useState<{
    enableVoiceNarration: boolean;
    voiceNarrationText: string;
    backgroundBgm: string;
  }>({
    enableVoiceNarration: true,
    voiceNarrationText: '',
    backgroundBgm: 'none',
  });
  
  // 智能去重：视频文字和字幕内容对比
  const [enableSmartDeduplication, setEnableSmartDeduplication] = useState(true);
  
  // 新字幕配置状态（包含字幕和视频文字）
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>({
    enabled: false,
    segments: [],
    style: DEFAULT_SUBTITLE_STYLE,
    styleMode: 'manual',
    generateVoice: false,
    voiceType: 'female',
    voiceLanguage: 'zh',
    speechSpeed: 1.0,
    // 视频文字相关配置（已整合到SubtitleEditor）
    enableVideoText: false,
    videoTextSegments: [],
    useMultiSegmentVideoText: false,
  });
  
  // 后台生成选项
  const [runInBackground, setRunInBackground] = useState(true);
  
  // 折叠/展开状态
  const [showBasicSettings, setShowBasicSettings] = useState(false);
  const [showPostSettings, setShowPostSettings] = useState(true);
  const [showCustomMode, setShowCustomMode] = useState(false);
  
  // 分段策略选择
  const [segmentStrategy, setSegmentStrategy] = useState<SegmentStrategyMode>(DEFAULT_STRATEGY_MODE);
  const [showSDKDetector, setShowSDKDetector] = useState(false);
  
  // 推荐模板相关状态
  const [selectedTemplate, setSelectedTemplate] = useState<GenerationTemplate | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(true);
  
  // 混合模式：传统表单 vs 节点编辑器
  const [editorMode, setEditorMode] = useState<'form' | 'node'>('form');
  
  // 视频生成模式：普通模式 vs 分镜头模式
  const [generationMode, setGenerationMode] = useState<'normal' | 'storyboard'>('normal');
  
  // 分镜头数据
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  
  // AI背景音乐推荐相关状态
  const [isRecommendingBgm, setIsRecommendingBgm] = useState(false);
  const [recommendedBgm, setRecommendedBgm] = useState<{
    id: string;
    name: string;
    reason: string;
  } | null>(null);
  
  // 使用ref存储最新的storyboard，确保在回调中可以获取最新值
  const storyboardRef = useRef<Storyboard | null>(null);
  
  // 同步storyboard到ref
  useEffect(() => {
    console.log('[VideoGenerationForm] storyboard updated, shots:', storyboard?.shots?.length || 0);
    storyboardRef.current = storyboard;
  }, [storyboard]);
  
  // 视频提示词生成器
  const [showPromptGenerator, setShowPromptGenerator] = useState(false);

  // 分析提示词中的文字内容
  const analyzePromptForText = useCallback((inputPrompt: string): { hasText: boolean; extractedText: string } => {
    if (!inputPrompt || !inputPrompt.trim()) {
      return { hasText: false, extractedText: '' };
    }

    const prompt = inputPrompt.trim();
    let extractedText = '';
    let hasText = false;

    // 1. 检查引号中的内容
    const quotePatterns = [
      /"([^"]+)"/g,           // 双引号
      /'([^']+)'/g,           // 单引号
      /「([^」]+)」/g,        // 中文直角引号
      /『([^』]+)』/g,        // 中文直角引号另一种
      /"([^"]+)"/g,
    ];

    const quotedTexts: string[] = [];
    for (const pattern of quotePatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(prompt)) !== null) {
        if (match[1] && match[1].trim()) {
          quotedTexts.push(match[1].trim());
        }
      }
    }

    if (quotedTexts.length > 0) {
      extractedText = quotedTexts.join(' ');
      hasText = true;
    }

    // 2. 如果没有引号内容，检查关键词模式
    if (!hasText) {
      const keywordPatterns = [
        /显示文字["“”'「」『』]*(.+?)["“”'「」『』]*/i,
        /显示["“”'「」『』]*(.+?)["“”'「」『』]*文字/i,
        /文字["“”'「」『』]*(.+?)["“”'「」『』]*/i,
        /字幕["“”'「」『』]*(.+?)["“”'「」『』]*/i,
        /写着["“”'「」『』]*(.+?)["“”'「」『』]*/i,
        /写有["“”'「」『』]*(.+?)["“”'「」『』]*/i,
        /写着：(.+?)(?:[。！!?]|$)/i,
        /显示：(.+?)(?:[。！!?]|$)/i,
      ];

      for (const pattern of keywordPatterns) {
        const match = prompt.match(pattern);
        if (match && match[1] && match[1].trim()) {
          extractedText = match[1].trim();
          hasText = true;
          break;
        }
      }
    }

    // 3. 如果还是没有，尝试简单的启发式方法
    if (!hasText) {
      // 检查是否包含常见的文字相关词汇
      const textKeywords = ['显示', '文字', '字幕', '写着', '写有', '写的是', '内容是', 'text', 'display', 'show', 'saying', 'written'];
      const hasTextKeyword = textKeywords.some(keyword => 
        prompt.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (hasTextKeyword) {
        // 如果有文字相关关键词，尝试提取整个提示词中可能的文字内容
        // 这里简化处理，直接使用整个提示词（去掉一些明显的描述性词汇）
        let candidateText = prompt
          .replace(/.*?(显示|文字|字幕|写着|写有|写的是|内容是|text|display|show|saying|written).*?[:：]?/i, '')
          .trim();
        
        if (candidateText && candidateText.length > 0 && candidateText.length <= 100) {
          extractedText = candidateText;
          hasText = true;
        }
      }
    }

    return { hasText, extractedText };
  }, []);

  // AI自动推荐背景音乐
  const recommendBgm = useCallback(async (promptText: string) => {
    if (!promptText || promptText.trim().length < 10) {
      setRecommendedBgm(null);
      return;
    }

    setIsRecommendingBgm(true);
    try {
      const response = await fetch('/api/prompt/bgm-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });
      
      const data = await response.json();
      
      if (data.success && data.recommendedBgm && data.recommendedBgm !== 'none') {
        setRecommendedBgm({
          id: data.recommendedBgm,
          name: data.bgmName || data.recommendedBgm,
          reason: data.reason || '',
        });
        // 自动设置背景音乐（仅当用户未手动选择时）
        if (backgroundBgm === 'none' || !backgroundBgm) {
          setBackgroundBgm(data.recommendedBgm);
        }
      } else {
        setRecommendedBgm(null);
      }
    } catch (error) {
      console.error('BGM推荐失败:', error);
      setRecommendedBgm(null);
    } finally {
      setIsRecommendingBgm(false);
    }
  }, [backgroundBgm]);

  // 监听提示词变化，自动分析并启用字幕
  useEffect(() => {
    if (!enableSmartSubtitle) {
      return;
    }

    const analysis = analyzePromptForText(prompt);
    
    if (analysis.hasText) {
      // 如果检测到文字，自动启用字幕并填充文字
      if (!enableSubtitle) {
        setEnableSubtitle(true);
      }
      if (!subtitleText || subtitleText !== analysis.extractedText) {
        setSubtitleText(analysis.extractedText);
      }
    }
  }, [prompt, enableSmartSubtitle, enableSubtitle, subtitleText, analyzePromptForText]);

  // 监听提示词变化，自动推荐背景音乐（防抖1.5秒）
  useEffect(() => {
    // 防抖：等待用户停止输入
    const timer = setTimeout(() => {
      if (generationMode === 'normal' && prompt && prompt.trim().length >= 15) {
        recommendBgm(prompt);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [prompt, generationMode, recommendBgm]);

  // 处理自定义音频上传
  const handleCustomAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac'];
    if (!validTypes.includes(file.type)) {
      alert('请上传音频文件（支持 MP3、WAV、OGG、M4A、AAC 格式）');
      return;
    }

    // 验证文件大小（限制50MB）
    if (file.size > 50 * 1024 * 1024) {
      alert('音频文件大小不能超过 50MB');
      return;
    }

    setIsUploadingAudio(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'audio');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.url) {
        setCustomAudio({
          url: data.url,
          name: file.name,
          size: file.size,
        });
        // 自动切换到自定义音频模式
        setBackgroundBgm('custom');
        setRecommendedBgm(null);
      } else {
        alert(data.error || '音频上传失败');
      }
    } catch (error) {
      console.error('音频上传失败:', error);
      alert('音频上传失败，请重试');
    } finally {
      setIsUploadingAudio(false);
    }
  };

  // 清除自定义音频
  const handleClearCustomAudio = () => {
    setCustomAudio(null);
    if (backgroundBgm === 'custom') {
      setBackgroundBgm('none');
    }
  };

  // 用于清理副作用的refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // 组件卸载时清理副作用
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // 取消正在进行的fetch请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // 清理setTimeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // 停止语音播放
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 加载初始配置
  useEffect(() => {
    if (initialConfig) {
      if (initialConfig.prompt) setPrompt(initialConfig.prompt);
      if (initialConfig.duration) setDuration(initialConfig.duration);
      if (initialConfig.style) setStyle(initialConfig.style);
      if (initialConfig.mood) setMood(initialConfig.mood);
      if (initialConfig.filter) setFilter(initialConfig.filter);
      if (initialConfig.resolution) setResolution(initialConfig.resolution);
      if (initialConfig.ratio) setRatio(initialConfig.ratio);
      if (initialConfig.colorTheme) setColorTheme(initialConfig.colorTheme);
      if (initialConfig.language) setLanguage(initialConfig.language);
      if (typeof initialConfig.smartEnhance === 'boolean') setSmartEnhance(initialConfig.smartEnhance);
      if (typeof initialConfig.watermark === 'boolean') setWatermark(initialConfig.watermark);
      if (typeof initialConfig.enableSubtitle === 'boolean') setEnableSubtitle(initialConfig.enableSubtitle);
      if (initialConfig.subtitlePosition) setSubtitlePosition(initialConfig.subtitlePosition);
      if (initialConfig.subtitleFontSize) setSubtitleFontSize(initialConfig.subtitleFontSize);
      if (initialConfig.subtitleColor) setSubtitleColor(initialConfig.subtitleColor);
      if (initialConfig.subtitleVoiceType) setSubtitleVoiceType(initialConfig.subtitleVoiceType);
      if (typeof initialConfig.subtitleSpeechSpeed === 'number') setSubtitleSpeechSpeed(initialConfig.subtitleSpeechSpeed);
      if (typeof initialConfig.generateVoice === 'boolean') setGenerateVoice(initialConfig.generateVoice);
      if (initialConfig.subtitleText) setSubtitleText(initialConfig.subtitleText);
      // 视频文字相关配置（从subtitleConfig获取）
      if (initialConfig.videoTextSegments) {
        setSubtitleConfig(prev => ({
          ...prev,
          enableVideoText: true,
          videoTextSegments: initialConfig.videoTextSegments || [],
          useMultiSegmentVideoText: Array.isArray(initialConfig.videoTextSegments) && initialConfig.videoTextSegments.length > 0,
        }));
      }
      if (Array.isArray(initialConfig.materials)) {
        // 处理 materials 可能是字符串数组或对象数组的情况
        const processedMaterials: Material[] = initialConfig.materials.map((m: any, index: number): Material | null => {
          if (typeof m === 'string') {
            // 如果是字符串URL，转换为 Material 对象
            const isVideo = m.match(/\.(mp4|webm|mov|avi)$/i);
            return {
              id: `material-${index}-${Date.now()}`,
              type: isVideo ? 'video' : 'image' as 'image' | 'video',
              url: m,
              name: isVideo ? `视频素材${index + 1}` : `图片素材${index + 1}`,
            };
          }
          // 如果已经是对象，确保有 id
          if (m && typeof m === 'object') {
            return {
              id: m.id || `material-${index}-${Date.now()}`,
              type: m.type || (m.url?.match(/\.(mp4|webm|mov|avi)$/i) ? 'video' : 'image'),
              url: m.url,
              name: m.name || `素材${index + 1}`,
            };
          }
          return null;
        }).filter((m): m is Material => m !== null);
        setMaterials(processedMaterials);
      }
    }
  }, [initialConfig]);

  // 加载 initialPrompt（当没有 initialConfig 或只需要更新提示词时）
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // 获取当前策略
  const currentStrategy = getCurrentStrategy(segmentStrategy);
  
  // ==================== 视频文字提取函数 ====================
  
  // 从提示词中提取文字内容
  const extractTextFromPrompt = useCallback((promptText: string): VideoTextSegment[] => {
    const segments: VideoTextSegment[] = [];
    const durationValue = parseInt(duration) || 10;
    
    let match;
    
    // 处理模式1：在X秒-Y秒显示"文字内容"
    const tempPrompt1 = promptText;
    const regex1 = /(\d+)秒[到至-](\d+)秒[\s，,]*显示[「\""「『](.+?)[」""」』]/g;
    while ((match = regex1.exec(tempPrompt1)) !== null) {
      if (match[3] && match[3].trim()) {
        segments.push({
          id: generateVideoTextSegmentId(),
          text: match[3].trim(),
          position: 'middle',
          startTime: parseInt(match[1]),
          endTime: parseInt(match[2]),
        });
      }
    }
    
    // 提取所有引号内的内容，按顺序分配时间
    if (segments.length === 0) {
      const quotedPattern = /[「\""「『](.+?)[」""」』]/g;
      const quotedTexts: string[] = [];
      const tempPrompt2 = promptText;
      while ((match = quotedPattern.exec(tempPrompt2)) !== null) {
        if (match[1] && match[1].trim()) {
          quotedTexts.push(match[1].trim());
        }
      }
      
      if (quotedTexts.length > 0) {
        quotedTexts.forEach((text, index) => {
          const segmentDuration = durationValue / quotedTexts.length;
          segments.push({
            id: generateVideoTextSegmentId(),
            text,
            position: 'middle',
            startTime: index * segmentDuration,
            endTime: (index + 1) * segmentDuration,
          });
        });
      }
    }
    
    return segments;
  }, [duration]);

  // 计算预计生成时间（秒）
  const calculateEstimatedTime = useCallback(() => {
    const durationValue = parseInt(duration) || 5;
    
    return calculateEstimatedTimeWithStrategy(durationValue, currentStrategy, {
      is1080p: resolution === '1080p',
      hasMaterials: materials.length > 0,
      hasSubtitle: enableSubtitle,
      hasVoice: generateVoice,
      useNineGrid: useNineGrid,
    });
  }, [duration, resolution, materials.length, enableSubtitle, generateVoice, useNineGrid, currentStrategy]);

  // 同步生成状态到父组件
  useEffect(() => {
    onGeneratingChange?.(isGenerating);
  }, [isGenerating, onGeneratingChange]);

  // 监听弹框状态变化（调试用）
  useEffect(() => {
    console.log('[EnhancedPrompt] 弹框状态变化', { 
      showEnhancedPromptModal, 
      originalPromptForModal, 
      enhancedPrompt 
    });
  }, [showEnhancedPromptModal, originalPromptForModal, enhancedPrompt]);

  const handleEnhancePrompt = async () => {
    console.log('[EnhancedPrompt] ===== 智能增强函数被调用 =====');
    console.log('[EnhancedPrompt] 当前 prompt:', prompt);
    
    if (!prompt.trim() || prompt.length < 2) {
      alert('请先输入至少2个字符的描述');
      return;
    }

    console.log('[EnhancedPrompt] 设置 isEnhancing = true');
    setIsEnhancing(true);
    
    try {
      console.log('[EnhancedPrompt] 开始请求 API...');
      const response = await fetch('/api/prompt/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt,
          sceneType: 'portrait', // 可根据实际场景类型传入
        }),
      });

      console.log('[EnhancedPrompt] 收到 API 响应', { status: response.status });

      const data = await response.json();
      console.log('[EnhancedPrompt] 解析响应数据', data);

      if (!response.ok) {
        throw new Error(data.error || '增强失败');
      }

      const finalEnhancedPrompt = data.enhancedPrompt;

      console.log('[EnhancedPrompt] 更新状态...');
      setEnhancedPrompt(finalEnhancedPrompt);
      setOriginalPromptForModal(prompt);
      
      console.log('[EnhancedPrompt] 准备打开弹框...');
      // 使用 setTimeout 确保状态更新完成后再打开弹框
      setTimeout(() => {
        console.log('[EnhancedPrompt] setTimeout 回调，打开弹框');
        setShowEnhancedPromptModal(true);
        console.log('[EnhancedPrompt] 弹框已打开');
      }, 50);
      
      if (onPromptEnhanced) {
        onPromptEnhanced(prompt, finalEnhancedPrompt);
      }
    } catch (error) {
      console.log('[EnhancedPrompt] 发生错误', error);
      // 出错时也用备用方案打开弹框
      const simpleEnhanced = `创作一部短视频，内容主题为：${prompt}。请确保画面清晰、构图精美、视觉效果出色，营造出专业的视频质感。`;
      console.log('[EnhancedPrompt] 使用备用方案', simpleEnhanced);
      setEnhancedPrompt(simpleEnhanced);
      setOriginalPromptForModal(prompt);
      
      setTimeout(() => {
        setShowEnhancedPromptModal(true);
      }, 50);
    } finally {
      console.log('[EnhancedPrompt] 进入 finally 块');
      setTimeout(() => {
        console.log('[EnhancedPrompt] 设置 isEnhancing = false');
        setIsEnhancing(false);
      }, 100);
    }
  };



  const handleApplyEnhancedFromModal = (appliedPrompt: string) => {
    setPrompt(appliedPrompt);
  };

  const handleStyleGenerated = (stylePrompt: string) => {
    if (prompt.trim()) {
      setPrompt(`${prompt}。${stylePrompt}`);
    } else {
      setPrompt(stylePrompt);
    }
  };

  const handleImitateStyle = (stylePrompt: string) => {
    // 仿写功能：直接替换描述内容
    setPrompt(stylePrompt);
  };

  // 应用视频模板
  const applyVideoTemplate = (template: GenerationTemplate) => {
    // 设置模板提示词
    setPrompt(template.promptTemplate.replace('{additional_details}', ''));
    
    // 设置风格参数
    if (template.style && template.style !== 'none') {
      setStyle(template.style);
    }
    if (template.mood && template.mood !== 'none') {
      setMood(template.mood);
    }
    if (template.filter && template.filter !== 'none') {
      setFilter(template.filter);
    }
    if (template.colorTheme && template.colorTheme !== 'none') {
      setColorTheme(template.colorTheme);
    }
    
    // 设置分辨率和比例
    if (template.resolution) {
      setResolution(template.resolution);
    }
    if (template.aspectRatio) {
      setRatio(template.aspectRatio);
    }
    if (template.duration) {
      setDuration(template.duration);
    }
    
    setSelectedTemplate(template);
    setShowTemplateSelector(false);
  };

  // 初始化多段文字的函数（已迁移到SubtitleEditor）
  useEffect(() => {
    // 视频文字相关逻辑已迁移到SubtitleEditor组件
  }, []);

  const getFinalPrompt = () => {
    // 只处理用户的原始提示词，添加风格、滤镜等增强
    // 注意：视频文字不再加入提示词，改为FFmpeg后期叠加
    let finalPrompt = prompt;
    
    // 检测复杂提示词（包含分镜描述或过长）
    const isComplexPrompt = prompt.length > 200 || 
                           prompt.includes('秒：') || 
                           prompt.includes('分镜') ||
                           /\d+-\d+秒/.test(prompt);
    
    // 如果启用了提示词优化且检测到复杂提示词，给出警告
    if (enablePromptOptimize && isComplexPrompt) {
      console.log('[Prompt Optimize] 检测到复杂提示词，建议：');
      console.log('1. 简化分镜描述');
      console.log('2. 使用分段生成功能（时长>5秒时自动启用）');
      console.log('3. 减少详细时间点的描述');
    }
    
    // 添加风格、滤镜、色调等增强
    if (style !== 'none' || mood !== 'none') {
      finalPrompt = generateEnhancedPrompt(finalPrompt, style, mood);
    }
    
    if (filter !== 'none') {
      finalPrompt = generateFilterPrompt(finalPrompt, filter);
    }
    
    if (colorTheme !== 'none') {
      finalPrompt = generateColorThemePrompt(finalPrompt, colorTheme);
    }
    
    return finalPrompt;
  };

  // AI生成字幕
  const handleGenerateSubtitleFromPrompt = async () => {
    if (!prompt.trim()) {
      alert('请先输入视频描述');
      return;
    }

    setIsGeneratingSubtitle(true);
    
    // 创建新的AbortController
    const subtitleAbortController = new AbortController();
    abortControllerRef.current = subtitleAbortController;
    
    try {
      const response = await fetch('/api/video/generate-subtitle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: subtitleAbortController.signal,
        body: JSON.stringify({
          prompt: getFinalPrompt(),
          duration: parseInt(duration),
          style: style !== 'none' ? style : undefined,
          mood: mood !== 'none' ? mood : undefined,
          language: language,
          generateSegments: true,
        }),
      });

      // 检查组件是否已卸载
      if (!isMountedRef.current) return;

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '生成失败');
      }

      setSubtitleText(data.subtitle);
      
      // 如果返回了分段信息，也更新新字幕配置
      if (data.segments && data.segments.length > 0) {
        setSubtitleConfig(prev => ({
          ...prev,
          enabled: true,
          segments: data.segments,
        }));
      }
    } catch (error) {
      // 检查是否是用户主动取消
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('字幕生成请求已取消');
        return;
      }
      if (isMountedRef.current) {
        alert(error instanceof Error ? error.message : '生成失败');
      }
    } finally {
      if (isMountedRef.current) {
        setIsGeneratingSubtitle(false);
      }
      abortControllerRef.current = null;
    }
  };

  // 字幕编辑器的AI生成函数
  const handleEditorAutoGenerate = async (): Promise<string> => {
    if (!prompt.trim()) {
      throw new Error('请先输入视频描述');
    }

    const response = await fetch('/api/video/generate-subtitle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: getFinalPrompt(),
        duration: parseInt(duration),
        style: style !== 'none' ? style : undefined,
        mood: mood !== 'none' ? mood : undefined,
        language: language,
        generateSegments: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '生成失败');
    }

    // 更新新字幕配置
    if (data.segments && data.segments.length > 0) {
      setSubtitleConfig(prev => ({
        ...prev,
        segments: data.segments,
      }));
    }

    return data.subtitle;
  };

  // 字幕配音试听
  const handlePlaySubtitleSpeech = () => {
    if (!subtitleText.trim()) return;

    if (isPlayingSubtitle) {
      window.speechSynthesis.cancel();
      setIsPlayingSubtitle(false);
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

    const utterance = new SpeechSynthesisUtterance(subtitleText);
    utterance.lang = langMap[language] || 'zh-CN';
    utterance.rate = subtitleSpeechSpeed;
    utterance.pitch = subtitleVoiceType === 'female' ? 1.1 : 0.9;

    utterance.onend = () => setIsPlayingSubtitle(false);
    utterance.onerror = () => setIsPlayingSubtitle(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingSubtitle(true);
  };

  // 显示确认弹窗
  const showConfirm = (config: {
    title: string;
    description: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }) => {
    setConfirmDialogConfig(config);
    setShowConfirmDialog(true);
  };

  // 显示信息提示弹窗
  const showAlert = (config: {
    title: string;
    description: string;
    onClose?: () => void;
  }) => {
    setAlertDialogConfig(config);
    setShowAlertDialog(true);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      showAlert({
        title: '提示',
        description: '请输入模板名称',
      });
      return;
    }

    const finalPrompt = getFinalPrompt();
    
    addTemplate({
      name: templateName,
      description: templateDescription,
      type: 'video',
      config: {
        prompt: finalPrompt,
        duration,
        style,
        mood,
        filter,
        colorTheme,
        resolution,
        ratio,
        smartEnhance,
        watermark,
      },
    });

    setShowSaveTemplateDialog(false);
    setTemplateName('');
    setTemplateDescription('');
    showAlert({
      title: '成功',
      description: '模板保存成功！',
    });
  };

  // 处理提示词生成器生成的提示词
  const handlePromptGenerated = (
    generatedPrompt: string,
    extraData?: {
      subtitleSegments?: Array<{ text: string; startTime: number; endTime: number }>;
      narrationScript?: string;
      shots?: any[];
    }
  ) => {
    if (generatedPrompt) {
      setPrompt(generatedPrompt);
    }

    // ★ v4.0: 处理字幕数据 → 应用到字幕编辑器（通过 subtitleConfig.segments）
    if (extraData?.subtitleSegments && extraData.subtitleSegments.length > 0) {
      console.log(`[PromptGenerator] 收到字幕建议 ${extraData.subtitleSegments.length} 段，应用到字幕编辑器`);
      const newSegments = extraData.subtitleSegments.map((seg, i) => ({
        id: `gen-sub-${Date.now()}-${i}`,
        text: seg.text,
        startTime: seg.startTime,
        endTime: seg.endTime,
      }));
      setSubtitleConfig(prev => ({
        ...prev,
        enabled: true,
        segments: newSegments,
      }));
      setEnableSubtitle(true);
    }

    // ★ v4.0: 处理旁白脚本 → 应用到旁白输入框（通过 audioSettings）
    if (extraData?.narrationScript && extraData.narrationScript.trim()) {
      console.log(`[PromptGenerator] 收到旁白脚本 ${extraData.narrationScript.length} 字，应用到旁白输入框`);
      setAudioSettings(prev => ({
        ...prev,
        enableVoiceNarration: true,
        voiceNarrationText: extraData.narrationScript!,
      }));
    }

    setShowPromptGenerator(false);
  };

  // 处理分镜头视频生成
  const handleGenerateStoryboardVideo = useCallback(async () => {
    console.log('[Storyboard] handleGenerateStoryboardVideo called');
    
    // 使用 ref 获取最新的 storyboard 数据
    const currentStoryboard = storyboardRef.current;
    console.log('[Storyboard] currentStoryboard:', currentStoryboard);
    console.log('[Storyboard] isGenerating:', isGenerating);
    
    if (!currentStoryboard) {
      console.error('[Storyboard] storyboard is null or undefined!');
      alert('分镜头数据为空，请先生成分镜头');
      return;
    }
    
    // 检查每个分镜头是否有prompt
    const emptyShots = currentStoryboard.shots.filter(shot => !shot.prompt || shot.prompt.trim() === '');
    if (emptyShots.length > 0) {
      console.error('[Storyboard] Some shots have empty prompts:', emptyShots.map(s => s.index));
      alert(`第${emptyShots.map(s => s.index + 1).join('、')}个分镜头的内容为空，请填写后再生成`);
      return;
    }
    
    console.log('[Storyboard] Starting video generation with:', {
      title: currentStoryboard.title,
      totalShots: currentStoryboard.shots.length,
      totalDuration: currentStoryboard.totalDuration,
      runInBackground: runInBackground
    });
    
    setIsGenerating(true);
    
    try {      
      // 创建分镜头任务
      console.log('[Storyboard] Submitting to /api/storyboard/submit');
      console.log('[Storyboard] 字幕启用:', enableSubtitle, '生成语音:', generateVoice, '字幕内容:', subtitleText);
      console.log('[Storyboard] 音频设置:', audioSettings);
      
      // 音频生成逻辑：
      // 1. 如果用户开启了语音旁白，使用用户填写的旁白文本或自动生成
      // 2. 如果用户关闭了语音旁白，不生成语音
      // 3. 背景音乐单独处理（目前仅记录选择，后续可以添加音乐生成）
      
      let audioEnabled = audioSettings.enableVoiceNarration;
      let audioPrompt: string | undefined;
      
      if (audioEnabled) {
        // 确定音频内容
        if (audioSettings.voiceNarrationText.trim()) {
          // 用户自定义了旁白文本
          audioPrompt = audioSettings.voiceNarrationText;
        } else if (enableSubtitle && subtitleText.trim()) {
          // 使用字幕文本
          audioPrompt = subtitleText;
        } else {
          // 自动基于分镜头描述生成配音内容
          const shotDescriptions = currentStoryboard.shots
            .map((shot, idx) => `${idx + 1}、${shot.prompt}`)
            .join('。');
          audioPrompt = `接下来为大家呈现一段精彩的视频：${shotDescriptions}`;
        }
      }
      
      const response = await fetch('/api/storyboard/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storyboard: currentStoryboard,
          async: runInBackground,
          // 音频和字幕参数
          audioEnabled: audioEnabled, // 根据语音旁白开关决定
          audioPrompt: audioPrompt,
          subtitleEnabled: enableSubtitle, // 字幕仅在用户开启时启用
          subtitlePrompt: enableSubtitle ? subtitleText : undefined,
          backgroundBgm: backgroundBgm, // 背景音乐
          customAudio: backgroundBgm === 'custom' ? customAudio : undefined, // 自定义音频
          libraryTrack: backgroundBgm === 'library' ? selectedLibraryTrack : undefined, // ★ 音乐库曲目
          // 全局九宫格图片（所有段共享）
          globalNineGridImages: useNineGrid ? userNineGridImages.filter(img => img) : undefined,
          qualityMode: qualityMode, // ★ 优化模式: fast/balanced/quality
          sfxConfig: sfxEnabled ? {
            enabled: true,
            mode: sfxMode,
            bindings: sfxBindings,
            globalVolume: sfxGlobalVolume,
          } : undefined, // ★ 特效音配置
        }),
      });

      console.log('[Storyboard] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Storyboard] API error:', errorText);
        throw new Error(`提交分镜头任务失败: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Storyboard] API response:', data);
      
      const { taskId } = data;
      
      if (runInBackground) {
        // 后台模式：添加任务到任务中心
        addTask({
          id: taskId,
          type: 'storyboard',
          status: 'running',
          config: {
            prompt: currentStoryboard.title || '分镜头视频',
            storyboardId: currentStoryboard.id,
            title: currentStoryboard.title,
            totalShots: currentStoryboard.shots.length,
            totalDuration: currentStoryboard.totalDuration,
          },
          progress: 5,
          stage: '初始化分镜头任务...',
        });
        
        console.log('[Storyboard Generation] Task added to task center:', taskId);
        
        alert('分镜头视频生成任务已提交！请前往任务中心查看进度');
      } else {
        // 同步模式（简化版）
        setIsGenerating(false);
        alert('分镜头视频生成已开始，请在任务中心查看');
      }
      
    } catch (error) {
      console.error('[Storyboard Generation] 分镜头视频生成失败:', error);
      alert('生成分镜头视频失败，请重试');
      setIsGenerating(false);
    }
  }, [runInBackground]);

  // 从节点编辑器导入数据
  const handleImportFromNodeEditor = () => {
    try {
      const saved = localStorage.getItem('node-editor-export');
      if (saved) {
        const exportData = JSON.parse(saved);
        
        if (exportData.prompt) {
          setPrompt(exportData.prompt);
        }
        
        if (exportData.duration) {
          setDuration(Math.min(exportData.duration, 10).toString());
        }
        
        alert('已从节点编辑器导入数据！');
      } else {
        alert('没有找到节点编辑器的数据，请先在节点编辑器中保存工作流');
      }
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败，请重试');
    }
  };

  // 导出到节点编辑器
  const handleExportToNodeEditor = () => {
    try {
      const exportData = {
        prompt,
        duration: parseInt(duration) || 5,
        exportedAt: new Date().toISOString(),
      };
      localStorage.setItem('video-form-export', JSON.stringify(exportData));
      alert('数据已导出！可在节点编辑器中加载');
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    }
  };

  const { handleSubmit } = useVideoGenerationSubmit({
    abortControllerRef,
    addTask,
    backgroundBgm,
    colorTheme,
    currentStrategy,
    customAudio,
    duration,
    enableSubtitle,
    filter,
    generateVoice,
    getFinalPrompt,
    isMountedRef,
    language,
    materials,
    mood,
    onGenerate,
    prompt,
    ratio,
    resolution,
    runInBackground,
    selectedLibraryTrack,
    setEnhancedPrompt,
    setGenerationMessage,
    setGenerationProgress,
    setGenerationStage,
    setIsGenerating,
    setPrompt,
    setRunInBackground,
    smartEnhance,
    style,
    subtitleColor,
    subtitleConfig,
    subtitleFontSize,
    subtitlePosition,
    subtitleSpeechSpeed,
    subtitleText,
    subtitleVoiceType,
    timeoutRef,
    updateTask,
    useNineGrid,
    userNineGridImages,
    watermark,
  });

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Video className="w-6 h-6" style={{ color: `var(--primary)` }} />
              视频配置
            </CardTitle>
            {/* 编辑器模式切换 + 生成模式切换（上下排列） */}
            <div className="flex flex-col items-end gap-1.5 mb-2">
              <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                <Button
                  type="button"
                  variant={editorMode === 'form' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setEditorMode('form')}
                  className={editorMode === 'form' ? 'bg-[#EF4444] text-black hover:bg-[#EF4444]/90' : ''}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  传统表单
                </Button>
                <Button
                  type="button"
                  variant={editorMode === 'node' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setEditorMode('node')}
                  className={editorMode === 'node' ? 'bg-[#EF4444] text-black hover:bg-[#EF4444]/90' : ''}
                >
                  <GitBranch className="w-4 h-4 mr-1" />
                  节点编辑器
                </Button>
              </div>
              {/* 普通/分镜头模式切换 - 仅在传统表单模式下显示，位于上方Tab之下 */}
              {editorMode === 'form' && (
                <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setGenerationMode('normal')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      generationMode === 'normal'
                        ? 'bg-red-500 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    普通模式
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenerationMode('storyboard')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      generationMode === 'storyboard'
                        ? 'bg-red-500 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    分镜头模式
                  </button>
                </div>
              )}
            </div>
          </div>
          <CardDescription>
            {editorMode === 'node' 
              ? '使用节点式工作流进行剧本、分镜和视频制作'
              : generationMode === 'storyboard'
                ? '创建分镜头提示词，每段不超过10秒，最后组合成超过10秒的视频'
                : '配置视频生成参数，选择风格、氛围和滤镜'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 传统表单模式 */}
          {editorMode === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 分镜头模式 */}
            {generationMode === 'storyboard' && (
              <div className="space-y-6">
                <StoryboardEditor
                  storyboard={storyboard || undefined}
                  onStoryboardChange={(newStoryboard) => {
                    setStoryboard(newStoryboard);
                  }}
                  onGenerate={() => {
                    // 直接使用handleGenerateStoryboardVideo，它会读取最新的storyboard状态
                    handleGenerateStoryboardVideo();
                  }}
                  onAudioSettingsChange={(settings) => {
                    setAudioSettings(settings);
                    setBackgroundBgm(settings.backgroundBgm);
                  }}
                  isGenerating={isGenerating}
                />
              </div>
            )}

            {/* 普通模式 */}
            {generationMode === 'normal' && (
              <>
                {/* 推荐模板 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">模板选择</Label>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                      className="flex items-center gap-1"
                    >
                      <Layers className="w-4 h-4" />
                      {showTemplateSelector ? '收起模板' : '查看模板'}
                    </Button>
                  </div>
              
              {showTemplateSelector && (
                <div className="space-y-4">
                  <Tabs defaultValue="preset" className="w-full">
                    <TabsList className="w-full max-w-xs">
                      <TabsTrigger value="preset" className="flex-1">推荐模板</TabsTrigger>
                      <TabsTrigger value="custom" className="flex-1">我的模板</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="preset" className="mt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {PRESET_VIDEO_TEMPLATES.map((template) => (
                          <div
                            key={template.id}
                            onClick={() => applyVideoTemplate(template)}
                            className={`rounded-xl border-2 cursor-pointer transition-all overflow-hidden ${
                              selectedTemplate?.id === template.id
                                ? 'border-[#EF4444] bg-[#EF4444]/10'
                                : 'border-border bg-accent/30 hover:border-white/20 hover:bg-accent'
                            }`}
                          >
                            {/* 模板预览图片 */}
                            {template.previewImage && (
                              <div className={`aspect-video bg-black overflow-hidden ${template.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'}`}>
                                <img
                                  src={template.previewImage}
                                  alt={template.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            
                            <div className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">🏔️</span>
                                  <h4 className="font-semibold text-foreground">{template.name}</h4>
                                </div>
                                {selectedTemplate?.id === template.id && (
                                  <Check className="w-5 h-5 text-[#EF4444]" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                              <div className="flex flex-wrap gap-1">
                                {template.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-xs px-2 py-0.5 bg-accent/50 rounded-full text-foreground/70"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="custom" className="mt-4">
                      <div className="text-center py-8 text-muted-foreground">
                        <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">还没有保存的模板</p>
                        <p className="text-sm">配置好参数后，点击「保存为模板」来创建您的自定义模板</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
              
              {selectedTemplate && (
                <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-[#EF4444]" />
                    <span className="text-[#EF4444]">已应用模板：{selectedTemplate.name}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="ml-auto h-7 text-xs"
                      onClick={() => setSelectedTemplate(null)}
                    >
                      清除
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt" className="text-base font-medium">
                  视频描述 <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <StyleReferenceModal
                    onStyleGenerated={handleStyleGenerated}
                    onImitateStyle={handleImitateStyle}
                    disabled={isGenerating}
                    type="video"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowPromptGenerator(true)}
                    disabled={isGenerating}
                    className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
                  >
                    <SparklesIcon className="w-4 h-4" />
                    提示词助手
                  </Button>
                </div>
              </div>
              <Textarea
                id="prompt"
                placeholder="描述你想要生成的视频内容，例如：一个阳光明媚的海边，海浪轻轻拍打着沙滩，海鸥在天空中翱翔..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[80px] text-sm bg-secondary text-foreground placeholder:text-foreground/70 border-border"
                disabled={isGenerating}
              />
              
              {/* 复杂提示词警告 */}
              {enablePromptOptimize && (prompt.length > 200 || prompt.includes('秒：') || /\d+-\d+秒/.test(prompt)) && (
                <div className="mt-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-800">
                      <p className="font-medium">检测到复杂提示词</p>
                      <p className="text-xs mt-1 text-red-700">
                        提示词包含详细分镜描述，可能导致生成超时（15分钟限制）。建议：
                      </p>
                      <ul className="text-xs mt-1 text-red-700 list-disc list-inside space-y-0.5">
                        <li>简化描述，突出主要场景和风格</li>
                        <li>选择「分段生成」模式（时长&gt;5秒时自动启用）</li>
                        <li>将复杂内容拆分为多个短片段分别生成</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                提示：选择风格、氛围和滤镜后，会自动添加到描述中。也可以使用「风格参考」功能上传参考图片。
              </p>


            </div>

            {/* 素材链接输入 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Link className="w-4 h-4" />
                素材链接
              </Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="输入图片或视频链接 URL，回车添加"
                  className="flex-1 bg-accent/30 border-border"
                  disabled={isGenerating}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const url = (e.target as HTMLInputElement).value.trim();
                      if (url && materials.length < 5) {
                        const isVideo = /\.(mp4|mov|avi|webm)(\?.*)?$/i.test(url);
                        setMaterials(prev => [...prev, { id: Date.now().toString(), type: isVideo ? 'video' : 'image', url, name: url.split('/').pop() || '素材' }]);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
              </div>
              {materials.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {materials.map((mat, idx) => (
                    <div key={mat.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-xs">
                      <span className="text-red-400">{mat.type === 'video' ? '🎬' : '🖼️'}</span>
                      <span className="text-foreground max-w-[180px] truncate">{mat.name || mat.url}</span>
                      <button
                        type="button"
                        onClick={() => setMaterials(prev => prev.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">支持图片/视频URL，最多5个素材</p>
            </div>

            {/* 后期参数：字幕、语音、音频、特效音 */}
            <Collapsible open={showPostSettings} onOpenChange={setShowPostSettings} className="space-y-0">
              <div className="flex items-center justify-between p-3 bg-accent/30 rounded-lg border border-border">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Film className="w-4 h-4" />
                  后期参数
                </h3>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <ChevronRight className={`h-4 w-4 transition-transform ${showPostSettings ? 'rotate-90' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent>
                <div className="p-4 bg-accent/30 rounded-lg border border-border border-t-0 rounded-t-none space-y-4">
                  {/* 时间轴式后期参数排列 */}
                  <div className="space-y-3">
                    {/* 列头 */}
                    <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] gap-2 text-xs text-muted-foreground font-medium px-1">
                      <span>时间</span>
                      <span>字幕</span>
                      <span>语音</span>
                      <span>音频</span>
                      <span>特效音</span>
                    </div>

                    {/* 按时间戳排列的后期参数行 */}
                    {(() => {
                      // 收集所有时间点
                      const timePoints = new Set<number>();
                      if (subtitleConfig.enabled && subtitleConfig.segments.length > 0) {
                        subtitleConfig.segments.forEach(s => {
                          timePoints.add(Math.floor(s.startTime));
                          if (s.endTime) timePoints.add(Math.floor(s.endTime));
                        });
                      }
                      // 添加BGM时间点
                      timePoints.add(0);
                      if (parseInt(duration) > 0) timePoints.add(parseInt(duration));

                      const sortedTimes = Array.from(timePoints).sort((a, b) => a - b);

                      if (sortedTimes.length <= 1 && !subtitleConfig.enabled) {
                        return (
                          <div className="text-center py-6 text-muted-foreground text-sm">
                            <p>启用字幕后，后期参数将按时间轴排列</p>
                            <p className="text-xs mt-1">字幕、语音、音频、特效音将按时间戳对齐展示</p>
                          </div>
                        );
                      }

                      return sortedTimes.map((time, idx) => {
                        const nextTime = sortedTimes[idx + 1];
                        // 查找当前时间段的字幕
                        const currentSubtitle = subtitleConfig.segments.find(
                          s => Math.floor(s.startTime) <= time && (s.endTime ? Math.floor(s.endTime) > time : true)
                        );
                        const timeLabel = `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`;

                        return (
                          <div key={time} className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] gap-2 items-start">
                            {/* 时间戳 */}
                            <span className="text-xs text-muted-foreground font-mono pt-1.5">{timeLabel}</span>

                            {/* 字幕 */}
                            <div className="min-h-[32px]">
                              {currentSubtitle ? (
                                <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs text-foreground">
                                  {currentSubtitle.text}
                                </div>
                              ) : (
                                <div className="px-2 py-1 bg-accent/30 border border-border rounded text-xs text-muted-foreground italic">
                                  —
                                </div>
                              )}
                            </div>

                            {/* 语音 */}
                            <div className="min-h-[32px]">
                              {currentSubtitle && generateVoice ? (
                                <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs text-foreground flex items-center gap-1">
                                  <Volume2 className="w-3 h-3" />
                                  {subtitleVoiceType || '默认'}
                                </div>
                              ) : (
                                <div className="px-2 py-1 bg-accent/30 border border-border rounded text-xs text-muted-foreground italic">
                                  —
                                </div>
                              )}
                            </div>

                            {/* 音频（BGM） */}
                            <div className="min-h-[32px]">
                              {backgroundBgm && backgroundBgm !== 'none' && time === 0 ? (
                                <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs text-foreground flex items-center gap-1">
                                  <Music className="w-3 h-3" />
                                  {backgroundBgm === 'custom' ? '自定义' : BGM_TYPES_V2[backgroundBgm as BgmTypeId]?.name || backgroundBgm}
                                </div>
                              ) : (
                                <div className="px-2 py-1 bg-accent/30 border border-border rounded text-xs text-muted-foreground italic">
                                  —
                                </div>
                              )}
                            </div>

                            {/* 特效音 */}
                            <div className="min-h-[32px]">
                              <div className="px-2 py-1 bg-accent/30 border border-border rounded text-xs text-muted-foreground italic">
                                —
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* 分隔线 */}
                  <div className="border-t border-border" />

                  {/* 字幕编辑器 - 完整编辑功能 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Subtitles className="w-4 h-4" />
                        字幕编辑
                      </Label>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={subtitleConfig.enabled}
                            onChange={(e) => {
                              const newConfig = { ...subtitleConfig, enabled: e.target.checked };
                              setSubtitleConfig(newConfig);
                              setEnableSubtitle(e.target.checked);
                            }}
                            className="rounded"
                          />
                          启用字幕
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={generateVoice}
                            onChange={(e) => setGenerateVoice(e.target.checked)}
                            className="rounded"
                          />
                          语音合成
                        </label>
                      </div>
                    </div>
                    <SubtitleEditor
                      config={subtitleConfig}
                      onChange={(newConfig) => {
                        setSubtitleConfig(newConfig);
                        setEnableSubtitle(newConfig.enabled);
                        if (newConfig.segments.length > 0) {
                          const fullText = newConfig.segments.map(s => s.text).join(' ');
                          setSubtitleText(fullText);
                        }
                        setSubtitlePosition(newConfig.style.position);
                        setSubtitleFontSize(newConfig.style.fontSize);
                        setSubtitleColor(newConfig.style.color);
                        setGenerateVoice(newConfig.generateVoice);
                        setSubtitleVoiceType(newConfig.voiceType);
                        setLanguage(newConfig.voiceLanguage);
                        setSubtitleSpeechSpeed(newConfig.speechSpeed);
                      }}
                      videoDuration={parseInt(duration)}
                      disabled={isGenerating}
                      onAutoGenerate={handleEditorAutoGenerate}
                      isGenerating={isGeneratingSubtitle}
                      videoPrompt={prompt}
                      referenceImageUrl={materials.length > 0 ? materials[0].url : undefined}
                    />
                  </div>

                  {/* 音频/BGM 选择 */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Music className="w-4 h-4" />
                      背景音乐
                      {recommendedBgm && backgroundBgm !== 'none' && backgroundBgm !== 'custom' && (
                        <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                          AI推荐
                        </span>
                      )}
                    </Label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                      {/* 无音乐选项 */}
                      <button
                        type="button"
                        onClick={() => { setBackgroundBgm('none'); setRecommendedBgm(null); }}
                        disabled={isGenerating}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                          backgroundBgm === 'none'
                            ? 'bg-red-500/20 border-red-400/50 ring-1 ring-red-400/30'
                            : 'bg-accent/30 border-border hover:bg-accent hover:border-white/20'
                        }`}
                      >
                        <span className="text-lg">🔇</span>
                        <span className="text-[10px] font-medium text-muted-foreground">无</span>
                      </button>

                      {/* 自定义选项 */}
                      <button
                        type="button"
                        onClick={() => setBackgroundBgm('custom')}
                        disabled={isGenerating}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                          backgroundBgm === 'custom'
                            ? 'bg-red-500/20 border-red-400/50 ring-1 ring-red-400/30'
                            : 'bg-accent/30 border-border hover:bg-accent hover:border-white/20'
                        }`}
                      >
                        <span className="text-lg">📁</span>
                        <span className={`text-[10px] font-medium ${backgroundBgm === 'custom' ? 'text-red-300' : 'text-muted-foreground'}`}>自定义</span>
                      </button>

                      {/* BGM类型卡片 */}
                      {getBgmTypeList().map((bgm) => (
                        <button
                          key={bgm.id}
                          type="button"
                          onClick={() => { setBackgroundBgm(bgm.id); }}
                          disabled={isGenerating}
                          title={`${bgm.name}: ${bgm.description}`}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                            backgroundBgm === bgm.id
                              ? 'bg-red-500/20 border-red-400/50 ring-1 ring-red-400/30'
                              : 'bg-accent/30 border-border hover:bg-accent hover:border-white/20'
                          }`}
                        >
                          <span className="text-base">{bgm.icon}</span>
                          <span className="text-[10px] font-medium leading-tight text-center line-clamp-1 text-muted-foreground">
                            {bgm.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 语音参数 */}
                  {generateVoice && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Volume2 className="w-4 h-4" />
                        语音参数
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">语音类型</Label>
                          <Select value={subtitleVoiceType} onValueChange={setSubtitleVoiceType} disabled={isGenerating}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="选择语音" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">男声</SelectItem>
                              <SelectItem value="female">女声</SelectItem>
                              <SelectItem value="child">童声</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">语速</Label>
                          <Select value={String(subtitleSpeechSpeed)} onValueChange={(v) => setSubtitleSpeechSpeed(Number(v))} disabled={isGenerating}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0.8">慢速</SelectItem>
                              <SelectItem value="1.0">正常</SelectItem>
                              <SelectItem value="1.2">快速</SelectItem>
                              <SelectItem value="1.5">极快</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <VideoGenerationSettingsPanel
              colorTheme={colorTheme}
              duration={duration}
              enablePromptOptimize={enablePromptOptimize}
              filter={filter}
              isGenerating={isGenerating}
              language={language}
              mood={mood}
              prompt={prompt}
              ratio={ratio}
              resolution={resolution}
              setColorTheme={setColorTheme}
              setDuration={setDuration}
              setEnablePromptOptimize={setEnablePromptOptimize}
              setFilter={setFilter}
              setLanguage={setLanguage}
              setMood={setMood}
              setOpenSelector={setOpenSelector}
              setPrompt={setPrompt}
              setRatio={setRatio}
              setResolution={setResolution}
              setShowBasicSettings={setShowBasicSettings}
              setShowCustomMode={setShowCustomMode}
              setShowPromptGenerator={setShowPromptGenerator}
              setSmartEnhance={setSmartEnhance}
              setUseNineGrid={setUseNineGrid}
              setUserNineGridImages={setUserNineGridImages}
              setWatermark={setWatermark}
              showBasicSettings={showBasicSettings}
              showCustomMode={showCustomMode}
              smartEnhance={smartEnhance}
              style={style}
              useNineGrid={useNineGrid}
              userNineGridImages={userNineGridImages}
              watermark={watermark}
            />

            <VideoGenerationSubmitPanel
              abortControllerRef={abortControllerRef}
              calculateEstimatedTime={calculateEstimatedTime}
              currentStrategy={currentStrategy}
              duration={duration}
              generationMessage={generationMessage}
              generationProgress={generationProgress}
              generationStage={generationStage}
              isGenerating={isGenerating}
              prompt={prompt}
              qualityMode={qualityMode}
              runInBackground={runInBackground}
              segmentStrategy={segmentStrategy}
              setQualityMode={setQualityMode}
              setRunInBackground={setRunInBackground}
              setSegmentStrategy={setSegmentStrategy}
              setSfxBindings={setSfxBindings}
              setSfxEnabled={setSfxEnabled}
              setSfxGlobalVolume={setSfxGlobalVolume}
              setSfxMode={setSfxMode}
              setShowSaveTemplateDialog={setShowSaveTemplateDialog}
              setShowSDKDetector={setShowSDKDetector}
              setShowSfxPanel={setShowSfxPanel}
              sfxBindings={sfxBindings}
              sfxEnabled={sfxEnabled}
              sfxGlobalVolume={sfxGlobalVolume}
              sfxMode={sfxMode}
              showSfxPanel={showSfxPanel}
              storyboard={storyboard}
              themeGradient={themeGradient}
              useNineGrid={useNineGrid}
            />
            </>
            )}
          </form>
          )}

          {/* 节点编辑器模式 */}
          {editorMode === 'node' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GitBranch className="w-6 h-6 text-[#EF4444]" />
                <div>
                  <h3 className="font-semibold text-foreground">节点式编辑器</h3>
                  <p className="text-sm text-muted-foreground">使用可视化工作流进行剧本、分镜和视频制作</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="default"
                  className="bg-[#EF4444] text-white hover:bg-red-600"
                  onClick={() => window.open('/node-editor', '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  打开节点编辑器
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={handleImportFromNodeEditor}
                >
                  <Layers className="w-4 h-4 mr-2" />
                  导入数据
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={handleExportToNodeEditor}
                >
                  <Save className="w-4 h-4 mr-2" />
                  导出数据
                </Button>
              </div>
            </div>
            <div className="border border-border rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 320px)', minHeight: 500 }}>
              <iframe 
                src="/node-editor" 
                className="w-full h-full border-0"
                title="节点编辑器"
              />
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Save Template Dialog */}
      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>保存为模板</DialogTitle>
            <DialogDescription>
              将当前配置保存为模板，方便以后快速使用
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">模板名称 <span className="text-red-500">*</span></Label>
              <Input
                id="template-name"
                placeholder="请输入模板名称"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="bg-secondary text-foreground placeholder:text-foreground/70 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">模板描述</Label>
              <Textarea
                id="template-description"
                placeholder="请输入模板描述（可选）"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                rows={3}
                className="bg-secondary text-foreground placeholder:text-foreground/70 border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowSaveTemplateDialog(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleSaveTemplate}
              disabled={!templateName.trim()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 风格选择弹窗 */}
      <OptionSelectorModal
        open={openSelector === 'style'}
        onOpenChange={(open) => setOpenSelector(open ? 'style' : null)}
        title="选择视频风格"
        description="选择一个风格来增强您的视频效果（已选过的不会再次显示）"
        options={STYLE_OPTIONS.map(opt => ({
          value: opt.value,
          label: opt.label,
          description: opt.description,
        }))}
        selectedValue={style}
        onSelect={(value) => {
          setStyle(value);
          setSelectedValuesHistory(prev => ({
            ...prev,
            style: [...(prev.style || []), value]
          }));
        }}
        excludeValues={selectedValuesHistory.style || []}
      />

      {/* 氛围选择弹窗 */}
      <OptionSelectorModal
        open={openSelector === 'mood'}
        onOpenChange={(open) => setOpenSelector(open ? 'mood' : null)}
        title="选择视频氛围"
        description="选择一个氛围来调整视频的情感基调（已选过的不会再次显示）"
        options={MOOD_OPTIONS.map(opt => ({
          value: opt.value,
          label: opt.label,
          description: opt.description,
        }))}
        selectedValue={mood}
        onSelect={(value) => {
          setMood(value);
          setSelectedValuesHistory(prev => ({
            ...prev,
            mood: [...(prev.mood || []), value]
          }));
        }}
        excludeValues={selectedValuesHistory.mood || []}
      />

      {/* 滤镜选择弹窗 */}
      <OptionSelectorModal
        open={openSelector === 'filter'}
        onOpenChange={(open) => setOpenSelector(open ? 'filter' : null)}
        title="选择视频滤镜"
        description="选择一个滤镜来改变视频的视觉效果（已选过的不会再次显示）"
        options={FILTER_OPTIONS.map(opt => ({
          value: opt.value,
          label: opt.label,
          description: opt.description,
        }))}
        selectedValue={filter}
        onSelect={(value) => {
          setFilter(value);
          setSelectedValuesHistory(prev => ({
            ...prev,
            filter: [...(prev.filter || []), value]
          }));
        }}
        excludeValues={selectedValuesHistory.filter || []}
      />

      {/* 色彩主题选择弹窗 */}
      <OptionSelectorModal
        open={openSelector === 'colorTheme'}
        onOpenChange={(open) => setOpenSelector(open ? 'colorTheme' : null)}
        title="选择色彩主题"
        description="选择一个色彩主题来统一视频的色调（已选过的不会再次显示）"
        options={COLOR_THEME_OPTIONS.map(opt => ({
          value: opt.id,
          label: opt.name,
          description: opt.swatches.length > 0 ? `色板: ${opt.swatches.join(', ')}` : '',
          icon: opt.icon,
        }))}
        selectedValue={colorTheme}
        onSelect={(value) => {
          setColorTheme(value);
          setSelectedValuesHistory(prev => ({
            ...prev,
            colorTheme: [...(prev.colorTheme || []), value]
          }));
        }}
        excludeValues={selectedValuesHistory.colorTheme || []}
      />

      {/* 智能增强弹窗 */}
      <EnhancedPromptModal
        open={showEnhancedPromptModal}
        onOpenChange={setShowEnhancedPromptModal}
        originalPrompt={originalPromptForModal}
        enhancedPrompt={enhancedPrompt}
        onApply={handleApplyEnhancedFromModal}
      />

      {/* 通用确认弹窗 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{confirmDialogConfig?.title || '确认'}</DialogTitle>
            {confirmDialogConfig?.description && (
              <DialogDescription className="whitespace-pre-line">
                {confirmDialogConfig.description}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                confirmDialogConfig?.onCancel?.();
                setShowConfirmDialog(false);
              }}
            >
              {confirmDialogConfig?.cancelText || '取消'}
            </Button>
            <Button
              type="button"
              onClick={() => {
                confirmDialogConfig?.onConfirm?.();
                setShowConfirmDialog(false);
              }}
            >
              {confirmDialogConfig?.confirmText || '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SDK检测器弹窗 */}
      <Dialog open={showSDKDetector} onOpenChange={setShowSDKDetector}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>SDK能力检测</DialogTitle>
            <DialogDescription>
              检测视频生成SDK支持的最长时长，帮助选择最佳的分段策略
            </DialogDescription>
          </DialogHeader>
          <SDKDetector 
            onStrategySelect={(strategy) => {
              setSegmentStrategy(strategy);
              setShowSDKDetector(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* 通用信息提示弹窗 */}
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{alertDialogConfig?.title || '提示'}</DialogTitle>
            {alertDialogConfig?.description && (
              <DialogDescription className="whitespace-pre-line">
                {alertDialogConfig.description}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                alertDialogConfig?.onClose?.();
                setShowAlertDialog(false);
              }}
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 视频提示词生成器 */}
      <Dialog open={showPromptGenerator} onOpenChange={setShowPromptGenerator}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <SparklesIcon className="w-6 h-6 text-[#EF4444]" />
              视频提示词生成助手
            </DialogTitle>
            <DialogDescription>
              基于专业的视频提示词方法库和100个运镜方法，帮助您快速生成高质量提示词
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <VideoPromptGenerator 
              onPromptGenerated={handlePromptGenerated}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ★ 公开音乐库浏览器 */}
      <MusicLibraryBrowser
        open={showMusicLibrary}
        onClose={() => setShowMusicLibrary(false)}
        onSelectTrack={(track) => {
          setSelectedLibraryTrack(track);
          setBackgroundBgm('library');
          setShowMusicLibrary(false);
        }}
        selectedId={selectedLibraryTrack?.id}
      />

    </div>
  );
}
