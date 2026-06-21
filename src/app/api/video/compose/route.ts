/**
 * 视频合成 API
 * 融合 huobao FFmpeg compose + NarratoAI 剪辑管线
 * 在服务端组装合成参数，实际合成由客户端/工作节点执行
 */
import { NextRequest, NextResponse } from 'next/server';

/** 合成配置 */
interface ComposeConfig {
  projectId: string;
  segments: Array<{
    id: string;
    shotId: string;
    videoUrl: string;
    trimStart: number;
    trimEnd: number;
    transition: {
      type: 'cut' | 'dissolve' | 'fade_black' | 'wipe' | 'zoom' | 'morph';
      duration: number;
    };
    audioTracks: Array<{
      type: 'dialogue' | 'narration' | 'bgm' | 'sfx';
      url?: string;
      volume: number;
      fadeIn?: number;
      fadeOut?: number;
    }>;
    subtitle?: {
      text: string;
      startTime: number;
      endTime: number;
    };
  }>;
  output: {
    resolution: string;
    fps: number;
    codec: string;
    bitrate: string;
  };
  globalBgm?: {
    url: string;
    volume: number;
    fadeIn: number;
    fadeOut: number;
  };
  hardwareAcceleration?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'compose': {
        const config = body.config as ComposeConfig;
        const result = await composeVideo(config);
        return NextResponse.json({ success: true, result });
      }

      case 'preview_timeline': {
        const { segments: rawSegments } = body as { segments: ComposeConfig['segments'] | Array<{ duration: number }> };
        // 如果传入的是简化格式 {duration: number}，转换为 ComposeConfig segments
        const segments: ComposeConfig['segments'] = (rawSegments || []).map((seg, i) => {
          if ('videoUrl' in seg) return seg;
          // 简化格式转换
          return {
            id: `seg-${i}`,
            shotId: `shot-${i}`,
            videoUrl: '',
            trimStart: 0,
            trimEnd: (seg as { duration: number }).duration,
            transition: { type: 'cut' as const, duration: 0 },
            audioTracks: [],
          };
        });
        const timeline = generateTimeline(segments);
        return NextResponse.json({ success: true, timeline });
      }

      case 'estimate_duration': {
        const { segments: rawSegments } = body as { segments: ComposeConfig['segments'] | Array<{ duration: number }> };
        // 如果传入的是简化格式 {duration: number}，转换为 ComposeConfig segments
        const segments: ComposeConfig['segments'] = (rawSegments || []).map((seg, i) => {
          if ('videoUrl' in seg) return seg;
          // 简化格式转换
          return {
            id: `seg-${i}`,
            shotId: `shot-${i}`,
            videoUrl: '',
            trimStart: 0,
            trimEnd: (seg as { duration: number }).duration,
            transition: { type: 'cut' as const, duration: 0 },
            audioTracks: [],
          };
        });
        const estimate = estimateDuration(segments);
        return NextResponse.json({ success: true, estimate });
      }

      default:
        return NextResponse.json(
          { error: '未知操作，支持: compose, preview_timeline, estimate_duration' },
          { status: 400 },
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '视频合成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** 组装视频合成参数 */
async function composeVideo(config: ComposeConfig) {
  const { segments, output, globalBgm, hardwareAcceleration = true } = config;

  // 生成 FFmpeg 合成脚本参数
  const ffmpegInputs: string[] = [];
  const ffmpegFilterParts: string[] = [];
  let totalDuration = 0;
  let transitionCount = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const clipDuration = seg.trimEnd - seg.trimStart;
    totalDuration += clipDuration;

    // 过渡效果
    if (i > 0 && seg.transition.type !== 'cut') {
      totalDuration -= seg.transition.duration;
      transitionCount++;
    }

    // 音频轨道
    const audioFilterParts: string[] = [];
    for (const track of seg.audioTracks) {
      if (track.url) {
        const volFilter = `volume=${track.volume}`;
        const fadeFilter = [];
        if (track.fadeIn) fadeFilter.push(`afade=t=in:d=${track.fadeIn}`);
        if (track.fadeOut) fadeFilter.push(`afade=t=out:d=${track.fadeOut}:st=${clipDuration - track.fadeOut}`);
        audioFilterParts.push(`${volFilter}${fadeFilter.length > 0 ? ',' + fadeFilter.join(',') : ''}`);
      }
    }

    ffmpegInputs.push(seg.videoUrl);
    if (audioFilterParts.length > 0) {
      ffmpegFilterParts.push(audioFilterParts.join(';'));
    }
  }

  // 全局 BGM
  if (globalBgm) {
    ffmpegInputs.push(globalBgm.url);
    const bgmFilter = `volume=${globalBgm.volume},afade=t=in:d=${globalBgm.fadeIn},afade=t=out:d=${globalBgm.fadeOut}:st=${totalDuration - globalBgm.fadeOut}`;
    ffmpegFilterParts.push(bgmFilter);
  }

  return {
    projectId: config.projectId,
    ffmpegInputs,
    ffmpegFilterComplex: ffmpegFilterParts.join(';'),
    outputParams: {
      ...output,
      hardwareAcceleration: hardwareAcceleration ? 'auto' : 'none',
    },
    totalDuration: Math.round(totalDuration * 100) / 100,
    segmentCount: segments.length,
    transitionCount,
    estimatedFileSize: estimateFileSize(totalDuration, output.bitrate),
  };
}

/** 生成时间线预览 */
function generateTimeline(segments: ComposeConfig['segments']) {
  let currentTime = 0;
  const timeline = segments.map((seg, index) => {
    const clipDuration = seg.trimEnd - seg.trimStart;
    const entry = {
      index,
      shotId: seg.shotId,
      startTime: Math.round(currentTime * 100) / 100,
      endTime: Math.round((currentTime + clipDuration) * 100) / 100,
      duration: Math.round(clipDuration * 100) / 100,
      transition: seg.transition,
      hasSubtitle: !!seg.subtitle,
      audioTrackCount: seg.audioTracks.length,
    };

    currentTime += clipDuration;
    // 减去过渡重叠时间
    if (index > 0 && seg.transition.type !== 'cut') {
      currentTime -= seg.transition.duration;
    }

    return entry;
  });

  return {
    totalDuration: Math.round(currentTime * 100) / 100,
    segments: timeline,
  };
}

/** 估算总时长 */
function estimateDuration(segments: ComposeConfig['segments']) {
  let totalDuration = 0;
  let transitionDuration = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    totalDuration += seg.trimEnd - seg.trimStart;

    if (i > 0 && seg.transition.type !== 'cut') {
      transitionDuration += seg.transition.duration;
    }
  }

  const netDuration = totalDuration - transitionDuration;
  return {
    grossDuration: Math.round(totalDuration * 100) / 100,
    transitionDuration: Math.round(transitionDuration * 100) / 100,
    netDuration: Math.round(netDuration * 100) / 100,
  };
}

/** 估算文件大小 */
function estimateFileSize(duration: number, bitrate: string): string {
  // bitrate 格式如 "5M" 或 "5000k"
  let bps: number;
  if (bitrate.includes('M')) {
    bps = parseFloat(bitrate) * 1_000_000;
  } else if (bitrate.includes('k') || bitrate.includes('K')) {
    bps = parseFloat(bitrate) * 1_000;
  } else {
    bps = parseFloat(bitrate);
  }

  const sizeBytes = (bps / 8) * duration;
  if (sizeBytes > 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}
