'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FolderOpen } from 'lucide-react';

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
import { streamCreationTask } from '@/lib/creation-agent/creation-task-stream';
import { CreationAgentComposer } from './creation-agent-composer';
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
  const [skill, setSkill] = useState('agent-creation');
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
    if (!restored || !state.taskId || !state.requestId
      || !['submitting', 'running', 'reconnecting'].includes(state.status)) return;
    const controller = new AbortController();
    const requestId = state.requestId;
    void streamCreationTask({
      taskId: state.taskId,
      requestId,
      headers: buildPaperHostGuestRequestHeaders(window.location.search),
      signal: controller.signal,
      onEvent: event => setState(current => applyCreationEvent(current, event)),
    }).catch(() => {
      if (controller.signal.aborted) return;
      setState(current => applyCreationEvent(current, {
        requestId,
        taskId: current.taskId,
        status: 'failed',
      }));
    });
    return () => controller.abort();
  }, [restored, state.requestId, state.status, state.taskId]);

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
      const running = applyCreationEvent(submitting, {
        requestId,
        taskId,
        status: 'running',
        stage: '同步任务进度',
        progress: 0,
        message: '正在连接任务事件流',
      });
      setState(running);
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
      await fetch(`/api/tasks/${encodeURIComponent(state.taskId)}`, {
        method: 'DELETE',
        headers: buildPaperHostGuestRequestHeaders(window.location.search),
      }).catch(() => null);
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

  const handleQuickStart = (nextSkill: string, nextPrompt: string) => {
    setSkill(nextSkill);
    setPrompt(nextPrompt);
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

  const composer = (
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
  );

  return (
    <main data-paper-host-creation-agent="true" data-paper-host-theme="light" data-paper-host-visual="aigc-light-workbench" className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <section className="flex min-h-screen min-w-0 flex-col">
        <header className="flex h-14 items-center justify-end gap-2 border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-xl">
          <Link href="/media" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500">
            <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
            资产库
          </Link>
          <button type="button" onClick={handleReturn} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            返回平台
          </button>
        </header>
        <CreationAgentTaskStage state={state} notice={notice} onCancel={handleCancel} onRetry={handleRetry} onNew={handleNew} onQuickStart={handleQuickStart} composer={state.status === 'idle' ? composer : undefined} />
        {state.status !== 'idle' ? <div className="sticky bottom-0 z-20 mx-auto w-full max-w-4xl p-4 pt-0 sm:p-5 sm:pt-0">{composer}</div> : null}
      </section>
    </main>
  );
}
