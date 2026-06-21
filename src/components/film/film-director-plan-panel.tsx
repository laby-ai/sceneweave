"use client";

import { ArrowLeft, Film, Mountain, Package, Users } from 'lucide-react';
import type { FilmScript } from '@/types/film';
import { renderSafe } from '@/lib/film-creation-panel-model';

export function FilmDirectorPlanPanel({
  script,
  onBackToCanvas,
}: {
  script: FilmScript | null;
  onBackToCanvas: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/40 overflow-hidden">
      <div className="px-4 py-2.5 bg-primary/5 border-b border-border/30 flex items-center gap-2">
        <span className="text-sm">📋</span>
        <span className="text-xs font-semibold text-primary">第二部分 · 导演方案</span>
        <button
          onClick={onBackToCanvas}
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[10px] text-primary/60 hover:text-primary hover:bg-primary/10 transition-all"
        >
          <ArrowLeft className="w-3 h-3" /> 返回画面
        </button>
      </div>
      {script ? (
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {(script.directorPlan?.characterCards || script.characters || []).length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-foreground/70 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-orange-500" /> 角色卡 ({(script.directorPlan?.characterCards || script.characters || []).length})
              </div>
              {(script.directorPlan?.characterCards || script.characters || []).map((character: any, i: number) => (
                <div key={i} className="border border-orange-500/20 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-orange-600">{character.name || `角色${i + 1}`}</span>
                    {character.age && <span className="px-1 py-0.5 rounded bg-orange-500/10 text-orange-500 text-[9px]">{character.age}岁</span>}
                    {character.gender && <span className="px-1 py-0.5 rounded bg-orange-500/10 text-orange-500 text-[9px]">{character.gender}</span>}
                    {character.mbti && <span className="px-1 py-0.5 rounded bg-indigo-500/10 text-indigo-500 text-[9px]">{renderSafe(character.mbti)}</span>}
                  </div>
                  {character.arc && <div className="text-[10px] text-foreground/40"><span className="font-medium">弧光:</span> {renderSafe(character.arc)}</div>}
                  {character.motivation && <div className="text-[10px] text-foreground/40"><span className="font-medium">动机:</span> {renderSafe(character.motivation)}</div>}
                  {character.appearance && <div className="text-[10px] text-foreground/40"><span className="font-medium">外观:</span> {renderSafe(character.appearance)}</div>}
                  {character.outfit && <div className="text-[10px] text-foreground/40"><span className="font-medium">着装:</span> {renderSafe(character.outfit)}</div>}
                  {character.personality && <div className="text-[10px] text-foreground/40"><span className="font-medium">性格:</span> {renderSafe(character.personality)}</div>}
                  {character.characterArc && <div className="text-[10px] text-foreground/40"><span className="font-medium">弧光:</span> {renderSafe(character.characterArc)}</div>}
                  {character.relationships && Object.keys(character.relationships).length > 0 && (
                    <div className="text-[10px] text-foreground/40">
                      <span className="font-medium">关系网:</span> {typeof character.relationships === 'string' ? character.relationships : Object.entries(character.relationships).map(([k, v]: [string, any]) => `${k}: ${v}`).join('; ')}
                    </div>
                  )}
                  {character.signatureDetail && <div className="text-[10px] text-foreground/40"><span className="font-medium">标志性细节:</span> {renderSafe(character.signatureDetail)}</div>}
                  {character.consistencyRules && (
                    <div className="text-[9px] text-foreground/30">
                      <span className="font-medium">一致性:</span> {character.consistencyRules.mustInclude?.join('、') || '无'} | 禁止: {character.consistencyRules.mustExclude?.join('、') || '无'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {(script.directorPlan?.sceneCards || script.scenes || []).length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-foreground/70 flex items-center gap-1.5">
                <Mountain className="w-3.5 h-3.5 text-blue-500" /> 场景卡 ({(script.directorPlan?.sceneCards || script.scenes || []).length})
              </div>
              {(script.directorPlan?.sceneCards || script.scenes || []).map((scene: any, i: number) => (
                <div key={i} className="border border-blue-500/20 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-blue-600">{scene.name || scene.location || `场景${i + 1}`}</span>
                    {scene.interior !== undefined && <span className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[9px]">{scene.interior ? '内景' : '外景'}</span>}
                    {scene.timeOfDay && <span className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[9px]">{scene.timeOfDay}</span>}
                  </div>
                  {scene.visualDescription && <div className="text-[10px] text-foreground/50">{renderSafe(scene.visualDescription)}</div>}
                  {scene.description && !scene.visualDescription && <div className="text-[10px] text-foreground/50">{renderSafe(scene.description)}</div>}
                  {scene.fiveSenses && (
                    <div className="text-[10px] text-foreground/40 space-y-0.5">
                      <span className="font-medium">五感:</span>
                      {(scene.fiveSenses.sight || scene.fiveSenses.visual) && <div className="pl-3">视觉: {renderSafe(scene.fiveSenses.sight || scene.fiveSenses.visual)}</div>}
                      {(scene.fiveSenses.hearing || scene.fiveSenses.auditory) && <div className="pl-3">听觉: {renderSafe(scene.fiveSenses.hearing || scene.fiveSenses.auditory)}</div>}
                      {(scene.fiveSenses.smell || scene.fiveSenses.olfactory) && <div className="pl-3">嗅觉: {renderSafe(scene.fiveSenses.smell || scene.fiveSenses.olfactory)}</div>}
                      {(scene.fiveSenses.touch || scene.fiveSenses.tactile) && <div className="pl-3">触觉: {renderSafe(scene.fiveSenses.touch || scene.fiveSenses.tactile)}</div>}
                      {(scene.fiveSenses.taste || scene.fiveSenses.thermal) && <div className="pl-3">{scene.fiveSenses.thermal ? '温度' : '味觉'}: {renderSafe(scene.fiveSenses.taste || scene.fiveSenses.thermal)}</div>}
                    </div>
                  )}
                  {scene.symbolism && <div className="text-[10px] text-foreground/40"><span className="font-medium">象征:</span> {renderSafe(scene.symbolism)}</div>}
                  {scene.mood && <div className="text-[10px] text-foreground/40"><span className="font-medium">氛围:</span> {renderSafe(scene.mood)}</div>}
                  {scene.keyProps && <div className="text-[10px] text-foreground/40"><span className="font-medium">关键道具:</span> {renderSafe(scene.keyProps)}</div>}
                  {scene.colorPalette && <div className="text-[10px] text-foreground/40"><span className="font-medium">主色调:</span> {renderSafe(scene.colorPalette)}</div>}
                </div>
              ))}
            </div>
          )}

          {(script.directorPlan?.propCards || []).length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-foreground/70 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-purple-500" /> 道具卡 ({(script.directorPlan?.propCards || []).length})
              </div>
              {(script.directorPlan?.propCards || []).map((prop: any, i: number) => (
                <div key={i} className="border border-purple-500/20 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-purple-600">{prop.name || `道具${i + 1}`}</span>
                    {prop.category && <span className="px-1 py-0.5 rounded bg-purple-500/10 text-purple-500 text-[9px]">{prop.category}</span>}
                    {prop.closeup && <span className="px-1 py-0.5 rounded bg-red-500/10 text-red-500 text-[9px]">特写</span>}
                  </div>
                  {prop.appearance && <div className="text-[10px] text-foreground/50">{renderSafe(prop.appearance)}</div>}
                  <div className="flex flex-wrap gap-1">
                    {prop.material && <span className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[9px]">{prop.material}</span>}
                    {prop.color && <span className="px-1 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[9px]">{prop.color}</span>}
                    {prop.size && <span className="px-1 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-[9px]">{prop.size}</span>}
                  </div>
                  {prop.significance && <div className="text-[10px] text-foreground/40"><span className="font-medium">剧情意义:</span> {renderSafe(prop.significance)}</div>}
                </div>
              ))}
            </div>
          )}

          {(script.shots || []).length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-foreground/70 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-green-500" /> 分镜详情 ({(script.shots || []).length}个镜头)
              </div>
              {(script.shots || []).map((shot: any, i: number) => (
                <div key={i} className="border border-green-500/20 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="font-semibold text-green-600">镜头{shot.id || i + 1}</span>
                    {shot.shotType && <span className="px-1 py-0.5 rounded bg-green-500/10 text-green-500 text-[9px]">{shot.shotType}</span>}
                    {shot.angle && <span className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[9px]">{shot.angle}</span>}
                    {shot.cameraMovement && <span className="px-1 py-0.5 rounded bg-purple-500/10 text-purple-500 text-[9px]">{shot.cameraMovement}</span>}
                    {shot.duration && <span className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[9px]">{shot.duration}s</span>}
                    {shot.emotionIntensity && <span className="px-1 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[9px]">情感{shot.emotionIntensity}</span>}
                  </div>
                  {shot.description && <div className="text-[10px] text-foreground/50">{renderSafe(shot.description)}</div>}
                  {shot.content && <div className="text-[10px] text-foreground/50">{renderSafe(shot.content)}</div>}
                  {shot.dialogue && <div className="text-[10px] text-foreground/45 italic pl-2">&ldquo;{renderSafe(shot.dialogue)}&rdquo;</div>}
                  {shot.narrationDirection && <div className="text-[10px] text-foreground/40 pl-2">🎙 {renderSafe(shot.narrationDirection)}</div>}
                  {shot.soundDesign && <div className="text-[10px] text-foreground/40 pl-2">🔊 {renderSafe(shot.soundDesign)}</div>}
                  {shot.bgmCue && <div className="text-[10px] text-foreground/40 pl-2">🎵 {renderSafe(shot.bgmCue)}</div>}
                  {shot.transition && <div className="text-[10px] text-foreground/40 pl-2">➡ {renderSafe(shot.transition)}</div>}
                  {shot.colorNarrative && <div className="text-[10px] text-foreground/40 pl-2">🎨 {renderSafe(shot.colorNarrative)}</div>}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {script.narrationScript && (
              <div className="border border-border/30 rounded-lg p-3">
                <div className="text-[10px] font-semibold text-foreground/60 mb-1">旁白脚本</div>
                <div className="text-[10px] text-foreground/40 whitespace-pre-line max-h-32 overflow-y-auto">{script.narrationScript}</div>
              </div>
            )}
            {script.bgmSuggestion && (
              <div className="border border-border/30 rounded-lg p-3">
                <div className="text-[10px] font-semibold text-foreground/60 mb-1">BGM 方案</div>
                <div className="text-[10px] text-foreground/40 whitespace-pre-line max-h-32 overflow-y-auto">{script.bgmSuggestion}</div>
              </div>
            )}
          </div>

          {(script.directorPlan?.consistencyNotes || (script as any).consistencyConstraints) && (
            <div className="border border-rose-500/20 rounded-lg p-3">
              <div className="text-[10px] font-semibold text-rose-600 mb-1">人物一致性约束</div>
              <div className="text-[10px] text-foreground/40 whitespace-pre-line">{renderSafe(script.directorPlan?.consistencyNotes || (script as any).consistencyConstraints)}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 text-center text-[11px] text-foreground/30">生成剧本后此处展示完整导演方案</div>
      )}
    </div>
  );
}
