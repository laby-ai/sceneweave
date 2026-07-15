# Paper Host Creation Agent Implementation Plan

> **Execution rule:** work through these tasks in order without waiting for a
> user checkpoint. If an external credential, paid provider, upstream push, or
> irreversible production action blocks one task, record that exact blocker
> and continue with the next safe task.

**Goal:** ship an upstream-friendly `/embed/creation-agent` in SceneWeave and
expose it from paper-web as the “科教” sibling of the existing KnowTrail “科研”
agent, with a no-cost task lifecycle and rollback-safe formal-domain release.

**Architecture:** SceneWeave remains an independent Next.js service. Its new
embedded route owns only creation-workbench presentation and delegates task
creation, events, cancellation, retry, recovery, storyboard, media, and owner
isolation to existing SceneWeave contracts. paper-web owns only navigation,
iframe lifecycle, trusted bridge messages, guest correlation, and return/login
behavior. Neither repository imports the other.

**Tech stack:** Next.js 16, React 19, TypeScript, Tailwind 4, pnpm 10.28.1,
Vue 2, Jest, Node 20.10.0, npm 10.2.3.

## Verified baseline constraints

- SceneWeave baseline: local `609c929`, upstream `f6ebc99`.
- paper-web baseline: Research `4f66b028`, upstream divergence `0/0`.
- SceneWeave `ts-check`, architecture guard, and spaghetti-growth guard pass.
- SceneWeave upstream full `lint:build` currently has 430 pre-existing errors.
  This plan does not hide or rewrite that debt: every new or edited file must
  pass targeted ESLint, plus full type-check, build, and architecture guards.
- No paid model call is part of this plan. `/api/production/dry-run` is the
  first server lifecycle because it reports `incurredCost: false`.
- Owner identity is server-derived. Query parameters never authorize task or
  asset access.

---

### Task 1: Pure creation-agent state and host bridge contracts

**Files:**

- Create: `scripts/test-paper-host-creation-agent.ts`
- Create: `src/lib/creation-agent/creation-agent-model.ts`
- Create: `src/lib/paper-host-bridge.ts`
- Modify: `package.json`

**Step 1: Add the failing executable contract test**

The test must import the not-yet-existing modules and execute these cases:

```ts
const idle = createCreationAgentState();
assert.deepEqual(validateCreationPrompt(' '), {
  valid: false,
  message: '请输入至少2个字符的创作想法',
});

const submitting = beginCreation(idle, {
  requestId: 'request-1',
  prompt: '制作一段解释潮汐形成的科教短片',
});
const running = applyCreationEvent(submitting, {
  requestId: 'request-1',
  taskId: 'task-1',
  status: 'running',
  stage: '生成分镜',
  progress: 55,
});
assert.equal(running.progress, 55);
assert.deepEqual(applyCreationEvent(running, {
  requestId: 'stale-request',
  taskId: 'stale-task',
  status: 'completed',
  progress: 100,
}), running);
```

Also cover completed, failed, cancelled, retry, refresh restoration, malformed
bridge messages, wrong origins, ready, return, and login-required events.

**Step 2: Prove RED**

Run:

```powershell
corepack pnpm tsx scripts/test-paper-host-creation-agent.ts
```

Expected: failure because `creation-agent-model` and `paper-host-bridge` do not
exist. Save the exact failure in the loop log.

**Step 3: Implement the minimum pure model**

`creation-agent-model.ts` exports only typed pure functions:

```ts
export type CreationStatus =
  | 'idle' | 'submitting' | 'running' | 'completed'
  | 'failed' | 'cancelled' | 'reconnecting';

export function createCreationAgentState(
  restored?: Partial<CreationAgentState>,
): CreationAgentState;
export function validateCreationPrompt(prompt: string): PromptValidation;
export function beginCreation(
  state: CreationAgentState,
  input: BeginCreationInput,
): CreationAgentState;
export function applyCreationEvent(
  state: CreationAgentState,
  event: CreationEvent,
): CreationAgentState;
export function retryCreation(state: CreationAgentState): CreationAgentState;
export function cancelCreation(state: CreationAgentState): CreationAgentState;
```

Reject stale events by active request id and, once known, task id. Clamp
progress to 0..100. Keep stable Chinese copy and never expose raw upstream
errors.

**Step 4: Implement the minimum validated bridge**

`paper-host-bridge.ts` exports a discriminated message union, exact-origin
validation, and a post helper. The payload may contain only event type and a
safe return reason; it must reject tokens, cookies, project content, binary
results, caller-supplied owner ids, and malformed objects.

**Step 5: Prove GREEN and quality**

Run:

```powershell
corepack pnpm tsx scripts/test-paper-host-creation-agent.ts
corepack pnpm eslint scripts/test-paper-host-creation-agent.ts src/lib/creation-agent/creation-agent-model.ts src/lib/paper-host-bridge.ts --quiet
corepack pnpm run ts-check
corepack pnpm run qa:architecture-guard
corepack pnpm run qa:spaghetti-growth-guard
```

Expected: all pass; full upstream lint baseline remains separately recorded.

**Step 6: Commit the contract**

```powershell
git add package.json scripts/test-paper-host-creation-agent.ts src/lib/creation-agent/creation-agent-model.ts src/lib/paper-host-bridge.ts
git diff --cached --check
git commit -m "feat(embed): add creation agent state contract"
```

Do not push the external SceneWeave repository without upstream authorization.

---

### Task 2: Focused `/embed/creation-agent` workbench

**Files:**

- Create: `src/app/embed/creation-agent/page.tsx`
- Create: `src/components/creation-agent/creation-agent-shell.tsx`
- Create: `src/components/creation-agent/creation-agent-composer.tsx`
- Create: `src/components/creation-agent/creation-agent-task-stage.tsx`
- Create: `src/components/creation-agent/creation-agent-history.tsx`
- Create: `scripts/qa-paper-host-creation-agent.mjs`

**Step 1: Add a failing route/behavior QA script**

The script must verify executable route behavior, not only source strings:

- `/embed/creation-agent` renders the focused shell;
- root `/` remains the independent SceneWeave product;
- prompt validation creates no request;
- valid submit calls `/api/production/dry-run` once;
- 401 requests login via the validated host bridge and ends loading;
- 503 shows stable Chinese readiness copy and ends loading;
- success renders the returned storyboard/shot count;
- cancel and retry use the existing task endpoints;
- `prefers-reduced-motion` is honored;
- no SceneWeave brand or unrelated main navigation is visible in embed mode.

Run the script before creating the page and observe the missing-route failure.

**Step 2: Implement the focused shell**

- left region: new creation plus owner-scoped recent sessions;
- center: prompt-first empty state, active stage, and result summary;
- composer: prompt, attachment/reference placeholder, model/skill controls,
  and one submit action;
- inspector: current skill/model explanation and task details.

Every visible action either works or has an explicit disabled reason. Do not
copy LibTV assets, private copy, or pixel geometry. Keep each new business file
below 400 lines and retain `prefers-reduced-motion` handling.

**Step 3: Reuse the no-cost task lifecycle**

Call `/api/production/dry-run` through the existing client request surface.
Reuse `/api/tasks`, `/api/tasks/{id}/events`, DELETE, and retry POST; do not add
a second task store. Authentication failure is a stable recoverable state, not
an infinite spinner. Guest owner enablement, if added, must be server-owned and
must pass the existing member-isolation tests before release.

**Step 4: Verify**

```powershell
corepack pnpm run test:paper-host-creation-agent
corepack pnpm node scripts/qa-paper-host-creation-agent.mjs
corepack pnpm eslint src/app/embed/creation-agent/page.tsx src/components/creation-agent/*.tsx --quiet
corepack pnpm run ts-check
corepack pnpm run test:member-task-isolation
corepack pnpm run test:cross-app-auth-contract
corepack pnpm run qa:architecture-guard
corepack pnpm run qa:spaghetti-growth-guard
corepack pnpm run build
```

Start a local production server and rerun `qa:entrypoint-routes`; the earlier
`fetch failed` without a server is not acceptance evidence.

**Step 5: Commit locally**

```powershell
git add src/app/embed/creation-agent src/components/creation-agent scripts/qa-paper-host-creation-agent.mjs
git diff --cached --check
git commit -m "feat(embed): add paper host creation workbench"
```

---

### Task 3: paper-web “科研 / 科教” navigation and host route

**Files:**

- Modify: `src/common/agentShellNavigation.js`
- Modify: `src/router/modules/researchAgent.js`
- Modify: `src/components/common/ProductSideNav.vue`
- Modify: `src/components/common/comHead.vue`
- Create: `src/pages/researchAgent/creation.vue`
- Extend: `test/unit/specs/agentShellNavigation.spec.js`
- Create: `test/unit/specs/sceneWeaveHost.spec.js`

**Step 1: Add failing navigation tests**

Tests must prove:

- `智能体` exposes two children in stable order;
- `科研` stays `/research-agent`;
- `科教` is `/research-agent/creation`;
- active child and keyboard navigation are unambiguous;
- SceneWeave has its own runtime URL key and never overwrites KnowTrail's;
- workspace key is an opaque correlation hint, not an owner id;
- ready, return, and login-required bridge messages require the exact origin.

Run the focused Jest tests and observe the missing second child/route failure.

**Step 2: Implement the smallest host integration**

Reuse the existing KnowTrail iframe host patterns, access model, loading/error
card, return route, bridge, and guest browser-session isolation. Keep a
separate SceneWeave embed URL builder. Do not copy SceneWeave code into Vue.

**Step 3: Run paper-web gates**

```powershell
npm run test:unit -- --runInBand test/unit/specs/agentShellNavigation.spec.js test/unit/specs/sceneWeaveHost.spec.js
npm run lint:added
npm run lint:hygiene
npm run lint:test
npm run test:unit -- --runInBand
npm run build:prod
git diff --check
git diff --cached --check
```

Run the existing secret/debug scan and confirm no endpoint, token, credential,
personal contact, screenshot, or generated artifact enters the repository.

**Step 4: Commit and push Research**

```powershell
git add src test
git diff --cached --check
git commit -m "feat(agent): add science education creation workspace"
git push origin research/platform-upgrade
git rev-list --left-right --count HEAD...origin/research/platform-upgrade
```

Expected: `0 0`. Do not merge or rebase.

---

### Task 4: Independent release and formal-domain acceptance

**SceneWeave release acceptance:**

- clean commit and clean production artifact;
- timestamped release and manifest `dirty=false`;
- standby service on loopback only;
- `/embed/creation-agent` renders without brand/marketing nav;
- no-cost dry-run reaches a terminal result or a bounded login/readiness state;
- cancel, retry, refresh recovery, console, overflow, and return work;
- failed candidate is isolated and current remains unchanged.

**paper-web release acceptance:**

- publish only after SceneWeave standby is green;
- timestamped release, atomic current/previous switch, and `nginx -t`;
- formal-domain 1440px navigation from `智能体` to both `科研` and `科教`;
- KnowTrail guest/new-notebook/source behavior remains intact;
- SceneWeave iframe origin, bridge, loading/error/retry, and return are real;
- console errors and horizontal overflow are zero.

After both switches, verify service ports, Nginx, `/health`, `/ready`, DB,
timer, disk, current/previous, and rollback commands. Delete only failed or
superseded candidates that are neither current nor previous.

No paid generation is needed to close this slice.
