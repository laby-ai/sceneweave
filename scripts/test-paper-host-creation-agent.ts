import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CreationAgentShell } from '../src/components/creation-agent/creation-agent-shell';
import { CreationAgentTaskStage } from '../src/components/creation-agent/creation-agent-task-stage';
import {
  applyCreationEvent,
  beginCreation,
  cancelCreation,
  createCreationAgentState,
  createCreationRequestId,
  retryCreation,
  validateCreationPrompt,
} from '../src/lib/creation-agent/creation-agent-model';
import {
  createPaperHostMessage,
  parsePaperHostMessage,
} from '../src/lib/paper-host-bridge';

const testCreationState = () => {
  assert.equal(
    createCreationRequestId(() => 'browser-uuid'),
    'request-browser-uuid',
  );
  assert.match(
    createCreationRequestId(null, () => 1234567890, () => 0.25),
    /^request-1234567890-[a-z0-9]+$/,
  );

  assert.deepEqual(validateCreationPrompt(' '), {
    valid: false,
    message: '请输入至少2个字符的创作想法',
  });
  assert.deepEqual(validateCreationPrompt('制作一段解释潮汐形成的科教短片'), {
    valid: true,
    message: '',
  });

  const idle = createCreationAgentState();
  assert.equal(idle.status, 'idle');
  assert.equal(idle.progress, 0);
  assert.equal(idle.attempt, 0);

  const submitting = beginCreation(idle, {
    requestId: 'request-1',
    prompt: '制作一段解释潮汐形成的科教短片',
  });
  assert.equal(submitting.status, 'submitting');
  assert.equal(submitting.requestId, 'request-1');
  assert.equal(submitting.prompt, '制作一段解释潮汐形成的科教短片');
  assert.equal(submitting.attempt, 1);

  const running = applyCreationEvent(submitting, {
    requestId: 'request-1',
    taskId: 'task-1',
    status: 'running',
    stage: '生成分镜',
    progress: 55,
    message: '已生成镜头草案',
  });
  assert.equal(running.status, 'running');
  assert.equal(running.taskId, 'task-1');
  assert.equal(running.progress, 55);
  assert.equal(running.stage, '生成分镜');

  const staleRequest = applyCreationEvent(running, {
    requestId: 'stale-request',
    taskId: 'stale-task',
    status: 'completed',
    progress: 100,
  });
  assert.deepEqual(staleRequest, running);

  const staleTask = applyCreationEvent(running, {
    requestId: 'request-1',
    taskId: 'stale-task',
    status: 'completed',
    progress: 100,
  });
  assert.deepEqual(staleTask, running);

  const reconnecting = applyCreationEvent(running, {
    requestId: 'request-1',
    taskId: 'task-1',
    status: 'reconnecting',
    progress: 999,
  });
  assert.equal(reconnecting.status, 'reconnecting');
  assert.equal(reconnecting.progress, 100);

  const failed = applyCreationEvent(running, {
    requestId: 'request-1',
    taskId: 'task-1',
    status: 'failed',
    progress: 72,
    error: 'provider raw stack and request id',
  });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.error, '创作任务暂时未完成，请稍后重试');
  assert.equal(failed.canRetry, true);
  assert.doesNotMatch(failed.error, /provider|request id/i);

  const retrying = retryCreation(failed);
  assert.equal(retrying.status, 'idle');
  assert.equal(retrying.prompt, failed.prompt);
  assert.equal(retrying.attempt, 1);
  assert.equal(retrying.taskId, undefined);
  assert.equal(retrying.error, '');

  const cancelled = cancelCreation(running);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.canRetry, true);
  assert.deepEqual(applyCreationEvent(cancelled, {
    requestId: 'request-1',
    taskId: 'task-1',
    status: 'completed',
    progress: 100,
  }), cancelled);

  const completed = applyCreationEvent(running, {
    requestId: 'request-1',
    taskId: 'task-1',
    status: 'completed',
    progress: 87,
    result: {
      title: '潮汐形成',
      shotCount: 6,
      downloadUrl: '/api/production/export?taskId=task-1',
    },
  });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.progress, 100);
  assert.equal(completed.canRetry, false);
  assert.equal(completed.result?.shotCount, 6);

  const restored = createCreationAgentState({
    ...completed,
    progress: 240,
  });
  assert.equal(restored.status, 'completed');
  assert.equal(restored.progress, 100);
  assert.equal(restored.taskId, 'task-1');
};

const testPaperHostBridge = () => {
  const expectedOrigin = 'https://ucas.sitianai.com';
  const ready = createPaperHostMessage('paper-host-ready');
  assert.deepEqual(ready, { type: 'paper-host-ready', version: 1 });

  const parsed = parsePaperHostMessage({
    origin: expectedOrigin,
    data: ready,
  }, expectedOrigin);
  assert.deepEqual(parsed, ready);

  assert.equal(parsePaperHostMessage({
    origin: 'https://attacker.example',
    data: ready,
  }, expectedOrigin), null);

  assert.equal(parsePaperHostMessage({
    origin: expectedOrigin,
    data: { type: 'paper-host-ready', version: 1, token: 'must-not-cross' },
  }, expectedOrigin), null);

  assert.equal(parsePaperHostMessage({
    origin: expectedOrigin,
    data: { type: 'unknown-event', version: 1 },
  }, expectedOrigin), null);

  const loginRequired = createPaperHostMessage(
    'paper-host-login-required',
    '保存创作项目需要登录',
  );
  assert.deepEqual(parsePaperHostMessage({
    origin: expectedOrigin,
    data: loginRequired,
  }, expectedOrigin), loginRequired);

  assert.throws(
    () => createPaperHostMessage('paper-host-return', 'x'.repeat(121)),
    /reason/i,
  );
};

const testEmbeddedShell = () => {
  const html = renderToStaticMarkup(createElement(CreationAgentShell));

  assert.match(html, /data-paper-host-creation-agent="true"/);
  assert.match(html, /科教创作/);
  assert.match(html, /新建创作/);
  assert.match(html, /最近创作/);
  assert.match(html, /教学脚本/);
  assert.match(html, /课程分镜/);
  assert.match(html, /参考图/);
  assert.match(html, /输入教学主题、脚本想法或上传参考/);
  assert.doesNotMatch(html, /SceneWeave|开启创作|>首页<|>资产<|>设置</);

  const failedState = applyCreationEvent(beginCreation(createCreationAgentState(), {
    requestId: 'request-failed',
    prompt: '解释月相变化',
  }), {
    requestId: 'request-failed',
    status: 'failed',
  });
  const failedHtml = renderToStaticMarkup(createElement(CreationAgentTaskStage, {
    state: failedState,
    notice: '',
    onCancel: () => undefined,
    onRetry: () => undefined,
  }));
  assert.match(failedHtml, /生成失败/);
  assert.doesNotMatch(failedHtml, />failed</);
};

testCreationState();
testPaperHostBridge();
testEmbeddedShell();
console.log('paper host creation agent contract: ok');
