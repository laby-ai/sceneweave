"use client";

import { ArrowLeft } from 'lucide-react';
import type { FilmScript } from '@/types/film';

export function FilmScreenplayPanel({
  script,
  fallbackShotCount,
  onBackToCanvas,
}: {
  script: FilmScript | null;
  fallbackShotCount: number;
  onBackToCanvas: () => void;
}) {
  const sceneCount = script ? (Array.isArray(script.screenplay) ? script.screenplay.length : script.scenes?.length || 0) : 0;
  const shotCount = script?.shots?.length || fallbackShotCount;

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden">
      <div className="px-4 py-2.5 bg-primary/5 border-b border-border/30 flex items-center gap-2">
        <span className="text-sm">🎬</span>
        <span className="text-xs font-semibold text-primary">第一部分 · 场景剧本</span>
        {script && <span className="text-[10px] text-foreground/40 ml-1">{sceneCount} 场景 · {shotCount} 镜头</span>}
        <button
          onClick={onBackToCanvas}
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[10px] text-primary/60 hover:text-primary hover:bg-primary/10 transition-all"
        >
          <ArrowLeft className="w-3 h-3" /> 返回画面
        </button>
      </div>
      {script ? (
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600">《{script.title}》</span>
            {script.coreTheme && <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600">主题: {script.coreTheme}</span>}
            {script.aspectRatio && <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">画幅: {script.aspectRatio}</span>}
            <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-600">风格: {script.style || '电影感'}</span>
            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600">时长: 约{script.totalDuration || 0}秒</span>
          </div>
          {script.colorNarrativeLine && (
            <div className="text-[11px] text-foreground/60 rounded-lg bg-background/60 p-2.5">
              <span className="font-medium text-foreground/80">色彩叙事线：</span>{script.colorNarrativeLine}
            </div>
          )}
          {script.emotionCurve && (
            <div className="text-[11px] text-foreground/60 rounded-lg bg-background/60 p-2.5">
              <span className="font-medium text-foreground/80">情绪曲线：</span>{script.emotionCurve}
            </div>
          )}
          {script.screenplay && script.screenplay.length > 0 ? (
            <div className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/75 bg-background/40 rounded-lg p-4 border border-border/20 space-y-5">
              {script.screenplay.map((scene: any, i: number) => (
                <div key={i} className="pb-4 border-b border-border/15 last:border-0">
                  <div className="font-bold text-foreground/85 text-[12px] mb-2">
                    场景{scene.sceneNumber || i + 1}：{scene.interior ? '内景' : '外景'}·{scene.location || ''} — {scene.timeOfDay || '日'}
                    {scene.title && <span className="ml-2 text-foreground/50 font-normal">「{scene.title}」</span>}
                  </div>
                  {scene.stageDirections && (
                    <div className="text-foreground/55 mb-2 pl-2 border-l-2 border-foreground/15">{scene.stageDirections}</div>
                  )}
                  {scene.dialogues && Array.isArray(scene.dialogues) && scene.dialogues.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {scene.dialogues.map((dialogue: any, j: number) => (
                        <div key={j} className="pl-6">
                          <div className="font-semibold text-primary/80 text-[11px]">{dialogue.character || '角色'}</div>
                          {dialogue.direction && <div className="text-[10px] text-foreground/35 italic">（{dialogue.direction}）</div>}
                          <div className="text-foreground/70 pl-3">{dialogue.line || ''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-foreground/40 mt-1">
                    {scene.cameraDirections && <span>🎥 {scene.cameraDirections}</span>}
                    {scene.soundDesign && <span>🔊 {scene.soundDesign}</span>}
                    {scene.transition && <span>➡ {scene.transition}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            (script.scenes || []).map((scene: any, sceneIndex: number) => {
              const sceneShots = (script.shots || []).filter((shot: any) => shot.sceneId === scene.id || shot.sceneIndex === sceneIndex + 1);
              return (
                <div key={sceneIndex} className="border border-border/30 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-secondary/50 flex items-center gap-2 text-[11px]">
                    <span className="font-semibold text-foreground/80">场景{scene.id || sceneIndex + 1}: {scene.name || scene.location || `场景${sceneIndex + 1}`}</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 text-[9px]">{scene.indoor ? '内景' : '外景'}</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 text-[9px]">{scene.timeOfDay || '日'}</span>
                    {scene.mood && <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 text-[9px]">{scene.mood}</span>}
                  </div>
                  {scene.description && (
                    <div className="px-3 py-1.5 text-[10px] text-foreground/50 border-b border-border/20">
                      环境: {scene.description}
                    </div>
                  )}
                  {sceneShots.length > 0 ? sceneShots.map((shot: any, shotIndex: number) => (
                    <div key={shotIndex} className="px-3 py-2 border-t border-border/15 text-[11px] space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground/70">镜头{shot.id || shotIndex + 1}</span>
                        {shot.shotType && <span className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 text-[9px]">{shot.shotType}</span>}
                        {shot.angle && <span className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 text-[9px]">{shot.angle}</span>}
                        {shot.cameraMovement && <span className="px-1 py-0.5 rounded bg-purple-500/10 text-purple-600 text-[9px]">{shot.cameraMovement}</span>}
                        {shot.duration && <span className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 text-[9px]">{shot.duration}s</span>}
                      </div>
                      {shot.description && <div className="text-foreground/60 pl-2">{shot.description}</div>}
                      {shot.dialogue && <div className="text-foreground/50 pl-2 italic">&ldquo;{shot.dialogue}&rdquo;</div>}
                      {shot.narrationDirection && <div className="text-foreground/40 pl-2 text-[10px]">🎙 {shot.narrationDirection}</div>}
                      {shot.soundDesign && <div className="text-foreground/40 pl-2 text-[10px]">🔊 {shot.soundDesign}</div>}
                      {shot.colorNarrative && <div className="text-foreground/40 pl-2 text-[10px]">🎨 {shot.colorNarrative}</div>}
                    </div>
                  )) : (
                    <div className="px-3 py-3 text-[10px] text-foreground/30 text-center">暂无分镜</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="p-6 text-center text-[11px] text-foreground/30">生成剧本后此处展示完整场景剧本</div>
      )}
    </div>
  );
}
