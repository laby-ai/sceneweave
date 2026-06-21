'use client';

import type React from 'react';
import {
  Film,
  Image as ImageIcon,
  Type,
  Mic,
  Camera,
  LayoutGrid,
  Sparkles,
  Users,
  Map,
  CheckSquare,
} from 'lucide-react';

// 节点类型定义
export type NodeType = 'script' | 'storyboard' | 'image' | 'video' | 'audio' | 'camera' | 'character' | 'scene' | 'agent' | 'quality';

// 自定义节点数据接口
export interface CustomNodeData {
  label: string;
  type: NodeType;
  prompt?: string;
  status?: 'idle' | 'loading' | 'success' | 'error';
  onUpdate?: (data: CustomNodeData) => void;
  storyboard?: Array<{
    id: string;
    index?: number;
    description: string;
    duration: number;
    cameraAngle?: string;
    prompt?: string;
    shotType?: string;
    sceneName?: string;
    timeOfDay?: string;
    location?: string;
    audio?: string;
    dialogue?: string;
    narration?: string;
    os?: string;
    voiceover?: string;
    subtitleText?: string;
    narrationText?: string;
    movement?: string;
    image?: string;
    status?: 'idle' | 'loading' | 'success' | 'error';
  }>;
  [key: string]: any;
}

// 节点样式配置
export const nodeColors: Record<NodeType, { primary: string; secondary: string; accent: string; bg: string }> = {
  script: {
    primary: '#38bdf8',
    secondary: '#0e7490',
    accent: '#67e8f9',
    bg: 'from-slate-950/95 to-cyan-950/90',
  },
  storyboard: {
    primary: '#8b5cf6',
    secondary: '#6d28d9',
    accent: '#c4b5fd',
    bg: 'from-slate-950/95 to-violet-950/90',
  },
  image: {
    primary: '#22d3ee',
    secondary: '#0891b2',
    accent: '#67e8f9',
    bg: 'from-slate-950/95 to-sky-950/90',
  },
  video: {
    primary: '#f59e0b',
    secondary: '#b45309',
    accent: '#fcd34d',
    bg: 'from-slate-950/95 to-amber-950/90',
  },
  audio: {
    primary: '#ec4899',
    secondary: '#be185d',
    accent: '#f9a8d4',
    bg: 'from-slate-950/95 to-pink-950/90',
  },
  camera: {
    primary: '#06b6d4',
    secondary: '#0891b2',
    accent: '#67e8f9',
    bg: 'from-slate-950/95 to-cyan-950/90',
  },
  character: {
    primary: '#eab308',
    secondary: '#ca8a04',
    accent: '#fde047',
    bg: 'from-slate-950/95 to-yellow-950/90',
  },
  scene: {
    primary: '#2dd4bf',
    secondary: '#0d9488',
    accent: '#5eead4',
    bg: 'from-slate-950/95 to-teal-950/90',
  },
  agent: {
    primary: '#8b5cf6',
    secondary: '#7c3aed',
    accent: '#c4b5fd',
    bg: 'from-violet-900/95 to-purple-900/95',
  },
  quality: {
    primary: '#14b8a6',
    secondary: '#0f766e',
    accent: '#5eead4',
    bg: 'from-slate-950/95 to-teal-950/90',
  },
};

// 节点图标
export const nodeIcons: Record<NodeType, React.ReactNode> = {
  script: <Type className="w-4 h-4" />,
  storyboard: <LayoutGrid className="w-4 h-4" />,
  image: <ImageIcon className="w-4 h-4" />,
  video: <Film className="w-4 h-4" />,
  audio: <Mic className="w-4 h-4" />,
  camera: <Camera className="w-4 h-4" />,
  character: <Users className="w-4 h-4" />,
  scene: <Map className="w-4 h-4" />,
  agent: <Sparkles className="w-4 h-4" />,
  quality: <CheckSquare className="w-4 h-4" />,
};

// 节点名称
export const nodeLabels: Record<NodeType, string> = {
  script: '剧本',
  storyboard: '分镜',
  image: '图片',
  video: '视频',
  audio: '音频',
  camera: '摄像机',
  character: '人物',
  scene: '场景',
  agent: 'Agent',
  quality: '质量门',
};
