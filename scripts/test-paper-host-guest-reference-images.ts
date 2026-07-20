import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const guestA = 'guest-creation-browser-session-7f9a2c';
const guestB = 'guest-creation-browser-session-4d8e1f';
const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const guestHeaders = (workspace: string) => ({
  'content-type': 'application/json',
  'x-paper-host-embed': 'creation-agent',
  'x-paper-host-guest-workspace': workspace,
});

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), 'sceneweave-paper-reference-'));
  process.env.HUIYING_SUBJECT_STORE_PATH = root;
  process.env.HUIYING_TASKS_FILE = path.join(root, 'tasks.json');

  const [{ NextRequest }, subjects, subjectById, dryRun] = await Promise.all([
    import('next/server'),
    import('../src/app/api/subjects/route'),
    import('../src/app/api/subjects/[id]/route'),
    import('../src/app/api/production/dry-run/route'),
  ]);

  const subjectsRequest = (workspace: string | null, init: {
    method?: string;
    body?: BodyInit;
    headers?: Record<string, string>;
  } = {}) => new NextRequest(
    'http://localhost/api/subjects',
    {
      ...init,
      headers: workspace ? { ...guestHeaders(workspace), ...(init.headers || {}) } : init.headers,
    },
  );

  try {
    const anonymous = await subjects.GET(subjectsRequest(null));
    assert.equal(anonymous.status, 401, 'anonymous subject access must remain closed');

    const wrongContext = await subjects.POST(subjectsRequest(guestA, {
      method: 'POST',
      body: JSON.stringify({
        name: '越权主体.png',
        type: 'object',
        source: 'uploaded',
        referenceUrl: pngDataUrl,
      }),
    }));
    assert.equal(wrongContext.status, 403, 'guest creation scope must not write the regular subject library');

    const createdResponse = await subjects.POST(subjectsRequest(guestA, {
      method: 'POST',
      body: JSON.stringify({
        name: '课堂实验参考图.png',
        type: 'object',
        source: 'uploaded',
        context: 'creation-agent',
        referenceUrl: pngDataUrl,
      }),
    }));
    const created = await createdResponse.json() as {
      subject?: { id?: string; name?: string; context?: string };
    };
    assert.equal(createdResponse.status, 201, 'scoped guest should upload a reference image');
    assert.equal(created.subject?.name, '课堂实验参考图.png');
    assert.equal(created.subject?.context, 'creation-agent');
    assert.equal(typeof created.subject?.id, 'string');
    const id = created.subject?.id || '';

    const restoredResponse = await subjects.GET(subjectsRequest(guestA));
    const restored = await restoredResponse.json() as { subjects?: Array<{ id?: string; context?: string }> };
    assert.equal(restoredResponse.status, 200);
    assert.deepEqual(restored.subjects?.map(item => item.id), [id], 'same guest should restore uploaded references');

    const isolatedResponse = await subjects.GET(subjectsRequest(guestB));
    const isolated = await isolatedResponse.json() as { subjects?: unknown[] };
    assert.equal(isolatedResponse.status, 200);
    assert.deepEqual(isolated.subjects, [], 'another guest workspace must not see the reference');

    const guestBDelete = await subjectById.DELETE(
      new NextRequest(`http://localhost/api/subjects/${id}`, {
        method: 'DELETE',
        headers: guestHeaders(guestB),
      }),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(guestBDelete.status, 404, 'another guest must not delete the reference');

    const dryRunResponse = await dryRun.POST(new NextRequest('http://localhost/api/production/dry-run', {
      method: 'POST',
      headers: guestHeaders(guestA),
      body: JSON.stringify({
        prompt: '用三幕结构讲解光合作用',
        workflow: 'lesson-script',
        model: 'production-dry-run',
        referenceIds: [id],
      }),
    }));
    const dryRunBody = await dryRunResponse.json() as { references?: Array<{ id?: string }> };
    assert.equal(dryRunResponse.status, 200);
    assert.deepEqual(dryRunBody.references?.map(item => item.id), [id], 'dry-run should bind owned references');

    const deleted = await subjectById.DELETE(
      new NextRequest(`http://localhost/api/subjects/${id}`, {
        method: 'DELETE',
        headers: guestHeaders(guestA),
      }),
      { params: Promise.resolve({ id }) },
    );
    assert.equal(deleted.status, 200);

    const afterDeleteResponse = await subjects.GET(subjectsRequest(guestA));
    const afterDelete = await afterDeleteResponse.json() as { subjects?: unknown[] };
    assert.deepEqual(afterDelete.subjects, [], 'deleted references must stay gone after refresh');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main()
  .then(() => console.log('paper host guest reference image contract: ok'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
