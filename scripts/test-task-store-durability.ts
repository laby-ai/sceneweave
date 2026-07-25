import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  COMPLETED_TASK_RETENTION_MS,
  isCompletedTaskExpired,
  migrateLegacyHuiyingTasksFile,
  resolveHuiyingTasksFile,
} from '../src/lib/task-store-path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'huiying-task-store-'));

try {
  const targetFile = path.join(root, 'shared', 'tasks', 'tasks.json');
  const legacyFile = path.join(root, 'legacy', 'tasks.json');
  const legacyTasks = JSON.stringify([{ id: 'task-1', status: 'completed' }]);
  fs.mkdirSync(path.dirname(legacyFile), { recursive: true });
  fs.writeFileSync(legacyFile, legacyTasks);

  assert.equal(
    resolveHuiyingTasksFile(path.join(root, 'configured.json')),
    path.join(root, 'configured.json'),
  );
  assert.equal(
    resolveHuiyingTasksFile(''),
    path.resolve('artifacts', 'tasks', 'tasks.json'),
  );
  assert.equal(migrateLegacyHuiyingTasksFile(targetFile, legacyFile), true);
  assert.equal(fs.readFileSync(targetFile, 'utf8'), legacyTasks);

  fs.writeFileSync(targetFile, JSON.stringify([{ id: 'task-2', status: 'running' }]));
  assert.equal(migrateLegacyHuiyingTasksFile(targetFile, legacyFile), false);
  assert.match(fs.readFileSync(targetFile, 'utf8'), /task-2/);
  const now = Date.now();
  assert.equal(isCompletedTaskExpired(now - (25 * 60 * 60 * 1000), now), false);
  assert.equal(isCompletedTaskExpired(now - COMPLETED_TASK_RETENTION_MS - 1, now), true);

  console.log(JSON.stringify({
    ok: true,
    script: 'test-task-store-durability',
    checks: 8,
  }));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
