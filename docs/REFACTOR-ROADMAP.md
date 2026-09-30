# TaskMap Refactor Roadmap

## Operating rules

- `main` remains the legacy/stable reference until the refactor is ready for release.
- `architecture-v1` contains the replacement architecture.
- The branch must stay buildable/testable.
- Retained product behavior follows `FEATURE-PARITY.md` unless a newer accepted contract explicitly
  approves a change.
- Historical implementation experiments belong in Git/WORK-LOG, not the active roadmap.

## Phase 0 — Baseline/evidence

Status: complete enough for the refactor.

Purpose:

- capture retained behavior;
- establish dependency/performance fixtures;
- record removed features and stable/dev separation.

## Phase 1 — Application skeleton

Status: complete.

Purpose:

- composition-only AppShell;
- domain/platform/store boundaries;
- transient interaction contracts;
- architecture enforcement.

## Phase 2 — Database/encryption/session foundation

Status: backend/session foundation complete and now integrated into the product runtime.

The later database activation intermission brought the production lifecycle, resource ownership,
media transport and remembered-device/view state forward.

Remaining release-specific database item:

- packaged/live stable + development coexistence acceptance.

## Phase 3 — Normalized document core/history

Status: complete.

Includes:

- normalized current document;
- named commands;
- atomic patch history;
- workspace orchestration;
- revision-aware persistence.

## Phase 4 — Canvas/interaction engine

Status: implementation and retained interaction parity accepted.

Includes:

- viewport/camera;
- selection;
- move/resize;
- snapping;
- culling;
- minimap projection;
- one semantic completion per persistent interaction.

Final rendered performance acceptance is folded into the final Phase 4.5 rendering path.

# Phase 4.5 — Final UI + Glass System

This phase is currently active.

The old cached-compositor/native-glass C1/C2/C3 implementation history is preserved in Git and
`WORK-LOG.md`. It no longer defines the active plan.

The active contracts are:

- `UI-SYSTEM-CONTRACT.md`
- `GLASS-SYSTEM-CONTRACT.md`
- `UI-QUALITY-GUARDRAILS.md`

## 4.5A — Contract/documentation reset

- [x] Install the final UI/glass/quality contracts.
- [x] Remove superseded UI/visual/glass implementation-plan docs.
- [x] Update architecture/agent/workflow/wiring/testing/parity references.
- [x] Record the new foundational decision in an ADR.
- [x] Keep historical evidence in Git/WORK-LOG rather than competing normative docs.

Exit:

- a new session has one unambiguous answer for current UI/glass intent.

## 4.5B — Database-backed development workbench

- [x] Replace the separate UI-Lab app entry with one development workbench inside the real
      `DatabaseApplication` runtime.
- [x] Provide App ↔ UI Lab switching without reopening/replacing the active database session.
- [x] Share material/theme/motion implementation and dev tuning across both views.
- [x] Add material/hitbox/geometry/performance diagnostics.
- [x] Keep tooling development-only and out of product UI.

Exit:

- controlled fixtures and real app can be compared with the same runtime/tuning.

## 4.5C — Rendering proof

Build the smallest proof scene before redesigning the full renderer.

Prove:

- [ ] same-layer persistent Major isolation;
- [x] higher overlay Major sampling of completed lower UI;
- [x] promoted Minor-over-Minor blur ordering;
- [x] continuously live moving bright backdrop;
- [x] continuously live animated backdrop;
- [ ] overscan appearance without stale/cross-layer contamination.

Current native candidate: four checks have positive fixture evidence. Rounded output clipping is
fixed, but logical isolation/cross-layer contamination still fail. Revalidate these fixture checks after any
backend revision. Evidence and limitations: `GLASS-RENDERING-PROOF.md`.

If the candidate WebView2/native CSS topology fails, revise the private material backend before
continuing. Do not weaken the visual contract.

Exit:

- one rendering approach demonstrably satisfies the core glass topology.

## 4.5D — Final material/depth architecture

2026-09-29: user accepted the shared workspace Major plane as the main-App default after the
bounded real-App isolation/motion/held-drag checks. Production ownership now lives in MaterialSurface
and WorkspaceMajorGlass. This is a partial cutover; Minor/depth and general overlap work below remain.

- [ ] Implement logical glass layer contexts.
- [ ] Implement canonical Major/Minor recipe ownership.
- [ ] Implement settled Minor batching. (Canvas Browser, Extensions and Settings islands batched;
      Minor-on-Minor shell policy in MaterialSurface.)
- [ ] Implement promotion/demotion for overlap/drag.
- [ ] Separate geometry invalidation from backdrop damage.
- [ ] Keep browser-specific refresh behavior private to the material backend.
- [ ] Retain intended overscan/ambient response.

Exit:

- core glass topology is deterministic in UI Lab and real app.

## 4.5E — Scroll + motion

- [ ] Implement settled scroll-edge material shrinking. (Canvas Browser, Extensions and Quick
      Extensions done 2026-09-29; Settings deferred to its redesign.)
- [ ] Keep ordinary content unscaled and rounded-masked.
- [ ] Keep rim/shadow independent from content clipping.
- [x] Implement held-item exemption during auto-scroll. (Verified 2026-09-29 in Canvas Browser: held
      card keeps full shell/rim/glass past the auto-scroll edge while settled cards morph.)
- [ ] Implement liquid pickup/drop geometry morph. (Canvas Browser pickup expansion + drop slice morph
      implemented 2026-09-29; awaiting user feel check. Neighbour "move outward" not implemented.)
- [x] Implement composable Fade / Material Fade / Slide / Lift / Scale / Geometry Morph. (Production
      `presenceMotion` + presets + DEV preview landed 2026-09-29; Quick Extensions, side panel and
      minimap and dialogs migrated by 2026-09-30.)
- [ ] Tune material-fade blur timing after structural behavior works.
      (DEV delay/curve tuning landed 2026-09-30; awaiting chosen values.)

Exit:

- list/motion behavior satisfies the glass contract.

## 4.5F — UI-system cleanup

- [x] Standardize major dialog/overlay shell. (2026-09-30: shared header/body/actions; production
      dialogs, Create Canvas, JSON editor and Settings header migrated. Command Runner dialogs skipped:
      removed feature, Workflow Runner is Phase 7.)
- [x] Migrate Create Canvas to Major Glass. (2026-09-30: root modal on the shared dialog structure.)
- [x] Standardize ScrollArea/scrollbar presentation. (2026-09-30: `taskmap-scrollbar-hidden` /
      `taskmap-scrollbar-thin` + `ScrollArea scrollbar`; theme `color-scheme: dark`.)
- [x] Remove Settings scrollbar bleed/gutter (shared hidden-scrollbar variant; scrolling verified).
- [x] Audit shared button/IconButton variants and remove stale local rims. (2026-09-30: Extensions
      filter/favorite/info; primitive `data-selected` state.)
- [x] Fix common icon-action hit targets (including Canvas Browser overflow). (2026-09-30: card
      overflow and Extensions actions are 28 px compact IconButtons.)
- [ ] Remove feature-local visual forks that should be reusable primitives/patterns.

Exit:

- core chrome/dialog/control inconsistencies no longer require one-off fixes.

## 4.5G — Acceptance

- [ ] Run the Glass System hard acceptance matrix.
- [ ] Validate the same tuning in controlled Lab and real App.
- [ ] Run deterministic round-trip/stale-backdrop checks.
- Deferred by user direction (2026-09-28): dedicated release-mode benchmarks and median/p95/p99
  comparisons. Current use feels normal with no perceived regression; this is subjective acceptance,
  not a measured pass. Do not block the next slices on these measurements. Revisit on noticeable
  slowdown or a concrete change adding significant rendering work. Hot-path design rules remain.
- [ ] Verify no accumulating observers/schedulers/filter layers/promoted surfaces.
- [ ] Verify packaged stable/dev database/application coexistence.

Exit:

- final UI/material path is visually accepted and does not materially regress performance.

## 4.5H — Cleanup

- [ ] Delete obsolete cached renderer/worker/backdrop paths once rollback is no longer needed.
- [ ] Delete obsolete compatibility material paths.
- [ ] Remove old UI-Lab architecture.
- [ ] Remove obsolete motion/material invalidation APIs.
- [ ] regenerate CODEMAP;
- [ ] refresh final state/docs.

Exit:

- one active UI/material architecture remains.

## Phase 5 — Element renderer migration

Order:

1. Text Card
2. Container
3. Text Block
4. Image/GIF
5. Mind-map node/connections

Each slice transfers presentation ownership to the normalized architecture without reopening
persistence ownership.

## Phase 6 — Extensions

Migrate retained extensions:

- Lock
- Checkbox
- Search
- Privacy
- Color
- AI JSON copy/paste

Removed legacy features remain removed.

## Phase 7 — Workflow Runner

Complete the structured Workflow Runner UX/runtime.

## Phase 8 — Remaining product features

Finish retained features not covered by element/extension slices, including updater/tray/settings
work that remains genuinely incomplete.

## Phase 9 — Standalone migrator

Complete/ship the separate legacy-data migrator as needed.

Legacy conversion remains outside the main product.

## Phase 10 — Hardening/release

- packaged release validation;
- security/performance/manual acceptance;
- migration cleanup;
- final architecture/documentation scan.
