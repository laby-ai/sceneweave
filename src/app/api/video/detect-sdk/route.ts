import { NextRequest, NextResponse } from 'next/server';

type DetectionStatus = 'idle' | 'running' | 'completed' | 'failed';
type StepStatus = 'pending' | 'testing' | 'success' | 'failed' | 'skipped';
type Strategy = 'conservative' | 'balanced' | 'aggressive';

interface DetectionStep {
  duration: number;
  status: StepStatus;
  error?: string;
  taskId?: string;
  startTime?: number;
  endTime?: number;
  durationSeconds?: number;
}

interface DetectionResult {
  detectedMaxDuration: number | null;
  recommendedStrategy: Strategy;
  steps: DetectionStep[];
  status: DetectionStatus;
  error?: string;
  startTime?: number;
  endTime?: number;
}

const detectionSessions = new Map<string, DetectionResult>();

const SEEDANCE_READINESS_DURATIONS = [5, 10, 15, 20, 30];
const DEFAULT_MAX_DURATION = 30;

function hasArkByokEnv(): boolean {
  return Boolean(
    process.env.HUIYING_REAL_ARK_API_KEY ||
    process.env.ARK_API_KEY ||
    process.env.HUIYING_ARK_API_KEY,
  );
}

function resolveModel(): string {
  return process.env.ARK_VIDEO_MODEL ||
    process.env.HUIYING_ARK_VIDEO_MODEL ||
    'doubao-seedance-1-5-pro-251215';
}

function buildReadinessSession(maxTestDuration: number): DetectionResult {
  const startedAt = Date.now();
  const model = resolveModel();
  const hasKey = hasArkByokEnv();
  const maxDuration = Math.min(Math.max(maxTestDuration || DEFAULT_MAX_DURATION, 5), DEFAULT_MAX_DURATION);
  const durations = SEEDANCE_READINESS_DURATIONS.filter(duration => duration <= maxDuration);

  return {
    detectedMaxDuration: hasKey ? Math.max(...durations) : null,
    recommendedStrategy: hasKey ? 'balanced' : 'conservative',
    status: hasKey ? 'completed' : 'failed',
    startTime: startedAt,
    endTime: Date.now(),
    error: hasKey ? undefined : '未检测到 Ark BYOK 环境变量，无法确认真实生成能力',
    steps: durations.map(duration => ({
      duration,
      status: hasKey ? 'success' : duration === 5 ? 'failed' : 'skipped',
      taskId: `readiness:${model}:${duration}s`,
      startTime: startedAt,
      endTime: Date.now(),
      durationSeconds: 0,
      error: hasKey ? undefined : 'missing-ark-byok-env',
    })),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = typeof body.sessionId === 'string' && body.sessionId
      ? body.sessionId
      : `ark-readiness-${Date.now()}`;
    const maxTestDuration = Number(body.maxTestDuration || DEFAULT_MAX_DURATION);
    const session = buildReadinessSession(maxTestDuration);

    detectionSessions.set(sessionId, session);

    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Ark/Seedance readiness 已完成；未触发真实视频生成',
      session,
    });
  } catch (error) {
    console.error('[Ark Readiness Detection] 启动失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '启动检测失败' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: '缺少sessionId参数' }, { status: 400 });
  }

  const session = detectionSessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: '未找到检测会话' }, { status: 404 });
  }

  return NextResponse.json({ success: true, session });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (sessionId) {
    detectionSessions.delete(sessionId);
  } else {
    detectionSessions.clear();
  }

  return NextResponse.json({ success: true });
}
