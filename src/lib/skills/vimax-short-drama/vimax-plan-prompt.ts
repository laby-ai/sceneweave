import type { VimaxSkillPreset } from '@/lib/skills/vimax-short-drama/vimax-skill-presets';

export function buildVimaxPlanMessages(prompt: string, preset: VimaxSkillPreset) {
  const system = [
    `你是创作工作台的“${preset.name}”制作 Agent，只输出 JSON，不要任何解释、验收话术、QA 语言或兜底路径。`,
    `当前预设目标：${preset.description}。场景类型=${preset.sceneType}；视觉风格=${preset.style}。`,
    '严格按照下面的 schema 输出，字段名和类型都不能改，assets 和 shots 必须是数组，不能写成对象：',
    '{',
    '  "title": "作品标题，string",',
    '  "summary": "一句话创作梗概，string",',
    '  "assets": [',
    '    { "kind": "character|scene|prop|reference", "label": "资产名称 string", "prompt": "用于图像模型的画面描述 string" }',
    '  ],',
    '  "shots": [',
    '    { "index": 1, "title": "镜头标题 string", "duration": 6, "camera": "运镜描述 string", "prompt": "画面内容描述 string", "handoffIntent": "strict-frame|reference-flexible", "handoffReason": "与上一镜的叙事和视觉关系 string", "continuityPriorities": ["action|screen-direction|subject|scene|prop"] }',
    '  ],',
    '  "nextAction": "下一步建议 string"',
    '}',
    'duration 必须是数字（秒），不能是 "0-5s" 这种字符串区间。',
    preset.id === 'storyboard-director'
      ? 'assets 给 3-6 个（角色/场景/道具/参考帧），shots 给 4-8 个；本预设只交付分镜与参考素材，不进入视频生成。'
      : 'assets 给 3-6 个（角色/场景/道具/参考帧），shots 给 4-8 个，全部用于后续视频生成。',
    '输出硬性要求：只输出一个 JSON 对象，不要 markdown 代码块、不要注释、不要前后多余文字；',
    '所有字符串值里的双引号和换行必须转义（\\" 和 \\n）；对象与数组元素之间必须有逗号，结尾不要多余逗号；务必输出完整闭合的 JSON。',
  ].join('\n');

  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: `请严格按 brief 指定的总时长、clip 数量和每段时长生成“${preset.name}”制作计划；如果 brief 写了 30 秒、6 个 5 秒 clip，就必须返回 6 个 duration=5 的 shots。只返回符合上面 schema 的 JSON：\n${prompt}` },
  ];
}
