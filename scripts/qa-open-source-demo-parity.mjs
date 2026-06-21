#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { evaluateStoryReadability } from './story-readability-score.mjs';
import { getTrailerScriptPreset } from './trailer-script-presets.mjs';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
const presetId = process.env.HUIYING_PARITY_TRAILER_PRESET || 'last-train';
const presetSeconds = Number(process.env.HUIYING_PARITY_SECONDS || '30');
const preset = getTrailerScriptPreset(presetId, presetSeconds);

let lockFd = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function acquireLock() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
  try {
    lockFd = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(lockFd, JSON.stringify({
      pid: process.pid,
      script: 'qa-open-source-demo-parity',
      startedAt: new Date().toISOString(),
    }));
  } catch {
    throw new Error(`开源 demo 对齐 QA 正在运行或上次异常退出未清理锁文件：${lockFile}`);
  }
}

function releaseLock() {
  if (lockFd !== null) {
    fs.closeSync(lockFd);
    lockFd = null;
  }
  if (fs.existsSync(lockFile)) fs.rmSync(lockFile, { force: true });
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

function assertBridgeMarkers(segments) {
  const markers = ['【观众检查点】', '【入点状态】', '【上一段画面记忆】', '【出点状态】', '【下一段触发点】', '【桥接动作】', '【剪辑衔接】'];
  assert(segments.every(segment => markers.every(marker => segment.prompt.includes(marker))), 'assembly segments missing bridge markers');
}

function assertTrailerEntityQuality(project) {
  const protagonist = project.storyBible?.protagonist || '';
  const projectText = JSON.stringify(project);
  assert(!/(书包|胶片|列车|旧桥|按钮|电梯|档案袋)$/.test(protagonist), `object extracted as protagonist: ${protagonist}`);
  assert(projectText.includes('年轻急救员') || projectText.includes('审计师'), 'project missing human protagonist anchor');
  assert(projectText.includes('红色书包') || projectText.includes('红色档案袋'), 'project missing visible story prop anchor');
}

const results = [];
let lockAcquired = false;
let originalExists = false;
let originalContent = null;
let createdTaskId = null;
let childTaskIds = [];

try {
  acquireLock();
  lockAcquired = true;
  originalExists = fs.existsSync(tasksFile);
  originalContent = originalExists ? fs.readFileSync(tasksFile, 'utf8') : null;

  const director = await fetchJson(`${baseUrl}/api/smart/director-chain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: preset.prompt,
      duration: preset.duration,
      segmentDuration: 10,
      style: preset.style,
      sceneType: preset.sceneType,
      ratio: preset.ratio,
    }),
  });
  assert(director.res.ok, `ViMAX path director-chain failed: ${director.res.status}`);
  assert(director.json?.success === true, 'ViMAX path success mismatch');
  assert(director.json.usedRealKey === false, 'ViMAX path unexpectedly used real key');
  assert(director.json.incurredCost === false, 'ViMAX path unexpectedly incurred cost');
  assert(director.json.storyReadability?.score >= 80, 'ViMAX path missing initial story readability score');
  createdTaskId = director.json.taskId;

  const project = director.json.productionProject;
  assert(project?.storyBible, 'ViMAX path missing storyBible');
  assert(project?.semanticPlan?.reference?.primary === 'ViMax', 'ViMAX path semantic reference mismatch');
  assert(project.storyBible.trailerBeatSheet?.version === 'yh-trailer-beat-sheet-v1', 'ViMAX path missing trailerBeatSheet');
  assert(project.storyBible.trailerBeatSheet.beats.length >= 5, 'ViMAX path trailerBeatSheet too sparse');
  assert(project.storyBible.trailerBeatSheet.beats.every(beat => beat.viewerCheckpoint && beat.imageHandoff && beat.storyQuestion), 'ViMAX path trailer beats missing viewer checkpoint or image handoff');
  assert(Array.isArray(director.json.directorChain?.agents) && director.json.directorChain.agents.length >= 4, 'ViMAX path missing multi-agent artifacts');
  assert(director.json.directorChain.agents.some(agent => agent.role === 'screenwriter'), 'ViMAX path missing screenwriter');
  assert(director.json.directorChain.agents.some(agent => agent.role === 'director'), 'ViMAX path missing director');
  assert(director.json.directorChain.agents.some(agent => agent.role === 'producer'), 'ViMAX path missing producer');
  assert(director.json.directorChain.agents.some(agent => agent.role === 'cinematographer'), 'ViMAX path missing cinematographer');
  assertTrailerEntityQuality(project);

  results.push({
    referenceDemo: 'ViMAX',
    approach: 'direct-director-chain',
    ok: true,
    taskId: createdTaskId,
    agentRoles: director.json.directorChain.agents.map(agent => agent.role).sort(),
    protagonist: project.storyBible.protagonist,
    trailerBeatCount: project.storyBible.trailerBeatSheet.beats.length,
    assetKinds: [...new Set((project.assets || []).map(asset => asset.kind))],
    demoEffect: '创意/预告片脚本直接生成可审计 storyBible、角色、场景、分镜和导演链 artifacts，不依赖拖拉拽。',
  });

  await sleep(1200);

  const assembly = await fetchJson(`${baseUrl}/api/production/assembly-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: createdTaskId, persist: true }),
  });
  assert(assembly.res.ok, `ArcReel plan path failed: ${assembly.res.status}`);
  assert(assembly.json?.success === true, 'ArcReel plan success mismatch');
  assert(assembly.json.storyReadability?.pass === true, 'ArcReel plan did not return passing story readability gate');
  const segments = assembly.json.assemblyPlan?.segments || [];
  assert(segments.length >= 3, 'ArcReel plan missing segments');
  assertBridgeMarkers(segments);
  assert(assembly.json.assemblyPlan.bridgePlan?.version === 'yh-segment-bridge-plan-v1', 'ArcReel plan missing bridgePlan');
  assert(assembly.json.assemblyPlan.bridgePlan.bridges.length === segments.length, 'ArcReel bridgePlan count mismatch');
  assert(assembly.json.assemblyPlan.bridgePlan.bridges.every(bridge => bridge.previousFrameMemory && bridge.nextFrameTrigger && bridge.viewerCheckpoint), 'ArcReel bridgePlan missing frame memory or viewer checkpoint');
  assert(segments.every(segment => segment.prompt.includes('【预告片节拍】') && segment.prompt.includes('【连续性检查】')), 'ArcReel segments missing trailer beat continuity constraints');

  const readability = evaluateStoryReadability(project, assembly.json.assemblyPlan, 80);
  assert(readability.pass, `story readability gate failed: ${JSON.stringify(readability.issues)}`);

  results[0].readabilityScore = readability.score;
  results[0].readabilityPass = readability.pass;

  await sleep(1200);

  const canvas = await fetchJson(`${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(createdTaskId)}`);
  assert(canvas.res.ok, `Toonflow canvas path failed: ${canvas.res.status}`);
  assert(canvas.json?.success === true, 'Toonflow canvas success mismatch');
  const nodes = canvas.json.canvas?.nodes || [];
  const nodeKinds = [...new Set(nodes.map(node => node?.data?.assetKind || node?.type).filter(Boolean))];
  for (const kind of ['script', 'character', 'scene', 'storyboard', 'task']) {
    assert(nodeKinds.includes(kind), `Toonflow canvas missing ${kind} node`);
  }
  assert(nodes.some(node => String(node?.data?.label || node?.data?.title || '').includes('年轻急救员') || JSON.stringify(node).includes('年轻急救员')), 'Toonflow canvas missing human protagonist node');
  assert(nodes.some(node => node?.data?.assetKind === 'storyReadability' && node?.data?.score >= 80), 'Toonflow canvas missing story readability gate node');
  assert(nodes.some(node => node?.data?.assetKind === 'trailerBeatSheet'), 'Toonflow canvas missing trailerBeatSheet node');
  assert(nodes.some(node => node?.data?.assetKind === 'segmentBridgePlan'), 'Toonflow canvas missing segmentBridgePlan node');

  results.push({
    referenceDemo: 'Toonflow-app',
    approach: 'project-canvas-workbench',
    ok: true,
    taskId: createdTaskId,
    nodeCount: nodes.length,
    nodeKinds,
    readabilityScore: readability.score,
    hasStoryReadabilityNode: true,
    hasTrailerBeatSheetNode: true,
    hasSegmentBridgePlanNode: true,
    demoEffect: '画布从真实 taskId 加载项目资产节点，用于组织剧本、角色、场景、分镜和后续任务；它是资产工作台，不是唯一创作入口。',
  });

  const queue = await fetchJson(`${baseUrl}/api/production/assembly-plan/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: createdTaskId, reset: true }),
  });
  assert(queue.res.ok, `ArcReel queue path failed: ${queue.res.status}`);
  assert(queue.json?.success === true, 'ArcReel queue success mismatch');
  assert(queue.json.usedRealKey === false, 'ArcReel queue unexpectedly used real key');
  assert(queue.json.incurredCost === false, 'ArcReel queue unexpectedly incurred cost');
  childTaskIds = queue.json.childTaskIds || [];
  assert(childTaskIds.length === segments.length, 'ArcReel queue child task count mismatch');
  assert(queue.json.segments.every(segment => typeof segment.taskId === 'string' && segment.taskId.length > 0), 'ArcReel queue missing child task id');

  const queuedCanvas = await fetchJson(`${baseUrl}/api/node-editor/production-canvas?taskId=${encodeURIComponent(createdTaskId)}`);
  assert(queuedCanvas.res.ok, `ArcReel queued canvas failed: ${queuedCanvas.res.status}`);
  const queuedNodes = queuedCanvas.json.canvas?.nodes || [];
  const assemblySegmentNodes = queuedNodes.filter(node => node?.data?.assetKind === 'assemblySegment');
  assert(assemblySegmentNodes.length === childTaskIds.length, 'ArcReel queued canvas missing assemblySegment nodes');

  const exportProbe = await fetchJson(`${baseUrl}/api/production/export?taskId=${encodeURIComponent(createdTaskId)}&format=cut-draft-json`);
  assert(exportProbe.res.ok, `ArcReel export path failed: ${exportProbe.res.status}`);
  assert(exportProbe.json?.success === true, 'ArcReel export success mismatch');
  assert(exportProbe.json?.format === 'cut-draft-json', 'ArcReel export format mismatch');
  assert(exportProbe.json?.exportPackage?.version === 'yh-cut-draft-json-v1', 'ArcReel export package version mismatch');
  assert(Array.isArray(exportProbe.json?.exportPackage?.storyboard?.shots), 'ArcReel export missing storyboard shots');
  assert(Array.isArray(exportProbe.json?.exportPackage?.assemblyPlan?.segments), 'ArcReel export missing assembly segments');

  results.push({
    referenceDemo: 'ArcReel',
    approach: 'script-to-queue-export',
    ok: true,
    taskId: createdTaskId,
    segmentCount: segments.length,
    readabilityScore: readability.score,
    bridgeCount: assembly.json.assemblyPlan.bridgePlan.bridges.length,
    childTaskCount: childTaskIds.length,
    assemblySegmentNodeCount: assemblySegmentNodes.length,
    exportVersion: exportProbe.json.exportPackage.version,
    demoEffect: '脚本/分镜进入可追踪片段队列，子任务可见，画布显示 assemblySegment，且可导出 cut-draft-json 草稿包。',
  });
} finally {
  if (lockAcquired) {
    if (originalExists) {
      fs.writeFileSync(tasksFile, originalContent, 'utf8');
    } else if (fs.existsSync(tasksFile)) {
      fs.rmSync(tasksFile, { force: true });
    }
    releaseLock();
  }
  await sleep(1200);
}

const restored = await fetchJson(`${baseUrl}/api/tasks?limit=100`);
const leakedIds = new Set([createdTaskId, ...childTaskIds].filter(Boolean));
const leaked = (restored.json.tasks || []).filter(task => leakedIds.has(task.id));
assert(leaked.length === 0, `open-source demo parity probe task leak detected: ${leaked.map(task => task.id).join(', ')}`);

results.push({
  referenceDemo: 'cleanup',
  approach: 'probe-restore',
  ok: true,
  leakedProbeTasks: 0,
  totalAfterRestore: restored.json.total,
});

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  tasksFile,
  usedRealKey: false,
  incurredCost: false,
  preset: {
    id: preset.id,
    title: preset.title,
    duration: preset.duration,
  },
  conclusion: '三条参考 demo 路径不是同一种交互：ViMAX=直接导演链，Toonflow=画布资产工作台，ArcReel=队列/恢复/导出工程链；绘影需要三者并行验收。',
  results,
}, null, 2));
