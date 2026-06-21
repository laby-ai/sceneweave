export interface AvatarModel {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: string;
  isPremium?: boolean;
  isCustom?: boolean;
  customImageUrl?: string;
}

export interface AvatarGenerationRequest {
  modelId: string;
  text: string;
  voiceType: string;
  background?: string;
  resolution?: '720p' | '1080p' | '4k';
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface AvatarGenerationResponse {
  success: boolean;
  taskId?: string;
  videoUrl?: string;
  message?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
}

export interface VoiceOption {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female';
  sampleUrl?: string;
}

export interface BackgroundOption {
  id: string;
  name: string;
  thumbnail: string;
  type: 'image' | 'video' | 'color';
  value: string;
}

export const AVATAR_MODELS: AvatarModel[] = [
  {
    id: 'professional-female-1',
    name: '专业女主播',
    description: '优雅专业的商务形象，适合企业宣传和产品介绍',
    thumbnail: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop',
    category: 'professional'
  },
  {
    id: 'professional-male-1',
    name: '专业男主播',
    description: '沉稳专业的商务形象，适合新闻播报和知识分享',
    thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    category: 'professional'
  },
  {
    id: 'friendly-female-1',
    name: '亲切小姐姐',
    description: '甜美亲切的形象，适合美妆、生活类内容',
    thumbnail: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    category: 'lifestyle'
  },
  {
    id: 'casual-male-1',
    name: '阳光小哥哥',
    description: '阳光活力的形象，适合游戏、科技类内容',
    thumbnail: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    category: 'lifestyle'
  },
  {
    id: 'teacher-female-1',
    name: '温柔老师',
    description: '知性优雅的形象，适合教育和培训内容',
    thumbnail: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
    category: 'education'
  },
  {
    id: 'anchor-male-1',
    name: '新闻主播',
    description: '正式专业的形象，适合新闻和资讯播报',
    thumbnail: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop',
    category: 'news'
  }
];

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'zh-female-1', name: '温柔女声', language: 'zh-CN', gender: 'female' },
  { id: 'zh-female-2', name: '甜美女声', language: 'zh-CN', gender: 'female' },
  { id: 'zh-male-1', name: '沉稳男声', language: 'zh-CN', gender: 'male' },
  { id: 'zh-male-2', name: '磁性男声', language: 'zh-CN', gender: 'male' },
  { id: 'en-female-1', name: 'English Female', language: 'en-US', gender: 'female' },
  { id: 'en-male-1', name: 'English Male', language: 'en-US', gender: 'male' }
];

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  { id: 'none', name: '透明背景', thumbnail: '', type: 'color', value: 'transparent' },
  { id: 'office', name: '现代办公室', thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&h=150&fit=crop', type: 'image', value: 'office' },
  { id: 'studio', name: '专业演播室', thumbnail: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200&h=150&fit=crop', type: 'image', value: 'studio' },
  { id: 'nature', name: '自然风景', thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=150&fit=crop', type: 'image', value: 'nature' },
  { id: 'gradient-blue', name: '蓝色渐变', thumbnail: '', type: 'color', value: '#1e3a5f' },
  { id: 'gradient-purple', name: '紫色渐变', thumbnail: '', type: 'color', value: '#4a1d96' }
];

// 自定义数字人形象
export interface CustomAvatar {
  id: string;
  name: string;
  imageUrl: string;
  createdAt: number;
  description?: string;
}

// 存储键名
export const CUSTOM_AVATARS_STORAGE_KEY = 'custom_avatars';
