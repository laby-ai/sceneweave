'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: number;
  likes: number;
  isLiked: boolean;
}

export interface CommunityPost {
  id: string;
  type: 'video' | 'image';
  title: string;
  description: string;
  mediaUrl: string;
  imageUrls?: string[];
  prompt: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  tags: string[];
  category: string;
  likes: number;
  isLiked: boolean;
  shares: number;
  comments: number;
  createdAt: number;
  isPublic: boolean;
}

interface CommunityContextType {
  posts: CommunityPost[];
  comments: Comment[];
  addPost: (post: Omit<CommunityPost, 'id' | 'createdAt' | 'likes' | 'isLiked' | 'shares' | 'comments'>) => CommunityPost;
  updatePost: (id: string, updates: Partial<CommunityPost>) => void;
  deletePost: (id: string) => void;
  getPostById: (id: string) => CommunityPost | undefined;
  toggleLike: (id: string) => void;
  incrementShare: (id: string) => void;
  getPostsByType: (type: 'video' | 'image') => CommunityPost[];
  getPostsByAuthor: (authorId: string) => CommunityPost[];
  searchPosts: (query: string) => CommunityPost[];
  addComment: (postId: string, content: string, authorId: string, authorName: string, authorAvatar?: string) => Comment;
  getCommentsByPost: (postId: string) => Comment[];
  deleteComment: (commentId: string) => void;
  toggleCommentLike: (commentId: string) => void;
}

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);

// 模拟一些社区帖子数据
const mockPosts: CommunityPost[] = [
  {
    id: 'post-1',
    type: 'video',
    title: '日落海滩',
    description: '一个美丽的日落海滩场景，海浪轻轻拍打着沙滩',
    mediaUrl: 'https://picsum.photos/seed/sunset/800/450',
    prompt: '一个美丽的日落海滩场景，海浪轻轻拍打着沙滩，天空呈现出橙红色和紫色的渐变',
    authorId: 'user-1',
    authorName: '创意达人',
    authorAvatar: 'https://picsum.photos/seed/avatar1/100/100',
    tags: ['风景', '日落', '海滩'],
    category: '风景',
    likes: 128,
    isLiked: false,
    shares: 24,
    comments: 16,
    createdAt: Date.now() - 3600000,
    isPublic: true,
  },
  {
    id: 'post-2',
    type: 'image',
    title: '未来城市',
    description: '科幻风格的未来城市景观',
    mediaUrl: 'https://picsum.photos/seed/city/800/800',
    imageUrls: ['https://picsum.photos/seed/city1/800/800', 'https://picsum.photos/seed/city2/800/800'],
    prompt: '一个充满未来感的科幻城市，高楼大厦林立，飞行器在空中穿梭，霓虹灯闪烁',
    authorId: 'user-2',
    authorName: '未来主义者',
    authorAvatar: 'https://picsum.photos/seed/avatar2/100/100',
    tags: ['科幻', '城市', '未来'],
    category: '科幻',
    likes: 256,
    isLiked: false,
    shares: 48,
    comments: 32,
    createdAt: Date.now() - 7200000,
    isPublic: true,
  },
  {
    id: 'post-3',
    type: 'video',
    title: '森林小溪',
    description: '宁静的森林小溪风景',
    mediaUrl: 'https://picsum.photos/seed/forest/800/450',
    prompt: '一个宁静的森林小溪场景，清澈的溪水在石头间流淌，阳光透过树叶洒下斑驳的光影',
    authorId: 'user-3',
    authorName: '自然爱好者',
    authorAvatar: 'https://picsum.photos/seed/avatar3/100/100',
    tags: ['自然', '森林', '小溪'],
    category: '风景',
    likes: 89,
    isLiked: false,
    shares: 15,
    comments: 8,
    createdAt: Date.now() - 10800000,
    isPublic: true,
  },
  {
    id: 'post-4',
    type: 'image',
    title: '星空山脉',
    description: '壮观的星空下的山脉',
    mediaUrl: 'https://picsum.photos/seed/stars/800/800',
    imageUrls: ['https://picsum.photos/seed/stars1/800/800'],
    prompt: '在璀璨的星空下，连绵的山脉呈现出神秘的剪影，银河横跨天际',
    authorId: 'user-4',
    authorName: '星空探索者',
    authorAvatar: 'https://picsum.photos/seed/avatar4/100/100',
    tags: ['星空', '山脉', '夜景'],
    category: '风景',
    likes: 312,
    isLiked: false,
    shares: 62,
    comments: 45,
    createdAt: Date.now() - 14400000,
    isPublic: true,
  },
];

export function CommunityProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  // 从 localStorage 加载社区帖子
  useEffect(() => {
    const savedPosts = localStorage.getItem('community-posts');
    if (savedPosts) {
      try {
        setPosts(JSON.parse(savedPosts));
      } catch (error) {
        console.error('Failed to parse community posts:', error);
        // 如果解析失败，使用模拟数据
        setPosts(mockPosts);
      }
    } else {
      // 如果没有保存的数据，使用模拟数据
      setPosts(mockPosts);
    }
  }, []);

  // 保存社区帖子到 localStorage
  useEffect(() => {
    if (posts.length > 0) {
      localStorage.setItem('community-posts', JSON.stringify(posts));
    }
  }, [posts]);

  const addPost = (post: Omit<CommunityPost, 'id' | 'createdAt' | 'likes' | 'isLiked' | 'shares' | 'comments'>): CommunityPost => {
    const newPost: CommunityPost = {
      ...post,
      id: `post-${Date.now()}`,
      createdAt: Date.now(),
      likes: 0,
      isLiked: false,
      shares: 0,
      comments: 0,
    };
    setPosts(prev => [newPost, ...prev]);
    return newPost;
  };

  const updatePost = (id: string, updates: Partial<CommunityPost>) => {
    setPosts(prev => prev.map(post => 
      post.id === id ? { ...post, ...updates } : post
    ));
  };

  const deletePost = (id: string) => {
    setPosts(prev => prev.filter(post => post.id !== id));
  };

  const getPostById = (id: string): CommunityPost | undefined => {
    return posts.find(post => post.id === id);
  };

  const toggleLike = (id: string) => {
    setPosts(prev => prev.map(post => {
      if (post.id === id) {
        return {
          ...post,
          isLiked: !post.isLiked,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1,
        };
      }
      return post;
    }));
  };

  const incrementShare = (id: string) => {
    setPosts(prev => prev.map(post => 
      post.id === id ? { ...post, shares: post.shares + 1 } : post
    ));
  };

  const getPostsByType = (type: 'video' | 'image'): CommunityPost[] => {
    return posts.filter(post => post.type === type);
  };

  const getPostsByAuthor = (authorId: string): CommunityPost[] => {
    return posts.filter(post => post.authorId === authorId);
  };

  const searchPosts = (query: string): CommunityPost[] => {
    const lowerQuery = query.toLowerCase();
    return posts.filter(post => 
      post.title.toLowerCase().includes(lowerQuery) ||
      post.description.toLowerCase().includes(lowerQuery) ||
      post.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  };

  const addComment = (postId: string, content: string, authorId: string, authorName: string, authorAvatar?: string): Comment => {
    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      postId,
      authorId,
      authorName,
      authorAvatar,
      content,
      createdAt: Date.now(),
      likes: 0,
      isLiked: false,
    };
    setComments(prev => [newComment, ...prev]);
    
    // 更新帖子的评论数
    setPosts(prev => prev.map(post => 
      post.id === postId ? { ...post, comments: post.comments + 1 } : post
    ));
    
    return newComment;
  };

  const getCommentsByPost = (postId: string): Comment[] => {
    return comments.filter(comment => comment.postId === postId);
  };

  const deleteComment = (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      setComments(prev => prev.filter(c => c.id !== commentId));
      // 更新帖子的评论数
      setPosts(prev => prev.map(post => 
        post.id === comment.postId ? { ...post, comments: Math.max(0, post.comments - 1) } : post
      ));
    }
  };

  const toggleCommentLike = (commentId: string) => {
    setComments(prev => prev.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          isLiked: !comment.isLiked,
          likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1,
        };
      }
      return comment;
    }));
  };

  return (
    <CommunityContext.Provider value={{
      posts,
      comments,
      addPost,
      updatePost,
      deletePost,
      getPostById,
      toggleLike,
      incrementShare,
      getPostsByType,
      getPostsByAuthor,
      searchPosts,
      addComment,
      getCommentsByPost,
      deleteComment,
      toggleCommentLike,
    }}>
      {children}
    </CommunityContext.Provider>
  );
}

export function useCommunity() {
  const context = useContext(CommunityContext);
  if (context === undefined) {
    throw new Error('useCommunity must be used within a CommunityProvider');
  }
  return context;
}
