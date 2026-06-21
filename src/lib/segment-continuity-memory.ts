export interface SegmentContinuityMemoryInput {
  segmentIndex: number;
  totalSegments: number;
  currentPrompt: string;
  previousPrompt?: string;
  previousLastFrameAvailable?: boolean;
  nextPrompt?: string;
  visualAnchors?: string[];
}

function compactText(value: string | undefined, fallback: string) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 180) : fallback;
}

function anchorText(anchors: string[] | undefined) {
  const normalized = (anchors || [])
    .map(anchor => String(anchor || '').trim())
    .filter(Boolean)
    .slice(0, 5);
  return normalized.length ? normalized.join('、') : '主角、关键道具、主要场景、危险源、情绪方向';
}

export function buildSegmentContinuityMemoryBlock(input: SegmentContinuityMemoryInput) {
  const isFirst = input.segmentIndex === 0;
  const isLast = input.segmentIndex >= input.totalSegments - 1;
  const current = compactText(input.currentPrompt, '本段必须完成一个可见动作和一个剧情信息增量。');
  const previous = compactText(input.previousPrompt, '第一段没有上一段，必须先建立主角、场景和关键道具的空间关系。');
  const next = compactText(input.nextPrompt, '最后一段收在清楚的结果反应或未解悬念上，不切到无关画面。');
  const anchors = anchorText(input.visualAnchors);

  return [
    '---',
    '【段间连续性记忆 - 必须执行】',
    `【上一段画面记忆】${isFirst ? '开场段：先建立主角、关键道具、场景和危险源的空间关系。' : previous}`,
    `【上一段尾帧证据】${input.previousLastFrameAvailable ? '已提供上一段 lastFrame/firstFrame 参考；开头1-2秒先复现该画面状态。' : isFirst ? '第一段无需尾帧参考。' : '未提供真实尾帧时，仍必须在文字上复现上一段最后的角色位置、视线方向、手部动作和关键道具状态。'}`,
    `【本段唯一信息增量】${current}`,
    `【可见锚点】${anchors}`,
    `【出点状态】${isLast ? '结尾必须留下主角对结果的可见反应、关键道具的新状态或新的未解悬念。' : '结尾必须冻结一个下一段能接住的状态：主角视线、手部动作、关键道具位置/屏幕内容或危险标识。'}`,
    `【下一段触发点】${isLast ? '不再开启新动作；只保留可回看的悬念画面。' : next}`,
    '【禁止】不要把本段拍成重复氛围空镜；不要突然换主角、换场景、换道具；不要只复述同一危机。每段必须有新的可见动作、操作结果和情绪变化。',
  ].join('\n');
}
