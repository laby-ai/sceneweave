'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Loader2, Music, Image as ImageIcon, FileText, Sparkles, Copy, Check, Upload, X, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTasks } from '@/contexts/TaskContext';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  description?: string;
  usage: 'cover' | 'scene';
}

interface DouyinGenerationProps {
  onGenerated?: (data: any) => void;
}

export function DouyinGeneration({ onGenerated }: DouyinGenerationProps) {
  const router = useRouter();
  const { addTask } = useTasks();
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<'story' | 'knowledge' | 'funny' | 'lifestyle'>('story');
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState<'input' | 'generating' | 'result'>('input');
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [generatedCover, setGeneratedCover] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [runInBackground, setRunInBackground] = useState(true);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const styles = [
    { id: 'story' as const, label: '剧情故事', icon: '🎬', desc: '短剧、反转剧情' },
    { id: 'knowledge' as const, label: '知识分享', icon: '📚', desc: '科普、教程类' },
    { id: 'funny' as const, label: '搞笑幽默', icon: '😂', desc: '段子、情景喜剧' },
    { id: 'lifestyle' as const, label: '生活记录', icon: '✨', desc: 'Vlog、日常分享' },
  ];

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setStep('generating');
    setGenerationProgress(0);
    setGenerationStage('正在分析选题...');

    const progressTimer = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 90) { clearInterval(progressTimer); return 90; }
        return prev + Math.random() * 15;
      });
    }, 800);

    try {
      setGenerationStage('正在生成脚本...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      const script = `【${topic}】抖音短视频脚本\n\n🎬 开头(0-3秒)\n画面：[吸引眼球的场景]\n文案：你有没有想过${topic}？\n\n📖 展开(3-15秒)\n画面：[核心内容展示]\n文案：其实${topic}远比你想象的更有意思...\n\n💡 高潮(15-30秒)\n画面：[关键转折或爆点]\n文案：但最关键的是...\n\n🎯 结尾(30-45秒)\n画面：[总结或号召]\n文案：关注我，了解更多${topic}的干货！\n\n📝 标签建议：#${topic} #抖音短视频 #热门`;
      setGeneratedScript(script);

      setGenerationStage('正在生成封面...');
      setGenerationProgress(60);
      await new Promise(resolve => setTimeout(resolve, 1200));
      setGeneratedCover(null);

      clearInterval(progressTimer);
      setGenerationProgress(100);
      setGenerationStage('生成完成');
      setStep('result');

      onGenerated?.({ topic, style, script });
    } catch (error) {
      console.error('生成失败:', error);
      setStep('input');
    } finally {
      setIsGenerating(false);
    }
  }, [topic, style, onGenerated]);

  const handleCopyScript = useCallback(() => {
    if (generatedScript) {
      navigator.clipboard.writeText(generatedScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [generatedScript]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadedImages(prev => [...prev, {
          id: Math.random().toString(36).slice(2),
          file,
          preview: ev.target?.result as string,
          usage: 'scene',
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeImage = useCallback((id: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
  }, []);

  if (step === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative mb-6">
          <Loader2 className="w-16 h-16 animate-spin text-[#EF4444]" />
          <Music className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#EF4444]" />
        </div>
        <p className="text-lg font-medium text-foreground mb-2">{generationStage}</p>
        <div className="w-64 h-2 bg-accent rounded-full overflow-hidden">
          <div
            className="h-full bg-[#EF4444] rounded-full transition-all duration-500"
            style={{ width: `${generationProgress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">{Math.round(generationProgress)}%</p>
        {runInBackground && (
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              addTask({
                type: 'douyin',
                status: 'running',
                config: { prompt: topic },
                progress: generationProgress,
                stage: generationStage,
              });
              setStep('input');
              setIsGenerating(false);
            }}
          >
            在后台运行
          </Button>
        )}
      </div>
    );
  }

  if (step === 'result') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">生成结果</h2>
          <Button variant="outline" onClick={() => { setStep('input'); setGeneratedScript(null); setGeneratedCover(null); }}>
            重新生成
          </Button>
        </div>

        {/* 封面预览 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#EF4444]" />
              视频封面
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-[9/16] max-w-[200px] bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 rounded-xl flex items-center justify-center">
              <div className="text-center text-white p-4">
                <Music className="w-8 h-8 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-sm">{topic}</p>
                <p className="text-xs opacity-80 mt-1">抖音短视频</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 脚本内容 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#EF4444]" />
                视频脚本
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCopyScript}>
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-foreground/80 font-sans leading-relaxed">
              {generatedScript}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 选题输入 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="w-5 h-5 text-[#EF4444]" />
            抖音短视频创作
          </CardTitle>
          <CardDescription>
            输入选题，AI 为你生成适配抖音风格的短视频脚本和封面
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="douyin-topic">视频选题</Label>
            <Input
              id="douyin-topic"
              placeholder="例如：5个提高效率的小技巧"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {/* 风格选择 */}
          <div>
            <Label>视频风格</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {styles.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    style === s.id
                      ? 'border-[#EF4444] bg-[#EF4444]/5 text-foreground'
                      : 'border-border hover:border-[#EF4444]/50 text-foreground/70'
                  }`}
                >
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 参考图上传 */}
          <div>
            <Label>参考素材（可选）</Label>
            <div className="mt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
              <div className="flex flex-wrap gap-2">
                {uploadedImages.map((img) => (
                  <div key={img.id} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border">
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:border-[#EF4444]/50 hover:text-[#EF4444] transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-xs mt-1">上传</span>
                </button>
              </div>
            </div>
          </div>

          {/* 后台运行开关 */}
          <div className="flex items-center justify-between">
            <Label htmlFor="douyin-bg" className="text-sm">后台运行</Label>
            <Switch
              id="douyin-bg"
              checked={runInBackground}
              onCheckedChange={setRunInBackground}
            />
          </div>
        </CardContent>
      </Card>

      {/* 生成按钮 */}
      <Button
        onClick={handleGenerate}
        disabled={!topic.trim() || isGenerating}
        className="w-full h-12 text-base bg-[#EF4444] hover:bg-[#DC2626] text-white"
      >
        <Sparkles className="w-5 h-5 mr-2" />
        {isGenerating ? '生成中...' : '生成抖音短视频'}
      </Button>
    </div>
  );
}
