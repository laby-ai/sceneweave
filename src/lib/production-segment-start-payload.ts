import type { ProductionSegmentPlan } from './production-assembly-plan';
import type { ShotVisualStoryEvidence } from './production-shot-frame-contract';
import type { StorySegmentContract } from './production-story-segment-contract';

export interface ProductionSegmentStartPayload {
  version: 'yh-segment-start-payload-v1';
  usesShotFrameContract: boolean;
  contractVersion: string | null;
  variationType: string | null;
  firstFrameImage: string | null;
  firstFrameSource: 'none' | 'segment-first-frame' | 'direct-previous-tail' | 'boundary-new-camera';
  previousLastFrameImage: string | null;
  prompt: string;
  promptPreview: string;
  providerPrompt: string;
  providerPromptPreview: string;
  providerPromptLength: number;
  visualStoryEvidence: ShotVisualStoryEvidence;
  storySegmentContract: Pick<StorySegmentContract, 'version' | 'videoDesc' | 'storyState' | 'audioContract' | 'dependencyContract' | 'readiness'>;
  audioState: ProductionSegmentPlan['audioState'] | null;
  audioEventContract: StorySegmentContract['audioContract']['audioEventContract'];
  audioContinuity: {
    previousAudioCue: string | null;
    prompt: string | null;
  };
  storyContinuity: {
    previousStoryStateCue: string | null;
    prompt: string | null;
  };
  boundaryBridge: {
    boundaryBridgeId: string | null;
    bridgeStrategy: string | null;
    bridgeFirstFrameUrl: string | null;
    prompt: string | null;
  };
  readiness: {
    pass: boolean;
    blockers: string[];
    warnings: string[];
  };
}

export class ProductionSegmentStartPayloadError extends Error {
  details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ProductionSegmentStartPayloadError';
    this.details = details;
  }
}

function compactList(values: string[] | undefined, fallback: string) {
  const normalized = (values || []).map(value => value.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized.join('、') : fallback;
}

function buildContractPromptBlock(segment: ProductionSegmentPlan) {
  const contract = segment.shotFrameContract;
  const storyContract = segment.storySegmentContract;
  if (!contract) {
    throw new ProductionSegmentStartPayloadError('片段缺少 ShotFrameContract，拒绝启动真实视频生成。', {
      code: 'missing-shot-frame-contract',
      segmentIndex: segment.index,
    });
  }
  if (!contract.readiness.pass) {
    throw new ProductionSegmentStartPayloadError('片段 ShotFrameContract 未通过 readiness，拒绝启动真实视频生成。', {
      code: 'shot-frame-contract-not-ready',
      segmentIndex: segment.index,
      blockers: contract.readiness.blockers,
      warnings: contract.readiness.warnings,
    });
  }
  if (!storyContract) {
    throw new ProductionSegmentStartPayloadError('片段缺少 StorySegmentContract，拒绝启动真实视频生成。', {
      code: 'missing-story-segment-contract',
      segmentIndex: segment.index,
    });
  }
  if (!storyContract.readiness.pass) {
    throw new ProductionSegmentStartPayloadError('片段 StorySegmentContract 未通过 readiness，拒绝启动真实视频生成。', {
      code: 'story-segment-contract-not-ready',
      segmentIndex: segment.index,
      blockers: storyContract.readiness.blockers,
      warnings: storyContract.readiness.warnings,
    });
  }
  if (segment.artifactReadiness?.stale) {
    throw new ProductionSegmentStartPayloadError('片段 artifact 已 stale，拒绝复用旧视频/尾帧/声音状态启动。', {
      code: 'artifact-stale-after-project-writeback',
      segmentIndex: segment.index,
      blockers: segment.artifactReadiness.blockers,
      staleReason: segment.artifactReadiness.staleReason,
    });
  }

  const requiredAssets = compactList(contract.firstFrame.requiredAssetIds, '无明确资产');
  const firstAnchors = compactList(contract.firstFrame.continuityAnchors, '无明确首帧锚点');
  const lastAnchors = compactList(contract.lastFrame.continuityAnchors, '无明确尾帧锚点');
  const firstCharacters = compactList(contract.firstFrame.visibleCharacterIds, '无明确角色');
  const lastCharacters = compactList(contract.lastFrame.visibleCharacterIds, '无明确角色');

  return [
    '【首尾帧合约】必须严格按以下约束生成，不要把每段拍成同一类空镜或重复流水账。',
    `【首帧合约】${contract.firstFrame.description}`,
    `【首帧可见角色】${firstCharacters}`,
    `【首帧连续锚点】${firstAnchors}`,
    `【尾帧合约】${contract.lastFrame.description}`,
    `【尾帧可见角色】${lastCharacters}`,
    `【尾帧连续锚点】${lastAnchors}`,
    '【尾帧传递安全】非最后段尾帧优先停在地图、旗帜、门楼、道具或场景方向等可传递状态；不要用人物正脸、近脸或疑似真人证件照作为下一段首帧输入。',
    `【可见威胁对象】${contract.visualStoryEvidence.threatTarget}`,
    `【可见冲突证据】${contract.visualStoryEvidence.conflictEvidence}`,
    `【可见操作结果】${contract.visualStoryEvidence.operationResultEvidence}`,
    `【可见结尾钩子】${contract.visualStoryEvidence.endingHookEvidence}`,
    `【无字幕可读性测试】${contract.visualStoryEvidence.viewerReadabilityTest}`,
    `【必要资产】${requiredAssets}`,
    `【镜头变化】${contract.variationType}：${contract.variationReason}`,
    `【镜头运动】${contract.motionDescription}`,
    `【声音/对白】${contract.audioDescription || '保留现场声和节奏，不新增无关旁白。'}`,
    `【故事状态】主角=${storyContract.storyState.protagonist}；目标=${storyContract.storyState.currentGoal}；冲突=${storyContract.storyState.conflict}`,
    `【状态变化】${storyContract.storyState.visibleStateChange}`,
    `【Toonflow videoDesc】动作=${storyContract.videoDesc.visibleAction}；因果=${storyContract.videoDesc.visualCausality}`,
    `【故事承接上一段】${segment.expectedInputs.previousStoryStateCue || '无上一段故事状态；建立主角目标、冲突对象、关键道具和初始情绪。'}`,
    `【声音合约】对白=${storyContract.audioContract.dialogue || '无'}；旁白=${storyContract.audioContract.narration || '无'}；声音=${storyContract.audioContract.soundDesign}`,
    `【声音事件合约】${storyContract.audioContract.audioEventContract.providerInstruction}`,
    `【本段声音状态】${segment.audioState?.audioCue || contract.audioDescription || '无明确声音状态。'}`,
    `【角色声音】${segment.audioState?.voiceStyle || '保持同一角色音色、情绪和口型状态。'}`,
    `【声音承接上一段】${segment.expectedInputs.previousAudioCue || '无上一段声音状态；建立本段环境声、角色语气和节奏。'}`,
    `【承接上一段】${contract.handoff.requiresPreviousLastFrame ? contract.handoff.entryContinuity : '这是第一段，先建立空间关系和主角目标。'}`,
    `【交给下一段】${contract.handoff.exitContinuity}`,
  ].join('\n');
}

function normalizeProviderText(value: string | null | undefined) {
  return String(value || '')
    .replace(/【[^】]{1,40}】/g, ' ')
    .replace(/[<>`{}[\]|\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function softenProviderSensitiveTerms(value: string) {
  const replacements: Array<[RegExp, string]> = [
    [/染血山河图/g, '带红色印记的山河图'],
    [/染血/g, '带红色印记'],
    [/流血/g, '出现红色液体'],
    [/伤口/g, '旧创痕'],
    [/血迹/g, '红色印记'],
    [/药血/g, '红色药渍'],
    [/伤兵营/g, '战地医棚'],
    [/伤兵/g, '疲惫军士'],
    [/缝合/g, '包扎整理'],
    [/浸透/g, '沾染'],
    [/刀尖/g, '地图尺'],
    [/划开/g, '标出'],
    [/割地/g, '边界交割'],
    [/割裂/g, '边界分离'],
    [/拔刀/g, '上前'],
    [/已宣告死亡/g, '刚被系统标记为无回应'],
    [/死亡病人/g, '离奇失联的急诊记录对象'],
    [/死亡/g, '失联'],
    [/尸体/g, '失联者'],
    [/血腥/g, '紧张'],
    [/血/g, '红色痕迹'],
    [/鬼/g, '未知人影'],
    [/杀/g, '袭击'],
    [/消失/g, '画面断开'],
    [/不要字幕/g, '画面不出现字幕文字'],
    [/无字幕/g, '画面不出现字幕文字'],
  ];
  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function compactProviderPrompt(lines: string[]) {
  const normalized = lines
    .map(line => softenProviderSensitiveTerms(normalizeProviderText(line)))
    .filter(Boolean);
  const prompt = normalized.join('。').replace(/。+/g, '。').trim();
  if (prompt.length <= 900) return prompt;

  const opening = prompt.slice(0, 620);
  const ending = prompt.slice(-220);
  return `${opening}。${ending}`.slice(0, 900);
}

function extractPromptSection(prompt: string | undefined, label: string) {
  if (!prompt) return '';
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = prompt.match(new RegExp(`【${escaped}】([^【\\n]+)`));
  return match?.[1]?.trim() || '';
}

function extractPromptTitle(prompt: string | undefined) {
  if (!prompt) return '';
  const genericLabels = new Set([
    '短剧前提',
    '角色动机',
    '当前冲突',
    '剧情目的',
    '观众必须看见',
    '观众必须看懂',
    '威胁对象',
    '危险源',
    '视觉冲突证据',
    '观众检查点',
    '动作因果',
    '入点状态',
    '上一段画面记忆',
    '出点状态',
    '下一段触发点',
    '桥接动作',
    '剪辑衔接',
    '操作结果',
    '结尾钩子证据',
    '结尾新问题',
    '预告片节拍',
    '连续性检查',
    '道具状态',
    '情绪变化',
    '连续性规则',
    '镜头执行',
    '画面证据',
    '声音提示',
    '情绪推进',
    '三要素',
    '三要素验收',
  ]);
  const labels = Array.from(prompt.matchAll(/【([^】]{1,60})】/g))
    .map(match => match[1]?.trim())
    .filter((label): label is string => Boolean(label));
  return labels.find(label => !genericLabels.has(label)) || labels[0] || '';
}

function buildSegmentProgressionCue(segment: ProductionSegmentPlan) {
  const storyContract = segment.storySegmentContract;
  const contract = segment.shotFrameContract;
  return {
    title: firstNonEmpty(
      extractPromptTitle(segment.prompt),
      storyContract?.videoDesc.visibleAction,
      `片段${segment.index + 1}`,
    ),
    mustUnderstand: firstNonEmpty(
      extractPromptSection(segment.prompt, '观众必须看懂'),
      extractPromptSection(segment.prompt, '剧情目的'),
      storyContract?.videoDesc.visualCausality,
      storyContract?.videoDesc.visibleAction,
    ),
    visualEvidence: firstNonEmpty(
      extractPromptSection(segment.prompt, '画面证据'),
      extractPromptSection(segment.prompt, '观众必须看见'),
      extractPromptSection(segment.prompt, '操作结果'),
      contract?.visualStoryEvidence.operationResultEvidence,
      contract?.visualStoryEvidence.conflictEvidence,
    ),
    soundCue: firstNonEmpty(
      extractPromptSection(segment.prompt, '声音提示'),
      segment.audioState?.soundDesign,
      storyContract?.audioContract.soundDesign,
      contract?.audioDescription,
    ),
  };
}

function firstNonEmpty(...values: Array<unknown>) {
  return values
    .map(value => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) || '';
}

function compactProviderValue(value: string, maxLength: number) {
  const normalized = normalizeProviderText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function segmentRequestsNoNarration(segment: ProductionSegmentPlan) {
  const contractNarration = segment.storySegmentContract?.audioContract.narration;
  const stateNarration = segment.audioState?.narration;
  const cue = segment.audioState?.audioCue || '';
  return !contractNarration
    || contractNarration === '无'
    || stateNarration === null
    || stateNarration === '无'
    || /旁白\s*[=：:]\s*无/.test(cue);
}

function removeNarrationCarryover(value: string, segment: ProductionSegmentPlan) {
  if (!segmentRequestsNoNarration(segment)) return value;
  return value
    .replace(/旁白\s*[=：:][^。；\n]*(?:[。；]|$)/g, '旁白=不延续上一段旁白；')
    .replace(/旁白\s*：[^。；\n]*(?:[。；]|$)/g, '旁白：不延续上一段旁白；')
    .replace(/南唐宫灯短暂亮起，急报把镜头推向后周北望/g, '南唐宫灯里的马蹄急报把声音和视线推向北方')
    .replace(/讲述式背景声音/g, '讲述式画外声音')
    .trim();
}

function resolveFirstFrameInput(segment: ProductionSegmentPlan) {
  const firstFrameUrl = segment.expectedInputs.firstFrameUrl || null;
  const previousLastFrameUrl = segment.expectedInputs.previousLastFrameUrl || null;
  const bridgeFirstFrameUrl = segment.expectedInputs.bridgeFirstFrameUrl || null;
  const usesBoundaryBridge = segment.expectedInputs.bridgeStrategy === 'transition-bridge'
    && firstFrameUrl
    && bridgeFirstFrameUrl
    && firstFrameUrl === bridgeFirstFrameUrl
    && firstFrameUrl !== previousLastFrameUrl;
  const usesDirectPreviousTail = Boolean(firstFrameUrl && previousLastFrameUrl && firstFrameUrl === previousLastFrameUrl);

  if (usesBoundaryBridge) {
    return {
      firstFrameImage: firstFrameUrl,
      previousLastFrameImage: previousLastFrameUrl,
      firstFrameSource: 'boundary-new-camera' as const,
    };
  }

  if (usesDirectPreviousTail) {
    return {
      firstFrameImage: firstFrameUrl,
      previousLastFrameImage: previousLastFrameUrl,
      firstFrameSource: 'direct-previous-tail' as const,
    };
  }

  if (firstFrameUrl) {
    return {
      firstFrameImage: firstFrameUrl,
      previousLastFrameImage: previousLastFrameUrl,
      firstFrameSource: 'segment-first-frame' as const,
    };
  }

  return {
    firstFrameImage: previousLastFrameUrl,
    previousLastFrameImage: previousLastFrameUrl,
    firstFrameSource: previousLastFrameUrl ? 'direct-previous-tail' as const : 'none' as const,
  };
}

function describeFirstFrameSource(source: ReturnType<typeof resolveFirstFrameInput>['firstFrameSource']) {
  if (source === 'boundary-new-camera') {
    return '边界 bridge 生成并抽取的 new-camera image 是本段首帧；上一段尾帧只作为来源记忆和故事/声音状态，不再直接当作首帧。';
  }
  if (source === 'direct-previous-tail') {
    return '上一段尾帧直接作为本段首帧图像。';
  }
  if (source === 'segment-first-frame') {
    return '本段已有独立首帧图像。';
  }
  return '第一段无外部首帧图像。';
}

function buildProviderTimeAxisConstraint(
  segment: ProductionSegmentPlan,
  firstFrameInput: ReturnType<typeof resolveFirstFrameInput>,
) {
  const contract = segment.shotFrameContract;
  const storyContract = segment.storySegmentContract;
  const duration = Math.min(Math.max(segment.duration, 5), 10);
  const openingEnd = Math.min(2, Math.max(1, Math.round(duration * 0.3)));
  const finalStart = Math.max(openingEnd + 1, duration - 1);
  const actionEnd = Math.max(openingEnd + 1, finalStart);
  const dialogue = storyContract.audioContract.dialogue || '无对白';
  const narration = storyContract.audioContract.narration || '无旁白';
  const audio = segment.audioState?.audioCue || storyContract.audioContract.soundDesign || contract.audioDescription;
  const progression = buildSegmentProgressionCue(segment);
  const openingContinuity = firstFrameInput.firstFrameSource === 'boundary-new-camera'
    ? '复现 bridge new-camera image 的镜头方向、人物站位、关键道具和情绪；只用上一段尾帧解释来源，不把上一段尾帧重新拍一遍'
    : '复现首帧和上一段尾帧状态，不换人不换关键道具';
  const openingRule = segment.index > 0
    ? `时间轴硬约束：0-${openingEnd}秒${openingContinuity}；${openingEnd}秒后必须明确转入本段核心场景「${progression.title}」，不得整段停留在上一段场景`
    : `时间轴硬约束：0-${openingEnd}秒建立本段核心场景「${progression.title}」、主角、关键道具和冲突方向`;

  return [
    openingRule,
    `${openingEnd}-${actionEnd}秒必须让观众看见本段信息增量：${progression.mustUnderstand || storyContract.videoDesc.visibleAction}；可见证据=${progression.visualEvidence || storyContract.videoDesc.visualCausality}`,
    `${finalStart}-${duration}秒停在可给下一段接住的尾帧：${contract.handoff.exitContinuity}；非最后段优先用地图、旗帜、门楼、道具、远景人物或场景方向作为尾帧，不用人物正脸近景`,
    `声音时间轴：对白=${dialogue}；旁白=${narration}；音效=${audio || '现场环境声和动作声'}；口型和声线跨段保持一致`,
  ].join('；');
}

function buildProviderSafePrompt(segment: ProductionSegmentPlan) {
  const contract = segment.shotFrameContract;
  const storyContract = segment.storySegmentContract;
  if (!contract) {
    throw new ProductionSegmentStartPayloadError('片段缺少 ShotFrameContract，拒绝启动真实视频生成。', {
      code: 'missing-shot-frame-contract',
      segmentIndex: segment.index,
    });
  }
  if (!storyContract) {
    throw new ProductionSegmentStartPayloadError('片段缺少 StorySegmentContract，拒绝启动真实视频生成。', {
      code: 'missing-story-segment-contract',
      segmentIndex: segment.index,
    });
  }

  const firstFrameInput = resolveFirstFrameInput(segment);
  const firstFrameImage = firstFrameInput.firstFrameImage;
  const firstFrameSourceText = describeFirstFrameSource(firstFrameInput.firstFrameSource);
  const previousStoryCue = segment.expectedInputs.previousStoryStateCue || '无上一段故事状态';
  const previousAudioCue = segment.expectedInputs.previousAudioCue || '无上一段声音状态';
  const providerPreviousStoryCue = removeNarrationCarryover(previousStoryCue, segment);
  const providerPreviousAudioCue = removeNarrationCarryover(previousAudioCue, segment);
  const compactPreviousStoryCue = compactProviderValue(providerPreviousStoryCue, 150);
  const compactPreviousAudioCue = compactProviderValue(providerPreviousAudioCue, 120);
  const boundaryBridgePrompt = segment.expectedInputs.boundaryBridgePrompt
    ? compactProviderValue(segment.expectedInputs.boundaryBridgePrompt, 160)
    : '';
  const audioEventSummary = compactProviderValue(
    storyContract.audioContract.audioEventContract.providerInstruction,
    140
  );
  const progression = buildSegmentProgressionCue(segment);
  const progressionStartFrame = firstFrameInput.firstFrameSource === 'boundary-new-camera'
    ? '边界 bridge 的 new-camera 首帧'
    : '上一段尾帧';
  const continuityHardConstraint = firstFrameImage
    ? `连续性硬约束：${firstFrameSourceText} 开头1到2秒必须直接承接传入首帧图像的人物位置、服装、关键道具、场景方向和情绪，不重新开场；本段不是上一段重复，承接完成后必须推进到「${progression.title}」，不得整段停留在上一段场景；故事承接上一段，上一段故事=${compactPreviousStoryCue}；声音承接上一段，上一段声音=${compactPreviousAudioCue}`
    : '连续性硬约束：第一段必须清楚建立人物、地点、关键道具、主角目标、冲突对象和声音基调';
  const progressionHardConstraint = firstFrameImage && segment.index > 0
    ? `本段不是上一段重复：承接完成后必须从${progressionStartFrame}推进到「${progression.title}」，不得整段停留在上一段场景；画面必须出现${progression.visualEvidence || storyContract.videoDesc.visualCausality}；声音必须出现${progression.soundCue || storyContract.audioContract.soundDesign}`
    : `本段核心信息：${progression.title}；画面必须出现${progression.visualEvidence || storyContract.videoDesc.visualCausality}；声音必须出现${progression.soundCue || storyContract.audioContract.soundDesign}`;
  const timeAxisConstraint = buildProviderTimeAxisConstraint(segment, firstFrameInput);

  return compactProviderPrompt([
    `短剧连续片段 ${segment.index + 1}，写实电影感，镜头和角色动作连续`,
    '尾帧传递安全：非最后段最终画面必须停在地图、旗帜、门楼、道具或场景远景，避免人物正脸和近脸。',
    firstFrameImage && segment.index > 0
      ? `本段不是上一段重复：承接首帧后必须推进到本段核心信息，不得整段停留在上一段场景。`
      : '',
    `连续性硬约束摘要：首帧来源=${firstFrameSourceText}；故事承接上一段；上一段故事=${compactPreviousStoryCue}；声音承接上一段；上一段声音=${compactPreviousAudioCue}；边界桥接计划=${boundaryBridgePrompt || '第一段无上一段边界，建立稳定开场'}；时间轴硬约束=开头复现传入首帧状态后推进本段，结尾停在可给下一段接住的尾帧；声音时间轴=承接上一段音色后进入本段`,
    `声音事件摘要：${audioEventSummary}`,
    `开头画面：${contract.firstFrame.description}`,
    `主角目标：${storyContract.storyState.currentGoal}`,
    `本段核心信息：${progression.title}；画面必须出现${progression.visualEvidence || storyContract.videoDesc.visualCausality}`,
    progressionHardConstraint,
    `声音设计：${segment.audioState?.audioCue || contract.audioDescription || storyContract.audioContract.soundDesign}`,
    `声音事件：${storyContract.audioContract.audioEventContract.providerInstruction}`,
    '版权安全硬约束：只生成原创公共史实画面，人物、构图、服装和镜头均为新设计；服化道只使用晚唐到五代十国公共历史元素',
    '内容安全硬约束：不表现伤口、流血、暴力细节或近景创伤；战争代价只用换旗、地图红印、医棚火光、疲惫军士、急促脚步和道具状态表达',
    '尾帧传递安全：非最后段的最终画面必须是可继续作为下一段首帧的地图、旗帜、门楼、道具或场景远景，避免人物正脸、近脸和疑似真人隐私图。',
    `本段有声收尾：对白=${storyContract.audioContract.dialogue || '无'}；旁白=${storyContract.audioContract.narration || '无'}；声音=${segment.audioState?.soundDesign || storyContract.audioContract.soundDesign}`,
    `本段结尾动作：${contract.lastFrame.description}；最后停在${contract.handoff.exitContinuity}`,
    continuityHardConstraint,
    `声音设计：${segment.audioState?.audioCue || contract.audioDescription || '现场环境声、角色呼吸和短句对白'}`,
    `声音事件：${storyContract.audioContract.audioEventContract.providerInstruction}`,
    `声音承接上一段：${compactPreviousAudioCue}`,
    `故事承接上一段：${compactPreviousStoryCue}`,
    `开头画面：${contract.firstFrame.description}`,
    progressionHardConstraint,
    timeAxisConstraint,
    `对白旁白：对白 ${storyContract.audioContract.dialogue || '无'}，旁白 ${storyContract.audioContract.narration || '无'}`,
    `开头画面：${contract.firstFrame.description}`,
    `本段动作：${contract.motionDescription}`,
    `本段剧情：${segment.prompt}`,
    `主角目标：${storyContract.storyState.currentGoal}`,
    `故事冲突：${storyContract.storyState.conflict}`,
    `可见状态变化：${storyContract.storyState.visibleStateChange}`,
    `可见冲突：${contract.visualStoryEvidence.conflictEvidence}`,
    `操作结果：${contract.visualStoryEvidence.operationResultEvidence}`,
    `结尾画面：${contract.lastFrame.description}`,
    `下一段钩子：${contract.visualStoryEvidence.endingHookEvidence}`,
    contract.handoff.requiresPreviousLastFrame
      ? `承接上一段尾帧：${contract.handoff.entryContinuity}`
      : '第一段先建立人物、地点、关键道具和目标',
    `交给下一段：${contract.handoff.exitContinuity}`,
    providerPreviousAudioCue
      ? `声音承接上一段：${compactPreviousAudioCue}`
      : '声音从本段环境声开始建立',
    providerPreviousStoryCue
      ? `故事承接上一段：${compactPreviousStoryCue}`
      : '故事从本段建立主角目标、冲突、关键道具和情绪',
    '画面不出现字幕文字，角色服装、关键道具、场景方向和情绪保持一致',
  ]);
}

export function buildProductionSegmentStartPayload(segment: ProductionSegmentPlan): ProductionSegmentStartPayload {
  const contractBlock = buildContractPromptBlock(segment);
  const firstFrameInput = resolveFirstFrameInput(segment);
  const prompt = [
    contractBlock,
    '',
    '【本段执行 Prompt】',
    segment.prompt,
    '',
    '【执行要求】只表现本段唯一信息增量、桥接动作和操作结果；尾帧必须成为下一段能接住的清晰状态。',
    '【有声要求】如果启用有声生成，必须保留本段对白/旁白/环境声；下一段开头要承接上一段的情绪、环境音余韵和角色声线。',
  ].join('\n');
  const providerPrompt = buildProviderSafePrompt(segment);

  return {
    version: 'yh-segment-start-payload-v1',
    usesShotFrameContract: true,
    contractVersion: segment.shotFrameContract.version,
    variationType: segment.shotFrameContract.variationType,
    firstFrameImage: firstFrameInput.firstFrameImage,
    firstFrameSource: firstFrameInput.firstFrameSource,
    previousLastFrameImage: segment.expectedInputs.previousLastFrameUrl,
    prompt,
    promptPreview: prompt.slice(0, 1400),
    providerPrompt,
    providerPromptPreview: providerPrompt.slice(0, 900),
    providerPromptLength: providerPrompt.length,
    visualStoryEvidence: segment.shotFrameContract.visualStoryEvidence,
    storySegmentContract: {
      version: segment.storySegmentContract.version,
      videoDesc: segment.storySegmentContract.videoDesc,
      storyState: segment.storySegmentContract.storyState,
      audioContract: segment.storySegmentContract.audioContract,
      dependencyContract: segment.storySegmentContract.dependencyContract,
      readiness: segment.storySegmentContract.readiness,
    },
    audioState: segment.audioState || null,
    audioEventContract: segment.storySegmentContract.audioContract.audioEventContract,
    audioContinuity: {
      previousAudioCue: segment.expectedInputs.previousAudioCue || null,
      prompt: segment.expectedInputs.audioContinuityPrompt || null,
    },
    storyContinuity: {
      previousStoryStateCue: segment.expectedInputs.previousStoryStateCue || null,
      prompt: segment.expectedInputs.storyContinuityPrompt || null,
    },
    boundaryBridge: {
      boundaryBridgeId: segment.expectedInputs.boundaryBridgeId || null,
      bridgeStrategy: segment.expectedInputs.bridgeStrategy || null,
      bridgeFirstFrameUrl: segment.expectedInputs.bridgeFirstFrameUrl || null,
      prompt: segment.expectedInputs.boundaryBridgePrompt || null,
    },
    readiness: {
      pass: true,
      blockers: [],
      warnings: [
        ...segment.shotFrameContract.readiness.warnings,
        ...segment.storySegmentContract.readiness.warnings,
      ],
    },
  };
}
