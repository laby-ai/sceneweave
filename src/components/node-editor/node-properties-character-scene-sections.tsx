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

export function CharacterScenePropertiesSections({
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
            {selectedNode.type === 'character' && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-foreground/80">人物设置</div>
                
                <div className="space-y-3">
                  {/* 人物名称 */}
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1 block">人物名称</label>
                    <input
                      type="text"
                      value={selectedNode.data.characterName || ''}
                      onChange={(e) => onUpdateNode(selectedNode.id, { characterName: e.target.value })}
                      className="w-full bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                      placeholder="输入人物名称..."
                    />
                  </div>
                  
                  {/* 年龄 */}
                  {selectedNode.data.characterAge && (
                    <div className="bg-cyan-400/5 rounded-lg p-2 border border-cyan-300/10">
                      <label className="text-[10px] font-medium text-cyan-200 mb-1 block">年龄</label>
                      <p className="text-xs text-foreground/80">{selectedNode.data.characterAge}</p>
                    </div>
                  )}
                  
                  {/* 性格 */}
                  {selectedNode.data.characterPersonality && (
                    <div className="bg-cyan-400/5 rounded-lg p-2 border border-cyan-300/10">
                      <label className="text-[10px] font-medium text-cyan-200 mb-1 block">性格</label>
                      <p className="text-xs text-foreground/80">{selectedNode.data.characterPersonality}</p>
                    </div>
                  )}
                  
                  {/* 人物描述 */}
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1 block">人物描述</label>
                    <textarea
                      value={selectedNode.data.characterDescription || ''}
                      onChange={(e) => onUpdateNode(selectedNode.id, { characterDescription: e.target.value })}
                      className="w-full min-h-[80px] bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30 resize-none"
                      placeholder="详细描述人物的外貌、穿着、性格等特征..."
                    />
                  </div>
                  
                  {/* 画风 */}
                  {selectedNode.data.characterArtStyle && (
                    <div className="bg-cyan-400/5 rounded-lg p-2 border border-cyan-300/10">
                      <label className="text-[10px] font-medium text-cyan-200 mb-1 block">统一画风</label>
                      <p className="text-xs text-foreground/80">{selectedNode.data.characterArtStyle}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1 block">人物形象图片</label>
                    {selectedNode.data.characterImage ? (
                      <div>
                        <div className="rounded-lg overflow-hidden border border-border mb-2">
                          <img
                            src={selectedNode.data.characterImage}
                            alt="Character"
                            className="w-full h-auto"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            // 生成人物照片
                            try {
                              onUpdateNode(selectedNode.id, { status: 'loading' });
                              
                              // 构建人物照片提示词
                              const characterName = selectedNode.data.characterName || '人物';
                              const characterDescription = selectedNode.data.characterDescription || '';
                              const characterAge = selectedNode.data.characterAge || '';
                              const characterPersonality = selectedNode.data.characterPersonality || '';
                              const characterArtStyle = selectedNode.data.characterArtStyle || '高清写实风格';
                              
                              const prompt = `人物照片，${characterName}，${characterDescription}${characterAge ? `，年龄${characterAge}` : ''}${characterPersonality ? `，性格${characterPersonality}` : ''}，${characterArtStyle}，适配竖屏9:16构图，高清画质，自然光线，构图平衡，专业人像摄影`;
                              
                              console.log('[Character Image] 生成人物照片，提示词:', prompt);
                              
                              const response = await fetch('/api/image/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ prompt, size: '2K' })
                              });
                              
                              if (response.ok) {
                                const data = await response.json();
                                const imageUrl = data.imageUrls?.[0] || data.imageUrl;
                                
                                if (imageUrl) {
                                  onUpdateNode(selectedNode.id, { 
                                    characterImage: imageUrl, 
                                    status: 'success' 
                                  });
                                  console.log('[Character Image] 人物照片生成完成:', imageUrl);
                                } else {
                                  throw new Error('未返回图片URL');
                                }
                              } else {
                                throw new Error(`API请求失败: ${response.status}`);
                              }
                            } catch (error) {
                              console.error('[Character Image] 生成人物照片失败:', error);
                              onUpdateNode(selectedNode.id, { status: 'error' });
                              alert('生成人物照片失败，请重试');
                            }
                          }}
                          className="w-full text-[11px] text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10"
                        >
                          重新AI生成人物形象
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[11px] text-muted-foreground mb-1 block">或上传参考图片（支持多张）</label>
                          <div
                            className="flex items-center justify-center h-20 bg-muted rounded-lg border border-dashed border-cyan-300/30 cursor-pointer hover:border-cyan-300/50 hover:bg-secondary transition-colors"
                            onClick={() => { const el = document.getElementById('char-upload-input'); if (el) el.click(); }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files.length > 0) handleCharacterUpload(e.dataTransfer.files); }}
                          >
                            <div className="text-center">
                              <Upload className="w-5 h-5 text-cyan-300/60 mx-auto mb-1" />
                              <p className="text-[11px] text-foreground/40">点击或拖拽上传图片</p>
                            </div>
                          </div>
                          <input id="char-upload-input" type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files && e.target.files.length > 0) { handleCharacterUpload(e.target.files); e.target.value = ''; } }} />
                        </div>
                        {(selectedNode.data as any).characterUploads && (selectedNode.data as any).characterUploads.length > 0 && (
                          <div className="grid grid-cols-3 gap-1.5">
                            {(selectedNode.data as any).characterUploads.map((img: string, idx: number) => (
                              <div key={idx} className="relative group rounded overflow-hidden border border-border">
                                <img src={img} alt={`上传${idx + 1}`} className="w-full h-16 object-cover" />
                                <button className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-slate-700/90 text-foreground text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeCharacterUpload(idx)}>{'\u00d7'}</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            // 生成人物照片
                            try {
                              onUpdateNode(selectedNode.id, { status: 'loading' });
                              
                              // 构建人物照片提示词
                              const characterName = selectedNode.data.characterName || '人物';
                              const characterDescription = selectedNode.data.characterDescription || '';
                              const characterAge = selectedNode.data.characterAge || '';
                              const characterPersonality = selectedNode.data.characterPersonality || '';
                              const characterArtStyle = selectedNode.data.characterArtStyle || '高清写实风格';
                              
                              const prompt = `人物照片，${characterName}，${characterDescription}${characterAge ? `，年龄${characterAge}` : ''}${characterPersonality ? `，性格${characterPersonality}` : ''}，${characterArtStyle}，适配竖屏9:16构图，高清画质，自然光线，构图平衡，专业人像摄影`;
                              
                              console.log('[Character Image] 生成人物照片，提示词:', prompt);
                              
                              const response = await fetch('/api/image/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ prompt, size: '2K' })
                              });
                              
                              if (response.ok) {
                                const data = await response.json();
                                const imageUrl = data.imageUrls?.[0] || data.imageUrl;
                                
                                if (imageUrl) {
                                  onUpdateNode(selectedNode.id, { 
                                    characterImage: imageUrl, 
                                    status: 'success' 
                                  });
                                  console.log('[Character Image] 人物照片生成完成:', imageUrl);
                                } else {
                                  throw new Error('未返回图片URL');
                                }
                              } else {
                                throw new Error(`API请求失败: ${response.status}`);
                              }
                            } catch (error) {
                              console.error('[Character Image] 生成人物照片失败:', error);
                              onUpdateNode(selectedNode.id, { status: 'error' });
                              alert('生成人物照片失败，请重试');
                            }
                          }}
                          className="w-full text-[11px] text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10"
                        >
                          <Users className="w-3.5 h-3.5 mr-1.5" />
                          生成人物形象
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-cyan-400/10 rounded-lg p-3 border border-cyan-300/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-cyan-300" />
                      <span className="text-xs font-medium text-cyan-200">人物一致性</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      生成包含此人物的图片和视频时，会自动使用这里设置的人物描述和形象，确保人物在整个项目中保持一致性。
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {selectedNode.type === 'scene' && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-foreground/80">场景设置</div>
                
                <div className="space-y-3">
                  {/* 场景名称 */}
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1 block">场景名称</label>
                    <input
                      type="text"
                      value={selectedNode.data.sceneName || ''}
                      onChange={(e) => onUpdateNode(selectedNode.id, { sceneName: e.target.value })}
                      className="w-full bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                      placeholder="输入场景名称..."
                    />
                  </div>
                  
                  {/* 从Agent数据中提取的详细信息 */}
                  {selectedNode.data.sceneEnvironment && (
                    <div className="bg-cyan-400/5 rounded-lg p-2 border border-cyan-300/10">
                      <label className="text-[10px] font-medium text-cyan-200 mb-1 block">环境细节</label>
                      <p className="text-xs text-foreground/80">{selectedNode.data.sceneEnvironment}</p>
                    </div>
                  )}
                  
                  {selectedNode.data.sceneLighting && (
                    <div className="bg-cyan-400/5 rounded-lg p-2 border border-cyan-300/10">
                      <label className="text-[10px] font-medium text-cyan-200 mb-1 block">光影与色调</label>
                      <p className="text-xs text-foreground/80">{selectedNode.data.sceneLighting}</p>
                    </div>
                  )}
                  
                  {selectedNode.data.sceneAtmosphere && (
                    <div className="bg-cyan-400/5 rounded-lg p-2 border border-cyan-300/10">
                      <label className="text-[10px] font-medium text-cyan-200 mb-1 block">氛围设定</label>
                      <p className="text-xs text-foreground/80">{selectedNode.data.sceneAtmosphere}</p>
                    </div>
                  )}
                  
                  {/* 场景描述 */}
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1 block">场景描述</label>
                    <textarea
                      value={selectedNode.data.sceneDescription || ''}
                      onChange={(e) => onUpdateNode(selectedNode.id, { sceneDescription: e.target.value })}
                      className="w-full min-h-[80px] bg-muted border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/30 resize-none"
                      placeholder="详细描述场景的环境、氛围、时间、地点等特征..."
                    />
                  </div>
                  
                  {/* 画风 */}
                  {selectedNode.data.sceneArtStyle && (
                    <div className="bg-cyan-400/5 rounded-lg p-2 border border-cyan-300/10">
                      <label className="text-[10px] font-medium text-cyan-200 mb-1 block">统一画风</label>
                      <p className="text-xs text-foreground/80">{selectedNode.data.sceneArtStyle}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1 block">场景图片</label>
                    {selectedNode.data.sceneImage ? (
                      <div>
                        <div className="rounded-lg overflow-hidden border border-border mb-2">
                          <img
                            src={selectedNode.data.sceneImage}
                            alt="Scene"
                            className="w-full h-auto"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            // 生成场景照片
                            try {
                              onUpdateNode(selectedNode.id, { status: 'loading' });
                              
                              // 构建场景照片提示词
                              const sceneName = selectedNode.data.sceneName || '场景';
                              const sceneDescription = selectedNode.data.sceneDescription || '';
                              const sceneArtStyle = selectedNode.data.sceneArtStyle || '高清写实风格';
                              
                              const prompt = `场景照片，${sceneName}，${sceneDescription}，${sceneArtStyle}，高清画质，自然光线，构图平衡，专业风光摄影，清晰细节`;
                              
                              console.log('[Scene Image] 生成场景照片，提示词:', prompt);
                              
                              const response = await fetch('/api/image/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ prompt, size: '2K' })
                              });
                              
                              if (response.ok) {
                                const data = await response.json();
                                const imageUrl = data.imageUrls?.[0] || data.imageUrl;
                                
                                if (imageUrl) {
                                  onUpdateNode(selectedNode.id, { 
                                    sceneImage: imageUrl, 
                                    status: 'success' 
                                  });
                                  console.log('[Scene Image] 场景照片生成完成:', imageUrl);
                                } else {
                                  throw new Error('未返回图片URL');
                                }
                              } else {
                                throw new Error(`API请求失败: ${response.status}`);
                              }
                            } catch (error) {
                              console.error('[Scene Image] 生成场景照片失败:', error);
                              onUpdateNode(selectedNode.id, { status: 'error' });
                              alert('生成场景照片失败，请重试');
                            }
                          }}
                          className="w-full text-[11px] text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10"
                        >
                          重新AI生成场景图片
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[11px] text-muted-foreground mb-1 block">或上传参考图片（支持多张）</label>
                          <div
                            className="flex items-center justify-center h-20 bg-muted rounded-lg border border-dashed border-cyan-300/30 cursor-pointer hover:border-cyan-300/50 hover:bg-secondary transition-colors"
                            onClick={() => { const el = document.getElementById('scene-upload-input'); if (el) el.click(); }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files.length > 0) handleSceneUpload(e.dataTransfer.files); }}
                          >
                            <div className="text-center">
                              <Upload className="w-5 h-5 text-cyan-300/60 mx-auto mb-1" />
                              <p className="text-[11px] text-foreground/40">点击或拖拽上传图片</p>
                            </div>
                          </div>
                          <input id="scene-upload-input" type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files && e.target.files.length > 0) { handleSceneUpload(e.target.files); e.target.value = ''; } }} />
                        </div>
                        {(selectedNode.data as any).sceneUploads && (selectedNode.data as any).sceneUploads.length > 0 && (
                          <div className="grid grid-cols-3 gap-1.5">
                            {(selectedNode.data as any).sceneUploads.map((img: string, idx: number) => (
                              <div key={idx} className="relative group rounded overflow-hidden border border-border">
                                <img src={img} alt={`上传${idx + 1}`} className="w-full h-16 object-cover" />
                                <button className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-slate-700/90 text-foreground text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeSceneUpload(idx)}>{'\u00d7'}</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            // 生成场景照片
                            try {
                              onUpdateNode(selectedNode.id, { status: 'loading' });
                              
                              // 构建场景照片提示词
                              const sceneName = selectedNode.data.sceneName || '场景';
                              const sceneDescription = selectedNode.data.sceneDescription || '';
                              const sceneArtStyle = selectedNode.data.sceneArtStyle || '高清写实风格';
                              
                              const prompt = `场景照片，${sceneName}，${sceneDescription}，${sceneArtStyle}，高清画质，自然光线，构图平衡，专业风光摄影，清晰细节`;
                              
                              console.log('[Scene Image] 生成场景照片，提示词:', prompt);
                              
                              const response = await fetch('/api/image/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ prompt, size: '2K' })
                              });
                              
                              if (response.ok) {
                                const data = await response.json();
                                const imageUrl = data.imageUrls?.[0] || data.imageUrl;
                                
                                if (imageUrl) {
                                  onUpdateNode(selectedNode.id, { 
                                    sceneImage: imageUrl, 
                                    status: 'success' 
                                  });
                                  console.log('[Scene Image] 场景照片生成完成:', imageUrl);
                                } else {
                                  throw new Error('未返回图片URL');
                                }
                              } else {
                                throw new Error(`API请求失败: ${response.status}`);
                              }
                            } catch (error) {
                              console.error('[Scene Image] 生成场景照片失败:', error);
                              onUpdateNode(selectedNode.id, { status: 'error' });
                              alert('生成场景照片失败，请重试');
                            }
                          }}
                          className="w-full text-[11px] text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10"
                        >
                          <Map className="w-3.5 h-3.5 mr-1.5" />
                          生成场景图片
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-cyan-400/10 rounded-lg p-3 border border-cyan-300/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Map className="w-4 h-4 text-cyan-300" />
                      <span className="text-xs font-medium text-cyan-200">场景一致性</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      生成同一场景的多个分镜时，会自动使用这里设置的场景描述和图片，确保场景在整个项目中保持一致性。
                    </p>
                  </div>
                </div>
              </div>
            )}
            

    </>
  );
}
