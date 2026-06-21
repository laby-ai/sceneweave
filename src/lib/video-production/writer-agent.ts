/**
 * 自动化编剧Agent - 类型化叙事引擎
 * 识别内容类型，加载对应叙事模板，生成故事大纲和分集梗概
 */

import { NARRATIVE_TEMPLATES } from './constants';
import type {
  ContentTypeCode, NarrativeTemplate, StorySegment,
  WriterOutput, CharacterProfile, EmotionTag, NarrativeSegmentType,
} from './types';

export class WriterAgent {
  private templates: Record<ContentTypeCode, NarrativeTemplate>;

  constructor() {
    this.templates = NARRATIVE_TEMPLATES;
  }

  /**
   * 识别内容类型
   * 基于关键词匹配判断用户需求属于哪种内容类型
   */
  classifyContentType(userInput: string): ContentTypeCode {
    const inputLower = userInput.toLowerCase();

    // 叙事特征词 - 检测是否包含故事/剧情内容
    const narrativeIndicators = [
      '故事', '剧情', '角色', '主角', '反派', '英雄', '冒险', '旅途', '旅',
      '公主', '王子', '王后', '国王', '女王', '骑士', '战士', '勇士',
      '童话', '寓言', '神话', '传说', '民间', '经典',
      '狼', '龙', '魔', '妖', '鬼', '怪', '兽', '精灵',
      '外婆', '奶奶', '妈妈', '爸爸', '哥哥', '姐姐', '妹妹', '弟弟',
      '森林', '城堡', '宫殿', '村庄', '小镇', '山洞', '海边',
      '拯救', '寻找', '逃离', '追', '遇', '发现', '隐藏',
      '小红帽', '白雪', '灰姑娘', '美人鱼', '睡美人', '花木兰',
      '西游', '水浒', '三国', '红楼', '封神',
      '击败', '战胜', '保护', '守护', '复仇', '归来',
      '爱情', '友情', '亲情', '离别', '重逢', '牺牲',
      '剧', '戏', '传', '记', '章', '回',
    ];
    const narrativeScore = narrativeIndicators.filter(kw => inputLower.includes(kw)).length;

    const scores: Partial<Record<ContentTypeCode, number>> = {};
    for (const typeId of Object.keys(this.templates) as ContentTypeCode[]) {
      if (typeId === 'general') continue;
      const template = this.templates[typeId];
      let score = 0;
      for (const keyword of template.keywords) {
        if (inputLower.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }
      if (score > 0) {
        scores[typeId] = score;
      }
    }

    // 叙事内容优先匹配: fantasy/costume_drama > short_drama > general
    // 如果检测到叙事特征但无精确匹配，使用fantasy作为默认故事类型
    if (narrativeScore >= 2) {
      if (!scores.fantasy) scores.fantasy = 0;
      scores.fantasy = (scores.fantasy || 0) + Math.min(narrativeScore, 5);
    }

    // 找出最高分
    let bestType: ContentTypeCode = narrativeScore >= 2 ? 'fantasy' : 'general';
    let bestScore = 0;
    for (const [typeId, score] of Object.entries(scores)) {
      if ((score ?? 0) > bestScore) {
        bestScore = score ?? 0;
        bestType = typeId as ContentTypeCode;
      }
    }

    return bestType;
  }

  /**
   * 根据内容类型获取叙事模板
   */
  getTemplate(contentType: ContentTypeCode): NarrativeTemplate {
    return this.templates[contentType] || this.templates.general;
  }

  /**
   * 生成故事大纲（纯逻辑，不调用 LLM）
   * 基于 narrative structure 拆分为结构化段落
   */
  generateStoryOutline(
    userInput: string,
    contentType?: ContentTypeCode,
    options?: {
      duration?: number;
      characters?: Array<{ name: string; role: string }>;
    }
  ): WriterOutput {
    const detectedType = contentType || this.classifyContentType(userInput);
    const template = this.getTemplate(detectedType);

    // 基于叙事模板结构生成段落
    const totalDuration = options?.duration || 60;
    const segmentCount = template.structure.length;
    const baseDuration = totalDuration / segmentCount;

    const narrative: StorySegment[] = template.structure.map((seg, idx) => {
      // 根据节奏调整时长
      let duration = baseDuration;
      if (seg.pacing === 'fast') duration = baseDuration * 0.8;
      if (seg.pacing === 'slow') duration = baseDuration * 1.2;

      return {
        segmentId: `seg_${idx + 1}`,
        sequence: idx + 1,
        type: seg.type,
        text: '',  // 由 LLM 填充
        emotion: seg.emotion,
        pacing: seg.pacing,
        subject: '',
        setting: '',
        lighting: this.inferLighting(seg, idx, template.structure.length),
        style: this.inferStyle(detectedType),
        characterIds: options?.characters?.map(c => c.name) || [],
        assetRefs: [],
      };
    });

    // 生成角色小传
    const characterProfiles: Record<string, CharacterProfile> = {};
    if (options?.characters) {
      for (const char of options.characters) {
        characterProfiles[char.name] = {
          id: char.name,
          name: char.name,
          appearance: '',  // 由 LLM 填充
          personality: '',
          motivation: '',
          arc: '',
          relationships: {},
        };
      }
    }

    return {
      contentType: detectedType,
      typeName: template.name,
      outline: `${template.name}风格故事 - ${template.structure.map(s => s.desc).join(' → ')}`,
      narrative,
      characterProfiles,
      template,
    };
  }

  /**
   * 构建 LLM 编剧提示词
   * 结合叙事模板和用户输入，生成完整的编剧提示词
   */
  buildWriterPrompt(
    userInput: string,
    writerOutput: WriterOutput,
    options?: {
      duration?: number;
      style?: string;
      platform?: string;
    }
  ): string {
    const template = writerOutput.template;
    const duration = options?.duration || 60;
    const style = options?.style || '写实电影感';
    const platform = options?.platform || '通用';

    // 叙事结构描述
    const structureDesc = template.structure
      .map((s, i) => `${i + 1}. [${s.type}] ${s.desc} (情绪: ${s.emotion}, 节奏: ${s.pacing})`)
      .join('\n');

    // 景别分布描述
    const shotDesc = Object.entries(template.shotDistribution)
      .map(([k, v]) => `${k}: ${v}%`)
      .join(', ');

    // 智能镜头数计算：根据总时长和平台单镜头上限(10秒)计算最少镜头数
    const maxClipDuration = 10; // 平台单镜头最大时长
    const minClipDuration = 5;  // 最短过渡镜头时长
    const recommendedShots = Math.ceil(duration / 8); // 推荐镜头数(每镜头8秒)
    const minShots = Math.ceil(duration / maxClipDuration); // 最少镜头数
    const maxShots = Math.floor(duration / minClipDuration); // 最多镜头数

    return `你是一位资深影视编剧，擅长${template.name}类型的内容创作。

【用户需求】
${userInput}

【创作约束】
- 内容类型：${writerOutput.typeName}
- 目标时长：约${duration}秒
- 整体风格：${style}
- 目标平台：${platform}
- 镜头数量：推荐${recommendedShots}个（最少${minShots}个，最多${maxShots}个）
- 单镜头时长：5-10秒（5秒为最短过渡镜头，8-10秒为标准叙事镜头）
- 叙事节奏：${template.pacing}
- 转场风格：${template.transitionStyle}

【叙事结构要求】（严格遵循）
${structureDesc}

【景别分布建议】
${shotDesc}

请按以下JSON格式输出完整的影视脚本：

{
  "title": "作品标题",
  "subtitle": "副标题（可选）",
  "totalDuration": ${duration},
  "style": "${style}",
  "targetPlatform": "${platform}",
  "characters": [
    {
      "id": "char_1",
      "name": "角色名",
      "age": "25岁",
      "gender": "女",
      "appearance": "详细的五官、发型、身材、服装描述，确保AI生图时角色外观一致",
      "personality": "性格特征",
      "outfit": "具体服装描述"
    }
  ],
  "scenes": [
    {
      "id": "scene_1",
      "sceneNumber": 1,
      "name": "场景名称",
      "location": "具体地点",
      "timeOfDay": "日",
      "indoor": true,
      "description": "环境详细描述，包含光线、色调、天气、氛围",
      "mood": "温馨/紧张/欢快等"
    }
  ],
  "shots": [
    {
      "id": "shot_1_1",
      "sceneId": "scene_1",
      "sceneNumber": 1,
      "shotNumber": 1,
      "shotType": "特写/中景/全景等（参照景别分布建议）",
      "cameraAngle": "推/拉/摇/移/跟/固定",
      "cameraMovement": "运镜描述",
      "content": "画面内容中文描述（具体、可视觉化）",
      "contentEn": "English prompt for AI image generation, concise and professional",
      "dialogue": "对白文字（如有）",
      "narration": "旁白文字（如有）",
      "action": "角色动作描述",
      "soundEffect": "音效描述",
      "duration": 8,
      "characters": ["char_1"],
      "status": "pending",
      "emotionTag": "情绪标签"
    }
  ],
  "narrationScript": "完整的旁白脚本",
  "bgmSuggestion": "适合的BGM风格建议",
  "subtitleSuggestion": "字幕样式建议"
}

注意：
1. 严格遵循上述叙事结构，确保每个结构段落都有对应分镜
2. 景别分布尽量符合建议比例
3. 每个shot的duration必须是5-10之间的整数（5秒为最短过渡镜头，8-10秒为标准叙事镜头）
4. 所有shot的duration之和约等于${duration}，通过增加镜头数而非减少单镜头时长来满足总时长
5. contentEn用专业英文，适合AI图像生成
6. 确保JSON格式完全合法
7. 不要在JSON外面添加任何其他文字`;
  }

  // ============================================================
  // 私有辅助方法
  // ============================================================

  private inferLighting(
    seg: { type: NarrativeSegmentType; emotion: EmotionTag },
    index: number,
    total: number
  ): string {
    if (seg.type === 'climax' || seg.emotion === 'high_excitement') return 'dramatic';
    if (seg.emotion === 'tension' || seg.emotion === 'pain_point') return 'low-key';
    if (seg.emotion === 'satisfaction' || seg.emotion === 'inspiration') return 'warm';
    if (seg.emotion === 'awe') return 'golden_hour';
    if (index === 0) return 'natural';
    if (index === total - 1) return 'soft';
    return 'natural';
  }

  private inferStyle(contentType: ContentTypeCode): string {
    const styleMap: Record<ContentTypeCode, string> = {
      short_drama: 'dramatic_cinematic',
      education: 'clean_infographic',
      documentary: 'cinematic_documentary',
      marketing: 'bright_commercial',
      news: 'clean_professional',
      general: 'cinematic',
      cyberpunk: 'neon_noir',
      period_drama: 'classical_oriental',
      fantasy: 'epic_fantasy',
      folk_culture: 'cultural_heritage',
    };
    return styleMap[contentType] || 'cinematic';
  }
}
