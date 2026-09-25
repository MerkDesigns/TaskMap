# TaskMap Refactor State

> Current snapshot only. History belongs in `WORK-LOG.md`.

## Current branch/HEAD

- Branch: `architecture-v1`
- Last reviewed HEAD before the UI documentation reset: `1cd89a4fe0add04d34e2425ad81db10f687dbd80`
  (`Fix CI test scheduling and prevent runtime startup on fallback close`)
- GitHub CI run `35936566796` for that commit passed; rechecked on 2026-09-24.
- The documentation reset, Phase 4.5B workbench and Phase 4.5C proof fixture are local/uncommitted.
- Local validation: full `npm run check` passed (1,709 tests); CODEMAP and diff checks also pass.
  Rust is unchanged; its successful CI on the reviewed HEAD remains the native validation baseline.

## Current phase

Phase 4.5 is active.

The database activation intermission is implemented/accepted for normal product use. The remaining
database/release-specific validation item is packaged/live stable + development coexistence.

Phase 4.5A (documentation reset) and 4.5B (minimal workbench) are complete locally.
Phase 4.5C is active: the proof fixture is built, but the native backend fails the rendering gate.
Four of six core checks have positive fixture evidence; this is not production acceptance.

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

- stale/frozen backdrop while content moves underneath glass;
- current same-depth batching cannot provide all desired Minor-over-Minor blur behavior;
- the proof confirms same-layer Major contamination; rounded filter-output clipping is now fixed;
- current scroll-list clipping behavior differs from the new desired shrinking-material behavior;
- several UI components still have one-off quality inconsistencies (dialog material/layout,
  scrollbar presentation, stale button rims, small hit targets).

The final intended behavior is defined by:

- `UI-SYSTEM-CONTRACT.md`
- `GLASS-SYSTEM-CONTRACT.md`
- `UI-QUALITY-GUARDRAILS.md`

## Immediate next task

Address logical backdrop-source isolation while preserving optics/overscan. Rerun all six proof checks
before broad migration. Rounded clipping now uses a mask on each local filter output, preserving the
expanded sampling extent. Live App/Lab screenshots were inspected; the user confirmed rounded corners
and continuously live pointer blur after the fix. `GLASS-RENDERING-PROOF.md` records the evidence and
limitations. The proof remains 4/6 because cross-layer overscan contamination is still unresolved.

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
