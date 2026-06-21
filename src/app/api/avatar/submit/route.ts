import { NextRequest, NextResponse } from 'next/server';
import {
  createTask,
  startTask,
  completeTask,
  failTask,
  updateTaskProgress,
  getTask,
} from '@/lib/task-manager';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      modelId, 
      text, 
      voiceType, 
      background, 
      resolution, 
      aspectRatio,
      useBackground = false,
      customImageUrl
    } = body;

    if (!modelId || !text) {
      return NextResponse.json(
        { error: '请提供数字人模型和文本内容' },
        { status: 400 }
      );
    }

    console.log('[Avatar Submit] 收到数字人任务请求:', { modelId, textLength: text.length });

    // 创建后台任务
    const taskId = createTask('avatar', {
      prompt: text,
      modelId,
      voiceType,
      background,
      resolution: resolution as any,
      ratio: aspectRatio as any,
      useBackground,
      customImageUrl,
    });

    console.log('[Avatar Submit] 创建后台任务:', taskId);

    // 在后台启动生成任务（不等待完成）
    startAvatarGeneration(taskId, {
      modelId,
      text,
      voiceType,
      background,
      resolution,
      aspectRatio,
      customImageUrl,
    });

    return NextResponse.json({
      success: true,
      taskId,
      message: '数字人任务已提交，正在后台生成中...',
    });

  } catch (error) {
    console.error('[Avatar Submit] 提交任务失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '提交任务失败' },
      { status: 500 }
    );
  }
}

// 后台数字人生成函数
async function startAvatarGeneration(
  taskId: string,
  params: {
    modelId: string;
    text: string;
    voiceType?: string;
    background?: string;
    resolution?: string;
    aspectRatio?: string;
    customImageUrl?: string;
  }
) {
  const abortController = new AbortController();
  startTask(taskId, abortController);

  try {
    updateTaskProgress(taskId, 10, '初始化', '正在初始化数字人生成...');
    
    // 延迟导入以避免循环依赖
    const {
      VideoGenerationClient,
      Config,
      HeaderUtils,
    } = await import('coze-coding-dev-sdk');

    updateTaskProgress(taskId, 20, '构建提示词', '正在构建数字人提示词...');

    // 构建提示词
    const prompt = buildAvatarPrompt(
      params.modelId, 
      params.text, 
      params.background, 
      params.customImageUrl
    );

    updateTaskProgress(taskId, 30, '调用AI', '正在调用视频生成AI...');

    // 初始化客户端
    const config = new Config({ timeout: 600000 } as any);
    const client = new VideoGenerationClient(config);
    const content = [{ type: 'text' as const, text: prompt }];

    // 调用视频生成
    const response = await client.videoGeneration(content, {
      model: 'doubao-seedance-1-5-pro-251215',
      duration: Math.min(Math.ceil(params.text.length / 8), 60),
      ratio: (params.aspectRatio || '16:9') as any,
      resolution: (params.resolution || '720p') as any,
      generateAudio: true,
      watermark: true,
    });

    updateTaskProgress(taskId, 80, '处理结果', '正在处理生成结果...');

    if (!response.videoUrl) {
      throw new Error('视频生成失败，没有返回视频URL');
    }

    updateTaskProgress(taskId, 100, '完成', '数字人视频生成完成！');

    completeTask(taskId, {
      videoUrl: response.videoUrl,
    });

    console.log('[Avatar Generation] 任务完成:', taskId);

  } catch (error) {
    console.error('[Avatar Generation] 任务失败:', taskId, error);
    
    const task = getTask(taskId);
    if (task && task.status !== 'cancelled') {
      failTask(taskId, error instanceof Error ? error.message : '生成失败');
    }
  }
}

function buildAvatarPrompt(
  modelId: string, 
  text: string, 
  background?: string, 
  customImageUrl?: string
): string {
  // 如果有自定义图片，使用自定义图片的提示词
  if (customImageUrl) {
    return buildCustomAvatarPrompt(text, background, customImageUrl);
  }

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

function buildCustomAvatarPrompt(text: string, background?: string, customImageUrl?: string): string {
  let basePrompt = '一个逼真的数字人形象，正面向镜头，清晰地讲解内容。';
  
  if (customImageUrl) {
    basePrompt = '基于参考图片中的人物形象，创建一个逼真的数字人，正面向镜头，清晰地讲解内容。';
  }

  let backgroundPrompt = '';
  if (background && background !== 'none') {
    switch (background) {
      case 'office':
        backgroundPrompt = '背景是现代化的办公室。';
        break;
      case 'studio':
        backgroundPrompt = '背景是专业的视频演播室。';
        break;
      case 'nature':
        backgroundPrompt = '背景是美丽的自然风景。';
        break;
      case 'gradient-blue':
        backgroundPrompt = '背景是优雅的蓝色渐变。';
        break;
      case 'gradient-purple':
        backgroundPrompt = '背景是优雅的紫色渐变。';
        break;
    }
  }

  const speechPrompt = `人物正在说："${text}"。注意口型要与语音内容同步。`;
  const noTextPrompt = '重要：画面中绝对不要出现任何文字、字母、数字或符号，保持画面干净。';

  return `${basePrompt} ${backgroundPrompt} ${speechPrompt} ${noTextPrompt} 视频质量高清，人物居中，画面稳定，光线柔和。`;
}
