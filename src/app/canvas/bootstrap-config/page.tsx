'use client';

import { useEffect, useState } from 'react';

// 一键把画布 config 指向本地 agent-proxy（火山 ARK），不依赖 icanvas 的配置 Modal。
// agent/文本走 MODEL；图片走 Seedream；视频必须是 seedance 模型，icanvas 才会走
// /contents/generations/tasks（被代理转发到 ARK），否则会落到 OpenAI /videos 导致 404。
const PROXY_BASE = '/api/canvas/agent-proxy';
const MODEL = 'doubao-seed-2.0-pro';
const IMAGE_MODEL = 'doubao-seedream-5-0-260128';
const VIDEO_MODEL = 'doubao-seedance-1-5-pro-251215';
const ALL_MODELS = [MODEL, IMAGE_MODEL, VIDEO_MODEL];
const STORE_KEY = 'infinite-canvas:ai_config_store';
const PLACEHOLDER_KEY = 'ark-proxy';

export default function BootstrapConfigPage() {
  const [status, setStatus] = useState<'idle' | 'done' | 'reset' | 'skip'>('idle');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isReset = params.get('reset') === '1';
    try {
      if (isReset) {
        localStorage.removeItem(STORE_KEY);
        setStatus('reset');
        setStatus('done'); setTimeout(() => { window.location.href = '/canvas'; }, 800);
        return;
      }
      const raw = localStorage.getItem(STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const version = parsed.version ?? 0;
      const oldCfg = parsed.state?.config || {};
      const channels = Array.isArray(oldCfg.channels) ? oldCfg.channels : [];
      const baseChannel = { id: 'default', name: '默认渠道', baseUrl: PROXY_BASE, apiKey: PLACEHOLDER_KEY, apiFormat: 'openai' as const, models: ALL_MODELS };
      const updated = {
        ...parsed,
        version,
        state: {
          ...parsed.state,
          config: {
            ...oldCfg,
            baseUrl: PROXY_BASE,
            apiKey: PLACEHOLDER_KEY,
            model: MODEL,
            textModel: MODEL,
            imageModel: IMAGE_MODEL,
            videoModel: VIDEO_MODEL,
            audioModel: MODEL,
            apiFormat: 'openai',
            channels: channels.length
              ? channels.map((ch: { name?: string; models?: string[] }) => ({ ...ch, baseUrl: PROXY_BASE, apiKey: PLACEHOLDER_KEY, apiFormat: 'openai', models: ALL_MODELS }))
              : [baseChannel],
            textModels: [MODEL],
            models: ALL_MODELS,
          },
        },
      };
      localStorage.setItem(STORE_KEY, JSON.stringify(updated));
      setStatus('done');
      setStatus('done'); setTimeout(() => { window.location.href = '/canvas'; }, 800);
    } catch (e) {
      setStatus('skip');
    }
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#fafafa', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 14 }}>{status === 'done' ? '画布 Agent 已指向本地火山 ARK 代理，正在跳回画布...' : status === 'reset' ? '已恢复默认配置，正在跳回画布...' : status === 'skip' ? '配置写入失败，请手动在浏览器控制台执行。' : '正在配置...'}</p>
        <p style={{ fontSize: 12, opacity: 0.5, marginTop: 12 }}>出问题？访问 /canvas/bootstrap-config?reset=1 恢复默认</p>
      </div>
    </div>
  );
}


