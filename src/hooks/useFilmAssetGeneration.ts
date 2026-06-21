import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { CharacterAnchor } from '@/lib/video-production/character-consistency-engine';
import { buildEnhancedNegative, buildStyleLockedPrompt } from '@/lib/visual-style-map';
import type { EntityCard, WorkflowPhase } from '@/lib/film-creation-panel-model';
import type { FilmScript } from '@/types/film';
import type { FilmVisualGenerationStage } from '@/components/film/film-visual-progress-panel';

type WorkflowMessageRole = 'system' | 'assistant' | 'user' | 'info' | 'success' | 'error';
type WorkflowMessageType = 'progress' | 'success' | 'error' | 'info';
type GenerationStage = FilmVisualGenerationStage;
type GenerationProgress = { completed: number; total: number; currentName: string };
type MiddleAiStatus = { text: string; type: 'thinking' | 'responding' | 'done' | 'error' } | null;
type LogStatus = 'generating' | 'completed' | 'error' | 'waiting';

type UseFilmAssetGenerationArgs = {
  addGenLog: (shotIndex: number, shotLabel: string, action: string, status: LogStatus, progress?: number, error?: string) => void;
  addWorkflowMsg: (role: WorkflowMessageRole, content: string, step?: string, msgType?: WorkflowMessageType, nextStep?: string) => void;
  buildReferenceImagesRef: MutableRefObject<(card: EntityCard, continuityRef?: string) => string[]>;
  entityCards: EntityCard[];
  entityCardsRef: MutableRefObject<EntityCard[]>;
  filmVisualStyle: string;
  script: FilmScript | null;
  setEntityCards: React.Dispatch<React.SetStateAction<EntityCard[]>>;
  setGenerationProgress: React.Dispatch<React.SetStateAction<GenerationProgress>>;
  setGenerationStage: React.Dispatch<React.SetStateAction<GenerationStage>>;
  setIsGenerating: (value: boolean) => void;
  setMiddleAiStatus: React.Dispatch<React.SetStateAction<MiddleAiStatus>>;
  setPhase: (phase: WorkflowPhase) => void;
  setProgressMsg: (message: string) => void;
  style: string;
  visualStyle: string;
};

export function useFilmAssetGeneration(args: UseFilmAssetGenerationArgs) {
  const {
    addGenLog, addWorkflowMsg, buildReferenceImagesRef, entityCards, entityCardsRef,
    filmVisualStyle, script, setEntityCards, setGenerationProgress, setGenerationStage,
    setIsGenerating, setMiddleAiStatus, setPhase, setProgressMsg, style, visualStyle,
  } = args;

  const handleGenerateAllAssets = useCallback(async () => {
    if (!script) return;
    setIsGenerating(true);

    const characterCards = entityCards.filter(c => c.type === 'character');
    const sceneCards = entityCards.filter(c => c.type === 'scene');
    const propCards = entityCards.filter(c => c.type === 'prop');
    const shotCards = entityCards.filter(c => c.type === 'shot');

    const totalAssetCards = characterCards.length + sceneCards.length + propCards.length + shotCards.length;
    let completedCount = 0;

    const updateProgress = (stage: 'character' | 'scene' | 'prop' | 'shot' | 'done', name: string) => {
      setGenerationStage(stage);
      setGenerationProgress(prev => ({ ...prev, completed: completedCount, total: totalAssetCards, currentName: name }));
    };

    addWorkflowMsg('assistant', '正在并行生成角色图+场景图+道具图，分镜图稍后...', 'progress');
    setProgressMsg('并行生成角色+场景+道具...');
    setGenerationStage('character');
    characterCards.forEach(c => addGenLog(entityCards.indexOf(c), c.name, '角色图生成', 'generating'));
    sceneCards.forEach(c => addGenLog(entityCards.indexOf(c), c.name, '场景图生成', 'generating'));
    propCards.forEach(c => addGenLog(entityCards.indexOf(c), c.name, '道具图生成', 'generating'));
    setGenerationProgress({ completed: 0, total: totalAssetCards, currentName: '角色' });

    // 阶段1：角色和场景并行生成（前端直接调用API，不走后端批量接口）
    const parallelTasks: Promise<{ type: string; cardId: string; imageUrl?: string }[]>[] = [];

    // 并行生成角色三视图
    updateProgress('character', '角色');
    for (const card of characterCards) {
      if (!card.promptEn && !card.promptCn) continue;
      parallelTasks.push((async () => {
        try {
          setEntityCards(prev => prev.map(c => c.id === card.id ? { ...c, isGenerating: true } : c));
          updateProgress('character', card.name);
          const res = await fetch('/api/film/character-views', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              characterName: card.name,
              promptEn: card.promptEn,
              appearance: card.appearance || card.promptCn,
              style: visualStyle || style,
              filmVisualStyle: filmVisualStyle || undefined,
            }),
          });
          if (!res.ok) return [];
          const data = await res.json();
          const imageUrl = data.imageUrl || (data.views?.[0]?.imageUrl);
          completedCount++;
          return imageUrl ? [{ type: 'character', cardId: card.id, imageUrl }] : [];
        } catch { completedCount++; return []; }
      })());
    }

    // 全局风格映射使用模块级常量 VISUAL_STYLE_MAP（确保全场画风一致）

    // 并行生成场景图（三重风格锁定 + 增强版negative + 禁止出现人物）
    updateProgress('scene', '场景');
    for (const card of sceneCards) {
      if (!card.promptEn && !card.promptCn) continue;
      parallelTasks.push((async () => {
        try {
          setEntityCards(prev => prev.map(c => c.id === card.id ? { ...c, isGenerating: true } : c));
          updateProgress('scene', card.name);
          const rawPrompt = card.promptEn || card.promptCn;
          // 场景图禁止出现人物：追加 no people 约束
          const scenePrompt = `${rawPrompt}, empty scene, no people, no characters, devoid of human figures`;
          // 三重风格锁定: lockPhrase + prompt + prefix
          const prompt = filmVisualStyle ? buildStyleLockedPrompt(scenePrompt, filmVisualStyle) : scenePrompt;
          const negPrompt = filmVisualStyle
            ? `${buildEnhancedNegative(filmVisualStyle)}, person, people, character, human, figure, man, woman, child, boy, girl`
            : 'person, people, character, human, figure, man, woman, child, boy, girl';
          const res = await fetch('/api/image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, negative_prompt: negPrompt || undefined }),
          });
          if (!res.ok) { completedCount++; return []; }
          const data = await res.json();
          const imageUrl = data.imageUrls?.[0] || data.imageUrl;
          completedCount++;
          return imageUrl ? [{ type: 'scene', cardId: card.id, imageUrl }] : [];
        } catch { completedCount++; return []; }
      })());
    }

    // 并行生成道具图（三重风格锁定 + 产品摄影风格）
    updateProgress('prop', '道具');
    for (const card of propCards) {
      if (!card.promptEn && !card.promptCn) continue;
      parallelTasks.push((async () => {
        try {
          setEntityCards(prev => prev.map(c => c.id === card.id ? { ...c, isGenerating: true } : c));
          updateProgress('prop', card.name);
          const rawPrompt = card.promptEn || card.promptCn;
          const propPrompt = card.propCloseup
            ? `${rawPrompt}, close-up shot, detailed product photography, isolated on neutral background, macro detail`
            : `${rawPrompt}, product photography, isolated on neutral background, detailed, high quality`;
          const prompt = filmVisualStyle ? buildStyleLockedPrompt(propPrompt, filmVisualStyle) : propPrompt;
          const negPrompt = filmVisualStyle
            ? `${buildEnhancedNegative(filmVisualStyle)}, person, people, character, human, hand, blurry, low quality`
            : 'person, people, character, human, hand, blurry, low quality';
          const res = await fetch('/api/image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, negative_prompt: negPrompt || undefined }),
          });
          if (!res.ok) { completedCount++; return []; }
          const data = await res.json();
          const imageUrl = data.imageUrls?.[0] || data.imageUrl;
          completedCount++;
          return imageUrl ? [{ type: 'prop', cardId: card.id, imageUrl }] : [];
        } catch { completedCount++; return []; }
      })());
    }

    const parallelResults = await Promise.all(parallelTasks);
    const flatResults = parallelResults.flat();

    // 更新卡片
    for (const result of flatResults) {
      if (result.imageUrl) {
        setEntityCards(prev => prev.map(c =>
          c.id === result.cardId ? { ...c, imageUrl: result.imageUrl, isGenerating: false, isPromptGenerated: true } : c
        ));
      }
    }

    // 标记角色/场景/道具日志完成
    characterCards.forEach(c => addGenLog(entityCards.indexOf(c), c.name, '角色图生成', 'completed'));
    sceneCards.forEach(c => addGenLog(entityCards.indexOf(c), c.name, '场景图生成', 'completed'));
    propCards.forEach(c => addGenLog(entityCards.indexOf(c), c.name, '道具图生成', 'completed'));

    // 阶段2：分镜画面（并行生成，注入角色/场景/道具一致性上下文和参考图）
    setProgressMsg('并行生成分镜画面...');
    addWorkflowMsg('assistant', `角色+场景+道具并行生成完成(${flatResults.filter(r => r.imageUrl).length}张)，并行生成分镜(含一致性上下文)...`, 'progress');
    setGenerationStage('shot');

    // 先获取最新卡片状态（包含已生成的角色/场景/道具图）
    const latestCards = entityCardsRef.current;
    const latestCharacterCards = latestCards.filter(c => c.type === 'character');
    const latestSceneCards = latestCards.filter(c => c.type === 'scene');
    const latestPropCards = latestCards.filter(c => c.type === 'prop');

    // ★ 阶段2：分镜画面（FLF2V首尾帧模式，确保视觉连贯性）
    // 顺序生成每个镜头的起始帧+结束帧，后一镜头参考前一镜头尾帧
    setProgressMsg('按首尾帧模式顺序生成分镜画面...');
    addWorkflowMsg('assistant', `角色+场景+道具并行生成完成(${flatResults.filter(r => r.imageUrl).length}张)，按首尾帧模式生成分镜...`, 'progress');
    setGenerationStage('shot');

    // ★ FLF2V：逐镜头顺序生成（确保尾帧连续性）
    for (let si = 0; si < shotCards.length; si++) {
      const card = shotCards[si];
      if (!card.promptEn && !card.promptCn) continue;

      try {
        setEntityCards(prev => prev.map(c => c.id === card.id ? { ...c, isGenerating: true, startFrameGenerating: true } : c));
        updateProgress('shot', `${card.name} 起始帧`);

        // === 构建增强提示词（含一致性注入）===
        let enhancedPrompt = card.promptEn || card.promptCn;
        let endFramePrompt = enhancedPrompt; // 结束帧提示词

        // 注入剧本叙事上下文
        if (script) {
          const matchingScreenplay = script.screenplay?.find(sp => sp.sceneNumber === card.sceneNumber);
          if (matchingScreenplay?.stageDirections) {
            enhancedPrompt += `, Story context: ${matchingScreenplay.stageDirections.substring(0, 200)}`;
          }
          if (card.dialogue || card.narration) {
            enhancedPrompt += `, Dialogue: ${(card.dialogue || card.narration || '').substring(0, 100)}`;
          }
          if (card.emotion || card.mood) {
            enhancedPrompt += `, Emotion: ${card.emotion || card.mood}`;
          }
          // 结束帧追加动作结束状态描述
          if (card.action) {
            endFramePrompt = `${enhancedPrompt}, ending state of action: ${card.action}`;
          }
        }

        // 角色外观参考
        const charDescParts = (card.characters || []).map((charRef: string) => {
          const ch = latestCharacterCards.find(c => c.id === charRef || c.name === charRef);
          if (!ch) return '';
          const appearance = [ch.appearance, ch.outfit].filter(Boolean).join(', ');
          return appearance ? `${ch.name}(${appearance})` : '';
        }).filter(Boolean);

        // 场景视觉参考
        const sceneRef = card.sceneId
          ? latestSceneCards.find(s => s.id === card.sceneId)
          : latestSceneCards[0];
        const sceneContext = sceneRef
          ? `Scene: ${sceneRef.description || sceneRef.promptEn || ''}`
          : '';

        const consistencyParts: string[] = [];
        if (charDescParts.length > 0) {
          consistencyParts.push(`featuring: ${charDescParts.join('. ')}`);
        }
        if (sceneContext) {
          consistencyParts.push(sceneContext);
        }
        consistencyParts.push('consistent character appearance and scene style');

        // 注入角色视觉锚点
        const anchorChars = (card.characters || []).map((charRef: string) => {
          const ch = latestCharacterCards.find(c => c.id === charRef || c.name === charRef);
          return ch?.anchor ? { name: ch.name, anchor: ch.anchor } : null;
        }).filter(Boolean) as { name: string; anchor: CharacterAnchor }[];
        if (anchorChars.length > 0) {
          for (const ac of anchorChars) {
            const anchorDesc = [
              ac.anchor.faceAnchor ? `face: ${Object.values(ac.anchor.faceAnchor).filter(Boolean).join(', ')}` : '',
              ac.anchor.bodyAnchor ? `body: ${Object.values(ac.anchor.bodyAnchor).filter(Boolean).join(', ')}` : '',
              ac.anchor.hairAnchor ? `hair: ${Object.values(ac.anchor.hairAnchor).filter(Boolean).join(', ')}` : '',
              ac.anchor.costumeAnchor ? `outfit: ${Object.values(ac.anchor.costumeAnchor).filter(Boolean).join(', ')}` : '',
            ].filter(Boolean).join(', ');
            if (anchorDesc) consistencyParts.push(`${ac.name} anchor: ${anchorDesc}`);
          }
        }

        if (consistencyParts.length > 1) {
          enhancedPrompt = `${enhancedPrompt}, ${consistencyParts.join(', ')}`;
          endFramePrompt = `${endFramePrompt}, ${consistencyParts.join(', ')}`;
        }

        // 三重风格锁定
        let negativePrompt = '';
        if (filmVisualStyle) {
          enhancedPrompt = buildStyleLockedPrompt(enhancedPrompt, filmVisualStyle);
          endFramePrompt = buildStyleLockedPrompt(endFramePrompt, filmVisualStyle);
          negativePrompt = buildEnhancedNegative(filmVisualStyle);
        }

        // ★ 起始帧：收集参考图 + 上一镜头尾帧（FLF2V连续性）
        const prevCard = si > 0 ? shotCards[si - 1] : null;
        const prevEndFrameUrl = prevCard?.endFrameUrl || (entityCardsRef.current.find(c => c.id === prevCard?.id) as EntityCard | undefined)?.endFrameUrl;
        const refImages = buildReferenceImagesRef.current(card, prevEndFrameUrl);
        const primaryRef = refImages.length > 0 ? refImages[0] : undefined;
        const materialsRefs = refImages.length > 1 ? refImages.slice(1) : undefined;

        // === 生成起始帧 ===
        addWorkflowMsg('assistant', `镜头${si + 1}/${shotCards.length}「${card.name}」生成起始帧...`, 'progress');
        const startRes = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            negative_prompt: negativePrompt || undefined,
            image: primaryRef,
            materials: materialsRefs,
          }),
        });

        let startFrameUrl = '';
        if (startRes.ok) {
          const startData = await startRes.json();
          startFrameUrl = startData.imageUrls?.[0] || startData.imageUrl;
          if (startFrameUrl) {
            setEntityCards(prev => prev.map(c => c.id === card.id ? {
              ...c, startFrameUrl, startFrameGenerating: false,
              imageUrl: startFrameUrl, // 兼容：同时更新imageUrl
              isPromptGenerated: true,
            } : c));
          }
        } else {
          const errData = await startRes.json().catch(() => ({ error: '起始帧生成失败' }));
          console.error(`[Film] 起始帧生成失败(${card.name}):`, errData.error);
        }

        // === 生成结束帧 ===
        setEntityCards(prev => prev.map(c => c.id === card.id ? { ...c, startFrameGenerating: false, endFrameGenerating: true } : c));
        updateProgress('shot', `${card.name} 结束帧`);
        addWorkflowMsg('assistant', `镜头${si + 1}/${shotCards.length}「${card.name}」生成结束帧...`, 'progress');

        // 结束帧参考：起始帧作为主参考 + 角色场景素材
        const endRefImages: string[] = [];
        if (startFrameUrl) endRefImages.push(startFrameUrl);
        // 额外角色/场景参考
        const extraRefs = buildReferenceImagesRef.current(card);
        for (const r of extraRefs) {
          if (!endRefImages.includes(r)) endRefImages.push(r);
        }
        const endPrimaryRef = endRefImages.length > 0 ? endRefImages[0] : undefined;
        const endMaterialsRefs = endRefImages.length > 1 ? endRefImages.slice(1) : undefined;

        const endRes = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: endFramePrompt,
            negative_prompt: negativePrompt || undefined,
            image: endPrimaryRef,
            materials: endMaterialsRefs,
          }),
        });

        if (endRes.ok) {
          const endData = await endRes.json();
          const endFrameUrl = endData.imageUrls?.[0] || endData.imageUrl;
          if (endFrameUrl) {
            setEntityCards(prev => prev.map(c => c.id === card.id ? {
              ...c, endFrameUrl, endFrameGenerating: false,
              isGenerating: false, isPromptGenerated: true,
            } : c));
            addWorkflowMsg('assistant', `镜头「${card.name}」首尾帧生成完成 ✓`, 'success', 'success');
          }
        } else {
          const errData = await endRes.json().catch(() => ({ error: '结束帧生成失败' }));
          console.error(`[Film] 结束帧生成失败(${card.name}):`, errData.error);
          setEntityCards(prev => prev.map(c => c.id === card.id ? { ...c, endFrameGenerating: false, isGenerating: false } : c));
        }

        completedCount++;
      } catch (err) {
        completedCount++;
        const errMsg = err instanceof Error ? err.message : '画面生成异常';
        console.error(`[Film] 画面生成异常(${card.name}):`, errMsg);
        setEntityCards(prev => prev.map(c => c.id === card.id ? { ...c, isGenerating: false, startFrameGenerating: false, endFrameGenerating: false, errorMsg: errMsg } : c));
      }
    }

    setGenerationStage('done');
    setGenerationProgress(prev => ({ ...prev, completed: totalAssetCards, currentName: '' }));
    addWorkflowMsg('assistant', `首尾帧模式生成完成！角色${characterCards.length}个、场景${sceneCards.length}个、道具${propCards.length}个、分镜${shotCards.length}张(含首尾帧)`, 'success', 'success');

    // ★ 阶段3：画面一致性自查 + 剧本逻辑校验
    setMiddleAiStatus({ type: 'thinking', text: '正在自查画面一致性与剧本逻辑...' });
    addWorkflowMsg('assistant', '正在进行画面一致性自查与剧本逻辑校验...', 'progress');

    try {
      // 构建一致性检查所需的数据
      const finalCards = entityCardsRef.current;
      const finalShotCards = finalCards.filter(c => c.type === 'shot');
      const characterBibles = finalCards.filter(c => c.type === 'character').map(c => ({
        name: c.name,
        appearance: c.appearance || c.promptCn || '',
        anchor: c.anchor,
      }));
      const sceneBibles = finalCards.filter(c => c.type === 'scene').map(c => ({
        name: c.name,
        description: c.description || c.promptCn || '',
      }));

      const shotsForCheck = finalShotCards.map(c => ({
        name: c.name,
        prompt: c.promptEn || c.promptCn || '',
        characters: c.characters || [],
        sceneId: c.sceneId,
        startFrameUrl: c.startFrameUrl,
        endFrameUrl: c.endFrameUrl,
        action: c.action,
        dialogue: c.dialogue,
        narration: c.narration,
        emotion: c.emotion,
        shotNumber: c.shotNumber,
      }));

      // 调用一致性检查API
      const checkRes = await fetch('/api/video/consistency-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check',
          shots: shotsForCheck,
          characterBibles,
          sceneBibles,
        }),
      });

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        const result = checkData.result;
        if (result) {
          // 更新每个镜头的一致性评分和问题
          if (result.issues && result.issues.length > 0) {
            for (const issue of result.issues) {
              addWorkflowMsg('info', `⚠️ 一致性警告: ${issue}`, undefined, 'info');
            }
            setMiddleAiStatus({ type: 'error', text: `一致性检查发现${result.issues.length}个问题(评分:${result.score || 'N/A'})` });
          } else {
            setMiddleAiStatus({ type: 'done', text: `一致性检查通过(评分:${result.score || 100})` });
          }
          // 更新镜头卡片的一致性分数
          setEntityCards(prev => prev.map(c => {
            if (c.type === 'shot') {
              return { ...c, consistencyScore: result.score ?? 100, consistencyIssues: result.issues || [] };
            }
            return c;
          }));
        }
      }

      // ★ 剧本逻辑校验：检查每个镜头的分镜内容是否与剧本叙事一致
      if (script?.screenplay) {
        const logicIssues: string[] = [];
        for (const shot of finalShotCards) {
          const matchingScene = script.screenplay.find(sp => sp.sceneNumber === shot.sceneNumber);
          if (!matchingScene) {
            logicIssues.push(`镜头「${shot.name}」未匹配到剧本场景${shot.sceneNumber}`);
            continue;
          }
          // 检查镜头角色是否在场景对白角色列表中
          if (shot.characters?.length && matchingScene.dialogues?.length) {
            const sceneChars = matchingScene.dialogues.map((d: { character: string }) => d.character.toLowerCase());
            for (const shotChar of shot.characters) {
              if (!sceneChars.some((sc: string) => sc.includes(shotChar.toLowerCase()) || shotChar.toLowerCase().includes(sc))) {
                logicIssues.push(`镜头「${shot.name}」中的角色「${shotChar}」不在场景${shot.sceneNumber}的角色列表中`);
              }
            }
          }
          // 检查镜头是否有动作/对白（空白镜头预警）
          if (!shot.action && !shot.dialogue && !shot.narration && !shot.promptCn) {
            logicIssues.push(`镜头「${shot.name}」缺少动作/对白/旁白描述`);
          }
        }
        if (logicIssues.length > 0) {
          for (const issue of logicIssues) {
            addWorkflowMsg('info', `⚠️ 剧本逻辑: ${issue}`, undefined, 'info');
          }
          addWorkflowMsg('info', `剧本逻辑校验发现${logicIssues.length}个问题，建议检查分镜与剧本的对应关系`, undefined, 'info');
        } else {
          addWorkflowMsg('success', '剧本逻辑校验通过，分镜与剧本叙事一致 ✓', undefined, 'success');
        }
      }
    } catch (err) {
      console.error('[Film] 一致性检查异常:', err);
      addWorkflowMsg('info', '一致性自查未完成，可稍后手动检查', undefined, 'info');
    }

    setIsGenerating(false);
    setProgressMsg('');

    // ★ 自动链式生成：资产图生成完成 → 自动切换到画面阶段
    setPhase('visual');
    setTimeout(() => setMiddleAiStatus(null), 5000);
    setTimeout(() => { setGenerationStage('idle'); }, 2000);
  }, [script, entityCards, addWorkflowMsg, visualStyle, style, filmVisualStyle, setPhase]);

  return { handleGenerateAllAssets };
}
