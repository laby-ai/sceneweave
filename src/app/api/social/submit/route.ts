import { NextRequest, NextResponse } from 'next/server';
import {
  ImageGenerationClient,
  LLMClient,
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

// 执行社交媒体生成任务
async function executeSocialTask(
  taskId: string,
  params: {
    topic: string;
    title?: string;
    platform: 'xiaohongshu' | 'wechat';
  },
  customHeaders: Record<string, string>
) {
  const { topic, title, platform } = params;

  try {
    // 更新进度：初始化
    updateTaskProgress(taskId, 5, '初始化...', '正在准备生成环境');

    // 初始化配置和客户端
    const config = new Config();
    const imageClient = new ImageGenerationClient(config, customHeaders);
    const llmClient = new LLMClient(config, customHeaders);

    // 更新进度：理解描述
    updateTaskProgress(taskId, 15, '理解描述...', 'AI正在理解您的内容描述');

    let generatedImage: string | null = null;
    let generatedContent: string | null = null;

    // 根据平台生成不同的内容
    if (platform === 'xiaohongshu') {
      // 小红书：先生成图片
      updateTaskProgress(taskId, 30, '生成配图中...', '正在为您生成精美的配图');

      const imageResponse = await imageClient.generate({
        prompt: `小红书风格图片，${topic}，高清，美观，适合3:4比例展示`,
        size: '2K',
        watermark: true,
      });

      const imageHelper = imageClient.getResponseHelper(imageResponse);
      if (!imageHelper.success) {
        throw new Error(imageHelper.errorMessages[0] || '图片生成失败');
      }

      generatedImage = imageHelper.imageUrls?.[0] || null;
      updateTaskProgress(taskId, 60, '生成文案中...', '正在为您生成吸引人的文案');

      // 再生成文案
      const systemPrompt = `你是一位专业的小红书文案专家，擅长撰写吸引人的小红书风格文案。
          
【小红书平台特性】
- 大量使用 emoji 表情，增强亲和力和视觉效果
- 使用"姐妹们"、"集美们"等称呼拉近距离
- 标题要吸睛，可以使用疑问句、感叹句
- 内容要有体验感和分享感
- 使用话题标签格式：#话题
- 语气亲切、热情，像在跟朋友聊天
- 字数控制在1000字以内
- 多用短句，节奏轻快

请直接返回一篇完整的小红书文案。`;

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: `请为以下主题撰写一篇小红书文案：${topic}` },
      ];

      const llmStream = llmClient.stream(messages, {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8,
      });

      let fullContent = '';
      for await (const chunk of llmStream) {
        if (chunk.content) {
          fullContent += chunk.content.toString();
        }
      }

      generatedContent = fullContent || null;
    } else if (platform === 'wechat') {
      // 公众号：先生成封面图
      updateTaskProgress(taskId, 30, '生成封面中...', '正在为您生成专业的封面图');

      const coverPrompt = title 
        ? `公众号封面图，${title}，${topic}，高清，专业，适合16:9比例展示`
        : `公众号封面图，${topic}，高清，专业，适合16:9比例展示`;

      const coverResponse = await imageClient.generate({
        prompt: coverPrompt,
        size: '2K',
        watermark: true,
      });

      const coverHelper = imageClient.getResponseHelper(coverResponse);
      if (!coverHelper.success) {
        throw new Error(coverHelper.errorMessages[0] || '封面图生成失败');
      }

      generatedImage = coverHelper.imageUrls?.[0] || null;
      updateTaskProgress(taskId, 60, '生成文章中...', '正在为您生成专业的文章内容');

      // 再生成文章
      const articlePrompt = title 
        ? `请为以下主题撰写一篇专业的公众号文章，标题：${title}，主题：${topic}。请整理文字，梳理逻辑结构，使其适合公众号阅读。`
        : `请为以下主题撰写一篇专业的公众号文章：${topic}。请整理文字，梳理逻辑结构，使其适合公众号阅读。`;

      const systemPrompt = `你是一位专业的公众号文案专家，擅长撰写专业的公众号文章。
          
【微信公众号平台特性】
- 专业、深度、有教育价值
- 结构清晰，逻辑严密
- 可以引用数据、案例
- 适合长篇深度内容（2000-5000字）
- 使用专业术语但不过度
- 图文并茂，排版美观
- 可以添加引导关注、点赞、在看
- 适合知识分享、产品评测、行业分析

请直接返回一篇完整的公众号文章。`;

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: articlePrompt },
      ];

      const llmStream = llmClient.stream(messages, {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8,
      });

      let fullContent = '';
      for await (const chunk of llmStream) {
        if (chunk.content) {
          fullContent += chunk.content.toString();
        }
      }

      generatedContent = fullContent || null;
    }

    // 更新进度：处理完成
    updateTaskProgress(taskId, 90, '处理完成', '内容生成即将完成');

    // 完成任务
    completeTask(taskId, {
      imageUrls: generatedImage ? [generatedImage] : undefined,
      content: generatedContent || undefined,
      platform,
    });

  } catch (error) {
    console.error(`[Task ${taskId}] 社交媒体生成失败:`, error);
    
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
    const { topic, title, platform, async: runAsync = true } = body;

    if (!topic) {
      return NextResponse.json({ error: '主题不能为空' }, { status: 400 });
    }

    if (!platform || !['xiaohongshu', 'wechat'].includes(platform)) {
      return NextResponse.json({ error: '平台参数错误' }, { status: 400 });
    }

    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 创建任务
    const taskId = createTask('copywriting', {
      prompt: topic,
      title,
      platform,
    });

    // 标记任务开始
    startTask(taskId);

    // 在后台执行任务
    executeSocialTask(taskId, {
      topic,
      title,
      platform: platform as 'xiaohongshu' | 'wechat',
    }, customHeaders);

    return NextResponse.json({ taskId });
  } catch (error) {
    console.error('社交媒体生成请求失败:', error);
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
