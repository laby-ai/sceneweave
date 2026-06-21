'use client';

import { useState } from 'react';
import {
  Copy,
  Download,
  Edit3,
  FileCode,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PosterGenerationDialogs } from '@/components/home/poster-generation-dialogs';

// 海报生成组件
export function PosterGeneration({ onGenerated }: { onGenerated: (data: any) => void }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [keyInfo, setKeyInfo] = useState('');
  const [colorScheme, setColorScheme] = useState('bright');
  const [size, setSize] = useState('general_poster');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState('');
  const [result, setResult] = useState<any>(null);
  const [showEditor, setShowEditor] = useState(false);
  
  // 图片上传相关状态
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // 关键字优化相关状态
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedKeywords, setOptimizedKeywords] = useState('');
  const [isOptimized, setIsOptimized] = useState(false);
  
  // 重新生成相关状态
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [showManualEditConfirmDialog, setShowManualEditConfirmDialog] = useState(false);
  const [regenerateMode, setRegenerateMode] = useState<'detail' | 'full'>('detail');
  const [detailFixMode, setDetailFixMode] = useState<'editor' | 'ai'>('editor');
  const [regeneratePrompt, setRegeneratePrompt] = useState('');
  const [useOriginalPrompt, setUseOriginalPrompt] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // AI修复相关状态
  const [showAIFixDialog, setShowAIFixDialog] = useState(false);
  const [isAIFixGenerating, setIsAIFixGenerating] = useState(false);
  const [aiFixProgress, setAiFixProgress] = useState(0);
  const [aiFixProgressStep, setAiFixProgressStep] = useState('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const colorSchemes = [
    { id: 'bright', label: '明亮色调', desc: '明亮活泼，充满活力' },
    { id: 'dark', label: '暗色色调', desc: '沉稳大气，高端质感' },
    { id: 'warm', label: '暖色色调', desc: '温暖舒适，亲切友好' },
    { id: 'cool', label: '冷色色调', desc: '冷静清新，专业稳重' },
    { id: 'colorful', label: '多彩色调', desc: '丰富多彩，活力四射' },
  ];

  const sizes = [
    { id: 'instagram_post', label: 'Instagram 帖子', desc: '1080x1080 (1:1)', category: '社交媒体' },
    { id: 'instagram_story', label: 'Instagram 故事', desc: '1080x1920 (9:16)', category: '社交媒体' },
    { id: 'facebook_post', label: 'Facebook 帖子', desc: '1200x630 (19:10)', category: '社交媒体' },
    { id: 'twitter_post', label: 'Twitter 帖子', desc: '1600x900 (16:9)', category: '社交媒体' },
    { id: 'wechat_moments', label: '微信朋友圈', desc: '1080x1920 (9:16)', category: '社交媒体' },
    { id: 'douyin', label: '抖音视频', desc: '1080x1920 (9:16)', category: '社交媒体' },
    { id: 'xiaohongshu', label: '小红书', desc: '1080x1440 (3:4)', category: '社交媒体' },
    { id: 'linkedin', label: 'LinkedIn', desc: '1200x627 (19:10)', category: '社交媒体' },
    { id: 'youtube_thumbnail', label: 'YouTube 封面', desc: '1280x720 (16:9)', category: '社交媒体' },
    { id: 'general_poster', label: '通用海报', desc: '800x1200 (2:3)', category: '通用' },
    { id: 'a4_print', label: 'A4 打印', desc: '2480x3508 (A4)', category: '打印' },
  ];

  // 处理图片上传
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }

    // 检查文件大小（限制为5MB）
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过5MB');
      return;
    }

    setIsUploading(true);

    try {
      // 将图片转换为base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Url = e.target?.result as string;
        setReferenceImages([...referenceImages, base64Url]);
        setIsUploading(false);
      };
      reader.onerror = () => {
        alert('图片上传失败');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('图片上传失败');
      setIsUploading(false);
    }
  };

  // 删除参考图片
  const handleRemoveImage = (index: number) => {
    setReferenceImages(referenceImages.filter((_, i) => i !== index));
  };

  // 智能优化关键字
  const handleOptimizeKeywords = async () => {
    if (!keyInfo.trim()) {
      alert('请先输入关键信息');
      return;
    }

    setIsOptimizing(true);
    
    try {
      const response = await fetch('/api/poster/optimize-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keyInfo }),
      });

      if (!response.ok) {
        throw new Error('关键字优化失败');
      }

      const data = await response.json();
      setOptimizedKeywords(data.optimizedKeywords);
      setIsOptimized(true);
    } catch (error) {
      console.error('Error optimizing keywords:', error);
      alert('关键字优化失败，请重试');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGenerate = async () => {
    if (!videoUrl && !keyInfo) {
      alert('请输入视频 URL 或关键信息');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setProgressStep('正在准备...');
    
    try {
      // 步骤1：准备
      setProgressStep('正在分析设计参数...');
      setProgress(20);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 步骤2：生成文案
      setProgressStep('正在生成文案...');
      setProgress(40);
      
      // 调用海报生成 API
      const response = await fetch('/api/poster/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          videoUrl, 
          keyInfo, 
          colorScheme, 
          size,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined 
        }),
      });

      if (!response.ok) {
        throw new Error('海报生成失败');
      }

      setProgressStep('正在生成海报图片...');
      setProgress(70);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 步骤3：完成
      setProgressStep('正在完成...');
      setProgress(90);

      const data = await response.json();
      setProgress(100);
      setProgressStep('完成！');
      
      setTimeout(() => {
        setResult(data);
        onGenerated(data);
        setProgress(0);
        setProgressStep('');
      }, 500);
    } catch (error) {
      console.error('Error generating poster:', error);
      alert('海报生成失败，请重试');
      setProgress(0);
      setProgressStep('');
    } finally {
      setIsGenerating(false);
    }
  };

  // 处理重新生成按钮点击
  const handleRegenerateClick = () => {
    setShowRegenerateDialog(true);
    setRegenerateMode('detail');
    setRegeneratePrompt('');
  };

  // 处理细节修复（根据模式选择打开编辑器或显示AI修复界面）
  const handleDetailFix = () => {
    console.log('handleDetailFix called');
    console.log('detailFixMode:', detailFixMode);
    console.log('regeneratePrompt:', regeneratePrompt);
    console.log('result:', result);

    if (!result?.posterUrl) {
      alert('海报尚未生成');
      return;
    }

    if (detailFixMode === 'editor') {
      // 手动编辑模式，弹出确认对话框
      setShowRegenerateDialog(false);
      setShowManualEditConfirmDialog(true);
    } else {
      // AI修复模式，显示AI修复对话框
      if (!regeneratePrompt.trim()) {
        alert('请先输入修改描述');
        return;
      }
      setShowRegenerateDialog(false);
      console.log('Opening AI fix dialog');
      setShowAIFixDialog(true);
    }
  };

  // 直接AI修复（不使用）
  const handleDirectAIFix = async () => {
    console.log('handleDirectAIFix called');
    console.log('result:', result);
    console.log('regeneratePrompt:', regeneratePrompt);

    if (!result?.posterUrl) {
      alert('海报尚未生成');
      return;
    }

    setIsAIFixGenerating(true);

    try {
      // 步骤1：准备
      const response = await fetch('/api/poster/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: result.posterUrl,
          prompt: regeneratePrompt,
          editType: 'detail_fix',
        }),
      });

      if (!response.ok) {
        throw new Error('图片修改失败');
      }

      const data = await response.json();
      console.log('Data received:', data);

      // 更新结果
      setResult({
        ...result,
        posterUrl: data.modifiedImageUrl,
        text: `${result.text}\n\n【细节修复】\n${regeneratePrompt}`,
      });

      alert('细节修复完成！');
    } catch (error: any) {
      console.error('Error in handleDirectAIFix:', error);
      alert('细节修复失败，请重试');
    } finally {
      setIsAIFixGenerating(false);
    }
  };

  // 处理手动编辑确认
  const handleManualEditConfirm = () => {
    console.log('handleManualEditConfirm called');
    console.log('showEditor before:', showEditor);
    setShowManualEditConfirmDialog(false);
    setShowEditor(true);
    console.log('showEditor after:', showEditor);
    // 移除alert，因为它可能会阻塞操作
  };

  // 开始AI修复生成
  const handleStartAIFix = async () => {
    console.log('handleStartAIFix called');
    console.log('result:', result);
    console.log('result.posterUrl:', result?.posterUrl);
    console.log('regeneratePrompt:', regeneratePrompt);
    
    if (!result?.posterUrl) {
      alert('海报尚未生成');
      return;
    }

    // regeneratePrompt的检查已经在按钮级别完成

    setIsAIFixGenerating(true);
    setAiFixProgress(0);
    setAiFixProgressStep('正在准备...');
    
    // 创建新的AbortController
    const controller = new AbortController();
    setAbortController(controller);
    
    try {
      // 步骤1：准备
      setAiFixProgressStep('正在分析原图...');
      setAiFixProgress(20);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 步骤2：发送请求
      setAiFixProgressStep('正在使用AI修复...');
      setAiFixProgress(50);
      
      console.log('Sending request to /api/poster/edit');
      const response = await fetch('/api/poster/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: result.posterUrl,
          prompt: regeneratePrompt,
          editType: 'detail_fix',
        }),
        signal: controller.signal,
      });
      console.log('Response received:', response);

      // 检查是否被取消
      if (controller.signal.aborted) {
        console.log('Request aborted');
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response not ok:', errorText);
        throw new Error('图片修改失败');
      }

      // 步骤3：处理结果
      setAiFixProgressStep('正在加载修复后的图片...');
      setAiFixProgress(80);
      await new Promise(resolve => setTimeout(resolve, 500));

      const data = await response.json();
      console.log('Data received:', data);

      // 步骤4：完成
      setAiFixProgress(100);
      setAiFixProgressStep('完成！');

      // 更新结果，使用修改后的图片
      setResult({
        ...result,
        posterUrl: data.modifiedImageUrl,
        text: `${result.text}\n\n【细节修复】\n${regeneratePrompt}`,
      });

      // 关闭对话框
      setTimeout(() => {
        setShowAIFixDialog(false);
        alert('细节修复完成！');
      }, 500);
    } catch (error: any) {
      console.error('Error in handleStartAIFix:', error);
      if (error.name === 'AbortError') {
        console.log('AI修复已取消');
        alert('修复已取消');
      } else {
        console.error('Error in detail fix:', error);
        alert('细节修复失败，请重试');
      }
    } finally {
      setIsAIFixGenerating(false);
      setAiFixProgress(0);
      setAiFixProgressStep('');
      setAbortController(null);
    }
  };

  // 取消AI修复
  const handleCancelAIFix = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setIsAIFixGenerating(false);
    setAiFixProgress(0);
    setAiFixProgressStep('');
  };

  // 处理完全重新生成
  const handleFullRegenerate = async () => {
    if (!regeneratePrompt.trim()) {
      alert('请提供新的描述');
      return;
    }

    setIsRegenerating(true);
    setShowRegenerateDialog(false);

    try {
      // 根据用户选择决定是否使用原有提示词
      let finalPrompt = regeneratePrompt;

      if (useOriginalPrompt && result?.posterPrompt) {
        // 使用原有提示词 + 新提示词重新生成
        const originalPrompt = result?.posterPrompt || keyInfo || videoUrl || '精美视频';
        finalPrompt = `${originalPrompt} ${regeneratePrompt}`;
      }

      // 调用海报生成 API
      const response = await fetch('/api/poster/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: useOriginalPrompt ? videoUrl : undefined,
          keyInfo: finalPrompt,
          colorScheme: useOriginalPrompt ? colorScheme : undefined,
          size: useOriginalPrompt ? size : undefined,
          referenceImages: useOriginalPrompt && referenceImages.length > 0 ? referenceImages : undefined
        }),
      });

      if (!response.ok) {
        throw new Error('海报生成失败');
      }

      const data = await response.json();

      // 更新结果
      setResult({
        ...result,
        ...data,
        text: useOriginalPrompt
          ? `基于原稿重新生成\n\n${data.text}`
          : `使用新描述生成\n\n${data.text}`,
      });

      alert('重新生成完成！');
    } catch (error) {
      console.error('Error regenerating:', error);
      alert('重新生成失败，请重试');
    } finally {
      setIsRegenerating(false);
    }
  };

  // 处理下载海报
  const handleDownloadPoster = async () => {
    if (!result?.posterUrl) {
      alert('海报尚未生成');
      return;
    }

    try {
      // 使用fetch + blob模式下载，避免跨域问题
      const response = await fetch(result.posterUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `poster-${Date.now()}.png`;
      link.click();
      
      // 清理
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading poster:', error);
      alert('下载失败，请重试');
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-card rounded-2xl p-6 border border-border mb-6">
        <h3 className="text-xl font-bold mb-6">海报设计配置</h3>
        
        {/* 基础信息 */}
        <div className="space-y-4 mb-6">
          <div>
            <Label htmlFor="video-url">视频 URL（可选）</Label>
            <Input
              id="video-url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="请输入视频 URL"
              className="bg-accent/30 border-border"
            />
            <p className="text-xs text-foreground/70 mt-1">如果提供视频 URL，系统会自动提取关键信息</p>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="key-info">关键信息（可选）</Label>
              {keyInfo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOptimizeKeywords}
                  disabled={isOptimizing}
                  className="text-xs"
                >
                  {isOptimizing ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      智能优化中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      智能优化
                    </>
                  )}
                </Button>
              )}
            </div>
            <Textarea
              id="key-info"
              value={keyInfo}
              onChange={(e) => setKeyInfo(e.target.value)}
              placeholder="请输入产品或主题的关键信息，例如：智能手表，具有健康监测功能，适合运动爱好者"
              className="bg-accent/30 border-border"
              rows={3}
            />
            <p className="text-xs text-foreground/70 mt-1">
              直接提供关键信息，用于生成海报文案和设计
              {isOptimized && optimizedKeywords !== keyInfo && ' ✨ 已优化，您可以继续编辑'}
            </p>
            
            {/* 优化建议 */}
            {optimizedKeywords && optimizedKeywords !== keyInfo && (
              <div className="mt-3 p-3 bg-[#70E0FF]/10 border border-[#70E0FF]/20 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-[#70E0FF]" />
                      <span className="text-sm font-semibold text-[#70E0FF]">智能优化建议</span>
                    </div>
                    <p className="text-sm text-foreground/80">{optimizedKeywords}</p>
                  </div>
                  <div className="flex gap-2 ml-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setKeyInfo(optimizedKeywords)}
                      className="text-xs h-7"
                    >
                      采用
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOptimizedKeywords('')}
                      className="text-xs h-7"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 参考图片上传 */}
        <div className="mb-6">
          <Label className="text-base font-semibold mb-3 block">参考图片（可选）</Label>
          <p className="text-xs text-foreground/70 mb-3">
            上传品牌Logo、技术图片或海报参考图，AI将基于这些图片进行设计
          </p>
          
          {/* 上传按钮 */}
          <div className="mb-4">
            <Input
              id="reference-image"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={isUploading}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('reference-image')?.click()}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  上传参考图片
                </>
              )}
            </Button>
            <p className="text-xs text-foreground/70 mt-1">支持 JPG、PNG 格式，最大 5MB</p>
          </div>
          
          {/* 图片预览 */}
          {referenceImages.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {referenceImages.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`参考图片 ${index + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border border-white/20"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute top-1 right-1 w-6 h-6 border-amber-300/25 bg-black/60 text-amber-100 opacity-0 transition-opacity hover:bg-amber-300/15 group-hover:opacity-100"
                    onClick={() => handleRemoveImage(index)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                  <div className="absolute bottom-1 left-1 bg-black/60 rounded px-2 py-0.5">
                    <span className="text-xs text-white">参考 {index + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 色调选择 */}
        <div className="mb-6">
          <Label className="text-base font-semibold mb-3 block">色调方案</Label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {colorSchemes.map((cs) => (
              <div
                key={cs.id}
                onClick={() => setColorScheme(cs.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  colorScheme === cs.id
                    ? 'border-[#70E0FF] bg-[#70E0FF]/10'
                    : 'border-border hover:border-white/30'
                }`}
              >
                <div className="text-sm font-medium mb-1">{cs.label}</div>
                <div className="text-xs text-muted-foreground">{cs.desc}</div>
                <div className="flex gap-1 mt-2">
                  {['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181'].slice(0, 5).map((color, idx) => (
                    <div
                      key={idx}
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 尺寸选择 */}
        <div className="mb-6">
          <Label className="text-base font-medium">选择尺寸</Label>
          <p className="text-xs text-foreground/70 mb-3">选择海报的目标平台和尺寸比例</p>
          
          {/* 按类别分组显示 */}
          {['社交媒体', '通用', '打印'].map(category => (
            <div key={category} className="mb-3">
              <p className="text-xs text-foreground/30 mb-2 font-medium">{category}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {sizes.filter(s => s.category === category).map((sizeOption) => (
                  <div
                    key={sizeOption.id}
                    onClick={() => setSize(sizeOption.id)}
                    className={`
                      p-3 rounded-xl cursor-pointer border transition-all duration-200
                      ${size === sizeOption.id
                        ? 'bg-[#70E0FF] text-black border-[#70E0FF] shadow-lg shadow-[#70E0FF]/20'
                        : 'bg-accent/30 border-border hover:bg-accent hover:border-white/20'
                      }
                    `}
                  >
                    <p className={`font-medium text-sm ${size === sizeOption.id ? 'text-primary-foreground' : 'text-foreground'}`}>
                      {sizeOption.label}
                    </p>
                    <p className={`text-xs mt-1 ${size === sizeOption.id ? 'text-black/70' : 'text-foreground/70'}`}>
                      {sizeOption.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 生成按钮 */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-[#70E0FF] text-black hover:bg-[#70E0FF]/80 h-12 text-lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              生成中... ({progress}%)
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5 mr-2" />
              生成海报
            </>
          )}
        </Button>

        {/* 进度显示 */}
        {isGenerating && (
          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-[#70E0FF]" />
                <span className="text-sm font-medium">{progressStep}</span>
              </div>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <div className="w-full bg-accent/50 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-[#70E0FF] h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 生成结果 */}
      {result && (
        <div className="space-y-6">
          {/* 设计信息 */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-xl font-bold mb-4">设计方案</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-accent/30 rounded-xl p-4">
                <div className="text-sm text-muted-foreground mb-1">尺寸</div>
                <div className="font-semibold">{result.size?.name}</div>
                <div className="text-xs text-foreground/70 mt-1">{result.size?.description}</div>
              </div>
              <div className="bg-accent/30 rounded-xl p-4">
                <div className="text-sm text-muted-foreground mb-1">色调</div>
                <div className="font-semibold">{result.colorScheme?.name}</div>
                <div className="text-xs text-foreground/70 mt-1">{result.colorScheme?.description}</div>
              </div>
            </div>
            <div className="flex gap-2">
              {result.colorScheme?.palette?.map((color: string, idx: number) => (
                <div
                  key={idx}
                  className="w-8 h-8 rounded-lg border border-white/20"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* 生成的文案 */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">生成的文案</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(result.text);
                  alert('已复制到剪贴板');
                }}
              >
                <Copy className="w-4 h-4 mr-1" />
                复制
              </Button>
            </div>
            <Textarea
              value={result.text}
              readOnly
              className="bg-accent/30 border-border"
              rows={12}
            />
          </div>

          {/* 海报预览 */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">海报预览</h3>
              {result.posterUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditor(true)}
                >
                  <Edit3 className="w-4 h-4 mr-1" />
                  编辑海报
                </Button>
              )}
            </div>
            {result.posterUrl ? (
              <img
                src={result.posterUrl}
                alt="生成的海报"
                className="w-full rounded-xl"
              />
            ) : (
              <div className="aspect-[3/4] bg-gradient-to-br from-[#1E40AF] to-[#1E3A8A] rounded-xl flex items-center justify-center">
                <div className="text-center text-foreground/80">
                  <FileCode className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-lg font-semibold">海报生成中</p>
                  <p className="text-sm mt-2">基于 {result.colorScheme?.name}</p>
                </div>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleRegenerateClick}
              disabled={isRegenerating}
              className="flex-1"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重新生成
                </>
              )}
            </Button>
            <Button
              className="flex-1 bg-[#70E0FF] text-black hover:bg-[#70E0FF]/80"
              onClick={handleDownloadPoster}
              disabled={!result.posterUrl}
            >
              <Download className="w-4 h-4 mr-2" />
              下载海报
            </Button>
          </div>
        </div>
      )}
      
      <PosterGenerationDialogs
        showEditor={showEditor}
        setShowEditor={setShowEditor}
        result={result}
        setResult={setResult}
        showRegenerateDialog={showRegenerateDialog}
        setShowRegenerateDialog={setShowRegenerateDialog}
        regenerateMode={regenerateMode}
        setRegenerateMode={setRegenerateMode}
        detailFixMode={detailFixMode}
        setDetailFixMode={setDetailFixMode}
        regeneratePrompt={regeneratePrompt}
        setRegeneratePrompt={setRegeneratePrompt}
        useOriginalPrompt={useOriginalPrompt}
        setUseOriginalPrompt={setUseOriginalPrompt}
        showManualEditConfirmDialog={showManualEditConfirmDialog}
        setShowManualEditConfirmDialog={setShowManualEditConfirmDialog}
        showAIFixDialog={showAIFixDialog}
        setShowAIFixDialog={setShowAIFixDialog}
        isAIFixGenerating={isAIFixGenerating}
        aiFixProgress={aiFixProgress}
        aiFixProgressStep={aiFixProgressStep}
        handleDetailFix={handleDetailFix}
        handleFullRegenerate={handleFullRegenerate}
        handleManualEditConfirm={handleManualEditConfirm}
        handleCancelAIFix={handleCancelAIFix}
        handleStartAIFix={handleStartAIFix}
      />
    </div>
  );
}


