'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Layout, 
  List, 
  Plus, 
  Trash2, 
  Settings,
  Clock,
  Film,
  PlayCircle,
  RefreshCw
} from 'lucide-react';
import { StoryboardTimeline } from './storyboard-timeline';
import { StoryboardEditor } from './storyboard-editor';
import type { StoryboardShot, Storyboard } from '@/types/storyboard';
import type { StoryboardScene } from '@/types/storyboard-scene';

interface StoryboardSceneEditorProps {
  onGenerate?: () => void;
  isGenerating?: boolean;
}

export function StoryboardSceneEditor({
  onGenerate,
  isGenerating = false
}: StoryboardSceneEditorProps) {
  // 模式：分镜头模式 / 场景模式
  const [mode, setMode] = useState<'shots' | 'scenes'>('shots');
  
  // 分镜头数据（简单模式）
  const [shots, setShots] = useState<StoryboardShot[]>([{
    id: `shot-${Date.now()}`,
    index: 0,
    prompt: '',
    duration: 5,
    nineGridImages: [],
    status: 'pending'
  }]);
  
  // 场景数据（场景模式）
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  
  // 项目标题
  const [title, setTitle] = useState('未命名分镜头项目');
  
  // 当前选中的场景
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  // 计算总时长
  const totalDuration = mode === 'shots'
    ? shots.reduce((sum, shot) => sum + shot.duration, 0)
    : scenes.length > 0
      ? Math.max(...scenes.map(s => s.endTime))
      : 0;
  
  const isDurationValid = totalDuration > 10;

  // 添加分镜头
  const addShot = () => {
    const newShot: StoryboardShot = {
      id: `shot-${Date.now()}`,
      index: shots.length,
      prompt: '',
      duration: 5,
      nineGridImages: [],
      status: 'pending'
    };
    setShots(prev => [...prev, newShot]);
  };

  // 删除分镜头
  const removeShot = (shotId: string) => {
    if (shots.length <= 1) return;
    setShots(prev => prev
      .filter(s => s.id !== shotId)
      .map((s, i) => ({ ...s, index: i }))
    );
  };

  // 更新分镜头
  const updateShot = (shotId: string, updates: Partial<StoryboardShot>) => {
    setShots(prev => prev.map(shot => 
      shot.id === shotId ? { ...shot, ...updates } : shot
    ));
  };

  // 添加场景
  const addScene = () => {
    const newStartTime = scenes.length > 0
      ? Math.max(...scenes.map(s => s.endTime))
      : 0;
    const newEndTime = newStartTime + 5;
    
    const newScene: StoryboardScene = {
      id: `scene-${Date.now()}`,
      index: scenes.length,
      startTime: newStartTime,
      endTime: newEndTime,
      duration: 5,
      description: '',
      shotIds: [],
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    setScenes(prev => [...prev, newScene]);
  };

  // 更新场景
  const updateScene = (sceneId: string, updates: Partial<StoryboardScene>) => {
    setScenes(prev => prev.map(scene => 
      scene.id === sceneId
        ? {
            ...scene,
            ...updates,
            ...(updates.startTime !== undefined || updates.endTime !== undefined
              ? { duration: (updates.endTime ?? scene.endTime) - (updates.startTime ?? scene.startTime) }
              : {}
            ),
            updatedAt: Date.now()
          }
        : scene
    ));
  };

  // 删除场景
  const deleteScene = (sceneId: string) => {
    if (scenes.length <= 1) return;
    setScenes(prev => prev
      .filter(s => s.id !== sceneId)
      .map((s, i) => ({ ...s, index: i }))
    );
    if (selectedSceneId === sceneId) {
      setSelectedSceneId(null);
    }
  };

  // 从分镜头转换为场景
  const convertShotsToScenes = () => {
    let currentTime = 0;
    const newScenes: StoryboardScene[] = shots.map((shot, index) => {
      const startTime = currentTime;
      const endTime = currentTime + shot.duration;
      currentTime = endTime;
      
      return {
        id: `scene-${Date.now()}-${index}`,
        index,
        startTime,
        endTime,
        duration: shot.duration,
        description: shot.prompt,
        nineGridImages: shot.nineGridImages,
        thumbnailImage: shot.nineGridImages?.[0],
        shotIds: [shot.id],
        status: shot.status === 'pending' ? 'draft' :
                shot.status === 'images-generated' ? 'images_done' :
                shot.status === 'completed' ? 'completed' : 'draft',
        error: shot.error,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    });
    
    setScenes(newScenes);
    setMode('scenes');
  };

  // 从场景转换为分镜头
  const convertScenesToShots = () => {
    const newShots: StoryboardShot[] = scenes.map((scene, index) => ({
      id: `shot-${Date.now()}-${index}`,
      index,
      prompt: scene.description,
      duration: scene.duration,
      nineGridImages: scene.nineGridImages || [],
      videoUrl: scene.videoUrl,
      status: scene.status === 'draft' ? 'pending' :
              scene.status === 'images_done' ? 'images-generated' :
              scene.status === 'completed' ? 'completed' : 'pending',
      error: scene.error
    }));
    
    setShots(newShots);
    setMode('shots');
  };

  // 时间格式化
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* 头部信息 */}
      <Card className="border-border bg-gradient-to-r from-[#EF4444]/10 to-[#B4E22F]/10">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-white flex items-center gap-2">
                <Film className="w-6 h-6 text-[#EF4444]" />
                分镜头视频编辑器（增强版）
              </CardTitle>
              <CardDescription>
                支持分镜头模式和场景模式，可随时切换
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className={`text-lg font-bold ${isDurationValid ? 'text-[#EF4444]' : 'text-red-400'}`}>
                <Clock className="w-5 h-5 inline mr-1" />
                {totalDuration}秒
              </div>
              <div className={`text-xs ${isDurationValid ? 'text-green-400' : 'text-red-400'}`}>
                {isDurationValid ? '✓ 总时长超过10秒' : '✗ 总时长需要超过10秒'}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-foreground/70 text-sm">项目名称</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入分镜头视频项目名称..."
                className="bg-black/30 border-border"
                disabled={isGenerating}
              />
            </div>
            
            {/* 模式切换 */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-4">
                <span className="text-sm text-foreground/70">工作模式：</span>
                <Tabs value={mode} onValueChange={(v) => setMode(v as 'shots' | 'scenes')}>
                  <TabsList className="bg-black/30">
                    <TabsTrigger value="shots">
                      <List className="w-4 h-4 mr-2" />
                      分镜头模式
                    </TabsTrigger>
                    <TabsTrigger value="scenes">
                      <Layout className="w-4 h-4 mr-2" />
                      场景模式
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              <div className="flex gap-2">
                {mode === 'shots' && shots.length > 0 && scenes.length === 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={convertShotsToScenes}
                  >
                    <Layout className="w-4 h-4 mr-2" />
                    转换为场景
                  </Button>
                )}
                {mode === 'scenes' && scenes.length > 0 && shots.length === 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={convertScenesToShots}
                  >
                    <List className="w-4 h-4 mr-2" />
                    转换为分镜头
                  </Button>
                )}
              </div>
            </div>
            
            {/* 操作按钮 */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={mode === 'shots' ? addShot : addScene}
                disabled={isGenerating}
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加{mode === 'shots' ? '分镜头' : '场景'}
              </Button>
              {onGenerate && (
                <Button
                  className="flex-1 bg-gradient-to-r from-[#EF4444] to-[#B4E22F] hover:opacity-90 text-black"
                  onClick={onGenerate}
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

      {/* 分镜头模式 */}
      {mode === 'shots' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              分镜头列表 ({shots.length})
            </h3>
          </div>
          
          <div className="grid gap-4">
            {shots.map((shot, index) => (
              <Card key={shot.id} className="border-border bg-accent/30">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#EF4444] text-black rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-medium flex items-center gap-2">
                          分镜头 {index + 1}
                          <span className="text-xs px-2 py-0.5 bg-accent/50 rounded-full text-muted-foreground">
                            {shot.duration}秒
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-foreground/70 hover:text-red-400"
                      onClick={() => removeShot(shot.id)}
                      disabled={isGenerating || shots.length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label className="text-foreground/70 text-sm">分镜头描述</Label>
                    <Textarea
                      placeholder="描述这个分镜头的内容..."
                      value={shot.prompt}
                      onChange={(e) => updateShot(shot.id, { prompt: e.target.value })}
                      className="h-20 bg-black/30 border-border"
                      disabled={isGenerating}
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-4">
                    <div className="flex-1">
                      <Label className="text-foreground/70 text-sm">时长（秒）</Label>
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
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 场景模式 */}
      {mode === 'scenes' && (
        <div className="space-y-6">
          <StoryboardTimeline
            scenes={scenes}
            totalDuration={totalDuration}
            onSceneClick={setSelectedSceneId}
            onAddScene={addScene}
            selectedSceneId={selectedSceneId || undefined}
          />
          
          {/* 选中场景的详情编辑 */}
          {selectedSceneId && (
            <Card className="border-border bg-accent/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  编辑场景
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const scene = scenes.find(s => s.id === selectedSceneId);
                  if (!scene) return null;
                  
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-foreground/70 text-sm">开始时间（秒）</Label>
                          <Input
                            type="number"
                            value={scene.startTime}
                            onChange={(e) => updateScene(scene.id, { startTime: Number(e.target.value) })}
                            className="bg-black/30 border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-foreground/70 text-sm">结束时间（秒）</Label>
                          <Input
                            type="number"
                            value={scene.endTime}
                            onChange={(e) => updateScene(scene.id, { endTime: Number(e.target.value) })}
                            className="bg-black/30 border-border"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-foreground/70 text-sm">场景标题（可选）</Label>
                        <Input
                          value={scene.title || ''}
                          onChange={(e) => updateScene(scene.id, { title: e.target.value })}
                          placeholder="例如：产品展示"
                          className="bg-black/30 border-border"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-foreground/70 text-sm">场景描述</Label>
                        <Textarea
                          value={scene.description}
                          onChange={(e) => updateScene(scene.id, { description: e.target.value })}
                          placeholder="详细描述这个场景的内容..."
                          className="h-32 bg-black/30 border-border"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center pt-4 border-t border-border">
                        <Button
                          variant="secondary"
                          onClick={() => deleteScene(scene.id)}
                          disabled={scenes.length <= 1}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          删除场景
                        </Button>
                        
                        <Button
                          variant="secondary"
                          onClick={() => setSelectedSceneId(null)}
                        >
                          完成编辑
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
