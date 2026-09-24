# TaskMap Refactor State

> Current snapshot only. Historical implementation steps and measurements live in WORK-LOG.md.
> REFACTOR-ROADMAP.md and accepted ADRs define phase order.

## Current HEAD and phase

- Branch: `architecture-v1`.
- Audited HEAD: `6c9c914d5a383e63fbcd83fc60f45f6506a5f8fa` — database hardening and CI.
- Current work: uncommitted CI scheduling/close-path follow-up; remote validation still pending.
- Phase 4.5C/D remains open. Database activation interrupted the glass acceptance plan.
- Database implementation and requested manual checks are accepted; integration estimate remains
  99% pending packaged-build/live edition-coexistence validation. This is not whole-refactor progress.

## Active production architecture

- AppShell composes providers, an outer error boundary and DatabaseApplication. The fallback retains
  guarded close handling without depending on the normal chrome/material rendering path.
- One database runtime owns the normalized workspace, named commands, transaction history and
  revision-aware persistence. Rust owns encrypted storage, derived keys and session authority.
- Runtime resources attach explicitly before use. Purge/disposal attempt all owners and report failure.
  Keep future independent lifecycle responsibilities in collaborators; do not grow the session
  controller with unrelated flags or move persistence back into the retained App.
- RetainedCanvasApplication still uses legacy App.tsx presentation. This is a temporary renderer
  boundary, not legacy document/storage ownership. Phase 5 transfers feature ownership in the
  planned order: Text Card, Container, Text Block, Image/GIF, Mind-map.
- The interaction controller owns transient pointer state; completed changes use named commands.
- Media stays outside Redux. Rust read tokens bind bounded chunks to validated immutable bytes,
  with session revocation, explicit release, completion cleanup and idle expiry.
- Product boot excludes native legacy storage, keyring/migrations, Discord and raw runner handlers.
  Old source files may remain as disconnected reference; no user-data conversion occurred.
- MaterialSurface owns live native CSS glass. Cached compositor/worker code remains parked under
  ADR 003 until Phase 4.5D cleanup.

## Verified status

- Native disposable-database checks passed: entry/create/open/unlock, wrong-password rejection,
  save/restart/readback, explicit lock, save-failure retry, full-backup restore, generation recovery,
  GIF/PNG import/reload and ordinary window geometry persistence.
- User reported native GIF drop/persistence, Windows lock, screenshot exclusion, maximized reopen
  and the requested retained-feature round-trip checklist working. Do not repeat these checks
  without a relevant regression. Optional multi-monitor coverage was not separately confirmed.
- Inactivity locking is explicitly deferred by the user. Keep the implemented Windows WTS locking.
- Current local checks: 1,702 frontend tests pass without jsdom errors. Rust default, Dev and all-feature
  suites each pass 63 tests; the ignored child-process entry is exercised by its parent lock test.
  Formatting, typecheck, lint, architecture, code map, build and production-exclusion checks pass.
  Vite's existing bundle-size/plugin-time advisories remain; details are in WORK-LOG.
- Rebuilt Tauri inspection passed disposable-database unlock/GIF load and a deliberate error-boundary
  probe with working guarded close. Normal flow had no console errors/warnings; the injected error
  produced the expected React diagnostic. Save-failure close retry is covered by unit tests.
- CI now covers architecture-v1 pushes and default/Dev/all-feature Rust configurations separately.
  GitHub run 35903807853 for 6c9c914 passed all three Rust jobs but failed four frontend tests.
  Local fixes address actions on disabled controls and one structural-test timeout; a new remote
  green run is required after commit/push. Do not describe the current GitHub commit as green.

## Open blockers

- Commit/push the CI follow-up and confirm its GitHub run is green before new architecture work.
- Packaged-build/live stable-Dev coexistence remains unverified; preserve installed stable data.
- Phase 4.5 native-glass visual/animation/stacking acceptance and release-mode pan FPS remain open.
  Remaining consumers, Quick Extensions polish, cross-display checks and obsolete rendering cleanup
  follow GLASS-IMPROVEMENT-PLAN.md and the roadmap.
- No general Phase 5 migration or release completion is claimed.

## Immediate next task

Commit/push this bounded CI follow-up and verify GitHub, then finish the outstanding isolated database
packaging/coexistence check before returning to glass acceptance. Benchmark authorization remains
files only; do not load the benchmark without fresh permission. Keep future commits coherent by
concern; do not rewrite ee562109 history. Root .tmp-* acceptance artifacts stay local and ignored.
