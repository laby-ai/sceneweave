import { NextRequest, NextResponse } from 'next/server';
import { createHuiyingObjectStorage } from '@/lib/huiying-object-storage';

const storage = createHuiyingObjectStorage();

export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: '请使用 multipart/form-data 格式上传文件' },
        { status: 400 }
      );
    }
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '请提供文件' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const safeName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^[_]+/, '')
      .replace(/[_]+$/, '');

    const fileName = `uploads/${Date.now()}_${safeName}`;

    const key = await storage.uploadFile({
      fileContent: buffer,
      fileName,
      contentType: file.type || 'application/octet-stream',
    });

    const url = await storage.generatePresignedUrl({
      key,
      expireTime: 86400 * 7, // 7天有效期
    });

    return NextResponse.json({
      success: true,
      key,
      url,
      name: file.name,
      type: file.type,
      size: file.size,
    });
  } catch (error) {
    console.error('[Upload] 上传失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '上传失败' },
      { status: 500 }
    );
  }
}
