/**  
 * 提示词优化工具
 * 将复杂分镜描述压缩为AI可理解的简洁提示词
 */

export interface ParsedPrompt {
  mainScene: string;
  style: string;
  keyElements: string[];
  duration: number;
  mood: string;
}

/**
 * 解析复杂分镜提示词
 */
export function parseComplexPrompt(rawPrompt: string): ParsedPrompt {
  const durationMatch = rawPrompt.match(/(\d+)\s*秒/);
  const duration = durationMatch ? parseInt(durationMatch[1]) : 5;
  
  const styleKeywords = [
    '未来工业', '科技风', '冷蓝色调', '赛博朋克', '科幻',
    '极简', '复古', '商务', '活力', '温馨'
  ];
  const foundStyles = styleKeywords.filter(k => rawPrompt.includes(k));
  
  const keyElements: string[] = [];
  const lines = rawPrompt.split(/[。；\n]/);
  lines.forEach(line => {
    if (line.includes('展示') || line.includes('呈现') || line.includes('画面')) {
      const clean = line.replace(/^[^：]*：/, '').trim();
      if (clean.length > 3 && clean.length < 50) {
        keyElements.push(clean);
      }
    }
  });
  
  const uniqueElements = [...new Set(keyElements)].slice(0, 5);
  
  const mainScene = rawPrompt
    .replace(/\d+-\d+秒[:：]/g, '')
    .replace(/快速闪切[\s\S]*/, '')
    .slice(0, 100);
  
  return {
    mainScene,
    style: foundStyles.join('、') || '科技感',
    keyElements: uniqueElements,
    duration,
    mood: rawPrompt.includes('紧凑') ? '快节奏' : '平稳'
  };
}

/**
 * 生成优化后的提示词
 */
export function optimizePrompt(rawPrompt: string): string {
  const parsed = parseComplexPrompt(rawPrompt);
  
  const parts = [
    `${parsed.duration}秒企业宣传视频`,
    parsed.style,
    parsed.mainScene.slice(0, 80),
    ...parsed.keyElements.slice(0, 3)
  ];
  
  return parts.filter(Boolean).join('，');
}

/**
 * 分段生成复杂视频
 */
export function splitComplexPrompt(rawPrompt: string): Array<{timeRange: string; scene: string; duration: number}> {
  const segments: Array<{timeRange: string; scene: string; duration: number}> = [];
  
  const timePattern = /(\d+)-(\d+)秒[:：]([^\d]+?)(?=\d+-\d+秒|$)/g;
  let match;
  
  while ((match = timePattern.exec(rawPrompt)) !== null) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    const scene = match[3].trim().slice(0, 100);
    
    segments.push({
      timeRange: `${start}-${end}秒`,
      scene,
      duration: end - start
    });
  }
  
  if (segments.length === 0) {
    segments.push({
      timeRange: '整体',
      scene: optimizePrompt(rawPrompt),
      duration: 5
    });
  }
  
  return segments;
}

/**
 * 根据时长计算最优分段策略
 */
export function calculateOptimalSegments(totalDuration: number): Array<{index: number; duration: number; prompt: string}> {
  const MAX_SEGMENT_DURATION = 5;
  const numSegments = Math.ceil(totalDuration / MAX_SEGMENT_DURATION);
  
  const segments: Array<{index: number; duration: number; prompt: string}> = [];
  
  for (let i = 0; i < numSegments; i++) {
    const segmentDuration = Math.min(
      MAX_SEGMENT_DURATION,
      totalDuration - i * MAX_SEGMENT_DURATION
    );
    
    segments.push({
      index: i + 1,
      duration: segmentDuration,
      prompt: `第${i + 1}段视频内容`
    });
  }
  
  return segments;
}
