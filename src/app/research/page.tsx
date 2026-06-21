'use client';

import { useState } from 'react';
import {
  Trophy,
  Zap,
  DollarSign,
  Clock,
  Shield,
  Star,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MonitorPlay,
  Users,
  Target,
  TrendingUp,
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Info,
  Cpu,
  GitBranch,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ── 平台排名数据 ─────────────────────────────
const PLATFORM_RANKING = [
  {
    rank: 1,
    name: 'Kling 2.6',
    vendor: '快手',
    overallScore: 92,
    scores: { quality: 95, consistency: 94, motion: 90, speed: 85, cost: 88 },
    badge: '首选·人物类',
    badgeColor: 'bg-red-500',
    highlights: ['人物一致性行业领先', '首尾帧控制精准', '720p/1080p/4K全支持', '运动笔刷控制运镜'],
    limit: '单次最长10s(Pro)/5s(标准)',
    pricing: '标准 ¥3.5/5s | Pro ¥7/10s',
    bestFor: '人物对话、时尚穿搭、角色叙事',
  },
  {
    rank: 2,
    name: 'Runway Gen-4',
    vendor: 'Runway',
    overallScore: 89,
    scores: { quality: 92, consistency: 88, motion: 90, speed: 82, cost: 80 },
    badge: '首选·场景类',
    badgeColor: 'bg-amber-500',
    highlights: ['场景一致性最强', '参考图+参考帧双控制', '动作笔刷运镜', '流体/粒子特效优秀'],
    limit: '单次最长16s',
    pricing: '$0.50/5s | $1.60/16s',
    bestFor: '建筑空间、自然场景、特效镜头',
  },
  {
    rank: 3,
    name: 'Veo 3.1',
    vendor: 'Google',
    overallScore: 87,
    scores: { quality: 94, consistency: 85, motion: 88, speed: 78, cost: 72 },
    badge: '首选·物理真实',
    badgeColor: 'bg-blue-500',
    highlights: ['物理真实性最强', '8s/16s/30s多种时长', '4K输出', '音频生成联动'],
    limit: '单次最长30s',
    pricing: '$0.50/8s | $1.00/16s',
    bestFor: '真实物理场景、长镜头、纪录片',
  },
  {
    rank: 4,
    name: 'Seedance 2.0 Pro',
    vendor: '字节跳动',
    overallScore: 85,
    scores: { quality: 88, consistency: 86, motion: 84, speed: 88, cost: 90 },
    badge: '性价比之王',
    badgeColor: 'bg-green-500',
    highlights: ['性价比最高', '首尾帧+参考帧三控', '中文提示词理解优秀', '生成速度快'],
    limit: '单次最长10s',
    pricing: '¥2/5s | ¥4/10s',
    bestFor: '批量生成、快速迭代、中文创作',
  },
  {
    rank: 5,
    name: 'Luma Dream Machine',
    vendor: 'Luma AI',
    overallScore: 82,
    scores: { quality: 85, consistency: 80, motion: 82, speed: 84, cost: 85 },
    badge: '运镜之王',
    badgeColor: 'bg-purple-500',
    highlights: ['运镜控制最灵活', 'Ray2模型画质好', 'Camera Motion精确控制', 'API稳定'],
    limit: '单次最长10s',
    pricing: '$0.40/5s | $0.80/10s',
    bestFor: '航拍运镜、环绕镜头、电影感',
  },
  {
    rank: 6,
    name: 'Open-Sora 2.0',
    vendor: 'HPC-AI Tech (开源)',
    overallScore: 81,
    scores: { quality: 83, consistency: 76, motion: 82, speed: 80, cost: 95 },
    badge: '开源标杆',
    badgeColor: 'bg-emerald-600',
    highlights: ['完全开源可部署', 'T2I2V两阶段管线', 'Motion Score运动评估', 'VBench综合79.5', 'FP8量化推理加速'],
    limit: '单次最长~5s (4s/16f@720p)',
    pricing: '自部署仅算力成本(约¥0.5-1/次)',
    bestFor: '私有化部署、研究实验、定制化管线',
  },
  {
    rank: 7,
    name: 'Vidu 2.0',
    vendor: '生数科技',
    overallScore: 80,
    scores: { quality: 82, consistency: 78, motion: 80, speed: 86, cost: 88 },
    badge: '国产生力军',
    badgeColor: 'bg-cyan-500',
    highlights: ['角色参考能力强', '4s/8s快速模式', '中文语义理解好', '价格实惠'],
    limit: '单次最长8s',
    pricing: '¥2/4s | ¥4/8s',
    bestFor: '角色短视频、快速预览、国产替代',
  },
];

// ── 能力矩阵 ─────────────────────────────
const CAPABILITY_DIMENSIONS = [
  { key: 'image_ref', label: '图片参考', icon: '🖼️' },
  { key: 'video_ref', label: '视频参考', icon: '🎬' },
  { key: 'first_last_frame', label: '首尾帧控制', icon: '↕️' },
  { key: 'camera_motion', label: '运镜控制', icon: '🎥' },
  { key: 'motion_brush', label: '运动笔刷', icon: '🖌️' },
  { key: 'character_consistency', label: '人物一致性', icon: '👤' },
  { key: 'scene_consistency', label: '场景一致性', icon: '🏠' },
  { key: 'audio_gen', label: '音频生成', icon: '🔊' },
  { key: 'long_duration', label: '长时长(≥15s)', icon: '⏱️' },
  { key: '4k_output', label: '4K输出', icon: '📺' },
  { key: 'api_stability', label: 'API稳定性', icon: '🛡️' },
  { key: 'cn_prompt', label: '中文提示', icon: '🇨🇳' },
] as const;

type CapKey = (typeof CAPABILITY_DIMENSIONS)[number]['key'];

const CAPABILITY_MATRIX: Record<string, Record<CapKey, 'full' | 'partial' | 'none'>> = {
  'Kling 2.6': {
    image_ref: 'full', video_ref: 'full', first_last_frame: 'full', camera_motion: 'full',
    motion_brush: 'full', character_consistency: 'full', scene_consistency: 'partial',
    audio_gen: 'none', long_duration: 'partial', '4k_output': 'full',
    api_stability: 'full', cn_prompt: 'full',
  },
  'Runway Gen-4': {
    image_ref: 'full', video_ref: 'full', first_last_frame: 'full', camera_motion: 'full',
    motion_brush: 'full', character_consistency: 'partial', scene_consistency: 'full',
    audio_gen: 'none', long_duration: 'full', '4k_output': 'partial',
    api_stability: 'full', cn_prompt: 'partial',
  },
  'Veo 3.1': {
    image_ref: 'full', video_ref: 'partial', first_last_frame: 'partial', camera_motion: 'partial',
    motion_brush: 'none', character_consistency: 'partial', scene_consistency: 'full',
    audio_gen: 'full', long_duration: 'full', '4k_output': 'full',
    api_stability: 'partial', cn_prompt: 'partial',
  },
  'Seedance 2.0': {
    image_ref: 'full', video_ref: 'full', first_last_frame: 'full', camera_motion: 'partial',
    motion_brush: 'none', character_consistency: 'partial', scene_consistency: 'partial',
    audio_gen: 'none', long_duration: 'partial', '4k_output': 'none',
    api_stability: 'full', cn_prompt: 'full',
  },
  'Luma Dream Machine': {
    image_ref: 'full', video_ref: 'full', first_last_frame: 'full', camera_motion: 'full',
    motion_brush: 'none', character_consistency: 'partial', scene_consistency: 'partial',
    audio_gen: 'none', long_duration: 'partial', '4k_output': 'none',
    api_stability: 'full', cn_prompt: 'partial',
  },
  'Open-Sora 2.0': {
    image_ref: 'full', video_ref: 'partial', first_last_frame: 'partial', camera_motion: 'partial',
    motion_brush: 'none', character_consistency: 'none', scene_consistency: 'none',
    audio_gen: 'none', long_duration: 'none', '4k_output': 'none',
    api_stability: 'partial', cn_prompt: 'partial',
  },
  'Vidu 2.0': {
    image_ref: 'full', video_ref: 'partial', first_last_frame: 'partial', camera_motion: 'partial',
    motion_brush: 'none', character_consistency: 'full', scene_consistency: 'partial',
    audio_gen: 'none', long_duration: 'none', '4k_output': 'none',
    api_stability: 'partial', cn_prompt: 'full',
  },
};

// ── 生产管线 ─────────────────────────────
const PIPELINE_STEPS = [
  {
    step: 1,
    title: '预生产·圣经资产',
    subtitle: 'Bible-Driven Pre-Production',
    icon: '📜',
    color: 'red',
    description: '角色圣经 + 场景圣经 + 镜头表，确保全片一致性',
    details: [
      '角色圣经(Character Bible): 面部锚点/体型/标识 → 多镜头统一',
      '场景圣经(Scene Bible): 光照/色板/氛围 → 空间连续性',
      '镜头表(Shot List): 运镜/时长/转场 → 导演蓝图',
      '输出: JSON格式的可编程资产，直接传入下游',
    ],
    output: 'character_bible.json + scene_bible.json + shot_list.json',
  },
  {
    step: 2,
    title: '关键帧生成',
    subtitle: 'Keyframe Generation',
    icon: '🖼️',
    color: 'amber',
    description: '基于圣经资产生成首帧/末帧参考图，控制构图与人物',
    details: [
      '从角色圣经提取 visual_anchors → 生成人物参考图',
      '从场景圣经提取 lighting/color → 生成场景参考图',
      '使用 LoRA / IP-Adapter 锚定角色面部',
      '首帧→末帧构图一致性检查(构图/比例/光源方向)',
    ],
    output: 'first_frame.png + last_frame.png per shot',
  },
  {
    step: 3,
    title: '视频片段生成',
    subtitle: 'Video Segment Generation',
    icon: '🎬',
    color: 'blue',
    description: '首尾帧驱动 + 运镜参数 → AI视频生成，按平台最优策略分配',
    details: [
      '人物镜头 → Kling 2.6 (人物一致性最优)',
      '场景镜头 → Seedance 2.0 / Runway Gen-4',
      '物理真实 → Veo 3.1 (流体/碰撞/光影)',
      '运镜复杂 → Luma (Camera Motion控制)',
      '每段视频附加 motion_brush / camera_motion 参数',
    ],
    output: 'shot_001.mp4 ~ shot_NNN.mp4',
  },
  {
    step: 4,
    title: '组装与后处理',
    subtitle: 'Assembly & Post-Processing',
    icon: '🔧',
    color: 'green',
    description: '视频拼接 + 转场 + 音频 + 字幕，输出粗剪版本',
    details: [
      '按镜头表顺序拼接: shot_001 → shot_002 → ...',
      '转场: 硬切/叠化/运动模糊/故障风(按叙事模板)',
      '音频: BGM + 环境音 + 对白(TTS) + 音效',
      '字幕: SRT生成 + 样式渲染',
    ],
    output: 'rough_cut_v1.mp4 + subtitles.srt',
  },
  {
    step: 5,
    title: '质量门控与迭代',
    subtitle: 'Q-CHECK Gate & Iteration',
    icon: '✅',
    color: 'purple',
    description: '自动化质检 + 人工复审，不合格镜头自动重生成',
    details: [
      'Q-CHECK 1: 人物一致性 (面部/服装/配饰跨镜头对比)',
      'Q-CHECK 2: 场景连续性 (光源/色调/空间逻辑)',
      'Q-CHECK 3: 技术质量 (分辨率/帧率/编码/音频同步)',
      '不合格 → 标注问题 → 调整参数 → 重新生成',
      '迭代上限: 3次自动重试 → 人工介入',
    ],
    output: 'final_cut.mp4 + qa_report.json',
  },
];

// ── 人物一致性方法论 ─────────────────────────────
const CONSISTENCY_METHODS = [
  {
    method: 'Visual Anchor (视觉锚点)',
    description: '为每个角色建立固定的视觉特征描述，生成时强制注入',
    details: [
      '面部: 5-8个锚点描述(脸型/眉眼/鼻唇/肤色/标识)',
      '体型: 身高/体态/比例 → 生成时固定 seed + ref_image',
      '配饰: 首饰/纹身/疤痕 → 跨镜头一致性检查项',
    ],
    priority: 'P0',
  },
  {
    method: 'FLF2V 首尾帧锚定 (Wan2.1)',
    description: '通过首帧+尾帧双锚点控制视频方向，实现最强人物一致性',
    details: [
      '首帧: 文本→图片锁定角色外观、场景布局、光影基调',
      '尾帧: 首帧+运动描述→尾帧，确保动作终态一致性',
      'FLF2V: 双锚点生成自然过渡视频，一致性~85%',
      '来源: Wan2.1 first_last_frame2video 模块',
    ],
    priority: 'P0',
  },
  {
    method: 'Grid Prompt 一致性注入 (huobao)',
    description: '网格提示词生成器，3种参考模式自动注入角色描述',
    details: [
      'first_frame: 首帧参考模式，以首帧图片为起点',
      'first_last_frame: 首尾帧参考模式，起止点一致性',
      'multi_ref: 多参考图模式，角色+场景全局约束',
      '自动拼接一致性注入片段到提示词',
    ],
    priority: 'P0',
  },
  {
    method: 'Reference Image Chain (参考图链)',
    description: '每个镜头的生成以上一个镜头的输出帧为参考',
    details: [
      'shot_001 首帧 → 角色圣经图',
      'shot_001 末帧 → shot_002 首帧参考',
      'shot_002 末帧 → shot_003 首帧参考',
      '形成视觉信息的"接力传递"',
    ],
    priority: 'P1',
  },
  {
    method: 'Wardrobe Lock (穿搭锁定)',
    description: '场景圣经中锁定角色的穿搭方案，禁止跨场景随意变化',
    details: [
      '同一场景内: 服装/配饰/妆容必须一致',
      '场景切换: 允许换装但需在圣经中预定义',
      '颜色校准: 生成后自动做色彩一致性检查',
    ],
    priority: 'P1',
  },
  {
    method: 'Post-QC Consistency Check (后置一致性校验)',
    description: '跨镜头自动检查面部/服装/发型/配饰/光线/道具一致性',
    details: [
      '10种一致性检查项: 面部/服装/发型/配饰/位置/光线/道具/颜色/连续性/比例',
      '3级严重度: critical(必须修复) / warning(建议修复) / info(仅标记)',
      '自动生成修复建议和重生成提示词',
      '来源: huobao 连贯性体系 + NarratoAI 剪辑分析',
    ],
    priority: 'P2(兜底)',
  },
];

// ── Open-Sora 2.0 架构数据 ─────────────────────────────
const OPEN_SORA_ARCH = {
  modelBackbone: 'MMDiT (Multi-Modal Diffusion Transformer)',
  vae: '3D-VAE (4×8×8 spatial-temporal compression)',
  textEncoder: 'T5-XXL (4.6B params)',
  paramCount: '1.1B (DiT) + 4.6B (T5) + 0.3B (VAE) ≈ 6B total',
  trainingData: 'CC12M + Internal video datasets',
  vbenchScore: 79.5,
  vbenchRank: 'Top 30% on VBench',
  keyInnovations: [
    {
      title: 'T2I2V 两阶段管线',
      desc: '先文生图(T2I)再图生视频(I2V)，图片作为中间锚点提升视觉质量与构图控制',
      benefit: '画面构图更可控，首帧质量更高，比端到端T2V提升显著',
    },
    {
      title: 'Motion Score 运动评估',
      desc: '基于光流估计的视频运动幅度量化评分(0-1)，自动过滤静止帧和过度抖动',
      benefit: '自动淘汰低质量输出，减少人工筛选成本',
    },
    {
      title: 'Prompt Refine 提示词精炼',
      desc: 'T5编码前自动补全运动/相机/光照描述，区分T2V/I2V/T2I三种模式',
      benefit: '提升用户简短提示词的生成质量，无需专业提示词技巧',
    },
    {
      title: 'FP8 量化推理',
      desc: '8-bit浮点推理加速，显存降低50%，推理速度提升1.5×',
      benefit: '消费级GPU(24GB)即可运行720p推理',
    },
    {
      title: 'Bucket 分桶训练',
      desc: '按分辨率+时长+宽高比分桶，每个bucket独立训练，支持任意分辨率输入',
      benefit: '适配多种创作场景(竖屏/横屏/方形)，无需统一裁剪',
    },
    {
      title: '3D-VAE 时空压缩',
      desc: '4倍时间+8倍空间联合压缩，潜在空间维度大幅降低',
      benefit: '显存占用降低，训练与推理效率显著提升',
    },
  ],
  t2i2vPipeline: [
    { step: 1, title: 'Prompt Refine', desc: '输入提示词 → T5编码前自动补全运动/相机/光照描述' },
    { step: 2, title: 'T2I 生成首帧', desc: '文本→图片生成，确保构图与主体质量' },
    { step: 3, title: 'Aesthetic Score 过滤', desc: '对首帧图片进行美学评分，低分重试' },
    { step: 4, title: 'I2V 生成视频', desc: '首帧图片+精炼提示词→视频扩散生成' },
    { step: 5, title: 'Motion Score 过滤', desc: '评估视频运动幅度，过滤静止/抖动结果' },
  ],
  vbenchBreakdown: [
    { category: 'Subject Consistency', score: 87.2 },
    { category: 'Background Consistency', score: 83.5 },
    { category: 'Motion Smoothness', score: 92.1 },
    { category: 'Dynamic Degree', score: 68.4 },
    { category: 'Aesthetic Quality', score: 78.6 },
    { category: 'Imaging Quality', score: 81.3 },
    { category: 'Object Class', score: 85.7 },
    { category: 'Multiple Objects', score: 62.8 },
    { category: 'Human Action', score: 74.5 },
    { category: 'Spatial Relationship', score: 70.2 },
    { category: 'Scene', score: 79.1 },
    { category: 'Appearance Style', score: 82.4 },
  ],
  costAnalysis: {
    inference: {
      '720p·4s·FP16': { gpu: 'A100 80G', time: '~3min', costPerRun: '¥1.5' },
      '720p·4s·FP8': { gpu: 'A100 40G', time: '~2min', costPerRun: '¥0.8' },
      '480p·2s·FP16': { gpu: 'RTX 4090 24G', time: '~1min', costPerRun: '¥0.3' },
    },
    comparison: '比商业API低60-80%成本，但画质与一致性差距明显',
  },
};

export default function ResearchPage() {
  const router = useRouter();
  const [expandedRank, setExpandedRank] = useState<number | null>(1);
  const [expandedStep, setExpandedStep] = useState<number | null>(1);
  const [activeTab, setActiveTab] = useState<'ranking' | 'matrix' | 'pipeline' | 'consistency' | 'opensora' | 'wan21'>('ranking');

  const capIcon = (level: 'full' | 'partial' | 'none') => {
    if (level === 'full') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (level === 'partial') return <AlertCircle className="w-4 h-4 text-amber-500" />;
    return <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />;
  };

  const scoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 80) return 'text-amber-500';
    return 'text-red-500';
  };

  const stepColorMap: Record<string, string> = {
    red: 'bg-red-500/10 border-red-500/30 text-red-500',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
    green: 'bg-green-500/10 border-green-500/30 text-green-500',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-500',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回主页面
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-7 h-7 text-red-500" />
            <h1 className="text-2xl font-bold text-foreground">AIGC 长视频平台研究</h1>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-500">
              2026.06
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            7大视频生成平台深度评测 · 能力矩阵对比 · 生产管线设计 · 人物一致性方法论 · Open-Sora开源架构 · Wan2.1人物一致性
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border bg-card/80 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {[
              { key: 'ranking' as const, label: '平台排名', icon: Trophy },
              { key: 'matrix' as const, label: '能力矩阵', icon: Layers },
              { key: 'pipeline' as const, label: '生产管线', icon: Zap },
              { key: 'consistency' as const, label: '人物一致性', icon: Users },
              { key: 'opensora' as const, label: 'Open-Sora 架构', icon: Cpu },
              { key: 'wan21' as const, label: 'Wan 2.1 人物', icon: Users },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-red-500 text-red-500'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* ── 平台排名 Tab ── */}
        {activeTab === 'ranking' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">平台优先级排名</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  基于画质、一致性、运动控制、速度、成本五维评分（共7大平台）
                </p>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> ≥90 优秀</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 80-89 良好</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> &lt;80 一般</span>
              </div>
            </div>

            {PLATFORM_RANKING.map((platform) => (
              <div
                key={platform.rank}
                className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* 主行 */}
                <button
                  className="w-full px-6 py-4 flex items-center gap-4 text-left"
                  onClick={() => setExpandedRank(expandedRank === platform.rank ? null : platform.rank)}
                >
                  {/* 排名 */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                    platform.rank === 1 ? 'bg-red-500 text-white' :
                    platform.rank === 2 ? 'bg-amber-500 text-white' :
                    platform.rank === 3 ? 'bg-blue-500 text-white' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {platform.rank}
                  </div>

                  {/* 平台名+badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{platform.name}</span>
                      <span className="text-xs text-muted-foreground">({platform.vendor})</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${platform.badgeColor}`}>
                        {platform.badge}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{platform.bestFor}</div>
                  </div>

                  {/* 综合评分 */}
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${scoreColor(platform.overallScore)}`}>
                      {platform.overallScore}
                    </span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>

                  {/* 展开图标 */}
                  {expandedRank === platform.rank ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>

                {/* 展开详情 */}
                {expandedRank === platform.rank && (
                  <div className="px-6 pb-6 border-t border-border/50 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* 五维评分 */}
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-3">五维评分</h4>
                        <div className="space-y-2">
                          {[
                            { label: '画质', key: 'quality' as const, icon: Star },
                            { label: '一致性', key: 'consistency' as const, icon: Shield },
                            { label: '运动控制', key: 'motion' as const, icon: Zap },
                            { label: '生成速度', key: 'speed' as const, icon: Clock },
                            { label: '性价比', key: 'cost' as const, icon: DollarSign },
                          ].map((dim) => (
                            <div key={dim.key} className="flex items-center gap-3">
                              <dim.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm text-muted-foreground w-16 flex-shrink-0">{dim.label}</span>
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    platform.scores[dim.key] >= 90 ? 'bg-green-500' :
                                    platform.scores[dim.key] >= 80 ? 'bg-amber-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${platform.scores[dim.key]}%` }}
                                />
                              </div>
                              <span className={`text-sm font-medium w-8 text-right ${scoreColor(platform.scores[dim.key])}`}>
                                {platform.scores[dim.key]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 详细信息 */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium text-foreground mb-2">核心优势</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {platform.highlights.map((h) => (
                              <span key={h} className="px-2 py-1 rounded-md text-xs bg-red-500/10 text-red-500">
                                {h}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground mb-1">时长限制</div>
                            <div className="text-sm text-foreground">{platform.limit}</div>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground mb-1">价格</div>
                            <div className="text-sm text-foreground">{platform.pricing}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── 能力矩阵 Tab ── */}
        {activeTab === 'matrix' && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">平台能力矩阵</h2>
              <p className="text-sm text-muted-foreground mt-1">
                12项核心能力 × 7大平台交叉对比
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground sticky left-0 bg-card z-10 min-w-[140px]">
                      能力维度
                    </th>
                    {PLATFORM_RANKING.map((p) => (
                      <th key={p.name} className="px-4 py-3 text-center text-sm font-medium min-w-[120px]">
                        <div className="text-foreground">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.vendor}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CAPABILITY_DIMENSIONS.map((dim) => (
                    <tr key={dim.key} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-foreground sticky left-0 bg-card z-10">
                        <span className="mr-2">{dim.icon}</span>
                        {dim.label}
                      </td>
                      {PLATFORM_RANKING.map((p) => (
                        <td key={p.name} className="px-4 py-3 text-center">
                          {capIcon(CAPABILITY_MATRIX[p.name]?.[dim.key] ?? 'none')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 图例 */}
            <div className="flex gap-6 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> 完整支持</span>
              <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-500" /> 部分支持</span>
              <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border border-muted-foreground/30" /> 不支持</span>
            </div>

            {/* 平台选择建议 */}
            <div className="mt-8 bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-red-500" />
                平台选择建议
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm font-medium text-foreground mb-2">人物类镜头</div>
                  <div className="text-sm text-muted-foreground">首选 <span className="text-red-500 font-medium">Kling 2.6</span></div>
                  <div className="text-xs text-muted-foreground mt-1">人物一致性行业领先，首尾帧控制精准</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm font-medium text-foreground mb-2">场景类镜头</div>
                  <div className="text-sm text-muted-foreground">首选 <span className="text-amber-500 font-medium">Runway Gen-4</span> / Seedance 2.0</div>
                  <div className="text-xs text-muted-foreground mt-1">场景一致性+参考帧控制优秀</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm font-medium text-foreground mb-2">物理真实镜头</div>
                  <div className="text-sm text-muted-foreground">首选 <span className="text-blue-500 font-medium">Veo 3.1</span></div>
                  <div className="text-xs text-muted-foreground mt-1">物理真实性最强，支持30s长时长</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm font-medium text-foreground mb-2">私有化部署</div>
                  <div className="text-sm text-muted-foreground">首选 <span className="text-emerald-600 font-medium">Open-Sora 2.0</span></div>
                  <div className="text-xs text-muted-foreground mt-1">完全开源，T2I2V管线+Motion Score+FP8量化</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 生产管线 Tab ── */}
        {activeTab === 'pipeline' && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">5步生产管线</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Bible-Driven → Keyframe → Video → Assembly → Q-CHECK
              </p>
            </div>

            <div className="space-y-4">
              {PIPELINE_STEPS.map((step) => (
                <div
                  key={step.step}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                >
                  <button
                    className="w-full px-6 py-4 flex items-center gap-4 text-left"
                    onClick={() => setExpandedStep(expandedStep === step.step ? null : step.step)}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl border ${stepColorMap[step.color]}`}>
                      {step.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">STEP {step.step}</span>
                        <span className="font-semibold text-foreground">{step.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{step.subtitle}</div>
                      <div className="text-sm text-muted-foreground mt-1">{step.description}</div>
                    </div>
                    {expandedStep === step.step ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>

                  {expandedStep === step.step && (
                    <div className="px-6 pb-6 border-t border-border/50 pt-4">
                      <div className="space-y-2">
                        {step.details.map((detail, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <ArrowRight className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <span className="text-foreground">{detail}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 bg-muted/50 rounded-lg px-4 py-2">
                        <span className="text-xs text-muted-foreground">输出: </span>
                        <span className="text-xs font-mono text-foreground">{step.output}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 管线总览图 */}
            <div className="mt-8 bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">管线数据流</h3>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {PIPELINE_STEPS.map((step, i) => (
                  <div key={step.step} className="flex items-center gap-2 flex-shrink-0">
                    <div className={`px-3 py-2 rounded-lg border text-xs font-medium ${stepColorMap[step.color]}`}>
                      {step.icon} {step.title.split('·')[0]}
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 人物一致性 Tab ── */}
        {activeTab === 'consistency' && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">人物一致性方法论</h2>
              <p className="text-sm text-muted-foreground mt-1">
                4层递进策略：从前端预防到后端修正
              </p>
            </div>

            <div className="space-y-4">
              {CONSISTENCY_METHODS.map((item) => (
                <div key={item.method} className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold flex-shrink-0 ${
                      item.priority === 'P0' ? 'bg-red-500/10 text-red-500' :
                      item.priority === 'P1' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-blue-500/10 text-blue-500'
                    }`}>
                      {item.priority}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{item.method}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      <div className="mt-3 space-y-1.5">
                        {item.details.map((detail, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="text-muted-foreground flex-shrink-0">•</span>
                            <span>{detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 一致性检查流程 */}
            <div className="mt-8 bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-500" />
                Q-CHECK 一致性检查流程
              </h3>
              <div className="space-y-3">
                {[
                  { check: 'Q-CHECK 1: 面部一致性', desc: '跨镜头面部特征对比，InsightFace相似度 ≥ 0.85', level: 'P0' },
                  { check: 'Q-CHECK 2: 服装一致性', desc: '颜色/纹理/款式跨镜头匹配度 ≥ 90%', level: 'P0' },
                  { check: 'Q-CHECK 3: 配饰一致性', desc: '首饰/纹身/疤痕位置与外观匹配', level: 'P1' },
                  { check: 'Q-CHECK 4: 场景连续性', desc: '光源方向/色调/空间逻辑合理', level: 'P1' },
                  { check: 'Q-CHECK 5: 技术质量', desc: '分辨率/帧率/编码/音频同步达标', level: 'P2' },
                ].map((item) => (
                  <div key={item.check} className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      item.level === 'P0' ? 'bg-red-500/10 text-red-500' :
                      item.level === 'P1' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-blue-500/10 text-blue-500'
                    }`}>
                      {item.level}
                    </span>
                    <span className="text-sm font-medium text-foreground">{item.check}</span>
                    <span className="text-xs text-muted-foreground flex-1 text-right">{item.desc}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="w-3 h-3" />
                不合格 → 标注问题 → 调整参数 → 重新生成（最多3次自动重试 → 人工介入）
              </div>
            </div>
          </div>
        )}
        {/* ── Open-Sora 架构 Tab ── */}
        {activeTab === 'opensora' && (
          <div className="space-y-8">
            {/* Header */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Cpu className="w-6 h-6 text-emerald-600" />
                <h2 className="text-lg font-semibold text-foreground">Open-Sora 2.0 架构解析</h2>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-600/10 text-emerald-600">
                  开源
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                基于源码深度解析 T2I2V 管线、MMDiT 架构、Motion Score 评估等核心设计
              </p>
            </div>

            {/* Architecture Overview */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-red-500" />
                模型架构概览
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '骨干网络', value: OPEN_SORA_ARCH.modelBackbone, icon: '🧠' },
                  { label: 'VAE 压缩', value: OPEN_SORA_ARCH.vae, icon: '📦' },
                  { label: '文本编码器', value: OPEN_SORA_ARCH.textEncoder, icon: '📝' },
                  { label: '参数量', value: OPEN_SORA_ARCH.paramCount, icon: '⚖️' },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/50 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground mb-1">{item.icon} {item.label}</div>
                    <div className="text-sm font-medium text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-6">
                <div className="bg-muted/50 rounded-lg px-4 py-3 flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <div className="text-xs text-muted-foreground">VBench 综合评分</div>
                    <div className="text-xl font-bold text-emerald-600">{OPEN_SORA_ARCH.vbenchScore}</div>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg px-4 py-3">
                  <div className="text-xs text-muted-foreground">VBench 排名</div>
                  <div className="text-sm font-medium text-foreground">{OPEN_SORA_ARCH.vbenchRank}</div>
                </div>
              </div>
            </div>

            {/* T2I2V Pipeline */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-red-500" />
                T2I2V 两阶段生成管线
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Open-Sora 2.0 核心创新：将视频生成拆分为「文生图 + 图生视频」两阶段，图片作为中间锚点大幅提升视觉质量
              </p>
              <div className="flex flex-col gap-3">
                {OPEN_SORA_ARCH.t2i2vPipeline.map((step, i) => (
                  <div key={step.step} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold bg-emerald-600/10 text-emerald-600 border border-emerald-600/20 flex-shrink-0">
                      {step.step}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{step.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{step.desc}</div>
                    </div>
                    {i < OPEN_SORA_ARCH.t2i2vPipeline.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-muted-foreground hidden md:block mt-2" />
                    )}
                  </div>
                ))}
              </div>
              {/* Pipeline flow */}
              <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2 border-t border-border/50 pt-4">
                <span className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 text-xs font-medium border border-blue-500/20">Prompt</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-medium border border-amber-500/20">Refine</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-500 text-xs font-medium border border-purple-500/20">T2I</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-500 text-xs font-medium border border-green-500/20">Score</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-medium border border-red-500/20">I2V</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-600 text-xs font-medium border border-emerald-600/20">Motion</span>
              </div>
            </div>

            {/* Key Innovations */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-red-500" />
                6大核心创新
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {OPEN_SORA_ARCH.keyInnovations.map((inn, i) => (
                  <div key={i} className="bg-muted/30 rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold bg-emerald-600/10 text-emerald-600">
                        {i + 1}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{inn.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{inn.desc}</p>
                    <div className="flex items-start gap-1.5 text-xs">
                      <TrendingUp className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{inn.benefit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* VBench Breakdown */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-red-500" />
                VBench 评测细项
              </h3>
              <div className="space-y-2.5">
                {OPEN_SORA_ARCH.vbenchBreakdown.map((item) => (
                  <div key={item.category} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-32 flex-shrink-0 text-right">{item.category}</span>
                    <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          item.score >= 85 ? 'bg-green-500' :
                          item.score >= 75 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium w-10 text-right ${
                      item.score >= 85 ? 'text-green-500' :
                      item.score >= 75 ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {item.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cost Analysis */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-red-500" />
                自部署成本分析
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">配置</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">GPU</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">推理时间</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">单次成本</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(OPEN_SORA_ARCH.costAnalysis.inference).map(([config, info]) => (
                      <tr key={config} className="border-b border-border/30">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{config}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{info.gpu}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{info.time}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-emerald-600">{info.costPerRun}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="w-3 h-3" />
                {OPEN_SORA_ARCH.costAnalysis.comparison}
              </div>
            </div>

            {/* Integration with Dreambox */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-red-500" />
                绘影工作室集成方案
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card rounded-lg p-4 border border-border">
                  <div className="text-sm font-medium text-foreground mb-2">T2I2V 管线模式</div>
                  <div className="text-xs text-muted-foreground">
                    已集成到 video-generation-pipeline.ts，支持 T2V 直出 / T2I2V 两阶段 / I2V 图片驱动三种管线模式
                  </div>
                </div>
                <div className="bg-card rounded-lg p-4 border border-border">
                  <div className="text-sm font-medium text-foreground mb-2">Prompt Refine</div>
                  <div className="text-xs text-muted-foreground">
                    已集成到 prompt-engineer.ts，自动补全运动/相机/光照描述，区分 T2V/I2V/T2I 三种模式优化
                  </div>
                </div>
                <div className="bg-card rounded-lg p-4 border border-border">
                  <div className="text-sm font-medium text-foreground mb-2">Motion Score 评估</div>
                  <div className="text-xs text-muted-foreground">
                    已集成到视频质检流程，自动评估生成视频的运动质量，过滤静止帧和过度抖动
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Wan 2.1 人物一致性 Tab ── */}
        {activeTab === 'wan21' && (
          <div className="space-y-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500/10 to-amber-500/10 border border-red-500/20 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <Users className="w-7 h-7 text-red-500" />
                <h2 className="text-xl font-bold text-foreground">Wan 2.1 人物一致性体系</h2>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-600">
                  FLF2V + VACE
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Wan 2.1 是阿里巴巴开源的视频生成模型，其 FLF2V（First-Last Frame to Video）首尾帧管线和 VACE（Video Creation and Editing）
                模型为人物一致性提供了业界领先的解决方案。14B 参数量、Apache 2.0 开源协议、VBench 84.7 分。
              </p>
            </div>

            {/* FLF2V Pipeline */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-red-500" />
                FLF2V 首尾帧管线 — 最强人物一致性方案
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    step: 1,
                    title: '首帧生成',
                    desc: '文本描述 → 高质量首帧图片，锁定角色外观、场景布局、光影基调',
                    model: 'wan2.1-t2i / flux1-dev',
                    time: '10-30s',
                  },
                  {
                    step: 2,
                    title: '尾帧生成',
                    desc: '首帧 + 运动描述 → 尾帧图片，确保动作终态与角色一致性',
                    model: 'wan2.1-i2i',
                    time: '10-30s',
                  },
                  {
                    step: 3,
                    title: 'FLF2V 视频生成',
                    desc: '首帧 + 尾帧双锚点 → 自然过渡视频，保证起止一致性',
                    model: 'wan2.1-flf2v-14B',
                    time: '2-5min',
                  },
                ].map((s) => (
                  <div key={s.step} className="bg-background rounded-lg p-4 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold">
                        {s.step}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{s.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{s.desc}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded">{s.model}</span>
                      <span className="bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded">{s.time}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-red-500/5 rounded-lg p-3 text-xs text-muted-foreground">
                <strong className="text-red-500">关键优势：</strong>
                首尾帧双锚定使角色一致性从 I2V 的 ~60% 提升到 ~85%，大幅减少后置换脸修正需求。
              </div>
            </div>

            {/* VACE Capabilities */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                VACE 全能视频创作模型 — 5种创作模式 + 8种编辑操作
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { name: '文生视频 (T2V)', desc: '中英文双语提示词直接生成视频', level: '基础' },
                  { name: '图生视频 (I2V)', desc: 'CLIP条件化参考图驱动，角色一致性保证', level: '核心' },
                  { name: '首尾帧生视频 (FLF2V)', desc: '双锚点生成，最强一致性方案', level: '核心' },
                  { name: '视频编辑 (VACE Edit)', desc: '角色替换/背景替换/风格迁移', level: '高级' },
                  { name: '可控生成 (Controllist)', desc: '姿态图/深度图/边缘图引导', level: '高级' },
                ].map((mode) => (
                  <div key={mode.name} className="bg-background rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{mode.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        mode.level === '核心' ? 'bg-red-500/10 text-red-500' :
                        mode.level === '高级' ? 'bg-amber-500/10 text-amber-600' :
                        'bg-muted text-muted-foreground'
                      }`}>{mode.level}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{mode.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="text-sm font-medium text-foreground mb-2">编辑操作</div>
                <div className="flex flex-wrap gap-2">
                  {['角色替换', '背景替换', '风格迁移', '姿态引导', '深度引导', '边缘引导', '区域修复', '画面扩展'].map((op) => (
                    <span key={op} className="px-2 py-1 rounded-md bg-red-500/5 text-red-500 text-xs border border-red-500/10">
                      {op}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Character Consistency Architecture */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-500" />
                绘影工作室人物一致性架构 — 4层防线
              </h3>
              <div className="space-y-4">
                {[
                  {
                    layer: 'L1',
                    name: '视觉锚点层',
                    source: 'Wan2.1 CLIP Conditioning',
                    desc: '面部5锚点(脸型/眉眼/鼻唇/肤色/标识) + 身形锚点 + 发型锚点 → 生成时强制注入提示词',
                    color: 'red',
                  },
                  {
                    layer: 'L2',
                    name: '参考图传递链',
                    source: 'waoowaoo Character Asset',
                    desc: '角色资产管管器：参考图集(face/full_body/costume/action) → 按场景选择外观变体 → I2V/FLF2V参考帧',
                    color: 'amber',
                  },
                  {
                    layer: 'L3',
                    name: '网格提示词生成',
                    source: 'huobao Grid Prompt Generator',
                    desc: '3种模式(first_frame/first_last/multi_ref) × 角色描述+场景描述+镜头描述 → 一致性注入片段',
                    color: 'blue',
                  },
                  {
                    layer: 'L4',
                    name: '一致性校验',
                    source: 'huobao 连贯性体系',
                    desc: '跨镜头检查(面部/服装/发型/配饰/光线/道具/颜色) → 自动标记问题 → 修复建议 → 重生成',
                    color: 'green',
                  },
                ].map((item) => (
                  <div key={item.layer} className={`bg-${item.color}-500/5 border border-${item.color}-500/20 rounded-lg p-4`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`flex items-center justify-center w-8 h-8 rounded-full bg-${item.color}-500 text-white text-sm font-bold`}>
                        {item.layer}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{item.name}</div>
                        <div className="text-xs text-muted-foreground">来源: {item.source}</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground ml-11">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Editing Pipeline */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <MonitorPlay className="w-5 h-5 text-red-500" />
                剪辑合成管线 — 融合 NarratoAI + huobao FFmpeg
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {[
                  {
                    step: '1',
                    name: '剧情分析',
                    desc: 'LLM拆分剧本为剧情段落，提取情感/节奏/关键帧描述',
                    model: 'LLM',
                  },
                  {
                    step: '2',
                    name: '字幕分析',
                    desc: '对白/旁白分类，语速分析，时间轴对齐',
                    model: 'NLP',
                  },
                  {
                    step: '3',
                    name: '过渡建议',
                    desc: '根据节奏变化推荐过渡效果(cut/dissolve/fade_black/wipe)',
                    model: '规则引擎',
                  },
                  {
                    step: '4',
                    name: 'FFmpeg合成',
                    desc: '视频拼接+转场+音频混合+字幕渲染，硬件加速',
                    model: 'FFmpeg',
                  },
                ].map((s) => (
                  <div key={s.step} className="bg-background rounded-lg p-3 border border-border text-center">
                    <span className="flex items-center justify-center w-8 h-8 mx-auto mb-2 rounded-full bg-red-500 text-white text-sm font-bold">
                      {s.step}
                    </span>
                    <div className="text-sm font-medium text-foreground mb-1">{s.name}</div>
                    <p className="text-xs text-muted-foreground mb-2">{s.desc}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s.model}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Integration Status */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-red-500" />
                绘影工作室集成状态
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { name: '人物一致性引擎', file: 'character-consistency-engine.ts', status: '已集成' },
                  { name: '一致性校验 API', file: '/api/video/consistency-check', status: '已集成' },
                  { name: '剧情剪辑分析 API', file: '/api/video/plot-analysis', status: '已集成' },
                  { name: '视频合成 API', file: '/api/video/compose', status: '已集成' },
                  { name: 'FLF2V 管线定义', file: 'platform-capabilities.ts', status: '已集成' },
                  { name: 'VACE 能力定义', file: 'platform-capabilities.ts', status: '已集成' },
                  { name: 'Wan2.1 提示词扩展', file: 'platform-capabilities.ts', status: '已集成' },
                  { name: '网格提示词生成器', file: 'character-consistency-engine.ts', status: '已集成' },
                ].map((item) => (
                  <div key={item.name} className="bg-card rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-xs bg-green-500/10 text-green-600">{item.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{item.file}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
