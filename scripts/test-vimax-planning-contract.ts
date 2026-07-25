import assert from 'node:assert/strict';

import { normalizeVimaxAgentPlan } from '../src/lib/skills/vimax-short-drama/vimax-plan-contract';

const richPlan = normalizeVimaxAgentPlan({
  title: '雨夜胶片',
  summary: '主角在雨夜天台发现一枚会播放记忆的胶片。',
  story: {
    premise: '一枚胶片迫使主角面对被遗忘的童年。',
    protagonist: '林岚',
    desire: '确认胶片中的人是谁',
    obstacle: '暴雨和即将停电的放映机',
    conflict: '她必须在停电前决定是否播放胶片',
    turningPoint: '她主动把胶片插入放映机',
    endingHook: '画面中出现另一个成年后的自己',
    emotionalArc: {
      start: '戒备',
      shift: '决断',
      end: '震惊',
    },
  },
  characters: [{
    id: 'character-linlan',
    label: '林岚',
    description: '二十多岁女性，深蓝防水外套，湿发。',
    continuityAnchors: ['深蓝防水外套', '湿发', '右手银色戒指'],
  }],
  scenes: [{
    id: 'scene-rooftop',
    label: '雨夜天台',
    description: '积水反射霓虹，东侧有旧放映机。',
    timeOfDay: '深夜',
    continuityAnchors: ['东侧旧放映机', '红色警示灯', '积水倒影'],
  }],
  props: [{
    id: 'prop-film',
    label: '发光胶片',
    description: '掌心大小，边缘发出冷蓝光。',
    state: '在林岚右手掌心',
  }],
  assets: [],
  shots: [
    {
      index: 1,
      title: '发现胶片',
      duration: 5,
      camera: '全景推至中景',
      prompt: '林岚在雨夜天台捡起发光胶片。',
      sceneId: 'scene-rooftop',
      characterIds: ['character-linlan'],
      propIds: ['prop-film'],
      actionStart: '林岚蹲在积水边',
      actionEnd: '林岚右手举起胶片',
      firstFrameDescription: '林岚蹲在画面左侧，旧放映机位于远处右侧。',
      lastFrameDescription: '林岚站起，右手胶片停在胸前。',
      motionDescription: '由蹲姿连续站起并举起右手。',
      dialogue: '',
      narration: '她终于找到了那枚胶片。',
      audioIntent: '雨声持续，胶片出现时加入轻微高频鸣响。',
      spatialRelation: 'new-scene',
      temporalRelation: 'time-jump',
      routeConfidence: 'high',
      conflictFlags: [],
      continuityPriorities: ['subject', 'scene', 'prop'],
    },
    {
      index: 2,
      title: '插入放映机',
      duration: 5,
      camera: '同轴近景',
      prompt: '林岚承接举起胶片的动作，走向旧放映机。',
      sceneId: 'scene-rooftop',
      characterIds: ['character-linlan'],
      propIds: ['prop-film'],
      actionStart: '林岚右手胶片停在胸前',
      actionEnd: '胶片进入放映机卡槽',
      firstFrameDescription: '严格承接上一镜最后姿态。',
      lastFrameDescription: '林岚左手扶住放映机，右手松开胶片。',
      motionDescription: '保持向右运动轴线，连续走两步并插入胶片。',
      dialogue: '让我看看你藏着什么。',
      narration: '',
      audioIntent: '雨声连续，插入时出现机械咔哒声。',
      spatialRelation: 'same-scene',
      temporalRelation: 'continuous',
      routeConfidence: 'high',
      conflictFlags: [],
      continuityPriorities: ['action', 'screen-direction', 'subject', 'prop'],
    },
  ],
  nextAction: '确认故事和镜头状态后生成参考图。',
});

assert.equal(richPlan.story?.turningPoint, '她主动把胶片插入放映机');
assert.deepEqual(richPlan.characters?.[0].continuityAnchors, ['深蓝防水外套', '湿发', '右手银色戒指']);
assert.equal(richPlan.scenes?.[0].timeOfDay, '深夜');
assert.equal(richPlan.props?.[0].state, '在林岚右手掌心');
assert.equal(richPlan.shots[1].actionStart, '林岚右手胶片停在胸前');
assert.equal(richPlan.shots[1].temporalRelation, 'continuous');
assert.equal(richPlan.shots[1].spatialRelation, 'same-scene');
assert.equal(richPlan.shots[1].routeConfidence, 'high');

assert.throws(() => normalizeVimaxAgentPlan({
  title: '旧计划',
  summary: '旧字段不再进入生成。',
  assets: [],
  shots: [{
    index: 1,
    title: '旧镜头',
    duration: 5,
    camera: '固定镜头',
    prompt: '旧镜头内容',
  }],
  nextAction: '继续',
}), /缺少时空关系或路由置信度/);

console.log(JSON.stringify({
  ok: true,
  providerCalls: 0,
  incurredCost: false,
  richPlanFieldsPreserved: true,
  legacyPlanRejectedBeforeProvider: true,
}));
