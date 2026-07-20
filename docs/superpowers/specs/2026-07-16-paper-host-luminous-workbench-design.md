# Paper Host Luminous Workbench Design

## Goal

Give the embedded education creation agent a distinctive, polished light visual system without changing its task, storage, guest isolation, or provider contracts.

## Chosen direction

Use a **luminous research workbench** rather than a flat white dashboard or a dark cinematic clone. The existing three-column information architecture stays intact. The center stage gains depth from the repository's real workflow visual asset, a soft platform-blue atmosphere, and a production-path motif. Cards become layered working surfaces with clearer active states instead of uniform white rectangles.

## Visual hierarchy

- Keep the paper-web light shell and blue primary action.
- Use `public/home/huiying-workflow-canvas.png` as a low-opacity, masked background asset in the idle stage; do not copy LibTV imagery.
- Present the hero as an active production brief: compact eyebrow, confident title, short explanation, and three connected production steps.
- Give quick starts distinct blue, violet, and cyan accents while keeping text contrast and restrained shadows.
- Make the composer the strongest surface through a subtle gradient border, inner highlight, and clear attachment/model/Skill grouping.
- Turn the right context cards into a vertical production rail with numbered status markers.
- Keep motion limited to entrance, hover, focus, and live task progress; `motion-reduce` removes translation and animation.

## Behaviour constraints

- No API, SSE, retry, guest owner, reference upload, or storage changes.
- All existing controls remain real and keyboard reachable.
- No paid generation is used for validation.
- Independent SceneWeave branding and non-embedded routes remain unchanged.

## Acceptance

- The embedded shell exposes `data-paper-host-visual="luminous-workbench"`.
- The real workflow asset is present only in the idle stage and remains decorative.
- The formal 1440px page has no horizontal overflow or console errors.
- A no-cost task still completes, survives refresh, and preserves guest isolation.
- `prefers-reduced-motion` users do not receive decorative movement.
