'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  User, Settings, Palette, Layout, Bell, Download, 
  Share2, Image as ImageIcon, Type as TypeIcon, Scissors, Music, 
  Save, Check, ChevronRight, Moon, Sun, Globe, Maximize2,
  Volume2, RefreshCw, Trash2, Camera, Edit3, Layers
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_THEMES, LANGUAGE_OPTIONS, FONT_SIZE_OPTIONS, FONT_STYLE_OPTIONS } from '@/constants/themes';

interface ProfileSettingsProps {
  onClose?: () => void;
}

export function ProfileSettings({ onClose }: ProfileSettingsProps) {
  const { user, logout, updateUsername, updateAvatar } = useAuth();
  const { theme, setTheme, userSettings, updateUserSettings, allThemes } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveSettings = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveUsername = () => {
    if (newUsername.trim()) {
      updateUsername(newUsername.trim());
      setIsEditingUsername(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleAvatarUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        alert('请上传图片文件');
        return;
      }

      // 验证文件大小 (限制为 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('文件大小不能超过 5MB');
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      updateAvatar(previewUrl);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    // 重置 input 值，允许重新选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <User className="w-6 h-6" />
            个人中心
          </h2>
          <p className="text-muted-foreground">管理您的账户设置和偏好</p>
        </div>
        {onClose && (
          <Button variant="secondary" size="sm" onClick={onClose}>
            关闭
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            个人信息
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            主题外观
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            偏好设置
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            创意工具
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                账户信息
              </CardTitle>
              <CardDescription>查看和管理您的账户信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* User Info */}
              <div className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg">
                  <div className="relative">
                    {user?.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt="头像" 
                        className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                        <User className="w-10 h-10 text-primary" />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileChange}
                        className="hidden"
                      />
                      <Button 
                        size="icon" 
                        variant="default" 
                        className="w-8 h-8 rounded-full shadow-lg"
                        onClick={handleAvatarUploadClick}
                      >
                        <Camera className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground mb-1">头像</p>
                    <p className="text-xs text-muted-foreground">点击相机图标上传新头像</p>
                  </div>
                </div>

                {/* Username */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">用户名</Label>
                    {!isEditingUsername && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => setIsEditingUsername(true)}
                        className="flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        编辑
                      </Button>
                    )}
                  </div>
                  {isEditingUsername ? (
                    <div className="flex gap-2">
                      <Input
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="输入新用户名"
                        className="flex-1"
                      />
                      <Button onClick={handleSaveUsername} className="flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        保存
                      </Button>
                      <Button 
                        variant="secondary" 
                        onClick={() => {
                          setIsEditingUsername(false);
                          setNewUsername(user?.username || '');
                        }}
                      >
                        取消
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted/30 rounded-lg border">
                      <p className="font-medium">{user?.username}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Account Actions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Download className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">下载历史</p>
                      <p className="text-sm text-muted-foreground">查看所有下载的文件</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Share2 className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">分享记录</p>
                      <p className="text-sm text-muted-foreground">查看分享过的作品</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">清空历史</p>
                      <p className="text-sm text-muted-foreground">清空所有创作历史记录</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>

              {/* Logout */}
              <div className="pt-4 border-t">
                <Button variant="destructive" onClick={logout} className="w-full">
                  退出登录
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                主题设置
              </CardTitle>
              <CardDescription>选择您喜欢的主题颜色</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {allThemes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTheme(t.id);
                      updateUserSettings({ themeId: t.id });
                    }}
                    className={`p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                      theme.id === t.id 
                        ? 'border-primary ring-2 ring-primary/50' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className={`h-16 rounded-lg bg-gradient-to-br ${t.gradient} mb-2`} />
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                  </button>
                ))}
              </div>

              {/* Current Theme */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-2">当前主题</p>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${theme.gradient}`} />
                  <div>
                    <p className="font-medium">{theme.name}</p>
                    <p className="text-sm text-muted-foreground">{theme.description}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="w-5 h-5" />
                界面设置
              </CardTitle>
              <CardDescription>调整界面的显示方式</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Maximize2 className="w-4 h-4" />
                      紧凑模式
                    </Label>
                    <p className="text-xs text-muted-foreground">减少界面间距，显示更多内容</p>
                  </div>
                  <Switch
                    checked={userSettings.compactMode}
                    onCheckedChange={(checked) => updateUserSettings({ compactMode: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      动画效果
                    </Label>
                    <p className="text-xs text-muted-foreground">启用界面过渡动画</p>
                  </div>
                  <Switch
                    checked={userSettings.animationsEnabled}
                    onCheckedChange={(checked) => updateUserSettings({ animationsEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      提示消息
                    </Label>
                    <p className="text-xs text-muted-foreground">显示使用提示和帮助信息</p>
                  </div>
                  <Switch
                    checked={userSettings.showTips}
                    onCheckedChange={(checked) => updateUserSettings({ showTips: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                生成偏好
              </CardTitle>
              <CardDescription>设置默认的生成参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      自动保存
                    </Label>
                    <p className="text-xs text-muted-foreground">自动保存创作历史</p>
                  </div>
                  <Switch
                    checked={userSettings.autoSave}
                    onCheckedChange={(checked) => updateUserSettings({ autoSave: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4" />
                      音效
                    </Label>
                    <p className="text-xs text-muted-foreground">播放操作反馈音效</p>
                  </div>
                  <Switch
                    checked={userSettings.soundEnabled}
                    onCheckedChange={(checked) => updateUserSettings({ soundEnabled: checked })}
                  />
                </div>

                {/* Language Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    语言
                  </Label>
                  <Select 
                    value={userSettings.language} 
                    onValueChange={(value) => updateUserSettings({ language: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择语言" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <span>{option.flag}</span>
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">选择界面语言</p>
                </div>

                {/* Font Size Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <TypeIcon className="w-4 h-4" />
                    字体大小
                  </Label>
                  <Select 
                    value={userSettings.fontSize} 
                    onValueChange={(value) => updateUserSettings({ fontSize: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择字体大小" />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span>{option.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">调整界面字体大小</p>
                </div>

                {/* Font Style Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    字体风格
                  </Label>
                  <Select 
                    value={userSettings.fontStyle} 
                    onValueChange={(value) => updateUserSettings({ fontStyle: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择字体风格" />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_STYLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span>{option.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">选择界面字体风格</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button 
                  onClick={handleSaveSettings}
                  className="w-full"
                >
                  {saved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      已保存
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      保存设置
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                创意工具
              </CardTitle>
              <CardDescription>发现更多创作工具</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-rose-100 rounded-lg">
                      <ImageIcon className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                      <p className="font-medium">图片编辑</p>
                      <p className="text-xs text-muted-foreground">P图、裁剪、滤镜</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <TypeIcon className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">文字添加</p>
                      <p className="text-xs text-muted-foreground">在图片上添加文字</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Scissors className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">视频裁剪</p>
                      <p className="text-xs text-muted-foreground">裁剪和编辑视频</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Music className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">音频编辑</p>
                      <p className="text-xs text-muted-foreground">添加和编辑音频</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Share2 className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">分享功能</p>
                      <p className="text-xs text-muted-foreground">分享您的作品</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Download className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">下载管理</p>
                      <p className="text-xs text-muted-foreground">管理下载的文件</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
