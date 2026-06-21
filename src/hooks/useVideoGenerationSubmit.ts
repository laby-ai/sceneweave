import { useCallback, type MutableRefObject } from 'react';
import { getBYOKRequestHeaders } from '@/lib/byok-client';
import type { Material } from '@/components/material-upload';
import type { SubtitleConfig } from '@/constants/subtitles';
import type { LibraryTrack } from '@/constants/music-library';
import type { SfxBinding } from '@/constants/sfx-types';
import type { VideoConfig } from '@/lib/video-generation-form-model';
import type { BackgroundTask } from '@/types/task';

type UseVideoGenerationSubmitArgs = {
  abortControllerRef: MutableRefObject<AbortController | null>;
  addTask: (task: Omit<BackgroundTask, 'id' | 'createdAt'> & { id?: string }) => string;
  backgroundBgm: string;
  colorTheme: string;
  currentStrategy: { shouldUseSegmentedGeneration: (duration: number) => boolean };
  customAudio: { url: string; name: string; size: number } | null;
  duration: string;
  enableSubtitle: boolean;
  filter: string;
  generateVoice: boolean;
  getFinalPrompt: () => string;
  isMountedRef: MutableRefObject<boolean>;
  language: string;
  materials: Material[];
  mood: string;
  onGenerate: (video: VideoConfig) => void;
  prompt: string;
  ratio: string;
  resolution: string;
  runInBackground: boolean;
  selectedLibraryTrack: LibraryTrack | null;
  setEnhancedPrompt: (value: string) => void;
  setGenerationMessage: (value: string) => void;
  setGenerationProgress: (value: number) => void;
  setGenerationStage: (value: string) => void;
  setIsGenerating: (value: boolean) => void;
  setPrompt: (value: string) => void;
  setRunInBackground: (value: boolean) => void;
  smartEnhance: boolean;
  style: string;
  subtitleColor: string;
  subtitleConfig: SubtitleConfig;
  subtitleFontSize: string;
  subtitlePosition: string;
  subtitleSpeechSpeed: number;
  subtitleText: string;
  subtitleVoiceType: string;
  timeoutRef: MutableRefObject<NodeJS.Timeout | null>;
  updateTask: (id: string, updates: Partial<BackgroundTask>) => void;
  useNineGrid: boolean;
  userNineGridImages: string[];
  watermark: boolean;
};

export function useVideoGenerationSubmit(args: UseVideoGenerationSubmitArgs) {
  const {
    abortControllerRef,
    addTask,
    backgroundBgm,
    colorTheme,
    currentStrategy,
    customAudio,
    duration,
    enableSubtitle,
    filter,
    generateVoice,
    getFinalPrompt,
    isMountedRef,
    language,
    materials,
    mood,
    onGenerate,
    prompt,
    ratio,
    resolution,
    runInBackground,
    selectedLibraryTrack,
    setEnhancedPrompt,
    setGenerationMessage,
    setGenerationProgress,
    setGenerationStage,
    setIsGenerating,
    setPrompt,
    setRunInBackground,
    smartEnhance,
    style,
    subtitleColor,
    subtitleConfig,
    subtitleFontSize,
    subtitlePosition,
    subtitleSpeechSpeed,
    subtitleText,
    subtitleVoiceType,
    timeoutRef,
    updateTask,
    useNineGrid,
    userNineGridImages,
    watermark,
  } = args;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) {
      alert('请输入视频描述');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStage('准备中...');
    setGenerationMessage('正在提交任务...');

    const isLongDuration = parseInt(duration) > 5;
    const isHighResolution = resolution === '1080p';
    const hasSubtitleOrVoice = enableSubtitle || generateVoice;

    if (!runInBackground && (isLongDuration || isHighResolution || hasSubtitleOrVoice)) {
      const warningParts = [];
      if (isLongDuration) warningParts.push(`视频时长>${duration}秒`);
      if (isHighResolution) warningParts.push('高分辨率');
      if (hasSubtitleOrVoice) warningParts.push('字幕/配音');

      const confirmBackground = confirm(
        `当前配置可能导致生成时间较长（${warningParts.join(' · ')}）\n\n建议使用「后台生成」模式，生成完成后可在任务中心查看结果。\n\n是否切换到后台生成模式？`
      );
      if (confirmBackground) {
        setRunInBackground(true);
        setIsGenerating(false);
        setGenerationProgress(0);
        setGenerationStage('');
        setGenerationMessage('');
        setTimeout(() => handleSubmit(e), 100);
        return;
      }
    }

    const finalPrompt = getFinalPrompt();
    abortControllerRef.current = new AbortController();

    try {
      const durationValue = parseInt(duration);
      const apiEndpoints: string[] = [];

      if (useNineGrid) {
        apiEndpoints.push('/api/video/nine-grid');
      }

      if (currentStrategy.shouldUseSegmentedGeneration(durationValue)) {
        apiEndpoints.push('/api/video/merge');
      }

      apiEndpoints.push('/api/video/submit');

      console.log('[Video Generation] API尝试序列:', {
        duration: durationValue,
        useNineGrid,
        apiEndpoints,
      });

      let submitResponse: Response | null = null;
      let lastError: Error | null = null;
      let usedEndpoint = '';

      for (let i = 0; i < apiEndpoints.length; i++) {
        const endpoint = apiEndpoints[i];
        try {
          console.log(`[Video Generation] 尝试API ${i + 1}/${apiEndpoints.length}: ${endpoint}`);

          const submitParams = {
            prompt: finalPrompt,
            duration: parseInt(duration),
            smartEnhance,
            watermark,
            style,
            mood,
            filter,
            colorTheme,
            resolution,
            ratio,
            language,
            materials: materials.map(m => m.url),
            enableSubtitle,
            subtitleText: enableSubtitle ? subtitleText : undefined,
            subtitlePosition: enableSubtitle ? subtitlePosition : undefined,
            subtitleFontSize: enableSubtitle ? subtitleFontSize : undefined,
            subtitleColor: enableSubtitle ? subtitleColor : undefined,
            subtitleVoiceType: enableSubtitle ? subtitleVoiceType : undefined,
            subtitleSpeechSpeed: enableSubtitle ? subtitleSpeechSpeed : undefined,
            generateVoice: enableSubtitle ? generateVoice : false,
            subtitleFontWeight: enableSubtitle ? subtitleConfig?.style?.fontWeight : undefined,
            subtitleBackgroundColor: enableSubtitle ? subtitleConfig?.style?.backgroundColor : undefined,
            subtitleBackgroundOpacity: enableSubtitle ? subtitleConfig?.style?.opacity : undefined,
            subtitleBorderColor: enableSubtitle ? subtitleConfig?.style?.borderColor : undefined,
            subtitleBorderWidth: enableSubtitle ? (subtitleConfig?.style?.hasBorder ? 2 : 0) : undefined,
            subtitleShadowColor: enableSubtitle ? subtitleConfig?.style?.shadowColor : undefined,
            subtitleShadowEnabled: enableSubtitle ? subtitleConfig?.style?.hasShadow : undefined,
            aiAudioPrompt: generateVoice && subtitleConfig?.aiAudioPrompt ? subtitleConfig.aiAudioPrompt : undefined,
            audioUrl: subtitleConfig?.audioUrl,
            audioPrompt: subtitleConfig?.audioPrompt,
            subtitleEnabled: enableSubtitle,
            subtitlePrompt: enableSubtitle ? subtitleText : undefined,
            enableVideoText: subtitleConfig.enableVideoText,
            videoText: subtitleConfig.enableVideoText && subtitleConfig.videoTextSegments.length > 0
              ? subtitleConfig.videoTextSegments[0].text
              : undefined,
            videoTextPosition: subtitleConfig.enableVideoText && subtitleConfig.videoTextSegments.length > 0
              ? subtitleConfig.videoTextSegments[0].position
              : undefined,
            videoTextCustomPositionY: subtitleConfig.enableVideoText && subtitleConfig.videoTextSegments.length > 0
              ? subtitleConfig.videoTextSegments[0].customPositionY
              : undefined,
            videoTextCustomPositionX: subtitleConfig.enableVideoText && subtitleConfig.videoTextSegments.length > 0
              ? subtitleConfig.videoTextSegments[0].customPositionX
              : undefined,
            videoTextStartTime: subtitleConfig.enableVideoText && subtitleConfig.videoTextSegments.length > 0
              ? subtitleConfig.videoTextSegments[0].startTime
              : undefined,
            videoTextEndTime: subtitleConfig.enableVideoText && subtitleConfig.videoTextSegments.length > 0
              ? subtitleConfig.videoTextSegments[0].endTime
              : undefined,
            useMultiSegmentVideoText: subtitleConfig.useMultiSegmentVideoText,
            videoTextSegments: subtitleConfig.useMultiSegmentVideoText
              ? subtitleConfig.videoTextSegments.map(seg => ({
                  ...seg,
                  customPositionX: seg.position === 'custom' ? seg.customPositionX : 50,
                  customPositionY: seg.position === 'custom' ? seg.customPositionY :
                    seg.position === 'upper-third' ? 33 :
                    seg.position === 'lower-third' ? 67 :
                    seg.position === 'top' ? 10 :
                    seg.position === 'bottom' ? 90 : 50,
                }))
              : undefined,
            showSubtitleWithVoice: subtitleConfig.showSubtitleWithVoice !== false,
            userNineGridImages: useNineGrid ? userNineGridImages.filter(img => img) : undefined,
            async: runInBackground,
            backgroundBgm: backgroundBgm !== 'none' ? backgroundBgm : undefined,
            customAudio: backgroundBgm === 'custom' ? customAudio : undefined,
            libraryTrack: backgroundBgm === 'library' ? selectedLibraryTrack : undefined,
            pipelineMode: smartEnhance ? 't2i2v' : 't2v',
            motionScore: smartEnhance ? 5 : undefined,
          };

          console.log('[Video Generation] 提交参数:', JSON.stringify(submitParams, null, 2));
          console.log('[Video Generation] 关键参数检查:');
          console.log('  - enableVideoText:', subtitleConfig.enableVideoText);
          console.log('  - useMultiSegmentVideoText:', subtitleConfig.useMultiSegmentVideoText);
          console.log('  - videoTextSegments:', subtitleConfig.videoTextSegments);
          console.log('  - enableSubtitle:', enableSubtitle);
          console.log('  - subtitleText:', subtitleText);
          console.log('  - subtitleConfig:', subtitleConfig);
          console.log('  - generateVoice:', generateVoice);

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getBYOKRequestHeaders(),
            },
            body: JSON.stringify(submitParams),
          });

          if (response.ok) {
            submitResponse = response;
            usedEndpoint = endpoint;
            console.log(`[Video Generation] API成功: ${endpoint}`);
            break;
          }

          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.warn(`[Video Generation] API ${endpoint} 返回错误:`, errorData);

          if (i < apiEndpoints.length - 1) {
            lastError = new Error(errorData.error || `API ${endpoint} failed`);
            continue;
          }

          submitResponse = response;
          usedEndpoint = endpoint;
        } catch (error) {
          console.warn(`[Video Generation] API ${endpoint} 网络错误:`, error);
          lastError = error as Error;

          if (i < apiEndpoints.length - 1) {
            continue;
          }
        }
      }

      if (!submitResponse) {
        throw lastError || new Error('所有API调用都失败了');
      }

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json();
        throw new Error(errorData.error || '提交任务失败');
      }

      const { taskId } = await submitResponse.json();
      let successMessage = '任务已提交，正在生成中...';
      if (usedEndpoint) {
        const apiName = usedEndpoint.includes('nine-grid') ? '九宫格模式' :
                        usedEndpoint.includes('merge') ? '分段生成模式' : '直接生成模式';
        successMessage = `已使用${apiName}提交任务，正在生成中...`;
      }

      console.log(`[Video Generation] Task submitted: ${taskId}, API: ${usedEndpoint}`);
      setGenerationMessage(successMessage);

      addTask({
        id: taskId,
        type: 'video',
        status: 'running',
        config: {
          prompt: finalPrompt,
          duration,
          style,
          mood,
          filter,
          colorTheme,
          resolution,
          ratio,
          language,
          smartEnhance,
          watermark,
          materials: materials.map(m => m.url),
          enableSubtitle,
          subtitleText,
          subtitlePosition,
          subtitleFontSize,
          subtitleColor,
          subtitleVoiceType,
          subtitleSpeechSpeed,
          generateVoice,
        },
        progress: 5,
        stage: '初始化...',
      });

      console.log('[Video Generation] Task added to task center:', taskId);

      if (runInBackground) {
        setIsGenerating(false);
        setGenerationProgress(0);
        setGenerationStage('');
        setGenerationMessage('');
        setPrompt('');
        setEnhancedPrompt('');
        alert('任务已提交到后台生成，您可以在任务中心查看进度');
        return;
      }

      const pollInterval = 2000;
      const maxPollTime = 30 * 60 * 1000;
      const startTime = Date.now();

      const pollTaskStatus = async (retryCount = 0): Promise<void> => {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('AbortError');
        }

        if (Date.now() - startTime > maxPollTime) {
          throw new Error('任务执行超时');
        }

        try {
          const response = await fetch(`/api/tasks/${taskId}`, {
            signal: abortControllerRef.current?.signal,
          });

          if (response.status === 404) {
            if (retryCount < 5) {
              console.log(`[Video Generation] Task not found, retrying... (${retryCount + 1}/5)`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              return pollTaskStatus(retryCount + 1);
            }
            throw new Error('任务不存在，可能已被删除');
          }

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `获取任务状态失败: ${response.status}`);
          }

          const { task } = await response.json();

          if (!task) {
            throw new Error('任务数据为空');
          }

          setGenerationProgress(task.progress);
          setGenerationStage(task.stage || '');
          if (task.message) {
            setGenerationMessage(task.message);
          }

          updateTask(taskId, {
            progress: task.progress,
            stage: task.stage,
            message: task.message,
            status: task.status,
            result: task.result,
            error: task.error,
            completedAt: task.completedAt,
          });

          if (task.status === 'completed') {
            setGenerationProgress(100);
            setGenerationStage('完成！');
            setGenerationMessage('视频生成成功！');

            onGenerate({
              id: Date.now().toString(),
              videoUrl: task.result?.videoUrl,
              prompt: finalPrompt,
              createdAt: Date.now(),
              duration,
              style,
              mood,
              filter,
              colorTheme,
              resolution,
              ratio,
              hasSubtitle: task.result?.hasSubtitle || false,
              materials: materials,
              enableSubtitle: enableSubtitle,
              subtitleText: subtitleText,
              subtitlePosition: subtitlePosition,
              subtitleFontSize: subtitleFontSize,
              subtitleColor: subtitleColor,
              subtitleVoiceType: subtitleVoiceType,
              subtitleSpeechSpeed: subtitleSpeechSpeed,
              generateVoice: generateVoice,
              enableVideoText: subtitleConfig.enableVideoText,
              videoText: subtitleConfig.videoTextSegments.length > 0 ? subtitleConfig.videoTextSegments[0].text : '',
              videoTextPosition: subtitleConfig.videoTextSegments.length > 0 ? subtitleConfig.videoTextSegments[0].position : 'middle',
              videoTextStartTime: subtitleConfig.videoTextSegments.length > 0 ? subtitleConfig.videoTextSegments[0].startTime : 0,
              videoTextEndTime: subtitleConfig.videoTextSegments.length > 0 ? subtitleConfig.videoTextSegments[0].endTime : parseInt(duration),
              videoTextSegments: subtitleConfig.videoTextSegments,
            });

            setIsGenerating(false);
            setPrompt('');
            setEnhancedPrompt('');

            timeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                setGenerationProgress(0);
                setGenerationStage('');
                setGenerationMessage('');
              }
              timeoutRef.current = null;
            }, 2000);

            return;
          } else if (task.status === 'failed') {
            throw new Error(task.error || '生成失败');
          } else if (task.status === 'cancelled') {
            setIsGenerating(false);
            setGenerationProgress(0);
            setGenerationStage('');
            setGenerationMessage('');
            return;
          }

          await new Promise(resolve => setTimeout(resolve, pollInterval));
          return pollTaskStatus(0);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw error;
          }
          throw error;
        }
      };

      await pollTaskStatus();
    } catch (error) {
      console.error('[Video Generation] Error:', error);

      if (error instanceof Error && error.name === 'AbortError') {
        console.log('请求已取消');
        setIsGenerating(false);
        return;
      }

      if (isMountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : '生成失败，请重试';
        setGenerationProgress(0);
        setGenerationStage('');
        setGenerationMessage('');
        setIsGenerating(false);

        const isTimeoutError = errorMessage.includes('超时') || errorMessage.includes('timeout') || errorMessage.includes('902');

        if (isTimeoutError) {
          const suggestedDuration = parseInt(duration) > 5 ? '5' : duration;
          const suggestedResolution = resolution === '1080p' ? '720p' : resolution;

          alert(`视频生成超时（${errorMessage}）\n\n建议解决方案：\n1. 使用「后台生成」模式（推荐）\n2. 缩短视频时长至 ${suggestedDuration} 秒\n3. 降低分辨率至 ${suggestedResolution}\n4. 关闭字幕和配音功能\n5. 稍后重试`);
        } else {
          alert('视频生成失败: ' + errorMessage);
        }
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [
    abortControllerRef,
    addTask,
    backgroundBgm,
    colorTheme,
    currentStrategy,
    customAudio,
    duration,
    enableSubtitle,
    filter,
    generateVoice,
    getFinalPrompt,
    isMountedRef,
    language,
    materials,
    mood,
    onGenerate,
    prompt,
    ratio,
    resolution,
    runInBackground,
    selectedLibraryTrack,
    setEnhancedPrompt,
    setGenerationMessage,
    setGenerationProgress,
    setGenerationStage,
    setIsGenerating,
    setPrompt,
    setRunInBackground,
    smartEnhance,
    style,
    subtitleColor,
    subtitleConfig,
    subtitleFontSize,
    subtitlePosition,
    subtitleSpeechSpeed,
    subtitleText,
    subtitleVoiceType,
    timeoutRef,
    updateTask,
    useNineGrid,
    userNineGridImages,
    watermark,
  ]);

  return { handleSubmit };
}
