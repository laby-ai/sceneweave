'use client';

import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Edge, Node } from 'reactflow';
import type { CustomNodeData, NodeType } from '@/components/node-editor/node-editor-shared';

type CanvasActionsInput = {
  nodes: Node<CustomNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  setSelectedNodeId: (nodeId: string | null) => void;
  setNodes: Dispatch<SetStateAction<Node<CustomNodeData>[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  saveToHistory: (nodes: Node<CustomNodeData>[], edges: Edge[]) => void;
  updateNodeData: (nodeId: string, data: Partial<CustomNodeData>) => void;
  handleUndo: () => void;
  handleRedo: () => void;
};

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function useNodeEditorCanvasActions({
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
}: CanvasActionsInput) {
  const handleAddNode = useCallback((type: NodeType) => {
    const newNode: Node<CustomNodeData> = {
      id: `node_${Date.now()}`,
      type,
      position: { x: 250, y: 250 },
      data: {
        label: type,
        type,
        status: 'idle',
        onUpdate: (data: CustomNodeData) => updateNodeData(newNode.id, data),
      },
    };
    setNodes((currentNodes) => {
      const nextNodes = [...currentNodes, newNode];
      setEdges((currentEdges) => {
        saveToHistory(nextNodes, currentEdges);
        return currentEdges;
      });
      return nextNodes;
    });
  }, [setNodes, setEdges, updateNodeData, saveToHistory]);

  const handleQuickCreateCharacter = useCallback(() => {
    const characterId = `character_${Date.now()}`;
    const name = randomItem(['主角', '小明', '小红', '侦探', '医生', '老师', '商人', '艺术家']);
    const description = randomItem([
      '年轻英俊的男性，黑色短发，眼神坚定，穿着休闲装',
      '温柔美丽的女性，长发披肩，笑容温暖，穿着优雅',
      '成熟稳重的中年男性，戴着眼镜，穿着西装，气质儒雅',
      '活力四射的年轻女孩，短发干练，穿着运动装，充满朝气',
    ]);
    const newNode: Node<CustomNodeData> = {
      id: characterId,
      type: 'character',
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: {
        label: 'character',
        type: 'character',
        status: 'idle',
        characterName: name,
        characterDescription: description,
        characterImage: `https://picsum.photos/seed/${characterId}/400/600`,
        onUpdate: (data: CustomNodeData) => updateNodeData(characterId, data),
      },
    };
    setNodes((currentNodes) => {
      const nextNodes = [...currentNodes, newNode];
      setEdges((currentEdges) => {
        saveToHistory(nextNodes, currentEdges);
        return currentEdges;
      });
      return nextNodes;
    });
  }, [setNodes, setEdges, updateNodeData, saveToHistory]);

  const handleQuickCreateScene = useCallback(() => {
    const sceneId = `scene_${Date.now()}`;
    const name = randomItem(['客厅', '办公室', '咖啡馆', '公园', '街道', '海边', '森林', '山顶']);
    const description = randomItem([
      '温馨的现代客厅，阳光透过落地窗洒入，家具摆放整洁',
      '繁忙的办公室，书架林立，办公桌上堆满文件，窗外是城市景色',
      '舒适的咖啡馆，温暖的灯光，木质桌椅，咖啡香气四溢',
      '宁静的公园，绿树成荫，草地青翠，远处有湖水',
    ]);
    const newNode: Node<CustomNodeData> = {
      id: sceneId,
      type: 'scene',
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: {
        label: 'scene',
        type: 'scene',
        status: 'idle',
        sceneName: name,
        sceneDescription: description,
        sceneImage: `https://picsum.photos/seed/${sceneId}/800/450`,
        onUpdate: (data: CustomNodeData) => updateNodeData(sceneId, data),
      },
    };
    setNodes((currentNodes) => {
      const nextNodes = [...currentNodes, newNode];
      setEdges((currentEdges) => {
        saveToHistory(nextNodes, currentEdges);
        return currentEdges;
      });
      return nextNodes;
    });
  }, [setNodes, setEdges, updateNodeData, saveToHistory]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    const nextNodes = nodes.filter((node) => node.id !== selectedNodeId);
    const nextEdges = edges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId);
    setNodes(nextNodes);
    setEdges(nextEdges);
    saveToHistory(nextNodes, nextEdges);
    setSelectedNodeId(null);
  }, [selectedNodeId, nodes, edges, setNodes, setEdges, saveToHistory, setSelectedNodeId]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  useEffect(() => {
    const handleOpenNodeDetails = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeId?: string }>).detail;
      if (detail?.nodeId) setSelectedNodeId(detail.nodeId);
    };
    window.addEventListener('huiying-node-open-details', handleOpenNodeDetails);
    return () => window.removeEventListener('huiying-node-open-details', handleOpenNodeDetails);
  }, [setSelectedNodeId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeId) {
        event.preventDefault();
        handleDeleteNode();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      }
      if (((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'z') || ((event.ctrlKey || event.metaKey) && event.key === 'y')) {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, handleDeleteNode, handleUndo, handleRedo]);

  return {
    handleAddNode,
    handleQuickCreateCharacter,
    handleQuickCreateScene,
    handleDeleteNode,
    onNodeClick,
    onPaneClick,
  };
}
