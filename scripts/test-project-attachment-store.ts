import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  createProjectAttachment,
  deleteProjectAttachment,
  listProjectAttachments,
  readProjectAttachment,
  reorderProjectAttachments,
} from '../src/lib/project-attachments/project-attachment-store';
import {
  appendVimaxProjectAttachmentContext,
  materializeVimaxProjectImageAttachments,
  resolveVimaxProjectAttachments,
} from '../src/lib/skills/vimax-short-drama/vimax-project-attachments';

const ownerA = { tenantId: 'tenant-a', memberId: 'member-a' };
const ownerB = { tenantId: 'tenant-a', memberId: 'member-b' };
const projectA = 'project-a';
const projectB = 'project-b';

async function main() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'huiying-project-attachments-'));
  const previousRoot = process.env.HUIYING_PROJECT_ATTACHMENT_STORE_PATH;
  process.env.HUIYING_PROJECT_ATTACHMENT_STORE_PATH = root;
  try {
    const [image, video, document] = await Promise.all([
      createProjectAttachment(root, ownerA, {
        projectId: projectA,
        name: 'character.png',
        kind: 'image',
        mimeType: 'image/png',
        content: Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
        extension: 'png',
      }),
      createProjectAttachment(root, ownerA, {
        projectId: projectA,
        name: 'reference.mp4',
        kind: 'video',
        mimeType: 'video/mp4',
        content: Buffer.from('000000186674797069736f6d00000000', 'hex'),
        extension: 'mp4',
      }),
      createProjectAttachment(root, ownerA, {
        projectId: projectA,
        name: 'outline.txt',
        kind: 'document',
        mimeType: 'text/plain',
        content: Buffer.from('A concrete story outline.', 'utf8'),
        extension: 'txt',
      }),
    ]);

    const initial = await listProjectAttachments(root, ownerA, projectA);
    assert.equal(initial.length, 3, 'concurrent writes must retain every attachment');
    assert.deepEqual(new Set(initial.map(item => item.kind)), new Set(['image', 'video', 'document']));
    assert.deepEqual(
      (await reorderProjectAttachments(root, ownerA, projectA, [document.id, image.id, video.id]))
        .map(item => item.id),
      [document.id, image.id, video.id],
      'explicit order must persist',
    );
    assert.deepEqual(
      (await listProjectAttachments(root, ownerA, projectA)).map(item => item.id),
      [document.id, image.id, video.id],
    );
    const resolved = await resolveVimaxProjectAttachments(
      ownerA,
      projectA,
      [document.id, image.id, video.id],
    );
    assert.deepEqual(resolved.map(item => item.id), [document.id, image.id, video.id]);
    const prompt = await appendVimaxProjectAttachmentContext('Create a short film.', ownerA, resolved);
    assert.match(prompt, /A concrete story outline\./, 'document content must reach planning context');
    assert.match(prompt, /character\.png/);
    assert.match(prompt, /reference\.mp4/);
    const imageAssets = await materializeVimaxProjectImageAttachments(ownerA, resolved);
    assert.equal(imageAssets.length, 1);
    assert.match(imageAssets[0]?.url || '', /^data:image\/png;base64,/);

    await assert.rejects(
      () => readProjectAttachment(root, ownerB, projectA, image.id),
      /project_attachment_not_found/,
      'another member must not read an attachment',
    );
    await assert.rejects(
      () => readProjectAttachment(root, ownerA, projectB, image.id),
      /project_attachment_not_found/,
      'the same owner must not move an attachment across projects',
    );
    assert.equal(
      await deleteProjectAttachment(root, ownerB, projectA, image.id),
      false,
      'another member must not delete an attachment',
    );

    const owned = await readProjectAttachment(root, ownerA, projectA, image.id);
    await rm(owned.absolutePath, { force: true });
    await assert.rejects(
      () => readProjectAttachment(root, ownerA, projectA, image.id),
      /ENOENT|project_attachment_not_found/,
      'missing media must fail closed',
    );
    assert.equal(
      (await listProjectAttachments(root, ownerA, projectA)).some(item => item.id === image.id),
      false,
      'missing media must not be returned by list',
    );

    assert.equal(await deleteProjectAttachment(root, ownerA, projectA, video.id), true);
    assert.equal(await deleteProjectAttachment(root, ownerA, projectA, video.id), false);

    const files = await readFile(
      path.join(process.cwd(), 'src/app/api/project-attachments/[id]/route.ts'),
      'utf8',
    );
    const collection = await readFile(
      path.join(process.cwd(), 'src/app/api/project-attachments/route.ts'),
      'utf8',
    );
    assert.match(collection, /resolvePaperHostCreationOwnerFromRequest/);
    assert.match(collection, /video\/mp4/);
    assert.match(collection, /application\/pdf/);
    assert.match(collection, /reorderProjectAttachments/);
    assert.match(files, /status:\s*401/);
    assert.match(files, /status:\s*404/);
    assert.match(files, /status:\s*416/);
    assert.match(files, /Accept-Ranges/);
    assert.match(files, /Cache-Control': 'private/);
    assert.match(files, /X-Content-Type-Options': 'nosniff/);

    const registries = JSON.stringify(await listProjectAttachments(root, ownerA, projectA));
    assert.doesNotMatch(registries, /tenant-a|member-a/);

    console.log(JSON.stringify({
      ok: true,
      attachmentKinds: ['image', 'video', 'document'],
      ownerIsolation: true,
      projectIsolation: true,
      rangeContract: true,
    }));
  } finally {
    if (previousRoot === undefined) delete process.env.HUIYING_PROJECT_ATTACHMENT_STORE_PATH;
    else process.env.HUIYING_PROJECT_ATTACHMENT_STORE_PATH = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
}

void main();
