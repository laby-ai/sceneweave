import {
  completeTask,
  createTask,
  failTask,
  getAllTasksForOwner,
  getTaskForOwner,
  startTask,
  updateTask,
  type TaskResult,
  type TaskOwner,
} from '@/lib/task-manager';
import type { ProductionAssemblyPlan } from '@/lib/production-assembly-plan';
import { freshArtifactReadiness } from '@/lib/production-artifact-stale';
import type { ProductionProject } from '@/lib/production-project';
import { applySegmentAssetWriteback, type SegmentAssetWritebackPatch } from '@/lib/production-segment-assets';
import {
  approveVimaxProductionRender,
  recordVimaxSuccessfulRender,
} from '@/lib/skills/vimax-short-drama/vimax-render-delivery-lock';
import type { VimaxRenderReport } from '@/lib/skills/vimax-short-drama/vimax-production-plan';

interface PersistedVideoSegment {
  shotIndex: number;
  status?: string;
  taskId?: string;
  videoUrl?: string;
  lastFrameUrl?: string;
}

type CanonicalVideoTaskResult = Omit<TaskResult, 'assemblyPlan'> & {
  assemblyPlan?: ProductionAssemblyPlan;
  productionProject?: ProductionProject;
  productionPlan?: unknown;
  vimaxHappyHorseSegments?: PersistedVideoSegment[];
  vimaxVideoResult?: object;
};

interface CreateVimaxVideoTaskRuntimeInput<Result extends object, Segment extends PersistedVideoSegment> {
  owner: TaskOwner;
  parentTaskId: string;
  totalShots: number;
  prompt: string;
  ratio: string;
  resolution: string;
  modelId: string;
  execute: (
    persistSegment: (segment: Segment) => void,
    signal: AbortSignal,
  ) => Promise<Result>;
}

export function createVimaxVideoTaskRuntime<
  Result extends object,
  Segment extends PersistedVideoSegment,
>(input: CreateVimaxVideoTaskRuntimeInput<Result, Segment>) {
  const updateParentVideoTaskState = (
    backgroundTaskId: string,
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
  ) => {
    const parent = getTaskForOwner(input.parentTaskId, input.owner);
    if (!parent) return;
    updateTask(input.parentTaskId, {
      result: {
        ...(parent.result || {}),
        vimaxVideoTaskId: backgroundTaskId,
        vimaxVideoTaskStatus: status,
      },
    });
  };

  const persistSegment = (segment: Segment, backgroundTaskId?: string) => {
    const latest = getTaskForOwner(input.parentTaskId, input.owner);
    const existing = Array.isArray(latest?.result?.vimaxHappyHorseSegments)
      ? latest.result.vimaxHappyHorseSegments as Segment[]
      : [];
    const next = [...existing.filter(item => item.shotIndex !== segment.shotIndex), segment]
      .sort((left, right) => left.shotIndex - right.shotIndex);
    const currentResult = {
      ...(latest?.result || {}),
      vimaxHappyHorseSegments: next,
    } as CanonicalVideoTaskResult;
    const productionProject = currentResult.productionProject;
    const assemblyPlan = currentResult.assemblyPlan;
    if (productionProject && assemblyPlan?.version === 'yh-assembly-plan-v1') {
      const storyboardShot = productionProject.storyboard.shots.find(shot => shot.index === segment.shotIndex);
      const assemblySegment = assemblyPlan.segments.find(item => item.shotId === storyboardShot?.id)
        || assemblyPlan.segments[segment.shotIndex - 1];
      if (assemblySegment) {
        const now = new Date().toISOString();
        const succeeded = segment.status === 'succeeded' && Boolean(segment.videoUrl);
        const patch: SegmentAssetWritebackPatch = {
          status: succeeded ? 'completed' : 'running',
          startedAt: assemblySegment.startedAt || now,
          ...(succeeded ? { completedAt: now, artifactReadiness: freshArtifactReadiness(productionProject) } : {}),
          expectedOutputs: {
            providerTaskId: segment.taskId || assemblySegment.expectedOutputs.providerTaskId,
            ...(segment.videoUrl ? { videoUrl: segment.videoUrl } : {}),
            ...(segment.lastFrameUrl ? { lastFrameUrl: segment.lastFrameUrl } : {}),
          },
        };
        const writeback = applySegmentAssetWriteback({
          assemblyPlan,
          segmentIndex: assemblySegment.index,
          patch,
        });
        currentResult.assemblyPlan = writeback.assemblyPlan;
      }
    }
    if (!updateTask(input.parentTaskId, {
      result: currentResult as TaskResult,
    })) throw new Error('视频任务恢复信息保存失败，已停止继续提交后续镜头。');
    if (!backgroundTaskId) return;

    const backgroundTask = getTaskForOwner(backgroundTaskId, input.owner);
    if (!backgroundTask) throw new Error('后台视频任务不存在或无权访问。');
    const completedShots = next.filter(item => item.status === 'succeeded').length;
    const progress = Math.min(90, 10 + Math.round((completedShots / input.totalShots) * 75));
    if (!updateTask(backgroundTaskId, {
      progress,
      stage: segment.status === 'succeeded'
        ? `镜头 ${completedShots}/${input.totalShots} 已完成`
        : `镜头 ${segment.shotIndex}/${input.totalShots} 已提交`,
      message: segment.status === 'succeeded'
        ? '正在继续生成下一镜并保持连续性。'
        : '供应商任务号已保存，可安全刷新或稍后恢复。',
      result: { ...(backgroundTask.result || {}), parentTaskId: input.parentTaskId, vimaxHappyHorseSegments: next },
    })) throw new Error('后台视频进度保存失败，已停止继续提交后续镜头。');
    if (getTaskForOwner(backgroundTaskId, input.owner)?.status === 'cancelled') {
      throw new Error('video_background_cancelled');
    }
  };

  const assertActive = (backgroundTaskId: string | undefined, signal: AbortSignal) => {
    if (signal.aborted
      || (backgroundTaskId && getTaskForOwner(backgroundTaskId, input.owner)?.status === 'cancelled')) {
      throw new Error('video_background_cancelled');
    }
  };

  const execute = async (
    backgroundTaskId?: string,
    signal: AbortSignal = new AbortController().signal,
  ) => {
    assertActive(backgroundTaskId, signal);
    const result = await input.execute(
      segment => persistSegment(segment, backgroundTaskId),
      signal,
    );
    assertActive(backgroundTaskId, signal);
    const parent = getTaskForOwner(input.parentTaskId, input.owner);
    const currentResult = {
      ...(parent?.result || {}),
      vimaxVideoResult: result,
    } as CanonicalVideoTaskResult;
    const final = result as {
      videoUrl?: string;
      merge?: { renderReport?: Omit<VimaxRenderReport, 'artifactVersion'> };
    };
    const assemblyPlan = currentResult.assemblyPlan as ProductionAssemblyPlan | undefined;
    if (assemblyPlan?.version === 'yh-assembly-plan-v1' && final.videoUrl) {
      currentResult.assemblyPlan = {
        ...assemblyPlan,
        assembly: { ...assemblyPlan.assembly, outputUrl: final.videoUrl },
      };
    }
    if (!updateTask(input.parentTaskId, {
      result: currentResult as TaskResult,
    })) throw new Error('完整短剧结果保存失败。');
    assertActive(backgroundTaskId, signal);
    if (final.videoUrl && final.merge?.renderReport) {
      const latest = getTaskForOwner(input.parentTaskId, input.owner);
      const latestResult = latest?.result as CanonicalVideoTaskResult | undefined;
      const productionProject = latestResult?.productionProject;
      const latestAssemblyPlan = latestResult?.assemblyPlan;
      if (!latestResult || !productionProject || !latestAssemblyPlan) throw new Error('成片已保存，但项目制作状态不完整，未开放交付。');
      const approved = approveVimaxProductionRender(latestResult.productionPlan, {
        productionProject,
        assemblyPlan: latestAssemblyPlan,
      });
      const productionPlan = recordVimaxSuccessfulRender(approved, {
        productionProject,
        assemblyPlan: latestAssemblyPlan,
        videoUrl: final.videoUrl,
        completedAt: new Date().toISOString(),
        renderReport: final.merge.renderReport,
      });
      if (!updateTask(input.parentTaskId, {
        result: { ...latestResult, productionPlan } as TaskResult,
      })) throw new Error('成片已保存，但最后成功交付状态写回失败。');
    }
    return result;
  };

  const launchBackground = (backgroundTaskId: string, controller: AbortController) => {
    updateTask(backgroundTaskId, {
      progress: 5,
      stage: '视频任务已受理',
      message: '页面可以安全刷新，生成进度会从任务中心继续恢复。',
      result: { parentTaskId: input.parentTaskId },
    });
    const parent = getTaskForOwner(input.parentTaskId, input.owner);
    if (!parent || !updateTask(input.parentTaskId, {
      result: {
        ...(parent.result || {}),
        vimaxVideoTaskId: backgroundTaskId,
        vimaxVideoTaskStatus: 'running',
      },
    })) throw new Error('视频与成片任务号保存失败。');
    const cancellationWatch = setInterval(() => {
      if (getTaskForOwner(backgroundTaskId, input.owner)?.status === 'cancelled') {
        controller.abort('video_background_cancelled');
      }
    }, 100);
    cancellationWatch.unref?.();
    void execute(backgroundTaskId, controller.signal).then(result => {
      const latest = getTaskForOwner(backgroundTaskId, input.owner);
      if (!latest || latest.status === 'cancelled') return;
      completeTask(backgroundTaskId, {
        ...(latest.result || {}),
        parentTaskId: input.parentTaskId,
        vimaxVideoResult: result,
      });
      updateParentVideoTaskState(backgroundTaskId, 'completed');
    }).catch(error => {
      if (getTaskForOwner(backgroundTaskId, input.owner)?.status === 'cancelled') {
        updateParentVideoTaskState(backgroundTaskId, 'cancelled');
        return;
      }
      failTask(backgroundTaskId, error instanceof Error ? error.message : '后台视频生成失败');
      updateParentVideoTaskState(backgroundTaskId, 'failed');
    }).finally(() => {
      clearInterval(cancellationWatch);
    });
  };

  const startBackground = () => {
    const active = getAllTasksForOwner(input.owner).find(task => (
      task.config.parentTaskId === input.parentTaskId
      && task.config.workflow === 'vimax-agent-video'
      && (task.status === 'pending' || task.status === 'running')
    ));
    if (active?.status === 'running') return active.id;

    const taskId = active?.id || createTask('video', {
      parentTaskId: input.parentTaskId,
      workflow: 'vimax-agent-video',
      prompt: input.prompt,
      ratio: input.ratio,
      resolution: input.resolution,
      modelId: input.modelId,
    }, input.owner);
    const controller = new AbortController();
    if (!startTask(taskId, controller)) {
      const latest = getTaskForOwner(taskId, input.owner);
      if (latest?.status === 'running') return taskId;
      throw new Error('后台视频任务无法进入运行状态。');
    }
    updateParentVideoTaskState(taskId, 'running');
    launchBackground(taskId, controller);
    return taskId;
  };

  return { execute, startBackground };
}
