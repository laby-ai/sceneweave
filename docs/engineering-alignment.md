# Engineering alignment

## Repository responsibility

SceneWeave owns the Huiying conversation-to-script workflow, Film state
machine, canvas, media/subject libraries, provider adapters, durable tasks,
Vimax gates, composition and private final-video delivery. It consumes the
shared account/billing service and must not duplicate identity or wallet logic.

## Four-domain map

| Domain | Repository |
| --- | --- |
| Website | `laby-ai/stoneai-official` |
| Account and billing | `laby-ai/account-entitlement` |
| Lingbi / KnowTrail | `laby-ai/knowtrail` |
| Huiying / SceneWeave | `laby-ai/sceneweave` |

## Gitee reference mapping

- `zhiqi-studio-web`: shared request handling, auth propagation, timeout,
  streaming and media/download errors.
- `zhiqi-admin-vue3`: permission-aware controls and stable 401/403/500 UX.
- `zhiqi-ai-python`: health, JSON logs, metrics, worker admission and heavy-task
  resource isolation.
- `zhiqi-admin-backend`: stable API envelopes, RBAC boundaries, idempotency and
  durable task polling/state transitions.

The Gitee repositories remain read-only. Their code is not vendored or copied;
observable engineering contracts are adopted in the existing TypeScript stack.

## Required gates

Use `pnpm@9.0.0`. Run TypeScript, touched-file lint, architecture/growth gates,
Vimax 14/14, member-isolation contracts, no-cost final-video E2E and the
desktop/mobile user journey relevant to the change. Paid provider calls require
explicit authorization. Releases must pass strict standby health and atomic
current/previous promotion from a merged Git commit.
