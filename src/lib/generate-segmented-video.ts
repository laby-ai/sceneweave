/**
 * 分段视频生成工具
 * 将长视频拆分为多个片段分别生成，然后合并
 * 组合三个优化方案：
 * 1. 增强提示词连贯性
 * 2. 首尾帧参考
 * 3. 智能分镜脚本
 */

import {
  submitVideoWithBYOK,
  waitForVideoWithBYOK,
  type BYOKConnection,
} from '@/lib/byok-provider';
import { runWithBYOKVideoRetry } from '@/lib/byok-retry';
import { mergeVideosWithLocalFfmpeg } from '@/lib/local-video-merge';
import { createHuiyingObjectStorage } from '@/lib/huiying-object-storage';
import { resolveSegmentFirstFrame } from '@/lib/segmented-video-dependency-gate';
import { buildSegmentContinuityMemoryBlock } from '@/lib/segment-continuity-memory';

interface StoryboardSegment {
  segmentNumber: number;
  sceneDescription?: string;
  characterAction?: string;
  cameraAngle?: string;
  lighting?: string;
  costumeProps?: string;
  transitionHint?: string;
}

interface Storyboard {
  title?: string;
  segments?: StoryboardSegment[];
}

// 初始化对象存储客户端（延迟初始化）
let storage: ReturnType<typeof createHuiyingObjectStorage> | null = null;

const getStorage = () => {
  if (!storage) {
    try {
      storage = createHuiyingObjectStorage();
    } catch (error) {
      console.warn('[SegmentedVideo] 对象存储客户端初始化失败:', error);
      storage = null;
    }
  }
  return storage;
};

// 原有的类型定义（保持兼容性）
export interface SegmentTask {
  index: number;
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  providerTaskId?: string;
  videoUrl?: string;
  error?: string;
}

export interface SegmentedVideoResult {
  success: boolean;
  videoUrl?: string;
  segments?: SegmentTask[];
  error?: string;
  // 向后兼容的字段
  isPartial?: boolean;
  failedSegments?: number[];
  successCount?: number;
  totalCount?: number;
  segmentCount?: number;
}

// 新的请求类型
export interface GenerateSegmentedVideoRequest {
  prompt: string;
  duration?: number;
  segmentDuration?: number;
  watermark?: boolean;
  materials?: string[];
  useStoryboard?: boolean;
  useFrameReference?: boolean;
  sceneType?: string;        // ★ 新增：场景类型，用于提示词分解和连贯性
  productDisplayModes?: string[]; // ★ 新增：产品展示模式（多选）
  byokConnection?: BYOKConnection;
}

interface GenerateSegmentedVideoParams {
  segmentDuration?: number;
  materials?: string[];
  sceneType?: string;
  productDisplayModes?: string[];
  byokConnection?: BYOKConnection;
  videoModel?: string;
  ratio?: string;
  resolution?: string;
  watermark?: boolean;
  generateAudio?: boolean;
  language?: string;
  aiAudioPrompt?: string;
  audioUrl?: string;
  audioPrompt?: string;
  subtitleEnabled?: boolean;
  subtitlePrompt?: string;
  onSegmentComplete?: (segment: {
    segmentIndex: number;
    videoUrl: string;
    lastFrameUrl?: string;
    providerTaskId?: string;
    segments: GeneratedSegmentSnapshot[];
  }) => void;
  onSegmentUpdate?: (snapshot: {
    segmentIndex: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
    prompt: string;
    duration: number;
    ratio?: string;
    videoModel?: string;
    providerTaskId?: string;
    videoUrl?: string;
    lastFrameUrl?: string;
    error?: string;
    segments: GeneratedSegmentSnapshot[];
  }) => void;
}

interface DecomposedSegment {
  phaseLabel?: string;
  prompt: string;
  continuityAnchors?: string[];
}

interface PromptDecomposeResult {
  success?: boolean;
  totalSegments?: number;
  rhythmSummary?: string;
  error?: string;
  visualAnchors?: string[];
  segments?: DecomposedSegment[];
}

export interface GeneratedSegmentSnapshot {
  segmentIndex: number;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  prompt: string;
  duration: number;
  ratio?: string;
  videoModel?: string;
  providerTaskId?: string;
  videoUrl?: string;
  lastFrameUrl?: string;
  error?: string;
}

/**
 * 使用本地 FFmpeg 合并多个视频片段。
 */
async function mergeVideos(segmentUrls: string[]): Promise<string> {
  console.log(`[SegmentedVideo] 开始合并 ${segmentUrls.length} 个片段...`);
  
  if (segmentUrls.length === 1) {
    return segmentUrls[0];
  }
  
  try {
    const result = await mergeVideosWithLocalFfmpeg(segmentUrls);
    return result.videoUrl;
  } catch (mergeError) {
    console.error(`[SegmentedVideo] 合并失败:`, mergeError);
    throw new Error('视频片段已生成，但本地合并成长视频失败。请在任务中心重试，或检查 FFmpeg 配置。');
  }
}

/**
 * 提取视频的最后一帧
 */
async function extractLastFrame(videoUrl: string): Promise<string | undefined> {
  try {
    console.log(`[SegmentedVideo] 正在提取视频最后一帧...`);
    // 使用完整URL（服务端fetch需要绝对路径）
    const baseUrl = process.env.HUIYING_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
    const frameResponse = await fetch(`${baseUrl}/api/video/extract-last-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl }),
    });

    if (frameResponse.ok) {
      const frameData = await frameResponse.json();
      if (frameData.success && frameData.frameUrl) {
        console.log(`[SegmentedVideo] 成功提取最后一帧`);
        return frameData.frameUrl;
      }
    }
  } catch (frameError) {
    console.warn(`[SegmentedVideo] 提取最后一帧失败:`, frameError);
  }
  return undefined;
}

/**
 * 生成分镜脚本
 */
async function generateStoryboard(
  prompt: string,
  totalDuration: number,
  segmentDuration: number
): Promise<Storyboard | null> {
  try {
    console.log('[SegmentedVideo] 正在生成分镜脚本...');
    const baseUrl = process.env.HUIYING_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
    const storyboardResponse = await fetch(`${baseUrl}/api/storyboard/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        totalDuration,
        segmentDuration,
      }),
    });

    if (storyboardResponse.ok) {
      const storyboardData = await storyboardResponse.json();
      if (storyboardData.success && storyboardData.storyboard) {
        console.log('[SegmentedVideo] 分镜脚本生成成功:', storyboardData.storyboard.title);
        return storyboardData.storyboard;
      }
    }
  } catch (storyboardError) {
    console.warn('[SegmentedVideo] 分镜脚本生成失败:', storyboardError);
  }
  return null;
}

function buildSegmentBasePrompt(params: {
  prompt: string;
  segmentIndex: number;
  totalSegments: number;
  sceneType: string;
  decomposeResult: PromptDecomposeResult | null;
  storyboard: Storyboard | null;
}) {
  const {
    prompt,
    segmentIndex,
    totalSegments,
    sceneType,
    decomposeResult,
    storyboard,
  } = params;
  if (decomposeResult?.success && decomposeResult.segments?.[segmentIndex]) {
    const decomposedSeg = decomposeResult.segments[segmentIndex];
    const totalDecomposed = decomposeResult.totalSegments || totalSegments;
    const visualAnchors = decomposedSeg.continuityAnchors || decomposeResult.visualAnchors || [];
    const sceneContinuity = buildSceneAwareContinuity(
      segmentIndex,
      totalDecomposed,
      sceneType,
      decomposedSeg.continuityAnchors || [],
      decomposeResult.visualAnchors || []
    );

    return {
      prompt: `
【原始主题】
${prompt}

---

★ 【第${segmentIndex + 1}/${totalDecomposed}段 - ${decomposedSeg.phaseLabel}】
${decomposedSeg.prompt}

---
${sceneContinuity}
`.trim(),
      visualAnchors,
    };
  }

  if (storyboard?.segments?.[segmentIndex]) {
    const segment = storyboard.segments[segmentIndex];
    const sceneContinuity = buildSceneAwareContinuity(segmentIndex, totalSegments, sceneType, [], []);

    return {
      prompt: `
${prompt}

---

【分镜脚本 - 第${segment.segmentNumber}个片段】
场景描述：${segment.sceneDescription}
角色动作：${segment.characterAction}
镜头角度：${segment.cameraAngle}
光线色调：${segment.lighting}
服装道具：${segment.costumeProps}
衔接提示：${segment.transitionHint}

---
${sceneContinuity}
`.trim(),
      visualAnchors: [] as string[],
    };
  }

  const sceneContinuity = buildSceneAwareContinuity(segmentIndex, totalSegments, sceneType, [], []);
  return {
    prompt: `【原始主题】
${prompt}

---
${sceneContinuity}
`.trim(),
    visualAnchors: [] as string[],
  };
}

/**
 * 生成分段视频 - 三个优化方案组合（保持兼容性）
 * 
 * @param prompt 原始提示词
 * @param duration 总时长
 * @param params 其他参数
 * @param onProgress 进度回调
 */
export async function generateSegmentedVideo(
  prompt: string,
  duration: number = 20,
  params: GenerateSegmentedVideoParams = {},
  onProgress?: (progress: number, stage?: string) => void
): Promise<SegmentedVideoResult> {
  // 防护：确保 duration 为有效数字
  let safeDuration: number;
  if (typeof duration === 'number' && !isNaN(duration) && duration > 0 && isFinite(duration)) {
    safeDuration = Math.min(Math.max(duration, 5), 3600);
  } else {
    console.warn(`[SegmentedVideo] ⚠️ duration 参数无效(${typeof duration}:${duration}), 使用默认值 20`);
    safeDuration = 20;
  }

  if (!params.byokConnection) {
    throw new Error('分段视频生成已关闭 legacy provider fallback。请配置 BYOK 视频模型后再生成。');
  }

  // 根据请求总时长选择最优的片段时长和段数，使总时长尽量接近请求值
  const candidateDurations = [6, 10];
  let bestSegmentDuration = 10;
  let bestTotalSegments = Math.ceil(safeDuration / 10);
  let bestTotalTime = bestTotalSegments * 10;
  let bestDiff = Math.abs(bestTotalTime - safeDuration);

  for (const segDur of candidateDurations) {
    const segs = Math.ceil(safeDuration / segDur);
    const totalTime = segs * segDur;
    const diff = Math.abs(totalTime - safeDuration);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSegmentDuration = segDur;
      bestTotalSegments = segs;
      bestTotalTime = totalTime;
    }
  }

  const segmentDuration = bestSegmentDuration;
  const totalSegments = bestTotalSegments;

  console.log(`[SegmentedVideo] 时长优化: 请求${duration}s -> ${safeDuration}s, 片段时长${segmentDuration}s, 共${totalSegments}段, 预计总时长${totalSegments * segmentDuration}s`);
  const materials = params.materials || [];
  
  console.log(`[SegmentedVideo] 开始生成${totalSegments}个片段，总时长${safeDuration}秒...`);
  
  if (onProgress) onProgress(5, '初始化...');

  // 存储生成的片段
  const generatedSegments: GeneratedSegmentSnapshot[] = [];

  // 方案3：先生成分镜脚本
  let storyboard: Storyboard | null = null;
  const useStoryboard = true;
  const useFrameReference = true;

  // ★ 新增：提取场景类型
  const sceneType: string = params.sceneType || 'portrait';
  const productDisplayModes: string[] = params.productDisplayModes || [];

  // ★ 新增：提示词时序分解结果（方案A：提示词时序分解引擎）
  let decomposeResult: PromptDecomposeResult | null = null;
  
  if (useStoryboard) {
    storyboard = await generateStoryboard(prompt, safeDuration, segmentDuration);
  }

  // ★ 调用分解API获取每段专属提示词
  try {
    if (totalSegments > 1) {
      console.log(`[SegmentedVideo] ★ 调用提示词分解API: segments=${totalSegments}, sceneType=${sceneType}`);
      const decomposeBaseUrl = process.env.HUIYING_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
      const decomposeRes = await fetch(`${decomposeBaseUrl}/api/prompt/decompose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          duration: safeDuration,
          segmentCount: totalSegments,
          segmentDuration,
          sceneType,
          productDisplayModes: productDisplayModes.length > 0 ? productDisplayModes : undefined,
        }),
      });
      
      if (decomposeRes.ok) {
        const parsedDecomposeResult = await decomposeRes.json() as PromptDecomposeResult;
        decomposeResult = parsedDecomposeResult;
        if (parsedDecomposeResult.success) {
          console.log(`[SegmentedVideo] ★ 分解成功: ${parsedDecomposeResult.totalSegments}段, 节奏=${parsedDecomposeResult.rhythmSummary}`);
        } else {
          console.warn(`[SegmentedVideo] ⚠️ 分解API返回失败: ${parsedDecomposeResult.error}`);
        }
      } else {
        console.warn(`[SegmentedVideo] ⚠️ 分解API请求失败(${decomposeRes.status})，将使用fallback模式`);
      }
    }
  } catch (err) {
    console.warn(`[SegmentedVideo] ⚠️ 分解API调用异常:`, err);
  }

  if (onProgress) onProgress(10, '开始生成片段...');

  const clipDuration = Math.min(Math.max(segmentDuration, 6), 10);
  const segmentPlans = Array.from({ length: totalSegments }, (_, segmentIndex) => (
    buildSegmentBasePrompt({
      prompt,
      segmentIndex,
      totalSegments,
      sceneType,
      decomposeResult,
      storyboard,
    })
  ));
  const plannedSegments: GeneratedSegmentSnapshot[] = segmentPlans.map((plan, segmentIndex) => ({
    segmentIndex,
    status: 'pending',
    prompt: [
      plan.prompt,
      buildSegmentContinuityMemoryBlock({
        segmentIndex,
        totalSegments,
        currentPrompt: plan.prompt,
        previousPrompt: segmentPlans[segmentIndex - 1]?.prompt,
        previousLastFrameAvailable: false,
        nextPrompt: segmentPlans[segmentIndex + 1]?.prompt,
        visualAnchors: plan.visualAnchors,
      }),
    ].join('\n\n'),
    duration: clipDuration,
    ratio: params.ratio || '16:9',
    videoModel: params.videoModel,
  }));
  if (typeof params.onSegmentUpdate === 'function') {
    params.onSegmentUpdate({
      ...plannedSegments[0],
      status: 'pending',
      segments: plannedSegments,
    });
  }

  // 逐个生成分段视频
  for (let segmentIndex = 0; segmentIndex < totalSegments; segmentIndex++) {
    const currentProgress = 10 + (segmentIndex / totalSegments) * 80;
    if (onProgress) onProgress(currentProgress, `生成第 ${segmentIndex + 1}/${totalSegments} 个片段...`);

    console.log(`[SegmentedVideo] 正在生成第 ${segmentIndex + 1}/${totalSegments} 个片段...`);

    let segmentPrompt = plannedSegments[segmentIndex]?.prompt || prompt;
    // 方案2：首尾帧参考
    const firstFrame = resolveSegmentFirstFrame({
      segmentIndex,
      totalSegments,
      previousLastFrameUrl: generatedSegments[segmentIndex - 1]?.lastFrameUrl,
      materialFallbackUrl: materials[0],
      strictFrameHandoff: Boolean(params.byokConnection && useFrameReference && totalSegments > 1),
    });
    if (!firstFrame.dependencySatisfied) {
      throw new Error(firstFrame.reason || '分段连续性门禁失败');
    }
    const firstFrameImage = useFrameReference ? firstFrame.firstFrameImage : undefined;
    if (segmentIndex > 0 && firstFrameImage) {
      console.log(`[SegmentedVideo] 使用上一个片段的最后一帧作为参考`);
      segmentPrompt = [
        segmentPrompt,
        '【运行时首帧衔接】本段 first_frame 已绑定上一段 lastFrame，请先复现上一段末尾的角色/道具/场景状态，再推进本段动作。',
      ].join('\n\n');
    }

    // 调用 BYOK 视频生成
    let videoUrl: string;
    let lastFrameUrlFromProvider: string | undefined;
    let activeProviderTaskId: string | undefined;
    const runningSnapshot: GeneratedSegmentSnapshot = {
      segmentIndex,
      status: 'running',
      prompt: segmentPrompt,
      duration: clipDuration,
      ratio: params.ratio || '16:9',
      videoModel: params.videoModel,
    };

    if (typeof params.onSegmentUpdate === 'function') {
      params.onSegmentUpdate({
        ...runningSnapshot,
        status: 'running',
        segments: [
          ...plannedSegments.map(planned => {
            const completed = generatedSegments.find(item => item.segmentIndex === planned.segmentIndex);
            return completed || planned;
          }).slice(0, segmentIndex),
          runningSnapshot,
          ...plannedSegments.slice(segmentIndex + 1),
        ],
      });
    }

    try {
      const byokResult = await runWithBYOKVideoRetry(
        async (attempt) => {
          if (attempt > 1) {
            console.log(`[SegmentedVideo] BYOK 第 ${segmentIndex + 1}/${totalSegments} 段开始第 ${attempt} 次提交重试`);
          }
          const submitResponse = await submitVideoWithBYOK(params.byokConnection as BYOKConnection, {
            prompt: segmentPrompt,
            model: params.videoModel,
            duration: clipDuration,
            ratio: params.ratio || '16:9',
            resolution: params.resolution,
            watermark: params.watermark,
            generateAudio: params.generateAudio,
            ...(firstFrameImage && { firstFrameImage }),
            ...(!firstFrameImage && materials && materials.length > 0 && { firstFrameImage: materials[0] }),
          });
          activeProviderTaskId = submitResponse.taskId;
          if (typeof params.onSegmentUpdate === 'function') {
            params.onSegmentUpdate({
              ...runningSnapshot,
              providerTaskId: activeProviderTaskId,
              status: 'running',
              segments: [
                ...plannedSegments.map(planned => {
                  const completed = generatedSegments.find(item => item.segmentIndex === planned.segmentIndex);
                  return completed || planned;
                }).slice(0, segmentIndex),
                {
                  ...runningSnapshot,
                  providerTaskId: activeProviderTaskId,
                },
                ...plannedSegments.slice(segmentIndex + 1),
              ],
            });
          }
          return waitForVideoWithBYOK(
            params.byokConnection as BYOKConnection,
            submitResponse.taskId,
            (status, pollAttempt) => {
              console.log(`[SegmentedVideo] BYOK 第 ${segmentIndex + 1}/${totalSegments} 段轮询 #${pollAttempt}: ${status.rawStatus || status.status}`);
            },
            { maxAttempts: 180, intervalMs: 3000 }
          );
        },
        {
          label: `第 ${segmentIndex + 1}/${totalSegments} 段`,
          onRetry: ({ attempt, delayMs, error }) => {
            const waitSeconds = Math.ceil(delayMs / 1000);
            console.warn(`[SegmentedVideo] BYOK 第 ${segmentIndex + 1}/${totalSegments} 段触发频率/配额限制，第 ${attempt} 次失败，${waitSeconds}s 后重试:`, error.message);
            if (onProgress) {
              onProgress(
                Math.min(88, currentProgress + 2),
                `第 ${segmentIndex + 1}/${totalSegments} 段遇到供应商频率限制，约 ${waitSeconds}s 后自动重试...`
              );
            }
          },
        },
      );
      videoUrl = byokResult.videoUrl;
      lastFrameUrlFromProvider = byokResult.lastFrameUrl;

      // 方案2：提取当前片段的最后一帧
      let lastFrameUrl: string | undefined;
      if (lastFrameUrlFromProvider) {
        lastFrameUrl = lastFrameUrlFromProvider;
      } else if (useFrameReference) {
        lastFrameUrl = await extractLastFrame(videoUrl);
      }

      // 保存片段信息
      const completedSnapshot = {
        segmentIndex,
        status: 'completed' as const,
        prompt: segmentPrompt,
        duration: clipDuration,
        ratio: params.ratio || '16:9',
        videoModel: params.videoModel,
        providerTaskId: activeProviderTaskId,
        videoUrl,
        lastFrameUrl,
      };
      generatedSegments.push(completedSnapshot);

      if (typeof params.onSegmentComplete === 'function') {
        params.onSegmentComplete({
          segmentIndex,
          videoUrl,
          lastFrameUrl,
          providerTaskId: activeProviderTaskId,
          segments: [...generatedSegments],
        });
      }
      if (typeof params.onSegmentUpdate === 'function') {
        params.onSegmentUpdate({
          ...completedSnapshot,
          segments: [...generatedSegments],
        });
      }

      console.log(`[SegmentedVideo] 第 ${segmentIndex + 1}/${totalSegments} 个片段生成成功`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error || '未知错误');
      if (typeof params.onSegmentUpdate === 'function') {
        params.onSegmentUpdate({
          ...runningSnapshot,
          providerTaskId: activeProviderTaskId,
          status: 'failed',
          error: errorMessage,
          segments: [
            ...plannedSegments.map(planned => {
              const completed = generatedSegments.find(item => item.segmentIndex === planned.segmentIndex);
              return completed || planned;
            }).slice(0, segmentIndex),
            {
              ...runningSnapshot,
              providerTaskId: activeProviderTaskId,
              status: 'failed',
              error: errorMessage,
            },
            ...plannedSegments.slice(segmentIndex + 1),
          ],
        });
      }
      throw error;
    }
  }

  if (onProgress) onProgress(90, '合并视频片段...');

  // 合并视频片段
  const videoUrls = generatedSegments
    .map(s => s.videoUrl)
    .filter((url): url is string => Boolean(url));
  const finalVideoUrl = await mergeVideos(videoUrls);

  if (onProgress) onProgress(100, '完成！');

  console.log('[SegmentedVideo] 所有片段生成并合并完成！');

  return {
    success: true,
    videoUrl: finalVideoUrl,
    segments: generatedSegments.map((s, i) => ({
      index: i,
      taskId: `segment-${i}`,
      status: 'completed' as const,
      providerTaskId: s.providerTaskId,
      videoUrl: s.videoUrl,
    })),
    // 向后兼容的字段
    isPartial: false,
    failedSegments: [],
    successCount: totalSegments,
    totalCount: totalSegments,
    segmentCount: totalSegments,
  };
}

// 新的请求接口（保持向后兼容）
export async function generateSegmentedVideoWithOptions(
  request: GenerateSegmentedVideoRequest
): Promise<{
  success: boolean;
  videoUrls: string[];
  segments: Array<{ segmentIndex: number; videoUrl: string }>;
  totalDuration: number;
  segmentDuration: number;
  watermark: boolean;
}> {
  const result = await generateSegmentedVideo(
    request.prompt,
    request.duration || 20,
    {
      segmentDuration: request.segmentDuration || 10,
      materials: request.materials || [],
      byokConnection: request.byokConnection,
    }
  );
  
  return {
    success: result.success,
    videoUrls: result.segments?.map(s => s.videoUrl || '') || [],
    segments: result.segments?.map(s => ({ 
      segmentIndex: s.index, 
      videoUrl: s.videoUrl || '' 
    })) || [],
    totalDuration: request.duration || 20,
    segmentDuration: request.segmentDuration || 10,
    watermark: request.watermark !== false,
  };
}

// ===== 方案B：场景感知连贯性提示词生成器 =====

/**
 * 根据场景类型和片段位置，生成差异化的连贯性指令
 * 
 * 解决问题：
 * - 原来的连贯性提示词是通用模板（"保持角色服装一致"），不区分场景类型
 * - 产品视频需要的是材质/比例/Logo一致性
 * - 风景视频需要的是地理/时间/天气一致性
 * - 剧情视频需要的是角色/情绪/叙事一致性
 */
function buildSceneAwareContinuity(
  segmentIndex: number,
  totalSegments: number,
  sceneType: string,
  segAnchors: string[],
  globalAnchors: string[]
): string {
  const isFirst = segmentIndex === 0;
  const isLast = segmentIndex === totalSegments - 1;
  const isMiddle = !isFirst && !isLast;

  // 合并锚点（优先使用片段级锚点）
  const allAnchors = [...segAnchors, ...globalAnchors].filter((v, i, a) => a.indexOf(v) === i);

  // 场景专属连贯性规则
  const sceneRules: Record<string, { identity: string[]; transition: string; ending: string }> = {
    product: {
      identity: [
        '【产品视觉绝对一致 — 最高优先级】',
        `• 产品外观必须在所有${totalSegments}个片段中完全相同：${allAnchors.slice(0, 4).join(' / ') || '名称、颜色、材质、尺寸'}`,
        '• 禁止出现：产品变形、比例失调、Logo扭曲、文字渲染异常、材质变化',
        '• 禁止出现：产品"走路""说话""微笑"等人物动作（产品不能执行这些动作）',
        '• 产品摆放角度应从前一段自然延续（旋转/推近/拉远的逻辑衔接）',
      ],
      transition: isFirst 
        ? '★ 这是开场片段：以产品全景或中景开始，建立完整的产品印象和环境关系'
        : isLast
          ? '★ 这是收尾片段：回到一个有冲击力的构图，强化品质感和购买欲望'
          : `★ 这是第${segmentIndex + 1}段：聚焦于特定维度（材质/功能/光影/角度），比前一段更深入`,
      ending: '整体目标：让观众看完后对产品的每个细节都有清晰认知，并产生"想要拥有"的冲动。',
    },
    portrait: {
      identity: [
        '【角色视觉绝对一致】',
        `• 角色外观在所有${totalSegments}个片段中完全相同：${allAnchors.slice(0, 4).join(' / ') || '发型、服装、配饰、体态'}`,
        '• 禁止出现：变脸、肢体畸形、年龄突变、服装变化、性别改变',
        '• 表情和动作必须承接上一片段的结束状态（不能突然跳变）',
        '• 视线方向保持叙事连贯（除非刻意表现情绪转变）',
      ],
      transition: isFirst
        ? '★ 开场：交代角色身份、所处空间、初始情绪状态'
        : isLast
          ? '★ 收尾：情感落地，给观众回味空间'
          : `★ 第${segmentIndex + 1}段：情绪或情节的推进阶段`,
      ending: '整体目标：塑造一个真实可信的角色形象，传递完整的情感体验。',
    },
    landscape: {
      identity: [
        '【景观视觉绝对一致】',
        `• 地理特征在所有${totalSegments}个片段中完全相同：${allAnchors.slice(0, 4).join(' / ') || '山川走向、水域范围、植被分布'}`,
        '• 时间氛围一致：如果是同一时刻拍摄，光线色温不应突变',
        '• 天气状况一致：云层密度/雾气浓度/降水状态保持连贯',
        '• 空间尺度正确：远景→近景→远景的节奏中，物体大小比例合理',
      ],
      transition: isFirst
        ? '★ 开场：用最宏大的视角建立地理全貌和时间氛围'
        : isLast
          ? '★ 收尾：拉回宏大视角，完成"远近-远近"的视觉闭环'
          : `★ 第${segmentIndex + 1}段：探索景观的中层或微观细节`,
      ending: '整体目标：呈现令人震撼的自然之美，传达空间的尺度和时间的流动感。',
    },
    food: {
      identity: [
        '【食物视觉绝对一致】',
        `• 食物本体在所有${totalSegments}个片段中完全相同：${allAnchors.slice(0, 4).join(' / ') || '菜品形态、摆盘方式、餐具搭配'}`,
        '• 色泽和新鲜度一致：不能出现突然变色或变质',
        '• 摆盘位置不变：餐具和装饰物的相对位置固定',
        '• 温度感知一致：热气/冰霜等温度暗示应连贯',
      ],
      transition: isFirst
        ? '★ 开场：展示摆盘全貌，建立"看起来很好吃"的第一印象'
        : isLast
          ? '★ 收尾：最具食欲诱惑力的画面，让人想立刻品尝'
          : `★ 第${segmentIndex + 1}段：探索质地、温度、口感等感官维度`,
      ending: '整体目标：最大化食欲诱惑力，让画面本身就能"勾起馋虫"。',
    },
    drama: {
      identity: [
        '【叙事视觉绝对一致】',
        `• 角色在所有${totalSegments}个片段中完全相同：${allAnchors.slice(0, 4).join(' / ') || '角色身份、服装、所处环境'}`,
        '• 情绪逻辑连贯：不能出现无原因的情绪跳变',
        '• 空间关系一致：房间布局/道具位置/人物站位保持逻辑统一',
        '• 时间线性推进：不能出现时间倒流或无解释的时间跳跃',
        '• 每段开头1-2秒必须承接上一段末尾的角色位置、视线方向、手部动作和关键道具状态，不能突然换成无关新动作',
      ],
      transition: isFirst
        ? '★ 开场：建立"谁、在哪里、面临什么"的故事情境'
        : isLast
          ? '★ 收尾：给出结局或开放式结尾，情感落地'
          : `★ 第${segmentIndex + 1}段：推动情节发展或深化角色刻画`,
      ending: '整体目标：讲述一个有开头、发展和结尾的完整故事弧光。',
    },
    abstract: {
      identity: [
        '【抽象视觉风格绝对一致】',
        `• 核心视觉元素在所有${totalSegments}个片段中延续：${allAnchors.slice(0, 4).join(' / ') || '基本形态、色彩体系、运动规律'}`,
        '• 色调体系一致：主色调和辅助色的关系不变',
        '• 运动规律可演化但应有内在逻辑（加速/减速/变换都应有理由）',
        '• 背景处理风格统一（纯色/渐变/纹理）',
      ],
      transition: isFirst
        ? '★ 开场：建立抽象作品的视觉"调性和基础形态"'
        : isLast
          ? '★ 收尾：归于和谐、消散或开放性循环'
          : `★ 第${segmentIndex + 1}段：形态/色彩/运动的演化展开`,
      ending: '整体目标：创造一段完整的视觉艺术旅程，从引入到高潮到收尾。',
    },
    interior: {
      identity: [
        '【室内空间视觉绝对一致】',
        `• 空间格局在所有${totalSegments}个片段中完全相同：${allAnchors.slice(0, 4).join(' / ') || '房间布局、家具位置、装修风格'}`,
        '• 材质和色彩一致：墙面/地面/家具的材质纹理不变',
        '• 光源位置和强度一致：灯具位置固定，光线效果连贯',
        '• 空间漫游路径有逻辑：从A区域到B区域的移动应自然',
      ],
      transition: isFirst
        ? '★ 开场：从入口进入，建立空间的整体印象'
        : isLast
          ? '★ 收尾：回到最佳角度，留下完整的居住理想印象'
          : `★ 第${segmentIndex + 1}段：探索设计细节或生活气息`,
      ending: '整体目标：展现一个令人向往的生活空间，传递设计美学和居住舒适度。',
    },
  };

  const rules = sceneRules[sceneType] || sceneRules.portrait;

  return `
【连贯性要求 — ${sceneType === 'portrait' ? '人像' : sceneType === 'product' ? '产品' : sceneType === 'landscape' ? '风景' : sceneType === 'food' ? '美食' : sceneType === 'drama' ? '剧情' : sceneType === 'abstract' ? '抽象' : '室内'}场景专属】

这是整个视频的第 ${segmentIndex + 1}/${totalSegments} 个片段。

${rules.identity.join('\n')}

${rules.transition}

${isFirst ? '\n【开场特别要求】\n• 用前3秒建立完整的视觉基调\n• 不要急于进入细节，先让眼睛适应画面\n• 可以有轻微的入场动作或镜头运动' : ''}

${isLast ? '\n【收尾特别要求】\n• 给观众2-3秒的"消化时间"\n• 最终画面应有"完成感"或"余韵感"\n• 可以有极慢的淡出或定格' : ''}

${isMiddle ? `\n【中间段特别要求 — 第${segmentIndex + 1}/${totalSegments}段】\n• 必须与第${segmentIndex}段的结尾无缝衔接\n• 开头先复现上一段末尾的角色站位、手部动作、视线方向和关键道具状态，再推进新信息\n• 运镜方向和速度应有变化但不过于突兀\n• 信息量应比前一段有所增加（递进原则）` : ''}

---
${rules.ending}
`.trim();
}
