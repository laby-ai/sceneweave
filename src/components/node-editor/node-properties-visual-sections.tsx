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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { getBgmTypeList } from '@/constants/bgm-types';
import type { NodePropertiesSectionProps } from './node-properties-types';

export function VisualPropertiesSections({
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
  return (
    <>
            {selectedNode.type === 'image' && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-foreground/80">图片设置</div>
                
                <div className="flex items-center justify-between bg-accent/50 rounded-lg p-2.5 border border-border/50">
                  <div className="flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5 text-green-500/70" />
                    <span className="text-xs text-foreground/70">启用素材上传</span>
                  </div>
                  <Switch checked={(selectedNode.data as any).materialUploadEnabled || false} onCheckedChange={(checked) => onUpdateNode(selectedNode.id, { materialUploadEnabled: checked } as any)} />
                </div>
                
                <div className="space-y-3">
                  {/* 摄像机提示 */}
                  <div className="bg-cyan-400/5 rounded-lg p-3 border border-cyan-300/10">
                    <div className="flex items-center gap-2 mb-1">
                      <Camera className="w-3.5 h-3.5 text-cyan-300" />
                      <span className="text-[11px] font-medium text-cyan-200">摄像机控制</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      将摄像机节点连接到本图片节点，生成视频时会自动应用摄像机参数
                    </p>
                  </div>
                  
                  {/* 生成的图片预览 */}
                  {selectedNode.data.generatedImage ? (
                    <div>
                      <label className="text-xs font-medium text-foreground/70 mb-1 block">生成的图片</label>
                      <div className="rounded-lg overflow-hidden border border-border">
                        <img
                          src={selectedNode.data.generatedImage}
                          alt="Generated"
                          className="w-full h-auto"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(selectedNode.data as any).materialUploadEnabled ? (
                        <div
                          className="flex items-center justify-center h-24 bg-muted rounded-lg border border-dashed border-cyan-300/30 cursor-pointer hover:border-cyan-300/50 hover:bg-secondary transition-colors"
                          onClick={() => { const el = document.getElementById('material-upload-input'); if (el) el.click(); }}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files; if (f.length > 0) { const file = f[0]; const r = new FileReader(); r.onload = (ev) => { onUpdateNode(selectedNode.id, { generatedImage: ev.target?.result as string, status: 'success' } as any); }; r.readAsDataURL(file); } }}
                        >
                          <div className="text-center">
                            <Upload className="w-5 h-5 text-green-500/60 mx-auto mb-1" />
                            <p className="text-[11px] text-foreground/40">点击或拖拽上传素材图片</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-24 bg-accent/50 rounded-lg border border-border border-dashed">
                          <p className="text-xs text-foreground/40">图片未生成（开启上传可使用本地素材）</p>
                        </div>
                      )}
                      <input id="material-upload-input" type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files && e.target.files.length > 0) { const file = e.target.files[0]; const r = new FileReader(); r.onload = (ev) => { onUpdateNode(selectedNode.id, { generatedImage: ev.target?.result as string, status: 'success' } as any); }; r.readAsDataURL(file); e.target.value = ''; } }} />
                    </div>
                  )}
                  
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1 block">提示词</label>
                    <textarea
                      value={selectedNode.data.prompt || ''}
                      onChange={(e) => onUpdateNode(selectedNode.id, { prompt: e.target.value })}
                      className="w-full min-h-[80px] bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30 resize-none"
                      placeholder="图片生成提示词..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-foreground/70 mb-1 block">视频时长(秒)</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={selectedNode.data.videoDuration || 5}
                        onChange={(e) => onUpdateNode(selectedNode.id, { videoDuration: parseInt(e.target.value) || 5 })}
                        className="w-full bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground/70 mb-1 block">视频风格</label>
                      <select
                        value={selectedNode.data.videoStyle || 'smooth'}
                        onChange={(e) => onUpdateNode(selectedNode.id, { videoStyle: e.target.value })}
                        className="w-full bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                      >
                        <option value="smooth">平滑过渡</option>
                        <option value="cinematic">电影感</option>
                        <option value="dynamic">动态效果</option>
                        <option value="static">静态视频</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* 重新生成图片按钮 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => regenerateImage(selectedNode.id)}
                    disabled={isGenerating}
                    className="w-full text-sm text-[#22c55e] hover:text-[#22c55e]/80 hover:bg-[#22c55e]/10"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    {isGenerating ? '重新生成中...' : '重新生成图片'}
                  </Button>
                  
                  {/* 生成视频按钮 */}
                  {selectedNode.data.generatedImage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => generateVideoFromImage(selectedNode.id)}
                      disabled={isGenerating}
                      className="w-full text-sm text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10 mt-2"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Video className="w-4 h-4 mr-2" />
                      )}
                      {isGenerating ? '生成中...' : '生成视频'}
                    </Button>
                  )}
                  
                  {/* 生成的视频预览 */}
                  {selectedNode.data.generatedVideo && (
                    <div className="pt-2">
                      <label className="text-xs font-medium text-foreground/70 mb-1 block">生成的视频</label>
                      <div className="rounded-lg overflow-hidden border border-border bg-card">
                        <video
                          src={selectedNode.data.generatedVideo}
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
                          onClick={() => window.open(selectedNode.data.generatedVideo, '_blank')}
                          className="text-[10px] text-muted-foreground hover:text-foreground/80 h-6"
                        >
                          在新窗口打开
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {selectedNode.type === 'agent' && (
              <div className="space-y-4">
                {/* 进度显示 */}
                {selectedNode.data.progress && (
                  <div className="bg-gradient-to-r from-cyan-400/10 to-sky-400/10 rounded-lg p-3 border border-cyan-300/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="w-4 h-4 text-cyan-300 animate-spin" />
                      <span className="text-xs font-medium text-cyan-300">转换中</span>
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
                  </div>
                )}
                
                {/* 完成状态显示 */}
                {!selectedNode.data.progress && selectedNode.data.status === 'success' && (
                  <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-xs font-medium text-green-500">
                        Agent六大模块转换完成！
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
                        {selectedNode.data.progress || '转换失败'}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* 转换成功后显示详细内容 */}
                {selectedNode.data.status === 'success' && (
                  <>
                    {/* 人物列表 */}
                    {selectedNode.data.assets?.characters?.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-cyan-200">
                          <User className="w-3.5 h-3.5" />
                          <span>人物列表 ({selectedNode.data.assets.characters.length}个)</span>
                        </div>
                        <div className="space-y-1.5">
                          {selectedNode.data.assets.characters.map((char: any, index: number) => (
                            <div key={index} className="bg-muted border border-cyan-300/20 rounded-md p-2">
                              <div className="text-xs font-semibold text-foreground">{char.name}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {char.age || ''} · {char.personality || ''}
                              </div>
                              {char.appearance && (
                                <div className="text-[9px] text-foreground/40 mt-1 line-clamp-2">
                                  {char.appearance}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 场景列表 */}
                    {selectedNode.data.assets?.scenes?.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-cyan-200">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>场景列表 ({selectedNode.data.assets.scenes.length}个)</span>
                        </div>
                        <div className="space-y-1.5">
                          {selectedNode.data.assets.scenes.map((scene: any, index: number) => (
                            <div key={index} className="bg-muted border border-cyan-300/20 rounded-md p-2">
                              <div className="text-xs font-semibold text-foreground">{scene.name}</div>
                              {scene.environment && (
                                <div className="text-[9px] text-foreground/40 mt-1 line-clamp-2">
                                  {scene.environment}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 镜头统计 */}
                    {selectedNode.data.shots?.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-cyan-200">
                          <Film className="w-3.5 h-3.5" />
                          <span>镜头统计</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-muted border border-cyan-300/20 rounded-md p-2 text-center">
                            <div className="text-lg font-bold text-cyan-300">{selectedNode.data.shots.length}</div>
                            <div className="text-[10px] text-muted-foreground">总镜头数</div>
                          </div>
                          {selectedNode.data.clips?.length > 0 && (
                            <div className="bg-muted border border-cyan-300/20 rounded-md p-2 text-center">
                              <div className="text-lg font-bold text-cyan-300">{selectedNode.data.clips.length}</div>
                              <div className="text-[10px] text-muted-foreground">Clip数量</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* 音频资产 */}
                    {selectedNode.data.audioAssets?.characters?.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-cyan-200">
                          <Mic className="w-3.5 h-3.5" />
                          <span>音频资产 ({selectedNode.data.audioAssets.characters.length}个)</span>
                        </div>
                        <div className="space-y-1.5">
                          {selectedNode.data.audioAssets.characters.map((audio: any, index: number) => (
                            <div key={index} className="bg-muted border border-cyan-300/20 rounded-md p-2">
                              <div className="text-xs font-semibold text-foreground">{audio.character}</div>
                              {audio.voiceDescription && (
                                <div className="text-[9px] text-foreground/40 mt-1 line-clamp-2">
                                  {audio.voiceDescription}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                <div>
                  <label className="text-sm font-medium text-foreground/80 mb-2 block">
                    目标单集时长（秒）
                  </label>
                  <input
                    type="number"
                    value={selectedNode.data.targetDuration || 120}
                    onChange={(e) => onUpdateNode(selectedNode.id, { targetDuration: Math.max(30, parseInt(e.target.value) || 120) })}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                    min="30"
                    placeholder="120"
                  />
                  <p className="text-xs text-foreground/40 mt-1">建议：短剧30-180秒，长视频600-1800秒</p>
                </div>
                
                {/* 转换结果预览 */}
                {selectedNode.data.result && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground/80">转换结果</label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(selectedNode.data.result);
                              alert('已复制到剪贴板！');
                            } catch {
                              alert('复制失败，请手动复制');
                            }
                          }}
                          className="text-xs h-7 px-2 text-foreground/70 hover:text-foreground"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          复制
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const blob = new Blob([selectedNode.data.result], { type: 'text/markdown' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Agent分镜_${new Date().toISOString().slice(0, 10)}.md`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="text-xs h-7 px-2 text-foreground/70 hover:text-foreground"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          下载
                        </Button>
                      </div>
                    </div>
                    
                    <div className="bg-muted border border-border rounded-lg p-3 max-h-[200px] overflow-auto">
                      <pre className="text-[10px] text-foreground/70 whitespace-pre-wrap font-mono leading-relaxed">
                        {selectedNode.data.result.substring(0, 1000)}
                        {selectedNode.data.result.length > 1000 && '...'}
                      </pre>
                    </div>
                  </div>
                )}
                
                {/* 六大模块说明 */}
                <div className="bg-cyan-400/10 rounded-lg p-3 border border-cyan-300/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-cyan-300" />
                    <span className="text-xs font-medium text-cyan-200">Agent六大模块</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground space-y-1">
                    <p>✓ 分场景Shot级镜头拆分</p>
                    <p>✓ 分镜计时表（全整数时长）</p>
                    <p>✓ 分镜组合Clip表（4-15秒）</p>
                    <p>✓ 角色设计标准化设定</p>
                    <p>✓ 道具/场景设计设定</p>
                    <p>✓ 音频资产设计</p>
                  </div>
                </div>
              </div>
            )}
            
            {selectedNode.type === 'camera' && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-foreground/80">摄像机设置</div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1 block">摄像机位置</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">X</label>
                        <input
                          type="number"
                          value={selectedNode.data.positionX || 0}
                          onChange={(e) => onUpdateNode(selectedNode.id, { positionX: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-muted border border-border rounded-md p-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">Y</label>
                        <input
                          type="number"
                          value={selectedNode.data.positionY || 0}
                          onChange={(e) => onUpdateNode(selectedNode.id, { positionY: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-muted border border-border rounded-md p-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">Z</label>
                        <input
                          type="number"
                          value={selectedNode.data.positionZ || 5}
                          onChange={(e) => onUpdateNode(selectedNode.id, { positionZ: parseFloat(e.target.value) || 5 })}
                          className="w-full bg-muted border border-border rounded-md p-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1 block">摄像机角度</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">俯仰 (Pitch)</label>
                        <input
                          type="range"
                          min="-90"
                          max="90"
                          value={selectedNode.data.pitch || 0}
                          onChange={(e) => onUpdateNode(selectedNode.id, { pitch: parseInt(e.target.value) || 0 })}
                          className="w-full"
                        />
                        <div className="text-[10px] text-foreground/40 text-center">{selectedNode.data.pitch || 0}°</div>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">偏航 (Yaw)</label>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          value={selectedNode.data.yaw || 0}
                          onChange={(e) => onUpdateNode(selectedNode.id, { yaw: parseInt(e.target.value) || 0 })}
                          className="w-full"
                        />
                        <div className="text-[10px] text-foreground/40 text-center">{selectedNode.data.yaw || 0}°</div>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">翻滚 (Roll)</label>
                        <input
                          type="range"
                          min="-45"
                          max="45"
                          value={selectedNode.data.roll || 0}
                          onChange={(e) => onUpdateNode(selectedNode.id, { roll: parseInt(e.target.value) || 0 })}
                          className="w-full"
                        />
                        <div className="text-[10px] text-foreground/40 text-center">{selectedNode.data.roll || 0}°</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1 block">镜头参数</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">焦距 (mm)</label>
                        <select
                          value={selectedNode.data.focalLength || 50}
                          onChange={(e) => onUpdateNode(selectedNode.id, { focalLength: parseInt(e.target.value) || 50 })}
                          className="w-full bg-muted border border-border rounded-md p-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                        >
                          <option value={24}>24mm (广角)</option>
                          <option value={35}>35mm (人文)</option>
                          <option value={50}>50mm (标准)</option>
                          <option value={85}>85mm (人像)</option>
                          <option value={135}>135mm (长焦)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">光圈 (f/)</label>
                        <select
                          value={selectedNode.data.aperture || 2.8}
                          onChange={(e) => onUpdateNode(selectedNode.id, { aperture: parseFloat(e.target.value) || 2.8 })}
                          className="w-full bg-muted border border-border rounded-md p-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                        >
                          <option value={1.4}>1.4</option>
                          <option value={2.0}>2.0</option>
                          <option value={2.8}>2.8</option>
                          <option value={4.0}>4.0</option>
                          <option value={5.6}>5.6</option>
                          <option value={8.0}>8.0</option>
                          <option value={11}>11</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-cyan-400/10 rounded-lg p-3 border border-cyan-300/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Camera className="w-4 h-4 text-cyan-300" />
                      <span className="text-xs font-medium text-cyan-200">可视化调整</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      摄像机设置已保存。在生成视频时，这些参数将控制摄像机的拍摄角度和镜头效果。
                    </p>
                  </div>
                </div>
              </div>
            )}
            

    </>
  );
}
