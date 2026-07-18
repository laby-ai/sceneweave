import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import ffmpegStaticPath from 'ffmpeg-static';

import {
  submitVideoWithBYOK,
  waitForVideoWithBYOK,
  type BYOKConnection,
} from '../src/lib/byok-provider';

const execFileAsync = promisify(execFile);

interface DemoShot {
  model: string;
  prompt: string;
  fileName: string;
}

interface DemoState {
  shots: Array<{ taskId?: string; videoUrl?: string }>;
}

const shots: DemoShot[] = [
  {
    model: 'Seedance2.0',
    fileName: '01-seedance2-5s.mp4',
    prompt: [
      'Cinematic product shot in a clean pale-silver studio.',
      'A translucent cobalt-blue glass sphere floats above a reflective stage while the camera makes a slow clockwise arc.',
      'Keep the sphere centered, the lens height stable, and the background minimal.',
      'During the final 0.7 seconds the sphere emits a cyan-white flash that completely fills the frame.',
      'No people, no text, no logos, no watermark.',
    ].join(' '),
  },
  {
    model: 'Seedance2.0',
    fileName: '02-seedance2-5s.mp4',
    prompt: [
      'The first frame is a cyan-white flash that completely fills the frame.',
      'The flash fades to reveal the same translucent cobalt-blue glass sphere in the same clean pale-silver reflective studio.',
      'The sphere unfolds into flowing turquoise silk ribbons while the camera continues the same slow clockwise arc at the same lens height.',
      'During the final 0.7 seconds the ribbons sweep smoothly from left to right and fill the frame.',
      'Keep the background minimal and the movement smooth.',
      'No people, no text, no logos, no watermark.',
    ].join(' '),
  },
  {
    model: 'Seedance2.0',
    fileName: '03-seedance2-5s.mp4',
    prompt: [
      'The first frame is filled by the same turquoise silk ribbons sweeping smoothly from left to right.',
      'Continue that exact motion in the same clean pale-silver reflective studio and at the same lens height.',
      'The ribbons curl inward and weave back into the same translucent cobalt-blue glass sphere while the camera completes the same slow clockwise arc.',
      'End on a stable centered hero frame of the sphere floating above the reflective stage, with soft cyan light and no flash.',
      'No people, no text, no logos, no watermark.',
    ].join(' '),
  },
];

async function download(url: string, outputPath: string): Promise<number> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`下载 SCNet 结果失败：HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024) throw new Error('下载 SCNet 结果失败：文件过小');
  await fs.writeFile(outputPath, bytes);
  return bytes.length;
}

async function loadState(statePath: string): Promise<DemoState> {
  try {
    const parsed = JSON.parse(await fs.readFile(statePath, 'utf8')) as DemoState;
    return { shots: Array.isArray(parsed.shots) ? parsed.shots : [] };
  } catch {
    return { shots: [] };
  }
}

async function saveState(statePath: string, state: DemoState): Promise<void> {
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function resolveFfmpegPath(): string {
  const configured = process.env.FFMPEG_BIN?.trim();
  if (configured) return configured;
  if (ffmpegStaticPath && existsSync(ffmpegStaticPath)) return ffmpegStaticPath;
  throw new Error('本地 FFmpeg 不可用，请设置 FFMPEG_BIN');
}

async function mergeLocalSegments(segmentPaths: string[], outputPath: string): Promise<number> {
  const concatListPath = path.join(path.dirname(outputPath), 'scnet-transition-concat.txt');
  await fs.writeFile(
    concatListPath,
    segmentPaths.map(filePath => `file '${path.resolve(filePath).replace(/\\/g, '/')}'`).join('\n'),
    'utf8',
  );
  const ffmpegPath = resolveFfmpegPath();
  try {
    try {
      await execFileAsync(ffmpegPath, [
        '-y', '-f', 'concat', '-safe', '0', '-i', concatListPath,
        '-c', 'copy', '-movflags', '+faststart', outputPath,
      ], { timeout: 180_000 });
    } catch {
      await execFileAsync(ffmpegPath, [
        '-y', '-f', 'concat', '-safe', '0', '-i', concatListPath,
        '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', outputPath,
      ], { timeout: 300_000 });
    }
  } finally {
    await fs.rm(concatListPath, { force: true }).catch(() => undefined);
  }
  const stat = await fs.stat(outputPath);
  if (stat.size < 1024) throw new Error('Seedance 2.0 拼接结果文件过小');
  return stat.size;
}

async function main() {
  const apiKey = (process.env.SCNET_API_KEY || '').trim();
  if (!apiKey) throw new Error('缺少 SCNET_API_KEY');

  const outputDirectory = path.resolve(
    process.env.SCNET_DEMO_OUTPUT_DIR || path.join('outputs', 'scnet-seedance2-transition'),
  );
  await fs.mkdir(outputDirectory, { recursive: true });
  const statePath = path.join(outputDirectory, 'scnet-transition-state.json');
  const state = await loadState(statePath);

  const connection: BYOKConnection = {
    provider: 'ark-plan',
    apiBase: (process.env.SCNET_API_BASE || 'https://api.scnet.cn/api/llm/v1').trim(),
    apiKey,
  };
  const generated: Array<{
    model: string;
    taskId: string;
    outputPath: string;
    sourceUrl?: string;
    bytes: number;
    polls: number;
    resumed: boolean;
  }> = [];

  for (const [index, shot] of shots.entries()) {
    const outputPath = path.join(outputDirectory, shot.fileName);
    const existing = await fs.stat(outputPath).catch(() => undefined);
    if (existing && existing.size >= 1024) {
      generated.push({
        model: shot.model,
        taskId: '',
        outputPath,
        sourceUrl: state.shots[index]?.videoUrl,
        bytes: existing.size,
        polls: 0,
        resumed: true,
      });
      process.stdout.write(`shot=${index + 1} model=${shot.model} resumed=true\n`);
      continue;
    }

    let taskId = state.shots[index]?.taskId || '';
    if (!taskId) {
      const task = await submitVideoWithBYOK(connection, {
        model: shot.model,
        prompt: shot.prompt,
        duration: 5,
        ratio: '16:9',
        resolution: '720p',
        watermark: false,
      });
      taskId = task.taskId;
      state.shots[index] = { taskId };
      await saveState(statePath, state);
    }
    let polls = 0;
    const result = await waitForVideoWithBYOK(
      connection,
      taskId,
      status => {
        polls += 1;
        process.stdout.write(`shot=${index + 1} model=${shot.model} poll=${polls} status=${status.rawStatus || status.status}\n`);
      },
      { maxAttempts: 180, intervalMs: 5000 },
    );
    state.shots[index] = { taskId, videoUrl: result.videoUrl };
    await saveState(statePath, state);
    const bytes = await download(result.videoUrl, outputPath);
    generated.push({
      model: shot.model,
      taskId,
      outputPath,
      sourceUrl: result.videoUrl,
      bytes,
      polls,
      resumed: false,
    });
  }

  const mergedOutputPath = path.join(outputDirectory, 'scnet-seedance2-transition-15s.mp4');
  const mergedBytes = await mergeLocalSegments(
    generated.map(item => item.outputPath),
    mergedOutputPath,
  );
  const manifestPath = path.join(outputDirectory, 'scnet-transition-manifest.json');
  await fs.writeFile(manifestPath, `${JSON.stringify({
    route: 'src/lib/byok-provider.ts',
    provider: 'SCNet',
    model: 'Seedance2.0',
    ratio: '16:9',
    resolution: '720p',
    durationSeconds: 15,
    segmentDurationSeconds: 5,
    continuity: {
      subject: 'translucent cobalt-blue glass sphere',
      setting: 'clean pale-silver reflective studio',
      camera: 'slow clockwise arc at stable lens height',
      cut1: 'cyan-white full-frame flash',
      cut2: 'turquoise ribbons sweeping left to right',
    },
    shots: shots.map((shot, index) => ({
      index: index + 1,
      prompt: shot.prompt,
      taskId: generated[index].taskId,
      outputPath: generated[index].outputPath,
    })),
    mergedOutputPath,
  }, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    incurredCost: generated.some(item => !item.resumed),
    outputDirectory,
    segments: generated.map(item => ({
      model: item.model,
      taskId: item.taskId,
      outputPath: item.outputPath,
      bytes: item.bytes,
      polls: item.polls,
      resumed: item.resumed,
    })),
    merged: {
      outputPath: mergedOutputPath,
      bytes: mergedBytes,
      segmentCount: generated.length,
    },
    manifestPath,
  }, null, 2));
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, stoppedBeforeNextPaidShot: true, error: message }));
  process.exitCode = 1;
});
