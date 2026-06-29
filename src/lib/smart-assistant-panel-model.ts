export interface SmartAssistantPanelProps {
  onBack?: () => void;
  onNavigate?: (section: string, prompt?: string, transferData?: import('@/types/film').SmartAssistantTransferData) => void;
  initialPrompt?: string;
  autoGenerate?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  suggestions?: string[];
  resultType?: 'video' | 'image' | 'text' | 'film';
  mediaAttachments?: Array<{
    type: 'image' | 'video';
    url: string;
    name?: string;
  }>;
  analysisType?: 'describe' | 'prompt' | 'tag';
  generationProgress?: number;
  generationStatus?: 'pending' | 'generating' | 'completed' | 'failed';
  generationStepInfo?: {
    step: string;
    progress: number;
    totalSteps: number;
    currentStepLabel: string;
  };
  generatedImages?: Array<{
    url: string;
    prompt?: string;
    label?: string;
  }>;
  generatedVideo?: {
    url: string;
    coverUrl?: string;
    duration?: number;
    prompt?: string;
  };
  generationType?: 'script' | 'storyboard' | 'character' | 'scene' | 'video' | 'image' | 'prop';
  assetType?: '角色' | '场景' | '分镜' | '道具' | '图片' | 'storyboard';
  assetPrompt?: string;
  quickOptions?: string[];
  storyboardData?: {
    title: string;
    shots: Array<{
      shotId: string;
      description: string;
      shotType: string;
      duration: number;
      characterIds: string[];
      sceneName: string;
      camera: string;
      imagePrompt?: string;
      videoPrompt?: string;
      dialogue?: string;
      narration?: string;
      bgmCue?: string;
      transition?: string;
      emotionNote?: string;
      colorNarrative?: string;
    }>;
    characters: Array<{
      name: string;
      description: string;
      imagePrompt?: string;
      anchor?: string;
      mbti?: string;
      arc?: string;
      signatureDetail?: string;
      consistencyRules?: { mustInclude?: string[]; mustExclude?: string[] };
    }>;
    scenes: Array<{
      name: string;
      description: string;
      imagePrompt?: string;
      lighting?: string;
      environment?: { visual?: string; auditory?: string; olfactory?: string; atmosphere?: string; symbolism?: string };
    }>;
    style?: Record<string, unknown>;
    totalDuration?: number;
    narration?: Record<string, unknown>;
    bgm?: Record<string, unknown>;
    consistency?: Record<string, unknown>;
  };
  storyboardConfirmed?: boolean;
  pendingGenerations?: Array<{
    id: string;
    type: 'image' | 'character' | 'scene' | 'prop';
    prompt: string;
    label: string;
    negativePrompt?: string;
    status?: 'pending' | 'generating' | 'completed' | 'failed';
  }>;
  pendingGeneration?: {
    type: 'image' | 'character' | 'scene' | 'prop';
    prompt: string;
    label: string;
    negativePrompt?: string;
    characterViews?: string[];
  };
  characterDesignSheet?: {
    imageUrl: string;
    characterName: string;
  };
  actions?: string[];
  vimaxAgent?: {
    phase: 'plan' | 'reference_assets' | 'video_cost_confirm' | 'video';
    title: string;
    summary: string;
    model: string;
    costState: 'incurred' | 'not-yet' | 'blocked';
    nextAction: string;
    taskId?: string;
    assets?: Array<{
      kind: 'script' | 'character' | 'scene' | 'prop' | 'shot' | 'reference';
      label: string;
      prompt?: string;
      url?: string;
      /** 关联到的分镜序号；用于把参考图归位到对应 Clip 下。 */
      shotIndex?: number;
      status: 'planned' | 'generated' | 'blocked';
    }>;
    shots?: Array<{
      index: number;
      title: string;
      duration: number;
      camera: string;
      prompt: string;
      /** 该 Clip 的参考首帧图（reference_assets 阶段回填）。 */
      referenceUrl?: string;
      /** 该 Clip 的成片视频（video 阶段回填）。 */
      videoUrl?: string;
      /** 该 Clip 的生成状态，驱动逐条渲染。 */
      status?: 'planned' | 'reference' | 'video' | 'blocked';
    }>;
  };
}

export interface TaskItem {
  id: string;
  type: string;
  status: string;
  prompt: string;
  progress: number;
  stage: string;
  createdAt: number;
  result?: {
    videoUrl?: string;
    imageUrls?: string[];
    content?: string;
  };
}

export interface ChatHistoryEntry {
  id: string;
  title: string;
  time: number;
  messages: ChatMessage[];
  step?: number;
  params?: Record<string, unknown>;
}

const CHAT_STORAGE_KEY = 'dreambox-smart-chat-history';
const MESSAGES_STORAGE_KEY = 'dreambox-smart-messages';

export const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export function loadChatHistory(): ChatHistoryEntry[] {
  try {
    const data = localStorage.getItem(CHAT_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(history: ChatHistoryEntry[]) {
  try {
    const slimHistory = history.map(historyEntry => ({
      ...historyEntry,
      messages: historyEntry.messages?.map(message => ({
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        suggestions: message.suggestions,
        quickOptions: message.quickOptions,
        generationType: message.generationType,
        generationStatus: message.generationStatus,
        generationProgress: message.generationProgress,
        generatedImages: message.generatedImages?.map(image => ({ url: image.url, label: image.label, prompt: image.prompt })),
        generatedVideo: message.generatedVideo,
        vimaxAgent: message.vimaxAgent,
      })),
    }));
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(slimHistory.slice(0, 20)));
  } catch {
    try {
      const trimmed = history.slice(0, 5);
      const slimHistory = trimmed.map(historyEntry => ({
        ...historyEntry,
        messages: historyEntry.messages?.slice(0, 10).map(message => ({
          id: message.id,
          role: message.role,
          content: message.content?.slice(0, 200),
          timestamp: message.timestamp,
        })),
      }));
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(slimHistory));
    } catch {
      // Ignore storage failures so chat remains usable in private/full storage modes.
    }
  }
}

export function loadMessages(): ChatMessage[] | null {
  try {
    const data = localStorage.getItem(MESSAGES_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages.slice(-50)));
  } catch {
    // Ignore storage failures.
  }
}
