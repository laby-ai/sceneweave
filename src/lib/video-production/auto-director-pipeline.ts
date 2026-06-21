/**
 * 自动化导演流水线 v3.1 - 整合 Writer + Director + Scheduler + v3.1 新增模块
 * 实现"自动化导演为主，自动化编辑为辅"
 * 
 * 流程:
 * 1. 编剧Agent - 类型识别 + 叙事生成
 * 2. 导演Agent - 分镜编排 + 导演指令
 * 3. 混合调度 - 素材检索 + AI生成决策
 * 4. 模型路由 - 为每个分镜选择最优视频生成模型
 * 5. 提示词工程 - 生成结构化图像/视频提示词
 * 6. AI质量评估 - 三维度评估 + 质检关卡
 * 7. DAG工作流编排 - 多Agent协同编排
 * 8. 导演方案输出 - 专业导演方案 / 影视剧本双格式
 */

import { WriterAgent } from './writer-agent';
import { DirectorAgent } from './director-agent';
import { HybridScheduler } from './hybrid-scheduler';
import { VideoModelRouter } from './model-router';
import { PromptEngineer } from './prompt-engineer';
import { AIQualityAssessor } from './ai-quality-assessor';
import { DAGExecutor } from './dag-executor';
import { DirectorOutputGenerator } from './director-output-generator';
import type {
  PipelineConfig, PipelineOutput, PipelineOutputV31, WriterOutput,
  DirectorOutput, SchedulerOutput, ContentTypeCode,
  OutputFormat, ModelRoutingResult, QualityGateResult,
  VideoModelCode, FallbackStrategy,
} from './types';
import type { RouterConfig } from './model-router';

/** v3.1 流水线扩展结果 */
export interface PipelineResultV31 {
  writerOutput: WriterOutput;
  directorOutput: DirectorOutput;
  schedulerOutput: SchedulerOutput;
  writerPrompt: string;
  directorPrompt: string;
  summary: PipelineOutput['summary'];
  // v3.1 新增
  modelRoutings: ModelRoutingResult[];
  qualityResult?: QualityGateResult[];
  markdownOutput?: string;
}

export class AutoDirectorPipeline {
  private writer: WriterAgent;
  private director: DirectorAgent;
  private scheduler: HybridScheduler;
  private modelRouter: VideoModelRouter;
  private promptEngineer: PromptEngineer;
  private qualityAssessor: AIQualityAssessor;
  private config: PipelineConfig;

  constructor(config?: Partial<PipelineConfig>, routerConfig?: RouterConfig) {
    this.config = {
      entryMode: config?.entryMode || 'full_pipeline',
      duration: config?.duration || 180,
      aspectRatio: config?.aspectRatio || '16:9',
      style: config?.style || 'cinematic',
      thresholdMatch: config?.thresholdMatch ?? 0.80,
      thresholdEnhance: config?.thresholdEnhance ?? 0.60,
      skipScheduling: config?.skipScheduling ?? false,
      dryRun: config?.dryRun ?? false,
    };

    this.writer = new WriterAgent();
    this.director = new DirectorAgent();
    this.scheduler = new HybridScheduler({
      thresholdMatch: this.config.thresholdMatch,
      thresholdEnhance: this.config.thresholdEnhance,
    });
    this.modelRouter = new VideoModelRouter(routerConfig);
    this.promptEngineer = new PromptEngineer();
    this.qualityAssessor = new AIQualityAssessor();
  }

  /**
   * 执行完整流水线（纯逻辑层，不调用LLM）
   * 返回结构化数据 + LLM提示词，由 API 层负责调用 LLM
   */
  run(userInput: string, options?: {
    contentType?: ContentTypeCode;
    duration?: number;
    characters?: Array<{ name: string; role: string }>;
    outputFormat?: OutputFormat;
    /** v3.2: 手动指定模型 */
    manualModel?: VideoModelCode;
    /** v3.2: 降级策略 */
    fallbackStrategy?: FallbackStrategy;
    /** v3.2: 模型可用状态覆盖 */
    modelAvailability?: Partial<Record<VideoModelCode, 'available' | 'degraded' | 'unavailable' | 'unknown'>>;
  }): PipelineResultV31 {
    const duration = options?.duration || this.config.duration;

    // ========== Stage 1: 编剧 ==========
    const writerOutput = this.writer.generateStoryOutline(
      userInput,
      options?.contentType,
      { duration, characters: options?.characters }
    );

    // 构建 LLM 编剧提示词
    const writerPrompt = this.writer.buildWriterPrompt(
      userInput,
      writerOutput,
      { duration, style: this.config.style }
    );

    // ========== Stage 2: 导演 ==========
    const directorOutput = this.director.directStoryboard(
      writerOutput.narrative,
      {
        contentType: writerOutput.contentType,
        aspectRatio: this.config.aspectRatio,
        targetDuration: duration,
      }
    );

    // 构建 LLM 导演提示词
    const directorPrompt = this.director.buildDirectorPrompt(
      directorOutput.shots,
      this.config.style
    );

    // ========== Stage 3: 混合调度 ==========
    let schedulerOutput: SchedulerOutput;
    if (!this.config.skipScheduling) {
      schedulerOutput = this.scheduler.scheduleStoryboard({
        shots: directorOutput.shots,
        metadata: {
          userInput,
          contentType: writerOutput.contentType,
          style: this.config.style,
        },
      });
    } else {
      schedulerOutput = {
        decisions: directorOutput.shots.map(s => ({
          shotId: s.shotId,
          mode: 'ai_generated' as const,
          reason: '跳过调度，默认AI生成',
          matchScore: 0,
          asset: null,
          enhanceOperations: [],
          estimatedCost: 1.0,
          qualityIssues: [],
        })),
        stats: {
          stockMatched: 0,
          enhanced: 0,
          aiGenerated: directorOutput.shots.length,
          totalCost: directorOutput.shots.length,
          costSaved: 0,
        },
      };
    }

    // 合并调度结果到分镜
    for (const decision of schedulerOutput.decisions) {
      const shot = directorOutput.shots.find(s => s.shotId === decision.shotId);
      if (shot) {
        shot.assetSource = decision.mode;
        shot.matchScore = decision.matchScore;
      }
    }

    // ========== Stage 4: 模型路由 (v3.2 增强降级+推荐+自主选择) ==========
    // 更新可用状态
    if (options?.modelAvailability) {
      this.modelRouter.updateAvailabilityBatch(options.modelAvailability);
    }
    // 更新降级策略
    if (options?.fallbackStrategy) {
      // 重建路由器以更新策略 (简化实现)
      this.modelRouter = new VideoModelRouter({
        fallbackStrategy: options.fallbackStrategy,
        availability: options.modelAvailability,
      });
    }

    const sceneFeaturesList = directorOutput.shots.map(shot => ({
      description: shot.subject || shot.visualPrompt,
      style: shot.style,
      duration: shot.duration,
      hasAudioSync: Boolean(shot.audioContent),
      needsCharacterConsistency: shot.characterRefs.length > 0,
      contentType: writerOutput.contentType,
    }));

    let modelRoutings: ModelRoutingResult[];
    if (options?.manualModel) {
      // v3.2: 用户手动指定模型 — 逐场景校验+降级
      modelRoutings = sceneFeaturesList.map(features =>
        this.modelRouter.routeWithManualOverride(features, options.manualModel!)
      );
    } else {
      // 自动智能路由
      modelRoutings = this.modelRouter.routeBatch(sceneFeaturesList);
    }

    // ========== Stage 5: 提示词工程 (v3.1) ==========
    for (const shot of directorOutput.shots) {
      const strategies = this.promptEngineer.recommendStrategy(writerOutput.contentType);
      shot.visualPrompt = this.promptEngineer.generateImagePrompt(shot, strategies.imageStrategy);
      if (!shot.audioContent) {
        shot.audioContent = '';
      }
    }

    // ========== Stage 6: AI 质量评估 (v3.1) ==========
    const pipelineOutputV31 = this.buildOutputV31(userInput, {
      writerOutput,
      directorOutput,
      schedulerOutput,
      writerPrompt,
      directorPrompt,
      summary: {
        totalShots: directorOutput.shots.length,
        totalDuration: directorOutput.totalDuration,
        stockMatched: schedulerOutput.stats.stockMatched,
        enhanced: schedulerOutput.stats.enhanced,
        aiGenerated: schedulerOutput.stats.aiGenerated,
        costSaved: schedulerOutput.stats.costSaved,
      },
      modelRoutings,
    });

    // 批量质量评估
    const qualityResult = this.qualityAssessor.assessBatch(
      directorOutput.shots.map(shot => ({
        shot,
        script: writerOutput.outline,
      }))
    );

    // ========== Stage 7: 导演方案输出 (v3.1) ==========
    let markdownOutput: string | undefined;
    if (options?.outputFormat && options.outputFormat !== 'none') {
      const generator = new DirectorOutputGenerator(pipelineOutputV31);
      markdownOutput = generator.generate(options.outputFormat);
    }

    const summary = {
      totalShots: directorOutput.shots.length,
      totalDuration: directorOutput.totalDuration,
      stockMatched: schedulerOutput.stats.stockMatched,
      enhanced: schedulerOutput.stats.enhanced,
      aiGenerated: schedulerOutput.stats.aiGenerated,
      costSaved: schedulerOutput.stats.costSaved,
    };

    return {
      writerOutput,
      directorOutput,
      schedulerOutput,
      writerPrompt,
      directorPrompt,
      summary,
      modelRoutings,
      qualityResult,
      markdownOutput,
    };
  }

  /**
   * 构建 PipelineOutput 完整输出 (v3.0 兼容)
   */
  buildOutput(
    userInput: string,
    pipelineResult: PipelineResultV31
  ): PipelineOutput {
    return {
      metadata: {
        pipeline: 'AutoDirectorPipeline',
        version: '3.0.0',
        generatedAt: new Date().toISOString(),
        userInput,
        config: this.config,
      },
      story: pipelineResult.writerOutput,
      direction: pipelineResult.directorOutput,
      scheduling: pipelineResult.schedulerOutput,
      summary: pipelineResult.summary,
    };
  }

  /**
   * 构建 PipelineOutputV31 扩展输出
   */
  buildOutputV31(
    userInput: string,
    partial: Omit<PipelineResultV31, 'qualityResult' | 'markdownOutput'>
  ): PipelineOutputV31 {
    return {
      metadata: {
        pipeline: 'AutoDirectorPipeline',
        version: '3.1.0',
        generatedAt: new Date().toISOString(),
        userInput,
        config: this.config,
      },
      story: partial.writerOutput,
      direction: partial.directorOutput,
      scheduling: partial.schedulerOutput,
      summary: partial.summary,
      modelRoutings: partial.modelRoutings,
    };
  }

  /**
   * 内容类型识别（快捷方法）
   */
  classifyContentType(userInput: string): ContentTypeCode {
    return this.writer.classifyContentType(userInput);
  }

  /**
   * 风格推荐
   */
  recommendStyles(userInput: string): Array<{
    contentType: ContentTypeCode;
    typeName: string;
    recommendedStyles: string[];
  }> {
    const contentType = this.writer.classifyContentType(userInput);
    const template = this.writer.getTemplate(contentType);

    const styleMap: Record<ContentTypeCode, string[]> = {
      short_drama: ['电影感', '韩剧风', '古风唯美', '现代都市', '暗黑悬疑'],
      education: ['科普动画', '信息图表', '白板讲解', '纪录片式', '3D可视化'],
      documentary: ['纪实电影', '航拍大片', '人文纪实', '自然风光', '品牌史诗'],
      marketing: ['产品展示', '生活方式', '快节奏剪辑', '测评风格', '创意广告'],
      news: ['新闻播报', '现场报道', '数据可视化', '深度解读', '短视频资讯'],
      general: ['电影感', '清新自然', '赛博朋克', '文艺风', '商业质感'],
      cyberpunk: ['霓虹都市', '赛博空间', '废土末世', '黑客矩阵', '义体改造'],
      period_drama: ['古风宫廷', '江湖武侠', '民国年代', '盛世大唐', '宋韵雅集'],
      fantasy: ['东方仙侠', '西方魔幻', '异世界冒险', '神话传说', '灵兽奇缘'],
      folk_culture: ['非遗技艺', '民俗节庆', '传统手作', '戏曲国粹', '匠心传承'],
    };

    return [{
      contentType,
      typeName: template.name,
      recommendedStyles: styleMap[contentType] || styleMap.general,
    }];
  }

  /**
   * DAG工作流预演 (v3.1)
   * 返回 DAG 拓扑排序和执行计划，不实际执行
   */
  previewDAG(userInput: string, options?: {
    contentType?: ContentTypeCode;
    duration?: number;
  }) {
    const dagExecutor = new DAGExecutor();
    const contentType = options?.contentType || this.writer.classifyContentType(userInput);
    const duration = options?.duration || this.config.duration;

    const nodes = dagExecutor.buildDefaultDAG({
      storyboard: { contentType, duration, userInput },
    });

    // 添加节点到 executor
    for (const node of nodes) {
      dagExecutor.addNode(node);
    }

    // 预演执行
    const dryRunResult = dagExecutor.executeDryRun();
    const visualization = dagExecutor.getVisualization();
    const parallelPlan = dagExecutor.getParallelPlan();

    return {
      dryRunResult,
      visualization,
      parallelPlan,
      topologicalOrder: dagExecutor.topologicalSort(),
    };
  }

  /** 推断分镜复杂度 */
  private inferComplexity(shot: DirectorOutput['shots'][0]): 'simple' | 'medium' | 'complex' {
    const complexMovements = ['crane_up', 'crane_down', 'tracking', 'handheld'];
    const complexShots = ['EWS', 'EST'];
    if (complexMovements.includes(shot.cameraMovement) || complexShots.includes(shot.shotType)) {
      return 'complex';
    }
    if (shot.characterRefs.length > 2) return 'complex';
    if (shot.duration > 10) return 'medium';
    return 'simple';
  }
}

// 导出单例工厂
export function createPipeline(config?: Partial<PipelineConfig>): AutoDirectorPipeline {
  return new AutoDirectorPipeline(config);
}
