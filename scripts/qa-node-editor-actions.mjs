import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const nodeEditorPath = path.resolve('src/app/node-editor/page.tsx');
const productionCanvasBridgePath = path.resolve('src/hooks/useProductionCanvasBridge.ts');
const nodeActionStripPath = path.resolve('src/components/node-editor/node-action-strip.tsx');
const nodePropertiesMediaSectionsPath = path.resolve('src/components/node-editor/node-properties-media-sections.tsx');
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function acquireLock() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
  try {
    lockFd = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(lockFd, JSON.stringify({
      pid: process.pid,
      script: 'qa-node-editor-actions',
      startedAt: new Date().toISOString(),
    }));
  } catch {
    throw new Error(`节点动作 QA 正在运行或上次异常退出未清理锁文件：${lockFile}`);
  }
}

function releaseLock() {
  if (lockFd !== null) {
    fs.closeSync(lockFd);
    lockFd = null;
  }
  if (fs.existsSync(lockFile)) fs.rmSync(lockFile, { force: true });
}

function restoreTasksFile(content) {
  const tempFile = `${tasksFile}.node-editor-actions.restore.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, content, 'utf8');
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      fs.renameSync(tempFile, tasksFile);
      return;
    } catch (error) {
      if (attempt === 10) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 80);
    }
  }
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON: ${text.slice(0, 240)}`);
  }
  return { res, json };
}

const source = [
  fs.readFileSync(nodeEditorPath, 'utf8'),
  fs.readFileSync(productionCanvasBridgePath, 'utf8'),
  fs.readFileSync(nodeActionStripPath, 'utf8'),
  fs.readFileSync(nodePropertiesMediaSectionsPath, 'utf8'),
].join('\n');
const requiredMarkers = [
  '/api/production/assembly-plan/segment/retry',
  '/api/production/assembly-plan/segment/recover-provider-task',
  '/api/production/assembly-plan/segment/recover-tail-frame',
  '/api/tasks/',
  '/merge-segments',
  'node-action-retry-segment-',
  'node-action-recover-provider-task-',
  'node-action-recover-tail-frame-',
  'node-action-merge-segments-',
  '重排队',
  '查供应商',
  '恢复尾帧',
  '合成',
  'huiying-node-action-completed',
  '正在生成真实 cut-draft 导出包',
  '画布不再生成模拟视频',
  'production-video-asset-detail',
  'production-audio-event-contract',
  '声音事件合约',
  'production-video-preview',
  '该节点来自制作项目资产，重新生成请从失败片段恢复或 assemblyPlan 队列进入',
];

for (const marker of requiredMarkers) {
  assert(source.includes(marker), `node editor source missing action marker: ${marker}`);
}

const forbiddenMarkers = [
  '模拟视频导出过程',
  '模拟生成视频节点',
  '视频节点已添加到画布中',
  '在实际应用中，这里会提供下载链接',
];
for (const marker of forbiddenMarkers) {
  assert(!source.includes(marker), `node editor still contains fake export marker: ${marker}`);
}

acquireLock();
let originalExists = false;
let originalContent = null;
try {
  originalExists = fs.existsSync(tasksFile);
  originalContent = originalExists ? fs.readFileSync(tasksFile, 'utf8') : null;

  const casesResponse = await fetchJson(`${baseUrl}/api/production/case-assets?limit=12`);
  assert(casesResponse.res.ok, `case-assets endpoint failed: ${casesResponse.res.status}`);
  const cases = Array.isArray(casesResponse.json?.cases) ? casesResponse.json.cases : [];
  const finalVideo = cases.find(item => item.source === 'productionProject.assets.finalVideo' && item.taskId);
  assert(finalVideo, 'no finalVideo production case available for node action QA');

  const canvasResponse = await fetchJson(
    `${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(finalVideo.taskId)}`,
  );
  assert(canvasResponse.res.ok, `production canvas endpoint failed: ${canvasResponse.res.status}`);
  assert(canvasResponse.json?.success === true, 'production canvas success flag missing');

  const nodes = Array.isArray(canvasResponse.json?.canvas?.nodes) ? canvasResponse.json.canvas.nodes : [];
  const videoSegmentNode = nodes.find(node => node?.data?.assetKind === 'videoSegment' && Number.isFinite(Number(node?.data?.segmentIndex)));
  const finalVideoNode = nodes.find(node => node?.data?.assetKind === 'finalVideo' && node?.data?.videoUrl);
  assert(videoSegmentNode, 'canvas missing actionable videoSegment node with segmentIndex');
  assert(finalVideoNode, 'canvas missing actionable finalVideo node');
  assert(videoSegmentNode.data.productionTaskId === finalVideo.taskId, 'videoSegment node missing parent production task id');
  assert(Number.isFinite(Number(videoSegmentNode.data.segmentIndex)), 'videoSegment node missing numeric segmentIndex');
  assert(typeof videoSegmentNode.data.productionAssetId === 'string', 'videoSegment node missing production asset id');
  assert(typeof videoSegmentNode.data.videoUrl === 'string' && videoSegmentNode.data.videoUrl.length > 0, 'videoSegment node missing videoUrl');
  assert(finalVideoNode.data.productionTaskId === finalVideo.taskId, 'finalVideo node missing parent production task id');

  const retryProbe = await fetchJson(`${baseUrl}/api/production/assembly-plan/segment/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parentTaskId: videoSegmentNode.data.productionTaskId,
      segmentIndex: Number(videoSegmentNode.data.segmentIndex),
    }),
  });
  assert(retryProbe.res.status === 409, `completed segment retry should be rejected, got: ${retryProbe.res.status}`);
  assert(retryProbe.json?.usedRealKey === false, 'segment retry probe unexpectedly used real key');
  assert(retryProbe.json?.incurredCost === false, 'segment retry probe unexpectedly incurred cost');
  assert(retryProbe.json?.success === false, 'completed segment retry should be rejected without cost');
  assert(String(retryProbe.json?.error || '').includes('已有完成视频'), 'completed segment retry error should explain preserved video asset');

  const exportProbe = await fetchJson(
    `${baseUrl}/api/production/export?taskId=${encodeURIComponent(finalVideo.taskId)}&format=cut-draft-json`,
  );
  assert(exportProbe.res.ok, `production export probe failed: ${exportProbe.res.status}`);
  assert(exportProbe.json?.success === true, 'production export probe success flag missing');
  assert(exportProbe.json?.format === 'cut-draft-json', 'production export probe format mismatch');

  const videoAssetWriteback = await fetchJson(
    `${baseUrl}/api/production/projects/${encodeURIComponent(finalVideo.taskId)}/assets/${encodeURIComponent(videoSegmentNode.data.productionAssetId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: `QA 片段资产写回保护 ${Date.now()}`,
        metadata: {
          qaProbe: 'node-editor-video-segment-writeback',
          canvasNodeId: videoSegmentNode.id,
          audioEventContract: {
            dialogueType: 'dialogue',
            lipSyncPolicy: 'lip-sync-active',
            mustGenerateAudioTrack: true,
            expectedAudioEvidence: ['对白原文=QA node-editor writeback', '环境音/音效=QA rail ambience'],
            providerInstruction: 'QA audio event contract from node editor writeback',
          },
        },
      }),
    },
  );
  assert(videoAssetWriteback.res.ok, `video segment asset writeback failed: ${videoAssetWriteback.res.status}`);
  assert(videoAssetWriteback.json?.success === true, 'video segment asset writeback success flag missing');
  assert(videoAssetWriteback.json?.usedRealKey === false, 'video segment asset writeback unexpectedly used real key');
  assert(videoAssetWriteback.json?.incurredCost === false, 'video segment asset writeback unexpectedly incurred cost');
  assert(videoAssetWriteback.json?.asset?.metadata?.videoUrl === videoSegmentNode.data.videoUrl, 'video segment writeback lost videoUrl metadata');
  assert(videoAssetWriteback.json?.asset?.metadata?.segmentIndex === videoSegmentNode.data.segmentIndex, 'video segment writeback lost segmentIndex metadata');
  assert(videoAssetWriteback.json?.asset?.metadata?.qaProbe === 'node-editor-video-segment-writeback', 'video segment writeback did not merge probe metadata');
  assert(
    videoAssetWriteback.json?.asset?.metadata?.audioEventContract?.providerInstruction === 'QA audio event contract from node editor writeback',
    'video segment writeback lost audioEventContract metadata',
  );

  const refreshedCanvasAfterWriteback = await fetchJson(
    `${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(finalVideo.taskId)}`,
  );
  assert(refreshedCanvasAfterWriteback.res.ok, `refreshed production canvas failed: ${refreshedCanvasAfterWriteback.res.status}`);
  const refreshedVideoSegmentNode = (refreshedCanvasAfterWriteback.json?.canvas?.nodes || [])
    .find(node => node?.data?.productionAssetId === videoSegmentNode.data.productionAssetId);
  assert(refreshedVideoSegmentNode?.data?.videoUrl === videoSegmentNode.data.videoUrl, 'refreshed canvas lost video segment videoUrl after writeback');
  assert(
    refreshedVideoSegmentNode?.data?.audioEventContract?.providerInstruction === 'QA audio event contract from node editor writeback',
    'refreshed canvas lost audioEventContract after node-editor writeback',
  );

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    usedRealKey: false,
    incurredCost: false,
    taskId: finalVideo.taskId,
    nodeCount: nodes.length,
    videoSegmentNodeId: videoSegmentNode.id,
    finalVideoNodeId: finalVideoNode.id,
    retryProbeStatus: retryProbe.res.status,
    exportFormat: exportProbe.json.format,
    videoSegmentWritebackPreservedUrl: true,
    videoSegmentWritebackPreservedAudioEventContract: true,
    actionMarkers: requiredMarkers,
    fakeExportMarkersRemoved: forbiddenMarkers,
  }, null, 2));
} finally {
  if (originalExists) {
    restoreTasksFile(originalContent);
  } else if (fs.existsSync(tasksFile)) {
    fs.rmSync(tasksFile, { force: true });
  }
  releaseLock();
}
