import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { FilmHistoryItem } from '@/hooks/useFilmHistory';
import { getBYOKRequestHeaders } from '@/lib/byok-client';
import { buildFilmEntityCardsFromScript } from '@/lib/film-script-to-entity-cards';
import { entityCardToSnapshot, type ChatMessage, type EntityCard, type WorkflowPhase } from '@/lib/film-creation-panel-model';
import type { FilmDirectorAnalysis } from '@/components/film/film-quality-panels';
import type { CreateScriptResponse, FilmScript } from '@/types/film';

type WorkflowMessageRole = 'system' | 'assistant' | 'user' | 'info' | 'success' | 'error';
type WorkflowMessageType = 'progress' | 'success' | 'error' | 'info';
type MiddleAiStatus = { text: string; type: 'thinking' | 'responding' | 'done' | 'error' } | null;
type FilmMaterial = { text: string; type: 'text' | 'url' | 'image'; url?: string };
type UploadedFilmFile = {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document';
  url: string;
  localPreview?: string;
  size: number;
  uploading?: boolean;
};

type UseFilmPlanCreationArgs = {
  addWorkflowMsg: (
    role: WorkflowMessageRole,
    content: string,
    step?: string,
    msgType?: WorkflowMessageType,
    nextStep?: string
  ) => void;
  chatMessages: ChatMessage[];
  directorAnalysis: FilmDirectorAnalysis | null;
  extractedParams: Record<string, string | number | null>;
  filmVisualStyle: string;
  handleComplianceCheck: (prompt: string, filmScript: FilmScript) => void | Promise<void>;
  inputText: string;
  materials: FilmMaterial[];
  onScriptGenerated?: (script: FilmScript) => void;
  selectedModel: string;
  setAutoGenerateAssets: Dispatch<SetStateAction<boolean>>;
  setDirectorAnalysis: Dispatch<SetStateAction<FilmDirectorAnalysis | null>>;
  setEntityCards: Dispatch<SetStateAction<EntityCard[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setFilmVisualStyle: Dispatch<SetStateAction<string>>;
  setIsBridging: Dispatch<SetStateAction<boolean>>;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  setMiddleAiStatus: Dispatch<SetStateAction<MiddleAiStatus>>;
  setPhase: Dispatch<SetStateAction<WorkflowPhase>>;
  setProgressMsg: Dispatch<SetStateAction<string>>;
  setScript: Dispatch<SetStateAction<FilmScript | null>>;
  setShowDirectorPanel: Dispatch<SetStateAction<boolean>>;
  setShowSearchResults: Dispatch<SetStateAction<boolean>>;
  setStreamingScriptText: Dispatch<SetStateAction<string>>;
  style: string;
  targetDuration: number;
  upsertFilmHistory: (item: Omit<FilmHistoryItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  uploadedFiles: UploadedFilmFile[];
  videoDuration: number;
  videoRatio: string;
  visualStyle: string;
};

export function useFilmPlanCreation(args: UseFilmPlanCreationArgs) {
  const {
    addWorkflowMsg,
    chatMessages,
    directorAnalysis,
    extractedParams,
    filmVisualStyle,
    handleComplianceCheck,
    inputText,
    materials,
    onScriptGenerated,
    selectedModel,
    setAutoGenerateAssets,
    setDirectorAnalysis,
    setEntityCards,
    setError,
    setFilmVisualStyle,
    setIsBridging,
    setIsGenerating,
    setMiddleAiStatus,
    setPhase,
    setProgressMsg,
    setScript,
    setShowDirectorPanel,
    setShowSearchResults,
    setStreamingScriptText,
    style,
    targetDuration,
    upsertFilmHistory,
    uploadedFiles,
    videoDuration,
    videoRatio,
    visualStyle,
  } = args;

  const handlePlanCreation = useCallback(async (overrideInput?: string) => {
    const input = overrideInput || inputText;
    if (!input.trim()) return;

    setIsBridging(true);
    setIsGenerating(true);
    setError(null);
    setProgressMsg('正在生成创作规划...');
    setPhase('planning');
    setDirectorAnalysis(null);
    setShowDirectorPanel(false);
    addWorkflowMsg('system', '📋 开始创作规划流程');
    addWorkflowMsg('assistant', '正在调用自动化导演分析你的创意...', 'planning');

    try {
      const materialContext = materials.length > 0
        ? `\n\n[参考素材]\n${materials.map(m => m.text).join('\n')}`
        : '';
      const uploadedContext = uploadedFiles.length > 0
        ? `\n\n[上传参考文件]\n${uploadedFiles.filter(f => f.url).map(f =>
            f.type === 'image' ? `参考图片: ${f.name} (${f.url})`
            : f.type === 'video' ? `参考视频: ${f.name} (${f.url})`
            : `参考文档: ${f.name} (${f.url})`
          ).join('\n')}`
        : '';
      const fullInput = input.trim() + materialContext + uploadedContext;

      setProgressMsg('自动化导演分析中...');
      try {
        const directorRes = await fetch('/api/film/auto-director', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: fullInput,
            duration: (extractedParams.targetDuration as number) || targetDuration || 60,
            aspectRatio: videoRatio || '16:9',
            style: (extractedParams.visualStyle as string) || undefined,
            filmVisualStyle: filmVisualStyle || undefined,
            model: selectedModel || 'auto',
            entryMode: 'full_pipeline',
            dryRun: true,
            enableModelRouting: true,
            enableQualityCheck: true,
          }),
        });
        if (directorRes.ok) {
          const directorData = await directorRes.json();
          if (directorData.success) {
            const plan = directorData.data || {};
            const story = plan.story || {};
            const direction = plan.direction || {};
            const scheduling = plan.scheduling || {};
            const qa = plan.qualityAssessment || [];
            const modelRoutings = plan.modelRoutings || [];
            const riskNotes = qa.flatMap((e: { issues?: string[]; feedback?: string }) => [
              ...(e.issues || []),
              ...(e.feedback ? [e.feedback] : []),
            ]).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).slice(0, 5);
            const modelRec = { video: 'auto', image: 'auto', llm: 'auto' };
            for (const mr of modelRoutings) {
              const route = mr as { serviceType?: string; selectedModel?: string; taskType?: string };
              const st = route.serviceType || route.taskType || '';
              if (st.includes('video') || st === 'shot') modelRec.video = route.selectedModel || 'auto';
              else if (st.includes('image') || st === 'image') modelRec.image = route.selectedModel || 'auto';
              else if (st.includes('llm') || st === 'script') modelRec.llm = route.selectedModel || 'auto';
            }
            const shots = direction.shots || scheduling.decisions || [];
            const cameraDirections = shots
              .map((s: { cameraMovement?: string; camera?: string; shotType?: string }) =>
                s.cameraMovement || s.camera || s.shotType || '')
              .filter(Boolean).slice(0, 8);
            const transitionStyles = shots
              .flatMap((s: { transition?: string; transitionStyle?: string }) =>
                [s.transition, s.transitionStyle].filter(Boolean) as string[])
              .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
              .slice(0, 5);

            setDirectorAnalysis({
              contentType: story.typeName || story.contentType || '通用',
              totalShots: shots.length,
              estimatedDuration: direction.totalDuration || targetDuration,
              emotionCurve: typeof direction.emotionCurve === 'string'
                ? direction.emotionCurve
                : Array.isArray(direction.emotionCurve)
                  ? direction.emotionCurve.map((e: { emotion?: string; intensity?: number }, i: number) =>
                      `${i + 1}.${e.emotion || '?'}(${Math.round((e.intensity || 0) * 100)}%)`
                    ).join(' → ')
                  : '平稳起伏',
              modelRecommendation: modelRec,
              styleTags: (story.template?.keywords || []).length > 0
                ? (story.template.keywords as string[]).slice(0, 6)
                : shots
                    .flatMap((s: { tags?: string[]; style?: string }) => s.tags || (s.style ? [s.style] : []))
                    .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
                    .slice(0, 6),
              riskNotes,
              cameraDirections,
              transitionStyles,
            });
            setShowDirectorPanel(true);
          }
        }
      } catch {
        // 导演分析失败不影响主流程
      }

      setProgressMsg('AI编剧根据导演方案生成创作规划...');
      const directorGuidance = directorAnalysis ? {
        contentType: directorAnalysis.contentType,
        shotCount: directorAnalysis.totalShots,
        estimatedDuration: directorAnalysis.estimatedDuration,
        emotionCurve: directorAnalysis.emotionCurve,
        styleTags: directorAnalysis.styleTags,
        riskNotes: directorAnalysis.riskNotes,
        modelRecommendation: directorAnalysis.modelRecommendation,
        cameraDirections: directorAnalysis.cameraDirections,
        transitionStyles: directorAnalysis.transitionStyles,
      } : undefined;

      const res = await fetch('/api/film/create-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
        body: JSON.stringify({
          text: fullInput,
          style: (extractedParams.visualStyle as string) || visualStyle || style,
          duration: (extractedParams.targetDuration as number) || directorAnalysis?.estimatedDuration || targetDuration || 60,
          directorGuidance,
          filmVisualStyle: filmVisualStyle || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const errMsg = errData?.error || `创作规划生成失败（HTTP ${res.status}）`;
        throw new Error(errMsg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let scriptResult: (CreateScriptResponse & { success: true }) | null = null;
      let currentEvent = '';
      let currentData = '';
      let accumulatedStreamText = '';

      setStreamingScriptText('');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\n\n|\r\n\r\n/);
        buffer = events.pop() || '';

        for (const eventBlock of events) {
          const eventLines = eventBlock.split(/\n|\r\n/);
          currentEvent = '';
          currentData = '';

          for (const line of eventLines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6);
            } else if (line.startsWith('data:')) {
              currentData = line.slice(5).trimStart();
            }
          }

          if (!currentData) continue;

          try {
            const data = JSON.parse(currentData);

            if (currentEvent === 'progress') {
              const progressMsg = data.message || '处理中...';
              const progressPct = data.progress || 0;
              setProgressMsg(`${progressMsg} (${progressPct}%)`);
            } else if (currentEvent === 'text') {
              const chunk = data.chunk || '';
              if (chunk) {
                accumulatedStreamText += chunk;
                setStreamingScriptText(accumulatedStreamText);
              }
            } else if (currentEvent === 'director_text') {
              const chunk = data.chunk || '';
              if (chunk) {
                accumulatedStreamText += chunk;
                setStreamingScriptText(accumulatedStreamText);
              }
            } else if (currentEvent === 'result') {
              scriptResult = data as (CreateScriptResponse & { success: true });
              setStreamingScriptText('');
            } else if (currentEvent === 'error') {
              throw new Error(data.error || '创作规划生成失败');
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && !parseErr.message.includes('JSON')) {
              console.error('[FilmCreation] SSE parse error:', parseErr.message);
              throw parseErr;
            }
            console.warn('[FilmCreation] SSE JSON parse skipped for event:', currentEvent, 'dataLen:', currentData.length);
          }
        }
      }

      if (!scriptResult?.script) {
        console.error('[FilmCreation] No script result after SSE stream. scriptResult:', scriptResult ? 'exists but no .script' : 'null');
        throw new Error('未获取到结构化剧本');
      }

      const filmScript = scriptResult.script;
      setScript(filmScript);
      setShowSearchResults(false);

      let resolvedStyle = filmVisualStyle;
      if (!resolvedStyle && filmScript.style) {
        const styleStr = filmScript.style;
        const styleMap: Record<string, string> = {
          '电影': '电影感', '电影感': '电影感', cinematic: '电影感',
          '卡通': '卡通', cartoon: '卡通', '动画': '卡通',
          '优雅': '优雅', elegant: '优雅', '精致': '优雅',
          '治愈': '治愈', healing: '治愈', '温暖': '治愈',
          '现代': '现代简约', minimalist: '现代简约', '简约': '现代简约',
          '霓虹': '霓虹', neon: '霓虹',
          '复古': '复古', vintage: '复古', retro: '复古', '胶片': '复古',
          '水墨': '水墨', ink: '水墨', '国画': '水墨', '中式': '水墨',
          '赛博朋克': '赛博朋克', cyberpunk: '赛博朋克',
          '黑白': '极简黑白', monochrome: '极简黑白',
        };
        const matched = Object.entries(styleMap).find(([k]) => styleStr.toLowerCase().includes(k.toLowerCase()));
        if (matched) {
          resolvedStyle = matched[1];
          setFilmVisualStyle(matched[1]);
        }
      }

      onScriptGenerated?.(filmScript);
      const cards = buildFilmEntityCardsFromScript({ filmScript, resolvedStyle, videoDuration });

      setEntityCards(cards);
      addWorkflowMsg('assistant', `创作规划已完成！共 ${cards.filter(c => c.type === 'character').length} 个角色、${cards.filter(c => c.type === 'scene').length} 个场景、${cards.filter(c => c.type === 'shot').length} 个分镜。自动开始生成...`, 'step');

      upsertFilmHistory({
        title: (filmScript?.title || input.trim()).slice(0, 50),
        prompt: input.trim(),
        script: filmScript as unknown as Record<string, unknown>,
        phase: 'planning',
        entityCards: cards.map(entityCardToSnapshot),
        chatMessages: chatMessages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        filmVisualStyle: filmVisualStyle,
        imagesGenerated: 0,
        videosGenerated: 0,
        finalVideoUrl: null,
      });
      handleComplianceCheck(input.trim(), filmScript);

      setTimeout(() => {
        addWorkflowMsg('assistant', '自动开始生成角色/场景/道具图片...', 'progress');
        setMiddleAiStatus({ type: 'responding', text: '自动生成角色/场景/道具图片...' });
        setAutoGenerateAssets(true);
      }, 800);
    } catch (err) {
      const message = err instanceof Error ? err.message : '创作规划生成失败';
      setError(message);
      addWorkflowMsg('assistant', `创作规划生成失败：${message}。请重试或调整输入。`, 'error');
    } finally {
      setIsGenerating(false);
      setStreamingScriptText('');
      setMiddleAiStatus(prev => prev?.type === 'responding' ? { type: 'done', text: '创作规划已完成' } : prev);
      setTimeout(() => setMiddleAiStatus(null), 3000);
    }
  }, [
    addWorkflowMsg,
    chatMessages,
    directorAnalysis,
    extractedParams,
    filmVisualStyle,
    handleComplianceCheck,
    inputText,
    materials,
    onScriptGenerated,
    selectedModel,
    setAutoGenerateAssets,
    setDirectorAnalysis,
    setEntityCards,
    setError,
    setFilmVisualStyle,
    setIsBridging,
    setIsGenerating,
    setMiddleAiStatus,
    setPhase,
    setProgressMsg,
    setScript,
    setShowDirectorPanel,
    setShowSearchResults,
    setStreamingScriptText,
    style,
    targetDuration,
    upsertFilmHistory,
    uploadedFiles,
    videoDuration,
    videoRatio,
    visualStyle,
  ]);

  return { handlePlanCreation };
}
