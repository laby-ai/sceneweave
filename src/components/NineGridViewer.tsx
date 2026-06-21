'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Maximize2, Download, ExternalLink, Grid3X3 } from 'lucide-react';

interface NineGridImage {
  index: number;
  imageUrl: string;
}

interface NineGridViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: NineGridImage[];
  prompt?: string;
  usedUserImages?: boolean;
}

export function NineGridViewer({
  open,
  onOpenChange,
  images,
  prompt,
  usedUserImages,
}: NineGridViewerProps) {
  const [selectedImage, setSelectedImage] = useState<NineGridImage | null>(null);

  const handleDownload = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nine-grid-${index + 1}.jpg`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载图片失败:', error);
      alert('下载失败，请重试');
    }
  };

  const handleOpenInNewTab = (imageUrl: string) => {
    window.open(imageUrl, '_blank');
  };

  return (
    <>
      {/* 九宫格主弹窗 */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Grid3X3 className="w-5 h-5" />
              九宫格预览
              {usedUserImages && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  使用了您上传的图片
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {prompt && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1">提示词</p>
              <p className="text-sm bg-card p-2 rounded border border-border line-clamp-2">
                {prompt}
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 gap-3 p-2">
              {images.map((image, index) => (
                <div
                  key={image.index}
                  className="relative aspect-square rounded-lg overflow-hidden group border border-border hover:border-red-400 transition-colors"
                >
                  <img
                    src={image.imageUrl}
                    alt={`九宫格 ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  
                  {/* 序号标签 */}
                  <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {index + 1}
                  </div>

                  {/* 悬停操作按钮 */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setSelectedImage(image)}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDownload(image.imageUrl, index)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenInNewTab(image.imageUrl)}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              共 {images.length} 张图片
            </p>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 单张图片放大查看 */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        {selectedImage && (
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>图片 {selectedImage.index + 1}</span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(selectedImage.imageUrl, selectedImage.index)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenInNewTab(selectedImage.imageUrl)}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-hidden flex items-center justify-center bg-secondary rounded-lg">
              <img
                src={selectedImage.imageUrl}
                alt={`图片 ${selectedImage.index + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
