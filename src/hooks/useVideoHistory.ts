'use client';

import { useState, useEffect, useCallback } from 'react';

interface VideoHistoryItem {
  id: string;
  type: 'video';
  prompt: string;
  enhancedPrompt?: string;
  videoUrl?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  materials?: any[];
  enableSubtitle?: boolean;
  subtitleText?: string;
  subtitlePosition?: string;
  subtitleFontSize?: string;
  subtitleColor?: string;
  subtitleVoiceType?: string;
  subtitleSpeechSpeed?: number;
  generateVoice?: boolean;
  // 视频文字相关
  enableVideoText?: boolean;
  videoText?: string;
  videoTextPosition?: 'top' | 'middle' | 'bottom';
  videoTextStartTime?: number;
  videoTextEndTime?: number;
  videoTextSegments?: any[];
}

interface ImageHistoryItem {
  id: string;
  type: 'image';
  prompt: string;
  imageUrls?: string[];
  size?: string;
  resolution?: string;
  quality?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  materials?: any[];
  enableImageText?: boolean;
  imageText?: string;
}

type HistoryItem = VideoHistoryItem | ImageHistoryItem;

interface PromptHistoryItem {
  id: string;
  originalPrompt: string;
  enhancedPrompt: string;
  createdAt: number;
  used?: boolean;
}

export function useVideoHistory() {
  const [videoHistory, setVideoHistory] = useState<VideoHistoryItem[]>([]);
  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [promptHistory, setPromptHistory] = useState<PromptHistoryItem[]>([]);

  // 从 localStorage 加载历史记录
  useEffect(() => {
    const savedVideoHistory = localStorage.getItem('videoHistory');
    const savedImageHistory = localStorage.getItem('imageHistory');
    const savedPromptHistory = localStorage.getItem('promptHistory');

    if (savedVideoHistory) {
      try {
        setVideoHistory(JSON.parse(savedVideoHistory));
      } catch (error) {
        console.error('加载视频历史失败:', error);
      }
    }

    if (savedImageHistory) {
      try {
        setImageHistory(JSON.parse(savedImageHistory));
      } catch (error) {
        console.error('加载图片历史失败:', error);
      }
    }

    if (savedPromptHistory) {
      try {
        setPromptHistory(JSON.parse(savedPromptHistory));
      } catch (error) {
        console.error('加载描述历史失败:', error);
      }
    }
  }, []);

  // 保存视频历史
  const saveVideoHistory = useCallback((history: VideoHistoryItem[]) => {
    setVideoHistory(history);
    localStorage.setItem('videoHistory', JSON.stringify(history));
  }, []);

  // 保存图片历史
  const saveImageHistory = useCallback((history: ImageHistoryItem[]) => {
    setImageHistory(history);
    localStorage.setItem('imageHistory', JSON.stringify(history));
  }, []);

  // 保存描述历史
  const savePromptHistory = useCallback((history: PromptHistoryItem[]) => {
    setPromptHistory(history);
    localStorage.setItem('promptHistory', JSON.stringify(history));
  }, []);

  // 添加视频历史
  const addVideoHistory = useCallback((item: Omit<VideoHistoryItem, 'createdAt' | 'id' | 'type'>) => {
    const newItem: VideoHistoryItem = {
      ...item,
      type: 'video',
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    saveVideoHistory([newItem, ...videoHistory]);
    return newItem;
  }, [videoHistory, saveVideoHistory]);

  // 添加图片历史
  const addImageHistory = useCallback((item: Omit<ImageHistoryItem, 'createdAt' | 'id' | 'type'>) => {
    const newItem: ImageHistoryItem = {
      ...item,
      type: 'image',
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    saveImageHistory([newItem, ...imageHistory]);
    return newItem;
  }, [imageHistory, saveImageHistory]);

  // 更新视频历史
  const updateVideoHistory = useCallback((id: string, updates: Partial<VideoHistoryItem>) => {
    const updatedHistory = videoHistory.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    saveVideoHistory(updatedHistory);
  }, [videoHistory, saveVideoHistory]);

  // 更新图片历史
  const updateImageHistory = useCallback((id: string, updates: Partial<ImageHistoryItem>) => {
    const updatedHistory = imageHistory.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    saveImageHistory(updatedHistory);
  }, [imageHistory, saveImageHistory]);

  // 删除视频历史
  const deleteVideoHistory = useCallback((id: string) => {
    const updatedHistory = videoHistory.filter(item => item.id !== id);
    saveVideoHistory(updatedHistory);
  }, [videoHistory, saveVideoHistory]);

  // 删除图片历史
  const deleteImageHistory = useCallback((id: string) => {
    const updatedHistory = imageHistory.filter(item => item.id !== id);
    saveImageHistory(updatedHistory);
  }, [imageHistory, saveImageHistory]);

  // 清空视频历史
  const clearVideoHistory = useCallback(() => {
    saveVideoHistory([]);
  }, [saveVideoHistory]);

  // 清空图片历史
  const clearImageHistory = useCallback(() => {
    saveImageHistory([]);
  }, [saveImageHistory]);

  // 添加描述历史
  const addPromptHistory = useCallback((item: Omit<PromptHistoryItem, 'createdAt' | 'id'>) => {
    const newItem: PromptHistoryItem = {
      ...item,
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    savePromptHistory([newItem, ...promptHistory]);
    return newItem;
  }, [promptHistory, savePromptHistory]);

  // 删除描述历史
  const deletePromptHistory = useCallback((id: string) => {
    const updatedHistory = promptHistory.filter(item => item.id !== id);
    savePromptHistory(updatedHistory);
  }, [promptHistory, savePromptHistory]);

  // 清空描述历史
  const clearPromptHistory = useCallback(() => {
    savePromptHistory([]);
  }, [savePromptHistory]);

  return {
    videoHistory,
    imageHistory,
    promptHistory,
    addVideoHistory,
    addImageHistory,
    updateVideoHistory,
    updateImageHistory,
    deleteVideoHistory,
    deleteImageHistory,
    clearVideoHistory,
    clearImageHistory,
    addPromptHistory,
    deletePromptHistory,
    clearPromptHistory,
  };
}
