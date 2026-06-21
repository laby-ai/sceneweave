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
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  User,
  Users,
  Video,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { getBgmTypeList } from '@/constants/bgm-types';
import type { NodePropertiesSectionProps } from './node-properties-types';

type AudioEventContractView = {
  dialogueType?: unknown;
  lipSyncPolicy?: unknown;
  mustGenerateAudioTrack?: unknown;
  expectedAudioEvidence?: unknown;
  providerInstruction?: unknown;
};

function getAudioEventContract(data: Record<string, any>): AudioEventContractView | null {
  const direct = data.audioEventContract;
  const fromMetadata = data.metadata?.audioEventContract;
  const contract = direct || fromMetadata;
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) return null;
  return contract as AudioEventContractView;
}

function asCompactText(value: unknown, fallback = '未声明') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getAudioEvidencePreview(value: unknown) {
  if (!Array.isArray(value)) return '';
  return value
    .filter(item => typeof item === 'string' && item.trim())
    .slice(0, 2)
    .join(' / ');
}

export function MediaPropertiesSections({
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
  const audioEventContract = getAudioEventContract(selectedNode.data as Record<string, any>);
  const audioEvidencePreview = audioEventContract
    ? getAudioEvidencePreview(audioEventContract.expectedAudioEvidence)
    : '';

  return (
    <>
            {selectedNode.type === 'video' && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-foreground/80">视频设置</div>

                {/* 素材上传开关 */}
                <div className="flex items-center justify-between bg-accent/50 rounded-lg p-2.5 border border-border/50">
                  <div className="flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5 text-cyan-300/70" />
                    <span className="text-xs text-foreground/70">启用素材上传</span>
                  </div>
                  <Switch checked={(selectedNode.data as any).videoUploadEnabled || false} onCheckedChange={(checked) => onUpdateNode(selectedNode.id, { videoUploadEnabled: checked } as any)} />
                </div>
                
                <div className="space-y-3">
                  {/* 摄像机参数应用状态 */}
                  {selectedNode.data.cameraApplied && (
                    <div className="bg-cyan-400/10 rounded-lg p-3 border border-cyan-300/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Camera className="w-4 h-4 text-cyan-300" />
                        <span className="text-xs font-medium text-cyan-200">摄像机参数已应用</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">
                          位置: ({selectedNode.data.cameraPositionX || 0}, {selectedNode.data.cameraPositionY || 0}, {selectedNode.data.cameraPositionZ || 5})
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          角度: 俯仰 {selectedNode.data.cameraPitch || 0}° | 偏航 {selectedNode.data.cameraYaw || 0}° | 翻滚 {selectedNode.data.cameraRoll || 0}°
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          镜头: {selectedNode.data.cameraFocalLength || 50}mm | f/{selectedNode.data.cameraAperture || 2.8}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {isProductionVideoAsset && (
                    <div
                      data-testid="production-video-asset-detail"
                      className="rounded-lg border border-amber-300/20 bg-amber-400/10 p-3 text-xs text-amber-50"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="font-medium text-amber-100">
                          {selectedProductionKind === 'videoSegment'
                            ? '真实片段资产'
                            : selectedProductionKind === 'assemblySegment'
                              ? '片段任务'
                              : '真实成片资产'}
                        </span>
                        <span className="rounded-full border border-amber-200/20 px-2 py-0.5 text-[10px] text-amber-100/80">
                          {selectedProductionKind || 'production'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-amber-100/70">
                        {selectedNode.data.segmentIndex !== undefined && <span>片段: #{Number(selectedNode.data.segmentIndex) + 1}</span>}
                        {selectedNode.data.duration !== undefined && <span>时长: {String(selectedNode.data.duration)}s</span>}
                        {selectedNode.data.shotId && <span className="col-span-2 truncate">镜头: {selectedNode.data.shotId}</span>}
                        {selectedNode.data.providerTaskId && <span className="col-span-2 truncate">供应商任务: {selectedNode.data.providerTaskId}</span>}
                      </div>
                      {audioEventContract && (
                        <div
                          data-testid="production-audio-event-contract"
                          className="mt-3 rounded-md border border-sky-200/15 bg-sky-400/10 p-2 text-[11px] text-sky-50"
                        >
                          <div className="mb-1 flex items-center gap-1.5 font-medium text-sky-100">
                            <Mic className="h-3 w-3" />
                            声音事件合约
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-sky-100/70">
                            <span>对白: {asCompactText(audioEventContract.dialogueType)}</span>
                            <span>唇形: {asCompactText(audioEventContract.lipSyncPolicy)}</span>
                            <span className="col-span-2">
                              必须有声轨: {audioEventContract.mustGenerateAudioTrack ? '是' : '否'}
                            </span>
                            {audioEvidencePreview && (
                              <span className="col-span-2 truncate">证据: {audioEvidencePreview}</span>
                            )}
                            {typeof audioEventContract.providerInstruction === 'string' && audioEventContract.providerInstruction.trim() && (
                              <span className="col-span-2 line-clamp-2">
                                提示: {audioEventContract.providerInstruction.trim()}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedVideoUrl && (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 border border-amber-300/20 bg-amber-400/10 px-2 text-[11px] text-amber-100 hover:bg-amber-300/20"
                          >
                            <a href={selectedVideoUrl} target="_blank" rel="noreferrer">打开视频</a>
                          </Button>
                        )}
                        {selectedVideoTaskId && (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 border border-violet-300/20 bg-violet-400/10 px-2 text-[11px] text-violet-100 hover:bg-violet-300/20"
                          >
                            <a href={`/?section=tasks&taskId=${encodeURIComponent(String(selectedVideoTaskId))}`}>任务中心</a>
                          </Button>
                        )}
                        {selectedVideoCanExport && selectedVideoTaskId && (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 border border-emerald-300/20 bg-emerald-400/10 px-2 text-[11px] text-emerald-100 hover:bg-emerald-300/20"
                          >
                            <a
                              href={`/api/production/export?taskId=${encodeURIComponent(String(selectedVideoTaskId))}&format=cut-draft-json`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              导出草稿
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 生成的视频预览 */}
                  {selectedVideoUrl ? (
                    <div>
                      <label className="text-xs font-medium text-foreground/70 mb-1 block">生成的视频</label>
                      <div className="rounded-lg overflow-hidden border border-border bg-card">
                        <video
                          data-testid="production-video-preview"
                          src={selectedVideoUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full h-auto"
                        >
                          您的浏览器不支持视频播放。
                        </video>
                      </div>
                      {/* 备用下载链接 */}
                      <div className="mt-2 flex justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(selectedVideoUrl, '_blank')}
                          className="text-[10px] text-muted-foreground hover:text-foreground/80 h-6"
                        >
                          在新窗口打开
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(selectedNode.data as any).videoUploadEnabled ? (
                        <>
                          <div
                            className="flex items-center justify-center h-24 bg-muted rounded-lg border border-dashed border-cyan-300/30 cursor-pointer hover:border-cyan-300/50 hover:bg-secondary transition-colors"
                            onClick={() => { const el = document.getElementById('video-upload-input'); if (el) el.click(); }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files; if (f.length > 0) { const file = f[0]; const url = URL.createObjectURL(file); onUpdateNode(selectedNode.id, { generatedVideo: url, status: 'success' } as any); } }}
                          >
                            <div className="text-center">
                              <Upload className="w-5 h-5 text-cyan-300/60 mx-auto mb-1" />
                              <p className="text-[11px] text-foreground/40">点击或拖拽上传视频素材</p>
                              <p className="text-[10px] text-foreground/30">支持 MP4 / WebM / MOV</p>
                            </div>
                          </div>
                          <input id="video-upload-input" type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => { if (e.target.files && e.target.files.length > 0) { const file = e.target.files[0]; const url = URL.createObjectURL(file); onUpdateNode(selectedNode.id, { generatedVideo: url, status: 'success' } as any); e.target.value = ''; } }} />
                          {(selectedNode.data as any).generatedVideo && (
                            <Button variant="ghost" size="sm" onClick={() => onUpdateNode(selectedNode.id, { generatedVideo: null, status: 'idle' } as any)} className="w-full text-[11px] text-cyan-300/70 hover:text-cyan-300 hover:bg-cyan-400/10">清除已上传视频</Button>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-24 bg-accent/50 rounded-lg border border-border border-dashed">
                          <p className="text-xs text-foreground/40">视频未生成（开启上传可使用本地素材）</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1 block">提示词</label>
                    <textarea
                      value={selectedNode.data.prompt || ''}
                      onChange={(e) => onUpdateNode(selectedNode.id, { prompt: e.target.value })}
                      className="w-full min-h-[60px] bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30 resize-none"
                      placeholder="视频生成提示词..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-foreground/70 mb-1 block">时长(秒)</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={selectedNode.data.duration || 5}
                        onChange={(e) => onUpdateNode(selectedNode.id, { duration: parseInt(e.target.value) || 5 })}
                        className="w-full bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground/70 mb-1 block">分辨率</label>
                      <select
                        value={selectedNode.data.resolution || '720p'}
                        onChange={(e) => onUpdateNode(selectedNode.id, { resolution: e.target.value })}
                        className="w-full bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                      >
                        <option value="480p">480p</option>
                        <option value="720p">720p</option>
                        <option value="1080p">1080p</option>
                        <option value="4k">4K</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* 源图片 */}
                  {selectedNode.data.sourceImage && (
                    <div>
                      <label className="text-xs font-medium text-foreground/70 mb-1 block">源图片</label>
                      <div className="rounded-lg overflow-hidden border border-border">
                        <img
                          src={selectedNode.data.sourceImage}
                          alt="Source"
                          className="w-full h-auto"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* 重新生成视频按钮 */}
                  {!isProductionVideoAsset ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => regenerateVideoFromNode(selectedNode.id)}
                      disabled={isGenerating}
                      className="w-full text-sm text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10 mt-2"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Video className="w-4 h-4 mr-2" />
                      )}
                      {isGenerating ? '重新生成中...' : '重新生成视频'}
                    </Button>
                  ) : (
                    <div className="rounded-lg border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-[11px] text-cyan-100/75">
                      该节点来自制作项目资产，重新生成请从失败片段恢复或 assemblyPlan 队列进入，避免覆盖已完成片段。
                    </div>
                  )}
                  
                  {/* 字幕编辑区域 */}
                  <div className="border-t border-border pt-4 mt-4">
                    <div className="text-sm font-medium text-foreground/80 mb-3">字幕设置</div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-foreground/70 mb-1 block">字幕文本</label>
                        <textarea
                          value={selectedNode.data.subtitle || ''}
                          onChange={(e) => onUpdateNode(selectedNode.id, { subtitle: e.target.value })}
                          className="w-full min-h-[100px] bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30 resize-none"
                          placeholder="输入字幕文本，或点击自动生成字幕..."
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-xs text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          自动生成字幕
                        </Button>
                        {selectedNode.data.subtitleUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-green-500 hover:text-green-300 hover:bg-green-500/10"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            下载字幕
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* 音频关联区域 */}
                  <div className="border-t border-border pt-4 mt-4">
                    <div className="text-sm font-medium text-foreground/80 mb-3">音频关联</div>
                    
                    <div className="space-y-3">
                      {selectedNode.data.audioNodeId ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-foreground/70">已关联音频节点</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10"
                            >
                              <X className="w-3 h-3 mr-1" />
                              取消关联
                            </Button>
                          </div>
                          {selectedNode.data.audioUrl && (
                            <div className="rounded-lg overflow-hidden border border-border">
                              <audio 
                                src={selectedNode.data.audioUrl} 
                                controls 
                                className="w-full h-10 bg-muted"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground text-center py-4">
                          暂无关联音频
                        </div>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <Mic className="w-3 h-3 mr-1" />
                        自动生成配音
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {selectedNode.type === 'audio' && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-foreground/80">音频设置</div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1 block">音频类型</label>
                    <select
                      value={selectedNode.data.audioType || 'voiceover'}
                      onChange={(e) => onUpdateNode(selectedNode.id, { audioType: e.target.value })}
                      className="w-full bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-pink-500/30"
                    >
                      <option value="voiceover">旁白配音</option>
                      <option value="bgm">背景音乐</option>
                      <option value="soundEffect">音效</option>
                      <option value="dialogue">对话</option>
                    </select>
                  </div>
                  
                  {selectedNode.data.audioType === 'voiceover' && (
                    <div>
                      <label className="text-xs font-medium text-foreground/70 mb-1 block">配音文本</label>
                      <textarea
                        value={selectedNode.data.script || ''}
                        onChange={(e) => onUpdateNode(selectedNode.id, { script: e.target.value })}
                        className="w-full min-h-[80px] bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-pink-500/30 resize-none"
                        placeholder="输入需要配音的文本..."
                      />
                    </div>
                  )}
                  
                  {(selectedNode.data.audioType === 'voiceover' || selectedNode.data.audioType === 'dialogue') && (
                    <div>
                      <label className="text-xs font-medium text-foreground/70 mb-1 block">音色选择</label>
                      <select
                        value={selectedNode.data.voice || 'neutral'}
                        onChange={(e) => onUpdateNode(selectedNode.id, { voice: e.target.value })}
                        className="w-full bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-pink-500/30"
                      >
                        <option value="neutral">中性女声</option>
                        <option value="female">温柔女声</option>
                        <option value="male">沉稳男声</option>
                        <option value="young">年轻女声</option>
                        <option value="elder">成熟男声</option>
                      </select>
                    </div>
                  )}
                  
                  {selectedNode.data.audioType === 'bgm' && (
                    <div>
                      <label className="text-xs font-medium text-foreground/70 mb-1 block">音乐风格</label>
                      <select
                        value={selectedNode.data.musicStyle || 'ambient'}
                        onChange={(e) => onUpdateNode(selectedNode.id, { musicStyle: e.target.value })}
                        className="w-full bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-pink-500/30"
                      >
                        {getBgmTypeList().map(bgm => (
                          <option key={bgm.id} value={bgm.id}>{bgm.icon} {bgm.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1 block">音量</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedNode.data.volume || 80}
                      onChange={(e) => onUpdateNode(selectedNode.id, { volume: parseInt(e.target.value) || 80 })}
                      className="w-full"
                    />
                    <div className="text-[10px] text-foreground/40 text-right">{selectedNode.data.volume || 80}%</div>
                  </div>
                  
                  {(selectedNode.data.audioType === 'voiceover' || selectedNode.data.audioType === 'dialogue') && selectedNode.data.script && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => generateAudio(selectedNode.id)}
                      disabled={isGenerating}
                      className="w-full text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 mt-2"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Mic className="w-4 h-4 mr-2" />
                      )}
                      {isGenerating ? '生成中...' : '生成配音'}
                    </Button>
                  )}
                  
                  {/* 生成的音频预览 */}
                  {selectedNode.data.generatedAudio && (
                    <div className="pt-2">
                      <label className="text-xs font-medium text-foreground/70 mb-1 block">生成的音频</label>
                      <div className="rounded-lg overflow-hidden border border-border bg-accent/50 p-3">
                        <audio
                          src={selectedNode.data.generatedAudio}
                          controls
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            

    </>
  );
}
