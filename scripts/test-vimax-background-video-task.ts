import assert from 'node:assert/strict';

import { waitForVimaxBackgroundVideoTask } from '../src/lib/skills/vimax-short-drama/vimax-background-video-task';

const originalFetch = globalThis.fetch;
const streamUrls: string[] = [];
let taskReads = 0;

const sse = (body: string) => new Response(body, {
  status: 200,
  headers: { 'content-type': 'text/event-stream' },
});

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('/events')) {
    streamUrls.push(url);
    return streamUrls.length === 1
      ? sse('id: 3\nevent: task\ndata: {"task":{"id":"video-child","status":"running","stage":"镜头 1/3 已完成","progress":35,"message":"继续生成"}}\n\n')
      : sse('id: 4\nevent: done\ndata: {"task":{"id":"video-child","status":"completed","stage":"已完成","progress":100,"message":"成片可用"}}\n\n');
  }
  if (url.endsWith('/api/tasks/video-child')) {
    taskReads += 1;
    return new Response(JSON.stringify(taskReads === 1 ? {
      task: { id: 'video-child', status: 'running' },
    } : {
      task: {
        id: 'video-child',
        status: 'completed',
        result: {
          vimaxVideoResult: {
            videoUrl: '/media/final.mp4',
            model: 'fixture-video',
            segments: [{ shotIndex: 1, videoUrl: '/media/a.mp4' }],
          },
        },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error(`unexpected fetch ${url}`);
}) as typeof fetch;

async function main() {
  const progress: number[] = [];
  const result = await waitForVimaxBackgroundVideoTask({
    taskId: 'video-child',
    requestId: 'request-1',
    headers: { 'x-paper-host-guest-workspace': 'fixture-workspace' },
    onProgress: event => progress.push(event.progress ?? 0),
  });
  assert.equal(result.videoUrl, '/media/final.mp4');
  assert.deepEqual(progress, [35, 100]);
  assert.equal(streamUrls.length, 2);
  assert.equal(streamUrls[0], '/api/tasks/video-child/events');
  assert.equal(streamUrls[1], '/api/tasks/video-child/events?afterSeq=3');
  assert.equal(taskReads, 2);
  console.log(JSON.stringify({ ok: true, streamUrls, progress, providerCalls: 0 }));
}

main().finally(() => {
  globalThis.fetch = originalFetch;
});
