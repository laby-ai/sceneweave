import type { VimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';

export type VimaxAgentPhase = 'plan' | 'reference_assets' | 'video';

export interface VimaxAgentReferenceAsset {
  kind?: string;
  label?: string;
  prompt?: string;
  url?: string;
  shotIndex?: number;
}

export interface VimaxAgentPlan {
  title: string;
  summary: string;
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
    referenceUrl?: string;
    videoUrl?: string;
  }>;
  nextAction: string;
}

export interface VimaxAgentStepBody {
  taskId?: string;
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
}
