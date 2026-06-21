export type TaskType = 'video' | 'image' | 'poster' | 'copywriting' | 'avatar' | 'storyboard' | 'douyin';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskConfig {
  prompt: string;
  duration?: string;
  resolution?: string;
  ratio?: string;
  style?: string;
  mood?: string;
  filter?: string;
  colorTheme?: string;
  [key: string]: any;
}

export interface TaskResult {
  videoUrl?: string;
  imageUrls?: string[];
  posterUrl?: string;
  content?: string;
  assemblyPlan?: {
    version: string;
    productionProjectId: string;
    sourceTaskId: string;
    totalDuration: number;
    segmentCount: number;
    status: string;
    boundaryBridgePlan?: {
      version: string;
      productionProjectId: string;
      boundaries: Array<{
        id: string;
        index: number;
        previousSegmentId: string;
        nextSegmentId: string;
        sourceLastFrameUrl: string | null;
        targetFirstFrameUrl: string | null;
        bridgeVideoUrl: string | null;
        bridgeLastFrameUrl: string | null;
        newCameraImageUrl: string | null;
        status: string;
        bridgePrompt: string;
        targetOpeningContract: string;
        audioBridgeCue?: string;
      }>;
    };
    segments: Array<{
      id: string;
      index: number;
      shotId: string;
      duration: number;
      prompt: string;
      status: string;
      error?: string | null;
      startedAt?: string;
      completedAt?: string;
      expectedInputs?: {
        firstFrameUrl?: string | null;
        previousLastFrameUrl?: string | null;
        sourceSegmentId?: string | null;
        sourceAssetId?: string | null;
        continuityPrompt?: string | null;
        previousAudioCue?: string | null;
        audioContinuityPrompt?: string | null;
        previousStoryStateCue?: string | null;
        storyContinuityPrompt?: string | null;
        boundaryBridgeId?: string | null;
        boundaryBridgePrompt?: string | null;
        bridgeFirstFrameUrl?: string | null;
        bridgeStrategy?: string | null;
      };
      expectedOutputs?: {
        videoUrl: string | null;
        lastFrameUrl: string | null;
        taskId: string | null;
        providerTaskId?: string | null;
        audioCue?: string | null;
        hasAudio?: boolean | null;
      };
      audioState?: {
        dialogue?: string | null;
        narration?: string | null;
        soundDesign?: string;
        voiceStyle?: string;
        emotion?: string;
        audioCue?: string;
      };
    }>;
    recovery?: Record<string, unknown>;
    nextAction?: string;
  };
  assemblyQueue?: {
    version: string;
    sourceTaskId: string;
    status: string;
    queuedSegmentCount: number;
    childTaskIds: string[];
    updatedAt: string;
  };
  latestBoundaryBridgeStartPayload?: Record<string, unknown>;
  storyReadability?: {
    version: string;
    score: number;
    pass: boolean;
    threshold: number;
    issues?: Array<{
      code: string;
      severity: 'blocker' | 'warning';
      message: string;
    }>;
    nextActions?: string[];
  };
  directorChain?: {
    version: string;
    agents: Array<{
      role: string;
      title: string;
      objective: string;
      decisions: string[];
      output?: Record<string, unknown>;
    }>;
    handoff?: {
      productionProjectId: string;
      taskId: string;
      readyAssetKinds: string[];
      nextRoute: string;
      nextAction: string;
    };
    qualityGates?: string[];
  };
  productionProject?: {
    id: string;
    title: string;
    duration: number;
    assets: Array<{
      id: string;
      kind: string;
      name: string;
      status: string;
      summary: string;
      relatedShotIds?: string[];
      metadata?: Record<string, any>;
    }>;
    stages: Array<{
      id: string;
      name: string;
      status: string;
      summary: string;
      assetIds?: string[];
    }>;
    storyboard?: {
      shotCount: number;
      totalDuration: number;
      shots: Array<{
        id: string;
        index: number;
        duration: number;
        phaseLabel?: string;
        shotTypeLabel?: string;
        prompt: string;
        status: string;
      }>;
    };
    output?: {
      status: string;
      taskId: string;
      canProceedToVideo: boolean;
      nextStep: string;
    };
  };
  segments?: Array<{
    index: number;
    taskId?: string;
    status?: 'pending' | 'running' | 'completed' | 'failed';
    prompt?: string;
    duration?: number;
    ratio?: string;
    videoModel?: string;
    providerTaskId?: string;
    videoUrl?: string;
    lastFrameUrl?: string;
    lastFrameSource?: 'provider' | 'extracted' | null;
    audioCue?: string | null;
    hasAudio?: boolean | null;
    error?: string;
  }>;
  handoff?: {
    requiresTailFrame?: boolean;
    lastFrameUrlPresent?: boolean;
    lastFrameSource?: 'provider' | 'extracted' | null;
    punchThroughReady?: boolean;
  };
  // 分段视频相关
  isPartial?: boolean;
  failedSegments?: number[];
  successSegmentCount?: number;
  segmentCount?: number;
  failedSegmentsDetails?: Array<{
    index: number;
    error?: string;
    errorType?: string;
    fixStrategy?: string;
    retryCount?: number;
  }>;
  [key: string]: any;
}

export interface BackgroundTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  config: TaskConfig;
  result?: TaskResult;
  progress: number;
  stage: string;
  message?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  abortController?: AbortController;
  elapsedSeconds?: number;
  isTerminal?: boolean;
  nextPollMs?: number;
  waitingHint?: string;
  streamStatus?: 'connecting' | 'live' | 'reconnecting' | 'closed' | 'error';
}

export interface TaskContextType {
  tasks: BackgroundTask[];
  setTasks: (tasks: BackgroundTask[]) => void;
  addTask: (task: Omit<BackgroundTask, 'id' | 'createdAt'> & { id?: string }) => string;
  updateTask: (id: string, updates: Partial<BackgroundTask>) => void;
  removeTask: (id: string) => void;
  removeTasks: (ids: string[]) => Promise<void>;
  cancelTask: (id: string) => void;
  getRunningTasks: () => BackgroundTask[];
  getCompletedTasks: () => BackgroundTask[];
  clearCompletedTasks: () => void;
  clearFailedTasks: () => void;
  clearCancelledTasks: () => void;
  clearAllTasks: () => Promise<void>;
  syncFromServer: (force?: boolean) => Promise<void>;
  lastCleanupCount: number;
  lastSyncedAt: number | null;
  lastSyncError: string | null;
}
