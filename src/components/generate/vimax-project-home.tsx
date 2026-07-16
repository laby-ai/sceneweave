'use client';

import type { ReactNode } from 'react';
import { ArrowRight, Film, Plus, Sparkles } from 'lucide-react';

import type { VimaxProjectSummary } from '@/lib/skills/vimax-short-drama/vimax-project-catalog';
import type { VimaxSkillPreset } from '@/lib/skills/vimax-short-drama/vimax-skill-presets';

interface VimaxProjectHomeProps {
  projects: VimaxProjectSummary[];
  skills: VimaxSkillPreset[];
  selectedSkillId: string;
  composer: ReactNode;
  onOpenProject: (projectId: string) => void;
  onStartProject: () => void;
  onSelectSkill: (skillId: string) => void;
}

export function VimaxProjectHome({
  projects,
  skills,
  selectedSkillId,
  composer,
  onOpenProject,
  onStartProject,
  onSelectSkill,
}: VimaxProjectHomeProps) {
  return (
    <main
      data-testid="vimax-project-home"
      className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col px-8 pb-14 pt-20 text-[#181a20]"
    >
      <section className="mx-auto flex w-full max-w-[920px] flex-col items-center">
        <div className="mb-4 flex items-center gap-2 rounded-full border border-[#dce7ff] bg-[#f3f7ff] px-3 py-1.5 text-xs font-medium text-[#2f6bff]">
          <Sparkles className="h-3.5 w-3.5" />
          Vimax 创作智能体
        </div>
        <h1 className="text-center text-[34px] font-semibold tracking-[-0.035em] text-[#15171c]">
          你好，想创作什么？
        </h1>
        <p className="mt-3 text-center text-sm leading-6 text-[#737a87]">
          输入想法、脚本或参考资料，从创意规划到分镜、素材与成片持续推进。
        </p>
        <div className="mt-8 w-full">{composer}</div>

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

      <section data-testid="vimax-recent-projects" className="mt-16 w-full">
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
              <button
                key={project.id}
                type="button"
                onClick={() => onOpenProject(project.id)}
                className="group min-h-[152px] rounded-2xl border border-[#e5e8ed] bg-white p-5 text-left shadow-[0_8px_28px_rgba(31,41,55,0.045)] transition duration-200 hover:-translate-y-1 hover:border-[#cfd9e8] hover:shadow-[0_16px_34px_rgba(31,41,55,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]/30"
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
