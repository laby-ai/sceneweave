'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Video,
  Wand2,
  Settings,
  Sparkles,
  CheckCircle2,
  Loader2,
  Clock,
  UserPlus,
  Palette,
  Layers,
  Languages,
  Volume2,
  Mic,
  Upload
} from 'lucide-react';
import { 
  VIDEO_STYLES, 
  VIDEO_STYLE_CATEGORIES, 
  getVideoStyleById,
  type VideoStyle 
} from '@/constants/video-styles';
import { 
  VIDEO_RESOLUTION_OPTIONS, 
  VIDEO_RATIO_OPTIONS 
} from '@/constants/filters';

interface VideoConfig {
  id: string;
  videoUrl: string;
  prompt: string;
  createdAt: number;
  duration?: string;
  style?: string;
  resolution?: string;
  ratio?: string;
  hasSubtitle?: boolean;
  language?: string;
  smartEnhance?: boolean;
  watermark?: boolean;
  enableSubtitle?: boolean;
  subtitleText?: string;
  materials?: any[];
}

interface VideoGenerationFormOptimizedProps {
  onGenerate: (video: VideoConfig) => void;
  isGenerating: boolean;
  onGeneratingChange?: (isGenerating: boolean) => void;
  onPromptEnhanced?: (originalPrompt: string, enhancedPrompt: string) => void;
  initialPrompt?: string;
  initialConfig?: Partial<VideoConfig>;
}

export function VideoGenerationFormOptimized({ 
  onGenerate, 
  isGenerating: isGeneratingProp,
  onGeneratingChange,
  onPromptEnhanced,
  initialPrompt = '',
  initialConfig
}: VideoGenerationFormOptimizedProps) {
  // 基础状态
  const [prompt, setPrompt] = useState(initialPrompt);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('vlog');
  const [showCustomSettings, setShowCustomSettings] = useState(false);
  
  // 自定义设置状态
  const [duration, setDuration] = useState<string>('10');
  const [resolution, setResolution] = useState<string>('720p');
  const [ratio, setRatio] = useState<string>('16:9');
  const [language, setLanguage] = useState<string>('zh');
  const [smartEnhance, setSmartEnhance] = useState<boolean>(true);
  const [watermark, setWatermark] = useState<boolean>(true);
  const [enableSubtitle, setEnableSubtitle] = useState(false);
  const [subtitleText, setSubtitleText] = useState('');
  
  const selectedStyle = getVideoStyleById(selectedStyleId) || VIDEO_STYLES[0];
  
  // 加载初始配置
  useEffect(() => {
    if (initialConfig) {
      if (initialConfig.prompt) setPrompt(initialConfig.prompt);
      if (initialConfig.duration) setDuration(initialConfig.duration);
      if (initialConfig.resolution) setResolution(initialConfig.resolution);
      if (initialConfig.ratio) setRatio(initialConfig.ratio);
      if (initialConfig.language) setLanguage(initialConfig.language);
      if (typeof initialConfig.smartEnhance === 'boolean') setSmartEnhance(initialConfig.smartEnhance);
      if (typeof initialConfig.watermark === 'boolean') setWatermark(initialConfig.watermark);
      if (typeof initialConfig.enableSubtitle === 'boolean') setEnableSubtitle(initialConfig.enableSubtitle);
      if (initialConfig.subtitleText) setSubtitleText(initialConfig.subtitleText);
    }
  }, [initialConfig]);
  
  // 当选择风格时，应用该风格的默认设置
  useEffect(() => {
    if (selectedStyle) {
      if (selectedStyle.duration) setDuration(selectedStyle.duration);
      if (selectedStyle.ratio) setRatio(selectedStyle.ratio);
    }
  }, [selectedStyleId]);
  
  // 快速模板文本
  const quickTexts = [
    '一个美丽的日出场景，金色的阳光洒在海面上',
    '城市夜景，车水马龙，霓虹闪烁',
    '森林中的小动物，阳光透过树叶',
    '现代建筑特写，线条简洁，光影优美',
    '厨房烹饪场景，美食制作过程'
  ];
  
  // 生成最终提示词
  const getFinalPrompt = () => {
    let finalPrompt = prompt;
    
    if (selectedStyle && selectedStyle.stylePrompt) {
      finalPrompt += `，${selectedStyle.stylePrompt}`;
    }
    
    if (selectedStyle && selectedStyle.moodPrompt) {
      finalPrompt += `，${selectedStyle.moodPrompt}`;
    }
    
    return finalPrompt;
  };
  
  const handleSubmit = async () => {
    if (!prompt.trim()) {
      alert('请输入视频描述');
      return;
    }
    
    // 这里简化处理，实际项目中应该调用API
    const finalPrompt = getFinalPrompt();
    
    // 模拟生成视频（实际项目中应该调用API）
    console.log('生成视频:', {
      prompt: finalPrompt,
      duration: parseInt(duration),
      style: selectedStyleId,
      resolution,
      ratio,
      language,
      smartEnhance,
      watermark,
      enableSubtitle,
      subtitleText: enableSubtitle ? subtitleText : undefined,
    });
    
    // 模拟回调
    onGenerate({
      id: Date.now().toString(),
      videoUrl: '', // 实际项目中会返回真实的视频URL
      prompt: finalPrompt,
      createdAt: Date.now(),
      duration,
      style: selectedStyleId,
      resolution,
      ratio,
      language,
      smartEnhance,
      watermark,
      enableSubtitle,
      subtitleText,
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：风格选择和提示词 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 视频风格选择 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  选择视频风格
                </CardTitle>
                <CardDescription>选择适合您内容的视频风格</CardDescription>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCustomSettings(!showCustomSettings)}
              >
                <Settings className="w-4 h-4 mr-2" />
                自定义设置
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 风格分类标签 */}
              <Tabs defaultValue="lifestyle">
                <TabsList className="grid w-full grid-cols-4">
                  {VIDEO_STYLE_CATEGORIES.map(category => (
                    <TabsTrigger key={category.id} value={category.id}>
                      {category.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                {VIDEO_STYLE_CATEGORIES.map(category => (
                  <TabsContent key={category.id} value={category.id}>
                    <ScrollArea className="h-[350px] pr-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                        {VIDEO_STYLES
                          .filter(style => style.category === category.id)
                          .map((style) => (
                            <div
                              key={style.id}
                              onClick={() => setSelectedStyleId(style.id)}
                              className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                                selectedStyleId === style.id 
                                  ? 'border-primary ring-2 ring-primary ring-offset-2' 
                                  : 'border-muted-foreground/20'
                              }`}
                            >
                              <div className="aspect-video relative">
                                <img
                                  src={style.thumbnail}
                                  alt={style.name}
                                  className="w-full h-full object-cover"
                                />
                                {selectedStyleId === style.id && (
                                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                    <CheckCircle2 className="w-8 h-8 text-primary" />
                                  </div>
                                )}
                              </div>
                              <div className="p-3 bg-background">
                                <p className="font-medium text-sm">{style.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">{style.description}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
          
          {/* 提示词输入 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5" />
                输入视频描述
              </CardTitle>
              <CardDescription>描述您想要生成的视频内容</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="请描述您想要生成的视频内容，例如：一个美丽的日出场景，金色的阳光洒在海面上..."
                className="min-h-[150px] resize-none"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">快速模板：</p>
                <div className="flex flex-wrap gap-2">
                  {quickTexts.map((quickText, index) => (
                    <Button
                      key={index}
                      variant="secondary"
                      size="sm"
                      onClick={() => setPrompt(quickText)}
                    >
                      模板 {index + 1}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 自定义设置 */}
          {showCustomSettings && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  自定义设置
                </CardTitle>
                <CardDescription>高级视频参数配置</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 时长 */}
                  <div className="space-y-2">
                    <Label>视频时长（秒）</Label>
                    <Input
                      type="number"
                      min="1"
                      max="60"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                    />
                  </div>
                  
                  {/* 分辨率 */}
                  <div className="space-y-2">
                    <Label>视频分辨率</Label>
                    <Select value={resolution} onValueChange={setResolution}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_RESOLUTION_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* 比例 */}
                  <div className="space-y-2">
                    <Label>视频比例</Label>
                    <Select value={ratio} onValueChange={setRatio}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_RATIO_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* 语言 */}
                  <div className="space-y-2">
                    <Label>语言</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zh">中文</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="ja">日本語</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  {/* 智能增强 */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>智能增强</Label>
                      <p className="text-sm text-muted-foreground">AI 自动优化提示词</p>
                    </div>
                    <Switch checked={smartEnhance} onCheckedChange={setSmartEnhance} />
                  </div>
                  
                  {/* 水印 */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>添加水印</Label>
                      <p className="text-sm text-muted-foreground">在视频中添加品牌水印</p>
                    </div>
                    <Switch checked={watermark} onCheckedChange={setWatermark} />
                  </div>
                  
                  {/* 字幕 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>自动字幕</Label>
                        <p className="text-sm text-muted-foreground">AI 自动生成视频字幕</p>
                      </div>
                      <Switch checked={enableSubtitle} onCheckedChange={setEnableSubtitle} />
                    </div>
                    
                    {enableSubtitle && (
                      <Textarea
                        placeholder="输入字幕文本，或留空让AI自动生成..."
                        value={subtitleText}
                        onChange={(e) => setSubtitleText(e.target.value)}
                        rows={3}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* 右侧：预览和生成 */}
        <div className="space-y-6">
          {/* 风格预览卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                风格预览
              </CardTitle>
              <CardDescription>当前选择的视频风格</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 预览图片 */}
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                <img
                  src={selectedStyle.thumbnail}
                  alt={selectedStyle.name}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* 风格信息 */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium text-lg">{selectedStyle.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedStyle.description}</p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{VIDEO_STYLE_CATEGORIES.find(c => c.id === selectedStyle.category)?.name}</Badge>
                  <Badge variant="outline">{selectedStyle.duration || duration}秒</Badge>
                  <Badge variant="outline">{selectedStyle.ratio || ratio}</Badge>
                </div>
              </div>
              
              {/* 操作按钮 */}
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={isGeneratingProp || !prompt.trim()}
                >
                  {isGeneratingProp ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      生成视频
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* 配置摘要 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">配置摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">视频风格</span>
                <span className="font-medium">{selectedStyle.name}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">时长</span>
                <span>{duration}秒</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">分辨率</span>
                <span>{VIDEO_RESOLUTION_OPTIONS.find(o => o.value === resolution)?.label}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">比例</span>
                <span>{VIDEO_RATIO_OPTIONS.find(o => o.value === ratio)?.label}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">智能增强</span>
                <span>{smartEnhance ? '已开启' : '已关闭'}</span>
              </div>
              {enableSubtitle && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">自动字幕</span>
                    <span>已开启</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
