import { NextRequest, NextResponse } from 'next/server';
// LLMClient 使用动态导入以避免 RSC 环境下的 React Class Component 兼容性问题

// ★ v2.0: BGM类型已迁移到集中定义
import { BGM_TYPES_V2, getBgmTypeList, getRecommendedBgmForScene, matchBgmByKeywords, type BgmTypeId } from '@/constants/bgm-types';

// 向后兼容：从集中定义提取旧格式
const BGM_OPTIONS = getBgmTypeList().map(b => ({
  id: b.id,
  name: b.name,
  description: b.description,
  keywords: b.keywords.slice(0, 10),
}));

export async function POST(request: NextRequest) {
  try {
    const { sceneType = 'portrait', mood = '', description = '' } = await request.json();

    console.log(`[BGM-Recommend] 推荐BGM: 场景=${sceneType}, 情绪=${mood}, 描述长度=${description?.length || 0}`);

    // ===== 方案A: 本地关键词快速匹配（无需调用AI）=====
    const localMatch = description ? matchBgmByKeywords(description) : null;
    
    // ===== 方案B: 场景类型映射推荐 =====
    const sceneRecommendations = getRecommendedBgmForScene(sceneType, mood);

    // 如果本地匹配置信度高，优先使用
    if (localMatch && !mood) {
      console.log(`[BGM-Recommend] 本地匹配成功: ${localMatch.name} (场景推荐备选: ${sceneRecommendations[0]?.name})`);
      return NextResponse.json({
        success: true,
        recommended: localMatch.id,
        name: localMatch.name,
        reason: `根据内容描述"${description.slice(0, 30)}..."匹配到${localMatch.name}风格`,
        alternatives: sceneRecommendations.slice(0, 3).map(b => ({ id: b.id, name: b.name })),
        allOptions: BGM_OPTIONS,
      });
    }

    // ===== 方案C: AI智能推荐（当有明确情绪或描述时）=====
    if (mood || description) {
      try {
        // 动态导入 LLMClient（避免 RSC 兼容性问题）
        const { LLMClient, Config, HeaderUtils } = await import('coze-coding-dev-sdk');
        const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
        const config = new Config();
        const client = new LLMClient(config, customHeaders);

        // ★ v2.0: 使用18种类型的完整信息构建System Prompt
        const typeDescriptions = getBgmTypeList().map(b =>
          `- ${b.icon} **${b.id}** (${b.name}): ${b.description}\n  关键词: ${b.keywords.slice(0, 8).join('、')}\n  适用场景: ${b.suitableScenes.join('/')}`
        ).join('\n');

        const systemPrompt = `你是一个专业的视频背景音乐(BGM)推荐专家。根据视频的场景类型、情绪和内容描述，推荐最合适的BGM类型。

## 可选的BGM类型（共${getBgmTypeList().length}种）：

${typeDescriptions}

## 推荐原则：
1. 首先匹配场景类型（产品→商务/爵士/古典，风景→自然/氛围/史诗...）
2. 其次匹配情绪（欢快→upbeat/comedy，浪漫→romantic/jazz，紧张→suspense/cinematic）
3. 最后考虑内容细节（科技产品→electronic，美食→jazz/world，旅行→acoustic/world）

## 输出格式（严格JSON）：
{
  "recommended": "bgm_type_id",
  "name": "中文名称",
  "reason": "推荐理由（一句话说明为什么适合这个视频）",
  "alternatives": ["备用1", "备用2"]
}`;

        const userPrompt = `请为以下视频推荐最合适的背景音乐类型：

**场景类型**: ${sceneType}
**情绪氛围**: ${mood || '未指定'}
**内容描述**: ${description || '无详细描述'}

请只返回JSON格式结果。`;

        console.log(`[BGM-Recommend] 调用AI推荐...`);

        const messages = [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: userPrompt },
        ];

        const response = await client.invoke(messages, {
          model: 'doubao-seed-2-0-lite-260215',
          temperature: 0.3,
        });

        let aiResult;
        try {
          const content = response.content || '';
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiResult = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error('[BGM-Recommend] AI响应解析失败:', e);
        }

        if (aiResult?.recommended && BGM_TYPES_V2[aiResult.recommended as BgmTypeId]) {
          console.log(`[BGM-Recommend] AI推荐成功: ${aiResult.name}`);
          return NextResponse.json({
            success: true,
            recommended: aiResult.recommended,
            name: aiResult.name,
            reason: aiResult.reason || `AI根据${sceneType}场景和${mood || '内容'}情绪推荐`,
            alternatives: (aiResult.alternatives || []).filter((id: string) => BGM_TYPES_V2[id as BgmTypeId]).slice(0, 3),
            allOptions: BGM_OPTIONS,
          });
        }
      } catch (error) {
        console.warn('[BGM-Recommend] AI推荐失败，使用降级方案:', error);
      }
    }

    // ===== 降级方案：使用场景映射的默认推荐 =====
    const fallback = sceneRecommendations[0] || getBgmTypeList()[0];
    console.log(`[BGM-Recommend] 使用降级推荐: ${fallback.name}`);

    return NextResponse.json({
      success: true,
      recommended: fallback.id,
      name: fallback.name,
      reason: `基于${sceneType}场景类型的默认推荐`,
      alternatives: sceneRecommendations.slice(1, 4).map(b => ({ id: b.id, name: b.name })),
      allOptions: BGM_OPTIONS,
    });

  } catch (error) {
    console.error('[BGM-Recommend] Error:', error);
    return NextResponse.json(
      { success: false, error: 'BGM推荐服务暂时不可用' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'BGM推荐API - POST方法接收参数',
    parameters: {
      sceneType: '场景类型 (product/portrait/landscape/food/drama/abstract/interior)',
      mood: '情绪氛围 (可选)',
      description: '视频内容描述 (可选)',
    },
    availableTypes: getBgmTypeList().map(b => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      color: b.color,
      moods: b.moods,
    })),
  });
}
