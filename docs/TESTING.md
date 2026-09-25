# TaskMap Testing Strategy

## Purpose

Tests prove contracts and regression safety.

This document defines current validation layers/gates. Historical phase-by-phase test inventories
belong in Git/WORK-LOG and in the tests themselves, not in this strategy document.

## 1. CI baseline

The Windows CI path should cover:

- formatting;
- TypeScript typecheck;
- lint;
- frontend tests;
- architecture/dependency checks;
- production build;
- production-exclusion/capability checks;
- CODEMAP check;
- Rust formatting;
- Rust Clippy with warnings denied;
- Rust tests for default/development/all-feature configurations.

A workflow definition is not evidence of a successful run.

## 2. Unit/domain tests

Pure tests cover:

- document schema/invariants;
- command payloads/effects;
- history forward/inverse patches;
- extension compatibility;
- element contracts;
- workflow validation;
- preference/config validation.

Prefer deterministic structural assertions over fragile wall-clock timing.

## 3. Application integration tests

Cover:

- normalized workspace lifecycle;
- command dispatch/history;
- revision-aware persistence;
- stale epoch/session completion rejection;
- database entry/open/unlock/lock/retry;
- device preferences;
- remembered encrypted views;
- media import/read/release/session revocation;
- retained-view callback revocation during migration.

## 4. Rust/native service tests

Cover:

- database envelope/schema;
- encryption/authentication;
- writer ownership/file identity;
- key/session lifetime;
- backup/recovery generations;
- bounded media transport and validated read tokens;
- settings/atomic files;
- workflow process ownership.

## 5. UI/component tests

Use component tests for deterministic behavior such as:

- semantics/accessibility;
- focus/keyboard;
- primitive variants;
- hit-target class/geometry contracts;
- motion-controller state;
- mount/exit lifetime;
- shared scheduler ownership;
- no duplicate subscribers.

jsdom does **not** prove WebView2 pixels, native blur, compositor ordering or real geometry unless the
test provides explicit geometry mocks.

## 6. Architecture/static checks

Reject:

- Tauri imports outside platform boundaries;
- feature-owned raw glass/backdrop implementations;
- private material renderer imports from feature code;
- legacy persistence reintroduction;
- UI-Lab/dev tooling in production bundles;
- new one-off primitive visual forks where static detection is practical.

## 7. UI/glass rendering proof

Before broad final glass implementation, manually exercise the proof scene specified in
`GLASS-SYSTEM-CONTRACT.md` in real Tauri/WebView2.

The proof must establish:

- same-layer Major isolation;
- higher overlay sampling;
- promoted Minor ordering;
- continuously live moving backdrop;
- continuously live animated backdrop;
- correct overscan boundaries.

Automated DOM tests cannot substitute for this proof.

The current runnable scene is **UI Lab → Rendering proof**. Reset workbench blur overrides and
use its independent ink/overlay/promotion controls for A/B comparisons. `GLASS-RENDERING-PROOF.md`
records the current candidate's failures and screenshots. A user-confirmed pointer drag is required
when MCP swipe cannot operate the pointer-capture handle; do not infer a drag pass from tool success.

## 8. UI Lab + real App acceptance

The development workbench must allow the same material/tuning state to be inspected in:

- controlled UI Lab fixtures;
- the real App using the active database/session.

A fix is not visually accepted solely because the controlled fixture looks correct.

Launch `npm run app:dev:mcp` (also `npm run app:ui-lab`) and admit a development database.
The bottom DEV strip switches App/UI Lab; tuning remains in memory across view switches.
Check blur in both views, including shared Minor list planes, and reset before visual baselines.
Material/effect and hit-target outlines are optional. Frame counters measure requestAnimationFrame
intervals, not GPU-presented FPS, and add diagnostic overhead. They are disabled by default.
Lock must remove the workbench, its overrides and its sampling loop. Production builds exclude it.

`npm run app:ui-lab:isolated` retains the old storage-free harness as a reference during migration;
it is not the current workbench acceptance path.

## 9. Glass correctness acceptance

Use the hard acceptance matrix in `GLASS-SYSTEM-CONTRACT.md`.

Particularly important regressions:

- no stale red blur while dragging an object away;
- no mouse-up correction;
- real Minor-over-Minor blur when promoted;
- scroll-edge rounded material shrink;
- rounded content masking;
- intact shadow/rim behavior;
- parent glass unaffected by child-button interaction;
- deterministic round trip after repeated interaction.

## 10. UI quality acceptance

Use `UI-QUALITY-GUARDRAILS.md`.

Manual review must catch:

- wrong surface/material role;
- one-off dialog alignment;
- native scrollbar bleed/gutter;
- stale button rims;
- tiny click targets;
- feature-local primitive forks.

## 11. Performance methodology

Performance claims require a recorded environment.

Record:

- commit/build mode;
- CPU/GPU;
- display resolution/refresh;
- DPR/scaling;
- WebView2 version;
- viewport;
- fixture/database;
- visible element/media counts;
- glass surface/batch/filter counts.

For each relevant interaction record:

- median frame time;
- p95 frame time;
- p99 frame time;
- long/dropped frame count;
- geometry reads;
- rim redraws;
- material/backdrop work;
- React-render activity where relevant.

## 12. Reference interactions

Existing `fixtures/glass-normal-v1/` and `fixtures/glass-smoke-v1/` are ignored, offline-generated
historical fixtures. `scripts/generate-glass-benchmark.py --verify` checks prepared artifacts; it
does not import them. The normal fixture has 2,000 elements across 25 canvases (80 per canvas), not
2,000 visible elements on one canvas. Its legacy document format is not a current `.tmapdb` import.
Preparation was authorized as files-only; benchmark loading still needs explicit authorization and
an isolated test database. Never infer permission to use installed stable data or legacy keyring
resources from the documentation reset. Historical generation details remain in Git/WORK-LOG.

At minimum benchmark:

- camera pan;
- wheel zoom;
- Canvas Browser scroll;
- Canvas Browser drag/reorder + auto-scroll;
- moving image/bright object under glass;
- animated media under stationary glass;
- opening/closing major overlay;
- representative real-app interaction with normal UI visible.

## 13. Performance acceptance rule

The design objective is maximum practical throughput, including high-refresh displays.

Do not use a fixed 60-FPS ceiling as the final design target.

Final acceptance requires:

1. no meaningful regression in frame-time distribution versus the recorded baseline on the same
   environment/workload;
2. hot-path invariants from `GLASS-SYSTEM-CONTRACT.md` hold;
3. no new unbounded per-surface/per-element material work;
4. no accumulating runtime resources.

360 Hz (~2.78 ms/frame) is a reference optimization target, not an unconditional pass/fail guarantee
for every scene.

## 14. Packaged/native acceptance

Before release claims, validate:

- packaged development build;
- packaged stable build where safe;
- stable/dev identity/config/database/recent/session coexistence;
- window/session lock/close/reopen/quit behavior;
- real media decode/animation;
- actual WebView2 glass behavior;
- no dev tooling in production.

## 15. Documentation evidence

When a test/acceptance run matters:

- record durable results/environment in `WORK-LOG.md`;
- update `REFACTOR-STATE.md` with only the current accepted status;
- do not grow this strategy file with chronological test history.
