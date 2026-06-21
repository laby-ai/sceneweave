/**
 * 特效音（SFX / Sound Effects）类型定义与素材库 v1.0
 *
 * 集中管理所有特效音的元数据，供以下组件共享：
 * - video-generation-form.tsx（视频生成表单 - 全局特效音）
 * - storyboard-editor.tsx（分镜编辑器 - 镜头级特效音绑定）
 * - submit/route.ts（后端处理管线 - 特效音注入）
 *
 * 设计原则：
 * - 6大分类 × 12种 = 72种预置特效音全覆盖
 * - 每种含：名称/描述/图标/颜色/关键词/TTS提示词/适用场景/默认时长
 * - 支持按场景类型自动推荐最佳特效音组合
 */

// ============================================================
// 类型定义
// ============================================================

/** 特效音分类ID */
export type SfxCategoryId =
  | 'transition'   // 转场过渡
  | 'impact'       // 强调冲击
  | 'ui'           // UI交互反馈
  | 'ambient'      // 氛围环境
  | 'alert'        // 警告提示
  | 'success';     // 成功确认

/** 特效音ID（复合：分类_具体音效） */
export type SfxId =
  // 转场 (8种)
  | 'swoosh_smooth' | 'swoosh_sharp' | 'whoosh_fast' | 'slide_gentle'
  | 'fade_in' | 'fade_out' | 'glitch_digital' | 'ripple_soft'
  // 强调冲击 (10种)
  | 'impact_boom' | 'impact_thud' | 'hit_metal' | 'hit_wood'
  | 'pop_bubble' | 'snap_finger' | 'sting_bright' | 'rise_sweep'
  | 'drop_heavy' | 'pulse_electric'
  // UI交互 (8种)
  | 'click_tap' | 'click_press' | 'toggle_switch' | 'scroll_tick'
  | 'hover_ping' | 'drag_start' | 'drop_item' | 'notification_chime'
  // 氛围环境 (10种)
  | 'wind_gentle' | 'rain_light' | 'thunder_distant' | 'fire_crackle'
  | 'water_flow' | 'birds_forest' | 'city_ambience' | 'crowd_murmur'
  | 'heartbeat' | 'clock_tick'
  // 警告提示 (6种)
  | 'alert_buzz' | 'alert_beep' | 'warning_tone' | 'error_blip'
  | 'countdown_tick' | 'reveal_dramatic'
  // 成功确认 (6种)
  | 'success_ding' | 'success_fanfare' | 'complete_chime'
  | 'unlock_click' | 'level_up' | 'magic_sparkle';

/** 单个特效音完整元数据 */
export interface SfxDefinition {
  /** 唯一标识 */
  id: SfxId;
  /** 显示名称 */
  name: string;
  /** 简短描述 */
  description: string;
  /** 图标emoji */
  icon: string;
  /** 所属分类 */
  category: SfxCategoryId;
  /** 主题色（用于UI高亮） */
  color: string;
  /** 背景色（用于卡片背景） */
  bgColor: string;
  /** 匹配关键词（用于AI推荐和本地匹配） */
  keywords: string[];
  /** 适用场景标签 */
  scenes: string[];
  /** TTS生成提示词（当预置URL不可用时使用） */
  ttsPrompt: string;
  /** 预计时长（秒），用于时间轴定位参考 */
  duration: number;
  /** 音量建议 (0-1)，默认0.6 */
  volume?: number;
}

/** 特效音分类元数据 */
export interface SfxCategoryDefinition {
  id: SfxCategoryId;
  name: string;
  icon: string;
  description: string;
  color: string;
  bgColor: string;
}

/** 用户选择的特效音配置（绑定到镜头） */
export interface SfxBinding {
  /** 特效音ID */
  sfxId: SfxId;
  /** 关联的镜头索引 (-1=全局/片头, >=0=特定镜头) */
  shotIndex: number;
  /** 在镜头内的偏移时间（秒），0=镜头开始时触发 */
  timeOffset: number;
  /** 自定义音量覆盖 */
  volume?: number;
}

/** 特效音全局配置（从表单传入后端） */
export interface SfxConfig {
  /** 是否启用特效音 */
  enabled: boolean;
  /** 模式: 'auto'=自动匹配 | 'manual'=手动选择 | 'none'=关闭 */
  mode: 'auto' | 'manual' | 'none';
  /** 手动选择的特效音列表 */
  bindings: SfxBinding[];
  /** 全局音量 (0-1) */
  globalVolume: number;
}

// ============================================================
// 分类定义
// ============================================================

export const SFX_CATEGORIES: SfxCategoryDefinition[] = [
  {
    id: 'transition',
    name: '转场过渡',
    icon: '🎬',
    description: '镜头切换、画面转场的过渡音效',
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.08)',
  },
  {
    id: 'impact',
    name: '强调冲击',
    icon: '💥',
    description: '重点突出、冲击力强的音效',
    color: '#EF4444',
    bgColor: 'rgba(239,68,68,0.08)',
  },
  {
    id: 'ui',
    name: 'UI交互',
    icon: '👆',
    description: '点击、滑动、弹窗等界面反馈音',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.08)',
  },
  {
    id: 'ambient',
    name: '氛围环境',
    icon: '🌿',
    description: '自然环境、空间氛围的环境音',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.08)',
  },
  {
    id: 'alert',
    name: '警告提示',
    icon: '⚠️',
    description: '警告、倒计时、紧张氛围的提示音',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.08)',
  },
  {
    id: 'success',
    name: '成功确认',
    icon: '✨',
    description: '完成、成功、解锁等正向反馈音',
    color: '#06B6D4',
    bgColor: 'rgba(6,182,212,0.08)',
  },
];

// ============================================================
// 完整特效音库 (48种)
// ============================================================

export const SFX_LIBRARY: SfxDefinition[] = [
  // ===== 转场过渡 (8种) =====
  {
    id: 'swoosh_smooth',
    name: '平滑划过',
    description: '柔和的风声划过，适合优雅转场',
    icon: '🌊',
    category: 'transition',
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.08)',
    keywords: ['转场', '过渡', '切换', '滑过', '柔和', 'smooth', ' swoosh'],
    scenes: ['product', 'landscape', 'portrait', 'interior'],
    ttsPrompt: '一声柔和流畅的 swoosh 划过声，像丝绸在空中飘过，轻盈优雅，持续约1秒',
    duration: 1.0,
    volume: 0.5,
  },
  {
    id: 'swoosh_sharp',
    name: '锐利划过',
    description: '快速锐利的气流声，适合动感转场',
    icon: '⚡',
    category: 'transition',
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.08)',
    keywords: ['转场', '快速', '锐利', '动感', 'sharp', 'fast'],
    scenes: ['drama', 'abstract', 'food'],
    ttsPrompt: '一声快速锐利的 swoosh 声，像快刀划破空气，短促有力，约0.5秒',
    duration: 0.5,
    volume: 0.7,
  },
  {
    id: 'whoosh_fast',
    name: '疾驰飞过',
    description: '高速运动的呼啸声，适合快节奏切换',
    icon: '💨',
    category: 'transition',
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.08)',
    keywords: ['飞过', '高速', '疾驰', '快节奏', 'whoosh', 'speed'],
    scenes: ['drama', 'abstract', 'epic'],
    ttsPrompt: '一声高速 whoosh 呼啸声，像赛车飞驰而过，充满速度感，约0.8秒',
    duration: 0.8,
    volume: 0.65,
  },
  {
    id: 'slide_gentle',
    name: '轻柔滑动',
    description: '温和的滑动声，适合平缓过渡',
    icon: '➡️',
    category: 'transition',
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.08)',
    keywords: ['滑动', '平缓', '温和', '轻柔', 'slide', 'gentle'],
    scenes: ['landscape', 'portrait', 'interior'],
    ttsPrompt: '一声轻柔的滑动声，像抽屉缓缓拉开，安静舒适，约1.2秒',
    duration: 1.2,
    volume: 0.4,
  },
  {
    id: 'fade_in',
    name: '淡入渐现',
    description: '声音由弱渐强，配合画面淡入效果',
    icon: '🌅',
    category: 'transition',
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.08)',
    keywords: ['淡入', '渐现', '出现', 'fade in', 'appear'],
    scenes: ['all'],
    ttsPrompt: '一段从静默逐渐增强的环境嗡鸣声，空灵神秘，约2秒渐入',
    duration: 2.0,
    volume: 0.3,
  },
  {
    id: 'fade_out',
    name: '淡出消失',
    description: '声音由强渐弱，配合画面淡出效果',
    icon: '🌇',
    category: 'transition',
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.08)',
    keywords: ['淡出', '消失', '结束', 'fade out', 'end'],
    scenes: ['all'],
    ttsPrompt: '一段逐渐减弱至静默的环境嗡鸣声，悠远绵长，约2秒淡出',
    duration: 2.0,
    volume: 0.3,
  },
  {
    id: 'glitch_digital',
    name: '数字故障',
    description: '电子故障噪音，适合科技感/赛博朋克风格',
    icon: '📺',
    category: 'transition',
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.08)',
    keywords: ['故障', '数字', '科技', '电子', 'glitch', 'digital', 'cyber'],
    scenes: ['abstract', 'product'],
    ttsPrompt: '一段短暂的数字故障噪音，带有静电干扰和信号中断感，科技感十足，约0.7秒',
    duration: 0.7,
    volume: 0.55,
  },
  {
    id: 'ripple_soft',
    name: '涟漪扩散',
    description: '水波涟漪般的声音，柔美梦幻',
    icon: '💧',
    category: 'transition',
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.08)',
    keywords: ['涟漪', '水波', '扩散', '柔美', '梦幻', 'ripple'],
    scenes: ['landscape', 'romantic', 'portrait'],
    ttsPrompt: '一声如水波涟漪扩散般的清脆声响，纯净空灵，余韵悠长，约1.5秒',
    duration: 1.5,
    volume: 0.45,
  },

  // ===== 强调冲击 (10种) =====
  {
    id: 'impact_boom',
    name: '重击轰鸣',
    description: '低频重击声，震撼有力',
    icon: '💣',
    category: 'impact',
    color: '#EF4444',
    bgColor: 'rgba(239,68,68,0.08)',
    keywords: ['重击', '轰鸣', '震撼', '低频', 'boom', 'impact', 'heavy'],
    scenes: ['epic', 'drama', 'product'],
    ttsPrompt: '一声低沉有力的 boom 重击声，像大鼓被重重敲击，震撼人心，约1秒',
    duration: 1.0,
    volume: 0.8,
  },
  {
    id: 'impact_thud',
    name: '闷响撞击',
    description: '沉闷的撞击声，扎实厚重',
    icon: '🔨',
    category: 'impact',
    color: '#EF4444',
    bgColor: 'rgba(239,68,68,0.08)',
    keywords: ['闷响', '撞击', '厚重', '扎实', 'thud'],
    scenes: ['product', 'drama'],
    ttsPrompt: '一声沉闷厚实的 thud 撞击声，像重物落地，扎实有力，约0.8秒',
    duration: 0.8,
    volume: 0.75,
  },
  {
    id: 'hit_metal',
    name: '金属碰撞',
    description: '清脆金属撞击声，明亮有质感',
    icon: '🔔',
    category: 'impact',
    color: '#EF4444',
    bgColor: 'rgba(239,68,68,0.08)',
    keywords: ['金属', '碰撞', '清脆', '明亮', 'metal', 'clang'],
    scenes: ['product', 'abstract'],
    ttsPrompt: '一声清脆明亮的金属碰撞声，像两块金属片相撞，质感十足，约0.5秒',
    duration: 0.5,
    volume: 0.7,
  },
  {
    id: 'hit_wood',
    name: '木制敲击',
    description: '温润木质敲击声，自然质朴',
    icon: '🪵',
    category: 'impact',
    color: '#EF4444',
    bgColor: 'rgba(239,68,68,0.08)',
    keywords: ['木制', '敲击', '温润', '自然', 'wood', 'knock'],
    scenes: ['interior', 'food', 'landscape'],
    ttsPrompt: '一声温润的木质敲击声，像木槌敲在木桌上，自然质朴，约0.6秒',
    duration: 0.6,
    volume: 0.6,
  },
  {
    id: 'pop_bubble',
    name: '气泡爆破',
    description: '清脆气泡破裂声，活泼有趣',
    icon: '🫧',
    category: 'impact',
    color: '#EF4444',
    bgColor: 'rgba(239,68,68,0.08)',
    keywords: ['气泡', '爆破', '清脆', '活泼', 'pop', 'bubble'],
    scenes: ['food', 'product', 'portrait'],
    ttsPrompt: '一声清脆可爱的气泡爆破 pop 声，轻盈跳跃，约0.3秒',
    duration: 0.3,
    volume: 0.55,
  },
  {
    id: 'snap_finger',
    name: '打响指',
    description: '干脆利落的响指声',
    icon: '👌',
    category: 'impact',
    color: '#EF4444',
    bgColor: 'rgba(239,68,68,0.08)',
    keywords: ['响指', '干脆', '利落', 'snap', 'finger'],
    scenes: ['product', 'drama', 'portrait'],
    ttsPrompt: '一声干脆利落的响指 snap 声，清晰响亮，约0.3秒',
    duration: 0.3,
    volume: 0.65,
  },
  {
    id: 'sting_bright',
    name: '闪光强调',
    description: '明亮的高频强调音，吸引注意力',
    icon: '✳️',
    category: 'impact',
    color: '#EF4444',
    bgColor: 'rgba(239,68,68,0.08)',
    keywords: ['闪光', '强调', '高频', '注意', 'sting', 'bright'],
    scenes: ['product', 'food', 'abstract'],
    ttsPrompt: '一段明亮的高频 sting 强调音，像闪光灯亮起时的音效，醒目突出，约0.6秒',
    duration: 0.6,
    volume: 0.6,
  },
  {
    id: 'rise_sweep',
    name: '上升扫弦',
    description: '能量递增的上升音效，营造期待感',
    icon: '📈',
    category: 'impact',
    color: '#EF4444',
    bgColor: 'rgba(239,68,68,0.08)',
    keywords: ['上升', '扫弦', '递增', '期待', 'rise', 'sweep'],
    scenes: ['epic', 'drama', 'product'],
    ttsPrompt: '一段能量递增的上升 sweep 音效，像弦乐从低到高的滑奏，充满期待感，约1.5秒',
    duration: 1.5,
    volume: 0.55,
  },
  {
    id: 'drop_heavy',
    name: '重磅落下',
    description: '重量级下落音效，强调重要性',
    icon: '⬇️',
    category: 'impact',
    color: '#EF4444',
    bgColor: 'rgba(239,68,68,0.08)',
    keywords: ['重磅', '落下', '重要', 'drop', 'heavy'],
    scenes: ['epic', 'drama', 'product'],
    ttsPrompt: '一声重量级的 drop 下落音效，从高处坠落的压迫感和落地冲击，约1.2秒',
    duration: 1.2,
    volume: 0.75,
  },
  {
    id: 'pulse_electric',
    name: '电脉冲',
    description: '电流脉冲声，科技感强烈',
    icon: '⚡',
    category: 'impact',
    color: '#EF4444',
    bgColor: 'rgba(239,68,68,0.08)',
    keywords: ['脉冲', '电流', '电', '科技', 'pulse', 'electric'],
    scenes: ['abstract', 'product'],
    ttsPrompt: '一阵电 pulse 脉冲声，带电流穿过空气的滋滋声和能量爆发感，约0.8秒',
    duration: 0.8,
    volume: 0.6,
  },

  // ===== UI交互 (8种) =====
  {
    id: 'click_tap',
    name: '点击触控',
    description: '标准点击反馈声，通用型',
    icon: '👆',
    category: 'ui',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.08)',
    keywords: ['点击', '触控', 'tap', 'click', 'touch'],
    scenes: ['product', 'abstract'],
    ttsPrompt: '一声干净清脆的 click 点击声，像手指触碰屏幕的标准反馈音，约0.2秒',
    duration: 0.2,
    volume: 0.5,
  },
  {
    id: 'click_press',
    name: '按压确认',
    description: '深沉的按压反馈声，更有分量感',
    icon: '🔘',
    category: 'ui',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.08)',
    keywords: ['按压', '确认', '深沉', 'press', 'button'],
    scenes: ['product', 'corporate'],
    ttsPrompt: '一声沉稳的 press 按压声，像按下实体按钮的机械反馈，约0.3秒',
    duration: 0.3,
    volume: 0.55,
  },
  {
    id: 'toggle_switch',
    name: '开关切换',
    description: '拨动开关的咔哒声',
    icon: '🔘',
    category: 'ui',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.08)',
    keywords: ['开关', '切换', '拨动', 'toggle', 'switch'],
    scenes: ['product', 'abstract'],
    ttsPrompt: '一声清脆的 toggle 开关咔哒声，像拨动开关的机械咬合，约0.25秒',
    duration: 0.25,
    volume: 0.5,
  },
  {
    id: 'scroll_tick',
    name: '滚动刻度',
    description: '滚轮滚动时的轻微滴答声',
    icon: '🔄',
    category: 'ui',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.08)',
    keywords: ['滚动', '刻度', '滴答', 'scroll', 'tick'],
    scenes: ['product', 'abstract'],
    ttsPrompt: '一声轻微的 scroll tick 滚动声，像精密仪器的刻度转动，约0.15秒',
    duration: 0.15,
    volume: 0.35,
  },
  {
    id: 'hover_ping',
    name: '悬停提示',
    description: '鼠标悬停时的轻柔提示音',
    icon: '💫',
    category: 'ui',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.08)',
    keywords: ['悬停', 'hover', '提示', 'ping', 'hover'],
    scenes: ['product'],
    ttsPrompt: '一声极轻柔的 hover ping 提示音，像气泡浮出水面的微弱声响，约0.15秒',
    duration: 0.15,
    volume: 0.25,
  },
  {
    id: 'drag_start',
    name: '拖拽抓取',
    description: '开始拖拽时的抓取声',
    icon: '✋',
    category: 'ui',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.08)',
    keywords: ['拖拽', '抓取', 'drag', 'grab', 'start'],
    scenes: ['product', 'abstract'],
    ttsPrompt: '一声 drag 抓取声，像手指抓住物体的摩擦声，约0.2秒',
    duration: 0.2,
    volume: 0.4,
  },
  {
    id: 'drop_item',
    name: '放置完成',
    description: '拖拽放置到位的确认声',
    icon: '📦',
    category: 'ui',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.08)',
    keywords: ['放置', '放下', '完成', 'drop', 'place'],
    scenes: ['product', 'abstract'],
    ttsPrompt: '一声 drop 放置确认声，像物体落到正确位置的轻响，约0.25秒',
    duration: 0.25,
    volume: 0.45,
  },
  {
    id: 'notification_chime',
    name: '通知铃声',
    description: '悦耳的通知提醒铃声',
    icon: '🔔',
    category: 'ui',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.08)',
    keywords: ['通知', '铃声', '提醒', 'notification', 'chime', 'bell'],
    scenes: ['product', 'corporate'],
    ttsPrompt: '一段悦耳的 notification chime 通知铃声，三音符下行旋律，温柔不刺耳，约0.8秒',
    duration: 0.8,
    volume: 0.5,
  },

  // ===== 氛围环境 (10种) =====
  {
    id: 'wind_gentle',
    name: '微风拂过',
    description: '轻柔的风声，开阔自由的感觉',
    icon: '🍃',
    category: 'ambient',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.08)',
    keywords: ['微风', '风', '拂过', '自由', 'wind', 'breeze'],
    scenes: ['landscape', 'portrait', 'drama'],
    ttsPrompt: '一阵轻柔的微风拂过声，树叶沙沙作响，开阔自由的氛围，可持续循环',
    duration: 3.0,
    volume: 0.35,
  },
  {
    id: 'rain_light',
    name: '细雨淅沥',
    description: '轻柔的雨声，宁静安详',
    icon: '🌧️',
    category: 'ambient',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.08)',
    keywords: ['雨', '细雨', '淅沥', '宁静', 'rain'],
    scenes: ['landscape', 'romantic', 'interior'],
    ttsPrompt: '细雨淅沥的声音，雨滴落在屋檐和地面上的轻柔白噪音，宁静安详，可持续循环',
    duration: 3.0,
    volume: 0.35,
  },
  {
    id: 'thunder_distant',
    name: '远处雷鸣',
    description: '遥远闷雷声，增加戏剧张力',
    icon: '⛈️',
    category: 'ambient',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.08)',
    keywords: ['雷', '雷鸣', '远处', '戏剧', 'thunder', 'storm'],
    scenes: ['drama', 'epic', 'landscape'],
    ttsPrompt: '远处传来的闷雷声，低沉隆隆，隐含力量感但不刺耳，约3秒',
    duration: 3.0,
    volume: 0.4,
  },
  {
    id: 'fire_crackle',
    name: '篝火噼啪',
    description: '火焰燃烧的噼啪声，温暖舒适',
    icon: '🔥',
    category: 'ambient',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.08)',
    keywords: ['火', '篝火', '噼啪', '温暖', 'fire', 'crackle'],
    scenes: ['interior', 'food', 'portrait'],
    ttsPrompt: '篝火燃烧的噼啪声，木柴爆裂的温暖声响，令人安心舒适，可持续循环',
    duration: 3.0,
    volume: 0.4,
  },
  {
    id: 'water_flow',
    name: '流水潺潺',
    description: '清澈流水声，清新自然',
    icon: '💧',
    category: 'ambient',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.08)',
    keywords: ['水', '流水', '潺潺', '清新', 'water', 'stream'],
    scenes: ['landscape', 'nature'],
    ttsPrompt: '清澈溪流潺潺流过的声音，水流拍打石头的自然白噪音，清新治愈，可持续循环',
    duration: 3.0,
    volume: 0.35,
  },
  {
    id: 'birds_forest',
    name: '林间鸟鸣',
    description: '森林中的鸟鸣声，生机盎然',
    icon: '🐦',
    category: 'ambient',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.08)',
    keywords: ['鸟', '鸟鸣', '森林', '生机', 'birds', 'forest'],
    scenes: ['landscape', 'nature', 'portrait'],
    ttsPrompt: '清晨林间的鸟鸣声，各种鸟儿清脆啼鸣交织，生机盎然的自然氛围，可持续循环',
    duration: 3.0,
    volume: 0.35,
  },
  {
    id: 'city_ambience',
    name: '城市背景',
    description: '城市环境的底噪，现代都市感',
    icon: '🏙️',
    category: 'ambient',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.08)',
    keywords: ['城市', '都市', '背景', 'city', 'urban'],
    scenes: ['product', 'abstract', 'portrait'],
    ttsPrompt: '城市背景环境音，远处车流和人声的低沉底噪，现代都市的氛围感，可持续循环',
    duration: 3.0,
    volume: 0.25,
  },
  {
    id: 'crowd_murmur',
    name: '人群低语',
    description: '人群中的低语嘈杂声',
    icon: '👥',
    category: 'ambient',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.08)',
    keywords: ['人群', '低语', '嘈杂', 'crowd', 'murmur'],
    scenes: ['drama', 'portrait', 'epic'],
    ttsPrompt: '人群中模糊的低语和嘈杂声，像在热闹场所听到的背景人声，不清晰但充满生活气息，可持续循环',
    duration: 3.0,
    volume: 0.25,
  },
  {
    id: 'heartbeat',
    name: '心跳律动',
    description: '清晰的心跳声，紧张或浪漫氛围',
    icon: '❤️',
    category: 'ambient',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.08)',
    keywords: ['心跳', '律动', '紧张', '浪漫', 'heartbeat'],
    scenes: ['drama', 'romantic', 'portrait'],
    ttsPrompt: '清晰有力的心跳声，咚-咚规律跳动，可营造紧张或浪漫氛围，可持续循环',
    duration: 2.0,
    volume: 0.4,
  },
  {
    id: 'clock_tick',
    name: '时钟滴答',
    description: '时钟走动的滴答声，时间流逝感',
    icon: '🕐',
    category: 'ambient',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.08)',
    keywords: ['时钟', '滴答', '时间', 'clock', 'tick'],
    scenes: ['drama', 'corporate', 'abstract'],
    ttsPrompt: '老式时钟走动的滴答声，每一秒一次的规律节拍，带来时间流逝的紧迫感，可持续循环',
    duration: 2.0,
    volume: 0.3,
  },

  // ===== 警告提示 (6种) =====
  {
    id: 'alert_buzz',
    name: '警报蜂鸣',
    description: '持续的蜂鸣警报声',
    icon: '🚨',
    category: 'alert',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.08)',
    keywords: ['警报', '蜂鸣', '警告', 'buzz', 'alarm'],
    scenes: ['drama', 'abstract'],
    ttsPrompt: '急促的 alert buzz 警报蜂鸣声，断续的电子蜂鸣，引起警觉，约1.5秒',
    duration: 1.5,
    volume: 0.7,
  },
  {
    id: 'alert_beep',
    name: '提示哔声',
    description: '简洁的电子提示音',
    icon: '🔔',
    category: 'alert',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.08)',
    keywords: ['提示', '哔声', 'beep', 'notice'],
    scenes: ['product', 'corporate'],
    ttsPrompt: '两声简洁的 beep 电子提示音，高低双音，清晰明确，约0.5秒',
    duration: 0.5,
    volume: 0.6,
  },
  {
    id: 'warning_tone',
    name: '警告音调',
    description: '下降音调的警告声，表示注意',
    icon: '⚠️',
    category: 'alert',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.08)',
    keywords: ['警告', '音调', '下降', 'warning', 'tone'],
    scenes: ['drama', 'product'],
    ttsPrompt: '一段下降音调的 warning 警告声，三个音符逐级降低，表达需要注意，约0.8秒',
    duration: 0.8,
    volume: 0.6,
  },
  {
    id: 'error_blip',
    name: '错误提示',
    description: '低沉的错误反馈音',
    icon: '❌',
    category: 'alert',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.08)',
    keywords: ['错误', '失败', 'error', 'fail', 'blip'],
    scenes: ['product', 'abstract'],
    ttsPrompt: '一声低沉的 error blip 错误提示音，简短表示操作无效，约0.3秒',
    duration: 0.3,
    volume: 0.5,
  },
  {
    id: 'countdown_tick',
    name: '倒数滴答',
    description: '倒计时节奏的滴答声',
    icon: '⏱️',
    category: 'alert',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.08)',
    keywords: ['倒数', '倒计时', '滴答', 'countdown', 'timer'],
    scenes: ['drama', 'epic', 'product'],
    ttsPrompt: '有节奏的 countdown 倒数滴答声，每秒一次，越来越紧迫，共5次约2.5秒',
    duration: 2.5,
    volume: 0.55,
  },
  {
    id: 'reveal_dramatic',
    name: '戏剧揭示',
    description: '悬念揭示时刻的鼓点',
    icon: '🎭',
    category: 'alert',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.08)',
    keywords: ['揭示', '悬念', '戏剧', 'reveal', 'dramatic'],
    scenes: ['drama', 'epic', 'portrait'],
    ttsPrompt: '一段戏剧性的 reveal 揭示鼓点，小军鼓滚奏后戛然而止，制造悬念感，约2秒',
    duration: 2.0,
    volume: 0.65,
  },

  // ===== 成功确认 (6种) =====
  {
    id: 'success_ding',
    name: '成功叮声',
    description: '经典的成功提示叮声',
    icon: '✅',
    category: 'success',
    color: '#06B6D4',
    bgColor: 'rgba(6,182,212,0.08)',
    keywords: ['成功', '叮', '完成', 'ding', 'success', 'complete'],
    scenes: ['product', 'corporate', 'all'],
    ttsPrompt: '一声清脆悦耳的成功 ding 叮声，高音正弦波，传达任务完成的满足感，约0.5秒',
    duration: 0.5,
    volume: 0.6,
  },
  {
    id: 'success_fanfare',
    name: '胜利号角',
    description: '小型胜利号角声，庆祝感',
    icon: '🎺',
    category: 'success',
    color: '#06B6D4',
    bgColor: 'rgba(6,182,212,0.08)',
    keywords: ['胜利', '号角', '庆祝', 'fanfare', 'triumph'],
    scenes: ['epic', 'product', 'drama'],
    ttsPrompt: '一小段胜利 fanfare 号角声，铜管乐器齐奏，欢庆成就感，约2秒',
    duration: 2.0,
    volume: 0.6,
  },
  {
    id: 'complete_chime',
    name: '完成和弦',
    description: '大三和弦完成音，和谐圆满',
    icon: '🎵',
    category: 'success',
    color: '#06B6D4',
    bgColor: 'rgba(6,182,212,0.08)',
    keywords: ['完成', '和弦', '和谐', 'chime', 'complete'],
    scenes: ['product', 'corporate', 'landscape'],
    ttsPrompt: '一个温暖的大三和弦 complete 完成音，像教堂钟声的简化版，和谐圆满，约1.2秒',
    duration: 1.2,
    volume: 0.55,
  },
  {
    id: 'unlock_click',
    name: '解锁开启',
    description: '解锁/开启的机械声',
    icon: '🔓',
    category: 'success',
    color: '#06B6D4',
    bgColor: 'rgba(6,182,212,0.08)',
    keywords: ['解锁', '开启', 'unlock', 'open'],
    scenes: ['product', 'abstract'],
    ttsPrompt: '一声 unlock 解锁开启声，机械锁舌弹开的咔哒加轻微魔法音效，约0.8秒',
    duration: 0.8,
    volume: 0.55,
  },
  {
    id: 'level_up',
    name: '升级提升',
    description: '游戏升级音效，积极向上',
    icon: '⬆️',
    category: 'success',
    color: '#06B6D4',
    bgColor: 'rgba(6,182,212,0.08)',
    keywords: ['升级', '提升', 'level up', 'upgrade'],
    scenes: ['product', 'epic'],
    ttsPrompt: '一段 level up 升级音效，上行琶音旋律，伴随星星闪烁的魔幻感，约1.5秒',
    duration: 1.5,
    volume: 0.55,
  },
  {
    id: 'magic_sparkle',
    name: '魔法星光',
    description: '魔法般的闪烁星光音效',
    icon: '🪄',
    category: 'success',
    color: '#06B6D4',
    bgColor: 'rgba(6,182,212,0.08)',
    keywords: ['魔法', '星光', '闪烁', 'magic', 'sparkle'],
    scenes: ['portrait', 'drama', 'landscape'],
    ttsPrompt: '一段 magic sparkle 魔法星光音效，晶莹剔透的三角铁和钟琴声交织，梦幻空灵，约1.5秒',
    duration: 1.5,
    volume: 0.5,
  },
];

// ============================================================
// 工具函数
// ============================================================

/** 根据ID获取特效音定义 */
export function getSfxById(id: SfxId): SfxDefinition | undefined {
  return SFX_LIBRARY.find(s => s.id === id);
}

/** 获取指定分类的所有特效音 */
export function getSfxByCategory(category: SfxCategoryId): SfxDefinition[] {
  return SFX_LIBRARY.filter(s => s.category === category);
}

/** 获取所有分类列表 */
export function getSfxCategories(): SfxCategoryDefinition[] {
  return SFX_CATEGORIES;
}

/**
 * ★ AI智能推荐：根据场景类型自动推荐特效音组合
 *
 * @param sceneType 场景类型 (product/drama/landscape/food/portrait/abstract/interior)
 * @param shotCount 分镜数量
 * @returns 推荐的特效音绑定列表
 */
export function recommendSfxForScene(
  sceneType: string,
  shotCount: number
): SfxBinding[] {
  const recommendations: SfxBinding[] = [];

  // 片头：淡入 + 适当的开场音
  recommendations.push({
    sfxId: 'fade_in' as SfxId,
    shotIndex: -1, // 片头
    timeOffset: 0,
  });

  const sceneMap: Record<string, { mid: SfxId; transition: SfxId; end: SfxId }> = {
    product: {
      mid: 'sting_bright' as SfxId,
      transition: 'swoosh_smooth' as SfxId,
      end: 'success_ding' as SfxId,
    },
    drama: {
      mid: 'impact_boom' as SfxId,
      transition: 'glitch_digital' as SfxId,
      end: 'reveal_dramatic' as SfxId,
    },
    landscape: {
      mid: 'ripple_soft' as SfxId,
      transition: 'swoosh_smooth' as SfxId,
      end: 'fade_out' as SfxId,
    },
    food: {
      mid: 'pop_bubble' as SfxId,
      transition: 'slide_gentle' as SfxId,
      end: 'magic_sparkle' as SfxId,
    },
    portrait: {
      mid: 'snap_finger' as SfxId,
      transition: 'fade_in' as SfxId,
      end: 'complete_chime' as SfxId,
    },
    abstract: {
      mid: 'pulse_electric' as SfxId,
      transition: 'glitch_digital' as SfxId,
      end: 'drop_heavy' as SfxId,
    },
    interior: {
      mid: 'hit_wood' as SfxId,
      transition: 'slide_gentle' as SfxId,
      end: 'fire_crackle' as SfxId,
    },
  };

  const config = sceneMap[sceneType] || sceneMap.product;

  // 中间关键镜头（约1/3和2/3处）添加强调音
  if (shotCount >= 3) {
    const midPoint = Math.floor(shotCount / 2);
    recommendations.push({
      sfxId: config.mid,
      shotIndex: midPoint,
      timeOffset: 0.3,
    });
  }

  // 每个镜头转场添加转场音（跳过第一个镜头）
  for (let i = 1; i < Math.min(shotCount, 5); i++) {
    recommendations.push({
      sfxId: config.transition,
      shotIndex: i,
      timeOffset: 0,
    });
  }

  // 片尾
  recommendations.push({
    sfxId: config.end,
    shotIndex: shotCount - 1,
    timeOffset: Math.max(0, (shotCount > 1 ? 2 : 1)), // 片尾偏移
  });

  return recommendations;
}

/** 搜索特效音（按关键词） */
export function searchSfx(query: string): SfxDefinition[] {
  const q = query.toLowerCase().trim();
  if (!q) return SFX_LIBRARY;

  return SFX_LIBRARY.filter(sfx =>
    sfx.name.toLowerCase().includes(q) ||
    sfx.description.toLowerCase().includes(q) ||
    sfx.keywords.some(k => k.toLowerCase().includes(q)) ||
    sfx.category.includes(q)
  );
}
