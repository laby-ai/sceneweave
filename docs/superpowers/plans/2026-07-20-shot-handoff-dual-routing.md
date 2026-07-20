# Contextual Shot Handoff Dual Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Kimi express a per-shot continuity intent while the existing SceneWeave server authoritatively routes each shot to HappyHorse first-frame I2V or multi-reference R2V and persists that decision across retries.

**Architecture:** Extend the existing ViMAX plan and assembly segment contracts with a narrow semantic handoff field and a server-resolved route. Keep Kimi away from provider/model identifiers, map its semantic intent through a pure whitelist resolver, and reuse the existing segment task, BYOK provider, SSE, assembly, and export chain. Add a small HappyHorse I2V request adapter beside the existing R2V adapter.

**Tech Stack:** TypeScript 5, Next.js 16 route handlers, existing task/assembly persistence, `tsx` QA scripts, pnpm.

## Global Constraints

- Do not call a real image or video provider in tests.
- Do not add a second runtime, task center, media store, download route, or generic Skill executor.
- Preserve existing R2V, task recovery, guest/workspace isolation, cost confirmation, and last-successful-result behavior.
- Kimi may return only semantic intent; provider and model identifiers remain server-authoritative.
- Historical tasks without a per-shot route retain the existing configured-model behavior.
- HappyHorse I2V requires exactly one `first_frame`; HappyHorse R2V accepts only `reference_image` entries.

---

### Task 1: Planner intent and server-authoritative route contract

**Files:**
- Create: `src/lib/skills/vimax-short-drama/vimax-shot-generation-route.ts`
- Modify: `src/lib/skills/vimax-short-drama/vimax-agent-contract.ts`
- Modify: `src/app/api/smart/vimax-agent-step/route.ts`
- Modify: `src/lib/skills/vimax-short-drama/vimax-plan-artifacts.ts`
- Modify: `src/lib/production-assembly-plan.ts`
- Test: `scripts/qa-vimax-shot-generation-route.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `VimaxShotHandoffIntent`, `VimaxShotGenerationRoute`, `resolveVimaxShotGenerationRoutes(plan, provider, configuredModel)`.
- Persists: `VimaxAgentPlan.shots[].handoffIntent` and `ProductionSegmentPlan.generationRoute`.

- [ ] **Step 1: Write the failing route-contract test**

Create a no-network test with a three-shot plan. Assert that shot 1 resolves to `multi-reference`, shot 2 with `strict-frame` resolves to `happyhorse-1.1-i2v`, and shot 3 with `reference-flexible` resolves to `happyhorse-1.1-r2v`. Assert that no client-supplied model field exists in the planner contract and that JSON round-tripping preserves each segment route.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm tsx scripts/qa-vimax-shot-generation-route.ts`

Expected: FAIL because `vimax-shot-generation-route.ts` and the persisted route fields do not exist.

- [ ] **Step 3: Add the minimal semantic and resolved route types**

```ts
export type VimaxShotHandoffIntent = 'strict-frame' | 'reference-flexible';

export interface VimaxShotGenerationRoute {
  mode: 'first-frame' | 'multi-reference';
  requestedBy: 'planner' | 'server-default';
  reason: string;
  model: string;
  requiresPreviousLastFrame: boolean;
  referenceRoles: Array<'subject' | 'scene' | 'prop' | 'previous-tail'>;
}
```

The resolver must ignore arbitrary client/provider/model fields, use the server provider and configured model, and support only the HappyHorse 1.1 I2V/R2V pair for dual routing. The first shot always resolves to multi-reference because no previous tail exists.

- [ ] **Step 4: Extend Kimi's schema and normalize only allowed values**

Add `handoffIntent`, `handoffReason`, and `continuityPriorities` to the shot schema. Normalize the intent to the two allowed values, clamp priorities to `action`, `screen-direction`, `subject`, `scene`, and `prop`, and default missing later shots through the server resolver.

- [ ] **Step 5: Attach resolved routes to the existing assembly plan**

After `buildProductionBackedVimaxPlan` returns and the server knows the video provider/model, resolve the routes and attach one route to each existing `assemblyPlan.segments[index]`. Preserve them through `buildVimaxAgentPlanFromProductionArtifacts` and existing task persistence.

- [ ] **Step 6: Run the route-contract test and verify GREEN**

Run: `pnpm tsx scripts/qa-vimax-shot-generation-route.ts`

Expected: PASS with `providerCalls: 0` and persisted models `happyhorse-1.1-r2v`, `happyhorse-1.1-i2v`, `happyhorse-1.1-r2v`.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/qa-vimax-shot-generation-route.ts src/app/api/smart/vimax-agent-step/route.ts src/lib/production-assembly-plan.ts src/lib/skills/vimax-short-drama/vimax-agent-contract.ts src/lib/skills/vimax-short-drama/vimax-plan-artifacts.ts src/lib/skills/vimax-short-drama/vimax-shot-generation-route.ts
git commit -m "feat(creation): persist contextual shot routes"
```

### Task 2: HappyHorse first-frame I2V adapter

**Files:**
- Create: `src/lib/happyhorse-i2v-adapter.ts`
- Modify: `src/lib/byok-provider.ts`
- Modify: `src/lib/skills/vimax-short-drama/vimax-continuity-contract.ts`
- Modify: `scripts/qa-happyhorse-video-provider.ts`

**Interfaces:**
- Produces: `isHappyHorseI2VModel(model)` and `buildHappyHorseI2VSubmitRequest(options)`.
- Consumes: existing HappyHorse URL/header/resolution helpers and `BYOKVideoParams.firstFrameImage`.

- [ ] **Step 1: Extend the HappyHorse provider QA with I2V assertions**

Assert that `happyhorse-1.1-i2v` submits exactly one media item `{ type: 'first_frame', url }`, rejects missing first frame, rejects `referenceImages` and `lastFrameImage`, and resolves as a first-frame handoff capability. Keep `globalThis.fetch` mocked.

- [ ] **Step 2: Run the provider QA and verify RED**

Run: `pnpm qa:happyhorse-video-provider`

Expected: FAIL because I2V is rejected as a T2V request with media.

- [ ] **Step 3: Implement the request adapter and dispatch**

Build the same asynchronous HappyHorse endpoint/headers as the T2V/R2V adapters, with body:

```ts
{
  model: 'happyhorse-1.1-i2v',
  input: { prompt, media: [{ type: 'first_frame', url: firstFrameImage }] },
  parameters: { resolution, duration, watermark, seed }
}
```

Update `submitVideoWithBYOK` to dispatch I2V before the T2V rejection branch. Reject any extra media rather than silently ignoring it.

- [ ] **Step 4: Recognize HappyHorse I2V as first-frame handoff**

Update `resolveVimaxProviderHandoffMode` so `happyhorse-1.1-i2v` has `mode='frame-handoff'`, `supportsFirstFrame=true`, and `supportsReferenceImages=false`.

- [ ] **Step 5: Run the provider QA and verify GREEN**

Run: `pnpm qa:happyhorse-video-provider`

Expected: PASS, `usedRealKey=false`, `incurredCost=false`, with both I2V and R2V dispatch checks.

- [ ] **Step 6: Commit**

```bash
git add scripts/qa-happyhorse-video-provider.ts src/lib/byok-provider.ts src/lib/happyhorse-i2v-adapter.ts src/lib/skills/vimax-short-drama/vimax-continuity-contract.ts
git commit -m "feat(creation): add happyhorse first-frame adapter"
```

### Task 3: Execute each segment with its persisted route

**Files:**
- Modify: `src/lib/production-segment-start.ts`
- Modify: `src/lib/skills/vimax-short-drama/vimax-production-video-orchestrator.ts`
- Create: `scripts/test-vimax-dual-route-full-chain.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ProductionSegmentPlan.generationRoute` and existing `buildProductionSegmentStartPayload`.
- Produces: provider requests that exactly match the persisted route; strict boundaries bypass paid transition bridges.

- [ ] **Step 1: Write the full-chain fixture RED**

Create a three-shot guest fixture with routes R2V → I2V → R2V. Mock provider create/poll/download calls. Assert the request bodies are respectively `reference_image`, one `first_frame`, and `reference_image`; assert only the flexible boundary may use the existing bridge path; assert task/result persistence retains the selected model and route after task-store reload.

- [ ] **Step 2: Run the fixture and verify RED**

Run: `pnpm test:vimax-dual-route-full-chain`

Expected: FAIL because every segment currently uses the globally configured R2V model and the orchestrator creates every boundary bridge.

- [ ] **Step 3: Use the persisted segment route at submit time**

In `runSegmentProviderJob`, resolve the effective model from `segment.generationRoute?.model` before the task config fallback. For `first-frame`, pass only the existing `startPayload.firstFrameImage`; for `multi-reference`, use the current approved reference manifest. Missing strict first frame must fail before `fetch`.

- [ ] **Step 4: Do not create a transition bridge for a strict next shot**

In the existing orchestrator loop, inspect `latestPlan.segments[index + 1].generationRoute`. If it is `first-frame`, continue directly to the next segment because the completed segment tail is already persisted into its first-frame input. Keep current bridge behavior for historical and multi-reference segments.

- [ ] **Step 5: Run the full-chain fixture and verify GREEN**

Run: `pnpm test:vimax-dual-route-full-chain`

Expected: PASS with zero real provider calls, stable guest ownership, persisted per-shot routes, and no strict-boundary bridge task.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/test-vimax-dual-route-full-chain.ts src/lib/production-segment-start.ts src/lib/skills/vimax-short-drama/vimax-production-video-orchestrator.ts
git commit -m "feat(creation): execute persisted shot routes"
```

### Task 4: Regression gates and release decision

**Files:**
- Modify only if a real regression is reproduced in the files above.

**Interfaces:**
- Verifies: planner contract, provider adapter, segment orchestration, historical R2V route, TypeScript, lint, architecture, and production build.

- [ ] **Step 1: Run focused and existing route tests**

```bash
pnpm qa:happyhorse-video-provider
pnpm test:vimax-dual-route-full-chain
pnpm test:vimax-r2v-full-route
pnpm qa:segment-start-service
pnpm qa:segment-retry-service
```

Expected: all PASS with mocked providers and no real credentials.

- [ ] **Step 2: Run static gates**

```bash
pnpm eslint src/app/api/smart/vimax-agent-step/route.ts src/lib/byok-provider.ts src/lib/happyhorse-i2v-adapter.ts src/lib/production-assembly-plan.ts src/lib/production-segment-start.ts src/lib/skills/vimax-short-drama/vimax-agent-contract.ts src/lib/skills/vimax-short-drama/vimax-plan-artifacts.ts src/lib/skills/vimax-short-drama/vimax-shot-generation-route.ts src/lib/skills/vimax-short-drama/vimax-continuity-contract.ts src/lib/skills/vimax-short-drama/vimax-production-video-orchestrator.ts scripts/qa-vimax-shot-generation-route.ts scripts/test-vimax-dual-route-full-chain.ts
pnpm ts-check
pnpm qa:architecture-guard
pnpm qa:spaghetti-growth
```

Expected: all PASS.

- [ ] **Step 3: Run the production build**

Run: `$env:NEXT_PUBLIC_BASE_PATH='/sceneweave'; pnpm build`

Expected: Next.js and server bundles complete successfully.

- [ ] **Step 4: Review diff and secrets**

Run: `git diff --check; git status --short; git diff --stat HEAD~3..HEAD` and scan changed files for keys, tokens, provider URLs with credentials, debug logging, and external project names in user-visible strings.

Expected: only scoped source/tests/docs are changed; `outputs/` remains untracked and unstaged; no credential or paid call exists.

- [ ] **Step 5: Deploy only after all gates pass**

Use the existing isolated standby and atomic release process. Verify the formal 1440px workspace shows Chinese route semantics, retains project/guest isolation, and makes zero provider calls during no-cost verification. Do not run a real I2V/R2V comparison unless the user separately authorizes that paid generation.
