'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Video, Type, Music, Scissors, Merge, Sparkles,
  Download, Undo, Redo, Save, Play, Pause,
  SkipBack, SkipForward, Maximize2, Trash2,
  Plus, Check, X, Upload, Clock, Layers, Palette,
  Share2, Globe, Lock, Tag
} from 'lucide-react';
import { FileUpload } from '@/components/file-upload';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { useAuth } from '@/contexts/AuthContext';
import { useCommunity } from '@/contexts/CommunityContext';

interface Subtitle {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  color: string;
  fontSize: number;
}

interface Effect {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  intensity: number;
}

interface AudioTrack {
  id: string;
  name: string;
  url: string;
  volume: number;
  startTime: number;
  endTime: number;
}

interface VideoClip {
  id: string;
  url: string;
  name: string;
  duration: number;
}

interface VideoEditorProps {
  initialVideo?: string;
  onSave?: (videoData: string) => void;
  onClose?: () => void;
  onShareToCommunity?: (videoData: string, title: string, description: string, tags: string[], category: string, isPublic: boolean) => void;
}

// 特效预设
const EFFECT_PRESETS = [
  { id: 'none', name: '无特效', icon: '✨' },
  { id: 'vintage', name: '复古', icon: '📷' },
  { id: 'bokeh', name: '虚化', icon: '💫' },
  { id: 'glitch', name: '故障', icon: '⚡' },
  { id: 'slowmo', name: '慢动作', icon: '🐢' },
  { id: 'timelapse', name: '快进', icon: '🚀' },
  { id: 'sepia', name: '复古棕', icon: '🍂' },
  { id: 'bw', name: '黑白', icon: '⬛' },
];

// 字幕颜色
const SUBTITLE_COLORS = [
  '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080'
];

export function VideoEditor({ initialVideo, onSave, onClose, onShareToCommunity }: VideoEditorProps) {
  const { user } = useAuth();
  const { addPost } = useCommunity();
  
  const [activeTab, setActiveTab] = useState('clip');
  const [currentVideo, setCurrentVideo] = useState<string | null>(initialVideo || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  
  // 分享到社区相关状态
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareTitle, setShareTitle] = useState('');
  const [shareDescription, setShareDescription] = useState('');
  const [shareTags, setShareTags] = useState<string[]>([]);
  const [shareTagInput, setShareTagInput] = useState('');
  const [shareCategory, setShareCategory] = useState('自定义');
  const [shareIsPublic, setShareIsPublic] = useState(true);
  
  // 裁剪功能
  const [cropStartTime, setCropStartTime] = useState(0);
  const [cropEndTime, setCropEndTime] = useState(0);
  
  // 字幕功能
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');
  const [currentSubtitleStart, setCurrentSubtitleStart] = useState(0);
  const [currentSubtitleEnd, setCurrentSubtitleEnd] = useState(5);
  const [currentSubtitleColor, setCurrentSubtitleColor] = useState('#ffffff');
  const [currentSubtitleFontSize, setCurrentSubtitleFontSize] = useState(24);
  
  // 特效功能
  const [effects, setEffects] = useState<Effect[]>([]);
  const [currentEffect, setCurrentEffect] = useState('none');
  const [effectIntensity, setEffectIntensity] = useState(50);
  
  // 音频功能
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [currentAudioVolume, setCurrentAudioVolume] = useState(70);
  
  // 拼接功能
  const [videoClips, setVideoClips] = useState<VideoClip[]>([]);
  
  // 历史记录
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoUpload = (file: File, previewUrl: string) => {
    setCurrentVideo(previewUrl);
    setCropStartTime(0);
    setCropEndTime(0);
  };

  const handleClearVideo = () => {
    setCurrentVideo(null);
    setSubtitles([]);
    setEffects([]);
    setAudioTracks([]);
    setVideoClips([]);
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setCropEndTime(videoRef.current.duration);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // 字幕功能
  const addSubtitle = () => {
    if (!currentSubtitleText.trim()) return;
    
    const newSubtitle: Subtitle = {
      id: Date.now().toString(),
      text: currentSubtitleText,
      startTime: currentSubtitleStart,
      endTime: currentSubtitleEnd,
      color: currentSubtitleColor,
      fontSize: currentSubtitleFontSize,
    };
    
    setSubtitles([...subtitles, newSubtitle]);
    setCurrentSubtitleText('');
  };

  const deleteSubtitle = (id: string) => {
    setSubtitles(subtitles.filter(s => s.id !== id));
  };

  // 特效功能
  const addEffect = () => {
    if (currentEffect === 'none') return;
    
    const newEffect: Effect = {
      id: Date.now().toString(),
      name: currentEffect,
      startTime: currentTime,
      endTime: Math.min(currentTime + 5, duration),
      intensity: effectIntensity,
    };
    
    setEffects([...effects, newEffect]);
  };

  const deleteEffect = (id: string) => {
    setEffects(effects.filter(e => e.id !== id));
  };

  // 音频功能
  const handleAudioUpload = (file: File, previewUrl: string) => {
    const newAudio: AudioTrack = {
      id: Date.now().toString(),
      name: file.name,
      url: previewUrl,
      volume: currentAudioVolume,
      startTime: 0,
      endTime: duration || 60,
    };
    
    setAudioTracks([...audioTracks, newAudio]);
  };

  const deleteAudio = (id: string) => {
    setAudioTracks(audioTracks.filter(a => a.id !== id));
  };

  // 视频拼接功能
  const handleClipUpload = (file: File, previewUrl: string) => {
    const newClip: VideoClip = {
      id: Date.now().toString(),
      url: previewUrl,
      name: file.name,
      duration: 0, // 实际应该从视频获取
    };
    
    setVideoClips([...videoClips, newClip]);
  };

  const deleteClip = (id: string) => {
    setVideoClips(videoClips.filter(c => c.id !== id));
  };

  const moveClip = (index: number, direction: 'up' | 'down') => {
    const newClips = [...videoClips];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < newClips.length) {
      [newClips[index], newClips[newIndex]] = [newClips[newIndex], newClips[index]];
      setVideoClips(newClips);
    }
  };

  // 导出功能
  const handleExport = () => {
    // 模拟导出
    if (onSave && currentVideo) {
      onSave(currentVideo);
    }
  };

  const handleDownload = () => {
    if (!currentVideo) return;
    
    const link = document.createElement('a');
    link.href = currentVideo;
    link.download = `edited-video-${Date.now()}.mp4`;
    link.click();
  };

  const handleSave = () => {
    if (onSave && currentVideo) {
      onSave(currentVideo);
    }
  };

  const handleShareToCommunity = () => {
    if (!currentVideo) return;
    setShareTitle('');
    setShareDescription('');
    setShareTags([]);
    setShareTagInput('');
    setShareCategory('自定义');
    setShareIsPublic(true);
    setShowShareDialog(true);
  };

  const confirmShareToCommunity = () => {
    if (!currentVideo || !shareTitle.trim()) {
      alert('请输入作品标题');
      return;
    }

    if (onShareToCommunity) {
      onShareToCommunity(
        currentVideo,
        shareTitle,
        shareDescription,
        shareTags,
        shareCategory,
        shareIsPublic
      );
    } else {
      addPost({
        type: 'video',
        title: shareTitle,
        description: shareDescription,
        mediaUrl: currentVideo,
        prompt: '编辑的视频',
        authorId: user?.id || 'anonymous',
        authorName: user?.username || '匿名用户',
        authorAvatar: user?.avatar,
        tags: shareTags,
        category: shareCategory,
        isPublic: shareIsPublic,
      });
    }

    setShowShareDialog(false);
    alert('分享成功！');
  };

  const addShareTag = () => {
    if (shareTagInput.trim() && !shareTags.includes(shareTagInput.trim())) {
      setShareTags([...shareTags, shareTagInput.trim()]);
      setShareTagInput('');
    }
  };

  const removeShareTag = (tagToRemove: string) => {
    setShareTags(shareTags.filter(tag => tag !== tagToRemove));
  };

  const handleShare = async () => {
    if (!currentVideo) return;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: '我的创作',
          text: '看看我用 AI 创意工坊编辑的视频！',
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('链接已复制到剪贴板！');
      }
    } catch (error) {
      console.error('分享失败:', error);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6" />
            视频编辑器
          </h2>
          <p className="text-muted-foreground">裁剪、字幕、特效、音频、拼接</p>
        </div>
        {onClose && (
          <Button variant="secondary" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            关闭
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Tools */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">编辑工具</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="clip" className="p-2">
                    <Scissors className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="subtitle" className="p-2">
                    <Type className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="effect" className="p-2">
                    <Sparkles className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="audio" className="p-2">
                    <Music className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="merge" className="p-2">
                    <Merge className="w-4 h-4" />
                  </TabsTrigger>
                </TabsList>

                {/* Clip Tab */}
                <TabsContent value="clip" className="space-y-4 mt-4">
                  {!currentVideo ? (
                    <FileUpload
                      onFileSelect={handleVideoUpload}
                      onClear={handleClearVideo}
                      type="video"
                      accept="video/*"
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>裁剪起点: {formatTime(cropStartTime)}</Label>
                        <Slider
                          value={[cropStartTime]}
                          onValueChange={(value) => setCropStartTime(value[0])}
                          min={0}
                          max={duration || 100}
                          step={0.1}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>裁剪终点: {formatTime(cropEndTime)}</Label>
                        <Slider
                          value={[cropEndTime]}
                          onValueChange={(value) => setCropEndTime(value[0])}
                          min={0}
                          max={duration || 100}
                          step={0.1}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground text-center">
                        裁剪时长: {formatTime(cropEndTime - cropStartTime)}
                      </div>
                      <Button className="w-full">
                        <Scissors className="w-4 h-4 mr-2" />
                        应用裁剪
                      </Button>
                    </div>
                  )}
                </TabsContent>

                {/* Subtitle Tab */}
                <TabsContent value="subtitle" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>字幕内容</Label>
                      <Textarea
                        value={currentSubtitleText}
                        onChange={(e) => setCurrentSubtitleText(e.target.value)}
                        placeholder="输入字幕文字..."
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>开始时间 (秒)</Label>
                        <Input
                          type="number"
                          value={currentSubtitleStart}
                          onChange={(e) => setCurrentSubtitleStart(parseFloat(e.target.value) || 0)}
                          min={0}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>结束时间 (秒)</Label>
                        <Input
                          type="number"
                          value={currentSubtitleEnd}
                          onChange={(e) => setCurrentSubtitleEnd(parseFloat(e.target.value) || 5)}
                          min={0}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>字体大小: {currentSubtitleFontSize}px</Label>
                      <Slider
                        value={[currentSubtitleFontSize]}
                        onValueChange={(value) => setCurrentSubtitleFontSize(value[0])}
                        min={12}
                        max={48}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>字幕颜色</Label>
                      <div className="flex flex-wrap gap-2">
                        {SUBTITLE_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setCurrentSubtitleColor(color)}
                            className={`w-8 h-8 rounded-full border-2 ${
                              currentSubtitleColor === color ? 'border-primary ring-2 ring-primary/50' : 'border-border'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <Button onClick={addSubtitle} disabled={!currentSubtitleText.trim()} className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      添加字幕
                    </Button>
                  </div>

                  {/* Subtitle List */}
                  {subtitles.length > 0 && (
                    <div className="space-y-2 mt-4 pt-4 border-t">
                      <Label className="text-sm font-medium">已添加的字幕</Label>
                      {subtitles.map((subtitle) => (
                        <div key={subtitle.id} className="p-3 bg-muted rounded-lg flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{subtitle.text}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(subtitle.startTime)} - {formatTime(subtitle.endTime)}
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteSubtitle(subtitle.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Effect Tab */}
                <TabsContent value="effect" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>选择特效</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {EFFECT_PRESETS.map((effect) => (
                          <button
                            key={effect.id}
                            onClick={() => setCurrentEffect(effect.id)}
                            className={`p-3 rounded-lg border-2 text-center transition-all ${
                              currentEffect === effect.id
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <span className="text-xl">{effect.icon}</span>
                            <p className="text-xs mt-1">{effect.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    {currentEffect !== 'none' && (
                      <>
                        <div className="space-y-2">
                          <Label>特效强度: {effectIntensity}%</Label>
                          <Slider
                            value={[effectIntensity]}
                            onValueChange={(value) => setEffectIntensity(value[0])}
                            min={0}
                            max={100}
                            step={1}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>开始时间 (秒)</Label>
                            <Input
                              type="number"
                              value={currentTime}
                              onChange={(e) => setCurrentTime(parseFloat(e.target.value) || 0)}
                              min={0}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>持续时间 (秒)</Label>
                            <Input
                              type="number"
                              defaultValue={5}
                              min={1}
                            />
                          </div>
                        </div>
                        <Button onClick={addEffect} className="w-full">
                          <Sparkles className="w-4 h-4 mr-2" />
                          应用特效
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Effects List */}
                  {effects.length > 0 && (
                    <div className="space-y-2 mt-4 pt-4 border-t">
                      <Label className="text-sm font-medium">已添加的特效</Label>
                      {effects.map((effect) => (
                        <div key={effect.id} className="p-3 bg-muted rounded-lg flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">
                              {EFFECT_PRESETS.find(e => e.id === effect.name)?.name || effect.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(effect.startTime)} - {formatTime(effect.endTime)} | 强度: {effect.intensity}%
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteEffect(effect.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Audio Tab */}
                <TabsContent value="audio" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <FileUpload
                      onFileSelect={handleAudioUpload}
                      onClear={() => {}}
                      type="video"
                      accept="audio/*"
                    />
                    <div className="space-y-2">
                      <Label>背景音乐音量: {currentAudioVolume}%</Label>
                      <Slider
                        value={[currentAudioVolume]}
                        onValueChange={(value) => setCurrentAudioVolume(value[0])}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                  </div>

                  {/* Audio Tracks List */}
                  {audioTracks.length > 0 && (
                    <div className="space-y-2 mt-4 pt-4 border-t">
                      <Label className="text-sm font-medium">音轨列表</Label>
                      {audioTracks.map((track) => (
                        <div key={track.id} className="p-3 bg-muted rounded-lg flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{track.name}</p>
                            <p className="text-xs text-muted-foreground">
                              音量: {track.volume}%
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteAudio(track.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Merge Tab */}
                <TabsContent value="merge" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <FileUpload
                      onFileSelect={handleClipUpload}
                      onClear={() => {}}
                      type="video"
                      accept="video/*"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      上传多个视频进行拼接
                    </p>
                  </div>

                  {/* Video Clips List */}
                  {videoClips.length > 0 && (
                    <div className="space-y-2 mt-4 pt-4 border-t">
                      <Label className="text-sm font-medium">视频片段 (拖拽排序)</Label>
                      {videoClips.map((clip, index) => (
                        <div key={clip.id} className="p-3 bg-muted rounded-lg flex items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => moveClip(index, 'up')}
                              disabled={index === 0}
                            >
                              ↑
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => moveClip(index, 'down')}
                              disabled={index === videoClips.length - 1}
                            >
                              ↓
                            </Button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{clip.name}</p>
                            <p className="text-xs text-muted-foreground">
                              片段 {index + 1}
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteClip(clip.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button className="w-full mt-4">
                        <Merge className="w-4 h-4 mr-2" />
                        拼接视频
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Center Panel - Video Preview */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardContent className="p-4">
              {!currentVideo ? (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center min-h-[300px]">
                  <div className="text-center space-y-2">
                    <Video className="w-12 h-12 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      先上传视频开始编辑
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Video Player */}
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      src={currentVideo}
                      className="w-full h-full object-contain"
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onEnded={() => setIsPlaying(false)}
                    />
                    
                    {/* Subtitles Overlay */}
                    {subtitles
                      .filter(s => currentTime >= s.startTime && currentTime <= s.endTime)
                      .map(subtitle => (
                        <div
                          key={subtitle.id}
                          className="absolute bottom-8 left-0 right-0 text-center px-4"
                          style={{
                            color: subtitle.color,
                            fontSize: `${subtitle.fontSize}px`,
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                          }}
                        >
                          {subtitle.text}
                        </div>
                      ))}
                  </div>

                  {/* Controls */}
                  <div className="space-y-3">
                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <Slider
                        value={[currentTime]}
                        onValueChange={(value) => handleSeek(value[0])}
                        min={0}
                        max={duration || 100}
                        step={0.1}
                        className="cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>

                    {/* Playback Controls */}
                    <div className="flex items-center justify-center gap-4">
                      <Button variant="secondary" size="sm" onClick={() => handleSeek(Math.max(0, currentTime - 5))}>
                        <SkipBack className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="default" 
                        size="lg" 
                        onClick={handlePlayPause}
                        className="w-16 h-16 rounded-full"
                      >
                        {isPlaying ? (
                          <Pause className="w-8 h-8" />
                        ) : (
                          <Play className="w-8 h-8 ml-1" />
                        )}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleSeek(Math.min(duration, currentTime + 5))}>
                        <SkipForward className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Volume Control */}
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-sm text-muted-foreground">音量</span>
                      <Slider
                        value={[volume]}
                        onValueChange={(value) => setVolume(value[0])}
                        min={0}
                        max={100}
                        step={1}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">{volume}%</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Actions */}
          {currentVideo && (
            <div className="flex gap-3 mt-4">
              <Button 
                variant="secondary" 
                size="sm" 
                disabled={historyIndex <= 0}
              >
                <Undo className="w-4 h-4 mr-2" />
                撤销
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                disabled={historyIndex >= history.length - 1}
              >
                <Redo className="w-4 h-4 mr-2" />
                重做
              </Button>
              <div className="flex-1" />
              <Button variant="secondary" size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                保存
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleDownload}
              >
                <Download className="w-4 h-4 mr-2" />
                下载
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleShareToCommunity}
              >
                <Share2 className="w-4 h-4 mr-2" />
                分享到社区
              </Button>
              <Button onClick={handleExport} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                导出视频
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 分享到社区对话框 */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>分享到社区</DialogTitle>
            <DialogDescription>
              将您的编辑作品分享到社区中心
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="share-title">作品标题</Label>
              <Input
                id="share-title"
                value={shareTitle}
                onChange={(e) => setShareTitle(e.target.value)}
                placeholder="给作品起个标题"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="share-description">描述</Label>
              <Textarea
                id="share-description"
                value={shareDescription}
                onChange={(e) => setShareDescription(e.target.value)}
                placeholder="描述一下您的作品"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="share-category">分类</Label>
              <Select value={shareCategory} onValueChange={setShareCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="自定义" key="video-category-自定义">自定义</SelectItem>
                  <SelectItem value="风景" key="video-category-风景">风景</SelectItem>
                  <SelectItem value="科幻" key="video-category-科幻">科幻</SelectItem>
                  <SelectItem value="艺术" key="video-category-艺术">艺术</SelectItem>
                  <SelectItem value="设计" key="video-category-设计">设计</SelectItem>
                  <SelectItem value="其他" key="video-category-其他">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>标签</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {shareTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <button
                      onClick={() => removeShareTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={shareTagInput}
                  onChange={(e) => setShareTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addShareTag())}
                  placeholder="添加标签"
                />
                <Button type="button" onClick={addShareTag} variant="secondary">
                  添加
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {shareIsPublic ? (
                  <Globe className="w-4 h-4" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span className="text-sm">
                  {shareIsPublic ? '公开可见' : '仅自己可见'}
                </span>
              </div>
              <Switch checked={shareIsPublic} onCheckedChange={setShareIsPublic} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowShareDialog(false)}>
              取消
            </Button>
            <Button onClick={confirmShareToCommunity} disabled={!shareTitle.trim()}>
              <Share2 className="w-4 h-4 mr-2" />
              分享
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
