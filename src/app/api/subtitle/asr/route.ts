import { NextRequest, NextResponse } from 'next/server';
import { smartSplitText, assignTimelines, calculateDuration } from '@/lib/subtitle-utils';
import type { SubtitleSegment } from '@/constants/subtitles';

/**
 * POST /api/subtitle/asr
 * 
 * 语音识别自动生成字幕
 * 支持两种模式：
 * 1. 音频文件上传模式：接收音频文件，返回识别后的字幕
 * 2. 已有文本+音频时长模式：接收纯文本，智能断句并分配时间轴
 */
export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: '请使用 multipart/form-data 格式提交（含 audioFile 或 textContent）' },
        { status: 400 }
      );
    }
    const audioFile = formData.get('audioFile') as File | null;
    const textContent = formData.get('textContent') as string | null;
    const videoDuration = parseFloat(formData.get('videoDuration') as string) || 0;
    const language = (formData.get('language') as string) || 'zh-CN';
    const maxCharsPerLine = parseInt(formData.get('maxCharsPerLine') as string) || 18;
    const enableSpeakerDetection = formData.get('enableSpeakerDetection') === 'true';

    // 模式1: 纯文本导入（无音频文件）
    if (!audioFile && textContent) {
      return await handleTextImport(textContent, videoDuration, language, maxCharsPerLine);
    }

    // 模式2: 音频文件 ASR
    if (audioFile) {
      return await handleAudioASR(audioFile, language, enableSpeakerDetection);
    }

    return NextResponse.json(
      { error: '请提供音频文件(audioFile)或文本内容(textContent)' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Subtitle ASR Error]:', error);
    return NextResponse.json(
      { error: `ASR处理失败: ${error.message || '未知错误'}` },
      { status: 500 }
    );
  }
}

/**
 * 处理纯文本导入：智能断句 + 时间轴分配
 */
async function handleTextImport(
  textContent: string,
  videoDuration: number,
  _language: string,
  maxCharsPerLine: number
): Promise<NextResponse> {
  console.log(`[Text Import] 文本长度=${textContent.length}, 视频时长=${videoDuration}s`);

  // 1. 清理文本
  let cleanedText = textContent
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  // 2. 智能断句
  const sentences = smartSplitText(cleanedText, {
    maxCharsPerLine: maxCharsPerLine,
    preferSingleLine: true,
  });

  console.log(`[Text Import] 断句结果: ${sentences.length} 条`);

  // 3. 分配时间轴
  let segments: SubtitleSegment[];

  if (videoDuration > 0) {
    // 有视频时长：均匀分配时间
    segments = assignTimelines(sentences, videoDuration, {
      minDuration: 0.8,
    });
  } else {
    // 无视频时长：使用默认时长（每条2秒）
    segments = sentences.map((text, index) => ({
      id: `segment-${Date.now()}-${index}`,
      text,
      startTime: index * 2,
      endTime: (index + 1) * 2,
      style: undefined,
    }));
  }

  // 4. 计算总时长
  const totalDuration = segments.length > 0
    ? segments[segments.length - 1].endTime
    : 0;

  return NextResponse.json({
    success: true,
    mode: 'text-import',
    segments,
    count: segments.length,
    totalDuration,
    metadata: {
      originalLength: textContent.length,
      segmentCount: segments.length,
      avgCharsPerSegment: Math.round(textContent.length / segments.length),
    },
  });
}

/**
 * 处理音频文件 ASR 识别
 * 
 * 注意：当前实现为预留接口结构。
 * 实际生产环境需要接入 Whisper / 阿里云 ASR / 腾讯云 ASR 等服务。
 * 此处提供模拟实现用于开发测试。
 */
async function handleAudioASR(
  audioFile: File,
  language: string,
  enableSpeakerDetection: boolean
): Promise<NextResponse> {
  console.log(`[Audio ASR] 文件名=${audioFile.name}, 大小=${audioFile.size}bytes, 语言=${language}`);

  // 检查文件类型
  const validTypes = [
    'audio/mpeg',
    'audio/wav',
    'audio/mp3',
    'audio/mp4',
    'audio/x-m4a',
    'audio/ogg',
    'video/webm', // 可能包含音频轨道
  ];

  if (!validTypes.includes(audioFile.type) && !audioFile.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i)) {
    return NextResponse.json(
      { error: '不支持的音频格式，请使用 MP3/WAV/M4A/OGG 格式' },
      { status: 400 }
    );
  }

  // ===== 实际 ASR 服务集成点 =====
  // TODO: 根据实际使用的 ASR 服务替换以下模拟逻辑
  //
  // 示例：阿里云 ASR
  // import { createASRClient } from '@/lib/asr-client';
  // const client = createASRClient(process.env.ALIYUN_ACCESS_KEY_ID!);
  // const result = await client.recognize(audioFile.buffer, { language });
  //
  // 示例：OpenAI Whisper
  // const formData = new FormData();
  // formData.append('file', audioFile);
  // formData.append('model', 'whisper-1');
  // formData.append('language', language === 'zh-CN' ? 'zh' : 'en');
  // const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  //   body: formData,
  // });
  // const result = await response.json();

  // 当前：返回提示信息，引导用户配置 ASR 服务
  return NextResponse.json({
    success: false,
    mode: 'audio-asr',
    error: 'ASR_SERVICE_NOT_CONFIGURED',
    message: '语音识别服务尚未配置。请在环境变量中设置 ASR 服务参数后重试。',
    hint: '可暂时使用"文本导入"模式：粘贴文案内容，系统将自动断句并分配时间轴。',
    receivedFile: {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type,
    },
    requestedOptions: {
      language,
      enableSpeakerDetection,
    },
  }, { status: 501 }); // 501 Not Implemented
}
