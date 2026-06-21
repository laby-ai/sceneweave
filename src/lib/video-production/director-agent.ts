/**
 * 自动化导演Agent - 核心导演智能体
 * 将用户创意/编剧输出转化为机器可执行的拍摄指令
 * 
 * 核心能力:
 * - 8种景别智能选择
 * - 13种运镜匹配
 * - 7种转场设计
 * - 情感曲线生成
 * - 分镜编排
 */

import { SHOT_TYPES, CAMERA_MOVEMENTS, TRANSITIONS, NARRATIVE_TEMPLATES } from './constants';
import type {
  ShotTypeCode, CameraMovementCode, TransitionCode,
  DirectorShot, DirectorOutput, EmotionCurvePoint,
  StorySegment, ContentTypeCode, NarrativeTemplate,
  EmotionTag, PacingLabel,
} from './types';

// 情感强度映射
const EMOTION_INTENSITY: Record<string, number> = {
  neutral: 0.3, curiosity: 0.4, anticipation: 0.5, focus: 0.5,
  engagement: 0.5, contemplation: 0.4, pain_point: 0.6, solution: 0.5,
  tension: 0.7, summary: 0.3, satisfaction: 0.6, inspiration: 0.7,
  high_excitement: 0.9, action: 0.7, awe: 0.8,
};

// 情绪→景别推荐
const EMOTION_SHOT_RECOMMENDATION: Record<string, ShotTypeCode[]> = {
  tension:       ['ECU', 'CU'],
  high_excitement: ['ECU', 'CU', 'MCU'],
  satisfaction:  ['MS', 'MWS', 'WS'],
  curiosity:     ['WS', 'MS', 'CU'],
  focus:         ['CU', 'MCU', 'MS'],
  awe:           ['EWS', 'WS', 'EST'],
  contemplation: ['WS', 'MS'],
  pain_point:    ['CU', 'ECU', 'MCU'],
  solution:      ['MS', 'MCU'],
  inspiration:   ['WS', 'EWS', 'MWS'],
  action:        ['MCU', 'MS', 'MWS'],
  neutral:       ['MS', 'WS'],
  engagement:    ['MS', 'MCU'],
  summary:       ['WS', 'MS'],
  anticipation:  ['CU', 'MS'],
};

// 节奏→运镜推荐
const PACING_CAMERA_RECOMMENDATION: Record<string, CameraMovementCode[]> = {
  slow:   ['static', 'dolly_out', 'crane_up'],
  medium: ['static', 'dolly_in', 'pan_left', 'pan_right'],
  fast:   ['dolly_in', 'tracking', 'handheld', 'zoom_in'],
  very_fast: ['handheld', 'tracking', 'dolly_in'],
  rhythm:  ['tracking', 'crane_up', 'crane_down'],
  controlled: ['static', 'tilt_up', 'tilt_down'],
};

export class DirectorAgent {
  /**
   * 编排分镜
   * 将编剧输出的叙事段落转化为结构化的导演分镜指令
   */
  directStoryboard(
    narrative: StorySegment[],
    options: {
      contentType: ContentTypeCode;
      aspectRatio?: string;
      targetDuration?: number;
    }
  ): DirectorOutput {
    const template = NARRATIVE_TEMPLATES[options.contentType] || NARRATIVE_TEMPLATES.general;
    const targetDuration = options.targetDuration || 60;

    // 计算每个叙事段落应分配的镜头数量和时长
    const segmentDurations = this.distributeDuration(narrative, targetDuration, template);

    const shots: DirectorShot[] = [];
    const emotionCurve: EmotionCurvePoint[] = [];
    let shotIndex = 0;

    for (let segIdx = 0; segIdx < narrative.length; segIdx++) {
      const segment = narrative[segIdx];
      const segmentDuration = segmentDurations[segIdx];
      const shotCount = Math.max(1, Math.round(segmentDuration / 5)); // 每镜头约5秒

      // 记录情感曲线
      emotionCurve.push({
        sequence: segIdx + 1,
        emotion: segment.emotion,
        intensity: EMOTION_INTENSITY[segment.emotion] || 0.5,
      });

      // 为该段落生成镜头
      for (let i = 0; i < shotCount; i++) {
        shotIndex++;
        const shotType = this.selectShotType(segment, template, i, shotCount);
        const cameraMovement = this.selectCameraMovement(segment.pacing as PacingLabel, i, shotCount);
        const transition = this.selectTransition(segment, i, template.transitionStyle);

        shots.push({
          shotId: `shot_${segIdx + 1}_${i + 1}`,
          sequence: shotIndex,
          shotType,
          cameraMovement,
          visualPrompt: '',  // 由 LLM 或 prompt 生成模块填充
          duration: Math.round(segmentDuration / shotCount),
          cameraDetail: CAMERA_MOVEMENTS[cameraMovement].name,
          subject: segment.subject,
          environment: segment.setting,
          lighting: segment.lighting,
          style: segment.style,
          pacing: segment.pacing as PacingLabel,
          audioType: this.inferAudioType(segment),
          audioContent: segment.text,
          emotionTag: segment.emotion,
          transitionFrom: i === 0 ? (segIdx === 0 ? 'fade_in' : transition) : transition,
          transitionTo: i === shotCount - 1 ? (segIdx === narrative.length - 1 ? 'fade_out' : transition) : 'cut',
          characterRefs: segment.characterIds,
          assetLibraryRefs: segment.assetRefs,
          sceneRefs: [],
          assetSource: '',
          assetId: '',
          matchScore: 0,
        });
      }
    }

    // 统计景别分布
    const shotTypeDistribution: Record<string, number> = {};
    for (const shot of shots) {
      shotTypeDistribution[shot.shotType] = (shotTypeDistribution[shot.shotType] || 0) + 1;
    }

    // 识别关键镜头
    const keyMoments = this.identifyKeyMoments(narrative, shots);

    return {
      shots,
      emotionCurve,
      totalDuration: shots.reduce((sum, s) => sum + s.duration, 0),
      shotTypeDistribution,
      keyMoments,
    };
  }

  /**
   * 构建 LLM 导演提示词
   * 优化每个分镜的 AI 生图 prompt
   */
  buildDirectorPrompt(
    shots: DirectorShot[],
    style?: string,
  ): string {
    const shotTypeNames = Object.values(SHOT_TYPES).map(st => `${st.code}(${st.name})`).join(' / ');
    const movementNames = Object.values(CAMERA_MOVEMENTS).map(cm => `${cm.code}(${cm.name})`).join(' / ');

    const shotsInput = shots.map(s => ({
      id: s.shotId,
      shotType: `${s.shotType}(${SHOT_TYPES[s.shotType].name})`,
      cameraMovement: `${s.cameraMovement}(${CAMERA_MOVEMENTS[s.cameraMovement].name})`,
      emotion: s.emotionTag,
      subject: s.subject,
      setting: s.environment,
      lighting: s.lighting,
      duration: s.duration,
    }));

    return `你是一位资深影视分镜师和AI绘画提示词工程师。

【整体风格】${style || '写实电影感'}

【景别参考】${shotTypeNames}
【运镜参考】${movementNames}

【分镜列表】
${JSON.stringify(shotsInput, null, 2)}

请为每个分镜生成优化的英文生图prompt。输出JSON数组，格式：
[
  {
    "id": "shot_1_1",
    "visualPrompt": "英文生图prompt，包含主体、动作、环境、光线、色调、风格、景别关键词，100词以内",
    "content": "中文画面内容描述（补充/修正）",
    "contentEn": "英文画面描述（与visualPrompt一致但更自然）"
  }
]

优化规则：
1. prompt六层架构：主体定义→时序动作→景别运镜→光影具象→风格修饰→画质必加
2. 包含角色外貌关键词确保一致性
3. 使用专业摄影术语（cinematic lighting, shallow depth of field, 35mm lens等）
4. 景别关键词：ECU=extreme close-up, CU=close-up, MCU=medium close-up, MS=medium shot, MWS=medium wide shot, WS=wide shot, EWS=extreme wide shot, EST=establishing shot
5. 运镜关键词：dolly in, tracking shot, handheld, crane shot, static等
6. 控制在100词以内
7. 确保JSON格式完全合法
8. 不要在JSON外面添加任何其他文字`;
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /** 分配各段落时长 */
  private distributeDuration(
    narrative: StorySegment[],
    totalDuration: number,
    template: NarrativeTemplate
  ): number[] {
    // 基于叙事模板的节奏权重分配时长
    const pacingWeight: Record<string, number> = {
      slow: 1.3, medium: 1.0, fast: 0.7, very_fast: 0.5, rhythm: 1.0, controlled: 1.0,
    };

    let totalWeight = 0;
    const weights: number[] = [];
    for (const seg of narrative) {
      const w = pacingWeight[seg.pacing as string] || 1.0;
      weights.push(w);
      totalWeight += w;
    }

    return weights.map(w => Math.round((w / totalWeight) * totalDuration));
  }

  /** 选择景别 */
  private selectShotType(
    segment: StorySegment,
    template: NarrativeTemplate,
    shotIndexInSegment: number,
    totalShotsInSegment: number
  ): ShotTypeCode {
    // 优先从情绪推荐中选择
    const emotionRecs = EMOTION_SHOT_RECOMMENDATION[segment.emotion];
    const templateRecs = Object.keys(template.shotDistribution) as ShotTypeCode[];

    // 结合模板分布和情绪推荐
    if (emotionRecs && emotionRecs.length > 0) {
      // 段落首镜头用大景别建立，后续镜头用推荐景别
      if (shotIndexInSegment === 0) {
        return templateRecs[0] || emotionRecs[emotionRecs.length - 1];
      }
      if (shotIndexInSegment === totalShotsInSegment - 1) {
        return emotionRecs[0];
      }
      // 中间镜头从推荐中轮换
      return emotionRecs[shotIndexInSegment % emotionRecs.length];
    }

    // 回退到模板分布
    return templateRecs[shotIndexInSegment % templateRecs.length];
  }

  /** 选择运镜 */
  private selectCameraMovement(
    pacing: PacingLabel,
    shotIndex: number,
    totalShots: number
  ): CameraMovementCode {
    const recs = PACING_CAMERA_RECOMMENDATION[pacing] || PACING_CAMERA_RECOMMENDATION.medium;
    
    // 首镜头常静态，末镜头可动态
    if (shotIndex === 0) return recs[0] || 'static';
    if (shotIndex === totalShots - 1) return recs[recs.length - 1] || 'dolly_out';
    
    return recs[shotIndex % recs.length];
  }

  /** 选择转场 */
  private selectTransition(
    segment: StorySegment,
    shotIndex: number,
    transitionStyle: string
  ): TransitionCode {
    if (transitionStyle === 'dissolve') {
      return shotIndex === 0 ? 'dissolve' : 'cut';
    }
    // 高潮段落用闪白
    if (segment.type === 'climax') return 'flash';
    // 建立镜头用叠化
    if (segment.type === 'establishing') return 'dissolve';
    return 'cut';
  }

  /** 推断音频类型 */
  private inferAudioType(segment: StorySegment): 'dialogue' | 'narration' | 'music' | 'sfx' | '' {
    if (segment.type === 'climax') return 'music';
    if (segment.type === 'establishing') return 'music';
    if (segment.type === 'transition') return 'sfx';
    if (segment.text && segment.text.startsWith('"')) return 'dialogue';
    if (segment.text) return 'narration';
    return '';
  }

  /** 识别关键镜头 */
  private identifyKeyMoments(
    narrative: StorySegment[],
    shots: DirectorShot[]
  ): Array<{ sequence: number; description: string }> {
    const keyMoments: Array<{ sequence: number; description: string }> = [];

    for (let i = 0; i < narrative.length; i++) {
      const seg = narrative[i];
      if (seg.type === 'climax' || seg.type === 'establishing') {
        // 找到该段落对应的第一个镜头
        const shot = shots.find(s => s.shotId.startsWith(`shot_${i + 1}_`));
        if (shot) {
          keyMoments.push({
            sequence: shot.sequence,
            description: `${seg.type === 'climax' ? '高潮' : '建立镜头'} - ${seg.emotion}`,
          });
        }
      }
    }

    return keyMoments;
  }
}
