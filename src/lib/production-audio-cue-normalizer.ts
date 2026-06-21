import type { ProductionAssemblyPlan, ProductionSegmentPlan } from './production-assembly-plan';
import {
  buildAudioEventContract,
  describeStorySegmentCue,
} from './production-story-segment-contract';

export interface ProductionAudioCueNormalizationResult {
  assemblyPlan: ProductionAssemblyPlan;
  changed: boolean;
  changedSegmentIds: string[];
  filledAudioCueCount: number;
  filledPreviousAudioCueCount: number;
}

function firstNonEmpty(...values: Array<unknown>) {
  return values
    .map(value => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) || '';
}

const TEMPLATE_CONTAMINATION = /人物形象展示|情绪收尾|故事的尾声|着装符合人物身份|舒适家居服|海岸场景|柔和的自然光|最终状态/;
const PROMPT_SECTION_SPILL = /【(?:动作因果|三要素|画面证据|出点状态|声音提示|情绪推进|镜头执行|情绪变化|连续性规则|结尾保留)/;

function isTemplateContaminated(value: unknown) {
  return typeof value === 'string' && (TEMPLATE_CONTAMINATION.test(value) || PROMPT_SECTION_SPILL.test(value));
}

function firstCleanNonEmpty(...values: Array<unknown>) {
  return values
    .map(value => (typeof value === 'string' ? value.trim() : ''))
    .find(value => value && !isTemplateContaminated(value)) || '';
}

function extractPromptLabel(prompt: string | undefined, label: string) {
  if (!prompt) return '';
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = prompt.match(new RegExp(`【${escaped}】([^【\\n]+)`));
  return match?.[1]?.trim() || '';
}

function extractQuotedDialogue(prompt: string | undefined) {
  const match = prompt?.match(/“([^”]{1,24})”/);
  return match?.[1]?.trim() || '';
}

function buildCleanAudioState(segment: ProductionSegmentPlan) {
  const existing = firstCleanNonEmpty(
    segment.expectedOutputs?.audioCue,
    segment.audioState?.audioCue,
    segment.storySegmentContract?.audioContract?.audioCue,
  );
  const existingStateText = [
    segment.audioState?.dialogue,
    segment.audioState?.narration,
    segment.audioState?.soundDesign,
    segment.audioState?.audioCue,
  ].filter(Boolean).join(' ');
  if (existing && segment.audioState && !isTemplateContaminated(existingStateText)) {
    return {
      ...segment.audioState,
      audioCue: existing,
    };
  }

  const emotion = firstCleanNonEmpty(
    extractPromptLabel(segment.prompt, '情绪变化'),
    segment.storySegmentContract?.storyState?.emotionalState,
    '承接上一段情绪',
  );
  const dialogue = firstCleanNonEmpty(
    segment.storySegmentContract?.audioContract?.dialogue,
    extractQuotedDialogue(segment.prompt),
    '无',
  );
  const narration = firstCleanNonEmpty(
    segment.storySegmentContract?.audioContract?.narration,
    segment.shotFrameContract?.audioDescription,
    extractPromptLabel(segment.prompt, '观众必须看懂'),
    extractPromptLabel(segment.prompt, '剧情目的'),
    '无',
  );
  const sound = firstCleanNonEmpty(
    extractPromptLabel(segment.prompt, '声音提示'),
    segment.storySegmentContract?.audioContract?.soundDesign,
    segment.shotFrameContract?.audioDescription,
    segment.shotFrameContract?.motionDescription,
    '现场环境声、角色呼吸和动作声保持连续。',
  );

  const audioCue = [
    `情绪=${emotion}`,
    `对白=${dialogue}`,
    `旁白=${narration}`,
    `声音=${sound}`,
  ].join('；');
  return {
    dialogue: dialogue === '无' ? null : dialogue,
    narration: narration === '无' ? null : narration,
    soundDesign: sound,
    voiceStyle: '保持上一段角色语气、环境声和情绪余韵，不跨段换声线。',
    emotion,
    audioCue,
  };
}

function audioContinuityPrompt(segmentIndex: number, audioCue: string) {
  return [
    `承接片段 ${segmentIndex + 1} 的声音状态：${audioCue}`,
    '开头先保持上一段的环境声、角色语气和情绪余韵，再进入本段新的对白/音效。',
  ].join('');
}

function patchStorySegmentAudioCue(
  segment: ProductionSegmentPlan,
  audioState: NonNullable<ProductionSegmentPlan['audioState']>,
  previousAudioCue: string | null,
): ProductionSegmentPlan['storySegmentContract'] {
  if (!segment.storySegmentContract) return segment.storySegmentContract;
  return {
    ...segment.storySegmentContract,
    audioContract: {
      ...segment.storySegmentContract.audioContract,
      dialogue: audioState.dialogue,
      narration: audioState.narration,
      soundDesign: audioState.soundDesign,
      voiceStyle: audioState.voiceStyle,
      audioCue: audioState.audioCue,
      previousAudioCue,
      requiresAudioContinuity: segment.index > 0,
      audioEventContract: buildAudioEventContract(audioState),
    },
  };
}

export function normalizeProductionAssemblyAudioContinuity(
  assemblyPlan: ProductionAssemblyPlan,
): ProductionAudioCueNormalizationResult {
  let changed = false;
  let filledAudioCueCount = 0;
  let filledPreviousAudioCueCount = 0;
  const changedSegmentIds = new Set<string>();

  const segments: ProductionSegmentPlan[] = [];

  for (const segment of assemblyPlan.segments) {
    const audioState = buildCleanAudioState(segment);
    const audioCue = audioState.audioCue;
    const expectedOutputs = {
      ...segment.expectedOutputs,
      audioCue: segment.expectedOutputs.audioCue && !isTemplateContaminated(segment.expectedOutputs.audioCue)
        ? segment.expectedOutputs.audioCue
        : audioCue,
    };

    const originalAudioStateText = [
      segment.audioState?.dialogue,
      segment.audioState?.narration,
      segment.audioState?.soundDesign,
      segment.audioState?.audioCue,
      segment.expectedOutputs.audioCue,
    ].filter(Boolean).join(' ');
    if (!segment.expectedOutputs.audioCue || isTemplateContaminated(segment.expectedOutputs.audioCue)) {
      changed = true;
      filledAudioCueCount += 1;
      changedSegmentIds.add(segment.id);
    }
    if (!segment.audioState || isTemplateContaminated(originalAudioStateText)) {
      changed = true;
      changedSegmentIds.add(segment.id);
    }

    const previous = segments[segments.length - 1];
    const previousAudioCue = previous
      ? firstCleanNonEmpty(previous.expectedOutputs?.audioCue, previous.audioState?.audioCue)
      : null;
    const previousStoryStateCue = previous?.storySegmentContract
      ? describeStorySegmentCue(previous.storySegmentContract)
      : null;
    const previousReady = Boolean(
      previous
      && previous.status === 'completed'
      && (previous.expectedOutputs?.videoUrl || previous.expectedOutputs?.lastFrameUrl)
      && previousAudioCue,
    );
    const previousAudioCueText = previousReady ? previousAudioCue || '' : '';
    const expectedInputs = previousReady
      ? {
          ...segment.expectedInputs,
          previousAudioCue: segment.expectedInputs.previousAudioCue && !isTemplateContaminated(segment.expectedInputs.previousAudioCue)
            ? segment.expectedInputs.previousAudioCue
            : previousAudioCueText,
          audioContinuityPrompt: segment.expectedInputs.audioContinuityPrompt && !isTemplateContaminated(segment.expectedInputs.audioContinuityPrompt)
            ? segment.expectedInputs.audioContinuityPrompt
            : audioContinuityPrompt(previous.index, previousAudioCueText),
          previousStoryStateCue: segment.expectedInputs.previousStoryStateCue && !isTemplateContaminated(segment.expectedInputs.previousStoryStateCue)
            ? segment.expectedInputs.previousStoryStateCue
            : previousStoryStateCue,
          storyContinuityPrompt: segment.expectedInputs.storyContinuityPrompt && !isTemplateContaminated(segment.expectedInputs.storyContinuityPrompt)
            ? segment.expectedInputs.storyContinuityPrompt
            : previousStoryStateCue
              ? `承接片段 ${previous.index + 1} 的故事状态：${previousStoryStateCue}开头先复现上一段的目标、冲突、道具状态、情绪和出口画面，再推进本段唯一新信息。`
              : segment.expectedInputs.storyContinuityPrompt,
        }
      : segment.expectedInputs;

    if (previousReady && (!segment.expectedInputs.previousAudioCue || isTemplateContaminated(segment.expectedInputs.previousAudioCue))) {
      changed = true;
      filledPreviousAudioCueCount += 1;
      changedSegmentIds.add(segment.id);
    }
    if (previousReady && (
      !segment.expectedInputs.audioContinuityPrompt
      || isTemplateContaminated(segment.expectedInputs.audioContinuityPrompt)
      || isTemplateContaminated(segment.expectedInputs.previousStoryStateCue)
      || isTemplateContaminated(segment.expectedInputs.storyContinuityPrompt)
    )) {
      changed = true;
      changedSegmentIds.add(segment.id);
    }

    const storySegmentContract = patchStorySegmentAudioCue(
      segment,
      audioState,
      expectedInputs.previousAudioCue || null,
    );
    const completedStoryCue = storySegmentContract && segment.status === 'completed'
      ? describeStorySegmentCue(storySegmentContract)
      : segment.expectedOutputs.storyStateCue || null;
    const finalExpectedOutputs = {
      ...expectedOutputs,
      storyStateCue: completedStoryCue && (!segment.expectedOutputs.storyStateCue || isTemplateContaminated(segment.expectedOutputs.storyStateCue))
        ? completedStoryCue
        : segment.expectedOutputs.storyStateCue,
    };

    if (segment.expectedOutputs.storyStateCue && isTemplateContaminated(segment.expectedOutputs.storyStateCue)) {
      changed = true;
      changedSegmentIds.add(segment.id);
    }

    segments.push({
      ...segment,
      expectedInputs,
      expectedOutputs: finalExpectedOutputs,
      audioState,
      storySegmentContract,
    });
  }

  return {
    assemblyPlan: changed ? { ...assemblyPlan, segments } : assemblyPlan,
    changed,
    changedSegmentIds: Array.from(changedSegmentIds),
    filledAudioCueCount,
    filledPreviousAudioCueCount,
  };
}
