import {
  compileVideoGenerateAudio,
  generateVideoWithProvider,
  isVideoGenerateProviderError,
  synthesizeVideoGenerateSpeech,
} from '@/lib/video-generate-provider-clients';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface VideoGenerateRequest {
  prompt?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
  generateAudio?: boolean;
  watermark?: boolean;
  cameraFixed?: boolean;
  materials?: string[];
  enableSubtitle?: boolean;
  subtitleText?: string;
  subtitlePosition?: string;
  subtitleFontSize?: string;
  subtitleColor?: string;
  subtitleVoiceType?: 'male' | 'female';
  subtitleSpeechSpeed?: number;
  generateVoice?: boolean;
  language?: string;
}

const execAsync = promisify(exec);
const TEMP_DIR = '/tmp/video-subtitles';

// 带超时的fetch函数
async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 60000, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// 清理临时文件函数
function cleanupTempFiles() {
  try {
    if (fs.existsSync(TEMP_DIR)) {
      const files = fs.readdirSync(TEMP_DIR);
      const now = Date.now();
      const maxAge = 60 * 60 * 1000; // 1小时
      
      for (const file of files) {
        const filePath = path.join(TEMP_DIR, file);
        const stats = fs.statSync(filePath);
        
        // 删除超过1小时的临时文件
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`清理临时文件: ${filePath}`);
        }
      }
    }
  } catch (error) {
    console.error('清理临时文件失败:', error);
  }
}

// 定期清理临时文件（每30分钟）
let cleanupTimerStarted = false;
function ensureCleanupTimer() {
  if (cleanupTimerStarted) return;
  cleanupTimerStarted = true;
  setInterval(cleanupTempFiles, 30 * 60 * 1000);
}

// 智能分析提示词，检测是否包含文字内容
function analyzePromptForText(prompt: string, language: string): { hasText: boolean; text: string } {
  // 中文提示词分析
  if (language === 'zh') {
    // 查找引号中的内容
    const quoteMatches = prompt.match(/[“"『「](.*?)[”"』」]/g);
    if (quoteMatches && quoteMatches.length > 0) {
      // 提取引号中的内容
      const text = quoteMatches.map(q => q.replace(/[“"『「”"』」]/g, '')).join(' ');
      return { hasText: true, text };
    }
    
    // 查找"显示"、"写着"、"文字是"等关键词
    const textKeywords = ['显示', '写着', '文字是', '内容是', '上面有', '写的是', '写有', '有文字', '字幕是', '标题是'];
    for (const keyword of textKeywords) {
      if (prompt.includes(keyword)) {
        // 简单提取：关键词后面的内容
        const index = prompt.indexOf(keyword);
        const textAfter = prompt.substring(index + keyword.length).trim();
        // 取前30个字符作为文字内容
        const text = textAfter.substring(0, Math.min(30, textAfter.length)).replace(/[。！？，,.!?].*$/, '');
        if (text.length > 0) {
          return { hasText: true, text };
        }
      }
    }
  } else {
    // 英文提示词分析
    const quoteMatches = prompt.match(/"(.*?)"/g);
    if (quoteMatches && quoteMatches.length > 0) {
      const text = quoteMatches.map(q => q.replace(/"/g, '')).join(' ');
      return { hasText: true, text };
    }
    
    const textKeywords = ['says', 'reads', 'text is', 'shows', 'displaying', 'with text', 'title is', 'caption says'];
    for (const keyword of textKeywords) {
      if (prompt.toLowerCase().includes(keyword)) {
        const index = prompt.toLowerCase().indexOf(keyword);
        const textAfter = prompt.substring(index + keyword.length).trim();
        const text = textAfter.substring(0, Math.min(50, textAfter.length)).replace(/[.!?].*$/, '');
        if (text.length > 0) {
          return { hasText: true, text };
        }
      }
    }
  }
  
  return { hasText: false, text: '' };
}

// 语言和性别到声音ID的映射
const VOICE_MAP: Record<string, { male: string; female: string }> = {
  zh: {
    male: 'zh_male_xiaoming_ailab_712',
    female: 'zh_female_xiaomo_ailab_712',
  },
  en: {
    male: 'en_male_adam_ailab_712',
    female: 'en_female_sara_ailab_712',
  },
  ja: {
    male: 'ja_male_hikaru_ailab_712',
    female: 'ja_female_aoi_ailab_712',
  },
  ko: {
    male: 'ko_male_jun_ailab_712',
    female: 'ko_female_yumi_ailab_712',
  },
  fr: {
    male: 'fr_male_pierre_ailab_712',
    female: 'fr_female_sophie_ailab_712',
  },
  de: {
    male: 'de_male_hans_ailab_712',
    female: 'de_female_anna_ailab_712',
  },
  es: {
    male: 'es_male_carlos_ailab_712',
    female: 'es_female_maria_ailab_712',
  },
};

// 发送SSE事件
function sendSSE(controller: ReadableStreamDefaultController, data: object) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}


export function createVideoGenerateStream(body: VideoGenerateRequest, headers: Headers): ReadableStream<Uint8Array> {
  const {
    prompt,
    duration = 5,
    ratio = '16:9',
    resolution = '720p',
    generateAudio = true,
    watermark = true,
    cameraFixed = false,
    materials = [],
    enableSubtitle = false,
    subtitleText,
    subtitlePosition = 'bottom',
    subtitleFontSize = 'medium',
    subtitleColor = 'white',
    subtitleVoiceType = 'female',
    subtitleSpeechSpeed = 1.0,
    generateVoice = false, // 新增：是否生成配音
    language = 'zh',
  } = body;

  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid video prompt');
  }

  // 创建流式响应
  ensureCleanupTimer();
  return new ReadableStream({
      async start(controller) {
        try {
          // 发送初始进度
          sendSSE(controller, { 
            type: 'progress', 
            progress: 5, 
            stage: '初始化...',
            message: '正在准备视频生成环境' 
          });

          // 创建临时目录
          if (!fs.existsSync(TEMP_DIR)) {
            fs.mkdirSync(TEMP_DIR, { recursive: true });
          }

          // 智能分析提示词，检测是否包含文字内容
          let autoEnableSubtitle = false;
          let extractedText = '';
          
          if (!enableSubtitle) {
            const analysis = analyzePromptForText(prompt, language);
            if (analysis.hasText) {
              autoEnableSubtitle = true;
              extractedText = analysis.text;
              console.log('[Generate API] 智能检测到文字内容，自动启用字幕:', extractedText);
            }
          }

          // 发送进度：配置完成
          sendSSE(controller, { 
            type: 'progress', 
            progress: 10, 
            stage: '理解描述...',
            message: 'AI正在理解您的视频描述' 
          });

          // 构建内容（如果自动启用了字幕，在提示词中强调不要在画面中生成文字）
          let basePrompt = prompt;
          if (autoEnableSubtitle) {
            if (language === 'zh') {
              basePrompt = `${prompt}。【注意：画面中只显示图像，不要出现任何文字，文字将通过字幕显示】`;
            } else {
              basePrompt = `${prompt}. [NOTE: Show only visuals in the画面, no text at all - text will be shown via subtitles]`;
            }
          }
          
          const languagePrompt = language === 'zh' 
            ? basePrompt 
            : `Please create a video in ${language === 'en' ? 'English' : language} language: ${basePrompt}`;
          
          const content = [
            {
              type: 'text' as const,
              text: languagePrompt,
            },
          ];

          // 如果有素材，添加到内容中
          if (materials && materials.length > 0) {
            sendSSE(controller, { 
              type: 'progress', 
              progress: 15, 
              stage: '处理素材...',
              message: `正在处理 ${materials.length} 个素材文件` 
            });
            
            materials.forEach((materialUrl: string) => {
              const isVideo = materialUrl.includes('video') || materialUrl.includes('.mp4') || materialUrl.includes('.webm');
              const contentItem: any = {};
              if (isVideo) {
                contentItem.type = 'video_url' as const;
                contentItem.video_url = { url: materialUrl };
              } else {
                contentItem.type = 'image_url' as const;
                contentItem.image_url = { url: materialUrl };
              }
              content.push(contentItem);
            });
          }

          // 发送进度：开始生成
          sendSSE(controller, { 
            type: 'progress', 
            progress: 20, 
            stage: '生成视频中...',
            message: 'AI正在创作视频，这可能需要一些时间' 
          });

          // doubao-seedance-1-5-pro 模型仅支持 5/10/20/40 秒，将请求时长规范化为最近支持值
          const SUPPORTED_DURATIONS = [5, 10, 20, 40];
          const requestedDuration = typeof duration === 'number' ? duration : 5;
          const normalizedDuration = SUPPORTED_DURATIONS.reduce((prev, curr) =>
            Math.abs(curr - requestedDuration) < Math.abs(prev - requestedDuration) ? curr : prev
          );
          if (normalizedDuration !== requestedDuration) {
            console.log(`[VideoGenerate] 时长规范: ${requestedDuration}s -> ${normalizedDuration}s (模型仅支持 5/10/20/40)`);
          }

          // 调用视频生成 API
          const response = await generateVideoWithProvider(content, {
            model: 'doubao-seedance-1-5-pro-251215',
            duration: normalizedDuration,
            ratio: ratio as any,
            resolution: resolution as any,
            generateAudio: generateAudio,
            watermark: watermark,
            camerafixed: cameraFixed,
          }, headers);

          // 发送进度：视频生成完成
          sendSSE(controller, { 
            type: 'progress', 
            progress: 70, 
            stage: '视频生成完成',
            message: '基础视频已生成，准备后续处理' 
          });

          // 检查生成结果
          if (!response.videoUrl) {
            sendSSE(controller, { 
              type: 'error', 
              error: '视频生成失败，请重试' 
            });
            controller.close();
            return;
          }

          let finalVideoUrl = response.videoUrl;

          // 如果启用了字幕（用户手动启用或自动启用），将字幕叠加到视频上
          const shouldAddSubtitle = (enableSubtitle && subtitleText && subtitleText.trim()) || 
                                    (autoEnableSubtitle && extractedText && extractedText.trim());
          
          if (shouldAddSubtitle) {
            const textToUse = (autoEnableSubtitle ? extractedText : (subtitleText || '')).trim();
            const posToUse = autoEnableSubtitle ? 'bottom' : subtitlePosition;
            const fsToUse = autoEnableSubtitle ? 'medium' : subtitleFontSize;
            const colorToUse = autoEnableSubtitle ? 'white' : subtitleColor;
            
            sendSSE(controller, { 
              type: 'progress', 
              progress: 75, 
              stage: '添加字幕...',
              message: autoEnableSubtitle ? '智能检测到文字内容，正在添加字幕' : '正在为视频添加字幕' 
            });

            try {
              finalVideoUrl = await addSubtitleToVideo(
                response.videoUrl,
                textToUse,
                posToUse,
                fsToUse,
                colorToUse,
                normalizedDuration
              );
              
              sendSSE(controller, { 
                type: 'progress', 
                progress: 95, 
                stage: '字幕添加完成',
                message: '字幕已成功添加到视频' 
              });
            } catch (subtitleError) {
              console.error('字幕添加失败:', subtitleError);
              // 字幕添加失败，返回原始视频
              sendSSE(controller, { 
                type: 'progress', 
                progress: 95, 
                stage: '字幕处理失败',
                message: '字幕添加失败，将返回无字幕视频' 
              });
            }
          } else {
            sendSSE(controller, { 
              type: 'progress', 
              progress: 90, 
              stage: '处理完成',
              message: '视频处理即将完成' 
            });
          }

          // 如果启用了配音生成（用户手动启用或自动启用），将字幕转为音频并合并到视频中
          const textForVoice = autoEnableSubtitle ? extractedText : subtitleText;
          if ((generateVoice || autoEnableSubtitle) && textForVoice && textForVoice.trim()) {
            sendSSE(controller, { 
              type: 'progress', 
              progress: 92, 
              stage: '生成配音...',
              message: autoEnableSubtitle ? '正在将文字转换为语音' : '正在将字幕转换为语音' 
            });

            try {
              // 获取对应语言和性别的声音ID
              const voiceConfig = VOICE_MAP[language] || VOICE_MAP['zh'];
              const speakerId = voiceConfig[subtitleVoiceType as 'male' | 'female'] || voiceConfig.female;
              
              // 生成TTS音频
              const ttsResponse = await synthesizeVideoGenerateSpeech({
                uid: uuidv4(),
                text: textForVoice,
                speaker: speakerId,
                speechRate: Math.round((subtitleSpeechSpeed - 1) * 10), // 转换为-10到10的范围
              }, headers);

              sendSSE(controller, { 
                type: 'progress', 
                progress: 96, 
                stage: '合并音视频...',
                message: '正在将配音合并到视频中' 
              });

              const compileResponse = await compileVideoGenerateAudio(
                finalVideoUrl,
                ttsResponse.audioUri,
                headers
              );

              if (compileResponse.url) {
                finalVideoUrl = compileResponse.url;
                sendSSE(controller, { 
                  type: 'progress', 
                  progress: 98, 
                  stage: '配音合并完成',
                  message: '配音已成功添加到视频' 
                });
              }
            } catch (voiceError) {
              console.error('配音生成失败:', voiceError);
              sendSSE(controller, { 
                type: 'progress', 
                progress: 98, 
                stage: '配音处理失败',
                message: '配音生成失败，将返回无配音视频' 
              });
            }
          }

          // 发送完成结果
          sendSSE(controller, { 
            type: 'complete', 
            progress: 100, 
            stage: '完成！',
            message: '视频生成成功',
            data: {
              success: true,
              videoUrl: finalVideoUrl,
              duration: response.response.duration,
              ratio: response.response.ratio,
              resolution: response.response.resolution,
              taskId: response.response.id,
              materials: materials,
              hasSubtitle: (enableSubtitle || autoEnableSubtitle) && finalVideoUrl !== response.videoUrl,
              autoSubtitleEnabled: autoEnableSubtitle,
              autoSubtitleText: autoEnableSubtitle ? extractedText : undefined,
            }
          });

          controller.close();
        } catch (error) {
          console.error('视频生成错误:', error);
          
          let errorMessage = '服务器错误，请稍后重试';
          if (isVideoGenerateProviderError(error)) {
            errorMessage = `API 错误: ${error.message}`;
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }

          sendSSE(controller, { 
            type: 'error', 
            error: errorMessage 
          });
          controller.close();
        }
      }
    });


}

const FONT_SIZE_MAP: Record<string, number> = {
  small: 24,
  medium: 32,
  large: 48,
};

// 添加字幕到视频
async function addSubtitleToVideo(
  videoUrl: string,
  subtitleText: string,
  position: string,
  fontSize: string,
  color: string,
  duration: number
): Promise<string> {
  const videoId = uuidv4();
  const inputPath = path.join(TEMP_DIR, `${videoId}_input.mp4`);
  const outputPath = path.join(TEMP_DIR, `${videoId}_output.mp4`);
  const subtitleTextPath = path.join(TEMP_DIR, `${videoId}_subtitle.txt`);

  try {
    // 下载视频（带超时）
    console.log('下载视频...');
    const response = await fetchWithTimeout(videoUrl, { timeout: 120000 }); // 2分钟超时
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(inputPath, Buffer.from(buffer));

    // 先把字幕文本写入 UTF-8 文件
    console.log('写入字幕文本文件...');
    const cleanText = subtitleText.replace(/\n/g, ' ').trim();
    fs.writeFileSync(subtitleTextPath, cleanText, 'utf8');

    // 使用 drawtext 滤镜，明确指定中文字体
    console.log('添加字幕到视频...');
    
    const fontSizeValue = FONT_SIZE_MAP[fontSize] || FONT_SIZE_MAP.medium;
    const colorValue = color === 'black' ? 'black' : 'white';
    
    // 根据位置设置字幕位置
    let yPosition: string;
    switch (position) {
      case 'top':
        yPosition = '50';
        break;
      case 'middle':
        yPosition = '(h-text_h)/2';
        break;
      case 'bottom':
      default:
        yPosition = 'h-50';
        break;
    }

    // 使用 drawtext 滤镜，明确指定中文字体
    const ffmpegCommand = `ffmpeg -y -i "${inputPath}" -vf "drawtext=fontfile='/usr/share/fonts/truetype/wqy/wqy-microhei.ttc':textfile='${subtitleTextPath}':x=(w-text_w)/2:y=${yPosition}:fontsize=${fontSizeValue}:fontcolor=${colorValue}:bordercolor=black:borderw=2" -c:a copy "${outputPath}"`;
    
    console.log('执行FFmpeg命令:', ffmpegCommand);
    await execAsync(ffmpegCommand, { timeout: 180000 }); // 3分钟超时

    // 检查输出文件是否存在
    if (!fs.existsSync(outputPath)) {
      throw new Error('字幕添加失败，输出文件未生成');
    }

    // 上传处理后的视频到对象存储
    console.log('上传处理后的视频...');
    const videoBuffer = fs.readFileSync(outputPath);
    const uploadResponse = await fetchWithTimeout(
      `${process.env.NEXT_PUBLIC_API_URL || ''}/api/upload`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'video/mp4',
        },
        body: videoBuffer,
        timeout: 120000,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error('上传视频失败');
    }

    const uploadData = await uploadResponse.json();
    
    console.log('字幕添加完成');
    
    // 清理临时文件
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    if (fs.existsSync(subtitleTextPath)) fs.unlinkSync(subtitleTextPath);

    return uploadData.url || videoUrl;
  } catch (error) {
    console.error('添加字幕失败:', error);
    
    // 清理临时文件
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    if (fs.existsSync(subtitleTextPath)) fs.unlinkSync(subtitleTextPath);
    
    throw error;
  }
}
