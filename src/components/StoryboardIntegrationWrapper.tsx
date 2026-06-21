'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Film, ExternalLink, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { Storyboard, StoryboardShot } from '@/types/storyboard';
import { VideoPromptGeneratorEnhanced } from './video-prompt-generator-enhanced';

interface StoryboardIntegrationWrapperProps {
  storyboard: Storyboard | null;
  onStoryboardChange: (storyboard: Storyboard) => void;
  onSwitchToStoryboardMode: () => void;
  generationMode: 'normal' | 'storyboard';
  children: React.ReactNode;
  /** 字幕段落数据 - 传递给提示词助手用于智能分镜生成 */
  subtitleSegments?: Array<{ id: string; text: string; startTime: number; endTime: number }>;
}

export function StoryboardIntegrationWrapper({
  storyboard,
  onStoryboardChange,
  onSwitchToStoryboardMode,
  generationMode,
  children,
  subtitleSegments = [],
}: StoryboardIntegrationWrapperProps) {
  // 分镜头助手显示状态
  const [showPromptGenerator, setShowPromptGenerator] = useState(false);
  
  // 跳转确认对话框
  const [showJumpConfirmDialog, setShowJumpConfirmDialog] = useState(false);

  // 从提示词助手应用分镜头
  const handleApplyShots = useCallback((shots: Array<{ prompt: string; duration: number; referenceImage?: string }>) => {
    if (shots.length === 0) return;

    // 创建新的分镜头对象
    const newShots: StoryboardShot[] = shots.map((shot, index) => ({
      id: `shot-${Date.now()}-${index}`,
      index,
      prompt: shot.prompt,
      duration: Math.min(shot.duration, 10),
      referenceImage: shot.referenceImage,
      nineGridImages: [],
      status: 'pending' as const
    }));

    const totalDuration = newShots.reduce((sum, s) => sum + s.duration, 0);

    // 创建或更新storyboard
    const newStoryboard: Storyboard = {
      id: storyboard?.id || `storyboard-${Date.now()}`,
      title: '从提示词助手导入的分镜头',
      totalDuration,
      shots: newShots,
      status: 'draft' as const,
      createdAt: storyboard?.createdAt || new Date(),
      updatedAt: new Date()
    };

    onStoryboardChange(newStoryboard);
    
    // 如果不在分镜头模式，询问是否切换
    if (generationMode !== 'storyboard') {
      setShowJumpConfirmDialog(true);
    } else {
      setShowPromptGenerator(false);
    }
  }, [storyboard, onStoryboardChange, generationMode]);

  // 确认跳转到分镜头模式
  const confirmJumpToStoryboard = () => {
    setShowJumpConfirmDialog(false);
    setShowPromptGenerator(false);
    onSwitchToStoryboardMode();
  };

  // 处理普通提示词生成
  const handlePromptGenerated = useCallback((prompt: string) => {
    // 这里可以处理普通提示词生成的逻辑
    setShowPromptGenerator(false);
  }, []);

  return (
    <div className="space-y-4">
      {/* 子组件（原有的表单内容） */}
      {children}

      {/* 提示词助手按钮 - 放在合适的位置 */}
      <div className="flex justify-center">
        <Button
          variant="secondary"
          onClick={() => setShowPromptGenerator(true)}
          className="gap-2"
        >
          <Film className="w-4 h-4" />
          打开分镜头提示词助手
        </Button>
      </div>

      {/* 分镜头提示词助手弹窗 */}
      <Dialog open={showPromptGenerator} onOpenChange={setShowPromptGenerator}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="w-5 h-5 text-red-500" />
              分镜头提示词助手
            </DialogTitle>
            <DialogDescription>
              自动划分分镜头，点击"应用"后才会应用到生成界面
            </DialogDescription>
          </DialogHeader>
          
          <VideoPromptGeneratorEnhanced
            onPromptGenerated={handlePromptGenerated}
            onApplyShots={handleApplyShots}
            subtitleSegments={subtitleSegments}
          />
        </DialogContent>
      </Dialog>

      {/* 跳转到分镜头模式确认对话框 */}
      <Dialog open={showJumpConfirmDialog} onOpenChange={setShowJumpConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              分镜头已应用！
            </DialogTitle>
            <DialogDescription>
              分镜头已成功创建！是否跳转到分镜头模式查看和编辑？
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-green-500/10 rounded-lg p-4 my-4">
            <h4 className="text-white font-medium mb-2">已创建的分镜头：</h4>
            <ul className="text-sm text-foreground/70 space-y-1">
              {storyboard?.shots.map((shot, index) => (
                <li key={shot.id}>
                  • 镜头 {index + 1}：{shot.duration}秒
                </li>
              ))}
            </ul>
          </div>
          
          <DialogFooter className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowJumpConfirmDialog(false)}
              className="flex-1"
            >
              留在当前模式
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-red-500 to-pink-500"
              onClick={confirmJumpToStoryboard}
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              跳转到分镜头模式
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 便捷函数：创建初始storyboard
export function createInitialStoryboard(): Storyboard {
  return {
    id: `storyboard-${Date.now()}`,
    title: '未命名分镜头视频',
    totalDuration: 15,
    shots: [{
      id: `shot-${Date.now()}`,
      index: 0,
      prompt: '',
      duration: 5,
      nineGridImages: [],
      status: 'pending'
    }],
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}
