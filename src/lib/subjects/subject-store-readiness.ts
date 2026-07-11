import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

type SubjectStoreReadiness = {
  ready: boolean;
  blockers: string[];
  requirements: Array<{
    name: string;
    configured: boolean;
    configuredVia: string;
    purpose: string;
  }>;
  note: string;
};

export function getSubjectStoreRoot(): string {
  return process.env.HUIYING_SUBJECT_STORE_PATH?.trim()
    || path.join(process.cwd(), 'artifacts', 'subjects');
}

export async function getSubjectStoreReadiness(root = getSubjectStoreRoot()): Promise<SubjectStoreReadiness> {
  const probe = path.join(root, `.health-check-${process.pid}-${randomUUID()}`);
  const temporary = path.join(probe, 'registry.tmp');
  const committed = path.join(probe, 'registry.json');
  try {
    await mkdir(path.join(probe, 'images'), { recursive: true });
    await writeFile(temporary, '[]\n', { mode: 0o600 });
    await rename(temporary, committed);
    await rm(probe, { recursive: true, force: true });
    return {
      ready: true,
      blockers: [],
      requirements: [{
        name: 'HUIYING_SUBJECT_STORE_PATH',
        configured: true,
        configuredVia: process.env.HUIYING_SUBJECT_STORE_PATH?.trim() ? 'environment' : 'artifacts-default',
        purpose: 'member-isolated subject registry and private reference images',
      }],
      note: '主体库共享存储可创建成员 registry、图片目录并执行原子写入。',
    };
  } catch {
    await rm(probe, { recursive: true, force: true }).catch(() => undefined);
    return {
      ready: false,
      blockers: ['subject_store_not_writable'],
      requirements: [{
        name: 'HUIYING_SUBJECT_STORE_PATH',
        configured: false,
        configuredVia: process.env.HUIYING_SUBJECT_STORE_PATH?.trim() ? 'environment' : 'artifacts-default',
        purpose: 'member-isolated subject registry and private reference images',
      }],
      note: '主体库共享存储不可写；保存、读取和复用主体应停止并显式报错。',
    };
  }
}
