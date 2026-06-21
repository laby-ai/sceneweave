'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send, Bot, User, Loader2, Sparkles, CheckCircle2, AlertCircle,
  Download, Check, ChevronRight, RotateCcw, Lightbulb,
  Paperclip, X, ImageIcon, FileText, Undo2, History, Trash2, Clock,
  RefreshCw, Settings2, Quote, Video, Users, AlertTriangle,
} from 'lucide-react';

// ========== 类型 ==========
interface Attachment {
  key: string;
  url: string;
  name: string;
  type: string;
  size: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isError?: boolean;
  resultType?: 'image' | 'video' | 'text' | 'task' | 'error';
  resultData?: any;
  attachments?: Attachment[];
}

interface DialogState {
  intent: string | null;
  step: number;
  totalSteps: number;
  collectedParams: Record<string, any>;
  missingParams: string[];
  progressSummary: string;
  stage: 'idle' | 'collecting' | 'executing' | 'completed' | 'error';
}

interface ApiResult {
  intent: string;
  step: number;
  totalSteps: number;
  collectedParams: Record<string, any>;
  missingParams: string[];
  readyToExecute: boolean;
  message: string;
  progressSummary: string;
  suggestions: string[];
}

// ========== 常量 ==========
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

const WELCOME_MSG: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '你好！我是绘影精灵，你的AI创作助手。\n\n我可以帮你完成以下创作：\n\n🎬 **视频生成** — 输入主题，自动生成带配音和BGM的视频\n🖼️ **图片生成** — 描述画面，AI绘画出图\n✍️ **文案生成** — 小红书、抖音、公众号等平台文案\n🎨 **海报生成** — 宣传海报、活动海报一键生成\n👤 **数字人** — 创建专属数字人形象\n📝 **字幕编辑** — 智能导入、样式调整、导出文件\n\n请告诉我你想创作什么？',
  timestamp: 0,
};

const INTENT_LABELS: Record<string, string> = {
  generate_video: '视频生成',
  generate_image: '图片生成',
  generate_copywriting: '文案生成',
  generate_poster: '海报生成',
  generate_avatar: '数字人',
  edit_subtitle: '字幕编辑',
};

const INTENT_STEPS: Record<string, string[]> = {
  generate_video: ['确定主题内容', '确定风格时长', '确定配音BGM', '确认生成'],
  generate_image: ['描述画面内容', '确定尺寸用途', '确认生成'],
  generate_copywriting: ['确定文案主题', '确定平台风格', '确认生成'],
  generate_poster: ['描述海报内容', '确认生成'],
  generate_avatar: ['描述数字人形象', '确认生成'],
  edit_subtitle: ['确定操作类型', '执行操作'],
};

// ========== 步骤进度条组件 ==========
function StepProgressBar({ step, totalSteps, intent }: { step: number; totalSteps: number; intent: string | null }) {
  if (!intent || !INTENT_STEPS[intent]) return null;

  const steps = INTENT_STEPS[intent];
  const currentStep = Math.min(step - 1, steps.length - 1);

  return (
    <div className="px-5 py-3 border-b border-border/70 bg-black/40">
      <div className="max-w-2xl mx-auto">
        {/* 步骤条 */}
        <div className="flex items-center gap-1 mb-2">
          {steps.map((label, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-medium flex-shrink-0 transition-colors ${
                i < currentStep
                  ? 'bg-[#EF4444]/20 text-[#EF4444]'
                  : i === currentStep
                  ? 'bg-[#EF4444] text-black'
                  : 'bg-accent/30 text-foreground/25'
              }`}>
                {i < currentStep ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <div className={`ml-1.5 text-[10px] hidden sm:block ${
                i <= currentStep ? 'text-muted-foreground' : 'text-foreground/20'
              }`}>
                {label}
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-[1px] mx-2 ${
                  i < currentStep ? 'bg-[#EF4444]/30' : 'bg-white/8'
                }`} />
              )}
            </div>
          ))}
        </div>
        {/* 进度文字 */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-foreground/70">
            步骤 {step} / {totalSteps}
          </span>
          <span className="text-[#EF4444]/70">
            {steps[currentStep] || '完成'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ========== 主组件 ==========
export function SubtitleChatEditor() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>({
    intent: null, step: 1, totalSteps: 3,
    collectedParams: {}, missingParams: [],
    progressSummary: '', stage: 'idle',
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollAbortRef = useRef(false); // 用于中断正在进行的轮询任务

  // 中断当前轮询并重置执行状态
  const abortCurrentPoll = useCallback(() => {
    pollAbortRef.current = true;
    setIsExecuting(false);
  }, []);

  // ========== 已生成资源（支持引用）==========
  interface GeneratedResource {
    id: string;
    type: 'image' | 'video' | 'poster' | 'avatar';
    url: string;
    name: string;
    createdAt: number;
  }
  const [generatedResources, setGeneratedResources] = useState<GeneratedResource[]>([]);

  const addResource = (type: GeneratedResource['type'], url: string, name: string) => {
    setGeneratedResources(prev => {
      const filtered = prev.filter(r => r.url !== url);
      return [...filtered, { id: genId(), type, url, name, createdAt: Date.now() }];
    });
  };

  const quoteResource = (resource: GeneratedResource) => {
    const quoteText = `引用已生成的${resource.type === 'image' ? '图片' : resource.type === 'video' ? '视频' : resource.type === 'poster' ? '海报' : '数字人'}: ${resource.name}`;
    setInput(prev => prev ? `${prev}\n${quoteText}` : quoteText);
    inputRef.current?.focus();
  };

  // ========== 历史栈（支持回退） ==========
  interface HistorySnapshot {
    dialogState: DialogState;
    messageCount: number;
    lastQuestion: string;
  }
  const [historyStack, setHistoryStack] = useState<HistorySnapshot[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    dialogState: DialogState;
    historyStack: HistorySnapshot[];
    updatedAt: number;
  }

  const SESSIONS_KEY = 'huiying-sessions';
  const CURRENT_KEY = 'huiying-current-session';

  const loadSessions = (): ChatSession[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveSessions = (sessions: ChatSession[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  };

  const loadCurrentSession = (): { messages: ChatMessage[]; dialogState: DialogState; historyStack: HistorySnapshot[] } | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(CURRENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saveCurrentSession = (messages: ChatMessage[], dialogState: DialogState, historyStack: HistorySnapshot[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CURRENT_KEY, JSON.stringify({ messages, dialogState, historyStack }));
  };

  const generateTitle = (msgs: ChatMessage[]): string => {
    const firstUser = msgs.find(m => m.role === 'user');
    if (firstUser) {
      const text = firstUser.content.split('\n')[0].slice(0, 20);
      return text || '新会话';
    }
    const now = new Date();
    return `${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // ========== 初始化：从 localStorage 加载 ==========
  useEffect(() => {
    const saved = loadCurrentSession();
    if (saved) {
      setMessages(saved.messages);
      setDialogState(saved.dialogState);
      setHistoryStack(saved.historyStack);
    }
    setSessions(loadSessions());
  }, []);

  // ========== 自动保存当前会话 ==========
  useEffect(() => {
    saveCurrentSession(messages, dialogState, historyStack);
  }, [messages, dialogState, historyStack]);

  // ========== 点击外部关闭历史面板 ==========
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    if (showHistory) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMsg = (msg: ChatMessage) => setMessages(p => [...p, msg]);

  // ========== 历史栈操作 ==========
  const pushSnapshot = (snapshotDialogState: DialogState, messageCount: number, lastQuestion: string) => {
    setHistoryStack(p => [
      ...p,
      { dialogState: { ...snapshotDialogState }, messageCount, lastQuestion },
    ]);
  };

  const canGoBack = historyStack.length > 0 && dialogState.stage === 'collecting' && !isLoading && !isExecuting;

  // ========== 会话管理 ==========
  const saveCurrentToSessions = () => {
    if (messages.length <= 1) return; // 只有欢迎消息不保存
    const all = loadSessions();
    const title = generateTitle(messages);
    const existing = all.find(s => s.id === 'current');
    const session: ChatSession = {
      id: existing ? existing.id : genId(),
      title,
      messages: [...messages],
      dialogState: { ...dialogState },
      historyStack: [...historyStack],
      updatedAt: Date.now(),
    };
    const filtered = all.filter(s => s.id !== session.id);
    const updated = [session, ...filtered].slice(0, 50); // 最多保留50条
    saveSessions(updated);
    setSessions(updated);
  };

  const startNewChat = () => {
    abortCurrentPoll(); // 中断任何正在进行的轮询
    pollAbortRef.current = false; // 重置 abort 标志，允许新任务轮询
    saveCurrentToSessions();
    setMessages([WELCOME_MSG]);
    setDialogState({ intent: null, step: 1, totalSteps: 3, collectedParams: {}, missingParams: [], progressSummary: '', stage: 'idle' });
    setHistoryStack([]);
    setAttachments([]);
    setInput('');
    localStorage.removeItem(CURRENT_KEY);
  };

  const switchSession = (session: ChatSession) => {
    abortCurrentPoll(); // 中断任何正在进行的轮询
    pollAbortRef.current = false; // 重置中断标志
    saveCurrentToSessions();
    setMessages(session.messages);
    setDialogState(session.dialogState);
    setHistoryStack(session.historyStack);
    setAttachments([]);
    setInput('');
    saveCurrentSession(session.messages, session.dialogState, session.historyStack);
    setShowHistory(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const all = loadSessions().filter(s => s.id !== id);
    saveSessions(all);
    setSessions(all);
  };

  const goBack = () => {
    if (historyStack.length === 0) return;
    const snapshot = historyStack[historyStack.length - 1];

    // 恢复状态
    setDialogState(snapshot.dialogState);
    // 截断消息列表到快照时的长度（删除本步骤的用户消息和AI回复）
    setMessages(p => p.slice(0, snapshot.messageCount));
    // 移除栈顶
    setHistoryStack(p => p.slice(0, -1));
    // 添加回退提示
    addMsg({
      id: genId(),
      role: 'assistant',
      content: `↩️ 已回退到上一步。\n\n📋 当前进度：步骤 ${snapshot.dialogState.step} / ${snapshot.dialogState.totalSteps}\n\n💬 ${snapshot.lastQuestion}`,
      timestamp: Date.now(),
    });
  };

  // ========== 重新生成 / 修改参数 ==========
  const regenerate = (intent: string, params: Record<string, any>) => {
    setMessages(p => [...p, {
      id: genId(),
      role: 'assistant',
      content: '🔄 正在重新生成...',
      timestamp: Date.now(),
      resultType: 'task',
      resultData: { status: 'running', progress: 0, stage: '重新生成', message: '使用相同参数重新创作...' },
    }]);
    setDialogState(d => ({ ...d, stage: 'executing' }));
    setTimeout(() => {
      executeApi(intent, params);
    }, 300);
  };

  const modifyParams = () => {
    const intent = dialogState.intent;
    if (!intent) return;
    // 保留 intent 和已收集的参数，但把 stage 改为 collecting，让用户继续对话修改
    setDialogState(d => ({ ...d, stage: 'collecting', step: Math.max(1, d.step - 1) }));
    // 添加一条提示消息
    addMsg({
      id: genId(),
      role: 'assistant',
      content: '✏️ 好的，我们可以修改参数。\n\n📋 当前已确定的参数：\n' +
        Object.entries(dialogState.collectedParams)
          .map(([k, v]) => `• ${k}：${v}`)
          .join('\n') +
        '\n\n💬 请告诉我你想修改哪个参数，或者补充新的要求。',
      timestamp: Date.now(),
    });
  };

  // ========== 文件上传 ==========
  const uploadFile = async (file: File): Promise<Attachment | null> => {
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '上传失败');
      return {
        key: data.key,
        url: data.url,
        name: data.name,
        type: data.type,
        size: data.size,
      };
    } catch (err) {
      console.error('上传失败:', err);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const att = await uploadFile(file);
      if (att) setAttachments(p => [...p, att]);
    }
  };

  const removeAttachment = (key: string) => {
    setAttachments(p => p.filter(a => a.key !== key));
  };

  // ========== 自动执行API ==========
  const executeApi = useCallback(async (intent: string, params: Record<string, any>, extraAttachments?: Attachment[]) => {
    pollAbortRef.current = false; // 重置中断标志，允许新任务轮询
    setIsExecuting(true);
    setDialogState(d => ({ ...d, stage: 'executing' }));

    // 从最近的对话消息中提取图片附件
    const imageAttachments = extraAttachments || messages.reduce<Attachment[]>((acc, m) => {
      if (m.attachments) {
        acc.push(...m.attachments.filter(a => a.type.startsWith('image/')));
      }
      return acc;
    }, []);

    const execMsg: ChatMessage = {
      id: genId(),
      role: 'assistant',
      content: `✨ 正在创作「${INTENT_LABELS[intent] || intent}」...`,
      timestamp: Date.now(),
      resultType: 'task',
      resultData: { status: 'running', progress: 0 },
    };
    addMsg(execMsg);

    try {
      let result: any = null;

      switch (intent) {
        case 'generate_video': {
          // 解析时长（支持"30秒"→30）
          const durationStr = String(params.totalDuration || '20');
          const totalDuration = parseInt(durationStr.replace(/[^0-9]/g, ''), 10) || 20;

          setMessages(p => p.map(m => m.id === execMsg.id ? {
            ...m,
            content: '✨ 正在创作视频...\n\n📋 第1步：正在根据主题生成分镜脚本',
            resultData: { status: 'running', progress: 5, stage: '生成分镜', message: '正在构思画面...' }
          } : m));

          const storyboardRes = await fetch('/api/storyboard/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: params.prompt,
              totalDuration,
              segmentDuration: Math.min(Math.ceil(totalDuration / 3), 10),
              globalStyle: params.globalStyle || '',
              subjectDescription: params.subjectDescription || '',
              sceneType: params.sceneType || 'auto',
            }),
          });
          const storyboardData = await storyboardRes.json();

          if (!storyboardData.shots || storyboardData.shots.length === 0) {
            throw new Error('分镜生成失败');
          }

          // 构建旁白/字幕文本：优先使用 narrationSuggestion，其次拼接各镜头字幕
          const narrationText = storyboardData.narrationSuggestion || '';
          const subtitleText = storyboardData.subtitleSuggestion || '';
          const audioPrompt = narrationText || subtitleText || params.prompt || '';

          setMessages(p => p.map(m => m.id === execMsg.id ? {
            ...m,
            content: `✨ 正在创作视频...\n\n📋 分镜脚本已生成（共${storyboardData.shots.length}个镜头）\n\n🎬 第2步：正在合成视频、配音和BGM`,
            resultData: { status: 'running', progress: 10, stage: '合成视频', message: `分镜完成，开始生成${storyboardData.shots.length}个镜头...` }
          } : m));

          const submitBody: Record<string, any> = {
            storyboard: {
              shots: storyboardData.shots,
              title: params.prompt,
              totalDuration,
            },
            async: true,
            audioEnabled: true,
            audioPrompt,
            subtitleEnabled: true,
            subtitlePrompt: subtitleText || audioPrompt,
            backgroundBgm: params.bgmMood === '无' ? 'none' : (params.bgmMood === '轻快' ? 'upbeat' : params.bgmMood === '舒缓' ? 'relaxed' : params.bgmMood === '史诗' ? 'epic' : params.bgmMood === '浪漫' ? 'romantic' : 'relaxed'),
            qualityMode: 'balanced',
          };
          // 如果有图片附件，作为参考图传入
          if (imageAttachments.length > 0) {
            submitBody.globalNineGridImages = imageAttachments.map(a => a.url);
          }

          const submitRes = await fetch('/api/storyboard/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submitBody),
          });
          result = await submitRes.json();
          break;
        }

        case 'generate_image': {
          const sizeMap: Record<string, string> = { '1:1': '1024x1024', '9:16': '1024x1792', '16:9': '1792x1024' };
          const submitRes = await fetch('/api/image/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: params.prompt,
              size: sizeMap[params.size || '1:1'] || '1024x1024',
              n: params.n || 1,
              watermark: params.watermark !== false,
            }),
          });
          result = await submitRes.json();
          break;
        }

        case 'generate_copywriting': {
          const platformMap: Record<string, string> = {
            '小红书': 'xiaohongshu', '抖音': 'douyin', '微博': 'weibo',
            '公众号': 'wechat', '快手': 'kuaishou', 'B站': 'bilibili',
          };

          setMessages(p => p.map(m => m.id === execMsg.id ? {
            ...m,
            content: '✨ 正在创作文案...',
            resultData: { status: 'running', progress: 10, stage: '构思文案', message: '正在分析主题和平台调性...' }
          } : m));

          const res = await fetch('/api/copywriting/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: params.topic,
              platform: platformMap[params.platform || ''] || 'general',
              style: params.style || 'marketing',
            }),
          });

          if (!res.body) {
            throw new Error('文案生成响应异常');
          }

          // 流式读取 SSE 响应
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullText = '';
          let variations: string[] = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === 'content' && data.content) {
                    fullText += data.content;
                    setMessages(p => p.map(m => m.id === execMsg.id ? {
                      ...m,
                      content: '✨ 正在创作文案...\n\n' + fullText,
                      resultType: 'text',
                      resultData: { status: 'running', progress: 50, stage: '撰写中', message: '正在生成文案内容...', content: fullText },
                    } : m));
                  } else if (data.type === 'done') {
                    variations = data.variations || [fullText];
                  } else if (data.type === 'error') {
                    throw new Error(data.error || '文案生成失败');
                  }
                } catch {
                  // 忽略解析失败的行
                }
              }
            }
          }

          const finalContent = variations.length > 0 ? variations.join('\n\n---\n\n') : fullText;
          setMessages(p => p.map(m => m.id === execMsg.id ? {
            ...m,
            content: '✅ 文案创作完成！',
            resultType: 'text',
            resultData: { status: 'completed', content: finalContent },
          } : m));
          setDialogState(d => ({ ...d, stage: 'completed', step: d.totalSteps }));
          setIsExecuting(false);
          addMsg({
            id: genId(),
            role: 'assistant',
            content: '🎉 文案已生成！如果你想继续创作，可以直接告诉我新的需求。',
            timestamp: Date.now(),
          });
          return;
        }

        case 'generate_poster': {
          const sizeMap: Record<string, string> = { '竖版': 'general_poster', '横版': 'landscape_poster', '方形': 'square_poster' };
          const posterBody: Record<string, any> = {
            keyInfo: params.prompt,
            size: sizeMap[params.size || '竖版'] || 'general_poster',
            colorScheme: 'bright',
          };
          // 如果有图片附件，作为参考图传入
          if (imageAttachments.length > 0) {
            posterBody.referenceImages = imageAttachments.map(a => a.url);
          }
          const res = await fetch('/api/poster/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(posterBody),
          });
          result = await res.json();
          break;
        }

        case 'generate_avatar': {
          const avatarBody: Record<string, any> = {
            modelId: params.modelId || 'professional-female-1',
            text: params.prompt || '你好，我是你的AI数字人助手。',
            voiceType: params.voiceType || 'female',
            background: params.background || 'office',
            resolution: '720p',
            aspectRatio: '16:9',
          };
          // 如果有图片附件，作为自定义形象传入
          if (imageAttachments.length > 0) {
            avatarBody.customImageUrl = imageAttachments[0].url;
          }
          const res = await fetch('/api/avatar/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(avatarBody),
          });
          result = await res.json();
          break;
        }

        case 'edit_subtitle': {
          const action = params.action || 'smart_import';
          if (action === 'smart_import' && params.text) {
            const segs = autoSplitSubtitleLocal(params.text, 60);
            result = { success: true, segments: segs, message: `已生成 ${segs.length} 段字幕` };
          } else {
            result = { success: true, message: '字幕操作已处理' };
          }
          break;
        }
      }

      if (result?.taskId) {
        pollTask(result.taskId, execMsg.id, intent);
      } else if (result?.success && (result?.image_urls || result?.posterUrl)) {
        const imageUrls = result.image_urls || (result.posterUrl ? [result.posterUrl] : []);
        const isPoster = !!result.posterUrl;
        imageUrls.forEach((url: string, idx: number) => {
          addResource(isPoster ? 'poster' : 'image', url, `${isPoster ? '海报' : '图片'} #${idx + 1}`);
        });
        setMessages(p => p.map(m => m.id === execMsg.id ? {
          ...m,
          content: result.message || '✅ 创作完成！',
          resultType: 'image',
          resultData: { ...result, status: 'completed', image_urls: imageUrls },
        } : m));
        setDialogState(d => ({ ...d, stage: 'completed', step: d.totalSteps }));
        setIsExecuting(false);
        addMsg({
          id: genId(),
          role: 'assistant',
          content: '🎉 创作已完成！如果你想继续创作，可以直接告诉我新的需求。',
          timestamp: Date.now(),
        });
      } else if (result?.success && result?.videoUrl) {
        addResource('avatar', result.videoUrl, '数字人视频');
        setMessages(p => p.map(m => m.id === execMsg.id ? {
          ...m,
          content: result.message || '✅ 创作完成！',
          resultType: 'video',
          resultData: { status: 'completed', result: { videoUrl: result.videoUrl } },
        } : m));
        setDialogState(d => ({ ...d, stage: 'completed', step: d.totalSteps }));
        setIsExecuting(false);
        addMsg({
          id: genId(),
          role: 'assistant',
          content: '🎉 创作已完成！如果你想继续创作，可以直接告诉我新的需求。',
          timestamp: Date.now(),
        });
      } else if (result?.success && (result?.text || result?.content)) {
        setMessages(p => p.map(m => m.id === execMsg.id ? {
          ...m,
          content: '✅ 创作完成！',
          resultType: 'text',
          resultData: { ...result, status: 'completed' },
        } : m));
        setDialogState(d => ({ ...d, stage: 'completed', step: d.totalSteps }));
        setIsExecuting(false);
        addMsg({
          id: genId(),
          role: 'assistant',
          content: '🎉 创作已完成！如果你想继续创作，可以直接告诉我新的需求。',
          timestamp: Date.now(),
        });
      } else {
        throw new Error(result?.error || '返回结果异常');
      }
    } catch (error) {
      setMessages(p => p.map(m => m.id === execMsg.id ? {
        ...m,
        content: `❌ 执行失败：${error instanceof Error ? error.message : '未知错误'}`,
        resultData: { status: 'error' },
        isError: true,
      } : m));
      setDialogState(d => ({ ...d, stage: 'error' }));
      setIsExecuting(false);
    }
  }, []);

  const pollTask = async (taskId: string, execMsgId: string, intent: string) => {
    const maxAttempts = 300;
    let lastStage = '';
    for (let i = 0; i < maxAttempts; i++) {
      // 检查是否已被中断
      if (pollAbortRef.current) {
        return;
      }
      await new Promise(r => setTimeout(r, 2000));
      try {
        const res = await fetch(`/api/tasks/${taskId}`);
        const data = await res.json();
        const task = data.task || data;

        if (task.status === 'completed') {
          const isVideo = intent === 'generate_video';
          const resultUrl = task.result?.videoUrl || task.result?.imageUrl || task.result?.url;
          if (resultUrl) {
            addResource(isVideo ? 'video' : 'image', resultUrl, `${isVideo ? '视频' : '图片'}作品`);
          }
          setMessages(p => p.map(m => m.id === execMsgId ? {
            ...m,
            content: '✅ 创作完成！',
            resultType: isVideo ? 'video' : 'image',
            resultData: { status: 'completed', task, result: task.result },
          } : m));
          setDialogState(d => ({ ...d, stage: 'completed', step: d.totalSteps }));
          setIsExecuting(false);
          addMsg({
            id: genId(),
            role: 'assistant',
            content: '🎉 创作已完成！如果你想继续创作，可以直接告诉我新的需求。',
            timestamp: Date.now(),
          });
          return;
        } else if (task.status === 'failed') {
          setMessages(p => p.map(m => m.id === execMsgId ? {
            ...m,
            content: `❌ 创作失败：${task.error || '未知错误'}`,
            resultType: 'error' as const,
            resultData: { status: 'error', task },
            isError: true,
          } : m));
          setDialogState(d => ({ ...d, stage: 'error' }));
          setIsExecuting(false);
          return;
        } else {
          const progress = task.progress || Math.min((i / maxAttempts) * 100, 95);
          const stage = task.stage || '处理中';
          const message = task.message || '正在创作中...';

          // 只在阶段变化时更新内容文字，避免频繁闪烁
          if (stage !== lastStage) {
            lastStage = stage;
            const stageEmoji = progress < 20 ? '🎬' : progress < 50 ? '🎨' : progress < 80 ? '🔊' : progress < 95 ? '✨' : '📦';
            setMessages(p => p.map(m => m.id === execMsgId ? {
              ...m,
              content: `${stageEmoji} 正在创作「${INTENT_LABELS[intent] || intent}」...\n\n📋 当前阶段：${stage}\n⏳ ${message}`,
            } : m));
          }

          setMessages(p => p.map(m => m.id === execMsgId ? {
            ...m,
            resultData: {
              status: 'running',
              progress,
              stage,
              message,
            },
          } : m));
        }
      } catch {
        // 忽略轮询错误
      }
    }
    setMessages(p => p.map(m => m.id === execMsgId ? {
      ...m,
      content: '⏰ 创作超时，请检查任务中心查看结果。',
      resultType: 'error',
      resultData: { status: 'timeout', error: '创作超时，请检查任务中心查看结果。' },
      isError: true,
    } : m));
    setIsExecuting(false);
  };

  const autoSplitSubtitleLocal = (text: string, duration: number) => {
    const sentences = text.split(/[。！？.!?]/).filter(s => s.trim());
    const segDuration = duration / Math.max(sentences.length, 1);
    return sentences.map((s, i) => ({
      id: `seg-${i}`,
      text: s.trim(),
      startTime: i * segDuration,
      endTime: (i + 1) * segDuration,
    }));
  };

  // ========== 发送消息到AI ==========
  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading || isExecuting) return;

    // 构建带附件描述的消息内容
    let content = input.trim();
    const currentAttachments = [...attachments];
    if (currentAttachments.length > 0) {
      const attDesc = currentAttachments.map(a => `[附件: ${a.name}]`).join(' ');
      content = content ? `${content}\n${attDesc}` : attDesc;
    }

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      // 构建发给AI的消息，包含附件URL信息
      const aiMessages = newMsgs.map(m => {
        if (m.attachments && m.attachments.length > 0) {
          const attUrls = m.attachments.map(a => `文件URL: ${a.url}`).join('\n');
          return { role: m.role, content: `${m.content}\n\n${attUrls}` };
        }
        return { role: m.role, content: m.content };
      });

      const res = await fetch('/api/subtitle/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: aiMessages,
          dialogState,
        }),
      });
      const data = await res.json();

      if (data.success && data.result) {
        const result: ApiResult = data.result;

        const newDialogState: DialogState = {
          intent: result.intent || dialogState.intent,
          step: result.step || dialogState.step,
          totalSteps: result.totalSteps || dialogState.totalSteps,
          collectedParams: { ...dialogState.collectedParams, ...result.collectedParams },
          missingParams: result.missingParams || [],
          progressSummary: result.progressSummary || '',
          stage: result.readyToExecute ? 'collecting' : 'collecting',
        };

        // 步骤前进时保存快照（用于回退）
        const stepAdvanced = newDialogState.step > dialogState.step;
        const intentSet = !dialogState.intent && newDialogState.intent;
        if (stepAdvanced || intentSet) {
          // 保存快照：回退时删除本步骤的用户消息和AI回复
          pushSnapshot(dialogState, newMsgs.length, result.message);
        }

        setDialogState(newDialogState);

        addMsg({
          id: genId(),
          role: 'assistant',
          content: result.message,
          timestamp: Date.now(),
        });

        if (result.readyToExecute && result.intent && newDialogState.stage !== 'executing' && newDialogState.stage !== 'completed') {
          setDialogState(d => ({ ...d, stage: 'executing' }));
          setTimeout(() => {
            executeApi(result.intent, newDialogState.collectedParams, currentAttachments);
          }, 500);
        }
      } else {
        addMsg({
          id: genId(),
          role: 'assistant',
          content: data.error || '处理失败，请重试',
          timestamp: Date.now(),
          isError: true,
        });
      }
    } catch {
      addMsg({
        id: genId(),
        role: 'assistant',
        content: '网络连接失败，请检查网络后重试',
        timestamp: Date.now(),
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ========== 渲染结果卡片 ==========
  const renderResult = (msg: ChatMessage) => {
    if (!msg.resultData) return null;

    if (msg.resultType === 'error') {
      return (
        <div className="mt-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-sm font-medium text-red-300">创作失败</span>
          </div>
          <p className="text-xs text-red-300/70">{msg.resultData.error || '生成过程中发生错误，请稍后重试'}</p>
        </div>
      );
    }

    if (msg.resultType === 'image') {
      const urls = msg.resultData.image_urls || msg.resultData.posterUrl ? [msg.resultData.posterUrl] : [];
      if (urls.length === 0) return null;
      const showActions = dialogState.stage === 'completed' && dialogState.intent;
      return (
        <div className="mt-3">
          <div className={`grid gap-2 ${urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {urls.map((url: string, i: number) => (
              <div key={i} className="rounded-lg overflow-hidden border border-border">
                <img src={url} alt={`生成结果 ${i + 1}`} className="w-full h-auto" />
              </div>
            ))}
          </div>
          {showActions && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => regenerate(dialogState.intent!, dialogState.collectedParams)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-white text-xs transition-colors border border-border"
              >
                <RefreshCw className="w-3 h-3" />
                重新生成
              </button>
              <button
                onClick={modifyParams}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-white text-xs transition-colors border border-border"
              >
                <Settings2 className="w-3 h-3" />
                修改参数
              </button>
            </div>
          )}
        </div>
      );
    }

    if (msg.resultType === 'text' && msg.resultData.content) {
      const showActions = dialogState.stage === 'completed' && dialogState.intent;
      return (
        <div className="mt-3">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-border">
            <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{msg.resultData.content}</div>
          </div>
          {showActions && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => regenerate(dialogState.intent!, dialogState.collectedParams)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-white text-xs transition-colors border border-border"
              >
                <RefreshCw className="w-3 h-3" />
                重新生成
              </button>
              <button
                onClick={modifyParams}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-white text-xs transition-colors border border-border"
              >
                <Settings2 className="w-3 h-3" />
                修改参数
              </button>
            </div>
          )}
        </div>
      );
    }

    if (msg.resultType === 'task') {
      const { status, progress, stage, message } = msg.resultData;
      const pct = Math.min(Math.round(progress || 0), 100);
      const isError = status === 'error' || status === 'failed';
      if (isError) {
        return (
          <div className="mt-3 p-4 rounded-xl bg-red-500/5 border border-red-500/15">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-red-300">创作失败</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{message || stage || '请检查参数后重试'}</p>
          </div>
        );
      }
      return (
        <div className="mt-3 space-y-2">
          {/* 进度条 */}
          <div className="h-2 w-full bg-accent/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#EF4444] to-red-400 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* 阶段标签 + 状态 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#EF4444]" />}
              {status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
              {status === 'timeout' && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
              <span className="text-xs font-medium text-muted-foreground">
                {stage || (status === 'running' ? '处理中' : status === 'completed' ? '已完成' : status)}
              </span>
            </div>
            <span className="text-[11px] tabular-nums text-foreground/30">{pct}%</span>
          </div>
          {/* 详细消息 */}
          {message && status === 'running' && (
            <p className="text-[11px] text-foreground/25 leading-relaxed">{message}</p>
          )}
        </div>
      );
    }

    if (msg.resultType === 'video' && msg.resultData.result?.videoUrl) {
      const showActions = dialogState.stage === 'completed' && dialogState.intent;
      return (
        <div className="mt-3">
          <video
            src={msg.resultData.result.videoUrl}
            controls
            className="w-full rounded-xl border border-border"
          />
          <div className="flex items-center gap-3 mt-3">
            <a
              href={msg.resultData.result.videoUrl}
              download
              className="inline-flex items-center gap-1 text-xs text-[#EF4444] hover:underline"
            >
              <Download className="w-3 h-3" /> 下载视频
            </a>
            {showActions && (
              <>
                <button
                  onClick={() => regenerate(dialogState.intent!, dialogState.collectedParams)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-white text-xs transition-colors border border-border"
                >
                  <RefreshCw className="w-3 h-3" />
                  重新生成
                </button>
                <button
                  onClick={modifyParams}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-white text-xs transition-colors border border-border"
                >
                  <Settings2 className="w-3 h-3" />
                  修改参数
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  // ========== 主渲染 ==========
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-black">
      {/* 顶部栏 */}
      <div className="h-14 border-b border-border/70 flex items-center px-5 flex-shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#EF4444] to-red-500 flex items-center justify-center">
            <Bot className="w-4 h-4 text-black" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground/90">绘影精灵</div>
            <div className="text-[10px] text-foreground/30">AI创作助手</div>
          </div>
          {dialogState.intent && (
            <div className="ml-3 px-2.5 py-1 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/20 text-[11px] text-[#EF4444]/80">
              {INTENT_LABELS[dialogState.intent] || dialogState.intent}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {dialogState.stage === 'executing' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EF4444]/10 border border-[#EF4444]/20 text-[11px] text-[#EF4444]">
              <Loader2 className="w-3 h-3 animate-spin" />
              创作中
            </div>
          )}
          {canGoBack && (
            <button
              onClick={goBack}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs transition-colors border border-border"
              title="回退到上一步"
            >
              <Undo2 className="w-3 h-3" />
              上一步
            </button>
          )}
          {/* 历史记录 */}
          <div className="relative" ref={historyRef}>
            <button
              onClick={() => setShowHistory(p => !p)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs transition-colors border border-border"
            >
              <History className="w-3 h-3" />
              历史
              {sessions.length > 0 && (
                <span className="ml-0.5 text-[10px] text-muted-foreground">{sessions.length}</span>
              )}
            </button>
            {showHistory && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-border/70 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">历史会话</span>
                  <span className="text-[10px] text-foreground/25">{sessions.length} 条</span>
                </div>
                {sessions.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-foreground/20">
                    暂无历史会话
                  </div>
                ) : (
                  <div className="max-h-[320px] overflow-y-auto">
                    {sessions.map(session => (
                      <button
                        key={session.id}
                        onClick={() => switchSession(session)}
                        className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-accent/15 transition-colors text-left group border-b border-white/[0.03] last:border-0"
                      >
                        <Clock className="w-3.5 h-3.5 text-foreground/20 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] text-muted-foreground truncate">{session.title}</div>
                          <div className="text-[10px] text-foreground/20 mt-0.5">
                            {new Date(session.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <button
                          onClick={(e) => deleteSession(session.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3 h-3 text-foreground/20 hover:text-red-400" />
                        </button>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={startNewChat}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs transition-colors border border-border"
          >
            <RotateCcw className="w-3 h-3" />
            新对话
          </button>
        </div>
      </div>

      {/* 步骤进度条 */}
      <StepProgressBar
        step={dialogState.step}
        totalSteps={dialogState.totalSteps}
        intent={dialogState.intent}
      />

      {/* 消息区域 */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* 头像 */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    msg.role === 'user'
                      ? 'bg-white/[0.08]'
                      : 'bg-gradient-to-br from-[#EF4444] to-red-500'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Bot className="w-4 h-4 text-black" />
                  )}
                </div>

                {/* 内容 */}
                <div
                  className={`max-w-[85%] space-y-1 ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="text-[10px] text-foreground/25 mb-0.5">绘影精灵</div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-white/[0.08] text-foreground/90'
                        : msg.isError
                        ? 'bg-red-500/[0.08] text-red-300/90 border border-red-500/15'
                        : msg.resultType
                        ? 'bg-[#EF4444]/[0.06] text-white/85 border border-[#EF4444]/12'
                        : 'bg-accent/15 text-white/75 border border-border/70'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* 消息附件预览 */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {msg.attachments.map(att => (
                        <div key={att.key} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-accent/15 border border-border/70">
                          {att.type.startsWith('image/') ? (
                            <img src={att.url} alt={att.name} className="w-6 h-6 rounded object-cover" />
                          ) : (
                            <FileText className="w-4 h-4 text-foreground/30" />
                          )}
                          <span className="text-[11px] text-foreground/70 max-w-[100px] truncate">{att.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {renderResult(msg)}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#EF4444] to-red-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-black" />
                </div>
                <div className="bg-accent/15 rounded-2xl px-4 py-3 border border-border/70">
                  <Loader2 className="w-4 h-4 animate-spin text-[#EF4444]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* 已生成资源条 */}
      {generatedResources.length > 0 && (
        <div className="border-t border-white/[0.04] bg-black/30 px-5 py-2 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] text-foreground/30 flex-shrink-0">已生成:</span>
          {generatedResources.map(res => (
            <button
              key={res.id}
              onClick={() => quoteResource(res)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-white/[0.08] border border-border/70 hover:border-[#EF4444]/20 transition-all flex-shrink-0 group"
              title={`点击引用: ${res.name}`}
            >
              {res.type === 'image' || res.type === 'poster' ? (
                <img src={res.url} alt={res.name} className="w-5 h-5 rounded object-cover" />
              ) : res.type === 'video' ? (
                <Video className="w-3.5 h-3.5 text-[#EF4444]/60" />
              ) : (
                <Users className="w-3.5 h-3.5 text-red-400/60" />
              )}
              <span className="text-[11px] text-foreground/70 group-hover:text-muted-foreground max-w-[80px] truncate">{res.name}</span>
              <Quote className="w-3 h-3 text-foreground/15 group-hover:text-[#EF4444]/60" />
            </button>
          ))}
        </div>
      )}

      {/* 底部输入区 */}
      <div
        className={`border-t border-border/70 bg-black/50 backdrop-blur-sm transition-colors ${dragOver ? 'bg-[#EF4444]/[0.04]' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFileSelect(e.dataTransfer.files);
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4">
          {/* 附件预览 */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map(att => (
                <div key={att.key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-accent/20 border border-border group">
                  {att.type.startsWith('image/') ? (
                    <>
                      <img src={att.url} alt={att.name} className="w-8 h-8 rounded object-cover" />
                      <span className="text-[11px] text-muted-foreground max-w-[120px] truncate">{att.name}</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 text-foreground/30" />
                      <span className="text-[11px] text-muted-foreground max-w-[120px] truncate">{att.name}</span>
                    </>
                  )}
                  <button
                    onClick={() => removeAttachment(att.key)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-foreground/30 hover:text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isExecuting
                  ? '创作进行中，请稍候...'
                  : dialogState.intent
                  ? `步骤 ${dialogState.step}/${dialogState.totalSteps}：继续补充信息...`
                  : '告诉我你想创作什么...'
              }
              className="min-h-[56px] max-h-[160px] bg-accent/15 border-border text-[15px] resize-none pr-24 py-3.5 placeholder:text-foreground/20 rounded-xl"
              disabled={isLoading || isExecuting}
            />
            {/* 附件上传按钮 */}
            <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.mp4,.mov,.pdf,.doc,.docx,.txt"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isExecuting || isUploading}
                className="h-9 w-9 p-0 bg-accent/20 hover:bg-white/[0.1] text-foreground/70 hover:text-muted-foreground rounded-lg border border-border"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </Button>
              <Button
                onClick={sendMessage}
                disabled={isLoading || isExecuting || (!input.trim() && attachments.length === 0)}
                className="h-9 w-9 p-0 bg-[#EF4444] hover:bg-[#EF4444]/90 text-black rounded-lg"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          {dialogState.progressSummary && (
            <div className="flex items-center gap-1.5 mt-2 justify-center">
              <Lightbulb className="w-3 h-3 text-[#EF4444]/50" />
              <span className="text-[11px] text-foreground/25">{dialogState.progressSummary}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
