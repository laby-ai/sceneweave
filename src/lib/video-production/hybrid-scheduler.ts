/**
 * 增强版混合素材调度引擎 - 降本增效核心
 * 意图与质量判别 → 智能降级与兜底 → 素材增强
 * 
 * 决策流程:
 * 1. 意图理解 - 分析分镜对素材的真正需求
 * 2. 质量评估 - 检查素材是否满足要求
 * 3. 智能路由:
 *    - 高匹配 + 高质量 → 直接使用（成本0.01）
 *    - 中等匹配 + 可修复 → AI增强（成本0.15）
 *    - 低匹配/不可修复 → AI生成兜底（成本1.0）
 */

import { COST_WEIGHTS, ENHANCE_OPERATIONS } from './constants';
import type { DirectorShot, AssetDecision, ScheduleStats, SchedulerOutput } from './types';

// 主体关键词库
const SUBJECT_KEYWORDS = [
  '人物', '男人', '女人', '孩子', '老人', '少年', '少女', '青年',
  '城市', '自然', '海边', '森林', '山', '建筑', '道路', '街道',
  '动物', '狗', '猫', '鸟', '汽车', '产品', '食物', '天空', '水面',
];

// 动作关键词
const ACTION_KEYWORDS = ['跑', '走', '飞', '跳', '动', '流', '飘', '变化', '旋转', '上升', '下降'];

// 风格关键词
const STYLE_KEYWORDS: Record<string, string[]> = {
  '写实': ['写实', '真实', '纪实', 'photorealistic'],
  '电影': ['电影', 'cinematic', '大片', 'film'],
  '动漫': ['动漫', '二次元', 'anime', '卡通', 'cartoon'],
  '科技': ['科技', '赛博朋克', '科幻', 'futuristic', 'cyberpunk'],
  '自然': ['自然', '风景', '唯美', 'pastoral'],
};

export class HybridScheduler {
  private thresholdMatch: number;
  private thresholdEnhance: number;
  private stats: ScheduleStats;

  constructor(config?: { thresholdMatch?: number; thresholdEnhance?: number }) {
    this.thresholdMatch = config?.thresholdMatch ?? 0.80;
    this.thresholdEnhance = config?.thresholdEnhance ?? 0.60;

    this.stats = {
      stockMatched: 0,
      enhanced: 0,
      aiGenerated: 0,
      totalCost: 0,
      costSaved: 0,
    };
  }

  /**
   * 对整个分镜板进行调度决策
   */
  scheduleStoryboard(
    storyboard: { shots: DirectorShot[]; metadata?: Record<string, unknown> }
  ): SchedulerOutput {
    this.resetStats();

    const decisions: AssetDecision[] = storyboard.shots.map(shot => {
      return this.makeDecision(shot);
    });

    return {
      decisions,
      stats: { ...this.stats },
    };
  }

  /**
   * 对单个镜头做调度决策
   */
  makeDecision(shot: DirectorShot): AssetDecision {
    // 1. 意图理解
    const intent = this.understandIntent(shot);

    // 2. 计算匹配分数（简化版：基于关键词匹配模拟）
    const matchScore = this.calculateMatchScore(shot, intent);

    // 3. 智能路由决策
    let mode: 'stock_match' | 'enhanced' | 'ai_generated';
    let reason: string;
    let enhanceOperations: string[] = [];
    let qualityIssues: string[] = [];
    let estimatedCost: number;

    if (matchScore >= this.thresholdMatch) {
      mode = 'stock_match';
      reason = `匹配度${(matchScore * 100).toFixed(0)}%≥阈值${(this.thresholdMatch * 100).toFixed(0)}%，直接使用素材`;
      estimatedCost = COST_WEIGHTS.stock_match;
      this.stats.stockMatched++;
    } else if (matchScore >= this.thresholdEnhance) {
      mode = 'enhanced';
      reason = `匹配度${(matchScore * 100).toFixed(0)}%≥增强阈值${(this.thresholdEnhance * 100).toFixed(0)}%，AI增强`;
      enhanceOperations = this.recommendEnhanceOperations(matchScore, qualityIssues);
      estimatedCost = COST_WEIGHTS.enhanced;
      this.stats.enhanced++;
    } else {
      mode = 'ai_generated';
      reason = `匹配度${(matchScore * 100).toFixed(0)}%<增强阈值${(this.thresholdEnhance * 100).toFixed(0)}%，AI生成兜底`;
      estimatedCost = COST_WEIGHTS.ai_generate;
      this.stats.aiGenerated++;
    }

    this.stats.totalCost += estimatedCost;
    // 相比全量AI生成的节省
    this.stats.costSaved += COST_WEIGHTS.ai_generate - estimatedCost;

    return {
      shotId: shot.shotId,
      mode,
      reason,
      matchScore,
      asset: null,
      enhanceOperations,
      estimatedCost,
      qualityIssues,
    };
  }

  /**
   * 获取调度统计
   */
  getStats(): ScheduleStats {
    return { ...this.stats };
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /** 意图理解 */
  private understandIntent(shot: DirectorShot): {
    subject: string;
    actionRequired: boolean;
    style: string;
    qualityPriority: string;
    replacability: string;
  } {
    const prompt = shot.visualPrompt || shot.subject || '';

    return {
      subject: this.extractSubject(prompt),
      actionRequired: this.detectAction(prompt),
      style: this.extractStyle(prompt),
      qualityPriority: this.assessQualityPriority(shot),
      replacability: this.assessReplacability(shot),
    };
  }

  /** 提取主体 */
  private extractSubject(prompt: string): string {
    for (const subject of SUBJECT_KEYWORDS) {
      if (prompt.includes(subject)) return subject;
    }
    return '通用场景';
  }

  /** 检测动态需求 */
  private detectAction(prompt: string): boolean {
    return ACTION_KEYWORDS.some(word => prompt.includes(word));
  }

  /** 提取风格 */
  private extractStyle(prompt: string): string {
    for (const [style, keywords] of Object.entries(STYLE_KEYWORDS)) {
      if (keywords.some(kw => prompt.toLowerCase().includes(kw.toLowerCase()))) {
        return style;
      }
    }
    return '通用';
  }

  /** 评估质量优先级 */
  private assessQualityPriority(shot: DirectorShot): string {
    // 大特写/特写对画质要求最高
    if (['ECU', 'CU'].includes(shot.shotType)) return 'high';
    // 远景可接受较低画质
    if (['EWS', 'WS', 'EST'].includes(shot.shotType)) return 'medium';
    return 'medium';
  }

  /** 评估可替代性 */
  private assessReplacability(shot: DirectorShot): string {
    // 角色相关镜头替代性低
    if (shot.characterRefs.length > 0) return 'low';
    // 建立镜头/环境镜头替代性高
    if (['EST', 'EWS', 'WS'].includes(shot.shotType)) return 'high';
    return 'medium';
  }

  /** 计算匹配分数（模拟） */
  private calculateMatchScore(
    shot: DirectorShot,
    intent: { subject: string; style: string; replacability: string }
  ): number {
    // 这是一个简化版的匹配计算
    // 实际生产中应接入向量检索或素材库匹配
    let score = 0.5; // 基础分

    // 环境类镜头更容易匹配素材库
    if (['EST', 'EWS', 'WS'].includes(shot.shotType)) score += 0.2;
    // 角色特写较难匹配
    if (['ECU', 'CU'].includes(shot.shotType) && shot.characterRefs.length > 0) score -= 0.2;
    // 通用主体匹配度更高
    if (intent.subject === '通用场景') score += 0.1;
    // 可替代性高 → 匹配更容易
    if (intent.replacability === 'high') score += 0.15;

    // 加入少量随机性模拟真实场景
    score += (Math.sin(shot.sequence * 0.7) * 0.1);

    return Math.max(0, Math.min(1, score));
  }

  /** 推荐增强操作 */
  private recommendEnhanceOperations(matchScore: number, qualityIssues: string[]): string[] {
    const operations: string[] = [];

    for (const [op, config] of Object.entries(ENHANCE_OPERATIONS)) {
      if (matchScore >= config.minScore && matchScore < config.target) {
        operations.push(op);
      }
    }

    // 至少推荐一个操作
    if (operations.length === 0 && matchScore < 0.80) {
      operations.push('super_resolution');
    }

    // 记录质量问题
    if (matchScore < 0.70) qualityIssues.push('分辨率可能不足');
    if (matchScore < 0.65) qualityIssues.push('可能存在噪点');
    if (matchScore < 0.60) qualityIssues.push('帧率可能偏低');

    return operations;
  }

  private resetStats(): void {
    this.stats = {
      stockMatched: 0,
      enhanced: 0,
      aiGenerated: 0,
      totalCost: 0,
      costSaved: 0,
    };
  }
}
