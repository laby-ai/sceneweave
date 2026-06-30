import type { Dispatch, SetStateAction } from 'react';

import type { UserSettings } from '@/constants/themes';
import type { BackgroundTask, TaskConfig, TaskResult } from '@/types/task';
import type {
  ContentSafetyCheck,
  CopyrightCheckResult,
  MonitorTask,
  OperationLog,
} from '@/lib/video-monitor';
import type { Material } from '@/components/material-upload';
import type { SmartAssistantTransferData } from '@/types/film';

export type ApiProviderType = 'openai-compatible' | 'ark-plan';
export type DreamboxMaterial = string | Partial<Material>;

export interface ApiConnectionStatus {
  type: 'idle' | 'testing' | 'success' | 'error';
  message: string;
}

export interface GeneratedVideo {
  id: string;
  videoUrl: string;
  prompt: string;
  createdAt: number;
  duration?: string;
  style?: string;
  mood?: string;
  filter?: string;
  resolution?: string;
  ratio?: string;
  materials?: DreamboxMaterial[];
  hasSubtitle?: boolean;
  enableSubtitle?: boolean;
  subtitleText?: string;
  subtitlePosition?: string;
  subtitleFontSize?: string;
  subtitleColor?: string;
  subtitleVoiceType?: string;
  subtitleSpeechSpeed?: number;
  generateVoice?: boolean;
  srtData?: string;
  subtitleBurned?: boolean;
  srtEntryCount?: number;
}

export interface GeneratedImage {
  id: string;
  imageUrls: string[];
  prompt: string;
  createdAt: number;
  size?: string;
  style?: string;
  mood?: string;
  filter?: string;
  resolution?: string;
  quality?: string;
  materials?: DreamboxMaterial[];
  enableImageText?: boolean;
  imageText?: string;
}

export interface GeneratedCopywriting {
  id: string;
  content?: string;
  imageUrls?: string[];
  platform?: string;
  prompt: string;
  title?: string;
  createdAt: number;
}

export interface ProductionCaseAsset {
  id: string;
  title: string;
  type: string;
  taskId: string;
  projectTitle: string;
  videoUrl: string;
  posterUrl: string;
  durationLabel: string;
  source: 'productionProject.assets.videoSegment' | 'productionProject.assets.finalVideo';
}

export interface HistoricalMediaAsset {
  id: string;
  kind: 'image' | 'video';
  title: string;
  url: string;
  poster?: string;
  createdAt: number;
  source: 'historical';
}

export interface HomeGalleryItem {
  title: string;
  src: string;
  videoSrc?: string;
  span: string;
  type: string;
  target: string;
  href?: string;
  duration?: string;
  source?: 'static' | 'production-case-asset' | 'historical';
}

export interface StoryboardShotResult {
  id: string;
  prompt: string;
  duration: number;
  status?: string;
  error?: string;
  nineGridImages?: string[];
  videoUrl?: string;
}

export interface StoryboardTaskResult extends TaskResult {
  totalShots?: number;
  totalDuration?: number;
  videoUrl?: string;
  srtData?: string;
  subtitleBurned?: boolean;
  shots?: StoryboardShotResult[];
}

export interface StoryboardTask extends Omit<BackgroundTask, 'result'> {
  result?: StoryboardTaskResult;
}

export interface MonitorDetail {
  logs: OperationLog[];
  safetyChecks: ContentSafetyCheck[];
  copyrightResult?: CopyrightCheckResult;
}

export type MonitorDetails = Record<string, MonitorDetail>;

export type SetGeneratedVideo = Dispatch<SetStateAction<GeneratedVideo | null>>;
export type SetGeneratedImage = Dispatch<SetStateAction<GeneratedImage | null>>;
export type SetGeneratedCopywriting = Dispatch<SetStateAction<GeneratedCopywriting | null>>;
export type SetStoryboardTask = Dispatch<SetStateAction<StoryboardTask | null>>;
export type SetVideoHistory = Dispatch<SetStateAction<GeneratedVideo[]>>;
export type SetImageInitialConfig = Dispatch<SetStateAction<Partial<GeneratedImage> | null>>;
export type SetVideoInitialConfig = Dispatch<SetStateAction<Partial<GeneratedVideo> | null>>;

export interface DreamboxTaskControls {
  backgroundTasks: BackgroundTask[];
  cancelTask: (taskId: string) => void;
  monitorDetails: MonitorDetails;
  monitorTasks: MonitorTask[];
  removeTask: (taskId: string) => void;
  syncFromServer: () => void | Promise<void>;
}

export interface DreamboxGenerationHandlers {
  handleEditImage: (image?: GeneratedImage | null) => void;
  handlePosterGenerated: (imageData: unknown) => void;
  handlePromptEnhanced: (originalPrompt: string, enhancedPrompt: string) => void;
  handleRegenerateImage: (imageOrPrompt: GeneratedImage | string) => void;
  handleRemixImage: (image: GeneratedImage) => void;
}

export interface DreamboxSettingsControls {
  apiConnectionStatus: ApiConnectionStatus;
  settingsApiProvider: ApiProviderType;
  setSettingsApiProvider: Dispatch<SetStateAction<ApiProviderType>>;
  smartAssistantTransfer: SmartAssistantTransferData | undefined;
  setSmartAssistantTransfer: Dispatch<SetStateAction<SmartAssistantTransferData | undefined>>;
  syncFromServer: () => void | Promise<void>;
  updateUserSettings: (settings: Partial<UserSettings>) => void;
}

export type DreamboxTaskConfig = TaskConfig;
