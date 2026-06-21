import type { StoryboardShot } from '@/types/storyboard';

export const WORKING_STORYBOARD_SPEAKER = 'zh_female_xiaohe_uranus_bigtts';

export const STORYBOARD_VOICE_MAP: Record<string, { male: string; female: string }> = {
  zh: {
    male: 'zh_male_chunlv_moon_bigtts',
    female: WORKING_STORYBOARD_SPEAKER,
  },
  en: { male: 'male-en-us', female: WORKING_STORYBOARD_SPEAKER },
  ja: { male: 'male-jp', female: WORKING_STORYBOARD_SPEAKER },
  ko: { male: 'male-kr', female: WORKING_STORYBOARD_SPEAKER },
};

export const STORYBOARD_BGM_MAP: Record<string, string> = {
  none: '',
  relaxed: '轻松舒缓的背景音乐',
  upbeat: '活力动感的背景音乐',
  romantic: '浪漫温馨的背景音乐',
  epic: '史诗大气的背景音乐',
  nature: '自然环境音效',
  cinematic: '电影感配乐',
};

export const STORYBOARD_BGM_TTS_PROMPTS: Record<string, string> = {
  relaxed: '轻柔的环境音，柔和的微风声，远处海浪轻轻拍打，带来宁静放松的氛围',
  upbeat: '欢快的节奏，明快的节拍，充满活力和动感的氛围',
  romantic: '温柔浪漫的旋律，甜蜜温馨的钢琴曲',
  epic: '宏大壮阔的交响乐，震撼人心的史诗级配乐',
  nature: '鸟鸣啾啾，溪水潺潺，自然和谐的环境音',
  cinematic: '电影级配乐，戏剧性的弦乐，紧张而富有张力',
  electronic: '现代电子合成器音色，未来感和科技感强烈',
  jazz: '优雅的爵士乐，萨克斯即兴演奏，温暖醇厚',
  classical: '古典交响乐，庄重典雅，永恒经典',
  rock: '电吉他和强劲鼓点，充满力量和反叛精神',
  acoustic: '木吉他的民谣风格，质朴真诚，温暖怀旧',
  ambient: '空灵的氛围音乐，大量混响和延音，深邃神秘',
  suspense: '不协和音程和低频脉冲，营造不安和期待感',
  comedy: '俏皮活泼的配乐，木管乐器和拨弦，轻松愉快',
  corporate: '干净利落的商业配乐，传达信任和专业感',
  lofi: '带颗粒感的低保真节拍，温暖怀旧，松弛舒适',
  world: '各民族传统音乐元素，异域风情浓郁',
  holiday: '喜庆热闹的节日音乐，欢乐祥和',
  chinese: '古筝琵琶笛子等中国传统乐器，东方古韵',
  trap: '重低音808鼓机和快速hi-hat，暗黑氛围说唱节拍',
  rnb: '丝滑的R&B节奏，醇厚人声和电钢琴',
  reggae: '轻松的雷鬼节拍，加勒比海岛风情',
  motivational: '层层递进的钢琴和弦乐，从低沉到高昂的励志弧线',
  retro: '80年代合成器波和复古迪斯科，霓虹复古美学',
};

export function allocateGlobalNineGridToShots(
  globalImages: string[],
  shots: StoryboardShot[]
): Map<number, string[]> {
  const allocation = new Map<number, string[]>();

  if (globalImages.length === 0 || shots.length === 0) {
    return allocation;
  }

  const totalDuration = shots.reduce((sum, shot) => sum + shot.duration, 0);
  const imageCount = globalImages.length;

  console.log(`[GlobalNineGrid] 开始分配 ${imageCount} 张图片到 ${shots.length} 个分镜头`);
  console.log(`[GlobalNineGrid] 总时长: ${totalDuration}秒`);

  let currentImageIndex = 0;

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const ratio = shot.duration / totalDuration;
    const allocatedCount = Math.max(1, Math.round(ratio * imageCount));
    const actualCount = Math.min(allocatedCount, imageCount - currentImageIndex);
    const finalCount = i === shots.length - 1 ? imageCount - currentImageIndex : actualCount;
    const allocatedImages = globalImages.slice(currentImageIndex, currentImageIndex + finalCount);

    allocation.set(i, allocatedImages);
    console.log(`[GlobalNineGrid] 分镜头 ${i + 1}: 分配 ${finalCount} 张图片 (索引 ${currentImageIndex}-${currentImageIndex + finalCount - 1})`);

    currentImageIndex += finalCount;
  }

  return allocation;
}

export function getFirstFrameForShot(
  shotIndex: number,
  previousLastFrameUrl: string | undefined,
  allocatedImages: string[]
): string | undefined {
  if (shotIndex === 0) {
    return allocatedImages[0];
  }

  return previousLastFrameUrl || allocatedImages[0];
}

export function splitSubtitleText(text: string, segmentCount: number): string[] {
  const cleaned = text.trim();
  if (!cleaned) return Array(segmentCount).fill('');

  const sentences = cleaned.split(/(?<=[。！？.!?\n])/).map(s => s.trim()).filter(Boolean);

  if (sentences.length <= segmentCount) {
    const result: string[] = [];
    for (let i = 0; i < segmentCount; i++) {
      result.push(sentences[i] || '');
    }
    if (sentences.length > segmentCount) {
      result[segmentCount - 1] += sentences.slice(segmentCount).join('');
    }
    return result;
  }

  const result: string[] = Array(segmentCount).fill('');
  const baseSize = Math.floor(sentences.length / segmentCount);
  const remainder = sentences.length % segmentCount;
  let sentenceIdx = 0;

  for (let i = 0; i < segmentCount; i++) {
    const count = baseSize + (i < remainder ? 1 : 0);
    result[i] = sentences.slice(sentenceIdx, sentenceIdx + count).join('');
    sentenceIdx += count;
  }

  return result;
}
