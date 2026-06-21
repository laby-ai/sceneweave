import { useState } from 'react';
import type { FilmScript } from '@/types/film';
import { renderSafe, type EntityCard } from '@/lib/film-creation-panel-model';

export function WardrobeAddForm({
  cardId,
  onAdd,
}: {
  cardId: string;
  onAdd: (cardId: string, outfit: { name: string; description: string }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd(cardId, { name: name.trim(), description: description.trim() });
    setName('');
    setDescription('');
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-medium text-foreground/50">添加新造型</div>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="造型名称 (如: 战斗装/晚礼服/日常服)"
        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border/50 bg-accent/10 text-foreground/80 placeholder:text-foreground/20 focus:border-primary/50 focus:outline-none"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="造型描述 (如: 白色长裙+金色发饰, 正式场合穿着)"
        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border/50 bg-accent/10 text-foreground/80 placeholder:text-foreground/20 focus:border-primary/50 focus:outline-none resize-none"
        rows={2}
      />
      <button
        onClick={handleSubmit}
        disabled={!name.trim()}
        className="px-3 py-1 text-xs rounded-lg bg-[#EF4444] text-white hover:bg-[#DC2626] transition-colors disabled:opacity-40"
      >
        添加造型
      </button>
    </div>
  );
}

type FilmChatMsg = {
  role: string;
  content: string;
  isStreaming?: boolean;
  quickOptions?: string[];
  generationType?: string | null;
  generationProgress?: number | null;
};

export function FilmChatMessage({
  msg,
  onQuickOption,
}: {
  msg: FilmChatMsg;
  onQuickOption: (opt: string) => void;
  entityCards: EntityCard[];
  script: FilmScript | null;
}) {
  const isUser = msg.role === 'user';
  const isAssistant = msg.role === 'assistant';
  const progress = msg.generationProgress;
  const quickOpts = msg.quickOptions || [];

  const genMeta: Record<string, { icon: string; label: string; color: string; bg: string }> = {
    plan: { icon: '📋', label: '创作规划', color: 'text-red-500', bg: 'bg-red-500/10' },
    character: { icon: '👤', label: '角色生成', color: 'text-orange-500', bg: 'bg-orange-500/10' },
    scene: { icon: '🏞️', label: '场景生成', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    prop: { icon: '🎒', label: '道具生成', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    image: { icon: '🖼️', label: '画面生成', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    video: { icon: '🎬', label: '视频生成', color: 'text-red-600', bg: 'bg-red-600/10' },
    consistency: { icon: '🔗', label: '一致性校验', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    enhance: { icon: '✨', label: '智能增强', color: 'text-amber-500', bg: 'bg-amber-500/10' },
    compose: { icon: '🎞️', label: '影片合成', color: 'text-rose-500', bg: 'bg-rose-500/10' },
  };
  const meta = msg.generationType ? genMeta[msg.generationType] || genMeta.plan : null;

  const imageUrlRegex = /https?:\/\/\S+\.(?:png|jpg|jpeg|webp|gif)/g;
  const imageUrls = msg.content.match(imageUrlRegex) || [];
  const textContent = msg.content.replace(imageUrlRegex, '').trim();
  const signalRegex = /<<[A-Z_]+>>/g;
  const cleanText = textContent.replace(signalRegex, '').trim();

  if (isUser) {
    return (
      <div className="flex justify-end gap-2">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-red-500 text-white px-3.5 py-2.5 text-sm shadow-sm">
          {msg.content}
        </div>
        <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs">🎬</span>
        </div>
      </div>
    );
  }

  if (isAssistant) {
    return (
      <div className="flex gap-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <FilmIcon className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="max-w-[85%] space-y-2">
          {meta && (
            <div className={`${meta.bg} ${meta.color} rounded-lg px-3 py-2 space-y-1.5`}>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                {progress != null && progress > 0 && (
                  <span className="ml-auto opacity-70">{Math.round(progress)}%</span>
                )}
              </div>
              {progress != null && progress > 0 && (
                <div className="h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-current transition-all duration-300"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {cleanText && (
            <div className="rounded-2xl rounded-bl-sm bg-accent/50 dark:bg-accent/30 px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
              {msg.isStreaming && !cleanText.endsWith('…') ? cleanText + '▍' : cleanText}
            </div>
          )}

          {imageUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {imageUrls.slice(0, 4).map((url, index) => (
                <div key={index} className="relative rounded-lg overflow-hidden border border-border/50 aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
              {imageUrls.length > 4 && (
                <div className="rounded-lg border border-border/50 aspect-square flex items-center justify-center bg-accent/30 text-xs text-muted-foreground">
                  +{imageUrls.length - 4}
                </div>
              )}
            </div>
          )}

          {quickOpts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {quickOpts.map((opt, index) => (
                <button
                  key={index}
                  onClick={() => onQuickOption(opt)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-600 transition-colors border border-red-500/20"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function FilmIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
      <line x1="17" y1="17" x2="22" y2="17" />
    </svg>
  );
}
