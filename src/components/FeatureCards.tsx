'use client';

import Link from 'next/link';
import { Video, Image as ImageIcon, Sparkles, Palette } from 'lucide-react';

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  href: string;
}

const featureCards: FeatureCard[] = [
  {
    id: 'video',
    title: '视频生成',
    description: '基于 AI 生成专业的视频内容',
    icon: <Video className="w-12 h-12 text-[#EF4444]" />,
    gradient: 'from-[#1E40AF] to-[#1E3A8A]',
    href: '/',
  },
  {
    id: 'image',
    title: '图片生成',
    description: '快速创建精美的图片作品',
    icon: <ImageIcon className="w-12 h-12 text-[#EF4444]" />,
    gradient: 'from-[#065F46] to-[#064E3B]',
    href: '/',
  },
  {
    id: 'templates',
    title: '模板库',
    description: '发现和使用专业的生成模板',
    icon: <Sparkles className="w-12 h-12 text-[#EF4444]" />,
    gradient: 'from-[#581C87] to-[#4C1D95]',
    href: '/templates',
  },
  {
    id: 'community',
    title: '社区中心',
    description: '分享和发现精彩的创作作品',
    icon: <Palette className="w-12 h-12 text-[#EF4444]" />,
    gradient: 'from-[#7C2D12] to-[#6B2117]',
    href: '/social',
  },
];

export function FeatureCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {featureCards.map((card) => (
        <Link key={card.id} href={card.href}>
          <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${card.gradient} p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}>
            <div className="relative z-10">
              <div className="mb-4 flex justify-center">
                {card.icon}
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2 text-center">
                {card.title}
              </h3>
              <p className="text-foreground/70 text-center text-sm">
                {card.description}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
