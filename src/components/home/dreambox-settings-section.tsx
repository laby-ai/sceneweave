'use client';

import { Globe, KeyRound, Loader2, Palette, ShieldCheck, Trash2, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UserSettings } from '@/constants/themes';

type ApiProviderType = 'openai-compatible' | 'ark-plan';

export function DreamboxSettingsSection({
  activeSection,
  setActiveSection,
  t,
  settingsUsername,
  setSettingsUsername,
  settingsEmail,
  setSettingsEmail,
  settingsApiProvider,
  setSettingsApiProvider,
  settingsApiBase,
  setSettingsApiBase,
  settingsApiKey,
  setSettingsApiKey,
  settingsModel,
  setSettingsModel,
  settingsImageModel,
  setSettingsImageModel,
  settingsVideoModel,
  setSettingsVideoModel,
  apiConnectionStatus,
  testApiConnection,
  saveApiConnectionSettings,
  clearApiConnectionSettings,
  isDark,
  toggleColorMode,
  settingsFontStyle,
  setSettingsFontStyle,
  settingsFontSize,
  setSettingsFontSize,
  settingsLanguage,
  setSettingsLanguage,
  updateUserSettings,
  settingsNotification,
  setSettingsNotification,
  settingsAutoSave,
  setSettingsAutoSave,
  handleClearVideoHistory,
  handleClearImageHistory,
}: {
  activeSection: string;
  setActiveSection: (section: string) => void;
  t: (key: string) => string;
  settingsUsername: string;
  setSettingsUsername: (value: string) => void;
  settingsEmail: string;
  setSettingsEmail: (value: string) => void;
  settingsApiProvider: ApiProviderType;
  setSettingsApiProvider: (value: ApiProviderType) => void;
  settingsApiBase: string;
  setSettingsApiBase: (value: string) => void;
  settingsApiKey: string;
  setSettingsApiKey: (value: string) => void;
  settingsModel: string;
  setSettingsModel: (value: string) => void;
  settingsImageModel: string;
  setSettingsImageModel: (value: string) => void;
  settingsVideoModel: string;
  setSettingsVideoModel: (value: string) => void;
  apiConnectionStatus: { type: 'idle' | 'testing' | 'success' | 'error'; message?: string };
  testApiConnection: (testMode?: 'models' | 'chat' | 'image') => Promise<void>;
  saveApiConnectionSettings: () => void;
  clearApiConnectionSettings: () => void;
  isDark: boolean;
  toggleColorMode: () => void;
  settingsFontStyle: string;
  setSettingsFontStyle: (value: string) => void;
  settingsFontSize: number;
  setSettingsFontSize: (value: number) => void;
  settingsLanguage: string;
  setSettingsLanguage: (value: string) => void;
  updateUserSettings: (settings: Partial<UserSettings>) => void;
  settingsNotification: boolean;
  setSettingsNotification: (value: boolean) => void;
  settingsAutoSave: boolean;
  setSettingsAutoSave: (value: boolean) => void;
  handleClearVideoHistory: () => void;
  handleClearImageHistory: () => void;
}) {
  return (
    <>
          {/* 设置 */}
          {activeSection === 'settings' && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  设置
                </h1>
                <p className="text-muted-foreground">
                  管理您的账户和应用设置
                </p>
                <button
                  onClick={() => setActiveSection('home')}
                  className="mt-4 text-sm text-[#70E0FF] hover:opacity-80 transition-opacity"
                >
                  ← 返回首页
                </button>
              </div>

              <div className="max-w-2xl space-y-6">
                {/* 基本信息 */}
                <div className="bg-card rounded-2xl p-6 border border-border">
                  <h2 className="text-xl font-bold mb-4">{t('settings.basicInfo')}</h2>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="username">{t('settings.username')}</Label>
                      <Input
                        id="username"
                        value={settingsUsername}
                        onChange={(e) => setSettingsUsername(e.target.value)}
                        placeholder="请输入用户名"
                        className="bg-accent/30 border-border"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">{t('settings.email')}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={settingsEmail}
                        onChange={(e) => setSettingsEmail(e.target.value)}
                        placeholder="请输入邮箱"
                        className="bg-accent/30 border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* 模型连接 */}
                <div className="bg-card rounded-2xl p-6 border border-border">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-[#70E0FF]" />
                        模型连接
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        自带密钥模式，适合公网发布后让用户接入自己的 OpenAI 兼容服务。
                      </p>
                    </div>
                    <div className="rounded-full bg-[#4F6CFF]/15 px-3 py-1 text-xs font-medium text-[#9EEBFF]">
                      BYOK
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-foreground font-medium mb-2 block">服务类型</Label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {[
                          { id: 'openai-compatible', name: 'OpenAI 兼容', desc: '/v1 或版本路径' },
                          { id: 'ark-plan', name: '火山 Ark', desc: 'ark api/v3' },
                        ].map((provider) => (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => {
                              setSettingsApiProvider(provider.id as ApiProviderType);
                              if (provider.id === 'ark-plan' && settingsApiBase === 'https://api.openai.com/v1') {
                                setSettingsApiBase('https://ark.cn-beijing.volces.com/api/v3');
                                if (!settingsModel) setSettingsModel('ark-code-latest');
                              }
                            }}
                            className={`rounded-xl border p-3 text-left transition-all ${
                              settingsApiProvider === provider.id
                                ? 'border-[#4F6CFF] bg-[#4F6CFF]/10 text-foreground'
                                : 'border-border bg-secondary/40 text-muted-foreground hover:border-[#4F6CFF]/40'
                            }`}
                          >
                            <div className="text-sm font-semibold">{provider.name}</div>
                            <div className="mt-1 text-xs opacity-75">{provider.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="api-base">API Base</Label>
                      <Input
                        id="api-base"
                        value={settingsApiBase}
                        onChange={(e) => setSettingsApiBase(e.target.value)}
                        placeholder="https://api.openai.com/v1 或 https://ark.cn-beijing.volces.com/api/v3"
                        className="bg-accent/30 border-border"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        填写到版本路径，例如 OpenAI 兼容服务通常以 /v1 结尾，火山 Ark 视频接口使用 /api/v3。
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="api-key">API Key</Label>
                      <Input
                        id="api-key"
                        type="password"
                        value={settingsApiKey}
                        onChange={(e) => setSettingsApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="bg-accent/30 border-border"
                        autoComplete="off"
                      />
                    </div>

                    <div>
                      <Label htmlFor="default-model">默认文本模型（可选）</Label>
                      <Input
                        id="default-model"
                        value={settingsModel}
                        onChange={(e) => setSettingsModel(e.target.value)}
                        placeholder="gpt-4o-mini / ark-code-latest / deepseek-chat"
                        className="bg-accent/30 border-border"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="image-model">图片模型（可选）</Label>
                        <Input
                          id="image-model"
                          value={settingsImageModel}
                          onChange={(e) => setSettingsImageModel(e.target.value)}
                          placeholder="gpt-image-1 / doubao-seedream-..."
                          className="bg-accent/30 border-border"
                        />
                      </div>
                      <div>
                        <Label htmlFor="video-model">视频模型（可选）</Label>
                        <Input
                          id="video-model"
                          value={settingsVideoModel}
                          onChange={(e) => setSettingsVideoModel(e.target.value)}
                          placeholder="doubao-seedance-1-5-pro-..."
                          className="bg-accent/30 border-border"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-secondary/40 p-3">
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#70E0FF]" />
                        <p>
                          API Key 仅保存在当前浏览器 localStorage；连接测试和后续生成时会通过本站服务端代理转发，请确保公网部署启用 HTTPS。测试连接只检查供应商可达性；测试文本请求会对默认文本模型发起 1 token 探针；测试图片请求会调用图片生成端点，可能产生供应商最小调用费用。视频生成使用视频模型，长视频会按片段逐级提交并在任务中心显示进度。
                        </p>
                      </div>
                    </div>

                    {apiConnectionStatus.message && (
                      <div
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          apiConnectionStatus.type === 'success'
                            ? 'border-[#70E0FF]/30 bg-[#70E0FF]/10 text-[#BDF4FF]'
                            : apiConnectionStatus.type === 'error'
                              ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
                              : 'border-border bg-secondary/50 text-muted-foreground'
                        }`}
                      >
                        {apiConnectionStatus.message}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => testApiConnection('models')}
                        disabled={apiConnectionStatus.type === 'testing'}
                        className="bg-gradient-to-r from-[#4F6CFF] to-[#8B5CF6] text-white shadow-lg shadow-[#4F6CFF]/20 hover:opacity-90"
                      >
                        {apiConnectionStatus.type === 'testing' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            验证中
                          </>
                        ) : (
                          '测试连接'
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => testApiConnection('chat')}
                        disabled={apiConnectionStatus.type === 'testing'}
                      >
                        {apiConnectionStatus.type === 'testing' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            验证中
                          </>
                        ) : (
                          '测试文本请求'
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => testApiConnection('image')}
                        disabled={apiConnectionStatus.type === 'testing'}
                      >
                        {apiConnectionStatus.type === 'testing' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            验证中
                          </>
                        ) : (
                          '测试图片请求'
                        )}
                      </Button>
                      <Button type="button" variant="outline" onClick={saveApiConnectionSettings}>
                        保存到本机
                      </Button>
                      <Button type="button" variant="ghost" onClick={clearApiConnectionSettings}>
                        清除配置
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 主题外观 */}
                <div className="bg-card rounded-2xl p-6 border border-border">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-[#70E0FF]" />
                    {t('settings.appearance')}
                  </h2>
                  <div className="space-y-5">
                    {/* 暗色模式 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{t('settings.darkMode')}</p>
                        <p className="text-sm text-muted-foreground">{t('settings.darkModeDesc')}</p>
                      </div>
                      <button
                        onClick={() => {
                          toggleColorMode();
                          localStorage.setItem('dreambox-dark-mode', String(!isDark));
                        }}
                        className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors bg-accent"
                        style={{ backgroundColor: isDark ? '#4F6CFF' : undefined }}
                      >
                        <span
                          className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                          style={{ transform: isDark ? 'translateX(24px)' : 'translateX(4px)' }}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 字体设置 */}
                <div className="bg-card rounded-2xl p-6 border border-border">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Type className="w-5 h-5 text-[#70E0FF]" />
                    字体设置
                  </h2>
                  <div className="space-y-5">
                    {/* 字体风格选择 */}
                    <div>
                      <Label className="text-foreground font-medium mb-2 block">{t('settings.fontStyle')}</Label>
                      <p className="text-sm text-muted-foreground mb-3">{t('settings.fontStyleDesc')}</p>
                      {(() => {
                        const fontCategories = [
                          { label: '中文基础', fonts: [
                            { id: 'default', name: '默认无衬线', font: "'Noto Sans SC', sans-serif", preview: '绘影' },
                            { id: 'notoSans', name: '思源黑体', font: "'Noto Sans SC', sans-serif", preview: '绘影' },
                            { id: 'notoSerif', name: '思源宋体', font: "'Noto Serif SC', Georgia, serif", preview: '绘影' },
                          ]},
                          { label: '中文艺术', fonts: [
                            { id: 'lxgwWenkai', name: '霞鹜文楷', font: "'LXGW WenKai', sans-serif", preview: '绘影' },
                            { id: 'maShanZheng', name: '马善政楷', font: "'Ma Shan Zheng', cursive", preview: '绘影' },
                            { id: 'zcoolkuaile', name: '站酷快乐体', font: "'ZCOOL KuaiLe', cursive", preview: '绘影' },
                            { id: 'zcoolQingke', name: '站酷庆科黄油', font: "'ZCOOL QingKe HuangYou', cursive", preview: '绘影' },
                            { id: 'zhimangxing', name: '志莽行书', font: "'Zhi Mang Xing', cursive", preview: '绘影' },
                            { id: 'liujianmaocao', name: '刘建毛草', font: "'Liu Jian Mao Cao', cursive", preview: '绘影' },
                            { id: 'longcang', name: '龙藏体', font: "'Long Cang', cursive", preview: '绘影' },
                          ]},
                          { label: '日本語', fonts: [
                            { id: 'notoSansJp', name: 'Noto Sans JP', font: "'Noto Sans JP', sans-serif", preview: 'こんにちは' },
                            { id: 'notoSerifJp', name: 'Noto Serif JP', font: "'Noto Serif JP', serif", preview: 'こんにちは' },
                            { id: 'zenMaru', name: 'Zen Maru Gothic', font: "'Zen Maru Gothic', sans-serif", preview: '丸ゴシック' },
                            { id: 'kosugiMaru', name: 'Kosugi Maru', font: "'Kosugi Maru', sans-serif", preview: '小杉丸' },
                          ]},
                          { label: '한국어', fonts: [
                            { id: 'notoSansKr', name: 'Noto Sans KR', font: "'Noto Sans KR', sans-serif", preview: '안녕하세요' },
                            { id: 'blackHanSans', name: 'Black Han Sans', font: "'Black Han Sans', sans-serif", preview: '블랙한산스' },
                            { id: 'doHyeon', name: 'Do Hyeon', font: "'Do Hyeon', sans-serif", preview: '도현체' },
                          ]},
                          { label: 'Western', fonts: [
                            { id: 'inter', name: 'Inter', font: "'Inter', sans-serif", preview: 'HuiYing Studio' },
                            { id: 'poppins', name: 'Poppins', font: "'Poppins', sans-serif", preview: 'HuiYing Studio' },
                            { id: 'spaceGrotesk', name: 'Space Grotesk', font: "'Space Grotesk', sans-serif", preview: 'HuiYing Studio' },
                            { id: 'playfair', name: 'Playfair Display', font: "'Playfair Display', serif", preview: 'HuiYing Studio' },
                          ]},
                          { label: '编程等宽', fonts: [
                            { id: 'firaCode', name: 'Fira Code', font: "'Fira Code', monospace", preview: '=> {} []' },
                            { id: 'sourceCode', name: 'Source Code Pro', font: "'Source Code Pro', monospace", preview: '=> {} []' },
                            { id: 'monospace', name: '系统等宽', font: "monospace", preview: '=> {} []' },
                          ]},
                        ];
                        return fontCategories.map(cat => (
                          <div key={cat.label} className="mb-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-1.5 px-0.5">{cat.label}</p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {cat.fonts.map((f) => (
                                <button
                                  key={f.id}
                                  onClick={() => setSettingsFontStyle(f.id)}
                                  className={`p-2.5 rounded-lg border-2 transition-all text-left ${
                                    settingsFontStyle === f.id
                                      ? 'border-[#4F6CFF] bg-[#4F6CFF]/10'
                                      : 'border-border hover:border-[#4F6CFF]/30'
                                  }`}
                                >
                                  <p className="text-[10px] text-muted-foreground mb-0.5 truncate">{f.name}</p>
                                  <p className="text-sm font-medium truncate" style={{ fontFamily: f.font }}>
                                    {f.preview}
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>

                    {/* 字体大小 */}
                    <div>
                      <Label className="text-foreground font-medium mb-2 block">
                        {t('settings.fontSize')}
                        <span className="text-muted-foreground font-normal ml-2">{settingsFontSize}px</span>
                      </Label>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground">A</span>
                        <input
                          type="range"
                          min={12}
                          max={20}
                          step={1}
                          value={settingsFontSize}
                          onChange={(e) => setSettingsFontSize(Number(e.target.value))}
                          className="flex-1 h-2 rounded-full appearance-none bg-accent cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#4F6CFF]
                            [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                        <span className="text-lg text-muted-foreground font-bold">A</span>
                      </div>
                    </div>

                    {/* 字体预览 */}
                    <div className="bg-accent/20 rounded-xl p-4 space-y-2">
                      <p className="text-xs text-muted-foreground mb-2">字体预览</p>
                      <p className="text-xl font-bold">绘影 — AI 短片创作平台</p>
                      <p className="text-base">支持视频生成、图片生成、数字人、图文创作等功能</p>
                      <p className="text-sm text-muted-foreground">AI驱动的专业影视创作工具，让创意触手可及</p>
                    </div>
                  </div>
                </div>

                {/* 偏好设置 */}
                <div className="bg-card rounded-2xl p-6 border border-border">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-[#70E0FF]" />
                    {t('settings.preferences')}
                  </h2>
                  <div className="space-y-4">
                    {/* 语言选择 */}
                    <div>
                      <Label className="text-foreground font-medium mb-2 block">{t('settings.language')}</Label>
                      <p className="text-sm text-muted-foreground mb-3">{t('settings.languageDesc')}</p>
                      <div className="grid grid-cols-2 gap-1.5 max-h-[360px] overflow-y-auto pr-1">
                        {[
                          { id: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
                          { id: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
                          { id: 'en-US', name: 'English', flag: '🇺🇸' },
                          { id: 'ja-JP', name: '日本語', flag: '🇯🇵' },
                          { id: 'ko-KR', name: '한국어', flag: '🇰🇷' },
                          { id: 'fr-FR', name: 'Français', flag: '🇫🇷' },
                          { id: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
                          { id: 'es-ES', name: 'Español', flag: '🇪🇸' },
                          { id: 'pt-BR', name: 'Português', flag: '🇧🇷' },
                          { id: 'ru-RU', name: 'Русский', flag: '🇷🇺' },
                          { id: 'it-IT', name: 'Italiano', flag: '🇮🇹' },
                          { id: 'th-TH', name: 'ไทย', flag: '🇹🇭' },
                          { id: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳' },
                          { id: 'id-ID', name: 'Bahasa Indonesia', flag: '🇮🇩' },
                          { id: 'ar-SA', name: 'العربية', flag: '🇸🇦' },
                          { id: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳' },
                        ].map((lang) => (
                          <button
                            key={lang.id}
                            onClick={() => {
                              setSettingsLanguage(lang.id);
                              updateUserSettings({ language: lang.id as UserSettings['language'] });
                            }}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all ${
                              settingsLanguage === lang.id
                                ? 'border-[#4F6CFF] bg-[#4F6CFF]/10'
                                : 'border-border hover:border-[#4F6CFF]/30'
                            }`}
                          >
                            <span className="text-base">{lang.flag}</span>
                            <span className="font-medium text-foreground text-sm truncate">{lang.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 通知 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">提示通知</p>
                        <p className="text-sm text-muted-foreground">任务完成后显示通知</p>
                      </div>
                      <button
                        onClick={() => setSettingsNotification(!settingsNotification)}
                        className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors bg-accent"
                        style={{ backgroundColor: settingsNotification ? '#4F6CFF' : undefined }}
                      >
                        <span
                          className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                          style={{ transform: settingsNotification ? 'translateX(24px)' : 'translateX(4px)' }}
                        />
                      </button>
                    </div>

                    {/* 自动保存 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">自动保存</p>
                        <p className="text-sm text-muted-foreground">自动保存创作进度</p>
                      </div>
                      <button
                        onClick={() => setSettingsAutoSave(!settingsAutoSave)}
                        className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors bg-accent"
                        style={{ backgroundColor: settingsAutoSave ? '#4F6CFF' : undefined }}
                      >
                        <span
                          className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                          style={{ transform: settingsAutoSave ? 'translateX(24px)' : 'translateX(4px)' }}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 历史记录管理 */}
                <div className="bg-card rounded-2xl p-6 border border-border">
                  <h2 className="text-xl font-bold mb-4">历史记录管理</h2>
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      onClick={handleClearVideoHistory}
                      className="w-full justify-start text-left border-amber-400/20 text-amber-200 hover:bg-amber-400/10"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      清空视频历史
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleClearImageHistory}
                      className="w-full justify-start text-left border-amber-400/20 text-amber-200 hover:bg-amber-400/10"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      清空图片历史
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}


    </>
  );
}
