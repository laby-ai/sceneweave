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

  // 隐藏画布 Agent 面板中不需要对外暴露的控件：用一次性注入的 CSS 处理，
  // 不再在每次 DOM 变动时全文档 querySelectorAll（那是之前卡死/点击无反应的主因）。
  useEffect(() => {
    const STYLE_ID = 'huiying-canvas-hide-style';
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = [
        '[data-slot="select-trigger"]{display:none !important;}',
        '.ant-drawer-content .inline-flex.rounded-lg.border.p-0,',
        '.infinite-canvas-dark .inline-flex.rounded-lg.border.p-0{display:none !important;}',
      ].join('\n');
      document.head.appendChild(style);
    }
  }, []);

  // 品牌名替换 "Infinite Canvas" → "绘影画布"：用 TreeWalker 只扫文本节点，
  // 仅处理 MutationObserver 报告的新增子树，并做尾部防抖，避免高频全量扫描。
  useEffect(() => {
    const BRAND_FROM = /Infinite Canvas/g;
    const BRAND_TO = '绘影画布';

    const replaceIn = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null = walker.nextNode();
      while (node) {
        const value = node.nodeValue;
        if (value && value.includes('Infinite Canvas')) {
          node.nodeValue = value.replace(BRAND_FROM, BRAND_TO);
        }
        node = walker.nextNode();
      }
    };

    replaceIn(document.body);

    let scheduled = 0;
    const pending: Node[] = [];
    const flush = () => {
      scheduled = 0;
      const roots = pending.splice(0, pending.length);
      for (const root of roots) {
        if (root.isConnected) replaceIn(root);
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((added) => {
          if (added.nodeType === Node.ELEMENT_NODE || added.nodeType === Node.TEXT_NODE) {
            pending.push(added);
          }
        });
      }
      if (pending.length && !scheduled) {
        scheduled = window.setTimeout(flush, 300);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (scheduled) window.clearTimeout(scheduled);
    };
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
