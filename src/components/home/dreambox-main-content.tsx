'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import { ArrowLeft, Film } from 'lucide-react';

import AIVideoCreationPanel from '@/components/ai-video-creation-panel';
import { FilmCreationPanel } from '@/components/film-creation-panel';
import { ImageCreationPanel } from '@/components/image-creation-panel';
import { SmartAssistantPanel } from '@/components/smart-assistant-panel';
import { DreamboxHomeSection } from '@/components/home/dreambox-home-section';
import { DreamboxMediaSection, type MediaSubSection } from '@/components/home/dreambox-media-section';
import { DreamboxResultDialogs } from '@/components/home/dreambox-result-dialogs';
import { DreamboxSettingsSection } from '@/components/home/dreambox-settings-section';
import { DreamboxTasksSection } from '@/components/home/dreambox-tasks-section';
import type { FilmScript } from '@/types/film';

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

  return (
    <>
      {/* 主内容区 */}
      <main className="pt-[72px] transition-all duration-300 ml-16 min-h-screen">
        <div className="p-3 pb-16 sm:p-5 sm:pb-20">
          <DreamboxHomeSection
            activeSection={activeSection}
            homeGalleryItems={homeGalleryItems}
            setActiveSection={setActiveSection}
            setPendingPrompt={setPendingPrompt}
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

          {/* 绘影精灵 - 全屏三栏布局 */}
          {activeSection === 'smart' && (
            <div className="h-[calc(100vh-72px)] -m-6">
              <SmartAssistantPanel
                initialPrompt={pendingPrompt}
                autoGenerate={shouldAutoGenerate && activeSection === 'smart'}
                onBack={() => { setActiveSection('home'); setPendingPrompt(undefined); setShouldAutoGenerate(false); setTargetService(undefined); setSmartAssistantTransfer(undefined); }}
                onNavigate={(section, prompt, transferData) => {
                  if (prompt) setEditingVideoPrompt(prompt);
                  if (transferData) {
                    setSmartAssistantTransfer(transferData);
                    setShouldAutoGenerate(true);
                  }
                  if (section === 'video') setActiveSection('video');
                  else if (section === 'image') setActiveSection('image');
                  else if (section === 'film') setActiveSection('film');
                  else if (section === 'media') setActiveSection('media');
                  else if (section === 'smart') setActiveSection('smart');
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

          <DreamboxMediaSection
            activeSection={activeSection}
            mediaSubSection={mediaSubSection}
            setMediaSubSection={setMediaSubSection}
            setActiveSection={setActiveSection}
            finalVideoCaseAssets={finalVideoCaseAssets}
            segmentCaseAssets={segmentCaseAssets}
            productionCaseAssets={productionCaseAssets}
            setPendingPrompt={setPendingPrompt}
            setShouldAutoGenerate={setShouldAutoGenerate}
            setCurrentImages={setCurrentImages}
            setCurrentCopywriting={setCurrentCopywriting}
            setShowCopywritingDialog={setShowCopywritingDialog}
            isGeneratingImage={isGeneratingImage}
            setIsGeneratingImage={setIsGeneratingImage}
            handlePromptEnhanced={handlePromptEnhanced}
            editingImagePrompt={editingImagePrompt}
            imageInitialConfig={imageInitialConfig}
            currentImages={currentImages}
            handleRemixImage={handleRemixImage}
            handleEditImage={handleEditImage}
            handleRegenerateImage={handleRegenerateImage}
            handlePosterGenerated={handlePosterGenerated}
            handleCopywritingGenerated={handleCopywritingGenerated}
          />

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
