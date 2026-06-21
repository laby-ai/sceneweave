'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Eye, Palette, Type, Wand2 } from 'lucide-react';
import { SubtitleConfig } from '@/constants/subtitles';

interface SubtitleEditorHeaderProps {
  config: SubtitleConfig;
  disabled: boolean;
  isGenerating: boolean;
  onAutoGenerate?: () => Promise<string>;
  handleAutoGenerate: () => void;
  updateConfig: (updates: Partial<SubtitleConfig>) => void;
}

export function SubtitleEditorHeader({
  config,
  disabled,
  isGenerating,
  onAutoGenerate,
  handleAutoGenerate,
  updateConfig,
}: SubtitleEditorHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-lg">
      <div className="flex items-center gap-3">
        <Type className="w-5 h-5 text-[#EF4444]" />
        <div>
          <Label className="text-base font-medium cursor-pointer">
            字幕（旁白/对话）
          </Label>
          <p className="text-xs text-muted-foreground">
            用于语音旁白、对话字幕、解说文字。文字显示在视频底部，支持 TTS 配音朗读、智能分段。
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            适合：产品介绍、故事旁白、教程解说等需要「说」出来的内容
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {onAutoGenerate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAutoGenerate}
            disabled={disabled || isGenerating}
            className="text-[#EF4444] hover:text-[#EF4444]/80 hover:bg-[#EF4444]/10"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-[#EF4444] border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Wand2 className="w-4 h-4 mr-2" />
            )}
            AI生成
          </Button>
        )}
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => updateConfig({ enabled: checked })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function SubtitleEditorTabsList() {
  return (
    <TabsList className="grid grid-cols-4 w-full">
      <TabsTrigger value="segments">
        <Clock className="w-4 h-4 mr-2" />
        字幕（旁白/对话）
      </TabsTrigger>
      <TabsTrigger value="videotext">
        <Type className="w-4 h-4 mr-2" />
        视频文字
        <span className="text-[10px] text-foreground/70 ml-1 font-normal">标题·标注</span>
      </TabsTrigger>
      <TabsTrigger value="style">
        <Palette className="w-4 h-4 mr-2" />
        样式设置
      </TabsTrigger>
      <TabsTrigger value="preview">
        <Eye className="w-4 h-4 mr-2" />
        预览
      </TabsTrigger>
    </TabsList>
  );
}
