"use client";

import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Video,
} from 'lucide-react';
import type { EntityCard } from '@/lib/film-creation-panel-model';

type FilmComposeShotListProps = {
  shotCards: EntityCard[];
  expandedShotIds: Set<string>;
  composeProgress: Record<string, number>;
  finalVideoUrl: string | null;
  isGenerating: boolean;
  onToggleShotExpanded: (cardId: string) => void;
  onGenerateStartFrame: (cardId: string) => void;
  onGenerateEndFrame: (cardId: string) => void;
  onGenerateShotVideo: (cardId: string) => void;
  onRegenerateVideo: (cardId: string) => void;
  onRecomposeFinalVideo: () => void;
};

export function FilmComposeShotList({
  shotCards,
  expandedShotIds,
  composeProgress,
  finalVideoUrl,
  isGenerating,
  onToggleShotExpanded,
  onGenerateStartFrame,
  onGenerateEndFrame,
  onGenerateShotVideo,
  onRegenerateVideo,
  onRecomposeFinalVideo,
}: FilmComposeShotListProps) {
  return (
    <div className="flex-1 overflow-y-auto min-h-0 px-6 space-y-3 pb-4">
      {shotCards.map((card, idx) => {
        const isExpanded = expandedShotIds.has(card.id);
        const progress = composeProgress[card.id] || 0;
        const isCompleted = !!card.imageUrl && !card.isGenerating;
        const isFailed = false;
        const isShotGenerating = card.isGenerating;
        const isWaiting = !card.imageUrl && !card.isGenerating;

        return (
          <div
            key={card.id}
            className={`rounded-[10px] bg-white dark:bg-card border overflow-hidden transition-all ${
              isExpanded
                ? 'border-[#ff333f]/40 shadow-[0_2px_12px_rgba(255,51,63,0.08)]'
                : 'border-[#E5E7EB] dark:border-border hover:border-[#E5E7EB]/80 hover:shadow-sm'
            }`}
          >
            <div
              className="flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none"
              onClick={() => onToggleShotExpanded(card.id)}
            >
              {isCompleted ? (
                <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-green-500" />
                </div>
              ) : isShotGenerating ? (
                <div className="w-7 h-7 rounded-full bg-[#ff333f]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-[#ff333f]">{idx + 1}</span>
                </div>
              ) : isFailed ? (
                <div className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-accent/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-[#999] dark:text-white/50">{idx + 1}</span>
                </div>
              )}

              <span className="text-sm font-medium text-[#1a1a1a] dark:text-white">镜头 {idx + 1}</span>

              {isCompleted && (
                <span className="px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium">已完成</span>
              )}
              {isShotGenerating && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#ff333f]/5 dark:bg-[#ff333f]/10 text-[#ff333f] text-xs font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" /> 生成中 {progress}%
                </span>
              )}
              {isFailed && (
                <span className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-500/10 text-red-500 text-xs font-medium">失败</span>
              )}
              {isWaiting && (
                <span className="px-2 py-0.5 rounded-md bg-gray-50 dark:bg-accent/30 text-[#999] dark:text-white/50 text-xs font-medium">等待生成</span>
              )}

              <div className="flex-1" />

              {!isExpanded && (
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-[6px] bg-gray-50 dark:bg-accent/30 text-[#888] dark:text-white/50 text-[11px] h-7 flex items-center">16:9</span>
                  <span className="px-2 py-0.5 rounded-[6px] bg-gray-50 dark:bg-accent/30 text-[#888] dark:text-white/50 text-[11px] h-7 flex items-center">8s</span>
                  <span className="px-2 py-0.5 rounded-[6px] bg-gray-50 dark:bg-accent/30 text-[#888] dark:text-white/50 text-[11px] h-7 flex items-center">{card.cameraAngle || '固定机位'}</span>
                  <span className="px-2 py-0.5 rounded-[6px] bg-gray-50 dark:bg-accent/30 text-[#888] dark:text-white/50 text-[11px] h-7 flex items-center">{card.mood || '轻松愉快'}</span>
                </div>
              )}

              {isExpanded
                ? <ChevronUp className="w-4 h-4 text-[#999] dark:text-white/40 flex-shrink-0" />
                : <ChevronDown className="w-4 h-4 text-[#999] dark:text-white/40 flex-shrink-0" />
              }
            </div>

            {isExpanded && (
              <div className="border-t border-[#E5E7EB]/60 dark:border-border/60 px-5 pb-5 pt-4">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-1">
                    <p className="text-xs text-[#999] dark:text-white/50 mb-2 font-medium">起始帧</p>
                    <div className="relative aspect-video rounded-lg bg-gray-50 dark:bg-accent/20 border border-[#E5E7EB]/60 dark:border-border/60 overflow-hidden flex items-center justify-center">
                      {card.imageUrl ? (
                        <img src={card.imageUrl} alt="起始帧" className="w-full h-full object-cover" />
                      ) : isShotGenerating ? (
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-16 h-16" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="28" fill="none" stroke="#E5E7EB" strokeWidth="4" />
                            <circle cx="32" cy="32" r="28" fill="none" stroke="#ff333f" strokeWidth="4" strokeDasharray={`${2 * Math.PI * 28}`} strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`} strokeLinecap="round" transform="rotate(-90 32 32)" className="transition-all duration-500" />
                            <text x="32" y="36" textAnchor="middle" fill="#ff333f" fontSize="14" fontWeight="600">{progress}%</text>
                          </svg>
                          <span className="text-xs text-[#999]">生成中...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <ImageIcon className="w-8 h-8 text-[#ccc] dark:text-white/20" />
                          <span className="text-xs text-[#bbb] dark:text-white/30">未生成</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center pt-8">
                    <ArrowRight className="w-5 h-5 text-[#ccc] dark:text-white/20" />
                  </div>

                  <div className="flex-1">
                    <p className="text-xs text-[#999] dark:text-white/50 mb-2 font-medium">结束帧</p>
                    <div className="relative aspect-video rounded-lg bg-gray-50 dark:bg-accent/20 border border-[#E5E7EB]/60 dark:border-border/60 overflow-hidden flex items-center justify-center">
                      {card.lastFrameUrl ? (
                        <img src={card.lastFrameUrl} alt="结束帧" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <ImageIcon className="w-8 h-8 text-[#ccc] dark:text-white/20" />
                          <span className="text-xs text-[#bbb] dark:text-white/30">未生成</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-[#444] dark:text-white/80 leading-relaxed mb-3">
                  {card.action || card.description || card.promptCn || '暂无描述'}
                </p>

                <div className="flex items-center gap-1.5 mb-4">
                  <span className="px-2.5 py-1 rounded-[6px] bg-gray-50 dark:bg-accent/30 text-[#666] dark:text-white/50 text-xs h-7 flex items-center">16:9 宽屏</span>
                  <span className="px-2.5 py-1 rounded-[6px] bg-gray-50 dark:bg-accent/30 text-[#666] dark:text-white/50 text-xs h-7 flex items-center">8s</span>
                  <span className="px-2.5 py-1 rounded-[6px] bg-gray-50 dark:bg-accent/30 text-[#666] dark:text-white/50 text-xs h-7 flex items-center">{card.cameraAngle || '固定机位'}</span>
                  <span className="px-2.5 py-1 rounded-[6px] bg-gray-50 dark:bg-accent/30 text-[#666] dark:text-white/50 text-xs h-7 flex items-center">{card.mood || '轻松愉快'}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onGenerateStartFrame(card.id); }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-orange-300 dark:border-orange-500/40 text-orange-500 text-xs font-medium hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> 生成起始帧
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onGenerateEndFrame(card.id); }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-orange-300 dark:border-orange-500/40 text-orange-500 text-xs font-medium hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> 生成结束帧
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onGenerateShotVideo(card.id); }}
                    disabled={isGenerating}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#ff333f]/30 dark:border-[#ff333f]/40 text-[#ff333f] text-xs font-medium hover:bg-[#ff333f]/5 dark:hover:bg-[#ff333f]/10 transition-colors disabled:opacity-40"
                  >
                    <Video className="w-3.5 h-3.5" /> 生成视频
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRegenerateVideo(card.id); }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-50 dark:bg-accent/30 border border-[#E5E7EB] dark:border-border text-[#888] dark:text-white/50 text-xs font-medium hover:bg-gray-100 dark:hover:bg-accent/50 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> 重新生成
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {finalVideoUrl && (
        <div className="rounded-[10px] overflow-hidden border-2 border-[#ff333f]/20 bg-black">
          <video src={finalVideoUrl} controls className="w-full aspect-video" />
          <div className="p-3 bg-[#ff333f]/5 flex items-center justify-between">
            <span className="text-sm text-[#ff333f] font-medium">最终影片</span>
            <div className="flex items-center gap-2">
              <button
                onClick={onRecomposeFinalVideo}
                className="text-xs text-[#ff333f] hover:text-[#ff333f]/80 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> 重新合成
              </button>
              <a
                href={finalVideoUrl}
                download
                className="text-xs text-white bg-[#ff333f] rounded-md px-3 py-1.5 hover:bg-[#e62e3a] flex items-center gap-1"
              >
                <Download className="w-3 h-3" /> 下载
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
