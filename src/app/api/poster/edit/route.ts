import { NextRequest, NextResponse } from 'next/server';
import {
  ImageGenerationClient,
  Config,
  HeaderUtils,
  APIError,
} from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { 
      imageUrl,
      prompt,
      editType = 'detail_fix',
      size = '2K'
    } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: '请提供图片 URL' },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: '请提供修改描述' },
        { status: 400 }
      );
    }

    // 调用图片生成 API（图生图）
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const imageClient = new ImageGenerationClient(config, customHeaders);

    // 构建图生图请求
    const imageRequest: any = {
      prompt: `请根据以下描述修改图片：${prompt}。保持原图的整体构图和风格，仅进行细节优化。`,
      size: size,
      watermark: false,
      image: imageUrl, // 使用原图作为图生图的输入
    };

    let imageResponse;
    try {
      imageResponse = await imageClient.generate(imageRequest);
    } catch (sdkError) {
      console.error('[Poster Edit] SDK调用失败:', sdkError);
      return NextResponse.json(
        { error: `图片修改服务暂时不可用: ${sdkError instanceof Error ? sdkError.message : '未知错误'}，请稍后重试` },
        { status: 503 }
      );
    }
    const imageHelper = imageClient.getResponseHelper(imageResponse);

    if (!imageHelper.success) {
      return NextResponse.json(
        { error: `图片修改失败: ${imageHelper.errorMessages[0]}` },
        { status: 500 }
      );
    }

    const modifiedImageUrl = imageHelper.imageUrls[0];

    return NextResponse.json({
      success: true,
      modifiedImageUrl,
      originalImageUrl: imageUrl,
      prompt,
      editType,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in image-to-image API:', error);
    
    if (error instanceof APIError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: '图片修改服务暂时不可用，请稍后重试' },
      { status: 500 }
    );
  }
}
