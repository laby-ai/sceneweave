import type { UserInputEntities } from '../storyboard-generator';
import type { PromptBasedShot, ShotPhase, ShotType } from './prompt-shot-types';

const QUALITY_SUFFIXES = {
  short: 'cinematic lighting, 4K ultra HD, highly detailed, smooth motion',
  medium: '电影级布光，4K超高清画质，细节丰富，画面连贯流畅无卡顿，cinematic quality',
  long: '电影级质感布光，4K超高清，HDR高动态范围，细节纹理清晰可见，色彩准确，运动流畅连贯无抖动无畸变，cinematic lighting, 8K quality, professional color grading',
};

function getQualitySuffix(duration: number): string {
  if (duration <= 3) return QUALITY_SUFFIXES.short;
  if (duration <= 7) return QUALITY_SUFFIXES.medium;
  return QUALITY_SUFFIXES.long;
}

function buildSubjectDefinition(subject: string, text: string, sceneType: string): string {
  if (subject && subject !== '人物' && subject.length > 2) return subject;
  const lowerText = text.toLowerCase();
  let gender = '';
  if (/她|女|女孩|女生|女士|少女|姑娘|女神/.test(lowerText)) gender = '女性';
  else if (/他|男|男孩|男生|男士|少年|小伙|男神/.test(lowerText)) gender = '男性';
  let ageHint = '';
  if (/孩子|小孩|儿童|小|幼/.test(lowerText)) ageHint = '年幼的';
  else if (/老人|老年|长辈|老/.test(lowerText)) ageHint = '年长的';
  else if (/青年|年轻人|少|青春/.test(lowerText)) ageHint = '年轻的';
  const costumeMap: Record<string, string> = {
    outdoor_nature: '穿着休闲便装',
    outdoor_urban: '穿着时尚都市装',
    indoor_home: '着装符合人物身份和剧情场景',
    indoor_office: '穿着正式商务装',
    crowd_public: '穿着得体社交装',
  };
  const costumeHint = costumeMap[sceneType] || '着装得体';
  const parts = [ageHint, gender, costumeHint].filter(Boolean);
  return parts.length > 0 ? parts.join('') + '的人物' : '人物';
}

/** 视觉锚点 — 跨镜头保持一致的关键视觉元素 */
export interface VisualAnchor {
  element: string;      // 锚点描述（如"钛金属表壳"、"深空黑色"）
  category: 'color' | 'material' | 'object' | 'style' | 'lighting';
}

/**
 * 从用户输入提取视觉锚点
 * 用于在所有分镜中保持关键视觉元素的一致性
 */
export function extractVisualAnchors(text: string): VisualAnchor[] {
  const anchors: VisualAnchor[] = [];

  // === 颜色锚点 ===
  const colorPatterns = [
    { pattern: /(黑色|白色|红色|蓝色|绿色|黄色|金色|银色|灰色|粉色|紫色|橙色|棕色|深空黑|午夜蓝|玫瑰金|香槟金|钛金属|磨砂|哑光|亮面|透明)/g, category: 'color' as const },
  ];
  for (const { pattern, category } of colorPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        if (!anchors.find(a => a.element === m)) {
          anchors.push({ element: m, category });
        }
      }
    }
  }

  // === 材质锚点 ===
  const materialPatterns = [
    /皮革|丝绸|棉麻|羊毛|金属|木质|玻璃|陶瓷|大理石|混凝土|亚克力|碳纤维|织物|绒面|光滑|粗糙|磨砂质感/,
  ];
  for (const pat of materialPatterns) {
    const m = text.match(pat);
    if (m && !anchors.find(a => a.element === m[0])) {
      anchors.push({ element: m[0], category: 'material' });
    }
  }

  // === 关键物体锚点（产品名、主体特征等）===
  // 提取引号内容或长名词短语
  const objectMatches = text.match(/[""「」]([^""「」]{2,10})[""「」]/g);
  if (objectMatches) {
    for (const obj of objectMatches) {
      const clean = obj.replace(/[""「」]/g, '');
      if (!anchors.find(a => a.element === clean)) {
        anchors.push({ element: clean, category: 'object' });
      }
    }
  }

  // === 风格锚点 ===
  const styleKeywords = ['极简', '复古', '现代', '工业风', '北欧', '日式', '中式', '欧式', '奢华', '简约', '科技感', '自然', '温馨'];
  for (const kw of styleKeywords) {
    if (text.includes(kw) && !anchors.find(a => a.element === kw)) {
      anchors.push({ element: kw, category: 'style' });
    }
  }

  return anchors.slice(0, 8); // 最多8个锚点，避免过度约束
}

/**
 * 根据镜头位置分配阶段和类型
 */
export function getShotPhaseInfo(index: number, total: number): { phase: ShotPhase; phaseLabel: string; shotType: ShotType; shotTypeLabel: string } {
  if (total === 1) {
    return { phase: 'establishing', phaseLabel: '完整叙事', shotType: 'establishing', shotTypeLabel: '一镜到底' };
  }

  if (total === 2) {
    if (index === 0) return { phase: 'establishing', phaseLabel: '开场建立', shotType: 'establishing', shotTypeLabel: '广角建立' };
    return { phase: 'resolving', phaseLabel: '收尾定格', shotType: 'closing', shotTypeLabel: '情绪收尾' };
  }

  // 3+ 镜头的标准弧线
  const position = index / Math.max(total - 1, 1);

  if (position < 0.2) {
    return { phase: 'establishing', phaseLabel: '开场建立', shotType: 'establishing', shotTypeLabel: '环境建立' };
  }
  if (position < 0.45) {
    return { phase: 'developing', phaseLabel: '展开发展', shotType: 'action', shotTypeLabel: '叙事展开' };
  }
  if (position < 0.7) {
    return { phase: 'detail', phaseLabel: '细节特写', shotType: 'closeup', shotTypeLabel: '细节聚焦' };
  }
  if (position < 0.9) {
    return { phase: 'climax', phaseLabel: '高潮转折', shotType: 'transition', shotTypeLabel: '视角转换' };
  }
  return { phase: 'resolving', phaseLabel: '收尾定格', shotType: 'closing', shotTypeLabel: '最终呈现' };
}

// ============================================================
// 7种场景专属分镜策略函数
// ============================================================

export interface SceneShotContext {
  entities: UserInputEntities;
  anchors: VisualAnchor[];
  phaseInfo: ReturnType<typeof getShotPhaseInfo>;
  shotIndex: number;
  totalShots: number;
  duration: number;
  originalPrompt: string;
}

/**
 * 产品展示场景分镜策略
 * 节奏：Hero全景 → 多角度展示 → 特写细节 → Lifestyle场景 → 收尾定格
 */
function buildProductShot(ctx: SceneShotContext): string {
  const { entities, anchors, phaseInfo, shotIndex, totalShots, duration } = ctx;
  const productName = entities.subject !== '人物' ? entities.subject : '产品';
  const anchorStr = anchors.filter(a => a.category === 'color' || a.category === 'material').map(a => a.element).join('、');

  const parts: string[] = [];

  switch (phaseInfo.shotType) {
    case 'establishing':
    case 'hero':
      parts.push(`【Hero全景镜头】${anchorStr ? `${anchorStr}的` : ''}${productName}，居中构图，360度旋转展示轮廓`);
      parts.push('纯色或渐变背景，柔和环形布光突出产品质感');
      parts.push(duration >= 5 ? '缓慢自转，从正面开始顺时针旋转至背面，再回到正面' : '静态或微幅旋转展示');
      break;

    case 'action':
      parts.push(`【多角度展示】${productName}${anchorStr ? `（${anchorStr}）` : ''}的侧面或45度角视角`);
      parts.push('中近景构图，展示产品的立体感和设计线条');
      parts.push('平移运镜环绕产品，配合轻微俯仰变化');
      break;

    case 'closeup':
      parts.push(`【细节特写】${productName}的关键细节区域`);
      parts.push(anchorStr ? `聚焦于${anchorStr}的材质纹理和工艺细节` : '聚焦于表面材质、接口、Logo等精细结构');
      parts.push('微距或超近景，浅景深虚化背景，侧光或逆光勾勒边缘');
      break;

    case 'lifestyle':
      parts.push(`【Lifestyle场景】${productName}融入真实使用场景`);
      const lifestyleHint = entities.location || '现代生活空间中';
      parts.push(`${lifestyleHint}，${productName}自然地处于画面中`);
      parts.push('中景构图，环境光为主，营造真实使用氛围');
      break;

    case 'transition':
      parts.push(`【功能演示】${productName}的核心功能或交互方式`);
      parts.push('动态展示产品操作过程或状态变化');
      parts.push('跟拍或固定机位，清晰捕捉操作细节');
      break;

    case 'closing':
      parts.push(`【品牌定格】${productName}最终呈现，配合品牌信息或Slogan`);
      parts.push('标志性构图，可叠加文字或Logo元素');
      parts.push('缓慢推近或定格，留下深刻印象');
      break;
  }

  // 注入视觉锚点一致性
  if (anchorStr && phaseInfo.shotType !== 'hero') {
    parts.push(`保持${anchorStr}的视觉一致性`);
  }

  // 质量后缀
  parts.push(getQualitySuffix(duration));

  return parts.join('。');
}

/**
 * 人像/肖像场景分镜策略
 * 节奏：环境建立 → 主体入场 → 中景互动 → 表情特写 → 情绪高潮
 */
function buildPortraitShot(ctx: SceneShotContext): string {
  const { entities, anchors, phaseInfo, shotIndex, totalShots, duration } = ctx;
  const subject = buildSubjectDefinition(entities.subject, ctx.originalPrompt, 'indoor_home');
  const location = entities.location || '柔和的自然光空间';
  const emotion = entities.emotion || '';

  const parts: string[] = [];

  switch (phaseInfo.shotType) {
    case 'establishing':
      parts.push(`【环境建立】${location}的全景或广角镜头`);
      parts.push(`${emotion ? `${emotion}的` : ''}氛围基调，光线方向明确`);
      parts.push('横摇或缓慢推近，先展现场景再引入人物轮廓');
      break;

    case 'action':
      parts.push(`【主体入场】${subject}进入画面中心区域`);
      parts.push(entities.action ? `${entities.action}，姿态自然` : '步伐从容或静立，姿态放松');
      parts.push('中景跟拍或侧面角度，捕捉动态美感');
      break;

    case 'closeup':
      parts.push(`【表情/细节特写】${subject}的面部表情或手部细节`);
      parts.push(emotion ? `传递${emotion}的情感` : '眼神有故事感，微表情丰富');
      parts.push('近景到特写的缓慢推近，浅景深突出面部');
      break;

    case 'transition':
      parts.push(`【视角转换】不同角度展现${subject}`);
      parts.push('过肩镜头、侧面剪影、或背影镜头增加层次');
      parts.push('平滑的角度过渡，保持情绪连贯');
      break;

    case 'closing':
      parts.push(`【情绪收尾】${subject}的最终状态定格`);
      parts.push(emotion ? `${emotion}达到饱满状态` : '神情满足或意味深长的注视');
      parts.push('特写或缓缓拉远至环境，余韵悠长');
      break;
  }

  // 注入风格锚点
  const styleAnchor = anchors.find(a => a.category === 'style');
  if (styleAnchor) {
    parts.push(`整体保持${styleAnchor.element}的风格调性`);
  }

  parts.push(getQualitySuffix(duration));
  return parts.join('。');
}

/**
 * 风景/自然场景分镜策略
 * 节奏：广角大景 → 空间层次推进 → 细节纹理 → 氛围收尾
 */
function buildLandscapeShot(ctx: SceneShotContext): string {
  const { entities, anchors, phaseInfo, duration } = ctx;
  const location = entities.location || '壮丽的自然景观';
  const timeOfDay = entities.timeOfDay || '';
  const atmosphere = entities.atmosphere || '';

  const parts: string[] = [];

  switch (phaseInfo.shotType) {
    case 'establishing':
      parts.push(`【全景建立】${location}的辽阔全景`);
      parts.push(timeOfDay ? `${timeOfDay}` : '黄金时刻或蓝调时刻的自然光');
      parts.push('超广角或航拍视角，缓慢横摇扫过整个场景，建立空间尺度感');
      break;

    case 'action':
      parts.push(`【空间推进】深入${location}的中景层次`);
      parts.push('引导线构图（道路/河流/山脊），视线向纵深延伸');
      parts.push('向前推进或航拍下降，从宏观进入具体场景');
      break;

    case 'closeup':
      parts.push(`【纹理细节】${location}中的微观世界`);
      const detailHints = ['岩石表面的风化纹理', '树叶上的露珠折射阳光', '水面的波光粼粼细节', '花草的细腻脉络', '沙粒被风吹动的轨迹'];
      parts.push(detailHints[ctx.shotIndex % detailHints.length]);
      parts.push('微距或近景，极浅景深，侧逆光增强立体感');
      break;

    case 'transition':
      parts.push(`【光影变幻】${location}的光影动态`);
      parts.push(atmosphere || '云层移动投下的光影变化，或风吹草动的韵律');
      parts.push('延时摄影效果或慢动作捕捉自然动态');
      break;

    case 'closing':
      parts.push(`【氛围收尾】${location}的整体意境升华`);
      parts.push(timeOfDay ? `${timeOfDay}的光线渐变` : '日落余晖或晨曦初现的渐变氛围');
      parts.push('缓缓拉远或固定长曝光，画面渐隐或定格于最美瞬间');
      break;
  }

  parts.push(getQualitySuffix(duration));
  return parts.join('。');
}

/**
 * 美食/食品场景分镜策略
 * 节奏：场景建立 → 食材/摆盘全景 → 质感特写 → 最终呈现
 */
function buildFoodShot(ctx: SceneShotContext): string {
  const { entities, anchors, phaseInfo, shotIndex, duration } = ctx;
  const foodName = entities.subject !== '人物' ? entities.subject : '精致美食';
  const anchorStr = anchors.map(a => a.element).join('、');

  const parts: string[] = [];

  switch (phaseInfo.shotType) {
    case 'establishing':
      parts.push(`【场景建立】美食呈现环境的整体氛围`);
      parts.push(entities.location || '温暖灯光下的餐桌或厨房台面');
      parts.push('中景建立镜头，柔光布光，背景适度虚化营造食欲氛围');
      break;

    case 'action':
    case 'hero':
      parts.push(`【美食全景】${foodName}${anchorStr ? `（${anchorStr}）` : ''}的完整摆盘呈现`);
      parts.push('45度俯角或平视角度，展示整体摆盘艺术和色彩搭配');
      parts.push('缓慢环绕或定点微幅旋转，让观众全方位欣赏');
      break;

    case 'closeup':
    case 'texture':
      parts.push(`【质感特写】${foodName}的核心口感线索`);
      const textureHints = [
        '食材表面的光泽和油润感，热气微微升腾',
        '切开后内部的层次结构，汁水充盈的截面',
        '酱汁流淌的粘稠质感和挂壁效果',
        '烘焙食品的金黄酥脆表皮裂纹',
        '新鲜食材的水润透亮质感',
        '巧克力融化时的丝滑流动',
      ];
      parts.push(textureHints[shotIndex % textureHints.length]);
      parts.push('极端近景或微距，侧逆光强化质感，可能伴随蒸汽/滴落等动态');
      break;

    case 'transition':
      parts.push(`【制作/享用瞬间】${foodName}的动态呈现`);
      parts.push('倒酱汁、撒配料、切开、夹起等动作的慢动作捕捉');
      parts.push('高速摄影或慢动作，强调食物的诱人动态');
      break;

    case 'closing':
    case 'presentation':
      parts.push(`【最终呈现】${foodName}的完美状态定格`);
      parts.push('最佳角度和光线组合，可能是俯拍完整摆盘或侧拍剖面');
      parts.push('画面稳定，留白适当，引发观众食欲和向往');
      break;
  }

  parts.push(getQualitySuffix(duration));
  return parts.join('。');
}

/**
 * 剧情/故事场景分镜策略
 * 节奏：场景交代 → 角色互动 → 情节推进 → 高潮/转折 → 收尾
 */
function buildDramaShot(ctx: SceneShotContext): string {
  const { entities, anchors, phaseInfo, shotIndex, totalShots, duration } = ctx;
  const subject = buildSubjectDefinition(entities.subject, ctx.originalPrompt, 'indoor_home');
  const location = entities.location || '故事发生的场景空间';
  const emotion = entities.emotion || '';
  const action = entities.action || '';

  const parts: string[] = [];

  switch (phaseInfo.shotType) {
    case 'establishing':
      parts.push(`【场景交代】${location}的环境全貌`);
      parts.push(emotion ? `笼罩着${emotion}的氛围基调` : '奠定故事的时空背景');
      parts.push('广角或全景建立镜头，可能包含暗示情节的环境细节');
      break;

    case 'action':
      parts.push(`【角色互动】${subject}${action ? `正在${action}` : '处于场景中的关键位置'}`);
      parts.push('中景双人或多人构图，捕捉人物关系和互动张力');
      parts.push('过肩镜头或对称构图，强调人物之间的联系或对立');
      break;

    case 'closeup':
      parts.push(`【情感表达】${subject}的内心世界外化`);
      parts.push(emotion ? `${emotion}的情绪通过微表情和肢体语言传达` : '细微的表情变化传递潜台词');
      parts.push('面部特写或手部特写，浅景深隔离环境干扰');
      break;

    case 'transition':
      parts.push(`【情节转折】叙事节奏的变化点`);
      parts.push('新的信息揭示、意外事件、或视角切换');
      parts.push('荷兰角、快速剪辑预备镜头、或象征性空镜头');
      break;

    case 'climax':
      parts.push(`【情绪高潮】${emotion || '故事'}的最强张力时刻`);
      parts.push('情感或冲突达到顶点的决定性瞬间');
      parts.push('极近特写或剧烈运动镜头，配合节奏变化');
      break;

    case 'closing':
      parts.push(`【故事收尾】开放或封闭式的结局画面`);
      parts.push(emotion ? `留下${emotion}的余韵` : '给观众回味的空间');
      parts.push('拉远至环境、人物背影、或具有象征意义的定格画面');
      break;
  }

  parts.push(getQualitySuffix(duration));
  return parts.join('。');
}

/**
 * 抽象/艺术场景分镜策略
 * 节奏：初始形态 → 变化过程 → 细节展开 → 最终状态
 */
function buildAbstractShot(ctx: SceneShotContext): string {
  const { entities, anchors, phaseInfo, shotIndex, duration } = ctx;
  const abstractSubject = entities.subject !== '人物' ? entities.subject : '抽象形态';
  const anchorStr = anchors.map(a => a.element).join('、');

  const parts: string[] = [];

  switch (phaseInfo.shotType) {
    case 'establishing':
      parts.push(`【初始形态】${abstractSubject}的起始状态`);
      parts.push(anchorStr ? `以${anchorStr}为基底` : '纯净或有序的基础状态');
      parts.push('完整的形态展示，明确的几何或有机结构');
      break;

    case 'action':
      parts.push(`【变化过程】${abstractSubject}开始演变`);
      parts.push('形态扭曲、分裂、融合、生长或消解的动态过程');
      parts.push('流畅的运动轨迹，可能伴随颜色或纹理的变化');
      break;

    case 'closeup':
      parts.push(`【细节展开】${abstractSubject}的微观结构`);
      const abstractDetails = [
        '粒子级别的细节涌现，无数微小单元的自组织行为',
        '流体表面的复杂纹路和涡旋结构',
        '光线穿透半透明材质时的折射和散射',
        '几何图形的无限细分和分形递归',
        '色彩渐变的微妙过渡和混合边界',
      ];
      parts.push(abstractDetails[shotIndex % abstractDetails.length]);
      parts.push('极端放大或特殊光学效果，探索视觉边界');
      break;

    case 'transition':
      parts.push(`【形态转换】${abstractSubject}的结构性变化`);
      parts.push('从一个稳定态跃迁到另一个稳定态的临界瞬间');
      parts.push('最大变化的时刻，能量释放或重组');
      break;

    case 'closing':
      parts.push(`【最终状态】${abstractSubject}的完成形态`);
      parts.push(anchorStr ? `回归或升华为包含${anchorStr}的终极形态` : '演化的终点或新的平衡态');
      parts.push('稳定而有力的最终画面，可能带有循环或无限延伸的暗示');
      break;
  }

  parts.push(getQualitySuffix(duration));
  return parts.join('。');
}

/**
 * 室内/家居场景分镜策略
 * 节奏：空间全貌 → 功能区域 → 设计细节 → 氛围呈现
 */
function buildInteriorShot(ctx: SceneShotContext): string {
  const { entities, anchors, phaseInfo, shotIndex, duration } = ctx;
  const spaceDesc = entities.location || '精心设计的室内空间';
  const styleAnchor = anchors.find(a => a.category === 'style');
  const anchorStr = anchors.filter(a => a.category !== 'style').map(a => a.element).join('、');

  const parts: string[] = [];

  switch (phaseInfo.shotType) {
    case 'establishing':
      parts.push(`【空间全貌】${spaceDesc}的整体布局`);
      parts.push(styleAnchor ? `${styleAnchor.element}风格的室内设计` : '协调统一的室内设计风格');
      parts.push('广角或门口透视角度，展示空间的纵深和动线');
      break;

    case 'action':
      parts.push(`【功能区域】${spaceDesc}的核心功能区`);
      const areaHints = ['客厅会客区与休闲布局', '厨房操作区的流线设计', '卧室休息区的舒适配置', '书房工作区的功能布置', '餐厅用餐区的氛围营造'];
      parts.push(areaHints[shotIndex % areaHints.length]);
      parts.push('中景展示人与空间的互动关系，生活气息自然流露');
      break;

    case 'closeup':
      parts.push(`【设计细节】${spaceDesc}的材料与工艺亮点`);
      const detailHints = [
        anchorStr ? `${anchorStr}的材质拼接与收口工艺` : '家具的材质触感和五金配件细节',
        '软装的织物纹理和色彩搭配层次',
        '照明灯具的设计语言和光影投射效果',
        '装饰艺术品与空间的比例关系',
        '窗框门框等建筑细节的处理手法',
      ];
      parts.push(detailHints[shotIndex % detailHints.length]);
      parts.push('近景或特写，浅景深突出工艺品质');
      break;

    case 'transition':
      parts.push(`【空间流转】${spaceDesc}的区域间过渡`);
      parts.push('走廊、通道、或开放式隔断的空间衔接处理');
      parts.push('跟随视线的自然转移，体现设计的流动性');
      break;

    case 'closing':
      parts.push(`【氛围呈现】${spaceDesc}的整体意境`);
      parts.push(styleAnchor ? `充分体现${styleAnchor.element}的生活美学` : '传递出居住者的品味和生活态度');
      parts.push(entities.timeOfDay ? `${entities.timeOfDay}的自然光线` : '温暖的人工照明');
      parts.push('缓缓拉远或最具代表性的角度定格');
      break;
  }

  parts.push(getQualitySuffix(duration));
  return parts.join('。');
}

// ============================================================
// ★ v4.0 字幕与旁白内容生成引擎
// ============================================================
//
// 核心思路：
// - 字幕：每个镜头生成1-2句精炼字幕文本（画面描述的精简版，适合屏幕显示）
// - 旁白：连贯的解说/叙事脚本（适合TTS语音合成）
// - 根据场景类型(product/drama/landscape等)采用不同的文案风格
//

/**
 * 根据分镜结果生成字幕建议和旁白脚本
 */
// ============================================================
// 场景策略分发器
// ============================================================

/** 场景类型 → 策略函数映射 */
export const SCENE_SHOT_STRATEGIES: Record<string, (ctx: SceneShotContext) => string> = {
  product: buildProductShot,
  portrait: buildPortraitShot,
  landscape: buildLandscapeShot,
  food: buildFoodShot,
  drama: buildDramaShot,
  abstract: buildAbstractShot,
  interior: buildInteriorShot,
};
