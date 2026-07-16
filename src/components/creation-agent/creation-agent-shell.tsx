'use client';

import { useEffect, useState } from 'react';

import {
  applyCreationEvent,
  beginCreation,
  buildPaperHostGuestRequestHeaders,
  cancelCreation,
  createCreationAgentState,
  createCreationRequestId,
  retryCreation,
  validateCreationPrompt,
  type CreationAgentState,
} from '@/lib/creation-agent/creation-agent-model';
import { createPaperHostMessage, type PaperHostMessageType } from '@/lib/paper-host-bridge';
import {
  parseCreationReferences,
  validateCreationReferenceFile,
  type CreationReference,
} from '@/lib/creation-agent/creation-reference-model';
import { CreationAgentComposer } from './creation-agent-composer';
import { CreationAgentHistory } from './creation-agent-history';
import { CreationAgentTaskStage } from './creation-agent-task-stage';

const STORAGE_KEY = 'sceneweave:paper-host:creation-agent';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const postToPaperHost = (type: PaperHostMessageType, reason?: string) => {
  if (typeof window === 'undefined' || window.parent === window || !document.referrer) return false;
  try {
    const targetOrigin = new URL(document.referrer).origin;
    window.parent.postMessage(createPaperHostMessage(type, reason), targetOrigin);
    return true;
  } catch {
    return false;
  }
};

const restoreState = (): CreationAgentState => {
  if (typeof window === 'undefined') return createCreationAgentState();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return createCreationAgentState();
    const value: unknown = JSON.parse(raw);
    return isRecord(value)
      ? createCreationAgentState(value as Partial<CreationAgentState>)
      : createCreationAgentState();
  } catch {
    return createCreationAgentState();
  }
};

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('reference_read_failed'));
  reader.onerror = () => reject(new Error('reference_read_failed'));
  reader.readAsDataURL(file);
});

export function CreationAgentShell() {
  const [state, setState] = useState<CreationAgentState>(() => createCreationAgentState());
  const [restored, setRestored] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [skill, setSkill] = useState('lesson-script');
  const [model, setModel] = useState('production-dry-run');
  const [validationMessage, setValidationMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [references, setReferences] = useState<CreationReference[]>([]);
  const [referenceMessage, setReferenceMessage] = useState('');
  const [uploadingReference, setUploadingReference] = useState(false);

  useEffect(() => {
    const restored = restoreState();
    setState(restored);
    setPrompt(restored.prompt);
    setRestored(true);
    postToPaperHost('paper-host-ready');
    void (async () => {
      try {
        const response = await fetch('/api/subjects', {
          headers: buildPaperHostGuestRequestHeaders(window.location.search),
        });
        const payload: unknown = await response.json().catch(() => null);
        const data = isRecord(payload) ? payload : {};
        if (response.ok) setReferences(parseCreationReferences(data.subjects));
      } catch {
        setReferenceMessage('参考图暂时无法恢复，您仍可继续编辑创意。');
      }
    })();
  }, []);

  useEffect(() => {
    if (restored && typeof window !== 'undefined') {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [restored, state]);

  const submit = async (baseState: CreationAgentState = state) => {
    const validation = validateCreationPrompt(prompt || baseState.prompt);
    setValidationMessage(validation.message);
    if (!validation.valid) return;

    const requestId = createCreationRequestId();
    const submitting = beginCreation(baseState, {
      requestId,
      prompt: prompt || baseState.prompt,
    });
    setState(submitting);
    setNotice('');

    try {
      const response = await fetch('/api/production/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildPaperHostGuestRequestHeaders(window.location.search),
        },
        body: JSON.stringify({
          prompt: submitting.prompt,
          workflow: skill,
          model,
          referenceIds: references.map(reference => reference.id),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const data = isRecord(payload) ? payload : {};

      if (!response.ok) {
        const message = response.status === 401
          ? '当前创作服务需要登录后保存任务，您的创意仍保留在本页。'
          : response.status === 503
            ? '创作服务正在配置中，请稍后重试。'
            : '制作方案暂时未生成，请检查网络后重试。';
        setNotice(message);
        setState(applyCreationEvent(submitting, {
          requestId,
          status: 'failed',
          progress: 0,
        }));
        if (response.status === 401) postToPaperHost('paper-host-login-required', message);
        return;
      }

      const taskId = typeof data.taskId === 'string' ? data.taskId : '';
      const project = isRecord(data.project) ? data.project : {};
      const shots = Array.isArray(data.shots) ? data.shots : [];
      setState(applyCreationEvent(submitting, {
        requestId,
        taskId,
        status: 'completed',
        progress: 100,
        result: {
          title: typeof project.title === 'string' ? project.title : '科教创作方案',
          shotCount: shots.length,
        },
      }));
    } catch {
      setNotice('网络连接中断，创意已保留，可以直接重试。');
      setState(applyCreationEvent(submitting, {
        requestId,
        status: 'failed',
        progress: 0,
      }));
    }
  };

  const handleCancel = async () => {
    if (state.taskId) {
      await fetch(`/api/tasks/${encodeURIComponent(state.taskId)}`, { method: 'DELETE' }).catch(() => null);
    }
    setState(cancelCreation(state));
  };

  const handleRetry = () => {
    const retryState = retryCreation(state);
    setState(retryState);
    setPrompt(retryState.prompt);
    void submit(retryState);
  };

  const handleNew = () => {
    const next = createCreationAgentState();
    setState(next);
    setPrompt('');
    setNotice('');
    setValidationMessage('');
  };

  const handleReferenceFile = async (file: File) => {
    const validation = validateCreationReferenceFile(file);
    setReferenceMessage(validation.message);
    if (!validation.valid) return;
    setUploadingReference(true);
    try {
      const response = await fetch('/api/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildPaperHostGuestRequestHeaders(window.location.search),
        },
        body: JSON.stringify({
          name: file.name,
          type: 'object',
          source: 'uploaded',
          context: 'creation-agent',
          referenceUrl: await readFileAsDataUrl(file),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const data = isRecord(payload) ? payload : {};
      const created = parseCreationReferences(data.subject ? [data.subject] : []);
      if (!response.ok || created.length !== 1) throw new Error('reference_upload_failed');
      setReferences(current => [created[0], ...current.filter(item => item.id !== created[0].id)].slice(0, 8));
      setReferenceMessage('参考图已加入当前创作，可随制作方案一起保存。');
    } catch {
      setReferenceMessage('参考图上传失败，请检查图片格式或网络后重试。');
    } finally {
      setUploadingReference(false);
    }
  };

  const handleRemoveReference = async (id: string) => {
    setReferenceMessage('');
    try {
      const response = await fetch(`/api/subjects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: buildPaperHostGuestRequestHeaders(window.location.search),
      });
      if (!response.ok) throw new Error('reference_delete_failed');
      setReferences(current => current.filter(item => item.id !== id));
      setReferenceMessage('参考图已移除。');
    } catch {
      setReferenceMessage('参考图暂时无法移除，请稍后重试。');
    }
  };

  const handleReturn = () => {
    if (!postToPaperHost('paper-host-return') && typeof window !== 'undefined') window.history.back();
  };

  const busy = state.status === 'submitting' || state.status === 'running' || state.status === 'reconnecting';

  return (
    <main data-paper-host-creation-agent="true" className="min-h-screen bg-[#050a13] text-slate-100">
      <div className="grid min-h-screen bg-[radial-gradient(circle_at_65%_20%,rgba(34,211,238,0.09),transparent_38%),radial-gradient(circle_at_30%_85%,rgba(59,130,246,0.08),transparent_34%)] lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        <CreationAgentHistory state={state} onNew={handleNew} />
        <section className="flex min-h-[70vh] min-w-0 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-white/10 px-5">
            <div>
              <p className="text-sm font-medium text-white">科教创作 Agent</p>
              <p className="text-xs text-slate-500">脚本 · 分镜 · 成片任务</p>
            </div>
            <button type="button" onClick={handleReturn} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-white/20 hover:bg-white/[0.04]">返回平台</button>
          </header>
          <CreationAgentTaskStage state={state} notice={notice} onCancel={handleCancel} onRetry={handleRetry} />
          <div className="sticky bottom-0 p-4 pt-0 sm:p-5 sm:pt-0">
            <CreationAgentComposer
              prompt={prompt}
              skill={skill}
              model={model}
              busy={busy}
              validationMessage={validationMessage}
              references={references}
              referenceMessage={referenceMessage}
              uploadingReference={uploadingReference}
              onPromptChange={setPrompt}
              onSkillChange={setSkill}
              onModelChange={setModel}
              onSubmit={() => void submit()}
              onReferenceFile={file => void handleReferenceFile(file)}
              onRemoveReference={id => void handleRemoveReference(id)}
            />
          </div>
        </section>
        <aside className="border-t border-white/10 bg-black/15 p-5 lg:border-l lg:border-t-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">制作设置</p>
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-sm font-medium text-slate-100">当前 Skill</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{skill === 'lesson-script' ? '教学脚本' : skill === 'course-storyboard' ? '课程分镜' : '概念演示'}将复用现有分镜与任务契约。</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-sm font-medium text-slate-100">成本边界</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">当前仅生成无成本制作方案，不会触发图像或视频模型。</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-sm font-medium text-slate-100">附件与参考</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{references.length > 0 ? `已绑定 ${references.length} 张参考图；刷新后仍会保留。` : '可加入最多 8 张参考图，生成制作方案前仍可移除。'}</p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
