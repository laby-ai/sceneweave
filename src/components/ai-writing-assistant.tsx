'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Pen,
  FileText,
  MessageSquare,
  Sparkles,
  Copy,
  RefreshCw,
  Check,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

const WRITING_STYLES = [
  { value: 'professional', label: '专业正式' },
  { value: 'casual', label: '轻松随意' },
  { value: 'creative', label: '富有创意' },
  { value: 'academic', label: '学术严谨' },
  { value: 'friendly', label: '友好亲切' },
  { value: 'concise', label: '简洁明了' },
];

const WRITING_TONES = [
  { value: 'positive', label: '积极正面' },
  { value: 'neutral', label: '客观中立' },
  { value: 'urgent', label: '紧急迫切' },
  { value: 'confident', label: '自信坚定' },
  { value: 'humorous', label: '幽默风趣' },
  { value: 'empathetic', label: '共情理解' },
];

const WRITING_LENGTHS = [
  { value: 'short', label: '简短 (100字)' },
  { value: 'medium', label: '中等 (300字)' },
  { value: 'long', label: '详细 (500字)' },
  { value: 'article', label: '文章 (800字+)' },
];

interface WritingHistory {
  id: string;
  prompt: string;
  result: string;
  timestamp: number;
}

export function AIWritingAssistant() {
  const [activeTab, setActiveTab] = useState('write');
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('professional');
  const [tone, setTone] = useState('neutral');
  const [length, setLength] = useState('medium');
  const [keyPoints, setKeyPoints] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [history, setHistory] = useState<WritingHistory[]>([]);
  const [copied, setCopied] = useState(false);

  const generateWriting = async () => {
    if (!topic.trim()) {
      alert('请输入主题');
      return;
    }

    setIsGenerating(true);
    setResult('');

    try {
      // 模拟生成过程
      const styleDesc = WRITING_STYLES.find(s => s.value === style)?.label;
      const toneDesc = WRITING_TONES.find(t => t.value === tone)?.label;
      
      // 模拟打字机效果
      const mockResult = `这是关于"${topic}"的${styleDesc}风格写作，采用${toneDesc}的语气。\n\n` +
        `在当今快速发展的时代，${topic}已经成为我们不可忽视的重要话题。` +
        `通过深入理解和实践，我们可以更好地应对相关挑战，抓住机遇。\n\n` +
        `${keyPoints ? keyPoints.split('\n').map(point => `• ${point}`).join('\n') + '\n\n' : ''}` +
        `总结来说，${topic}不仅是一个趋势，更是我们需要持续关注和投入的领域。` +
        `让我们携手共进，创造更美好的未来。`;

      let currentText = '';
      const chars = mockResult.split('');
      
      for (let i = 0; i < chars.length; i++) {
        currentText += chars[i];
        setResult(currentText);
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // 保存到历史
      const newHistory: WritingHistory = {
        id: Date.now().toString(),
        prompt: topic,
        result: mockResult,
        timestamp: Date.now(),
      };
      setHistory([newHistory, ...history]);

    } catch (error) {
      alert('生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerate = () => {
    setResult('');
    generateWriting();
  };

  const loadFromHistory = (item: WritingHistory) => {
    setTopic(item.prompt);
    setResult(item.result);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pen className="w-5 h-5" />
            AI写作助手
          </CardTitle>
          <CardDescription>
            智能生成各种类型的文案内容
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="write" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                写作
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                历史
              </TabsTrigger>
            </TabsList>

            <TabsContent value="write" className="space-y-6 mt-6">
              {/* Input Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic" className="text-base font-medium">
                    主题 <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="topic"
                    placeholder="请输入您想要写作的主题或内容描述..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="min-h-[100px]"
                    disabled={isGenerating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keyPoints" className="text-base font-medium">
                    关键点（可选，每行一个）
                  </Label>
                  <Textarea
                    id="keyPoints"
                    placeholder="请输入需要包含的关键点，每行一个..."
                    value={keyPoints}
                    onChange={(e) => setKeyPoints(e.target.value)}
                    className="min-h-[80px]"
                    disabled={isGenerating}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="style">写作风格</Label>
                    <Select value={style} onValueChange={setStyle} disabled={isGenerating}>
                      <SelectTrigger id="style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WRITING_STYLES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tone">语气态度</Label>
                    <Select value={tone} onValueChange={setTone} disabled={isGenerating}>
                      <SelectTrigger id="tone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WRITING_TONES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="length">内容长度</Label>
                    <Select value={length} onValueChange={setLength} disabled={isGenerating}>
                      <SelectTrigger id="length">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WRITING_LENGTHS.map((l) => (
                          <SelectItem key={l.value} value={l.value}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={generateWriting}
                  disabled={isGenerating || !topic.trim()}
                  className="w-full h-12 text-base"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      开始写作
                    </>
                  )}
                </Button>
              </div>

              {/* Result Section */}
              {result && (
                <div className="space-y-4 pt-6 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">生成结果</Label>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={copyResult}>
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            复制
                          </>
                        )}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={regenerate}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        重新生成
                      </Button>
                      <Button variant="secondary" size="sm">
                        <ThumbsUp className="w-4 h-4 mr-2" />
                        满意
                      </Button>
                      <Button variant="secondary" size="sm">
                        <ThumbsDown className="w-4 h-4 mr-2" />
                        不满意
                      </Button>
                    </div>
                  </div>
                  <Card>
                    <CardContent className="pt-6">
                      <pre className="whitespace-pre-wrap text-sm font-sans">{result}</pre>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4 mt-6">
              {history.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">暂无写作历史</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {history.map((item) => (
                    <Card 
                      key={item.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => loadFromHistory(item)}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium line-clamp-2">{item.prompt}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(item.timestamp).toLocaleString('zh-CN')}
                            </p>
                          </div>
                          <Button variant="secondary" size="sm">
                            查看
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
