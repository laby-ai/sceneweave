import type { ChatMessage } from '@/lib/smart-assistant-panel-model';

interface ConfirmationAnchor {
  kind: 'character' | 'scene' | 'prop';
  label: string;
  description: string;
}

interface ConfirmationShot {
  index: number;
  title: string;
  duration: number;
  camera: string;
  description: string;
  action?: string;
  dialogue?: string;
  narration?: string;
}

export interface VimaxAgentConfirmationView {
  heading: '我理解的是';
  title: string;
  summary: string;
  story: {
    premise?: string;
    protagonist?: string;
    goal?: string;
    obstacle?: string;
    turn?: string;
    hook?: string;
  };
  anchors: ConfirmationAnchor[];
  shots: ConfirmationShot[];
  nextStep: string;
}

function clean(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function buildVimaxAgentConfirmationView(message: ChatMessage): VimaxAgentConfirmationView | null {
  const agent = message.vimaxAgent;
  if (!agent || agent.phase !== 'plan' || message.generationStatus !== 'completed') return null;

  const story = agent.story;
  const anchors: ConfirmationAnchor[] = [
    ...(agent.characters || []).map(item => ({ kind: 'character' as const, label: item.label, description: item.description })),
    ...(agent.scenes || []).map(item => ({ kind: 'scene' as const, label: item.label, description: item.description })),
    ...(agent.props || []).map(item => ({ kind: 'prop' as const, label: item.label, description: item.description })),
  ].filter(item => clean(item.label) && clean(item.description));
  const storyView: VimaxAgentConfirmationView['story'] = {};
  const storyFields: Array<[keyof VimaxAgentConfirmationView['story'], string | undefined]> = [
    ['premise', clean(story?.premise)],
    ['protagonist', clean(story?.protagonist)],
    ['goal', clean(story?.desire)],
    ['obstacle', clean(story?.obstacle || story?.conflict)],
    ['turn', clean(story?.turningPoint)],
    ['hook', clean(story?.endingHook)],
  ];
  for (const [key, value] of storyFields) {
    if (value) storyView[key] = value;
  }

  return {
    heading: '我理解的是',
    title: agent.title,
    summary: clean(agent.summary) || clean(message.content) || '',
    story: storyView,
    anchors,
    shots: (agent.shots || []).map(shot => {
      const actionStart = clean(shot.actionStart);
      const actionEnd = clean(shot.actionEnd);
      return {
        index: shot.index,
        title: shot.title,
        duration: shot.duration,
        camera: shot.camera,
        description: shot.prompt,
        action: actionStart && actionEnd
          ? `${actionStart} → ${actionEnd}`
          : actionStart || actionEnd,
        dialogue: clean(shot.dialogue),
        narration: clean(shot.narration),
      };
    }),
    nextStep: clean(agent.nextAction) || '确认后继续准备画面参考。',
  };
}
