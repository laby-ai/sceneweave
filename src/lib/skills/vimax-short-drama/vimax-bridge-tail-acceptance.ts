import type { BYOKConnection } from '@/lib/byok-provider';

export interface VimaxBridgeTailReview {
  accepted: boolean;
  observedEndState: string;
  sceneReached: boolean;
  actionReached: boolean;
  anchorConsistency: boolean;
  blockers?: string[];
}

export interface VimaxBridgeTailAcceptance {
  version: 'sceneweave-bridge-tail-acceptance-v1';
  status: 'accepted' | 'rejected';
  reviewer: 'fixture' | 'multimodal-model';
  reviewModel: string | null;
  checkedAt: string;
  observedEndState: string;
  plannedStartState: string;
  plannedEndState: string;
  nextPlannedStartState: string;
  sceneId: string | null;
  actionPhase: string;
  anchors: string[];
  reviewNotes: string[];
  revisionInstruction: string | null;
  blockers: Array<
    'still-outside-target-scene'
    | 'bridge-action-incomplete'
    | 'continuity-anchor-drift'
    | 'reviewer-rejected'
  >;
  canUpdateCanon: boolean;
  canStartNextSegment: boolean;
}

export function evaluateVimaxBridgeTailHandoffReadiness(
  value: VimaxBridgeTailAcceptance | null | undefined,
) {
  if (!value || value.version !== 'sceneweave-bridge-tail-acceptance-v1') {
    return {
      ok: false as const,
      code: 'bridge-tail-acceptance-missing',
      reason: '这一镜还没有完成衔接检查。',
    };
  }
  if (value.status !== 'accepted' || !value.canUpdateCanon || !value.canStartNextSegment) {
    return {
      ok: false as const,
      code: 'bridge-tail-target-not-reached',
      reason: '这一镜的结尾还未自然进入下一幕，已保留现有结果并准备仅重做当前镜头。',
    };
  }
  return { ok: true as const, acceptance: value };
}

interface VimaxBridgeTailContract {
  sourceLastFrameUrl: string;
  observedLastFrameUrl: string;
  plannedStartState: string;
  plannedEndState: string;
  nextPlannedStartState: string;
  sceneId?: string | null;
  actionPhase: string;
  anchors: string[];
}

function compact(value: unknown, maxLength = 600) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function uniqueCompact(values: string[], maxItems = 12) {
  return [...new Set(values.map(value => compact(value, 120)).filter(Boolean))].slice(0, maxItems);
}

function buildBridgeRevisionInstruction(
  input: VimaxBridgeTailContract & { review: VimaxBridgeTailReview },
) {
  const reviewNotes = uniqueCompact(input.review.blockers || [], 4);
  return [
    '只重做当前过门镜头，不改变前后镜头的剧情、人物身份和既有动作因果。',
    `真实尾态：${compact(input.review.observedEndState)}`,
    `目标尾态：${compact(input.plannedEndState)}`,
    `下一镜起始：${compact(input.nextPlannedStartState)}`,
    `保持锚点：${uniqueCompact(input.anchors).join('、') || '沿用原计划中的人物、场景和道具'}`,
    reviewNotes.length > 0 ? `本次需要修正：${reviewNotes.join('；')}` : '',
  ].filter(Boolean).join('\n');
}

export function evaluateVimaxBridgeTailAcceptance(
  input: VimaxBridgeTailContract & {
    review: VimaxBridgeTailReview;
    reviewer?: VimaxBridgeTailAcceptance['reviewer'];
    reviewModel?: string | null;
  },
): VimaxBridgeTailAcceptance {
  const blockers: VimaxBridgeTailAcceptance['blockers'] = [];
  if (!input.review.sceneReached) blockers.push('still-outside-target-scene');
  if (!input.review.actionReached) blockers.push('bridge-action-incomplete');
  if (!input.review.anchorConsistency) blockers.push('continuity-anchor-drift');
  if (!input.review.accepted && blockers.length === 0) blockers.push('reviewer-rejected');
  const accepted = input.review.accepted && blockers.length === 0;
  const reviewNotes = uniqueCompact(input.review.blockers || [], 4);

  return {
    version: 'sceneweave-bridge-tail-acceptance-v1',
    status: accepted ? 'accepted' : 'rejected',
    reviewer: input.reviewer || 'fixture',
    reviewModel: input.reviewModel || null,
    checkedAt: new Date().toISOString(),
    observedEndState: compact(input.review.observedEndState),
    plannedStartState: compact(input.plannedStartState),
    plannedEndState: compact(input.plannedEndState),
    nextPlannedStartState: compact(input.nextPlannedStartState),
    sceneId: compact(input.sceneId, 120) || null,
    actionPhase: compact(input.actionPhase),
    anchors: uniqueCompact(input.anchors),
    reviewNotes,
    revisionInstruction: accepted ? null : buildBridgeRevisionInstruction(input),
    blockers,
    canUpdateCanon: accepted,
    canStartNextSegment: accepted,
  };
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  const text = compact(value, 4_000).replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function requiredBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function isProviderReadableVisualInput(value: string) {
  if (/^data:image\/(?:jpeg|png|webp);base64,/i.test(value)) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    const hostname = url.hostname.toLowerCase();
    return hostname !== 'localhost'
      && hostname !== '::1'
      && hostname !== '0.0.0.0'
      && !hostname.endsWith('.local')
      && !/^127\./.test(hostname)
      && !/^10\./.test(hostname)
      && !/^192\.168\./.test(hostname)
      && !/^172\.(?:1[6-9]|2\d|3[01])\./.test(hostname);
  } catch {
    return false;
  }
}

export async function reviewVimaxBridgeTail(
  input: VimaxBridgeTailContract & {
    connection: BYOKConnection;
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
  },
): Promise<VimaxBridgeTailAcceptance> {
  const model = compact(input.connection.model, 120);
  if (!model || !input.connection.apiBase || !input.connection.apiKey) {
    throw new Error('镜头衔接检查暂不可用，请稍后继续。');
  }
  if (!isProviderReadableVisualInput(input.sourceLastFrameUrl)
    || !isProviderReadableVisualInput(input.observedLastFrameUrl)) {
    throw new Error('镜头衔接检查暂时无法读取真实首尾帧。');
  }
  const content: Array<Record<string, unknown>> = [{
    type: 'text',
    text: [
      '判断一个短剧过门镜头的真实尾帧是否到达计划目标。',
      `计划起始状态：${compact(input.plannedStartState)}`,
      `计划结束状态：${compact(input.plannedEndState)}`,
      `下一镜计划起始状态：${compact(input.nextPlannedStartState)}`,
      `目标场景：${compact(input.sceneId) || '未命名场景'}`,
      `动作阶段：${compact(input.actionPhase)}`,
      `必须保持的锚点：${uniqueCompact(input.anchors).join('、') || '无额外锚点'}`,
      '图1是该过门镜头的真实起始帧，图2是生成后的真实尾帧。',
      '计划结束状态是当前镜头唯一需要完成的目标；下一镜计划起始状态只用于判断图2能否自然承接，不得要求当前镜头提前完成下一镜才发生的动作或状态。',
      'actionReached 表示图2已经呈现计划结束状态，不要求静态尾帧展示动作过程；若目标人物已进入目标场景且计划道具已经出现，即使下一镜才会启动道具，也应视为当前动作已完成。',
      'anchorConsistency 只检查明确列出的锚点，不得把未列出的天气、光线细节或下一镜状态追加为硬性锚点。',
      '当图2达到当前计划结束状态、明确锚点保持一致，并可自然进入下一镜时，accepted=true。',
      '只返回 JSON：{"accepted":false,"observedEndState":"客观描述","sceneReached":false,"actionReached":false,"anchorConsistency":true,"blockers":["原因"]}',
    ].join('\n'),
  }, {
    type: 'image_url',
    image_url: { url: input.sourceLastFrameUrl },
  }, {
    type: 'image_url',
    image_url: { url: input.observedLastFrameUrl },
  }];
  const response = await (input.fetchImpl || fetch)(
    `${input.connection.apiBase.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.connection.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        enable_thinking: false,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: '你是短剧镜头边界验收器。只根据画面事实和模型原始镜头计划判断当前镜头是否完成，不得增加计划之外的剧情、锚点或下一镜要求。',
          },
          { role: 'user', content },
        ],
      }),
      signal: input.signal,
    },
  );
  if (!response.ok) {
    throw new Error(`镜头衔接检查暂不可用（HTTP ${response.status}）。`);
  }
  const payload = await response.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  } | null;
  const parsed = parseJsonObject(payload?.choices?.[0]?.message?.content);
  const accepted = requiredBoolean(parsed?.accepted);
  const sceneReached = requiredBoolean(parsed?.sceneReached);
  const actionReached = requiredBoolean(parsed?.actionReached);
  const anchorConsistency = requiredBoolean(parsed?.anchorConsistency);
  const observedEndState = compact(parsed?.observedEndState);
  if (!parsed
    || accepted === null
    || sceneReached === null
    || actionReached === null
    || anchorConsistency === null
    || !observedEndState) {
    throw new Error('镜头衔接检查没有返回有效结果，请稍后继续。');
  }

  return evaluateVimaxBridgeTailAcceptance({
    ...input,
    review: {
      accepted,
      observedEndState,
      sceneReached,
      actionReached,
      anchorConsistency,
      blockers: Array.isArray(parsed.blockers)
        ? parsed.blockers.map(value => compact(value, 180)).filter(Boolean).slice(0, 8)
        : [],
    },
    reviewer: 'multimodal-model',
    reviewModel: model,
  });
}
