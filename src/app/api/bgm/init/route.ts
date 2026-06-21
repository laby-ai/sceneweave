import { NextRequest, NextResponse } from 'next/server';
import { createHuiyingObjectStorage } from '@/lib/huiying-object-storage';

const storage = createHuiyingObjectStorage();

// SoundHelix免版权音乐URL列表
const BGM_SOURCE_URLS = [
  { type: 'relaxed', name: 'relaxed-1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { type: 'relaxed', name: 'relaxed-2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { type: 'upbeat', name: 'upbeat-1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { type: 'upbeat', name: 'upbeat-2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
  { type: 'romantic', name: 'romantic-1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { type: 'romantic', name: 'romantic-2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { type: 'epic', name: 'epic-1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
  { type: 'epic', name: 'epic-2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
  { type: 'nature', name: 'nature-1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { type: 'nature', name: 'nature-2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
  { type: 'cinematic', name: 'cinematic-1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3' },
  { type: 'cinematic', name: 'cinematic-2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' },
];

// 获取BGM存储的key前缀
function getBgmKey(name: string): string {
  return `bgm/${name}.mp3`;
}

// 检查BGM是否已存在
async function checkBgmExists(name: string): Promise<boolean> {
  try {
    return await storage.fileExists({ fileKey: getBgmKey(name) });
  } catch {
    return false;
  }
}

// 初始化/同步BGM到对象存储
async function syncBgmToStorage(): Promise<{
  success: boolean;
  synced: string[];
  failed: string[];
  message: string;
}> {
  const synced: string[] = [];
  const failed: string[] = [];
  
  console.log('[BGM Init] 开始同步BGM到对象存储...');
  
  for (const bgm of BGM_SOURCE_URLS) {
    const key = getBgmKey(bgm.name);
    
    // 检查是否已存在
    const exists = await checkBgmExists(bgm.name);
    if (exists) {
      console.log(`[BGM Init] ${bgm.name} 已存在，跳过`);
      synced.push(bgm.name);
      continue;
    }
    
    try {
      console.log(`[BGM Init] 下载 ${bgm.name}...`);
      const fileKey = await storage.uploadFromUrl({
        url: bgm.url,
        timeout: 300000, // 5分钟超时（音乐文件较大）
      });
      
      // 重命名为标准key
      console.log(`[BGM Init] ${bgm.name} 下载成功，存储为 ${fileKey}`);
      synced.push(bgm.name);
    } catch (error: any) {
      console.error(`[BGM Init] ${bgm.name} 下载失败:`, error.message);
      failed.push(bgm.name);
    }
    
    // 每个BGM间隔3秒，避免限流
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  return {
    success: failed.length === 0,
    synced,
    failed,
    message: `同步完成: ${synced.length} 成功, ${failed.length} 失败`,
  };
}

// GET - 获取BGM列表或触发初始化
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const type = searchParams.get('type'); // 可选：筛选特定类型

  // 初始化BGM
  if (action === 'init') {
    console.log('[BGM Init] 收到初始化请求');
    const result = await syncBgmToStorage();
    return NextResponse.json(result);
  }

  // 获取BGM列表
  try {
    // 列出所有BGM文件
    const listResult = await storage.listFiles({
      prefix: 'bgm/',
      maxKeys: 100,
    });

    // 提取BGM信息
    const bgmList: {
      type: string;
      name: string;
      key: string;
      url: string;
    }[] = [];

    const keys = listResult.keys as unknown as string[];
    for (const key of keys) {
      if (!key.endsWith('.mp3')) continue;

      const fileName = key.replace('bgm/', '').replace('.mp3', '');
      
      // 查找源信息确定类型
      const source = BGM_SOURCE_URLS.find(s => s.name === fileName);
      const bgmType = source?.type || 'unknown';
      
      // 过滤类型
      if (type && bgmType !== type) continue;

      // 生成签名URL
      const url = await storage.generatePresignedUrl({
        key,
        expireTime: 86400 * 7, // 7天有效期
      });

      bgmList.push({
        type: bgmType,
        name: fileName,
        key,
        url,
      });
    }

    // 按类型分组
    const grouped = bgmList.reduce((acc, bgm) => {
      if (!acc[bgm.type]) {
        acc[bgm.type] = [];
      }
      acc[bgm.type].push(bgm);
      return acc;
    }, {} as Record<string, typeof bgmList>);

    return NextResponse.json({
      success: true,
      total: bgmList.length,
      byType: grouped,
      list: bgmList,
      message: bgmList.length > 0 
        ? 'BGM已准备就绪' 
        : 'BGM尚未初始化，请先调用 ?action=init',
    });
  } catch (error: any) {
    console.error('[BGM List] 获取BGM列表失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      hint: '请先调用 ?action=init 初始化BGM',
    }, { status: 500 });
  }
}

// POST - 触发BGM初始化（可选的后台触发方式）
export async function POST(request: NextRequest) {
  // 验证请求来源（可选）
  const body = await request.json().catch(() => ({}));
  
  if (body.action === 'sync') {
    console.log('[BGM Init] POST触发同步');
    // 在后台执行同步（不阻塞响应）
    syncBgmToStorage().then(result => {
      console.log('[BGM Init] 后台同步完成:', result.message);
    }).catch(err => {
      console.error('[BGM Init] 后台同步失败:', err);
    });
    
    return NextResponse.json({
      success: true,
      message: 'BGM同步已在后台启动',
    });
  }

  return NextResponse.json({
    success: false,
    error: '未知操作',
    hint: '使用 POST { action: "sync" } 触发同步',
  });
}
