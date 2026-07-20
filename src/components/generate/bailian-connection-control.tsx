'use client';

import { useEffect, useState } from 'react';
import { Check, Settings2, Trash2, X } from 'lucide-react';

import {
  clearBailianSessionConnections,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_PLANNING_MODEL,
  DEFAULT_VIDEO_MODEL,
  getHappyHorseSessionConnectionSummary,
  getPlanningSessionConnectionSummary,
  validateAndSaveBailianSessionConnections,
} from '@/lib/byok-client';

interface BailianConnectionControlProps {
  storageScope?: string;
  requestHeaders?: Record<string, string>;
  onConnectionChange: () => void;
}

export function BailianConnectionControl({
  storageScope = '',
  requestHeaders,
  onConnectionChange,
}: BailianConnectionControlProps) {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    const planning = getPlanningSessionConnectionSummary(storageScope);
    const video = getHappyHorseSessionConnectionSummary(storageScope);
    setConfigured(planning.configured && video.configured);
    setApiKey('');
    setError('');
  }, [storageScope]);

  const save = async () => {
    if (!apiKey.trim()) {
      setError('请填写百炼 API Key。');
      return;
    }
    setValidating(true);
    setError('');
    const result = await validateAndSaveBailianSessionConnections(storageScope, {
      apiKey,
    }, requestHeaders);
    setValidating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfigured(true);
    setApiKey('');
    setOpen(false);
    onConnectionChange();
  };

  const clear = () => {
    clearBailianSessionConnections(storageScope);
    setConfigured(false);
    setApiKey('');
    setError('');
    setOpen(false);
    onConnectionChange();
  };

  return (
    <div className="relative" data-testid="bailian-model-settings">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium shadow-[0_4px_14px_rgba(31,41,55,0.04)] transition ${configured
          ? 'border-[#b9e7d2] bg-[#effaf5] text-[#16825b] hover:bg-[#e6f7ef]'
          : 'border-[#e1e5eb] bg-white text-[#4d5560] hover:border-[#cbd5e4] hover:bg-[#f8faff]'}`}
        aria-expanded={open}
        aria-label="百炼模型设置"
      >
        {configured ? <Check className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
        {configured ? '百炼已连接' : '模型设置'}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-[390px] max-w-[calc(100vw-32px)] rounded-2xl border border-[#e1e5eb] bg-white p-4 text-[#252931] shadow-[0_20px_50px_rgba(31,41,55,0.16)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">百炼模型设置</p>
              <p className="mt-1 text-xs leading-5 text-[#7a828e]">百炼工作空间已由平台统一配置，只需填写 API Key；密钥仅保存在当前访客会话。</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-[#8a929e] hover:bg-[#f4f6f8]" aria-label="关闭模型设置">
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="block text-xs font-medium text-[#626a76]">
            API Key
            <input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={configured ? '重新填写后可更新连接' : '输入百炼工作空间 API Key'} autoComplete="new-password" className="mt-1.5 w-full rounded-lg border border-[#dfe4eb] bg-[#f9fafb] px-3 py-2 text-xs outline-none focus:border-[#9bb8ff] focus:bg-white" />
          </label>
          <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-[#e6eaf0] bg-[#f8f9fb] p-3 text-xs text-[#626a76] sm:grid-cols-3">
            <div><span className="block text-[10px] text-[#9299a4]">文本与视觉</span><span className="mt-1 block font-medium text-[#303640]">{DEFAULT_PLANNING_MODEL}</span></div>
            <div><span className="block text-[10px] text-[#9299a4]">参考图</span><span className="mt-1 block font-medium text-[#303640]">{DEFAULT_IMAGE_MODEL}</span></div>
            <div><span className="block text-[10px] text-[#9299a4]">视频</span><span className="mt-1 block font-medium text-[#303640]">{DEFAULT_VIDEO_MODEL}</span></div>
          </div>
          <p className="mt-3 rounded-lg bg-[#f5f7fa] px-3 py-2 text-[11px] leading-5 text-[#7a828e]">验证会发送一次极小文本探针，确认所选规划模型确实可调用；不会提交视频任务。</p>
          {error ? <p className="mt-2 text-xs text-[#c64242]">{error}</p> : null}
          <div className="mt-4 flex items-center justify-between">
            {configured ? (
              <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[#8a4b4b] hover:bg-[#fff1f1]">
                <Trash2 className="h-3.5 w-3.5" /> 清除连接
              </button>
            ) : <span />}
            <button type="button" onClick={save} disabled={validating} className="rounded-lg bg-[#2f6bff] px-3.5 py-2 text-xs font-medium text-white transition hover:bg-[#245be0] disabled:cursor-wait disabled:opacity-60">
              {validating ? '正在验证…' : '验证并保存'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
