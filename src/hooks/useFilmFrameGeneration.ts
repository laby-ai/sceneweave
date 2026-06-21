"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { FilmVisualGenerationStage } from '@/components/film/film-visual-progress-panel';
import type { EntityCard } from '@/lib/film-creation-panel-model';
import { VISUAL_STYLE_MAP, buildEnhancedNegative, buildStyleLockedPrompt } from '@/lib/visual-style-map';

type WorkflowMsgType = 'progress' | 'success' | 'error' | 'info';

type GenerationProgress = {
  completed: number;
  total: number;
  currentName: string;
};

type BridgeProgress = {
  current: number;
  total: number;
  phase: string;
};

type UseFilmFrameGenerationArgs = {
  addWorkflowMsg: (
    role: 'user' | 'assistant' | 'system' | 'success' | 'error' | 'info',
    content: string,
    step?: string,
    msgType?: WorkflowMsgType,
    nextStep?: string
  ) => void;
  buildAnchorContext: (card: EntityCard) => string;
  buildReferenceImages: (card: EntityCard, continuityRef?: string) => string[];
  entityCards: EntityCard[];
  entityCardsRef: MutableRefObject<EntityCard[]>;
  filmVisualStyle: string;
  generationMode: 'parallel' | 'sequential';
  setBridgeProgress: Dispatch<SetStateAction<BridgeProgress | null>>;
  setEntityCards: Dispatch<SetStateAction<EntityCard[]>>;
  setGenerationProgress: Dispatch<SetStateAction<GenerationProgress>>;
  setGenerationStage: Dispatch<SetStateAction<FilmVisualGenerationStage>>;
  setIsBridging: Dispatch<SetStateAction<boolean>>;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  videoRatio: string;
  visualStyle: string;
};

export function useFilmFrameGeneration({
  addWorkflowMsg,
  buildAnchorContext,
  buildReferenceImages,
  entityCards,
  entityCardsRef,
  filmVisualStyle,
  generationMode,
  setBridgeProgress,
  setEntityCards,
  setGenerationProgress,
  setGenerationStage,
  setIsBridging,
  setIsGenerating,
  videoRatio,
  visualStyle,
}: UseFilmFrameGenerationArgs) {
  const handleGenerateStartFrame = useCallback(async (cardId: string) => {
    const card = entityCards.find(c => c.id === cardId);
    if (!card) return;

    addWorkflowMsg('assistant', `正在生成镜头「${card.name}」起始帧...`, undefined, 'progress');
    setEntityCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, startFrameGenerating: true } : c
    ));

    try {
      const shotCards = entityCards.filter(c => c.type === 'shot');
      const currentIdx = shotCards.findIndex(c => c.id === cardId);
      const prevShotEndFrame = currentIdx > 0 ? shotCards[currentIdx - 1]?.endFrameUrl : undefined;
      const continuityRef = prevShotEndFrame || card.prevShotEndFrameUrl;

      const anchorCtx = buildAnchorContext(card);
      const continuityHint = continuityRef ? ', continuing from previous shot, seamless transition' : '';
      const rawPrompt = `${card.promptEn}, start frame${continuityHint}${anchorCtx}`;
      const prompt = filmVisualStyle ? buildStyleLockedPrompt(rawPrompt, filmVisualStyle) : `${rawPrompt}, cinematic, ${visualStyle}`;
      const negPrompt = filmVisualStyle ? buildEnhancedNegative(filmVisualStyle) : '';
      const refImages = buildReferenceImages(card, continuityRef);
      const primaryRef = refImages.length > 0 ? refImages[0] : undefined;
      const materialsRefs = refImages.length > 1 ? refImages.slice(1) : [];

      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspectRatio: videoRatio,
          n: 1,
          negative_prompt: negPrompt || undefined,
          image: primaryRef,
          materials: materialsRefs,
        }),
      });
      if (!res.ok) throw new Error('起始帧生成失败');
      const data = await res.json();
      if (data.success && data.data?.[0]?.url) {
        setEntityCards(prev => prev.map(c =>
          c.id === cardId ? {
            ...c,
            startFrameUrl: data.data[0].url,
            imageUrl: data.data[0].url,
            startFrameGenerating: false,
            shotStatus: c.endFrameUrl ? 'end_ready' : 'start_ready',
          } : c
        ));
        addWorkflowMsg('assistant', `镜头「${card.name}」起始帧生成完成 ✅`, undefined, 'success');
      }
    } catch {
      setEntityCards(prev => prev.map(c =>
        c.id === cardId ? { ...c, startFrameGenerating: false } : c
      ));
      addWorkflowMsg('assistant', `镜头「${card.name}」起始帧生成失败`, undefined, 'error');
    }
  }, [addWorkflowMsg, buildAnchorContext, buildReferenceImages, entityCards, filmVisualStyle, setEntityCards, videoRatio, visualStyle]);

  const handleGenerateEndFrame = useCallback(async (cardId: string) => {
    const card = entityCards.find(c => c.id === cardId);
    if (!card) return;

    addWorkflowMsg('assistant', `正在生成镜头「${card.name}」结束帧...`, undefined, 'progress');
    setEntityCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, endFrameGenerating: true } : c
    ));

    try {
      const anchorCtx = buildAnchorContext(card);
      const rawEndPrompt = card.action
        ? `${card.promptEn}, end of action: ${card.action}, final pose, seamless continuation from start frame${anchorCtx}`
        : `${card.promptEn}, ending frame, resolution, seamless continuation from start frame${anchorCtx}`;
      const endPrompt = filmVisualStyle ? buildStyleLockedPrompt(rawEndPrompt, filmVisualStyle) : `${rawEndPrompt}, cinematic, ${visualStyle}`;
      const negPrompt = filmVisualStyle ? buildEnhancedNegative(filmVisualStyle) : '';
      const refImages = buildReferenceImages(card, card.startFrameUrl);
      const primaryRef = refImages.length > 0 ? refImages[0] : undefined;
      const materialsRefs = refImages.length > 1 ? refImages.slice(1) : [];

      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: endPrompt,
          aspectRatio: videoRatio,
          n: 1,
          negative_prompt: negPrompt || undefined,
          image: primaryRef,
          materials: materialsRefs,
        }),
      });
      if (!res.ok) throw new Error('结束帧生成失败');
      const data = await res.json();
      if (data.success && data.data?.[0]?.url) {
        const endUrl = data.data[0].url;
        setEntityCards(prev => {
          const updated = prev.map(c =>
            c.id === cardId ? (({
              ...c,
              endFrameUrl: endUrl,
              endFrameGenerating: false,
              shotStatus: 'end_ready',
            }) as EntityCard) : c
          );
          const shotCards = updated.filter(c => c.type === 'shot');
          const currentIdx = shotCards.findIndex(c => c.id === cardId);
          if (currentIdx >= 0 && currentIdx < shotCards.length - 1) {
            const nextShot = shotCards[currentIdx + 1];
            const nextIdx = updated.findIndex(c => c.id === nextShot.id);
            if (nextIdx >= 0) {
              const nextCard = updated[nextIdx];
              updated[nextIdx] = {
                ...nextCard,
                prevShotEndFrameUrl: endUrl,
                shotStatus: (nextCard.startFrameUrl ? nextCard.shotStatus : 'start_ready') as EntityCard['shotStatus'],
              } as EntityCard;
            }
          }
          return updated as EntityCard[];
        });
        addWorkflowMsg('assistant', `镜头「${card.name}」结束帧生成完成 ✅`, undefined, 'success');
      }
    } catch {
      setEntityCards(prev => prev.map(c =>
        c.id === cardId ? { ...c, endFrameGenerating: false } : c
      ));
      addWorkflowMsg('assistant', `镜头「${card.name}」结束帧生成失败`, undefined, 'error');
    }
  }, [addWorkflowMsg, buildAnchorContext, buildReferenceImages, entityCards, filmVisualStyle, setEntityCards, videoRatio, visualStyle]);

  const handleBatchGenerateFrames = useCallback(async () => {
    const shotCards = entityCards.filter(c => c.type === 'shot' && c.scriptValidated);
    if (shotCards.length === 0) return;

    const totalFrames = shotCards.length * 2;
    let completedFrames = 0;
    const updateFrameProgress = (name: string) => {
      setGenerationStage('shot');
      setGenerationProgress({ completed: completedFrames, total: totalFrames, currentName: name });
    };

    if (generationMode === 'parallel') {
      setGenerationStage('shot');
      setGenerationProgress({ completed: 0, total: totalFrames, currentName: '首帧' });
      addWorkflowMsg('assistant', `并行模式：同时生成 ${shotCards.length} 个镜头的首帧...`, 'progress');
      const startFramePromises = shotCards.map(async (card) => {
        try {
          updateFrameProgress(`${card.name}·首帧`);
          await handleGenerateStartFrame(card.id);
          completedFrames++;
          return { id: card.id, success: true };
        } catch {
          completedFrames++;
          return { id: card.id, success: false };
        }
      });
      await Promise.allSettled(startFramePromises);

      await new Promise(r => setTimeout(r, 300));

      const latestShotCards = entityCardsRef.current.filter(c => c.type === 'shot' && c.scriptValidated);
      addWorkflowMsg('assistant', `并行模式：同时生成 ${latestShotCards.length} 个镜头的尾帧...`, 'progress');
      const endFramePromises = latestShotCards.map(async (card) => {
        if (card.endFrameUrl) { completedFrames++; return { id: card.id, success: true, skipped: true }; }
        try {
          updateFrameProgress(`${card.name}·尾帧`);
          await handleGenerateEndFrame(card.id);
          completedFrames++;
          return { id: card.id, success: true };
        } catch {
          completedFrames++;
          return { id: card.id, success: false };
        }
      });
      const endResults = await Promise.allSettled(endFramePromises);
      const endSuccessCount = endResults.filter(r => r.status === 'fulfilled' && r.value.success).length;

      setGenerationStage('done');
      setGenerationProgress({ completed: totalFrames, total: totalFrames, currentName: '' });
      addWorkflowMsg('assistant', `并行帧生成完成：${endSuccessCount}/${shotCards.length} 个镜头首尾帧就绪`, 'success');
      setTimeout(() => { setGenerationStage('idle'); }, 2000);
    } else {
      setGenerationStage('shot');
      for (let i = 0; i < shotCards.length; i++) {
        const latestCards = entityCardsRef.current.filter(c => c.type === 'shot' && c.scriptValidated);
        const card = latestCards[i];
        if (!card) continue;
        const prevCard = i > 0 ? latestCards[i - 1] : null;

        if (prevCard?.endFrameUrl) {
          setEntityCards(prev => prev.map(c =>
            c.id === card.id ? {
              ...c,
              startFrameUrl: c.startFrameUrl || prevCard.endFrameUrl,
              prevShotEndFrameUrl: prevCard.endFrameUrl,
              shotStatus: 'start_ready' as const,
            } : c
          ));
        } else if (!card.startFrameUrl) {
          updateFrameProgress(`${card.name}·首帧`);
          await handleGenerateStartFrame(card.id);
          completedFrames++;
        }

        await new Promise(r => setTimeout(r, 200));

        const latestCard = entityCardsRef.current.find(c => c.id === card.id);
        if (latestCard && !latestCard.endFrameUrl) {
          updateFrameProgress(`${card.name}·尾帧`);
          await handleGenerateEndFrame(card.id);
          completedFrames++;
        }
      }
      setGenerationStage('done');
      setGenerationProgress({ completed: completedFrames, total: totalFrames, currentName: '' });
      setTimeout(() => { setGenerationStage('idle'); }, 2000);
    }
  }, [
    addWorkflowMsg,
    entityCards,
    entityCardsRef,
    generationMode,
    handleGenerateEndFrame,
    handleGenerateStartFrame,
    setEntityCards,
    setGenerationProgress,
    setGenerationStage,
  ]);

  const handleBridgeFrames = useCallback(async () => {
    const shotCards = entityCards.filter(c => c.type === 'shot' && c.scriptValidated);
    if (shotCards.length === 0) {
      addWorkflowMsg('assistant', '没有可桥接的镜头卡片', 'warning');
      return;
    }

    setIsGenerating(true);
    setIsBridging(true);

    try {
      setBridgeProgress({ current: 0, total: shotCards.length, phase: '生成首帧' });
      addWorkflowMsg('assistant', `桥接管线 阶段1/3：并行生成 ${shotCards.length} 个镜头的首帧...`, 'progress');

      const startPromises = shotCards.map(async (card) => {
        if (card.startFrameUrl && !card.prevShotEndFrameUrl) {
          return { id: card.id, success: true, skipped: true };
        }
        try {
          await handleGenerateStartFrame(card.id);
          return { id: card.id, success: true };
        } catch {
          return { id: card.id, success: false };
        }
      });
      await Promise.allSettled(startPromises);
      await new Promise(r => setTimeout(r, 300));

      const latestShotCards1 = entityCardsRef.current.filter(c => c.type === 'shot' && c.scriptValidated);
      setBridgeProgress({ current: 0, total: latestShotCards1.length, phase: '生成尾帧' });
      addWorkflowMsg('assistant', `桥接管线 阶段2/3：并行生成 ${latestShotCards1.length} 个镜头的尾帧...`, 'progress');

      const endPromises = latestShotCards1.map(async (card) => {
        if (card.endFrameUrl) {
          return { id: card.id, success: true, skipped: true };
        }
        try {
          await handleGenerateEndFrame(card.id);
          return { id: card.id, success: true };
        } catch {
          return { id: card.id, success: false };
        }
      });
      await Promise.allSettled(endPromises);
      await new Promise(r => setTimeout(r, 300));

      const latestShotCards2 = entityCardsRef.current.filter(c => c.type === 'shot' && c.scriptValidated);
      const bridgeTargets = latestShotCards2.slice(1);
      setBridgeProgress({ current: 0, total: bridgeTargets.length, phase: '桥接首尾帧' });
      addWorkflowMsg('assistant', `桥接管线 阶段3/3：用上一镜头尾帧桥接 ${bridgeTargets.length} 个镜头的首帧...`, 'progress');

      for (let i = 0; i < bridgeTargets.length; i++) {
        const card = bridgeTargets[i];
        const prevCard = latestShotCards2[i];
        const prevEndFrameUrl = entityCardsRef.current.find(c => c.id === prevCard.id)?.endFrameUrl;

        if (!prevEndFrameUrl) {
          addWorkflowMsg('assistant', `镜头 ${i + 1} 的上一镜头尾帧不存在，跳过桥接`, 'warning');
          continue;
        }

        const cardRef = entityCardsRef.current.find(c => c.id === card.id);
        if (!cardRef) continue;

        const refImages = buildReferenceImages(cardRef);
        const bridgeRefImages = [prevEndFrameUrl, ...refImages];

        const anchorCtx = buildAnchorContext(cardRef);
        const styleInfo = filmVisualStyle ? VISUAL_STYLE_MAP[filmVisualStyle as keyof typeof VISUAL_STYLE_MAP] : null;
        const stylePrefix = styleInfo?.prefix || '';
        const lockPhrase = styleInfo?.lockPhrase || '';
        const styleNeg = buildEnhancedNegative(filmVisualStyle || '');
        const bridgePrompt = `${lockPhrase ? lockPhrase + ', ' : ''}Transition shot continuing from previous scene, seamless visual continuity, ${anchorCtx}${stylePrefix ? ', ' + stylePrefix : ''}. Previous shot ended with a frame - this new frame should feel like the natural next moment.`;

        try {
          const res = await fetch('/api/image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: bridgePrompt,
              image: bridgeRefImages,
              negative_prompt: styleNeg || undefined,
              width: 1280,
              height: 720,
            }),
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const imageUrl = data?.data?.imageUrl || data?.imageUrl;

          if (imageUrl) {
            setEntityCards(prev => prev.map(c =>
              c.id === card.id ? {
                ...c,
                startFrameUrl: imageUrl,
                prevShotEndFrameUrl: prevEndFrameUrl,
                shotStatus: 'start_ready' as const,
              } : c
            ));
            addWorkflowMsg('assistant', `镜头 ${i + 2} 首帧已桥接（参考上一镜头尾帧）`, 'success');
          }
        } catch (err) {
          console.error(`桥接镜头 ${i + 2} 失败:`, err);
          setEntityCards(prev => prev.map(c =>
            c.id === card.id ? {
              ...c,
              startFrameUrl: c.startFrameUrl || prevEndFrameUrl,
              prevShotEndFrameUrl: prevEndFrameUrl,
              shotStatus: 'start_ready' as const,
            } : c
          ));
          addWorkflowMsg('assistant', `镜头 ${i + 2} 桥接失败，已复制上一镜头尾帧`, 'warning');
        }

        setBridgeProgress(prev => prev ? { ...prev, current: i + 1 } : null);
      }

      addWorkflowMsg('assistant', `桥接管线完成！${shotCards.length} 个镜头首尾帧已桥接`, 'success');
    } finally {
      setIsGenerating(false);
      setIsBridging(false);
      setBridgeProgress(null);
    }
  }, [
    addWorkflowMsg,
    buildAnchorContext,
    buildReferenceImages,
    entityCards,
    entityCardsRef,
    filmVisualStyle,
    handleGenerateEndFrame,
    handleGenerateStartFrame,
    setBridgeProgress,
    setEntityCards,
    setIsBridging,
    setIsGenerating,
  ]);

  return {
    handleGenerateStartFrame,
    handleGenerateEndFrame,
    handleBatchGenerateFrames,
    handleBridgeFrames,
  };
}
