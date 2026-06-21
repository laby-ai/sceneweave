'use client';

/**
 * 字幕叠加组件
 * 
 * 当服务端addSubtitles烧录失败时，使用此组件在前端渲染SRT字幕
 * 支持标准SRT格式解析和同步显示
 * 
 * 使用方式:
 * <SubtitleOverlay
 *   srtData="1\n00:00:01,000 --> 00:00:04,000\nHello World"
 *   videoRef={videoElementRef}
 *   position="bottom"
 * />
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// SRT条目接口
export interface SrtEntry {
  index: number;
  startTime: number;  // 毫秒
  endTime: number;    // 毫秒
  text: string;
}

interface SubtitleOverlayProps {
  /** SRT格式字幕数据字符串 */
  srtData?: string;
  /** HTMLVideoElement引用（用于时间同步） */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** 字幕位置 */
  position?: 'top' | 'middle' | 'bottom';
  /** 字幕字体大小 */
  fontSize?: 'small' | 'medium' | 'large';
  /** 字幕颜色 */
  color?: string;
  /** 背景色 */
  backgroundColor?: string;
  /** 背景透明度 */
  backgroundOpacity?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

// 解析SRT时间戳 "00:00:01,000" → 毫秒
function parseSrtTime(timeStr: string): number {
  const match = timeStr.trim().match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)) * 1000 + parseInt(ms);
}

// 解析SRT格式字符串为结构化数组
export function parseSrtData(srtData: string): SrtEntry[] {
  if (!srtData || !srtData.trim()) return [];
  
  const entries: SrtEntry[] = [];
  // 按空行分割各个字幕块
  const blocks = srtData.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    
    // 第一行: 序号
    const index = parseInt(lines[0]) || entries.length + 1;
    
    // 第二行: 时间轴 "00:00:01,000 --> 00:00:04,000"
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
    if (!timeMatch) continue;
    
    // 剩余行: 字幕文本
    const text = lines.slice(2).join('\n').trim();
    if (!text) continue;
    
    entries.push({
      index,
      startTime: parseSrtTime(timeMatch[1]),
      endTime: parseSrtTime(timeMatch[2]),
      text,
    });
  }
  
  return entries;
}

const fontSizeMap = { small: '14px', medium: '18px', large: '24px' };

export function SubtitleOverlay({
  srtData,
  videoRef,
  position = 'bottom',
  fontSize = 'medium',
  color = '#FFFFFF',
  backgroundColor = '#000000',
  backgroundOpacity = 0.6,
  enabled = true,
  className = '',
}: SubtitleOverlayProps) {
  const [currentText, setCurrentText] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const entriesRef = useRef<SrtEntry[]>([]);
  const rafIdRef = useRef<number>(0);

  // 解析SRT数据
  useEffect(() => {
    if (srtData) {
      const parsed = parseSrtData(srtData);
      entriesRef.current = parsed;
      console.log(`[SubtitleOverlay] 解析SRT数据: ${parsed.length}条字幕`);
      setIsInitialized(true);
    } else {
      entriesRef.current = [];
      setIsInitialized(false);
      setCurrentText('');
    }
  }, [srtData]);

  // 时间同步更新字幕
  const updateSubtitle = useCallback(() => {
    if (!enabled || !videoRef?.current || !isInitialized) {
      return;
    }

    const video = videoRef.current;
    const currentTime = video.currentTime * 1000; // 转换为毫秒

    // 查找当前应显示的字幕
    let activeText = '';
    for (const entry of entriesRef.current) {
      if (currentTime >= entry.startTime && currentTime <= entry.endTime) {
        activeText = entry.text;
        break;
      }
    }

    setCurrentText(activeText);

    // 继续监听下一帧
    if (!video.paused && !video.ended) {
      rafIdRef.current = requestAnimationFrame(updateSubtitle);
    }
  }, [enabled, videoRef, isInitialized]);

  // 监听视频播放事件
  useEffect(() => {
    const video = videoRef?.current;
    if (!video || !isInitialized || !enabled) return;

    const onPlay = () => {
      rafIdRef.current = requestAnimationFrame(updateSubtitle);
    };
    const onPause = () => {
      cancelAnimationFrame(rafIdRef.current);
    };
    const onSeeked = () => {
      updateSubtitle();
    };
    const onEnded = () => {
      cancelAnimationFrame(rafIdRef.current);
      setCurrentText('');
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('ended', onEnded);

    // 如果视频正在播放，立即开始
    if (!video.paused) {
      rafIdRef.current = requestAnimationFrame(updateSubtitle);
    }

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('ended', onEnded);
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [videoRef, isInitialized, enabled, updateSubtitle]);

  // 无字幕数据或未启用时不渲染
  if (!isInitialized || !enabled || !srtData) {
    return null;
  }

  // 位置样式映射
  const positionStyles = {
    top: 'top: 10%',
    middle: 'top: 50%; transform: translateY(-50%);',
    bottom: 'bottom: 8%',
  };

  return (
    <div
      className={`absolute left-0 right-0 z-10 pointer-events-none transition-opacity duration-150 ${className}`}
      style={{
        ...(
          position === 'middle' 
            ? { top: '50%', transform: 'translateY(-50%)' }
            : { [position === 'top' ? 'top' : 'bottom']: position === 'top' ? '10%' : '8%' }
        ),
        textAlign: 'center',
      }}
    >
      {/* 字幕文本容器 */}
      <div
        className="inline-block max-w-[90%] px-3 py-1 rounded"
        style={{
          fontSize: fontSizeMap[fontSize],
          color,
          backgroundColor: `${backgroundColor}${Math.round(backgroundOpacity * 255).toString(16).padStart(2, '0')}`,
          textShadow: '1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8)',
          lineHeight: 1.4,
          wordBreak: 'break-word',
          opacity: currentText ? 1 : 0,
          transition: 'opacity 0.15s ease-in-out',
          fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif',
        }}
      >
        {currentText}
      </div>
      
      {/* 调试信息（开发环境） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-[10px] text-foreground/70 mt-1 opacity-50">
          [字幕叠加模式] {entriesRef.current.length}条
        </div>
      )}
    </div>
  );
}

export default SubtitleOverlay;
