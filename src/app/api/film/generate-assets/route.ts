import { NextRequest } from 'next/server';
import type { GenerateAssetsRequest, GenerateAssetsResponse, FilmCharacter, FilmScene, FilmShot } from '@/types/film';

/**
 * 影视创作 - 素材生成Agent
 * 并行生成角色参考图、场景氛围图、分镜参考图
 */

// 图像生成API端点
const IMAGE_GENERATION_API = process.env.COZE_PROJECT_DOMAIN_DEFAULT
  ? `https://${process.env.COZE_PROJECT_DOMAIN_DEFAULT}/api/image/generate`
  : 'http://localhost:5000/api/image/generate';

async function generateImage(prompt: string, seed?: number, referenceImage?: string): Promise<string | null> {
  try {
    const body: Record<string, unknown> = {
      prompt,
      width: 1024,
      height: 1024,
      n: 1,
    };
    if (seed) body.seed = seed;
    if (referenceImage) body.referenceImage = referenceImage;

    const res = await fetch(IMAGE_GENERATION_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.url || data?.url || data?.imageUrl || null;
  } catch (err) {
    console.error('[GenerateAssets] Image generation failed:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateAssetsRequest = await request.json();
    const { script, shots, generateType } = body;

    if (!script || !shots) {
      return new Response(
        JSON.stringify({ error: '缺少脚本或分镜数据' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updatedCharacters: FilmCharacter[] = [...script.characters];
    const updatedScenes: FilmScene[] = [...script.scenes];
    const updatedShots: FilmShot[] = [...shots];

    // 1. 生成角色参考图
    if (generateType === 'character' || generateType === 'all') {
      const characterPromises = updatedCharacters.map(async (char, idx) => {
        if (char.referenceImage) return char;

        const prompt = `Professional portrait photo of ${char.appearance}, ${char.outfit || ''}, ${script.style}, cinematic lighting, high quality, detailed face, 8k, film still`;
        const url = await generateImage(prompt, char.seed);

        // 延时避免并发过高
        if (idx < updatedCharacters.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
        return { ...char, referenceImage: url || undefined };
      });
      const charResults = await Promise.all(characterPromises);
      updatedCharacters.splice(0, updatedCharacters.length, ...charResults);
    }

    // 2. 生成场景氛围图
    if (generateType === 'scene' || generateType === 'all') {
      const scenePromises = updatedScenes.map(async (scene, idx) => {
        if (scene.referenceImage) return scene;

        const timeDesc = scene.timeOfDay === '夜' ? 'night' : scene.timeOfDay === '黄昏' ? 'sunset' : 'day';
        const indoorDesc = scene.indoor ? 'indoor' : 'outdoor';
        const prompt = `${scene.description}, ${indoorDesc}, ${timeDesc}, ${scene.mood} atmosphere, ${script.style}, cinematic wide shot, high quality, 8k, film still`;
        const url = await generateImage(prompt);

        if (idx < updatedScenes.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
        return { ...scene, referenceImage: url || undefined };
      });
      const sceneResults = await Promise.all(scenePromises);
      updatedScenes.splice(0, updatedScenes.length, ...sceneResults);
    }

    // 3. 生成分镜参考图
    if (generateType === 'shot' || generateType === 'all') {
      const characterMap = new Map(updatedCharacters.map(c => [c.id, c]));

      for (let i = 0; i < updatedShots.length; i++) {
        const shot = updatedShots[i];
        if (shot.referenceImage) continue;

        // 构建分镜生图prompt
        const charPrompts = shot.characters
          .map(cid => {
            const char = characterMap.get(cid);
            return char ? char.appearance : '';
          })
          .filter(Boolean)
          .join(', ');

        const scene = updatedScenes.find(s => s.id === shot.sceneId);
        const sceneDesc = scene
          ? `${scene.description}, ${scene.indoor ? 'indoor' : 'outdoor'}, ${scene.timeOfDay === '夜' ? 'night' : 'day'}`
          : '';

        const prompt = `${shot.contentEn || shot.content}, ${charPrompts}, ${sceneDesc}, ${shot.shotType}, ${shot.cameraAngle}, ${script.style}, cinematic, high quality, 8k, film still`;

        // 使用第一个出镜角色的参考图作为垫图（如果存在）
        const firstCharRef = shot.characters.length > 0
          ? characterMap.get(shot.characters[0])?.referenceImage
          : undefined;

        const url = await generateImage(prompt, undefined, firstCharRef);
        updatedShots[i] = { ...shot, referenceImage: url || undefined };

        // 延时避免并发过高
        if (i < updatedShots.length - 1) {
          await new Promise(r => setTimeout(r, 800));
        }
      }
    }

    const results = updatedShots
      .filter(s => s.referenceImage)
      .map(s => ({ shotId: s.id, imageUrl: s.referenceImage! }));

    const result = {
      success: true as const,
      results,
      updatedShots,
      updatedCharacters,
      updatedScenes,
      message: `素材生成完成，共生成${results.length}张参考图。`,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Film Asset Agent] Error:', error);
    const message = error instanceof Error ? error.message : '未知错误';
    return new Response(
      JSON.stringify({ success: false, error: `素材生成失败: ${message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
