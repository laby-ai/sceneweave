import { NextRequest, NextResponse } from 'next/server';
// LLMClient 使用动态导入以避免 RSC 环境下的 React Class Component 兼容性问题

// ============================================================
// 场景类型
// ============================================================
type SceneType = 'portrait' | 'product' | 'landscape' | 'food' | 'drama' | 'abstract' | 'interior';
type ElementKey = 'character' | 'scene' | 'composition' | 'atmosphere' | 'color';

// ============================================================
// 按构图/视角类型生成附加指令
// ============================================================

type Composition = 'panoramic' | 'medium' | 'closeup' | 'aerial' | 'lowangle' | 'fisheye';

function getCompositionInstruction(composition: Composition): string {
  switch (composition) {
    case 'panoramic':
      return '【视角要求】采用融入场景的全景构图：画面应呈现真实的现场体验感，观者仿佛身临其境站在场景之中。主体人物占画面1/4到1/3，既展现周围环境氛围又不失主体存在感，前景、中景、远景层次分明，重点刻画场景中的光影、色彩和情绪氛围，避免过于空旷或纯远景。';
    case 'medium':
      return '【视角要求】使用中景构图：人物/主体占画面1/3到1/2，兼顾主体细节与周围环境，呈现自然的观察距离感。';
    case 'closeup':
      return '【视角要求】使用特写/近景构图：聚焦主体细节，突出面部表情、纹理质感或局部动作，背景虚化或简化。';
    case 'aerial':
      return '【视角要求】使用俯瞰/鸟瞰视角：从高处向下俯视，展现地面布局、人群分布或物体的俯视图案感。';
    case 'lowangle':
      return '【视角要求】使用仰视/低角度视角：从低处向上仰拍，主体显得高大威严，天空或建筑顶部成为背景，增强气势感。';
    case 'fisheye':
      return '【视角要求】使用鱼眼/超广角视角：画面边缘产生球形畸变，中心区域正常、边缘弯曲拉伸，营造超现实沉浸感。';
    default:
      return '';
  }
}

// ============================================================
// 按场景类型生成差异化增强 Prompt
// ============================================================

// 视角/构图指令映射

const COMPOSITION_INSTRUCTIONS: Record<Composition, string> = {
  panoramic: '采用宏观全景视角，展现广阔壮观的场景全貌，强调规模感和宏大感，人物在画面中较小，环境占主导。',
  medium: '采用中景视角，主体与环境均衡呈现，既能看清人物/物体细节，又能感受周围氛围。',
  closeup: '采用特写/近景视角，聚焦于局部细节，虚化背景，强调质感和微表情。',
  aerial: '采用俯瞰/上帝视角，从高处向下俯视，展现全局布局和空间关系。',
  lowangle: '采用仰视/低角度，从下方向上看，强调主体的力量感和威严感。',
  fisheye: '采用鱼眼/超广角，画面边缘变形产生视觉冲击力，营造戏剧化效果。',
};

function getEnhanceSystemPrompt(sceneType: SceneType, composition?: Composition, text?: string, creativeIntent?: 'reinterpret' | 'reference', preserveElements?: ElementKey[]): string {
  let basePrompt: string;
  switch (sceneType) {
    case 'product':
      basePrompt = `你是一个专业的产品描述增强助手。用户提供了产品的简短描述，你需要将其扩展为适合AI视频生成的详细产品视觉描述。

扩展要求：
1. 产品材质与工艺：明确材质（金属/玻璃/陶瓷/皮革/塑料等）和表面处理（哑光/镜面/拉丝/磨砂）
2. 颜色与外观：精确的颜色名称和视觉效果
3. 尺寸比例感：给出相对比例暗示（如"掌心大小"、"桌面占据1/3空间"）
4. 关键特征亮点：产品最具辨识度的视觉特征
5. 光线交互效果：材质在光线下的反射、折射、透光特性
6. 状态与摆放：产品的当前状态和摆放姿态

输出格式：直接返回增强后的详细描述文本，不要有前缀或解释。200字以内。`;
      break;

    case 'food':
      basePrompt = `你是一个专业的美食描述增强助手。将简短的食物描述扩展为具有视觉诱惑力的美食视频提示词。

扩展要求：
1. 食材新鲜度暗示：色泽、光泽、纹理
2. 温度感知：热气、冰霜、水珠等温度信号
3. 质地口感暗示：酥脆/绵密/顺滑/Q弹的视觉表现
4. 摆盘美学：餐具搭配、装饰元素、构图美感
5. 光影食欲感：暖色调、逆光透射、柔和阴影

输出格式：直接返回增强后的详细描述文本，200字以内。`;
      break;

    case 'landscape':
      basePrompt = `你是一个专业的风景描述增强助手。将简短的景观描述扩展为富有画面感的自然风光视频提示词。

扩展要求：
1. 地理特征细节：具体的地形地貌、植被类型
2. 时间氛围：精确的时间点（日出黄金时刻/正午强光/黄昏魔幻时刻）
3. 天气与光线：云层状态、光线方向和色温
4. 动态元素：风/水/云的运动状态
5. 色彩层次：前景中景背景的色彩渐变

输出格式：直接返回增强后的详细描述文本，200字以内。`;
      break;

    case 'drama':
      basePrompt = `你是一个专业的影视场景描述增强助手，尤其擅长东方奇幻、仙侠、古风场景。用户提供了简短的场景描述，你需要将其扩展为更具画面感和戏剧张力的描述，用于AI图像/视频生成。

扩展要求：
1. 场景氛围：描述环境的宏大或幽深感，天象、气象、光线等自然元素
2. 人物状态：表情、动作、服装飘动、发丝飞扬等动态细节
3. 东方美学：融入云雾、仙气、灵光、花瓣飘散等仙侠古风视觉元素
4. 色彩意境：用"苍青""霜白""赤金"等东方色彩描述
5. 戏剧张力：突出动作的关键瞬间，营造身临其境的紧迫感或悲壮感
6. 保持核心含义不变，让描述更加丰富、具象、有画面冲击力

输出格式：直接返回增强后的详细描述文本，不要有任何前缀或解释。200-300字之间。`;
      break;

    default:
      // portrait / abstract / interior — 使用通用增强逻辑
      basePrompt = `你是一个专业的视频描述增强助手。用户提供了简短的核心主体描述，你需要将其扩展为更详细、更具画面感的描述，用于AI视频生成。

扩展要求：
1. 增加外貌细节：年龄、发型、服装、姿态等具体信息
2. 增加环境信息：周围环境、光线条件、氛围营造
3. 增加动态暗示：可能的动作或状态变化
4. 保持核心含义不变，只是让描述更加丰富和具象化

输出格式：直接返回增强后的详细描述文本，不要有任何前缀或解释。150-250字之间。`;
      break;
  }

  // 附加视角/构图指令
  if (composition && COMPOSITION_INSTRUCTIONS[composition]) {
    basePrompt += `\n\n视角要求：${COMPOSITION_INSTRUCTIONS[composition]}`;
  }

  // 如果用户输入包含参考图片内容，增加联合创作指令
  if (text && text.includes('【参考图片内容】')) {
    if (creativeIntent === 'reinterpret') {
      basePrompt += `\n\n特别说明：用户输入中包含【参考图片内容】和【创作需求】两部分。用户希望基于参考图片进行创意重诠释（二创），而非简单复制。请提取参考图片的核心视觉元素（主体、场景、氛围），然后用全新的构图、色彩、风格或视角重新演绎。生成结果应该是一幅有明显创意变化的新作品，而非对原图的还原或微调。确保画面与参考图片有显著差异，但保留核心主体的辨识度。`;
    } else {
      basePrompt += `\n\n特别说明：用户输入中包含【参考图片内容】和【创作需求】两部分。请基于参考图片的视觉内容（风格、色调、构图、主体等）结合用户的创作需求，生成一幅既保留参考图片核心视觉特征又融入创作需求的新作品描述。保持参考图片的氛围和风格基调，同时自然地融入用户要求的创作元素。`;
    }
  }

  // 保留元素硬约束注入
  if (preserveElements && preserveElements.length > 0) {
    const labels: Record<ElementKey, string> = {
      character: '角色外貌与服饰',
      scene: '场景与背景环境',
      composition: '画面构图与视角',
      atmosphere: '光影氛围与情绪',
      color: '主色调与配色方案',
    };
    const features: Record<ElementKey, string> = {
      character: '角色的面部特征、发型、服装款式、饰品、体型比例',
      scene: '场景的空间结构、建筑/自然元素、标志性环境物体',
      composition: '主体的位置、大小比例、前景/中景/远景层次',
      atmosphere: '光线的方向、色温、明暗对比、情绪基调',
      color: '画面的主色、辅助色、高光色、阴影色',
    };
    const negatives: Record<ElementKey, string> = {
      character: '不得改变角色的种族、性别、年龄、核心服饰',
      scene: '不得将室内变室外、城市变荒野',
      composition: '不得改变景别或视角、不得移动主体位置',
      atmosphere: '不得反转情绪基调',
      color: '不得反转色温或大幅改变饱和度',
    };
    const items = preserveElements.map(k => labels[k]);
    const featureList = preserveElements.map(k => features[k]);
    const negativeList = preserveElements.map(k => negatives[k]);
    basePrompt += `\n\n【硬性保留约束】用户明确要求必须保留以下元素：${items.join('、')}。
具体特征：${featureList.join('；')}。
禁止改变：${negativeList.join('；')}。
在增强描述时，你必须将这些保留约束作为最高优先级，确保增强后的描述文本中明确包含这些保留指令。任何创意变化都不得违反上述保留约束。`;
  }

  return basePrompt;
}

// ============================================================
// API 入口
// ============================================================

export async function POST(request: NextRequest) {
  // 动态导入 LLMClient（避免 RSC 兼容性问题）— 放在函数作用域使 catch 块可访问 APIError
  const { LLMClient, Config, HeaderUtils, APIError } = await import('coze-coding-dev-sdk');

  try {
    const body = await request.json();
    const { 
      text,
      sceneType = 'portrait' as SceneType,  // ★ 新增：场景类型参数
      composition,  // ★ 新增：构图/视角参数
      creativeIntent,  // ★ 新增：创作意图参数
      preserveElements,  // ★ 新增：保留元素列表
    } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: '请提供需要增强的文本内容' },
        { status: 400 }
      );
    }

    if (text.length < 2) {
      return NextResponse.json(
        { error: '文本内容太短，至少需要2个字符' },
        { status: 400 }
      );
    }

    if (text.length > 2000) {
      return NextResponse.json(
        { error: '文本内容过长，最多支持2000个字符' },
        { status: 400 }
      );
    }

    // 验证 sceneType
    const validScenes: SceneType[] = ['portrait', 'product', 'landscape', 'food', 'drama', 'abstract', 'interior'];
    if (!validScenes.includes(sceneType)) {
      return NextResponse.json(
        { error: `无效的场景类型: ${sceneType}` },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // ★ 核心改进：根据场景类型使用差异化的 System Prompt
    const systemPrompt = getEnhanceSystemPrompt(sceneType, composition, text, creativeIntent, preserveElements);

      console.log(`[Enhance] sceneType=${sceneType}, composition=${composition || 'auto'}, text="${text.substring(0, 50)}"`);

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: text },
      ];

      const response = await client.invoke(messages, {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.7,
      });

      const enhancedText = response.content.trim();

      return NextResponse.json({
        success: true,
        originalText: text,
        enhancedText,
        sceneType,
      });
    } catch (error: unknown) {
      console.error('[Enhance] 错误:', error);

      if (error instanceof APIError) {
        return NextResponse.json(
          { error: `AI 服务错误: ${error.message}` },
          { status: error.statusCode || 500 }
        );
      }

      return NextResponse.json(
        { error: '服务器错误，请稍后重试' },
        { status: 500 }
      );
    }
}
