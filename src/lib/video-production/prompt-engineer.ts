/**
 * 提示词工程模块 (v3.2)
 * 六层图像提示词架构 / 八层视频提示词架构 / 负面提示词体系
 * 
 * v3.2 融入 Open-Sora Prompt Refine 策略:
 * - T2V 提示词精炼：将简短描述扩展为详细视频描述
 * - I2V 提示词精炼：基于图片内容生成含动态信息的视频描述
 * - T2I 提示词精炼：为 T2I2V 管线首帧生成描述
 * - 运动评分感知提示词：根据 motion score 调整提示词动态程度
 */

import type {
  ImagePromptLayers, VideoPromptLayers,
  PromptStrategy, VideoPromptStrategy,
  DirectorShot, ContentTypeCode,
} from './types';
import {
  STYLE_PRESETS, NEGATIVE_PROMPTS,
  IMAGE_PROMPT_PRIORITY, VIDEO_PROMPT_PRIORITY,
} from './constants';

// ============================================================
// Open-Sora 融入：提示词精炼系统提示词
// ============================================================

/**
 * T2V 提示词精炼系统提示词 (Open-Sora)
 * 将简短用户提示词扩展为详细的视频描述
 */
export const PROMPT_REFINE_SYSTEM_T2V = `You are part of a team of bots that creates videos. The workflow is that you first create a caption of the video, and then the assistant bot will generate the video based on the caption. You work with an assistant bot that will draw anything you say.

For example, outputting "a beautiful morning in the woods with the sun peaking through the trees" will trigger your partner bot to output an video of a forest morning, as described. You will be prompted by people looking to create detailed, amazing videos. The way to accomplish this is to take their short prompts and make them extremely detailed and descriptive.

There are a few rules to follow:

You will only ever output a single video description per user request.

You should not simply make the description longer.

Video descriptions must have the same num of words as examples below. Extra words will be ignored.`;

/**
 * T2I 提示词精炼系统提示词 (Open-Sora)
 * 为 T2I2V 管线首帧生成描述，需包含动态信息
 */
export const PROMPT_REFINE_SYSTEM_T2I = `You are part of a team of bots that creates videos. The workflow is that you first create an image caption for the first frame of the video, and then the assistant bot will generate the video based on the image caption.

For example, outputting "a beautiful morning in the woods with the sun peaking through the trees" will trigger your partner bot to output an image of a forest morning, as described. You will be prompted by people looking to create detailed, amazing videos. The way to accomplish this is to take their short prompts and make them extremely detailed and descriptive.

There are a few rules to follow:

You will only ever output a single image description per user request.

You should not simply make the description longer.

Image captions must have the same num of words as examples. Extra words will be ignored.

Note: The input image is the first frame of the video, and the output image caption should include dynamic information.

Note: Don't contain camera transitions!!! Don't contain screen switching!!! Don't contain perspective shifts !!!

Note: Use daily language to describe the video, don't use complex words or phrases!!!`;

/**
 * I2V 提示词精炼系统提示词 (Open-Sora)
 * 基于参考图片和用户输入生成含动态信息的视频描述
 */
export const PROMPT_REFINE_SYSTEM_I2V = `You are part of a team of bots that creates videos. The workflow is that you first create a caption of the video based on the image, and then the assistant bot will generate the video based on the caption. You work with an assistant bot that will draw anything you say.

Give a highly descriptive video caption based on input image and user input. As an expert, delve deep into the image with a discerning eye, leveraging rich creativity, meticulous thought. When describing the details of an video, include appropriate dynamic information to ensure that the video caption contains reasonable actions and plots. If user input is not empty, then the caption should be expanded according to the user's input.

The input image is the first frame of the video, and the output video caption should describe the motion starting from the current image. User input is optional and can be empty.

Answers should be comprehensive, conversational, and use complete sentences. The answer should be in English no matter what the user's input is. Provide context where necessary and maintain a certain tone.  Begin directly without introductory phrases like "The image/video showcases" "The photo captures" and more. For example, say "A scene of a woman on a beach", instead of "A woman is depicted in the image".

Note: Must include appropriate dynamic information like actions, plots, etc. If the user prompt did not contain any dynamic information, then you must add some proper dynamic information like actions to make the video move!!!

Note: Try begin the sentence with phrases like  "A scene of" or "A view of" or "A close-up of" to make the video more descriptive!!!

Note: Use daily language to describe the video, don't use complex words or phrases!!!`;

/**
 * 运动评分预测系统提示词 (Open-Sora)
 * 根据提示词预测最佳运动评分
 */
export const PROMPT_REFINE_SYSTEM_MOTION_SCORE = `We define a video's motion score as its FFMPEG VMAF motion value. We now have a video generation model that accepts a desired VMAF motion value as input. To reduce user burden, please predict an optimal motion score for generating a high-quality video based on the user's text prompt. For reference:
- For runway videos featuring models, a motion score of 4 is ideal.
- For static videos, a motion score of 1 is preferred.

Output format: "{} motion score", where {} is an integer between 1 and 15.

User input:`;

/** 提示词精炼模式 */
export type PromptRefineMode = 't2v' | 't2i' | 'i2v' | 'motion_score';

/** 获取提示词精炼系统提示词 */
export function getRefineSystemPrompt(mode: PromptRefineMode): string {
  switch (mode) {
    case 't2v': return PROMPT_REFINE_SYSTEM_T2V;
    case 't2i': return PROMPT_REFINE_SYSTEM_T2I;
    case 'i2v': return PROMPT_REFINE_SYSTEM_I2V;
    case 'motion_score': return PROMPT_REFINE_SYSTEM_MOTION_SCORE;
  }
}

/** 构建提示词精炼的用户消息 */
export function buildRefineUserMessage(
  mode: PromptRefineMode,
  userPrompt: string,
  imageDescription?: string,
): string {
  if (mode === 'motion_score') {
    return userPrompt;
  }

  if (mode === 'i2v' && imageDescription) {
    return `Create an imaginative video descriptive caption based on the image and user input. Image description: "${imageDescription}". User input: "${userPrompt}"`;
  }

  return `Create an imaginative video descriptive caption or modify an earlier caption for the user input : "${userPrompt}"`;
}

// ============================================================
// Open-Sora 融入：FPS 信息注入
// ============================================================

/** 将 FPS 信息添加到提示词中（Open-Sora 格式） */
export function addFpsInfoToPrompt(prompt: string, fps: number): string {
  return `${fps} FPS. ${prompt}`;
}

/**
 * 提示词工程师
 * 根据分镜数据自动生成结构化提示词
 */
export class PromptEngineer {
  /**
   * 从分镜生成图像提示词 (六层架构)
   */
  generateImagePrompt(
    shot: DirectorShot,
    strategy: PromptStrategy = 'standard_six_layer',
  ): string {
    const layers = this.buildImageLayers(shot);
    return this.composeImagePrompt(layers, strategy);
  }

  /**
   * 从分镜生成视频提示词 (八层架构)
   */
  generateVideoPrompt(
    shot: DirectorShot,
    strategy: VideoPromptStrategy = 'slow_narrative',
  ): string {
    const layers = this.buildVideoLayers(shot);
    return this.composeVideoPrompt(layers, strategy);
  }

  /**
   * 生成负面提示词
   */
  generateNegativePrompt(context: 'general' | 'video' | 'portrait' | 'combined' = 'combined'): string {
    switch (context) {
      case 'general':
        return NEGATIVE_PROMPTS.general;
      case 'video':
        return `${NEGATIVE_PROMPTS.general}, ${NEGATIVE_PROMPTS.video}`;
      case 'portrait':
        return `${NEGATIVE_PROMPTS.general}, ${NEGATIVE_PROMPTS.portrait}`;
      case 'combined':
        return `${NEGATIVE_PROMPTS.general}, ${NEGATIVE_PROMPTS.video}, ${NEGATIVE_PROMPTS.portrait}`;
    }
  }

  /**
   * 裁剪过长提示词 (按优先级)
   */
  trimPrompt(prompt: string, maxChars: number = 500): string {
    if (prompt.length <= maxChars) return prompt;

    // 简单裁剪: 按逗号分割，从末尾移除低优先级部分
    const parts = prompt.split(', ').filter(Boolean);
    while (parts.join(', ').length > maxChars && parts.length > 3) {
      parts.pop();
    }
    return parts.join(', ');
  }

  /**
   * 获取风格预设的提示词前缀
   */
  getStylePrefix(styleName: string): string {
    const preset = Object.values(STYLE_PRESETS).find(
      (s) => s.name === styleName || s.nameEn.toLowerCase() === styleName.toLowerCase() || s.code === styleName
    );
    return preset?.promptPrefix || '';
  }

  /**
   * 获取风格预设的负面提示词
   */
  getStyleNegative(styleName: string): string {
    const preset = Object.values(STYLE_PRESETS).find(
      (s) => s.name === styleName || s.nameEn.toLowerCase() === styleName.toLowerCase() || s.code === styleName
    );
    return preset?.negativePrompt || '';
  }

  /**
   * 根据内容类型推荐提示词策略
   */
  recommendStrategy(contentType: ContentTypeCode): {
    imageStrategy: PromptStrategy;
    videoStrategy: VideoPromptStrategy;
  } {
    const strategyMap: Record<ContentTypeCode, { imageStrategy: PromptStrategy; videoStrategy: VideoPromptStrategy }> = {
      short_drama: { imageStrategy: 'character_reference', videoStrategy: 'fast_action' },
      education: { imageStrategy: 'standard_six_layer', videoStrategy: 'slow_narrative' },
      documentary: { imageStrategy: 'atmosphere_first', videoStrategy: 'environment_showcase' },
      marketing: { imageStrategy: 'with_style_modifiers', videoStrategy: 'character_closeup' },
      news: { imageStrategy: 'standard_six_layer', videoStrategy: 'slow_narrative' },
      general: { imageStrategy: 'standard_six_layer', videoStrategy: 'slow_narrative' },
      cyberpunk: { imageStrategy: 'with_style_modifiers', videoStrategy: 'fast_action' },
      period_drama: { imageStrategy: 'character_reference', videoStrategy: 'slow_narrative' },
      fantasy: { imageStrategy: 'atmosphere_first', videoStrategy: 'environment_showcase' },
      folk_culture: { imageStrategy: 'atmosphere_first', videoStrategy: 'slow_narrative' },
    };
    return strategyMap[contentType];
  }

  // ============================================================
  // Open-Sora 融入：提示词精炼接口
  // ============================================================

  /**
   * 构建提示词精炼请求
   * 返回 system prompt + user message，供 API 层调用 LLM
   */
  buildRefineRequest(
    mode: PromptRefineMode,
    userPrompt: string,
    imageDescription?: string,
  ): { systemPrompt: string; userMessage: string } {
    return {
      systemPrompt: getRefineSystemPrompt(mode),
      userMessage: buildRefineUserMessage(mode, userPrompt, imageDescription),
    };
  }

  /**
   * 注入运动评分信息到提示词（Open-Sora 风格）
   * 将运动评分转换为自然语言描述追加到提示词末尾
   */
  injectMotionInfo(prompt: string, motionScore: number): string {
    const label = motionScore >= 11 ? 'extremely high'
      : motionScore >= 7 ? 'high'
      : motionScore >= 5 ? 'moderate'
      : motionScore >= 3 ? 'fair'
      : motionScore >= 1 ? 'low'
      : 'very low';
    return `${prompt} The motion strength is ${label}.`;
  }

  /**
   * 注入 FPS 信息到提示词（Open-Sora 格式）
   */
  injectFpsInfo(prompt: string, fps: number): string {
    return addFpsInfoToPrompt(prompt, fps);
  }

  /**
   * 为 T2I2V 管线生成首帧提示词
   * 将视频提示词转换为适合图片生成的提示词（去掉运动相关描述）
   */
  generateT2IPrompt(videoPrompt: string): string {
    // 移除纯视频相关描述（运动、时间变化等），保留画面描述
    const videoOnlyPatterns = [
      /camera\s+(slowly\s+)?(pans?|tilts?|tracks?|moves?|zooms?)\s+\w+/gi,
      /time\s+lapse/gi,
      /the\s+video\s+shows?\s+/gi,
      /slow\s+motion/gi,
      /speed\s+up/gi,
    ];
    let result = videoPrompt;
    for (const pattern of videoOnlyPatterns) {
      result = result.replace(pattern, '');
    }
    // 清理多余空格和逗号
    result = result.replace(/,\s*,/g, ',').replace(/^\s*,|,\s*$/g, '').trim();
    return result || videoPrompt;
  }

  /**
   * 构建完整的视频生成提示词
   * 集成 Open-Sora 的评分条件化: 提示词 + 美学评分 + 运动评分 + 运镜
   */
  buildFullVideoPrompt(options: {
    prompt: string;
    refinedPrompt?: string;
    motionScore?: number;
    aestheticScore?: number;
    cameraMotion?: string;
    fps?: number;
  }): string {
    let result = options.refinedPrompt ?? options.prompt;

    // 美学评分
    if (options.aestheticScore !== undefined) {
      const label = options.aestheticScore >= 6.5 ? 'excellent'
        : options.aestheticScore >= 6 ? 'very good'
        : options.aestheticScore >= 5.5 ? 'good'
        : options.aestheticScore >= 5 ? 'fair'
        : options.aestheticScore >= 4.5 ? 'poor'
        : 'very poor';
      result += ` The aesthetic score is ${label}.`;
    }

    // 运动评分
    if (options.motionScore !== undefined) {
      result = this.injectMotionInfo(result, options.motionScore);
    }

    // 运镜
    if (options.cameraMotion) {
      result += ` camera motion: ${options.cameraMotion}.`;
    }

    // FPS
    if (options.fps) {
      result = this.injectFpsInfo(result, options.fps);
    }

    return result;
  }

  // ============================================================
  // 私有方法
  // ============================================================

  private buildImageLayers(shot: DirectorShot): ImagePromptLayers {
    return {
      layer1_subject: shot.subject || 'scene',
      layer2_action: this.inferAction(shot),
      layer3_composition: this.inferComposition(shot),
      layer4_lighting: shot.lighting || 'natural lighting',
      layer5_environment: shot.environment || '',
      layer6_style: shot.style || 'cinematic',
    };
  }

  private buildVideoLayers(shot: DirectorShot): VideoPromptLayers {
    return {
      layer1_camera: this.cameraMovementToPrompt(shot.cameraMovement),
      layer2_subject: shot.subject || 'scene',
      layer3_actionChange: this.inferActionChange(shot),
      layer4_envChange: '',
      layer5_lightChange: '',
      layer6_rhythm: this.pacingToRhythm(shot.pacing),
      layer7_style: shot.style || 'cinematic',
      layer8_techParams: '4K 30fps, smooth motion',
    };
  }

  private composeImagePrompt(layers: ImagePromptLayers, strategy: PromptStrategy): string {
    const parts: string[] = [];

    switch (strategy) {
      case 'standard_six_layer':
        parts.push(layers.layer1_subject);
        parts.push(layers.layer2_action);
        parts.push(layers.layer3_composition);
        parts.push(layers.layer4_lighting);
        parts.push(layers.layer5_environment);
        parts.push(layers.layer6_style);
        break;
      case 'with_style_modifiers':
        parts.push(layers.layer6_style);
        parts.push(layers.layer1_subject);
        parts.push(layers.layer2_action);
        parts.push(layers.layer3_composition);
        parts.push(layers.layer4_lighting);
        parts.push(layers.layer5_environment);
        break;
      case 'atmosphere_first':
        parts.push(layers.layer4_lighting);
        parts.push(layers.layer1_subject);
        parts.push(layers.layer5_environment);
        parts.push(layers.layer3_composition);
        parts.push(layers.layer2_action);
        parts.push(layers.layer6_style);
        break;
      case 'character_reference':
        parts.push(`${layers.layer1_subject}, consistent appearance`);
        parts.push(layers.layer2_action);
        parts.push(layers.layer3_composition);
        parts.push(layers.layer4_lighting);
        parts.push(layers.layer5_environment);
        parts.push(layers.layer6_style);
        break;
      case 'spatial_description':
        parts.push(layers.layer1_subject);
        parts.push(layers.layer5_environment);
        parts.push(layers.layer3_composition);
        parts.push(layers.layer2_action);
        parts.push(layers.layer4_lighting);
        parts.push(layers.layer6_style);
        break;
    }

    return parts.filter(Boolean).join(', ');
  }

  private composeVideoPrompt(layers: VideoPromptLayers, strategy: VideoPromptStrategy): string {
    const parts: string[] = [];

    switch (strategy) {
      case 'slow_narrative':
        parts.push(`slow ${layers.layer1_camera}`);
        parts.push(layers.layer2_subject);
        parts.push(layers.layer3_actionChange);
        parts.push(layers.layer7_style);
        parts.push(layers.layer8_techParams);
        break;
      case 'fast_action':
        parts.push(`dynamic ${layers.layer1_camera}`);
        parts.push(layers.layer2_subject);
        parts.push(layers.layer3_actionChange);
        parts.push(layers.layer6_rhythm);
        parts.push(layers.layer7_style);
        parts.push(layers.layer8_techParams);
        break;
      case 'environment_showcase':
        parts.push(layers.layer1_camera);
        parts.push(layers.layer4_envChange || layers.layer2_subject);
        parts.push(layers.layer5_lightChange || layers.layer4_envChange || '');
        parts.push(layers.layer7_style);
        parts.push(layers.layer8_techParams);
        break;
      case 'character_closeup':
        parts.push(`gentle ${layers.layer1_camera}`);
        parts.push(layers.layer2_subject);
        parts.push(layers.layer3_actionChange);
        parts.push(layers.layer7_style);
        parts.push('shallow depth of field');
        parts.push(layers.layer8_techParams);
        break;
      case 'time_passage':
        parts.push('static camera, time lapse');
        parts.push(layers.layer5_lightChange || 'light changing from dawn to dusk');
        parts.push(layers.layer4_envChange || '');
        parts.push(layers.layer7_style);
        parts.push(layers.layer8_techParams);
        break;
    }

    return parts.filter(Boolean).join(', ');
  }

  private inferAction(shot: DirectorShot): string {
    const movementMap: Record<string, string> = {
      static: 'still pose',
      dolly_in: 'looking toward camera',
      dolly_out: 'stepping back',
      tracking: 'walking alongside',
      pan_left: 'glancing left',
      pan_right: 'glancing right',
      tilt_up: 'looking upward',
      tilt_down: 'looking downward',
      crane_up: 'rising above',
      crane_down: 'descending',
      zoom_in: 'focused expression',
      zoom_out: 'revealing context',
      handheld: 'natural movement',
    };
    return movementMap[shot.cameraMovement] || 'in scene';
  }

  private inferActionChange(shot: DirectorShot): string {
    const pacing = shot.pacing || 'medium';
    const actionMap: Record<string, string> = {
      slow: 'subtle, gradual movement',
      medium: 'natural transition in action',
      fast: 'quick action change',
      very_fast: 'rapid, dynamic action shift',
      rhythm: 'rhythmic action variation',
      controlled: 'measured, deliberate movement',
    };
    return actionMap[pacing] || 'natural transition';
  }

  private inferComposition(shot: DirectorShot): string {
    const compositionMap: Record<string, string> = {
      ECU: 'extreme close-up, filling frame',
      CU: 'close-up shot, focused on detail',
      MCU: 'medium close-up, upper body',
      MS: 'medium shot, waist up',
      MWS: 'medium wide shot, full body visible',
      WS: 'wide shot, subject in environment',
      EWS: 'extreme wide shot, vast landscape',
      EST: 'establishing shot, panoramic view',
    };
    return compositionMap[shot.shotType] || 'medium shot';
  }

  private cameraMovementToPrompt(movement: string): string {
    const map: Record<string, string> = {
      static: 'static shot',
      dolly_in: 'camera slowly pushes in toward',
      dolly_out: 'camera pulls back revealing',
      tracking: 'camera tracks alongside',
      pan_left: 'camera pans left',
      pan_right: 'camera pans right',
      tilt_up: 'camera tilts up',
      tilt_down: 'camera tilts down',
      crane_up: 'crane shot rising above',
      crane_down: 'crane shot descending',
      zoom_in: 'slow zoom in',
      zoom_out: 'slow zoom out',
      handheld: 'handheld camera, slight shake',
    };
    return map[movement] || 'static shot';
  }

  private pacingToRhythm(pacing: string): string {
    const map: Record<string, string> = {
      slow: 'steady deliberate pace',
      medium: 'natural pace',
      fast: 'quick rhythm',
      very_fast: 'rapid pace, dynamic',
      rhythm: 'rhythmic movement',
      controlled: 'controlled, measured pace',
    };
    return map[pacing] || 'natural pace';
  }
}

/** 创建提示词工程师 */
export function createPromptEngineer(): PromptEngineer {
  return new PromptEngineer();
}
