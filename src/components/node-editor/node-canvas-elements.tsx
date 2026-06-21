'use client';

import { useState } from 'react';
import type React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import {
  Loader2,
  MousePointer2,
  Redo2,
  Trash2,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NodeActionStrip } from '@/components/node-editor/node-action-strip';
import { type CustomNodeData, type NodeType, nodeColors, nodeIcons, nodeLabels } from '@/components/node-editor/node-editor-shared';

// 剧本节点组件
const ScriptNode = ({ id, data, selected }: NodeProps<CustomNodeData>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.prompt || '');
  const colors = nodeColors[data.type as NodeType];

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditValue(data.prompt || '');
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (data.onUpdate) {
      data.onUpdate({ ...data, prompt: editValue });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(data.prompt || '');
    }
  };

  return (
    <div 
      className={`bg-gradient-to-br ${colors.bg} border rounded-lg shadow-xl backdrop-blur-md min-w-[220px] max-w-[260px] transition-all duration-200 ${
        selected ? 'border-cyan-300 ring-2 ring-cyan-300/25 scale-[1.02]' : 'border-border'
      }`}
      onDoubleClick={handleDoubleClick}
    >
      <Handle type="source" position={Position.Right} className="w-3 h-3" style={{ background: colors.primary }} />
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded" style={{ background: `${colors.primary}/20` }}>
            <span style={{ color: colors.accent }}>{nodeIcons[data.type as NodeType]}</span>
          </div>
          <span className="text-sm font-bold" style={{ color: colors.accent }}>{nodeLabels[data.type as NodeType]}</span>
          {data.status === 'success' && (
            <span className="ml-auto text-xs text-green-500 flex items-center gap-1">
              ✓ 就绪
            </span>
          )}
        </div>
        {isEditing ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full min-h-[100px] bg-muted border rounded-md p-3 text-sm text-foreground focus:outline-none focus:ring-2 resize-none"
            style={{ borderColor: `${colors.primary}/50`, boxShadow: selected ? `0 0 0 2px ${colors.primary}/30` : undefined }}
            placeholder="输入剧情梗概..."
            autoFocus
          />
        ) : (
          <div className="text-sm text-foreground/80">
            {data.prompt ? (
              <p className="line-clamp-2 whitespace-pre-wrap leading-relaxed">{data.prompt}</p>
            ) : (
              <p className="text-foreground/40 italic">双击输入剧情梗概...</p>
            )}
          </div>
        )}
        <NodeActionStrip id={id} data={data} />
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3" style={{ background: colors.primary }} />
      <Handle type="target" position={Position.Left} className="w-3 h-3" style={{ background: colors.primary }} />
    </div>
  );
};

// 分镜节点组件
const StoryboardNode = ({ id, data, selected }: NodeProps<CustomNodeData>) => {
  const colors = nodeColors[data.type as NodeType];

  return (
    <div 
      className={`bg-gradient-to-br ${colors.bg} border rounded-lg shadow-xl backdrop-blur-md min-w-[220px] max-w-[260px] transition-all duration-200 ${
        selected ? 'border-cyan-300 ring-2 ring-cyan-300/25 scale-[1.02]' : 'border-border'
      }`}
    >
      <Handle type="source" position={Position.Right} className="w-3 h-3" style={{ background: colors.primary }} />
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded" style={{ background: `${colors.primary}/20` }}>
            <span style={{ color: colors.accent }}>{nodeIcons[data.type as NodeType]}</span>
          </div>
          <span className="text-sm font-bold" style={{ color: colors.accent }}>{nodeLabels[data.type as NodeType]}</span>
          {data.status === 'loading' && (
            <span className="ml-auto text-xs text-cyan-300 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              生成中...
            </span>
          )}
          {data.status === 'success' && (
            <span className="ml-auto text-xs text-green-500 flex items-center gap-1">
              ✓ 已生成
            </span>
          )}
        </div>
        {/* 进度条显示 */}
        {data.status === 'loading' && data.progress && (
          <div className="mb-3">
            <div className="bg-cyan-400/10 rounded-lg p-2 border border-cyan-300/20 mb-2">
              <p className="text-xs text-cyan-300">{data.progress}</p>
            </div>
            {/* 进度条 */}
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-cyan-400 to-sky-300 h-full rounded-full transition-all duration-300"
                style={{ 
                  width: (() => {
                    const match = data.progress.match(/(\d+)\/(\d+)/);
                    if (match) {
                      const current = parseInt(match[1]);
                      const total = parseInt(match[2]);
                      return `${(current / total) * 100}%`;
                    }
                    return '50%';
                  })()
                }}
              />
            </div>
          </div>
        )}
        
        <div className="text-sm text-foreground/80">
          {data.storyboard && data.storyboard.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-200">
                  {data.storyboard.length} 镜头
                </span>
                {data.totalDuration ? (
                  <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200">
                    {data.totalDuration}s
                  </span>
                ) : null}
              </div>
              <p className="line-clamp-2 text-xs leading-relaxed text-foreground/65">
                {data.storyboard.slice(0, 2).map((sb, idx) => `${idx + 1}. ${sb.description}`).join(' / ')}
              </p>
            </div>
          ) : data.prompt ? (
            <p className="line-clamp-2">{data.prompt}</p>
          ) : (
            <p className="text-foreground/40 italic">连接剧本节点后点击执行...</p>
          )}
        </div>
        <NodeActionStrip id={id} data={data} />
      </div>
      <Handle type="target" position={Position.Left} className="w-3 h-3" style={{ background: colors.primary }} />
    </div>
  );
};

// Agent节点组件
const AgentNode = ({ id, data, selected }: NodeProps<CustomNodeData>) => {
  const colors = nodeColors[data.type as NodeType];

  return (
    <div 
      className={`bg-gradient-to-br ${colors.bg} border rounded-lg shadow-xl backdrop-blur-md min-w-[230px] max-w-[260px] transition-all duration-200 ${
        selected ? 'border-cyan-300 ring-2 ring-cyan-300/25 scale-[1.02]' : 'border-border'
      }`}
    >
      <Handle type="source" position={Position.Right} className="w-3 h-3" style={{ background: colors.primary }} />
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded" style={{ background: `${colors.primary}/20` }}>
            <span style={{ color: colors.accent }}>{nodeIcons[data.type as NodeType]}</span>
          </div>
          <span className="text-sm font-bold" style={{ color: colors.accent }}>{nodeLabels[data.type as NodeType]}</span>
          {data.status === 'loading' && (
            <span className="ml-auto text-xs text-cyan-300 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              转换中...
            </span>
          )}
          {data.status === 'success' && (
            <span className="ml-auto text-xs text-green-500 flex items-center gap-1">
              ✓ 已完成
            </span>
          )}
        </div>
        <div className="text-sm text-foreground/80 space-y-2">
          {data.status === 'loading' && data.progress && (
            <div className="bg-cyan-400/10 rounded-lg p-2 border border-cyan-300/20">
              <p className="text-xs text-cyan-300">{data.progress}</p>
            </div>
          )}
          
          {data.result ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[11px] text-violet-200">
                  导演链 artifact
                </span>
                {data.targetDuration && (
                  <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-200">
                    {data.targetDuration}s
                  </span>
                )}
              </div>
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {data.prompt || '已生成镜头拆分、角色/场景设定和连续性约束，详情在右侧面板查看。'}
              </p>
            </div>
          ) : (
            <p className="text-foreground/40 italic">连接剧本节点后点击执行...</p>
          )}
        </div>
        <NodeActionStrip id={id} data={data} />
      </div>
      <Handle type="target" position={Position.Left} className="w-3 h-3" style={{ background: colors.primary }} />
    </div>
  );
};

// 通用节点组件
const GenericNode = ({ id, data, selected }: NodeProps<CustomNodeData>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.prompt || '');
  const colors = nodeColors[data.type as NodeType];
  const nodeType = data.type as NodeType;

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditValue(data.prompt || '');
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (data.onUpdate && editValue !== data.prompt) {
      data.onUpdate({ ...data, prompt: editValue });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(data.prompt || '');
    }
  };

  // 渲染媒体预览（图片或视频）
  const renderMediaPreview = () => {
    // 视频节点预览
    if (nodeType === 'video' && data.generatedVideo) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden border border-border bg-card">
          <video
            src={data.generatedVideo}
            controls
            playsInline
            preload="metadata"
            className="w-full h-auto max-h-24"
          >
            您的浏览器不支持视频播放。
          </video>
        </div>
      );
    }
    
    // 图片节点预览
    if (nodeType === 'image' && data.generatedImage) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden border border-border bg-card">
          <img
            src={data.generatedImage}
            alt="生成的图片"
            className="w-full h-auto max-h-24 object-cover"
          />
        </div>
      );
    }
    
    // 人物节点预览
    if (nodeType === 'character' && data.generatedImage) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden border border-border bg-card">
          <img
            src={data.generatedImage}
            alt={data.characterName || '人物形象'}
            className="w-full h-auto max-h-24 object-cover"
          />
        </div>
      );
    }
    
    // 场景节点预览
    if (nodeType === 'scene' && data.generatedImage) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden border border-border bg-card">
          <img
            src={data.generatedImage}
            alt={data.sceneName || '场景图片'}
            className="w-full h-auto max-h-24 object-cover"
          />
        </div>
      );
    }
    
    return null;
  };

  return (
    <div 
      className={`bg-gradient-to-br ${colors.bg} border rounded-lg shadow-xl backdrop-blur-md min-w-[190px] max-w-[250px] transition-all duration-200 ${
        selected ? 'border-cyan-300 ring-2 ring-cyan-300/25 scale-[1.02]' : 'border-border'
      }`}
      onDoubleClick={handleDoubleClick}
    >
      <Handle type="source" position={Position.Right} className="w-3 h-3" style={{ background: colors.primary }} />
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded" style={{ background: `${colors.primary}/20` }}>
            <span style={{ color: colors.accent }}>{nodeIcons[nodeType]}</span>
          </div>
          <span className="text-sm font-bold" style={{ color: colors.accent }}>{nodeLabels[nodeType]}</span>
          {data.status === 'success' && (
            <span className="ml-auto text-xs text-green-500 flex items-center gap-1">
              ✓ 就绪
            </span>
          )}
        </div>
        
        {/* 进度条显示 */}
        {data.status === 'loading' && data.progress && (
          <div className="mb-3">
            <div className="bg-cyan-400/10 rounded-lg p-2 border border-cyan-300/20 mb-2">
              <p className="text-xs text-cyan-300">{data.progress}</p>
            </div>
            {/* 进度条 */}
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-cyan-400 to-sky-300 h-full rounded-full transition-all duration-300"
                style={{ 
                  width: (() => {
                    const match = data.progress.match(/(\d+)\/(\d+)/);
                    if (match) {
                      const current = parseInt(match[1]);
                      const total = parseInt(match[2]);
                      return `${(current / total) * 100}%`;
                    }
                    return '50%';
                  })()
                }}
              />
            </div>
          </div>
        )}
        
        {/* 媒体预览 */}
        {renderMediaPreview()}

        {nodeType === 'quality' && (
          <div className={`mt-2 rounded-lg border px-2 py-1.5 text-xs ${
            data.pass
              ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
              : 'border-amber-300/25 bg-amber-400/10 text-amber-100'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span>故事可读性</span>
              <span className="font-semibold">{String(data.score ?? '?')} / {String(data.threshold ?? 80)}</span>
            </div>
            {Array.isArray(data.issues) && data.issues.length > 0 && (
              <p className="mt-1 line-clamp-2 text-[11px] opacity-80">
                {data.issues.slice(0, 2).map((issue: any) => issue.message || issue.code).join(' / ')}
              </p>
            )}
          </div>
        )}
        
        {isEditing ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full min-h-[60px] bg-muted border rounded-md p-2 text-sm text-foreground focus:outline-none focus:ring-2 resize-none mt-2"
            style={{ borderColor: `${colors.primary}/50`, boxShadow: selected ? `0 0 0 2px ${colors.primary}/30` : undefined }}
            placeholder="输入提示词..."
            autoFocus
          />
        ) : (
          <div className="text-sm text-foreground/80 mt-2">
            {data.prompt ? (
              <p className="line-clamp-2 whitespace-pre-wrap">{data.prompt}</p>
            ) : data.status === 'success' ? (
              <p className="text-green-500 flex items-center gap-1.5">
                ✓ 已生成
              </p>
            ) : data.status === 'loading' ? (
              <p className="text-cyan-300 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                生成中...
              </p>
            ) : (
              <p className="text-foreground/40 italic">双击编辑提示词...</p>
            )}
          </div>
        )}
        <NodeActionStrip id={id} data={data} />
      </div>
      <Handle type="target" position={Position.Left} className="w-3 h-3" style={{ background: colors.primary }} />
    </div>
  );
};

// 节点类型配置
export const nodeTypes = {
  script: ScriptNode,
  storyboard: StoryboardNode,
  image: GenericNode,
  video: GenericNode,
  audio: GenericNode,
  camera: GenericNode,
  character: GenericNode,
  scene: GenericNode,
  agent: AgentNode,
  quality: GenericNode,
};


// 工具栏组件
export const Toolbar = ({ 
  onAddNode, 
  selectedNodeId, 
  onDeleteNode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  helpPanelVisible,
  onToggleHelpPanel,
  onQuickCreateCharacter,
  onQuickCreateScene,
}: { 
  onAddNode: (type: NodeType) => void;
  selectedNodeId: string | null;
  onDeleteNode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  helpPanelVisible: boolean;
  onToggleHelpPanel: () => void;
  onQuickCreateCharacter: () => void;
  onQuickCreateScene: () => void;
}) => {
  const nodeTemplates: { type: NodeType; label: string; color: string }[] = [
    { type: 'script', label: '剧本', color: 'purple' },
    { type: 'storyboard', label: '分镜', color: 'blue' },
    { type: 'agent', label: 'Agent', color: 'violet' },
    { type: 'image', label: '图片', color: 'green' },
    { type: 'video', label: '视频', color: 'orange' },
    { type: 'audio', label: '音频', color: 'pink' },
    { type: 'camera', label: '摄像机', color: 'cyan' },
    { type: 'character', label: '人物', color: 'yellow' },
    { type: 'scene', label: '场景', color: 'teal' },
  ];

  return (
    <div className="absolute top-24 left-4 z-30 flex flex-wrap gap-2 p-3 bg-card/85 backdrop-blur-xl rounded-xl border border-border shadow-2xl">
      <div className="flex items-center gap-1 pr-3 border-r border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          className="text-foreground/70 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRedo}
          disabled={!canRedo}
          className="text-foreground/70 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Redo2 className="w-4 h-4" />
        </Button>
      </div>
      
      {nodeTemplates.map((template) => (
        <Button
          key={template.type}
          variant="ghost"
          size="sm"
          onClick={() => onAddNode(template.type)}
          className="text-foreground/80 hover:text-foreground hover:bg-accent"
        >
          <span className="mr-1.5">{nodeIcons[template.type]}</span>
          {template.label}
        </Button>
      ))}
      
      <div className="w-px h-8 bg-accent/50" />
      
      {selectedNodeId && (
        <>
          <div className="w-px h-8 bg-accent/50" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteNode}
            className="text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            删除
          </Button>
        </>
      )}
      
      <div className="w-px h-8 bg-accent/50" />
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleHelpPanel}
        className={`${helpPanelVisible ? 'text-cyan-300' : 'text-muted-foreground'} hover:text-foreground`}
      >
        {helpPanelVisible ? (
          <MousePointer2 className="w-4 h-4 mr-1.5" />
        ) : (
          <MousePointer2 className="w-4 h-4 mr-1.5" />
        )}
        {helpPanelVisible ? '隐藏帮助' : '显示帮助'}
      </Button>
    </div>
  );
};

