'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Mic, 
  Image as ImageIcon, 
  Settings, 
  Play, 
  Download,
  Sparkles,
  CheckCircle2,
  Loader2,
  Monitor,
  Upload,
  Plus,
  X,
  Clock,
  Trash2,
  UserPlus
} from 'lucide-react';
import { 
  AVATAR_MODELS, 
  VOICE_OPTIONS, 
  BACKGROUND_OPTIONS, 
  AvatarModel, 
  VoiceOption, 
  BackgroundOption,
  CustomAvatar,
  CUSTOM_AVATARS_STORAGE_KEY
} from '@/types/avatar';
import { useTasks } from '@/contexts/TaskContext';
import { useRouter } from 'next/navigation';

interface AvatarGeneratorProps {
  onVideoGenerated?: (videoUrl: string) => void;
}

export function AvatarGenerator({ onVideoGenerated }: AvatarGeneratorProps) {
  const { addTask } = useTasks();
  const router = useRouter();
  
  // 基础状态
  const [selectedModel, setSelectedModel] = useState<string>(AVATAR_MODELS[0].id);
  const [selectedVoice, setSelectedVoice] = useState<string>(VOICE_OPTIONS[0].id);
  const [selectedBackground, setSelectedBackground] = useState<string>('none');
  const [text, setText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('720p');
  
  // 后台任务相关
  const [useBackgroundTask, setUseBackgroundTask] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  // 自定义形象相关
  const [showCustomAvatar, setShowCustomAvatar] = useState(false);
  const [customAvatars, setCustomAvatars] = useState<CustomAvatar[]>([]);
  const [customAvatarName, setCustomAvatarName] = useState('');
  const [customAvatarImage, setCustomAvatarImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const selectedModelData = AVATAR_MODELS.find(m => m.id === selectedModel) || AVATAR_MODELS[0];
  const selectedVoiceData = VOICE_OPTIONS.find(v => v.id === selectedVoice) || VOICE_OPTIONS[0];

  // 加载自定义形象
  useEffect(() => {
    const saved = localStorage.getItem(CUSTOM_AVATARS_STORAGE_KEY);
    if (saved) {
      try {
        setCustomAvatars(JSON.parse(saved));
      } catch (e) {
        console.error('加载自定义形象失败:', e);
      }
    }
  }, []);

  // 保存自定义形象
  const saveCustomAvatars = useCallback((avatars: CustomAvatar[]) => {
    setCustomAvatars(avatars);
    localStorage.setItem(CUSTOM_AVATARS_STORAGE_KEY, JSON.stringify(avatars));
  }, []);

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setCustomAvatarImage(result);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // 添加自定义形象
  const addCustomAvatar = () => {
    if (!customAvatarName.trim() || !customAvatarImage) {
      alert('请输入名称并上传图片');
      return;
    }

    const newAvatar: CustomAvatar = {
      id: `custom-${Date.now()}`,
      name: customAvatarName.trim(),
      imageUrl: customAvatarImage!,
      createdAt: Date.now(),
    };

    const updated = [...customAvatars, newAvatar];
    saveCustomAvatars(updated);
    setCustomAvatarName('');
    setCustomAvatarImage(null);
    setShowCustomAvatar(false);
  };

  // 删除自定义形象
  const deleteCustomAvatar = (id: string) => {
    if (confirm('确定要删除这个自定义形象吗？')) {
      const updated = customAvatars.filter(a => a.id !== id);
      saveCustomAvatars(updated);
      if (selectedModel === id) {
        setSelectedModel(AVATAR_MODELS[0].id);
      }
    }
  };

  // 生成数字人视频
  const handleGenerate = async () => {
    if (!text.trim()) {
      alert('请输入要播报的文本内容');
      return;
    }

    if (useBackgroundTask) {
      await handleBackgroundGenerate();
    } else {
      await handleDirectGenerate();
    }
  };

  // 后台生成
  const handleBackgroundGenerate = async () => {
    try {
      setIsGenerating(true);

      const isCustomModel = selectedModel.startsWith('custom-');
      const customAvatar = customAvatars.find(a => a.id === selectedModel);

      const response = await fetch('/api/avatar/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: isCustomModel ? 'custom' : selectedModel,
          text: text,
          voiceType: selectedVoice,
          background: selectedBackground,
          aspectRatio: aspectRatio,
          resolution: resolution,
          customImageUrl: customAvatar?.imageUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '提交任务失败');
      }

      const result = await response.json();
      
      if (result.taskId) {
        // 添加任务到任务中心
        addTask({
          id: result.taskId,
          type: 'avatar',
          status: 'pending',
          config: {
            prompt: text,
            modelId: selectedModel,
            voiceType: selectedVoice,
            background: selectedBackground,
            ratio: aspectRatio,
            resolution,
          },
          progress: 0,
          stage: '等待中',
        });

        setCurrentTaskId(result.taskId);
        alert('数字人任务已提交！请前往任务中心查看进度');
        
        // 跳转到任务中心
        router.push('/?section=tasks');
      }
    } catch (error) {
      console.error('后台生成失败:', error);
      alert(error instanceof Error ? error.message : '生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  // 直接生成
  const handleDirectGenerate = async () => {
    setIsGenerating(true);
    setProgress(0);
    setGeneratedVideoUrl(null);

    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 1000);

      const isCustomModel = selectedModel.startsWith('custom-');
      const customAvatar = customAvatars.find(a => a.id === selectedModel);

      const response = await fetch('/api/avatar/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: isCustomModel ? 'custom' : selectedModel,
          text: text,
          voiceType: selectedVoice,
          background: selectedBackground,
          aspectRatio: aspectRatio,
          resolution: resolution,
          customImageUrl: customAvatar?.imageUrl,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '生成失败');
      }

      const result = await response.json();
      setProgress(100);

      if (result.videoUrl) {
        setGeneratedVideoUrl(result.videoUrl);
        onVideoGenerated?.(result.videoUrl);
      }
    } catch (error) {
      console.error('生成失败:', error);
      alert(error instanceof Error ? error.message : '生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (generatedVideoUrl) {
      const link = document.createElement('a');
      link.href = generatedVideoUrl;
      link.download = `avatar-video-${Date.now()}.mp4`;
      link.click();
    }
  };

  const quickTexts = [
    '大家好，欢迎来到我的频道！今天给大家带来一个非常有趣的话题。',
    '产品介绍：这款产品采用最新技术，性能卓越，使用简便，是您的最佳选择。',
    '知识分享：在今天的课程中，我们将学习如何提高工作效率和时间管理技巧。',
    '新闻播报：今日要闻，国内外重大事件回顾，为您带来最新资讯。',
    '节日祝福：祝愿大家节日快乐，身体健康，万事如意，阖家幸福！'
  ];

  // 获取所有可用的模型（包括自定义）
  const allModels: AvatarModel[] = [
    ...AVATAR_MODELS,
    ...customAvatars.map(avatar => ({
      id: avatar.id,
      name: avatar.name,
      description: avatar.description || '自定义数字人',
      thumbnail: avatar.imageUrl,
      category: 'custom',
      isCustom: true,
      customImageUrl: avatar.imageUrl,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：模型和配置 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 生成模式切换 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                生成设置
              </CardTitle>
              <CardDescription>选择生成模式和高级选项</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch 
                    checked={useBackgroundTask}
                    onCheckedChange={setUseBackgroundTask}
                  />
                  <div>
                    <Label>后台任务模式</Label>
                    <p className="text-sm text-muted-foreground">
                      在后台生成，可关闭页面继续等待
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 数字人模型选择 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
            <div>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              选择数字人形象
            </CardTitle>
            <CardDescription>选择适合您内容风格的数字人主播</CardDescription>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCustomAvatar(!showCustomAvatar)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              添加自定义
            </Button>
          </CardHeader>
          <CardContent>
            {/* 添加自定义形象弹窗 */}
            {showCustomAvatar && (
              <Card className="mb-4 border-primary/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">创建自定义数字人</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>形象名称</Label>
                    <Input
                      placeholder="给您的数字人起个名字"
                      value={customAvatarName}
                      onChange={(e) => setCustomAvatarName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>上传图片</Label>
                    <div
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => document.getElementById('avatar-image-upload')?.click()}
                    >
                      <input
                        id="avatar-image-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                      {customAvatarImage ? (
                        <div className="space-y-2">
                          <img
                            src={customAvatarImage}
                            alt="预览"
                            className="max-h-40 mx-auto rounded-lg object-cover"
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomAvatarImage(null);
                            }}
                          >
                            <X className="w-4 h-4 mr-2" />
                            移除图片
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                          <p className="text-muted-foreground">
                            {isUploading ? '上传中...' : '点击上传人物照片'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowCustomAvatar(false);
                        setCustomAvatarName('');
                        setCustomAvatarImage(null);
                      }}
                    >
                      取消
                    </Button>
                    <Button onClick={addCustomAvatar} disabled={!customAvatarName || !customAvatarImage || isUploading}>
                      <Plus className="w-4 h-4 mr-2" />
                      创建自定义形象
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <ScrollArea className="h-[400px] pr-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {allModels.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                      selectedModel === model.id 
                        ? 'border-primary ring-2 ring-primary ring-offset-2' 
                        : 'border-muted-foreground/20'
                    }`}
                  >
                    <div className="aspect-square relative">
                      <img
                        src={model.thumbnail}
                        alt={model.name}
                        className="w-full h-full object-cover"
                      />
                      {selectedModel === model.id && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-primary" />
                        </div>
                      )}
                      {model.isCustom && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="secondary" className="text-xs bg-red-500">自定义</Badge>
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-background">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{model.name}</p>
                        {model.isCustom && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCustomAvatar(model.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{model.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 文本输入 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              输入播报文本
            </CardTitle>
            <CardDescription>输入您想让数字人说的内容</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="请输入要播报的文本内容，建议50-500字..."
              className="min-h-[150px] resize-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">快速模板：</p>
              <div className="flex flex-wrap gap-2">
                {quickTexts.map((quickText, index) => (
                  <Button
                    key={index}
                    variant="secondary"
                    size="sm"
                    onClick={() => setText(quickText)}
                  >
                    模板 {index + 1}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>字数：{text.length}</span>
              <span>预计时长：{Math.ceil(text.length / 8)}秒</span>
            </div>
          </CardContent>
        </Card>

        {/* 高级设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              高级设置
            </CardTitle>
            <CardDescription>配置视频和音频参数</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 声音选择 */}
              <div className="space-y-2">
                <Label>配音声音</Label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name} ({voice.language})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 背景选择 */}
              <div className="space-y-2">
                <Label>背景设置</Label>
                <Select value={selectedBackground} onValueChange={setSelectedBackground}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BACKGROUND_OPTIONS.map((bg) => (
                      <SelectItem key={bg.id} value={bg.id}>
                        {bg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 视频比例 */}
              <div className="space-y-2">
                <Label>视频比例</Label>
                <RadioGroup 
                  value={aspectRatio} 
                  onValueChange={(val) => setAspectRatio(val as any)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="16:9" id="ratio-16-9" />
                    <Label htmlFor="ratio-16-9">16:9 横屏</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="9:16" id="ratio-9-16" />
                    <Label htmlFor="ratio-9-16">9:16 竖屏</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1:1" id="ratio-1-1" />
                    <Label htmlFor="ratio-1-1">1:1 方形</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 分辨率 */}
              <div className="space-y-2">
                <Label>视频分辨率</Label>
                <Select value={resolution} onValueChange={(val) => setResolution(val as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="720p">720p 高清</SelectItem>
                    <SelectItem value="1080p">1080p 全高清</SelectItem>
                    <SelectItem value="4k">4K 超清</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

        {/* 右侧：预览和生成 */}
        <div className="space-y-6">
          {/* 预览卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                视频预览
              </CardTitle>
              <CardDescription>预览生成的数字人视频</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 预览区域 */}
              <div 
                className={`relative bg-muted rounded-lg overflow-hidden flex items-center justify-center ${
                  aspectRatio === '9:16' ? 'aspect-[9/16]' : 
                  aspectRatio === '1:1' ? 'aspect-square' : 'aspect-video'
                }`}
              >
                {generatedVideoUrl ? (
                  <video
                    src={generatedVideoUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                    <img
                      src={allModels.find(m => m.id === selectedModel)?.thumbnail}
                      alt={allModels.find(m => m.id === selectedModel)?.name}
                      className="w-32 h-32 rounded-full mb-4 object-cover"
                    />
                    <p className="font-medium">{allModels.find(m => m.id === selectedModel)?.name}</p>
                    <p className="text-sm">点击生成按钮创建视频</p>
                  </div>
                )}
              </div>

              {/* 生成进度 */}
              {isGenerating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{useBackgroundTask ? '正在提交任务...' : '正在生成视频...'}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {useBackgroundTask ? '任务提交中...' : '数字人视频生成中，请稍候...'}
                  </p>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={handleGenerate}
                  disabled={isGenerating || !text.trim()}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {useBackgroundTask ? '提交中...' : '生成中...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {useBackgroundTask ? '后台生成' : '生成视频'}
                    </>
                  )}
                </Button>
                
                {generatedVideoUrl && (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 已选配置摘要 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">配置摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">数字人</span>
                <span className="font-medium">{allModels.find(m => m.id === selectedModel)?.name}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">配音</span>
                <span>{selectedVoiceData.name}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">背景</span>
                <span>{BACKGROUND_OPTIONS.find(b => b.id === selectedBackground)?.name}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">规格</span>
                <span>{aspectRatio} · {resolution}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">模式</span>
                <span>{useBackgroundTask ? '后台任务' : '直接生成'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
