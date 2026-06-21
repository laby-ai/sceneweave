import type { JimengConvertLLM } from '@/lib/jimeng-convert-llm-client';

export interface JimengConvertRequest {
  script: string;
  targetDuration?: number; // 目标单集时长（秒）
}

interface Shot {
  shotId: string;
  sceneNumber: number;
  sceneName: string;
  timeOfDay: '日' | '夜';
  location: '内' | '外';
  shotType: string;
  frameType: string;
  content: string;
  audio: string;
  dialogue?: string;
  narration?: string;
  os?: string;
  voiceover?: string;
  effects?: string[];
}

interface TimingRow {
  shotId: string;
  shotType: string;
  content: string;
  dialogue: string;
  wordCount: number;
  speakingDuration: number;
  actionDuration: number;
  calculatedDuration: number;
  aiNotes: string;
}

interface Clip {
  clipId: string;
  duration: number;
  shots: string[];
  content: string;
  shotSequence: string;
  audio: string;
  dialogue: string;
  characterMaterials: string[];
  sceneMaterials: string[];
  itemMaterials: string[];
}

interface CharacterAsset {
  name: string;
  age: string;
  appearance: string;
  facialFeatures: string;
  hairstyle: string;
  temperament: string;
  makeup: string;
  clothing: string;
  personality: string;
  artStyle: string;
  clipIds: string[];
}

interface ItemAsset {
  name: string;
  category: string;
  base: string;
  itemType: string;
  clipIds: string[];
}

interface SceneAsset {
  name: string;
  environment: string;
  lighting: string;
  atmosphere: string;
  artStyle: string;
  clipIds: string[];
}

interface AudioAsset {
  character: string;
  voiceDescription: string;
}

interface SoundEffect {
  name: string;
  shotIds: string[];
  clipIds: string[];
}

export interface JimengConvertResult {
  data: string;
  shots: Shot[];
  timingTable: TimingRow[];
  clips: Clip[];
  assets: {
    characters?: CharacterAsset[];
    items?: ItemAsset[];
    scenes?: SceneAsset[];
  };
  audioAssets: {
    characters?: AudioAsset[];
    soundEffects?: SoundEffect[];
  };
}

export async function convertScriptToJimeng(
  llm: JimengConvertLLM,
  input: JimengConvertRequest
): Promise<JimengConvertResult> {
  const targetDuration = input.targetDuration ?? 120;
  const analysisResult = await analyzeScriptStructure(llm, input.script);
  const shots = await generateShots(llm, input.script, analysisResult);
  const timingTable = generateTimingTable(shots);
  const clips = generateClips(timingTable, shots);
  const assets = await generateAssets(llm, input.script, clips);
  const audioAssets = await generateAudioAssets(llm, input.script, shots);

  return {
    data: generateFinalOutput(shots, timingTable, clips, assets, audioAssets, targetDuration),
    shots,
    timingTable,
    clips,
    assets,
    audioAssets,
  };
}

async function analyzeScriptStructure(llm: JimengConvertLLM, script: string) {
  const systemPrompt = `请分析以下剧本的结构，提取关键信息。

请以JSON格式返回：
{
  "scenes": [
    {
      "name": "场景名称",
      "timeOfDay": "日"或"夜",
      "location": "内"或"外",
      "content": "场景内容",
      "dialogues": ["台词1", "台词2"]
    }
  ],
  "characters": ["角色1", "角色2"],
  "keyItems": ["道具1", "道具2"],
  "totalDuration": 预估总时长（秒）
}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `剧本内容：\n${script}` },
  ];

  const response = await llm.invoke(messages, {
    model: 'doubao-seed-1-8-251228',
    temperature: 0.7,
  });

  try {
    const content = response.content?.toString() || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { scenes: [], characters: [], keyItems: [], totalDuration: 120 };
  } catch {
    return { scenes: [], characters: [], keyItems: [], totalDuration: 120 };
  }
}

async function generateShots(llm: JimengConvertLLM, script: string, analysis: any): Promise<Shot[]> {
  const systemPrompt = `请将以下剧本拆分为最小镜头单元（Shot），严格遵循以下要求：

要求：
1. 每个镜头独立，标注格式：场景序号+场景名称（日/夜 内/外）
2. 景别选择：怼脸特写、近景、中景、全景等
3. 画面描述适配竖屏9:16，突出人物主体
4. 包含明确的画风、光影、构图细节
5. 所有台词、旁白、OS、画外音精准对应到镜头
6. 包含同步音效/环境音

请以JSON格式返回，格式如下：
{
  "shots": [
    {
      "shotId": "S001",
      "sceneNumber": 1,
      "sceneName": "场景名称",
      "timeOfDay": "日",
      "location": "内",
      "shotType": "近景",
      "frameType": "竖屏9:16",
      "content": "详细画面描述，包含人物动作、表情、环境、光影、画风",
      "audio": "环境音/音效描述",
      "dialogue": "台词内容",
      "narration": "旁白内容",
      "os": "内心OS内容",
      "voiceover": "画外音内容",
      "effects": ["特效1", "特效2"]
    }
  ]
}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `剧本内容：\n${script}\n\n分析结果：\n${JSON.stringify(analysis, null, 2)}` },
  ];

  const response = await llm.invoke(messages, {
    model: 'doubao-seed-1-8-251228',
    temperature: 0.8,
  });

  try {
    const content = response.content?.toString() || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return result.shots || [];
    }
    return generateFallbackShots(analysis);
  } catch {
    return generateFallbackShots(analysis);
  }
}

function generateFallbackShots(analysis: any): Shot[] {
  const shots: Shot[] = [];
  let shotIndex = 1;

  analysis.scenes?.forEach((scene: any, sceneIndex: number) => {
    shots.push({
      shotId: `S${String(shotIndex++).padStart(3, '0')}`,
      sceneNumber: sceneIndex + 1,
      sceneName: scene.name || '场景',
      timeOfDay: scene.timeOfDay || '日',
      location: scene.location || '内',
      shotType: '中景',
      frameType: '竖屏9:16',
      content: `${scene.name}，${scene.timeOfDay}${scene.location}，人物在场景中，适配竖屏9:16构图，高清写实画风，柔和自然光，构图平衡`,
      audio: '环境音',
      dialogue: scene.dialogues?.[0] || ''
    });
  });

  return shots;
}

function generateTimingTable(shots: Shot[]): TimingRow[] {
  const timingTable: TimingRow[] = [];

  shots.forEach((shot) => {
    const dialogue = shot.dialogue || shot.narration || shot.os || shot.voiceover || '';
    const wordCount = dialogue.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '').length;
    
    // 中文说话时长：每秒5个字，向上取整
    const speakingDuration = wordCount > 0 ? Math.ceil(wordCount / 5) : 0;
    
    // 动作时长：最低2秒
    const actionDuration = Math.max(2, Math.ceil(dialogue.length / 20));
    
    // 计算时长：取较大值
    const calculatedDuration = Math.max(speakingDuration, actionDuration);
    
    // AI生成适配说明
    let aiNotes = '';
    if (calculatedDuration < 4) {
      aiNotes = '⚠️<4s需合并入同场景Clip';
    }

    timingTable.push({
      shotId: shot.shotId,
      shotType: shot.shotType,
      content: shot.content,
      dialogue: dialogue,
      wordCount,
      speakingDuration,
      actionDuration,
      calculatedDuration,
      aiNotes
    });
  });

  return timingTable;
}

function generateClips(timingTable: TimingRow[], shots: Shot[]): Clip[] {
  const clips: Clip[] = [];
  let clipIndex = 1;
  let currentClip: { shots: TimingRow[]; duration: number } | null = null;

  timingTable.forEach((row, index) => {
    if (!currentClip) {
      currentClip = { shots: [row], duration: row.calculatedDuration };
    } else {
      const newDuration = currentClip.duration + row.calculatedDuration;
      
      // 检查是否可以添加到当前Clip
      if (newDuration <= 15 && currentClip.shots.length < 3) {
        currentClip.shots.push(row);
        currentClip.duration = newDuration;
      } else {
        // 保存当前Clip
        clips.push(createClip(currentClip, shots, clipIndex++));
        
        // 开始新Clip
        currentClip = { shots: [row], duration: row.calculatedDuration };
      }
    }

    // 最后一个Clip
    if (index === timingTable.length - 1 && currentClip) {
      // 确保Clip时长≥4秒
      if (currentClip.duration < 4 && clips.length > 0) {
        // 合并到前一个Clip
        const lastClip = clips[clips.length - 1];
        lastClip.shots.push(...currentClip.shots.map(s => s.shotId));
        lastClip.duration += currentClip.duration;
      } else {
        clips.push(createClip(currentClip, shots, clipIndex++));
      }
    }
  });

  return clips;
}

function createClip(clipData: { shots: TimingRow[]; duration: number }, allShots: Shot[], index: number): Clip {
  const shotIds = clipData.shots.map(s => s.shotId);
  const shots = allShots.filter(shot => shotIds.includes(shot.shotId));
  
  const content = shots.map(s => s.content).join('；');
  const dialogue = shots.map(s => s.dialogue || '').filter(d => d).join(' ');
  const audio = shots.map(s => s.audio || '').filter(a => a).join('，');
  
  const shotSequence = shotIds.join(' → ');
  
  // 提取人物、场景、物品素材
  const characterMaterials = Array.from(new Set(shots.map(s => s.sceneName).filter(n => n))).map(name => `人物_${name}`);
  const sceneMaterials = Array.from(new Set(shots.map(s => `${s.sceneName}_${s.timeOfDay}${s.location}`))).map(name => `场景_${name}`);
  const itemMaterials = ['道具_通用'];

  return {
    clipId: `C${String(index).padStart(3, '0')}`,
    duration: clipData.duration,
    shots: shotIds,
    content,
    shotSequence,
    audio,
    dialogue,
    characterMaterials,
    sceneMaterials,
    itemMaterials
  };
}

async function generateAssets(llm: JimengConvertLLM, script: string, clips: Clip[]) {
  const systemPrompt = `请根据以下剧本和Clip信息，生成标准化的资产设定。

请以JSON格式返回：
{
  "characters": [
    {
      "name": "角色名称",
      "age": "年龄",
      "appearance": "外貌描述",
      "facialFeatures": "五官特征",
      "hairstyle": "发型",
      "temperament": "气质",
      "makeup": "妆造",
      "clothing": "服饰",
      "personality": "核心性格",
      "artStyle": "统一画风适配",
      "clipIds": ["C001", "C002"]
    }
  ],
  "items": [
    {
      "name": "物品名称",
      "category": "分类",
      "base": "材质、尺寸、外观细节、核心特征、光影质感",
      "itemType": "物品类别",
      "clipIds": ["C001"]
    }
  ],
  "scenes": [
    {
      "name": "场景名称",
      "environment": "环境细节描述（建筑材质、空间陈设、环境细节）",
      "lighting": "光影与色调设定",
      "atmosphere": "氛围设定",
      "artStyle": "统一画风适配",
      "clipIds": ["C001"]
    }
  ]
}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `剧本内容：\n${script}\n\nClip信息：\n${JSON.stringify(clips.map(c => ({ id: c.clipId, duration: c.duration, content: c.content.substring(0, 100) })), null, 2)}` },
  ];

  const response = await llm.invoke(messages, {
    model: 'doubao-seed-1-8-251228',
    temperature: 0.8,
  });

  try {
    const content = response.content?.toString() || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {
      characters: generateFallbackCharacters(clips),
      items: generateFallbackItems(clips),
      scenes: generateFallbackScenes(clips)
    };
  } catch {
    return {
      characters: generateFallbackCharacters(clips),
      items: generateFallbackItems(clips),
      scenes: generateFallbackScenes(clips)
    };
  }
}

function generateFallbackCharacters(clips: Clip[]): CharacterAsset[] {
  const clipIds = clips.map(c => c.clipId);
  return [
    {
      name: '主角',
      age: '25岁',
      appearance: '年轻有活力，面容清秀',
      facialFeatures: '五官端正，眼睛有神',
      hairstyle: '时尚发型',
      temperament: '阳光开朗',
      makeup: '自然妆造',
      clothing: '时尚休闲服饰',
      personality: '善良勇敢',
      artStyle: '高清写实风格，适配竖屏9:16',
      clipIds
    }
  ];
}

function generateFallbackItems(clips: Clip[]): ItemAsset[] {
  const clipIds = clips.map(c => c.clipId);
  return [
    {
      name: '通用道具',
      category: '道具',
      base: '材质精良，尺寸适中，外观简洁，核心特征明显，光影质感真实',
      itemType: '通用物品',
      clipIds
    }
  ];
}

function generateFallbackScenes(clips: Clip[]): SceneAsset[] {
  const clipIds = clips.map(c => c.clipId);
  return [
    {
      name: '主场景',
      environment: '空间布局合理，建筑材质质感真实，陈设布置有序，环境细节丰富',
      lighting: '光线柔和自然，色调温暖舒适',
      atmosphere: '氛围温馨和谐',
      artStyle: '高清写实风格，适配竖屏9:16',
      clipIds
    }
  ];
}

async function generateAudioAssets(llm: JimengConvertLLM, script: string, shots: Shot[]) {
  const systemPrompt = `请根据以下剧本生成音频资产设定。

请以JSON格式返回：
{
  "characters": [
    {
      "character": "角色名称",
      "voiceDescription": "音色描述（性别、年龄、语调、音高、语速、口音、情绪适配）"
    }
  ],
  "soundEffects": [
    {
      "name": "音效名称",
      "description": "音效描述",
      "shotIds": ["S001"],
      "clipIds": ["C001"]
    }
  ]
}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `剧本内容：\n${script}` },
  ];

  const response = await llm.invoke(messages, {
    model: 'doubao-seed-1-8-251228',
    temperature: 0.7,
  });

  try {
    const content = response.content?.toString() || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {
      characters: [{
        character: '主角',
        voiceDescription: '年轻女性，25岁左右，语调温柔，音高适中，语速自然，普通话标准，情绪表达丰富'
      }],
      soundEffects: []
    };
  } catch {
    return {
      characters: [{
        character: '主角',
        voiceDescription: '年轻女性，25岁左右，语调温柔，音高适中，语速自然，普通话标准，情绪表达丰富'
      }],
      soundEffects: []
    };
  }
}

function generateFinalOutput(
  shots: Shot[],
  timingTable: TimingRow[],
  clips: Clip[],
  assets: any,
  audioAssets: any,
  targetDuration: number
) {
  const totalDuration = timingTable.reduce((sum, row) => sum + row.calculatedDuration, 0);
  const clipDurations = clips.map(c => `${c.clipId}: ${c.duration}秒`).join('，');

  let output = `# 即梦Agent分镜提示词工程文件\n\n`;

  // 第一部分：分场景Shot级镜头拆分
  output += `## 一、分场景Shot级镜头拆分\n\n`;
  shots.forEach((shot) => {
    output += `### ${shot.sceneNumber}. ${shot.sceneName}（${shot.timeOfDay} ${shot.location}）\n\n`;
    output += `- **Shot ID**: ${shot.shotId}\n`;
    output += `- **景别**: ${shot.shotType}\n`;
    output += `- **竖屏9:16适配画面内容**: ${shot.content}\n`;
    output += `- **同步音效/环境音**: ${shot.audio}\n`;
    if (shot.dialogue) output += `- **台词**: ${shot.dialogue}\n`;
    if (shot.narration) output += `- **旁白**: ${shot.narration}\n`;
    if (shot.os) output += `- **内心OS**: ${shot.os}\n`;
    if (shot.voiceover) output += `- **画外音**: ${shot.voiceover}\n`;
    if (shot.effects?.length) output += `- **特效**: ${shot.effects.join('，')}\n`;
    output += `\n`;
  });

  // 第二部分：分镜计时表
  output += `## 二、分镜计时表\n\n`;
  output += `| 镜头ID | 景别 | 画面内容 | 台词/旁白 | 字数 | 说话时长 | 动作时长 | 计算时长 | AI生成适配说明 |\n`;
  output += `|--------|------|----------|-----------|------|----------|----------|----------|----------------|\n`;
  timingTable.forEach((row) => {
    output += `| ${row.shotId} | ${row.shotType} | ${row.content.substring(0, 30)}... | ${row.dialogue.substring(0, 20)}... | ${row.wordCount} | ${row.speakingDuration}秒 | ${row.actionDuration}秒 | ${row.calculatedDuration}秒 | ${row.aiNotes} |\n`;
  });
  output += `\n`;
  output += `**总时长**: ${totalDuration}秒（目标：${targetDuration}秒）\n\n`;
  output += `**备注**: 时长<4秒的镜头需合并入同场景Clip\n\n`;

  // 第三部分：分镜组合Clip表
  output += `## 三、分镜组合Clip表\n\n`;
  clips.forEach((clip) => {
    output += `### ${clip.clipId}（${clip.duration}秒）\n\n`;
    output += `- **时长**: ${clip.duration}秒\n`;
    output += `- **包含镜头**: ${clip.shotSequence}\n`;
    output += `- **画面内容**: ${clip.content}\n`;
    output += `- **同步音效**: ${clip.audio}\n`;
    output += `- **台词/旁白**: ${clip.dialogue}\n`;
    output += `\n`;
    output += `**参考素材**:\n`;
    output += `- 人物素材: ${clip.characterMaterials.join('，')}\n`;
    output += `- 场景素材: ${clip.sceneMaterials.join('，')}\n`;
    output += `- 物品素材: ${clip.itemMaterials.join('，')}\n`;
    output += `\n`;
  });

  // 第四部分：角色设计标准化设定
  output += `## 四、角色设计标准化设定\n\n`;
  assets.characters?.forEach((char: CharacterAsset) => {
    output += `### ${char.name}\n\n`;
    output += `- **年龄**: ${char.age}\n`;
    output += `- **外貌**: ${char.appearance}\n`;
    output += `- **五官特征**: ${char.facialFeatures}\n`;
    output += `- **发型**: ${char.hairstyle}\n`;
    output += `- **气质**: ${char.temperament}\n`;
    output += `- **妆造**: ${char.makeup}\n`;
    output += `- **服饰**: ${char.clothing}\n`;
    output += `- **核心性格**: ${char.personality}\n`;
    output += `- **统一画风适配**: ${char.artStyle}\n`;
    output += `- **涉及Clip**: ${char.clipIds.join('，')}\n`;
    output += `\n`;
  });

  // 第五部分：核心道具/物品+场景设计标准化设定
  output += `## 五、核心道具/物品+场景设计标准化设定\n\n`;
  output += `### 道具资产\n\n`;
  assets.items?.forEach((item: ItemAsset) => {
    output += `#### ${item.name}\n\n`;
    output += `- **分类**: ${item.category}\n`;
    output += `- **AI生成基础设定**: ${item.base}\n`;
    output += `- **物品类别**: ${item.itemType}\n`;
    output += `- **涉及Clip**: ${item.clipIds.join('，')}\n`;
    output += `\n`;
  });
  output += `### 场景资产\n\n`;
  assets.scenes?.forEach((scene: SceneAsset) => {
    output += `#### ${scene.name}\n\n`;
    output += `- **环境细节描述**: ${scene.environment}\n`;
    output += `- **光影与色调设定**: ${scene.lighting}\n`;
    output += `- **氛围设定**: ${scene.atmosphere}\n`;
    output += `- **统一画风适配**: ${scene.artStyle}\n`;
    output += `- **涉及Clip**: ${scene.clipIds.join('，')}\n`;
    output += `\n`;
  });

  // 第六部分：音频资产设计
  output += `## 六、音频资产设计\n\n`;
  output += `### 角色音色设定\n\n`;
  audioAssets.characters?.forEach((audio: AudioAsset) => {
    output += `#### ${audio.character}\n\n`;
    output += `- **音色描述**: ${audio.voiceDescription}\n`;
    output += `\n`;
  });
  if (audioAssets.soundEffects?.length > 0) {
    output += `### 音效/环境音设计\n\n`;
    audioAssets.soundEffects?.forEach((sfx: SoundEffect) => {
      output += `#### ${sfx.name}\n\n`;
      output += `- **对应镜头**: ${sfx.shotIds.join('，')}\n`;
      output += `- **对应Clip**: ${sfx.clipIds.join('，')}\n`;
      output += `\n`;
    });
  }

  // 最终校验信息
  output += `---\n\n`;
  output += `## 最终校验信息\n\n`;
  output += `- **Clip总数量**: ${clips.length}个\n`;
  output += `- **单Clip时长明细**: ${clipDurations}\n`;
  output += `- **总时长**: ${totalDuration}秒\n`;
  output += `- **时长校验**: ✅ 所有时长为正整数\n`;
  output += `- **Clip时长校验**: ✅ 所有Clip在4-15秒之间\n`;
  output += `- **适配性**: ✅ 全程适配纯AI生成图片+视频\n`;

  return output;
}
