# TaskMap Refactor State

> Current snapshot only. History belongs in `WORK-LOG.md`.

## Current branch / snapshot baseline

- Branch: `architecture-v1`
- Implementation baseline: `abd4000` (`docs: reset UI and glass architecture contracts`).
  This snapshot includes the subsequent glass proof candidate and main-App clipping correction;
  use `git log -1` for the containing checkout's current HEAD.
- Last verified GitHub CI: run `35936566796` for `1cd89a4`, rechecked on 2026-09-24.
- The selectable stable-depth plane candidate and diagnostics remain Lab-only and unaccepted.
- Local validation: full `npm run check` passed again on 2026-09-28 (252 files / 1,714 tests)
  after the main-App clipping correction, including build and production exclusions.
  Rust is unchanged; its successful CI on the reviewed HEAD remains the native validation baseline.
- 2026-09-28 audit: architecture checks (589 files), CODEMAP and diff checks pass. GitHub CI above
  remains historical. Subsequent main-App work reconnected Dev and verified the clipping correction.

## Current phase

Phase 4.5 is active.

The database activation intermission is implemented/accepted for normal product use. The remaining
database/release-specific validation item is packaged/live stable + development coexistence.

Phase 4.5A (documentation reset) and 4.5B (minimal workbench) are complete locally.
Phase 4.5C is active: the proof fixture is built, but the native backend fails the rendering gate.
The original proof had four of six positive fixture checks, not production acceptance. The stable-plane
candidate is implemented but unaccepted: overlapping foreground isolation fails and the synthetic
scene does not reproduce the user's real-App stale edge blur/distant brightening.

## Current product ownership

- `DatabaseApplication` owns the active application database/session lifecycle.
- One normalized workspace owns document state.
- Named commands/history own persistent edits.
- Revision-aware persistence owns ordinary document saves.
- Device preferences, encrypted remembered views and session media are separate resources.
- Interaction controllers own high-frequency transient pointer/camera state.
- Retained `App.tsx` presentation remains a temporary renderer boundary; it is not the persistence
  owner.

## Current UI/material position

Development builds expose an App/UI Lab switch inside the admitted database runtime. Both views
share session resources and in-memory blur tuning. Diagnostics show bounds, hit targets and optional
frame/material counters. Lock removes tooling and overrides; stable bundles exclude the workbench.
The normal `app:ui-lab` command now launches TaskMap Dev. The old isolated harness is reference-only.
Live WebView2 verification covered view switching, shared blur/list overscan, diagnostic outlines,
counter display and reset, with screenshots inspected and no console errors/warnings. Lock cleanup
and workspace/history/camera preservation are covered by real-runtime integration tests.

The existing native CSS glass path remains the current implementation, but its topology is **not**
automatically the final architecture.

Known correctness issues include:

- stale edge color is fixed for the reproduced trigger, with repeatable displayed-window evidence: remove both
  Major filter ancestor overflow clips, retaining rounded filter-output masks and content clipping;
  user confirmed the frozen edge is gone and corners remain rounded;
- the user noticed no distant brightening after the correction; broader intermittent-flicker and
  performance acceptance remain open;
- current same-depth batching cannot provide all desired Minor-over-Minor blur behavior;
- the proof confirms same-layer Major contamination; rounded filter-output clipping is now fixed;
- current scroll-list clipping behavior differs from the new desired shrinking-material behavior;
- several UI components still have one-off quality inconsistencies (dialog material/layout,
  scrollbar presentation, stale button rims, small hit targets).

The current implementation does not yet satisfy the final UI/glass contracts. Existing ownership and
performance gaps include a private-filter compositor hint in `WorkspaceSidePanel.css` and drag
geometry notifications reaching retained `App.tsx` through `useLegacyInteractionSnapshot`. These
are not established causes of the visual defect. Core database/application ownership is unchanged
by the current diff; the parked compositor remains inactive.

The final intended behavior is defined by:

- `UI-SYSTEM-CONTRACT.md`
- `GLASS-SYSTEM-CONTRACT.md`
- `UI-QUALITY-GUARDRAILS.md`

## Immediate next task

Continue Phase 4.5C with same-layer Major isolation/overlapping foreground, keeping the accepted
main-App held-drag correction. Include repeated real-App brightness/round-trip checks in acceptance.
The pre-fix main-App held-drag failure was reproduced automatically and seen in displayed-window
capture; WebView capture alone did not reliably show it. The synthetic scene cannot substitute for
main-App acceptance.

Earlier single-variable trials failed and were reverted, including image/container translation.
The new two-clip correction is distinct: leaving either the surface-root clip or inner material clip
in place failed; removing both cleared the repeated held-exit reproduction. No per-frame refresh,
optical reduction or experimental-plane migration is added. History is in `WORK-LOG.md`.

Keep the stable-plane candidate available for comparison, with the current backend as default.
Resolve foreground/effect overlap and optical parity before production migration. The candidate
has fewer filter nodes and stable geometry during synthetic motion, but no proven GPU/performance
advantage. `GLASS-STABLE-PLANE-CANDIDATE.md` records architecture, native evidence, measurements,
automated coverage and blockers. Main App still uses the local native backend, now with the bounded
clipping correction; the experimental planes remain Lab-only.

Do not begin large scroll/motion migration until the rendering proof passes.

Benchmark preparation remains files-only; loading the historical benchmark still requires explicit
authorization and isolated storage. The documentation reset does not authorize stable user-data access.

## Open gates

- glass rendering proof;
- final glass architecture;
- scroll/presence/motion;
- UI primitive/dialog/scrollbar cleanup;
- final visual/performance acceptance;
- packaged stable/dev coexistence;
- Phase 4.5 cleanup.

No general Phase 5 element renderer migration is claimed complete.
