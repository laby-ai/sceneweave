import { NextRequest } from 'next/server';
import type { CreateStoryboardRequest, CreateStoryboardResponse, FilmScript, FilmShot } from '@/types/film';

/**
 * 影视创作 - 分镜Agent
 * 将影视脚本转化为带英文prompt的分镜列表
 * 并优化每个分镜的生图prompt
 */

const STORYBOARD_SYSTEM_PROMPT = `你是一位资深影视分镜师和AI绘画提示词工程师。

你的任务是根据提供的影视脚本，为每个分镜生成优化后的AI图像生成提示词。

输入：一份包含角色、场景、分镜的影视脚本
输出：优化后的分镜列表，每个分镜包含：
1. contentEn: 英文生图prompt（优化后的）
2. shotType: 景别（Extreme Long Shot / Long Shot / Medium Shot / Close Up / Extreme Close Up）
3. cameraAngle: 镜头角度（Eye Level / Low Angle / High Angle / Dutch Angle / Overhead）
4. cameraMovement: 运镜描述
5. 其他元数据优化

生图prompt优化规则：
- 使用英文，简洁有力
- 包含画面主体、动作、环境、光线、色调、风格
- 包含角色外貌关键词（确保角色一致性）
- 使用专业摄影术语（如cinematic lighting, shallow depth of field, 35mm lens等）
- 添加风格化后缀（如film grain, color grading等）
- 控制在100词以内

特别注意：
- 所有输出必须是合法的JSON格式
- 不要在JSON外面添加任何解释文字
- 确保角色在不同镜头中的外貌描述一致`;

function buildStoryboardPrompt(script: FilmScript, imageStyle?: string): string {
  const characterMap = new Map(script.characters.map(c => [c.id, c]));

  // 构建角色一致性提示
  const characterConsistency = script.characters.map(c =>
    `- ${c.name}: ${c.appearance}`
  ).join('\n');

  // 构建场景描述
  const sceneMap = new Map(script.scenes.map(s => [s.id, s]));

  // 构建分镜输入
  const shotsInput = script.shots.map(shot => {
    const scene = sceneMap.get(shot.sceneId);
    const shotChars = shot.characters.map(cid => characterMap.get(cid)).filter(Boolean);
    return {
      id: shot.id,
      sceneName: scene?.name || '',
      sceneDescription: scene?.description || '',
      timeOfDay: scene?.timeOfDay || '日',
      indoor: scene?.indoor ?? true,
      content: shot.content,
      characters: shotChars.map(c => c?.name).join(', '),
      action: shot.action,
      duration: shot.duration,
    };
  });

  return `请为以下影视脚本的分镜生成优化后的英文生图prompt。

【整体风格】${imageStyle || script.style || '写实电影感'}

【角色一致性要求】
以下角色的外貌描述必须在所有镜头中保持一致：
${characterConsistency}

【分镜列表】
${JSON.stringify(shotsInput, null, 2)}

请输出优化后的分镜列表JSON，格式如下：
[
  {
    "id": "shot_1_1",
    "contentEn": "优化的英文生图prompt，包含角色外貌、场景、光线、风格等，100词以内",
    "shotType": "Medium Shot",
    "cameraAngle": "Eye Level",
    "cameraMovement": "static camera",
    "duration": 5
  }
]

注意：
1. contentEn必须包含角色外貌关键词以确保一致性
2. 使用专业摄影术语增强画面质感
3. 添加风格化后缀统一视觉风格
4. 确保JSON格式完全合法
5. 不要在JSON外面添加任何其他文字`;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateStoryboardRequest = await request.json();

    if (!body.script) {
      return new Response(
        JSON.stringify({ error: '请提供影视脚本' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 动态导入 LLMClient
    const { LLMClient, Config, HeaderUtils } = await import('coze-coding-dev-sdk');
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const messages = [
      { role: 'system' as const, content: STORYBOARD_SYSTEM_PROMPT },
      { role: 'user' as const, content: buildStoryboardPrompt(body.script, body.imageStyle) },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.6,
    });

    const content = response.content || '';

    // 尝试提取JSON数组
    let enhancedShots: Array<Partial<FilmShot>>;
    try {
      enhancedShots = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        enhancedShots = JSON.parse(jsonMatch[1].trim());
      } else {
        const braceMatch = content.match(/\[[\s\S]*\]/);
        if (braceMatch) {
          enhancedShots = JSON.parse(braceMatch[0]);
        } else {
          throw new Error('无法从AI响应中解析分镜JSON');
        }
      }
    }

    // 合并优化后的数据到原始分镜
    const shotMap = new Map(enhancedShots.map(s => [s.id, s]));
    const mergedShots: FilmShot[] = body.script.shots.map(shot => {
      const enhanced = shotMap.get(shot.id);
      return {
        ...shot,
        contentEn: enhanced?.contentEn || shot.contentEn || shot.content,
        shotType: enhanced?.shotType || shot.shotType || 'Medium Shot',
        cameraAngle: enhanced?.cameraAngle || shot.cameraAngle || 'Eye Level',
        cameraMovement: enhanced?.cameraMovement || shot.cameraMovement || 'static camera',
        duration: enhanced?.duration || shot.duration || 5,
      };
    });

    const result: CreateStoryboardResponse & { success: true } = {
      success: true,
      shots: mergedShots,
      message: `分镜优化完成，共${mergedShots.length}个分镜，已生成英文生图prompt。`,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Film Storyboard Agent] Error:', error);
    const message = error instanceof Error ? error.message : '未知错误';
    return new Response(
      JSON.stringify({ success: false, error: `分镜生成失败: ${message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
