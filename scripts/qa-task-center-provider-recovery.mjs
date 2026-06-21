import fs from 'node:fs';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const taskCenterPath = path.resolve('src/components/task-center.tsx');
const actionComponentPath = path.resolve('src/components/tasks/task-center-segment-actions.tsx');
const recoveryHookPath = path.resolve('src/hooks/useTaskCenterProviderRecovery.ts');
const routePath = path.resolve('src/app/api/production/assembly-plan/segment/recover-provider-task/route.ts');

const taskCenterSource = fs.readFileSync(taskCenterPath, 'utf8');
const actionSource = fs.readFileSync(actionComponentPath, 'utf8');
const hookSource = fs.readFileSync(recoveryHookPath, 'utf8');
const routeSource = fs.readFileSync(routePath, 'utf8');

const taskCenterMarkers = [
  'useTaskCenterProviderRecovery',
  'segmentProviderRecoveryKey',
  'recoverAssemblyProviderTask',
  'TaskCenterSegmentActions',
];

for (const marker of taskCenterMarkers) {
  assert(taskCenterSource.includes(marker), `task center missing provider recovery marker: ${marker}`);
}

const hookMarkers = [
  'recoverAssemblyProviderTask',
  '/api/production/assembly-plan/segment/recover-provider-task',
  'getBYOKRequestHeaders',
  'segmentProviderRecoveryKey',
  '没有重新提交生成',
];

for (const marker of hookMarkers) {
  assert(hookSource.includes(marker), `task center provider recovery hook missing marker: ${marker}`);
}

const actionMarkers = [
  '查供应商',
  'providerTaskId',
  'onRecoverProviderTask',
  '优先续查 providerTaskId',
  '不产生新的视频生成费用',
];

for (const marker of actionMarkers) {
  assert(actionSource.includes(marker), `task center segment actions missing marker: ${marker}`);
}

assert(routeSource.includes('recoverProductionSegmentProviderTask'), 'recover provider route is not wired to service');
assert(!taskCenterSource.includes('ARK_API_KEY'), 'task center must not hard-code Ark API env names');
assert(!actionSource.includes('ARK_API_KEY'), 'action component must not hard-code Ark API env names');
assert(!hookSource.includes('ARK_API_KEY'), 'recovery hook must not hard-code Ark API env names');
assert(!taskCenterSource.includes('doubao-seedance-1-5-pro-251215'), 'task center must not hard-code provider model id');
assert(!actionSource.includes('doubao-seedance-1-5-pro-251215'), 'action component must not hard-code provider model id');
assert(!hookSource.includes('doubao-seedance-1-5-pro-251215'), 'recovery hook must not hard-code provider model id');

console.log(JSON.stringify({
  ok: true,
  usedRealKey: false,
  incurredCost: false,
  route: '/api/production/assembly-plan/segment/recover-provider-task',
  uiEntry: 'task-center assembly segment action',
  actionLabel: '查供应商',
  sourceMarkers: [...taskCenterMarkers, ...hookMarkers, ...actionMarkers],
}, null, 2));
