#!/usr/bin/env node

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { config as loadDotenv } from 'dotenv';
import { getTrailerScriptPreset } from './trailer-script-presets.mjs';

loadDotenv({ path: path.resolve('.env.local'), override: false, quiet: true });
loadDotenv({ override: false, quiet: true });

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const gateLockFile = `${tasksFile}.story-aware-video-gate.lock`;
const artifactsDir = path.resolve(process.env.HUIYING_ARTIFACTS_DIR || 'artifacts');
const requestedSeconds = clampNumber(Number(process.env.HUIYING_STORY_VIDEO_SECONDS || process.argv[2] || '10'), 5, 100);
const allowRealCost = process.env.HUIYING_ALLOW_REAL_VIDEO_COST === 'true';
const trailerPresetId = process.env.HUIYING_TRAILER_PRESET || process.env.HUIYING_STORY_VIDEO_PRESET || 'last-train';
const trailerPreset = getTrailerScriptPreset(trailerPresetId, requestedSeconds);

const ark = {
  apiBase: process.env.HUIYING_REAL_ARK_API_BASE || process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/v3',
  apiKey: process.env.HUIYING_REAL_ARK_API_KEY || process.env.ARK_API_KEY || '',
  videoModel: process.env.HUIYING_REAL_ARK_VIDEO_MODEL || process.env.ARK_VIDEO_MODEL || '',
};

const storyPrompt = process.env.HUIYING_STORY_VIDEO_PROMPT || trailerPreset.prompt;
const storyStyle = process.env.HUIYING_STORY_VIDEO_STYLE || trailerPreset.style;
const storySceneType = process.env.HUIYING_STORY_VIDEO_SCENE_TYPE || trailerPreset.sceneType;
const storyRatio = process.env.HUIYING_STORY_VIDEO_RATIO || trailerPreset.ratio;

let lockFd = null;
let realRequestStarted = false;

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

function redactSensitive(value) {
  return String(value)
    .replace(/(Authorization\s*:\s*Bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
    .replace(/(x-yh-api-key["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1[REDACTED]')
    .replace(/ark-[A-Za-z0-9-]{16,}/g, 'ark-[REDACTED]')
    .replace(/(X-Tos-[A-Za-z0-9_-]+)=([^&\s"']+)/g, '$1=[REDACTED]');
}

function acquireGateLock() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
  try {
    lockFd = fs.openSync(gateLockFile, 'wx');
    fs.writeFileSync(lockFd, JSON.stringify({
      pid: process.pid,
      script: 'qa-story-aware-video-gate',
      startedAt: new Date().toISOString(),
    }));
  } catch {
    throw new Error(`真实短剧视频门控正在运行或上次异常退出未清理锁文件：${gateLockFile}`);
  }
}

function releaseGateLock() {
  if (lockFd !== null) {
    fs.closeSync(lockFd);
    lockFd = null;
  }
  if (fs.existsSync(gateLockFile)) {
    fs.rmSync(gateLockFile, { force: true });
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON: ${redactSensitive(text.slice(0, 240))}`);
  }
  return { response, json };
}

function runDurationProbe(filePath) {
  const result = spawnSync(process.execPath, ['scripts/check-video-duration.mjs', filePath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`媒体时长解析失败：${result.stderr || result.stdout}`);
  }
  const text = result.stdout.slice(result.stdout.indexOf('{'));
  return JSON.parse(text).durationSeconds;
}

async function pollTask(taskId, timeoutMs = 18 * 60 * 1000) {
  const startedAt = Date.now();
  const timeline = [];
  let lastStatus = '';
  let firstNotFoundAt = null;

  while (Date.now() - startedAt < timeoutMs) {
    const { response, json } = await fetchJson(`${baseUrl}/api/tasks/${encodeURIComponent(taskId)}`);
    if (!response.ok) {
      if (response.status === 404) {
        firstNotFoundAt ||= Date.now();
        if (Date.now() - firstNotFoundAt <= 60 * 1000) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
      }
      throw new Error(`任务查询失败：HTTP ${response.status}`);
    }
    firstNotFoundAt = null;

    const task = json?.task;
    if (!task) throw new Error('任务查询未返回 task');
    const signature = `${task.status}|${task.progress}|${task.stage}`;
    if (signature !== lastStatus) {
      timeline.push({
        atSec: Math.round((Date.now() - startedAt) / 1000),
        status: task.status,
        progress: task.progress,
        stage: task.stage,
        segmentCount: Array.isArray(task.result?.segments) ? task.result.segments.length : null,
      });
      lastStatus = signature;
    }

    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      return { task, elapsedMs: Date.now() - startedAt, timeline };
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  throw new Error(`任务轮询超时：${Math.round(timeoutMs / 1000)}s`);
}

function buildGenerationPrompt(productionProject, assemblyPlan) {
  const storyBible = productionProject.storyBible;
  const assetNames = (productionProject.assets || [])
    .filter(asset => ['character', 'scene', 'prop'].includes(asset.kind))
    .map(asset => asset.name)
    .slice(0, 8)
    .join('、');
  const segmentBriefs = assemblyPlan.segments.map(segment => {
    const markerLines = segment.prompt
      .split(/\r?\n/)
      .filter(line => /^【(剧情目的|观众必须看见|威胁对象|危险源|动作因果|入点状态|出点状态|桥接动作|剪辑衔接|操作结果|结尾新问题|道具状态|情绪变化|镜头执行|连续性规则)/.test(line))
      .slice(0, 15)
      .join('\n');
    return `第${segment.index + 1}段 / ${segment.duration}s\n${markerLines}`;
  }).join('\n\n');

  return [
    `【短剧前提】${storyBible.premise}`,
    `【主角】${storyBible.protagonist}`,
    `【角色动机】${storyBible.desire}`,
    `【当前冲突】${storyBible.conflict}`,
    `【中段转折】${storyBible.turningPoint}`,
    `【结尾钩子】${storyBible.endingHook}`,
    `【情绪曲线】${storyBible.emotionalArc.start} -> ${storyBible.emotionalArc.shift} -> ${storyBible.emotionalArc.end}`,
    `【连续性规则】${storyBible.continuityRules.join('；')}`,
    `【核心资产】${assetNames}`,
    `【预告片结构参考】${trailerPreset.title} / ${trailerPreset.duration}s；${trailerPreset.beats.join('；')}`,
    '【防流水账硬要求】每一段必须承担不同叙事职能，不能连续重复“发现危险、操作失败、留下钩子”的同一种流程；请按异常入场、人物接棒、第一次失败、身体冒险、线索改向、高风险追赶、二次反转钩子的递进来拍。',
    '【分段镜头计划】',
    segmentBriefs,
    '【跨段衔接硬要求】第N段的出点状态必须成为第N+1段的入点；每段开头1-2秒先延续上一段末尾的角色位置、手部动作、视线方向和道具状态，再进入新信息；不要把三段拍成互不相干的氛围镜头。',
    '【60s故事可读性硬要求】每段都必须把四类信息拍进画面：1) 被威胁对象是谁或什么；2) 危险源是什么，必须用倒计时、报警屏、追赶者、断裂结构、失控装置、直播曝光或具体失败画面表达；3) 主角操作后的结果是什么，必须看到屏幕/道具/环境发生变化；4) 结尾新问题是什么，最后画面必须留下新线索或更大危险。',
    `要求：这是${storyStyle}成片测试，不要生成抽象宇宙胶卷或无意义素材；每个片段必须围绕主角“${storyBible.protagonist}”、冲突“${storyBible.conflict}”和核心资产推进。`,
    '要求：观众即使不看字幕，也必须能从画面里看见发现线索、威胁对象、危险源、主动操作、操作结果、结尾新问题这条因果链；不要只生成连续性好但剧情不可读的氛围画面。',
  ].join('\n');
}

async function createStoryAwarePlan() {
  const director = await fetchJson(`${baseUrl}/api/smart/director-chain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: storyPrompt,
      duration: requestedSeconds,
      segmentDuration: 10,
      style: storyStyle,
      sceneType: storySceneType,
      ratio: storyRatio,
    }),
  });
  if (!director.response.ok || !director.json?.success) {
    throw new Error(`导演链路失败：HTTP ${director.response.status} ${redactSensitive(JSON.stringify(director.json || {}))}`);
  }

  await new Promise(resolve => setTimeout(resolve, 1200));

  const assembly = await fetchJson(`${baseUrl}/api/production/assembly-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: director.json.taskId, persist: true }),
  });
  if (!assembly.response.ok || !assembly.json?.success) {
    throw new Error(`片段计划失败：HTTP ${assembly.response.status} ${redactSensitive(JSON.stringify(assembly.json || {}))}`);
  }

  return {
    directorTaskId: director.json.taskId,
    productionProject: director.json.productionProject,
    assemblyPlan: assembly.json.assemblyPlan,
  };
}

async function runRealVideo() {
  if (!allowRealCost) {
    throw new Error('缺少 HUIYING_ALLOW_REAL_VIDEO_COST=true 显式费用授权');
  }
  if (!ark.apiKey || !ark.videoModel) {
    throw new Error('缺少本地 Ark API Key 或视频模型配置');
  }

  const plan = await createStoryAwarePlan();
  const generationPrompt = buildGenerationPrompt(plan.productionProject, plan.assemblyPlan);
  const submit = await fetchJson(`${baseUrl}/api/video/merge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-yh-provider': 'ark-plan',
      'x-yh-api-base': ark.apiBase,
      'x-yh-api-key': ark.apiKey,
      'x-yh-video-model': ark.videoModel,
    },
    body: JSON.stringify({
      prompt: generationPrompt,
      duration: requestedSeconds,
      ratio: storyRatio,
      resolution: '720p',
      watermark: false,
      videoModel: ark.videoModel,
      backgroundBgm: 'none',
      enableSubtitle: false,
      generateVoice: false,
      sceneType: storySceneType,
    }),
  });
  if (!submit.response.ok || !submit.json?.taskId) {
    throw new Error(`真实视频提交失败：HTTP ${submit.response.status} ${redactSensitive(JSON.stringify(submit.json || {}))}`);
  }
  realRequestStarted = true;

  const taskId = submit.json.taskId;
  const polled = await pollTask(taskId);
  const task = polled.task;
  const videoUrl = task.result?.videoUrl;
  const segments = Array.isArray(task.result?.segments) ? task.result.segments : [];

  if (task.status !== 'completed' || !videoUrl) {
    return {
      ok: false,
      taskId,
      directorTaskId: plan.directorTaskId,
      status: task.status,
      progress: task.progress,
      stage: task.stage,
      error: redactSensitive(task.error || ''),
      elapsedSeconds: Math.round(polled.elapsedMs / 1000),
      timeline: polled.timeline,
      segmentCount: segments.length,
      storyBible: summarizeStoryBible(plan.productionProject.storyBible),
    };
  }

  const artifactPath = path.join(artifactsDir, `huiying-story-aware-${requestedSeconds}s-${taskId}.mp4`);
  const resolvedVideoUrl = new URL(videoUrl, baseUrl).toString();
  const response = await fetch(resolvedVideoUrl);
  if (!response.ok) {
    throw new Error(`视频下载失败：HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.mkdir(path.dirname(artifactPath), { recursive: true });
  await fsp.writeFile(artifactPath, buffer);

  return {
    ok: true,
    taskId,
    directorTaskId: plan.directorTaskId,
      requestedSeconds,
      trailerPreset: {
        id: trailerPreset.id,
        title: trailerPreset.title,
        duration: trailerPreset.duration,
        visualAnchors: trailerPreset.visualAnchors,
      },
      style: storyStyle,
      sceneType: storySceneType,
      ratio: storyRatio,
      status: task.status,
    elapsedSeconds: Math.round(polled.elapsedMs / 1000),
    segmentCount: segments.length,
    artifactPath,
    bytes: buffer.length,
    durationSeconds: runDurationProbe(artifactPath),
    timeline: polled.timeline,
    storyBible: summarizeStoryBible(plan.productionProject.storyBible),
    promptMarkers: ['短剧前提', '主角', '角色动机', '当前冲突', '中段转折', '结尾钩子', '核心资产', '预告片结构参考', '分段镜头计划', '观众必须看见', '威胁对象', '危险源', '动作因果', '入点状态', '出点状态', '桥接动作', '剪辑衔接', '操作结果', '结尾新问题', '跨段衔接硬要求', '道具状态']
      .filter(marker => generationPrompt.includes(`【${marker}】`)),
  };
}

function summarizeStoryBible(storyBible) {
  return {
    protagonist: storyBible.protagonist,
    conflict: storyBible.conflict,
    turningPoint: storyBible.turningPoint,
    endingHook: storyBible.endingHook,
  };
}

function collectPromptMarkers(generationPrompt) {
  return ['短剧前提', '主角', '角色动机', '当前冲突', '中段转折', '结尾钩子', '核心资产', '预告片结构参考', '分段镜头计划', '观众必须看见', '威胁对象', '危险源', '动作因果', '入点状态', '出点状态', '桥接动作', '剪辑衔接', '操作结果', '结尾新问题', '跨段衔接硬要求', '道具状态']
    .filter(marker => generationPrompt.includes(`【${marker}】`));
}

function assertStoryAwarePrompt(generationPrompt, assemblyPlan, productionProject) {
  const requiredMarkers = ['短剧前提', '主角', '当前冲突', '结尾钩子', '预告片结构参考', '分段镜头计划', '跨段衔接硬要求'];
  const missingMarkers = requiredMarkers.filter(marker => !generationPrompt.includes(`【${marker}】`));
  const segmentPrompts = Array.isArray(assemblyPlan?.segments) ? assemblyPlan.segments : [];
  const segmentCount = segmentPrompts.length;
  const segmentsWithEntryExit = segmentPrompts.filter(segment =>
    segment.prompt.includes('【入点状态】') && segment.prompt.includes('【出点状态】'),
  ).length;
  const segmentsWithHandoff = segmentPrompts.filter(segment =>
    segment.prompt.includes('【桥接动作】') && segment.prompt.includes('【剪辑衔接】'),
  ).length;
  const segmentsWithCausality = segmentPrompts.filter(segment =>
    segment.prompt.includes('【威胁对象】') && segment.prompt.includes('【危险源】') && segment.prompt.includes('【操作结果】'),
  ).length;

  const failures = [];
  if (missingMarkers.length > 0) failures.push(`missing prompt markers: ${missingMarkers.join(', ')}`);
  if (segmentCount < 2) failures.push(`expected at least 2 assembly segments, got ${segmentCount}`);
  if (segmentsWithEntryExit !== segmentCount) failures.push(`entry/exit continuity markers incomplete: ${segmentsWithEntryExit}/${segmentCount}`);
  if (segmentsWithHandoff !== segmentCount) failures.push(`handoff markers incomplete: ${segmentsWithHandoff}/${segmentCount}`);
  if (segmentsWithCausality !== segmentCount) failures.push(`causality markers incomplete: ${segmentsWithCausality}/${segmentCount}`);

  if (trailerPreset.id === 'five-dynasties-river') {
    const historicalText = [
      productionProject?.storyBible?.premise,
      productionProject?.storyBible?.protagonist,
      productionProject?.storyBible?.conflict,
      productionProject?.storyBible?.turningPoint,
      productionProject?.storyBible?.endingHook,
      generationPrompt,
    ].filter(Boolean).join('\n');
    const requiredHistoricalAnchors = ['山河图', '黄河', '燕云', '南唐', '陈桥', '黄袍'];
    const missingHistoricalAnchors = requiredHistoricalAnchors.filter(anchor => !historicalText.includes(anchor));
    if (missingHistoricalAnchors.length > 0) failures.push(`five-dynasties storyBible missing anchors: ${missingHistoricalAnchors.join(', ')}`);
    if (/缓步前行|关键物件「钥匙」|抽象宇宙胶片/.test(historicalText)) {
      failures.push('five-dynasties storyBible contains generic template contamination');
    }
    const audioText = segmentPrompts.map(segment => [
      segment?.audioState?.dialogue,
      segment?.audioState?.narration,
      segment?.audioState?.soundDesign,
      segment?.audioState?.audioCue,
      segment?.shotFrameContract?.audioDescription,
      segment?.storySegmentContract?.audioContract?.audioCue,
    ].filter(Boolean).join(' ')).join('\n');
    if (/人物形象展示|情绪收尾|故事的尾声|着装符合人物身份/.test(audioText)) {
      failures.push('five-dynasties audioState contains generic template contamination');
    }
    const secondAudio = segmentPrompts[1]?.audioState || {};
    if (!String(secondAudio.dialogue || '').includes('别回头') || !String(secondAudio.soundDesign || '').includes('箭入水')) {
      failures.push('five-dynasties segment 2 audioState must preserve dialogue and sound handoff');
    }
    if (!audioText.includes('愿天下不再换旗')) {
      failures.push('five-dynasties final audio cue missing ending line');
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    segmentCount,
    segmentsWithEntryExit,
    segmentsWithHandoff,
    segmentsWithCausality,
    promptMarkers: collectPromptMarkers(generationPrompt),
  };
}

async function runDryGate() {
  const plan = await createStoryAwarePlan();
  const generationPrompt = buildGenerationPrompt(plan.productionProject, plan.assemblyPlan);
  const proof = assertStoryAwarePrompt(generationPrompt, plan.assemblyPlan, plan.productionProject);
  return {
    ok: proof.ok,
    directorTaskId: plan.directorTaskId,
    requestedSeconds,
    trailerPreset: {
      id: trailerPreset.id,
      title: trailerPreset.title,
      duration: trailerPreset.duration,
      visualAnchors: trailerPreset.visualAnchors,
    },
    style: storyStyle,
    sceneType: storySceneType,
    ratio: storyRatio,
    storyBible: summarizeStoryBible(plan.productionProject.storyBible),
    failures: proof.failures,
    segmentCount: proof.segmentCount,
    segmentsWithEntryExit: proof.segmentsWithEntryExit,
    segmentsWithHandoff: proof.segmentsWithHandoff,
    segmentsWithCausality: proof.segmentsWithCausality,
    promptMarkers: proof.promptMarkers,
  };
}

async function main() {
  acquireGateLock();
  try {
    if (!allowRealCost) {
      const dryStep = await runDryGate();
      console.log(JSON.stringify({
        ok: dryStep.ok,
        baseUrl,
        requestedSeconds,
        usedRealKey: false,
        incurredCost: false,
        mode: 'dry-story-aware-gate',
        dryStep,
      }, null, 2));
      if (!dryStep.ok) process.exit(1);
      return;
    }

    const realStep = await runRealVideo();
    console.log(JSON.stringify({
      ok: realStep.ok,
      baseUrl,
      requestedSeconds,
      usedRealKey: true,
      incurredCost: true,
      realStep,
    }, null, 2));
    if (!realStep.ok) process.exit(1);
  } finally {
    releaseGateLock();
  }
}

main().catch(error => {
  releaseGateLock();
  console.error(JSON.stringify({
    ok: false,
    error: redactSensitive(error instanceof Error ? error.message : String(error)),
    requestedSeconds,
    usedRealKey: realRequestStarted,
    incurredCost: realRequestStarted,
  }, null, 2));
  process.exit(1);
});
