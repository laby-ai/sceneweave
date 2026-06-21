'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  FileText,
  Film,
  FolderOpen,
  GitBranch,
  Globe,
  Home,
  Image as ImageIcon,
  Layers,
  ListTodo,
  MessageSquare,
  Music,
  Settings,
  Smartphone,
  Sparkles,
  TrendingUp,
  Type,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import ThemeSwitch from '@/components/ThemeSwitch';
import type { UserSettings } from '@/constants/themes';
import type { MediaSubSection } from '@/components/home/dreambox-media-section';

const navItemDefs = [
  { id: 'home', label: '首页', fullLabel: '创作工作台', icon: <Home className="w-5 h-5" />, section: 'home' },
  { id: 'media', label: '素材', fullLabel: '图文与素材', icon: <FolderOpen className="w-5 h-5" />, section: 'media' },
  { id: 'video', label: '视频', fullLabel: 'AI 视频创作', icon: <Sparkles className="w-5 h-5" />, section: 'video' },
  { id: 'subtitle-chat', label: '精灵', fullLabel: '绘影精灵', icon: <MessageSquare className="w-5 h-5" />, section: 'smart' },
  { id: 'film', label: '影视', fullLabel: '影视创作', icon: <Film className="w-5 h-5" />, section: 'film' },
  { id: 'canvas', label: '画布', fullLabel: '工作流画布', icon: <GitBranch className="w-5 h-5" />, section: 'canvas', isLink: true, href: '/node-editor' },
  { id: 'research', label: '研究', fullLabel: '平台研究', icon: <BarChart3 className="w-5 h-5" />, section: 'research', isLink: true, href: '/research' },
  { id: 'tasks', label: '任务', fullLabel: '任务中心', icon: <ListTodo className="w-5 h-5" />, section: 'tasks' },
  { id: 'settings', label: '设置', fullLabel: '设置与 BYOK', icon: <Settings className="w-5 h-5" />, section: 'settings' },
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
      <div className="fixed top-0 left-16 right-0 z-50 h-[72px] bg-[var(--nav-bg)] backdrop-blur-2xl border-b border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex h-full items-center justify-end px-3 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSection('tasks')}
              aria-label={`查看任务中心，当前 ${backgroundTaskCount} 个任务`}
              className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-foreground/80 transition-all hover:border-[#4F6CFF]/50 hover:bg-[#4F6CFF]/10 hover:text-foreground sm:flex"
            >
              <Zap className="h-4 w-4 text-[#70E0FF]" />
              任务 {backgroundTaskCount}
            </button>

            <div className="relative group">
              <Button variant="ghost" size="sm" className="text-foreground/70 hover:text-foreground hover:bg-accent/50 h-8 px-2" title="字体设置">
                <Type className="w-4 h-4" />
              </Button>
              <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 p-2 max-h-[70vh] overflow-y-auto">
                {fontGroups.map((cat) => (
                  <div key={cat.label}>
                    <p className="text-[10px] font-semibold text-muted-foreground px-2 pt-1.5 pb-0.5">{cat.label}</p>
                    {cat.fonts.map((font) => (
                      <button
                        key={font.id}
                        onClick={() => setSettingsFontStyle(font.id)}
                        className={`w-full text-left px-3 py-1 rounded-lg text-xs transition-colors ${
                          settingsFontStyle === font.id ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground hover:bg-accent/50'
                        }`}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>
                ))}
                <div className="border-t border-border my-1" />
                <div className="px-2 py-1">
                  <p className="text-xs text-muted-foreground mb-1">字号: {settingsFontSize}px</p>
                  <input
                    type="range"
                    min={12}
                    max={20}
                    step={1}
                    value={settingsFontSize}
                    onChange={(event) => setSettingsFontSize(Number(event.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-accent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#70E0FF]"
                  />
                </div>
              </div>
            </div>

            <div className="relative group">
              <Button variant="ghost" size="sm" className="text-foreground/70 hover:text-foreground hover:bg-accent/50 h-8 px-2" title="语言设置">
                <Globe className="w-4 h-4" />
              </Button>
              <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 p-2 max-h-[70vh] overflow-y-auto">
                {languageGroups.map((cat) => (
                  <div key={cat.label}>
                    <p className="text-[10px] font-semibold text-muted-foreground px-2 pt-1.5 pb-0.5">{cat.label}</p>
                    {cat.langs.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => {
                          setSettingsLanguage(lang.id);
                          updateUserSettings({ language: lang.id as UserSettings['language'] });
                        }}
                        className={`w-full text-left px-3 py-1 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                          settingsLanguage === lang.id ? 'bg-[#70E0FF]/10 text-[#70E0FF]' : 'text-foreground hover:bg-accent/50'
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <ThemeSwitch />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveSection('settings')}
              className="text-foreground/70 hover:text-foreground hover:bg-accent/50"
              aria-label="打开设置"
            >
              <Settings className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">设置</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="fixed top-0 left-0 bottom-0 z-40 transition-all duration-300 bg-black/70 border-r border-white/10 overflow-hidden w-16 backdrop-blur-2xl">
        <nav className="flex h-full flex-col px-1.5 py-2">
          <button
            onClick={() => {
              setActiveSection('home');
              setIsMediaExpanded(false);
            }}
            className="mb-3 flex h-14 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:border-[#70E0FF]/45 hover:bg-white/[0.07]"
            aria-label="回到绘影首页"
            title="绘影"
          >
            <img src="/logo-icon-galaxy.png" alt="绘影" className="h-10 w-10 rounded-xl object-cover shadow-[0_0_24px_rgba(68,172,255,0.28)]" />
          </button>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
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
