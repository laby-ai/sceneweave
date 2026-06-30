'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Film, GitBranch, Image as ImageIcon, Play, Video } from 'lucide-react';
import type { HomeGalleryItem } from '@/components/home/dreambox-types';

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

function withBasePath(url?: string) {
  if (!url) return url;
  if (!BASE_PATH || !url.startsWith('/') || url.startsWith(`${BASE_PATH}/`)) return url;
  return `${BASE_PATH}${url}`;
}

function videoPreviewUrl(url?: string) {
  if (!url) return undefined;
  const normalized = withBasePath(url);
  if (!normalized) return undefined;
  return normalized.includes('#') ? normalized : `${normalized}#t=0.12`;
}

export function DreamboxHomeSection({
  activeSection,
  homeGalleryItems,
  setActiveSection,
  setPendingPrompt,
  onOpenWorkDetail,
}: {
  activeSection: string;
  homeGalleryItems: HomeGalleryItem[];
  setActiveSection: (section: string) => void;
  setPendingPrompt: (prompt: string | undefined) => void;
  onOpenWorkDetail?: (item: { title: string; type: string; videoSrc?: string; src: string; source?: string }) => void;
}) {
  const router = useRouter();
  const [failedPreviewIds, setFailedPreviewIds] = useState<Set<string>>(new Set());

  return (
    <>
          {/* 首页 - 画廊化黑色创作入口 */}
          {activeSection === 'home' && (
            <div className="-mx-3 -mt-3 min-h-[calc(100vh-72px)] bg-black text-white sm:-mx-5 sm:-mt-5">
              <section className="mx-auto w-full max-w-none px-3 pt-4 sm:px-5 xl:px-8 2xl:px-10">
                <div className="relative min-h-[500px] overflow-hidden rounded-none border border-white/10 bg-[#03050a] md:min-h-[58vh] xl:min-h-[640px]">
                  <img
                    src={withBasePath("/home/huiying-hero-cosmic-reel-v2.png")}
                    alt="绘影宇宙胶卷制作流"
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.40)_0%,rgba(0,0,0,0.24)_34%,rgba(0,0,0,0.05)_68%,rgba(0,0,0,0.34)_100%)]" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_44%,rgba(112,224,255,0.16),transparent_28%),radial-gradient(circle_at_18%_38%,rgba(79,108,255,0.10),transparent_28%),radial-gradient(circle_at_58%_60%,rgba(139,92,246,0.10),transparent_30%)]" />
                  <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black to-transparent" />
                  <div className="relative z-10 flex min-h-[500px] flex-col justify-between p-5 md:min-h-[58vh] md:p-7 xl:min-h-[640px]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h1 className="text-5xl font-semibold leading-none text-white sm:text-6xl lg:text-7xl">绘影</h1>
                        <p className="mt-4 text-lg font-medium tracking-[0.18em] text-[#BDF4FF] sm:text-xl">
                          绘意成片，影贯全程
                        </p>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/66 sm:text-base">
                          面向短剧与短片生产，把创意、剧本、角色、分镜、素材、任务和成片收束到同一张制作台。
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {[
                        { label: '镜头生成', desc: '提示词、参考图到视频片段', icon: Video, action: () => setActiveSection('video') },
                        { label: '角色与场景', desc: '统一沉淀视觉参考资产', icon: ImageIcon, action: () => setActiveSection('image') },
                        { label: '剧本分镜', desc: '从故事结构进入长流程', icon: Film, action: () => setActiveSection('film') },
                        { label: '流程画布', desc: '节点编排、复用和追踪', icon: GitBranch, action: () => router.push('/node-editor') },
                      ].map((item) => (
                        <button
                          key={item.label}
                          aria-label={`进入${item.label}`}
                          title={item.label}
                          onClick={item.action}
                          className="group flex min-h-[84px] items-center justify-between rounded-2xl border border-white/15 bg-black/35 p-4 text-left shadow-2xl shadow-black/30 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-[#70E0FF]/70 hover:bg-white/[0.08]"
                        >
                          <span>
                            <span className="block text-base font-semibold text-white">{item.label}</span>
                            <span className="mt-1 block text-xs text-white/58">{item.desc}</span>
                          </span>
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#70E0FF] transition-colors group-hover:bg-[#4F6CFF] group-hover:text-white">
                            <item.icon className="h-5 w-5" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="mx-auto w-full max-w-none px-3 py-4 sm:px-5 xl:px-8 2xl:px-10">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2 overflow-x-auto">
                    {['发现', '广告营销', '剧场', '美学', '工作流'].map((tab, index) => (
                      <button
                        key={tab}
                        className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                          index === 0
                            ? 'bg-white text-black'
                            : 'bg-white/[0.07] text-white/62 hover:bg-white/[0.12] hover:text-white'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setActiveSection('media')}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/[0.07] px-4 py-2 text-sm text-white/72 hover:bg-white/[0.12] hover:text-white"
                  >
                    图文与素材
                  </button>
                </div>

                <div className="grid grid-flow-dense auto-rows-[118px] grid-cols-2 gap-2 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 2xl:auto-rows-[140px]">
                  {homeGalleryItems.map((item) => {
                    const itemKey = `${item.title}-${item.type}`;
                    const previewFailed = failedPreviewIds.has(itemKey);
                    return (
                    <button
                      key={itemKey}
                      onClick={() => {
                        if (item.source === 'historical' && onOpenWorkDetail) {
                          onOpenWorkDetail(item);
                          return;
                        }
                        setPendingPrompt(item.title);
                        if (item.href) {
                          router.push(item.href);
                          return;
                        }
                        if (item.target === 'canvas') {
                          router.push('/node-editor');
                          return;
                        }
                        setActiveSection(item.target);
                      }}
                      className={`group relative overflow-hidden rounded-[3px] border border-white/[0.04] bg-[#111] text-left ${item.span}`}
                    >
                      {previewFailed && item.videoSrc ? (
                        <video
                          src={videoPreviewUrl(item.videoSrc)}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <img
                          src={withBasePath(item.src)}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                          decoding="async"
                          onError={() => {
                            if (item.videoSrc) {
                              setFailedPreviewIds(prev => new Set(prev).add(itemKey));
                            }
                          }}
                        />
                      )}
                      {Boolean(item.videoSrc || ['短片', '短片概念', '真实视频', '视频', '镜头', '广告', '真实片段资产'].includes(item.type)) && (
                        <>
                          <span className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur">
                            <Play className="ml-0.5 h-3.5 w-3.5 fill-white" />
                          </span>
                          <span className="absolute bottom-3 right-3 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white/82 backdrop-blur">
                            {item.duration || '00:12'}
                          </span>
                          <span className="absolute inset-x-3 bottom-3 h-1 overflow-hidden rounded-full bg-white/12">
                            <span className="block h-full w-2/5 rounded-full bg-[#70E0FF]/80" />
                          </span>
                        </>
                      )}
                      <span className="absolute left-3 top-3 rounded-md bg-black/45 px-2 py-1 text-[11px] font-medium text-white/86 backdrop-blur">
                        {item.type}
                      </span>
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10 text-sm font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {item.title}
                      </span>
                    </button>
                    );
                  })}
                </div>
              </section>

            </div>
          )}


    </>
  );
}
