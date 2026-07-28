import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  createSubject,
  deleteSubject,
  listSubjects,
  readSubjectImage,
} from '../src/lib/subjects/subject-store';

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), 'huiying-subjects-'));
  try {
  const imagePath = path.join(root, 'source.png');
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  await writeFile(imagePath, png);

  const alpha = { tenantId: 'tenant-a', memberId: 'member-a' };
  const beta = { tenantId: 'tenant-a', memberId: 'member-b' };
  const subject = await createSubject(root, alpha, {
    name: '主角 A',
    type: 'character',
    source: 'generated',
    image: png,
    mimeType: 'image/png',
  });

  assert.equal((await listSubjects(root, alpha)).length, 1, 'owner should see subject');
  assert.equal((await listSubjects(root, beta)).length, 0, 'other member must not see subject');
  await assert.rejects(() => readSubjectImage(root, beta, subject.id), /subject_not_found/);

  const stored = await readSubjectImage(root, alpha, subject.id);
  assert.equal(stored.mimeType, 'image/png');
  assert.deepEqual(stored.image, png);

  await rm(stored.filePath, { force: true });
  await assert.rejects(() => readSubjectImage(root, alpha, subject.id), /subject_image_missing/);
  assert.equal((await listSubjects(root, alpha)).length, 0, 'missing images must fail closed');

  const removable = await createSubject(root, alpha, {
    name: '场景 B',
    type: 'scene',
    source: 'generated',
    image: png,
    mimeType: 'image/png',
  });
  assert.equal(await deleteSubject(root, beta, removable.id), false, 'other member cannot delete');
  assert.equal(await deleteSubject(root, alpha, removable.id), true, 'owner can delete');
  assert.equal((await listSubjects(root, alpha)).length, 0);

  const concurrent = await Promise.all(['角色 C', '角色 D'].map(name => createSubject(root, alpha, {
    name,
    type: 'character',
    source: 'generated',
    image: png,
    mimeType: 'image/png',
  })));
  assert.equal((await listSubjects(root, alpha)).length, 2, 'concurrent writes must not lose records');
  await Promise.all(concurrent.map(item => deleteSubject(root, alpha, item.id)));

  const apiRoute = await readFile(path.join(process.cwd(), 'src/app/api/subjects/route.ts'), 'utf8');
  const itemRoute = await readFile(path.join(process.cwd(), 'src/app/api/subjects/[id]/route.ts'), 'utf8');
  const library = await readFile(path.join(process.cwd(), 'src/components/assets/assets-library.tsx'), 'utf8');
  const workspace = await readFile(path.join(process.cwd(), 'src/components/generate/generate-workspace.tsx'), 'utf8');
  const main = await readFile(path.join(process.cwd(), 'src/components/home/dreambox-main-content.tsx'), 'utf8');
  assert.match(apiRoute, /resolvePaperHostCreationOwnerFromRequest/);
  assert.match(apiRoute, /subject_source_not_allowed/);
  assert.match(apiRoute, /15 \* 1024 \* 1024/);
  assert.match(itemRoute, /Cache-Control': 'private/);
  assert.match(library, /保存为主体/);
  assert.match(library, /\/api\/subjects/);
  assert.doesNotMatch(library, /会自动沉淀为可复用主体/);
  assert.match(
    workspace,
    /clientApiFetch<\{ attachments\?: Array<Omit<ProjectAttachmentItem,[\s\S]*?`\/api\/project-attachments\?projectId=/,
  );
  assert.match(workspace, /projectAttachmentIds:\s*selectedReferencesRef\.current/);
  assert.doesNotMatch(workspace, /@主体|删除主体|\/api\/subjects/);
  assert.match(workspace, /imageRefs:\s*selectedReferences[\s\S]*?\.map\(reference => reference\.url!\)/);
  assert.match(main, /setPendingImageRefs\(transfer\?\.imageRefs \|\| \[\]\)/);
  assert.match(
    main,
    /setShouldAutoGenerate\(Boolean\(prompt\?\.trim\(\)\)\)/,
    'choosing a creation mode without a prompt must not trigger a billable default generation',
  );

  console.log('member subject library tests passed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

void main();
