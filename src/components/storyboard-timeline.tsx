'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Clock,
  Image as ImageIcon,
  Video,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import type { StoryboardScene } from '@/types/storyboard-scene';

// 组件 Props
interface StoryboardTimelineProps {
  scenes: StoryboardScene[];
  totalDuration: number;
  onSceneClick?: (sceneId: string) => void;
  onAddScene?: () => void;
  selectedSceneId?: string;
  readOnly?: boolean;
}

// 时间格式化
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// 获取状态图标
const getStatusIcon = (status: StoryboardScene['status']) => {
  switch (status) {
    case 'completed':
    case 'images_done':
    case 'video_done':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'generating':
      return <Clock className="w-4 h-4 text-red-500 animate-pulse" />;
    case 'failed':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-foreground/70" />;
  }
};

// 获取状态标签
const getStatusLabel = (status: StoryboardScene['status']) => {
  switch (status) {
    case 'draft':
      return '草稿';
    case 'generating':
      return '生成中';
    case 'images_done':
      return '图片完成';
    case 'video_done':
      return '视频完成';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    default:
      return status;
  }
};

export function StoryboardTimeline({
  scenes,
  totalDuration,
  onSceneClick,
  onAddScene,
  selectedSceneId,
  readOnly = false
}: StoryboardTimelineProps) {
  const [currentTime, setCurrentTime] = useState(0);

  // 按index排序场景
  const sortedScenes = [...scenes].sort((a, b) => a.index - b.index);

  return (
    <div className="w-full space-y-4">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">
            时间轴
          </h3>
          <Badge variant="secondary" className="bg-red-500 text-white">
            {scenes.length} 个场景
          </Badge>
          <Badge variant="secondary">
            总时长 {formatTime(totalDuration)}
          </Badge>
        </div>
        
        {!readOnly && onAddScene && (
          <Button
            onClick={onAddScene}
            className="bg-gradient-to-r from-red-500 to-pink-500 hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-2" />
            添加场景
          </Button>
        )}
      </div>

      {/* 场景列表 */}
      {sortedScenes.length === 0 ? (
        <Card className="bg-accent/30 border-border">
          <CardContent className="p-8 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-lg font-medium text-white mb-2">
              暂无场景
            </h4>
            <p className="text-foreground/70 text-sm">
              点击"添加场景"开始创建分镜头时间轴
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedScenes.map((scene) => {
            const isSelected = selectedSceneId === scene.id;
            const hasNineGrid = scene.nineGridImages && scene.nineGridImages.length > 0;
            const hasVideo = !!scene.videoUrl;
            
            return (
              <Card
                key={scene.id}
                className={`
                  cursor-pointer transition-all
                  ${isSelected ? 'ring-2 ring-purple-500 bg-accent/50' : 'bg-accent/30'}
                  border-border hover:bg-white/8
                `}
                onClick={() => onSceneClick?.(scene.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* 左侧：序号和状态 */}
                    <div className="flex flex-col items-center gap-2">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center font-bold
                        ${isSelected ? 'bg-red-500 text-white' : 'bg-accent/50 text-muted-foreground'}
                      `}>
                        {scene.index + 1}
                      </div>
                      {getStatusIcon(scene.status)}
                    </div>
                    
                    {/* 中间：内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {scene.title && (
                          <span className="font-medium text-white">
                            {scene.title}
                          </span>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {formatTime(scene.startTime)} - {formatTime(scene.endTime)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {scene.duration}秒
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${
                            scene.status === 'completed' ? 'bg-green-500 text-white' :
                            scene.status === 'generating' ? 'bg-red-500 text-black' :
                            scene.status === 'failed' ? 'bg-red-500 text-white' :
                            'bg-secondary text-foreground'
                          }`}
                        >
                          {getStatusLabel(scene.status)}
                        </Badge>
                        
                        {/* 有图片/视频标记 */}
                        <div className="flex gap-1">
                          {hasNineGrid && (
                            <Badge variant="secondary" className="text-xs bg-red-500 text-white">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              九宫格
                            </Badge>
                          )}
                          {hasVideo && (
                            <Badge variant="secondary" className="text-xs bg-green-500 text-white">
                              <Video className="w-3 h-3 mr-1" />
                              视频
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-foreground/80 line-clamp-2">
                        {scene.description}
                      </p>
                      
                      {/* 错误信息 */}
                      {scene.error && (
                        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {scene.error}
                        </p>
                      )}
                      
                      {/* 生成进度 */}
                      {scene.status === 'generating' && scene.generationProgress !== undefined && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>{scene.generationStage || '生成中...'}</span>
                            <span>{scene.generationProgress}%</span>
                          </div>
                          <div className="h-1.5 bg-accent/50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-500 transition-all"
                              style={{ width: `${scene.generationProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* 右侧：缩略图预览 */}
                    {scene.thumbnailImage && (
                      <div className="flex-shrink-0">
                        <div className="w-24 h-16 bg-black rounded overflow-hidden">
                          <img
                            src={scene.thumbnailImage}
                            alt={`场景 ${scene.index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 时间轴刻度（简化版） */}
      {sortedScenes.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Clock className="w-4 h-4" />
            <span>时间轴刻度</span>
          </div>
          <div className="h-8 bg-accent/30 rounded-lg relative overflow-hidden">
            {/* 刻度线 */}
            {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }).map((_, i) => {
              const time = i * 5;
              const position = (time / totalDuration) * 100;
              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-border"
                  style={{ left: `${Math.min(position, 100)}%` }}
                >
                  <span className="absolute -top-5 left-1 text-xs text-foreground/70">
                    {formatTime(time)}
                  </span>
                </div>
              );
            })}
            
            {/* 场景时间块 */}
            {sortedScenes.map((scene) => {
              const left = (scene.startTime / totalDuration) * 100;
              const width = (scene.duration / totalDuration) * 100;
              return (
                <div
                  key={scene.id}
                  className={`
                    absolute top-1 bottom-1 rounded cursor-pointer transition-all
                    ${selectedSceneId === scene.id ? 'bg-red-500/50' : 'bg-red-500/30'}
                    hover:bg-red-500/60
                  `}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`
                  }}
                  onClick={() => onSceneClick?.(scene.id)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
