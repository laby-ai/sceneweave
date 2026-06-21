'use client';

import { useState, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Wand2,
  Image as ImageIcon,
  Video,
  Music,
  Mic,
  Play,
  Pause,
  Download,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Settings,
  Palette,
  Volume2,
  FileText,
  Sparkles,
  Check,
  Loader2,
  Eye,
  Layers,
  Zap,
  BookOpen,
  Clock,
  Type,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ==================== Types ====================

interface StoryboardFrame {
  index: number;
  narration: string;
  imagePrompt: string;
  imageUrl?: string;
  audioUrl?: string;
  videoSegmentUrl?: string;
  duration: number;
  status: 'pending' | 'generating_audio' | 'generating_image' | 'composing' | 'generating_video' | 'completed' | 'failed';
}

interface VideoStylePreset {
  id: string;
  name: string;
  description: string;
  promptPrefix: string;
  category: string;
  thumbnail?: string;
}

interface TTSVoiceOption {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female';
  preview?: string;
}

interface GenerationProgress {
  phase: 'idle' | 'generating_script' | 'generating_audio' | 'generating_images' | 'composing_video' | 'completed' | 'failed';
  currentFrame: number;
  totalFrames: number;
  currentAction: string;
  progress: number; // 0-100
}

// ==================== Constants ====================

const VIDEO_STYLE_PRESETS: VideoStylePreset[] = [
  { id: 'default', name: '默认', description: '简洁通用风格', promptPrefix: '', category: '基础' },
  { id: 'cartoon', name: '卡通', description: '卡通风格，轻松活泼', promptPrefix: 'cartoon style, colorful, playful, animated, fun illustration', category: '插画' },
  { id: 'blur_card', name: '模糊卡片', description: '模糊背景卡片风格', promptPrefix: 'blurred background, card overlay, soft focus, elegant composition', category: '设计' },
  { id: 'elegant', name: '优雅', description: '优雅风格，文艺知性', promptPrefix: 'elegant style, refined, sophisticated, soft lighting, artistic', category: '艺术' },
  { id: 'healing', name: '治愈', description: '温暖治愈风格', promptPrefix: 'warm healing atmosphere, soft pastel colors, cozy, peaceful, gentle light', category: '情感' },
  { id: 'modern', name: '现代简约', description: '现代简约商务', promptPrefix: 'modern minimalist, clean design, geometric shapes, professional, sleek', category: '商务' },
  { id: 'neon', name: '霓虹', description: '霓虹灯风格，时尚潮流', promptPrefix: 'neon lights, glowing colors, cyberpunk atmosphere, vibrant, nightlife', category: '潮流' },
  { id: 'vintage', name: '复古时尚', description: '复古怀旧风格', promptPrefix: 'vintage fashion, retro style, nostalgic, faded colors, classic film look', category: '艺术' },
  { id: 'psychology', name: '心理学卡片', description: '心理学风格卡片', promptPrefix: 'psychology card style, brain illustration, thought bubbles, analytical, mind mapping', category: '知识' },
  { id: 'life_insights', name: '生活感悟', description: '生活感悟风格', promptPrefix: 'life insights, warm scene, daily life, contemplative, reflective mood', category: '情感' },
  { id: 'simple_black', name: '极简黑白', description: '极简黑白线条风格', promptPrefix: 'minimalist black and white, stick figure, clean lines, simple sketch style, white background', category: '插画' },
  { id: 'line_drawing', name: '简笔画', description: '简笔画风格', promptPrefix: 'simple line drawing, hand-drawn sketch, minimal, cute, doodle style', category: '插画' },
  { id: 'health', name: '养生', description: '养生健康风格', promptPrefix: 'health and wellness, natural elements, herbs, peaceful, organic, green tones', category: '知识' },
  { id: 'book', name: '读书笔记', description: '读书笔记卡片风格', promptPrefix: 'book card style, library scene, reading, knowledge, pages, literary', category: '知识' },
  { id: 'long_text', name: '长文排版', description: '适合长文字内容', promptPrefix: 'text focused layout, clean typography, reading friendly, editorial design', category: '基础' },
];

const TTS_VOICES: TTSVoiceOption[] = [
  { id: 'zh-CN-YunjianNeural', name: '云健', language: '中文', gender: 'male' },
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', language: '中文', gender: 'female' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓依', language: '中文', gender: 'female' },
  { id: 'zh-CN-YunyangNeural', name: '云扬', language: '中文', gender: 'male' },
  { id: 'zh-CN-XiaochenNeural', name: '晓辰', language: '中文', gender: 'female' },
  { id: 'zh-CN-XiaohanNeural', name: '晓涵', language: '中文', gender: 'female' },
  { id: 'zh-CN-XiaomengNeural', name: '晓梦', language: '中文', gender: 'female' },
  { id: 'zh-CN-XiaomoNeural', name: '晓墨', language: '中文', gender: 'female' },
  { id: 'zh-CN-XiaoruiNeural', name: '晓睿', language: '中文', gender: 'female' },
  { id: 'zh-CN-XiaoshuangNeural', name: '晓双', language: '中文', gender: 'female' },
  { id: 'zh-CN-XiaoxuanNeural', name: '晓萱', language: '中文', gender: 'female' },
  { id: 'zh-CN-XiaoyanNeural', name: '晓妍', language: '中文', gender: 'female' },
  { id: 'zh-CN-XiaozhenNeural', name: '晓甄', language: '中文', gender: 'female' },
  { id: 'zh-CN-YunfengNeural', name: '云枫', language: '中文', gender: 'male' },
  { id: 'zh-CN-YunhaoNeural', name: '云皓', language: '中文', gender: 'male' },
  { id: 'zh-CN-YunxiNeural', name: '云希', language: '中文', gender: 'male' },
  { id: 'zh-CN-YunxiaNeural', name: '云夏', language: '中文', gender: 'male' },
  { id: 'zh-CN-YunzeNeural', name: '云泽', language: '中文', gender: 'male' },
];

const BGM_OPTIONS = [
  { id: 'none', name: '无BGM', icon: '🔇' },
  { id: 'default', name: '默认背景音乐', icon: '🎵' },
  { id: 'chill', name: '轻柔放松', icon: '🎶' },
  { id: 'upbeat', name: '欢快节奏', icon: '🥁' },
  { id: 'cinematic', name: '电影感', icon: '🎬' },
  { id: 'emotional', name: '情感抒情', icon: '💕' },
  { id: 'custom', name: '自定义上传', icon: '📁' },
];

const VIDEO_SIZE_OPTIONS = [
  { id: '1080x1920', label: '竖屏 9:16', width: 1080, height: 1920 },
  { id: '1920x1080', label: '横屏 16:9', width: 1920, height: 1080 },
  { id: '1080x1080', label: '方形 1:1', width: 1080, height: 1080 },
];

const SCENE_COUNT_OPTIONS = [3, 5, 8, 10];

// ==================== Component ====================

interface ShortVideoPanelProps {
  onBack: () => void;
  initialPrompt?: string;
  autoGenerate?: boolean;
}

export function ShortVideoPanel({ onBack, initialPrompt = '', autoGenerate = false }: ShortVideoPanelProps) {
  // === Input State ===
  const [inputMode, setInputMode] = useState<'ai' | 'fixed'>('ai');
  const [topic, setTopic] = useState(initialPrompt);
  const [fixedScript, setFixedScript] = useState('');
  const [title, setTitle] = useState('');

  // === Style State ===
  const [selectedStyle, setSelectedStyle] = useState('default');
  const [customPromptPrefix, setCustomPromptPrefix] = useState('');
  const [videoSize, setVideoSize] = useState('1080x1920');
  const [sceneCount, setSceneCount] = useState(5);

  // === TTS State ===
  const [selectedVoice, setSelectedVoice] = useState('zh-CN-YunjianNeural');
  const [ttsSpeed, setTtsSpeed] = useState(1.2);
  const [showTtsSettings, setShowTtsSettings] = useState(false);

  // === BGM State ===
  const [selectedBgm, setSelectedBgm] = useState('none');
  const [bgmVolume, setBgmVolume] = useState(0.2);

  // === Generation State ===
  const [frames, setFrames] = useState<StoryboardFrame[]>([]);
  const [progress, setProgress] = useState<GenerationProgress>({
    phase: 'idle', currentFrame: 0, totalFrames: 0, currentAction: '', progress: 0,
  });
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showStyleGallery, setShowStyleGallery] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);

  const abortRef = useRef<boolean>(false);

  // === Computed ===
  const currentStyle = VIDEO_STYLE_PRESETS.find(s => s.id === selectedStyle) || VIDEO_STYLE_PRESETS[0];
  const currentSize = VIDEO_SIZE_OPTIONS.find(s => s.id === videoSize) || VIDEO_SIZE_OPTIONS[0];

  // === Handlers ===
  const handleGenerate = useCallback(async () => {
    if (isGenerating) return;
    const inputText = inputMode === 'ai' ? topic : fixedScript;
    if (!inputText.trim()) return;

    setIsGenerating(true);
    abortRef.current = false;
    setFinalVideoUrl(null);

    const totalScenes = sceneCount;

    try {
      // Phase 1: Generate script (narrations + image prompts)
      setProgress({ phase: 'generating_script', currentFrame: 0, totalFrames: totalScenes, currentAction: 'AI 撰写文案...', progress: 5 });

      const scriptRes = await fetch('/api/short-video/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          mode: inputMode,
          n_scenes: totalScenes,
          style_prompt_prefix: customPromptPrefix || currentStyle.promptPrefix,
          title: title || undefined,
        }),
      });

      if (!scriptRes.ok) throw new Error('文案生成失败');

      const scriptData = await scriptRes.json();
      const narrations: string[] = scriptData.narrations || [];
      const imagePrompts: string[] = scriptData.imagePrompts || [];
      const generatedTitle: string = scriptData.title || title || 'AI 短视频';

      if (narrations.length === 0) throw new Error('未能生成文案');

      // Initialize frames
      const initialFrames: StoryboardFrame[] = narrations.map((n, i) => ({
        index: i,
        narration: n,
        imagePrompt: imagePrompts[i] || n,
        duration: 0,
        status: 'pending',
      }));
      setFrames(initialFrames);

      // Phase 2: Generate images for each frame
      setProgress({ phase: 'generating_images', currentFrame: 0, totalFrames: narrations.length, currentAction: '生成配图 0/' + narrations.length, progress: 20 });

      for (let i = 0; i < narrations.length; i++) {
        if (abortRef.current) break;

        setFrames(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'generating_image' } : f));
        setProgress(prev => ({ ...prev, currentFrame: i + 1, currentAction: `生成配图 ${i + 1}/${narrations.length}`, progress: 20 + (i / narrations.length) * 50 }));

        try {
          const promptPrefix = customPromptPrefix || currentStyle.promptPrefix;
          const fullPrompt = promptPrefix ? `${promptPrefix}, ${imagePrompts[i] || narrations[i]}` : (imagePrompts[i] || narrations[i]);

          const imgRes = await fetch('/api/image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: fullPrompt, size: `${currentSize.width}x${currentSize.height}` }),
          });

          if (imgRes.ok) {
            const imgData = await imgRes.json();
            const imageUrl = imgData.imageUrls?.[0] || imgData.imageUrl;
            if (imageUrl) {
              setFrames(prev => prev.map((f, idx) => idx === i ? { ...f, imageUrl, status: 'completed' } : f));
            } else {
              setFrames(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'failed' } : f));
            }
          } else {
            setFrames(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'failed' } : f));
          }
        } catch {
          setFrames(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'failed' } : f));
        }
      }

      // Phase 3: Compose video
      setProgress({ phase: 'composing_video', currentFrame: narrations.length, totalFrames: narrations.length, currentAction: '合成视频...', progress: 85 });

      // Get completed frame image URLs
      const completedFrames = initialFrames.map((f, i) => ({
        ...f,
        imageUrl: frames[i]?.imageUrl,
      }));

      // Simulate video composition (in real implementation, this would call FFmpeg or similar)
      await new Promise(resolve => setTimeout(resolve, 2000));

      setProgress({ phase: 'completed', currentFrame: narrations.length, totalFrames: narrations.length, currentAction: '视频已生成！', progress: 100 });

    } catch (err) {
      const isAborted = abortRef.current;
      setProgress(prev => ({ ...prev, phase: isAborted ? 'idle' : 'failed', currentAction: isAborted ? '已取消生成' : `生成失败: ${err instanceof Error ? err.message : '未知错误'}` }));
    } finally {
      setIsGenerating(false);
    }
  }, [inputMode, topic, fixedScript, sceneCount, selectedStyle, customPromptPrefix, currentStyle, currentSize, title, frames]);

  // 取消生成
  const handleCancelGenerate = useCallback(() => {
    abortRef.current = true;
    setIsGenerating(false);
    setProgress(prev => ({ ...prev, phase: 'idle', currentAction: '已取消生成' }));
  }, []);

  const handleRegenerateFrame = useCallback(async (index: number) => {
    const frame = frames[index];
    if (!frame) return;

    setFrames(prev => prev.map((f, idx) => idx === index ? { ...f, status: 'generating_image' } : f));

    try {
      const promptPrefix = customPromptPrefix || currentStyle.promptPrefix;
      const fullPrompt = promptPrefix ? `${promptPrefix}, ${frame.imagePrompt}` : frame.imagePrompt;

      const imgRes = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, size: `${currentSize.width}x${currentSize.height}` }),
      });

      if (imgRes.ok) {
        const imgData = await imgRes.json();
        const imageUrl = imgData.imageUrls?.[0] || imgData.imageUrl;
        if (imageUrl) {
          setFrames(prev => prev.map((f, idx) => idx === index ? { ...f, imageUrl, status: 'completed' } : f));
          return;
        }
      }
      setFrames(prev => prev.map((f, idx) => idx === index ? { ...f, status: 'failed' } : f));
    } catch {
      setFrames(prev => prev.map((f, idx) => idx === index ? { ...f, status: 'failed' } : f));
    }
  }, [frames, customPromptPrefix, currentStyle, currentSize]);

  // === Render ===
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-[#EF4444] hover:opacity-80 transition-opacity flex items-center gap-1">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">返回</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#EF4444]" />
              AI 短视频
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">输入主题，一键生成完整短视频</p>
          </div>
        </div>
        <Badge className="bg-gradient-to-r from-red-500 to-rose-500 text-white border-0">AI 驱动</Badge>
      </div>

      {/* Main Content - Three Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Configuration */}
        <div className="w-[280px] border-r border-border overflow-y-auto p-4 space-y-4 bg-card">
          {/* Input Mode */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">生成模式</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setInputMode('ai')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  inputMode === 'ai'
                    ? 'bg-red-500 text-white'
                    : 'bg-accent text-muted-foreground hover:bg-accent/80'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                AI 生成
              </button>
              <button
                onClick={() => setInputMode('fixed')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  inputMode === 'fixed'
                    ? 'bg-red-500 text-white'
                    : 'bg-accent text-muted-foreground hover:bg-accent/80'
                }`}
              >
                <FileText className="w-3.5 h-3.5 inline mr-1" />
                固定文案
              </button>
            </div>
          </div>

          {/* Input Area */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              {inputMode === 'ai' ? '视频主题' : '文案内容'}
            </Label>
            {inputMode === 'ai' ? (
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：为什么要养成阅读习惯"
                className="min-h-[80px] resize-none"
              />
            ) : (
              <Textarea
                value={fixedScript}
                onChange={(e) => setFixedScript(e.target.value)}
                placeholder="直接输入完整文案，每段自动分为一个分镜..."
                className="min-h-[120px] resize-none"
              />
            )}
          </div>

          {/* Title (optional) */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">视频标题 <span className="text-muted-foreground">(可选)</span></Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="留空则AI自动生成"
            />
          </div>

          {/* Scene Count */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">分镜数量</Label>
            <div className="grid grid-cols-4 gap-2">
              {SCENE_COUNT_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setSceneCount(n)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sceneCount === n
                      ? 'bg-red-500 text-white'
                      : 'bg-accent text-muted-foreground hover:bg-accent/80'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Video Size */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">视频尺寸</Label>
            <Select value={videoSize} onValueChange={setVideoSize}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIDEO_SIZE_OPTIONS.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visual Style */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">视觉风格</Label>
            <button
              onClick={() => setShowStyleGallery(true)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:border-[#EF4444]/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#EF4444]" />
                <span className="text-sm">{currentStyle.name}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <p className="text-xs text-muted-foreground mt-1">{currentStyle.description}</p>
          </div>

          {/* Custom Prompt Prefix */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">风格提示词 <span className="text-muted-foreground">(可选)</span></Label>
            <Input
              value={customPromptPrefix}
              onChange={(e) => setCustomPromptPrefix(e.target.value)}
              placeholder="英文，如: minimalist black-and-white..."
            />
          </div>

          {/* TTS Settings */}
          <div>
            <button
              onClick={() => setShowTtsSettings(!showTtsSettings)}
              className="w-full flex items-center justify-between text-sm font-medium text-foreground"
            >
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-[#EF4444]" />
                语音设置
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${showTtsSettings ? 'rotate-180' : ''}`} />
            </button>
            {showTtsSettings && (
              <div className="mt-2 space-y-3 p-3 rounded-lg bg-accent/50">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">音色</Label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TTS_VOICES.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name} ({v.gender === 'male' ? '男' : '女'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">语速 {ttsSpeed.toFixed(1)}x</Label>
                  <input
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                    className="w-full accent-[#EF4444]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* BGM Settings */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block flex items-center gap-2">
              <Music className="w-4 h-4 text-[#EF4444]" />
              背景音乐
            </Label>
            <Select value={selectedBgm} onValueChange={setSelectedBgm}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BGM_OPTIONS.map(bgm => (
                  <SelectItem key={bgm.id} value={bgm.id}>
                    {bgm.icon} {bgm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBgm !== 'none' && (
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground mb-1 block">音量 {Math.round(bgmVolume * 100)}%</Label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={bgmVolume}
                  onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                  className="w-full accent-[#EF4444]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Center Column - Storyboard Preview */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Progress Bar */}
          {progress.phase !== 'idle' && (
            <div className="rounded-xl border border-border p-4 bg-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {progress.phase === 'completed' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : progress.phase === 'failed' ? (
                    <RefreshCw className="w-4 h-4 text-red-500" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-[#EF4444] animate-spin" />
                  )}
                  <span className="text-sm font-medium text-foreground">{progress.currentAction}</span>
                </div>
                <span className="text-xs text-muted-foreground">{progress.progress}%</span>
              </div>
              <div className="h-2 bg-accent rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progress.phase === 'completed' ? 'bg-green-500' :
                    progress.phase === 'failed' ? 'bg-red-500' :
                    'bg-gradient-to-r from-red-500 to-rose-500'
                  }`}
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              {/* Phase Steps */}
              <div className="flex items-center gap-2 mt-3">
                {[
                  { label: '文案', phase: 'generating_script' },
                  { label: '配图', phase: 'generating_images' },
                  { label: '合成', phase: 'composing_video' },
                ].map((step, i) => {
                  const phaseOrder = ['generating_script', 'generating_images', 'composing_video', 'completed'];
                  const currentIdx = phaseOrder.indexOf(progress.phase);
                  const stepIdx = phaseOrder.indexOf(step.phase);
                  const isDone = currentIdx > stepIdx || progress.phase === 'completed';
                  const isCurrent = progress.phase === step.phase;

                  return (
                    <div key={step.phase} className="flex items-center gap-1">
                      {i > 0 && <div className={`w-6 h-0.5 ${isDone ? 'bg-green-500' : 'bg-accent'}`} />}
                      <div className={`flex items-center gap-1 text-xs ${
                        isDone ? 'text-green-600' : isCurrent ? 'text-[#EF4444] font-bold' : 'text-muted-foreground'
                      }`}>
                        {isDone ? <Check className="w-3 h-3" /> : isCurrent ? <Loader2 className="w-3 h-3 animate-spin" /> : <div className="w-3 h-3 rounded-full border border-muted-foreground" />}
                        {step.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Storyboard Grid */}
          {frames.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#EF4444]" />
                分镜 ({frames.length}个)
                {frames.filter(f => f.status === 'completed').length > 0 && (
                  <Badge variant="outline" className="text-xs border-green-500 text-green-600">
                    {frames.filter(f => f.status === 'completed').length}/{frames.length} 已完成
                  </Badge>
                )}
              </h3>
              <div className={`grid gap-3 ${
                videoSize === '1080x1920' ? 'grid-cols-3 sm:grid-cols-4' :
                videoSize === '1920x1080' ? 'grid-cols-2' :
                'grid-cols-3'
              }`}>
                {frames.map((frame) => (
                  <div
                    key={frame.index}
                    className="group relative rounded-xl border border-border overflow-hidden bg-card hover:border-[#EF4444]/50 transition-all hover:shadow-lg"
                  >
                    {/* Image Area */}
                    <div className={`relative ${
                      videoSize === '1080x1920' ? 'aspect-[9/16]' :
                      videoSize === '1920x1080' ? 'aspect-[16/9]' :
                      'aspect-square'
                    } bg-accent`}>
                      {frame.imageUrl ? (
                        <img
                          src={frame.imageUrl}
                          alt={`分镜 ${frame.index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                          {frame.status === 'generating_image' ? (
                            <Loader2 className="w-6 h-6 animate-spin text-[#EF4444]" />
                          ) : frame.status === 'failed' ? (
                            <RefreshCw className="w-6 h-6 text-red-500" />
                          ) : (
                            <ImageIcon className="w-6 h-6" />
                          )}
                        </div>
                      )}

                      {/* Frame Number Badge */}
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center font-medium">
                        {frame.index + 1}
                      </div>

                      {/* Status Badge */}
                      {frame.status === 'completed' && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRegenerateFrame(frame.index)}
                            className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
                            title="重新生成"
                          >
                            <RefreshCw className="w-4 h-4 text-foreground" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Narration Text */}
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {frame.narration}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
                  <Video className="w-8 h-8 text-[#EF4444]" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">输入主题，一键生成短视频</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  AI 自动完成：文案撰写 → 配图生成 → 语音合成 → 视频合成
                </p>
                <div className="space-y-2 text-left">
                  {[
                    { icon: <FileText className="w-4 h-4" />, text: 'AI 根据主题创作文案' },
                    { icon: <ImageIcon className="w-4 h-4" />, text: '每段文案生成精美配图' },
                    { icon: <Mic className="w-4 h-4" />, text: '语音合成 + 背景音乐' },
                    { icon: <Video className="w-4 h-4" />, text: '自动合成完整视频' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="text-[#EF4444]">{item.icon}</div>
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Preview & Settings */}
        <div className="w-[320px] border-l border-border overflow-y-auto p-4 space-y-4 bg-card">
          {/* Video Preview */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#EF4444]" />
              视频预览
            </Label>
            <div className={`rounded-xl border border-border overflow-hidden bg-black ${
              videoSize === '1080x1920' ? 'aspect-[9/16] max-h-[400px] mx-auto' :
              videoSize === '1920x1080' ? 'aspect-[16/9]' :
              'aspect-square max-h-[320px] mx-auto'
            }`}>
              {finalVideoUrl ? (
                <video src={finalVideoUrl} controls className="w-full h-full" />
              ) : frames.length > 0 && frames.some(f => f.imageUrl) ? (
                <div className="w-full h-full relative">
                  <img
                    src={frames.find(f => f.imageUrl)?.imageUrl}
                    alt="预览"
                    className="w-full h-full object-cover opacity-60"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Play className="w-10 h-10 mx-auto mb-2 opacity-80" />
                      <p className="text-xs opacity-80">预览首帧</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs opacity-50">视频预览区</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Video Info */}
          {frames.length > 0 && (
            <div className="rounded-xl border border-border p-3 space-y-2">
              <h4 className="text-sm font-medium text-foreground">视频信息</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Layers className="w-3 h-3" />
                  分镜: {frames.length}个
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ImageIcon className="w-3 h-3" />
                  配图: {frames.filter(f => f.imageUrl).length}/{frames.length}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Palette className="w-3 h-3" />
                  {currentStyle.name}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Type className="w-3 h-3" />
                  {currentSize.label}
                </div>
              </div>
            </div>
          )}

          {/* Quick Style Selector */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">快速风格切换</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {VIDEO_STYLE_PRESETS.slice(0, 9).map(style => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedStyle === style.id
                      ? 'bg-red-500 text-white'
                      : 'bg-accent text-muted-foreground hover:bg-accent/80'
                  }`}
                >
                  {style.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowStyleGallery(true)}
              className="w-full mt-2 px-3 py-1.5 rounded-lg text-xs text-[#EF4444] hover:bg-red-500/10 transition-colors"
            >
              查看全部 {VIDEO_STYLE_PRESETS.length} 种风格 →
            </button>
          </div>

          {/* Generation Tips */}
          <div className="rounded-xl border border-border p-3">
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#EF4444]" />
              创作提示
            </h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>• AI生成模式：输入主题关键词，AI自动创作文案</li>
              <li>• 固定文案模式：直接输入文案，按段落自动分镜</li>
              <li>• 风格提示词用英文效果更好，如: cinematic lighting</li>
              <li>• 悬停分镜卡片可重新生成单张配图</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Wand2 className="w-4 h-4 text-[#EF4444]" /> {currentStyle.name}</span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1"><Volume2 className="w-4 h-4" /> {TTS_VOICES.find(v => v.id === selectedVoice)?.name}</span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1"><Music className="w-4 h-4" /> {BGM_OPTIONS.find(b => b.id === selectedBgm)?.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {frames.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFrames([]);
                setProgress({ phase: 'idle', currentFrame: 0, totalFrames: 0, currentAction: '', progress: 0 });
                setFinalVideoUrl(null);
              }}
              className="text-muted-foreground"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              重置
            </Button>
          )}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || (!topic.trim() && !fixedScript.trim())}
            className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white disabled:opacity-40 px-6"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                一键生成视频
              </>
            )}
          </Button>
          {isGenerating && (
            <Button
              onClick={handleCancelGenerate}
              variant="outline"
              className="border-red-300 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 px-4"
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              取消生成
            </Button>
          )}
        </div>
      </div>

      {/* Style Gallery Dialog */}
      <Dialog open={showStyleGallery} onOpenChange={setShowStyleGallery}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Palette className="w-5 h-5 text-[#EF4444]" />
              视觉风格库
            </DialogTitle>
          </DialogHeader>

          {(() => {
            const categories = [...new Set(VIDEO_STYLE_PRESETS.map(s => s.category))];
            return (
              <div className="space-y-6 py-4">
                {categories.map(category => (
                  <div key={category}>
                    <h3 className="text-sm font-bold text-foreground mb-3">{category}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {VIDEO_STYLE_PRESETS.filter(s => s.category === category).map(style => (
                        <button
                          key={style.id}
                          onClick={() => {
                            setSelectedStyle(style.id);
                            setShowStyleGallery(false);
                          }}
                          className={`text-left p-3 rounded-xl border transition-all ${
                            selectedStyle === style.id
                              ? 'border-[#EF4444] bg-red-500/5 ring-1 ring-[#EF4444]/30'
                              : 'border-border hover:border-[#EF4444]/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">{style.name}</span>
                            {selectedStyle === style.id && <Check className="w-4 h-4 text-[#EF4444]" />}
                          </div>
                          <p className="text-xs text-muted-foreground">{style.description}</p>
                          {style.promptPrefix && (
                            <p className="text-xs text-muted-foreground/60 mt-1 truncate">{style.promptPrefix.slice(0, 50)}...</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
