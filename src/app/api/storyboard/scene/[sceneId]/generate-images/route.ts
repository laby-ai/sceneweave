import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service-adapter';

// 生成九宫格图片（9张连贯图片，自动降级: Minimax → Coze）
async function generateNineGridImages(
  prompt: string,
  previousLastFrame?: string,
  aspectRatio: string = '16:9'
): Promise<string[]> {
  const images: string[] = [];
  
  // 为每张图片添加时序描述
  const timingDescriptions = [
    '，初始状态，画面开始',
    '，动作开始展开',
    '，动作进行中',
    '，动作接近高潮',
    '，动作高潮时刻',
    '，动作开始回落',
    '，动作接近结束',
    '，动作收尾阶段',
    '，最终状态，画面定格'
  ];
  
  // 解析宽高比
  const [w, h] = aspectRatio.split(':').map(Number);
  
  for (let i = 0; i < 9; i++) {
    let enhancedPrompt = prompt + timingDescriptions[i];
    
    // 第1张图片：如果有前一段的最后一帧，需要确保连贯性
    if (i === 0 && previousLastFrame) {
      enhancedPrompt = `${prompt}，与参考图风格和内容保持连贯过渡，视觉元素一致` + timingDescriptions[i];
    }
    
    console.log(`[Storyboard] 生成第${i + 1}张图片，提示词:`, enhancedPrompt.substring(0, 100) + '...');
    
    // 调用图片生成API（自动降级: Minimax → Coze）
    try {
      const result = await aiService.generateImage({
        prompt: enhancedPrompt,
        model: 'image-01',
        width: w || 16,
        height: h || 9,
        n: 1,
        style: 'default',
      });
      
      if (result.data.url) {
        images.push(result.data.url);
        console.log(`[Storyboard] 第${i + 1}张图片生成成功 (${result.provider}${result.degraded ? ', 降级' : ''})`);
      } else {
        throw new Error(`第${i + 1}张图片生成失败`);
      }
    } catch (err) {
      console.error(`[Storyboard] 第${i + 1}张图片生成失败:`, err instanceof Error ? err.message : String(err));
      throw new Error(`第${i + 1}张图片生成失败`);
    }
    
    // 稍作延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  
  return images;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sceneId: string }> }
) {
  try {
    const { sceneId } = await context.params;
    const body = await request.json();
    
    const { 
      storyboardId, 
      prompt, 
      imageCount = 9,
      continuityWithPrevious = false,
      previousSceneLastFrame,
      aspectRatio = '16:9'
    } = body;

    if (!sceneId || !storyboardId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: '缺少场景描述' },
        { status: 400 }
      );
    }

    console.log(`[Storyboard API] 开始生成场景 ${sceneId} 的九宫格图片`);
    console.log(`[Storyboard API] 提示词: ${prompt.substring(0, 100)}...`);

    // 生成九宫格图片
    const images = await generateNineGridImages(
      prompt,
      continuityWithPrevious ? previousSceneLastFrame : undefined,
      aspectRatio
    );

    console.log(`[Storyboard API] 场景 ${sceneId} 九宫格图片生成成功，共 ${images.length} 张`);

    return NextResponse.json({
      success: true,
      sceneId,
      imageUrls: images,
      thumbnailUrl: images[0],
      message: '九宫格图片生成成功'
    });

  } catch (error) {
    console.error('[Storyboard API] 生成场景图片失败:', error);
    return NextResponse.json(
      { 
        error: `生成图片失败: ${error instanceof Error ? error.message : '未知错误'}`,
        success: false 
      },
      { status: 500 }
    );
  }
}
