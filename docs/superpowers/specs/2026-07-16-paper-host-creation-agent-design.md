# Paper Host Creation Agent Design

## Goal

Add SceneWeave to the UCAS science-and-education platform as the embedded
“科教” creation agent while keeping the existing KnowTrail “科研” agent intact.
The integration must remain easy to sync with `laby-ai/sceneweave`, expose only
the creation workbench in embedded mode, and reuse SceneWeave's existing task,
storyboard, media, provider, cancellation, retry, and recovery contracts.

This design covers the first independently releasable slice:

1. an upstream-friendly SceneWeave embedded creation workbench;
2. a paper-web “科研 / 科教” navigation choice;
3. trusted host context, account or guest isolation, and return behavior;
4. fixture-backed task lifecycle and no-cost release verification.

Deeper skill expansion and model-provider enablement are later slices. They
must build on this shell rather than enlarge the host adapter.

## Verified baselines

- SceneWeave remote: `https://github.com/laby-ai/sceneweave.git`
- SceneWeave default branch at design time:
  `codex/sync-huiying-prod-20260629`
- SceneWeave baseline commit: `1ec64f8ce96ef56833434efa90bfb43f15304d1e`
- paper-web branch: `research/platform-upgrade`
- paper-web baseline commit: `4f66b028`
- Official LibTV skill contract reference:
  `https://github.com/libtv-labs/libtv-skills`

The LibTV product is a behavioral reference for a prompt-first creation agent,
project history, attachments, model and skill choice, visible task progress,
and recoverable results. It is not a source for proprietary code, private
project data, brand assets, or pixel-for-pixel copying.

## Considered approaches

### A. Independent SceneWeave service plus narrow iframe host adapter

This is the selected approach. SceneWeave keeps its own repository, build,
release, routes, and task system. paper-web only owns navigation, trusted embed
context, the iframe lifecycle, and the route back to the platform.

Benefits:

- upstream changes stay reviewable and mergeable;
- SceneWeave can run and be contributed to independently;
- paper-web cannot accidentally absorb provider or task implementation;
- each service has its own rollback boundary.

### B. Copy SceneWeave components into paper-web

Rejected because it creates two implementations of the same workbench, makes
upstream sync expensive, and couples Vue 2 host code to React 19 application
internals.

### C. Rebuild a LibTV-like agent directly in paper-web

Rejected because it duplicates SceneWeave's task, storyboard, media, provider,
and recovery layers and would make visual imitation more important than a
working production chain.

## Repository and dependency boundaries

```text
paper-web Vue host
  -> iframe URL + trusted bridge + return route
    -> SceneWeave /embed/creation-agent
      -> focused creation-agent client model and components
        -> existing client-api and TaskContext
          -> existing SceneWeave API routes
            -> trusted account/guest owner
            -> task lifecycle and member stores
            -> provider, storyboard, media and compose services
```

The dependency direction is one way. paper-web must not import SceneWeave
source. SceneWeave client code must not import server task managers, provider
secrets, billing implementations, or paper-web source.

## SceneWeave embedded route

Create `src/app/embed/creation-agent/page.tsx` as the dedicated embedded entry.
It renders a focused workbench and never renders the marketing home, full
SceneWeave navigation, research page, settings page, or SceneWeave brand.
The independent root application remains unchanged and keeps its own identity.

The route accepts presentation hints only:

- `embed=paper-host`
- `workspaceKey=<opaque browser-session key>`
- `returnPath=/research-agent/creation`
- `hostBridge=postMessage`

Query parameters are never authorization. Server APIs continue to derive the
owner from a trusted account session. Anonymous use must receive a server-owned
opaque guest session before any task or asset is created. A caller-supplied
tenant, member, owner, or account identifier is ignored.

The embedded route is split into focused owners:

- `creation-agent-shell.tsx`: three-region layout and responsive presentation;
- `creation-agent-composer.tsx`: prompt, attachment, model, skill, and submit
  controls;
- `creation-agent-task-stage.tsx`: task stage, progress, cancel, retry, result,
  and refresh recovery;
- `creation-agent-history.tsx`: current owner-scoped projects and sessions;
- `creation-agent-model.ts`: pure view-state transitions and stable error copy;
- `paper-host-bridge.ts`: validated host messages and return navigation.

No new file may become a second provider client or task store. New focused
business files should stay below 400 lines.

## Workbench interaction design

The embedded page uses a dark, restrained creation surface without copying
LibTV assets or branding:

- left: compact new-session action and recent project/session history;
- center: prompt-first empty state, active task stages, and generated results;
- composer: attachments, reference subject, model, skill, generation mode,
  and a single submit action;
- right or collapsible inspector: selected skill/model description, task
  details, and result metadata.

The initial release exposes existing SceneWeave capabilities only. Model and
skill choices are populated from SceneWeave-owned configuration or a static
no-cost fixture; unavailable choices are visibly disabled with a reason. Every
visible action either performs a real action or explains why it is unavailable.

Motion is limited to state communication: panel transitions, active focus,
task-stage progress, result arrival, and hover affordances. It respects
`prefers-reduced-motion` and does not add decorative continuous animation.

## Task and event flow

1. The user enters a prompt and optional attachments/reference subject.
2. The composer validates locally and sends one existing SceneWeave creation
   request through `clientApiFetch`.
3. The server creates an owner-scoped task and returns its task identifier.
4. The client follows `GET /api/tasks/{taskId}/events`.
5. If SSE is unavailable, the client falls back to
   `GET /api/tasks/{taskId}` using the server-provided cadence.
6. Running tasks display stage, message, progress, and waiting guidance.
7. Cancellation uses `DELETE /api/tasks/{taskId}`.
8. Retry uses `POST /api/tasks/{taskId}` with `{ "action": "retry" }`.
9. A refresh restores the current owner-scoped task/session and completed
   result from the existing task service.
10. Downloads use existing result URLs or SceneWeave download handlers; the
    host never proxies generated binary data through postMessage.

Stale events are discarded by task identifier and attempt/retry identity. A
cancelled or superseded task cannot overwrite the currently selected task.

The public LibTV session/project/upload/event/progress/download contract is a
compatibility reference for naming and future skill adapters. The first release
does not call LibTV APIs and does not require a LibTV account.

## Host integration

paper-web adds a sibling route `/research-agent/creation`. Existing
`/research-agent` continues to mean KnowTrail “科研”. The top navigation and
`ProductSideNav` expose one “智能体” parent with two children:

- `科研` -> `/research-agent`
- `科教` -> `/research-agent/creation`

Keyboard users can expand the parent, move between both choices, activate one,
and collapse the menu. The active child is unambiguous. Mobile navigation is
not redesigned in this slice; it must remain functional and show both labels
without horizontal regression.

The creation host page reuses paper-web's existing embed URL builder, iframe
bridge, account notice, guest workspace key, and login/return behavior. It adds
a separate runtime key for the SceneWeave embed URL and does not modify the
KnowTrail runtime key.

Allowed postMessage events are minimal:

- SceneWeave -> host: `paper-host-ready`, `paper-host-return`,
  `paper-host-login-required`;
- host -> SceneWeave: validated readiness acknowledgement and account/session
  refresh notification.

Every event checks the exact iframe origin and schema. Tokens, cookies, private
project content, generated binaries, and provider credentials never cross the
bridge.

## Identity and guest isolation

- Logged-in users use the existing trusted account cookie or bearer session.
- Guest visitors receive an opaque, server-owned guest session scoped to the
  browser session and SceneWeave service.
- The paper-web `workspaceKey` is only a correlation hint; it cannot select
  another member or guest owner.
- Task, project, subject, asset, and result reads are filtered by the trusted
  owner. Cross-owner reads return not-found behavior.
- Guest data has a bounded retention policy and is not promoted into an account
  without an explicit migration contract.

The integration must not weaken the existing
`test:member-task-isolation` or cross-app auth gates.

## Error and readiness behavior

- Invalid prompt or missing required input: inline validation, no task created.
- Provider unavailable: stable Chinese readiness message, no infinite loading,
  no raw upstream error, and no automatic repeated submission.
- Network/SSE interruption: visible reconnecting state and bounded polling
  fallback.
- Task failure: preserved stage and recoverable result metadata, with retry only
  when the existing task contract allows it.
- Cancellation: terminal cancelled state; late events are ignored.
- Host or iframe unavailable: paper-web shows a retryable error card and a
  working return path.
- Unauthorized expensive action: server rejects before provider invocation;
  SceneWeave requests host login through the validated bridge.

## Cost and privacy rules

- Automated checks use fixtures, dry-run routes, task probes, and readiness.
- Opening the authenticated LibTV page is read-only. No prompt is submitted and
  no private project, cookie, token, or account data is copied.
- No paid image or video task is executed without a separate explicit user
  authorization for that exact bounded test.
- Logs, screenshots, reports, commits, and release manifests contain no secret,
  personal contact information, private source content, or provider request
  payloads.

## Test and release acceptance

### SceneWeave automated acceptance

- route contract proves `/embed/creation-agent` renders the focused shell and
  root `/` remains the full independent product;
- pure model tests cover validation, pending/running/completed/failed/cancelled,
  retry, stale event rejection, and refresh restoration;
- host bridge tests reject wrong origin and malformed messages;
- guest/account owner tests prove cross-owner task and asset isolation;
- fixture task proves SSE progress, cancellation, retry, polling fallback, and
  result restoration without provider cost;
- `pnpm run validate`, focused QA gates, production build, Linux package,
  architecture guard, spaghetti-growth guard, diff, secret, and debug scans pass.

### paper-web automated acceptance

- navigation model tests cover the parent, both children, keyboard behavior,
  active state, and exact routes;
- router tests cover `/research-agent/creation` without changing KnowTrail;
- embed URL tests cover the separate SceneWeave runtime key and opaque guest
  workspace;
- bridge tests cover allowed events, origin checks, return, and login-required;
- full `lint:added`, `lint:hygiene`, `lint:test`, unit, and Node 20 production
  build pass.

### Formal-domain acceptance

At `http://ucas.sitianai.com/` in a 1440px desktop browser:

- “智能体” exposes “科研” and “科教” and both are keyboard operable;
- “科研” still opens the existing KnowTrail workspace;
- “科教” directly opens the embedded SceneWeave workbench with no marketing
  splash or SceneWeave brand;
- prompt, attachment, model, and skill controls are visible and understandable;
- a no-cost fixture task progresses, cancels, retries, and survives refresh;
- return navigation works; console errors and horizontal overflow are zero;
- provider-unavailable state is explicit and does not invoke a model;
- current/previous releases, health, readiness, DB, timer, Nginx, and service
  ownership remain verifiable and rollback-safe.

SceneWeave and paper-web are released independently. Each candidate is built
from a clean commit, installed as a timestamped release, checked in standby,
and activated by an atomic symlink. A failed service candidate is rolled back
without changing the other service.

## Non-goals for this slice

- pixel-for-pixel replication of LibTV;
- copying LibTV code, assets, prompts, private projects, or proprietary models;
- enabling or testing paid models;
- replacing KnowTrail or merging both agents into one runtime;
- rewriting SceneWeave's full home, film, canvas, settings, or task center;
- adding a second task store, provider abstraction, or account system;
- merging paper-web Research into `liyuyang` or `master`.

## Follow-on slices

After this release is stable, separate specs may add:

1. a LibTV-compatible skill adapter over the public session/project/event
   contract;
2. education-specific skills for lesson scripts, teaching storyboards, lecture
   clips, and reference-grounded visual explanations;
3. bounded real-provider qualification with explicit cost authorization;
4. upstream pull-request packaging after the local commits are independently
   reviewable and the repository owner authorizes publication.
