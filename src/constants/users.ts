// 用户和社交系统常量

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  bio?: string;
  displayName?: string;
  followers: number;
  following: number;
  likes: number;
  works: number;
  createdAt: number;
  isVerified?: boolean;
}

export interface Friend {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  status: 'pending' | 'accepted' | 'rejected';
  direction: 'incoming' | 'outgoing';
  createdAt: number;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  content: string;
  createdAt: number;
  likes: number;
  replies?: Comment[];
}

export interface Work {
  id: string;
  userId: string;
  username: string;
  type: 'video' | 'image';
  title: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  prompt: string;
  isPublic: boolean;
  likes: number;
  comments: Comment[];
  views: number;
  shares: number;
  createdAt: number;
  style?: string;
  mood?: string;
  tags: string[];
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'system';
  fromUserId?: string;
  fromUsername?: string;
  fromAvatar?: string;
  content: string;
  workId?: string;
  read: boolean;
  createdAt: number;
}

export const MOCK_USERS: UserProfile[] = [
  {
    id: 'user-1',
    username: 'creative_artist',
    email: 'artist@example.com',
    displayName: '创意艺术家',
    bio: '热爱AI艺术创作，分享我的作品和灵感 ✨',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    followers: 1234,
    following: 567,
    likes: 8901,
    works: 45,
    createdAt: Date.now() - 86400000 * 180,
    isVerified: true,
  },
  {
    id: 'user-2',
    username: 'tech_guru',
    email: 'tech@example.com',
    displayName: '科技达人',
    bio: '探索AI技术的无限可能 🚀',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    followers: 892,
    following: 234,
    likes: 5678,
    works: 23,
    createdAt: Date.now() - 86400000 * 120,
  },
  {
    id: 'user-3',
    username: 'nature_lover',
    email: 'nature@example.com',
    displayName: '自然爱好者',
    bio: '用AI记录大自然的美丽 🌿',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lily',
    followers: 567,
    following: 123,
    likes: 3456,
    works: 67,
    createdAt: Date.now() - 86400000 * 90,
  },
  {
    id: 'user-4',
    username: 'fantasy_world',
    email: 'fantasy@example.com',
    displayName: '幻想世界',
    bio: '创造奇幻的视觉世界 🧙‍♂️',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    followers: 2345,
    following: 456,
    likes: 12345,
    works: 89,
    createdAt: Date.now() - 86400000 * 150,
    isVerified: true,
  },
];

export const MOCK_FRIENDS: Friend[] = [
  {
    id: 'friend-1',
    username: 'creative_artist',
    displayName: '创意艺术家',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    status: 'accepted',
    direction: 'incoming',
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'friend-2',
    username: 'tech_guru',
    displayName: '科技达人',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    status: 'pending',
    direction: 'outgoing',
    createdAt: Date.now() - 86400000 * 2,
  },
];

export const MOCK_WORKS: Work[] = [
  {
    id: 'work-1',
    userId: 'user-1',
    username: 'creative_artist',
    type: 'image',
    title: '星夜梦境',
    description: '一个梦幻的星空场景，繁星点点',
    url: 'https://picsum.photos/seed/work1/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/work1/400/300',
    prompt: '梦幻的星空，繁星点点，银河横跨天空',
    isPublic: true,
    likes: 234,
    comments: [
      {
        id: 'comment-1',
        userId: 'user-2',
        username: 'tech_guru',
        content: '太美了！星空的效果很震撼 🌟',
        createdAt: Date.now() - 86400000,
        likes: 45,
      },
    ],
    views: 1234,
    shares: 56,
    createdAt: Date.now() - 86400000 * 7,
    style: 'fantasy',
    mood: 'magical',
    tags: ['星空', '梦幻', '夜景'],
  },
  {
    id: 'work-2',
    userId: 'user-1',
    username: 'creative_artist',
    type: 'video',
    title: '海浪轻拍',
    description: '海边日落的美丽视频',
    url: 'https://picsum.photos/seed/work2/800/450',
    thumbnailUrl: 'https://picsum.photos/seed/work2/400/225',
    prompt: '海边日落，海浪轻轻拍打着沙滩',
    isPublic: true,
    likes: 156,
    comments: [],
    views: 892,
    shares: 34,
    createdAt: Date.now() - 86400000 * 5,
    style: 'cinematic',
    mood: 'peaceful',
    tags: ['海边', '日落', '自然'],
  },
  {
    id: 'work-3',
    userId: 'user-2',
    username: 'tech_guru',
    type: 'image',
    title: '未来都市',
    description: '赛博朋克风格的未来城市',
    url: 'https://picsum.photos/seed/work3/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/work3/400/300',
    prompt: '赛博朋克风格的未来都市，霓虹灯光',
    isPublic: true,
    likes: 456,
    comments: [
      {
        id: 'comment-2',
        userId: 'user-1',
        username: 'creative_artist',
        content: '科技感十足！配色很炫酷 🚀',
        createdAt: Date.now() - 86400000 * 2,
        likes: 78,
      },
    ],
    views: 2345,
    shares: 89,
    createdAt: Date.now() - 86400000 * 10,
    style: 'cyberpunk',
    mood: 'futuristic',
    tags: ['赛博朋克', '未来', '都市'],
  },
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-1',
    type: 'like',
    fromUserId: 'user-2',
    fromUsername: '科技达人',
    fromAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    content: '喜欢了你的作品「星夜梦境」',
    workId: 'work-1',
    read: false,
    createdAt: Date.now() - 3600000,
  },
  {
    id: 'notif-2',
    type: 'comment',
    fromUserId: 'user-3',
    fromUsername: '自然爱好者',
    fromAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lily',
    content: '评论了你的作品「海浪轻拍」',
    workId: 'work-2',
    read: false,
    createdAt: Date.now() - 7200000,
  },
  {
    id: 'notif-3',
    type: 'follow',
    fromUserId: 'user-4',
    fromUsername: '幻想世界',
    fromAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    content: '开始关注你',
    read: true,
    createdAt: Date.now() - 86400000,
  },
];

// 作品可见性选项
export const WORK_VISIBILITY = [
  { value: 'public', label: '公开', icon: '🌍', description: '所有人可见' },
  { value: 'followers', label: '仅粉丝', icon: '👥', description: '仅关注者可见' },
  { value: 'private', label: '私密', icon: '🔒', description: '仅自己可见' },
];
