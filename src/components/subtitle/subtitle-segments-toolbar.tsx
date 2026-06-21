'use client';

import { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Wand2 } from 'lucide-react';
import { formatTime, SubtitleConfig } from '@/constants/subtitles';

interface SubtitleSegmentsToolbarProps {
  config: SubtitleConfig;
  disabled: boolean;
  showSplitConfig: boolean;
  videoDuration: number;
  addSegment: () => void;
  handlePreviewSplit: () => void;
  setShowSplitConfig: Dispatch<SetStateAction<boolean>>;
}

export function SubtitleSegmentsToolbar({
  config,
  disabled,
  showSplitConfig,
  videoDuration,
  addSegment,
  handlePreviewSplit,
  setShowSplitConfig,
}: SubtitleSegmentsToolbarProps) {
  const averageCharacters = config.segments.length > 0
    ? Math.round(config.segments.reduce((sum, segment) => sum + segment.text.replace(/\s/g, '').length, 0) / config.segments.length)
    : 0;

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-muted-foreground">
          {config.segments.length} 段旁白/对话 · 总时长 {formatTime(videoDuration)}
          {config.segments.length > 0 && (
            <span className="ml-2 text-[11px]">
              · 均字 {averageCharacters}字/段
            </span>
          )}
        </div>
        <div className="text-[10px] text-foreground/25 mt-0.5">💬 底部显示 · TTS朗读 · 智能断句</div>
      </div>
      <div className="flex gap-2">
        {config.segments.some(segment => segment.text.trim()) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!showSplitConfig) {
                setShowSplitConfig(true);
              }
              handlePreviewSplit();
            }}
            disabled={disabled}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Wand2 className="w-4 h-4 mr-1.5" />
            智能分段
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addSegment}
          disabled={disabled}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          添加分段
        </Button>
      </div>
    </div>
  );
}
