'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, Plus, X, Video, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTemplates } from '@/contexts/TemplateContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  STYLE_OPTIONS, 
  MOOD_OPTIONS, 
  FILTER_OPTIONS, 
  COLOR_THEME_OPTIONS,
  VIDEO_RESOLUTION_OPTIONS,
  VIDEO_RATIO_OPTIONS,
  IMAGE_RESOLUTION_OPTIONS,
  IMAGE_SIZE_OPTIONS,
  IMAGE_QUALITY_OPTIONS
} from '@/constants';

export default function CreateTemplatePage() {
  const router = useRouter();
  const { themeGradient } = useTheme();
  const { t } = useLanguage();
  const { addTemplate } = useTemplates();
  const { user } = useAuth();

  const [templateType, setTemplateType] = useState<'video' | 'image'>('video');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateCategory, setTemplateCategory] = useState('自定义');
  const [templateTags, setTemplateTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  // 视频模板配置
  const [videoConfig, setVideoConfig] = useState({
    prompt: '',
    duration: '5',
    style: 'none',
    mood: 'none',
    filter: 'none',
    colorTheme: 'none',
    resolution: '720p',
    ratio: '16:9',
    smartEnhance: true,
    watermark: true,
  });

  // 图片模板配置
  const [imageConfig, setImageConfig] = useState({
    prompt: '',
    resolution: '1024x1024',
    size: 'square',
    quality: 'standard',
    style: 'none',
    mood: 'none',
    filter: 'none',
    colorTheme: 'none',
    watermark: true,
  });

  const addTag = () => {
    if (tagInput.trim() && !templateTags.includes(tagInput.trim())) {
      setTemplateTags([...templateTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTemplateTags(templateTags.filter(tag => tag !== tagToRemove));
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      alert('请输入模板名称');
      return;
    }

    const config = templateType === 'video' ? videoConfig : imageConfig;

    addTemplate({
      name: templateName,
      description: templateDescription,
      type: templateType,
      category: templateCategory,
      tags: templateTags,
      isPublic,
      config,
      prompt: config.prompt,
    });

    alert('模板创建成功！');
    router.push('/templates');
  };

  const categories = [
    '自定义',
    '风景',
    '人物',
    '动画',
    '抽象',
    '写实',
    '艺术',
    '商业',
    '社交媒体',
    '其他'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-xl border-b shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/templates')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回
              </Button>
              <h1 className="text-xl font-bold">创建模板</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => router.push('/templates')}
              >
                取消
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim()}
                className={`bg-gradient-to-r ${themeGradient}`}
              >
                <Save className="w-4 h-4 mr-2" />
                保存模板
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Basic Info */}
          <div className="space-y-6">
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
                <CardDescription>设置模板的基本信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">模板名称 <span className="text-red-500">*</span></Label>
                  <Input
                    id="template-name"
                    placeholder="请输入模板名称"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-description">模板描述</Label>
                  <Textarea
                    id="template-description"
                    placeholder="请输入模板描述"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-category">分类</Label>
                  <Select value={templateCategory} onValueChange={setTemplateCategory}>
                    <SelectTrigger id="template-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>标签</Label>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {templateTags.map((tag, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="添加标签"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    />
                    <Button type="button" variant="secondary" onClick={addTag}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>公开模板</Label>
                    <p className="text-xs text-muted-foreground">
                      其他用户可以看到和使用此模板
                    </p>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Template Configuration */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle>模板配置</CardTitle>
                <CardDescription>设置模板的生成参数</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={templateType} onValueChange={(v) => setTemplateType(v as 'video' | 'image')}>
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="video" className="flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      视频模板
                    </TabsTrigger>
                    <TabsTrigger value="image" className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      图片模板
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="video" className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="video-prompt">默认提示词</Label>
                      <Textarea
                        id="video-prompt"
                        placeholder="输入模板的默认提示词"
                        value={videoConfig.prompt}
                        onChange={(e) => setVideoConfig({ ...videoConfig, prompt: e.target.value })}
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>艺术风格</Label>
                        <Select
                          value={videoConfig.style}
                          onValueChange={(v) => setVideoConfig({ ...videoConfig, style: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">不选择</SelectItem>
                            {STYLE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>氛围感觉</Label>
                        <Select
                          value={videoConfig.mood}
                          onValueChange={(v) => setVideoConfig({ ...videoConfig, mood: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">不选择</SelectItem>
                            {MOOD_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>滤镜效果</Label>
                        <Select
                          value={videoConfig.filter}
                          onValueChange={(v) => setVideoConfig({ ...videoConfig, filter: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FILTER_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>颜色主色调</Label>
                        <Select
                          value={videoConfig.colorTheme}
                          onValueChange={(v) => setVideoConfig({ ...videoConfig, colorTheme: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COLOR_THEME_OPTIONS.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>视频时长</Label>
                        <Select
                          value={videoConfig.duration}
                          onValueChange={(v) => setVideoConfig({ ...videoConfig, duration: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5秒</SelectItem>
                            <SelectItem value="10">10秒</SelectItem>
                            <SelectItem value="15">15秒</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>分辨率</Label>
                        <Select
                          value={videoConfig.resolution}
                          onValueChange={(v) => setVideoConfig({ ...videoConfig, resolution: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VIDEO_RESOLUTION_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>画面比例</Label>
                        <Select
                          value={videoConfig.ratio}
                          onValueChange={(v) => setVideoConfig({ ...videoConfig, ratio: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VIDEO_RATIO_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>智能增强描述</Label>
                          <p className="text-xs text-muted-foreground">
                            自动优化您的视频描述
                          </p>
                        </div>
                        <Switch
                          checked={videoConfig.smartEnhance}
                          onCheckedChange={(v) => setVideoConfig({ ...videoConfig, smartEnhance: v })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>添加水印</Label>
                          <p className="text-xs text-muted-foreground">
                            在视频中添加水印标识
                          </p>
                        </div>
                        <Switch
                          checked={videoConfig.watermark}
                          onCheckedChange={(v) => setVideoConfig({ ...videoConfig, watermark: v })}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="image" className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="image-prompt">默认提示词</Label>
                      <Textarea
                        id="image-prompt"
                        placeholder="输入模板的默认提示词"
                        value={imageConfig.prompt}
                        onChange={(e) => setImageConfig({ ...imageConfig, prompt: e.target.value })}
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>艺术风格</Label>
                        <Select
                          value={imageConfig.style}
                          onValueChange={(v) => setImageConfig({ ...imageConfig, style: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">不选择</SelectItem>
                            {STYLE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>氛围感觉</Label>
                        <Select
                          value={imageConfig.mood}
                          onValueChange={(v) => setImageConfig({ ...imageConfig, mood: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">不选择</SelectItem>
                            {MOOD_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>滤镜效果</Label>
                        <Select
                          value={imageConfig.filter}
                          onValueChange={(v) => setImageConfig({ ...imageConfig, filter: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FILTER_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>颜色主色调</Label>
                        <Select
                          value={imageConfig.colorTheme}
                          onValueChange={(v) => setImageConfig({ ...imageConfig, colorTheme: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COLOR_THEME_OPTIONS.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>分辨率</Label>
                        <Select
                          value={imageConfig.resolution}
                          onValueChange={(v) => setImageConfig({ ...imageConfig, resolution: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IMAGE_RESOLUTION_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>尺寸比例</Label>
                        <Select
                          value={imageConfig.size}
                          onValueChange={(v) => setImageConfig({ ...imageConfig, size: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IMAGE_SIZE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>画质质量</Label>
                        <Select
                          value={imageConfig.quality}
                          onValueChange={(v) => setImageConfig({ ...imageConfig, quality: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IMAGE_QUALITY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>添加水印</Label>
                        <p className="text-xs text-muted-foreground">
                          在图片中添加水印标识
                        </p>
                      </div>
                      <Switch
                        checked={imageConfig.watermark}
                        onCheckedChange={(v) => setImageConfig({ ...imageConfig, watermark: v })}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
