'use client';

import { TaskCenter } from '@/components/task-center';
import { TaskProgressCard } from '@/components/task-progress-card';
import type { MonitorTask } from '@/lib/video-monitor';
import type { MediaSubSection } from '@/components/home/dreambox-media-section';

export function DreamboxTasksSection({
  activeSection,
  taskViewMode,
  setTaskViewMode,
  syncFromServer,
  setActiveSection,
  setVideoInitialConfig,
  setImageInitialConfig,
  setMediaSubSection,
  setCurrentVideo,
  setCurrentImages,
  setCurrentCopywriting,
  setShowCopywritingDialog,
  setCurrentStoryboardTask,
  setShowStoryboardDialog,
  monitorTasks,
  monitorDetails,
  backgroundTasks,
  removeTask,
  cancelTask,
}: {
  activeSection: string;
  taskViewMode: 'list' | 'monitor';
  setTaskViewMode: (mode: 'list' | 'monitor') => void;
  syncFromServer: () => void | Promise<void>;
  setActiveSection: (section: string) => void;
  setVideoInitialConfig: (config: any) => void;
  setImageInitialConfig: (config: any) => void;
  setMediaSubSection: (section: MediaSubSection) => void;
  setCurrentVideo: (video: any) => void;
  setCurrentImages: (images: any) => void;
  setCurrentCopywriting: (copywriting: any) => void;
  setShowCopywritingDialog: (value: boolean) => void;
  setCurrentStoryboardTask: (task: any) => void;
  setShowStoryboardDialog: (value: boolean) => void;
  monitorTasks: MonitorTask[];
  monitorDetails: Record<string, any>;
  backgroundTasks: any[];
  removeTask: (taskId: string) => void;
  cancelTask: (taskId: string) => void;
}) {
  return (
    <>
          {/* 任务中心 */}
          {activeSection === 'tasks' && (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                      任务中心
                    </h1>
                    <p className="text-muted-foreground">
                      管理和查看所有后台生成任务
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveSection('home')}
                    className="text-sm text-[#70E0FF] hover:opacity-80 transition-opacity"
                  >
                    ← 返回首页
                  </button>
                </div>

                {/* 视图切换 */}
                <div className="flex gap-1 mt-4 p-1 bg-neutral-800/50 rounded-lg w-fit">
                  <button
                    onClick={() => setTaskViewMode('list')}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      taskViewMode === 'list'
                        ? 'bg-[#70E0FF] text-black'
                        : 'text-neutral-400 hover:text-foreground'
                    }`}
                  >
                    列表视图
                  </button>
                  <button
                    onClick={() => {
                      setTaskViewMode('monitor');
                      syncFromServer();
                    }}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      taskViewMode === 'monitor'
                        ? 'bg-[#70E0FF] text-black'
                        : 'text-neutral-400 hover:text-foreground'
                    }`}
                  >
                    监控视图
                  </button>
                </div>
              </div>

              {taskViewMode === 'list' ? (
              <TaskCenter 
                onViewConfig={(task) => {
                  // 根据任务类型跳转到对应页面并加载配置
                  if (task.type === 'video') {
                    setVideoInitialConfig(task.config);
                    setActiveSection('video');
                  } else if (task.type === 'image') {
                    setImageInitialConfig(task.config);
                    setActiveSection('media');
                    setMediaSubSection('image');
                  } else {
                    alert('暂不支持该类型任务的配置查看');
                  }
                }}
                onOpenResult={(task) => {
                  console.log('[DreamboxHome] onOpenResult called for task:', {
                    taskId: task.id,
                    taskType: task.type,
                    taskStatus: task.status,
                    hasResult: !!task.result,
                    resultKeys: task.result ? Object.keys(task.result) : [],
                    videoUrl: task.result?.videoUrl
                  });
                  
                  // 根据任务类型打开结果
                  if (task.type === 'video') {
                    if (!task.result?.videoUrl) {
                      console.error('[DreamboxHome] Video URL is missing in task result:', task.result);
                      alert('视频链接不存在，可能生成失败');
                      return;
                    }
                    
                    // 验证视频URL格式
                    const videoUrl = task.result.videoUrl;
                    if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
                      console.error('[DreamboxHome] Invalid video URL format:', videoUrl);
                      alert('视频链接格式无效');
                      return;
                    }
                    
                    const video = {
                      id: task.id,
                      videoUrl: videoUrl,
                      prompt: task.config?.prompt || '无描述',
                      createdAt: task.completedAt || Date.now(),
                      duration: task.config?.duration?.toString() || '',
                      style: task.config?.style,
                      mood: task.config?.mood,
                      filter: task.config?.filter,
                      resolution: task.config?.resolution,
                      ratio: task.config?.ratio,
                      // 字幕相关（从任务结果传递）
                      enableSubtitle: task.result?.subtitleEnabled || task.config?.enableSubtitle,
                      subtitleText: task.config?.subtitleText,
                      subtitlePosition: task.config?.subtitlePosition,
                      subtitleFontSize: task.config?.subtitleFontSize,
                      subtitleColor: task.config?.subtitleColor,
                      // 字幕降级数据（服务端烧录失败时使用）
                      srtData: task.result?.srtData,
                      subtitleBurned: task.result?.subtitleBurned,
                      srtEntryCount: task.result?.srtEntryCount,
                    };
                    
                    console.log('[DreamboxHome] Setting current video:', video);
                    setCurrentVideo(video);
                    setActiveSection('video');
                  } else if (task.type === 'image' && task.result?.imageUrls) {
                    const image = {
                      id: task.id,
                      imageUrls: task.result.imageUrls,
                      prompt: task.config?.prompt || '无描述',
                      createdAt: task.completedAt || Date.now(),
                      size: task.config?.size,
                      style: task.config?.style,
                      mood: task.config?.mood,
                      filter: task.config?.filter,
                      resolution: task.config?.resolution,
                      quality: task.config?.quality,
                    };
                    setCurrentImages(image);
                    setActiveSection('media');
                    setMediaSubSection('image');
                  } else if (task.type === 'poster' && task.result?.posterUrl) {
                    // 海报类型处理
                    const poster = {
                      id: task.id,
                      posterUrl: task.result.posterUrl,
                      text: task.result.text,
                      prompt: task.config?.prompt || task.config?.keyInfo || '无描述',
                      createdAt: task.completedAt || Date.now(),
                      colorScheme: task.config?.colorScheme,
                      size: task.config?.size,
                      videoUrl: task.config?.videoUrl,
                      keyInfo: task.config?.keyInfo,
                    };
                    // 海报也作为图片类型显示
                    setCurrentImages({
                      id: poster.id,
                      imageUrls: [poster.posterUrl],
                      prompt: poster.prompt,
                      createdAt: poster.createdAt,
                      size: '2K',
                    });
                    setActiveSection('media');
                    setMediaSubSection('image');
                  } else if (task.type === 'copywriting') {
                    const copywriting = {
                      id: task.id,
                      content: task.result?.content,
                      imageUrls: task.result?.imageUrls,
                      platform: task.result?.platform,
                      prompt: task.config.prompt,
                      title: task.config.title,
                      createdAt: task.completedAt || Date.now(),
                    };
                    setCurrentCopywriting(copywriting);
                    setShowCopywritingDialog(true);
                  } else if (task.type === 'storyboard') {
                    setCurrentStoryboardTask(task);
                    setShowStoryboardDialog(true);
                  } else {
                    alert('该任务没有可查看的结果');
                  }
                }}
                onRegenerate={(task) => {
                  // 重新生成：跳转到对应页面并加载配置
                  if (task.type === 'video') {
                    setVideoInitialConfig(task.config);
                    setActiveSection('video');
                    // 可选：自动开始生成，这里选择让用户手动点击生成按钮
                    alert('已加载失败任务的配置，请检查配置后点击生成按钮重新生成');
                  } else if (task.type === 'image') {
                    setImageInitialConfig(task.config);
                    setActiveSection('media');
                    setMediaSubSection('image');
                    alert('已加载失败任务的配置，请检查配置后点击生成按钮重新生成');
                  } else {
                    alert('暂不支持该类型任务的重新生成');
                  }
                }}
              />
              ) : (
              <div className="space-y-3">
                {monitorTasks.length > 0 ? (
                  monitorTasks.map((mTask: MonitorTask) => (
                    <TaskProgressCard
                      key={mTask.taskId}
                      task={mTask}
                      logs={monitorDetails[mTask.taskId]?.logs}
                      safetyChecks={monitorDetails[mTask.taskId]?.safetyChecks}
                      copyrightResult={monitorDetails[mTask.taskId]?.copyrightResult}
                      onRetry={(taskId) => {
                        // 重新提交任务
                        const originalTask = backgroundTasks.find(t => t.id === taskId);
                        if (originalTask) {
                          removeTask(taskId);
                          // 通过 generation console 重新提交
                          alert('任务已移除，请重新提交生成请求');
                        }
                      }}
                      onPause={(taskId) => {
                        cancelTask(taskId);
                      }}
                      onResume={(taskId) => {
                        // 恢复任务 - 重新提交
                        alert('请重新提交生成请求以恢复任务');
                      }}
                      onDelete={(taskId) => {
                        removeTask(taskId);
                      }}
                      onViewDetail={(taskId) => {
                        // 切换到列表视图查看详情
                        setTaskViewMode('list');
                      }}
                    />
                  ))
                ) : (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-800 flex items-center justify-center">
                      <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-neutral-500 text-sm">暂无监测任务</p>
                    <p className="text-neutral-600 text-xs mt-1">开始创作后，任务进度将在此实时展示</p>
                  </div>
                )}
              </div>
              )}
            </>
          )}


    </>
  );
}
