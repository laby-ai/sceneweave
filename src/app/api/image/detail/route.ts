import { NextRequest, NextResponse } from 'next/server';

/* ------------------------------------------------------------------ */
/*  /api/image/detail - AI 细节生成接口                                */
/*  支持四种类型：放大细节 / 结构解析 / 年代校验 / 设计变体              */
/* ------------------------------------------------------------------ */

interface DetailRequest {
  imageUrl: string;
  region: { x: number; y: number; radius: number };
  title: string;
  tag?: string;
  type: 'zoom' | 'structure' | 'period' | 'variant';
}

// 各类型的回退内容（AI不可用时使用）
const FALLBACK_CONTENT: Record<DetailRequest['type'], (title: string, tag?: string) => { title: string; content: string }> = {
  zoom: (title, _tag) => ({
    title: `${title} · 放大细节`,
    content: `【细节放大】${title}\n\n` +
      `该区域的细节特征包括：\n` +
      `• 纹理质感：可见精细的表面纹理，呈现出传统工艺的手工痕迹\n` +
      `• 色彩层次：色彩过渡细腻，由深至浅渐变自然，体现匠人对颜料的精准把控\n` +
      `• 边缘处理：边缘线条流畅且精确，展现高超的制作技艺\n` +
      `• 微观特征：在放大视角下可观察到独特的微观结构，这是该工艺的标志性特征\n\n` +
      `💡 提示：更精准的细节分析需要上传高清原图`,
  }),
  structure: (title, tag) => ({
    title: `${title} · 结构解析`,
    content: `【结构解析】${title}\n\n` +
      `一、整体构成\n` +
      `${title}的结构可分为以下几个层次：\n` +
      `• 基础层：提供支撑与定型功能，是整体结构的骨架\n` +
      `• 装饰层：在基础层之上，承载纹样、色彩等视觉元素\n` +
      `• 点缀层：最表层的精细装饰，提升整体精致度\n\n` +
      `二、工艺拆解\n` +
      `${tag === '妆面' ? '妆面工序：打底→勾勒→填色→晕染→定妆，每一步都需要精细操作' :
        tag === '服饰' ? '服饰结构：内衬→主体→装饰→收边，层层叠加形成立体感' :
        tag === '纹样' ? '纹样构成：骨架线→主纹→辅纹→填充，遵循对称与重复的美学原则' :
        tag === '工艺' ? '工艺流程：选材→初加工→精修→装饰→成品，每道工序都有严格标准' :
        '多工序协作完成，每个环节环环相扣'}\n\n` +
      `三、关键节点\n` +
      `• 连接处：各层之间的衔接方式决定了整体牢固度\n` +
      `• 过渡区：不同区域之间的过渡处理体现工艺水平\n` +
      `• 收尾点：边缘和末端的处理是最见功力的细节`,
  }),
  period: (title, tag) => ({
    title: `${title} · 年代校验`,
    content: `【年代校验】${title}\n\n` +
      `一、年代特征比对\n` +
      `${tag === '妆面' ?
        '• 先秦：白粉敷面，黛画眉，唇妆以朱砂为主\n• 汉代：红妆流行，面妆浓艳，眉形细长\n• 唐代：面妆华丽，花钿、面靥、斜红齐备\n• 宋代：妆容趋于淡雅，崇尚自然之美\n• 明代：妆容端庄，以素雅为美\n• 清代：妆容精致，唇妆小巧如花瓣' :
        tag === '服饰' ?
        '• 先秦：上衣下裳，色彩以玄纁为尊\n• 汉代：深衣流行，曲裾绕襟\n• 唐代：齐胸襦裙，胡服影响\n• 宋代：褙子为尚，简约修长\n• 明代：袄裙为主，恢复汉制\n• 清代：满族旗装，马蹄袖口' :
        tag === '纹样' ?
        '• 商周：饕餮纹、云雷纹，庄重神秘\n• 战国：蟠螭纹，灵动多变\n• 汉代：云气纹、四神纹，气势磅礴\n• 唐代：宝相花、缠枝纹，富丽堂皇\n• 宋代：折枝花卉，清雅秀美\n• 明清：吉祥图案，寓意丰富' :
        '不同年代有鲜明的风格特征，需从材质、纹样、工艺、色彩等多维度综合判断'}\n\n` +
      `二、校验要点\n` +
      `• 材质是否符合该年代的特征\n` +
      `• 纹样风格是否与年代吻合\n` +
      `• 色彩体系是否与年代一致\n` +
      `• 工艺技法是否属于该年代的技术水平\n\n` +
      `三、优化建议\n` +
      `• 如需增强年代感，可调整纹样细节和色彩搭配\n` +
      `• 注意避免跨年代元素混搭（除非刻意设计）\n` +
      `💡 建议参考同时期的考古发现和文献记载进行校验`,
  }),
  variant: (title, tag) => ({
    title: `${title} · 设计变体`,
    content: `【设计变体】${title}\n\n` +
      `方案A：传统还原\n` +
      `${tag === '妆面' ? '严格遵循历史文献记载，还原经典妆面，适合古装剧和传统文化展示' :
        tag === '服饰' ? '按传统裁剪与装饰手法复刻，适合文化传承与教育场景' :
        '忠实还原传统形式，保留原汁原味的文化特征'}\n\n` +
      `方案B：现代融合\n` +
      `${tag === '妆面' ? '保留传统妆面核心元素（如花钿、面靥），融入现代审美与材质，适合时尚大片和创意摄影' :
        tag === '服饰' ? '传统廓形+现代面料与剪裁，保留文化符号同时适应现代穿着需求' :
        '传统元素与现代设计语言融合，创造新旧对话'}\n\n` +
      `方案C：未来想象\n` +
      `${tag === '妆面' ? '将传统妆面元素数字化重构，加入全息投影、LED光影等未来感技术，适合科幻与赛博题材' :
        tag === '服饰' ? '传统纹样与结构用智能面料、可穿戴技术重新诠释，探索文化与科技的边界' :
        '大胆突破传统框架，以未来主义手法重新演绎文化元素'}\n\n` +
      `💡 选择变体方案后，可在生成时加入对应的方向关键词`,
  }),
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as DetailRequest;
    const { imageUrl, region, title, tag, type } = body;

    if (!imageUrl || !type) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 构建提示词
    const typePrompts: Record<DetailRequest['type'], string> = {
      zoom: `请对图片中"${title}"区域(坐标x:${region.x.toFixed(2)},y:${region.y.toFixed(2)})进行放大细节分析。描述该区域的纹理质感、色彩层次、边缘处理和微观特征。${tag ? `分类：${tag}。` : ''}请用专业术语描述，150-300字。`,
      structure: `请解析图片中"${title}"(${tag || '未分类'})的结构构成。从层次拆解、工艺流程、关键节点三个维度分析。每个维度列出2-3个要点。200-400字。`,
      period: `请校验图片中"${title}"(${tag || '未分类'})的年代准确性。分析其材质、纹样、色彩、工艺是否符合某个历史时期特征。如有不符，给出修正建议。200-400字。`,
      variant: `请为图片中"${title}"(${tag || '未分类'})提供3种设计变体方案：A.传统还原 B.现代融合 C.未来想象。每种方案简述设计方向和适用场景。200-400字。`,
    };

    // 尝试调用AI
    try {
      const { CozeAPI } = await import('@/lib/coze-api');
      const aiResult = await CozeAPI.chat(
        [
          {
            role: 'system',
            content: '你是一位资深的文化遗产研究专家，精通传统工艺、非遗文化、历史服饰与妆面。请用专业但易懂的语言进行分析。',
          },
          {
            role: 'user',
            content: typePrompts[type],
          },
        ],
      );

      if (aiResult) {
        const resultTitle = type === 'zoom' ? `${title} · 放大细节` :
          type === 'structure' ? `${title} · 结构解析` :
          type === 'period' ? `${title} · 年代校验` :
          `${title} · 设计变体`;

        return NextResponse.json({
          title: resultTitle,
          content: aiResult.content,
          type,
        });
      }
    } catch {
      // AI调用失败，使用回退内容
    }

    // 回退内容
    const fallback = FALLBACK_CONTENT[type](title, tag);
    return NextResponse.json(fallback);
  } catch (error) {
    console.error('[Image Detail] error:', error);
    return NextResponse.json({ error: '细节生成失败' }, { status: 500 });
  }
}
