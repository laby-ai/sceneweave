import type {
  DirectorCharacterCard,
  DirectorSceneCard,
  FilmCharacter,
  FilmScene,
  FilmScript,
  ScreenplayScene,
} from '@/types/film';

export function generateShotsFromScenes(
  scenes: FilmScript['scenes'],
  characters: FilmScript['characters'],
  targetDuration: number
): FilmScript['shots'] {
  const shots: FilmScript['shots'] = [];
  const shotTypes = ['全景', '中景', '特写', '近景'];
  const cameraAngles = ['平视', '微俯', '微仰'];
  const cameraMovements = ['缓慢推进', '横向移动', '固定', '缓慢拉远'];

  let shotIndex = 0;
  const avgDuration = Math.min(6, Math.max(4, Math.floor(targetDuration / (scenes.length * 2.5))));

  for (const scene of scenes) {
    const sceneId = scene.id || `scene_${scene.sceneNumber || 1}`;
    const sceneChars = characters
      .filter(c => {
        const sceneText = `${scene.name || ''} ${scene.description || ''} ${scene.location || ''}`;
        return sceneText.includes(c.name);
      })
      .map(c => c.id || '');

    const shotsPerScene = Math.max(2, Math.min(3, Math.ceil(targetDuration / scenes.length / avgDuration)));

    for (let i = 0; i < shotsPerScene; i++) {
      shotIndex++;
      const isEstablishing = i === 0;
      const shotType = isEstablishing ? '全景' : shotTypes[Math.min(i, shotTypes.length - 1)];
      const camAngle = cameraAngles[i % cameraAngles.length];
      const camMove = isEstablishing ? '缓慢推进' : cameraMovements[i % cameraMovements.length];

      const charNames = sceneChars.length > 0
        ? characters.filter(c => sceneChars.includes(c.id)).map(c => c.name).join('和')
        : '角色';
      const charVisual = sceneChars.length > 0
        ? characters.filter(c => sceneChars.includes(c.id)).map(c =>
            `[Character: ${c.appearance || 'natural features'} wearing ${c.outfit || 'casual attire'}]`
          ).join(' ')
        : '';
      const sceneVisual = `[Scene: ${scene.colorPalette || 'natural colors'} + ${scene.lightingDir || 'natural lighting'} + ${scene.mood || 'neutral mood'}]`;

      const contentParts = [
        `${isEstablishing ? ' establishing shot of' : ''} ${scene.location || scene.name || '场景'}`,
        `${scene.mood || '平静'}的氛围，${scene.lightingDir || '自然光'}照射`,
        `${charNames}${isEstablishing ? '出现在画面中' : '的' + shotType}`,
        `${scene.description || ''}`.substring(0, 80),
      ];
      const content = contentParts.filter(Boolean).join('，');
      const contentEn = `${isEstablishing ? 'Establishing shot of' : shotType + ' of'} ${scene.location || scene.name || 'scene'}, ${scene.mood || 'calm'} atmosphere, ${scene.lightingDir || 'natural light'} ${charVisual} ${sceneVisual}`;
      const soundDesignText = `${scene.mood === '紧张' ? '心跳声+紧张弦乐' : scene.mood === '欢快' ? '鸟鸣+轻快旋律' : '风声+环境白噪音'}，${scene.indoor ? '室内回响' : '户外开阔声'}`;

      shots.push({
        id: `shot_${scene.sceneNumber || 1}_${i + 1}`,
        sceneId,
        sceneNumber: scene.sceneNumber || 1,
        shotNumber: shotIndex,
        shotType,
        cameraAngle: camAngle,
        cameraMovement: camMove,
        content,
        contentEn,
        dialogue: '',
        narration: '',
        action: '',
        soundEffect: soundDesignText,
        duration: avgDuration,
        characters: sceneChars,
        status: 'pending',
        emotionTag: scene.mood || '中性',
        emotionIntensity: scene.mood === '紧张' ? 8 : scene.mood === '欢快' ? 6 : 5,
        colorNarrative: `${scene.colorPalette || '自然色调'}，中等饱和度`,
        soundDesign: soundDesignText,
        bgmChange: `段落${scene.sceneNumber || 1}-${i + 1}，${scene.mood || '中性'}情绪`,
      });
    }
  }

  return shots;
}

export function fillMissingFilmScriptFields(script: FilmScript, targetDuration: number): void {
  console.log(`[Film Script Agent] fillMissingFields: chars=${script.characters?.length || 0} scenes=${script.scenes?.length || 0} shots=${script.shots?.length || 0} screenplay=${Array.isArray(script.screenplay) ? script.screenplay.length : typeof script.screenplay} directorPlan=${script.directorPlan ? 'exists' : 'no'}`);

  const dpCharCards = script.directorPlan?.characterCards;
  if ((!script.characters || script.characters.length === 0) && dpCharCards && dpCharCards.length > 0) {
    script.characters = dpCharCards.map((c, i) => ({
      id: c.id || `char_${i + 1}`,
      name: c.name || `角色${i + 1}`,
      age: c.age || '未知',
      gender: (c.gender === '男' || c.gender === '女' ? c.gender : '不限') as FilmCharacter['gender'],
      appearance: c.appearance || '待补充',
      personality: '待补充',
      seed: Math.floor(Math.random() * 1000000),
      outfit: c.outfit || '',
      characterArc: c.arc || '',
      motivation: c.motivation || '',
      relationships: c.relationships || {},
      signatureDetail: c.signatureDetail || '',
    }));
  }

  if ((!script.characters || script.characters.length === 0) && (script.shots?.length > 0 || Array.isArray(script.screenplay))) {
    const charSet = new Set<string>();
    script.shots?.forEach(s => {
      if (Array.isArray(s.characters)) s.characters.forEach(c => charSet.add(c));
    });
    if (Array.isArray(script.screenplay)) {
      script.screenplay.forEach(sc => {
        if (Array.isArray(sc.dialogues)) {
          sc.dialogues.forEach((d: { character?: string }) => {
            if (d.character && d.character.trim()) charSet.add(d.character.trim());
          });
        }
      });
    }
    if (charSet.size > 0) {
      script.characters = Array.from(charSet).map((charName) => ({
        id: charName.startsWith('char_') ? charName : `char_${charName}`,
        name: charName.startsWith('char_') ? charName.replace('char_', '') : charName,
        age: '未知',
        gender: '不限' as const,
        appearance: '待补充',
        personality: '待补充',
        seed: Math.floor(Math.random() * 1000000),
      }));
    }
  }

  const dpSceneCards = script.directorPlan?.sceneCards;
  if ((!script.scenes || script.scenes.length === 0) && dpSceneCards && dpSceneCards.length > 0) {
    script.scenes = dpSceneCards.map(s => ({
      id: s.id || `scene_${s.sceneNumber || 1}`,
      sceneNumber: s.sceneNumber || 1,
      name: s.name || `场景${s.sceneNumber || 1}`,
      location: s.location || '待补充',
      timeOfDay: (s.timeOfDay === '日' || s.timeOfDay === '夜' || s.timeOfDay === '晨' || s.timeOfDay === '黄昏' ? s.timeOfDay : '日') as FilmScene['timeOfDay'],
      indoor: s.interior ?? false,
      description: s.visualDescription || s.mood || '待补充',
      mood: s.mood || '中性',
      colorPalette: s.colorPalette || '',
    }));
  }

  if ((!script.scenes || script.scenes.length === 0) && script.shots?.length > 0) {
    const sceneMap = new Map<number, { id: string; number: number; count: number }>();
    script.shots.forEach(s => {
      const sn = s.sceneNumber || 1;
      if (!sceneMap.has(sn)) sceneMap.set(sn, { id: s.sceneId || `scene_${sn}`, number: sn, count: 0 });
      sceneMap.get(sn)!.count++;
    });
    if (sceneMap.size > 0) {
      script.scenes = Array.from(sceneMap.values()).map(s => ({
        id: s.id,
        sceneNumber: s.number,
        name: `场景${s.number}`,
        location: '待补充',
        timeOfDay: '日' as const,
        indoor: false,
        description: '待补充',
        mood: '中性',
      }));
    }
  }

  if (!script.coreTheme) {
    const charNames = script.characters?.map(c => c.name).filter(Boolean).join('、') || '';
    const emotionParts = (script.emotionCurve || '').split('→').map(s => s.trim()).filter(Boolean);
    const emotionHint = emotionParts.length > 1 ? `，情感主线：${emotionParts[0]}到${emotionParts[emotionParts.length - 1]}` : '';
    script.coreTheme = charNames
      ? `${charNames}的${script.title || '原创'}故事${emotionHint}`
      : script.title ? `关于${script.title}的故事${emotionHint}` : '原创影视故事';
  }
  if (!script.colorNarrativeLine && script.shots?.length > 0) {
    const colors = script.shots.map(s => s.colorNarrative || '自然色调');
    script.colorNarrativeLine = [...new Set(colors)].join(' → ');
  }
  if (!script.emotionCurve && script.shots?.length > 0) {
    script.emotionCurve = script.shots.map(s => s.emotionTag || '中性').join(' → ');
  }
  if (!script.narrationScript && script.shots?.length > 0) {
    const narrations = script.shots
      .filter(s => s.narration)
      .map(s => `[语速:正常] ${s.narration} [停顿:1秒]`)
      .join('\n');
    if (narrations) script.narrationScript = narrations;
  }
  if (!script.bgmSuggestion || script.bgmSuggestion.length < 10) {
    if (script.shots?.length > 0) {
      const sceneGroups = new Map<number, { moods: string[]; count: number }>();
      script.shots.forEach(s => {
        const sn = s.sceneNumber || 1;
        if (!sceneGroups.has(sn)) sceneGroups.set(sn, { moods: [], count: 0 });
        const g = sceneGroups.get(sn)!;
        g.moods.push(s.emotionTag || '中性');
        g.count++;
      });
      const bgms = Array.from(sceneGroups.entries()).map(([sn, g]) => {
        const mood = g.moods[0] || '中性';
        return `段落${sn}：风格-${mood === '紧张' ? '悬疑' : mood === '欢快' ? '轻快' : '抒情'}，情绪-${mood}，节奏-${mood === '紧张' ? '急促' : mood === '欢快' ? '轻快' : '舒缓'}，音量-${mood === '紧张' ? '渐强' : '平稳'}`;
      });
      script.bgmSuggestion = bgms.join('\n');
    } else {
      script.bgmSuggestion = '段落1：风格-抒情，情绪-温暖，节奏-舒缓，音量-平稳';
    }
  }
  if (!script.subtitleSuggestion || script.subtitleSuggestion.length < 10) {
    script.subtitleSuggestion = '字体-思源黑体，大小-中等，颜色-白色半透明，位置-底部居中，动画-淡入淡出';
  }
  if (!script.totalDuration || script.totalDuration === 0) {
    script.totalDuration = script.shots?.length > 0
      ? script.shots.reduce((sum, s) => sum + (s.duration || 5), 0)
      : targetDuration;
  }

  if ((!script.screenplay || (Array.isArray(script.screenplay) && script.screenplay.length === 0)) && script.scenes?.length > 0) {
    const screenplay: ScreenplayScene[] = script.scenes.map((scene, si) => {
      const sceneShots = (script.shots || []).filter(s => s.sceneId === scene.id || s.sceneNumber === si + 1);
      const dialogues = sceneShots
        .filter(s => s.dialogue)
        .map(s => ({
          character: s.characters?.[0]?.replace('char_', '角色') || '旁白',
          line: s.dialogue || '',
          direction: s.action || '',
        }));

      if (dialogues.length === 0 && sceneShots.length > 0) {
        sceneShots.forEach(shot => {
          if (!shot.content) return;
          const quotedMatches = shot.content.match(/['"「」『』]([^'"「」『』]+)['"「」『』]/g);
          quotedMatches?.forEach(q => {
            dialogues.push({
              character: shot.characters?.[0]?.replace('char_', '角色') || '角色',
              line: q.replace(/^['"「」『』]|['"「」『』]$/g, ''),
              direction: '',
            });
          });
        });
      }

      if (dialogues.length === 0) {
        const charNames = sceneShots.flatMap(s => s.characters || []).map(c => c.replace('char_', ''));
        const uniqueChars = [...new Set(charNames)];
        if (uniqueChars.length > 0) {
          const mood = scene.mood || '中性';
          const moodLines: Record<string, string[]> = {
            '紧张': ['我们必须快点...', '等等，你听到了吗？'],
            '欢快': ['太好了！我们走吧！', '真是美好的一天啊。'],
            '悲伤': ['为什么会这样...', '别担心，一切都会好起来的。'],
            '恐惧': ['快跑！', '不要回头看！'],
          };
          const lines = moodLines[mood] || ['我们到了。', '就是这里。'];
          uniqueChars.slice(0, 2).forEach((ch, idx) => {
            dialogues.push({ character: ch || '角色', line: lines[idx] || '...', direction: '' });
          });
        }
      }

      return {
        sceneNumber: si + 1,
        title: scene.name || `场景${si + 1}`,
        interior: scene.indoor,
        location: scene.location || '待补充',
        timeOfDay: scene.timeOfDay || '日',
        stageDirections: scene.description || `${scene.mood || '平静'}的氛围，${scene.indoor ? '室内' : '室外'}场景，${scene.location || '某处'}`,
        dialogues,
        cameraDirections: sceneShots.map(s => `${s.shotType || '中景'}·${s.cameraMovement || '固定'}`).join(' → ') || '全景·缓慢推进 → 中景·固定',
        soundDesign: sceneShots.map(s => s.soundDesign || s.soundEffect || '').filter(Boolean).join('；') || `${scene.mood === '紧张' ? '紧张弦乐+心跳声' : scene.mood === '欢快' ? '轻快旋律+自然声' : '环境白噪音'}${scene.indoor ? '，室内回响' : '，户外开阔'}`,
        transition: sceneShots.length > 1 ? '切至' : '溶至',
      };
    });

    script.screenplay = screenplay;
  }

  if (Array.isArray(script.screenplay) && script.screenplay.length > 0 && script.shots) {
    const shotSceneNums = new Set(script.shots.map(s => s.sceneNumber));
    const missingScenes = script.screenplay.filter(sp => !shotSceneNums.has(sp.sceneNumber));
    if (missingScenes.length > 0) {
      let nextShotNum = script.shots.length + 1;
      for (const spScene of missingScenes) {
        const sceneChars = spScene.dialogues?.map(d => d.character).filter(Boolean) || [];
        script.shots.push({
          id: `shot_${spScene.sceneNumber}_1`,
          sceneId: `scene_${spScene.sceneNumber}`,
          sceneNumber: spScene.sceneNumber,
          shotNumber: nextShotNum++,
          shotType: '中景',
          cameraAngle: '平视',
          cameraMovement: spScene.cameraDirections || '缓慢推进',
          content: spScene.stageDirections || `${spScene.title}：${spScene.interior ? '内景' : '外景'}，${spScene.location}`,
          contentEn: '',
          dialogue: spScene.dialogues?.map(d => `${d.character}: ${d.line}`).join(' | ') || '',
          narration: '',
          action: '',
          soundEffect: spScene.soundDesign || '',
          duration: Math.max(4, Math.round((targetDuration / script.screenplay.length) * 0.8)),
          characters: sceneChars.length > 0 ? [...new Set(sceneChars)] : [],
          status: 'pending',
          emotionTag: '',
          emotionIntensity: 5,
          colorNarrative: '',
          soundDesign: spScene.soundDesign || '',
          bgmChange: '',
        });
      }
    }
  }

  if (!script.directorPlan || !script.directorPlan.characterCards || script.directorPlan.characterCards.length === 0) {
    if (script.characters?.length > 0) {
      const characterCards: DirectorCharacterCard[] = script.characters.map(ch => ({
        id: ch.id,
        name: ch.name,
        age: ch.age,
        gender: ch.gender || '不限',
        mbti: (ch as unknown as Record<string, unknown>).mbti as string || '',
        arc: ch.characterArc || ch.arc || '',
        motivation: ch.motivation || '',
        relationships: ch.relationships || {},
        signatureDetail: ch.signatureDetail || '',
        appearance: ch.appearance || '待补充',
        outfit: ch.outfit || '待补充',
        consistencyRules: {
          mustInclude: [ch.appearance, ch.outfit].filter(Boolean) as string[],
          mustExclude: [],
        },
      }));
      if (!script.directorPlan) script.directorPlan = { characterCards: [], sceneCards: [], propCards: [] };
      script.directorPlan.characterCards = characterCards;
    }
  }

  if (!script.directorPlan || !script.directorPlan.sceneCards || script.directorPlan.sceneCards.length === 0) {
    if (script.scenes?.length > 0) {
      const sceneCards: DirectorSceneCard[] = script.scenes.map(sc => ({
        id: sc.id,
        sceneNumber: sc.sceneNumber,
        name: sc.name,
        location: sc.location,
        timeOfDay: sc.timeOfDay,
        interior: sc.indoor,
        visualDescription: `${sc.mood || '中性'}氛围，${sc.colorPalette || '自然色调'}主色，${sc.lightingDir || '自然光'}${sc.description ? '，' + sc.description : ''}`,
        fiveSenses: {
          sight: sc.description || '',
          hearing: `${sc.mood === '紧张' ? '低沉的呼吸声' : sc.mood === '欢快' ? '欢笑声和自然声' : '环境白噪音'}`,
          touch: sc.indoor ? '温润' : '微凉',
          smell: sc.indoor ? '木材和旧书的气味' : '泥土和草的清香',
          taste: '',
        },
        symbolism: (sc as unknown as Record<string, unknown>).symbolism as string || '',
        mood: sc.mood || '中性',
        keyProps: (sc as unknown as Record<string, unknown>).keyProps as string || '',
        colorPalette: sc.colorPalette || '',
      }));
      if (!script.directorPlan) script.directorPlan = { characterCards: [], sceneCards: [], propCards: [] };
      script.directorPlan.sceneCards = sceneCards;
    }
  }

  if (!script.directorPlan?.propCards || script.directorPlan.propCards.length === 0) {
    const propNames = new Set<string>();
    script.directorPlan?.sceneCards?.forEach(sc => {
      if (sc.keyProps) {
        sc.keyProps.split(/[,，、;；\s]+/).forEach(p => {
          const trimmed = p.trim();
          if (trimmed && trimmed.length >= 2 && trimmed.length <= 20) propNames.add(trimmed);
        });
      }
    });
    if (propNames.size > 0 && script.directorPlan) {
      script.directorPlan.propCards = Array.from(propNames).map((name, i) => ({
        id: `prop_${i + 1}`,
        name,
        category: '其他',
        material: '',
        color: '',
        size: '',
        significance: '场景关键道具',
        closeup: false,
        appearance: name,
        propEn: name,
      }));
    }
  }

  if (!script.directorPlan?.consistencyNotes && script.characters?.length > 0) {
    const notes = script.characters.map(ch =>
      `${ch.name}：必须包含${ch.appearance || '角色外观'}，穿着${ch.outfit || '角色服装'}；禁止改变发色/瞳色/体型`
    ).join('；');
    if (script.directorPlan) {
      script.directorPlan.consistencyNotes = notes;
    } else {
      script.directorPlan = { characterCards: [], sceneCards: [], propCards: [], consistencyNotes: notes };
    }
  }
}
