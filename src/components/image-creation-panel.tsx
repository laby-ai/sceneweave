'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

import {
  ImageIcon, Sparkles, Star, Zap, Palette,
  Upload, Wand2, Download, Copy, Check,
  Send, Loader2, ImagePlus,
  Layers, Maximize,
  ArrowLeft, X,
  Paperclip, FileUp, Link2, Globe, PenLine, FileText,
  ChevronRight, FileDown,
  Eye, Binoculars, Aperture, Mountain, Camera, CircleDot,
  RefreshCw, ShieldCheck, Lightbulb, AlertTriangle,
  Pin, Ruler,
} from 'lucide-react';
import ImageAnnotationViewer, { type Annotation } from '@/components/image-annotation-viewer';
import DesignBlueprintOverlay, { type DesignDomain, type BlueprintType } from '@/components/design-blueprint-overlay';
import { downloadPlainTextAsPDF } from '@/lib/pdf-export';
import { formatProviderError, getBYOKRequestHeaders } from '@/lib/byok-client';
import {
  REMIX_STYLE_PRESETS,
  REMIX_CATEGORIES,
  ELEMENT_OPTIONS,
  suggestRemixStyle,
  detectDesignDomain,
  buildPreserveInstruction,
  type RemixStylePreset,
  type ElementKey,
} from '@/constants/remix-presets';

/** 根据设计还原预设ID解析蓝图类型和领域 */
function parseDesignPreset(presetId: string): { blueprintType: BlueprintType; domain: DesignDomain } {
  // 解析领域
  let domain: DesignDomain = 'clothing';
  if (presetId.startsWith('design_makeup')) domain = 'makeup';
  else if (presetId.startsWith('design_hair')) domain = 'hair';
  else if (presetId.startsWith('design_arch')) domain = 'architecture';

  // 解析蓝图类型
  let blueprintType: BlueprintType = 'craft';
  if (presetId.includes('_structure')) blueprintType = 'structure';
  else if (presetId.includes('_multiview')) blueprintType = 'multiview';

  return { blueprintType, domain };
}

// ========== 类型 ==========
interface ImageCreationPanelProps {
  onBack?: () => void;
  initialPrompt?: string;
  autoGenerate?: boolean;
  initialImageRefs?: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface GeneratedImage {
  id: string;
  prompt: string;
  enhancedPrompt?: string;
  url: string;
  model: string;
  style: string;
  size: string;
  createdAt: number;
  /** 二创保留验证失败的元素（如有） */
  preserveWarning?: string;
  /** 设计还原类型标签 */
  designLabel?: string;
}

// ========== 常量 ==========
const QUICK_IDEAS = [
  { label: '还原设计图纸', value: '将照片还原为设计图纸，保留所有结构和细节' },
  { label: '非遗元素标注', value: '标注非遗工艺细节，如妆面、刺绣、点翠等文化元素' },
  { label: '服饰纹样解析', value: '解析服饰上的传统纹样及其寓意' },
  { label: '色彩搭配方案', value: '基于传统五色体系给出配色建议' },
  { label: '结构拆解图', value: '将对象拆解为结构示意图，展示内部构造' },
  { label: '年代风格校验', value: '校验画面元素是否符合目标朝代特征' },
  { label: '工艺细节放大', value: '放大展示关键工艺细节并说明技法' },
  { label: '现代审美融合', value: '在保留传统元素基础上融入现代设计语言' },
] as const;

const IMAGE_MODELS = [
  { code: 'auto', name: '自动推荐', desc: 'AI根据场景自动选择最优模型', icon: Sparkles, color: 'text-cyan-400', borderColor: 'border-cyan-400/30', bgColor: 'bg-cyan-400/10' },
  { code: 'flux_pro', name: 'Flux Pro', desc: '顶级画质·细节丰富', icon: Star, color: 'text-blue-400', borderColor: 'border-blue-400/30', bgColor: 'bg-blue-400/10' },
  { code: 'sd_xl', name: 'SD XL', desc: '高性价比·快速出图', icon: Zap, color: 'text-sky-400', borderColor: 'border-sky-400/30', bgColor: 'bg-sky-400/10' },
  { code: 'midjourney_v7', name: 'MJ V7', desc: '艺术风格·创意出图', icon: Palette, color: 'text-violet-400', borderColor: 'border-violet-400/30', bgColor: 'bg-violet-400/10' },
] as const;

const STYLE_PRESETS = [
  { code: 'realistic', name: '真人写实', icon: '📷' },
  { code: 'anime', name: '二次元动漫', icon: '🎨' },
  { code: 'oil_painting', name: '油画风格', icon: '🖼️' },
  { code: 'watercolor', name: '水彩风格', icon: '💧' },
  { code: '3d_render', name: '3D渲染', icon: '🔮' },
  { code: 'pixel_art', name: '像素风格', icon: '👾' },
  { code: 'sketch', name: '素描线稿', icon: '✏️' },
  { code: 'cyberpunk', name: '赛博朋克', icon: '🌃' },
  { code: 'chinese_ink', name: '中国水墨', icon: '🏯' },
  { code: 'clay', name: '黏土风格', icon: '🧸' },
];

const COMPOSITION_PRESETS = [
  { code: 'panoramic', name: '场景全景', icon: '🌍', desc: '身临其境·环境氛围' },
  { code: 'medium', name: '中景叙事', icon: '🎬', desc: '环境+主体·故事感' },
  { code: 'closeup', name: '特写聚焦', icon: '🔍', desc: '人物/细节·近距离' },
  { code: 'aerial', name: '俯瞰视角', icon: '🦅', desc: '从高处向下俯视' },
  { code: 'lowangle', name: '仰视视角', icon: '⬆️', desc: '从低处向上仰视·气势感' },
  { code: 'fisheye', name: '鱼眼广角', icon: '🐟', desc: '超广角畸变·冲击力' },
  { code: 'auto', name: '自动推荐', icon: '✨', desc: 'AI根据场景自动选择' },
];

const SIZE_OPTIONS = [
  { code: '1:1', name: '1:1', desc: '正方形' },
  { code: '16:9', name: '16:9', desc: '横版' },
  { code: '9:16', name: '9:16', desc: '竖版' },
  { code: '4:3', name: '4:3', desc: '标准' },
  { code: '3:4', name: '3:4', desc: '竖向' },
  { code: '21:9', name: '21:9', desc: '超宽' },
];

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// ========== ConfigItem 子组件 ==========
function ConfigItem({
  icon,
  label,
  value,
  desc,
  selected,
  onClick,
  onMouseEnter: onMouseEnterProp,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  desc?: string;
  selected: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnterProp}
      className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all text-left ${
        selected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-accent/30 border border-transparent'
      }`}
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
        selected ? 'bg-primary/15 text-primary' : 'bg-accent/30 text-foreground/40'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-foreground/50">{label}</span>
        </div>
        <div className="text-[12px] font-medium text-foreground/90 truncate">{value}</div>
        {desc && !selected && <div className="text-[10px] text-foreground/30 truncate">{desc}</div>}
      </div>
      <ChevronRight className={`w-3.5 h-3.5 text-foreground/30 transition-transform flex-shrink-0 ${selected ? 'rotate-90' : ''}`} />
    </button>
  );
}

// ========== 组件 ==========
export function ImageCreationPanel({ onBack, initialPrompt, autoGenerate, initialImageRefs }: ImageCreationPanelProps) {
  // 左侧配置状态
  const [selectedModel, setSelectedModel] = useState('auto');
  const [selectedStyle, setSelectedStyle] = useState('realistic');
  const [selectedSize, setSelectedSize] = useState('1:1');
  const [selectedComposition, setSelectedComposition] = useState('panoramic');
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cfgScale, setCfgScale] = useState(7);
  const [steps, setSteps] = useState(30);
  const [batchSize, setBatchSize] = useState(1);

  // ConfigItem 展开状态
  const [cfgExpand, setCfgExpand] = useState<'model' | 'style' | 'size' | 'composition' | 'remix' | 'elements' | 'custom_req' | null>(null);

  // 二创风格状态
  const [selectedRemix, setSelectedRemix] = useState<RemixStylePreset | null>(null);
  const [remixCategory, setRemixCategory] = useState<RemixStylePreset['category']>('style_transfer');
  const [preservedElements, setPreservedElements] = useState<ElementKey[]>([]);
  const [showCopyright, setShowCopyright] = useState(false);
  const [customRequirement, setCustomRequirement] = useState('');
  const [analyzingRequirement, setAnalyzingRequirement] = useState(false);
  const [requirementAnalysis, setRequirementAnalysis] = useState<{
    matchedPreset: string;
    strategy: string;
    enhancedPrompt: string;
    preserveElements: ElementKey[];
    refStrategy: 'reference' | 'reinterpret' | 'none';
    styleDirection: string;
    approach: string;
    approachDescription: string;
    promptPrefix: string;
    promptSuffix: string;
    suggestedStyle: string;
    detailSuggestions: string[];
  } | null>(null);
  const [showRequirementPanel, setShowRequirementPanel] = useState(false);
  const [pasteToast, setPasteToast] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // 标注查看器
  const [annotateImage, setAnnotateImage] = useState<{ url: string; annotations: Annotation[] } | null>(null);
  const [blueprintImage, setBlueprintImage] = useState<{ url: string; style: string; blueprintType: 'craft' | 'structure' | 'multiview'; domain: 'clothing' | 'makeup' | 'hair' | 'architecture'; description?: string } | null>(null);

  // 参考素材/文档/链接
  const [imageRefs, setImageRefs] = useState<{ url: string; name: string; localPreview?: string; uploading?: boolean }[]>(() => {
    if (initialImageRefs && initialImageRefs.length > 0) {
      return initialImageRefs.map((url, i) => ({ url, name: `参考图片${i + 1}` }));
    }
    return [];
  });
  const [imageDocs, setImageDocs] = useState<{ name: string; url?: string; uploading?: boolean }[]>([]);
  const [imageLinks, setImageLinks] = useState<string[]>([]);
  const [imageLinkInput, setImageLinkInput] = useState('');
  const autoGenerateRef = useRef(false);
  const imgFileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  // 历史记录（localStorage 持久化）
  const HISTORY_KEY = 'dreambox-image-history';
  const [generatedHistory, setGeneratedHistory] = useState<GeneratedImage[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(generatedHistory)); } catch {}
  }, [generatedHistory]);

  const handleImgFileUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;
      const localPreview = URL.createObjectURL(file);
      const tempId = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setImageRefs(prev => [...prev, { url: '', name: file.name, localPreview, uploading: true }]);

      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload/material', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          setImageRefs(prev => prev.map(r =>
            r.localPreview === localPreview ? { ...r, url: data.url, uploading: false } : r
          ));
        } else {
          setImageRefs(prev => prev.map(r =>
            r.localPreview === localPreview ? { ...r, uploading: false } : r
          ));
        }
      } catch {
        setImageRefs(prev => prev.map(r =>
          r.localPreview === localPreview ? { ...r, uploading: false } : r
        ));
      }
    }
  }, []);

  const handleAnalyzeRequirement = useCallback(async (req?: string) => {
    const text = req ?? customRequirement;
    if (!text.trim()) return;
    if (req) setCustomRequirement(req);
    setAnalyzingRequirement(true);
    try {
      const res = await fetch('/api/remix/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: text.trim() }),
      });
      const data = await res.json();
      if (!data.error) {
        setRequirementAnalysis(data);
        // 自动应用推荐的保留元素
        if (data.preserveElements?.length) {
          setPreservedElements(data.preserveElements as ElementKey[]);
        }
        // ★ 根据AI推荐方案自动切换到标注/设计还原模式
        if (data.approach === '设计还原') {
          // 初始选择服装工艺图（handleGenerate中会根据图片内容自动修正领域）
          const designPreset = REMIX_STYLE_PRESETS.find(p => p.id === 'design_clothing_craft');
          if (designPreset) setSelectedRemix(designPreset);
        } else if (data.approach === '文化解读') {
          const annotatePreset = REMIX_STYLE_PRESETS.find(p => p.id === 'culture_annotate');
          if (annotatePreset) setSelectedRemix(annotatePreset);
        }
      }
    } catch {
      // 静默处理
    } finally {
      setAnalyzingRequirement(false);
    }
  }, [customRequirement]);

  const handleApplyRequirement = useCallback(() => {
    if (!requirementAnalysis) return;
    // ★ 根据推荐方案自动切换到标注/设计还原模式
    if (requirementAnalysis.approach === '设计还原') {
      // 初始选择服装工艺图（handleGenerate中会根据图片内容自动修正领域）
      const designPreset = REMIX_STYLE_PRESETS.find(p => p.id === 'design_clothing_craft');
      if (designPreset) setSelectedRemix(designPreset);
    } else if (requirementAnalysis.approach === '文化解读') {
      const annotatePreset = REMIX_STYLE_PRESETS.find(p => p.id === 'culture_annotate');
      if (annotatePreset) setSelectedRemix(annotatePreset);
    }
    // 将策略注入到提示词
    const parts: string[] = [];
    if (requirementAnalysis.promptPrefix) parts.push(requirementAnalysis.promptPrefix);
    if (requirementAnalysis.strategy) parts.push(requirementAnalysis.strategy);
    if (requirementAnalysis.promptSuffix) parts.push(requirementAnalysis.promptSuffix);
    if (parts.length > 0) {
      setPrompt(prev => prev ? `${prev}\n${parts.join('，')}` : parts.join('，'));
    }
    // 应用推荐风格预设
    if (requirementAnalysis.suggestedStyle) {
      const match = REMIX_STYLE_PRESETS.find(p => p.id === requirementAnalysis.suggestedStyle);
      if (match) setSelectedRemix(match);
    }
    setRequirementAnalysis(null);
    setCustomRequirement('');
    setShowRequirementPanel(false);
  }, [requirementAnalysis]);
/** 处理剪贴板粘贴图片 */
  const handlePasteImage = useCallback(async (e: React.ClipboardEvent | ClipboardEvent) => {
    const items = (e as React.ClipboardEvent).clipboardData?.items
      || (e as ClipboardEvent).clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      for (const file of imageFiles) {
        try {
          const localPreview = URL.createObjectURL(file);
          const tempId = `paste_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          setImageRefs(prev => [...prev, { url: '', name: file.name || '粘贴图片', localPreview, uploading: true }]);

          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/upload/material', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.success) {
            setImageRefs(prev => prev.map(r =>
              r.localPreview === localPreview ? { ...r, url: data.url, uploading: false } : r
            ));
            setPasteToast(`已添加${imageFiles.length > 1 ? ` ${imageFiles.length} 张` : ''}参考图片`);
          } else {
            setImageRefs(prev => prev.map(r =>
              r.localPreview === localPreview ? { ...r, uploading: false } : r
            ));
            setPasteToast('图片上传失败');
          }
        } catch {
          setPasteToast('图片上传失败');
        }
        setTimeout(() => setPasteToast(null), 2500);
      }
    }
  }, []);

  // 全局粘贴监听：面板内任意位置 Ctrl+V 均可粘贴图片
  useEffect(() => {
    const handler = (e: ClipboardEvent) => { handlePasteImage(e); };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [handlePasteImage]);

  // 中间输出状态
  const [outputTab, setOutputTab] = useState<'gallery' | 'history'>('gallery');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationPhase, setGenerationPhase] = useState('');
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 右侧对话状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是图片生成助手 🎨\n\n我可以帮你：\n• 优化提示词，提升生成质量\n• 推荐合适的风格和模型\n• 调整参数，精细控制效果\n\n告诉我你想创作什么样的图片？',
      timestamp: Date.now(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatStreaming, setChatStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // 生成图片（含提示词增强 + 历史记录）
  // 检测用户创作意图：是否为创意重诠释（二创/重绘/改编等）
  const detectCreativeIntent = (text: string): 'reinterpret' | 'reference' => {
    const t = text.toLowerCase();
    // 二创/重绘/改编/重新设计/改造/变换/重新诠释 → 创意重诠释，不传 subject_reference
    if (/二创|重绘|改编|重新设计|改造|变换|重新诠释|换个|变成|转换成|换成|变成|风格化|漫画化|动漫化|油画风|水彩风|像素风|赛博朋克|蒸汽波|低多边形|插画风|国风|水墨|二次元|卡通|涂鸦|波普|极简|超现实|梦幻|未来|复古|怀旧|赛博|蒸汽/.test(t)) return 'reinterpret';
    // 保持/一致/相同角色/同一个人/参照/模仿/还原 → 视觉参考，传 subject_reference
    if (/保持|一致|相同|同.*角色|同.*人|参照|模仿|还原|一样|不变|保留.*风格/.test(t)) return 'reference';
    // 默认：有参考图时作为创意参考（不强制视觉一致性）
    return 'reinterpret';
  };

  /**
   * 二创保留元素验证：用AI对比原图和生成图，检查保留元素是否一致
   */
  const verifyPreservedElements = async (
    generatedImageUrl: string,
    referenceImageUrl: string,
    elements: ElementKey[]
  ): Promise<{ allPreserved: boolean; failedElements: string[] } | null> => {
    try {
      const labels: Record<ElementKey, string> = {
        character: '角色外貌与服饰',
        scene: '场景与背景环境',
        composition: '画面构图与视角',
        atmosphere: '光影氛围与情绪',
        color: '主色调与配色方案',
      };
      const elementList = elements.map(k => labels[k]).join('、');

      const res = await fetch('/api/image/understand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: generatedImageUrl,
          referenceImageUrl,
          prompt: `对比这两张图片，判断右侧生成图片是否成功保留了左侧原图中的以下元素：${elementList}。对每项给出"保留"或"未保留"的判断。请用JSON格式回复：{"character":"保留/未保留","scene":"保留/未保留","composition":"保留/未保留","atmosphere":"保留/未保留","color":"保留/未保留"}`,
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (!data.success || !data.description) return null;

      // 解析AI返回的验证结果
      const desc = data.description as string;
      const jsonMatch = desc.match(/\{[^}]+\}/);
      if (!jsonMatch) return null;

      const result = JSON.parse(jsonMatch[0]);
      const failedElements: string[] = [];
      for (const key of elements) {
        const value = result[key];
        if (value && value.includes('未保留')) {
          failedElements.push(labels[key]);
        }
      }

      return {
        allPreserved: failedElements.length === 0,
        failedElements,
      };
    } catch {
      return null;
    }
  };

  const handleGenerate = useCallback(async (promptOverride?: string) => {
    const effectivePrompt = (promptOverride || prompt).trim();
    if (!effectivePrompt) return;
    setIsGenerating(true);
    setGenerationProgress(5);

    // 检测创作意图
    const creativeIntent = selectedRemix
      ? selectedRemix.refStrategy
      : detectCreativeIntent(effectivePrompt);
    console.log('[ImageCreationPanel] creativeIntent:', creativeIntent, 'hasRefImages:', imageRefs.length > 0, 'remix:', selectedRemix?.id);

    // 如果有参考图片，先理解图片内容（在构建提示词之前）
    const hasRefImages = imageRefs.length > 0 && imageRefs.some(r => r.url);
    let imageDescription = '';
    if (hasRefImages) {
      setGenerationPhase('正在理解参考图片...');
      try {
        const refImageUrl = imageRefs.find(r => r.url)?.url;
        if (refImageUrl) {
          const understandRes = await fetch('/api/image/understand', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: refImageUrl,
              question: creativeIntent === 'reinterpret' 
                ? `请描述这张图片的核心主体、场景和氛围，以便在此基础上进行创意重诠释（二创）。用户想要：${effectivePrompt}。请重点描述可以保留的辨识性元素和可以创新变化的部分。`
                : selectedRemix?.category === 'design_restore'
                ? `请详细描述这张图片中所有可见的设计元素：主体形态、材质纹理、色彩方案、结构层次、工艺细节、装饰纹样。用户希望将其还原为设计图：${effectivePrompt}。请特别关注可以转化为设计图纸的元素特征。`
                : `请简要描述这张图片的核心内容、风格和关键视觉元素，以便结合文字描述进行AI创作。用户想要基于此图片创作：${effectivePrompt}`,
            }),
          });
          if (understandRes.ok) {
            const understandData = await understandRes.json();
            if (understandData.success && understandData.description) {
              imageDescription = understandData.description;
            }
          }
        }
      } catch { /* 图片理解失败不阻断 */ }
    }

    // ===== 图片理解后：如果当前预设是design_restore，根据图片内容重新检测领域 =====
    let activeRemix = selectedRemix;
    if (selectedRemix?.category === 'design_restore' && imageDescription) {
      const detectedDomain = detectDesignDomain(imageDescription, effectivePrompt);
      const currentDomain = parseDesignPreset(selectedRemix.id).domain;
      if (detectedDomain !== currentDomain) {
        const blueprintType = parseDesignPreset(selectedRemix.id).blueprintType;
        // 尝试匹配目标领域的同类型预设，不存在则降级
        const tryOrder: string[] = [
          `design_${detectedDomain}_${blueprintType}`,   // 同类型（如multiview）
          `design_${detectedDomain}_structure`,           // 降级到结构图
          `design_${detectedDomain}_craft`,               // 再降级到工艺图
        ];
        let newPreset: RemixStylePreset | undefined;
        for (const pid of tryOrder) {
          newPreset = REMIX_STYLE_PRESETS.find(p => p.id === pid);
          if (newPreset) break;
        }
        if (newPreset) {
          console.log(`[handleGenerate] 设计还原领域自动修正: ${currentDomain} → ${detectedDomain}, 预设: ${selectedRemix.id} → ${newPreset.id}`);
          setSelectedRemix(newPreset);
          setPreservedElements(newPreset.preserveDefaults);
          setSelectedStyle(newPreset.recommendedStyle);
          activeRemix = newPreset;
        }
      }
    }

    // 构建二创增强提示词（在图片理解之后，以便嵌入视觉描述）
    let remixPrompt = effectivePrompt;
    if (activeRemix) {
      const preserveInstruction = buildPreserveInstruction(preservedElements);
      // 设计还原：将图片视觉描述嵌入提示词开头，确保模型知道原始主体长什么样
      if (activeRemix.category === 'design_restore' && imageDescription) {
        remixPrompt = `[REFERENCE IMAGE DESCRIPTION: ${imageDescription}]\n\n${activeRemix.promptPrefix} ${effectivePrompt} ${activeRemix.promptSuffix}`;
      } else {
        remixPrompt = `${activeRemix.promptPrefix} ${effectivePrompt} ${activeRemix.promptSuffix}`;
      }
      if (preserveInstruction) {
        remixPrompt = `${preserveInstruction}\n${remixPrompt}`;
      }
    }

    setGenerationProgress(20);
    setGenerationPhase('正在优化提示词...');

    let enhancedPromptText = '';
    // 先调用提示词增强
    try {
      // 根据提示词内容推断sceneType
      const inferSceneType = (text: string): string => {
        const t = text.toLowerCase();
        if (/风景|城市|街景|建筑|夜景|天空|海|山|森林|公园|日落|日出|星空/.test(t)) return 'landscape';
        if (/产品|商品|包装|瓶子|手机|电脑|耳机|鞋子|手表|化妆品/.test(t)) return 'product';
        if (/美食|食物|蛋糕|饮品|水果|甜点|咖啡|料理/.test(t)) return 'food';
        if (/室内|房间|客厅|卧室|厨房|办公室|装修/.test(t)) return 'interior';
        if (/古风|仙侠|国风|武侠|玄幻|修仙|仙界|灵界|天宫|诛仙|飞升|仙人|仙女|仙人|道人|法师|神仙|穿越|古装|汉服|仙裙|宫殿|仙境|灵山|云海/.test(t)) return 'drama';
        if (/剧情|故事|对话|场景|战斗|冒险|二创|重绘|改编|同人是|同人/.test(t)) return 'drama';
        if (/人物|女孩|男孩|男人|女人|老人|小孩|肖像|头像|角色/.test(t)) return 'portrait';
        return 'portrait'; // 默认portrait而非abstract，更贴近参考图场景
      };

      // 如果有图片描述，将其作为参考信息一并传递
      const enhanceText = imageDescription
        ? `【参考图片内容】${imageDescription}\n【创作需求】${remixPrompt}`
        : remixPrompt;

      const enhanceRes = await fetch('/api/prompt/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: enhanceText, sceneType: inferSceneType(effectivePrompt), composition: selectedComposition, creativeIntent, preserveElements: activeRemix ? preservedElements : undefined }),
      });
      if (enhanceRes.ok) {
        const enhanceData = await enhanceRes.json();
        if (enhanceData.success && enhanceData.enhancedText) {
          enhancedPromptText = enhanceData.enhancedText;
        }
      }
    } catch {
      // 增强失败不阻断生成
    }

    // 设计还原时：确保最终提示词包含参考图描述（增强API可能丢失描述）
    // 同时追加强保留约束
    const isDesignRestore = activeRemix?.category === 'design_restore';
    let finalPrompt = enhancedPromptText || remixPrompt;
    if (isDesignRestore && imageDescription && !finalPrompt.includes(imageDescription.slice(0, 50))) {
      finalPrompt = `[REFERENCE IMAGE DESCRIPTION: ${imageDescription}]\n\n${finalPrompt}`;
    }
    // 设计还原的负面提示词：禁止偏离原始主体 + 禁止文字乱码
    const designRestoreNeg = isDesignRestore
      ? 'completely different subject, unrelated object, different shape, different proportions, blurry, deformed, low quality, watermark, text, letters, characters, writing, callout labels, watermark text, signatures, gibberish text'
      : '';
    const effectiveNegPrompt = [negativePrompt.trim(), designRestoreNeg].filter(Boolean).join(', ') || undefined;
    setGenerationProgress(40);
    setGenerationPhase('正在生成图片...');

    try {
      const genBody: Record<string, unknown> = {
        prompt: finalPrompt,
        negativePrompt: effectiveNegPrompt,
        model: selectedModel,
        style: selectedStyle,
        size: selectedSize,
        cfgScale,
        steps,
        batchSize,
        n: batchSize,
        referenceImages: imageRefs.map(r => r.url).filter(Boolean),
        referenceDocs: imageDocs.map(d => d.name),
        referenceLinks: imageLinks,
      };
      // 无论创作意图，始终传递参考图片给生成模型
      // - reference：保持视觉一致性
      // - reinterpret：模型能看到参考图，通过提示词引导创意重诠释
      // 不传参考图 = 模型完全看不到原图 = 结果与参考图无关
      const refImgUrls = imageRefs.map(r => r.url).filter(Boolean);
      if (refImgUrls.length > 0) {
        genBody.image = refImgUrls[0];
        genBody.materials = refImgUrls;
      }
      console.log('[ImageCreationPanel] 生成参数: intent=', creativeIntent, 'image=', refImgUrls.length > 0 ? 'provided' : 'none');

      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
        body: JSON.stringify(genBody),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(formatProviderError(data, '生成失败'));
      setGenerationProgress(80);
      setGenerationPhase('图片生成完成，正在加载...');
      if (data.success) {
        const urls: string[] = data.imageUrls || (data.images || []).map((img: { url: string } | string) =>
          typeof img === 'string' ? img : img.url
        ).filter(Boolean);
        if (urls.length > 0) {
          // ★ 二创保留元素验证：当有保留约束时，用AI检查生成结果
          if (activeRemix && preservedElements.length > 0 && imageRefs.length > 0) {
            setGenerationPhase('正在验证保留元素...');
            setGenerationProgress(85);
            try {
              const verifyResult = await verifyPreservedElements(
                urls[0],
                imageRefs[0].url,
                preservedElements
              );
              if (verifyResult && !verifyResult.allPreserved) {
                console.log('[ImageCreationPanel] 保留元素验证未通过:', verifyResult.failedElements);
                // 将验证结果附加到图片信息中
                const newImages: GeneratedImage[] = urls.map((url: string, i: number) => ({
                  id: genId() + i,
                  prompt: effectivePrompt,
                  enhancedPrompt: enhancedPromptText || undefined,
                  url,
                  model: selectedModel,
                  style: selectedStyle,
                  size: selectedSize,
                  createdAt: Date.now(),
                  preserveWarning: `${verifyResult.failedElements.join('、')} 未完全保留`,
                }));
                setGeneratedImages(prev => [...newImages, ...prev]);
                setGeneratedHistory(prev => [...newImages, ...prev].slice(0, 100));
                setOutputTab('gallery');
                setGenerationProgress(100);
                setGenerationPhase('生成完成（部分保留元素未完全保留）');
                return;
              }
            } catch {
              // 验证失败不阻断流程
              console.log('[ImageCreationPanel] 保留元素验证异常，跳过');
            }
          }
          const newImages: GeneratedImage[] = urls.map((url: string, i: number) => ({
            id: genId() + i,
            prompt: effectivePrompt,
            enhancedPrompt: enhancedPromptText || undefined,
            url,
            model: selectedModel,
            style: selectedStyle,
            size: selectedSize,
            createdAt: Date.now(),
            designLabel: activeRemix?.category === 'design_restore' ? activeRemix.name : undefined,
          }));
          setGeneratedImages(prev => [...newImages, ...prev]);
          setGeneratedHistory(prev => [...newImages, ...prev].slice(0, 100)); // 最多保留100条
          setOutputTab('gallery');
          setGenerationProgress(100);

          // 设计还原模式：生成完成后自动打开设计图纸叠加
          if (activeRemix?.category === 'design_restore' && urls.length > 0) {
            const { blueprintType, domain } = parseDesignPreset(activeRemix.id);
            setBlueprintImage({
              url: urls[0],
              style: activeRemix.id,
              blueprintType,
              domain,
              description: activeRemix.name,
            });
          }
        }
      }
    } catch (error) {
      console.error('图像生成失败:', error);
      const errMsg = error instanceof Error ? error.message : '图像生成失败，请重试';
      const failImage: GeneratedImage = {
        id: genId(),
        prompt: `${effectivePrompt} (生成失败: ${errMsg})`,
        url: '',
        model: selectedModel,
        style: selectedStyle,
        size: selectedSize,
        createdAt: Date.now(),
      };
      setGeneratedImages(prev => [failImage, ...prev]);
      setGeneratedHistory(prev => [failImage, ...prev].slice(0, 100));
      setOutputTab('gallery');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
      setGenerationPhase('');
    }
  }, [prompt, negativePrompt, selectedModel, selectedStyle, selectedSize, cfgScale, steps, batchSize, imageRefs, imageDocs, imageLinks, selectedComposition]);

  // 追踪组件卸载原因
  const mountIdRef = useRef(Math.random().toString(36).slice(2, 6));
  useEffect(() => {
    console.log('[ImageCreationPanel] 挂载, id:', mountIdRef.current);
    return () => {
      console.log('[ImageCreationPanel] 卸载, id:', mountIdRef.current);
    };
  }, []);

  // 组件挂载/卸载追踪（解决 StrictMode 双重挂载问题）
  useEffect(() => {
    isMountedRef.current = true;
    console.log('[ImageCreationPanel] 组件挂载, autoGenerate:', autoGenerate);
    return () => {
      isMountedRef.current = false;
      console.log('[ImageCreationPanel] 组件卸载');
    };
  }, []);

  // 自动生成：当从控制台跳转过来时自动触发
  // 直接在 useEffect 内调用 API，避免 useCallback 闭包陈旧问题
  const autoGenTriggered = useRef(false);
  useEffect(() => {
    if (!autoGenerate || autoGenTriggered.current) return;
    autoGenTriggered.current = true;
    autoGenerateRef.current = true;

    const effectivePrompt = (initialPrompt || '').trim() || '一幅唯美的数字艺术作品，色彩丰富，构图精美';
    // 获取初始参考图片URL（来自粘贴的图片）
    const refImageUrls = initialImageRefs && initialImageRefs.length > 0 ? initialImageRefs : [];
    // 检测创作意图（自动检测：如果提示词匹配二创关键词，自动选择对应预设）
    const autoRemix = suggestRemixStyle(effectivePrompt);
    const creativeIntent = autoRemix ? autoRemix.refStrategy : detectCreativeIntent(effectivePrompt);
    const isDesignRestore = autoRemix?.category === 'design_restore' || selectedRemix?.category === 'design_restore';
    console.log('[ImageCreationPanel] autoGenerate开始, prompt:', effectivePrompt, 'imageRefs:', refImageUrls.length, 'intent:', creativeIntent, 'isDesignRestore:', isDesignRestore, 'autoRemix:', autoRemix?.id);
    setPrompt(effectivePrompt);
    if (autoRemix) {
      setSelectedRemix(autoRemix);
      setPreservedElements(autoRemix.preserveDefaults);
      setSelectedStyle(autoRemix.recommendedStyle);
    }

    // 先检测创作意图（后续在图片理解后构建提示词）
    let remixPrompt = effectivePrompt;

    // 直接调用生成 API，不依赖 handleGenerate 的闭包
    // 注意：React StrictMode 会触发 cleanup（cancelled=true）但随后重新挂载（isMountedRef=true）
    // 所以用 isMountedRef 判断是否真正卸载，cancelled 仅作日志标记
    let cancelled = false;
    (async () => {
      setIsGenerating(true);
      setGenerationProgress(5);

      try {
        // ===== 阶段1：如果有参考图片，先用图片理解API分析图片内容 =====
        let imageDescription = '';
        if (refImageUrls.length > 0) {
          setGenerationPhase('正在理解参考图片...');
          try {
            const understandRes = await fetch('/api/image/understand', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageUrl: refImageUrls[0],
                question: creativeIntent === 'reinterpret' 
                  ? `请描述这张图片的核心主体、场景和氛围，以便在此基础上进行创意重诠释（二创）。用户想要：${effectivePrompt}。请重点描述可以保留的辨识性元素和可以创新变化的部分。`
                  : isDesignRestore
                  ? `请详细描述这张图片中所有可见的设计元素：主体形态、材质纹理、色彩方案、结构层次、工艺细节、装饰纹样。用户希望将其还原为设计图：${effectivePrompt}。请特别关注可以转化为设计图纸的元素特征。`
                  : `请简要描述这张图片的核心内容、风格和关键视觉元素，以便结合文字描述进行AI创作。用户想要基于此图片创作：${effectivePrompt}`,
              }),
            });
            if (understandRes.ok) {
              const understandData = await understandRes.json();
              if (understandData.success && understandData.description) {
                imageDescription = understandData.description;
                console.log('[ImageCreationPanel] 图片理解成功, descLen:', imageDescription.length);
              }
            }
          } catch (e) {
            console.warn('[ImageCreationPanel] 图片理解失败，继续生成:', e);
          }
        }

        // ===== 图片理解后：如果当前预设是design_restore，根据图片内容重新检测领域 =====
        if (autoRemix?.category === 'design_restore' && imageDescription) {
          const detectedDomain = detectDesignDomain(imageDescription, effectivePrompt);
          const currentDomain = parseDesignPreset(autoRemix.id).domain;
          if (detectedDomain !== currentDomain) {
            const blueprintType = parseDesignPreset(autoRemix.id).blueprintType;
            // 尝试匹配目标领域的同类型预设，不存在则降级
            const tryOrder: string[] = [
              `design_${detectedDomain}_${blueprintType}`,
              `design_${detectedDomain}_structure`,
              `design_${detectedDomain}_craft`,
            ];
            let newPreset: RemixStylePreset | undefined;
            for (const pid of tryOrder) {
              newPreset = REMIX_STYLE_PRESETS.find(p => p.id === pid);
              if (newPreset) break;
            }
            if (newPreset) {
              console.log(`[ImageCreationPanel] 设计还原领域自动修正: ${currentDomain} → ${detectedDomain}, 预设: ${autoRemix.id} → ${newPreset.id}`);
              Object.assign(autoRemix, newPreset);
              setSelectedRemix(newPreset);
              setPreservedElements(newPreset.preserveDefaults);
              setSelectedStyle(newPreset.recommendedStyle);
            }
          }
        }

        // ===== 构建二创增强提示词（在图片理解之后） =====
        if (autoRemix) {
          const preserveInstruction = buildPreserveInstruction(autoRemix.preserveDefaults);
          // 设计还原：将图片视觉描述嵌入提示词开头
          if (autoRemix.category === 'design_restore' && imageDescription) {
            remixPrompt = `[REFERENCE IMAGE DESCRIPTION: ${imageDescription}]\n\n${autoRemix.promptPrefix} ${effectivePrompt} ${autoRemix.promptSuffix}`;
          } else {
            remixPrompt = `${autoRemix.promptPrefix} ${effectivePrompt} ${autoRemix.promptSuffix}`;
          }
          if (preserveInstruction) {
            remixPrompt = `${preserveInstruction}\n${remixPrompt}`;
          }
        }

        // ===== 阶段2：提示词增强（结合图片描述+文字提示词） =====
        setGenerationProgress(20);
        setGenerationPhase('正在优化提示词...');
        let enhancedPromptText = '';
        try {
          const t = effectivePrompt.toLowerCase();
          let sceneType = 'portrait';
          if (/风景|城市|街景|建筑|夜景|天空|海|山|森林|公园|日落|日出|星空/.test(t)) sceneType = 'landscape';
          else if (/产品|商品|包装|瓶子|手机|电脑|耳机|鞋子|手表|化妆品/.test(t)) sceneType = 'product';
          else if (/美食|食物|蛋糕|饮品|水果|甜点|咖啡|料理/.test(t)) sceneType = 'food';
          else if (/室内|房间|客厅|卧室|厨房|办公室|装修/.test(t)) sceneType = 'interior';
          else if (/古风|仙侠|国风|武侠|玄幻|修仙|仙界|灵界|天宫|诛仙|飞升|仙人|仙女|道人|法师|神仙|穿越|古装|汉服|仙裙|宫殿|仙境|灵山|云海/.test(t)) sceneType = 'drama';
          else if (/剧情|故事|对话|场景|战斗|冒险|二创|重绘|改编|同人/.test(t)) sceneType = 'drama';
          else if (/人物|女孩|男孩|男人|女人|老人|小孩|肖像|头像|角色/.test(t)) sceneType = 'portrait';

          // 如果有图片描述，将其作为参考信息一并传递给增强API
          const designRestoreInstruction = isDesignRestore
            ? `\n【设计还原要求】请将参考图片还原为专业设计图/工艺图纸。必须保留原图的核心形态轮廓、比例关系和关键视觉特征。输出应为：精确的线条稿+材质标注+工艺说明+色彩方案，类似专业设计图纸或文化遗产复原文档的呈现方式。`
            : '';
          const enhanceText = imageDescription
            ? `【参考图片内容】${imageDescription}${designRestoreInstruction}\n【创作需求】${remixPrompt}`
            : `${designRestoreInstruction}${remixPrompt}`;

          const enhanceRes = await fetch('/api/prompt/enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: enhanceText, sceneType, composition: selectedComposition, creativeIntent, preserveElements: autoRemix ? autoRemix.preserveDefaults : undefined }),
          });
          if (enhanceRes.ok) {
            const enhanceData = await enhanceRes.json();
            if (enhanceData.success && enhanceData.enhancedText) enhancedPromptText = enhanceData.enhancedText;
            console.log('[ImageCreationPanel] 增强结果: success=', enhanceData.success, 'enhancedLen=', enhanceData.enhancedText?.length);
          } else {
            console.warn('[ImageCreationPanel] 增强API返回非200:', enhanceRes.status);
          }
        } catch (e) { console.warn('[ImageCreationPanel] 提示词增强失败:', e); /* 增强失败不阻断 */ }

        // 设计还原时：确保最终提示词包含参考图描述（增强API可能丢失描述）
        let finalPrompt = enhancedPromptText || remixPrompt;
        if (isDesignRestore && imageDescription && !finalPrompt.includes(imageDescription.slice(0, 50))) {
          finalPrompt = `[REFERENCE IMAGE DESCRIPTION: ${imageDescription}]\n\n${finalPrompt}`;
        }
        // 设计还原的负面提示词：禁止偏离原始主体 + 禁止文字乱码
        const designRestoreNeg = isDesignRestore
          ? 'completely different subject, unrelated object, different shape, different proportions, blurry, deformed, low quality, watermark, text, letters, characters, writing, callout labels, watermark text, signatures, gibberish text'
          : '';
        const effectiveNegPrompt = [negativePrompt.trim(), designRestoreNeg].filter(Boolean).join(', ') || undefined;
        if (cancelled) { console.log('[ImageCreationPanel] 增强后cancelled(StrictMode), 继续执行'); }
        setGenerationProgress(40);
        setGenerationPhase('正在生成图片...');
        console.log('[ImageCreationPanel] 开始调用image/generate, prompt:', finalPrompt.slice(0, 50));

        // ===== 阶段3：生成图片（携带参考图片） =====
        const genBody: Record<string, unknown> = {
          prompt: finalPrompt,
          negativePrompt: effectiveNegPrompt,
          model: selectedModel,
          style: selectedStyle,
          size: selectedSize,
          cfgScale, steps, batchSize,
          n: batchSize,
        };
        // 传递参考图片给生成API
        // 重要：无论创作意图是reference还是reinterpret，都传参考图给生成模型
        // - reference：保持视觉一致性（风格/角色/场景）
        // - reinterpret：模型能看到参考图，但通过提示词指令引导创意重诠释
        // 如果不传参考图，模型完全看不到原图，只能靠文字猜测，结果与参考图无关
        if (refImageUrls.length > 0) {
          genBody.image = refImageUrls[0];       // 角色参考图（subjectReference）
          genBody.materials = refImageUrls;       // 素材列表
          genBody.referenceImages = refImageUrls; // 参考图片
        }
        console.log('[ImageCreationPanel] 生成参数: intent=', creativeIntent, 'image=', refImageUrls.length > 0 ? 'provided' : 'none');

        const response = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
          body: JSON.stringify(genBody),
        });
        if (cancelled) { console.log('[ImageCreationPanel] 生成请求后StrictMode卸载, 继续处理结果'); }
        console.log('[ImageCreationPanel] image/generate响应:', response.status, response.ok);
        const data = await response.json();
        if (!response.ok) throw new Error(formatProviderError(data, '生成失败'));
        if (data.success) {
          const urls: string[] = data.imageUrls || (data.images || []).map((img: { url: string } | string) =>
            typeof img === 'string' ? img : img.url
          ).filter(Boolean);
          if (urls.length > 0) {
            const newImages: GeneratedImage[] = urls.map((url: string, i: number) => ({
              id: genId() + i,
              prompt: effectivePrompt,
              enhancedPrompt: enhancedPromptText || undefined,
              url,
              model: selectedModel,
              style: selectedStyle,
              size: selectedSize,
              createdAt: Date.now(),
              designLabel: isDesignRestore ? (autoRemix?.name || selectedRemix?.name) : undefined,
            }));
            setGenerationProgress(90);
            setGenerationPhase('正在加载图片...');
            console.log('[ImageCreationPanel] 生成成功, urls:', urls, 'newImages:', newImages.length, 'isDesignRestore:', isDesignRestore);
            setGeneratedImages(prev => [...newImages, ...prev]);
            setGeneratedHistory(prev => [...newImages, ...prev].slice(0, 100));
            setOutputTab('gallery');
          } else {
            console.warn('[ImageCreationPanel] 生成成功但无图片URL, data:', JSON.stringify(data).slice(0, 200));
          }
        } else {
          console.warn('[ImageCreationPanel] 生成返回失败, data:', JSON.stringify(data).slice(0, 200));
        }
      } catch (error) {
        if (cancelled) { console.log('[ImageCreationPanel] catch中StrictMode卸载, 继续记录错误'); }
        console.error('[ImageCreationPanel] 自动生成失败:', error);
        const errMsg = error instanceof Error ? error.message : '图像生成失败，请重试';
        const failImage: GeneratedImage = {
          id: genId(),
          prompt: `${effectivePrompt} (生成失败: ${errMsg})`,
          url: '',
          model: selectedModel,
          style: selectedStyle,
          size: selectedSize,
          createdAt: Date.now(),
        };
        setGeneratedImages(prev => [failImage, ...prev]);
        setGeneratedHistory(prev => [failImage, ...prev].slice(0, 100));
        setOutputTab('gallery');
      } finally {
        // 始终重置生成状态（StrictMode 双重挂载场景下也需重置）
        if (isMountedRef.current) {
          setGenerationProgress(100);
          setGenerationPhase('生成完成');
          setTimeout(() => {
            if (isMountedRef.current) {
              setIsGenerating(false);
              setGenerationProgress(0);
              setGenerationPhase('');
            }
          }, 800);
        }
      }
    })();

    return () => { cancelled = true; };
  // 仅在 mount 时执行一次，initialPrompt / selectedModel 等从初始 props 读取
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 发送聊天消息
  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || chatStreaming) return;
    const userMsg: ChatMessage = { id: genId(), role: 'user', content: chatInput.trim(), timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatStreaming(true);

    try {
      // 如果有参考图片，优先使用图片理解API分析
      const hasRefImages = imageRefs.length > 0 && imageRefs.some(r => r.url);
      if (hasRefImages) {
        const refImageUrl = imageRefs.find(r => r.url)?.url;
        if (refImageUrl) {
          const understandRes = await fetch('/api/image/understand', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: refImageUrl,
              question: chatInput.trim(),
            }),
          });
          const understandData = understandRes.ok ? await understandRes.json() : null;
          if (understandData?.success && understandData.description) {
            const aiMsg: ChatMessage = { id: genId(), role: 'assistant', content: understandData.description, timestamp: Date.now() };
            setChatMessages(prev => [...prev, aiMsg]);
            setChatStreaming(false);
            return;
          }
        }
      }

      // 默认：提示词增强
      const response = await fetch('/api/prompt/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chatInput.trim(), sceneType: 'abstract', composition: selectedComposition }),
      });

      const data = response.ok ? await response.json() : null;
      const aiContent = data?.enhancedPrompt || `针对「${chatInput.trim()}」的建议：\n\n1. 建议使用具体描述替代抽象概念\n2. 添加光照和氛围描述（如"金色日落"）\n3. 指定画面构图（如"特写"）\n4. 可尝试 ${STYLE_PRESETS.find(s => s.code === selectedStyle)?.name || '写实'} 风格获得更好效果`;

      const aiMsg: ChatMessage = { id: genId(), role: 'assistant', content: aiContent, timestamp: Date.now() };
      setChatMessages(prev => [...prev, aiMsg]);
    } catch {
      const aiMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: '抱歉，我暂时无法处理请求。请稍后再试。',
        timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, aiMsg]);
    } finally {
      setChatStreaming(false);
    }
  }, [chatInput, chatStreaming, selectedStyle, imageRefs]);

  // 复制提示词
  const handleCopyPrompt = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#05070d]">
      {/* 顶部标题栏 */}
      <div className="flex-shrink-0 flex items-center px-5 py-2.5 border-b border-white/10 bg-[#080b12]">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors mr-3"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <ImageIcon className="w-5 h-5 text-[#70E0FF] mr-2.5" />
        <h1 className="text-lg font-semibold text-foreground">图片生成</h1>
        {/* 二创模式指示器 */}
        {selectedRemix && (
          <span className="ml-3 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-[#4F6CFF] to-[#70E0FF] text-white">
            <RefreshCw className="w-3 h-3" />
            {selectedRemix.name}
          </span>
        )}
        {/* 版权声明按钮 */}
        {selectedRemix && (
          <button
            onClick={() => setShowCopyright(!showCopyright)}
            className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] text-foreground/40 hover:text-foreground/60 hover:bg-accent/30 transition-all"
            title="二创版权声明"
          >
            <ShieldCheck className="w-3 h-3" />
            版权须知
          </button>
        )}
        {generatedImages.length > 0 && (
          <button
            onClick={() => {
              const content = generatedImages.map((img, i) =>
                `图片${i + 1}: ${img.prompt || '无提示词'}`
              ).join('\n\n');
              downloadPlainTextAsPDF(`图片生成_${new Date().toLocaleDateString('zh-CN')}.pdf`, content, '图片生成 - 生成记录');
            }}
            className="ml-auto p-2 rounded-lg hover:bg-accent/50 transition-colors text-foreground/50 hover:text-[#70E0FF]"
            title="导出PDF"
          >
            <FileDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 三栏主体 */}
      <div className="flex-1 min-h-0 flex">
        {/* ===== 左侧：参数配置面板 ===== */}
        <div className="w-[280px] flex-shrink-0 border-r border-border flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-2.5">

            {/* ===== 模型 ===== */}
            <ConfigItem
              icon={<Wand2 className="w-4 h-4" />}
              label="模型"
              value={IMAGE_MODELS.find(m => m.code === selectedModel)?.name || selectedModel}
              desc="选择生成模型"
              selected={cfgExpand === 'model'}
              onClick={() => setCfgExpand(cfgExpand === 'model' ? null : 'model')}
              onMouseEnter={() => setCfgExpand('model')}
            />
            {cfgExpand === 'model' && (
              <div className="ml-4 pl-3 border-l-2 border-primary/20 space-y-0.5 max-h-48 overflow-y-auto">
                {IMAGE_MODELS.map(m => (
                  <button
                    key={m.code}
                    onClick={() => { setSelectedModel(m.code); setCfgExpand(null); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[11px] flex items-center gap-2 transition-all ${
                      selectedModel === m.code ? 'bg-primary/15 text-primary font-medium' : 'text-foreground/60 hover:bg-accent/30'
                    }`}
                  >
                    <span className="flex-1">{m.name}</span>
                    {selectedModel === m.code && <Check className="w-3 h-3 text-primary" />}
                  </button>
                ))}
              </div>
            )}

            {/* ===== 风格 ===== */}
            <ConfigItem
              icon={<Palette className="w-4 h-4" />}
              label="风格"
              value={STYLE_PRESETS.find(s => s.code === selectedStyle)?.name || selectedStyle}
              desc="画面风格"
              selected={cfgExpand === 'style'}
              onClick={() => setCfgExpand(cfgExpand === 'style' ? null : 'style')}
              onMouseEnter={() => setCfgExpand('style')}
            />
            {cfgExpand === 'style' && (
              <div className="ml-4 pl-3 border-l-2 border-primary/20 space-y-0.5 max-h-48 overflow-y-auto">
                {STYLE_PRESETS.map(s => (
                  <button
                    key={s.code}
                    onClick={() => { setSelectedStyle(s.code); setCfgExpand(null); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[11px] flex items-center gap-2 transition-all ${
                      selectedStyle === s.code ? 'bg-primary/15 text-primary font-medium' : 'text-foreground/60 hover:bg-accent/30'
                    }`}
                  >
                    <span className="flex-1">{s.name}</span>
                    {selectedStyle === s.code && <Check className="w-3 h-3 text-primary" />}
                  </button>
                ))}
              </div>
            )}

            {/* ===== 视角 ===== */}
            <ConfigItem
              icon={<Eye className="w-4 h-4" />}
              label="视角"
              value={COMPOSITION_PRESETS.find(c => c.code === selectedComposition)?.name || selectedComposition}
              desc="画面视角与构图"
              selected={cfgExpand === 'composition'}
              onClick={() => setCfgExpand(cfgExpand === 'composition' ? null : 'composition')}
              onMouseEnter={() => setCfgExpand('composition')}
            />
            {cfgExpand === 'composition' && (
              <div className="ml-4 pl-3 border-l-2 border-primary/20 space-y-0.5 max-h-48 overflow-y-auto">
                {COMPOSITION_PRESETS.map(c => (
                  <button
                    key={c.code}
                    onClick={() => { setSelectedComposition(c.code); setCfgExpand(null); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[11px] flex items-center gap-2 transition-all ${
                      selectedComposition === c.code ? 'bg-primary/15 text-primary font-medium' : 'text-foreground/60 hover:bg-accent/30'
                    }`}
                  >
                    <span className="flex-1">{c.name}</span>
                    {selectedComposition === c.code && <Check className="w-3 h-3 text-primary" />}
                  </button>
                ))}
              </div>
            )}

            {/* ===== 尺寸 ===== */}
            <ConfigItem
              icon={<Maximize className="w-4 h-4" />}
              label="尺寸"
              value={SIZE_OPTIONS.find(s => s.code === selectedSize)?.name || selectedSize}
              desc="图片尺寸"
              selected={cfgExpand === 'size'}
              onClick={() => setCfgExpand(cfgExpand === 'size' ? null : 'size')}
              onMouseEnter={() => setCfgExpand('size')}
            />
            {cfgExpand === 'size' && (
              <div className="ml-4 pl-3 border-l-2 border-primary/20 space-y-0.5 max-h-48 overflow-y-auto">
                {SIZE_OPTIONS.map(s => (
                  <button
                    key={s.code}
                    onClick={() => { setSelectedSize(s.code); setCfgExpand(null); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[11px] flex items-center gap-2 transition-all ${
                      selectedSize === s.code ? 'bg-primary/15 text-primary font-medium' : 'text-foreground/60 hover:bg-accent/30'
                    }`}
                  >
                    <span className="flex-1">{s.name}</span>
                    <span className="text-foreground/30 text-[10px]">{s.desc}</span>
                    {selectedSize === s.code && <Check className="w-3 h-3 text-primary" />}
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-border/30" />

            {/* ===== 二创风格 ===== */}
            <ConfigItem
              icon={<RefreshCw className="w-4 h-4" />}
              label="二创风格"
              value={selectedRemix ? `${selectedRemix.icon} ${selectedRemix.name}` : '选择二创方向'}
              desc={selectedRemix?.desc || '风格迁移/场景重构/设计还原'}
              selected={cfgExpand === 'remix'}
              onClick={() => setCfgExpand(cfgExpand === 'remix' ? null : 'remix')}
              onMouseEnter={() => setCfgExpand('remix')}
            />
            {cfgExpand === 'remix' && (
              <div className="ml-4 pl-3 border-l-2 border-primary/20 space-y-2 max-h-[400px] overflow-y-auto">
                {/* 分类 Tab */}
                <div className="flex flex-wrap gap-1 sticky top-0 bg-card pb-1">
                  {REMIX_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setRemixCategory(cat.id)}
                      className={`px-2 py-1 rounded-md text-[10px] transition-all ${
                        remixCategory === cat.id
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'text-foreground/50 hover:bg-accent/30'
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
                {/* 风格列表 */}
                {REMIX_STYLE_PRESETS.filter(p => p.category === remixCategory).map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedRemix(selectedRemix?.id === preset.id ? null : preset);
                      if (selectedRemix?.id !== preset.id) {
                        setPreservedElements(preset.preserveDefaults);
                        setSelectedStyle(preset.recommendedStyle);
                      }
                      setCfgExpand(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[11px] flex items-center gap-2 transition-all ${
                      selectedRemix?.id === preset.id ? 'bg-primary/15 text-primary font-medium ring-1 ring-primary/20' : 'text-foreground/60 hover:bg-accent/30'
                    }`}
                  >
                    <span className="text-base">{preset.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{preset.name}</div>
                      <div className="text-[10px] text-foreground/40 truncate">{preset.desc}</div>
                    </div>
                    {selectedRemix?.id === preset.id && <Check className="w-3 h-3 text-primary flex-shrink-0" />}
                  </button>
                ))}
                {/* 清除选择 */}
                {selectedRemix && (
                  <button
                    onClick={() => { setSelectedRemix(null); setPreservedElements([]); }}
                    className="w-full text-center px-3 py-1.5 rounded-lg text-[10px] text-foreground/40 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                  >
                    清除二创风格
                  </button>
                )}
              </div>
            )}

            {/* ===== 元素保留（二创模式下显示）===== */}
            {selectedRemix && (
              <>
                <ConfigItem
                  icon={<ShieldCheck className="w-4 h-4" />}
                  label="保留元素"
                  value={preservedElements.length > 0 ? preservedElements.map(k => ELEMENT_OPTIONS.find(e => e.key === k)?.label).join('/') : '自由二创'}
                  desc="选择需要保留的原始元素"
                  selected={cfgExpand === 'elements'}
                  onClick={() => setCfgExpand(cfgExpand === 'elements' ? null : 'elements')}
                  onMouseEnter={() => setCfgExpand('elements')}
                />
                {cfgExpand === 'elements' && (
                  <div className="ml-4 pl-3 border-l-2 border-primary/20 space-y-1">
                    {ELEMENT_OPTIONS.map(opt => {
                      const isActive = preservedElements.includes(opt.key);
                      return (
                        <button
                          key={opt.key}
                          onClick={() => {
                            setPreservedElements(prev =>
                              isActive ? prev.filter(k => k !== opt.key) : [...prev, opt.key]
                            );
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-[11px] flex items-center gap-2 transition-all ${
                            isActive ? 'bg-primary/15 text-primary font-medium' : 'text-foreground/60 hover:bg-accent/30'
                          }`}
                        >
                          <span className="text-base">{opt.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{opt.label}</div>
                            <div className="text-[10px] text-foreground/40">{opt.desc}</div>
                          </div>
                          {isActive && <Check className="w-3 h-3 text-primary flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ===== 自定义二创思路（二创模式或上传参考图时显示）===== */}
            {(selectedRemix || imageRefs.length > 0) && (
              <ConfigItem
                icon={<Sparkles className="w-4 h-4" />}
                label="自定义思路"
                value={customRequirement ? '已设定' : '可选'}
                desc="输入创作要求，AI推荐方案（含标注/还原）"
                selected={cfgExpand === 'custom_req'}
                onClick={() => setCfgExpand(cfgExpand === 'custom_req' ? null : 'custom_req')}
                onMouseEnter={() => setCfgExpand('custom_req')}
              />
            )}
            {cfgExpand === 'custom_req' && (selectedRemix || imageRefs.length > 0) && (
              <div className="ml-4 pl-3 border-l-2 border-primary/20 space-y-2">
                <textarea
                  value={customRequirement}
                  onChange={e => setCustomRequirement(e.target.value)}
                  placeholder="描述你的二创要求，如：保留旗袍纹样但改为水墨画风格、增加现代配饰、色调更暖..."
                  className="w-full px-3 py-2 bg-background/80 border border-border/50 rounded-lg text-[11px] text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                  rows={3}
                />
                {/* 快捷建议标签 */}
                <div className="flex flex-wrap gap-1">
                  {QUICK_IDEAS.map(s => (
                    <button
                      key={s.label}
                      onClick={() => {
                        setCustomRequirement(prev => prev ? prev + '、' + s.value : s.value);
                        handleAnalyzeRequirement(s.value);
                      }}
                      className="px-2 py-0.5 bg-accent/50 hover:bg-primary/10 text-[10px] text-foreground/60 hover:text-primary rounded-full transition-all border border-transparent hover:border-primary/20"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {/* AI分析按钮 */}
                {customRequirement.trim() && (
                  <button
                    onClick={() => handleAnalyzeRequirement(customRequirement)}
                    disabled={analyzingRequirement}
                    className="w-full py-1.5 bg-primary/10 hover:bg-primary/20 text-[11px] text-primary font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {analyzingRequirement ? (
                      <>
                        <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        AI分析中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        AI推荐二创方案
                      </>
                    )}
                  </button>
                )}
                {/* AI分析结果 */}
                {requirementAnalysis && (
                  <div className="bg-primary/5 border border-primary/10 rounded-lg p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-primary" />
                      <span className="text-[11px] text-primary font-medium">AI推荐方案</span>
                    </div>
                    {/* 推荐风格 */}
                    {requirementAnalysis.suggestedStyle && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-foreground/50">推荐风格</span>
                        <button
                          onClick={() => {
                            const match = REMIX_STYLE_PRESETS.find(p => p.id === requirementAnalysis.suggestedStyle);
                            if (match) setSelectedRemix(match);
                          }}
                          className="block w-full text-left px-2 py-1.5 bg-primary/10 border border-primary/15 rounded-lg text-[11px]"
                        >
                          <span className="text-primary font-medium">
                            {REMIX_STYLE_PRESETS.find(p => p.id === requirementAnalysis.suggestedStyle)?.name || requirementAnalysis.suggestedStyle}
                          </span>
                          {requirementAnalysis.strategy === 'reference' && (
                            <span className="text-foreground/50 ml-1">— 高保真还原</span>
                          )}
                          {requirementAnalysis.strategy === 'reinterpret' && (
                            <span className="text-foreground/50 ml-1">— 创意重诠释</span>
                          )}
                        </button>
                      </div>
                    )}
                    {/* 创作方式 */}
                    {requirementAnalysis.approach && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-foreground/50">创作方式</span>
                        <div className="px-2 py-1 bg-accent/30 rounded text-[10px] text-foreground/70">
                          <span className="text-primary font-medium">{requirementAnalysis.approach}</span>
                          {requirementAnalysis.approachDescription && (
                            <span className="ml-1">— {requirementAnalysis.approachDescription}</span>
                          )}
                        </div>
                        {/* 标注/还原模式提示 */}
                        {(requirementAnalysis.approach === '设计还原' || requirementAnalysis.approach === '文化解读') && (
                          <div className="px-2 py-1 bg-primary/10 border border-primary/15 rounded text-[10px] text-primary">
                            {requirementAnalysis.approach === '设计还原'
                              ? '已自动切换到「设计还原」模式 — 生成图将保留原图结构与细节，可通过标注工具添加尺寸标注'
                              : '已自动切换到「文化解读」模式 — 标注将自动识别图片中的文化元素，不改变原图'}
                          </div>
                        )}
                      </div>
                    )}
                    {/* 保留元素建议 */}
                    {requirementAnalysis.preserveElements && requirementAnalysis.preserveElements.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-foreground/50">建议保留</span>
                        <div className="flex flex-wrap gap-1">
                          {requirementAnalysis.preserveElements.map(k => {
                            const el = ELEMENT_OPTIONS.find(e => e.key === k);
                            return el ? (
                              <span key={k} className="px-1.5 py-0.5 bg-green-500/10 text-green-600 text-[10px] rounded-full">{el.icon} {el.label}</span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                    {/* 增强提示词 */}
                    {requirementAnalysis.enhancedPrompt && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-foreground/50">增强提示词</span>
                        <div className="px-2 py-1.5 bg-background/80 border border-border/30 rounded text-[10px] text-foreground/70 leading-relaxed">
                          {requirementAnalysis.enhancedPrompt}
                        </div>
                        <button
                          onClick={() => setPrompt(requirementAnalysis.enhancedPrompt!)}
                          className="text-[10px] text-primary hover:underline"
                        >
                          应用此提示词 →
                        </button>
                      </div>
                    )}
                    {/* 创作策略 */}
                    {requirementAnalysis.strategy && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-foreground/50">创作策略</span>
                        <div className="text-[10px] text-foreground/60 leading-relaxed">{requirementAnalysis.strategy}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ===== 二创填写指引 ===== */}
            {selectedRemix && selectedRemix.category !== 'annotate_only' && selectedRemix.category !== 'design_restore' && (
              <div className="mx-1 px-3 py-2 bg-primary/5 border border-primary/10 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <Lightbulb className="w-3.5 h-3.5 text-primary/60" />
                  <span className="text-[11px] text-primary/70 font-medium">二创提示词填写指引</span>
                </div>
                <div className="text-[10px] text-foreground/50 leading-relaxed space-y-0.5">
                  <p>1. <span className="text-foreground/70">描述画面主体</span> — 人物/物体/场景的基本构成</p>
                  <p>2. <span className="text-foreground/70">风格和保留指令自动注入</span> — 无需重复写风格关键词</p>
                  <p>3. <span className="text-foreground/70">可添加特殊要求</span> — 如特定细节、情绪、时间等</p>
                </div>
                <div className="mt-1.5 px-2 py-1 bg-card/50 rounded text-[10px] text-foreground/40">
                  示例：<span className="text-foreground/60">{selectedRemix.promptHint}</span>
                </div>
              </div>
            )}
            {/* ===== 设计还原指引 ===== */}
            {selectedRemix?.category === 'design_restore' && (
              <div className="mx-1 px-3 py-2 bg-primary/5 border border-primary/10 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <Wand2 className="w-3.5 h-3.5 text-primary/60" />
                  <span className="text-[11px] text-primary/70 font-medium">{selectedRemix.name}模式</span>
                </div>
                <div className="text-[10px] text-foreground/50 leading-relaxed space-y-0.5">
                  <p>1. <span className="text-foreground/70">上传素材照片</span> — 作为设计还原的参考原型</p>
                  <p>2. <span className="text-foreground/70">描述还原方向</span> — 如&quot;传统仕女妆面&quot;&quot;宋代瓷器纹样&quot;</p>
                  <p>3. <span className="text-foreground/70">AI自动解析</span> — 理解素材视觉特征并生成设计图</p>
                  <p>4. <span className="text-foreground/70">保留核心特征</span> — 形态轮廓和核心元素自动保留</p>
                </div>
                <div className="mt-1.5 px-2 py-1 bg-card/50 rounded text-[10px] text-foreground/40">
                  示例：<span className="text-foreground/60">{selectedRemix.promptHint}</span>
                </div>
              </div>
            )}
            {/* ===== 仅标注模式指引 ===== */}
            {selectedRemix?.category === 'annotate_only' && (
              <div className="mx-1 px-3 py-2 bg-primary/5 border border-primary/10 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <Pin className="w-3.5 h-3.5 text-primary/60" />
                  <span className="text-[11px] text-primary/70 font-medium">{selectedRemix.name}模式</span>
                </div>
                <div className="text-[10px] text-foreground/50 leading-relaxed space-y-0.5">
                  <p>1. <span className="text-foreground/70">上传或粘贴参考图片</span> — 需要标注的原始图片</p>
                  <p>2. <span className="text-foreground/70">点击「开始标注」</span> — 打开标注查看器</p>
                  <p>3. <span className="text-foreground/70">AI自动识别文化元素</span> — 标注非遗妆面/服饰纹样/工艺等</p>
                  <p>4. <span className="text-foreground/70">深度解析</span> — 放大细节/结构解析/年代考证/设计变体</p>
                </div>
                <div className="mt-1.5 px-2 py-1 bg-card/50 rounded text-[10px] text-foreground/40">
                  {selectedRemix.desc}
                </div>
              </div>
            )}

            <div className="border-t border-border/30" />

            {/* ===== 参考素材（支持上传）===== */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 px-1">
                <Paperclip className="w-3.5 h-3.5 text-foreground/40" />
                <span className="text-[11px] text-foreground/50 font-medium">参考素材</span>
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] text-foreground/40 border border-dashed border-border/60 rounded-lg cursor-pointer hover:border-primary/30 hover:text-primary/60 transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  <span>上传图片/视频</span>
                  <input
                    ref={imgFileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        handleImgFileUpload(files);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
                {imageRefs.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {imageRefs.map((ref, idx) => {
                      const imgSrc = ref.localPreview || ref.url;
                      return (
                        <div
                          key={idx}
                          className="group relative aspect-square rounded-lg overflow-hidden border border-border/70 cursor-pointer hover:border-primary/40 transition-all"
                          onClick={() => {
                            if (imgSrc) setPreviewImage({ url: imgSrc, name: ref.name });
                          }}
                        >
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={ref.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <div className="w-full h-full bg-accent/30 flex items-center justify-center">
                              {ref.uploading ? (
                                <Loader2 className="w-5 h-5 text-foreground/30 animate-spin" />
                              ) : (
                                <ImageIcon className="w-5 h-5 text-foreground/30" />
                              )}
                            </div>
                          )}
                          {/* 上传中遮罩 */}
                          {ref.uploading && imgSrc && (
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                              <Loader2 className="w-5 h-5 text-primary animate-spin" />
                            </div>
                          )}
                          {/* 删除按钮 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setImageRefs(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:border-red-500"
                          >
                            <X className="w-3 h-3 text-foreground/60 hover:text-white" />
                          </button>
                          {/* 文件名 */}
                          <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-gradient-to-t from-black/60 to-transparent">
                            <span className="text-[9px] text-white/90 truncate block">{ref.name}</span>
                          </div>
                          {/* 查看图标 */}
                          {!ref.uploading && imgSrc && (
                            <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-background/80 border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye className="w-3 h-3 text-foreground/60" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ===== 上传文档 ===== */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 px-1">
                <FileUp className="w-3.5 h-3.5 text-foreground/40" />
                <span className="text-[11px] text-foreground/50 font-medium">上传文档</span>
                <span className="text-[9px] text-foreground/25">作为参考说明</span>
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] text-foreground/40 border border-dashed border-border/60 rounded-lg cursor-pointer hover:border-primary/30 hover:text-primary/60 transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  <span>上传文档</span>
                  <span className="text-[9px] text-foreground/25">.txt .md .pdf</span>
                  <input
                    type="file"
                    accept=".txt,.md,.pdf,.docx,.doc"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      for (const file of files) {
                        const tempId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                        setImageDocs(prev => [...prev, { name: file.name, uploading: true }]);
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          const res = await fetch('/api/upload/material', { method: 'POST', body: formData });
                          const data = await res.json();
                          if (data.success) {
                            setImageDocs(prev => prev.map(d =>
                              d.name === file.name && d.uploading ? { ...d, url: data.url, uploading: false } : d
                            ));
                          } else {
                            setImageDocs(prev => prev.map(d =>
                              d.name === file.name && d.uploading ? { ...d, uploading: false } : d
                            ));
                          }
                        } catch {
                          setImageDocs(prev => prev.map(d =>
                            d.name === file.name && d.uploading ? { ...d, uploading: false } : d
                          ));
                        }
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
                {imageDocs.length > 0 && (
                  <div className="space-y-1">
                    {imageDocs.map((doc, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 bg-accent/10 border border-border/70 rounded-lg text-[11px]">
                        {doc.uploading ? <Loader2 className="w-3.5 h-3.5 text-foreground/40 flex-shrink-0 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-foreground/40 flex-shrink-0" />}
                        <span className="flex-1 text-foreground/70 truncate">{doc.name}</span>
                        <button onClick={() => setImageDocs(prev => prev.filter((_, i) => i !== idx))} className="text-foreground/30 hover:text-red-400 flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ===== 参考链接 ===== */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 px-1">
                <Link2 className="w-3.5 h-3.5 text-foreground/40" />
                <span className="text-[11px] text-foreground/50 font-medium">参考链接</span>
                <span className="text-[9px] text-foreground/25">AI将读取</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <input
                    value={imageLinkInput}
                    onChange={(e) => setImageLinkInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (imageLinkInput.trim()) { setImageLinks(prev => [...prev, imageLinkInput.trim()]); setImageLinkInput(''); } } }}
                    placeholder="粘贴链接，回车添加"
                    className="flex-1 text-[11px] bg-accent/10 border border-border rounded-md px-2.5 py-1.5 text-foreground/80 outline-none placeholder:text-foreground/25 focus:border-primary/30"
                  />
                  <button
                    onClick={() => { if (imageLinkInput.trim()) { setImageLinks(prev => [...prev, imageLinkInput.trim()]); setImageLinkInput(''); } }}
                    disabled={!imageLinkInput.trim()}
                    className="px-2.5 py-1.5 text-[11px] text-primary bg-primary/10 rounded-md hover:bg-primary/20 disabled:opacity-30 transition-all"
                  >
                    添加
                  </button>
                </div>
                {imageLinks.length > 0 && (
                  <div className="space-y-1">
                    {imageLinks.map((link, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 bg-accent/10 border border-border/70 rounded-lg text-[11px]">
                        <Globe className="w-3 h-3 text-foreground/40 flex-shrink-0" />
                        <span className="flex-1 text-foreground/70 truncate">{link}</span>
                        <button onClick={() => setImageLinks(prev => prev.filter((_, i) => i !== idx))} className="text-foreground/30 hover:text-red-400 flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border/30" />

            {/* ===== 提示词 ===== */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 px-1">
                <PenLine className="w-3.5 h-3.5 text-foreground/40" />
                <span className="text-[11px] text-foreground/50 font-medium">提示词</span>
                {selectedRemix && (
                  <span className="text-[9px] text-primary/70 font-normal">二创模式 — 只需描述画面主体</span>
                )}
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  selectedRemix?.category === 'annotate_only'
                    ? '（可选）输入描述帮助AI更精准地标注文化元素...'
                    : selectedRemix
                      ? `描述你想呈现的画面主体，例如：${selectedRemix.promptHint || '一个站在山顶的侠客，衣袂飘飘'}`
                      : '描述你想生成的图片，也可直接粘贴图片…'
                }
                className="w-full text-xs bg-accent/10 border border-border rounded-lg px-3 py-2 text-foreground/80 outline-none resize-none min-h-[72px] max-h-[120px] placeholder:text-foreground/25 focus:border-primary/30 focus:ring-1 focus:ring-primary/10"
                rows={3}
              />
              {/* 二创模式下显示提示词合成预览（仅标注模式除外） */}
              {selectedRemix && selectedRemix.category !== 'annotate_only' && prompt.trim() && (
                <div className="mt-1 px-2 py-1.5 bg-primary/5 border border-primary/10 rounded-lg">
                  <div className="flex items-center gap-1 mb-1">
                    <Wand2 className="w-3 h-3 text-primary/60" />
                    <span className="text-[10px] text-primary/60 font-medium">实际生成提示词预览</span>
                  </div>
                  <p className="text-[10px] text-foreground/50 leading-relaxed break-all">
                    <span className="text-primary/70 font-medium">{selectedRemix.promptPrefix}</span>
                    {' '}
                    <span className="text-foreground/80">{prompt.trim()}</span>
                    {' '}
                    <span className="text-blue-400/70 font-medium">{selectedRemix.promptSuffix}</span>
                  </p>
                </div>
              )}
              {/* 粘贴图片提示 */}
              <div className="flex items-center gap-1 px-1 mt-0.5">
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/40 text-[10px] text-muted-foreground/60 cursor-default" title="支持 Ctrl+V 粘贴图片">
                  <ImagePlus className="w-3 h-3" />
                  <span>可粘贴图片</span>
                </div>
                {selectedRemix && selectedRemix.category !== 'annotate_only' && !prompt.trim() && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-600 dark:text-amber-400">
                    <Lightbulb className="w-3 h-3" />
                    <span>描述主体即可，风格和保留指令会自动注入</span>
                  </div>
                )}
                {selectedRemix?.category === 'annotate_only' && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] text-primary/80">
                    <Pin className="w-3 h-3" />
                    <span>无需生成新图，点击「开始标注」直接在原图上标注文化元素</span>
                  </div>
                )}
              </div>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="反向提示词（排除的元素）..."
                className="w-full text-xs bg-accent/10 border border-border rounded-lg px-3 py-2 text-foreground/80 outline-none resize-none min-h-[48px] max-h-[80px] placeholder:text-foreground/25 focus:border-primary/30 mt-1.5"
                rows={2}
              />
              <div className="mt-3">
                <div className="text-[10px] text-foreground/40 mb-1">生成数量</div>
                <div className="flex gap-1">{[1, 2, 3, 4].map(n => (
                  <button key={n} onClick={() => setBatchSize(n)} className={`flex-1 text-[11px] py-1 rounded transition-all ${batchSize === n ? 'bg-primary/10 text-primary' : 'text-foreground/50 hover:bg-accent/20'}`}>{n} 张</button>
                ))}</div>
              </div>
            </div>

          </div>

          {/* 底部生成按钮 */}
          <div className="px-3 py-2 border-t border-border/50">
            <button
              onClick={() => {
                // 二创仅标注模式：直接打开标注查看器，不生成新图
                if (selectedRemix?.category === 'annotate_only') {
                  const lastRef = imageRefs.length > 0 ? imageRefs[imageRefs.length - 1] : null;
                  const refUrl = lastRef?.localPreview || lastRef?.url || null;
                  const lastGen = generatedImages.length > 0 ? generatedImages[0].url : null;
                  const targetUrl = refUrl || lastGen;
                  if (targetUrl) {
                    setAnnotateImage({ url: targetUrl, annotations: [] });
                  }
                  return;
                }
                // 设计还原模式：先判断是否有参考图，有则直接打开设计图纸叠加
                if (selectedRemix?.category === 'design_restore' && !prompt.trim()) {
                  const lastRef = imageRefs.length > 0 ? imageRefs[imageRefs.length - 1] : null;
                  const refUrl = lastRef?.localPreview || lastRef?.url || null;
                  const lastGen = generatedImages.length > 0 ? generatedImages[0].url : null;
                  const targetUrl = refUrl || lastGen;
                  if (targetUrl) {
                    const { blueprintType, domain } = parseDesignPreset(selectedRemix.id);
                    setBlueprintImage({ url: targetUrl, style: selectedRemix.id, blueprintType, domain });
                    return;
                  }
                }
                handleGenerate();
              }}
              disabled={selectedRemix?.category === 'annotate_only' ? (!imageRefs.length && !generatedImages.length) : (!prompt.trim() || isGenerating)}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/80 disabled:opacity-40 disabled:bg-gray-600 transition-all"
            >
              {selectedRemix?.category === 'annotate_only' ? (
                <>
                  <Pin className="w-4 h-4" />
                  开始标注
                </>
              ) : selectedRemix?.category === 'design_restore' ? (
                isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    还原中...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    生成设计图
                  </>
                )
              ) : isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  生成图片
                </>
              )}
            </button>
            {/* 粘贴图片提示 Toast */}
            {pasteToast && (
              <div className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-[11px] text-primary font-medium animate-in fade-in slide-in-from-bottom-1 duration-200">
                <ImagePlus className="w-3.5 h-3.5" />
                {pasteToast}
              </div>
            )}
          </div>
        </div>

                {/* ===== 中间：内容输出区 ===== */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Tab 栏 */}
          <div className="flex-shrink-0 flex items-center gap-4 px-5 py-2.5 border-b border-border">
            <button
              onClick={() => setOutputTab('gallery')}
              className={`text-sm font-medium pb-0.5 border-b-2 transition-colors ${
                outputTab === 'gallery'
                  ? 'text-[#70E0FF] border-[#70E0FF]'
                  : 'text-foreground/70 border-transparent hover:text-muted-foreground'
              }`}
            >
              生成结果
            </button>
            <button
              onClick={() => setOutputTab('history')}
              className={`text-sm font-medium pb-0.5 border-b-2 transition-colors ${
                outputTab === 'history'
                  ? 'text-[#70E0FF] border-[#70E0FF]'
                  : 'text-foreground/70 border-transparent hover:text-muted-foreground'
              }`}
            >
              历史记录
            </button>
            {generatedImages.length > 0 && (
              <span className="text-xs text-foreground/30 ml-auto">
                共 {generatedImages.length} 张
              </span>
            )}
          </div>

          {/* 生成进度条 */}
          {isGenerating && (
            <div className="px-5 py-2 bg-primary/5 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                <span className="text-[11px] text-primary/80 font-medium">{generationPhase || '正在生成图片...'}</span>
              </div>
              <div className="mt-1.5 h-1 bg-accent/30 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${generationProgress}%` }} />
              </div>
            </div>
          )}

          {/* 内容区 */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-5">
            {outputTab === 'gallery' && (
              <>
                {/* 优化提示词信息 */}
                {generatedImages.length > 0 && generatedImages[generatedImages.length - 1]?.enhancedPrompt && (
                  <div className="mb-4 p-3 rounded-xl bg-accent/20 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-medium text-primary">优化提示词</span>
                      </div>
                      <button
                        onClick={() => {
                          const ep = generatedImages[generatedImages.length - 1]?.enhancedPrompt;
                          if (ep) { navigator.clipboard.writeText(ep).catch(() => {}); }
                        }}
                        className="text-[10px] text-foreground/40 hover:text-foreground/70 transition-colors flex items-center gap-0.5"
                      >
                        <Copy className="w-3 h-3" />
                        复制
                      </button>
                    </div>
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                      {generatedImages[generatedImages.length - 1].enhancedPrompt}
                    </p>
                    <div className="mt-2 pt-2 border-t border-border/30">
                      <p className="text-[10px] text-foreground/30 mb-0.5">原始提示词</p>
                      <p className="text-[11px] text-foreground/50">{generatedImages[generatedImages.length - 1].prompt}</p>
                    </div>
                  </div>
                )}
                {generatedImages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-foreground/30">
                    <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-sm">输入提示词开始创作</p>
                    <p className="text-xs mt-1">或使用右侧助手获取建议</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {generatedImages.map(img => (
                      <div
                        key={img.id}
                        className="group relative aspect-square rounded-xl overflow-hidden bg-accent/30 border border-border hover:border-[#70E0FF]/30 transition-all cursor-pointer"
                        onClick={() => setSelectedImageUrl(selectedImageUrl === img.url ? null : img.url)}
                      >
                        {img.url ? (
                          <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                            <ImageIcon className="w-8 h-8 text-foreground/20" />
                            <span className="text-[10px] text-red-400/70 px-2 text-center line-clamp-2">{img.prompt.includes('生成失败') ? img.prompt.split('生成失败: ')[1] || '生成失败' : '无图片'}</span>
                          </div>
                        )}
                        {/* 二创保留元素验证警告 */}
                        {img.preserveWarning && (
                          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-amber-500/90 text-[9px] text-white font-medium flex items-center gap-1 shadow-sm">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {img.preserveWarning}
                          </div>
                        )}
                        {/* 设计还原标签 */}
                        {img.designLabel && (
                          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-primary/90 text-[9px] text-white font-medium shadow-sm">
                            {img.designLabel}
                          </div>
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                          <p className="text-[10px] text-foreground/40 mb-0.5">提示词</p>
                          <p className="text-xs text-foreground/80 line-clamp-2">{img.prompt}</p>
                          {img.enhancedPrompt && (
                            <>
                              <p className="text-[10px] text-primary/60 mt-1 mb-0.5">优化后</p>
                              <p className="text-xs text-foreground/90 whitespace-pre-wrap">{img.enhancedPrompt}</p>
                            </>
                          )}
                        </div>
                        {/* 操作按钮 */}
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {img.designLabel && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setBlueprintImage({ url: img.url, style: selectedRemix?.id || 'design_clothing_craft', ...parseDesignPreset(selectedRemix?.id || 'design_clothing_craft'), description: img.designLabel || img.prompt });
                              }}
                              className="p-1.5 rounded-lg bg-black/60 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
                              title="查看设计图"
                            >
                              <Ruler className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAnnotateImage({ url: img.url, annotations: [] });
                            }}
                            className="p-1.5 rounded-lg bg-black/60 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                            title="标注放大"
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopyPrompt(img.enhancedPrompt || img.prompt, img.id); }}
                            className="p-1.5 rounded-lg bg-black/60 text-foreground/70 hover:text-foreground"
                            title={img.enhancedPrompt ? '复制优化提示词' : '复制提示词'}
                          >
                            {copiedId === img.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button className="p-1.5 rounded-lg bg-black/60 text-foreground/70 hover:text-foreground">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* 模型标签 */}
                        <div className="absolute top-2 left-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/60 text-muted-foreground">
                            {IMAGE_MODELS.find(m => m.code === img.model)?.name || img.model}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {outputTab === 'history' && (
              <div className="h-full overflow-y-auto p-3">
                {generatedHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-foreground/30">
                    <Layers className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-sm">暂无生成记录</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {generatedHistory.map((img) => (
                      <div key={img.id} className="rounded-xl border border-border overflow-hidden bg-card">
                        {/* 缩略图 */}
                        {img.url ? (
                          <div className="relative aspect-[3/2] bg-muted group/img">
                            <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
                            {/* 标注按钮 */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <button
                                onClick={() => setAnnotateImage({ url: img.url, annotations: [] })}
                                className="p-1.5 rounded-lg bg-black/60 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                title="标注放大"
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {/* 二创保留元素验证警告 */}
                            {img.preserveWarning && (
                              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-amber-500/90 text-[9px] text-white font-medium flex items-center gap-1 shadow-sm">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {img.preserveWarning}
                              </div>
                            )}
                            {/* 设计还原标签 */}
                            {img.designLabel && (
                              <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-primary/90 text-[9px] text-white font-medium shadow-sm">
                                {img.designLabel}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="aspect-[3/2] bg-muted flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-foreground/15" />
                          </div>
                        )}
                        {/* 信息区 */}
                        <div className="p-3 space-y-2">
                          {/* 原始提示词 */}
                          <div>
                            <p className="text-[10px] text-foreground/40 mb-0.5">原始提示词</p>
                            <p className="text-xs text-foreground/70 line-clamp-2">{img.prompt}</p>
                          </div>
                          {/* 优化后提示词 */}
                          {img.enhancedPrompt && (
                            <div className="bg-primary/5 rounded-lg p-2">
                              <p className="text-[10px] text-primary/60 mb-0.5">优化后提示词</p>
                              <p className="text-xs text-foreground/80 whitespace-pre-wrap">{img.enhancedPrompt}</p>
                              <button
                                onClick={() => { navigator.clipboard.writeText(img.enhancedPrompt!); }}
                                className="mt-1 text-[10px] text-primary hover:underline"
                              >
                                复制
                              </button>
                            </div>
                          )}
                          {/* 元信息 */}
                          <div className="flex items-center gap-2 text-[10px] text-foreground/30">
                            <span>{img.model}</span>
                            {img.style && <span>· {img.style}</span>}
                            <span>· {new Date(img.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ===== 右侧：对话式交互 - Lovart 风格 ===== */}
        <div className="w-[320px] flex-shrink-0 border-l border-border flex flex-col bg-card">
          {/* 对话标题 */}
          <div className="px-5 py-4 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-foreground/90">图片生成助手</h3>
                <p className="text-[10px] text-foreground/35 mt-0.5">提示词优化 · 风格推荐</p>
              </div>
              {chatStreaming && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-primary/60">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  思考中
                </span>
              )}
            </div>
          </div>

          {/* 快捷操作 */}
          <div className="flex-shrink-0 px-4 py-2.5 border-b border-border/30">
            <div className="flex flex-wrap gap-1.5">
              {selectedRemix
                ? [`换个二创风格`, `调整保留元素`, `重新生成本风格`, `查看版权须知`].map(action => (
                  <button
                    key={action}
                    onClick={() => {
                      if (action === '查看版权须知') { setShowCopyright(true); return; }
                      if (action === '换个二创风格') { setCfgExpand('remix'); return; }
                      if (action === '调整保留元素') { setCfgExpand('elements'); return; }
                      setChatInput(action);
                    }}
                    className="px-2.5 py-1 rounded-full text-[11px] bg-accent/25 text-foreground/50 hover:bg-primary/10 hover:text-primary border border-border/30 hover:border-primary/20 transition-all"
                  >
                    {action}
                  </button>
                ))
                : ['优化提示词', '推荐风格', '调整构图', '相似图参考'].map(action => (
                  <button
                    key={action}
                    onClick={() => setChatInput(action)}
                    className="px-2.5 py-1 rounded-full text-[11px] bg-accent/25 text-foreground/50 hover:bg-primary/10 hover:text-primary border border-border/30 hover:border-primary/20 transition-all"
                  >
                    {action}
                  </button>
                ))
              }
            </div>
          </div>

          {/* 对话消息区 */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 py-4 space-y-4">
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' ? (
                  /* AI 助手气泡 */
                  <div className="max-w-[92%]">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-2.5 h-2.5 text-primary" />
                      </div>
                      <span className="text-[10px] font-medium text-foreground/40">创作助手</span>
                    </div>
                    <div className="bg-accent/25 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="text-[12px] leading-[1.7] text-foreground/80 whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 用户气泡 */
                  <div className="max-w-[80%] bg-primary/12 rounded-2xl rounded-tr-sm px-4 py-2.5">
                    <div className="text-[12px] leading-[1.7] text-foreground/90 whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* 底部输入栏 - Lovart 风格 */}
          <div className="px-4 pb-4 pt-2">
            <div className="relative flex items-center bg-accent/20 rounded-2xl border border-border/40 focus-within:border-primary/20 focus-within:ring-1 focus-within:ring-primary/10 transition-all">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                placeholder="输入你的创作需求..."
                className="flex-1 text-[12px] bg-transparent px-4 py-3 text-foreground/80 outline-none placeholder:text-foreground/25"
                disabled={chatStreaming}
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput.trim() || chatStreaming}
                className="flex-shrink-0 w-8 h-8 m-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-20 disabled:bg-primary/30 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 图片放大预览 */}
      {selectedImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setSelectedImageUrl(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={selectedImageUrl} alt="预览" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <button
              onClick={() => setSelectedImageUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 二创版权声明弹窗 */}
      {showCopyright && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
          onClick={() => setShowCopyright(false)}
        >
          <div
            className="w-[480px] max-h-[80vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* 标题 */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">二创版权须知</h3>
                <p className="text-[10px] text-foreground/40">使用二创功能前请仔细阅读</p>
              </div>
              <button
                onClick={() => setShowCopyright(false)}
                className="ml-auto w-6 h-6 rounded-md hover:bg-accent/50 flex items-center justify-center text-foreground/40"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* 内容 */}
            <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[55vh] text-[12px] leading-[1.8] text-foreground/70">
              <div className="space-y-2">
                <h4 className="text-[13px] font-semibold text-foreground">1. 原创声明</h4>
                <p>通过二创功能生成的作品属于 AI 辅助创作的衍生作品。用户应明确标注作品为「AI 二创」并注明原始参考来源，不得声称完全原创。</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-[13px] font-semibold text-foreground">2. 授权确认</h4>
                <p>上传的参考图片须为用户本人拥有版权、已获授权或属于公共领域的素材。使用他人受版权保护的影视/动漫/游戏角色进行二创，需确保符合原版权方的二次创作政策。</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-[13px] font-semibold text-foreground">3. 合理使用</h4>
                <p>二创作品仅限个人欣赏、学习交流和非商业用途。将二创作品用于商业目的（包括但不限于售卖、广告、商业授权）需另行获取原版权方许可。</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-[13px] font-semibold text-foreground">4. 内容安全</h4>
                <p>二创内容不得含有违法、暴力、色情、仇恨言论或其他违反法律法规的内容。不得利用二创功能恶意丑化、诽谤原始作品或其创作者。</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-[13px] font-semibold text-foreground">5. 责任承担</h4>
                <p>用户对二创作品的使用和传播承担全部法律责任。平台仅提供 AI 创作工具，不对用户因二创行为产生的版权纠纷承担连带责任。</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-primary/80 font-medium">温馨提示：尊重原创，合理二创。推荐在作品中标注「基于 [原作名] 的 AI 二创」，既是尊重也是保护。</p>
              </div>
            </div>
            {/* 底部按钮 */}
            <div className="px-6 py-4 border-t border-border/50 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCopyright(false)}
                className="px-4 py-2 text-xs text-foreground/60 hover:text-foreground/80 rounded-lg hover:bg-accent/30 transition-all"
              >
                关闭
              </button>
              <button
                onClick={() => setShowCopyright(false)}
                className="px-4 py-2 text-xs text-white bg-primary hover:bg-primary/80 rounded-lg transition-all"
              >
                我已了解
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 参考图片预览灯箱 ===== */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 顶部工具栏 */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
              <span className="text-sm text-white/90 font-medium truncate max-w-[60%]">{previewImage.name}</span>
              <button
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            {/* 图片 */}
            <img
              src={previewImage.url}
              alt={previewImage.name}
              className="max-w-[90vw] max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}

      {/* 设计图纸叠加层 */}
      {blueprintImage && (
        <DesignBlueprintOverlay
          imageUrl={blueprintImage.url}
          blueprintType={blueprintImage.blueprintType}
          domain={blueprintImage.domain}
          onClose={() => setBlueprintImage(null)}
        />
      )}

      {/* 标注查看器 */}
      {annotateImage && (
        <ImageAnnotationViewer
          imageUrl={annotateImage.url}
          initialAnnotations={annotateImage.annotations}
          remixMode={selectedRemix !== null}
          designRestoreMode={selectedRemix?.category === 'design_restore'}
          annotationStyle={selectedRemix?.category === 'design_restore' || selectedRemix?.category === 'style_transfer' ? 'classical' : 'modern'}
          onClose={() => setAnnotateImage(null)}
          onSave={(anns) => {
            setAnnotateImage(prev => prev ? { ...prev, annotations: anns } : null);
          }}
        />
      )}
    </div>
  );
}
