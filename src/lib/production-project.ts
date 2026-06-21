import type {
  NarrationSuggestion,
  PromptBasedShot,
  SubtitleSuggestion,
  UserInputEntities,
} from './storyboard-generator';
import { DirectorAgent } from './video-production/director-agent';
import { WriterAgent } from './video-production/writer-agent';
import type {
  CharacterBible,
  DAGNode,
  DirectorOutput,
  SceneBible,
  ShotList,
  ShotListItem,
  WriterOutput,
} from './video-production/types';
import { buildTrailerBeatSheet } from './trailer-beat-sheet';
import type { TrailerBeatSheet } from './trailer-beat-sheet';
import {
  buildFiveDynastiesShotAudio,
  buildFiveDynastiesShotPrompt,
  buildFiveDynastiesStoryBible,
  fiveDynastiesObjectNames,
  fiveDynastiesSubject,
  fiveDynastiesLocation,
  isFiveDynastiesHistoricalTrailer,
} from './five-dynasties-trailer-project';

export type ProductionAssetKind = 'script' | 'character' | 'scene' | 'prop' | 'storyboard' | 'task' | 'videoSegment' | 'finalVideo' | 'deliverable';
type ProductionAssetStatus = 'planned' | 'ready' | 'running' | 'failed' | 'completed' | 'pending';

interface VisualAnchorInput {
  element: string;
  category: string;
}

export interface ProductionAsset {
  id: string;
  kind: ProductionAssetKind;
  name: string;
  status: ProductionAssetStatus;
  summary: string;
  source: 'prompt' | 'storyboard' | 'task' | 'system';
  relatedShotIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface ProductionGraphEdge {
  from: string;
  to: string;
  relation: 'feeds' | 'references' | 'creates' | 'tracks';
}

export interface ProductionStage {
  id: 'script' | 'assets' | 'storyboard' | 'task' | 'assembly' | 'delivery';
  name: string;
  status: ProductionAssetStatus;
  summary: string;
  assetIds: string[];
}

export type ProductionStoryBeatId = 'setup' | 'inciting' | 'conflict' | 'turning' | 'resolution';

export interface ProductionStoryBeat {
  id: ProductionStoryBeatId;
  label: string;
  purpose: string;
  emotion: string;
  visualGoal: string;
  shotIds: string[];
}

export interface ProductionStoryBible {
  premise: string;
  protagonist: string;
  desire: string;
  obstacle: string;
  relationship: string;
  conflict: string;
  turningPoint: string;
  endingHook: string;
  emotionalArc: {
    start: string;
    shift: string;
    end: string;
  };
  continuityRules: string[];
  beats: ProductionStoryBeat[];
  trailerBeatSheet?: TrailerBeatSheet;
}

export interface ProductionSemanticPlan {
  version: 'yh-production-semantic-plan-v1';
  source: 'video-production-v3-merged';
  reference: {
    primary: 'ViMax';
    secondary: ['Toonflow-app', 'ArcReel'];
    adaptedIdeas: string[];
  };
  writerOutput: WriterOutput;
  directorOutput: DirectorOutput;
  characterBibles: Array<Partial<CharacterBible> & { id: string; characterId: string; name: string; version: number }>;
  sceneBibles: Array<Partial<SceneBible> & { id: string; name: string; version: number }>;
  shotList: ShotList;
  dag: {
    nodes: DAGNode[];
  };
  assetLinks: {
    characterAssetIds: string[];
    sceneAssetIds: string[];
    storyboardAssetId: string;
    deliverableAssetId: string;
  };
}

export interface ProductionProject {
  id: string;
  title: string;
  prompt: string;
  style: string;
  ratio: string;
  sceneType: string;
  duration: number;
  segmentDuration: number;
  narrativeSummary: string;
  storyBible: ProductionStoryBible;
  semanticPlan: ProductionSemanticPlan;
  assets: ProductionAsset[];
  stages: ProductionStage[];
  graph: {
    nodes: Array<{ id: string; kind: ProductionAssetKind; name: string; status: ProductionAssetStatus }>;
    edges: ProductionGraphEdge[];
  };
  storyboard: {
    shotCount: number;
    totalDuration: number;
    shots: Array<{
      id: string;
      index: number;
      duration: number;
      phase?: string;
      phaseLabel?: string;
      shotType?: string;
      shotTypeLabel?: string;
      storyBeat: ProductionStoryBeatId;
      dramaticPurpose: string;
      emotionShift: string;
      prompt: string;
      subtitleText?: string;
      narrationText?: string;
      status: ProductionAssetStatus;
    }>;
  };
  output: {
    status: ProductionAssetStatus;
    taskId: string;
    canProceedToVideo: boolean;
    nextStep: string;
  };
  suggestions: {
    subtitle: SubtitleSuggestion;
    narration: NarrationSuggestion;
  };
}

export interface BuildProductionProjectParams {
  taskId: string;
  prompt: string;
  duration: number;
  segmentDuration: number;
  style: string;
  sceneType: string;
  ratio: string;
  entities: UserInputEntities;
  visualAnchors: VisualAnchorInput[];
  narrativeSummary: string;
  subtitleSuggestion: SubtitleSuggestion;
  narrationSuggestion: NarrationSuggestion;
  shots: Array<PromptBasedShot & { index?: number; status?: ProductionAssetStatus }>;
}

function compactText(value: string | undefined, fallback: string) {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
}

function uniqueValues(values: Array<string | undefined>) {
  const seen = new Set<string>();
  return values
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter(value => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function buildAssetId(kind: ProductionAssetKind, index: number) {
  return `${kind}-${index + 1}`;
}

function normalizeSubject(rawSubject: string, prompt: string) {
  if (isFiveDynastiesHistoricalTrailer(prompt)) {
    return fiveDynastiesSubject();
  }

  const genericSubjects = new Set(['他', '她', '它', 'TA', 'ta', '人物', '主体', '角色', '主角', '核心角色', '主角/核心主体']);
  const explicitRoles = [
    '年轻急救员',
    '急救员',
    '审计师',
    '品牌经理',
    '市场经理',
    '投放经理',
    '运营负责人',
    '创意总监',
    '制片人',
    '调律者',
    '漂泊旅人',
    '机甲少女',
  ];
  const directRole = explicitRoles.find(role => prompt.includes(role));
  if (directRole) return directRole;
  const objectLikeSubject = /(书包|录像带|胶片|档案袋|列车|电梯|警报|屏幕|按钮|对讲机|旧桥|车厢)/.test(rawSubject);
  if (rawSubject.length > 1 && !genericSubjects.has(rawSubject) && !objectLikeSubject) {
    return rawSubject;
  }
  const roleMatch = prompt.match(/([\u4e00-\u9fa5]{0,10}(急救员|审计师|经理|负责人|总监|剪辑师|导演|编剧|制片|摄影师|店员|学生|医生|记者|侦探|演员|少女|少年|女孩|男孩|女人|男人))/);
  if (roleMatch?.[1] && roleMatch[1].length > 1) {
    return roleMatch[1];
  }
  return '短剧主角';
}

function normalizeLocation(rawLocation: string, prompt: string) {
  if (isFiveDynastiesHistoricalTrailer(prompt)) {
    return fiveDynastiesLocation();
  }

  const genericLocations = new Set(['主要场景', '核心场景', '场景', '地点', '室内', '室外']);
  const explicitLocations = [
    '夜晚办公室',
    '办公室',
    '会议室',
    '品牌战情室',
    '投放中控台',
    '便利店',
    '剪辑室',
    '剧院',
    '地铁站',
    '街道',
    '仓库',
    '学校',
    '医院',
    '车站',
    '公寓',
    '天台',
    '走廊',
    '浮空遗迹',
    '海蚀废墟',
    '风暴峡谷',
    '未来城市',
    '森林',
    '海边',
  ];
  const directLocation = explicitLocations
    .map(location => ({ location, index: prompt.indexOf(location) }))
    .filter(item => item.index >= 0)
    .sort((a, b) => a.index - b.index || b.location.length - a.location.length)[0]?.location;
  if (directLocation) return directLocation;
  if (rawLocation.length > 1 && !genericLocations.has(rawLocation)) {
    return rawLocation;
  }
  const locationMatch = prompt.match(/([\u4e00-\u9fa5]{0,8}(便利店|剪辑室|剧院|办公室|会议室|中控台|地铁站|街道|仓库|学校|医院|车站|公寓|天台|走廊|森林|海边|遗迹|废墟|峡谷|城市))/);
  if (locationMatch?.[1] && locationMatch[1].length > 1) {
    return locationMatch[1];
  }
  return '核心场景';
}

function enrichObjectNames(objectNames: string[], prompt: string) {
  const inferredObjects = [
    '红色书包',
    '玩具对讲机',
    '旧桥警报屏',
    '紧急制动按钮',
    '最后一班列车',
    '旧桥',
    '透明电梯',
    '红色档案袋',
    '倒跳楼层数字',
    '旧录像带',
    '录像带',
    ...(!/无关宇宙胶片|抽象宇宙胶片|纯氛围蒙太奇/.test(prompt) ? ['胶片'] : []),
    '投放报表',
    '碎片素材',
    '增长曲线',
    '数据大屏',
    '新版方案',
    '广告脚本',
    '声波核心',
    '共鸣装置',
    '能量长刃',
    '潮汐罗盘',
    '染血山河图',
    '山河图',
    '黄袍',
    '残唐宫门',
    '黄河渡口',
    '南唐宫灯',
    '陈桥驿',
    '手机',
    '照片',
    '钥匙',
    '信件',
    '镜子',
  ]
    .filter(objectName => prompt.includes(objectName));
  const values = uniqueValues([...inferredObjects, ...objectNames]);
  const scopedValues = isFiveDynastiesHistoricalTrailer(prompt)
    ? uniqueValues([...fiveDynastiesObjectNames(), ...values])
    : values;
  return scopedValues.filter((value, _index, list) => !list.some(other => other !== value && other.includes(value)));
}

function deriveDesire(action: string, subject: string, prompt: string) {
  const weakActions = new Set(['完成关键选择', '凝望远方', '看向远方', '保持站立', '展示产品']);
  if (prompt.includes('最后一班列车') && prompt.includes('红色书包')) {
    return `${subject}想要在列车驶上旧桥前救下车厢里的孩子`;
  }
  if (prompt.includes('透明电梯') && prompt.includes('红色档案袋')) {
    return `${subject}想要带着红色档案袋离开公司并公开证据`;
  }
  if (prompt.includes('碎片素材') && prompt.includes('高转化广告')) {
    return `${subject}想要把碎片素材重组成一条高转化广告`;
  }
  if (prompt.includes('投放报表') || prompt.includes('增长曲线')) {
    return `${subject}想要把下滑报表改写成可上线的增长方案`;
  }
  if (prompt.includes('声波') || prompt.includes('共鸣') || prompt.includes('潮汐')) {
    return `${subject}想要追踪异常声波并守住关键同伴`;
  }
  return action && !weakActions.has(action)
    ? `${subject}想要${action}`
    : `${subject}想要在有限时间内改变眼前局面`;
}

function deriveObstacle(location: string, atmosphere: string, objects: string[]) {
  const objectHint = objects.length > 0 ? `，关键物件「${objects[0]}」带来新的限制` : '';
  return `${location}中的${atmosphere}压力不断升级${objectHint}`;
}

function assignStoryBeatShots(
  shotIds: string[],
  beatDefs: Array<Omit<ProductionStoryBeat, 'shotIds'>>,
) {
  const split = Math.max(1, Math.ceil(shotIds.length / beatDefs.length));
  return beatDefs.map((beat, index) => ({
    ...beat,
    shotIds: shotIds.slice(index * split, index === beatDefs.length - 1 ? undefined : (index + 1) * split),
  })).filter(beat => beat.shotIds.length > 0);
}

function cleanTemplateContamination(text: string, context: {
  subject: string;
  location: string;
  objectNames: string[];
}) {
  const prop = context.objectNames[0] || '关键线索';
  return compactText(text, '')
    .replaceAll('辽阔的海边沙滩，浪花轻柔拍打岸边', context.location)
    .replaceAll('温馨舒适的室内空间', context.location)
    .replaceAll('柔和的自然光空间', context.location)
    .replaceAll('故事发生的场景空间', context.location)
    .replaceAll('壮丽的自然景观', context.location)
    .replaceAll('人物形象展示', `${context.subject}面对${prop}的选择`)
    .replace(/[\u4e00-\u9fa5]{0,6}(女性|男性)?穿着舒适家居服的人物/g, context.subject)
    .replace(/着装符合人物身份和剧情场景的人物/g, context.subject)
    .replace(/人物处于场景中的关键位置/g, `${context.subject}处于${context.location}的关键位置`)
    .replace(/故事的尾声/g, `${context.subject}的选择留下后果`)
    .replace(/\s+/g, ' ')
    .trim();
}

function storyBeatVisibleAction(beatId: ProductionStoryBeatId, subject: string, location: string, prop: string) {
  switch (beatId) {
    case 'setup':
      return `${subject}出现在${location}，观众能看见${prop}和人物当前压力。`;
    case 'inciting':
      return `${subject}发现${prop}出现异常信息，停下并靠近查看。`;
    case 'conflict':
      return `${prop}带来的威胁升级，${subject}被迫在原计划和改写局面之间选择。`;
    case 'turning':
      return `${subject}主动改变${prop}的状态或位置，让转折通过动作发生。`;
    case 'resolution':
      return `${subject}的选择造成可见结果，${prop}留下新的后果或悬念。`;
    default:
      return `${subject}围绕${prop}完成一个能改变局面的动作。`;
  }
}

function buildStoryDrivenShotPrompt(shot: PromptBasedShot, context: {
  subject: string;
  location: string;
  objectNames: string[];
  storyBible: ProductionStoryBible;
}, index: number) {
  if (context.storyBible.protagonist.includes('山河图接力者')) {
    return buildFiveDynastiesShotPrompt(index, context);
  }

  const beat = findBeatForShot(context.storyBible, shot.id);
  const prop = context.objectNames[0] || '关键线索';
  const original = cleanTemplateContamination(shot.prompt, context);
  const mustSee = storyBeatVisibleAction(beat.id, context.subject, context.location, prop);
  const emotion = beat.emotion || context.storyBible.emotionalArc.shift;
  const execution = [
    `【${beat.label}】${beat.purpose}`,
    `【观众必须看懂】${mustSee}`,
    `【动作因果】承接第${Math.max(1, index)}镜头的状态，本镜头结束时要给下一镜头留下清楚因果钩子。`,
    `【三要素】画面同时保留主角「${context.subject}」、场景「${context.location}」和关键物件「${prop}」。`,
    `【情绪推进】${emotion}`,
    `【镜头执行】${original}`,
  ];
  return execution.join(' ');
}

function buildStoryBible(params: BuildProductionProjectParams, subject: string, location: string, atmosphere: string, objectNames: string[]) {
  if (isFiveDynastiesHistoricalTrailer(params.prompt)) {
    return buildFiveDynastiesStoryBible(params);
  }

  const action = compactText(params.entities.action, '完成关键选择');
  const emotion = compactText(params.entities.emotion, atmosphere);
  const desire = deriveDesire(action, subject, params.prompt);
  const obstacle = deriveObstacle(location, atmosphere, objectNames);
  const shotIds = params.shots.map(shot => shot.id);
  const beatDefs: Array<Omit<ProductionStoryBeat, 'shotIds'>> = [
    {
      id: 'setup',
      label: '开场处境',
      purpose: `交代${subject}、${location}和短剧的现实压力`,
      emotion: emotion,
      visualGoal: `用清晰环境和人物状态建立${atmosphere}基调`,
    },
    {
      id: 'inciting',
      label: '触发事件',
      purpose: `让${subject}遇到迫使其行动的异常线索`,
      emotion: '警觉、被迫行动',
      visualGoal: '突出关键线索或道具，让观众知道故事开始转向',
    },
    {
      id: 'conflict',
      label: '冲突升级',
      purpose: `展示阻碍如何压迫${desire}`,
      emotion: '紧张、犹豫、抗争',
      visualGoal: '用更近的景别、环境阻隔或反应镜头放大冲突',
    },
    {
      id: 'turning',
      label: '中段转折',
      purpose: `让${subject}做出改变结局的关键选择`,
      emotion: '决断、反转、释然前的紧绷',
      visualGoal: '用动作或视线转移标记选择已经发生',
    },
    {
      id: 'resolution',
      label: '结尾钩子',
      purpose: '给出可理解结果，同时保留下一场戏的悬念',
      emotion: '余韵、悬念、完成感',
      visualGoal: '保留一个能被观众记住的最后画面或物件状态',
    },
  ];

  const beats = assignStoryBeatShots(shotIds, beatDefs);

  if (beats.length > 0 && beats[beats.length - 1].id !== 'resolution') {
    beats[beats.length - 1] = {
      ...beats[beats.length - 1],
      id: 'resolution',
      label: '结尾钩子',
      purpose: '给出可理解结果，同时保留下一场戏的悬念',
      emotion: '余韵、悬念、完成感',
      visualGoal: '保留一个能被观众记住的最后画面或物件状态',
    };
  }

  return {
    premise: `${params.prompt.slice(0, 140)}${params.prompt.length > 140 ? '...' : ''}`,
    protagonist: subject,
    desire,
    obstacle,
    relationship: `${subject}与${location}${objectNames.length > 0 ? `、${objectNames.slice(0, 2).join('、')}` : ''}之间形成短剧的行动关系`,
    conflict: `${desire}，但${obstacle}`,
    turningPoint: `${subject}不再被动观察，而是主动用${objectNames[0] || '关键线索'}改写局面`,
    endingHook: `最后一个镜头必须让观众看到${subject}的选择留下了新的后果`,
    emotionalArc: {
      start: emotion,
      shift: '从困惑或压迫转向主动判断',
      end: '带着代价的完成感与悬念',
    },
    continuityRules: [
      `主角始终保持为${subject}，不要在片段间替换身份或外观核心特征`,
      `主要场景连续保持为${location}，除非镜头明确是回忆或插入画面`,
      objectNames.length > 0
        ? `关键物件${objectNames.slice(0, 3).join('、')}在出现后要保持形态和位置逻辑`
        : '关键线索出现后要保持形态和位置逻辑',
      '每个镜头都必须服务当前 storyBeat，避免只展示无剧情意义的炫技画面',
      '字幕、旁白和镜头动作必须共同推进冲突、转折或结尾钩子',
    ],
    beats,
  };
}

function findBeatForShot(storyBible: ProductionStoryBible, shotId: string) {
  return storyBible.beats.find(beat => beat.shotIds.includes(shotId)) || storyBible.beats[storyBible.beats.length - 1];
}

function buildSemanticPlan(params: BuildProductionProjectParams, context: {
  projectId: string;
  subject: string;
  location: string;
  atmosphere: string;
  objectNames: string[];
  storyBible: ProductionStoryBible;
  characterAssetIds: string[];
  sceneAssetIds: string[];
  storyboardAssetId: string;
  deliverableAssetId: string;
}): ProductionSemanticPlan {
  const now = new Date().toISOString();
  const writer = new WriterAgent();
  const director = new DirectorAgent();
  const writerOutput = writer.generateStoryOutline(params.prompt, 'short_drama', {
    duration: params.duration,
    characters: [{ name: context.subject, role: 'protagonist' }],
  });

  writerOutput.outline = context.storyBible.premise;
  writerOutput.characterProfiles[context.subject] = {
    id: 'char-1',
    name: context.subject,
    appearance: `${context.subject}，${params.style}，需要在所有镜头中保持同一外观锚点`,
    personality: context.storyBible.emotionalArc.start,
    motivation: context.storyBible.desire,
    arc: `${context.storyBible.emotionalArc.start} -> ${context.storyBible.emotionalArc.shift} -> ${context.storyBible.emotionalArc.end}`,
    relationships: {
      [context.location]: context.storyBible.relationship,
    },
  };
  writerOutput.narrative = writerOutput.narrative.map((segment, index) => {
    const shot = params.shots[index] || params.shots[params.shots.length - 1];
    const beat = context.storyBible.beats[index] || context.storyBible.beats[context.storyBible.beats.length - 1];
    return {
      ...segment,
      text: shot?.narrationText || shot?.subtitleText || beat?.purpose || context.storyBible.conflict,
      subject: context.subject,
      setting: context.location,
      style: params.style,
      characterIds: ['char-1'],
      assetRefs: [
        ...context.characterAssetIds,
        ...context.sceneAssetIds,
        ...context.objectNames.map((_, propIndex) => `prop-${propIndex + 1}`),
      ],
    };
  });

  const directorOutput = director.directStoryboard(writerOutput.narrative, {
    contentType: 'short_drama',
    aspectRatio: params.ratio,
    targetDuration: params.duration,
  });
  directorOutput.shots = params.shots.map((sourceShot, index) => {
    const shot = directorOutput.shots[index] || directorOutput.shots[directorOutput.shots.length - 1];
    const beat = sourceShot ? findBeatForShot(context.storyBible, sourceShot.id) : undefined;
    return {
      ...shot,
      shotId: sourceShot?.id || shot.shotId,
      visualPrompt: sourceShot?.prompt || shot.visualPrompt,
      duration: sourceShot?.duration || shot.duration,
      subject: context.subject,
      environment: context.location,
      style: params.style,
      audioContent: sourceShot?.narrationText || sourceShot?.subtitleText || shot.audioContent,
      characterRefs: ['char-1'],
      assetLibraryRefs: [
        ...context.characterAssetIds,
        ...context.sceneAssetIds,
        ...context.objectNames.map((_, propIndex) => `prop-${propIndex + 1}`),
      ],
      sceneRefs: ['scene-1'],
      emotionTag: shot?.emotionTag || 'tension',
      pacing: shot?.pacing || 'medium',
      cameraDetail: `${shot.cameraDetail}；服务剧情节点：${beat?.label || '剧情推进'}`,
    };
  });
  directorOutput.totalDuration = directorOutput.shots.reduce((sum, shot) => sum + shot.duration, 0);

  const characterBibles: ProductionSemanticPlan['characterBibles'] = [{
    id: 'character-bible-1',
    projectId: context.projectId,
    characterId: 'char-1',
    name: context.subject,
    role: 'protagonist',
    aliases: [context.subject],
    age: '未指定',
    era: '当代',
    version: 1,
    appearance: {
      faceShape: '待由参考图确认',
      skinTone: '待由参考图确认',
      eyeShape: '待由参考图确认',
      eyebrowStyle: '待由参考图确认',
      noseShape: '待由参考图确认',
      lipShape: '待由参考图确认',
      distinguishingFeatures: [`${context.subject}的身份和情绪状态必须连续`],
      height: '未指定',
      build: '未指定',
    },
    personality: {
      coreTraits: [context.storyBible.emotionalArc.start, context.storyBible.emotionalArc.shift],
      strength: '能在压力中做出选择',
      flaw: '被当前困境牵制',
      desire: context.storyBible.desire,
      fear: context.storyBible.obstacle,
      voiceStyle: '短剧化、克制、推动冲突',
      catchphrase: '',
    },
    arc: {
      arcType: 'growth',
      startingState: context.storyBible.emotionalArc.start,
      turningPoint: context.storyBible.turningPoint,
      endingState: context.storyBible.emotionalArc.end,
    },
    relationships: [],
    referenceImages: [],
    colorPalette: [],
    createdAt: now,
    updatedAt: now,
  }];

  const sceneBibles: ProductionSemanticPlan['sceneBibles'] = [{
    id: 'scene-bible-1',
    projectId: context.projectId,
    name: context.location,
    location: context.location,
    era: '当代',
    type: 'mixed',
    version: 1,
    spatial: {
      layout: `${context.location}的空间布局必须在跨镜头中保持一致`,
      keyElements: context.objectNames.length > 0 ? context.objectNames : ['关键线索', '主体行动区域'],
      dominantColors: [],
      materials: [],
      architectural: params.sceneType,
    },
    lighting: {
      defaultTime: compactText(params.entities.timeOfDay, '未指定'),
      defaultLight: context.atmosphere,
      moodLighting: params.style,
      keyLightDirection: '跟随镜头情绪变化，但保持空间方向逻辑',
      shadowPattern: '避免跨镜头光影突变',
    },
    atmosphere: {
      mood: context.atmosphere,
      weather: '未指定',
      season: '未指定',
      soundDesign: params.narrationSuggestion?.script || '',
      colorGrading: params.style,
    },
    props: context.objectNames.map((objectName, index) => ({
      name: objectName,
      description: `推动剧情的关键物件：${objectName}`,
      placement: index === 0 ? '首个出现镜头必须清楚交代位置' : '出现后保持空间逻辑',
      significance: index === 0 ? 'critical' : 'important',
    })),
    referenceImages: [],
    colorPalette: [],
    continuity: {
      rules: context.storyBible.continuityRules,
      commonMistakes: ['角色外观突变', '关键道具消失', '场景方向错乱', '镜头只炫技不推进剧情'],
    },
    createdAt: now,
    updatedAt: now,
  }];

  const shotItems: ShotListItem[] = params.shots.map((shot, index) => {
    const nextShot = params.shots[index + 1];
    const prevShot = params.shots[index - 1];
    const directorShot = directorOutput.shots[index];
    return {
      shotId: shot.id,
      sequence: index + 1,
      sceneId: 'scene-bible-1',
      sceneName: context.location,
      shotType: directorShot?.shotType || 'MS',
      cameraMovement: directorShot?.cameraMovement || 'static',
      duration: shot.duration,
      description: shot.prompt,
      subject: context.subject,
      characterIds: ['char-1'],
      action: compactText(params.entities.action, shot.prompt),
      dialogue: shot.subtitleText || shot.narrationText || '',
      emotion: directorShot?.emotionTag || 'tension',
      visualPrompt: shot.prompt,
      modelPreference: 'BYOK video model',
      aspectRatio: params.ratio,
      status: 'planned',
      reviewNotes: [],
      version: 1,
      continuityNotes: `${context.storyBible.continuityRules.slice(0, 2).join('；')}`,
      previousShotId: prevShot?.id,
      nextShotId: nextShot?.id,
    };
  });

  const shotList: ShotList = {
    id: `${context.projectId}-shot-list`,
    projectId: context.projectId,
    scenes: [{
      sceneId: 'scene-bible-1',
      sceneName: context.location,
      shots: shotItems,
    }],
  };

  const videoNodes: DAGNode[] = shotItems.map(item => ({
    nodeId: `n_video_${item.shotId}`,
    name: `视频片段-${item.sequence}`,
    agent: 'video_agent',
    dependencies: ['n_storyboard', 'n_character_bible', 'n_scene_bible'],
    parallelGroup: 'video_segments',
    status: 'pending',
    result: {
      shotId: item.shotId,
      expectedDuration: item.duration,
      characterIds: item.characterIds,
      sceneId: item.sceneId,
    },
  }));

  return {
    version: 'yh-production-semantic-plan-v1',
    source: 'video-production-v3-merged',
    reference: {
      primary: 'ViMax',
      secondary: ['Toonflow-app', 'ArcReel'],
      adaptedIdeas: [
        '把旧版 video-production 的编剧、导演、角色圣经、场景圣经和 DAG 类型合入当前 ProductionProject',
        '参考 ViMax 的 artifact-first pipeline，让故事、角色、场景、分镜先成为可审计产物',
        '参考 Toonflow-app 的项目资产工作台，让语义资产后续可映射为画布节点',
        '参考 ArcReel 的任务队列，把每个镜头转成可执行、可恢复的视频片段节点',
      ],
    },
    writerOutput,
    directorOutput,
    characterBibles,
    sceneBibles,
    shotList,
    dag: {
      nodes: [
        { nodeId: 'n_script', name: '剧本结构', agent: 'writer_agent', dependencies: [], status: 'completed' },
        { nodeId: 'n_character_bible', name: '角色圣经', agent: 'continuity_agent', dependencies: ['n_script'], status: 'completed' },
        { nodeId: 'n_scene_bible', name: '场景圣经', agent: 'continuity_agent', dependencies: ['n_script'], status: 'completed' },
        { nodeId: 'n_storyboard', name: '分镜表', agent: 'director_agent', dependencies: ['n_character_bible', 'n_scene_bible'], status: 'completed' },
        ...videoNodes,
        {
          nodeId: 'n_assembly',
          name: '片段合成/导出',
          agent: 'assembly_agent',
          dependencies: videoNodes.map(node => node.nodeId),
          status: 'pending',
        },
      ],
    },
    assetLinks: {
      characterAssetIds: context.characterAssetIds,
      sceneAssetIds: context.sceneAssetIds,
      storyboardAssetId: context.storyboardAssetId,
      deliverableAssetId: context.deliverableAssetId,
    },
  };
}

export function buildProductionProject(params: BuildProductionProjectParams): ProductionProject {
  const projectId = `production-${params.taskId}`;
  const subject = normalizeSubject(compactText(params.entities.subject, '短剧主角'), params.prompt);
  const location = normalizeLocation(compactText(params.entities.location, '核心场景'), params.prompt);
  const atmosphere = compactText(params.entities.atmosphere, params.style);
  const objectNames = enrichObjectNames(uniqueValues(params.entities.objects.length > 0
    ? params.entities.objects
    : params.visualAnchors
      .filter(anchor => ['object', 'material'].includes(anchor.category))
      .map(anchor => anchor.element)), params.prompt);
  const storyBible = buildStoryBible(params, subject, location, atmosphere, objectNames);
  const storyShots = params.shots.map((shot, index) => {
    const fiveDynastiesAudio = storyBible.protagonist.includes('山河图接力者')
      ? buildFiveDynastiesShotAudio(index)
      : null;
    return {
      ...shot,
      prompt: buildStoryDrivenShotPrompt(shot, {
      subject,
      location,
      objectNames,
      storyBible,
      }, index),
      subtitleText: fiveDynastiesAudio?.dialogue || shot.subtitleText,
      narrationText: fiveDynastiesAudio?.narration || shot.narrationText,
    };
  });
  const storyParams = {
    ...params,
    shots: storyShots,
  };

  const scriptAsset: ProductionAsset = {
    id: buildAssetId('script', 0),
    kind: 'script',
    name: '创意剧本',
    status: 'ready',
    summary: storyBible.conflict,
    source: 'prompt',
    metadata: { storyBible },
  };

  const characterAssets: ProductionAsset[] = [
    {
      id: buildAssetId('character', 0),
      kind: 'character',
      name: subject,
      status: 'planned',
      summary: `${subject} · ${compactText(params.entities.emotion, atmosphere)}`,
      source: 'prompt',
      relatedShotIds: storyShots.map(shot => shot.id),
      metadata: { action: params.entities.action, timeOfDay: params.entities.timeOfDay },
    },
  ];

  const sceneAssets: ProductionAsset[] = [
    {
      id: buildAssetId('scene', 0),
      kind: 'scene',
      name: location,
      status: 'planned',
      summary: `${location} · ${atmosphere}`,
      source: 'prompt',
      relatedShotIds: storyShots.map(shot => shot.id),
      metadata: { sceneType: params.sceneType, ratio: params.ratio },
    },
  ];

  const propAssets: ProductionAsset[] = objectNames.slice(0, 6).map((objectName, index) => ({
    id: buildAssetId('prop', index),
    kind: 'prop',
    name: objectName,
    status: 'planned',
    summary: `跨镜头保持一致的关键物件：${objectName}`,
    source: 'prompt',
    relatedShotIds: storyShots.map(shot => shot.id),
  }));

  const storyboardAsset: ProductionAsset = {
    id: buildAssetId('storyboard', 0),
    kind: 'storyboard',
    name: `${storyShots.length} 个镜头计划`,
    status: 'ready',
    summary: params.narrativeSummary,
    source: 'storyboard',
    relatedShotIds: storyShots.map(shot => shot.id),
  };

  const taskAsset: ProductionAsset = {
    id: buildAssetId('task', 0),
    kind: 'task',
    name: '任务中心记录',
    status: 'completed',
    summary: `已写入任务 ${params.taskId}`,
    source: 'task',
    metadata: { taskId: params.taskId },
  };

  const deliverableAsset: ProductionAsset = {
    id: buildAssetId('deliverable', 0),
    kind: 'deliverable',
    name: '成片/导出',
    status: 'pending',
    summary: '等待真实视频生成、分段合成和导出',
    source: 'system',
  };

  const assets = [
    scriptAsset,
    ...characterAssets,
    ...sceneAssets,
    ...propAssets,
    storyboardAsset,
    taskAsset,
    deliverableAsset,
  ];

  const semanticPlan = buildSemanticPlan(storyParams, {
    projectId,
    subject,
    location,
    atmosphere,
    objectNames,
    storyBible,
    characterAssetIds: characterAssets.map(asset => asset.id),
    sceneAssetIds: sceneAssets.map(asset => asset.id),
    storyboardAssetId: storyboardAsset.id,
    deliverableAssetId: deliverableAsset.id,
  });

  const assetIdsByKind = (kind: ProductionAssetKind) => assets
    .filter(asset => asset.kind === kind)
    .map(asset => asset.id);

  const stages: ProductionStage[] = [
    {
      id: 'script',
      name: '创意/剧本',
      status: 'ready',
      summary: scriptAsset.summary,
      assetIds: [scriptAsset.id],
    },
    {
      id: 'assets',
      name: '角色/场景/道具',
      status: 'planned',
      summary: `角色 ${characterAssets.length} 个，场景 ${sceneAssets.length} 个，道具 ${propAssets.length} 个`,
      assetIds: [...assetIdsByKind('character'), ...assetIdsByKind('scene'), ...assetIdsByKind('prop')],
    },
    {
      id: 'storyboard',
      name: '分镜/镜头',
      status: 'ready',
      summary: `生成 ${storyShots.length} 个镜头，计划 ${params.duration} 秒`,
      assetIds: [storyboardAsset.id],
    },
    {
      id: 'task',
      name: '任务中心',
      status: 'completed',
      summary: `任务 ${params.taskId} 可回看`,
      assetIds: [taskAsset.id],
    },
    {
      id: 'assembly',
      name: '片段合成',
      status: 'pending',
      summary: '等待进入视频生成、片段持久化和合成',
      assetIds: [deliverableAsset.id],
    },
    {
      id: 'delivery',
      name: '成片/导出',
      status: 'pending',
      summary: '等待生成最终成片并进入导出',
      assetIds: [deliverableAsset.id],
    },
  ];

  const edges: ProductionGraphEdge[] = [
    { from: scriptAsset.id, to: characterAssets[0].id, relation: 'creates' },
    { from: scriptAsset.id, to: sceneAssets[0].id, relation: 'creates' },
    { from: characterAssets[0].id, to: storyboardAsset.id, relation: 'references' },
    { from: sceneAssets[0].id, to: storyboardAsset.id, relation: 'references' },
    { from: storyboardAsset.id, to: taskAsset.id, relation: 'feeds' },
    { from: taskAsset.id, to: deliverableAsset.id, relation: 'tracks' },
  ];

  for (const prop of propAssets) {
    edges.push({ from: prop.id, to: storyboardAsset.id, relation: 'references' });
  }

  const storyboardShots = storyShots.map((shot, index) => ({
    ...(() => {
      const beat = findBeatForShot(storyBible, shot.id);
      return {
        id: shot.id,
        index: index + 1,
        duration: shot.duration,
        phase: shot.phase,
        phaseLabel: shot.phaseLabel,
        shotType: shot.shotType,
        shotTypeLabel: shot.shotTypeLabel,
        storyBeat: beat.id,
        dramaticPurpose: beat.purpose,
        emotionShift: beat.emotion,
        prompt: shot.prompt,
        subtitleText: shot.subtitleText,
        narrationText: shot.narrationText,
        status: shot.status || 'planned',
      };
    })(),
  }));

  const project: ProductionProject = {
    id: projectId,
    title: params.prompt.slice(0, 24) || '未命名短片',
    prompt: params.prompt,
    style: params.style,
    ratio: params.ratio,
    sceneType: params.sceneType,
    duration: params.duration,
    segmentDuration: params.segmentDuration,
    narrativeSummary: params.narrativeSummary,
    storyBible,
    semanticPlan,
    assets,
    stages,
    graph: {
      nodes: assets.map(asset => ({
        id: asset.id,
        kind: asset.kind,
        name: asset.name,
        status: asset.status,
      })),
      edges,
    },
    storyboard: {
      shotCount: storyboardShots.length,
      totalDuration: storyboardShots.reduce((sum, shot) => sum + shot.duration, 0),
      shots: storyboardShots,
    },
    output: {
      status: 'pending',
      taskId: params.taskId,
      canProceedToVideo: false,
      nextStep: '确认角色、场景和分镜资产后，再进入视频片段生成与合成',
    },
    suggestions: {
      subtitle: params.subtitleSuggestion,
      narration: params.narrationSuggestion,
    },
  };

  project.storyBible.trailerBeatSheet = buildTrailerBeatSheet(project);
  return project;
}
