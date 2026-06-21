import type { ProductionAssemblyPlan } from './production-assembly-plan';
import type { ProductionProject } from './production-project';

export interface StoryReadabilityIssue {
  code: string;
  severity: 'blocker' | 'warning';
  message: string;
}

export interface StoryReadabilityScore {
  version: 'yh-story-readability-v1';
  score: number;
  pass: boolean;
  threshold: number;
  checks: {
    hasHumanProtagonist: boolean;
    hasVisibleGoal: boolean;
    hasVisibleDanger: boolean;
    hasVisibleAction: boolean;
    hasVisibleResult: boolean;
    hasSceneAnchor: boolean;
    hasPropAnchor: boolean;
    hasBridgeMarkers: boolean;
    hasReadableSegmentPurpose: boolean;
  };
  issues: StoryReadabilityIssue[];
  nextActions: string[];
}

interface ScoreParams {
  productionProject: ProductionProject;
  assemblyPlan?: ProductionAssemblyPlan | null;
  threshold?: number;
}

const OBJECT_ONLY_PROTAGONIST = /(书包|胶片|列车|旧桥|按钮|电梯|档案袋|屏幕|警报|录像带|报表|方案|核心|装置)$/;
const HUMAN_ROLE = /(急救员|审计师|剪辑师|品牌经理|市场经理|投放经理|运营负责人|经理|负责人|创意总监|总监|导演|编剧|制片人|制片|摄影师|店员|学生|医生|记者|侦探|演员|调律者|漂泊旅人|机甲少女|救援员|修复师|守夜人|研究员|工程师|战士|法师|旅人|少女|少年|女孩|男孩|女人|男人|主角|人物)/;
const GOAL_WORDS = /(想要|必须|需要|试图|目标|救下|公开|带出|阻止|改写|完成|找到|交付|逃离)/;
const DANGER_WORDS = /(危险|危机|威胁|失败|倒计时|坍塌|追赶|封锁|断电|报警|失控|黑洞|压力|阻碍|冲突)/;
const ACTION_WORDS = /(冲|跑|追|按|拿|捡|贴|推|跳|藏|调换|重剪|倒带|制动|查看|触碰|移动|打开|关上|交付|公开)/;
const RESULT_WORDS = /(结果|后果|改变|改写|停下|救下|公开|真相|悬念|结局|新状态|反应|落地)/;
const SCENE_WORDS = /(车站|电梯|办公室|便利店|剪辑室|剧院|地铁站|街道|仓库|学校|医院|公寓|天台|走廊|桥|列车|会议室|中控台)/;
const PROP_WORDS = /(书包|档案袋|对讲机|按钮|警报屏|录像带|报表|屏幕|钥匙|信件|手机|文件|列车|电梯|旧桥)/;
const BRIDGE_MARKERS = ['【入点状态】', '【出点状态】', '【桥接动作】', '【剪辑衔接】'];

function pushIssue(issues: StoryReadabilityIssue[], condition: boolean, issue: StoryReadabilityIssue) {
  if (!condition) issues.push(issue);
}

function storyText(project: ProductionProject, assemblyPlan?: ProductionAssemblyPlan | null) {
  return [
    project.storyBible.premise,
    project.storyBible.protagonist,
    project.storyBible.desire,
    project.storyBible.obstacle,
    project.storyBible.conflict,
    project.storyBible.turningPoint,
    project.storyBible.endingHook,
    project.storyboard.shots.map(shot => [shot.dramaticPurpose, shot.prompt, shot.emotionShift].join(' ')).join(' '),
    assemblyPlan?.segments.map(segment => segment.prompt).join(' ') || '',
    project.assets.map(asset => `${asset.kind}:${asset.name}:${asset.summary}`).join(' '),
  ].join('\n');
}

export function evaluateStoryReadability(params: ScoreParams): StoryReadabilityScore {
  const { productionProject, assemblyPlan = null, threshold = 80 } = params;
  const text = storyText(productionProject, assemblyPlan);
  const protagonist = productionProject.storyBible.protagonist || '';
  const segments = assemblyPlan?.segments || [];
  const segmentPrompts = segments.map(segment => segment.prompt);

  const checks = {
    hasHumanProtagonist: HUMAN_ROLE.test(protagonist) && !OBJECT_ONLY_PROTAGONIST.test(protagonist),
    hasVisibleGoal: GOAL_WORDS.test(text),
    hasVisibleDanger: DANGER_WORDS.test(text),
    hasVisibleAction: ACTION_WORDS.test(text),
    hasVisibleResult: RESULT_WORDS.test(text),
    hasSceneAnchor: SCENE_WORDS.test(text) || productionProject.assets.some(asset => asset.kind === 'scene' && asset.name.length > 1),
    hasPropAnchor: PROP_WORDS.test(text) || productionProject.assets.some(asset => asset.kind === 'prop' && asset.name.length > 1),
    hasBridgeMarkers: segments.length === 0 || segmentPrompts.every(prompt => BRIDGE_MARKERS.every(marker => prompt.includes(marker))),
    hasReadableSegmentPurpose: productionProject.storyboard.shots.every(shot =>
      shot.dramaticPurpose.length >= 8
      && ACTION_WORDS.test(`${shot.dramaticPurpose} ${shot.prompt}`)
      && !/(无意义|纯氛围|抽象空镜)/.test(shot.dramaticPurpose)
    ),
  };

  const issues: StoryReadabilityIssue[] = [];
  pushIssue(issues, checks.hasHumanProtagonist, {
    code: 'human-protagonist-missing',
    severity: 'blocker',
    message: `主角不可读或被道具误抽取：${protagonist || '空'}`,
  });
  pushIssue(issues, checks.hasVisibleGoal, {
    code: 'visible-goal-missing',
    severity: 'blocker',
    message: '缺少画面可表达的主角目标，例如救下、阻止、公开、逃离或改写。',
  });
  pushIssue(issues, checks.hasVisibleDanger, {
    code: 'visible-danger-missing',
    severity: 'blocker',
    message: '缺少画面可表达的危险或赌注，观众难以理解为什么必须行动。',
  });
  pushIssue(issues, checks.hasVisibleAction, {
    code: 'visible-action-missing',
    severity: 'blocker',
    message: '缺少清楚的身体动作或道具操作，容易退化为站立凝视。',
  });
  pushIssue(issues, checks.hasVisibleResult, {
    code: 'visible-result-missing',
    severity: 'warning',
    message: '缺少动作带来的结果或悬念状态，结尾可能看不懂。',
  });
  pushIssue(issues, checks.hasSceneAnchor, {
    code: 'scene-anchor-missing',
    severity: 'warning',
    message: '缺少稳定场景锚点，分段生成时容易换景。',
  });
  pushIssue(issues, checks.hasPropAnchor, {
    code: 'prop-anchor-missing',
    severity: 'warning',
    message: '缺少可见关键道具，故事因果难以落到画面。',
  });
  pushIssue(issues, checks.hasBridgeMarkers, {
    code: 'segment-bridge-missing',
    severity: 'blocker',
    message: '分段 prompt 缺少入点/出点/桥接动作/剪辑衔接，段落容易硬切。',
  });
  pushIssue(issues, checks.hasReadableSegmentPurpose, {
    code: 'segment-purpose-weak',
    severity: 'warning',
    message: '部分分镜缺少明确动作目的，真实视频可能只连续但不讲故事。',
  });

  const weights: Record<keyof StoryReadabilityScore['checks'], number> = {
    hasHumanProtagonist: 15,
    hasVisibleGoal: 15,
    hasVisibleDanger: 15,
    hasVisibleAction: 15,
    hasVisibleResult: 10,
    hasSceneAnchor: 8,
    hasPropAnchor: 8,
    hasBridgeMarkers: 8,
    hasReadableSegmentPurpose: 6,
  };
  const score = Math.round(
    (Object.entries(checks) as Array<[keyof StoryReadabilityScore['checks'], boolean]>)
      .reduce((sum, [key, passed]) => sum + (passed ? weights[key] : 0), 0)
  );
  const hasBlocker = issues.some(issue => issue.severity === 'blocker');

  return {
    version: 'yh-story-readability-v1',
    score,
    pass: score >= threshold && !hasBlocker,
    threshold,
    checks,
    issues,
    nextActions: issues.length === 0
      ? ['可以进入真实视频生成；复盘重点转向镜头表现和剪辑节奏。']
      : issues.map(issue => issue.message),
  };
}
