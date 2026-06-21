'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Loader2, Heart, Image as ImageIcon, FileText, Sparkles, Copy, Check, ListTodo, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTasks } from '@/contexts/TaskContext';
import { formatProviderError, getBYOKRequestHeaders } from '@/lib/byok-client';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
}

interface XiaohongshuGeneratedData {
  copy: { copywriting: string | null };
  images: UploadedImage[];
  image?: { imageUrls: string[] };
}

interface XiaohongshuGenerationProps {
  onGenerated?: (data: XiaohongshuGeneratedData) => void;
}

export function XiaohongshuGeneration({ onGenerated }: XiaohongshuGenerationProps) {
  const router = useRouter();
  const { addTask } = useTasks();
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState<'input' | 'generating' | 'result'>('input');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedCopy, setGeneratedCopy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [runInBackground, setRunInBackground] = useState(true);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理图片上传
  const handleImageUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: UploadedImage[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
    }));

    setUploadedImages(prev => [...prev, ...newImages]);
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

  // 生成小红书内容
  const handleGenerate = async () => {
    if (!topic.trim()) {
      alert('请输入主题');
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
            platform: 'xiaohongshu',
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
            platform: 'xiaohongshu',
          },
          progress: 5,
          stage: '初始化...',
        });
        
        console.log('[Xiaohongshu Generation] Task added to task center:', taskId);
        
        alert('小红书图文生成任务已提交！请前往任务中心查看进度');
        
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
      // 步骤1：处理配图（优先使用用户上传的图片）
      let finalImage: string | null = null;
      
      if (uploadedImages.length > 0) {
        // 如果用户上传了图片，直接使用第一张作为配图
        setGenerationStage('使用上传的图片作为配图...');
        setGenerationProgress(20);
        finalImage = uploadedImages[0].preview;
        setGeneratedImage(finalImage);
        setGenerationStage('配图已选择，正在生成文案...');
        setGenerationProgress(50);
      } else {
        // 如果用户没有上传图片，才生成新的配图
        setGenerationStage('正在生成配图（预计 1 张）...');
        setGenerationProgress(20);
        const imageResponse = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
          body: JSON.stringify({
            prompt: `小红书风格图片，${topic}，高清，美观，适合3:4比例展示`,
            size: '2K',
            n: 1,
          }),
        });

        const imageData = await imageResponse.json();
        if (!imageResponse.ok) {
          throw new Error(formatProviderError(imageData, '图片生成失败'));
        }

        finalImage = imageData.imageUrls?.[0] || null;
        setGeneratedImage(finalImage);
        setGenerationStage('配图生成完成，正在生成文案...');
        setGenerationProgress(50);
      }

      // 步骤2：生成文案（小红书风格）
      const copyResponse = await fetch('/api/copywriting/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: topic,
          style: 'emotional',
          platform: 'xiaohongshu',
        }),
      });

      if (!copyResponse.ok) {
        throw new Error('文案生成失败');
      }

      // 处理流式响应
      const reader = copyResponse.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let fullContent = '';
      let finalCopyContent: string | null = null;
      let contentLength = 0;
      
      setGenerationStage('正在生成文案...');
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
              const newProgress = Math.min(60 + Math.floor(contentLength / 50), 95);
              if (newProgress > generationProgress) {
                setGenerationProgress(newProgress);
                if (newProgress < 80) {
                  setGenerationStage('AI正在创作中...');
                } else if (newProgress < 95) {
                  setGenerationStage('正在优化文案...');
                }
              }
            } else if (data.type === 'done') {
              // 取第一个版本的文案
              finalCopyContent = data.variations?.[0] || fullContent || null;
              setGeneratedCopy(finalCopyContent);
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          }
        }
      }

      setGenerationStage('生成完成！');
      setGenerationProgress(100);
      setStep('result');
      
      // 构建返回数据
      const resultData: XiaohongshuGeneratedData = {
        copy: { copywriting: finalCopyContent },
        images: uploadedImages
      };
      
      // 如果有配图，添加到结果中
      if (finalImage) {
        resultData.image = { imageUrls: [finalImage] };
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

  // 复制文案
  const handleCopyCopy = async () => {
    if (!generatedCopy) return;
    
    try {
      await navigator.clipboard.writeText(generatedCopy);
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
    setGeneratedImage(null);
    setGeneratedCopy(null);
  };

  return (
    <div className="space-y-6">
      {/* 输入阶段 */}
      {step === 'input' && (
        <Card className="border-2 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Heart className="w-6 h-6 text-[#70E0FF]" />
              小红书图文生成
            </CardTitle>
            <CardDescription>
              输入主题，一键生成适配小红书的封面图、笔记结构和种草文案
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 图片上传区域 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-medium">
                  上传图片（可选）
                </Label>
                {uploadedImages.length > 0 && (
                  <span className="text-xs text-[#70E0FF] bg-[#70E0FF]/10 px-2 py-1 rounded-full">
                    📷 第一张图片将用作配图
                  </span>
                )}
              </div>
              {uploadedImages.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  💡 提示：上传图片，第一张图片将自动用作小红书配图
                </p>
              )}
              <div className="space-y-3">
                {/* 已上传图片预览 */}
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {uploadedImages.map((image, index) => (
                      <div key={image.id} className="relative group">
                        <div className={`aspect-[3/4] bg-accent/30 rounded-lg overflow-hidden ${index === 0 ? 'ring-2 ring-[#70E0FF]' : ''}`}>
                          <img
                            src={image.preview}
                            alt="预览"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {index === 0 && (
                          <div className="absolute -top-2 -left-2 bg-[#70E0FF] text-[#020617] text-xs px-2 py-1 rounded-full z-10">
                            配图
                          </div>
                        )}
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
                  className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center cursor-pointer hover:border-[#70E0FF]/50 hover:bg-[#70E0FF]/5 transition-all"
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
                  <p className="text-foreground/70 text-sm mt-1">支持 JPG、PNG、GIF 格式，最多5张</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="topic" className="text-base font-medium">
                主题描述
              </Label>
              <Textarea
                id="topic"
                placeholder="请输入您想要生成的内容主题，例如：春日穿搭、美食探店、旅行攻略等"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={4}
                className="bg-accent/30 border-border"
              />
              <p className="text-xs text-muted-foreground">
                💡 提示：越详细的描述，生成效果越好
              </p>
            </div>

            {/* 后台生成开关 */}
            <div className="flex items-center justify-between p-4 bg-accent/30 rounded-xl">
              <div className="flex items-center gap-3">
                <ListTodo className="w-5 h-5 text-[#70E0FF]" />
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
              className="w-full h-12 text-base font-medium bg-gradient-to-r from-[#4F6CFF] to-[#70E0FF] text-white hover:opacity-90"
              disabled={isGenerating || !topic.trim()}
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
                  生成小红书图文
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
              <Loader2 className="w-16 h-16 mx-auto mb-4 text-[#70E0FF] animate-spin" />
              <h3 className="text-xl font-bold text-foreground mb-2">
                正在生成小红书图文...
              </h3>
              <p className="text-muted-foreground mb-6">
                正在为您生成精美的图片和吸引人的文案
              </p>
              
              {/* 进度条 */}
              <div className="max-w-md mx-auto mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{generationStage}</span>
                  <span className="text-sm text-muted-foreground">{generationProgress}%</span>
                </div>
                <div className="w-full bg-accent/50 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-[#4F6CFF] to-[#70E0FF] h-full transition-all duration-300 ease-out"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
              </div>
              
              <div className="flex justify-center gap-2 flex-wrap">
                <span className="px-3 py-1 bg-[#70E0FF]/10 text-[#70E0FF] rounded-full text-sm">
                  🎨 配图生成中
                </span>
                <span className="px-3 py-1 bg-[#70E0FF]/10 text-[#70E0FF] rounded-full text-sm">
                  ✍️ 文案创作中
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
              <TabsTrigger value="image" className="data-[state=active]:bg-accent/50">
                <ImageIcon className="w-4 h-4 mr-2" />
                仅图片
              </TabsTrigger>
              <TabsTrigger value="copy" className="data-[state=active]:bg-accent/50">
                <FileText className="w-4 h-4 mr-2" />
                仅文案
              </TabsTrigger>
            </TabsList>

            <TabsContent value="both" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 图片部分 */}
                <Card className="border-2 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5" />
                      配图
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {generatedImage ? (
                      <div className="aspect-[3/4] bg-black rounded-lg overflow-hidden">
                        <img
                          src={generatedImage}
                          alt="小红书配图"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[3/4] bg-accent/30 rounded-lg flex items-center justify-center">
                        <p className="text-muted-foreground">图片生成失败</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 文案部分 */}
                <Card className="border-2 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      文案
                    </CardTitle>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyCopy}
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
                          复制文案
                        </>
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {generatedCopy ? (
                      <div className="bg-accent/30 rounded-lg p-4">
                        <p className="text-white whitespace-pre-wrap leading-relaxed">
                          {generatedCopy}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-accent/30 rounded-lg p-4">
                        <p className="text-muted-foreground">文案生成失败</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="image" className="mt-6">
              <Card className="border-2 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    小红书配图
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {generatedImage ? (
                    <div className="max-w-md mx-auto">
                      <div className="aspect-[3/4] bg-black rounded-lg overflow-hidden">
                        <img
                          src={generatedImage}
                          alt="小红书配图"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">图片生成失败</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="copy" className="mt-6">
              <Card className="border-2 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    小红书文案
                  </CardTitle>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyCopy}
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
                        复制文案
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  {generatedCopy ? (
                    <div className="bg-accent/30 rounded-lg p-6">
                      <p className="text-white whitespace-pre-wrap leading-relaxed text-lg">
                        {generatedCopy}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">文案生成失败</p>
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
              className="flex-1 h-12 text-base font-medium bg-gradient-to-r from-[#4F6CFF] to-[#70E0FF] text-white hover:opacity-90"
              onClick={() => {
                alert('发布到小红书功能开发中，敬请期待！');
              }}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              发布到小红书
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
