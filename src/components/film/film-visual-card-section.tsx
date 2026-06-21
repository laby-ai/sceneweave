"use client";

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Package } from 'lucide-react';

type FilmVisualCardSectionProps = {
  label: string;
  color: string;
  Icon: LucideIcon;
  generatedCount: number;
  totalCount: number;
  showEmptyPropNotice: boolean;
  children: ReactNode;
};

export function FilmVisualCardSection({
  label,
  color,
  Icon,
  generatedCount,
  totalCount,
  showEmptyPropNotice,
  children,
}: FilmVisualCardSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
          <Icon className="w-3 h-3 inline mr-1" />
          {label}
        </span>
        <div className="flex-1 h-px bg-border/50" />
        <span className="text-[10px] text-foreground/30">
          {generatedCount}/{totalCount}
        </span>
      </div>

      {showEmptyPropNotice && (
        <div className="flex flex-col items-center justify-center py-6 rounded-xl border border-dashed border-purple-500/30 bg-purple-500/5">
          <Package className="w-6 h-6 text-purple-500/40 mb-2" />
          <span className="text-[11px] text-foreground/40">暂无道具</span>
          <span className="text-[10px] text-foreground/25 mt-0.5">剧本创作后将自动提取道具，或使用左侧「生成道具」</span>
        </div>
      )}

      {children}
    </div>
  );
}
