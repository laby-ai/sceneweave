import type {
  VimaxAgentPlan,
  VimaxAgentReferenceAsset,
} from '@/lib/skills/vimax-short-drama/vimax-agent-contract';
import { imageWithBYOK } from '@/lib/byok-provider';
import {
  buildVimaxContinuityPrompt,
  type VimaxContinuityContract,
} from '@/lib/skills/vimax-short-drama/vimax-continuity-contract';
import {
  isVimaxImageSelectorReady,
  selectVimaxBestImageCandidate,
  type VimaxImageSelectorConfig,
} from '@/lib/skills/vimax-short-drama/vimax-first-frame-selector';
import type { VimaxSkillPreset } from '@/lib/skills/vimax-short-drama/vimax-skill-presets';

interface ReferenceTarget {
  kind: 'shot' | 'character' | 'scene' | 'prop' | 'reference';
  label: string;
  prompt: string;
  shotIndex?: number;
  subjectId?: string;
  subjectView?: VimaxSubjectView;
  selectedSubjectViews?: VimaxSelectedSubjectView[];
}

interface VimaxReferenceAssetConfig extends VimaxImageSelectorConfig {
  imageApiBase: string;
  imageApiKey: string;
  imageModel: string;
}

export type VimaxSubjectView = 'front' | 'side' | 'back';

export interface VimaxSubjectReferenceView {
  id: string;
  view: VimaxSubjectView;
  url: string;
  description: string;
}

export interface VimaxSubjectReference {
  id: string;
  label: string;
  description: string;
  views: VimaxSubjectReferenceView[];
}

export interface VimaxSubjectReferenceRegistry {
  version: 'sceneweave-subject-reference-registry-v1';
  subjects: VimaxSubjectReference[];
}

export interface VimaxSelectedSubjectView {
  subjectId: string;
  label: string;
  view: VimaxSubjectView;
  viewId: string;
  url: string;
}

async function generateOneImage(
  target: ReferenceTarget,
  config: VimaxReferenceAssetConfig,
  referenceImages: string[] = [],
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const generated = await imageWithBYOK({
      provider: 'openai-compatible',
      apiBase: config.imageApiBase,
      apiKey: config.imageApiKey,
      imageModel: config.imageModel,
    }, {
      model: config.imageModel,
      prompt: target.prompt,
      size: '2560x1440',
      n: 1,
      referenceImages,
      signal: controller.signal,
    });
    return { ...target, url: generated.url, status: 'generated' as const };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`参考图生成超时（60s）：${target.label}。`);
    }
    throw new Error(`参考图生成失败：${target.label} - ${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function generateImageCandidates(
  target: ReferenceTarget,
  config: VimaxReferenceAssetConfig,
  referenceImages: string[],
  count: number,
) {
  const candidates: Awaited<ReturnType<typeof generateOneImage>>[] = [];
  for (let index = 0; index < count; index += 1) {
    candidates.push(await generateOneImage(target, config, referenceImages));
  }
  return candidates;
}

async function generateReferenceTarget(input: {
  target: ReferenceTarget;
  config: VimaxReferenceAssetConfig;
  firstShotIndex?: number;
  initialReferenceAssets?: VimaxAgentReferenceAsset[];
}) {
  const initialReferences = (input.initialReferenceAssets || [])
    .filter(asset => typeof asset.url === 'string' && asset.url.length > 0);
  const referenceImages = [...new Set([
    ...initialReferences.map(asset => asset.url as string),
    ...(input.target.selectedSubjectViews?.map(item => item.url) || []),
  ])].slice(0, 9);
  const referenceContext = initialReferences.map((asset, index) => {
    const role = asset.kind === 'character' ? '角色' : asset.kind === 'scene' ? '场景' : asset.kind === 'prop' ? '道具' : '视觉参考';
    return `图${index + 1}是${role}「${asset.label}」`;
  }).join('；');
  const target = referenceContext
    ? { ...input.target, prompt: `${input.target.prompt}\n参考素材约束：${referenceContext}。必须保持对应身份、场景和道具，不得互换。` }
    : input.target;
  const selectorReady = isVimaxImageSelectorReady(input.config);
  const candidateCount = selectorReady
    && target.kind === 'shot'
    && target.shotIndex === input.firstShotIndex ? 3 : 1;
  const candidates = await generateImageCandidates(
    target,
    input.config,
    referenceImages,
    candidateCount,
  );
  const candidateUrls = candidates.map(candidate => candidate.url);
  const selection = await selectVimaxBestImageCandidate({
    targetDescription: input.target.prompt,
    referenceImages,
    candidateUrls,
    config: input.config,
  });
  return {
    ...candidates[selection.index],
    candidateUrls,
    selectedCandidateIndex: selection.index,
    selectionReason: selection.reason,
  };
}

function subjectPortraitPrompt(input: {
  label: string;
  description: string;
  style: string;
  view: VimaxSubjectView;
}) {
  if (input.view === 'front') {
    return [
      `角色 ${input.label}：${input.description}。`,
      '生成全身正面角色定妆参考图，角色直视镜头，双臂自然下垂。',
      '16:9 横向纯白背景，人物居中，保留足够横向留白。',
      `全片风格：${input.style}。人物身份、脸型、发型、服饰和配饰必须明确且可复用。`,
    ].join(' ');
  }
  return [
    `角色 ${input.label}：${input.description}。`,
    input.view === 'side'
      ? '严格参考已提供的正面定妆图，生成同一角色的全身左侧面参考图。'
      : '严格参考已提供的正面定妆图，生成同一角色的全身背面参考图，不显示面部。',
    '16:9 横向纯白背景，人物居中；脸型、发型、体型、服饰、鞋和配饰不得变化。',
    `全片风格：${input.style}。`,
  ].join(' ');
}

async function generateSubjectReferenceRegistry(input: {
  plan: VimaxAgentPlan;
  preset: VimaxSkillPreset;
  continuity: VimaxContinuityContract;
  config: VimaxReferenceAssetConfig;
  initialReferenceAssets?: VimaxAgentReferenceAsset[];
}): Promise<VimaxSubjectReferenceRegistry> {
  const allCharacterAssets = input.plan.assets.filter(asset => asset.kind === 'character');
  const placeholderLabels = new Set(['主角', '短剧主角', '角色', '核心角色']);
  const explicitCharacterAssets = allCharacterAssets.filter(asset => !placeholderLabels.has(asset.label.trim()));
  const characterAssets = (explicitCharacterAssets.length > 0 ? explicitCharacterAssets : allCharacterAssets).slice(0, 3);
  const subjects: VimaxSubjectReference[] = [];

  for (const [index, asset] of characterAssets.entries()) {
    const subjectId = `subject-${index + 1}`;
    const description = [asset.prompt, input.continuity.subjectBible, input.continuity.wardrobe]
      .filter(Boolean)
      .join('；');
    const frontTarget: ReferenceTarget = {
      kind: 'character',
      label: `${asset.label} · 正面定妆`,
      prompt: subjectPortraitPrompt({
        label: asset.label,
        description,
        style: input.preset.style,
        view: 'front',
      }),
      subjectId,
      subjectView: 'front',
    };
    const initialReferenceUrls = (input.initialReferenceAssets || [])
      .flatMap(asset => typeof asset.url === 'string' && asset.url ? [asset.url] : [])
      .slice(0, 9);
    const front = await generateOneImage(frontTarget, input.config, initialReferenceUrls);
    const views: VimaxSubjectReferenceView[] = [{
      id: `${subjectId}-front`,
      view: 'front',
      url: front.url,
      description: `${asset.label} 的正面全身定妆参考。`,
    }];

    for (const view of ['side', 'back'] as const) {
      const target: ReferenceTarget = {
        kind: 'character',
        label: `${asset.label} · ${view === 'side' ? '侧面' : '背面'}定妆`,
        prompt: subjectPortraitPrompt({
          label: asset.label,
          description,
          style: input.preset.style,
          view,
        }),
        subjectId,
        subjectView: view,
      };
      const generated = await generateOneImage(
        target,
        input.config,
        [...new Set([front.url, ...initialReferenceUrls])].slice(0, 9),
      );
      views.push({
        id: `${subjectId}-${view}`,
        view,
        url: generated.url,
        description: `${asset.label} 的${view === 'side' ? '侧面' : '背面'}全身定妆参考。`,
      });
    }
    subjects.push({ id: subjectId, label: asset.label, description, views });
  }

  return { version: 'sceneweave-subject-reference-registry-v1', subjects };
}

function inferSubjectView(text: string): VimaxSubjectView {
  if (/(背面|背影|背对|后脑|from behind|back view)/i.test(text)) return 'back';
  if (/(侧面|侧身|侧脸|侧拍|profile|side view)/i.test(text)) return 'side';
  return 'front';
}

function selectSubjectViews(registry: VimaxSubjectReferenceRegistry, text: string): VimaxSelectedSubjectView[] {
  const namedSubjects = registry.subjects.filter(subject => text.includes(subject.label));
  const subjects = namedSubjects.length > 0
    ? namedSubjects
    : registry.subjects.length === 1 ? registry.subjects : registry.subjects.slice(0, 2);
  const view = inferSubjectView(text);
  return subjects.flatMap(subject => {
    const selected = subject.views.find(item => item.view === view) || subject.views[0];
    return selected ? [{
      subjectId: subject.id,
      label: subject.label,
      view: selected.view,
      viewId: selected.id,
      url: selected.url,
    }] : [];
  });
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
  config: VimaxReferenceAssetConfig;
  existingAssets?: VimaxAgentReferenceAsset[];
  existingSubjectRegistry?: VimaxSubjectReferenceRegistry;
  initialReferenceAssets?: VimaxAgentReferenceAsset[];
}) {
  if (!input.config.imageApiKey) throw new Error('缺少图像模型 API Key，无法进入参考素材阶段。');
  const subjectRegistry = input.existingSubjectRegistry || await generateSubjectReferenceRegistry(input);
  const characterHint = input.plan.assets
    .filter(asset => ['character', 'scene', 'prop'].includes(asset.kind))
    .map(asset => `${asset.label}: ${asset.prompt}`)
    .join('；')
    .slice(0, 600);
  const targets: ReferenceTarget[] = [];

  if (input.plan.shots.length > 0) {
    for (const shot of input.plan.shots.slice(0, 8)) {
      const existing = input.existingAssets?.find(asset => (
        asset.kind === 'shot'
        && asset.shotIndex === shot.index
        && typeof asset.url === 'string'
        && asset.url.length > 0
      ));
      if (existing) continue;
      const base = shot.prompt || `${shot.title}, ${shot.camera}`;
      const selectedSubjectViews = selectSubjectViews(
        subjectRegistry,
        [shot.title, shot.camera, shot.prompt].filter(Boolean).join(' '),
      );
      targets.push({
        kind: 'shot',
        label: `Clip ${shot.index} · ${shot.title}`,
        shotIndex: shot.index,
        selectedSubjectViews,
        prompt: appendPresetDirection([
          characterHint ? `${base}。角色与场景设定参考：${characterHint}` : base,
          selectedSubjectViews.length > 0
            ? `本镜角色参考：${selectedSubjectViews.map(item => `${item.label}使用${item.view === 'front' ? '正面' : item.view === 'side' ? '侧面' : '背面'}定妆`).join('；')}。`
            : '',
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
  if (targets.length === 0 && input.plan.shots.length === 0) {
    throw new Error('当前计划没有可用于生成参考素材的提示词。');
  }

  const settled = await Promise.allSettled(targets.map(target => generateReferenceTarget({
    target,
    config: input.config,
    firstShotIndex: input.plan.shots[0]?.index,
    initialReferenceAssets: input.initialReferenceAssets,
  })));
  const generatedTargets = settled.flatMap(result => (
    result.status === 'fulfilled' ? [result.value] : []
  ));
  if (generatedTargets.length === 0 && targets.length > 0 && input.plan.shots.length === 0) {
    const firstError = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    throw new Error(firstError?.reason instanceof Error ? firstError.reason.message : '参考图全部生成失败。');
  }
  const failedShotIndices = settled.flatMap((result, index) => (
    result.status === 'rejected' && typeof targets[index]?.shotIndex === 'number'
      ? [targets[index].shotIndex]
      : []
  ));
  const portraitAssets: VimaxAgentReferenceAsset[] = subjectRegistry.subjects.flatMap(subject => subject.views.map(view => ({
    kind: 'character' as const,
    label: `${subject.label} · ${view.view === 'front' ? '正面' : view.view === 'side' ? '侧面' : '背面'}定妆`,
    prompt: view.description,
    url: view.url,
    status: 'generated' as const,
    subjectId: subject.id,
    subjectView: view.view,
  })));
  const shotAssetsByIndex = new Map<number, VimaxAgentReferenceAsset>();
  for (const asset of [...(input.existingAssets || []), ...generatedTargets]) {
    if (asset.kind === 'shot' && typeof asset.shotIndex === 'number' && asset.url) {
      shotAssetsByIndex.set(asset.shotIndex, asset);
    }
  }
  const shotAssets = input.plan.shots
    .slice(0, 8)
    .flatMap(shot => {
      const asset = shotAssetsByIndex.get(shot.index);
      return asset ? [asset] : [];
    });
  return {
    model: input.config.imageModel,
    subjectRegistry,
    assets: [...portraitAssets, ...shotAssets],
    complete: shotAssets.length === input.plan.shots.slice(0, 8).length,
    failedShotIndices,
  };
}
