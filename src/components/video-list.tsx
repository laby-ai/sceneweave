'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Download, Palette, Heart, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { STYLE_OPTIONS, MOOD_OPTIONS } from '@/constants/styles';
import { 
  FILTER_OPTIONS, 
  VIDEO_RESOLUTION_OPTIONS, 
  VIDEO_RATIO_OPTIONS 
} from '@/constants/filters';
import { RemixButton } from '@/components/remix-button';

interface GeneratedVideo {
  id: string;
  videoUrl: string;
  prompt: string;
  createdAt: number;
  duration?: string;
  style?: string;
  mood?: string;
  filter?: string;
  resolution?: string;
  ratio?: string;
}

interface VideoListProps {
  videos: GeneratedVideo[];
  onSelect: (video: GeneratedVideo) => void;
  onRemix?: (video: GeneratedVideo) => void;
}

export function VideoList({ videos, onSelect, onRemix }: VideoListProps) {
  const getStyleLabel = (styleValue: string) => {
    return STYLE_OPTIONS.find(s => s.value === styleValue)?.label || styleValue;
  };

  const getMoodLabel = (moodValue: string) => {
    return MOOD_OPTIONS.find(m => m.value === moodValue)?.label || moodValue;
  };

  const getFilterLabel = (filterValue: string) => {
    return FILTER_OPTIONS.find(f => f.value === filterValue)?.label || filterValue;
  };

  const getResolutionLabel = (resolutionValue: string) => {
    return VIDEO_RESOLUTION_OPTIONS.find(r => r.value === resolutionValue)?.label || resolutionValue;
  };

  const getRatioLabel = (ratioValue: string) => {
    return VIDEO_RATIO_OPTIONS.find(r => r.value === ratioValue)?.label || ratioValue;
  };

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="w-5 h-5 text-green-600" />
          已生成视频 ({videos.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {videos.map((video) => (
            <div
              key={video.id}
              className="p-4 bg-muted rounded-lg hover:bg-muted/80 cursor-pointer transition-colors space-y-2"
              onClick={() => onSelect(video)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2">{video.prompt}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(video.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {onRemix && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <RemixButton onClick={() => onRemix(video)} size="sm" variant="ghost" />
                    </div>
                  )}
                  <a
                    href={video.videoUrl}
                    download={`video_${video.id}.mp4`}
                    className="p-2 hover:bg-background rounded-md transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {video.duration && (
                  <Badge variant="secondary" className="text-xs">
                    {video.duration}秒
                  </Badge>
                )}
                {video.resolution && (
                  <Badge variant="secondary" className="text-xs">
                    {getResolutionLabel(video.resolution)}
                  </Badge>
                )}
                {video.ratio && (
                  <Badge variant="secondary" className="text-xs">
                    {getRatioLabel(video.ratio)}
                  </Badge>
                )}
                {video.style && video.style !== 'none' && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <Palette className="w-3 h-3" />
                    {getStyleLabel(video.style)}
                  </Badge>
                )}
                {video.mood && video.mood !== 'none' && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {getMoodLabel(video.mood)}
                  </Badge>
                )}
                {video.filter && video.filter !== 'none' && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {getFilterLabel(video.filter)}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
