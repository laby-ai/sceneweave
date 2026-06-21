'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, TrendingUp, Building2, BookOpen, X, ChevronLeft } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

const navItems: NavItem[] = [
  {
    id: 'home',
    label: '首页',
    icon: <Home className="w-5 h-5" />,
    href: '/',
  },
  {
    id: 'video',
    label: '视频生成',
    icon: <FileText className="w-5 h-5" />,
    href: '/',
  },
  {
    id: 'image',
    label: '图片生成',
    icon: <TrendingUp className="w-5 h-5" />,
    href: '/',
  },
  {
    id: 'templates',
    label: '模板库',
    icon: <Building2 className="w-5 h-5" />,
    href: '/templates',
  },
  {
    id: 'social',
    label: '社区中心',
    icon: <BookOpen className="w-5 h-5" />,
    href: '/social',
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className={`relative bg-card border-r border-[#262626] transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      <div className="p-6">
        <div className="mb-8">
          <h1 className={`text-2xl font-bold text-foreground ${collapsed ? 'text-center' : ''}`}>
            {collapsed ? 'D' : 'Dreambox'}
          </h1>
          {!collapsed && (
            <p className="text-sm text-muted-foreground mt-1">
              AI 生图工具箱
            </p>
          )}
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive(item.href)
                  ? 'bg-[#EF4444] text-black'
                  : 'text-white hover:bg-accent'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              {item.icon}
              {!collapsed && (
                <span className="font-medium">{item.label}</span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      <div className="absolute bottom-6 left-0 right-0 px-6">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronLeft className="w-5 h-5 rotate-180" />
          ) : (
            <>
              <X className="w-5 h-5 mr-2" />
              <span className="text-sm">收起</span>
            </>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="absolute bottom-24 right-4">
          <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-white font-medium">
            N
          </div>
        </div>
      )}
    </div>
  );
}
