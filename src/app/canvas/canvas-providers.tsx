'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'antd/dist/reset.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { getAntThemeConfig } from '@/icanvas/lib/app-theme';
import { useThemeStore } from '@/icanvas/stores/use-theme-store';
import { useConfigStore } from '@/icanvas/stores/use-config-store';
import { ClientRootInit } from '@/icanvas/components/layout/client-root-init';
import { CanvasErrorBoundary } from './canvas-error-boundary';

// 画布 Agent 默认指向本地 ARK 代理，不依赖 localStorage bootstrap。
const ARK_PROXY_BASE = '/api/canvas/agent-proxy/v1';
const ARK_PROXY_MODEL = 'minimax-m3';
const ARK_PROXY_KEY = 'ark-proxy';

export function CanvasProviders({ children }: { children: ReactNode }) {
  const theme = useThemeStore((state: { theme: string }) => state.theme);
  const dark = theme === 'dark';
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 },
        },
      }),
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);

  // 在顶层注入代理 config，确保 icanvas 一定用代理，不依赖 localStorage 或子组件渲染时机。
  useEffect(() => {
    const cfg = useConfigStore.getState().config;
    if (cfg.baseUrl === ARK_PROXY_BASE && cfg.apiKey === ARK_PROXY_KEY) return;
    const channels = Array.isArray(cfg.channels) && cfg.channels.length ? cfg.channels : [{ id: 'default', name: '默认渠道', baseUrl: ARK_PROXY_BASE, apiKey: ARK_PROXY_KEY, apiFormat: 'openai' as const, models: [ARK_PROXY_MODEL] }];
    useConfigStore.setState({
      config: {
        ...cfg,
        baseUrl: ARK_PROXY_BASE,
        apiKey: ARK_PROXY_KEY,
        apiFormat: 'openai',
        model: ARK_PROXY_MODEL,
        textModel: ARK_PROXY_MODEL,
        textModels: [ARK_PROXY_MODEL],
        models: [ARK_PROXY_MODEL],
        channels: channels.map((ch: { baseUrl?: string; apiKey?: string; apiFormat?: string; models?: string[] }) => ({
          ...ch,
          baseUrl: ARK_PROXY_BASE,
          apiKey: ARK_PROXY_KEY,
          apiFormat: 'openai',
          models: Array.isArray(ch.models) && ch.models.length ? ch.models : [ARK_PROXY_MODEL],
        })),
      },
    });
  }, []);

  // 隐藏画布 Agent 面板中不需要对外暴露的控件 + 替换品牌名
  useEffect(() => {
    const hide = () => {
      // 隐藏 Select trigger（模型名/渠道选择器）
      document.querySelectorAll('[data-slot="select-trigger"]').forEach(el => { (el as HTMLElement).style.display = 'none'; });
      // 隐藏网站/本机切换按钮组
      document.querySelectorAll('.ant-drawer-content, .infinite-canvas-dark').forEach(container => {
        container.querySelectorAll('.inline-flex.rounded-lg.border').forEach(el => { if ((el.className || '').includes('p-0')) (el as HTMLElement).style.display = 'none'; });
      });
      // 替换 "Infinite Canvas" 为 "绘影画布"
      document.querySelectorAll('span, div, p, button').forEach(el => {
        if (el.children.length === 0) {
          const text = el.textContent;
          if (text && text.includes('Infinite Canvas')) {
            el.textContent = text.replace(/Infinite Canvas/g, '绘影画布');
          }
        }
      });
    };
    hide();
    const observer = new MutationObserver(() => hide());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <AntdRegistry>
      <ConfigProvider locale={zhCN} theme={getAntThemeConfig(dark)}>
        <QueryClientProvider client={queryClient}>
          <App>
            <ClientRootInit>
              <CanvasErrorBoundary label="canvas-root">{children}</CanvasErrorBoundary>
            </ClientRootInit>
          </App>
        </QueryClientProvider>
      </ConfigProvider>
    </AntdRegistry>
  );
}
