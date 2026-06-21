import { NextRequest, NextResponse } from 'next/server';
import {
  parseSRT,
  exportToSRT,
  parseASS,
  exportToASS,
  parseSubtitlePrompt,
  proofreadSubtitle,
  smartSplitText,
  assignTimelines,
} from '@/lib/subtitle-utils';
import type { ParsedSubtitlePrompt } from '@/lib/subtitle-utils';

// POST /api/subtitle/import - 导入字幕文件
export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: '请使用 multipart/form-data 格式上传字幕文件' },
        { status: 400 }
      );
    }
    const file = formData.get('file') as File;
    const format = (formData.get('format') as string) || 'auto';
    
    if (!file) {
      return NextResponse.json({ error: '请选择要导入的字幕文件' }, { status: 400 });
    }
    
    const content = await file.text();
    const fileName = file.name.toLowerCase();
    
    // 自动检测格式
    let detectedFormat = format;
    if (format === 'auto') {
      if (fileName.endsWith('.srt') || content.includes('-->')) {
        detectedFormat = 'srt';
      } else if (fileName.endsWith('.ass') || content.startsWith('[Script Info]')) {
        detectedFormat = 'ass';
      }
    }
    
    let segments;
    
    if (detectedFormat === 'srt') {
      segments = parseSRT(content);
    } else if (detectedFormat === 'ass') {
      segments = parseASS(content);
    } else {
      return NextResponse.json({ error: '不支持的文件格式，仅支持 .srt 和 .ass' }, { status: 400 });
    }
    
    console.log(`[Subtitle Import] 成功导入 ${segments.length} 条字幕 (${detectedFormat})`);
    
    return NextResponse.json({
      success: true,
      format: detectedFormat,
      segments,
      count: segments.length,
    });
  } catch (error: any) {
    console.error('[Subtitle Import Error]:', error);
    return NextResponse.json(
      { error: `导入失败: ${error.message || '未知错误'}` },
      { status: 500 }
    );
  }
}

// GET /api/subtitle/export?format=srt&style=... - 导出字幕文件
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'srt';
    const segmentsJson = searchParams.get('segments');
    
    if (!segmentsJson) {
      return NextResponse.json({ error: '缺少 segments 参数' }, { status: 400 });
    }
    
    const segments = JSON.parse(segmentsJson);
    
    // 解析样式参数
    const style = searchParams.get('style')
      ? JSON.parse(searchParams.get('style')!)
      : undefined;
    
    let content: string;
    let mimeType: string;
    let extension: string;
    
    if (format === 'srt' || format === 'ass') {
      if (format === 'srt') {
        content = exportToSRT(segments);
        mimeType = 'text/plain; charset=utf-8';
        extension = 'srt';
      } else {
        content = exportToASS(segments, style);
        mimeType = 'text/plain; charset=utf-8';
        extension = 'ass';
      }
      
      // 返回文件下载
      return new NextResponse(content, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="subtitles.${extension}"`,
        },
      });
    } else {
      return NextResponse.json({ error: `不支持的导出格式: ${format}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Subtitle Export Error]:', error);
    return NextResponse.json(
      { error: `导出失败: ${error.message || '未知错误'}` },
      { status: 500 }
    );
  }
}

// PUT /api/subtitle/parse-prompt - 解析 QClaw 风格提示词
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body as { prompt: string };
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: '请输入提示词内容' }, { status: 400 });
    }
    
    const result: ParsedSubtitlePrompt = parseSubtitlePrompt(prompt);
    
    console.log(`[Subtitle Prompt Parse] 动作=${result.action}, 置信度=${result.parseConfidence}`);
    
    return NextResponse.json({
      success: true,
      parsed: result,
    });
  } catch (error: any) {
    console.error('[Subtitle Prompt Parse Error]:', error);
    return NextResponse.json(
      { error: `解析失败: ${error.message || '未知错误'}` },
      { status: 500 }
    );
  }
}
