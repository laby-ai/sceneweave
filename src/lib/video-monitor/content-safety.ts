/**
 * 内容安全服务 - 三层防护 + 版权合规
 * Layer 1: Prompt预过滤 → Layer 2: GAN检测 → Layer 3: 帧监控
 */

import type {
  SafetyLayer,
  SafetyResult,
  ContentSafetyCheck,
  CopyrightCheckResult,
  CopyrightIssue,
  MonitorTask,
} from './types';
import { SAFETY_SCORE_THRESHOLD, BLOCKED_CONTENT_CATEGORIES } from './constants';

/** 敏感关键词黑名单（示意） */
const BLOCKED_KEYWORDS: string[] = [
  '暴力', '血腥', '恐怖', '色情', '仇恨',
  '自残', '违法', '枪支', '毒品',
];

/** 公众人物参考关键词（示意） */
const CELEBRITY_PATTERNS: RegExp[] = [
  /名人.*face|celebrity.*portrait/i,
];

export class ContentSafety {
  /**
   * 第一层：生成前Prompt过滤
   */
  static async preGenerateCheck(prompt: string): Promise<SafetyResult> {
    // 1. 关键词黑名单精确匹配
    const blockedKeyword = BLOCKED_KEYWORDS.find((kw) => prompt.includes(kw));
    if (blockedKeyword) {
      return {
        allowed: false,
        layer: 'prompt_filter',
        reason: 'prompt_contains_blocked_content',
        details: [`检测到敏感内容: ${blockedKeyword}`],
      };
    }

    // 2. 语义安全评分（模拟 CLIP 语义检测）
    const safetyScore = this.computeSafetyScore(prompt);
    if (safetyScore < SAFETY_SCORE_THRESHOLD) {
      return {
        allowed: false,
        layer: 'prompt_filter',
        reason: 'prompt_safety_score_low',
        score: safetyScore,
        details: [`安全评分 ${safetyScore.toFixed(2)} 低于阈值 ${SAFETY_SCORE_THRESHOLD}`],
      };
    }

    // 3. 人脸/名人检测
    const celebrityRef = CELEBRITY_PATTERNS.find((p) => p.test(prompt));
    if (celebrityRef) {
      return {
        allowed: false,
        layer: 'prompt_filter',
        reason: 'celebrity_reference_detected',
        details: ['检测到公众人物参考，请移除相关描述'],
      };
    }

    return { allowed: true, score: safetyScore };
  }

  /**
   * 第二层：GAN/深度伪造检测（生成中）
   */
  static async ganDetectionCheck(imageUrl: string): Promise<SafetyResult> {
    // 模拟 GAN 检测
    const isManipulated = this.simulateGANDetection(imageUrl);
    if (isManipulated) {
      return {
        allowed: false,
        layer: 'gan_detection',
        reason: 'deepfake_detected',
        score: 0.3,
        details: ['检测到深度伪造痕迹，内容已拦截'],
      };
    }
    return { allowed: true, score: 0.95 };
  }

  /**
   * 第三层：帧级实时监控（视频组装时）
   */
  static async frameMonitorCheck(taskId: string): Promise<SafetyResult> {
    // 模拟帧级检测
    const frameViolation = this.simulateFrameCheck(taskId);
    if (frameViolation) {
      return {
        allowed: false,
        layer: 'frame_monitor',
        reason: 'frame_violation_detected',
        details: ['检测到违规帧，视频已暂停生成'],
      };
    }
    return { allowed: true };
  }

  /**
   * 完整三层安全检查
   */
  static async fullCheck(
    prompt: string,
    imageUrl?: string,
    taskId?: string,
  ): Promise<ContentSafetyCheck[]> {
    const checks: ContentSafetyCheck[] = [];

    // Layer 1
    const promptResult = await this.preGenerateCheck(prompt);
    checks.push({
      taskId: taskId || 'unknown',
      layer: 'prompt_filter',
      result: promptResult,
      checkedAt: Date.now(),
    });

    if (!promptResult.allowed) return checks;

    // Layer 2
    if (imageUrl) {
      const ganResult = await this.ganDetectionCheck(imageUrl);
      checks.push({
        taskId: taskId || 'unknown',
        layer: 'gan_detection',
        result: ganResult,
        checkedAt: Date.now(),
      });

      if (!ganResult.allowed) return checks;
    }

    // Layer 3
    if (taskId) {
      const frameResult = await this.frameMonitorCheck(taskId);
      checks.push({
        taskId,
        layer: 'frame_monitor',
        result: frameResult,
        checkedAt: Date.now(),
      });
    }

    return checks;
  }

  /**
   * 版权合规检查
   */
  static copyrightCheck(
    task: MonitorTask,
    level: 'basic' | 'standard' | 'strict' = 'standard',
  ): CopyrightCheckResult {
    const issues: CopyrightIssue[] = [];

    // 基础：水印检查
    const watermarkApplied = level !== 'basic';
    if (!watermarkApplied) {
      issues.push({
        type: 'visual',
        severity: 'warning',
        description: '未添加数字水印',
        suggestion: '建议启用数字水印保护',
      });
    }

    // 标准：音乐版权
    if (level === 'standard' || level === 'strict') {
      // 模拟音乐版权检查
      const hasMusicInfringement = false; // 实际需对接音乐指纹库
      if (hasMusicInfringement) {
        issues.push({
          type: 'music',
          severity: 'critical',
          description: '检测到未授权音乐',
          suggestion: '请更换背景音乐或获取授权',
        });
      }
    }

    // 严格：区块链存证
    const blockchainHash = level === 'strict'
      ? this.generateBlockchainHash(task.taskId)
      : undefined;

    return {
      passed: issues.filter((i) => i.severity === 'critical').length === 0,
      watermarkApplied,
      blockchainHash,
      issues,
    };
  }

  // ---------- 私有方法 ----------

  /** 计算Prompt安全评分 */
  private static computeSafetyScore(prompt: string): number {
    let score = 1.0;
    const lowerPrompt = prompt.toLowerCase();

    for (const keyword of BLOCKED_KEYWORDS) {
      if (lowerPrompt.includes(keyword)) {
        score -= 0.3;
      }
    }

    for (const category of BLOCKED_CONTENT_CATEGORIES) {
      if (lowerPrompt.includes(category)) {
        score -= 0.2;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /** 模拟GAN检测 */
  private static simulateGANDetection(_imageUrl: string): boolean {
    return false;
  }

  /** 模拟帧级检查 */
  private static simulateFrameCheck(_taskId: string): boolean {
    return false;
  }

  /** 生成区块链哈希 */
  private static generateBlockchainHash(taskId: string): string {
    const hash = Array.from(taskId)
      .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
    return `0x${Math.abs(hash).toString(16).padStart(8, '0')}${Date.now().toString(16)}`;
  }
}
