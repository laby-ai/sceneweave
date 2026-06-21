'use client';

import { useRouter } from 'next/navigation';
import {
  Clock,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  Film,
  GitBranch,
  Globe,
  Heart,
  Image as ImageIcon,
  Music,
  Video,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageGenerationForm } from '@/components/image-generation-form';
import { ImagePreview } from '@/components/image-preview';
import { XiaohongshuGeneration } from '@/components/xiaohongshu-generation';
import { WechatGeneration } from '@/components/wechat-generation';
import { DouyinGeneration } from '@/components/douyin-generation';
import { PosterGeneration } from '@/components/home/poster-generation';
import { CopywritingGeneration } from '@/components/home/copywriting-generation';

export type MediaSubSection = 'select' | 'assets' | 'image' | 'poster' | 'copywriting' | 'xiaohongshu' | 'wechat' | 'douyin';

export function DreamboxMediaSection({
  activeSection,
  mediaSubSection,
  setMediaSubSection,
  setActiveSection,
  finalVideoCaseAssets,
  segmentCaseAssets,
  productionCaseAssets,
  setPendingPrompt,
  setShouldAutoGenerate,
  setCurrentImages,
  setCurrentCopywriting,
  setShowCopywritingDialog,
  isGeneratingImage,
  setIsGeneratingImage,
  handlePromptEnhanced,
  editingImagePrompt,
  imageInitialConfig,
  currentImages,
  handleRemixImage,
  handleEditImage,
  handleRegenerateImage,
  handlePosterGenerated,
  handleCopywritingGenerated,
}: {
  activeSection: string;
  mediaSubSection: MediaSubSection;
  setMediaSubSection: (section: MediaSubSection) => void;
  setActiveSection: (section: string) => void;
  finalVideoCaseAssets: any[];
  segmentCaseAssets: any[];
  productionCaseAssets: any[];
  setPendingPrompt: (prompt: string | undefined) => void;
  setShouldAutoGenerate: (value: boolean) => void;
  setCurrentImages: (value: any) => void;
  setCurrentCopywriting: (value: any) => void;
  setShowCopywritingDialog: (value: boolean) => void;
  isGeneratingImage: boolean;
  setIsGeneratingImage: (value: boolean) => void;
  handlePromptEnhanced: (originalPrompt: string, enhancedPrompt: string) => void;
  editingImagePrompt: string | null;
  imageInitialConfig: any;
  currentImages: any;
  handleRemixImage: (image: any) => void;
  handleEditImage: (image?: any) => void;
  handleRegenerateImage: (imageOrPrompt: any) => void;
  handlePosterGenerated: (imageData: any) => void;
  handleCopywritingGenerated: (prompt: string, variations: string[]) => void;
}) {
  const router = useRouter();
  return (
    <>
          {/* 图文生成 */}
          {activeSection === 'media' && (
            <>
              {/* 选择弹框 */}
              {mediaSubSection === 'select' && (
                <Dialog open={mediaSubSection === 'select'} onOpenChange={(open) => !open && setActiveSection('home')}>
                  <DialogContent className="sm:max-w-6xl max-h-[85vh] overflow-y-auto border-white/10 bg-[#070a12] text-white shadow-2xl shadow-black/60">
                    <DialogHeader>
                      <DialogTitle className="text-2xl text-white">图文与素材</DialogTitle>
                      <DialogDescription className="text-white/55">
                        图片、海报、文案和平台内容都从这里进入，生成结果会继续回流到视频、影视和工作流画布。
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 py-6">
                      {/* 真实制作资产 */}
                      <div
                        onClick={() => setMediaSubSection('assets')}
                        className="group relative min-h-[152px] overflow-hidden rounded-2xl p-4 cursor-pointer transform hover:-translate-y-0.5 transition-all duration-300 border border-white/10 hover:border-[#70E0FF]/50 bg-[#0b0f18]"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-[#0891B2]/60 via-[#1E3A8A]/35 to-[#05070d] opacity-90" />
                        <div className="relative z-10 text-center">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center transform group-hover:scale-110 transition-transform">
                            <Film className="w-6 h-6 text-[#70E0FF]" />
                          </div>
                          <h3 className="text-lg font-bold text-white mb-1">
                            真实制作资产
                          </h3>
                          <p className="text-white/62 text-xs leading-5">
                            成片、片段和真实任务产物沉淀
                          </p>
                        </div>
                      </div>

                      {/* 图片生成 */}
                      <div
                        onClick={() => setMediaSubSection('image')}
                        className="group relative min-h-[152px] overflow-hidden rounded-2xl p-4 cursor-pointer transform hover:-translate-y-0.5 transition-all duration-300 border border-white/10 hover:border-[#70E0FF]/50 bg-[#0b0f18]"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-[#0E7490]/70 via-[#1D4ED8]/35 to-[#111827] opacity-90" />
                        <div className="relative z-10 text-center">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center transform group-hover:scale-110 transition-transform">
                            <ImageIcon className="w-6 h-6 text-[#70E0FF]" />
                          </div>
                          <h3 className="text-lg font-bold text-white mb-1">
                            图片生成
                          </h3>
                          <p className="text-white/62 text-xs leading-5">
                            文生图、参考图和角色/场景视觉参考
                          </p>
                        </div>
                      </div>

                      {/* 海报生成 */}
                      <div
                        onClick={() => setMediaSubSection('poster')}
                        className="group relative min-h-[152px] overflow-hidden rounded-2xl p-4 cursor-pointer transform hover:-translate-y-0.5 transition-all duration-300 border border-white/10 hover:border-[#70E0FF]/50 bg-[#0b0f18]"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-[#2563EB]/60 via-[#4F46E5]/30 to-[#111827] opacity-90" />
                        <div className="relative z-10 text-center">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center transform group-hover:scale-110 transition-transform">
                            <FileCode className="w-6 h-6 text-[#70E0FF]" />
                          </div>
                          <h3 className="text-lg font-bold text-white mb-1">
                            海报生成
                          </h3>
                          <p className="text-white/62 text-xs leading-5">
                            从视频或主题提炼成可发布海报
                          </p>
                        </div>
                      </div>

                      {/* 文案生成 */}
                      <div
                        onClick={() => setMediaSubSection('copywriting')}
                        className="group relative min-h-[152px] overflow-hidden rounded-2xl p-4 cursor-pointer transform hover:-translate-y-0.5 transition-all duration-300 border border-white/10 hover:border-[#70E0FF]/50 bg-[#0b0f18]"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-[#7C3AED]/55 via-[#2563EB]/25 to-[#111827] opacity-90" />
                        <div className="relative z-10 text-center">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center transform group-hover:scale-110 transition-transform">
                            <FileText className="w-6 h-6 text-[#70E0FF]" />
                          </div>
                          <h3 className="text-lg font-bold text-white mb-1">
                            文案生成
                          </h3>
                          <p className="text-white/62 text-xs leading-5">
                            标题、脚本和多平台文案改写
                          </p>
                        </div>
                      </div>

                      {/* 小红书图文 */}
                      <div
                        onClick={() => setMediaSubSection('xiaohongshu')}
                        className="group relative min-h-[152px] overflow-hidden rounded-2xl p-4 cursor-pointer transform hover:-translate-y-0.5 transition-all duration-300 border border-white/10 hover:border-[#70E0FF]/50 bg-[#0b0f18]"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-[#7C3AED]/55 via-[#0891B2]/25 to-[#111827] opacity-90" />
                        <div className="relative z-10 text-center">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center transform group-hover:scale-110 transition-transform">
                            <Heart className="w-6 h-6 text-[#70E0FF]" />
                          </div>
                          <h3 className="text-lg font-bold text-white mb-1">
                            小红书图文
                          </h3>
                          <p className="text-white/62 text-xs leading-5">
                            封面、正文、标签和种草表达
                          </p>
                        </div>
                      </div>

                      {/* 公众号推送 */}
                      <div
                        onClick={() => setMediaSubSection('wechat')}
                        className="group relative min-h-[152px] overflow-hidden rounded-2xl p-4 cursor-pointer transform hover:-translate-y-0.5 transition-all duration-300 border border-white/10 hover:border-[#70E0FF]/50 bg-[#0b0f18]"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-[#059669]/50 via-[#0E7490]/30 to-[#111827] opacity-90" />
                        <div className="relative z-10 text-center">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center transform group-hover:scale-110 transition-transform">
                            <Globe className="w-6 h-6 text-[#70E0FF]" />
                          </div>
                          <h3 className="text-lg font-bold text-white mb-1">
                            公众号·视频号
                          </h3>
                          <p className="text-white/62 text-xs leading-5">
                            长图文、摘要、封面和视频号内容
                          </p>
                        </div>
                      </div>

                      {/* 抖音短视频 */}
                      <div
                        onClick={() => setMediaSubSection('douyin')}
                        className="group relative min-h-[152px] overflow-hidden rounded-2xl p-4 cursor-pointer transform hover:-translate-y-0.5 transition-all duration-300 border border-white/10 hover:border-[#70E0FF]/50 bg-[#0b0f18]"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-[#0F766E]/50 via-[#4F46E5]/30 to-[#111827] opacity-90" />
                        <div className="relative z-10 text-center">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center transform group-hover:scale-110 transition-transform">
                            <Music className="w-6 h-6 text-[#70E0FF]" />
                          </div>
                          <h3 className="text-lg font-bold text-white mb-1">
                            抖音短视频
                          </h3>
                          <p className="text-white/62 text-xs leading-5">
                            短视频脚本、口播结构和封面方向
                          </p>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {/* 真实制作资产 */}
              {mediaSubSection === 'assets' && (
                <>
                  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h1 className="text-3xl font-bold text-foreground mb-2">
                        真实制作资产
                      </h1>
                      <p className="text-muted-foreground">
                        从真实任务回写的最终成片和视频片段，可进入任务中心回看，也可继续复用到视频生成。
                      </p>
                      <button
                        onClick={() => {
                          setMediaSubSection('select');
                        }}
                        className="mt-4 text-sm text-[#70E0FF] hover:opacity-80 transition-opacity"
                      >
                        ← 返回图文与素材
                      </button>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
                      {finalVideoCaseAssets.length} 个最终成片 · {segmentCaseAssets.length} 个视频片段
                    </div>
                  </div>

                  {productionCaseAssets.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-white/60">
                      暂无真实制作资产。完成一次分段视频任务后，成片和片段会自动沉淀到这里。
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <section>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h2 className="text-lg font-semibold text-white">最终成片</h2>
                          <span className="text-xs text-white/45">优先用于首页案例、交付预览和导出入口</span>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {finalVideoCaseAssets.map(asset => (
                            <div key={asset.id} className="overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#08111c]">
                              <div className="relative aspect-video bg-black">
                                <video
                                  src={asset.videoUrl}
                                  poster={asset.posterUrl}
                                  controls
                                  preload="metadata"
                                  className="h-full w-full object-cover"
                                />
                                <span className="absolute left-3 top-3 rounded-md bg-cyan-300/15 px-2 py-1 text-[11px] font-medium text-cyan-50 backdrop-blur">
                                  真实成片资产
                                </span>
                                <span className="absolute bottom-3 right-3 rounded bg-black/60 px-2 py-1 text-[11px] text-white/80">
                                  {asset.durationLabel}
                                </span>
                              </div>
                              <div className="space-y-3 p-4">
                                <div>
                                  <h3 className="line-clamp-1 text-sm font-semibold text-white">{asset.title}</h3>
                                  <p className="mt-1 line-clamp-1 text-xs text-white/50">{asset.projectTitle}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => window.open(asset.videoUrl, '_blank')}
                                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs text-cyan-50 hover:bg-cyan-300/15"
                                  >
                                    <ExternalLink className="h-3 w-3" /> 打开
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveSection('tasks');
                                      setMediaSubSection('select');
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/72 hover:bg-white/[0.1]"
                                  >
                                    <Clock className="h-3 w-3" /> 来源任务
                                  </button>
                                  <button
                                    onClick={() => {
                                      setPendingPrompt(asset.title);
                                      setActiveSection('video');
                                      setShouldAutoGenerate(false);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/72 hover:bg-white/[0.1]"
                                  >
                                    <Video className="h-3 w-3" /> 复用到视频
                                  </button>
                                  <button
                                    onClick={() => router.push(`/node-editor?taskId=${encodeURIComponent(asset.taskId)}`)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/72 hover:bg-white/[0.1]"
                                  >
                                    <GitBranch className="h-3 w-3" /> 进入画布
                                  </button>
                                  <button
                                    onClick={() => window.open(`/api/production/export?taskId=${encodeURIComponent(asset.taskId)}&format=cut-draft-json`, '_blank')}
                                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-50 hover:bg-amber-300/15"
                                  >
                                    <Download className="h-3 w-3" /> 导出草稿
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h2 className="text-lg font-semibold text-white">视频片段</h2>
                          <span className="text-xs text-white/45">用于检查镜头、重试合成和继续剪辑</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {segmentCaseAssets.map(asset => (
                            <button
                              key={asset.id}
                              onClick={() => {
                                setActiveSection('tasks');
                                setMediaSubSection('select');
                              }}
                              className="group overflow-hidden rounded-xl border border-emerald-300/15 bg-[#08140f] text-left transition-colors hover:border-emerald-300/35 hover:bg-emerald-300/10"
                            >
                              <div className="relative aspect-video bg-black">
                                <video
                                  src={asset.videoUrl}
                                  poster={asset.posterUrl}
                                  muted
                                  loop
                                  playsInline
                                  preload="metadata"
                                  className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
                                />
                                <span className="absolute left-2 top-2 rounded bg-emerald-300/15 px-2 py-1 text-[10px] text-emerald-50">
                                  真实片段资产
                                </span>
                                <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/75">
                                  {asset.durationLabel}
                                </span>
                              </div>
                              <div className="p-3">
                                <p className="line-clamp-1 text-xs font-medium text-white">{asset.title}</p>
                                <p className="mt-1 line-clamp-1 text-[11px] text-white/45">{asset.projectTitle}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
                    </div>
                  )}
                </>
              )}

              {/* 图片生成 */}
              {mediaSubSection === 'image' && (
                <>
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                      图片生成
                    </h1>
                    <p className="text-muted-foreground">
                      快速创建精美的图片作品
                    </p>
                    <button
                      onClick={() => {
                        setMediaSubSection('select');
                      }}
                      className="mt-4 text-sm text-[#70E0FF] hover:opacity-80 transition-opacity"
                    >
                      ← 返回图文与素材
                    </button>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <div className="transform hover:scale-[1.01] transition-transform">
                        <ImageGenerationForm
                          onGenerate={(config) => {
                            // 跳转到图片生成工作区并自动生成
                            setPendingPrompt(config.prompt || '');
                            setShouldAutoGenerate(true);
                            setActiveSection('image');
                          }}
                          isGenerating={isGeneratingImage}
                          onGeneratingChange={setIsGeneratingImage}
                          onPromptEnhanced={handlePromptEnhanced}
                          initialPrompt={editingImagePrompt || ''}
                          initialConfig={imageInitialConfig || undefined}
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="transform hover:scale-[1.01] transition-transform">
                        <ImagePreview
                          images={currentImages}
                          isGenerating={isGeneratingImage}
                          onRemix={currentImages ? () => handleRemixImage(currentImages) : undefined}
                          onEdit={currentImages ? () => handleEditImage(currentImages) : undefined}
                          onRegenerate={currentImages ? handleRegenerateImage : undefined}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* 海报生成 */}
              {mediaSubSection === 'poster' && (
                <>
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                      海报生成
                    </h1>
                    <p className="text-muted-foreground">
                      上传视频，自动提取文案并生成精美海报
                    </p>
                    <button
                      onClick={() => {
                        setMediaSubSection('select');
                      }}
                      className="mt-4 text-sm text-[#70E0FF] hover:opacity-80 transition-opacity"
                    >
                      ← 返回图文与素材
                    </button>
                  </div>
                  <PosterGeneration onGenerated={handlePosterGenerated} />
                </>
              )}

              {/* 文案生成 */}
              {mediaSubSection === 'copywriting' && (
                <>
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                      文案生成
                    </h1>
                    <p className="text-muted-foreground">
                      智能生成多种风格的营销文案
                    </p>
                    <button
                      onClick={() => {
                        setMediaSubSection('select');
                      }}
                      className="mt-4 text-sm text-[#70E0FF] hover:opacity-80 transition-opacity"
                    >
                      ← 返回图文与素材
                    </button>
                  </div>
                  <CopywritingGeneration onGenerated={handleCopywritingGenerated} />
                </>
              )}

              {/* 小红书图文 */}
              {mediaSubSection === 'xiaohongshu' && (
                <>
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                      小红书图文
                    </h1>
                    <p className="text-muted-foreground">
                      生成适配小红书的封面图、笔记结构和种草文案
                    </p>
                    <button
                      onClick={() => {
                        setMediaSubSection('select');
                      }}
                      className="mt-4 text-sm text-[#70E0FF] hover:opacity-80 transition-opacity"
                    >
                      ← 返回图文与素材
                    </button>
                  </div>
                  <XiaohongshuGeneration 
                    onGenerated={(data) => {
                      console.log('小红书图文生成完成:', data);
                    }}
                  />
                </>
              )}

              {/* 公众号推送 */}
              {mediaSubSection === 'wechat' && (
                <>
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                      公众号·视频号
                    </h1>
                    <p className="text-muted-foreground">
                      生成适配微信公众号和视频号风格的图文与视频内容
                    </p>
                    <button
                      onClick={() => {
                        setMediaSubSection('select');
                      }}
                      className="mt-4 text-sm text-[#70E0FF] hover:opacity-80 transition-opacity"
                    >
                      ← 返回图文与素材
                    </button>
                  </div>
                  <WechatGeneration 
                    onGenerated={(data) => {
                      console.log('公众号推送生成完成:', data);
                    }}
                  />
                </>
              )}

              {/* 抖音短视频 */}
              {mediaSubSection === 'douyin' && (
                <>
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                      抖音短视频
                    </h1>
                    <p className="text-muted-foreground">
                      生成适配抖音风格的短视频脚本和封面
                    </p>
                    <button
                      onClick={() => setMediaSubSection('select')}
                      className="mt-4 text-sm text-[#70E0FF] hover:opacity-80 transition-opacity"
                    >
                      ← 返回图文与素材
                    </button>
                  </div>
                  <DouyinGeneration
                    onGenerated={(data) => {
                      console.log('抖音短视频生成完成:', data);
                    }}
                  />
                </>
              )}
            </>
          )}


    </>
  );
}
