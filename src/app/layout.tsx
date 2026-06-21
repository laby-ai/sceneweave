import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './Providers';

export const metadata: Metadata = {
  applicationName: '绘影',
  title: {
    default: '绘影 | AI 短片创作平台',
    template: '%s | 绘影',
  },
  description:
    '绘影是一款面向短剧与短片生产的 AI 创作平台，把创意、剧本、角色、分镜、素材、任务和成片收束到同一张制作台。',
  keywords: [
    '绘影',
    'AI 创作平台',
    '视频生成',
    '图片生成',
    '海报制作',
    '文案生成',
    'AI 艺术',
    '创意工具',
    '多媒体创作',
    'AI 设计',
  ],
  authors: [{ name: '绘影 Team' }],
  creator: '绘影 Team',
  publisher: '绘影',
  generator: '绘影',
  category: 'AI 创作工具',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: '绘影',
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    title: '绘影 | AI 短片创作平台',
    description:
      '使用绘影完成短剧与短片生产，把创意、剧本、角色、分镜、素材、任务和成片收束到同一张制作台。',
    siteName: '绘影',
    locale: 'zh_CN',
    type: 'website',
    images: [
      {
        url: '/brand/huiying-logo-icon.png',
        width: 512,
        height: 512,
        alt: '绘影',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.cn" />
        <link rel="preconnect" href="https://fonts.gstatic.cn" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.cn/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&family=Noto+Serif+SC:wght@400;500;600;700&family=LXGW+WenKai:wght@300;400;700&family=Ma+Shan+Zheng&family=ZCOOL+KuaiLe&family=ZCOOL+QingKe+HuangYou&family=Zhi+Mang+Xing&family=Liu+Jian+Mao+Cao&family=Long+Cang&family=Noto+Sans+JP:wght@300;400;500;700&family=Noto+Serif+JP:wght@400;500;600;700&family=Zen+Maru+Gothic:wght@400;500;700&family=Kosugi+Maru&family=Noto+Sans+KR:wght@300;400;500;700&family=Black+Han+Sans&family=Do+Hyeon&family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Fira+Code:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Poppins:wght@300;400;500;600;700&family=Source+Code+Pro:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className={`antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
