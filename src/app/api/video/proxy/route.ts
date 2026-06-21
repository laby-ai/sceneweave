import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get('url');

    if (!videoUrl) {
      return NextResponse.json(
        { error: '缺少视频URL参数' },
        { status: 400 }
      );
    }

    return await proxyVideo(videoUrl);
  } catch (error) {
    console.error('[Video Proxy] Error proxying video:', error);
    return NextResponse.json(
      { error: '代理视频失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videoUrl = body.url;

    if (!videoUrl) {
      return NextResponse.json(
        { error: '缺少视频URL参数' },
        { status: 400 }
      );
    }

    return await proxyVideo(videoUrl);
  } catch (error) {
    console.error('[Video Proxy] Error proxying video:', error);
    return NextResponse.json(
      { error: '代理视频失败' },
      { status: 500 }
    );
  }
}

async function proxyVideo(videoUrl: string) {
  // 验证URL格式
  if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
    return NextResponse.json(
      { error: '无效的视频URL格式' },
      { status: 400 }
    );
  }

  console.log('[Video Proxy] Proxying video request:', videoUrl);

  // 获取原始视频
  const response = await fetch(videoUrl, {
    method: 'GET',
    headers: {
      'Accept': 'video/*,*/*',
    },
  });

  if (!response.ok) {
    console.error('[Video Proxy] Failed to fetch video:', response.status, response.statusText);
    return NextResponse.json(
      { error: `无法获取视频: ${response.status} ${response.statusText}` },
      { status: response.status }
    );
  }

  // 获取内容类型和大小
  const contentType = response.headers.get('content-type') || 'video/mp4';
  const contentLength = response.headers.get('content-length');

  console.log('[Video Proxy] Video fetched successfully:', {
    contentType,
    contentLength,
    url: videoUrl
  });

  // 创建流式响应，避免大文件内存问题
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=3600', // 缓存1小时
    'Access-Control-Allow-Origin': '*', // 允许所有跨域访问
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
  };

  // 如果有Content-Length，添加到响应头
  if (contentLength) {
    headers['Content-Length'] = contentLength;
  }

  // 获取视频流
  const videoStream = response.body;

  if (!videoStream) {
    return NextResponse.json(
      { error: '无法读取视频流' },
      { status: 500 }
    );
  }

  // 返回流式响应
  return new NextResponse(videoStream, {
    status: 200,
    headers,
  });
}

// 处理OPTIONS预检请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
    },
  });
}
