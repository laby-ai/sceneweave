"use client";

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { getBYOKRequestHeaders } from '@/lib/byok-client';
import type { EntityCard } from '@/lib/film-creation-panel-model';
import { VISUAL_STYLE_MAP } from '@/lib/visual-style-map';

type WorkflowRole = 'system' | 'assistant' | 'user' | 'info' | 'success' | 'error';
type WorkflowMessageType = 'progress' | 'success' | 'error' | 'info';
type ConsistencyMode = 'first_frame' | 'first_last' | 'multi_ref';

interface UseFilmShotVideoGenerationArgs {
  addWorkflowMsg: (
    role: WorkflowRole,
    content: string,
    step?: string,
    msgType?: WorkflowMessageType,
    nextStep?: string
  ) => void;
  consistencyMode: ConsistencyMode;
  entityCards: EntityCard[];
  filmVisualStyle: string;
  handleExtractLastFrame: (cardId: string) => void | Promise<void>;
  handleGenerateBridge: (prevShotId: string, currentShotId: string) => void | Promise<void>;
  setComposeProgress: Dispatch<SetStateAction<Record<string, number>>>;
  setEntityCards: Dispatch<SetStateAction<EntityCard[]>>;
  setProgressMsg: Dispatch<SetStateAction<string>>;
  style: string;
  videoDuration: number;
  visualStyle: string;
}

export function useFilmShotVideoGeneration({
  addWorkflowMsg,
  consistencyMode,
  entityCards,
  filmVisualStyle,
  handleExtractLastFrame,
  handleGenerateBridge,
  setComposeProgress,
  setEntityCards,
  setProgressMsg,
  style,
  videoDuration,
  visualStyle,
}: UseFilmShotVideoGenerationArgs) {
  const handleGenerateShotVideo = useCallback(async (cardId: string) => {
    const card = entityCards.find(c => c.id === cardId);
    if (!card || card.type !== 'shot') return;

    addWorkflowMsg('assistant', `开始生成镜头 #${card.shotNumber || '?'} 视频...`, 'video', 'info');
    setEntityCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, isGenerating: true } : c
    ));
    setComposeProgress(prev => ({ ...prev, [cardId]: 0 }));

    try {
      const shotCards = entityCards.filter(c => c.type === 'shot');
      const currentShotIndex = shotCards.findIndex(c => c.id === cardId);
      const prevShot = currentShotIndex > 0 ? shotCards[currentShotIndex - 1] : null;

      const characterCards = entityCards.filter(c => c.type === 'character');
      const referencedChars = (card.characters || [])
        .map((charRef: string) => characterCards.find(ch => ch.id === charRef || ch.name === charRef))
        .filter((ch): ch is EntityCard => ch !== undefined);

      const characterContext = referencedChars.length > 0
        ? referencedChars.map(ch =>
            `${ch.name}: ${ch.appearance || ch.description}, wearing ${ch.outfit || 'casual clothes'}`
          ).join('. ')
        : '';

      let coherencePrompt = '';
      if (prevShot?.imageUrl || prevShot?.videoUrl) {
        coherencePrompt = 'Continuing from the previous shot, maintain visual consistency in style, lighting, color palette, and character appearance. ';
      }

      const sceneCards = entityCards.filter(c => c.type === 'scene');
      const sceneRef = card.sceneId
        ? sceneCards.find(s => s.id === card.sceneId)
        : sceneCards[0];
      if (sceneRef) {
        if (sceneRef.colorPalette) {
          coherencePrompt += `Color palette: ${sceneRef.colorPalette}. `;
        }
        if (sceneRef.lightingDir) {
          coherencePrompt += `Lighting: ${sceneRef.lightingDir}. `;
        }
      }

      let videoScriptPrompt = '';
      if (sceneRef) {
        const sceneEnv = [sceneRef.description, sceneRef.location, sceneRef.timeOfDay, sceneRef.mood].filter(Boolean).join(', ');
        if (sceneEnv) videoScriptPrompt += `Scene: ${sceneEnv}. `;
      }
      if (card.shotType) videoScriptPrompt += `Shot: ${card.shotType}. `;
      if (card.cameraMovement) videoScriptPrompt += `Camera: ${card.cameraMovement}. `;
      if (characterContext) videoScriptPrompt += `Characters: ${characterContext}. `;
      if (card.action) videoScriptPrompt += `Action: ${card.action}. `;
      if (card.dialogue) videoScriptPrompt += `Dialogue: ${card.dialogue}. `;
      if (card.narration) videoScriptPrompt += `Narration: ${card.narration}. `;
      if (card.emotionTag) videoScriptPrompt += `Mood: ${card.emotionTag}. `;

      const imagePrompt = card.promptEn || card.promptCn;
      if (imagePrompt) videoScriptPrompt += `Visual: ${imagePrompt}.`;

      const basePrompt = videoScriptPrompt || (card.imageUrl
        ? `${card.promptEn}, ${card.action || ''}`
        : card.promptEn || card.promptCn);

      const shotStartFrameUrl = card.startFrameUrl || card.prevShotEndFrameUrl;
      const firstFrameUrl = shotStartFrameUrl || prevShot?.lastFrameUrl || prevShot?.endFrameUrl || undefined;
      const imageUrl = card.imageUrl || prevShot?.imageUrl;
      const isFLF2V = consistencyMode === 'first_last' && !!firstFrameUrl;

      const characterRefUrls = referencedChars
        .map(ch => ch.imageUrl || ch.images?.[0])
        .filter((url): url is string => !!url);

      let anchorPrompt = '';
      const anchorChars = referencedChars.filter(ch => ch.anchor);
      if (anchorChars.length > 0) {
        anchorPrompt = anchorChars.map(ch => {
          const a = ch.anchor!;
          const parts: string[] = [];
          if (a.faceAnchor) parts.push(`face(${Object.values(a.faceAnchor).filter(Boolean).join(', ')})`);
          if (a.bodyAnchor) parts.push(`body(${Object.values(a.bodyAnchor).filter(Boolean).join(', ')})`);
          if (a.hairAnchor) parts.push(`hair(${Object.values(a.hairAnchor).filter(Boolean).join(', ')})`);
          if (a.costumeAnchor) parts.push(`outfit(${Object.values(a.costumeAnchor).filter(Boolean).join(', ')})`);
          return `${ch.name}: ${parts.join(', ')}`;
        }).join('. ');
      }

      let styleLockPrefix = '';
      let styleLockSuffix = '';
      if (filmVisualStyle && VISUAL_STYLE_MAP[filmVisualStyle]) {
        const vsEntry = VISUAL_STYLE_MAP[filmVisualStyle];
        styleLockPrefix = vsEntry.lockPhrase || '';
        styleLockSuffix = vsEntry.prefix || '';
      }

      const fullPrompt = [
        styleLockPrefix && styleLockPrefix + ',',
        coherencePrompt,
        anchorPrompt && anchorPrompt + '.',
        basePrompt,
        styleLockSuffix && styleLockSuffix,
      ].filter(Boolean).join(' ');

      const sceneRefUrl = sceneRef?.imageUrl || undefined;
      const allRefUrls = [...new Set([
        ...characterRefUrls,
        ...(sceneRefUrl ? [sceneRefUrl] : []),
      ])].filter(Boolean) as string[];

      const res = await fetch('/api/video/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
        body: JSON.stringify({
          prompt: fullPrompt,
          imageUrl,
          firstFrameUrl,
          inputLastFrameUrl: card.endFrameUrl || undefined,
          characterRefUrls: allRefUrls,
          style: visualStyle || style,
          filmVisualStyle,
          duration: card.duration || videoDuration,
          enableSubtitle: true,
          subtitleText: card.narration || card.dialogue || card.promptCn,
          generateVoice: true,
          autoPostProcess: true,
          ...(isFLF2V ? { flf2vMode: true, lastFrameUrl: firstFrameUrl } : {}),
          gridPromptMode: consistencyMode,
        }),
      });

      if (!res.ok) throw new Error('视频生成提交失败');
      const data = await res.json();
      const taskId = data.taskId;

      if (taskId) {
        let attempts = 0;
        const maxAttempts = 120;
        const pollInterval = setInterval(async () => {
          attempts++;
          if (attempts > maxAttempts) {
            clearInterval(pollInterval);
            setEntityCards(prev => prev.map(c =>
              c.id === cardId ? { ...c, isGenerating: false } : c
            ));
            return;
          }

          try {
            const taskRes = await fetch(`/api/tasks/${taskId}`);
            const taskData = await taskRes.json();
            const task = taskData.task;
            if (!task) {
              clearInterval(pollInterval);
              setEntityCards(prev => prev.map(c =>
                c.id === cardId ? { ...c, isGenerating: false } : c
              ));
              return;
            }

            const progress = task.progress || 0;
            const stage = task.stage || '';
            setComposeProgress(prev => ({ ...prev, [cardId]: progress }));

            const generatingShots = entityCards.filter(c => c.type === 'shot' && c.isGenerating);
            const completedShots = entityCards.filter(c => c.type === 'shot' && c.videoUrl);
            if (generatingShots.length > 0) {
              const totalNeed = entityCards.filter(c => c.type === 'shot').length;
              const pct = Math.round((completedShots.length / totalNeed) * 100);
              const stageLabel = stage ? ` · ${stage}` : '';
              setProgressMsg(`镜头 #${card.shotNumber || '?'} ${progress}%${stageLabel} | 总进度 ${completedShots.length}/${totalNeed} (${pct}%)`);
            }

            if (task.status === 'completed') {
              clearInterval(pollInterval);
              const videoUrl = task.result?.videoUrl || task.result?.url;
              const subtitleText = task.result?.subtitle || card.narration || '';
              const audioUrl = task.result?.audioUrl;
              const lastFrameUrl = task.result?.lastFrameUrl;
              setEntityCards(prev => prev.map(c =>
                c.id === cardId ? { ...c, videoUrl, subtitleText, audioUrl, lastFrameUrl, isGenerating: false } : c
              ));
              setComposeProgress(prev => ({ ...prev, [cardId]: 100 }));
              addWorkflowMsg('assistant', `镜头 #${card.shotNumber || '?'} 视频生成完成`, 'video', 'success', '可以继续生成下一个镜头视频，或输入"合成"合成完整影片');

              if (videoUrl && !lastFrameUrl) {
                setTimeout(() => handleExtractLastFrame(cardId), 1000);
              }
              if (prevShot && prevShot.videoUrl) {
                setTimeout(() => {
                  handleGenerateBridge(prevShot.id, cardId);
                }, 500);
              }
            } else if (task.status === 'failed') {
              clearInterval(pollInterval);
              setEntityCards(prev => prev.map(c =>
                c.id === cardId ? { ...c, isGenerating: false } : c
              ));
              addWorkflowMsg('assistant', `镜头 #${card.shotNumber || '?'} 视频生成失败`, 'video', 'error', `可以输入"重试镜头${card.shotNumber}"重新生成`);
            }
          } catch {
            // 轮询失败继续
          }
        }, 3000);
      }
    } catch {
      setEntityCards(prev => prev.map(c =>
        c.id === cardId ? { ...c, isGenerating: false } : c
      ));
    }
  }, [
    addWorkflowMsg,
    consistencyMode,
    entityCards,
    filmVisualStyle,
    handleExtractLastFrame,
    handleGenerateBridge,
    setComposeProgress,
    setEntityCards,
    setProgressMsg,
    style,
    videoDuration,
    visualStyle,
  ]);

  const handleRegenerateVideo = useCallback(async (cardId: string) => {
    setEntityCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, videoUrl: undefined, subtitleText: undefined, audioUrl: undefined } : c
    ));
    await handleGenerateShotVideo(cardId);
  }, [handleGenerateShotVideo, setEntityCards]);

  return { handleGenerateShotVideo, handleRegenerateVideo };
}
