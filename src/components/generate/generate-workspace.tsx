'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  AtSign,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileJson,
  Footprints,
  Image as ImageIcon,
  Loader2,
  Mic,
  Music,
  PersonStanding,
  Plus,
  Search,
  Sparkles,
  Video,
  Wand2,
  X,
} from 'lucide-react';

import { VimaxProjectBar } from '@/components/generate/vimax-project-bar';
import { VimaxProjectHome } from '@/components/generate/vimax-project-home';
import { clientApiFetch, clientApiRequest } from '@/lib/client-api';
import { genId, loadChatHistory, loadMessages, saveChatHistory, saveMessages, type ChatHistoryEntry, type ChatMessage } from '@/lib/smart-assistant-panel-model';
import { VimaxProductionPlanCard } from '@/components/generate/vimax-production-plan-card';
import { VimaxProjectEditorCard } from '@/components/generate/vimax-project-editor-card';
import { VimaxSegmentedProductionCard } from '@/components/generate/vimax-segmented-production-card';
import { VimaxProtectedDownload, VimaxProtectedVideo } from '@/components/generate/vimax-protected-media';
import { BailianConnectionControl } from '@/components/generate/bailian-connection-control';
import {
  useVimaxShortDramaSkill,
  VIMAX_REFERENCE_CONFIRM_REGEX,
} from '@/lib/skills/vimax-short-drama/use-vimax-short-drama-skill';
import {
  resolveVimaxGenerationSettings,
  VIMAX_PLAN_MODEL,
} from '@/lib/skills/vimax-short-drama/vimax-generation-preferences';
import type { VimaxProductionPlan } from '@/lib/skills/vimax-short-drama/vimax-production-plan';
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
  loadVimaxProjectReferenceIds,
  moveVimaxProjectReference,
  renameVimaxProject,
  restoreVimaxWorkspaceView,
  saveActiveVimaxProjectId,
  saveVimaxProjectReferenceIds,
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
import { recoverVimaxTaskProject } from '@/lib/skills/vimax-short-drama/vimax-task-project-recovery';
import {
  buildVimaxTaskUrl,
  resolveVimaxTaskId,
  shouldClearCachedVimaxProject,
  shouldShowVimaxQuickOption,
} from '@/lib/skills/vimax-short-drama/vimax-workspace-session';

type CreationMode = 'agent' | 'image' | 'video' | 'music' | 'voice' | 'avatar' | 'motion';

interface CreationModeDef {
  id: CreationMode;
  label: string;
  icon: React.ReactNode;
  /** 已接入真实能力的现有 section；为空表示由 Agent skill 统一编排。 */
  section?: string;
}

// 有 section 的创作类型已接真实后端（点了直达）；音乐生成 / 动作模仿先占位，后续接入。
const CREATION_MODES: CreationModeDef[] = [
  { id: 'agent', label: 'Agent 模式', icon: <Sparkles className="h-4 w-4" /> },
  { id: 'image', label: '图片生成', icon: <ImageIcon className="h-4 w-4" />, section: 'image' },
  { id: 'video', label: '视频生成', icon: <Video className="h-4 w-4" />, section: 'video' },
  { id: 'music', label: '音乐生成', icon: <Music className="h-4 w-4" /> },
  { id: 'voice', label: '配音生成', icon: <Mic className="h-4 w-4" />, section: 'voice' },
  { id: 'avatar', label: '数字人', icon: <PersonStanding className="h-4 w-4" />, section: 'avatar' },
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
  showModelSettings?: boolean;
  onNavigate?: (section: string, prompt?: string, transfer?: { imageRefs?: string[] }) => void;
  requestHeaders?: Record<string, string>;
  storageScope?: string;
  resumeTaskId?: string;
  onAuthenticationRequired?: (reason: string) => void;
}

type SubjectType = 'character' | 'scene' | 'object';
type SubjectItem = { id: string; name: string; type: SubjectType; imageUrl: string };

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('reference_read_failed'));
    reader.onerror = () => reject(new Error('reference_read_failed'));
    reader.readAsDataURL(file);
  });
}

export function GenerateWorkspace({
  initialPrompt,
  agentOnly = false,
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
  const [atMenuOpen, setAtMenuOpen] = useState(false);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [subjectOpeningId, setSubjectOpeningId] = useState<string | null>(null);
  const [selectedReferences, setSelectedReferences] = useState<SubjectItem[]>([]);
  const [referenceType, setReferenceType] = useState<SubjectType>('character');
  const [referenceUploading, setReferenceUploading] = useState(false);
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
  const [ignoreResumeTask, setIgnoreResumeTask] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<VimaxWorkspaceView>('home');
  useEffect(() => {
    setSkillSelection({ scope: skillScope, id: loadVimaxSkillPreset(localStorage, skillScope).id });
    setSkillSearch('');
  }, [skillScope, storageScope]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);
  const restoredReferenceProjectRef = useRef<string | null>(null);
  const selectedSkill = resolveVimaxSkillPreset(skillSelection.scope === skillScope ? skillSelection.id : undefined);
  const visibleSkillPresets = searchVimaxSkillPresets(skillSearch);
  const projects = summarizeVimaxProjects(history);
  const activeProject = activeProjectId ? history.find(project => project.id === activeProjectId) : null;
  const activeTitle = activeProject?.title
    || messages.find(message => message.role === 'user')?.content.slice(0, 30)
    || '未命名创作';
  const effectiveRequestHeaders = useMemo(() => ({ ...(requestHeaders || {}) }), [requestHeaders]);
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
    setIgnoreResumeTask(false);
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
    const savedIds = loadVimaxProjectReferenceIds(localStorage, storageScope, activeProjectId);
    if (savedIds.length === 0) {
      setSelectedReferences([]);
      setReferenceError(null);
      restoredReferenceProjectRef.current = projectKey;
      return;
    }
    let cancelled = false;
    setSubjectsLoading(true);
    void clientApiFetch<{ subjects?: SubjectItem[] }>('/api/subjects', {
      headers: effectiveRequestHeaders,
      redirectOnUnauthorized: false,
    }).then(payload => {
      if (cancelled) return;
      const visibleSubjects = payload.subjects || [];
      const byId = new Map(visibleSubjects.map(subject => [subject.id, subject]));
      const restored = savedIds
        .map(id => byId.get(id))
        .filter((subject): subject is SubjectItem => Boolean(subject));
      setSubjects(visibleSubjects);
      setSelectedReferences(restored);
      saveVimaxProjectReferenceIds(
        localStorage,
        storageScope,
        activeProjectId,
        restored.map(subject => subject.id),
      );
      setReferenceError(
        restored.length === savedIds.length
          ? null
          : '部分参考图已失效或不属于当前账号，已安全移除。',
      );
      restoredReferenceProjectRef.current = projectKey;
    }).catch(error => {
      if (cancelled) return;
      setReferenceError(error instanceof Error ? error.message : '参考图恢复失败');
      restoredReferenceProjectRef.current = projectKey;
    }).finally(() => {
      if (!cancelled) setSubjectsLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeProjectId, effectiveRequestHeaders, restoredScope, storageScope]);

  useEffect(() => {
    if (!activeProjectId) return;
    const projectKey = `${storageScope || 'default'}:${activeProjectId}`;
    if (restoredReferenceProjectRef.current !== projectKey) return;
    saveVimaxProjectReferenceIds(
      localStorage,
      storageScope,
      activeProjectId,
      selectedReferences.map(reference => reference.id),
    );
  }, [activeProjectId, selectedReferences, storageScope]);

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
        const recovered = recoverVimaxTaskProject(payload.task);
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
    saveVimaxProjectReferenceIds(localStorage, storageScope, projectId, []);
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
    setScopedWorkspaceView('home');
  }, [activeProjectId, cancelCurrentRun, setScopedWorkspaceView, storageScope]);

  const activeMode = CREATION_MODES.find(item => item.id === mode) || CREATION_MODES[0];

  const openSubjectMenu = useCallback(async () => {
    setModeMenuOpen(false);
    setSkillMenuOpen(false);
    setMediaModelMenuOpen(false);
    setAtMenuOpen(open => !open);
    if (atMenuOpen || subjects.length > 0 || subjectsLoading) return;
    setSubjectsLoading(true);
    try {
      const payload = await clientApiFetch<{ subjects?: SubjectItem[] }>('/api/subjects');
      setSubjects(payload.subjects || []);
      setSubjectError(null);
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : '主体库加载失败');
    } finally {
      setSubjectsLoading(false);
    }
  }, [atMenuOpen, subjects.length, subjectsLoading]);

  const selectSubject = useCallback(async (subject: SubjectItem) => {
    if (subjectOpeningId) return;
    if (mode === 'agent') {
      setSelectedReferences(current => (
        current.some(item => item.id === subject.id)
          ? current
          : [...current, subject].slice(0, 8)
      ));
      setAtMenuOpen(false);
      setReferenceError(null);
      return;
    }
    if (!onNavigate) return;
    setSubjectOpeningId(subject.id);
    try {
      const response = await clientApiRequest(`/api/subjects/${encodeURIComponent(subject.id)}`, { timeoutMs: 20_000 });
      if (!response.ok) throw new Error('主体参考图不可用');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/') || blob.size === 0) throw new Error('主体参考图不可用');
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('主体参考图读取失败'));
        reader.readAsDataURL(blob);
      });
      setAtMenuOpen(false);
      onNavigate('image', input.trim() || `基于主体「${subject.name}」创作新画面`, { imageRefs: [dataUrl] });
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : '主体参考图不可用');
    } finally {
      setSubjectOpeningId(null);
    }
  }, [input, mode, onNavigate, subjectOpeningId]);

  const uploadReference = useCallback(async (file: File) => {
    if (referenceUploading) return;
    if (selectedReferences.length >= 8) {
      setReferenceError('最多添加 8 张参考图。');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
      || file.size <= 0
      || file.size > 15 * 1024 * 1024) {
      setReferenceError('仅支持 15MB 以内的 PNG、JPEG 或 WebP 图片。');
      return;
    }
    setReferenceUploading(true);
    setReferenceError(null);
    try {
      const referenceUrl = await readImageAsDataUrl(file);
      const payload = await clientApiFetch<{ subject?: SubjectItem }>('/api/subjects', {
        method: 'POST',
        headers: effectiveRequestHeaders,
        body: JSON.stringify({
          name: file.name.replace(/\.[^.]+$/, '').slice(0, 80) || '未命名参考图',
          type: referenceType,
          source: 'uploaded',
          context: 'creation-agent',
          referenceUrl,
        }),
        timeoutMs: 30_000,
      });
      if (!payload.subject) throw new Error('reference_upload_failed');
      setSubjects(current => [
        payload.subject!,
        ...current.filter(item => item.id !== payload.subject!.id),
      ]);
      setSelectedReferences(current => [...current, payload.subject!].slice(0, 8));
    } catch {
      setReferenceError('参考图上传失败，请检查图片后重试。');
    } finally {
      setReferenceUploading(false);
      if (referenceInputRef.current) referenceInputRef.current.value = '';
    }
  }, [
    effectiveRequestHeaders,
    referenceType,
    referenceUploading,
    selectedReferences.length,
  ]);

  const handleSend = useCallback(async (overrideText?: string, overrideSkillId?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;
    setScopedWorkspaceView('project');
    const requestSkill = resolveVimaxSkillPreset(overrideSkillId || selectedSkill.id);

    if (mode === 'agent') {
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
      // 点击“确认参考图，继续生成视频” -> 进入视频费用确认，不重复生成参考图
      if (/继续生成视频|生成视频/.test(text)) {
        const routingCostDetail = '当前计划按每个主镜头创建一次视频任务；每镜会依照已确认的衔接计划执行“严格接镜”或“参考创作”，不再默认追加边界生成任务。';
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
        referenceIds: selectedReferences.map(reference => reference.id),
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
      content: `「${activeMode.label}」即将接入，敬请期待。当前可使用 Agent 模式、图片 / 视频 / 配音 / 数字人。`,
      timestamp: Date.now(),
    }]);
    setInput('');
  }, [input, isLoading, mode, activeMode, onNavigate, handlePlanStep, handleReferenceAssetsStep, handleVideoStep, selectedRatio, selectedQuality, selectedReferences, selectedSkill, setScopedWorkspaceView]);

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
                    <h2 className="text-xl font-semibold tracking-[-0.025em] text-[#20232a]">从一句想法开始</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-[#858c97]">
                      创作智能体会沿用成熟的计划、分镜、参考素材和成片链路持续推进。
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
          <div className="mb-2 flex flex-wrap gap-2" aria-label="已添加参考图">
            {selectedReferences.map((reference, index) => (
              <span
                key={reference.id}
                className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.045] py-1 pl-1 pr-1.5 text-xs text-slate-300"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={reference.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                <span className="max-w-28 truncate">{reference.name}</span>
                <span className="shrink-0 text-[10px] text-slate-500">
                  {reference.type === 'character' ? '角色' : reference.type === 'scene' ? '场景' : '道具'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedReferences(current => moveVimaxProjectReference(current, reference.id, -1))}
                  disabled={index === 0}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-slate-200 disabled:opacity-25"
                  aria-label={`前移 ${reference.name}`}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReferences(current => moveVimaxProjectReference(current, reference.id, 1))}
                  disabled={index === selectedReferences.length - 1}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-slate-200 disabled:opacity-25"
                  aria-label={`后移 ${reference.name}`}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReferences(current => current.filter(item => item.id !== reference.id))}
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
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) void uploadReference(file);
              }}
            />
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-400 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-[#8eb1ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e8dff]/45 disabled:opacity-40"
              title="上传参考图"
              aria-label="上传参考图"
              type="button"
              disabled={referenceUploading || selectedReferences.length >= 8}
              onClick={() => referenceInputRef.current?.click()}
            >
              {referenceUploading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Plus className="h-4 w-4" />}
            </button>
            <select
              value={referenceType}
              onChange={event => setReferenceType(event.target.value as SubjectType)}
              className="h-9 rounded-lg border border-white/10 bg-[#151d2a] px-2 text-[11px] text-slate-300 outline-none transition hover:border-white/20 focus:border-[#557fdc]"
              aria-label="参考图用途"
            >
              <option value="character">角色</option>
              <option value="scene">场景</option>
              <option value="object">道具</option>
            </select>
          </div>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="输入想法、剧本或上传参考，支持 “/” 使用技能，@ 添加主体，和 Agent 一起创作"
            className="min-h-[58px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative">
            {agentOnly ? (
              <span className="flex items-center gap-1.5 rounded-lg bg-[#14254a] px-2.5 py-1.5 text-xs font-medium text-[#8eb1ff] ring-1 ring-[#355da9]">
                <Sparkles className="h-4 w-4" /> Agent 模式
              </span>
            ) : (
              <button
                type="button"
                onClick={() => { setSkillMenuOpen(false); setMediaModelMenuOpen(false); setAtMenuOpen(false); setModeMenuOpen(open => !open); }}
                className="flex items-center gap-1.5 rounded-lg bg-[#edf3ff] px-2.5 py-1.5 text-xs font-medium text-[#2f6bff] ring-1 ring-[#c9d8ff] transition hover:bg-[#e3edff]"
              >
                {activeMode.icon}
                {activeMode.label}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
            {!agentOnly && modeMenuOpen && (
              <div className="absolute left-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-xl border border-[#e1e5eb] bg-white p-1 text-[#252931] shadow-[0_18px_38px_rgba(31,41,55,0.14)]">
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9299a4]">创作类型</p>
                {CREATION_MODES.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setModeMenuOpen(false);
                      // 有对应能力页（图片/视频/数字人）的创作类型：直接进入该能力，点了就能用。
                      if (item.id !== 'agent' && item.section && onNavigate) {
                        onNavigate(item.section, input.trim() || undefined);
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
              onClick={() => { setModeMenuOpen(false); setSkillMenuOpen(false); setAtMenuOpen(false); setMediaModelMenuOpen(open => !open); }}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-slate-100"
              title="画面比例与清晰度"
            >
              <ImageIcon className="h-3.5 w-3.5" /> 画面
            </button>
            {mediaModelMenuOpen && (
              <div className="absolute left-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-[#e1e5eb] bg-white p-2 text-[#252931] shadow-[0_18px_38px_rgba(31,41,55,0.14)]">
                <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#9299a4]">画面比例</p>
                <div className="flex gap-1.5">
                  {["16:9", "9:16", "1:1", "4:3", "3:4"].map(r => (
                    <button key={r} type="button" onClick={() => setSelectedRatio(r)} className={`rounded-md border px-2 py-1 text-xs transition-colors ${selectedRatio === r ? "border-[#9bb8ff] bg-[#edf3ff] text-[#2f6bff]" : "border-[#e1e5eb] text-[#626a76] hover:bg-[#f5f7fa]"}`}>{r}</button>
                  ))}
                </div>
                <p className="px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[#9299a4]">清晰度</p>
                <div className="flex gap-1.5">
                  {["标清", "高清", "超清"].map(q => (
                    <button key={q} type="button" onClick={() => setSelectedQuality(q)} className={`rounded-md border px-2 py-1 text-xs transition-colors ${selectedQuality === q ? "border-[#9bb8ff] bg-[#edf3ff] text-[#2f6bff]" : "border-[#e1e5eb] text-[#626a76] hover:bg-[#f5f7fa]"}`}>{q}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => { setModeMenuOpen(false); setMediaModelMenuOpen(false); setAtMenuOpen(false); setSkillMenuOpen(open => !open); }}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-slate-100"
              title="使用技能"
            >
              <Wand2 className="h-3.5 w-3.5" /> {selectedSkill.name}
            </button>
            {skillMenuOpen && (
              <div className="absolute left-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-xl border border-[#e1e5eb] bg-white p-2 text-[#252931] shadow-[0_18px_38px_rgba(31,41,55,0.14)]">
                <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9299a4]">创作 Skill</p>
                <label className="mb-2 flex items-center gap-2 rounded-lg border border-[#e1e5eb] bg-[#f8f9fb] px-2.5 py-2">
                  <Search className="h-3.5 w-3.5 text-[#9299a4]" />
                  <input
                    value={skillSearch}
                    onChange={event => setSkillSearch(event.target.value)}
                    placeholder="搜索短剧、电商、分镜…"
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
                  <p className="px-2 py-5 text-center text-xs text-[#9299a4]">没有匹配的 Skill</p>
                )}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => void openSubjectMenu()}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-400 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-slate-100"
              title="添加主体"
            >
              <AtSign className="h-4 w-4" />
            </button>
            {atMenuOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl border border-[#e1e5eb] bg-white p-2 text-[#252931] shadow-[0_18px_38px_rgba(31,41,55,0.14)] sm:left-0 sm:right-auto">
                <p className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#9299a4]">引用主体</p>
                {subjectsLoading ? (
                  <p className="px-1 py-3 text-xs text-[#9299a4]">正在加载主体库…</p>
                ) : subjectError ? (
                  <p className="px-1 py-3 text-xs text-red-500">{subjectError}</p>
                ) : subjects.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-[#9299a4]">暂无可引用主体。可在素材库的生成历史中保存真实图片。</p>
                ) : subjects.map(subject => (
                  <button key={subject.id} type="button" disabled={Boolean(subjectOpeningId)} onClick={() => void selectSubject(subject)} className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-[#f5f7fa] disabled:opacity-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={subject.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm">{subject.name}</span><span className="text-[11px] text-[#9299a4]">{subject.type === 'character' ? '角色' : subject.type === 'scene' ? '场景' : '物件'}</span></span>
                    {subjectOpeningId === subject.id && <span className="text-xs text-[#9299a4]">读取中</span>}
                  </button>
                ))}
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
  const quickOptions = message.quickOptions?.filter(option => shouldShowVimaxQuickOption(option, agent?.productionPlan));
  const delivery = agent ? buildVimaxResultDelivery(message) : null;
  const manifestName = `${(agent?.title || 'vimax-project').replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '') || 'vimax-project'}-manifest.json`;
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[92%] rounded-2xl rounded-bl-md border border-[#e3e7ed] bg-white px-4 py-3 text-[#252931] shadow-[0_8px_26px_rgba(31,41,55,0.05)]">
        {agent ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-md bg-[#edf3ff] px-2 py-0.5 font-medium text-[#2f6bff]">{agent.title}</span>

            <span className={`rounded-md px-2 py-0.5 ${agent.costState === 'incurred' ? 'bg-amber-500/15 text-amber-500' : agent.costState === 'blocked' ? 'bg-red-500/15 text-red-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
              {agent.costState === 'incurred' ? '已产生费用' : agent.costState === 'blocked' ? '已阻塞' : '未计费'}
            </span>
          </div>
        ) : null}

        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#303640]">{message.content}</p>

        {delivery ? (
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

        {agent?.taskId && message.generationStatus === 'completed' ? (
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

        {agent?.shots && agent.shots.length > 0 && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {agent.shots.map(shot => (
              <div key={shot.index} className="overflow-hidden rounded-xl border border-[#e1e5eb] bg-[#f8f9fb]">
                {shot.videoUrl ? (
                  <video
                    src={shot.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full bg-black object-cover"
                  />
                ) : shot.referenceUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shot.referenceUrl} alt={`Clip ${shot.index} · ${shot.title}`} className="aspect-video w-full object-cover" />
                ) : null}
                <div className="space-y-1 px-3 py-2 text-xs">
                  <div className="flex min-h-[24px] items-center gap-2">
                    <span className="shrink-0 font-medium text-[#2f6bff]">Clip {shot.index}</span>
                    <span className="min-w-0 flex-1 truncate text-[#3a414b]">{shot.title}</span>
                    {shot.handoffIntent ? (
                      <span
                        title={shot.handoffReason}
                        className="shrink-0 rounded-full border border-[#dce4f4] bg-white px-2 py-0.5 text-[11px] font-medium text-[#596579]"
                      >
                        {shot.handoffIntent === 'strict-frame' ? '严格接镜' : '参考创作'}
                      </span>
                    ) : null}
                    <span className="shrink-0 text-[#858c97]">{shot.duration}s · {shot.camera}</span>
                  </div>
                  {shot.handoffReason ? (
                    <p className="line-clamp-2 text-[#68758a]">衔接：{shot.handoffReason}</p>
                  ) : null}
                  {shot.prompt ? (
                    <p className="line-clamp-3 text-[#858c97]">{shot.prompt}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {delivery ? (
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
