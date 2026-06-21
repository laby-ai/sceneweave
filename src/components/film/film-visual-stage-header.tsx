"use client";

import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Clock, FileText, History, Loader2, Plus } from 'lucide-react';

type FilmVisualStageStats = {
  imagesGenerated: number;
  totalNeedImage: number;
};

type FilmVisualStageHeaderProps = {
  stats: FilmVisualStageStats;
  isGenerating: boolean;
  hasHistory: boolean;
  showLogPanel: boolean;
  onBackToScript: () => void;
  onGenerateAllImages: () => void;
  onGoToCompose: () => void;
  onOpenHistory: () => void;
  onToggleLogPanel: () => void;
};

export function FilmVisualStageHeader({
  stats,
  isGenerating,
  hasHistory,
  showLogPanel,
  onBackToScript,
  onGenerateAllImages,
  onGoToCompose,
  onOpenHistory,
  onToggleLogPanel,
}: FilmVisualStageHeaderProps) {
  const generatingCount = isGenerating ? 1 : 0;
  const waitingCount = Math.max(0, stats.totalNeedImage - stats.imagesGenerated - generatingCount);

  return (
    <>
      <div className="flex-shrink-0 flex items-start justify-between px-6 pt-5 pb-3">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-white">画面生成</h2>
          <p className="text-sm text-[#666] dark:text-white/60 mt-0.5">
            已生成 <span className="text-green-500 font-semibold">{stats.imagesGenerated}</span>/{stats.totalNeedImage} 张画面
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBackToScript}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-secondary border border-[#E5E7EB] dark:border-border text-sm text-[#555] dark:text-white/70 hover:bg-gray-50 dark:hover:bg-accent/30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> 上一步 · 查看剧本
          </button>
          <button
            onClick={onGenerateAllImages}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff333f] hover:bg-[#e62e3a] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 批量生成
          </button>
          <button
            onClick={onGoToCompose}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-sm text-[#555] dark:text-white/70 transition-colors"
          >
            下一步 · 视频生成 <ArrowRight className="w-4 h-4" />
          </button>
          <div className="relative flex flex-col items-center ml-1">
            <button
              onClick={onOpenHistory}
              className="relative p-2 rounded-lg hover:bg-accent/30 transition-colors"
            >
              <History className="w-5 h-5 text-[#888] dark:text-white/50" />
              {hasHistory && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#EF4444] rounded-full border-2 border-white dark:border-card" />
              )}
            </button>
            <span className="text-[10px] text-[#999] dark:text-white/40 mt-0.5">历史记录</span>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 mx-6 mb-4 px-0 py-0 bg-white dark:bg-card rounded-lg border border-[#E5E7EB] dark:border-border overflow-hidden">
        <div className="flex items-center divide-x divide-[#E5E7EB] dark:divide-border">
          <div className="flex items-center gap-1.5 px-4 py-2.5 flex-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm text-[#666] dark:text-white/60">已完成</span>
            <span className="text-sm font-semibold text-green-500">{stats.imagesGenerated}/{stats.totalNeedImage}</span>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-2.5 flex-1">
            <Loader2 className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-[#666] dark:text-white/60">生成中</span>
            <span className="text-sm font-semibold text-orange-500">{generatingCount}</span>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-2.5 flex-1">
            <Clock className="w-4 h-4 text-[#999] dark:text-white/40" />
            <span className="text-sm text-[#666] dark:text-white/60">等待</span>
            <span className="text-sm font-semibold text-[#888] dark:text-white/50">{waitingCount}</span>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-2.5 flex-1">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-[#666] dark:text-white/60">失败</span>
            <span className="text-sm font-semibold text-red-500">0</span>
          </div>
          <div className="flex items-center justify-center px-4 py-2.5">
            <button
              onClick={onToggleLogPanel}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-50 dark:bg-accent/30 hover:bg-gray-100 dark:hover:bg-accent/50 transition-colors text-xs text-[#888] dark:text-white/50"
            >
              <FileText className="w-3.5 h-3.5" /> {showLogPanel ? '隐藏日志' : '查看日志'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
