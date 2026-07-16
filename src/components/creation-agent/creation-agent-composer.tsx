import type { CreationReference } from '@/lib/creation-agent/creation-reference-model';
import { ArrowUp, ImagePlus, Sparkles, X } from 'lucide-react';

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
      className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_52px_rgba(15,23,42,0.06)] transition focus-within:border-slate-300 focus-within:shadow-[0_22px_60px_rgba(15,23,42,0.09)]"
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
        rows={4}
        maxLength={2000}
        placeholder="输入想法、剧本或上传参考，支持“/”使用技能，与 Agent 一起创作"
        className="w-full resize-none bg-transparent px-1 py-1 text-[15px] leading-7 text-slate-800 outline-none placeholder:text-slate-400"
      />
      {validationMessage ? <p role="alert" className="pt-1 text-xs text-amber-700">{validationMessage}</p> : null}
      {references.length > 0 ? (
        <div aria-label="已选参考图" className="flex flex-wrap gap-2 pt-3">
          {references.map(reference => (
            <span key={reference.id} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
              <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="max-w-48 truncate">{reference.name}</span>
              <button type="button" aria-label={`删除参考图 ${reference.name}`} onClick={() => onRemoveReference(reference.id)} className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {referenceMessage ? <p role="status" className="pt-2 text-xs text-amber-700">{referenceMessage}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 transition hover:bg-slate-50">
          <Sparkles className="h-3.5 w-3.5 text-cyan-600" aria-hidden="true" />
          <span className="font-semibold text-slate-800">Agent 模式</span>
          <select value={skill} onChange={event => onSkillChange(event.target.value)} className="bg-transparent text-slate-600 outline-none">
            <option value="agent-creation">智能创作</option>
            <option value="short-drama">短剧分镜</option>
            <option value="product-visual">商品视觉</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 transition hover:bg-slate-50">
          <span>模型</span>
          <select value={model} onChange={event => onModelChange(event.target.value)} className="bg-transparent font-semibold text-slate-700 outline-none">
            <option value="production-dry-run">自动规划（无成本）</option>
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
        <label htmlFor="creation-reference-file" aria-disabled={uploadingReference || references.length >= 8} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 aria-disabled:cursor-not-allowed aria-disabled:text-slate-300">
          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
          {uploadingReference ? '正在上传…' : references.length >= 8 ? '参考图已达 8 张' : '选择参考图'}
        </label>
        <button type="submit" aria-label="提交创作" disabled={busy} className="ml-auto grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
