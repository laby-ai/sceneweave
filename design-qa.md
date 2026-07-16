# Design QA: embedded AIGC home and result flow

## Evidence

- Structural reference: `C:/Users/16571/AppData/Local/Temp/codex-clipboard-ac4c2d21-ffde-4128-a1fd-a9cfd4d45e22.png` (LibTV Agent home)
- Visual-language reference: `C:/Users/16571/AppData/Local/Temp/codex-clipboard-f9e41949-dff6-42bd-a31c-79c8891f989d.png` (JiMeng light workspace)
- Result-stream reference: `C:/Users/16571/AppData/Local/Temp/codex-clipboard-82e6f44b-c498-445d-b296-2e1b469169dd.png` (JiMeng light result grid)
- Result-stage reference: `C:/Users/16571/AppData/Local/Temp/codex-clipboard-69302f57-4f5a-47ef-b79a-f41a4915a116.png` (JiMeng conversational production stage)
- Implementation capture: `C:/Users/16571/Documents/Codex/2026-07-10/ssh-root-123-56-218-60/outputs/sceneweave-aigc-home-1440-20260716.png`
- Result-flow capture: `C:/Users/16571/Documents/Codex/2026-07-10/ssh-root-123-56-218-60/outputs/sceneweave-result-flow-1440-20260716.png`
- Combined comparison: `C:/Users/16571/Documents/Codex/2026-07-10/ssh-root-123-56-218-60/outputs/sceneweave-result-flow-design-comparison-20260716.png`
- Viewport/state: 1440 px desktop, embedded isolated guest, completed no-cost production plan

## Fidelity review

| Surface | Result | Evidence |
| --- | --- | --- |
| Layout | Passed | The embedded home has no left history rail or node canvas. The central composer, shortcut Skills, and recent-project grid follow the reference hierarchy. |
| Typography | Passed | One strong Chinese heading, quiet supporting copy, compact control labels, and a restrained project hierarchy remain readable without oversized marketing type. |
| Color and surface | Passed | Near-white canvas, white composer, low-contrast borders, restrained shadows, and a single dark submit control match the requested JiMeng-style light direction. |
| Controls | Passed | Agent mode, model, reference-image picker, submit, four shortcut Skills, asset library, return, and start-project controls all render as real controls. |
| Responsive/overflow | Passed | Browser measurement at 1440 x 900 reported `scrollWidth - clientWidth = 0`. The composer and project grid remain inside the viewport. |
| Result hierarchy | Passed | A completed task now reads top-to-bottom as outcome, ordered storyboard, production plan, material assets, and next actions without opening a node canvas. |
| Result actions | Passed | `重新编辑` returns to the composer with the original prompt, while `再生成` reruns the same no-cost plan through the existing task/SSE contract. |

## Behavior checks

- Clicking `短剧分镜` changes the selected pipeline to `short-drama` and seeds the prompt with `把这个故事改写为三幕短剧，并输出镜头分镜。`.
- The model stays on `自动规划（无成本）`; no paid generation was submitted during QA.
- `资产库` points to `/media` and the reference-image control remains an actual file input.
- Console error review and formal-domain verification are required again after the production release.
- A six-shot no-cost guest fixture completed through the live local API, survived refresh, preserved its ordered shot details, reopened for editing, and regenerated without a paid provider.
- The 1440 px result state reported no horizontal document overflow and no console errors.

## Iteration history

1. Removed the earlier history sidebar and right-hand explanation rail after the user rejected both.
2. Replaced education-specific copy and pipelines with general AIGC creation language and Skills.
3. Moved the composer into the center of the idle experience and added a recent-project grid below it.
4. Compared the implementation against the LibTV structural reference and JiMeng visual reference in the same review pass.
5. Compared both JiMeng result references and the implementation in one vertically aligned image; kept the light result-flow rhythm while showing real text/storyboard artifacts instead of fake generated images.

## Final result

final result: passed

Passed for local design fidelity, the idle path, the no-cost result stream, refresh recovery, re-edit, and regenerate. Production-domain release QA remains the deployment gate.
