# Design QA: embedded AIGC home

## Evidence

- Structural reference: `C:/Users/16571/AppData/Local/Temp/codex-clipboard-ac4c2d21-ffde-4128-a1fd-a9cfd4d45e22.png` (LibTV Agent home)
- Visual-language reference: `C:/Users/16571/AppData/Local/Temp/codex-clipboard-f9e41949-dff6-42bd-a31c-79c8891f989d.png` (JiMeng light workspace)
- Implementation capture: `C:/Users/16571/Documents/Codex/2026-07-10/ssh-root-123-56-218-60/outputs/sceneweave-aigc-home-1440-20260716.png`
- Viewport/state: 1440 x 900, embedded guest, empty session, idle composer

## Fidelity review

| Surface | Result | Evidence |
| --- | --- | --- |
| Layout | Passed | The embedded home has no left history rail or node canvas. The central composer, shortcut Skills, and recent-project grid follow the reference hierarchy. |
| Typography | Passed | One strong Chinese heading, quiet supporting copy, compact control labels, and a restrained project hierarchy remain readable without oversized marketing type. |
| Color and surface | Passed | Near-white canvas, white composer, low-contrast borders, restrained shadows, and a single dark submit control match the requested JiMeng-style light direction. |
| Controls | Passed | Agent mode, model, reference-image picker, submit, four shortcut Skills, asset library, return, and start-project controls all render as real controls. |
| Responsive/overflow | Passed | Browser measurement at 1440 x 900 reported `scrollWidth - clientWidth = 0`. The composer and project grid remain inside the viewport. |

## Behavior checks

- Clicking `短剧分镜` changes the selected pipeline to `short-drama` and seeds the prompt with `把这个故事改写为三幕短剧，并输出镜头分镜。`.
- The model stays on `自动规划（无成本）`; no paid generation was submitted during QA.
- `资产库` points to `/media` and the reference-image control remains an actual file input.
- Console error review and formal-domain verification are required again after the production release.

## Iteration history

1. Removed the earlier history sidebar and right-hand explanation rail after the user rejected both.
2. Replaced education-specific copy and pipelines with general AIGC creation language and Skills.
3. Moved the composer into the center of the idle experience and added a recent-project grid below it.
4. Compared the implementation against the LibTV structural reference and JiMeng visual reference in the same review pass.

## Final result

Passed for local design fidelity and core idle-path interaction. Production-domain release QA remains the deployment gate.
