/**
 * BGM 背景音乐类型定义 v2.0
 *
 * 集中管理所有BGM类型的元数据，供以下组件共享：
 * - video-generation-form.tsx（视频生成表单）
 * - storyboard-editor.tsx（分镜编辑器）
 * - bgm-player.tsx（BGM播放器）
 * - /api/prompt/bgm-recommend/route.ts（AI推荐API）
 * - /api/bgm/list/route.ts（BGM列表API）
 *
 * 设计原则：
 * - 24种主流类型全覆盖（v2.1新增6种）
 * - 每种含：名称/描述/图标/颜色/关键词/适用场景/情绪标签/TTS提示词
 * - 支持按场景类型自动推荐最佳BGM
 */

// ============================================================
// 类型定义
// ============================================================

/** BGM 类型ID */
export type BgmTypeId =
  | 'none'
  | 'relaxed'
  | 'upbeat'
  | 'romantic'
  | 'epic'
  | 'nature'
  | 'cinematic'
  // ★ v2.0 新增12种
  | 'electronic'
  | 'jazz'
  | 'classical'
  | 'rock'
  | 'acoustic'
  | 'ambient'
  | 'suspense'
  | 'comedy'
  | 'corporate'
  | 'lofi'
  | 'world'
  | 'holiday'
  // ★ v2.1 新增6种

  | 'chinese'
  | 'trap'
  | 'rnb'
  | 'reggae'
  | 'motivational'
  | 'retro';

/** 单个BGM类型完整元数据 */
export interface BgmTypeDefinition {
  /** 唯一标识 */
  id: BgmTypeId;
  /** 显示名称 */
  name: string;
  /** 简短描述 */
  description: string;
  /** 图标emoji */
  icon: string;
  /** 主题色（用于UI高亮） */
  color: string;
  /** 背景色（用于卡片背景） */
  bgColor: string;
  /** 边框色 */
  borderColor: string;
  /** 匹配关键词（用于AI推荐和本地匹配） */
  keywords: string[];
  /** 适用场景类型 */
  suitableScenes: string[];
  /** 情绪标签 */
  moods: string[];
  /** TTS语音合成时的音频描述提示词 */
  ttsPromptHint: string;
  /** 排序权重（数值越小越靠前） */
  order: number;
}

// ============================================================
// 24种BGM类型完整定义（v2.1）
// ============================================================

export const BGM_TYPES_V2: Record<BgmTypeId, BgmTypeDefinition> = {
  // ===== 基础6种（保留并增强）=====

  none: {
    id: 'none',
    name: '无背景音乐',
    description: '不使用背景音乐，仅保留原声或语音旁白',
    icon: '🔇',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    keywords: [],
    suitableScenes: ['*'],
    moods: ['安静', '纯净'],
    ttsPromptHint: '',
    order: 0,
  },

  relaxed: {
    id: 'relaxed',
    name: '轻松舒缓',
    description: '轻柔舒缓的旋律，钢琴或弦乐为主，适合放松、治愈、平静的内容',
    icon: '🧘',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    keywords: [
      '轻松', '舒缓', '治愈', '放松', '安静', '平静', '海边', '自然', '慢节奏',
      '冥想', '瑜伽', 'SPA', '午后', '咖啡馆', '阅读', '休息', '宁静', '安详',
      '温柔', '轻音乐', '钢琴曲', '新世纪', '禅意', '慢生活', '慵懒',
    ],
    suitableScenes: ['portrait', 'landscape', 'interior', 'food', 'abstract'],
    moods: ['平静', '治愈', '温暖', '安宁'],
    ttsPromptHint: 'soft piano and strings, slow tempo, calming atmosphere, gentle melody',
    order: 1,
  },

  upbeat: {
    id: 'upbeat',
    name: '活力动感',
    description: '欢快节奏的流行音乐，鼓点清晰，适合舞蹈、运动、欢快、活力的内容',
    icon: '⚡',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    keywords: [
      '跳舞', '运动', '活力', '快乐', '节奏', '欢快', '动感', '跳跃', '奔跑',
      '健身', '有氧', '派对', '庆典', '节日', '兴奋', '能量', '阳光', '积极',
      '流行', '舞曲', '电子舞曲', '快节奏', '卡点', '踩点', '高潮', '热血',
    ],
    suitableScenes: ['product', 'portrait', 'food'],
    moods: ['兴奋', '快乐', '充满活力', '积极向上'],
    ttsPromptHint: 'upbeat pop music, energetic drums, bright tempo, catchy rhythm, feel-good vibe',
    order: 2,
  },

  romantic: {
    id: 'romantic',
    name: '浪漫温馨',
    description: '温柔浪漫的旋律，小提琴或吉他为主，适合爱情、温馨、浪漫、情感表达',
    icon: '💕',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    keywords: [
      '浪漫', '爱情', '温馨', '温柔', '告白', '甜蜜', '情侣', '心动', '情感',
      '约会', '求婚', '婚礼', '纪念日', '表白', '恋人', '拥抱', '亲吻', '幸福',
      '粉色', '玫瑰', '烛光', '夕阳', '牵手', '依偎', '心动瞬间', '唯美',
    ],
    suitableScenes: ['portrait', 'food', 'interior', 'landscape'],
    moods: ['温柔', '甜蜜', '浪漫', '感动'],
    ttsPromptHint: 'romantic violin or guitar, soft and warm, emotional melody, love theme, gentle strings',
    order: 3,
  },

  epic: {
    id: 'epic',
    name: '史诗大气',
    description: '震撼人心的管弦乐配乐，铜管+打击乐，适合史诗、英雄、壮丽、宏大的内容',
    icon: '🎬',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    keywords: [
      '史诗', '大气', '震撼', '战争', '英雄', '壮丽', '壮观', '宏大', '磅礴',
      '史诗感', '交响乐', '管弦乐', '战斗', '冒险', '征程', '荣耀', '胜利', '王者',
      '开幕', '重磅', '压轴', '终极', '传奇', '不朽', '巅峰', '气势磅礴',
    ],
    suitableScenes: ['product', 'drama', 'landscape'],
    moods: ['震撼', '壮丽', '激昂', '史诗感'],
    ttsPromptHint: 'epic orchestral music, powerful brass and percussion, cinematic crescendo, heroic theme, grand scale',
    order: 4,
  },

  nature: {
    id: 'nature',
    name: '自然环境',
    description: '森林、海浪、鸟鸣等自然氛围音效，适合户外、自然、静谧、生态的内容',
    icon: '🌿',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    keywords: [
      '森林', '雨声', '鸟鸣', '海浪', '风声', '瀑布', '自然', '户外', '原野',
      '溪流', '蝉鸣', '蛙叫', '雷雨', '清晨', '黄昏', '星空', '露营', '徒步',
      '生态', '环保', '有机', '田园', '乡村', '山野', '竹林', '草原', '湿地',
    ],
    suitableScenes: ['landscape', 'food', 'interior', 'product'],
    moods: ['清新', '自然', '宁静', '生机勃勃'],
    ttsPromptHint: 'natural ambient soundscape, forest or ocean atmosphere, birdsong, flowing water, peaceful nature',
    order: 5,
  },

  cinematic: {
    id: 'cinematic',
    name: '电影配乐',
    description: '电影级叙事配乐，情绪层次丰富，适合剧情、故事、情感转折、戏剧性内容',
    icon: '🎥',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    keywords: [
      '电影', '剧情', '悬疑', '紧张', '戏剧', '叙事', '故事', '情感', '深沉',
      '反转', '揭秘', '追逐', '逃亡', '对峙', '内心独白', '回忆', '梦境', '现实',
      '文艺', '艺术', '独立电影', '纪录片', '访谈', '传记', '时代剧', '历史',
    ],
    suitableScenes: ['drama', 'portrait', 'abstract'],
    moods: ['深沉', '戏剧性', '引人入胜', '情感丰富'],
    ttsPromptHint: 'cinematic score with dynamic range, emotional arcs, subtle tension and release, film-quality production',
    order: 6,
  },

  // ===== v2.0 新增12种 =====

  electronic: {
    id: 'electronic',
    name: '电子律动',
    description: '现代电子合成器音色，未来感和科技感强烈，适合科技产品、赛博朋克、时尚潮流',
    icon: '🎛️',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    keywords: [
      '电子', '合成器', '科技', '未来', '赛博', '数字', '虚拟', 'AI', '智能',
      '霓虹', '都市夜景', '汽车', '数码产品', '手机', '电脑', '游戏', '电竞',
      '潮牌', '时尚秀', 'DJ', '夜店', '节拍', '低音', '未来主义', '极客',
    ],
    suitableScenes: ['product', 'abstract', 'portrait'],
    moods: ['前卫', '酷炫', '未来感', '节奏感强'],
    ttsPromptHint: 'electronic synthesizer music, futuristic vibes, pulsing bass, digital textures, modern tech aesthetic',
    order: 7,
  },

  jazz: {
    id: 'jazz',
    name: '爵士情调',
    description: '优雅的爵士乐，萨克斯或钢琴即兴演奏，适合高端生活方式、奢侈品、咖啡文化',
    icon: '🎷',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    keywords: [
      '爵士', '优雅', '奢华', '高级', '精品', '奢侈品', '名表', '香水', '红酒',
      '咖啡', '酒吧', '餐厅', '晚宴', '绅士', '淑女', '复古', '经典', '品味',
      '都市', '夜晚', '灯光', '格调', '精致生活', '慢摇', '蓝调', '摇摆',
    ],
    suitableScenes: ['product', 'interior', 'food', 'portrait'],
    moods: ['优雅', '精致', '复古', '高级感'],
    ttsPromptHint: 'smooth jazz with saxophone or piano, sophisticated lounge vibe, warm tones, elegant and refined',
    order: 8,
  },

  classical: {
    id: 'classical',
    name: '古典雅韵',
    description: '古典交响乐或室内乐，庄重典雅，适合文化艺术、高端品牌、正式场合',
    icon: '🎻',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    keywords: [
      '古典', '交响乐', '钢琴协奏曲', '小提琴', '大提琴', '歌剧', '芭蕾', '艺术馆',
      '博物馆', '画廊', '拍卖', '珠宝', '钻石', '皇室', '贵族', '典礼', '仪式',
      '文化', '传统', '历史', '传承', '匠心', '手工', '永恒', '经典', '殿堂级',
    ],
    suitableScenes: ['product', 'interior', 'drama'],
    moods: ['庄重', '典雅', '高贵', '永恒'],
    ttsPromptHint: 'classical orchestra or chamber music, grand piano, cello, timeless elegance, refined sophistication',
    order: 9,
  },

  rock: {
    id: 'rock',
    name: '摇滚力量',
    description: '电吉他和强劲鼓点，充满力量和反叛精神，适合极限运动、叛逆青春、高能内容',
    icon: '🎸',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    keywords: [
      '摇滚', '电吉他', '鼓点', '力量', '激情', '反叛', '青春', '极限运动', '滑板',
      '冲浪', '赛车', '摩托车', '街头', '涂鸦', '朋克', '金属', '呐喊', '释放',
      '狂野', '不羁', '热血沸腾', '逆袭', '突破', '挑战', '征服', '燃爆',
    ],
    suitableScenes: ['product', 'portrait'],
    moods: ['狂野', '热血', '充满力量', '自由不羁'],
    ttsPromptHint: 'rock music with electric guitar riffs, powerful drum beat, high energy, rebellious spirit, driving force',
    order: 10,
  },

  acoustic: {
    id: 'acoustic',
    name: '民谣叙事',
    description: '木吉他或口琴的民谣风格，质朴真诚，适合故事叙述、旅行、人文纪实',
    icon: '🪕',
    color: 'text-lime-400',
    bgColor: 'bg-lime-500/10',
    borderColor: 'border-lime-500/30',
    keywords: [
      '民谣', '木吉他', '故事', '旅行', '公路', '火车', '背包', '远方', '回忆',
      '成长', '青春', '校园', '毕业', '友情', '故乡', '童年', '怀旧', '时光',
      '真实', '朴素', '人文', '纪录片', 'Vlog', '日常', '生活记录', '手作',
    ],
    suitableScenes: ['portrait', 'landscape', 'food', 'interior'],
    moods: ['真挚', '怀旧', '温暖', '朴实'],
    ttsPromptHint: 'acoustic folk music, wooden guitar, harmonica, storytelling vibe, authentic and heartfelt',
    order: 11,
  },

  ambient: {
    id: 'ambient',
    name: '氛围空间',
    description: '空灵的氛围音乐，大量混响和延音，适合抽象视觉、冥想、科技展示、极简美学',
    icon: '✨',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    keywords: [
      '氛围', '空灵', '抽象', '极简', '空间', '宇宙', '星际', '深空', '漂浮',
      '梦幻', '迷幻', '意识流', '潜意识', '催眠', '睡眠', '深度放松', '冥想',
      '科技展示', '概念艺术', '装置艺术', '光影', '粒子', '流体', '渐变', '沉浸式',
    ],
    suitableScenes: ['abstract', 'product', 'landscape'],
    moods: ['空灵', '神秘', '深邃', '超然'],
    ttsPromptHint: 'ambient soundscape, ethereal pads, spacious reverb, floating textures, meditative and immersive',
    order: 12,
  },

  suspense: {
    id: 'suspense',
    name: '悬疑紧张',
    description: '不协和音程和低频脉冲，营造不安和期待感，适合惊悚、悬疑、推理、反转剧情',
    icon: '🔮',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
    keywords: [
      '悬疑', '惊悚', '恐怖', '推理', '侦探', '犯罪', '谜团', '秘密', '阴谋',
      '黑暗', '阴影', '午夜', '鬼屋', '废弃', '追踪', '逃亡', '倒计时', '危机',
      '心跳', '紧张', '不安', '诡异', '未知', '探索', '发现真相', '反转',
    ],
    suitableScenes: ['drama', 'abstract', 'interior'],
    moods: ['紧张', '不安', '神秘', '扣人心弦'],
    ttsPromptHint: 'suspenseful underscore, dissonant intervals, low frequency pulse, building tension, mysterious and uneasy',
    order: 13,
  },

  comedy: {
    id: 'comedy',
    name: '轻松幽默',
    description: '俏皮活泼的配乐，木管乐器和拨弦，适合搞笑、喜剧、轻松娱乐、萌宠内容',
    icon: '😄',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    keywords: [
      '搞笑', '喜剧', '幽默', '滑稽', '可爱', '萌宠', '宝宝', '儿童', '卡通',
      '动画', '段子', '整蛊', '恶搞', '欢乐', '有趣', '好玩', '开心', '大笑',
      '轻松愉快', '诙谐', '调皮', '呆萌', '蠢萌', '意外', '乌龙', '欢乐时光',
    ],
    suitableScenes: ['portrait', 'food', 'product'],
    moods: ['欢乐', '俏皮', '轻松愉快', '趣味十足'],
    ttsPromptHint: 'playful and whimsical music, pizzicato strings, woodwinds, lighthearted and fun, cartoonish charm',
    order: 14,
  },

  corporate: {
    id: 'corporate',
    name: '商务专业',
    description: '干净利落的商业配乐，传达信任和专业感，适合企业宣传、产品发布、商务演示',
    icon: '💼',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    keywords: [
      '商务', '企业', '公司', '团队', '办公', '会议', '发布会', '演讲', '路演',
      '创业', '融资', '上市', '合作', '签约', '握手', '成功', '增长', '数据',
      '专业', '信任', '可靠', '创新', '领导力', '愿景', '使命', '全球化',
    ],
    suitableScenes: ['product', 'interior', 'portrait'],
    moods: ['专业', '可信', '进取', '稳健'],
    ttsPromptHint: 'corporate business music, clean and confident, modern production, trustworthy and professional tone',
    order: 15,
  },

  lofi: {
    id: 'lofi',
    name: 'Lo-Fi低保真',
    description: '带颗粒感的低保真节拍，温暖怀旧，适合学习工作、Vlog旁白、日常记录',
    icon: '📻',
    color: 'text-stone-400',
    bgColor: 'bg-stone-500/10',
    borderColor: 'border-stone-500/30',
    keywords: [
      'LoFi', '低保真', '学习', '工作', '专注', 'Vlog', '日常', '宅家', '雨天',
      '窗边', '书桌', '咖啡店', '深夜', '独处', '思考', '写作', '编程', '创作',
      '怀旧', '复古感', '颗粒感', '黑胶', '磁带', '随性', 'chill', '松弛感',
    ],
    suitableScenes: ['interior', 'portrait', 'food', 'abstract'],
    moods: ['专注', '舒适', '怀旧', '松弛'],
    ttsPromptHint: 'lo-fi hip hop beats, vinyl crackle, warm analog texture, chill study vibes, nostalgic and cozy',
    order: 16,
  },

  world: {
    id: 'world',
    name: '世界风情',
    description: '各民族传统音乐元素，异域风情浓郁，适合旅行、美食探索、文化交流内容',
    icon: '🌍',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    keywords: [
      '世界音乐', '民族', '异域', '旅行', '探险', '环球', '文化', '传统', '民俗',
      '非洲鼓', '印度', '日本', '拉美', '中东', '东南亚', '丝绸之路', '古镇',
      '美食探索', '街头小吃', '市集', '节日庆典', '民族服饰', '舞蹈', '手工艺',
    ],
    suitableScenes: ['food', 'landscape', 'portrait', 'interior'],
    moods: ['多元', '热情', '异域风情', '文化丰富'],
    ttsPromptHint: 'world music fusion, ethnic instruments, global rhythms, cultural richness, exotic and vibrant',
    order: 17,
  },

  holiday: {
    id: 'holiday',
    name: '节日庆典',
    description: '喜庆热闹的节日音乐，适合圣诞、春节、婚礼、生日等庆祝场合',
    icon: '🎉',
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-500/10',
    borderColor: 'border-fuchsia-500/30',
    keywords: [
      '节日', '庆典', '圣诞', '春节', '新年', '婚礼', '生日', '派对', '狂欢',
      '烟花', '灯笼', '红包', '礼物', '祝福', '团圆', '聚会', '庆祝', '喜悦',
      '热闹', '喜庆', '欢腾', '盛典', '嘉年华', '倒计时', '跨年', '隆重',
    ],
    suitableScenes: ['product', 'food', 'portrait', 'interior'],
    moods: ['喜庆', '热闹', '欢腾', '幸福感'],
    ttsPromptHint: 'festive celebration music, joyful and uplifting, bells and brass, holiday cheer, triumphant and bright',
    order: 18,
  },

  // ===== v2.1 新增6种 =====

  chinese: {
    id: 'chinese',
    name: '国风古韵',
    description: '古筝、琵琶、笛子等中国传统乐器，融合现代编曲，适合仙侠、古风、国潮、汉服文化',
    icon: '🏮',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    keywords: [
      '国风', '古风', '仙侠', '古筝', '琵琶', '笛子', '二胡', '汉服', '国潮',
      '水墨', '青花瓷', '唐诗', '宋词', '江湖', '武侠', '修仙', '宫阙', '长安',
      '江南', '丝路', '京剧', '昆曲', '禅茶', '山水', '龙凤', '东方美学', '新中式',
    ],
    suitableScenes: ['drama', 'landscape', 'portrait', 'abstract'],
    moods: ['古韵', '仙气', '东方美', '意境深远'],
    ttsPromptHint: 'Chinese traditional instruments, guzheng pipa dizi, elegant fusion, oriental aesthetics, cinematic wuxia atmosphere',
    order: 19,
  },

  trap: {
    id: 'trap',
    name: '陷阱说唱',
    description: '重低音808鼓机和快速hi-hat，暗黑氛围说唱节拍，适合街头文化、潮牌、极限运动',
    icon: '🎤',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    keywords: [
      '说唱', 'Rap', 'Hip-Hop', '陷阱', 'Trap', '街头', '潮牌', '涂鸦', '滑板',
      '808', '低音', 'flow', 'freestyle', 'battle', '地下', '酷', '黑', '暗黑',
      'bass', '节拍', '说唱歌手', 'NBA', '球鞋', '嘻哈', 'Battle', 'Diss', 'Cypher',
    ],
    suitableScenes: ['product', 'portrait', 'abstract'],
    moods: ['酷炫', '暗黑', '力量感', '街头范'],
    ttsPromptHint: 'trap beat with heavy 808 bass, rapid hi-hats, dark atmospheric pads, hip-hop energy, street vibe',
    order: 20,
  },

  rnb: {
    id: 'rnb',
    name: 'R&B灵魂',
    description: '丝滑的R&B节奏，醇厚人声和电钢琴，适合都市夜生活、情感表达、时尚生活',
    icon: '🎙️',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    keywords: [
      'R&B', '灵魂乐', '节奏布鲁斯', '丝滑', '人声', '电钢琴', '都市', '夜晚',
      '霓虹', '约会', '情歌', '感性', '慵懒', '性感', '时尚', '格调', '摩登',
      '咖啡', '酒吧', '慢摇', '蓝调', '都市情调', 'SOUL', '深情', '吟唱', '律动',
    ],
    suitableScenes: ['portrait', 'interior', 'food', 'product'],
    moods: ['丝滑', '深情', '性感', '都市感'],
    ttsPromptHint: 'smooth R&B with silky vocals, rhodes piano, deep bass, sensual groove, modern soul rhythm',
    order: 21,
  },

  reggae: {
    id: 'reggae',
    name: '雷鬼阳光',
    description: '轻松的雷鬼节拍和off-beat吉他，加勒比海岛风情，适合海滩、度假、夏日、轻松氛围',
    icon: '🌴',
    color: 'text-lime-400',
    bgColor: 'bg-lime-500/10',
    borderColor: 'border-lime-500/30',
    keywords: [
      '雷鬼', 'Reggae', '海滩', '度假', '夏日', '阳光', '加勒比', '牙买加', '冲浪',
      '海岛', '椰树', '沙滩', '比基尼', '鸡尾酒', '潜水', '帆船', '日落', '棕榈',
      '轻松', '慢生活', '悠闲', 'Island', 'Tropical', '假期', '出海', '渔村',
    ],
    suitableScenes: ['landscape', 'food', 'portrait', 'interior'],
    moods: ['阳光', '悠闲', '轻松自在', '度假感'],
    ttsPromptHint: 'reggae rhythm with off-beat guitar, warm bass, Caribbean island vibes, sunny and laid-back groove',
    order: 22,
  },

  motivational: {
    id: 'motivational',
    name: '励志激励',
    description: '层层递进的钢琴和弦乐，从低沉到高昂的励志弧线，适合创业、奋斗、蜕变、励志故事',
    icon: '🚀',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    keywords: [
      '励志', '激励', '奋斗', '拼搏', '梦想', '逆袭', '蜕变', '成长', '突破',
      '创业', '攀登', '高峰', '超越', '不可能', '勇气', '坚持', '信念', '力量',
      '激励演讲', '成功', '胜利', '崛起', '登顶', '破茧', '涅槃', '从零到一',
    ],
    suitableScenes: ['product', 'portrait', 'drama', 'abstract'],
    moods: ['振奋', '热血', '充满希望', '力量感'],
    ttsPromptHint: 'motivational piano and strings build-up, inspiring crescendo, from quiet to powerful, triumph over adversity',
    order: 23,
  },

  retro: {
    id: 'retro',
    name: '复古怀旧',
    description: '80年代合成器波和复古迪斯科，霓虹复古美学，适合怀旧、复古风、蒸汽波、回忆杀',
    icon: '📼',
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-500/10',
    borderColor: 'border-fuchsia-500/30',
    keywords: [
      '复古', '怀旧', '80年代', '90年代', '迪斯科', '蒸汽波', 'Vaporwave', '合成器波',
      'Synthwave', '霓虹', '磁带', '胶片', '老式', '经典', '年代感', '回忆', '童年',
      '像素', '街机', '电视', '收音机', '卡带', '黑胶', '打字机', '老照片', '时光机',
    ],
    suitableScenes: ['product', 'portrait', 'abstract', 'interior'],
    moods: ['怀旧', '复古感', '梦幻', '年代感'],
    ttsPromptHint: 'retro synthwave with 80s pads, analog synths, vaporwave aesthetic, nostalgic and dreamy, neon-drenched',
    order: 24,
  },
};

// ============================================================
// 工具函数
// ============================================================

/**
 * 获取所有非'none'的BGM类型列表（按order排序）
 */
export function getBgmTypeList(): BgmTypeDefinition[] {
  return Object.values(BGM_TYPES_V2)
    .filter(t => t.id !== 'none')
    .sort((a, b) => a.order - b.order);
}

/**
 * 根据场景类型获取推荐的BGM类型（返回top N）
 *
 * 场景→BGM映射规则：
 * - product → corporate/jazz/classical/electronic/upbeat（根据产品调性）
 * - portrait → relaxed/romantic/acoustic/jazz（根据人物情绪）
 * - landscape → nature/ambient/epic/world（根据景观类型）
 * - food → relaxed/jazz/romantic/world/comedy（根据菜品风格）
 * - drama → cinematic/suspense/epic/classical（根据剧情类型）
 * - abstract → ambient/electronic/nature（根据视觉风格）
 * - interior → relaxed/jazz/corporate/lofi（根据空间功能）
 */
export function getRecommendedBgmForScene(
  sceneType: string,
  mood?: string
): BgmTypeDefinition[] {
  const sceneMapping: Record<string, BgmTypeId[]> = {
    product: ['corporate', 'jazz', 'classical', 'electronic', 'upbeat', 'epic', 'motivational', 'trap'],
    portrait: ['relaxed', 'romantic', 'acoustic', 'jazz', 'upbeat', 'cinematic', 'rnb', 'chinese'],
    landscape: ['nature', 'ambient', 'epic', 'world', 'cinematic', 'relaxed', 'chinese', 'reggae'],
    food: ['jazz', 'relaxed', 'romantic', 'world', 'comedy', 'upbeat', 'lofi', 'reggae'],
    drama: ['cinematic', 'suspense', 'epic', 'classical', 'romantic', 'ambient', 'chinese', 'motivational'],
    abstract: ['ambient', 'electronic', 'nature', 'suspense', 'classical', 'retro', 'trap'],
    interior: ['lofi', 'jazz', 'relaxed', 'corporate', 'classical', 'nature', 'rnb', 'acoustic'],
  };

  const recommendedIds = sceneMapping[sceneType] || ['relaxed', 'cinematic', 'upbeat'];
  const allTypes = getBgmTypeList();

  return recommendedIds
    .map(id => BGM_TYPES_V2[id])
    .filter(Boolean)
    .slice(0, 6);
}

/**
 * 根据提示词文本进行本地关键词匹配（无需调用AI的快速降级方案）
 */
export function matchBgmByKeywords(text: string): BgmTypeDefinition | null {
  const lowerText = text.toLowerCase();
  let bestMatch: BgmTypeDefinition | null = null;
  let bestScore = 0;

  for (const bgm of getBgmTypeList()) {
    let score = 0;
    for (const keyword of bgm.keywords) {
      if (lowerText.includes(keyword)) {
        score += keyword.length > 2 ? 2 : 1; // 长词权重更高
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = bgm;
    }
  }

  return bestMatch;
}

/**
 * 获取兼容旧版接口的简化选项列表
 * 用于需要向后兼容的场景（如 <select> option 列表）
 */
export function getBgmOptionsLegacy(): Array<{
  id: string;
  name: string;
  description: string;
  keywords: string[];
}> {
  return getBgmTypeList().map(bgm => ({
    id: bgm.id,
    name: bgm.name,
    description: bgm.description,
    keywords: bgm.keywords.slice(0, 10), // 兼容旧格式只取前10个
  }));
}
