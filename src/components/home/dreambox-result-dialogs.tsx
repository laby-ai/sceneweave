'use client';

import type { RefObject } from 'react';
import {
  Copy,
  Download,
  FileText,
  Film,
  Grid3X3,
  Image as ImageIcon,
  RefreshCw,
  Video,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SubtitleOverlay } from '@/components/subtitle-overlay';

interface CopywritingResult {
  content?: string;
  imageUrls?: string[];
  platform?: string;
  prompt: string;
}

interface DreamboxResultDialogsProps {
  currentCopywriting: CopywritingResult | null;
  currentStoryboardTask: any;
  setShowCopywritingDialog: (open: boolean) => void;
  setShowStoryboardDialog: (open: boolean) => void;
  showCopywritingDialog: boolean;
  showStoryboardDialog: boolean;
  storyboardVideoRef: RefObject<HTMLVideoElement | null>;
}

export function DreamboxResultDialogs({
  currentCopywriting,
  currentStoryboardTask,
  setShowCopywritingDialog,
  setShowStoryboardDialog,
  showCopywritingDialog,
  showStoryboardDialog,
  storyboardVideoRef,
}: DreamboxResultDialogsProps) {
  return (
    <>
      <Dialog open={showStoryboardDialog} onOpenChange={setShowStoryboardDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Film className="w-6 h-6 text-[#70E0FF]" />
              分镜头生成结果
            </DialogTitle>
            <DialogDescription>
              {currentStoryboardTask?.result?.totalShots && (
                <span className="inline-flex items-center gap-1">
                  共 {currentStoryboardTask.result.totalShots} 个分镜头，总时长 {currentStoryboardTask.result.totalDuration} 秒
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {currentStoryboardTask && (
            <div className="space-y-6">
              {currentStoryboardTask.result?.videoUrl && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Video className="w-5 h-5" />
                    最终视频
                  </h3>
                  <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                    <video
                      ref={storyboardVideoRef}
                      src={currentStoryboardTask.result.videoUrl}
                      controls
                      className="w-full h-full object-contain"
                      crossOrigin="anonymous"
                      playsInline
                    />
                    {currentStoryboardTask.result?.srtData && !currentStoryboardTask.result?.subtitleBurned && (
                      <SubtitleOverlay
                        srtData={currentStoryboardTask.result.srtData}
                        videoRef={storyboardVideoRef}
                        position="bottom"
                        fontSize="medium"
                        color="#FFFFFF"
                      />
                    )}
                  </div>
                </div>
              )}

              {currentStoryboardTask.result?.shots && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Grid3X3 className="w-5 h-5" />
                    分镜头详情
                  </h3>

                  <div className="space-y-4">
                    {currentStoryboardTask.result.shots.map((shot: any, index: number) => (
                      <div key={shot.id} className="bg-accent/30 rounded-lg p-4 border border-border">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary" className="bg-[#70E0FF] text-black">
                                分镜头 {index + 1}
                              </Badge>
                              <Badge variant="secondary">{shot.duration} 秒</Badge>
                              {shot.status && (
                                <Badge
                                  variant="secondary"
                                  className={
                                    shot.status === 'video_generated'
                                      ? 'bg-green-500 text-white'
                                      : shot.status === 'images_generated'
                                        ? 'bg-cyan-500 text-black'
                                        : shot.status === 'failed'
                                          ? 'bg-amber-500 text-black'
                                          : 'bg-secondary text-foreground'
                                  }
                                >
                                  {shot.status === 'video_generated'
                                    ? '已完成'
                                    : shot.status === 'images_generated'
                                      ? '图片已生成'
                                      : shot.status === 'failed'
                                        ? '失败'
                                        : shot.status}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{shot.prompt}</p>
                            {shot.error && <p className="text-xs text-amber-200 mt-1">{shot.error}</p>}
                          </div>
                        </div>

                        {shot.nineGridImages && shot.nineGridImages.length > 0 && (
                          <div className="space-y-2 mb-4">
                            <h4 className="text-sm font-medium text-foreground/70">九宫格图片</h4>
                            <div className="grid grid-cols-3 md:grid-cols-9 gap-2">
                              {shot.nineGridImages.map((url: string, imgIndex: number) => (
                                <div key={imgIndex} className="aspect-video bg-black rounded overflow-hidden relative group">
                                  <img
                                    src={url}
                                    alt={`分镜头${index + 1} - 图片${imgIndex + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute top-1 left-1 bg-black/60 rounded px-1.5 py-0.5">
                                    <span className="text-xs text-white">{imgIndex + 1}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {shot.videoUrl && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-foreground/70">分镜头视频</h4>
                            <div className="aspect-video bg-black rounded-lg overflow-hidden">
                              <video src={shot.videoUrl} controls className="w-full h-full object-contain" />
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-xs"
                            onClick={async () => {
                              try {
                                const response = await fetch('/api/storyboard/regenerate-shot', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    taskId: currentStoryboardTask.id,
                                    shotId: shot.id,
                                    async: true,
                                  }),
                                });

                                if (response.ok) {
                                  alert('分镜头再生成任务已开始，请稍后在任务中心查看进度');
                                  setShowStoryboardDialog(false);
                                } else {
                                  alert('再生成失败，请重试');
                                }
                              } catch (error) {
                                console.error('再生成失败:', error);
                                alert('再生成失败，请重试');
                              }
                            }}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            再生成分镜头
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowStoryboardDialog(false)} className="flex-1">
                  关闭
                </Button>
                {currentStoryboardTask.result?.videoUrl && (
                  <Button
                    className="flex-1 bg-gradient-to-r from-[#70E0FF] to-[#B4E22F] hover:opacity-90 text-black"
                    onClick={async () => {
                      try {
                        const response = await fetch(currentStoryboardTask.result.videoUrl);
                        const blob = await response.blob();
                        const blobUrl = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = `storyboard-${Date.now()}.mp4`;
                        link.click();
                        window.URL.revokeObjectURL(blobUrl);
                      } catch (error) {
                        console.error('下载失败:', error);
                        alert('下载失败，请重试');
                      }
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载视频
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCopywritingDialog} onOpenChange={setShowCopywritingDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <FileText className="w-6 h-6 text-[#70E0FF]" />
              文案生成结果
            </DialogTitle>
            <DialogDescription>
              {currentCopywriting?.platform && (
                <span className="inline-flex items-center gap-1">
                  平台：
                  <span className="px-2 py-1 bg-[#70E0FF]/20 text-[#70E0FF] rounded-full text-sm">
                    {currentCopywriting.platform === 'xiaohongshu'
                      ? '小红书'
                      : currentCopywriting.platform === 'wechat'
                        ? '微信公众号'
                        : currentCopywriting.platform}
                  </span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {currentCopywriting && (
            <div className="space-y-6">
              {currentCopywriting.imageUrls && currentCopywriting.imageUrls.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    配图
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentCopywriting.imageUrls.map((url, index) => (
                      <div key={index} className="aspect-[3/4] bg-black rounded-lg overflow-hidden">
                        <img src={url} alt={`配图 ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  文案内容
                </h3>
                <div className="bg-accent/30 rounded-lg p-6 border border-border">
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed text-lg">
                    {currentCopywriting.content || '暂无文案内容'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground/70 flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4" />
                  原始描述
                </h3>
                <div className="bg-accent/30 rounded-lg p-4 border border-border">
                  <p className="text-foreground/70 text-sm">{currentCopywriting.prompt}</p>
                </div>
              </div>

              <DialogFooter className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowCopywritingDialog(false)} className="flex-1">
                  关闭
                </Button>
                {currentCopywriting.content && (
                  <Button
                    className="flex-1 bg-gradient-to-r from-[#70E0FF] to-[#B4E22F] hover:opacity-90 text-black"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(currentCopywriting.content!);
                        alert('文案已复制到剪贴板！');
                      } catch (error) {
                        console.error('复制失败:', error);
                        alert('复制失败，请手动复制');
                      }
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    复制文案
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
