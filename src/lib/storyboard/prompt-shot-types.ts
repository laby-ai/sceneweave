/** 分镜阶段标签 */
export type ShotPhase = 'establishing' | 'developing' | 'detail' | 'climax' | 'resolving';

/** 分镜镜头类型 */
export type ShotType = 'establishing' | 'action' | 'closeup' | 'transition' | 'closing' | 'hero' | 'lifestyle' | 'texture' | 'presentation' | 'climax';

/** v3.0 增强版分镜镜头 */
export interface PromptBasedShot {
  id: string;
  prompt: string;
  duration: number;
  /** 叙事阶段（v3.0新增） */
  phase?: ShotPhase;
  /** 镜头类型（v3.0新增） */
  shotType?: ShotType;
  /** 阶段显示名称（v3.0新增） */
  phaseLabel?: string;
  /** 镜头类型显示名称（v3.0新增） */
  shotTypeLabel?: string;
  /** ★ 建议字幕文本（v4.0新增 - 根据镜头画面自动生成） */
  subtitleText?: string;
  /** ★ 建议旁白文本（v4.0新增 - 该镜头对应的旁白/解说词） */
  narrationText?: string;
}

/** ★ 字幕建议结果（v4.0新增） */
export interface SubtitleSuggestion {
  /** 字幕分段数组，可直接用于 SubtitleEditor */
  segments: Array<{
    text: string;
    startTime: number;
    endTime: number;
  }>;
  /** 完整字幕文本（纯文本拼接） */
  fullText: string;
}

/** ★ 旁白脚本建议（v4.0新增） */
export interface NarrationSuggestion {
  /** 完整旁白脚本文本 */
  script: string;
  /** 按镜头拆分的旁白片段 */
  perShot: Array<{
    shotIndex: number;
    text: string;
    startTime: number;
    endTime: number;
  }>;
}
