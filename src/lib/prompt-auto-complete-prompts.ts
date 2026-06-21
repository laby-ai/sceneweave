// ============================================================
// 场景类型定义
// ============================================================
export type SceneType = 'portrait' | 'product' | 'landscape' | 'food' | 'drama' | 'abstract' | 'interior';

// ============================================================
// 时长等级工具
// ============================================================
function getDurationInfo(duration: number) {
  const level = duration <= 5 ? 'short' : duration <= 15 ? 'medium' : 'long';
  const label = level === 'short' ? '短视频' : level === 'medium' ? '中等时长视频' : '较长视频';
  
  const actionDetail = {
    short: '简洁的动作描述，1-2个连贯动作',
    medium: '中等长度的动作描述，2-3个连贯动作，描述动作过渡',
    long: '详细的动作描述，3-5个连贯动作，包含起承转合',
  };

  const shotCount = {
    short: '1-2个镜头切换',
    medium: '2-3个镜头切换',
    long: '3-5个镜头切换，营造丰富的视觉效果',
  };

  return { level, label, actionDetail: actionDetail[level], shotCount: shotCount[level] };
}

// ============================================================
// 核心：按场景类型生成差异化 System Prompt
// ============================================================

export interface PromptConfig {
  systemPrompt: string;
  requiredFields: string[];
}

/**
 * 产品场景 System Prompt — 专业产品视频提示词
 * 
 * 核心差异点：
 * - 主体：产品名称/材质/颜色/尺寸/工艺（非人像的年龄/性别/发型）
 * - 动作：旋转展示/微距推近/功能演示（非走路/转身/微笑）
 * - 运镜：环绕/微距/定格细节（非跟拍/过肩）
 * - 光线：专业产品布光（轮廓光/蝴蝶光/柔光箱）
 * - 约束：无变形/材质准确/比例正确（非无变脸/肢体畸形）
 */
function getProductPrompt(duration: number, durInfo: ReturnType<typeof getDurationInfo>, enhanceSubject: boolean, displayModes?: string[]): PromptConfig {
  // 解析展示模式
  const modes: string[] = Array.isArray(displayModes) && displayModes.length > 0 ? displayModes : ['hero'];
  const modeLabels: Record<string, string> = { hero: '纯净展示', lifestyle: '情境融入', detail: '细节放大' };
  const modeDesc = modes.map(m => modeLabels[m] || m).join('+');
  
  // 根据模式组合生成差异化动作和运镜建议
  const getModeSpecificGuidance = (): string => {
    const parts: string[] = [];
    if (modes.includes('hero')) parts.push('纯净展示段：产品在干净背景中360°旋转/多角度展示，轮廓光勾勒边缘');
    if (modes.includes('lifestyle')) parts.push('情境融入段：产品出现在使用场景中，与人物/环境自然互动');
    if (modes.includes('detail')) parts.push('细节放大段：极近距离微距拍摄材质纹理/工艺细节/功能细节');
    return parts.join('；') || '标准产品展示';
  };

  const getModeSpecificCamera = (): string => {
    const cams: string[] = [];
    if (modes.includes('hero')) cams.push('环绕拍摄(Orbit)、全景建立(Wide Establishing)');
    if (modes.includes('lifestyle')) cams.push('中景跟拍(Follow Shot)、过肩镜头(Over-shoulder)');
    if (modes.includes('detail')) cams.push('微距推近(Macro Push-in)、定格细节(Freeze Detail)');
    return cams.join('/') || '环绕拍摄、微距推近';
  };

  const getModeSpecificLighting = (): string => {
    const lights: string[] = [];
    if (modes.includes('hero')) lights.push('轮廓光(Rim Light)+柔光箱(Softbox)');
    if (modes.includes('lifestyle')) lights.push('自然窗光(Window Light)');
    if (modes.includes('detail')) lights.push('点光源聚光(Spotlight)');
    return lights.length > 1 ? `${lights.join('过渡到')}多层次布光` : (lights[0] || '专业影棚布光');
  };
  if (enhanceSubject) {
    return {
      systemPrompt: `你是一个专业的【产品展示视频】提示词创作助手。用户要为一个产品制作AI视频，当前选择的展示模式组合为：${modeDesc}。

1. 对产品进行专业描述扩展：
   - 包含：产品名称、材质/工艺、颜色/表面处理、尺寸比例、关键特征/功能亮点
   - 示例格式："Apple Watch Ultra，钛金属表壳，深空黑色哑光表面，45mm表盘，平放在大理石台面上"
   - 注意：不要添加年龄/性别/发型等人像属性

2. 根据时长（${duration}秒，${durInfo.label}）和展示模式（${modeDesc}）生成产品展示动作：
   - ${durInfo.actionDetail}
   - ★ 多模式动作编排（必须按以下模式顺序组织）：
     ${getModeSpecificGuidance()}
   - 避免使用"行走/跑步/说话/微笑"等人物动作

3. 生成产品专用运镜方案（匹配展示模式）：
   - ${durInfo.shotCount}
   - ★ 模式匹配运镜：${getModeSpecificCamera()}

4. 生成专业产品布光描述（匹配展示模式）：
   - ★ 模式匹配布光：${getModeSpecificLighting()}
   - 描述光线方向、强度、色温及对产品质感的影响

5. 生成风格与约束：
   - 风格：电商风格/科技感/奢华感/生活方式感/极简主义
   - 约束重点：无变形、无模糊、材质纹理准确、比例协调、Logo/文字清晰可辨

请严格遵循以下JSON格式返回，不要有任何额外内容：

{
  "enhancedSubject": "优化后的产品详细描述，包含材质/颜色/尺寸/工艺等",
  "actionsInput": "按${modeDesc}模式编排的产品展示动作，${durInfo.actionDetail}",
  "cameraMovementInput": "匹配${modeDesc}模式的运镜方案，${getModeSpecificCamera()}，${durInfo.shotCount}",
  "sceneLightInput": "匹配${modeDesc}模式的布光方案，${getModeSpecificLighting()}",
  "styleInput": "产品视频风格，融合${modeDesc}特点",
  "constraintsInput": "产品质量约束，确保产品呈现的专业性"
}

注意事项：
1. 只返回JSON，不要有markdown代码块
2. enhancedSubject必须聚焦产品本身，不涉及人物
3. 动作必须是产品可以执行的动作（旋转/展示/变化），不是人物动作
4. 布光要体现专业性，提及具体的光线类型和效果
5. 约束中强调产品相关的质量要求
6. ★ 关键：当多个展示模式时，提示词必须体现不同阶段的风格转换和衔接`,
      requiredFields: ['enhancedSubject', 'actionsInput', 'cameraMovementInput', 'sceneLightInput', 'styleInput', 'constraintsInput'],
    };
  }

  // 不增强主体时
  return {
    systemPrompt: `你是一个专业的【产品展示视频】提示词创作助手。用户要为产品制作AI视频，展示模式组合：${modeDesc}。根据产品和时长（${duration}秒，${durInfo.label}）生成完整的产品视频提示词。

★ 多模式编排要求：
- 动作需按${modeDesc}的顺序组织不同展示阶段
- 运镜匹配各模式特点：${getModeSpecificCamera()}
- 布光匹配各模式特点：${getModeSpecificLighting()}

请严格遵循以下JSON格式返回：

{
  "actionsInput": "按${modeDesc}模式编排的产品展示动作，${durInfo.actionDetail}",
  "cameraMovementInput": "匹配${modeDesc}模式的运镜，${getModeSpecificCamera()}，${durInfo.shotCount}",
  "sceneLightInput": "匹配${modeDesc}模式的布光方案，${getModeSpecificLighting()}",
  "styleInput": "融合${modeDesc}特点的产品视频风格",
  "constraintsInput": "产品质量约束（无变形/模糊/材质错误/比例失调）"
}

注意事项：
1. 只返回JSON
2. 所有字段用中文详细描述
3. 动作必须是产品可执行的（旋转/展示/变化）
4. 布光体现专业性
5. 多模式时体现阶段转换和衔接
6. 时长匹配：${durInfo.actionDetail}`,
    requiredFields: ['actionsInput', 'cameraMovementInput', 'sceneLightInput', 'styleInput', 'constraintsInput'],
  };
}

/**
 * 人像/肖像场景 System Prompt
 */
function getPortraitPrompt(duration: number, durInfo: ReturnType<typeof getDurationInfo>, enhanceSubject: boolean): PromptConfig {
  if (enhanceSubject) {
    return {
      systemPrompt: `你是一个专业的【人像/肖像视频】提示词创作助手。用户要为人物制作AI视频，你需要：

1. 对人物进行精准定义扩展：
   - 格式：{年龄}{种族}{颜值类型}{性别}，{发型描述}，{服装描述}，{位置/姿态}，{表情/状态}
   - 示例："20岁东亚淡颜女生，黑长直齐肩发，白色棉麻连衣裙，坐在窗边侧身回眸，温柔恬静的笑容"

2. 根据时长（${duration}秒，${durInfo.label}）生成人物动作：
   - ${durInfo.actionDetail}
   - 人物动作类型：行走/转身/微笑/说话/互动/舞蹈/运动等
   - 注重表情变化和肢体语言的细腻描述

3. 生成人像专用运镜：
   - ${durInfo.shotCount}
   - 推荐：正面中景/侧面特写/过肩镜头/跟拍/环绕人像/眼神特写

4. 生成人像布光：
   - 主光+补光+轮廓光的三点布光
   - 或自然光（窗光/逆光/黄金时刻）

5. 风格与约束：
   - 风格：电影感/时尚大片/日常记录/Vlog风
   - 约束：面部一致性、肢体自然、表情连贯

请严格返回JSON：
{
  "enhancedSubject": "优化后的人物精准定义",
  "actionsInput": "${durInfo.actionDetail}，人物的行走、转身、表情变化等",
  "cameraMovementInput": "人像运镜，${durInfo.shotCount}",
  "sceneLightInput": "人像布光方案",
  "styleInput": "人像视频风格",
  "constraintsInput": "人像质量约束（无变脸/肢体畸形/穿模/跳帧）"
}`,
      requiredFields: ['enhancedSubject', 'actionsInput', 'cameraMovementInput', 'sceneLightInput', 'styleInput', 'constraintsInput'],
    };
  }

  return {
    systemPrompt: `你是一个专业的【人像视频】提示词创作助手。根据人物描述和时长（${duration}秒，${durInfo.label}）生成提示词。

返回JSON：
{
  "actionsInput": "${durInfo.actionDetail}，如人物的行走、转身、表情变化等",
  "cameraMovementInput": "人像运镜，${durInfo.shotCount}",
  "sceneLightInput": "人像布光方案",
  "styleInput": "人像视频风格",
  "constraintsInput": "人像质量约束（无变脸/肢体畸形/穿模/跳帧）"
}`,
    requiredFields: ['actionsInput', 'cameraMovementInput', 'sceneLightInput', 'styleInput', 'constraintsInput'],
  };
}

/**
 * 风景/自然场景 System Prompt — 增强版
 * 
 * 核心增强：
 * - 地理特征分类（山川/水域/森林/沙漠/极地/城市天际线）
 * - 时间氛围具象化（黄金时刻/蓝调时刻/正午强光/夜晚星空）
 * - 天气动态效果（云层流动/雾气弥漫/雨雪粒子/光影穿透）
 * - 风景专用运镜（航拍拉升/延时摄影/推近细节/广角横摇/Dolly Zoom）
 * - 自然光层次描述（方向性/色温变化/大气散射/体积光）
 */
function getLandscapePrompt(duration: number, durInfo: ReturnType<typeof getDurationInfo>, enhanceSubject: boolean): PromptConfig {
  // 风景专用动作库 — 按景观类型细分
  const landscapeActions = {
    mountain: '山峰云海翻涌/山脊线条延展/山谷雾气升腾/岩石纹理特写',
    water: '水面波光粼粼/水岸线推进/瀑布水流冲击/倒影涟漪扩散',
    forest: '阳光穿过树冠形成丁达尔光柱/树叶随风摇曳/林间小径深入/季节色彩渐变',
    desert: '沙丘起伏的曲线/热浪扭曲的空气/日落染红地平线/星空下的寂静',
    urban: '城市天际线延时/车流光轨拉长/建筑轮廓剪影/霓虹灯反射在湿润路面',
    general: '镜头缓慢推进/视角逐渐升高/光影随时间变化/云层动态流动',
  };

  // 风景专用运镜库
  const landscapeCamera = [
    '航拍拉升(Aerial Pull-up)：从地面升至高空展现全貌',
    '延时摄影(Time-lapse)：加速云层/光影/星辰运动',
    '广角横摇(Panoramic Pan)：横向扫过壮阔景观',
    '推近细节(Push-in Detail)：从大全景推至局部纹理',
    'Dolly Zoom(滑动变焦)：保持主体大小同时改变透视，营造空间震撼感',
    '轨道环绕(Orbit Shot)：围绕地标建筑或自然奇观旋转拍摄',
  ];

  // 自然光体系
  const naturalLighting = {
    goldenHour: '黄金时刻(日出后/日落前1小时)：暖金色调，长阴影，侧逆光勾勒轮廓',
    blueHour: '蓝调时刻(日出前/日落后30分钟)：深蓝紫色调，天空渐变，静谧氛围',
    midday: '正午顶光：高对比度，短阴影，色彩饱和度高，适合表现活力',
    overcast: '阴天漫射光：柔和均匀，低对比，适合表现忧郁/宁静情绪',
    night: '夜景光：月光冷调/人造暖光对比，星空轨迹，城市灯光点缀',
  };

  if (enhanceSubject) {
    return {
      systemPrompt: `你是一个专业的【风景/自然风光视频】提示词创作助手。用户要为自然景观制作AI视频，时长${duration}秒（${durInfo.label}）。

★ 核心原则：风景视频的灵魂在于「时间流逝感」和「空间尺度感」，必须让静态的景色"活"起来。

1. 景观专业扩展（五维描述法）：
   【地理特征】具体地貌类型（山脉/湖泊/森林/海岸/峡谷/草原/沙漠/冰川）
   【时间氛围】精确时间点（黎明/清晨/上午/正午/黄昏/暮色/夜晚/深夜）
   【天气状况】动态天气元素（晴朗多云/薄雾弥漫/细雨蒙蒙/大雪纷飞/雷暴前夕）
   【植被细节】植物种类、季节状态、色彩分布（春绿/夏茂/秋金/冬寂）
   【光影条件】光线方向、色温、大气效应（丁达尔光/体积光/逆光透射/轮廓光）

2. 风景专属动作编排（按景观类型选择）：
   ${durInfo.actionDetail}
   ★ 动作必须是"自然现象的变化"而非人物动作：
   - 山岳类：${landscapeActions.mountain}
   - 水域类：${landscapeActions.water}
   - 森林类：${landscapeActions.forest}
   - 沙漠类：${landscapeActions.desert}
   - 城市天际线：${landscapeActions.urban}
   - 通用：${landscapeActions.general}

3. 风景专用运镜方案（${durInfo.shotCount}）：
   必须从以下运镜中选择并组合使用：
   ${landscapeCamera.map((c, i) => `   ${i+1}. ${c}`).join('\n')}

4. 自然光体系描述：
   根据时间选择对应的光线特征：
   ${Object.entries(naturalLighting).map(([k, v]) => `   - ${k}: ${v}`).join('\n')}
   ★ 关键：必须描述光线如何与地形交互（如"晨光照亮山峰顶部形成金色冠冕"）

5. 风格选项：
   - 纪录片风（National Geographic风格）：真实、壮观、教育性
   - 电影风光（IMAX风格）：史诗感、宏大配乐感、慢节奏沉浸
   - 旅行Vlog：个人视角、轻快节奏、目的地吸引力
   - 抽象意境：超现实色彩、长时间曝光效果、梦幻氛围

请严格遵循以下JSON格式返回：

{
  "enhancedSubject": "优化后的五维景观描述（地理+时间+天气+植被+光影）",
  "actionsInput": "风景动态动作，${durInfo.actionDetail}，选择匹配景观类型的动作",
  "cameraMovementInput": "风景专用运镜组合，${durInfo.shotCount}，至少包含一种航拍或延时",
  "sceneLightInput": "自然光体系描述，含时间-光线-地形交互效果",
  "styleInput": "风景视频风格（纪录片/电影风光/Vlog/抽象意境）",
  "constraintsInput": "风景质量约束：无跳帧/无变形/无模糊/无漂浮异物/色彩自然过渡/透视正确"
}

注意事项：
1. 只返回JSON
2. enhancedSubject必须包含5个维度中的至少3个
3. 动作必须是自然现象变化，禁止出现人物动作
4. 运镜必须体现空间尺度感（大远景→中景→特写的递进）
5. 光线描述必须包含"光线与地形的交互效果"
6. 约束重点：防止AI生成不自然的漂浮物体/错误透视/突兀的色彩跳跃`,
      requiredFields: ['enhancedSubject', 'actionsInput', 'cameraMovementInput', 'sceneLightInput', 'styleInput', 'constraintsInput'],
    };
  }

  return {
    systemPrompt: `你是一个专业的【风景视频】提示词创作助手。根据景观描述和时长（${duration}秒，${durInfo.label}）生成风景视频提示词。

★ 风景视频核心：让静态景色"活"起来——通过时间流逝感和空间尺度感营造沉浸体验。

返回JSON：
{
  "actionsInput": "自然现象动态动作（云层流动/光影变化/水面波光/植被摇曳），${durInfo.actionDetail}",
  "cameraMovementInput": "风景专用运镜（航拍拉升/延时摄影/广角横摇/推近细节），${durInfo.shotCount}，体现空间尺度",
  "sceneLightInput": "自然光体系（黄金时刻暖调/蓝调时刻冷调/正午高对比/夜晚星空），含光线-地形交互",
  "styleInput": "风景风格（纪录片/电影风光/旅行Vlog/抽象意境）",
  "constraintsInput": "风景质量约束（无跳帧/变形/模糊/漂浮异物/色彩自然过渡/透视正确）"
}

注意事项：
1. 只返回JSON
2. 动作必须是自然现象变化
3. 运镜需体现从大→小的空间递进
4. 光线必须包含与地形的交互效果`,
    requiredFields: ['actionsInput', 'cameraMovementInput', 'sceneLightInput', 'styleInput', 'constraintsInput'],
  };
}

/**
 * 美食场景 System Prompt
 */
function getFoodPrompt(duration: number, durInfo: ReturnType<typeof getDurationInfo>, enhanceSubject: boolean): PromptConfig {
  const foodActions = '食材展示/烹饪过程/热气升腾/酱汁流淌/切开瞬间/摆盘完成';
  
  if (enhanceSubject) {
    return {
      systemPrompt: `你是一个专业的【美食/食品视频】提示词创作助手。用户要为食物制作AI视频。

1. 食物扩展：食材种类、烹饪状态、温度暗示（热气/冰霜）、质地口感、摆盘装饰、餐具搭配
2. 动作：${foodActions}，${durInfo.actionDetail}
3. 运镜：俯拍/侧拍45°角/微距特写/慢动作，${durInfo.shotCount}
4. 光线：暖调食欲光/自然窗光/逆光透射（突出透明感和新鲜度）
5. 风格：美食纪录片/美食广告/烹饪教程/生活方式

返回JSON：
{
  "enhancedSubject": "优化后的食物详细描述（含视觉诱惑力）",
  "actionsInput": "${foodActions}，${durInfo.actionDetail}",
  "cameraMovementInput": "美食专用运镜，${durInfo.shotCount}",
  "sceneLightInput": "美食布光（暖色调/逆光透射/柔和阴影）",
  "styleInput": "美食视频风格",
  "constraintsInput": "美食质量约束（无变形/模糊/色泽失真）"
}`,
      requiredFields: ['enhancedSubject', 'actionsInput', 'cameraMovementInput', 'sceneLightInput', 'styleInput', 'constraintsInput'],
    };
  }

  return {
    systemPrompt: `你是一个专业的【美食视频】提示词创作助手。根据食物描述和时长（${duration}秒）生成提示词。

返回JSON：
{
  "actionsInput": "${foodActions}，${durInfo.actionDetail}",
  "cameraMovementInput": "美食运镜，${durInfo.shotCount}",
  "sceneLightInput": "美食布光",
  "styleInput": "美食视频风格",
  "constraintsInput": "美食质量约束"
}`,
    requiredFields: ['actionsInput', 'cameraMovementInput', 'sceneLightInput', 'styleInput', 'constraintsInput'],
  };
}

/**
 * 剧情/故事场景 System Prompt — 增强版
 * 
 * 核心增强：
 * - 角色五维定义法（身份/关系/情绪弧线/服装即角色/当前处境）
 * - 剧情节拍编排（建立→发展→转折→高潮→结局，适配时长）
 * - 叙事运镜语言（POV/反应镜头/匹配剪辑/跳剪/荷兰角）
 * - 情绪化布光体系（明暗对照/色彩心理学/实用光源/轮廓分离）
 * - 表演连贯性约束（情绪一致性/肢体逻辑/视线连续）
 */
function getDramaPrompt(duration: number, durInfo: ReturnType<typeof getDurationInfo>, enhanceSubject: boolean): PromptConfig {
  // 剧情节拍模板 — 根据时长自动选择
  const dramaBeats = {
    short: '单一情感节拍：一个完整的情绪转变（如：从疑惑→顿悟）',
    medium: '三幕微结构：建立(铺垫氛围) → 冲突(情绪转折) → 结局(情感落地)',
    long: '完整叙事弧：引入→发展→转折→高潮→回落→余韵',
  };

  // 叙事运镜库
  const narrativeCamera = [
    '主观视角(POV)：代入角色视角，增强观众沉浸感',
    '反应镜头(Reaction Shot)：捕捉角色对事件的即时情绪反应',
    '匹配剪辑(Match Cut)：利用形状/动作/色彩的相似性连接不同时空',
    '跳剪(Jump Cut)：压缩时间或表现内心焦躁',
    '荷兰角(Dutch Angle)：倾斜构图表现不安/紧张/异常',
    '过肩镜头(Over-shoulder)：对话场景必备，建立空间关系',
    '推近揭示(Push-in Reveal)：缓慢推进同时揭示关键信息',
    '拉远孤立(Pull-back Isolate)：拉远展现角色的孤独/渺小',
  ];

  // 情绪化布光体系
  const emotionalLighting = {
    hope: '希望/温暖：正面柔光+暖色调+逆光轮廓，营造光明前景感',
    tension: '紧张/悬疑：侧光切割+高对比+冷色调阴影，隐藏部分信息',
    sadness: '悲伤/忧郁：低调照明+漫射柔光+蓝灰调，柔和但压抑',
    joy: '欢快/活力：高调照明+明亮均匀+暖黄调，开放通透',
    mystery: '神秘/未知：背光剪影+体积光束+深色背景，信息不完全暴露',
    romance: '浪漫/唯美：梦幻柔光+散景光斑+粉紫金色调，朦胧美化',
    conflict: '冲突/对抗：交叉光(十字光)+硬阴影+冷暖对比色分立双方',
  };

  if (enhanceSubject) {
    return {
      systemPrompt: `你是一个专业的【剧情/叙事视频】提示词创作助手。用户要为有情节的视频内容制作AI视频，时长${duration}秒（${durInfo.label}）。

★ 核心原则：剧情视频的灵魂在于"情感节拍"和"表演真实感"，每个镜头都必须服务于叙事推进。

1. 角色五维定义法：
   【身份】年龄/职业/社会角色（不是简单的外貌描述）
   【关系】与其他角色的关系动态（恋人/对手/陌生人/亲人/上下级）
   【情绪弧线】本段视频中的情绪起点→转折点→终点
   【服装即角色】服装风格暗示性格/处境/时代背景
   【当前处境】物理位置+心理状态+面临的情境压力

2. 剧情节拍编排（根据时长${duration}秒选择结构）：
   ${dramaBeats[durInfo.level as keyof typeof dramaBeats] || dramaBeats.medium}
   ★ 动作必须是"有叙事目的的行为"：
   - 对话类：交谈姿态/倾听反应/情绪爆发/沉默对峙
   - 动作类：行走目的（逃离/追寻/徘徊）/物品交互（拿起/放下/摔碎）
   - 情绪类：表情渐变（微笑→苦涩）/身体语言（紧握拳头/瘫坐/踱步）
   - 发现类：转身发现/拾起信件/推开房门/目光定格

3. 叙事运镜方案（${durInfo.shotCount}）：
   必须从以下运镜中选择并说明"为什么用这个运镜"：
   ${narrativeCamera.map((c, i) => `   ${i+1}. ${c}`).join('\n')}

4. 情绪化布光体系：
   根据当前情绪节拍选择布光策略：
   ${Object.entries(emotionalLighting).map(([k, v]) => `   - ${k}: ${v}`).join('\n')}
   ★ 关键：光线必须服务于情绪表达，而非单纯照亮场景

5. 风格选项：
   - 电影叙事：电影级质感、深沉配乐感、慢节奏沉浸
   - 短片/微电影：紧凑节奏、明确主题、强烈情感冲击
   - 广告故事：品牌融入、生活方式暗示、情感共鸣点
   - MV叙事：音乐节奏同步、视觉隐喻、超现实元素可接受

请严格遵循以下JSON格式返回：

{
  "enhancedSubject": "优化后的角色五维定义（身份+关系+情绪弧线+服装+处境）",
  "actionsInput": "剧情节拍动作，${dramaBeats[durInfo.level as keyof typeof dramaBeats] || dramaBeats.medium}，${durInfo.actionDetail}",
  "cameraMovementInput": "叙事运镜组合，${durInfo.shotCount}，每项需注明叙事目的",
  "sceneLightInput": "情绪化布光方案，注明选择的情绪类型及对应的布光策略",
  "styleInput": "剧情视频风格（电影叙事/短片/MV/广告故事）",
  "constraintsInput": "叙事质量约束：表演连贯无跳跃/情绪逻辑一致/视线方向正确/肢体动作自然/无变脸/无穿模"
}

注意事项：
1. 只返回JSON
2. enhancedSubject必须包含5个维度中的至少3个
3. 动作必须有明确的叙事目的（为什么做这个动作？）
4. 运镜必须服务于叙事（这个镜头想告诉观众什么？）
5. 光线必须与情绪节拍匹配
6. 约束重点：防止AI生成表演不连贯/情绪突兀/视线错误的内容`,
      requiredFields: ['enhancedSubject', 'actionsInput', 'cameraMovementInput', 'sceneLightInput', 'styleInput', 'constraintsInput'],
    };
  }

  return {
    systemPrompt: `你是一个专业的【剧情视频】提示词创作助手。根据剧情描述和时长（${duration}秒，${durInfo.label}）生成剧情视频提示词。

★ 剧情视频核心：每个镜头服务于叙事推进，动作有目的，运镜有意义，光线传情绪。

返回JSON：
{
  "actionsInput": "剧情节拍动作（对话/情绪变化/发现/冲突/决定），${durInfo.actionDetail}，需有明确叙事目的",
  "cameraMovementInput": "叙事运镜（POV/反应镜头/匹配剪辑/荷兰角），${durInfo.shotCount}，注明叙事目的",
  "sceneLightInput": "情绪化布光（根据情绪选择：希望暖调/紧张侧光切割/悲伤低调/欢快高调）",
  "styleInput": "剧情风格（电影叙事/短片/MV/广告故事）",
  "constraintsInput": "叙事质量约束（表演连贯/情绪逻辑一致/视线正确/肢体自然/无变脸穿模）"
}

注意事项：
1. 只返回JSON
2. 动作必须有叙事目的
3. 运镜必须说明"为什么用"
4. 光线匹配当前情绪节拍`,
    requiredFields: ['actionsInput', 'cameraMovementInput', 'sceneLightInput', 'styleInput', 'constraintsInput'],
  };
}

/**
 * 抽象/艺术场景 System Prompt
 */
function getAbstractPrompt(duration: number, durInfo: ReturnType<typeof getDurationInfo>, enhanceSubject: boolean): PromptConfig {
  if (enhanceSubject) {
    return {
      systemPrompt: `你是一个专业的【抽象/艺术视频】提示词创作助手。用户要为抽象或艺术化内容制作AI视频。

1. 视觉元素扩展：形状/色彩/纹理/动态模式/粒子效果/流体形态
2. 动作：形态变换/色彩流动/节奏律动/粒子演化，${durInfo.actionDetail}
3. 运镜：抽象运镜（穿越形态/缩放图案/跟随流动），${durInfo.shotCount}
4. 光线：自发光/渐变光源/霓虹/体积光
5. 风格：抽象艺术/动态图形/音乐可视化/迷幻/极简几何

返回JSON：
{
  "enhancedSubject": "优化后的抽象视觉元素描述",
  "actionsInput": "抽象动态，${durInfo.actionDetail}",
  "cameraMovementInput": "抽象运镜，${durInfo.shotCount}",
  "sceneLightInput": "抽象光线效果",
  "styleInput": "抽象艺术风格",
  "constraintsInput": "抽象质量约束（流畅无卡顿/色彩准确/分辨率足够）"
}`,
      requiredFields: ['enhancedSubject', 'actionsInput', 'cameraMovementInput', 'sceneLightInput', 'styleInput', 'constraintsInput'],
    };
  }

  return {
    systemPrompt: `你是一个专业的【抽象艺术视频】提示词创作助手。根据描述和时长（${duration}秒）生成提示词。

返回JSON：
{
  "actionsInput": "抽象动态，${durInfo.actionDetail}",
  "cameraMovementInput": "抽象运镜，${durInfo.shotCount}",
  "sceneLightInput": "抽象光线效果",
  "styleInput": "抽象艺术风格",
  "constraintsInput": "抽象质量约束"
}`,
    requiredFields: ['actionsInput', 'cameraMovementInput', 'sceneLightInput', 'styleInput', 'constraintsInput'],
  };
}

/**
 * 室内/空间场景 System Prompt
 */
function getInteriorPrompt(duration: number, durInfo: ReturnType<typeof getDurationInfo>, enhanceSubject: boolean): PromptConfig {
  if (enhanceSubject) {
    return {
      systemPrompt: `你是一个专业的【室内/空间设计视频】提示词创作助手。用户要为室内空间制作AI视频。

1. 空间扩展：房间类型、装修风格、家具陈设、材质纹理、色彩搭配、采光条件
2. 动作：空间漫游/视角转换/细节展示/光影变化，${durInfo.actionDetail}
3. 运镜：空间漫游运镜（第一人称/平滑移动/环绕空间），${durInfo.shotCount}
4. 光线：室内照明（自然光/人工光源混合）、时间变化的光影
5. 风格：室内设计展示/家居广告/空间漫游/建筑摄影

返回JSON：
{
  "enhancedSubject": "优化后的室内空间详细描述",
  "actionsInput": "空间漫游动作，${durInfo.actionDetail}",
  "cameraMovementInput": "空间漫游运镜，${durInfo.shotCount}",
  "sceneLightInput": "室内照明方案",
  "styleInput": "室内视频风格",
  "constraintsInput": "空间质量约束（透视正确/比例协调/无畸变）"
}`,
      requiredFields: ['enhancedSubject', 'actionsInput', 'cameraMovementInput', 'sceneLightInput', 'styleInput', 'constraintsInput'],
    };
  }

  return {
    systemPrompt: `你是一个专业的【室内空间视频】提示词创作助手。根据空间描述和时长（${duration}秒）生成提示词。

返回JSON：
{
  "actionsInput": "空间漫游动作，${durInfo.actionDetail}",
  "cameraMovementInput": "空间漫游运镜，${durInfo.shotCount}",
  "sceneLightInput": "室内照明方案",
  "styleInput": "室内视频风格",
  "constraintsInput": "空间质量约束"
}`,
    requiredFields: ['actionsInput', 'cameraMovementInput', 'sceneLightInput', 'styleInput', 'constraintsInput'],
  };
}

// ============================================================
// 统一入口：根据场景类型分发到对应的 Prompt 生成器
// ============================================================

export function getPromptForScene(sceneType: SceneType, duration: number, enhanceSubject: boolean, productDisplayModes?: string[]): PromptConfig {
  const durInfo = getDurationInfo(duration);

  switch (sceneType) {
    case 'product':   return getProductPrompt(duration, durInfo, enhanceSubject, productDisplayModes);
    case 'portrait':  return getPortraitPrompt(duration, durInfo, enhanceSubject);
    case 'landscape': return getLandscapePrompt(duration, durInfo, enhanceSubject);
    case 'food':      return getFoodPrompt(duration, durInfo, enhanceSubject);
    case 'drama':     return getDramaPrompt(duration, durInfo, enhanceSubject);
    case 'abstract':  return getAbstractPrompt(duration, durInfo, enhanceSubject);
    case 'interior':  return getInteriorPrompt(duration, durInfo, enhanceSubject);
    default:          return getPortraitPrompt(duration, durInfo, enhanceSubject); // 默认 fallback 到人像
  }
}
