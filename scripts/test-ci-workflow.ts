import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = resolve(process.cwd(), ".github/workflows/ci.yml");
const workflow = readFileSync(workflowPath, "utf8");

const requiredSnippets = [
  "pull_request:",
  "codex/sync-huiying-prod-20260629",
  "permissions:",
  "contents: read",
  "timeout-minutes: 20",
  "cancel-in-progress: true",
  "node-version: 20",
  "corepack prepare pnpm@10.28.1 --activate",
  "pnpm install --frozen-lockfile",
  "pnpm run test:ci-workflow",
  "pnpm run qa:architecture-guard",
  "pnpm run qa:spaghetti-growth-guard",
  "pnpm run ts-check",
  "pnpm run test:cross-app-auth-contract",
  "pnpm run test:member-subject-library",
  "pnpm run test:member-final-video-store",
  "pnpm run test:film-mobile-workspace",
  "pnpm run test:film-mobile-viewport",
  "pnpm run qa:smart-vimax-agent-render",
 "pnpm run test:vimax-reference-phase",
  "pnpm run test:segment-first-frame-fallback",
  "pnpm run test:film-compose-durability",
  "pnpm run test:film-compose-client",
  "pnpm run test:film-media-preview",
  "pnpm run test:media-library-preview-fastpath",
  "pnpm run test:home-gallery-freshness",
  "pnpm run test:release-promotion-contract",
  "bash -n deploy/linux/promote-release.sh",
  "NEXT_PUBLIC_BASE_PATH: /huiying",
  "pnpm next build",
  "pnpm tsup src/server.ts",
];

for (const snippet of requiredSnippets) {
  assert.ok(workflow.includes(snippet), `CI workflow must include: ${snippet}`);
}

assert.ok(!workflow.includes("secrets."), "deterministic CI must not read repository secrets");
assert.ok(!workflow.includes("qa:real-"), "deterministic CI must not call paid provider smoke tests");

console.log("CI workflow contract passed");
