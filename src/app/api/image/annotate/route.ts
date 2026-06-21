import { NextRequest, NextResponse } from 'next/server';
import { CozeAPI } from '@/lib/coze-api';
import { createHuiyingObjectStorage } from '@/lib/huiying-object-storage';

/**
 * POST /api/image/annotate
 * 使用视觉模型自动识别图片中的文化元素并生成标注
 *
 * 流程：前端上传图片文件 → 后端上传S3获取签名URL → Coze视觉模型分析
 * 重要：视觉模型失败时直接返回错误，不降级到无图文本LLM
 * （无图LLM生成的标注与图片内容完全无关，比没有标注更糟糕）
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const imageUrl = formData.get('imageUrl') as string | null;
    const existingAnnotations = Number(formData.get('existingAnnotations') || '0');

    let accessibleImageUrl = '';

    // 优先使用文件上传（前端发送图片文件 → 上传S3 → 获取签名URL）
    if (file) {
      try {
        const storage = createHuiyingObjectStorage();

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const key = await storage.uploadFile({
          fileContent: buffer,
          fileName: `annotate/${Date.now()}_${file.name || 'image.jpg'}`,
          contentType: file.type || 'image/jpeg',
        });

        const signedUrl = await storage.generatePresignedUrl({
          key,
          expireTime: 3600, // 1小时有效期
        });

        accessibleImageUrl = signedUrl;
        console.info(`[Annotate] 图片已上传S3, key=${key}, URL长度=${signedUrl.length}`);
      } catch (uploadError) {
        console.error('[Annotate] S3上传失败:', uploadError);
        return NextResponse.json({
          error: '图片上传失败，请重试',
          canRetry: true,
        }, { status: 503 });
      }
    } else if (imageUrl) {
      // 降级：如果前端没有发送文件而是发送了URL
      const isHttpUrl = imageUrl.startsWith('http://') || imageUrl.startsWith('https://');
      if (!isHttpUrl) {
        return NextResponse.json({
          error: '图片URL格式无效，无法进行AI标注',
          canRetry: true,
        }, { status: 400 });
      }

      // 尝试通过S3的uploadFromUrl转存，使Coze API可以访问
      try {
        const storage = createHuiyingObjectStorage();

        const key = await storage.uploadFromUrl({
          url: imageUrl,
          timeout: 15000,
        });

        const signedUrl = await storage.generatePresignedUrl({
          key,
          expireTime: 3600,
        });

        accessibleImageUrl = signedUrl;
        console.info(`[Annotate] URL图片已转存S3, key=${key}`);
      } catch (transferError) {
        console.error('[Annotate] URL转存S3失败，尝试直接使用URL:', transferError);
        // 如果转存失败，直接使用原始URL（可能是公开可访问的）
        accessibleImageUrl = imageUrl;
      }
    } else {
      return NextResponse.json({ error: '缺少图片文件或图片URL' }, { status: 400 });
    }

    if (!accessibleImageUrl) {
      return NextResponse.json({
        error: '无法获取可访问的图片URL',
        canRetry: true,
      }, { status: 503 });
    }

    const prompt = `你是一位精通传统文化与非遗技艺的专业图像分析专家，擅长从图片中精准识别传统服饰、妆容、发饰、建筑、器物等领域的文化元素。

## 标注任务
仔细观察图片中每个可见的具体元素，找出最具有文化价值和辨识度的3-6个元素进行标注。

## 坐标定位规则（极其重要！必须严格遵守）
坐标(x,y)必须精准指向该元素在图片中的视觉中心位置。

想象图片被等分为10×10的网格：
- x=0.0是图片最左边，x=0.5是正中间，x=1.0是最右边
- y=0.0是图片最上边，y=0.5是正中间，y=1.0是最下边

**定位步骤**：
1. 先找到该元素在图片中的视觉位置
2. 估算该元素中心相对于整张图片的水平比例(x)和垂直比例(y)
3. 必须确保坐标落在这个元素的实际像素范围内

**定位示例**（以一张竖版人物照为例）：
- 头顶发饰: x≈0.5, y≈0.08 (头部顶端中央)
- 左耳耳饰: x≈0.35, y≈0.18 (头部左侧)
- 颈部项链: x≈0.5, y≈0.28 (颈部中央)
- 胸口刺绣: x≈0.5, y≈0.38 (上胸区域)
- 腰间系带: x≈0.5, y≈0.52 (腰部)
- 裙摆纹样: x≈0.5, y≈0.75 (下半身)
- 左手手镯: x≈0.25, y≈0.45 (左侧手臂)

**严禁**：发簪标注在腰部位置、裙摆标注在头部位置等逻辑错位的坐标！

## 领域识别指引
根据图片实际内容，选择对应的领域维度：

**服饰类**：齐胸襦裙、褙子、深衣、马面裙等 → 关注面料（纱/罗/绫/锦/缎）、纹样（宝相花纹/卷草纹/团花纹/云纹）、工艺（织金/妆花/缂丝/苏绣/湘绣）、配件（璎珞/步摇/禁步/香囊/披帛）
**妆容类**：桃花妆、飞霞妆、落梅妆等 → 关注眉形（蛾眉/远山眉/柳叶眉）、唇妆（樱桃小口/绛唇）、面妆（斜红/花钿/面靥）、胭脂/铅粉技法
**发饰类**：高髻/双环髻/惊鹄髻等 → 关注发簪（金簪/玉簪/花簪）、步摇、梳篦、钿花、材质（鎏金/点翠/花丝镶嵌/錾刻）
**建筑类**：宫殿/寺庙/园林等 → 关注构件（斗拱/飞檐/雀替/藻井/榫卯）、材料（琉璃瓦/金砖/楠木）、装饰（彩画/砖雕/木雕/石雕）
**器物类**：瓷器/漆器/青铜器等 → 关注釉色/窑口（汝窑/龙泉窑/景德镇）、工艺（景泰蓝/剔红/鎏金/失蜡法）、器型/纹饰

## 每个标注必须包含
1. x, y: 元素中心在图片中的相对位置（0到1之间的浮点数）。必须精准对应图片中该元素的视觉位置！请仔细看图确定位置！
2. radius: 元素相对大小（0.03-0.12），确保裁剪区域能完整展示该元素
3. title: 元素具体名称（3-6字），必须指明是什么（如"鎏金步摇""缠枝莲纹""樱桃小口""斗拱结构"），禁止泛称
4. description: 专业说明（80-200字），必须包含三部分：
   - 【是什么】该元素的具体名称和视觉形态（"图片中XX位置可见的YY形ZZ"）
   - 【文化价值】所属传统技艺/朝代地域特征/文化寓意/非遗项目（必须给出具体的技艺名称或历史背景）
   - 【工艺特点】具体工艺名称/技法/配色原理/结构逻辑（如"采用花丝镶嵌工艺""以朱砂调和铅粉"）
5. tag: 分类标签（必须是以下之一：结构/材质/色彩/纹样/功能/文化/造型/工艺）

## 严格规则
- 必须仔细观察图片实际内容，标注精准对应图中可见元素，禁止凭空虚构
- 标注位置必须与元素在图中的实际位置一致（如发簪在头部区域，裙摆在下部区域）
- 坐标定位是本任务最关键的要求！x,y必须准确指向该元素的实际位置
- 优先标注视觉最突出、最有文化辨识度的元素
- 描述禁止空泛形容词（"精美的""独特的"），必须给出具体名称和信息
- 涉及传统文化的内容必须标注其文化内涵和技艺传承
- 每个tag分类最多出现一次
- 已有${existingAnnotations}个标注，请补充新发现的不同元素

严格以JSON数组格式返回，不要包含任何其他文字：
[{"x":0.5,"y":0.3,"radius":0.08,"title":"示例","description":"示例说明","tag":"结构"}]`;

    // 使用视觉模型，确保图片被真正分析
    const messages = [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: prompt },
          {
            type: 'image_url' as const,
            image_url: { url: accessibleImageUrl, detail: 'high' as const },
          },
        ],
      },
    ];

    let rawContent = '';

    try {
      // 使用LLM模型（支持多模态image_url），模型由 visionChat 内部管理降级链
      const result = await CozeAPI.visionChat(
        messages as any,
        { temperature: 0.5 }
      );

      rawContent = result?.content || '';

      if (!rawContent) {
        return NextResponse.json({
          error: '视觉模型返回内容为空，请重试',
          canRetry: true,
        }, { status: 503 });
      }

      // 解析JSON — 结果可能是字符串或对象
      const contentStr = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
      const jsonMatch = contentStr.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('[Annotate] 无法从AI响应中提取JSON, content:', contentStr.slice(0, 200));
        return NextResponse.json({
          error: 'AI返回格式异常，请重试',
          canRetry: true,
        }, { status: 503 });
      }

      const annotations = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(annotations)) {
        return NextResponse.json({
          error: 'AI返回数据格式错误，请重试',
          canRetry: true,
        }, { status: 503 });
      }

      // 去重：每个tag分类只保留第一个 + 坐标修正
      const seenTags = new Set<string>();
      const deduped = annotations.filter((a: Record<string, unknown>) => {
        const tag = String(a.tag || '');
        if (seenTags.has(tag)) return false;
        seenTags.add(tag);
        return true;
      }).map((a: Record<string, unknown>) => {
        // 修正坐标：确保 x, y 在 0-1 范围内
        let x = Number(a.x) || 0.5;
        let y = Number(a.y) || 0.5;
        // 如果坐标值大于1，可能是百分比值，转换为0-1
        if (x > 1) x = x / 100;
        if (y > 1) y = y / 100;
        // 最终夹紧到0-1
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));
        let radius = Number(a.radius) || 0.08;
        if (radius > 1) radius = radius / 100;
        radius = Math.max(0.03, Math.min(0.15, radius));
        return { ...a, x, y, radius };
      });

      // 二次坐标校验：让视觉模型重新检查坐标是否精准
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let verifiedAnnotations: any[] = deduped;
      if (deduped.length > 0) {
        try {
          const verifyPrompt = `你是一个坐标校验专家。以下是一组图像标注的坐标数据，请仔细观察图片，验证每个标注的x,y坐标是否精准指向该元素在图片中的实际位置。

当前标注数据：
${JSON.stringify(deduped.map((a: Record<string, unknown>) => ({ title: a.title, x: a.x, y: a.y })), null, 2)}

坐标规则：
- x=0.0是图片最左边，x=0.5是正中间，x=1.0是最右边
- y=0.0是图片最上边，y=0.5是正中间，y=1.0是最下边
- 坐标必须精准落在该元素的视觉中心

请仔细观察图片中每个元素的实际位置，如果坐标偏差超过0.05，请修正。如果坐标已经准确，保持不变。

严格以JSON数组格式返回修正后的坐标，不要包含任何其他文字：
[{"title":"元素名","x":0.5,"y":0.3}]`;

          const verifyMessages = [
            {
              role: 'user' as const,
              content: [
                { type: 'text' as const, text: verifyPrompt },
                {
                  type: 'image_url' as const,
                  image_url: { url: accessibleImageUrl, detail: 'high' as const },
                },
              ],
            },
          ];

          const verifyResult = await CozeAPI.visionChat(
            verifyMessages as any,
            { temperature: 0.3 }
          );

          const verifyContent = verifyResult?.content || '';
          if (verifyContent) {
            const verifyStr = typeof verifyContent === 'string' ? verifyContent : JSON.stringify(verifyContent);
            const verifyMatch = verifyStr.match(/\[[\s\S]*\]/);
            if (verifyMatch) {
              const verified = JSON.parse(verifyMatch[0]);
              if (Array.isArray(verified)) {
                // 用校验结果更新坐标
                const verifyMap = new Map<string, { x: number; y: number }>();
                for (const v of verified) {
                  if (v.title) {
                    let vx = Number(v.x) || 0.5;
                    let vy = Number(v.y) || 0.5;
                    if (vx > 1) vx /= 100;
                    if (vy > 1) vy /= 100;
                    vx = Math.max(0, Math.min(1, vx));
                    vy = Math.max(0, Math.min(1, vy));
                    verifyMap.set(String(v.title), { x: vx, y: vy });
                  }
                }
                verifiedAnnotations = deduped.map((a: Record<string, unknown>) => {
                  const corrected = verifyMap.get(String(a.title));
                  if (corrected) {
                    return { ...a, x: corrected.x, y: corrected.y };
                  }
                  return a;
                });
                console.info(`[Annotate] 坐标校验完成, ${verifyMap.size}/${deduped.length} 个标注已修正`);
              }
            }
          }
        } catch (verifyError) {
          // 校验失败不影响主流程，使用原始坐标
          console.warn('[Annotate] 坐标校验失败，使用原始坐标:', verifyError);
        }
      }

      return NextResponse.json({
        annotations: verifiedAnnotations.slice(0, 8),
        provider: 'coze-vision',
      });
    } catch (aiError) {
      console.error('[Annotate] 视觉模型标注失败:', aiError);
      // 不再降级到无图文本LLM——无图标注与实际内容无关，比没有标注更糟糕
      return NextResponse.json({
        error: '视觉模型暂时不可用，请稍后重试',
        canRetry: true,
      }, { status: 503 });
    }
  } catch (error) {
    console.error('[Annotate] Error:', error);
    return NextResponse.json({ error: '标注请求失败' }, { status: 500 });
  }
}
