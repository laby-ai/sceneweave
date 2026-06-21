'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { SmartAssistantTransferData } from '@/types/film';
import { formatProviderError, getBYOKRequestHeaders, hasBYOKConnectionConfigured } from '@/lib/byok-client';
import { confirmImageGenerationPlan } from '@/lib/generation-cost-guard';
import { Button } from '@/components/ui/button';
import {
  SmartAssistantSidebar,
  type SmartBgmType,
  type SmartCreationParams,
  type SmartLeftPanelTab,
  type SmartQuickTool,
  type SmartReference,
} from '@/components/smart/smart-assistant-sidebar';
import { SmartAssistantChatWorkspace } from '@/components/smart/smart-assistant-chat-workspace';
import {
  Sparkles, Video, ImageIcon, FileText, Wand2,
  Send, Bot, User, Loader2, Lightbulb,
  ArrowLeft, RotateCcw, Copy, Check,
  Settings2, ChevronDown, ChevronUp,
  Star, Film, Users, MapPin, Clapperboard,
  Paperclip, X, ThumbsUp, ThumbsDown,
  Clock, CheckCircle2, AlertCircle, Play,
  Eye, Tag, Upload, Image as ImgIcon,
  XCircle, MessageSquareQuote, Pencil, BookmarkPlus,
  Quote, BookOpen,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  genId,
  loadChatHistory,
  loadMessages,
  saveChatHistory,
  saveMessages,
  type ChatMessage,
  type SmartAssistantPanelProps,
  type TaskItem,
} from '@/lib/smart-assistant-panel-model';

// 引导式创作步骤
const CREATION_STEPS = [
  { id: 1, name: '聊聊创意', icon: Lightbulb, desc: '说说你的想法' },
  { id: 2, name: '故事梗概', icon: BookOpen, desc: '确定故事方向' },
  { id: 3, name: '聊聊角色', icon: User, desc: '一个个确定角色' },
  { id: 4, name: '聊聊场景', icon: Wand2, desc: '一个个确定场景' },
  { id: 5, name: '聊聊镜头', icon: Film, desc: '规划镜头语言' },
  { id: 6, name: '确认开拍', icon: Sparkles, desc: '开始创作' },
] as const;

// 每步的建议选项（给选择，不给空白）
const STEP_SUGGESTIONS: Record<number, string[]> = {
  1: [
    '帮我写一个产品宣传视频脚本',
    '生成赛博朋克风格的AI图片',
    '优化我的提示词',
    '创作一个悬疑短片剧本',
  ],
  2: [
    '这个方向可以，继续',
    '换个故事方向',
    '加点反转情节',
    '结局想要暖一点的',
  ],
  3: [
    '主角是个穿红裙的女孩',
    '主角是个戴墨镜的侦探',
    '想用动物当主角',
    '不用加其他角色了，继续',
  ],
  4: [
    '场景在古代宫殿里',
    '背景就深夜的城市街道',
    '想在阳光好的海边拍',
    '场景够了，继续往下聊',
  ],
  5: [
    '帮我规划5个镜头',
    '从远景慢慢推到特写',
    '手持镜头，有点纪实感',
    '航拍开场，后面跟拍',
  ],
  6: [
    '方案没问题，开始吧！',
    '再调整一下',
  ],
};

// 旧版兼容：通用建议
const SUGGESTION_CHIPS = STEP_SUGGESTIONS[1];

// ========== 工具函数 ==========

/** 流式获取创作规划，边收边解析，实时更新确认卡片 */
async function fetchCreationPlanStream(
  messages: Array<{ role: string; content: string }>,
  params: Record<string, unknown>,
  onProgress: (update: {
    title?: string;
    characters?: Array<{ name: string; description: string; imagePrompt?: string; anchor?: string; mbti?: string; arc?: string; signatureDetail?: string; consistencyRules?: { mustInclude?: string[]; mustExclude?: string[] } }>;
    scenes?: Array<{ name: string; description: string; imagePrompt?: string; lighting?: string; environment?: { visual?: string; auditory?: string; olfactory?: string; atmosphere?: string; symbolism?: string } }>;
    shots?: Array<{ shotId: string; description: string; shotType: string; duration: number; characterIds: string[]; sceneName: string; camera: string; imagePrompt?: string; videoPrompt?: string; dialogue?: string; narration?: string; bgmCue?: string; transition?: string; emotionNote?: string; colorNarrative?: string }>;
    style?: Record<string, unknown>;
    totalDuration?: number;
    narration?: Record<string, unknown>;
    bgm?: Record<string, unknown>;
    consistency?: Record<string, unknown>;
    phase?: 'planning' | 'parsing' | 'done';
  }) => void,
): Promise<Record<string, unknown> | null> {
  const planRes = await fetch('/api/film/creation-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, params }),
  });

  if (!planRes.ok) throw new Error('方案生成失败');

  const contentType = planRes.headers.get('content-type') || '';
  const isStream = contentType.includes('text/event-stream');

  if (!isStream) {
    // 兼容非流式响应
    const planData = await planRes.json();
    if (planData.error) throw new Error(planData.error);
    return planData.plan || null;
  }

  // 流式读取
  const reader = planRes.body?.getReader();
  if (!reader) throw new Error('无法读取流');

  const decoder = new TextDecoder();
  let fullContent = '';
  let plan: Record<string, unknown> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    const lines = text.split('\n');

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);

        if (parsed.chunk) {
          fullContent += parsed.chunk;
          // 尝试增量解析
          try {
            const jsonStr = fullContent
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            const partial = JSON.parse(jsonStr);

            // 提取已出现的字段
            const update: Parameters<typeof onProgress>[0] = { phase: 'parsing' };
            if (partial.title) update.title = partial.title;
            if (partial.totalDuration) update.totalDuration = partial.totalDuration;
            if (partial.style) update.style = partial.style;

            if (Array.isArray(partial.characters) && partial.characters.length > 0) {
              update.characters = partial.characters.map((c: Record<string, unknown>) => ({
                name: (c.name as string) || '',
                description: (c.description as string) || '',
                imagePrompt: (c.imagePrompt as string) || '',
                anchor: (c.anchor as string) || '',
                mbti: (c.mbti as string) || '',
                arc: (c.arc as string) || '',
                signatureDetail: (c.signatureDetail as string) || '',
                consistencyRules: c.consistencyRules as { mustInclude?: string[]; mustExclude?: string[] } | undefined,
              }));
            }

            if (Array.isArray(partial.scenes) && partial.scenes.length > 0) {
              update.scenes = partial.scenes.map((sc: Record<string, unknown>) => ({
                name: (sc.name as string) || '',
                description: (sc.description as string) || '',
                imagePrompt: (sc.imagePrompt as string) || '',
                lighting: (sc.lighting as string) || '',
                environment: sc.environment as { visual?: string; auditory?: string; olfactory?: string; atmosphere?: string; symbolism?: string } | undefined,
              }));
            }

            if (Array.isArray(partial.shots) && partial.shots.length > 0) {
              update.shots = partial.shots.map((s: Record<string, unknown>, i: number) => ({
                shotId: (s.shotId as string) || `shot_${i + 1}`,
                description: (s.description as string) || '',
                shotType: (s.shotType as string) || '中景',
                duration: (s.duration as number) || 5,
                characterIds: (s.characterIds as string[]) || [],
                sceneName: (s.sceneName as string) || '',
                camera: (s.camera as string) || '固定',
                imagePrompt: (s.imagePrompt as string) || '',
                videoPrompt: (s.videoPrompt as string) || '',
                dialogue: (s.dialogue as string) || '',
                narration: (s.narration as string) || '',
                bgmCue: (s.bgmCue as string) || '',
                transition: (s.transition as string) || '',
                emotionNote: (s.emotionNote as string) || '',
                colorNarrative: (s.colorNarrative as string) || '',
              }));
            }

            if (partial.narration) update.narration = partial.narration;
            if (partial.bgm) update.bgm = partial.bgm;
            if (partial.consistency) update.consistency = partial.consistency;

            onProgress(update);
          } catch {
            // JSON还不完整，继续累积
          }
        }

        if (parsed.plan) {
          plan = parsed.plan;
          // 发送最终完整数据
          const p = parsed.plan;
          const update: Parameters<typeof onProgress>[0] = { phase: 'done' };
          update.title = p.title;
          update.totalDuration = p.totalDuration;
          update.style = p.style;
          if (Array.isArray(p.characters)) {
            update.characters = p.characters.map((c: Record<string, unknown>) => ({
              name: (c.name as string) || '',
              description: (c.description as string) || '',
              imagePrompt: (c.imagePrompt as string) || '',
              anchor: (c.anchor as string) || '',
              mbti: (c.mbti as string) || '',
              arc: (c.arc as string) || '',
              signatureDetail: (c.signatureDetail as string) || '',
              consistencyRules: c.consistencyRules as { mustInclude?: string[]; mustExclude?: string[] } | undefined,
            }));
          }
          if (Array.isArray(p.scenes)) {
            update.scenes = p.scenes.map((sc: Record<string, unknown>) => ({
              name: (sc.name as string) || '',
              description: (sc.description as string) || '',
              imagePrompt: (sc.imagePrompt as string) || '',
              lighting: (sc.lighting as string) || '',
              environment: sc.environment as { visual?: string; auditory?: string; olfactory?: string; atmosphere?: string; symbolism?: string } | undefined,
            }));
          }
          if (Array.isArray(p.shots)) {
            update.shots = p.shots.map((s: Record<string, unknown>, i: number) => ({
              shotId: (s.shotId as string) || `shot_${i + 1}`,
              description: (s.description as string) || '',
              shotType: (s.shotType as string) || '中景',
              duration: (s.duration as number) || 5,
              characterIds: (s.characterIds as string[]) || [],
              sceneName: (s.sceneName as string) || '',
              camera: (s.camera as string) || '固定',
              imagePrompt: (s.imagePrompt as string) || '',
              videoPrompt: (s.videoPrompt as string) || '',
              dialogue: (s.dialogue as string) || '',
              narration: (s.narration as string) || '',
              bgmCue: (s.bgmCue as string) || '',
              transition: (s.transition as string) || '',
              emotionNote: (s.emotionNote as string) || '',
              colorNarrative: (s.colorNarrative as string) || '',
            }));
          }
          update.narration = p.narration;
          update.bgm = p.bgm;
          update.consistency = p.consistency;
          onProgress(update);
        }

        if (parsed.error) {
          throw new Error(parsed.error);
        }
      } catch (e) {
        if (e instanceof Error && e.message !== '方案生成失败') throw e;
      }
    }
  }

  return plan;
}

// ========== 组件 ==========
export function SmartAssistantPanel({ onBack, onNavigate, initialPrompt, autoGenerate }: SmartAssistantPanelProps) {
  // 左侧工具面板
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState(loadChatHistory);
  const [currentChatId, setCurrentChatId] = useState<string>(() => `chat-${Date.now()}`);

  // 引导式创作步骤追踪
  const [currentStep, setCurrentStep] = useState(1);
  const [creationParams, setCreationParams] = useState<SmartCreationParams>({});

  // 配音与BGM设置
  const [ttsVoiceId, setTtsVoiceId] = useState('Chinese_Female_Gentle');
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [bgmType, setBgmType] = useState<SmartBgmType>('none');
  const [bgmVolume, setBgmVolume] = useState(0.5);

  // 中间对话
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = loadMessages();
    return saved || [
      {
        id: 'welcome',
        role: 'assistant',
        content: '**你好！我是绘影精灵**\n\n我可以帮你分析创作需求并推荐最佳方案，引导你完成视频、图片、文案等创作；也可以实时校验参数、优化提示词，提升输出质量。',
        timestamp: Date.now(),
        suggestions: STEP_SUGGESTIONS[1],
        actions: ['复制', '引用', '修改'],
      },
    ];
  });
  const [inputValue, setInputValue] = useState('');
  const autoSendRef = useRef(false);

  // 自动发送 initialPrompt（当 autoGenerate=true 时自动触发发送）
  const autoGenerateRef = useRef(false);
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim() && !autoSendRef.current) {
      autoSendRef.current = true;
      autoGenerateRef.current = !!autoGenerate;
      setInputValue(initialPrompt.trim());
    }
  }, [initialPrompt, autoGenerate]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // 安全超时：防止 isLoading 卡在 true（如请求异常中断）
  useEffect(() => {
    if (!isLoading) return;
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 180000); // 3分钟安全超时
    return () => clearTimeout(timeout);
  }, [isLoading]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingSuggestionRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>(messages);
  // 保持 messagesRef 与 messages 同步
  messagesRef.current = messages;
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // 媒体上传状态
  const [attachedMedia, setAttachedMedia] = useState<Array<{ type: 'image' | 'video'; url: string; name: string }> | null>(null);
  const [analysisType, setAnalysisType] = useState<'describe' | 'prompt' | 'tag'>('describe');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  // 大图预览
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // 后台任务列表
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [localTasks, setLocalTasks] = useState<TaskItem[]>([]);
  // 左侧面板Tab: 对话 / 资产库
  const [leftPanelTab, setLeftPanelTab] = useState<SmartLeftPanelTab>('chat');
  // 资产库筛选
  const [assetFilter, setAssetFilter] = useState<Set<string>>(new Set(['角色', '场景', '分镜', '道具']));

  // 合并服务端+本地任务
  const allTasks = [...localTasks, ...tasks.filter(st => !localTasks.some(lt => lt.id === st.id))].slice(0, 20);

  // 添加本地生成任务
  const addLocalTask = useCallback((type: string, prompt: string, id?: string) => {
    const taskId = id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const task: TaskItem = {
      id: taskId,
      type,
      status: 'running',
      progress: 0,
      stage: 'generating',
      prompt: prompt.slice(0, 50),
      createdAt: Date.now(),
    };
    setLocalTasks(prev => [task, ...prev]);
    return taskId;
  }, []);

  // 更新本地任务进度
  const updateLocalTask = useCallback((taskId: string, updates: Partial<TaskItem>) => {
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  }, []);

  // 完成本地任务
  const completeLocalTask = useCallback((taskId: string, result?: { videoUrl?: string; imageUrls?: string[] }) => {
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' as const, progress: 100, result } : t));
    // 30秒后自动清除已完成的本地任务
    setTimeout(() => {
      setLocalTasks(prev => prev.filter(t => t.id !== taskId));
    }, 30000);
  }, []);

  // 失败本地任务
  const failLocalTask = useCallback((taskId: string) => {
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'failed' as const } : t));
    setTimeout(() => {
      setLocalTasks(prev => prev.filter(t => t.id !== taskId));
    }, 15000);
  }, []);

  // 右侧参考
  const [references, setReferences] = useState<SmartReference[]>([
    // 风格预设
    { id: 'style-1', type: 'style', name: '赛博朋克', desc: '霓虹灯光+暗色调+未来都市' },
    { id: 'style-2', type: 'style', name: '水墨风格', desc: '传统中国风+留白+意境' },
    { id: 'style-3', type: 'style', name: '日系动漫', desc: '明亮色彩+可爱人物+梦幻氛围' },
    { id: 'style-4', type: 'style', name: '暗黑哥特', desc: '深色调+繁复装饰+神秘感' },
    { id: 'style-5', type: 'style', name: '极简北欧', desc: '简洁线条+浅色调+空间感' },
    { id: 'style-6', type: 'style', name: '复古胶片', desc: '暖色调+颗粒感+怀旧氛围' },
    { id: 'style-7', type: 'style', name: '奇幻史诗', desc: '宏大场景+魔法光影+史诗感' },
    { id: 'style-8', type: 'style', name: '写实电影', desc: '自然光影+真实质感+电影构图' },
    // 角色预设
    { id: 'char-1', type: 'character', name: '都市女性', desc: '现代时尚+独立自信+都市背景' },
    { id: 'char-2', type: 'character', name: '古风侠客', desc: '古装+剑+飘逸长发' },
    { id: 'char-3', type: 'character', name: '可爱少女', desc: '大眼睛+圆脸+活泼表情' },
    { id: 'char-4', type: 'character', name: '冷酷战士', desc: '盔甲+伤疤+坚毅眼神' },
    { id: 'char-5', type: 'character', name: '魔法师', desc: '长袍+法杖+神秘气质' },
    { id: 'char-6', type: 'character', name: '精灵族', desc: '尖耳+修长身材+自然元素' },
    // 场景预设
    { id: 'scene-1', type: 'scene', name: '未来城市', desc: '高科技感+摩天大楼+飞行器' },
    { id: 'scene-2', type: 'scene', name: '古风庭院', desc: '中式建筑+假山池塘+月色' },
    { id: 'scene-3', type: 'scene', name: '魔法森林', desc: '发光植物+迷雾+古老树木' },
    { id: 'scene-4', type: 'scene', name: '沙漠废墟', desc: '残破建筑+风沙+落日' },
    { id: 'scene-5', type: 'scene', name: '海底世界', desc: '珊瑚+鱼群+光影穿透水面' },
    { id: 'scene-6', type: 'scene', name: '雪山之巅', desc: '白雪+云海+极光' },
  ]);

  // 拖拽状态
  const [isDragOver, setIsDragOver] = useState(false);

  // 上传参考图片到对象存储
  const uploadReferenceImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/storage/upload', { method: 'POST', body: formData });
      if (!res.ok) return null;
      const data = await res.json();
      return data.url || data.imageUrl || null;
    } catch {
      return null;
    }
  }, []);

  // 添加用户参考素材（图片或文本）
  const addUserReference = useCallback(async (file?: File, text?: string, imageBlob?: Blob) => {
    let imageUrl: string | undefined;
    let name = '自定义参考';
    let desc = '';

    if (file) {
      name = file.name.replace(/\.[^.]+$/, '').slice(0, 20);
      desc = `用户上传 · ${(file.size / 1024).toFixed(0)}KB`;
      const url = await uploadReferenceImage(file);
      if (url) imageUrl = url;
    } else if (imageBlob) {
      name = '粘贴图片';
      desc = `用户粘贴 · ${(imageBlob.size / 1024).toFixed(0)}KB`;
      const fileFromBlob = new File([imageBlob], `paste-${Date.now()}.png`, { type: imageBlob.type });
      const url = await uploadReferenceImage(fileFromBlob);
      if (url) imageUrl = url;
    } else if (text) {
      name = text.slice(0, 15);
      desc = `用户添加 · ${text.slice(0, 30)}`;
    }

    setReferences(prev => [...prev, {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'style' as const,
      name,
      desc: desc || '用户参考',
      imageUrl,
      isUserAdded: true,
    }]);
  }, [uploadReferenceImage]);

  // 拖拽事件处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const text = e.dataTransfer.getData('text/plain');
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        await addUserReference(file);
      }
    }
    if (!files.length && text) {
      await addUserReference(undefined, text);
    }
  }, [addUserReference]);

  // 粘贴事件处理
  const handleReferencePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) await addUserReference(undefined, undefined, blob);
        return;
      }
    }
    const text = e.clipboardData.getData('text/plain');
    if (text) {
      e.preventDefault();
      await addUserReference(undefined, text);
    }
  }, [addUserReference]);

  // 删除用户参考素材
  const removeUserReference = useCallback((id: string) => {
    setReferences(prev => prev.filter(r => r.id !== id));
  }, []);

  // 点击参考素材 → 插入到对话
  const handleReferenceClick = useCallback((ref: typeof references[number]) => {
    const typeLabel = ref.type === 'style' ? '风格' : ref.type === 'character' ? '角色' : '场景';
    pendingSuggestionRef.current = true;
    setInputValue(`请参考${typeLabel}「${ref.name}」（${ref.desc}）来创作`);
  }, []);

  // 用户上传参考素材
  const handleReferenceFileUpload = useCallback((files: File[]) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setReferences(prev => [...prev, {
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          type: 'style' as const,
          name: file.name.replace(/\.[^.]+$/, ''),
          desc: `用户上传 · ${Math.round(file.size / 1024)}KB`,
          imageUrl: url,
          isUserAdded: true,
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // 删除用户参考素材
  const handleDeleteReference = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReferences(prev => prev.filter(r => r.id !== id));
  }, []);

  // Ctrl+V 粘贴图片到参考素材
  useEffect(() => {
    if (leftPanelTab !== 'references') return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length) {
        e.preventDefault();
        handleReferenceFileUpload(imageFiles);
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [leftPanelTab, handleReferenceFileUpload]);

  // 加载后台任务
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
          const { tasks: serverTasks } = await response.json();
          setTasks(serverTasks.slice(0, 20));
        }
      } catch {
        // ignore
      }
    };
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, []);

  // 持久化聊天历史
  useEffect(() => {
    saveChatHistory(chatHistory);
  }, [chatHistory]);

  // 同步当前对话到聊天历史（对话内容变化时更新历史中的messages）
  useEffect(() => {
    if (!currentChatId || messages.length === 0) return;
    setChatHistory(prev => {
      const existing = prev.find(h => h.id === currentChatId);
      if (existing) {
        // 仅在消息数量变化时更新，避免无限循环
        if (existing.messages?.length === messages.length) return prev;
        return prev.map(h => h.id === currentChatId
          ? { ...h, messages: [...messages], time: Date.now() }
          : h
        );
      }
      return prev;
    });
  }, [currentChatId, messages.length]);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // 处理文件上传
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newMedia: Array<{ type: 'image' | 'video'; url: string; name: string }> = [];

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
          newMedia.push({
            type: mediaType,
            url: data.url || data.fileUrl || '',
            name: file.name,
          });
        } else {
          // 如果上传API不可用，使用base64作为fallback
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
          newMedia.push({
            type: mediaType,
            url: base64,
            name: file.name,
          });
        }
      } catch {
        // 最后的fallback：用本地URL
        const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
        newMedia.push({
          type: mediaType,
          url: URL.createObjectURL(file),
          name: file.name,
        });
      }
    }

    if (newMedia.length > 0) {
      setAttachedMedia(newMedia);
    }

    // 重置input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // 移除已附加媒体
  const removeAttachedMedia = useCallback((index: number) => {
    setAttachedMedia(prev => {
      if (!prev) return null;
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? null : next;
    });
  }, []);

  // 检测是否在底部
  const checkIsAtBottom = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return true;
    const threshold = 80;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // 滚动到底部
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = chatContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
  }, []);

  // 监听滚动
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const handleScroll = () => setIsAtBottom(checkIsAtBottom());
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [checkIsAtBottom]);

  // 消息变化时自动滚动（仅当已在底部时）
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom, scrollToBottom]);

  // 生成内容更新时也自动滚动（图片/进度出现时消息高度变化）
  const hasActiveGeneration = messages.some(m => m.generationStatus === 'generating' || m.generationStatus === 'pending');
  useEffect(() => {
    if (hasActiveGeneration && isAtBottom) {
      scrollToBottom();
    }
  }, [hasActiveGeneration, isAtBottom, scrollToBottom, messages]);

  // ===== 收集对话数据用于传递到影视创作 =====
  const collectTransferData = useCallback((): SmartAssistantTransferData => {
    const characters: SmartAssistantTransferData['characters'] = [];
    const scenes: SmartAssistantTransferData['scenes'] = [];
    const shots: SmartAssistantTransferData['shots'] = [];

    // 从所有消息中提取已生成的图片和信息
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      // 收集生成的图片
      if (msg.generatedImages && msg.generatedImages.length > 0) {
        const assetType = msg.assetType || '';
        for (const img of msg.generatedImages) {
          if (assetType === '角色' || img.label?.includes('角色') || img.label?.includes('正面') || img.label?.includes('三视图')) {
            const existing = characters.find(c => c.name === (img.label || '角色'));
            if (existing) {
              if (!existing.imageUrl) existing.imageUrl = img.url;
            } else {
              characters.push({ name: img.label || '角色', description: img.prompt || '', imageUrl: img.url, prompt: img.prompt });
            }
          } else if (assetType === '场景' || img.label?.includes('场景')) {
            scenes.push({ name: img.label || '场景', description: img.prompt || '', imageUrl: img.url, prompt: img.prompt });
          } else if (assetType === '分镜' || assetType === 'storyboard' || img.label?.includes('分镜') || img.label?.includes('镜头')) {
            shots.push({ shotId: img.label || `shot-${shots.length + 1}`, content: img.prompt || '', imageUrl: img.url, prompt: img.prompt });
          }
        }
      }
      // 从确认卡片（storyboardData）提取数据
      if (msg.storyboardData) {
        const sd = msg.storyboardData;
        if (sd.characters) {
          for (const ch of sd.characters) {
            const existing = characters.find(c => c.name === ch.name);
            if (existing) {
              existing.description = existing.description || ch.description || '';
            } else {
              characters.push({ name: ch.name, description: ch.description || '' });
            }
          }
        }
        if (sd.scenes) {
          for (const sc of sd.scenes) {
            scenes.push({ name: sc.name, description: sc.description || '' });
          }
        }
        if (sd.shots) {
          for (const sh of sd.shots) {
            shots.push({ shotId: sh.shotId || `shot-${shots.length + 1}`, content: sh.description || '' });
          }
        }
      }
    }

    // 构建故事梗概
    const storySummary = messages
      .filter(m => m.role === 'assistant' && m.content && !m.generationStatus)
      .map(m => m.content)
      .filter(c => c.length > 10 && !c.startsWith('方案都搞定了'))
      .slice(0, 3)
      .join('\n');

    return { storySummary, style: creationParams.visualStyle, characters, scenes, shots };
  }, [messages, creationParams.visualStyle]);

  // ===== 内联生成流程：在对话中展示进度和生成图片 =====
  // 分镜预览确认（生成前展示分镜内容供用户确认）
  const handleStoryboardPreview = useCallback(async (currentMessages: ChatMessage[], params: typeof creationParams) => {
    const previewMsgId = `storyboard-preview-${Date.now()}`;

    // 添加加载消息
    setMessages(prev => [...prev, {
      id: previewMsgId,
      role: 'assistant' as const,
      content: '正在生成分镜方案...',
      timestamp: Date.now(),
      generationStatus: 'generating' as const,
      generationProgress: 20,
      generationType: 'storyboard' as const,
    } as ChatMessage]);

    try {
      // 流式获取创作规划
      const plan = await fetchCreationPlanStream(
        currentMessages.map(m => ({ role: m.role, content: m.content })),
        { genre: params.genre, characters: params.characters, scenes: params.scenes, duration: params.duration },
        (update) => {
          // 实时更新确认卡片
          setMessages(prev => prev.map(m => {
            if (m.id !== previewMsgId) return m;
            const currentData = m.storyboardData || { title: '', shots: [], characters: [], scenes: [] };
            return {
              ...m,
              content: update.title
                ? `方案「${update.title}」规划好了，看看下面这些分镜，没问题就开始。`
                : m.content,
              generationStatus: update.phase === 'done' ? undefined : 'generating' as const,
              generationStepInfo: update.phase === 'done' ? undefined : { step: 'planning', progress: 40, totalSteps: 5, currentStepLabel: '规划中...' },
              storyboardData: {
                title: update.title || currentData.title || '规划中...',
                shots: update.shots || currentData.shots,
                characters: update.characters || currentData.characters,
                scenes: update.scenes || currentData.scenes,
              },
              storyboardConfirmed: false,
            } as ChatMessage;
          }));
        },
      );

      // 最终更新
      setMessages(prev => prev.map(m => {
        if (m.id !== previewMsgId) return m;
        return {
          ...m,
          content: `方案「${plan?.title || '未命名'}」规划好了，看看下面这些分镜，没问题就开始。`,
          generationStatus: undefined,
          generationProgress: undefined,
          generationStepInfo: undefined,
          storyboardConfirmed: false,
          suggestions: ['确认方案，开始吧！', '调整分镜内容'],
        } as ChatMessage;
      }));
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '分镜规划失败';
      setMessages(prev => prev.map(m => {
        if (m.id !== previewMsgId) return m;
        return {
          ...m,
          content: `分镜出了点问题：${errorMsg}。你也可以直接说"开始吧"跳过预览。`,
          generationStatus: 'failed' as const,
        } as ChatMessage;
      }));
    }
  }, []);

  // 确认分镜后按导演工作流依次生成：角色参考图→场景参考图→分镜画面
  const handleStoryboardConfirm = useCallback((previewMsgId: string, storyboardData: ChatMessage['storyboardData']) => {
    const characters = storyboardData?.characters || [];
    const scenes = storyboardData?.scenes || [];
    const shots = storyboardData?.shots || [];
    const totalCharImages = Math.min(characters.length, 4);
    const totalSceneImages = Math.min(scenes.length, 4);
    const totalShotImages = Math.min(shots.length, 6);
    const totalImages = totalCharImages + totalSceneImages + totalShotImages;

    const shouldContinue = confirmImageGenerationPlan({
      imageCount: totalImages,
      actionLabel: '绘影精灵导演工作流',
      scopeLabel: `角色 ${totalCharImages} 张 + 场景 ${totalSceneImages} 张 + 分镜 ${totalShotImages} 张`,
      usesBYOK: hasBYOKConnectionConfigured(),
    });
    if (!shouldContinue) return;

    // 标记确认
    setMessages(prev => prev.map(m => m.id === previewMsgId ? {
      ...m,
      storyboardConfirmed: true,
      content: `方案「${storyboardData?.title || ''}」确认了，角色和场景并行开画，然后画分镜`,
      generationStatus: 'generating' as const,
      generationProgress: 5,
      generationType: 'storyboard' as const,
      generationStepInfo: { step: 'characters', progress: 5, totalSteps: 5, currentStepLabel: '角色+场景并行生成中...' },
    } : m));
    addLocalTask('storyboard', `导演工作流: ${storyboardData?.title || ''}`, previewMsgId);

    let generatedCount = 0;

    // 阶段1：生成角色参考图
    const generateCharacters = async (): Promise<void> => {
      for (let i = 0; i < totalCharImages; i++) {
        const char = characters[i];
        const prompt = char.imagePrompt || char.description || `${char.name}, character design reference sheet, three-view turnaround showing front view, side view, and back view arranged in a single row, full body, consistent proportions and details across all views, white background, professional character sheet layout, 8k resolution`;
        const progressPct = 5 + Math.round((i + 1) / totalImages * 90);
        setMessages(prev => prev.map(m => m.id === previewMsgId ? {
          ...m,
          generationProgress: progressPct,
          generationStepInfo: { step: 'characters', progress: progressPct, totalSteps: 5, currentStepLabel: `角色 ${i + 1}/${totalCharImages}: ${char.name}` },
        } : m));

        try {
          const imageRes = await fetch('/api/image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
            body: JSON.stringify({ prompt, size: '1536x512' }),
          });
          if (imageRes.ok) {
            const imageData = await imageRes.json();
            const imageUrl = imageData?.imageUrls?.[0];
            if (imageUrl) {
              generatedCount++;
              setMessages(prev => prev.map(m => m.id === previewMsgId ? {
                ...m,
                generatedImages: [...(m.generatedImages || []), { url: imageUrl, prompt, label: `角色: ${char.name} (三视图)` }],
              } : m));
            }
          }
        } catch { /* 继续下一张 */ }
      }
    };

    // 阶段2：生成场景参考图
    const generateScenes = async (): Promise<void> => {
      setMessages(prev => prev.map(m => m.id === previewMsgId ? {
        ...m,
        generationStepInfo: { step: 'scenes', progress: 35, totalSteps: 5, currentStepLabel: '画场景' },
      } : m));

      for (let i = 0; i < totalSceneImages; i++) {
        const scene = scenes[i];
        const prompt = scene.imagePrompt || scene.description || `${scene.name}, scene design reference sheet, four-panel grid layout in 2x2 arrangement, top-left: wide establishing shot, top-right: medium shot, bottom-left: close-up detail, bottom-right: atmosphere and mood shot, consistent lighting and color palette across all panels, cinematic, 8k resolution, 16:9`;
        const progressPct = 35 + Math.round((i + 1) / totalImages * 90);
        setMessages(prev => prev.map(m => m.id === previewMsgId ? {
          ...m,
          generationProgress: progressPct,
          generationStepInfo: { step: 'scenes', progress: progressPct, totalSteps: 5, currentStepLabel: `场景 ${i + 1}/${totalSceneImages}: ${scene.name}` },
        } : m));

        try {
          const imageRes = await fetch('/api/image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
            body: JSON.stringify({ prompt, size: '1920x1080' }),
          });
          if (imageRes.ok) {
            const imageData = await imageRes.json();
            const imageUrl = imageData?.imageUrls?.[0];
            if (imageUrl) {
              generatedCount++;
              setMessages(prev => prev.map(m => m.id === previewMsgId ? {
                ...m,
                generatedImages: [...(m.generatedImages || []), { url: imageUrl, prompt, label: `场景: ${scene.name} (四宫格)` }],
              } : m));
            }
          }
        } catch { /* 继续下一张 */ }
      }
    };

    // 阶段3：生成分镜画面
    const generateShots = async (): Promise<void> => {
      setMessages(prev => prev.map(m => m.id === previewMsgId ? {
        ...m,
        generationStepInfo: { step: 'shots', progress: 60, totalSteps: 5, currentStepLabel: '画分镜' },
      } : m));

      for (let i = 0; i < totalShotImages; i++) {
        const shot = shots[i];
        // 使用 imagePrompt（如果存在），否则从 description 构建
        const charNames = shot.characterIds.join(', ');
        const prompt = shot.imagePrompt || `${shot.description}. ${charNames ? `Featuring ${charNames}.` : ''} ${shot.shotType} shot, ${shot.camera} camera movement. Cinematic, 8k resolution, 16:9`;
        const progressPct = 60 + Math.round((i + 1) / totalShotImages * 30);
        setMessages(prev => prev.map(m => m.id === previewMsgId ? {
          ...m,
          generationProgress: progressPct,
          generationStepInfo: { step: 'shots', progress: progressPct, totalSteps: 5, currentStepLabel: `分镜 ${i + 1}/${totalShotImages}: ${shot.shotId}` },
        } : m));

        try {
          const imageRes = await fetch('/api/image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
            body: JSON.stringify({ prompt, size: '1920x1080' }),
          });
          if (imageRes.ok) {
            const imageData = await imageRes.json();
            const imageUrl = imageData?.imageUrls?.[0];
            if (imageUrl) {
              generatedCount++;
              setMessages(prev => prev.map(m => m.id === previewMsgId ? {
                ...m,
                generatedImages: [...(m.generatedImages || []), { url: imageUrl, prompt, label: `分镜${i + 1}: ${shot.shotId}` }],
              } : m));
            }
          }
        } catch { /* 继续下一张 */ }
      }
    };

    // 角色和场景并行生成，分镜等两者完成后执行
    (async () => {
      await Promise.all([generateCharacters(), generateScenes()]);
      await generateShots();
      completeLocalTask(previewMsgId);
      setMessages(prev => prev.map(m => m.id === previewMsgId ? {
        ...m,
        generationProgress: 100,
        generationStatus: 'completed' as const,
        assetType: 'storyboard' as const,
        generationStepInfo: { step: 'completed', progress: 100, totalSteps: 5, currentStepLabel: '搞定' },
        content: `导演工作流生成完成！共${generatedCount}张图片（角色${totalCharImages}+场景${totalSceneImages}+分镜${totalShotImages}）。你可以说"调整第2个镜头"来修改特定画面。`,
        suggestions: ['调整画面', '换个风格', '生成视频'],
      } : m));
    })();
  }, []);

  /** 确认生成后执行（支持多个待生成项并行） */
  const handleGenerationConfirm = useCallback((msgId: string) => {
    const targetMsg = messagesRef.current.find(m => m.id === msgId);
    const pendingItems = targetMsg?.pendingGenerations?.length
      ? targetMsg.pendingGenerations
      : targetMsg?.pendingGeneration
        ? [targetMsg.pendingGeneration]
        : [];
    if (pendingItems.length > 1) {
      const shouldContinue = confirmImageGenerationPlan({
        imageCount: pendingItems.length,
        actionLabel: '绘影精灵确认卡生成',
        scopeLabel: `${pendingItems.length} 个待生成资产`,
        usesBYOK: hasBYOKConnectionConfigured(),
      });
      if (!shouldContinue) return;
    }

    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || (!m.pendingGenerations?.length && !m.pendingGeneration)) return m;
      const pgs = m.pendingGenerations?.length ? m.pendingGenerations : m.pendingGeneration ? [m.pendingGeneration] : [];
      if (!pgs.length) return m;
      let firstGenerateError = '';
      const updatedMsg = {
        ...m,
        pendingGeneration: undefined,
        pendingGenerations: undefined,
        generationStatus: 'generating' as const,
        generationProgress: 5,
        generationType: 'storyboard' as const,
        generationStepInfo: {
          step: 'generating',
          progress: 5,
          totalSteps: pgs.length,
          currentStepLabel: pgs.length > 1 ? `并行生成 ${pgs.length} 项...` : `画${pgs[0].type === 'character' ? '角色' : pgs[0].type === 'scene' ? '场景' : pgs[0].type === 'prop' ? '道具' : '图片'}中...`,
        },
      };
      const doGenerate = async (prompt: string, w = 1024, h = 1024): Promise<string | null> => {
        try {
          const res = await fetch('/api/image/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
            body: JSON.stringify({ prompt, width: w, height: h }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(formatProviderError(data, '图片生成失败'));
          return data.imageUrls?.[0] || data.imageUrl || data.url || null;
        } catch (err) {
          firstGenerateError = err instanceof Error ? err.message : '图片生成失败';
          return null;
        }
      };
      const generateSingle = async (pg: NonNullable<ChatMessage['pendingGeneration']>, idx: number) => {
        const typeLabel = pg.type === 'character' ? '角色' : pg.type === 'scene' ? '场景' : pg.type === 'prop' ? '道具' : '图片';
        let imageUrl: string | null = null;
        let finalPrompt = pg.prompt;
        let finalLabel = `${typeLabel}: ${pg.label}`;
        let width = 1024;
        let height = 1024;

        if (pg.type === 'character') {
          finalPrompt = `character design reference sheet of ${pg.label}, ${pg.prompt}, three views layout: front view on left, side view in center, back view on right, white background, consistent design across all views, professional character turnaround, full body, clean lineart style, 8k resolution`;
          finalLabel = `角色三视图: ${pg.label}`;
          width = 1536; height = 512;
        } else if (pg.type === 'scene') {
          finalPrompt = `scene design reference sheet of ${pg.label}, ${pg.prompt}, four-panel grid layout in 2x2 arrangement, top-left: wide establishing shot, top-right: medium shot, bottom-left: close-up detail, bottom-right: atmosphere and mood shot, consistent lighting and color palette across all panels, cinematic, 8k resolution`;
          finalLabel = `场景四宫格: ${pg.label}`;
          width = 1024; height = 1024;
        }

        setMessages(prev => prev.map(m2 => m2.id === msgId ? {
          ...m2,
          generationStepInfo: { step: pg.type, progress: Math.round((idx / pgs.length) * 100), totalSteps: pgs.length, currentStepLabel: `画${typeLabel}: ${pg.label} (${idx + 1}/${pgs.length})` },
        } : m2));

        imageUrl = await doGenerate(finalPrompt, width, height);
        return { url: imageUrl, prompt: finalPrompt, label: finalLabel, type: pg.type, assetType: typeLabel, success: !!imageUrl };
      };
      (async () => {
        try {
          // 并行生成所有项目
          const results = await Promise.all(pgs.map((pg, idx) => generateSingle(pg, idx)));
          const generatedImages: { url: string; prompt: string; label: string }[] = [];
          let mainAssetType: ChatMessage['assetType'] = '图片';
          results.forEach(r => {
            if (r.success && r.url) {
              generatedImages.push({ url: r.url, prompt: r.prompt, label: r.label });
            }
            if (r.type === 'character') mainAssetType = '角色';
            else if (r.type === 'scene') mainAssetType = '场景';
            else if (r.type === 'prop') mainAssetType = '道具';
          });
          // 最终状态
          if (generatedImages.length > 0) {
            setMessages(prev => prev.map(m2 => m2.id === msgId ? {
              ...m2,
              generatedImages: [...generatedImages] as ChatMessage['generatedImages'],
              generationProgress: 100,
              generationStatus: 'completed' as const,
              assetType: (generatedImages.length > 1 ? '分镜' : mainAssetType) as ChatMessage['assetType'],
              generationStepInfo: { step: 'completed', progress: 100, totalSteps: pgs.length, currentStepLabel: `搞定！已生成 ${generatedImages.length}/${pgs.length} 项` },
              suggestions: ['调整画面', '换个风格', '继续聊'],
            } : m2));
          } else {
            setMessages(prev => prev.map(m2 => m2.id === msgId ? {
              ...m2,
              generationStatus: 'failed' as const,
              generationStepInfo: { step: 'failed', progress: 0, totalSteps: pgs.length, currentStepLabel: firstGenerateError || '全部生成失败，可以再试一次' },
              suggestions: ['重新生成'],
            } : m2));
          }
        } catch (err) {
          console.error('并行生成失败:', err);
          setMessages(prev => prev.map(m2 => m2.id === msgId ? {
            ...m2,
            generationStatus: 'failed' as const,
            generationStepInfo: { step: 'failed', progress: 0, totalSteps: pgs.length, currentStepLabel: '生成失败，可以再试一次' },
            suggestions: ['重新生成'],
          } : m2));
        }
      })();
      return updatedMsg;
    }));
  }, []);

  const handleInlineGeneration = useCallback(async (currentMessages: ChatMessage[], params: typeof creationParams) => {
    const progressMsgId = `gen-progress-${Date.now()}`;
    
    // 1. 添加进度消息（0%）
    setMessages(prev => [...prev, {
      id: progressMsgId,
      role: 'assistant' as const,
      content: '正在想方案...',
      timestamp: Date.now(),
      generationStatus: 'pending' as const,
      generationProgress: 0,
      generationType: 'storyboard' as const,
    } as ChatMessage]);

    try {
      // 2. 流式获取创作规划
      setMessages(prev => prev.map(m => m.id === progressMsgId ? {
        ...m,
        generationProgress: 20,
        generationStatus: 'generating' as const,
        generationStepInfo: { step: 'planning', progress: 20, totalSteps: 3, currentStepLabel: '想想怎么拍' },
        content: '正在想方案...',
      } : m));

      const plan = await fetchCreationPlanStream(
        currentMessages.map(m => ({ role: m.role, content: m.content })),
        { genre: params.genre, characters: params.characters, scenes: params.scenes, duration: params.duration },
        (update) => {
          const progressPct = update.phase === 'done' ? 35 : Math.min(20 + (update.characters?.length || 0) * 3 + (update.shots?.length || 0) * 2, 34);
          setMessages(prev => prev.map(m => m.id === progressMsgId ? {
            ...m,
            generationProgress: progressPct,
            generationStepInfo: { step: 'planning', progress: progressPct, totalSteps: 3, currentStepLabel: update.title ? `方案: ${update.title}` : '想方案中' },
            content: update.title ? `方案「${update.title}」正在规划...` : '正在想方案...',
          } : m));
        },
      ) as Record<string, unknown> | null;

      setMessages(prev => prev.map(m => m.id === progressMsgId ? {
        ...m,
        generationProgress: 35,
        generationStepInfo: { step: 'generating_images', progress: 35, totalSteps: 3, currentStepLabel: '画分镜' },
        content: `方案「${(plan?.title as string) || '未命名'}」出来了，正在画分镜。`,
      } : m));

      // 3. 逐张生成分镜图，每张完成后立即展示
      const shots = (plan?.shots || []) as Array<Record<string, unknown>>;
      const totalToGenerate = Math.min(shots.length, 6);
      if (totalToGenerate > 0) {
        const shouldContinue = confirmImageGenerationPlan({
          imageCount: totalToGenerate,
          actionLabel: '绘影精灵自动内联分镜生成',
          scopeLabel: `${totalToGenerate} 个分镜画面`,
          usesBYOK: hasBYOKConnectionConfigured(),
        });
        if (!shouldContinue) {
          setMessages(prev => prev.map(m => m.id === progressMsgId ? {
            ...m,
            generationProgress: 35,
            generationStatus: 'failed' as const,
            generationStepInfo: { step: 'cancelled', progress: 35, totalSteps: 3, currentStepLabel: '已取消分镜图片生成' },
            content: `方案「${(plan?.title as string) || '未命名'}」已生成，分镜图片生成已取消。`,
            suggestions: ['调整方案', '重新生成', '继续聊'],
          } : m));
          return;
        }
      }
      let generatedImageCount = 0;
      let failedImageCount = 0;
      let firstImageError = '';

      for (let i = 0; i < totalToGenerate; i++) {
        const shot = shots[i];
        const imgPrompt = (shot.imagePrompt || shot.description || shot.shotDescription || '') as string;
        if (!imgPrompt) continue;

        const progressPct = 35 + Math.round((i / totalToGenerate) * 55);
        setMessages(prev => prev.map(m => m.id === progressMsgId ? {
          ...m,
          generationProgress: progressPct,
          generationStepInfo: { step: 'generating_images', progress: progressPct, totalSteps: 3, currentStepLabel: `分镜 ${i + 1}/${totalToGenerate}` },
          content: `正在生成第 ${i + 1}/${totalToGenerate} 个分镜画面...`,
        } : m));

        try {
          const imageRes = await fetch('/api/image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
            body: JSON.stringify({
              prompt: imgPrompt,
              style: (plan?.style as Record<string, string>)?.visualStyle || params.genre || '电影质感',
              size: '1920x1080',
            }),
          });
          const imageData = await imageRes.json();
          if (!imageRes.ok) {
            throw new Error(formatProviderError(imageData, '图片生成失败'));
          }

          const imageUrl = imageData?.imageUrls?.[0] || imageData?.imageUrl || imageData?.url;

          if (imageUrl) {
            generatedImageCount++;
            // 立即追加到进度消息的generatedImages中，实现实时展示
            setMessages(prev => prev.map(m => m.id === progressMsgId ? {
              ...m,
              generatedImages: [...(m.generatedImages || []), { url: imageUrl as string, prompt: imgPrompt, label: (shot.shotId as string) || `分镜${i + 1}` }],
            } : m));
          } else {
            throw new Error(formatProviderError(imageData, '图片生成未返回结果'));
          }
        } catch (err) {
          failedImageCount++;
          firstImageError ||= err instanceof Error ? err.message : '图片生成失败';
        }
      }

      // 4. 完成
      setMessages(prev => prev.map(m => m.id === progressMsgId ? {
        ...m,
        generationProgress: generatedImageCount > 0 ? 100 : 35,
        generationStatus: generatedImageCount > 0 ? 'completed' as const : 'failed' as const,
        generationStepInfo: generatedImageCount > 0
          ? { step: 'completed', progress: 100, totalSteps: 3, currentStepLabel: failedImageCount > 0 ? `完成 ${generatedImageCount}/${totalToGenerate} 张` : '搞定' }
          : { step: 'failed', progress: 35, totalSteps: 3, currentStepLabel: firstImageError || '分镜图片生成失败' },
        content: generatedImageCount > 0
          ? `方案都搞定了！已生成 ${generatedImageCount}/${totalToGenerate} 个分镜画面。觉得哪里不对可以说"调整第2个镜头"来改，或者点"生成视频"继续。`
          : `方案已生成，但分镜图片生成失败：${firstImageError || '请检查供应商配置后重试。'}`,
        suggestions: generatedImageCount > 0 ? ['调整画面', '换个风格', '生成视频'] : ['重新生成', '检查 API 设置'],
      } : m));

    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '生成失败';
      setMessages(prev => prev.map(m => m.id === progressMsgId ? {
        ...m,
        generationProgress: 0,
        generationStatus: 'failed' as const,
        content: `生成过程中出现问题：${errorMsg}。请重试或调整创作需求。`,
      } : m));
    }
  }, []);

  // 取消生成
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    // 将正在生成的消息标记为已取消
    setMessages(prev => prev.map(m =>
      m.generationStatus === 'generating' || m.generationStatus === 'pending'
        ? { ...m, generationStatus: 'failed' as const }
        : m
    ));
  }, []);

  // 发送消息（SSE 流式）
  const handleSend = useCallback(async () => {
    const hasMedia = attachedMedia && attachedMedia.length > 0;
    if ((!inputValue.trim() && !hasMedia) || isLoading) return;

    // ===== 生成中继续选项检测 =====
    const isAdjustDirection = /^调整方向$/.test(inputValue.trim());
    const isRegenerateMore = /^再生成一组$/.test(inputValue.trim());

    if (isAdjustDirection) {
      // 调整方向：取消正在生成的消息
      setMessages(prev => prev.map(m =>
        m.generationStatus === 'generating'
          ? { ...m, generationStatus: 'failed' as const }
          : m
      ));
      // 然后正常走对话流程，让AI继续讨论方向
    } else if (isRegenerateMore) {
      // 再生成一组：找到最近完成的生成消息，基于其信息重新生成
      const lastCompletedMsg = [...messages].reverse().find(m => m.generationStatus === 'completed' && m.generatedImages && m.generatedImages.length > 0);
      const lastGeneratingMsg = messages.find(m => m.generationStatus === 'generating');
      if (lastCompletedMsg?.pendingGenerations?.length || lastGeneratingMsg?.pendingGenerations?.length || lastCompletedMsg?.pendingGeneration || lastGeneratingMsg?.pendingGeneration) {
        setMessages(prev => [...prev, {
          id: genId(),
          role: 'user' as const,
          content: '再生成一组',
          timestamp: Date.now(),
        }]);
        setInputValue('');
        handleGenerationConfirm((lastGeneratingMsg || lastCompletedMsg)!.id);
      } else if (lastCompletedMsg) {
        const pgItem = {
          type: lastCompletedMsg.assetType === '角色' ? 'character' as const :
                lastCompletedMsg.assetType === '场景' ? 'scene' as const :
                lastCompletedMsg.assetType === '分镜' ? 'prop' as const : 'image' as const,
          prompt: lastCompletedMsg.generatedImages?.[0]?.prompt || lastCompletedMsg.content,
          label: lastCompletedMsg.assetType || '图片',
        };
        setMessages(prev => [...prev, {
          id: genId(),
          role: 'user' as const,
          content: '再生成一组',
          timestamp: Date.now(),
        }]);
        setInputValue('');
        const newMsgId = genId();
        setMessages(prev => [...prev, {
          id: newMsgId,
          role: 'assistant' as const,
          content: '',
          timestamp: Date.now(),
          pendingGenerations: [pgItem],
        } as ChatMessage]);
      }
      return;
    }

    // ===== 分镜确认检测 =====
      // 查找最近的未确认分镜消息
      const previewMsg = messages.find(m => m.storyboardData && !m.storyboardConfirmed);
      if (previewMsg) {
        // 添加用户确认消息
        setMessages(prev => [...prev, {
          id: genId(),
          role: 'user' as const,
          content: inputValue.trim(),
          timestamp: Date.now(),
        }]);
        setInputValue('');
        // 触发确认并开始生成
        handleStoryboardConfirm(previewMsg.id, previewMsg.storyboardData);
        return;
      }

    // ===== 单图确认检测 =====
    // 检测用户是否确认某个待生成的图片（角色/场景/道具）
    const isGenerationConfirm = /确认|好的|生成|可以|没问题|就这个|就这样/.test(inputValue.trim());
    if (isGenerationConfirm) {
      const pendingMsg = [...messages].reverse().find(m => m.pendingGenerations?.length || m.pendingGeneration);
      if (pendingMsg) {
        setMessages(prev => [...prev, {
          id: genId(),
          role: 'user' as const,
          content: inputValue.trim(),
          timestamp: Date.now(),
        }]);
        setInputValue('');
        handleGenerationConfirm(pendingMsg.id);
        return;
      }
    }

    // ===== 对话式调整检测 =====
    // 检测用户是否在对已生成的内容进行调整一下
    const adjustmentKeywords = /调整|修改|换一个|重新|改一下|变|换成|改成|不要.*要|太小|太大|颜色|风格|角色.*穿|衣服|发型|背景|光影|重新生成/;
    const isAdjustment = currentStep >= 6 && adjustmentKeywords.test(inputValue.trim());

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: inputValue.trim() || (hasMedia ? '请分析这个内容' : ''),
      timestamp: Date.now(),
      ...(hasMedia ? { mediaAttachments: attachedMedia!, analysisType } : {}),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    const currentMedia = hasMedia ? attachedMedia : null;
    const currentAnalysisType = analysisType;
    setAttachedMedia(null);
    setIsLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // ===== 如果是调整请求，走调整生成流程 =====
    if (isAdjustment) {
      const adjustMsgId = `adjust-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: adjustMsgId,
        role: 'assistant' as const,
        content: '正在根据你的要求调整...',
        timestamp: Date.now(),
        generationStatus: 'generating' as const,
        generationStepInfo: { step: 'generating_images', progress: 20, totalSteps: 2, currentStepLabel: '调整方案' },
      } as ChatMessage]);

      try {
        // 先让AI理解调整需求并生成新提示词
        const refineRes = await fetch('/api/prompt/video-refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: inputValue.trim(),
            mode: 't2i',
          }),
          signal: controller.signal,
        });
        const refineData = await refineRes.json();
        const refinedPrompt = refineData.refinedPrompt || inputValue.trim();

        // 生成调整后的图片
        const imgRes = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
          body: JSON.stringify({
            prompt: refinedPrompt,
            style: creationParams.visualStyle || '',
              size: '1920x1080',
          }),
        });
        const imgData = await imgRes.json();
        if (!imgRes.ok) {
          throw new Error(formatProviderError(imgData, '图片生成失败'));
        }

        if (imgData.success && (imgData.imageUrls?.[0] || imgData.imageUrl)) {
          const imgResultUrl = imgData.imageUrls?.[0] || imgData.imageUrl;
          setMessages(prev => prev.map(m => m.id === adjustMsgId ? {
            ...m,
            content: `已根据你的要求调整：${inputValue.trim()}`,
            generationStatus: 'completed' as const,
            generationStepInfo: { step: 'completed', progress: 100, totalSteps: 2, currentStepLabel: '调整完成' },
            generatedImages: [{ url: imgResultUrl, label: '调整后' }],
          } : m));
        } else {
          const providerError = formatProviderError(imgData, '图片生成失败');
          setMessages(prev => prev.map(m => m.id === adjustMsgId ? {
            ...m,
            content: providerError,
            generationStatus: 'failed' as const,
            generationStepInfo: { step: 'failed', progress: 0, totalSteps: 2, currentStepLabel: '调整失败' },
          } : m));
        }
      } catch (err: unknown) {
        const isAborted = err instanceof DOMException && err.name === 'AbortError';
        const errorMsg = err instanceof Error ? err.message : '调整过程出错，请重试';
        setMessages(prev => prev.map(m => m.id === adjustMsgId ? {
          ...m,
          content: isAborted ? '已取消调整' : errorMsg,
          generationStatus: isAborted ? 'failed' as const : 'failed' as const,
          generationStepInfo: { step: 'failed', progress: 0, totalSteps: 2, currentStepLabel: isAborted ? '已取消' : '调整失败' },
        } : m));
      } finally {
        abortControllerRef.current = null;
        setIsLoading(false);
      }
      return;
    }

    try {
      let response: Response;

      if (currentMedia && currentMedia.length > 0) {
        // 有媒体附件 → 走媒体分析API
        const firstMedia = currentMedia[0];
        response = await fetch('/api/analyze/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaUrl: firstMedia.url,
            mediaType: firstMedia.type,
            analysisType: currentAnalysisType,
            customPrompt: inputValue.trim() || undefined,
          }),
        });
      } else {
        // 纯文本对话 → 走film/chat API
        response = await fetch('/api/film/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
          body: JSON.stringify({
            messages: [...messages.filter(m => m.id !== 'welcome'), { role: 'user', content: inputValue.trim() }].map(m => ({ role: m.role, content: m.content })),
          }),
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        throw new Error('请求失败');
      }

      const aiMsgId = genId();
      let aiRawContent = ''; // 累积原始内容（含信号标记），用于跨chunk匹配与显示清理
      let hasGeneratePlanSignal = false; // 跟踪是否收到生成信号
      // 跟踪已触发的生成信号ID，避免重复触发
      const triggeredSignals = new Set<string>();

      // SSE 流式读取
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        setMessages(prev => [...prev, {
          id: aiMsgId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          suggestions: ['继续优化', '开始生成', '更换风格'],
        }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  const rawContent = parsed.content;
                  // 累积原始内容（含信号标记），用于跨chunk匹配
                  aiRawContent += rawContent;
                  
                  // 每次从完整累积内容重新计算显示文本，避免信号跨chunk分割导致泄露
                  const displayContent = aiRawContent
                    .replace(/<<QUICK_OPTIONS>>[\s\S]*?<<\/QUICK_OPTIONS>>/g, '')
                    .replace(/<<QUICK_OPTIONS>>[\s\S]*/g, '') // 流式时关闭标签未到，剥离从开标签到末尾
                    .replace(/<<GENERATE_IMAGE>>[\s\S]*?<<\/GENERATE_IMAGE>>/g, '')
                    .replace(/<<GENERATE_IMAGE>>[\s\S]*/g, '')
                    .replace(/<<GENERATE_CHARACTER>>[\s\S]*?<<\/GENERATE_CHARACTER>>/g, '')
                    .replace(/<<GENERATE_CHARACTER>>[\s\S]*/g, '')
                    .replace(/<<GENERATE_SCENE>>[\s\S]*?<<\/GENERATE_SCENE>>/g, '')
                    .replace(/<<GENERATE_SCENE>>[\s\S]*/g, '')
                    .replace(/<<GENERATE_PROP>>[\s\S]*?<<\/GENERATE_PROP>>/g, '')
                    .replace(/<<GENERATE_PROP>>[\s\S]*/g, '')
                    .replace(/<<ADJUST>>\w+\|\d*\|[\s\S]*?<<\/ADJUST>>/g, '')
                    .replace(/<<ADJUST>>[\s\S]*/g, '')
                    .replace(/<<PARAM_\w+:[^>]+>>/g, '')
                    .replace(/<<GENERATE_PLAN>>/g, '')
                    .replace(/<<STEP_\d>>/g, '')
                    .replace(/\[SUGGEST_[^\]]+\]/g, '');
                  
                  setMessages(prev => prev.map(m =>
                    m.id === aiMsgId ? { ...m, content: displayContent } : m
                  ));
                  
                  if (aiRawContent.includes('<<GENERATE_PLAN>>')) {
                    hasGeneratePlanSignal = true;
                  }

                  // === 在累积内容中检测信号（跨chunk安全） ===

                  // 快速选项
                  const quickOptionsMatch = aiRawContent.match(/<<QUICK_OPTIONS>>(.*?)<<\/QUICK_OPTIONS>>/);
                  const qoKey = `qo-${aiMsgId}`;
                  if (quickOptionsMatch && !triggeredSignals.has(qoKey)) {
                    triggeredSignals.add(qoKey);
                    const options = quickOptionsMatch[1].split('|').map((o: string) => o.trim()).filter(Boolean);
                    setMessages(prev => prev.map(m =>
                      m.id === aiMsgId ? { ...m, quickOptions: options } : m
                    ));
                  }
                  
                  // 提取即时生图信号 → 改为确认卡片（不立即生成）
                  const genImageKey = `gi-${aiMsgId}`;
                  const genImageMatch = aiRawContent.match(/<<GENERATE_IMAGE>>(.*?)<<\/GENERATE_IMAGE>>/);
                  if (genImageMatch && !triggeredSignals.has(genImageKey)) {
                    triggeredSignals.add(genImageKey);
                    const imagePrompt = genImageMatch[1].trim();
                    setMessages(prev => prev.map(m =>
                      m.id === aiMsgId ? {
                        ...m,
                        pendingGenerations: [...(m.pendingGenerations || []), { type: 'image' as const, prompt: imagePrompt, label: '生成图' }],
                        suggestions: ['确认生成', '调整提示词'],
                      } as ChatMessage : m
                    ));
                  }
                  
                  // 提取角色图生成信号 → 改为确认卡片（不立即生成）
                  const genCharKey = `gc-${aiMsgId}`;
                  const genCharMatch = aiRawContent.match(/<<GENERATE_CHARACTER>>(.*?)<<\/GENERATE_CHARACTER>>/);
                  if (genCharMatch && !triggeredSignals.has(genCharKey)) {
                    triggeredSignals.add(genCharKey);
                    const charPrompt = genCharMatch[1].trim();
                    setMessages(prev => prev.map(m =>
                      m.id === aiMsgId ? {
                        ...m,
                        pendingGenerations: [...(m.pendingGenerations || []), { type: 'character' as const, prompt: charPrompt, label: '角色三视图' }],
                        suggestions: ['确认生成', '调整角色描述'],
                      } as ChatMessage : m
                    ));
                  }

                  // 提取场景图生成信号 → 改为确认卡片（不立即生成）
                  const genSceneKey = `gs-${aiMsgId}`;
                  const genSceneMatch = aiRawContent.match(/<<GENERATE_SCENE>>(.*?)<<\/GENERATE_SCENE>>/);
                  if (genSceneMatch && !triggeredSignals.has(genSceneKey)) {
                    triggeredSignals.add(genSceneKey);
                    const scenePrompt = genSceneMatch[1].trim();
                    setMessages(prev => prev.map(m =>
                      m.id === aiMsgId ? {
                        ...m,
                        pendingGenerations: [...(m.pendingGenerations || []), { type: 'scene' as const, prompt: scenePrompt, label: '场景四宫格' }],
                        suggestions: ['确认生成', '调整场景描述'],
                      } as ChatMessage : m
                    ));
                  }
                  
                  // 提取 <<GENERATE_PROP>> 道具图生成信号 → 改为确认卡片（不立即生成）
                  const genPropMatch = aiRawContent.match(/<<GENERATE_PROP>>(.*?)<<\/GENERATE_PROP>>/);
                  if (genPropMatch) {
                    const genPropKey = `prop-${genPropMatch[1].slice(0, 30)}`;
                    if (!triggeredSignals.has(genPropKey)) {
                      triggeredSignals.add(genPropKey);
                      const propPrompt = genPropMatch[1].trim();
                      setMessages(prev => prev.map(m =>
                        m.id === aiMsgId ? {
                          ...m,
                          pendingGenerations: [...(m.pendingGenerations || []), { type: 'prop' as const, prompt: propPrompt, label: '道具参考图' }],
                          suggestions: ['确认生成', '调整道具描述'],
                        } as ChatMessage : m
                      ));
                    }
                  }
                  
                  // 提取 <<PARAM_xxx:value>> 信号并更新创作参数（使用累积内容）
                  const paramMatches = aiRawContent.matchAll(/<<PARAM_(\w+):([^>>]+)>>/g);
                  for (const pm of paramMatches) {
                    const [, key, value] = pm;
                    if (key === 'genre') setCreationParams(prev => ({ ...prev, genre: value }));
                    else if (key === 'characters') setCreationParams(prev => ({ ...prev, characters: value.split(',') }));
                    else if (key === 'scenes') setCreationParams(prev => ({ ...prev, scenes: value.split(',') }));
                    else if (key === 'shotCount') setCreationParams(prev => ({ ...prev, shotCount: parseInt(value) || 5 }));
                    else if (key === 'duration') setCreationParams(prev => ({ ...prev, targetDuration: parseInt(value) || 180 }));
                    else if (key === 'style') setCreationParams(prev => ({ ...prev, visualStyle: value }));
                  }

                  // 提取 <<ADJUST>>type|target|description<</ADJUST>> 信号
                  const adjustMatch = aiRawContent.match(/<<ADJUST>>(\w+)\|(\d*)\|([^<]*)<<\/ADJUST>>/);
                  if (adjustMatch) {
                    const [, adjType, adjTarget, adjDesc] = adjustMatch;
                    // 添加一条调整确认消息
                    const adjLabel: Record<string, string> = {
                      shot: '分镜', style: '风格', character: '角色', scene: '场景',
                    };
                    setMessages(prev => [...prev, {
                      id: `adj-${Date.now()}`,
                      role: 'assistant' as const,
                      content: `收到，正在调整${adjTarget ? `第${adjTarget}个` : ''}${adjLabel[adjType] || adjType}：${adjDesc}`,
                      timestamp: Date.now(),
                    }]);
                    // 实际执行调整：重新生成对应图片
                    if (!triggeredSignals.has('adjust')) {
                      triggeredSignals.add('adjust');
                      const adjMsgId = `adj-${Date.now()}`;
                      setMessages(prev => prev.map(m => m.id === prev[prev.length-1]?.id ? { ...m, id: adjMsgId } : m));
                      
                      (async () => {
                        try {
                          const targetNum = parseInt(adjTarget, 10) || 1;
                          const requestAdjustedImage = async (prompt: string, width: number, height: number) => {
                            const res = await fetch('/api/image/generate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
                              body: JSON.stringify({ prompt, width, height }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(formatProviderError(data, '图片生成失败'));
                            return data;
                          };
                          if (adjType === 'character') {
                            const charPrompt = `${adjDesc}, character design reference sheet, full body, multiple views, front side back, consistent appearance, detailed face and clothing, cinematic lighting`;
                            const data = await requestAdjustedImage(charPrompt, 1024, 1024);
                            if (data.url || data.imageUrl) {
                              setMessages(prev => [...prev, { id: `adj-img-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, role: 'assistant' as const, content: `重画了第${targetNum}个角色：`, images: [{ url: data.url || data.imageUrl, alt: `角色调整 ${adjDesc}` }], generatedImages: [{ url: data.url || data.imageUrl, label: `角色参考 ${adjDesc.slice(0,20)}` }], assetType: '角色' as const, generationStatus: 'completed' as const, timestamp: Date.now() }]);
                            } else {
                              setMessages(prev => [...prev, { id: `adj-err-${Date.now()}`, role: 'assistant' as const, content: formatProviderError(data, '角色图调整失败，请尝试更详细描述'), timestamp: Date.now() }]);
                            }
                          } else if (adjType === 'scene') {
                            const scenePrompt = `${adjDesc}, cinematic establishing shot, detailed environment, atmospheric lighting, wide angle, high quality`;
                            const data = await requestAdjustedImage(scenePrompt, 1920, 1080);
                            if (data.url || data.imageUrl) {
                              setMessages(prev => [...prev, { id: `adj-img-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, role: 'assistant' as const, content: `重画了第${targetNum}个场景：`, images: [{ url: data.url || data.imageUrl, alt: `场景调整 ${adjDesc}` }], generatedImages: [{ url: data.url || data.imageUrl, label: `场景参考 ${adjDesc.slice(0,20)}` }], assetType: '场景' as const, generationStatus: 'completed' as const, timestamp: Date.now() }]);
                            } else {
                              setMessages(prev => [...prev, { id: `adj-err-${Date.now()}`, role: 'assistant' as const, content: formatProviderError(data, '场景图调整失败，请尝试更详细描述'), timestamp: Date.now() }]);
                            }
                          } else if (adjType === 'shot') {
                            const shotPrompt = `${adjDesc}, cinematic shot, professional filmmaking, detailed composition, high quality`;
                            const data = await requestAdjustedImage(shotPrompt, 1920, 1080);
                            if (data.url || data.imageUrl) {
                              setMessages(prev => [...prev, { id: `adj-img-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, role: 'assistant' as const, content: `已重新生成第${targetNum}个分镜画面：`, images: [{ url: data.url || data.imageUrl, alt: `分镜调整 ${adjDesc}` }], generatedImages: [{ url: data.url || data.imageUrl, label: `分镜画面 ${adjDesc.slice(0,20)}` }], assetType: '分镜' as const, generationStatus: 'completed' as const, timestamp: Date.now() }]);
                            } else {
                              setMessages(prev => [...prev, { id: `adj-err-${Date.now()}`, role: 'assistant' as const, content: formatProviderError(data, '分镜图调整失败，请尝试更详细描述'), timestamp: Date.now() }]);
                            }
                          } else if (adjType === 'style') {
                            setMessages(prev => [...prev, { id: `adj-style-${Date.now()}`, role: 'assistant' as const, content: `风格已调整为：${adjDesc}\n\n后续生成将使用新风格。如需重新生成已有画面，请告诉我具体哪个镜头/角色/场景需要调整。`, timestamp: Date.now() }]);
                          }
                        } catch (err) {
                          setMessages(prev => [...prev, { id: `adj-catch-${Date.now()}`, role: 'assistant' as const, content: err instanceof Error ? err.message : '调整生成失败，请稍后重试或更详细描述调整需求', timestamp: Date.now() }]);
                        }
                      })();
                    }
                  }

                  // 步骤信号检测 <<STEP_N>>
                  const stepMatch = aiRawContent.match(/<<STEP_(\d)>>/);
                  if (stepMatch && !triggeredSignals.has('step')) {
                    const step = parseInt(stepMatch[1], 10);
                    if (step >= 1 && step <= 5) {
                      setCurrentStep(step);
                      triggeredSignals.add('step');
                    }
                  }

                  // 检测 <<GENERATE_PLAN>> 信号
                  if (aiRawContent.includes('<<GENERATE_PLAN>>') && !triggeredSignals.has('generate_plan')) {
                    hasGeneratePlanSignal = true;
                    triggeredSignals.add('generate_plan');
                  }

                  // (信号清理已在上方第736行处理)
                }
              } catch {
                // 非 JSON 数据，直接作为文本追加（过滤内部信号）
                if (data && data !== '[DONE]' && !/^<<GENERATE_(PLAN|SCRIPT)>>$/.test(data) && !/^\[CALL_SKILL:\w+\]$/.test(data)) {
                  aiRawContent += data;
                  // 从累积内容重新计算显示文本
                  const displayText = aiRawContent
                    .replace(/<<QUICK_OPTIONS>>[\s\S]*?<<\/QUICK_OPTIONS>>/g, '')
                    .replace(/<<QUICK_OPTIONS>>[\s\S]*/g, '')
                    .replace(/<<GENERATE_IMAGE>>[\s\S]*?<<\/GENERATE_IMAGE>>/g, '')
                    .replace(/<<GENERATE_IMAGE>>[\s\S]*/g, '')
                    .replace(/<<GENERATE_CHARACTER>>[\s\S]*?<<\/GENERATE_CHARACTER>>/g, '')
                    .replace(/<<GENERATE_CHARACTER>>[\s\S]*/g, '')
                    .replace(/<<GENERATE_SCENE>>[\s\S]*?<<\/GENERATE_SCENE>>/g, '')
                    .replace(/<<GENERATE_SCENE>>[\s\S]*/g, '')
                    .replace(/<<GENERATE_PROP>>[\s\S]*?<<\/GENERATE_PROP>>/g, '')
                    .replace(/<<GENERATE_PROP>>[\s\S]*/g, '')
                    .replace(/<<ADJUST>>\w+\|\d*\|[\s\S]*?<<\/ADJUST>>/g, '')
                    .replace(/<<ADJUST>>[\s\S]*/g, '')
                    .replace(/<<PARAM_\w+:[^>]+>>/g, '')
                    .replace(/<<GENERATE_PLAN>>/g, '')
                    .replace(/<<STEP_\d>>/g, '')
                    .replace(/\[SUGGEST_[^\]]+\]/g, '');
                  setMessages(prev => prev.map(m =>
                    m.id === aiMsgId ? { ...m, content: displayText } : m
                  ));
                }
              }
            }
          }
        }
      }

      // 如果没有流式内容，使用 fallback
      if (!aiRawContent) {
        const data = await response.json().catch(() => null);
        const fallbackContent = data?.message || `收到你的想法！你想创作的核心是：${userMsg.content}。我们一步步来，先把故事说清楚，你想要什么风格的感觉？`;

        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, content: fallbackContent } : m
        ));
      }

      // ===== 引导式步骤检测 =====
      const hasGenerateSignal = hasGeneratePlanSignal;
      if (hasGenerateSignal) {
        setCurrentStep(5);
        // 先获取创作规划，展示分镜确认卡片（而不是直接生成）
        handleStoryboardPreview(messages, creationParams);
      }

      // 根据对话内容智能推断当前步骤
      const allContent = [...messages.filter(m => m.id !== 'welcome'), { role: 'user' as const, content: userMsg.content }].map(m => m.content).join(' ') + ' ' + aiRawContent;
      const lowerContent = allContent.toLowerCase();

      // 选了方向 → 进入第2步(故事梗概)
      if (currentStep < 2 && /选.*方向|方向.*定|就这个|选这个|飒爽|娇俏|软萌|治愈|爽快|自由|侠女|贵女|医仙/.test(lowerContent)) {
        setCurrentStep(2);
      }
      // 梗概定了/聊角色 → 进入第3步
      if (currentStep < 3 && (/梗概.*定|故事.*定|角色|人物|主角|穿|女孩|男孩|男人|女人|少女|少年|发型|长相|长什么样/.test(lowerContent))) {
        setCurrentStep(3);
        setCreationParams(prev => ({ ...prev, characters: [userMsg.content] }));
      }
      // 聊场景 → 进入第4步
      if (currentStep < 4 && /风格|写实|动漫|赛博|国风|古风|胶片|油画|水墨|极简|暗黑|哥特|场景|街道|房间|森林|城市/.test(lowerContent)) {
        setCurrentStep(4);
        setCreationParams(prev => ({ ...prev, visualStyle: userMsg.content }));
      }
      // 聊镜头 → 进入第5步
      if (currentStep < 5 && /分镜|镜头|远景|特写|跟拍|航拍|运镜|推拉|摇|转场/.test(lowerContent)) {
        setCurrentStep(5);
      }
      // 如果用户已经描述了完整需求，直接跳到第4步
      if (currentStep < 4 && messages.length >= 3) {
        setCurrentStep(prev => Math.max(prev, 3));
      }

      // 更新创作参数
      if (!hasGenerateSignal) {
        // 从用户消息中提取参数
        const durationMatch = userMsg.content.match(/(\d+)\s*[秒分]/);
        if (durationMatch) {
          const val = parseInt(durationMatch[1]);
          setCreationParams(prev => ({ ...prev, targetDuration: val > 10 ? val : val * 60 }));
        }
        setCreationParams(prev => ({ ...prev, inputText: prev.inputText ? prev.inputText + '；' + userMsg.content : userMsg.content }));
      }

      // 更新当前消息的建议为当前步骤的建议
      const nextStep = hasGenerateSignal ? 6 : currentStep;
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, suggestions: STEP_SUGGESTIONS[nextStep] || STEP_SUGGESTIONS[1] } : m
      ));

      // 更新当前聊天的历史记录（保留完整对话内容）
      setChatHistory(prev => {
        const existing = prev.find(h => h.id === currentChatId);
        if (existing) {
          return prev; // 已有记录，不重复添加
        }
        // 首次发送时创建历史条目（用当前messages+userMsg作为初始内容）
        return [{
          id: currentChatId,
          title: userMsg.content.slice(0, 20) + (userMsg.content.length > 20 ? '...' : ''),
          time: Date.now(),
          messages: [...messages, userMsg],
        }, ...prev.slice(0, 19)];
      });
    } catch {
      // 尝试 fallback 到 subtitle/chat
      try {
        const fallbackResponse = await fetch('/api/subtitle/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: userMsg.content }],
            dialogState: { step: messages.length, totalSteps: 4 },
          }),
        });

        const data = fallbackResponse.ok ? await fallbackResponse.json() : null;
        const aiContent = data?.message || `收到你的需求！让我来分析一下：\n\n${userMsg.content}\n\n我们可以先确定创作类型，选个风格和模型，优化一下提示词。你想从哪一步开始？`;

        const aiMsg: ChatMessage = {
          id: genId(),
          role: 'assistant',
          content: aiContent,
          timestamp: Date.now(),
          suggestions: ['继续优化', '开始生成', '更换风格'],
        };
        setMessages(prev => [...prev, aiMsg]);
      } catch (err: unknown) {
        const isAborted = err instanceof DOMException && err.name === 'AbortError';
        if (!isAborted) {
          const aiMsg: ChatMessage = {
            id: genId(),
            role: 'assistant',
            content: '抱歉，处理请求时遇到了问题。请稍后再试。',
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, aiMsg]);
        }
      }

      // 更新当前聊天的历史记录
      setChatHistory(prev => {
        const existing = prev.find(h => h.id === currentChatId);
        if (existing) return prev;
        return [{
          id: currentChatId,
          title: userMsg.content.slice(0, 20) + (userMsg.content.length > 20 ? '...' : ''),
          time: Date.now(),
          messages: [...messages, userMsg],
        }, ...prev.slice(0, 19)];
      });
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      // 最终同步当前对话到历史记录（使用ref获取最新消息）
      const latestMessages = messagesRef.current;
      setChatHistory(prev => {
        const existing = prev.find(h => h.id === currentChatId);
        if (existing) {
          return prev.map(h => h.id === currentChatId
            ? { ...h, messages: [...latestMessages], time: Date.now() }
            : h
          );
        }
        return prev;
      });
    }
  }, [inputValue, isLoading, messages, attachedMedia, analysisType]);

  // 自动触发发送（从控制台跳转时 autoGenerate=true）
  const triggerAutoSendRef = useRef(false);
  useEffect(() => {
    if (autoGenerateRef.current && inputValue.trim() && !isLoading && !triggerAutoSendRef.current) {
      triggerAutoSendRef.current = true;
      autoGenerateRef.current = false;
      const timer = setTimeout(() => {
        handleSend();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [inputValue, isLoading, handleSend]);

  // 建议芯片/快捷工具点击后自动发送
  useEffect(() => {
    if (pendingSuggestionRef.current && inputValue.trim() && !isLoading) {
      pendingSuggestionRef.current = false;
      const timer = setTimeout(() => {
        handleSend();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [inputValue, isLoading, handleSend]);

  // 复制消息
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  // 重新生成消息
  const handleRegenerate = useCallback((msgIndex: number) => {
    // 找到该助手消息之前的用户消息
    const userMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
    // 删除该助手消息及之后的所有消息
    setMessages(prev => prev.slice(0, msgIndex));
    // 用之前的用户消息重新发送
    if (userMsg) {
      setInputValue(userMsg.content);
      setTimeout(() => handleSend(), 100);
    }
  }, [messages, handleSend]);

  // 跳转到历史消息位置
  const scrollToMessage = useCallback((msgId: string) => {
    const el = messageRefs.current.get(msgId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 高亮闪烁效果
      el.classList.add('ring-2', 'ring-red-500/40');
      setTimeout(() => el.classList.remove('ring-2', 'ring-red-500/40'), 1500);
    }
  }, []);

  // 加载历史对话
  const loadHistoryChat = useCallback((historyId: string) => {
    const historyItem = chatHistory.find(item => item.id === historyId);
    if (!historyItem) return;
    if (historyId === currentChatId) {
      const firstMsg = historyItem.messages?.[0];
      if (firstMsg) scrollToMessage(firstMsg.id);
      return;
    }
    if (currentChatId && messages.length > 0) {
      setChatHistory(prev => prev.map(item =>
        item.id === currentChatId
          ? { ...item, messages: [...messages], title: messages[0]?.content.slice(0, 20) || item.title, time: Date.now() }
          : item
      ));
    }
    setCurrentChatId(historyId);
    setMessages(historyItem.messages ? [...historyItem.messages] : []);
    setCurrentStep(1);
    setTimeout(() => {
      const firstMsg = historyItem.messages?.[0];
      if (firstMsg) scrollToMessage(firstMsg.id);
    }, 300);
  }, [chatHistory, currentChatId, messages, scrollToMessage]);

  // 删除聊天历史
  const handleDeleteHistory = useCallback((historyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatHistory(prev => prev.filter(item => item.id !== historyId));
  }, []);

  // 开始新对话
  const handleNewChat = useCallback(() => {
    // 保存当前对话到历史
    if (messages.length > 1) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      const title = lastUserMsg?.content?.slice(0, 30) || '新对话';
      setChatHistory(prev => {
        const existing = prev.find(h => h.id === currentChatId);
        if (existing) {
          return prev.map(h => h.id === currentChatId ? { ...h, title, messages } : h);
        }
        return [{
          id: currentChatId,
          title,
          time: Date.now(),
          messages,
        }, ...prev].slice(0, 20); // 最多保留20条历史
      });
    }

    const newChatId = 'chat-' + Date.now();
    setCurrentChatId(newChatId);
    setCurrentStep(1);
    setCreationParams({});
    setLocalTasks([]);
    setIsLoading(false); // 安全重置，防止卡死
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: '新对话开始啦 ✨\n\n跟我说说你想拍什么吧，聊天就行。',
      timestamp: Date.now(),
      suggestions: STEP_SUGGESTIONS[1],
    }]);
  }, [messages, currentChatId]);

  const handleDirectorChainPlan = useCallback(async () => {
    const recentUserText = [...messages]
      .reverse()
      .filter(message => message.role === 'user')
      .slice(0, 3)
      .reverse()
      .map(message => message.content)
      .join('\n');
    const prompt = inputValue.trim()
      || creationParams.inputText?.trim()
      || recentUserText.trim()
      || '帮我规划一个一分钟短片，输出导演、编剧、制片和镜头设计链路';

    const userMsgId = genId();
    const progressMsgId = `director-chain-${Date.now()}`;
    setIsLoading(true);
    setInputValue('');
    setMessages(prev => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        content: prompt,
        timestamp: Date.now(),
      },
      {
        id: progressMsgId,
        role: 'assistant',
        content: '正在组织导演链路：导演定调、编剧拆镜、制片建档、镜头设计...',
        timestamp: Date.now(),
        generationStatus: 'generating',
        generationProgress: 18,
        generationStepInfo: {
          step: 'director-chain',
          progress: 18,
          totalSteps: 4,
          currentStepLabel: '导演读本',
        },
      },
    ]);

    try {
      const response = await fetch('/api/smart/director-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          duration: creationParams.duration || creationParams.targetDuration || 60,
          segmentDuration: 10,
          style: creationParams.visualStyle || creationParams.mood || '电影感短剧',
          sceneType: 'drama',
          ratio: '16:9',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || '导演链路规划失败');
      }

      const agents = Array.isArray(data.directorChain?.agents) ? data.directorChain.agents : [];
      const agentSummary = agents.map((agent: { title?: string; decisions?: string[] }) => {
        const decisions = Array.isArray(agent.decisions) ? agent.decisions.slice(0, 2).join('；') : '已完成结构化输出';
        return `- **${agent.title || '协作角色'}**：${decisions}`;
      }).join('\n');
      const assetCount = data.productionProject?.assets?.length ?? 0;
      const shotCount = data.productionProject?.storyboard?.shotCount ?? data.shots?.length ?? 0;
      const totalDuration = data.productionProject?.storyboard?.totalDuration ?? data.flow?.totalDuration ?? 0;

      setMessages(prev => prev.map(message => message.id === progressMsgId ? {
        ...message,
        content: [
          '## 导演链路已建档',
          '',
          `已按 ViMAX 式协作链把创意拆成 **${agents.length} 个角色产物**，并写入任务中心。`,
          '',
          agentSummary,
          '',
          `- **任务 ID**：${data.taskId}`,
          `- **项目资产**：${assetCount} 个`,
          `- **镜头计划**：${shotCount} 个，约 ${totalDuration} 秒`,
          '',
          data.directorChain?.handoff?.nextAction || '下一步可进入影视创作页确认角色、场景和分镜。',
        ].join('\n'),
        resultType: 'film',
        generationStatus: 'completed',
        generationProgress: 100,
        generationStepInfo: {
          step: 'director-chain',
          progress: 100,
          totalSteps: 4,
          currentStepLabel: '已写入任务中心',
        },
        quickOptions: ['去影视创作', '查看任务中心', '继续细化角色', '生成分镜图'],
        actions: ['复制', '引用', '修改'],
      } : message));
      setCurrentStep(5);
    } catch (error) {
      setMessages(prev => prev.map(message => message.id === progressMsgId ? {
        ...message,
        content: `导演链路规划失败：${error instanceof Error ? error.message : '未知错误'}\n\n可以先缩短创意描述，或进入影视创作页手动确认剧本、角色和分镜。`,
        generationStatus: 'failed',
        generationProgress: 100,
        generationStepInfo: {
          step: 'director-chain',
          progress: 100,
          totalSteps: 4,
          currentStepLabel: '规划失败',
        },
      } : message));
    } finally {
      setIsLoading(false);
    }
  }, [creationParams, inputValue, messages]);

  // 工具点击 - 导航到对应区域
  const handleToolClick = useCallback((tool: SmartQuickTool) => {
    setSelectedTool(selectedTool === tool.name ? null : tool.name);

    if (tool.action === 'director_chain') {
      handleDirectorChainPlan();
      return;
    }

    if (tool.action && onNavigate) {
      switch (tool.action) {
        case 'video':
          onNavigate('video');
          break;
        case 'image':
          onNavigate('image');
          break;
        case 'film':
          onNavigate('film');
          break;
        case 'text':
          onNavigate('media');
          break;
        case 'prompt':
          pendingSuggestionRef.current = true;
          setInputValue('请帮我优化以下提示词：');
          break;
        case 'quick_create':
          setCurrentStep(1);
          pendingSuggestionRef.current = true;
          setInputValue('我想创作一个短片，帮我从零开始规划');
          break;
      }
    }
  }, [selectedTool, onNavigate, handleDirectorChainPlan]);

  // 任务状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      case 'running': return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
      default: return <Clock className="w-3.5 h-3.5 text-foreground/30" />;
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶部标题栏 */}
      <div className="flex-shrink-0 flex items-center px-5 h-14 border-b border-border bg-card/80 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-8 h-8 rounded-xl text-foreground hover:bg-red-500/10 hover:text-red-500 transition-all mr-3"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-red-500/10">
          <Sparkles className="w-4.5 h-4.5 text-[#70E0FF]" />
        </div>
        <h1 className="text-lg font-bold text-foreground ml-2.5">绘影精灵</h1>
        <span className="ml-2 text-[11px] text-foreground/35">会聊天就行</span>
        <div className="flex-1" />
        {/* 创作进度条 */}
        <div className="flex items-center gap-1">
          {CREATION_STEPS.map((step, idx) => {
            const isActive = currentStep === step.id;
            const isDone = currentStep > step.id;
            return (
              <div key={step.id} className="flex items-center">
                <span
                  className={`text-[11px] font-medium transition-all cursor-default ${
                    isDone ? 'text-green-600 dark:text-green-400' :
                    isActive ? 'bg-red-500 text-white px-2 py-0.5 rounded-md' :
                    'text-foreground/25'
                  }`}
                  title={step.desc}
                >
                  {step.name}
                </span>
                {idx < CREATION_STEPS.length - 1 && (
                  <span className="text-foreground/15 mx-0.5">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 三栏主体 */}
      <div className="flex-1 min-h-0 flex">
        <SmartAssistantSidebar
          allTasks={allTasks}
          assetFilter={assetFilter}
          bgmType={bgmType}
          bgmVolume={bgmVolume}
          chatHistory={chatHistory}
          creationParams={creationParams}
          currentChatId={currentChatId}
          currentStep={currentStep}
          formatTime={formatTime}
          getStatusIcon={getStatusIcon}
          handleDeleteHistory={handleDeleteHistory}
          handleDeleteReference={handleDeleteReference}
          handleNewChat={handleNewChat}
          handleReferenceClick={handleReferenceClick}
          handleReferenceFileUpload={handleReferenceFileUpload}
          handleToolClick={handleToolClick}
          isDragOver={isDragOver}
          leftPanelTab={leftPanelTab}
          loadHistoryChat={loadHistoryChat}
          messages={messages}
          referenceFileInputRef={refFileInputRef}
          references={references}
          selectedTool={selectedTool}
          setAssetFilter={setAssetFilter}
          setBgmType={setBgmType}
          setBgmVolume={setBgmVolume}
          setCreationParams={setCreationParams}
          setIsDragOver={setIsDragOver}
          setLeftPanelTab={setLeftPanelTab}
          setLightboxImage={setLightboxImage}
          setTtsSpeed={setTtsSpeed}
          setTtsVoiceId={setTtsVoiceId}
          ttsSpeed={ttsSpeed}
          ttsVoiceId={ttsVoiceId}
        />

        <SmartAssistantChatWorkspace
          {...{
            analysisType,
            attachedMedia,
            chatContainerRef,
            collectTransferData,
            copiedId,
            copiedMsgId,
            creationParams,
            currentStep,
            editingText,
            editingMsgId,
            fetchCreationPlanStream,
            fileInputRef,
            handleCancel,
            handleCopy,
            handleFileUpload,
            handleGenerationConfirm,
            handleRegenerate,
            handleSend,
            handleStoryboardConfirm,
            inputValue,
            isAtBottom,
            isLoading,
            messageRefs,
            messages,
            messagesEndRef,
            onNavigate,
            pendingSuggestionRef,
            removeAttachedMedia,
            scrollToBottom,
            setAnalysisType,
            setCurrentStep,
            setCopiedMsgId,
            setEditingText,
            setEditingMsgId,
            setInputValue,
            setIsLoading,
            setLightboxImage,
            setMessages,
          }}
        />
      </div>

      {/* 大图预览灯箱 */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={lightboxImage}
              alt="大图预览"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white/90 text-foreground flex items-center justify-center hover:bg-white transition-all shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 参考素材上传用隐藏文件输入 */}
      <input
        ref={refFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => {
          const files = Array.from(e.target.files || []);
          if (files.length) handleReferenceFileUpload(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
