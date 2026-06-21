/**
 * 九宫格图片生成工具
 * 生成9张连贯的图片，用于后续的图片生视频
 */

import { ImageGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export interface NineGridImage {
  index: number;
  imageUrl: string;
  prompt: string;
}

export interface NineGridResult {
  success: boolean;
  images?: NineGridImage[];
  error?: string;
}

/**
 * 生成九宫格（9张）连贯的图片
 * @param mainPrompt 主提示词
 * @param style 风格
 * @param onProgress 进度回调
 */
export async function generateNineGridImages(
  mainPrompt: string,
  options: {
    style?: string;
    mood?: string;
    size?: string;
  } = {},
  onProgress?: (progress: number, stage: string) => void
): Promise<NineGridResult> {
  try {
    onProgress?.(5, '开始生成九宫格图片...');
    
    const config = new Config();
    const client = new ImageGenerationClient(config);
    
    const images: NineGridImage[] = [];
    const { style, mood, size = '2K' } = options;
    
    // 为每张图片生成优化的提示词，确保连贯性
    const imagePrompts = generateImagePrompts(mainPrompt, style, mood);
    
    for (let i = 0; i < 9; i++) {
      const progress = 10 + (i * 10);
      onProgress?.(progress, `生成第 ${i + 1}/9 张图片...`);
      
      try {
        // 构建请求参数 - 增强多样性
        const requestParams: any = {
          prompt: imagePrompts[i],
          size: size,
          watermark: true,
          // 随机种子：每张图使用不同种子，增加变化
          seed: Date.now() + Math.random() * 1000000,
        };
        
        // 参考图片策略优化
        if (i > 0 && images[i - 1]) {
          // 使用前一张作为参考，但降低强度以保持多样性
          requestParams.reference_images = [images[i - 1].imageUrl];
          
          // 动态调整参考强度：
          // - 第2-3张：中等参考（保持连贯性）
          // - 第4-6张：低参考（允许更大变化，这是叙事高潮部分）
          // - 第7-9张：中等参考（回归一致性）
          let refStrength = 0.4; // 默认值
          if (i >= 3 && i <= 5) {
            refStrength = 0.25; // 中段降低参考，增加视觉差异
          } else if (i >= 6) {
            refStrength = 0.35; // 后段略微提高，保持收尾连贯
          }
          
          requestParams.reference_strength = refStrength;
        }
        
        const response = await client.generate(requestParams);
        const helper = client.getResponseHelper(response);
        
        if (!helper.success || !helper.imageUrls || helper.imageUrls.length === 0) {
          throw new Error(`第 ${i + 1} 张图片生成失败`);
        }
        
        images.push({
          index: i,
          imageUrl: helper.imageUrls[0],
          prompt: imagePrompts[i],
        });
        
        // 图片间添加延迟，避免配额限制
        if (i < 8) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
      } catch (imageError: any) {
        console.error(`第 ${i + 1} 张图片生成错误:`, imageError?.message || imageError);
        
        // 如果某张失败，尝试用前一张代替（如果有）
        if (i > 0 && images[i - 1]) {
          console.log(`[NineGrid] 使用第 ${i} 张图片代替第 ${i + 1} 张（容错处理）`);
          images.push({
            index: i,
            imageUrl: images[i - 1].imageUrl,
            prompt: imagePrompts[i],
          });
        } else if (i === 0) {
          // 第一张图片失败：重试一次
          console.log(`[NineGrid] 第1张图片失败，尝试重试...`);
          try {
            const retryParams: any = {
              prompt: imagePrompts[0],
              size: size,
              watermark: true,
              seed: Date.now() + Math.random() * 2000000, // 使用新种子
            };
            const retryResponse = await client.generate(retryParams);
            const retryHelper = client.getResponseHelper(retryResponse);
            
            if (retryHelper.success && retryHelper.imageUrls && retryHelper.imageUrls.length > 0) {
              console.log(`[NineGrid] 第1张图片重试成功`);
              images.push({
                index: 0,
                imageUrl: retryHelper.imageUrls[0],
                prompt: imagePrompts[0],
              });
            } else {
              throw new Error(`第 1 张图片重试仍失败: 图片API返回空结果`);
            }
          } catch (retryError: any) {
            console.error(`[NineGrid] 第1张图片重试失败:`, retryError?.message || retryError);
            throw new Error(`九宫格第1张图片生成失败（已重试）: ${retryError?.message || '图片API调用失败'}`);
          }
        } else {
          throw new Error(`第 ${i + 1} 张图片生成失败，且无备用图片`);
        }
      }
    }
    
    onProgress?.(100, '九宫格图片生成完成！');
    
    return {
      success: true,
      images,
    };
    
  } catch (error: any) {
    console.error('九宫格图片生成失败:', error);
    return {
      success: false,
      error: error.message || '九宫格图片生成失败',
    };
  }
}

/**
 * 为9张图片生成连贯的提示词（增强多样性版本）
 * 
 * 核心改进：
 * 1. 每张图使用不同的镜头语言（角度、距离、构图）
 * 2. 添加动态的动作/姿态变化
 * 3. 叙事节奏从开场到高潮再到收尾
 * 4. 保持主题一致性的同时增加视觉差异
 */
function generateImagePrompts(
  mainPrompt: string,
  style?: string,
  mood?: string
): string[] {
  const prompts: string[] = [];
  
  // 风格和情绪后缀
  const styleSuffix = style ? `, ${style} style` : '';
  const moodSuffix = mood ? `, ${mood} mood` : '';
  
  // ========== 镜头语言配置 ==========
  // 每张图的镜头设置：[镜头类型, 角度, 构图, 动作/氛围]
  const shotConfigurations: Array<{
    shotType: string;      // 镜头类型
    cameraAngle: string;   // 拍摄角度  
    composition: string;   // 构图方式
    action: string;        // 动作/动态元素
    lighting: string;      // 光线变化
    detail: string;        // 细节焦点
  }> = [
    {
      // 图1: 开场 - 远景建立场景
      shotType: 'wide establishing shot',
      cameraAngle: 'eye-level, slightly low angle',
      composition: 'rule of thirds, subject positioned left',
      action: 'static pose, introducing the scene',
      lighting: 'soft ambient light, natural daylight',
      detail: 'environment and setting details visible',
    },
    {
      // 图2: 推进 - 中景展示主体
      shotType: 'medium shot',
      cameraAngle: 'slight high angle looking down',
      composition: 'centered framing, balanced composition',
      action: 'subtle movement, beginning to engage',
      lighting: 'warm directional light from side',
      detail: 'main subject clearly visible, facial expression',
    },
    {
      // 图3: 近景 - 细节特写
      shotType: 'close-up shot',
      cameraAngle: 'eye-level intimate angle',
      composition: 'shallow depth of field, blurred background',
      action: 'gentle gesture or expression change',
      lighting: 'soft diffused light, gentle shadows',
      detail: 'emotional expression, fine details visible',
    },
    {
      // 图4: 动态 - 侧面/运动
      shotType: 'dynamic medium shot',
      cameraAngle: '45-degree side angle, Dutch tilt optional',
      composition: 'diagonal lines, dynamic framing',
      action: 'movement in progress, walking or turning',
      lighting: 'dramatic contrast, strong highlights and shadows',
      detail: 'motion blur suggestion, energy and movement',
    },
    {
      // 图5: 高潮 - 最具冲击力的画面
      shotType: 'dramatic close-up or wide climactic shot',
      cameraAngle: 'low angle hero shot or dramatic overhead',
      composition: 'symmetrical or radial composition',
      action: 'peak moment, most expressive pose or action',
      lighting: 'cinematic lighting, rim light, volumetric effects',
      detail: 'maximum visual impact, emotional peak',
    },
    {
      // 图6: 转折 - 过渡画面
      shotType: 'transitioning medium-wide shot',
      cameraAngle: 'returning to eye-level, stable',
      composition: 'leading lines guiding the eye',
      action: 'winding down from climax, reflective mood',
      lighting: 'softer lighting, golden hour warmth',
      detail: 'environment re-entering the frame',
    },
    {
      // 图7: 收敛 - 中景细节
      shotType: 'medium detail shot',
      cameraAngle: 'slight three-quarter angle',
      composition: 'negative space for breathing room',
      action: 'calm, composed, settled posture',
      lighting: 'even soft lighting, minimal shadows',
      detail: 'textural details, subtle color variations',
    },
    {
      // 图8: 回味 - 特写情感
      shotType: 'intimate close-up',
      cameraAngle: 'slight upward angle, respectful',
      composition: 'tight crop on key elements',
      action: 'final meaningful gesture or look',
      lighting: 'warm backlight, lens flare possible',
      detail: 'emotional resonance, memorable detail',
    },
    {
      // 图9: 结尾 - 完整画面
      shotType: 'final wide shot or portrait frame',
      cameraAngle: 'classic straight-on angle',
      composition: 'complete, satisfying full frame',
      action: 'resolved, complete, at peace',
      lighting: 'harmonious balanced light, bookend feel',
      detail: 'sense of completion, full story told',
    },
  ];
  
  // ========== 生成差异化提示词 ==========
  for (let i = 0; i < 9; i++) {
    const config = shotConfigurations[i];
    const imageNumber = i + 1;
    
    // 构建具有明显差异的提示词
    const prompt = [
      // 核心主题
      mainPrompt,
      
      // 镜头语言（关键差异化因素）
      `${config.shotType}, ${config.cameraAngle}`,
      
      // 构图和视觉结构
      `${config.composition}`,
      
      // 动态/动作元素
      `${config.action}`,
      
      // 光线和氛围
      `${config.lighting}, ${config.detail}`,
      
      // 叙事位置说明
      `Frame ${imageNumber} of 9: ${getNarrativeContext(i)}`,
      
      // 风格统一性（保持一致但允许自然变化）
      styleSuffix,
      moodSuffix,
      
      // 质量要求
      'high quality, detailed, cinematic',
    ].filter(Boolean).join('. ');
    
    prompts.push(prompt);
  }
  
  return prompts;
}

/**
 * 获取叙事上下文描述
 */
function getNarrativeContext(index: number): string {
  const contexts = [
    'story opening - establish the world and characters',
    'early development - introduce dynamics',
    'building connection - show relationships',
    'rising action - increase momentum',
    'climax - peak of the narrative arc',
    'falling action - transition and reflection',
    'resolution beginning - settling down',
    'near conclusion - emotional resonance',
    'final frame - complete and satisfying end',
  ];
  return contexts[index] || 'continuation';
}

/**
 * 获取用于视频生成的参考图片序列
 * 为N段视频生成准备N+1张参考图片
 */
export function getVideoReferenceImages(
  nineGridImages: NineGridImage[],
  segmentCount: number
): string[] {
  if (nineGridImages.length < 9) {
    throw new Error('需要完整的9张九宫格图片');
  }
  
  const referenceImages: string[] = [];
  
  // 如果片段数 <= 9，直接从九宫格中选取
  if (segmentCount <= 9) {
    const step = Math.floor(9 / segmentCount);
    for (let i = 0; i <= segmentCount; i++) {
      const index = Math.min(i * step, 8);
      referenceImages.push(nineGridImages[index].imageUrl);
    }
  } else {
    // 如果片段数 > 9，需要插值（重复使用某些图片）
    for (let i = 0; i <= segmentCount; i++) {
      const ratio = i / segmentCount;
      const index = Math.min(Math.floor(ratio * 9), 8);
      referenceImages.push(nineGridImages[index].imageUrl);
    }
  }
  
  return referenceImages;
}
