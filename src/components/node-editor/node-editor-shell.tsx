'use client';

import {
  Film,
  FolderOpen,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  MousePointer2,
  Play,
  Plus,
  Save,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NodeType } from '@/components/node-editor/node-editor-shared';

type ProductionCanvasInfo = {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  taskId?: string;
  productionProjectId?: string;
  nodeCount?: number;
  edgeCount?: number;
  message?: string;
};

type CanvasSaveInfo = {
  status: 'idle' | 'saving' | 'saved' | 'error';
  message?: string;
};

export function NodeEditorTopBar({
  productionCanvasInfo,
  canvasSaveInfo,
  canWriteBackProductionAsset,
  isGenerating,
  onBack,
  saveSelectedProductionAsset,
  handleCancelExecution,
  handleExecuteWorkflow,
  saveWorkflow,
  loadWorkflow,
  exportFinalVideo,
}: {
  productionCanvasInfo: ProductionCanvasInfo;
  canvasSaveInfo: CanvasSaveInfo;
  canWriteBackProductionAsset: boolean;
  isGenerating: boolean;
  onBack: () => void;
  saveSelectedProductionAsset: () => void | Promise<void>;
  handleCancelExecution: () => void;
  handleExecuteWorkflow: () => void | Promise<void>;
  saveWorkflow: () => void;
  loadWorkflow: () => void;
  exportFinalVideo: () => void | Promise<void>;
}) {
  return (
    <>
      {/* 顶部标题栏 */}
      <div className="absolute top-0 left-0 right-0 z-40 bg-[#070b12]/95 backdrop-blur-xl p-4 border-b border-white/10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground hover:bg-accent">
              <ChevronLeft className="w-4 h-4 mr-1" />返回
            </Button>
            <div className="w-px h-6 bg-border" />
          <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">节点式视频编辑器</h1>
              <p className="text-sm text-muted-foreground">
                {productionCanvasInfo.status === 'loaded'
                  ? `真实制作画布 · task ${productionCanvasInfo.taskId} · ${productionCanvasInfo.nodeCount} 节点`
                  : '无限画布 · 节点连接 · 全链路制作'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {productionCanvasInfo.status === 'loading' && (
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                <Loader2 className="h-3 w-3 animate-spin" /> 加载制作画布
              </span>
            )}
            {canvasSaveInfo.status !== 'idle' && (
              <span className={`max-w-[280px] truncate rounded-full border px-3 py-1 text-xs ${
                canvasSaveInfo.status === 'error'
                  ? 'border-amber-400/20 bg-amber-500/10 text-amber-200'
                  : canvasSaveInfo.status === 'saved'
                    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                    : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
              }`}>
                {canvasSaveInfo.status === 'saving' && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
                {canvasSaveInfo.message}
              </span>
            )}
            {productionCanvasInfo.status === 'error' && (
              <span className="max-w-[320px] truncate rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                {productionCanvasInfo.message}
              </span>
            )}
            {canWriteBackProductionAsset && (
              <Button
                variant="ghost"
                size="sm"
                onClick={saveSelectedProductionAsset}
                disabled={canvasSaveInfo.status === 'saving'}
                className="text-emerald-200 hover:text-emerald-100 hover:bg-emerald-400/10 border border-emerald-300/20"
              >
                {canvasSaveInfo.status === 'saving' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                写回项目
              </Button>
            )}
            {isGenerating ? (
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleCancelExecution}
                className="border border-amber-300/25 bg-amber-400/10 text-amber-100 hover:bg-amber-300/20 font-semibold shadow-lg shadow-amber-500/10"
              >
                <X className="w-4 h-4 mr-2" />
                取消
              </Button>
            ) : (
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleExecuteWorkflow}
                className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold shadow-lg shadow-cyan-400/20"
              >
                <Play className="w-4 h-4 mr-2" />
                执行
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={saveWorkflow}
              className="text-foreground/70 hover:text-foreground hover:bg-accent border border-border"
            >
              <Save className="w-4 h-4 mr-2" />
              保存
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={loadWorkflow}
              className="text-foreground/70 hover:text-foreground hover:bg-accent border border-border"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              加载
            </Button>
            <div className="w-px h-8 bg-border" />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={exportFinalVideo}
              disabled={isGenerating}
              className="text-amber-300 hover:text-amber-200 hover:bg-amber-400/10 border border-amber-300/20"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Film className="w-4 h-4 mr-2" />
              )}
              {isGenerating ? '导出中...' : '导出视频'}
            </Button>
          </div>
        </div>
      </div>


    </>
  );
}

export function NodeEditorHelpPanel({
  helpPanelVisible,
  helpPanelPinned,
  setHelpPanelPinned,
  handleAddNode,
  importFromVideoForm,
  importFromProductionProject,
}: {
  helpPanelVisible: boolean;
  helpPanelPinned: boolean;
  setHelpPanelPinned: (value: boolean) => void;
  handleAddNode: (type: NodeType) => void;
  importFromVideoForm: () => void;
  importFromProductionProject: () => void | Promise<void>;
}) {
  return (
    <>
      {/* 左下角快捷操作面板      {/* 左下角快捷操作面板 - 独立定位，不受画布缩放影响 */}
      {helpPanelVisible && (
        <div className="absolute left-4 transition-all duration-300" style={{ zIndex: 40, bottom: '100px' }}>
        <div className={`bg-card/95 backdrop-blur-2xl rounded-xl border border-border shadow-2xl transition-all duration-300 origin-bottom-left ${helpPanelPinned ? 'p-4 max-w-sm' : 'p-2 max-w-[180px]'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`rounded-md bg-cyan-400/10 ${helpPanelPinned ? 'p-1.5' : 'p-1'}`}>
                <MousePointer2 className={`${helpPanelPinned ? 'w-4 h-4' : 'w-3 h-3'} text-cyan-300`} />
              </div>
              {helpPanelPinned && <h3 className="text-sm font-semibold text-foreground">快捷操作</h3>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHelpPanelPinned(!helpPanelPinned)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              {helpPanelPinned ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>

          <div className={`space-y-2 transition-all duration-300 overflow-hidden ${helpPanelPinned ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
              <div className="mt-0.5 p-1 rounded bg-accent/50">
                <MousePointer2 className="w-3.5 h-3.5 text-foreground/70" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">选择节点</p>
                <p className="text-xs text-muted-foreground">点击节点选中，点击画布空白处取消</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
              <div className="mt-0.5 p-1 rounded bg-accent/50">
                <Plus className="w-3.5 h-3.5 text-foreground/70" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">添加节点</p>
                <p className="text-xs text-muted-foreground">使用顶部工具栏添加各种类型节点</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
              <div className="mt-0.5 p-1 rounded bg-accent/50">
                <Layers className="w-3.5 h-3.5 text-foreground/70" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">连接节点</p>
                <p className="text-xs text-muted-foreground">从节点右侧连接点拖拽到另一个节点左侧</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
              <div className="mt-0.5 p-1 rounded bg-accent/50">
                <Type className="w-3.5 h-3.5 text-foreground/70" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">编辑内容</p>
                <p className="text-xs text-muted-foreground">双击任意节点可以直接编辑内容</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
              <div className="mt-0.5 p-1 rounded bg-accent/50">
                <Trash2 className="w-3.5 h-3.5 text-foreground/70" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">删除节点</p>
                <p className="text-xs text-muted-foreground">选中节点后按 Delete 或 Backspace 键删除</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
              <div className="mt-0.5 p-1 rounded bg-accent/50">
                <Undo2 className="w-3.5 h-3.5 text-foreground/70" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">撤销/重做</p>
                <p className="text-xs text-muted-foreground">Ctrl+Z 撤销，Ctrl+Shift+Z 或 Ctrl+Y 重做</p>
              </div>
            </div>
          </div>
          
          <div className={`mt-4 pt-4 border-t border-border space-y-2 transition-all duration-300 overflow-hidden ${helpPanelPinned ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0 mt-0 pt-0 border-t-0'}`}>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => handleAddNode('script')}
              className="w-full text-sm text-foreground/80 hover:text-foreground hover:bg-accent justify-start gap-2"
            >
              <Type className="w-4 h-4" />
              添加文本节点
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={importFromVideoForm}
              className="w-full text-sm text-foreground/80 hover:text-foreground hover:bg-accent justify-start gap-2"
            >
              <Layers className="w-4 h-4" />
              从视频生成导入
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => importFromProductionProject()}
              className="w-full text-sm text-foreground/80 hover:text-foreground hover:bg-accent justify-start gap-2"
            >
              <Upload className="w-4 h-4" />
              从绘影项目导入
            </Button>
          </div>
        </div>
      </div>
      )}


    </>
  );
}
