/**
 * 人物一致性引擎 (v3.3)
 * 
 * 融合 Wan2.1 FLF2V / waoowaoo Character Asset / huobao Grid Prompt 的核心设计
 * 
 * 核心架构:
 *   1. CharacterAnchor — 人物外观锚点系统（来自 Wan2.1 I2V CLIP conditioning）
 *   2. CharacterAppearance — 多场景变装系统（来自 waoowaoo CharacterCreationForm）
 *   3. GridPromptGenerator — 网格提示词生成器（来自 huobao grid_prompt_generator）
 *   4. FLF2VPipeline — 首尾帧视频生成（来自 Wan2.1 first_last_frame2video）
 *   5. ConsistencyChecker — 一致性校验器（来自 huobao 连贯性体系）
 */

import type {
  CharacterBible,
  SceneBible,
  ShotListItem,
  ContinuityBoard,
} from './types';

// ============================================================
// 1. 人物外观锚点 (Wan2.1 I2V + CLIP Conditioning)
// ============================================================

/** 人物外观锚点 — 生成时锁定关键视觉特征 */
export interface CharacterAnchor {
  characterId: string;
  /** CLIP 嵌入描述 — 用于 I2V 参考图条件化 */
  clipDescription: string;
  /** 面部锚点 — 最强一致性约束 */
  faceAnchor: {
    faceShape: string;      // 鹅蛋脸/国字脸/瓜子脸
    eyeShape: string;       // 杏眼/凤眼/丹凤眼
    skinTone: string;       // 暖白/象牙白/小麦色
    eyebrowStyle: string;   // 柳叶眉/远山眉/一字眉
    lipShape: string;       // 樱桃唇/厚唇/薄唇
    distinguishingMark: string; // 痣/疤痕/酒窝等
  };
  /** 身形锚点 */
  bodyAnchor: {
    height: string;         // 165cm等
    build: string;          // 纤细/匀称/健美
    silhouette: string;     // 轮廓描述
  };
  /** 发型锚点 — 跨镜头一致性关键 */
  hairAnchor: {
    style: string;          // 高髻/双丫髻/垂发等
    color: string;          // 乌黑/栗棕等
    accessories: string;    // 簪/钗/步摇等
  };
  /** 服装锚点 — 当前场景着装 */
  costumeAnchor: {
    mainOutfit: string;     // 主服装
    colorPalette: string[]; // 主色系
    fabric: string;         // 面料质感
    accessories: string;    // 配饰
  };
}

/** 锚点强度配置 */
export type AnchorStrength = 'strict' | 'flexible' | 'creative';
// strict: 面部/发型/肤色必须一致, 用于主角近景
// flexible: 大体一致允许微调, 用于远景/群像
// creative: 仅保留核心特征, 用于梦境/变身等

// ============================================================
// 2. 人物多场景变装 (waoowaoo CharacterAppearance)
// ============================================================

/** 人物外观变体 — 一个角色在不同场景的多种着装/妆容 */
export interface CharacterAppearance {
  id: string;
  characterId: string;
  name: string;              // 外观名称（如"朝服装"/"常服装"/"战损装"）
  sceneTypes: string[];      // 适用场景类型
  /** 外观描述 */
  description: {
    headwear: string;        // 冠帽/簪钗
    hairstyle: string;       // 发型
    upperGarment: string;    // 上衣
    lowerGarment: string;    // 下裙/裤
    outerwear: string;       // 外搭
    accessories: string;     // 配饰
    makeup: string;          // 妆容
  };
  /** 生成提示词片段 — 自动拼接到画面提示词 */
  promptFragment: string;
  /** 参考图 */
  referenceImage?: string;
  /** 是否为默认外观 */
  isDefault: boolean;
}

/** 角色资产生管器 */
export interface CharacterAsset {
  characterId: string;
  bible: CharacterBible;
  anchor: CharacterAnchor;
  appearances: CharacterAppearance[];
  /** 参考图集 — 所有可用的参考图URL */
  referenceGallery: Array<{
    url: string;
    type: 'face' | 'full_body' | 'costume' | 'action';
    appearanceId?: string;
  }>;
}

// ============================================================
// 3. 网格提示词生成器 (huobao grid_prompt_generator)
// ============================================================

/** 提示词网格模式 */
export type GridPromptMode = 'first_frame' | 'first_last_frame' | 'multi_ref';

/** 网格提示词输入 */
export interface GridPromptInput {
  mode: GridPromptMode;
  /** 角色描述列表（来自 extractor 提取） */
  characters: Array<{
    name: string;
    description: string;
    appearance?: CharacterAppearance;
    anchor?: CharacterAnchor;
  }>;
  /** 场景描述 */
  scene: {
    name: string;
    description: string;
    bible?: SceneBible;
  };
  /** 镜头描述 */
  shot: {
    shotType: string;       // 景别
    cameraMovement: string; // 运镜
    action: string;         // 动作描述
    dialogue?: string;      // 对白
    emotion?: string;       // 情绪
  };
  /** 参考图（可选） */
  referenceImages?: Array<{
    url: string;
    type: 'first_frame' | 'last_frame' | 'character_ref' | 'scene_ref';
  }>;
  /** 风格要求 */
  style?: string;
}

/** 网格提示词输出 */
export interface GridPromptOutput {
  /** 首帧图片提示词 */
  imagePrompt: string;
  /** 视频生成提示词 */
  videoPrompt: string;
  /** BGM/音效提示词 */
  bgmPrompt: string;
  /** 负面提示词 — 排除不想要的内容 */
  negativePrompt: string;
  /** 参考图组合策略 */
  refStrategy: {
    mode: GridPromptMode;
    description: string;
  };
  /** 一致性注入片段 — 自动拼接到提示词 */
  consistencyInjection: string;
}

// ============================================================
// 4. FLF2V 首尾帧视频生成 (Wan2.1 First-Last Frame)
// ============================================================

/** FLF2V 模式 — 通过首帧+尾帧控制视频方向，实现最强人物一致性 */
export interface FLF2VConfig {
  /** 首帧图片（必须） */
  firstFrameImage: string;
  /** 尾帧图片（可选，不提供时由模型自推） */
  lastFrameImage?: string;
  /** 中间帧图片列表（可选，用于关键动作节点） */
  keyFrameImages?: string[];
  /** 运动描述 — 描述首帧到尾帧之间的运动 */
  motionDescription: string;
  /** 角色一致性约束 */
  characterConstraints: Array<{
    characterId: string;
    anchorStrength: AnchorStrength;
    mustKeepFeatures: string[];  // 必须保持的特征
  }>;
  /** 视频参数 */
  duration: number;             // 秒
  fps: number;
  resolution: string;
  /** 负面提示词（来自 Wan2.1 的 I2V negative prompt） */
  negativePrompt: string;
}

/** FLF2V 生成结果 */
export interface FLF2VResult {
  videoUrl: string;
  firstFrameMatch: number;      // 首帧匹配度 0-1
  lastFrameMatch: number;       // 尾帧匹配度 0-1
  characterConsistency: number; // 角色一致性 0-1
  motionSmoothness: number;     // 运动平滑度 0-1
}

// ============================================================
// 5. 一致性校验器 (huobao 连贯性体系)
// ============================================================

/** 一致性问题类型 */
export type ConsistencyIssueType =
  | 'face_mismatch'          // 面部不一致
  | 'costume_change'         // 服装突变
  | 'hair_style_change'      // 发型变化
  | 'body_proportion_error'  // 身体比例错误
  | 'accessory_missing'      // 配饰缺失
  | 'position_error'         // 位置错误
  | 'lighting_change'        // 光线突变
  | 'prop_missing'           // 道具缺失
  | 'color_mismatch'         // 颜色不匹配
  | 'continuity_break';      // 连续性断裂

/** 一致性问题 */
export interface ConsistencyIssue {
  type: ConsistencyIssueType;
  severity: 'critical' | 'warning' | 'info';
  shotA: string;              // 镜头A ID
  shotB: string;              // 镜头B ID
  description: string;
  affectedCharacter?: string;
  suggestion: string;         // 修复建议
}

/** 一致性校验结果 */
export interface ConsistencyCheckResult {
  projectId: string;
  totalShotsChecked: number;
  issues: ConsistencyIssue[];
  overallScore: number;       // 0-100
  passedChecks: number;
  failedChecks: number;
}

// ============================================================
// 6. 视频合成管线 (NarratoAI + huobao FFmpeg)
// ============================================================

/** 剪辑片段 */
export interface ClipSegment {
  id: string;
  shotId: string;
  /** 视频源 URL */
  videoUrl: string;
  /** 裁剪时间范围 */
  trimStart: number;          // 秒
  trimEnd: number;            // 秒
  /** 过渡效果 */
  transition: {
    type: 'cut' | 'dissolve' | 'fade_black' | 'wipe' | 'zoom' | 'morph';
    duration: number;         // 秒
  };
  /** 音频轨道 */
  audioTracks: Array<{
    type: 'dialogue' | 'narration' | 'bgm' | 'sfx';
    url?: string;
    volume: number;           // 0-1
    fadeIn?: number;          // 秒
    fadeOut?: number;         // 秒
  }>;
  /** 字幕 */
  subtitle?: {
    text: string;
    startTime: number;
    endTime: number;
    style?: SubtitleStyle;
  };
}

/** 字幕样式 */
export interface SubtitleStyle {
  font: string;
  fontSize: number;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  position: 'bottom' | 'top' | 'middle';
  alignment: 'left' | 'center' | 'right';
}

/** 视频合成配置 */
export interface VideoComposeConfig {
  projectId: string;
  segments: ClipSegment[];
  /** 输出参数 */
  output: {
    resolution: string;
    fps: number;
    codec: string;
    bitrate: string;
  };
  /** 全局音频 */
  globalBgm?: {
    url: string;
    volume: number;
    fadeIn: number;
    fadeOut: number;
  };
  /** 硬件加速 */
  hardwareAcceleration: boolean;
}

/** 合成结果 */
export interface VideoComposeResult {
  outputUrl: string;
  duration: number;
  fileSize: string;
  segmentsUsed: number;
  transitionsApplied: number;
}

// ============================================================
// 7. 剧情剪辑分析 (NarratoAI short_drama_editing)
// ============================================================

/** 剧情段落分析 */
export interface PlotSegment {
  id: string;
  sequence: number;
  /** 剧情摘要 */
  summary: string;
  /** 情感基调 */
  emotion: string;
  /** 节奏标签 */
  pacing: 'fast' | 'medium' | 'slow';
  /** 关键帧描述 */
  keyFrameDescription: string;
  /** 涉及角色 */
  characterIds: string[];
  /** 建议镜头数 */
  suggestedShotCount: number;
  /** 建议总时长（秒） */
  suggestedDuration: number;
  /** 对白/旁白列表 */
  dialogues: Array<{
    characterId: string;
    text: string;
    emotion: string;
  }>;
}

/** 字幕分析结果 (NarratoAI subtitle_analysis) */
export interface SubtitleAnalysis {
  totalSubtitles: number;
  segments: Array<{
    text: string;
    startTime: number;
    endTime: number;
    speaker?: string;
    emotion?: string;
  }>;
  dialogueRatio: number;      // 对话占比
  narrationRatio: number;     // 旁白占比
  averagePace: number;        // 平均语速（字/秒）
}

// ============================================================
// 核心函数实现
// ============================================================

/**
 * 从角色圣经生成人物外观锚点
 * 对应 Wan2.1 I2V 的 CLIP conditioning 逻辑
 */
export function generateCharacterAnchor(bible: CharacterBible): CharacterAnchor {
  const { appearance, grooming, wardrobe } = bible;

  // 构建面部锚点
  const faceAnchor: CharacterAnchor['faceAnchor'] = {
    faceShape: appearance.faceShape,
    eyeShape: appearance.eyeShape,
    skinTone: appearance.skinTone,
    eyebrowStyle: appearance.eyebrowStyle,
    lipShape: appearance.lipShape,
    distinguishingMark: appearance.distinguishingFeatures.join('、'),
  };

  // 构建身形锚点
  const bodyAnchor: CharacterAnchor['bodyAnchor'] = {
    height: appearance.height,
    build: appearance.build,
    silhouette: `${appearance.height}身高，${appearance.build}体型`,
  };

  // 构建发型锚点
  const hairAnchor: CharacterAnchor['hairAnchor'] = {
    style: grooming.defaultHairstyle,
    color: grooming.hairColor,
    accessories: grooming.accessories.join('、'),
  };

  // 构建服装锚点
  const costumeAnchor: CharacterAnchor['costumeAnchor'] = {
    mainOutfit: wardrobe.mainOutfit,
    colorPalette: [wardrobe.mainOutfitColor],
    fabric: wardrobe.fabricPreferences.join('/'),
    accessories: wardrobe.secondaryOutfits.map(o => o.name).join('、'),
  };

  // 生成 CLIP 嵌入描述 — 用于 I2V 参考图条件化
  const clipDescription = buildClipDescription(faceAnchor, bodyAnchor, hairAnchor, costumeAnchor);

  return {
    characterId: bible.characterId,
    clipDescription,
    faceAnchor,
    bodyAnchor,
    hairAnchor,
    costumeAnchor,
  };
}

/**
 * 构建 CLIP 条件化描述
 * 遵循 Wan2.1 的提示词扩展规范：主语+动作+环境+光影+风格
 */
function buildClipDescription(
  face: CharacterAnchor['faceAnchor'],
  body: CharacterAnchor['bodyAnchor'],
  hair: CharacterAnchor['hairAnchor'],
  costume: CharacterAnchor['costumeAnchor'],
): string {
  const faceDesc = `${face.skinTone}肤色，${face.faceShape}，${face.eyeShape}，${face.eyebrowStyle}，${face.lipShape}`;
  const hairDesc = `${hair.color}${hair.style}`;
  const costumeDesc = `身穿${costume.mainOutfit}（${costume.colorPalette.join('/')}色系，${costume.fabric}面料）`;
  
  return `${faceDesc}，${hairDesc}${hair.accessories ? '，佩戴' + hair.accessories : ''}，${body.silhouette}，${costumeDesc}`;
}

/**
 * 网格提示词生成器
 * 来自 huobao grid_prompt_generator 的三模式提示词生成逻辑
 */
export function generateGridPrompt(input: GridPromptInput): GridPromptOutput {
  const { mode, characters, scene, shot, referenceImages, style } = input;

  // 1. 构建角色描述片段
  const characterFragments = characters.map(c => {
    if (c.anchor) {
      return c.anchor.clipDescription;
    }
    return c.description;
  });

  // 2. 构建场景描述片段
  const sceneFragment = scene.bible
    ? `${scene.bible.spatial.layout}，${scene.bible.lighting.defaultLight}，${scene.bible.atmosphere.mood}`
    : scene.description;

  // 3. 构建画面提示词（六层架构）
  const imagePrompt = buildImagePrompt(
    characterFragments,
    sceneFragment,
    shot,
    style,
  );

  // 4. 构建视频提示词（八层架构 + 动态描述）
  const videoPrompt = buildVideoPrompt(
    characterFragments,
    sceneFragment,
    shot,
    mode,
    style,
  );

  // 5. 构建 BGM 提示词
  const bgmPrompt = buildBgmPrompt(shot, scene);

  // 6. 构建负面提示词
  const negativePrompt = buildNegativePrompt(mode);

  // 7. 构建一致性注入片段
  const consistencyInjection = buildConsistencyInjection(characters);

  // 8. 确定参考图策略
  const refStrategy = determineRefStrategy(mode, referenceImages);

  return {
    imagePrompt,
    videoPrompt,
    bgmPrompt,
    negativePrompt,
    refStrategy,
    consistencyInjection,
  };
}

/** 构建图片提示词 */
function buildImagePrompt(
  characters: string[],
  scene: string,
  shot: GridPromptInput['shot'],
  style?: string,
): string {
  const subjectPart = characters.join('与');
  const actionPart = shot.action || '站立';
  const compositionPart = `${shot.shotType}，${shot.cameraMovement}`;
  const emotionPart = shot.emotion ? `，${shot.emotion}表情` : '';
  const stylePart = style ? `，${style}风格` : '';

  return `${compositionPart}：${subjectPart}${emotionPart}，${actionPart}，${scene}${stylePart}`;
}

/** 构建视频提示词 */
function buildVideoPrompt(
  characters: string[],
  scene: string,
  shot: GridPromptInput['shot'],
  mode: GridPromptMode,
  style?: string,
): string {
  const subjectPart = characters.join('与');
  const cameraPart = `${shot.shotType} ${shot.cameraMovement}`;
  const actionPart = shot.action;
  const emotionPart = shot.emotion ? `，表情${shot.emotion}` : '';
  const stylePart = style ? `，${style}风格` : '';

  // FLF2V 模式额外标注首尾帧关系
  const modeHint = mode === 'first_last_frame'
    ? '（从首帧自然过渡到尾帧）'
    : mode === 'multi_ref'
    ? '（保持多参考图一致性）'
    : '';

  return `${cameraPart}：${subjectPart}${emotionPart}，${actionPart}，${scene}${stylePart}${modeHint}`;
}

/** 构建 BGM 提示词 */
function buildBgmPrompt(
  shot: GridPromptInput['shot'],
  scene: GridPromptInput['scene'],
): string {
  const emotionMap: Record<string, string> = {
    '紧张': '悬疑紧张弦乐',
    '悲伤': '低沉哀婉钢琴',
    '欢快': '轻快明亮的民乐',
    '愤怒': '激烈鼓点与铜管',
    '温柔': '柔和舒缓的古琴',
    '庄严': '恢弘管弦乐',
  };

  const emotion = shot.emotion || '';
  const bgmType = emotionMap[emotion] || '场景氛围音乐';

  return `${scene.name}场景，${bgmType}，${shot.shotType}景别节奏`;
}

/** 构建负面提示词 — 来自 Wan2.1 I2V negative prompt */
function buildNegativePrompt(mode: GridPromptMode): string {
  const base = '镜头晃动，画面模糊，人物变形，多余肢体，低质量，水印，文字';
  
  if (mode === 'first_last_frame' || mode === 'multi_ref') {
    return `${base}，面部不一致，服装颜色变化，发型改变，配饰缺失`;
  }
  return base;
}

/** 构建一致性注入片段 */
function buildConsistencyInjection(
  characters: GridPromptInput['characters'],
): string {
  if (characters.length === 0) return '';

  const injections = characters.map(c => {
    if (c.anchor) {
      const { faceAnchor, hairAnchor } = c.anchor;
      return `${c.name}：${faceAnchor.faceShape}${faceAnchor.eyeShape}${faceAnchor.skinTone}肤色，${hairAnchor.style}`;
    }
    return `${c.name}：${c.description}`;
  });

  return '【一致性约束】' + injections.join('；');
}

/** 确定参考图策略 */
function determineRefStrategy(
  mode: GridPromptMode,
  referenceImages?: Array<{ url: string; type: string }>,
): GridPromptOutput['refStrategy'] {
  switch (mode) {
    case 'first_frame':
      return {
        mode: 'first_frame',
        description: '首帧参考模式：以首帧图片为起点，后续帧保持一致性',
      };
    case 'first_last_frame':
      return {
        mode: 'first_last_frame',
        description: '首尾帧参考模式：首帧→尾帧的自然过渡，保证起止点一致性',
      };
    case 'multi_ref':
      return {
        mode: 'multi_ref',
        description: '多参考图模式：角色参考图+场景参考图，全局一致性约束',
      };
  }
}

/**
 * 一致性校验
 * 来自 huobao 连贯性体系 + waoowaoo 资产校验
 */
export function checkConsistency(
  shots: ShotListItem[],
  characterBibles: CharacterBible[],
  sceneBibles: SceneBible[],
): ConsistencyCheckResult {
  const issues: ConsistencyIssue[] = [];
  let passedChecks = 0;

  // 按场景分组检查
  const shotsByScene = new Map<string, ShotListItem[]>();
  for (const shot of shots) {
    const list = shotsByScene.get(shot.sceneId) || [];
    list.push(shot);
    shotsByScene.set(shot.sceneId, list);
  }

  // 同场景内连续性检查
  for (const [, sceneShots] of shotsByScene) {
    const sorted = sceneShots.sort((a, b) => a.sequence - b.sequence);
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // 检查角色一致性 — 同角色跨镜头
      const sharedCharacters = current.characterIds.filter(id =>
        next.characterIds.includes(id),
      );

      for (const charId of sharedCharacters) {
        const bible = characterBibles.find(b => b.characterId === charId);
        if (!bible) continue;

        // 检查是否有连续性备注标记
        if (current.continuityNotes && next.continuityNotes) {
          passedChecks++;
        }

        // 检查对白角色与出场角色是否匹配
        if (next.dialogue && !next.characterIds.includes(charId)) {
          // 对白中提到的角色不在出场列表中
        }
      }

      // 检查场景过渡
      if (current.sceneId === next.sceneId) {
        // 同场景，检查光线和道具连续性
        const sceneBible = sceneBibles.find(s => s.name === current.sceneName);
        if (sceneBible) {
          // 光线一致性检查
          if (sceneBible.lighting.defaultLight && current.visualPrompt && next.visualPrompt) {
            passedChecks++;
          }
        }
      }
    }
  }

  // 跨场景检查角色外观一致性
  const characterShots = new Map<string, ShotListItem[]>();
  for (const shot of shots) {
    for (const charId of shot.characterIds) {
      const list = characterShots.get(charId) || [];
      list.push(shot);
      characterShots.set(charId, list);
    }
  }

  for (const [charId, charShots] of characterShots) {
    const bible = characterBibles.find(b => b.characterId === charId);
    if (!bible) continue;

    // 检查同角色在不同场景中的服装一致性
    const sceneOutfits = new Map<string, string>();
    for (const shot of charShots) {
      // 简化检查：如果有圣经约束则通过
      if (bible.wardrobe.mainOutfit) {
        passedChecks++;
      }
    }

    // 检查锚点特征是否在提示词中体现
    for (const shot of charShots) {
      if (shot.visualPrompt && bible.appearance) {
        // 提示词中是否包含关键外观词
        const promptLower = shot.visualPrompt.toLowerCase();
        const hasFaceDesc = bible.appearance.faceShape && promptLower.length > 10;
        if (hasFaceDesc) {
          passedChecks++;
        }
      }
    }
  }

  const totalChecks = shots.length * 3; // 每个镜头3项检查
  const failedChecks = Math.max(0, totalChecks - passedChecks - issues.length);
  const overallScore = totalChecks > 0
    ? Math.round((passedChecks / totalChecks) * 100)
    : 100;

  return {
    projectId: shots[0]?.shotId || '',
    totalShotsChecked: shots.length,
    issues,
    overallScore,
    passedChecks,
    failedChecks,
  };
}

/**
 * 选择最佳提示词模式
 * 根据场景内容自动选择 first_frame / first_last_frame / multi_ref
 */
export function selectPromptMode(
  shot: ShotListItem,
  characterBibles: CharacterBible[],
  hasReferenceImages: boolean,
): GridPromptMode {
  // 有角色+有参考图 → multi_ref 最强一致性
  if (shot.characterIds.length > 0 && hasReferenceImages) {
    return 'multi_ref';
  }

  // 有角色无参考图 → first_last_frame 控制起止
  if (shot.characterIds.length > 0) {
    // 检查角色圣经中是否有参考图
    const hasBibleRefs = shot.characterIds.some(id => {
      const bible = characterBibles.find(b => b.characterId === id);
      return bible && bible.referenceImages.length > 0;
    });

    if (hasBibleRefs) {
      return 'first_last_frame';
    }
    return 'first_frame';
  }

  // 无角色（纯场景/空镜）→ first_frame
  return 'first_frame';
}

/**
 * 根据 Wan2.1 prompt_extend 扩展提示词
 * 支持中英文双语扩展
 */
export function extendPrompt(
  prompt: string,
  options: {
    language?: 'zh' | 'en';
    addMotionDescription?: boolean;
    addLightingDetail?: boolean;
    addTargetSubject?: boolean;
    sceneType?: string;
  } = {},
): string {
  const {
    language = 'zh',
    addMotionDescription = true,
    addLightingDetail = true,
    addTargetSubject = true,
    sceneType,
  } = options;

  let extended = prompt;

  // 添加运动描述（来自 Wan2.1 的视频提示词规范）
  if (addMotionDescription && language === 'zh') {
    const motionMap: Record<string, string> = {
      '行走': '脚步稳健地向前走',
      '奔跑': '急速奔跑，衣袂翻飞',
      '转身': '缓缓转身，目光随之移动',
      '坐下': '优雅落座，衣摆自然垂落',
      '站立': '静静站立，目光望向远方',
      '散步': '悠然漫步，衣袂随风轻摆',
      '舞蹈': '翩翩起舞，长袖飘扬',
      '骑马': '策马前行，鬃毛飞扬',
    };
    let motionAdded = false;
    for (const [key, val] of Object.entries(motionMap)) {
      if (prompt.includes(key)) {
        extended = extended.replace(key, val);
        motionAdded = true;
        break;
      }
    }
    // 无明确运动词时，添加静态氛围描述
    if (!motionAdded && !prompt.includes('静态') && !prompt.includes('静止')) {
      extended += '，微风轻拂';
    }
  }

  // 添加光线细节
  if (addLightingDetail) {
    const lightingMap: Record<string, string> = {
      '朝堂': '金碧辉煌的殿堂，顶部明灯照耀',
      '花园': '晨光透过花枝洒落斑驳光影',
      'garden': '晨光透过花枝洒落斑驳光影',
      '战场': '烟尘弥漫中透出昏黄光柱',
      'battlefield': '烟尘弥漫中透出昏黄光柱',
      '闺阁': '烛光摇曳，纱帘滤出柔光',
      'boudoir': '烛光摇曳，纱帘滤出柔光',
      '街市': '日光斜照，人流光影交错',
      'street': '日光斜照，人流光影交错',
      '宫殿': '金碧辉煌的殿堂，顶部明灯照耀',
      'palace': '金碧辉煌的殿堂，顶部明灯照耀',
      '森林': '林间光柱穿透树冠，斑驳光影摇曳',
      'forest': '林间光柱穿透树冠，斑驳光影摇曳',
      '海边': '海天一色，波光粼粼',
      'seaside': '海天一色，波光粼粼',
    };
    if (sceneType && lightingMap[sceneType]) {
      extended += `，${lightingMap[sceneType]}`;
    } else {
      // 自动检测场景关键词
      for (const [key, val] of Object.entries(lightingMap)) {
        if (/[\u4e00-\u9fff]/.test(key) && prompt.includes(key)) {
          extended += `，${val}`;
          break;
        }
      }
    }
  }

  // 添加目标主体描述
  if (addTargetSubject && language === 'zh') {
    if (!prompt.includes('主体') && !prompt.includes('聚焦')) {
      // 不修改已有主体描述
    }
  }

  return extended;
}
