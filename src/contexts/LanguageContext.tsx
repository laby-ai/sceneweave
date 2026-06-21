'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useTheme } from './ThemeContext';
import { TRANSLATIONS, t as translate } from '@/constants/languages';

interface LanguageContextType {
  t: (key: string) => string;
  currentLanguage: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { userSettings } = useTheme();

  const t = (key: string): string => {
    return translate(key, userSettings.language);
  };

  return (
    <LanguageContext.Provider value={{ t, currentLanguage: userSettings.language }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
