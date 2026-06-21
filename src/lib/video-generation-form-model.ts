export interface VideoTextSegment {
  id: string;
  text: string;
  position: 'top' | 'upper-third' | 'middle' | 'lower-third' | 'bottom' | 'custom';
  startTime: number;
  endTime: number;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: 'normal' | 'bold';
  backgroundColor?: string;
  backgroundOpacity?: number;
  borderColor?: string;
  borderWidth?: number;
  shadowColor?: string;
  shadowEnabled?: boolean;
  alignment?: 'left' | 'center' | 'right';
  customPositionY?: number;
  animation?: 'none' | 'fade' | 'slide' | 'scale';
  animationDuration?: number;
}

export interface VideoConfig {
  id: string;
  videoUrl: string;
  prompt: string;
  createdAt: number;
  duration?: string;
  style?: string;
  mood?: string;
  filter?: string;
  colorTheme?: string;
  resolution?: string;
  ratio?: string;
  hasSubtitle?: boolean;
  language?: string;
  smartEnhance?: boolean;
  watermark?: boolean;
  enableSubtitle?: boolean;
  subtitlePosition?: string;
  subtitleFontSize?: string;
  subtitleColor?: string;
  subtitleVoiceType?: string;
  subtitleSpeechSpeed?: number;
  generateVoice?: boolean;
  subtitleText?: string;
  materials?: unknown[];
  videoText?: string;
  enableVideoText?: boolean;
  videoTextPosition?: 'top' | 'upper-third' | 'middle' | 'lower-third' | 'bottom' | 'custom';
  videoTextCustomPositionY?: number;
  videoTextStartTime?: number;
  videoTextEndTime?: number;
  videoTextSegments?: VideoTextSegment[];
}

export interface VideoGenerationFormProps {
  onGenerate: (video: VideoConfig) => void;
  isGenerating: boolean;
  onGeneratingChange?: (isGenerating: boolean) => void;
  onPromptEnhanced?: (originalPrompt: string, enhancedPrompt: string) => void;
  initialPrompt?: string;
  initialConfig?: Partial<VideoConfig>;
}

export function generateVideoTextSegmentId(): string {
  return `video_text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createDefaultVideoTextSegment(duration: number = 10): VideoTextSegment {
  return {
    id: generateVideoTextSegmentId(),
    text: '',
    position: 'middle',
    startTime: 0,
    endTime: duration,
    fontSize: 48,
    fontColor: '#FFFFFF',
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backgroundOpacity: 0.6,
    borderColor: '#FFFFFF',
    borderWidth: 0,
    shadowColor: 'rgba(0, 0, 0, 0.8)',
    shadowEnabled: true,
    alignment: 'center',
    animation: 'fade',
    animationDuration: 0.5,
  };
}
