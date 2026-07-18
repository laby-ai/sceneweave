import { mergeVideosWithLocalFfmpeg } from '@/lib/local-video-merge';
import { extractLastFrameForHandoff } from '@/lib/video-frame-extraction';
import {
  submitVideoWithBYOK,
  waitForVideoWithBYOK,
  type BYOKConnection,
} from '@/lib/byok-provider';
import type { VimaxAgentPlan } from '@/lib/skills/vimax-short-drama/vimax-agent-contract';
import type { VimaxSkillPreset } from '@/lib/skills/vimax-short-drama/vimax-skill-presets';
import {
  buildVimaxContinuityPrompt,
  type VimaxContinuityContract,
} from '@/lib/skills/vimax-short-drama/vimax-continuity-contract';

interface HappyHorseVimaxSegment {
  shotIndex: number;
  shotTitle: string;
  duration: number;
  taskId: string;
  videoUrl: string;
  lastFrameUrl?: string;
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
) {
  const model = connection.videoModel || connection.model;
  if (!model) throw new Error('快乐马连接缺少视频模型。');
  const shots = (Array.isArray(plan.shots) ? plan.shots : [])
    .filter(shot => shot && (shot.prompt || shot.title))
    .slice(0, 8);
  if (!shots.length) throw new Error('缺少可用于视频生成的分镜。');

  const segments: HappyHorseVimaxSegment[] = [];
  const seed = stableSeed(plan, preset);
  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index];
    const duration = clampDuration(shot.duration);
    const task = await submitVideoWithBYOK(connection, {
      model,
      prompt: buildPrompt(plan, shot, preset, continuity, index, shots[index - 1]),
      duration,
      ratio: options.ratio || '16:9',
      resolution: options.resolution || '720P',
      watermark: false,
      seed,
    });
    const completed = await waitForVideoWithBYOK(connection, task.taskId, undefined, {
      maxAttempts: 120,
      intervalMs: 5000,
    });
    segments.push(await ensureLastFrame({
      shotIndex: shot.index,
      shotTitle: shot.title || `Clip ${shot.index}`,
      duration,
      taskId: task.taskId,
      videoUrl: completed.videoUrl,
      lastFrameUrl: completed.lastFrameUrl,
    }));
  }

  let videoUrl = segments[0]?.videoUrl;
  let merge: { bytes?: number; segmentCount?: number } = {};
  if (segments.length > 1) {
    const merged = await mergeVideosWithLocalFfmpeg(segments.map(segment => segment.videoUrl));
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
