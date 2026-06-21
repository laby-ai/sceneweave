const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:5000';

const requiredEntrypoints = [
  { path: '/', expected: '/' },
  { path: '/video', expected: '/?section=video' },
  { path: '/image', expected: '/?section=image' },
  { path: '/smart', expected: '/?section=smart' },
  { path: '/media', expected: '/?section=media&media=assets' },
  { path: '/film', expected: '/?section=film' },
  { path: '/tasks', expected: '/?section=tasks' },
  { path: '/node-editor', expected: '/node-editor' },
  { path: '/research', expected: '/research' },
  { path: '/settings', expected: '/?section=settings' },
];

const results = [];

for (const entrypoint of requiredEntrypoints) {
  const url = new URL(entrypoint.path, baseUrl);
  try {
    const response = await fetch(url, { redirect: 'follow' });
    const finalUrl = new URL(response.url);
    const actual = `${finalUrl.pathname}${finalUrl.search}`;
    const ok = response.ok && actual === entrypoint.expected;
    results.push({
      ...entrypoint,
      ok,
      status: response.status,
      finalUrl: actual,
    });
  } catch (error) {
    results.push({
      ...entrypoint,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const failed = results.filter((result) => !result.ok);

console.log(JSON.stringify({
  ok: failed.length === 0,
  baseUrl,
  checked: results.length,
  results,
  failed,
}, null, 2));

if (failed.length > 0) {
  process.exit(1);
}
