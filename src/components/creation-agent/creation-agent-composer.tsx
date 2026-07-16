import type { CreationReference } from '@/lib/creation-agent/creation-reference-model';
import { ImagePlus, WandSparkles, X } from 'lucide-react';

interface CreationAgentComposerProps {
  prompt: string;
  skill: string;
  model: string;
  busy: boolean;
  validationMessage: string;
  references: CreationReference[];
  referenceMessage: string;
  uploadingReference: boolean;
  onPromptChange: (value: string) => void;
  onSkillChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onSubmit: () => void;
  onReferenceFile: (file: File) => void;
  onRemoveReference: (id: string) => void;
}

export function CreationAgentComposer({
  prompt,
  skill,
  model,
  busy,
  validationMessage,
  references,
  referenceMessage,
  uploadingReference,
  onPromptChange,
  onSkillChange,
  onModelChange,
  onSubmit,
  onReferenceFile,
  onRemoveReference,
}: CreationAgentComposerProps) {
  return (
    <form
      className="relative overflow-hidden rounded-[24px] border border-white/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,255,0.96))] p-3 shadow-[0_22px_65px_rgba(37,99,235,0.13),0_2px_12px_rgba(15,23,42,0.05)] ring-1 ring-blue-100/70 transition duration-300 before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-400/70 before:to-transparent focus-within:-translate-y-0.5 focus-within:ring-blue-300 focus-within:shadow-[0_28px_75px_rgba(79,70,229,0.17)] motion-reduce:transform-none motion-reduce:transition-none"
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
        className="relative w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
      />
      {validationMessage ? (
        <p role="alert" className="px-3 pb-2 text-xs text-amber-700">{validationMessage}</p>
      ) : null}
      {references.length > 0 ? (
        <div aria-label="已选参考图" className="flex flex-wrap gap-2 px-3 pb-3">
          {references.map(reference => (
            <span key={reference.id} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
              <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="max-w-48 truncate">{reference.name}</span>
              <button
                type="button"
                aria-label={`删除参考图 ${reference.name}`}
                onClick={() => onRemoveReference(reference.id)}
                className="rounded p-0.5 text-blue-400 transition hover:bg-blue-100 hover:text-blue-700"
              ><X className="h-3 w-3" aria-hidden="true" /></button>
            </span>
          ))}
        </div>
      ) : null}
      {referenceMessage ? (
        <p role="status" className="px-3 pb-2 text-xs text-amber-700">{referenceMessage}</p>
      ) : null}
      <div className="relative flex flex-wrap items-center gap-2 border-t border-slate-100/90 pt-3">
        <label className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/60">
          <span>Skill</span>
          <select
            value={skill}
            onChange={event => onSkillChange(event.target.value)}
            className="bg-transparent font-semibold text-slate-700 outline-none"
          >
            <option value="lesson-script">教学脚本</option>
            <option value="course-storyboard">课程分镜</option>
            <option value="concept-demo">概念演示</option>
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/60">
          <span>模型</span>
          <select
            value={model}
            onChange={event => onModelChange(event.target.value)}
            className="bg-transparent font-semibold text-slate-700 outline-none"
          >
            <option value="production-dry-run">无成本制作方案</option>
          </select>
        </label>
        <input
          id="creation-reference-file"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          disabled={uploadingReference || references.length >= 8}
          className="sr-only"
          onChange={event => {
            const file = event.currentTarget.files?.[0];
            if (file) onReferenceFile(file);
            event.currentTarget.value = '';
          }}
        />
        <label
          htmlFor="creation-reference-file"
          aria-disabled={uploadingReference || references.length >= 8}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 aria-disabled:cursor-not-allowed aria-disabled:text-slate-300"
        >
          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
          {uploadingReference ? '正在上传…' : references.length >= 8 ? '参考图已达 8 张' : '选择参考图'}
        </label>
        <button
          type="submit"
          disabled={busy}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.24)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(79,70,229,0.32)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none motion-reduce:transform-none motion-reduce:transition-none"
        >
          <WandSparkles className="h-4 w-4" aria-hidden="true" />
          {busy ? '正在生成方案…' : '生成制作方案'}
        </button>
      </div>
    </form>
  );
}
