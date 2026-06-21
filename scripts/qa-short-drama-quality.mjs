import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HUIYING_BASE_URL || 'http://localhost:5000';
const tasksFile = process.env.HUIYING_TASKS_FILE || path.join('/tmp', 'dreambox-tasks', 'tasks.json');
const lockFile = `${tasksFile}.qa.lock`;
let lockFd = null;

const prompt = '凌晨的便利店里，失业剪辑师发现货架上的旧录像带正在播放他明天的失败面试；他必须在店员关灯前改掉结局。';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON: ${text.slice(0, 240)}`);
  }
  return { res, json };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pollutedFragments = [
  '女性穿着舒适家居服',
  '男性穿着舒适家居服',
  '舒适家居服的人物',
  '辽阔的海边沙滩',
  '浪花轻柔拍打岸边',
  '人物形象展示',
  '故事发生的场景空间',
  '柔和的自然光空间',
  '壮丽的自然景观',
];

function assertNoTemplatePollution(value, label) {
  const text = JSON.stringify(value || '');
  const found = pollutedFragments.find(fragment => text.includes(fragment));
  assert(!found, `${label} contains template pollution: ${found}`);
}

function assertStoryTerms(value, label) {
  const text = JSON.stringify(value || '');
  for (const term of ['剪辑师', '便利店', '旧录像带']) {
    assert(text.includes(term), `${label} missing story term: ${term}`);
  }
}

function ensureTaskDir() {
  fs.mkdirSync(path.dirname(tasksFile), { recursive: true });
}

function acquireLock() {
  ensureTaskDir();
  try {
    lockFd = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(lockFd, JSON.stringify({
      pid: process.pid,
      script: 'qa-short-drama-quality',
      startedAt: new Date().toISOString(),
    }));
  } catch {
    throw new Error(`任务 QA 正在运行或上次异常退出未清理锁文件：${lockFile}`);
  }
}

function releaseLock() {
  if (lockFd !== null) {
    fs.closeSync(lockFd);
    lockFd = null;
  }
  if (fs.existsSync(lockFile)) {
    fs.rmSync(lockFile, { force: true });
  }
}

function assertStoryBible(project) {
  const storyBible = project?.storyBible;
  assert(storyBible, 'productionProject.storyBible missing');
  for (const field of ['premise', 'protagonist', 'desire', 'obstacle', 'conflict', 'turningPoint', 'endingHook']) {
    assert(typeof storyBible[field] === 'string' && storyBible[field].length >= 4, `storyBible.${field} incomplete`);
  }
  assert(storyBible.emotionalArc?.start, 'storyBible emotionalArc.start missing');
  assert(storyBible.emotionalArc?.shift, 'storyBible emotionalArc.shift missing');
  assert(storyBible.emotionalArc?.end, 'storyBible emotionalArc.end missing');
  assert(Array.isArray(storyBible.continuityRules) && storyBible.continuityRules.length >= 3, 'continuity rules incomplete');
  assert(Array.isArray(storyBible.beats) && storyBible.beats.length >= 3, 'story beats incomplete');
  assert(!['人物', '主体', '角色', '主角', '核心角色'].includes(storyBible.protagonist), 'storyBible protagonist is too generic');
  assert(storyBible.protagonist.includes('剪辑师'), 'storyBible protagonist did not recover the role from prompt');
  assert(storyBible.relationship.includes('便利店'), 'storyBible relationship did not recover the location from prompt');
  assert(storyBible.conflict.includes('旧录像带'), 'storyBible conflict did not recover the key prop from prompt');
}

function assertSemanticPlan(project) {
  const semanticPlan = project?.semanticPlan;
  assert(semanticPlan, 'productionProject.semanticPlan missing');
  assert(semanticPlan.version === 'yh-production-semantic-plan-v1', 'semanticPlan version mismatch');
  assert(semanticPlan.source === 'video-production-v3-merged', 'semanticPlan source mismatch');
  assert(semanticPlan.reference?.primary === 'ViMax', 'semanticPlan primary reference mismatch');
  assert(Array.isArray(semanticPlan.reference?.secondary) && semanticPlan.reference.secondary.includes('Toonflow-app') && semanticPlan.reference.secondary.includes('ArcReel'), 'semanticPlan secondary references incomplete');
  assert(semanticPlan.writerOutput?.contentType === 'short_drama', 'writerOutput contentType mismatch');
  assert(Array.isArray(semanticPlan.writerOutput?.narrative) && semanticPlan.writerOutput.narrative.length >= 3, 'writerOutput narrative incomplete');
  assert(Array.isArray(semanticPlan.directorOutput?.shots) && semanticPlan.directorOutput.shots.length >= 3, 'directorOutput shots incomplete');
  assert(semanticPlan.directorOutput.shots.every(shot => shot.visualPrompt && shot.characterRefs?.includes('char-1')), 'directorOutput shots missing visual prompt or character refs');
  assert(Array.isArray(semanticPlan.characterBibles) && semanticPlan.characterBibles.length >= 1, 'characterBibles missing');
  assert(semanticPlan.characterBibles[0].name.includes('剪辑师'), 'CharacterBible did not preserve protagonist');
  assert(Array.isArray(semanticPlan.sceneBibles) && semanticPlan.sceneBibles.length >= 1, 'sceneBibles missing');
  assert(semanticPlan.sceneBibles[0].name.includes('便利店'), 'SceneBible did not preserve location');
  const shotListShots = semanticPlan.shotList?.scenes?.flatMap(scene => scene.shots || []) || [];
  assert(shotListShots.length === semanticPlan.directorOutput.shots.length, 'shotList and directorOutput shot count mismatch');
  assert(shotListShots.every(shot => shot.sceneId && shot.characterIds?.length && shot.visualPrompt), 'shotList shots missing scene/character/prompt');
  const dagNodes = semanticPlan.dag?.nodes || [];
  assert(dagNodes.some(node => node.nodeId === 'n_character_bible'), 'DAG missing character bible node');
  assert(dagNodes.some(node => node.nodeId === 'n_scene_bible'), 'DAG missing scene bible node');
  assert(dagNodes.some(node => node.nodeId === 'n_assembly'), 'DAG missing assembly node');
  assert((semanticPlan.assetLinks?.characterAssetIds || []).length >= 1, 'semanticPlan character asset links missing');
  assert(semanticPlan.assetLinks?.storyboardAssetId, 'semanticPlan storyboard asset link missing');
  assertNoTemplatePollution(semanticPlan.directorOutput.shots, 'directorOutput.shots');
  assertStoryTerms(semanticPlan.directorOutput.shots, 'directorOutput.shots');
}

let lockAcquired = false;
let originalExists = false;
let originalContent = null;
let createdTaskId = null;
const results = [];

try {
  acquireLock();
  lockAcquired = true;
  originalExists = fs.existsSync(tasksFile);
  originalContent = originalExists ? fs.readFileSync(tasksFile, 'utf8') : null;

  const director = await fetchJson(`${baseUrl}/api/smart/director-chain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      duration: 30,
      segmentDuration: 10,
      style: '现实悬疑短剧',
      sceneType: 'drama',
      ratio: '16:9',
    }),
  });

  assert(director.res.ok, `POST /api/smart/director-chain failed: ${director.res.status}`);
  assert(director.json.success === true, 'director-chain success mismatch');
  assert(director.json.usedRealKey === false, 'director-chain unexpectedly used real key');
  assert(director.json.incurredCost === false, 'director-chain unexpectedly incurred cost');
  createdTaskId = director.json.taskId;
  assert(createdTaskId, 'taskId missing');
  assertStoryBible(director.json.productionProject);
  assertSemanticPlan(director.json.productionProject);

  const shots = director.json.productionProject.storyboard?.shots || [];
  assert(shots.length >= 3, `expected at least 3 shots, got ${shots.length}`);
  assert(shots.every(shot => shot.storyBeat && shot.dramaticPurpose && shot.emotionShift), 'shots missing story beat metadata');
  assertNoTemplatePollution(shots, 'productionProject.storyboard.shots');
  assert(shots.every(shot => shot.prompt.includes('【观众必须看懂】') && shot.prompt.includes('【三要素】')), 'shots missing story-visible execution markers');
  assertStoryTerms(shots, 'productionProject.storyboard.shots');
  assert(director.json.directorChain?.agents?.some(agent => JSON.stringify(agent.output).includes('storyBible')), 'director output missing storyBible');

  results.push({
    check: 'director-chain-story-bible-and-semantic-plan',
    ok: true,
    taskId: createdTaskId,
    beatCount: director.json.productionProject.storyBible.beats.length,
    shotCount: shots.length,
    characterBibleCount: director.json.productionProject.semanticPlan.characterBibles.length,
    sceneBibleCount: director.json.productionProject.semanticPlan.sceneBibles.length,
    dagNodeCount: director.json.productionProject.semanticPlan.dag.nodes.length,
    usedRealKey: director.json.usedRealKey,
  });

  await sleep(1200);

  const assembly = await fetchJson(`${baseUrl}/api/production/assembly-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: createdTaskId, persist: true }),
  });

  assert(assembly.res.ok, `POST /api/production/assembly-plan failed: ${assembly.res.status}`);
  assert(assembly.json.success === true, 'assembly-plan success mismatch');
  const segments = assembly.json.assemblyPlan?.segments || [];
  assert(segments.length === shots.length, 'assembly segments do not match shots');
  for (const segment of segments) {
    assert(segment.prompt.includes('【短剧前提】'), `segment ${segment.index} missing premise`);
    assert(segment.prompt.includes('【角色动机】'), `segment ${segment.index} missing character motivation`);
    assert(segment.prompt.includes('【当前冲突】'), `segment ${segment.index} missing conflict`);
    assert(segment.prompt.includes('【剧情目的】'), `segment ${segment.index} missing dramatic purpose`);
    assert(segment.prompt.includes('【观众必须看见】'), `segment ${segment.index} missing visible story beat`);
    assert(segment.prompt.includes('【威胁对象】'), `segment ${segment.index} missing visible threat target`);
    assert(segment.prompt.includes('【危险源】'), `segment ${segment.index} missing visible danger source`);
    assert(segment.prompt.includes('【视觉冲突证据】'), `segment ${segment.index} missing visible conflict evidence`);
    assert(segment.prompt.includes('【动作因果】'), `segment ${segment.index} missing action causality`);
    assert(segment.prompt.includes('【入点状态】'), `segment ${segment.index} missing entry bridge state`);
    assert(segment.prompt.includes('【出点状态】'), `segment ${segment.index} missing exit bridge state`);
    assert(segment.prompt.includes('【桥接动作】'), `segment ${segment.index} missing bridge action`);
    assert(segment.prompt.includes('【剪辑衔接】'), `segment ${segment.index} missing edit bridge`);
    assert(segment.prompt.includes('【操作结果】'), `segment ${segment.index} missing operation result`);
    assert(segment.prompt.includes('【结尾钩子证据】'), `segment ${segment.index} missing ending hook evidence`);
    assert(segment.prompt.includes('【结尾新问题】'), `segment ${segment.index} missing next story question`);
    assert(segment.prompt.includes('【道具状态】'), `segment ${segment.index} missing prop state`);
    assert(segment.prompt.includes('【连续性规则】'), `segment ${segment.index} missing continuity rules`);
    assert(segment.prompt.includes('【三要素验收】'), `segment ${segment.index} missing visible story acceptance gate`);
    if (segment.index === 0) {
      assert(/开场|建立/.test(segment.prompt), `segment ${segment.index} bridge should establish opening state`);
    } else {
      assert(/承接上一段|上一段末尾/.test(segment.prompt), `segment ${segment.index} bridge should inherit previous segment state`);
    }
    if (segment.index < segments.length - 1) {
      assert(/下一段|下段|下一镜头/.test(segment.prompt), `segment ${segment.index} bridge should leave next-segment handoff`);
    } else {
      assert(/结尾|结果|新状态|悬念/.test(segment.prompt), `segment ${segment.index} bridge should land final state`);
    }
    assertNoTemplatePollution(segment.prompt, `segment ${segment.index} prompt`);
    assertStoryTerms(segment.prompt, `segment ${segment.index} prompt`);
    assert(segment.expectedOutputs?.videoUrl === null, `segment ${segment.index} should not fake a video URL`);
  }

  results.push({
    check: 'assembly-story-aware-prompts',
    ok: true,
    segmentCount: segments.length,
    promptMarkers: ['短剧前提', '角色动机', '当前冲突', '剧情目的', '观众必须看见', '威胁对象', '危险源', '视觉冲突证据', '动作因果', '入点状态', '出点状态', '桥接动作', '剪辑衔接', '操作结果', '结尾钩子证据', '结尾新问题', '道具状态', '连续性规则'],
    usedRealKey: assembly.json.usedRealKey,
  });
} finally {
  if (lockAcquired) {
    if (originalExists) {
      fs.writeFileSync(tasksFile, originalContent, 'utf8');
    } else if (fs.existsSync(tasksFile)) {
      fs.rmSync(tasksFile, { force: true });
    }
    releaseLock();
  }
  await sleep(1200);
}

const restored = await fetchJson(`${baseUrl}/api/tasks?limit=20`);
const leaked = createdTaskId
  ? (restored.json.tasks || []).filter(task => task.id === createdTaskId)
  : [];
assert(leaked.length === 0, `short-drama-quality probe task leak detected: ${createdTaskId}`);

results.push({
  check: 'probe-restore',
  ok: true,
  leakedProbeTasks: 0,
  totalAfterRestore: restored.json.total,
});

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  tasksFile,
  usedRealKey: false,
  incurredCost: false,
  promptLength: prompt.length,
  results,
}, null, 2));
