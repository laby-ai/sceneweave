'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { FONT_SIZE_OPTIONS, FONT_STYLE_OPTIONS } from '@/constants/themes';
import { useEffect } from 'react';

export function GlobalStyles() {
  const { userSettings } = useTheme();

  useEffect(() => {
    // 应用字体大小
    const root = document.documentElement;
    
    // 字体大小
    const fontSizeOption = FONT_SIZE_OPTIONS.find(f => f.value === userSettings.fontSize);
    if (fontSizeOption) {
      root.style.fontSize = fontSizeOption.size;
    }

    // 字体风格
    const fontStyleOption = FONT_STYLE_OPTIONS.find(f => f.value === userSettings.fontStyle);
    if (fontStyleOption) {
      // 移除之前的字体类
      root.classList.remove('font-sans', 'font-serif', 'font-mono');
      // 添加新的字体类
      root.classList.add(fontStyleOption.fontClass);
    }
  }, [userSettings.fontSize, userSettings.fontStyle]);

  return null;
}
