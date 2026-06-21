'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  Node,
  Edge,
  Connection,
  Panel,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { useTasks } from '@/contexts/TaskContext';
import { nodeTypes, Toolbar } from '@/components/node-editor/node-canvas-elements';
import { NodeEditorHelpPanel, NodeEditorTopBar } from '@/components/node-editor/node-editor-shell';
import { PropertiesPanel } from '@/components/node-editor/node-properties-panel';
import {
  Plus,
  Play,
  Save,
  Loader2,
  FolderOpen,
  Layers,
  Trash2,
  Settings,
  Film,
  Image as ImageIcon,
  Type,
  Mic,
  Camera,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Undo2,
  Redo2,
  MousePointer2,
  X,
  ChevronRight,
  ChevronLeft,
  Video,
  Sparkles,
  Users,
  User,
  Map,
  MapPin,
  FileText,
  Copy,
  Download,
  RefreshCw,
  Upload,
  CheckSquare,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

import { type CustomNodeData, type NodeType, nodeColors, nodeIcons, nodeLabels } from '@/components/node-editor/node-editor-shared';
import { extractCharacterNames, extractSceneNames, generateCharacterDescription, generateSceneDescription } from '@/lib/node-editor-script-helpers';
import { useNodeEditorJimengExecute } from '@/hooks/useNodeEditorJimengExecute';
import { useProductionCanvasBridge } from '@/hooks/useProductionCanvasBridge';
import { useNodeEditorGenerationActions } from '@/hooks/useNodeEditorGenerationActions';
import { useNodeEditorCanvasActions } from '@/hooks/useNodeEditorCanvasActions';

// 历史记录接口
interface HistoryState {
  nodes: Node<CustomNodeData>[];
  edges: Edge[];
}

// 初始节点
const initialNodes: Node<CustomNodeData>[] = [];

// 初始边（空白幕布，无默认连接）
const initialEdges: Edge[] = [];

// 主编辑器组件
function NodeEditor() {
  const router = useRouter();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shouldCancel, setShouldCancel] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [helpPanelPinned, setHelpPanelPinned] = useState(false); // 默认缩小
  const [helpPanelVisible, setHelpPanelVisible] = useState(false);
  const [selectedStoryboards, setSelectedStoryboards] = useState<Set<string>>(new Set());
  
  // 使用TaskContext
  const { tasks, updateTask } = useTasks();
  

  
  // 历史记录
  const [history, setHistory] = useState<HistoryState[]>([{ nodes: initialNodes, edges: initialEdges }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // 保存到历史记录
  const saveToHistory = useCallback((newNodes: Node<CustomNodeData>[], newEdges: Edge[]) => {
    const newHistoryState: HistoryState = { nodes: newNodes, edges: newEdges };
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newHistoryState);
      return newHistory.slice(-50); // 只保留最近50条记录
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // 撤销
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      setNodes(state.nodes);
      setEdges(state.edges);
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  // 重做
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      setNodes(state.nodes);
      setEdges(state.edges);
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  // 处理节点变化时保存历史
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      // 只在节点真正改变时保存历史（不是选择变化）
      const hasRealChange = changes.some((change: any) => change.type !== 'select');
      if (hasRealChange) {
        setTimeout(() => {
          setNodes((currentNodes) => {
            setEdges((currentEdges) => {
              saveToHistory(currentNodes, currentEdges);
              return currentEdges;
            });
            return currentNodes;
          });
        }, 0);
      }
    },
    [onNodesChange, saveToHistory, setNodes, setEdges]
  );

  // 处理边变化时保存历史
  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
      // 只在边真正改变时保存历史
      const hasRealChange = changes.some((change: any) => change.type !== 'select');
      if (hasRealChange) {
        setTimeout(() => {
          setNodes((currentNodes) => {
            setEdges((currentEdges) => {
              saveToHistory(currentNodes, currentEdges);
              return currentEdges;
            });
            return currentNodes;
          });
        }, 0);
      }
    },
    [onEdgesChange, saveToHistory, setNodes, setEdges]
  );

  // 处理节点连接
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const newEdges = addEdge({ ...params, animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#fff' } }, eds);
        saveToHistory(nodes, newEdges);
        return newEdges;
      });
    },
    [setEdges, nodes, saveToHistory]
  );

  // 更新节点数据
  const updateNodeData = useCallback((nodeId: string, newData: Partial<CustomNodeData>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  }, [setNodes]);

  const {
    regenerateImage,
    regenerateVideoFromNode,
    generateStoryboard,
    batchGenerateStoryboardImages,
    generateSingleStoryboardImage,
    generateVideoFromImage,
    batchGenerateStoryboardVideos,
    generateAudio,
    composeFinalVideo,
  } = useNodeEditorGenerationActions({
    nodes,
    edges,
    shouldCancel,
    selectedStoryboards,
    setNodes,
    setEdges,
    setIsGenerating,
    updateNodeData,
  });

  const {
    handleAddNode,
    handleQuickCreateCharacter,
    handleQuickCreateScene,
    handleDeleteNode,
    onNodeClick,
    onPaneClick,
  } = useNodeEditorCanvasActions({
    nodes,
    edges,
    selectedNodeId,
    setSelectedNodeId,
    setNodes,
    setEdges,
    saveToHistory,
    updateNodeData,
    handleUndo,
    handleRedo,
  });

  // 取消执行
  const handleCancelExecution = useCallback(() => {
    console.log('[Workflow] 用户取消执行');
    setShouldCancel(true);
    setIsGenerating(false);
  }, []);

  const handleJimengExecute = useNodeEditorJimengExecute({
    nodes,
    setNodes,
    setEdges,
    shouldCancel,
    setIsGenerating,
    updateNodeData,
  });
  // 执行工作流
  const handleExecuteWorkflow = useCallback(async () => {
    console.log('[Workflow] 开始执行工作流');
    
    // 重置取消状态
    setShouldCancel(false);
    
    // 找到剧本节点
    const existingScriptNode = nodes.find((n) => n.type === 'script');
    
    if (!existingScriptNode) {
      alert('请先添加剧本节点并输入剧本内容');
      return;
    }
    
    if (!existingScriptNode.data.prompt || !existingScriptNode.data.prompt.trim()) {
      alert('请先在剧本节点中输入剧本内容');
      setSelectedNodeId(existingScriptNode.id);
      return;
    }
    
    // 检查是否取消
    if (shouldCancel) {
      console.log('[Workflow] 执行已取消');
      return;
    }
    
    // Agent优先 - 直接检查Agent节点
    const existingJimengNode = nodes.find((n) => n.type === 'agent');
    
    if (existingJimengNode) {
      // Agent已存在 - 直接执行
      console.log('[Workflow] 发现Agent节点，优先执行Agent转换');
      
      // 检查剧本节点和Agent节点是否有连接，如果没有则自动创建
      const hasJimengConnection = edges.some(
        (e) => e.source === existingScriptNode.id && e.target === existingJimengNode.id
      );
      
      if (!hasJimengConnection) {
        console.log('[Workflow] 自动创建剧本→Agent连接');
        
        // 创建连接
        setEdges((eds) => [...eds, {
          id: `e-${existingScriptNode.id}-${existingJimengNode.id}`,
          source: existingScriptNode.id,
          target: existingJimengNode.id,
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
        }]);
        
        // 等待一下确保连接添加成功
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      
      // 现在执行Agent转换（Agent包含完整六大模块）
      console.log('[Workflow] 开始执行Agent转换');
      const targetDuration = existingJimengNode.data.targetDuration || 120;
      await handleJimengExecute(existingScriptNode.id, existingJimengNode.id, targetDuration);
      
    } else {
      // 没有Agent节点时，自动创建Agent节点
      console.log('[Workflow] 未发现Agent节点，自动创建Agent节点');
      
      const newJimengNodeId = `agent_${Date.now()}`;
      
      // 计算Agent节点的位置 - 在剧本节点右侧
      const scriptPosition = existingScriptNode.position || { x: 100, y: 200 };
      
      const newJimengNode: Node<CustomNodeData> = {
        id: newJimengNodeId,
        type: 'agent',
        position: { 
          x: scriptPosition.x + 350, 
          y: scriptPosition.y 
        },
        data: { 
          label: 'Agent', 
          type: 'agent', 
          status: 'idle',
          targetDuration: 120,
        },
      };
      
      // 添加Agent节点
      setNodes((nds) => [...nds, newJimengNode]);
      
      // 自动创建剧本→Agent连接
      console.log('[Workflow] 自动创建剧本→Agent连接');
      setEdges((eds) => [...eds, {
        id: `e-${existingScriptNode.id}-${newJimengNodeId}`,
        source: existingScriptNode.id,
        target: newJimengNodeId,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
      }]);
      
      // 等待一下确保节点和连接添加成功
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      // 现在执行Agent转换
      console.log('[Workflow] 开始执行Agent转换');
      await handleJimengExecute(existingScriptNode.id, newJimengNodeId, 120);
    }
    
  }, [nodes, edges, handleJimengExecute, setNodes, setEdges, shouldCancel]);

  // 保存工作流到 localStorage
  const saveWorkflow = useCallback(() => {
    try {
      const workflowData = {
        nodes,
        edges,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('node-editor-workflow', JSON.stringify(workflowData));
      
      // 提取关键数据供视频生成表单使用
      const scriptNode = nodes.find(n => n.type === 'script');
      const storyboardNode = nodes.find(n => n.type === 'storyboard');
      
      const exportData = {
        prompt: scriptNode?.data.prompt || '',
        storyboard: storyboardNode?.data.storyboard || [],
        duration: storyboardNode?.data.storyboard?.reduce((acc, sb) => acc + sb.duration, 0) || 5,
      };
      localStorage.setItem('node-editor-export', JSON.stringify(exportData));
      
      alert('工作流已保存！');
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    }
  }, [nodes, edges]);

  // 从 localStorage 加载工作流
  const loadWorkflow = useCallback(() => {
    try {
      const saved = localStorage.getItem('node-editor-workflow');
      if (saved) {
        const workflowData = JSON.parse(saved);
        setNodes(workflowData.nodes);
        setEdges(workflowData.edges);
        saveToHistory(workflowData.nodes, workflowData.edges);
        alert('工作流已加载！');
      } else {
        alert('没有找到保存的工作流');
      }
    } catch (error) {
      console.error('加载失败:', error);
      alert('加载失败，请重试');
    }
  }, [setNodes, setEdges, saveToHistory]);

  // 从视频生成表单导入数据
  const importFromVideoForm = useCallback(() => {
    try {
      const saved = localStorage.getItem('video-form-export');
      if (saved) {
        const exportData = JSON.parse(saved);
        
        // 创建剧本节点
        const scriptNodeId = `node_${Date.now()}`;
        const scriptNode: Node<CustomNodeData> = {
          id: scriptNodeId,
          type: 'script',
          position: { x: 100, y: 200 },
          data: { 
            label: 'script', 
            type: 'script', 
            status: 'success',
            prompt: exportData.prompt || '',
            onUpdate: (data: CustomNodeData) => updateNodeData(scriptNodeId, data),
          },
        };
        
        // 创建分镜节点
        const storyboardNodeId = `node_${Date.now() + 1}`;
        const storyboardNode: Node<CustomNodeData> = {
          id: storyboardNodeId,
          type: 'storyboard',
          position: { x: 450, y: 200 },
          data: { 
            label: 'storyboard', 
            type: 'storyboard', 
            status: 'idle',
            onUpdate: (data: CustomNodeData) => updateNodeData(storyboardNodeId, data),
          },
        };
        
        // 创建连接
        const connection: Edge = {
          id: `e-${scriptNodeId}-${storyboardNodeId}`,
          source: scriptNodeId,
          target: storyboardNodeId,
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
        };
        
        const newNodes = [scriptNode, storyboardNode];
        const newEdges = [connection];
        
        setNodes(newNodes);
        setEdges(newEdges);
        saveToHistory(newNodes, newEdges);
        
        alert('已从视频生成表单导入数据！');
      } else {
        alert('没有找到视频生成表单的数据，请先在视频生成页面中导出');
      }
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败，请重试');
    }
  }, [setNodes, setEdges, updateNodeData, saveToHistory]);

  const {
    canvasSaveInfo,
    selectedNode,
    canWriteBackProductionAsset,
    importFromProductionProject,
    saveSelectedProductionAsset,
    saveStoryboardShot,
  } = useProductionCanvasBridge({
    nodes,
    selectedNodeId,
    setNodes,
    setEdges,
    saveToHistory,
    updateNodeData,
    reactFlowInstance,
    setIsGenerating,
  });

  return (
    <div className="w-full h-screen bg-[#05070d] relative overflow-hidden">
      {/* React Flow 画布 */}
      <div ref={reactFlowWrapper} className="w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={4}
          className="bg-[#05070d]"
          defaultEdgeOptions={{
            style: { stroke: '#31516f', strokeWidth: 2 },
            animated: true,
          }}
        >
          <Background className="!bg-[#05070d]" color="#164e63" gap={20} size={1} variant={BackgroundVariant.Dots} />
          <Panel position="bottom-center" className="mb-4 rounded-xl border border-cyan-300/15 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-300 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-cyan-200">制作泳道</span>
              <span className="text-slate-500">剧本</span>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <span className="text-slate-500">角色/场景/道具</span>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <span className="text-slate-500">导演链</span>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <span className="text-slate-500">分镜</span>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <span className="text-slate-500">片段</span>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <span className="text-amber-200">成片/导出</span>
            </div>
          </Panel>
          <Controls 
            className="bg-card/90 backdrop-blur-xl border-border text-foreground rounded-xl overflow-hidden shadow-2xl"
            position="bottom-right"
            style={{ zIndex: 60 }}
          />
          <MiniMap 
            className="bg-card/85 backdrop-blur-xl border-border rounded-xl overflow-hidden" 
            style={{ zIndex: 50 }}
            nodeStrokeColor={(n) => {
              const type = n.type as NodeType;
              return nodeColors[type]?.primary || '#666';
            }}
            nodeColor={(n) => {
              const type = n.type as NodeType;
              return `${nodeColors[type]?.secondary}40` || '#1f1f1f40';
            }}
            pannable
            zoomable
          />
        </ReactFlow>
        
        {/* 画布空白引导提示 */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 30 }}>
            <div className="text-center space-y-4 pointer-events-auto">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-400/15 flex items-center justify-center">
                <Type className="w-8 h-8 text-cyan-300" />
              </div>
              <h3 className="text-xl font-semibold text-foreground/90">开始创作</h3>
              <p className="text-sm text-muted-foreground max-w-xs">点击左下角「添加文本节点」开始创作，或从顶部工具栏添加各类节点</p>
              <Button 
                size="sm"
                onClick={() => handleAddNode('script')}
                className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 gap-2"
              >
                <Plus className="w-4 h-4" />
                添加第一个文本节点
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <NodeEditorHelpPanel
        helpPanelVisible={helpPanelVisible}
        helpPanelPinned={helpPanelPinned}
        setHelpPanelPinned={setHelpPanelPinned}
        handleAddNode={handleAddNode}
        importFromVideoForm={importFromVideoForm}
        importFromProductionProject={() => importFromProductionProject()}
      />

      {/* 工具栏 */}
      <Toolbar 
        onAddNode={handleAddNode}
        selectedNodeId={selectedNodeId}
        onDeleteNode={handleDeleteNode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        helpPanelVisible={helpPanelVisible}
        onToggleHelpPanel={() => setHelpPanelVisible(!helpPanelVisible)}
        onQuickCreateCharacter={handleQuickCreateCharacter}
        onQuickCreateScene={handleQuickCreateScene}
      />

      {/* 属性面板 */}
      <PropertiesPanel
        selectedNode={selectedNode}
        onClose={() => setSelectedNodeId(null)}
        onUpdateNode={updateNodeData}
        isGenerating={isGenerating}
        batchGenerateStoryboardImages={batchGenerateStoryboardImages}
        generateSingleStoryboardImage={generateSingleStoryboardImage}
        generateVideoFromImage={generateVideoFromImage}
        generateAudio={generateAudio}
        composeFinalVideo={composeFinalVideo}
        batchGenerateStoryboardVideos={batchGenerateStoryboardVideos}
        regenerateImage={regenerateImage}
        regenerateVideoFromNode={regenerateVideoFromNode}
        selectedStoryboards={selectedStoryboards}
        setSelectedStoryboards={setSelectedStoryboards}
        canWriteBackProductionAsset={canWriteBackProductionAsset}
        canvasSaveInfo={canvasSaveInfo}
        onSaveProductionAsset={saveSelectedProductionAsset}
        onSaveStoryboardShot={saveStoryboardShot}
      />
    </div>
  );
}

// 主页面组件
export default function NodeEditorPage() {
  return (
    <ReactFlowProvider>
      <NodeEditor />
    </ReactFlowProvider>
  );
}

