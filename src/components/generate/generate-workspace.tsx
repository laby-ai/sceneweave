'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileJson,
  Footprints,
  Image as ImageIcon,
  Loader2,
  Music,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Video,
  Wand2,
  X,
} from 'lucide-react';

import { VimaxProjectBar } from '@/components/generate/vimax-project-bar';
import { VimaxProjectHome } from '@/components/generate/vimax-project-home';
import {
  accountAuthHeaders,
  clientApiDownloadBlob,
  clientApiFetch,
  clientApiPath,
  clientApiRequest,
} from '@/lib/client-api';
import { genId, loadChatHistory, loadMessages, saveChatHistory, saveMessages, type ChatHistoryEntry, type ChatMessage } from '@/lib/smart-assistant-panel-model';
import { VimaxProductionPlanCard } from '@/components/generate/vimax-production-plan-card';
import { VimaxProjectEditorCard } from '@/components/generate/vimax-project-editor-card';
import { VimaxSegmentedProductionCard } from '@/components/generate/vimax-segmented-production-card';
import { VimaxShotReferenceGrid } from '@/components/generate/vimax-shot-reference-grid';
import { VimaxProtectedDownload, VimaxProtectedVideo } from '@/components/generate/vimax-protected-media';
import { BailianConnectionControl } from '@/components/generate/bailian-connection-control';
import {
  useVimaxShortDramaSkill,
  VIMAX_REFERENCE_CONFIRM_REGEX,
} from '@/lib/skills/vimax-short-drama/use-vimax-short-drama-skill';
import { buildVimaxAgentConfirmationView } from '@/lib/skills/vimax-short-drama/vimax-agent-confirmation-view';
import {
  resolveVimaxGenerationSettings,
  VIMAX_PLAN_MODEL,
} from '@/lib/skills/vimax-short-drama/vimax-generation-preferences';
import {
  parseVimaxProductionPlan,
  type VimaxProductionPlan,
} from '@/lib/skills/vimax-short-drama/vimax-production-plan';
import {
  loadVimaxSkillPreset,
  resolveVimaxSkillPreset,
  saveVimaxSkillPreset,
  searchVimaxSkillPresets,
} from '@/lib/skills/vimax-short-drama/vimax-skill-presets';
import {
  createVimaxRunCoordinator,
  recoverVimaxProjectMessages,
} from '@/lib/skills/vimax-short-drama/vimax-project-session';
import {
  createVimaxProject,
  deleteVimaxProject,
  loadActiveVimaxProjectId,
  renameVimaxProject,
  restoreVimaxWorkspaceView,
  saveActiveVimaxProjectId,
  saveVimaxWorkspaceView,
  summarizeVimaxProjects,
  upsertVimaxProjectMessages,
  type VimaxWorkspaceView,
} from '@/lib/skills/vimax-short-drama/vimax-project-catalog';
import {
  buildVimaxContinueEditPrompt,
  buildVimaxResultDelivery,
  createVimaxManifestDataUrl,
  resolveVimaxProjectPresetId,
  resolveVimaxResultIteration,
} from '@/lib/skills/vimax-short-drama/vimax-result-delivery';
import {
  applyRecoveredVimaxProductionPlan,
  needsPersistedVimaxRenderRecovery,
  recoverVimaxTaskProject,
  shouldMountVimaxTaskBackedControls,
} from '@/lib/skills/vimax-short-drama/vimax-task-project-recovery';
import {
  buildVimaxTaskUrl,
  resolveVimaxTaskId,
  shouldClearCachedVimaxProject,
  shouldShowVimaxQuickOption,
} from '@/lib/skills/vimax-short-drama/vimax-workspace-session';

type CreationMode = 'agent' | 'image' | 'video' | 'music' | 'motion';

interface CreationModeDef {
  id: CreationMode;
  label: string;
  icon: React.ReactNode;
  /** 已接入真实能力的现有 section；为空表示由 Agent skill 统一编排。 */
  section?: string;
}

// 图片进入独立工作区；视频复用下方已经验收的 ViMAX 短剧状态机。
const CREATION_MODES: CreationModeDef[] = [
  { id: 'agent', label: 'Agent 模式', icon: <Sparkles className="h-4 w-4" /> },
  { id: 'image', label: '图片生成', icon: <ImageIcon className="h-4 w-4" />, section: 'image' },
  { id: 'video', label: '视频生成', icon: <Video className="h-4 w-4" /> },
  { id: 'music', label: '音乐生成', icon: <Music className="h-4 w-4" /> },
  { id: 'motion', label: '动作模仿', icon: <Footprints className="h-4 w-4" /> },
];

function parseVimaxDurationSpec(text: string) {
  const totalMatch = /(\d{1,3})\s*(秒|s|S)/.exec(text);
  const compact = text.replace(/\s+/g, '');
  const clipSpecMatch =
    /(\d{1,2})(?:个|段|条)(\d{1,2})(?:秒|s|S)(?:clip|Clip|CLIP|镜头|分镜|片段)?/.exec(compact)
    || /(\d{1,2})(?:个|段|条)?(?:clip|Clip|CLIP|镜头|分镜|片段)(?:，|,|、)?(?:每(?:个|段|条)?)?(\d{1,2})(?:秒|s|S)/.exec(compact);
  const clipCount = clipSpecMatch ? Number(clipSpecMatch[1]) : undefined;
  const explicitSegmentDuration = clipSpecMatch ? Number(clipSpecMatch[2]) : undefined;
  const explicitTotal = totalMatch ? Number(totalMatch[1]) : undefined;
  const duration = explicitTotal || (clipCount && explicitSegmentDuration ? clipCount * explicitSegmentDuration : 30);
  const segmentDuration = explicitSegmentDuration || (clipCount ? Math.max(1, Math.round(duration / clipCount)) : (duration <= 30 ? 5 : 10));
  return {
    duration: Math.max(5, Math.min(120, Math.floor(duration))),
    segmentDuration: Math.max(2, Math.min(12, Math.floor(segmentDuration))),
    segmentCount: clipCount || Math.max(1, Math.round(duration / segmentDuration)),
  };
}

interface GenerateWorkspaceProps {
  initialPrompt?: string;
  agentOnly?: boolean;
  availableModes?: CreationMode[];
  showModelSettings?: boolean;
  onNavigate?: (section: string, prompt?: string, transfer?: { imageRefs?: string[] }) => void;
  requestHeaders?: Record<string, string>;
  storageScope?: string;
  resumeTaskId?: string;
  onAuthenticationRequired?: (reason: string) => void;
}

type ProjectAttachmentKind = 'image' | 'video' | 'document';
type ProjectAttachmentItem = {
  id: string;
  projectId: string;
  name: string;
  kind: ProjectAttachmentKind;
  mimeType: string;
  bytes: number;
  order: number;
  url?: string;
  previewUrl?: string;
  status: 'uploading' | 'ready' | 'error';
  progress: number;
  file?: File;
  error?: string;
};

function releaseProjectAttachmentPreviews(attachments: ProjectAttachmentItem[]): void {
  for (const attachment of attachments) {
    if (attachment.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(attachment.previewUrl);
  }
}

export function GenerateWorkspace({
  initialPrompt,
  agentOnly = false,
  availableModes,
  showModelSettings = true,
  onNavigate,
  requestHeaders,
  storageScope,
  resumeTaskId,
  onAuthenticationRequired,
}: GenerateWorkspaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialPrompt || '');
  const [mode, setMode] = useState<CreationMode>('agent');
  const [isLoading, setIsLoading] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [mediaModelMenuOpen, setMediaModelMenuOpen] = useState(false);
  const [selectedReferences, setSelectedReferences] = useState<ProjectAttachmentItem[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [selectedRatio, setSelectedRatio] = useState('16:9');
  const [selectedQuality, setSelectedQuality] = useState('高清');
  const skillScope = storageScope || '';
  const [skillSelection, setSkillSelection] = useState(() => {
    const preset = typeof window === 'undefined' ? resolveVimaxSkillPreset() : loadVimaxSkillPreset(localStorage, skillScope);
    return { scope: skillScope, id: preset.id };
  });
  const [history, setHistory] = useState<ChatHistoryEntry[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [restoredScope, setRestoredScope] = useState<string | null>(null);
  const restoredScopeRef = useRef<string | null>(null);
  const recoveredTaskRef = useRef<string | null>(null);
  const repairedRenderTaskRef = useRef<string | null>(null);
  const [ignoreResumeTask, setIgnoreResumeTask] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<VimaxWorkspaceView>('home');
  useEffect(() => {
    setSkillSelection({ scope: skillScope, id: loadVimaxSkillPreset(localStorage, skillScope).id });
    setSkillSearch('');
  }, [skillScope, storageScope]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);
  const restoredReferenceProjectRef = useRef<string | null>(null);
  const selectedReferencesRef = useRef<ProjectAttachmentItem[]>([]);
  const attachmentRequestsRef = useRef(new Map<string, XMLHttpRequest>());
  const selectedSkill = resolveVimaxSkillPreset(skillSelection.scope === skillScope ? skillSelection.id : undefined);
  const visibleSkillPresets = searchVimaxSkillPresets(skillSearch);
  const projects = summarizeVimaxProjects(history);
  const activeProject = activeProjectId ? history.find(project => project.id === activeProjectId) : null;
  const activeTitle = activeProject?.title
    || messages.find(message => message.role === 'user')?.content.slice(0, 30)
    || '未命名创作';
  const effectiveRequestHeaders = useMemo(() => ({ ...(requestHeaders || {}) }), [requestHeaders]);
  const referenceUploading = selectedReferences.some(reference => reference.status === 'uploading');
  const recoverableTaskId = useMemo(() => (
    resolveVimaxTaskId(messages, resumeTaskId, ignoreResumeTask)
  ), [ignoreResumeTask, messages, resumeTaskId]);

  const setScopedWorkspaceView = useCallback((view: VimaxWorkspaceView) => {
    setWorkspaceView(view);
    if (typeof window !== 'undefined') saveVimaxWorkspaceView(sessionStorage, storageScope, view);
  }, [storageScope]);

  const selectSkillPreset = useCallback((skillId: string) => {
    const preset = saveVimaxSkillPreset(localStorage, skillScope, skillId);
    setSkillSelection({ scope: skillScope, id: preset.id });
    setMode('agent');
    setInput(preset.prompt);
    setSkillSearch('');
    setSkillMenuOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [skillScope]);

  const activateVideoCreationMode = useCallback(() => {
    const preset = saveVimaxSkillPreset(localStorage, skillScope, 'short-drama');
    setSkillSelection({ scope: skillScope, id: preset.id });
    setSkillSearch('');
    setSkillMenuOpen(false);
    setMode('video');
    setInput(current => current.trim() ? current : preset.prompt);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [skillScope]);

  const restoreSkillPreset = useCallback((skillId?: string | null) => {
    if (!skillId) return;
    const preset = saveVimaxSkillPreset(localStorage, skillScope, skillId);
    setSkillSelection({ scope: skillScope, id: preset.id });
  }, [skillScope]);

  const restoreProjectSkillPreset = useCallback((projectMessages: ChatMessage[]) => {
    restoreSkillPreset(resolveVimaxProjectPresetId(projectMessages));
  }, [restoreSkillPreset]);

  // 自动保存当前对话到 localStorage，刷新后最近列表可见
  useEffect(() => {
    if (restoredScope !== (storageScope || '')) return;
    saveMessages(messages, storageScope);
    if (messages.length > 0) {
      const currentId = activeProjectId || messages[0]?.id || genId();
      if (!activeProjectId) {
        setActiveProjectId(currentId);
        saveActiveVimaxProjectId(sessionStorage, storageScope, currentId);
      }
      setHistory(prev => {
        const next = upsertVimaxProjectMessages(prev, currentId, messages);
        saveChatHistory(next, storageScope);
        return next;
      });
    }
  }, [activeProjectId, messages, restoredScope, storageScope]);

  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const runCoordinatorRef = useRef<ReturnType<typeof createVimaxRunCoordinator> | null>(null);
  if (!runCoordinatorRef.current) runCoordinatorRef.current = createVimaxRunCoordinator();
  const runCoordinator = runCoordinatorRef.current;
  const handleTaskIdAvailable = useCallback((taskId: string) => {
    const recoveryKey = `${storageScope || ''}:${taskId}`;
    recoveredTaskRef.current = recoveryKey;
    setIgnoreResumeTask(true);
    window.history.replaceState(window.history.state, '', buildVimaxTaskUrl(window.location.href, taskId));
  }, [storageScope]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (workspaceView !== 'project') return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, workspaceView]);

  const { handlePlanStep, handleReferenceAssetsStep, handleVideoStep, cancelCurrentRun } = useVimaxShortDramaSkill({
    messagesRef,
    setMessages,
    setIsLoading,
    setInputValue: setInput,
    setCurrentStep: () => {},
    runCoordinator,
    requestHeaders: effectiveRequestHeaders,
    onAuthenticationRequired,
    onTaskIdAvailable: handleTaskIdAvailable,
  });

  useEffect(() => {
    cancelCurrentRun();
    const recoveredMessages = recoverVimaxProjectMessages(loadMessages(storageScope) || []);
    const recoveredHistory = loadChatHistory(storageScope);
    const recoveredProjectId = loadActiveVimaxProjectId(sessionStorage, storageScope);
    setMessages(recoveredMessages);
    restoreProjectSkillPreset(recoveredMessages);
    setHistory(recoveredHistory);
    setActiveProjectId(recoveredProjectId && recoveredHistory.some(entry => entry.id === recoveredProjectId)
      ? recoveredProjectId
      : recoveredMessages[0]?.id || null);
    setWorkspaceView(currentView => restoreVimaxWorkspaceView(
      sessionStorage,
      restoredScopeRef.current,
      storageScope,
      currentView,
    ));
    setIsLoading(false);
    restoredScopeRef.current = storageScope || '';
    setRestoredScope(restoredScopeRef.current);
  }, [cancelCurrentRun, restoreProjectSkillPreset, storageScope]);

  useEffect(() => {
    if (restoredScope !== (storageScope || '') || !activeProjectId) return;
    const projectKey = `${storageScope || 'default'}:${activeProjectId}`;
    if (restoredReferenceProjectRef.current === projectKey) return;
    let cancelled = false;
    void clientApiFetch<{ attachments?: Array<Omit<ProjectAttachmentItem, 'status' | 'progress'>> }>(
      `/api/project-attachments?projectId=${encodeURIComponent(activeProjectId)}`,
      {
      headers: effectiveRequestHeaders,
      redirectOnUnauthorized: false,
      },
    ).then(async payload => {
      const restored = await Promise.all((payload.attachments || []).map(async attachment => {
        let previewUrl: string | undefined;
        if (attachment.kind === 'image' && attachment.url) {
          try {
            const blob = await clientApiDownloadBlob(attachment.url, {
              headers: effectiveRequestHeaders,
              redirectOnUnauthorized: false,
            });
            previewUrl = URL.createObjectURL(blob);
          } catch {
            previewUrl = undefined;
          }
        }
        return {
          ...attachment,
          previewUrl,
          status: 'ready' as const,
          progress: 100,
        };
      }));
      if (cancelled) {
        releaseProjectAttachmentPreviews(restored);
        return;
      }
      releaseProjectAttachmentPreviews(selectedReferencesRef.current);
      selectedReferencesRef.current = restored;
      setSelectedReferences(restored);
      setReferenceError(null);
      restoredReferenceProjectRef.current = projectKey;
    }).catch(error => {
      if (cancelled) return;
      setReferenceError(error instanceof Error ? error.message : '项目素材恢复失败');
      restoredReferenceProjectRef.current = projectKey;
    });
    return () => { cancelled = true; };
  }, [activeProjectId, effectiveRequestHeaders, restoredScope, storageScope]);

  useEffect(() => () => {
    releaseProjectAttachmentPreviews(selectedReferencesRef.current);
  }, []);

  useEffect(() => {
    if (!recoverableTaskId || restoredScope !== (storageScope || '')) return;
    const recoveryKey = `${storageScope || ''}:${recoverableTaskId}`;
    if (recoveredTaskRef.current === recoveryKey) return;
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const recover = async () => {
      try {
        const payload = await clientApiFetch<{ task?: unknown }>(`/api/tasks/${encodeURIComponent(recoverableTaskId)}`, {
          headers: effectiveRequestHeaders,
          signal: controller.signal,
          redirectOnUnauthorized: false,
        });
        if (controller.signal.aborted
          || (recoveredTaskRef.current && recoveredTaskRef.current !== recoveryKey)) return;
        let recovered = recoverVimaxTaskProject(payload.task);
        if (!recovered
          && needsPersistedVimaxRenderRecovery(payload.task)
          && repairedRenderTaskRef.current !== recoveryKey) {
          repairedRenderTaskRef.current = recoveryKey;
          const repair = await clientApiFetch<{ productionPlan?: unknown }>(
            `/api/tasks/${encodeURIComponent(recoverableTaskId)}`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json', ...effectiveRequestHeaders },
              body: JSON.stringify({ action: 'recover-production-render' }),
              signal: controller.signal,
              redirectOnUnauthorized: false,
            },
          );
          recovered = recoverVimaxTaskProject(
            applyRecoveredVimaxProductionPlan(payload.task, repair.productionPlan),
          );
        }
        if (controller.signal.aborted
          || (recoveredTaskRef.current && recoveredTaskRef.current !== recoveryKey)) return;
        if (!recovered) {
          if (!controller.signal.aborted) retryTimer = setTimeout(recover, 3_000);
          return;
        }
        recoveredTaskRef.current = recoveryKey;
        cancelCurrentRun();
        setIsLoading(false);
        setActiveProjectId(recovered.project.id);
        saveActiveVimaxProjectId(sessionStorage, storageScope, recovered.project.id);
        setMessages(recovered.messages);
        restoreProjectSkillPreset(recovered.messages);
        setHistory(previous => {
          const next = [recovered.project, ...previous.filter(item => item.id !== recovered.project.id)].slice(0, 20);
          saveChatHistory(next, storageScope);
          return next;
        });
        setScopedWorkspaceView('project');
      } catch {
        // The task route is owner-scoped; unknown or foreign task ids fail closed.
      }
    };
    if (shouldClearCachedVimaxProject(messages, resumeTaskId, recoverableTaskId)) {
      setMessages([]);
      setIsLoading(true);
      setScopedWorkspaceView('project');
    }
    void recover();
    return () => {
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    cancelCurrentRun,
    effectiveRequestHeaders,
    restoreProjectSkillPreset,
    restoredScope,
    recoverableTaskId,
    messages,
    resumeTaskId,
    setScopedWorkspaceView,
    storageScope,
  ]);

  const startNewChat = useCallback(() => {
    cancelCurrentRun();
    const projectId = genId();
    setActiveProjectId(projectId);
    saveActiveVimaxProjectId(sessionStorage, storageScope, projectId);
    setHistory(previous => {
      const next = createVimaxProject(previous, projectId);
      saveChatHistory(next, storageScope);
      return next;
    });
    setMessages([]);
    setInput('');
    attachmentRequestsRef.current.forEach(request => request.abort());
    attachmentRequestsRef.current.clear();
    releaseProjectAttachmentPreviews(selectedReferencesRef.current);
    selectedReferencesRef.current = [];
    setSelectedReferences([]);
    setReferenceError(null);
    setIgnoreResumeTask(true);
    recoveredTaskRef.current = null;
    window.history.replaceState(window.history.state, '', buildVimaxTaskUrl(window.location.href));
    setScopedWorkspaceView('project');
  }, [cancelCurrentRun, setScopedWorkspaceView, storageScope]);

  const openHistoryProject = useCallback((projectId: string) => {
    const entry = history.find(item => item.id === projectId);
    if (!entry) return;
    cancelCurrentRun();
    setIsLoading(false);
    setIgnoreResumeTask(true);
    recoveredTaskRef.current = null;
    window.history.replaceState(window.history.state, '', buildVimaxTaskUrl(window.location.href));
    setActiveProjectId(projectId);
    saveActiveVimaxProjectId(sessionStorage, storageScope, projectId);
    const recoveredMessages = recoverVimaxProjectMessages(entry.messages || []);
    setMessages(recoveredMessages);
    restoreProjectSkillPreset(recoveredMessages);
    setScopedWorkspaceView('project');
  }, [cancelCurrentRun, history, restoreProjectSkillPreset, setScopedWorkspaceView, storageScope]);

  const renameActiveProject = useCallback((title: string) => {
    if (!activeProjectId) return;
    setHistory(previous => {
      const next = renameVimaxProject(previous, activeProjectId, title);
      saveChatHistory(next, storageScope);
      return next;
    });
  }, [activeProjectId, storageScope]);

  const deleteProject = useCallback((projectId: string) => {
    const projectAttachments = projectId === activeProjectId
      ? selectedReferencesRef.current.filter(attachment => attachment.status === 'ready')
      : [];
    void Promise.allSettled(projectAttachments.map(attachment => clientApiFetch(
      `/api/project-attachments/${encodeURIComponent(attachment.id)}?projectId=${encodeURIComponent(projectId)}`,
      {
        method: 'DELETE',
        headers: effectiveRequestHeaders,
        redirectOnUnauthorized: false,
      },
    )));
    setHistory(previous => {
      const next = deleteVimaxProject(previous, projectId);
      saveChatHistory(next, storageScope);
      return next;
    });
    if (projectId !== activeProjectId) return;
    cancelCurrentRun();
    setIsLoading(false);
    setActiveProjectId(null);
    saveActiveVimaxProjectId(sessionStorage, storageScope, '');
    setMessages([]);
    saveMessages([], storageScope);
    setInput('');
    attachmentRequestsRef.current.forEach(request => request.abort());
    attachmentRequestsRef.current.clear();
    releaseProjectAttachmentPreviews(selectedReferencesRef.current);
    selectedReferencesRef.current = [];
    setSelectedReferences([]);
    setScopedWorkspaceView('home');
  }, [activeProjectId, cancelCurrentRun, effectiveRequestHeaders, setScopedWorkspaceView, storageScope]);

  const visibleCreationModes = availableModes
    ? CREATION_MODES.filter(item => availableModes.includes(item.id))
    : CREATION_MODES;
  const activeMode = visibleCreationModes.find(item => item.id === mode)
    || visibleCreationModes[0]
    || CREATION_MODES[0];

  const ensureProjectForAttachments = useCallback(() => {
    if (activeProjectId) return activeProjectId;
    const projectId = genId();
    setActiveProjectId(projectId);
    saveActiveVimaxProjectId(sessionStorage, storageScope, projectId);
    setHistory(previous => {
      const next = createVimaxProject(previous, projectId);
      saveChatHistory(next, storageScope);
      return next;
    });
    restoredReferenceProjectRef.current = `${storageScope || 'default'}:${projectId}`;
    setScopedWorkspaceView('project');
    return projectId;
  }, [activeProjectId, setScopedWorkspaceView, storageScope]);

  const persistProjectAttachmentOrder = useCallback(async (
    projectId: string,
    attachments: ProjectAttachmentItem[],
  ) => {
    const orderedIds = attachments
      .filter(attachment => attachment.status === 'ready')
      .map(attachment => attachment.id);
    if (orderedIds.length === 0) return;
    await clientApiFetch('/api/project-attachments', {
      method: 'PATCH',
      headers: effectiveRequestHeaders,
      body: JSON.stringify({ projectId, orderedIds }),
      redirectOnUnauthorized: false,
    });
  }, [effectiveRequestHeaders]);

  const uploadProjectAttachment = useCallback((
    projectId: string,
    localId: string,
    file: File,
  ) => new Promise<ProjectAttachmentItem>((resolve, reject) => {
    const form = new FormData();
    form.set('projectId', projectId);
    form.set('file', file);
    const request = new XMLHttpRequest();
    attachmentRequestsRef.current.set(localId, request);
    request.open('POST', clientApiPath('/api/project-attachments'));
    request.withCredentials = true;
    for (const [name, value] of Object.entries({
      ...accountAuthHeaders(),
      ...effectiveRequestHeaders,
    })) request.setRequestHeader(name, value);
    request.upload.onprogress = event => {
      if (!event.lengthComputable) return;
      const progress = Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100)));
      const next = selectedReferencesRef.current.map(attachment => (
        attachment.id === localId ? { ...attachment, progress } : attachment
      ));
      selectedReferencesRef.current = next;
      setSelectedReferences(next);
    };
    request.onerror = () => reject(new Error('项目素材上传失败，请重试。'));
    request.onabort = () => reject(new Error('项目素材上传已取消。'));
    request.onload = () => {
      let payload: { attachment?: Omit<ProjectAttachmentItem, 'status' | 'progress'>; error?: string } = {};
      try {
        payload = JSON.parse(request.responseText || '{}') as typeof payload;
      } catch {
        reject(new Error('项目素材上传返回无效。'));
        return;
      }
      if (request.status < 200 || request.status >= 300 || !payload.attachment) {
        reject(new Error(payload.error || '项目素材上传失败，请重试。'));
        return;
      }
      resolve({ ...payload.attachment, status: 'ready', progress: 100 });
    };
    request.onloadend = () => attachmentRequestsRef.current.delete(localId);
    request.send(form);
  }), [effectiveRequestHeaders]);

  const commitUploadedAttachment = useCallback(async (
    localId: string,
    uploaded: ProjectAttachmentItem,
  ) => {
    const existing = selectedReferencesRef.current.find(attachment => attachment.id === localId);
    const committed = {
      ...uploaded,
      previewUrl: existing?.previewUrl,
      file: existing?.file,
    };
    const next = selectedReferencesRef.current.map(attachment => (
      attachment.id === localId ? committed : attachment
    ));
    selectedReferencesRef.current = next;
    setSelectedReferences(next);
    await persistProjectAttachmentOrder(committed.projectId, next);
  }, [persistProjectAttachmentOrder]);

  const retryProjectAttachment = useCallback(async (localId: string) => {
    const item = selectedReferencesRef.current.find(attachment => attachment.id === localId);
    if (!item?.file || item.status === 'uploading') return;
    const uploading = { ...item, status: 'uploading' as const, progress: 0, error: undefined };
    const next = selectedReferencesRef.current.map(attachment => (
      attachment.id === localId ? uploading : attachment
    ));
    selectedReferencesRef.current = next;
    setSelectedReferences(next);
    try {
      await commitUploadedAttachment(localId, await uploadProjectAttachment(item.projectId, localId, item.file));
    } catch (error) {
      const failed = selectedReferencesRef.current.map(attachment => (
        attachment.id === localId
          ? {
            ...attachment,
            status: 'error' as const,
            progress: 0,
            error: error instanceof Error ? error.message : '项目素材上传失败，请重试。',
          }
          : attachment
      ));
      selectedReferencesRef.current = failed;
      setSelectedReferences(failed);
    }
  }, [commitUploadedAttachment, uploadProjectAttachment]);

  const uploadProjectAttachments = useCallback(async (files: File[]) => {
    const remaining = Math.max(0, 12 - selectedReferencesRef.current.length);
    const accepted = files.slice(0, remaining);
    if (accepted.length === 0) {
      setReferenceError('每个项目最多添加 12 个素材。');
      return;
    }
    const projectId = ensureProjectForAttachments();
    const pending = accepted.map((file, index): ProjectAttachmentItem => ({
      id: `pending-${genId()}`,
      projectId,
      name: file.name,
      kind: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
      mimeType: file.type,
      bytes: file.size,
      order: selectedReferencesRef.current.length + index,
      status: 'uploading',
      progress: 0,
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    const next = [...selectedReferencesRef.current, ...pending];
    selectedReferencesRef.current = next;
    setSelectedReferences(next);
    setReferenceError(files.length > accepted.length ? '最多保留前 12 个素材。' : null);

    for (const item of pending) {
      try {
        await commitUploadedAttachment(
          item.id,
          await uploadProjectAttachment(projectId, item.id, item.file!),
        );
      } catch (error) {
        const failed = selectedReferencesRef.current.map(attachment => (
          attachment.id === item.id
            ? {
              ...attachment,
              status: 'error' as const,
              progress: 0,
              error: error instanceof Error ? error.message : '项目素材上传失败，请重试。',
            }
            : attachment
        ));
        selectedReferencesRef.current = failed;
        setSelectedReferences(failed);
      }
    }
    if (referenceInputRef.current) referenceInputRef.current.value = '';
  }, [commitUploadedAttachment, ensureProjectForAttachments, uploadProjectAttachment]);

  const moveProjectAttachment = useCallback(async (attachmentId: string, direction: -1 | 1) => {
    const current = selectedReferencesRef.current;
    const index = current.findIndex(attachment => attachment.id === attachmentId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    selectedReferencesRef.current = next;
    setSelectedReferences(next);
    const projectId = next.find(attachment => attachment.status === 'ready')?.projectId;
    if (!projectId) return;
    try {
      await persistProjectAttachmentOrder(projectId, next);
    } catch {
      setReferenceError('素材顺序保存失败，请重试。');
    }
  }, [persistProjectAttachmentOrder]);

  const removeProjectAttachment = useCallback(async (attachmentId: string) => {
    const item = selectedReferencesRef.current.find(attachment => attachment.id === attachmentId);
    if (!item) return;
    attachmentRequestsRef.current.get(attachmentId)?.abort();
    if (item.status === 'ready') {
      try {
        await clientApiFetch(
          `/api/project-attachments/${encodeURIComponent(item.id)}?projectId=${encodeURIComponent(item.projectId)}`,
          {
            method: 'DELETE',
            headers: effectiveRequestHeaders,
            redirectOnUnauthorized: false,
          },
        );
      } catch {
        setReferenceError('项目素材删除失败，请重试。');
        return;
      }
    }
    releaseProjectAttachmentPreviews([item]);
    const next = selectedReferencesRef.current.filter(attachment => attachment.id !== attachmentId);
    selectedReferencesRef.current = next;
    setSelectedReferences(next);
  }, [effectiveRequestHeaders]);

  const handleSend = useCallback(async (overrideText?: string, overrideSkillId?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;
    setScopedWorkspaceView('project');
    const requestSkill = resolveVimaxSkillPreset(
      overrideSkillId || (mode === 'video' ? 'short-drama' : selectedSkill.id),
    );

    if (mode === 'agent' || mode === 'video') {
      if (/继续查看成片/.test(text)) {
        setMessages(prev => [...prev, { id: genId(), role: 'user', content: text, timestamp: Date.now() }]);
        setInput('');
        await handleVideoStep({ resume: true });
        return;
      }
      if (/取消成片/.test(text)) {
        setMessages(prev => [...prev, { id: genId(), role: 'user', content: text, timestamp: Date.now() }]);
        setInput('');
        await handleVideoStep({ cancel: true });
        return;
      }
      if (/找回已完成片段/.test(text)) {
        setMessages(prev => [...prev, { id: genId(), role: 'user', content: text, timestamp: Date.now() }]);
        setInput('');
        await handleVideoStep({ recover: true });
        return;
      }
      // 点击“确认开始生成 / 重做视频” -> 真实调用当前视频供应商生成完整短剧
      if (/确认开始生成|重做视频/.test(text)) {
        setMessages(prev => [...prev, { id: genId(), role: 'user', content: text, timestamp: Date.now() }]);
        setInput('');
        await handleVideoStep();
        return;
      }
      if (/确认镜头路线/.test(text)) {
        setMessages(prev => [...prev, { id: genId(), role: 'user', content: text, timestamp: Date.now() }]);
        setInput('');
        await handleVideoStep({ confirmRouteDecisions: true });
        return;
      }
      if (/继续查看参考图/.test(text)) {
        setMessages(prev => [...prev, { id: genId(), role: 'user', content: text, timestamp: Date.now() }]);
        setInput('');
        await handleReferenceAssetsStep({ recover: true });
        return;
      }
      if (/取消参考图/.test(text)) {
        setMessages(prev => [...prev, { id: genId(), role: 'user', content: text, timestamp: Date.now() }]);
        setInput('');
        await handleReferenceAssetsStep({ cancel: true });
        return;
      }
      // 点击“确认参考图，继续生成视频” -> 进入视频费用确认，不重复生成参考图
      if (/继续生成视频|生成视频/.test(text)) {
        const routingCostDetail = '将按已确认的分镜逐段制作并合成为完整短剧，不会额外增加镜头。';
        setMessages(prev => [...prev, { id: genId(), role: 'user', content: text, timestamp: Date.now() }]);
        setInput('');
        setMessages(prev => [...prev, {
          id: genId(),
          role: 'assistant',
          content: `视频生成会真实调用已连接的视频模型（按真实费用计费）。${routingCostDetail}确认后会按分镜逐段生成，并自动合成为完整短剧，预计 4-10 分钟。`,
          timestamp: Date.now(),
          vimaxAgent: {
            phase: 'video_cost_confirm',
            title: '视频生成费用确认',
            summary: routingCostDetail,
            model: '已连接视频模型',
            costState: 'not-yet',
            nextAction: '点击“确认开始生成”后开始真实调用视频模型。',
          },
          quickOptions: ['确认开始生成', '先调整分镜', '取消'],
        }]);
        return;
      }
      if (VIMAX_REFERENCE_CONFIRM_REGEX.test(text) || /确认分镜|生成参考图/.test(text)) {
        setMessages(prev => [...prev, { id: genId(), role: 'user', content: text, timestamp: Date.now() }]);
        setInput('');
        await handleReferenceAssetsStep();
        return;
      }
      const durationSpec = parseVimaxDurationSpec(text);
      const generationSettings = resolveVimaxGenerationSettings({
        model: VIMAX_PLAN_MODEL,
        ratio: selectedRatio,
        quality: selectedQuality,
      });
      await handlePlanStep({
        prompt: text,
        duration: durationSpec.duration,
        segmentDuration: durationSpec.segmentDuration,
        segmentCount: durationSpec.segmentCount,
        style: requestSkill.style,
        skillId: requestSkill.id,
        sceneType: requestSkill.sceneType,
        settings: generationSettings,
        projectId: activeProjectId || undefined,
        projectAttachmentIds: selectedReferencesRef.current
          .filter(reference => reference.status === 'ready')
          .map(reference => reference.id),
      });
      return;
    }

    // 其它创作类型走各自真实能力（现有 section），不在此处伪造结果。
    if (activeMode.section && onNavigate) {
      onNavigate(activeMode.section, text);
      return;
    }
    setMessages(prev => [...prev, {
      id: genId(),
      role: 'assistant',
      content: `「${activeMode.label}」当前未开放。请使用 Agent、图片生成或视频生成。`,
      timestamp: Date.now(),
    }]);
    setInput('');
  }, [activeProjectId, input, isLoading, mode, activeMode, onNavigate, handlePlanStep, handleReferenceAssetsStep, handleVideoStep, selectedRatio, selectedQuality, selectedSkill, setScopedWorkspaceView]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const hasMessages = messages.length > 0;
  const latestCompletedVideoIndex = messages.reduce((latest, message, index) => (
    message.generatedVideo?.url ? index : latest
  ), -1);

  const handleQuickOption = useCallback((value: string) => {
    if (value === '重新生成') {
      const lastPrompt = [...messages].reverse().find(message => message.role === 'user')?.content?.trim();
      if (!lastPrompt) return;
      setInput(lastPrompt);
      setTimeout(() => handleSend(lastPrompt), 50);
      return;
    }
    if (value === '查看成片') {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      return;
    }
    setInput(value);
    setTimeout(() => handleSend(value), 50);
  }, [handleSend, messages]);

  const handleResultIteration = useCallback((messageId: string, action: 'edit' | 'regenerate') => {
    const context = resolveVimaxResultIteration(messages, messageId);
    if (!context) return;
    restoreSkillPreset(context.presetId);
    if (action === 'edit') {
      setInput(buildVimaxContinueEditPrompt(context));
      setTimeout(() => textareaRef.current?.focus(), 0);
      return;
    }
    void handleSend(context.sourcePrompt, context.presetId);
  }, [handleSend, messages, restoreSkillPreset]);

  const modelSettings = showModelSettings ? <BailianConnectionControl /> : null;

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[#090d15] text-slate-100">
      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {workspaceView === 'home' ? (
            <VimaxProjectHome
              projects={projects}
              skills={visibleSkillPresets}
              selectedSkillId={selectedSkill.id}
              composer={renderDock()}
              actions={modelSettings}
              onOpenProject={openHistoryProject}
              onDeleteProject={deleteProject}
              onStartProject={startNewChat}
              onSelectSkill={selectSkillPreset}
            />
          ) : (
            <>
              <VimaxProjectBar
                title={activeTitle}
                onBack={() => setScopedWorkspaceView('home')}
                onNewProject={startNewChat}
                onRenameProject={renameActiveProject}
                actions={modelSettings}
              />
              <div className="mx-auto w-full max-w-[1040px] px-6 py-8">
                {hasMessages ? (
                  <div className="space-y-5">
                    {messages.map((message, index) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        onQuickOption={handleQuickOption}
                        onResultIteration={handleResultIteration}
                        onProductionPlanChange={(productionPlan) => setMessages(current => current.map(candidate => (
                          candidate.id === message.id && candidate.vimaxAgent
                            ? { ...candidate, vimaxAgent: { ...candidate.vimaxAgent, productionPlan } }
                            : candidate
                        )))}
                        requestHeaders={effectiveRequestHeaders}
                        hideQuickOptions={latestCompletedVideoIndex > index}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[48vh] flex-col items-center justify-center text-center">
                    <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#dfe5ed] bg-white text-[#2f6bff] shadow-[0_8px_24px_rgba(31,41,55,0.06)]">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <h2 className="text-xl font-semibold tracking-[-0.025em] text-[#20232a]">把故事讲给绘影</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-[#858c97]">
                      写下一个故事、粘贴剧本，或直接上传参考素材。绘影会先和你确认，再开始制作。
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {workspaceView === 'project' && (
          <div className="border-t border-[#e6e9ee] bg-white/88 backdrop-blur-xl">
            <div className="mx-auto max-w-[1040px] px-6 py-3">{renderDock()}</div>
          </div>
        )}
      </div>
    </div>
  );

  function renderDock() {
    return (
      <div
        data-testid="creation-agent-composer"
        className="rounded-lg border border-white/[0.11] bg-[#101620] p-3 shadow-[0_18px_48px_rgba(0,0,0,0.24)] transition focus-within:border-[#557fdc]/70 focus-within:bg-[#111925] focus-within:shadow-[0_22px_54px_rgba(0,0,0,0.3)]"
      >
        {selectedReferences.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2" aria-label="已添加项目素材">
            {selectedReferences.map((reference, index) => (
              <span
                key={reference.id}
                className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.045] py-1 pl-1 pr-1.5 text-xs text-slate-300"
              >
                {reference.kind === 'image' && reference.previewUrl
                  ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={reference.previewUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                  )
                  : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.06]">
                      {reference.kind === 'video'
                        ? <Video className="h-4 w-4" />
                        : reference.kind === 'image'
                          ? <ImageIcon className="h-4 w-4" />
                          : <FileJson className="h-4 w-4" />}
                    </span>
                  )}
                <span className="min-w-0">
                  <span className="block max-w-28 truncate">{reference.name}</span>
                  <span className={reference.status === 'error' ? 'text-rose-400' : 'text-slate-500'}>
                    {reference.status === 'uploading'
                      ? `上传中 ${reference.progress}%`
                      : reference.status === 'error'
                        ? '上传失败'
                        : reference.kind === 'image'
                          ? '图片'
                          : reference.kind === 'video'
                            ? '视频'
                            : '文档'}
                  </span>
                </span>
                {reference.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => void retryProjectAttachment(reference.id)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-rose-300 transition hover:bg-rose-400/10 hover:text-rose-200"
                    aria-label={`重试 ${reference.name}`}
                    title={reference.error}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void moveProjectAttachment(reference.id, -1)}
                  disabled={index === 0}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-slate-200 disabled:opacity-25"
                  aria-label={`前移 ${reference.name}`}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void moveProjectAttachment(reference.id, 1)}
                  disabled={index === selectedReferences.length - 1}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-slate-200 disabled:opacity-25"
                  aria-label={`后移 ${reference.name}`}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void removeProjectAttachment(reference.id)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-slate-200"
                  aria-label={`移除 ${reference.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        {referenceError && <p className="mb-2 text-xs text-rose-400">{referenceError}</p>}
        <div className="flex items-start gap-2">
          <div className="mt-1 flex shrink-0 items-center gap-1">
            <input
              ref={referenceInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,text/markdown"
              multiple
              className="hidden"
              onChange={event => {
                const files = Array.from(event.target.files || []);
                if (files.length > 0) void uploadProjectAttachments(files);
              }}
            />
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-400 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-[#8eb1ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e8dff]/45 disabled:opacity-40"
              title="添加图片、视频或文档"
              aria-label="添加项目素材"
              type="button"
              disabled={selectedReferences.length >= 12}
              onClick={() => referenceInputRef.current?.click()}
            >
              {referenceUploading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Plus className="h-4 w-4" />}
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="写下故事、粘贴剧本，或上传参考素材"
            className="min-h-[58px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative">
            {!agentOnly ? (
              <button
                type="button"
                onClick={() => { setSkillMenuOpen(false); setMediaModelMenuOpen(false); setModeMenuOpen(open => !open); }}
                className="flex items-center gap-1.5 rounded-lg bg-[#edf3ff] px-2.5 py-1.5 text-xs font-medium text-[#2f6bff] ring-1 ring-[#c9d8ff] transition hover:bg-[#e3edff]"
              >
                {activeMode.icon}
                {activeMode.label}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {!agentOnly && modeMenuOpen && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-44 overflow-hidden rounded-xl border border-[#e1e5eb] bg-white p-1 text-[#252931] shadow-[0_18px_38px_rgba(31,41,55,0.14)]">
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9299a4]">创作类型</p>
                {visibleCreationModes.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setModeMenuOpen(false);
                      if (item.id === 'video') {
                        activateVideoCreationMode();
                        return;
                      }
                      // 独立能力页（当前仅图片）直接进入；视频留在同一短剧项目状态机。
                      if (item.id !== 'agent' && item.section && onNavigate) {
                        onNavigate(
                          item.section,
                          input.trim() || undefined,
                          {
                            imageRefs: selectedReferences
                              .filter(reference => (
                                reference.status === 'ready'
                                && reference.kind === 'image'
                                && Boolean(reference.url)
                              ))
                              .map(reference => reference.url!),
                          },
                        );
                        return;
                      }
                      setMode(item.id);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      mode === item.id ? 'bg-[#edf3ff] text-[#2f6bff]' : 'text-[#555d68] hover:bg-[#f5f7fa]'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => { setModeMenuOpen(false); setSkillMenuOpen(false); setMediaModelMenuOpen(open => !open); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-400 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-slate-100"
              aria-label="画面规格"
              title="画面规格"
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </button>
            {mediaModelMenuOpen && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-56 overflow-hidden rounded-xl border border-[#e1e5eb] bg-white p-2 text-[#252931] shadow-[0_18px_38px_rgba(31,41,55,0.14)]">
                <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#9299a4]">画面比例</p>
                <div className="flex gap-1.5">
                  {["16:9", "9:16", "1:1", "4:3", "3:4"].map(r => (
                    <button key={r} type="button" onClick={() => setSelectedRatio(r)} className={`rounded-md border px-2 py-1 text-xs transition-colors ${selectedRatio === r ? "border-[#9bb8ff] bg-[#edf3ff] text-[#2f6bff]" : "border-[#e1e5eb] text-[#626a76] hover:bg-[#f5f7fa]"}`}>{r}</button>
                  ))}
                </div>
                <p className="px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[#9299a4]">清晰度</p>
                <div className="flex gap-1.5">
                  {["标清", "高清", "超清"].map(q => (
                    <button key={q} type="button" onClick={() => { setSelectedQuality(q); setMediaModelMenuOpen(false); }} className={`rounded-md border px-2 py-1 text-xs transition-colors ${selectedQuality === q ? "border-[#9bb8ff] bg-[#edf3ff] text-[#2f6bff]" : "border-[#e1e5eb] text-[#626a76] hover:bg-[#f5f7fa]"}`}>{q}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => { setModeMenuOpen(false); setMediaModelMenuOpen(false); setSkillMenuOpen(open => !open); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-400 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-slate-100"
              aria-label="选择成片类型"
              title="选择成片类型"
            >
              <Wand2 className="h-3.5 w-3.5" />
            </button>
            {skillMenuOpen && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-80 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-[#e1e5eb] bg-white p-2 text-[#252931] shadow-[0_18px_38px_rgba(31,41,55,0.14)]">
                <p className="px-1 pb-2 text-[11px] font-semibold text-[#9299a4]">选择成片类型</p>
                <label className="mb-2 flex items-center gap-2 rounded-lg border border-[#e1e5eb] bg-[#f8f9fb] px-2.5 py-2">
                  <Search className="h-3.5 w-3.5 text-[#9299a4]" />
                  <input
                    value={skillSearch}
                    onChange={event => setSkillSearch(event.target.value)}
                    placeholder="搜索短剧、商品片、品牌片…"
                    className="min-w-0 flex-1 bg-transparent text-xs text-[#303640] outline-none placeholder:text-[#a0a6af]"
                  />
                </label>
                <div className="max-h-72 overflow-y-auto">
                {visibleSkillPresets.map(skill => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => selectSkillPreset(skill.id)}
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${selectedSkill.id === skill.id ? 'bg-[#edf3ff]' : 'hover:bg-[#f5f7fa]'}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-[#303640]">{skill.name}</span>
                      <span className="block text-[11px] text-[#8d949f]">{skill.description}</span>
                    </span>
                    {selectedSkill.id === skill.id && <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2f6bff]" />}
                  </button>
                ))}
                {visibleSkillPresets.length === 0 && (
                  <p className="px-2 py-5 text-center text-xs text-[#9299a4]">没有匹配的成片类型</p>
                )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => isLoading ? cancelCurrentRun() : void handleSend()}
            disabled={!isLoading && !input.trim()}
            className={`ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40 ${isLoading ? 'bg-rose-500' : 'bg-[#356df3] shadow-[0_7px_18px_rgba(47,107,255,0.24)]'}`}
            title={isLoading ? '停止生成' : '发送'}
            aria-label={isLoading ? '停止生成' : '发送'}
          >
            {isLoading ? <X className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }
}

function MessageBubble({ message, onQuickOption, onResultIteration, onProductionPlanChange, requestHeaders, hideQuickOptions }: {
  message: ChatMessage;
  onQuickOption: (value: string) => void;
  onResultIteration: (messageId: string, action: 'edit' | 'regenerate') => void;
  onProductionPlanChange: (plan: VimaxProductionPlan) => void;
  requestHeaders?: Record<string, string>;
  hideQuickOptions?: boolean;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#2f6bff] px-4 py-2.5 text-sm text-white shadow-[0_8px_22px_rgba(47,107,255,0.18)]">{message.content}</div>
      </div>
    );
  }

  const agent = message.vimaxAgent;
  const planConfirmation = buildVimaxAgentConfirmationView(message);
  const quickOptions = message.quickOptions?.filter(option => shouldShowVimaxQuickOption(option, agent?.productionPlan));
  const delivery = agent ? buildVimaxResultDelivery(message) : null;
  const manifestName = `${(agent?.title || 'vimax-project').replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '') || 'vimax-project'}-manifest.json`;
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[92%] rounded-2xl rounded-bl-md border border-[#e3e7ed] bg-white px-4 py-3 text-[#252931] shadow-[0_8px_26px_rgba(31,41,55,0.05)]">
        {agent ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-md bg-[#edf3ff] px-2 py-0.5 font-medium text-[#2f6bff]">{agent.title}</span>
            {planConfirmation ? (
              <span className="rounded-md bg-[#f1f3f6] px-2 py-0.5 text-[#68717e]">分镜待确认</span>
            ) : (
              <span className={`rounded-md px-2 py-0.5 ${agent.costState === 'incurred' ? 'bg-amber-500/15 text-amber-500' : agent.costState === 'blocked' ? 'bg-red-500/15 text-red-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                {agent.costState === 'incurred' ? '正在制作' : agent.costState === 'blocked' ? '需要处理' : '尚未开始制作'}
              </span>
            )}
          </div>
        ) : null}

        {planConfirmation ? (
          <div className="space-y-4">
            <section aria-label="创作理解确认" className="rounded-xl border border-[#dfe5ee] bg-[#f8fafc] p-4">
              <p className="text-xs font-semibold text-[#2f6bff]">{planConfirmation.heading}</p>
              <h3 className="mt-1 text-base font-semibold text-[#252b34]">{planConfirmation.title}</h3>
              {planConfirmation.summary ? (
                <p className="mt-2 text-sm leading-6 text-[#535d6a]">{planConfirmation.summary}</p>
              ) : null}
              {Object.values(planConfirmation.story).some(Boolean) ? (
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  {([
                    ['故事起点', planConfirmation.story.premise],
                    ['主角', planConfirmation.story.protagonist],
                    ['目标', planConfirmation.story.goal],
                    ['阻碍', planConfirmation.story.obstacle],
                    ['关键转折', planConfirmation.story.turn],
                    ['结尾钩子', planConfirmation.story.hook],
                  ] as const).map(([label, value]) => value ? (
                    <div key={label} className="rounded-lg border border-[#e4e8ee] bg-white px-3 py-2">
                      <dt className="text-[11px] font-medium text-[#858e9a]">{label}</dt>
                      <dd className="mt-0.5 text-xs leading-5 text-[#3e4652]">{value}</dd>
                    </div>
                  ) : null)}
                </dl>
              ) : null}
              {planConfirmation.anchors.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2" aria-label="故事关键元素">
                  {planConfirmation.anchors.map((anchor, index) => (
                    <span key={`${anchor.kind}-${anchor.label}-${index}`} title={anchor.description} className="rounded-full border border-[#dfe5ee] bg-white px-2.5 py-1 text-[11px] text-[#596270]">
                      {anchor.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>

            <section aria-label="分镜确认" className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#2d3440]">分镜方案</p>
                  <p className="mt-0.5 text-xs text-[#858e9a]">先确认故事和镜头，确认后再准备画面。</p>
                </div>
                <span className="shrink-0 text-xs text-[#68717e]">{planConfirmation.shots.length} 个镜头</span>
              </div>
              <div className="grid gap-2">
                {planConfirmation.shots.map(shot => (
                  <article key={shot.index} className="rounded-xl border border-[#e1e6ed] bg-white px-3.5 py-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs font-semibold text-[#2f6bff]">镜头 {shot.index}</span>
                      <span className="text-sm font-medium text-[#343b46]">{shot.title}</span>
                      <span className="ml-auto text-[11px] text-[#858e9a]">{shot.duration} 秒 · {shot.camera}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-[#596270]">{shot.description}</p>
                    {shot.action ? <p className="mt-1 text-[11px] leading-5 text-[#7b8490]">动作：{shot.action}</p> : null}
                    {shot.dialogue ? <p className="mt-1 text-[11px] leading-5 text-[#596270]">对白：{shot.dialogue}</p> : null}
                    {shot.narration ? <p className="mt-1 text-[11px] leading-5 text-[#596270]">旁白：{shot.narration}</p> : null}
                  </article>
                ))}
              </div>
            </section>

            <div aria-label="下一步确认" className="flex items-center gap-2 rounded-xl border border-[#d8e3ff] bg-[#f5f8ff] px-3.5 py-3 text-xs text-[#52617a]">
              <Check className="h-4 w-4 shrink-0 text-[#2f6bff]" />
              <span>{planConfirmation.nextStep}</span>
            </div>
            {agent?.taskId && agent.productionPlan ? (
              <VimaxPlanConfirmationActions
                taskId={agent.taskId}
                plan={agent.productionPlan}
                requestHeaders={requestHeaders}
                onPlanChange={onProductionPlanChange}
              />
            ) : null}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#303640]">{message.content}</p>
        )}

        {delivery && !planConfirmation ? (
          <div className="mt-3 space-y-3" data-testid="vimax-result-delivery">
            {agent?.productionPlan ? (
              <VimaxProductionPlanCard
                plan={agent.productionPlan}
                taskId={agent.taskId}
                requestHeaders={requestHeaders}
                onPlanChange={onProductionPlanChange}
                finalVideoReady={agent.phase === 'video' && Boolean(message.generatedVideo?.url)}
              />
            ) : null}
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="制作阶段">
              {delivery.stages.map((stage, index) => (
                <li
                  key={stage.id}
                  className={`rounded-lg border px-3 py-2 text-xs ${stage.state === 'completed'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : stage.state === 'active'
                      ? 'border-[#4F6CFF]/35 bg-[#4F6CFF]/10 text-[#3653E7] dark:text-[#70E0FF]'
                      : stage.state === 'failed'
                        ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300'
                        : 'border-[#e2e6ec] bg-[#f7f8fa] text-[#858c97]'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{index + 1}</span>
                    <span>{stage.label}</span>
                    {stage.state === 'completed' ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
                    {stage.state === 'active' ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" /> : null}
                    {stage.state === 'failed' ? <X className="ml-auto h-3.5 w-3.5" /> : null}
                  </div>
                </li>
              ))}
            </ol>

            {delivery.inventory.length > 0 ? (
              <div className="rounded-xl border border-[#e3e7ed] bg-[#f8f9fb] px-3 py-2.5">
                <div className="mb-2 text-xs font-medium text-[#555d68]">制作素材</div>
                <div className="flex flex-wrap gap-1.5">
                  {delivery.inventory.map((item, index) => (
                    <span key={`${item.kind}-${item.label}-${index}`} className="rounded-md border border-[#e1e5eb] bg-white px-2 py-1 text-[11px] text-[#7d8590]">
                      {item.label} · {item.status === 'generated' ? '已生成' : item.status === 'blocked' ? '受阻' : '已规划'}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {agent?.taskId && shouldMountVimaxTaskBackedControls(message) && !planConfirmation ? (
          <>
            <VimaxProjectEditorCard taskId={agent.taskId} requestHeaders={requestHeaders} />
            <VimaxSegmentedProductionCard taskId={agent.taskId} requestHeaders={requestHeaders} />
          </>
        ) : null}

        {message.generatedImages && message.generatedImages.length > 0 && !(agent?.shots || []).some(shot => shot.referenceUrl) && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {message.generatedImages.map((image, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={index} src={image.url} alt={image.label || '参考素材'} className="aspect-video w-full rounded-lg object-cover" />
            ))}
          </div>
        )}

        {message.generatedVideo?.url && (
          <div className="mt-3">
            <VimaxProtectedVideo
              url={message.generatedVideo.url}
              requestHeaders={requestHeaders}
              className="aspect-video w-full rounded-xl border border-[#e1e5eb] bg-black"
            />
            {message.generatedVideo.duration ? (
              <p className="mt-1 text-xs text-[#858c97]">时长约 {message.generatedVideo.duration} 秒 · 真实视频模型成片</p>
            ) : null}
          </div>
        )}

        {agent?.shots && agent.shots.length > 0 && !planConfirmation && (
          <VimaxShotReferenceGrid
            taskId={agent.taskId}
            shots={agent.shots}
            phase={agent.phase}
            requestHeaders={requestHeaders}
          />
        )}

        {delivery && !planConfirmation ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#e3e7ed] pt-3">
            {message.generationStatus === 'completed' ? (
              <>
                <button type="button" onClick={() => onResultIteration(message.id, 'edit')} title="带入当前结果继续修改，并保留这一版" className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe4eb] bg-white px-3 py-1.5 text-xs font-medium text-[#555d68] transition-colors hover:border-[#a9bfff] hover:text-[#2f6bff]">
                  继续编辑
                </button>
                <button type="button" onClick={() => onResultIteration(message.id, 'regenerate')} title="使用原始需求创建新版本，并保留这一版" className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe4eb] bg-white px-3 py-1.5 text-xs font-medium text-[#555d68] transition-colors hover:border-[#a9bfff] hover:text-[#2f6bff]">
                  再生成
                </button>
              </>
            ) : null}
            <a
              data-testid="vimax-export-manifest"
              href={createVimaxManifestDataUrl(message)}
              download={manifestName}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe4eb] bg-white px-3 py-1.5 text-xs font-medium text-[#555d68] transition-colors hover:border-[#a9bfff] hover:text-[#2f6bff]"
            >
              <FileJson className="h-3.5 w-3.5" />
              导出制作清单
            </a>
            {delivery.downloads.map(item => (
              <VimaxProtectedDownload
                key={`${item.kind}-${item.url}`}
                url={item.url}
                filename={item.filename}
                label={item.label}
                requestHeaders={requestHeaders}
              />
            ))}
          </div>
        ) : null}

        {!hideQuickOptions && quickOptions && quickOptions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {quickOptions.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => onQuickOption(option)}
                className="rounded-full border border-[#bfd0ff] bg-[#edf3ff] px-3 py-1 text-xs text-[#2f6bff] hover:bg-[#e1ebff]"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VimaxPlanConfirmationActions({ taskId, plan, requestHeaders, onPlanChange }: {
  taskId: string;
  plan: VimaxProductionPlan;
  requestHeaders?: Record<string, string>;
  onPlanChange: (plan: VimaxProductionPlan) => void;
}) {
  const [pendingAction, setPendingAction] = useState('');
  const [error, setError] = useState('');
  const awaitingPlan = plan.governance.status === 'awaiting-plan-approval';
  const awaitingExecution = plan.governance.status === 'plan-approved'
    || plan.governance.status === 'awaiting-cost-decision';
  const ready = plan.governance.status === 'ready';
  const videoReady = plan.providerRoutes.find(route => route.stage === 'video')?.ready === true;

  const updatePlan = useCallback(async (action: string, fallbackError: string) => {
    if (pendingAction) return;
    setPendingAction(action);
    setError('');
    try {
      const response = await clientApiRequest(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...requestHeaders },
        body: JSON.stringify({ action }),
        redirectOnUnauthorized: false,
      });
      const data = await response.json().catch(() => ({}));
      const updated = parseVimaxProductionPlan(data.productionPlan);
      if (!response.ok || !updated) throw new Error(data.error || fallbackError);
      onPlanChange(updated);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : fallbackError);
    } finally {
      setPendingAction('');
    }
  }, [onPlanChange, pendingAction, requestHeaders, taskId]);

  if (ready) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs text-emerald-800">
        故事与执行方式已确认，可以继续准备画面参考。
      </div>
    );
  }

  if (!awaitingPlan && !awaitingExecution) return null;

  return (
    <div className="rounded-xl border border-[#dfe5ee] bg-white px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#343b46]">
            {awaitingPlan ? '先确认故事和分镜' : '选择接下来的制作方式'}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[#7b8490]">
            {awaitingPlan
              ? '确认后才会进入画面准备，当前不会生成图片或视频。'
              : '继续制作会使用当前账号已配置的百炼；也可以先保存方案，稍后再继续。'}
          </p>
          {error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {awaitingPlan ? (
            <button
              type="button"
              disabled={Boolean(pendingAction)}
              onClick={() => void updatePlan('approve-production-plan', '故事和分镜确认失败')}
              className="rounded-lg bg-[#2f6bff] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#245de3] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction ? '正在保存…' : '确认故事和分镜'}
            </button>
          ) : (
            <>
              {videoReady ? (
                <button
                  type="button"
                  disabled={Boolean(pendingAction)}
                  onClick={() => void updatePlan('confirm-production-external', '制作方式保存失败')}
                  className="rounded-lg bg-[#2f6bff] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#245de3] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pendingAction === 'confirm-production-external' ? '正在保存…' : '使用百炼继续制作'}
                </button>
              ) : null}
              <button
                type="button"
                disabled={Boolean(pendingAction)}
                onClick={() => void updatePlan('confirm-production-draft', '方案保存失败')}
                className="rounded-lg border border-[#dfe5ee] bg-white px-3.5 py-2 text-xs font-medium text-[#596270] transition-colors hover:border-[#b9c8e8] hover:text-[#2f6bff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pendingAction === 'confirm-production-draft' ? '正在保存…' : '先保存方案'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
