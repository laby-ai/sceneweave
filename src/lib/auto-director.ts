/**
 * 自动化导演核心引擎 v3.0
 * 
 * v1.0: 基础领域识别 → 需求分析 → 执行计划生成
 * v3.0: 整合 video-production-platform skill
 *   - 6种叙事模板（爽文短剧/科普资讯/纪录片/营销/新闻/通用）
 *   - 8种景别 + 13种运镜 + 7种转场
 *   - 混合调度引擎（素材匹配/AI增强/AI生成）
 *   - 情感曲线 + 关键镜头识别
 * 
 * 本文件保留原有接口兼容性，内部委托给新引擎
 */

import {
  AutoDirectorPipeline,
  createPipeline,
  NARRATIVE_TEMPLATES,
  SHOT_TYPES,
  CAMERA_MOVEMENTS,
  TRANSITIONS,
  CONTENT_TYPE_TABLE,
} from './video-production';

// 保留原有类型导出（向后兼容）
export type FilmDomain = 'film' | 'anime' | 'market' | 'short' | 'mv' | 'doc' | 'drama';

export interface DomainConfig {
  structure: string;
  pace: string;
  aspect: string;
}

export interface FilmRequirements {
  duration: number;
  mood: string;
  characters: string[];
  hasScript: boolean;
  hasStoryboard: boolean;
}

export interface DomainScores {
  [key: string]: number;
}

export interface FilmAnalysis {
  domain: FilmDomain;
  requirements: FilmRequirements;
  domainScores: DomainScores;
}

export interface FilmPlan {
  stage_1: string;
  stage_2: string;
  stage_3: string;
  stage_4: string;
  stage_5: string;
}

export interface DirectorPlan {
  analysis: FilmAnalysis;
  plan: FilmPlan;
  domainConfig: DomainConfig;
  duration: number;
  originalContent: string;
}

/**
 * 智能导演引擎 v3.0
 * 
 * 保留原有 analyzeContent/generatePlan/analyzeAndPlan 接口
 * 内部使用 AutoDirectorPipeline 实现
 */
export class IntelligentDirector {
  private pipeline: AutoDirectorPipeline;

  constructor() {
    this.pipeline = createPipeline();
  }

  /** 分析用户内容，识别领域和需求 */
  analyzeContent(content: string): FilmAnalysis {
    // 使用新引擎的内容类型识别
    const contentType = this.pipeline.classifyContentType(content);

    // 映射到旧版 FilmDomain
    const domainMap: Record<string, FilmDomain> = {
      short_drama: 'short',
      education: 'film',
      documentary: 'doc',
      marketing: 'market',
      news: 'film',
      general: 'film',
    };

    const domain = domainMap[contentType] || 'film';
    const requirements = this.parseRequirements(content);

    return {
      domain,
      requirements,
      domainScores: {},
    };
  }

  /** 生成执行计划 */
  generatePlan(analysis: FilmAnalysis): DirectorPlan {
    const domain = analysis.domain;
    const plan: FilmPlan = {
      stage_1: 'story_outline',
      stage_2: 'character_design',
      stage_3: 'storyboard',
      stage_4: 'prompt_generation',
      stage_5: 'resource_dispatch',
    };

    if (domain === 'mv') {
      plan.stage_1 = 'lyrics_analysis';
      plan.stage_4 = 'music_prompt_generation';
    } else if (domain === 'market') {
      plan.stage_1 = 'product_positioning';
    } else if (domain === 'short') {
      plan.stage_1 = 'hook_design';
      plan.stage_4 = 'viral_prompt_generation';
    } else if (domain === 'doc') {
      plan.stage_1 = 'interview_outline';
    }

    return {
      analysis,
      plan,
      domainConfig: this.getDomainConfig(domain),
      duration: analysis.requirements.duration,
      originalContent: '',
    };
  }

  /** 一键分析并生成计划 */
  analyzeAndPlan(content: string, duration?: number): DirectorPlan {
    const analysis = this.analyzeContent(content);
    const plan = this.generatePlan(analysis);
    plan.duration = duration || analysis.requirements.duration;
    plan.originalContent = content;
    return plan;
  }

  /**
   * v3.0 新增: 执行完整导演流水线
   * 返回结构化输出 + LLM 提示词，由调用方负责 LLM 调用
   */
  runPipeline(content: string, options?: {
    contentType?: string;
    duration?: number;
    style?: string;
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
    skipScheduling?: boolean;
  }) {
    const pipeline = createPipeline({
      duration: options?.duration || 180,
      style: options?.style || 'cinematic',
      aspectRatio: options?.aspectRatio || '16:9',
      skipScheduling: options?.skipScheduling ?? false,
    });

    return pipeline.run(content, {
      contentType: options?.contentType as keyof typeof NARRATIVE_TEMPLATES | undefined,
      duration: options?.duration,
    });
  }

  /**
   * v3.0 新增: 风格推荐
   */
  recommendStyles(content: string) {
    return this.pipeline.recommendStyles(content);
  }

  // ============================================================
  // 私有方法（保留原有逻辑兼容）
  // ============================================================

  private parseRequirements(content: string): FilmRequirements {
    return {
      duration: this.extractDuration(content),
      mood: this.extractMood(content),
      characters: this.extractCharacters(content),
      hasScript: content.includes('脚本'),
      hasStoryboard: content.includes('分镜') || content.includes('镜头'),
    };
  }

  private extractDuration(content: string): number {
    const match = content.match(/(\d+)\s*[秒s]/);
    if (match) return parseInt(match[1], 10);
    const minMatch = content.match(/(\d+)\s*[分钟分m]/);
    if (minMatch) return parseInt(minMatch[1], 10) * 60;
    return 30;
  }

  private extractMood(content: string): string {
    const moods: Record<string, string[]> = {
      感人: ['感人', '泪', '催泪', '动容', '感动'],
      搞笑: ['搞笑', '幽默', '逗', '趣', '喜剧', '笑'],
      浪漫: ['浪漫', '甜蜜', '爱情', '温馨', '恋爱'],
      悬疑: ['悬疑', '紧张', '惊悚', '恐怖', '推理', '烧脑'],
      热血: ['热血', '燃', '励志', '激情', '奋斗'],
      治愈: ['治愈', '温暖', '清新', '宁静', '安逸'],
      科幻: ['科幻', '未来', '太空', '科技', '宇宙'],
    };
    for (const [mood, keywords] of Object.entries(moods)) {
      if (keywords.some((k) => content.includes(k))) return mood;
    }
    return '平静';
  }

  private extractCharacters(content: string): string[] {
    const names = content.match(/[\u4e00-\u9fa5]{2,4}(?:男|女|主角|人物)/g);
    return names || [];
  }

  private getDomainConfig(domain: FilmDomain): DomainConfig {
    const configs: Record<FilmDomain, DomainConfig> = {
      film: { structure: '三幕式', pace: 'medium', aspect: '16:9' },
      anime: { structure: '热血漫', pace: 'fast', aspect: '16:9' },
      market: { structure: 'AIDA', pace: 'fast', aspect: '9:16' },
      short: { structure: '快节奏', pace: 'very_fast', aspect: '9:16' },
      mv: { structure: '音乐驱动', pace: 'rhythm', aspect: '16:9' },
      doc: { structure: '纪实', pace: 'slow', aspect: '16:9' },
      drama: { structure: '戏剧式', pace: 'controlled', aspect: '16:9' },
    };
    return configs[domain] || configs.film;
  }
}

// ============================================================
// 领域标签与图标（UI 组件依赖）
// ============================================================

export const DOMAIN_LABELS: Record<FilmDomain, string> = {
  film: '影视剧情',
  anime: '动漫动画',
  market: '营销广告',
  short: '短视频',
  mv: '音乐MV',
  doc: '纪录片',
  drama: '舞台剧',
};

export const DOMAIN_ICONS: Record<FilmDomain, string> = {
  film: '🎬',
  anime: '🎨',
  market: '📢',
  short: '📱',
  mv: '🎵',
  doc: '🎥',
  drama: '🎭',
};

// 导出 v3.0 新模块的常量供外部使用
export { NARRATIVE_TEMPLATES, SHOT_TYPES, CAMERA_MOVEMENTS, TRANSITIONS, CONTENT_TYPE_TABLE };
