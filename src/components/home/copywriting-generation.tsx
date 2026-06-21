'use client';

import { useState } from 'react';
import { Brain, Copy, Loader2, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// 文案生成组件
export function CopywritingGeneration({ onGenerated }: { onGenerated: (prompt: string, variations: string[]) => void }) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('marketing');
  const [platform, setPlatform] = useState('general');
  const [isGenerating, setIsGenerating] = useState(false);
  const [variations, setVariations] = useState<string[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingVariations, setStreamingVariations] = useState<string[]>([]);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState('');

  const styles = [
    { id: 'marketing', label: '营销型' },
    { id: 'emotional', label: '情感型' },
    { id: 'professional', label: '专业型' },
    { id: 'humorous', label: '幽默型' },
  ];

  const platforms = [
    { 
      id: 'general', 
      label: '通用', 
      desc: '适用于大多数场景',
      icon: '📝'
    },
    { 
      id: 'xiaohongshu', 
      label: '小红书', 
      desc: '体验分享，emoji丰富，语气亲切',
      icon: '📕'
    },
    { 
      id: 'douyin', 
      label: '抖音', 
      desc: '短视频脚本，节奏紧凑，吸引眼球',
      icon: '🎵'
    },
    { 
      id: 'weibo', 
      label: '微博', 
      desc: '话题性强，适合热点传播',
      icon: '🔥'
    },
    { 
      id: 'wechat', 
      label: '微信公众号', 
      desc: '专业深度，有教育价值',
      icon: '💬'
    },
    { 
      id: 'kuaishou', 
      label: '快手', 
      desc: '接地气，口语化表达',
      icon: '👋'
    },
    { 
      id: 'bilibili', 
      label: 'B站', 
      desc: '二次元风格，年轻化，网络流行语',
      icon: '📺'
    },
  ];

  const handleGenerate = async () => {
    if (!prompt) {
      alert('请输入产品或主题描述');
      return;
    }

    setIsGenerating(true);
    setStreamingContent('');
    setStreamingVariations([]);
    setGenerationProgress(0);
    setGenerationStage('正在初始化...');

    try {
      // 步骤1：准备
      setGenerationStage('正在理解您的需求...');
      setGenerationProgress(10);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 调用文案生成 API（流式）
      const response = await fetch('/api/copywriting/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style, platform }),
      });

      if (!response.ok) {
        throw new Error('文案生成失败');
      }

      // 步骤2：开始生成
      setGenerationStage('AI正在思考中...');
      setGenerationProgress(30);

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let fullContent = '';
      let contentLength = 0;

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
              setStreamingContent(fullContent);

              // 根据内容长度更新进度
              const progress = Math.min(30 + Math.floor(contentLength / 50), 90);
              setGenerationProgress(progress);
              
              // 更新阶段信息
              if (progress < 50) {
                setGenerationStage('正在生成文案...');
              } else if (progress < 80) {
                setGenerationStage('正在优化文案...');
              } else {
                setGenerationStage('即将完成...');
              }

              // 实时解析和显示版本
              const tempVariations = fullContent.split('=== 版本分隔 ===')
                .map(v => v.trim())
                .filter(v => v.length > 0);
              setStreamingVariations(tempVariations);
            } else if (data.type === 'done') {
              setGenerationProgress(100);
              setGenerationStage('完成！');
              
              await new Promise(resolve => setTimeout(resolve, 500));
              
              setVariations(data.variations || []);
              setStreamingVariations([]);
              setStreamingContent('');
              setGenerationProgress(0);
              setGenerationStage('');
              onGenerated(prompt, data.variations || []);
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error generating copywriting:', error);
      alert('文案生成失败，请重试');
      setStreamingContent('');
      setStreamingVariations([]);
      setGenerationProgress(0);
      setGenerationStage('');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* AI 提示信息 */}
      <div className="bg-[#70E0FF]/10 border border-[#70E0FF]/20 rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-[#70E0FF]" />
          <div>
            <h4 className="font-semibold text-[#70E0FF]">AI 智能文案生成</h4>
            <p className="text-sm text-foreground/70">
              使用大语言模型智能分析您的输入，生成3个不同版本的优质文案
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-6 border border-border mb-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="copywriting-prompt">产品或主题描述</Label>
            <Textarea
              id="copywriting-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="请描述您的产品或主题，例如：一款智能手表，具有健康监测功能、GPS定位、防水设计"
              className="bg-accent/30 border-border"
              rows={4}
            />
            <p className="text-xs text-foreground/70 mt-2">
              💡 提示：描述越详细，生成的文案质量越高
            </p>
          </div>
          <div>
            <Label htmlFor="copywriting-style">文案风格</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="bg-accent/30 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {styles.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="copywriting-platform">目标平台</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="bg-accent/30 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="mr-2">{p.icon}</span>
                    {p.label}
                    <span className="ml-2 text-muted-foreground text-xs">- {p.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-foreground/70 mt-2">
              💡 不同平台有不同的文案风格和格式要求
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-[#70E0FF] text-black hover:bg-[#70E0FF]/80"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                生成中... ({generationProgress}%)
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                生成文案
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 进度显示 */}
      {isGenerating && (
        <div className="bg-card rounded-2xl p-6 border border-border mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-[#70E0FF]" />
              <span className="text-sm font-medium">{generationStage || '正在准备...'}</span>
            </div>
            <span className="text-sm text-muted-foreground">{generationProgress}%</span>
          </div>
          <div className="w-full bg-accent/50 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-[#70E0FF] h-full transition-all duration-300 ease-out"
              style={{ width: `${generationProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* 生成中的流式输出 */}
      {isGenerating && (streamingVariations.length > 0 || streamingContent) && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-[#70E0FF]" />
            <h3 className="text-xl font-bold">正在生成文案...</h3>
          </div>
          {streamingVariations.length > 0 ? (
            // 显示已完成的版本
            streamingVariations.map((variation, index) => (
              <div
                key={`streaming-${index}`}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="secondary">版本 {index + 1}</Badge>
                  {index === streamingVariations.length - 1 && (
                    <span className="text-xs text-[#70E0FF]">正在完善中...</span>
                  )}
                </div>
                <Textarea
                  value={variation}
                  readOnly
                  className="bg-accent/30 border-border"
                  rows={6}
                />
              </div>
            ))
          ) : (
            // 显示实时生成的原始内容
            <div className="bg-card rounded-2xl p-6 border border-border">
              <p className="text-sm text-muted-foreground mb-2">AI 正在思考并生成...</p>
              <Textarea
                value={streamingContent}
                readOnly
                className="bg-accent/30 border-border"
                rows={8}
              />
            </div>
          )}
        </div>
      )}

      {/* 生成完成的文案 */}
      {variations.length > 0 && !isGenerating && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold">生成的文案</h3>
          {variations.map((variation, index) => (
            <div
              key={index}
              className="bg-card rounded-2xl p-6 border border-border"
            >
              <div className="flex items-center justify-between mb-3">
                <Badge variant="secondary">版本 {index + 1}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(variation);
                    alert('已复制到剪贴板');
                  }}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  复制
                </Button>
              </div>
              <Textarea
                value={variation}
                readOnly
                className="bg-accent/30 border-border"
                rows={6}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

