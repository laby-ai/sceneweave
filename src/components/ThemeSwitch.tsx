'use client';

import { useColorMode } from '@/contexts/ColorModeContext';

export default function ThemeSwitch() {
  const { isDark, toggleColorMode } = useColorMode();

  return (
    <div className="flex items-center">
      <input
        type="checkbox"
        id="theme-toggle"
        className="theme-checkbox"
        checked={isDark}
        onChange={toggleColorMode}
      />
      <label htmlFor="theme-toggle" className="theme-switch" aria-label="切换昼夜模式">
        {/* 星空层 (暗黑模式可见) */}
        <div className="stars-container">
          <div className="star star-1" />
          <div className="star star-2" />
          <div className="star star-3" />
          <div className="star star-4" />
          <div className="star star-5" />
          <div className="shooting-star" />
        </div>

        {/* 云朵层 (明亮模式可见) */}
        <div className="clouds-container">
          <div className="cloud cloud-1" />
          <div className="cloud cloud-2" />
          <div className="cloud cloud-3" />
        </div>

        {/* 核心天体 (太阳/月亮) */}
        <div className="celestial-body">
          <div className="crater crater-1" />
          <div className="crater crater-2" />
          <div className="crater crater-3" />
        </div>
      </label>
    </div>
  );
}
