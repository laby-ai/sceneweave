'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DEFAULT_THEMES, DEFAULT_USER_SETTINGS, type ThemeConfig, type UserSettings } from '@/constants/themes';

const THEME_VERSION = 'huiying-blue-violet-v1';

interface ThemeContextType {
  theme: ThemeConfig;
  setTheme: (themeId: string) => void;
  themeGradient: string;
  themePrimaryColor: string;
  userSettings: UserSettings;
  updateUserSettings: (settings: Partial<UserSettings>) => void;
  allThemes: ThemeConfig[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentThemeId, setCurrentThemeId] = useState<string>('default');
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  // 从 localStorage 读取设置
  useEffect(() => {
    const savedThemeVersion = localStorage.getItem('app-theme-version');
    if (savedThemeVersion !== THEME_VERSION) {
      setCurrentThemeId('default');
      localStorage.setItem('app-theme-version', THEME_VERSION);
      localStorage.setItem('app-theme-id', 'default');
      return;
    }

    const savedThemeId = localStorage.getItem('app-theme-id');
    const savedSettings = localStorage.getItem('user-settings');
    
    if (savedThemeId && DEFAULT_THEMES.find(t => t.id === savedThemeId)) {
      setCurrentThemeId(savedThemeId);
    }
    
    if (savedSettings) {
      try {
        setUserSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Failed to parse user settings:', error);
      }
    }
  }, []);

  // 保存主题到 localStorage
  const handleSetTheme = (themeId: string) => {
    if (DEFAULT_THEMES.find(t => t.id === themeId)) {
      setCurrentThemeId(themeId);
      localStorage.setItem('app-theme-id', themeId);
    }
  };

  // 更新用户设置
  const updateUserSettings = (settings: Partial<UserSettings>) => {
    const newSettings = { ...userSettings, ...settings };
    setUserSettings(newSettings);
    localStorage.setItem('user-settings', JSON.stringify(newSettings));
    
    // 如果主题ID变化了，同时更新主题
    if (settings.themeId && settings.themeId !== currentThemeId) {
      handleSetTheme(settings.themeId);
    }
  };

  const currentTheme = DEFAULT_THEMES.find(t => t.id === currentThemeId) || DEFAULT_THEMES[0];

  const value = {
    theme: currentTheme,
    setTheme: handleSetTheme,
    themeGradient: currentTheme.gradient,
    themePrimaryColor: currentTheme.primaryColor,
    userSettings,
    updateUserSettings,
    allThemes: DEFAULT_THEMES,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
