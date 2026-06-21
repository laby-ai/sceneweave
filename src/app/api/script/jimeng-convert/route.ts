import { NextRequest, NextResponse } from 'next/server';
import { createJimengConvertLLM } from '@/lib/jimeng-convert-llm-client';
import { convertScriptToJimeng, type JimengConvertRequest } from '@/lib/jimeng-convert-service';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body: JimengConvertRequest = await request.json();

    if (!body.script || body.script.trim().length === 0) {
      return NextResponse.json({ error: '剧本内容不能为空' }, { status: 400 });
    }

    const llm = await createJimengConvertLLM(request.headers);
    const result = await convertScriptToJimeng(llm, {
      script: body.script,
      targetDuration: body.targetDuration ?? 120,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('即梦agent转换失败:', error);
    return NextResponse.json(
      { error: '转换失败，请稍后重试' },
      { status: 500 }
    );
  }
}
