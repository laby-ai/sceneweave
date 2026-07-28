import assert from 'node:assert/strict';
import { buildProductionBackedVimaxPlan } from '../src/lib/skills/vimax-short-drama/vimax-plan-artifacts';
import type { VimaxAgentPlan } from '../src/lib/skills/vimax-short-drama/vimax-agent-contract';

const plan: VimaxAgentPlan = {
  title: '雨夜胶片',
  summary: '主角在雨夜天台发现发光胶片，并把它插入旧放映机看见童年影像。',
  story: {
    premise: '一枚胶片迫使主角面对被遗忘的童年。',
    protagonist: '林岚',
    desire: '确认胶片中的人是谁',
    obstacle: '暴雨和即将停电的放映机',
    conflict: '她必须在停电前决定是否播放胶片',
    turningPoint: '她主动把胶片插入放映机',
    endingHook: '画面中出现另一个成年后的自己',
    emotionalArc: { start: '戒备', shift: '决断', end: '震惊' },
  },
  assets: [
    {
      kind: 'character',
      label: '蓝色外套的年轻女性',
      prompt: '湿发，深蓝色防水外套，右手掌心托着发光胶片。',
    },
    {
      kind: 'scene',
      label: '雨夜城市天台',
      prompt: '积水反射霓虹，旧放映机位于天台东侧。',
    },
  ],
  shots: [
    {
      index: 1,
      title: '发现胶片',
      duration: 5,
      camera: '雨夜全景缓慢推近至中景',
      prompt: '主角站在天台右侧，右手掌心托着发光胶片，抬头看向闪烁广告牌。',
      actionStart: '林岚站在天台右侧',
      actionEnd: '林岚右手胶片停在胸前',
      spatialRelation: 'new-scene',
      temporalRelation: 'time-jump',
      routeConfidence: 'high',
      continuityPriorities: ['subject', 'scene', 'prop', 'screen-direction'],
    },
    {
      index: 2,
      title: '放映童年',
      duration: 5,
      camera: '同轴中景切到胶片插入动作特写',
      prompt: '承接右手掌心的发光胶片，主角用左手把胶片插入旧放映机，墙面投出同一张童年照片。',
      actionStart: '林岚右手胶片停在胸前',
      actionEnd: '胶片进入放映机卡槽',
      spatialRelation: 'same-scene',
      temporalRelation: 'continuous',
      routeConfidence: 'high',
      continuityPriorities: ['action', 'prop', 'screen-direction', 'subject'],
    },
  ],
  nextAction: '确认两镜连续性后生成参考图。',
};

const built = buildProductionBackedVimaxPlan(plan.summary, plan, {
  prompt: plan.summary,
  duration: 10,
  segmentDuration: 5,
  segmentCount: 2,
  sceneType: 'drama',
  style: '电影感写实短剧',
  ratio: '16:9',
}, 'planner-preservation-fixture');

assert.equal(built.productionProject.narrativeSummary, plan.summary);
assert.equal(built.productionProject.storyBible.protagonist, '林岚');
assert.equal(built.productionProject.storyBible.turningPoint, '她主动把胶片插入放映机');
assert.equal(built.productionProject.storyboard.shots.length, 2);
assert.match(
  built.productionProject.storyboard.shots[0].prompt,
  /天台右侧.*右手掌心托着发光胶片.*闪烁广告牌/,
);
assert.match(
  built.productionProject.storyboard.shots[1].prompt,
  /承接右手掌心的发光胶片.*左手.*旧放映机.*同一张童年照片/,
);
assert.match(built.plan.shots[0].prompt, /天台右侧.*发光胶片/);
assert.match(built.plan.shots[1].prompt, /旧放映机.*同一张童年照片/);
assert.equal(built.plan.shots[0].description, plan.shots[0].prompt);
assert.equal(built.plan.shots[1].description, plan.shots[1].prompt);
assert.equal(built.plan.nextAction, plan.nextAction);
assert.equal(built.plan.shots[0].camera, plan.shots[0].camera);
assert.equal(built.plan.shots[1].camera, plan.shots[1].camera);
assert.equal(built.plan.shots[1].actionStart, '林岚右手胶片停在胸前');
assert.equal(built.plan.shots[1].temporalRelation, 'continuous');

console.log('vimax planner shot preservation: PASS');
