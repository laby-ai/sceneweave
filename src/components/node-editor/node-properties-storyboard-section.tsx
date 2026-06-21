'use client';

import {
  Camera,
  Copy,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Map,
  MapPin,
  Mic,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  User,
  Users,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { getBgmTypeList } from '@/constants/bgm-types';
import type { NodePropertiesSectionProps } from './node-properties-types';

export function StoryboardPropertiesSection({
  selectedNode,
  onUpdateNode,
  isGenerating,
  batchGenerateStoryboardImages,
  generateSingleStoryboardImage,
  generateVideoFromImage,
  generateAudio,
  composeFinalVideo,
  batchGenerateStoryboardVideos,
  regenerateImage,
  regenerateVideoFromNode,
  selectedStoryboards,
  setSelectedStoryboards,
  canWriteBackProductionAsset,
  canvasSaveInfo,
  onSaveStoryboardShot,
  handleCharacterUpload,
  handleSceneUpload,
  removeCharacterUpload,
  removeSceneUpload,
  selectedProductionKind,
  isProductionVideoAsset,
  selectedVideoUrl,
  selectedVideoTaskId,
  selectedVideoCanExport,
}: NodePropertiesSectionProps) {
  return (
    <>
            {selectedNode.type === 'storyboard' && (
              <div className="space-y-4">
                {/* 进度显示 */}
                {selectedNode.data.progress && (
                  <div className="bg-gradient-to-r from-cyan-400/10 to-sky-400/10 rounded-lg p-3 border border-cyan-300/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="w-4 h-4 text-cyan-300 animate-spin" />
                      <span className="text-xs font-medium text-cyan-300">生成中</span>
                    </div>
                    <div className="text-sm text-foreground/80 font-medium mb-3">
                      {selectedNode.data.progress}
                    </div>
                    {/* 可视化进度条 */}
                    <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-cyan-400 to-sky-300 h-full rounded-full transition-all duration-500 ease-out"
                        style={{ 
                          width: (() => {
                            const match = selectedNode.data.progress.match(/(\d+)\/(\d+)/);
                            if (match) {
                              const current = parseInt(match[1]);
                              const total = parseInt(match[2]);
                              return `${Math.min((current / total) * 100, 100)}%`;
                            }
                            return '50%';
                          })()
                        }}
                      />
                    </div>
                    {selectedNode.data.prompt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {selectedNode.data.prompt}
                      </p>
                    )}
                  </div>
                )}
                
                {/* 完成状态显示 */}
                {!selectedNode.data.progress && selectedNode.data.status === 'success' && (
                  <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-xs font-medium text-green-500">
                        {selectedNode.data.prompt || '生成完成'}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* 错误状态显示 */}
                {!selectedNode.data.progress && selectedNode.data.status === 'error' && (
                  <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-400/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-300"></div>
                      <span className="text-xs font-medium text-amber-200">
                        {selectedNode.data.prompt || '部分生成失败'}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground/80">分镜列表</label>
                  <div className="flex items-center gap-2">
                    {/* 选择统计 */}
                    {selectedNode.data.storyboard && selectedNode.data.storyboard.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        已选择 {selectedStoryboards.size}/{selectedNode.data.storyboard.length}
                      </span>
                    )}
                    
                    {/* 全选/取消全选/反选按钮 */}
                    {selectedNode.data.storyboard && selectedNode.data.storyboard.length > 0 && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const allIds = new Set(selectedNode.data.storyboard!.map(s => s.id));
                            setSelectedStoryboards(allIds);
                          }}
                          className="h-7 px-2 text-xs text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10"
                        >
                          全选
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedStoryboards(new Set());
                          }}
                          className="h-7 px-2 text-xs text-foreground/40 hover:text-gray-300 hover:bg-secondary/10"
                        >
                          取消全选
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const allIds = selectedNode.data.storyboard!.map(s => s.id);
                            const inverted = new Set(allIds.filter(id => !selectedStoryboards.has(id)));
                            setSelectedStoryboards(inverted);
                          }}
                          className="h-7 px-2 text-xs text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10"
                        >
                          反选
                        </Button>
                      </>
                    )}
                    
                    {/* 原始数量显示 */}
                    <span className="text-xs text-muted-foreground">{selectedNode.data.storyboard?.length || 0} 个</span>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const currentStoryboard = selectedNode.data.storyboard || [];
                        const newStoryboard = [...currentStoryboard, {
                          id: `sb_${Date.now()}`,
                          description: '新分镜',
                          duration: 3,
                          cameraAngle: 'medium',
                          prompt: '',
                        }];
                        onUpdateNode(selectedNode.id, { storyboard: newStoryboard });
                      }}
                      className="text-xs h-7 px-2 text-cyan-300 hover:text-cyan-300/80 hover:bg-cyan-400/10"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      添加
                    </Button>
                  </div>
                </div>
                
                {selectedNode.data.storyboard && selectedNode.data.storyboard.length > 0 ? (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {selectedNode.data.storyboard.map((sb, idx) => (
                      <div key={sb.id} className="bg-muted/80 p-3 rounded-md border border-border space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          {/* 复选框和序号 */}
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedStoryboards.has(sb.id)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedStoryboards);
                                if (e.target.checked) {
                                  newSelected.add(sb.id);
                                } else {
                                  newSelected.delete(sb.id);
                                }
                                setSelectedStoryboards(newSelected);
                              }}
                              className="w-4 h-4 rounded border-border bg-transparent text-cyan-300 focus:ring-cyan-300 focus:ring-offset-0 cursor-pointer"
                            />
                            <span className="text-sm font-bold text-foreground/90">#{idx + 1}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const newStoryboard = (selectedNode.data.storyboard || []).filter((_, i) => i !== idx);
                              onUpdateNode(selectedNode.id, { storyboard: newStoryboard });
                            }}
                            className="h-6 w-6 text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        
                        <div className="space-y-2.5">
                          {/* 场景信息 */}
                          {(sb.sceneName || sb.timeOfDay || sb.location) && (
                            <div className="bg-cyan-400/5 rounded-md p-2 border border-cyan-300/10">
                              <div className="flex items-center gap-2 text-[10px] text-cyan-200 mb-1">
                                <MapPin className="w-3 h-3" />
                                <span className="font-medium">
                                  {sb.sceneName && sb.sceneName}
                                  {sb.timeOfDay && `（${sb.timeOfDay}`}
                                  {sb.location && ` ${sb.location}）`}
                                </span>
                              </div>
                              {sb.shotType && (
                                <div className="text-[9px] text-muted-foreground">
                                  景别：{sb.shotType}
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div>
                            <label className="text-xs font-medium text-foreground/70 mb-1 block">分镜描述</label>
                            <textarea
                              value={sb.description}
                              onChange={(e) => {
                                const newStoryboard = (selectedNode.data.storyboard || []).map((s, i) => 
                                  i === idx ? { ...s, description: e.target.value } : s
                                );
                                onUpdateNode(selectedNode.id, { storyboard: newStoryboard });
                              }}
                              className="w-full min-h-[60px] bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30 resize-none"
                              placeholder="描述这个分镜的画面..."
                            />
                          </div>
                          
                          {/* 台词/旁白 */}
                          {(sb.dialogue || sb.narration || sb.os || sb.voiceover) && (
                            <div className="space-y-1.5">
                              {sb.dialogue && (
                                <div className="bg-cyan-400/5 rounded-md p-2 border border-cyan-300/10">
                                  <label className="text-[10px] font-medium text-cyan-200 mb-0.5 block">台词</label>
                                  <p className="text-[10px] text-foreground/80">{sb.dialogue}</p>
                                </div>
                              )}
                              {sb.narration && (
                                <div className="bg-cyan-400/5 rounded-md p-2 border border-cyan-300/10">
                                  <label className="text-[10px] font-medium text-cyan-200 mb-0.5 block">旁白</label>
                                  <p className="text-[10px] text-foreground/80">{sb.narration}</p>
                                </div>
                              )}
                              {sb.os && (
                                <div className="bg-cyan-400/5 rounded-md p-2 border border-cyan-300/10">
                                  <label className="text-[10px] font-medium text-cyan-200 mb-0.5 block">内心OS</label>
                                  <p className="text-[10px] text-foreground/80">{sb.os}</p>
                                </div>
                              )}
                              {sb.voiceover && (
                                <div className="bg-green-500/5 rounded-md p-2 border border-green-500/10">
                                  <label className="text-[10px] font-medium text-green-300 mb-0.5 block">画外音</label>
                                  <p className="text-[10px] text-foreground/80">{sb.voiceover}</p>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* 音效 */}
                          {sb.audio && (
                            <div className="bg-cyan-400/5 rounded-md p-2 border border-cyan-300/10">
                              <label className="text-[10px] font-medium text-cyan-200 mb-0.5 block">音效/环境音</label>
                              <p className="text-[10px] text-foreground/80">{sb.audio}</p>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs font-medium text-foreground/70 mb-1 block">时长(秒)</label>
                              <input
                                type="number"
                                value={sb.duration}
                                onChange={(e) => {
                                  const newStoryboard = (selectedNode.data.storyboard || []).map((s, i) => 
                                    i === idx ? { ...s, duration: parseInt(e.target.value) || 3 } : s
                                  );
                                  onUpdateNode(selectedNode.id, { storyboard: newStoryboard });
                                }}
                                className="w-full bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                                min="1"
                                max="30"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-foreground/70 mb-1 block">镜头角度</label>
                              <select
                                value={sb.cameraAngle || 'medium'}
                                onChange={(e) => {
                                  const newStoryboard = (selectedNode.data.storyboard || []).map((s, i) => 
                                    i === idx ? { ...s, cameraAngle: e.target.value } : s
                                  );
                                  onUpdateNode(selectedNode.id, { storyboard: newStoryboard });
                                }}
                                className="w-full bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                              >
                                <option value="wide">广角</option>
                                <option value="medium">中景</option>
                                <option value="close-up">特写</option>
                                <option value="over-shoulder">过肩</option>
                                <option value="low-angle">低角度</option>
                                <option value="high-angle">高角度</option>
                                <option value="bird-eye">鸟瞰</option>
                                <option value="multi-angle">多角度</option>
                              </select>
                            </div>
                          </div>
                          
                          <div>
                            <label className="text-xs font-medium text-foreground/70 mb-1 block">生成提示词 (可选)</label>
                            <textarea
                              value={sb.prompt || ''}
                              onChange={(e) => {
                                const newStoryboard = (selectedNode.data.storyboard || []).map((s, i) => 
                                  i === idx ? { ...s, prompt: e.target.value } : s
                                );
                                onUpdateNode(selectedNode.id, { storyboard: newStoryboard });
                              }}
                              className="w-full min-h-[40px] bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30 resize-none"
                              placeholder="如果需要特定风格或画面细节..."
                            />
                          </div>
                          
                          {/* 生成分镜图片按钮 */}
                          <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
                            {canWriteBackProductionAsset ? (
                              <Button
                                data-testid={`storyboard-shot-writeback-${sb.id}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => onSaveStoryboardShot(sb.id)}
                                disabled={canvasSaveInfo.status === 'saving'}
                                className="w-full h-7 border border-emerald-300/20 bg-emerald-400/10 text-xs text-emerald-100 hover:bg-emerald-300/20"
                              >
                                {canvasSaveInfo.status === 'saving' ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <Save className="w-3 h-3 mr-1" />
                                )}
                                写回镜头
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => generateSingleStoryboardImage(selectedNode.id, idx)}
                              disabled={isGenerating}
                              className="w-full text-xs text-cyan-300 hover:text-cyan-300/80 hover:bg-cyan-400/10 h-7"
                            >
                              {isGenerating ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <ImageIcon className="w-3 h-3 mr-1" />
                              )}
                              生成分镜 {idx + 1} 图片
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-foreground/40">
                    <LayoutGrid className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">暂无分镜</p>
                    <p className="text-xs mt-1">点击"添加"按钮创建第一个分镜</p>
                  </div>
                )}
                
                {selectedNode.data.storyboard && selectedNode.data.storyboard.length > 0 && (
                  <div className="pt-3 border-t border-border space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // 调用批量生成图片功能
                        batchGenerateStoryboardImages(selectedNode.id);
                      }}
                      disabled={isGenerating}
                      className="w-full text-sm text-cyan-300 hover:text-cyan-300/80 hover:bg-cyan-400/10"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ImageIcon className="w-4 h-4 mr-2" />
                      )}
                      {isGenerating ? '生成中...' : '一键批量生成分镜图片'}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // 调用批量生成视频功能
                        batchGenerateStoryboardVideos(selectedNode.id);
                      }}
                      disabled={isGenerating}
                      className="w-full text-sm text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Video className="w-4 h-4 mr-2" />
                      )}
                      {isGenerating ? '生成中...' : '一键生成所有视频'}
                    </Button>
                    
                    {/* 合成最终视频按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => composeFinalVideo()}
                      disabled={isGenerating}
                      className="w-full text-sm text-amber-300 hover:text-amber-200 hover:bg-amber-400/10"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      {isGenerating ? '合成中...' : '合成最终视频'}
                    </Button>
                  </div>
                )}
              </div>
            )}
            

    </>
  );
}
