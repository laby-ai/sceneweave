'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  GripVertical,
  Settings,
  PlayCircle,
  RefreshCw,
  Film,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Layout,
  List,
  Save,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';

import type { StoryboardScene } from '@/types/storyboard-scene';
import { 
  STORYBOARD_TEMPLATES, 
  STORYBOARD_TEMPLATE_CATEGORIES,
  getTemplatesByCategory,
  createScenesFromTemplate,
  type StoryboardTemplate 
} from '@/constants/storyboard-templates';

interface StoryboardCompleteEditorProps {
  onGenerate?: (scenes: StoryboardScene[]) => void;
  isGenerating?: boolean;
}

// 创建默认场景
const createDefaultScene = (index: number, startTime: number, duration: number = 5): StoryboardScene => ({
  id: `scene-${Date.now()}-${index}`,
  index,
  startTime,
  endTime: startTime + duration,
  duration,
  description: '',
  shotIds: [],
  status: 'draft',
  createdAt: Date.now(),
  updatedAt: Date.now()
});

export function StoryboardCompleteEditor({
  onGenerate,
  isGenerating = false
}: StoryboardCompleteEditorProps) {
  // 场景列表
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  
  // 项目标题
  const [title, setTitle] = useState('未命名分镜头项目');
  
  // 当前选中的场景
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  
  // 展开的场景
  const [expandedSceneIds, setExpandedSceneIds] = useState<Set<string>>(new Set());
  
  // 模板选择相关
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [selectedTemplate, setSelectedTemplate] = useState<StoryboardTemplate | null>(null);
  
  // 拖拽状态
  const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null);
  const [dragOverSceneId, setDragOverSceneId] = useState<string | null>(null);
  
  // 生成状态
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);

  // 计算总时长
  const totalDuration = scenes.length > 0
    ? Math.max(...scenes.map(s => s.endTime))
    : 0;
  const isDurationValid = totalDuration > 10;

  // 时间格式化
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 添加场景
  const addScene = useCallback(() => {
    const newStartTime = scenes.length > 0
      ? Math.max(...scenes.map(s => s.endTime))
      : 0;
    
    const newScene = createDefaultScene(scenes.length, newStartTime);
    setScenes(prev => [...prev, newScene]);
    setExpandedSceneIds(prev => new Set(prev).add(newScene.id));
  }, [scenes]);

  // 删除场景
  const removeScene = useCallback((sceneId: string) => {
    if (scenes.length <= 1) return;
    
    setScenes(prev => {
      const filtered = prev.filter(s => s.id !== sceneId);
      // 重新计算时间
      let currentTime = 0;
      return filtered.map((scene, index) => {
        const startTime = currentTime;
        const endTime = startTime + scene.duration;
        currentTime = endTime;
        return {
          ...scene,
          index,
          startTime,
          endTime
        };
      });
    });
    
    setExpandedSceneIds(prev => {
      const next = new Set(prev);
      next.delete(sceneId);
      return next;
    });
    
    if (selectedSceneId === sceneId) {
      setSelectedSceneId(null);
    }
  }, [scenes, selectedSceneId]);

  // 更新场景
  const updateScene = useCallback((sceneId: string, updates: Partial<StoryboardScene>) => {
    setScenes(prev => prev.map(scene => 
      scene.id === sceneId
        ? {
            ...scene,
            ...updates,
            // 如果修改了时长，重新计算时间
            ...(updates.duration !== undefined && updates.duration !== scene.duration
              ? {
                  endTime: scene.startTime + (updates.duration ?? scene.duration)
                }
              : {}
            ),
            updatedAt: Date.now()
          }
        : scene
    ));
  }, []);

  // 切换场景展开状态
  const toggleSceneExpanded = useCallback((sceneId: string) => {
    setExpandedSceneIds(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  }, []);

  // 拖拽处理
  const handleDragStart = useCallback((sceneId: string) => {
    setDraggedSceneId(sceneId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, sceneId: string) => {
    e.preventDefault();
    if (draggedSceneId && draggedSceneId !== sceneId) {
      setDragOverSceneId(sceneId);
    }
  }, [draggedSceneId]);

  const handleDrop = useCallback((targetSceneId: string) => {
    if (!draggedSceneId || draggedSceneId === targetSceneId) {
      setDraggedSceneId(null);
      setDragOverSceneId(null);
      return;
    }

    setScenes(prev => {
      const newScenes = [...prev];
      const draggedIndex = newScenes.findIndex(s => s.id === draggedSceneId);
      const targetIndex = newScenes.findIndex(s => s.id === targetSceneId);
      
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      // 移除并插入
      const [draggedScene] = newScenes.splice(draggedIndex, 1);
      newScenes.splice(targetIndex, 0, draggedScene);
      
      // 重新计算时间
      let currentTime = 0;
      return newScenes.map((scene, index) => {
        const startTime = currentTime;
        const endTime = startTime + scene.duration;
        currentTime = endTime;
        return {
          ...scene,
          index,
          startTime,
          endTime
        };
      });
    });

    setDraggedSceneId(null);
    setDragOverSceneId(null);
  }, [draggedSceneId]);

  // 应用模板
  const applyTemplate = useCallback((template: StoryboardTemplate) => {
    const templateScenes = createScenesFromTemplate(template);
    setScenes(templateScenes);
    setTitle(template.name);
    setSelectedTemplate(template);
    setShowTemplateDialog(false);
    
    // 展开所有新场景
    const expandedIds = new Set(templateScenes.map(s => s.id));
    setExpandedSceneIds(expandedIds);
  }, []);

  // 生成场景图片
  const generateSceneImages = useCallback(async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || !scene.description) return;

    setGeneratingSceneId(sceneId);
    updateScene(sceneId, {
      status: 'generating',
      generationProgress: 0,
      generationStage: '准备生成...'
    });

    try {
      // 找到前一个场景
      const sceneIndex = scenes.findIndex(s => s.id === sceneId);
      const previousScene = sceneIndex > 0 ? scenes[sceneIndex - 1] : null;
      const previousLastFrame = previousScene?.thumbnailImage;

      updateScene(sceneId, {
        generationProgress: 10,
        generationStage: '正在调用图片生成API...'
      });

      // 调用API生成图片
      const response = await fetch(`/api/storyboard/scene/${sceneId}/generate-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyboardId: 'temp',
          prompt: scene.description,
          continuityWithPrevious: !!previousLastFrame,
          previousSceneLastFrame: previousLastFrame
        })
      });

      if (!response.ok) {
        throw new Error('图片生成失败');
      }

      const data = await response.json();

      if (data.success && data.imageUrls) {
        updateScene(sceneId, {
          nineGridImages: data.imageUrls,
          thumbnailImage: data.thumbnailUrl,
          status: 'images_done',
          generationProgress: 100,
          generationStage: '图片生成完成'
        });
      } else {
        throw new Error(data.error || '图片生成失败');
      }
    } catch (error) {
      console.error('生成场景图片失败:', error);
      updateScene(sceneId, {
        status: 'failed',
        error: error instanceof Error ? error.message : '生成失败'
      });
    } finally {
      setGeneratingSceneId(null);
    }
  }, [scenes, updateScene]);

  // 生成所有场景图片
  const generateAllSceneImages = useCallback(async () => {
    for (const scene of scenes) {
      if (!scene.nineGridImages || scene.nineGridImages.length === 0) {
        await generateSceneImages(scene.id);
      }
    }
  }, [scenes, generateSceneImages]);

  // 提交生成
  const handleSubmit = useCallback(() => {
    if (!isDurationValid) return;
    onGenerate?.(scenes);
  }, [scenes, isDurationValid, onGenerate]);

  // 获取状态图标
  const getStatusIcon = (status: StoryboardScene['status']) => {
    switch (status) {
      case 'images_done':
      case 'video_done':
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'generating':
        return <Clock className="w-4 h-4 text-red-500 animate-pulse" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-foreground/70" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 头部信息 */}
      <Card className="border-border bg-gradient-to-r from-red-500/10 via-pink-500/10 to-red-500/10">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Film className="w-6 h-6 text-red-400" />
                分镜头编辑器（完整版）
              </CardTitle>
              <CardDescription>
                支持模板、拖拽排序、场景图片生成
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className={`text-lg font-bold ${isDurationValid ? 'text-green-400' : 'text-red-400'}`}>
                {formatTime(totalDuration)}
              </div>
              <div className={`text-xs ${isDurationValid ? 'text-green-400' : 'text-red-400'}`}>
                {isDurationValid ? '✓ 总时长超过10秒' : '✗ 总时长需要超过10秒'}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 项目标题和模板选择 */}
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-foreground/70 text-sm">项目名称</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入分镜头项目名称..."
                  className="bg-black/30 border-border"
                  disabled={isGenerating}
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  onClick={() => setShowTemplateDialog(true)}
                  disabled={isGenerating}
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  选择模板
                </Button>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={addScene}
                disabled={isGenerating}
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加场景
              </Button>
              
              {scenes.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={generateAllSceneImages}
                  disabled={isGenerating || !!generatingSceneId}
                  className="flex-1"
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  生成所有场景图片
                </Button>
              )}
              
              {onGenerate && (
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
                      生成分镜头视频
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 场景列表 */}
      {scenes.length === 0 ? (
        <Card className="border-border bg-accent/30">
          <CardContent className="p-12 text-center">
            <Layers className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">
              开始创建分镜头
            </h3>
            <p className="text-foreground/70 mb-6">
              点击"添加场景"或选择模板开始
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="secondary"
                onClick={addScene}
              >
                <Plus className="w-4 h-4 mr-2" />
                添加场景
              </Button>
              <Button
                onClick={() => setShowTemplateDialog(true)}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                选择模板
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-red-400" />
              场景列表 ({scenes.length})
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GripVertical className="w-4 h-4" />
              拖拽排序
            </div>
          </div>

          <div className="space-y-4">
            {scenes.map((scene, index) => (
              <Card
                key={scene.id}
                className={`
                  border-border bg-accent/30 transition-all
                  ${draggedSceneId === scene.id ? 'opacity-50' : ''}
                  ${dragOverSceneId === scene.id ? 'ring-2 ring-purple-500' : ''}
                `}
                draggable
                onDragStart={() => handleDragStart(scene.id)}
                onDragOver={(e) => handleDragOver(e, scene.id)}
                onDrop={() => handleDrop(scene.id)}
                onDragEnd={() => {
                  setDraggedSceneId(null);
                  setDragOverSceneId(null);
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* 拖拽句柄 */}
                      <div className="cursor-grab active:cursor-grabbing text-foreground/70 hover:text-foreground/70">
                        <GripVertical className="w-5 h-5" />
                      </div>
                      
                      {/* 序号和状态 */}
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center font-bold
                        ${index % 3 === 0 ? 'bg-red-500' : index % 3 === 1 ? 'bg-rose-500' : 'bg-red-500'}
                        text-white
                      `}>
                        {index + 1}
                      </div>
                      
                      {/* 内容 */}
                      <div className="flex-1">
                        <div className="text-white font-medium flex items-center gap-2">
                          {scene.title || `场景 ${index + 1}`}
                          <Badge variant="secondary" className="text-xs bg-accent/50">
                            {formatTime(scene.startTime)} - {formatTime(scene.endTime)}
                          </Badge>
                          <Badge variant="secondary" className="text-xs bg-accent/50">
                            {scene.duration}秒
                          </Badge>
                          
                          {/* 状态指示器 */}
                          <div className="flex items-center gap-1">
                            {getStatusIcon(scene.status)}
                          </div>
                          
                          {/* 有图片标记 */}
                          {scene.nineGridImages && scene.nineGridImages.length > 0 && (
                            <Badge variant="secondary" className="text-xs bg-green-500 text-white">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              九宫格
                            </Badge>
                          )}
                        </div>
                        
                        {scene.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {scene.description}
                          </p>
                        )}
                        
                        {/* 生成进度 */}
                        {scene.status === 'generating' && scene.generationProgress !== undefined && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>{scene.generationStage || '生成中...'}</span>
                              <span>{scene.generationProgress}%</span>
                            </div>
                            <div className="h-1.5 bg-accent/50 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-500 transition-all"
                                style={{ width: `${scene.generationProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* 错误信息 */}
                        {scene.error && (
                          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {scene.error}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* 右侧操作按钮 */}
                    <div className="flex items-center gap-2">
                      {/* 展开/折叠 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-foreground/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSceneExpanded(scene.id);
                        }}
                      >
                        {expandedSceneIds.has(scene.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                      
                      {/* 生成图片按钮 */}
                      {(!scene.nineGridImages || scene.nineGridImages.length === 0) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateSceneImages(scene.id);
                          }}
                          disabled={isGenerating || generatingSceneId === scene.id || !scene.description}
                        >
                          {generatingSceneId === scene.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <ImageIcon className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      
                      {/* 删除按钮 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-foreground/70 hover:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeScene(scene.id);
                        }}
                        disabled={isGenerating || scenes.length <= 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* 展开的详情 */}
                {expandedSceneIds.has(scene.id) && (
                  <CardContent className="pt-0 border-t border-border">
                    <div className="mt-4 space-y-4">
                      {/* 场景标题 */}
                      <div className="space-y-2">
                        <Label className="text-foreground/70 text-sm">场景标题（可选）</Label>
                        <Input
                          value={scene.title || ''}
                          onChange={(e) => updateScene(scene.id, { title: e.target.value })}
                          placeholder="例如：产品展示"
                          className="bg-black/30 border-border"
                          disabled={isGenerating}
                        />
                      </div>
                      
                      {/* 场景描述 */}
                      <div className="space-y-2">
                        <Label className="text-foreground/70 text-sm flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          场景描述
                        </Label>
                        <Textarea
                          value={scene.description}
                          onChange={(e) => updateScene(scene.id, { description: e.target.value })}
                          placeholder="详细描述这个场景的内容..."
                          className="h-28 bg-black/30 border-border"
                          disabled={isGenerating}
                        />
                      </div>
                      
                      {/* 时长调整 */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-foreground/70 text-sm">开始时间（秒）</Label>
                          <Input
                            type="number"
                            value={scene.startTime}
                            readOnly
                            className="bg-black/20 border-border text-muted-foreground"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-foreground/70 text-sm">时长（秒）</Label>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={scene.duration}
                            onChange={(e) => updateScene(scene.id, { duration: Number(e.target.value) })}
                            className="bg-black/30 border-border"
                            disabled={isGenerating}
                          />
                        </div>
                      </div>
                      
                      {/* 九宫格图片预览 */}
                      {scene.nineGridImages && scene.nineGridImages.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-foreground/70 text-sm flex items-center gap-2">
                              <ImageIcon className="w-4 h-4" />
                              九宫格图片 ({scene.nineGridImages.length}张)
                            </Label>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                generateSceneImages(scene.id);
                              }}
                              disabled={isGenerating || generatingSceneId === scene.id}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              重新生成
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {scene.nineGridImages.map((imageUrl, imgIndex) => (
                              <div key={imgIndex} className="aspect-video bg-black rounded overflow-hidden relative">
                                <img
                                  src={imageUrl}
                                  alt={`场景${index + 1} - 图片${imgIndex + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute top-1 left-1 bg-black/60 rounded px-1.5 py-0.5">
                                  <span className="text-xs text-white">{imgIndex + 1}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 模板选择对话框 */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              选择分镜头模板
            </DialogTitle>
            <DialogDescription>
              选择一个模板快速开始，或从头创建
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* 分类筛选 */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === '全部' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setSelectedCategory('全部')}
              >
                全部
              </Button>
              {STORYBOARD_TEMPLATE_CATEGORIES.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>

            {/* 模板列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(selectedCategory === '全部'
                ? STORYBOARD_TEMPLATES
                : getTemplatesByCategory(selectedCategory)
              ).map(template => (
                <Card
                  key={template.id}
                  className={`
                    cursor-pointer transition-all border-2
                    ${selectedTemplate?.id === template.id 
                      ? 'border-red-500 bg-red-500/10' 
                      : 'border-transparent hover:border-white/20'
                    }
                  `}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-foreground">{template.name}</h4>
                        <p className="text-sm text-muted-foreground">{template.category}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {template.scenes.length} 个场景
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground/70 mb-3">
                      {template.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {template.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 选择按钮 */}
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowTemplateDialog(false)}
              >
                取消
              </Button>
              <Button
                disabled={!selectedTemplate}
                onClick={() => selectedTemplate && applyTemplate(selectedTemplate)}
                className="bg-red-500"
              >
                <Save className="w-4 h-4 mr-2" />
                应用此模板
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
