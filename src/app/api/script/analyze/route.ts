import { NextRequest, NextResponse } from 'next/server';
import {
  LLMClient,
  Config,
  HeaderUtils,
  APIError,
} from 'coze-coding-dev-sdk';

// 从剧本中搜索人物描述的函数
function extractCharacterDescriptionFromScript(script: string, characterName: string): string | null {
  // 构建搜索模式
  const patterns = [
    // 人物名 + 是/叫 + 描述
    new RegExp(`${characterName}[是叫叫做名叫].{0,50}?[。！？.!?,，]`, 'g'),
    // 描述 + 的 + 人物名
    new RegExp(`.{0,30}的${characterName}`, 'g'),
    // 人物名 + ， + 描述
    new RegExp(`${characterName}[，,]\\s*.{0,50}?[。！？.!?]`, 'g'),
  ];

  for (const pattern of patterns) {
    const matches = script.match(pattern);
    if (matches && matches.length > 0) {
      // 取第一个匹配并清理
      let desc = matches[0];
      // 移除人物名
      desc = desc.replace(new RegExp(characterName, 'g'), '').trim();
      // 移除开头的标点
      desc = desc.replace(/^[是叫叫做名叫，,]\\s*/, '').trim();
      if (desc.length >= 5) {
        return desc;
      }
    }
  }

  return null;
}

// 从剧本中搜索场景描述的函数
function extractSceneDescriptionFromScript(script: string, sceneName: string): string | null {
  // 构建搜索模式
  const patterns = [
    // 在/位于 + 场景名 + ，/。 + 描述
    new RegExp(`[在位于].{0,10}${sceneName}.{0,50}?[。！？.!?]`, 'g'),
    // 场景名 + 里/中 + 描述
    new RegExp(`${sceneName}[里中].{0,50}?[。！？.!?]`, 'g'),
    // 描述 + 的 + 场景名
    new RegExp(`.{0,30}的${sceneName}`, 'g'),
  ];

  for (const pattern of patterns) {
    const matches = script.match(pattern);
    if (matches && matches.length > 0) {
      let desc = matches[0];
      desc = desc.replace(new RegExp(sceneName, 'g'), '').trim();
      desc = desc.replace(/^[在位于里中]\\s*/, '').trim();
      if (desc.length >= 5) {
        return desc;
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json();

    if (!script || typeof script !== 'string' || script.trim().length < 10) {
      return NextResponse.json(
        { error: '请提供至少10个字符的剧本内容' },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 第一步：先用大模型提取人物和场景名称
    const nameSystemPrompt = `你是一位专业的剧本分析专家。你的任务是从给定的剧本中提取主要人物和场景。

请严格按照以下JSON格式返回结果，不要返回其他任何文字：
{
  "characters": ["人物1", "人物2", "人物3"],
  "scenes": ["场景1", "场景2", "场景3"]
}

要求：
1. characters：提取剧本中的主要人物名称，2-4个即可
2. scenes：提取剧本中的主要场景名称，2-4个即可
3. 人物和场景名称要简洁，通常2-6个字
4. 如果没有明确提到人物，可以使用"主角"、"配角"等通用名称
5. 如果没有明确提到场景，可以根据剧本内容推测合理的场景`;

    const nameMessages = [
      { role: 'system' as const, content: nameSystemPrompt },
      { role: 'user' as const, content: `请从以下剧本中提取主要人物和场景：\n\n${script}` },
    ];

    const nameResponse = await client.invoke(nameMessages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.3,
    });

    let characterNames: string[] = ['主角'];
    let sceneNames: string[] = ['现代客厅'];

    try {
      const content = nameResponse.content?.toString() || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        characterNames = parsed.characters || ['主角'];
        sceneNames = parsed.scenes || ['现代客厅'];
      }
    } catch (parseError) {
      console.error('[Script Analyze] 名称提取解析失败:', parseError);
    }

    // 确保结果有效
    characterNames = Array.isArray(characterNames) && characterNames.length > 0 ? characterNames : ['主角'];
    sceneNames = Array.isArray(sceneNames) && sceneNames.length > 0 ? sceneNames : ['现代客厅'];
    characterNames = characterNames.slice(0, 4);
    sceneNames = sceneNames.slice(0, 4);

    // 第二步：为每个人物尝试从剧本中搜索描述，没有的话用大模型生成
    const charactersWithDetails: Array<{ name: string; description: string }> = [];
    
    for (const charName of characterNames) {
      // 先尝试从剧本中搜索
      let description = extractCharacterDescriptionFromScript(script, charName);
      
      // 如果剧本中没有，用大模型生成
      if (!description) {
        try {
          const descPrompt = `请为"${charName}"这个人物生成一段具体的视觉描述，50-80字。

要求：
1. 包含人物的外貌特征（年龄、发型、五官等）
2. 包含穿着打扮（服装风格、颜色等）
3. 包含一个简单的动作或姿态
4. 包含场景或环境
5. 描述要具体，适合用于图片生成

只返回描述文字，不要其他内容。`;
          const descMessages = [
            { role: 'user' as const, content: descPrompt },
          ];
          const descResponse = await client.invoke(descMessages, {
            model: 'doubao-seed-1-8-251228',
            temperature: 0.8,
          });
          description = descResponse.content?.toString() || `${charName}的形象`;
          description = description.trim().substring(0, 100);
        } catch (descError) {
          console.error(`[Script Analyze] 生成人物${charName}描述失败:`, descError);
          description = `${charName}，一位中年女性，穿着居家服饰，在客厅中忙碌`;
        }
      }
      
      charactersWithDetails.push({ name: charName, description });
    }

    // 第三步：为每个场景尝试从剧本中搜索描述，没有的话用大模型生成
    const scenesWithDetails: Array<{ name: string; description: string }> = [];
    
    for (const sceneName of sceneNames) {
      // 先尝试从剧本中搜索
      let description = extractSceneDescriptionFromScript(script, sceneName);
      
      // 如果剧本中没有，用大模型生成
      if (!description) {
        try {
          const descPrompt = `请为"${sceneName}"这个场景生成一段具体的视觉描述，50-80字。

要求：
1. 包含场景的环境特点（室内/室外、光线、氛围等）
2. 包含场景中的主要物体或陈设
3. 包含颜色、材质等视觉细节
4. 描述要具体，适合用于图片生成

只返回描述文字，不要其他内容。`;
          const descMessages = [
            { role: 'user' as const, content: descPrompt },
          ];
          const descResponse = await client.invoke(descMessages, {
            model: 'doubao-seed-1-8-251228',
            temperature: 0.8,
          });
          description = descResponse.content?.toString() || sceneName;
          description = description.trim().substring(0, 100);
        } catch (descError) {
          console.error(`[Script Analyze] 生成场景${sceneName}描述失败:`, descError);
          description = `${sceneName}，温馨舒适的环境，光线柔和，布置整洁`;
        }
      }
      
      scenesWithDetails.push({ name: sceneName, description });
    }

    const result = {
      characters: charactersWithDetails,
      scenes: scenesWithDetails,
    };

    console.log('[Script Analyze] 最终提取结果:', result);

    return NextResponse.json({
      success: true,
      characters: result.characters,
      scenes: result.scenes,
    });

  } catch (error) {
    console.error('剧本分析错误:', error);

    if (error instanceof APIError) {
      return NextResponse.json(
        { error: `API 错误: ${error.message}` },
        { status: error.statusCode || 500 }
      );
    }

    // 出错时返回默认值
    return NextResponse.json({
      success: true,
      characters: [{ name: '主角', description: '主角的形象' }],
      scenes: [{ name: '现代客厅', description: '温馨舒适的现代客厅' }],
    });
  }
}
