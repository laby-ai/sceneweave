'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { TemplateProvider } from '@/contexts/TemplateContext';
import { CommunityProvider } from '@/contexts/CommunityContext';
import { TaskProvider } from '@/contexts/TaskContext';
import { ColorModeProvider } from '@/contexts/ColorModeContext';
import { GlobalStyles } from '@/components/global-styles';
import { BasePathFetchShim } from '@/components/base-path-fetch-shim';
import { AccountProductAuthGuard } from '@/components/account-product-auth-guard';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ColorModeProvider>
      <ThemeProvider>
        <LanguageProvider>
          <TemplateProvider>
            <CommunityProvider>
              <TaskProvider>
                <AuthProvider>
                  <BasePathFetchShim />
                  <GlobalStyles />
                  <AccountProductAuthGuard>{children}</AccountProductAuthGuard>
                </AuthProvider>
              </TaskProvider>
            </CommunityProvider>
          </TemplateProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ColorModeProvider>
  );
}
