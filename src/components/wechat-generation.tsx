'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Loader2, Globe, Image as ImageIcon, FileText, Sparkles, Copy, Check, Upload, X, Plus, Trash2, ListTodo } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTasks } from '@/contexts/TaskContext';
import { formatProviderError, getBYOKRequestHeaders } from '@/lib/byok-client';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  description?: string;
  usage: 'cover' | 'illustration'; // 新增：图片用途 - 封面或插图
}

interface WechatGeneratedData {
  article: { copywriting: string };
  images: UploadedImage[];
  cover?: { imageUrls: string[] };
}

interface WechatGenerationProps {
  onGenerated?: (data: WechatGeneratedData) => void;
}

export function WechatGeneration({ onGenerated }: WechatGenerationProps) {
  const router = useRouter();
  const { addTask } = useTasks();
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState<'input' | 'generating' | 'result'>('input');
  const [generatedCover, setGeneratedCover] = useState<string | null>(null);
  const [generatedArticle, setGeneratedArticle] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [runInBackground, setRunInBackground] = useState(true);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理图片上传
  const handleImageUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: UploadedImage[] = Array.from(files).map((file, index) => {
      // 检查当前已有的图片数量，第一张默认为封面
      const currentCount = uploadedImages.length;
      const isFirst = currentCount === 0 && index === 0;
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: URL.createObjectURL(file),
        usage: isFirst ? 'cover' : 'illustration', // 第一张默认为封面，其他为插图
      };
    });

    setUploadedImages(prev => [...prev, ...newImages]);
  }, [uploadedImages.length]);

  // 切换图片用途
  const toggleImageUsage = useCallback((id: string) => {
    setUploadedImages(prev => prev.map(img => {
      if (img.id === id) {
        // 如果当前是封面，切换为插图；如果是插图且没有其他封面，切换为封面
        if (img.usage === 'cover') {
          return { ...img, usage: 'illustration' };
        } else {
          // 先移除其他图片的封面状态
          const hasOtherCover = prev.some(i => i.id !== id && i.usage === 'cover');
          if (!hasOtherCover) {
            return { ...img, usage: 'cover' };
          }
          return img;
        }
      }
      // 如果当前图片被设为封面，移除其他图片的封面状态
      if (img.usage === 'cover' && prev.some(i => i.id === id && i.usage !== 'cover')) {
        return { ...img, usage: 'illustration' };
      }
      return img;
    }));
  }, []);

  // 移除上传的图片
  const handleRemoveImage = useCallback((id: string) => {
    setUploadedImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image?.preview) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter(img => img.id !== id);
    });
  }, []);

  // 触发文件选择
  const handleSelectImages = () => {
    fileInputRef.current?.click();
  };

  // 生成公众号内容（增强版）
  const handleGenerate = async () => {
    if (!topic.trim() && uploadedImages.length === 0) {
      alert('请输入主题或上传图片');
      return;
    }

    // 如果开启了后台生成，使用后台API
    if (runInBackground) {
      try {
        const response = await fetch('/api/social/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic,
            title,
            platform: 'wechat',
            async: true,
          }),
        });

        if (!response.ok) {
          throw new Error('提交任务失败');
        }

        const { taskId } = await response.json();
        
        // 将任务添加到任务中心（本地状态管理）
        addTask({
          id: taskId,
          type: 'copywriting',
          status: 'running',
          config: {
            prompt: topic,
            title,
            platform: 'wechat',
          },
          progress: 5,
          stage: '初始化...',
        });
        
        console.log('[Wechat Generation] Task added to task center:', taskId);
        
        alert('公众号推送生成任务已提交！请前往任务中心查看进度');
        
        // 跳转到任务中心
        router.push('/?section=tasks');
        return;
      } catch (error) {
        console.error('后台生成任务提交失败:', error);
        alert('提交任务失败，请重试');
        return;
      }
    }

    // 否则使用原来的直接生成方式
    setIsGenerating(true);
    setStep('generating');
    setGenerationProgress(0);
    setGenerationStage('正在初始化...');
    
    try {
      const imageDescriptions: string[] = [];
      
      // 步骤1：如果有上传图片，先理解图片内容
      if (uploadedImages.length > 0) {
        setGenerationStage(`正在理解${uploadedImages.length}张图片...`);
        setGenerationProgress(10);
        
        for (let i = 0; i < uploadedImages.length; i++) {
          const image = uploadedImages[i];
          try {
            console.log(`正在处理图片 ${i + 1}:`, image.file.name, image.usage);
            // 这里需要调用图片理解API
            const imageFormData = new FormData();
            imageFormData.append('image', image.file);
            
            console.log('调用图片理解API...');
            const understandResponse = await fetch('/api/image/understand', {
              method: 'POST',
              body: imageFormData,
            });

            console.log('图片理解API响应状态:', understandResponse.status);
            
            if (understandResponse.ok) {
              const understandData = await understandResponse.json();
              console.log('图片理解成功:', understandData.description?.substring(0, 100) + '...');
              imageDescriptions.push(understandData.description || '一张图片');
            } else {
              // 如果API返回失败，使用默认描述
              console.error('图片理解API返回失败:', understandResponse.status);
              const errorText = await understandResponse.text();
              console.error('错误响应:', errorText);
              imageDescriptions.push('一张图片');
            }
            
            // 更新进度
            const progress = 10 + Math.floor(((i + 1) / uploadedImages.length) * 15);
            setGenerationProgress(progress);
            setGenerationStage(`正在理解图片 ${i + 1}/${uploadedImages.length}...`);
          } catch (error) {
            console.error('图片理解失败:', error);
            imageDescriptions.push('一张图片');
          }
        }
        
        console.log('所有图片描述:', imageDescriptions);
      }

      // 步骤2：处理封面图（根据用户选择的用途）
      let coverUrl: string | null = null;
      const coverImage = uploadedImages.find(img => img.usage === 'cover');
      
      if (coverImage) {
        // 如果用户选择了封面图片，使用用户选择的
        setGenerationStage('使用选择的图片作为封面...');
        setGenerationProgress(25);
        coverUrl = coverImage.preview;
        setGeneratedCover(coverUrl);
        setGenerationStage('封面图已选择，正在生成文章...');
        setGenerationProgress(50);
      } else if (uploadedImages.length > 0) {
        // 如果用户上传了图片但没有选择封面，使用第一张
        setGenerationStage('使用上传的图片作为封面...');
        setGenerationProgress(25);
        coverUrl = uploadedImages[0].preview;
        setGeneratedCover(coverUrl);
        setGenerationStage('封面图已选择，正在生成文章...');
        setGenerationProgress(50);
      } else {
        // 如果用户没有上传图片，才生成新的封面图
        setGenerationStage('正在生成封面图（预计 1 张）...');
        setGenerationProgress(15);
        
        const coverPrompt = `公众号封面图，${topic}，高清，专业，适合16:9比例展示`;

        const coverResponse = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
          body: JSON.stringify({
            prompt: coverPrompt,
            size: '2K',
            n: 1,
          }),
        });

        const coverData = await coverResponse.json();
        if (!coverResponse.ok) {
          throw new Error(formatProviderError(coverData, '封面图生成失败'));
        }

        coverUrl = coverData.imageUrls?.[0] || null;
        setGeneratedCover(coverUrl);
        setGenerationStage('封面图生成完成，正在生成文章...');
        setGenerationProgress(50);
      }

      // 步骤3：生成文章（公众号风格，智能整合图片）
      const articleIllustrations = uploadedImages.filter(img => img.usage === 'illustration');
      console.log('文章插图列表:', articleIllustrations.map(img => ({ id: img.id, usage: img.usage })));
      
      // 只获取插图的描述
      const illustrationDescriptions = articleIllustrations.map((img) => {
        const originalIndex = uploadedImages.findIndex(uImg => uImg.id === img.id);
        return imageDescriptions[originalIndex] || '一张图片';
      });
      console.log('插图描述列表:', illustrationDescriptions);
      
      const articlePrompt = articleIllustrations.length > 0
        ? `请为以下主题撰写一篇专业的公众号文章：${topic}。\n\n用户提供了${articleIllustrations.length}张图片作为文章插图，图片内容描述：${illustrationDescriptions.join('；')}。\n\n请：\n1. 整理文字，梳理逻辑结构\n2. 识别图片内容，理解图片含义\n3. 将图片插入到最合适的位置\n4. 为每张图片撰写图题说明\n\n请在文章中用[图片X]标记图片位置，X为图片序号。`
        : `请为以下主题撰写一篇专业的公众号文章：${topic}。请整理文字，梳理逻辑结构，使其适合公众号阅读。`;
      
      console.log('文章生成提示词:', articlePrompt.substring(0, 200) + '...');

      const articleResponse = await fetch('/api/copywriting/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: articlePrompt,
          style: 'professional',
          platform: 'wechat',
        }),
      });

      if (!articleResponse.ok) {
        throw new Error('文章生成失败');
      }

      // 处理流式响应
      const reader = articleResponse.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let fullContent = '';
      let finalVariations: string[] = [];
      let contentLength = 0;
      
      setGenerationStage('正在生成文章...');
      setGenerationProgress(60);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'content') {
              fullContent += data.content;
              contentLength += data.content.length;
              
              // 根据内容长度更新进度
              const newProgress = Math.min(60 + Math.floor(contentLength / 100), 95);
              if (newProgress > generationProgress) {
                setGenerationProgress(newProgress);
                if (newProgress < 80) {
                  setGenerationStage('AI正在创作中...');
                } else if (newProgress < 95) {
                  setGenerationStage('正在优化文章...');
                }
              }
            } else if (data.type === 'done') {
              finalVariations = data.variations || [];
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          }
        }
      }

      // 取第一个版本的文案
      let article = finalVariations?.[0] || fullContent || '';

      // 步骤4：在文章中插入图片（只使用插图）
      const finalIllustrations = uploadedImages.filter(img => img.usage === 'illustration');
      console.log('最终插图数量:', finalIllustrations.length);
      console.log('文章原始内容（前100字符）:', article.substring(0, 100));
      
      if (finalIllustrations.length > 0) {
        // 先尝试替换AI生成的[图片X]标记
        let hasPlaceholders = false;
        finalIllustrations.forEach((image, index) => {
          const placeholder = `[图片${index + 1}]`;
          console.log(`检查占位符 ${placeholder}:`, article.includes(placeholder));
          if (article.includes(placeholder)) {
            hasPlaceholders = true;
            // 找到这张插图在原始uploadedImages中的索引，以便获取对应的imageDescription
            const originalIndex = uploadedImages.findIndex(img => img.id === image.id);
            const desc = imageDescriptions[originalIndex] || `图片${index + 1}`;
            const imageMarkdown = `\n\n![${desc}](${image.preview})\n*${desc || `图${index + 1}：${topic}`}*\n\n`;
            console.log(`替换占位符 ${placeholder} 为图片:`, image.preview);
            article = article.replace(new RegExp(placeholder, 'g'), imageMarkdown);
          }
        });
        
        // 如果AI没有生成图片标记，手动将插图添加到文章末尾
        if (!hasPlaceholders) {
          console.log('AI没有生成占位符，手动添加插图到文章末尾');
          article += '\n\n---\n\n## 插图\n\n';
          finalIllustrations.forEach((image, index) => {
            const originalIndex = uploadedImages.findIndex(img => img.id === image.id);
            const desc = imageDescriptions[originalIndex] || `图片${index + 1}`;
            article += `![${desc}](${image.preview})\n*${desc || `图${index + 1}：${topic}`}*\n\n`;
          });
        }
      }
      
      console.log('最终文章内容（前200字符）:', article.substring(0, 200));

      setGenerationStage('生成完成！');
      setGenerationProgress(100);
      setGeneratedArticle(article);
      setStep('result');
      
      // 构建返回数据
      const resultData: WechatGeneratedData = {
        article: { copywriting: article }, 
        images: uploadedImages 
      };
      
      // 如果有封面图，添加到结果中
      if (coverUrl) {
        resultData.cover = { imageUrls: [coverUrl] };
      }
      
      onGenerated?.(resultData);

    } catch (error) {
      console.error('生成失败:', error);
      alert('生成失败，请重试');
      setStep('input');
    } finally {
      setIsGenerating(false);
    }
  };

  // 复制文章
  const handleCopyArticle = async () => {
    if (!generatedArticle) return;
    
    try {
      await navigator.clipboard.writeText(generatedArticle);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动复制');
    }
  };

  // 重新生成
  const handleRegenerate = () => {
    setStep('input');
    setGeneratedCover(null);
    setGeneratedArticle(null);
    setTitle('');
  };

  return (
    <div className="space-y-6">
      {/* 输入阶段 */}
      {step === 'input' && (
        <Card className="border-2 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Globe className="w-6 h-6 text-[#059669]" />
              公众号推送生成
            </CardTitle>
            <CardDescription>
              上传图片并输入文字，AI 将为你生成专业的微信公众号推文
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 智能功能说明 */}
            <div className="bg-gradient-to-r from-[#059669]/10 to-[#047857]/10 border border-[#059669]/20 rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#059669]" />
                AI 将为你做什么？
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#059669] mt-0.5 shrink-0" />
                  <span className="text-foreground/80">整理你的文字，梳理逻辑结构</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#059669] mt-0.5 shrink-0" />
                  <span className="text-foreground/80">识别图片内容，理解图片含义</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#059669] mt-0.5 shrink-0" />
                  <span className="text-foreground/80">将图片插入到最合适的位置</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#059669] mt-0.5 shrink-0" />
                  <span className="text-foreground/80">为每张图片撰写图题说明</span>
                </div>
              </div>
            </div>

            {/* 图片上传区域 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-medium">
                  上传图片（可选）
                </Label>
                {uploadedImages.length > 0 && (
                  <span className="text-xs text-[#059669] bg-[#059669]/10 px-2 py-1 rounded-full">
                    📷 第一张图片将用作封面
                  </span>
                )}
              </div>
              {uploadedImages.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  💡 提示：上传图片，第一张图片将自动用作公众号封面
                </p>
              )}
              <div className="space-y-3">
                {/* 已上传图片预览 */}
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {uploadedImages.map((image, index) => (
                      <div key={image.id} className="relative group">
                        <div className={`aspect-square bg-accent/30 rounded-lg overflow-hidden ${image.usage === 'cover' ? 'ring-2 ring-[#059669]' : ''}`}>
                          <img
                            src={image.preview}
                            alt="预览"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        {/* 用途标签 */}
                        <div className="absolute -top-2 -left-2 z-10">
                          {image.usage === 'cover' ? (
                            <div className="bg-[#059669] text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              封面
                            </div>
                          ) : (
                            <div className="bg-[#6366F1] text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" />
                              插图
                            </div>
                          )}
                        </div>

                        {/* 切换用途按钮 */}
                        <button
                          onClick={() => toggleImageUsage(image.id)}
                          className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-white/90 text-black text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap hover:bg-card"
                        >
                          {image.usage === 'cover' ? '设为插图' : '设为封面'}
                        </button>

                        {/* 删除按钮 */}
                        <button
                          onClick={() => handleRemoveImage(image.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* 上传按钮 */}
                <div
                  onClick={handleSelectImages}
                  className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center cursor-pointer hover:border-[#059669]/50 hover:bg-[#059669]/5 transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files)}
                  />
                  <Upload className="w-12 h-12 mx-auto mb-3 text-foreground/70" />
                  <p className="text-muted-foreground font-medium">点击上传图片</p>
                  <p className="text-foreground/70 text-sm mt-1">支持 JPG、PNG、GIF 格式，最多10张</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="topic" className="text-base font-medium">
                主题描述
              </Label>
              <Textarea
                id="topic"
                placeholder="请输入您想要生成的内容主题，例如：科技资讯、生活感悟、产品介绍等"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                className="bg-accent/30 border-border"
              />
              <p className="text-xs text-muted-foreground">
                💡 提示：越详细的描述，生成效果越好
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-base font-medium">
                文章标题（可选）
              </Label>
              <Input
                id="title"
                placeholder="如果您有特定的标题要求，可以在这里输入"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-accent/30 border-border"
              />
            </div>

            {/* 后台生成开关 */}
            <div className="flex items-center justify-between p-4 bg-accent/30 rounded-xl">
              <div className="flex items-center gap-3">
                <ListTodo className="w-5 h-5 text-[#059669]" />
                <div>
                  <Label className="text-base font-medium">后台生成</Label>
                  <p className="text-xs text-muted-foreground">
                    在后台生成，可关闭页面等待结果
                  </p>
                </div>
              </div>
              <Switch
                checked={runInBackground}
                onCheckedChange={setRunInBackground}
              />
            </div>

            <Button
              className="w-full h-12 text-base font-medium bg-gradient-to-r from-[#059669] to-[#047857] hover:opacity-90"
              disabled={isGenerating || (!topic.trim() && uploadedImages.length === 0)}
              onClick={handleGenerate}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  {uploadedImages.length > 0 ? `生成公众号推送 (${uploadedImages.length}张图片)` : '生成公众号推送'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 生成中阶段 */}
      {step === 'generating' && (
        <Card className="border-2 shadow-lg">
          <CardContent className="py-12">
            <div className="text-center">
              <Loader2 className="w-16 h-16 mx-auto mb-4 text-[#059669] animate-spin" />
              <h3 className="text-xl font-bold text-foreground mb-2">
                正在生成公众号推送...
              </h3>
              <p className="text-muted-foreground mb-6">
                {uploadedImages.length > 0 
                  ? `正在理解${uploadedImages.length}张图片，整理文字，为您生成专业推文`
                  : '正在为您生成专业的封面图和完整的文章'}
              </p>
              
              {/* 进度条 */}
              <div className="max-w-md mx-auto mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{generationStage}</span>
                  <span className="text-sm text-muted-foreground">{generationProgress}%</span>
                </div>
                <div className="w-full bg-accent/50 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-[#059669] h-full transition-all duration-300 ease-out"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
              </div>
              
              <div className="flex justify-center gap-2 flex-wrap">
                {uploadedImages.length > 0 && (
                  <span className="px-3 py-1 bg-[#059669]/20 text-[#059669] rounded-full text-sm">
                    📷 图片理解中
                  </span>
                )}
                <span className="px-3 py-1 bg-[#059669]/20 text-[#059669] rounded-full text-sm">
                  📝 逻辑梳理中
                </span>
                <span className="px-3 py-1 bg-[#059669]/20 text-[#059669] rounded-full text-sm">
                  🎨 封面生成中
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 结果阶段 */}
      {step === 'result' && (
        <div className="space-y-6">
          <Tabs defaultValue="both" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-accent/30">
              <TabsTrigger value="both" className="data-[state=active]:bg-accent/50">
                完整展示
              </TabsTrigger>
              <TabsTrigger value="cover" className="data-[state=active]:bg-accent/50">
                <ImageIcon className="w-4 h-4 mr-2" />
                仅封面
              </TabsTrigger>
              <TabsTrigger value="article" className="data-[state=active]:bg-accent/50">
                <FileText className="w-4 h-4 mr-2" />
                仅文章
              </TabsTrigger>
            </TabsList>

            <TabsContent value="both" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 封面部分 */}
                <Card className="border-2 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5" />
                      封面图
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {generatedCover ? (
                      <div className="aspect-video bg-black rounded-lg overflow-hidden">
                        <img
                          src={generatedCover}
                          alt="公众号封面"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-accent/30 rounded-lg flex items-center justify-center">
                        <p className="text-muted-foreground">封面生成失败</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 文章部分 */}
                <Card className="border-2 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      文章内容
                    </CardTitle>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyArticle}
                      className="h-8"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          复制文章
                        </>
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {generatedArticle ? (
                      <div className="bg-accent/30 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                        <div className="text-white whitespace-pre-wrap leading-relaxed">
                          {generatedArticle.split('\n').map((line, index) => {
                            if (line.startsWith('![') && line.includes('](')) {
                              // 这是图片行，提取图片URL
                              const urlMatch = line.match(/\(([^)]+)\)/);
                              const altMatch = line.match(/\[([^\]]+)\]/);
                              if (urlMatch && urlMatch[1]) {
                                return (
                                  <div key={index} className="my-4">
                                    <img
                                      src={urlMatch[1]}
                                      alt={altMatch?.[1] || '图片'}
                                      className="max-w-full rounded-lg"
                                    />
                                  </div>
                                );
                              }
                            }
                            return <p key={index}>{line || '\u00A0'}</p>;
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-accent/30 rounded-lg p-4">
                        <p className="text-muted-foreground">文章生成失败</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="cover" className="mt-6">
              <Card className="border-2 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    公众号封面图
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {generatedCover ? (
                    <div className="max-w-2xl mx-auto">
                      <div className="aspect-video bg-black rounded-lg overflow-hidden">
                        <img
                          src={generatedCover}
                          alt="公众号封面"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">封面生成失败</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="article" className="mt-6">
              <Card className="border-2 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    公众号文章
                  </CardTitle>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyArticle}
                    className="h-8"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        复制文章
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  {generatedArticle ? (
                    <div className="bg-accent/30 rounded-lg p-6">
                      <div className="text-white whitespace-pre-wrap leading-relaxed text-lg">
                        {generatedArticle.split('\n').map((line, index) => {
                          if (line.startsWith('![') && line.includes('](')) {
                            const urlMatch = line.match(/\(([^)]+)\)/);
                            const altMatch = line.match(/\[([^\]]+)\]/);
                            if (urlMatch && urlMatch[1]) {
                              return (
                                <div key={index} className="my-6">
                                  <img
                                    src={urlMatch[1]}
                                    alt={altMatch?.[1] || '图片'}
                                    className="max-w-full rounded-lg mx-auto"
                                  />
                                </div>
                              );
                            }
                          }
                          return <p key={index}>{line || '\u00A0'}</p>;
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">文章生成失败</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1 h-12 text-base font-medium"
              onClick={handleRegenerate}
            >
              重新生成
            </Button>
            <Button
              className="flex-1 h-12 text-base font-medium bg-gradient-to-r from-[#059669] to-[#047857] hover:opacity-90"
              onClick={() => {
                alert('发布到公众号功能开发中，敬请期待！');
              }}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              发布到公众号
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
