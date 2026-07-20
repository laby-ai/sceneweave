# Paper Host Luminous Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the existing light education creation workspace a distinctive production-studio hierarchy without changing any task or API behavior.

**Architecture:** Keep the three existing React components and their props. Add a visual contract marker to the shell, reuse the repository-owned workflow image as a decorative idle-stage asset, and strengthen the existing cards/composer with stage accents and reduced-motion-safe transitions.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 4, lucide-react, Node test runner.

## Global Constraints

- No API, SSE, retry, guest owner, reference upload, or storage changes.
- Use `public/home/huiying-workflow-canvas.png`; do not copy LibTV assets.
- Keep all controls keyboard reachable and preserve reduced-motion behavior.
- Validate only with no-cost dry-run tasks.

---

### Task 1: Visual contract and luminous idle stage

**Files:**
- Modify: `scripts/test-paper-host-creation-agent.ts`
- Modify: `src/components/creation-agent/creation-agent-shell.tsx`
- Modify: `src/components/creation-agent/creation-agent-task-stage.tsx`

**Interfaces:**
- Consumes: existing `CreationAgentState` and current component props.
- Produces: `data-paper-host-visual="luminous-workbench"` and decorative workflow asset markup.

- [ ] **Step 1: Write the failing contract assertions**

```ts
assert.match(html, /data-paper-host-visual="luminous-workbench"/);
assert.match(html, /huiying-workflow-canvas\.png/);
assert.match(html, /灵感输入/);
assert.match(html, /制作规划/);
assert.match(html, /分镜交付/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test:paper-host-creation-agent`

Expected: fail because the new visual marker and production path are absent.

- [ ] **Step 3: Implement the minimal visual layer**

Add the shell marker, place `/home/huiying-workflow-canvas.png` behind the idle hero with `aria-hidden`, and render three connected production steps. Preserve the current task state branches and callbacks.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm test:paper-host-creation-agent`

Expected: `paper host creation agent contract: ok`.

### Task 2: Surface hierarchy and release verification

**Files:**
- Modify: `src/components/creation-agent/creation-agent-composer.tsx`
- Modify: `src/components/creation-agent/creation-agent-history.tsx`
- Modify: `src/components/creation-agent/creation-agent-shell.tsx`

**Interfaces:**
- Consumes: all existing component props unchanged.
- Produces: stronger composer focus, richer history surface, and numbered context rail.

- [ ] **Step 1: Implement surface styling without behavior changes**

Use light blue/violet accents, layered borders, restrained shadows, real lucide icons, `motion-safe` transitions and `motion-reduce` fallbacks. Keep every form control and handler unchanged.

- [ ] **Step 2: Run the full local gate**

Run focused creation-agent, guest task event, dry-run, reference image and member-isolation contracts; then targeted ESLint, `pnpm ts-check`, architecture/spaghetti guards, `git diff --check`, secret/debug scans and `NEXT_PUBLIC_BASE_PATH=/sceneweave pnpm build`.

Expected: all changed-file gates pass; no new secret or debug hits.

- [ ] **Step 3: Commit and publish through the existing reversible release path**

Commit message: `style(embed): add luminous creation workbench`

Use a clean manifest, standby port 5199, no-cost task/SSE fixture, atomic `current`/`previous` symlink switch and rollback trap.

- [ ] **Step 4: Validate the formal domain**

At 1440px verify the idle stage, submit one no-cost task, refresh the completed task, confirm console errors are zero and both parent/iframe `scrollWidth === clientWidth`.
