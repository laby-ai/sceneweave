#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: path.resolve('.env.local'), override: false, quiet: true });
loadDotenv({ override: false, quiet: true });

const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const artifactsDir = path.resolve(process.env.HUIYING_ARTIFACTS_DIR || 'artifacts', 'ark-status-shape');
const apiBase = process.env.HUIYING_REAL_ARK_API_BASE || process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/v3';
const apiKey = process.env.HUIYING_REAL_ARK_API_KEY || process.env.ARK_API_KEY || '';
const requestedTaskId = process.argv[2] || '';

function redact(value) {
  return String(value)
    .replace(/(Authorization\s*:\s*Bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
    .replace(/ark-[A-Za-z0-9-]{16,}/g, 'ark-[REDACTED]')
    .replace(/(X-Tos-[A-Za-z0-9_-]+)=([^&\s"']+)/g, '$1=[REDACTED]')
    .replace(/https:\/\/[^\s"']+/g, 'https://[REDACTED_URL]');
}

function taskUrl(base, providerTaskId) {
  const normalized = base.replace(/\/+$/, '');
  if (/\/contents\/generations\/tasks$/.test(normalized)) {
    return `${normalized}/${encodeURIComponent(providerTaskId)}`;
  }
  if (/\/api\/plan\/v3$/.test(normalized) || /\/v3$/.test(normalized)) {
    return `${normalized}/contents/generations/tasks/${encodeURIComponent(providerTaskId)}`;
  }
  return `${normalized}/api/v3/contents/generations/tasks/${encodeURIComponent(providerTaskId)}`;
}

function flattenShape(value, prefix = '$', depth = 0, acc = []) {
  if (!value || typeof value !== 'object' || depth > 5) return acc;
  if (Array.isArray(value)) {
    if (value.length > 0) flattenShape(value[0], `${prefix}[0]`, depth + 1, acc);
    return acc;
  }
  for (const [key, child] of Object.entries(value)) {
    const nextPath = `${prefix}.${key}`;
    acc.push(nextPath);
    flattenShape(child, nextPath, depth + 1, acc);
  }
  return acc;
}

function hasAnyKeyPath(paths, patterns) {
  return paths.some(item => patterns.some(pattern => pattern.test(item)));
}

function pickLatestProviderTask() {
  if (!fs.existsSync(tasksFile)) return null;
  const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
  const candidates = tasks
    .filter(task => task?.result?.providerTaskId || task?.result?.segments?.some(segment => segment?.providerTaskId))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const task = candidates[0];
  if (!task) return null;
  const providerTaskId = task.result.providerTaskId || task.result.segments?.find(segment => segment?.providerTaskId)?.providerTaskId;
  return {
    localTaskId: task.id,
    providerTaskId,
  };
}

async function main() {
  if (!apiKey) {
    throw new Error('缺少 HUIYING_REAL_ARK_API_KEY 或 ARK_API_KEY，无法查询 Ark 状态 shape。');
  }
  const selected = requestedTaskId
    ? { localTaskId: null, providerTaskId: requestedTaskId }
    : pickLatestProviderTask();
  if (!selected?.providerTaskId) {
    throw new Error(`未找到 providerTaskId，可传入 provider task id 或先运行真实 smoke。tasksFile=${tasksFile}`);
  }

  const response = await fetch(taskUrl(apiBase, selected.providerTaskId), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Ark status returned non-JSON: ${redact(text.slice(0, 240))}`);
  }
  if (!response.ok) {
    throw new Error(`Ark status failed: HTTP ${response.status} ${redact(JSON.stringify(payload || {}))}`);
  }

  const paths = flattenShape(payload);
  const tailFramePathPresent = hasAnyKeyPath(paths, [
    /last[_-]?frame/i,
    /tail[_-]?frame/i,
    /end[_-]?frame/i,
    /last[_-]?image/i,
  ]);
  const videoPathPresent = hasAnyKeyPath(paths, [
    /video[_-]?url/i,
    /\.url$/i,
  ]);

  const report = {
    ok: true,
    usedRealKey: true,
    incurredCost: false,
    localTaskId: selected.localTaskId,
    providerTaskIdPresent: true,
    httpStatus: response.status,
    status: payload?.status || payload?.data?.status || null,
    shapePaths: paths.sort(),
    videoPathPresent,
    tailFramePathPresent,
    note: '只输出响应字段路径，不输出视频 URL、尾帧 URL、API key 或完整供应商任务 URL。',
  };
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(path.join(artifactsDir, 'latest.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.log(JSON.stringify({
    ok: false,
    usedRealKey: Boolean(apiKey),
    incurredCost: false,
    error: redact(error instanceof Error ? error.message : String(error)),
  }, null, 2));
  process.exit(1);
});
