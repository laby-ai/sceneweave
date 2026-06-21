// AI技能中心常量

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'writing' | 'chat' | 'creative' | 'productivity' | 'analysis';
  color: string;
  featured?: boolean;
}

export const SKILLS: Skill[] = [
  // 写作类
  {
    id: 'writing-article',
    name: '文章写作',
    description: 'AI辅助撰写各类文章、博客、论文',
    icon: '📝',
    category: 'writing',
    color: 'from-red-500 to-red-500',
    featured: true,
  },
  {
    id: 'writing-copy',
    name: '文案创作',
    description: '撰写营销文案、广告语、社交媒体内容',
    icon: '💬',
    category: 'writing',
    color: 'from-pink-500 to-rose-500',
  },
  {
    id: 'writing-email',
    name: '邮件写作',
    description: '专业邮件撰写，支持多种场景和语气',
    icon: '📧',
    category: 'writing',
    color: 'from-red-500 to-red-500',
  },
  
  // 聊天类
  {
    id: 'chat-general',
    name: '智能对话',
    description: '通用AI聊天助手，回答各种问题',
    icon: '🤖',
    category: 'chat',
    color: 'from-green-500 to-emerald-500',
    featured: true,
  },
  {
    id: 'chat-coding',
    name: '代码助手',
    description: '编程问题解答、代码审查、Bug修复',
    icon: '💻',
    category: 'chat',
    color: 'from-red-500 to-red-500',
  },
  {
    id: 'chat-learning',
    name: '学习辅导',
    description: '知识讲解、学习规划、题目解答',
    icon: '📚',
    category: 'chat',
    color: 'from-red-500 to-rose-500',
  },
  
  // 创意类
  {
    id: 'creative-story',
    name: '故事创作',
    description: 'AI讲故事、剧本创作、小说大纲',
    icon: '📖',
    category: 'creative',
    color: 'from-pink-500 to-red-500',
    featured: true,
  },
  {
    id: 'creative-poem',
    name: '诗歌创作',
    description: '现代诗、古诗、歌词创作',
    icon: '🎭',
    category: 'creative',
    color: 'from-red-500 to-red-500',
  },
  {
    id: 'creative-brand',
    name: '品牌命名',
    description: '公司名、产品名、品牌口号创意',
    icon: '🏷️',
    category: 'creative',
    color: 'from-red-500 to-red-500',
  },
  
  // 效率类
  {
    id: 'productivity-summary',
    name: '内容摘要',
    description: '长文摘要、会议纪要、笔记整理',
    icon: '📋',
    category: 'productivity',
    color: 'from-red-500 to-red-500',
  },
  {
    id: 'productivity-translate',
    name: '智能翻译',
    description: '多语言翻译，保持语境和风格',
    icon: '🌍',
    category: 'productivity',
    color: 'from-green-500 to-red-500',
  },
  {
    id: 'productivity-brainstorm',
    name: '头脑风暴',
    description: '创意激发、思维导图、方案策划',
    icon: '💡',
    category: 'productivity',
    color: 'from-red-500 to-red-500',
  },
  
  // 分析类
  {
    id: 'analysis-data',
    name: '数据分析',
    description: '数据解读、趋势分析、洞察生成',
    icon: '📊',
    category: 'analysis',
    color: 'from-red-500 to-red-500',
  },
  {
    id: 'analysis-market',
    name: '市场分析',
    description: '竞品分析、用户研究、策略建议',
    icon: '📈',
    category: 'analysis',
    color: 'from-red-500 to-red-500',
  },
  {
    id: 'analysis-feedback',
    name: '反馈分析',
    description: '用户反馈、评论分析、情感分析',
    icon: '💭',
    category: 'analysis',
    color: 'from-pink-500 to-rose-500',
  },
];

export const SKILL_CATEGORIES = [
  { id: 'all', name: '全部技能', icon: '✨' },
  { id: 'writing', name: '写作助手', icon: '✍️' },
  { id: 'chat', name: '智能对话', icon: '💬' },
  { id: 'creative', name: '创意工坊', icon: '🎨' },
  { id: 'productivity', name: '效率工具', icon: '⚡' },
  { id: 'analysis', name: '分析洞察', icon: '🔍' },
];

// 模板库
export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  prompt: string;
  usageCount: number;
}

export const TEMPLATES: Template[] = [
  {
    id: 'template-social',
    name: '社交媒体帖子',
    description: '生成引人注目的社交媒体内容',
    category: 'writing',
    icon: '📱',
    prompt: '请帮我写一篇关于[主题]的社交媒体帖子，要求吸引眼球、互动性强，适合在[平台]发布。',
    usageCount: 1234,
  },
  {
    id: 'template-blog',
    name: '博客文章大纲',
    description: '生成完整的博客文章结构',
    category: 'writing',
    icon: '📝',
    prompt: '请帮我构思一篇关于[主题]的博客文章，包括引人入胜的标题、段落结构和关键点。',
    usageCount: 892,
  },
  {
    id: 'template-email',
    name: '商务邮件',
    description: '专业商务邮件模板',
    category: 'writing',
    icon: '📧',
    prompt: '请帮我写一封[邮件类型]的商务邮件，收件人是[收件人]，主要内容是[内容]。',
    usageCount: 756,
  },
  {
    id: 'template-ad',
    name: '广告文案',
    description: '吸引人的广告文案',
    category: 'creative',
    icon: '🎯',
    prompt: '请为[产品/服务]创作一则广告文案，突出[卖点]，目标受众是[受众]。',
    usageCount: 654,
  },
  {
    id: 'template-story',
    name: '短篇故事',
    description: '创意故事生成',
    category: 'creative',
    icon: '📖',
    prompt: '请创作一个关于[主题]的短篇故事，风格是[风格]，包含出人意料的结局。',
    usageCount: 543,
  },
  {
    id: 'template-brand',
    name: '品牌口号',
    description: '品牌标语创作',
    category: 'creative',
    icon: '🏷️',
    prompt: '请为[品牌名]创作几个品牌口号，体现[品牌价值]，易于记忆和传播。',
    usageCount: 432,
  },
  {
    id: 'template-summary',
    name: '内容摘要',
    description: '长文本摘要',
    category: 'productivity',
    icon: '📋',
    prompt: '请帮我总结以下内容，提取核心要点，用简洁的语言概括：[内容]',
    usageCount: 987,
  },
  {
    id: 'template-brainstorm',
    name: '创意头脑风暴',
    description: '激发创意想法',
    category: 'productivity',
    icon: '💡',
    prompt: '请帮我 brainstorm 关于[主题]的创意想法，从不同角度出发，越多越好。',
    usageCount: 876,
  },
];
