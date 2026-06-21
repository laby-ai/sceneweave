'use client';

import React, { useState, useCallback } from 'react';
import {
  X,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Video,
  ImageIcon,
  Clock,
  Sparkles,
  Wand2,
  Play,
} from 'lucide-react';

export interface WorkDetailData {
  /** 唯一标识 */
  id: string;
  /** 媒体类型 */
  type: 'video' | 'image';
  /** 媒体 URL */
  mediaUrls: string[];
  /** 原始提示词 */
  prompt: string;
  /** AI 增强提示词（可选） */
  enhancedPrompt?: string;
  /** 负面提示词（可选） */
  negativePrompt?: string;
  /** 生成参数 */
  params?: {
    duration?: string;
    ratio?: string;
    size?: string;
    style?: string;
    model?: string;
    resolution?: string;
    mood?: string;
    [key: string]: string | undefined;
  };
  /** 创建时间戳 */
  createdAt?: number;
  /** 服务来源 */
  provider?: string;
  /** 是否降级 */
  degraded?: boolean;
}

interface WorkDetailOverlayProps {
  open: boolean;
  data: WorkDetailData | null;
  onClose: () => void;
  /** 点击"使用此提示词"回调 */
  onUsePrompt?: (prompt: string) => void;
}

export function WorkDetailOverlay({ open, data, onClose, onUsePrompt }: WorkDetailOverlayProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const formatDate = useCallback((timestamp?: number) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }, []);

  // 重置状态
  const handleClose = useCallback(() => {
    setShowPrompt(false);
    setCurrentMediaIndex(0);
    setIsZoomed(false);
    onClose();
  }, [onClose]);

  if (!open || !data) return null;

  const hasMultipleMedia = data.mediaUrls.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* 主内容区 */}
      <div className="relative z-10 w-[90vw] max-w-4xl max-h-[85vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
        {/* 顶部关闭栏 */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            {data.type === 'video' ? (
              <Video className="w-4.5 h-4.5 text-[#EF4444]" />
            ) : (
              <ImageIcon className="w-4.5 h-4.5 text-[#EF4444]" />
            )}
            <span className="text-sm font-semibold text-foreground">
              {data.type === 'video' ? '视频作品' : '图像作品'}
            </span>
            {data.degraded && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                备用服务
              </span>
            )}
            {data.provider && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                {data.provider}
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 媒体预览区 */}
        <div className="flex-1 min-h-0 relative bg-black/5 dark:bg-black/20 flex items-center justify-center overflow-hidden">
          {data.mediaUrls.length > 0 && data.mediaUrls[0] ? (
            <>
              {data.type === 'video' ? (
                <video
                  key={data.mediaUrls[currentMediaIndex]}
                  src={data.mediaUrls[currentMediaIndex]}
                  className="max-w-full max-h-[55vh] object-contain rounded-lg"
                  controls
                  autoPlay
                />
              ) : (
                <img
                  key={data.mediaUrls[currentMediaIndex]}
                  src={data.mediaUrls[currentMediaIndex]}
                  alt={data.prompt}
                  className={`max-w-full max-h-[55vh] object-contain rounded-lg transition-transform duration-200 cursor-zoom-in ${isZoomed ? 'scale-[2.5] cursor-zoom-out' : ''}`}
                  onClick={() => setIsZoomed(!isZoomed)}
                />
              )}

              {/* 多图导航 */}
              {hasMultipleMedia && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1">
                  {data.mediaUrls.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentMediaIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        idx === currentMediaIndex
                          ? 'bg-[#EF4444] w-4'
                          : 'bg-white/50 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              {data.type === 'video' ? (
                <Video className="w-12 h-12 mb-3 opacity-30" />
              ) : (
                <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
              )}
              <span className="text-sm">媒体内容不可用</span>
            </div>
          )}
        </div>

        {/* 底部信息区 - 默认只显示类型和时间，点击展开提示词 */}
        <div className="flex-shrink-0 border-t border-border">
          {/* 提示词展开/收起按钮 */}
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#EF4444]" />
              <span className="text-sm font-medium text-foreground">
                {showPrompt ? '收起提示词' : '查看提示词'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {data.createdAt && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(data.createdAt)}
                </span>
              )}
              {showPrompt ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {/* 提示词详情区域 */}
          {showPrompt && (
            <div className="px-5 pb-4 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
              {/* 原始提示词 */}
              {data.prompt && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-muted-foreground">提示词</span>
                    <button
                      onClick={() => handleCopy(data.prompt)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? '已复制' : '复制'}
                    </button>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/80 text-sm text-foreground leading-relaxed">
                    {data.prompt}
                  </div>
                </div>
              )}

              {/* AI 增强提示词 */}
              {data.enhancedPrompt && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-[#EF4444]" />
                    <span className="text-xs font-medium text-muted-foreground">AI 优化提示词</span>
                    <button
                      onClick={() => handleCopy(data.enhancedPrompt!)}
                      className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      复制
                    </button>
                  </div>
                  <div className="p-3 rounded-lg bg-[#EF4444]/5 border border-[#EF4444]/20 text-sm text-foreground leading-relaxed">
                    {data.enhancedPrompt}
                  </div>
                </div>
              )}

              {/* 负面提示词 */}
              {data.negativePrompt && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground mb-1.5 block">负面提示词</span>
                  <div className="p-3 rounded-lg bg-secondary/50 text-sm text-muted-foreground leading-relaxed">
                    {data.negativePrompt}
                  </div>
                </div>
              )}

              {/* 生成参数 */}
              {data.params && Object.values(data.params).some(Boolean) && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground mb-1.5 block">生成参数</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(data.params)
                      .filter(([, v]) => v)
                      .map(([key, val]) => (
                        <span
                          key={key}
                          className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-xs text-muted-foreground"
                        >
                          {key === 'duration' ? '时长' :
                           key === 'ratio' ? '比例' :
                           key === 'size' ? '尺寸' :
                           key === 'style' ? '风格' :
                           key === 'model' ? '模型' :
                           key === 'resolution' ? '分辨率' :
                           key === 'mood' ? '氛围' : key}
                          ：{val}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* 使用此提示词按钮 */}
              {onUsePrompt && (
                <button
                  onClick={() => {
                    onUsePrompt(data.enhancedPrompt || data.prompt);
                    handleClose();
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#EF4444] text-black font-semibold text-sm hover:bg-[#EF4444]/80 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  使用此提示词创作
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
