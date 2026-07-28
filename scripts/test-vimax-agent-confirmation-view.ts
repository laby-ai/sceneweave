import assert from 'node:assert/strict';

import { buildVimaxAgentConfirmationView } from '../src/lib/skills/vimax-short-drama/vimax-agent-confirmation-view';
import type { ChatMessage } from '../src/lib/smart-assistant-panel-model';

const message: ChatMessage = {
  id: 'plan-message',
  role: 'assistant',
  content: '记者沿着发光胶片追向楼梯间。',
  timestamp: Date.now(),
  generationStatus: 'completed',
  vimaxAgent: {
    phase: 'plan',
    title: '雨夜天台的胶片',
    summary: '记者沿着发光胶片追向楼梯间。',
    model: 'internal-planner',
    costState: 'incurred',
    nextAction: '确认分镜后生成参考图。',
    story: {
      premise: '发光胶片指向一段被掩盖的城市记录。',
      protagonist: '穿深蓝风衣的年轻记者',
      desire: '在天亮前找到记录源头',
      obstacle: '暴雨和逐渐熄灭的胶片',
      turningPoint: '胶片投出通往楼梯间的蓝光',
      endingHook: '楼梯门后传来旧放映机转动声',
    },
    characters: [{
      id: 'reporter',
      label: '年轻记者',
      description: '湿发，深蓝风衣，右手握发光胶片',
    }],
    scenes: [{
      id: 'rooftop',
      label: '雨夜天台',
      description: '冷蓝霓虹、湿地反光和楼梯间铁门',
    }],
    props: [{
      id: 'film',
      label: '发光胶片',
      description: '掌心大小的透明胶片，边缘发蓝光',
    }],
    shots: [
      {
        index: 1,
        title: '拾起胶片',
        duration: 5,
        camera: '中景缓慢推进',
        prompt: '记者弯腰拾起胶片，蓝光照亮袖口。',
        actionStart: '记者弯腰伸手',
        actionEnd: '记者直起身看向铁门',
        status: 'planned',
      },
      {
        index: 2,
        title: '追随蓝光',
        duration: 5,
        camera: '右向跟拍',
        prompt: '记者握着同一胶片向铁门快步走去。',
        actionStart: '记者站直看向右侧',
        actionEnd: '记者抵达铁门',
        status: 'planned',
      },
    ],
  },
};

const view = buildVimaxAgentConfirmationView(message);
assert.ok(view, 'completed planning message should produce a confirmation view');
assert.equal(view.heading, '我理解的是');
assert.equal(view.story.premise, '发光胶片指向一段被掩盖的城市记录。');
assert.equal(view.story.protagonist, '穿深蓝风衣的年轻记者');
assert.equal(view.story.goal, '在天亮前找到记录源头');
assert.deepEqual(view.anchors.map(item => item.label), ['年轻记者', '雨夜天台', '发光胶片']);
assert.equal(view.shots.length, 2);
assert.equal(view.shots[0].action, '记者弯腰伸手 → 记者直起身看向铁门');
assert.equal(view.nextStep, '确认分镜后生成参考图。');

const visibleCopy = JSON.stringify(view);
assert.doesNotMatch(visibleCopy, /internal-planner|I2V|R2V|provider|route/i);
assert.doesNotMatch(visibleCopy, /初见之时|进一步了解|最终，我们看到的是/);

const emptyNarrativeMessage: ChatMessage = {
  ...message,
  id: 'empty-plan-message',
  vimaxAgent: {
    ...message.vimaxAgent!,
    story: undefined,
    characters: [],
    scenes: [],
    props: [],
  },
};
const emptyView = buildVimaxAgentConfirmationView(emptyNarrativeMessage);
assert.ok(emptyView);
assert.deepEqual(emptyView.story, {});
assert.deepEqual(emptyView.anchors, []);

console.log(JSON.stringify({
  ok: true,
  sections: ['understanding', 'storyboard', 'next-step'],
  shots: view.shots.length,
  anchors: view.anchors.length,
}));
