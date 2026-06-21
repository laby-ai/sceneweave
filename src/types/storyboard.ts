// 分镜头相关类型定义

export interface StoryboardShot {
  id: string;
  index: number;
  prompt: string;
  duration: number; // 秒，最大10秒
  referenceImage?: string; // 用户上传的参考图片URL（用于首帧）
  useReferenceAsNineGrid?: boolean; // 是否使用参考图片代替九宫格
  nineGridImages?: string[]; // 九宫格图片URL数组（已废弃，改用全局九宫格）
  videoUrl?: string; // 生成的视频URL
  lastFrameUrl?: string; // 最后一帧图片URL，用于下一段的连贯性
  firstFrameUrl?: string; // 首帧图片URL（用于接收上一段的尾帧）
  status?: 'pending' | 'generating-images' | 'images-generated' | 'images_generated' | 'generating-video' | 'video_generated' | 'completed' | 'failed';
  error?: string;
}

export interface Storyboard {
  id: string;
  title: string;
  totalDuration: number; // 总时长，超过10秒
  shots: StoryboardShot[];
  status: 'draft' | 'generating' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  // 全局九宫格配置（所有段共享）
  globalNineGridImages?: string[]; // 全局九宫格图片数组（最多9张）
  useGlobalNineGrid?: boolean; // 是否使用全局九宫格模式
}

export interface StoryboardGenerationConfig {
  totalDuration: number;
  shots: Array<{
    prompt: string;
    duration: number;
  }>;
}

// 九宫格图片替换请求
export interface NineGridImageReplaceRequest {
  storyboardId: string;
  shotId: string;
  imageIndex: number; // 要替换的图片索引（0-8）
  newPrompt?: string; // 新的提示词（可选，复用原提示词）
}

// 分镜头再生成请求
export interface StoryboardRegenerateRequest {
  storyboardId: string;
  regenerateAll?: boolean; // 是否重新生成所有
  shotsToRegenerate?: string[]; // 指定要重新生成的分镜头ID列表
  imagesToReplace?: Array<{
    shotId: string;
    imageIndex: number;
  }>; // 要替换的图片列表
}
