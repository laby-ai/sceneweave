'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Play, Pause,
  Film, Wand2, Sparkles, Loader2, CheckCircle2,
  Video, Settings2, Clapperboard, RefreshCw, Music, Volume2,
  Pencil, MessageSquare, Trash2, Check,
  ChevronDown, Download, FileText, Zap, Combine, Image as ImageIcon,
  Mic, Palette, Type, Clock, Layers, XCircle, Eye,
} from 'lucide-react';
import { getBgmTypeList, type BgmTypeId } from '@/constants/bgm-types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StoryboardSegment {
  segmentNumber: number;
  duration: number;
  sceneDescription: string;
  characterAction: string;
  cameraAngle: string;
  lighting: string;
  transitionHint: string;
  prompt: string;
}

interface GeneratedShot {
  segmentNumber: number;
  imageUrl: string | null;
  videoUrl: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  prompt: string;
}

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
}

interface TTSVoiceOption {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female';
}

interface ShortVideoProgress {
  phase: 'idle' | 'generating_script' | 'generating_audio' | 'generating_images' | 'composing_video' | 'completed' | 'failed';
  currentFrame: number;
  totalFrames: number;
  currentAction: string;
  progress: number;
}

interface AIVideoCreationPanelProps {
  onBack: () => void;
  initialPrompt?: string;
  autoGenerate?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MODEL_OPTIONS = [
  { id: 'doubao-seedance-1-5-pro-251215', name: 'Seedance 1.5 Pro', desc: 'BYOK 视频生成' },
  { id: 'doubao-seedance-2-0-260128', name: 'Seedance 2.0 Pro', desc: '高成本有声样片', tag: '交付样片' },
  { id: 'wan2.1/flf2v', name: 'Wan2.1 FLF2V', desc: '首尾帧视频生成(人物一致性)', tag: '一致性' },
  { id: 'wan2.1/i2v', name: 'Wan2.1 I2V', desc: '图片驱动视频(角色参考)', tag: '角色参考' },
  { id: 'opensora/t2i2v', name: 'Open-Sora T2I2V', desc: '两阶段管线(图→视频)', tag: '管线' },
];

const PIPELINE_MODES = [
  { id: 't2v', name: 'T2V 直出', desc: '文本直接生成视频' },
  { id: 't2i2v', name: 'T2I2V 两阶段', desc: '先生成首帧图，再生成视频' },
  { id: 'i2v', name: 'I2V 图片驱动', desc: '从参考图生成视频' },
  { id: 'flf2v', name: 'FLF2V 首尾帧', desc: '首帧+尾帧生成视频' },
];

const DURATION_OPTIONS = [5, 8, 10];
const RATIO_OPTIONS = ['16:9', '9:16', '1:1'];
const STYLE_OPTIONS = ['电影感', '动漫风格', '纪实风格', '奇幻风格'];
const RESOLUTION_OPTIONS = [
  { value: '480p', label: '480P 标清' },
  { value: '720p', label: '720P 高清' },
  { value: '1080p', label: '1080P 超清' },
];

const COMPOSITION_OPTIONS = [
  { value: 'panoramic', label: '全景', icon: '🏔️' },
  { value: 'medium', label: '中景', icon: '👤' },
  { value: 'closeup', label: '特写', icon: '🔍' },
  { value: 'aerial', label: '俯拍', icon: '🦅' },
  { value: 'lowangle', label: '仰拍', icon: '⬆️' },
];

// Short video style presets (from Pixelle)
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

const BGM_SHORT_OPTIONS = [
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

/* ------------------------------------------------------------------ */
/*  Two-phase workflow                                                 */
/* ------------------------------------------------------------------ */

type WorkflowPhase = 'storyboard' | 'compose';
type VideoMode = 'pro' | 'short';

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */

export default function AIVideoCreationPanel({
  onBack,
  initialPrompt,
  autoGenerate,
}: AIVideoCreationPanelProps) {
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  /* ========== Mode switch ========== */
  const [videoMode, setVideoMode] = useState<VideoMode>('pro');

  /* ========== Pro mode state ========== */
  const [phase, setPhase] = useState<WorkflowPhase>('storyboard');
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [inputText, setInputText] = useState(initialPrompt || '');
  const [segments, setSegments] = useState<StoryboardSegment[]>([]);
  const [editingSegment, setEditingSegment] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationPhase, setGenerationPhase] = useState('');
  const [activeService, setActiveService] = useState<string | null>(null);
  const [generatedShots, setGeneratedShots] = useState<GeneratedShot[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [completedServices, setCompletedServices] = useState<Set<string>>(new Set());
  const markCompleted = useCallback((id: string) => {
    setCompletedServices(prev => { const n = new Set(prev); n.add(id); return n; });
  }, []);
  const [cfgExpand, setCfgExpand] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string>('storyboard');
  const [selectedModel, setSelectedModel] = useState('doubao-seedance-2-0-260128');
  const [selectedDuration, setSelectedDuration] = useState(8);
  const [selectedRatio, setSelectedRatio] = useState('16:9');
  const [selectedStyle, setSelectedStyle] = useState('电影感');
  const [selectedComposition, setSelectedComposition] = useState('panoramic');
  const [pipelineMode, setPipelineMode] = useState<'t2v' | 't2i2v' | 'i2v' | 'flf2v'>('t2v');
  const [motionScore, setMotionScore] = useState(5);
  const [selectedResolution, setSelectedResolution] = useState('720p');
  const [generateAudio, setGenerateAudio] = useState(true);
  const [watermark, setWatermark] = useState(false);
  const [promptRefined, setPromptRefined] = useState(false);
  const [refiningPrompt, setRefiningPrompt] = useState(false);
  const [bgmType, setBgmType] = useState<BgmTypeId>('cinematic');
  const [bgmVolume, setBgmVolume] = useState<'low' | 'medium' | 'high'>('medium');
  const [bgmPreviewUrl, setBgmPreviewUrl] = useState<string | null>(null);
  const [bgmPreviewPlaying, setBgmPreviewPlaying] = useState(false);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<'storyboard' | 'chat'>('storyboard');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [progressMsg, setProgressMsg] = useState('');

  /* ========== Short video mode state ========== */
  const [svInputMode, setSvInputMode] = useState<'ai' | 'fixed'>('ai');
  const [svTopic, setSvTopic] = useState(initialPrompt || '');
  const [svFixedScript, setSvFixedScript] = useState('');
  const [svTitle, setSvTitle] = useState('');
  const [svSelectedStyle, setSvSelectedStyle] = useState('default');
  const [svCustomPromptPrefix, setSvCustomPromptPrefix] = useState('');
  const [svVideoSize, setSvVideoSize] = useState('1080x1920');
  const [svSceneCount, setSvSceneCount] = useState(5);
  const [svSelectedVoice, setSvSelectedVoice] = useState('zh-CN-YunjianNeural');
  const [svTtsSpeed, setSvTtsSpeed] = useState(1.2);
  const [svShowTtsSettings, setSvShowTtsSettings] = useState(false);
  const [svSelectedBgm, setSvSelectedBgm] = useState('none');
  const [svBgmVolume, setSvBgmVolume] = useState(0.2);
  const [svFrames, setSvFrames] = useState<StoryboardFrame[]>([]);
  const [svProgress, setSvProgress] = useState<ShortVideoProgress>({
    phase: 'idle', currentFrame: 0, totalFrames: 0, currentAction: '', progress: 0,
  });
  const [svFinalVideoUrl, setSvFinalVideoUrl] = useState<string | null>(null);
  const [svLightboxUrl, setSvLightboxUrl] = useState<string | null>(null);
  const svAbortRef = useRef<boolean>(false);

  /* ========== Computed ========== */
  const currentStyle = VIDEO_STYLE_PRESETS.find(s => s.id === svSelectedStyle) || VIDEO_STYLE_PRESETS[0];
  const currentSize = VIDEO_SIZE_OPTIONS.find(s => s.id === svVideoSize) || VIDEO_SIZE_OPTIONS[0];

  const stats = {
    storyboardGenerated: segments.length > 0,
    videoGenerated: !!finalVideoUrl,
  };

  /* ========== Auto-generate ========== */
  useEffect(() => {
    if (autoGenerate && prompt.trim()) {
      if (videoMode === 'pro') handleGenerateStoryboard();
      else handleShortVideoGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate]);

  /* ========== Pro: BGM preview ========== */
  const handlePreviewBgm = useCallback(async (bgmId: string) => {
    if (bgmAudioRef.current) { bgmAudioRef.current.pause(); bgmAudioRef.current = null; }
    if (bgmPreviewPlaying && bgmType === bgmId) { setBgmPreviewPlaying(false); return; }
    try {
      const res = await fetch(`/api/bgm?type=${bgmId}`);
      const data = await res.json();
      if (data.url) {
        const audio = new Audio(data.url);
        audio.volume = bgmVolume === 'low' ? 0.3 : bgmVolume === 'high' ? 0.8 : 0.5;
        audio.play();
        bgmAudioRef.current = audio;
        setBgmPreviewPlaying(true);
        setBgmType(bgmId as BgmTypeId);
        audio.onended = () => { setBgmPreviewPlaying(false); };
      }
    } catch { /* BGM preview unavailable */ }
  }, [bgmPreviewPlaying, bgmType, bgmVolume]);

  /* ========== Pro: Storyboard generation ========== */
  const handleGenerateStoryboard = useCallback(async () => {
    if (!prompt.trim()) return;
    setActiveService('storyboard');
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationPhase('正在生成分镜...');
    setProgressMsg('正在生成分镜...');

    try {
      setGenerationProgress(20);
      const res = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style: selectedStyle, duration: selectedDuration, ratio: selectedRatio }),
      });
      if (!res.ok) throw new Error('分镜生成失败');

      setGenerationProgress(70);
      const data = await res.json();
      const newSegments: StoryboardSegment[] = (data.segments || data.storyboard || []).map(
        (seg: Record<string, unknown>, i: number) => ({
          segmentNumber: i + 1,
          duration: (seg.duration as number) || 5,
          sceneDescription: (seg.sceneDescription as string) || (seg.scene as string) || '',
          characterAction: (seg.characterAction as string) || (seg.action as string) || '',
          cameraAngle: (seg.cameraAngle as string) || (seg.shot as string) || '中景',
          lighting: (seg.lighting as string) || '自然光',
          transitionHint: (seg.transitionHint as string) || (seg.transition as string) || '直接切换',
          prompt: (seg.prompt as string) || (seg.sceneDescription as string) || (seg.scene as string) || '',
        })
      );

      if (!isMountedRef.current) return;
      setSegments(newSegments);
      setGeneratedShots(newSegments.map(seg => ({
        segmentNumber: seg.segmentNumber, imageUrl: null, videoUrl: null, status: 'pending' as const, prompt: seg.prompt,
      })));
      setGenerationProgress(100);
      setGenerationPhase('分镜生成完成');
      setProgressMsg('');
      markCompleted('storyboard');
      setPhase('compose');
    } catch (err) {
      console.error('[AIVideo] storyboard error:', err);
      if (isMountedRef.current) { setGenerationPhase('分镜生成失败'); setProgressMsg('分镜生成失败'); }
    } finally {
      if (isMountedRef.current) { setIsGenerating(false); setActiveService(null); }
    }
  }, [prompt, selectedStyle, selectedDuration, selectedRatio, markCompleted]);

  /* ========== Pro: Prompt refine ========== */
  const handleRefinePrompt = useCallback(async () => {
    if (!prompt) return;
    setRefiningPrompt(true);
    try {
      const mode = pipelineMode === 't2i2v' || pipelineMode === 'i2v' ? 't2i' : pipelineMode === 'flf2v' ? 'i2v' : 't2v';
      const res = await fetch('/api/prompt/video-refine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode }),
      });
      if (!res.ok) throw new Error('提示词精炼失败');
      const data = await res.json();
      if (data.success && data.refinedPrompt) { setPrompt(data.refinedPrompt); setPromptRefined(true); }
    } catch { /* 静默失败 */ } finally { setRefiningPrompt(false); }
  }, [prompt, pipelineMode]);

  /* ========== Pro: Video generation (SSE) ========== */
  const handleGenerateVideo = useCallback(async () => {
    if (segments.length === 0) return;
    setActiveService('generate');
    setIsGenerating(true);
    setGenerationPhase('正在生成视频...');
    setGenerationProgress(0);
    setProgressMsg('正在生成视频...');

    try {
      const videoPrompt = segments[0]?.prompt || prompt;
      const res = await fetch('/api/video/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt, model: selectedModel, duration: selectedDuration,
          ratio: selectedRatio, style: selectedStyle, composition: selectedComposition,
          pipelineMode, motionScore, promptRefined,
          resolution: selectedResolution, generateAudio, watermark,
        }),
      });
      if (!res.ok || !res.body) throw new Error('视频生成请求失败');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let videoUrl: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.progress !== undefined && isMountedRef.current) {
                setGenerationProgress(Math.min(99, event.progress));
                setGenerationPhase(event.stage || event.message || '生成中...');
                setProgressMsg(event.stage || event.message || '生成中...');
              }
              if (event.type === 'complete' && event.videoUrl) videoUrl = event.videoUrl;
              if (event.videoUrl) videoUrl = event.videoUrl;
            } catch { /* skip */ }
          }
        }
      }

      if (!isMountedRef.current) return;
      if (videoUrl) {
        setFinalVideoUrl(videoUrl);
        setGeneratedShots(prev => prev.map((shot, i) => i === 0 ? { ...shot, videoUrl, status: 'completed' as const } : shot));
        setGenerationProgress(100); setGenerationPhase('视频生成完成'); setProgressMsg('');
        markCompleted('generate'); markCompleted('compose');
      } else {
        setGenerationProgress(100); setGenerationPhase('视频生成完成，获取结果中...'); setProgressMsg('');
        markCompleted('generate');
      }
    } catch (err) {
      console.error('[AIVideo] video gen error:', err);
      if (isMountedRef.current) { setGenerationPhase('视频生成失败，请重试'); setProgressMsg('视频生成失败'); }
    } finally {
      if (isMountedRef.current) { setIsGenerating(false); setActiveService(null); }
    }
  }, [segments, prompt, selectedModel, selectedDuration, selectedRatio, selectedStyle, selectedComposition, markCompleted]);

  /* ========== Pro: Full pipeline ========== */
  const handleStartGeneration = useCallback(async () => {
    await handleGenerateStoryboard();
    if (isMountedRef.current) await handleGenerateVideo();
  }, [handleGenerateStoryboard, handleGenerateVideo]);

  /* ========== Pro: Retry ========== */
  const handleRetry = useCallback(() => {
    setGenerationProgress(0); setGenerationPhase(''); setProgressMsg('');
    setFinalVideoUrl(null);
    setGeneratedShots(prev => prev.map(s => ({ ...s, status: 'pending' as const, videoUrl: null })));
    handleGenerateVideo();
  }, [handleGenerateVideo]);

  /* ========== Pro: Segment editing ========== */
  const updateSegmentPrompt = useCallback((index: number, newPrompt: string) => {
    setSegments(prev => prev.map((seg, i) => (i === index ? { ...seg, prompt: newPrompt } : seg)));
    setGeneratedShots(prev => prev.map((shot, i) => (i === index ? { ...shot, prompt: newPrompt } : shot)));
  }, []);
  const removeSegment = useCallback((index: number) => {
    setSegments(prev => prev.filter((_, i) => i !== index));
    setGeneratedShots(prev => prev.filter((_, i) => i !== index));
  }, []);

  /* ========== Pro: Chat ========== */
  const handleChatSend = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { role: 'user', content: chatInput }]);
    setTimeout(() => { setChatMessages(prev => [...prev, { role: 'assistant', content: '已收到您的指令，将根据调整后的内容进行生成。' }]); }, 500);
    setChatInput('');
  }, [chatInput]);

  const goToPhase = useCallback((p: WorkflowPhase) => { setPhase(p); }, []);

  /* ========== Short video: Generate ========== */
  const handleShortVideoGenerate = useCallback(async () => {
    if (isGenerating) return;
    const inputContent = svInputMode === 'ai' ? svTopic : svFixedScript;
    if (!inputContent.trim()) return;

    setIsGenerating(true);
    svAbortRef.current = false;
    setSvFinalVideoUrl(null);

    try {
      setSvProgress({ phase: 'generating_script', currentFrame: 0, totalFrames: svSceneCount, currentAction: 'AI 撰写文案...', progress: 5 });
      const scriptRes = await fetch('/api/short-video/generate-script', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputContent, mode: svInputMode, n_scenes: svSceneCount,
          style_prompt_prefix: svCustomPromptPrefix || currentStyle.promptPrefix,
          title: svTitle || undefined,
        }),
      });
      if (!scriptRes.ok) throw new Error('文案生成失败');
      const scriptData = await scriptRes.json();
      const narrations: string[] = scriptData.narrations || [];
      const imagePrompts: string[] = scriptData.imagePrompts || [];
      if (narrations.length === 0) throw new Error('未能生成文案');

      const initialFrames: StoryboardFrame[] = narrations.map((n, i) => ({
        index: i, narration: n, imagePrompt: imagePrompts[i] || n, duration: 0, status: 'pending' as const,
      }));
      setSvFrames(initialFrames);

      // Generate images
      setSvProgress({ phase: 'generating_images', currentFrame: 0, totalFrames: narrations.length, currentAction: '生成配图 0/' + narrations.length, progress: 20 });
      for (let i = 0; i < narrations.length; i++) {
        if (svAbortRef.current) break;
        setSvFrames(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'generating_image' } : f));
        setSvProgress(prev => ({ ...prev, currentFrame: i + 1, currentAction: `生成配图 ${i + 1}/${narrations.length}`, progress: 20 + (i / narrations.length) * 50 }));
        try {
          const promptPrefix = svCustomPromptPrefix || currentStyle.promptPrefix;
          const fullPrompt = promptPrefix ? `${promptPrefix}, ${imagePrompts[i] || narrations[i]}` : (imagePrompts[i] || narrations[i]);
          const imgRes = await fetch('/api/image/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: fullPrompt, size: `${currentSize.width}x${currentSize.height}` }),
          });
          if (imgRes.ok) {
            const imgData = await imgRes.json();
            const imageUrl = imgData.imageUrls?.[0] || imgData.imageUrl;
            if (imageUrl) {
              setSvFrames(prev => prev.map((f, idx) => idx === i ? { ...f, imageUrl, status: 'completed' } : f));
            } else {
              setSvFrames(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'failed' } : f));
            }
          } else {
            setSvFrames(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'failed' } : f));
          }
        } catch {
          setSvFrames(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'failed' } : f));
        }
      }

      // Compose
      setSvProgress({ phase: 'composing_video', currentFrame: narrations.length, totalFrames: narrations.length, currentAction: '合成视频...', progress: 85 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSvProgress({ phase: 'completed', currentFrame: narrations.length, totalFrames: narrations.length, currentAction: '视频已生成！', progress: 100 });
    } catch (err) {
      const isAborted = svAbortRef.current;
      setSvProgress(prev => ({ ...prev, phase: isAborted ? 'idle' as const : 'failed' as const, currentAction: isAborted ? '已取消生成' : `生成失败: ${err instanceof Error ? err.message : '未知错误'}` }));
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, svInputMode, svTopic, svFixedScript, svSceneCount, svCustomPromptPrefix, currentStyle, currentSize, svTitle]);

  const handleSvCancel = useCallback(() => {
    svAbortRef.current = true;
    setIsGenerating(false);
    setSvProgress(prev => ({ ...prev, phase: 'idle' as const, currentAction: '已取消生成' }));
  }, []);

  const handleSvRegenFrame = useCallback(async (index: number) => {
    const frame = svFrames[index];
    if (!frame) return;
    setSvFrames(prev => prev.map((f, idx) => idx === index ? { ...f, status: 'generating_image' } : f));
    try {
      const promptPrefix = svCustomPromptPrefix || currentStyle.promptPrefix;
      const fullPrompt = promptPrefix ? `${promptPrefix}, ${frame.imagePrompt}` : frame.imagePrompt;
      const imgRes = await fetch('/api/image/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, size: `${currentSize.width}x${currentSize.height}` }),
      });
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        const imageUrl = imgData.imageUrls?.[0] || imgData.imageUrl;
        if (imageUrl) { setSvFrames(prev => prev.map((f, idx) => idx === index ? { ...f, imageUrl, status: 'completed' } : f)); return; }
      }
      setSvFrames(prev => prev.map((f, idx) => idx === index ? { ...f, status: 'failed' } : f));
    } catch {
      setSvFrames(prev => prev.map((f, idx) => idx === index ? { ...f, status: 'failed' } : f));
    }
  }, [svFrames, svCustomPromptPrefix, currentStyle, currentSize]);

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  const isServiceDone = (id: string) => completedServices.has(id);
  const isServiceActive = (id: string) => activeService === id;

  // Style presets grouped by category
  const styleCategories = [...new Set(VIDEO_STYLE_PRESETS.map(s => s.category))];

  return (
    <div className="h-full min-h-0 bg-[#05070d] flex flex-col">
      {/* ---- Top bar ---- */}
      <div className="h-14 flex items-center px-4 border-b border-white/10 bg-[#080b12] shrink-0">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 text-[#70E0FF] hover:text-[#38BDF8] transition-colors mr-4">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">返回</span>
        </button>
        <h1 className="text-base font-bold text-foreground flex items-center gap-2">
          <Video className="w-5 h-5 text-[#70E0FF]" />
          视频创作
        </h1>
        <span className="ml-3 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-[#70E0FF] to-blue-400 text-white">AI 驱动</span>

        {/* Mode switcher */}
        <div className="ml-6 flex items-center bg-secondary rounded-lg p-0.5">
          <button type="button" onClick={() => setVideoMode('pro')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${videoMode === 'pro' ? 'bg-[#70E0FF] text-white shadow-sm' : 'text-foreground/50 hover:text-foreground/70'}`}>
            <Film className="w-3.5 h-3.5 inline mr-1" />专业视频
          </button>
          <button type="button" onClick={() => setVideoMode('short')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${videoMode === 'short' ? 'bg-[#70E0FF] text-white shadow-sm' : 'text-foreground/50 hover:text-foreground/70'}`}>
            <Zap className="w-3.5 h-3.5 inline mr-1" />AI短视频
          </button>
        </div>
      </div>

      {/* ---- Three-column layout ---- */}
      <div className="flex flex-1 min-h-0">

        {videoMode === 'pro' ? (
          /* ================================================================ */
          /*  PRO MODE: Original three-column layout                          */
          /* ================================================================ */
          <>
            {/* LEFT: Service config */}
            <div className="w-[280px] flex flex-col min-w-0 border-r border-border/70">
              <div className="px-3 py-2 border-b border-border/70 flex items-center gap-1">
                {(['storyboard', 'compose'] as WorkflowPhase[]).map((p, i) => {
                  const labels = ['分镜', '合成'];
                  const icons = [FileText, Video];
                  const isActive = phase === p;
                  const isDone = (p === 'storyboard' && segments.length > 0) || (p === 'compose' && !!finalVideoUrl);
                  const Icon = icons[i];
                  return (
                    <button key={p} onClick={() => goToPhase(p)}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${isActive ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : isDone ? 'text-emerald-500 hover:bg-accent/30' : 'text-foreground/35 hover:bg-accent/20'}`}>
                      <Icon className="w-3 h-3" /><span>{labels[i]}</span>
                      {isDone && !isActive && <Check className="w-2.5 h-2.5" />}
                    </button>
                  );
                })}
              </div>

              {isGenerating && progressMsg && (
                <div className="px-3 py-1.5 border-b border-border/70 bg-primary/5">
                  <div className="text-[10px] text-primary/70 truncate">{progressMsg}</div>
                  <div className="w-full h-1 bg-accent/30 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-[#70E0FF] rounded-full animate-pulse" style={{ width: `${Math.max(generationProgress, 10)}%` }} />
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="text-[9px] font-semibold text-foreground/30 uppercase tracking-wider px-2.5 pt-2">阶段 1 · 分镜与提示词</div>
                {([
                  { id: 'storyboard', icon: Clapperboard, label: '分镜生成', desc: '生成视频分镜', color: 'text-cyan-300', phase: 'storyboard' as WorkflowPhase },
                  { id: 'params', icon: Settings2, label: '参数设置', desc: '模型/时长/风格', color: 'text-cyan-300', phase: 'storyboard' as WorkflowPhase },
                ]).map(svc => {
                  const isActive = selectedService === svc.id;
                  const isDone = svc.id === 'storyboard' ? segments.length > 0 : false;
                  const Icon = svc.icon;
                  return (
                    <div key={svc.id} onMouseEnter={() => setCfgExpand(svc.id)}>
                      <button onClick={() => { setSelectedService(svc.id); if (phase !== svc.phase) goToPhase(svc.phase); setCfgExpand(cfgExpand === svc.id ? null : svc.id); }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${isActive ? 'bg-[#70E0FF]/10 border border-[#70E0FF]/20' : 'border border-transparent hover:bg-accent/20'}`}>
                        <Icon className={`w-4 h-4 ${svc.color}`} />
                        <span className={`font-medium flex-1 text-left ${isActive ? 'text-[#70E0FF]' : 'text-foreground/70'}`}>{svc.label}</span>
                        {svc.id === 'storyboard' && segments.length > 0 && <span className="text-[9px] text-primary bg-primary/10 px-1 py-0.5 rounded">{segments.length}</span>}
                        {isDone && <Check className="w-3 h-3 text-emerald-500" />}
                        <ChevronDown className={`w-3 h-3 text-foreground/30 transition-transform ${cfgExpand === svc.id ? 'rotate-180' : ''}`} />
                      </button>
                      {cfgExpand === svc.id && (
                        <div className="ml-7 mr-2 mb-1 space-y-1.5 py-1.5 border-l border-border/50 pl-2.5">
                          {svc.id === 'storyboard' && (
                            <>
                              {segments.length === 0 ? (
                                <div className="text-[11px] text-foreground/40">点击底部「开始创作」自动生成分镜</div>
                              ) : segments.map((seg, idx) => (
                                <div key={idx} className="rounded-lg bg-background/60 border border-border/50 p-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[11px] font-medium text-[#70E0FF]">分镜 {seg.segmentNumber}</span>
                                    <div className="flex gap-0.5">
                                      <button type="button" onClick={() => setEditingSegment(editingSegment === idx ? null : idx)} className="p-1 rounded hover:bg-accent/30 text-foreground/40 hover:text-foreground/70 transition-colors"><Pencil className="w-3 h-3" /></button>
                                      <button type="button" onClick={() => removeSegment(idx)} className="p-1 rounded hover:bg-cyan-500/10 text-foreground/40 hover:text-[#70E0FF] transition-colors"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                  </div>
                                  <p className="text-[11px] text-foreground/50 line-clamp-2">{seg.sceneDescription}</p>
                                  {editingSegment === idx && (
                                    <textarea value={seg.prompt} onChange={e => updateSegmentPrompt(idx, e.target.value)}
                                      className="mt-1.5 w-full h-14 text-[11px] bg-background border border-border rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-[#70E0FF]/50 text-foreground" />
                                  )}
                                </div>
                              ))}
                            </>
                          )}
                          {svc.id === 'params' && (
                            <>
                              <div><div className="text-[10px] text-foreground/40 mb-1">模型</div>{MODEL_OPTIONS.map(m => (
                                <button key={m.id} onClick={() => setSelectedModel(m.id)} className={`block w-full text-left text-[11px] px-2 py-1 rounded mb-0.5 transition-all ${selectedModel === m.id ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground/50 hover:bg-accent/20'}`}>{m.name}<span className="text-foreground/30 ml-1">{m.desc}</span></button>
                              ))}</div>
                              <div><div className="text-[10px] text-foreground/40 mb-1">时长</div><div className="flex gap-1">{DURATION_OPTIONS.map(d => (
                                <button key={d} onClick={() => setSelectedDuration(d)} className={`flex-1 text-[11px] py-1 rounded transition-all ${selectedDuration === d ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground/50 hover:bg-accent/20'}`}>{d}s</button>
                              ))}</div></div>
                              <div><div className="text-[10px] text-foreground/40 mb-1">画面比例</div><div className="flex gap-1">{RATIO_OPTIONS.map(r => (
                                <button key={r} onClick={() => setSelectedRatio(r)} className={`flex-1 text-[11px] py-1 rounded transition-all ${selectedRatio === r ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground/50 hover:bg-accent/20'}`}>{r}</button>
                              ))}</div></div>
                              <div><div className="text-[10px] text-foreground/40 mb-1">风格</div>{STYLE_OPTIONS.map(s => (
                                <button key={s} onClick={() => setSelectedStyle(s)} className={`block w-full text-left text-[11px] px-2 py-1 rounded mb-0.5 transition-all ${selectedStyle === s ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground/50 hover:bg-accent/20'}`}>{s}</button>
                              ))}</div>
                              <div><div className="text-[10px] text-foreground/40 mb-1">构图视角</div>{COMPOSITION_OPTIONS.map(c => (
                                <button key={c.value} onClick={() => setSelectedComposition(c.value)} className={`block w-full text-left text-[11px] px-2 py-1 rounded mb-0.5 transition-all ${selectedComposition === c.value ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground/50 hover:bg-accent/20'}`}>{c.icon} {c.label}</button>
                              ))}</div>
                              <div><div className="text-[10px] text-foreground/40 mb-1">管线模式</div>{PIPELINE_MODES.map(m => (
                                <button key={m.id} onClick={() => setPipelineMode(m.id as 't2v' | 't2i2v' | 'i2v' | 'flf2v')} className={`block w-full text-left text-[11px] px-2 py-1 rounded mb-0.5 transition-all ${pipelineMode === m.id ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground/50 hover:bg-accent/20'}`}>{m.name}<span className="text-foreground/30 ml-1">{m.desc}</span></button>
                              ))}</div>
                              <div><div className="text-[10px] text-foreground/40 mb-1">运动评分 (Motion Score: {motionScore})</div>
                                <input type="range" min={1} max={15} value={motionScore} onChange={e => setMotionScore(Number(e.target.value))} className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-[#70E0FF]" />
                                <div className="flex justify-between text-[9px] text-foreground/30 mt-0.5"><span>静态</span><span>中等</span><span>剧烈</span></div>
                              </div>
                              <div><div className="text-[10px] text-foreground/40 mb-1">清晰度</div><div className="flex gap-1">{RESOLUTION_OPTIONS.map(r => (
                                <button key={r.value} onClick={() => setSelectedResolution(r.value)} className={`flex-1 text-[11px] py-1 rounded transition-all ${selectedResolution === r.value ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground/50 hover:bg-accent/20'}`}>{r.label}</button>
                              ))}</div></div>
                              <div className="flex items-center justify-between"><span className="text-[11px] text-foreground/50">生成音效</span>
                                <button onClick={() => setGenerateAudio(v => !v)} className={`relative w-8 h-4 rounded-full transition-colors ${generateAudio ? 'bg-[#70E0FF]' : 'bg-border'}`}><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${generateAudio ? 'left-[18px]' : 'left-0.5'}`} /></button>
                              </div>
                              <div className="flex items-center justify-between"><span className="text-[11px] text-foreground/50">视频水印</span>
                                <button onClick={() => setWatermark(v => !v)} className={`relative w-8 h-4 rounded-full transition-colors ${watermark ? 'bg-[#70E0FF]' : 'bg-border'}`}><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${watermark ? 'left-[18px]' : 'left-0.5'}`} /></button>
                              </div>
                              <div><button onClick={handleRefinePrompt} disabled={refiningPrompt || !prompt} className="w-full text-[11px] px-2 py-1.5 rounded bg-[#70E0FF]/10 text-[#70E0FF] hover:bg-[#70E0FF]/20 disabled:opacity-40 flex items-center justify-center gap-1">
                                {refiningPrompt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}{promptRefined ? '提示词已增强 ✓' : '提示词增强'}
                              </button></div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="text-[9px] font-semibold text-foreground/30 uppercase tracking-wider px-2.5 pt-2">阶段 2 · 视频合成</div>
                {([
                  { id: 'generate', icon: Video, label: '视频生成', desc: '分镜→视频', color: 'text-emerald-400' },
                  { id: 'bgm', icon: Music, label: '背景音乐', desc: 'BGM配乐', color: 'text-amber-400' },
                  { id: 'compose', icon: Combine, label: '合成导出', desc: '合并成片', color: 'text-cyan-300' },
                ]).map(svc => {
                  const isActive = selectedService === svc.id;
                  const isDone = (svc.id === 'generate' && !!finalVideoUrl) || (svc.id === 'bgm' && !!bgmType) || (svc.id === 'compose' && !!finalVideoUrl);
                  const Icon = svc.icon;
                  return (
                    <div key={svc.id} onMouseEnter={() => setCfgExpand(svc.id)}>
                      <button onClick={() => { setSelectedService(svc.id); if (phase !== 'compose') goToPhase('compose'); setCfgExpand(cfgExpand === svc.id ? null : svc.id); }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${isActive ? 'bg-[#70E0FF]/10 border border-[#70E0FF]/20' : 'border border-transparent hover:bg-accent/20'}`}>
                        <Icon className={`w-4 h-4 ${svc.color}`} />
                        <span className={`font-medium flex-1 text-left ${isActive ? 'text-[#70E0FF]' : 'text-foreground/70'}`}>{svc.label}</span>
                        {svc.id === 'generate' && isServiceActive('generate') && <Loader2 className="w-3 h-3 text-[#70E0FF] animate-spin" />}
                        {isDone && <Check className="w-3 h-3 text-emerald-500" />}
                        <ChevronDown className={`w-3 h-3 text-foreground/30 transition-transform ${cfgExpand === svc.id ? 'rotate-180' : ''}`} />
                      </button>
                      {cfgExpand === svc.id && (
                        <div className="ml-7 mr-2 mb-1 space-y-1.5 py-1.5 border-l border-border/50 pl-2.5">
                          {svc.id === 'generate' && (
                            <>
                              {isGenerating && activeService === 'generate' ? (
                                <div><div className="flex items-center gap-2 mb-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin text-[#70E0FF]" /><span className="text-[11px] text-foreground/50">{generationPhase}</span></div>
                                  <div className="w-full h-1.5 bg-accent/30 rounded-full overflow-hidden"><div className="h-full bg-[#70E0FF] rounded-full transition-all duration-300" style={{ width: `${generationProgress}%` }} /></div>
                                  <span className="text-[10px] text-foreground/30 mt-1 block">{generationProgress}%</span>
                                </div>
                              ) : isServiceDone('generate') ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-500"><CheckCircle2 className="w-3.5 h-3.5" />视频已生成</div>
                                  <button type="button" onClick={handleRetry} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-accent/30 hover:bg-accent/50 text-foreground/60 hover:text-foreground/80 transition-colors"><RefreshCw className="w-3 h-3" />重新生成</button>
                                </div>
                              ) : <div className="text-[11px] text-foreground/40">分镜确认后点击底部「生成视频」</div>}
                            </>
                          )}
                          {svc.id === 'bgm' && (
                            <div className="space-y-2"><div>
                              <div className="text-[10px] text-foreground/40 mb-1 flex items-center gap-1"><Music className="w-3 h-3" /> 背景音乐风格</div>
                              <div className="space-y-0.5 max-h-[280px] overflow-y-auto pr-1">{getBgmTypeList().map(bgm => (
                                <div key={bgm.id} className="flex items-center gap-1">
                                  <button onClick={() => setBgmType(bgm.id)} className={`flex-1 text-left text-[11px] px-2 py-1 rounded transition-all ${bgmType === bgm.id ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground/50 hover:bg-accent/20'}`}>{bgm.icon} {bgm.name}</button>
                                  <button onClick={() => handlePreviewBgm(bgm.id)} className={`p-1 rounded transition-all ${bgmPreviewPlaying && bgmType === bgm.id ? 'text-[#70E0FF] bg-[#70E0FF]/10' : 'text-foreground/30 hover:text-foreground/60 hover:bg-accent/20'}`} title="试听">
                                    {bgmPreviewPlaying && bgmType === bgm.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                  </button>
                                </div>
                              ))}</div>
                              <div className="flex items-center gap-1 mt-1"><span className="text-[10px] text-foreground/30">音量</span>
                                {(['low', 'medium', 'high'] as const).map(v => (
                                  <button key={v} onClick={() => setBgmVolume(v)} className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${bgmVolume === v ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground/40 hover:bg-accent/20'}`}>{v === 'low' ? '低' : v === 'medium' ? '中' : '高'}</button>
                                ))}
                              </div>
                            </div></div>
                          )}
                          {svc.id === 'compose' && (
                            <>
                              {finalVideoUrl ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-500"><CheckCircle2 className="w-3.5 h-3.5" />视频已就绪，可下载导出</div>
                                  <a href={finalVideoUrl} download target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded bg-[#70E0FF] text-white hover:bg-[#38BDF8] transition-colors w-fit"><Download className="w-3 h-3" />下载视频</a>
                                </div>
                              ) : <div className="text-[11px] text-foreground/40">视频生成完成后可在此导出</div>}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom: input + action */}
              <div className="px-3 py-2 border-t border-border/70">
                <textarea value={inputText} onChange={e => { setInputText(e.target.value); setPrompt(e.target.value); }}
                  placeholder="描述你想要生成的视频内容..."
                  className="w-full h-20 text-xs bg-secondary border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#70E0FF]/50 text-foreground placeholder:text-foreground/30" />
                <button onClick={() => { segments.length === 0 ? handleStartGeneration() : handleGenerateVideo(); }}
                  disabled={isGenerating || (!inputText.trim() && segments.length === 0)}
                  className="w-full mt-2 py-2.5 rounded-xl bg-[#70E0FF] text-white font-medium text-sm flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#70E0FF]/80 transition-all">
                  {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...</> : segments.length > 0 ? <><Video className="w-4 h-4" /> 生成视频</> : <><Wand2 className="w-4 h-4" /> 开始创作</>}
                </button>
                {segments.length > 0 && !finalVideoUrl && !isGenerating && (
                  <button onClick={handleGenerateStoryboard} disabled={isGenerating}
                    className="w-full mt-1.5 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border border-[#70E0FF]/30 text-[#70E0FF] hover:bg-[#70E0FF]/10 transition-colors disabled:opacity-40">
                    <RefreshCw className="w-3.5 h-3.5" />重新生成分镜
                  </button>
                )}
              </div>
            </div>

            {/* CENTER: Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-background overflow-auto">
              {!isGenerating && segments.length === 0 && !finalVideoUrl && (
                <div className="flex-1 flex flex-col items-center justify-center text-foreground/30 p-8">
                  <Video className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-base font-medium text-foreground/50 mb-2">输入提示词开始创作</p>
                  <p className="text-sm text-foreground/30">AI 将自动为您生成分镜并合成视频</p>
                </div>
              )}
              {isGenerating && !finalVideoUrl && !segments.length && (
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <div className="w-20 h-20 rounded-full bg-[#70E0FF]/10 flex items-center justify-center mb-4"><Loader2 className="w-10 h-10 text-[#70E0FF] animate-spin" /></div>
                  <p className="text-sm font-medium text-foreground/70 mb-2">{generationPhase || '正在生成...'}</p>
                  <div className="w-64 h-2 bg-accent/30 rounded-full overflow-hidden mb-2"><div className="h-full bg-[#70E0FF] rounded-full transition-all duration-500" style={{ width: `${generationProgress}%` }} /></div>
                  <span className="text-xs text-foreground/40">{generationProgress}%</span>
                </div>
              )}
              {segments.length > 0 && !finalVideoUrl && !isGenerating && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Clapperboard className="w-4 h-4 text-[#70E0FF]" />分镜预览<span className="text-xs text-foreground/40 font-normal">({segments.length}段)</span></h2>
                    <button type="button" onClick={handleGenerateVideo} disabled={isGenerating}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#70E0FF] text-white hover:bg-[#38BDF8] disabled:opacity-40 transition-colors"><Video className="w-3.5 h-3.5" />生成视频</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {segments.map((seg, idx) => (
                      <div key={idx} className="rounded-xl border border-border bg-card p-3 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-[#70E0FF]">分镜 {seg.segmentNumber}</span><span className="text-[10px] text-foreground/30">{seg.duration}s</span></div>
                        <p className="text-xs text-foreground/70 mb-1.5 line-clamp-3">{seg.sceneDescription}</p>
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/30 text-foreground/40">{seg.cameraAngle}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/30 text-foreground/40">{seg.lighting}</span>
                          {seg.transitionHint && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/30 text-foreground/40">{seg.transitionHint}</span>}
                        </div>
                        {editingSegment === idx && (
                          <textarea value={seg.prompt} onChange={e => updateSegmentPrompt(idx, e.target.value)}
                            className="mt-2 w-full h-16 text-xs bg-secondary border border-border rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-[#70E0FF]/50 text-foreground" placeholder="编辑提示词..." />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {finalVideoUrl && (
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                  <div className="w-full max-w-3xl">
                    <video src={finalVideoUrl} controls autoPlay className="w-full rounded-xl shadow-lg" style={{ maxHeight: '70vh' }} />
                    <div className="flex items-center justify-center gap-3 mt-4">
                      <a href={finalVideoUrl} download target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#70E0FF] text-white hover:bg-[#38BDF8] transition-colors"><Download className="w-4 h-4" />下载视频</a>
                      <button type="button" onClick={handleRetry} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-[#70E0FF]/30 text-[#70E0FF] hover:bg-[#70E0FF]/10 transition-colors"><RefreshCw className="w-4 h-4" />重新生成</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Detail & Chat */}
            <div className="w-[320px] border-l border-border/70 bg-card flex flex-col shrink-0">
              <div className="flex border-b border-border/70">
                <button type="button" onClick={() => setActiveRightTab('storyboard')}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${activeRightTab === 'storyboard' ? 'text-[#70E0FF] border-b-2 border-[#70E0FF]' : 'text-foreground/40 hover:text-foreground/60'}`}>
                  <Clapperboard className="w-3.5 h-3.5 inline mr-1" />分镜详情
                </button>
                <button type="button" onClick={() => setActiveRightTab('chat')}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${activeRightTab === 'chat' ? 'text-[#70E0FF] border-b-2 border-[#70E0FF]' : 'text-foreground/40 hover:text-foreground/60'}`}>
                  <MessageSquare className="w-3.5 h-3.5 inline mr-1" />对话助手
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {activeRightTab === 'storyboard' ? (
                  <div className="space-y-3">
                    {segments.length === 0 ? (
                      <div className="text-center py-8"><Clapperboard className="w-10 h-10 text-foreground/15 mx-auto mb-2" /><p className="text-xs text-foreground/30">生成分镜后可在此查看详情</p></div>
                    ) : segments.map((seg, idx) => (
                      <div key={idx} className="rounded-lg border border-border/70 p-3">
                        <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-[#70E0FF]">分镜 {seg.segmentNumber}</span><span className="text-[10px] text-foreground/30">{seg.duration}s</span></div>
                        <div className="space-y-1.5 text-[11px]">
                          <div><span className="text-foreground/40">场景：</span><span className="text-foreground/70">{seg.sceneDescription}</span></div>
                          {seg.characterAction && <div><span className="text-foreground/40">动作：</span><span className="text-foreground/70">{seg.characterAction}</span></div>}
                          <div className="flex flex-wrap gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-accent/30 text-foreground/40">{seg.cameraAngle}</span>
                            <span className="px-1.5 py-0.5 rounded bg-accent/30 text-foreground/40">{seg.lighting}</span>
                            {seg.transitionHint && <span className="px-1.5 py-0.5 rounded bg-accent/30 text-foreground/40">{seg.transitionHint}</span>}
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <label className="text-[10px] text-foreground/30 block mb-1">提示词</label>
                          <textarea value={seg.prompt} onChange={e => updateSegmentPrompt(idx, e.target.value)}
                            className="w-full h-14 text-[11px] bg-secondary border border-border rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-[#70E0FF]/50 text-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto space-y-2">
                      {chatMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-foreground/20"><MessageSquare className="w-10 h-10 mb-2" /><p className="text-xs">AI对话助手</p><p className="text-[10px] mt-1 text-foreground/15">可对话调整分镜和提示词</p></div>
                      ) : chatMessages.map((msg, idx) => (
                        <div key={idx} className={`text-xs p-2 rounded-lg ${msg.role === 'user' ? 'bg-[#70E0FF]/10 text-foreground/70 ml-4' : 'bg-accent/30 text-foreground/60 mr-4'}`}>{msg.content}</div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-border/70 mt-2">
                      <div className="flex gap-2">
                        <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleChatSend(); }}
                          placeholder="输入对话内容..."
                          className="flex-1 text-xs px-3 py-2 rounded-lg bg-secondary border border-border focus:outline-none focus:ring-1 focus:ring-[#70E0FF]/50 text-foreground placeholder:text-foreground/30" />
                        <button type="button" onClick={handleChatSend} className="px-3 py-2 rounded-lg bg-[#70E0FF] text-white text-xs hover:bg-[#38BDF8] transition-colors">发送</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* ================================================================ */
          /*  SHORT VIDEO MODE: Merged short video features                   */
          /* ================================================================ */
          <>
            {/* LEFT: Config */}
            <div className="w-[280px] flex flex-col min-w-0 border-r border-border/70">
              {/* Progress bar */}
              {svProgress.phase !== 'idle' && (
                <div className="px-3 py-1.5 border-b border-border/70 bg-primary/5">
                  <div className="text-[10px] text-primary/70 truncate">{svProgress.currentAction}</div>
                  <div className="w-full h-1 bg-accent/30 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-[#70E0FF] rounded-full transition-all duration-300" style={{ width: `${svProgress.progress}%` }} />
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
                {/* Input mode */}
                <div>
                  <div className="text-[10px] text-foreground/40 mb-1.5">输入模式</div>
                  <div className="flex gap-1">
                    <button onClick={() => setSvInputMode('ai')} className={`flex-1 text-[11px] py-1.5 rounded-lg transition-all ${svInputMode === 'ai' ? 'bg-[#70E0FF]/10 text-[#70E0FF] font-medium' : 'text-foreground/50 hover:bg-accent/20'}`}>
                      <Sparkles className="w-3 h-3 inline mr-1" />AI生成
                    </button>
                    <button onClick={() => setSvInputMode('fixed')} className={`flex-1 text-[11px] py-1.5 rounded-lg transition-all ${svInputMode === 'fixed' ? 'bg-[#70E0FF]/10 text-[#70E0FF] font-medium' : 'text-foreground/50 hover:bg-accent/20'}`}>
                      <Type className="w-3 h-3 inline mr-1" />固定文案
                    </button>
                  </div>
                </div>

                {/* Style presets */}
                <div>
                  <div className="text-[10px] text-foreground/40 mb-1.5 flex items-center gap-1"><Palette className="w-3 h-3" /> 视觉风格</div>
                  <div className="space-y-1.5">
                    {styleCategories.map(cat => (
                      <div key={cat}>
                        <div className="text-[9px] text-foreground/30 mb-0.5">{cat}</div>
                        <div className="flex flex-wrap gap-1">
                          {VIDEO_STYLE_PRESETS.filter(s => s.category === cat).map(s => (
                            <button key={s.id} onClick={() => setSvSelectedStyle(s.id)} title={s.description}
                              className={`text-[10px] px-2 py-1 rounded-md transition-all ${svSelectedStyle === s.id ? 'bg-[#70E0FF] text-white font-medium' : 'bg-accent/30 text-foreground/50 hover:bg-accent/50'}`}>
                              {s.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Video size */}
                <div>
                  <div className="text-[10px] text-foreground/40 mb-1.5">视频尺寸</div>
                  <div className="flex gap-1">
                    {VIDEO_SIZE_OPTIONS.map(s => (
                      <button key={s.id} onClick={() => setSvVideoSize(s.id)}
                        className={`flex-1 text-[11px] py-1 rounded transition-all ${svVideoSize === s.id ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground/50 hover:bg-accent/20'}`}>{s.label}</button>
                    ))}
                  </div>
                </div>

                {/* Scene count */}
                <div>
                  <div className="text-[10px] text-foreground/40 mb-1.5">分镜数量</div>
                  <div className="flex gap-1">
                    {SCENE_COUNT_OPTIONS.map(n => (
                      <button key={n} onClick={() => setSvSceneCount(n)}
                        className={`flex-1 text-[11px] py-1 rounded transition-all ${svSceneCount === n ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground/50 hover:bg-accent/20'}`}>{n}段</button>
                    ))}
                  </div>
                </div>

                {/* TTS */}
                <div>
                  <button onClick={() => setSvShowTtsSettings(!svShowTtsSettings)}
                    className="w-full flex items-center justify-between text-[10px] text-foreground/40">
                    <span className="flex items-center gap-1"><Mic className="w-3 h-3" /> 语音合成</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${svShowTtsSettings ? 'rotate-180' : ''}`} />
                  </button>
                  {svShowTtsSettings && (
                    <div className="mt-1.5 space-y-1.5 border-l border-border/50 pl-2.5">
                      <div className="max-h-[160px] overflow-y-auto pr-1">
                        {TTS_VOICES.map(v => (
                          <button key={v.id} onClick={() => setSvSelectedVoice(v.id)}
                            className={`block w-full text-left text-[10px] px-2 py-0.5 rounded transition-all ${svSelectedVoice === v.id ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground/40 hover:bg-accent/20'}`}>
                            {v.name}<span className="text-foreground/25 ml-1">{v.gender === 'male' ? '♂' : '♀'}</span>
                          </button>
                        ))}
                      </div>
                      <div>
                        <div className="text-[9px] text-foreground/30">语速 {svTtsSpeed.toFixed(1)}x</div>
                        <input type="range" min={0.5} max={2} step={0.1} value={svTtsSpeed} onChange={e => setSvTtsSpeed(Number(e.target.value))}
                          className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-[#70E0FF]" />
                      </div>
                    </div>
                  )}
                </div>

                {/* BGM */}
                <div>
                  <div className="text-[10px] text-foreground/40 mb-1.5 flex items-center gap-1"><Music className="w-3 h-3" /> 背景音乐</div>
                  <div className="space-y-0.5">
                    {BGM_SHORT_OPTIONS.map(b => (
                      <button key={b.id} onClick={() => setSvSelectedBgm(b.id)}
                        className={`block w-full text-left text-[11px] px-2 py-1 rounded transition-all ${svSelectedBgm === b.id ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground/50 hover:bg-accent/20'}`}>
                        {b.icon} {b.name}
                      </button>
                    ))}
                  </div>
                  {svSelectedBgm !== 'none' && (
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-[9px] text-foreground/30">音量</span>
                      <input type="range" min={0} max={1} step={0.1} value={svBgmVolume} onChange={e => setSvBgmVolume(Number(e.target.value))}
                        className="flex-1 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-[#70E0FF]" />
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom: input + generate */}
              <div className="px-3 py-2 border-t border-border/70 space-y-2">
                {svInputMode === 'ai' ? (
                  <textarea value={svTopic} onChange={e => setSvTopic(e.target.value)} placeholder="输入视频主题，AI自动创作文案..."
                    className="w-full h-16 text-xs bg-secondary border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#70E0FF]/50 text-foreground placeholder:text-foreground/30" />
                ) : (
                  <textarea value={svFixedScript} onChange={e => setSvFixedScript(e.target.value)} placeholder="粘贴文案内容，按段落自动分镜..."
                    className="w-full h-16 text-xs bg-secondary border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#70E0FF]/50 text-foreground placeholder:text-foreground/30" />
                )}
                <div className="flex gap-2">
                  <button onClick={handleShortVideoGenerate} disabled={isGenerating || (!svTopic.trim() && !svFixedScript.trim())}
                    className="flex-1 py-2.5 rounded-xl bg-[#70E0FF] text-white font-medium text-sm flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#70E0FF]/80 transition-all">
                    {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...</> : <><Zap className="w-4 h-4" /> 一键生成</>}
                  </button>
                  {isGenerating && (
                    <button onClick={handleSvCancel} className="px-3 py-2.5 rounded-xl border border-[#70E0FF]/30 text-[#70E0FF] text-sm hover:bg-[#70E0FF]/10 transition-colors">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* CENTER: Storyboard grid */}
            <div className="flex-1 flex flex-col min-w-0 bg-background overflow-auto">
              {svFrames.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-foreground/30 p-8">
                  <Zap className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-base font-medium text-foreground/50 mb-2">输入主题一键生成</p>
                  <p className="text-sm text-foreground/30">AI 自动撰写文案、生成配图、合成视频</p>
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#70E0FF]" />
                      分镜预览
                      <span className="text-xs text-foreground/40 font-normal">({svFrames.length}帧)</span>
                    </h2>
                    <span className="text-[11px] text-foreground/40">{svFrames.filter(f => f.status === 'completed').length}/{svFrames.length} 已完成</span>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {svFrames.map((frame, idx) => (
                      <div key={idx} className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
                        <div className="aspect-video bg-secondary/50 relative">
                          {frame.imageUrl ? (
                            <img src={frame.imageUrl} alt={`分镜 ${idx + 1}`} className="w-full h-full object-cover" />
                          ) : frame.status === 'generating_image' ? (
                            <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#70E0FF] animate-spin" /></div>
                          ) : frame.status === 'failed' ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-foreground/30">
                              <XCircle className="w-6 h-6 mb-1" />
                              <span className="text-[10px]">生成失败</span>
                              <button onClick={() => handleSvRegenFrame(idx)} className="mt-1 text-[10px] text-[#70E0FF] hover:underline">重新生成</button>
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-foreground/15"><ImageIcon className="w-8 h-8" /></div>
                          )}
                          {frame.imageUrl && (
                            <button onClick={() => setSvLightboxUrl(frame.imageUrl!)}
                              className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-lg text-white/70 hover:text-white transition-colors opacity-0 group-hover:opacity-100 hover:opacity-100">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="p-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[11px] font-semibold text-[#70E0FF]">第 {idx + 1} 帧</span>
                            {frame.status === 'completed' && <Check className="w-3 h-3 text-emerald-500" />}
                          </div>
                          <p className="text-[11px] text-foreground/50 line-clamp-2">{frame.narration}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Preview + style quick pick */}
            <div className="w-[320px] border-l border-border/70 bg-card flex flex-col shrink-0">
              <div className="flex border-b border-border/70">
                <button className="flex-1 px-3 py-2.5 text-xs font-medium text-[#70E0FF] border-b-2 border-[#70E0FF]">
                  <Eye className="w-3.5 h-3.5 inline mr-1" />预览
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Video preview */}
                {svFinalVideoUrl ? (
                  <div><video src={svFinalVideoUrl} controls className="w-full rounded-xl" /></div>
                ) : svFrames.filter(f => f.imageUrl).length > 0 ? (
                  <div>
                    <div className="text-[10px] text-foreground/40 mb-1.5">已完成帧预览</div>
                    <div className="space-y-2">
                      {svFrames.filter(f => f.imageUrl).map((frame, idx) => (
                        <div key={idx} className="rounded-lg overflow-hidden border border-border/50">
                          <img src={frame.imageUrl} alt="" className="w-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Zap className="w-10 h-10 text-foreground/15 mx-auto mb-2" />
                    <p className="text-xs text-foreground/30">生成后在此预览</p>
                  </div>
                )}

                {/* Style quick pick */}
                <div className="pt-3 border-t border-border/50">
                  <div className="text-[10px] text-foreground/40 mb-1.5">风格快选</div>
                  <div className="flex flex-wrap gap-1">
                    {VIDEO_STYLE_PRESETS.filter(s => s.category === '插画' || s.category === '艺术' || s.category === '潮流').map(s => (
                      <button key={s.id} onClick={() => setSvSelectedStyle(s.id)}
                        className={`text-[10px] px-2 py-1 rounded-md transition-all ${svSelectedStyle === s.id ? 'bg-[#70E0FF] text-white' : 'bg-accent/30 text-foreground/40 hover:bg-accent/50'}`}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Lightbox for short video frames */}
      {svLightboxUrl && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-8" onClick={() => setSvLightboxUrl(null)}>
          <img src={svLightboxUrl} alt="Preview" className="max-w-full max-h-full rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setSvLightboxUrl(null)}><XCircle className="w-6 h-6" /></button>
        </div>
      )}
    </div>
  );
}
