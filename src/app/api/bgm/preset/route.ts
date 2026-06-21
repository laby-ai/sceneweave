import { NextResponse } from 'next/server';
import { PRESET_BGM_MAP } from '@/lib/bgm-manager';

// 获取背景音乐URL
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const random = searchParams.get('random') !== 'false'; // 默认随机选择

  if (!type) {
    // 返回所有可用的音乐类型
    return NextResponse.json({
      success: true,
      types: Object.entries(PRESET_BGM_MAP).map(([key, value]) => ({
        type: key,
        name: value.name,
        description: value.description,
        count: value.urls.length,
      })),
    });
  }

  const bgmInfo = PRESET_BGM_MAP[type];
  if (!bgmInfo) {
    return NextResponse.json({
      success: false,
      error: `未找到类型为 ${type} 的背景音乐`,
    }, { status: 404 });
  }

  // 随机选择一个URL或返回列表
  let urls = bgmInfo.urls;
  if (random) {
    const randomIndex = Math.floor(Math.random() * urls.length);
    return NextResponse.json({
      success: true,
      type,
      name: bgmInfo.name,
      url: urls[randomIndex],
      allUrls: urls,
    });
  }

  return NextResponse.json({
    success: true,
    type,
    name: bgmInfo.name,
    urls,
  });
}
