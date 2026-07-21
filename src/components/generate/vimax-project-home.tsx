'use client';

import { useState, type ReactNode } from 'react';
import { ArrowRight, Film, MoreHorizontal, Plus, Trash2 } from 'lucide-react';

import { buildMediaPreviewImageUrl } from '@/lib/media-preview';
import type { VimaxProjectSummary } from '@/lib/skills/vimax-short-drama/vimax-project-catalog';
import type { VimaxSkillPreset } from '@/lib/skills/vimax-short-drama/vimax-skill-presets';

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

function withBasePath(url: string) {
  if (!BASE_PATH || !url.startsWith('/') || url.startsWith(`${BASE_PATH}/`)) return url;
  return `${BASE_PATH}${url}`;
}

function backgroundPreview(width: 640 | 1080 | 1920) {
  return buildMediaPreviewImageUrl(withBasePath('/home/huiying-hero-cosmic-reel-v2.png'), {
    width,
    quality: width >= 1080 ? 68 : 58,
    basePath: BASE_PATH,
  });
}

interface VimaxProjectHomeProps {
  projects: VimaxProjectSummary[];
  skills: VimaxSkillPreset[];
  selectedSkillId: string;
  composer: ReactNode;
  actions?: ReactNode;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onStartProject: () => void;
  onSelectSkill: (skillId: string) => void;
}

export function VimaxProjectHome({
  projects,
  skills,
  selectedSkillId,
  composer,
  actions,
  onOpenProject,
  onDeleteProject,
  onStartProject,
  onSelectSkill,
}: VimaxProjectHomeProps) {
  const [managedProjectId, setManagedProjectId] = useState<string | null>(null);
  const [confirmingProjectId, setConfirmingProjectId] = useState<string | null>(null);

  const closeProjectMenu = () => {
    setManagedProjectId(null);
    setConfirmingProjectId(null);
  };

  return (
    <main
      data-testid="vimax-project-home"
      className="relative min-h-full w-full overflow-hidden bg-[#070a11] text-slate-100"
    >
      <div
        data-testid="creation-agent-page-background"
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden sm:h-[860px] lg:h-[940px]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backgroundPreview(1080)}
          srcSet={`${backgroundPreview(640)} 640w, ${backgroundPreview(1080)} 1080w, ${backgroundPreview(1920)} 1920w`}
          sizes="100vw"
          alt=""
          loading="eager"
          decoding="async"
          className="absolute inset-x-0 top-0 h-[520px] w-full object-cover object-[70%_center] opacity-95 [mask-image:linear-gradient(to_bottom,black_0%,black_46%,rgba(0,0,0,0.72)_66%,transparent_100%)] sm:h-[680px] sm:object-[68%_center] lg:h-[760px]"
          draggable={false}
        />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1320px] flex-col px-3 pb-14 pt-3 sm:px-6 lg:px-8">
        {actions ? <div className="absolute right-6 top-6 z-30">{actions}</div> : null}
        <div data-testid="creation-agent-main-stage" className="relative">
        <section
          data-testid="creation-agent-hero"
          aria-label="绘影电影创作主视觉"
          className="relative h-[260px] w-full shrink-0 sm:h-[340px] lg:h-[420px]"
        />

        <section className="relative z-10 mx-auto -mt-[76px] flex w-full max-w-[920px] flex-col items-center px-2 sm:-mt-[96px] lg:-mt-[122px]">
        <div data-testid="creation-agent-brand-mark" className="mb-2 flex items-center gap-2 rounded-full border border-white/15 bg-[#0c1320]/90 px-3 py-1.5 text-xs font-medium text-[#78a2ff] shadow-[0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={withBasePath('/brand/huiying-logo-icon.png')} alt="" className="h-5 w-5 object-contain" />
          创作智能体
        </div>
        <h1 className="text-center text-[28px] font-semibold text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.8)] sm:text-[32px]">
          你好，想创作什么？
        </h1>
        <p className="mt-2 text-center text-sm leading-6 text-slate-300 [text-shadow:0_1px_12px_rgba(0,0,0,0.85)]">
          输入想法、脚本或参考资料，从创意规划到分镜、素材与成片持续推进。
        </p>
        <div className="mt-6 w-full">{composer}</div>

        <div className="mt-5 flex max-w-[880px] flex-wrap justify-center gap-2.5" aria-label="快捷 Skill">
          {skills.map(skill => {
            const selected = skill.id === selectedSkillId;
            return (
              <button
                key={skill.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectSkill(skill.id)}
                className={`group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]/35 ${
                  selected
                    ? 'border-[#4f78df] bg-[#14254a] text-[#8eb1ff] shadow-[0_8px_24px_rgba(31,78,181,0.16)]'
                    : 'border-white/10 bg-[#0e141f] text-slate-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#151c28] hover:text-white'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-[#2f6bff]' : 'bg-[#b7bec9] group-hover:bg-[#22b8cf]'}`} />
                {skill.name}
              </button>
            );
          })}
        </div>
        </section>
        </div>

        <section data-testid="vimax-recent-projects" className="mt-10 w-full border-t border-white/[0.09] pt-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em]">最近项目</h2>
            <p className="mt-1 text-xs text-slate-500">继续当前浏览器工作区中的创作</p>
          </div>
          <button
            type="button"
            onClick={onStartProject}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#111823] px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-[#182131] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e8dff]/45"
          >
            <Plus className="h-4 w-4" />
            开始创作
          </button>
        </div>

        {projects.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => (
              <article
                key={project.id}
                className="group relative min-h-[152px] rounded-lg border border-white/[0.08] bg-[#101620] transition duration-200 hover:-translate-y-1 hover:border-[#456ecf]/55 hover:bg-[#131b28] hover:shadow-[0_18px_36px_rgba(0,0,0,0.22)]"
              >
                <button
                  type="button"
                  onClick={() => {
                    closeProjectMenu();
                    onOpenProject(project.id);
                  }}
                  className="h-full min-h-[152px] w-full rounded-lg p-5 pr-14 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#15264b] text-[#78a2ff]">
                      <Film className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#b0b6c0] transition group-hover:translate-x-0.5 group-hover:text-[#2f6bff]" />
                  </div>
                  <div className="mt-5 truncate text-base font-semibold text-slate-100">{project.title}</div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>{project.stageLabel}</span>
                    <span>{project.messageCount} 条进展</span>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`管理项目 ${project.title}`}
                  aria-expanded={managedProjectId === project.id}
                  onClick={() => {
                    setManagedProjectId(current => current === project.id ? null : project.id);
                    setConfirmingProjectId(null);
                  }}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.07] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e8dff]/45"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {managedProjectId === project.id ? (
                  <div className="absolute right-3 top-12 z-10 w-40 rounded-lg border border-white/10 bg-[#151c27] p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.38)]">
                    {confirmingProjectId === project.id ? (
                      <div className="space-y-1">
                        <p className="px-2 py-1 text-xs text-slate-400">确认删除此项目？</p>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteProject(project.id);
                            closeProjectMenu();
                          }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-rose-300 hover:bg-rose-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/30"
                        >
                          <Trash2 className="h-4 w-4" />
                          确认删除
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingProjectId(null)}
                          className="w-full rounded-lg px-2 py-2 text-left text-sm text-slate-300 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e8dff]/35"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingProjectId(project.id)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-rose-300 hover:bg-rose-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/30"
                      >
                        <Trash2 className="h-4 w-4" />
                        删除项目
                      </button>
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <button
            data-testid="vimax-project-empty-state"
            type="button"
            onClick={onStartProject}
            className="group flex min-h-[112px] w-full items-center justify-between rounded-lg border border-dashed border-white/10 bg-[#0d131d] px-5 text-left text-slate-300 transition hover:border-[#456ecf]/55 hover:bg-[#111a28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e8dff]/45 sm:px-6"
          >
            <span className="flex min-w-0 items-center gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#365cae]/60 bg-[#14244a] text-[#8eb1ff]">
                <Plus className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-100">创建第一个项目</span>
                <span className="mt-1 block text-xs text-slate-500">项目会保存在当前访客工作区</span>
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5" />
          </button>
        )}
        </section>
      </div>
    </main>
  );
}
