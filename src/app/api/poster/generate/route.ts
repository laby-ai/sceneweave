import { NextRequest, NextResponse } from 'next/server';
import {
  ImageGenerationClient,
  Config,
  HeaderUtils,
  APIError,
} from 'coze-coding-dev-sdk';

// 色调方案定义
const colorSchemes = {
  bright: {
    name: '明亮色调',
    description: '明亮活泼，充满活力',
    palette: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181']
  },
  dark: {
    name: '暗色色调',
    description: '沉稳大气，高端质感',
    palette: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6', '#BDC3C7']
  },
  warm: {
    name: '暖色色调',
    description: '温暖舒适，亲切友好',
    palette: ['#FF6B6B', '#FFA07A', '#FFD93D', '#FF8C42', '#FFB6C1']
  },
  cool: {
    name: '冷色色调',
    description: '冷静清新，专业稳重',
    palette: ['#3498DB', '#2980B9', '#1ABC9C', '#16A085', '#34495E']
  },
  colorful: {
    name: '多彩色调',
    description: '丰富多彩，活力四射',
    palette: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#45B7D1', '#FFA07A']
  }
};

// 海报尺寸定义
const posterSizes = {
  instagram_post: {
    name: 'Instagram 帖子',
    description: '正方形，适合Instagram帖子',
    width: 1080,
    height: 1080,
    ratio: '1:1',
    apiSize: '2K',
    category: 'social'
  },
  instagram_story: {
    name: 'Instagram 故事',
    description: '竖版，适合Instagram快拍和广告',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    apiSize: '2K',
    category: 'social'
  },
  facebook_post: {
    name: 'Facebook 帖子',
    description: '横版，适合Facebook分享',
    width: 1200,
    height: 630,
    ratio: '19:10',
    apiSize: '2K',
    category: 'social'
  },
  twitter_post: {
    name: 'Twitter 帖子',
    description: '横版，适合Twitter分享',
    width: 1600,
    height: 900,
    ratio: '16:9',
    apiSize: '2K',
    category: 'social'
  },
  wechat_moments: {
    name: '微信朋友圈',
    description: '竖版，适合微信朋友圈',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    apiSize: '2K',
    category: 'social'
  },
  douyin: {
    name: '抖音视频',
    description: '竖版，适合抖音短视频封面',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    apiSize: '2K',
    category: 'social'
  },
  xiaohongshu: {
    name: '小红书',
    description: '竖版，适合小红书笔记',
    width: 1080,
    height: 1440,
    ratio: '3:4',
    apiSize: '2K',
    category: 'social'
  },
  linkedin: {
    name: 'LinkedIn',
    description: '横版，适合LinkedIn专业分享',
    width: 1200,
    height: 627,
    ratio: '19:10',
    apiSize: '2K',
    category: 'social'
  },
  youtube_thumbnail: {
    name: 'YouTube 封面',
    description: '横版，适合YouTube视频封面',
    width: 1280,
    height: 720,
    ratio: '16:9',
    apiSize: '2K',
    category: 'social'
  },
  general_poster: {
    name: '通用海报',
    description: '竖版，适合一般用途海报',
    width: 800,
    height: 1200,
    ratio: '2:3',
    apiSize: '2K',
    category: 'general'
  },
  a4_print: {
    name: 'A4 打印',
    description: '适合A4纸张打印',
    width: 2480,
    height: 3508,
    ratio: '1:1.414',
    apiSize: '2K',
    category: 'print'
  }
};

export async function POST(request: NextRequest) {
  try {
    const { 
      videoUrl,
      keyInfo,
      colorScheme = 'bright',
      size = 'general_poster',
      referenceImages
    } = await request.json();

    if (!videoUrl && !keyInfo) {
      return NextResponse.json(
        { error: '请提供视频 URL 或关键信息' },
        { status: 400 }
      );
    }

    // 获取选择的色调和尺寸
    const selectedColors = colorSchemes[colorScheme as keyof typeof colorSchemes] || colorSchemes.bright;
    const selectedSize = posterSizes[size as keyof typeof posterSizes] || posterSizes.general_poster;

    // 生成文案
    const generatedText = generateCopywriting(keyInfo || videoUrl, selectedColors, selectedSize);

    // 生成海报提示词（用于图片生成）
    let posterPrompt = generatePosterPrompt(keyInfo || '精美视频', selectedColors, selectedSize);

    // 如果有参考图片，在提示词中加入参考信息
    if (referenceImages && referenceImages.length > 0) {
      posterPrompt += `\n参考图片提示：请参考提供的${referenceImages.length}张参考图片的构图、色彩和风格。`;
    }

    // 调用图片生成 API
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const imageClient = new ImageGenerationClient(config, customHeaders);

    const imageRequest: any = {
      prompt: posterPrompt,
      size: selectedSize.apiSize,
      watermark: false,
    };

    // 如果有参考图片，添加到请求中
    if (referenceImages && referenceImages.length > 0) {
      imageRequest.reference_images = referenceImages;
    }

    const imageResponse = await imageClient.generate(imageRequest);

    const imageHelper = imageClient.getResponseHelper(imageResponse);

    if (!imageHelper.success) {
      return NextResponse.json(
        { error: `图片生成失败: ${imageHelper.errorMessages[0]}` },
        { status: 500 }
      );
    }

    const posterUrl = imageHelper.imageUrls[0];

    return NextResponse.json({
      success: true,
      text: generatedText,
      posterUrl: posterUrl,
      posterPrompt,
      videoUrl,
      colorScheme: selectedColors,
      size: selectedSize,
      referenceImages: referenceImages || [],
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error generating poster:', error);

    if (error instanceof APIError) {
      return NextResponse.json(
        { error: `API 错误: ${error.message}` },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: '海报生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}

// 生成文案
function generateCopywriting(
  topic: string,
  colors: any,
  size: any
): string {
  const colorName = colors.name;
  const sizeName = size.name;

  return `# 海报设计方案

## 主题分析
${topic}

## 设计风格
**色调**: ${colorName} - ${colors.description}
**尺寸**: ${sizeName} - ${size.description}

## 规格参数
- 分辨率: ${size.width} x ${size.height} 像素
- 宽高比: ${size.ratio}
- 适用类别: ${size.category === 'social' ? '社交媒体' : size.category === 'print' ? '打印输出' : '通用'}

## 关键信息提取
- 核心卖点：突出产品或服务的独特价值
- 目标受众：针对不同用户群体的需求
- 情感诉求：建立与用户的情感连接

## 推荐文案
### 主标题
专业海报设计，打造令人印象深刻的视觉冲击

### 副标题
采用${colorName}色调，传递独特的品牌氛围

### 正文内容
${topic}体现了现代设计理念，通过简洁的排版方式，营造出${colors.description}的视觉体验。这种设计能够有效吸引目标受众的注意力，传递核心信息。

## 设计建议
1. **色彩应用**: 使用${colors.palette.join('、')}作为主色调
2. **字体选择**: 建议使用简洁现代的字体
3. **留白处理**: 保持适当的留白，增强视觉层次
4. **尺寸适配**: 针对${size.ratio}比例优化设计布局

## 适用场景
- 产品发布
- 品牌推广
- 活动宣传
- 社交媒体分享`;
}

// 生成海报提示词
function generatePosterPrompt(
  topic: string,
  colors: any,
  size: any
): string {
  return `Professional poster design for ${topic}. 
Modern and clean aesthetic style.
Color scheme: ${colors.name} featuring ${colors.palette.slice(0, 3).join(', ')}.
Size: ${size.width}x${size.height} pixels, aspect ratio ${size.ratio}.
Layout: Clean and structured with modern typography optimized for ${size.ratio} ratio.
High quality commercial design, 2K resolution, visually appealing and professional.
Perfect for ${size.category === 'social' ? 'social media' : size.category === 'print' ? 'print' : 'general'} use and marketing promotion.`;
}
