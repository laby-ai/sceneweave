import {
  submitVideoWithBYOK,
  waitForVideoWithBYOK,
  type BYOKConnection,
  type BYOKVideoTask,
  type BYOKVideoParams,
  type BYOKVideoStatus,
} from '@/lib/byok-provider';

export interface BuildBYOKVideoSubmitParamsInput {
  prompt: string;
  videoModel?: string;
  duration?: number;
  ratio?: string;
  firstFrameUrl?: string;
  inputLastFrameUrl?: string;
  materials?: string[];
  characterRefUrls?: string[];
}

export interface RunBYOKVideoSubmitInput extends BuildBYOKVideoSubmitParamsInput {
  connection: BYOKConnection;
  onSubmitted?: (task: BYOKVideoTask) => void;
  onProgress?: (status: BYOKVideoStatus, attempt: number) => void;
}

export interface RunBYOKVideoSubmitResult {
  provider: 'byok';
  videoUrl: string;
  lastFrameUrl?: string;
  providerTaskId: string;
  model: string;
}

export function clampVideoSubmitDuration(duration: unknown) {
  const numericDuration = typeof duration === 'number' ? duration : Number(duration);
  if (!Number.isFinite(numericDuration)) return 5;
  return Math.min(Math.max(numericDuration, 5), 40);
}

export function buildBYOKVideoSubmitParams(input: BuildBYOKVideoSubmitParamsInput): BYOKVideoParams {
  return {
    prompt: input.prompt.trim(),
    model: input.videoModel,
    duration: clampVideoSubmitDuration(input.duration),
    ratio: input.ratio || '16:9',
    firstFrameImage: input.firstFrameUrl || input.materials?.[0],
    lastFrameImage: input.inputLastFrameUrl,
    referenceImages: input.characterRefUrls?.slice(0, 3),
  };
}

export async function runBYOKVideoSubmit(input: RunBYOKVideoSubmitInput): Promise<RunBYOKVideoSubmitResult> {
  const submitResult = await submitVideoWithBYOK(
    input.connection,
    buildBYOKVideoSubmitParams(input)
  );
  input.onSubmitted?.(submitResult);
  const videoResult = await waitForVideoWithBYOK(
    input.connection,
    submitResult.taskId,
    input.onProgress,
    { maxAttempts: 180, intervalMs: 3000 }
  );

  return {
    provider: 'byok',
    videoUrl: videoResult.videoUrl,
    lastFrameUrl: videoResult.lastFrameUrl,
    providerTaskId: submitResult.taskId,
    model: submitResult.model,
  };
}
