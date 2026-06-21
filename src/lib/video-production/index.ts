/**
 * 视频生产平台 v3.2 - 统一导出
 */

// 类型
export type {
  ShotTypeCode, ShotTypeDefinition,
  CameraMovementCode, CameraMovementDefinition,
  TransitionCode, TransitionDefinition,
  ContentTypeCode, NarrativeSegmentType, EmotionTag, PacingLabel,
  NarrativeSegmentTemplate, ShotDistribution, TransitionStyle,
  NarrativeTemplate,
  StorySegment, WriterOutput, CharacterProfile,
  DirectorShot, EmotionCurvePoint, DirectorOutput,
  AssetDecision, ScheduleStats, SchedulerOutput,
  EntryMode, PipelineConfig, PipelineOutput,
  // v3.1 新增类型
  VideoScore, QualityThresholds, QualityVerdict, QualityGateResult,
  DAGNodeStatus, DAGNode, DAGExecutionLog, DAGExecutionResult,
  CharacterRole, CharacterArcType, ConflictType,
  CharacterRelationship, EnhancedCharacterProfile,
  StylePresetCode, StylePreset,
  VideoModelCode, ModelCapabilities, VideoModelDefinition,
  SceneFeatures, ModelRoutingResult, RoutingWeights,
  ImagePromptLayers, VideoPromptLayers,
  PromptStrategy, VideoPromptStrategy,
  OutputFormat, DirectorPlanMeta, ThreeActTiming, TechnicalSpecs,
  PipelineOutputV31,
  // v3.2 新增类型
  ModelAvailability, FallbackStrategy, FallbackStep,
  RecommendedModelDetail,
} from './types';

// 常量
export {
  SHOT_TYPES, CAMERA_MOVEMENTS, TRANSITIONS,
  NARRATIVE_TEMPLATES, ENHANCE_OPERATIONS,
  COST_WEIGHTS, CONTENT_TYPE_TABLE,
  // v3.1 新增常量
  STYLE_PRESETS, CONFLICT_TYPES,
  VIDEO_MODELS, DEFAULT_ROUTING_WEIGHTS,
  DEFAULT_QUALITY_THRESHOLDS,
  NEGATIVE_PROMPTS, IMAGE_PROMPT_PRIORITY, VIDEO_PROMPT_PRIORITY,
  // v3.2 新增常量
  DEFAULT_FALLBACK_CHAIN, SCENARIO_FALLBACK_MAP,
  DEFAULT_MODEL_AVAILABILITY, FALLBACK_STRATEGY_CONFIG,
  MODEL_PROFILE_TAGS, MODEL_RELATIVE_METRICS,
} from './constants';

// Agent (v3.0)
export { WriterAgent } from './writer-agent';
export { DirectorAgent } from './director-agent';
export { HybridScheduler } from './hybrid-scheduler';
export { AutoDirectorPipeline, createPipeline } from './auto-director-pipeline';

// v3.1 新增模块
export { AIQualityAssessor, createQualityAssessor } from './ai-quality-assessor';
export type { AssessRequest } from './ai-quality-assessor';
export { DAGExecutor, createDAGExecutor } from './dag-executor';
export type { AgentExecutor, DAGBuildConfig } from './dag-executor';
export { DirectorOutputGenerator, generateDirectorOutput } from './director-output-generator';
export { VideoModelRouter, createModelRouter } from './model-router';
export type { RouterConfig, ManualSelectionCheck } from './model-router';
export { PromptEngineer, createPromptEngineer } from './prompt-engineer';
