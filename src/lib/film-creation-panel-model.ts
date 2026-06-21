import type { EntityCardSnapshot } from '@/hooks/useFilmHistory';
import type { FilmScript } from '@/types/film';
import type { CharacterAnchor } from '@/lib/video-production/character-consistency-engine';

export type WorkflowPhase = 'planning' | 'visual' | 'compose';

export interface EntityCard {
  id: string;
  type: 'plot' | 'character' | 'scene' | 'shot' | 'prop';
  name: string;
  description: string;
  promptCn: string;
  promptEn?: string;
  imageUrl?: string;
  videoUrl?: string;
  subtitleText?: string;
  audioUrl?: string;
  isGenerating?: boolean;
  isPromptGenerated?: boolean;
  age?: string;
  gender?: string;
  appearance?: string;
  personality?: string;
  outfit?: string;
  location?: string;
  timeOfDay?: string;
  mood?: string;
  colorPalette?: string;
  lightingDir?: string;
  propMaterial?: string;
  propColor?: string;
  propSize?: string;
  propSignificance?: string;
  propCloseup?: boolean;
  shotType?: string;
  cameraAngle?: string;
  duration?: number;
  dialogue?: string;
  narration?: string;
  action?: string;
  sceneId?: string;
  characters?: string[];
  emotionTag?: string;
  emotion?: string;
  images?: string[];
  shotDescription?: string;
  lastFrameUrl?: string;
  bridgeImages?: string[];
  bridgeGenerating?: boolean;
  bridgeProgress?: number;
  sceneNumber?: number;
  shotNumber?: number;
  mbti?: string;
  characterArc?: string;
  motivation?: string;
  relationships?: string;
  signatureDetail?: string;
  atmosphere?: string;
  symbolism?: string;
  keyProps?: string;
  cameraMovement?: string;
  soundDesign?: string;
  bgmChange?: string;
  emotionIntensity?: number;
  colorNarrative?: string;
  anchor?: CharacterAnchor;
  anchorGenerating?: boolean;
  consistencyScore?: number;
  consistencyIssues?: string[];
  gridPromptMode?: 'first_frame' | 'first_last' | 'multi_ref';
  startFrameUrl?: string;
  endFrameUrl?: string;
  prevShotEndFrameUrl?: string;
  startFrameGenerating?: boolean;
  endFrameGenerating?: boolean;
  nineGridImages?: string[];
  nineGridGenerating?: boolean;
  nineGridSelectedIndex?: number;
  shotStatus?: 'pending' | 'framing' | 'start_ready' | 'end_ready' | 'video_ready' | 'completed';
  scriptValidated?: boolean;
  scriptValidateMsg?: string;
  wardrobeOutfits?: { name: string; description: string; imageUrl?: string; promptEn?: string }[];
  activeOutfitIndex?: number;
  promptVersions?: { version: number; content: string; timestamp: number }[];
  worldviewAnchors?: { type: 'map' | 'region' | 'location' | 'music_style'; name: string; description: string }[];
  errorMsg?: string;
}

export interface ChatGenResult {
  type: 'script' | 'character' | 'scene' | 'prop' | 'image' | 'video' | 'compose';
  title: string;
  count?: number;
  thumbnailUrl?: string;
  status: 'generating' | 'done' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  quickOptions?: string[];
  msgType?: 'text' | 'progress' | 'result';
  genResults?: ChatGenResult[];
}

export interface FilmCreationPanelProps {
  initialPrompt?: string;
  autoGenerate?: boolean;
  targetService?: string;
  transferredData?: import('@/types/film').SmartAssistantTransferData;
  onScriptGenerated?: (script: FilmScript) => void;
  onStoryboardGenerated?: () => void;
  onVideoGenerated?: (url: string, videoPrompt?: string) => void;
}

export function entityCardToSnapshot(card: EntityCard): EntityCardSnapshot {
  return {
    id: card.id,
    type: card.type,
    name: card.name || '',
    description: card.description || '',
    promptCn: card.promptCn || '',
    promptEn: card.promptEn || '',
    imageUrl: card.imageUrl || null,
    startFrameUrl: card.startFrameUrl || null,
    endFrameUrl: card.endFrameUrl || null,
    videoUrl: card.videoUrl || null,
    nineGridImages: card.nineGridImages || null,
    nineGridSelectedIndex: card.nineGridSelectedIndex ?? null,
    shotStatus: card.shotStatus || null,
    isPromptGenerated: !!card.isPromptGenerated,
    gender: card.gender || '',
    age: card.age || '',
    appearance: card.appearance || '',
    personality: card.personality || '',
    outfit: card.outfit || '',
    location: card.location || '',
    timeOfDay: card.timeOfDay || '',
    mood: card.mood || '',
    colorPalette: card.colorPalette || '',
    lightingDir: card.lightingDir || '',
    propMaterial: card.propMaterial || '',
    propColor: card.propColor || '',
    propSize: card.propSize || '',
    propSignificance: card.propSignificance || '',
    propCloseup: !!card.propCloseup,
    shotType: card.shotType || '',
    cameraAngle: card.cameraAngle || '',
    action: card.action || '',
    dialogue: card.dialogue || '',
    narration: card.narration || '',
    duration: card.duration ?? null,
    emotionTag: card.emotionTag || '',
    emotion: card.emotion || '',
    cameraMovement: card.cameraMovement || '',
  };
}

export function snapshotToEntityCard(snap: EntityCardSnapshot): EntityCard {
  return {
    id: snap.id,
    type: snap.type,
    name: snap.name,
    description: snap.description,
    promptCn: snap.promptCn,
    promptEn: snap.promptEn,
    imageUrl: snap.imageUrl || undefined,
    startFrameUrl: snap.startFrameUrl || undefined,
    endFrameUrl: snap.endFrameUrl || undefined,
    videoUrl: snap.videoUrl || undefined,
    nineGridImages: snap.nineGridImages || undefined,
    nineGridSelectedIndex: snap.nineGridSelectedIndex ?? undefined,
    shotStatus: (snap.shotStatus as EntityCard['shotStatus']) || undefined,
    isPromptGenerated: snap.isPromptGenerated,
    gender: snap.gender || undefined,
    age: snap.age || undefined,
    appearance: snap.appearance || undefined,
    personality: snap.personality || undefined,
    outfit: snap.outfit || undefined,
    location: snap.location || undefined,
    timeOfDay: snap.timeOfDay || undefined,
    mood: snap.mood || undefined,
    colorPalette: snap.colorPalette || undefined,
    lightingDir: snap.lightingDir || undefined,
    propMaterial: snap.propMaterial || undefined,
    propColor: snap.propColor || undefined,
    propSize: snap.propSize || undefined,
    propSignificance: snap.propSignificance || undefined,
    propCloseup: snap.propCloseup || undefined,
    shotType: snap.shotType || undefined,
    cameraAngle: snap.cameraAngle || undefined,
    action: snap.action || undefined,
    dialogue: snap.dialogue || undefined,
    narration: snap.narration || undefined,
    duration: snap.duration ?? undefined,
    emotionTag: snap.emotionTag || undefined,
    emotion: snap.emotion || undefined,
    cameraMovement: snap.cameraMovement || undefined,
  };
}

export function renderSafe(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(v => renderSafe(v)).join(', ');
  if (typeof val === 'object') {
    try {
      return Object.entries(val as Record<string, unknown>).map(([key, value]) => `${key}: ${renderSafe(value)}`).join('; ');
    } catch {
      return String(val);
    }
  }
  return String(val);
}
