'use client';

import { useState, useEffect, useCallback } from 'react';

// 影视创作历史记录项 — 保存完整创作状态以支持跳转恢复
export interface FilmHistoryItem {
  id: string;
  title: string;               // 用户输入的创作描述（截取前50字）
  prompt: string;               // 完整创作描述
  script: Record<string, unknown> | null;   // 创作规划完整数据
  phase: 'planning' | 'visual' | 'compose';  // 最后所处阶段
  entityCards: EntityCardSnapshot[];  // 实体卡片完整数据（含图片URL）
  chatMessages: ChatMessageSnapshot[]; // 对话记录
  filmVisualStyle: string;      // 视觉风格
  imagesGenerated: number;      // 已生成图片数
  videosGenerated: number;      // 已生成视频数
  finalVideoUrl: string | null;  // 最终视频URL
  createdAt: number;
  updatedAt: number;
}

// 实体卡片快照（仅保留恢复所需字段）
export interface EntityCardSnapshot {
  id: string;
  type: 'plot' | 'character' | 'scene' | 'shot' | 'prop';
  name: string;
  description: string;
  promptCn: string;
  promptEn: string;
  imageUrl: string | null;
  startFrameUrl: string | null;
  endFrameUrl: string | null;
  videoUrl: string | null;
  nineGridImages: string[] | null;
  nineGridSelectedIndex: number | null;
  shotStatus: string | null;
  isPromptGenerated: boolean;
  // 角色字段
  gender: string;
  age: string;
  appearance: string;
  personality: string;
  outfit: string;
  // 场景字段
  location: string;
  timeOfDay: string;
  mood: string;
  colorPalette: string;
  lightingDir: string;
  // 道具字段
  propMaterial: string;
  propColor: string;
  propSize: string;
  propSignificance: string;
  propCloseup: boolean;
  // 镜头字段
  shotType: string;
  cameraAngle: string;
  action: string;
  dialogue: string;
  narration: string;
  duration: number | null;
  emotionTag: string;
  emotion: string;
  cameraMovement: string;
}

// 对话消息快照
export interface ChatMessageSnapshot {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const STORAGE_KEY = 'filmHistory';
const MAX_HISTORY = 10; // 最多保留10条（含完整数据，空间更大）

export function useFilmHistory() {
  const [filmHistory, setFilmHistory] = useState<FilmHistoryItem[]>([]);

  // 从 localStorage 加载
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setFilmHistory(JSON.parse(saved));
      } catch {
        console.error('加载影视创作历史失败');
      }
    }
  }, []);

  const saveToStorage = useCallback((history: FilmHistoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // localStorage 溢出时，尝试截断旧记录
      try {
        const truncated = history.slice(0, 5);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(truncated));
      } catch {
        console.warn('影视创作历史保存失败：存储空间不足');
      }
    }
  }, []);

  // 添加或更新历史记录（同一 prompt 5分钟内视为更新）
  const upsertFilmHistory = useCallback((item: Omit<FilmHistoryItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    setFilmHistory(prev => {
      const existingIndex = prev.findIndex(h =>
        h.prompt === item.prompt && Date.now() - h.createdAt < 5 * 60 * 1000
      );

      let newHistory: FilmHistoryItem[];
      if (existingIndex >= 0) {
        newHistory = prev.map((h, i) =>
          i === existingIndex
            ? { ...h, ...item, updatedAt: Date.now() }
            : h
        );
      } else {
        const newItem: FilmHistoryItem = {
          ...item,
          id: `film_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        newHistory = [newItem, ...prev].slice(0, MAX_HISTORY);
      }

      saveToStorage(newHistory);
      return newHistory;
    });
  }, [saveToStorage]);

  // 删除单条
  const deleteFilmHistory = useCallback((id: string) => {
    setFilmHistory(prev => {
      const newHistory = prev.filter(h => h.id !== id);
      saveToStorage(newHistory);
      return newHistory;
    });
  }, [saveToStorage]);

  // 清空全部
  const clearFilmHistory = useCallback(() => {
    const empty: FilmHistoryItem[] = [];
    setFilmHistory(empty);
    saveToStorage(empty);
  }, [saveToStorage]);

  return {
    filmHistory,
    upsertFilmHistory,
    deleteFilmHistory,
    clearFilmHistory,
  };
}
