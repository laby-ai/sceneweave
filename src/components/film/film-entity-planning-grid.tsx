"use client";

import { CheckCircle2, Clapperboard, FileText, Image as ImageIcon, Loader2, Package, Send, Sparkles, UserCircle } from 'lucide-react';
import { FilmEditableField } from '@/components/film/film-editable-field';
import type { EntityCard } from '@/lib/film-creation-panel-model';

const ENTITY_TYPE_CONFIG = {
  plot: { label: '剧情', color: 'bg-red-500/10 text-red-500', icon: FileText },
  character: { label: '人物', color: 'bg-red-500/10 text-red-500', icon: UserCircle },
  scene: { label: '场景', color: 'bg-emerald-500/10 text-emerald-500', icon: ImageIcon },
  prop: { label: '道具', color: 'bg-purple-500/10 text-purple-500', icon: Package },
  shot: { label: '分镜', color: 'bg-red-500/10 text-red-500', icon: Clapperboard },
} as const;

const PLANNING_TYPES: EntityCard['type'][] = ['plot', 'character', 'scene', 'prop', 'shot'];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec > 0 ? `${min}分${sec}秒` : `${min}分钟`;
}

function buildCardChatContent(card: EntityCard): string {
  if (card.type === 'plot') return card.promptCn || card.description;
  if (card.type === 'character') {
    return [
      card.name,
      card.gender,
      card.age,
      card.appearance && `外貌: ${card.appearance}`,
      card.personality && `性格: ${card.personality}`,
      card.outfit && `服装: ${card.outfit}`,
    ].filter(Boolean).join('，');
  }
  if (card.type === 'scene') {
    return [card.name, card.location, card.timeOfDay, card.mood, card.promptCn].filter(Boolean).join('，');
  }
  return [
    card.name,
    card.shotType,
    card.cameraAngle,
    card.action && `动作: ${card.action}`,
    card.dialogue && `对白: ${card.dialogue}`,
    card.narration && `旁白: ${card.narration}`,
    card.promptCn,
  ].filter(Boolean).join('，');
}

export function FilmEntityPlanningGrid({
  entityCards,
  selectedCardId,
  videoDuration,
  onSelectedCardChange,
  onSetChatInput,
  onGeneratePrompt,
  onUpdateCardField,
}: {
  entityCards: EntityCard[];
  selectedCardId: string | null;
  videoDuration: number;
  onSelectedCardChange: (cardId: string | null) => void;
  onSetChatInput: (value: string) => void;
  onGeneratePrompt: (cardId: string) => void;
  onUpdateCardField: (cardId: string, field: string, value: string) => void;
}) {
  const editableField = (props: { cardId: string; field: string; value: string | undefined; label?: string; className?: string; multiline?: boolean }) => (
    <FilmEditableField {...props} onUpdate={onUpdateCardField} />
  );

  return (
    <>
      {PLANNING_TYPES.map(type => {
        const cards = entityCards.filter(card => card.type === type);
        if (cards.length === 0) return null;
        const cfg = ENTITY_TYPE_CONFIG[type];
        const Icon = cfg.icon;
        const shotSeconds = cards.reduce((sum, card) => sum + (card.duration || videoDuration), 0);

        return (
          <div key={type} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                <Icon className="w-3 h-3 inline mr-1" />
                {cfg.label}
              </span>
              {type === 'shot' && cards.length > 0 && (
                <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                  共{cards.length}镜头 · 总时长{shotSeconds.toFixed(0)}秒 ≈ {formatDuration(shotSeconds)}
                </span>
              )}
              <div className="flex-1 h-px bg-border/50" />
            </div>

            <div className={`grid gap-2 ${type === 'shot' ? 'grid-cols-1' : type === 'plot' ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {cards.map(card => (
                <div
                  key={card.id}
                  onClick={() => onSelectedCardChange(selectedCardId === card.id ? null : card.id)}
                  className={`p-3 rounded-xl bg-accent/10 border transition-all cursor-pointer ${
                    selectedCardId === card.id ? 'border-[#EF4444]/40 ring-1 ring-[#EF4444]/20' : 'border-border/50 hover:border-primary/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    {editableField({ cardId: card.id, field: 'name', value: card.name, className: 'font-medium text-xs text-foreground/90' })}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onSetChatInput(buildCardChatContent(card))}
                        className="p-1 rounded hover:bg-primary/10 text-foreground/30 hover:text-primary transition-colors"
                        title="发送到对话栏"
                      >
                        <Send className="w-2.5 h-2.5" />
                      </button>
                      {card.isGenerating && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                      {card.imageUrl && <CheckCircle2 className="w-3 h-3 text-red-500" />}
                    </div>
                  </div>

                  {card.type === 'plot' && (
                    editableField({ cardId: card.id, field: 'promptCn', value: card.promptCn || card.description, multiline: true, className: 'text-[10px] text-foreground/60 whitespace-pre-line leading-relaxed' })
                  )}

                  {card.type === 'character' && (
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex gap-2">
                        {editableField({ cardId: card.id, field: 'age', value: card.age, className: 'text-foreground/50' })}
                        {editableField({ cardId: card.id, field: 'gender', value: card.gender, className: 'text-foreground/50' })}
                      </div>
                      {editableField({ cardId: card.id, field: 'appearance', value: card.appearance, label: '外貌：', className: 'text-foreground/60' })}
                      {editableField({ cardId: card.id, field: 'personality', value: card.personality, label: '性格：', className: 'text-foreground/60' })}
                      {editableField({ cardId: card.id, field: 'outfit', value: card.outfit, label: '服装：', className: 'text-foreground/60', multiline: true })}
                      <CharacterSceneRefs card={card} entityCards={entityCards} onSetChatInput={onSetChatInput} />
                    </div>
                  )}

                  {card.type === 'scene' && (
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex gap-2">
                        {editableField({ cardId: card.id, field: 'location', value: card.location, className: 'text-foreground/50' })}
                        {editableField({ cardId: card.id, field: 'timeOfDay', value: card.timeOfDay, className: 'text-foreground/50' })}
                        {editableField({ cardId: card.id, field: 'mood', value: card.mood, className: 'text-foreground/50' })}
                      </div>
                      {editableField({
                        cardId: card.id,
                        field: 'description',
                        value: card.promptCn?.split('\n').find(line => line.startsWith('描述:'))?.replace('描述:', '').trim() || card.description,
                        label: '场景描述：',
                        multiline: true,
                        className: 'text-foreground/60',
                      })}
                      {editableField({ cardId: card.id, field: 'colorPalette', value: card.colorPalette, label: '主色调：', className: 'text-foreground/60' })}
                      {editableField({ cardId: card.id, field: 'lightingDir', value: card.lightingDir, label: '光源：', className: 'text-foreground/60' })}
                    </div>
                  )}

                  {card.type === 'prop' && (
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex gap-2 flex-wrap">
                        {card.propMaterial && <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{card.propMaterial}</span>}
                        {card.propColor && <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">{card.propColor}</span>}
                        {card.propSize && <span className="px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">{card.propSize}</span>}
                        {card.propCloseup && <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">特写</span>}
                      </div>
                      {editableField({ cardId: card.id, field: 'description', value: card.promptCn || card.description, label: '描述：', multiline: true, className: 'text-foreground/60' })}
                      {editableField({ cardId: card.id, field: 'propMaterial', value: card.propMaterial, label: '材质：', className: 'text-foreground/60' })}
                      {editableField({ cardId: card.id, field: 'propSignificance', value: card.propSignificance, label: '剧情意义：', multiline: true, className: 'text-foreground/60' })}
                      <PropCharacterRefs card={card} entityCards={entityCards} onSetChatInput={onSetChatInput} />
                    </div>
                  )}

                  {card.type === 'shot' && (
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex gap-2 flex-wrap">
                        {editableField({ cardId: card.id, field: 'shotType', value: card.shotType, className: 'px-1.5 py-0.5 rounded bg-primary/10 text-primary/80' })}
                        {editableField({ cardId: card.id, field: 'cameraAngle', value: card.cameraAngle, className: 'px-1.5 py-0.5 rounded bg-red-500/10 text-red-500/80' })}
                        {editableField({ cardId: card.id, field: 'duration', value: card.duration ? String(card.duration) : undefined, className: 'text-foreground/50' })}
                      </div>
                      {editableField({ cardId: card.id, field: 'action', value: card.action, label: '动作：', multiline: true, className: 'text-foreground/60' })}
                      {editableField({ cardId: card.id, field: 'dialogue', value: card.dialogue, label: '对白：', multiline: true, className: 'text-foreground/70 italic pl-2 border-l-2 border-primary/30' })}
                      {editableField({ cardId: card.id, field: 'narration', value: card.narration, label: '旁白：', multiline: true, className: 'text-foreground/60 pl-2 border-l-2 border-red-400/30' })}
                    </div>
                  )}

                  {card.isPromptGenerated && (
                    <div className="mt-2 pt-2 border-t border-border/30">
                      <div className="text-[10px] text-foreground/30 mb-1">AI 提示词</div>
                      {editableField({ cardId: card.id, field: 'promptEn', value: card.promptEn || card.promptCn, multiline: true, className: 'text-[10px] text-foreground/60' })}
                    </div>
                  )}

                  {!card.isPromptGenerated && (
                    <button
                      onClick={() => onGeneratePrompt(card.id)}
                      disabled={card.isGenerating}
                      className="mt-2 text-[10px] text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      <Sparkles className="w-2.5 h-2.5" /> 生成提示词
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function CharacterSceneRefs({
  card,
  entityCards,
  onSetChatInput,
}: {
  card: EntityCard;
  entityCards: EntityCard[];
  onSetChatInput: (value: string) => void;
}) {
  const sceneCards = entityCards.filter(item => item.type === 'scene');
  if (sceneCards.length === 0) return null;

  const characterScenes = sceneCards.filter(scene =>
    scene.promptCn?.includes(card.name) || scene.description?.includes(card.name) || scene.location?.includes(card.name)
  );

  return (
    <div className="pt-1.5 border-t border-border/30">
      <div className="text-foreground/40 mb-1">参考场景：</div>
      <div className="flex flex-wrap gap-1">
        {(characterScenes.length > 0 ? characterScenes : sceneCards).map(scene => (
          <span
            key={scene.id}
            className="px-1.5 py-0.5 rounded bg-primary/10 text-primary/70 text-[9px] cursor-pointer hover:bg-primary/20 transition-colors"
            onClick={() => onSetChatInput(`角色「${card.name}」在场景「${scene.name}」中`)}
          >
            {scene.name}{scene.location ? `·${scene.location}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function PropCharacterRefs({
  card,
  entityCards,
  onSetChatInput,
}: {
  card: EntityCard;
  entityCards: EntityCard[];
  onSetChatInput: (value: string) => void;
}) {
  const characterCards = entityCards.filter(item => item.type === 'character');
  if (characterCards.length === 0) return null;

  return (
    <div className="pt-1.5 border-t border-border/30">
      <div className="text-foreground/40 mb-1">关联角色：</div>
      <div className="flex flex-wrap gap-1">
        {characterCards.map(character => (
          <span
            key={character.id}
            className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-[9px] cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
            onClick={() => onSetChatInput(`道具「${card.name}」与角色「${character.name}」的交互`)}
          >
            {character.name}
          </span>
        ))}
      </div>
    </div>
  );
}
