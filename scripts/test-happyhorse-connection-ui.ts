import assert from 'node:assert/strict';

import { chromium } from '@playwright/test';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://127.0.0.1:5099/sceneweave';
const workspace = 'guest-creation-happyhorse-ui-fixture';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  try {
    await page.goto(`${baseUrl}/embed/creation-agent?embed=creation-agent&workspaceKey=${workspace}`, {
      waitUntil: 'networkidle',
    });
    await page.getByRole('button', { name: '连接快乐马' }).click();
    await page.getByLabel('API Base').fill('https://workspace.example.com/api/v1');
    await page.getByLabel('API Key').fill('dummy-key');
    await page.getByLabel('视频模型').fill('happyhorse-1.1-t2v');
    await page.getByRole('button', { name: '保存到当前会话' }).click();
    await page.getByRole('button', { name: '快乐马已连接' }).waitFor();

    const stored = await page.evaluate(scope => {
      const raw = sessionStorage.getItem(`dreambox-happyhorse-connection:paper-host:${scope}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        provider: parsed.provider,
        apiBase: parsed.apiBase,
        videoModel: parsed.videoModel,
        hasKey: typeof parsed.apiKey === 'string' && parsed.apiKey.length > 0,
      };
    }, workspace);
    assert.deepEqual(stored, {
      provider: 'happyhorse-dashscope',
      apiBase: 'https://workspace.example.com/api/v1',
      videoModel: 'happyhorse-1.1-t2v',
      hasKey: true,
    });

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '快乐马已连接' }).waitFor();
    await page.getByRole('button', { name: '快乐马已连接' }).click();
    await page.getByRole('button', { name: '清除' }).click();
    await page.getByRole('button', { name: '连接快乐马' }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(overflow, false, 'creation workspace must not overflow horizontally');
    assert.equal(consoleErrors.length, 0, `browser console errors: ${consoleErrors.join(' | ')}`);

    console.log(JSON.stringify({
      ok: true,
      baseUrl,
      viewport: '1440x900',
      sessionScoped: true,
      refreshRestored: true,
      clearSucceeded: true,
      consoleErrors: 0,
      horizontalOverflow: false,
      usedRealKey: false,
      incurredCost: false,
    }));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
