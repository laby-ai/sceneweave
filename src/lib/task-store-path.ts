import fs from 'node:fs';
import path from 'node:path';

export const LEGACY_HUIYING_TASKS_FILE = path.join('/tmp', 'dreambox-tasks', 'tasks.json');
export const COMPLETED_TASK_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function resolveHuiyingTasksFile(configuredPath = process.env.HUIYING_TASKS_FILE) {
  return configuredPath?.trim()
    ? path.resolve(configuredPath)
    : path.resolve('artifacts', 'tasks', 'tasks.json');
}

export function migrateLegacyHuiyingTasksFile(
  targetFile: string,
  legacyFile = LEGACY_HUIYING_TASKS_FILE,
) {
  if (path.resolve(targetFile) === path.resolve(legacyFile)
    || fs.existsSync(targetFile)
    || !fs.existsSync(legacyFile)) {
    return false;
  }

  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  const temporaryFile = `${targetFile}.${process.pid}.${Date.now()}.migration`;
  fs.copyFileSync(legacyFile, temporaryFile);
  fs.renameSync(temporaryFile, targetFile);
  return true;
}

export function isCompletedTaskExpired(completedAt: number, now = Date.now()) {
  return now - completedAt > COMPLETED_TASK_RETENTION_MS;
}
