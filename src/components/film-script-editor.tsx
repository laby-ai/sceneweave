import { useState } from 'react';
import { Edit3, Users, MapPin, Clock, Music, Check, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import type { FilmScript } from '@/types/film';

interface FilmScriptEditorProps {
  script: FilmScript;
  onConfirm: (script: FilmScript) => void;
  onRegenerate: () => void;
  isGenerating: boolean;
}

export function FilmScriptEditor({ script, onConfirm, onRegenerate, isGenerating }: FilmScriptEditorProps) {
  const [editableScript, setEditableScript] = useState<FilmScript>(script);
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'shots'>('overview');

  const updateCharacter = (index: number, field: string, value: string) => {
    const updated = [...editableScript.characters];
    updated[index] = { ...updated[index], [field]: value };
    setEditableScript({ ...editableScript, characters: updated });
  };

  const updateShot = (index: number, field: string, value: string | number) => {
    const updated = [...editableScript.shots];
    updated[index] = { ...updated[index], [field]: value };
    setEditableScript({ ...editableScript, shots: updated });
  };

  const totalShots = editableScript.shots.length;
  const totalDuration = editableScript.shots.reduce((sum, s) => sum + (s.duration || 5), 0);

  return (
    <div className="flex flex-col h-full">
      {/* 顶部概览 */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 mb-4 border border-purple-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-red-800 flex items-center gap-2">
            <Edit3 className="w-5 h-5" />
            {editableScript.title}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={onRegenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-foreground/70 bg-card rounded-lg border border-border hover:bg-card disabled:opacity-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isGenerating ? '生成中...' : '重新生成'}
            </button>
            <button
              onClick={() => onConfirm(editableScript)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              确认并生成分镜
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-foreground/70">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            总时长: {totalDuration}秒
          </span>
          <span className="flex items-center gap-1">
            <Edit3 className="w-4 h-4" />
            分镜: {totalShots}个
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            角色: {editableScript.characters.length}人
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            场景: {editableScript.scenes.length}个
          </span>
          <span className="flex items-center gap-1">
            <Music className="w-4 h-4" />
            BGM: {editableScript.bgmSuggestion}
          </span>
        </div>
      </div>

      {/* 标签页 */}
      <div className="flex gap-1 mb-3 bg-secondary p-1 rounded-lg w-fit">
        {(['overview', 'shots'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-card text-red-700 font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'overview' ? '概览' : '分镜详情'}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3">
        {activeTab === 'overview' ? (
          <>
            {/* 角色卡 */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">角色设定</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {editableScript.characters.map((char, idx) => (
                  <div key={char.id} className="bg-card rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-red-700 font-bold text-sm">
                        {char.name.charAt(0)}
                      </div>
                      <input
                        value={char.name}
                        onChange={e => updateCharacter(idx, 'name', e.target.value)}
                        className="font-medium text-white bg-transparent border-b border-transparent hover:border-border focus:border-red-400 focus:outline-none px-1"
                      />
                    </div>
                    <input
                      value={char.age}
                      onChange={e => updateCharacter(idx, 'age', e.target.value)}
                      placeholder="年龄"
                      className="text-xs text-muted-foreground bg-card rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-purple-300"
                    />
                    <textarea
                      value={char.appearance}
                      onChange={e => updateCharacter(idx, 'appearance', e.target.value)}
                      placeholder="外貌描述"
                      rows={2}
                      className="text-xs text-foreground/70 bg-card rounded px-2 py-1 w-full resize-none focus:outline-none focus:ring-1 focus:ring-purple-300"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 场景列表 */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">场景概览</h4>
              {editableScript.scenes.map(scene => {
                const sceneShots = editableScript.shots.filter(s => s.sceneId === scene.id);
                const isExpanded = expandedScene === scene.id;
                return (
                  <div key={scene.id} className="bg-card rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => setExpandedScene(isExpanded ? null : scene.id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-card transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-red-500" />
                        <span className="font-medium text-white">{scene.name}</span>
                        <span className="text-xs text-foreground/70">{scene.timeOfDay} · {scene.indoor ? '室内' : '室外'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-foreground/70">{sceneShots.length}个镜头</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-foreground/70" /> : <ChevronDown className="w-4 h-4 text-foreground/70" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2">
                        <p className="text-sm text-muted-foreground">{scene.description}</p>
                        <div className="text-xs text-foreground/70">
                          情绪: {scene.mood}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* 分镜详情 */
          <div className="space-y-2">
            {editableScript.shots.map((shot, idx) => (
              <div key={shot.id} className="bg-card rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
                    镜{idx + 1}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-foreground/70">
                    <span>{shot.shotType}</span>
                    <span>{shot.cameraAngle}</span>
                    <input
                      type="number"
                      value={shot.duration}
                      onChange={e => updateShot(idx, 'duration', Number(e.target.value))}
                      min={2}
                      max={10}
                      className="w-12 text-center bg-card rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-300"
                    />
                    <span>秒</span>
                  </div>
                </div>
                <textarea
                  value={shot.content}
                  onChange={e => updateShot(idx, 'content', e.target.value)}
                  rows={2}
                  className="text-sm text-white w-full bg-card rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300"
                />
                {shot.dialogue && (
                  <div className="text-xs text-muted-foreground border-l-2 border-red-300 pl-2">
                    对白: {shot.dialogue}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
