import { NextRequest, NextResponse } from 'next/server';
import { FrameExtractorClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { extractLastFrameWithLocalUpload } from '@/lib/video-frame-extraction';

/**
 * POST /api/video/extract-last-frame
 * 提取视频的最后一帧
 * 
 * 请求体：
 * {
 *   videoUrl: string // 视频URL
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrl } = body;

    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的视频URL' },
        { status: 400 }
      );
    }

    console.log('[Video Frame] 开始提取视频最后一帧:', videoUrl.substring(0, 80));

    // 初始化客户端
    const config = new Config();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const frameClient = new FrameExtractorClient(config, customHeaders);

    // 提取视频的最后一帧 - 使用 extractByCount 提取2帧，取最后一帧
    let response;
    try {
      response = await frameClient.extractByCount(videoUrl, 2);
    } catch (sdkError) {
      console.error('[Video Frame] SDK调用失败:', sdkError);
      const fallbackFrameUrl = await extractLastFrameWithLocalUpload(videoUrl);
      if (fallbackFrameUrl) {
        console.log('[Video Frame] 本地 FFmpeg 兜底抽帧成功:', fallbackFrameUrl.substring(0, 80));
        return NextResponse.json({
          success: true,
          frameUrl: fallbackFrameUrl,
          source: 'local-ffmpeg-upload',
        });
      }
      return NextResponse.json(
        { error: `视频帧提取服务暂时不可用: ${sdkError instanceof Error ? sdkError.message : '未知错误'}，请确认视频URL可访问后重试` },
        { status: 503 }
      );
    }

    if (!response.data?.chunks || response.data.chunks.length === 0) {
      throw new Error('未从视频中提取到帧');
    }

    // 取最后一帧
    const lastFrame = response.data.chunks[response.data.chunks.length - 1];
    const lastFrameUrl = lastFrame.screenshot;

    console.log('[Video Frame] 成功提取最后一帧:', lastFrameUrl.substring(0, 80));

    return NextResponse.json({
      success: true,
      frameUrl: lastFrameUrl,
      timestamp_ms: lastFrame.timestamp_ms,
    });

  } catch (error) {
    console.error('[Video Frame] 提取视频帧失败:', error);

    return NextResponse.json(
      { error: `提取视频帧失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
