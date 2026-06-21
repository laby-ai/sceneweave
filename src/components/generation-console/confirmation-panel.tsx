"use client";

import { Sparkles, Loader2, Wand2 } from "lucide-react";

export interface ConfirmationData {
  intent: string;
  collectedParams: Record<string, unknown>;
}

interface ConfirmationPanelProps {
  data: ConfirmationData;
  isGenerating: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const INTENT_LABELS: Record<string, string> = {
  generate_video: "视频",
  generate_image: "图片",
  generate_copywriting: "文案",
  generate_poster: "海报",
  generate_avatar: "数字人",
};

export function ConfirmationPanel({ data, isGenerating, onConfirm, onCancel }: ConfirmationPanelProps) {
  return (
    <div className="mb-3 bg-card border border-red-200 dark:border-red-900 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-red-100 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
        <div className="flex items-center gap-2 text-sm font-medium text-red-800">
          <Sparkles className="w-4 h-4 text-red-500" />
          <span>创作方案已就绪，请确认</span>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground/70">创作类型</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            {INTENT_LABELS[data.intent] || data.intent}
          </span>
        </div>
        {Object.entries(data.collectedParams)
          .filter(([, v]) => v !== undefined && v !== null && v !== "")
          .map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <span className="text-xs text-foreground/70 shrink-0 w-16">{key}</span>
              <span className="text-xs text-foreground font-medium">{String(value)}</span>
            </div>
          ))}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onConfirm}
            disabled={isGenerating}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all active:scale-95"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {isGenerating ? "启动中..." : "确认并生成"}
          </button>
          <button
            onClick={onCancel}
            disabled={isGenerating}
            className="px-4 py-2.5 rounded-xl bg-secondary text-foreground/70 text-sm font-medium hover:bg-accent transition-all"
          >
            继续调整
          </button>
        </div>
      </div>
    </div>
  );
}
