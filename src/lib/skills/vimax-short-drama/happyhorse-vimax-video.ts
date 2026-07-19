import { mergeVideosWithLocalFfmpeg } from '@/lib/local-video-merge';
import { extractLastFrameForHandoff } from '@/lib/video-frame-extraction';
import {
  submitVideoWithBYOK,
  getVideoStatusWithBYOK,
  waitForVideoWithBYOK,
  type BYOKConnection,
} from '@/lib/byok-provider';
import {
  buildHappyHorsePublicTaskListUrl,
  buildHappyHorseVideoTaskListUrl,
  getHappyHorseProviderErrorMessage,
  parseHappyHorseVideoTaskList,
} from '@/lib/happyhorse-video-provider';
import { isHappyHorseR2VModel } from '@/lib/happyhorse-r2v-adapter';
import type {
  VimaxAgentPlan,
  VimaxAgentReferenceAsset,
} from '@/lib/skills/vimax-short-drama/vimax-agent-contract';
import type { VimaxSkillPreset } from '@/lib/skills/vimax-short-drama/vimax-skill-presets';
import {
  buildVimaxContinuityPrompt,
  type VimaxContinuityContract,
} from '@/lib/skills/vimax-short-drama/vimax-continuity-contract';
import {
  buildHappyHorseR2VReferenceManifest,
  buildHappyHorseR2VReferencePrompt,
  type HappyHorseR2VReferenceManifest,
} from '@/lib/skills/vimax-short-drama/happyhorse-r2v-reference-manifest';

export interface HappyHorseVimaxSegment {
  shotIndex: number;
  shotTitle: string;
  duration: number;
  taskId: string;
  status?: 'submitted' | 'succeeded';
  videoUrl?: string;
  lastFrameUrl?: string;
  referenceManifest?: HappyHorseR2VReferenceManifest;
}

type HappyHorseSegmentObserver = (segment: HappyHorseVimaxSegment) => void | Promise<void>;

export function selectHappyHorseR2VReferenceImages(
  assets: VimaxAgentReferenceAsset[],
  shotIndex: number,
  previousLastFrameUrl?: string,
): string[] {
  return buildHappyHorseR2VReferenceManifest({
    assets,
    shotIndex,
    artifactRevision: 'selection-only',
    previousLastFrameUrl,
  }).entries.map(entry => entry.url);
}

function clampDuration(value: unknown): number {
  return Math.max(1, Math.min(10, Math.floor(Number(value) || 5)));
}

function stableSeed(plan: VimaxAgentPlan, preset: VimaxSkillPreset): number {
  const source = `${preset.id}:${plan.title}:${plan.summary || ''}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 2_147_483_647;
}

function buildPrompt(
  plan: VimaxAgentPlan,
  shot: VimaxAgentPlan['shots'][number],
  preset: VimaxSkillPreset,
  continuity: VimaxContinuityContract,
  shotIndex: number,
  previous?: VimaxAgentPlan['shots'][number],
): string {
  return [
    shot.prompt || `${shot.title}，${plan.summary || plan.title}`,
    shot.camera ? `运镜：${shot.camera}` : '',
    previous ? `承接上一镜“${previous.title}”的结束动作、人物朝向、服饰、场景和光线，从同一时刻继续。` : '',
    buildVimaxContinuityPrompt(continuity, shotIndex),
    `创作类型：${preset.name}。创作目标：${preset.description}。视觉风格：${preset.style}。`,
    '保持同一作品的主体、场景、光线和道具连续，镜头之间自然衔接，不要字幕，不要水印。',
  ].filter(Boolean).join(' ').trim();
}

async function ensureLastFrame(segment: HappyHorseVimaxSegment): Promise<HappyHorseVimaxSegment> {
  if (!segment.videoUrl) return segment;
  if (segment.lastFrameUrl) return segment;
  const extracted = await extractLastFrameForHandoff(segment.videoUrl);
  return extracted.lastFrameUrl ? { ...segment, lastFrameUrl: extracted.lastFrameUrl } : segment;
}

export async function callHappyHorseVimaxVideo(
  plan: VimaxAgentPlan,
  preset: VimaxSkillPreset,
  connection: BYOKConnection,
  options: { ratio?: string; resolution?: string },
  continuity: VimaxContinuityContract,
  referenceAssets: VimaxAgentReferenceAsset[] = [],
  onSegmentState?: HappyHorseSegmentObserver,
  knownSegments: HappyHorseVimaxSegment[] = [],
) {
  const model = connection.videoModel || connection.model;
  if (!model) throw new Error('快乐马连接缺少视频模型。');
  const shots = (Array.isArray(plan.shots) ? plan.shots : [])
    .filter(shot => shot && (shot.prompt || shot.title))
    .slice(0, 8);
  if (!shots.length) throw new Error('缺少可用于视频生成的分镜。');

  const segments: HappyHorseVimaxSegment[] = [];
  const knownByShot = new Map(knownSegments
    .filter(segment => segment?.taskId)
    .map(segment => [segment.shotIndex, segment] as const));
  const seed = stableSeed(plan, preset);
  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index];
    const duration = clampDuration(shot.duration);
    const known = knownByShot.get(shot.index);
    if (known) {
      const completed = known.videoUrl
        ? known
        : await waitForVideoWithBYOK(connection, known.taskId, undefined, {
          maxAttempts: 120,
          intervalMs: 5000,
        }).then(status => ({
          ...known,
          status: 'succeeded' as const,
          videoUrl: status.videoUrl,
          lastFrameUrl: status.lastFrameUrl,
        }));
      const segment = await ensureLastFrame({
        ...completed,
        shotIndex: shot.index,
        shotTitle: shot.title || `Clip ${shot.index}`,
        duration,
        status: 'succeeded',
      });
      segments.push(segment);
      await onSegmentState?.(segment);
      continue;
    }
    const referenceManifest = isHappyHorseR2VModel(model)
      ? buildHappyHorseR2VReferenceManifest({
        assets: referenceAssets,
        shotIndex: shot.index,
        artifactRevision: continuity.artifactRevision,
        previousLastFrameUrl: segments[index - 1]?.lastFrameUrl,
      })
      : undefined;
    const referenceImages = referenceManifest?.entries.map(entry => entry.url) || [];
    if (isHappyHorseR2VModel(model) && referenceImages.length === 0) {
      throw new Error(`镜头 ${shot.index} 缺少已批准参考图，未提交付费视频任务。`);
    }
    const task = await submitVideoWithBYOK(connection, {
      model,
      prompt: [
        buildPrompt(plan, shot, preset, continuity, index, shots[index - 1]),
        referenceManifest ? buildHappyHorseR2VReferencePrompt(referenceManifest) : '',
      ].filter(Boolean).join('\n'),
      duration,
      ratio: options.ratio || '16:9',
      resolution: options.resolution || '720P',
      watermark: false,
      seed,
      ...(referenceImages.length > 0 ? { referenceImages } : {}),
    });
    await onSegmentState?.({
      shotIndex: shot.index,
      shotTitle: shot.title || `Clip ${shot.index}`,
      duration,
      taskId: task.taskId,
      status: 'submitted',
      ...(referenceManifest ? { referenceManifest } : {}),
    });
    const completed = await waitForVideoWithBYOK(connection, task.taskId, undefined, {
      maxAttempts: 120,
      intervalMs: 5000,
    });
    const segment = await ensureLastFrame({
      shotIndex: shot.index,
      shotTitle: shot.title || `Clip ${shot.index}`,
      duration,
      taskId: task.taskId,
      status: 'succeeded',
      videoUrl: completed.videoUrl,
      lastFrameUrl: completed.lastFrameUrl,
      ...(referenceManifest ? { referenceManifest } : {}),
    });
    segments.push(segment);
    await onSegmentState?.(segment);
  }

  let videoUrl = segments[0]?.videoUrl;
  let merge: { bytes?: number; segmentCount?: number } = {};
  if (segments.length > 1) {
    const merged = await mergeVideosWithLocalFfmpeg(segments.map(segment => segment.videoUrl as string));
    videoUrl = merged.videoUrl;
    merge = { bytes: merged.bytes, segmentCount: merged.segmentCount };
  }
  if (!videoUrl) throw new Error('视频片段已生成，但没有可返回的成片 URL。');
  return {
    model,
    videoUrl,
    duration: segments.reduce((sum, segment) => sum + segment.duration, 0),
    segments,
    segmentCount: segments.length,
    merge,
    shotTitle: segments.length > 1 ? '完整成片' : segments[0]?.shotTitle,
  };
}

function formatDashScopeTime(timestamp: number) {
  const beijing = new Date(timestamp + 8 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${beijing.getUTCFullYear()}${pad(beijing.getUTCMonth() + 1)}${pad(beijing.getUTCDate())}${pad(beijing.getUTCHours())}${pad(beijing.getUTCMinutes())}${pad(beijing.getUTCSeconds())}`;
}

export async function recoverHappyHorseVimaxVideo(
  plan: VimaxAgentPlan,
  connection: BYOKConnection,
  options: { createdAfter: number; createdBefore?: number },
  knownSegments: HappyHorseVimaxSegment[] = [],
) {
  const model = connection.videoModel || connection.model;
  if (!model) throw new Error('快乐马连接缺少视频模型。');
  const shots = (Array.isArray(plan.shots) ? plan.shots : [])
    .filter(shot => shot && (shot.prompt || shot.title))
    .slice(0, 8);
  if (!shots.length) throw new Error('缺少可用于恢复视频的分镜。');

  const knownByShot = new Map(knownSegments
    .filter(segment => segment?.taskId)
    .map(segment => [segment.shotIndex, segment] as const));
  let selected = shots.map(shot => knownByShot.get(shot.index)).filter(Boolean) as HappyHorseVimaxSegment[];
  if (selected.length !== shots.length) {
    const listUrl = buildHappyHorseVideoTaskListUrl(connection.apiBase, {
    startTime: formatDashScopeTime(options.createdAfter - 2 * 60 * 1000),
    endTime: formatDashScopeTime(options.createdBefore || Date.now()),
    model,
  });
    const requestInit: RequestInit = {
      method: 'GET',
      headers: { Authorization: `Bearer ${connection.apiKey}`, 'Content-Type': 'application/json' },
    };
    let response = await fetch(listUrl, requestInit);
    let payload = await response.json().catch(() => ({}));
    if ((response.status === 401 || response.status === 403)
      && new URL(listUrl).hostname !== 'dashscope.aliyuncs.com') {
      response = await fetch(buildHappyHorsePublicTaskListUrl(listUrl), requestInit);
      payload = await response.json().catch(() => ({}));
    }
    if (!response.ok) {
      throw new Error(`快乐马任务恢复失败：${getHappyHorseProviderErrorMessage(payload, response.status)}`);
    }
    const listed = parseHappyHorseVideoTaskList(payload)
      .filter(item => item.model === model && item.status.toUpperCase() === 'SUCCEEDED');
    if (listed.length < shots.length) {
      throw new Error(`仅找回 ${listed.length}/${shots.length} 个已成功片段；未重新提交生成，请稍后再恢复。`);
    }
    selected = listed.slice(-shots.length).map((item, index) => ({
      shotIndex: shots[index].index,
      shotTitle: shots[index].title || `Clip ${shots[index].index}`,
      duration: clampDuration(shots[index].duration),
      taskId: item.taskId,
    }));
  }
  const segments: HappyHorseVimaxSegment[] = [];
  for (let index = 0; index < selected.length; index += 1) {
    const item = selected[index];
    const status = await getVideoStatusWithBYOK(connection, item.taskId);
    if (status.status !== 'succeeded' || !status.videoUrl) {
      throw new Error(`第 ${index + 1} 个片段尚未形成可交付结果；未重新提交生成。`);
    }
    segments.push({
      shotIndex: shots[index].index,
      shotTitle: shots[index].title || `Clip ${shots[index].index}`,
      duration: clampDuration(shots[index].duration),
      taskId: item.taskId,
      status: 'succeeded',
      videoUrl: status.videoUrl,
      lastFrameUrl: status.lastFrameUrl,
      ...(item.referenceManifest ? { referenceManifest: item.referenceManifest } : {}),
    });
  }

  let videoUrl = segments[0]?.videoUrl;
  let merge: { bytes?: number; segmentCount?: number; renderReport?: unknown } = {};
  if (segments.length > 1) {
    const merged = await mergeVideosWithLocalFfmpeg(segments.map(segment => segment.videoUrl as string), {
      expectedDurationSeconds: segments.reduce((sum, segment) => sum + segment.duration, 0),
    });
    videoUrl = merged.videoUrl;
    merge = { bytes: merged.bytes, segmentCount: merged.segmentCount, renderReport: merged.renderReport };
  }
  if (!videoUrl) throw new Error('已找回视频片段，但没有可返回的成片 URL。');
  return {
    model,
    videoUrl,
    duration: segments.reduce((sum, segment) => sum + segment.duration, 0),
    segments,
    segmentCount: segments.length,
    merge,
    shotTitle: segments.length > 1 ? '完整成片' : segments[0]?.shotTitle,
  };
}
