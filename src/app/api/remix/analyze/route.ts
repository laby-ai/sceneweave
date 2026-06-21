import { NextRequest, NextResponse } from 'next/server';
import { cozeChat, type MultimodalMessage } from '@/lib/coze-api';

/**
 * 二创自定义要求分析 API
 * 用户输入任意创作要求，AI分析后返回：推荐方案、策略、增强提示词、保留元素、参考策略
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requirement, imageUrl, currentPreset } = body as {
      requirement: string;
      imageUrl?: string;
      currentPreset?: string;
    };

    if (!requirement?.trim()) {
      return NextResponse.json({ error: '请输入创作要求' }, { status: 400 });
    }

    const systemPrompt = `你是一位专业的AI二创策略师，精通影视、绘画、设计、非遗文化等领域。
用户会给你一段创作要求，你需要分析这个要求并给出最佳实现方案。

你的回复必须是严格JSON格式（不要用markdown代码块包裹），包含以下字段：
{
  "approach": "方案名称（简短4-6字）",
  "approachDescription": "方案简要说明（一句话）",
  "strategy": "reference" | "reinterpret" | "none",
  "promptPrefix": "提示词前缀（描述风格/方向/约束，50字以内）",
  "promptSuffix": "提示词后缀（品质/细节要求，30字以内）",
  "preserveElements": ["character", "scene", "composition", "mood", "color"],
  "negativePrompt": "反向提示词（避免出现的内容，30字以内）",
  "sceneType": "portrait" | "landscape" | "cinematic" | "fantasy" | "drama" | "abstract" | "architecture",
  "suggestedStyle": "推荐画风（如：工笔重彩/水彩写意/赛博朋克/极简线稿 等）",
  "detailSuggestions": ["具体建议1", "具体建议2", "具体建议3"],
  "confidence": 0.8
}

approach常用方案名称（请根据用户意图选择最匹配的）：
- 设计还原：将照片/实物还原为设计图纸（技术制图/三视图/线稿），严禁在图中生成任何文字
- 文化解读：对图片中文化元素进行标注和解读（如非遗妆面/服饰纹样/传统工艺），不改变原图
- 风格迁移：保持构图和主体，改变画风/色调/风格
- 跨界融合：将不同风格元素混合创作
- 细节展示：放大/特写展示局部细节
- 年代考证：分析年代特征并进行历史还原
- 自由创作：无特定方向，按用户描述自由发挥

strategy说明：
- reference: 需要高度保持原图视觉特征（如：还原、保持、一致、复刻、标注、解读）→ 适用于"设计还原"和"文化解读"
- reinterpret: 需要创意变异但保留核心元素（如：二创、改编、融合、重新设计）
- none: 全新创作，不依赖参考图（如：灵感、想象、原创）

preserveElements可选值：character(角色), scene(场景), composition(构图), mood(氛围), color(色彩)
sceneType: portrait(人像), landscape(风景), cinematic(电影感), fantasy(奇幻), drama(戏剧), abstract(抽象), architecture(建筑)

分析用户要求时，要考虑：
1. 用户想改变什么？想保留什么？
2. 最佳的创作策略是什么？
3. 需要什么样的提示词才能实现？
4. 有哪些专业建议可以提升效果？`;

    const userContent = `我的创作要求是：${requirement}${currentPreset ? `\n当前已选预设：${currentPreset}` : ''}${imageUrl ? '\n（已上传参考图片）' : ''}\n\n请分析我的要求并给出最佳二创方案。`;

    const userMessages: MultimodalMessage[] = [
      { role: 'user' as const, content: userContent },
    ];

    let analysisResult: Record<string, unknown>;
    try {
      const result = await cozeChat([
        { role: 'system' as const, content: systemPrompt },
        ...userMessages,
      ], { temperature: 0.3 });

      let content = result.content?.trim() || '';

      // 提取JSON（可能被markdown代码块包裹）
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        content = jsonMatch[1].trim();
      }

      analysisResult = JSON.parse(content);
    } catch {
      // AI不可用时，基于关键词分析给出方案
      analysisResult = generateFallbackAnalysis(requirement);
    }

    // 确保必要字段存在
    const result = {
      approach: (analysisResult.approach as string) || '自由创作',
      approachDescription: (analysisResult.approachDescription as string) || '根据您的要求进行创作',
      strategy: (['reference', 'reinterpret', 'none'].includes(analysisResult.strategy as string)
        ? analysisResult.strategy : 'reinterpret') as string,
      promptPrefix: (analysisResult.promptPrefix as string) || '',
      promptSuffix: (analysisResult.promptSuffix as string) || '',
      preserveElements: Array.isArray(analysisResult.preserveElements)
        ? analysisResult.preserveElements as string[]
        : ['character', 'composition'],
      negativePrompt: (analysisResult.negativePrompt as string) || '',
      sceneType: (analysisResult.sceneType as string) || 'cinematic',
      suggestedStyle: (analysisResult.suggestedStyle as string) || '',
      detailSuggestions: Array.isArray(analysisResult.detailSuggestions)
        ? analysisResult.detailSuggestions as string[]
        : [],
      confidence: typeof analysisResult.confidence === 'number' ? analysisResult.confidence : 0.7,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Remix Analyze] error:', error);
    return NextResponse.json(
      { error: '分析失败，请稍后重试' },
      { status: 500 }
    );
  }
}

/** 基于关键词的降级分析 */
function generateFallbackAnalysis(requirement: string): Record<string, unknown> {
  const text = requirement.toLowerCase();

  // 检测策略意图
  let strategy = 'reinterpret';
  if (/还原|保持|一致|复刻|忠于|忠于原作|高度相似|标注|解读|拆解|结构图|设计图|图纸/.test(text)) {
    strategy = 'reference';
  } else if (/原创|全新|想象|灵感|从零|自主创新/.test(text)) {
    strategy = 'none';
  }

  // 检测保留元素
  const preserveElements: string[] = [];
  if (/角色|人物|脸|五官|表情|姿态|动作|服装|妆|发型/.test(text)) preserveElements.push('character');
  if (/场景|背景|环境|地点|建筑|山水|天空/.test(text)) preserveElements.push('scene');
  if (/构图|角度|视角|布局|位置|远近/.test(text)) preserveElements.push('composition');
  if (/氛围|情绪|光影|意境|感觉|气质/.test(text)) preserveElements.push('mood');
  if (/色彩|颜色|色调|配色|色系|暖色|冷色/.test(text)) preserveElements.push('color');
  if (preserveElements.length === 0) preserveElements.push('character', 'composition');

  // 检测场景类型
  let sceneType = 'cinematic';
  if (/人像|肖像|面部|全身|半身|人物/.test(text)) sceneType = 'portrait';
  else if (/风景|山水|自然|天空|海洋|草原/.test(text)) sceneType = 'landscape';
  else if (/奇幻|仙侠|神话|魔法|异世界/.test(text)) sceneType = 'fantasy';
  else if (/戏剧|舞台|戏曲|话剧|表演/.test(text)) sceneType = 'drama';
  else if (/建筑|室内|空间|设计图|图纸/.test(text)) sceneType = 'architecture';
  else if (/抽象|意境|意象|概念/.test(text)) sceneType = 'abstract';

  // 检测画风
  let suggestedStyle = '';
  const styleMap: [RegExp, string][] = [
    [/工笔|细腻|精细|白描/, '工笔重彩'],
    [/水彩|写意|淡彩|渲染/, '水彩写意'],
    [/水墨|国画|笔墨|丹青/, '水墨丹青'],
    [/赛博|科技|未来|机械/, '赛博朋克'],
    [/日漫|二次元|动漫|漫画/, '日系动漫'],
    [/油画|古典|写实|学院/, '古典油画'],
    [/极简|线稿|素描|速写/, '极简线稿'],
    [/国风|古风|传统|东方/, '东方国风'],
    [/蒸汽朋克|维多利亚|机械/, '蒸汽朋克'],
    [/波普|鲜艳|撞色|潮流/, '波普艺术'],
  ];
  for (const [regex, style] of styleMap) {
    if (regex.test(text)) { suggestedStyle = style; break; }
  }

  // 推荐方案名称
  let approach = '自由创作';
  if (/设计图|图纸|还原.*设计|结构图|拆解|工艺图|三视图|多视图|蓝图|制图/.test(text)) approach = '设计还原';
  else if (/标注|解读|文化|非遗|传统|妆面|纹样|发饰|工艺说明/.test(text)) approach = '文化解读';
  else if (/换装|换风格|换色调|改/.test(text)) approach = '风格迁移';
  else if (/融合|混搭|结合|嫁接/.test(text)) approach = '跨界融合';
  else if (/放大|细节|特写|微观|材质/.test(text)) approach = '细节展示';
  else if (/年代|朝代|历史|古|考/.test(text)) approach = '年代考证';

  return {
    approach,
    approachDescription: `基于您的"${requirement.slice(0, 20)}"要求，采用${approach}方案`,
    strategy,
    promptPrefix: approach === '设计还原'
      ? '将照片还原为专业设计图纸，保留所有结构和细节，NO text in image'
      : approach === '文化解读'
      ? '对图片中文化元素进行专业标注解读，不改变原图'
      : `${approach}风格创作，${suggestedStyle ? `采用${suggestedStyle}画风，` : ''}精细呈现`,
    promptSuffix: approach === '设计还原'
      ? '专业级技术制图，精确比例，无文字标注'
      : approach === '文化解读'
      ? '专业解读，详尽标注'
      : '高品质细节，专业级输出',
    preserveElements: approach === '设计还原' || approach === '文化解读'
      ? ['character', 'composition', 'scene', 'color']
      : preserveElements,
    negativePrompt: approach === '设计还原'
      ? 'text, letters, characters, writing, 模糊,变形,缺失元素'
      : approach === '文化解读'
      ? '改变原图,模糊,变形'
      : '低质量,模糊,变形',
    sceneType,
    suggestedStyle,
    detailSuggestions: approach === '设计还原'
      ? ['设计图纸将保留原图所有视觉元素和构图', '尺寸标注可通过标注工具后期添加', '推荐使用古典标注样式配合设计图']
      : approach === '文化解读'
      ? ['标注将自动识别图片中的文化元素', '可切换古典/现代标注样式', '支持手动添加自定义标注']
      : [
        '建议上传高质量参考图以获得更好的效果',
        '详细描述您想改变和保留的部分，效果更精准',
        '可以尝试多种方案对比选择最佳效果',
      ],
    confidence: 0.6,
  };
}
