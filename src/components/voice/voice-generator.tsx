'use client';

import { useState } from 'react';
import { Download, Loader2, Mic, Play } from 'lucide-react';

const VOICES = [
  '女声-温柔', '女声-活力', '女声-甜美', '女声-成熟', '女声-童声',
  '男声-沉稳', '男声-磁性', '男声-青年', '男声-老年', '男声-童声',
];

export function VoiceGenerator() {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState(VOICES[0]);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    const content = text.trim();
    if (!content || loading) return;
    setLoading(true);
    setError(null);
    setAudioUrl(null);
    try {
      const response = await fetch('/api/tts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceType: voice, text: content, speechSpeed: speed }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.url) {
        throw new Error(data.error || '语音合成失败');
      }
      setAudioUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '配音生成失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">配音文本</label>
        <textarea
          value={text}
          onChange={event => setText(event.target.value)}
          rows={6}
          maxLength={1000}
          placeholder="输入要配音的文本，最多 1000 字…"
          className="w-full resize-none rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-[#4F6CFF]/50"
        />
        <div className="mt-1 text-right text-xs text-muted-foreground">{text.length}/1000</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">音色</label>
          <div className="flex flex-wrap gap-2">
            {VOICES.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setVoice(item)}
                className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  voice === item ? 'bg-[#4F6CFF]/15 text-[#70E0FF] ring-1 ring-[#4F6CFF]/30' : 'border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">语速 {speed.toFixed(1)}x</label>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={speed}
            onChange={event => setSpeed(Number(event.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={!text.trim() || loading}
        className="flex items-center gap-2 rounded-xl bg-[#4F6CFF] px-5 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
        {loading ? '正在合成…' : '生成配音'}
      </button>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
      )}

      {audioUrl && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-foreground"><Play className="h-4 w-4 text-[#70E0FF]" /> 合成结果</div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={audioUrl} controls className="w-full" />
          <a
            href={audioUrl}
            download={`配音-${voice}.mp3`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" /> 下载音频
          </a>
        </div>
      )}
    </div>
  );
}
