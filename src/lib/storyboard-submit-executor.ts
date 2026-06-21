import { updateTaskProgress, completeTask, failTask } from '@/lib/task-manager';
import { aiService, type ImageGenResult } from '@/lib/ai-service-adapter';
import { DegradeError } from '@/lib/model-router';
import type { Storyboard, StoryboardShot } from '@/types/storyboard';
import { sanitizePromptForMiniMax, checkPromptSensitivity } from '@/lib/storyboard-generator';
import { throwStoryboardVideoPathDisabled } from '@/lib/video-generation-path-guidance';
import {
  getStoryboardStorageClient,
  storyboardSpeechSynthesizer,
  storyboardVideoEditor,
} from '@/lib/storyboard-media-clients';
import { v4 as uuidv4 } from 'uuid';
import { SFX_LIBRARY, getSfxById, type SfxId, type SfxBinding } from '@/constants/sfx-types';
import { generateSrtEntries, serializeSrt } from '@/lib/video-post-processing';
import {
  STORYBOARD_BGM_MAP as BGM_MAP,
  STORYBOARD_BGM_TTS_PROMPTS as BGM_TTS_PROMPTS,
  STORYBOARD_VOICE_MAP as VOICE_MAP,
  WORKING_STORYBOARD_SPEAKER as WORKING_SPEAKER,
  allocateGlobalNineGridToShots,
  getFirstFrameForShot,
  splitSubtitleText,
} from '@/lib/storyboard-submit-helpers';
import { generateTimingDescriptions } from '@/lib/storyboard-submit-video-planning';
import { PRESET_BGM_MAP } from '@/lib/bgm-manager';

async function generateNineGridImages(
  shot: StoryboardShot,
  shotIndex: number,
  previousLastFrame?: string,
  qualityMode: string = 'balanced' // ★ 新增优化模式参数
): Promise<string[]> {
  console.log(`[Storyboard] 生成分镜头 ${shotIndex + 1} 的多角度参考图片...`);
  // 使用特殊分隔符存储多张图片
  const IMAGE_SEP = '|||IMAGE_SEP|||';
  
  console.log(`[Storyboard] 分镜头 ${shotIndex + 1} 配置:`, {
    hasReferenceImage: !!shot.referenceImage,
    useReferenceAsNineGrid: shot.useReferenceAsNineGrid,
    referenceImageCount: shot.referenceImage ? shot.referenceImage.split(IMAGE_SEP).length : 0
  });
  
  // 如果启用了"使用参考图片代替九宫格"模式
  if (shot.useReferenceAsNineGrid && shot.referenceImage) {
    const userImages = shot.referenceImage.split(IMAGE_SEP);
    
    if (userImages.length >= 9) {
      // 用户已上传9张图片，直接使用
      console.log(`[Storyboard] 使用用户上传的9张图片`);
      return userImages.slice(0, 9);
    } else {
      // 用户上传了少于9张图片，基于这些图片生成连贯的9张
      console.log(`[Storyboard] 基于用户上传的${userImages.length}张图片生成连贯参考图片(模式=${qualityMode})`);
      return await generateFromUserImages(shot, userImages, shotIndex, qualityMode);
    }
  }
  
  // 原来的逻辑：基于提示词生成九宫格
  const images: string[] = [];
  
  // 确定基础参考图片：优先使用用户上传的referenceImage，否则使用前一段的lastFrame
  const baseReferenceImage = shot.referenceImage || previousLastFrame;
  const hasReferenceImage = !!baseReferenceImage;
  
  const imageCountMap: Record<string, number> = { fast: 2, balanced: 4, quality: 9 };
  const imageCount = imageCountMap[qualityMode] || 4;
  console.log(`[Storyboard] 优化模式=${qualityMode}, 每镜头生成${imageCount}张参考图片`);

  // 生成关键帧参考图片
  for (let i = 0; i < imageCount; i++) {
    let enhancedPrompt = shot.prompt;
    
    // 根据是否有参考图片采用不同的prompt策略
    if (hasReferenceImage) {
      // 有参考图片：与参考图保持连贯
      if (i === 0 && previousLastFrame) {
        enhancedPrompt = `${shot.prompt}，与参考图风格和内容保持连贯过渡，视觉元素一致`;
      }
      if (i > 0) {
        enhancedPrompt = `${shot.prompt}，动作和场景的第${i + 1}阶段，与前一张图片保持连贯`;
      }
    } else {
      const timingDescriptions = generateTimingDescriptions(imageCount);

      // 添加风格指导确保整体一致性
      const styleGuide = i === 0
        ? '。建立整体视觉风格和色调'
        : i === imageCount - 1
          ? '。最终画面，稳定清晰'
          : '。保持与之前画面风格、构图、光线一致';

      enhancedPrompt = `${shot.prompt}${timingDescriptions[i]}${styleGuide}`;

      if (i === Math.floor(imageCount / 2)) {
        enhancedPrompt += '。这是中间关键帧，起到承上启下的作用';
      }
      if (i === imageCount - 2) {
        enhancedPrompt += '。后期关键帧，为结尾做铺垫';
      }
    }
    
    // 调用图片生成API
    // 确定是否在此帧使用参考图（仅在有参考图且是关键帧时使用）
    const useReferenceAtThisFrame = hasReferenceImage && (
      i === 0 ||  // 第一张必须使用
      i === 3 ||  // 第四张使用，保持中期连贯
      i === 6     // 第七张使用，保持后期连贯
    );
    
    // ===== 提示词安全过滤 v2.0 =====
    let safePrompt = enhancedPrompt;
    const sensitivityCheck = checkPromptSensitivity(enhancedPrompt);
    if (sensitivityCheck.isSensitive) {
      const sanitizationResult = sanitizePromptForMiniMax(enhancedPrompt);
      safePrompt = sanitizationResult.sanitized;
      console.log(`[Storyboard] 分镜头${shotIndex + 1} 第${i+1}张图片提示词已过滤v2.0: 风险=${sanitizationResult.riskScore}/${sanitizationResult.riskLevel}, ${sanitizationResult.details.length}项替换`);
    }
    
    // 单张图片重试逻辑
    const MAX_SINGLE_IMAGE_RETRIES = 2;
    let imageGenerated = false;
    
    for (let imgAttempt = 0; imgAttempt <= MAX_SINGLE_IMAGE_RETRIES && !imageGenerated; imgAttempt++) {
      try {
        if (imgAttempt > 0) {
          await new Promise(r => setTimeout(r, 2000 * imgAttempt));
          console.log(`[Storyboard] 🔄 重试分镜头${shotIndex + 1}第${i+1}张图片 (${imgAttempt + 1}/${MAX_SINGLE_IMAGE_RETRIES + 1})`);
        }
        
        const result = await aiService.generateImage({
          prompt: imgAttempt > 0 ? sanitizePromptForMiniMax(safePrompt).sanitized : safePrompt,
          model: 'image-01',
          width: 16,
          height: 9,
          n: 1,
          style: 'default',
        });
        
        if (result.data.url) {
          images.push(result.data.url);
          imageGenerated = true;
          if (result.degraded) {
            console.log(`[Storyboard] 图片生成已降级: ${result.originalProvider} → ${result.provider}`);
          }
        } else {
          throw new Error(`返回的图像URL列表为空`);
        }
      } catch (imgError: any) {
        const imgErrorMsg = imgError?.message || String(imgError);
        const isRetryable = imgErrorMsg.includes('1033') || imgErrorMsg.includes('服务内部异常') 
          || imgErrorMsg.includes('无法从响应中获取') || imgErrorMsg.includes('图像URL');
        
        if (imgAttempt < MAX_SINGLE_IMAGE_RETRIES && isRetryable) {
          console.warn(`[Storyboard] ⚠️ 分镜头${shotIndex + 1}第${i+1}张失败(${imgErrorMsg.substring(0,60)})，重试...`);
          continue;
        }
        throw new Error(`分镜头${shotIndex + 1}的第${i + 1}张图片生成失败: ${imgErrorMsg}`);
      }
    }
    
    // 稍作延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`[Storyboard] 分镜头 ${shotIndex + 1} 九宫格生成完成`);
  
  return images;
}

// 基于用户上传的图片生成连贯的参考图片（★ 优化：根据质量模式动态调整数量）
async function generateFromUserImages(
  shot: StoryboardShot,
  userImages: string[],
  shotIndex: number,
  qualityMode: string = 'balanced' // ★ 新增优化模式参数
): Promise<string[]> {
  const images: string[] = [];
  const baseReferenceImage = userImages[0]; // 使用第一张作为基础参考

  // 填充已有图片
  images.push(...userImages);

  // ★ 根据优化模式决定需要生成的剩余图片数
  const imageCountMap: Record<string, number> = { fast: 2, balanced: 4, quality: 9 };
  const targetCount = imageCountMap[qualityMode] || 4;
  const remainingCount = Math.max(0, targetCount - userImages.length);
  
  for (let i = 0; i < remainingCount; i++) {
    const currentIndex = userImages.length + i;
    let enhancedPrompt = shot.prompt;
    
    // 为每张图片添加时序描述
    const timingDescriptions = [
      '，初始状态，画面开始',
      '，动作开始展开',
      '，动作进行中',
      '，动作接近高潮',
      '，动作高潮时刻',
      '，动作开始回落',
      '，动作接近结束',
      '，动作收尾阶段',
      '，最终状态，画面定格'
    ];
    
    enhancedPrompt += timingDescriptions[currentIndex];
    
    // 基于第一张用户图片生成，确保风格一致
    const useReferenceAtThisFrame = 
      currentIndex === 0 || 
      currentIndex === 3 || 
      currentIndex === 6;
    
    // 调用图片生成API（自动降级: Minimax → Coze）
    const imgResult = await aiService.generateImage({
      prompt: enhancedPrompt,
      model: 'image-01',
      width: 16,
      height: 9,
      n: 1,
      style: 'default',
    });
    
    if (imgResult.data.url) {
      images.push(imgResult.data.url);
      if (imgResult.degraded) {
        console.log(`[Storyboard] 补充图片已降级: ${imgResult.originalProvider} → ${imgResult.provider}`);
      }
    } else {
      throw new Error(`分镜头${shotIndex + 1}的补充图片生成失败`);
    }
    
    // 稍作延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return images;
}

// 生成分镜头视频
async function generateShotVideo(
  shot: StoryboardShot,
  nineGridImages: string[],
  shotIndex: number,
  audioEnabled?: boolean,
  audioPrompt?: string,
  subtitleEnabled?: boolean,
  subtitlePrompt?: string
): Promise<{ videoUrl: string; lastFrameUrl?: string }> {
  console.log(`[Storyboard] 生成分镜头 ${shotIndex + 1} 的视频...`);
  console.log(`[Storyboard] 音频启用: ${audioEnabled}, 字幕启用: ${subtitleEnabled}`);
  
  // 使用九宫格的第一张图片作为首帧
  const firstFrameImage = nineGridImages[0];
  
  if (!firstFrameImage) {
    throw new Error(`分镜头${shotIndex + 1}的九宫格图片为空，无法生成视频`);
  }

  // ===== 提示词安全过滤（防止触发 MiniMax 内容审核 code=1026）=====
  let prompt = shot.prompt;
  const sensitivityCheck = checkPromptSensitivity(prompt);
  
  if (sensitivityCheck.isSensitive) {
    console.log(`[Storyboard] ⚠️ 分镜头${shotIndex + 1} 提示词检测到${sensitivityCheck.detectedWords.length}个潜在敏感词 (风险: ${sensitivityCheck.riskLevel}):`);
    sensitivityCheck.detectedWords.forEach(d => {
      console.log(`  - "${d.word}" → 建议: "${d.suggestion}"`);
    });
    
    // 自动过滤敏感词 v2.0
    const sanitResult = sanitizePromptForMiniMax(prompt);
    if (sanitResult.isModified) {
      console.log(`[Storyboard] ✅ 已自动过滤提示词v2.0, 风险=${sanitResult.riskScore}, 原长度:${prompt.length} → 过滤后:${sanitResult.sanitized.length}`);
      prompt = sanitResult.sanitized;
    }
  }
  
  // 先生成视频（不包含音频，音频后续单独处理）
  console.log(`[Storyboard] 开始生成视频 (首帧图: ${firstFrameImage.substring(0, 60)}...)`);
  
  const MAX_VIDEO_RETRIES = 2; // 最大重试次数
  
  for (let videoAttempt = 0; videoAttempt <= MAX_VIDEO_RETRIES; videoAttempt++) {
    try {
      if (videoAttempt > 0) {
        const delay = 3000 * videoAttempt; // 递增延迟：3s, 6s
        console.log(`[Storyboard] 🔄 第${videoAttempt + 1}次重试生成视频 (${delay}ms后)...`);
        await new Promise(r => setTimeout(r, delay));
        
        // 如果是1026错误后的重试，再次过滤提示词
        if (videoAttempt === 1) {
          prompt = sanitizePromptForMiniMax(prompt).sanitized;
          console.log(`[Storyboard] 重试前二次过滤提示词`);
        }
      }
      
      throwStoryboardVideoPathDisabled(`storyboard submit shot ${shotIndex + 1} video generation`);
      
    } catch (genError: any) {
      const errorMsg = genError?.message || String(genError);
      console.error(`[Storyboard] ❌ 分镜头${shotIndex + 1}视频生成失败 (尝试 ${videoAttempt + 1}/${MAX_VIDEO_RETRIES + 1}):`);
      console.error(`[Storyboard] ❌ 错误信息: ${errorMsg}`);
      
      // 判断是否可重试
      const isRetryable = errorMsg.includes('1033') || errorMsg.includes('服务内部异常') || errorMsg.includes('内容审核');
      
      if (videoAttempt < MAX_VIDEO_RETRIES && isRetryable) {
        console.log(`[Storyboard] ⏳ 错误可重试，准备第${videoAttempt + 2}次尝试...`);
        continue; // 继续重试
      }
      
      // 不可重试或已耗尽重试次数
      throw new Error(`分镜头${shotIndex + 1}视频生成失败: ${errorMsg}`);
    }
  }
  
  // 不应该到达这里，但 TypeScript 需要
  throw new Error(`分镜头${shotIndex + 1}视频生成失败: 重试耗尽`);
}

// 使用云端编辑服务合并多个视频（仅合并，不处理字幕，字幕在Stage 4统一处理）
async function mergeVideos(videoUrls: string[]): Promise<string> {
  console.log('[Storyboard] 合并视频，视频数量:', videoUrls.length);

  if (videoUrls.length === 0) {
    throw new Error('没有视频可合并');
  }

  if (videoUrls.length === 1) {
    console.log('[Storyboard] 只有一个视频，直接返回');
    return videoUrls[0];
  }

  try {
    console.log('[Storyboard] 开始使用云端编辑服务合并视频...');

    const response = await storyboardVideoEditor.concatVideos(videoUrls, {
      urlExpire: 7 * 24 * 60 * 60, // 7天有效期
    });

    console.log('[Storyboard] 云端合并完成，URL:', response.url);

    if (!response.url) {
      throw new Error('视频合并失败，未获取到合并后的视频URL');
    }

    const mergedVideoUrl = response.url;

    // 尝试转存到对象存储
    const storageClient = getStoryboardStorageClient();
    if (storageClient) {
      try {
        const fileKey = await storageClient.uploadFromUrl({
          url: mergedVideoUrl,
          timeout: 120000,
        });
        
        const signedUrl = await storageClient.generatePresignedUrl({
          key: fileKey,
          expireTime: 7 * 24 * 60 * 60,
        });
        
        console.log('[Storyboard] 视频已转存到对象存储');
        return signedUrl;
      } catch (storageError) {
        console.warn('[Storyboard] 转存失败，直接返回云端URL:', storageError);
        return mergedVideoUrl;
      }
    } else {
      return mergedVideoUrl;
    }
  } catch (mergeError) {
    console.error('[Storyboard] 视频合并失败:', mergeError);
    throw mergeError;
  }
}

// 在后台执行分镜头任务
export async function executeStoryboardTask(
  taskId: string,
  storyboard: Storyboard,
  audioEnabled: boolean,
  audioPrompt?: string,
  subtitleEnabled?: boolean,
  subtitlePrompt?: string,
  backgroundBgm?: string, // 背景音乐类型
  customAudio?: { url: string; name: string }, // 自定义音频
  libraryTrack?: { id: string; title: string; artist: string; url: string; duration: number }, // ★ 音乐库曲目
  globalNineGridImages?: string[], // 全局九宫格图片（新增参数）
  qualityMode?: string, // ★ 优化模式: 'fast'(2张) | 'balanced'(4张) | 'quality'(9张)
  sfxConfig?: { enabled: boolean; mode: string; bindings: SfxBinding[]; globalVolume: number } // ★ 特效音配置
) {
  try {
    const startTime = Date.now();
    console.log('[Storyboard] ========== 开始执行分镜头任务 ==========');
    console.log('[Storyboard] taskId:', taskId);
    console.log('[Storyboard] 分镜头数:', storyboard.shots.length);
    console.log('[Storyboard] 音频: enabled=', audioEnabled, 'prompt=', (audioPrompt || '').substring(0, 100));
    console.log('[Storyboard] 字幕: enabled=', subtitleEnabled, 'prompt=', (subtitlePrompt || '').substring(0, 100));
    console.log('[Storyboard] BGM:', backgroundBgm, 'customAudio:', customAudio?.url ? '有' : '无', 'libraryTrack:', libraryTrack?.title || '无');
    console.log('[Storyboard] 九宫格图片:', globalNineGridImages?.length || 0, '张');
    console.log('[Storyboard] 优化模式:', qualityMode || 'balanced');
    console.log('[Storyboard] 特效音:', sfxConfig?.enabled ? `启用(${sfxConfig.mode}, ${sfxConfig.bindings?.length || 0}个绑定)` : '关闭');
    console.log('[Storyboard] 云端视频编辑服务已初始化:', !!storyboardVideoEditor);
    console.log('[Storyboard] 语音合成服务已初始化:', !!storyboardSpeechSynthesizer);

    // 诊断：验证关键依赖
    if (!storyboardVideoEditor) {
      throw new Error('云端视频编辑服务未初始化，无法进行视频编辑操作');
    }
    
    const hasBgm = backgroundBgm && backgroundBgm !== 'none';
    const hasVoiceNarration = audioEnabled && !!audioPrompt?.trim();

    // ★ 无音频兜底：当未配置任何音频时，自动添加默认轻柔BGM，确保视频不会静音输出
    let effectiveBackgroundBgm: string = backgroundBgm || 'relaxed';
    let effectiveHasBgm = hasBgm;
    if (!hasVoiceNarration && !hasBgm) {
      effectiveBackgroundBgm = 'relaxed';
      effectiveHasBgm = true;
      console.log('[Storyboard] ⚠️ 未配置任何音频，将自动补充默认轻柔BGM(relaxed)确保非静音输出');
    }

    if (!storyboardSpeechSynthesizer && (audioEnabled || effectiveHasBgm)) {
      throw new Error('语音合成服务未初始化，但需要生成音频');
    }
    
    const updatedShots = [...storyboard.shots];
    const allVideoUrls: string[] = [];
    let previousLastFrame: string | undefined = undefined;
    
    // ========== 阶段0：全局九宫格分配 ==========
    console.log(`[Storyboard] [阶段0] 开始 (耗时: ${Date.now()-startTime}ms)`);
    let nineGridAllocation: Map<number, string[]> = new Map();
    
    if (globalNineGridImages && globalNineGridImages.length > 0) {
      // 使用全局九宫格模式：将9张图片分配给所有分镜头
      console.log('[Storyboard] ========== 使用全局九宫格模式 ==========');
      nineGridAllocation = allocateGlobalNineGridToShots(globalNineGridImages, storyboard.shots);
      console.log('[Storyboard] 九宫格分配完成，共', nineGridAllocation.size, '个分镜头获得图片');
    } else {
      console.log('[Storyboard] ========== 使用传统九宫格模式（每段独立生成）==========');
    }
    
    // 阶段1：为每个分镜头生成视频
    console.log(`[Storyboard] [阶段1] 开始逐镜头视频生成 (耗时: ${Date.now()-startTime}ms, 镜头数: ${storyboard.shots.length})`);
    for (let i = 0; i < storyboard.shots.length; i++) {
      const shot = storyboard.shots[i];
      
      updateTaskProgress(
        taskId, 
        5 + (i / storyboard.shots.length) * 85, 
        `正在处理分镜头 ${i + 1}/${storyboard.shots.length}...`
      );
      
      try {
        let nineGridImages: string[];
        
        if (nineGridAllocation.has(i)) {
          // 使用全局九宫格分配的图片
          nineGridImages = nineGridAllocation.get(i)!;
          console.log(`[Storyboard] 分镜头 ${i + 1}: 使用全局九宫格中的 ${nineGridImages.length} 张图片`);
          
          // 确保首尾帧衔接
          const firstFrameUrl = getFirstFrameForShot(i, previousLastFrame, nineGridImages);
          updatedShots[i] = {
            ...updatedShots[i],
            firstFrameUrl: firstFrameUrl,
            nineGridImages: nineGridImages,
            status: 'images_generated'
          };
        } else {
          // 传统模式：每个分镜头独立生成九宫格
          updateTaskProgress(
            taskId, 
            5 + (i / storyboard.shots.length) * 85, 
            `正在处理分镜头 ${i + 1}/${storyboard.shots.length}：生成九宫格图片...`
          );
          
          nineGridImages = await generateNineGridImages(shot, i, previousLastFrame, qualityMode);
          
          updatedShots[i] = {
            ...updatedShots[i],
            nineGridImages: nineGridImages,
            status: 'images_generated'
          };
        }
        
        // 更新任务进度
        updateTaskProgress(
          taskId, 
          5 + (i / storyboard.shots.length) * 85 + 20, 
          `正在处理分镜头 ${i + 1}/${storyboard.shots.length}：生成视频...`
        );
        
        // 生成视频（不生成音频，音频在最后统一处理）
        console.log(`[Storyboard] [阶段1] 镜头${i+1}: 调用generateShotVideo (九宫格${nineGridImages.length}张)`);
        
        // 防护：确保九宫格图片非空
        if (!nineGridImages || nineGridImages.length === 0) {
          throw new Error(`分镜头${i + 1}的九宫格图片为空，无法生成视频`);
        }
        
        const { videoUrl, lastFrameUrl } = await generateShotVideo(
          updatedShots[i],
          nineGridImages,
          i,
          false, // audioEnabled = false，暂时不生成音频
          undefined, // audioPrompt
          false, // subtitleEnabled = false，暂时不添加字幕
          undefined // subtitlePrompt
        );
        
        console.log(`[Storyboard] [阶段1] 镜头${i+1}: ✅ 视频生成成功! URL=${videoUrl?.substring(0, 80)}`);
        
        updatedShots[i] = {
          ...updatedShots[i],
          videoUrl: videoUrl,
          lastFrameUrl: lastFrameUrl,
          status: 'video_generated'
        };
        
        allVideoUrls.push(videoUrl);
        
        // 关键：保存当前段的尾帧，作为下一段的首帧
        previousLastFrame = lastFrameUrl;
        console.log(`[Storyboard] 分镜头 ${i + 1}: 尾帧已保存，用于下一段首帧衔接`);
        
      } catch (shotError) {
        console.error(`[Storyboard] 分镜头 ${i + 1} 处理失败:`, shotError);
        updatedShots[i] = {
          ...updatedShots[i],
          status: 'failed',
          error: shotError instanceof Error ? shotError.message : '处理失败'
        };
      }
    }
    
    // 阶段1完成日志
    console.log(`[Storyboard] [阶段1] 完成! 耗时: ${Date.now()-startTime}ms`);
    console.log(`[Storyboard] [阶段1] 成功视频数: ${allVideoUrls.length}/${storyboard.shots.length}`);
    console.log(`[Storyboard] [阶段1] 各镜头状态:`);
    updatedShots.forEach((s, idx) => {
      console.log(`[Storyboard] [阶段1]   镜头${idx+1}: status=${s.status} ${s.error ? 'error='+s.error : ''} video=${s.videoUrl ? '有' : '无'}`);
    });
    
    updateTaskProgress(taskId, 92, '所有分镜头处理完成，开始合并视频...');
    
    // 阶段2：合并所有分镜头视频
    console.log(`[Storyboard] [阶段2] 开始合并视频 (耗时: ${Date.now()-startTime}ms, 视频数: ${allVideoUrls.length})`);
    let finalVideoUrl = '';
    try {
      if (allVideoUrls.length > 0) {
        console.log('[Storyboard] [阶段2] 调用mergeVideos, 首个URL:', allVideoUrls[0]?.substring(0, 80));
        finalVideoUrl = await mergeVideos(allVideoUrls);
        console.log('[Storyboard] [阶段2] ✅ 合并成功! URL:', finalVideoUrl?.substring(0, 100));
      } else {
        console.error('[Storyboard] [阶段2] ❌ 无可用视频可合并!');
      }
    } catch (mergeError) {
      console.error('[Storyboard] [阶段2] ❌ 合并异常:', mergeError instanceof Error ? mergeError.message : mergeError);
      console.error('[Storyboard] [阶段2] 堆栈:', mergeError instanceof Error ? mergeError.stack : 'N/A');
      if (allVideoUrls.length > 0) {
        finalVideoUrl = allVideoUrls[allVideoUrls.length - 1];
        console.log('[Storyboard] [阶段2] ⚠️ 使用最后一个视频作为后备');
      }
    }

    // 阶段2完成日志
    console.log(`[Storyboard] [阶段2] 完成! 耗时: ${Date.now()-startTime}ms, 最终URL: ${finalVideoUrl?.substring(0, 100) || '空!'}`);

    // ========== 阶段3：音频处理（语音旁白 + 背景音乐，支持同时存在） ==========
    
    // 防护：如果最终视频URL为空，跳过后续所有处理
    if (!finalVideoUrl) {
      console.error('[Storyboard] [阶段3] ❌ finalVideoUrl为空! 跳过音频和字幕处理');
      console.error('[Storyboard] [阶段3] 可能原因: 所有镜头视频生成失败 或 合并失败');
      
      // 尝试使用最后一个成功生成的视频
      if (allVideoUrls.length > 0) {
        finalVideoUrl = allVideoUrls[allVideoUrls.length - 1];
        console.log(`[Storyboard] [阶段3] ⚠️ 使用后备视频: ${finalVideoUrl.substring(0, 80)}`);
      } else {
        // 真的没有可用视频，直接标记任务失败
        console.error('[Storyboard] [阶段3] ❌ 无任何可用视频，任务失败');
        
        updateTaskProgress(taskId, 100, '视频生成失败：无可用视频片段');
        
        completeTask(taskId, {
          videoUrl: '',
          isStoryboard: true,
          storyboardId: storyboard.id,
          totalShots: storyboard.shots.length,
          totalDuration: storyboard.totalDuration,
          shots: updatedShots.map(shot => ({
            id: shot.id,
            index: shot.index,
            prompt: shot.prompt,
            duration: shot.duration,
            nineGridImages: shot.nineGridImages,
            videoUrl: shot.videoUrl,
            lastFrameUrl: shot.lastFrameUrl,
            status: shot.status,
            error: shot.error
          }))
        });
        
        console.log('[Storyboard] 分镜头任务因无视频而终止:', taskId);
        return; // 提前退出，不执行后续阶段
      }
    }
    
    console.log(`[Storyboard] [阶段3] 音频处理开始 (耗时: ${Date.now()-startTime}ms)`);
    console.log(`[Storyboard] [阶段3] 当前视频URL: ${finalVideoUrl?.substring(0, 100)}`);
    console.log(`[Storyboard] [阶段3] 语音旁白: enabled=${audioEnabled}, prompt长度=${audioPrompt?.length || 0}`);
    console.log(`[Storyboard] [阶段3] 背景音乐: type=${backgroundBgm}`);

    let voiceAudioUri: string | null = null;
    let bgmAudioUri: string | null = null;
    let audioProcessingSuccess = false;

    if (hasVoiceNarration || effectiveHasBgm) {
      updateTaskProgress(taskId, 94, '正在准备音频...');

      // --- 预生成所有音频源 ---

      // 3a-pre: 生成语音旁白（如果启用）
      if (hasVoiceNarration) {
        updateTaskProgress(taskId, 941, '正在生成语音旁白...');
        try {
          console.log('[Storyboard] [音频-语音] TTS请求: text长度=', audioPrompt!.length, ', speaker=zh_female_xiaohe_uranus_bigtts');
          const voiceConfig = VOICE_MAP['zh'] || VOICE_MAP['zh'];
          const ttsResponse = await storyboardSpeechSynthesizer.synthesize({
            uid: uuidv4(),
            text: audioPrompt!,
            speaker: voiceConfig.female,
            audioFormat: 'mp3',
            sampleRate: 24000,
            speechRate: 0,
          });
          console.log('[Storyboard] [音频-语音] TTS原始响应:', JSON.stringify(ttsResponse).substring(0, 300));

          if (ttsResponse.audioUri) {
            voiceAudioUri = ttsResponse.audioUri;
            console.log('[Storyboard] [音频-语音] ✅ 成功! URI=', voiceAudioUri.substring(0, 120), 'size=', ttsResponse.audioSize || 'unknown');
            // 验证URI格式
            if (!voiceAudioUri.startsWith('http') && !voiceAudioUri.startsWith('cos://') && !voiceAudioUri.startsWith('data:')) {
              console.warn('[Storyboard] [音频-语音] ⚠️ URI格式异常:', voiceAudioUri.substring(0, 50));
            }
          } else {
            console.error('[Storyboard] [音频-语音] ❌ TTS响应无audioUri字段! 完整响应:', JSON.stringify(ttsResponse).substring(0, 500));
          }
        } catch (e) {
          console.error('[Storyboard] [音频-语音] ❌ TTS合成异常:', e instanceof Error ? e.message : e);
          console.error('[Storyboard] [音频-语音] 堆栈:', e instanceof Error ? e.stack : 'N/A');
        }
      } else {
        console.log('[Storyboard] [音频-语音] 跳过 (未启用或无prompt)');
      }

      // 3b-pre: 准备背景音乐（如果启用）
      if (effectiveHasBgm) {
        updateTaskProgress(taskId, 942, '正在准备背景音乐...');
        try {
          console.log(`[Storyboard] [音频-BGM] BGM类型: ${effectiveBackgroundBgm}`);

          if (effectiveBackgroundBgm === 'custom' && customAudio?.url) {
            bgmAudioUri = customAudio.url;
            console.log('[Storyboard] [音频-BGM] ✅ 自定义BGM:', bgmAudioUri.substring(0, 100));
          } else if (effectiveBackgroundBgm === 'library' && libraryTrack?.url) {
            // ★ 音乐库曲目：直接使用曲目的URL
            bgmAudioUri = libraryTrack.url;
            console.log('[Storyboard] [音频-BGM] ✅ 音乐库曲目:', libraryTrack.title, '-', bgmAudioUri.substring(0, 100));
          } else {
            // 策略：优先使用TTS生成环境音（内部URI，最可靠）
            const bgmPrompt = BGM_TTS_PROMPTS[effectiveBackgroundBgm] || BGM_MAP[effectiveBackgroundBgm];
            if (bgmPrompt) {
              console.log(`[Storyboard] [音频-BGM] TTS环境音prompt: "${bgmPrompt.substring(0, 80)}"`);
              try {
                const bgmTtsResp = await storyboardSpeechSynthesizer.synthesize({
                  uid: uuidv4(),
                  text: bgmPrompt,
                  speaker: 'zh_female_xiaohe_uranus_bigtts',
                  audioFormat: 'mp3',
                  sampleRate: 24000,
                  speechRate: 0,
                });
                console.log('[Storyboard] [音频-BGM] TTS原始响应:', JSON.stringify(bgmTtsResp).substring(0, 300));
                if (bgmTtsResp.audioUri) {
                  bgmAudioUri = bgmTtsResp.audioUri;
                  console.log('[Storyboard] [音频-BGM] ✅ TTS环境音成功:', bgmAudioUri.substring(0, 120));
                } else {
                  console.warn('[Storyboard] [音频-BGM] ⚠️ TTS环境音无audioUri');
                }
              } catch (ttsErr) {
                console.error('[Storyboard] [音频-BGM] ❌ TTS环境音失败:', ttsErr instanceof Error ? ttsErr.message : ttsErr);
              }
            }

            // 如果TTS失败，尝试SoundHelix预置URL作为最后手段
            if (!bgmAudioUri) {
              const preset = PRESET_BGM_MAP[effectiveBackgroundBgm];
              if (preset && preset.urls.length > 0) {
                const selectedUrl = preset.urls[Math.floor(Math.random() * preset.urls.length)];
                bgmAudioUri = selectedUrl;
                console.log(`[Storyboard] [音频-BGM] ⚠️ 使用SoundHelix后备URL(${preset.name}):`, selectedUrl);
              }
            }
          }
        } catch (e) {
          console.error('[Storyboard] [音频-BGM] ❌ BGM准备异常:', e instanceof Error ? e.message : e);
        }
      }

      // --- 执行音频合并（两步顺序合并实现混音） ---

      // Step 1: 合并语音旁白（替换原始视频音频）
      if (voiceAudioUri) {
        updateTaskProgress(taskId, 95, '正在合并语音旁白...');
        try {
          console.log(`[Storyboard] [音频-Step1] compileVideoAudio调用:`);
          console.log(`[Storyboard] [音频-Step1]   video: ${finalVideoUrl?.substring(0, 80)}`);
          console.log(`[Storyboard] [音频-Step1]   audio: ${voiceAudioUri.substring(0, 80)}`);
          console.log(`[Storyboard] [音频-Step1]   isAudioReserve=false (替换原声)`);

          const voiceResult = await storyboardVideoEditor.compileVideoAudio(
            finalVideoUrl, voiceAudioUri,
            { isVideoAudioSync: false, isAudioReserve: false }
          );

          console.log(`[Storyboard] [音频-Step1] 响应:`, JSON.stringify(voiceResult).substring(0, 300));

          if (voiceResult.url) {
            finalVideoUrl = voiceResult.url;
            console.log('[Storyboard] [音频-Step1] ✅ 语音合并成功! 新video=', finalVideoUrl.substring(0, 80));
          } else {
            console.error('[Storyboard] [音频-Step1] ❌ 响应无URL字段! 完整响应:', JSON.stringify(voiceResult));
          }
        } catch (e) {
          console.error('[Storyboard] [音频-Step1] ❌ compileVideoAudio异常:', e instanceof Error ? e.message : e);
          console.error('[Storyboard] [音频-Step1] 堆栈:', e instanceof Error ? e.stack : 'N/A');
          // 继续执行，不中断整个流程
        }
      }

      // Step 2: 叠加背景音乐（保留已有语音轨道，混入BGM）
      if (bgmAudioUri) {
        updateTaskProgress(taskId, 96, '正在叠加背景音乐...');
        try {
          const preserveVoice = !!voiceAudioUri;
          console.log(`[Storyboard] [音频-Step2] compileVideoAudio调用:`);
          console.log(`[Storyboard] [音频-Step2]   video: ${finalVideoUrl?.substring(0, 80)}`);
          console.log(`[Storyboard] [音频-Step2]   audio: ${bgmAudioUri.substring(0, 80)}`);
          console.log(`[Storyboard] [音频-Step2]   isAudioReserve=${preserveVoice} (${preserveVoice ? '混音模式' : '替换模式'})`);

          const bgmResult = await storyboardVideoEditor.compileVideoAudio(
            finalVideoUrl, bgmAudioUri,
            { isVideoAudioSync: false, isAudioReserve: preserveVoice }
          );

          console.log(`[Storyboard] [音频-Step2] 响应:`, JSON.stringify(bgmResult).substring(0, 300));

          if (bgmResult.url) {
            finalVideoUrl = bgmResult.url;
            audioProcessingSuccess = true;
            console.log('[Storyboard] [音频-Step2] ✅ BGM叠加成功! 最终video=', finalVideoUrl.substring(0, 80), preserveVoice ? '(语音+BGM共存)' : '(仅BGM)');
          } else {
            console.error('[Storyboard] [音频-Step2] ❌ 响应无URL字段! 完整响应:', JSON.stringify(bgmResult));
          }
        } catch (e) {
          console.error('[Storyboard] [音频-Step2] ❌ compileVideoAudio异常:', e instanceof Error ? e.message : e);
          console.error('[Storyboard] [音频-Step2] 堆栈:', e instanceof Error ? e.stack : 'N/A');
        }
      } else if (voiceAudioUri) {
        // 只有语音没有BGM，Step1已成功
        audioProcessingSuccess = true;
      }

      // 音频处理总结
      console.log('[Storyboard] [阶段3] ========== 音频处理总结 ==========');
      console.log(`[Storyboard] [阶段3] 语音旁白: ${hasVoiceNarration ? (voiceAudioUri ? '✅ 已合并' : '❌ 失败') : '— 未启用'}`);
      console.log(`[Storyboard] [阶段3] 背景音乐: ${effectiveHasBgm ? (bgmAudioUri ? '✅ 已准备' : '❌ 失效') : (hasBgm ? '⚠️ 原始配置' : '— 未启用(自动补充默认BGM)')}`);
      console.log(`[Storyboard] [阶段3] 音频合并结果: ${audioProcessingSuccess ? '✅ 成功' : '⚠️ 可能未生效'}`);
      console.log(`[Storyboard] [阶段3] 最终视频URL: ${finalVideoUrl?.substring(0, 100)}`);

    } else {
      console.log('[Storyboard] [阶段3] 跳过音频处理 (无音频需求)');
    }
    // ========== 阶段3结束 ==========

    // ========== 阶段3.5：特效音（SFX）处理 ==========
    const sfxEnabled = sfxConfig?.enabled && sfxConfig.bindings && sfxConfig.bindings.length > 0;
    if (sfxEnabled && finalVideoUrl && storyboardSpeechSynthesizer) {
      updateTaskProgress(taskId, 96.5, '正在添加特效音...');
      console.log('[Storyboard] [阶段3.5] ========== 特效音处理开始 ==========');
      console.log(`[Storyboard] [阶段3.5] 绑定数量: ${sfxConfig!.bindings.length}, 全局音量: ${sfxConfig!.globalVolume || 0.6}`);

      let sfxSuccessCount = 0;
      let sfxFailCount = 0;

      for (let i = 0; i < sfxConfig!.bindings.length; i++) {
        const binding = sfxConfig!.bindings[i];
        const sfxDef = getSfxById(binding.sfxId as SfxId);

        if (!sfxDef) {
          console.warn(`[Storyboard] [SFX-${i}] ⚠️ 未找到特效音定义: ${binding.sfxId}, 跳过`);
          sfxFailCount++;
          continue;
        }

        try {
          // 通过TTS生成特效音
          const sfxTtsResp = await storyboardSpeechSynthesizer.synthesize({
            uid: uuidv4(),
            text: sfxDef.ttsPrompt,
            speaker: WORKING_SPEAKER,
            audioFormat: 'mp3',
            sampleRate: 24000,
            speechRate: 0,
          });

          if (sfxTtsResp.audioUri) {
            // 将特效音混入视频
            const sfxResult = await storyboardVideoEditor.compileVideoAudio(
              finalVideoUrl,
              sfxTtsResp.audioUri,
              { isVideoAudioSync: false, isAudioReserve: true } // 保留原有音频，叠加特效音
            );

            if (sfxResult.url) {
              finalVideoUrl = sfxResult.url;
              sfxSuccessCount++;
              console.log(`[Storyboard] [SFX-${i}] ✅ ${sfxDef.name}(${binding.sfxId}) 注入成功, shotIndex=${binding.shotIndex}, offset=${binding.timeOffset}s`);
            } else {
              sfxFailCount++;
              console.warn(`[Storyboard] [SFX-${i}] ⚠️ ${sfxDef.name} 混入失败(无URL)`);
            }
          } else {
            sfxFailCount++;
            console.warn(`[Storyboard] [SFX-${i}] ⚠️ ${sfxDef.name} TTS生成失败(无audioUri)`);
          }
        } catch (sfxErr) {
          sfxFailCount++;
          console.error(`[Storyboard] [SFX-${i}] ❌ ${sfxDef?.name || binding.sfxId} 异常:`, sfxErr instanceof Error ? sfxErr.message : sfxErr);
        }
      }

      console.log(`[Storyboard] [阶段3.5] ========== 特效音处理总结 ==========`);
      console.log(`[Storyboard] [阶段3.5] 成功: ${sfxSuccessCount}, 失败: ${sfxFailCount}, 总计: ${sfxConfig!.bindings.length}`);
      console.log(`[Storyboard] [阶段3.5] 最终视频URL: ${finalVideoUrl?.substring(0, 100)}`);
    } else if (sfxConfig?.enabled) {
      console.log('[Storyboard] [阶段3.5] 跳过特效音 (无绑定或缺少TTS客户端)');
    }
    // ========== 阶段3.5结束 ==========

    // 阶段4：如果字幕启用且有实际文本内容，在最终视频上添加字幕（★ 优化：空文本跳过）
    const hasValidSubtitle = subtitleEnabled && subtitlePrompt && subtitlePrompt.trim().length > 0;

    // 字幕状态跟踪（用于completeTask返回给前端渲染SRT覆盖层）
    let subtitleBurned = false;
    let srtData: string | undefined = undefined;
    let srtEntryCount = 0;

    if (hasValidSubtitle && finalVideoUrl) {
      updateTaskProgress(taskId, 97, '正在添加字幕到最终视频...');
      try {
        console.log('[Storyboard] ========== 字幕处理开始 ==========');
        console.log('[Storyboard] 最终视频URL:', finalVideoUrl?.substring(0, 80));
        console.log('[Storyboard] 字幕内容:', subtitlePrompt?.substring(0, 100));

        const subtitleConfig = {
          font_pos_config: {
            horizontal_align: 'center',
            vertical_align: 'bottom',
            horizontal_margin: 10,
            vertical_margin: 10,
          } as any,
          font_size: 24,
          font_color: '#FFFFFF',
          background_color: 'rgba(0,0,0,0.5)',
        };

        // 构建字幕文本列表：按分镜头时长分配
        const textList: Array<{ start_time: number; end_time: number; text: string }> = [];
        let currentTimeMs = 0;

        if (storyboard.shots.length > 1) {
          // 多镜头模式：每段分配对应时长的字幕
          const subtitleLines = splitSubtitleText(subtitlePrompt, storyboard.shots.length);
          storyboard.shots.forEach((shot, idx) => {
            const shotDurationMs = shot.duration * 1000;
            textList.push({
              start_time: currentTimeMs,
              end_time: currentTimeMs + shotDurationMs,
              text: subtitleLines[idx] || subtitleLines[0] || '',
            });
            currentTimeMs += shotDurationMs;
          });
        } else {
          // 单镜头/未知模式：全时段显示
          textList.push({
            start_time: 0,
            end_time: Math.round(storyboard.totalDuration * 1000) || 99999,
            text: subtitlePrompt,
          });
        }


        console.log(`[Storyboard] 字幕分段数: ${textList.length}`, JSON.stringify(textList.map(t => ({ ...t, text: t.text.substring(0, 30) }))));
        
        // 调用字幕API（已知可能返回404，需要详细错误处理）
        let subtitleResponse: any;
        try {
          subtitleResponse = await storyboardVideoEditor.addSubtitles(finalVideoUrl, subtitleConfig, {
            textList: textList,
            urlExpire: 7 * 24 * 60 * 60,
          });
          console.log('[Storyboard] 字幕API响应:', JSON.stringify(subtitleResponse).substring(0, 500));
        } catch (subtitleApiError) {
          // 区分不同类型的错误
          const errMsg = subtitleApiError instanceof Error ? subtitleApiError.message : String(subtitleApiError);
          const errStr = errMsg.toLowerCase();
          
          if (errStr.includes('404') || errStr.includes('not found')) {
            console.error('[Storyboard] [阶段4] ❌ addSubtitles返回404 - API端点可能不存在或已变更');
            console.error('[Storyboard] [阶段4] ❌ 这通常是SDK版本问题或服务端未部署该API');
          } else if (errStr.includes('400')) {
            console.error('[Storyboard] [阶段4] ❌ addSubtitles参数错误(400):', errMsg);
          } else if (errStr.includes('timeout') || errStr.includes('abort')) {
            console.error('[Storyboard] [阶段4] ❌ addSubtitles超时:', errMsg);
          } else {
            console.error('[Storyboard] [阶段4] ❌ addSubtitles未知错误:', errMsg);
            console.error('[Storyboard] [阶段4] 堆栈:', subtitleApiError instanceof Error ? subtitleApiError.stack : 'N/A');
          }
          
          // 标记字幕失败但不中断流程
          subtitleResponse = null;
        }

        if (subtitleResponse?.url) {
          console.log('[Storyboard] [阶段4] ✅ 字幕添加成功:', subtitleResponse.url.substring(0, 80));
          finalVideoUrl = subtitleResponse.url;
          subtitleBurned = true;
        } else if (subtitleResponse === null) {
          console.warn('[Storyboard] [阶段4] ⚠️ 字幕API调用失败（见上方错误详情），尝试生成SRT降级数据');
          // 生成SRT降级数据供前端覆盖层渲染
          try {
            const entries = generateSrtEntries(subtitlePrompt, storyboard.totalDuration || 30, 22);
            if (entries.length > 0) {
              srtData = serializeSrt(entries);
              srtEntryCount = entries.length;
              console.log(`[Storyboard] [阶段4] ✅ SRT降级数据生成成功，共${entries.length}条字幕`);
            }
          } catch (srtError) {
            console.error('[Storyboard] [阶段4] ❌ SRT降级数据生成失败:', srtError);
          }
        } else {
          console.warn('[Storyboard] [阶段4] ⚠️ 字幕响应无URL字段，完整响应:', JSON.stringify(subtitleResponse)?.substring(0, 300));
        }
      } catch (outerSubtitleError) {
        console.error('[Storyboard] 字幕外层catch（不应到达此处）:', outerSubtitleError);
      }
      console.log('[Storyboard] ========== 字幕处理结束 ==========');
    }

    updateTaskProgress(taskId, 100, '分镜头视频生成完成！');
    // 完成任务
    completeTask(taskId, {
      videoUrl: finalVideoUrl,
      isStoryboard: true,
      storyboardId: storyboard.id,
      totalShots: storyboard.shots.length,
      totalDuration: storyboard.totalDuration,
      subtitleBurned,
      srtData,
      srtEntryCount,
      shots: updatedShots.map(shot => ({
        id: shot.id,
        index: shot.index,
        prompt: shot.prompt,
        duration: shot.duration,
        nineGridImages: shot.nineGridImages,
        videoUrl: shot.videoUrl,
        lastFrameUrl: shot.lastFrameUrl,
        status: shot.status,
        error: shot.error
      }))
    });
    
    console.log('[Storyboard] 分镜头任务完成:', taskId);
    
  } catch (error) {
    console.error('[Storyboard] 分镜头任务执行失败:', error);
    failTask(
      taskId, 
      error instanceof Error ? error.message : '分镜头视频生成失败'
    );
  }
}
