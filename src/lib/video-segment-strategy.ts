/**
 * 视频分段策略配置系统
 * 支持多种策略模式，适应不同的SDK支持范围
 */

export type SegmentStrategyMode = 'conservative' | 'balanced' | 'aggressive';

export interface SegmentStrategy {
  name: string;
  description: string;
  getSegmentDuration: (totalDuration: number) => number;
  shouldUseSegmentedGeneration: (totalDuration: number) => boolean;
  calculateSegments: (totalDuration: number) => number;
  maxSingleDuration: number;
}

/**
 * 保守策略（推荐，最稳定）
 * - 10秒内：单片段
 * - 11-20秒：2个10秒片段
 * - 21秒以上：智能分段，最大不超过10秒
 */
export const conservativeStrategy: SegmentStrategy = {
  name: '保守策略',
  description: '最稳定，单片段不超过10秒，避免失败风险',
  getSegmentDuration: (totalDuration: number): number => {
    if (totalDuration <= 10) return totalDuration; // 10秒内直接单片段
    return 10; // 所有情况都用10秒片段
  },
  shouldUseSegmentedGeneration: (totalDuration: number): boolean => {
    return totalDuration > 10; // 10秒以上就用分段
  },
  calculateSegments: (totalDuration: number): number => {
    if (totalDuration <= 10) return 1;
    return Math.ceil(totalDuration / 10);
  },
  maxSingleDuration: 10
};

/**
 * 平衡策略（推荐，兼顾稳定和效率）
 * - 20秒内：单片段
 * - 21-40秒：2个20秒片段
 * - 41秒以上：智能分段
 */
export const balancedStrategy: SegmentStrategy = {
  name: '平衡策略',
  description: '兼顾稳定性和API调用效率，适合大多数场景',
  getSegmentDuration: (totalDuration: number): number => {
    if (totalDuration <= 20) return totalDuration; // 20秒内直接单片段
    if (totalDuration <= 40) return 20; // 40秒内用20秒片段（2段）
    if (totalDuration <= 60) return 25; // 60秒内用25秒片段（2-3段）
    if (totalDuration <= 90) return 30; // 90秒内用30秒片段（3-4段）
    return 30; // 更长的视频用30秒片段
  },
  shouldUseSegmentedGeneration: (totalDuration: number): boolean => {
    return totalDuration > 20; // 20秒以上才用分段
  },
  calculateSegments: (totalDuration: number): number => {
    if (totalDuration <= 20) return 1;
    const segmentDuration = balancedStrategy.getSegmentDuration(totalDuration);
    return Math.ceil(totalDuration / segmentDuration);
  },
  maxSingleDuration: 20
};

/**
 * 激进策略（节省配额，但风险较高）
 * - 30秒内：单片段
 * - 31-60秒：2个30秒片段
 * - 61秒以上：智能分段
 */
export const aggressiveStrategy: SegmentStrategy = {
  name: '激进策略',
  description: '最大程度节省API配额，但20秒+单片段可能失败',
  getSegmentDuration: (totalDuration: number): number => {
    if (totalDuration <= 30) return totalDuration; // 30秒内直接单片段
    if (totalDuration <= 60) return 30; // 60秒内用30秒片段（2段）
    if (totalDuration <= 90) return 35; // 90秒内用35秒片段（2-3段）
    return 40; // 更长的视频用40秒片段
  },
  shouldUseSegmentedGeneration: (totalDuration: number): boolean => {
    return totalDuration > 30; // 30秒以上才用分段
  },
  calculateSegments: (totalDuration: number): number => {
    if (totalDuration <= 30) return 1;
    const segmentDuration = aggressiveStrategy.getSegmentDuration(totalDuration);
    return Math.ceil(totalDuration / segmentDuration);
  },
  maxSingleDuration: 30
};

// 策略映射
export const strategyMap: Record<SegmentStrategyMode, SegmentStrategy> = {
  conservative: conservativeStrategy,
  balanced: balancedStrategy,
  aggressive: aggressiveStrategy,
};

// 默认策略
export const DEFAULT_STRATEGY_MODE: SegmentStrategyMode = 'conservative';

/**
 * 获取当前策略
 */
export function getCurrentStrategy(mode?: SegmentStrategyMode): SegmentStrategy {
  return strategyMap[mode || DEFAULT_STRATEGY_MODE];
}

/**
 * 计算预计生成时间（基于策略）
 */
export function calculateEstimatedTimeWithStrategy(
  totalDuration: number,
  strategy: SegmentStrategy,
  options: {
    is1080p?: boolean;
    hasMaterials?: boolean;
    hasSubtitle?: boolean;
    hasVoice?: boolean;
    useNineGrid?: boolean;
  } = {}
): number {
  let baseTime = 0;
  const { 
    is1080p = false, 
    hasMaterials = false, 
    hasSubtitle = false, 
    hasVoice = false,
    useNineGrid = false
  } = options;
  
  // 九宫格模式额外时间
  const nineGridExtraTime = useNineGrid ? 60 : 0;
  
  // 使用策略计算
  if (strategy.shouldUseSegmentedGeneration(totalDuration)) {
    const segmentDuration = strategy.getSegmentDuration(totalDuration);
    const numSegments = Math.ceil(totalDuration / segmentDuration);
    
    // 串行生成时间估算
    // 每个片段提交间隔20秒 + 生成时间 + 等待时间
    baseTime += numSegments * 20; // 提交间隔
    baseTime += numSegments * 70; // 每个片段生成时间（更长的片段需要更多时间）
    baseTime += 30; // 合并视频时间
    baseTime += nineGridExtraTime; // 九宫格额外时间
    
  } else {
    // 单片段直接生成
    baseTime += 120;
    baseTime += nineGridExtraTime; // 九宫格额外时间
  }
  
  // 分辨率影响
  if (is1080p) {
    baseTime *= 1.3;
  }
  
  // 素材处理时间
  if (hasMaterials) {
    baseTime += 8;
  }
  
  // 字幕添加时间
  if (hasSubtitle) {
    baseTime += 25;
    if (hasVoice) {
      baseTime += 40;
    }
  }
  
  // 最小时间60秒，最大时间根据视频长度调整
  const maxTime = totalDuration >= 60 ? 2400 : totalDuration >= 30 ? 1200 : 600;
  return Math.max(60, Math.min(baseTime, maxTime));
}

/**
 * 格式化时间显示
 */
export function formatEstimatedTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}分钟`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.ceil((seconds % 3600) / 60);
    return `${hours}小时${minutes}分钟`;
  }
}

/**
 * 获取策略建议
 */
export function getStrategyRecommendation(totalDuration: number): {
  recommended: SegmentStrategyMode;
  reasons: string[];
} {
  const reasons: string[] = [];
  
  if (totalDuration <= 15) {
    return {
      recommended: 'conservative',
      reasons: ['15秒内视频，任何策略都可以正常工作']
    };
  }
  
  if (totalDuration <= 20) {
    reasons.push('20秒视频可以尝试平衡策略，但保守策略更稳妥');
    return {
      recommended: 'conservative',
      reasons
    };
  }
  
  if (totalDuration <= 30) {
    reasons.push('30秒视频建议使用保守或平衡策略');
    reasons.push('激进策略可能因单片段过长而失败');
    return {
      recommended: 'balanced',
      reasons
    };
  }
  
  reasons.push('长视频建议使用保守策略确保稳定性');
  return {
    recommended: 'conservative',
    reasons
  };
}
