'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { 
  Image, 
  Clock, 
  Download, 
  Palette, 
  Heart, 
  Sparkles,
  Globe,
  Lock,
  Share2,
  Tag,
  Edit,
  RefreshCw,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { STYLE_OPTIONS, MOOD_OPTIONS } from '@/constants/styles';
import { 
  FILTER_OPTIONS, 
  IMAGE_RESOLUTION_OPTIONS, 
  IMAGE_SIZE_OPTIONS, 
  IMAGE_QUALITY_OPTIONS 
} from '@/constants/filters';
import { RemixButton } from '@/components/remix-button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GeneratedImage {
  id: string;
  imageUrls: string[];
  prompt: string;
  createdAt: number;
  size?: string;
  style?: string;
  mood?: string;
  filter?: string;
  resolution?: string;
  quality?: string;
}

interface ImagePreviewProps {
  images: GeneratedImage | null;
  isGenerating: boolean;
  onRemix?: () => void;
  onPublish?: (images: GeneratedImage, title: string, description: string, tags: string[], isPublic: boolean) => void;
  onEdit?: () => void;
  onRegenerate?: (imageOrPrompt: any) => void;
}

export function ImagePreview({ images, isGenerating, onRemix, onPublish, onEdit, onRegenerate }: ImagePreviewProps) {
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDescription, setPublishDescription] = useState('');
  const [publishTags, setPublishTags] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  
  // 全屏预览状态
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);

  const handleRegenerate = () => {
    if (onRegenerate && images) {
      const combinedPrompt = additionalPrompt.trim() 
        ? `${images.prompt}, ${additionalPrompt}`.trim()
        : images.prompt;
      
      // 如果有额外提示词，只传递组合后的提示词；否则传递完整对象
      if (additionalPrompt.trim()) {
        onRegenerate(combinedPrompt);
      } else {
        onRegenerate(images);
      }
      
      setShowRegenerateForm(false);
      setAdditionalPrompt('');
    }
  };

  const handlePublish = () => {
    if (images && onPublish) {
      const tagsArray = publishTags.split(',').map(tag => tag.trim()).filter(Boolean);
      onPublish(images, publishTitle, publishDescription, tagsArray, isPublic);
      setShowPublishForm(false);
      setPublishTitle('');
      setPublishDescription('');
      setPublishTags('');
    }
  };

  const togglePublic = () => {
    setIsPublic(!isPublic);
  };

  // 打开全屏预览
  const openFullScreen = (index: number) => {
    setCurrentImageIndex(index);
    setZoomLevel(1);
    setShowFullScreen(true);
  };

  // 关闭全屏预览
  const closeFullScreen = () => {
    setShowFullScreen(false);
    setZoomLevel(1);
  };

  // 上一张图片
  const previousImage = () => {
    if (!images) return;
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.imageUrls.length - 1));
    setZoomLevel(1);
  };

  // 下一张图片
  const nextImage = () => {
    if (!images) return;
    setCurrentImageIndex((prev) => (prev < images.imageUrls.length - 1 ? prev + 1 : 0));
    setZoomLevel(1);
  };

  // 缩放控制
  const zoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  };

  const zoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  };

  const resetZoom = () => {
    setZoomLevel(1);
  };

  // 键盘事件处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showFullScreen) return;
    
    switch (e.key) {
      case 'ArrowLeft':
        previousImage();
        break;
      case 'ArrowRight':
        nextImage();
        break;
      case 'Escape':
        closeFullScreen();
        break;
      case '+':
      case '=':
        zoomIn();
        break;
      case '-':
        zoomOut();
        break;
      case '0':
        resetZoom();
        break;
    }
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
    return IMAGE_RESOLUTION_OPTIONS.find(r => r.value === resolutionValue)?.label || resolutionValue;
  };

  const getSizeLabel = (sizeValue: string) => {
    return IMAGE_SIZE_OPTIONS.find(s => s.value === sizeValue)?.label || sizeValue;
  };

  const getQualityLabel = (qualityValue: string) => {
    return IMAGE_QUALITY_OPTIONS.find(q => q.value === qualityValue)?.label || qualityValue;
  };

  const downloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `image_${images?.id || 'generated'}_${index + 1}.png`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('下载失败:', error);
      // 降级方案：直接打开图片
      window.open(url, '_blank');
    }
  };

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5 text-rose-600" />
          图片预览
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isGenerating ? (
          <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto" />
              <p className="text-sm text-muted-foreground">图片生成中，请稍候...</p>
            </div>
          </div>
        ) : images && images.imageUrls.length > 0 ? (
          <div className="space-y-4">
            {/* Image Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {images.imageUrls.map((url, index) => (
                <div key={index} className="relative group cursor-pointer" onClick={() => openFullScreen(index)}>
                  <div className="aspect-square bg-black rounded-lg overflow-hidden">
                    <img
                      src={url}
                      alt={`生成的图片 ${index + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFullScreen(index);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Maximize2 className="w-4 h-4" />
                      预览
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadImage(url, index);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      下载
                    </Button>
                  </div>
                  {/* 图片编号指示器 */}
                  <div className="absolute top-2 left-2 bg-black/60 rounded px-2 py-1 text-xs text-white">
                    {index + 1} / {images.imageUrls.length}
                  </div>
                </div>
              ))}
            </div>

            {/* Image Info */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-1">图片描述</p>
                <p className="text-sm text-muted-foreground line-clamp-3">{images.prompt}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {images.resolution && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    {getResolutionLabel(images.resolution)}
                  </Badge>
                )}
                {images.size && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    {getSizeLabel(images.size)}
                  </Badge>
                )}
                {images.quality && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    {getQualityLabel(images.quality)}
                  </Badge>
                )}
                {images.style && images.style !== 'none' && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Palette className="w-3 h-3" />
                    {getStyleLabel(images.style)}
                  </Badge>
                )}
                {images.mood && images.mood !== 'none' && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {getMoodLabel(images.mood)}
                  </Badge>
                )}
                {images.filter && images.filter !== 'none' && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {getFilterLabel(images.filter)}
                  </Badge>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                生成时间: {new Date(images.createdAt).toLocaleString('zh-CN')}
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
                      placeholder="给图片起个标题"
                      value={publishTitle}
                      onChange={(e) => setPublishTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">描述</label>
                    <Input
                      placeholder="描述一下你的图片"
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
                      placeholder="创意, 艺术, 设计"
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
                      {images?.prompt}
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
            <div className="flex gap-3 justify-center">
              {onRegenerate && !showRegenerateForm && (
                <Button variant="secondary" onClick={() => setShowRegenerateForm(true)}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重新生成
                </Button>
              )}
              {onEdit && (
                <Button variant="secondary" onClick={onEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  编辑图片
                </Button>
              )}
              {onPublish && !showPublishForm && (
                <Button variant="secondary" onClick={() => setShowPublishForm(true)}>
                  <Share2 className="w-4 h-4 mr-2" />
                  发布作品
                </Button>
              )}
              {onRemix && (
                <RemixButton onClick={onRemix} size="default" variant="default" />
              )}
            </div>
          </div>
        ) : (
          <div className="aspect-square bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
            <div className="text-center space-y-2 p-8">
              <Image className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                还没有生成图片<br />
                请在左侧配置并生成你的第一张图片
              </p>
            </div>
          </div>
        )}

        {/* 全屏预览对话框 */}
        <Dialog open={showFullScreen} onOpenChange={closeFullScreen}>
          <DialogContent 
            className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0"
            onKeyDown={handleKeyDown}
          >
            <div className="relative w-full h-screen flex items-center justify-center">
              {/* 关闭按钮 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={closeFullScreen}
                className="absolute top-4 right-4 z-20 bg-black/50 hover:bg-black/70 text-white"
              >
                <X className="w-6 h-6" />
              </Button>

              {/* 缩放控制 */}
              <div className="absolute top-4 left-4 z-20 flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={zoomOut}
                  disabled={zoomLevel <= 0.5}
                  className="bg-black/50 hover:bg-black/70 text-white"
                >
                  <ZoomOut className="w-5 h-5" />
                </Button>
                <span className="bg-black/50 text-white px-3 py-2 rounded text-sm flex items-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={zoomIn}
                  disabled={zoomLevel >= 3}
                  className="bg-black/50 hover:bg-black/70 text-white"
                >
                  <ZoomIn className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={resetZoom}
                  disabled={zoomLevel === 1}
                  className="bg-black/50 hover:bg-black/70 text-white"
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
              </div>

              {/* 导航按钮 */}
              {images && images.imageUrls.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={previousImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white"
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white"
                  >
                    <ChevronRight className="w-8 h-8" />
                  </Button>
                </>
              )}

              {/* 图片 */}
              <div className="relative overflow-hidden max-w-[90vw] max-h-[85vh]">
                {images && (
                  <img
                    src={images.imageUrls[currentImageIndex]}
                    alt={`预览图片 ${currentImageIndex + 1}`}
                    className="max-w-full max-h-[85vh] object-contain transition-transform duration-200"
                    style={{ transform: `scale(${zoomLevel})` }}
                  />
                )}
              </div>

              {/* 底部信息 */}
              {images && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-white text-sm">
                        {currentImageIndex + 1} / {images.imageUrls.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadImage(images.imageUrls[currentImageIndex], currentImageIndex)}
                        className="text-white hover:text-foreground"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        下载图片
                      </Button>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      ← → 切换图片 | +/- 缩放 | ESC 关闭
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
