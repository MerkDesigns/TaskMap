# TaskMap Refactor State

> Clean current-state snapshot. Keep this file concise and rewrite it as the project advances.
> Historical experiments and back-and-forth belong in `docs/WORK-LOG.md`.
> The authoritative migration order remains `docs/REFACTOR-ROADMAP.md`.

## Last audit

- Branch: `architecture-v1`
- Repository/docs HEAD before this reconciliation: `71c5a93ae56ab054031bd85a9802d44945826953`
- Repository/docs HEAD message: `Add refactor workflow and state tracking docs`
- Implementation audited through: `b21fea6069cc031bb0c4700266aed19f98914502`
- Implementation audit commit message: `Refine Quick Extensions UI`
- Audit date: 2026-08-29

## Current roadmap position

**Phase 4.5 — Visual System + Adaptive Acrylic Compositor**

- 4.5A Contract / foundation: complete.
- 4.5B Cached Canvas2D compositor proof: core implementation complete; ADR 003 later superseded it
  for production and the implementation is parked for rollback/reference. Its historical image/GIF
  fidelity follow-up remains incomplete but is not a current production acceptance gate.
- 4.5C Production visual migration: active/incomplete.
- 4.5D Cleanup / acceptance: not yet complete.
- Phase 4 release-mode rendered FPS acceptance is intentionally still open and is closed against the final Phase 4.5 rendering path.

Do not begin general Phase 5 ownership migration until the Phase 4.5 acceptance gate is intentionally closed or the roadmap is deliberately revised.

## Current architecture boundary

The repository is intentionally hybrid during this phase:

- `AppShell` establishes the new architecture boundary.
- Production feature/document ownership still largely runs through `LegacyApplication` / legacy `App.tsx`.
- The Phase 4 canvas interaction controller is the authoritative transient interaction engine.
- Production interaction completion currently crosses the temporary legacy commit/compatibility boundary.
- Normalized document/workspace/history/persistence foundations exist for later production ownership migration.
- Phase 5 progressively replaces legacy element ownership one complete vertical slice at a time.
- Active production acrylic is live native CSS glass through `MaterialSurface`; the cached Canvas2D
  compositor/worker/fallback/`BackdropScene` path is parked and is not a production rendering owner.

Do not interpret the continued size/responsibility of legacy `App.tsx` as permission to perform an unscheduled broad split. Remove responsibilities through the roadmap's ownership slices.

## Database / persistence status

Phase 2 established the secure `.tmapdb` backend/session foundation, including encrypted document storage, session handling, generations/backups, media storage, writer ownership, and edition-specific configuration foundations.

Important current limitation:

- the finished production database-management UX is not yet the active product workflow;
- database picker/recent-files product integration is explicitly listed in Phase 8;
- tray UX, config import/export, and other deferred production shell work remain later roadmap items.

Therefore, lack of a user-facing database picker/location UI at this point does not by itself mean Phase 2 was lost; it means the backend vertical slice exists ahead of final product-shell activation.

## Recently confirmed implementation

### Quick Extensions

Commit `b21fea6` refines the Shift+E Quick Extensions menu toward the Phase 4.5 visual system:

- Acrylic Large shell via `MaterialSurface`.
- shared Small/Minor acrylic list plane.
- shared `SearchField`.
- shared `Tooltip`.
- production extension-card visual language.
- shared motion/reduced-motion handling for menu presence.

The menu is improved but still has follow-up work before visual/performance acceptance is considered complete.

### Context-menu/UI Lab support

Recent work also added a UI Lab production-context-menu playground so real menu behavior/presentation can be tested without inventing a separate mock implementation.

## Active blockers / working backlog

### 1. Finish the remaining Phase 4.5C visual migration

Official roadmap items still include:
- target-accent migration across remaining production chrome;
- remaining frozen legacy frosted/material consumers;
- preservation of user-selected and semantic/spatial colors;
- production native-glass visual, media-under-acrylic, animation, stacking, and Windows WebView2
  acceptance.

The parked cached-compositor worker/fallback path is not an active production acceptance blocker
unless ADR 003 is deliberately revised.

Quick Extensions is one of the remaining practical areas being refined inside this gate.

### 2. Quick Extensions material-backed scrolling

Current known issue:
- acrylic card geometry/shadows near scroll boundaries do not yet behave like a fully separated material layer;
- nested clipping/intersection behavior can visually cut cards or shadows.

Treat this as a local Phase 4.5 visual/material issue, not a reason to start Phase 5 ownership migration.

### 3. Quick Extensions drag representation

Desired follow-up:
- source card remains reusable in the menu;
- drag representation begins visually matching the source;
- after detaching from the source, text fades and the real glass geometry contracts horizontally into a compact icon token;
- avoid generic whole-card `transform: scale()` morphing if it breaks material geometry.

This is presentation/interaction polish around the current Quick Extensions flow, not a new persistent feature model.

### 4. Pan performance before Phase 4.5D acceptance

Current manual evidence from development builds:
- canvas panning with most chrome hidden can run around 360 FPS;
- opening Canvas Browser materially reduces pan FPS;
- opening additional Shift+E chrome reduces it further;
- a large animated GIF under translucent glass does not cause the same slowdown while the canvas is stationary;
- changing Major blur radius alone did not materially change the measured pan FPS.

Current diagnosis is **not yet proven**. High-priority areas to isolate:
- root/high-level React subscription and rerender work during viewport updates;
- Canvas Browser prop stability and active preview work;
- transient camera state causing unrelated legacy bookkeeping;
- static/floating chrome rerendering because the viewport changed;
- WebView2 recomposition when a large transformed canvas moves beneath fixed material surfaces.

Do not reduce accepted glass quality until these paths are isolated in a production-performance build.

## Immediate progression

Current working order:

1. Finish the local Quick Extensions / remaining 4.5C work currently in progress.
2. Stabilize and isolate pan performance sufficiently for the Phase 4/4.5 acceptance gate.
3. Complete remaining official 4.5C consumers and acceptance.
4. Perform 4.5D cleanup:
   - remove obsolete frosted paths/allowlists;
   - remove the parked cached compositor/worker/fallback source once native-glass acceptance confirms
     it is no longer needed for rollback/reference;
   - run architecture/material scans and full validation;
   - perform release-mode rendered performance measurement against the active native-glass path;
   - regenerate/update final documentation/code map.
5. Begin Phase 5 with the Text Card vertical slice.

## Phase 5 order (do not reorder casually)

1. Text Card
2. Container
3. Text Block
4. Image/GIF
5. Mind-map node and connections

Each slice transfers complete ownership: model/schema/commands/selectors/renderer/menu/tests/history/persistence/parity and replaces the corresponding legacy interaction mapping/commit behavior.

## Documentation maintenance

After implementation work:
- append details/experiments to `docs/WORK-LOG.md`;
- rewrite this file to reflect only the current clean state;
- update the roadmap only when its real completion state changes;
- update CODEMAP/parity/normative docs only when their respective contracts or structure change.
