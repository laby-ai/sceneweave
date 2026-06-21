import { extractUserInputEntities } from '../storyboard-generator';
import { SCENE_SHOT_STRATEGIES, extractVisualAnchors, getShotPhaseInfo } from './prompt-shot-builders';
import { generateSubtitleAndNarration } from './prompt-shot-narration';
import type { SceneShotContext, VisualAnchor } from './prompt-shot-builders';
import type { NarrationSuggestion, PromptBasedShot, ShotPhase, ShotType, SubtitleSuggestion } from './prompt-shot-types';
import type { UserInputEntities } from '../storyboard-generator';

/**
 * v3.0 核心入口：从用户文本描述生成分镜镜头（场景感知版）
 *
 * 相比v2的改进：
 * - 7种场景各有独立的分镜策略函数，而非共用一套模板
 * - 视觉锚点提取 + 跨镜头一致性注入
 * - Phase叙事弧线标签（establishing→detail→resolving）
 * - 镜头类型差异化（hero/closeup/lifestyle/texture/presentation等）
 * - 时长自适应提示词密度
 *
 * @param prompt 用户输入的描述文本
 * @param totalDuration 总时长（秒）
 * @param options 配置选项
 * @returns 分镜镜头列表 + 提取的实体信息
 */
export function generateShotsFromUserPrompt(
  prompt: string,
  totalDuration: number,
  options?: { maxShotDuration?: number; preferredSceneType?: string }
): { shots: PromptBasedShot[]; entities: UserInputEntities; visualAnchors: VisualAnchor[]; narrativeSummary: string; subtitleSuggestion: SubtitleSuggestion; narrationSuggestion: NarrationSuggestion } {
  const maxDur = options?.maxShotDuration || 10;
  const shotCount = Math.max(1, Math.ceil(totalDuration / maxDur));
  const avgDuration = Math.floor(totalDuration / shotCount);
  const remainder = totalDuration % shotCount;

  // ===== Step 1: 提取用户输入实体 =====
  const entities = extractUserInputEntities(prompt);

  // ===== Step 2: 提取视觉锚点 =====
  const visualAnchors = extractVisualAnchors(prompt);

  // ===== Step 3: 确定场景策略 =====
  const preferredType = options?.preferredSceneType || 'portrait';
  const shotBuilder = SCENE_SHOT_STRATEGIES[preferredType] || SCENE_SHOT_STRATEGIES.portrait;

  console.log(`[Storyboard v3.0] 场景策略: ${preferredType}, 镜头数: ${shotCount}, 锚点数: ${visualAnchors.length}`);

  // ===== Step 4: 逐镜头构建 =====
  const shots: PromptBasedShot[] = [];
  const phaseSequence: string[] = []; // 用于生成叙事摘要

  for (let i = 0; i < shotCount; i++) {
    const dur = i < remainder ? avgDuration + 1 : avgDuration;
    const phaseInfo = getShotPhaseInfo(i, shotCount);

    // 产品场景的特殊镜头类型覆盖
    let effectivePhaseInfo = { ...phaseInfo };
    if (preferredType === 'product' && shotCount >= 3) {
      const productShotTypes: ShotType[] = ['hero', 'action', 'closeup', 'lifestyle', 'closing'];
      const productPhases: ShotPhase[] = ['establishing', 'developing', 'detail', 'climax', 'resolving'];
      const productLabels: Partial<Record<ShotType, string>> = {
        hero: 'Hero全景', action: '多角度', closeup: '细节特写', lifestyle: 'Lifestyle', closing: '品牌定格',
      };
      const productPhaseLabels: Record<ShotPhase, string> = {
        establishing: '产品亮相', developing: '立体展示', detail: '质感聚焦', climax: '场景融合', resolving: '最终呈现',
      };
      const typeIdx = Math.min(i, productShotTypes.length - 1);
      effectivePhaseInfo = {
        phase: productPhases[typeIdx] || phaseInfo.phase,
        phaseLabel: productPhaseLabels[productPhases[typeIdx] as ShotPhase] || phaseInfo.phaseLabel,
        shotType: productShotTypes[typeIdx] || phaseInfo.shotType,
        shotTypeLabel: productLabels[productShotTypes[typeIdx] as ShotType] || phaseInfo.shotTypeLabel,
      };
    }

    // 美食场景的特殊镜头类型覆盖
    if (preferredType === 'food' && shotCount >= 3) {
      const foodShotTypes: ShotType[] = ['establishing', 'hero', 'texture', 'transition', 'presentation'];
      const foodLabels: Partial<Record<ShotType, string>> = {
        establishing: '场景氛围', hero: '摆盘全景', texture: '质感特写', transition: '动态捕捉', presentation: '完美呈现',
      };
      const foodPhases: ShotPhase[] = ['establishing', 'developing', 'detail', 'climax', 'resolving'];
      const foodPhaseLabels: Record<ShotPhase, string> = {
        establishing: '氛围铺垫', developing: '完整呈现', detail: '感官诱惑', climax: '动态魅力', resolving: '食欲定格',
      };
      const typeIdx = Math.min(i, foodShotTypes.length - 1);
      effectivePhaseInfo = {
        phase: foodPhases[typeIdx] || phaseInfo.phase,
        phaseLabel: foodPhaseLabels[foodPhases[typeIdx] as ShotPhase] || phaseInfo.phaseLabel,
        shotType: foodShotTypes[typeIdx] || phaseInfo.shotType,
        shotTypeLabel: foodLabels[foodShotTypes[typeIdx] as ShotType] || phaseInfo.shotTypeLabel,
      };
    }

    const context: SceneShotContext = {
      entities,
      anchors: visualAnchors,
      phaseInfo: effectivePhaseInfo,
      shotIndex: i,
      totalShots: shotCount,
      duration: Math.min(dur, maxDur),
      originalPrompt: prompt,
    };

    const generatedPrompt = shotBuilder(context);

    phaseSequence.push(`${effectivePhaseInfo.phaseLabel}(${effectivePhaseInfo.shotTypeLabel})`);

    shots.push({
      id: `prompt-shot-${Date.now()}-${i}`,
      prompt: generatedPrompt,
      duration: Math.min(dur, maxDur),
      phase: effectivePhaseInfo.phase,
      shotType: effectivePhaseInfo.shotType,
      phaseLabel: effectivePhaseInfo.phaseLabel,
      shotTypeLabel: effectivePhaseInfo.shotTypeLabel,
    });
  }

  // ===== Step 5: 生成叙事摘要 =====
  const narrativeSummary = `${preferredType === 'product' ? '产品' : preferredType === 'food' ? '美食' : preferredType === 'landscape' ? '风景' : preferredType === 'drama' ? '剧情' : preferredType === 'abstract' ? '抽象' : preferredType === 'interior' ? '室内' : '通用'}分镜 · ${shotCount}段 · ${phaseSequence.join(' → ')}`;

  // ===== ★ Step 6: v4.0 字幕与旁白内容生成 =====
  const { subtitleSuggestion, narrationSuggestion } = generateSubtitleAndNarration(
    shots, entities, prompt, preferredType
  );

  // 将生成的字幕/旁白数据注入到每个shot中
  for (let i = 0; i < shots.length; i++) {
    shots[i].subtitleText = subtitleSuggestion.segments[i]?.text || '';
    shots[i].narrationText = narrationSuggestion.perShot[i]?.text || '';
  }

  console.log(`[Storyboard v4.0] 字幕${subtitleSuggestion.segments.length}段 · 旁白${narrationSuggestion.script.length}字`);

  return { shots, entities, visualAnchors, narrativeSummary, subtitleSuggestion, narrationSuggestion };
}
