// 视频提示词生成指南 - 基于用户提供的详细文档

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'advanced' | 'pitfall';
  template: string;
  example: string;
  weight?: number;
}

export interface CameraMovement {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'combination' | 'professional' | 'scene';
  sceneCategory?: 'portrait' | 'product' | 'landscape' | 'drama';
  example: string;
}

// ==================== 基础提示词方法 ====================
export const BASIC_PROMPT_METHODS: PromptTemplate[] = [
  {
    id: 'subject-definition',
    name: '主体精准定义法',
    description: '拒绝模糊表述，必写"核心属性+外观特征+状态"，这是权重最高的指令',
    category: 'basic',
    template: '{年龄}{种族}{颜值类型}{性别}，{发型描述}，{服装描述}，{位置/姿态}，{表情/状态}',
    example: '20岁东亚淡颜女生，黑长直齐肩发，白色棉麻连衣裙，赤足站在海边，表情温柔'
  },
  {
    id: 'sequence-action',
    name: '时序动作写法',
    description: '写清动作先后顺序、速度、幅度，避免单点动作，解决画面卡顿、肢体变形',
    category: 'basic',
    template: '{主体}{动作1}，{动作2}，{动作3}，全程{状态描述}',
    example: '女生缓步向前走，手臂自然摆动，发丝随海风轻柔扬起，全程连贯无卡顿'
  },
  {
    id: 'scene-movement',
    name: '景运组合法',
    description: '每句提示词搭配1种景别+1种运镜，不堆砌，新手首选"近景+慢推""中景+跟拍""全景+慢拉"',
    category: 'basic',
    template: '{景别}构图，{运镜方式}，展现{内容}',
    example: '中景构图，平稳跟随运镜，展现女生完整舞蹈动作'
  },
  {
    id: 'light-concrete',
    name: '光影具象法',
    description: '不用"氛围感拉满"，写清光线类型+明暗效果',
    category: 'basic',
    template: '{时间/天气}{光线类型}，{光效描述}，{画面效果}',
    example: '黄昏日落逆光，金色丁达尔光效，柔光铺满画面，明暗对比柔和'
  },
  {
    id: 'quality-required',
    name: '画质必加句',
    description: '所有场景通用，直接复制',
    category: 'basic',
    template: '4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊',
    example: '4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊'
  },
  {
    id: 'style-single',
    name: '风格单一法',
    description: '单条提示词只加1-2个风格词，避免混乱',
    category: 'basic',
    template: '{风格1}，{风格描述1}[，{风格2}，{风格描述2}]',
    example: '复古胶片风格，色彩饱满，颗粒感明显'
  },
  {
    id: 'image-to-video',
    name: '图生视频专属法',
    description: '必加"与参考图主体完全一致，不修改核心设定"，避免偏离参考图',
    category: 'basic',
    template: '与参考图主体完全一致，不修改核心设定',
    example: '与参考图主体完全一致，不修改核心设定'
  },
  {
    id: 'negative-simple',
    name: '负面提示词精简法',
    description: '只写核心避坑点',
    category: 'basic',
    template: '无{负面1}、无{负面2}、无{负面3}、无{负面4}',
    example: '无变脸、无肢体畸形、无穿模、无跳帧'
  }
];

// ==================== 进阶提示词方法 ====================
export const ADVANCED_PROMPT_METHODS: PromptTemplate[] = [
  {
    id: 'weight-annotation',
    name: '权重标注法',
    description: '用{}标注权重（1.0-1.5），核心主体和约束指令权重高于其他，避免算力失衡',
    category: 'advanced',
    template: '【{主体描述}{{{权重}}}】，{动作描述}，{约束描述}{{{权重}}}',
    example: '【30岁成熟男性{1.2}，黑色西装】，缓慢整理领带，画面稳定无抖动{1.1}',
    weight: 1.2
  },
  {
    id: 'action-detail',
    name: '动作细节补充法',
    description: '添加动作幅度、速度修饰词，增强画面生动性',
    category: 'advanced',
    template: '{主体}{动作}，{动作细节1}，{动作细节2}，无{负面状态}',
    example: '指尖轻轻划过脸颊，动作轻柔缓慢，无僵硬卡顿'
  },
  {
    id: 'scene-atmosphere',
    name: '场景氛围具象法',
    description: '写清时间+环境+细节',
    category: 'advanced',
    template: '{时间}{地点}，{环境细节1}，{环境细节2}，{环境细节3}',
    example: '深夜城市街头，暖黄路灯，地面湿润反光，霓虹灯光映在墙面'
  },
  {
    id: 'bilingual-mix',
    name: '中英文混写法',
    description: '用中文写意境，英文写专业镜头/画质术语，效果翻倍',
    category: 'advanced',
    template: '{中文风格/意境}，{英文专业术语1}，{英文专业术语2}',
    example: '日系清新风格，FPV drone shot（无人机第一视角），4K ultra HD'
  },
  {
    id: 'multi-shot-storyboard',
    name: '多镜头分镜法',
    description: '按镜号拆分，每镜标注"景别+运镜+动作"，确保叙事连贯',
    category: 'advanced',
    template: '镜{序号}：{景别}{运镜}，{内容描述}；镜{序号}：{景别}{运镜}，{内容描述}',
    example: '镜1：特写慢推，展示咖啡拉花细节；镜2：环绕运镜，展示咖啡整体造型'
  },
  {
    id: 'constraint-enhance',
    name: '强制约束强化法',
    description: '必加正向约束，杜绝崩坏',
    category: 'advanced',
    template: '{约束1}，{约束2}，{约束3}',
    example: '面部清晰无畸变，五官比例自然，同一角色服装全程一致'
  },
  {
    id: 'rhythm-control',
    name: '节奏控制法',
    description: '根据内容添加节奏提示',
    category: 'advanced',
    template: '{节奏描述1}，{节奏描述2}，突出{核心内容}',
    example: '慢动作定格3秒，再匀速恢复正常速度，突出核心细节'
  },
  {
    id: 'material-linkage',
    name: '素材联动法',
    description: '搭配参考图/视频，提示词添加"@图片1提取造型""@视频1提取动作节奏"，减少AI幻觉',
    category: 'advanced',
    template: '@{素材类型}{序号}提取{内容}，{其他描述}',
    example: '@图片1提取造型，@视频1提取动作节奏，保持主体一致性'
  }
];

// ==================== 避坑技巧 ====================
export const PITFALL_METHODS: PromptTemplate[] = [
  {
    id: 'no-movement-overload',
    name: '运镜不堆砌',
    description: '单条提示词最多添加2种运镜，避免画面混乱崩坏',
    category: 'pitfall',
    template: '{运镜1}[，{运镜2}]，{其他描述}',
    example: '慢推镜+跟拍镜，保持画面稳定流畅'
  },
  {
    id: 'no-style-mix',
    name: '风格不混杂',
    description: '不同时添加"复古""赛博朋克""日系"等多种风格，避免画面割裂',
    category: 'pitfall',
    template: '{单一风格}，{风格描述}',
    example: '复古胶片风格，色彩温暖怀旧'
  },
  {
    id: 'no-violent-action',
    name: '动作不剧烈',
    description: '避免"快速跑跳""剧烈舞蹈"，优先选择"缓慢""匀速"动作，提升生成稳定性',
    category: 'pitfall',
    template: '{缓慢/匀速}{动作描述}，{状态描述}',
    example: '缓慢转身，动作轻柔，画面稳定无抖动'
  },
  {
    id: 'no-vague-description',
    name: '避免模糊表述',
    description: '删除"好看、高级、有感觉"等抽象词，全部替换为具体描述',
    category: 'pitfall',
    template: '{具体描述1}，{具体描述2}，{具体描述3}',
    example: '光影柔和，色彩协调，构图平衡'
  },
  {
    id: 'no-too-many-subjects',
    name: '主体不宜过多',
    description: '单条提示词主体不超过2个，避免画面混乱',
    category: 'pitfall',
    template: '{主体1}[，{主体2}]，{互动描述}',
    example: '女生和小狗，在草地上玩耍'
  },
  {
    id: 'no-extreme-perspective',
    name: '避免极端视角',
    description: '慎用"极度仰视""极度俯视"，优先选择自然视角',
    category: 'pitfall',
    template: '{自然视角}，{画面描述}',
    example: '平视角度，自然真实'
  },
  {
    id: 'no-fast-cuts',
    name: '避免过快剪辑',
    description: '生成视频慎用快切，优先选择连贯运镜',
    category: 'pitfall',
    template: '{连贯运镜}，{节奏描述}',
    example: '一镜到底，节奏平缓流畅'
  },
  {
    id: 'no-complex-background',
    name: '背景不宜复杂',
    description: '避免过于复杂的背景元素，保持主体突出',
    category: 'pitfall',
    template: '{简洁背景}，{突出主体}',
    example: '纯色背景，主体清晰突出'
  }
];

// ==================== 基础运镜（10个） ====================
export const BASIC_CAMERA_MOVEMENTS: CameraMovement[] = [
  {
    id: 'slow-push',
    name: '慢推镜',
    description: '缓慢推近、逐渐放大、向主体推进（突出细节、聚焦重点）',
    category: 'basic',
    example: '慢推镜，逐渐放大主体，突出面部细节'
  },
  {
    id: 'slow-pull',
    name: '慢拉镜',
    description: '缓慢拉远、镜头后退、拉出全景（展现场景、营造开阔感）',
    category: 'basic',
    example: '慢拉镜，从主体拉远，展现周围环境'
  },
  {
    id: 'pan-horizontal',
    name: '横摇镜',
    description: '向左摇镜头、向右平移、横向扫视（展示广阔场景）',
    category: 'basic',
    example: '横摇镜，从左到右，展示城市全景'
  },
  {
    id: 'pan-vertical',
    name: '竖摇镜',
    description: '镜头上移、慢慢向下摇（展现高度、揭晓画面）',
    category: 'basic',
    example: '竖摇镜，从下往上，展示高楼大厦'
  },
  {
    id: 'orbit',
    name: '环绕镜',
    description: '半圈环绕、360度环绕、轻轻环绕（立体展示主体）',
    category: 'basic',
    example: '360度环绕镜，立体展示主体全貌'
  },
  {
    id: 'follow',
    name: '跟拍镜',
    description: '平稳跟拍、紧紧跟随、侧面跟拍（沉浸式代入）',
    category: 'basic',
    example: '平稳跟拍镜，跟随主体移动'
  },
  {
    id: 'fixed',
    name: '固定镜',
    description: '固定镜头、中景机位不动（对话、纪实场景）',
    category: 'basic',
    example: '固定镜头，中景机位，记录对话场景'
  },
  {
    id: 'macro',
    name: '微距镜',
    description: '微距拍摄、近距离聚焦（展示产品/细节纹理）',
    category: 'basic',
    example: '微距镜，近距离展示产品细节纹理'
  },
  {
    id: 'freeze',
    name: '定格镜',
    description: '定格3秒、画面静止（突出核心瞬间）',
    category: 'basic',
    example: '定格镜，画面静止3秒，突出核心瞬间'
  },
  {
    id: 'slight-shake',
    name: '轻微抖镜',
    description: '手持微抖、轻微晃动（营造纪实感）',
    category: 'basic',
    example: '轻微抖镜，手持拍摄感，营造纪实氛围'
  }
];

// ==================== 组合运镜（20个） ====================
export const COMBINATION_CAMERA_MOVEMENTS: CameraMovement[] = [
  {
    id: 'push-pull',
    name: '推拉结合',
    description: '先推近特写，再拉远全景（悬念揭示、产品展示）',
    category: 'combination',
    example: '先慢推至特写，再慢拉至全景，展示产品全貌'
  },
  {
    id: 'follow-orbit',
    name: '跟拍+环绕',
    description: '跟拍主体移动，同时镜头环绕（自然切换视角）',
    category: 'combination',
    example: '跟拍主体移动，同时镜头环绕，自然切换视角'
  },
  {
    id: 'lift-pan',
    name: '升降+横摇',
    description: '镜头上升，同时横向摇动（模拟航拍、展现宏大场景）',
    category: 'combination',
    example: '镜头上升，同时横向摇动，模拟航拍视角'
  },
  {
    id: 'orbit-push',
    name: '环绕+慢推',
    description: '环绕主体的同时，缓慢推近（突出主体、增强张力）',
    category: 'combination',
    example: '环绕主体的同时，缓慢推近，突出主体细节'
  },
  {
    id: 'push-freeze',
    name: '慢推+定格',
    description: '缓慢推近至特写，定格3秒（突出细节、强化记忆点）',
    category: 'combination',
    example: '缓慢推近至特写，定格3秒，强化记忆点'
  },
  {
    id: 'pan-follow',
    name: '横摇+跟拍',
    description: '横向摇动镜头，同时跟拍主体（展示场景+跟随动作）',
    category: 'combination',
    example: '横向摇动镜头，同时跟拍主体移动'
  },
  {
    id: 'pan-pull',
    name: '竖摇+慢拉',
    description: '镜头竖摇，同时缓慢拉远（展现空间层次）',
    category: 'combination',
    example: '镜头竖摇，同时缓慢拉远，展现空间层次'
  },
  {
    id: 'macro-push',
    name: '微距+慢推',
    description: '微距拍摄，同时缓慢推近（展示细节纹理）',
    category: 'combination',
    example: '微距拍摄，同时缓慢推近，展示细节纹理'
  },
  {
    id: 'fixed-cut',
    name: '固定+快切',
    description: '固定镜头与快切交替（卡点视频、节奏向内容）',
    category: 'combination',
    example: '固定镜头与快切交替，节奏感强'
  },
  {
    id: 'follow-pull',
    name: '跟拍+慢拉',
    description: '跟拍主体，同时缓慢拉远（展现主体与环境关系）',
    category: 'combination',
    example: '跟拍主体，同时缓慢拉远，展现主体与环境关系'
  },
  {
    id: 'orbit-pull',
    name: '环绕+慢拉',
    description: '环绕主体，同时缓慢拉远（立体展示+展现场景）',
    category: 'combination',
    example: '环绕主体，同时缓慢拉远，立体展示+展现场景'
  },
  {
    id: 'push-pan',
    name: '慢推+横摇',
    description: '缓慢推近，同时横向摇动（聚焦细节+展示环境）',
    category: 'combination',
    example: '缓慢推近，同时横向摇动，聚焦细节+展示环境'
  },
  {
    id: 'shake-follow',
    name: '轻微抖镜+跟拍',
    description: '手持微抖，同时跟拍主体（增强纪实感、代入感）',
    category: 'combination',
    example: '轻微抖镜，同时跟拍主体，增强纪实感'
  },
  {
    id: 'freeze-pull',
    name: '定格+慢拉',
    description: '定格后，缓慢拉远（收尾场景、营造疏离感）',
    category: 'combination',
    example: '定格后，缓慢拉远，营造疏离感'
  },
  {
    id: 'macro-orbit',
    name: '微距+环绕',
    description: '微距拍摄，同时环绕主体（全方位展示细节）',
    category: 'combination',
    example: '微距拍摄，同时环绕主体，全方位展示细节'
  },
  {
    id: 'follow-cut',
    name: '跟拍+快切',
    description: '跟拍主体，同时快速切换镜头（动作场面、节奏向）',
    category: 'combination',
    example: '跟拍主体，同时快速切换镜头，动作场面专用'
  },
  {
    id: 'pull-pan',
    name: '慢拉+横摇',
    description: '缓慢拉远，同时横向摇动（展现场景全貌）',
    category: 'combination',
    example: '缓慢拉远，同时横向摇动，展现场景全貌'
  },
  {
    id: 'orbit-freeze',
    name: '环绕+定格',
    description: '环绕主体后，定格特写（突出主体、收尾点睛）',
    category: 'combination',
    example: '环绕主体后，定格特写，突出主体'
  },
  {
    id: 'push-vertical',
    name: '慢推+竖摇',
    description: '缓慢推近，同时竖向摇动（展示主体细节+高度）',
    category: 'combination',
    example: '缓慢推近，同时竖向摇动，展示主体细节+高度'
  },
  {
    id: 'fixed-push',
    name: '固定+慢推',
    description: '固定机位，缓慢推近（对话场景、情绪递进）',
    category: 'combination',
    example: '固定机位，缓慢推近，情绪递进'
  }
];

// ==================== 专业运镜（10个） ====================
export const PROFESSIONAL_CAMERA_MOVEMENTS: CameraMovement[] = [
  {
    id: 'hitchcock-zoom',
    name: '希区柯克变焦',
    description: '希区柯克式变焦、主体大小不变，背景极速压缩/拉伸（营造时空扭曲感、悬疑感）',
    category: 'professional',
    example: '希区柯克变焦，主体大小不变，背景极速压缩，营造悬疑感'
  },
  {
    id: 'one-shot',
    name: '一镜到底',
    description: '一镜到底、全程不切镜（沉浸式漫游、连贯叙事）',
    category: 'professional',
    example: '一镜到底，全程不切镜，沉浸式漫游'
  },
  {
    id: 'dutch-angle',
    name: '荷兰角',
    description: '荷兰角构图、画面倾斜（营造不安、悬疑氛围）',
    category: 'professional',
    example: '荷兰角构图，画面倾斜，营造不安氛围'
  },
  {
    id: 'slow-motion',
    name: '升格慢动作',
    description: '升格慢动作、慢镜头（关键瞬间、增加仪式感）',
    category: 'professional',
    example: '升格慢动作，慢镜头，关键瞬间专用'
  },
  {
    id: 'match-cut',
    name: '匹配剪辑转场',
    description: '匹配转场、动作匹配切镜（无缝转场、时空跳跃）',
    category: 'professional',
    example: '匹配剪辑转场，动作匹配切镜，无缝转场'
  },
  {
    id: 'spiral-orbit',
    name: '螺旋环绕',
    description: '高速螺旋环绕拍摄（能量爆发、华丽眩晕感）',
    category: 'professional',
    example: '螺旋环绕，高速螺旋环绕拍摄，能量爆发'
  },
  {
    id: 'dive',
    name: '俯冲运镜',
    description: '俯冲拍摄、镜头向下快速移动（紧张感、冲击力）',
    category: 'professional',
    example: '俯冲运镜，镜头向下快速移动，增强紧张感'
  },
  {
    id: 'ascend',
    name: '拉升运镜',
    description: '快速拉升镜头、远离主体（开阔感、揭晓全景）',
    category: 'professional',
    example: '拉升运镜，快速拉升镜头，揭晓全景'
  },
  {
    id: 'pan-cut',
    name: '摇镜快切',
    description: '快速摇镜+镜头快切（节奏向、动感画面）',
    category: 'professional',
    example: '摇镜快切，快速摇镜+镜头快切，节奏向'
  },
  {
    id: 'bokeh-movement',
    name: '焦外虚化运镜',
    description: '焦外虚化、镜头缓慢移动（突出主体、营造氛围感）',
    category: 'professional',
    example: '焦外虚化运镜，突出主体，营造氛围感'
  }
];

// ==================== 场景专属运镜 ====================
export const SCENE_CAMERA_MOVEMENTS: CameraMovement[] = [
  // 人像场景（15个）
  {
    id: 'portrait-close-push',
    name: '特写慢推',
    description: '面部细节、发丝、唇妆',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '特写慢推，展示面部细节、发丝、唇妆'
  },
  {
    id: 'portrait-near-orbit',
    name: '近景环绕',
    description: '上半身展示、表情捕捉',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '近景环绕，上半身展示、表情捕捉'
  },
  {
    id: 'portrait-medium-follow',
    name: '中景跟拍',
    description: '走路、转身、轻微动作',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '中景跟拍，走路、转身、轻微动作'
  },
  {
    id: 'portrait-pull-close',
    name: '慢拉+特写',
    description: '从面部拉远至全身',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '慢拉+特写，从面部拉远至全身'
  },
  {
    id: 'portrait-orbit-push',
    name: '环绕+慢推',
    description: '环绕人像，同时推近面部',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '环绕+慢推，环绕人像，同时推近面部'
  },
  {
    id: 'portrait-fixed',
    name: '固定镜头',
    description: '面部表情、对话场景',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '固定镜头，面部表情、对话场景'
  },
  {
    id: 'portrait-shake-follow',
    name: '轻微抖镜+跟拍',
    description: '日常vlog、纪实感',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '轻微抖镜+跟拍，日常vlog、纪实感'
  },
  {
    id: 'portrait-freeze-close',
    name: '定格+特写',
    description: '笑容、眼神等核心瞬间',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '定格+特写，笑容、眼神等核心瞬间'
  },
  {
    id: 'portrait-pan-near',
    name: '横摇+近景',
    description: '侧面跟拍，展现肢体动作',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '横摇+近景，侧面跟拍，展现肢体动作'
  },
  {
    id: 'portrait-pan-medium',
    name: '竖摇+中景',
    description: '从头部摇至脚部，展示穿搭',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '竖摇+中景，从头部摇至脚部，展示穿搭'
  },
  {
    id: 'portrait-macro-push',
    name: '微距+慢推',
    description: '指尖、耳环等细节',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '微距+慢推，指尖、耳环等细节'
  },
  {
    id: 'portrait-follow-orbit',
    name: '跟拍+环绕',
    description: '走路时，镜头绕至正面',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '跟拍+环绕，走路时，镜头绕至正面'
  },
  {
    id: 'portrait-push-freeze',
    name: '慢推+定格',
    description: '推至面部特写，定格3秒',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '慢推+定格，推至面部特写，定格3秒'
  },
  {
    id: 'portrait-one-shot',
    name: '一镜到底',
    description: '跟拍人像行走，全程不切镜',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '一镜到底，跟拍人像行走，全程不切镜'
  },
  {
    id: 'portrait-hitchcock',
    name: '希区柯克变焦',
    description: '面部特写，营造情绪张力',
    category: 'scene',
    sceneCategory: 'portrait',
    example: '希区柯克变焦，面部特写，营造情绪张力'
  },

  // 产品场景（15个）
  {
    id: 'product-close-push',
    name: '特写慢推',
    description: '产品细节、纹理、logo',
    category: 'scene',
    sceneCategory: 'product',
    example: '特写慢推，产品细节、纹理、logo'
  },
  {
    id: 'product-orbit',
    name: '环绕运镜',
    description: '360度展示产品全貌',
    category: 'scene',
    sceneCategory: 'product',
    example: '环绕运镜，360度展示产品全貌'
  },
  {
    id: 'product-macro',
    name: '微距拍摄',
    description: '产品材质、细节纹理',
    category: 'scene',
    sceneCategory: 'product',
    example: '微距拍摄，产品材质、细节纹理'
  },
  {
    id: 'product-pull-close',
    name: '慢拉+特写',
    description: '从细节拉远至产品整体',
    category: 'scene',
    sceneCategory: 'product',
    example: '慢拉+特写，从细节拉远至产品整体'
  },
  {
    id: 'product-fixed',
    name: '固定镜头',
    description: '产品静置展示',
    category: 'scene',
    sceneCategory: 'product',
    example: '固定镜头，产品静置展示'
  },
  {
    id: 'product-orbit-push',
    name: '环绕+慢推',
    description: '环绕产品，同时推近细节',
    category: 'scene',
    sceneCategory: 'product',
    example: '环绕+慢推，环绕产品，同时推近细节'
  },
  {
    id: 'product-push-pan',
    name: '慢推+横摇',
    description: '推近产品，同时横向展示',
    category: 'scene',
    sceneCategory: 'product',
    example: '慢推+横摇，推近产品，同时横向展示'
  },
  {
    id: 'product-freeze-close',
    name: '定格+特写',
    description: '产品核心卖点',
    category: 'scene',
    sceneCategory: 'product',
    example: '定格+特写，产品核心卖点'
  },
  {
    id: 'product-follow-pull',
    name: '跟拍+慢拉',
    description: '展示产品使用过程，同时拉远',
    category: 'scene',
    sceneCategory: 'product',
    example: '跟拍+慢拉，展示产品使用过程，同时拉远'
  },
  {
    id: 'product-macro-orbit',
    name: '微距+环绕',
    description: '全方位展示产品细节',
    category: 'scene',
    sceneCategory: 'product',
    example: '微距+环绕，全方位展示产品细节'
  },
  {
    id: 'product-pull-vertical',
    name: '慢拉+竖摇',
    description: '从产品顶部拉远，同时竖向展示',
    category: 'scene',
    sceneCategory: 'product',
    example: '慢拉+竖摇，从产品顶部拉远，同时竖向展示'
  },
  {
    id: 'product-fixed-push',
    name: '固定+慢推',
    description: '固定机位，推近产品细节',
    category: 'scene',
    sceneCategory: 'product',
    example: '固定+慢推，固定机位，推近产品细节'
  },
  {
    id: 'product-orbit-freeze',
    name: '环绕+定格',
    description: '环绕产品后，定格核心细节',
    category: 'scene',
    sceneCategory: 'product',
    example: '环绕+定格，环绕产品后，定格核心细节'
  },
  {
    id: 'product-bokeh',
    name: '焦外虚化运镜',
    description: '突出产品，虚化背景',
    category: 'scene',
    sceneCategory: 'product',
    example: '焦外虚化运镜，突出产品，虚化背景'
  },
  {
    id: 'product-push-macro',
    name: '慢推+微距',
    description: '推近至产品细节，开启微距',
    category: 'scene',
    sceneCategory: 'product',
    example: '慢推+微距，推近至产品细节，开启微距'
  },

  // 风景场景（15个）
  {
    id: 'landscape-wide-push',
    name: '全景慢推',
    description: '从远景推近，展现风景层次',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '全景慢推，从远景推近，展现风景层次'
  },
  {
    id: 'landscape-pan',
    name: '横摇镜',
    description: '展示广阔风景、山脉、海面',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '横摇镜，展示广阔风景、山脉、海面'
  },
  {
    id: 'landscape-pan-vertical',
    name: '竖摇镜',
    description: '展示高楼、瀑布、山脉高度',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '竖摇镜，展示高楼、瀑布、山脉高度'
  },
  {
    id: 'landscape-pull',
    name: '慢拉镜',
    description: '从局部拉远，展现场景全貌',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '慢拉镜，从局部拉远，展现场景全貌'
  },
  {
    id: 'landscape-fixed',
    name: '固定镜头',
    description: '静置风景、日出日落',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '固定镜头，静置风景、日出日落'
  },
  {
    id: 'landscape-lift-pan',
    name: '升降+横摇',
    description: '模拟航拍，展现宏大风景',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '升降+横摇，模拟航拍，展现宏大风景'
  },
  {
    id: 'landscape-follow-pan',
    name: '跟拍+横摇',
    description: '跟随风景移动，横向展示',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '跟拍+横摇，跟随风景移动，横向展示'
  },
  {
    id: 'landscape-push-vertical',
    name: '慢推+竖摇',
    description: '推近风景，同时竖向展示',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '慢推+竖摇，推近风景，同时竖向展示'
  },
  {
    id: 'landscape-slight-shake',
    name: '轻微抖镜',
    description: '营造自然、纪实感',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '轻微抖镜，营造自然、纪实感'
  },
  {
    id: 'landscape-freeze-pull',
    name: '定格+慢拉',
    description: '定格风景瞬间，再拉远展全貌',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '定格+慢拉，定格风景瞬间，再拉远展全貌'
  },
  {
    id: 'landscape-orbit-pull',
    name: '环绕+慢拉',
    description: '环绕风景，同时缓慢拉远',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '环绕+慢拉，环绕风景，同时缓慢拉远'
  },
  {
    id: 'landscape-one-shot',
    name: '一镜到底',
    description: '跟随风景漫游，全程不切镜',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '一镜到底，跟随风景漫游，全程不切镜'
  },
  {
    id: 'landscape-dive',
    name: '俯冲运镜',
    description: '从高空俯冲，展示风景细节',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '俯冲运镜，从高空俯冲，展示风景细节'
  },
  {
    id: 'landscape-ascend',
    name: '拉升运镜',
    description: '从地面拉升，展现场景开阔感',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '拉升运镜，从地面拉升，展现场景开阔感'
  },
  {
    id: 'landscape-pan-push',
    name: '横摇+慢推',
    description: '横向摇动，同时推近风景细节',
    category: 'scene',
    sceneCategory: 'landscape',
    example: '横摇+慢推，横向摇动，同时推近风景细节'
  },

  // 剧情/动作场景（15个）
  {
    id: 'drama-follow',
    name: '跟拍镜',
    description: '跟随角色动作，沉浸式代入',
    category: 'scene',
    sceneCategory: 'drama',
    example: '跟拍镜，跟随角色动作，沉浸式代入'
  },
  {
    id: 'drama-cut-fixed',
    name: '快切+固定',
    description: '动作卡点、节奏向',
    category: 'scene',
    sceneCategory: 'drama',
    example: '快切+固定，动作卡点、节奏向'
  },
  {
    id: 'drama-hitchcock',
    name: '希区柯克变焦',
    description: '悬疑、震惊瞬间',
    category: 'scene',
    sceneCategory: 'drama',
    example: '希区柯克变焦，悬疑、震惊瞬间'
  },
  {
    id: 'drama-slow-motion',
    name: '升格慢动作',
    description: '动作高潮、关键瞬间',
    category: 'scene',
    sceneCategory: 'drama',
    example: '升格慢动作，动作高潮、关键瞬间'
  },
  {
    id: 'drama-one-shot',
    name: '一镜到底',
    description: '连贯叙事、沉浸式体验',
    category: 'scene',
    sceneCategory: 'drama',
    example: '一镜到底，连贯叙事、沉浸式体验'
  },
  {
    id: 'drama-dutch',
    name: '荷兰角',
    description: '悬疑、紧张场景',
    category: 'scene',
    sceneCategory: 'drama',
    example: '荷兰角，悬疑、紧张场景'
  },
  {
    id: 'drama-spiral',
    name: '螺旋环绕',
    description: '能量爆发、动作高潮',
    category: 'scene',
    sceneCategory: 'drama',
    example: '螺旋环绕，能量爆发、动作高潮'
  },
  {
    id: 'drama-follow-orbit',
    name: '跟拍+环绕',
    description: '角色移动，镜头绕至正面',
    category: 'scene',
    sceneCategory: 'drama',
    example: '跟拍+环绕，角色移动，镜头绕至正面'
  },
  {
    id: 'drama-push-freeze',
    name: '慢推+定格',
    description: '动作收尾，定格核心瞬间',
    category: 'scene',
    sceneCategory: 'drama',
    example: '慢推+定格，动作收尾，定格核心瞬间'
  },
  {
    id: 'drama-pan-cut',
    name: '横摇+快切',
    description: '场景切换、紧张氛围',
    category: 'scene',
    sceneCategory: 'drama',
    example: '横摇+快切，场景切换、紧张氛围'
  },
  {
    id: 'drama-dive-follow',
    name: '俯冲+跟拍',
    description: '追逐场景、增强冲击力',
    category: 'scene',
    sceneCategory: 'drama',
    example: '俯冲+跟拍，追逐场景、增强冲击力'
  },
  {
    id: 'drama-ascend-pull',
    name: '拉升+慢拉',
    description: '动作结束，拉远展现场景',
    category: 'scene',
    sceneCategory: 'drama',
    example: '拉升+慢拉，动作结束，拉远展现场景'
  },
  {
    id: 'drama-fixed-push',
    name: '固定+慢推',
    description: '对话场景、情绪递进',
    category: 'scene',
    sceneCategory: 'drama',
    example: '固定+慢推，对话场景、情绪递进'
  },
  {
    id: 'drama-orbit-push',
    name: '环绕+慢推',
    description: '动作过程，突出角色',
    category: 'scene',
    sceneCategory: 'drama',
    example: '环绕+慢推，动作过程，突出角色'
  },
  {
    id: 'drama-match-cut',
    name: '匹配剪辑转场',
    description: '动作无缝切换，时空跳跃',
    category: 'scene',
    sceneCategory: 'drama',
    example: '匹配剪辑转场，动作无缝切换，时空跳跃'
  }
];

// ==================== 完整提示词生成函数 ====================
// 遵循正确的顺序：核心主体 > 连续动作指令 > 镜头与运镜 > 场景与光影 > 风格与画质 > 强制约束指令 > 负面提示词
export function generateCompletePrompt(
  subject: string,              // 核心主体（权重最高）
  actions: string,             // 连续动作指令
  cameraMovement: string,       // 镜头与运镜
  sceneAndLight: string,       // 场景与光影
  style: string,               // 风格与画质
  quality: string = '4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊',
  constraints: string = '',    // 强制约束指令
  negative: string = '无变脸、无肢体畸形、无穿模、无跳帧'
): string {
  const parts = [
    subject,           // 1. 核心主体
    actions,           // 2. 连续动作指令
    cameraMovement,    // 3. 镜头与运镜
    sceneAndLight,     // 4. 场景与光影
    style,             // 5. 风格与画质
    quality,           // 6. 画质（包含在风格中）
    constraints,       // 7. 强制约束指令
    negative           // 8. 负面提示词
  ].filter(Boolean);
  
  return parts.join('，');
}

// 生成单个分镜头提示词 - 专业版
export function generateProfessionalShotPrompt(
  subject: string,
  actions: string,
  cameraMovement: string,
  sceneAndLight: string,
  style: string = '',
  constraints: string = '',
  negative: string = '无变脸、无肢体畸形、无穿模、无跳帧'
): string {
  const parts = [
    subject,           // 核心主体
    actions,           // 连续动作
    cameraMovement,    // 运镜
    sceneAndLight,     // 场景光影
    style,             // 风格
    constraints,       // 约束
    negative           // 负面
  ].filter(Boolean);
  
  return parts.join('，');
}

// 生成多个分镜头 - 根据用户内容智能拆分
export function generateShotsFromContent(
  userContent: string,
  shotCount: number = 3,
  baseCameraMovement: string = '慢推镜',
  baseStyle: string = '',
  baseSceneLight: string = ''
): Array<{ shot: string; description: string }> {
  const shots: Array<{ shot: string; description: string }> = [];
  
  // 提取主体信息
  const subjectMatch = userContent.match(/[\u4e00-\u9fa5a-zA-Z0-9\s，。、！？；：""''（）【】《》…—·]+?(?=[，,]|建立|开始|进行|发生|$)/);
  const subject = subjectMatch ? subjectMatch[0].trim() : userContent.substring(0, 30);
  
  // 智能拆分内容为多个镜头
  const sentences = userContent.split(/[，。！？；\n]/).filter(s => s.trim());
  
  if (sentences.length <= shotCount) {
    // 内容较少，每个句子一个镜头
    sentences.forEach((sentence, idx) => {
      if (sentence.trim()) {
        const shot = generateProfessionalShotPrompt(
          subject,
          sentence.trim(),
          baseCameraMovement,
          baseSceneLight,
          baseStyle
        );
        shots.push({
          shot: shot,
          description: `镜头${idx + 1}：${sentence.trim().substring(0, 50)}`
        });
      }
    });
  } else {
    // 内容较多，平均分配
    const chunkSize = Math.ceil(sentences.length / shotCount);
    for (let i = 0; i < shotCount; i++) {
      const chunk = sentences.slice(i * chunkSize, (i + 1) * chunkSize);
      if (chunk.length > 0) {
        const content = chunk.join('，');
        const shot = generateProfessionalShotPrompt(
          subject,
          content,
          baseCameraMovement,
          baseSceneLight,
          baseStyle
        );
        shots.push({
          shot: shot,
          description: `镜头${i + 1}：${content.substring(0, 50)}`
        });
      }
    }
  }
  
  return shots;
}

// ==================== 按场景分类的快捷提示词 ====================
export const SCENE_QUICK_PROMPTS = {
  portrait: {
    basic: '20岁东亚女生，黑色长发，白色连衣裙，站在阳光下微笑，中景跟拍，柔和自然光，清新风格，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无变脸、无肢体畸形、无穿模、无跳帧',
    advanced: '【25岁成熟女性{1.2}，职业装】，缓慢整理文件，中景构图，平稳跟拍，办公室自然光，专业商务风格，面部清晰无畸变，五官比例自然{1.1}，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无变脸、无肢体畸形、无穿模、无跳帧'
  },
  product: {
    basic: '精致咖啡杯，白色陶瓷材质，金色拉花，放在木质桌面上，特写慢推，温暖侧光，质感风格，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无穿模、无变形、无模糊',
    advanced: '【高端腕表{1.2}，金属表带，精致表盘】，微距环绕展示，360度环绕运镜，专业影棚光，奢华质感风格，产品清晰无畸变，细节完整{1.1}，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无穿模、无变形、无模糊',
    // ★ P1扩展：产品子类别模板
    electronics: '最新款折叠屏手机，航空铝金属中框，哑光玻璃背板，展开状态下屏幕显示绚丽画面，微距特写+环绕展示组合运镜，轮廓光勾勒金属边缘+正面柔光箱补光，科技冷调风格，产品比例精确、Logo清晰可辨、材质纹理准确，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无变形、无模糊、无材质错误、无比例失调',
    cosmetics: '限量版口红套装，丝绒外壳触感细腻，玫瑰金管身在灯光下折射柔和光泽，缓慢旋转展示+定点推近至膏体切面特写，蝴蝶光均匀照亮产品消除阴影，奢华暖调风格，色彩准确饱和、包装文字清晰、质地真实可信，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无变形、无模糊、无色泽失真',
    food_drink: '手工拉花拿铁咖啡，厚实奶泡层上撒可可粉形成精美图案，白色陶瓷杯置于深色木桌，热气缓缓升腾的动态捕捉，45°侧拍+慢动作推近至液面细节，暖调窗光营造食欲氛围，生活方式美食风格，热气自然、色泽诱人、质感新鲜，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无变形、无模糊、色泽失真',
    fashion: '意大利手工真皮手提包，复古棕色做旧质感，黄铜搭扣在光线下呈现岁月痕迹，平放展示+缓慢抬升至手持姿态过渡，自然窗光从侧面照射突出皮革纹理，时尚杂志风格，皮质纹理清晰、缝线工艺可见、五金件光泽自然，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无变形、无模糊、材质错误',
    luxury: '瑞士机械腕表，蓝宝石镜面反射着环境光芒，镂空表盘下精密齿轮若隐若现，放置于黑色天鹅绒展示台面，极慢速微距推近+定点定格细节，点光源聚光戏剧性照明凸显高端感，顶级奢侈品广告风格，每一颗钻石镶嵌精确、表盘刻度清晰锐利、机芯运转流畅可见，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无变形、无模糊、无Logo扭曲、无比例失调',
  },
  landscape: {
    basic: '壮丽山川，云海翻涌，日出东方，全景慢推，金色晨曦穿透云层照亮山峰轮廓，自然风景纪录片风格，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无跳帧、无变形、透视正确',
    advanced: '【雪山之巅{1.2}，云海翻腾】，升降航拍+广角横摇模拟上帝视角，日出逆光勾勒山脊金色轮廓线，史诗级IMAX风光风格，画面稳定无抖动{1.1}，大气散射效果自然、色彩层次分明、空间尺度震撼，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无跳帧、无变形、无漂浮异物'
  },
  drama: {
    basic: '悬疑场景，昏暗房间，神秘人物剪影站在窗前，固定镜头营造压抑氛围，低明暗单光源照明，悬疑惊悚风格，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无变脸、无肢体畸形、无穿模、无跳帧',
    advanced: '【侦探角色{1.2}，风衣造型】，缓慢搜查房间发现关键线索，希区柯克变焦(Dolly Zoom)营造紧张压迫感，昏暗台灯侧光切割面部形成明暗对比，黑色电影 Noir 风格，面部清晰无畸变{1.1}，情绪连贯一致、视线方向正确、肢体动作自然，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无变脸、无肢体畸形、无穿模、无跳帧'
  },
  // ★ 新增：补全剩余3种场景类型的快捷预设
  food: {
    basic: '新鲜出炉的法式牛角包，金黄酥脆的外层表面泛着黄油光泽，置于复古铁丝架上，45°侧拍角度缓慢推进，暖色调自然窗光从侧面照射突出酥皮层次质感，美食摄影风格，色泽金黄诱人、热气若有似无地升腾、表面纹理清晰可见，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无变形、无色泽失真、无材质错误',
    advanced: '【精致日式刺身拼盘{1.2}，深海蓝鳍金枪鱼+甜虾+三文鱼】，冰雾缓缓升腾的动态捕捉，极慢速微距推近至鱼肉横截面纹理细节，冷调顶光+侧逆光组合突出食材新鲜度和透明感，高级料理杂志风格，鱼脂纹理晶莹剔透{1.1}、摆盘构图精致平衡、冰雾动态自然不突兀，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无变形、无色泽失真、无比例失调'
  },
  abstract: {
    basic: '流动的彩色墨水在清澈水中扩散交融，形成梦幻般的烟雾状纹理，俯视固定镜头，纯黑背景+顶部单色光源，抽象艺术风格，色彩过渡平滑自然、形态变换流畅有机、无突兀色块跳跃，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无跳帧、无变形',
    advanced: '【自发光几何晶体{1.2}，多面体结构】，缓慢自转的同时内部光线脉动变化色彩，轨道环绕拍摄+微距推近至晶体切面折射光效，环境光全暗仅靠物体自发光照亮周围，赛博朋克抽象风格，光影折射效果精确{1.1}、色彩渐变节奏与运镜同步、边缘锐利无模糊，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无跳帧、无变形、无色彩断层'
  },
  interior: {
    basic: '现代简约客厅空间，米白色布艺沙发搭配原木茶几，大面积落地窗引入自然光线，第一人称视角缓慢步入空间，清晨自然漫射光充满整个房间，室内设计展示风格，空间比例正确、家具摆放合理、光线过渡自然，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无跳帧、无变形、无透视错误',
    advanced: '【北欧风格卧室{1.2}，暖灰墙面+原木地板】，从门口缓慢平移进入同时视角微微上移展现层高和吊灯细节，黄昏时分暖调落地灯与窗外残留天光形成双色温对比，高端室内建筑摄影风格，空间纵深感强烈{1.1}、材质纹理(织物/木材/金属)清晰可辨、光影层次丰富有深度，4K超高清、60fps高帧率、HDR、细节丰富、无噪点、无模糊，无跳帧、无变形、无透视畸变'
  }
};
