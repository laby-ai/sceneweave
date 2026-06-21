import { recoverProductionSegmentTailFrame } from '../src/lib/production-segment-tail-recovery';

function parseChildTaskId() {
  const fromArg = process.argv
    .slice(2)
    .find(arg => arg.startsWith('--childTaskId='))
    ?.split('=')
    .slice(1)
    .join('=');
  const childTaskId = fromArg || process.env.HUIYING_RECOVER_CHILD_TASK_ID;
  if (!childTaskId) {
    throw new Error('Usage: pnpm run ops:recover-segment-tail-frame -- --childTaskId=<task-id>');
  }
  return childTaskId;
}

function summarizeUrl(value?: string | null) {
  if (!value) return null;
  if (value.startsWith('data:image/')) return 'data:image/[base64-redacted]';
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '[redacted-url]';
  }
}

async function main() {
  const childTaskId = parseChildTaskId();
  const result = await recoverProductionSegmentTailFrame({ childTaskId });

  console.log(JSON.stringify({
    success: result.success,
    usedRealKey: result.usedRealKey,
    incurredCost: result.incurredCost,
    parentTaskId: result.parentTaskId,
    childTaskId: result.childTaskId,
    segmentIndex: result.segmentIndex,
    lastFrameSource: result.lastFrameSource,
    uploadSource: result.uploadSource,
    nextSegmentFirstFrameUrl: summarizeUrl(result.nextSegmentFirstFrameUrl),
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
