import { NextRequest, NextResponse } from 'next/server';
import { createVideoGenerateStream, type VideoGenerateRequest } from '@/lib/video-generate-service';

export async function POST(request: NextRequest) {
  try {
    const body: VideoGenerateRequest = await request.json();

    if (!body.prompt || typeof body.prompt !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的视频描述' },
        { status: 400 }
      );
    }

    const stream = createVideoGenerateStream(body, request.headers);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('视频生成错误:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
