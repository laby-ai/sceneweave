'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Trash2,
  Settings,
  PlayCircle,
  RefreshCw,
  Film,
  Image as ImageIcon,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// 分镜头配置类型
interface ShotConfig {
  id: string;
  index: number;
  prompt: string;
  duration: number;
  
  // 可配置的选项
  model: 'doubao-seedance-1-5-pro-251215' | 'doubao-seedance-2-0-260128';
  resolution: '720P' | '1080P' | '4K';
  enablePromptOptimization: boolean;
  aspectRatio: '16:9' | '9:16' | '1:1';
  
  // 图片生成选项
  imageModel: string;
  enableImageOptimization: boolean;
  
  // 展开状态
  expanded: boolean;
}

const VIDEO_MODEL_OPTIONS: Array<{ id: ShotConfig['model']; label: string }> = [
  { id: 'doubao-seedance-1-5-pro-251215', label: 'Seedance 1.5 Pro' },
  { id: 'doubao-seedance-2-0-260128', label: 'Seedance 2.0 Pro' },
];

const DEFAULT_VIDEO_MODEL: ShotConfig['model'] = 'doubao-seedance-2-0-260128';

// 视频生成表单增强版 Props
interface VideoGenerationFormEnhancedProps {
  onSubmit?: (configs: ShotConfig[]) => void;
  isGenerating?: boolean;
}

// 默认分镜头配置
const createDefaultShot = (index: number): ShotConfig => ({
  id: `shot-${Date.now()}-${index}`,
  index,
  prompt: '',
  duration: 5,
  model: DEFAULT_VIDEO_MODEL,
  resolution: '720P',
  enablePromptOptimization: true,
  aspectRatio: '16:9',
  imageModel: 'image-01',
  enableImageOptimization: true,
  expanded: true
});

export function VideoGenerationFormEnhanced({
  onSubmit,
  isGenerating = false
}: VideoGenerationFormEnhancedProps) {
  // 分镜头配置列表
  const [shots, setShots] = useState<ShotConfig[]>([
    createDefaultShot(0)
  ]);
  
  // 全局配置（可选）
  const [useGlobalConfig, setUseGlobalConfig] = useState(false);
  const [globalConfig, setGlobalConfig] = useState<Partial<ShotConfig>>({
    model: DEFAULT_VIDEO_MODEL,
    resolution: '720P',
    enablePromptOptimization: true,
    aspectRatio: '16:9'
  });

  // 添加分镜头
  const addShot = () => {
    const newIndex = shots.length;
    setShots(prev => [...prev, createDefaultShot(newIndex)]);
  };

  // 删除分镜头
  const removeShot = (shotId: string) => {
    if (shots.length <= 1) return;
    setShots(prev => prev
      .filter(s => s.id !== shotId)
      .map((s, i) => ({ ...s, index: i }))
    );
  };

  // 更新分镜头配置
  const updateShot = (shotId: string, updates: Partial<ShotConfig>) => {
    setShots(prev => prev.map(shot => 
      shot.id === shotId ? { ...shot, ...updates } : shot
    ));
  };

  // 切换分镜头展开/折叠
  const toggleShotExpanded = (shotId: string) => {
    setShots(prev => prev.map(shot => 
      shot.id === shotId ? { ...shot, expanded: !shot.expanded } : shot
    ));
  };

  // 批量应用全局配置
  const applyGlobalConfig = () => {
    if (!useGlobalConfig) return;
    
    setShots(prev => prev.map(shot => ({
      ...shot,
      ...globalConfig
    })));
  };

  // 计算总时长
  const totalDuration = shots.reduce((sum, shot) => sum + shot.duration, 0);
  const isDurationValid = totalDuration > 10;

  // 提交
  const handleSubmit = () => {
    if (!isDurationValid) return;
    onSubmit?.(shots);
  };

  // 时间格式化
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* 头部信息 */}
      <Card className="border-border bg-gradient-to-r from-red-500/10 to-pink-500/10">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Film className="w-6 h-6 text-red-400" />
                视频生成器（增强版）
              </CardTitle>
              <CardDescription>
                每个分镜头可单独配置，支持不同选择
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className={`text-lg font-bold ${isDurationValid ? 'text-green-400' : 'text-red-400'}`}>
                {formatDuration(totalDuration)}
              </div>
              <div className={`text-xs ${isDurationValid ? 'text-green-400' : 'text-red-400'}`}>
                {isDurationValid ? '✓ 总时长超过10秒' : '✗ 总时长需要超过10秒'}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 全局配置开关 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Switch
                id="global-config"
                checked={useGlobalConfig}
                onCheckedChange={setUseGlobalConfig}
              />
              <Label htmlFor="global-config" className="text-foreground/80">
                使用全局配置
              </Label>
            </div>
            {useGlobalConfig && (
              <Button
                variant="secondary"
                size="sm"
                onClick={applyGlobalConfig}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                应用到所有分镜头
              </Button>
            )}
          </div>

          {/* 全局配置（可选） */}
          {useGlobalConfig && (
            <Card className="bg-black/30 border-border mb-4">
              <CardContent className="p-4">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  全局配置
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-foreground/70 text-sm">视频模型</Label>
                    <Select
                      value={globalConfig.model}
                      onValueChange={(v: any) => setGlobalConfig(p => ({ ...p, model: v }))}
                    >
                      <SelectTrigger className="bg-black/30 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_MODEL_OPTIONS.map(model => (
                          <SelectItem key={model.id} value={model.id}>{model.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-foreground/70 text-sm">分辨率</Label>
                    <Select
                      value={globalConfig.resolution}
                      onValueChange={(v: any) => setGlobalConfig(p => ({ ...p, resolution: v }))}
                    >
                      <SelectTrigger className="bg-black/30 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="720P">720P</SelectItem>
                        <SelectItem value="1080P">1080P</SelectItem>
                        <SelectItem value="4K">4K</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-foreground/70 text-sm">画幅比例</Label>
                    <Select
                      value={globalConfig.aspectRatio}
                      onValueChange={(v: any) => setGlobalConfig(p => ({ ...p, aspectRatio: v }))}
                    >
                      <SelectTrigger className="bg-black/30 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16:9">16:9 (横屏)</SelectItem>
                        <SelectItem value="9:16">9:16 (竖屏)</SelectItem>
                        <SelectItem value="1:1">1:1 (方形)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-foreground/70 text-sm">提示词优化</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        checked={globalConfig.enablePromptOptimization}
                        onCheckedChange={(v) => setGlobalConfig(p => ({ ...p, enablePromptOptimization: v }))}
                      />
                      <span className="text-sm text-foreground/70">
                        {globalConfig.enablePromptOptimization ? '已开启' : '已关闭'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={addShot}
              disabled={isGenerating}
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加分镜头
            </Button>
            {onSubmit && (
              <Button
                className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 hover:opacity-90"
                onClick={handleSubmit}
                disabled={isGenerating || !isDurationValid}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4 mr-2" />
                    生成视频
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 分镜头列表 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-red-400" />
            分镜头配置列表 ({shots.length})
          </h3>
          <p className="text-sm text-muted-foreground">
            每个分镜头可以独立配置不同选项
          </p>
        </div>

        <div className="space-y-4">
          {shots.map((shot, index) => (
            <Card key={shot.id} className="border-border bg-accent/30">
              <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleShotExpanded(shot.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-bold
                      ${index % 3 === 0 ? 'bg-red-500' : index % 3 === 1 ? 'bg-rose-500' : 'bg-red-500'}
                      text-white
                    `}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-white font-medium flex items-center gap-2">
                        分镜头 {index + 1}
                        <Badge variant="secondary" className="text-xs bg-accent/50">
                          {shot.duration}秒
                        </Badge>
                        {shot.model !== DEFAULT_VIDEO_MODEL && (
                          <Badge variant="secondary" className="text-xs bg-red-500 text-white">
                            {shot.model}
                          </Badge>
                        )}
                        {shot.resolution !== '720P' && (
                          <Badge variant="secondary" className="text-xs bg-red-500 text-white">
                            {shot.resolution}
                          </Badge>
                        )}
                      </div>
                      {shot.prompt && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {shot.prompt}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-foreground/70"
                    >
                      {shot.expanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                    {!useGlobalConfig && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-foreground/70 hover:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeShot(shot.id);
                        }}
                        disabled={isGenerating || shots.length <= 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {shot.expanded && (
                <CardContent className="pt-0">
                  <Separator className="my-4 bg-accent/50" />
                  
                  <div className="space-y-4">
                    {/* 基本信息 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-foreground/70 text-sm flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          分镜头描述
                        </Label>
                        <Textarea
                          placeholder="详细描述这个分镜头的内容..."
                          value={shot.prompt}
                          onChange={(e) => updateShot(shot.id, { prompt: e.target.value })}
                          className="h-24 bg-black/30 border-border"
                          disabled={isGenerating}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-foreground/70 text-sm flex items-center gap-2">
                          <Film className="w-4 h-4" />
                          时长（秒）
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={shot.duration}
                          onChange={(e) => updateShot(shot.id, { duration: Number(e.target.value) })}
                          className="bg-black/30 border-border"
                          disabled={isGenerating}
                        />
                      </div>
                    </div>

                    {/* 如果不是全局配置，显示独立配置 */}
                    {!useGlobalConfig && (
                      <>
                        <Separator className="my-4 bg-accent/50" />
                        
                        <h4 className="text-white font-medium flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          分镜头独立配置
                        </h4>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {/* 视频模型 */}
                          <div className="space-y-2">
                            <Label className="text-foreground/70 text-sm">视频模型</Label>
                            <Select
                              value={shot.model}
                              onValueChange={(v: any) => updateShot(shot.id, { model: v })}
                              disabled={isGenerating}
                            >
                              <SelectTrigger className="bg-black/30 border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {VIDEO_MODEL_OPTIONS.map(model => (
                                  <SelectItem key={model.id} value={model.id}>{model.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* 分辨率 */}
                          <div className="space-y-2">
                            <Label className="text-foreground/70 text-sm">分辨率</Label>
                            <Select
                              value={shot.resolution}
                              onValueChange={(v: any) => updateShot(shot.id, { resolution: v })}
                              disabled={isGenerating}
                            >
                              <SelectTrigger className="bg-black/30 border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="720P">720P</SelectItem>
                                <SelectItem value="1080P">1080P</SelectItem>
                                <SelectItem value="4K">4K</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* 画幅比例 */}
                          <div className="space-y-2">
                            <Label className="text-foreground/70 text-sm">画幅比例</Label>
                            <Select
                              value={shot.aspectRatio}
                              onValueChange={(v: any) => updateShot(shot.id, { aspectRatio: v })}
                              disabled={isGenerating}
                            >
                              <SelectTrigger className="bg-black/30 border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="16:9">16:9 (横屏)</SelectItem>
                                <SelectItem value="9:16">9:16 (竖屏)</SelectItem>
                                <SelectItem value="1:1">1:1 (方形)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* 提示词优化 */}
                          <div className="space-y-2">
                            <Label className="text-foreground/70 text-sm flex items-center gap-2">
                              <Sparkles className="w-4 h-4" />
                              提示词优化
                            </Label>
                            <div className="flex items-center gap-2 h-10">
                              <Switch
                                checked={shot.enablePromptOptimization}
                                onCheckedChange={(v) => updateShot(shot.id, { enablePromptOptimization: v })}
                                disabled={isGenerating}
                              />
                              <span className="text-sm text-foreground/70">
                                {shot.enablePromptOptimization ? '已开启' : '已关闭'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* 图片生成配置 */}
                        <div className="mt-4 p-4 bg-black/20 rounded-lg">
                          <h5 className="text-foreground/80 text-sm font-medium mb-3 flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            九宫格图片生成配置
                          </h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-foreground/70 text-xs">图片模型</Label>
                              <Select
                                value={shot.imageModel}
                                onValueChange={(v) => updateShot(shot.id, { imageModel: v })}
                                disabled={isGenerating}
                              >
                                <SelectTrigger className="bg-black/30 border-border h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="image-01">image-01</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-foreground/70 text-xs">图片优化</Label>
                              <div className="flex items-center gap-2 h-8">
                                <Switch
                                  checked={shot.enableImageOptimization}
                                  onCheckedChange={(v) => updateShot(shot.id, { enableImageOptimization: v })}
                                  disabled={isGenerating}
                                />
                                <span className="text-xs text-foreground/70">
                                  {shot.enableImageOptimization ? '已开启' : '已关闭'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
