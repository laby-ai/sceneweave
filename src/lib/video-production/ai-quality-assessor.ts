/**
 * AI 视频质量评估模块 (v3.1)
 * 三维度评估: 语义一致性 / 视听同步 / 美学物理质量
 * 质检关卡: 交付 / 审核 / 自动重绘
 */

import type {
  VideoScore, QualityThresholds, QualityGateResult, QualityVerdict,
  DirectorShot,
} from './types';
import { DEFAULT_QUALITY_THRESHOLDS } from './constants';

/** 评估请求参数 */
export interface AssessRequest {
  shot: DirectorShot;
  videoPath?: string;
  script?: string;
}

/**
 * AI 视频质量评估器
 * 基于多模态大模型的 AI 裁判机制
 */
export class AIQualityAssessor {
  private thresholds: QualityThresholds;

  constructor(thresholds?: Partial<QualityThresholds>) {
    this.thresholds = { ...DEFAULT_QUALITY_THRESHOLDS, ...thresholds };
  }

  /**
   * 评估单个分镜的视频质量
   * 在 dryRun 模式下基于分镜数据模拟评分
   */
  assessShot(request: AssessRequest): QualityGateResult {
    const { shot, script } = request;

    // 模拟评分逻辑 (dryRun 模式)
    // 实际生产中会调用 GPT-4o / Qwen-VL 多模态模型
    const score = this.simulateScore(shot, script);
    const verdict = this.determineVerdict(score);

    return {
      verdict,
      score,
      shouldAutoRegenerate: verdict === 'regenerate',
      regenerationPrompt: verdict === 'regenerate'
        ? this.buildRegenerationPrompt(shot, score)
        : undefined,
    };
  }

  /**
   * 批量评估
   */
  assessBatch(requests: AssessRequest[]): QualityGateResult[] {
    return requests.map((r) => this.assessShot(r));
  }

  /**
   * 基于分镜特征模拟评分
   */
  private simulateScore(shot: DirectorShot, _script?: string): VideoScore {
    // 基于分镜完整性模拟评分
    const hasVisualPrompt = shot.visualPrompt.length > 20;
    const hasSubject = shot.subject.length > 0;
    const hasEnvironment = shot.environment.length > 0;
    const hasLighting = shot.lighting.length > 0;

    let semanticScore = 5;
    let audioVisualSyncScore = 6;
    let aestheticPhysicsScore = 6;

    if (hasVisualPrompt) semanticScore += 2;
    if (hasSubject) semanticScore += 1;
    if (hasEnvironment) semanticScore += 1;
    if (hasLighting) aestheticPhysicsScore += 1;

    // 音频一致性基于音频字段完整性
    if (shot.audioType && shot.audioContent) {
      audioVisualSyncScore += 2;
    }

    // 确保分数在 0-10 范围内
    semanticScore = Math.min(10, Math.max(0, semanticScore));
    audioVisualSyncScore = Math.min(10, Math.max(0, audioVisualSyncScore));
    aestheticPhysicsScore = Math.min(10, Math.max(0, aestheticPhysicsScore));

    const overallScore = Number((
      semanticScore * 0.4 + audioVisualSyncScore * 0.3 + aestheticPhysicsScore * 0.3
    ).toFixed(1));

    const issues: string[] = [];
    if (semanticScore < 7) issues.push('画面描述不够详细');
    if (audioVisualSyncScore < 7) issues.push('音频指令缺失或不完整');
    if (aestheticPhysicsScore < 7) issues.push('光影描述不足');

    return {
      semanticScore,
      audioVisualSyncScore,
      aestheticPhysicsScore,
      overallScore,
      feedback: issues.length > 0 ? `分镜 #${shot.shotId} 存在改进空间: ${issues.join('; ')}` : '分镜质量良好',
      issues,
      needsRegeneration: overallScore < this.thresholds.autoRegenerateThreshold,
      regenerationHint: issues.length > 0 ? `建议增强: ${issues.join(', ')}` : '',
      modelUsed: 'dry_run',
      evaluateTime: new Date().toISOString(),
    };
  }

  /**
   * 判定质检关卡
   */
  private determineVerdict(score: VideoScore): QualityVerdict {
    const { overallScore } = score;

    // 自动重绘条件
    if (overallScore < this.thresholds.autoRegenerateThreshold) return 'regenerate';
    if (score.semanticScore < 5) return 'regenerate';
    if (score.audioVisualSyncScore < 5) return 'regenerate';

    // 人工审核条件
    if (overallScore >= this.thresholds.suggestOptimizeMin &&
        overallScore <= this.thresholds.suggestOptimizeMax) {
      return 'review';
    }

    // 直接交付
    return 'deliver';
  }

  /**
   * 构建重绘提示词
   */
  private buildRegenerationPrompt(shot: DirectorShot, score: VideoScore): string {
    const improvements: string[] = [];

    if (score.semanticScore < 7) {
      improvements.push(`增强主体描述: ${shot.subject || '需要明确主体'}`);
    }
    if (score.audioVisualSyncScore < 7) {
      improvements.push('补充音频指令与画面同步信息');
    }
    if (score.aestheticPhysicsScore < 7) {
      improvements.push(`优化光影: ${shot.lighting || '需要明确光源'}`);
    }

    return `${shot.visualPrompt}, ${improvements.join(', ')}`;
  }

  /**
   * 生成 LLM 评估 Prompt (用于实际调用多模态模型)
   */
  buildLLMEvaluationPrompt(shot: DirectorShot, script?: string): string {
    return `你是一位专业的视频质量评估专家。请从三个维度评估以下视频分镜的质量：

1. **语义一致性** (0-10分): 画面描述是否忠实于导演意图
   - 主体是否明确
   - 场景/环境是否匹配
   - 动作/事件是否清晰
   - 颜色/风格/光线是否一致

2. **视听一致性** (0-10分): 音画是否同步协调
   - 音频类型与画面是否匹配
   - 音乐情绪与画面氛围是否契合

3. **美学与物理质量** (0-10分): 是否存在AI伪影
   - 是否有扭曲/变形
   - 光影是否自然
   - 构图是否合理

---

**导演指令**:
- 景别: ${shot.shotType}
- 运镜: ${shot.cameraMovement}
- 画面描述: ${shot.visualPrompt}
- 主体: ${shot.subject}
- 环境: ${shot.environment}
- 光影: ${shot.lighting}
- 风格: ${shot.style}
- 音频: ${shot.audioType} - ${shot.audioContent}

${script ? `**剧本上下文**: ${script}` : ''}

---

请以JSON格式返回:
\`\`\`json
{
  "semantic_score": 0-10,
  "audio_visual_sync_score": 0-10,
  "aesthetic_physics_score": 0-10,
  "overall_score": 0-10,
  "feedback": "中文评价",
  "issues": ["问题1", "问题2"],
  "needs_regeneration": true/false,
  "regeneration_hint": "修正建议"
}
\`\`\``;
  }
}

/** 创建默认评估器 */
export function createQualityAssessor(thresholds?: Partial<QualityThresholds>): AIQualityAssessor {
  return new AIQualityAssessor(thresholds);
}
