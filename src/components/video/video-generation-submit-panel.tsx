'use client';

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Clock, Layers, Loader2, Save, Settings, Video, Volume2, Zap } from 'lucide-react';
import {
  SFX_CATEGORIES,
  SFX_LIBRARY,
  getSfxByCategory,
  recommendSfxForScene,
  type SfxBinding,
} from '@/constants/sfx-types';
import {
  type SegmentStrategyMode,
  formatEstimatedTime,
  strategyMap,
} from '@/lib/video-segment-strategy';
import type { Storyboard } from '@/types/storyboard';

interface SegmentStrategySummary {
  calculateSegments: (duration: number) => number;
  maxSingleDuration: number;
}

interface VideoGenerationSubmitPanelProps {
  abortControllerRef: MutableRefObject<AbortController | null>;
  calculateEstimatedTime: () => number;
  currentStrategy: SegmentStrategySummary;
  duration: string;
  generationMessage: string;
  generationProgress: number;
  generationStage: string;
  isGenerating: boolean;
  prompt: string;
  qualityMode: string;
  runInBackground: boolean;
  segmentStrategy: SegmentStrategyMode;
  setQualityMode: Dispatch<SetStateAction<string>>;
  setRunInBackground: Dispatch<SetStateAction<boolean>>;
  setSegmentStrategy: Dispatch<SetStateAction<SegmentStrategyMode>>;
  setSfxBindings: Dispatch<SetStateAction<SfxBinding[]>>;
  setSfxEnabled: Dispatch<SetStateAction<boolean>>;
  setSfxGlobalVolume: Dispatch<SetStateAction<number>>;
  setSfxMode: Dispatch<SetStateAction<'auto' | 'manual'>>;
  setShowSaveTemplateDialog: Dispatch<SetStateAction<boolean>>;
  setShowSDKDetector: Dispatch<SetStateAction<boolean>>;
  setShowSfxPanel: Dispatch<SetStateAction<boolean>>;
  sfxBindings: SfxBinding[];
  sfxEnabled: boolean;
  sfxGlobalVolume: number;
  sfxMode: 'auto' | 'manual';
  showSfxPanel: boolean;
  storyboard: Storyboard | null;
  themeGradient: string;
  useNineGrid: boolean;
}

export function VideoGenerationSubmitPanel({
  abortControllerRef,
  calculateEstimatedTime,
  currentStrategy,
  duration,
  generationMessage,
  generationProgress,
  generationStage,
  isGenerating,
  prompt,
  qualityMode,
  runInBackground,
  segmentStrategy,
  setQualityMode,
  setRunInBackground,
  setSegmentStrategy,
  setSfxBindings,
  setSfxEnabled,
  setSfxGlobalVolume,
  setSfxMode,
  setShowSaveTemplateDialog,
  setShowSDKDetector,
  setShowSfxPanel,
  sfxBindings,
  sfxEnabled,
  sfxGlobalVolume,
  sfxMode,
  showSfxPanel,
  storyboard,
  themeGradient,
  useNineGrid,
}: VideoGenerationSubmitPanelProps) {
  return (
    <>
            {/* Progress Display */}
            {isGenerating && !runInBackground && (
              <div className="space-y-3 p-4 bg-gradient-to-r from-red-500/20 to-red-500/20 border border-red-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {generationProgress < 100 ? (
                      <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
                    ) : (
                      <Video className="w-5 h-5 text-green-600" />
                    )}
                    <span className="text-sm font-semibold text-red-700">{generationStage}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-red-600">{Math.round(generationProgress)}%</span>
                    {/* 取消按钮 */}
                    {generationProgress < 100 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (abortControllerRef.current) {
                            abortControllerRef.current.abort();
                          }
                        }}
                        className="h-7 text-xs"
                      >
                        取消生成
                      </Button>
                    )}
                  </div>
                </div>
                <div className="w-full bg-red-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-red-500 to-rose-500 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
                <p className="text-xs text-red-600/70">
                  {generationMessage || (
                    generationProgress < 20 ? "正在初始化AI模型..." :
                    generationProgress < 40 ? "AI正在理解您的创意描述..." :
                    generationProgress < 70 ? "正在生成视频画面，请耐心等待..." :
                    generationProgress < 90 ? "视频生成完成，正在添加字幕效果..." :
                    generationProgress < 100 ? "正在完成最后的处理..." :
                    "视频生成成功！"
                  )}
                </p>
              </div>
            )}

            {/* Background Generation Status */}
            {isGenerating && runInBackground && (
              <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
                    <span className="text-sm font-semibold text-red-700">后台生成中...</span>
                    <span className="text-xs text-red-600/70">{Math.round(generationProgress)}%</span>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (abortControllerRef.current) {
                        abortControllerRef.current.abort();
                      }
                    }}
                    className="h-7 text-xs"
                  >
                    取消
                  </Button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="space-y-3">
              {/* 后台生成选项 */}
              {/* ★ 优化模式选择 */}
              <Card className="bg-accent/30 border-border backdrop-blur-sm">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground/80">
                    <Zap className="w-4 h-4 text-red-400" />
                    生成优化（节省资源点）
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { mode: 'fast', label: '快速', icon: '⚡', desc: '每镜头2张图', saving: '省67%', color: 'text-green-400' },
                      { mode: 'balanced', label: '均衡', icon: '⚖️', desc: '每镜头4张图', saving: '省56%', color: 'text-red-400' },
                      { mode: 'quality', label: '高质量', icon: '🎬', desc: '每镜头9张图', saving: '原始', color: 'text-red-400' },
                    ].map((opt) => (
                      <button
                        key={opt.mode}
                        type="button"
                        onClick={() => setQualityMode(opt.mode)}
                        className={`p-2 rounded-lg border transition-all text-left ${
                          qualityMode === opt.mode
                            ? 'border-red-500/50 bg-red-500/10 ring-1 ring-amber-500/30'
                            : 'border-border bg-accent/30 hover:bg-accent'
                        }`}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-xs">{opt.icon}</span>
                          <span className={`text-xs font-medium ${qualityMode === opt.mode ? opt.color : 'text-foreground/70'}`}>
                            {opt.label}
                          </span>
                        </div>
                        <div className="text-[10px] text-foreground/70">{opt.desc}</div>
                        <div className={`text-[10px] ${opt.color}`}>{opt.saving}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-foreground/30">
                    快速模式大幅降低图片生成成本，适合预览和日常使用；高质量模式适合最终成品。
                  </p>
                </CardContent>
              </Card>

              {/* ★ 特效音(SFX)配置 */}
              <Card className={`bg-accent/30 backdrop-blur-sm transition-all ${sfxEnabled ? 'border-red-500/40' : 'border-border'}`}>
                <CardHeader className="pb-3 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground/80">
                      <Volume2 className="w-4 h-4 text-red-400" />
                      特效音（SFX）
                    </CardTitle>
                    <Switch
                      checked={sfxEnabled}
                      onCheckedChange={(checked) => {
                        setSfxEnabled(checked);
                        if (checked && sfxBindings.length === 0 && storyboard) {
                          // 自动推荐特效音（根据分镜prompt推断场景类型）
                          const firstPrompt = storyboard.shots[0]?.prompt?.toLowerCase() || '';
                          let sceneType = 'product';
                          if (firstPrompt.includes('风景') || firstPrompt.includes('landscape') || firstPrompt.includes('自然')) sceneType = 'landscape';
                          else if (firstPrompt.includes('人物') || firstPrompt.includes('portrait') || firstPrompt.includes('人像')) sceneType = 'portrait';
                          else if (firstPrompt.includes('美食') || firstPrompt.includes('food')) sceneType = 'food';
                          else if (firstPrompt.includes('戏剧') || firstPrompt.includes('故事') || firstPrompt.includes('情感')) sceneType = 'drama';
                          const autoBindings = recommendSfxForScene(sceneType, storyboard.shots.length);
                          setSfxBindings(autoBindings);
                        }
                      }}
                    />
                  </div>
                </CardHeader>
                {sfxEnabled && (
                <CardContent className="px-4 pb-4 space-y-3">
                  {/* 模式切换：自动 / 手动 */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={sfxMode === 'auto' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSfxMode('auto');
                        if (storyboard) {
                          const firstPrompt = storyboard.shots[0]?.prompt?.toLowerCase() || '';
                          let sceneType = 'product';
                          if (firstPrompt.includes('风景') || firstPrompt.includes('landscape')) sceneType = 'landscape';
                          else if (firstPrompt.includes('人物') || firstPrompt.includes('portrait')) sceneType = 'portrait';
                          else if (firstPrompt.includes('美食') || firstPrompt.includes('food')) sceneType = 'food';
                          else if (firstPrompt.includes('戏剧') || firstPrompt.includes('故事')) sceneType = 'drama';
                          setSfxBindings(recommendSfxForScene(sceneType, storyboard.shots.length));
                        }
                      }}
                      className="flex-1 text-xs"
                    >
                      🤖 自动匹配
                    </Button>
                    <Button
                      type="button"
                      variant={sfxMode === 'manual' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSfxMode('manual')}
                      className="flex-1 text-xs"
                    >
                      ✋ 手动选择
                    </Button>
                  </div>

                  {/* 手动模式：分类浏览选择 */}
                  {sfxMode === 'manual' && (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {SFX_CATEGORIES.map((cat) => (
                        <div key={cat.id}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs">{cat.icon}</span>
                            <span className="text-xs font-medium" style={{ color: cat.color }}>{cat.name}</span>
                            <span className="text-[10px] text-foreground/30">{cat.description}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {getSfxByCategory(cat.id).map((sfx) => {
                              const isSelected = sfxBindings.some(b => b.sfxId === sfx.id);
                              return (
                                <button
                                  key={sfx.id}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setSfxBindings(prev => prev.filter(b => b.sfxId !== sfx.id));
                                    } else {
                                      setSfxBindings(prev => [...prev, {
                                        sfxId: sfx.id,
                                        shotIndex: -1,
                                        timeOffset: 0,
                                        volume: sfx.volume || 0.6,
                                      }]);
                                    }
                                  }}
                                  className={`p-2 rounded-md border text-left transition-all ${
                                    isSelected
                                      ? 'border-red-500/50 bg-red-500/10'
                                      : 'border-border bg-accent/30 hover:bg-accent'
                                  }`}
                                >
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <span className="text-[10px]">{sfx.icon}</span>
                                    <span className="text-[10px] font-medium text-foreground/80 truncate">{sfx.name}</span>
                                  </div>
                                  <div className="text-[9px] text-foreground/30 line-clamp-1">{sfx.description}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 自动模式 / 已选列表预览 */}
                  {(sfxMode === 'auto' || sfxBindings.length > 0) && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          已选 {sfxBindings.length} 个特效音
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowSfxPanel(!showSfxPanel)}
                          onMouseEnter={() => { if (!showSfxPanel) setShowSfxPanel(true); }}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          {showSfxPanel ? '收起详情' : '展开详情'}
                        </button>
                      </div>

                      {showSfxPanel && (
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                          {sfxBindings.map((binding, idx) => {
                            const sfxDef = SFX_LIBRARY.find(s => s.id === binding.sfxId);
                            return (
                              <div
                                key={`${binding.sfxId}-${idx}`}
                                className="flex items-center justify-between p-2 rounded bg-accent/30 border border-border"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-xs shrink-0">{sfxDef?.icon || '🔊'}</span>
                                  <div className="min-w-0">
                                    <div className="text-[11px] font-medium text-foreground/80 truncate">{sfxDef?.name || binding.sfxId}</div>
                                    <div className="text-[9px] text-foreground/30">
                                      镜头{binding.shotIndex < 0 ? '片头' : `#${binding.shotIndex + 1}`} · +{binding.timeOffset}s · {sfxDef?.duration}s
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSfxBindings(prev => prev.filter((_, i) => i !== idx))}
                                  className="shrink-0 w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] hover:bg-red-500/30 ml-2"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 全局音量 */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">全局音量</span>
                    <Slider
                      value={[sfxGlobalVolume * 100]}
                      onValueChange={(v) => setSfxGlobalVolume(v[0] / 100)}
                      min={10}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{Math.round(sfxGlobalVolume * 100)}%</span>
                  </div>

                  <p className="text-[10px] text-foreground/30">
                    特效音在音频处理后注入，与BGM/语音叠加共存。自动模式根据场景类型智能推荐。
                  </p>
                </CardContent>
                )}
              </Card>

              {!isGenerating && (
                <div className="flex items-center justify-between p-3 bg-accent/30 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#EF4444]" />
                    <Label className="text-sm cursor-pointer" onClick={() => setRunInBackground(!runInBackground)}>
                      后台生成（关闭页面后继续生成）
                    </Label>
                  </div>
                  <Switch
                    checked={runInBackground}
                    onCheckedChange={setRunInBackground}
                    disabled={isGenerating}
                  />
                </div>
              )}
              
              {/* 分段策略选择 */}
              {!isGenerating && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-foreground/70">分段生成策略</Label>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setShowSDKDetector(true)}
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      检测SDK能力
                    </Button>
                  </div>
                  <Select 
                    value={segmentStrategy} 
                    onValueChange={(value) => setSegmentStrategy(value as SegmentStrategyMode)}
                    disabled={isGenerating}
                  >
                    <SelectTrigger className="bg-accent/30 text-foreground border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(strategyMap) as [SegmentStrategyMode, any][]).map(([key, strategy]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex flex-col">
                            <span>{strategy.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {strategy.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground bg-accent/30 p-2 rounded">
                    当前策略将生成 {currentStrategy.calculateSegments(parseInt(duration) || 5)} 个片段 
                    ({currentStrategy.maxSingleDuration}秒/段)
                  </div>
                </div>
              )}
              
              {/* 预计生成时间 */}
              {!isGenerating && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                    <Clock className="w-4 h-4" />
                    <span>预计生成时间: {formatEstimatedTime(calculateEstimatedTime())}</span>
                    {useNineGrid && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        含九宫格预览
                      </span>
                    )}
                  </div>
                  
                  {/* 详细时间分解 - 智能分段显示 */}
                  {parseInt(duration) > 5 && (
                    <div className="text-xs text-muted-foreground bg-accent/30 p-3 rounded-lg border border-border">
                      <p className="font-medium text-foreground/70 mb-1.5">时间分解：</p>
                      <ul className="space-y-1">
                        {useNineGrid && (
                          <li>• 九宫格预览图生成：约1分钟</li>
                        )}
                        {parseInt(duration) > 15 ? (
                          <>
                            <li>• 智能分段：{currentStrategy.calculateSegments(parseInt(duration))}个片段 
                              ({currentStrategy.maxSingleDuration}秒/段)：
                              约{Math.ceil(currentStrategy.calculateSegments(parseInt(duration)) * 1.5)}分钟</li>
                            <li>• 视频合并与处理：约30秒</li>
                          </>
                        ) : (
                          <li>• 直接生成：约1.5分钟</li>
                        )}
                        {parseInt(duration) >= 30 && (
                          <li className="text-red-400 mt-1.5 font-medium">💡 建议开启「后台生成」，生成完成后可在任务中心查看</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 h-12 text-base font-medium"
                  disabled={isGenerating || !prompt.trim()}
                  onClick={() => setShowSaveTemplateDialog(true)}
                >
                  <Save className="mr-2 h-5 w-5" />
                  保存为模板
                </Button>
                <Button
                  type="submit"
                  className={`flex-1 h-12 text-base font-medium bg-gradient-to-r ${themeGradient} hover:opacity-90`}
                  disabled={isGenerating || !prompt.trim()}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {runInBackground ? '后台生成中...' : (generationStage || '生成中...')}
                    </>
                  ) : (
                    <>
                      <Video className="mr-2 h-5 w-5" />
                      生成视频
                    </>
                  )}
                </Button>
              </div>
            </div>
    </>
  );
}
