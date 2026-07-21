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

function heroPreview(width: 640 | 1080 | 1920) {
  return buildMediaPreviewImageUrl(withBasePath('/home/huiying-hero-cinematic-flow.png'), {
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
      className="relative mx-auto flex min-h-full w-full max-w-[1320px] flex-col px-3 pb-14 pt-4 text-[#181a20] sm:px-6 lg:px-8"
    >
      {actions ? <div className="absolute right-6 top-6 z-30">{actions}</div> : null}
      <section
        data-testid="creation-agent-hero"
        aria-label="绘影视觉背景"
        className="relative h-[148px] w-full shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#050812] shadow-[0_22px_60px_rgba(0,0,0,0.28)] sm:h-[210px] lg:h-[260px]"
      >
        {/* The URL already targets the responsive Next image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroPreview(1080)}
          srcSet={`${heroPreview(640)} 640w, ${heroPreview(1080)} 1080w, ${heroPreview(1920)} 1920w`}
          sizes="(max-width: 640px) 100vw, (max-width: 1200px) 94vw, 1260px"
          alt="绘影镜头、分镜与制作台工作流"
          loading="eager"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-[62%_center] sm:object-center"
          draggable={false}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,10,0.06),rgba(3,5,10,0.38))]" />
      </section>

      <section className="relative z-10 mx-auto -mt-6 flex w-full max-w-[920px] flex-col items-center sm:-mt-8">
        <div data-testid="creation-agent-brand-mark" className="mb-3 flex items-center gap-2 rounded-full border border-white/15 bg-[#0d1422]/92 px-3 py-1.5 text-xs font-medium text-[#78a2ff] shadow-[0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={withBasePath('/brand/huiying-logo-icon.png')} alt="" className="h-5 w-5 object-contain" />
          创作智能体
        </div>
        <h1 className="text-center text-[28px] font-semibold text-[#15171c] sm:text-[32px]">
          你好，想创作什么？
        </h1>
        <p className="mt-3 text-center text-sm leading-6 text-[#737a87]">
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
                    ? 'border-[#b9ceff] bg-[#edf3ff] text-[#215bd8] shadow-[0_6px_18px_rgba(47,107,255,0.08)]'
                    : 'border-[#e5e8ee] bg-white text-[#535a67] hover:-translate-y-0.5 hover:border-[#cad5e9] hover:text-[#20242b] hover:shadow-[0_8px_22px_rgba(31,41,55,0.07)]'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-[#2f6bff]' : 'bg-[#b7bec9] group-hover:bg-[#22b8cf]'}`} />
                {skill.name}
              </button>
            );
          })}
        </div>
      </section>

      <section data-testid="vimax-recent-projects" className="mt-12 w-full">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em]">最近项目</h2>
            <p className="mt-1 text-xs text-[#9298a3]">继续当前浏览器工作区中的创作</p>
          </div>
          <button
            type="button"
            onClick={onStartProject}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e1e5eb] bg-white px-3.5 py-2 text-sm font-medium text-[#303640] shadow-[0_4px_14px_rgba(31,41,55,0.05)] transition hover:border-[#cbd5e4] hover:bg-[#fbfcfe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]/30"
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
                className="group relative min-h-[152px] rounded-lg border border-[#e5e8ed] bg-white shadow-[0_8px_28px_rgba(31,41,55,0.045)] transition duration-200 hover:-translate-y-1 hover:border-[#cfd9e8] hover:shadow-[0_16px_34px_rgba(31,41,55,0.08)]"
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
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f4ff] text-[#2f6bff]">
                      <Film className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#b0b6c0] transition group-hover:translate-x-0.5 group-hover:text-[#2f6bff]" />
                  </div>
                  <div className="mt-5 truncate text-base font-semibold text-[#23262d]">{project.title}</div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#8a919d]">
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
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-[#8a919d] transition hover:bg-[#f1f3f6] hover:text-[#303640] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]/30"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {managedProjectId === project.id ? (
                  <div className="absolute right-3 top-12 z-10 w-40 rounded-xl border border-[#e1e5eb] bg-white p-1.5 shadow-[0_14px_34px_rgba(31,41,55,0.14)]">
                    {confirmingProjectId === project.id ? (
                      <div className="space-y-1">
                        <p className="px-2 py-1 text-xs text-[#7a818d]">确认删除此项目？</p>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteProject(project.id);
                            closeProjectMenu();
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-[#c93636] hover:bg-[#fff2f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e45f5f]/30"
                        >
                          <Trash2 className="h-4 w-4" />
                          确认删除
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingProjectId(null)}
                          className="w-full rounded-lg px-2 py-2 text-left text-sm text-[#59606c] hover:bg-[#f5f6f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]/25"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingProjectId(project.id)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[#c93636] hover:bg-[#fff2f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e45f5f]/30"
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
            type="button"
            onClick={onStartProject}
            className="flex min-h-[150px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#d8dde6] bg-white/70 text-[#646b76] transition hover:border-[#bfcbe0] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]/30"
          >
            <Plus className="mb-3 h-5 w-5 text-[#2f6bff]" />
            <span className="text-sm font-medium">创建第一个项目</span>
            <span className="mt-1 text-xs text-[#9ca2ac]">项目会保存在当前访客工作区</span>
          </button>
        )}
      </section>
    </main>
  );
}
