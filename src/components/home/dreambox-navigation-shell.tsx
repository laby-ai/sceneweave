'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import Link from 'next/link';
import {
  FileText,
  Film,
  FolderOpen,
  GitBranch,
  Globe,
  Home,
  Image as ImageIcon,
  Layers,
  Music,
  Settings,
  Smartphone,
  Sparkles,
  TrendingUp,
  Type,
  User,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { UserSettings } from '@/constants/themes';
import type { MediaSubSection } from '@/components/home/dreambox-media-section';

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const withBasePath = (url: string) => BASE_PATH && url.startsWith('/') && !url.startsWith(`${BASE_PATH}/`) ? `${BASE_PATH}${url}` : url;

// 即梦式四导航收敛：首页 / 资产 / 生成 / 画布。
// 创作类型（图片 / 视频 / 影视 / 导演）不在导航栏暴露，而是“生成”内的创作模式，能力仍然保留。
const navItemDefs = [
  { id: 'home', label: '首页', fullLabel: '首页', icon: <Home className="w-5 h-5" />, section: 'home' },
  { id: 'assets', label: '资产', fullLabel: '资产库', icon: <FolderOpen className="w-5 h-5" />, section: 'media', sub: 'assets' as const },
  { id: 'generate', label: '生成', fullLabel: '生成创作', icon: <Sparkles className="w-5 h-5" />, section: 'smart' },
  { id: 'canvas', label: '画布', fullLabel: '无限画布', icon: <GitBranch className="w-5 h-5" />, section: 'canvas', isLink: true, href: '/canvas' },
];

const fontGroups = [
  { label: '中文', fonts: [
    { id: 'default', name: '默认无衬线' },
    { id: 'notoSans', name: '思源黑体' },
    { id: 'notoSerif', name: '思源宋体' },
    { id: 'lxgwWenkai', name: '霞鹜文楷' },
    { id: 'maShanZheng', name: '马善政楷' },
    { id: 'zcoolkuaile', name: '站酷快乐体' },
    { id: 'zcoolQingke', name: '站酷庆科黄油' },
    { id: 'zhimangxing', name: '志莽行书' },
    { id: 'longcang', name: '龙藏体' },
  ] },
  { label: '日本語', fonts: [
    { id: 'notoSansJp', name: 'Noto Sans JP' },
    { id: 'notoSerifJp', name: 'Noto Serif JP' },
    { id: 'zenMaru', name: 'Zen Maru Gothic' },
  ] },
  { label: '한국어', fonts: [
    { id: 'notoSansKr', name: 'Noto Sans KR' },
    { id: 'blackHanSans', name: 'Black Han Sans' },
  ] },
  { label: 'Western', fonts: [
    { id: 'inter', name: 'Inter' },
    { id: 'poppins', name: 'Poppins' },
    { id: 'spaceGrotesk', name: 'Space Grotesk' },
    { id: 'playfair', name: 'Playfair Display' },
  ] },
  { label: 'Code', fonts: [
    { id: 'firaCode', name: 'Fira Code' },
    { id: 'sourceCode', name: 'Source Code Pro' },
    { id: 'monospace', name: '系统等宽' },
  ] },
];

const languageGroups = [
  { label: '东亚', langs: [
    { id: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
    { id: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
    { id: 'ja-JP', name: '日本語', flag: '🇯🇵' },
    { id: 'ko-KR', name: '한국어', flag: '🇰🇷' },
  ] },
  { label: '欧洲', langs: [
    { id: 'en-US', name: 'English', flag: '🇺🇸' },
    { id: 'fr-FR', name: 'Français', flag: '🇫🇷' },
    { id: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
    { id: 'es-ES', name: 'Español', flag: '🇪🇸' },
    { id: 'pt-BR', name: 'Português', flag: '🇧🇷' },
    { id: 'it-IT', name: 'Italiano', flag: '🇮🇹' },
    { id: 'ru-RU', name: 'Русский', flag: '🇷🇺' },
  ] },
  { label: '中东/南亚', langs: [
    { id: 'ar-SA', name: 'العربية', flag: '🇸🇦' },
    { id: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳' },
    { id: 'th-TH', name: 'ไทย', flag: '🇹🇭' },
    { id: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳' },
    { id: 'id-ID', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  ] },
];

const mediaMenuItems = [
  { id: 'image', labelKey: 'media.imageGen', icon: <ImageIcon className="w-4 h-4" />, section: 'image' as const, sub: undefined },
  { id: 'assets', label: '真实资产', labelKey: 'media.assets', icon: <Film className="w-4 h-4" />, section: 'media' as const, sub: 'assets' as const },
  { id: 'poster', labelKey: 'media.poster', icon: <Layers className="w-4 h-4" />, section: 'media' as const, sub: 'poster' as const },
  { id: 'copywriting', labelKey: 'media.copywriting', icon: <FileText className="w-4 h-4" />, section: 'media' as const, sub: 'copywriting' as const },
  { id: 'xiaohongshu', labelKey: 'media.xiaohongshu', icon: <TrendingUp className="w-4 h-4" />, section: 'media' as const, sub: 'xiaohongshu' as const },
  { id: 'douyin', labelKey: 'media.douyin', icon: <Music className="w-4 h-4" />, section: 'media' as const, sub: 'douyin' as const },
  { id: 'wechat', labelKey: 'media.wechat', icon: <Smartphone className="w-4 h-4" />, section: 'media' as const, sub: 'wechat' as const },
];

interface DreamboxNavigationShellProps {
  activeSection: string;
  backgroundTaskCount: number;
  isMediaExpanded: boolean;
  mediaDropdownMenuRef: RefObject<HTMLDivElement | null>;
  mediaDropdownRef: RefObject<HTMLDivElement | null>;
  mediaDropdownTop: number;
  mediaSubSection: MediaSubSection;
  pathname: string | null;
  setActiveSection: (section: string) => void;
  setIsMediaExpanded: Dispatch<SetStateAction<boolean>>;
  setMediaDropdownTop: (top: number) => void;
  setMediaSubSection: (section: MediaSubSection) => void;
  setSettingsFontSize: (size: number) => void;
  setSettingsFontStyle: (style: string) => void;
  setSettingsLanguage: (language: string) => void;
  settingsFontSize: number;
  settingsFontStyle: string;
  settingsLanguage: string;
  t: (key: string) => string;
  updateUserSettings: (settings: Partial<UserSettings>) => void;
}

export function DreamboxNavigationShell({
  activeSection,
  backgroundTaskCount,
  isMediaExpanded,
  mediaDropdownMenuRef,
  mediaDropdownRef,
  mediaDropdownTop,
  mediaSubSection,
  pathname,
  setActiveSection,
  setIsMediaExpanded,
  setMediaDropdownTop,
  setMediaSubSection,
  setSettingsFontSize,
  setSettingsFontStyle,
  setSettingsLanguage,
  settingsFontSize,
  settingsFontStyle,
  settingsLanguage,
  t,
  updateUserSettings,
}: DreamboxNavigationShellProps) {
  return (
    <>
      <div className="fixed top-0 left-0 bottom-0 z-40 w-16 border-r border-white/10 bg-black/70 backdrop-blur-2xl">
        <nav className="flex h-full flex-col items-center px-1.5 py-3">
          <button
            onClick={() => {
              setActiveSection('home');
              setIsMediaExpanded(false);
            }}
            className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl transition-all hover:bg-white/[0.06]"
            aria-label="回到绘影首页"
            title="绘影"
          >
            <img src={withBasePath("/logo-icon-galaxy.png")} alt="绘影" className="h-9 w-9 object-contain" />
          </button>
          <div className="flex w-full flex-1 flex-col items-center justify-center gap-1">
            {navItemDefs.map((item) => {
              if ('isLink' in item && item.isLink) {
                const isLinkActive = pathname === item.href;
                return (
                  <Link key={item.id} href={item.href} onClick={() => setIsMediaExpanded(false)}>
                    <button
                      title={item.fullLabel}
                      aria-label={item.fullLabel}
                      className={`flex h-14 w-full flex-col items-center justify-center rounded-2xl transition-all ${
                        isLinkActive
                          ? 'bg-[#4F6CFF]/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] ring-1 ring-[#4F6CFF]/40'
                          : 'text-foreground/60 hover:bg-white/[0.06] hover:text-foreground'
                      }`}
                    >
                      {item.icon}
                      <span className="mt-1 w-full truncate text-center text-[10px] leading-tight">{item.label}</span>
                    </button>
                  </Link>
                );
              }

              if (item.id === 'media') {
                return (
                  <div key={item.id} className="relative" ref={mediaDropdownRef}>
                    <button
                      title={item.fullLabel}
                      aria-label={`${item.fullLabel}菜单`}
                      onClick={() => {
                        if (!isMediaExpanded && mediaDropdownRef.current) {
                          const rect = mediaDropdownRef.current.getBoundingClientRect();
                          setMediaDropdownTop(rect.top);
                        }
                        setIsMediaExpanded(!isMediaExpanded);
                      }}
                      className={`flex h-14 w-full flex-col items-center justify-center rounded-2xl transition-all ${
                        activeSection === 'media' || activeSection === 'image'
                          ? 'bg-[#4F6CFF]/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] ring-1 ring-[#4F6CFF]/40'
                          : 'text-foreground/60 hover:bg-white/[0.06] hover:text-foreground'
                      }`}
                    >
                      {item.icon}
                      <span className="mt-1 w-full truncate text-center text-[10px] leading-tight">{item.label}</span>
                    </button>
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  title={item.fullLabel}
                  aria-label={item.fullLabel}
                  onClick={() => {
                    if (item.section) setActiveSection(item.section);
                    if ('sub' in item && item.sub) setMediaSubSection(item.sub);
                    setIsMediaExpanded(false);
                  }}
                  className={`flex h-14 w-full flex-col items-center justify-center rounded-2xl transition-all ${
                    activeSection === item.section
                      ? 'bg-[#4F6CFF]/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] ring-1 ring-[#4F6CFF]/40'
                      : 'text-foreground/60 hover:bg-white/[0.06] hover:text-foreground'
                  }`}
                >
                  {item.icon}
                  <span className="mt-1 w-full truncate text-center text-[10px] leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex w-full flex-col items-center gap-1 pt-2">
            <button
              onClick={() => setActiveSection('tasks')}
              aria-label={`任务中心，当前 ${backgroundTaskCount} 个任务`}
              title="任务中心"
              className="relative flex h-12 w-full flex-col items-center justify-center rounded-2xl text-foreground/60 transition-all hover:bg-white/[0.06] hover:text-foreground"
            >
              <Zap className="h-5 w-5" />
              <span className="mt-0.5 text-[10px] leading-tight">任务</span>
              {backgroundTaskCount > 0 && (
                <span className="absolute right-2 top-1 rounded-full bg-[#4F6CFF] px-1 text-[9px] font-semibold text-white">{backgroundTaskCount}</span>
              )}
            </button>
            <button
              onClick={() => setActiveSection('settings')}
              aria-label="设置"
              title="设置"
              className={`flex h-12 w-full flex-col items-center justify-center rounded-2xl transition-all ${
                activeSection === 'settings'
                  ? 'bg-[#4F6CFF]/20 text-white ring-1 ring-[#4F6CFF]/40'
                  : 'text-foreground/60 hover:bg-white/[0.06] hover:text-foreground'
              }`}
            >
              <Settings className="h-5 w-5" />
              <span className="mt-0.5 text-[10px] leading-tight">设置</span>
            </button>
            <a
              href="http://39.97.246.33/account?next=%2F"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="登录"
              title="登录账号"
              className="flex h-12 w-full flex-col items-center justify-center rounded-2xl text-foreground/60 transition-all hover:bg-white/[0.06] hover:text-foreground"
            >
              <User className="h-5 w-5" />
              <span className="mt-0.5 text-[10px] leading-tight">登录</span>
            </a>
          </div>
        </nav>
      </div>

      {isMediaExpanded && (
        <div
          ref={mediaDropdownMenuRef}
          className="fixed left-[64px] bg-[#0c0f18]/95 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-[60] animate-in fade-in slide-in-from-left-2 duration-150 backdrop-blur-2xl"
          style={{ top: `${mediaDropdownTop}px` }}
        >
          <div className="p-1.5">
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">图文与素材</div>
            {mediaMenuItems.map((item) => {
              const isActive = item.sub
                ? activeSection === item.section && mediaSubSection === item.sub
                : activeSection === item.section;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.section);
                    if (item.sub) setMediaSubSection(item.sub);
                    setIsMediaExpanded(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive ? 'bg-primary/15 text-primary font-medium' : 'text-foreground/70 hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  {item.icon}
                  <span>{item.label || t(item.labelKey)}</span>
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
