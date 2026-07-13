# StoneAI platform repositories

SceneWeave is an independent public product repository. Shared platform code is
owned outside this repository:

| Responsibility | Repository |
| --- | --- |
| Account administration frontend | `laby-ai/stoneai-admin-web` |
| Website and Studio web shell | `laby-ai/stoneai-studio-web` |
| Python AI services and integration tools | `laby-ai/stoneai-ai-python` |
| Account, authorization and billing backend | `laby-ai/stoneai-admin-backend` |

SceneWeave retains ownership of the Huiying conversation-to-script flow, Film
state machine, canvas, media and subject libraries, provider tasks, Vimax gates
and final composition. It consumes shared authentication, entitlement and
billing contracts. The four Gitee projects remain read-only engineering
references; no source is copied into SceneWeave.
