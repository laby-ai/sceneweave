import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Copy, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

interface EnhancedPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalPrompt: string;
  enhancedPrompt: string;
  onApply?: (prompt: string) => void;
}

export function EnhancedPromptModal({
  open,
  onOpenChange,
  originalPrompt,
  enhancedPrompt,
  onApply,
}: EnhancedPromptModalProps) {
  const [copied, setCopied] = useState(false);

  console.log('[EnhancedPromptModal] 组件渲染', { open, originalPrompt, enhancedPrompt });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(enhancedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const handleApply = () => {
    onApply?.(enhancedPrompt);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        {/* 头部 - 固定 */}
        <div className="px-6 py-4 border-b">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="w-6 h-6 text-red-500" />
              提示词智能增强
            </DialogTitle>
            <DialogDescription>
              我们已经为您优化了提示词，点击应用即可使用
            </DialogDescription>
          </DialogHeader>
        </div>
        
        {/* 内容区域 - 可滚动 */}
        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
          <div className="space-y-4">
            {/* 原始提示词 */}
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  原始提示词
                </div>
                <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {originalPrompt}
                </div>
              </CardContent>
            </Card>

            {/* 增强提示词 */}
            <Card className="border-red-500/50 bg-red-500/5">
              <CardContent className="pt-4">
                <div className="text-sm font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  增强提示词
                </div>
                <div className="p-3 bg-red-500/10 rounded-md text-sm whitespace-pre-wrap">
                  {enhancedPrompt}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* 底部按钮 - 固定 */}
        <div className="px-6 py-4 border-t bg-background">
          <div className="flex flex-col gap-3">
            {/* 主要操作按钮 */}
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="secondary" 
                size="lg" 
                onClick={handleCopy}
                className="h-12 text-base"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 mr-2 text-green-500" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5 mr-2" />
                    复制提示词
                  </>
                )}
              </Button>
              <Button 
                size="lg" 
                onClick={handleApply}
                className="h-12 text-base bg-gradient-to-r from-red-500 to-red-500 hover:from-yellow-600 hover:to-amber-600"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                应用增强
              </Button>
            </div>
            
            {/* 次要操作按钮 */}
            <div className="flex justify-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCancel}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                取消
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
