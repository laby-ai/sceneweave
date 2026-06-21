// 视频推荐风格
export interface VideoStyle {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: 'lifestyle' | 'cinematic' | 'creative' | 'professional';
  stylePrompt: string;
  moodPrompt?: string;
  duration?: string;
  ratio?: string;
}

// 预设的视频风格缩略图（使用可访问的图片）
const STYLE_THUMBNAILS = {
  vlog: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300&h=300&fit=crop',
  cinematic: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=300&h=300&fit=crop',
  travel: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=300&h=300&fit=crop',
  product: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
  educational: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=300&h=300&fit=crop',
  cinematic_trailer: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300&h=300&fit=crop',
  artistic: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=300&h=300&fit=crop',
  nostalgic: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=300&h=300&fit=crop',
  futuristic: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300&h=300&fit=crop',
  nature: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=300&fit=crop',
  social_media: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=300&h=300&fit=crop',
  documentary: 'https://images.unsplash.com/photo-1482517967863-00e15c9b44be?w=300&h=300&fit=crop',
};

// 视频推荐风格列表
export const VIDEO_STYLES: VideoStyle[] = [
  {
    id: 'vlog',
    name: 'Vlog 日常',
    description: '轻松自然的日常记录风格，适合个人分享',
    thumbnail: STYLE_THUMBNAILS.vlog,
    category: 'lifestyle',
    stylePrompt: 'vlog风格，手持拍摄感，自然光，真实自然，生活化',
    duration: '10',
    ratio: '16:9',
  },
  {
    id: 'cinematic',
    name: '电影大片',
    description: '专业电影质感，宽屏构图，光影丰富',
    thumbnail: STYLE_THUMBNAILS.cinematic,
    category: 'cinematic',
    stylePrompt: '电影大片风格，专业电影级光影，宽屏构图，2.35:1宽画幅，电影色调，杜比视界',
    moodPrompt: '史诗感，宏大叙事，震撼视觉',
    duration: '15',
    ratio: '16:9',
  },
  {
    id: 'travel',
    name: '旅行风光',
    description: '壮丽风景，旅行记录，探索发现',
    thumbnail: STYLE_THUMBNAILS.travel,
    category: 'lifestyle',
    stylePrompt: '旅行风光，无人机航拍，超广角镜头，壮丽风景，自然光线',
    moodPrompt: '探索发现，自由冒险，心旷神怡',
    duration: '12',
    ratio: '16:9',
  },
  {
    id: 'product',
    name: '产品展示',
    description: '专业产品展示，商业广告风格',
    thumbnail: STYLE_THUMBNAILS.product,
    category: 'professional',
    stylePrompt: '产品展示，商业广告，专业布光，特写镜头，精致细节，高品质渲染',
    duration: '8',
    ratio: '16:9',
  },
  {
    id: 'educational',
    name: '知识教学',
    description: '清晰易懂，知识传授，教学风格',
    thumbnail: STYLE_THUMBNAILS.educational,
    category: 'professional',
    stylePrompt: '知识教学，清晰明亮，构图稳定，信息图表，文字清晰',
    moodPrompt: '专业权威，清晰易懂，启发思考',
    duration: '15',
    ratio: '16:9',
  },
  {
    id: 'cinematic_trailer',
    name: '预告片风格',
    description: '节奏紧凑，悬念迭起，震撼开场',
    thumbnail: STYLE_THUMBNAILS.cinematic_trailer,
    category: 'cinematic',
    stylePrompt: '电影预告片，快节奏剪辑，震撼音效，视觉冲击， dramatic',
    moodPrompt: '紧张刺激，悬念迭起，期待感',
    duration: '10',
    ratio: '16:9',
  },
  {
    id: 'artistic',
    name: '艺术创意',
    description: '独特艺术风格，创意表达',
    thumbnail: STYLE_THUMBNAILS.artistic,
    category: 'creative',
    stylePrompt: '艺术创意，实验性视觉，独特风格，抽象表现，艺术滤镜',
    moodPrompt: '奇幻想象，艺术表达，自由创作',
    duration: '10',
    ratio: '1:1',
  },
  {
    id: 'nostalgic',
    name: '复古怀旧',
    description: '怀旧复古，胶片质感，温暖回忆',
    thumbnail: STYLE_THUMBNAILS.nostalgic,
    category: 'creative',
    stylePrompt: '复古怀旧，8mm胶片质感，颗粒感，暖色调，老式电影',
    moodPrompt: '温馨回忆，怀旧感伤，岁月感',
    duration: '10',
    ratio: '16:9',
  },
  {
    id: 'futuristic',
    name: '科幻未来',
    description: '未来科技，赛博朋克，现代感',
    thumbnail: STYLE_THUMBNAILS.futuristic,
    category: 'creative',
    stylePrompt: '科幻未来，赛博朋克，霓虹灯光，未来都市，科技感，全息投影',
    moodPrompt: '未来感，科技前沿，创新突破',
    duration: '12',
    ratio: '16:9',
  },
  {
    id: 'nature',
    name: '自然纪录片',
    description: '自然生态，动物植物，宏观微观',
    thumbnail: STYLE_THUMBNAILS.nature,
    category: 'professional',
    stylePrompt: '自然纪录片，4K画质，微距镜头，野生动物，自然风光，BBC风格',
    moodPrompt: '宁静自然，生命奇迹，震撼敬畏',
    duration: '20',
    ratio: '16:9',
  },
  {
    id: 'social_media',
    name: '社交媒体',
    description: '快节奏，适合短视频平台',
    thumbnail: STYLE_THUMBNAILS.social_media,
    category: 'lifestyle',
    stylePrompt: '社交媒体风格，竖屏视频，快节奏剪辑，热门音乐，潮流滤镜',
    duration: '5',
    ratio: '9:16',
  },
  {
    id: 'documentary',
    name: '纪实访谈',
    description: '真实记录，访谈对话，深度内容',
    thumbnail: STYLE_THUMBNAILS.documentary,
    category: 'professional',
    stylePrompt: '纪实访谈，真实记录，手持拍摄，自然光，采访镜头，深度内容',
    moodPrompt: '真实可信，深度思考，人文关怀',
    duration: '15',
    ratio: '16:9',
  },
];

// 根据ID获取视频风格
export function getVideoStyleById(id: string): VideoStyle | undefined {
  return VIDEO_STYLES.find(style => style.id === id);
}

// 根据分类获取视频风格
export function getVideoStylesByCategory(category: VideoStyle['category']): VideoStyle[] {
  return VIDEO_STYLES.filter(style => style.category === category);
}

// 获取所有分类
export const VIDEO_STYLE_CATEGORIES = [
  { id: 'lifestyle', name: '生活方式' },
  { id: 'cinematic', name: '电影大片' },
  { id: 'creative', name: '创意艺术' },
  { id: 'professional', name: '专业商务' },
];
