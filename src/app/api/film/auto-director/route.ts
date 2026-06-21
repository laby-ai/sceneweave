import { NextRequest } from 'next/server';
import { AutoDirectorPipeline } from '@/lib/video-production/auto-director-pipeline';
import type { ContentTypeCode, PipelineOutput, OutputFormat, VideoModelCode, FallbackStrategy } from '@/lib/video-production/types';

/**
 * 自动化导演流水线 API v3.2
 * POST /api/film/auto-director
 * 
 * 支持4种入场模式:
 * - full_pipeline: 完整流程（默认）
 * - from_script: 从剧本入场
 * - prompts_only: 仅生成提示词
 * - style_recommend: 风格推荐
 * 
 * v3.2 新增:
 * - manualModel: 用户手动指定模型 (自主选择)
 * - fallbackStrategy: 降级策略 (strict/balanced/cost_first/quality_first)
 * - modelAvailability: 模型可用状态覆盖
 * - 模型推荐 Top-3 + 降级链信息
 */

interface AutoDirectorRequest {
  input: string;                        // 用户需求描述
  entryMode?: 'full_pipeline' | 'from_script' | 'prompts_only' | 'style_recommend';
  contentType?: ContentTypeCode;        // 手动指定内容类型
  duration?: number;                    // 目标时长（秒）
  style?: string;                       // 视觉风格
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  thresholdMatch?: number;              // 素材匹配阈值
  thresholdEnhance?: number;            // AI增强阈值
  skipScheduling?: boolean;             // 跳过素材调度
  dryRun?: boolean;                     // 仅预览
  // v3.1 新增参数
  outputFormat?: OutputFormat;          // 输出格式
  enableQualityCheck?: boolean;         // 启用质量评估
  enableModelRouting?: boolean;         // 启用模型路由
  // v3.2 新增参数
  manualModel?: VideoModelCode;         // 手动指定模型 (自主选择)
  fallbackStrategy?: FallbackStrategy;  // 降级策略
  modelAvailability?: Partial<Record<VideoModelCode, 'available' | 'degraded' | 'unavailable' | 'unknown'>>;
  // 风格一致性
  filmVisualStyle?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AutoDirectorRequest = await request.json();

    if (!body.input || body.input.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: '请提供创作需求描述' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pipeline = new AutoDirectorPipeline({
      entryMode: body.entryMode || 'full_pipeline',
      duration: body.duration || 180,
      style: body.style || 'cinematic',
      aspectRatio: body.aspectRatio || '16:9',
      thresholdMatch: body.thresholdMatch ?? 0.80,
      thresholdEnhance: body.thresholdEnhance ?? 0.60,
      skipScheduling: body.skipScheduling ?? false,
      dryRun: body.dryRun ?? false,
    }, {
      fallbackStrategy: body.fallbackStrategy,
      availability: body.modelAvailability,
    });

    // ========== 风格推荐模式 ==========
    if (body.entryMode === 'style_recommend') {
      const recommendations = pipeline.recommendStyles(body.input);
      return new Response(
        JSON.stringify({
          mode: 'style_recommend',
          recommendations,
          message: '风格推荐完成',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ========== 执行流水线（逻辑层 + v3.2 增强层） ==========
    const result = pipeline.run(body.input, {
      contentType: body.contentType,
      duration: body.duration,
      outputFormat: body.outputFormat ?? (body.dryRun ? 'none' : 'director_plan'),
      manualModel: body.manualModel,
      fallbackStrategy: body.fallbackStrategy,
      modelAvailability: body.modelAvailability,
    });

    // ========== dryRun 模式：仅返回逻辑层结果 ==========
    if (body.dryRun) {
      const output: PipelineOutput = pipeline.buildOutput(body.input, result);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ...output,
            // v3.1 增强数据
            modelRoutings: body.enableModelRouting !== false ? result.modelRoutings : undefined,
            qualityAssessment: body.enableQualityCheck !== false ? result.qualityResult : undefined,
            markdownOutput: result.markdownOutput,
            summary: {
              ...output.summary,
              contentType: result.writerOutput.contentType,
              typeName: result.writerOutput.typeName,
              emotionCurvePoints: result.directorOutput.emotionCurve.length,
            },
          },
          message: `[预览] ${result.writerOutput.typeName} | ${result.summary.totalShots}镜头 | ${result.summary.totalDuration}秒`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ========== 调用 LLM 生成脚本 ==========
    const { LLMClient, Config, HeaderUtils } = await import('coze-coding-dev-sdk');
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // Stage 1: LLM 编剧
    const writerResponse = await client.invoke(
      [
        { role: 'system', content: '你是一位资深影视编剧，请严格按照JSON格式输出。' },
        { role: 'user', content: result.writerPrompt },
      ],
      { model: 'doubao-seed-1-8-251228', temperature: 0.7 }
    );

    let scriptJson: Record<string, unknown> | null = null;
    try {
      const content = writerResponse.content || '';
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        scriptJson = JSON.parse(jsonMatch[1].trim());
      } else {
        scriptJson = JSON.parse(content);
      }
    } catch {
      scriptJson = null;
    }

    // Stage 2: LLM 导演
    let enhancedShots: Array<{ id: string; visualPrompt: string; content: string; contentEn: string }> | null = null;
    try {
      const directorResponse = await client.invoke(
        [
          { role: 'system', content: '你是一位资深影视分镜师，请严格按照JSON数组格式输出。' },
          { role: 'user', content: result.directorPrompt },
        ],
        { model: 'doubao-seed-1-8-251228', temperature: 0.6 }
      );

      const directorContent = directorResponse.content || '';
      const arrayMatch = directorContent.match(/```(?:json)?\s*([\s\S]*?)```/) || directorContent.match(/(\[[\s\S]*\])/);
      if (arrayMatch) {
        enhancedShots = JSON.parse(arrayMatch[1].trim());
      } else {
        enhancedShots = JSON.parse(directorContent);
      }
    } catch {
      enhancedShots = null;
    }

    // 合并 LLM 增强结果
    if (enhancedShots) {
      const shotMap = new Map(enhancedShots.map(s => [s.id, s]));
      for (const shot of result.directorOutput.shots) {
        const enhanced = shotMap.get(shot.shotId);
        if (enhanced) {
          shot.visualPrompt = enhanced.visualPrompt || '';
          if (enhanced.content) {
            shot.subject = enhanced.content;
          }
        }
      }
    }

    // 构建完整输出
    const output: PipelineOutput = pipeline.buildOutput(body.input, result);

    // v3.1 最终输出
    const finalOutput = {
      ...output,
      generatedScript: scriptJson,
      // v3.1 增强数据
      modelRoutings: body.enableModelRouting !== false ? result.modelRoutings : undefined,
      qualityAssessment: body.enableQualityCheck !== false ? result.qualityResult : undefined,
      markdownOutput: result.markdownOutput,
      summary: {
        ...output.summary,
        contentType: result.writerOutput.contentType,
        typeName: result.writerOutput.typeName,
        emotionCurvePoints: result.directorOutput.emotionCurve.length,
      },
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: finalOutput,
        message: `流水线完成: ${result.writerOutput.typeName} | ${result.summary.totalShots}镜头 | ${result.summary.totalDuration}秒`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '流水线执行失败';
    console.error('[AutoDirector API Error]', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
