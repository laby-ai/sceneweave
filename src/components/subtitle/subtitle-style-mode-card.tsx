'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Palette, RefreshCw, Settings, Sparkles, Zap } from 'lucide-react';
import { SubtitleConfig, SubtitleStyle } from '@/constants/subtitles';

type SubtitleStyleMode = 'auto' | 'manual' | 'hybrid';

const STYLE_MODE_OPTIONS: Array<{ value: SubtitleStyleMode; label: string; desc: string }> = [
  { value: 'manual', label: '手动', desc: '完全自定义所有样式参数' },
  { value: 'hybrid', label: '自动+手动', desc: 'AI推荐 + 手动微调' },
  { value: 'auto', label: '自动', desc: '根据视频内容全自动推荐' },
];

interface SubtitleStyleModeCardProps {
  config: SubtitleConfig;
  currentStyleMode: string;
  disabled: boolean;
  isAnalyzingStyle: boolean;
  videoPrompt: string;
  handleAutoAnalyzeStyle: () => void;
  handleStyleModeChange: (mode: SubtitleStyleMode) => void;
  updateStyle: (styleUpdates: Partial<SubtitleStyle>) => void;
}

export function SubtitleStyleModeCard({
  config,
  currentStyleMode,
  disabled,
  isAnalyzingStyle,
  videoPrompt,
  handleAutoAnalyzeStyle,
  handleStyleModeChange,
  updateStyle,
}: SubtitleStyleModeCardProps) {
  const showRecommendation = (currentStyleMode === 'auto' || currentStyleMode === 'hybrid')
    && config.autoStyleRecommendation;

  return (
    <Card className="border border-[#EF4444]/30 bg-gradient-to-r from-[#EF4444]/5 via-purple-500/5 to-red-500/5">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-[#EF4444]" />
          <CardTitle className="text-base">样式模式</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {STYLE_MODE_OPTIONS.map((opt) => {
            const isActive = currentStyleMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleStyleModeChange(opt.value)}
                disabled={disabled}
                className={`relative flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                  isActive
                    ? 'border-[#EF4444] bg-[#EF4444]/15 text-[#EF4444] shadow-sm shadow-[#EF4444]/10'
                    : 'border-border bg-accent/30 text-muted-foreground hover:bg-accent hover:text-foreground/80'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {isActive && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-[10px] leading-tight text-center opacity-70">{opt.desc}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/20">
          <div className="flex items-center gap-2">
            {currentStyleMode === 'manual' && (
              <><Settings className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">手动控制所有样式参数</span></>
            )}
            {currentStyleMode === 'hybrid' && (
              <><Sparkles className="w-3.5 h-3.5 text-red-400" /><span className="text-xs text-muted-foreground">AI推荐 + 可手动微调任意项</span></>
            )}
            {currentStyleMode === 'auto' && (
              <><Zap className="w-3.5 h-3.5 text-[#EF4444]" /><span className="text-xs text-muted-foreground">全自动推荐，修改提示词后自动更新</span></>
            )}
          </div>
          {(currentStyleMode === 'auto' || currentStyleMode === 'hybrid') && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAutoAnalyzeStyle}
              disabled={disabled || isAnalyzingStyle || !videoPrompt.trim()}
              className="h-7 text-xs px-2.5 text-[#EF4444] hover:text-[#EF4444]/80 hover:bg-[#EF4444]/10"
            >
              {isAnalyzingStyle ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span className="ml-1">重新分析</span>
            </Button>
          )}
        </div>

        {showRecommendation && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-red-400" />
              <span className="text-xs font-medium text-red-300">AI 推荐 + 手动微调推荐项</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-muted-foreground">字体:</span><span className="text-foreground/80 font-mono truncate max-w-[90px]">{(config.autoStyleRecommendation!.fontFamily || '').split(',')[0].replace(/"/g, '')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">字号:</span><span className="text-foreground/80">{config.autoStyleRecommendation!.fontSizeCustom}px</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">颜色:</span><span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: config.autoStyleRecommendation!.color }} /><span className="text-foreground/80 font-mono">{config.autoStyleRecommendation!.color}</span></span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">位置:</span><span className="text-foreground/80">{config.autoStyleRecommendation!.position}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">描边:</span><span className="text-foreground/80">{config.autoStyleRecommendation!.hasBorder ? `${config.autoStyleRecommendation!.borderWidth}px` : '无'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">背景:</span><span className="text-foreground/80 font-mono truncate max-w-[80px]">{config.autoStyleRecommendation!.backgroundColor || '无'}</span></div>
            </div>
            {currentStyleMode === 'hybrid' && (
              <div className="flex gap-2 pt-1 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => { if (config.autoStyleRecommendation) updateStyle(config.autoStyleRecommendation); }} disabled={disabled} className="flex-1 h-7 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30">全部应用推荐值</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleAutoAnalyzeStyle()} disabled={disabled || isAnalyzingStyle} className="h-7 text-xs bg-accent/30 hover:bg-accent border-border">换一组推荐</Button>
              </div>
            )}
          </div>
        )}

        {!videoPrompt.trim() && (currentStyleMode === 'auto' || currentStyleMode === 'hybrid') && (
          <p className="text-[10px] text-red-400 flex items-center gap-1">
            请先在上方输入视频描述，以便 AI 分析场景并推荐最佳样式
          </p>
        )}
      </CardContent>
    </Card>
  );
}
