import type { VimaxSkillPreset } from '@/lib/skills/vimax-short-drama/vimax-skill-presets';

export function buildVimaxPlanMessages(prompt: string, preset: VimaxSkillPreset) {
  const system = [
    `你是创作工作台的“${preset.name}”制作 Agent，只输出 JSON，不要任何解释、验收话术、QA 语言或兜底路径。`,
    `当前预设目标：${preset.description}。场景类型=${preset.sceneType}；视觉风格=${preset.style}。`,
    '先完成故事、角色、场景和道具状态规划，再拆镜头。禁止用同一通用模板重复覆盖不同镜头。',
    '严格按照下面的 schema 输出，字段名和类型不能改，数组不能写成对象：',
    '{',
    '  "title": "作品标题，string",',
    '  "summary": "一句话创作梗概，string",',
    '  "story": {',
    '    "premise": "故事前提", "protagonist": "主角", "desire": "主角欲望", "obstacle": "阻力",',
    '    "conflict": "核心冲突", "turningPoint": "转折", "endingHook": "结尾钩子",',
    '    "emotionalArc": { "start": "起始情绪", "shift": "情绪转折", "end": "结束情绪" }',
    '  },',
    '  "characters": [{ "id": "character-1", "label": "角色名", "description": "外观与身份", "continuityAnchors": ["不可改变的服饰/体貌/配件"] }],',
    '  "scenes": [{ "id": "scene-1", "label": "场景名", "description": "空间与光线", "timeOfDay": "时间", "continuityAnchors": ["固定空间锚点"] }],',
    '  "props": [{ "id": "prop-1", "label": "道具名", "description": "外观", "state": "初始位置或状态" }],',
    '  "assets": [',
    '    { "kind": "character|scene|prop|reference", "label": "资产名称 string", "prompt": "用于图像模型的画面描述 string" }',
    '  ],',
    '  "shots": [',
    '    {',
    '      "index": 1, "title": "镜头标题", "duration": 5, "camera": "景别、机位、运动和轴线", "prompt": "本镜头独有的可拍摄画面",',
    '      "sceneId": "scene-1", "characterIds": ["character-1"], "propIds": ["prop-1"],',
    '      "actionStart": "首帧动作状态", "actionEnd": "尾帧动作状态",',
    '      "firstFrameDescription": "首帧构图、人物位置和道具状态", "lastFrameDescription": "尾帧构图、人物位置和道具状态",',
    '      "motionDescription": "从起始到结束的连续动作与镜头运动",',
    '      "dialogue": "本镜对白，没有则空字符串", "narration": "本镜旁白，没有则空字符串", "audioIntent": "环境声、对白和关键音效意图",',
    '      "spatialRelation": "same-scene|new-scene", "temporalRelation": "continuous|elapsed|time-jump",',
    '      "routeConfidence": "high|medium|low", "conflictFlags": ["无法同时满足的连续性要求，没有则空数组"],',
    '      "continuityPriorities": ["action|screen-direction|subject|scene|prop"]',
    '    }',
    '  ],',
    '  "nextAction": "下一步建议 string"',
    '}',
    'duration 必须是数字（秒），不能是 "0-5s" 这种字符串区间。',
    '第一镜用 new-scene/time-jump；同一动作立即承接必须用 same-scene/continuous；明确换景、跨时或蒙太奇用 new-scene 或 time-jump。',
    '只有真的同一动作连续才用 strict-frame。换景仍要通过 characterIds、continuityAnchors 和 continuityPriorities 保持人物身份。',
    '如果时空、动作或构图要求冲突，不要猜：routeConfidence=low，并把冲突写入 conflictFlags。',
    '同一场景连续镜头必须复用相同 sceneId，并把前一镜 actionEnd 原文逐字复制为后一镜 actionStart；前一镜 lastFrameDescription 与后一镜 firstFrameDescription 必须相容。',
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
