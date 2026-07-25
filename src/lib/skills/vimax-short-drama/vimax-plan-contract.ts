import type { VimaxAgentPlan } from './vimax-agent-contract';

type LooseRecord = Record<string, unknown>;

const ASSET_KINDS = ['script', 'character', 'scene', 'prop', 'shot', 'reference'] as const;
const CONTINUITY_PRIORITIES = ['action', 'screen-direction', 'subject', 'scene', 'prop'] as const;
const SPATIAL_RELATIONS = ['same-scene', 'new-scene'] as const;
const TEMPORAL_RELATIONS = ['continuous', 'elapsed', 'time-jump'] as const;
const ROUTE_CONFIDENCE = ['high', 'medium', 'low'] as const;

function isRecord(value: unknown): value is LooseRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asOptionalString(value: unknown) {
  return asString(value) || undefined;
}

function asNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asStringArray(value: unknown, limit = 12) {
  return Array.isArray(value)
    ? value.map(item => asString(item)).filter(Boolean).slice(0, limit)
    : [];
}

function asEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  const normalized = asString(value);
  return allowed.includes(normalized as T[number]) ? normalized as T[number] : undefined;
}

function normalizeStory(value: unknown): VimaxAgentPlan['story'] {
  if (!isRecord(value)) return undefined;
  const emotionalArc = isRecord(value.emotionalArc)
    ? {
      start: asOptionalString(value.emotionalArc.start),
      shift: asOptionalString(value.emotionalArc.shift),
      end: asOptionalString(value.emotionalArc.end),
    }
    : undefined;
  const story = {
    premise: asOptionalString(value.premise),
    protagonist: asOptionalString(value.protagonist),
    desire: asOptionalString(value.desire),
    obstacle: asOptionalString(value.obstacle),
    conflict: asOptionalString(value.conflict),
    turningPoint: asOptionalString(value.turningPoint),
    endingHook: asOptionalString(value.endingHook),
    emotionalArc: emotionalArc && Object.values(emotionalArc).some(Boolean) ? emotionalArc : undefined,
  };
  return Object.values(story).some(Boolean) ? story : undefined;
}

export function normalizeVimaxAgentPlan(value: unknown): VimaxAgentPlan {
  if (!isRecord(value)) throw new Error('真实模型未返回结构化创作计划。');
  const title = asString(value.title);
  const rawShots = Array.isArray(value.shots) ? value.shots.filter(isRecord) : [];
  if (!title || rawShots.length === 0) {
    throw new Error('真实模型返回缺少 title 或 shots。');
  }
  const incompleteRouteShot = rawShots.findIndex(shot => (
    !asEnum(shot.spatialRelation, SPATIAL_RELATIONS)
    || !asEnum(shot.temporalRelation, TEMPORAL_RELATIONS)
    || !asEnum(shot.routeConfidence, ROUTE_CONFIDENCE)
  ));
  if (incompleteRouteShot >= 0) {
    throw new Error(`真实模型返回的镜头 ${incompleteRouteShot + 1} 缺少时空关系或路由置信度。`);
  }

  const characters = Array.isArray(value.characters)
    ? value.characters.filter(isRecord).slice(0, 12).map((item, index) => ({
      id: asString(item.id, `character-${index + 1}`),
      label: asString(item.label, `角色 ${index + 1}`),
      description: asString(item.description),
      continuityAnchors: asStringArray(item.continuityAnchors),
    }))
    : undefined;
  const scenes = Array.isArray(value.scenes)
    ? value.scenes.filter(isRecord).slice(0, 12).map((item, index) => ({
      id: asString(item.id, `scene-${index + 1}`),
      label: asString(item.label, `场景 ${index + 1}`),
      description: asString(item.description),
      timeOfDay: asOptionalString(item.timeOfDay),
      continuityAnchors: asStringArray(item.continuityAnchors),
    }))
    : undefined;
  const props = Array.isArray(value.props)
    ? value.props.filter(isRecord).slice(0, 12).map((item, index) => ({
      id: asString(item.id, `prop-${index + 1}`),
      label: asString(item.label, `道具 ${index + 1}`),
      description: asString(item.description),
      state: asOptionalString(item.state),
    }))
    : undefined;

  return {
    title,
    summary: asString(value.summary),
    story: normalizeStory(value.story),
    characters: characters?.length ? characters : undefined,
    scenes: scenes?.length ? scenes : undefined,
    props: props?.length ? props : undefined,
    assets: (Array.isArray(value.assets) ? value.assets.filter(isRecord) : []).slice(0, 12).map(item => ({
      kind: asEnum(item.kind, ASSET_KINDS) || 'reference',
      label: asString(item.label, '参考素材'),
      prompt: asString(item.prompt),
      referenceUrl: asOptionalString(item.referenceUrl),
      videoUrl: asOptionalString(item.videoUrl),
    })),
    shots: rawShots.slice(0, 8).map((shot, index) => ({
      index: asNumber(shot.index, index + 1),
      title: asString(shot.title, `镜头 ${index + 1}`),
      duration: asNumber(shot.duration, 6),
      camera: asString(shot.camera, '固定镜头'),
      prompt: asString(shot.prompt),
      sceneId: asOptionalString(shot.sceneId),
      characterIds: asStringArray(shot.characterIds),
      propIds: asStringArray(shot.propIds),
      actionStart: asOptionalString(shot.actionStart),
      actionEnd: asOptionalString(shot.actionEnd),
      firstFrameDescription: asOptionalString(shot.firstFrameDescription),
      lastFrameDescription: asOptionalString(shot.lastFrameDescription),
      motionDescription: asOptionalString(shot.motionDescription),
      dialogue: asOptionalString(shot.dialogue),
      narration: asOptionalString(shot.narration),
      audioIntent: asOptionalString(shot.audioIntent),
      spatialRelation: asEnum(shot.spatialRelation, SPATIAL_RELATIONS),
      temporalRelation: asEnum(shot.temporalRelation, TEMPORAL_RELATIONS),
      routeConfidence: asEnum(shot.routeConfidence, ROUTE_CONFIDENCE),
      conflictFlags: asStringArray(shot.conflictFlags, 6),
      continuityPriorities: asStringArray(shot.continuityPriorities)
        .filter((item): item is typeof CONTINUITY_PRIORITIES[number] => (
          CONTINUITY_PRIORITIES.includes(item as typeof CONTINUITY_PRIORITIES[number])
        )),
      referenceUrl: asOptionalString(shot.referenceUrl),
      videoUrl: asOptionalString(shot.videoUrl),
    })),
    nextAction: asString(value.nextAction, '确认分镜后进入参考素材生成。'),
  };
}
