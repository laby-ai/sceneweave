'use client';

import dynamic from 'next/dynamic';
import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { ArrowLeft, Film } from 'lucide-react';

import { DreamboxHomeSection } from '@/components/home/dreambox-home-section';
import { type MediaSubSection } from '@/components/home/dreambox-media-section';
import { DreamboxResultDialogs } from '@/components/home/dreambox-result-dialogs';
import { DreamboxSettingsSection } from '@/components/home/dreambox-settings-section';
import { DreamboxTasksSection } from '@/components/home/dreambox-tasks-section';
import type { FilmScript } from '@/types/film';

const loadAIVideoCreationPanel = () => import('@/components/ai-video-creation-panel').then(mod => mod.default);
const loadFilmCreationPanel = () => import('@/components/film-creation-panel').then(mod => mod.FilmCreationPanel);
const loadImageCreationPanel = () => import('@/components/image-creation-panel').then(mod => mod.ImageCreationPanel);
const loadGenerateWorkspace = () => import('@/components/generate/generate-workspace').then(mod => mod.GenerateWorkspace);
const loadAssetsLibrary = () => import('@/components/assets/assets-library').then(mod => mod.AssetsLibrary);
const loadAvatarGenerator = () => import('@/components/avatar/AvatarGenerator').then(mod => mod.AvatarGenerator);
const loadVoiceGenerator = () => import('@/components/voice/voice-generator').then(mod => mod.VoiceGenerator);

function WorkspacePanelLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center bg-background text-sm text-muted-foreground">
      {label}
    </div>
  );
}

const AIVideoCreationPanel = dynamic(loadAIVideoCreationPanel, {
  ssr: false,
  loading: () => <WorkspacePanelLoading label="视频工作台加载中..." />,
});
const FilmCreationPanel = dynamic(loadFilmCreationPanel, {
  ssr: false,
  loading: () => <WorkspacePanelLoading label="影视创作加载中..." />,
});
const ImageCreationPanel = dynamic(loadImageCreationPanel, {
  ssr: false,
  loading: () => <WorkspacePanelLoading label="图像创作加载中..." />,
});
const GenerateWorkspace = dynamic(loadGenerateWorkspace, {
  ssr: false,
  loading: () => <WorkspacePanelLoading label="生成工作台加载中..." />,
});
const AssetsLibrary = dynamic(loadAssetsLibrary, {
  ssr: false,
  loading: () => <WorkspacePanelLoading label="资产库加载中..." />,
});
const AvatarGenerator = dynamic(loadAvatarGenerator, {
  ssr: false,
  loading: () => <WorkspacePanelLoading label="数字人加载中..." />,
});
const VoiceGenerator = dynamic(loadVoiceGenerator, {
  ssr: false,
  loading: () => <WorkspacePanelLoading label="配音工具加载中..." />,
});

interface DreamboxMainContentProps {
  activeSection: string;
  apiConnectionStatus: any;
  backgroundTasks: any[];
  cancelTask: any;
  clearApiConnectionSettings: () => void;
  currentCopywriting: any;
  currentImages: any;
  currentStoryboardTask: any;
  editingImagePrompt: string | null;
  finalVideoCaseAssets: any[];
  handleClearImageHistory: () => void;
  handleClearVideoHistory: () => void;
  handleCopywritingGenerated: (prompt: string, variations: string[]) => void;
  handleEditImage: (image?: any) => void;
  handlePosterGenerated: (imageData: any) => void;
  handlePromptEnhanced: any;
  handleRegenerateImage: any;
  handleRemixImage: any;
  homeGalleryItems: any[];
  onOpenWorkDetail?: (item: { title: string; type: string; videoSrc?: string; src: string; source?: string }) => void;
  imageInitialConfig: any;
  isDark: boolean;
  isGeneratingImage: boolean;
  mediaSubSection: MediaSubSection;
  monitorDetails: any;
  monitorTasks: any[];
  pendingImageRefs: string[];
  pendingPrompt: string | undefined;
  productionCaseAssets: any[];
  removeTask: any;
  saveApiConnectionSettings: () => void;
  segmentCaseAssets: any[];
  setActiveSection: (section: string) => void;
  setCurrentCopywriting: Dispatch<SetStateAction<any>>;
  setCurrentImages: Dispatch<SetStateAction<any>>;
  setCurrentStoryboardTask: Dispatch<SetStateAction<any>>;
  setCurrentVideo: Dispatch<SetStateAction<any>>;
  setEditingVideoPrompt: Dispatch<SetStateAction<string | null>>;
  setGeneratedVideos: Dispatch<SetStateAction<any[]>>;
  setImageInitialConfig: Dispatch<SetStateAction<any>>;
  setIsGeneratingImage: Dispatch<SetStateAction<boolean>>;
  setMediaSubSection: (section: MediaSubSection) => void;
  setPendingImageRefs: Dispatch<SetStateAction<string[]>>;
  setPendingPrompt: Dispatch<SetStateAction<string | undefined>>;
  setSettingsApiBase: Dispatch<SetStateAction<string>>;
  setSettingsApiKey: Dispatch<SetStateAction<string>>;
  setSettingsApiProvider: Dispatch<SetStateAction<any>>;
  setSettingsAutoSave: Dispatch<SetStateAction<boolean>>;
  setSettingsEmail: Dispatch<SetStateAction<string>>;
  setSettingsFontSize: Dispatch<SetStateAction<number>>;
  setSettingsFontStyle: Dispatch<SetStateAction<string>>;
  setSettingsImageModel: Dispatch<SetStateAction<string>>;
  setSettingsLanguage: Dispatch<SetStateAction<string>>;
  setSettingsModel: Dispatch<SetStateAction<string>>;
  setSettingsNotification: Dispatch<SetStateAction<boolean>>;
  setSettingsUsername: Dispatch<SetStateAction<string>>;
  setSettingsVideoModel: Dispatch<SetStateAction<string>>;
  setShowCopywritingDialog: Dispatch<SetStateAction<boolean>>;
  setShowStoryboardDialog: Dispatch<SetStateAction<boolean>>;
  setShouldAutoGenerate: Dispatch<SetStateAction<boolean>>;
  setSmartAssistantTransfer: Dispatch<SetStateAction<any>>;
  setTargetService: Dispatch<SetStateAction<string | undefined>>;
  setTaskViewMode: Dispatch<SetStateAction<'list' | 'monitor'>>;
  setVideoInitialConfig: Dispatch<SetStateAction<any>>;
  settingsApiBase: string;
  settingsApiKey: string;
  settingsApiProvider: any;
  settingsAutoSave: boolean;
  settingsEmail: string;
  settingsFontSize: number;
  settingsFontStyle: string;
  settingsImageModel: string;
  settingsLanguage: string;
  settingsModel: string;
  settingsNotification: boolean;
  settingsUsername: string;
  settingsVideoModel: string;
  shouldAutoGenerate: boolean;
  showCopywritingDialog: boolean;
  showStoryboardDialog: boolean;
  smartAssistantTransfer: any;
  storyboardVideoRef: RefObject<HTMLVideoElement | null>;
  syncFromServer: any;
  t: (key: string) => string;
  targetService: string | undefined;
  taskViewMode: 'list' | 'monitor';
  testApiConnection: (testMode?: 'models' | 'chat' | 'image') => Promise<void>;
  toggleColorMode: () => void;
  updateUserSettings: any;
}

export function DreamboxMainContent(props: DreamboxMainContentProps) {
  const {
    activeSection,
    apiConnectionStatus,
    backgroundTasks,
    cancelTask,
    clearApiConnectionSettings,
    currentCopywriting,
    currentImages,
    currentStoryboardTask,
    editingImagePrompt,
    finalVideoCaseAssets,
    handleClearImageHistory,
    handleClearVideoHistory,
    handleCopywritingGenerated,
    handleEditImage,
    handlePosterGenerated,
    handlePromptEnhanced,
    handleRegenerateImage,
    handleRemixImage,
    homeGalleryItems,
    onOpenWorkDetail,
    imageInitialConfig,
    isDark,
    isGeneratingImage,
    mediaSubSection,
    monitorDetails,
    monitorTasks,
    pendingImageRefs,
    pendingPrompt,
    productionCaseAssets,
    removeTask,
    saveApiConnectionSettings,
    segmentCaseAssets,
    setActiveSection,
    setCurrentCopywriting,
    setCurrentImages,
    setCurrentStoryboardTask,
    setCurrentVideo,
    setEditingVideoPrompt,
    setGeneratedVideos,
    setImageInitialConfig,
    setIsGeneratingImage,
    setMediaSubSection,
    setPendingImageRefs,
    setPendingPrompt,
    setSettingsApiBase,
    setSettingsApiKey,
    setSettingsApiProvider,
    setSettingsAutoSave,
    setSettingsEmail,
    setSettingsFontSize,
    setSettingsFontStyle,
    setSettingsImageModel,
    setSettingsLanguage,
    setSettingsModel,
    setSettingsNotification,
    setSettingsUsername,
    setSettingsVideoModel,
    setShowCopywritingDialog,
    setShowStoryboardDialog,
    setShouldAutoGenerate,
    setSmartAssistantTransfer,
    setTargetService,
    setTaskViewMode,
    setVideoInitialConfig,
    settingsApiBase,
    settingsApiKey,
    settingsApiProvider,
    settingsAutoSave,
    settingsEmail,
    settingsFontSize,
    settingsFontStyle,
    settingsImageModel,
    settingsLanguage,
    settingsModel,
    settingsNotification,
    settingsUsername,
    settingsVideoModel,
    shouldAutoGenerate,
    showCopywritingDialog,
    showStoryboardDialog,
    smartAssistantTransfer,
    storyboardVideoRef,
    syncFromServer,
    t,
    targetService,
    taskViewMode,
    testApiConnection,
    toggleColorMode,
    updateUserSettings,
  } = props;

  useEffect(() => {
    if (activeSection !== 'home') return;

    const warmPrimaryWorkspaces = () => {
      void loadGenerateWorkspace();
      void loadFilmCreationPanel();
      void loadImageCreationPanel();
      void loadAIVideoCreationPanel();
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === 'function') {
      const handle = idleWindow.requestIdleCallback(warmPrimaryWorkspaces, { timeout: 3000 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const handle = window.setTimeout(warmPrimaryWorkspaces, 1200);
    return () => window.clearTimeout(handle);
  }, [activeSection]);

  return (
    <>
      {/* 主内容区 */}
      <main className="transition-all duration-300 ml-16 min-h-screen">
        <div className="p-3 pb-16 sm:p-5 sm:pb-20">
          <DreamboxHomeSection
            activeSection={activeSection}
            homeGalleryItems={homeGalleryItems}
            setActiveSection={setActiveSection}
            setPendingPrompt={setPendingPrompt}
            onOpenWorkDetail={onOpenWorkDetail}
          />

          {/* 影视创作 - 全屏三栏布局 */}
          {activeSection === 'film' && (
            <div className="h-[calc(100vh-72px)] -m-6 flex flex-col">
              {/* 顶部标题栏 */}
              <div className="flex-shrink-0 flex items-center px-5 py-2.5 bg-card border-b border-[#f0f0f0] dark:border-border/50">
                <button
                  onClick={() => { setActiveSection('home'); setPendingPrompt(undefined); setShouldAutoGenerate(false); setTargetService(undefined); }}
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors mr-3"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <Film className="w-5 h-5 text-[#70E0FF] mr-2.5" />
                <h1 className="text-lg font-semibold text-foreground">影视创作</h1>
              </div>
              {/* 三栏内容 */}
              <div className="flex-1 min-h-0">
                <FilmCreationPanel
                  initialPrompt={activeSection === 'film' ? pendingPrompt : ''}
                  autoGenerate={shouldAutoGenerate && activeSection === 'film'}
                  targetService={targetService}
                  transferredData={smartAssistantTransfer}
                  onScriptGenerated={(script: FilmScript) => {
                    setShouldAutoGenerate(false);
                    console.log('影视创作: 剧本生成完成', script.title);
                  }}
                  onStoryboardGenerated={() => {
                    console.log('影视创作: 分镜生成完成');
                  }}
                  onVideoGenerated={(url: string, videoPrompt?: string) => {
                    const video = {
                      id: `film-${Date.now()}`,
                      videoUrl: url || '',
                      prompt: videoPrompt || '',
                      createdAt: Date.now(),
                    };
                    setGeneratedVideos((prev) => [video, ...prev]);
                  }}
                />
              </div>
            </div>
          )}

          {/* AI 图像 - 全屏三栏布局 */}
          {activeSection === 'image' && (
            <div className="h-[calc(100vh-72px)] -m-6">
              <ImageCreationPanel initialPrompt={activeSection === 'image' ? pendingPrompt : ''} autoGenerate={shouldAutoGenerate && activeSection === 'image'} initialImageRefs={pendingImageRefs} onBack={() => { setActiveSection('home'); setPendingPrompt(undefined); setShouldAutoGenerate(false); setTargetService(undefined); setPendingImageRefs([]); }} />
            </div>
          )}

          {/* 生成 - 即梦式万物对话框（Agent 模式 + 创作类型） */}
          {activeSection === 'smart' && (
            <div className="h-[calc(100vh-72px)] -m-6">
              <GenerateWorkspace
                initialPrompt={pendingPrompt}
                onNavigate={(section, prompt, transfer) => {
                  if (prompt) setPendingPrompt(prompt);
                  setPendingImageRefs(transfer?.imageRefs || []);
                  setShouldAutoGenerate(Boolean(prompt?.trim()));
                  setActiveSection(section);
                }}
              />
            </div>
          )}

          {/* 视频生成 */}
          {activeSection === 'video' && (
            <div className="h-[calc(100vh-72px)] -m-6">
              <AIVideoCreationPanel
                onBack={() => setActiveSection('home')}
                initialPrompt={pendingPrompt || ''}
                autoGenerate={shouldAutoGenerate}
              />
            </div>
          )}

          {/* 数字人（复用绘影既有 AvatarGenerator + /api/avatar 后端） */}
          {activeSection === 'avatar' && (
            <div className="h-[calc(100vh-1rem)] -m-6 overflow-y-auto">
              <div className="flex items-center gap-3 border-b border-border/50 bg-card px-5 py-2.5">
                <button
                  onClick={() => { setActiveSection('smart'); setPendingPrompt(undefined); }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                  aria-label="返回生成"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="text-lg font-semibold text-foreground">数字人</h1>
              </div>
              <div className="mx-auto max-w-5xl p-5">
                <AvatarGenerator
                  onVideoGenerated={(url: string) => {
                    setGeneratedVideos((prev) => [
                      { id: `avatar-${Date.now()}`, videoUrl: url, prompt: '数字人', createdAt: Date.now() },
                      ...prev,
                    ]);
                  }}
                />
              </div>
            </div>
          )}

          {/* 配音生成（复用绘影 TTS 后端 /api/tts） */}
          {activeSection === 'voice' && (
            <div className="h-[calc(100vh-1rem)] -m-6 overflow-y-auto">
              <div className="flex items-center gap-3 border-b border-border/50 bg-card px-5 py-2.5">
                <button
                  onClick={() => { setActiveSection('smart'); setPendingPrompt(undefined); }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                  aria-label="返回生成"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="text-lg font-semibold text-foreground">配音生成</h1>
              </div>
              <div className="p-5">
                <VoiceGenerator />
              </div>
            </div>
          )}

          {/* 资产 - 即梦式全页资产库（生成历史 / 主体 / 画布），接真实历史 + 制作资产 */}
          {activeSection === 'media' && (
            <div className="h-[calc(100vh-0px)] -m-6">
              <AssetsLibrary
                finalVideoCaseAssets={finalVideoCaseAssets}
                segmentCaseAssets={segmentCaseAssets}
              />
            </div>
          )}

          <DreamboxTasksSection
            activeSection={activeSection}
            taskViewMode={taskViewMode}
            setTaskViewMode={setTaskViewMode}
            syncFromServer={syncFromServer}
            setActiveSection={setActiveSection}
            setVideoInitialConfig={setVideoInitialConfig}
            setImageInitialConfig={setImageInitialConfig}
            setMediaSubSection={setMediaSubSection}
            setCurrentVideo={setCurrentVideo}
            setCurrentImages={setCurrentImages}
            setCurrentCopywriting={setCurrentCopywriting}
            setShowCopywritingDialog={setShowCopywritingDialog}
            setCurrentStoryboardTask={setCurrentStoryboardTask}
            setShowStoryboardDialog={setShowStoryboardDialog}
            monitorTasks={monitorTasks}
            monitorDetails={monitorDetails}
            backgroundTasks={backgroundTasks}
            removeTask={removeTask}
            cancelTask={cancelTask}
          />

          <DreamboxSettingsSection
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            t={t}
            settingsUsername={settingsUsername}
            setSettingsUsername={setSettingsUsername}
            settingsEmail={settingsEmail}
            setSettingsEmail={setSettingsEmail}
            settingsApiProvider={settingsApiProvider}
            setSettingsApiProvider={setSettingsApiProvider}
            settingsApiBase={settingsApiBase}
            setSettingsApiBase={setSettingsApiBase}
            settingsApiKey={settingsApiKey}
            setSettingsApiKey={setSettingsApiKey}
            settingsModel={settingsModel}
            setSettingsModel={setSettingsModel}
            settingsImageModel={settingsImageModel}
            setSettingsImageModel={setSettingsImageModel}
            settingsVideoModel={settingsVideoModel}
            setSettingsVideoModel={setSettingsVideoModel}
            apiConnectionStatus={apiConnectionStatus}
            testApiConnection={testApiConnection}
            saveApiConnectionSettings={saveApiConnectionSettings}
            clearApiConnectionSettings={clearApiConnectionSettings}
            isDark={isDark}
            toggleColorMode={toggleColorMode}
            settingsFontStyle={settingsFontStyle}
            setSettingsFontStyle={setSettingsFontStyle}
            settingsFontSize={settingsFontSize}
            setSettingsFontSize={setSettingsFontSize}
            settingsLanguage={settingsLanguage}
            setSettingsLanguage={setSettingsLanguage}
            updateUserSettings={updateUserSettings}
            settingsNotification={settingsNotification}
            setSettingsNotification={setSettingsNotification}
            settingsAutoSave={settingsAutoSave}
            setSettingsAutoSave={setSettingsAutoSave}
            handleClearVideoHistory={handleClearVideoHistory}
            handleClearImageHistory={handleClearImageHistory}
          />

          <DreamboxResultDialogs
            currentCopywriting={currentCopywriting}
            currentStoryboardTask={currentStoryboardTask}
            setShowCopywritingDialog={setShowCopywritingDialog}
            setShowStoryboardDialog={setShowStoryboardDialog}
            showCopywritingDialog={showCopywritingDialog}
            showStoryboardDialog={showStoryboardDialog}
            storyboardVideoRef={storyboardVideoRef}
          />

        </div>
      </main>
    </>
  );
}
