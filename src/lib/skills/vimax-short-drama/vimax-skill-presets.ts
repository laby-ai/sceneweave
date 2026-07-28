export interface VimaxSkillPreset {
  id: string;
  name: string;
  description: string;
  prompt: string;
  sceneType: string;
  style: string;
  keywords: string[];
}

export const VIMAX_SKILL_PRESETS: VimaxSkillPreset[] = [
  {
    id: 'short-drama',
    name: '短剧一键成片',
    description: '剧本、分镜、参考图与成片的完整创作链路',
    prompt: '制作一部短剧：题材是【】，主角是【】，关键场景是【】。先出分镜规划。',
    sceneType: 'drama',
    style: '电影感短剧',
    keywords: ['短剧', '漫剧', '剧情', '成片'],
  },
  {
    id: 'commerce-video',
    name: '电商商品片',
    description: '商品卖点、使用场景与转化镜头',
    prompt: '为【商品】制作一支电商商品片：核心卖点是【】，目标人群是【】，投放平台是【】。先输出制作方案与分镜。',
    sceneType: 'advertisement',
    style: '明快商业广告',
    keywords: ['电商', '商品', '带货', '广告', 'TVC'],
  },
  {
    id: 'storyboard-director',
    name: '分镜导演',
    description: '把脚本拆成可执行镜头与参考素材',
    prompt: '把下面脚本制作成完整分镜，并为每个镜头给出运镜、画面与参考素材要求：\n\n',
    sceneType: 'storyboard',
    style: '专业导演分镜',
    keywords: ['分镜', '导演', '脚本', '镜头'],
  },
  {
    id: 'brand-film',
    name: '品牌概念片',
    description: '品牌故事、情绪节奏与视觉记忆点',
    prompt: '为【品牌/产品】制作一支品牌概念片：品牌主张是【】，受众是【】，希望传达的情绪是【】。先输出制作方案与分镜。',
    sceneType: 'advertisement',
    style: '克制高级品牌片',
    keywords: ['品牌', '概念片', '广告', 'TVC'],
  },
  {
    id: 'art-film',
    name: '艺术实验影像',
    description: '围绕概念、媒介与视觉风格展开',
    prompt: '围绕【主题/概念】创作一支艺术实验影像：媒介偏好是【】，视觉风格是【】，希望观众感受到【】。先输出制作方案。',
    sceneType: 'art',
    style: '当代艺术影像',
    keywords: ['艺术', '实验', '视觉', '概念'],
  },
  {
    id: 'game-pv',
    name: '游戏实机 PV',
    description: '玩法展示、世界观与高能节奏镜头',
    prompt: '为【游戏】制作一支实机 PV：核心玩法是【】，世界观是【】，重点展示角色/场景是【】。先输出制作方案与分镜。',
    sceneType: 'game',
    style: '高能游戏宣传片',
    keywords: ['游戏', '实机', 'PV', '角色'],
  },
];

const VIMAX_DISCOVERABLE_SKILL_PRESETS = VIMAX_SKILL_PRESETS.filter(
  preset => preset.id !== 'storyboard-director',
);

export function resolveVimaxSkillPreset(id?: string | null): VimaxSkillPreset {
  return VIMAX_SKILL_PRESETS.find(preset => preset.id === id) || VIMAX_SKILL_PRESETS[0];
}

export function resolveVimaxSkillPresetForRuntime(id?: string | null): VimaxSkillPreset {
  if (!id) return VIMAX_SKILL_PRESETS[0];
  const preset = VIMAX_SKILL_PRESETS.find(candidate => candidate.id === id);
  if (!preset) throw new Error('未知创作预设，请重新选择后再试。');
  return preset;
}

export function searchVimaxSkillPresets(query: string): VimaxSkillPreset[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return VIMAX_DISCOVERABLE_SKILL_PRESETS;
  return VIMAX_DISCOVERABLE_SKILL_PRESETS.filter(preset => (
    [preset.name, preset.description, ...preset.keywords].some(value => value.toLocaleLowerCase().includes(normalized))
  ));
}

export function vimaxSkillPresetStorageKey(scope?: string): string {
  return `vimax-skill-preset${scope ? `:${scope}` : ''}`;
}

interface VimaxSkillPresetStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadVimaxSkillPreset(storage: VimaxSkillPresetStorage, scope?: string): VimaxSkillPreset {
  try {
    return resolveVimaxSkillPreset(storage.getItem(vimaxSkillPresetStorageKey(scope)));
  } catch {
    return resolveVimaxSkillPreset();
  }
}

export function saveVimaxSkillPreset(storage: VimaxSkillPresetStorage, scope: string | undefined, id: string): VimaxSkillPreset {
  const preset = resolveVimaxSkillPreset(id);
  try {
    storage.setItem(vimaxSkillPresetStorageKey(scope), preset.id);
  } catch {
    // Selection remains usable for the current render when storage is unavailable.
  }
  return preset;
}
