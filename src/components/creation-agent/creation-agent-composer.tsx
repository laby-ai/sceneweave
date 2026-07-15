interface CreationAgentComposerProps {
  prompt: string;
  skill: string;
  model: string;
  busy: boolean;
  validationMessage: string;
  onPromptChange: (value: string) => void;
  onSkillChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onSubmit: () => void;
}

export function CreationAgentComposer({
  prompt,
  skill,
  model,
  busy,
  validationMessage,
  onPromptChange,
  onSkillChange,
  onModelChange,
  onSubmit,
}: CreationAgentComposerProps) {
  return (
    <form
      className="rounded-2xl border border-white/10 bg-slate-950/80 p-3 shadow-2xl shadow-cyan-950/20 backdrop-blur"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="creation-prompt" className="sr-only">创作想法</label>
      <textarea
        id="creation-prompt"
        value={prompt}
        onChange={event => onPromptChange(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="输入教学主题、脚本想法或上传参考，让 Agent 生成制作方案"
        className="w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-slate-500"
      />
      {validationMessage ? (
        <p role="alert" className="px-3 pb-2 text-xs text-amber-300">{validationMessage}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
          <span>Skill</span>
          <select
            value={skill}
            onChange={event => onSkillChange(event.target.value)}
            className="bg-transparent font-medium text-white outline-none"
          >
            <option className="bg-slate-950" value="lesson-script">教学脚本</option>
            <option className="bg-slate-950" value="course-storyboard">课程分镜</option>
            <option className="bg-slate-950" value="concept-demo">概念演示</option>
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
          <span>模型</span>
          <select
            value={model}
            onChange={event => onModelChange(event.target.value)}
            className="bg-transparent font-medium text-white outline-none"
          >
            <option className="bg-slate-950" value="production-dry-run">无成本制作方案</option>
          </select>
        </label>
        <button
          type="button"
          disabled
          title="参考图上传将在附件契约接通后开放"
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-500"
        >
          参考图 · 接入中
        </button>
        <button
          type="submit"
          disabled={busy}
          className="ml-auto rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {busy ? '正在生成方案…' : '生成制作方案'}
        </button>
      </div>
    </form>
  );
}
