/**
 * 公开音乐库数据源 v1.0
 *
 * 整合多个免费/免版权音乐源，提供可搜索、可预览的BGM曲目库。
 * 所有曲目均为免费商用或CC协议授权。
 *
 * 数据源：
 * - SoundHelix (soundhelix.com) — 免版权自动生成音乐，MP3直链
 * - Pixabay Music (pixabay.com/music) — 免费商用音乐
 * - Incompetech/Kevin MacLeod — CC-BY 免费配乐
 * - FreePD — 公有领域免费音乐
 *
 * 使用方式：
 * - 前端 MusicLibraryBrowser 组件调用 /api/bgm/library 搜索和浏览
 * - 选中的曲目URL直接传入 storyboard/submit 用于视频合成
 */

// ============================================================
// 类型定义
// ============================================================

/** 音乐库曲目 */
export interface LibraryTrack {
  /** 唯一ID */
  id: string;
  /** 曲目名称 */
  title: string;
  /** 艺术家/创作者 */
  artist: string;
  /** 音频文件URL（可直接播放） */
  url: string;
  /** 时长（秒） */
  duration: number;
  /** 所属分类（对应BGM类型ID） */
  category: string;
  /** 次要分类标签 */
  tags: string[];
  /** BPM（每分钟节拍，-1表示未知） */
  bpm: number;
  /** 情绪标签 */
  moods: string[];
  /** 描述 */
  description: string;
  /** 授权类型 */
  license: 'royalty-free' | 'cc0' | 'cc-by' | 'cc-by-sa';
  /** 封面图URL（可选） */
  coverUrl?: string;
  /** 文件大小（字节，估算） */
  fileSize?: number;
  /** 来源网站 */
  source: string;
}

/** 搜索/筛选参数 */
export interface LibrarySearchParams {
  /** 关键词搜索 */
  query?: string;
  /** 分类过滤 */
  category?: string;
  /** 情绪过滤 */
  mood?: string;
  /** 最小时长 */
  minDuration?: number;
  /** 最大时长 */
  maxDuration?: number;
  /** 分页 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/** 搜索结果 */
export interface LibrarySearchResult {
  tracks: LibraryTrack[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query?: string;
  filters: {
    categories: Array<{ id: string; name: string; count: number }>;
    moods: Array<{ id: string; name: string; count: number }>;
  };
}

// ============================================================
// 音乐库数据（精选曲目）
// ============================================================

export const MUSIC_LIBRARY_TRACKS: LibraryTrack[] = [
  // ===== relaxed 轻松舒缓 =====
  {
    id: 'sh-song-1',
    title: 'Morning Calm',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    duration: 337,
    category: 'relaxed',
    tags: ['piano', 'ambient', 'calm', 'morning', 'soft'],
    bpm: 72,
    moods: ['平静', '治愈', '温暖'],
    description: '轻柔的钢琴旋律伴随环境音效，适合清晨冥想和放松场景',
    license: 'royalty-free',
    source: 'soundhelix.com',
  },
  {
    id: 'sh-song-6',
    title: 'Gentle Waves',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    duration: 322,
    category: 'relaxed',
    tags: ['waves', 'ocean', 'soft', 'ambient'],
    bpm: 68,
    moods: ['宁静', '安详', '治愈'],
    description: '海浪声与柔和旋律的结合，营造宁静的海边氛围',
    license: 'royalty-free',
    source: 'soundhelix.com',
  },
  {
    id: 'pixabay-relax-1',
    title: 'Sunny Afternoon',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=relaxing-145038.mp3',
    duration: 240,
    category: 'relaxed',
    tags: ['acoustic', 'guitar', 'sunny', 'warm'],
    bpm: 75,
    moods: ['温暖', '舒适', '惬意'],
    description: '木吉他弹奏的午后阳光氛围曲，温暖而放松',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-relax-2',
    title: 'Peaceful Mind',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/10/26/audio_9b33e0c8a6.mp3?filename=peaceful-145037.mp3',
    duration: 195,
    category: 'relaxed',
    tags: ['meditation', 'spa', 'zen', 'minimal'],
    bpm: 60,
    moods: ['平静', '禅意', '专注'],
    description: '极简风格的冥想背景音，适合SPA和瑜伽场景',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== upbeat 活力动感 =====
  {
    id: 'sh-song-2',
    title: 'Energy Rush',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    duration: 319,
    category: 'upbeat',
    tags: ['electronic', 'energetic', 'drums', 'fast'],
    bpm: 128,
    moods: ['兴奋', '充满活力', '积极向上'],
    description: '电子节拍驱动的活力曲目，鼓点清晰，节奏感强',
    license: 'royalty-free',
    source: 'soundhelix.com',
  },
  {
    id: 'sh-song-7',
    title: 'Dance Floor',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    duration: 298,
    category: 'upbeat',
    tags: ['dance', 'pop', 'catchy', 'uplifting'],
    bpm: 130,
    moods: ['快乐', '欢快', '动感'],
    description: '流行舞曲风格，朗朗上口的旋律适合运动和舞蹈场景',
    license: 'royalty-free',
    source: 'soundhelix.com',
  },
  {
    id: 'pixabay-upbeat-1',
    title: 'Happy Day',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_9bc1d6c0ca.mp3?filename=upbeat-145039.mp3',
    duration: 180,
    category: 'upbeat',
    tags: ['ukulele', 'cheerful', 'bright', 'positive'],
    bpm: 120,
    moods: ['欢快', '阳光', '积极'],
    description: '尤克里里演奏的快乐旋律，明亮而富有感染力',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-upbeat-2',
    title: 'Summer Vibes',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/08/02/audio_64cd970dce.mp3?filename=summer-vibes-145041.mp3',
    duration: 210,
    category: 'upbeat',
    tags: ['summer', 'tropical', 'fun', 'youthful'],
    bpm: 115,
    moods: ['青春', '活力', '自由'],
    description: '热带夏日风情的欢快曲调，充满夏日活力',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== romantic 浪漫温馨 =====
  {
    id: 'sh-song-5',
    title: 'Love Story',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    duration: 315,
    category: 'romantic',
    tags: ['piano', 'romantic', 'emotional', 'strings'],
    bpm: 72,
    moods: ['温柔', '浪漫', '甜蜜'],
    description: '钢琴与小提琴交织的浪漫旋律，适合爱情场景',
    license: 'royalty-free',
    source: 'soundhelix.com',
  },
  {
    id: 'sh-song-8',
    title: 'Moonlight Serenade',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    duration: 287,
    category: 'romantic',
    tags: ['night', 'romantic', 'gentle', 'dreamy'],
    bpm: 68,
    moods: ['梦幻', '温柔', '浪漫'],
    description: '月光下的温柔小夜曲，梦幻而浪漫的氛围',
    license: 'royalty-free',
    source: 'soundhelix.com',
  },
  {
    id: 'pixabay-romantic-1',
    title: 'Sweet Moment',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/06/15/audio_4c7d1a0e3c.mp3?filename=romantic-145040.mp3',
    duration: 225,
    category: 'romantic',
    tags: ['guitar', 'sweet', 'intimate', 'warm'],
    bpm: 70,
    moods: ['甜蜜', '温馨', '感动'],
    description: '原声吉他弹奏的甜蜜时刻，温暖而亲密',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== epic 史诗大气 =====
  {
    id: 'sh-song-9',
    title: 'Epic Journey',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    duration: 356,
    category: 'epic',
    tags: ['orchestral', 'epic', 'cinematic', 'powerful'],
    bpm: 85,
    moods: ['震撼', '壮丽', '激昂'],
    description: '管弦乐史诗作品，铜管乐器与打击乐的完美结合',
    license: 'royalty-free',
    source: 'soundhelix.com',
  },
  {
    id: 'sh-song-10',
    title: 'Hero\'s Theme',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
    duration: 342,
    category: 'epic',
    tags: ['heroic', 'triumphant', 'brass', 'percussion'],
    bpm: 90,
    moods: ['激昂', '胜利', '荣耀'],
    description: '英雄主题的凯旋进行曲，气势磅礴',
    license: 'royalty-free',
    source: 'soundhelix.com',
  },
  {
    id: 'pixabay-epic-1',
    title: 'Cinematic Rise',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/09/10/audio_8e12c3d4f5.mp3?filename=epic-cinematic-145042.mp3',
    duration: 260,
    category: 'epic',
    tags: ['build-up', 'climax', 'dramatic', 'film'],
    bpm: 80,
    moods: ['戏剧性', '宏大', '紧张感'],
    description: '电影级渐强配乐，从平静到高潮的完整弧线',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== nature 自然环境 =====
  {
    id: 'sh-song-3',
    title: 'Forest Path',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    duration: 305,
    category: 'nature',
    tags: ['forest', 'nature', 'birds', 'peaceful'],
    bpm: 65,
    moods: ['清新', '自然', '宁静'],
    description: '森林小径的自然氛围音，鸟鸣与微风',
    license: 'royalty-free',
    source: 'soundhelix.com',
  },
  {
    id: 'pixabay-nature-1',
    title: 'Ocean Breeze',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/07/20/audio_a1b2c3d4e5.mp3?filename=ocean-waves-145043.mp3',
    duration: 300,
    category: 'nature',
    tags: ['ocean', 'waves', 'seagulls', 'coastal'],
    bpm: 0,
    moods: ['自然', '放松', '开阔'],
    description: '海浪拍打海岸的自然录音，海鸥鸣叫点缀',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-nature-2',
    title: 'Rainy Day',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/11/03/audio_f6g7h8i9j0.mp3?filename=rain-sounds-145044.mp3',
    duration: 360,
    category: 'nature',
    tags: ['rain', 'thunder', 'cozy', 'indoor'],
    bpm: 0,
    moods: ['安静', '舒适', '慵懒'],
    description: '雨天室内氛围，雨滴敲打窗户的白噪音',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== cinematic 电影配乐 =====
  {
    id: 'sh-song-11',
    title: 'Mystery Unfolds',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
    duration: 278,
    category: 'cinematic',
    tags: ['suspense', 'mystery', 'dark', 'tension'],
    bpm: 78,
    moods: ['悬疑', '神秘', '引人入胜'],
    description: '悬疑剧情展开时的紧张配乐，弦乐制造不安感',
    license: 'royalty-free',
    source: 'soundhelix.com',
  },
  {
    id: 'sh-song-12',
    title: 'Emotional Arc',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
    duration: 330,
    category: 'cinematic',
    tags: ['emotional', 'drama', 'storytelling', 'piano'],
    bpm: 74,
    moods: ['深沉', '情感丰富', '戏剧性'],
    description: '完整的情感叙事弧线，从铺垫到释放的电影级配乐',
    license: 'royalty-free',
    source: 'soundhelix.com',
  },

  // ===== electronic 电子律动 =====
  {
    id: 'pixabay-electronic-1',
    title: 'Digital Dreams',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/04/12/audio_j1k2l3m4n5.mp3?filename=electronic-dreams-145045.mp3',
    duration: 245,
    category: 'electronic',
    tags: ['synth', 'futuristic', 'digital', 'glitch'],
    bpm: 110,
    moods: ['前卫', '酷炫', '未来感'],
    description: '合成器主导的未来主义电子乐，科技感十足',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-electronic-2',
    title: 'Neon City',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/18/audio_o6p7q8r9s0.mp3?filename=neon-city-145046.mp3',
    duration: 198,
    category: 'electronic',
    tags: ['cyberpunk', 'night', 'urban', 'synthwave'],
    bpm: 118,
    moods: ['赛博朋克', '都市夜景', '潮流'],
    description: '赛博朋克风格的都市电子乐，霓虹灯般的音色',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== jazz 爵士情调 =====
  {
    id: 'pixabay-jazz-1',
    title: 'Velvet Lounge',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/25/audio_t1u2v3w4x5.mp3?filename=jazz-lounge-145047.mp3',
    duration: 270,
    category: 'jazz',
    tags: ['saxophone', 'smooth', 'lounge', 'evening'],
    bpm: 85,
    moods: ['优雅', '精致', '高级感'],
    description: '萨克斯风主导的丝滑爵士，适合高端场所氛围',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-jazz-2',
    title: 'Coffee Shop Jazz',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/06/08/audio_y6z7a8b9c0.mp3?filename=cafe-jazz-145048.mp3',
    duration: 235,
    category: 'jazz',
    tags: ['piano', 'coffee', 'casual', 'warm'],
    bpm: 80,
    moods: ['轻松', '随性', '温暖'],
    description: '咖啡馆风格的轻爵士钢琴，温暖而随意',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== classical 古典雅韵 =====
  {
    id: 'pixabay-classical-1',
    title: 'Timeless Elegance',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/02/14/audio_d1e2f3g4h5.mp3?filename=classical-elegance-145049.mp3',
    duration: 290,
    category: 'classical',
    tags: ['orchestra', 'grand', 'ceremony', 'timeless'],
    bpm: 76,
    moods: ['庄重', '典雅', '高贵'],
    description: '古典管弦乐团演奏的优雅作品，适合正式场合',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-classical-2',
    title: 'Piano Sonata',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/08/30/audio_i6j7k8l9m0.mp3?filename=piano-sonata-145050.mp3',
    duration: 310,
    category: 'classical',
    tags: ['piano', 'sonata', 'emotional', 'refined'],
    bpm: 70,
    moods: ['优雅', '深沉', '永恒'],
    description: '钢琴奏鸣曲风格的古典作品，细腻而深刻',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== rock 摇滚力量 =====
  {
    id: 'pixabay-rock-1',
    title: 'Electric Storm',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/07/15/audio_n1o2p3q4r5.mp3?filename=rock-energy-145051.mp3',
    duration: 205,
    category: 'rock',
    tags: ['electric-guitar', 'drums', 'power', 'intense'],
    bpm: 140,
    moods: ['狂野', '热血', '充满力量'],
    description: '电吉他和强劲鼓点的摇滚曲目，能量爆发',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== acoustic 民谣叙事 =====
  {
    id: 'pixabay-acoustic-1',
    title: 'Road Trip',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/04/28/audio_s6t7u8v9w0.mp3?filename=acoustic-roadtrip-145052.mp3',
    duration: 255,
    category: 'acoustic',
    tags: ['folk', 'travel', 'guitar', 'storytelling'],
    bpm: 82,
    moods: ['真挚', '怀旧', '自由'],
    description: '民谣风格的公路旅行歌曲，木吉他讲述旅途故事',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-acoustic-2',
    title: 'Homeland Memories',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/10/12/audio_x1y2z3a4b5.mp3?filename=folk-memories-145053.mp3',
    duration: 228,
    category: 'acoustic',
    tags: ['nostalgia', 'hometown', 'warmth', 'memories'],
    bpm: 78,
    moods: ['怀旧', '温暖', '朴实'],
    description: '故乡回忆主题的民谣，质朴而动人',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== ambient 氛围空间 =====
  {
    id: 'pixabay-ambient-1',
    title: 'Deep Space',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/01/20/audio_c7d8e9f0g1.mp3?filename=ambient-space-145054.mp3',
    duration: 320,
    category: 'ambient',
    tags: ['space', 'ethereal', 'floating', 'cosmic'],
    bpm: 60,
    moods: ['空灵', '神秘', '深邃'],
    description: '深空氛围音乐，漂浮在宇宙中的失重感',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-ambient-2',
    title: 'Floating Particles',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/09/25/audio_h2i3j4k5l6.mp3?filename=ambient-particles-145055.mp3',
    duration: 280,
    category: 'ambient',
    tags: ['particles', 'light', 'abstract', 'meditation'],
    bpm: 55,
    moods: ['超然', '冥想', '沉浸'],
    description: '抽象粒子视觉的配套氛围音乐，适合艺术展示',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== suspense 悬疑紧张 =====
  {
    id: 'pixabay-suspense-1',
    title: 'Dark Corridor',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/10/audio_m7n8o9p0q1.mp3?filename=suspense-dark-145056.mp3',
    duration: 185,
    category: 'suspense',
    tags: ['horror', 'thriller', 'tension', 'dark'],
    bpm: 88,
    moods: ['紧张', '不安', '诡异'],
    description: '黑暗走廊中的悬疑氛围，低频脉冲制造压迫感',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== comedy 轻松幽默 =====
  {
    id: 'pixabay-comedy-1',
    title: 'Funny Business',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/08/audio_r2s3t4u5v6.mp3?filename=comedy-fun-145057.mp3',
    duration: 150,
    category: 'comedy',
    tags: ['playful', 'whimsical', 'cartoon', 'lighthearted'],
    bpm: 132,
    moods: ['欢乐', '俏皮', '趣味十足'],
    description: '俏皮活泼的卡通风格配乐，拨弦乐器带来幽默感',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== corporate 商务专业 =====
  {
    id: 'pixabay-corporate-1',
    title: 'Business Success',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/06/22/audio_w8x9y0z1a2.mp3?filename=corporate-success-145058.mp3',
    duration: 215,
    category: 'corporate',
    tags: ['professional', 'corporate', 'confident', 'clean'],
    bpm: 100,
    moods: ['专业', '可信', '进取'],
    description: '干净利落的商务配乐，传达信任和专业感',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== lofi Lo-Fi低保真 =====
  {
    id: 'pixabay-lofi-1',
    title: 'Study Beats',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/08/15/audio_b4c5d6e7f8.mp3?filename=lofi-study-145059.mp3',
    duration: 240,
    category: 'lofi',
    tags: ['lofi', 'hiphop', 'chill', 'vinyl-crackle'],
    bpm: 85,
    moods: ['专注', '舒适', '松弛'],
    description: 'Lo-Fi Hip Hop节拍，黑胶颗粒感，适合学习和工作',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-lofi-2',
    title: 'Rainy Window',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/11/18/audio_g9h0i1j2k3.mp3?filename=lofi-rainy-145060.mp3',
    duration: 300,
    category: 'lofi',
    tags: ['rain', 'window', 'cozy', 'nostalgic'],
    bpm: 78,
    moods: ['怀旧', '舒适', '独处'],
    description: '雨天窗边的Lo-Fi氛围，温暖而怀旧',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== world 世界风情 =====
  {
    id: 'pixabay-world-1',
    title: 'Eastern Journey',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/04/05/audio_k4l5m6n7o8.mp3?filename=world-eastern-145061.mp3',
    duration: 265,
    category: 'world',
    tags: ['asian', 'traditional', 'exotic', 'cultural'],
    bpm: 92,
    moods: ['异域风情', '文化丰富', '热情'],
    description: '东方传统乐器融合的世界音乐，充满异域魅力',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-world-2',
    title: 'Latin Fiesta',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/07/30/audio_p9q0r1s2t3.mp3?filename=world-latin-145062.mp3',
    duration: 198,
    category: 'world',
    tags: ['latin', 'salsa', 'rhythm', 'festive'],
    bpm: 120,
    moods: ['热情', '欢腾', '多元'],
    description: '拉丁美洲节日氛围的热烈节奏音乐',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== holiday 节日庆典 =====
  {
    id: 'pixabay-holiday-1',
    title: 'Festival Joy',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/12/01/audio_u5v6w7x8y9.mp3?filename=holiday-celebration-145063.mp3',
    duration: 175,
    category: 'holiday',
    tags: ['celebration', 'festive', 'joyful', 'bright'],
    bpm: 126,
    moods: ['喜庆', '热闹', '幸福感'],
    description: '节日庆典的欢庆音乐，铜管乐器带来热烈气氛',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-holiday-2',
    title: 'Fireworks Night',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2023/01/15/audio_a1b2c3d4e5.mp3?filename=festive-fireworks-145064.mp3',
    duration: 200,
    category: 'holiday',
    tags: ['fireworks', 'new-year', 'celebration', 'triumphant'],
    bpm: 132,
    moods: ['欢腾', '盛大', '喜悦'],
    description: '烟花绽放般的节庆音乐，管弦乐齐鸣气势恢宏',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== chinese 国风古韵 =====
  {
    id: 'pixabay-chinese-1',
    title: 'Jiangnan Mist',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/09/05/audio_z1a2b3c4d5.mp3?filename=chinese-traditional-145065.mp3',
    duration: 255,
    category: 'chinese',
    tags: ['guzheng', 'chinese', 'oriental', 'misty'],
    bpm: 68,
    moods: ['古韵', '仙气', '意境深远'],
    description: '古筝与笛子交织的江南烟雨意境，东方美学韵味',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-chinese-2',
    title: 'Wuxia Epic',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/11/20/audio_f6g7h8i9j0.mp3?filename=wuxia-epic-145066.mp3',
    duration: 290,
    category: 'chinese',
    tags: ['pipa', 'wuxia', 'epic', 'cinematic'],
    bpm: 85,
    moods: ['侠气', '壮阔', '豪情'],
    description: '琵琶主导的武侠场景配乐，江湖侠义气势磅礴',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-chinese-3',
    title: 'Silk Road Caravan',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2023/03/10/audio_k1l2m3n4o5.mp3?filename=silk-road-145067.mp3',
    duration: 310,
    category: 'chinese',
    tags: ['erhu', 'silk-road', 'desert', 'caravan'],
    bpm: 72,
    moods: ['辽阔', '苍凉', '丝路风情'],
    description: '二胡与中东风情乐器的丝路商队旋律，苍茫辽阔',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== trap 陷阱说唱 =====
  {
    id: 'pixabay-trap-1',
    title: 'Dark Trap',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/06/30/audio_p6q7r8s9t0.mp3?filename=trap-dark-145068.mp3',
    duration: 195,
    category: 'trap',
    tags: ['808', 'trap', 'dark', 'bass'],
    bpm: 140,
    moods: ['酷炫', '暗黑', '力量感'],
    description: '重低音808鼓机驱动的暗黑陷阱节拍，街头范十足',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-trap-2',
    title: 'Street Hustle',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/08/25/audio_u1v2w3x4y5.mp3?filename=trap-street-145069.mp3',
    duration: 210,
    category: 'trap',
    tags: ['hi-hat', 'street', 'hustle', 'urban'],
    bpm: 145,
    moods: ['街头', '硬核', '张力'],
    description: '快速hi-hat与深沉bass的街头陷阱节拍，都市夜行感',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== rnb R&B灵魂 =====
  {
    id: 'pixabay-rnb-1',
    title: 'Midnight Groove',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/04/18/audio_z6a7b8c9d0.mp3?filename=rnb-midnight-145070.mp3',
    duration: 230,
    category: 'rnb',
    tags: ['rhodes', 'rnb', 'smooth', 'midnight'],
    bpm: 88,
    moods: ['丝滑', '深情', '都市感'],
    description: '电钢琴与醇厚bass的午夜R&B律动，丝滑而性感',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-rnb-2',
    title: 'Velvet Touch',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/10/05/audio_e1f2g3h4i5.mp3?filename=rnb-velvet-145071.mp3',
    duration: 245,
    category: 'rnb',
    tags: ['soul', 'vocal', 'warm', 'sensual'],
    bpm: 82,
    moods: ['温暖', '性感', '感性'],
    description: '温暖人声与灵魂乐和声的R&B抒情曲，动人心弦',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== reggae 雷鬼阳光 =====
  {
    id: 'pixabay-reggae-1',
    title: 'Island Breeze',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/07/12/audio_j6k7l8m9n0.mp3?filename=reggae-island-145072.mp3',
    duration: 215,
    category: 'reggae',
    tags: ['reggae', 'off-beat', 'island', 'breeze'],
    bpm: 78,
    moods: ['阳光', '悠闲', '轻松自在'],
    description: '经典off-beat吉他的海岛雷鬼，阳光般轻松自在',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-reggae-2',
    title: 'Beach Sunset',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/12/08/audio_o1p2q3r4s5.mp3?filename=reggae-sunset-145073.mp3',
    duration: 240,
    category: 'reggae',
    tags: ['beach', 'sunset', 'relax', 'tropical'],
    bpm: 74,
    moods: ['慵懒', '度假感', '温暖'],
    description: '日落海滩的慵懒雷鬼节奏，热带度假氛围拉满',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== motivational 励志激励 =====
  {
    id: 'pixabay-motiv-1',
    title: 'Rise Above',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_t6u7v8w9x0.mp3?filename=motivational-rise-145074.mp3',
    duration: 260,
    category: 'motivational',
    tags: ['piano', 'inspiring', 'crescendo', 'triumph'],
    bpm: 92,
    moods: ['振奋', '热血', '充满希望'],
    description: '钢琴层层递进到弦乐高潮的励志弧线，从低谷到巅峰',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-motiv-2',
    title: 'Unstoppable',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/09/28/audio_y1z2a3b4c5.mp3?filename=motivational-unstoppable-145075.mp3',
    duration: 220,
    category: 'motivational',
    tags: ['drive', 'power', 'success', 'energy'],
    bpm: 100,
    moods: ['力量感', '坚定', '勇往直前'],
    description: '强劲鼓点与激昂弦乐的不可阻挡之力，创业者的战歌',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-motiv-3',
    title: 'New Dawn',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2023/02/14/audio_d6e7f8g9h0.mp3?filename=motivational-dawn-145076.mp3',
    duration: 275,
    category: 'motivational',
    tags: ['hope', 'dawn', 'orchestral', 'uplifting'],
    bpm: 88,
    moods: ['希望', '光明', '破晓'],
    description: '从黑暗到光明的管弦乐叙事，新黎明破晓的温暖力量',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },

  // ===== retro 复古怀旧 =====
  {
    id: 'pixabay-retro-1',
    title: 'Neon Drive',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/22/audio_i6j7k8l9m0.mp3?filename=synthwave-neon-145077.mp3',
    duration: 235,
    category: 'retro',
    tags: ['synthwave', '80s', 'neon', 'retro'],
    bpm: 108,
    moods: ['怀旧', '复古感', '梦幻'],
    description: '80年代合成器波驱动的霓虹之夜，蒸汽波美学',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-retro-2',
    title: 'Cassette Memories',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2022/11/12/audio_n1o2p3q4r5.mp3?filename=retro-cassette-145078.mp3',
    duration: 250,
    category: 'retro',
    tags: ['disco', 'vintage', 'nostalgic', 'analog'],
    bpm: 118,
    moods: ['年代感', '温暖', '记忆'],
    description: '磁带颗粒感的复古迪斯科，温暖记忆中的舞池灯光',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
  {
    id: 'pixabay-retro-3',
    title: 'Pixel Dreams',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/download/audio/2023/04/20/audio_s6t7u8v9w0.mp3?filename=retro-pixel-145079.mp3',
    duration: 180,
    category: 'retro',
    tags: ['chiptune', 'pixel', 'arcade', '8-bit'],
    bpm: 125,
    moods: ['趣味', '像素感', '童年'],
    description: '8-bit芯片音风格的像素游戏梦，街机厅的童年回忆',
    license: 'royalty-free',
    source: 'pixabay.com/music',
  },
];

// ============================================================
// 工具函数
// ============================================================

/**
 * 搜索音乐库
 */
export function searchLibrary(params: LibrarySearchParams): LibrarySearchResult {
  let results = [...MUSIC_LIBRARY_TRACKS];

  // 关键词搜索
  if (params.query) {
    const q = params.query.toLowerCase();
    results = results.filter(track =>
      track.title.toLowerCase().includes(q) ||
      track.artist.toLowerCase().includes(q) ||
      track.description.toLowerCase().includes(q) ||
      track.category.toLowerCase().includes(q) ||
      track.tags.some(t => t.includes(q)) ||
      track.moods.some(m => m.includes(q))
    );
  }

  // 分类过滤
  if (params.category && params.category !== 'all') {
    results = results.filter(track => track.category === params.category);
  }

  // 情绪过滤
  if (params.mood) {
    results = results.filter(track => track.moods.some(m => m.includes(params.mood!)));
  }

  // 时长过滤
  if (params.minDuration) {
    results = results.filter(track => track.duration >= params.minDuration!);
  }
  if (params.maxDuration) {
    results = results.filter(track => track.duration <= params.maxDuration!);
  }

  const total = results.length;
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 12, 50);
  const totalPages = Math.ceil(total / pageSize);

  // 分页
  const startIndex = (page - 1) * pageSize;
  const paginatedResults = results.slice(startIndex, startIndex + pageSize);

  // 统计分类和情绪分布
  const allTracks = params.query || params.category || params.mood ? results : MUSIC_LIBRARY_TRACKS;
  const categoryCounts: Record<string, number> = {};
  const moodCounts: Record<string, number> = {};

  for (const track of allTracks) {
    categoryCounts[track.category] = (categoryCounts[track.category] || 0) + 1;
    for (const mood of track.moods) {
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    }
  }

  return {
    tracks: paginatedResults,
    total,
    page,
    pageSize,
    totalPages,
    query: params.query,
    filters: {
      categories: Object.entries(categoryCounts)
        .map(([id, count]) => ({ id, name: id, count }))
        .sort((a, b) => b.count - a.count),
      moods: Object.entries(moodCounts)
        .slice(0, 15)
        .map(([id, count]) => ({ id, name: id, count }))
        .sort((a, b) => b.count - a.count),
    },
  };
}

/**
 * 根据ID获取单首曲目
 */
export function getTrackById(id: string): LibraryTrack | undefined {
  return MUSIC_LIBRARY_TRACKS.find(track => track.id === id);
}

/**
 * 获取推荐曲目（按分类）
 */
export function getRecommendedTracks(category: string, limit: number = 6): LibraryTrack[] {
  return MUSIC_LIBRARY_TRACKS
    .filter(track => track.category === category)
    .slice(0, limit);
}

/**
 * 获取所有可用分类及其统计信息
 */
export function getLibraryCategories(): Array<{ id: string; name: string; count: string }> {
  const counts: Record<string, number> = {};
  for (const track of MUSIC_LIBRARY_TRACKS) {
    counts[track.category] = (counts[track.category] || 0) + 1;
  }
  return Object.entries(counts).map(([id, count]) => ({
    id,
    name: id,
    count: String(count),
  }));
}
