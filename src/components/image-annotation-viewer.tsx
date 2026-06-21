'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Plus, ZoomIn, ZoomOut, RotateCcw, Sparkles, Trash2, Move,
  ChevronRight, Loader2, Search, Layers, Clock, Wand2, ChevronDown,
  Pencil, MousePointer2, Eye, Palette,
} from 'lucide-react';
import { formatProviderError, getBYOKRequestHeaders } from '@/lib/byok-client';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Annotation {
  id: string;
  /** 标注点在图片上的相对位置 (0-1) */
  x: number;
  y: number;
  /** 放大裁剪区域半径 (相对值 0-1) */
  radius: number;
  /** 标注标题 */
  title: string;
  /** 标注详细说明 */
  description: string;
  /** 标注分类标签 */
  tag?: string;
  /** 是否AI自动生成 */
  isAI?: boolean;
  /** 引线方向 (auto时自动计算) */
  leaderDir?: 'left' | 'right' | 'top' | 'bottom' | 'auto';
  /** 是否在图上展示描述 */
  showOnImage?: boolean;
}

interface VariantImage {
  variantKey: 'traditional' | 'modern' | 'future';
  label: string;
  imageUrl: string;
  loading?: boolean;
}

interface DetailResult {
  type: 'zoom' | 'structure' | 'period' | 'variant';
  title: string;
  content: string;
  imageUrl?: string;
  variantImages?: VariantImage[];
}

interface ImageAnnotationViewerProps {
  imageUrl: string;
  onClose: () => void;
  initialAnnotations?: Annotation[];
  remixMode?: boolean;
  /** 标注样式：modern=现代引线 / classical=古典国风 */
  annotationStyle?: 'modern' | 'classical';
  /** 是否为设计还原模式（显示尺寸标注工具） */
  designRestoreMode?: boolean;
  onSave?: (annotations: Annotation[]) => void;
}

/** 尺寸标注线 */
interface DimensionLine {
  id: string;
  /** 起点相对坐标 (0-1) */
  x1: number;
  y1: number;
  /** 终点相对坐标 (0-1) */
  x2: number;
  y2: number;
  /** 标注文字（如 "120mm"） */
  label: string;
}

/* ------------------------------------------------------------------ */
/*  常量                                                               */
/* ------------------------------------------------------------------ */

const TAG_COLORS: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  // 新通用标签
  '结构': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', hex: '#3b82f6' },
  '材质': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40', hex: '#f97316' },
  '色彩': { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/40', hex: '#ec4899' },
  '纹样': { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/40', hex: '#8b5cf6' },
  '功能': { bg: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/40', hex: '#0ea5e9' },
  '文化': { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40', hex: '#f59e0b' },
  '造型': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', hex: '#10b981' },
  '工艺': { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/40', hex: '#14b8a6' },
  // 旧标签兼容
  '妆面': { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/40', hex: '#f43f5e' },
  '服饰': { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40', hex: '#f59e0b' },
  '道具': { bg: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/40', hex: '#0ea5e9' },
  '场景': { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/40', hex: '#14b8a6' },
  'default': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', hex: '#ef4444' },
};

const TAG_OPTIONS = ['结构', '材质', '色彩', '纹样', '功能', '文化', '造型', '工艺'];

const DETAIL_TYPES = [
  { key: 'zoom' as const, label: '放大细节', icon: ZoomIn, desc: '生成该区域的高清放大展示' },
  { key: 'structure' as const, label: '结构解析', icon: Layers, desc: '解析该元素的层次与构成' },
  { key: 'period' as const, label: '年代校验', icon: Clock, desc: '校验是否符合对应年代特征' },
  { key: 'variant' as const, label: '设计变体', icon: Wand2, desc: '生成该元素的设计变体方案' },
];

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ------------------------------------------------------------------ */
/*  引线标注布局计算                                                    */
/* ------------------------------------------------------------------ */

interface LabelLayout {
  pinX: number;
  pinY: number;
  labelX: number;
  labelY: number;
  dir: 'left' | 'right';
  midX: number;
  midY: number;
}

function computeLabelLayouts(annotations: Annotation[], imgAspect: number): Map<string, LabelLayout> {
  const map = new Map<string, LabelLayout>();
  const sorted = [...annotations].sort((a, b) => a.y - b.y);

  sorted.forEach((ann, i) => {
    const preferRight = ann.x < 0.5;
    const dir: 'left' | 'right' = ann.leaderDir === 'auto' || !ann.leaderDir
      ? (preferRight ? 'right' : 'left')
      : (ann.leaderDir === 'top' || ann.leaderDir === 'bottom') ? (i % 2 === 0 ? 'left' : 'right') : ann.leaderDir as 'left' | 'right';

    const margin = 0.06;
    const verticalSpan = 0.7;
    const verticalStart = 0.12;
    const labelY = verticalStart + (i / Math.max(sorted.length - 1, 1)) * verticalSpan;

    let labelX: number;
    if (dir === 'left') {
      labelX = margin;
    } else {
      labelX = 1 - margin;
    }

    const elbowOffset = dir === 'left' ? -0.08 : 0.08;
    const midX = ann.x + elbowOffset;

    map.set(ann.id, {
      pinX: ann.x,
      pinY: ann.y,
      labelX,
      labelY,
      dir,
      midX,
      midY: ann.y,
    });
  });

  return map;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ImageAnnotationViewer({
  imageUrl,
  onClose,
  initialAnnotations = [],
  remixMode = false,
  annotationStyle: annotationStyleProp,
  designRestoreMode = false,
  onSave,
}: ImageAnnotationViewerProps) {
  // 标注样式
  const [annotationStyle, setAnnotationStyle] = useState<'modern' | 'classical'>(annotationStyleProp ?? 'modern');

  // 标注数据
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 交互模式：view(点击选中/双击添加) / add(单击添加) / move(拖拽移动)
  const [mode, setMode] = useState<'view' | 'add' | 'move'>('view');

  // 缩放 & 平移
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // AI标注加载中
  const [aiLoading, setAiLoading] = useState(false);

  // 编辑表单
  const [editForm, setEditForm] = useState({ title: '', description: '', tag: '', showOnImage: true });

  // 图片容器ref
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // 拖拽状态
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, ax: 0, ay: 0 });

  // 图片自然尺寸
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });

  // 图片显示尺寸（像素）
  const [imgDisplay, setImgDisplay] = useState({ w: 0, h: 0 });

  // 细节生成
  const [detailLoading, setDetailLoading] = useState<DetailResult['type'] | null>(null);
  const [detailResults, setDetailResults] = useState<DetailResult[]>([]);
  const [detailExpanded, setDetailExpanded] = useState<string | null>(null);

  // 悬停标注ID
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 尺寸标注线（设计还原模式）
  const [dimLines, setDimLines] = useState<DimensionLine[]>([]);
  const [dimDrawing, setDimDrawing] = useState(false);
  const [dimStart, setDimStart] = useState<{ x: number; y: number } | null>(null);
  const [dimEnd, setDimEnd] = useState<{ x: number; y: number } | null>(null);
  const [dimLabelInput, setDimLabelInput] = useState<string>('');
  const [dimEditingId, setDimEditingId] = useState<string | null>(null);

  /* ---------- 图片加载后获取显示尺寸 ---------- */
  useEffect(() => {
    if (!imgRef.current) return;
    const updateSize = () => {
      const img = imgRef.current;
      if (img) {
        setImgDisplay({ w: img.clientWidth, h: img.clientHeight });
        setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  /* ---------- 引线布局 ---------- */
  const imgAspect = imgDisplay.w > 0 ? imgDisplay.w / imgDisplay.h : 1;
  const labelLayouts = computeLabelLayouts(annotations, imgAspect);

  /* ---------- 点击图片：添加模式直接添加 / 查看模式双击添加 ---------- */
  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // 检查点击的是否是标注元素（锚点/标签/浮动卡）
      const target = e.target as HTMLElement;
      if (target.closest('[data-annotation]')) return;

      if (mode === 'add') {
        // 添加模式：单击直接添加
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        const id = genId();
        const ann: Annotation = {
          id,
          x,
          y,
          radius: 0.08,
          title: '',
          description: '',
          tag: '',
          showOnImage: true,
        };
        setAnnotations(prev => [...prev, ann]);
        setSelectedId(id);
        setEditingId(id);
        setEditForm({ title: '', description: '', tag: '', showOnImage: true });
        setMode('view');
      } else if (mode === 'view') {
        // 查看模式：点击空白处取消选中
        setSelectedId(null);
        setDetailResults([]);
      }
    },
    [mode],
  );

  /* ---------- 双击图片添加标注（任何模式都可用） ---------- */
  const handleImageDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-annotation]')) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      const id = genId();
      const ann: Annotation = {
        id,
        x,
        y,
        radius: 0.08,
        title: '',
        description: '',
        tag: '',
        showOnImage: true,
      };
      setAnnotations(prev => [...prev, ann]);
      setSelectedId(id);
      setEditingId(id);
      setEditForm({ title: '', description: '', tag: '', showOnImage: true });
    },
    [],
  );

  /* ---------- 拖拽移动标注（任何模式都可拖拽锚点） ---------- */
  const handlePinMouseDown = useCallback(
    (e: React.MouseEvent, annId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const ann = annotations.find(a => a.id === annId);
      if (!ann) return;
      setDragId(annId);
      setDragStart({ x: e.clientX, y: e.clientY, ax: ann.x, ay: ann.y });
    },
    [annotations],
  );

  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: MouseEvent) => {
      if (!imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      const dx = (e.clientX - dragStart.x) / rect.width;
      const dy = (e.clientY - dragStart.y) / rect.height;
      setAnnotations(prev =>
        prev.map(a =>
          a.id === dragId
            ? { ...a, x: Math.max(0, Math.min(1, dragStart.ax + dx)), y: Math.max(0, Math.min(1, dragStart.ay + dy)) }
            : a,
        ),
      );
    };
    const onUp = () => setDragId(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragId, dragStart]);

  /* ---------- 保存编辑 ---------- */
  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;
    setAnnotations(prev =>
      prev.map(a => (a.id === editingId ? { ...a, title: editForm.title, description: editForm.description, tag: editForm.tag, showOnImage: editForm.showOnImage } : a)),
    );
    setEditingId(null);
  }, [editingId, editForm]);

  /* ---------- 删除标注 ---------- */
  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }, [selectedId, editingId]);

  /* ---------- 尺寸标注线绘制 ---------- */
  const getRelativePos = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  }, []);

  const handleDimClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const pos = getRelativePos(e);
    if (!dimStart) {
      setDimStart(pos);
      setDimEnd(null);
    } else {
      // 第二次点击 — 完成绘制，弹出输入标签
      setDimEnd(pos);
      setDimLabelInput('');
    }
  }, [dimStart, getRelativePos]);

  const handleDimMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dimStart && !dimEnd) {
      setDimEnd(getRelativePos(e));
    }
  }, [dimStart, dimEnd, getRelativePos]);

  const confirmDimLine = useCallback(() => {
    if (dimStart && dimEnd && dimLabelInput.trim()) {
      setDimLines(prev => [...prev, {
        id: genId(),
        x1: dimStart.x, y1: dimStart.y,
        x2: dimEnd.x, y2: dimEnd.y,
        label: dimLabelInput.trim(),
      }]);
    }
    setDimStart(null);
    setDimEnd(null);
    setDimLabelInput('');
  }, [dimStart, dimEnd, dimLabelInput]);

  const cancelDimLine = useCallback(() => {
    setDimStart(null);
    setDimEnd(null);
    setDimLabelInput('');
  }, []);

  /* ---------- 将图片转为 File 对象（用于FormData上传到S3） ---------- */
  const imageToFile = useCallback(async (): Promise<File | null> => {
    // 方法1：通过 fetch + blob 获取图片文件（最可靠，绕过 canvas 跨域污染）
    try {
      const resp = await fetch(imageUrl, { mode: 'cors' });
      if (resp.ok) {
        const blob = await resp.blob();
        // 如果图片较大，用 canvas 缩放
        const bitmap = await createImageBitmap(blob);
        const maxDim = 1536;
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
        if (scale >= 1) {
          // 无需缩放，直接用原始 blob
          bitmap.close();
          return new File([blob], 'annotate.jpg', { type: blob.type || 'image/jpeg' });
        }
        const w = Math.round(bitmap.width * scale);
        const h = Math.round(bitmap.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0, w, h);
          bitmap.close();
          const file = await new Promise<File>((resolve) => {
            canvas.toBlob(
              (b) => { if (b) resolve(new File([b], 'annotate.jpg', { type: 'image/jpeg' })); },
              'image/jpeg', 0.85
            );
          });
          if (file) return file;
        } else {
          bitmap.close();
        }
      }
    } catch (e) {
      console.warn('[imageToFile] fetch方式失败:', e);
    }
    // 方法2：通过页面中已渲染的 img 元素 canvas 转换
    try {
      const img = document.querySelector(`img[src="${imageUrl}"]`) as HTMLImageElement
        || document.querySelector('img[src^="blob:"]') as HTMLImageElement;
      if (img && img.complete && img.naturalWidth > 0) {
        const maxDim = 1536;
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          return new Promise<File>((resolve) => {
            canvas.toBlob(
              (b) => { if (b) resolve(new File([b], 'annotate.jpg', { type: 'image/jpeg' })); },
              'image/jpeg', 0.85
            );
          });
        }
      }
    } catch (e) {
      console.warn('[imageToFile] canvas方式失败:', e);
    }
    return null;
  }, [imageUrl]);

  /* ---------- AI 自动标注 ---------- */
  const [aiError, setAiError] = useState<string>('');

  const handleAIAnnotate = useCallback(async () => {
    setAiLoading(true);
    setAiError('');
    try {
      // 将图片转为 File 对象，通过 FormData 上传（后端会先上传S3获取公网URL再调用视觉模型）
      const imageFile = await imageToFile();
      const formData = new FormData();
      if (imageFile) {
      // 注意：字段名必须与后端 route.ts 的 formData.get('file') 一致
        formData.append('file', imageFile!);
      } else {
        // 文件获取失败时，仅发送 imageUrl，后端尝试通过 URL 转存
        console.warn('[handleAIAnnotate] 无法将图片转为文件，仅发送imageUrl');
      }
      formData.append('imageUrl', imageUrl);
      formData.append('existingAnnotations', String(annotations.length));
      const res = await fetch('/api/image/annotate', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAiError(data.error || 'AI标注请求失败');
        return;
      }
      if (data.annotations && Array.isArray(data.annotations)) {
        const newAnns: Annotation[] = data.annotations.map((a: Record<string, unknown>, i: number) => ({
          id: genId() + i,
          x: a.x as number,
          y: a.y as number,
          radius: (a.radius as number) || 0.08,
          title: (a.title as string) || '',
          description: (a.description as string) || '',
          tag: (a.tag as string) || '',
          isAI: true,
          showOnImage: true,
        }));
        setAnnotations(prev => [...prev, ...newAnns]);
        if (newAnns.length > 0) setSelectedId(newAnns[0].id);
      }
    } catch {
      setAiError('网络请求失败，请检查网络后重试');
    } finally {
      setAiLoading(false);
    }
  }, [annotations.length]);

  /* ---------- 二创模式下自动触发AI标注 ---------- */
  const autoAnnotatedRef = useRef(false);
  useEffect(() => {
    if (remixMode && initialAnnotations.length === 0 && !autoAnnotatedRef.current && imgDisplay.w > 0) {
      autoAnnotatedRef.current = true;
      handleAIAnnotate();
    }
  }, [remixMode, initialAnnotations.length, imgDisplay.w, handleAIAnnotate]);

  /* ---------- AI 细节生成 ---------- */
  const handleDetailGenerate = useCallback(async (type: DetailResult['type']) => {
    if (!selectedId) return;
    const ann = annotations.find(a => a.id === selectedId);
    if (!ann) return;

    setDetailLoading(type);
    try {
      const res = await fetch('/api/image/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          region: { x: ann.x, y: ann.y, radius: ann.radius },
          title: ann.title,
          tag: ann.tag,
          type,
        }),
      });
      if (!res.ok) throw new Error('细节生成失败');
      const data = await res.json();
      const result: DetailResult = {
        type,
        title: data.title || '',
        content: data.content || '',
        imageUrl: data.imageUrl,
      };
      setDetailResults(prev => [...prev, result]);
      setDetailExpanded(result.title + type);
    } catch {
      // 静默
    } finally {
      setDetailLoading(null);
    }
  }, [selectedId, annotations, imageUrl]);

  /* ---------- 设计变体图片生成 ---------- */
  const VARIANT_PROMPTS: Record<VariantImage['variantKey'], { label: string; direction: string }> = {
    traditional: { label: '传统还原', direction: '严格遵循历史文献与考古资料，忠实地以传统技法还原，保留原汁原味的文化特征与工艺细节，呈现经典原貌' },
    modern: { label: '现代融合', direction: '保留核心传统元素（如纹样、廓形、色彩符号），融入现代审美与材质，传统元素与现代设计语言融合，创造新旧对话' },
    future: { label: '未来想象', direction: '大胆突破传统框架，以未来主义手法重新演绎文化元素，加入数字化、全息投影、智能材料等未来感技术概念' },
  };

  const handleVariantGenerate = useCallback(async (variantKey: VariantImage['variantKey']) => {
    if (!selectedId) return;
    const ann = annotations.find(a => a.id === selectedId);
    if (!ann) return;

    const variant = VARIANT_PROMPTS[variantKey];

    // 标记该变体图片为加载中
    setDetailResults(prev => {
      const existing = prev.find(r => r.type === 'variant');
      if (existing) {
        const newImages = [...(existing.variantImages || [])];
        const idx = newImages.findIndex(v => v.variantKey === variantKey);
        if (idx >= 0) {
          newImages[idx] = { ...newImages[idx], loading: true };
        } else {
          newImages.push({ variantKey, label: variant.label, imageUrl: '', loading: true });
        }
        return prev.map(r => r.type === 'variant' ? { ...r, variantImages: newImages } : r);
      }
      return prev;
    });

    try {
      // 第一步：先用图片理解获取原图视觉描述（确保提示词描述具体视觉内容）
      let visualDescription = '';
      try {
        const understandRes = await fetch('/api/image/understand', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl,
            prompt: `请简要描述图中"${ann.title}"${ann.tag ? `（${ann.tag}类别）` : ''}的视觉特征：形态、色彩、材质、纹理、构图。100字以内。`,
          }),
        });
        if (understandRes.ok) {
          const ud = await understandRes.json();
          visualDescription = ud.description || ud.content || '';
        }
      } catch { /* 理解失败不影响主流程 */ }

      // 第二步：基于视觉描述+设计方向构建生成提示词
      const tagDesc = ann.tag ? `（${ann.tag}类别）` : '';
      const prompt = `这是一张关于"${ann.title}"${tagDesc}的专业设计图。` +
        (visualDescription ? `原图中该元素的特征：${visualDescription}。` : '') +
        (ann.description ? `标注说明：${ann.description.slice(0, 200)}。` : '') +
        `设计方向：${variant.direction}。` +
        `【必须保留】原图的形态轮廓和核心视觉特征，在此基础上进行${variant.label}风格的设计。` +
        `要求设计图清晰展示结构细节、材质纹理、色彩搭配，专业级设计稿品质，与原图有明显视觉关联性。`;

      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
        body: JSON.stringify({
          prompt,
          image: imageUrl,   // 传递原图作为 subject_reference 保持视觉关联
          size: '1024x1024',
          n: 1,
          creativeIntent: variantKey === 'traditional' ? 'reference' : 'reinterpret',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(formatProviderError(data, '生成失败'));

      if (data.imageUrls && data.imageUrls.length > 0) {
        setDetailResults(prev => {
          const existing = prev.find(r => r.type === 'variant');
          if (existing) {
            const newImages = [...(existing.variantImages || [])];
            const idx = newImages.findIndex(v => v.variantKey === variantKey);
            if (idx >= 0) {
              newImages[idx] = { variantKey, label: variant.label, imageUrl: data.imageUrls[0], loading: false };
            } else {
              newImages.push({ variantKey, label: variant.label, imageUrl: data.imageUrls[0], loading: false });
            }
            return prev.map(r => r.type === 'variant' ? { ...r, variantImages: newImages } : r);
          }
          return prev;
        });
      }
    } catch {
      // 标记失败
      setDetailResults(prev => {
        const existing = prev.find(r => r.type === 'variant');
        if (existing) {
          const newImages = (existing.variantImages || []).filter(v => v.variantKey !== variantKey);
          return prev.map(r => r.type === 'variant' ? { ...r, variantImages: newImages } : r);
        }
        return prev;
      });
    }
  }, [selectedId, annotations, imageUrl]);

  /* ---------- 缩放 ---------- */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.5, Math.min(5, prev + delta)));
  }, []);

  /* ---------- 保存 ---------- */
  /* ---------- 保存编辑 ---------- */
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    if (onSaveRef.current) onSaveRef.current(annotations);
  }, [annotations]);

  /* ---------- 选中的标注 ---------- */
  const selectedAnn = annotations.find(a => a.id === selectedId);

  /* ---------- 放大裁剪 ---------- */
  const getCropStyle = (ann: Annotation, zoomFactor?: number): React.CSSProperties => {
    // zoomFactor: 放大倍数，用于列表缩略图（更紧凑的裁剪）
    const r = zoomFactor ? ann.radius * zoomFactor : ann.radius;
    const cropDiameter = r * 2;
    const cropLeft = ann.x - r;
    const cropTop = ann.y - r;
    const zoom = 1 / cropDiameter; // 使裁剪区域恰好填满容器
    // CSS background-position 百分比公式：
    // offset = -cropLeft * zoom * W = (W - zoom * W) * pos / 100
    // => pos = -cropLeft / (cropDiameter - 1) * 100
    const posX = cropDiameter >= 0.999 ? 50 : -cropLeft * 100 / (cropDiameter - 1);
    const posY = cropDiameter >= 0.999 ? 50 : -cropTop * 100 / (cropDiameter - 1);
    return {
      backgroundImage: `url(${imageUrl})`,
      backgroundSize: `${zoom * 100}% ${zoom * 100}%`,
      backgroundPosition: `${posX}% ${posY}%`,
    };
  };

  /* ---------- 计算浮动卡片位置 ---------- */
  const getFloatingCardPos = (ann: Annotation, layout: LabelLayout): { left: number; top: number; dir: 'left' | 'right' } => {
    // 浮动卡在锚点旁边，根据引线方向偏移
    const offset = 0.04;
    const cardDir = layout.dir;
    const left = cardDir === 'right' ? ann.x + offset : ann.x - offset;
    const top = ann.y;
    return { left, top, dir: cardDir };
  };

  /* ---------- 当前活跃/悬停的标注（用于浮动展示） ---------- */
  const activeAnnId = selectedId || hoveredId;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* 主内容 */}
      <div className="relative z-10 flex w-full h-full">
        {/* 左侧：图片区 + 引线标注 + 浮动描述卡 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 顶部工具栏 */}
          <div className="flex items-center justify-between px-5 py-3 bg-[#1a1a1a] backdrop-blur border-b border-white/10">
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium text-white/80">图片标注</span>
              {remixMode && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-red-500 to-rose-500 text-white">
                  二创标注
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 模式切换 - 更直观的图标 */}
              <div className="flex items-center bg-white/10 rounded-lg p-0.5">
                {([
                  ['view', Eye, '查看'],
                  ['add', Pencil, '标注'],
                  ['move', Move, '移动'],
                  ...(designRestoreMode ? [['dimension', Search, '尺寸'] as const] : []),
                ] as const).map(([m, Icon, label]) => (
                  <button
                    key={m}
                    onClick={() => {
                      if (m === 'dimension') {
                        setDimDrawing(true);
                        setMode('view');
                      } else {
                        setDimDrawing(false);
                        setDimStart(null);
                        setDimEnd(null);
                        setMode(m as 'view' | 'add' | 'move');
                      }
                    }}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      (m === 'dimension' ? dimDrawing : mode === m) ? (m === 'dimension' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white') : 'text-white/60 hover:text-white/80'
                    }`}
                    title={label}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              {/* 标注样式切换 */}
              <div className="flex items-center bg-white/10 rounded-lg p-0.5 ml-1">
                <button
                  onClick={() => setAnnotationStyle('modern')}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    annotationStyle === 'modern' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/60'
                  }`}
                  title="现代标注"
                >
                  <Layers className="w-3 h-3" />
                  <span>现代</span>
                </button>
                <button
                  onClick={() => setAnnotationStyle('classical')}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    annotationStyle === 'classical' ? 'bg-amber-500/30 text-amber-300' : 'text-white/40 hover:text-white/60'
                  }`}
                  title="古风标注"
                >
                  <Palette className="w-3 h-3" />
                  <span>古风</span>
                </button>
              </div>
              {/* 缩放 */}
              <div className="flex items-center gap-1 ml-2">
                <button onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-white/50 w-12 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(prev => Math.min(5, prev + 0.25))} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
              {/* AI标注 - 始终显示 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAIAnnotate}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-medium hover:from-red-600 hover:to-rose-600 disabled:opacity-50 transition-all"
                >
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {aiLoading ? '识别中...' : 'AI识别标注'}
                </button>
                {aiError && (
                  <span className="text-xs text-red-300 max-w-[200px] truncate" title={aiError}>
                    {aiError}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 图片区 + SVG引线覆盖层 + 浮动描述卡 */}
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center overflow-hidden bg-[#1a1a1a]"
            style={{ cursor: dimDrawing ? 'crosshair' : mode === 'add' ? 'crosshair' : mode === 'move' ? 'grab' : 'default' }}
            onClick={dimDrawing ? handleDimClick : handleImageClick}
            onMouseMove={dimDrawing ? handleDimMove : undefined}
            onDoubleClick={dimDrawing ? undefined : handleImageDoubleClick}
            onWheel={handleWheel}
          >
            <div
              className="relative"
              style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transformOrigin: 'center center', transition: 'transform 0.15s ease' }}
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="标注图片"
                className="max-h-[70vh] max-w-[55vw] object-contain select-none"
                draggable={false}
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
                  setImgDisplay({ w: img.clientWidth, h: img.clientHeight });
                }}
              />

              {/* SVG 标注叠加层 */}
              {annotations.length > 0 && imgDisplay.w > 0 && (
                <svg
                  className="absolute inset-0 pointer-events-none"
                  viewBox={`0 0 ${imgDisplay.w} ${imgDisplay.h}`}
                  style={{ width: imgDisplay.w, height: imgDisplay.h }}
                >
                  <defs>
                    {/* 古典风格：金色渐变 */}
                    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#d4a853" />
                      <stop offset="50%" stopColor="#f0d48a" />
                      <stop offset="100%" stopColor="#c9a04a" />
                    </linearGradient>
                    {/* 古典风格：暖棕底色渐变（加深底色提升对比度） */}
                    <linearGradient id="parchmentGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#d4b87a" />
                      <stop offset="100%" stopColor="#a8863e" />
                    </linearGradient>
                    {/* 古典风格：印章红渐变 */}
                    <linearGradient id="sealRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#c41e1e" />
                      <stop offset="100%" stopColor="#a01818" />
                    </linearGradient>
                    {/* 角落装饰图案 */}
                    <symbol id="cornerOrnament" viewBox="0 0 12 12">
                      <path d="M 1 1 L 11 1 L 11 3 L 3 3 L 3 11 L 1 11 Z" fill="url(#goldGrad)" opacity="0.9" />
                      <circle cx="2" cy="2" r="1.2" fill="#f0d48a" />
                    </symbol>
                    {/* 如意头装饰 */}
                    <symbol id="ruyiHead" viewBox="0 0 30 16">
                      <path d="M 0 8 Q 5 0 15 2 Q 25 0 30 8 Q 25 16 15 14 Q 5 16 0 8 Z" fill="url(#parchmentGrad)" stroke="url(#goldGrad)" strokeWidth="0.8" />
                    </symbol>
                  </defs>

                  {annotations.map((ann, _idx) => {
                    const layout = labelLayouts.get(ann.id);
                    if (!layout) return null;

                    const tagColor = TAG_COLORS[ann.tag || 'default'] || TAG_COLORS['default'];
                    const isSelected = selectedId === ann.id;
                    const isHovered = hoveredId === ann.id;
                    const isActive = isSelected || isHovered;
                    const isClassical = annotationStyle === 'classical';

                    const px = (v: number, dim: 'w' | 'h') => v * (dim === 'w' ? imgDisplay.w : imgDisplay.h);

                    const pinXpx = px(layout.pinX, 'w');
                    const pinYpx = px(layout.pinY, 'h');
                    const labelXpx = px(layout.labelX, 'w');
                    const labelYpx = px(layout.labelY, 'h');
                    const midXpx = px(layout.midX, 'w');
                    const midYpx = px(layout.midY, 'h');

                    if (isClassical) {
                      // ============ 古典风格（国色芳华风格） ============
                      const frameW = Math.min(200, imgDisplay.w * 0.25);
                      const frameH = Math.min(160, imgDisplay.h * 0.22);
                      const frameX = labelXpx - frameW / 2;
                      const frameY = labelYpx - frameH - 8;
                      const cornerSize = 14;
                      const zoomFactor = 3;

                      // 精准裁剪：计算放大框内应显示的图片区域
                      const cropCenterX = ann.x * imgDisplay.w;
                      const cropCenterY = ann.y * imgDisplay.h;
                      const cropSrcX = cropCenterX - frameW / (2 * zoomFactor);
                      const cropSrcY = cropCenterY - frameH / (2 * zoomFactor);

                      // 描述文字截取（最多4行，每行约12个字）
                      const descLines: string[] = [];
                      if (ann.description) {
                        const cleanDesc = ann.description.replace(/\n/g, ' ').trim();
                        const lineLen = Math.max(10, Math.floor((frameW + 40) / 15));
                        for (let i = 0; i < cleanDesc.length && descLines.length < 4; i += lineLen) {
                          descLines.push(cleanDesc.slice(i, i + lineLen));
                        }
                      }

                      return (
                        <g key={ann.id}>
                          {/* 连接线：从锚点到放大框底部 */}
                          <line
                            x1={pinXpx} y1={pinYpx}
                            x2={labelXpx} y2={frameY + frameH}
                            stroke="#d4a853"
                            strokeWidth={1.2}
                            strokeDasharray="4 3"
                            opacity={isActive ? 0.6 : 0.2}
                          />

                          {/* 八边形圆角放大框 */}
                          <g
                            className="pointer-events-auto cursor-pointer"
                            data-annotation={ann.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedId(isSelected ? null : ann.id); setEditingId(null); setDetailResults([]); }}
                            onMouseEnter={() => setHoveredId(ann.id)}
                            onMouseLeave={() => setHoveredId(null)}
                          >
                            {/* 裁剪区域：放大框内的图片 */}
                            <defs>
                              <clipPath id={`frameClip-${ann.id}`}>
                                <rect x={frameX + 4} y={frameY + 4} width={frameW - 8} height={frameH - 8} rx={6} />
                              </clipPath>
                            </defs>
                            {/* 放大框底色（提供对比度） */}
                            <rect
                              x={frameX + 2} y={frameY + 2}
                              width={frameW - 4} height={frameH - 4}
                              rx={8}
                              fill="#0a0a0a"
                            />
                            {/* 放大的图片内容（精准裁剪） */}
                            <image
                              href={imageUrl}
                              x={frameX + 4 - cropSrcX * zoomFactor}
                              y={frameY + 4 - cropSrcY * zoomFactor}
                              width={imgDisplay.w * zoomFactor}
                              height={imgDisplay.h * zoomFactor}
                              clipPath={`url(#frameClip-${ann.id})`}
                              preserveAspectRatio="xMidYMid slice"
                              opacity={0.95}
                            />
                            {/* 八边形外框 */}
                            <rect
                              x={frameX} y={frameY}
                              width={frameW} height={frameH}
                              rx={10}
                              fill="none"
                              stroke={isActive ? '#ef4444' : 'url(#goldGrad)'}
                              strokeWidth={isActive ? 3 : 2}
                            />
                            {/* 四角装饰 */}
                            <use href="#cornerOrnament" x={frameX - 3} y={frameY - 3} width={cornerSize} height={cornerSize} />
                            <use href="#cornerOrnament" x={frameX + frameW - cornerSize + 3} y={frameY - 3} width={cornerSize} height={cornerSize} transform={`scale(-1,1) translate(${-2 * (frameX + frameW - cornerSize + 3) - cornerSize},0)`} />
                            <use href="#cornerOrnament" x={frameX - 3} y={frameY + frameH - cornerSize + 3} width={cornerSize} height={cornerSize} transform={`scale(1,-1) translate(0,${-2 * (frameY + frameH - cornerSize + 3) - cornerSize})`} />
                            <use href="#cornerOrnament" x={frameX + frameW - cornerSize + 3} y={frameY + frameH - cornerSize + 3} width={cornerSize} height={cornerSize} transform={`scale(-1,-1) translate(${-2 * (frameX + frameW - cornerSize + 3) - cornerSize},${-2 * (frameY + frameH - cornerSize + 3) - cornerSize})`} />
                            {/* 金色圆点装饰（框边缘中点） */}
                            <circle cx={frameX + frameW / 2} cy={frameY} r={3} fill="#f0d48a" />
                            <circle cx={frameX + frameW / 2} cy={frameY + frameH} r={3} fill="#f0d48a" />
                            <circle cx={frameX} cy={frameY + frameH / 2} r={3} fill="#f0d48a" />
                            <circle cx={frameX + frameW} cy={frameY + frameH / 2} r={3} fill="#f0d48a" />
                          </g>

                          {/* 锚点：金色小环（可拖拽修正位置） */}
                          <circle
                            cx={pinXpx} cy={pinYpx}
                            r={isActive ? 8 : 5}
                            fill="none"
                            stroke={isActive ? '#ef4444' : 'url(#goldGrad)'}
                            strokeWidth={2}
                            className="pointer-events-auto cursor-grab"
                            data-annotation={ann.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedId(isSelected ? null : ann.id); setEditingId(null); setDetailResults([]); }}
                            onMouseDown={(e) => handlePinMouseDown(e, ann.id)}
                            onMouseEnter={() => setHoveredId(ann.id)}
                            onMouseLeave={() => setHoveredId(null)}
                          />
                          <circle cx={pinXpx} cy={pinYpx} r={2} fill={isActive ? '#ef4444' : '#d4a853'} />

                          {/* 悬停时显示拖拽提示 */}
                          {isHovered && !dragId && (
                            <g>
                              <rect
                                x={pinXpx - 42} y={pinYpx - 22}
                                width={84} height={18}
                                rx={4}
                                fill="#1a1a1a"
                                fillOpacity={0.9}
                              />
                              <text
                                x={pinXpx}
                                y={pinYpx - 11}
                                textAnchor="middle"
                                fill="#d4a853"
                                fontSize={10}
                                fontFamily="sans-serif"
                              >
                                拖拽修正位置
                              </text>
                            </g>
                          )}

                          {/* 选中时高亮区域 */}
                          {isActive && (
                            <circle
                              cx={pinXpx} cy={pinYpx}
                              r={ann.radius * Math.min(imgDisplay.w, imgDisplay.h) * 1.2}
                              fill="#ef4444" fillOpacity={0.08}
                              stroke="#ef4444" strokeWidth={1.5}
                              strokeDasharray="6 3"
                            />
                          )}

                          {/* 如意头装饰（放大框底部到文字标签之间） */}
                          <use href="#ruyiHead"
                            x={labelXpx - 18} y={frameY + frameH - 2}
                            width={36} height={18}
                          />

                          {/* 文字标签：暖棕底色+金色边框+如意外形 */}
                          {ann.title && (
                            <g
                              className="pointer-events-auto cursor-pointer"
                              data-annotation={ann.id}
                              onClick={(e) => { e.stopPropagation(); setSelectedId(isSelected ? null : ann.id); setEditingId(null); setDetailResults([]); }}
                              onMouseEnter={() => setHoveredId(ann.id)}
                              onMouseLeave={() => setHoveredId(null)}
                            >
                              {(() => {
                                const titleLen = ann.title.length;
                                const tagExtra = ann.tag ? 40 : 0;
                                const textW = Math.max(Math.min(titleLen * 16 + tagExtra + 20, frameW + 60), 120);
                                const descH = descLines.length > 0 ? descLines.length * 16 + 8 : 0;
                                const textH = 30 + descH;
                                const tx = labelXpx - textW / 2;
                                const ty = frameY + frameH + 16;
                                return (
                                  <>
                                    {/* 如意形外框（含描述区域） */}
                                    <path
                                      d={`M ${tx + 8} ${ty} Q ${tx} ${ty} ${tx} ${ty + 8} L ${tx} ${ty + textH - 8} Q ${tx} ${ty + textH} ${tx + 8} ${ty + textH} L ${tx + textW - 8} ${ty + textH} Q ${tx + textW} ${ty + textH} ${tx + textW} ${ty + textH - 8} L ${tx + textW} ${ty + 8} Q ${tx + textW} ${ty} ${tx + textW - 8} ${ty} Z`}
                                      fill={isActive ? '#ef4444' : 'url(#parchmentGrad)'}
                                      fillOpacity={1}
                                      stroke={isActive ? '#ef4444' : 'url(#goldGrad)'}
                                      strokeWidth={1.5}
                                    />
                                    {/* 标题+标签分隔线 */}
                                    {descLines.length > 0 && (
                                      <line
                                        x1={tx + 10} y1={ty + 30}
                                        x2={tx + textW - 10} y2={ty + 30}
                                        stroke={isActive ? 'rgba(255,255,255,0.3)' : 'url(#goldGrad)'}
                                        strokeWidth={0.5}
                                        opacity={0.6}
                                      />
                                    )}
                                    {/* 标题文字 */}
                                    <text
                                      x={labelXpx - tagExtra / 2}
                                      y={ty + 17}
                                      fill={isActive ? 'white' : '#1a0e05'}
                                      fontSize={15}
                                      fontWeight={700}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                      fontFamily="serif, 'Noto Serif SC', system-ui"
                                      stroke={isActive ? 'transparent' : '#1a0e05'}
                                      strokeWidth={0.3}
                                    >
                                      {ann.title}
                                    </text>
                                    {/* 分类标签 */}
                                    {ann.tag && (
                                      <>
                                        <rect
                                          x={tx + textW - tagExtra - 6}
                                          y={ty + 6}
                                          width={tagExtra} height={16}
                                          rx={3}
                                          fill={isActive ? 'white' : 'url(#sealRedGrad)'}
                                          fillOpacity={0.9}
                                        />
                                        <text
                                          x={tx + textW - tagExtra / 2 - 6}
                                          y={ty + 17}
                                          fill={isActive ? '#ef4444' : 'white'}
                                          fontSize={10}
                                          fontWeight={600}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          fontFamily="serif, system-ui"
                                        >
                                          {ann.tag}
                                        </text>
                                      </>
                                    )}
                                    {/* 描述文字（2-3行） */}
                                    {descLines.map((line, li) => (
                                      <text
                                        key={li}
                                        x={labelXpx}
                                        y={ty + 36 + li * 16}
                                        fill={isActive ? 'rgba(255,255,255,0.9)' : '#2a1a0a'}
                                        fontSize={11}
                                        fontWeight={500}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fontFamily="'Noto Serif SC', serif, system-ui"
                                      >
                                        {line}
                                      </text>
                                    ))}
                                  </>
                                );
                              })()}
                            </g>
                          )}

                          {/* AI标识（小印章） */}
                          {ann.isAI && (
                            <g>
                              <rect
                                x={pinXpx + 10} y={pinYpx - 20}
                                width={20} height={20} rx={3}
                                fill="url(#sealRedGrad)"
                                fillOpacity={0.85}
                              />
                              <text
                                x={pinXpx + 20} y={pinYpx - 7}
                                fill="white"
                                fontSize={11}
                                fontWeight={700}
                                textAnchor="middle"
                                fontFamily="serif, system-ui"
                              >
                                注
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    }

                    // ============ 现代风格（原有风格） ============
                    const elbowPath = `M ${pinXpx} ${pinYpx} L ${midXpx} ${midYpx} L ${labelXpx} ${labelYpx}`;

                    return (
                      <g key={ann.id}>
                        {/* 引线 */}
                        <path
                          d={elbowPath}
                          fill="none"
                          stroke={isActive ? '#ef4444' : tagColor.hex}
                          strokeWidth={isActive ? 2 : 1.5}
                          strokeDasharray={isActive ? 'none' : '4 2'}
                          opacity={isActive ? 1 : 0.7}
                        />

                        {/* 锚点外圈（可交互，可拖拽修正位置） */}
                        <circle
                          cx={pinXpx}
                          cy={pinYpx}
                          r={isActive ? 10 : 7}
                          fill={isActive ? '#ef4444' : tagColor.hex}
                          fillOpacity={isActive ? 0.25 : 0.15}
                          stroke={isActive ? '#ef4444' : tagColor.hex}
                          strokeWidth={2}
                          className="pointer-events-auto cursor-grab"
                          style={{ transition: 'all 0.15s ease' }}
                          data-annotation={ann.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(isSelected ? null : ann.id);
                            setEditingId(null);
                            setDetailResults([]);
                          }}
                          onMouseDown={(e) => handlePinMouseDown(e, ann.id)}
                          onMouseEnter={() => setHoveredId(ann.id)}
                          onMouseLeave={() => setHoveredId(null)}
                        />
                        {/* 中心点 */}
                        <circle
                          cx={pinXpx}
                          cy={pinYpx}
                          r={3}
                          fill={isActive ? '#ef4444' : tagColor.hex}
                        />

                        {/* 悬停时显示拖拽提示 */}
                        {isHovered && !dragId && (
                          <g>
                            <rect
                              x={pinXpx - 42} y={pinYpx - 22}
                              width={84} height={18}
                              rx={4}
                              fill="#1a1a1a"
                              fillOpacity={0.9}
                            />
                            <text
                              x={pinXpx}
                              y={pinYpx - 11}
                              textAnchor="middle"
                              fill={tagColor.hex}
                              fontSize={10}
                              fontFamily="sans-serif"
                            >
                              拖拽修正位置
                            </text>
                          </g>
                        )}

                        {/* 选中/悬停时高亮区域 */}
                        {isActive && (
                          <circle
                            cx={pinXpx}
                            cy={pinYpx}
                            r={ann.radius * Math.min(imgDisplay.w, imgDisplay.h)}
                            fill="#ef4444"
                            fillOpacity={0.06}
                            stroke="#ef4444"
                            strokeWidth={1}
                            strokeDasharray="6 3"
                          />
                        )}

                        {/* 边缘标签（始终显示标题） */}
                        {ann.title && (() => {
                          const tagExtra = ann.tag ? 44 : 14;
                          const textW = Math.min(ann.title.length * 14 + tagExtra, imgDisplay.w * 0.38);
                          // 现代风格也展示描述
                          const modDescLines: string[] = [];
                          if (ann.description) {
                            const cleanD = ann.description.replace(/\n/g, ' ').trim();
                            const lineLen = Math.max(10, Math.floor(textW / 9));
                            for (let i = 0; i < cleanD.length && modDescLines.length < 3; i += lineLen) {
                              modDescLines.push(cleanD.slice(i, i + lineLen));
                            }
                          }
                          const labelH = 26 + modDescLines.length * 15;

                          return (
                            <g
                              className="pointer-events-auto cursor-pointer"
                              data-annotation={ann.id}
                              onClick={(e) => { e.stopPropagation(); setSelectedId(isSelected ? null : ann.id); setEditingId(null); setDetailResults([]); }}
                              onMouseEnter={() => setHoveredId(ann.id)}
                              onMouseLeave={() => setHoveredId(null)}
                            >
                              <rect
                                x={labelXpx - 6}
                                y={labelYpx - 14}
                                width={textW}
                                height={labelH}
                                rx={6}
                                fill={isActive ? '#ef4444' : tagColor.hex}
                                fillOpacity={1}
                              />
                              <text
                                x={labelXpx + 4}
                                y={labelYpx + 3}
                                fill="white"
                                fontSize={13}
                                fontWeight={700}
                                fontFamily="system-ui, sans-serif"
                              >
                                {ann.title}
                              </text>
                              {ann.tag && (
                                <>
                                  <rect
                                    x={labelXpx + ann.title.length * 14 + 6}
                                    y={labelYpx - 8}
                                    width={32}
                                    height={16}
                                    rx={3}
                                    fill="white"
                                    fillOpacity={0.25}
                                  />
                                  <text
                                    x={labelXpx + ann.title.length * 14 + 22}
                                    y={labelYpx + 2}
                                    fill="white"
                                    fontSize={9}
                                    fontWeight={600}
                                    textAnchor="middle"
                                    fontFamily="system-ui, sans-serif"
                                  >
                                    {ann.tag}
                                  </text>
                                </>
                              )}
                              {modDescLines.map((line, li) => (
                                <text
                                  key={li}
                                  x={labelXpx + 4}
                                  y={labelYpx + 18 + li * 15}
                                  fill="rgba(255,255,255,0.85)"
                                  fontSize={10}
                                  fontWeight={400}
                                  fontFamily="system-ui, sans-serif"
                                >
                                  {line}
                                </text>
                              ))}
                            </g>
                          );
                        })()}
                      </g>
                    );
                  })}
                  {/* 尺寸标注线（设计还原模式） */}
                  {dimLines.map(dl => {
                    const px1 = dl.x1 * imgDisplay.w, py1 = dl.y1 * imgDisplay.h;
                    const px2 = dl.x2 * imgDisplay.w, py2 = dl.y2 * imgDisplay.h;
                    const midPx = (px1 + px2) / 2, midPy = (py1 + py2) / 2;
                    const dx = px2 - px1, dy = py2 - py1;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const nx = len > 0 ? -dy / len : 0, ny = len > 0 ? dx / len : 0;
                    const tickH = 8;
                    return (
                      <g key={dl.id} className="pointer-events-auto cursor-pointer" onClick={() => setDimEditingId(dl.id)}>
                        {/* 主线 */}
                        <line x1={px1} y1={py1} x2={px2} y2={py2} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="6 3" />
                        {/* 端点短线 */}
                        <line x1={px1 + nx * tickH} y1={py1 + ny * tickH} x2={px1 - nx * tickH} y2={py1 - ny * tickH} stroke="#3b82f6" strokeWidth={1.5} />
                        <line x1={px2 + nx * tickH} y1={py2 + ny * tickH} x2={px2 - nx * tickH} y2={py2 - ny * tickH} stroke="#3b82f6" strokeWidth={1.5} />
                        {/* 端点圆 */}
                        <circle cx={px1} cy={py1} r={3} fill="#3b82f6" />
                        <circle cx={px2} cy={py2} r={3} fill="#3b82f6" />
                        {/* 标注文字背景+文字 */}
                        <rect
                          x={midPx - (dl.label.length * 7 + 8) / 2} y={midPy - 20}
                          width={dl.label.length * 7 + 8} height={18} rx={3}
                          fill="rgba(59,130,246,0.9)"
                        />
                        <text
                          x={midPx} y={midPy - 9}
                          textAnchor="middle" fontSize={11} fill="white" fontWeight={600}
                          fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
                        >{dl.label}</text>
                      </g>
                    );
                  })}
                  {/* 正在绘制的尺寸线预览 */}
                  {dimDrawing && dimStart && dimEnd && (
                    <line
                      x1={dimStart.x * imgDisplay.w} y1={dimStart.y * imgDisplay.h}
                      x2={dimEnd.x * imgDisplay.w} y2={dimEnd.y * imgDisplay.h}
                      stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.7}
                    />
                  )}
                </svg>
              )}

              {/* HTML 浮动描述卡片（选中/悬停时直接在图片上展示） */}
              {activeAnnId && (() => {
                const ann = annotations.find(a => a.id === activeAnnId);
                if (!ann || !ann.description || !ann.showOnImage) return null;
                const layout = labelLayouts.get(ann.id);
                if (!layout) return null;
                const tagColor = TAG_COLORS[ann.tag || 'default'] || TAG_COLORS['default'];
                const isSelected = selectedId === ann.id;

                // 浮动卡位置：在锚点和边缘标签之间，偏向锚点一侧
                const cardLeft = layout.dir === 'right'
                  ? `${(ann.x * 100) + 4}%`
                  : undefined;
                const cardRight = layout.dir === 'left'
                  ? `${((1 - ann.x) * 100) + 4}%`
                  : undefined;
                const cardTop = `${ann.y * 100 - 2}%`;

                return (
                  <div
                    data-annotation={ann.id}
                    className="absolute max-w-[360px] z-20 pointer-events-auto"
                    style={{
                      left: cardLeft,
                      right: cardRight,
                      top: cardTop,
                      transform: 'translateY(-100%)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className={`rounded-xl border shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-200 ${
                        isSelected
                          ? 'border-red-500/50 bg-black/80'
                          : `border-white/20 bg-black/70`
                      }`}
                    >
                      {/* 标题栏 */}
                      <div
                        className="flex items-center gap-2 px-3 py-2 border-b border-white/10"
                        style={{ backgroundColor: `${tagColor.hex}20` }}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tagColor.hex }} />
                        <span className="text-sm font-semibold text-white/90 truncate flex-1">
                          {ann.title}
                        </span>
                        {ann.tag && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tagColor.bg} ${tagColor.text} border ${tagColor.border}`}>
                            {ann.tag}
                          </span>
                        )}
                        {ann.isAI && (
                          <span className="px-1 py-0.5 rounded text-[8px] font-medium bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-0.5">
                            <Sparkles className="w-2 h-2" /> AI
                          </span>
                        )}
                      </div>
                      {/* 描述内容 */}
                      <div className="px-3 py-2.5">
                        <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap line-clamp-8">
                          {ann.description}
                        </p>
                      </div>
                      {/* 底部操作 */}
                      {isSelected && (
                        <div className="flex items-center gap-1 px-3 py-1.5 border-t border-white/10 bg-white/5">
                          <button
                            onClick={() => {
                              setEditingId(ann.id);
                              setEditForm({ title: ann.title, description: ann.description, tag: ann.tag || '', showOnImage: ann.showOnImage ?? true });
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-white/60 hover:text-white/80 hover:bg-white/10 transition-colors"
                          >
                            <Pencil className="w-2.5 h-2.5" /> 编辑
                          </button>
                          <button
                            onClick={() => handleDeleteAnnotation(ann.id)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-2.5 h-2.5" /> 删除
                          </button>
                        </div>
                      )}
                    </div>
                    {/* 箭头指向锚点 */}
                    <div
                      className="absolute w-3 h-3 rotate-45 -mt-1.5"
                      style={{
                        left: layout.dir === 'right' ? '12px' : undefined,
                        right: layout.dir === 'left' ? '12px' : undefined,
                        backgroundColor: isSelected ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.7)',
                        borderTop: `1px solid ${isSelected ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.2)'}`,
                        borderLeft: `1px solid ${isSelected ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.2)'}`,
                      }}
                    />
                  </div>
                );
              })()}

              {/* 添加模式提示 */}
              {mode === 'add' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="px-4 py-2.5 rounded-xl bg-red-500/80 text-white text-sm font-medium animate-pulse flex items-center gap-2 shadow-lg">
                    <Pencil className="w-4 h-4" />
                    点击图片任意位置添加标注
                  </div>
                </div>
              )}

              {/* 双击添加提示（查看模式时） */}
              {mode === 'view' && annotations.length === 0 && !aiLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center space-y-3">
                    <div className="px-5 py-3 rounded-xl bg-black/60 backdrop-blur border border-white/10">
                      <p className="text-sm text-white/70 font-medium">双击图片直接添加标注</p>
                      <p className="text-[10px] text-white/40 mt-1">或点击上方「标注」按钮进入标注模式</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 底部标注计数 + 提示 */}
          <div className="flex items-center justify-between px-5 py-2 bg-[#1a1a1a] backdrop-blur border-t border-white/10">
            <span className="text-xs text-white/40">
              {annotations.length} 个标注{dimLines.length > 0 ? ` · ${dimLines.length} 条尺寸` : ''} · {imgNatural.w}×{imgNatural.h}
            </span>
            <span className="text-xs text-white/30">
              {dimDrawing ? '点击图片两点绘制尺寸线' : mode === 'add' ? '点击图片添加标注' : '拖拽标注点修正位置 · 双击添加标注 · 单击查看详情'}
            </span>
          </div>

          {/* 尺寸标注输入弹窗 */}
          {dimDrawing && dimStart && dimEnd && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] border border-blue-500/40 rounded-xl shadow-2xl p-4 w-72">
              <p className="text-xs text-white/70 mb-2">输入尺寸标注文字（如 &quot;120mm&quot;、&quot;宽30cm&quot;）</p>
              <input
                value={dimLabelInput}
                onChange={e => setDimLabelInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmDimLine(); if (e.key === 'Escape') cancelDimLine(); }}
                placeholder="尺寸文字..."
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex gap-2 mt-3">
                <button onClick={confirmDimLine} disabled={!dimLabelInput.trim()} className="flex-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">确认</button>
                <button onClick={cancelDimLine} className="flex-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/70 text-xs rounded-lg transition-colors">取消</button>
              </div>
            </div>
          )}
        </div>

        {/* 右侧：标注详情面板 */}
        <div className="w-[380px] flex-shrink-0 bg-[#111111] backdrop-blur border-l border-white/10 flex flex-col">
          {/* 面板标题 */}
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white/90">标注详情</h3>
            <p className="text-[10px] text-white/40 mt-0.5">
              {mode === 'view' ? '双击图片添加标注，或点击标注查看详情' : mode === 'add' ? '点击图片添加标注' : '拖拽标注点移动位置'}
            </p>
          </div>

          {/* 标注列表 / 详情 */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {selectedAnn ? (
              /* 选中标注的详情视图 */
              <div className="p-4 space-y-4">
                {/* 放大裁剪预览 */}
                <div
                  className="aspect-square rounded-xl border border-white/20 overflow-hidden shadow-lg"
                  style={getCropStyle(selectedAnn)}
                />

                {/* 编辑模式 */}
                {editingId === selectedAnn.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-white/50 mb-1 block">标题</label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-sm text-white placeholder-white/30 focus:border-red-500/50 focus:outline-none"
                        placeholder="如：非遗点翠头面"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 mb-1 block">分类标签</label>
                      <div className="flex flex-wrap gap-1.5">
                        {TAG_OPTIONS.map(tag => {
                          const tc = TAG_COLORS[tag];
                          return (
                            <button
                              key={tag}
                              onClick={() => setEditForm(prev => ({ ...prev, tag }))}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                                editForm.tag === tag
                                  ? `${tc.bg} ${tc.text} ${tc.border}`
                                  : 'bg-white/5 text-white/40 border-white/10 hover:border-white/30'
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 mb-1 block">详细说明</label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs text-white placeholder-white/30 focus:border-red-500/50 focus:outline-none resize-none"
                        rows={4}
                        placeholder="描述此元素的文化背景、工艺特点、历史意义..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-white/50">在图片上展示说明</label>
                      <button
                        onClick={() => setEditForm(prev => ({ ...prev, showOnImage: !prev.showOnImage }))}
                        className={`w-8 h-4 rounded-full transition-colors ${editForm.showOnImage ? 'bg-red-500' : 'bg-white/20'}`}
                      >
                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${editForm.showOnImage ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-1.5 rounded-lg bg-white/10 text-white/60 text-xs hover:bg-white/20 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 查看模式 */
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-white/90">
                          {selectedAnn.title || '未命名标注'}
                        </h4>
                        {selectedAnn.tag && (() => {
                          const tc = TAG_COLORS[selectedAnn.tag] || TAG_COLORS['default'];
                          return (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${tc.bg} ${tc.text} border ${tc.border}`}>
                              {selectedAnn.tag}
                            </span>
                          );
                        })()}
                        {selectedAnn.isAI && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> AI
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedAnn.description ? (
                      <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap">
                        {selectedAnn.description}
                      </p>
                    ) : (
                      <p className="text-xs text-white/30 italic">暂无说明，点击编辑添加</p>
                    )}

                    {/* 在图展示开关 */}
                    <div className="flex items-center gap-2 py-1.5">
                      <Eye className="w-3.5 h-3.5 text-white/40" />
                      <span className="text-[10px] text-white/50">在图片上展示说明</span>
                      <button
                        onClick={() => {
                          const newVal = !selectedAnn.showOnImage;
                          setAnnotations(prev => prev.map(a => a.id === selectedAnn.id ? { ...a, showOnImage: newVal } : a));
                        }}
                        className={`w-8 h-4 rounded-full transition-colors ${selectedAnn.showOnImage !== false ? 'bg-red-500' : 'bg-white/20'}`}
                      >
                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${selectedAnn.showOnImage !== false ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    {/* AI 细节生成按钮组 - 始终显示 */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-[11px] font-semibold text-white/80">AI深度解析</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DETAIL_TYPES.map(dt => (
                          <button
                            key={dt.key}
                            onClick={() => handleDetailGenerate(dt.key)}
                            disabled={detailLoading !== null}
                            className="flex flex-col items-start p-2.5 rounded-lg border border-white/10 hover:border-red-500/30 hover:bg-red-500/5 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <dt.icon className="w-3.5 h-3.5 text-red-400 group-hover:text-red-300" />
                              <span className="text-[11px] font-medium text-white/80">{dt.label}</span>
                              {detailLoading === dt.key && <Loader2 className="w-3 h-3 animate-spin text-red-400" />}
                            </div>
                            <span className="text-[9px] text-white/40 leading-tight">{dt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 细节生成结果 */}
                    {detailResults.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-white/10">
                        <span className="text-[10px] text-white/40">解析结果</span>
                        {detailResults.map((result, i) => {
                          const dt = DETAIL_TYPES.find(d => d.key === result.type);
                          const isExpanded = detailExpanded === result.title + result.type;
                          return (
                            <div key={i} className="rounded-lg border border-white/10 overflow-hidden">
                              <button
                                onClick={() => setDetailExpanded(isExpanded ? null : result.title + result.type)}
                                className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-white/5 transition-colors"
                              >
                                {dt && <dt.icon className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                                <span className="text-[11px] font-medium text-white/80 flex-1">{result.title}</span>
                                <ChevronDown className={`w-3 h-3 text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                              {isExpanded && (
                                <div className="px-2.5 pb-2.5 space-y-2">
                                  <p className="text-[11px] text-white/70 leading-relaxed whitespace-pre-wrap">
                                    {result.content}
                                  </p>
                                  {result.imageUrl && (
                                    <div className="rounded-lg overflow-hidden border border-white/10">
                                      <img src={result.imageUrl} alt={result.title} className="w-full" />
                                    </div>
                                  )}
                                  {/* 设计变体：生成设计图按钮 */}
                                  {result.type === 'variant' && (
                                    <div className="space-y-2 pt-1">
                                      <span className="text-[9px] text-white/40">生成设计图（基于原图保留视觉关联）</span>
                                      <div className="grid grid-cols-3 gap-1.5">
                                        {(['traditional', 'modern', 'future'] as const).map(vk => {
                                          const vInfo = VARIANT_PROMPTS[vk];
                                          const vImg = result.variantImages?.find(v => v.variantKey === vk);
                                          return (
                                            <button
                                              key={vk}
                                              onClick={() => handleVariantGenerate(vk)}
                                              disabled={vImg?.loading}
                                              className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-[10px] transition-all
                                                ${vImg?.imageUrl
                                                  ? 'border-red-500/30 bg-red-500/5 text-red-400'
                                                  : 'border-white/10 bg-white/5 text-white/60 hover:border-red-500/20 hover:bg-red-500/5 hover:text-red-400'}
                                                ${vImg?.loading ? 'opacity-60 cursor-wait' : ''}`}
                                            >
                                              {vImg?.loading ? (
                                                <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                                              ) : vImg?.imageUrl ? (
                                                <div className="w-full aspect-square rounded overflow-hidden border border-white/10">
                                                  <img src={vImg.imageUrl} alt={vInfo.label} className="w-full h-full object-cover" />
                                                </div>
                                              ) : (
                                                <Wand2 className="w-4 h-4" />
                                              )}
                                              <span className="font-medium">{vInfo.label}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {/* 已生成的设计图大图预览 */}
                                      {result.variantImages?.filter(v => v.imageUrl).map(vImg => (
                                        <div key={vImg.variantKey} className="rounded-lg overflow-hidden border border-white/10">
                                          <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5">
                                            <Wand2 className="w-3 h-3 text-red-400" />
                                            <span className="text-[10px] font-medium text-red-400">{vImg.label}设计图</span>
                                          </div>
                                          <img src={vImg.imageUrl} alt={vImg.label} className="w-full" />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          setEditingId(selectedAnn.id);
                          setEditForm({ title: selectedAnn.title, description: selectedAnn.description, tag: selectedAnn.tag || '', showOnImage: selectedAnn.showOnImage ?? true });
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-white/10 text-white/70 text-xs hover:bg-white/20 transition-colors"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteAnnotation(selectedAnn.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-3 h-3 inline mr-1" />
                        删除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* 标注列表 */
              <div className="p-3 space-y-2">
                {annotations.length === 0 ? (
                  <div className="py-12 flex flex-col items-center text-white/30">
                    <Pencil className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-xs">暂无标注</p>
                    <p className="text-[10px] mt-1">双击图片或切换「标注」模式添加</p>
                    <button
                      onClick={handleAIAnnotate}
                      disabled={aiLoading}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-rose-500 text-white text-[11px] font-medium disabled:opacity-50"
                    >
                      {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      AI识别标注
                    </button>
                  </div>
                ) : (
                  annotations.map(ann => {
                    const tc = TAG_COLORS[ann.tag || 'default'] || TAG_COLORS['default'];
                    return (
                      <div
                        key={ann.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 cursor-pointer transition-colors"
                        onClick={() => { setSelectedId(ann.id); setEditingId(null); setDetailResults([]); }}
                        onMouseEnter={() => setHoveredId(ann.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        {/* 缩略裁剪 */}
                        <div
                          className="w-12 h-12 rounded-lg border border-white/20 flex-shrink-0"
                          style={getCropStyle(ann, 1.5)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-white/80 truncate">
                              {ann.title || '未命名'}
                            </span>
                            {ann.tag && (
                              <span className={`px-1 py-0.5 rounded text-[8px] ${tc.bg} ${tc.text}`}>
                                {ann.tag}
                              </span>
                            )}
                            {ann.showOnImage !== false && ann.description && (
                              <span title="在图展示"><Eye className="w-3 h-3 text-white/30" /></span>
                            )}
                          </div>
                          <p className="text-[10px] text-white/40 truncate mt-0.5">
                            {ann.description || '暂无说明'}
                          </p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                      </div>
                    );
                  })
                )}
                {/* 尺寸标注线列表 */}
                {dimLines.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <h4 className="text-[10px] text-white/40 uppercase tracking-wider mb-2 px-1">尺寸标注</h4>
                    {dimLines.map(dl => (
                      <div key={dl.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 group">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-0.5 bg-blue-500 rounded" />
                          <span className="text-xs text-white/70 font-mono">{dl.label}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <input
                            value={dimEditingId === dl.id ? dimLabelInput : dl.label}
                            onChange={e => { setDimEditingId(dl.id); setDimLabelInput(e.target.value); }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && dimLabelInput.trim()) {
                                setDimLines(prev => prev.map(d => d.id === dl.id ? { ...d, label: dimLabelInput.trim() } : d));
                                setDimEditingId(null);
                              }
                              if (e.key === 'Escape') setDimEditingId(null);
                            }}
                            className="w-20 px-1 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] text-white/80"
                            onClick={e => e.stopPropagation()}
                          />
                          <button
                            onClick={() => setDimLines(prev => prev.filter(d => d.id !== dl.id))}
                            className="p-1 rounded hover:bg-red-500/20 text-red-400/60 hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
