'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';

/** 设计领域类型 */
export type DesignDomain = 'clothing' | 'makeup' | 'hair' | 'architecture';

/** 蓝图类型 */
export type BlueprintType = 'craft' | 'structure' | 'multiview';

/** 尺寸标注线 */
interface DimensionMark {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  label: string;
}

/** 通用工艺/结构符号 */
interface CraftSymbol {
  id: string;
  x: number; y: number;
  type: string;
  label: string;
}

/** 材料/面料/色卡标注 */
interface MaterialNote {
  id: string;
  x: number; y: number;
  label: string;
  color: string;
}

interface DesignBlueprintOverlayProps {
  imageUrl: string;
  /** 蓝图类型：craft=工艺图 / structure=结构分解 / multiview=多视图 */
  blueprintType: BlueprintType;
  /** 设计领域：clothing=服装 / makeup=妆容 / hair=发饰 / architecture=建筑 */
  domain: DesignDomain;
  onClose: () => void;
}

// ===== 各领域的工艺符号定义 =====

const CLOTHING_CRAFT_OPTIONS: { type: string; label: string }[] = [
  { type: 'stitch', label: '缝线' },
  { type: 'pleat', label: '褶皱' },
  { type: 'button', label: '纽扣' },
  { type: 'zipper', label: '拉链' },
  { type: 'dart', label: '省道' },
  { type: 'gathering', label: '抽褶' },
];

const MAKEUP_CRAFT_OPTIONS: { type: string; label: string }[] = [
  { type: 'eye_zone', label: '眼妆区' },
  { type: 'lip_zone', label: '唇妆区' },
  { type: 'blush_zone', label: '腮红区' },
  { type: 'contour_zone', label: '修容区' },
  { type: 'highlight_zone', label: '高光区' },
  { type: 'brow_zone', label: '眉妆区' },
];

const HAIR_CRAFT_OPTIONS: { type: string; label: string }[] = [
  { type: 'pin', label: '簪针' },
  { type: 'chain', label: '链坠' },
  { type: 'knot', label: '结饰' },
  { type: 'braid', label: '编织' },
  { type: 'inlay', label: '镶嵌' },
  { type: 'filigree', label: '花丝' },
];

const ARCH_CRAFT_OPTIONS: { type: string; label: string }[] = [
  { type: 'pillar', label: '柱' },
  { type: 'beam', label: '梁' },
  { type: 'bracket', label: '斗拱' },
  { type: 'tile', label: '瓦' },
  { type: 'wall', label: '墙' },
  { type: 'joint', label: '榫卯' },
];

function getCraftOptions(domain: DesignDomain) {
  switch (domain) {
    case 'makeup': return MAKEUP_CRAFT_OPTIONS;
    case 'hair': return HAIR_CRAFT_OPTIONS;
    case 'architecture': return ARCH_CRAFT_OPTIONS;
    default: return CLOTHING_CRAFT_OPTIONS;
  }
}

// ===== SVG 符号绘制 =====

function ClothingSymbolSvg({ type, x, y }: { type: string; x: number; y: number }) {
  switch (type) {
    case 'stitch':
      return (
        <g transform={`translate(${x},${y})`}>
          <line x1={0} y1={-6} x2={0} y2={6} stroke="#2563eb" strokeWidth={1.2} strokeDasharray="2,2" />
          <line x1={-4} y1={-3} x2={4} y2={-3} stroke="#2563eb" strokeWidth={1} />
          <line x1={-4} y1={3} x2={4} y2={3} stroke="#2563eb" strokeWidth={1} />
        </g>
      );
    case 'pleat':
      return (
        <g transform={`translate(${x},${y})`}>
          <path d="M-5,-5 L0,5 L5,-5" fill="none" stroke="#2563eb" strokeWidth={1.2} />
          <line x1={0} y1={5} x2={0} y2={9} stroke="#2563eb" strokeWidth={0.8} />
        </g>
      );
    case 'button':
      return (
        <g transform={`translate(${x},${y})`}>
          <circle r={5} fill="none" stroke="#2563eb" strokeWidth={1.2} />
          <circle r={2} fill="#2563eb" />
        </g>
      );
    case 'zipper':
      return (
        <g transform={`translate(${x},${y})`}>
          <line x1={0} y1={-8} x2={0} y2={8} stroke="#2563eb" strokeWidth={1.5} />
          {[-6, -3, 0, 3, 6].map(dy => (
            <line key={dy} x1={-3} y1={dy} x2={3} y2={dy} stroke="#2563eb" strokeWidth={0.8} />
          ))}
        </g>
      );
    case 'dart':
      return (
        <g transform={`translate(${x},${y})`}>
          <path d="M0,-8 L-5,8 L5,8 Z" fill="none" stroke="#2563eb" strokeWidth={1.2} />
          <line x1={0} y1={-8} x2={0} y2={8} stroke="#2563eb" strokeWidth={0.8} strokeDasharray="2,2" />
        </g>
      );
    case 'gathering':
      return (
        <g transform={`translate(${x},${y})`}>
          <path d="M-8,0 Q-4,-4 0,0 Q4,4 8,0" fill="none" stroke="#2563eb" strokeWidth={1.2} />
        </g>
      );
    default:
      return null;
  }
}

function MakeupSymbolSvg({ type, x, y }: { type: string; x: number; y: number }) {
  const colors: Record<string, string> = {
    eye_zone: '#8B5CF6',
    lip_zone: '#EF4444',
    blush_zone: '#F472B6',
    contour_zone: '#92400E',
    highlight_zone: '#FCD34D',
    brow_zone: '#6B7280',
  };
  const c = colors[type] || '#2563eb';
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={8} fill={c} fillOpacity={0.15} stroke={c} strokeWidth={1.2} strokeDasharray="3,2" />
      <circle r={3} fill={c} fillOpacity={0.4} />
    </g>
  );
}

function HairSymbolSvg({ type, x, y }: { type: string; x: number; y: number }) {
  switch (type) {
    case 'pin':
      return (
        <g transform={`translate(${x},${y})`}>
          <line x1={-8} y1={0} x2={8} y2={0} stroke="#D97706" strokeWidth={1.5} />
          <circle cx={8} cy={0} r={3} fill="#D97706" fillOpacity={0.3} stroke="#D97706" strokeWidth={1} />
        </g>
      );
    case 'chain':
      return (
        <g transform={`translate(${x},${y})`}>
          {[0, 5, 10].map(dx => (
            <ellipse key={dx} cx={dx - 5} cy={0} rx={3} ry={2} fill="none" stroke="#D97706" strokeWidth={1} />
          ))}
        </g>
      );
    case 'knot':
      return (
        <g transform={`translate(${x},${y})`}>
          <path d="M-6,-4 C-2,-8 2,0 6,-4" fill="none" stroke="#D97706" strokeWidth={1.2} />
          <path d="M-6,4 C-2,0 2,8 6,4" fill="none" stroke="#D97706" strokeWidth={1.2} />
        </g>
      );
    case 'braid':
      return (
        <g transform={`translate(${x},${y})`}>
          <path d="M-4,-6 L4,-2 L-4,2 L4,6" fill="none" stroke="#D97706" strokeWidth={1.2} />
        </g>
      );
    case 'inlay':
      return (
        <g transform={`translate(${x},${y})`}>
          <rect x={-5} y={-5} width={10} height={10} rx={1} fill="#D97706" fillOpacity={0.15} stroke="#D97706" strokeWidth={1.2} />
          <circle r={2} fill="#D97706" />
        </g>
      );
    case 'filigree':
      return (
        <g transform={`translate(${x},${y})`}>
          <path d="M-6,0 Q-3,-6 0,0 Q3,6 6,0" fill="none" stroke="#D97706" strokeWidth={1} />
          <path d="M0,-6 Q6,-3 0,0 Q-6,3 0,6" fill="none" stroke="#D97706" strokeWidth={1} />
        </g>
      );
    default:
      return null;
  }
}

function ArchSymbolSvg({ type, x, y }: { type: string; x: number; y: number }) {
  switch (type) {
    case 'pillar':
      return (
        <g transform={`translate(${x},${y})`}>
          <rect x={-4} y={-10} width={8} height={20} fill="#059669" fillOpacity={0.1} stroke="#059669" strokeWidth={1.2} />
          <line x1={0} y1={-10} x2={0} y2={10} stroke="#059669" strokeWidth={0.6} strokeDasharray="2,2" />
        </g>
      );
    case 'beam':
      return (
        <g transform={`translate(${x},${y})`}>
          <rect x={-12} y={-3} width={24} height={6} fill="#059669" fillOpacity={0.1} stroke="#059669" strokeWidth={1.2} />
        </g>
      );
    case 'bracket':
      return (
        <g transform={`translate(${x},${y})`}>
          <rect x={-6} y={-3} width={12} height={6} fill="#059669" fillOpacity={0.15} stroke="#059669" strokeWidth={1} />
          <line x1={-8} y1={-5} x2={8} y2={-5} stroke="#059669" strokeWidth={0.8} />
          <line x1={-8} y1={5} x2={8} y2={5} stroke="#059669" strokeWidth={0.8} />
        </g>
      );
    case 'tile':
      return (
        <g transform={`translate(${x},${y})`}>
          <path d="M-6,-3 Q0,-7 6,-3 L6,3 Q0,-1 -6,3 Z" fill="#059669" fillOpacity={0.15} stroke="#059669" strokeWidth={1} />
        </g>
      );
    case 'wall':
      return (
        <g transform={`translate(${x},${y})`}>
          <rect x={-10} y={-6} width={20} height={12} fill="#059669" fillOpacity={0.08} stroke="#059669" strokeWidth={1.2} />
          {/* 砖纹 */}
          <line x1={-10} y1={0} x2={10} y2={0} stroke="#059669" strokeWidth={0.5} />
          <line x1={0} y1={-6} x2={0} y2={0} stroke="#059669" strokeWidth={0.5} />
          <line x1={-5} y1={0} x2={-5} y2={6} stroke="#059669" strokeWidth={0.5} />
          <line x1={5} y1={0} x2={5} y2={6} stroke="#059669" strokeWidth={0.5} />
        </g>
      );
    case 'joint':
      return (
        <g transform={`translate(${x},${y})`}>
          <rect x={-5} y={-5} width={10} height={5} fill="#059669" fillOpacity={0.15} stroke="#059669" strokeWidth={1} />
          <rect x={-3} y={0} width={6} height={5} fill="#059669" fillOpacity={0.1} stroke="#059669" strokeWidth={1} />
          <line x1={-5} y1={0} x2={5} y2={0} stroke="#059669" strokeWidth={1.2} />
        </g>
      );
    default:
      return null;
  }
}

function CraftSymbolSvgRenderer({ type, x, y, domain }: { type: string; x: number; y: number; domain: DesignDomain }) {
  switch (domain) {
    case 'makeup': return <MakeupSymbolSvg type={type} x={x} y={y} />;
    case 'hair': return <HairSymbolSvg type={type} x={x} y={y} />;
    case 'architecture': return <ArchSymbolSvg type={type} x={x} y={y} />;
    default: return <ClothingSymbolSvg type={type} x={x} y={y} />;
  }
}

/** 尺寸标注线SVG绘制 */
function DimensionLineSvg({ dim }: { dim: DimensionMark }) {
  const { x1, y1, x2, y2, label } = dim;
  const isHorizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const offset = 18;

  return (
    <g>
      {isHorizontal ? (
        <>
          <line x1={x1} y1={y1} x2={x1} y2={y1 - offset} stroke="#2563eb" strokeWidth={0.6} />
          <line x1={x2} y1={y2} x2={x2} y2={y2 - offset} stroke="#2563eb" strokeWidth={0.6} />
          <line x1={x1} y1={y1 - offset} x2={x2} y2={y2 - offset} stroke="#2563eb" strokeWidth={1} />
          <polygon points={`${x1},${y1 - offset} ${x1 + 5},${y1 - offset - 3} ${x1 + 5},${y1 - offset + 3}`} fill="#2563eb" />
          <polygon points={`${x2},${y2 - offset} ${x2 - 5},${y2 - offset - 3} ${x2 - 5},${y2 - offset + 3}`} fill="#2563eb" />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1} x2={x1 - offset} y2={y1} stroke="#2563eb" strokeWidth={0.6} />
          <line x1={x2} y1={y2} x2={x2 - offset} y2={y2} stroke="#2563eb" strokeWidth={0.6} />
          <line x1={x1 - offset} y1={y1} x2={x2 - offset} y2={y2} stroke="#2563eb" strokeWidth={1} />
          <polygon points={`${x1 - offset},${y1} ${x1 - offset - 3},${y1 + 5} ${x1 - offset + 3},${y1 + 5}`} fill="#2563eb" />
          <polygon points={`${x2 - offset},${y2} ${x2 - offset - 3},${y2 - 5} ${x2 - offset + 3},${y2 - 5}`} fill="#2563eb" />
        </>
      )}
      <rect
        x={midX - label.length * 3.5 - 4}
        y={(isHorizontal ? y1 - offset : midY) - 8}
        width={label.length * 7 + 8}
        height={16}
        rx={2}
        fill="white"
        stroke="#2563eb"
        strokeWidth={0.5}
      />
      <text
        x={midX}
        y={(isHorizontal ? y1 - offset : midY) + 4}
        textAnchor="middle"
        fill="#2563eb"
        fontSize={10}
        fontFamily="monospace"
        fontWeight={600}
      >
        {label}
      </text>
    </g>
  );
}

/** 材料/面料/色卡标注SVG */
function MaterialNoteSvg({ note, domain }: { note: MaterialNote; domain: DesignDomain }) {
  const labelColor = domain === 'architecture' ? '#059669' : domain === 'hair' ? '#D97706' : domain === 'makeup' ? '#8B5CF6' : '#059669';
  return (
    <g>
      <line x1={note.x} y1={note.y} x2={note.x + 50} y2={note.y - 20} stroke={labelColor} strokeWidth={0.8} />
      {/* 色块 */}
      <rect x={note.x + 50} y={note.y - 28} width={14} height={14} rx={2} fill={note.color} stroke={labelColor} strokeWidth={0.5} />
      {/* 标签 */}
      <rect x={note.x + 68} y={note.y - 30} width={note.label.length * 7 + 8} height={16} rx={2} fill="white" stroke={labelColor} strokeWidth={0.5} />
      <text x={note.x + 72} y={note.y - 18} fill={labelColor} fontSize={9} fontFamily="sans-serif">{note.label}</text>
    </g>
  );
}

// ===== 领域相关显示信息 =====

const DOMAIN_LABELS: Record<DesignDomain, { cn: string; en: string }> = {
  clothing: { cn: '服装', en: 'GARMENT' },
  makeup: { cn: '妆容', en: 'MAKEUP' },
  hair: { cn: '发饰', en: 'HAIR ACCESSORY' },
  architecture: { cn: '建筑', en: 'ARCHITECTURE' },
};

const BLUEPRINT_LABELS: Record<BlueprintType, { cn: string; en: string }> = {
  craft: { cn: '工艺图', en: 'CRAFT DRAWING' },
  structure: { cn: '结构分解图', en: 'STRUCTURE DIAGRAM' },
  multiview: { cn: '多视图设计图', en: 'MULTI-VIEW DESIGN' },
};

const DOMAIN_MATERIAL_LABEL: Record<DesignDomain, string> = {
  clothing: '面料',
  makeup: '色卡',
  hair: '材质',
  architecture: '材料',
};

const DOMAIN_CRAFT_LABEL: Record<DesignDomain, string> = {
  clothing: '工艺',
  makeup: '分区',
  hair: '技法',
  architecture: '构件',
};

const DOMAIN_DIM_UNIT: Record<DesignDomain, string> = {
  clothing: 'cm',
  makeup: 'cm',
  hair: 'mm',
  architecture: 'm',
};

const DOMAIN_SCALE: Record<DesignDomain, string> = {
  architecture: '1:100',
  clothing: '1:5',
  makeup: '2:1',
  hair: '1:1',
};

/** 标题栏 */
function TitleBlock({ width, height, blueprintType, domain }: { width: number; height: number; blueprintType: BlueprintType; domain: DesignDomain }) {
  const bx = width - 280;
  const by = height - 80;
  const domainLabel = DOMAIN_LABELS[domain];
  const bpLabel = BLUEPRINT_LABELS[blueprintType];
  const scale = DOMAIN_SCALE[domain];
  const unit = DOMAIN_DIM_UNIT[domain] || 'cm';

  return (
    <g>
      <rect x={bx} y={by} width={270} height={70} fill="white" stroke="#1e293b" strokeWidth={1.5} />
      <line x1={bx} y1={by + 22} x2={bx + 270} y2={by + 22} stroke="#1e293b" strokeWidth={0.8} />
      <line x1={bx} y1={by + 44} x2={bx + 270} y2={by + 44} stroke="#1e293b" strokeWidth={0.5} />
      <line x1={bx + 135} y1={by + 22} x2={bx + 135} y2={by + 70} stroke="#1e293b" strokeWidth={0.5} />
      {/* 标题 */}
      <text x={bx + 135} y={by + 15} textAnchor="middle" fill="#1e293b" fontSize={11} fontWeight={700} fontFamily="sans-serif">
        {domainLabel.cn}{bpLabel.cn} {domainLabel.en} {bpLabel.en}
      </text>
      {/* 信息行 */}
      <text x={bx + 5} y={by + 36} fill="#64748b" fontSize={8} fontFamily="sans-serif">比例 SCALE: {scale}</text>
      <text x={bx + 5} y={by + 55} fill="#64748b" fontSize={8} fontFamily="sans-serif">单位 UNIT: {unit}</text>
      <text x={bx + 140} y={by + 36} fill="#64748b" fontSize={8} fontFamily="sans-serif">日期: {new Date().toLocaleDateString('zh-CN')}</text>
      <text x={bx + 140} y={by + 55} fill="#64748b" fontSize={8} fontFamily="sans-serif">绘影工作室 HUIYING STUDIO</text>
      <text x={bx + 140} y={by + 66} fill="#94a3b8" fontSize={7} fontFamily="sans-serif">AI辅助生成 | 仅供参考</text>
    </g>
  );
}

export default function DesignBlueprintOverlay({ imageUrl, blueprintType, domain, onClose }: DesignBlueprintOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [dimensions, setDimensions] = useState<DimensionMark[]>([]);
  const [craftSymbols, setCraftSymbols] = useState<CraftSymbol[]>([]);
  const [materialNotes, setMaterialNotes] = useState<MaterialNote[]>([]);
  const [mode, setMode] = useState<'dimension' | 'craft' | 'material' | 'view'>('view');
  const [dimStart, setDimStart] = useState<{ x: number; y: number } | null>(null);
  const [dimEnd, setDimEnd] = useState<{ x: number; y: number } | null>(null);
  const [pendingDimLabel, setPendingDimLabel] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [dimInput, setDimInput] = useState('');
  const [craftType, setCraftType] = useState<string>('');
  const [materialInput, setMaterialInput] = useState('');
  const [materialColor, setMaterialColor] = useState('#8B4513');

  const craftOptions = getCraftOptions(domain);

  // 初始化工艺符号类型
  useEffect(() => {
    if (craftOptions.length > 0 && !craftType) {
      setCraftType(craftOptions[0].type);
    }
  }, [domain, craftOptions, craftType]);

  // 加载图片尺寸
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxW = 800;
      const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
      setImgSize({ w: Math.round(img.naturalWidth * scale), h: Math.round(img.naturalHeight * scale) });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // 生成默认标注（根据蓝图类型 + 领域，使用专业标准尺寸值）
  useEffect(() => {
    if (imgSize.w === 0) return;
    const { w, h } = imgSize;

    const defaultDims: DimensionMark[] = [];
    const defaultCrafts: CraftSymbol[] = [];
    const defaultMaterials: MaterialNote[] = [];

    if (domain === 'clothing') {
      if (blueprintType === 'craft') {
        defaultDims.push(
          { id: 'd1', x1: w * 0.12, y1: h * 0.05, x2: w * 0.12, y2: h * 0.92, label: '衣长 128cm' },
          { id: 'd2', x1: w * 0.25, y1: h * 0.35, x2: w * 0.75, y2: h * 0.35, label: '胸围 92cm' },
          { id: 'd3', x1: w * 0.3, y1: h * 0.45, x2: w * 0.7, y2: h * 0.45, label: '腰围 74cm' },
          { id: 'd4', x1: w * 0.25, y1: h * 0.55, x2: w * 0.75, y2: h * 0.55, label: '臀围 98cm' },
          { id: 'd5', x1: w * 0.05, y1: h * 0.22, x2: w * 0.05, y2: h * 0.55, label: '袖长 56cm' },
          { id: 'd6', x1: w * 0.82, y1: h * 0.05, x2: w * 0.82, y2: h * 0.35, label: '领深 12cm' },
        );
        defaultCrafts.push(
          { id: 'c1', x: w * 0.5, y: h * 0.3, type: 'stitch', label: '缝线' },
          { id: 'c2', x: w * 0.55, y: h * 0.5, type: 'pleat', label: '褶皱' },
          { id: 'c3', x: w * 0.4, y: h * 0.28, type: 'dart', label: '省道' },
        );
        defaultMaterials.push(
          { id: 'f1', x: w * 0.6, y: h * 0.2, label: '主面料', color: '#D4A574' },
          { id: 'f2', x: w * 0.65, y: h * 0.6, label: '里料', color: '#F5F0E8' },
        );
      } else if (blueprintType === 'structure') {
        defaultDims.push(
          { id: 'd1', x1: w * 0.2, y1: h * 0.1, x2: w * 0.2, y2: h * 0.35, label: '前片 长64cm' },
          { id: 'd2', x1: w * 0.6, y1: h * 0.1, x2: w * 0.6, y2: h * 0.35, label: '后片 长64cm' },
          { id: 'd3', x1: w * 0.1, y1: h * 0.5, x2: w * 0.1, y2: h * 0.75, label: '袖片×2 长56cm' },
          { id: 'd4', x1: w * 0.4, y1: h * 0.5, x2: w * 0.4, y2: h * 0.85, label: '裙片 长85cm' },
          { id: 'd5', x1: w * 0.7, y1: h * 0.5, x2: w * 0.7, y2: h * 0.65, label: '腰带 长180cm' },
        );
        defaultCrafts.push(
          { id: 'c1', x: w * 0.35, y: h * 0.25, type: 'stitch', label: '拼缝 1cm缝份' },
          { id: 'c2', x: w * 0.25, y: h * 0.6, type: 'gathering', label: '抽褶 3:1' },
        );
      } else if (blueprintType === 'multiview') {
        defaultDims.push(
          { id: 'd1', x1: w * 0.17, y1: h * 0.02, x2: w * 0.33, y2: h * 0.02, label: '正面 FRONT' },
          { id: 'd2', x1: w * 0.5, y1: h * 0.02, x2: w * 0.66, y2: h * 0.02, label: '侧面 SIDE' },
          { id: 'd3', x1: w * 0.83, y1: h * 0.02, x2: w * 0.98, y2: h * 0.02, label: '背面 BACK' },
          { id: 'd4', x1: w * 0.17, y1: h * 0.06, x2: w * 0.17, y2: h * 0.94, label: '128cm' },
          { id: 'd5', x1: w * 0.17, y1: h * 0.4, x2: w * 0.33, y2: h * 0.4, label: '92cm' },
        );
      }
    } else if (domain === 'makeup') {
      if (blueprintType === 'craft') {
        defaultDims.push(
          { id: 'd1', x1: w * 0.35, y1: h * 0.12, x2: w * 0.65, y2: h * 0.12, label: '眼妆区 宽8.5cm' },
          { id: 'd2', x1: w * 0.4, y1: h * 0.6, x2: w * 0.6, y2: h * 0.6, label: '唇妆区 宽3.2cm' },
          { id: 'd3', x1: w * 0.25, y1: h * 0.45, x2: w * 0.4, y2: h * 0.45, label: '腮红区' },
          { id: 'd4', x1: w * 0.5, y1: h * 0.08, x2: w * 0.5, y2: h * 0.18, label: '眉间距 3.5cm' },
        );
        defaultCrafts.push(
          { id: 'c1', x: w * 0.5, y: h * 0.2, type: 'eye_zone', label: '眼影 三段式' },
          { id: 'c2', x: w * 0.5, y: h * 0.6, type: 'lip_zone', label: '唇线 樱桃小口' },
          { id: 'c3', x: w * 0.3, y: h * 0.45, type: 'blush_zone', label: '斜扫腮红' },
          { id: 'c4', x: w * 0.6, y: h * 0.4, type: 'contour_zone', label: '侧影修容' },
          { id: 'c5', x: w * 0.45, y: h * 0.35, type: 'highlight_zone', label: 'T区高光' },
        );
        defaultMaterials.push(
          { id: 'f1', x: w * 0.78, y: h * 0.2, label: '眼影 藕粉', color: '#C4A882' },
          { id: 'f2', x: w * 0.78, y: h * 0.55, label: '唇脂 朱红', color: '#C41E3A' },
          { id: 'f3', x: w * 0.15, y: h * 0.45, label: '胭脂 桃红', color: '#F472B6' },
          { id: 'f4', x: w * 0.15, y: h * 0.15, label: '铅粉 白', color: '#FEFCE8' },
        );
      } else if (blueprintType === 'structure') {
        defaultDims.push(
          { id: 'd1', x1: w * 0.1, y1: h * 0.05, x2: w * 0.1, y2: h * 0.92, label: '①底妆层' },
          { id: 'd2', x1: w * 0.3, y1: h * 0.05, x2: w * 0.3, y2: h * 0.92, label: '②修容层' },
          { id: 'd3', x1: w * 0.5, y1: h * 0.05, x2: w * 0.5, y2: h * 0.92, label: '③眼妆层' },
          { id: 'd4', x1: w * 0.7, y1: h * 0.05, x2: w * 0.7, y2: h * 0.92, label: '④唇妆层' },
          { id: 'd5', x1: w * 0.9, y1: h * 0.05, x2: w * 0.9, y2: h * 0.92, label: '⑤完成效果' },
        );
      }
    } else if (domain === 'hair') {
      if (blueprintType === 'craft') {
        defaultDims.push(
          { id: 'd1', x1: w * 0.12, y1: h * 0.1, x2: w * 0.12, y2: h * 0.85, label: '全长 185mm' },
          { id: 'd2', x1: w * 0.25, y1: h * 0.3, x2: w * 0.75, y2: h * 0.3, label: '冠宽 65mm' },
          { id: 'd3', x1: w * 0.85, y1: h * 0.3, x2: w * 0.85, y2: h * 0.5, label: '簪针 长80mm' },
          { id: 'd4', x1: w * 0.3, y1: h * 0.6, x2: w * 0.7, y2: h * 0.6, label: '花头 Φ42mm' },
        );
        defaultCrafts.push(
          { id: 'c1', x: w * 0.5, y: h * 0.35, type: 'filigree', label: '花丝 Φ0.3mm' },
          { id: 'c2', x: w * 0.4, y: h * 0.6, type: 'inlay', label: '镶嵌 爪镶' },
          { id: 'c3', x: w * 0.6, y: h * 0.7, type: 'chain', label: '链坠 5节' },
        );
        defaultMaterials.push(
          { id: 'f1', x: w * 0.78, y: h * 0.25, label: '足金 Au999', color: '#D4A574' },
          { id: 'f2', x: w * 0.78, y: h * 0.5, label: '和田玉', color: '#E8F0E8' },
          { id: 'f3', x: w * 0.78, y: h * 0.75, label: '珍珠 Φ8mm', color: '#F5F0E8' },
        );
      } else if (blueprintType === 'structure') {
        defaultDims.push(
          { id: 'd1', x1: w * 0.2, y1: h * 0.1, x2: w * 0.2, y2: h * 0.35, label: '簪体 L=80mm' },
          { id: 'd2', x1: w * 0.5, y1: h * 0.1, x2: w * 0.5, y2: h * 0.35, label: '花头 Φ42mm' },
          { id: 'd3', x1: w * 0.2, y1: h * 0.55, x2: w * 0.2, y2: h * 0.8, label: '流苏 L=120mm' },
          { id: 'd4', x1: w * 0.5, y1: h * 0.55, x2: w * 0.5, y2: h * 0.8, label: '珠翠 Φ15mm' },
          { id: 'd5', x1: w * 0.75, y1: h * 0.1, x2: w * 0.75, y2: h * 0.35, label: '点翠面 18×12mm' },
        );
        defaultCrafts.push(
          { id: 'c1', x: w * 0.35, y: h * 0.25, type: 'pin', label: '簪针 Φ1.5mm' },
          { id: 'c2', x: w * 0.65, y: h * 0.65, type: 'chain', label: '链坠 5节' },
        );
      }
    } else if (domain === 'architecture') {
      if (blueprintType === 'craft') {
        defaultDims.push(
          { id: 'd1', x1: w * 0.08, y1: h * 0.05, x2: w * 0.08, y2: h * 0.92, label: '总高 12.60m' },
          { id: 'd2', x1: w * 0.2, y1: h * 0.88, x2: w * 0.8, y2: h * 0.88, label: '面阔五间 18.00m' },
          { id: 'd3', x1: w * 0.85, y1: h * 0.05, x2: w * 0.85, y2: h * 0.35, label: '柱高 5.20m' },
          { id: 'd4', x1: w * 0.85, y1: h * 0.35, x2: w * 0.85, y2: h * 0.52, label: '斗拱高 1.80m' },
          { id: 'd5', x1: w * 0.85, y1: h * 0.52, x2: w * 0.85, y2: h * 0.78, label: '屋顶高 3.60m' },
          { id: 'd6', x1: w * 0.2, y1: h * 0.78, x2: w * 0.8, y2: h * 0.78, label: '台基宽 20.00m' },
          { id: 'd7', x1: w * 0.92, y1: h * 0.78, x2: w * 0.92, y2: h * 0.92, label: '台基高 1.20m' },
        );
        defaultCrafts.push(
          { id: 'c1', x: w * 0.5, y: h * 0.42, type: 'bracket', label: '斗拱 七踩' },
          { id: 'c2', x: w * 0.3, y: h * 0.75, type: 'pillar', label: '檐柱 Φ450mm' },
          { id: 'c3', x: w * 0.7, y: h * 0.75, type: 'pillar', label: '金柱 Φ520mm' },
        );
        defaultMaterials.push(
          { id: 'f1', x: w * 0.6, y: h * 0.15, label: '楠木构件', color: '#C4A882' },
          { id: 'f2', x: w * 0.6, y: h * 0.48, label: '琉璃瓦', color: '#4ADE80' },
          { id: 'f3', x: w * 0.6, y: h * 0.82, label: '花岗石基', color: '#9CA3AF' },
        );
      } else if (blueprintType === 'structure') {
        defaultDims.push(
          { id: 'd1', x1: w * 0.15, y1: h * 0.08, x2: w * 0.15, y2: h * 0.28, label: '屋顶 高3.60m' },
          { id: 'd2', x1: w * 0.5, y1: h * 0.08, x2: w * 0.5, y2: h * 0.28, label: '斗拱层 高1.80m' },
          { id: 'd3', x1: w * 0.15, y1: h * 0.38, x2: w * 0.15, y2: h * 0.68, label: '柱网 高5.20m' },
          { id: 'd4', x1: w * 0.5, y1: h * 0.38, x2: w * 0.5, y2: h * 0.68, label: '墙体 厚600mm' },
          { id: 'd5', x1: w * 0.15, y1: h * 0.76, x2: w * 0.15, y2: h * 0.92, label: '台基 高1.20m' },
          { id: 'd6', x1: w * 0.75, y1: h * 0.08, x2: w * 0.75, y2: h * 0.28, label: '瓦作 层数9' },
          { id: 'd7', x1: w * 0.75, y1: h * 0.38, x2: w * 0.75, y2: h * 0.68, label: '门窗 隔扇' },
        );
        defaultCrafts.push(
          { id: 'c1', x: w * 0.35, y: h * 0.2, type: 'bracket', label: '斗拱 七踩三翘' },
          { id: 'c2', x: w * 0.7, y: h * 0.55, type: 'joint', label: '榫卯 透榫' },
        );
      } else if (blueprintType === 'multiview') {
        defaultDims.push(
          { id: 'd1', x1: w * 0.12, y1: h * 0.02, x2: w * 0.28, y2: h * 0.02, label: '正立面 FRONT' },
          { id: 'd2', x1: w * 0.38, y1: h * 0.02, x2: w * 0.54, y2: h * 0.02, label: '侧立面 SIDE' },
          { id: 'd3', x1: w * 0.62, y1: h * 0.02, x2: w * 0.78, y2: h * 0.02, label: '剖面 SECTION' },
          { id: 'd4', x1: w * 0.82, y1: h * 0.02, x2: w * 0.98, y2: h * 0.02, label: '平面 PLAN' },
          { id: 'd5', x1: w * 0.12, y1: h * 0.06, x2: w * 0.12, y2: h * 0.94, label: 'H=12.60m' },
          { id: 'd6', x1: w * 0.38, y1: h * 0.06, x2: w * 0.38, y2: h * 0.94, label: 'H=12.60m' },
        );
      }
    }

    setDimensions(defaultDims);
    setCraftSymbols(defaultCrafts);
    setMaterialNotes(defaultMaterials);
  }, [imgSize, blueprintType, domain]);

  // SVG坐标转换
  const getSvgPoint = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = imgSize.w / rect.width;
    const scaleY = imgSize.h / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, [imgSize]);

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (mode === 'craft') {
      const pt = getSvgPoint(e);
      setCraftSymbols(prev => [...prev, {
        id: `c${Date.now()}`,
        x: pt.x,
        y: pt.y,
        type: craftType,
        label: '',
      }]);
    } else if (mode === 'material') {
      const pt = getSvgPoint(e);
      setMaterialNotes(prev => [...prev, {
        id: `f${Date.now()}`,
        x: pt.x,
        y: pt.y,
        label: materialInput || DOMAIN_MATERIAL_LABEL[domain],
        color: materialColor,
      }]);
    } else if (mode === 'dimension' && !dimStart) {
      const pt = getSvgPoint(e);
      setDimStart(pt);
    } else if (mode === 'dimension' && dimStart) {
      const pt = getSvgPoint(e);
      setDimEnd(pt);
      setPendingDimLabel({ x1: dimStart.x, y1: dimStart.y, x2: pt.x, y2: pt.y });
      setDimInput('');
      setDimStart(null);
      setDimEnd(null);
    }
  }, [mode, craftType, materialInput, materialColor, dimStart, getSvgPoint, domain]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (mode === 'dimension' && dimStart) {
      setDimEnd(getSvgPoint(e));
    }
  }, [mode, dimStart, getSvgPoint]);

  const confirmDimension = useCallback(() => {
    if (pendingDimLabel) {
      setDimensions(prev => [...prev, {
        id: `d${Date.now()}`,
        ...pendingDimLabel,
        label: dimInput || '尺寸',
      }]);
      setPendingDimLabel(null);
      setDimInput('');
    }
  }, [pendingDimLabel, dimInput]);

  const domainLabel = DOMAIN_LABELS[domain];
  const bpLabel = BLUEPRINT_LABELS[blueprintType];
  const materialLabel = DOMAIN_MATERIAL_LABEL[domain];
  const craftLabel = DOMAIN_CRAFT_LABEL[domain];

  const TOOL_MODES: { id: 'view' | 'dimension' | 'craft' | 'material'; label: string; icon: string }[] = [
    { id: 'view', label: '查看', icon: '👁' },
    { id: 'dimension', label: '尺寸', icon: '📏' },
    { id: 'craft', label: craftLabel, icon: domain === 'makeup' ? '💄' : domain === 'hair' ? '📿' : domain === 'architecture' ? '🏛️' : '✂' },
    { id: 'material', label: materialLabel, icon: domain === 'makeup' ? '🎨' : domain === 'architecture' ? '🧱' : '🧵' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f0f4f8]">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-3 px-4 h-12 bg-white border-b border-slate-200 shrink-0">
        <button onClick={onClose} className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1">
          ← 返回
        </button>
        <div className="w-px h-5 bg-slate-200" />
        <span className="text-sm font-semibold text-slate-800">
          {domainLabel.cn}{bpLabel.cn}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">设计图纸</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">{domainLabel.cn}</span>

        <div className="flex-1" />

        {/* 模式切换 */}
        <div className="flex gap-1">
          {TOOL_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setDimStart(null); setDimEnd(null); }}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                mode === m.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 子工具栏 — 工艺/分区/技法/构件 */}
      {mode === 'craft' && (
        <div className="flex items-center gap-2 px-4 h-10 bg-slate-50 border-b border-slate-200 shrink-0">
          <span className="text-xs text-slate-500">{craftLabel}符号：</span>
          {craftOptions.map(opt => (
            <button
              key={opt.type}
              onClick={() => setCraftType(opt.type)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                craftType === opt.type ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="text-[10px] text-slate-400 ml-2">点击图片添加符号</span>
        </div>
      )}

      {/* 子工具栏 — 面料/色卡/材质/材料 */}
      {mode === 'material' && (
        <div className="flex items-center gap-2 px-4 h-10 bg-slate-50 border-b border-slate-200 shrink-0">
          <span className="text-xs text-slate-500">{materialLabel}：</span>
          <input
            value={materialInput}
            onChange={e => setMaterialInput(e.target.value)}
            placeholder={`${materialLabel}名称`}
            className="w-24 h-6 px-2 text-xs border border-slate-300 rounded"
          />
          <input
            type="color"
            value={materialColor}
            onChange={e => setMaterialColor(e.target.value)}
            className="w-6 h-6 border border-slate-300 rounded cursor-pointer"
          />
          <span className="text-[10px] text-slate-400 ml-2">点击图片添加标注</span>
        </div>
      )}

      {/* 子工具栏 — 尺寸绘制提示 */}
      {mode === 'dimension' && (
        <div className="flex items-center gap-2 px-4 h-10 bg-slate-50 border-b border-slate-200 shrink-0">
          <span className="text-[10px] text-slate-500">
            {dimStart ? '点击终点位置' : '点击起点位置'}
          </span>
        </div>
      )}

      {/* 主画布区域 */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-[#e2e8f0]" ref={containerRef}>
        {imgSize.w > 0 ? (
          <div className="relative shadow-2xl bg-white" style={{ width: imgSize.w, height: imgSize.h }}>
            {/* 图片层 */}
            <img
              src={imageUrl}
              alt="设计底图"
              crossOrigin="anonymous"
              style={{ width: imgSize.w, height: imgSize.h }}
              className="block"
            />
            {/* SVG叠加层 */}
            <svg
              ref={svgRef}
              width={imgSize.w}
              height={imgSize.h}
              className="absolute inset-0"
              style={{ cursor: mode === 'view' ? 'default' : 'crosshair' }}
              onClick={handleSvgClick}
              onMouseMove={handleMouseMove}
            >
              {/* 蓝图边框 */}
              <rect x={2} y={2} width={imgSize.w - 4} height={imgSize.h - 4} fill="none" stroke="#1e293b" strokeWidth={1.5} rx={1} />
              {/* 十字中心标记 */}
              <line x1={imgSize.w / 2 - 10} y1={imgSize.h / 2} x2={imgSize.w / 2 + 10} y2={imgSize.h / 2} stroke="#cbd5e1" strokeWidth={0.4} />
              <line x1={imgSize.w / 2} y1={imgSize.h / 2 - 10} x2={imgSize.w / 2} y2={imgSize.h / 2 + 10} stroke="#cbd5e1" strokeWidth={0.4} />

              {/* 尺寸标注线 */}
              {dimensions.map(d => <DimensionLineSvg key={d.id} dim={d} />)}

              {/* 正在绘制的尺寸线 */}
              {dimStart && dimEnd && (
                <line x1={dimStart.x} y1={dimStart.y} x2={dimEnd.x} y2={dimEnd.y} stroke="#2563eb" strokeWidth={1} strokeDasharray="4,4" />
              )}

              {/* 工艺/分区/技法/构件符号 */}
              {craftSymbols.map(s => <CraftSymbolSvgRenderer key={s.id} type={s.type} x={s.x} y={s.y} domain={domain} />)}

              {/* 材料/面料/色卡标注 */}
              {materialNotes.map(n => <MaterialNoteSvg key={n.id} note={n} domain={domain} />)}

              {/* 标题栏 */}
              <TitleBlock width={imgSize.w} height={imgSize.h} blueprintType={blueprintType} domain={domain} />
            </svg>
          </div>
        ) : (
          <div className="text-slate-400 text-sm">加载中...</div>
        )}
      </div>

      {/* 尺寸输入弹窗 */}
      {pendingDimLabel && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-4 w-64">
            <div className="text-sm font-semibold text-slate-800 mb-2">输入尺寸标注</div>
            <input
              value={dimInput}
              onChange={e => setDimInput(e.target.value)}
              placeholder={`例如: 120${DOMAIN_DIM_UNIT[domain]} / 胸围 88${DOMAIN_DIM_UNIT[domain]}`}
              className="w-full h-8 px-3 text-sm border border-slate-300 rounded mb-3"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') confirmDimension(); }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setPendingDimLabel(null); setDimInput(''); }} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded">取消</button>
              <button onClick={confirmDimension} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">确认</button>
            </div>
          </div>
        </div>
      )}

      {/* 底部信息 */}
      <div className="flex items-center gap-4 px-4 h-8 bg-white border-t border-slate-200 shrink-0">
        <span className="text-[10px] text-slate-400">
          标注数: {dimensions.length} | {craftLabel}符号: {craftSymbols.length} | {materialLabel}: {materialNotes.length}
        </span>
        <div className="flex-1" />
        <span className="text-[10px] text-slate-400">{domainLabel.cn}{bpLabel.cn} · AI辅助生成 · 仅供参考 · {domain === 'architecture' ? '尺寸需实际测量确认' : domain === 'makeup' ? '色号以实物为准' : '尺寸需实际测量确认'}</span>
      </div>
    </div>
  );
}
