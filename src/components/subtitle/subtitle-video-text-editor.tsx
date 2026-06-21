'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { Crosshair, FileInput, FileText, Layers, Link2, Sparkles, Type, Wand2 } from 'lucide-react';
import {
  type SubtitleConfig,
  SUBTITLE_COLOR_OPTIONS,
  type VideoTextSegment,
  createDefaultVideoTextSegment,
} from '@/constants/subtitles';

interface SubtitleVideoTextEditorProps {
  config: SubtitleConfig;
  disabled?: boolean;
  handleAddVideoTextSegment: () => void;
  handleRemoveVideoTextSegment: (segmentId: string) => void;
  handleUpdateVideoTextSegment: (segmentId: string, updates: Partial<VideoTextSegment>) => void;
  manualVideoTextValue: string;
  setManualVideoTextValue: (value: string) => void;
  setShowManualVideoTextInput: (value: boolean) => void;
  showManualVideoTextInput: boolean;
  updateConfig: (updates: Partial<SubtitleConfig>) => void;
  videoDuration: number;
}

export function SubtitleVideoTextEditor({
  config,
  disabled,
  handleAddVideoTextSegment,
  handleRemoveVideoTextSegment,
  handleUpdateVideoTextSegment,
  manualVideoTextValue,
  setManualVideoTextValue,
  setShowManualVideoTextInput,
  showManualVideoTextInput,
  updateConfig,
  videoDuration,
}: SubtitleVideoTextEditorProps) {
  return (
    <>
          {/* 视频文字编辑 */}
          <TabsContent value="videotext" className="space-y-4 mt-4">
            {/* ★ 标题/标注 功能说明 */}
            <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-red-500/10 to-red-500/10 rounded-lg border border-red-500/20">
              <div className="p-1.5 rounded-lg bg-red-500/20">
                <Type className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-red-200">视频文字</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  在视频画面上叠加标题、字幕条、数据标注、品牌Logo等文字元素（标题/标注/Overlay）。支持多段独立控制位置、样式和动画。
                </p>
              </div>
            </div>

            {/* 模式切换 + 快速操作栏 */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-red-700" />
                <Label className="text-sm font-semibold text-red-800 cursor-pointer">
                  {config.useMultiSegmentVideoText ? '多段标注模式' : '单段标题模式'}
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-red-600">单段</span>
                <Switch
                  checked={config.useMultiSegmentVideoText}
                  onCheckedChange={(checked) => updateConfig({ useMultiSegmentVideoText: checked })}
                  disabled={disabled}
                />
                <span className="text-xs text-red-600">多段</span>
              </div>
            </div>

            {/* ★ 标题/标注 快速预设面板 */}
            <div className="space-y-3">
              {/* 用途模板快速选择 */}
              <div className="p-3 bg-accent/30 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-medium text-foreground/70">用途模板</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'title', label: '主标题', icon: '📌', desc: '顶部居中·大字', position: 'top', fontSize: 56, fontWeight: 'bold' },
                    { id: 'subtitle', label: '副标题', icon: '📝', desc: '标题下方·中字', position: 'upper-third', fontSize: 36, fontWeight: 'normal' },
                    { id: 'caption', label: '字幕条', icon: '💬', desc: '底部居中·白底黑字', position: 'bottom', fontSize: 28, fontWeight: 'normal' },
                    { id: 'label', label: '数据标注', icon: '🏷️', desc: '右侧悬浮·小字标签', position: 'custom', fontSize: 20, fontWeight: 'bold' },
                    { id: 'watermark', label: '水印Logo', icon: '©️', desc: '右下角半透明', position: 'bottom-right', fontSize: 18, fontWeight: 'normal' },
                    { id: 'quote', label: '引用文字', icon: '❝', desc: '左侧大引号装饰', position: 'middle', fontSize: 32, fontWeight: 'normal' },
                    { id: 'highlight', label: '重点高亮', icon: '⚡', desc: '醒目色块背景', position: 'middle', fontSize: 40, fontWeight: 'bold' },
                    { id: 'lower-third', label: '人名字幕条', icon: '👤', desc: '底部三分之一·左对齐', position: 'lower-third', fontSize: 24, fontWeight: 'normal' },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        if (config.useMultiSegmentVideoText) {
                          // 多段模式：添加新段并应用模板
                          const newSeg = createDefaultVideoTextSegment(config.videoTextSegments.length);
                          handleAddVideoTextSegment();
                          // 延迟更新（等segment添加完成）
                          setTimeout(() => {
                            const segs = config.videoTextSegments;
                            if (segs.length > 0) {
                              const lastId = segs[segs.length - 1].id;
                              handleUpdateVideoTextSegment(lastId, {
                                text: `${tpl.icon} ${tpl.label}`,
                                position: tpl.position as any,
                                fontSize: tpl.fontSize,
                                fontWeight: tpl.fontWeight as any,
                              });
                            }
                          }, 50);
                        } else {
                          // 单段模式：更新 videoTextSegments[0]
                          const segments = config.videoTextSegments && config.videoTextSegments.length > 0
                            ? [...config.videoTextSegments]
                            : [createDefaultVideoTextSegment(30)];
                          segments[0] = {
                            ...segments[0],
                            text: `${tpl.icon} ${tpl.label}`,
                            position: tpl.position as any,
                            fontSize: tpl.fontSize,
                            fontWeight: tpl.fontWeight as any,
                          };
                          updateConfig({ videoTextSegments: segments });
                        }
                      }}
                      disabled={disabled}
                      className="group flex flex-col items-center gap-1 p-2 rounded-lg border border-border hover:border-red-500/40 hover:bg-red-500/10 transition-all"
                      title={tpl.desc}
                    >
                      <span className="text-base">{tpl.icon}</span>
                      <span className="text-[10px] text-muted-foreground group-hover:text-red-300 leading-tight">{tpl.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 动画效果预设 */}
              <div className="p-3 bg-accent/30 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-medium text-foreground/70">入场动画</span>
                  </div>
                  {!config.videoTextAnimation && (
                    <span className="text-[10px] text-foreground/30">无动画</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'none', label: '无', icon: '⏹️' },
                    { id: 'fade-in', label: '淡入', icon: '🌫️' },
                    { id: 'slide-up', label: '上滑', icon: '⬆️' },
                    { id: 'slide-left', label: '左滑', icon: '⬅️' },
                    { id: 'zoom-in', label: '缩放', icon: '🔍' },
                    { id: 'typewriter', label: '打字机', icon: '⌨️' },
                    { id: 'bounce', label: '弹跳', icon: '🏀' },
                    { id: 'glow', label: '发光', icon: '✨' },
                  ].map((anim) => (
                    <button
                      key={anim.id}
                      type="button"
                      onClick={() => updateConfig({ videoTextAnimation: anim.id as any })}
                      disabled={disabled}
                      className={`px-2 py-1 rounded-md text-[11px] transition-all ${
                        config.videoTextAnimation === anim.id
                          ? 'bg-red-500/30 text-red-200 border border-red-500/40'
                          : 'bg-accent/30 text-muted-foreground border border-border/50 hover:bg-accent hover:text-foreground/70'
                      }`}
                      title={anim.label}
                    >
                      <span className="mr-1">{anim.icon}</span>{anim.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 智能文本导入（参考字幕的智能导入） */}
              <div className="p-3 bg-accent/30 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-medium text-foreground/70">智能导入</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowManualVideoTextInput(true)}
                    disabled={disabled || showManualVideoTextInput}
                    className="h-8 text-xs bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30"
                  >
                    <FileInput className="w-3.5 h-3.5 mr-1" />
                    手动输入文字
                  </Button>

                  {/* 手动输入弹窗 */}
                  {showManualVideoTextInput && (
                    <div className="col-span-2 space-y-2 mt-2">
                      <Textarea
                        placeholder="请输入要作为标题的文字..."
                        value={manualVideoTextValue}
                        onChange={(e) => setManualVideoTextValue(e.target.value)}
                        className="min-h-[60px] bg-black/40 text-white border-white/20 placeholder:text-foreground/70"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1 h-8 text-xs bg-red-600 hover:bg-red-500 text-white"
                          onClick={() => {
                            const text = manualVideoTextValue.trim();
                            if (text) {
                              if (config.useMultiSegmentVideoText) {
                                handleAddVideoTextSegment();
                                setTimeout(() => {
                                  const segs = config.videoTextSegments;
                                  if (segs.length > 0) {
                                    handleUpdateVideoTextSegment(segs[segs.length - 1].id, { text });
                                  }
                                }, 50);
                              } else {
                                const segments = config.videoTextSegments && config.videoTextSegments.length > 0
                                  ? [...config.videoTextSegments]
                                  : [createDefaultVideoTextSegment(30)];
                                segments[0] = { ...segments[0], text };
                                updateConfig({ videoTextSegments: segments });
                              }
                            }
                            setShowManualVideoTextInput(false);
                            setManualVideoTextValue('');
                          }}
                        >
                          确认
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                          onClick={() => {
                            setShowManualVideoTextInput(false);
                            setManualVideoTextValue('');
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      // 从提示词助手生成的字幕建议中提取适合做标题的内容
                      if (config.segments.length > 0) {
                        const titleCandidate = config.segments[0]?.text || '';
                        if (titleCandidate) {
                          if (config.useMultiSegmentVideoText) {
                            handleAddVideoTextSegment();
                            setTimeout(() => {
                              const segs = config.videoTextSegments;
                              if (segs.length > 0) {
                                handleUpdateVideoTextSegment(segs[segs.length - 1].id, {
                                  text: titleCandidate.slice(0, 20),
                                  position: 'top',
                                  fontSize: 48,
                                  fontWeight: 'bold' as any,
                                });
                              }
                            }, 50);
                          } else {
                            const segments = config.videoTextSegments && config.videoTextSegments.length > 0
                              ? [...config.videoTextSegments]
                              : [createDefaultVideoTextSegment(30)];
                            segments[0] = {
                              ...segments[0],
                              text: titleCandidate.slice(0, 20),
                              position: 'top',
                              fontSize: 48,
                              fontWeight: 'bold' as any,
                            };
                            updateConfig({ videoTextSegments: segments });
                          }
                        }
                      }
                    }}
                    disabled={disabled || config.segments.length === 0}
                    className="h-8 text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                  >
                    <Link2 className="w-3.5 h-3.5 mr-1" />
                    从旁白提取标题
                  </Button>
                </div>
              </div>
            </div>

            {config.useMultiSegmentVideoText ? (
              /* 多段视频文字模式UI */
              <div className="space-y-4">
                {/* 添加段落按钮 */}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddVideoTextSegment}
                  disabled={disabled}
                  className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                >
                  <Layers className="w-4 h-4 mr-2" />
                  添加文字段落
                </Button>

                {/* 段落列表 */}
                {config.videoTextSegments.length === 0 ? (
                  <div className="p-4 text-center border-2 border-dashed border-purple-200 rounded-lg bg-red-50">
                    <p className="text-sm text-red-600">
                      暂无文字段落，点击上方按钮添加第一段文字
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {config.videoTextSegments.map((segment, index) => (
                      <Card key={segment.id} className="border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
                        <CardHeader className="p-3 pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold">
                                {index + 1}
                              </span>
                              <span className="text-sm font-semibold text-red-800">
                                第 {index + 1} 段文字
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveVideoTextSegment(segment.id)}
                              disabled={disabled}
                            >
                              删除
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-3">
                          <Textarea
                            value={segment.text}
                            onChange={(e) => handleUpdateVideoTextSegment(segment.id, { text: e.target.value })}
                            placeholder="请输入想要显示的文字..."
                            className="min-h-[60px] text-sm bg-card text-foreground border-red-300 placeholder:text-foreground/70"
                            disabled={disabled}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            {/* 位置选择 */}
                            <div className="space-y-1">
                              <Label className="text-xs text-red-700">显示位置</Label>
                              <Select
                                value={segment.position}
                                onValueChange={(value: any) => 
                                  handleUpdateVideoTextSegment(segment.id, { position: value })
                                }
                                disabled={disabled}
                              >
                                <SelectTrigger className="bg-card text-foreground border-border h-9 text-sm">
                                  <SelectValue placeholder="选择位置" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="top">顶部</SelectItem>
                                  <SelectItem value="upper-third">上三分之一</SelectItem>
                                  <SelectItem value="middle">中间</SelectItem>
                                  <SelectItem value="lower-third">下三分之一</SelectItem>
                                  <SelectItem value="bottom">底部</SelectItem>
                                  <SelectItem value="custom">自定义XY坐标</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {/* 字体大小 */}
                            <div className="space-y-1">
                              <Label className="text-xs text-red-700">字体大小</Label>
                              <Select
                                value={segment.fontSize?.toString() || '48'}
                                onValueChange={(value) => 
                                  handleUpdateVideoTextSegment(segment.id, { fontSize: parseInt(value) })
                                }
                                disabled={disabled}
                              >
                                <SelectTrigger className="bg-card text-foreground border-border h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="24">24px</SelectItem>
                                  <SelectItem value="36">36px</SelectItem>
                                  <SelectItem value="48">48px</SelectItem>
                                  <SelectItem value="64">64px</SelectItem>
                                  <SelectItem value="80">80px</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* 开始时间 */}
                            <div className="space-y-1">
                              <Label className="text-xs text-red-700">开始时间</Label>
                              <Input
                                type="number"
                                min="0"
                                value={segment.startTime}
                                onChange={(e) => handleUpdateVideoTextSegment(segment.id, { 
                                  startTime: Math.max(0, parseInt(e.target.value) || 0) 
                                })}
                                className="bg-card text-foreground border-border h-9 text-sm"
                                disabled={disabled}
                              />
                            </div>
                            
                            {/* 结束时间 */}
                            <div className="space-y-1">
                              <Label className="text-xs text-red-700">结束时间</Label>
                              <Input
                                type="number"
                                min="0"
                                value={segment.endTime}
                                onChange={(e) => handleUpdateVideoTextSegment(segment.id, { 
                                  endTime: Math.max(segment.startTime + 1, parseInt(e.target.value) || segment.startTime + 1) 
                                })}
                                className="bg-card text-foreground border-border h-9 text-sm"
                                disabled={disabled}
                              />
                            </div>
                          </div>

                          {/* 自定义XY轴位置（仅在选择"自定义XY坐标"时显示） */}
                          {segment.position === 'custom' && (
                            <div className="p-3 bg-gradient-to-r from-blue-50 to-red-50 rounded-lg border border-blue-200 space-y-3">
                              <p className="text-xs font-semibold text-red-800 flex items-center gap-1">
                                <Crosshair className="w-3.5 h-3.5" />
                                自定义XY轴位置
                              </p>
                              
                              {/* X轴（水平）位置 */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <Label className="text-xs text-red-700">X轴 (水平) 位置</Label>
                                  <span className="text-xs font-mono bg-card px-2 py-0.5 rounded border border-blue-200">
                                    {segment.customPositionX ?? 50}%
                                  </span>
                                </div>
                                <Slider
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={[segment.customPositionX ?? 50]}
                                  onValueChange={(value) => handleUpdateVideoTextSegment(segment.id, { customPositionX: value[0] })}
                                  disabled={disabled}
                                  className="py-1"
                                />
                                <div className="flex justify-between text-[10px] text-red-500">
                                  <span>左 (0%)</span>
                                  <span>中 (50%)</span>
                                  <span>右 (100%)</span>
                                </div>
                              </div>

                              {/* Y轴（垂直）位置 */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <Label className="text-xs text-red-700">Y轴 (垂直) 位置</Label>
                                  <span className="text-xs font-mono bg-card px-2 py-0.5 rounded border border-blue-200">
                                    {segment.customPositionY ?? 50}%
                                  </span>
                                </div>
                                <Slider
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={[segment.customPositionY ?? 50]}
                                  onValueChange={(value) => handleUpdateVideoTextSegment(segment.id, { customPositionY: value[0] })}
                                  disabled={disabled}
                                  className="py-1"
                                />
                                <div className="flex justify-between text-[10px] text-red-500">
                                  <span>顶 (0%)</span>
                                  <span>中 (50%)</span>
                                  <span>底 (100%)</span>
                                </div>
                              </div>

                              {/* 位置预览提示 */}
                              <div className="p-2 bg-white/70 rounded border border-blue-100">
                                <p className="text-[10px] text-red-600 leading-relaxed">
                                  💡 X=0%靠左, X=100%靠右 | Y=0%顶部, Y=100%底部<br/>
                                  📍 当前位置: ({segment.customPositionX ?? 50}%, {segment.customPositionY ?? 50}%)
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 文字颜色 */}
                          <div className="space-y-1">
                            <Label className="text-xs text-red-700">文字颜色</Label>
                            <Select
                              value={segment.fontColor || '#FFFFFF'}
                              onValueChange={(value) => handleUpdateVideoTextSegment(segment.id, { fontColor: value })}
                              disabled={disabled}
                            >
                              <SelectTrigger className="bg-card text-foreground border-border h-9 text-sm">
                                <SelectValue>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded-full border border-white/20"
                                      style={{ backgroundColor: segment.fontColor }}
                                    />
                                    <span>{segment.fontColor}</span>
                                  </div>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {SUBTITLE_COLOR_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-4 h-4 rounded-full border border-white/20"
                                        style={{ backgroundColor: opt.value }}
                                      />
                                      {opt.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* 多段模式提示 */}
                <div className="p-3 bg-card rounded-lg border border-purple-200 shadow-sm">
                  <p className="text-sm font-semibold text-red-900 mb-2">
                    📢 <strong>多段文字模式提示：</strong>
                  </p>
                  <p className="text-sm text-white">
                    • 每段文字可以单独设置内容、位置和显示时间<br/>
                    • 时间单位为秒，结束时间必须大于开始时间<br/>
                    • 不同段落的时间可以重叠，实现多层文字效果<br/>
                    • 所有文字都会被强制清晰显示在指定位置
                  </p>
                </div>
              </div>
            ) : (
              /* 单段视频文字模式UI */
              <div className="space-y-4">
                <Card className="border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-red-700">显示位置</Label>
                        <Select
                          value={config.videoTextSegments[0]?.position || 'middle'}
                          onValueChange={(value: any) => {
                            if (config.videoTextSegments.length === 0) {
                              const newSegment = createDefaultVideoTextSegment(videoDuration);
                              newSegment.position = value;
                              updateConfig({ videoTextSegments: [newSegment] });
                            } else {
                              handleUpdateVideoTextSegment(config.videoTextSegments[0].id, { position: value });
                            }
                          }}
                          disabled={disabled}
                        >
                          <SelectTrigger className="bg-card text-foreground border-border h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top">顶部</SelectItem>
                            <SelectItem value="upper-third">上三分之一</SelectItem>
                            <SelectItem value="middle">中间</SelectItem>
                            <SelectItem value="lower-third">下三分之一</SelectItem>
                            <SelectItem value="bottom">底部</SelectItem>
                            <SelectItem value="custom">自定义位置</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-red-700">字体大小</Label>
                        <Select
                          value={(config.videoTextSegments[0]?.fontSize || 48).toString()}
                          onValueChange={(value) => {
                            if (config.videoTextSegments.length === 0) {
                              const newSegment = createDefaultVideoTextSegment(videoDuration);
                              newSegment.fontSize = parseInt(value);
                              updateConfig({ videoTextSegments: [newSegment] });
                            } else {
                              handleUpdateVideoTextSegment(config.videoTextSegments[0].id, { fontSize: parseInt(value) });
                            }
                          }}
                          disabled={disabled}
                        >
                          <SelectTrigger className="bg-card text-foreground border-border h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="24">24px</SelectItem>
                            <SelectItem value="36">36px</SelectItem>
                            <SelectItem value="48">48px</SelectItem>
                            <SelectItem value="64">64px</SelectItem>
                            <SelectItem value="80">80px</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-red-700">开始时间</Label>
                        <Input
                          type="number"
                          min="0"
                          value={config.videoTextSegments[0]?.startTime || 0}
                          onChange={(e) => {
                            if (config.videoTextSegments.length === 0) {
                              const newSegment = createDefaultVideoTextSegment(videoDuration);
                              newSegment.startTime = Math.max(0, parseInt(e.target.value) || 0);
                              updateConfig({ videoTextSegments: [newSegment] });
                            } else {
                              handleUpdateVideoTextSegment(config.videoTextSegments[0].id, { 
                                startTime: Math.max(0, parseInt(e.target.value) || 0) 
                              });
                            }
                          }}
                          className="bg-card text-foreground border-border h-9 text-sm"
                          disabled={disabled}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-red-700">结束时间</Label>
                        <Input
                          type="number"
                          min="0"
                          value={config.videoTextSegments[0]?.endTime || videoDuration}
                          onChange={(e) => {
                            if (config.videoTextSegments.length === 0) {
                              const newSegment = createDefaultVideoTextSegment(videoDuration);
                              newSegment.endTime = Math.max(1, parseInt(e.target.value) || videoDuration);
                              updateConfig({ videoTextSegments: [newSegment] });
                            } else {
                              handleUpdateVideoTextSegment(config.videoTextSegments[0].id, { 
                                endTime: Math.max(1, parseInt(e.target.value) || videoDuration) 
                              });
                            }
                          }}
                          className="bg-card text-foreground border-border h-9 text-sm"
                          disabled={disabled}
                        />
                      </div>
                    </div>

                    {/* 文字颜色 */}
                    <div className="space-y-1">
                      <Label className="text-xs text-red-700">文字颜色</Label>
                      <Select
                        value={config.videoTextSegments[0]?.fontColor || '#FFFFFF'}
                        onValueChange={(value) => {
                          if (config.videoTextSegments.length === 0) {
                            const newSegment = createDefaultVideoTextSegment(videoDuration);
                            newSegment.fontColor = value;
                            updateConfig({ videoTextSegments: [newSegment] });
                          } else {
                            handleUpdateVideoTextSegment(config.videoTextSegments[0].id, { fontColor: value });
                          }
                        }}
                        disabled={disabled}
                      >
                        <SelectTrigger className="bg-card text-foreground border-border h-9 text-sm">
                          <SelectValue>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded-full border border-white/20"
                                style={{ backgroundColor: config.videoTextSegments[0]?.fontColor || '#FFFFFF' }}
                              />
                              <span>{config.videoTextSegments[0]?.fontColor || '#FFFFFF'}</span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {SUBTITLE_COLOR_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-full border border-white/20"
                                  style={{ backgroundColor: opt.value }}
                                />
                                {opt.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

    </>
  );
}
