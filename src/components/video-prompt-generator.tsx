'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Camera, 
  Sparkles, 
  Copy, 
  Check, 
  CheckCircle2,
  BookOpen, 
  Zap, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Palette,
  Layers,
  Sun,
  Film,
  Plus,
  Trash2,
  Clock,
  Split,
  RefreshCw,
  PlayCircle,
  Save,
  Settings,
  Loader2,
  Music,
  Info,
  Lightbulb,
  Route,
  Mic,
} from 'lucide-react';
import {
  BASIC_PROMPT_METHODS,
  ADVANCED_PROMPT_METHODS,
  PITFALL_METHODS,
  BASIC_CAMERA_MOVEMENTS,
  COMBINATION_CAMERA_MOVEMENTS,
  PROFESSIONAL_CAMERA_MOVEMENTS,
  SCENE_CAMERA_MOVEMENTS,
  SCENE_QUICK_PROMPTS,
  generateCompletePrompt,
  type PromptTemplate,
  type CameraMovement
} from '@/constants/video-prompt-guide';
import { generateStoryboardFromSubtitles, convertToStoryboardShots, generateShotsFromUserPrompt, checkPromptSensitivity, sanitizePromptForMiniMax, getRiskLevelConfig, isPromptSafe, type StoryboardGenerationResult, type PromptBasedShot } from '@/lib/storyboard-generator';

// ============================================================
// ★ P1新增：产品场景专属方法卡
// 当 sceneType='product' 时，替换默认方法卡为产品专用方法卡
// ============================================================
const PRODUCT_BASIC_METHODS = [
  {
    id: 'product-subject',
    name: '产品精准定义法',
    description: '用结构化方式定义产品的材质、颜色、尺寸、状态等核心属性',
    category: 'basic' as const,
    icon: '📦',
    template: '{产品名称}，{材质/工艺}，{颜色/表面处理}，{尺寸/比例}，{状态/摆放姿态}，{关键特征}',
    example: 'Apple Watch Ultra，钛金属表壳，深空黑色哑光表面，45mm表盘，平放在大理石台面上，屏幕亮起显示运动界面',
    tip: '材质决定质感（金属/玻璃/陶瓷/皮革），表面处理影响光线反射方式',
  },
  {
    id: 'product-action',
    name: '产品展示动作法',
    description: '用起承转合的结构化动作序列描述产品展示过程',
    category: 'basic' as const,
    icon: '🔄',
    template: '{起始状态} → {展示动作1} → {展示动作2} → {最终定格}，全程{速度描述}',
    example: '静止特写 → 缓慢360°旋转展示全貌 → 推近至表盘细节 → 拉远至完整构图，全程丝滑流畅',
    tip: '产品动作核心：旋转(展示全貌) + 推近(细节) + 功能演示(实用性)',
  },
  {
    id: 'product-camera',
    name: '产品运镜组合法',
    description: '按景别和运镜方式的组合来规划产品视频镜头语言',
    category: 'basic' as const,
    icon: '🎬',
    template: '{景别}构图，{运镜方式}，展现{内容重点}，{转场衔接}',
    example: '微距特写构图，缓慢环绕拍摄+定点推近细节，展现钛金属拉丝纹理和蓝宝石镜面光泽，无缝过渡到下一镜头',
    tip: '产品三段式：全景建立→环绕展示→微距细节，每段对应不同卖点',
  },
];

const PRODUCT_ADVANCED_METHODS = [
  {
    id: 'product-lighting',
    name: '专业布光具象法',
    description: '使用专业摄影布光术语精确描述光线方案及其对产品的影响',
    category: 'advanced' as const,
    icon: '💡',
    template: '{布光类型}从{方向}照射，{光效描述}，{对产品的影响}，{环境光补充}',
    example: '轮廓光(Rim Light)从左后45°高位照射，勾勒钛金属边缘的精致轮廓线，与正面柔光箱形成主辅光配合，背景纯黑突出产品主体',
    tip: '电子产品用轮廓光，化妆品用蝴蝶光，奢侈品用点光源聚光，食品用暖调窗光',
  },
  {
    id: 'product-detail',
    name: '感官细节放大法',
    description: '超越视觉维度，加入触觉、听觉暗示让产品描述更具沉浸感',
    category: 'advanced' as const,
    icon: '🔍',
    template: '{视觉细节}，{触觉暗示}，{功能亮点}，{品质信号}',
    example: '表盘指针的微妙反光，哑光金属表面的细腻指纹级纹理，精密齿轮转动的微小震动感，瑞士制表的极致工艺信号',
    tip: '超越视觉：加入触觉(纹理)、听觉(机械声)、重量感的暗示描述',
  },
];

const PRODUCT_PITFALL_METHODS = [
  {
    id: 'pitfall-deform',
    name: '❌ 产品变形模糊',
    description: '避免过于简短的产品描述导致模型自由发挥产生变形',
    category: 'pitfall' as const,
    template: '{产品名称}，{材质/工艺}，{颜色}，{尺寸}，{比例精确}，{边缘锐利}',
    example: 'Apple Watch Ultra，钛金属表壳，深空黑色，45mm表盘，比例精确，边缘锐利无畸变',
    bad: '精美手表',
    good: 'Apple Watch Ultra，钛金属表壳，深空黑色，45mm表盘，比例精确，边缘锐利无畸变',
    fix: '必须明确材质、尺寸、比例，避免模型自由发挥导致变形',
  },
  {
    id: 'pitfall-human-action',
    name: '❌ 人物动作套产品',
    description: '产品不能执行人物动作，必须使用产品专属的动作词汇',
    category: 'pitfall' as const,
    template: '{产品}在{展示台上/平面上}{旋转/推近/展示}，镜头同步{环绕/跟随}',
    example: '智能手机在旋转台上缓慢旋转展示，镜头同步环绕捕捉每个角度的金属边框和玻璃背板',
    bad: '手机缓缓向前走',
    good: '智能手机在旋转台上缓慢旋转展示，镜头同步环绕捕捉每个角度的金属边框和玻璃背板',
    fix: '产品不能"走路"，要用旋转/推近/展示类动作替代人物动作',
  },
];

interface VideoPromptGeneratorProps {
  onPromptGenerated?: (prompt: string, extraData?: {
    /** ★ 字幕分段数据 - 可直接应用到字幕编辑器 */
    subtitleSegments?: Array<{ text: string; startTime: number; endTime: number }>;
    /** ★ 旁白脚本文本 - 可直接应用到旁白输入框 */
    narrationScript?: string;
    /** ★ 完整分镜数据（含每镜头的subtitleText/narrationText） */
    shots?: PromptBasedShot[];
  }) => void;
  /** 字幕段落数据 - 用于智能分镜生成 */
  subtitleSegments?: Array<{ id: string; text: string; startTime: number; endTime: number }>;
}

type SceneType = 'portrait' | 'product' | 'landscape' | 'drama';
type DifficultyLevel = 'basic' | 'advanced' | 'pitfall';

export function VideoPromptGenerator({ onPromptGenerated, subtitleSegments = [] }: VideoPromptGeneratorProps) {
  const [activeTab, setActiveTab] = useState('generator');
  const [sceneType, setSceneType] = useState<SceneType>('portrait');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('basic');
  const [expandedMethods, setExpandedMethods] = useState<Set<string>>(new Set());
  
  // 分镜头模式
  const [showStoryboardMode, setShowStoryboardMode] = useState(false);
  const [totalDuration, setTotalDuration] = useState(15); // 默认15秒
  const [storyboardDescription, setStoryboardDescription] = useState('');
  const [autoGeneratedShots, setAutoGeneratedShots] = useState<Array<{
    id: string;
    prompt: string;
    duration: number;
    phase?: string;
    shotType?: string;
    phaseLabel?: string;
    shotTypeLabel?: string;
    /** ★ v4.0 字幕建议文本 */
    subtitleText?: string;
    /** ★ v4.0 旁白建议文本 */
    narrationText?: string;
  }>>([]);
  // ★ v3.0 新增：叙事摘要和视觉锚点
  const [narrativeSummary, setNarrativeSummary] = useState<string>('');
  const [visualAnchors, setVisualAnchors] = useState<Array<{ element: string; category: string }>>([]);
  // ★ v4.0 新增：字幕和旁白完整数据
  const [subtitleSuggestion, setSubtitleSuggestion] = useState<{
    segments: Array<{ text: string; startTime: number; endTime: number }>;
    fullText: string;
  } | null>(null);
  const [narrationSuggestion, setNarrationSuggestion] = useState<{
    script: string;
    perShot: Array<{ shotIndex: number; text: string; startTime: number; endTime: number }>;
  } | null>(null);

  // 字幕智能分镜相关
  const [subtitleAnalysis, setSubtitleAnalysis] = useState<{
    totalShots: number;
    dominantScene: string;
    dominantEmotion: string;
    warnings: string[];
  } | null>(null);
  const [isGeneratingFromSubtitle, setIsGeneratingFromSubtitle] = useState(false);
  
  // 生成器字段
  const [subjectInput, setSubjectInput] = useState('');
  const [actionsInput, setActionsInput] = useState('');
  const [sceneLightInput, setSceneLightInput] = useState('');
  const [cameraMovementInput, setCameraMovementInput] = useState('');
  const [styleInput, setStyleInput] = useState('');
  const [constraintsInput, setConstraintsInput] = useState('');
  const [negativeInput, setNegativeInput] = useState('无变脸、无肢体畸形、无穿模、无跳帧');
  const [qualityInput, setQualityInput] = useState('4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊');
  const [videoDuration, setVideoDuration] = useState<number>(5); // 默认5秒
  
  // ★ P1新增：产品展示模式（仅产品场景下显示，支持多选组合）
  type ProductDisplayMode = 'hero' | 'lifestyle' | 'detail';
  const [productDisplayModes, setProductDisplayModes] = useState<ProductDisplayMode[]>(['hero']);

  /** 切换展示模式（多选） */
  const toggleProductDisplayMode = (mode: ProductDisplayMode) => {
    setProductDisplayModes(prev => {
      if (prev.includes(mode)) {
        // 至少保留一个
        if (prev.length <= 1) return prev;
        return prev.filter(m => m !== mode);
      }
      return [...prev, mode];
    });
  };

  /** 获取当前选中模式的组合描述 */
  const getCombinedModeDescription = (): string => {
    return productDisplayModes.map(m => productModeLabels[m].label).join(' + ');
  };
  
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const [enhanceSubject, setEnhanceSubject] = useState(true); // 是否优化主体
  const [isRecommendingBgm, setIsRecommendingBgm] = useState(false);
  const [recommendedBgm, setRecommendedBgm] = useState<{
    id: string;
    name: string;
    description: string;
    reason: string;
  } | null>(null);

  // 背景音乐推荐
  const handleRecommendBgm = async (prompt: string) => {
    if (!prompt.trim() || prompt.length < 10) return;

    setIsRecommendingBgm(true);
    try {
      const response = await fetch('/api/prompt/bgm-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (data.success && data.recommendedBgm) {
        setRecommendedBgm({
          id: data.recommendedBgm,
          name: data.bgmName || data.recommendedBgm,
          description: data.bgmDescription || '',
          reason: data.reason || '',
        });
      }
    } catch (error) {
      console.error('音乐推荐失败:', error);
    } finally {
      setIsRecommendingBgm(false);
    }
  };

  // ===== 智能分镜生成函数 =====

  /** ★ v4.0: 格式化时间（秒 → mm:ss） */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /** 从字幕内容智能生成分镜（核心新功能） */
  const generateShotsFromSubtitles = useCallback(async () => {
    if (!subtitleSegments || subtitleSegments.length === 0) {
      alert('没有可用的字幕数据');
      return;
    }

    setIsGeneratingFromSubtitle(true);
    
    try {
      const response = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: subtitleSegments,
          globalStyle: storyboardDescription || undefined,
          includeSourceText: true,
          sceneType: sceneType,  // ★ 传递场景类型，让分镜生成适配当前场景
        }),
      });

      const data = await response.json();

      if (data.success && data.shots && data.shots.length > 0) {
        setAutoGeneratedShots(data.shots);

        // ★ v4.0: 从API响应中提取字幕/旁白数据
        if (data.subtitleSuggestion) {
          setSubtitleSuggestion(data.subtitleSuggestion);
        }
        if (data.narrationSuggestion) {
          setNarrationSuggestion(data.narrationSuggestion);
        }
        if (data.narrativeSummary) {
          setNarrativeSummary(data.narrativeSummary);
        }

        // ★ 自动同步总时长为所有镜头时长之和
        const calculatedTotal = data.shots.reduce((sum: number, s: any) => sum + (s.duration || 0), 0);
        if (calculatedTotal > 0) {
          setTotalDuration(calculatedTotal);
          console.log(`[Storyboard] 总时长已自动同步: ${calculatedTotal}秒 (${data.shots.length}个镜头)`);
        }
        
        if (data.analysis) {
          setSubtitleAnalysis({
            totalShots: data.analysis.summary.totalShots,
            dominantScene: data.analysis.summary.dominantScene,
            dominantEmotion: data.analysis.summary.dominantEmotion,
            warnings: data.analysis.warnings || [],
          });
        }
        console.log(`[Storyboard] 字幕智能分镜生成成功: ${data.shots.length}个镜头`);
      } else {
        throw new Error(data.error || '生成失败');
      }
    } catch (error) {
      console.error('[Storyboard] API调用失败，使用本地降级方案:', error);
      
      // 降级：使用前端本地分析
      const result: StoryboardGenerationResult = generateStoryboardFromSubtitles(subtitleSegments, {
        globalStyle: storyboardDescription || '',
        includeSourceText: true,
      });
      
      setAutoGeneratedShots(convertToStoryboardShots(result.shots));
      
      // ★ 自动同步总时长
      if (result.totalDuration > 0) {
        setTotalDuration(Math.round(result.totalDuration));
        console.log(`[Storyboard] 降级模式总时长已同步: ${Math.round(result.totalDuration)}秒`);
      }
      
      setSubtitleAnalysis({
        totalShots: result.shots.length,
        dominantScene: result.summary.dominantScene,
        dominantEmotion: result.summary.dominantEmotion,
        warnings: [...result.warnings, '(使用本地模式)'],
      });
    } finally {
      setIsGeneratingFromSubtitle(false);
    }
  }, [subtitleSegments, storyboardDescription]);

  /** 基于提示词的改进版分镜生成（替代原来的硬编码模板） */
  const generateShotsFromPrompt = useCallback(async () => {
    if (!storyboardDescription.trim()) {
      alert('请先输入整体描述');
      return;
    }

    try {
      const response = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: storyboardDescription.trim(),
          totalDuration,
          segmentDuration: 10,
        }),
      });

      const data = await response.json();
      
      if (data.success && data.shots && data.shots.length > 0) {
        setAutoGeneratedShots(data.shots);
        
        // ★ 自动同步总时长
        const calculatedTotal = data.shots.reduce((sum: number, s: any) => sum + (s.duration || 0), 0);
        if (calculatedTotal > 0) {
          setTotalDuration(calculatedTotal);
          console.log(`[Storyboard] 提示词模式总时长已同步: ${calculatedTotal}秒`);
        }
        
        console.log(`[Storyboard] 提示词分镜生成成功: ${data.shots.length}个镜头`);
      } else {
        // 降级：前端改进版模板
        generateShotsFromPromptFallback();
      }
    } catch (error) {
      console.error('[Storyboard] 提示词API调用失败，使用本地模板:', error);
      generateShotsFromPromptFallback();
    }
  }, [storyboardDescription, totalDuration]);

  /** 前端降级：基于分镜引擎 v3.0 的场景感知智能分镜生成 */
  const generateShotsFromPromptFallback = useCallback(() => {
    const userDesc = storyboardDescription.trim();

    if (!userDesc) {
      alert('请先输入整体描述');
      return;
    }

    // ===== 使用优化引擎 v4.0（场景感知 + 视觉锚点 + Phase弧线 + 字幕/旁白生成） =====
    // 7种场景专属策略：产品/人像/风景/美食/剧情/抽象/室内
    const result = generateShotsFromUserPrompt(userDesc, totalDuration, {
      maxShotDuration: 10,
      preferredSceneType: sceneType as any,
    });

    setAutoGeneratedShots(result.shots);

    // ★ v3.0: 存储叙事摘要和视觉锚点
    if (result.narrativeSummary) {
      setNarrativeSummary(result.narrativeSummary);
    }
    if (result.visualAnchors && result.visualAnchors.length > 0) {
      setVisualAnchors(result.visualAnchors);
    }

    // ★ v4.0: 存储字幕和旁白数据
    if (result.subtitleSuggestion) {
      setSubtitleSuggestion(result.subtitleSuggestion);
    }
    if (result.narrationSuggestion) {
      setNarrationSuggestion(result.narrationSuggestion);
    }
    
    // 自动同步总时长
    const fallbackTotal = result.shots.reduce((sum, s) => sum + s.duration, 0);
    if (fallbackTotal > 0) {
      setTotalDuration(fallbackTotal);
      console.log(`[Storyboard v4.0] 总时长: ${fallbackTotal}秒 (${result.shots.length}个镜头), 场景=${sceneType}, 策略=${result.narrativeSummary}`);
      console.log(`[Storyboard v4.0] 视觉锚点: ${result.visualAnchors.map(a => a.element).join(', ') || '无'}`);
      console.log(`[Storyboard v4.0] 字幕段数: ${result.subtitleSuggestion?.segments.length || 0}, 旁白字数: ${result.narrationSuggestion?.script.length || 0}`);
      if (result.entities.location || result.entities.objects.length > 0) {
        console.log(`[Storyboard v3.0] 提取实体: location=${result.entities.location}, objects=${result.entities.objects.join(',')}, action=${result.entities.action}`);
      }
    }
  }, [storyboardDescription, totalDuration, sceneType]);

  // ============================================================
  // ★ P1: 场景专属默认值和辅助函数
  // ============================================================

  /** 根据场景类型获取默认负面提示词 */
  const getDefaultNegative = (scene: string): string => {
    switch (scene) {
      case 'product': return '无变形、无模糊、无材质错误、无比例失调、无Logo扭曲、无文字渲染异常';
      case 'food': return '无变形、无模糊、色泽失真、质感不自然、摆盘凌乱';
      case 'landscape': return '无跳帧、无变形、无模糊、色彩失真';
      case 'drama': return '无变脸、无肢体畸形、无穿模、无跳帧、表演不连贯';
      default: return '无变脸、无肢体畸形、无穿模、无跳帧';
    }
  };

  /** 根据场景类型获取主体输入占位符 */
  const getSubjectPlaceholder = (scene: string): string => {
    switch (scene) {
      case 'product': return '如：Apple Watch Ultra，钛金属表壳，深空黑色，45mm表盘';
      case 'food': return '如：手工拉花拿铁，厚实奶泡层，撒可可粉装饰，白色陶瓷杯';
      case 'landscape': return '如：清晨的富士山，云海翻涌，樱花盛开';
      case 'drama': return '如：20岁东亚女生，黑长直发，白色连衣裙，坐在窗边回眸';
      default: return '如：20岁东亚淡颜女生，黑长直齐肩发，白色棉麻连衣裙...';
    }
  };

  /** 根据场景类型获取动作输入占位符 */
  const getActionPlaceholder = (scene: string): string => {
    switch (scene) {
      case 'product': return '产品展示动作：360°旋转展示、微距推近细节、功能按键演示';
      case 'food': return '美食动作：热气升腾、酱汁流淌、切开瞬间、食材特写';
      case 'landscape': return '风景动作：镜头推进、云层流动、光影变化、季节特征展现';
      case 'drama': return '剧情动作：对话互动、情绪变化、转身离开、发现真相';
      default: return '人物的行走、转身、表情变化等';
    }
  };

  /** 产品展示模式描述 */
  const productModeLabels: Record<ProductDisplayMode, { label: string; desc: string }> = {
    hero: { label: '纯净展示', desc: '产品单独在干净背景中，360°全方位展示（电商/发布）' },
    lifestyle: { label: '情境融入', desc: '产品在使用场景中出现，有人物/环境互动（广告/种草）' },
    detail: { label: '细节放大', desc: '极近距离展示材质纹理/工艺细节/功能细节（工艺/品质）' },
  };

  // ============================================================
  // ★ P2新增：产品布光知识库 + 运镜-光线联动
  // ============================================================

  interface LightingSuggestion {
    name: string;
    description: string;
    promptTemplate: string;
    suitableFor: string[]; // 适合的运镜类型
  }

  /** 产品专业布光方案库 */
  const PRODUCT_LIGHTING_KNOWLEDGE: Record<string, LightingSuggestion> = {
    rim_light: {
      name: '轮廓光 (Rim Light)',
      description: '从侧后方高位照射，勾勒产品边缘轮廓，分离背景突出主体',
      promptTemplate: '轮廓光(Rim Light)从左后45°高位照射，勾勒{product}边缘的精致轮廓线，与正面柔光形成主辅配合',
      suitableFor: ['环绕拍摄', '旋转展示', '全景建立'],
    },
    butterfly: {
      name: '蝴蝶光 (Butterfly)',
      description: '正上方垂直照射，消除面部/平面阴影，适合化妆品等需要均匀光照的产品',
      promptTemplate: '蝴蝶光(Butterfly)从正上方垂直照射，均匀照亮{product}表面消除阴影，突出色彩和质地',
      suitableFor: ['特写镜头', '定点展示', '微距拍摄'],
    },
    softbox: {
      name: '柔光箱 (Softbox)',
      description: '大面积柔和光源，产生柔和阴影，适合电商通用产品展示',
      promptTemplate: '大型柔光箱(Softbox)从45°侧前方照射{product}，柔和阴影展现立体感，质感自然真实',
      suitableFor: ['中景跟拍', '推近镜头', '平移运镜'],
    },
    spotlight: {
      name: '点光源聚光 (Spotlight)',
      description: '集中强光照射，戏剧性光影效果，适合奢侈品和高端电子产品',
      promptTemplate: '点光源聚光(Spotlight)聚焦照射{product}核心区域，周围渐暗形成戏剧性对比，凸显高端品质感',
      suitableFor: ['微距特写', '定格细节', '慢动作'],
    },
    window_light: {
      name: '自然窗光 (Window Light)',
      description: '模拟窗户自然光方向，温馨生活化氛围，适合生活用品和食品',
      promptTemplate: '自然窗光(Window Light)从右侧模拟窗户方向照射{product}，温暖柔和的生活化光照，营造亲切氛围',
      suitableFor: ['情境融入', '生活方式', '中景构图'],
    },
    two_tone: {
      name: '双色温对比 (Two-tone)',
      description: '冷暖双色温同时使用，科技未来感强烈，适合电子产品和汽车',
      promptTemplate: '双色温对比(Two-tone)：冷蓝色调背景光+暖橙色前景光共同作用在{product}上，强烈的科技未来感视觉冲击',
      suitableFor: ['科技风格', '动态效果', '快节奏剪辑'],
    },
  };

  /**
   * 根据选中的运镜方式获取推荐的布光方案
   * 当用户选择特定运镜时，自动建议匹配的光线方案
   */
  const getLightingSuggestionForCamera = (cameraMove: string): LightingSuggestion | null => {
    if (sceneType !== 'product') return null;

    const suggestions = Object.values(PRODUCT_LIGHTING_KNOWLEDGE).filter(s =>
      s.suitableFor.some(suitable => cameraMove.includes(suitable) || suitable.includes(cameraMove))
    );

    return suggestions.length > 0 ? suggestions[0] : null;
  };

  /** 根据产品展示模式推荐默认布光（支持多模式组合） */
  const getDefaultLightingForProduct = (): string => {
    const modes = productDisplayModes;
    if (modes.length === 1) {
      switch (modes[0]) {
        case 'hero': return '轮廓光(Rim Light) + 柔光箱(Softbox)组合，专业影棚级布光';
        case 'lifestyle': return '自然窗光(Window Light)，温馨生活化氛围';
        case 'detail': return '点光源聚光(Spotlight)，戏剧性光影突出工艺细节';
        default: return '专业影棚布光';
      }
    }
    // 多模式组合：取各模式布光的融合
    const lightingParts: string[] = [];
    if (modes.includes('hero')) lightingParts.push('轮廓光(Rim Light)');
    if (modes.includes('lifestyle')) lightingParts.push('自然窗光(Window Light)');
    if (modes.includes('detail')) lightingParts.push('点光源聚光(Spotlight)');
    return `${lightingParts.join(' + ')} 组合布光，多层次光影效果`;
  };

  // 当场景切换到非产品时，重置负面词为对应场景的默认值
  useEffect(() => {
    setNegativeInput(getDefaultNegative(sceneType));
  }, [sceneType]);

  // AI自动补全提示词字段
  const handleAutoComplete = async () => {
    if (!subjectInput.trim() || subjectInput.length < 2) {
      alert('请先输入至少2个字符的核心主体描述');
      return;
    }

    setIsAutoCompleting(true);

    try {
      const response = await fetch('/api/prompt/auto-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          subject: subjectInput,
          enhanceSubject: enhanceSubject,
          duration: videoDuration,
          sceneType: sceneType,
          productDisplayModes: sceneType === 'product' ? productDisplayModes : undefined,  // ★ 多选展示模式
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '自动补全失败');
      }

      // 如果启用了主体优化，更新主体内容
      if (enhanceSubject && data.enhancedSubject) {
        setSubjectInput(data.enhancedSubject);
      }

      // 更新各个字段
      if (data.actionsInput) setActionsInput(data.actionsInput);
      if (data.cameraMovementInput) setCameraMovementInput(data.cameraMovementInput);
      if (data.sceneLightInput) setSceneLightInput(data.sceneLightInput);
      if (data.styleInput) setStyleInput(data.styleInput);
      if (data.constraintsInput) setConstraintsInput(data.constraintsInput);

    } catch (error) {
      console.error('自动补全错误:', error);
      alert(error instanceof Error ? error.message : '自动补全失败，请重试');
    } finally {
      setIsAutoCompleting(false);
    }
  };

  // 切换方法展开/收起
  const toggleMethod = (id: string) => {
    const newExpanded = new Set(expandedMethods);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMethods(newExpanded);
  };

  // 使用模板
  const useTemplate = (template: PromptTemplate) => {
    if (template.category === 'basic') {
      setDifficulty('basic');
    } else if (template.category === 'advanced') {
      setDifficulty('advanced');
    } else {
      setDifficulty('pitfall');
    }
    
    // 根据模板类型填充对应字段
    switch(template.id) {
      case 'subject-definition':
        setSubjectInput(template.example);
        break;
      case 'sequence-action':
        setActionsInput(template.example);
        break;
      case 'scene-movement':
        setCameraMovementInput(template.example);
        break;
      case 'light-concrete':
        setSceneLightInput(template.example);
        break;
      case 'quality-required':
        setQualityInput(template.example);
        break;
      case 'style-single':
        setStyleInput(template.example);
        break;
      case 'negative-simple':
        setNegativeInput(template.example);
        break;
      default:
        // 对于其他模板，直接生成完整提示词
        setGeneratedPrompt(template.example);
    }
  };

  // 使用运镜
  const useCameraMovement = (movement: CameraMovement) => {
    console.log('点击使用运镜:', movement);
    setCameraMovementInput(movement.example);
    // 自动切换到提示词生成器标签
    setActiveTab('generator');
  };

  // 使用快捷提示词
  const useQuickPrompt = (type: 'basic' | 'advanced') => {
    const scenePrompts = SCENE_QUICK_PROMPTS[sceneType];
    if (!scenePrompts || !scenePrompts[type]) {
      alert(`当前场景类型「${sceneType}」暂无${type === 'basic' ? '基础' : '进阶'}预设，请先填写各字段后点击「生成提示词」`);
      return;
    }
    const prompt = scenePrompts[type];
    setGeneratedPrompt(prompt);
    // ★ 自动滚动到生成结果区域
    setTimeout(() => {
      const resultEl = document.getElementById('prompt-result-card');
      if (resultEl) {
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // 生成完整提示词 - 遵循正确顺序：核心主体 > 连续动作指令 > 镜头与运镜 > 场景与光影 > 风格与画质 > 强制约束指令 > 负面提示词
  const generatePrompt = useCallback(() => {
    const prompt = generateCompletePrompt(
      subjectInput,           // 1. 核心主体
      actionsInput,          // 2. 连续动作指令
      cameraMovementInput,   // 3. 镜头与运镜
      sceneLightInput,       // 4. 场景与光影
      styleInput,           // 5. 风格与画质
      qualityInput,         // 6. 画质必加句
      constraintsInput,     // 7. 强制约束指令
      negativeInput         // 8. 负面提示词
    );
    setGeneratedPrompt(prompt);
    
    if (onPromptGenerated && prompt) {
      onPromptGenerated(prompt);
    }
    
    // 自动推荐背景音乐
    handleRecommendBgm(prompt);
  }, [subjectInput, actionsInput, cameraMovementInput, sceneLightInput, styleInput, qualityInput, constraintsInput, negativeInput, onPromptGenerated]);

  // 复制提示词
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  // 清空所有字段
  const clearAll = () => {
    setSubjectInput('');
    setActionsInput('');
    setSceneLightInput('');
    setCameraMovementInput('');
    setStyleInput('');
    setConstraintsInput('');
    setGeneratedPrompt('');
  };

  // 渲染方法卡片
  const renderMethodCard = (method: PromptTemplate) => {
    const isExpanded = expandedMethods.has(method.id);
    const categoryColors = {
      basic: 'bg-red-500/20 text-red-400',
      advanced: 'bg-red-500/20 text-red-400',
      pitfall: 'bg-red-500/20 text-red-400'
    };
    
    const categoryNames = {
      basic: '基础',
      advanced: '进阶',
      pitfall: '避坑'
    };
    
    const categoryIcons = {
      basic: <BookOpen className="w-4 h-4" />,
      advanced: <Zap className="w-4 h-4" />,
      pitfall: <AlertTriangle className="w-4 h-4" />
    };

    return (
      <Card key={method.id} className="border-border bg-accent/30">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${categoryColors[method.category]}`}>
                  {categoryIcons[method.category]}
                  {categoryNames[method.category]}
                </span>
              </div>
              <CardTitle className="text-lg text-white">{method.name}</CardTitle>
              <CardDescription className="text-muted-foreground mt-1">
                {method.description}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => toggleMethod(method.id)}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="pt-0 space-y-4">
            <div>
              <Label className="text-foreground/70 text-sm mb-2 block">模板结构</Label>
              <div className="bg-black/30 rounded-lg p-3 font-mono text-sm text-foreground/80">
                {method.template}
              </div>
            </div>
            <div>
              <Label className="text-foreground/70 text-sm mb-2 block">示例</Label>
              <div className="bg-[#EF4444]/10 rounded-lg p-3 text-sm text-[#EF4444] border border-[#EF4444]/20">
                {method.example}
              </div>
            </div>
            <Button
              className="w-full bg-[#EF4444] hover:bg-[#EF4444]/90 text-black"
              onClick={() => useTemplate(method)}
            >
              使用此模板
            </Button>
          </CardContent>
        )}
      </Card>
    );
  };

  // 渲染运镜卡片
  const renderCameraMovementCard = (movement: CameraMovement) => {
    const categoryColors = {
      basic: 'bg-green-500/20 text-green-400',
      combination: 'bg-red-500/20 text-red-400',
      professional: 'bg-red-500/20 text-red-400',
      scene: 'bg-red-500/20 text-red-400'
    };
    
    const categoryNames = {
      basic: '基础',
      combination: '组合',
      professional: '专业',
      scene: '场景'
    };

    return (
      <Card key={movement.id} className="border-border bg-accent/30 hover:border-[#EF4444]/30 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 rounded-full text-xs ${categoryColors[movement.category]}`}>
                  {categoryNames[movement.category]}
                </span>
                {movement.sceneCategory && (
                  <span className="px-2 py-1 rounded-full text-xs bg-accent/50 text-muted-foreground">
                    {movement.sceneCategory === 'portrait' ? '人像' :
                     movement.sceneCategory === 'product' ? '产品' :
                     movement.sceneCategory === 'landscape' ? '风景' : '剧情'}
                  </span>
                )}
              </div>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#EF4444]" />
                {movement.name}
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-sm">
                {movement.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="bg-black/30 rounded-lg p-3 text-sm text-foreground/80">
            {movement.example}
          </div>
          <Button
            variant="default"
            size="sm"
            className="w-full bg-[#EF4444] hover:bg-[#EF4444]/90 text-black"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('按钮被点击, movement:', movement);
              useCameraMovement(movement);
            }}
          >
            使用此运镜
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* 主标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-4 bg-accent/30">
          <TabsTrigger value="generator" className="data-[state=active]:bg-[#EF4444] data-[state=active]:text-black">
            <Sparkles className="w-4 h-4 mr-2" />
            提示词生成器
          </TabsTrigger>
          <TabsTrigger value="storyboard" className="data-[state=active]:bg-[#EF4444] data-[state=active]:text-black">
            <Film className="w-4 h-4 mr-2" />
            分镜头助手
          </TabsTrigger>
          <TabsTrigger value="methods" className="data-[state=active]:bg-[#EF4444] data-[state=active]:text-black">
            <BookOpen className="w-4 h-4 mr-2" />
            方法库
          </TabsTrigger>
          <TabsTrigger value="camera" className="data-[state=active]:bg-[#EF4444] data-[state=active]:text-black">
            <Camera className="w-4 h-4 mr-2" />
            运镜库
          </TabsTrigger>
        </TabsList>

        {/* 分镜头助手 */}
        <TabsContent value="storyboard" className="space-y-6 mt-6">
          <Card className="border-border bg-gradient-to-r from-red-500/10 to-pink-500/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Split className="w-5 h-5 text-[#EF4444]" />
                分镜头提示词助手
              </CardTitle>
              <CardDescription>
                根据总时长自动划分分镜头，确保每段不超过10秒，首帧与前一段尾帧一致
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* ★ 场景类型联动提示 */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20">
                <Layers className="w-4 h-4 text-[#EF4444]" />
                <span className="text-xs text-foreground/70">分镜将基于</span>
                <span className="text-xs font-medium text-[#EF4444]">
                  {{ portrait: '人像/肖像', product: '产品展示', landscape: '风景/自然', food: '美食/食品', drama: '剧情/故事' }[sceneType] || sceneType}
                </span>
                <span className="text-xs text-foreground/70">场景类型生成</span>
                <span className="text-xs text-foreground/30 ml-auto">（与提示词生成器的场景选择联动）</span>
              </div>

              {/* 总时长和描述 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#EF4444] flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    总时长（秒）
                  </Label>
                  <Input
                    type="number"
                    min={11}
                    max={300}
                    value={totalDuration}
                    onChange={(e) => setTotalDuration(Math.max(11, parseInt(e.target.value) || 15))}
                    className="bg-black/30 border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    总时长必须超过10秒，推荐15-60秒
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#EF4444]/90 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    整体描述
                  </Label>
                  <Textarea
                    placeholder="描述整个视频的内容，例如：一个女生从海边沙滩走到栈道，欣赏日落，最后微笑面对镜头..."
                    value={storyboardDescription}
                    onChange={(e) => setStoryboardDescription(e.target.value)}
                    className="h-24 bg-black/30 border-border"
                  />
                  {/* ★ v2.0 实时敏感度指示器 */}
                  {storyboardDescription.length > 3 && (() => {
                    const sensitivity = checkPromptSensitivity(storyboardDescription);
                    if (!sensitivity.isSensitive) return null;
                    const config = getRiskLevelConfig(sensitivity.riskLevel);
                    return (
                      <div className={`flex items-center gap-2 mt-1.5 px-2.5 py-1.5 rounded-md text-xs border ${config.bgColor} ${config.borderColor}`}>
                        <span className={`${config.color} font-bold`}>{config.icon}</span>
                        <span className={config.color}>{config.label}</span>
                        <span className="text-foreground/70">·</span>
                        <span className="text-muted-foreground">{sensitivity.detectedWords.length}个敏感词</span>
                        {sensitivity.riskScore > 20 && (
                          <>
                            <span className="text-foreground/70">·</span>
                            <span className="text-foreground/70">风险分: {sensitivity.riskScore}</span>
                          </>
                        )}
                        {(sensitivity.riskLevel === 'high' || sensitivity.riskLevel === 'critical') && (
                          <button
                            onClick={() => {
                              const result = sanitizePromptForMiniMax(storyboardDescription);
                              if (result.isModified) {
                                setStoryboardDescription(result.sanitized);
                              }
                            }}
                            className="ml-auto text-[10px] px-2 py-0.5 rounded bg-accent/50 hover:bg-accent/70 text-foreground/70 transition-colors"
                          >
                            一键修复
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ===== 方式1：从字幕内容智能生成（推荐）===== */}
              {subtitleSegments && subtitleSegments.length > 0 && (
                <div className="space-y-3 p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-green-400" />
                    <Label className="text-green-400 text-sm font-medium">智能模式：从字幕内容生成分镜</Label>
                    <span className="text-xs text-foreground/70 ml-auto">{subtitleSegments.length}段字幕可用</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    根据每段字幕的文字内容，自动分析场景、情感、动作，生成每个分镜的独特画面描述
                  </p>
                  <Button
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                    onClick={generateShotsFromSubtitles}
                    disabled={isGeneratingFromSubtitle}
                  >
                    {isGeneratingFromSubtitle ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        正在分析字幕内容...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        从字幕智能生成分镜
                      </>
                    )}
                  </Button>

                  {/* 字幕分析结果 */}
                  {subtitleAnalysis && (
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-green-500/10">
                      <div className="text-center">
                        <div className="text-base font-bold text-green-400">{subtitleAnalysis.totalShots}</div>
                        <div className="text-[10px] text-foreground/70">镜头数</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-medium text-foreground/80">{subtitleAnalysis.dominantScene}</div>
                        <div className="text-[10px] text-foreground/70">主导场景</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-medium text-foreground/80">{subtitleAnalysis.dominantEmotion}</div>
                        <div className="text-[10px] text-foreground/70">主导情感</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 分隔线 */}
              {(subtitleSegments && subtitleSegments.length > 0) && (
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-accent/50"></div>
                  <span className="text-xs text-foreground/30">或使用传统模式</span>
                  <div className="flex-1 h-px bg-accent/50"></div>
                </div>
              )}

              {/* ===== 方式2：传统提示词模式（已改进）===== */}
              <Button
                className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                onClick={generateShotsFromPrompt}
                disabled={!storyboardDescription.trim()}
              >
                <Split className="w-4 h-4 mr-2" />
                自动划分分镜头（传统模式）
              </Button>
            </CardContent>
          </Card>

          {/* ★ v3.0 自动生成的分镜头列表（含叙事摘要+Phase标签） */}
          {autoGeneratedShots.length > 0 && (
            <div className="space-y-4">
              {/* ===== 叙事摘要面板 ===== */}
              {narrativeSummary && (
                <Card className="border-[#EF4444]/20 bg-gradient-to-r from-[#EF4444]/5 to-red-500/5">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Route className="w-4 h-4 text-[#EF4444]" />
                      <span className="text-xs font-medium text-[#EF4444]">叙事结构</span>
                    </div>
                    <p className="text-sm text-foreground/80 font-mono">{narrativeSummary}</p>
                    
                    {/* 视觉锚点 */}
                    {visualAnchors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border">
                        <span className="text-[10px] text-foreground/70">视觉锚点:</span>
                        {visualAnchors.map((anchor, i) => {
                          const categoryColors: Record<string, string> = {
                            color: 'bg-red-500/20 text-red-300 border-red-500/30',
                            material: 'bg-red-500/20 text-red-300 border-red-500/30',
                            object: 'bg-red-500/20 text-red-300 border-red-500/30',
                            style: 'bg-red-500/20 text-red-300 border-red-500/30',
                            lighting: 'bg-red-500/20 text-red-300 border-red-500/30',
                          };
                          const colorClass = categoryColors[anchor.category] || 'bg-accent/50 text-muted-foreground border-white/20';
                          return (
                            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border ${colorClass}`}>
                              {anchor.element}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="border-border bg-accent/30">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Layers className="w-5 h-5 text-[#EF4444]" />
                        分镜头列表 ({autoGeneratedShots.length}段)
                      </CardTitle>
                      <CardDescription>
                        每个分镜已根据场景类型生成差异化提示词，请检查并微调
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#EF4444]">
                        {autoGeneratedShots.reduce((sum, s) => sum + s.duration, 0)}秒
                      </div>
                      <div className="text-xs text-muted-foreground">
                        每段最长{Math.max(...autoGeneratedShots.map(s => s.duration))}秒
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {autoGeneratedShots.map((shot, index) => {
                    // Phase 颜色映射
                    const phaseColors: Record<string, string> = {
                      establishing: 'bg-red-500/20 text-red-300 border-red-400/30',
                      developing: 'bg-green-500/20 text-green-300 border-green-400/30',
                      detail: 'bg-red-500/20 text-red-300 border-red-400/30',
                      climax: 'bg-red-500/20 text-red-300 border-red-400/30',
                      resolving: 'bg-red-500/20 text-red-300 border-red-400/30',
                    };
                    const phaseColor = phaseColors[shot.phase || ''] || 'bg-accent/50 text-muted-foreground border-white/20';

                    return (
                      <Card key={shot.id} className={`border-border bg-black/30 ${shot.phase === 'climax' ? 'ring-1 ring-red-500/20' : ''}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-[#EF4444] text-black rounded-full flex items-center justify-center font-bold text-sm">
                                {index + 1}
                              </div>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-white text-sm">
                                    分镜头 {index + 1}
                                  </CardTitle>
                                  {/* ★ Phase 标签 */}
                                  {shot.phaseLabel && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${phaseColor}`}>
                                      {shot.phaseLabel}
                                    </span>
                                  )}
                                  {/* ★ 镜头类型标签 */}
                                  {shot.shotTypeLabel && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/30 text-muted-foreground border border-border">
                                      {shot.shotTypeLabel}
                                    </span>
                                  )}
                                </div>
                                <CardDescription className="text-xs">
                                  {shot.duration}秒
                                  {index > 0 && <span className="ml-2 text-red-400/70">首帧与前一段尾帧保持一致</span>}
                                </CardDescription>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-foreground/70 hover:text-red-400"
                              onClick={() => {
                                setAutoGeneratedShots(prev => prev.filter(s => s.id !== shot.id));
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Textarea
                            value={shot.prompt}
                            onChange={(e) => {
                              setAutoGeneratedShots(prev => prev.map(s => 
                                s.id === shot.id ? { ...s, prompt: e.target.value } : s
                              ));
                            }}
                            className="h-20 bg-black/30 border-border text-sm"
                            placeholder="请补充这个分镜头的详细描述..."
                          />
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-muted-foreground text-xs">时长</Label>
                              <Input
                                type="number"
                                min={1}
                                max={10}
                                value={shot.duration}
                                onChange={(e) => {
                                  const duration = Math.min(10, Math.max(1, parseInt(e.target.value) || 5));
                                  setAutoGeneratedShots(prev => prev.map(s => 
                                    s.id === shot.id ? { ...s, duration } : s
                                  ));
                              }}
                              className="w-20 h-7 bg-black/30 border-border text-xs"
                            />
                            <span className="text-muted-foreground text-xs">秒</span>
                          </div>

                          {/* ★ v4.0 字幕/旁白建议展示 */}
                          {(shot.subtitleText || shot.narrationText) && (
                            <div className="mt-3 pt-2 border-t border-border/50 space-y-2">
                              {shot.subtitleText && (
                                <div className="flex items-start gap-2">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/20 flex-shrink-0 mt-0.5">
                                    字幕
                                  </span>
                                  <p className="text-xs text-muted-foreground leading-relaxed">{shot.subtitleText}</p>
                                </div>
                              )}
                              {shot.narrationText && (
                                <div className="flex items-start gap-2">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 flex-shrink-0 mt-0.5">
                                    旁白
                                  </span>
                                  <p className="text-xs text-muted-foreground leading-relaxed italic">{shot.narrationText}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                  
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const newShot = {
                          id: `auto-shot-${Date.now()}`,
                          prompt: '新分镜头：',
                          duration: 5
                        };
                        setAutoGeneratedShots(prev => [...prev, newShot]);
                      }}
                      className="flex-1"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      添加分镜头
                    </Button>
                    {onPromptGenerated && (
                      <Button
                        className="flex-1 bg-gradient-to-r from-[#EF4444] to-[#B4E22F] hover:opacity-90 text-black"
                        onClick={() => {
                          const fullPrompt = autoGeneratedShots.map((shot, i) =>
                            `[镜头${i + 1} - ${shot.duration}秒] ${shot.prompt}`
                          ).join('\n\n');
                          // ★ v4.0: 传递字幕/旁白数据给父组件
                          onPromptGenerated(fullPrompt, {
                            subtitleSegments: subtitleSuggestion?.segments,
                            narrationScript: narrationSuggestion?.script,
                            shots: autoGeneratedShots as any,
                          });
                        }}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        生成分镜头提示词
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* ★ v4.0 字幕与旁白应用面板 */}
              {(subtitleSuggestion || narrationSuggestion) && (
                <Card className="border-border bg-accent/30">
                  <CardHeader>
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <FileText className="w-5 h-5 text-red-400" />
                      字幕与旁白内容
                    </CardTitle>
                    <CardDescription>
                      基于分镜自动生成的字幕建议和旁白脚本，点击按钮直接应用到对应功能
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 字幕预览 + 应用按钮 */}
                    {subtitleSuggestion && subtitleSuggestion.segments.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/20 font-medium">
                              字幕建议
                            </span>
                            <span className="text-xs text-foreground/70">{subtitleSuggestion.segments.length}段</span>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 hover:text-red-200"
                            onClick={() => {
                              if (onPromptGenerated) {
                                onPromptGenerated('', {
                                  subtitleSegments: subtitleSuggestion.segments,
                                  narrationScript: undefined,
                                  shots: autoGeneratedShots as any,
                                });
                              }
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            应用到字幕编辑器
                          </Button>
                        </div>
                        <div className="max-h-[120px] overflow-y-auto rounded-lg bg-black/30 p-3 space-y-1.5">
                          {subtitleSuggestion.segments.map((seg, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span className="flex-shrink-0 w-5 h-5 bg-red-500/20 text-red-300 rounded flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                              <span className="text-foreground/70 leading-relaxed">{seg.text}</span>
                              <span className="flex-shrink-0 text-foreground/30 ml-auto">{formatTime(seg.startTime)}-{formatTime(seg.endTime)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 旁白预览 + 应用按钮 */}
                    {narrationSuggestion && narrationSuggestion.script && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-medium">
                              旁白脚本
                            </span>
                            <span className="text-xs text-foreground/70">{narrationSuggestion.script.length}字</span>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 hover:text-emerald-200"
                            onClick={() => {
                              if (onPromptGenerated) {
                                onPromptGenerated('', {
                                  subtitleSegments: undefined,
                                  narrationScript: narrationSuggestion.script,
                                  shots: autoGeneratedShots as any,
                                });
                              }
                            }}
                          >
                            <Mic className="w-3.5 h-3.5 mr-1" />
                            应用为旁白内容
                          </Button>
                        </div>
                        <div className="rounded-lg bg-black/30 p-3">
                          <p className="text-sm text-muted-foreground leading-relaxed italic">{narrationSuggestion.script}</p>

                          {/* 按镜头拆分的旁白片段 */}
                          {narrationSuggestion.perShot.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/50 space-y-1 max-h-[100px] overflow-y-auto">
                              {narrationSuggestion.perShot.map((ps, i) => (
                                <div key={i} className="flex items-start gap-2 text-[11px]">
                                  <span className="flex-shrink-0 w-5 h-5 bg-emerald-500/20 text-emerald-300 rounded flex items-center justify-center text-[10px]">#{ps.shotIndex + 1}</span>
                                  <span className="text-muted-foreground leading-relaxed">{ps.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 检查清单 */}
              <Card className="border-border bg-accent/30">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-400" />
                    分镜头检查清单
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-foreground/70">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>总时长超过10秒：{autoGeneratedShots.reduce((sum, s) => sum + s.duration, 0)}秒 ✓</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>每段分镜头不超过10秒：最长{Math.max(...autoGeneratedShots.map(s => s.duration))}秒 ✓</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <span>请确保每段分镜头首帧与前一段尾帧一致（需要人工确认）</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <span>请确保所有分镜头提示词内容连贯（需要人工确认）</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* 提示词生成器 */}
        <TabsContent value="generator" className="space-y-6 mt-6">
          {/* 场景选择 */}
          <Card className="border-border bg-accent/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#EF4444]" />
                快速开始
              </CardTitle>
              <CardDescription>选择场景后，可直接使用预设提示词</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'portrait', label: '人像', icon: '👤' },
                    { id: 'product', label: '产品', icon: '📦' },
                    { id: 'landscape', label: '风景', icon: '🏔️' },
                    { id: 'drama', label: '剧情', icon: '🎬' }
                  ].map((scene) => (
                    <Button
                      key={scene.id}
                      variant={sceneType === scene.id ? 'default' : 'secondary'}
                      className={`flex flex-col h-auto py-4 ${sceneType === scene.id ? 'bg-[#EF4444] text-black' : ''}`}
                      onClick={() => setSceneType(scene.id as SceneType)}
                    >
                      <span className="text-2xl mb-1">{scene.icon}</span>
                      <span>{scene.label}</span>
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button
                    className="bg-gradient-to-r from-red-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                    onClick={() => useQuickPrompt('basic')}
                  >
                    使用基础预设
                  </Button>
                  <Button
                    className="bg-gradient-to-r from-red-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
                    onClick={() => useQuickPrompt('advanced')}
                  >
                    使用进阶预设
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ★ 产品展示模式选择器（仅产品场景显示，支持多选组合） */}
          {sceneType === 'product' && (
            <Card className="border-[#EF4444]/30 bg-[#EF4444]/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#EF4444]" />
                  产品展示模式
                  <span className="text-xs font-normal text-foreground/70 ml-auto">可多选组合</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(productModeLabels) as [ProductDisplayMode, typeof productModeLabels[ProductDisplayMode]][]).map(([mode, info]) => {
                    const isSelected = productDisplayModes.includes(mode);
                    return (
                      <button
                        key={mode}
                        onClick={() => toggleProductDisplayMode(mode)}
                        className={`p-3 rounded-lg border text-left transition-all relative ${
                          isSelected
                            ? 'border-[#EF4444] bg-[#EF4444]/15 text-white'
                            : 'border-border bg-accent/30 text-muted-foreground hover:border-white/20 hover:text-foreground/80'
                        }`}
                      >
                        {isSelected && (
                          <CheckCircle2 className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-[#EF4444]" />
                        )}
                        <div className="font-medium text-sm pr-4">{info.label}</div>
                        <div className="text-xs opacity-60 mt-0.5">{info.desc}</div>
                      </button>
                    );
                  })}
                </div>
                {productDisplayModes.length > 1 && (
                  <div className="mt-2 px-3 py-1.5 rounded-md bg-[#EF4444]/10 border border-[#EF4444]/20">
                    <span className="text-xs text-[#EF4444] font-medium">当前组合：</span>
                    <span className="text-xs text-foreground/70">{getCombinedModeDescription()}</span>
                  </div>
                )}
                <div className="mt-2 text-xs text-foreground/70 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  可多选组合不同展示模式，智能补全会融合多种风格生成提示词
                </div>
              </CardContent>
            </Card>
          )}

          {/* 提示词生成表单 */}
          <Card className="border-border bg-accent/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#EF4444]" />
                自定义生成
              </CardTitle>
              <CardDescription>按权重顺序填写，核心主体 &gt; 连续动作 &gt; 镜头与运镜 &gt; 场景与光影 &gt; 风格与画质 &gt; 强制约束 &gt; 负面提示词</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 核心主体 */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[#EF4444] flex items-center gap-2">
                    <span className="w-6 h-6 bg-[#EF4444] text-black rounded-full flex items-center justify-center text-xs font-bold">1</span>
                    核心主体（必填）
                  </Label>
                  <Textarea
                    placeholder={getSubjectPlaceholder(sceneType)}
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    className="h-24 bg-black/30 border-border"
                  />
                  <p className="text-xs text-muted-foreground">输入核心主体后，点击下方"AI补全"自动生成其他字段</p>
                </div>

                {/* 视频时长 — 预设按钮 + 手动输入 */}
                <div className="space-y-2">
                  <Label className="text-foreground/90 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#EF4444]" />
                    视频时长
                    <span className="text-xs font-normal text-foreground/30">(支持自定义)</span>
                  </Label>
                  
                  {/* 快捷预设按钮 */}
                  <div className="flex flex-wrap gap-1.5">
                    {[3, 5, 10, 15, 30, 60].map((d) => (
                      <Button
                        key={d}
                        variant={videoDuration === d ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setVideoDuration(d)}
                        className={`text-xs px-2.5 py-1 h-7 ${
                          videoDuration === d 
                            ? 'bg-[#EF4444] text-black hover:bg-[#EF4444]/90' 
                            : 'border-white/20 text-foreground/70 hover:text-foreground hover:border-white/40'
                        }`}
                      >
                        {d}s
                      </Button>
                    ))}
                  </div>

                  {/* 自定义时长输入 */}
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      max={300}
                      value={videoDuration}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val <= 300) {
                          setVideoDuration(val);
                        }
                      }}
                      onBlur={(e) => {
                        // 离开时确保值在合法范围
                        const val = parseInt(e.target.value);
                        if (isNaN(val) || val < 1) setVideoDuration(5);
                        else if (val > 300) setVideoDuration(300);
                      }}
                      placeholder="输入秒数"
                      className="bg-black/30 border-border text-sm h-8 pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground/30">秒</span>
                  </div>

                  {/* 当前值提示 */}
                  {!([3, 5, 10, 15, 30, 60].includes(videoDuration)) && (
                    <p className="text-xs text-[#EF4444]/70 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      自定义时长：{videoDuration}秒
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">时长影响动作节奏和镜头数量，支持1-300秒</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 时序动作 */}
                <div className="space-y-2">
                  <Label className="text-[#EF4444]/90 flex items-center gap-2">
                    <span className="w-6 h-6 bg-[#EF4444]/80 text-black rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    时序动作
                  </Label>
                  <Textarea
                    placeholder={getActionPlaceholder(sceneType)}
                    value={actionsInput}
                    onChange={(e) => setActionsInput(e.target.value)}
                    className="h-24 bg-black/30 border-border"
                  />
                </div>

                {/* 镜头与运镜 */}
                <div className="space-y-2">
                  <Label className="text-[#EF4444]/80 flex items-center gap-2">
                    <span className="w-6 h-6 bg-[#EF4444]/60 text-black rounded-full flex items-center justify-center text-xs font-bold">3</span>
                    镜头与运镜
                  </Label>
                  <Textarea
                    placeholder="中景构图，平稳跟随运镜，展现女生完整舞蹈动作"
                    value={cameraMovementInput}
                    onChange={(e) => setCameraMovementInput(e.target.value)}
                    className="h-24 bg-black/30 border-border"
                  />
                  {/* ★ P2新增：产品场景下，根据选中的运镜推荐匹配的布光方案 */}
                  {sceneType === 'product' && cameraMovementInput.trim() && (() => {
                    const suggestion = getLightingSuggestionForCamera(cameraMovementInput);
                    if (!suggestion) return null;
                    return (
                      <div className="mt-1.5 p-2 rounded-md bg-[#EF4444]/8 border border-[#EF4444]/20">
                        <div className="flex items-start gap-2 text-xs">
                          <Lightbulb className="w-3.5 h-3.5 text-[#EF4444] mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-[#EF4444] font-medium">布光建议：</span>
                            <span className="text-foreground/70">{suggestion.name} — {suggestion.description}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const filled = suggestion.promptTemplate.replace('{product}', subjectInput || '产品');
                                setSceneLightInput(filled);
                              }}
                              className="ml-2 text-[#EF4444] hover:text-[#EF4444]/80 underline"
                            >
                              应用到「场景与光影」
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 场景与光影 */}
                <div className="space-y-2">
                  <Label className="text-[#EF4444]/70 flex items-center gap-2">
                    <span className="w-6 h-6 bg-[#EF4444]/50 text-black rounded-full flex items-center justify-center text-xs font-bold">4</span>
                    场景与光影
                  </Label>
                  <Textarea
                    placeholder="黄昏日落逆光，金色丁达尔光效，柔光铺满画面，明暗对比柔和"
                    value={sceneLightInput}
                    onChange={(e) => setSceneLightInput(e.target.value)}
                    className="h-24 bg-black/30 border-border"
                  />
                </div>

                {/* 风格 */}
                <div className="space-y-2">
                  <Label className="text-[#EF4444]/60 flex items-center gap-2">
                    <span className="w-6 h-6 bg-[#EF4444]/40 text-black rounded-full flex items-center justify-center text-xs font-bold">5</span>
                    风格与画质
                  </Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="复古胶片风格，色彩饱满，颗粒感明显"
                      value={styleInput}
                      onChange={(e) => setStyleInput(e.target.value)}
                      className="bg-black/30 border-border"
                    />
                    <Input
                      placeholder="4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊"
                      value={qualityInput}
                      onChange={(e) => setQualityInput(e.target.value)}
                      className="bg-black/30 border-border"
                    />
                  </div>
                </div>

                {/* 强制约束 */}
                <div className="space-y-2">
                  <Label className="text-[#EF4444]/50 flex items-center gap-2">
                    <span className="w-6 h-6 bg-[#EF4444]/30 text-black rounded-full flex items-center justify-center text-xs font-bold">6</span>
                    强制约束
                  </Label>
                  <Textarea
                    placeholder="面部清晰无畸变，五官比例自然，同一角色服装全程一致"
                    value={constraintsInput}
                    onChange={(e) => setConstraintsInput(e.target.value)}
                    className="h-24 bg-black/30 border-border"
                  />
                </div>
              </div>

              {/* 负面提示词 */}
              <div className="space-y-2">
                <Label className="text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  负面提示词
                </Label>
                <Input
                  placeholder="无变脸、无肢体畸形、无穿模、无跳帧"
                  value={negativeInput}
                  onChange={(e) => setNegativeInput(e.target.value)}
                  className="bg-red-950/30 border-red-500/20 text-red-200"
                />
              </div>

              {/* 操作按钮 */}
              <div className="space-y-3 pt-4">
                {/* 优化主体开关 */}
                <div className="flex items-center gap-3 p-3 bg-accent/30 rounded-lg border border-border">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enhanceSubject}
                      onChange={(e) => setEnhanceSubject(e.target.checked)}
                      className="w-4 h-4 rounded border-[#EF4444]/50 bg-black/30 text-[#EF4444] focus:ring-[#EF4444] focus:ring-offset-0"
                    />
                    <span className="text-sm text-foreground/80">同时优化核心主体内容</span>
                  </label>
                  <span className="text-xs text-muted-foreground">开启后将对主体描述进行专业扩展</span>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={clearAll}
                  >
                    清空
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleAutoComplete}
                    disabled={isAutoCompleting || !subjectInput.trim()}
                    className="border-[#EF4444]/50 text-[#EF4444] hover:bg-[#EF4444]/10"
                  >
                    {isAutoCompleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        AI补全中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI补全
                      </>
                    )}
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-[#EF4444] to-[#B4E22F] hover:opacity-90 text-black"
                    onClick={generatePrompt}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    生成提示词
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 生成结果 */}
          {generatedPrompt && (
            <Card id="prompt-result-card" className="border-[#EF4444]/30 bg-[#EF4444]/5">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Check className="w-5 h-5 text-[#EF4444]" />
                  生成结果
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-black/50 rounded-lg p-4 border border-border">
                  <p className="text-white whitespace-pre-wrap leading-relaxed">
                    {generatedPrompt}
                  </p>
                </div>
                {/* ★ v2.0 生成结果敏感度检测 */}
                {(() => {
                  const result = checkPromptSensitivity(generatedPrompt);
                  if (!result.isSensitive) return null;
                  const config = getRiskLevelConfig(result.riskLevel);
                  return (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs border ${config.bgColor} ${config.borderColor}`}>
                      <span className={`${config.color} font-bold`}>{config.icon}</span>
                      <span className={config.color}>提示词安全检测: {config.label}</span>
                      <span className="text-foreground/70">·</span>
                      <span className="text-muted-foreground">{result.detectedWords.length}个敏感词</span>
                      <span className="text-foreground/70">·</span>
                      <span className="text-foreground/70">风险分: {result.riskScore}</span>
                      {(result.riskLevel === 'high' || result.riskLevel === 'critical') && (
                        <button
                          onClick={() => {
                            const sanitized = sanitizePromptForMiniMax(generatedPrompt);
                            if (sanitized.isModified) {
                              setGeneratedPrompt(sanitized.sanitized);
                            }
                          }}
                          className="ml-auto text-[10px] px-2 py-0.5 rounded bg-accent/50 hover:bg-accent/70 text-foreground/70 transition-colors"
                        >
                          一键修复
                        </button>
                      )}
                    </div>
                  );
                })()}
                <Button
                  className="w-full bg-[#EF4444] hover:bg-[#EF4444]/90 text-black"
                  onClick={copyPrompt}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      复制提示词
                    </>
                  )}
                </Button>
                
                {/* 推荐背景音乐 */}
                {(recommendedBgm || isRecommendingBgm) && (
                  <div className="mt-4 p-4 bg-accent/30 rounded-lg border border-[#EF4444]/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Music className="w-4 h-4 text-[#EF4444]" />
                      <span className="text-sm font-medium text-white">推荐背景音乐</span>
                      {isRecommendingBgm && (
                        <Loader2 className="w-4 h-4 animate-spin text-[#EF4444]" />
                      )}
                    </div>
                    {recommendedBgm && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-[#EF4444]/20 text-[#EF4444] rounded text-sm font-medium">
                            {recommendedBgm.name}
                          </span>
                          <span className="text-xs text-muted-foreground">{recommendedBgm.description}</span>
                        </div>
                        {recommendedBgm.reason && (
                          <p className="text-xs text-muted-foreground">{recommendedBgm.reason}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 方法库 */}
        <TabsContent value="methods" className="space-y-6 mt-6">
          <Card className="border-border bg-accent/30">
            <CardHeader>
              <CardTitle className="text-white">提示词方法库</CardTitle>
              <CardDescription>基础必学 → 进阶提升 → 避坑技巧，新手直接套用，高阶创作者可灵活调整</CardDescription>
            </CardHeader>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-red-400" />
              基础必学（{sceneType === 'product' ? PRODUCT_BASIC_METHODS.length : BASIC_PROMPT_METHODS.length}个）
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(sceneType === 'product' ? PRODUCT_BASIC_METHODS : BASIC_PROMPT_METHODS).map(renderMethodCard)}
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-400" />
              进阶提升（{sceneType === 'product' ? PRODUCT_ADVANCED_METHODS.length : ADVANCED_PROMPT_METHODS.length}个）
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(sceneType === 'product' ? PRODUCT_ADVANCED_METHODS : ADVANCED_PROMPT_METHODS).map(renderMethodCard)}
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              避坑技巧（{sceneType === 'product' ? PRODUCT_PITFALL_METHODS.length : PITFALL_METHODS.length}个）
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(sceneType === 'product' ? PRODUCT_PITFALL_METHODS : PITFALL_METHODS).map(renderMethodCard)}
            </div>
          </div>
        </TabsContent>

        {/* 运镜库 */}
        <TabsContent value="camera" className="space-y-6 mt-6">
          <Card className="border-border bg-accent/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#EF4444]" />
                100个运镜方法库
              </CardTitle>
              <CardDescription>基础运镜 → 组合运镜 → 专业运镜 → 场景专属运镜，全场景覆盖，直接复制</CardDescription>
            </CardHeader>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full" />
              基础运镜（10个，小白必学，覆盖80%日常场景）
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {BASIC_CAMERA_MOVEMENTS.map(renderCameraMovementCard)}
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full" />
              组合运镜（20个，进阶款，拉满层次感）
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {COMBINATION_CAMERA_MOVEMENTS.map(renderCameraMovementCard)}
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full" />
              专业运镜（10个，电影级，质感翻倍）
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PROFESSIONAL_CAMERA_MOVEMENTS.map(renderCameraMovementCard)}
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full" />
              场景专属运镜（60个，按题材分类，直接套用）
            </h3>

            <Tabs defaultValue="portrait" className="w-full">
              <TabsList className="w-full grid grid-cols-4 bg-accent/30">
                <TabsTrigger value="portrait" className="data-[state=active]:bg-[#EF4444] data-[state=active]:text-black">
                  👤 人像（15个）
                </TabsTrigger>
                <TabsTrigger value="product" className="data-[state=active]:bg-[#EF4444] data-[state=active]:text-black">
                  📦 产品（15个）
                </TabsTrigger>
                <TabsTrigger value="landscape" className="data-[state=active]:bg-[#EF4444] data-[state=active]:text-black">
                  🏔️ 风景（15个）
                </TabsTrigger>
                <TabsTrigger value="drama" className="data-[state=active]:bg-[#EF4444] data-[state=active]:text-black">
                  🎬 剧情（15个）
                </TabsTrigger>
              </TabsList>

              {['portrait', 'product', 'landscape', 'drama'].map((category) => (
                <TabsContent key={category} value={category} className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SCENE_CAMERA_MOVEMENTS
                      .filter(m => m.sceneCategory === category)
                      .map(renderCameraMovementCard)}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
