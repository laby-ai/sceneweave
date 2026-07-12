import { NextRequest, NextResponse } from 'next/server';
import { VideoEditClient, Config, HeaderUtils } from '@/lib/native-provider-sdk';
import { createHuiyingObjectStorage } from '@/lib/huiying-object-storage';

const videoEditConfig = new Config();
const storage = createHuiyingObjectStorage();

function getVideoEditClient(customHeaders?: Record<string, string>) {
  return new VideoEditClient(videoEditConfig, customHeaders);
}

// 音视频合并导出
export async function POST(request: NextRequest) {
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

  try {
    const body = await request.json();
    const { videoUrl, audioUrl, outputName } = body;

    if (!videoUrl) {
      return NextResponse.json({
        success: false,
        error: '缺少视频URL参数',
      }, { status: 400 });
    }

    if (!audioUrl) {
      return NextResponse.json({
        success: false,
        error: '缺少音频URL参数',
      }, { status: 400 });
    }

    console.log('[Export] 开始导出音视频...');
    console.log('[Export] 视频URL:', videoUrl);
    console.log('[Export] 音频URL:', audioUrl);

    const videoEditClient = getVideoEditClient(customHeaders);

    // 调用VideoEdit合并
    const compileResponse = await videoEditClient.compileVideoAudio(
      videoUrl,
      audioUrl,
      {
        isVideoAudioSync: false,
        isAudioReserve: false,
      }
    );

    console.log('[Export] VideoEdit响应:', JSON.stringify(compileResponse));

    if (!compileResponse.url) {
      return NextResponse.json({
        success: false,
        error: '音视频合并失败，VideoEdit未返回URL',
        response: compileResponse,
      }, { status: 500 });
    }

    // 可选：将合并后的视频上传到对象存储
    let finalUrl = compileResponse.url;
    let storageKey: string | null = null;

    if (outputName) {
      try {
        console.log('[Export] 上传合并后的视频到对象存储...');
        const key = await storage.uploadFromUrl({
          url: compileResponse.url,
          timeout: 120000, // 2分钟超时
        });
        storageKey = key;

        // 生成永久访问URL
        finalUrl = await storage.generatePresignedUrl({
          key,
          expireTime: 86400 * 30, // 30天有效期
        });

        console.log('[Export] 上传到对象存储成功:', key);
      } catch (storageError: any) {
        console.error('[Export] 上传到对象存储失败:', storageError);
        // 继续使用原始URL
      }
    }

    return NextResponse.json({
      success: true,
      url: finalUrl,
      storageKey,
      outputName,
      message: '音视频导出成功',
    });

  } catch (error: any) {
    console.error('[Export] 导出失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
    }, { status: 500 });
  }
}

// 获取导出说明
export async function GET() {
  return NextResponse.json({
    message: '音视频导出接口',
    usage: 'POST请求，带以下参数：',
    params: {
      videoUrl: '视频URL（必填）',
      audioUrl: '音频URL（必填，可以是BGM列表中的URL）',
      outputName: '输出文件名（可选，设置后会保存到对象存储）',
    },
    flow: [
      '1. 调用 /api/bgm/list 获取可用的BGM列表',
      '2. 选择一个BGM的url',
      '3. 调用本接口合并视频和BGM',
      '4. 获得带BGM的最终视频URL',
    ],
  });
}
