'use client';

import { useEffect, useState } from 'react';
import { Check, KeyRound, Trash2, X } from 'lucide-react';

import {
  clearHappyHorseSessionConnection,
  getHappyHorseSessionConnectionSummary,
  saveHappyHorseSessionConnection,
} from '@/lib/byok-client';

interface HappyHorseConnectionControlProps {
  storageScope?: string;
  onConnectionChange: () => void;
}

export function HappyHorseConnectionControl({
  storageScope = '',
  onConnectionChange,
}: HappyHorseConnectionControlProps) {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [apiBase, setApiBase] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [videoModel, setVideoModel] = useState('happyhorse-1.1-t2v');
  const [error, setError] = useState('');

  useEffect(() => {
    const summary = getHappyHorseSessionConnectionSummary(storageScope);
    setConfigured(summary.configured);
    setApiBase(summary.apiBase);
    setVideoModel(summary.videoModel);
    setApiKey('');
    setError('');
  }, [storageScope]);

  const save = () => {
    if (!apiBase.trim() || !apiKey.trim()) {
      setError('请填写工作空间 API Base 和 API Key。');
      return;
    }
    try {
      const parsed = new URL(apiBase.trim());
      if (parsed.protocol !== 'https:') throw new Error('invalid protocol');
    } catch {
      setError('API Base 必须是有效的 HTTPS 地址。');
      return;
    }
    saveHappyHorseSessionConnection(storageScope, { apiBase, apiKey, videoModel });
    setConfigured(true);
    setApiKey('');
    setError('');
    setOpen(false);
    onConnectionChange();
  };

  const clear = () => {
    clearHappyHorseSessionConnection(storageScope);
    setConfigured(false);
    setApiBase('');
    setApiKey('');
    setVideoModel('happyhorse-1.1-t2v');
    setError('');
    setOpen(false);
    onConnectionChange();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${configured
          ? 'border-[#b9e7d2] bg-[#effaf5] text-[#16825b] hover:bg-[#e6f7ef]'
          : 'border-[#e1e5eb] bg-white text-[#68717d] hover:border-[#cbd5e4] hover:text-[#272b32]'}`}
        title="连接快乐马视频模型"
      >
        {configured ? <Check className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
        {configured ? '快乐马已连接' : '连接快乐马'}
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-[360px] rounded-2xl border border-[#e1e5eb] bg-white p-4 text-[#252931] shadow-[0_20px_50px_rgba(31,41,55,0.16)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">快乐马视频连接</p>
              <p className="mt-1 text-xs leading-5 text-[#7a828e]">仅保存在当前标签页会话，不写入项目或服务器配置。</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-[#8a929e] hover:bg-[#f4f6f8]" aria-label="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="block text-xs font-medium text-[#626a76]">
            API Base
            <input
              value={apiBase}
              onChange={event => setApiBase(event.target.value)}
              placeholder="https://你的工作空间域名/api/v1"
              autoComplete="off"
              className="mt-1.5 w-full rounded-lg border border-[#dfe4eb] bg-[#f9fafb] px-3 py-2 text-xs outline-none transition focus:border-[#9bb8ff] focus:bg-white"
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-[#626a76]">
            API Key
            <input
              type="password"
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              placeholder={configured ? '重新填写后可更新连接' : '输入工作空间 API Key'}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-lg border border-[#dfe4eb] bg-[#f9fafb] px-3 py-2 text-xs outline-none transition focus:border-[#9bb8ff] focus:bg-white"
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-[#626a76]">
            视频模型
            <input
              value={videoModel}
              onChange={event => setVideoModel(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#dfe4eb] bg-[#f9fafb] px-3 py-2 text-xs outline-none transition focus:border-[#9bb8ff] focus:bg-white"
            />
          </label>
          {error ? <p className="mt-2 text-xs text-[#c64242]">{error}</p> : null}

          <div className="mt-4 flex items-center justify-between">
            {configured ? (
              <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[#8a4b4b] hover:bg-[#fff1f1]">
                <Trash2 className="h-3.5 w-3.5" /> 清除
              </button>
            ) : <span />}
            <button type="button" onClick={save} className="rounded-lg bg-[#2f6bff] px-3.5 py-2 text-xs font-medium text-white transition hover:bg-[#245be0]">
              保存到当前会话
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
