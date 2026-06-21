import { NextRequest, NextResponse } from 'next/server';
import { generateShotsFromUserPrompt } from '@/lib/storyboard-generator';
import { buildProductionProject } from '@/lib/production-project';
import {
  completeTask,
  createTask,
  getTask,
  startTask,
  updateTaskProgress,
} from '@/lib/task-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DryRunBody {
  prompt?: string;
  duration?: number;
  segmentDuration?: number;
  style?: string;
  sceneType?: string;
  ratio?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function toNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as DryRunBody;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    if (prompt.length < 2) {
      return NextResponse.json(
        { success: false, error: '请提供至少2个字符的创意、剧本或短片描述' },
        { status: 400 },
      );
    }

    const duration = clamp(toNumber(body.duration, 60), 5, 120);
    const segmentDuration = clamp(toNumber(body.segmentDuration, 10), 3, 15);
    const style = body.style || '电影感短剧';
    const sceneType = body.sceneType || 'drama';
    const ratio = body.ratio || '16:9';

    const taskId = createTask('storyboard', {
      prompt,
      duration: `${duration}s`,
      style,
      ratio,
      sceneType,
      workflow: 'production-dry-run',
    });

    startTask(taskId);
    updateTaskProgress(taskId, 18, '拆解创意', '正在把创意拆成短剧制作结构');

    const generated = generateShotsFromUserPrompt(prompt, duration, {
      maxShotDuration: segmentDuration,
      preferredSceneType: sceneType,
    });

    updateTaskProgress(taskId, 58, '生成分镜', '已生成镜头、字幕和旁白建议');

    const visualAnchors = generated.visualAnchors as Array<{ element: string; category: string }>;
    const shots = generated.shots.map((shot, index) => ({
      id: shot.id,
      index: index + 1,
      prompt: shot.prompt,
      duration: shot.duration,
      phase: shot.phase,
      phaseLabel: shot.phaseLabel,
      shotType: shot.shotType,
      shotTypeLabel: shot.shotTypeLabel,
      subtitleText: shot.subtitleText,
      narrationText: shot.narrationText,
      status: 'planned',
    }));

    const totalDuration = shots.reduce((sum, shot) => sum + shot.duration, 0);
    const productionProject = buildProductionProject({
      taskId,
      prompt,
      duration,
      segmentDuration,
      style,
      sceneType,
      ratio,
      entities: generated.entities,
      visualAnchors,
      narrativeSummary: generated.narrativeSummary,
      subtitleSuggestion: generated.subtitleSuggestion,
      narrationSuggestion: generated.narrationSuggestion,
      shots: generated.shots.map((shot, index) => ({
        ...shot,
        index: index + 1,
        status: 'planned',
      })),
    });

    const flow = {
      mode: 'dry-run',
      stages: productionProject.stages.map(stage => ({
        id: stage.id,
        name: stage.name,
        status: stage.status === 'ready' ? 'completed' : stage.status,
        summary: stage.summary,
      })),
      totalDuration,
      shotCount: shots.length,
      canProceedToVideo: productionProject.output.canProceedToVideo,
      nextStep: productionProject.output.nextStep,
    };

    const project = {
      id: productionProject.id,
      title: productionProject.title,
      style,
      ratio,
      sceneType,
      entities: generated.entities,
      visualAnchors,
      narrativeSummary: generated.narrativeSummary,
      subtitleSuggestion: generated.subtitleSuggestion,
      narrationSuggestion: generated.narrationSuggestion,
      assetCount: productionProject.assets.length,
      stageCount: productionProject.stages.length,
    };

    updateTaskProgress(taskId, 86, '写入任务中心', '正在保存 dry-run 制作闭环结果');
    completeTask(taskId, {
      content: JSON.stringify({ project, flow }, null, 2),
      shots,
      productionFlow: flow,
      project,
      productionProject,
    });

    const task = getTask(taskId);

    return NextResponse.json({
      success: true,
      usedRealKey: false,
      incurredCost: false,
      taskId,
      task,
      project,
      productionProject,
      flow,
      shots,
    });
  } catch (error) {
    console.error('[Production DryRun] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '制作流程 dry-run 失败',
      },
      { status: 500 },
    );
  }
}
