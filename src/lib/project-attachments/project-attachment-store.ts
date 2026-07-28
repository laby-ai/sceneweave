import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type ProjectAttachmentOwner = { tenantId: string; memberId: string };
export type ProjectAttachmentKind = 'image' | 'video' | 'document';

export type ProjectAttachmentRecord = {
  id: string;
  projectId: string;
  name: string;
  kind: ProjectAttachmentKind;
  mimeType: string;
  bytes: number;
  createdAt: string;
  filePath: string;
  order: number;
};

const writes = new Map<string, Promise<void>>();

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function ownerKey(owner: ProjectAttachmentOwner): string {
  if (!owner.tenantId || !owner.memberId) throw new Error('project_attachment_owner_required');
  return hash(`${owner.tenantId}\0${owner.memberId}`);
}

function normalizeProjectId(projectId: string): string {
  const normalized = projectId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized)) {
    throw new Error('project_attachment_project_invalid');
  }
  return normalized;
}

function projectDirectory(root: string, owner: ProjectAttachmentOwner, projectId: string): string {
  return path.join(root, ownerKey(owner), 'projects', hash(normalizeProjectId(projectId)));
}

function registryPath(root: string, owner: ProjectAttachmentOwner, projectId: string): string {
  return path.join(projectDirectory(root, owner, projectId), 'attachments.json');
}

function resolveOwnedFile(
  root: string,
  owner: ProjectAttachmentOwner,
  projectId: string,
  filePath: string,
): string {
  const directory = projectDirectory(root, owner, projectId);
  const resolved = path.resolve(directory, filePath);
  if (!resolved.startsWith(`${path.resolve(directory)}${path.sep}`)) {
    throw new Error('project_attachment_file_invalid');
  }
  return resolved;
}

function isRecord(value: unknown): value is ProjectAttachmentRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ProjectAttachmentRecord>;
  return typeof item.id === 'string'
    && typeof item.projectId === 'string'
    && typeof item.name === 'string'
    && ['image', 'video', 'document'].includes(item.kind || '')
    && typeof item.mimeType === 'string'
    && Number.isInteger(item.bytes)
    && Number(item.bytes) > 0
    && typeof item.createdAt === 'string'
    && typeof item.filePath === 'string'
    && Number.isInteger(item.order);
}

async function readRegistry(
  root: string,
  owner: ProjectAttachmentOwner,
  projectId: string,
): Promise<ProjectAttachmentRecord[]> {
  try {
    const parsed = JSON.parse(await readFile(registryPath(root, owner, projectId), 'utf8')) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function writeRegistry(
  root: string,
  owner: ProjectAttachmentOwner,
  projectId: string,
  records: ProjectAttachmentRecord[],
): Promise<void> {
  const directory = projectDirectory(root, owner, projectId);
  await mkdir(directory, { recursive: true });
  const target = registryPath(root, owner, projectId);
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(records, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, target);
}

async function withProjectWrite<T>(
  root: string,
  owner: ProjectAttachmentOwner,
  projectId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = `${path.resolve(root)}:${ownerKey(owner)}:${normalizeProjectId(projectId)}`;
  const previous = writes.get(key) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  const queued = previous.then(() => current);
  writes.set(key, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (writes.get(key) === queued) writes.delete(key);
  }
}

export function getProjectAttachmentStoreRoot(): string {
  return process.env.HUIYING_PROJECT_ATTACHMENT_STORE_PATH
    || path.join(process.cwd(), 'artifacts', 'project-attachments');
}

export async function listProjectAttachments(
  root: string,
  owner: ProjectAttachmentOwner,
  projectId: string,
): Promise<ProjectAttachmentRecord[]> {
  const records = await readRegistry(root, owner, projectId);
  const valid: ProjectAttachmentRecord[] = [];
  for (const record of records) {
    if (record.projectId !== projectId) continue;
    try {
      const info = await stat(resolveOwnedFile(root, owner, projectId, record.filePath));
      if (info.isFile() && info.size === record.bytes) valid.push(record);
    } catch {
      // Missing or changed files are not exposed as usable project attachments.
    }
  }
  return valid.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

export async function createProjectAttachment(
  root: string,
  owner: ProjectAttachmentOwner,
  input: {
    projectId: string;
    name: string;
    kind: ProjectAttachmentKind;
    mimeType: string;
    content: Buffer;
    extension: string;
  },
): Promise<ProjectAttachmentRecord> {
  const projectId = normalizeProjectId(input.projectId);
  return withProjectWrite(root, owner, projectId, async () => {
    const name = input.name.trim().slice(0, 160);
    if (!name) throw new Error('project_attachment_name_required');
    if (!['image', 'video', 'document'].includes(input.kind)) {
      throw new Error('project_attachment_kind_invalid');
    }
    if (!/^[a-z0-9]{1,8}$/.test(input.extension) || input.content.length === 0) {
      throw new Error('project_attachment_file_invalid');
    }

    const records = await readRegistry(root, owner, projectId);
    const directory = projectDirectory(root, owner, projectId);
    const filesDirectory = path.join(directory, 'files');
    await mkdir(filesDirectory, { recursive: true });
    const id = randomUUID();
    const filePath = path.join('files', `${id}.${input.extension}`);
    const absolutePath = path.join(directory, filePath);
    await writeFile(absolutePath, input.content, { mode: 0o600 });
    const record: ProjectAttachmentRecord = {
      id,
      projectId,
      name,
      kind: input.kind,
      mimeType: input.mimeType,
      bytes: input.content.length,
      createdAt: new Date().toISOString(),
      filePath,
      order: records.length,
    };
    try {
      await writeRegistry(root, owner, projectId, [...records, record]);
      return record;
    } catch (error) {
      await rm(absolutePath, { force: true });
      throw error;
    }
  });
}

export async function readProjectAttachment(
  root: string,
  owner: ProjectAttachmentOwner,
  projectId: string,
  id: string,
): Promise<ProjectAttachmentRecord & { absolutePath: string }> {
  const record = (await readRegistry(root, owner, projectId)).find(item => item.id === id);
  if (!record || record.projectId !== projectId) throw new Error('project_attachment_not_found');
  const absolutePath = resolveOwnedFile(root, owner, projectId, record.filePath);
  const info = await stat(absolutePath);
  if (!info.isFile() || info.size !== record.bytes) throw new Error('project_attachment_not_found');
  return { ...record, absolutePath };
}

export async function deleteProjectAttachment(
  root: string,
  owner: ProjectAttachmentOwner,
  projectId: string,
  id: string,
): Promise<boolean> {
  const normalizedProjectId = normalizeProjectId(projectId);
  return withProjectWrite(root, owner, normalizedProjectId, async () => {
    const records = await readRegistry(root, owner, normalizedProjectId);
    const record = records.find(item => item.id === id);
    if (!record) return false;
    await rm(resolveOwnedFile(root, owner, normalizedProjectId, record.filePath), { force: true });
    const remaining = records
      .filter(item => item.id !== id)
      .map((item, index) => ({ ...item, order: index }));
    await writeRegistry(root, owner, normalizedProjectId, remaining);
    return true;
  });
}

export async function reorderProjectAttachments(
  root: string,
  owner: ProjectAttachmentOwner,
  projectId: string,
  orderedIds: string[],
): Promise<ProjectAttachmentRecord[]> {
  const normalizedProjectId = normalizeProjectId(projectId);
  return withProjectWrite(root, owner, normalizedProjectId, async () => {
    const records = await readRegistry(root, owner, normalizedProjectId);
    if (orderedIds.length !== records.length || new Set(orderedIds).size !== records.length) {
      throw new Error('project_attachment_order_invalid');
    }
    const byId = new Map(records.map(record => [record.id, record]));
    const reordered = orderedIds.map((id, order) => {
      const record = byId.get(id);
      if (!record) throw new Error('project_attachment_order_invalid');
      return { ...record, order };
    });
    await writeRegistry(root, owner, normalizedProjectId, reordered);
    return reordered;
  });
}
