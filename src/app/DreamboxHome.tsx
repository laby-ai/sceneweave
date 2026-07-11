'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useTheme } from '@/contexts/ThemeContext';
import type { UserSettings } from '@/constants/themes';
import { useColorMode } from '@/contexts/ColorModeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useVideoHistory } from '@/hooks/useVideoHistory';
import { useTasks } from '@/contexts/TaskContext';
import { useDreamboxMonitorTasks } from '@/hooks/useDreamboxMonitorTasks';
import { PromptPreview } from '@/components/prompt-preview';
import { WorkDetailOverlay, type WorkDetailData } from '@/components/work-detail-overlay';
import { DreamboxMainContent } from '@/components/home/dreambox-main-content';
import { DreamboxMediaSection, type MediaSubSection } from '@/components/home/dreambox-media-section';
import { DreamboxNavigationShell } from '@/components/home/dreambox-navigation-shell';
import { clientApiFetch } from '@/lib/client-api';

type ApiProviderType = 'openai-compatible' | 'ark-plan';
type MaterialInput = unknown;

interface GeneratedVideo {
  id: string;
  videoUrl: string;
  prompt: string;
  createdAt: number;
  duration?: string;
  style?: string;
  mood?: string;
  filter?: string;
  resolution?: string;
  ratio?: string;
  materials?: MaterialInput[];
  hasSubtitle?: boolean;
  enableSubtitle?: boolean;
  subtitleText?: string;
  subtitlePosition?: string;
  subtitleFontSize?: string;
  subtitleColor?: string;
  subtitleVoiceType?: string;
  subtitleSpeechSpeed?: number;
  generateVoice?: boolean;
}

interface GeneratedImage {
  id: string;
  imageUrls: string[];
  prompt: string;
  createdAt: number;
  size?: string;
  style?: string;
  mood?: string;
  filter?: string;
  resolution?: string;
  quality?: string;
  materials?: MaterialInput[];
  enableImageText?: boolean;
  imageText?: string;
}

interface GeneratedCopywriting {
  id: string;
  content?: string;
  imageUrls?: string[];
  platform?: string;
  prompt: string;
  title?: string;
  createdAt: number;
}

interface ProductionCaseAsset {
  id: string;
  title: string;
  type: string;
  taskId: string;
  projectTitle: string;
  videoUrl: string;
  posterUrl: string;
  durationLabel: string;
  source: 'productionProject.assets.videoSegment' | 'productionProject.assets.finalVideo';
}

interface ProductionCaseAssetsResponse {
  success?: boolean;
  message?: string;
  cases?: ProductionCaseAsset[];
}

interface HistoricalMediaAsset {
  id: string;
  kind: 'image' | 'video';
  title: string;
  url: string;
  poster?: string;
  createdAt: number;
  source: 'historical';
}

interface HomeMediaLibraryResponse {
  success?: boolean;
  message?: string;
  assets?: HistoricalMediaAsset[];
}

interface ServerTask {
  id: string;
  type: 'video' | 'image' | 'copywriting' | string;
  status: string;
  config: {
    prompt?: string;
    duration?: number | string;
    resolution?: string;
    ratio?: string;
    size?: string;
    quality?: string;
    title?: string;
  };
  result?: {
    videoUrl?: string;
    imageUrls?: string[];
    content?: string;
    platform?: string;
  };
  completedAt?: number;
  createdAt: number;
}

interface TasksResponse {
  success?: boolean;
  error?: string;
  tasks?: ServerTask[];
}

interface HomeGalleryItem {
  title: string;
  src: string;
  videoSrc?: string;
  span: string;
  type: string;
  target: string;
  href?: string;
  duration?: string;
  source?: 'static' | 'production-case-asset' | 'historical';
}

function historicalHomeCategory(title: string): string {
  const normalized = title.toLowerCase();
  if (normalized.includes('enterprise-ai')) return 'enterprise-ai';
  if (normalized.includes('five-dynasties')) return 'five-dynasties';
  if (normalized.includes('liming') || normalized.includes('zhibing')) return 'liming-zhibing';
  if (normalized.includes('rainline')) return 'rainline';
  if (normalized.includes('kill-line')) return 'kill-line';
  if (normalized.includes('vimax')) return 'vimax';
  if (normalized.includes('marketing')) return 'marketing';
  if (normalized.includes('anime')) return 'anime';
  if (normalized.includes('videotape')) return 'videotape';
  if (normalized.includes('cyber')) return 'cyber';
  return normalized.replace(/-\d{6,}.*/, '').replace(/[a-f0-9-]{12,}/, '');
}

function pickHomeHistoricalAssets(assets: HistoricalMediaAsset[]): HistoricalMediaAsset[] {
  const picked = new Map<string, HistoricalMediaAsset>();
  const videos = assets.filter(asset => asset.kind === 'video');
  const images = assets.filter(asset => asset.kind === 'image');

  for (const asset of videos) {
    const category = historicalHomeCategory(asset.title);
    if (!picked.has(category)) picked.set(category, asset);
    if (picked.size >= 10) break;
  }

  for (const asset of images) {
    const category = historicalHomeCategory(asset.title);
    if (!picked.has(category)) picked.set(category, asset);
    if (picked.size >= 14) break;
  }

  return Array.from(picked.values());
}

export function DreamboxHome() {
  const { 
    videoHistory, 
    imageHistory,
    promptHistory, 
    addVideoHistory, 
    addImageHistory,
    addPromptHistory,
    deleteVideoHistory,
    deleteImageHistory,
    deletePromptHistory,
    clearVideoHistory,
    clearImageHistory,
    clearPromptHistory
  } = useVideoHistory();
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { themeGradient, userSettings, updateUserSettings } = useTheme();
  const { colorMode, toggleColorMode, isDark } = useColorMode();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('all');
  const [activeSection, setActiveSectionRaw] = useState('home');
  const setActiveSection = (section: string) => {
    console.log('[DreamboxHome] setActiveSection:', section, 'prev:', activeSection);
    setActiveSectionRaw(section);
  };
  const [mediaSubSection, setMediaSubSection] = useState<MediaSubSection>('select');
  const [isMediaExpanded, setIsMediaExpanded] = useState(false);
  const mediaDropdownRef = useRef<HTMLDivElement>(null);
  const mediaDropdownMenuRef = useRef<HTMLDivElement>(null);
  const [mediaDropdownTop, setMediaDropdownTop] = useState(0);

  // 点击外部关闭图文生成下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isMediaExpanded) {
        const target = e.target as Node;
        const clickedInsideButton = mediaDropdownRef.current?.contains(target);
        const clickedInsideMenu = mediaDropdownMenuRef.current?.contains(target);
        if (!clickedInsideButton && !clickedInsideMenu) {
          setIsMediaExpanded(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMediaExpanded]);

  // ESC键关闭图文生成下拉菜单
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMediaExpanded) {
        setIsMediaExpanded(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMediaExpanded]);

  const [taskViewMode, setTaskViewMode] = useState<'list' | 'monitor'>('list');
  const { tasks: backgroundTasks, cancelTask, removeTask, syncFromServer } = useTasks();

  const { monitorDetails, monitorTasks } = useDreamboxMonitorTasks(backgroundTasks);

  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [generatedCopywritings, setGeneratedCopywritings] = useState<GeneratedCopywriting[]>([]);
  const [currentVideo, setCurrentVideo] = useState<GeneratedVideo | null>(null);
  const [currentImages, setCurrentImages] = useState<GeneratedImage | null>(null);
  const [promptPreviewData, setPromptPreviewData] = useState<{ prompt: string; negativePrompt?: string; style?: string; type: 'video' | 'image' } | null>(null);
  const [workDetailData, setWorkDetailData] = useState<WorkDetailData | null>(null);
  const [myWorksCollapsed, setMyWorksCollapsed] = useState(true);
  const [currentCopywriting, setCurrentCopywriting] = useState<GeneratedCopywriting | null>(null);
  const [showCopywritingDialog, setShowCopywritingDialog] = useState(false);
  const [showStoryboardDialog, setShowStoryboardDialog] = useState(false);
  const [currentStoryboardTask, setCurrentStoryboardTask] = useState<unknown>(null);
  const [productionCaseAssets, setProductionCaseAssets] = useState<ProductionCaseAsset[]>([]);
  const [homeHistoricalAssets, setHomeHistoricalAssets] = useState<HistoricalMediaAsset[]>([]);
  const storyboardVideoRef = useRef<HTMLVideoElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [editingVideoPrompt, setEditingVideoPrompt] = useState<string | null>(null);
  const [editingImagePrompt, setEditingImagePrompt] = useState<string | null>(null);
  const [videoInitialConfig, setVideoInitialConfig] = useState<Partial<GeneratedVideo> | null>(null);
  const [imageInitialConfig, setImageInitialConfig] = useState<Partial<GeneratedImage> | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | undefined>(undefined);
  const [shouldAutoGenerate, setShouldAutoGenerate] = useState(false);
  const [targetService, setTargetService] = useState<string | undefined>(undefined);
  const [pendingImageRefs, setPendingImageRefs] = useState<string[]>([]);
  const [smartAssistantTransfer, setSmartAssistantTransfer] = useState<import('@/types/film').SmartAssistantTransferData | undefined>(undefined);
  
  // 设置相关状态
  const [settingsUsername, setSettingsUsername] = useState('');
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsNotification, setSettingsNotification] = useState(true);
  const [settingsAutoSave, setSettingsAutoSave] = useState(true);
  const [settingsLanguage, setSettingsLanguage] = useState('zh-CN');
  const [settingsFontStyle, setSettingsFontStyle] = useState('default');
  const [settingsFontSize, setSettingsFontSize] = useState(14);
  const [settingsApiProvider, setSettingsApiProvider] = useState<ApiProviderType>('openai-compatible');
  const [settingsApiBase, setSettingsApiBase] = useState('https://api.openai.com/v1');
  const [settingsApiKey, setSettingsApiKey] = useState('');
  const [settingsModel, setSettingsModel] = useState('');
  const [settingsImageModel, setSettingsImageModel] = useState('');
  const [settingsVideoModel, setSettingsVideoModel] = useState('');
  const [apiConnectionStatus, setApiConnectionStatus] = useState<{
    type: 'idle' | 'testing' | 'success' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });

  const saveApiConnectionSettings = () => {
    const config = {
      provider: settingsApiProvider,
      apiBase: settingsApiBase.trim(),
      apiKey: settingsApiKey.trim(),
      model: settingsModel.trim(),
      imageModel: settingsImageModel.trim(),
      videoModel: settingsVideoModel.trim(),
      savedAt: Date.now(),
    };
    localStorage.setItem('dreambox-api-connection', JSON.stringify(config));
    setApiConnectionStatus({ type: 'success', message: '连接配置已保存在本机浏览器' });
  };

  const clearApiConnectionSettings = () => {
    localStorage.removeItem('dreambox-api-connection');
    setSettingsApiProvider('openai-compatible');
    setSettingsApiBase('https://api.openai.com/v1');
    setSettingsApiKey('');
    setSettingsModel('');
    setSettingsImageModel('');
    setSettingsVideoModel('');
    setApiConnectionStatus({ type: 'idle', message: '已清除本机 API 配置' });
  };

  const testApiConnection = async (testMode: 'models' | 'chat' | 'image' = 'models') => {
    const apiBase = settingsApiBase.trim();
    const apiKey = settingsApiKey.trim();
    const model =
      testMode === 'image'
        ? settingsImageModel.trim()
        : settingsModel.trim();
    if (!apiBase || !apiKey) {
      setApiConnectionStatus({ type: 'error', message: '请先填写 API Base 和 API Key' });
      return;
    }
    if (testMode === 'chat' && !model) {
      setApiConnectionStatus({ type: 'error', message: '请先填写默认模型，再测试文本请求' });
      return;
    }
    if (testMode === 'image' && !model) {
      setApiConnectionStatus({ type: 'error', message: '请先填写图片模型，再测试图片请求' });
      return;
    }

    setApiConnectionStatus({
      type: 'testing',
      message:
        testMode === 'chat'
        ? '正在发起最小文本请求...'
          : testMode === 'image'
            ? '正在发起最小图片请求...'
            : '正在验证模型列表连接...',
    });
    try {
      const response = await fetch('/api/provider/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settingsApiProvider,
          apiBase,
          apiKey,
          model: model || undefined,
          testMode,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || '连接验证失败');
      }
      setApiConnectionStatus({
        type: 'success',
        message: data.message || `连接成功${data.modelCount ? `，检测到 ${data.modelCount} 个模型` : ''}`,
      });
    } catch (error) {
      setApiConnectionStatus({
        type: 'error',
        message: error instanceof Error ? error.message : '连接验证失败',
      });
    }
  };

  // 同步语言设置到 ThemeContext
  useEffect(() => {
    if (settingsLanguage && settingsLanguage !== userSettings.language) {
      updateUserSettings({ language: settingsLanguage as UserSettings['language'] });
    }
  }, [settingsLanguage, userSettings.language, updateUserSettings]);

  // 字体变更时应用到根元素
  useEffect(() => {
    const root = document.documentElement;
    const fontFamilies: Record<string, string> = {
      'default': "'Noto Sans SC', -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
      'notoSans': "'Noto Sans SC', -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
      'notoSerif': "'Noto Serif SC', 'Noto Sans SC', Georgia, serif",
      'lxgwWenkai': "'LXGW WenKai', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif",
      'maShanZheng': "'Ma Shan Zheng', 'Noto Sans SC', cursive",
      'zcoolkuaile': "'ZCOOL KuaiLe', 'Noto Sans SC', cursive",
      'zcoolQingke': "'ZCOOL QingKe HuangYou', 'Noto Sans SC', cursive",
      'zhimangxing': "'Zhi Mang Xing', 'Noto Sans SC', cursive",
      'liujianmaocao': "'Liu Jian Mao Cao', 'Noto Sans SC', cursive",
      'longcang': "'Long Cang', 'Noto Sans SC', cursive",
      'notoSansJp': "'Noto Sans JP', 'Noto Sans SC', sans-serif",
      'notoSerifJp': "'Noto Serif JP', 'Noto Serif SC', serif",
      'zenMaru': "'Zen Maru Gothic', 'Noto Sans SC', sans-serif",
      'kosugiMaru': "'Kosugi Maru', 'Noto Sans SC', sans-serif",
      'notoSansKr': "'Noto Sans KR', 'Noto Sans SC', sans-serif",
      'blackHanSans': "'Black Han Sans', 'Noto Sans SC', sans-serif",
      'doHyeon': "'Do Hyeon', 'Noto Sans SC', sans-serif",
      'inter': "'Inter', 'Noto Sans SC', -apple-system, sans-serif",
      'poppins': "'Poppins', 'Noto Sans SC', sans-serif",
      'spaceGrotesk': "'Space Grotesk', 'Noto Sans SC', sans-serif",
      'playfair': "'Playfair Display', 'Noto Serif SC', serif",
      'firaCode': "'Fira Code', 'Noto Sans SC', monospace",
      'sourceCode': "'Source Code Pro', 'Noto Sans SC', monospace",
      'monospace': "'Fira Code', 'Source Code Pro', 'Noto Sans SC', Menlo, monospace",
    };
    root.style.setProperty('--font-family', fontFamilies[settingsFontStyle] || fontFamilies['default']);
    root.style.setProperty('--font-size-base', `${settingsFontSize}px`);
    localStorage.setItem('dreambox-font-style', settingsFontStyle);
    localStorage.setItem('dreambox-font-size', String(settingsFontSize));
  }, [settingsFontStyle, settingsFontSize]);

  // 初始化字体和语言设置
  useEffect(() => {
    const savedFont = localStorage.getItem('dreambox-font-style');
    const savedSize = localStorage.getItem('dreambox-font-size');
    const savedApiConnection = localStorage.getItem('dreambox-api-connection');
    if (savedFont) setSettingsFontStyle(savedFont);
    if (savedSize) setSettingsFontSize(Number(savedSize));
    if (savedApiConnection) {
      try {
        const parsed = JSON.parse(savedApiConnection) as {
          provider?: ApiProviderType;
          apiBase?: string;
          apiKey?: string;
          model?: string;
          imageModel?: string;
          videoModel?: string;
        };
        if (parsed.provider) setSettingsApiProvider(parsed.provider);
        if (parsed.apiBase) setSettingsApiBase(parsed.apiBase);
        if (parsed.apiKey) setSettingsApiKey(parsed.apiKey);
        if (parsed.model) setSettingsModel(parsed.model);
        if (parsed.imageModel) setSettingsImageModel(parsed.imageModel);
        if (parsed.videoModel) setSettingsVideoModel(parsed.videoModel);
      } catch {
        localStorage.removeItem('dreambox-api-connection');
      }
    }
    // 语言从 ThemeContext 的 userSettings 中读取（统一来源）
    if (userSettings.language) setSettingsLanguage(userSettings.language);
  }, []);

  // 从URL参数读取模板信息
  useEffect(() => {
    const section = searchParams.get('section');
    const allowedSections = new Set(['home', 'video', 'image', 'smart', 'media', 'film', 'tasks', 'settings']);
    if (section && allowedSections.has(section)) {
      setActiveSection(section);
      if (section === 'media') {
        const media = searchParams.get('media');
        if (media === 'assets' || media === 'image' || media === 'poster' || media === 'copywriting' || media === 'xiaohongshu' || media === 'wechat' || media === 'douyin') {
          setMediaSubSection(media);
        }
      }
    }

    const templateId = searchParams.get('templateId');
    const type = searchParams.get('type');
    const prompt = searchParams.get('prompt');
    
    if (templateId || type) {
      if (type === 'video') {
        setActiveSection('video');
        if (prompt) setEditingVideoPrompt(prompt);
      } else if (type === 'image') {
        setActiveSection('media');
        setMediaSubSection('image');
        if (prompt) setEditingImagePrompt(prompt);
      }
    }
  }, [searchParams]);

  // 从真实制作项目资产中拉取首页/素材候选案例。
  useEffect(() => {
    let cancelled = false;

    async function loadProductionCaseAssets() {
      try {
        const data = await clientApiFetch<ProductionCaseAssetsResponse>('/api/production/case-assets?limit=6');
        if (data.success !== true) {
          throw new Error(data.message || '首页制作案例资产加载失败');
        }
        if (!cancelled && Array.isArray(data.cases)) {
          setProductionCaseAssets(data.cases);
        }
      } catch (error) {
        console.warn('[DreamboxHome] 加载制作项目案例资产失败:', error);
      }
    }

    loadProductionCaseAssets();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeHistoricalAssets() {
      try {
        const data = await clientApiFetch<HomeMediaLibraryResponse>('/api/assets/media-library?limit=32');
        if (data.success !== true) {
          throw new Error(data.message || '首页历史精选资产加载失败');
        }
        if (!cancelled && Array.isArray(data.assets)) {
          setHomeHistoricalAssets(data.assets);
        }
      } catch (error) {
        console.warn('[DreamboxHome] 加载首页历史精选资产失败:', error);
      }
    }

    loadHomeHistoricalAssets();
    return () => {
      cancelled = true;
    };
  }, []);

  // 从服务端同步历史任务
  const syncTasksFromServer = useCallback(async (force = false) => {
    try {
      console.log('[DreamboxHome] 从服务端同步任务...');
      const data = await clientApiFetch<TasksResponse>('/api/tasks');

      if (data.success === true) {
        const serverTasks = Array.isArray(data.tasks) ? data.tasks : [];
        console.log(`[DreamboxHome] 收到 ${serverTasks.length} 个服务端任务`);
        
        // 如果服务端没有任务，直接清空本地显示
        if (serverTasks.length === 0 && !force) {
          console.log('[DreamboxHome] 服务端没有任务，清空本地显示');
          setGeneratedVideos([]);
          setGeneratedImages([]);
          return;
        }
        
        // 转换视频任务
        const serverVideos = serverTasks
          .filter((task) => task.type === 'video' && task.status === 'completed' && task.result?.videoUrl)
          .map((task) => ({
            id: task.id,
            videoUrl: task.result?.videoUrl || '',
            prompt: task.config.prompt || '',
            createdAt: task.completedAt || task.createdAt,
            duration: task.config.duration?.toString(),
            resolution: task.config.resolution,
            ratio: task.config.ratio,
          }));
        
        // 转换图片任务（如果有的话）
        const serverImages = serverTasks
          .filter((task) => task.type === 'image' && task.status === 'completed' && task.result?.imageUrls)
          .map((task) => ({
            id: task.id,
            imageUrls: task.result?.imageUrls || [],
            prompt: task.config.prompt || '',
            createdAt: task.completedAt || task.createdAt,
            size: task.config.size,
            resolution: task.config.resolution,
            quality: task.config.quality,
          }));
        
        // 转换文案任务（如果有的话）
        const serverCopywritings = serverTasks
          .filter((task) => task.type === 'copywriting' && task.status === 'completed')
          .map((task) => ({
            id: task.id,
            content: task.result?.content,
            imageUrls: task.result?.imageUrls,
            platform: task.result?.platform,
            prompt: task.config.prompt || '',
            title: task.config.title,
            createdAt: task.completedAt || task.createdAt,
          }));
        
        console.log(`[DreamboxHome] 同步了 ${serverVideos.length} 个视频，${serverImages.length} 个图片，${serverCopywritings.length} 个文案`);
        
        // 合并本地和服务端的视频（服务端优先）
        const mergedVideos = [...serverVideos];
        videoHistory
          .filter(item => item.status === 'completed' && item.videoUrl)
          .forEach(localItem => {
            if (!mergedVideos.find(v => v.id === localItem.id)) {
              mergedVideos.push({
                id: localItem.id,
                videoUrl: localItem.videoUrl!,
                prompt: localItem.prompt,
                createdAt: localItem.completedAt || localItem.createdAt,
                duration: localItem.duration?.toString(),
                resolution: localItem.resolution,
                ratio: localItem.ratio,
              });
            }
          });
        
        // 按时间倒序排列
        mergedVideos.sort((a, b) => b.createdAt - a.createdAt);
        setGeneratedVideos(mergedVideos);
        
        // 同理处理图片
        const mergedImages = [...serverImages];
        imageHistory
          .filter(item => item.status === 'completed' && item.imageUrls)
          .forEach(localItem => {
            if (!mergedImages.find(i => i.id === localItem.id)) {
              mergedImages.push({
                id: localItem.id,
                imageUrls: localItem.imageUrls!,
                prompt: localItem.prompt,
                createdAt: localItem.completedAt || localItem.createdAt,
                size: localItem.size,
                resolution: localItem.resolution,
                quality: localItem.quality,
              });
            }
          });
        
        mergedImages.sort((a, b) => b.createdAt - a.createdAt);
        setGeneratedImages(mergedImages);
        
        // 同理处理文案
        setGeneratedCopywritings(serverCopywritings);
      }
    } catch (error) {
      console.error('[DreamboxHome] 从服务端同步任务失败:', error);
    }
  }, [videoHistory, imageHistory]);

  // 从历史记录恢复生成记录 + 从服务端同步
  useEffect(() => {
    // 先尝试从 localStorage 恢复（快速显示）
    if (videoHistory.length > 0 && generatedVideos.length === 0) {
      const restoredVideos = videoHistory
        .filter(item => item.status === 'completed' && item.videoUrl)
        .map(item => ({
          id: item.id,
          videoUrl: item.videoUrl!,
          prompt: item.prompt,
          createdAt: item.completedAt || item.createdAt,
          duration: item.duration?.toString(),
          resolution: item.resolution,
          ratio: item.ratio,
          materials: item.materials,
          enableSubtitle: item.enableSubtitle,
          subtitleText: item.subtitleText,
          subtitlePosition: item.subtitlePosition,
          subtitleFontSize: item.subtitleFontSize,
          subtitleColor: item.subtitleColor,
          subtitleVoiceType: item.subtitleVoiceType,
          subtitleSpeechSpeed: item.subtitleSpeechSpeed,
          generateVoice: item.generateVoice,
        }));
      setGeneratedVideos(restoredVideos);
    }
    
    if (imageHistory.length > 0 && generatedImages.length === 0) {
      const restoredImages = imageHistory
        .filter(item => item.status === 'completed' && item.imageUrls)
        .map(item => ({
          id: item.id,
          imageUrls: item.imageUrls!,
          prompt: item.prompt,
          createdAt: item.completedAt || item.createdAt,
          size: item.size,
          resolution: item.resolution,
          quality: item.quality,
          materials: item.materials,
          enableImageText: item.enableImageText,
          imageText: item.imageText,
        }));
      setGeneratedImages(restoredImages);
    }
    
    // 然后从服务端同步（获取最新的完整历史）
    syncTasksFromServer();
  }, []); // 只在首次加载时执行

  const handleVideoGenerated = (video: GeneratedVideo) => {
    setGeneratedVideos(prev => [video, ...prev]);
    setCurrentVideo(video);
    setIsGenerating(false);
    setEditingVideoPrompt(null);
    
    addVideoHistory({
      prompt: video.prompt,
      videoUrl: video.videoUrl,
      duration: video.duration ? parseInt(video.duration) : undefined,
      resolution: video.resolution,
      ratio: video.ratio,
      materials: video.materials,
      status: 'completed',
      enableSubtitle: video.enableSubtitle,
      subtitleText: video.subtitleText,
      subtitlePosition: video.subtitlePosition,
      subtitleFontSize: video.subtitleFontSize,
      subtitleColor: video.subtitleColor,
      subtitleVoiceType: video.subtitleVoiceType,
      subtitleSpeechSpeed: video.subtitleSpeechSpeed,
      generateVoice: video.generateVoice,
    });
  };

  const handleImageGenerated = (images: GeneratedImage) => {
    setGeneratedImages(prev => [images, ...prev]);
    setCurrentImages(images);
    setIsGeneratingImage(false);
    setEditingImagePrompt(null);
    
    addImageHistory({
      prompt: images.prompt,
      imageUrls: images.imageUrls,
      size: images.size,
      resolution: images.resolution,
      quality: images.quality,
      materials: images.materials,
      status: 'completed',
      enableImageText: images.enableImageText,
      imageText: images.imageText,
    });
  };

  const handlePromptEnhanced = (originalPrompt: string, enhancedPrompt: string) => {
    addPromptHistory({
      originalPrompt,
      enhancedPrompt,
      used: false,
    });
  };

  const handleRegenerateVideo = (videoOrPrompt: GeneratedVideo | string) => {
    console.log('[DreamboxHome] handleRegenerateVideo called with:', videoOrPrompt);
    
    if (typeof videoOrPrompt === 'string') {
      setEditingVideoPrompt(videoOrPrompt);
      setVideoInitialConfig(null);
    } else {
      setEditingVideoPrompt(videoOrPrompt.prompt);
      setVideoInitialConfig(videoOrPrompt);
    }
    
    // 清空当前视频预览，确保用户看到表单被更新
    setCurrentVideo(null);
    setActiveSection('video');
    
    console.log('[DreamboxHome] handleRegenerateVideo completed, states updated');
  };

  const handleRegenerateImage = (imageOrPrompt: GeneratedImage | string) => {
    if (typeof imageOrPrompt === 'string') {
      setEditingImagePrompt(imageOrPrompt);
      setImageInitialConfig(null);
    } else {
      setEditingImagePrompt(imageOrPrompt.prompt);
      setImageInitialConfig(imageOrPrompt);
    }
    setActiveSection('media');
    setMediaSubSection('image');
  };

  const handleRemixVideo = (video: GeneratedVideo) => {
    setEditingVideoPrompt(video.prompt);
    setActiveSection('video');
  };

  const handleRemixImage = (image: GeneratedImage) => {
    setEditingImagePrompt(image.prompt);
    setActiveSection('media');
    setMediaSubSection('image');
  };

  const handleEditVideo = (video?: GeneratedVideo) => {
    if (video) {
      router.push(`/profile?edit=video&url=${encodeURIComponent(video.videoUrl)}`);
    } else {
      router.push('/profile?edit=video');
    }
  };

  const handleEditImage = (image?: GeneratedImage) => {
    if (image && image.imageUrls.length > 0) {
      router.push(`/profile?edit=image&url=${encodeURIComponent(image.imageUrls[0])}`);
    } else {
      router.push('/profile?edit=image');
    }
  };

  const handleDownloadZip = async (items: (GeneratedVideo | GeneratedImage)[], type: 'video' | 'image') => {
    const zip = new JSZip();

    items.forEach((item, index) => {
      if (type === 'video') {
        const video = item as GeneratedVideo;
        const filename = `video_${index + 1}.mp4`;
        zip.file(filename, fetch(video.videoUrl).then(res => res.blob()));
      } else {
        const image = item as GeneratedImage;
        image.imageUrls.forEach((url, imgIndex) => {
          const filename = `image_${index + 1}_${imgIndex + 1}.png`;
          zip.file(filename, fetch(url).then(res => res.blob()));
        });
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${type}s_${Date.now()}.zip`);
  };

  const handleDeleteVideoHistory = (id: string) => {
    deleteVideoHistory(id);
    setGeneratedVideos(prev => prev.filter(v => v.id !== id));
  };

  const handleDeleteImageHistory = (id: string) => {
    deleteImageHistory(id);
    setGeneratedImages(prev => prev.filter(i => i.id !== id));
  };

  const handleClearVideoHistory = () => {
    if (confirm('确定要清空所有视频历史吗？')) {
      clearVideoHistory();
      setGeneratedVideos([]);
    }
  };

  const handleClearImageHistory = () => {
    if (confirm('确定要清空所有图片历史吗？')) {
      clearImageHistory();
      setGeneratedImages([]);
    }
  };

  const handleCopywritingGenerated = (prompt: string, variations: string[]) => {
    // 文案生成处理逻辑
    console.log('Generated copywriting:', variations);
  };

  const handlePosterGenerated = (imageData: unknown) => {
    // 海报生成处理逻辑
    console.log('Generated poster:', imageData);
  };

  const homeGalleryItems = useMemo<HomeGalleryItem[]>(() => {
    const staticItems: HomeGalleryItem[] = [
      { title: '角色导演', src: '/home/huiying-character-director.png', span: 'row-span-2', type: '角色', target: 'media', source: 'static' },
      { title: '霓虹雨城', src: '/samples/cyber-city.jpg', span: 'row-span-2', type: '场景', target: 'image', source: 'static' },
      { title: '黑玫瑰', src: '/samples/butterfly-rose.jpg', span: 'row-span-2', type: '图像', target: 'image', source: 'static' },
      { title: '海边日落', src: '/samples/sunset-beach.jpg', span: '', type: '场景', target: 'image', source: 'static' },
      { title: '织物静物', src: '/samples/wicker-basket.jpg', span: 'row-span-2', type: '质感', target: 'image', source: 'static' },
      { title: '分镜资产', src: '/home/huiying-hero-production-console.png', span: '', type: '资产', target: 'media', source: 'static' },
      { title: '片段队列', src: '/home/huiying-hero-cinematic-flow.png', videoSrc: '/home/huiying-ark-test-clip-preview.mp4', span: 'col-span-2 row-span-2', type: '真实视频', target: 'film', duration: '00:06', source: 'static' },
    ];
    const historicalItems: HomeGalleryItem[] = pickHomeHistoricalAssets(homeHistoricalAssets).map((asset, index) => ({
      title: asset.title,
      src: asset.poster || asset.url,
      videoSrc: asset.kind === 'video' ? asset.url : undefined,
      span: index < 4 ? 'col-span-2 row-span-2' : index < 8 ? 'row-span-2' : '',
      type: asset.kind === 'video' ? '真实视频' : '图像',
      target: asset.kind === 'video' ? 'video' : 'image',
      duration: asset.kind === 'video' ? '真实素材' : undefined,
      source: 'historical',
    }));
    const dynamicItems: HomeGalleryItem[] = productionCaseAssets.map((asset, index) => ({
      title: asset.title,
      src: asset.posterUrl,
      videoSrc: asset.videoUrl,
      span: index === 0 ? 'col-span-2 row-span-2' : '',
      type: asset.type,
      target: 'tasks',
      duration: asset.durationLabel,
      source: 'production-case-asset',
    }));
    const seen = new Set<string>();
    return [...dynamicItems, ...historicalItems, ...staticItems].filter(item => {
      const key = item.videoSrc || `${item.type}:${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [homeHistoricalAssets, productionCaseAssets]);

  const finalVideoCaseAssets = useMemo(
    () => productionCaseAssets.filter(asset => asset.source === 'productionProject.assets.finalVideo'),
    [productionCaseAssets],
  );

  const segmentCaseAssets = useMemo(
    () => productionCaseAssets.filter(asset => asset.source === 'productionProject.assets.videoSegment'),
    [productionCaseAssets],
  );

  return (
    <div className="min-h-screen bg-background text-foreground overflow-y-auto overflow-x-hidden">
      <DreamboxNavigationShell
        activeSection={activeSection}
        backgroundTaskCount={backgroundTasks.length}
        isMediaExpanded={isMediaExpanded}
        mediaDropdownMenuRef={mediaDropdownMenuRef}
        mediaDropdownRef={mediaDropdownRef}
        mediaDropdownTop={mediaDropdownTop}
        mediaSubSection={mediaSubSection}
        pathname={pathname}
        setActiveSection={setActiveSection}
        setIsMediaExpanded={setIsMediaExpanded}
        setMediaDropdownTop={setMediaDropdownTop}
        setMediaSubSection={setMediaSubSection}
        setSettingsFontSize={setSettingsFontSize}
        setSettingsFontStyle={setSettingsFontStyle}
        setSettingsLanguage={setSettingsLanguage}
        settingsFontSize={settingsFontSize}
        settingsFontStyle={settingsFontStyle}
        settingsLanguage={settingsLanguage}
        t={t}
        updateUserSettings={updateUserSettings}
      />

      <DreamboxMainContent
        activeSection={activeSection}
        apiConnectionStatus={apiConnectionStatus}
        backgroundTasks={backgroundTasks}
        cancelTask={cancelTask}
        clearApiConnectionSettings={clearApiConnectionSettings}
        currentCopywriting={currentCopywriting}
        currentImages={currentImages}
        currentStoryboardTask={currentStoryboardTask}
        editingImagePrompt={editingImagePrompt}
        finalVideoCaseAssets={finalVideoCaseAssets}
        handleClearImageHistory={handleClearImageHistory}
        handleClearVideoHistory={handleClearVideoHistory}
        handleCopywritingGenerated={handleCopywritingGenerated}
        handleEditImage={handleEditImage}
        handlePosterGenerated={handlePosterGenerated}
        handlePromptEnhanced={handlePromptEnhanced}
        handleRegenerateImage={handleRegenerateImage}
        handleRemixImage={handleRemixImage}
        homeGalleryItems={homeGalleryItems}
        onOpenWorkDetail={(item) => {
          setWorkDetailData({
            id: item.title,
            type: item.videoSrc ? 'video' : 'image',
            mediaUrls: [item.videoSrc || item.src],
            prompt: item.title,
            provider: 'historical',
          });
        }}
        imageInitialConfig={imageInitialConfig}
        isDark={isDark}
        isGeneratingImage={isGeneratingImage}
        mediaSubSection={mediaSubSection}
        monitorDetails={monitorDetails}
        monitorTasks={monitorTasks}
        pendingImageRefs={pendingImageRefs}
        pendingPrompt={pendingPrompt}
        productionCaseAssets={productionCaseAssets}
        removeTask={removeTask}
        saveApiConnectionSettings={saveApiConnectionSettings}
        segmentCaseAssets={segmentCaseAssets}
        setActiveSection={setActiveSection}
        setCurrentCopywriting={setCurrentCopywriting}
        setCurrentImages={setCurrentImages}
        setCurrentStoryboardTask={setCurrentStoryboardTask}
        setCurrentVideo={setCurrentVideo}
        setEditingVideoPrompt={setEditingVideoPrompt}
        setGeneratedVideos={setGeneratedVideos}
        setImageInitialConfig={setImageInitialConfig}
        setIsGeneratingImage={setIsGeneratingImage}
        setMediaSubSection={setMediaSubSection}
        setPendingImageRefs={setPendingImageRefs}
        setPendingPrompt={setPendingPrompt}
        setSettingsApiBase={setSettingsApiBase}
        setSettingsApiKey={setSettingsApiKey}
        setSettingsApiProvider={setSettingsApiProvider}
        setSettingsAutoSave={setSettingsAutoSave}
        setSettingsEmail={setSettingsEmail}
        setSettingsFontSize={setSettingsFontSize}
        setSettingsFontStyle={setSettingsFontStyle}
        setSettingsImageModel={setSettingsImageModel}
        setSettingsLanguage={setSettingsLanguage}
        setSettingsModel={setSettingsModel}
        setSettingsNotification={setSettingsNotification}
        setSettingsUsername={setSettingsUsername}
        setSettingsVideoModel={setSettingsVideoModel}
        setShowCopywritingDialog={setShowCopywritingDialog}
        setShowStoryboardDialog={setShowStoryboardDialog}
        setShouldAutoGenerate={setShouldAutoGenerate}
        setSmartAssistantTransfer={setSmartAssistantTransfer}
        setTargetService={setTargetService}
        setTaskViewMode={setTaskViewMode}
        setVideoInitialConfig={setVideoInitialConfig}
        settingsApiBase={settingsApiBase}
        settingsApiKey={settingsApiKey}
        settingsApiProvider={settingsApiProvider}
        settingsAutoSave={settingsAutoSave}
        settingsEmail={settingsEmail}
        settingsFontSize={settingsFontSize}
        settingsFontStyle={settingsFontStyle}
        settingsImageModel={settingsImageModel}
        settingsLanguage={settingsLanguage}
        settingsModel={settingsModel}
        settingsNotification={settingsNotification}
        settingsUsername={settingsUsername}
        settingsVideoModel={settingsVideoModel}
        shouldAutoGenerate={shouldAutoGenerate}
        showCopywritingDialog={showCopywritingDialog}
        showStoryboardDialog={showStoryboardDialog}
        smartAssistantTransfer={smartAssistantTransfer}
        storyboardVideoRef={storyboardVideoRef}
        syncFromServer={syncFromServer}
        t={t}
        targetService={targetService}
        taskViewMode={taskViewMode}
        testApiConnection={testApiConnection}
        toggleColorMode={toggleColorMode}
        updateUserSettings={updateUserSettings}
      />

      {/* 提示词查看与预览修改 */}
      <PromptPreview
        open={!!promptPreviewData}
        data={promptPreviewData ? {
          original: promptPreviewData.prompt,
          negative: promptPreviewData.negativePrompt,
          type: promptPreviewData.type === 'video' ? 'video' : 'image',
          params: promptPreviewData.style ? { style: promptPreviewData.style } : undefined,
        } : null}
        onClose={() => setPromptPreviewData(null)}
        onApply={() => {
          setPromptPreviewData(null);
        }}
      />

      {/* 作品详情浮层 - 点击作品卡片查看大图+提示词 */}
      <WorkDetailOverlay
        open={!!workDetailData}
        data={workDetailData}
        onClose={() => setWorkDetailData(null)}
        onUsePrompt={(prompt) => {
          setPendingPrompt(prompt);
          setShouldAutoGenerate(true);
          // 根据作品类型跳转对应面板
          if (workDetailData?.type === 'video') {
            setActiveSection('film');
          } else {
            setActiveSection('image');
          }
        }}
      />

    </div>
  );
}
