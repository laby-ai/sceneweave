/**
 * Scene/emotion prompt data for storyboard generation.
 * Kept separate from the generator so the algorithm file stays reviewable.
 */

export type SceneType =
  | 'outdoor_nature'    // 户外自然（山川湖海森林草原）
  | 'outdoor_urban'     // 户外城市（街道建筑广场公园）
  | 'indoor_home'       // 室内居家（客厅卧室厨房书房）
  | 'indoor_office'     // 室内办公（会议室办公室教室）
  | 'indoor_abstract'   // 抽象/虚拟背景（纯色渐变粒子特效）
  | 'crowd_public'      // 公共人群（商场车站餐厅咖啡馆）
  | 'fantasy'           // 奇幻/科幻（星空宇宙未来幻想）
  | 'unidentified';     // 未识别

export type EmotionType =
  | 'joyful'       // 欢快愉悦
  | 'warm'         // 温馨治愈
  | 'calm'         // 平静安宁
  | 'serious'      // 严肃认真
  | 'tense'        // 紧张刺激
  | 'sad'          // 忧伤感伤
  | 'inspiring'    // 激昂励志
  | 'romantic'     // 浪漫唯美
  | 'neutral';     // 中性

/** 最大单段时长（秒）- 优化：从10s提升到15s，减少镜头数降低图片生成成本 */
export const MAX_SHOT_DURATION = 15;

/** 最小合并阈值（秒）- 短于此值需要与前一段合并 */
export const MIN_SHOT_DURATION = 2;

// ============================================================
// 场景关键词映射表
// ============================================================

export const SCENE_KEYWORDS: Record<SceneType, { keywords: string[]; label: string; visualTemplate: string }> = {
  outdoor_nature: {
    keywords: [
      '海', '沙滩', '山', '森林', '草原', '湖泊', '河流', '日出', '日落', '星空',
      '花', '树', '云', '雨', '雪', '风', '阳光', '月亮', '自然', '户外', '野外',
      '天空', '大地', '海洋', '岛屿', '瀑布', '溪流', '田野', '沙漠', '冰川',
      '海边', '山顶', '林间', '湖畔', '草地', '花园', '田园', '风景', '风光',
    ],
    label: '户外自然',
    visualTemplate: '{subject}在{scene}中，{action}，自然光照明',
  },
  outdoor_urban: {
    keywords: [
      '城市', '街道', '建筑', '广场', '公园', '桥梁', '地铁', '公交', '马路',
      '霓虹', '夜景', '高楼', '商店', '咖啡', '餐厅', '商场', '车站', '机场',
      '路口', '人行道', '天台', '胡同', '巷子', '小镇', '码头', '港口',
      '都市', '繁华', '现代', '街头', '橱窗', '路灯', '喷泉',
    ],
    label: '户外城市',
    visualTemplate: '{subject}在城市{scene}，{action}，城市环境光',
  },
  indoor_home: {
    keywords: [
      '家', '客厅', '卧室', '厨房', '书房', '阳台', '浴室', '沙发', '床',
      '窗', '桌子', '椅子', '电视', '书架', '地毯', '窗帘', '家居', '温暖',
      '温馨', '居家', '房间', '公寓', '房子', '庭院', '客厅', '卧室',
    ],
    label: '室内居家',
    visualTemplate: '室内{scene}环境，{subject}{action}，柔和暖色调灯光',
  },
  indoor_office: {
    keywords: [
      '办公室', '会议', '公司', '工作', '职场', '教室', '学校', '实验室',
      '演讲', '报告', '培训', '讨论', '团队', '项目', '电脑', '白板',
      '讲台', '黑板', '办公桌', '会议室', '大厅', '前台',
    ],
    label: '室内办公',
    visualTemplate: '{scene}环境，{subject}正在{action}，明亮均匀的照明',
  },
  indoor_abstract: {
    keywords: [
      '抽象', '背景', '纯色', '渐变', '粒子', '光影', '几何', '纹理',
      '动态', '特效', '动画', '转场', '过渡', '标题', '字幕', '文字',
    ],
    label: '抽象背景',
    visualTemplate: '{scene}风格的抽象背景，{action}，简洁现代的视觉效果',
  },
  crowd_public: {
    keywords: [
      '人群', '聚会', '派对', '宴会', '婚礼', '庆典', '活动', '演出',
      '观众', '排队', '拥挤', '热闹', '庆典', '仪式', '宴会', '酒会',
      '商场', '超市', '市场', '展会', '发布会',
    ],
    label: '公共人群',
    visualTemplate: '{scene}公共环境，{subject}{action}，环境光丰富有层次',
  },
  fantasy: {
    keywords: [
      '宇宙', '星空', '太空', '未来', '科技', '魔法', '梦幻', '仙境',
      '龙', '精灵', '科幻', '赛博', '虚拟', '数字', '全息', '穿越',
      '异世界', '幻想', '神话', '传说', '超能力', '机甲', '飞行',
    ],
    label: '奇幻科幻',
    visualTemplate: '{scene}奇幻风格场景，{subject}{action}，戏剧性光影效果',
  },
  unidentified: {
    keywords: [],
    label: '通用场景',
    visualTemplate: '{subject}{action}，专业影视级布光和构图',
  },
};

// ============================================================
// 情感关键词映射表
// ============================================================

export const EMOTION_KEYWORDS: Record<EmotionType, { keywords: string[]; label: string; lightingDesc: string; colorTone: string }> = {
  joyful: {
    keywords: ['开心', '快乐', '高兴', '欢乐', '笑', '有趣', '兴奋', '庆祝', '胜利', '成功', '惊喜', '棒', '赞', '喜欢', '爱', '幸福'],
    label: '欢快愉悦',
    lightingDesc: '明亮高调的暖色光照',
    colorTone: '暖黄橙色系',
  },
  warm: {
    keywords: ['温暖', '温馨', '感动', '治愈', '陪伴', '家人', '朋友', '回忆', '思念', '珍惜', '感谢', '感恩', '拥抱', '关心', '体贴'],
    label: '温馨治愈',
    lightingDesc: '柔和的暖金色侧光',
    colorTone: '琥珀暖棕色调',
  },
  calm: {
    keywords: ['平静', '安静', '宁静', '放松', '舒适', '悠闲', '慢', '休息', '冥想', '思考', '沉淀', '从容', '淡定', '平和', '安详'],
    label: '平静安宁',
    lightingDesc: '柔和均匀的自然散射光',
    colorTone: '低饱和冷青色调',
  },
  serious: {
    keywords: ['严肃', '认真', '正式', '重要', '关键', '决定', '分析', '研究', '讲解', '说明', '介绍', '定义', '原理', '规则', '注意'],
    label: '严肃认真',
    lightingDesc: '正面主光+轮廓光的经典三点布光',
    colorTone: '中性偏冷的蓝灰色调',
  },
  tense: {
    keywords: ['紧张', '危险', '紧急', '快速', '冲刺', '追逐', '战斗', '冲突', '危机', '挑战', '突破', '极限', '激烈', '惊险', '悬念'],
    label: '紧张刺激',
    lightingDesc: '高对比度的明暗对照光',
    colorTone: '高对比冷暖对比色',
  },
  sad: {
    keywords: ['悲伤', '难过', '伤心', '失落', '孤独', '寂寞', '离别', '告别', '遗憾', '抱歉', '对不起', '哭泣', '泪', '痛', '苦'],
    label: '忧伤感伤',
    lightingDesc: '低调暗淡的冷色散光',
    colorTone: '灰蓝色调',
  },
  inspiring: {
    keywords: ['梦想', '希望', '奋斗', '努力', '坚持', '拼搏', '超越', '成长', '蜕变', '觉醒', '力量', '勇气', '信念', '不放弃', '向前'],
    label: '激昂励志',
    lightingDesc: '逆光或侧逆光营造神圣感',
    colorTone: '金橙到深蓝的渐变色调',
  },
  romantic: {
    keywords: ['浪漫', '爱', '恋', '心动', '甜蜜', '温柔', '美丽', '唯美', '邂逅', '约定', '承诺', '永恒', '唯一', '眷恋'],
    label: '浪漫唯美',
    lightingDesc: '梦幻柔光+散景光斑',
    colorTone: '粉紫玫瑰金色调',
  },
  neutral: {
    keywords: [],
    label: '中性',
    lightingDesc: '自然平衡的光照',
    colorTone: '自然真实色调',
  },
};

// ============================================================
// 方案A: 场景×情感 组合视觉描述矩阵（72组合）
// 每个组合提供差异化的具体视觉元素，替代原来的泛化模板
// ============================================================

export interface SceneEmotionVisual {
  /** 具体场景元素描述（含具体景物，非标签） */
  sceneElements: string;
  /** 光线具象描述（时间+类型+效果） */
  lightConcrete: string;
  /** 色彩氛围 */
  colorMood: string;
  /** 推荐镜头语言 */
  cameraHint: string;
  /** 画面细节补充 */
  detailNotes: string;
}

/**
 * 8场景 × 9情感 = 72种组合的视觉描述矩阵
 * 
 * 使用方式: SCENE_EMOTION_MATRIX[sceneType][emotion]
 * 返回该组合下的具体视觉描述，直接用于构建 prompt
 */
export const SCENE_EMOTION_MATRIX: Record<SceneType, Record<EmotionType, SceneEmotionVisual>> = {
  // ==================== 户外自然 (outdoor_nature) ====================
  outdoor_nature: {
    joyful: {
      sceneElements: '阳光穿透树叶形成丁达尔光柱，草地翠绿欲滴，远处蝴蝶飞舞，花朵随风摇曳',
      lightConcrete: '清晨金色侧逆光，光斑洒落地面，明暗对比柔和温暖',
      colorMood: '明亮通透的暖黄绿色调，高饱和度',
      cameraHint: '中景跟拍 + 缓慢推近，捕捉动态生机',
      detailNotes: '露珠在叶片上闪烁，微风拂过发丝和衣角',
    },
    warm: {
      sceneElements: '黄昏时分的林间小径或湖畔长椅，柔和的金色光线笼罩一切，温馨宁静',
      lightConcrete: '日落黄金时刻的暖调侧光，长长的影子延伸',
      colorMood: '琥珀金与暖棕色调，低对比度柔和高贵',
      cameraHint: '缓慢横摇 + 中景固定，营造沉浸感',
      detailNotes: '手捧热饮的白雾升腾，远处炊烟袅袅',
    },
    calm: {
      sceneElements: '薄雾笼罩的山林湖面，水面平静如镜倒映山影，孤舟静泊岸边',
      lightConcrete: '清晨漫射冷调柔光，无强烈方向性，均匀铺满画面',
      colorMood: '冷青灰蓝色调，低饱和度静谧悠远',
      cameraHint: '广角固定机位或极慢拉远，强调空间感',
      detailNotes: '水面上轻微涟漪扩散，鸟儿掠过水面留下一道波纹',
    },
    serious: {
      sceneElements: '暴风雨来临前的荒野，乌云压顶，树木在风中剧烈摇摆，天地间充满张力',
      lightConcrete: '强烈的明暗对照光，云层缝隙透出的冷色光束切割画面',
      colorMood: '深灰蓝与暗绿的高对比色调，压抑而有力',
      cameraHint: '低角度仰拍 + 缓慢推近，增强压迫感',
      detailNotes: '飞鸟惊慌四散，草浪翻滚如海',
    },
    tense: {
      sceneElements: '陡峭悬崖边狂风呼啸，暴雨将至电闪雷鸣，人物在险境中艰难前行',
      lightConcrete: '闪电瞬间照亮的硬光 + 其余时间的深沉黑暗，极端高对比',
      colorMood: '冷暖剧烈冲突的撕裂色调，不安定感强烈',
      cameraHint: '手持抖动 + 急速推拉，纪实紧张感',
      detailNotes: '雨水打湿头发贴在脸上，脚下碎石滚落深渊',
    },
    sad: {
      sceneElements: '萧瑟秋日的空旷原野，枯叶纷飞，孤零零的长椅上落满落叶',
      lightConcrete: '阴天灰暗散射光，缺乏温暖感，平淡冷漠',
      colorMood: '灰褐与枯黄的褪色色调，低饱和度萧瑟',
      cameraHint: '远景固定 + 极慢推近至背影特写',
      detailNotes: '一片枯叶缓缓旋转飘落，最终静止在地面上',
    },
    inspiring: {
      sceneElements: '日出时分站在山顶俯瞰云海，金光照亮整片大地，万物苏醒充满希望',
      lightConcrete: '日出逆光/侧逆光，神圣的金色轮廓光包裹主体',
      colorMood: '从深邃蓝到辉煌金的渐变色调，戏剧性强烈',
      cameraHint: '大范围拉升 + 环绕主体，展现宏大格局',
      detailNotes: '云海翻涌如金色的海洋，风展红旗猎猎作响',
    },
    romantic: {
      sceneElements: '黄昏金色沙滩，海浪轻柔拍岸，夕阳将天空染成橙粉色渐变',
      lightConcrete: '魔幻时刻的粉橙色漫射光，海面反射碎钻般的光点',
      colorMood: '粉紫玫瑰金梦幻色调，柔焦散景效果',
      cameraHint: '慢拉镜 + 低角度跟拍，浪漫唯美',
      detailNotes: '两人脚印并列延伸向远方，海鸥划过霞光',
    },
    neutral: {
      sceneElements: '开阔的自然景观，清晰的天空地平线，自然环境层次分明',
      lightConcrete: '白昼自然平衡光，无明显色彩倾向',
      colorMood: '自然真实色调，还原肉眼所见',
      cameraHint: '标准广角建立镜头，平稳构图',
      detailNotes: '环境细节丰富但不抢眼，主体与环境和谐共存',
    },
  },

  // ==================== 户外城市 (outdoor_urban) ====================
  outdoor_urban: {
    joyful: {
      sceneElements: '繁华步行街阳光明媚，行人悠闲漫步，橱窗明亮，街头艺人表演',
      lightConcrete: '晴朗白天高调自然光，建筑投下清晰的几何阴影',
      colorMood: '明亮活泼的多彩色调，都市活力感',
      cameraHint: '横摇扫街 + 跟拍主体穿行人群',
      detailNotes: '气球飘扬，孩童追逐嬉戏，咖啡店门口排队',
    },
    warm: {
      sceneElements: '傍晚街角的老咖啡馆外摆区，暖黄路灯初上，三两好友围坐畅谈',
      lightConcrete: '黄昏过渡到夜晚的暖黄人造光源，灯笼/霓虹/路灯交相辉映',
      colorMood: '琥珀暖橙色调，胶片颗粒质感',
      cameraHint: '固定中景 + 缓慢推近至桌面细节',
      detailNotes: '蒸汽从咖啡杯升起，玻璃窗上的雨痕折射灯光',
    },
    calm: {
      sceneElements: '清晨空无一人的城市街道，清洁车刚刚驶过，路面湿润反光',
      lightConcrete: '黎明前的淡蓝散射光，城市尚未完全苏醒',
      colorMood: '清冷的青灰色调，安静有序',
      cameraHint: '超广角固定 + 极慢横摇展现空旷街道',
      detailNotes: '红绿灯有节奏地变换，远处第一辆公交车驶来',
    },
    serious: {
      sceneElements: '高耸入云的摩天楼群底部仰拍，玻璃幕墙反射着冷峻的天空',
      lightConcrete: '正午硬光或阴天均匀冷光，强调建筑的理性线条',
      colorMood: '钢蓝灰冷色调，现代主义极简感',
      cameraHint: '极低角度仰拍 + 缓慢竖摇向上',
      detailNotes: '玻璃幕墙反射出扭曲的城市影像，行人如蚂蚁般渺小',
    },
    tense: {
      sceneElements: '雨夜狭窄的后巷，霓虹灯牌闪烁不定，积水坑映出破碎的光影',
      lightConcrete: '冷暖冲突的人造光源——红色霓虹 vs 蓝色路灯光',
      colorMood: '高对比赛博朋克风格，黑色占主导',
      cameraHint: '手持跟拍 + 荷兰角倾斜，不安定构图',
      detailNotes: '水坑中的倒影随脚步踩踏碎裂，远处警笛声隐约',
    },
    sad: {
      sceneElements: '深夜末班车站空荡的站台，广告牌孤独发光，末班车即将驶离',
      lightConcrete: '稀疏冷白色荧光灯，缺乏温度感的照明',
      colorMood: '去饱和的蓝灰色调，孤独疏离',
      cameraHint: '远景固定 + 缓慢推近至孤独身影',
      detailNotes: '列车驶过带起的风吹起站台上的废报纸',
    },
    inspiring: {
      sceneElements: '城市天际线日出全景，第一缕阳光照亮最高楼的尖顶，整座城市开始苏醒',
      lightConcrete: '日出逆光剪影效果，建筑群呈现壮观的轮廓',
      colorMood: '从深靛蓝到金黄白的壮丽渐变',
      cameraHint: '航拍级大景别 + 缓慢拉升推进',
      detailNotes: '无数窗户逐排亮起灯光如同星河落地',
    },
    romantic: {
      sceneElements: '城市夜景中的江边/河边步道，对岸灯火璀璨如银河，情侣并肩漫步',
      lightConcrete: '夜晚城市散景光斑 + 柔和的路灯补光',
      colorMood: '深蓝底色配暖黄点缀，梦幻散景',
      cameraHint: '侧面跟拍 + 焦外虚化运镜',
      detailNotes: '远处桥梁灯光在水面的倒影被行船打破成金色涟漪',
    },
    neutral: {
      sceneElements: '标准城市街景，建筑道路行人车辆井然有序',
      lightConcrete: '白天自然平衡光或标准夜间照明',
      colorMood: '真实还原的城市色调',
      cameraHint: '标准广角或中景，平衡构图',
      detailNotes: '城市日常生活的典型切片',
    },
  },

  // ==================== 室内居家 (indoor_home) ====================
  indoor_home: {
    joyful: {
      sceneElements: '阳光充足的客厅，窗帘半开，有人在沙发上欢笑或与宠物玩耍',
      lightConcrete: '午后温暖斜射阳光穿过纱帘，形成柔和的光晕',
      colorMood: '米白暖黄色调，温馨舒适的高调画面',
      cameraHint: '中景跟拍 + 环绕捕捉欢乐互动',
      detailNotes: '宠物跳跃追逐玩具，阳光下的尘埃微粒漂浮',
    },
    warm: {
      sceneElements: '厨房里炖汤冒出的蒸汽，一家人围坐在餐桌旁，桌上摆满了菜肴',
      lightConcrete: '暖黄色吊灯集中照明 + 窗外透进的暮光辅助',
      colorMood: '浓郁琥珀暖棕色调，家的味道',
      cameraHint: '固定中景记录 + 缓慢推近至表情',
      detailNotes: '热气腾腾的食物，碰杯的瞬间，孩子的笑脸',
    },
    calm: {
      sceneElements: '安静的卧室一角，床头灯散发微光，有人蜷缩在沙发上看书或发呆',
      lightConcrete: '单一暖色点光源（台灯/落地灯），周围环境渐暗',
      colorMood: '低饱和暖米色调，安宁私密',
      cameraHint: '近景固定 + 极微慢推或不移动',
      detailNotes: '书页轻轻翻动，猫趴在膝盖上打盹',
    },
    serious: {
      sceneElements: '书房或工作间，书架整齐排列，桌上一盏专注的阅读灯照亮文件',
      lightConcrete: '功能性冷白聚光灯，集中照射工作区域',
      colorMood: '中性偏冷的灰棕色调，理性专注',
      cameraHint: '过肩镜头 + 缓慢推近至手部/文件细节',
      detailNotes: '笔尖在纸上书写，时钟滴答走字',
    },
    tense: {
      sceneElements: '家中突然变暗的走廊，窗外闪电照亮室内一瞬又归于黑暗',
      lightConcrete: '不稳定的间歇光源（闪电/忽明忽暗的灯），极端明暗交替',
      colorMood: '深暗底色配刺眼亮部，不安感',
      cameraHint: '手持晃动 + 急推急拉',
      detailNotes: '门缝下透进来的光，墙上影子突然拉长',
    },
    sad: {
      sceneElements: '空荡荡的房间，家具上覆盖薄布或灰尘，一人独坐窗边望向外面的雨',
      lightConcrete: '阴雨天惨白散射光透过窗户，室内昏暗',
      colorMood: '去饱和灰蓝色调，寂寥落寞',
      cameraHint: '远景固定 + 超慢推近至背影',
      detailNotes: '窗玻璃上的雨痕模糊了外面的世界，照片框倒在桌上',
    },
    inspiring: {
      sceneElements: '晨光中有人在阳台伸展身体做瑜伽或冥想，新的一天充满能量',
      lightConcrete: '清晨金色逆光从阳台门窗涌入，轮廓光勾勒身形',
      colorMood: '从淡金到纯白的积极色调',
      cameraHint: '侧面中景 + 缓慢环绕',
      detailNotes: '植物叶片上的露珠闪光，远处城市慢慢苏醒的声音',
    },
    romantic: {
      sceneElements: '温馨卧室的烛光晚餐布置，玫瑰花瓣撒在床单上，柔和音乐背景',
      lightConcrete: '蜡烛多点暖光源 + 灯串装饰光，无主光源',
      colorMood: '玫瑰粉与蜜糖金的浪漫色调',
      cameraHint: '特写慢推 + 焦外虚化',
      detailNotes: '烛光摇曳在眼中映出光芒，手指轻触花瓣',
    },
    neutral: {
      sceneElements: '标准的居家室内环境，家具陈设整洁生活化',
      lightConcrete: '室内常规照明（吸顶灯/自然光）',
      colorMood: '自然的家居色调',
      cameraHint: '标准中景或全景，平实记录',
      detailNotes: '日常生活空间的正常状态',
    },
  },

  // ==================== 室内办公 (indoor_office) ====================
  indoor_office: {
    joyful: {
      sceneElements: '开放式办公室里的庆祝时刻，团队击掌欢呼，彩带飘落',
      lightConcrete: '明亮均匀的办公照明 + 庆祝气氛的额外暖光',
      colorMood: '明亮活跃的企业品牌色 + 暖色点缀',
      cameraHint: '中景横摇扫过团队 + 推近至笑容',
      detailNotes: '屏幕上显示成功的数据图表，香槟杯碰撞',
    },
    warm: {
      sceneElements: '茶水间或休息区的轻松交流，同事分享食物或故事',
      lightConcrete: '较主办公区更柔和温暖的辅助照明',
      colorMood: '温和的暖棕色调，人情味',
      cameraHint: '中近景固定 + 自然捕捉互动',
      detailNotes: '咖啡杯的热气，轻松的肢体语言和笑容',
    },
    calm: {
      sceneElements: '安静的会议室或独立工位，专注工作的状态，屏幕发出稳定的光',
      lightConcrete: '功能性的均匀照明，屏幕冷光作为补充',
      colorMood: '冷静的中性灰蓝色调',
      cameraHint: '过肩镜头或侧面固定，不打扰专注',
      detailNotes: '键盘敲击的手指，屏幕上光标移动，偶尔端起水杯',
    },
    serious: {
      sceneElements: '正式会议室，投影幕布展示关键数据，与会者神情专注',
      lightConcrete: '会议模式的专业三点布光，重点照亮演讲者',
      colorMood: '偏冷的商务蓝灰色调，专业严谨',
      cameraHint: '演讲者正面中景 + 切换听众反应镜头',
      detailNotes: '激光笔指向数据曲线，听众点头或记笔记',
    },
    tense: {
      sceneElements: '紧急情况下的指挥中心或危机会议室，多人同时通话屏幕闪烁红光',
      lightConcrete: '高强度照明 + 屏幕红光的异常色彩侵入',
      colorMood: '警报红与冷白光的冲突色调',
      cameraHint: '快速切换多角度 + 手持紧迫感',
      detailNotes: '多人同时说话手势激烈，屏幕上倒计时跳动',
    },
    sad: {
      sceneElements: '下班后的空办公室，只剩一盏台灯亮着，有人独自加班到深夜',
      lightConcrete: '孤立的单一点光源，周围大面积阴影',
      colorMood: '孤独的冷蓝灰色调',
      cameraHint: '远景固定 + 缓慢推近至疲惫的身影',
      detailNotes: '窗外城市的万家灯火，桌上凉掉的咖啡',
    },
    inspiring: {
      sceneElements: '大型发布会或演讲现场，聚光灯打在演讲者身上，台下掌声雷动',
      lightConcrete: '舞台追光聚焦 + 观众席逐渐亮起的响应',
      colorMood: '从聚焦白到全场暖金的升华色调',
      cameraHint: '大范围拉升 + 推近至演讲者激情瞬间',
      detailNotes: '双手握拳举起，观众站起身鼓掌',
    },
    romantic: {
      sceneElements: '办公室窗边的偶遇时刻，夕阳透过百叶窗洒下条纹光影',
      lightConcrete: '傍晚金色光线穿过百叶窗形成的条状光斑',
      colorMood: '温暖金色调，在冷峻环境中格外动人',
      cameraHint: '侧面中景 + 缓慢推近',
      detailNotes: '光斑在脸上移动，两人目光交汇的瞬间',
    },
    neutral: {
      sceneElements: '标准办公环境，工位会议室走廊等日常工作空间',
      lightConcrete: '标准办公照明系统',
      colorMood: '中性的商务色调',
      cameraHint: '标准记录式拍摄',
      detailNotes: '办公环境的日常运作状态',
    },
  },

  // ==================== 抽象背景 (indoor_abstract) ====================
  indoor_abstract: {
    joyful: {
      sceneElements: '明亮渐变色背景配合轻盈粒子漂浮，色彩活泼跳跃',
      lightConcrete: '自发光的抽象光源，中心亮边缘柔和衰减',
      colorMood: '彩虹渐变或糖果色系，欢快明亮',
      cameraHint: '缓慢推进 + 粒子环绕',
      detailNotes: '光点和几何形状轻盈舞动',
    },
    warm: {
      sceneElements: '柔和的暖色渐变背景，光斑如记忆碎片般缓缓浮现消散',
      lightConcrete: '朦胧的弥散光效，如旧照片般的柔焦感',
      colorMood: '琥珀到蜜桃的暖色渐变，怀旧温柔',
      cameraHint: '极慢推近或静止，让画面呼吸',
      detailNotes: '光粒子的运动如呼吸般缓慢',
    },
    calm: {
      sceneElements: '纯净的低饱和度渐变或流动的流体形态，简洁禅意',
      lightConcrete: '均匀柔和的自发光，无明确方向',
      colorMood: '莫兰迪色系或冷灰蓝渐变，平静致远',
      cameraHint: '固定或极慢移动，冥想般节奏',
      detailNotes: '流体/粒子的运动如水般流畅',
    },
    serious: {
      sceneElements: '几何线条构成的秩序化空间，网格或数据流背景',
      lightConcrete: '精确的功能性照明，突出结构线条',
      colorMood: '黑白灰或深蓝科技色调，理性冷静',
      cameraHint: '沿线条方向移动 + 结构展示',
      detailNotes: '数据节点连接发光，信息流动可视化',
    },
    tense: {
      sceneElements: '碎片化/故障艺术风格的背景，画面不稳定撕裂感',
      lightConcrete: '频闪或明灭不定的异常光源',
      colorMood: '高对比黑红或故障色彩的冲突色调',
      cameraHint: '快速切换 + 变形扭曲效果',
      detailNotes: '画面边缘出现数字噪点或撕裂',
    },
    sad: {
      sceneElements: '暗淡褪色的背景，如老电影胶片的颗粒感和划痕',
      lightConcrete: '微弱且逐渐衰减的光源',
      colorMood: '去饱和的灰褐色调，如褪色的回忆',
      cameraHint: '几乎静止 + 极慢淡出效果',
      detailNotes: '颗粒感明显，如老旧胶片的质感',
    },
    inspiring: {
      sceneElements: '从暗处迸发出的光芒，粒子汇聚成形或光束冲破黑暗',
      lightConcrete: '核心强光向外辐射，体积光效果',
      colorMood: '从深邃暗色到辉煌亮色的戏剧性渐变',
      cameraHint: '跟随光束方向推进 + 环绕爆发',
      detailNotes: '光粒子加速汇聚，能量感不断增强',
    },
    romantic: {
      sceneElements: '梦幻的散景光斑背景，如星光洒落或水晶折射',
      lightConcrete: '大量柔和的点光源散景，梦幻迷离',
      colorMood: '粉紫玫瑰金的柔美渐变',
      cameraHint: '穿过光斑缓慢推进',
      detailNotes: '光斑大小不一如宝石般闪烁',
    },
    neutral: {
      sceneElements: '简洁的纯色或线性渐变背景，专业干净',
      lightConcrete: '均匀无方向的填充光',
      colorMood: '中性专业色调',
      cameraHint: '标准稳定构图',
      detailNotes: '干净的背景不干扰主体',
    },
  },

  // ==================== 公共人群 (crowd_public) ====================
  crowd_public: {
    joyful: {
      sceneElements: '热闹的庆典或派对现场，彩旗飘扬，人群欢呼举杯',
      lightConcrete: '多彩的节日灯光 + 闪光灯频繁闪烁',
      colorMood: '高饱和度的多彩喜庆色调',
      cameraHint: '横摇扫过人群 + 抓拍精彩瞬间',
      detailNotes: '彩带礼花飘落，人们拥抱跳跃',
    },
    warm: {
      sceneElements: '婚礼现场或家庭聚餐，长辈微笑年轻人敬酒，温情脉脉',
      lightConcrete: '暖色宴会照明 + 蜡烛/装饰灯点缀',
      colorMood: '温暖的金色庆典色调',
      cameraHint: '中景捕捉互动 + 特写情感表情',
      detailNotes: '交换眼神的瞬间，老人欣慰的笑容',
    },
    calm: {
      sceneElements: '图书馆或美术馆的安静角落，零星参观者驻足欣赏',
      lightConcrete: '柔和的展厅/馆内专业照明',
      colorMood: '优雅的低饱和度文化色调',
      cameraHint: '缓慢移动 + 静态观察视角',
      detailNotes: '脚步声轻微回响，目光追随展品',
    },
    serious: {
      sceneElements: '正式会议或发布会的观众席，众人专注聆听认真记录',
      lightConcrete: '专业的会场均匀照明',
      colorMood: '严肃的商务中性色调',
      cameraHint: '扫过观众席 + 聚焦关键人物',
      detailNotes: '整齐就座，不时点头或低头记录',
    },
    tense: {
      sceneElements: '拥挤的车站机场人流匆匆，焦虑的面孔和匆忙的脚步',
      lightConcrete: '冰冷的大型公共场所荧光照明',
      colorMood: '偏冷的不安色调，人潮压迫感',
      cameraHint: '手持跟拍 + 广角挤压人群密度',
      detailNotes: '时钟滴答，广播通知，张望等待的脸',
    },
    sad: {
      sceneElements: '散场后的场馆空座遍地，工作人员默默收拾清理',
      lightConcrete: '部分关闭的照明，明暗交错',
      colorMood: '寂寥的去饱和冷色调',
      cameraHint: '广角扫过空座 + 推近至清扫动作',
      detailNotes: '垃圾袋装满，座椅翻转的声响回荡',
    },
    inspiring: {
      sceneElements: '演唱会或体育赛事现场万人齐声欢呼，能量爆棚',
      lightConcrete: '炫目的舞台灯光 + 观众手机星光海洋',
      colorMood: '高能量的鲜艳色调，肾上腺素感',
      cameraHint: '大范围拉升展现规模 + 推近至激情面孔',
      detailNotes: '双手高举挥舞，跳起来呐喊',
    },
    romantic: {
      sceneElements: '高档餐厅或爵士酒吧的暧昧氛围，烛光摇曳低语绵绵',
      lightConcrete: '极度柔和的点状光源为主',
      colorMood: '深色底配暖色光点的浪漫色调',
      cameraHint: '焦外虚化 + 缓慢推近至亲密互动',
      detailNotes: '酒杯轻碰，指尖触碰的微妙',
    },
    neutral: {
      sceneElements: '标准的公共空间日常状态，人流适中秩序井然',
      lightConcrete: '公共空间标准照明',
      colorMood: '真实的公共空间色调',
      cameraHint: '标准广角记录',
      detailNotes: '公共空间的日常运转',
    },
  },

  // ==================== 奇幻科幻 (fantasy) ====================
  fantasy: {
    joyful: {
      sceneElements: '未来都市空中花园全息投影绽放烟花，飞行器穿梭于霓虹建筑之间',
      lightConcrete: '霓虹全息光效 + 多彩的环境反射光',
      colorMood: '赛博朋克的高饱和霓虹色调',
      cameraHint: '航拍级拉升 + 跟拍飞行器',
      detailNotes: '全息广告牌播放欢乐内容，人群穿着发光服饰',
    },
    warm: {
      sceneElements: '星空下的未来家园穹顶城市内部，人造太阳散发温暖光芒',
      lightConcrete: '模拟自然光的柔和人工恒星光源',
      colorMood: '温暖的白金科幻色调',
      cameraHint: '缓慢环绕 + 温馨的家庭/社区场景',
      detailNotes: '植物在全息温室中生长，孩子追逐全息宠物',
    },
    calm: {
      sceneElements: '宇宙深处的空间站观景舱，静默漂浮的星云和遥远的星系',
      lightConcrete: '星光和星云的微弱冷光为主',
      colorMood: '深邃的紫蓝黑色太空色调',
      cameraHint: '极慢推进或通过舷窗凝视',
      detailNotes: '尘埃微粒在光束中漂浮，地球悬挂在远方',
    },
    serious: {
      sceneElements: '高科技指挥中心巨大的全息战术地图，数据流瀑布般倾泻',
      lightConcrete: '冷蓝色的全息投影光 + 界面UI发光',
      colorMood: '冰蓝科技色调，精密冷酷',
      cameraHint: '围绕全息图环绕 + 推近至操作者',
      detailNotes: '数据流实时变化，全息窗口弹出警告',
    },
    tense: {
      sceneElements: '赛博朋克城市的雨夜追逐，霓虹灯在积水中无限反射延伸',
      lightConcrete: '高对比霓虹冷暖冲突光 + 闪电/爆炸的瞬时强光',
      colorMood: '极致高对比的赛博朋克黑红蓝色调',
      cameraHint: '极速跟拍 + 荷兰角倾斜',
      detailNotes: '全息广告闪烁故障效果，飞行器低空掠过',
    },
    sad: {
      sceneElements: '废弃的未来城市废墟，断裂的全息广告牌断续闪烁最后的光',
      lightConcrete: '濒临熄灭的残余光源，大部分陷入黑暗',
      colorMood: '锈迹斑斑的暗淡金属色调',
      cameraHint: '缓慢穿过废墟 + 停留在最后的发光体',
      detailNotes: '藤蔓爬满金属骨架，全息影像断续播放旧日画面',
    },
    inspiring: {
      sceneElements: '星际飞船跃迁出口现壮观星团，无尽星辰如钻石地毯铺展',
      lightConcrete: '恒星的光芒 + 星云发射/反射的绚丽色彩',
      colorMood: '从深空黑到星辉万丈的震撼渐变',
      cameraHint: '穿越视野的大幅拉升 + 冲向星辰',
      detailNotes: '飞船引擎的蓝色尾焰划破黑暗',
    },
    romantic: {
      sceneElements: '太空 colony 的透明穹顶下两人共赏人造极光或星云舞蹈',
      lightConcrete: '极光/星云的梦幻漫射光 + 内部柔和照明',
      colorMood: '梦幻的紫粉蓝极光色调',
      cameraHint: '侧面中景 + 焦外虚化前景',
      detailNotes: '极光如绸缎般在天幕上飘舞，两人的剪影',
    },
    neutral: {
      sceneElements: '标准的科幻/奇幻场景环境，科技元素与空间布局',
      lightConcrete: '科幻场景的标准照明方案',
      colorMood: '科技感的标准色调',
      cameraHint: '标准科幻场景拍摄手法',
      detailNotes: '科幻世界的基础视觉呈现',
    },
  },

  // ==================== 未识别 (unidentified) ====================
  unidentified: {
    joyful: {
      sceneElements: '明亮开放的空间，充满活力和正向能量的环境',
      lightConcrete: '明亮高调的自然或人造光源',
      colorMood: '暖黄橙的愉悦色调',
      cameraHint: '中景 + 轻快运镜',
      detailNotes: '整体氛围积极向上',
    },
    warm: {
      sceneElements: '舒适亲切的环境，给人安全感和归属感',
      lightConcrete: '柔和温暖的定向光源',
      colorMood: '琥珀暖棕的治愈色调',
      cameraHint: '近景 + 缓慢推近',
      detailNotes: '氛围温馨放松',
    },
    calm: {
      sceneElements: '简洁有序的空间，没有多余的干扰元素',
      lightConcrete: '柔和均匀的散射光',
      colorMood: '低饱和的平和色调',
      cameraHint: '固定或极慢移动',
      detailNotes: '安静祥和的氛围',
    },
    serious: {
      sceneElements: '规整正式的环境，强调结构和秩序',
      lightConcrete: '功能性明确的照明',
      colorMood: '中性偏冷的理性色调',
      cameraHint: '稳定构图的正式镜头',
      detailNotes: '专业严谨的感觉',
    },
    tense: {
      sceneElements: '存在某种压力或不确定性的环境',
      lightConcrete: '可能存在明暗不均或闪烁的光源',
      colorMood: '较高对比度的不安定色调',
      cameraHint: '略带紧张感的运镜',
      detailNotes: '暗示某种张力',
    },
    sad: {
      sceneElements: '空旷或略显萧瑟的环境',
      lightConcrete: '偏暗或平淡的光线',
      colorMood: '去饱和的低沉色调',
      cameraHint: '缓慢沉重的运镜',
      detailNotes: '情绪低落的氛围',
    },
    inspiring: {
      sceneElements: '开阔宏大的环境，具有向上的力量感',
      lightConcrete: '戏剧性的逆光或轮廓光',
      colorMood: '从暗到明的升华色调',
      cameraHint: '大景别 + 向上/向前推进',
      detailNotes: '激励人心的感觉',
    },
    romantic: {
      sceneElements: '优美动人的环境，具有美感',
      lightConcrete: '梦幻柔美的光线',
      colorMood: '柔美浪漫的粉紫金色调',
      cameraHint: '唯美运镜 + 虚化处理',
      detailNotes: '浪漫唯美的感受',
    },
    neutral: {
      sceneElements: '通用的标准环境，无明显特征偏向',
      lightConcrete: '自然平衡的标准照明',
      colorMood: '真实自然的标准色调',
      cameraHint: '标准稳定的拍摄方式',
      detailNotes: '中立客观的呈现',
    },
  },
};

// ============================================================
// 动作关键词 → 视觉动作映射
// ============================================================
