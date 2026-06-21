'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Search, Heart, Share2, MessageSquare,
  TrendingUp, Clock, Users, Filter, Plus,
  Video, Image as ImageIcon, X, Send
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useCommunity } from '@/contexts/CommunityContext';
import { useAuth } from '@/contexts/AuthContext';
import { CommunityPost } from '@/contexts/CommunityContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface PostCardProps {
  post: CommunityPost;
  onLike: (postId: string) => void;
  onShare: (postId: string) => void;
  onComment: (post: CommunityPost) => void;
  formatDate: (timestamp: number) => string;
}

function PostCard({ post, onLike, onShare, onComment, formatDate }: PostCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardContent className="p-0">
        {/* Media */}
        <div className="relative aspect-video bg-black">
          {post.type === 'video' ? (
            <video
              src={post.mediaUrl}
              className="w-full h-full object-cover"
              controls
            />
          ) : (
            <img
              src={post.mediaUrl}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute top-3 left-3">
            <Badge variant="secondary" className="bg-black/50 text-white border-0">
              {post.type === 'video' ? (
                <Video className="w-3 h-3 mr-1" />
              ) : (
                <ImageIcon className="w-3 h-3 mr-1" />
              )}
              {post.type === 'video' ? '视频' : '图片'}
            </Badge>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Author */}
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.authorAvatar} />
              <AvatarFallback>
                {post.authorName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{post.authorName}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(post.createdAt)}
              </p>
            </div>
          </div>

          {/* Title and Description */}
          <div>
            <h3 className="font-semibold mb-1 line-clamp-2">{post.title}</h3>
            {post.description && (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {post.description}
              </p>
            )}
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onLike(post.id)}
                className={`flex items-center gap-1 ${post.isLiked ? 'text-red-500' : ''}`}
              >
                <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-current' : ''}`} />
                <span className="text-sm">{post.likes}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onComment(post)}
                className="flex items-center gap-1"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm">{post.comments}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onShare(post.id)}
                className="flex items-center gap-1"
              >
                <Share2 className="w-4 h-4" />
                <span className="text-sm">{post.shares}</span>
              </Button>
            </div>
            <Badge variant="outline" className="text-xs">
              {post.category}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SocialPage() {
  const router = useRouter();
  const { themeGradient } = useTheme();
  const { posts, toggleLike, incrementShare, searchPosts, getPostsByType, addComment, getCommentsByPost } = useCommunity();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'recent'>('popular');
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [commentContent, setCommentContent] = useState('');

  const filteredPosts = searchQuery 
    ? searchPosts(searchQuery)
    : activeTab === 'all' 
      ? posts 
      : getPostsByType(activeTab as 'video' | 'image');

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortBy === 'popular') {
      return b.likes - a.likes;
    } else {
      return b.createdAt - a.createdAt;
    }
  });

  const handleLike = (postId: string) => {
    toggleLike(postId);
  };

  const handleShare = (postId: string) => {
    incrementShare(postId);
    alert('分享成功！');
  };

  const handleOpenComments = (post: CommunityPost) => {
    setSelectedPost(post);
    setCommentContent('');
    setShowCommentDialog(true);
  };

  const handleSubmitComment = () => {
    if (!selectedPost || !commentContent.trim()) return;
    
    addComment(
      selectedPost.id,
      commentContent,
      user?.id || 'anonymous',
      user?.username || '匿名用户',
      user?.avatar
    );
    
    setShowCommentDialog(false);
    setCommentContent('');
    setSelectedPost(null);
    alert('评论成功！');
  };

  const formatDate = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    
    return new Date(timestamp).toLocaleDateString();
  };

  const postComments = selectedPost ? getCommentsByPost(selectedPost.id) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-xl border-b shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 bg-gradient-to-br ${themeGradient} rounded-xl shadow-lg`}>
                <Users className="w-6 h-6 text-white fill-current" />
              </div>
              <div>
                <h1 className={`text-xl font-bold bg-gradient-to-r ${themeGradient} bg-clip-text text-transparent`}>
                  社区中心
                </h1>
                <p className="text-xs text-muted-foreground">发现精彩作品，分享创意灵感</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => router.push('/')}
                className="flex items-center gap-2"
              >
                返回创作中心
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="搜索作品、作者或标签..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={sortBy === 'popular' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setSortBy('popular')}
              className="flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              热门
            </Button>
            <Button
              variant={sortBy === 'recent' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setSortBy('recent')}
              className="flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              最新
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8 bg-white/50 backdrop-blur-sm p-1 rounded-xl shadow-sm">
            <TabsTrigger value="all" className="flex items-center gap-2">
              全部
              <Badge variant="secondary" className="ml-1">{posts.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              视频
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              图片
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={handleLike}
                  onShare={handleShare}
                  onComment={handleOpenComments}
                  formatDate={formatDate}
                />
              ))}
            </div>
            {sortedPosts.length === 0 && (
              <div className="text-center py-16">
                <div className="text-muted-foreground mb-4">
                  <Filter className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">没有找到相关作品</p>
                  <p className="text-sm">尝试其他搜索词或浏览全部作品</p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="video" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={handleLike}
                  onShare={handleShare}
                  onComment={handleOpenComments}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="image" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={handleLike}
                  onShare={handleShare}
                  onComment={handleOpenComments}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 评论对话框 */}
      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>评论</DialogTitle>
            <DialogDescription>
              对作品发表你的看法
            </DialogDescription>
          </DialogHeader>
          
          {selectedPost && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="font-medium text-sm">{selectedPost.title}</p>
            </div>
          )}
          
          {/* 现有评论列表 */}
          {postComments.length > 0 && (
            <div className="space-y-3 max-h-[200px] overflow-y-auto mb-4">
              {postComments.map((comment) => (
                <div key={comment.id} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={comment.authorAvatar} />
                      <AvatarFallback>
                        {comment.authorName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{comment.authorName}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{comment.content}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        // 评论点赞功能
                      }}
                    >
                      <Heart className={`w-3 h-3 mr-1 ${comment.isLiked ? 'fill-current text-red-500' : ''}`} />
                      {comment.likes}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="comment-content">你的评论</Label>
              <Textarea
                id="comment-content"
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="写下你的评论..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCommentDialog(false)}>
              取消
            </Button>
            <Button 
              onClick={handleSubmitComment} 
              disabled={!commentContent.trim()}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              发表评论
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
