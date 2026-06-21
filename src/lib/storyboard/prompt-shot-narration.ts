import type { UserInputEntities } from '../storyboard-generator';
import type { NarrationSuggestion, PromptBasedShot, SubtitleSuggestion } from './prompt-shot-types';

export function generateSubtitleAndNarration(
  shots: PromptBasedShot[],
  entities: UserInputEntities,
  originalPrompt: string,
  sceneType: string
): { subtitleSuggestion: SubtitleSuggestion; narrationSuggestion: NarrationSuggestion } {
  const shotCount = shots.length;

  // ---- 场景风格模板 ----
  const styleTemplates: Record<string, {
    /** 字幕风格：如何从镜头prompt提炼字幕 */
    subtitleStyle: (shot: PromptBasedShot, idx: number) => string;
    /** 旁白风格：开场白 */
    narrationOpen: (entities: UserInputEntities) => string;
    /** 旁白风格：每段过渡词 */
    narrationTransition: (idx: number, total: number, phase?: string) => string;
    /** 旁白风格：结尾 */
    narrationClose: () => string;
  }> = {
    product: {
      subtitleStyle: (shot, idx) => generateProductSubtitle(shot, idx),
      narrationOpen: (e) => `今天为您带来${e.subject || '这款产品'}的全方位展示。`,
      narrationTransition: (idx, total) => {
        if (idx === 0) return '首先，';
        if (idx === total - 1) return '最后，';
        if (idx === Math.floor(total / 2)) return '接下来，让我们聚焦细节。';
        return '继续看，';
      },
      narrationClose: () => '这就是它的全部魅力所在。',
    },
    drama: {
      subtitleStyle: (shot, idx) => generateDramaSubtitle(shot, idx),
      narrationOpen: (e) => `故事从这里开始...`,
      narrationTransition: (idx, total, phase) => {
        const map: Record<string, string> = {
          establishing: '', developing: '随着情节推进，', detail: '此时此刻，', climax: '就在这一瞬，', resolving: '最终，',
        };
        return map[phase || ''] || '';
      },
      narrationClose: () => '一切尘埃落定。',
    },
    landscape: {
      subtitleStyle: (shot, idx) => generateLandscapeSubtitle(shot, idx),
      narrationOpen: (e) => `让我们一同走进这片${e.subject || '美丽风景'}。`,
      narrationTransition: (idx, total) => {
        if (idx === 0) return '映入眼帘的是，';
        if (idx === total - 1) return '最后回望，';
        return '移步向前，';
      },
      narrationClose: () => '大自然总是如此令人心驰神往。',
    },
    food: {
      subtitleStyle: (shot, idx) => generateFoodSubtitle(shot, idx),
      narrationOpen: (e) => `一道${e.subject || '美味佳肴'}即将呈现在您眼前。`,
      narrationTransition: (idx, total) => {
        if (idx === 0) return '首先映入眼帘的，是';
        if (idx === total - 1) return '最终呈现的，是';
        return '接着，';
      },
      narrationClose: () => '这不仅仅是一道菜，更是一场味觉的艺术之旅。',
    },
    portrait: {
      subtitleStyle: (shot, idx) => generatePortraitSubtitle(shot, idx),
      narrationOpen: (e) => `今天要为您介绍的，是${e.subject || '这位人物'}。`,
      narrationTransition: (idx, total) => {
        if (idx === 0) return '初见之时，';
        if (idx === total - 1) return '最终，我们看到的，是';
        return '进一步了解，';
      },
      narrationClose: () => '每一个细节都在诉说着独特的故事。',
    },
    abstract: {
      subtitleStyle: (shot, idx) => generateAbstractSubtitle(shot, idx),
      narrationOpen: () => '一段视觉旅程即将展开...',
      narrationTransition: () => '',
      narrationClose: () => '在光影交错中，感受无限可能。',
    },
    interior: {
      subtitleStyle: (shot, idx) => generateInteriorSubtitle(shot, idx),
      narrationOpen: (e) => `欢迎来到这处${e.subject || '空间'}。`,
      narrationTransition: (idx, total) => {
        if (idx === 0) return '走进这里，';
        if (idx === total - 1) return '整体来看，';
        return '目光所及，';
      },
      narrationClose: () => '每一个角落都经过精心设计。',
    },
  };

  // 获取当前场景的风格模板（默认使用portrait）
  const template = styleTemplates[sceneType] || styleTemplates.portrait;

  // ---- 生成字幕分段 ----
  const segments: Array<{ text: string; startTime: number; endTime: number }> = [];
  let currentTime = 0;

  for (let i = 0; i < shotCount; i++) {
    const shot = shots[i];
    const subtitleText = template.subtitleStyle(shot, i);
    segments.push({
      text: subtitleText,
      startTime: currentTime,
      endTime: currentTime + shot.duration,
    });
    currentTime += shot.duration;
  }

  const fullText = segments.map(s => s.text).join('');

  // ---- 生成旁白脚本 ----
  const perShotNarration: Array<{ shotIndex: number; text: string; startTime: number; endTime: number }> = [];
  const narrationParts: string[] = [];

  currentTime = 0;
  for (let i = 0; i < shotCount; i++) {
    const shot = shots[i];
    const transition = template.narrationTransition(i, shotCount, shot.phase);

    // 从镜头prompt中提炼旁白内容（比字幕更详细、更口语化）
    const narrationContent = extractNarrationFromPrompt(shot.prompt, sceneType);
    const fullNarrationLine = `${transition}${narrationContent}`;

    perShotNarration.push({
      shotIndex: i,
      text: fullNarrationLine.trim(),
      startTime: currentTime,
      endTime: currentTime + shot.duration,
    });

    narrationParts.push(fullNarrationLine.trim());
    currentTime += shot.duration;
  }

  const script = `${template.narrationOpen(entities)} ${narrationParts.join(' ')} ${template.narrationClose()}`.replace(/\s+/g, ' ').trim();

  return {
    subtitleSuggestion: { segments, fullText },
    narrationSuggestion: { script, perShot: perShotNarration },
  };
}

// ============================================================
// 各场景类型的字幕生成策略
// ============================================================

/** 产品类：突出卖点、材质、功能 */
function generateProductSubtitle(shot: PromptBasedShot, idx: number): string {
  const prompt = shot.prompt;
  const phase = shot.phaseLabel || '';

  // 从prompt中提取关键信息
  if (phase.includes('亮相') || phase.includes('Hero') || idx === 0) {
    return extractKeyPhrase(prompt, ['展示', '呈现', '亮相', '登场']) || '产品全景展示';
  }
  if (phase.includes('角度') || phase.includes('多角度') || phase.includes('立体')) {
    return extractKeyPhrase(prompt, ['旋转', '环绕', '多角度', '侧面', '背面']) || '360°全方位展示';
  }
  if (phase.includes('细节') || phase.includes('特写') || phase.includes('质感')) {
    return extractKeyPhrase(prompt, ['细节', '特写', '材质', '工艺', '纹理']) || '精致工艺细节';
  }
  if (phase.includes('生活') || phase.includes('Lifestyle') || phase.includes('场景')) {
    return extractKeyPhrase(prompt, ['场景', '生活', '日常', '使用']) || '真实使用场景';
  }
  if (phase.includes('定格') || phase.includes('最终') || phase.includes('呈现')) {
    return extractKeyPhrase(prompt, ['品牌', 'Logo', '定格', '收尾']) || '品牌印象定格';

  }
  // 兜底：取prompt前15字
  return truncateText(cleanPromptForSubtitle(prompt), 14);
}

/** 剧情类：情感化、叙事性字幕 */
function generateDramaSubtitle(shot: PromptBasedShot, idx: number): string {
  const prompt = shot.prompt;
  const phase = shot.phaseLabel || '';

  if (phase.includes('开场') || phase.includes('establishing') || idx === 0) {
    return extractKeyPhrase(prompt, ['开始', '序幕', '清晨', '夜晚', '城市', '房间']) || '故事的开端';
  }
  if (phase.includes('发展') || phase.includes('developing')) {
    return extractKeyPhrase(prompt, ['逐渐', '慢慢', '忽然', '突然', '发现']) || '情节推进中';
  }
  if (phase.includes('高潮') || phase.includes('climax')) {
    return extractKeyPhrase(prompt, ['终于', '瞬间', '爆发', '真相', '决定']) || '关键时刻';
  }
  if (phase.includes('结局') || phase.includes('resolving')) {
    return extractKeyPhrase(prompt, ['最终', '从此', '新的', '希望', '未来']) || '故事的尾声';
  }

  return truncateText(cleanPromptForSubtitle(prompt), 14);
}

/** 风景类：诗意、描写性字幕 */
function generateLandscapeSubtitle(shot: PromptBasedShot, idx: number): string {
  const prompt = shot.prompt;

  const natureWords = ['山川', '河流', '森林', '大海', '日出', '日落', '星空', '云海', '瀑布', '湖泊'];
  const found = natureWords.find(w => prompt.includes(w));
  if (found) {
    const desc = extractKeyPhrase(prompt, [found]) || found;
    return truncateText(desc, 14);
  }

  return truncateText(cleanPromptForSubtitle(prompt), 14);
}

/** 美食类：诱人、感官描写字幕 */
function generateFoodSubtitle(shot: PromptBasedShot, idx: number): string {
  const prompt = shot.prompt;
  const phase = shot.phaseLabel || '';

  if (phase.includes('摆盘') || phase.includes('hero') || idx === 0) {
    return extractKeyPhrase(prompt, ['摆盘', '呈现', '上桌', '菜品']) || '精美摆盘呈现';
  }
  if (phase.includes('质感') || phase.includes('detail')) {
    return extractKeyPhrase(prompt, ['纹理', '色泽', '香气', '热气', '酱汁']) || '诱人质感特写';
  }
  if (phase.includes('动态') || phase.includes('transition')) {
    return extractKeyPhrase(prompt, ['切割', '夹起', '淋汁', '翻炒']) || '动态制作过程';
  }
  if (phase.includes('呈现') || phase.includes('presentation')) {
    return extractKeyPhrase(prompt, ['成品', '完成', '享受', '品尝']) || '完美成品呈现';
  }

  return truncateText(cleanPromptForSubtitle(prompt), 14);
}

/** 人像类：气质、个性描写字幕 */
function generatePortraitSubtitle(shot: PromptBasedShot, idx: number): string {
  const prompt = shot.prompt;

  if (idx === 0) {
    return extractKeyPhrase(prompt, ['肖像', '形象', '气质', '风采']) || '人物形象展示';
  }

  return truncateText(cleanPromptForSubtitle(prompt), 14);
}

/** 抽象类：简洁、概念性字幕 */
function generateAbstractSubtitle(shot: PromptBasedShot, idx: number): string {
  return truncateText(cleanPromptForSubtitle(shot.prompt), 12);
}

/** 室内类：空间、设计感字幕 */
function generateInteriorSubtitle(shot: PromptBasedShot, idx: number): string {
  const prompt = shot.prompt;

  if (idx === 0) {
    return extractKeyPhrase(prompt, ['空间', '设计', '布局', '入口']) || '空间全貌';
  }

  return truncateText(cleanPromptForSubtitle(prompt), 14);
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 从prompt中提取包含关键词的关键短语
 */
function extractKeyPhrase(prompt: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    const idx = prompt.indexOf(kw);
    if (idx !== -1) {
      // 提取关键词前后共16个字符
      const start = Math.max(0, idx - 6);
      const end = Math.min(prompt.length, idx + kw.length + 10);
      let phrase = prompt.slice(start, end);
      // 清理并截断
      phrase = cleanPromptForSubtitle(phrase);
      if (phrase.length >= 4) return truncateText(phrase, 16);
    }
  }
  return null;
}

/**
 * 清理prompt文本用于字幕显示（去除技术参数、英文指令等）
 */
function cleanPromptForSubtitle(text: string): string {
  return text
    .replace(/\b(best quality|masterpiece|8k|4k|highly detailed|cinematic lighting|professional photography|depth of field|bokeh|ray tracing|global illumination|octane render|unreal engine|photorealistic|hyperrealistic)\b/gi, '')
    .replace(/[,，;；|\/\\]/g, ' ')
    .replace(/[【】\[\]()（）《》""''``]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * 截断文本到指定长度（优先在标点处截断）
 */
function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  // 尝试在句号、逗号等位置截断
  for (let i = maxLen; i > maxLen - 5 && i > 0; i--) {
    if ('，。！？、；：'.includes(text[i])) {
      return text.slice(0, i + 1);
    }
  }

  return text.slice(0, maxLen) + '…';
}

/**
 * 从镜头prompt中提炼旁白内容（口语化、叙述性）
 */
function extractNarrationFromPrompt(prompt: string, sceneType: string): string {
  let text = cleanPromptForSubtitle(prompt);

  // 根据场景类型调整语气
  switch (sceneType) {
    case 'product':
      text = text.replace(/(展示|呈现|可见)/g, '可以看到');
      break;
    case 'drama':
      // 保持原样即可，剧情本身就有叙事性
      break;
    case 'landscape':
      text = text.replace(/(景色|风光|景观)/g, '眼前的景象');
      break;
    case 'food':
      text = text.replace(/(美味|可口|诱人)/g, '令人垂涎');
      break;
  }

  // 截取合适长度作为一句旁白（旁白可以比字幕长）
  return truncateText(text, 30);
}
