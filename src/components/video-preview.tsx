'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { SubtitleOverlay } from '@/components/subtitle-overlay';
import { 
  Video, 
  Clock, 
  Palette, 
  Heart, 
  Sparkles, 
  Download, 
  Globe, 
  Lock, 
  Share2,
  Tag,
  Edit,
  RefreshCw,
  Plus,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { STYLE_OPTIONS, MOOD_OPTIONS } from '@/constants/styles';
import { 
  FILTER_OPTIONS, 
  VIDEO_RESOLUTION_OPTIONS, 
  VIDEO_RATIO_OPTIONS 
} from '@/constants/filters';
import { RemixButton } from '@/components/remix-button';

interface GeneratedVideo {
  id: string;
  videoUrl: string;
  prompt: string;
  createdAt: number;
  duration?: string;
  style?: string;
  mood?: string;
  filter?: string;
  resolution?: string;
  ratio?: string;
  isPartial?: boolean; // 是否为部分合成
  failedSegments?: number[]; // 失败的片段索引
  successSegmentCount?: number; // 成功片段数
  segmentCount?: number; // 总片段数
  // 视频文字相关
  enableVideoText?: boolean;
  videoText?: string;
  videoTextPosition?: 'top' | 'middle' | 'bottom';
  videoTextStartTime?: number;
  videoTextEndTime?: number;
  videoTextSegments?: any[];
  // 其他配置
  materials?: any[];
  enableSubtitle?: boolean;
  subtitleText?: string;
  subtitlePosition?: string;
  subtitleFontSize?: string;
  subtitleColor?: string;
  subtitleVoiceType?: string;
  subtitleSpeechSpeed?: number;
  generateVoice?: boolean;
  // 字幕降级数据（服务端烧录失败时使用前端叠加）
  srtData?: string;           // SRT格式字幕字符串
  subtitleBurned?: boolean;   // 是否已成功烧录字幕到视频
  srtEntryCount?: number;     // SRT条目数量
}

interface VideoPreviewProps {
  video: GeneratedVideo | null;
  isGenerating: boolean;
  onRemix?: () => void;
  onPublish?: (video: GeneratedVideo, title: string, description: string, tags: string[], isPublic: boolean) => void;
  onEdit?: () => void;
  onRegenerate?: (videoOrPrompt: any) => void;
}

export function VideoPreview({ video, isGenerating, onRemix, onPublish, onEdit, onRegenerate }: VideoPreviewProps) {
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDescription, setPublishDescription] = useState('');
  const [publishTags, setPublishTags] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleRegenerate = () => {
    if (onRegenerate && video) {
      const combinedPrompt = additionalPrompt.trim() 
        ? `${video.prompt}, ${additionalPrompt}`.trim()
        : video.prompt;
      
      // 如果有额外提示词，只传递组合后的提示词；否则传递完整对象
      if (additionalPrompt.trim()) {
        onRegenerate(combinedPrompt);
      } else {
        onRegenerate(video);
      }
      
      setShowRegenerateForm(false);
      setAdditionalPrompt('');
    }
  };

  const handleVideoLoad = useCallback(() => {
    setVideoLoading(false);
    setVideoError(null);
  }, []);

  const handleVideoError = useCallback(async (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    setVideoLoading(false);
    const videoElement = e.currentTarget;
    let errorMsg = '视频加载失败，请检查视频链接或网络连接';
    let retryWithProxy = false;
    
    // 尝试获取更详细的错误信息
    if (videoElement.error) {
      console.error('[Video Preview] Video load error:', {
        code: videoElement.error.code,
        message: videoElement.error.message,
        videoUrl: video?.videoUrl
      });
      
      switch (videoElement.error.code) {
        case 1:
          errorMsg = '视频加载中断，请重试';
          break;
        case 2:
          errorMsg = '网络错误，请检查网络连接';
          break;
        case 3:
          errorMsg = '视频解码错误，可能格式不支持';
          break;
        case 4:
          errorMsg = '视频链接无效或已过期';
          break;
        default:
          errorMsg = '未知错误，请重试';
      }
    }
    
    // 尝试fetch检查视频URL是否可访问
    if (video?.videoUrl) {
      try {
        const response = await fetch(video.videoUrl, { 
          method: 'HEAD',
          mode: 'cors'
        });
        if (!response.ok) {
          console.error('[Video Preview] Video URL fetch failed:', response.status, response.statusText);
          errorMsg = `视频链接不可访问 (${response.status})`;
        }
      } catch (fetchError) {
        console.error('[Video Preview] Video URL fetch error:', fetchError);
        // 如果是CORS错误，提示用户并提供代理方案
        if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
          errorMsg = '视频跨域访问被阻止，请检查CORS设置';
          retryWithProxy = true;
        }
      }
    }
    
    setVideoError(errorMsg);
    
    // 如果是跨域错误，自动使用代理重试
    if (retryWithProxy && video?.videoUrl) {
      console.log('[Video Preview] Retrying with proxy...');
      setTimeout(() => {
        setVideoLoading(true);
        setVideoError(null);
        // 使用代理URL
        const proxyUrl = `/api/video/proxy?url=${encodeURIComponent(video.videoUrl)}`;
        if (videoRef.current) {
          videoRef.current.src = proxyUrl;
          videoRef.current.load();
        }
      }, 100);
    }
  }, [video]);

  // Reset loading state when video changes
  useEffect(() => {
    if (video?.videoUrl) {
      setVideoLoading(true);
      setVideoError(null);
    }
  }, [video?.videoUrl]);

  const handlePublish = () => {
    if (video && onPublish) {
      const tagsArray = publishTags.split(',').map(tag => tag.trim()).filter(Boolean);
      onPublish(video, publishTitle, publishDescription, tagsArray, isPublic);
      setShowPublishForm(false);
      setPublishTitle('');
      setPublishDescription('');
      setPublishTags('');
    }
  };

  const togglePublic = () => {
    setIsPublic(!isPublic);
  };
  const getStyleLabel = (styleValue: string) => {
    return STYLE_OPTIONS.find(s => s.value === styleValue)?.label || styleValue;
  };

  const getMoodLabel = (moodValue: string) => {
    return MOOD_OPTIONS.find(m => m.value === moodValue)?.label || moodValue;
  };

  const getFilterLabel = (filterValue: string) => {
    return FILTER_OPTIONS.find(f => f.value === filterValue)?.label || filterValue;
  };

  const getResolutionLabel = (resolutionValue: string) => {
    return VIDEO_RESOLUTION_OPTIONS.find(r => r.value === resolutionValue)?.label || resolutionValue;
  };

  const getRatioLabel = (ratioValue: string) => {
    return VIDEO_RATIO_OPTIONS.find(r => r.value === ratioValue)?.label || ratioValue;
  };

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="w-5 h-5 text-red-600" />
          视频预览
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isGenerating ? (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
              <p className="text-sm text-muted-foreground">视频生成中，请稍候...</p>
            </div>
          </div>
        ) : video ? (
          <div className="space-y-4">
            {/* Video Player */}
            <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
              {videoLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
                  <div className="text-center space-y-2">
                    <Loader2 className="w-10 h-10 animate-spin text-white mx-auto" />
                    <p className="text-sm text-foreground/80">加载视频中...</p>
                  </div>
                </div>
              )}
              {videoError && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80">
                  <div className="text-center space-y-3 px-4">
                    <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
                    <p className="text-sm text-foreground/80">{videoError}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setVideoLoading(true);
                        setVideoError(null);
                        if (videoRef.current) {
                          videoRef.current.load();
                        }
                      }}
                      className="text-xs"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      重试
                    </Button>
                  </div>
                </div>
              )}
              <video
                ref={videoRef}
                key={video.videoUrl}
                controls
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                preload="metadata"
                crossOrigin="anonymous"
                onLoadedData={handleVideoLoad}
                onCanPlay={handleVideoLoad}
                onError={handleVideoError}
              >
                <source src={video.videoUrl} type="video/mp4" />
                您的浏览器不支持视频播放
              </video>

              {/* 字幕叠加层（当服务端烧录失败时使用前端渲染降级） */}
              {video.srtData && !video.subtitleBurned && (
                <SubtitleOverlay
                  srtData={video.srtData}
                  videoRef={videoRef}
                  position={(video.subtitlePosition as 'top' | 'middle' | 'bottom') || 'bottom'}
                  fontSize={(video.subtitleFontSize as 'small' | 'medium' | 'large') || 'medium'}
                  color={video.subtitleColor || '#FFFFFF'}
                />
              )}
            </div>

            {/* Video Info */}
            <div className="space-y-3">
              {/* 部分合成警告 */}
              {video.isPartial && (
                <div className="p-3 bg-red-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-800">
                      <p className="font-medium">部分生成成功</p>
                      <p className="text-red-700">
                        片段 {video.failedSegments?.join(', ')} 生成失败，
                        已为您合成 {video.successSegmentCount}/{video.segmentCount} 个片段的视频。
                        时长可能比预期短。
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        系统已自动尝试 3 次修复，失败的片段可能存在暂时性问题。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-1">视频描述</p>
                <p className="text-sm text-muted-foreground line-clamp-3">{video.prompt}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {video.duration && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {video.duration}秒
                  </Badge>
                )}
                {video.resolution && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    {getResolutionLabel(video.resolution)}
                  </Badge>
                )}
                {video.ratio && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    {getRatioLabel(video.ratio)}
                  </Badge>
                )}
                {video.style && video.style !== 'none' && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Palette className="w-3 h-3" />
                    {getStyleLabel(video.style)}
                  </Badge>
                )}
                {video.mood && video.mood !== 'none' && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {getMoodLabel(video.mood)}
                  </Badge>
                )}
                {video.filter && video.filter !== 'none' && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {getFilterLabel(video.filter)}
                  </Badge>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                生成时间: {new Date(video.createdAt).toLocaleString('zh-CN')}
              </div>
            </div>

            {/* Publish Form */}
            {showPublishForm && (
              <div className="p-4 bg-muted rounded-lg space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  发布作品
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">标题</label>
                    <Input
                      placeholder="给视频起个标题"
                      value={publishTitle}
                      onChange={(e) => setPublishTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">描述</label>
                    <Input
                      placeholder="描述一下你的视频"
                      value={publishDescription}
                      onChange={(e) => setPublishDescription(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1 flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      标签（用逗号分隔）
                    </label>
                    <Input
                      placeholder="创意, 艺术, 动画"
                      value={publishTags}
                      onChange={(e) => setPublishTags(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isPublic ? (
                        <Globe className="w-4 h-4" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                      <span className="text-sm">
                        {isPublic ? '公开可见' : '仅自己可见'}
                      </span>
                    </div>
                    <Switch checked={isPublic} onCheckedChange={togglePublic} />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handlePublish} disabled={!publishTitle}>
                      <Share2 className="w-4 h-4 mr-2" />
                      发布
                    </Button>
                    <Button variant="secondary" onClick={() => setShowPublishForm(false)}>
                      取消
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Regenerate Form */}
            {showRegenerateForm && (
              <div className="p-4 bg-muted rounded-lg space-y-4 mb-4">
                <h4 className="font-medium flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  重新生成
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">原始描述词</label>
                    <p className="text-sm text-muted-foreground bg-background p-2 rounded border">
                      {video?.prompt}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1 flex items-center gap-1">
                      <Plus className="w-3 h-3" />
                      新增描述词（可选）
                    </label>
                    <Input
                      placeholder="输入额外的描述词，将与原始描述词结合"
                      value={additionalPrompt}
                      onChange={(e) => setAdditionalPrompt(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleRegenerate}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      重新生成
                    </Button>
                    <Button variant="secondary" onClick={() => {
                      setShowRegenerateForm(false);
                      setAdditionalPrompt('');
                    }}>
                      取消
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <a
                href={video.videoUrl}
                download={`video_${video.id}.mp4`}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all hover:scale-[1.02]"
              >
                <Download className="w-4 h-4 mr-2" />
                下载视频
              </a>
              {onRegenerate && !showRegenerateForm && (
                <Button variant="secondary" onClick={() => setShowRegenerateForm(true)}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              )}
              {onEdit && (
                <Button variant="secondary" onClick={onEdit}>
                  <Edit className="w-4 h-4" />
                </Button>
              )}
              {onPublish && !showPublishForm && (
                <Button variant="secondary" onClick={() => setShowPublishForm(true)}>
                  <Share2 className="w-4 h-4" />
                </Button>
              )}
              {onRemix && (
                <RemixButton onClick={onRemix} size="default" variant="secondary" />
              )}
            </div>
          </div>
        ) : (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
            <div className="text-center space-y-2 p-8">
              <Video className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                还没有生成视频<br />
                请在左侧配置并生成你的第一个视频
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
