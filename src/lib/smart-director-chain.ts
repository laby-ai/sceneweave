import type { ProductionProject } from './production-project';
import type {
  PromptBasedShot,
  UserInputEntities,
} from './storyboard-generator';

export type DirectorChainRole = 'director' | 'screenwriter' | 'producer' | 'cinematographer';

export interface DirectorChainAgent {
  role: DirectorChainRole;
  title: string;
  objective: string;
  decisions: string[];
  output: Record<string, unknown>;
}

export interface DirectorChainResult {
  version: 'yh-director-chain-v1';
  reference: {
    primary: 'ViMAX';
    adaptedIdeas: string[];
  };
  prompt: string;
  duration: number;
  segmentDuration: number;
  style: string;
  agents: DirectorChainAgent[];
  handoff: {
    productionProjectId: string;
    taskId: string;
    readyAssetKinds: string[];
    nextRoute: '/film';
    nextAction: string;
  };
  qualityGates: string[];
}

interface BuildDirectorChainParams {
  taskId: string;
  prompt: string;
  duration: number;
  segmentDuration: number;
  style: string;
  sceneType: string;
  ratio: string;
  entities: UserInputEntities;
  visualAnchors: Array<{ element: string; category: string }>;
  narrativeSummary: string;
  shots: PromptBasedShot[];
  productionProject: ProductionProject;
}

function textOr(value: string | undefined, fallback: string) {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
}

function listOr(values: string[] | undefined, fallback: string[]) {
  const unique = Array.from(new Set((values || []).map(value => value.trim()).filter(Boolean)));
  return unique.length > 0 ? unique : fallback;
}

function sampleShots(shots: PromptBasedShot[], count: number) {
  return shots.slice(0, count).map((shot, index) => ({
    index: index + 1,
    duration: shot.duration,
    phase: shot.phaseLabel,
    shotType: shot.shotTypeLabel,
    prompt: shot.prompt,
    subtitleText: shot.subtitleText,
    narrationText: shot.narrationText,
  }));
}

export function buildSmartDirectorChain(params: BuildDirectorChainParams): DirectorChainResult {
  const subject = textOr(params.entities.subject, '核心角色');
  const location = textOr(params.entities.location, '主要场景');
  const action = textOr(params.entities.action, '完成关键选择');
  const emotion = textOr(params.entities.emotion, params.style);
  const objects = listOr(params.entities.objects, params.visualAnchors.slice(0, 4).map(anchor => anchor.element));
  const phases = Array.from(new Set(params.shots.map(shot => shot.phaseLabel).filter(Boolean)));
  const shotTypes = Array.from(new Set(params.shots.map(shot => shot.shotTypeLabel).filter(Boolean)));
  const storyBible = params.productionProject.storyBible;
  const beatSummary = storyBible.beats.map(beat => `${beat.label}:${beat.purpose}`).join(' / ');
  const trailerBeatSheet = storyBible.trailerBeatSheet;

  const agents: DirectorChainAgent[] = [
    {
      role: 'director',
      title: '导演',
      objective: '把创意收束成有角色目标、冲突、转折和结尾钩子的短剧方向',
      decisions: [
        `短剧前提：${storyBible.premise}`,
        `主角目标：${storyBible.desire}`,
        `核心冲突：${storyBible.conflict}`,
        `情绪弧线：${storyBible.emotionalArc.start} -> ${storyBible.emotionalArc.shift} -> ${storyBible.emotionalArc.end}`,
      ],
      output: {
        storyShape: phases,
        storyBible,
        trailerBeatSheet,
        totalDuration: params.duration,
        ratio: params.ratio,
        projectStageIds: params.productionProject.stages.map(stage => stage.id),
      },
    },
    {
      role: 'screenwriter',
      title: '编剧',
      objective: '把短剧拆成每个镜头都有剧情目的的分镜段落、字幕和旁白线索',
      decisions: [
        `动作线：${action}`,
        `剧情节点：${beatSummary}`,
        `中段转折：${storyBible.turningPoint}`,
        `结尾钩子：${storyBible.endingHook}`,
        `分镜数量：${params.shots.length} 个`,
        `单段上限：${params.segmentDuration} 秒，便于后续分段生成和失败恢复`,
      ],
      output: {
        shotCount: params.shots.length,
        beats: storyBible.beats,
        trailerBeats: trailerBeatSheet?.beats || [],
        sampleShots: sampleShots(params.shots, 3),
      },
    },
    {
      role: 'producer',
      title: '制片',
      objective: '把角色、场景、道具和任务变成可追踪资产，降低生成和返工成本',
      decisions: [
        `资产总数：${params.productionProject.assets.length} 个`,
        `关键道具/视觉锚点：${objects.slice(0, 6).join('、') || '待补充'}`,
        `连续性规则：${storyBible.continuityRules.slice(0, 3).join('；')}`,
        '当前为 dry-run 规划，不调用真实模型，不产生费用',
        '下一步应先确认角色/场景资产，再进入视频片段生成',
      ],
      output: {
        assetKinds: params.productionProject.assets.map(asset => asset.kind),
        riskControls: ['BYOK 前不触发计费生成', '片段生成后必须持久化 URL', '合成失败不得伪成功'],
      },
    },
    {
      role: 'cinematographer',
      title: '镜头设计',
      objective: '把每个剧情节点转成镜头类型、运镜节奏和可执行视频生成提示',
      decisions: [
        `镜头语言：${shotTypes.slice(0, 6).join('、') || '按剧情节奏推进'}`,
        `总时长计划：${params.productionProject.storyboard.totalDuration} 秒`,
        '每个镜头都必须绑定 storyBeat、dramaticPurpose、emotionShift，便于进入画布或视频任务复用',
      ],
      output: {
        shotTypes,
        storyboard: params.productionProject.storyboard,
      },
    },
  ];

  return {
    version: 'yh-director-chain-v1',
    reference: {
      primary: 'ViMAX',
      adaptedIdeas: [
        '把单一助手拆成导演、编剧、制片、镜头设计协作链',
        '每个 Agent 输出结构化中间产物，而不是只返回聊天文本',
        'Agent 结果必须交给项目资产和任务中心，供后续复用',
        '导演链围绕 storyBible 协作，避免视频片段变成无意义画面测试',
      ],
    },
    prompt: params.prompt,
    duration: params.duration,
    segmentDuration: params.segmentDuration,
    style: params.style,
    agents,
    handoff: {
      productionProjectId: params.productionProject.id,
      taskId: params.taskId,
      readyAssetKinds: Array.from(new Set(params.productionProject.assets.map(asset => asset.kind))),
      nextRoute: '/film',
      nextAction: '确认导演链路后，进入影视创作页细化角色、场景和分镜，再触发视频片段任务。',
    },
    qualityGates: [
      '不调用真实模型时必须标记 usedRealKey=false',
      '任务中心必须能回看 directorChain 与 productionProject',
      '每个镜头必须绑定 storyBeat、dramaticPurpose 和 emotionShift',
      '预告片必须先通过 trailerBeatSheet，具备冷开场、主角目标、冲突升级、高光和结尾悬念',
      '进入真实视频前必须确认 BYOK、任务轮询和片段持久化',
    ],
  };
}
