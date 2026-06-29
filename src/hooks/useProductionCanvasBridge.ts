'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Edge, Node, ReactFlowInstance } from 'reactflow';
import { MarkerType } from 'reactflow';
import type { CustomNodeData } from '@/components/node-editor/node-editor-shared';

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

type UseProductionCanvasBridgeInput = {
  nodes: Node<CustomNodeData>[];
  selectedNodeId: string | null;
  setNodes: (nodes: Node<CustomNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  saveToHistory: (nodes: Node<CustomNodeData>[], edges: Edge[]) => void;
  updateNodeData: (nodeId: string, data: Partial<CustomNodeData>) => void;
  reactFlowInstance: ReactFlowInstance<CustomNodeData> | null;
  setIsGenerating: (value: boolean) => void;
};

export function useProductionCanvasBridge({
  nodes,
  selectedNodeId,
  setNodes,
  setEdges,
  saveToHistory,
  updateNodeData,
  reactFlowInstance,
  setIsGenerating,
}: UseProductionCanvasBridgeInput) {
  const autoImportTaskIdRef = useRef<string | null>(null);
  const [productionCanvasInfo, setProductionCanvasInfo] = useState<ProductionCanvasInfo>({ status: 'idle' });
  const [canvasSaveInfo, setCanvasSaveInfo] = useState<CanvasSaveInfo>({ status: 'idle' });

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const importFromProductionProject = useCallback(async (targetTaskId?: string, options?: { silent?: boolean }) => {
    try {
      setProductionCanvasInfo({
        status: 'loading',
        taskId: targetTaskId,
        message: targetTaskId ? '正在加载指定任务的制作画布...' : '正在加载最近的制作画布...',
      });

      const url = targetTaskId
        ? `/api/node-editor/production-canvas?taskId=${encodeURIComponent(targetTaskId)}`
        : '/api/node-editor/production-canvas';
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data.success || !data.canvas) {
        const message = data.error || '暂无可导入的绘影项目，请先在绘影精灵生成导演链路';
        setProductionCanvasInfo({
          status: 'error',
          taskId: targetTaskId,
          message,
        });
        if (!options?.silent) alert(message);
        return;
      }

      const importedNodes: Node<CustomNodeData>[] = data.canvas.nodes.map((node: Node<CustomNodeData>) => ({
        ...node,
        data: {
          ...node.data,
          generatedVideo: node.data.generatedVideo || node.data.videoUrl,
          generatedImage: node.data.generatedImage || node.data.imageUrl,
          onUpdate: (nextData: CustomNodeData) => updateNodeData(node.id, nextData),
        },
      }));

      const importedEdges: Edge[] = data.canvas.edges.map((edge: Edge) => ({
        ...edge,
        markerEnd: { type: MarkerType.ArrowClosed },
      }));

      setNodes(importedNodes);
      setEdges(importedEdges);
      saveToHistory(importedNodes, importedEdges);
      localStorage.setItem('node-editor-workflow', JSON.stringify({
        nodes: importedNodes,
        edges: importedEdges,
        savedAt: new Date().toISOString(),
        source: 'production-canvas',
        productionProjectId: data.canvas.productionProjectId,
        taskId: data.taskId,
      }));

      setProductionCanvasInfo({
        status: 'loaded',
        taskId: data.taskId,
        productionProjectId: data.canvas.productionProjectId,
        nodeCount: data.canvas.summary.nodeCount,
        edgeCount: data.canvas.summary.edgeCount,
        message: `已加载真实制作画布：${data.canvas.summary.nodeCount} 个节点 · ${data.canvas.summary.edgeCount} 条连接`,
      });

      window.setTimeout(() => {
        reactFlowInstance?.fitView?.({ padding: 0.18, duration: 350 });
      }, 80);

      if (!options?.silent) {
        alert(`已导入绘影项目：${data.canvas.summary.nodeCount} 个节点 · ${data.canvas.summary.edgeCount} 条连接`);
      }
    } catch (error) {
      console.error('导入绘影项目失败:', error);
      const message = error instanceof Error ? error.message : '导入绘影项目失败，请重试';
      setProductionCanvasInfo({
        status: 'error',
        taskId: targetTaskId,
        message,
      });
      if (!options?.silent) alert(message);
    }
  }, [setNodes, setEdges, updateNodeData, saveToHistory, reactFlowInstance]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const taskId = new URLSearchParams(window.location.search).get('taskId');
    if (!taskId || autoImportTaskIdRef.current === taskId) return;
    autoImportTaskIdRef.current = taskId;
    void importFromProductionProject(taskId, { silent: true });
  }, [importFromProductionProject]);

  const exportFinalVideo = useCallback(async () => {
    if (productionCanvasInfo.status !== 'loaded' || !productionCanvasInfo.taskId) {
      setCanvasSaveInfo({
        status: 'error',
        message: '请先加载真实制作项目，再导出 cut-draft 草稿',
      });
      alert('请先从绘影精灵、任务中心或 URL taskId 加载真实制作项目；画布不再生成模拟视频。');
      return;
    }

    setIsGenerating(true);
    setCanvasSaveInfo({
      status: 'saving',
      message: '正在生成真实 cut-draft 导出包...',
    });

    try {
      const exportUrl = `/api/production/export?taskId=${encodeURIComponent(productionCanvasInfo.taskId)}&format=cut-draft-json`;
      const response = await fetch(exportUrl);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `导出失败：${response.status}`);
      }

      const finalVideoCount = result.exportPackage?.assets?.finalVideos?.length || 0;
      const videoSegmentCount = result.exportPackage?.assets?.videoSegments?.length || 0;
      setCanvasSaveInfo({
        status: 'saved',
        message: `已生成 cut-draft：${finalVideoCount} 个成片 · ${videoSegmentCount} 个片段`,
      });
      window.open(exportUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('导出视频失败:', error);
      setCanvasSaveInfo({
        status: 'error',
        message: error instanceof Error ? error.message : '导出 cut-draft 失败',
      });
      alert(error instanceof Error ? error.message : '导出 cut-draft 失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [productionCanvasInfo.status, productionCanvasInfo.taskId, setIsGenerating]);

  const selectedProductionAssetId = selectedNode?.data?.productionAssetId as string | undefined;
  const canWriteBackProductionAsset =
    productionCanvasInfo.status === 'loaded' &&
    Boolean(productionCanvasInfo.taskId) &&
    Boolean(selectedProductionAssetId);

  const saveSelectedProductionAsset = useCallback(async () => {
    if (!selectedNode || !productionCanvasInfo.taskId || !selectedProductionAssetId) {
      setCanvasSaveInfo({
        status: 'error',
        message: '请选择一个真实制作项目节点后再写回',
      });
      return;
    }

    const nextName =
      selectedNode.data.label ||
      selectedNode.data.characterName ||
      selectedNode.data.sceneName ||
      `节点 ${selectedNode.id}`;
    const nextSummary =
      selectedNode.data.prompt ||
      selectedNode.data.characterDescription ||
      selectedNode.data.sceneDescription ||
      selectedNode.data.subtitle ||
      selectedNode.data.script;

    setCanvasSaveInfo({ status: 'saving', message: '正在写回项目资产' });

    try {
      const response = await fetch(
        `/api/production/projects/${encodeURIComponent(productionCanvasInfo.taskId)}/assets/${encodeURIComponent(selectedProductionAssetId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nextName,
            ...(nextSummary ? { summary: nextSummary } : {}),
            metadata: {
              canvasNodeId: selectedNode.id,
              canvasNodeType: selectedNode.type,
              canvasWritebackSource: 'node-editor',
            },
          }),
        },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `写回失败：${response.status}`);
      }

      updateNodeData(selectedNode.id, {
        label: data.asset.name,
        prompt: data.asset.summary,
        metadata: data.asset.metadata || selectedNode.data.metadata,
        assetWritebackAt: new Date().toISOString(),
      } as Partial<CustomNodeData>);
      setCanvasSaveInfo({
        status: 'saved',
        message: data.changedFields?.length
          ? `已写回 ${data.changedFields.join(', ')}`
          : '项目资产已是最新',
      });
    } catch (error) {
      setCanvasSaveInfo({
        status: 'error',
        message: error instanceof Error ? error.message : '写回项目资产失败',
      });
    }
  }, [productionCanvasInfo.taskId, selectedNode, selectedProductionAssetId, updateNodeData]);

  const saveStoryboardShot = useCallback(async (shotId: string) => {
    if (!selectedNode || !productionCanvasInfo.taskId || selectedNode.type !== 'storyboard') {
      setCanvasSaveInfo({
        status: 'error',
        message: '请选择真实制作项目的分镜节点后再写回镜头',
      });
      return;
    }

    const storyboard = selectedNode.data.storyboard || [];
    const shot = storyboard.find(item => item.id === shotId);
    if (!shot) {
      setCanvasSaveInfo({
        status: 'error',
        message: `当前分镜中不存在镜头 ${shotId}`,
      });
      return;
    }

    setCanvasSaveInfo({ status: 'saving', message: `正在写回镜头 ${shot.index || shotId}` });

    try {
      const response = await fetch(
        `/api/production/projects/${encodeURIComponent(productionCanvasInfo.taskId)}/storyboard/${encodeURIComponent(shotId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: shot.description || shot.prompt,
            duration: shot.duration,
            shotType: shot.shotType,
            shotTypeLabel: shot.cameraAngle,
            subtitleText: shot.subtitleText || shot.dialogue || shot.os,
            narrationText: shot.narrationText || shot.narration || shot.voiceover,
          }),
        },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `镜头写回失败：${response.status}`);
      }

      const nextStoryboard = storyboard.map(item => (
        item.id === shotId
          ? {
              ...item,
              description: data.shot.prompt,
              prompt: data.shot.prompt,
              duration: data.shot.duration,
              cameraAngle: data.shot.shotTypeLabel || data.shot.shotType || item.cameraAngle,
              shotType: data.shot.shotType,
              subtitleText: data.shot.subtitleText,
              narrationText: data.shot.narrationText,
              status: data.shot.status,
            }
          : item
      ));

      updateNodeData(selectedNode.id, {
        storyboard: nextStoryboard,
        totalDuration: data.storyboard?.totalDuration || selectedNode.data.totalDuration,
        shotWritebackAt: new Date().toISOString(),
      } as Partial<CustomNodeData>);
      setCanvasSaveInfo({
        status: 'saved',
        message: data.changedFields?.length
          ? `镜头已写回 ${data.changedFields.join(', ')}`
          : '镜头已是最新',
      });
    } catch (error) {
      setCanvasSaveInfo({
        status: 'error',
        message: error instanceof Error ? error.message : '写回镜头失败',
      });
    }
  }, [productionCanvasInfo.taskId, selectedNode, updateNodeData]);

  return {
    productionCanvasInfo,
    canvasSaveInfo,
    selectedNode,
    canWriteBackProductionAsset,
    importFromProductionProject,
    exportFinalVideo,
    saveSelectedProductionAsset,
    saveStoryboardShot,
  };
}
