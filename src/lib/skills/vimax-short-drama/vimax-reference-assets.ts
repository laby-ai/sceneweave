import type { VimaxAgentPlan } from '@/lib/skills/vimax-short-drama/vimax-agent-contract';
import {
  buildVimaxContinuityPrompt,
  type VimaxContinuityContract,
} from '@/lib/skills/vimax-short-drama/vimax-continuity-contract';
import type { VimaxSkillPreset } from '@/lib/skills/vimax-short-drama/vimax-skill-presets';

interface ReferenceTarget {
  kind: 'shot' | 'character' | 'scene' | 'prop' | 'reference';
  label: string;
  prompt: string;
  shotIndex?: number;
}

async function generateOneImage(
  target: ReferenceTarget,
  config: { imageApiBase: string; imageApiKey: string; imageModel: string },
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let response: Response;
  try {
    response = await fetch(`${config.imageApiBase}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.imageApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.imageModel,
        prompt: target.prompt,
        size: '2560x1440',
        response_format: 'url',
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`参考图生成超时（60s）：${target.label}。`);
    }
    throw error;
  }
  clearTimeout(timeout);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error?.message === 'string' ? data.error.message : response.statusText;
    throw new Error(`参考图生成失败：${target.label} - ${message}`);
  }
  const url = data?.data?.[0]?.url || data?.imageUrls?.[0] || data?.url;
  if (typeof url !== 'string' || !url) throw new Error(`参考图服务未返回 ${target.label} 的图片 URL。`);
  return { ...target, url, status: 'generated' as const };
}

function appendPresetDirection(prompt: string, preset: VimaxSkillPreset) {
  return [
    prompt,
    `创作类型：${preset.name}。`,
    `创作目标：${preset.description}。`,
    `视觉风格：${preset.style}。`,
    '保持主体与场景连续，不要字幕，不要水印。',
  ].join(' ').trim();
}

export async function callVimaxReferenceImages(input: {
  plan: VimaxAgentPlan;
  preset: VimaxSkillPreset;
  continuity: VimaxContinuityContract;
  config: { imageApiBase: string; imageApiKey: string; imageModel: string };
}) {
  if (!input.config.imageApiKey) throw new Error('缺少图像模型 API Key，无法进入参考素材阶段。');
  const characterHint = input.plan.assets
    .filter(asset => ['character', 'scene', 'prop'].includes(asset.kind))
    .map(asset => `${asset.label}: ${asset.prompt}`)
    .join('；')
    .slice(0, 600);
  const targets: ReferenceTarget[] = [];

  if (input.plan.shots.length > 0) {
    for (const shot of input.plan.shots.slice(0, 8)) {
      const base = shot.prompt || `${shot.title}, ${shot.camera}`;
      targets.push({
        kind: 'shot',
        label: `Clip ${shot.index} · ${shot.title}`,
        shotIndex: shot.index,
        prompt: appendPresetDirection([
          characterHint ? `${base}。角色与场景设定参考：${characterHint}` : base,
          buildVimaxContinuityPrompt(input.continuity, Math.max(0, shot.index - 1)),
        ].join('\n'), input.preset),
      });
    }
  } else {
    for (const asset of input.plan.assets.filter(asset => ['character', 'scene', 'prop', 'reference'].includes(asset.kind)).slice(0, 6)) {
      targets.push({
        kind: asset.kind === 'script' || asset.kind === 'shot' ? 'reference' : asset.kind,
        label: asset.label,
        prompt: appendPresetDirection(asset.prompt || `${asset.label}, cinematic reference image, clean composition`, input.preset),
      });
    }
  }
  if (targets.length === 0) throw new Error('当前计划没有可用于生成参考素材的提示词。');

  const settled = await Promise.allSettled(targets.map(target => generateOneImage(target, input.config)));
  const assets = settled
    .filter((result): result is PromiseFulfilledResult<ReferenceTarget & { url: string; status: 'generated' }> => result.status === 'fulfilled')
    .map(result => result.value);
  if (assets.length === 0) {
    const firstError = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    throw new Error(firstError?.reason instanceof Error ? firstError.reason.message : '参考图全部生成失败。');
  }
  return { model: input.config.imageModel, assets };
}
