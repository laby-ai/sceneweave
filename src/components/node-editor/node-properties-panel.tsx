'use client';

import { useState } from 'react';
import type { Node } from 'reactflow';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  Plus,
  MapPin,
  Image as ImageIcon,
  Video,
  Sparkles,
  Upload,
  Camera,
  RefreshCw,
  User,
  Film,
  Mic,
  Copy,
  Download,
  Users,
  Loader2,
  Trash2,
  LayoutGrid,
  Map,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { getBgmTypeList } from '@/constants/bgm-types';
import { type CustomNodeData, type NodeType, nodeColors, nodeIcons, nodeLabels } from './node-editor-shared';
import { StoryboardPropertiesSection } from './node-properties-storyboard-section';
import { VisualPropertiesSections } from './node-properties-visual-sections';
import { CharacterScenePropertiesSections } from './node-properties-character-scene-sections';
import { MediaPropertiesSections } from './node-properties-media-sections';

// 属性面板组件
export const PropertiesPanel = ({ 
  selectedNode, 
  onClose,
  onUpdateNode,
  isGenerating,
  batchGenerateStoryboardImages,
  generateSingleStoryboardImage,
  generateVideoFromImage,
  generateAudio,
  composeFinalVideo,
  batchGenerateStoryboardVideos,
  regenerateImage,
  regenerateVideoFromNode,
  selectedStoryboards,
  setSelectedStoryboards,
  canWriteBackProductionAsset,
  canvasSaveInfo,
  onSaveProductionAsset,
  onSaveStoryboardShot,
}: { 
  selectedNode: Node<CustomNodeData> | null;
  onClose: () => void;
  onUpdateNode: (id: string, data: Partial<CustomNodeData>) => void;
  isGenerating: boolean;
  batchGenerateStoryboardImages: (storyboardNodeId: string) => Promise<void>;
  generateSingleStoryboardImage: (storyboardNodeId: string, storyboardIndex: number) => Promise<void>;
  generateVideoFromImage: (imageNodeId: string) => Promise<void>;
  generateAudio: (audioNodeId: string) => Promise<void>;
  composeFinalVideo: () => Promise<void>;
  batchGenerateStoryboardVideos: (storyboardNodeId: string) => Promise<void>;
  regenerateImage: (imageNodeId: string) => Promise<void>;
  regenerateVideoFromNode: (videoNodeId: string) => Promise<void>;
  selectedStoryboards: Set<string>;
  setSelectedStoryboards: (value: Set<string>) => void;
  canWriteBackProductionAsset: boolean;
  canvasSaveInfo: {
    status: 'idle' | 'saving' | 'saved' | 'error';
    message?: string;
  };
  onSaveProductionAsset: () => Promise<void>;
  onSaveStoryboardShot: (shotId: string) => Promise<void>;
}) => {
  const [panelOpen, setPanelOpen] = useState(true);

  if (!selectedNode) return null;

  // 多图上传处理函数
  const handleCharacterUpload = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const currentUploads: string[] = (selectedNode.data as any).characterUploads || [];
    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const newUploads = [...currentUploads, base64];
        onUpdateNode(selectedNode.id, { characterUploads: newUploads } as any);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSceneUpload = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const currentUploads: string[] = (selectedNode.data as any).sceneUploads || [];
    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const newUploads = [...currentUploads, base64];
        onUpdateNode(selectedNode.id, { sceneUploads: newUploads } as any);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeCharacterUpload = (index: number) => {
    const currentUploads: string[] = ((selectedNode.data as any).characterUploads || []) as string[];
    onUpdateNode(selectedNode.id, { characterUploads: currentUploads.filter((_: string, i: number) => i !== index) } as any);
  };

  const removeSceneUpload = (index: number) => {
    const currentUploads: string[] = ((selectedNode.data as any).sceneUploads || []) as string[];
    onUpdateNode(selectedNode.id, { sceneUploads: currentUploads.filter((_: string, i: number) => i !== index) } as any);
  };

  const colors = nodeColors[selectedNode.type as NodeType];
  const selectedProductionKind = String(selectedNode.data.productionAssetKind || selectedNode.data.assetKind || '');
  const isProductionVideoAsset = selectedNode.type === 'video' && Boolean(selectedProductionKind);
  const selectedVideoUrl = selectedNode.data.generatedVideo || selectedNode.data.videoUrl;
  const selectedVideoTaskId = selectedNode.data.productionTaskId || selectedNode.data.taskId;
  const selectedVideoCanExport = selectedProductionKind === 'finalVideo' || selectedProductionKind === 'deliverable';

  const sectionProps = {
    selectedNode,
    onUpdateNode,
    isGenerating,
    batchGenerateStoryboardImages,
    generateSingleStoryboardImage,
    generateVideoFromImage,
    generateAudio,
    composeFinalVideo,
    batchGenerateStoryboardVideos,
    regenerateImage,
    regenerateVideoFromNode,
    selectedStoryboards,
    setSelectedStoryboards,
    canWriteBackProductionAsset,
    canvasSaveInfo,
    onSaveStoryboardShot,
    handleCharacterUpload,
    handleSceneUpload,
    removeCharacterUpload,
    removeSceneUpload,
    selectedProductionKind,
    isProductionVideoAsset,
    selectedVideoUrl,
    selectedVideoTaskId,
    selectedVideoCanExport,
  };

  return (
    <div className={`absolute top-4 right-4 z-40 transition-all duration-300 ${panelOpen ? 'w-80' : 'w-12'}`}>
      {panelOpen ? (
        <div className="bg-card/90 backdrop-blur-xl rounded-xl border border-border shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded" style={{ background: `${colors.primary}/20` }}>
                <span style={{ color: colors.accent }}>{nodeIcons[selectedNode.type as NodeType]}</span>
              </div>
              <h3 className="font-semibold text-foreground">{nodeLabels[selectedNode.type as NodeType]} 属性</h3>
            </div>
            <div className="flex items-center gap-1">
              {canWriteBackProductionAsset && (
                <Button
                  data-testid="production-asset-panel-writeback"
                  variant="ghost"
                  size="sm"
                  onClick={onSaveProductionAsset}
                  disabled={canvasSaveInfo.status === 'saving'}
                  className="h-8 border border-emerald-300/20 bg-emerald-400/10 px-2 text-[11px] text-emerald-100 hover:bg-emerald-300/20"
                >
                  {canvasSaveInfo.status === 'saving' ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3 w-3" />
                  )}
                  写回
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPanelOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
            {canWriteBackProductionAsset && (
              <div className={`rounded-lg border px-3 py-2 text-xs ${
                canvasSaveInfo.status === 'error'
                  ? 'border-amber-300/25 bg-amber-400/10 text-amber-100'
                  : canvasSaveInfo.status === 'saved'
                    ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
                    : 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100'
              }`}>
                {canvasSaveInfo.message || '该节点来自真实 productionProject，修改后可写回项目资产。'}
              </div>
            )}
            {selectedNode.type === 'quality' && (
              <div
                data-testid="story-readability-detail"
                className={`rounded-lg border p-3 text-xs ${
                  selectedNode.data.pass
                    ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-50'
                    : 'border-amber-300/25 bg-amber-400/10 text-amber-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">故事可读性门禁</p>
                    <p className="mt-1 text-[11px] opacity-70">
                      真实生成前先检查观众能否看出主角、目标、危险、动作结果和段落衔接。
                    </p>
                  </div>
                  <div className="rounded-md border border-white/15 px-2 py-1 text-right">
                    <div className="text-lg font-semibold">{String(selectedNode.data.score ?? '?')}</div>
                    <div className="text-[10px] opacity-70">阈值 {String(selectedNode.data.threshold ?? 80)}</div>
                  </div>
                </div>

                {Array.isArray(selectedNode.data.issues) && selectedNode.data.issues.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {selectedNode.data.issues.map((issue: any, index: number) => (
                      <div key={`${issue.code || 'issue'}-${index}`} className="rounded-md border border-white/10 bg-black/20 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{issue.code || 'issue'}</span>
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] opacity-75">
                            {issue.severity === 'blocker' ? '阻断' : '提醒'}
                          </span>
                        </div>
                        <p className="mt-1 leading-relaxed opacity-80">{issue.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-md border border-emerald-300/20 bg-black/20 p-2 text-emerald-50/80">
                    当前脚本结构已通过门禁，可以进入真实视频生成前检查。
                  </div>
                )}

                {Array.isArray(selectedNode.data.nextActions) && selectedNode.data.nextActions.length > 0 && (
                  <div className="mt-3">
                    <p className="font-medium">下一步</p>
                    <ul className="mt-2 space-y-1">
                      {selectedNode.data.nextActions.slice(0, 4).map((action: string, index: number) => (
                        <li key={`${action}-${index}`} className="leading-relaxed opacity-80">
                          {index + 1}. {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {selectedNode.type === 'script' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground/80 mb-1.5 block">剧本内容</label>
                  <textarea
                    value={selectedNode.data.prompt || ''}
                    onChange={(e) => onUpdateNode(selectedNode.id, { prompt: e.target.value })}
                    className="w-full min-h-[150px] bg-muted border border-border rounded-md p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-300/30 resize-none"
                    placeholder="输入剧情梗概..."
                  />
                </div>
              </div>
            )}
            
              <StoryboardPropertiesSection {...sectionProps} />
              <VisualPropertiesSections {...sectionProps} />
              <CharacterScenePropertiesSections {...sectionProps} />
              <MediaPropertiesSections {...sectionProps} />
            {/* 最终合成视频按钮 */}
            <div className="pt-4 mt-2 border-t border-border">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-sky-300 animate-pulse"></div>
                  <span className="text-xs font-medium text-foreground/80">AI工作流</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={composeFinalVideo}
                  disabled={isGenerating}
                  className="w-full text-sm bg-gradient-to-r from-cyan-400 to-sky-300 text-black hover:from-cyan-300 hover:to-sky-200 font-medium"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  {isGenerating ? '合成中...' : '合成最终视频'}
                </Button>
                <p className="text-[10px] text-foreground/40">
                  将所有视频、音频素材合成最终完整视频
                </p>
              </div>
            </div>
            
            <div className="pt-2 border-t border-border">
              <div className="text-xs text-foreground/40 space-y-1">
                <p>节点 ID: {selectedNode.id}</p>
                <p>类型: {selectedNode.type}</p>
                <p>状态: {selectedNode.data.status || 'idle'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPanelOpen(true)}
          className="w-12 h-12 bg-card/85 backdrop-blur-xl border border-border hover:bg-card/90"
        >
          <ChevronLeft className="w-5 h-5 text-foreground/70" />
        </Button>
      )}
    </div>
  );
};
