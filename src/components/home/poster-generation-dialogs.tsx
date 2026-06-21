'use client';

import { Edit3, Loader2, RefreshCw, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ImageEditor } from '@/components/image-editor';

type RegenerateMode = 'detail' | 'full';
type DetailFixMode = 'editor' | 'ai';

export function PosterGenerationDialogs({
  showEditor,
  setShowEditor,
  result,
  setResult,
  showRegenerateDialog,
  setShowRegenerateDialog,
  regenerateMode,
  setRegenerateMode,
  detailFixMode,
  setDetailFixMode,
  regeneratePrompt,
  setRegeneratePrompt,
  useOriginalPrompt,
  setUseOriginalPrompt,
  showManualEditConfirmDialog,
  setShowManualEditConfirmDialog,
  showAIFixDialog,
  setShowAIFixDialog,
  isAIFixGenerating,
  aiFixProgress,
  aiFixProgressStep,
  handleDetailFix,
  handleFullRegenerate,
  handleManualEditConfirm,
  handleCancelAIFix,
  handleStartAIFix,
}: {
  showEditor: boolean;
  setShowEditor: (value: boolean) => void;
  result: any;
  setResult: (value: any) => void;
  showRegenerateDialog: boolean;
  setShowRegenerateDialog: (value: boolean) => void;
  regenerateMode: RegenerateMode;
  setRegenerateMode: (value: RegenerateMode) => void;
  detailFixMode: DetailFixMode;
  setDetailFixMode: (value: DetailFixMode) => void;
  regeneratePrompt: string;
  setRegeneratePrompt: (value: string) => void;
  useOriginalPrompt: boolean;
  setUseOriginalPrompt: (value: boolean) => void;
  showManualEditConfirmDialog: boolean;
  setShowManualEditConfirmDialog: (value: boolean) => void;
  showAIFixDialog: boolean;
  setShowAIFixDialog: (value: boolean) => void;
  isAIFixGenerating: boolean;
  aiFixProgress: number;
  aiFixProgressStep: string;
  handleDetailFix: () => void;
  handleFullRegenerate: () => void | Promise<void>;
  handleManualEditConfirm: () => void;
  handleCancelAIFix: () => void;
  handleStartAIFix: () => void | Promise<void>;
}) {
  return (
    <>
      {/* 图片编辑器对话框 */}
      {showEditor && result.posterUrl && (
        <Dialog open={showEditor} onOpenChange={setShowEditor}>
          <DialogContent className="max-w-[95vw] h-[90vh] p-0">
            <ImageEditor
              imageUrl={result.posterUrl}
              onSave={(editedImageUrl) => {
                setResult({
                  ...result,
                  posterUrl: editedImageUrl,
                });
                setShowEditor(false);
              }}
              onCancel={() => setShowEditor(false)}
            />
          </DialogContent>
        </Dialog>
      )}
      
      {/* 重新生成对话框 */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>选择重新生成方式</DialogTitle>
            <DialogDescription>
              根据您的需求选择合适的重新生成方式
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4 overflow-y-auto flex-1">
            {/* 选择方式 */}
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => setRegenerateMode('detail')}
                className={`
                  p-4 rounded-xl border-2 cursor-pointer transition-all
                  ${regenerateMode === 'detail'
                    ? 'border-[#70E0FF] bg-[#70E0FF]/10'
                    : 'border-border hover:border-white/20'
                  }
                `}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Edit3 className="w-5 h-5" />
                  <h4 className="font-semibold">细节修复</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  基于当前海报，根据您的描述进行局部修改和优化
                </p>
              </div>
              
              <div
                onClick={() => setRegenerateMode('full')}
                className={`
                  p-4 rounded-xl border-2 cursor-pointer transition-all
                  ${regenerateMode === 'full'
                    ? 'border-[#70E0FF] bg-[#70E0FF]/10'
                    : 'border-border hover:border-white/20'
                  }
                `}
              >
                <div className="flex items-center gap-3 mb-2">
                  <RefreshCw className="w-5 h-5" />
                  <h4 className="font-semibold">重新生成</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  结合原始提示词和您的新描述，重新生成全新的海报
                </p>
              </div>
            </div>
            
            {/* 输入描述 */}
            <div>
              <Label htmlFor="regenerate-prompt">
                输入修改描述
              </Label>
              <Textarea
                id="regenerate-prompt"
                value={regeneratePrompt}
                onChange={(e) => setRegeneratePrompt(e.target.value)}
                placeholder={
                  regenerateMode === 'detail'
                    ? '您可以在这里记录想要做的修改，例如：添加标题"限时优惠"、调整颜色更鲜艳等'
                    : '描述您想要的新效果，例如：改为科技风格、使用蓝色为主色调、添加更多动感元素等'
                }
                className="bg-accent/30 border-border"
                rows={4}
              />
            </div>

            {/* 原有提示词选项（仅重新生成模式） */}
            {regenerateMode === 'full' && result?.posterPrompt && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>使用原有提示词</Label>
                  <Switch
                    checked={useOriginalPrompt}
                    onCheckedChange={setUseOriginalPrompt}
                  />
                </div>
                <div className="bg-accent/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-2">原有提示词：</p>
                  <p className="text-sm text-foreground/70 break-words">
                    {result.posterPrompt}
                  </p>
                </div>
                <p className="text-xs text-foreground/70 mt-2">
                  {useOriginalPrompt
                    ? '✓ 将使用原有提示词 + 您的新描述生成海报'
                    : '✓ 将仅使用您的新描述生成海报'
                  }
                </p>
              </div>
            )}

            {/* 细节修复子选项 */}
            {regenerateMode === 'detail' && (
              <div>
                <Label className="mb-2 block">修复方式</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    onClick={() => setDetailFixMode('editor')}
                    className={`
                      p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${detailFixMode === 'editor'
                        ? 'border-[#70E0FF] bg-[#70E0FF]/10'
                        : 'border-border hover:border-white/20'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Edit3 className="w-5 h-5" />
                      <h4 className="font-semibold">手动编辑</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      打开专业图片编辑器，手动添加文字、调整滤镜、修改颜色等
                    </p>
                  </div>

                  <div
                    onClick={() => setDetailFixMode('ai')}
                    className={`
                      p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${detailFixMode === 'ai'
                        ? 'border-[#70E0FF] bg-[#70E0FF]/10'
                        : 'border-border hover:border-white/20'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Wand2 className="w-5 h-5" />
                      <h4 className="font-semibold">AI 修复</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      基于您的描述，使用 AI 自动修改图片细节
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* 提示信息 */}
            <div className="bg-accent/30 rounded-lg p-4">
              <p className="text-sm text-foreground/70">
                {regenerateMode === 'detail' ? (
                  detailFixMode === 'editor' ? (
                    <>
                      <strong>手动编辑</strong>：将打开专业的图片编辑器，您可以添加文字、调整滤镜、修改颜色、裁剪图片等。适合对当前海报进行精细化调整和个性化编辑。
                    </>
                  ) : (
                    <>
                      <strong>AI 修复</strong>：会基于您的修改描述，使用 AI 自动优化图片细节，只修改输入的部分，其他保持不变。适合快速调整构图、颜色、风格等。
                    </>
                  )
                ) : (
                  <>
                    <strong>重新生成</strong>：{useOriginalPrompt
                      ? '将结合原有提示词和您的新描述重新生成全新的海报'
                      : '将仅使用您的新描述生成全新的海报'
                    }。适合大幅度修改风格、完全改变设计方向等。
                  </>
                )}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRegenerateDialog(false)}
            >
              取消
            </Button>
            <Button
              className="bg-[#70E0FF] text-black hover:bg-[#70E0FF]/80"
              onClick={regenerateMode === 'detail' ? handleDetailFix : handleFullRegenerate}
              disabled={
                (regenerateMode === 'full' && !regeneratePrompt.trim()) ||
                (regenerateMode === 'detail' && detailFixMode === 'ai' && !regeneratePrompt.trim())
              }
            >
              {regenerateMode === 'detail'
                ? (detailFixMode === 'editor' ? '打开编辑器' : '开始修复')
                : '开始生成'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 手动编辑确认对话框 */}
      <Dialog open={showManualEditConfirmDialog} onOpenChange={setShowManualEditConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>打开图片编辑器</DialogTitle>
            <DialogDescription>
              确定要打开图片编辑器进行手动编辑吗？
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-[#70E0FF]/10 border border-[#70E0FF]/20 rounded-lg p-4">
              <p className="text-sm text-foreground/80">
                <Edit3 className="inline w-4 h-4 mr-1 text-[#70E0FF]" />
                打开后，您可以添加文字、调整滤镜、修改颜色、裁剪图片等来完成细节修改。
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowManualEditConfirmDialog(false);
                setShowRegenerateDialog(true);
              }}
            >
              返回
            </Button>
            <Button
              className="bg-[#70E0FF] text-black hover:bg-[#70E0FF]/80"
              onClick={handleManualEditConfirm}
            >
              打开编辑器
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI修复对话框 */}
      <Dialog open={showAIFixDialog} onOpenChange={setShowAIFixDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>AI 细节修复</DialogTitle>
            <DialogDescription>
              使用 AI 智能修复海报细节
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4 overflow-y-auto flex-1">
            {/* 原图预览 */}
            <div className="rounded-lg overflow-hidden bg-accent/30">
              <img
                src={result?.posterUrl}
                alt="原图"
                className="w-full h-48 object-cover"
              />
            </div>

            {/* 修改说明 */}
            <div>
              <Label className="mb-2 block">修改说明</Label>
              <div className="bg-accent/30 rounded-lg p-4">
                {regeneratePrompt.trim() ? (
                  <p className="text-foreground/70">{regeneratePrompt}</p>
                ) : (
                  <p className="text-foreground/70 italic">请在上一页输入修改描述</p>
                )}
              </div>
              {!regeneratePrompt.trim() && (
                <p className="text-xs text-[#70E0FF] mt-2">
                  <Wand2 className="inline w-3 h-3 mr-1" />
                  请先输入修改描述才能开始修复
                </p>
              )}
            </div>

            {/* 生成进度 */}
            {isAIFixGenerating && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground/70">{aiFixProgressStep}</span>
                  <span className="text-sm text-[#70E0FF]">{aiFixProgress}%</span>
                </div>
                <div className="h-2 bg-accent/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#70E0FF] transition-all duration-300"
                    style={{ width: `${aiFixProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 提示信息 */}
            {!isAIFixGenerating && (
              <div className="bg-[#70E0FF]/10 border border-[#70E0FF]/20 rounded-lg p-4">
                <p className="text-sm text-foreground/80">
                  <Wand2 className="inline w-4 h-4 mr-1 text-[#70E0FF]" />
                  {regeneratePrompt.trim() ? (
                    <>
                      点击"开始修复"后，AI 将根据您的描述自动修改图片细节。您可以随时点击"取消"停止生成。
                    </>
                  ) : (
                    <>
                      请先点击"返回修改"输入您的修改描述，然后才能开始AI修复。
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAIFixDialog(false);
                setShowRegenerateDialog(true);
              }}
            >
              返回修改
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelAIFix}
              disabled={!isAIFixGenerating}
            >
              {isAIFixGenerating ? '取消' : '关闭'}
            </Button>
            <Button
              className="bg-[#70E0FF] text-black hover:bg-[#70E0FF]/80"
              onClick={() => {
                console.log('Start Fix Button clicked');
                console.log('isAIFixGenerating:', isAIFixGenerating);
                console.log('regeneratePrompt:', regeneratePrompt);
                console.log('regeneratePrompt.trim():', regeneratePrompt.trim());
                handleStartAIFix();
              }}
              disabled={isAIFixGenerating || !regeneratePrompt.trim()}
            >
              {isAIFixGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  开始修复
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
