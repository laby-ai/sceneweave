'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, ChevronRight, Clock, Film, Heart, Languages, Layers, Palette, Settings, Sparkles, Sparkles as SparklesIcon, Wand2 } from 'lucide-react';
import { STYLE_OPTIONS, MOOD_OPTIONS } from '@/constants/styles';
import { FILTER_OPTIONS, VIDEO_RESOLUTION_OPTIONS, VIDEO_RATIO_OPTIONS } from '@/constants/filters';
import { COLOR_THEME_OPTIONS } from '@/constants/colors';

type VideoGenerationSettingsPanelProps = {
  colorTheme: string;
  duration: string;
  enablePromptOptimize: boolean;
  filter: string;
  isGenerating: boolean;
  language: string;
  mood: string;
  prompt: string;
  ratio: string;
  resolution: string;
  showBasicSettings: boolean;
  showCustomMode: boolean;
  smartEnhance: boolean;
  style: string;
  useNineGrid: boolean;
  userNineGridImages: string[];
  watermark: boolean;
  setColorTheme: Dispatch<SetStateAction<string>>;
  setDuration: Dispatch<SetStateAction<string>>;
  setEnablePromptOptimize: Dispatch<SetStateAction<boolean>>;
  setFilter: Dispatch<SetStateAction<string>>;
  setLanguage: Dispatch<SetStateAction<string>>;
  setMood: Dispatch<SetStateAction<string>>;
  setOpenSelector: Dispatch<SetStateAction<string | null>>;
  setPrompt: Dispatch<SetStateAction<string>>;
  setRatio: Dispatch<SetStateAction<string>>;
  setResolution: Dispatch<SetStateAction<string>>;
  setShowBasicSettings: Dispatch<SetStateAction<boolean>>;
  setShowCustomMode: Dispatch<SetStateAction<boolean>>;
  setShowPromptGenerator: Dispatch<SetStateAction<boolean>>;
  setSmartEnhance: Dispatch<SetStateAction<boolean>>;
  setUseNineGrid: Dispatch<SetStateAction<boolean>>;
  setUserNineGridImages: Dispatch<SetStateAction<string[]>>;
  setWatermark: Dispatch<SetStateAction<boolean>>;
};

export function VideoGenerationSettingsPanel({
  colorTheme,
  duration,
  enablePromptOptimize,
  filter,
  isGenerating,
  language,
  mood,
  prompt,
  ratio,
  resolution,
  showBasicSettings,
  showCustomMode,
  smartEnhance,
  style,
  useNineGrid,
  userNineGridImages,
  watermark,
  setColorTheme,
  setDuration,
  setEnablePromptOptimize,
  setFilter,
  setLanguage,
  setMood,
  setOpenSelector,
  setPrompt,
  setRatio,
  setResolution,
  setShowBasicSettings,
  setShowCustomMode,
  setShowPromptGenerator,
  setSmartEnhance,
  setUseNineGrid,
  setUserNineGridImages,
  setWatermark,
}: VideoGenerationSettingsPanelProps) {
  return (
    <>
            {/* 基础设置 */}
            <Collapsible open={showBasicSettings} onOpenChange={setShowBasicSettings} className="space-y-0">
              <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg border border-border">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  基础设置
                </h3>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <ChevronRight className={`h-4 w-4 transition-transform ${showBasicSettings ? 'rotate-90' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
              
              <CollapsibleContent>
                <div className="p-4 bg-accent/30 rounded-lg border border-border border-t-0 rounded-t-none pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* 分辨率 */}
                    <div className="space-y-2">
                      <Label htmlFor="video-resolution" className="text-sm font-medium">
                        分辨率
                      </Label>
                      <Select value={resolution} onValueChange={setResolution} disabled={isGenerating}>
                        <SelectTrigger id="video-resolution" className="bg-accent/30 text-foreground border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VIDEO_RESOLUTION_OPTIONS.map((option) => (
                            <SelectItem key={`video-resolution-${option.value}`} value={option.value}>
                              <div className="flex flex-col">
                                <span>{option.label}</span>
                                <span className="text-xs text-muted-foreground">{option.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 画面比例 */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        画面比例
                      </Label>
                      <div className="flex gap-1">
                        {VIDEO_RATIO_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => !isGenerating && setRatio(option.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              ratio === option.value
                                ? 'bg-red-500 text-white shadow-sm'
                                : 'bg-secondary text-muted-foreground hover:bg-red-500/10 hover:text-red-500'
                            } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 视频语言 */}
                    <div className="space-y-2">
                      <Label htmlFor="video-language" className="text-sm font-medium flex items-center gap-2">
                        <Languages className="w-3 h-3" />
                        视频语言
                      </Label>
                      <Select value={language} onValueChange={setLanguage} disabled={isGenerating}>
                        <SelectTrigger id="video-language" className="bg-accent/30 text-foreground border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="zh">
                            <div className="flex items-center gap-2">
                              <span>🇨🇳</span>
                              <span>中文</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="en">
                            <div className="flex items-center gap-2">
                              <span>🇺🇸</span>
                              <span>English</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="ja">
                            <div className="flex items-center gap-2">
                              <span>🇯🇵</span>
                              <span>日本語</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="ko">
                            <div className="flex items-center gap-2">
                              <span>🇰🇷</span>
                              <span>한국어</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="fr">
                            <div className="flex items-center gap-2">
                              <span>🇫🇷</span>
                              <span>Français</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="de">
                            <div className="flex items-center gap-2">
                              <span>🇩🇪</span>
                              <span>Deutsch</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="es">
                            <div className="flex items-center gap-2">
                              <span>🇪🇸</span>
                              <span>Español</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* 自定义模式 */}
            <Collapsible open={showCustomMode} onOpenChange={setShowCustomMode} className="space-y-0 mt-4">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-red-500/30">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  自定义模式
                </h3>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <ChevronRight className={`h-4 w-4 transition-transform ${showCustomMode ? 'rotate-90' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
              
              <CollapsibleContent>
                <div className="p-4 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-red-500/30 border-t-0 rounded-t-none pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 艺术风格 */}
                    <div className="space-y-2">
                      <Label htmlFor="style" className="text-sm font-medium flex items-center gap-2">
                        <Palette className="w-3 h-3" />
                        艺术风格
                      </Label>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-between"
                        onClick={() => setOpenSelector('style')}
                        disabled={isGenerating}
                      >
                        <span>{style !== 'none' ? STYLE_OPTIONS.find(opt => opt.value === style)?.label : '选择风格'}</span>
                        <ChevronRight className="w-4 h-4 opacity-50" />
                      </Button>
                    </div>

                    {/* 氛围感觉 */}
                    <div className="space-y-2">
                      <Label htmlFor="mood" className="text-sm font-medium flex items-center gap-2">
                        <Heart className="w-3 h-3" />
                        氛围感觉
                      </Label>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-between"
                        onClick={() => setOpenSelector('mood')}
                        disabled={isGenerating}
                      >
                        <span>{mood !== 'none' ? MOOD_OPTIONS.find(opt => opt.value === mood)?.label : '选择氛围'}</span>
                        <ChevronRight className="w-4 h-4 opacity-50" />
                      </Button>
                    </div>

                    {/* 滤镜效果 */}
                    <div className="space-y-2">
                      <Label htmlFor="filter" className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="w-3 h-3" />
                        滤镜效果
                      </Label>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-between"
                        onClick={() => setOpenSelector('filter')}
                        disabled={isGenerating}
                      >
                        <span>{filter !== 'none' ? FILTER_OPTIONS.find(opt => opt.value === filter)?.label : '选择滤镜'}</span>
                        <ChevronRight className="w-4 h-4 opacity-50" />
                      </Button>
                    </div>

                    {/* 颜色主色调 */}
                    <div className="space-y-2">
                      <Label htmlFor="colorTheme" className="text-sm font-medium flex items-center gap-2">
                        <Layers className="w-3 h-3" />
                        颜色主色调
                      </Label>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-between"
                        onClick={() => setOpenSelector('colorTheme')}
                        disabled={isGenerating}
                      >
                        <span>{colorTheme !== 'none' ? COLOR_THEME_OPTIONS.find(opt => opt.id === colorTheme)?.name : '选择主色调'}</span>
                        <ChevronRight className="w-4 h-4 opacity-50" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration" className="text-base font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                视频时长
                <span className="text-xs font-normal text-muted-foreground">(支持自定义)</span>
              </Label>

              {/* 快捷预设按钮 */}
              <div className="flex flex-wrap gap-1.5">
                {[5, 10, 15, 20, 30, 60].map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant={parseInt(duration) === d ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDuration(String(d))}
                    disabled={isGenerating}
                    className={`text-xs px-2.5 py-1 h-7 ${
                      parseInt(duration) === d
                        ? 'bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {d}s
                    {d >= 15 && <span className="ml-1 opacity-60">{d >= 30 ? `(${Math.ceil(d/10)}段)` : '(2段)'}</span>}
                  </Button>
                ))}
              </div>

              {/* 自定义时长输入 */}
              <div className="relative">
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  max={300}
                  value={duration}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d+$/.test(val)) setDuration(val);
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value);
                    if (isNaN(val) || val < 1) setDuration('5');
                    else if (val > 300) setDuration('300');
                    else setDuration(String(val));
                  }}
                  placeholder="输入秒数 (1-300)"
                  disabled={isGenerating}
                  className="bg-accent/30 text-foreground border-border h-8 pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">秒</span>
              </div>

              {!([5, 10, 15, 20, 30, 60].includes(parseInt(duration))) && (
                <p className="text-xs text-primary">自定义时长：{parseInt(duration)}秒（约{Math.max(1, Math.ceil(parseInt(duration)/10))}个片段）</p>
              )}
              
              {/* 长视频提示信息 */}
              {parseInt(duration) >= 20 && (
                <div className="mt-3 p-4 bg-gradient-to-r from-red-500/20 to-red-500/20 border border-red-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 bg-red-100 p-1.5 rounded-full">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-red-800 mb-1.5">
                        {parseInt(duration) >= 30 ? '📽️ 超长视频生成建议' : '🎬 长视频生成说明'}
                      </h4>
                      <div className="space-y-1 text-sm text-red-700">
                        <p>
                          <strong>生成策略：</strong>系统将视频拆分为 {Math.ceil(parseInt(duration) / 10)} 个10秒片段，逐段生成后自动合并
                        </p>
                        <p>
                          <strong>预计时间：</strong>约 {Math.ceil((parseInt(duration) / 10) * 3)} 分钟（建议开启后台生成）
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>



            {/* Toggle Options */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="smart-enhance" className="text-base">
                    智能增强描述
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    开启后将自动调用提示词助手增强您的视频描述
                  </p>
                </div>
                <Switch
                  id="smart-enhance"
                  checked={smartEnhance}
                  onCheckedChange={(checked) => {
                    setSmartEnhance(checked);
                    // 开启智能增强时，如果提示词为空，自动打开提示词生成器
                    if (checked && !prompt.trim()) {
                      setShowPromptGenerator(true);
                    }
                  }}
                  disabled={isGenerating}
                />
              </div>

              {/* 智能增强 - 开启时自动调用提示词助手 */}
              {smartEnhance && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <SparklesIcon className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-800">
                      <p className="font-medium">智能增强已启用</p>
                      <p className="text-xs mt-1 text-red-700">
                        生成视频时将自动调用提示词助手优化您的描述内容，生成更精彩专业的视频
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Wan2.1 / Open-Sora 视频提示词精炼 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">视频提示词精炼</Label>
                <p className="text-xs text-muted-foreground">针对视频生成场景深度优化提示词 (T2V/I2V/T2I模式)</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!prompt.trim()) return;
                      try {
                        const res = await fetch('/api/prompt/video-refine', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ prompt, mode: 't2v' }),
                        });
                        const data = await res.json();
                        if (data.success && data.refinedPrompt) {
                          setPrompt(data.refinedPrompt);
                        }
                      } catch { /* 静默失败 */ }
                    }}
                    disabled={!prompt.trim() || isGenerating}
                    className="flex-1 text-xs"
                  >
                    <Wand2 className="w-3 h-3 mr-1" />
                    T2V 精炼
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!prompt.trim()) return;
                      try {
                        const res = await fetch('/api/prompt/video-refine', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ prompt, mode: 't2i' }),
                        });
                        const data = await res.json();
                        if (data.success && data.refinedPrompt) {
                          setPrompt(data.refinedPrompt);
                        }
                      } catch { /* 静默失败 */ }
                    }}
                    disabled={!prompt.trim() || isGenerating}
                    className="flex-1 text-xs"
                  >
                    <Film className="w-3 h-3 mr-1" />
                    T2I 精炼
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="prompt-optimize" className="text-base">
                    提示词优化
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    自动检测并优化复杂提示词，避免生成超时
                  </p>
                </div>
                <Switch
                  id="prompt-optimize"
                  checked={enablePromptOptimize}
                  onCheckedChange={setEnablePromptOptimize}
                  disabled={isGenerating}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="watermark" className="text-base">
                    添加水印
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    在视频中添加水印标识
                  </p>
                </div>
                <Switch
                  id="watermark"
                  checked={watermark}
                  onCheckedChange={setWatermark}
                  disabled={isGenerating}
                />
              </div>

              {/* 九宫格模式说明卡片 - 仅在长视频时显示 */}
              {parseInt(duration) >= 20 && !useNineGrid && (
                <div className="p-4 bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 bg-red-100 p-1.5 rounded-full">
                      <Sparkles className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-red-800 mb-1">推荐：九宫格生成模式</h4>
                      <p className="text-sm text-red-700 mb-2">
                        先预览9张关键帧画面，选择满意的作为视频参考，大幅提升长视频质量
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setUseNineGrid(true)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        开启九宫格模式
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="nine-grid" className="text-base flex items-center gap-2">
                    九宫格生成模式
                    {useNineGrid && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">已启用</span>
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    先生成9张关键帧预览图，选择满意的作为视频参考
                  </p>
                </div>
                <Switch
                  id="nine-grid"
                  checked={useNineGrid}
                  onCheckedChange={setUseNineGrid}
                  disabled={isGenerating}
                />
              </div>
              
              {/* 用户上传九宫格照片 */}
              {useNineGrid && (
                <div className="mt-4 space-y-4">
                  <div>
                    <Label className="text-sm font-medium">上传参考图片（可选）</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      上传1-9张您想要的画面风格参考图，AI会根据这些图片生成视频；不填则自动生成9张预览
                    </p>
                  </div>
                  
                  {/* 九宫格上传区域 */}
                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
                      <div key={index} className="relative">
                        {userNineGridImages[index] ? (
                          <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-red-400 shadow-md">
                            <img
                              src={userNineGridImages[index]}
                              alt={`参考图 ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                              <div className="absolute bottom-2 left-0 right-0 text-center">
                                <span className="text-white text-xs font-medium">参考图 {index + 1}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newImages = [...userNineGridImages];
                                newImages[index] = '';
                                setUserNineGridImages(newImages);
                              }}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-lg"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-white/30 hover:border-[#EF4444]/50 hover:bg-[#EF4444]/5 cursor-pointer transition-all bg-card">
                            <svg className="w-8 h-8 text-muted-foreground mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span className="text-sm font-medium text-foreground/70">第{index + 1}张</span>
                            <span className="text-xs text-muted-foreground mt-1">点击上传</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const formData = new FormData();
                                  formData.append('file', file);
                                  
                                  fetch('/api/upload', {
                                    method: 'POST',
                                    body: formData,
                                  }).then(async (response) => {
                                    if (response.ok) {
                                      const data = await response.json();
                                      const newImages = [...userNineGridImages];
                                      newImages[index] = data.url;
                                      setUserNineGridImages(newImages);
                                    }
                                  }).catch((error) => {
                                    console.error('上传九宫格图片失败:', error);
                                  });
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* 已上传图片计数 */}
                  {userNineGridImages.filter(img => img).length > 0 && (
                    <div className="flex items-center justify-between text-sm text-red-400 bg-red-500/20 px-3 py-2 rounded-lg">
                      <span>已上传 {userNineGridImages.filter(img => img).length}/9 张参考图</span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setUserNineGridImages([])}
                        className="text-xs h-7"
                      >
                        清空全部
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
    </>
  );
}
