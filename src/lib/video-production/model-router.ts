/**
 * 视频生成模型路由器 (v3.2)
 * 三级模型选择能力:
 *   1. 智能推荐 — 根据场景特征自动评分 + Top-3推荐
 *   2. 自动降级 — 模型不可用时沿降级链自动切换
 *   3. 自主选择 — 用户手动指定模型，系统校验+风险提示
 */

import type {
  VideoModelCode, VideoModelDefinition,
  SceneFeatures, ModelRoutingResult, RoutingWeights,
  ModelAvailability, FallbackStrategy, FallbackStep,
  RecommendedModelDetail,
} from './types';
import {
  VIDEO_MODELS, DEFAULT_ROUTING_WEIGHTS,
  DEFAULT_FALLBACK_CHAIN, SCENARIO_FALLBACK_MAP,
  DEFAULT_MODEL_AVAILABILITY, FALLBACK_STRATEGY_CONFIG,
  MODEL_PROFILE_TAGS, MODEL_RELATIVE_METRICS,
} from './constants';

/**
 * 模型路由器配置
 */
export interface RouterConfig {
  weights?: Partial<RoutingWeights>;
  availability?: Partial<Record<VideoModelCode, ModelAvailability>>;
  fallbackStrategy?: FallbackStrategy;
  /** 外部可用状态回调 (生产环境可对接配置中心) */
  availabilityProvider?: () => Record<VideoModelCode, ModelAvailability>;
}

/**
 * 手动选择校验结果
 */
export interface ManualSelectionCheck {
  allowed: boolean;
  warnings: string[];
  model: VideoModelDefinition;
  availability: ModelAvailability;
  fallbackSuggestion?: VideoModelCode;
  costComparison?: { current: number; recommended: number };
}

/**
 * 视频模型路由器 (v3.2)
 */
export class VideoModelRouter {
  private weights: RoutingWeights;
  private models: Record<VideoModelCode, VideoModelDefinition>;
  private availability: Record<VideoModelCode, ModelAvailability>;
  private fallbackStrategy: FallbackStrategy;

  constructor(config?: RouterConfig) {
    this.weights = { ...DEFAULT_ROUTING_WEIGHTS, ...config?.weights };
    this.models = VIDEO_MODELS;
    this.availability = {
      ...DEFAULT_MODEL_AVAILABILITY,
      ...config?.availability,
    };
    this.fallbackStrategy = config?.fallbackStrategy ?? 'balanced';
  }

  // ============================================================
  // 1. 智能推荐 — 根据场景特征自动评分 + 推荐
  // ============================================================

  /**
   * 完整路由决策 (含推荐+降级)
   */
  route(features: SceneFeatures): ModelRoutingResult {
    const scores = this.scoreAllModels(features);
    const sortedEntries = Object.entries(scores).sort(([, a], [, b]) => b - a);

    // 找到最高分的可用模型
    const selectedModel = this.findBestAvailable(sortedEntries);

    // 构建推荐详情
    const recommendation = this.buildRecommendation(sortedEntries, scores);

    // 构建降级链
    const fallbackChain = this.buildFallbackChain(selectedModel, features);

    // 判断选择模式
    const originalTop = sortedEntries[0][0] as VideoModelCode;
    const selectionMode: ModelRoutingResult['selectionMode'] =
      originalTop === selectedModel ? 'auto' : 'recommended';

    const reason = this.buildReason(features, selectedModel, scores[selectedModel]);

    return {
      selectedModel,
      reason,
      scores,
      selectionMode,
      recommendation,
      fallbackChain,
      availability: { ...this.availability },
      originalModel: selectionMode !== 'auto' ? originalTop : undefined,
    };
  }

  /**
   * 选择最优模型 (简化接口)
   */
  selectModel(features: SceneFeatures): VideoModelCode {
    return this.route(features).selectedModel;
  }

  /**
   * 批量路由
   */
  routeBatch(featuresList: SceneFeatures[]): ModelRoutingResult[] {
    return featuresList.map((f) => this.route(f));
  }

  /**
   * 获取推荐列表 (不执行路由, 仅展示推荐)
   */
  getRecommendations(features: SceneFeatures): RecommendedModelDetail[] {
    const scores = this.scoreAllModels(features);
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);

    return sorted.map(([code, score], index) => {
      const tags = MODEL_PROFILE_TAGS[code as VideoModelCode];
      return {
        model: code as VideoModelCode,
        score,
        rank: index + 1,
        strengths: tags?.strengths ?? [],
        weaknesses: tags?.weaknesses ?? [],
        suitableScenarios: tags?.suitableScenarios ?? [],
      };
    });
  }

  // ============================================================
  // 2. 自动降级 — 模型不可用时沿降级链自动切换
  // ============================================================

  /**
   * 沿降级链选择下一个可用模型
   */
  fallbackFrom(model: VideoModelCode, features: SceneFeatures): ModelRoutingResult {
    const chain = this.getFallbackChainForScene(features);
    const currentIndex = chain.indexOf(model);
    const strategyConfig = FALLBACK_STRATEGY_CONFIG[this.fallbackStrategy];

    let selectedModel = model;
    let steps = 0;

    // 从当前位置开始向下查找可用模型
    for (let i = currentIndex + 1; i < chain.length && steps < strategyConfig.maxFallbackSteps; i++) {
      const candidate = chain[i];
      const avail = this.availability[candidate];

      if (avail === 'available') {
        selectedModel = candidate;
        steps++;
        break;
      } else if (avail === 'degraded' && strategyConfig.maxFallbackSteps > 1) {
        // degraded 状态可用但质量下降
        selectedModel = candidate;
        steps++;
        break;
      }
    }

    // 如果降级链中无可用模型, 使用全量降级链兜底
    if (selectedModel === model && this.availability[model] !== 'available') {
      for (const candidate of DEFAULT_FALLBACK_CHAIN) {
        if (this.availability[candidate] === 'available') {
          selectedModel = candidate;
          break;
        }
      }
    }

    const scores = this.scoreAllModels(features);
    const fallbackChain = this.buildFallbackChain(selectedModel, features);

    return {
      selectedModel,
      reason: this.buildFallbackReason(model, selectedModel),
      scores,
      selectionMode: 'recommended',
      fallbackChain,
      availability: { ...this.availability },
      originalModel: model,
    };
  }

  /**
   * 更新模型可用状态
   */
  updateAvailability(model: VideoModelCode, status: ModelAvailability): void {
    this.availability[model] = status;
  }

  /**
   * 批量更新可用状态
   */
  updateAvailabilityBatch(statuses: Partial<Record<VideoModelCode, ModelAvailability>>): void {
    Object.assign(this.availability, statuses);
  }

  /**
   * 刷新可用状态 (调用外部 Provider)
   */
  refreshAvailability(provider?: () => Record<VideoModelCode, ModelAvailability>): void {
    if (provider) {
      this.availability = provider();
    }
  }

  // ============================================================
  // 3. 自主选择 — 用户手动指定模型
  // ============================================================

  /**
   * 校验用户手动选择的模型
   * 返回校验结果，包含风险提示和替代建议
   */
  validateManualSelection(
    model: VideoModelCode,
    features: SceneFeatures,
  ): ManualSelectionCheck {
    const modelDef = this.models[model];
    const avail = this.availability[model];
    const warnings: string[] = [];

    // 可用性检查
    if (avail === 'unavailable') {
      warnings.push(`${modelDef.name} 当前不可用，将自动降级`);
    } else if (avail === 'degraded') {
      warnings.push(`${modelDef.name} 当前处于降级状态，生成质量可能下降`);
    } else if (avail === 'unknown') {
      warnings.push(`${modelDef.name} 状态未知，可能存在风险`);
    }

    // 场景匹配检查
    const scores = this.scoreAllModels(features);
    const modelScore = scores[model];
    const topScore = Math.max(...Object.values(scores));

    if (modelScore < topScore * 0.5) {
      warnings.push(
        `该模型在当前场景评分较低 (${(modelScore * 100).toFixed(0)}分), ` +
        `推荐模型评分 ${(topScore * 100).toFixed(0)}分`,
      );
    }

    // 时长超限检查
    if (features.duration > modelDef.capabilities.maxDuration) {
      warnings.push(
        `所需时长 ${features.duration}s 超出该模型最大支持 ${modelDef.capabilities.maxDuration}s`,
      );
    }

    // 音频能力检查
    if (features.hasAudioSync && modelDef.capabilities.audioSync < 3) {
      warnings.push('该模型音画同步能力较弱，可能影响配音效果');
    }

    // 一致性检查
    if (features.needsCharacterConsistency && modelDef.capabilities.characterConsistency < 3) {
      warnings.push('该模型角色一致性较弱，可能出现角色外观跳变');
    }

    // 成本提示
    const autoRecommend = this.route(features);
    const currentCost = MODEL_RELATIVE_METRICS[model].costPercent;
    const recommendedCost = MODEL_RELATIVE_METRICS[model].costPercent;

    // 生成替代建议
    let fallbackSuggestion: VideoModelCode | undefined;
    if (avail !== 'available' || modelScore < topScore * 0.7) {
      fallbackSuggestion = autoRecommend.selectedModel;
    }

    return {
      allowed: avail !== 'unavailable',
      warnings,
      model: modelDef,
      availability: avail,
      fallbackSuggestion,
      costComparison: currentCost !== recommendedCost
        ? { current: currentCost, recommended: recommendedCost }
        : undefined,
    };
  }

  /**
   * 执行手动选择 — 校验后路由
   * 如果所选模型不可用，自动降级
   */
  routeWithManualOverride(
    features: SceneFeatures,
    manualModel: VideoModelCode,
  ): ModelRoutingResult {
    const check = this.validateManualSelection(manualModel, features);

    if (check.availability === 'unavailable') {
      // 模型不可用，走降级链
      return this.fallbackFrom(manualModel, features);
    }

    const scores = this.scoreAllModels(features);
    const reason = check.warnings.length > 0
      ? `用户选择 ${check.model.name}，注意: ${check.warnings.join('; ')}`
      : `用户选择 ${check.model.name}`;

    return {
      selectedModel: manualModel,
      reason,
      scores,
      selectionMode: 'manual',
      recommendation: this.buildRecommendation(
        Object.entries(scores).sort(([, a], [, b]) => b - a),
        scores,
      ),
      fallbackChain: this.buildFallbackChain(manualModel, features),
      availability: { ...this.availability },
    };
  }

  // ============================================================
  // 内部方法
  // ============================================================

  /** 在排序列表中找到最高分的可用模型 */
  private findBestAvailable(
    sortedEntries: [string, number][],
  ): VideoModelCode {
    for (const [code] of sortedEntries) {
      const avail = this.availability[code as VideoModelCode];
      if (avail === 'available') {
        return code as VideoModelCode;
      }
    }
    // 降级状态也可用
    for (const [code] of sortedEntries) {
      const avail = this.availability[code as VideoModelCode];
      if (avail === 'degraded') {
        return code as VideoModelCode;
      }
    }
    // 兜底: 返回最高分模型
    return sortedEntries[0][0] as VideoModelCode;
  }

  /** 构建推荐详情 Top-3 */
  private buildRecommendation(
    sortedEntries: [string, number][],
    scores: Record<VideoModelCode, number>,
  ): ModelRoutingResult['recommendation'] {
    const topPicks: RecommendedModelDetail[] = sortedEntries.slice(0, 3).map(([code, score], index) => {
      const tags = MODEL_PROFILE_TAGS[code as VideoModelCode];
      return {
        model: code as VideoModelCode,
        score,
        rank: index + 1,
        strengths: tags?.strengths ?? [],
        weaknesses: tags?.weaknesses ?? [],
        suitableScenarios: tags?.suitableScenarios ?? [],
      };
    });

    // 按维度找最优
    let bestForQuality: VideoModelCode = sortedEntries[0][0] as VideoModelCode;
    let bestForCost: VideoModelCode = sortedEntries[0][0] as VideoModelCode;
    let bestForSpeed: VideoModelCode = sortedEntries[0][0] as VideoModelCode;

    for (const code of Object.keys(this.models) as VideoModelCode[]) {
      const metrics = MODEL_RELATIVE_METRICS[code];
      if (metrics.qualityPercent > MODEL_RELATIVE_METRICS[bestForQuality].qualityPercent) {
        bestForQuality = code;
      }
      if (metrics.costPercent < MODEL_RELATIVE_METRICS[bestForCost].costPercent) {
        bestForCost = code;
      }
      if (metrics.speedPercent > MODEL_RELATIVE_METRICS[bestForSpeed].speedPercent) {
        bestForSpeed = code;
      }
    }

    return { topPicks, bestForQuality, bestForCost, bestForSpeed };
  }

  /** 构建降级链 */
  private buildFallbackChain(
    fromModel: VideoModelCode,
    features: SceneFeatures,
  ): FallbackStep[] {
    const chain = this.getFallbackChainForScene(features);
    const fromIndex = chain.indexOf(fromModel);
    const strategyConfig = FALLBACK_STRATEGY_CONFIG[this.fallbackStrategy];

    const steps: FallbackStep[] = [];
    const startIdx = fromIndex >= 0 ? fromIndex + 1 : 0;
    const endIdx = Math.min(startIdx + strategyConfig.maxFallbackSteps, chain.length);

    for (let i = startIdx; i < endIdx; i++) {
      const candidate = chain[i];
      const fromMetrics = MODEL_RELATIVE_METRICS[fromModel];
      const toMetrics = MODEL_RELATIVE_METRICS[candidate];

      steps.push({
        model: candidate,
        reason: this.availability[candidate] === 'available'
          ? '可用'
          : this.availability[candidate] === 'degraded'
            ? '降级状态可用'
            : '不可用',
        estimatedQualityDrop: Math.max(0, fromMetrics.qualityPercent - toMetrics.qualityPercent),
        estimatedCostChange: toMetrics.costPercent - fromMetrics.costPercent,
      });
    }

    return steps;
  }

  /** 获取场景对应的降级链 */
  private getFallbackChainForScene(features: SceneFeatures): VideoModelCode[] {
    // 根据场景特征选择最匹配的降级链
    if (features.hasAudioSync && SCENARIO_FALLBACK_MAP.audio_sync) {
      return SCENARIO_FALLBACK_MAP.audio_sync;
    }
    if (features.needsCharacterConsistency && SCENARIO_FALLBACK_MAP.cinematic) {
      return SCENARIO_FALLBACK_MAP.cinematic;
    }

    const style = features.style.toLowerCase();
    if (style.includes('动画') || style.includes('anime') || style.includes('二次元')) {
      return SCENARIO_FALLBACK_MAP.anime;
    }
    if (style.includes('营销') || style.includes('口播') || style.includes('commercial')) {
      return SCENARIO_FALLBACK_MAP.commercial;
    }
    if (style.includes('写实') || style.includes('电影') || style.includes('cinematic')) {
      return SCENARIO_FALLBACK_MAP.cinematic;
    }
    if (features.duration > 30) {
      return SCENARIO_FALLBACK_MAP.long_form;
    }

    return DEFAULT_FALLBACK_CHAIN;
  }

  /** 对所有模型评分 (同 v3.1 逻辑) */
  private scoreAllModels(features: SceneFeatures): Record<VideoModelCode, number> {
    const scores: Record<string, number> = {};

    for (const [code, model] of Object.entries(this.models)) {
      const { capabilities } = model;

      const qualityScore = this.scoreQuality(features, capabilities);
      const audioScore = this.scoreAudio(features, capabilities);
      const durationScore = this.scoreDuration(features, capabilities);
      const consistencyScore = this.scoreConsistency(features, capabilities);
      const costScore = this.scoreCost(capabilities);

      const totalScore =
        qualityScore * this.weights.qualityMatch +
        audioScore * this.weights.audioNeed +
        durationScore * this.weights.durationMatch +
        consistencyScore * this.weights.consistencyNeed +
        costScore * this.weights.costEfficiency;

      scores[code] = Number(totalScore.toFixed(3));
    }

    return scores as Record<VideoModelCode, number>;
  }

  /** 画质匹配评分 */
  private scoreQuality(
    features: SceneFeatures,
    caps: VideoModelDefinition['capabilities'],
  ): number {
    const style = features.style.toLowerCase();
    if (style.includes('写实') || style.includes('电影') || style.includes('realism') || style.includes('cinematic')) {
      return caps.realism / 5;
    }
    if (style.includes('动画') || style.includes('anime') || style.includes('二次元')) {
      return caps.anime / 5;
    }
    return caps.quality / 5;
  }

  /** 音频需求评分 */
  private scoreAudio(
    features: SceneFeatures,
    caps: VideoModelDefinition['capabilities'],
  ): number {
    if (!features.hasAudioSync) return 0.5;
    return caps.audioSync / 5;
  }

  /** 时长匹配评分 */
  private scoreDuration(
    features: SceneFeatures,
    caps: VideoModelDefinition['capabilities'],
  ): number {
    if (features.duration <= caps.maxDuration) {
      const margin = (caps.maxDuration - features.duration) / caps.maxDuration;
      return 0.7 + margin * 0.3;
    }
    return 0.1;
  }

  /** 一致性需求评分 */
  private scoreConsistency(
    features: SceneFeatures,
    caps: VideoModelDefinition['capabilities'],
  ): number {
    if (!features.needsCharacterConsistency) return 0.5;
    return caps.characterConsistency / 5;
  }

  /** 成本效率评分 */
  private scoreCost(caps: VideoModelDefinition['capabilities']): number {
    switch (caps.cost) {
      case 'low': return 1.0;
      case 'medium': return 0.6;
      case 'high': return 0.3;
      default: return 0.5;
    }
  }

  /** 构建自动推荐理由 */
  private buildReason(features: SceneFeatures, model: VideoModelCode, _score: number): string {
    const modelDef = this.models[model];
    const reasons: string[] = [];

    if (features.hasAudioSync && modelDef.capabilities.audioSync >= 4) {
      reasons.push('音画同步需求优先');
    }
    if (features.needsCharacterConsistency && modelDef.capabilities.characterConsistency >= 4) {
      reasons.push('角色一致性需求优先');
    }
    if (features.duration > 30 && modelDef.capabilities.maxDuration >= 60) {
      reasons.push('长时长需求匹配');
    }
    if (reasons.length === 0) {
      reasons.push('综合评分最优');
    }

    return `选择 ${modelDef.name}: ${reasons.join(', ')}`;
  }

  /** 构建降级理由 */
  private buildFallbackReason(fromModel: VideoModelCode, toModel: VideoModelCode): string {
    const fromName = this.models[fromModel].name;
    const toName = this.models[toModel].name;
    const fromAvail = this.availability[fromModel];
    const fromMetrics = MODEL_RELATIVE_METRICS[fromModel];
    const toMetrics = MODEL_RELATIVE_METRICS[toModel];

    const qualityDrop = fromMetrics.qualityPercent - toMetrics.qualityPercent;
    const costSave = fromMetrics.costPercent - toMetrics.costPercent;

    const parts: string[] = [`${fromName} ${fromAvail === 'unavailable' ? '不可用' : '状态异常'}`];
    parts.push(`降级至 ${toName}`);

    if (qualityDrop > 0) {
      parts.push(`画质约降 ${qualityDrop}%`);
    }
    if (costSave > 0) {
      parts.push(`成本约降 ${costSave}%`);
    }

    return parts.join('，');
  }
}

/** 创建模型路由器 */
export function createModelRouter(config?: RouterConfig): VideoModelRouter {
  return new VideoModelRouter(config);
}
