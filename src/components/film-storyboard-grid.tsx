import { useState, useCallback } from 'react';
import { RefreshCw, Eye, Wand2, Loader2, Check, Clock, User, Image as ImageIcon } from 'lucide-react';
import type { FilmShot } from '@/types/film';

interface FilmStoryboardGridProps {
  shots: FilmShot[];
  onConfirm: () => void;
  onRegenerateShot: (shotId: string) => void;
  onRegenerateAll: () => void;
  isGenerating: boolean;
  generatingShotIds: string[];
  generatedImages: Record<string, string>;
}

export function FilmStoryboardGrid({
  shots,
  onConfirm,
  onRegenerateShot,
  onRegenerateAll,
  isGenerating,
  generatingShotIds,
  generatedImages,
}: FilmStoryboardGridProps) {
  const [selectedShot, setSelectedShot] = useState<string | null>(null);
  const [hoveredShot, setHoveredShot] = useState<string | null>(null);

  // 按场景分组
  const groupedShots = shots.reduce((groups, shot) => {
    const key = `场景${shot.sceneNumber}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(shot);
    return groups;
  }, {} as Record<string, FilmShot[]>);

  const totalDuration = shots.reduce((sum, s) => sum + (s.duration || 5), 0);
  const completedCount = Object.keys(generatedImages).length;

  return (
    <div className="flex flex-col h-full">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-foreground">分镜预览</h3>
          <span className="text-xs text-foreground/70">
            {completedCount}/{shots.length} 已完成 · {totalDuration}秒
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRegenerateAll}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-foreground/70 bg-card rounded-lg border border-border hover:bg-card disabled:opacity-50 transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5" />
            {isGenerating ? '生成中...' : '批量生成素材'}
          </button>
          <button
            onClick={onConfirm}
            disabled={completedCount < shots.length}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:bg-[#333333] transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            确认并合成
          </button>
        </div>
      </div>

      {/* 分镜网格 */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {Object.entries(groupedShots).map(([sceneName, sceneShots]) => (
          <div key={sceneName} className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              {sceneName}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {sceneShots.map((shot, idx) => {
                const imageUrl = generatedImages[shot.id];
                const isGenerating = generatingShotIds.includes(shot.id);
                const isSelected = selectedShot === shot.id;
                const isHovered = hoveredShot === shot.id;

                return (
                  <div
                    key={shot.id}
                    className={`
                      group relative rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer
                      ${isSelected ? 'border-red-500 ring-2 ring-purple-100' : 'border-border hover:border-red-300'}
                    `}
                    onClick={() => setSelectedShot(isSelected ? null : shot.id)}
                    onMouseEnter={() => setHoveredShot(shot.id)}
                    onMouseLeave={() => setHoveredShot(null)}
                  >
                    {/* 图片区域 */}
                    <div className="aspect-video bg-secondary relative">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={shot.content}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-foreground/70 gap-2">
                          <ImageIcon className="w-8 h-8 opacity-50" />
                          <span className="text-xs">待生成</span>
                        </div>
                      )}

                      {/* 悬浮操作层 */}
                      {(isHovered || isSelected) && (
                        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onRegenerateShot(shot.id);
                            }}
                            disabled={isGenerating}
                            className="w-8 h-8 rounded-full bg-card flex items-center justify-center hover:bg-secondary transition-colors"
                            title="重新生成"
                          >
                            {isGenerating ? (
                              <Loader2 className="w-4 h-4 text-red-600 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4 text-white" />
                            )}
                          </button>
                        </div>
                      )}

                      {/* 状态标签 */}
                      {imageUrl && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {isGenerating && (
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          生成中
                        </div>
                      )}

                      {/* 镜头序号 */}
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black text-white text-[10px] font-medium">
                        镜{shots.findIndex(s => s.id === shot.id) + 1}
                      </div>
                    </div>

                    {/* 信息区 */}
                    <div className="p-2 space-y-1 bg-card">
                      <p className="text-xs text-white line-clamp-2 leading-relaxed">
                        {shot.content}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-foreground/70">
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {shot.duration || 5}秒
                        </span>
                        {shot.characters.length > 0 && (
                          <span className="flex items-center gap-0.5">
                            <User className="w-2.5 h-2.5" />
                            {shot.characters.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
