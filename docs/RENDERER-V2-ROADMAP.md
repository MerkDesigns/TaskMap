# TaskMap Renderer v2 Roadmap

## Scope and operating rules

Renderer v2 is a new presentation implementation on the `renderer-v2` branch. It is not an
incremental refactor of the main-branch frontend, old `App.tsx`, or the remaining
architecture-v1/legacy component tree. Those implementations remain read-only reference material
until renderer-v2 parity permits deliberate cleanup.

The following foundations are retained:

- normalized TypeScript document/domain model and invariants;
- named commands and transaction-based undo/redo;
- Redux workspace, dirty tracking, revision handling, and persistence coordination;
- Tauri/Rust database, encryption, locking, backup, and session services;
- media, settings, updater, and structured Workflow Runner boundaries; and
- framework-independent canvas geometry, interaction, minimap projection, and virtualization that
  pass renderer-v2 contract review.

`docs/FEATURE-PARITY.md` remains the behavioral acceptance list. A feature is not accepted merely
because it renders or compiles. Every phase preserves the high-frequency interaction contract and
keeps media bytes out of Redux.

## Open implementation questions

These questions do not block the documentation phase, but must be resolved with measured prototypes
before the affected implementation is accepted:

- Which Mantine and `@liquid-dom/core` versions are compatible with the current React, Vite, Tauri,
  WebView2, and content-security-policy setup?
- Which exact Liquid DOM parameters distinguish Large Panel and Small Panel while matching the
  approved TaskMap visual direction?
- Does Liquid DOM continuously sample animated GIF frames and transformed DOM content with acceptable
  quality and cost across supported WebView2/display-scale combinations?
- What exact non-glass fallback tokens and activation criteria provide legible degraded behavior?
- Which architecture-v1 geometry/interaction/virtualization modules can be reused unchanged, and
  which need renderer-facing adapters without importing legacy models or views?

## Phase 0 — Documentation and decision boundary

### Work

- [x] Reframe `AGENTS.md` and `ARCHITECTURE.md` for renderer v2.
- [x] Record ADR 004, superseding ADR 003 without deleting its history.
- [x] Define the Liquid DOM/Mantine visual boundary.
- [x] Create this renderer-specific roadmap and align testing/code-map guidance.
- [x] Leave frontend source and dependencies unchanged.

### Exit criteria

- The retained architecture and reference-only frontend are unambiguous.
- No current document requires the custom Canvas2D acrylic compositor for renderer v2.
- Unresolved implementation questions are explicit rather than silently decided in documentation.

## Phase 1 — Renderer shell and dependency proof

### Goals

Establish a clean renderer entrypoint and prove the selected UI stack in packaged Windows builds
before broad feature work.

### Work

- Add Mantine and `@liquid-dom/core` in an implementation change, not Phase 0.
- Create the composition-only renderer-v2 shell and providers over the retained Redux workspace and
  platform clients.
- Establish Mantine theme/token integration without putting product state into the UI library.
- Implement one shared Liquid DOM adapter exposing only Large Panel and Small Panel roles.
- Prove that glass samples live DOM text, images, and animated GIFs in development and stable
  Tauri/WebView2 packages.
- Prove reduced-motion, keyboard navigation, focus visibility, portal stacking, and controlled
  non-glass fallback behavior.

### Exit criteria

- Feature code does not import Liquid DOM directly.
- A material role has no dimensions or layout properties.
- Canvas content remains ordinary React/DOM content.
- The renderer shell contains no document mutation, pointer, history, persistence, or platform
  implementation logic.

## Phase 2 — Canvas vertical slice

### Goals

Connect the retained document workspace to a new DOM canvas while protecting the interaction path.

### Work

- Render the canvas frame, grid, viewport, and a minimal registered DOM element.
- Reuse or adapt canonical geometry, interaction, culling, snapping, and minimap projection through
  explicit renderer-v2 boundaries.
- Connect completed move, resize, and layer operations to named commands and transaction history.
- Keep pan, zoom, drag, resize, hover, selection, guides, and previews out of persistent Redux.
- Establish per-entity subscriptions, viewport culling, and visible/imminent media loading.
- Place Liquid DOM chrome outside the transformed element scene.

### Exit criteria

- Pan, zoom, drag, and resize perform no save, serialization, encryption, database, or history work
  per pointer sample.
- A changed completed drag or resize creates exactly one persistent transaction; cancellation and
  no-op completion create none.
- Normal React/DOM text, image, and animated-GIF elements remain visible and animate beneath glass.
- Deterministic interaction and 10,000-element culling gates pass; release-mode FPS evidence is
  recorded before final acceptance.

## Phase 3 — Element modules

Port complete vertical slices in dependency-aware order:

1. Text cards
2. Containers and contained-card placement
3. Text blocks
4. Images and GIFs
5. Mind-map nodes and connections

Each slice includes schema ownership, named commands, selectors, renderer, context-menu
contribution, history, persistence, accessibility, virtualization, and direct parity evidence. Use
Mantine for standard controls and menus. Canvas element surfaces remain normal DOM and do not use
Liquid DOM.

### Exit criteria

- Every element type is explicitly registered and independently tested.
- No element-specific switch accumulates in the generic canvas or shell.
- Images/GIFs are lazy-loaded, media bytes never enter Redux, and visible GIF playback remains
  responsive.

## Phase 4 — Extensions

Port retained extensions as self-contained modules:

1. Lock
2. Checkbox
3. Search
4. Privacy
5. Color tools
6. AI JSON copy/paste

Daily reset, sorting, and pick-a-card remain removed. Privacy keeps ordinary CSS backdrop blur for
content obscuring; it must not use or masquerade as a Liquid DOM panel.

### Exit criteria

- Generic installation/removal and declared compatibility/conflicts work for every extension.
- Extension menus are contributions composed with the standard Mantine menu boundary.
- Direct `backdrop-filter` use exists only in the reviewed Privacy implementation.

## Phase 5 — Product shell and supporting features

Rebuild canvas management, settings, database picker/recent files, search/navigation surfaces,
minimap chrome, toasts, dialogs, updater flow, tray/session controls, config import/export, and error
recovery. Standard controls, inputs, menus, and dialogs use Mantine. Glass-bearing chrome selects
Large Panel or Small Panel through the shared adapter; geometry remains in layout components.

### Exit criteria

- Retained workflows match parity evidence and accessibility expectations.
- Stable and development editions remain fully isolated.
- Portal, modal, menu, and overlay stacking works over live canvas glass in packaged builds.

## Phase 6 — Workflow Runner and backend completion

Wire the structured Workflow Runner and deferred production backend capabilities through their
existing typed boundaries. Preserve executable/arguments/working-directory/display-mode separation,
trust gating, and TaskMap-owned process tracking. Do not reintroduce raw hidden shell execution or
administrator elevation.

### Exit criteria

- Workflow, database, media, settings, updater, and session behavior pass their security and
  lifecycle suites.
- Components do not call Tauri, persistence, encryption, filesystem, or history APIs directly.

## Phase 7 — Parity, performance, and cutover

### Work

- Complete the retained-feature checklist with screenshots/recordings and manual verification.
- Run normal and stress fixtures in release-mode packaged Windows builds.
- Measure pan, zoom, drag, resize, selector/render counts, media scheduling, and Liquid DOM behavior
  over live text, images, and animated GIFs.
- Validate keyboard, screen-reader semantics, reduced motion, display scaling, modal/portal stacking,
  stable/dev isolation, recovery, updater, and session lifecycle.
- Remove or archive superseded frontend implementation only in explicit cleanup changes after the
  renderer-v2 replacement is accepted.

### Exit criteria

- Near-complete retained feature parity is accepted against `docs/FEATURE-PARITY.md`.
- The documented 60 FPS target passes on the normal fixture and reference hardware.
- No application-owned Canvas2D acrylic compositor is part of the renderer-v2 runtime.
- No renderer-v2 feature depends on old `App.tsx`, `LegacyApplication`, or legacy frontend state.
- All validation in `docs/TESTING.md` passes, and `docs/CODEMAP.md` is current.
