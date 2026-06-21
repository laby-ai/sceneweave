'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, Download, Loader2, X, Trash2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useVideoHistory } from '@/hooks/useVideoHistory';

interface HistoryItem {
  id: string;
  type: 'video' | 'image';
  prompt: string;
  videoUrl?: string;
  imageUrls?: string[];
  createdAt: number;
  duration?: number;
  resolution?: string;
  ratio?: string;
  size?: string;
  quality?: string;
  status?: string;
}

const typeLabels: Record<'video' | 'image', string> = {
  video: '视频',
  image: '图片',
};

export function HistoryGallery() {
  const { 
    videoHistory, 
    imageHistory,
    deleteVideoHistory,
    deleteImageHistory,
  } = useVideoHistory();
  
  const [selectedType, setSelectedType] = useState<'all' | 'video' | 'image'>('all');
  const [loading, setLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState<HistoryItem | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<HistoryItem | null>(null);

  // 合并视频和图片历史记录
  const allHistory: HistoryItem[] = [
    ...videoHistory.map((item) => ({
      id: item.id,
      type: 'video' as const,
      prompt: item.prompt,
      videoUrl: item.videoUrl,
      createdAt: item.createdAt,
      duration: item.duration,
      resolution: item.resolution,
      ratio: item.ratio,
      status: item.status,
    })),
    ...imageHistory.map((item) => ({
      id: item.id,
      type: 'image' as const,
      prompt: item.prompt,
      imageUrls: item.imageUrls,
      createdAt: item.createdAt,
      size: item.size,
      resolution: item.resolution,
      quality: item.quality,
      status: item.status,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  const filteredHistory = selectedType === 'all' 
    ? allHistory 
    : allHistory.filter(item => item.type === selectedType);

  // 下载单张图片
  const downloadSingleImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  // 下载所有图片（打包成ZIP）
  const downloadAllImages = async (item: HistoryItem) => {
    if (item.type === 'image' && item.imageUrls && item.imageUrls.length > 0) {
      setDownloadingId(item.id);

      try {
        const zip = new JSZip();
        const folder = zip.folder(`${typeLabels[item.type]}_${item.id}`);
        if (!folder) return;

        for (let i = 0; i < item.imageUrls.length; i++) {
          const url = item.imageUrls[i];
          const response = await fetch(url);
          const blob = await response.blob();
          const ext = 'jpeg';
          const filename = `${item.type}_page_${i + 1}.${ext}`;
          folder.file(filename, blob);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `${typeLabels[item.type]}_${item.id}.zip`);
      } catch (error) {
        console.error('下载失败:', error);
      } finally {
        setDownloadingId(null);
      }
    } else if (item.type === 'video' && item.videoUrl) {
      downloadSingleImage(item.videoUrl, `${typeLabels[item.type]}_${item.id}.mp4`);
    }
  };

  // 删除历史记录
  const handleDeleteHistory = (item: HistoryItem) => {
    setDeleteConfirmItem(item);
  };

  // 确认删除
  const confirmDeleteHistory = () => {
    if (!deleteConfirmItem) return;
    
    if (deleteConfirmItem.type === 'video') {
      deleteVideoHistory(deleteConfirmItem.id);
    } else {
      deleteImageHistory(deleteConfirmItem.id);
    }
    
    setDeleteConfirmItem(null);
  };

  // 生成骨架屏高度
  const getSkeletonHeight = (index: number) => {
    const heights = [280, 340, 420, 310, 450, 380, 320, 400];
    return heights[index % heights.length];
  };

  return (
    <div className="space-y-8">
      {/* 类型筛选 */}
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">历史作品</h2>
        <div className="flex gap-2">
          {(['all', 'video', 'image'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:opacity-80"
              style={{
                backgroundColor: selectedType === type ? '#EF4444' : 'transparent',
                color: selectedType === type ? '#000000' : 'rgba(255, 255, 255, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {type === 'all' ? '全部' : typeLabels[type]}
            </button>
          ))}
        </div>
      </div>

      {/* 瀑布流 */}
      {loading ? (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="rounded-3xl bg-card overflow-hidden break-inside-avoid"
            >
              <div className="relative">
                <Skeleton className="w-full" style={{ height: `${getSkeletonHeight(i)}px` }} />
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">暂无历史作品，快去创作吧！</p>
        </div>
      ) : (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              className="group rounded-3xl bg-card overflow-hidden hover:scale-[1.02] transition-all duration-300 break-inside-avoid"
            >
              <div className="relative">
                {/* 有媒体的情况 */}
                {(item.type === 'video' && item.videoUrl) || (item.type === 'image' && item.imageUrls && item.imageUrls.length > 0) ? (
                  <>
                    {/* 图片：多张图片 */}
                    {item.type === 'image' && item.imageUrls && item.imageUrls.length > 1 ? (
                      <div className="flex flex-col">
                        {item.imageUrls.map((url, idx) => {
                          const isLast = idx === item.imageUrls!.length - 1;
                          return (
                            <div key={idx} className="relative">
                              <img
                                src={url}
                                alt={`${item.prompt} - 图片 ${idx + 1}`}
                                className="w-full h-auto object-cover"
                                style={{ borderBottom: !isLast ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                              />
                              {isLast && (
                                <>
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                  <div className="absolute bottom-0 left-0 right-0 p-4">
                                    <p className="text-foreground/90 text-sm font-medium line-clamp-2">
                                      {item.prompt}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-xs text-muted-foreground capitalize">
                                        {typeLabels[item.type]}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(item.createdAt).toLocaleDateString()}
                                      </span>
                                      {item.imageUrls && item.imageUrls.length > 1 && (
                                        <span className="text-xs text-muted-foreground">
                                          {item.imageUrls.length}张
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* 单张图片或视频 */
                      <>
                        {item.type === 'image' && item.imageUrls && item.imageUrls.length > 0 ? (
                          <img
                            src={item.imageUrls[0]}
                            alt={item.prompt}
                            className="w-full h-auto object-cover"
                          />
                        ) : item.type === 'video' && item.videoUrl ? (
                          <video
                            src={item.videoUrl}
                            controls
                            className="w-full h-auto object-cover"
                          />
                        ) : null}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <p className="text-foreground/90 text-sm font-medium line-clamp-2">
                            {item.prompt}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground capitalize">
                              {typeLabels[item.type]}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                            {item.duration && (
                              <span className="text-xs text-muted-foreground">
                                {item.duration}秒
                              </span>
                            )}
                            {item.resolution && (
                              <span className="text-xs text-muted-foreground">
                                {item.resolution}
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  /* 没有媒体的情况 */
                  <>
                    <div className="w-full flex flex-col items-center justify-center bg-background text-muted-foreground min-h-[200px]">
                      <span className="text-4xl mb-2">
                        {item.type === 'video' ? '🎬' : '🎨'}
                      </span>
                      <p className="text-sm">暂无内容</p>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-foreground/90 text-sm font-medium line-clamp-2">
                        {item.prompt}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground capitalize">
                          {typeLabels[item.type]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* 悬浮操作按钮 */}
                {((item.type === 'image' && item.imageUrls && item.imageUrls.length > 0) || 
                  (item.type === 'video' && item.videoUrl)) && (
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setPreviewItem(item)}
                      className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full transition-all hover:scale-110"
                      title="预览"
                    >
                      <Eye className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={() => downloadAllImages(item)}
                      disabled={downloadingId === item.id}
                      className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="下载"
                    >
                      {downloadingId === item.id ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 text-white" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteHistory(item)}
                      className="p-2 bg-black/60 hover:bg-red-600/80 backdrop-blur-sm rounded-full transition-all hover:scale-110"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 预览模态框 */}
      {previewItem && (
        <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                {typeLabels[previewItem.type]} - 预览
              </DialogTitle>
              <button
                onClick={() => setPreviewItem(null)}
                className="absolute right-4 top-4 p-1 rounded-full hover:bg-accent transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogHeader>
            <div className="space-y-6 max-h-[80vh] overflow-y-auto">
              <div>
                <p className="text-muted-foreground text-sm mb-2">提示词：</p>
                <p className="text-foreground/90">{previewItem.prompt}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-4">
                  生成内容
                  {previewItem.type === 'image' && previewItem.imageUrls && `（共 ${previewItem.imageUrls.length} 张）`}
                  ：
                </p>
                <div className="space-y-4">
                  {previewItem.type === 'image' && previewItem.imageUrls ? (
                    previewItem.imageUrls.map((url, idx) => (
                      <div key={idx} className="relative group/img">
                        <img
                          src={url}
                          alt={`${previewItem.type} - ${idx + 1}`}
                          className="w-full rounded-xl"
                        />
                        <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover/img:opacity-100 transition-opacity">
                          <button
                            onClick={() => downloadSingleImage(
                              url,
                              `${previewItem.type}_${idx + 1}.jpg`
                            )}
                            className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full transition-all"
                            title="下载此图片"
                          >
                            <Download className="w-4 h-4 text-white" />
                          </button>
                        </div>
                        <p className="text-foreground/70 text-xs mt-1">
                          图片 {idx + 1}
                        </p>
                      </div>
                    ))
                  ) : previewItem.type === 'video' && previewItem.videoUrl ? (
                    <div className="relative group/vid">
                      <video
                        src={previewItem.videoUrl}
                        controls
                        className="w-full rounded-xl"
                      />
                      <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover/vid:opacity-100 transition-opacity">
                        <button
                          onClick={() => downloadSingleImage(
                            previewItem.videoUrl!,
                            `${previewItem.type}_${previewItem.id}.mp4`
                          )}
                          className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full transition-all"
                          title="下载此视频"
                        >
                          <Download className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 删除确认对话框 */}
      {deleteConfirmItem && (
        <Dialog open={!!deleteConfirmItem} onOpenChange={(open) => !open && setDeleteConfirmItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-500" />
                确认删除
              </DialogTitle>
              <DialogDescription>
                确定要删除这个{typeLabels[deleteConfirmItem.type]}作品吗？此操作不可恢复。
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-foreground/70 mb-3">要删除的内容：</p>
              <p className="text-sm bg-accent/30 p-3 rounded-lg border border-border line-clamp-2">
                {deleteConfirmItem.prompt}
              </p>
            </div>
            <DialogFooter className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setDeleteConfirmItem(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteHistory}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                确认删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
