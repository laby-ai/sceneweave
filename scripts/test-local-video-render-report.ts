import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { mergeVideosWithLocalFfmpeg } from '../src/lib/local-video-merge';

async function main() {
  const fixture = await readFile(path.resolve('public/home/huiying-ark-test-clip.mp4'));
  const outputDirectory = path.join(tmpdir(), `sceneweave-render-report-${process.pid}`);
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      'content-type': 'video/mp4',
      'content-length': fixture.length,
    });
    response.end(fixture);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const videoUrl = `http://127.0.0.1:${address.port}/fixture.mp4`;
    const result = await mergeVideosWithLocalFfmpeg([videoUrl, videoUrl], {
      outputDirectory,
      outputFileName: 'verified.mp4',
      expectedDurationSeconds: 12.1,
    });

    assert.equal(result.renderReport.status, 'passed');
    assert.equal(result.renderReport.segmentCount, 2);
    assert.ok(result.renderReport.outputBytes >= 1024);
    assert.ok(Math.abs(result.renderReport.actualDurationSeconds - 12.1) <= 1.21);
    console.log(JSON.stringify({
      ok: true,
      script: 'test-local-video-render-report',
      renderReport: result.renderReport,
      providerCalls: 0,
    }));
  } finally {
    server.close();
    await rm(outputDirectory, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
