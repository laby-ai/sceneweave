import { NextRequest, NextResponse } from 'next/server';
import { generateShotsFromUserPrompt } from '@/lib/storyboard-generator';
import { buildProductionProject } from '@/lib/production-project';
import { buildSmartDirectorChain } from '@/lib/smart-director-chain';
import { evaluateStoryReadability } from '@/lib/production-story-readability';
import {
  completeTask,
  createTask,
  getTask,
  startTask,
  updateTaskProgress,
} from '@/lib/task-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DirectorChainBody {
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
    const body = (await request.json().catch(() => ({}))) as DirectorChainBody;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    if (prompt.length < 2) {
      return NextResponse.json(
        { success: false, error: '请先输入短片创意、剧本片段或生成目标，绘影精灵才能组织导演链路。' },
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
      workflow: 'smart-director-chain',
      reference: 'ViMAX director chain',
    });

    startTask(taskId);
    updateTaskProgress(taskId, 15, '导演读本', '绘影精灵正在把创意收束成导演/编剧/制片/镜头协作链');

    const generated = generateShotsFromUserPrompt(prompt, duration, {
      maxShotDuration: segmentDuration,
      preferredSceneType: sceneType,
    });

    updateTaskProgress(taskId, 48, '编剧拆镜', '已生成镜头段落、字幕和旁白草案');

    const visualAnchors = generated.visualAnchors as Array<{ element: string; category: string }>;
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

    updateTaskProgress(taskId, 72, '制片建档', '正在把剧本、角色、场景、道具、分镜和任务写成可追踪项目资产');

    const directorChain = buildSmartDirectorChain({
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
      shots: generated.shots,
      productionProject,
    });

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

    const flow = {
      mode: 'director-chain',
      reference: 'ViMAX',
      agentCount: directorChain.agents.length,
      agents: directorChain.agents.map(agent => ({
        role: agent.role,
        title: agent.title,
        objective: agent.objective,
      })),
      stages: productionProject.stages.map(stage => ({
        id: stage.id,
        name: stage.name,
        status: stage.status === 'ready' ? 'completed' : stage.status,
        summary: stage.summary,
      })),
      shotCount: shots.length,
      totalDuration: productionProject.storyboard.totalDuration,
      nextStep: directorChain.handoff.nextAction,
    };
    const storyReadability = evaluateStoryReadability({
      productionProject,
      threshold: 80,
    });

    updateTaskProgress(taskId, 90, '导演链路完成', '导演、编剧、制片和镜头设计结果已写入任务中心');
    completeTask(taskId, {
      content: JSON.stringify({ directorChain, productionProject, flow, storyReadability }, null, 2),
      directorChain,
      shots,
      productionProject,
      productionFlow: flow,
      storyReadability,
      project: {
        id: productionProject.id,
        title: productionProject.title,
        style,
        ratio,
        sceneType,
        narrativeSummary: generated.narrativeSummary,
        assetCount: productionProject.assets.length,
        stageCount: productionProject.stages.length,
      },
    });

    return NextResponse.json({
      success: true,
      usedRealKey: false,
      incurredCost: false,
      taskId,
      task: getTask(taskId),
      directorChain,
      productionProject,
      flow,
      storyReadability,
      shots,
    });
  } catch (error) {
    console.error('[Smart Director Chain] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '绘影精灵导演链路生成失败',
      },
      { status: 500 },
    );
  }
}
