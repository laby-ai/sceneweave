// 声纹相关类型定义

export interface VoicePrint {
  id: string;
  name: string;
  audioBlob: Blob;
  audioUrl: string;
  duration: number; // 秒
  sampleRate: number;
  createdAt: number;
  isProcessing: boolean;
  isVerified: boolean;
}

export interface VoicePrintRecording {
  isRecording: boolean;
  audioChunks: Blob[];
  mediaRecorder: MediaRecorder | null;
  stream: MediaStream | null;
  startTime: number;
}

export const VOICE_PRINTS_STORAGE_KEY = 'voice_prints';

export const DEFAULT_RECORDING_DURATION = 10; // 默认录制时长（秒）
export const MIN_RECORDING_DURATION = 3; // 最小录制时长
export const MAX_RECORDING_DURATION = 60; // 最大录制时长

export const SAMPLE_RATES = [
  { value: 44100, label: '44.1kHz (CD质量)' },
  { value: 48000, label: '48kHz (专业质量)' },
  { value: 22050, label: '22.05kHz (中等质量)' },
  { value: 16000, label: '16kHz (语音质量)' },
];

// 生成唯一ID
export function generateVoicePrintId(): string {
  return `voiceprint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 格式化时长
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs}秒`;
}

// 验证音频
export function validateAudio(blob: Blob): { valid: boolean; error?: string } {
  if (!blob) {
    return { valid: false, error: '音频数据为空' };
  }
  
  if (blob.size === 0) {
    return { valid: false, error: '音频文件大小为0' };
  }
  
  // 检查文件类型
  if (!blob.type.startsWith('audio/')) {
    return { valid: false, error: '文件类型不是音频' };
  }
  
  return { valid: true };
}

// 从localStorage加载声纹
export function loadVoicePrints(): VoicePrint[] {
  try {
    const saved = localStorage.getItem(VOICE_PRINTS_STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      // 注意：音频数据无法直接存储在localStorage中，这里只存储元数据
      return data.map((item: any) => ({
        ...item,
        // audioBlob和audioUrl需要从其他地方恢复
      }));
    }
  } catch (e) {
    console.error('加载声纹失败:', e);
  }
  return [];
}

// 保存声纹元数据到localStorage
export function saveVoicePrintsMeta(voicePrints: VoicePrint[]): void {
  try {
    // 只保存元数据，不保存音频数据
    const metaData = voicePrints.map(vp => ({
      id: vp.id,
      name: vp.name,
      duration: vp.duration,
      sampleRate: vp.sampleRate,
      createdAt: vp.createdAt,
      isVerified: vp.isVerified,
    }));
    localStorage.setItem(VOICE_PRINTS_STORAGE_KEY, JSON.stringify(metaData));
  } catch (e) {
    console.error('保存声纹失败:', e);
  }
}

// 创建声纹对象
export function createVoicePrint(
  name: string,
  audioBlob: Blob,
  audioUrl: string,
  duration: number,
  sampleRate: number = 44100
): VoicePrint {
  return {
    id: generateVoicePrintId(),
    name,
    audioBlob,
    audioUrl,
    duration,
    sampleRate,
    createdAt: Date.now(),
    isProcessing: false,
    isVerified: false,
  };
}