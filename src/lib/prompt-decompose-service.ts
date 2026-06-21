/**
 * 提示词时序分解 API
 * 
 * 将用户输入的单条提示词智能拆解为 N 段有递进关系的子提示词，
 * 确保长视频生成的每个片段有明确的内容分工和视觉连贯性。
 * 
 * 核心能力：
 * 1. 7种场景类型各有专属的分解策略（产品/人像/风景/剧情/美食/抽象/室内）
 * 2. Phase标签体系（establishing → developing → climax → resolving）
 * 3. 自动提取连续性锚点（颜色/材质/位置/光线等关键视觉元素）
 * 4. 叙事节奏权重分配（开场偏重建立，中段偏重细节/动态，收尾偏重沉淀）
 */

// ===== 类型定义 =====

export type SceneType = 'portrait' | 'product' | 'landscape' | 'food' | 'drama' | 'abstract' | 'interior';

export type SegmentPhase = 'establishing' | 'developing' | 'climax' | 'resolving';

export interface DecomposedSegment {
  index: number;           // 片段序号 (0-based)
  phase: SegmentPhase;     // 叙事阶段标签
  phaseLabel: string;      // 阶段中文标签（用于prompt中）
  focus: string;           // 本段内容焦点描述
  prompt: string;          // 本段专属提示词（不包含原始完整prompt）
  continuityAnchors: string[]; // 必须保持一致的视觉锚点列表
  cameraPreference: string;   // 推荐运镜方向
  durationWeight: number;     // 时长权重（0-1，用于非均分时长）
}

export interface DecomposeResult {
  success: boolean;
  segments: DecomposedSegment[];
  totalSegments: number;
  sceneType: SceneType;
  visualAnchors: string[];    // 全局视觉锚点（从原始prompt提取）
  rhythmSummary: string;      // 节奏摘要
  originalPrompt: string;
}

// ===== 场景类型映射表 =====

export const SCENE_TYPE_LABELS: Record<SceneType, string> = {
  portrait: '人像/肖像',
  product: '产品展示',
  landscape: '风景/自然',
  food: '美食/食品',
  drama: '剧情/故事',
  abstract: '抽象艺术',
  interior: '室内空间',
};

// ===== Phase 定义 =====

const PHASE_DEFINITIONS: Record<SegmentPhase, { label: string; description: string }> = {
  establishing: {
    label: '开场建立',
    description: '交代全貌、环境关系、主体出场',
  },
  developing: {
    label: '发展展开',
    description: '深入细节、动态变化、信息增量',
  },
  climax: {
    label: '高潮聚焦',
    description: '最精彩瞬间、核心卖点、情绪顶点',
  },
  resolving: {
    label: '收尾定格',
    description: '总结印象、氛围沉淀、品质感收尾',
  },
};

// ===== 各场景类型的分解策略 =====

/**
 * 产品视频分解策略
 * 节奏：全景建立 → 材质/功能细节展开 → 收尾定格
 */
function decomposeProductPrompt(
  prompt: string,
  totalDuration: number,
  segmentCount: number,
  productDisplayModes?: string[]
): DecomposeResult {
  const anchors = extractVisualAnchors(prompt, 'product');
  const segments: DecomposedSegment[] = [];

  // 根据段数确定phase分布
  const phases = distributePhases(segmentCount);

  for (let i = 0; i < segmentCount; i++) {
    const phase = phases[i];
    const isFirst = i === 0;
    const isLast = i === segmentCount - 1;
    const isMiddle = !isFirst && !isLast;

    let focus: string;
    let segmentPrompt: string;
    let cameraPref: string;

    if (isFirst) {
      // ★ 开场：产品全貌+环境建立
      focus = `产品全景展示与环境关系建立。在干净背景中呈现产品完整外观，确立产品的尺寸比例和整体质感。`;
      cameraPref = '广角建立(Wide Establishing)或环绕拍摄(Orbit)的起始角度';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 以中远景或全景镜头开始，完整展示产品在环境中的姿态
- 确立产品的关键外观特征：${anchors.slice(0, 3).join(' / ') || '整体轮廓、主要色彩、表面质感'}
- 光线从侧面或侧逆光照射，勾勒产品边缘轮廓
- 背景：简洁干净，不抢夺主体注意力
- 运镜：缓慢推近或缓慢环绕，引导观众视线聚焦到产品上

★ 这是视频的开场片段，目标是让观众第一眼就认出这是什么产品，并对其产生初步印象。`;
      
    } else if (isLast) {
      // ★ 收尾：整体印象+品质感定格
      focus = `产品最终姿态与品质印象收尾。回到一个有冲击力的构图，强化品牌/产品记忆点。`;
      cameraPref = '拉远镜头(Pull-back Reveal)或定格画面(Freeze Frame)';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 回到一个精心构图的画面：产品处于最佳展示角度
- 强调产品的核心价值/品质感：${anchors.slice(0, 2).join(' / ') || '工艺精度、材质高级感'}
- 光线达到最佳状态，所有质感细节清晰可见
- 可以有轻微的"呼吸感"（极慢的微幅运动），但整体趋于稳定
- 最终画面应让人产生"想要拥有"的冲动

★ 这是视频的最后片段，目标是为整个展示画上完美句号，留下深刻的产品印象。`;
      
    } else {
      // ★ 中间段：细节/功能/动态展示（按序渐进）
      const detailLevel = i; // 越往后越深入细节
      const detailThemes = [
        ['材质纹理', '表面处理工艺的微观细节，如金属拉丝/陶瓷釉面/皮革纹路'],
        ['功能特征', '产品功能亮点展示，如按键操作/屏幕显示/接口细节'],
        ['光影变化', '光线在产品表面的流动效果，不同角度下的反射变化'],
        ['多角度', '从非常规角度观察产品，展现设计巧思'],
        ['使用暗示', '产品在使用情境中的暗示性展示（手即将触碰/包装半开）'],
        ['对比参照', '与同类产品的隐含对比，突出差异化优势'],
      ];
      const themeIndex = Math.min(detailLevel, detailThemes.length - 1);
      const [themeName, themeDesc] = detailThemes[themeIndex];

      focus = `${themeName}深度展示 — ${themeDesc}`;
      cameraPref = detailLevel <= 1 ? '微距推近(Macro Push-in)' : 
                    detailLevel <= 3 ? '定点旋转展示(Spin Detail)' : 
                    '创意角度(Creative Angle)';
      
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 本段焦点：${themeDesc}
- 运镜：${cameraPref}，镜头距离比前一段更近或角度更有创意
- 保持与前段相同的光线方向和环境背景
- 展示前段未充分呈现的产品维度
- 细节清晰度要求：4K级，无模糊，纹理锐利

★ 这是视频的第${i + 1}/${segmentCount}个片段，属于${PHASE_DEFINITIONS[phase].description}阶段。
★ 必须与前一片段在视觉上无缝衔接（同一产品、同一背景、同一光线）。`;
    }

    segments.push({
      index: i,
      phase,
      phaseLabel: PHASE_DEFINITIONS[phase].label,
      focus,
      prompt: segmentPrompt,
      continuityAnchors: anchors,
      cameraPreference: cameraPref,
      durationWeight: isFirst ? 1.2 : isLast ? 1.0 : 0.9, // 开场略长，中间略短
    });
  }

  return {
    success: true,
    segments,
    totalSegments: segmentCount,
    sceneType: 'product',
    visualAnchors: anchors,
    rhythmSummary: `产品展示节奏：开场全景建立(${segments[0]?.durationWeight || 1}x) → 中段细节递进(0.9x) → 收尾品质定格(1.0x)`,
    originalPrompt: prompt,
  };
}

/**
 * 人像视频分解策略
 * 节奏：角色出场建立 → 表情/动作展开 → 情绪高潮 → 收尾
 */
function decomposePortraitPrompt(
  prompt: string,
  totalDuration: number,
  segmentCount: number
): DecomposeResult {
  const anchors = extractVisualAnchors(prompt, 'portrait');
  const segments: DecomposedSegment[] = [];
  const phases = distributePhases(segmentCount);

  for (let i = 0; i < segmentCount; i++) {
    const phase = phases[i];
    const isFirst = i === 0;
    const isLast = i === segmentCount - 1;

    let focus: string;
    let segmentPrompt: string;
    let cameraPref: string;

    if (isFirst) {
      focus = '角色出场与环境建立。交代人物身份、所处空间、初始情绪状态。';
      cameraPref = '广角建立或中景跟拍的起始帧';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 以中景或全景开始，完整展示人物在环境中的姿态
- 确立角色外观特征：${anchors.slice(0, 3).join(' / ') || '发型、服装风格、体态'}
- 环境光线营造氛围基调（根据情绪选择暖调/冷调/中性）
- 人物可以有轻微的入场动作（走入画面/转身面向镜头/抬头）
- 面部表情自然，眼神有方向感

★ 开场片段，目标是建立"这是谁、在哪里、什么心情"。`;
    } else if (isLast) {
      focus = '情感收尾与余韵。给观众一个回味空间，情绪落地。';
      cameraPref = '拉远镜头或特写淡出';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 选择一个有情感力量的构图（特写表情/背影远去/侧脸剪影）
- 动作放缓，节奏松弛
- 可以有眼神交流（看向镜头=打破第四面墙）或视线移开（沉浸内心）
- 光线可以微妙变化（日落渐暗/灯光亮起/柔光增强）
- 整体给人"故事告一段落"的感觉

★ 收尾片段，目标是为情感体验画上句号。`;
    } else {
      const midThemes = [
        ['表情渐变', '面部表情的细腻变化过程（微笑→思考→微笑）'],
        ['肢体语言', '身体动作传递情绪（整理衣领/轻抚头发/手指轻敲）'],
        ['环境互动', '人物与环境的互动（触摸物品/走向窗边/坐下）'],
        ['情绪转折', '情绪状态的转变节点（平静→惊讶/犹豫→坚定）'],
        ['对话暗示', '仿佛在与人交谈的姿态（侧头倾听/微微点头/开口瞬间）'],
      ];
      const themeIdx = Math.min(i - 1, midThemes.length - 1);
      const [name, desc] = midThemes[themeIdx];

      focus = `${name} — ${desc}`;
      cameraPref = i <= 2 ? '中近景跟拍' : '反应镜头或过肩镜头';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 本段焦点：${desc}
- 运镜：${cameraPref}，比开场更近距离
- 表情/动作必须连贯承接上一片段的结束状态
- ${anchors.slice(0, 2).map(a => `保持"${a}"不变`).join('；')}
- 避免突兀的情绪跳跃

★ 第${i + 1}/${segmentCount}段，${PHASE_DEFINITIONS[phase].description}。`;
    }

    segments.push({
      index: i,
      phase,
      phaseLabel: PHASE_DEFINITIONS[phase].label,
      focus,
      prompt: segmentPrompt,
      continuityAnchors: anchors,
      cameraPreference: cameraPref,
      durationWeight: isFirst ? 1.15 : isLast ? 1.1 : 0.92,
    });
  }

  return {
    success: true,
    segments,
    totalSegments: segmentCount,
    sceneType: 'portrait',
    visualAnchors: anchors,
    rhythmSummary: `人像叙事节奏：角色建立(1.15x) → 情绪展开(0.92x) → 情感收尾(1.1x)`,
    originalPrompt: prompt,
  };
}

/**
 * 风景视频分解策略
 * 节奏：大远景地理建立 → 中景细节/动态元素 → 回归宏大收尾
 */
function decomposeLandscapePrompt(
  prompt: string,
  totalDuration: number,
  segmentCount: number
): DecomposeResult {
  const anchors = extractVisualAnchors(prompt, 'landscape');
  const segments: DecomposedSegment[] = [];
  const phases = distributePhases(segmentCount);

  for (let i = 0; i < segmentCount; i++) {
    const phase = phases[i];
    const isFirst = i === 0;
    const isLast = i === segmentCount - 1;

    let focus: string;
    let segmentPrompt: string;
    let cameraPref: string;

    if (isFirst) {
      focus = '地理全貌与时间氛围建立。用宏大的视角交代景观的整体格局。';
      cameraPref = '航拍拉升(Aerial Pull-up)或超广角横摇(Panoramic Pan)';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 以最大视野开始：航拍俯瞰或超广角全景
- 呈现景观的地理骨架：${anchors.slice(0, 3).join(' / ') || '山脉走向/水域范围/植被分布'}
- 时间氛围一目了然（日出金光/正午明亮/黄昏暖调/夜晚星空）
- 可以有缓慢的镜头推进或拉升，展现空间的纵深
- 云层/雾气/光线等动态元素的初始状态

★ 风景开场，目标是"震撼的第一眼"，建立空间尺度和时间氛围。`;
    } else if (isLast) {
      focus = '回归宏大视角收尾。从细节拉回全景，完成"远近-远近"的视觉闭环。';
      cameraPref = '拉远揭示(Pull-back Reveal)或延时摄影总结(Time-lapse Summary)';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 从上一个片段的细节视角逐渐拉远
- 最终画面回到类似开场的宏大视角，但有更多信息量
- 光线应有明显的时间流逝感（如果是有时间跨度的风景）
- 可以加入延时摄影效果（云层快速流动/星辰轨迹/日影移动）
- 给观众一种"我刚刚经历了一段旅程"的满足感

★ 风景收尾，完成视觉闭环，升华整体印象。`;
    } else {
      const natureThemes = [
        ['中景推进', '从大全景推至中等距离，展现景观的中层细节'],
        ['局部纹理', '极近距离展示自然纹理（岩石裂纹/树皮肌理/水波涟漪）'],
        ['动态生命', '捕捉景观中的生命元素（飞鸟/游鱼/风吹草动/动物出没）'],
        ['光影变幻', '光线在景观上的变化过程（云层遮挡/阳光穿透/阴影移动）'],
        ['水中倒影', '水面或光滑表面对景观的镜像反射'],
        ['季节暗示', '通过特定植物/动物/天气暗示季节特征'],
      ];
      const themeIdx = Math.min(i - 1, natureThemes.length - 1);
      const [name, desc] = natureThemes[themeIdx];

      focus = `${name} — ${desc}`;
      cameraPref = i <= 2 ? '推近细节(Push-in Detail)' : 'Dolly Zoom 或轨道环绕';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 本段焦点：${desc}
- 运镜：${cameraPref}
- 与前段的景别形成对比（大→小→大 的节奏）
- ${anchors.slice(0, 2).map(a => `保持"${a}"的空间一致性`).join('；')}
- 自然光的色温和方向应与前段一致（除非刻意表现时间推移）

★ 第${i + 1}/${segmentCount}段，${PHASE_DEFINITIONS[phase].description}阶段。`;
    }

    segments.push({
      index: i,
      phase,
      phaseLabel: PHASE_DEFINITIONS[phase].label,
      focus,
      prompt: segmentPrompt,
      continuityAnchors: anchors,
      cameraPreference: cameraPref,
      durationWeight: isFirst ? 1.3 : isLast ? 1.2 : 0.85, // 风景开场和收尾需要更多时间
    });
  }

  return {
    success: true,
    segments,
    totalSegments: segmentCount,
    sceneType: 'landscape',
    visualAnchors: anchors,
    rhythmSummary: `风景节奏：宏大建立(1.3x) → 细节探索(0.85x) → 宏大回归(1.2x)，体现"远近-远近"视觉韵律`,
    originalPrompt: prompt,
  };
}

/**
 * 剧情/故事视频分解策略
 * 节奏：铺垫建立 → 冲突/发展 → 高潮 → 结局收尾
 */
function decomposeDramaPrompt(
  prompt: string,
  totalDuration: number,
  segmentCount: number
): DecomposeResult {
  const anchors = extractVisualAnchors(prompt, 'drama');
  const segments: DecomposedSegment[] = [];
  const phases = distributePhases(segmentCount);

  for (let i = 0; i < segmentCount; i++) {
    const phase = phases[i];
    const isFirst = i === 0;
    const isLast = i === segmentCount - 1;
    const isMiddle = !isFirst && !isLast;

    let focus: string;
    let segmentPrompt: string;
    let cameraPref: string;

    if (isFirst) {
      focus = '情境铺垫与角色登场。交代"谁、在哪里、面临什么"。';
      cameraPref = '建立镜头(Establishing Shot)或主观视角(POV)入场';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 先用1-2秒建立环境（房间/街道/自然场景）
- 角色以自然方式进入画面（走入/转身/从门后出现）
- 通过服装/道具/姿态暗示角色身份：${anchors.slice(0, 3).join(' / ') || '职业装束/标志性配饰/独特体态'}
- 初始情绪状态：平静/期待/不安/专注（根据剧情设定）
- 光线配合情绪基调（希望=暖调正面光 / 悬疑=侧光切割 / 悲伤=低调漫射）

★ 剧情开场，目标是"让观众进入故事世界"。`;
    } else if (isLast) {
      focus = '结局与情感落地。给出故事的结论或开放式结尾。';
      cameraPref = '拉远孤立(Pull-back Isolate)或定格画面(Freeze Frame)';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 核心冲突/事件已有明确结果或暗示
- 角色的最终状态：释然/坚定/迷茫/平静
- 可以使用象征性画面（关上门/望向远方/手中物品特写）
- 光线可能有变化（黎明=希望 / 黄昏=结束 / 黑暗=未知）
- 留给观众情感回味的空间

★ 剧情收尾，目标是不一定要回答所有问题，但要给出情感上的"完结感"。`;
    } else {
      // 中间段：根据phase进一步细分
      const dramaBeats: Record<string, [string, string]> = {
        developing: ['情节推进', '事件发生或信息揭露，推动故事向前发展'],
        climax: ['情绪/冲突高潮', '最紧张或最动人的时刻，情感强度最高'],
      };
      const [beatName, beatDesc] = dramaBeats[phase] || ['情节发展中', '故事继续向前推进'];

      focus = `${beatName} — ${beatDesc}`;
      cameraPref = phase === 'climax' 
        ? '快速剪辑或希区柯克变焦(Dolly Zoom)' 
        : '反应镜头(Reaction Shot)或过肩镜头(Over-shoulder)';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 本段是剧情的${PHASE_DEFINITIONS[phase].description}阶段
- ${beatDesc}
- 运镜：${cameraPref}${phase === 'climax' ? '，节奏可加快' : '，节奏平稳'}
- 角色表情和动作必须有明确的叙事目的
- ${anchors.slice(0, 2).map(a => `保持"${a}"的一致性`).join('；')}

★ 第${i + 1}/${segmentCount}段，${phase === 'climax' ? '⚡ 高潮片段，情感最强' : '发展阶段'}。`;
    }

    segments.push({
      index: i,
      phase,
      phaseLabel: PHASE_DEFINITIONS[phase].label,
      focus,
      prompt: segmentPrompt,
      continuityAnchors: anchors,
      cameraPreference: cameraPref,
      durationWeight: phase === 'climax' ? 1.3 : isFirst ? 1.1 : isLast ? 1.15 : 0.9,
    });
  }

  return {
    success: true,
    segments,
    totalSegments: segmentCount,
    sceneType: 'drama',
    visualAnchors: anchors,
    rhythmSummary: `剧情节奏：铺垫(1.1x) → 发展(0.9x) → 高潮(1.3x) → 收尾(1.15x)，符合经典三幕/五幕结构`,
    originalPrompt: prompt,
  };
}

/**
 * 美食视频分解策略
 * 节奏：摆盘全貌 → 食材/质地细节 → 食欲诱惑收尾
 */
function decomposeFoodPrompt(
  prompt: string,
  totalDuration: number,
  segmentCount: number
): DecomposeResult {
  const anchors = extractVisualAnchors(prompt, 'food');
  const segments: DecomposedSegment[] = [];
  const phases = distributePhases(segmentCount);

  for (let i = 0; i < segmentCount; i++) {
    const phase = phases[i];
    const isFirst = i === 0;
    const isLast = i === segmentCount - 1;

    let focus: string;
    let segmentPrompt: string;
    let cameraPref: string;

    if (isFirst) {
      focus = '摆盘全貌与用餐环境建立。展示食物的整体呈现方式。';
      cameraPref = '45°侧拍或略微俯视的全景镜头';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 以能看清整道菜/整杯饮品的构图开始
- 展示摆盘美学：餐具搭配、装饰点缀、色彩组合
- 环境：桌面/餐垫/背景虚化处理
- 光线：暖调食欲光，从侧后方照射产生柔和高光
- 可有轻微热气或新鲜感的暗示

★ 美食开场，目标是"看起来很好吃"。`;
    } else if (isLast) {
      focus = '终极食欲诱惑。最具冲击力的画面，让人想立刻品尝。';
      cameraPref = '极近距离微距或慢动作特写';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 选择最有食欲诱惑力的角度和距离
- 可以是：刚切开的瞬间/酱汁流淌/蒸汽升腾/最后一口
- 色彩饱和度最高、细节最清晰的画面
- 光线完美照亮食物的每一处质感
- 可以有"伸手去拿"或"勺子靠近"的动作暗示

★ 美食收尾，目标是"忍不住想吃"。`;
    } else {
      const foodThemes = [
        ['质地特写', '食物的微观质地（肉类的纤维/蛋糕的松软/冰淇淋的融化）'],
        ['制作过程暗示', '仿佛刚刚完成的瞬间（撒调料/淋酱汁/摆放装饰）'],
        ['温度感知', '传达温度的视觉线索（热气升腾/冰块凝结水珠/锅边沸腾）'],
        ['口感联想', '引发口感想象的画面（掰开时的层次/咬下去的瞬间/拉丝效果）'],
      ];
      const themeIdx = Math.min(i - 1, foodThemes.length - 1);
      const [name, desc] = foodThemes[themeIdx];

      focus = `${name} — ${desc}`;
      cameraPref = '微距推近(Macro Push-in)或慢动作(Slow Motion)';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 本段焦点：${desc}
- 运镜：${cameraPref}，比开场更近距离
- 保持相同的摆盘和餐具位置
- 色彩真实诱人，不过度饱和
- ${anchors.slice(0, 2).map(a => `保持"${a}"不变`).join('；')}

★ 第${i + 1}/${segmentCount}段，逐步提升食欲感。`;
    }

    segments.push({
      index: i,
      phase,
      phaseLabel: PHASE_DEFINITIONS[phase].label,
      focus,
      prompt: segmentPrompt,
      continuityAnchors: anchors,
      cameraPreference: cameraPref,
      durationWeight: isFirst ? 1.1 : isLast ? 1.2 : 0.9,
    });
  }

  return {
    success: true,
    segments,
    totalSegments: segmentCount,
    sceneType: 'food',
    visualAnchors: anchors,
    rhythmSummary: `美食节奏：摆盘建立(1.1x) → 质地探索(0.9x) → 食欲高潮(1.2x)`,
    originalPrompt: prompt,
  };
}

/**
 * 抽象艺术视频分解策略
 * 节奏：形态引入 → 变化/演化 → 视觉高潮 → 归于和谐
 */
function decomposeAbstractPrompt(
  prompt: string,
  totalDuration: number,
  segmentCount: number
): DecomposeResult {
  const anchors = extractVisualAnchors(prompt, 'abstract');
  const segments: DecomposedSegment[] = [];
  const phases = distributePhases(segmentCount);

  for (let i = 0; i < segmentCount; i++) {
    const phase = phases[i];
    const isFirst = i === 0;
    const isLast = i === segmentCount - 1;

    let focus: string;
    let segmentPrompt: string;
    let cameraPref: string;

    if (isFirst) {
      focus = '形态引入与基础色调建立。确定核心视觉元素和色彩基调。';
      cameraPref = '固定镜头或极慢速轨道移动';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 呈现抽象形态的基础状态（几何形状/流体/粒子/光线）
- 确立主色调和辅助色：${anchors.slice(0, 3).join(' / ') || '主色+辅色+点缀色'}
- 背景可以是纯色或渐变
- 运动极其缓慢，几乎静止，让眼睛适应画面
- 可以有微弱的自发光或内部光源

★ 抽象开场，建立视觉"调性"。`;
    } else if (isLast) {
      focus = '归于和谐或开放性结尾。形态稳定或消散，留有余韵。';
      cameraPref = '固定镜头或缓慢拉远';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 所有动态元素趋向稳定或有序
- 色彩可能融合为统一的色调
- 或者相反：形态逐渐消散/溶解/消失
- 给人一种"完成了"或"无限循环"的感觉
- 最后几秒可以渐暗或渐变为纯色

★ 抽象收尾，完成视觉旅程。`;
    } else {
      const abstractThemes = [
        ['形态变换', '形状的演变（分裂/融合/扭曲/生长）'],
        ['色彩流动', '颜色的渐变、混合、分离或脉冲'],
        ['粒子演化', '粒子的聚集/扩散/轨迹/碰撞'],
        ['光影舞蹈', '光线的变化、折射、反射或投影'],
        ['节奏加速', '运动速度加快，复杂度增加'],
      ];
      const themeIdx = Math.min(i - 1, abstractThemes.length - 1);
      const [name, desc] = abstractThemes[themeIdx];

      focus = `${name} — ${desc}`;
      cameraPref = i <= 2 ? '缓慢轨道环绕' : '更复杂的运镜组合';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 本段焦点：${desc}
- 运动速度和复杂度比前段有所增加
- 保持已建立的色彩体系和基本形态
- 允许超现实的视觉效果（不符合物理规律也没关系）
- ${anchors.slice(0, 2).map(a => `延续"${a}"的视觉元素`).join('；')}

★ 第${i + 1}/${segmentCount}段，${PHASE_DEFINITIONS[phase].description}。`;
    }

    segments.push({
      index: i,
      phase,
      phaseLabel: PHASE_DEFINITIONS[phase].label,
      focus,
      prompt: segmentPrompt,
      continuityAnchors: anchors,
      cameraPreference: cameraPref,
      durationWeight: isFirst ? 1.1 : isLast ? 1.15 : 0.92,
    });
  }

  return {
    success: true,
    segments,
    totalSegments: segmentCount,
    sceneType: 'abstract',
    visualAnchors: anchors,
    rhythmSummary: `抽象节奏：调性建立(1.1x) → 演化展开(0.92x) → 和谐收尾(1.15x)`,
    originalPrompt: prompt,
  };
}

/**
 * 室内空间视频分解策略
 * 节奏：空间漫游建立 → 设计细节 → 生活氛围 → 整体印象
 */
function decomposeInteriorPrompt(
  prompt: string,
  totalDuration: number,
  segmentCount: number
): DecomposeResult {
  const anchors = extractVisualAnchors(prompt, 'interior');
  const segments: DecomposedSegment[] = [];
  const phases = distributePhases(segmentCount);

  for (let i = 0; i < segmentCount; i++) {
    const phase = phases[i];
    const isFirst = i === 0;
    const isLast = i === segmentCount - 1;

    let focus: string;
    let segmentPrompt: string;
    let cameraPref: string;

    if (isFirst) {
      focus = '空间入口与整体布局建立。让观众"走进"这个空间。';
      cameraPref = '第一人称视角(POV)步入或广角建立镜头';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 从门口或入口处开始，模拟人眼视角进入空间
- 快速扫视建立空间布局：${anchors.slice(0, 3).join(' / ') || '房间格局/家具位置/色彩基调'}
- 自然光或室内照明营造舒适氛围
- 运动平稳流畅，如同真实行走
- 可以有轻微的环境音暗示（但不生成声音）

★ 室内开场，目标是"邀请观众进来"。`;
    } else if (isLast) {
      focus = '整体印象与居住理想。回到一个令人向往的画面。';
      cameraPref = '拉远至门口视角或定点的"杂志封面"构图';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 回到一个精心选择的"最佳角度"
- 可能包含生活化的暗示（一杯咖啡/一本翻开的书/一束花）
- 光线达到最温暖舒适的状态
- 整体传达"这是一个我想住的地方"的感觉
- 可以有极慢的"呼吸式"镜头运动

★ 室内收尾，留下完整的空间印象。`;
    } else {
      const interiorThemes = [
        ['材质细节', '近距离展示材质纹理（木纹/织物/石材/金属）'],
        ['家具聚焦', '逐一展示关键家具的设计和工艺'],
        ['光影游戏', '光线在不同时间和角度下的变化'],
        ['生活气息', '暗示有人居住的痕迹（靠垫/书籍/绿植/艺术品）'],
        ['功能区域', '展示不同功能区（工作区/休息区/餐饮区）'],
      ];
      const themeIdx = Math.min(i - 1, interiorThemes.length - 1);
      const [name, desc] = interiorThemes[themeIdx];

      focus = `${name} — ${desc}`;
      cameraPref = '平滑移动(Smooth Dolly)或缓慢平移(Pan)';
      segmentPrompt = `【${PHASE_DEFINITIONS[phase].label}】${focus}

具体要求：
- 本段焦点：${desc}
- 运镜：${cameraPref}，保持第一人称或第三人称漫游感
- 与前段的空间位置有逻辑连贯性（从客厅走到餐厅等）
- ${anchors.slice(0, 2).map(a => `保持"${a}"一致`).join('；')}
- 光线条件应自然过渡

★ 第${i + 1}/${segmentCount}段，继续空间探索之旅。`;
    }

    segments.push({
      index: i,
      phase,
      phaseLabel: PHASE_DEFINITIONS[phase].label,
      focus,
      prompt: segmentPrompt,
      continuityAnchors: anchors,
      cameraPreference: cameraPref,
      durationWeight: isFirst ? 1.2 : isLast ? 1.15 : 0.88,
    });
  }

  return {
    success: true,
    segments,
    totalSegments: segmentCount,
    sceneType: 'interior',
    visualAnchors: anchors,
    rhythmSummary: `室内节奏：空间建立(1.2x) → 细节探索(0.88x) → 整体印象(1.15x)，模拟真实漫游体验`,
    originalPrompt: prompt,
  };
}

// ===== 工具函数 =====

/**
 * 根据段数自动分配Phase
 * 2段: establishing + resolving
 * 3段: establishing + developing + resolving
 * 4段+: establishing + developing + climax + resolving (中间段填充developing)
 */
function distributePhases(count: number): SegmentPhase[] {
  if (count <= 0) return [];
  if (count === 1) return ['resolving'];
  if (count === 2) return ['establishing', 'resolving'];
  if (count === 3) return ['establishing', 'developing', 'resolving'];
  
  // 4段及以上：首尾固定，中间分配developing和climax
  const phases: SegmentPhase[] = ['establishing'];
  const middleCount = count - 2;
  
  // 在中间段中插入一个climax（偏向后1/3位置）
  const climaxPos = Math.floor(middleCount * 0.6); // 约60%位置放高潮
  
  for (let i = 0; i < middleCount; i++) {
    phases.push(i === climaxPos ? 'climax' : 'developing');
  }
  
  phases.push('resolving');
  return phases;
}

/**
 * 从原始prompt中提取视觉锚点
 * 这些锚点将在后续每段中强制注入以确保一致性
 */
export function extractVisualAnchors(prompt: string, sceneType: SceneType): string[] {
  const anchors: string[] = [];
  
  // 通用的关键词匹配规则
  const patterns: Record<SceneType, RegExp[]> = {
    portrait: [
      /(\d+\s*岁?[男女老少青年中年少年少女]?[\u4e00-\u9fa5]*(?:女生|女性|男士|男性|人|模特|演员))/g,
      /(黑色|棕色|金色|红色|白色|灰色|深色|浅色|长发|短发|卷发|直发)/g,
      /(连衣裙|西装|T恤|衬衫|外套|夹克|风衣|大衣|职业装|休闲装)/g,
      /(微笑|严肃|沉思|惊讶|温柔|坚定|忧郁|自信)/g,
    ],
    product: [
      /([A-Za-z\u4e00-\u9fa5]+(?:手机|手表|耳机|电脑|相机|包|鞋|口红|香水|咖啡杯|汽车|首饰|珠宝|化妆品|家电|家具)[\u4e00-\u9fa5]*)/g,
      /(钛金属|铝合金|不锈钢|真皮|陶瓷|玻璃|丝绸|棉麻|羊毛|黄金|玫瑰金|铂金|哑光|亮面|磨砂|拉丝)/g,
      /(黑色|白色|银色|金色|红色|蓝色|绿色|粉色|紫色|深空黑|香槟金|玫瑰金|午夜蓝|象牙白)/g,
      /(\d+(?:mm|英寸|寸)?(?:版|型|代|Pro|Max|Ultra|Plus|Lite)?)/g,
    ],
    landscape: [
      /((?:黄山|泰山|华山|张家界|九寨沟|西湖|长城|故宫|埃菲尔铁塔|自由女神|富士山|阿尔卑斯|亚马逊|撒哈拉|南极|北极|太平洋|大西洋|\w+山|\w+河|\w+湖|\w+海|\w+峡谷|\w+沙漠|\w+森林|\w+草原|\w+瀑布))/g,
      /(日出|日落|黄昏|清晨|正午|深夜|星空|月夜|雨天|雪天|雾天|晴天|多云)/g,
      /(云海|云层|雾气|彩虹|闪电|流星|极光|银河)/g,
      /(春天|夏天|秋天|冬季|春|夏|秋|冬|绿意盎然|金黄遍野|白雪皑皑|枫叶红透)/g,
    ],
    food: [
      /((?:牛排|寿司|披萨|汉堡|拉面|火锅|烧烤|蛋糕|面包|咖啡|茶|红酒|牛角包|刺身|甜点|沙拉|汤|粥|饺子|面条|炒饭|三明治|可颂|马卡龙|提拉米苏|布蕾|慕斯|塔|派)[\u4e00-\u9fa5]*)/g,
      /(新鲜|酥脆|柔软|浓郁|香甜|酸辣|咸鲜|清爽|醇厚|绵密|Q弹|嫩滑|焦糖|巧克力|抹茶|芒果|草莓|柠檬|奶油|芝士|黄油|橄榄油|黑胡椒|海盐)/g,
      /(热气腾腾|冒着热气|刚出炉|冰镇|冷藏|常温|温热)/g,
      /(精致|优雅|丰盛|简约|田园风|法式|日式|中式|意式|北欧|复古|现代)/g,
    ],
    drama: [
      /((?:侦探|医生|律师|教师|学生|艺术家|商人|科学家|军人|警察|厨师|音乐家|作家|记者|工程师|设计师|程序员)[\u4e00-\u9fa5]*)/g,
      /(办公室|教室|医院|餐厅|咖啡馆|公园|机场|火车站|海边|山顶|地下室|阁楼|阳台|街道|广场|图书馆|美术馆|剧院)/g,
      /(秘密|真相|发现|告别|重逢、对决|和解、逃离、追寻、等待、抉择|背叛|救赎|觉醒)/g,
      /(紧张|温馨|悬疑|浪漫|悲伤、欢乐|恐惧、愤怒、希望|绝望|感动|震撼)/g,
    ],
    abstract: [
      /(几何|流体|粒子|波浪|螺旋|分形|晶体|星云|极光|霓虹|赛博|数字|矩阵|万花筒|棱镜|光谱|渐变|脉冲|振动)/g,
      /(红|橙|黄|绿|青|蓝|紫|粉|金|银|黑白|彩色|单色|双色|渐变|荧光|发光|自发光)/g,
      /(融合|分裂|扭曲|拉伸|压缩|旋转|翻转、溶解|凝聚|扩散|漂浮|坠落|爆炸|绽放|收缩)/g,
      /(超现实|梦幻|迷幻|未来感|复古|极简|繁复|有机|机械|生物|宇宙|微观|宏观)/g,
    ],
    interior: [
      /((?:北欧|现代|中式|日式|美式|工业风|极简|奢华|乡村|地中海|波西米亚|复古|Art Deco| loft|公寓|别墅|工作室|店面)[\u4e00-\u9fa5]*(?:风格|装修|设计|空间|家居|室内)?)/g,
      /(客厅|卧室|厨房|书房|浴室|阳台|玄关|走廊|楼梯|餐厅|办公室|会议室|接待区|展厅|咖啡厅|酒吧|健身房)/g,
      /(原木|大理石|混凝土|玻璃|金属|织物|皮革|瓷砖|地毯|壁纸|涂料|木材|石材|砖墙)/g,
      /(落地窗|吊灯|沙发|床|餐桌|书架|浴缸|壁炉|绿植|艺术品|挂画|地毯|窗帘)/g,
    ],
  };

  const scenePatterns = patterns[sceneType] || patterns.portrait;
  
  for (const pattern of scenePatterns) {
    const matches = prompt.match(pattern);
    if (matches) {
      anchors.push(...matches.filter(m => m.length >= 2));
    }
  }

  // 去重并限制数量
  const uniqueAnchors = [...new Set(anchors)].slice(0, 6);
  
  // 如果提取不到足够的锚点，补充通用锚点
  if (uniqueAnchors.length < 2) {
    uniqueAnchors.push('整体视觉风格一致', '色调和氛围统一');
  }

  return uniqueAnchors;
}

// ===== 主分发函数 =====

/**
 * 根据场景类型调用对应的分解策略
 */
export function decomposeBySceneType(
  prompt: string,
  totalDuration: number,
  segmentCount: number,
  sceneType: SceneType,
  extraOptions?: { productDisplayModes?: string[] }
): DecomposeResult {
  console.log(`[Decompose] 开始分解: sceneType=${sceneType}, segments=${segmentCount}, duration=${totalDuration}s`);

  switch (sceneType) {
    case 'product':
      return decomposeProductPrompt(prompt, totalDuration, segmentCount, extraOptions?.productDisplayModes);
    case 'portrait':
      return decomposePortraitPrompt(prompt, totalDuration, segmentCount);
    case 'landscape':
      return decomposeLandscapePrompt(prompt, totalDuration, segmentCount);
    case 'food':
      return decomposeFoodPrompt(prompt, totalDuration, segmentCount);
    case 'drama':
      return decomposeDramaPrompt(prompt, totalDuration, segmentCount);
    case 'abstract':
      return decomposeAbstractPrompt(prompt, totalDuration, segmentCount);
    case 'interior':
      return decomposeInteriorPrompt(prompt, totalDuration, segmentCount);
    default:
      console.warn(`[Decompose] 未知场景类型 "${sceneType}", fallback to portrait`);
      return decomposePortraitPrompt(prompt, totalDuration, segmentCount);
  }
}

