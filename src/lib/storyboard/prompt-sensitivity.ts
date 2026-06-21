/**
 * Prompt sensitivity and provider-safe sanitization rules.
 * Extracted from storyboard-generator to keep storyboarding logic focused.
 */

// ============================================================
// 提示词安全过滤引擎 v2.0 — 防止触发视频模型内容审核
// ============================================================
//
// v2.0 核心优化：
// ├─ 三级分类体系（BLOCK/REPLACE/SOFTEN）— 按严重程度差异化处理
// ├─ 上下文感知匹配 — 词边界 + 复合词优先 + 排除安全上下文
// ├─ 7大类别全覆盖 — 奇幻/宗教/暴力/政治/色情/违禁品/仇恨
// ├─ 智能语义保留替换 — 尽量保留原意而非粗暴抹除
// ├─ 加权风险评分算法 — 按类别权重+组合效应计算综合风险
// ├─ 结构化审计日志 — JSON格式便于分析和追溯
// └─ 白名单机制 — 豁免特定安全上下文
//
// 触发码参考（旧视频模型）:
//   1026: input text sensitive（内容审核不通过）
//   1033: 服务内部异常（可能含敏感内容的间接表现）
// ============================================================

// ---- 类型定义 ----

/** 敏感词严重等级 */
export type SensitivityLevel = 'block' | 'replace' | 'soften';

/** 敏感词分类 */
export type SensitivityCategory =
  | 'fantasy'      // 奇幻/超自然（最高频触发1026）
  | 'religious'    // 宗教/神话
  | 'violence'     // 暴力/血腥
  | 'political'    // 政治/敏感
  | 'adult'        // 成人/色情暗示
  | 'prohibited'   // 违禁品/非法行为
  | 'hate'         // 仇恨/歧视
  | 'copyright';   // 版权/品牌侵权风险

/** 单条敏感词规则 */
interface SensitivityRule {
  /** 匹配模式（支持单词、复合词、OR组） */
  patterns: RegExp[];
  /** 替换文本或处理方式 */
  replacement: string;
  /** 分类 */
  category: SensitivityCategory;
  /** 严重等级 */
  level: SensitivityLevel;
  /** 说明（用于日志和用户提示） */
  description: string;
  /** 风险权重（用于评分，越高越危险） */
  riskWeight: number;
  /** 白名单上下文（在这些词附近时不触发） */
  whitelistContext?: string[];
}

/** 过滤结果 */
export interface SanitizationResult {
  /** 过滤后的文本 */
  sanitized: string;
  /** 是否有改动 */
  isModified: boolean;
  /** 详细替换记录 */
  details: SanitizationDetail[];
  /** 综合风险评分 (0-100) */
  riskScore: number;
  /** 风险等级 */
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
}

/** 单次替换记录 */
interface SanitizationDetail {
  /** 原始匹配文本 */
  original: string;
  /** 替换后文本 */
  replaced: string;
  /** 分类 */
  category: SensitivityCategory;
  /** 等级 */
  level: SensitivityLevel;
  /** 说明 */
  reason: string;
  /** 出现次数 */
  count: number;
}

/** 风险检测结果 */
export interface SensitivityCheckResult {
  /** 是否包含敏感内容 */
  isSensitive: boolean;
  /** 检测到的敏感词列表 */
  detectedWords: Array<{
    word: string;
    suggestion: string;
    category: SensitivityCategory;
    level: SensitivityLevel;
    reason: string;
  }>;
  /** 综合风险评分 (0-100) */
  riskScore: number;
  /** 风险等级 */
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  /** 各分类统计 */
  categoryBreakdown: Record<SensitivityCategory, number>;
  /** 给用户的优化建议 */
  suggestions: string[];
}

// ---- 分类权重配置 ----

/** 各类别的风险基础权重 */
const CATEGORY_WEIGHTS: Record<SensitivityCategory, number> = {
  fantasy: 15,       // 奇幻类是1026最高频触发源
  adult: 20,         // 成人内容最严格
  prohibited: 18,    // 违禁品严格
  hate: 17,          // 仇恨歧视严格
  religious: 8,      // 宗教中等
  violence: 10,      // 暴力中等
  political: 12,     // 政治偏高
  copyright: 3,      // 版权最低（仅建议）
};

/** 等级系数 */
const LEVEL_MULTIPLIERS: Record<SensitivityLevel, number> = {
  block: 2.0,     // 必须阻止 — 双倍权重
  replace: 1.0,    // 必须替换 — 标准权重
  soften: 0.5,     // 建议软化 — 半权重
};

// ============================================================
// v2.0 敏感词规则库（三级分类 × 7大类别）
// ============================================================

/**
 * 构建带词边界的正则
 * @param word 原始词汇
 * @param options 配置选项
 * @returns 带适当边界约束的正则表达式
 */
function buildPattern(
  word: string,
  options?: { wordBoundary?: boolean; compound?: boolean }
): RegExp {
  const { wordBoundary = true, compound = false } = options || {};

  if (compound) {
    // 复合词/短语：整体匹配，允许前后有标点
    return new RegExp(word, 'g');
  }

  if (wordBoundary && /^[\u4e00-\u9fa5]{2,4}$/.test(word)) {
    // 中文2-4字词：使用Unicode词边界（避免在更长词内部匹配）
    // 例如 "杀" 不匹配 "杀菌"，但匹配独立的 "杀"
    return new RegExp(`(?<![\\u4e00-\\u9fa5])${word}(?![\\u4e00-\\u9fa5])`, 'g');
  }

  // 默认全局匹配
  return new RegExp(word, 'g');
}

/**
 * OR 组快捷构建：多个词共享同一个替换规则
 */
function orGroup(words: string, options?: { wordBoundary?: boolean }): RegExp[] {
  const opts = options || {};
  return [new RegExp(words, 'g')];
}

/** v2.0 完整规则库 */
const SENSITIVITY_RULES_V2: SensitivityRule[] = [
  // ================================================================
  // Level 1: BLOCK（必须阻止 — 最高风险，直接替换为安全替代）
  // ================================================================

  // ----- 奇幻生物（code=1026 最高频触发源）-----
  {
    patterns: [buildPattern('精灵'), buildPattern('仙女'), buildPattern('妖精')],
    replacement: '{奇幻人物}',
    category: 'fantasy',
    level: 'block',
    description: '奇幻生物→泛化人物',
    riskWeight: 15,
  },
  {
    patterns: [buildPattern('恶魔'), buildPattern('魔鬼')],
    replacement: '{黑暗角色}',
    category: 'fantasy',
    level: 'block',
    description: '恶魔形象→戏剧化角色',
    riskWeight: 14,
  },
  {
    patterns: [buildPattern('鬼魂'), buildPattern('幽灵'), buildPattern('亡灵'), orGroup('鬼魂|幽灵|亡灵')[0]],
    replacement: '{神秘身影}',
    category: 'fantasy',
    level: 'block',
    description: '超自然存在→神秘氛围',
    riskWeight: 16,
  },
  {
    patterns: [buildPattern('龙', { compound: true }), orGroup('神龙|巨龙')[0]],
    replacement: '{雄伟生物}',
    category: 'fantasy',
    level: 'block',
    description: '神话龙→宏伟生物形象',
    riskWeight: 13,
    whitelistContext: ['龙舟', '龙眼', '龙虾', '龙头'], // 安全的"龙"字用法
  },
  {
    patterns: [buildPattern('独角兽'), buildPattern('凤凰')],
    replacement: '{神异动物}',
    category: 'fantasy',
    level: 'block',
    description: '神话生物→珍稀动物',
    riskWeight: 12,
  },

  // ----- 魔法/超能力 -----
  {
    patterns: [orGroup('魔法|法术|咒语|魔咒')[0]],
    replacement: '{特效}',
    category: 'fantasy',
    level: 'block',
    description: '魔法术语→视觉特效',
    riskWeight: 14,
  },
  {
    patterns: [orGroup('超能力|异能|特异功能')[0]],
    replacement: '{非凡能力}',
    category: 'fantasy',
    level: 'block',
    description: '超能力→泛化能力描述',
    riskWeight: 13,
  },
  {
    patterns: [orGroup('变身|变形|幻化|变异')[0]],
    replacement: '{变化}',
    category: 'fantasy',
    level: 'block',
    description: '超自然变化→普通变化',
    riskWeight: 11,
    whitelistContext: ['变形金刚', '变形计'], // 安全上下文
  },
  {
    patterns: [orGroup('召唤|召唤术|念咒|施法')[0]],
    replacement: '{呈现}',
    category: 'fantasy',
    level: 'block',
    description: '魔法动作→普通动词',
    riskWeight: 12,
  },

  // ----- 宗教核心词汇 -----
  {
    patterns: [orGroup('上帝|天主|真主|阿拉')[0]],
    replacement: '{至高存在}',
    category: 'religious',
    level: 'block',
    description: '宗教主神→哲学化表达',
    riskWeight: 10,
  },
  {
    patterns: [orGroup('佛|菩萨|罗汉|佛陀')[0], buildPattern('神仙'), buildPattern('仙人'), buildPattern('修仙')],
    replacement: '{智者/超凡者}',
    category: 'religious',
    level: 'block',
    description: '宗教人物→泛化智者形象',
    riskWeight: 9,
    whitelistContext: ['佛教文化', '道教文化', '信佛', '拜佛'], // 文化讨论语境
  },
  {
    patterns: [orGroup('地狱|天堂|冥界|阴间')[0]],
    replacement: '{彼岸世界}',
    category: 'religious',
    level: 'block',
    description: '宗教场所→抽象世界',
    riskWeight: 10,
  },
  {
    patterns: [buildPattern('天使', { compound: false })],
    replacement: '{光辉形象}',
    category: 'religious',
    level: 'block',
    description: '天使→纯洁光辉形象',
    riskWeight: 9,
    whitelistContext: ['天使投资', '天使轮'], // 商业术语
  },

  // ----- 成人/色情（最严格）-----
  {
    patterns: [
      orGroup('裸体|全裸|半裸|裸露|赤裸')[0],
      orGroup('色情|淫秽|情色|黄色|成人片')[0],
    ],
    replacement: '{适度着装}',
    category: 'adult',
    level: 'block',
    description: '裸露/色情→得体着装',
    riskWeight: 25,
  },
  {
    patterns: [
      orGroup('性感|诱惑|挑逗|撩人|火辣')[0],
      buildPattern('SM'),
      orGroup('BDSM|调教|捆绑')[0],
    ],
    replacement: '{魅力展现}',
    category: 'adult',
    level: 'block',
    description: '性暗示→优雅魅力',
    riskWeight: 20,
  },

  // ----- 违禁品/非法行为 -----
  {
    patterns: [
      orGroup('毒品|吸毒|贩毒|大麻|海洛因|冰毒|可卡因')[0],
      orGroup('枪支|弹药|武器|炸药')[0],
    ],
    replacement: '{禁止事项}',
    category: 'prohibited',
    level: 'block',
    description: '违禁品→移除',
    riskWeight: 25,
  },
  {
    patterns: [orGroup('赌博|赌场|博彩|押注|庄家')[0]],
    replacement: '{娱乐活动}',
    category: 'prohibited',
    level: 'block',
    description: '赌博→一般娱乐',
    riskWeight: 18,
  },

  // ----- 仇恨/歧视 -----
  {
    patterns: [
      orGroup('种族歧视|性别歧视|仇恨|极端主义|纳粹|法西斯')[0],
    ],
    replacement: '{尊重多元}',
    category: 'hate',
    level: 'block',
    description: '仇恨言论→包容理念',
    riskWeight: 22,
  },

  // ================================================================
  // Level 2: REPLACE（必须替换 — 高风险，语义保留型替换）
  // ================================================================

  // ----- 暴力/血腥（保留动作感但弱化暴力程度）-----
  {
    patterns: [buildPattern('杀'), orGroup('谋杀|刺杀|暗杀|虐杀')[0]],
    replacement: '击败',
    category: 'violence',
    level: 'replace',
    description: '杀戮→竞技击败',
    riskWeight: 12,
    whitelistContext: ['杀手', '杀手锏', '杀手级', '杀菌', '杀毒', '杀虫', '杀青', '秒杀', '拼杀'],
  },
  {
    patterns: [orGroup('血|鲜血|流血|血腥|出血')[0]],
    replacement: '伤痕',
    category: 'violence',
    level: 'replace',
    description: '血液→伤痕淡化',
    riskWeight: 10,
    whitelistContext: ['血压', '血糖', '血脂', '血型', '血管', '血红蛋白', '贫血', '热血', '鲜血（英雄）', '碧血'],
  },
  {
    patterns: [orGroup('砍|劈|斩|刺|捅')[0]],
    replacement: '击打',
    category: 'violence',
    level: 'replace',
    description: '锐器攻击→普通击打',
    riskWeight: 10,
    whitelistContext: ['砍价', '砍树', '砍柴', '劈叉', '劈柴', '刺身', '刺绣', '穿刺'],
  },
  {
    patterns: [orGroup('爆炸|炸毁|轰炸|引爆')[0]],
    replacement: '冲击',
    category: 'violence',
    level: 'replace',
    description: '爆炸→物理冲击效果',
    riskWeight: 11,
    whitelistContext: ['爆炸头', '爆炸性新闻'],
  },
  {
    patterns: [orGroup('死|死亡|死去|丧命|毙命')[0]],
    replacement: '倒下',
    category: 'violence',
    level: 'replace',
    description: '死亡→倒下/失败',
    riskWeight: 11,
    whitelistContext: ['死机', '死循环', '死板', '死磕', '死活', '死心', '死寂', '死海', '死角', '死穴', '死党', '死忠', '致死量', '找死', '作死', '拼死', '誓死', '至死', '生死', '死活', '不死', '起死回生', '出生入死', '生死与共', '生死攸关', '救死扶伤', '视死如归', '出生', '死去', '梦死', '醉生梦死'],
  },
  {
    patterns: [orGroup('自杀|自残|自尽|寻短见')[0]],
    replacement: '陷入困境',
    category: 'violence',
    level: 'replace',
    description: '自残→心理困境',
    riskWeight: 18,
  },

  // ----- 政治/敏感（保留含义但去政治化）-----
  {
    patterns: [orGroup('政治|政府|政权|执政')[0]],
    replacement: '管理机构',
    category: 'political',
    level: 'replace',
    description: '政治实体→中性机构',
    riskWeight: 10,
    whitelistContext: ['政治课', '政治家', '政治学', '非政治', '谈政治', '聊政治'],
  },
  {
    patterns: [orGroup('领袖|元首|统治者|独裁者')[0]],
    replacement: '领导者',
    category: 'political',
    level: 'replace',
    description: '政治头衔→通用领导',
    riskWeight: 11,
  },
  {
    patterns: [orGroup('革命|起义|暴动|造反|颠覆')[0]],
    replacement: '变革',
    category: 'political',
    level: 'replace',
    description: '政治行动→中性变革',
    riskWeight: 14,
    whitelistContext: ['工业革命', '技术革命', '信息革命', '革命性', '革命者（技术）'],
  },
  {
    patterns: [orGroup('抗议|示威|游行|请愿')[0]],
    replacement: '集会表达',
    category: 'political',
    level: 'replace',
    description: '政治集会→中性表达',
    riskWeight: 12,
  },

  // ----- 科幻/穿越概念 -----
  {
    patterns: [orGroup('穿越|时空穿梭|时间旅行')[0]],
    replacement: '跨越',
    category: 'fantasy',
    level: 'replace',
    description: '时空穿越→跨越概念',
    riskWeight: 8,
    whitelistContext: ['穿越火线', '穿越机', '网络穿越'],
  },
  {
    patterns: [orGroup('异世界|平行宇宙|多维空间')[0]],
    replacement: '新世界',
    category: 'fantasy',
    level: 'replace',
    description: '科幻设定→泛化世界',
    riskWeight: 7,
  },

  // ================================================================
  // Level 3: SOFTEN（建议软化 — 中低风险，保留原意但降低强度）
  // ================================================================

  // ----- 情绪/氛围强化词（可能触发过度暴露检测）-----
  {
    patterns: [orGroup('极度|极其|万分|无比|绝')[0]],
    replacement: '非常',
    category: 'adult',
    level: 'soften',
    description: '极端程度词→温和表达',
    riskWeight: 3,
  },
  {
    patterns: [orGroup('完美无瑕|绝世|举世无双|空前绝后')[0]],
    replacement: '出色',
    category: 'adult',
    level: 'soften',
    description: '极致赞美→正常赞赏',
    riskWeight: 2,
  },

  // ----- 可能被误解的词汇 -----
  {
    patterns: [orGroup('制服|警服|护士服|女仆')[0]],
    replacement: '特色服装',
    category: 'adult',
    level: 'soften',
    description: '特殊服装→中性描述',
    riskWeight: 6,
  },
  {
    patterns: [orGroup('捆绑|束缚|锁链|手铐')[0]],
    replacement: '装饰配饰',
    category: 'adult',
    level: 'soften',
    description: '束缚道具→装饰元素',
    riskWeight: 8,
    whitelistContext: ['捆绑销售', '时间束缚', '束缚（技术）'],
  },

  // ----- 版权/品牌风险 -----
  {
    patterns: [
      buildPattern('迪士尼', { compound: true }),
      buildPattern('漫威', { compound: true }),
      buildPattern('任天堂', { compound: true }),
      orGroup('哈利波特|蜘蛛侠|钢铁侠|奥特曼|喜羊羊|熊出没')[0],
    ],
    replacement: '{知名IP角色}',
    category: 'copyright',
    level: 'soften',
    description: '版权IP→泛化角色',
    riskWeight: 5,
  },
];

// ============================================================
// v2.0 核心函数
// ============================================================

/**
 * 检查文本是否命中白名单上下文
 *
 * 在白名单词汇附近的敏感词不触发替换
 * 例如："杀菌"中的"杀"不会触发暴力过滤
 */
function isInWhitelistContext(
  text: string,
  matchIndex: number,
  matchLength: number,
  whitelist: string[]
): boolean {
  if (!whitelist || whitelist.length === 0) return false;

  // 检查匹配位置前后是否有白名单词汇
  const contextRadius = 6; // 前后各检查6个字符
  const start = Math.max(0, matchIndex - contextRadius);
  const end = Math.min(text.length, matchIndex + matchLength + contextRadius);
  const surroundingText = text.substring(start, end);

  for (const allowed of whitelist) {
    if (surroundingText.includes(allowed)) {
      return true;
    }
  }
  return false;
}

/**
 * 计算综合风险评分
 *
 * 算法:
 *   score = Σ(rule.riskWeight × LEVEL_MULTIPLIERS[level] × count)
 *   然后归一化到 0-100 范围
 *
 * 组合加成:
 * - 同一类别多个词命中 → +20% 类别加成
 * - 不同类别同时命中 → +15% 交叉加成
 * - block级别命中 → +10% 严重加成
 */
function calculateRiskScore(details: SanitizationDetail[]): number {
  if (details.length === 0) return 0;

  let rawScore = 0;
  const categoryCounts: Record<string, number> = {};
  let hasBlock = false;
  let categoryCount = 0;

  for (const detail of details) {
    const weight = CATEGORY_WEIGHTS[detail.category] || 5;
    const multiplier = LEVEL_MULTIPLIERS[detail.level] || 1;
    rawScore += weight * multiplier * detail.count;

    categoryCounts[detail.category] = (categoryCounts[detail.category] || 0) + detail.count;
    if (detail.level === 'block') hasBlock = true;
  }
  categoryCount = Object.keys(categoryCounts).length;

  // 同类别多词加成
  for (const cat in categoryCounts) {
    if (categoryCounts[cat] >= 2) {
      rawScore *= 1.2;
    }
  }

  // 跨类别交叉加成
  if (categoryCount >= 2) {
    rawScore *= 1.15;
  }
  if (categoryCount >= 3) {
    rawScore *= 1.1; // 累加
  }

  // block级别加成
  if (hasBlock) {
    rawScore *= 1.1;
  }

  // 归一化到 0-100（假设理论最大值约150）
  return Math.min(100, Math.round(rawScore));
}

/**
 * 将数值风险分数转换为等级标签
 */
function scoreToLevel(score: number): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
  if (score === 0) return 'safe';
  if (score <= 15) return 'low';
  if (score <= 35) return 'medium';
  if (score <= 60) return 'high';
  return 'critical';
}

/**
 * 生成用户可读的优化建议
 */
function generateSuggestions(checkResult: SensitivityCheckResult): string[] {
  const suggestions: string[] = [];
  const { detectedWords, categoryBreakdown, riskLevel } = checkResult;

  // 按类别给出针对性建议
  if (categoryBreakdown.fantasy > 0) {
    suggestions.push('建议将奇幻/魔法元素替换为现实可行的视觉效果（如光影特效、粒子动画）');
  }
  if (categoryBreakdown.adult > 0) {
    suggestions.push('请确保人物着装得体，避免过于暴露或性暗示的描述');
  }
  if (categoryBreakdown.violence > 0) {
    suggestions.push('暴力场景建议改为竞技、运动或艺术化的表现形式');
  }
  if (categoryBreakdown.religious > 0) {
    suggestions.push('宗教相关内容建议改为文化或哲学层面的表达');
  }
  if (categoryBreakdown.political > 0) {
    suggestions.push('避免涉及具体政治实体，改用虚构或泛化的设定');
  }
  if (categoryBreakdown.prohibited > 0) {
    suggestions.push('请移除所有违禁品和非法行为的描述');
  }
  if (categoryBreakdown.hate > 0) {
    suggestions.push('确保内容体现包容和尊重，避免任何歧视性表述');
  }

  // 通用建议
  if (riskLevel === 'critical') {
    suggestions.unshift('⚠️ 检测到高风险内容，强烈建议大幅修改后再提交');
  } else if (riskLevel === 'high') {
    suggestions.unshift('检测到较多敏感词，建议修改后重试以提高通过率');
  }

  // 如果没有类别特定建议，给一个通用的
  if (suggestions.length === 0 && detectedWords.length > 0) {
    suggestions.push('建议用更中性的词汇替换检测到的敏感词');
  }

  return suggestions.slice(0, 5); // 最多5条建议
}

// ============================================================
// 导出的公共API
// ============================================================

/**
 * v2.0 过滤提示词中的敏感内容
 *
 * 相比v1改进:
 * - 三级分类差异化处理（block/replace/soften）
 * - 白名单上下文豁免
 * - 结构化审计日志
 * - 综合风险评分
 *
 * @param rawPrompt 原始提示词
 * @returns 结构化过滤结果
 */
export function sanitizePromptForMiniMax(rawPrompt: string): SanitizationResult {
  if (!rawPrompt) {
    return {
      sanitized: rawPrompt,
      isModified: false,
      details: [],
      riskScore: 0,
      riskLevel: 'safe',
    };
  }

  let sanitized = rawPrompt;
  const details: SanitizationDetail[] = [];

  for (const rule of SENSITIVITY_RULES_V2) {
    for (const pattern of rule.patterns) {
      // 重置正则的lastIndex（因为使用了g标志）
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      const matches: Array<{ index: number; text: string }> = [];

      while ((match = pattern.exec(sanitized)) !== null) {
        // 检查白名单上下文
        if (isInWhitelistContext(sanitized, match.index, match[0].length, rule.whitelistContext || [])) {
          console.log(`[Sanitizer v2.0] 跳过白名单匹配: "${match[0]}" at ${match.index} (上下文: ${rule.whitelistContext?.join(',')})`);
          continue;
        }
        matches.push({ index: match.index, text: match[0] });
      }

      if (matches.length > 0) {
        // 执行替换
        const beforeLength = sanitized.length;
        sanitized = sanitized.replace(pattern, rule.replacement);
        const actualCount = matches.length;

        details.push({
          original: matches[0].text,
          replaced: rule.replacement,
          category: rule.category,
          level: rule.level,
          reason: rule.description,
          count: actualCount,
        });
      }
    }
  }

  const riskScore = calculateRiskScore(details);

  // 结构化日志输出
  if (details.length > 0) {
    console.log(`[Sanitizer v2.0] 过滤完成: ${details.length}项规则生效, 风险分=${riskScore}/${scoreToLevel(riskScore)}`);
    for (const d of details) {
      console.log(`  [${d.level.toUpperCase()}] ${d.category}: "${d.original}"→"${d.replaced}" (${d.reason}, ${d.count}处)`);
    }
  }

  return {
    sanitized,
    isModified: details.length > 0,
    details,
    riskScore,
    riskLevel: scoreToLevel(riskScore),
  };
}

/**
 * v2.0 检测提示词敏感度（用于提前预警）
 *
 * 相比v1改进:
 * - 7大类别全覆盖
 * - 加权风险评分
 * - 分类统计
 * - 自动生成优化建议
 *
 * @param prompt 待检测文本
 * @returns 结构化检测结果
 */
export function checkPromptSensitivity(prompt: string): SensitivityCheckResult {
  const detectedWords: SensitivityCheckResult['detectedWords'] = [];
  const categoryBreakdown: Record<SensitivityCategory, number> = {
    fantasy: 0, religious: 0, violence: 0, political: 0,
    adult: 0, prohibited: 0, hate: 0, copyright: 0,
  };

  for (const rule of SENSITIVITY_RULES_V2) {
    for (const pattern of rule.patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(prompt);
      if (match && !isInWhitelistContext(prompt, match.index, match[0].length, rule.whitelistContext || [])) {
        detectedWords.push({
          word: match[0],
          suggestion: rule.replacement,
          category: rule.category,
          level: rule.level,
          reason: rule.description,
        });
        categoryBreakdown[rule.category] = (categoryBreakdown[rule.category] || 0) + 1;
        break; // 同一条规则只报告一次
      }
    }
  }

  // 计算模拟details用于评分
  const mockDetails: SanitizationDetail[] = detectedWords.map(w => ({
    original: w.word,
    replaced: w.suggestion,
    category: w.category,
    level: w.level,
    reason: w.reason,
    count: 1,
  }));
  const riskScore = calculateRiskScore(mockDetails);

  const result: SensitivityCheckResult = {
    isSensitive: detectedWords.length > 0,
    detectedWords,
    riskScore,
    riskLevel: scoreToLevel(riskScore),
    categoryBreakdown,
    suggestions: [],
  };

  // 生成建议
  result.suggestions = generateSuggestions(result);

  return result;
}

/**
 * 快速检查：仅返回是否安全（轻量版，用于实时输入检测）
 *
 * @param prompt 待检测文本
 * @returns 是否安全（true=无敏感内容或仅有soften级别）
 */
export function isPromptSafe(prompt: string): boolean {
  const result = checkPromptSensitivity(prompt);
  // 只有 block 和 replace 级别视为不安全
  const hasHardSensitive = result.detectedWords.some(w => w.level === 'block' || w.level === 'replace');
  return !hasHardSensitive;
}

/**
 * 获取风险等级对应的UI配置（颜色、图标、文案）
 */
export function getRiskLevelConfig(level: SensitivityCheckResult['riskLevel']): {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  label: string;
  hint: string;
} {
  switch (level) {
    case 'safe':
      return {
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        icon: '✓',
        label: '安全',
        hint: '提示词内容安全，可以直接使用',
      };
    case 'low':
      return {
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        icon: 'ℹ',
        label: '低风险',
        hint: '含有少量轻微敏感词，通常可以正常通过',
      };
    case 'medium':
      return {
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        icon: '⚠',
        label: '中等风险',
        hint: '包含较明显的敏感词，建议修改后提交',
      };
    case 'high':
      return {
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        icon: '✕',
        label: '高风险',
        hint: '包含多个敏感词，很可能被审核拒绝',
      };
    case 'critical':
      return {
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        icon: '✕✕',
        label: '极高风险',
        hint: '包含大量高风险内容，必须大幅修改',
      };
  }
}
