import { computeProductionArtifactRevision } from '@/lib/production-artifact-stale';
import type { ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import type { ProductionProject } from '@/lib/production-project';

export type VimaxProviderHandoffMode = 'frame-handoff' | 'text-anchors';

export interface VimaxProviderHandoff {
  mode: VimaxProviderHandoffMode;
  provider: string;
  model: string;
  supportsFirstFrame: boolean;
  supportsReferenceImages: boolean;
  locked: true;
  limitation: string;
}

export interface VimaxContinuityShot {
  shotId: string;
  previousShotId: string | null;
  dependency: string;
  actionStart: string;
  actionEnd: string;
  screenDirection: string;
  framing: string;
  lightingPalette: string;
  audioCue: string;
  narrativeCause: string;
  assetAnchors?: string[];
}

export interface VimaxContinuityContract {
  version: 'sceneweave-continuity-contract-v1';
  artifactRevision: string;
  providerHandoff: VimaxProviderHandoff;
  subjectBible: string;
  wardrobe: string;
  scene: string;
  props: string[];
  shots: VimaxContinuityShot[];
}

interface ProviderHandoffInput {
  provider: string;
  model: string;
}

interface BuildContinuityContractInput {
  productionProject: ProductionProject;
  assemblyPlan: ProductionAssemblyPlan;
  providerHandoff: VimaxProviderHandoff;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compact(value: unknown, fallback: string) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function isGlobalAsset(asset: ProductionProject['assets'][number], allShotIds: string[]) {
  const relatedShotIds = asset.relatedShotIds || [];
  return relatedShotIds.length === 0 || allShotIds.every(shotId => relatedShotIds.includes(shotId));
}

function assetSummary(project: ProductionProject, kind: string, fallback: string, allShotIds: string[]) {
  const assets = project.assets.filter(asset => asset.kind === kind && isGlobalAsset(asset, allShotIds));
  if (assets.length === 0) return fallback;
  return assets.map(asset => `${asset.name}：${asset.summary}`).join('；');
}

function inferScreenDirection(text: string) {
  const direction = text.match(/(从画面左侧[^。；]*右侧|从左向右|由左向右|朝画面右侧|向右|从画面右侧[^。；]*左侧|从右向左|由右向左|朝画面左侧|向左|保持轴线)/)?.[0];
  return direction || '保持上一镜人物朝向、运动轴线和场景方位；不得无因反打或越轴。';
}

function inferLighting(project: ProductionProject) {
  const sceneBible = project.semanticPlan.sceneBibles[0];
  const candidate = [
    sceneBible?.lighting,
    sceneBible?.atmosphere,
    project.style,
  ].find(value => typeof value === 'string' && value.trim());
  return compact(candidate, project.style || '保持全片色温、主光方向和对比度一致。');
}

export function resolveVimaxProviderHandoffMode(input: ProviderHandoffInput): VimaxProviderHandoff {
  const provider = compact(input.provider, 'unknown-provider');
  const model = compact(input.model, 'unknown-model');
  const normalized = `${provider} ${model}`.toLowerCase();
  const supportsFirstFrame = /(ark-video|seedance)/.test(normalized)
    && !/(happyhorse|t2v-only)/.test(normalized);

  return {
    mode: supportsFirstFrame ? 'frame-handoff' : 'text-anchors',
    provider,
    model,
    supportsFirstFrame,
    supportsReferenceImages: supportsFirstFrame,
    locked: true,
    limitation: supportsFirstFrame
      ? '相邻镜头必须绑定上一镜尾帧作为下一镜首帧，并同时保留文本连续性锚点。'
      : '当前供应商仅支持文本生成视频；不能声称绑定首尾帧，只能使用稳定角色、场景、道具、动作和构图锚点。',
  };
}

export function buildVimaxContinuityContract(input: BuildContinuityContractInput): VimaxContinuityContract {
  const { productionProject: project, assemblyPlan } = input;
  const allShotIds = project.storyboard.shots.map(shot => shot.id);
  const lightingPalette = inferLighting(project);
  const shots = assemblyPlan.segments.map((segment, index) => {
    const frame = segment.shotFrameContract;
    const story = segment.storySegmentContract;
    const projectShot = project.storyboard.shots.find(shot => shot.id === segment.shotId)
      || project.storyboard.shots[index];
    const directionSource = [
      projectShot?.prompt,
      frame.handoff.entryContinuity,
      frame.handoff.exitContinuity,
      frame.motionDescription,
    ].filter(Boolean).join(' ');

    return {
      shotId: segment.shotId,
      previousShotId: frame.handoff.previousShotId,
      dependency: story.dependencyContract.previousSegmentId
        ? `必须承接片段 ${story.dependencyContract.previousSegmentId} 的最后成功状态。`
        : '首镜建立人物、场景、道具和空间轴线。',
      actionStart: compact(frame.handoff.entryContinuity, frame.firstFrame.description),
      actionEnd: compact(frame.handoff.exitContinuity, frame.lastFrame.description),
      screenDirection: inferScreenDirection(directionSource),
      framing: compact(projectShot?.shotTypeLabel || projectShot?.shotType, frame.variationReason),
      lightingPalette,
      audioCue: compact(segment.audioState?.audioCue || story.audioContract.audioCue, frame.audioDescription),
      narrativeCause: compact(story.videoDesc.visualCausality, projectShot?.dramaticPurpose || '推进当前剧情节点。'),
      assetAnchors: project.assets
        .filter(asset => !isGlobalAsset(asset, allShotIds) && asset.relatedShotIds?.includes(segment.shotId))
        .map(asset => `${asset.name}：${asset.summary}`),
    };
  });

  const characterAsset = assetSummary(project, 'character', project.storyBible.protagonist, allShotIds);
  const characterBible = project.semanticPlan.characterBibles[0];
  const wardrobe = [characterAsset, characterBible?.appearance]
    .filter(value => typeof value === 'string' && value.trim())
    .join('；');

  return {
    version: 'sceneweave-continuity-contract-v1',
    artifactRevision: computeProductionArtifactRevision(project),
    providerHandoff: input.providerHandoff,
    subjectBible: [
      `主角=${project.storyBible.protagonist}`,
      characterAsset,
      ...project.storyBible.continuityRules.filter(rule => rule.includes('主角') || rule.includes('身份') || rule.includes('外观')),
    ].join('；'),
    wardrobe: compact(wardrobe, '服饰、发型与可见身份锚点必须跨镜保持。'),
    scene: assetSummary(project, 'scene', project.storyBible.relationship, allShotIds),
    props: project.assets
      .filter(asset => asset.kind === 'prop' && isGlobalAsset(asset, allShotIds))
      .map(asset => `${asset.name}：${asset.summary}`),
    shots,
  };
}

export function buildVimaxContinuityPrompt(contract: VimaxContinuityContract, shotIndex: number) {
  const shot = contract.shots[shotIndex];
  if (!shot) throw new Error(`连续性契约中不存在镜头 ${shotIndex + 1}`);
  const handoff = contract.providerHandoff.mode === 'frame-handoff'
    ? `【供应商交接】首帧交接：镜头 ${shotIndex + 1} 必须绑定上一镜尾帧；${contract.providerHandoff.limitation}`
    : `【供应商交接】仅文本锚点：${contract.providerHandoff.limitation}`;

  return [
    `【连续性版本】${contract.artifactRevision}`,
    handoff,
    `【角色圣经】${contract.subjectBible}`,
    `【服饰锚点】${contract.wardrobe}`,
    `【场景锚点】${contract.scene}`,
    `【道具状态】${contract.props.join('；') || '无独立道具；保持已建立的关键线索状态。'}`,
    `【本镜资产】${shot.assetAnchors?.join('；') || '沿用全局角色、场景和道具状态。'}`,
    `【动作衔接】起点=${shot.actionStart}；终点=${shot.actionEnd}`,
    `【空间与构图】方向=${shot.screenDirection}；景别=${shot.framing}；光色=${shot.lightingPalette}`,
    `【声音切点】${shot.audioCue}`,
    `【叙事因果】${shot.narrativeCause}；${shot.dependency}`,
  ].join('\n');
}

export function buildVimaxFrameProviderPrompt(input: {
  basePrompt: string;
  camera?: string;
  presetName: string;
  presetDescription: string;
  presetStyle: string;
  continuity: VimaxContinuityContract;
  shotIndex: number;
  handoffFromPrevious: boolean;
}) {
  return [
    input.basePrompt,
    input.camera ? `运镜：${input.camera}` : '',
    input.handoffFromPrevious
      ? '本段第一帧已绑定上一段尾帧；先严格承接上一段末尾的人物姿态、空间方向、光线和道具位置，再推进本段剧情。'
      : '',
    buildVimaxContinuityPrompt(input.continuity, input.shotIndex),
    `创作类型：${input.presetName}。创作目标：${input.presetDescription}。视觉风格：${input.presetStyle}。`,
    '保持同一作品的主体、场景、光线和道具连续，镜头之间自然衔接，不要字幕，不要水印。',
  ].filter(Boolean).join(' ').trim();
}

export function parseVimaxContinuityContract(value: unknown): VimaxContinuityContract | undefined {
  if (!isRecord(value)
    || value.version !== 'sceneweave-continuity-contract-v1'
    || typeof value.artifactRevision !== 'string'
    || !isRecord(value.providerHandoff)
    || !['frame-handoff', 'text-anchors'].includes(String(value.providerHandoff.mode))
    || typeof value.providerHandoff.provider !== 'string'
    || typeof value.providerHandoff.model !== 'string'
    || typeof value.providerHandoff.supportsFirstFrame !== 'boolean'
    || typeof value.providerHandoff.supportsReferenceImages !== 'boolean'
    || value.providerHandoff.locked !== true
    || typeof value.providerHandoff.limitation !== 'string'
    || typeof value.subjectBible !== 'string'
    || typeof value.wardrobe !== 'string'
    || typeof value.scene !== 'string'
    || !Array.isArray(value.props)
    || !value.props.every(prop => typeof prop === 'string')
    || !Array.isArray(value.shots)) return undefined;

  const validShots = value.shots.every(shot => isRecord(shot)
    && typeof shot.shotId === 'string'
    && (shot.previousShotId === null || typeof shot.previousShotId === 'string')
    && (shot.assetAnchors === undefined
      || (Array.isArray(shot.assetAnchors) && shot.assetAnchors.every(anchor => typeof anchor === 'string')))
    && ['dependency', 'actionStart', 'actionEnd', 'screenDirection', 'framing', 'lightingPalette', 'audioCue', 'narrativeCause']
      .every(key => typeof shot[key] === 'string' && String(shot[key]).trim().length > 0));

  return validShots ? value as unknown as VimaxContinuityContract : undefined;
}
