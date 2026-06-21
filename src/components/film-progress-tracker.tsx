import { CheckCircle, Film, FileText, Grid3x3, Image as ImageIcon, Video, Loader2, Clock } from 'lucide-react';

export type FilmStage = 'input' | 'script' | 'storyboard' | 'assets' | 'result';

interface FilmProgressTrackerProps {
  currentStage: FilmStage;
  stageMessages?: Partial<Record<FilmStage, string>>;
  progress?: number; // 0-100 当前步骤进度
  estimatedTime?: number; // 预计剩余秒数
}

const STAGES: { key: FilmStage; label: string; icon: typeof Film }[] = [
  { key: 'input', label: '创意输入', icon: FileText },
  { key: 'script', label: '脚本审阅', icon: Film },
  { key: 'storyboard', label: '分镜编排', icon: Grid3x3 },
  { key: 'assets', label: '素材生成', icon: ImageIcon },
  { key: 'result', label: '成片完成', icon: Video },
];

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}秒`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`;
}

export function FilmProgressTracker({ currentStage, stageMessages, progress = 0, estimatedTime }: FilmProgressTrackerProps) {
  const currentIndex = STAGES.findIndex(s => s.key === currentStage);
  const overallProgress = Math.max(0, Math.min(100, ((currentIndex + progress / 100) / STAGES.length) * 100));

  return (
    <div className="w-full py-4 px-2">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-between relative">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-accent -translate-y-1/2 z-0" />
        <div
          className="absolute top-1/2 left-0 h-0.5 bg-red-600 -translate-y-1/2 z-0 transition-all duration-500"
          style={{ width: `${Math.max(0, (currentIndex / (STAGES.length - 1)) * 100)}%` }}
        />

        {STAGES.map((stage, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const Icon = stage.icon;

          return (
            <div key={stage.key} className="relative z-10 flex flex-col items-center gap-1.5">
              <div
                className={`
                  w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300
                  ${isCompleted
                    ? 'bg-red-600 border-purple-600 text-white'
                    : isCurrent
                      ? 'bg-card border-purple-600 text-red-600 ring-4 ring-purple-100'
                      : 'bg-card border-border text-foreground/70'
                  }
                `}
              >
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span
                className={`
                  text-xs font-medium transition-colors duration-300 whitespace-nowrap
                  ${isCompleted ? 'text-red-600'
                    : isCurrent ? 'text-red-700'
                      : 'text-foreground/70'
                  }
                `}
              >
                {stage.label}
              </span>
              {stageMessages?.[stage.key] && (
                <span className="text-[10px] text-foreground/70 max-w-[80px] text-center truncate">
                  {stageMessages[stage.key]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 进度条 + 预计时间 */}
      {currentIndex >= 0 && currentIndex < STAGES.length && (
        <div className="mt-3 px-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground font-medium">
              总进度 {Math.round(overallProgress)}%
            </span>
            {estimatedTime !== undefined && estimatedTime > 0 && (
              <span className="text-xs text-foreground/70 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                预计剩余 {formatTime(estimatedTime)}
              </span>
            )}
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-red-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          {progress > 0 && progress < 100 && currentIndex < STAGES.length - 1 && (
            <div className="mt-1 text-[10px] text-red-500 text-center">
              当前步骤已完成 {Math.round(progress)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}
