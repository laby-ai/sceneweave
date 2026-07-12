# Architecture Ownership

This map defines the maintenance boundaries for the current Huiying single-service deployment. Large-file budgets freeze known debt; they do not claim every legacy hotspot is already decomposed.

## Dependency direction

```text
page and panels
  -> client request and workflow hooks
    -> API route shells
      -> account scope and billing admission
      -> task lifecycle and member stores
      -> provider clients and compose services
```

Client modules must not import server task managers, provider credentials, billing, or storage implementations. Production services must not import routes or React components.

## Owners

| Boundary | Owner files | Responsibilities | Must not own |
| --- | --- | --- | --- |
| Account/session | `src/lib/account`, account API routes | Trusted tenant/member session, logout and account errors | Client identity overrides |
| Browser requests | `src/lib/client-api.ts` | Base path, Cookie/Bearer, timeout, cancellation and typed HTTP errors | Product-specific workflows |
| Film planning | `useFilmPlanCreation`, script/transition contracts | Prompt-to-script, direct transition to visual stage, recoverable errors | Video provider or compose execution |
| Film orchestration UI | `film-creation-panel.tsx`, focused Film hooks/components | User state, phase selection, progress, cancel/retry and history | Raw compose SSE parsing or server task persistence |
| Compose browser client | `src/lib/film-compose-client.ts`, `film-compose-stream.ts` | Durable compose request, JSON/SSE result parsing and progress | React state, account billing, task manager, provider SDK |
| Compose server | `/api/film/compose`, compose provider/readiness/final-video services | Owner-scoped durable output, provider/local fallback and stable errors | UI history or browser state |
| Generation tasks | `task-manager`, long-task admission, task APIs | Idempotency, state transitions, member isolation and restart recovery | UI or provider-specific policy |
| Providers | BYOK/native provider adapters and operational observation | Explicit provider submit/status, safe task/provider events | Session trust or component state |
| Canvas | `src/icanvas`, canvas store/agent clients | Project open/recovery, node text/edges and persistence | Film compose or account secrets |
| Media/subjects | media library, subject store and private media routes | Tenant/member-scoped assets, previews, subject reuse | Global task-list shortcuts |
| Vimax | smart Vimax route/components and QA gate | Existing Vimax agent behavior | Unreviewed Film/compose coupling |

## Enforced gates

- `qa:architecture-guard` enforces server/client dependency direction and the compose owner boundary.
- `qa:spaghetti-growth-guard` freezes known large components/routes and prevents legacy provider references from increasing. A budget increase requires explicit review and must not be used to hide new logic.
- `test:film-compose-client` covers single/multi-shot results, progress, durable request, stable errors and empty input.
- Vimax QA, compose durability, member final-video/subject/task isolation, TypeScript and production build remain release gates.

## Known frozen debt

The largest current hotspots are `film-creation-panel.tsx`, `smart/vimax-agent-step`, `film/compose`, `assets/media-library`, `video/nine-grid` and `storyboard/submit`. New behavior must move to a focused owner. Refactor a hotspot only with characterization coverage; do not split files mechanically.
