import { NextRequest, NextResponse } from 'next/server';
import {
  ImageGenerationClient,
  Config,
  HeaderUtils,
  APIError,
} from 'coze-coding-dev-sdk';
import { 
  createTask, 
  startTask, 
  completeTask, 
  failTask,
  updateTaskProgress,
  getTask
} from '@/lib/task-manager';

// 执行图片生成任务
async function executeImageTask(
  taskId: string,
  params: {
    prompt: string;
    size?: string;
    watermark?: boolean;
    materials?: string[];
    style?: string;
    mood?: string;
    filter?: string;
    colorTheme?: string;
    resolution?: string;
    quality?: string;
  },
  customHeaders: Record<string, string>
) {
  const {
    prompt,
    size = '2K',
    watermark = true,
    materials = [],
    style,
    mood,
    filter,
    colorTheme,
  } = params;

  try {
    // 更新进度：初始化
    updateTaskProgress(taskId, 5, '初始化...', '正在准备图片生成环境');

    // 初始化配置和客户端
    const config = new Config();
    const client = new ImageGenerationClient(config, customHeaders);

    // 更新进度：理解描述
    updateTaskProgress(taskId, 15, '理解描述...', 'AI正在理解您的图片描述');

    // 构建提示词
    let finalPrompt = prompt;

    // 添加风格、氛围、滤镜、颜色主题等
    if (style && style !== 'none') {
      switch (style) {
        case 'realistic':
          finalPrompt += '，超写实风格，照片级真实感，丰富的细节';
          break;
        case 'anime':
          finalPrompt += '，日系动漫风格，精美细腻的画风';
          break;
        case 'cartoon':
          finalPrompt += '，卡通风格，简洁可爱，色彩鲜艳';
          break;
        case 'cinematic':
          finalPrompt += '，电影大片风格，专业电影级光影，宽屏构图';
          break;
        case 'watercolor':
          finalPrompt += '，水彩画风格，柔和的水彩质感，清透明快';
          break;
        case 'oil-painting':
          finalPrompt += '，油画风格，厚重的油画笔触，丰富的色彩层次';
          break;
        case 'pixel-art':
          finalPrompt += '，像素艺术风格，复古8-bit像素风';
          break;
        case '3d-render':
          finalPrompt += '，3D渲染风格，高质量3D建模，逼真的材质渲染';
          break;
        case 'sketch':
          finalPrompt += '，素描风格，手绘质感，铅笔线条';
          break;
        case 'minimalist':
          finalPrompt += '，极简风格，简洁现代，留白设计';
          break;
        case 'vintage':
          finalPrompt += '，复古风格，怀旧质感，胶片色调';
          break;
        case 'cyberpunk':
          finalPrompt += '，赛博朋克风格，霓虹灯光，未来都市，科技感';
          break;
      }
    }

    if (mood && mood !== 'none') {
      switch (mood) {
        case 'happy':
          finalPrompt += '，明亮欢快的氛围，温暖的阳光，愉悦的心情';
          break;
        case 'romantic':
          finalPrompt += '，浪漫温馨的氛围，柔和的光线，温暖的色调';
          break;
        case 'mysterious':
          finalPrompt += '，神秘悬疑的氛围，暗色调，阴影层次，神秘感';
          break;
        case 'epic':
          finalPrompt += '，宏大史诗感，壮阔的场景，震撼的视觉效果';
          break;
        case 'peaceful':
          finalPrompt += '，宁静祥和的氛围，柔和的光线，平和的感觉';
          break;
        case 'exciting':
          finalPrompt += '，充满活力和激情，动感的画面，热烈的氛围';
          break;
        case 'dramatic':
          finalPrompt += '，强烈的戏剧感，戏剧性的光影，情感饱满';
          break;
        case 'whimsical':
          finalPrompt += '，奇幻异想天开的氛围，梦幻色彩，想象力丰富';
          break;
        case 'nostalgic':
          finalPrompt += '，怀旧回忆感，复古色调，温暖的记忆';
          break;
        case 'tense':
          finalPrompt += '，紧张刺激的氛围，紧凑的节奏，悬念感';
          break;
        case 'heartwarming':
          finalPrompt += '，温暖人心的感觉，柔和的光线，温馨的场景';
          break;
        case 'futuristic':
          finalPrompt += '，未来科技感，现代设计，科幻元素';
          break;
      }
    }

    // 更新进度：生成中
    updateTaskProgress(taskId, 30, '生成中...', 'AI正在创作您的图片');

    // 构建请求参数
    const requestParams: any = {
      prompt: finalPrompt.trim(),
      size: size,
      watermark: watermark,
    };

    // 如果有素材，添加到请求中
    if (materials && materials.length > 0) {
      requestParams.reference_images = materials;
    }

    // 调用图片生成
    const response = await client.generate(requestParams);

    // 更新进度：图片生成完成
    updateTaskProgress(taskId, 80, '图片生成完成', '基础图片已生成');

    const helper = client.getResponseHelper(response);

    if (!helper.success) {
      throw new Error(helper.errorMessages[0] || '图片生成失败');
    }

    // 更新进度：处理完成
    updateTaskProgress(taskId, 95, '处理完成', '图片处理即将完成');

    // 完成任务
    completeTask(taskId, {
      imageUrls: helper.imageUrls,
    });

  } catch (error) {
    console.error(`[Task ${taskId}] 图片生成失败:`, error);
    
    let errorMessage = '服务器错误，请稍后重试';
    if (error instanceof APIError) {
      errorMessage = error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    failTask(taskId, errorMessage);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      size,
      watermark,
      style,
      mood,
      filter,
      colorTheme,
      resolution,
      quality,
      materials,
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: '图片描述不能为空' }, { status: 400 });
    }

    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 创建任务
    const taskId = createTask('image', {
      prompt,
      size,
      watermark,
      style,
      mood,
      filter,
      colorTheme,
      resolution,
      quality,
      materials,
    });

    // 标记任务开始
    startTask(taskId);

    // 在后台执行任务
    executeImageTask(taskId, {
      prompt,
      size,
      watermark,
      style,
      mood,
      filter,
      colorTheme,
      resolution,
      quality,
      materials,
    }, customHeaders);

    return NextResponse.json({ taskId });
  } catch (error) {
    console.error('图片生成请求失败:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}

// 获取任务状态的API
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json({ error: '缺少任务ID' }, { status: 400 });
  }

  const task = getTask(taskId);

  if (!task) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 });
  }

  // 移除不能序列化的字段
  const { abortController, ...taskInfo } = task;
  return NextResponse.json(taskInfo);
}
