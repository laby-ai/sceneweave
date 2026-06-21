import { NextRequest, NextResponse } from 'next/server';
import {
  VideoGenerationClient,
  Config,
  HeaderUtils,
  APIError,
} from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, text, voiceType, background, resolution, aspectRatio } = body;

    if (!modelId || !text) {
      return NextResponse.json(
        { error: '请提供数字人模型和文本内容' },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    console.log('[Avatar Generation] 开始生成数字人视频...');
    console.log('[Avatar Generation] 参数:', { modelId, voiceType, background, resolution, aspectRatio });

    // 初始化配置和客户端
    const config = new Config({
      timeout: 600000, // 10分钟
    } as any);
    const client = new VideoGenerationClient(config, customHeaders);

    // 构建提示词
    let prompt = buildAvatarPrompt(modelId, text, background);
    
    console.log('[Avatar Generation] 构建的提示词:', prompt.substring(0, 100) + '...');

    // 构建内容
    const content = [{ type: 'text' as const, text: prompt }];

    // 调用视频生成 API
    const response = await client.videoGeneration(content, {
      model: 'doubao-seedance-1-5-pro-251215',
      duration: Math.min(Math.ceil(text.length / 8), 60), // 根据文本长度计算时长，最多60秒
      ratio: aspectRatio || '16:9',
      resolution: resolution || '720p',
      generateAudio: true,
      watermark: true,
    });

    console.log('[Avatar Generation] 收到响应:', !!response.videoUrl);

    if (!response.videoUrl) {
      return NextResponse.json(
        { error: '数字人视频生成失败，没有返回视频URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      videoUrl: response.videoUrl,
      message: '数字人视频生成成功！',
    });

  } catch (error) {
    console.error('[Avatar Generation] 生成失败:', error);
    
    let errorMessage = '服务器错误';
    if (error instanceof APIError) {
      errorMessage = `API 错误: ${error.message} (状态码: ${error.statusCode})`;
      console.error('[Avatar Generation] API 错误详情:', {
        message: error.message,
        statusCode: error.statusCode,
      });
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

function buildAvatarPrompt(modelId: string, text: string, background?: string): string {
  let basePrompt = '';
  
  // 根据不同的模型ID构建不同的提示词
  switch (modelId) {
    case 'professional-female-1':
      basePrompt = '一位优雅专业的亚洲女性，穿着商务正装，坐在现代化的办公室里，面带微笑，目光温和，正在向观众讲解内容。';
      break;
    case 'professional-male-1':
      basePrompt = '一位沉稳专业的亚洲男性，穿着西装，坐在专业的演播室里，表情认真，正在进行新闻播报或知识分享。';
      break;
    case 'friendly-female-1':
      basePrompt = '一位甜美亲切的年轻亚洲女性，穿着休闲服装，在温馨的室内环境中，笑容灿烂，正在分享生活或美妆内容。';
      break;
    case 'casual-male-1':
      basePrompt = '一位阳光活力的年轻亚洲男性，穿着休闲潮流服装，在现代风格的房间里，充满激情地讲解游戏或科技内容。';
      break;
    case 'teacher-female-1':
      basePrompt = '一位知性优雅的亚洲女性教师，穿着得体的服装，在明亮的教室里，耐心地讲解知识，表情温和友善。';
      break;
    case 'anchor-male-1':
      basePrompt = '一位正式专业的亚洲男性新闻主播，穿着西装，在专业的新闻演播室里，严肃认真地播报新闻资讯。';
      break;
    default:
      basePrompt = '一位专业的主持人，正面向镜头，清晰地讲解内容。';
  }

  // 添加背景要求
  let backgroundPrompt = '';
  if (background && background !== 'none') {
    switch (background) {
      case 'office':
        backgroundPrompt = '背景是现代化的办公室，有落地窗和城市景观。';
        break;
      case 'studio':
        backgroundPrompt = '背景是专业的视频演播室，有专业的灯光设备。';
        break;
      case 'nature':
        backgroundPrompt = '背景是美丽的自然风景，有蓝天绿地。';
        break;
      case 'gradient-blue':
        backgroundPrompt = '背景是优雅的蓝色渐变，简洁专业。';
        break;
      case 'gradient-purple':
        backgroundPrompt = '背景是优雅的紫色渐变，时尚现代。';
        break;
    }
  } else {
    backgroundPrompt = '保持简洁的背景，突出人物主体。';
  }

  // 添加文本内容提示
  const speechPrompt = `人物正在说："${text}"。注意口型要与语音内容同步。`;

  // 重要：禁止画面中出现任何文字，避免乱码问题
  const noTextPrompt = '重要：画面中绝对不要出现任何文字、字母、数字或符号，保持画面干净，只展示人物和背景。';

  return `${basePrompt} ${backgroundPrompt} ${speechPrompt} ${noTextPrompt} 视频质量高清，人物居中，画面稳定，光线柔和。`;
}
