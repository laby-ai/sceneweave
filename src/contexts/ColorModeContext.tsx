'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type ColorMode = 'light' | 'dark';
const COLOR_MODE_VERSION = 'huiying-dark-workbench-v1';

interface ColorModeContextType {
  colorMode: ColorMode;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
  isDark: boolean;
}

const ColorModeContext = createContext<ColorModeContextType | undefined>(undefined);

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>('dark');

  // 从 localStorage 读取 + 尊重系统偏好
  useEffect(() => {
    const savedVersion = localStorage.getItem('color-mode-version');
    if (savedVersion !== COLOR_MODE_VERSION) {
      setColorModeState('dark');
      localStorage.setItem('color-mode-version', COLOR_MODE_VERSION);
      localStorage.setItem('color-mode', 'dark');
      return;
    }

    const saved = localStorage.getItem('color-mode') as ColorMode | null;
    if (saved === 'light' || saved === 'dark') {
      setColorModeState(saved);
    }
  }, []);

  // 同步 .dark class 到 <html> 元素
  useEffect(() => {
    const html = document.documentElement;
    if (colorMode === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    localStorage.setItem('color-mode', colorMode);
  }, [colorMode]);

  const toggleColorMode = useCallback(() => {
    setColorModeState(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
  }, []);

  return (
    <ColorModeContext.Provider value={{ colorMode, toggleColorMode, setColorMode, isDark: colorMode === 'dark' }}>
      {children}
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  const context = useContext(ColorModeContext);
  if (!context) {
    throw new Error('useColorMode must be used within a ColorModeProvider');
  }
  return context;
}
