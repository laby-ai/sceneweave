'use client';

import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { getBYOKRequestHeaders } from '@/lib/byok-client';
import type { ChatMessage, EntityCard, WorkflowPhase } from '@/lib/film-creation-panel-model';
import type { FilmScript } from '@/types/film';

type WorkflowMessageType = 'progress' | 'success' | 'error' | 'info';
type AddWorkflowMessage = (
  role: 'user' | 'assistant',
  content: string,
  step?: string,
  msgType?: WorkflowMessageType,
  nextStep?: string,
) => void;

type AsyncCardHandler = (cardId: string) => void | Promise<void>;
type AsyncVoidHandler = () => void | Promise<void>;

type FlexibleSetter<T = any> = (value: T | ((prev: T) => T)) => void;

type UseFilmChatFlowParams = {
  addWorkflowMsg: AddWorkflowMessage;
  chatEndRef: RefObject<HTMLDivElement | null>;
  chatInput: string;
  chatMessages: ChatMessage[];
  entityCards: EntityCard[];
  extractedParams: Record<string, string | number | null>;
  handleGenerateImage: AsyncCardHandler;
  handlePlanCreation: (overrideInput?: string) => void | Promise<void>;
  handleWorkflowCommand: (command: string) => void | Promise<void>;
  inputText: string;
  isChatStreaming: boolean;
  phase: WorkflowPhase;
  script: FilmScript | null;
  scriptType: string;
  selectedService: string;
  visualStyle: string;
  setAssetCardsExpanded: FlexibleSetter<boolean>;
  setAutoGenerateAssets: FlexibleSetter<boolean>;
  setBgmType: FlexibleSetter;
  setChatInput: Dispatch<SetStateAction<string>>;
  setChatInputHighlight: FlexibleSetter<boolean>;
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setChatPlaceholder: FlexibleSetter<string>;
  setComposeStatus: FlexibleSetter<'idle' | 'generating' | 'merging' | 'completed'>;
  setEntityCards: Dispatch<SetStateAction<EntityCard[]>>;
  setExpandedPhaseSection: FlexibleSetter<'planning' | 'visual' | 'compose' | 'gen-logs' | null>;
  setExpandedShotIds: FlexibleSetter<Set<string>>;
  setExtractedParams: Dispatch<SetStateAction<Record<string, string | number | null>>>;
  setFilmVisualStyle: FlexibleSetter<string>;
  setGenerationLogs: FlexibleSetter;
  setInputText: Dispatch<SetStateAction<string>>;
  setIsChatStreaming: FlexibleSetter<boolean>;
  setLogFilter: FlexibleSetter<string>;
  setMiddleAiStatus: FlexibleSetter<{ text: string; type: 'thinking' | 'responding' | 'done' | 'error' } | null>;
  setPhase: Dispatch<SetStateAction<WorkflowPhase>>;
  setRefEntitiesExpanded: FlexibleSetter<boolean>;
  setScript: Dispatch<SetStateAction<FilmScript | null>>;
  setShowChatMessages: FlexibleSetter<boolean>;
  setShowHistoryPanel: FlexibleSetter<boolean>;
  setShowLogPanel: FlexibleSetter<boolean>;
  setStreamingScriptText: FlexibleSetter<string>;
};

export function useFilmChatFlow({
  addWorkflowMsg,
  chatEndRef,
  chatInput,
  chatMessages,
  entityCards,
  extractedParams,
  handleGenerateImage,
  handlePlanCreation,
  handleWorkflowCommand,
  inputText,
  isChatStreaming,
  phase,
  script,
  scriptType,
  selectedService,
  visualStyle,
  setAssetCardsExpanded,
  setAutoGenerateAssets,
  setBgmType,
  setChatInput,
  setChatInputHighlight,
  setChatMessages,
  setChatPlaceholder,
  setComposeStatus,
  setEntityCards,
  setExpandedPhaseSection,
  setExpandedShotIds,
  setExtractedParams,
  setFilmVisualStyle,
  setGenerationLogs,
  setInputText,
  setIsChatStreaming,
  setLogFilter,
  setMiddleAiStatus,
  setPhase,
  setRefEntitiesExpanded,
  setScript,
  setShowChatMessages,
  setShowHistoryPanel,
  setShowLogPanel,
  setStreamingScriptText,
}: UseFilmChatFlowParams) {
  const addAssistantMessage = useCallback((content: string) => {
    setChatMessages(prev => [...prev, {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
    }]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [chatEndRef, setChatMessages]);

  const handleNewConversation = useCallback(() => {
    setScript(null);
    setEntityCards([]);
    setPhase('planning');
    setExpandedPhaseSection(null);
    setFilmVisualStyle('');
    setChatMessages([]);
    setChatInput('');
    setStreamingScriptText('');
    setMiddleAiStatus(null);
    setGenerationLogs([]);
    setBgmType('none');
    setComposeStatus('idle');
    setShowHistoryPanel(false);
    setExpandedShotIds(new Set());
    setRefEntitiesExpanded(true);
    setAssetCardsExpanded(true);
    setAutoGenerateAssets(false);
    setLogFilter('all');
    setShowLogPanel(false);
    setShowChatMessages(true);
    addWorkflowMsg('assistant', '新对话已开始，请输入创作描述或与AI对话开始影视创作', undefined, 'info');
  }, [
    addWorkflowMsg,
    setAssetCardsExpanded,
    setAutoGenerateAssets,
    setBgmType,
    setChatInput,
    setChatMessages,
    setComposeStatus,
    setEntityCards,
    setExpandedPhaseSection,
    setExpandedShotIds,
    setFilmVisualStyle,
    setGenerationLogs,
    setLogFilter,
    setMiddleAiStatus,
    setPhase,
    setRefEntitiesExpanded,
    setScript,
    setShowChatMessages,
    setShowHistoryPanel,
    setShowLogPanel,
    setStreamingScriptText,
  ]);

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || isChatStreaming) return;

    const userContent = chatInput.trim();
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatPlaceholder('输入指令或向AI提问...');
    setChatInputHighlight(false);
    setInputText(userContent);

    const isPureWorkflowCmd = /^(生成|创建|制作|增强|导出|批量|三视图|末帧|桥接|过渡)(创作规划|剧本|分镜|角色|场景|道具|画面|视频|合成|素材|截图|配图|拼接|三宫格)/.test(userContent) ||
      /^(规划|剧本|分镜|合成|导出|生成)$/.test(userContent);
    if (isPureWorkflowCmd) {
      handleWorkflowCommand(userContent);
      return;
    }

    setIsChatStreaming(true);
    setMiddleAiStatus({ type: 'thinking', text: 'AI 正在思考...' });

    const assistantId = `msg_${Date.now()}_ai`;
    setChatMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }]);

    try {
      const contextParts: string[] = [];
      contextParts.push(`⚠️ 以下为当前创作的完整状态，你必须基于这些已有内容进行回复，不要凭空创建与已有内容矛盾的新方案。`);
      contextParts.push(`\n当前创作阶段: ${phase === 'planning' ? '创作规划' : phase === 'visual' ? '画面生成' : '视频合成'}`);

      if (script) {
        contextParts.push(`\n【剧本信息】`);
        contextParts.push(`标题: ${script.title}`);
        if (script.narrationScript) contextParts.push(`旁白/故事描述: ${script.narrationScript.slice(0, 800)}`);
      }

      if (entityCards.length > 0) {
        const storyPoints = entityCards.filter(c => c.type === 'plot');
        const characters = entityCards.filter(c => c.type === 'character');
        const scenes = entityCards.filter(c => c.type === 'scene');
        const shots = entityCards.filter(c => c.type === 'shot');

        contextParts.push(`\n【已创建的创作内容】(共${entityCards.length}项，请严格延续这些已有内容)`);

        if (storyPoints.length > 0) {
          contextParts.push(`\n剧情要点(${storyPoints.length}个):`);
          storyPoints.forEach((card, idx) => {
            const parts = [`${idx + 1}. ${card.name}`];
            if (card.description) parts.push(`   描述: ${card.description.slice(0, 200)}`);
            contextParts.push(parts.join('\n'));
          });
        }
        if (characters.length > 0) {
          contextParts.push(`\n角色(${characters.length}个):`);
          characters.forEach((card, idx) => {
            const parts = [`${idx + 1}. ${card.name}`];
            if (card.description) parts.push(`   描述: ${card.description.slice(0, 200)}`);
            if (card.promptCn) parts.push(`   形象提示词: ${card.promptCn.slice(0, 150)}`);
            if (card.age) parts.push(`   年龄: ${card.age}`);
            if (card.gender) parts.push(`   性别: ${card.gender}`);
            if (card.appearance) parts.push(`   外貌: ${card.appearance.slice(0, 100)}`);
            if (card.personality) parts.push(`   性格: ${card.personality.slice(0, 100)}`);
            if (card.outfit) parts.push(`   服装: ${card.outfit.slice(0, 100)}`);
            if (card.imageUrl) parts.push(`   [已生成角色图片]`);
            contextParts.push(parts.join('\n'));
          });
        }
        if (scenes.length > 0) {
          contextParts.push(`\n场景(${scenes.length}个):`);
          scenes.forEach((card, idx) => {
            const parts = [`${idx + 1}. ${card.name}`];
            if (card.description) parts.push(`   描述: ${card.description.slice(0, 200)}`);
            if (card.promptCn) parts.push(`   场景提示词: ${card.promptCn.slice(0, 150)}`);
            if (card.location) parts.push(`   地点: ${card.location}`);
            if (card.timeOfDay) parts.push(`   时间: ${card.timeOfDay}`);
            if (card.mood) parts.push(`   氛围: ${card.mood}`);
            if (card.imageUrl) parts.push(`   [已生成场景图片]`);
            contextParts.push(parts.join('\n'));
          });
        }
        if (shots.length > 0) {
          contextParts.push(`\n分镜(${shots.length}个):`);
          shots.forEach((card, idx) => {
            const parts = [`${idx + 1}. ${card.name}`];
            if (card.description) parts.push(`   描述: ${card.description.slice(0, 200)}`);
            if (card.shotType) parts.push(`   景别: ${card.shotType}`);
            if (card.cameraAngle) parts.push(`   机位: ${card.cameraAngle}`);
            if (card.dialogue) parts.push(`   对白: ${card.dialogue.slice(0, 100)}`);
            if (card.narration) parts.push(`   旁白: ${card.narration.slice(0, 100)}`);
            if (card.action) parts.push(`   动作: ${card.action.slice(0, 100)}`);
            if (card.imageUrl) parts.push(`   [已生成分镜图片]`);
            if (card.videoUrl) parts.push(`   [已生成分镜视频]`);
            contextParts.push(parts.join('\n'));
          });
        }
      } else {
        contextParts.push('\n【已创建的创作内容】暂无，这是全新创作');
      }

      contextParts.push(`\n【创作配置】`);
      contextParts.push(`剧本类型: ${scriptType}`);
      contextParts.push(`画面风格: ${visualStyle}`);
      if (selectedService) contextParts.push(`当前服务: ${selectedService}`);

      const res = await fetch('/api/film/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
        body: JSON.stringify({
          messages: chatMessages
            .filter(m => m.id !== 'welcome' && !m.isStreaming)
            .concat([userMsg])
            .map(m => ({ role: m.role, content: m.content })),
          context: contextParts.join('\n'),
        }),
      });

      if (!res.ok) throw new Error('对话服务异常');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('无法读取流');

      const decoder = new TextDecoder();
      let fullContent = '';
      let latestParams: Record<string, unknown> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.content) {
                fullContent += parsed.content;
                const displayContent = fullContent
                  .replace(/<<GENERATE_PLAN>>/g, '')
                  .replace(/<<GENERATE_SCRIPT>>/g, '')
                  .replace(/<<GENERATE_CHARACTER>>[\s\S]*?<<\/GENERATE_CHARACTER>>/g, '')
                  .replace(/<<GENERATE_SCENE>>[\s\S]*?<<\/GENERATE_SCENE>>/g, '')
                  .replace(/<<GENERATE_PROP>>[\s\S]*?<<\/GENERATE_PROP>>/g, '')
                  .replace(/<<GENERATE_IMAGE>>[\s\S]*?<<\/GENERATE_IMAGE>>/g, '')
                  .replace(/<<ADJUST>>[\s\S]*?<<\/ADJUST>>/g, '')
                  .replace(/<<QUICK_OPTIONS>>[\s\S]*?<<\/QUICK_OPTIONS>>/g, '')
                  .replace(/\[GENERATE_PLAN\]/g, '')
                  .replace(/\[GENERATE_SCRIPT\]/g, '')
                  .replace(/\[CALL_SKILL:[^\]]*\]/g, '');
                setChatMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId ? { ...m, content: displayContent } : m
                  )
                );
                setMiddleAiStatus({ text: displayContent, type: 'thinking' });
              }
              if (parsed.params) {
                latestParams = { ...latestParams, ...parsed.params };
                setExtractedParams(prev => ({ ...prev, ...parsed.params }));
              }
            } catch {
              // Ignore malformed SSE chunks.
            }
          }
        }
      }

      const cleanContent = fullContent
        .replace(/<<GENERATE_PLAN>>/g, '')
        .replace(/<<GENERATE_SCRIPT>>/g, '')
        .replace(/<<GENERATE_CHARACTER>>[\s\S]*?<<\/GENERATE_CHARACTER>>/g, '')
        .replace(/<<GENERATE_SCENE>>[\s\S]*?<<\/GENERATE_SCENE>>/g, '')
        .replace(/<<GENERATE_PROP>>[\s\S]*?<<\/GENERATE_PROP>>/g, '')
        .replace(/<<GENERATE_IMAGE>>[\s\S]*?<<\/GENERATE_IMAGE>>/g, '')
        .replace(/<<ADJUST>>[\s\S]*?<<\/ADJUST>>/g, '')
        .replace(/<<QUICK_OPTIONS>>[\s\S]*?<<\/QUICK_OPTIONS>>/g, '')
        .replace(/\[GENERATE_PLAN\]/g, '')
        .replace(/\[GENERATE_SCRIPT\]/g, '')
        .replace(/\[CALL_SKILL:[^\]]*\]/g, '')
        .trim();

      const quickOptionsMatch = fullContent.match(/<<QUICK_OPTIONS>>([\s\S]*?)<<\/QUICK_OPTIONS>>/);
      const quickOptions = quickOptionsMatch
        ? quickOptionsMatch[1].trim().split('|').filter(Boolean)
        : [];

      setChatMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: cleanContent, isStreaming: false, quickOptions } : m)
      );

      if (fullContent.includes('<<GENERATE_PLAN>>') || fullContent.includes('[GENERATE_PLAN]')) {
        setPhase('planning');
        setMiddleAiStatus({ type: 'responding', text: '正在生成创作规划...' });
        const paramInput = (latestParams.inputText as string) || (extractedParams.inputText as string);
        if (paramInput) {
          handlePlanCreation(paramInput);
        } else if (inputText.trim()) {
          handlePlanCreation();
        } else {
          const dialogSummary = chatMessages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => {
              const prefix = m.role === 'user' ? '用户' : '助手';
              const content = m.role === 'assistant' && m.content.length > 200
                ? m.content.slice(0, 200) + '...'
                : m.content;
              return `${prefix}: ${content}`;
            })
            .join('\n');
          handlePlanCreation(`基于以下对话内容进行创作:\n${dialogSummary}`);
        }
      }

      const charMatches = fullContent.matchAll(/<<GENERATE_CHARACTER>>([\s\S]*?)<<\/GENERATE_CHARACTER>>/g);
      for (const match of charMatches) {
        setPhase('visual');
        const prompt = match[1].trim();
        void prompt;
        addWorkflowMsg('assistant', `正在生成角色图...`, 'character', 'info');
        setMiddleAiStatus({ type: 'responding', text: '正在生成所有角色图...' });
        const charCards = entityCards.filter((c: EntityCard) => c.type === 'character' && !c.imageUrl);
        for (const card of charCards) {
          handleGenerateImage(card.id);
        }
      }

      const sceneMatches = fullContent.matchAll(/<<GENERATE_SCENE>>([\s\S]*?)<<\/GENERATE_SCENE>>/g);
      for (const match of sceneMatches) {
        void match;
        setPhase('visual');
        addWorkflowMsg('assistant', `正在生成场景图...`, 'scene', 'info');
        setMiddleAiStatus({ type: 'responding', text: '正在生成所有场景图...' });
        const sceneCards = entityCards.filter((c: EntityCard) => c.type === 'scene' && !c.imageUrl);
        for (const card of sceneCards) {
          handleGenerateImage(card.id);
        }
      }

      const propMatches = fullContent.matchAll(/<<GENERATE_PROP>>([\s\S]*?)<<\/GENERATE_PROP>>/g);
      for (const match of propMatches) {
        void match;
        setPhase('visual');
        addWorkflowMsg('assistant', `正在生成道具图...`, 'prop', 'info');
        setMiddleAiStatus({ type: 'responding', text: '正在生成所有道具图...' });
        const propCards = entityCards.filter((c: EntityCard) => c.type === 'prop' && !c.imageUrl);
        for (const card of propCards) {
          handleGenerateImage(card.id);
        }
      }

      const imgMatches = fullContent.matchAll(/<<GENERATE_IMAGE>>([\s\S]*?)<<\/GENERATE_IMAGE>>/g);
      for (const match of imgMatches) {
        void match;
        setPhase('visual');
        addWorkflowMsg('assistant', `正在生成画面...`, 'image', 'info');
        setMiddleAiStatus({ type: 'responding', text: '正在生成所有镜头画面...' });
        const shotCards = entityCards.filter((c: EntityCard) => c.type === 'shot' && !c.imageUrl);
        for (const card of shotCards) {
          handleGenerateImage(card.id);
        }
      }
    } catch {
      setChatMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: '抱歉，对话服务暂时不可用。请稍后重试。', isStreaming: false }
            : m
        )
      );
    } finally {
      setIsChatStreaming(false);
      setMiddleAiStatus(prev => prev?.type === 'thinking' ? { type: 'done', text: 'AI 回复完成' } : prev);
      setTimeout(() => setMiddleAiStatus(prev => prev?.type === 'done' ? null : prev), 3000);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [
    addWorkflowMsg,
    chatEndRef,
    chatInput,
    chatMessages,
    entityCards,
    extractedParams.inputText,
    handleGenerateImage,
    handlePlanCreation,
    handleWorkflowCommand,
    inputText,
    isChatStreaming,
    phase,
    script,
    scriptType,
    selectedService,
    setChatInput,
    setChatInputHighlight,
    setChatMessages,
    setChatPlaceholder,
    setExtractedParams,
    setInputText,
    setIsChatStreaming,
    setMiddleAiStatus,
    setPhase,
    visualStyle,
  ]);

  return { addAssistantMessage, handleNewConversation, handleSendChat };
}

type UseFilmWorkflowCommandParams = {
  addWorkflowMsg: AddWorkflowMessage;
  chatInput: string;
  chatMessages: ChatMessage[];
  entityCards: EntityCard[];
  handleComposeFilm: AsyncVoidHandler;
  handleEnhanceCharacters: AsyncVoidHandler;
  handleEnhanceScenes: AsyncVoidHandler;
  handleExtractLastFrame: AsyncCardHandler;
  handleGenerateAllAssets: AsyncVoidHandler;
  handleGenerateBridge: (prevShotId: string, currentShotId: string) => void | Promise<void>;
  handleGenerateCharacterViews: AsyncCardHandler;
  handleGenerateImage: AsyncCardHandler;
  handleGenerateProps: AsyncVoidHandler;
  handleGenerateShotVideo: AsyncCardHandler;
  handlePlanCreation: (overrideInput?: string) => void | Promise<void>;
  inputText: string;
  setChatInput: Dispatch<SetStateAction<string>>;
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setComposeStatus: Dispatch<SetStateAction<'idle' | 'generating' | 'merging' | 'completed'>>;
  setFinalVideoUrl: Dispatch<SetStateAction<string | null>>;
  setInputText: Dispatch<SetStateAction<string>>;
  setShowChatMessages: Dispatch<SetStateAction<boolean>>;
  setWorkflowInput: Dispatch<SetStateAction<string>>;
};

export function useFilmWorkflowCommand({
  addWorkflowMsg,
  chatInput,
  chatMessages,
  entityCards,
  handleComposeFilm,
  handleEnhanceCharacters,
  handleEnhanceScenes,
  handleExtractLastFrame,
  handleGenerateAllAssets,
  handleGenerateBridge,
  handleGenerateCharacterViews,
  handleGenerateImage,
  handleGenerateProps,
  handleGenerateShotVideo,
  handlePlanCreation,
  inputText,
  setChatInput,
  setChatMessages,
  setComposeStatus,
  setFinalVideoUrl,
  setInputText,
  setShowChatMessages,
  setWorkflowInput,
}: UseFilmWorkflowCommandParams) {
  return useCallback(async (command: string) => {
    const cmd = command.trim();
    if (!cmd) return;

    // 同时添加到创作进度和对话消息，确保用户在对话框能看到
    addWorkflowMsg('user', cmd);
    const userChatMsg: ChatMessage = { id: `chat-${Date.now()}`, role: 'user', content: cmd, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userChatMsg]);
    setWorkflowInput('');
    setChatInput('');

    const lowerCmd = cmd.toLowerCase();

    // 辅助函数：同时向进度和对话发送助手消息
    const addAssistantMsg = (content: string, step?: string, msgType?: 'progress' | 'success' | 'error' | 'info', nextStep?: string) => {
      addWorkflowMsg('assistant', content, step, msgType, nextStep);
      const assistMsg: ChatMessage = { id: `chat-${Date.now()}-resp`, role: 'assistant', content, timestamp: Date.now() };
      setChatMessages(prev => [...prev, assistMsg]);
    };

    // 命令路由
    if (lowerCmd.includes('规划') || lowerCmd.includes('剧本') || lowerCmd.includes('创作规划') || lowerCmd.includes('生成规划')) {
      // 构建创意输入：优先使用左栏创意输入，其次从对话历史中提取已确认的创作方向
      let creativeInput = inputText.trim();
      if (!creativeInput) {
        // 从对话历史中提取用户已确认的创作方向
        const userMessages = chatMessages
          .filter((m: ChatMessage) => m.role === 'user')
          .map((m: ChatMessage) => m.content)
          .filter(Boolean);
        // 也包含assistant消息中用「」标记的已确认方向
        const confirmedDirections = chatMessages
          .filter((m: ChatMessage) => m.role === 'assistant')
          .map((m: ChatMessage) => {
            const matches = m.content.match(/「[^」]+」/g);
            return matches ? matches.join('') : '';
          })
          .filter(Boolean);
        creativeInput = [...confirmedDirections, ...userMessages].join('，');
      }
      if (!creativeInput && entityCards.length === 0) {
        addAssistantMsg(
          '请先在下方输入框描述你想创作的影视内容，例如："一个关于时间旅行的科幻故事"。\n\n' +
          '输入后点击发送或按回车，我会自动为你生成创作规划。',
          undefined, 'info');
        return;
      }
      addAssistantMsg(`好的，正在根据对话中已确认的创作方向生成规划...\n${creativeInput.slice(0, 200)}${creativeInput.length > 200 ? '...' : ''}`, 'planning', 'info');
      handlePlanCreation(creativeInput);
    } else if (lowerCmd.includes('分镜') || lowerCmd.includes('画面') || lowerCmd.includes('截图') || lowerCmd.includes('配图')) {
      const shotCards = entityCards.filter((c: EntityCard) => c.type === 'shot' && !c.images?.[0]);
      if (shotCards.length === 0) {
        addAssistantMsg('当前没有需要生成画面的镜头。请先生成创作规划。', undefined, 'info');
        return;
      }
      addAssistantMsg(`正在为 ${shotCards.length} 个镜头生成分镜画面...`, 'image', 'info');
      for (const card of shotCards) {
        handleGenerateImage(card.id);
      }
    } else if (lowerCmd.includes('视频') || lowerCmd.includes('生成视频') || lowerCmd.includes('拍')) {
      const shotCards = entityCards.filter((c: EntityCard) => c.type === 'shot' && c.images?.[0] && !c.videoUrl);
      if (shotCards.length === 0) {
        addAssistantMsg('当前没有可以生成视频的镜头。请先生成分镜画面。', undefined, 'info');
        return;
      }
      addAssistantMsg(`正在为 ${shotCards.length} 个镜头生成视频...`, 'video', 'info');
      for (const card of shotCards) {
        handleGenerateShotVideo(card.id);
      }
    } else if (lowerCmd.includes('合成') || lowerCmd.includes('拼接') || lowerCmd.includes('导出') || lowerCmd.includes('重新合成') || lowerCmd.includes('重合成')) {
      addAssistantMsg('正在合成所有镜头视频...', 'compose', 'info');
      setComposeStatus('idle');
      setFinalVideoUrl(null);
      setTimeout(() => handleComposeFilm(), 50);
    } else if (lowerCmd.includes('桥接') || lowerCmd.includes('过渡') || lowerCmd.includes('三宫格')) {
      // 生成桥接图
      const shotCards = entityCards.filter((c: EntityCard) => c.type === 'shot' && c.videoUrl);
      if (shotCards.length < 2) {
        addWorkflowMsg('assistant', '至少需要2个已生成视频的镜头才能创建过渡桥接。', undefined, 'info');
        return;
      }
      addWorkflowMsg('assistant', `正在生成 ${shotCards.length - 1} 个桥接过渡...`, 'bridge', 'info');
      for (let i = 1; i < shotCards.length; i++) {
        handleGenerateBridge(shotCards[i - 1].id, shotCards[i].id);
      }
    } else if (lowerCmd.includes('增强角色') || lowerCmd.includes('角色增强') || lowerCmd.includes('优化角色')) {
      // 使用 character-prompt API 增强角色描述
      addWorkflowMsg('assistant', '正在使用AI增强角色描述和外貌细节...', 'character', 'info');
      handleEnhanceCharacters();
    } else if (lowerCmd.includes('增强场景') || lowerCmd.includes('场景增强') || lowerCmd.includes('优化场景')) {
      // 使用 scene-generate API 增强场景描述并生成氛围图
      addWorkflowMsg('assistant', '正在使用AI增强场景描述并生成氛围图...', 'scene', 'info');
      handleEnhanceScenes();
    } else if (lowerCmd.includes('生成道具') || lowerCmd.includes('道具生成') || lowerCmd.includes('提取道具')) {
      addWorkflowMsg('assistant', '正在使用AI提取道具并生成参考图...', 'prop', 'info');
      handleGenerateProps();
    } else if (lowerCmd.includes('三视图') || lowerCmd.includes('角色参考') || lowerCmd.includes('角色图')) {
      // 使用 character-views API 生成角色三视图
      const charCards = entityCards.filter((c: EntityCard) => c.type === 'character' && !c.imageUrl);
      if (charCards.length === 0) {
        addAssistantMsg('当前没有需要生成三视图的角色。', undefined, 'info');
        return;
      }
      addAssistantMsg(`正在为 ${charCards.length} 个角色生成三视图...`, 'character', 'info');
      for (const card of charCards) {
        handleGenerateCharacterViews(card.id);
      }
    } else if (lowerCmd.includes('批量素材') || lowerCmd.includes('生成所有素材') || lowerCmd.includes('全部生成')) {
      // 使用 generate-assets API 批量生成
      addAssistantMsg('正在批量生成所有素材（角色图+场景图+道具图+分镜图）...', 'asset', 'info');
      handleGenerateAllAssets();
    } else if (lowerCmd.includes('尾帧') || lowerCmd.includes('最后一帧') || lowerCmd.includes('提取帧')) {
      // 提取已有视频的尾帧
      const videoCards = entityCards.filter((c: EntityCard) => c.type === 'shot' && c.videoUrl && !c.lastFrameUrl);
      if (videoCards.length === 0) {
        addAssistantMsg('当前没有需要提取尾帧的视频。', undefined, 'info');
        return;
      }
      addAssistantMsg(`正在为 ${videoCards.length} 个视频提取尾帧...`, 'frame', 'info');
      for (const card of videoCards) {
        handleExtractLastFrame(card.id);
      }
    } else {
      // 其他输入作为创作提示词，优先使用左栏创意输入
      const creativeInput = inputText.trim() || cmd;
      addAssistantMsg('收到！正在根据创意内容生成创作规划...', 'planning', 'info');
      if (!inputText.trim()) {
        setInputText(chatInput.trim() || cmd);
      }
      if (chatInput.trim()) {
        setChatInput('');
      }
      handlePlanCreation(creativeInput);
    }
  }, [addWorkflowMsg, inputText, chatInput, entityCards, handlePlanCreation, handleGenerateImage, handleGenerateShotVideo, handleComposeFilm, handleGenerateBridge, handleEnhanceCharacters, handleEnhanceScenes, handleGenerateCharacterViews, handleGenerateAllAssets, handleExtractLastFrame, handleGenerateProps, setChatMessages, setWorkflowInput, setChatInput, setComposeStatus, setFinalVideoUrl, setInputText, setShowChatMessages]);
}


type UseFilmQuickCommandParams = {
  addWorkflowMsg: AddWorkflowMessage;
  chatInput: string;
  chatInputRef: RefObject<HTMLInputElement | null>;
  chatMessages: ChatMessage[];
  entityCards: EntityCard[];
  handleComposeFilm: AsyncVoidHandler;
  handleEnhanceCharacters: AsyncVoidHandler;
  handleEnhanceScenes: AsyncVoidHandler;
  handleGenerateAllAssets: AsyncVoidHandler;
  handleGenerateImage: AsyncCardHandler;
  handlePlanCreation: (overrideInput?: string) => void | Promise<void>;
  inputText: string;
  setChatInput: Dispatch<SetStateAction<string>>;
  setChatInputHighlight: Dispatch<SetStateAction<boolean>>;
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setChatPlaceholder: Dispatch<SetStateAction<string>>;
  setComposeStatus: Dispatch<SetStateAction<'idle' | 'generating' | 'merging' | 'completed'>>;
  setFinalVideoUrl: Dispatch<SetStateAction<string | null>>;
  setMiddleAiStatus: Dispatch<SetStateAction<{ text: string; type: 'thinking' | 'responding' | 'done' | 'error' } | null>>;
  setPhase: Dispatch<SetStateAction<'planning' | 'visual' | 'compose'>>;
  setShowChatMessages: Dispatch<SetStateAction<boolean>>;
};

export function useFilmQuickCommand({
  addWorkflowMsg,
  chatInput,
  chatInputRef,
  chatMessages,
  entityCards,
  handleComposeFilm,
  handleEnhanceCharacters,
  handleEnhanceScenes,
  handleGenerateAllAssets,
  handleGenerateImage,
  handlePlanCreation,
  inputText,
  setChatInput,
  setChatInputHighlight,
  setChatMessages,
  setChatPlaceholder,
  setComposeStatus,
  setFinalVideoUrl,
  setMiddleAiStatus,
  setPhase,
  setShowChatMessages,
}: UseFilmQuickCommandParams) {
  return useCallback((cmdKey: string) => {
    const cmdLabelMap: Record<string, string> = {
      generate_script: '生成脚本',
      enhance_character: '增强角色',
      enhance_scene: '增强场景',
      generate_props: '提取道具',
      batch_generate: '批量生成',
      generate_start_frame: '生成起始帧',
      extend_prompt: '提示词扩展',
      compose_video: '合成视频',
    };
    const label = cmdLabelMap[cmdKey] || cmdKey;

    // 添加用户消息到对话
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: label,
      timestamp: Date.now(),
    };
    setChatMessages(prev => [...prev, userMsg]);

    // 直接触发对应生成链路
    if (cmdKey === 'generate_script') {
      // 生成脚本：使用左栏输入或对话历史作为创意输入
      setMiddleAiStatus({ type: 'responding', text: '正在生成创作规划...' });
      addWorkflowMsg('user', '生成脚本');
      if (inputText.trim()) {
        handlePlanCreation(inputText.trim());
      } else {
        // 从对话历史中提取创作方向
        const userMsgs = chatMessages
          .filter((m: ChatMessage) => m.role === 'user')
          .map((m: ChatMessage) => m.content)
          .filter(Boolean);
        const creativeInput = userMsgs.join('，');
        if (creativeInput) {
          handlePlanCreation(creativeInput);
        } else {
          setMiddleAiStatus({ type: 'error', text: '请先输入创作描述再生成脚本' });
          const assistMsg: ChatMessage = { id: `msg_${Date.now()}_ai`, role: 'assistant', content: '请先在左侧输入框描述你想创作的影视内容，然后再点击"生成脚本"。', timestamp: Date.now() };
          setChatMessages(prev => [...prev, assistMsg]);
          return;
        }
      }
      const assistMsg: ChatMessage = { id: `msg_${Date.now()}_ai`, role: 'assistant', content: '正在为你生成创作规划，请稍候...', timestamp: Date.now() };
      setChatMessages(prev => [...prev, assistMsg]);
    }
    else if (cmdKey === 'enhance_character') {
      setMiddleAiStatus({ type: 'responding', text: '正在增强角色描述...' });
      addWorkflowMsg('user', '增强角色');
      handleEnhanceCharacters();
      const assistMsg: ChatMessage = { id: `msg_${Date.now()}_ai`, role: 'assistant', content: '正在增强角色描述，请稍候...', timestamp: Date.now() };
      setChatMessages(prev => [...prev, assistMsg]);
    }
    else if (cmdKey === 'enhance_scene') {
      setMiddleAiStatus({ type: 'responding', text: '正在增强场景描述...' });
      addWorkflowMsg('user', '增强场景');
      handleEnhanceScenes();
      const assistMsg: ChatMessage = { id: `msg_${Date.now()}_ai`, role: 'assistant', content: '正在增强场景描述，请稍候...', timestamp: Date.now() };
      setChatMessages(prev => [...prev, assistMsg]);
    }
    else if (cmdKey === 'generate_props') {
      setPhase('visual');
      setMiddleAiStatus({ type: 'responding', text: '正在提取道具...' });
      addWorkflowMsg('user', '提取道具');
      handleGenerateAllAssets();
      const assistMsg: ChatMessage = { id: `msg_${Date.now()}_ai`, role: 'assistant', content: '正在提取并生成道具，请稍候...', timestamp: Date.now() };
      setChatMessages(prev => [...prev, assistMsg]);
    }
    else if (cmdKey === 'batch_generate') {
      setPhase('visual');
      const shotCards = entityCards.filter((c: EntityCard) => c.type === 'shot' && !c.imageUrl);
      if (shotCards.length === 0) {
        const assistMsg: ChatMessage = { id: `msg_${Date.now()}_ai`, role: 'assistant', content: '当前没有需要生成画面的镜头，请先生成创作规划。', timestamp: Date.now() };
        setChatMessages(prev => [...prev, assistMsg]);
        return;
      }
      setMiddleAiStatus({ type: 'responding', text: `正在批量生成 ${shotCards.length} 个镜头画面...` });
      addWorkflowMsg('user', '批量生成');
      for (const card of shotCards) {
        handleGenerateImage(card.id);
      }
      const assistMsg: ChatMessage = { id: `msg_${Date.now()}_ai`, role: 'assistant', content: `正在为 ${shotCards.length} 个镜头批量生成画面，请稍候...`, timestamp: Date.now() };
      setChatMessages(prev => [...prev, assistMsg]);
    }
    else if (cmdKey === 'generate_start_frame') {
      setPhase('visual');
      const shotCards = entityCards.filter((c: EntityCard) => c.type === 'shot' && !c.imageUrl);
      if (shotCards.length === 0) {
        const assistMsg: ChatMessage = { id: `msg_${Date.now()}_ai`, role: 'assistant', content: '当前没有需要生成起始帧的镜头。', timestamp: Date.now() };
        setChatMessages(prev => [...prev, assistMsg]);
        return;
      }
      setMiddleAiStatus({ type: 'responding', text: '正在生成起始帧...' });
      addWorkflowMsg('user', '生成起始帧');
      handleGenerateImage(shotCards[0].id);
      const assistMsg: ChatMessage = { id: `msg_${Date.now()}_ai`, role: 'assistant', content: '正在生成起始帧画面，请稍候...', timestamp: Date.now() };
      setChatMessages(prev => [...prev, assistMsg]);
    }
    else if (cmdKey === 'extend_prompt') {
      // 提示词扩展：需要用户补充扩展方向，高亮输入框引导
      setChatInput('提示词扩展：');
      setChatPlaceholder('请输入扩展方向，如：更细腻的光影、更多细节描述...');
      setChatInputHighlight(true);
      setTimeout(() => {
        chatInputRef.current?.focus();
        chatInputRef.current?.setSelectionRange('提示词扩展：'.length, '提示词扩展：'.length);
      }, 50);
      setTimeout(() => setChatInputHighlight(false), 3000);
      return; // 等用户输入后按发送，handleSendChat会处理
    }
    else if (cmdKey === 'compose_video') {
      setPhase('compose');
      const shotCards = entityCards.filter((c: EntityCard) => c.type === 'shot' && c.videoUrl);
      if (shotCards.length === 0) {
        const assistMsg: ChatMessage = { id: `msg_${Date.now()}_ai`, role: 'assistant', content: '当前没有已生成视频的镜头，请先生成分镜画面和视频。', timestamp: Date.now() };
        setChatMessages(prev => [...prev, assistMsg]);
        return;
      }
      setMiddleAiStatus({ type: 'responding', text: '正在合成视频...' });
      addWorkflowMsg('user', '合成视频');
      setComposeStatus('idle');
      setFinalVideoUrl(null);
      setTimeout(() => handleComposeFilm(), 50);
      const assistMsg: ChatMessage = { id: `msg_${Date.now()}_ai`, role: 'assistant', content: '正在合成所有镜头视频，请稍候...', timestamp: Date.now() };
      setChatMessages(prev => [...prev, assistMsg]);
    }

    // 自动展开对话消息区
    setShowChatMessages(true);
  }, [inputText, chatInput, chatMessages, entityCards, handlePlanCreation, handleEnhanceCharacters, handleEnhanceScenes, handleGenerateAllAssets, handleGenerateImage, handleComposeFilm, addWorkflowMsg, setPhase, setMiddleAiStatus, setChatMessages, setChatInput, setChatPlaceholder, setChatInputHighlight, chatInputRef, setComposeStatus, setFinalVideoUrl, setShowChatMessages]);
}
