'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  User, Settings, Palette, History, Image as ImageIcon, 
  Video, Download, Share2, ArrowLeft, Clock, Edit3, Trash2
} from 'lucide-react';
import { ProfileSettings } from '@/components/profile-settings';
import { ImageEditor } from '@/components/image-editor';
import { VideoEditor } from '@/components/video-editor';
import { useAuth } from '@/contexts/AuthContext';
import { useVideoHistory } from '@/hooks/useVideoHistory';
import { useRouter } from 'next/navigation';

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { videoHistory, imageHistory } = useVideoHistory();
  const [activeTab, setActiveTab] = useState('overview');
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [initialMediaUrl, setInitialMediaUrl] = useState<string | null>(null);

  // 处理 URL 参数，直接打开编辑器
  useEffect(() => {
    const editParam = searchParams.get('edit');
    const urlParam = searchParams.get('url');
    
    if (editParam === 'video') {
      setShowVideoEditor(true);
      if (urlParam) {
        setInitialMediaUrl(decodeURIComponent(urlParam));
      }
      // 清除 URL 参数
      router.replace('/profile', { scroll: false });
    } else if (editParam === 'image') {
      setShowImageEditor(true);
      if (urlParam) {
        setInitialMediaUrl(decodeURIComponent(urlParam));
      }
      // 清除 URL 参数
      router.replace('/profile', { scroll: false });
    }
  }, [searchParams, router]);

  const stats = {
    totalVideos: videoHistory.length,
    totalImages: imageHistory.length,
    totalCreations: videoHistory.length + imageHistory.length,
    thisWeek: Math.floor((videoHistory.length + imageHistory.length) * 0.3),
  };

  const handleEditVideoFromHistory = (videoUrl: string | undefined) => {
    if (videoUrl) {
      setInitialMediaUrl(videoUrl);
      setShowVideoEditor(true);
    }
  };

  const handleEditImageFromHistory = (imageUrl: string | undefined) => {
    if (imageUrl) {
      setInitialMediaUrl(imageUrl);
      setShowImageEditor(true);
    }
  };

  if (showImageEditor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowImageEditor(false);
                setInitialMediaUrl(null);
              }}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </Button>
            <h1 className="text-2xl font-bold">图片编辑器</h1>
          </div>
          <ImageEditor 
            imageUrl={initialMediaUrl || ''} 
            onSave={(imageData) => {
              alert('图片保存成功！');
              console.log('保存的图片:', imageData);
            }}
            onCancel={() => {
              setShowImageEditor(false);
              setInitialMediaUrl(null);
            }} 
          />
        </div>
      </div>
    );
  }

  if (showVideoEditor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowVideoEditor(false);
                setInitialMediaUrl(null);
              }}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </Button>
            <h1 className="text-2xl font-bold">视频编辑器</h1>
          </div>
          <VideoEditor 
            initialVideo={initialMediaUrl || undefined} 
            onSave={(videoData) => {
              alert('视频保存成功！');
              console.log('保存的视频:', videoData);
            }}
            onClose={() => {
              setShowVideoEditor(false);
              setInitialMediaUrl(null);
            }} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-xl border-b shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回首页
              </Button>
              <div>
                <h1 className="text-xl font-bold">个人中心</h1>
                <p className="text-xs text-muted-foreground">欢迎回来，{user?.username}</p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4 mb-8">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              概览
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              历史
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              工具
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              设置
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* User Profile Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-purple-600 rounded-full flex items-center justify-center overflow-hidden">
                    {user?.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt="头像" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-12 h-12 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{user?.username}</h2>
                    <p className="text-muted-foreground">AI 创意工坊用户</p>
                    <div className="flex gap-6 mt-4">
                      <div 
                        className="text-center cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                        onClick={() => setActiveTab('history')}
                      >
                        <p className="text-2xl font-bold hover:text-primary transition-colors">{stats.totalCreations}</p>
                        <p className="text-xs text-muted-foreground">总创作</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{stats.thisWeek}</p>
                        <p className="text-xs text-muted-foreground">本周</p>
                      </div>
                      <div 
                        className="text-center cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                        onClick={() => setActiveTab('history')}
                      >
                        <p className="text-2xl font-bold hover:text-red-600 transition-colors">{stats.totalVideos}</p>
                        <p className="text-xs text-muted-foreground">视频</p>
                      </div>
                      <div 
                        className="text-center cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                        onClick={() => setActiveTab('history')}
                      >
                        <p className="text-2xl font-bold hover:text-rose-600 transition-colors">{stats.totalImages}</p>
                        <p className="text-xs text-muted-foreground">图片</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <Video className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">创作视频</p>
                      <p className="text-xs text-muted-foreground">去创作新视频</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-rose-100 rounded-lg">
                      <ImageIcon className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                      <p className="font-medium">创作图片</p>
                      <p className="text-xs text-muted-foreground">去创作新图片</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowImageEditor(true)}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <Palette className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">图片编辑</p>
                      <p className="text-xs text-muted-foreground">P图和编辑</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowVideoEditor(true)}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <Video className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">视频编辑</p>
                      <p className="text-xs text-muted-foreground">裁剪、字幕、特效</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab('settings')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <Settings className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">个性化设置</p>
                      <p className="text-xs text-muted-foreground">调整偏好</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    创作历史
                  </CardTitle>
                  <CardDescription>查看和管理所有创作记录</CardDescription>
                </div>
                {stats.totalCreations > 0 && (
                  <div className="flex gap-2">
                    {videoHistory.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm('确定要清空所有视频历史吗？')) {
                            // 这里应该调用清空视频历史的函数
                          }
                        }}
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        清空视频
                      </Button>
                    )}
                    {imageHistory.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm('确定要清空所有图片历史吗？')) {
                            // 这里应该调用清空图片历史的函数
                          }
                        }}
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        清空图片
                      </Button>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {stats.totalCreations === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-block p-6 bg-muted/50 rounded-full mb-4">
                      <History className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-lg">还没有创作记录</p>
                    <p className="text-sm text-muted-foreground mt-2">去"创作中心"创建您的第一个作品吧！</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {/* Video History */}
                    {videoHistory.map((item) => (
                      <div key={item.id} className="p-4 bg-red-50/80 backdrop-blur-sm border border-blue-200 rounded-xl hover:bg-red-100/80 transition-all hover:shadow-md hover:scale-[1.01]">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="p-2.5 bg-red-100 rounded-xl shadow-sm">
                              <Video className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Badge variant="secondary" className="mb-2">视频</Badge>
                              <p className="text-sm font-medium line-clamp-2">{item.prompt}</p>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                                </span>
                                {item.duration && (
                                  <Badge variant="secondary" className="text-xs">{item.duration}秒</Badge>
                                )}
                                {item.resolution && (
                                  <Badge variant="secondary" className="text-xs">{item.resolution}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {item.videoUrl && (
                              <Button 
                                variant="secondary" 
                                size="sm"
                                onClick={() => handleEditVideoFromHistory(item.videoUrl)}
                                className="flex items-center gap-1"
                              >
                                <Edit3 className="w-4 h-4" />
                                编辑
                              </Button>
                            )}
                            <Button variant="secondary" size="sm">
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button variant="secondary" size="sm">
                              <Share2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {item.videoUrl && (
                          <div className="mt-3">
                            <video
                              src={item.videoUrl}
                              controls
                              className="w-full max-h-40 rounded-xl object-contain bg-black shadow-sm"
                            />
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Image History */}
                    {imageHistory.map((item) => (
                      <div key={item.id} className="p-4 bg-rose-50/80 backdrop-blur-sm border border-pink-200 rounded-xl hover:bg-rose-100/80 transition-all hover:shadow-md hover:scale-[1.01]">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="p-2.5 bg-rose-100 rounded-xl shadow-sm">
                              <ImageIcon className="w-5 h-5 text-rose-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Badge variant="secondary" className="mb-2">图片</Badge>
                              <p className="text-sm font-medium line-clamp-2">{item.prompt}</p>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                                </span>
                                {item.resolution && (
                                  <Badge variant="secondary" className="text-xs">{item.resolution}</Badge>
                                )}
                                {item.size && (
                                  <Badge variant="secondary" className="text-xs">{item.size}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {item.imageUrls && item.imageUrls.length > 0 && (
                              <Button 
                                variant="secondary" 
                                size="sm"
                                onClick={() => handleEditImageFromHistory(item.imageUrls![0])}
                                className="flex items-center gap-1"
                              >
                                <Edit3 className="w-4 h-4" />
                                编辑
                              </Button>
                            )}
                            <Button variant="secondary" size="sm">
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button variant="secondary" size="sm">
                              <Share2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {item.imageUrls && item.imageUrls.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {item.imageUrls.slice(0, 4).map((url, index) => (
                              <img
                                key={index}
                                src={url}
                                alt={`历史图片 ${index + 1}`}
                                className="w-full aspect-square rounded-xl object-cover shadow-sm hover:scale-105 transition-transform"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tools Tab */}
          <TabsContent value="tools" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  创意工具
                </CardTitle>
                <CardDescription>发现更多创作工具</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowImageEditor(true)}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-rose-100 rounded-lg">
                          <ImageIcon className="w-6 h-6 text-rose-600" />
                        </div>
                        <div>
                          <p className="font-medium">图片编辑</p>
                          <p className="text-xs text-muted-foreground">P图、裁剪、滤镜</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowVideoEditor(true)}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-100 rounded-lg">
                          <Video className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium">视频编辑</p>
                          <p className="text-xs text-muted-foreground">裁剪、字幕、特效、拼接</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="cursor-pointer hover:shadow-lg transition-shadow opacity-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-100 rounded-lg">
                          <Download className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium">下载管理</p>
                          <p className="text-xs text-muted-foreground">即将推出</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <ProfileSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-card" />}>
      <ProfilePageContent />
    </Suspense>
  );
}
