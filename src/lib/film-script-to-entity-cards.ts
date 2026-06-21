import type { FilmCharacter, FilmScene, FilmScript, FilmShot } from '@/types/film';
import type { EntityCard } from '@/lib/film-creation-panel-model';
import { buildStyleLockedPrompt } from '@/lib/visual-style-map';

type BuildFilmEntityCardsInput = {
  filmScript: FilmScript;
  resolvedStyle: string;
  videoDuration: number;
};

export function buildFilmEntityCardsFromScript({
  filmScript,
  resolvedStyle,
  videoDuration,
}: BuildFilmEntityCardsInput): EntityCard[] {
  const cards: EntityCard[] = [];

  const plotParts: string[] = [];
  plotParts.push(`《${filmScript.title}》`);
  if (filmScript.coreTheme) plotParts.push(`核心主题：${filmScript.coreTheme}`);
  if (filmScript.aspectRatio) plotParts.push(`画幅：${filmScript.aspectRatio}`);
  plotParts.push(`风格：${filmScript.style} | 时长：约${filmScript.totalDuration}秒`);
  if (filmScript.colorNarrativeLine) plotParts.push(`\n【色彩叙事线】${filmScript.colorNarrativeLine}`);
  if (filmScript.emotionCurve) plotParts.push(`【情绪曲线】${filmScript.emotionCurve}`);

  const sceneMap = new Map<number, { scene: FilmScene; shots: FilmShot[] }>();
  for (const scene of filmScript.scenes || []) {
    sceneMap.set(scene.sceneNumber, { scene, shots: [] });
  }
  for (const shot of filmScript.shots || []) {
    const entry = sceneMap.get(shot.sceneNumber);
    if (entry) {
      entry.shots.push(shot);
    } else {
      sceneMap.set(shot.sceneNumber, {
        scene: {
          id: `scene_${shot.sceneNumber}`,
          sceneNumber: shot.sceneNumber,
          name: `场景${shot.sceneNumber}`,
          location: '',
          timeOfDay: '日',
          indoor: false,
          description: '',
          mood: '',
        } as FilmScene,
        shots: [shot],
      });
    }
  }

  for (const [, { scene, shots }] of sceneMap) {
    plotParts.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    plotParts.push(`场景${scene.sceneNumber}：${scene.name || scene.location}`);
    plotParts.push(`${scene.indoor ? '内景' : '外景'} | ${scene.timeOfDay || '日'}${scene.mood ? ' | ' + scene.mood : ''}`);
    if (scene.description) plotParts.push(`环境：${scene.description}`);
    if (scene.atmosphere) plotParts.push(`氛围：${scene.atmosphere}`);
    if (scene.symbolism) plotParts.push(`象征：${scene.symbolism}`);
    for (const shot of shots) {
      plotParts.push(`\n  📸 镜头${shot.shotNumber}：[${shot.shotType || '中景'}] [${shot.cameraAngle || '平视'}] ${shot.duration || 5}秒${shot.cameraMovement ? ' | ' + shot.cameraMovement : ''}`);
      if (shot.content) plotParts.push(`  画面：${shot.content}`);
      if (shot.dialogue) plotParts.push(`  对白：${shot.dialogue}`);
      if (shot.narration) plotParts.push(`  旁白：${shot.narration}`);
      if (shot.action) plotParts.push(`  动作：${shot.action}`);
      if (shot.soundDesign) plotParts.push(`  声音：${shot.soundDesign}`);
      if (shot.bgmChange) plotParts.push(`  BGM：${shot.bgmChange}`);
      if (shot.emotionIntensity) plotParts.push(`  情感强度：${shot.emotionIntensity}/10`);
      if (shot.colorNarrative) plotParts.push(`  色彩叙事：${shot.colorNarrative}`);
    }
  }

  if (filmScript.narrationScript) plotParts.push(`\n【旁白脚本】\n${filmScript.narrationScript}`);
  if (filmScript.bgmSuggestion) plotParts.push(`\n【BGM方案】${filmScript.bgmSuggestion}`);
  if (filmScript.subtitleSuggestion) plotParts.push(`\n【字幕设计】${filmScript.subtitleSuggestion}`);

  const plotContent = plotParts.join('\n');
  cards.push({
    id: 'plot_main',
    type: 'plot',
    name: `《${filmScript.title}》剧情`,
    description: plotContent,
    promptCn: plotContent,
    promptEn: `${filmScript.title}, ${filmScript.style}, cinematic storytelling, ${filmScript.bgmSuggestion || ''}`,
  });

  const dpCharMap = new Map<string, any>();
  const dpSceneMap = new Map<number, any>();
  if (filmScript.directorPlan) {
    for (const character of filmScript.directorPlan.characterCards || []) {
      if (character.name) dpCharMap.set(character.name, character);
    }
    for (const scene of filmScript.directorPlan.sceneCards || []) {
      dpSceneMap.set(scene.sceneNumber, scene);
    }
  }

  if (filmScript.characters?.length) {
    filmScript.characters.forEach((character: FilmCharacter, index: number) => {
      const dpChar = dpCharMap.get(character.name || '') || dpCharMap.get(`角色${index + 1}`);
      const appearance = dpChar?.appearance || character.appearance || '';
      const outfit = dpChar?.outfit || character.outfit || '';
      const arc = dpChar?.arc || (character as any).characterArc || '';
      const motivation = dpChar?.motivation || (character as any).motivation || '';
      const relationships = dpChar?.relationships
        ? Object.entries(dpChar.relationships as Record<string, string>).map(([key, value]) => `${key}: ${value}`).join('; ')
        : ((character as any).relationships || '');
      const signatureDetail = dpChar?.signatureDetail || (character as any).signatureDetail || '';
      const mbti = dpChar?.mbti || '';
      const mustInclude: string[] = dpChar?.consistencyRules?.mustInclude || [];
      const mustExclude: string[] = dpChar?.consistencyRules?.mustExclude || [];

      const promptParts = [`姓名: ${character.name}`, `年龄: ${character.age || '未知'}`, `性别: ${character.gender || '未知'}`];
      if (mbti) promptParts.push(`MBTI: ${mbti}`);
      promptParts.push(`外貌: ${appearance || '暂无'}`);
      promptParts.push(`服装: ${outfit || '暂无'}`);
      if (character.personality) promptParts.push(`性格: ${character.personality}`);
      if (arc) promptParts.push(`角色弧光: ${arc}`);
      if (motivation) promptParts.push(`核心动机: ${motivation}`);
      if (relationships) promptParts.push(`关系网: ${relationships}`);
      if (signatureDetail) promptParts.push(`标志性细节: ${signatureDetail}`);
      if (mustInclude.length) promptParts.push(`[一致性·必须包含] ${mustInclude.join('、')}`);
      if (mustExclude.length) promptParts.push(`[一致性·禁止出现] ${mustExclude.join('、')}`);

      const consistencyInclude = mustInclude.length ? `, ${mustInclude.join(', ')}` : '';
      const consistencyExclude = mustExclude.length ? `\nNegative prompt: ${mustExclude.join(', ')}` : '';
      const rawCharPrompt = appearance
        ? `${character.gender === '女' ? 'female' : 'male'} character, ${character.age || 'young adult'}, ${appearance}, ${outfit}${consistencyInclude}, portrait, high detail, 8k`
        : '';
      const promptEn = rawCharPrompt
        ? (resolvedStyle ? buildStyleLockedPrompt(rawCharPrompt, resolvedStyle) : `${rawCharPrompt}, cinematic lighting`)
        : '';

      cards.push({
        id: `char_${index}`,
        type: 'character',
        name: character.name || `角色${index + 1}`,
        description: `${character.age || '?'}岁 ${character.gender || '?'} - ${character.personality || '暂无描述'}${mbti ? ` | ${mbti}` : ''}`,
        promptCn: promptParts.join('\n'),
        promptEn: promptEn + consistencyExclude,
        age: character.age,
        gender: character.gender,
        appearance,
        personality: character.personality,
        outfit,
        mbti,
        characterArc: arc,
        motivation,
        relationships,
        signatureDetail,
        isPromptGenerated: !!promptEn,
      });
    });
  }

  if (filmScript.scenes?.length) {
    filmScript.scenes.forEach((scene: FilmScene, index: number) => {
      const dpScene = dpSceneMap.get(scene.sceneNumber);
      const fiveSenses = dpScene?.fiveSenses;
      const symbolism = dpScene?.symbolism || (scene as any).symbolism || '';
      const atmosphere = dpScene?.visualDescription || (scene as any).atmosphere || '';
      const keyProps = dpScene?.keyProps || (scene as any).keyProps || '';
      const colorPalette = dpScene?.colorPalette || scene.colorPalette || '';
      const lightingDir = scene.lightingDir || '';

      const sceneParts = [`场景名: ${scene.name}`, `地点: ${scene.location || '未知'}`, `时间: ${scene.timeOfDay || '日'}`];
      sceneParts.push(`氛围: ${scene.mood || '暂无'}`);
      sceneParts.push(`描述: ${scene.description || '暂无'}`);
      if (colorPalette) sceneParts.push(`主色系: ${colorPalette}`);
      if (lightingDir) sceneParts.push(`光源方向: ${lightingDir}`);
      if (atmosphere) sceneParts.push(`视觉描述: ${atmosphere}`);
      if (symbolism) sceneParts.push(`象征意义: ${symbolism}`);
      if (keyProps) sceneParts.push(`关键道具: ${keyProps}`);
      if (fiveSenses) {
        sceneParts.push('【五感】');
        if (fiveSenses.sight) sceneParts.push(`  视觉: ${fiveSenses.sight}`);
        if (fiveSenses.hearing) sceneParts.push(`  听觉: ${fiveSenses.hearing}`);
        if (fiveSenses.touch) sceneParts.push(`  触觉: ${fiveSenses.touch}`);
        if (fiveSenses.smell) sceneParts.push(`  嗅觉: ${fiveSenses.smell}`);
        if (fiveSenses.taste) sceneParts.push(`  味觉: ${fiveSenses.taste}`);
      }

      const senseEn = fiveSenses ? `, ${fiveSenses.sight || ''}` : '';
      const symbolEn = symbolism ? `, symbolic ${symbolism}` : '';
      const rawScenePrompt = `${scene.location || scene.name}, ${scene.timeOfDay || 'day'}, ${scene.mood || 'neutral mood'}, ${scene.description || ''}${colorPalette ? ', ' + colorPalette + ' color palette' : ''}${lightingDir ? ', ' + lightingDir + ' lighting' : ''}${atmosphere ? ', ' + atmosphere : ''}${senseEn}${symbolEn}, empty scene, no people, no characters, devoid of human figures, establishing shot, wide shot, high detail, 8k`;
      const promptEn = resolvedStyle
        ? buildStyleLockedPrompt(rawScenePrompt, resolvedStyle)
        : `${rawScenePrompt}, cinematic scene`;

      cards.push({
        id: `scene_${index}`,
        type: 'scene',
        name: scene.name || `场景${index + 1}`,
        description: `${scene.location || ''} (${scene.timeOfDay || '日'}) - ${scene.mood || ''}${symbolism ? ' | ' + symbolism : ''}`,
        promptCn: sceneParts.join('\n'),
        promptEn,
        location: scene.location,
        timeOfDay: scene.timeOfDay,
        mood: scene.mood,
        colorPalette,
        lightingDir,
        atmosphere,
        symbolism,
        keyProps,
        sceneNumber: scene.sceneNumber,
        isPromptGenerated: true,
      });
    });
  }

  for (const prop of filmScript.directorPlan?.propCards || []) {
    const propPrompt = prop.propEn || prop.appearance
      ? `${prop.propEn || prop.appearance}, product photography, isolated on neutral background, detailed, high quality`
      : '';
    const promptEn = resolvedStyle && propPrompt
      ? buildStyleLockedPrompt(propPrompt, resolvedStyle)
      : propPrompt;
    cards.push({
      id: `prop_${cards.filter(card => card.type === 'prop').length}`,
      type: 'prop',
      name: prop.name || `道具${cards.filter(card => card.type === 'prop').length + 1}`,
      description: prop.appearance || prop.significance || '',
      promptCn: prop.appearance || prop.name,
      promptEn,
      propMaterial: prop.material,
      propColor: prop.color,
      propSize: prop.size,
      propSignificance: prop.significance,
      propCloseup: !!prop.closeup,
      isPromptGenerated: !!promptEn,
    });
  }

  let shotsToUse = filmScript.shots?.length ? [...filmScript.shots] : [];
  if (shotsToUse.length === 0 && filmScript.scenes?.length) {
    filmScript.scenes.forEach((scene: FilmScene, sceneIndex: number) => {
      const sceneId = scene.id || `scene_${sceneIndex + 1}`;
      const sceneChars = filmScript.characters
        ?.filter(character => {
          const sceneText = `${scene.name || ''} ${scene.description || ''} ${scene.location || ''}`;
          return sceneText.includes(character.name);
        })
        .map(character => character.id || '') || [];
      const charNames = filmScript.characters
        ?.filter(character => sceneChars.includes(character.id || ''))
        .map(character => character.name) || [];

      shotsToUse.push({
        id: `shot_${sceneIndex + 1}_1`,
        sceneId,
        sceneNumber: sceneIndex + 1,
        shotNumber: shotsToUse.length + 1,
        content: `全景：${scene.location || scene.name || '场景'}，${scene.mood || ''}氛围，${scene.lightingDir || '自然光'}照射，${scene.description || ''}`.substring(0, 200),
        contentEn: `Establishing shot of ${scene.location || scene.name || 'scene'}, ${scene.mood || 'calm'} atmosphere, ${scene.colorPalette || 'natural colors'} tone`,
        shotType: '全景',
        cameraAngle: '平视',
        cameraMovement: '缓慢推进',
        duration: videoDuration,
        dialogue: '',
        narration: '',
        action: '',
        soundEffect: `${scene.mood === '紧张' ? '紧张弦乐' : '环境白噪音'}`,
        characters: sceneChars,
        status: 'pending',
        emotionTag: scene.mood || '中性',
        soundDesign: `${scene.mood === '紧张' ? '心跳声+紧张弦乐' : '风声+环境白噪音'}`,
        bgmChange: `段落${sceneIndex + 1}，${scene.mood || '中性'}情绪`,
        emotionIntensity: 5,
        colorNarrative: `${scene.colorPalette || '自然色调'}`,
      } as FilmShot);

      charNames.forEach((charName: string, charIndex: number) => {
        const charObj = filmScript.characters?.find(character => character.name === charName);
        shotsToUse.push({
          id: `shot_${sceneIndex + 1}_${charIndex + 2}`,
          sceneId,
          sceneNumber: sceneIndex + 1,
          shotNumber: shotsToUse.length + 1,
          content: `${charName}特写：${charObj?.appearance || ''}，${scene.name || ''}中，${scene.mood || ''}氛围`,
          contentEn: `Close-up of ${charName}, ${charObj?.appearance || 'detailed features'}, ${scene.colorPalette || 'natural'} tone [Scene: ${scene.mood || 'neutral'}]`,
          shotType: '特写',
          cameraAngle: '平视',
          cameraMovement: '固定',
          duration: videoDuration,
          dialogue: '',
          narration: '',
          action: '',
          soundEffect: `${scene.mood === '紧张' ? '紧张弦乐' : '环境白噪音'}`,
          characters: sceneChars.length > 0 ? sceneChars : [charName],
          status: 'pending',
          emotionTag: scene.mood || '中性',
          soundDesign: `${scene.mood === '紧张' ? '心跳声+紧张弦乐' : '风声+环境白噪音'}`,
          bgmChange: `段落${sceneIndex + 1}-${charIndex + 2}，${scene.mood || '中性'}情绪`,
          emotionIntensity: 5,
          colorNarrative: `${scene.colorPalette || '自然色调'}`,
        } as FilmShot);
      });
    });
  }

  shotsToUse.forEach((shot: FilmShot, index: number) => {
    const shotSceneCard = dpSceneMap.get(shot.sceneNumber);
    const shotCharNames = (shot.characters || []) as string[];
    const charConsistencyParts: string[] = [];
    const charConsistencyEn: string[] = [];
    for (const charRef of shotCharNames) {
      const dpChar = dpCharMap.get(charRef);
      if (dpChar) {
        const mustInc = dpChar.consistencyRules?.mustInclude || [];
        const mustExc = dpChar.consistencyRules?.mustExclude || [];
        if (mustInc.length) charConsistencyParts.push(`[${dpChar.name} 一致性·必须] ${mustInc.join('、')}`);
        if (mustExc.length) charConsistencyParts.push(`[${dpChar.name} 一致性·禁止] ${mustExc.join('、')}`);
        if (mustInc.length) charConsistencyEn.push(`${dpChar.name}: ${mustInc.join(', ')}`);
      }
    }

    const sceneSensesCn: string[] = [];
    if (shotSceneCard?.fiveSenses) {
      const fs = shotSceneCard.fiveSenses;
      if (fs.sight) sceneSensesCn.push(`视觉: ${fs.sight}`);
      if (fs.hearing) sceneSensesCn.push(`听觉: ${fs.hearing}`);
    }
    const sceneSymbolCn = shotSceneCard?.symbolism ? `象征: ${shotSceneCard.symbolism}` : '';

    const shotParts = [`景别: ${shot.shotType || '标准'}`, `角度: ${shot.cameraAngle || '平视'}`, `运镜: ${shot.cameraMovement || shot.cameraAngle || '固定'}`, `时长: ${shot.duration || videoDuration}秒`, `画面: ${shot.content || ''}`];
    if (shot.dialogue) shotParts.push(`对白: ${shot.dialogue}`);
    if (shot.narration) shotParts.push(`旁白: ${shot.narration}`);
    if (shot.action) shotParts.push(`动作: ${shot.action}`);
    if ((shot as any).soundDesign) shotParts.push(`声音设计: ${(shot as any).soundDesign}`);
    if ((shot as any).bgmChange) shotParts.push(`BGM变化: ${(shot as any).bgmChange}`);
    if ((shot as any).emotionIntensity) shotParts.push(`情感强度: ${(shot as any).emotionIntensity}/10`);
    if ((shot as any).colorNarrative) shotParts.push(`色彩叙事: ${(shot as any).colorNarrative}`);
    if (charConsistencyParts.length) shotParts.push(`\n【角色一致性约束】\n${charConsistencyParts.join('\n')}`);
    if (sceneSensesCn.length) shotParts.push(`\n【场景五感】\n${sceneSensesCn.join('\n')}`);
    if (sceneSymbolCn) shotParts.push(sceneSymbolCn);

    const consistencyEnSuffix = charConsistencyEn.length ? `, ${charConsistencyEn.join(', ')}` : '';
    const rawShotPrompt = shot.contentEn || `${shot.content}, ${shot.shotType || 'medium shot'}, ${shot.cameraMovement || shot.cameraAngle || 'static'}${consistencyEnSuffix}`;
    const promptEn = resolvedStyle
      ? buildStyleLockedPrompt(rawShotPrompt, resolvedStyle)
      : `${rawShotPrompt}, cinematic, ${filmScript.style}`;

    cards.push({
      id: `shot_${index}`,
      type: 'shot',
      name: `镜头${index + 1}`,
      description: `${shot.shotType || '标准'} | ${shot.cameraAngle || '固定'} | ${shot.duration || videoDuration}秒`,
      promptCn: shotParts.join('\n'),
      promptEn,
      shotType: shot.shotType,
      cameraAngle: shot.cameraAngle,
      cameraMovement: shot.cameraMovement || (shot as any).cameraMovement,
      duration: shot.duration,
      dialogue: shot.dialogue,
      narration: shot.narration,
      action: shot.action,
      soundDesign: (shot as any).soundDesign,
      bgmChange: (shot as any).bgmChange,
      emotionIntensity: (shot as any).emotionIntensity,
      colorNarrative: (shot as any).colorNarrative,
      sceneNumber: shot.sceneNumber,
      shotNumber: shot.shotNumber,
      sceneId: shot.sceneNumber ? `scene_${shot.sceneNumber - 1}` : undefined,
      characters: shot.characters,
      emotionTag: shot.emotionTag,
      isPromptGenerated: !!promptEn,
    });
  });

  return cards;
}
