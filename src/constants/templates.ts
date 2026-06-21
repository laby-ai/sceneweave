// 生成模板库常量

export interface GenerationTemplate {
  id: string;
  name: string;
  description: string;
  type: 'video' | 'image';
  category: string;
  promptTemplate: string;
  variables: TemplateVariable[];
  style?: string;
  mood?: string;
  filter?: string;
  colorTheme?: string;
  resolution?: string;
  aspectRatio?: string;
  duration?: string;
  quality?: string;
  tags: string[];
  isPublic: boolean;
  isOfficial?: boolean;
  usageCount: number;
  createdAt: number;
  createdBy?: string;
  previewImage?: string; // 新增：预览图片URL
}

export interface TemplateVariable {
  id: string;
  name: string;
  description?: string;
  type: 'text' | 'select' | 'number';
  defaultValue?: string;
  options?: string[];
  required: boolean;
  placeholder?: string;
}

export const TEMPLATE_CATEGORIES = [
  { id: 'all', name: '全部', icon: '✨' },
  { id: 'landscape', name: '风景', icon: '🏔️' },
  { id: 'character', name: '人物', icon: '👤' },
  { id: 'animal', name: '动物', icon: '🐾' },
  { id: 'abstract', name: '抽象', icon: '🎨' },
  { id: 'tech', name: '科技', icon: '🚀' },
  { id: 'fantasy', name: '奇幻', icon: '🧙' },
  { id: 'food', name: '美食', icon: '🍕' },
  { id: 'fashion', name: '时尚', icon: '👗' },
  { id: 'architecture', name: '建筑', icon: '🏛️' },
  { id: 'custom', name: '自定义', icon: '✏️' },
];

// 预设视频模板
export const PRESET_VIDEO_TEMPLATES: GenerationTemplate[] = [
  {
    id: 'video-sunset-beach',
    name: '日落海滩',
    description: '美丽的海边日落风景，适合放松心情',
    type: 'video',
    category: 'landscape',
    promptTemplate: '一个美丽的海边日落场景，金色的阳光洒在波光粼粼的海面上，海浪轻轻拍打着沙滩，远处有几只海鸥在飞翔。{additional_details}',
    variables: [
      {
        id: 'additional_details',
        name: '额外细节',
        type: 'text',
        required: false,
        placeholder: '添加更多细节描述...',
      },
    ],
    style: 'cinematic',
    mood: 'peaceful',
    filter: 'warm',
    colorTheme: 'sunset',
    resolution: '1080p',
    aspectRatio: '16:9',
    duration: '10',
    tags: ['海边', '日落', '风景', '放松'],
    isPublic: true,
    isOfficial: true,
    usageCount: 1256,
    createdAt: Date.now() - 86400000 * 30,
    previewImage: 'https://coze-coding-project.tos.coze.site/coze_storage_7617364981763538985/image/generate_image_bcce3236-a050-46ca-b07c-154f223cd272.jpeg?sign=1806071230-aad963689e-0-5d17be30aa80093b573b99fd3b154da05a5ec8b746d6bcb8f009409619700d24',
  },
  {
    id: 'video-cyberpunk-city',
    name: '赛博朋克都市',
    description: '未来都市夜景，霓虹灯光闪烁',
    type: 'video',
    category: 'tech',
    promptTemplate: '赛博朋克风格的未来都市夜景，高楼大厦上布满了霓虹招牌和全息投影，雨中的街道反射着五彩斑斓的灯光，飞行汽车在空中穿梭。{additional_details}',
    variables: [
      {
        id: 'additional_details',
        name: '额外细节',
        type: 'text',
        required: false,
        placeholder: '添加更多细节描述...',
      },
    ],
    style: 'cyberpunk',
    mood: 'mysterious',
    filter: 'neon',
    colorTheme: 'cool',
    resolution: '1080p',
    aspectRatio: '16:9',
    duration: '8',
    tags: ['赛博朋克', '未来', '都市', '夜景'],
    isPublic: true,
    isOfficial: true,
    usageCount: 987,
    createdAt: Date.now() - 86400000 * 25,
    previewImage: 'https://coze-coding-project.tos.coze.site/coze_storage_7617364981763538985/image/generate_image_e12d2417-be0b-4fdd-af94-655f56066d2a.jpeg?sign=1806071232-6fc5059b26-0-82ac8ddde9506848c8a1a0d52ca350ec4f738dbf9bf34b990cc1aeeab15abb42',
  },
  {
    id: 'video-cute-cat',
    name: '可爱猫咪',
    description: '可爱的猫咪在玩耍，治愈系视频',
    type: 'video',
    category: 'animal',
    promptTemplate: '一只可爱的{cat_breed}猫咪在{environment}中{activity}，毛发蓬松，眼神温柔，动作俏皮可爱。{additional_details}',
    variables: [
      {
        id: 'cat_breed',
        name: '猫咪品种',
        type: 'select',
        required: true,
        defaultValue: '橘猫',
        options: ['橘猫', '布偶猫', '英短', '美短', '暹罗猫', '缅因猫'],
      },
      {
        id: 'environment',
        name: '环境',
        type: 'select',
        required: true,
        defaultValue: '客厅',
        options: ['客厅', '花园', '阳台', '卧室', '草地'],
      },
      {
        id: 'activity',
        name: '活动',
        type: 'select',
        required: true,
        defaultValue: '玩耍',
        options: ['玩耍', '睡觉', '吃饭', '晒太阳', '追逐毛线球'],
      },
      {
        id: 'additional_details',
        name: '额外细节',
        type: 'text',
        required: false,
        placeholder: '添加更多细节描述...',
      },
    ],
    style: 'photorealistic',
    mood: 'cheerful',
    filter: 'none',
    colorTheme: 'warm',
    resolution: '720p',
    aspectRatio: '9:16',
    duration: '5',
    tags: ['猫咪', '可爱', '治愈', '宠物'],
    isPublic: true,
    isOfficial: true,
    usageCount: 2341,
    createdAt: Date.now() - 86400000 * 20,
    previewImage: 'https://coze-coding-project.tos.coze.site/coze_storage_7617364981763538985/image/generate_image_296a35d6-07f9-45a9-91bf-2fc445c78f14.jpeg?sign=1806071230-f73864ed3d-0-fb5db010365daf23b8efaae00645feec078490b0093d4ce6559d0cc1fc253ba7',
  },
  {
    id: 'video-forest-magic',
    name: '奇幻森林',
    description: '神秘的魔法森林，充满奇幻色彩',
    type: 'video',
    category: 'fantasy',
    promptTemplate: '一片神秘的魔法森林，古老的巨树上缠绕着发光的藤蔓，林间飞舞着萤火虫和小精灵，阳光透过树叶洒下斑驳的光影。{additional_details}',
    variables: [
      {
        id: 'additional_details',
        name: '额外细节',
        type: 'text',
        required: false,
        placeholder: '添加更多细节描述...',
      },
    ],
    style: 'fantasy',
    mood: 'magical',
    filter: 'fantasy',
    colorTheme: 'forest',
    resolution: '1080p',
    aspectRatio: '16:9',
    duration: '12',
    tags: ['森林', '奇幻', '魔法', '精灵'],
    isPublic: true,
    isOfficial: true,
    usageCount: 756,
    createdAt: Date.now() - 86400000 * 15,
    previewImage: 'https://coze-coding-project.tos.coze.site/coze_storage_7617364981763538985/image/generate_image_9e5c9642-cdeb-4687-bcc6-72c3c0a7ebb1.jpeg?sign=1806071229-a8ada4779f-0-55d139b82c3c370b4beb95ee0d7c7e5806b6e31fbef7333f26b2828fe3a7c32a',
  },
];

// 预设图片模板
export const PRESET_IMAGE_TEMPLATES: GenerationTemplate[] = [
  {
    id: 'image-mountain-sunrise',
    name: '山巅日出',
    description: '壮观的高山日出风景',
    type: 'image',
    category: 'landscape',
    promptTemplate: '壮观的高山日出风景，层层云海在脚下翻滚，金色的阳光从远处的山峰后面喷薄而出，照亮了连绵起伏的山峦。{additional_details}',
    variables: [
      {
        id: 'additional_details',
        name: '额外细节',
        type: 'text',
        required: false,
        placeholder: '添加更多细节描述...',
      },
    ],
    style: 'photorealistic',
    mood: 'epic',
    filter: 'none',
    colorTheme: 'warm',
    resolution: '1024x1024',
    quality: 'high',
    tags: ['山', '日出', '风景', '云海'],
    isPublic: true,
    isOfficial: true,
    usageCount: 3421,
    createdAt: Date.now() - 86400000 * 35,
  },
  {
    id: 'image-portrait-fantasy',
    name: '奇幻人像',
    description: '精美奇幻风格人物肖像',
    type: 'image',
    category: 'character',
    promptTemplate: '一幅精美的奇幻风格人物肖像，{gender}角色，{age}岁左右，{hair_color}的{hair_style}头发，{eye_color}的眼睛，穿着{clothing_style}的服装，背景是{background}。{additional_details}',
    variables: [
      {
        id: 'gender',
        name: '性别',
        type: 'select',
        required: true,
        defaultValue: '女性',
        options: ['男性', '女性', '中性'],
      },
      {
        id: 'age',
        name: '年龄',
        type: 'select',
        required: true,
        defaultValue: '25',
        options: ['18', '25', '35', '50', '神秘'],
      },
      {
        id: 'hair_color',
        name: '发色',
        type: 'select',
        required: true,
        defaultValue: '金色',
        options: ['金色', '黑色', '棕色', '红色', '蓝色', '银色', '彩虹'],
      },
      {
        id: 'hair_style',
        name: '发型',
        type: 'select',
        required: true,
        defaultValue: '长卷发',
        options: ['长卷发', '短直发', '高马尾', '辫子', '凌乱美'],
      },
      {
        id: 'eye_color',
        name: '眼睛颜色',
        type: 'select',
        required: true,
        defaultValue: '蓝色',
        options: ['蓝色', '绿色', '棕色', '紫色', '金色', '红色'],
      },
      {
        id: 'clothing_style',
        name: '服装风格',
        type: 'select',
        required: true,
        defaultValue: '中世纪',
        options: ['中世纪', '现代', '科幻', '古风', '魔法袍'],
      },
      {
        id: 'background',
        name: '背景',
        type: 'select',
        required: true,
        defaultValue: '魔法森林',
        options: ['魔法森林', '古老城堡', '星空下', '神秘花园', '未来都市'],
      },
      {
        id: 'additional_details',
        name: '额外细节',
        type: 'text',
        required: false,
        placeholder: '添加更多细节描述...',
      },
    ],
    style: 'fantasy',
    mood: 'magical',
    filter: 'fantasy',
    colorTheme: 'pastel',
    resolution: '1024x1024',
    quality: 'high',
    tags: ['人像', '奇幻', '角色', '精美'],
    isPublic: true,
    isOfficial: true,
    usageCount: 4567,
    createdAt: Date.now() - 86400000 * 40,
  },
  {
    id: 'image-food-photography',
    name: '美食摄影',
    description: '诱人的美食图片，专业摄影风格',
    type: 'image',
    category: 'food',
    promptTemplate: '一张专业美食摄影照片，{dish}放在{tableware}中，摆放在{background}背景上，{lighting}光线，食物看起来新鲜诱人，色彩鲜艳，细节清晰。{additional_details}',
    variables: [
      {
        id: 'dish',
        name: '菜品',
        type: 'text',
        required: true,
        placeholder: '例如：意大利面、寿司、蛋糕...',
      },
      {
        id: 'tableware',
        name: '餐具',
        type: 'select',
        required: true,
        defaultValue: '白瓷盘',
        options: ['白瓷盘', '木盘', '石板', '碗', '高端餐具'],
      },
      {
        id: 'background',
        name: '背景',
        type: 'select',
        required: true,
        defaultValue: '木质桌面',
        options: ['木质桌面', '大理石', '深色背景', '清新绿植', '复古桌布'],
      },
      {
        id: 'lighting',
        name: '光线',
        type: 'select',
        required: true,
        defaultValue: '自然光',
        options: ['自然光', '暖光', '柔光', ' dramatic', '窗边光'],
      },
      {
        id: 'additional_details',
        name: '额外细节',
        type: 'text',
        required: false,
        placeholder: '添加更多细节描述...',
      },
    ],
    style: 'photorealistic',
    mood: 'appetizing',
    filter: 'vibrant',
    colorTheme: 'warm',
    resolution: '1024x1024',
    quality: 'high',
    tags: ['美食', '摄影', '诱人', '专业'],
    isPublic: true,
    isOfficial: true,
    usageCount: 2890,
    createdAt: Date.now() - 86400000 * 28,
  },
  {
    id: 'image-abstract-art',
    name: '抽象艺术',
    description: '现代抽象艺术作品',
    type: 'image',
    category: 'abstract',
    promptTemplate: '一幅现代抽象艺术作品，{style}风格，主要颜色是{colors}，画面充满{feeling}，艺术感强，适合作为装饰画。{additional_details}',
    variables: [
      {
        id: 'style',
        name: '艺术风格',
        type: 'select',
        required: true,
        defaultValue: '几何抽象',
        options: ['几何抽象', '泼墨艺术', '流体画', '极简主义', '波普艺术'],
      },
      {
        id: 'colors',
        name: '主色调',
        type: 'select',
        required: true,
        defaultValue: '蓝紫色',
        options: ['蓝紫色', '暖色调', '黑白灰', '彩虹色', '大地色'],
      },
      {
        id: 'feeling',
        name: '感觉',
        type: 'select',
        required: true,
        defaultValue: '动感',
        options: ['动感', '宁静', '热情', '神秘', '欢乐'],
      },
      {
        id: 'additional_details',
        name: '额外细节',
        type: 'text',
        required: false,
        placeholder: '添加更多细节描述...',
      },
    ],
    style: 'none',
    mood: 'artistic',
    filter: 'none',
    colorTheme: 'vibrant',
    resolution: '1024x1024',
    quality: 'standard',
    tags: ['抽象', '艺术', '现代', '装饰'],
    isPublic: true,
    isOfficial: true,
    usageCount: 1567,
    createdAt: Date.now() - 86400000 * 22,
  },
];

// 获取所有预设模板
export const ALL_PRESET_TEMPLATES = [
  ...PRESET_VIDEO_TEMPLATES,
  ...PRESET_IMAGE_TEMPLATES,
];

// 模板分类图标映射
export const CATEGORY_ICONS: Record<string, string> = {
  landscape: '🏔️',
  character: '👤',
  animal: '🐾',
  abstract: '🎨',
  tech: '🚀',
  fantasy: '🧙',
  food: '🍕',
  fashion: '👗',
  architecture: '🏛️',
  custom: '✏️',
};
