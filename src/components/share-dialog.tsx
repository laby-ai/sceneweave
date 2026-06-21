'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Share2, Copy, Check, Link, Twitter, Facebook, Linkedin, 
  MessageSquare, Mail, Download, QrCode
} from 'lucide-react';

interface ShareDialogProps {
  url?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  triggerButton?: React.ReactNode;
  onShare?: (platform: string) => void;
}

const SHARE_PLATFORMS = [
  {
    id: 'copy',
    name: '复制链接',
    icon: <Copy className="w-5 h-5" />,
    color: 'bg-secondary text-foreground',
  },
  {
    id: 'twitter',
    name: 'Twitter',
    icon: <Twitter className="w-5 h-5" />,
    color: 'bg-red-400 text-white',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: <Facebook className="w-5 h-5" />,
    color: 'bg-red-600 text-white',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: <Linkedin className="w-5 h-5" />,
    color: 'bg-red-700 text-white',
  },
  {
    id: 'wechat',
    name: '微信',
    icon: <MessageSquare className="w-5 h-5" />,
    color: 'bg-green-500 text-white',
  },
  {
    id: 'email',
    name: '邮件',
    icon: <Mail className="w-5 h-5" />,
    color: 'bg-red-500 text-white',
  },
];

export function ShareDialog({ 
  url = window.location.href,
  title = '我的创作',
  description = '看看我用 AI 创意工坊创作的作品！',
  imageUrl,
  triggerButton,
  onShare
}: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('share');

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const handleShare = (platform: string) => {
    const encodedTitle = encodeURIComponent(title);
    const encodedDescription = encodeURIComponent(description);
    const encodedUrl = encodeURIComponent(url);

    let shareUrl = '';

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`;
        break;
      case 'copy':
        handleCopyLink();
        break;
      case 'wechat':
        // 微信分享通常需要通过二维码或 SDK
        setActiveTab('qrcode');
        return;
    }

    if (shareUrl && platform !== 'copy') {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }

    if (onShare) {
      onShare(platform);
    }
  };

  const handleDownload = () => {
    // 模拟下载
    const link = document.createElement('a');
    link.href = imageUrl || url;
    link.download = `shared-content-${Date.now()}.png`;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="secondary" size="sm" className="flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            分享
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            分享作品
          </DialogTitle>
          <DialogDescription>
            通过多种方式分享您的创作
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="share" className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              分享
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-2">
              <Link className="w-4 h-4" />
              链接
            </TabsTrigger>
            <TabsTrigger value="qrcode" className="flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              二维码
            </TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="space-y-4 mt-4">
            {/* Preview */}
            {(imageUrl || title) && (
              <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                {imageUrl && (
                  <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={imageUrl}
                      alt="预览"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{title}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
                </div>
              </div>
            )}

            {/* Share Platforms */}
            <div className="grid grid-cols-3 gap-3">
              {SHARE_PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => handleShare(platform.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors ${
                    platform.id === 'copy' && copied ? 'bg-green-50 border-green-200' : ''
                  }`}
                >
                  <div className={`p-2 rounded-full ${platform.color}`}>
                    {platform.id === 'copy' && copied ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      platform.icon
                    )}
                  </div>
                  <span className="text-sm font-medium">
                    {platform.id === 'copy' && copied ? '已复制' : platform.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Download */}
            <div className="pt-2 border-t">
              <Button
                variant="secondary"
                onClick={handleDownload}
                className="w-full"
                disabled={!imageUrl}
              >
                <Download className="w-4 h-4 mr-2" />
                下载图片
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="link" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Label>分享链接</Label>
              <div className="flex gap-2">
                <Input
                  value={url}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button onClick={handleCopyLink} variant="secondary">
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      复制
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                复制此链接分享给他人，他们可以查看您的作品
              </p>
            </div>
          </TabsContent>

          <TabsContent value="qrcode" className="space-y-4 mt-4">
            <div className="flex flex-col items-center space-y-4">
              {/* QR Code Placeholder */}
              <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                <div className="text-center space-y-2">
                  <QrCode className="w-16 h-16 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">二维码</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                扫描二维码即可查看作品
              </p>
              <Button variant="secondary" className="w-full max-w-xs">
                <Download className="w-4 h-4 mr-2" />
                保存二维码
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
