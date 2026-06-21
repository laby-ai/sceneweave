'use client';

import { useState, useEffect, useRef } from 'react';
import { formatProviderError, getBYOKRequestHeaders } from '@/lib/byok-client';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Loader2, Image as ImageIcon, Wand2, Palette, Heart, Sparkles, Layers, Save, Clock, Check } from 'lucide-react';
import { STYLE_OPTIONS, MOOD_OPTIONS, generateEnhancedPrompt } from '@/constants/styles';
import {
  FILTER_OPTIONS,
  generateFilterPrompt,
  IMAGE_RESOLUTION_OPTIONS,
  IMAGE_SIZE_OPTIONS,
  IMAGE_QUALITY_OPTIONS
} from '@/constants/filters';
import { COLOR_THEME_OPTIONS, generateColorThemePrompt } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useTemplates } from '@/contexts/TemplateContext';
import { StyleReferenceModal } from '@/components/style-reference-modal';
import { MaterialUpload, Material } from '@/components/material-upload';
import { useTasks } from '@/contexts/TaskContext';
import { PRESET_IMAGE_TEMPLATES, type GenerationTemplate } from '@/constants/templates';

interface ImageConfig {
  id: string;
  imageUrls: string[];
  prompt: string;
  createdAt: number;
  size?: string;
  style?: string;
  mood?: string;
  filter?: string;
  colorTheme?: string;
  resolution?: string;
  quality?: string;
  // 额外配置字段
  watermark?: boolean;
  materials?: Array<string | Partial<Material>>;
  // 图片文字相关
  imageText?: string;
  enableImageText?: boolean;
}

interface ImageGenerationFormProps {
  onGenerate: (images: ImageConfig) => void;
  isGenerating: boolean;
  onGeneratingChange?: (isGenerating: boolean) => void;
  onPromptEnhanced?: (originalPrompt: string, enhancedPrompt: string) => void;
  initialPrompt?: string;
  initialConfig?: Partial<ImageConfig>;
}

export function ImageGenerationForm({ 
  onGenerate, 
  isGenerating: isGeneratingProp,
  onGeneratingChange,
  onPromptEnhanced,
  initialPrompt = '',
  initialConfig
}: ImageGenerationFormProps) {
  const { themeGradient } = useTheme();
  const { addTemplate } = useTemplates();
  const { addTask, updateTask } = useTasks();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [runInBackground, setRunInBackground] = useState(true);
  const [resolution, setResolution] = useState<string>('1024x1024');
  const [size, setSize] = useState<string>('square');
  const [quality, setQuality] = useState<string>('standard');
  const [style, setStyle] = useState<string>('none');
  const [mood, setMood] = useState<string>('none');
  const [filter, setFilter] = useState<string>('none');
  const [colorTheme, setColorTheme] = useState<string>('none');
  const [watermark, setWatermark] = useState<boolean>(true);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [enableImageText, setEnableImageText] = useState<boolean>(false);
  const [imageText, setImageText] = useState<string>('');
  const [keepReferenceAsIs, setKeepReferenceAsIs] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState('');
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  
  // 模板选择器相关状态
  const [selectedTemplate, setSelectedTemplate] = useState<GenerationTemplate | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(true);

  // 用于清理副作用的refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // 组件卸载时清理副作用
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // 取消正在进行的fetch请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // 清理进度模拟interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  // 加载初始配置
  useEffect(() => {
    if (initialConfig) {
      if (initialConfig.prompt) setPrompt(initialConfig.prompt);
      if (initialConfig.size) setSize(initialConfig.size);
      if (initialConfig.style) setStyle(initialConfig.style);
      if (initialConfig.mood) setMood(initialConfig.mood);
      if (initialConfig.filter) setFilter(initialConfig.filter);
      if (initialConfig.resolution) setResolution(initialConfig.resolution);
      if (initialConfig.quality) setQuality(initialConfig.quality);
      if (initialConfig.colorTheme) setColorTheme(initialConfig.colorTheme);
      if (typeof initialConfig.watermark === 'boolean') setWatermark(initialConfig.watermark);
      if (typeof initialConfig.enableImageText === 'boolean') setEnableImageText(initialConfig.enableImageText);
      if (initialConfig.imageText) setImageText(initialConfig.imageText);
      if (Array.isArray(initialConfig.materials)) {
        // 处理 materials 可能是字符串数组或对象数组的情况
        const processedMaterials: Material[] = initialConfig.materials.map((m, index): Material | null => {
          if (typeof m === 'string') {
            // 如果是字符串URL，转换为 Material 对象
            return {
              id: `material-${index}-${Date.now()}`,
              type: 'image' as const,
              url: m,
              name: `图片素材${index + 1}`,
            };
          }
          // 如果已经是对象，确保有 id
          if (m && typeof m === 'object' && typeof m.url === 'string') {
            return {
              id: m.id || `material-${index}-${Date.now()}`,
              type: m.type || 'image',
              url: m.url,
              name: m.name || `素材${index + 1}`,
            };
          }
          return null;
        }).filter((m): m is Material => m !== null);
        setMaterials(processedMaterials);
      }
    }
  }, [initialConfig]);

  // 加载 initialPrompt（当没有 initialConfig 或只需要更新提示词时）
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // 同步生成状态到父组件
  useEffect(() => {
    onGeneratingChange?.(isGenerating);
  }, [isGenerating, onGeneratingChange]);

  const handleEnhancePrompt = async () => {
    if (!prompt.trim() || prompt.length < 2) {
      alert('请先输入至少2个字符的描述');
      return;
    }

    setIsEnhancing(true);
    
    // 创建新的AbortController
    const enhanceAbortController = new AbortController();
    
    // 添加超时控制（15秒）
    const timeoutId = setTimeout(() => {
      enhanceAbortController.abort();
    }, 15000);
    
    try {
      const response = await fetch('/api/prompt/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: enhanceAbortController.signal,
        body: JSON.stringify({ 
          prompt,
          sceneType: 'portrait', // 可根据实际场景类型传入
        }),
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '增强失败');
      }

      let finalEnhancedPrompt = data.enhancedPrompt;
      
      // 如果选择了风格或氛围，应用模板
      if (style !== 'none' || mood !== 'none') {
        finalEnhancedPrompt = generateEnhancedPrompt(finalEnhancedPrompt, style, mood);
      }

      // 如果选择了滤镜，应用滤镜描述
      if (filter !== 'none') {
        finalEnhancedPrompt = generateFilterPrompt(finalEnhancedPrompt, filter);
      }

      setEnhancedPrompt(finalEnhancedPrompt);
      setShowEnhanced(true);
      
      if (onPromptEnhanced) {
        onPromptEnhanced(prompt, finalEnhancedPrompt);
      }
    } catch (error) {
      // 检查是否是用户主动取消或超时
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        console.log('提示词增强请求已取消或超时');
        // 提供一个简化的增强方案
        const simpleEnhanced = generateSimpleEnhancedPrompt(prompt);
        setEnhancedPrompt(simpleEnhanced);
        setShowEnhanced(true);
        if (onPromptEnhanced) {
          onPromptEnhanced(prompt, simpleEnhanced);
        }
        return;
      }
      alert(error instanceof Error ? error.message : '增强失败，请重试');
    } finally {
      clearTimeout(timeoutId);
      setIsEnhancing(false);
    }
  };

  // 简化的本地增强方案（备用）
  const generateSimpleEnhancedPrompt = (originalPrompt: string): string => {
    const suffixes = [
      '画面优美，构图精致，光影效果出色',
      '高清晰度，色彩鲜艳，细节丰富',
      '专业摄影级别，视觉效果震撼',
      '大师级作品，艺术感强烈',
    ];
    const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${originalPrompt}。${randomSuffix}。`;
  };

  const useEnhancedPrompt = () => {
    setPrompt(enhancedPrompt);
    setShowEnhanced(false);
    setEnhancedPrompt('');
  };

  const handleStyleGenerated = (stylePrompt: string) => {
    if (prompt.trim()) {
      setPrompt(`${prompt}。${stylePrompt}`);
    } else {
      setPrompt(stylePrompt);
    }
  };

  // 计算预计生成时间（秒）
  const calculateEstimatedTime = (): number => {
    let baseTime = 30; // 基础时间 30 秒
    
    // 分辨率影响时间
    if (resolution === '4k') {
      baseTime += 45;
    } else if (resolution === '2k') {
      baseTime += 20;
    } else if (resolution === '1080p') {
      baseTime += 10;
    }
    
    // 质量影响时间
    if (quality === 'premium') {
      baseTime += 30;
    } else if (quality === 'standard') {
      baseTime += 15;
    }
    
    // 水印增加时间
    if (watermark) {
      baseTime += 10;
    }
    
    // 提示词增强增加时间
    if (showEnhanced) {
      baseTime += 5;
    }
    
    return Math.ceil(baseTime);
  };

  // 格式化预计时间
  const formatEstimatedTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes}分钟`;
    }
    return `${minutes}分${remainingSeconds}秒`;
  };

  const handleImitateStyle = (stylePrompt: string) => {
    // 仿写功能：直接替换描述内容
    setPrompt(stylePrompt);
  };

  // 应用图片模板
  const applyImageTemplate = (template: GenerationTemplate) => {
    // 设置模板提示词
    setPrompt(template.promptTemplate.replace('{additional_details}', ''));
    
    // 设置风格参数
    if (template.style && template.style !== 'none') {
      setStyle(template.style);
    }
    if (template.mood && template.mood !== 'none') {
      setMood(template.mood);
    }
    if (template.filter && template.filter !== 'none') {
      setFilter(template.filter);
    }
    if (template.colorTheme && template.colorTheme !== 'none') {
      setColorTheme(template.colorTheme);
    }
    
    // 设置分辨率和质量
    if (template.resolution) {
      setResolution(template.resolution);
    }
    if (template.quality) {
      setQuality(template.quality);
    }
    
    setSelectedTemplate(template);
    setShowTemplateSelector(false);
  };

  const getFinalPrompt = () => {
    let finalPrompt = prompt;
    
    // 如果启用了图片文字，把文字要求放在最前面，强制显示
    if (enableImageText && imageText.trim()) {
      finalPrompt = `【重要】画面中必须显示文字："${imageText.trim()}"。【重要】画面中必须显示文字："${imageText.trim()}"。【重要】画面中必须显示文字："${imageText.trim()}"。文字在画面正中央，纯白色粗体超大字，纯黑色背景，非常清晰，${finalPrompt}`;
    }
    
    if (style !== 'none' || mood !== 'none') {
      finalPrompt = generateEnhancedPrompt(finalPrompt, style, mood);
    }
    
    if (filter !== 'none') {
      finalPrompt = generateFilterPrompt(finalPrompt, filter);
    }
    
    if (colorTheme !== 'none') {
      finalPrompt = generateColorThemePrompt(finalPrompt, colorTheme);
    }
    
    return finalPrompt;
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      alert('请输入模板名称');
      return;
    }

    const finalPrompt = getFinalPrompt();
    
    addTemplate({
      name: templateName,
      description: templateDescription,
      type: 'image',
      config: {
        prompt: finalPrompt,
        resolution,
        size,
        quality,
        style,
        mood,
        filter,
        colorTheme,
        watermark,
      },
    });

    setShowSaveTemplateDialog(false);
    setTemplateName('');
    setTemplateDescription('');
    alert('模板保存成功！');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) {
      alert('请输入图片描述');
      return;
    }

    // 设置生成状态
    setIsGenerating(true);
    
    // 重置进度
    setGenerationProgress(0);
    setGenerationStage('准备生成...');

    const finalPrompt = getFinalPrompt();

    // 创建AbortController
    abortControllerRef.current = new AbortController();

    // 如果开启了后台生成，使用后台API
    if (runInBackground) {
      try {
        // 调用后台生成API
        const response = await fetch('/api/image/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: finalPrompt,
            size: resolution,
            watermark,
            style,
            mood,
            filter,
            colorTheme,
            resolution,
            quality,
            materials: materials.map(m => m.url),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '提交任务失败');
        }

        const { taskId } = await response.json();
        
        setGenerationProgress(5);
        setGenerationStage('任务已提交');
        
        // 提示用户任务已提交
        alert('图片生成任务已提交！请前往任务中心查看进度');
        
        // 重置表单
        setPrompt('');
        setShowEnhanced(false);
        setEnhancedPrompt('');
        setIsGenerating(false);
        setGenerationProgress(0);
        setGenerationStage('');
        
        return;
      } catch (error) {
        console.error('后台生成任务提交失败:', error);
        setIsGenerating(false);
        setGenerationProgress(0);
        setGenerationStage('');
        alert(error instanceof Error ? error.message : '提交任务失败，请重试');
        return;
      }
    }

    // 如果不是后台生成，使用原来的直接生成方式
    // 如果开启了后台生成，添加任务到任务中心
    let taskId: string | undefined;
    if (runInBackground) {
      taskId = addTask({
        type: 'image',
        status: 'running',
        config: {
          prompt: finalPrompt,
          resolution,
          size,
          quality,
          style,
          mood,
          filter,
          colorTheme,
          watermark,
          materials: materials.map(m => m.url),
        },
        progress: 0,
        stage: '准备生成...',
        abortController: abortControllerRef.current,
      });
    }

    // 模拟进度更新
    progressIntervalRef.current = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 90) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          return prev;
        }
        const increment = Math.random() * 15;
        const newProgress = Math.min(prev + increment, 90);
        
        // 更新任务中心进度
        if (taskId) {
          updateTask(taskId, {
            progress: Math.round(newProgress),
          });
        }
        
        return newProgress;
      });
    }, 500);

    try {
      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getBYOKRequestHeaders(),
        },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          prompt: finalPrompt,
          size: resolution,
          watermark,
          style,
          mood,
          filter,
          colorTheme,
          materials: materials.map(m => m.url),
        }),
      });

      // 清理进度interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      // 检查组件是否已卸载
      if (!isMountedRef.current) return;

      const data = await response.json();

      if (!response.ok) {
        throw new Error(formatProviderError(data, '生成失败'));
      }

      setGenerationProgress(100);
      setGenerationStage('完成！');

      // 更新任务中心为完成状态
      if (taskId) {
        updateTask(taskId, {
          status: 'completed',
          progress: 100,
          stage: '已完成',
          result: {
            imageUrls: data.imageUrls,
          },
          completedAt: Date.now(),
        });
      }

      onGenerate({
        id: Date.now().toString(),
        imageUrls: data.imageUrls,
        prompt: finalPrompt,
        createdAt: Date.now(),
        resolution,
        size,
        quality,
        style,
        mood,
        filter,
        colorTheme,
        materials: materials,
        enableImageText: enableImageText,
        imageText: imageText,
      });

      setPrompt('');
      setShowEnhanced(false);
      setEnhancedPrompt('');
      setIsGenerating(false);
      
      // 重置进度
      setTimeout(() => {
        if (isMountedRef.current) {
          setGenerationProgress(0);
          setGenerationStage('');
        }
      }, 1500);
    } catch (error) {
      // 清理进度interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      // 检查是否是用户主动取消
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('图片生成已取消');
        // 更新任务中心为取消状态
        if (taskId) {
          updateTask(taskId, {
            status: 'cancelled',
            stage: '已取消',
            completedAt: Date.now(),
          });
        }
        if (isMountedRef.current) {
          setIsGenerating(false);
          setGenerationProgress(0);
          setGenerationStage('');
        }
        return;
      }
      
      // 更新任务中心为失败状态
      if (taskId) {
        updateTask(taskId, {
          status: 'failed',
          stage: '生成失败',
          error: error instanceof Error ? error.message : '生成失败',
          completedAt: Date.now(),
        });
      }
      
      if (isMountedRef.current) {
        setIsGenerating(false);
        setGenerationProgress(0);
        setGenerationStage('');
        alert(error instanceof Error ? error.message : '生成失败，请重试');
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <ImageIcon className="w-6 h-6" style={{ color: `var(--primary)` }} />
            图片配置
          </CardTitle>
          <CardDescription>
            配置图片生成参数，选择风格、氛围和滤镜
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 推荐模板 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">模板选择</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                  className="flex items-center gap-1"
                >
                  <Layers className="w-4 h-4" />
                  {showTemplateSelector ? '收起模板' : '查看模板'}
                </Button>
              </div>
              
              {showTemplateSelector && (
                <div className="space-y-4">
                  <Tabs defaultValue="preset" className="w-full">
                    <TabsList className="w-full max-w-xs">
                      <TabsTrigger value="preset" className="flex-1">推荐模板</TabsTrigger>
                      <TabsTrigger value="custom" className="flex-1">我的模板</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="preset" className="mt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {PRESET_IMAGE_TEMPLATES.map((template) => (
                          <div
                            key={template.id}
                            onClick={() => applyImageTemplate(template)}
                            className={`rounded-xl border-2 cursor-pointer transition-all overflow-hidden ${
                              selectedTemplate?.id === template.id
                                ? 'border-[#EF4444] bg-[#EF4444]/10'
                                : 'border-border bg-accent/30 hover:border-white/20 hover:bg-accent'
                            }`}
                          >
                            {/* 模板预览图片 */}
                            {template.previewImage && (
                              <div className={`aspect-square bg-black overflow-hidden`}>
                                <img
                                  src={template.previewImage}
                                  alt={template.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            
                            <div className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">🎨</span>
                                  <h4 className="font-semibold text-foreground">{template.name}</h4>
                                </div>
                                {selectedTemplate?.id === template.id && (
                                  <Check className="w-5 h-5 text-[#EF4444]" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                              <div className="flex flex-wrap gap-1">
                                {template.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-xs px-2 py-0.5 bg-accent/50 rounded-full text-foreground/70"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="custom" className="mt-4">
                      <div className="text-center py-8 text-muted-foreground">
                        <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">还没有保存的模板</p>
                        <p className="text-sm">配置好参数后，点击「保存为模板」来创建您的自定义模板</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
              
              {selectedTemplate && (
                <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-[#EF4444]" />
                    <span className="text-[#EF4444]">已应用模板：{selectedTemplate.name}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="ml-auto h-7 text-xs"
                      onClick={() => setSelectedTemplate(null)}
                    >
                      清除
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt" className="text-base font-medium">
                  图片描述 <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <StyleReferenceModal
                    onStyleGenerated={handleStyleGenerated}
                    onImitateStyle={handleImitateStyle}
                    disabled={isGenerating}
                    type="image"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleEnhancePrompt}
                    disabled={isGenerating || isEnhancing || !prompt.trim() || prompt.length < 2}
                    className="flex items-center gap-2"
                  >
                    {isEnhancing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        增强中...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        智能增强
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <Textarea
                id="prompt"
                placeholder="描述你想要生成的图片内容，例如：一个美丽的山水画，山峰在云雾中若隐若现，瀑布从山间倾泻而下..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[80px] text-sm bg-secondary text-foreground placeholder:text-foreground/70 border-border"
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground">
                提示：选择风格、氛围和滤镜后，会自动添加到描述中。也可以使用「风格参考」功能上传参考图片。
              </p>

              {/* 图片文字编辑 */}
              <div className="mt-4 p-4 bg-accent/30 border border-border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="image-text-toggle" className="text-base font-medium flex items-center gap-2 cursor-pointer">
                      <span className="text-red-800">📝</span>
                      <span className="text-red-800 font-semibold">图片文字编辑</span>
                    </Label>
                  </div>
                  <Switch
                    id="image-text-toggle"
                    checked={enableImageText}
                    onCheckedChange={setEnableImageText}
                    disabled={isGenerating}
                  />
                </div>
                
                {enableImageText && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="image-text" className="text-sm font-semibold text-red-800">
                        想要在图片中显示的文字 <span className="text-red-600 font-bold">*</span>
                      </Label>
                      <Textarea
                        id="image-text"
                        placeholder="请输入想要在图片中显示的文字，例如：欢迎光临、新年快乐等。文字将会原模原样出现在图片中。"
                        value={imageText}
                        onChange={(e) => setImageText(e.target.value)}
                        className="min-h-[80px] text-sm bg-secondary text-foreground border-[#EF4444]/50 shadow-sm placeholder:text-foreground/70"
                        disabled={isGenerating}
                      />
                      <div className="p-3 bg-secondary rounded-lg border border-border shadow-sm">
                        <p className="text-sm font-semibold text-red-900 mb-2">
                          📢 <strong>重要提示：</strong>
                        </p>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          启用图片文字后，提示词会自动包含：<br/>
                          <code className="bg-red-100 text-red-800 px-2 py-1 rounded font-mono text-xs">
                            &quot;【重要】画面中必须显示文字&quot;（重复3次）
                          </code>
                        </p>
                        <p className="text-sm text-green-700 mt-2 font-medium">
                          ✅ <strong>强制显示策略：</strong>在提示词最前面重复3次强调必须显示文字！
                        </p>
                        <p className="text-sm text-red-700 mt-2 font-medium">
                          🎯 <strong>显示方式：</strong>画面正中央、纯白色粗体超大字、纯黑色背景！
                        </p>
                        <p className="text-sm text-red-700 mt-2 font-medium">
                          ⚠️ 请确保文字内容准确无误，AI会按要求强制显示清晰的文字！
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Enhanced Prompt Display */}
              {showEnhanced && enhancedPrompt && (
                <div className="mt-4 p-4 bg-rose-50 border border-pink-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-rose-700 font-medium flex items-center gap-2">
                      <Wand2 className="w-4 h-4" />
                      ✨ 增强后的描述
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setShowEnhanced(false);
                          setEnhancedPrompt('');
                        }}
                      >
                        取消
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={useEnhancedPrompt}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        使用此描述
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-rose-900 bg-card p-3 rounded border border-rose-100">
                    {enhancedPrompt}
                  </p>
                </div>
              )}
            </div>

            {/* Material Upload */}
            <MaterialUpload
              materials={materials}
              onMaterialsChange={setMaterials}
              acceptTypes={['image']}
              maxCount={5}
              disabled={isGenerating}
            />

            {/* 保持参考图原样选项 */}
            {materials.length > 0 && (
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 border border-border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="keep-reference-as-is" className="text-base flex items-center gap-2">
                    <span className="text-red-700">📸</span>
                    <span className="text-red-700 font-semibold">保持产品图原样</span>
                  </Label>
                  <p className="text-xs text-red-600/70">
                    上传的参考图将直接使用，不进行任何修改或重新生成
                  </p>
                </div>
                <Switch
                  id="keep-reference-as-is"
                  checked={keepReferenceAsIs}
                  onCheckedChange={setKeepReferenceAsIs}
                  disabled={isGenerating}
                />
              </div>
            )}

            {/* Style, Mood, Filter, and Color Theme Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Style */}
              <div className="space-y-2">
                <Label htmlFor="style" className="text-base font-medium flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  艺术风格
                </Label>
                <Select value={style} onValueChange={setStyle} disabled={isGenerating}>
                  <SelectTrigger id="style" className="bg-card text-foreground border-border placeholder:text-foreground/70">
                    <SelectValue placeholder="选择风格" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" key="image-style-none">不选择</SelectItem>
                    {STYLE_OPTIONS.map((option) => (
                      <SelectItem key={`image-style-${option.value}`} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Mood */}
              <div className="space-y-2">
                <Label htmlFor="mood" className="text-base font-medium flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  氛围感觉
                </Label>
                <Select value={mood} onValueChange={setMood} disabled={isGenerating}>
                  <SelectTrigger id="mood" className="bg-card text-foreground border-border placeholder:text-foreground/70">
                    <SelectValue placeholder="选择氛围" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" key="image-mood-none">不选择</SelectItem>
                    {MOOD_OPTIONS.map((option) => (
                      <SelectItem key={`image-mood-${option.value}`} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filter */}
              <div className="space-y-2">
                <Label htmlFor="filter" className="text-base font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  滤镜效果
                </Label>
                <Select value={filter} onValueChange={setFilter} disabled={isGenerating}>
                  <SelectTrigger id="filter" className="bg-card text-foreground border-border placeholder:text-foreground/70">
                    <SelectValue placeholder="选择滤镜" />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPTIONS.map((option) => (
                      <SelectItem key={`image-filter-${option.value}`} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Color Theme */}
              <div className="space-y-2">
                <Label htmlFor="colorTheme" className="text-base font-medium flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  颜色主色调
                </Label>
                <Select value={colorTheme} onValueChange={setColorTheme} disabled={isGenerating}>
                  <SelectTrigger id="colorTheme">
                    <SelectValue placeholder="选择主色调" />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_THEME_OPTIONS.map((option) => (
                      <SelectItem key={`image-color-${option.id}`} value={option.id}>
                        <div className="flex items-center gap-2">
                          <span>{option.icon}</span>
                          <div className="flex flex-col">
                            <span>{option.name}</span>
                            {option.swatches.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {option.swatches.map((color, i) => (
                                  <div
                                    key={i}
                                    className="w-3 h-3 rounded-full border border-border"
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Resolution, Size, and Quality */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Resolution */}
              <div className="space-y-2">
                <Label htmlFor="image-resolution" className="text-base font-medium">
                  分辨率
                </Label>
                <Select value={resolution} onValueChange={setResolution} disabled={isGenerating}>
                  <SelectTrigger id="image-resolution" className="bg-card text-foreground border-border placeholder:text-foreground/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_RESOLUTION_OPTIONS.map((option) => (
                      <SelectItem key={`image-resolution-${option.value}`} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Size */}
              <div className="space-y-2">
                <Label htmlFor="image-size" className="text-base font-medium">
                  尺寸比例
                </Label>
                <Select value={size} onValueChange={setSize} disabled={isGenerating}>
                  <SelectTrigger id="image-size" className="bg-card text-foreground border-border placeholder:text-foreground/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={`image-size-${option.value}`} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quality */}
              <div className="space-y-2">
                <Label htmlFor="image-quality" className="text-base font-medium">
                  画质质量
                </Label>
                <Select value={quality} onValueChange={setQuality} disabled={isGenerating}>
                  <SelectTrigger id="image-quality" className="bg-card text-foreground border-border placeholder:text-foreground/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_QUALITY_OPTIONS.map((option) => (
                      <SelectItem key={`image-quality-${option.value}`} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Toggle Options */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="watermark" className="text-base">
                    添加水印
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    在图片中添加水印标识
                  </p>
                </div>
                <Switch
                  id="watermark"
                  checked={watermark}
                  onCheckedChange={setWatermark}
                  disabled={isGenerating}
                />
              </div>
            </div>

            {/* Progress Display */}
            {isGenerating && !runInBackground && (
              <div className="space-y-3 p-4 bg-red-50 border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
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
                <div className="w-full bg-red-200 rounded-full h-3">
                  <div 
                    className="bg-red-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Background Generation Status */}
            {isGenerating && runInBackground && (
              <div className="p-4 bg-accent/30 border border-border rounded-lg">
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
              
              {/* 预计生成时间提示 */}
              {!isGenerating && prompt.trim() && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  <Clock className="h-4 w-4" />
                  <span>预计生成时间: {formatEstimatedTime(calculateEstimatedTime())}</span>
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
                      <ImageIcon className="mr-2 h-5 w-5" />
                      生成图片
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Save Template Dialog */}
      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>保存为模板</DialogTitle>
            <DialogDescription>
              将当前配置保存为模板，方便以后快速使用
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">模板名称 <span className="text-red-500">*</span></Label>
              <Input
                id="template-name"
                placeholder="请输入模板名称"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="bg-secondary text-foreground placeholder:text-foreground/70 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">模板描述</Label>
              <Textarea
                id="template-description"
                placeholder="请输入模板描述（可选）"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                rows={3}
                className="bg-secondary text-foreground placeholder:text-foreground/70 border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowSaveTemplateDialog(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleSaveTemplate}
              disabled={!templateName.trim()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
