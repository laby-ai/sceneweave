/**
 * 分镜头场景系统类型定义
 * 用于支持场景级别的操作和时间轴管理
 */

import type { StoryboardShot } from './storyboard';

// 场景状态
export type SceneStatus = 
  | 'draft'        // 草稿
  | 'generating'   // 生成中
  | 'images_done'  // 图片完成
  | 'video_done'   // 视频完成
  | 'completed'    // 全部完成
  | 'failed';      // 失败

// 分镜头场景
export interface StoryboardScene {
  id: string;
  index: number;                      // 排序索引
  startTime: number;                  // 开始时间（秒）
  endTime: number;                    // 结束时间（秒）
  duration: number;                   // 持续时间（自动计算）
  title?: string;                     // 场景标题（可选）
  description: string;                // 场景详细描述
  nineGridImages?: string[];          // 场景对应的九宫格图片（9张）
  thumbnailImage?: string;            // 缩略图（九宫格第1张）
  videoUrl?: string;                  // 场景对应的视频URL
  shotIds: string[];                  // 包含的分镜头ID列表
  shots?: StoryboardShot[];           // 完整的分镜头数据（可选）
  status: SceneStatus;                // 场景状态
  error?: string;                     // 错误信息
  generationProgress?: number;         // 生成进度 (0-100)
  generationStage?: string;           // 当前生成阶段描述
  metadata?: {
    cameraAngle?: string;             // 建议拍摄角度
    lighting?: string;                // 建议布光
    notes?: string;                   // 备注
  };
  createdAt: number;                  // 创建时间戳
  updatedAt: number;                  // 更新时间戳
}

// 增强版分镜头项目（支持场景模式）
export interface EnhancedStoryboard {
  id: string;
  title: string;
  description?: string;
  totalDuration: number;              // 总时长（秒）
  mode: 'simple' | 'scene' | 'node'; // 当前工作模式
  
  // 简单模式：原有分镜头列表（保留向后兼容）
  shots: StoryboardShot[];
  
  // 场景模式：场景列表（新功能）
  scenes?: StoryboardScene[];
  
  // 节点模式：节点工作流数据（新功能）
  nodeWorkflow?: {
    nodes: any[];
    edges: any[];
  };
  
  status: 'draft' | 'generating' | 'completed' | 'failed';
  error?: string;
  progress?: number;
  stage?: string;
  
  // 最终输出
  outputVideoUrl?: string;
  outputThumbnailUrl?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// 创建场景请求
export interface CreateSceneRequest {
  storyboardId: string;
  index?: number;
  startTime: number;
  endTime: number;
  description: string;
  title?: string;
}

// 更新场景请求
export interface UpdateSceneRequest {
  storyboardId: string;
  sceneId: string;
  updates: Partial<Omit<StoryboardScene, 'id' | 'createdAt' | 'updatedAt'>>;
}

// 删除场景请求
export interface DeleteSceneRequest {
  storyboardId: string;
  sceneId: string;
}

// 重排场景请求
export interface ReorderScenesRequest {
  storyboardId: string;
  sceneOrders: Array<{
    sceneId: string;
    newIndex: number;
    newStartTime?: number;
    newEndTime?: number;
  }>;
}

// 场景图片关联请求
export interface LinkSceneImagesRequest {
  storyboardId: string;
  sceneId: string;
  imageUrls: string[];
  autoAdjustTime?: boolean;
}

// 场景生成九宫格请求
export interface GenerateSceneImagesRequest {
  storyboardId: string;
  sceneId: string;
  prompt?: string;          // 可选，默认用场景描述
  imageCount?: number;       // 默认9张
  continuityWithPrevious?: boolean; // 是否与前一场景保持连贯
  previousSceneLastFrame?: string; // 前一场景最后一帧
}

// 场景批量操作响应
export interface SceneBatchResponse {
  success: boolean;
  storyboardId: string;
  updatedScenes: StoryboardScene[];
  message?: string;
  errors?: Array<{
    sceneId?: string;
    error: string;
  }>;
}
