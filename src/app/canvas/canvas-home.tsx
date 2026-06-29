"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  AtSign,
  Clock,
  Film,
  Image as ImageIcon,
  MessageSquare,
  Music,
  Plus,
  Search,
  Sparkles,
  Video,
  Wand2,
} from "lucide-react";

// 画布项目的唯一真实来源是 icanvas 的 zustand store（编辑器用 openProject 读它）。
// 早期这里自己写了一份 localStorage["canvas-projects"]，导致新建的项目 id 在编辑器里
// openProject 找不到、被 router.replace("/canvas") 弹回首页（即“点不开”）。现在统一用 store。
import { useCanvasStore } from "../../icanvas/app/(user)/canvas/stores/use-canvas-store";

interface CanvasProjectMeta { id: string; title: string; }

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

function withBasePath(url: string) {
  if (!BASE_PATH || !url.startsWith("/") || url.startsWith(`${BASE_PATH}/`)) return url;
  return `${BASE_PATH}${url}`;
}

const TEMPLATES = [
  { id: "t1", title: "品牌视觉叙事", desc: "品牌故事到分镜成片", icon: Film, gradient: "from-amber-500/20 to-rose-500/10" },
  { id: "t2", title: "产品广告短片", desc: "卖点拆解 + 分镜脚本", icon: Video, gradient: "from-sky-500/20 to-cyan-500/10" },
  { id: "t3", title: "IP 角色设计", desc: "角色设定 + 多视图参考图", icon: ImageIcon, gradient: "from-violet-500/20 to-purple-500/10" },
  { id: "t4", title: "口播脚本生成", desc: "主题到口播稿 + 配音", icon: Music, gradient: "from-emerald-500/20 to-teal-500/10" },
  { id: "t5", title: "分镜拆解工作流", desc: "脚本到分镜 + 参考帧", icon: Wand2, gradient: "from-orange-500/20 to-yellow-500/10" },
  { id: "t6", title: "AI 短剧制作", desc: "ViMAX：剧本到 30 秒成片", icon: Sparkles, gradient: "from-indigo-500/20 to-blue-500/10" },
];

const BROWSE_ITEMS = [
  {
    title: "宇宙迷航短片分镜",
    desc: "6 镜头短剧结构",
    src: "/home/huiying-story-aware-10s-poster.jpg",
  },
  {
    title: "雨夜赛博镜头",
    desc: "人物、城市、情绪参考",
    src: "/samples/cyber-city.jpg",
  },
  {
    title: "香水产品系列海报",
    desc: "产品视觉和版式资产",
    src: "/home/huiying-ad-perfume.png",
  },
  {
    title: "绘影制作台",
    desc: "素材、分镜、任务联动",
    src: "/home/huiying-hero-production-console.png",
  },
  {
    title: "流程画布编排",
    desc: "节点、镜头、资产流转",
    src: "/home/huiying-workflow-canvas.png",
  },
];

export default function CanvasHome() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const hydrated = useCanvasStore((s: { hydrated: boolean }) => s.hydrated) as boolean;
  const projects = useCanvasStore((s: { projects: CanvasProjectMeta[] }) => s.projects) as CanvasProjectMeta[];
  const createProject = useCanvasStore((s: { createProject: (title?: string) => string }) => s.createProject) as (title?: string) => string;

  // 用真实 store 创建项目并进入；store 未水合完成前先不创建，避免被 rehydrate 覆盖丢失。
  const createAndEnter = (title?: string) => {
    if (!hydrated) return;
    const cleanTitle = title?.trim();
    const id = createProject(cleanTitle || `画布 ${projects.length + 1}`);
    router.push(`/canvas/${id}`);
  };
  const enterProject = (id: string) => router.push(`/canvas/${id}`);
  const submitAgentPrompt = () => createAndEnter(prompt || "30 秒短剧画布智能体");

  return (
    <main className="relative h-full overflow-auto bg-black text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-55"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.86) 78%), url(${withBasePath("/home/huiying-hero-cosmic-film.png")})`,
          backgroundPosition: "center top",
          backgroundSize: "cover",
        }}
      />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(112,224,255,0.18),transparent_28%),radial-gradient(circle_at_24%_56%,rgba(79,108,255,0.16),transparent_30%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-none flex-col gap-8 px-6 py-8 xl:px-10">
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center pt-6 text-center">
          <p className="mb-3 inline-flex rounded-full border border-[#70E0FF]/25 bg-[#70E0FF]/10 px-3 py-1 text-xs font-medium text-[#8BE9FF]">
            画布智能体
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">今天想在无限画布创作什么？</h1>
          <p className="mt-3 text-sm text-white/58">像生成页一样先把需求交给 Agent，再把分镜、素材和任务落到画布里继续组织。</p>

          <div className="mt-8 w-full rounded-2xl border border-white/12 bg-[#0B101A]/88 p-3 text-left shadow-2xl shadow-black/30 backdrop-blur-xl focus-within:border-[#4F6CFF]/60">
            <div className="flex items-start gap-3">
              <button className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/12 text-white/48 hover:text-white" title="上传参考" type="button">
                <Plus className="h-4 w-4" />
              </button>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitAgentPrompt();
                  }
                }}
                rows={3}
                placeholder="输入想法、脚本或上传参考，例如：做一部 30 秒雨夜科幻短剧，先生成分镜和参考图，再进入画布组织素材"
                className="min-h-[72px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-white outline-none placeholder:text-white/36"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F6CFF]/15 px-2.5 py-1.5 text-xs font-medium text-[#70E0FF] ring-1 ring-[#4F6CFF]/30">
                <Sparkles className="h-3.5 w-3.5" /> Agent 模式
              </button>
              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-2.5 py-1.5 text-xs text-white/64 hover:text-white">
                <MessageSquare className="h-3.5 w-3.5" /> 自动
              </button>
              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-2.5 py-1.5 text-xs text-white/64 hover:text-white">
                <Search className="h-3.5 w-3.5" /> 灵感搜索
              </button>
              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-2.5 py-1.5 text-xs text-white/64 hover:text-white">
                <Wand2 className="h-3.5 w-3.5" /> 创意设计
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 text-white/64 hover:text-white" title="添加主体">
                <AtSign className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={submitAgentPrompt}
                disabled={!hydrated}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[#4F6CFF] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                title="创建画布"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-none">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/74">浏览图</h2>
            <button type="button" onClick={() => createAndEnter()} disabled={!hydrated} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-medium text-white/78 hover:bg-white/15 disabled:opacity-40">
              <Plus className="h-4 w-4" /> 新建项目
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {BROWSE_ITEMS.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => createAndEnter(item.title)}
                disabled={!hydrated}
                className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] text-left transition-all hover:-translate-y-0.5 hover:border-[#70E0FF]/45 disabled:opacity-50"
              >
                <div className="aspect-[16/9] overflow-hidden bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={withBasePath(item.src)} alt={item.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-3">
                  <h3 className="truncate text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-xs text-white/48">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-none">
          <h2 className="mb-4 text-sm font-medium text-white/74">快速开始</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {TEMPLATES.map((tpl) => (
              <button key={tpl.id} onClick={() => createAndEnter(tpl.title)} disabled={!hydrated} className={`group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br ${tpl.gradient} p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#70E0FF]/40 disabled:opacity-50`}>
                <tpl.icon className="mb-3 h-6 w-6 text-white/70" />
                <h3 className="text-sm font-semibold text-white">{tpl.title}</h3>
                <p className="mt-1 text-xs text-white/50">{tpl.desc}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-none pb-12">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-white/74">
            <Clock className="h-4 w-4" /> 最近项目
          </h2>
          {hydrated && projects.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
              {projects.slice(0, 12).map((p: CanvasProjectMeta) => (
                <button key={p.id} onClick={() => enterProject(p.id)} className="group rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#70E0FF]/40">
                  <div className="mb-2 flex aspect-video items-center justify-center rounded-lg bg-white/5">
                    <Film className="h-8 w-8 text-white/30" />
                  </div>
                  <h3 className="truncate text-sm font-medium text-white/90">{p.title}</h3>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/12 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/42">
              还没有画布项目，点击上方“新建项目”或输入需求开始创作。
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
