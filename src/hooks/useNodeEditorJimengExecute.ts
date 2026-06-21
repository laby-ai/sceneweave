'use client';

import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { MarkerType, type Edge, type Node } from 'reactflow';

import type { CustomNodeData } from '@/components/node-editor/node-editor-shared';

type UseNodeEditorJimengExecuteOptions = {
  nodes: Node<CustomNodeData>[];
  setNodes: Dispatch<SetStateAction<Node<CustomNodeData>[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  shouldCancel: boolean;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  updateNodeData: (nodeId: string, newData: Partial<CustomNodeData>) => void;
};

type JimengCharacter = {
  name: string;
  appearance?: string;
  facialFeatures?: string;
  hairstyle?: string;
  temperament?: string;
  makeup?: string;
  clothing?: string;
  age?: string;
  personality?: string;
  artStyle?: string;
};

type JimengScene = {
  name: string;
  environment?: string;
  lighting?: string;
  atmosphere?: string;
  artStyle?: string;
};

type JimengShot = {
  shotId: string;
  content: string;
  shotType?: string;
  sceneName?: string;
  timeOfDay?: string;
  location?: string;
  audio?: string;
  dialogue?: string;
  narration?: string;
  os?: string;
  voiceover?: string;
};

type JimengAudioCharacter = {
  character: string;
  voiceDescription?: string;
};

type JimengConvertResponse = {
  success?: boolean;
  error?: string;
  data?: unknown;
  shots?: JimengShot[];
  timingTable?: unknown;
  clips?: unknown;
  assets?: {
    characters?: JimengCharacter[];
    scenes?: JimengScene[];
  };
  audioAssets?: {
    characters?: JimengAudioCharacter[];
  };
};

const JIMENG_EDGE_COLORS = {
  character: '#eab308',
  scene: '#22d3ee',
  storyboard: '#f97316',
  audio: '#8b5cf6',
};

const createArrowEdge = (id: string, source: string, target: string, color: string): Edge => ({
  id,
  source,
  target,
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color },
});

export function useNodeEditorJimengExecute({
  nodes,
  setNodes,
  setEdges,
  shouldCancel,
  setIsGenerating,
  updateNodeData,
}: UseNodeEditorJimengExecuteOptions) {
  return useCallback(async (scriptNodeId: string, jimengNodeId: string, targetDuration: number = 120) => {
    console.log('[Jimeng] 开始执行Agent转换');

    setIsGenerating(true);

    try {
      updateNodeData(jimengNodeId, {
        status: 'loading',
        progress: '正在分析剧本结构...',
      });

      const scriptNode = nodes.find((n) => n.id === scriptNodeId);
      const scriptContent = scriptNode?.data.prompt || '';

      if (!scriptContent.trim()) {
        alert('请先输入剧本内容');
        updateNodeData(jimengNodeId, { status: 'error' });
        return;
      }

      if (shouldCancel) {
        console.log('[Jimeng] 执行已取消');
        updateNodeData(jimengNodeId, { status: 'idle' });
        return;
      }

      console.log('[Jimeng] 调用Agent转换API...');
      updateNodeData(jimengNodeId, {
        progress: '正在调用Agent转换API...',
      });

      const response = await fetch('/api/script/jimeng-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: scriptContent,
          targetDuration,
        }),
      });

      if (!response.ok) {
        throw new Error('Agent转换失败');
      }

      const data = (await response.json()) as JimengConvertResponse;

      console.log('[Jimeng] API返回数据:', {
        success: data.success,
        hasShots: !!data.shots,
        shotsLength: data.shots?.length || 0,
        hasAssets: !!data.assets,
        hasCharacters: !!data.assets?.characters,
        charactersLength: data.assets?.characters?.length || 0,
        hasScenes: !!data.assets?.scenes,
        scenesLength: data.assets?.scenes?.length || 0,
        hasAudioAssets: !!data.audioAssets,
        audioCharactersLength: data.audioAssets?.characters?.length || 0,
      });

      if (!data.success) {
        throw new Error(data.error || '转换失败');
      }

      console.log('[Jimeng] Agent转换成功');

      const agentNode = nodes.find((n) => n.id === jimengNodeId);
      const agentPosition = agentNode?.position || { x: 450, y: 200 };
      const allNewNodes: Node<CustomNodeData>[] = [];
      const allNewEdges: Edge[] = [];
      const characters = data.assets?.characters || [];
      const scenes = data.assets?.scenes || [];
      const shots = data.shots || [];
      const audioChars = data.audioAssets?.characters || [];

      console.log('[Jimeng] 创建人物节点:', characters.length, '个');

      for (let i = 0; i < characters.length; i++) {
        if (shouldCancel) break;

        const char = characters[i];
        const charId = `char_${Date.now()}_${i}`;
        const exists = nodes.find((n) => (
          n.type === 'character' && (n.data as CustomNodeData).characterName === char.name
        ));

        if (!exists) {
          const charDesc = `${char.appearance || ''}，${char.facialFeatures || ''}，${char.hairstyle || ''}，${char.temperament || ''}，${char.makeup || ''}，${char.clothing || ''}`.trim();

          allNewNodes.push({
            id: charId,
            type: 'character',
            position: { x: agentPosition.x - 350, y: agentPosition.y + i * 140 },
            data: {
              label: 'character',
              type: 'character',
              status: 'idle',
              characterName: char.name,
              characterDescription: charDesc || `${char.name}的形象`,
              characterAge: char.age,
              characterPersonality: char.personality,
              characterArtStyle: char.artStyle,
            },
          });

          allNewEdges.push(createArrowEdge(`e-${charId}-${jimengNodeId}`, charId, jimengNodeId, JIMENG_EDGE_COLORS.character));
        }
      }

      console.log('[Jimeng] 创建场景节点:', scenes.length, '个');

      for (let i = 0; i < scenes.length; i++) {
        if (shouldCancel) break;

        const scene = scenes[i];
        const sceneId = `scene_${Date.now()}_${i}`;
        const exists = nodes.find((n) => (
          n.type === 'scene' && (n.data as CustomNodeData).sceneName === scene.name
        ));

        if (!exists) {
          const sceneDesc = `${scene.environment || ''}，${scene.lighting || ''}，${scene.atmosphere || ''}`.trim();

          allNewNodes.push({
            id: sceneId,
            type: 'scene',
            position: { x: agentPosition.x - 350, y: agentPosition.y + (characters.length + i) * 140 + 60 },
            data: {
              label: 'scene',
              type: 'scene',
              status: 'idle',
              sceneName: scene.name,
              sceneDescription: sceneDesc || `${scene.name}的场景`,
              sceneEnvironment: scene.environment,
              sceneLighting: scene.lighting,
              sceneAtmosphere: scene.atmosphere,
              sceneArtStyle: scene.artStyle,
            },
          });

          allNewEdges.push(createArrowEdge(`e-${sceneId}-${jimengNodeId}`, sceneId, jimengNodeId, JIMENG_EDGE_COLORS.scene));
        }
      }

      const storyboardId = `sb_${Date.now()}`;
      const hasStoryboardNode = nodes.find((n) => n.type === 'storyboard');
      let hasStoryboard = false;

      if (!hasStoryboardNode && shots.length > 0) {
        console.log('[Jimeng] 创建分镜节点');
        const storyboardList = shots.map((shot) => ({
          id: shot.shotId,
          description: shot.content,
          shotType: shot.shotType,
          sceneName: shot.sceneName,
          timeOfDay: shot.timeOfDay,
          location: shot.location,
          duration: 5,
          audio: shot.audio,
          dialogue: shot.dialogue || '',
          narration: shot.narration || '',
          os: shot.os || '',
          voiceover: shot.voiceover || '',
          cameraAngle: '平视',
          movement: '固定',
          image: `https://picsum.photos/seed/${storyboardId}_${shot.shotId}/800/450`,
          status: 'idle' as const,
        }));

        allNewNodes.push({
          id: storyboardId,
          type: 'storyboard',
          position: { x: agentPosition.x + 350, y: agentPosition.y },
          data: {
            label: 'storyboard',
            type: 'storyboard',
            status: 'success',
            storyboard: storyboardList,
          },
        });

        hasStoryboard = true;
        allNewEdges.push(createArrowEdge(`e-${jimengNodeId}-${storyboardId}`, jimengNodeId, storyboardId, JIMENG_EDGE_COLORS.storyboard));
      }

      console.log('[Jimeng] 创建音频节点:', audioChars.length, '个');

      for (let i = 0; i < audioChars.length; i++) {
        if (shouldCancel) break;

        const audioChar = audioChars[i];
        const audioId = `audio_${Date.now()}_${i}`;
        const exists = nodes.find((n) => (
          n.type === 'audio' && (n.data as CustomNodeData).audioName === audioChar.character
        ));

        if (!exists) {
          allNewNodes.push({
            id: audioId,
            type: 'audio',
            position: { x: agentPosition.x + 350, y: agentPosition.y + (hasStoryboard ? 140 : 0) + i * 140 },
            data: {
              label: 'audio',
              type: 'audio',
              status: 'success',
              audioName: audioChar.character,
              audioDescription: audioChar.voiceDescription,
              audioUrl: '',
            },
          });

          allNewEdges.push(createArrowEdge(`e-${jimengNodeId}-${audioId}`, jimengNodeId, audioId, JIMENG_EDGE_COLORS.audio));
        }
      }

      console.log('[Jimeng] 更新Agent和剧本节点状态');

      setNodes((nds) => nds.map((node) => {
        if (node.id === jimengNodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              status: 'success',
              result: data.data,
              shots: data.shots,
              timingTable: data.timingTable,
              clips: data.clips,
              assets: data.assets,
              audioAssets: data.audioAssets,
              targetDuration,
              progress: 'Agent六大模块转换完成！',
            },
          };
        }

        if (node.id === scriptNodeId) {
          return {
            ...node,
            data: { ...node.data, status: 'success' },
          };
        }

        return node;
      }));

      console.log('[Jimeng] 添加新节点:', allNewNodes.length, '个，新边:', allNewEdges.length, '个');

      if (allNewNodes.length > 0) {
        setTimeout(() => {
          setNodes((nds) => [...nds, ...allNewNodes]);
        }, 50);
      }

      if (allNewEdges.length > 0) {
        setTimeout(() => {
          setEdges((eds) => [...eds, ...allNewEdges]);
        }, 100);
      }

      console.log('[Jimeng] 节点创建流程完成');
    } catch (error) {
      console.error('[Jimeng] Agent转换失败:', error);
      updateNodeData(jimengNodeId, {
        status: 'error',
        progress: error instanceof Error ? error.message : '转换失败',
      });
    } finally {
      if (!shouldCancel) {
        setIsGenerating(false);
      }
    }
  }, [nodes, setEdges, setIsGenerating, setNodes, shouldCancel, updateNodeData]);
}
