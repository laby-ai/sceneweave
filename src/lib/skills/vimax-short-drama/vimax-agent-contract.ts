import type { VimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';
import type {
  VimaxContinuityPriority,
  VimaxShotHandoffIntent,
} from '@/lib/skills/vimax-short-drama/vimax-shot-generation-route';

export type VimaxAgentPhase = 'planning_readiness' | 'planning_connection_validate' | 'plan' | 'reference_assets' | 'video';

export interface VimaxAgentReferenceAsset {
  kind?: string;
  label?: string;
  prompt?: string;
  url?: string;
  shotIndex?: number;
  subjectId?: string;
  subjectView?: 'front' | 'side' | 'back';
  selectedSubjectViews?: Array<{
    subjectId: string;
    label: string;
    view: 'front' | 'side' | 'back';
    viewId: string;
    url: string;
  }>;
  candidateUrls?: string[];
  selectedCandidateIndex?: number;
  selectionReason?: string;
}

export interface VimaxAgentPlan {
  title: string;
  summary: string;
  story?: {
    premise?: string;
    protagonist?: string;
    desire?: string;
    obstacle?: string;
    conflict?: string;
    turningPoint?: string;
    endingHook?: string;
    emotionalArc?: {
      start?: string;
      shift?: string;
      end?: string;
    };
  };
  characters?: Array<{
    id: string;
    label: string;
    description: string;
    continuityAnchors?: string[];
  }>;
  scenes?: Array<{
    id: string;
    label: string;
    description: string;
    timeOfDay?: string;
    continuityAnchors?: string[];
  }>;
  props?: Array<{
    id: string;
    label: string;
    description: string;
    state?: string;
  }>;
  assets: Array<{
    kind: 'script' | 'character' | 'scene' | 'prop' | 'shot' | 'reference';
    label: string;
    prompt: string;
    referenceUrl?: string;
    videoUrl?: string;
  }>;
  shots: Array<{
    index: number;
    title: string;
    duration: number;
    camera: string;
    prompt: string;
    sceneId?: string;
    characterIds?: string[];
    propIds?: string[];
    actionStart?: string;
    actionEnd?: string;
    firstFrameDescription?: string;
    lastFrameDescription?: string;
    motionDescription?: string;
    dialogue?: string;
    narration?: string;
    audioIntent?: string;
    handoffIntent?: VimaxShotHandoffIntent;
    handoffReason?: string;
    spatialRelation?: 'same-scene' | 'new-scene';
    temporalRelation?: 'continuous' | 'elapsed' | 'time-jump';
    routeConfidence?: 'high' | 'medium' | 'low';
    conflictFlags?: string[];
    continuityPriorities?: VimaxContinuityPriority[];
    referenceUrl?: string;
    videoUrl?: string;
  }>;
  nextAction: string;
}

export interface VimaxAgentStepBody {
  taskId?: string;
  requestId?: string;
  phase?: VimaxAgentPhase;
  prompt?: string;
  plan?: VimaxAgentPlan;
  assets?: VimaxAgentReferenceAsset[];
  model?: string;
  ratio?: string;
  resolution?: string;
  duration?: number;
  segmentDuration?: number;
  segmentCount?: number;
  sceneType?: string;
  style?: string;
  skillId?: string;
  stream?: boolean;
  productionPlan?: VimaxProductionPlan;
  /** 视频阶段必须显式确认，避免误触发计费。 */
  confirm?: boolean;
  /** 仅用于用户看过冲突列表后确认低置信镜头路线，不适用于旧计划。 */
  confirmRouteDecisions?: boolean;
  referenceIds?: string[];
  /** 长视频阶段由既有任务中心异步执行，避免请求被网关超时截断。 */
  background?: boolean;
  recover?: boolean;
  recoverCreatedAfter?: number;
}
