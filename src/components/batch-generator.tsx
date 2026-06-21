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
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  Check, 
  X, 
  Loader2,
  Download,
  Settings2
} from 'lucide-react';

interface BatchItem {
  id: string;
  prompt: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

const CONTENT_TYPES = [
  { value: 'image', label: '图片生成' },
  { value: 'video', label: '视频生成' },
  { value: 'text', label: '文本写作' },
];

export function BatchGenerator() {
  const [contentType, setContentType] = useState('image');
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [concurrency, setConcurrency] = useState(1);
  const [autoSave, setAutoSave] = useState(true);
  const [newPrompt, setNewPrompt] = useState('');

  const addPrompt = () => {
    if (!newPrompt.trim()) return;
    
    const newItem: BatchItem = {
      id: Date.now().toString(),
      prompt: newPrompt.trim(),
      status: 'pending',
    };
    
    setBatchItems([...batchItems, newItem]);
    setNewPrompt('');
  };

  const removePrompt = (id: string) => {
    setBatchItems(batchItems.filter(item => item.id !== id));
  };

  const clearAll = () => {
    if (confirm('确定要清空所有任务吗？')) {
      setBatchItems([]);
      setCurrentIndex(0);
      setIsGenerating(false);
    }
  };

  const startBatch = async () => {
    if (batchItems.length === 0) {
      alert('请先添加要生成的内容');
      return;
    }

    setIsGenerating(true);
    setCurrentIndex(0);

    try {
      for (let i = 0; i < batchItems.length; i++) {
        if (!isGenerating) break;

        setCurrentIndex(i);
        
        // 更新状态为生成中
        setBatchItems(prev => prev.map((item, index) => 
          index === i ? { ...item, status: 'generating' } : item
        ));

        // 模拟生成过程
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

        // 随机成功或失败
        const success = Math.random() > 0.1;
        
        setBatchItems(prev => prev.map((item, index) => {
          if (index === i) {
            return {
              ...item,
              status: success ? 'completed' : 'failed',
              result: success ? `生成成功！这是"${item.prompt}"的${contentType === 'image' ? '图片' : contentType === 'video' ? '视频' : '文本'}内容。` : undefined,
              error: success ? undefined : '生成失败，请重试',
            };
          }
          return item;
        }));
      }
    } catch (error) {
      console.error('批量生成失败:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const stopBatch = () => {
    setIsGenerating(false);
  };

  const completedCount = batchItems.filter(item => item.status === 'completed').length;
  const failedCount = batchItems.filter(item => item.status === 'failed').length;
  const pendingCount = batchItems.filter(item => item.status === 'pending' || item.status === 'generating').length;
  const progress = batchItems.length > 0 ? (completedCount / batchItems.length) * 100 : 0;

  const quickPrompts = [
    '一只可爱的小猫',
    '美丽的日落风景',
    '未来科技城市',
    '奇幻森林冒险',
    '星空下的浪漫',
  ];

  const addQuickPrompt = (prompt: string) => {
    const newItem: BatchItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      prompt,
      status: 'pending',
    };
    setBatchItems([...batchItems, newItem]);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            批量生成器
          </CardTitle>
          <CardDescription>
            一次添加多个任务，自动批量生成
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="content-type">内容类型</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger id="content-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>并发数: {concurrency}</Label>
              </div>
              <Slider
                value={[concurrency]}
                onValueChange={(value) => setConcurrency(value[0])}
                min={1}
                max={5}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-save">自动保存</Label>
                <Switch
                  id="auto-save"
                  checked={autoSave}
                  onCheckedChange={setAutoSave}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                生成完成后自动保存结果
              </p>
            </div>
          </div>

          {/* Add Prompt */}
          <div className="space-y-3">
            <Label htmlFor="new-prompt">添加任务</Label>
            <div className="flex gap-2">
              <Textarea
                id="new-prompt"
                placeholder="输入要生成的内容描述..."
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addPrompt())}
                className="flex-1 min-h-[60px]"
              />
              <Button onClick={addPrompt} disabled={!newPrompt.trim()}>
                <Plus className="w-4 h-4 mr-2" />
                添加
              </Button>
            </div>

            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">快速添加：</span>
              {quickPrompts.map((prompt, index) => (
                <Button
                  key={index}
                  variant="secondary"
                  size="sm"
                  onClick={() => addQuickPrompt(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>

          {/* Progress */}
          {batchItems.length > 0 && (
            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex gap-4">
                  <Badge variant="secondary">
                    总计: {batchItems.length}
                  </Badge>
                  <Badge className="bg-green-500">
                    <Check className="w-3 h-3 mr-1" />
                    完成: {completedCount}
                  </Badge>
                  {failedCount > 0 && (
                    <Badge className="bg-red-500">
                      <X className="w-3 h-3 mr-1" />
                      失败: {failedCount}
                    </Badge>
                  )}
                  {pendingCount > 0 && (
                    <Badge variant="secondary">
                      等待: {pendingCount}
                    </Badge>
                  )}
                </div>
                <div className="text-sm font-medium">
                  {Math.round(progress)}%
                </div>
              </div>
              <div className="w-full bg-accent rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-red-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Control Buttons */}
          {batchItems.length > 0 && (
            <div className="flex gap-2">
              {!isGenerating ? (
                <Button onClick={startBatch} className="flex-1">
                  <Play className="w-4 h-4 mr-2" />
                  开始批量生成
                </Button>
              ) : (
                <Button onClick={stopBatch} variant="destructive" className="flex-1">
                  <Pause className="w-4 h-4 mr-2" />
                  停止
                </Button>
              )}
              <Button variant="secondary" onClick={clearAll}>
                <Trash2 className="w-4 h-4 mr-2" />
                清空
              </Button>
            </div>
          )}

          {/* Batch Items List */}
          {batchItems.length > 0 && (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {batchItems.map((item, index) => (
                <Card key={item.id} className={`border-2 ${
                  index === currentIndex && isGenerating ? 'border-primary' :
                  item.status === 'completed' ? 'border-green-200' :
                  item.status === 'failed' ? 'border-red-200' : 'border-border'
                }`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                        {item.status === 'pending' && <div className="w-2 h-2 rounded-full bg-gray-400" />}
                        {item.status === 'generating' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                        {item.status === 'completed' && <Check className="w-4 h-4 text-green-500" />}
                        {item.status === 'failed' && <X className="w-4 h-4 text-red-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2">{item.prompt}</p>
                        {item.result && (
                          <p className="text-xs text-green-600 mt-1">{item.result}</p>
                        )}
                        {item.error && (
                          <p className="text-xs text-red-600 mt-1">{item.error}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {item.status === 'completed' && (
                          <Button variant="secondary" size="sm">
                            <Download className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => removePrompt(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {batchItems.length === 0 && (
            <div className="text-center py-12">
              <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">还没有任务</h3>
              <p className="text-sm text-muted-foreground mb-4">
                上方添加描述，开始批量生成
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
