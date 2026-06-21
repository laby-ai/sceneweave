'use client';

import type { Dispatch, MouseEvent, ReactNode, RefObject, SetStateAction } from 'react';
import {
  AlertCircle, BookmarkPlus, CheckCircle2, Clapperboard, Clock, Film,
  ImageIcon, Lightbulb, Loader2, MapPin, Paperclip, Play, Upload,
  Users, Video, Wand2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChatHistoryEntry, ChatMessage, TaskItem } from '@/lib/smart-assistant-panel-model';

export type SmartLeftPanelTab = 'chat' | 'assets' | 'references';

export type SmartCreationParams = {
  scriptType?: string;
  visualStyle?: string;
  targetDuration?: number;
  inputText?: string;
  characters?: string[];
  scenes?: string[];
  mood?: string;
  cameraStyle?: string;
  genre?: string;
  shotCount?: number;
  duration?: number;
};

export type SmartReference = {
  id: string;
  type: 'style' | 'character' | 'scene';
  name: string;
  desc: string;
  imageUrl?: string;
  isUserAdded?: boolean;
};

export type SmartBgmType = 'none' | 'gentle' | 'cheerful' | 'cinematic' | 'emotional';

const QUICK_TOOLS = [
  { icon: Video, name: '视频创作', desc: '生成视频内容', color: 'text-rose-500', bgColor: 'bg-rose-500/8', barColor: 'bg-rose-500', action: 'video' },
  { icon: ImageIcon, name: '图片生成', desc: '创建图片作品', color: 'text-blue-500', bgColor: 'bg-blue-500/8', barColor: 'bg-blue-500', action: 'image' },
  { icon: Clapperboard, name: '导演链路', desc: '导演/编剧/制片/镜头', color: 'text-cyan-500', bgColor: 'bg-cyan-500/8', barColor: 'bg-cyan-500', action: 'director_chain' },
  { icon: Film, name: '影视创作', desc: '剧本到成片', color: 'text-violet-500', bgColor: 'bg-violet-500/8', barColor: 'bg-violet-500', action: 'film' },
  { icon: Wand2, name: '提示词', desc: '优化创作效果', color: 'text-amber-500', bgColor: 'bg-amber-500/8', barColor: 'bg-amber-500', action: 'prompt' },
];

export type SmartQuickTool = (typeof QUICK_TOOLS)[number];

type SmartAssistantSidebarProps = {
  allTasks: TaskItem[];
  assetFilter: Set<string>;
  bgmType: SmartBgmType;
  bgmVolume: number;
  chatHistory: ChatHistoryEntry[];
  creationParams: SmartCreationParams;
  currentChatId: string;
  currentStep: number;
  formatTime: (timestamp: number) => string;
  getStatusIcon: (status: string) => ReactNode;
  handleDeleteHistory: (historyId: string, event: MouseEvent<HTMLButtonElement>) => void;
  handleDeleteReference: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  handleNewChat: () => void;
  handleReferenceClick: (reference: SmartReference) => void;
  handleReferenceFileUpload: (files: File[]) => void;
  handleToolClick: (tool: SmartQuickTool) => void;
  isDragOver: boolean;
  leftPanelTab: SmartLeftPanelTab;
  loadHistoryChat: (historyId: string) => void;
  messages: ChatMessage[];
  referenceFileInputRef: RefObject<HTMLInputElement | null>;
  references: SmartReference[];
  selectedTool: string | null;
  setAssetFilter: Dispatch<SetStateAction<Set<string>>>;
  setBgmType: Dispatch<SetStateAction<SmartBgmType>>;
  setBgmVolume: Dispatch<SetStateAction<number>>;
  setCreationParams: Dispatch<SetStateAction<SmartCreationParams>>;
  setIsDragOver: Dispatch<SetStateAction<boolean>>;
  setLeftPanelTab: Dispatch<SetStateAction<SmartLeftPanelTab>>;
  setLightboxImage: Dispatch<SetStateAction<string | null>>;
  setTtsSpeed: Dispatch<SetStateAction<number>>;
  setTtsVoiceId: Dispatch<SetStateAction<string>>;
  ttsSpeed: number;
  ttsVoiceId: string;
};

export function SmartAssistantSidebar({
  allTasks,
  assetFilter,
  bgmType,
  bgmVolume,
  chatHistory,
  creationParams,
  currentChatId,
  currentStep,
  formatTime,
  getStatusIcon,
  handleDeleteHistory,
  handleDeleteReference,
  handleNewChat,
  handleReferenceClick,
  handleReferenceFileUpload,
  handleToolClick,
  isDragOver,
  leftPanelTab,
  loadHistoryChat,
  messages,
  referenceFileInputRef,
  references,
  selectedTool,
  setAssetFilter,
  setBgmType,
  setBgmVolume,
  setCreationParams,
  setIsDragOver,
  setLeftPanelTab,
  setLightboxImage,
  setTtsSpeed,
  setTtsVoiceId,
  ttsSpeed,
  ttsVoiceId,
}: SmartAssistantSidebarProps) {
  return (
    <>
        {/* ===== 左侧：工具 + 历史 + 任务 ===== */}
        <div className="w-[260px] flex-shrink-0 border-r border-border flex flex-col bg-card/50">
          {/* 创作工具 */}
          <div className="flex-shrink-0 p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider">创作工具</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_TOOLS.map(tool => (
                <button
                  key={tool.name}
                  onClick={() => handleToolClick(tool)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-all overflow-hidden relative ${
                    selectedTool === tool.name
                      ? `${tool.bgColor} ${tool.color} shadow-sm ring-1 ring-border`
                      : 'bg-accent/30 text-foreground/70 hover:bg-accent/50 hover:shadow-sm'
                  }`}
                >
                  <div className={`w-1 h-6 rounded-full flex-shrink-0 ${tool.barColor} ${selectedTool === tool.name ? 'opacity-100' : 'opacity-40'}`} />
                  <tool.icon className={`w-4 h-4 flex-shrink-0 ${selectedTool === tool.name ? tool.color : ''}`} />
                  <span className="text-[11px] font-medium truncate">{tool.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab切换：对话 / 资产库 / 参考素材 */}
          <div className="flex-shrink-0 flex border-b border-border">
            <button
              onClick={() => setLeftPanelTab('chat')}
              className={`flex-1 py-2 text-xs font-medium transition-all text-center ${
                leftPanelTab === 'chat'
                  ? 'text-[#70E0FF] border-b-2 border-[#70E0FF]'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >对话</button>
            <button
              onClick={() => setLeftPanelTab('assets')}
              className={`flex-1 py-2 text-xs font-medium transition-all text-center relative ${
                leftPanelTab === 'assets'
                  ? 'text-[#70E0FF] border-b-2 border-[#70E0FF]'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              资产
              {messages.filter(m => m.assetType && m.generationStatus === 'completed').length > 0 && (
                <span className="absolute -top-0.5 right-1 min-w-[14px] h-[14px] rounded-full bg-[#70E0FF] text-[9px] text-white flex items-center justify-center font-bold">
                  {messages.filter(m => m.assetType && m.generationStatus === 'completed').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setLeftPanelTab('references')}
              className={`flex-1 py-2 text-xs font-medium transition-all text-center relative ${
                leftPanelTab === 'references'
                  ? 'text-[#70E0FF] border-b-2 border-[#70E0FF]'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              参考
              {references.filter(r => r.isUserAdded).length > 0 && (
                <span className="absolute -top-0.5 right-1 min-w-[14px] h-[14px] rounded-full bg-amber-500 text-[9px] text-white flex items-center justify-center font-bold">
                  {references.filter(r => r.isUserAdded).length}
                </span>
              )}
            </button>
          </div>

          {/* ===== 资产库视图 ===== */}
          {leftPanelTab === 'assets' && (
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-3">
              {/* 筛选条 */}
              <div className="flex items-center gap-1.5 mb-3">
                {['角色', '场景', '分镜', '道具'].map(type => (
                  <button
                    key={type}
                    onClick={() => {
                      setAssetFilter(prev => {
                        const next = new Set(prev);
                        if (next.has(type)) next.delete(type); else next.add(type);
                        return next;
                      });
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${
                      assetFilter.has(type)
                        ? type === '角色' ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400' :
                          type === '场景' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
                          type === '分镜' ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
                          'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                        : 'bg-accent/30 text-muted-foreground'
                    }`}
                  >{type}</button>
                ))}
              </div>
              {/* 网格展示 */}
              <div className="grid grid-cols-2 gap-2">
                {messages
                  .filter(m => (m.assetType || m.generatedImages?.length) && m.generationStatus === 'completed')
                  .flatMap(m => {
                    const images = m.generatedImages || [];
                    const inferType = (img: typeof images[0]) => {
                      const label = img.label || '';
                      if (label.includes('角色') || m.assetType === '角色') return '角色';
                      if (label.includes('场景') || m.assetType === '场景') return '场景';
                      if (label.includes('分镜') || m.assetType === '分镜' || m.assetType === 'storyboard') return '分镜';
                      if (m.assetType === '道具') return '道具';
                      return m.assetType || '分镜';
                    };
                    return images.map((img, idx) => ({
                      id: `${m.id}-${idx}`,
                      image: img,
                      msgType: inferType(img),
                      characterName: m.characterDesignSheet?.characterName,
                      assetPrompt: m.assetPrompt,
                    }));
                  })
                  .filter(item => assetFilter.has(item.msgType))
                  .map(item => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border/50 bg-card overflow-hidden cursor-pointer hover:shadow-md hover:border-border transition-all group"
                      onClick={() => item.image.url && setLightboxImage(item.image.url)}
                    >
                      <div className="relative aspect-square bg-accent/20">
                        {item.image.url ? (
                          <img src={item.image.url} alt={item.image.label || 'asset'} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                          </div>
                        )}
                        <span className={`absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          item.msgType === '角色' ? 'bg-orange-500/80 text-white' :
                          item.msgType === '场景' ? 'bg-blue-500/80 text-white' :
                          item.msgType === '分镜' ? 'bg-red-500/80 text-white' :
                          'bg-purple-500/80 text-white'
                        }`}>{item.msgType}</span>
                        <span className="absolute top-1 right-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/80 text-white">已生成</span>
                      </div>
                      <div className="p-2">
                        <div className="text-[11px] font-medium text-foreground truncate">
                          {item.image.label || item.characterName || item.msgType}
                        </div>
                        {item.image.label && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-tight">{item.image.label}</p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              {messages.filter(m => (m.assetType || m.generatedImages?.length) && m.generationStatus === 'completed').flatMap(m => (m.generatedImages || []).map((img, idx) => ({ id: `${m.id}-${idx}`, type: img.label?.includes('角色') || m.assetType === '角色' ? '角色' : img.label?.includes('场景') || m.assetType === '场景' ? '场景' : m.assetType === 'storyboard' ? '分镜' : m.assetType || '分镜' }))).filter(item => assetFilter.has(item.type)).length === 0 && (
                <div className="text-center py-8">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground/40">还没有作品</p>
                  <p className="text-[10px] text-muted-foreground/25 mt-1">聊天中画的图会自动出现在这里</p>
                </div>
              )}
            </div>
          )}

          {/* ===== 对话视图（后台任务+历史） ===== */}
          {leftPanelTab === 'chat' && (<>
          {/* 后台生成任务 */}
          <div className="flex-shrink-0 p-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider">后台生成</span>
              <span className="text-[10px] text-foreground/30">{allTasks.length}个任务</span>
            </div>
            <div className="space-y-1 max-h-[160px] overflow-y-auto scrollbar-thin">
              {allTasks.length === 0 ? (
                <div className="text-xs text-foreground/20 text-center py-3 bg-primary/5 rounded-xl">
                  暂无生成任务
                </div>
              ) : (
                allTasks.slice(0, 5).map(task => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 transition-all cursor-pointer"
                  >
                    {getStatusIcon(task.status)}
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-foreground/70 truncate">{task.prompt?.slice(0, 18) || task.type}</div>
                      <div className="flex items-center gap-1">
                        {task.status === 'running' && (
                          <div className="flex-1 h-1 rounded-full bg-accent overflow-hidden">
                            <div className="h-full bg-[#70E0FF] rounded-full transition-all" style={{ width: `${task.progress}%` }} />
                          </div>
                        )}
                        <span className="text-[9px] text-foreground/25">{formatTime(task.createdAt)}</span>
                      </div>
                    </div>
                    {task.status === 'completed' && task.result?.videoUrl && (
                      <Play className="w-3 h-3 text-green-500 flex-shrink-0" />
                    )}
                    {task.status === 'completed' && task.result?.imageUrls && task.result.imageUrls.length > 0 && (
                      <ImageIcon className="w-3 h-3 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 对话历史 */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider">对话历史</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                className="h-6 px-2.5 text-[11px] text-primary/70 hover:text-primary hover:bg-primary/10 font-medium"
              >
                + 新对话
              </Button>
            </div>
            {chatHistory.length === 0 ? (
              <div className="text-xs text-foreground/20 text-center py-4">
                暂无历史对话
              </div>
            ) : (
              <div className="space-y-1">
                {chatHistory.map(item => (
                  <div
                    key={item.id}
                    className={`group flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${item.id === currentChatId ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground/70 border border-transparent'}`}
                    onClick={() => loadHistoryChat(item.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{item.title}</div>
                      <div className="text-[10px] text-foreground/25 mt-0.5">{typeof item.time === 'number' ? new Date(item.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : item.time}</div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteHistory(item.id, e)}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-0.5 rounded hover:bg-red-500/10 hover:text-red-500 transition-all"
                      title="删除"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 创作参数摘要 */}
          {currentStep >= 2 && (
            <div className="border-t border-border px-4 py-3">
              <div className="text-[11px] font-semibold text-foreground/40 uppercase tracking-wider mb-2">创作方案</div>
              <div className="space-y-1.5">
                {creationParams.genre && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Film className="w-3 h-3 text-primary/60" />
                    <span className="text-foreground/50">类型:</span>
                    <span className="text-foreground/80">{creationParams.genre}</span>
                  </div>
                )}
                {(creationParams.characters?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Users className="w-3 h-3 text-primary/60" />
                    <span className="text-foreground/50">角色:</span>
                    <span className="text-foreground/80">{creationParams.characters!.slice(0, 2).join('、')}{(creationParams.characters!.length) > 2 ? `等${creationParams.characters!.length}人` : ''}</span>
                  </div>
                )}
                {(creationParams.scenes?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <MapPin className="w-3 h-3 text-primary/60" />
                    <span className="text-foreground/50">场景:</span>
                    <span className="text-foreground/80">{creationParams.scenes?.length}个</span>
                  </div>
                )}
                {(creationParams.shotCount ?? 0) > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Clapperboard className="w-3 h-3 text-primary/60" />
                    <span className="text-foreground/50">分镜:</span>
                    <span className="text-foreground/80">{creationParams.shotCount}个镜头</span>
                  </div>
                )}
                {(creationParams.duration ?? 0) > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Clock className="w-3 h-3 text-primary/60" />
                    <span className="text-foreground/50">时长:</span>
                    <span className="text-foreground/80">~{creationParams.duration}秒</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 视觉风格预设 */}
          {currentStep >= 2 && (
            <div className="border-t border-border px-3 py-2.5">
              <div className="text-[10px] font-medium text-foreground/50 uppercase tracking-wider mb-1.5">视觉风格</div>
              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'default', label: '默认', emoji: '🎬' },
                  { id: 'cartoon', label: '卡通', emoji: '🎨' },
                  { id: 'elegant', label: '优雅', emoji: '✨' },
                  { id: 'healing', label: '治愈', emoji: '🌿' },
                  { id: 'modern', label: '现代简约', emoji: '📐' },
                  { id: 'neon', label: '霓虹', emoji: '🌃' },
                  { id: 'retro', label: '复古', emoji: '📻' },
                  { id: 'minimalist', label: '极简黑白', emoji: '⬛' },
                  { id: 'cinematic', label: '电影感', emoji: '🎥' },
                  { id: 'ink_wash', label: '水墨', emoji: '🖌️' },
                  { id: 'cyberpunk', label: '赛博朋克', emoji: '🤖' },
                ].map(style => (
                  <button
                    key={style.id}
                    onClick={() => setCreationParams(prev => ({ ...prev, visualStyle: style.label }))}
                    className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                      creationParams.visualStyle === style.label
                        ? 'bg-[#70E0FF]/15 border-[#70E0FF]/30 text-[#70E0FF]'
                        : 'bg-accent/30 border-border/50 text-foreground/60 hover:border-[#70E0FF]/20 hover:text-foreground/80'
                    }`}
                  >
                    {style.emoji} {style.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 配音设置 */}
          {currentStep >= 3 && (
            <div className="border-t border-border px-3 py-2.5">
              <div className="text-[10px] font-medium text-foreground/50 uppercase tracking-wider mb-1.5">配音设置</div>
              <div className="space-y-1.5">
                <select
                  value={ttsVoiceId}
                  onChange={e => setTtsVoiceId(e.target.value)}
                  className="w-full bg-accent/30 border border-border/50 rounded px-2 py-1 text-[11px] text-foreground/80"
                >
                  <option value="Chinese_Female_Gentle">温柔女声</option>
                  <option value="Chinese_Female_Lively">活泼女声</option>
                  <option value="Chinese_Female_Sweet">甜美女声</option>
                  <option value="Chinese_Female_Mature">成熟女声</option>
                  <option value="Chinese_Female_Child">童声女声</option>
                  <option value="Chinese_Male_Calm">沉稳男声</option>
                  <option value="Chinese_Male_Magnetic">磁性男声</option>
                  <option value="Chinese_Male_Young">青年男声</option>
                  <option value="Chinese_Male_Elderly">老年男声</option>
                  <option value="Chinese_Male_Child">童声男声</option>
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-foreground/50">语速</span>
                  <input
                    type="range" min="0.5" max="2" step="0.1"
                    value={ttsSpeed}
                    onChange={e => setTtsSpeed(parseFloat(e.target.value))}
                    className="flex-1 h-1 accent-[#70E0FF]"
                  />
                  <span className="text-[10px] text-foreground/60 w-6">{ttsSpeed}x</span>
                </div>
              </div>
            </div>
          )}

          {/* BGM选择 */}
          {currentStep >= 3 && (
            <div className="border-t border-border px-3 py-2.5">
              <div className="text-[10px] font-medium text-foreground/50 uppercase tracking-wider mb-1.5">背景音乐</div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1">
                  {[
                    { id: 'none', label: '无' },
                    { id: 'gentle', label: '轻柔' },
                    { id: 'cheerful', label: '欢快' },
                    { id: 'cinematic', label: '电影感' },
                    { id: 'emotional', label: '情感' },
                  ].map(bgm => (
                    <button
                      key={bgm.id}
                      onClick={() => setBgmType(bgm.id as 'none' | 'gentle' | 'cheerful' | 'cinematic' | 'emotional')}
                      className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                        bgmType === bgm.id
                          ? 'bg-[#70E0FF]/15 border-[#70E0FF]/30 text-[#70E0FF]'
                          : 'bg-accent/30 border-border/50 text-foreground/60 hover:border-[#70E0FF]/20'
                      }`}
                    >
                      {bgm.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-foreground/50">音量</span>
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={bgmVolume}
                    onChange={e => setBgmVolume(parseFloat(e.target.value))}
                    className="flex-1 h-1 accent-[#70E0FF]"
                  />
                  <span className="text-[10px] text-foreground/60 w-6">{Math.round(bgmVolume * 100)}%</span>
                </div>
              </div>
            </div>
          )}
          </>)}

          {/* ===== 参考素材视图 ===== */}
          {leftPanelTab === 'references' && (
            <div
              className="flex-1 min-h-0 flex flex-col"
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={e => {
                e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                if (files.length) handleReferenceFileUpload(files);
              }}
            >
              {/* 拖拽覆盖层 */}
              {isDragOver && (
                <div className="absolute inset-0 z-20 bg-primary/10 border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
                    <div className="text-sm font-medium text-primary">松开添加</div>
                  </div>
                </div>
              )}

              {/* 用户上传区 */}
              <div className="flex-shrink-0 p-3 border-b border-border">
                <button
                  onClick={() => referenceFileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-primary/30 text-primary/60 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">添加素材</span>
                </button>
                <div className="text-[10px] text-foreground/25 mt-1.5 text-center">拖拽图片到此处 · Ctrl+V 粘贴</div>
              </div>

              {/* 参考列表 */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-3 space-y-4">

                {/* 用户上传的素材 */}
                {references.filter(r => r.isUserAdded).length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-foreground/50 uppercase tracking-wider">我的</span>
                    <div className="mt-1.5 space-y-1.5">
                      {references.filter(r => r.isUserAdded).map(ref => (
                        <div
                          key={ref.id}
                          onClick={() => handleReferenceClick(ref)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 hover:border-primary/40 transition-all cursor-pointer group"
                        >
                          {ref.imageUrl ? (
                            <div className="w-10 h-10 rounded overflow-hidden bg-accent/30 flex-shrink-0">
                              <img src={ref.imageUrl} alt={ref.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm flex-shrink-0">
                              {ref.type === 'style' ? '🎨' : ref.type === 'character' ? '👤' : '🌆'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground/80 group-hover:text-foreground truncate">{ref.name}</div>
                            {ref.desc && <div className="text-[10px] text-foreground/40 truncate">{ref.desc}</div>}
                          </div>
                          <button onClick={(e) => handleDeleteReference(ref.id, e)} className="opacity-0 group-hover:opacity-100 p-1 text-foreground/20 hover:text-red-500 transition-all rounded hover:bg-red-500/10" title="移除">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 风格参考预设 */}
                <div>
                  <span className="text-[10px] font-semibold text-foreground/30 uppercase tracking-wider">风格参考</span>
                  <div className="mt-1.5 space-y-1.5">
                    {references.filter(r => r.type === 'style' && !r.isUserAdded).map(ref => (
                      <div
                        key={ref.id}
                        onClick={() => handleReferenceClick(ref)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/20 border border-border/30 hover:border-[#70E0FF]/15 hover:bg-accent/40 transition-all cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-red-500/20 to-rose-500/20 flex items-center justify-center text-xs">🎨</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground/60 group-hover:text-foreground/80">{ref.name}</div>
                          <div className="text-[10px] text-foreground/25">{ref.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 角色参考预设 */}
                <div>
                  <span className="text-[10px] font-semibold text-foreground/30 uppercase tracking-wider">角色参考</span>
                  <div className="mt-1.5 space-y-1.5">
                    {references.filter(r => r.type === 'character' && !r.isUserAdded).map(ref => (
                      <div
                        key={ref.id}
                        onClick={() => handleReferenceClick(ref)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/20 border border-border/30 hover:border-amber-500/15 hover:bg-accent/40 transition-all cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-xs">👤</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground/60 group-hover:text-foreground/80">{ref.name}</div>
                          <div className="text-[10px] text-foreground/25">{ref.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 场景参考预设 */}
                <div>
                  <span className="text-[10px] font-semibold text-foreground/30 uppercase tracking-wider">场景参考</span>
                  <div className="mt-1.5 space-y-1.5">
                    {references.filter(r => r.type === 'scene' && !r.isUserAdded).map(ref => (
                      <div
                        key={ref.id}
                        onClick={() => handleReferenceClick(ref)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/20 border border-border/30 hover:border-green-500/15 hover:bg-accent/40 transition-all cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-green-500/20 to-cyan-500/20 flex items-center justify-center text-xs">🌆</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground/60 group-hover:text-foreground/80">{ref.name}</div>
                          <div className="text-[10px] text-foreground/25">{ref.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 空状态 - 没有任何参考 */}
                {references.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-foreground/20">
                    <BookmarkPlus className="w-8 h-8 mb-2" />
                    <div className="text-xs text-center">暂无参考素材</div>
                    <div className="text-[10px] mt-1">拖拽图片 / 粘贴 / 点击添加</div>
                  </div>
                )}
              </div>

              {/* 底部提示 */}
              <div className="flex-shrink-0 px-3 py-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-[10px] text-foreground/25">
                  <Lightbulb className="w-3 h-3" />
                  <span>点击预设可插入对话，拖拽图片添加自定义参考</span>
                </div>
              </div>
            </div>
          )}
        </div>
    </>
  );
}
