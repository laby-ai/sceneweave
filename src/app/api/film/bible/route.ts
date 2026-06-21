import { NextRequest, NextResponse } from 'next/server';

/**
 * 角色圣经 API — 管理角色的完整视觉/行为/关系档案
 * 来自行业调研：核心资产管理系统
 */

// 角色圣经条目
interface CharacterBibleEntry {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'extra';
  // 视觉锚点
  visualAnchors: {
    faceDescription: string;        // 面部特征
    bodyType: string;               // 体型
    skinTone: string;               // 肤色
    distinguishingMarks: string;    // 辨识标记（疤痕/纹身/胎记）
  };
  // 服装系统
  wardrobe: Array<{
    scene: string;                  // 适用场景
    outfit: string;                 // 服装描述
    colorPalette: string[];         // 配色方案
    accessories: string[];          // 配饰
    referenceImage?: string;        // 参考图URL
  }>;
  // 行为模式
  behaviorPatterns: {
    posture: string;                // 体态
    gait: string;                   // 步态
    gestures: string;               // 手势习惯
    expressions: string;            // 表情特征
  };
  // 关系网
  relationships: Array<{
    targetId: string;
    type: 'ally' | 'rival' | 'mentor' | 'student' | 'family' | 'romantic';
    dynamic: string;                // 关系动态描述
  }>;
  // 口头禅/语言风格
  speechStyle: string;
  // 跨镜头一致性约束
  consistencyRules: string[];
}

// 场景圣经条目
interface SceneBibleEntry {
  id: string;
  name: string;
  location: string;
  // 时间属性
  timeOfDay: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night' | 'midnight';
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  // 环境锚点
  environmentAnchors: {
    architecture: string;           // 建筑风格
    vegetation: string;             // 植被
    weather: string;                // 天气
    lighting: string;               // 光照
    soundscape: string;             // 声景
  };
  // 关键道具
  keyProps: Array<{
    name: string;
    description: string;
    placement: string;              // 位置
    referenceImage?: string;
  }>;
  // 色彩基调
  colorMood: {
    primary: string;                // 主色
    secondary: string;              // 辅色
    accent: string;                 // 强调色
    temperature: 'warm' | 'cool' | 'neutral';
  };
  // 摄影约束
  cinematography: {
    preferredAngles: string[];      // 推荐角度
    cameraMovement: string;         // 运镜方式
    depthOfField: string;           // 景深
  };
  // 连续性约束
  continuityRules: string[];
}

// 镜头表条目
interface ShotListEntry {
  id: string;
  sceneId: string;
  shotNumber: number;
  // 镜头规格
  shotType: 'EWS' | 'WS' | 'FS' | 'MS' | 'CU' | 'ECU' | 'POV' | 'OTS';
  cameraAngle: 'eye' | 'high' | 'low' | 'dutch' | 'bird' | 'worm';
  cameraMovement: 'static' | 'pan' | 'tilt' | 'dolly' | 'tracking' | 'crane' | 'handheld' | 'steadicam';
  // 内容描述
  description: string;
  dialogue?: string;
  duration: number;                 // 秒
  // 视觉参考
  referenceImage?: string;
  // 连续性
  characterIds: string[];
  props: string[];
  continuityNotes: string;
  // 技术参数
  aspectRatio: '16:9' | '9:16' | '1:1' | '21:9';
  transition: 'cut' | 'dissolve' | 'wipe' | 'morph' | 'glitch' | 'fade';
}

// 简化存储（内存+文件持久化）
const STORAGE_PATH = '/tmp/dreambox-bibles';

type BibleStore = {
  characters: Map<string, CharacterBibleEntry>;
  scenes: Map<string, SceneBibleEntry>;
  shots: Map<string, ShotListEntry>;
};

let store: BibleStore | null = null;

function getStore(): BibleStore {
  if (!store) {
    store = { characters: new Map(), scenes: new Map(), shots: new Map() };
  }
  return store;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as 'characters' | 'scenes' | 'shots';
  const id = searchParams.get('id');

  const s = getStore();

  if (!type) {
    return NextResponse.json({
      characters: Array.from(s.characters.values()),
      scenes: Array.from(s.scenes.values()),
      shots: Array.from(s.shots.values()),
    });
  }

  const collection = s[type] as Map<string, unknown>;
  if (!collection) {
    return NextResponse.json({ error: '无效类型' }, { status: 400 });
  }

  if (id) {
    const entry = collection.get(id);
    if (!entry) return NextResponse.json({ error: '未找到' }, { status: 404 });
    return NextResponse.json(entry);
  }

  return NextResponse.json(Array.from(collection.values() as IterableIterator<unknown>));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, type, data } = body as {
      action: 'upsert' | 'delete' | 'batch_upsert';
      type: 'characters' | 'scenes' | 'shots';
      data: Record<string, unknown> | Record<string, unknown>[];
    };

    const s = getStore();
    const collection = s[type];
    if (!collection) {
      return NextResponse.json({ error: '无效类型' }, { status: 400 });
    }

    if (action === 'upsert') {
      const entry = data as Record<string, unknown>;
      if (!entry.id) {
        entry.id = `${type.slice(0, -1)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }
      collection.set(entry.id as string, entry as never);
      return NextResponse.json({ success: true, id: entry.id });
    }

    if (action === 'batch_upsert') {
      const entries = data as Record<string, unknown>[];
      const ids: string[] = [];
      for (const entry of entries) {
        if (!entry.id) {
          entry.id = `${type.slice(0, -1)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }
        collection.set(entry.id as string, entry as never);
        ids.push(entry.id as string);
      }
      return NextResponse.json({ success: true, ids });
    }

    if (action === 'delete') {
      const entry = data as { id: string };
      collection.delete(entry.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '无效操作' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
