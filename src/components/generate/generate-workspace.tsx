'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  AtSign,
  ChevronDown,
  Footprints,
  Image as ImageIcon,
  MessageSquare,
  Mic,
  Music,
  PenSquare,
  PersonStanding,
  Plus,
  Sparkles,
  Video,
  Wand2,
} from 'lucide-react';

import { clientApiFetch, clientApiRequest } from '@/lib/client-api';
import { genId, loadChatHistory, saveChatHistory, saveMessages, type ChatHistoryEntry, type ChatMessage } from '@/lib/smart-assistant-panel-model';
import {
  useVimaxShortDramaSkill,
  VIMAX_REFERENCE_CONFIRM_REGEX,
} from '@/lib/skills/vimax-short-drama/use-vimax-short-drama-skill';

type CreationMode = 'agent' | 'image' | 'video' | 'music' | 'voice' | 'avatar' | 'motion';

const SKILL_OPTIONS: Array<{ id: string; label: string; desc: string; prompt: string; icon: React.ReactNode }> = [
  { id: 'short-drama', label: '短剧制作', desc: 'ViMAX：剧本 → 分镜 → 参考图 → 成片', icon: <Video className="h-4 w-4" />, prompt: '用 ViMAX 做一部短剧：题材是【】，主角是【】，关键场景是【】。先出分镜规划。' },
  { id: 'image-copy', label: '图文制作', desc: '小红书 / 公众号 / 电商详情页图文', icon: <ImageIcon className="h-4 w-4" />, prompt: '帮我做一组图文内容：主题是【】，目标平台是【小红书/公众号/电商】，风格要求【】。' },
  { id: 'poster', label: '海报设计', desc: '活动 / 电影 / 产品海报 + 文案', icon: <PenSquare className="h-4 w-4" />, prompt: '设计一张海报：主题是【】，用途是【活动/电影/产品】，需要包含文案【】。' },
  { id: 'brand-copy', label: '品牌文案', desc: '品牌故事 / Slogan / 产品介绍', icon: <MessageSquare className="h-4 w-4" />, prompt: '帮我写一段品牌文案：品牌/产品是【】，受众是【】，调性要求【】。' },
  { id: 'storyboard', label: '分镜拆解', desc: '把脚本拆成分镜 + 参考图提示词', icon: <Wand2 className="h-4 w-4" />, prompt: '把下面这段脚本拆分成分镜，并为每个镜头给出参考图提示词：\n\n' },
  { id: 'voiceover', label: '口播脚本', desc: '短视频 / 直播 / 广告口播稿', icon: <Mic className="h-4 w-4" />, prompt: '写一段口播脚本：主题是【】，时长约【】秒，风格【】。' },
];

interface CreationModeDef {
  id: CreationMode;
  label: string;
  icon: React.ReactNode;
  /** 已接入真实能力的现有 section；为空表示由 Agent skill 统一编排。 */
  section?: string;
}

// 有 section 的创作类型已接真实后端（点了直达）；音乐生成 / 动作模仿先占位，后续接入。
const CREATION_MODES: CreationModeDef[] = [
  { id: 'agent', label: 'Agent 模式', icon: <Sparkles className="h-4 w-4" /> },
  { id: 'image', label: '图片生成', icon: <ImageIcon className="h-4 w-4" />, section: 'image' },
  { id: 'video', label: '视频生成', icon: <Video className="h-4 w-4" />, section: 'video' },
  { id: 'music', label: '音乐生成', icon: <Music className="h-4 w-4" /> },
  { id: 'voice', label: '配音生成', icon: <Mic className="h-4 w-4" />, section: 'voice' },
  { id: 'avatar', label: '数字人', icon: <PersonStanding className="h-4 w-4" />, section: 'avatar' },
  { id: 'motion', label: '动作模仿', icon: <Footprints className="h-4 w-4" /> },
];

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

function withBasePath(url: string) {
  if (!BASE_PATH || !url.startsWith('/') || url.startsWith(`${BASE_PATH}/`)) return url;
  return `${BASE_PATH}${url}`;
}

function parseVimaxDurationSpec(text: string) {
  const totalMatch = /(\d{1,3})\s*(秒|s|S)/.exec(text);
  const compact = text.replace(/\s+/g, '');
  const clipSpecMatch =
    /(\d{1,2})(?:个|段|条)(\d{1,2})(?:秒|s|S)(?:clip|Clip|CLIP|镜头|分镜|片段)?/.exec(compact)
    || /(\d{1,2})(?:个|段|条)?(?:clip|Clip|CLIP|镜头|分镜|片段)(?:，|,|、)?(?:每(?:个|段|条)?)?(\d{1,2})(?:秒|s|S)/.exec(compact);
  const clipCount = clipSpecMatch ? Number(clipSpecMatch[1]) : undefined;
  const explicitSegmentDuration = clipSpecMatch ? Number(clipSpecMatch[2]) : undefined;
  const explicitTotal = totalMatch ? Number(totalMatch[1]) : undefined;
  const duration = explicitTotal || (clipCount && explicitSegmentDuration ? clipCount * explicitSegmentDuration : 30);
  const segmentDuration = explicitSegmentDuration || (clipCount ? Math.max(1, Math.round(duration / clipCount)) : (duration <= 30 ? 5 : 10));
  return {
    duration: Math.max(5, Math.min(120, Math.floor(duration))),
    segmentDuration: Math.max(2, Math.min(12, Math.floor(segmentDuration))),
    segmentCount: clipCount || Math.max(1, Math.round(duration / segmentDuration)),
  };
}

interface GenerateWorkspaceProps {
  initialPrompt?: string;
  onNavigate?: (section: string, prompt?: string, transfer?: { imageRefs?: string[] }) => void;
}

type SubjectItem = { id: string; name: string; type: 'character' | 'scene' | 'object'; imageUrl: string };

export function GenerateWorkspace({ initialPrompt, onNavigate }: GenerateWorkspaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialPrompt || '');
  const [mode, setMode] = useState<CreationMode>('agent');
  const [isLoading, setIsLoading] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [mediaModelMenuOpen, setMediaModelMenuOpen] = useState(false);
  const [atMenuOpen, setAtMenuOpen] = useState(false);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [subjectOpeningId, setSubjectOpeningId] = useState<string | null>(null);
  const [selectedRatio, setSelectedRatio] = useState('16:9');
  const [selectedQuality, setSelectedQuality] = useState('高清');
  const [history, setHistory] = useState<ChatHistoryEntry[]>([]);
  useEffect(() => { setHistory(loadChatHistory()); }, []);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setInput('');
  }, []);

  // 自动保存当前对话到 localStorage，刷新后最近列表可见
  useEffect(() => {
    saveMessages(messages);
    if (messages.length > 0) {
      const firstUser = messages.find(m => m.role === 'user');
      const title = firstUser ? firstUser.content.slice(0, 30) : '未命名创作';
      setHistory(prev => {
        const currentId = messages[0]?.id || genId();
        const existingIndex = prev.findIndex(h => h.id === currentId);
        const entry: ChatHistoryEntry = {
          id: currentId,
          title,
          time: Date.now(),
          messages,
        };
        let next;
        if (existingIndex >= 0) {
          next = [...prev];
          next[existingIndex] = entry;
        } else {
          next = [entry, ...prev];
        }
        saveChatHistory(next.slice(0, 20));
        return next;
      });
    }
  }, [messages]);

  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const { handlePlanStep, handleReferenceAssetsStep, handleVideoStep } = useVimaxShortDramaSkill({
    messagesRef,
    setMessages,
    setIsLoading,
    setInputValue: setInput,
    setCurrentStep: () => {},
  });

  const activeMode = CREATION_MODES.find(item => item.id === mode) || CREATION_MODES[0];

  const openSubjectMenu = useCallback(async () => {
    setModeMenuOpen(false);
    setSkillMenuOpen(false);
    setMediaModelMenuOpen(false);
    setAtMenuOpen(open => !open);
    if (atMenuOpen || subjects.length > 0 || subjectsLoading) return;
    setSubjectsLoading(true);
    try {
      const payload = await clientApiFetch<{ subjects?: SubjectItem[] }>('/api/subjects');
      setSubjects(payload.subjects || []);
      setSubjectError(null);
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : '主体库加载失败');
    } finally {
      setSubjectsLoading(false);
    }
  }, [atMenuOpen, subjects.length, subjectsLoading]);

  const selectSubject = useCallback(async (subject: SubjectItem) => {
    if (!onNavigate || subjectOpeningId) return;
    setSubjectOpeningId(subject.id);
    try {
      const response = await clientApiRequest(`/api/subjects/${encodeURIComponent(subject.id)}`, { timeoutMs: 20_000 });
      if (!response.ok) throw new Error('主体参考图不可用');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/') || blob.size === 0) throw new Error('主体参考图不可用');
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('主体参考图读取失败'));
        reader.readAsDataURL(blob);
      });
      setAtMenuOpen(false);
      onNavigate('image', input.trim() || `基于主体「${subject.name}」创作新画面`, { imageRefs: [dataUrl] });
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : '主体参考图不可用');
    } finally {
      setSubjectOpeningId(null);
    }
  }, [input, onNavigate, subjectOpeningId]);

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    if (mode === 'agent') {
      // 点击“确认开始生成 / 重做视频” -> 真实调用 Seedance 生成完整短剧
      if (/确认开始生成|重做视频/.test(text)) {
        setMessages(prev => [...prev, { id: genId(), role: 'user', content: text, timestamp: Date.now() }]);
        setInput('');
        await handleVideoStep();
        return;
      }
      // 点击“确认参考图，继续生成视频” -> 进入视频费用确认，不重复生成参考图
      if (/继续生成视频|生成视频/.test(text)) {
        setMessages(prev => [...prev, { id: genId(), role: 'user', content: text, timestamp: Date.now() }]);
        setInput('');
        setMessages(prev => [...prev, {
          id: genId(),
          role: 'assistant',
          content: '视频生成会真实调用 doubao-seedance-1.5-pro（按真实费用计费）。确认后会按 6 个分镜分别生成约 5 秒片段，并自动合成为约 30 秒完整短剧，预计 4-10 分钟。',
          timestamp: Date.now(),
          vimaxAgent: {
            phase: 'video_cost_confirm',
            title: '视频生成费用确认',
            summary: '将基于已确认的参考图和分镜脚本，调用 Seedance 生成 6 段并合成为 30 秒完整短剧。',
            model: 'doubao-seedance-1.5-pro',
            costState: 'not-yet',
            nextAction: '点击“确认开始生成”后开始真实调用视频模型。',
          },
          quickOptions: ['确认开始生成', '先调整分镜', '取消'],
        }]);
        return;
      }
      if (VIMAX_REFERENCE_CONFIRM_REGEX.test(text) || /确认分镜|生成参考图/.test(text)) {
        setMessages(prev => [...prev, { id: genId(), role: 'user', content: text, timestamp: Date.now() }]);
        setInput('');
        await handleReferenceAssetsStep();
        return;
      }
      const durationSpec = parseVimaxDurationSpec(text);
      await handlePlanStep({
        prompt: text,
        duration: durationSpec.duration,
        segmentDuration: durationSpec.segmentDuration,
        segmentCount: durationSpec.segmentCount,
        style: '电影感短剧',
      });
      return;
    }

    // 其它创作类型走各自真实能力（现有 section），不在此处伪造结果。
    if (activeMode.section && onNavigate) {
      onNavigate(activeMode.section, text);
      return;
    }
    setMessages(prev => [...prev, {
      id: genId(),
      role: 'assistant',
      content: `「${activeMode.label}」即将接入，敬请期待。当前可使用 Agent 模式、图片 / 视频 / 配音 / 数字人。`,
      timestamp: Date.now(),
    }]);
    setInput('');
  }, [input, isLoading, mode, activeMode, onNavigate, handlePlanStep, handleReferenceAssetsStep, handleVideoStep]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const hasMessages = messages.length > 0;
  const latestCompletedVideoIndex = messages.reduce((latest, message, index) => (
    message.generatedVideo?.url ? index : latest
  ), -1);

  const handleQuickOption = useCallback((value: string) => {
    if (value === '查看成片') {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      return;
    }
    setInput(value);
    setTimeout(() => handleSend(value), 50);
  }, [handleSend]);

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-black text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-55"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.54) 34%, rgba(0,0,0,0.74) 100%), url(${withBasePath('/home/huiying-hero-cosmic-reel-v2.png')})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(112,224,255,0.16),transparent_30%),radial-gradient(circle_at_38%_62%,rgba(79,108,255,0.13),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.24),rgba(0,0,0,0.86))]" />
      <aside className="relative z-10 hidden w-56 shrink-0 flex-col border-r border-white/10 bg-black/72 text-white backdrop-blur-xl md:flex">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold">开启创作</span>
        </div>
        <div className="px-2">
          <button
            type="button"
            onClick={startNewChat}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-accent/60"
          >
            <PenSquare className="h-4 w-4" /> 新对话
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-accent/60"
          >
            <MessageSquare className="h-4 w-4" /> 默认创作
          </button>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2">
          <p className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground">最近</p>
          {history.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground/70">暂无最近创作</p>
          ) : (
            history.slice(0, 20).map(entry => (
              <button
                key={entry.id}
                type="button"
                onClick={() => entry.messages && setMessages(entry.messages)}
                className="flex w-full items-center gap-2 truncate rounded-lg px-3 py-2 text-left text-sm text-foreground/70 transition-colors hover:bg-accent/60"
                title={entry.title}
              >
                <span className="truncate">{entry.title || '未命名创作'}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col text-white">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {!hasMessages ? (
            <div className="mx-auto flex h-full max-w-4xl flex-col items-center justify-center px-4">
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-semibold tracking-tight">你好，想创作什么？</h1>
                <p className="mt-2 text-sm text-muted-foreground">一句话，让 Agent 帮你从剧本到分镜、参考图，一步步成片。</p>
              </div>
              <div className="w-full">{renderDock()}</div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onQuickOption={handleQuickOption}
                  hideQuickOptions={latestCompletedVideoIndex > index}
                />
              ))}
            </div>
          )}
        </div>

        {hasMessages && (
          <div className="border-t border-white/10 bg-black/58 backdrop-blur-xl">
            <div className="mx-auto max-w-4xl px-4 py-3">{renderDock()}</div>
          </div>
        )}
      </div>
    </div>
  );

  function renderDock() {
    return (
      <div className="rounded-2xl border border-white/12 bg-[#0B101A]/88 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl focus-within:border-[#4F6CFF]/60">
        <div className="flex items-start gap-2">
          <button className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground" title="上传参考" type="button">
            <Plus className="h-4 w-4" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="输入想法、剧本或上传参考，支持 “/” 使用技能，@ 添加主体，和 Agent 一起创作"
            className="min-h-[44px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-white outline-none placeholder:text-white/42"
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => { setSkillMenuOpen(false); setMediaModelMenuOpen(false); setAtMenuOpen(false); setModeMenuOpen(open => !open); }}
              className="flex items-center gap-1.5 rounded-lg bg-[#4F6CFF]/15 px-2.5 py-1.5 text-xs font-medium text-[#70E0FF] ring-1 ring-[#4F6CFF]/30 hover:bg-[#4F6CFF]/20"
            >
              {activeMode.icon}
              {activeMode.label}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {modeMenuOpen && (
              <div className="absolute top-full left-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl">
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">创作类型</p>
                {CREATION_MODES.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setModeMenuOpen(false);
                      // 有对应能力页（图片/视频/数字人）的创作类型：直接进入该能力，点了就能用。
                      if (item.id !== 'agent' && item.section && onNavigate) {
                        onNavigate(item.section, input.trim() || undefined);
                        return;
                      }
                      setMode(item.id);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      mode === item.id ? 'bg-[#4F6CFF]/15 text-[#70E0FF]' : 'text-foreground/80 hover:bg-accent/60'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => { setModeMenuOpen(false); setSkillMenuOpen(false); setAtMenuOpen(false); setMediaModelMenuOpen(open => !open); }}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="参考图像 / 视频模型"
            >
              <ImageIcon className="h-3.5 w-3.5" /> 模型
            </button>
            {mediaModelMenuOpen && (
              <div className="absolute top-full left-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-popover p-2 shadow-xl">
                <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">参考图像模型</p>
                <div className="rounded-lg bg-[#4F6CFF]/15 px-2.5 py-1.5 text-sm text-[#70E0FF]">doubao-seedream-5.0-lite</div>
                <p className="px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">视频模型</p>
                <div className="rounded-lg bg-accent/60 px-2.5 py-1.5 text-sm text-foreground/80">doubao-seedance-1.5-pro</div>
                <p className="px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">画面比例</p>
                <div className="flex gap-1.5">
                  {["16:9", "9:16", "1:1", "4:3", "3:4"].map(r => (
                    <button key={r} type="button" onClick={() => setSelectedRatio(r)} className={`rounded-md border px-2 py-1 text-xs transition-colors ${selectedRatio === r ? "border-[#4F6CFF] bg-[#4F6CFF]/15 text-[#70E0FF]" : "border-border text-foreground/80 hover:bg-accent/60 hover:text-foreground"}`}>{r}</button>
                  ))}
                </div>
                <p className="px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">清晰度</p>
                <div className="flex gap-1.5">
                  {["标清", "高清", "超清"].map(q => (
                    <button key={q} type="button" onClick={() => setSelectedQuality(q)} className={`rounded-md border px-2 py-1 text-xs transition-colors ${selectedQuality === q ? "border-[#4F6CFF] bg-[#4F6CFF]/15 text-[#70E0FF]" : "border-border text-foreground/80 hover:bg-accent/60 hover:text-foreground"}`}>{q}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => { setModeMenuOpen(false); setMediaModelMenuOpen(false); setAtMenuOpen(false); setSkillMenuOpen(open => !open); }}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="使用技能"
            >
              <Wand2 className="h-3.5 w-3.5" /> 使用技能
            </button>
            {skillMenuOpen && (
              <div className="absolute top-full left-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl">
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">技能</p>
                {SKILL_OPTIONS.map(skill => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => {
                        setMode('agent');
                        setInput(skill.prompt);
                        setSkillMenuOpen(false);
                        setTimeout(() => textareaRef.current?.focus(), 0);
                      }}
                    className="flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent/60"
                  >
                    <span className="text-sm text-foreground/90">{skill.label}</span>
                    <span className="text-[11px] text-muted-foreground">{skill.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => void openSubjectMenu()}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
              title="添加主体"
            >
              <AtSign className="h-4 w-4" />
            </button>
            {atMenuOpen && (
              <div className="absolute top-full right-0 z-20 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-xl sm:right-auto sm:left-0">
                <p className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">引用主体</p>
                {subjectsLoading ? (
                  <p className="px-1 py-3 text-xs text-muted-foreground">正在加载主体库…</p>
                ) : subjectError ? (
                  <p className="px-1 py-3 text-xs text-red-400">{subjectError}</p>
                ) : subjects.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">暂无可引用主体。可在素材库的生成历史中保存真实图片。</p>
                ) : subjects.map(subject => (
                  <button key={subject.id} type="button" disabled={Boolean(subjectOpeningId)} onClick={() => void selectSubject(subject)} className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-accent/60 disabled:opacity-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={subject.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm">{subject.name}</span><span className="text-[11px] text-muted-foreground">{subject.type === 'character' ? '角色' : subject.type === 'scene' ? '场景' : '物件'}</span></span>
                    {subjectOpeningId === subject.id && <span className="text-xs text-muted-foreground">读取中</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isLoading}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[#4F6CFF] text-white transition-opacity disabled:opacity-40"
            title="发送"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }
}

function MessageBubble({ message, onQuickOption, hideQuickOptions }: { message: ChatMessage; onQuickOption: (value: string) => void; hideQuickOptions?: boolean }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#4F6CFF] px-4 py-2.5 text-sm text-white">{message.content}</div>
      </div>
    );
  }

  const agent = message.vimaxAgent;
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
        {agent ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-md bg-[#4F6CFF]/15 px-2 py-0.5 font-medium text-[#70E0FF]">{agent.title}</span>

            <span className={`rounded-md px-2 py-0.5 ${agent.costState === 'incurred' ? 'bg-amber-500/15 text-amber-500' : agent.costState === 'blocked' ? 'bg-red-500/15 text-red-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
              {agent.costState === 'incurred' ? '已产生费用' : agent.costState === 'blocked' ? '已阻塞' : '未计费'}
            </span>
          </div>
        ) : null}

        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{message.content}</p>

        {message.generatedImages && message.generatedImages.length > 0 && !(agent?.shots || []).some(shot => shot.referenceUrl) && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {message.generatedImages.map((image, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={index} src={image.url} alt={image.label || '参考素材'} className="aspect-video w-full rounded-lg object-cover" />
            ))}
          </div>
        )}

        {message.generatedVideo?.url && (
          <div className="mt-3">
            <video
              key={message.generatedVideo.url}
              src={message.generatedVideo.url}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-xl border border-border bg-black"
            />
            {message.generatedVideo.duration ? (
              <p className="mt-1 text-xs text-muted-foreground">时长约 {message.generatedVideo.duration} 秒 · 真实 Seedance 成片</p>
            ) : null}
          </div>
        )}

        {agent?.shots && agent.shots.length > 0 && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {agent.shots.map(shot => (
              <div key={shot.index} className="overflow-hidden rounded-xl border border-border/70 bg-accent/30">
                {shot.videoUrl ? (
                  <video
                    src={shot.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full bg-black object-cover"
                  />
                ) : shot.referenceUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shot.referenceUrl} alt={`Clip ${shot.index} · ${shot.title}`} className="aspect-video w-full object-cover" />
                ) : null}
                <div className="space-y-1 px-3 py-2 text-xs">
                  <div className="flex min-h-[24px] items-center gap-2">
                    <span className="shrink-0 font-medium text-[#70E0FF]">Clip {shot.index}</span>
                    <span className="min-w-0 flex-1 truncate text-foreground/85">{shot.title}</span>
                    <span className="shrink-0 text-muted-foreground">{shot.duration}s · {shot.camera}</span>
                  </div>
                  {shot.prompt ? (
                    <p className="line-clamp-3 text-muted-foreground">{shot.prompt}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {!hideQuickOptions && message.quickOptions && message.quickOptions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.quickOptions.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => onQuickOption(option)}
                className="rounded-full border border-[#4F6CFF]/30 bg-[#4F6CFF]/10 px-3 py-1 text-xs text-[#70E0FF] hover:bg-[#4F6CFF]/20"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
