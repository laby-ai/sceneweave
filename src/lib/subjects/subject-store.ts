import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type SubjectType = 'character' | 'scene' | 'object';

export type SubjectRecord = {
  id: string;
  name: string;
  type: SubjectType;
  source: 'generated' | 'uploaded';
  createdAt: string;
  imagePath: string;
  mimeType: string;
};

export type SubjectOwner = { tenantId: string; memberId: string };

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const ownerWrites = new Map<string, Promise<void>>();

async function withOwnerWrite<T>(root: string, owner: SubjectOwner, operation: () => Promise<T>): Promise<T> {
  const key = `${path.resolve(root)}:${ownerKey(owner)}`;
  const previous = ownerWrites.get(key) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  const queued = previous.then(() => current);
  ownerWrites.set(key, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (ownerWrites.get(key) === queued) ownerWrites.delete(key);
  }
}

function ownerKey(owner: SubjectOwner): string {
  if (!owner.tenantId || !owner.memberId) throw new Error('subject_owner_required');
  return createHash('sha256').update(`${owner.tenantId}\0${owner.memberId}`).digest('hex');
}

function ownerDirectory(root: string, owner: SubjectOwner): string {
  return path.join(root, ownerKey(owner));
}

async function readRegistry(root: string, owner: SubjectOwner): Promise<SubjectRecord[]> {
  try {
    const payload = JSON.parse(await readFile(path.join(ownerDirectory(root, owner), 'subjects.json'), 'utf8')) as unknown;
    return Array.isArray(payload) ? payload.filter(isSubjectRecord) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

function isSubjectRecord(value: unknown): value is SubjectRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SubjectRecord>;
  return typeof item.id === 'string'
    && typeof item.name === 'string'
    && ['character', 'scene', 'object'].includes(item.type || '')
    && ['generated', 'uploaded'].includes(item.source || '')
    && typeof item.createdAt === 'string'
    && typeof item.imagePath === 'string'
    && typeof item.mimeType === 'string';
}

async function writeRegistry(root: string, owner: SubjectOwner, records: SubjectRecord[]): Promise<void> {
  const directory = ownerDirectory(root, owner);
  await mkdir(directory, { recursive: true });
  const target = path.join(directory, 'subjects.json');
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(records, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, target);
}

function resolveOwnedImage(root: string, owner: SubjectOwner, imagePath: string): string {
  const directory = ownerDirectory(root, owner);
  const resolved = path.resolve(directory, imagePath);
  if (!resolved.startsWith(`${path.resolve(directory)}${path.sep}`)) throw new Error('subject_image_invalid');
  return resolved;
}

export async function listSubjects(root: string, owner: SubjectOwner): Promise<SubjectRecord[]> {
  const records = await readRegistry(root, owner);
  const valid: SubjectRecord[] = [];
  for (const record of records) {
    try {
      const info = await stat(resolveOwnedImage(root, owner, record.imagePath));
      if (info.isFile() && info.size > 0) valid.push(record);
    } catch {
      // Missing or invalid files are never exposed as usable subjects.
    }
  }
  return valid.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createSubject(root: string, owner: SubjectOwner, input: {
  name: string;
  type: SubjectType;
  source: SubjectRecord['source'];
  image: Buffer;
  mimeType: string;
}): Promise<SubjectRecord> {
  return withOwnerWrite(root, owner, async () => {
  const name = input.name.trim().slice(0, 80);
  const extension = MIME_EXTENSIONS[input.mimeType];
  if (!name) throw new Error('subject_name_required');
  if (!['character', 'scene', 'object'].includes(input.type)) throw new Error('subject_type_invalid');
  if (!extension || input.image.length === 0) throw new Error('subject_image_invalid');
  if (input.image.length > 15 * 1024 * 1024) throw new Error('subject_image_too_large');

  const directory = ownerDirectory(root, owner);
  const imageDirectory = path.join(directory, 'images');
  await mkdir(imageDirectory, { recursive: true });
  const id = randomUUID();
  const imagePath = path.join('images', `${id}.${extension}`);
  await writeFile(path.join(directory, imagePath), input.image, { mode: 0o600 });

  const record: SubjectRecord = {
    id,
    name,
    type: input.type,
    source: input.source,
    createdAt: new Date().toISOString(),
    imagePath,
    mimeType: input.mimeType,
  };
  await writeRegistry(root, owner, [record, ...(await readRegistry(root, owner))]);
  return record;
  });
}

export async function readSubjectImage(root: string, owner: SubjectOwner, id: string): Promise<{
  image: Buffer;
  mimeType: string;
  filePath: string;
}> {
  const record = (await readRegistry(root, owner)).find(item => item.id === id);
  if (!record) throw new Error('subject_not_found');
  const filePath = resolveOwnedImage(root, owner, record.imagePath);
  try {
    return { image: await readFile(filePath), mimeType: record.mimeType, filePath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('subject_image_missing');
    throw error;
  }
}

export async function deleteSubject(root: string, owner: SubjectOwner, id: string): Promise<boolean> {
  return withOwnerWrite(root, owner, async () => {
  const records = await readRegistry(root, owner);
  const record = records.find(item => item.id === id);
  if (!record) return false;
  await rm(resolveOwnedImage(root, owner, record.imagePath), { force: true });
  await writeRegistry(root, owner, records.filter(item => item.id !== id));
  return true;
  });
}
