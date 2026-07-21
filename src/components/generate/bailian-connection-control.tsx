'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Settings2, Trash2, X } from 'lucide-react';

import { clientApiFetch, ClientRequestError } from '@/lib/client-api';
import {
  BAILIAN_IMAGE_MODEL,
  BAILIAN_TEXT_MODEL,
  BAILIAN_TTS_MODEL,
  BAILIAN_VIDEO_MODEL,
} from '@/lib/account/member-bailian-profile';

type PublicProfile = {
  configured: boolean;
  secret_mask?: string;
  text_model: string;
  image_model: string;
  tts_model: string;
};

type ProfileResponse = { profile: PublicProfile };

export function BailianConnectionControl() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const loadProfile = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await clientApiFetch<ProfileResponse>('/api/account/provider-profile', {
        redirectOnUnauthorized: false,
      });
      setProfile(result.profile);
      if (!result.profile.configured) setOpen(true);
    } catch (cause) {
      setProfile(null);
      setError(cause instanceof ClientRequestError && cause.status === 401
        ? '请先登录，再为当前账号配置百炼模型。'
        : '百炼配置暂时无法读取，请稍后重试。');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const save = async () => {
    if (!apiKey.trim()) {
      setError('请填写百炼 API Key。');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await clientApiFetch<ProfileResponse>('/api/account/provider-profile', {
        method: 'PUT',
        body: JSON.stringify({
          api_key: apiKey.trim(),
          region: 'cn-beijing',
        }),
        redirectOnUnauthorized: false,
      });
      setProfile(result.profile);
      setApiKey('');
      setNotice('已保存到当前账号。后续生成由服务端安全读取，不会把密钥返回浏览器。');
    } catch (cause) {
      setError(cause instanceof ClientRequestError && cause.status === 401
        ? '登录已失效，请重新登录后保存。'
        : '保存失败，请检查 API Key。');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await clientApiFetch<ProfileResponse>('/api/account/provider-profile', {
        method: 'DELETE',
        redirectOnUnauthorized: false,
      });
      setProfile(result.profile);
      setApiKey('');
      setNotice('当前账号的百炼配置已移除。');
    } catch {
      setError('移除失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  const configured = profile?.configured === true;

  return (
    <div className="relative" data-testid="bailian-model-settings">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition ${configured
          ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15'
          : 'border-white/15 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10'}`}
        aria-expanded={open}
        aria-label="百炼模型设置"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : configured ? <Check className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
        {configured ? '百炼已配置' : '先配置模型'}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-[410px] max-w-[calc(100vw-24px)] rounded-2xl border border-white/12 bg-[#11151e] p-4 text-slate-100 shadow-[0_24px_70px_rgba(0,0,0,0.48)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">当前账号的百炼模型</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">密钥由账号中心加密保存，生成时仅在服务端内存中使用。</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="关闭模型设置">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">
              API Key
              <input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={configured ? `已保存 ${profile?.secret_mask || ''}，重新填写可更新` : '输入百炼 API Key'} autoComplete="new-password" className="mt-1.5 w-full rounded-lg border border-white/12 bg-black/20 px-3 py-2.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-blue-400/70" />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs text-slate-300 sm:grid-cols-4">
            <div><span className="block text-[10px] text-slate-500">规划</span><span className="mt-1 block font-medium">{BAILIAN_TEXT_MODEL}</span></div>
            <div><span className="block text-[10px] text-slate-500">参考图</span><span className="mt-1 block font-medium">{BAILIAN_IMAGE_MODEL}</span></div>
            <div><span className="block text-[10px] text-slate-500">视频</span><span className="mt-1 block font-medium">{BAILIAN_VIDEO_MODEL}</span></div>
            <div><span className="block text-[10px] text-slate-500">配音</span><span className="mt-1 block font-medium">{BAILIAN_TTS_MODEL}</span></div>
          </div>
          <p className="mt-3 rounded-lg bg-blue-400/10 px-3 py-2 text-[11px] leading-5 text-slate-400">保存不会调用模型或产生费用。开始生成前仍会显示真实任务与费用确认。</p>
          {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
          {notice ? <p className="mt-2 text-xs text-emerald-300">{notice}</p> : null}
          <div className="mt-4 flex items-center justify-between">
            {configured ? (
              <button type="button" onClick={() => void clear()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-rose-300 hover:bg-rose-400/10 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" /> 移除配置
              </button>
            ) : <span />}
            <button type="button" onClick={() => void save()} disabled={busy} className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">
              {busy ? '处理中…' : '保存到当前账号'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
