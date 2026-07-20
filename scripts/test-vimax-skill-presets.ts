import assert from 'node:assert/strict';

import {
  VIMAX_SKILL_PRESETS,
  loadVimaxSkillPreset,
  resolveVimaxSkillPreset,
  saveVimaxSkillPreset,
  searchVimaxSkillPresets,
  vimaxSkillPresetStorageKey,
} from '../src/lib/skills/vimax-short-drama/vimax-skill-presets';
import {
  buildVimaxPlanRequest,
  resolveVimaxGenerationSettings,
} from '../src/lib/skills/vimax-short-drama/vimax-generation-preferences';

assert.equal(new Set(VIMAX_SKILL_PRESETS.map(preset => preset.id)).size, VIMAX_SKILL_PRESETS.length);
assert.doesNotMatch(
  VIMAX_SKILL_PRESETS.map(preset => `${preset.name} ${preset.description} ${preset.prompt}`).join('\n'),
  /ViMAX|Vimax|VIMAX/,
);
assert.equal(searchVimaxSkillPresets('电商')[0]?.id, 'commerce-video');
assert.ok(searchVimaxSkillPresets('  分镜  ').some(preset => preset.id === 'storyboard-director'));
assert.equal(searchVimaxSkillPresets('不存在的技能').length, 0);

const preset = resolveVimaxSkillPreset('commerce-video');
assert.equal(preset.name, '电商商品片');
assert.equal(resolveVimaxSkillPreset('unknown').id, 'short-drama');
assert.notEqual(vimaxSkillPresetStorageKey('guest-a'), vimaxSkillPresetStorageKey('guest-b'));

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) || null,
  setItem: (key: string, value: string) => { values.set(key, value); },
};
saveVimaxSkillPreset(storage, 'guest-a', 'commerce-video');
assert.equal(loadVimaxSkillPreset(storage, 'guest-a').id, 'commerce-video', 'refresh must restore the current workspace selection');
assert.equal(loadVimaxSkillPreset(storage, 'guest-b').id, 'short-drama', 'another workspace must not inherit the selection');

const request = buildVimaxPlanRequest({
  prompt: preset.prompt,
  duration: 30,
  style: preset.style,
  skillId: preset.id,
  sceneType: preset.sceneType,
  settings: resolveVimaxGenerationSettings({ ratio: '9:16', quality: '超清' }),
});

assert.equal(request.skillId, 'commerce-video');
assert.equal(request.sceneType, 'advertisement');
assert.equal(request.style, '明快商业广告');

console.log(JSON.stringify({
  ok: true,
  script: 'test-vimax-skill-presets',
  presets: VIMAX_SKILL_PRESETS.length,
  selected: request.skillId,
}));
