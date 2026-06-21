'use client';

import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Edge, Node } from 'reactflow';
import { MarkerType } from 'reactflow';
import type { CustomNodeData } from '@/components/node-editor/node-editor-shared';

type GenerationActionsInput = {
  nodes: Node<CustomNodeData>[];
  edges: Edge[];
  shouldCancel: boolean;
  selectedStoryboards: Set<string>;
  setNodes: Dispatch<SetStateAction<Node<CustomNodeData>[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setIsGenerating: (value: boolean) => void;
  updateNodeData: (nodeId: string, data: Partial<CustomNodeData>) => void;
};

function pickImageUrl(data: any): string | undefined {
  return data?.imageUrls?.[0] || data?.imageUrl;
}

function buildImagePrompt(sb: any, nodes: Node<CustomNodeData>[], edges: Edge[], storyboardNodeId: string) {
  if (sb.prompt) return sb.prompt;
  const connected = edges
    .filter((edge) => edge.target === storyboardNodeId)
    .map((edge) => nodes.find((node) => node.id === edge.source))
    .filter(Boolean) as Node<CustomNodeData>[];
  const character = connected.find((node) => node.type === 'character');
  const scene = connected.find((node) => node.type === 'scene');
  const characterText = character?.data.characterName
    ? `人物照片：${character.data.characterName}，${character.data.characterDescription || ''}。`
    : '';
  const sceneText = scene?.data.sceneName
    ? `场景照片：${scene.data.sceneName}，${scene.data.sceneDescription || ''}。`
    : '';
  return `${characterText}${sceneText}${sb.description}。高清写实照片，真实自然，专业摄影，光线柔和自然，构图平衡。`;
}

function buildVideoPrompt(source: {
  description?: string;
  prompt?: string;
  cameraAngle?: string;
  duration?: number;
}) {
  const cameraMap: Record<string, string> = {
    wide: '超广角镜头，缓慢推拉镜头，展现场景的宏大感',
    medium: '中景镜头，稳定器拍摄，主体居中',
    'close-up': '特写镜头，微呼吸感，突出细节变化',
    'over-shoulder': '过肩镜头，具有临场感的镜头运动',
    'low-angle': '低角度仰拍，镜头缓慢上摇',
    'high-angle': '高角度俯拍，缓慢的俯拍运动',
    'bird-eye': '鸟瞰视角，缓慢的俯视旋转',
    'multi-angle': '多角度镜头组合，流畅的剪辑节奏',
  };
  const description = source.description || source.prompt || '基于提供的图片生成高质量动态视频';
  const camera = cameraMap[source.cameraAngle || 'medium'] || cameraMap.medium;
  return [
    `专业电影级视频生成，基于提供的参考图片创作动态视频。${description}。`,
    '视频必须严格基于参考图片生成，保持人物形象、场景布局、色彩风格、构图一致。',
    camera,
    `电影级画质，专业色彩分级，视频时长${source.duration || 5}秒，节奏适中。`,
  ].join(' ');
}

async function requestImage(prompt: string) {
  const response = await fetch('/api/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, size: '2K' }),
  });
  if (!response.ok) throw new Error(`图片 API 请求失败：${response.status}`);
  const data = await response.json();
  const imageUrl = pickImageUrl(data);
  if (!imageUrl) throw new Error('图片 API 未返回 URL');
  return imageUrl;
}

async function requestVideo(prompt: string, duration: number, imageUrl?: string) {
  const response = await fetch('/api/video/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      duration,
      materials: imageUrl ? [imageUrl] : [],
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success || !data.videoUrl) {
    throw new Error(data?.error || `视频 API 请求失败：${response.status}`);
  }
  return data.videoUrl as string;
}

export function useNodeEditorGenerationActions({
  nodes,
  edges,
  shouldCancel,
  selectedStoryboards,
  setNodes,
  setEdges,
  setIsGenerating,
  updateNodeData,
}: GenerationActionsInput) {
  const regenerateImage = useCallback(async (imageNodeId: string) => {
    setIsGenerating(true);
    try {
      const imageNode = nodes.find((node) => node.id === imageNodeId);
      const prompt = imageNode?.data.prompt || '';
      if (!imageNode || !prompt.trim()) {
        alert('请先设置图片生成提示词');
        return;
      }
      updateNodeData(imageNodeId, { status: 'loading' });
      const imageUrl = await requestImage(prompt);
      updateNodeData(imageNodeId, { status: 'success', generatedImage: imageUrl });
    } catch (error) {
      console.error('[Image Regeneration] 重新生成图片失败:', error);
      updateNodeData(imageNodeId, { status: 'error' });
      alert('重新生成图片失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [nodes, setIsGenerating, updateNodeData]);

  const regenerateVideoFromNode = useCallback(async (videoNodeId: string) => {
    setIsGenerating(true);
    try {
      const videoNode = nodes.find((node) => node.id === videoNodeId);
      if (!videoNode) {
        alert('视频节点不存在');
        return;
      }
      const imageNode = edges
        .filter((edge) => edge.target === videoNodeId)
        .map((edge) => nodes.find((node) => node.id === edge.source))
        .find((node) => node?.type === 'image' && node.data.generatedImage);
      if (!imageNode?.data.generatedImage) {
        alert('未找到连接的图片节点，请先确保有图片节点连接到该视频节点');
        return;
      }
      updateNodeData(videoNodeId, { status: 'loading' });
      const duration = videoNode.data.duration || imageNode.data.videoDuration || imageNode.data.storyboardDuration || 5;
      const prompt = buildVideoPrompt({
        description: imageNode.data.storyboardDescription,
        prompt: imageNode.data.prompt || videoNode.data.prompt,
        cameraAngle: imageNode.data.storyboardCameraAngle,
        duration,
      });
      const videoUrl = await requestVideo(prompt, duration, imageNode.data.generatedImage);
      updateNodeData(videoNodeId, {
        status: 'success',
        generatedVideo: videoUrl,
        sourceImage: imageNode.data.generatedImage,
        prompt,
      });
    } catch (error) {
      console.error('[Video Regeneration] 重新生成视频失败:', error);
      updateNodeData(videoNodeId, { status: 'error' });
      alert('重新生成视频失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [nodes, edges, setIsGenerating, updateNodeData]);

  const generateStoryboard = useCallback(async (scriptNodeId: string, storyboardNodeId: string) => {
    setIsGenerating(true);
    try {
      const scriptNode = nodes.find((node) => node.id === scriptNodeId);
      const scriptContent = scriptNode?.data.prompt || '';
      if (!scriptContent.trim()) {
        alert('请先输入剧本内容');
        updateNodeData(scriptNodeId, { status: 'error' });
        return;
      }
      if (shouldCancel) {
        updateNodeData(scriptNodeId, { status: 'idle' });
        return;
      }
      updateNodeData(scriptNodeId, { status: 'loading' });
      const parts = scriptContent
        .split(/[。！？.!?\n]+/)
        .map((item) => item.trim())
        .filter(Boolean);
      while (parts.length < 2) parts.push(parts[parts.length - 1] || '继续场景');
      const cameraAngles = ['wide', 'close-up', 'medium', 'over-shoulder', 'low-angle', 'high-angle'];
      const storyboard = parts.map((description, index) => ({
        id: `sb_${index + 1}`,
        description,
        duration: 3 + Math.floor(Math.random() * 4),
        cameraAngle: cameraAngles[index % cameraAngles.length],
      }));
      updateNodeData(storyboardNodeId, {
        status: 'success',
        storyboard,
        prompt: `已生成${storyboard.length}个分镜`,
      });
      updateNodeData(scriptNodeId, { status: 'success' });
    } catch (error) {
      console.error('生成分镜失败:', error);
      updateNodeData(scriptNodeId, { status: 'error' });
    } finally {
      if (!shouldCancel) setIsGenerating(false);
    }
  }, [nodes, shouldCancel, setIsGenerating, updateNodeData]);

  const createImageNode = useCallback((storyboardNode: Node<CustomNodeData>, sb: any, index: number) => {
    const imageNodeId = `image_${Date.now()}_${index}`;
    const prompt = buildImagePrompt(sb, nodes, edges, storyboardNode.id);
    return {
      id: imageNodeId,
      type: 'image',
      position: {
        x: (storyboardNode.position?.x || 450) + 350,
        y: (storyboardNode.position?.y || 200) + index * 120,
      },
      data: {
        label: 'image',
        type: 'image',
        status: 'loading',
        prompt,
        storyboardDescription: sb.description,
        storyboardCameraAngle: sb.cameraAngle,
        storyboardDuration: sb.duration,
        storyboardIndex: index,
        storyboardId: sb.id,
      },
    } as Node<CustomNodeData>;
  }, [nodes, edges]);

  const batchGenerateStoryboardImages = useCallback(async (storyboardNodeId: string) => {
    setIsGenerating(true);
    try {
      const storyboardNode = nodes.find((node) => node.id === storyboardNodeId);
      const storyboard = storyboardNode?.data.storyboard || [];
      if (!storyboardNode || storyboard.length === 0) {
        alert('请先生成分镜或添加分镜');
        updateNodeData(storyboardNodeId, { status: 'error' });
        return;
      }
      const selectedIds = Array.from(selectedStoryboards);
      const items = selectedIds.length ? storyboard.filter((sb) => selectedIds.includes(sb.id)) : storyboard;
      const imageNodes = items.map((sb, index) => createImageNode(storyboardNode, sb, index));
      const imageEdges = imageNodes.map((node) => ({
        id: `e-${storyboardNodeId}-${node.id}`,
        source: storyboardNodeId,
        target: node.id,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' },
      }));
      setNodes((current) => [...current, ...imageNodes]);
      setEdges((current) => [...current, ...imageEdges]);
      let success = 0;
      for (const imageNode of imageNodes) {
        if (shouldCancel) break;
        const imageUrl = await requestImage(imageNode.data.prompt || '');
        updateNodeData(imageNode.id, { status: 'success', generatedImage: imageUrl });
        success += 1;
      }
      updateNodeData(storyboardNodeId, {
        status: success === imageNodes.length ? 'success' : 'idle',
        prompt: success === imageNodes.length ? `图片全部生成完成！共 ${success} 张` : `已生成 ${success} 张图片（已取消）`,
      });
    } catch (error) {
      console.error('批量生成图片失败:', error);
      updateNodeData(storyboardNodeId, { status: 'error' });
      alert('生成图片失败，请重试');
    } finally {
      if (!shouldCancel) setIsGenerating(false);
    }
  }, [nodes, selectedStoryboards, shouldCancel, createImageNode, setNodes, setEdges, setIsGenerating, updateNodeData]);

  const generateSingleStoryboardImage = useCallback(async (storyboardNodeId: string, storyboardIndex: number) => {
    setIsGenerating(true);
    try {
      const storyboardNode = nodes.find((node) => node.id === storyboardNodeId);
      const sb = storyboardNode?.data.storyboard?.[storyboardIndex];
      if (!storyboardNode || !sb) {
        alert('分镜不存在');
        return;
      }
      const imageNode = createImageNode(storyboardNode, sb, storyboardIndex);
      setNodes((current) => [...current, imageNode]);
      setEdges((current) => [...current, {
        id: `e-${storyboardNodeId}-${imageNode.id}`,
        source: storyboardNodeId,
        target: imageNode.id,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' },
      }]);
      const imageUrl = await requestImage(imageNode.data.prompt || '');
      updateNodeData(imageNode.id, { status: 'success', generatedImage: imageUrl });
    } catch (error) {
      console.error('生成单个分镜图片失败:', error);
      alert('生成图片失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [nodes, createImageNode, setNodes, setEdges, setIsGenerating, updateNodeData]);

  const generateVideoFromImage = useCallback(async (imageNodeId: string) => {
    setIsGenerating(true);
    try {
      const imageNode = nodes.find((node) => node.id === imageNodeId);
      if (!imageNode?.data.generatedImage) {
        alert('请先生成图片');
        return;
      }
      const duration = imageNode.data.videoDuration || imageNode.data.storyboardDuration || 5;
      const videoPrompt = buildVideoPrompt({
        description: imageNode.data.storyboardDescription,
        prompt: imageNode.data.prompt,
        cameraAngle: imageNode.data.storyboardCameraAngle,
        duration,
      });
      const videoNodeId = `video_${Date.now()}`;
      const audioNodeId = `audio_${Date.now()}`;
      const videoNode: Node<CustomNodeData> = {
        id: videoNodeId,
        type: 'video',
        position: { x: imageNode.position.x + 350, y: imageNode.position.y },
        data: {
          label: 'video',
          type: 'video',
          status: 'loading',
          prompt: videoPrompt,
          sourceImage: imageNode.data.generatedImage,
          storyboardDescription: imageNode.data.storyboardDescription,
          storyboardCameraAngle: imageNode.data.storyboardCameraAngle,
          storyboardDuration: imageNode.data.storyboardDuration,
          storyboardIndex: imageNode.data.storyboardIndex,
          storyboardId: imageNode.data.storyboardId,
          duration,
        },
      };
      const audioNode: Node<CustomNodeData> = {
        id: audioNodeId,
        type: 'audio',
        position: { x: imageNode.position.x + 350, y: imageNode.position.y + 150 },
        data: {
          label: 'audio',
          type: 'audio',
          status: 'idle',
          audioType: 'voiceover',
          voiceType: 'neutral',
          script: imageNode.data.storyboardDescription || imageNode.data.prompt,
          linkedVideoId: videoNodeId,
        },
      };
      setNodes((current) => [...current, videoNode, audioNode]);
      setEdges((current) => [...current, {
        id: `e-${imageNodeId}-${videoNodeId}`,
        source: imageNodeId,
        target: videoNodeId,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' },
      }, {
        id: `e-${videoNodeId}-${audioNodeId}`,
        source: videoNodeId,
        target: audioNodeId,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#ec4899' },
      }]);
      const videoUrl = await requestVideo(videoPrompt, duration, imageNode.data.generatedImage);
      updateNodeData(videoNodeId, { status: 'success', generatedVideo: videoUrl });
      updateNodeData(imageNodeId, { status: 'success' });
    } catch (error) {
      console.error('生成视频失败:', error);
      alert('生成视频失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [nodes, setNodes, setEdges, setIsGenerating, updateNodeData]);

  const batchGenerateStoryboardVideos = useCallback(async (storyboardNodeId: string) => {
    setIsGenerating(true);
    try {
      const storyboardNode = nodes.find((node) => node.id === storyboardNodeId);
      const storyboard = storyboardNode?.data.storyboard || [];
      if (!storyboardNode || storyboard.length === 0) {
        alert('请先生成分镜或添加分镜');
        updateNodeData(storyboardNodeId, { status: 'error' });
        return;
      }
      const selectedIds = Array.from(selectedStoryboards);
      const items = selectedIds.length ? storyboard.filter((sb) => selectedIds.includes(sb.id)) : storyboard;
      let success = 0;
      for (let index = 0; index < items.length; index += 1) {
        if (shouldCancel) break;
        const sb = items[index];
        const imageNode = createImageNode(storyboardNode, sb, index);
        const videoNodeId = `video_${Date.now()}_${index}`;
        const audioNodeId = `audio_${Date.now()}_${index}`;
        const videoPrompt = buildVideoPrompt({
          description: sb.description,
          prompt: sb.prompt,
          cameraAngle: sb.cameraAngle,
          duration: sb.duration || 5,
        });
        const videoNode: Node<CustomNodeData> = {
          id: videoNodeId,
          type: 'video',
          position: { x: imageNode.position.x + 350, y: imageNode.position.y },
          data: {
            label: 'video',
            type: 'video',
            status: 'loading',
            prompt: videoPrompt,
            storyboardDescription: sb.description,
            storyboardCameraAngle: sb.cameraAngle,
            storyboardDuration: sb.duration,
            storyboardIndex: index,
            storyboardId: sb.id,
            duration: sb.duration || 5,
          },
        };
        const audioNode: Node<CustomNodeData> = {
          id: audioNodeId,
          type: 'audio',
          position: { x: imageNode.position.x + 350, y: imageNode.position.y + 150 },
          data: {
            label: 'audio',
            type: 'audio',
            status: 'idle',
            audioType: 'voiceover',
            voiceType: 'neutral',
            script: sb.description,
            linkedVideoId: videoNodeId,
          },
        };
        setNodes((current) => [...current, imageNode, videoNode, audioNode]);
        setEdges((current) => [...current, {
          id: `e-${storyboardNodeId}-${imageNode.id}`,
          source: storyboardNodeId,
          target: imageNode.id,
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' },
        }, {
          id: `e-${imageNode.id}-${videoNodeId}`,
          source: imageNode.id,
          target: videoNodeId,
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' },
        }, {
          id: `e-${videoNodeId}-${audioNodeId}`,
          source: videoNodeId,
          target: audioNodeId,
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#ec4899' },
        }]);
        const imageUrl = await requestImage(imageNode.data.prompt || '');
        updateNodeData(imageNode.id, { status: 'success', generatedImage: imageUrl });
        const videoUrl = await requestVideo(videoPrompt, sb.duration || 5, imageUrl);
        updateNodeData(videoNodeId, { status: 'success', generatedVideo: videoUrl, sourceImage: imageUrl });
        success += 1;
      }
      updateNodeData(storyboardNodeId, {
        status: success === items.length ? 'success' : 'idle',
        prompt: success === items.length ? `全部生成完成！共 ${success} 个` : `已生成 ${success} 个（已取消）`,
      });
    } catch (error) {
      console.error('批量生成视频失败:', error);
      updateNodeData(storyboardNodeId, { status: 'error' });
      alert('生成视频失败，请重试');
    } finally {
      if (!shouldCancel) setIsGenerating(false);
    }
  }, [nodes, selectedStoryboards, shouldCancel, createImageNode, setNodes, setEdges, setIsGenerating, updateNodeData]);

  const generateAudio = useCallback(async (audioNodeId: string) => {
    setIsGenerating(true);
    try {
      const audioNode = nodes.find((node) => node.id === audioNodeId);
      if (!audioNode?.data.script) {
        alert('请先输入配音文案');
        return;
      }
      updateNodeData(audioNodeId, { status: 'loading' });
      await new Promise((resolve) => setTimeout(resolve, 800));
      updateNodeData(audioNodeId, {
        status: 'success',
        generatedAudio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      });
    } catch (error) {
      console.error('生成音频失败:', error);
      alert('生成音频失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [nodes, setIsGenerating, updateNodeData]);

  const composeFinalVideo = useCallback(async () => {
    setIsGenerating(true);
    try {
      const videoNodes = nodes.filter((node) => node.type === 'video' && node.data.generatedVideo);
      if (videoNodes.length === 0) {
        alert('请先生成至少一个视频');
        return;
      }
      const finalNodeId = `final_${Date.now()}`;
      const lastVideoNode = videoNodes[videoNodes.length - 1];
      const finalNode: Node<CustomNodeData> = {
        id: finalNodeId,
        type: 'video',
        position: {
          x: (lastVideoNode.position?.x || 1500) + 350,
          y: lastVideoNode.position?.y || 200,
        },
        data: {
          label: 'video',
          type: 'video',
          status: 'loading',
          prompt: `最终合成视频${videoNodes.length > 1 ? `（${videoNodes.length}个片段）` : ''}`,
          isFinal: true,
        },
      };
      setNodes((current) => [...current, finalNode]);
      setEdges((current) => [...current, ...videoNodes.map((node) => ({
        id: `e-${node.id}-${finalNodeId}`,
        source: node.id,
        target: finalNodeId,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
      }))]);
      const videoUrls = videoNodes.map((node) => node.data.generatedVideo).filter((url): url is string => Boolean(url));
      let finalVideo = videoUrls[0];
      if (videoUrls.length > 1) {
        const response = await fetch('/api/video/compose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrls }),
        });
        const data = await response.json().catch(() => null);
        finalVideo = data?.success && data.videoUrl ? data.videoUrl : finalVideo;
      }
      updateNodeData(finalNodeId, { status: 'success', generatedVideo: finalVideo });
      alert('最终视频合成完成！');
    } catch (error) {
      console.error('合成最终视频失败:', error);
      alert('合成最终视频失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [nodes, setNodes, setEdges, setIsGenerating, updateNodeData]);

  return {
    regenerateImage,
    regenerateVideoFromNode,
    generateStoryboard,
    batchGenerateStoryboardImages,
    generateSingleStoryboardImage,
    generateVideoFromImage,
    batchGenerateStoryboardVideos,
    generateAudio,
    composeFinalVideo,
  };
}
