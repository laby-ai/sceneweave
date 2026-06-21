import { NextRequest, NextResponse } from 'next/server';
import { createHuiyingObjectStorage } from '@/lib/huiying-object-storage';

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
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: '请选择要上传的文件' },
        { status: 400 }
      );
    }

    // 检查文件类型
    const imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    const docTypes = ['application/pdf', 'text/plain', 'text/markdown',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    const allowedTypes = [...imageTypes, ...videoTypes, ...docTypes];
    const isValidType = allowedTypes.includes(file.type) || file.type.startsWith('image/') || file.type.startsWith('video/');

    if (!isValidType) {
      return NextResponse.json(
        { error: '支持的格式：图片(png/jpg/gif/webp)、视频(mp4/webm/mov)、文档(pdf/txt/docx/xlsx/pptx)' },
        { status: 400 }
      );
    }

    // 检查文件大小（最大 100MB）
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '文件大小不能超过 50MB' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const fileBuffer = await file.arrayBuffer();

    const storage = createHuiyingObjectStorage();

    // 生成文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 9);
    const fileName = `materials/${timestamp}_${randomStr}_${file.name}`;

    // 上传文件
    const fileKey = await storage.uploadFile({
      fileContent: Buffer.from(fileBuffer),
      fileName: fileName,
      contentType: file.type,
    });

    // 生成签名 URL
    const url = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400 * 30, // 30 天
    });

    return NextResponse.json({
      success: true,
      url,
      fileKey,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error uploading material:', error);
    return NextResponse.json(
      { error: '上传失败，请重试' },
      { status: 500 }
    );
  }
}
