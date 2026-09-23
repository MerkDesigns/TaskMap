# Glass improvement plan

Created 2026-09-05 from the repository glass/camera audit.

## Scope and constraints

Preserve current visuals and retained behavior. Improve the existing rendering paths; do not
introduce another rendering abstraction or broadly refactor App ownership. No commits or pushes
unless requested. Inspect the actual Tauri application for visual acceptance.

## Step 1 — Camera and snapshot isolation (implemented and verified)

Addresses requirements 1 and 2.

- [x] Present camera transforms directly from the interaction controller, including world,
      text-card overlays, connection overlays, grid, selection, and minimap camera presentation.
- [x] Prevent camera-only frames from rerendering the legacy App tree and static chrome.
- [x] Preserve responsive culling, hit testing, cancellation, wheel zoom, reset, canvas switching,
      and current-camera reads at save/export/history boundaries.
- [x] Keep Canvas Browser document inputs stable during pan/zoom; do not construct persisted
      snapshots during camera presentation.
- [x] Add focused regression coverage for frame-frequency work and camera correctness.
- [x] Inspect baseline and changed Tauri UI, exercise interactions, and check console logs.

Starting evidence: App subscribes to the entire controller snapshot; render calls
getPersistedCanvases even with Canvas Browser closed; an effect rebuilds current data when the
camera changes. Pan already commits legacy camera at completion. Wheel zoom schedules a legacy
write each frame. Canvas Browser's stable ordered-ID list already prevents camera-only renders
from causing runtime reconciliation; preserve that protection.

## Step 2 — Central geometry ownership (implemented and verified)

Addresses requirements 3 and 5.

- [x] Consolidate native surface observation/invalidation within the existing material system.
- [x] Let list runtimes supply card geometry without duplicate material measurements.
- [x] Coalesce reads per viewport/frame, then perform writes; cache shared boundary rectangles.
- [x] Key rim updates by local dimensions, radius, DPR, and optical settings.
- [x] Eliminate repeated panel/viewport reads during drag, autoscroll, and snapping.

Starting evidence: MaterialSurface owns per-surface ResizeObservers and window listeners;
standalone geometry refresh reads its rectangle twice. Extensions has an additional observer and
measurement loop. Canvas Browser has its own geometry runtime.

## Step 3 — Stable list topology and clipping (implemented and verified)

Addresses requirements 4, 6, and 10.

- [x] Preserve DOM/material ancestry between moving and settled states.
- [x] Keep full card dimensions during scrolling; clip visibility without resizing the material.
- [x] Separate material clipping, content/scroll clipping, and external effects/shadows.
- [x] Consolidate Canvas Browser and Extensions into one reusable scrollable glass-list pattern,
      preserving their existing scrolling, reorder, editing, filtering, and drag behavior.
- [x] Use original rounded card geometry intersected with viewport clips, avoiding new rounded
      corners at the edges of partially visible slices.

Starting evidence: Canvas Browser reparents dragged hosts and switches backdrop batches; scrolling
shrinks material surfaces to visible height. Extensions independently intersects measured card
rectangles and rebuilds rounded shapes from the clipped slices.

## Step 4 — Material parity and obsolete-path cleanup (implemented and locally verified)

Addresses requirements 7, 8, 9, 11, and 12, and completes requirement 3.

- [x] Share the exact standalone/batched Small glass recipe, including sampling and presence.
- [x] Preserve permanent two-pass blur and approved tint, brightness, rim, and shadow values.
- [x] Remove the 0.01px translateZ repaint nudge; separate bounded backdrop invalidation from
      geometry work and verify panel settlement/canvas-switch behavior in WebView2.
- [x] Remove motion calls into the parked registry; motion supplies presentation values without
      selecting material rendering strategies.
- [x] Remove unused production BackdropScene preparation and empty cached-registry machinery;
      retain comparison code only outside active production rendering.
- [x] Bring the New Canvas popup's separate frosted-glass path under the material boundary while
      preserving its appearance.
- [x] Inspect nested filters, masks, stacking contexts, paint containment, translateZ, and permanent
      will-change declarations. Remove only those whose removal preserves verified visuals.

Starting evidence: Small glass shares constants but duplicates filter/overscan implementations.
Both glass definitions already have permanent two-pass blur and no active interaction-only
preblur. The production provider creates no cached compositor runtime and native surfaces do not
register there, but App still prepares unused presentation data.

## Acceptance and verification record

- Camera-only frames: no App/static-chrome rerenders or persisted-snapshot construction.
- Translation-only material movement: no surface measurement, rim redraw, or material change.
- Geometry: at most one measurement per dirty element/shared viewport per frame.
- Visual parity: same viewport and content before/after; check pan, zoom, list scrolling, drag,
  settling, opening/closing, canvas switching, and reduced motion for each affected step.
- Original audit baseline: 40 tests passed across legacyCameraSynchronization, MaterialSurface,
  SharedSmallGlassPlane, CanvasBrowserRuntime, and CanvasManagerCards.
- Original audit limitation: Tauri MCP did not connect; attempted dev launch found Vite port 6969
  occupied. No visual parity, compositor-layer, or frontend-console claim was made.

Update each step and append concrete verification results as work is completed. Do not mark
visual acceptance complete based only on compilation or unit tests.

### Step 1 verification — 2026-09-05

Implementation entry points:

- `src/legacy/interactions/useLegacyInteractionSnapshot.ts`: stable React snapshot across camera-only
  publications; interaction/selection/document transitions continue to notify App.
- `src/legacy/interactions/useLegacyCameraPresentation.ts`: direct stage camera variables and
  selection presentation, inherited by the world, grid, and text-card/connection overlays.
- `src/legacy/interactions/LegacyCanvasVisibility.tsx`: local culling subscription without an extra
  DOM wrapper; refreshes the rendered subtree only when visible IDs change.
- `src/legacy/interactions/legacyCameraSynchronization.ts`: trailing settlement scheduling;
  App uses a 120ms delay and cancels pending persistence synchronization during active gestures.
- `src/App.tsx`: memoized Canvas Browser inputs from settled document state; snapshot, hit-testing,
  history-camera preservation, and autosave boundaries read the live controller camera.
- `src/components/Minimap.tsx`: viewport indicator and zoom label update imperatively without
  rebuilding the document projection.

The Tauri skill's live verification requirement led to testing both original and changed source
in the same MCP-enabled development window at 1310 x 712. Original source was temporarily restored
for the baseline and step 1 was then reapplied. The material recipe and CSS optics were not edited.

| Live measurement                                                           |     Original | Step 1 |
| -------------------------------------------------------------------------- | -----------: | -----: |
| App hook-state changes over 30 pan frames                                  |           30 |      0 |
| Canvas Browser input-array changes over those frames                       |           30 |      0 |
| getBoundingClientRect calls during those step 1 pan frames                 | not recorded |      0 |
| App / browser input changes over a settled 30-frame controller wheel burst | not recorded |  0 / 0 |

Additional checks:

- Actual wheel DOM events exercised the existing event handler and displayed the minimap; its
  label matched the live zoom and Reset zoom restored 100%. Opening/settlement transitions can
  still cause bounded App renders; continuous camera frames no longer cause per-frame renders.
- Panning far away culled two top-level articles to zero without an App render; cancellation
  restored both and the original camera.
- Selection rectangle stayed aligned through zoom. The connection overlay's computed transform
  included the existing canvas-content inset and followed the world camera.
- Switched canvases and returned; browser metadata and controller camera matched. Reading the
  snapshot getter during an unfinished pan returned that live camera, before settlement.
- Before/after settled screenshots were inspected: board, grid, toolbar, panel, and cards retained
  their appearance. A screenshot taken during panel entry was discarded from the comparison.
- No application errors occurred in the final interaction checks. One diagnostic keyboard event
  initially targeted `window`, causing existing `target.closest` handlers to throw; retesting from
  `document.body` resolved that test-injection error. It was not changed as a product issue.
- Typecheck, lint, architecture checks, and production build passed. Build retained its existing
  warning about a chunk exceeding 500kB.
- Focused regression set: **47 tests passed across 8 files**.
- Full frontend suite: **765 passed, 15 failed across 11 files**, plus 14 reported unhandled
  errors. Failures are in unchanged Extensions/toolbar/window/control contracts, Modals/Settings,
  UI-lab controls/material examples, and LiquidTabs (including missing jsdom `elementFromPoint`).
  These failures were recorded separately; unrelated implementation was not modified.

Screenshots and the complete JSON test report are archived locally at
`C:\Users\Merk\AppData\Local\Temp\TaskMap-glass-step1-20260905` (temporary artifacts, not committed).
Generated Rust capability/schema changes from the MCP build were restored. No commit or push.

### Step 2 verification — 2026-09-05

- `materialGeometryScheduler.ts` owns one native geometry ResizeObserver, shared resize/scroll
  listeners, dirty-work scheduling, and frame-local rectangle/style caches. Geometry reads precede
  writes; list owners run before their material consumers. This is geometry coordination inside
  the existing material boundary, not another renderer or the parked compositor registry.
- `nativeGlassGeometry.ts` retains the existing overscan and rim recipe. Rim keys use local border-box
  dimensions, radius, DPR, and brightness. Parent sampling refs resolve at frame time, including
  child-before-parent mount ordering.
- Canvas Browser supplies its already-known clipped card dimensions. Same-frame rim writes use
  cached optics and perform no measurements. Unchanged dimensions do not invalidate or redraw rims.
- Extensions supplies each card's local dimensions from its shared list read phase; repeated nested
  viewport reads use the same frame cache. Both lists release geometry work when inactive.
- Canvas Browser caches viewport height and reads panel/viewport drag spaces once before writes.
  Reconciliation and scrolling no longer read normal card screen rectangles; editor content size
  remains measured only at layout boundaries.
- Material DOM, CSS optical constants, clipping, presence, and drag reparenting were not changed.
  The clipped-slice topology remains for step 3; repaint-nudge/parked-path cleanup remains step 4.

Live MCP-enabled Tauri development checks (1326 x 721 initial comparison; resumed editor check at
1342 x 730):

- Before/after settled Canvas Browser and Extensions screenshots inspected; appearance retained.
- Thirty Canvas Browser wheel frames: **0 rectangle reads, 0 computed-style reads, 0 rim-size
  mismatches** after a fresh app reload.
- Thirty active card-drag frames: **0 card rectangle reads, 0 dragged-rim redraws**, and one
  panel plus one viewport rectangle read per frame (60 total). Cancellation restored order and
  the same host. Dragging and settled screenshots inspected.
- Extensions scroll burst: each of 13 cards and the shared viewport read once; shared boundary
  reads coalesced. No per-card material remeasurement.
- Full/minimal cards and editor/cancel exercised. All compact rims matched 40px card height;
  the resumed editor rim matched its 215px height. No content edits were saved.
- A discovered one-frame clipped-rim lag was corrected with owner-phase, measurement-free writes.
  HMR across intermediate API edits produced transient development errors; final fresh-launch
  checks reported no frontend errors or warnings.
- Focused camera/glass set: **88 passed across 15 files** before the additional Extensions timing
  assertion update. Full-suite results and validation caveats are recorded in WORK-LOG.
- Typecheck, lint, architecture checks, production build, Rust formatting, Clippy, and Rust tests
  passed (67 Rust tests, one ignored harness entry). Build retains the existing >500kB warning.
- No release-mode FPS, alternate-DPR, packaged-build, or whole-Phase-4.5 acceptance claim.

Artifacts: `C:\Users\Merk\AppData\Local\Temp\TaskMap-glass-step2-20260905`.
No commit or push. **Next step: Step 3 — Stable list topology and clipping.**

### Step 3 implementation and verification — 2026-09-05

- Added shared `GlassListFrame` framing and full-shape viewport intersection functions, using the
  existing Small glass planes. No new renderer or feature ownership migration.
- Canvas Browser hosts keep the same parent through activation, movement, cancellation, and snap.
  The existing settled/drag batch planes are permanently mounted in the same viewport; only mask
  membership and stacking change. Both retain the existing material recipe. Removed the temporary
  reparented drag wrapper and the competing cards-layer translation/stacking context.
- Scrolling retains full 84px/40px/editor material geometry. SVG viewport clips intersect the real
  rounded card instead of rounding a shortened visible slice. Content clips inside the rim;
  external effects have independent viewport clipping and horizontal shadow gutters.
- Main and Quick Extensions use the same framing/content/gutter pattern. Native list layout and
  nested clip rectangles are captured on layout invalidation; scroll-only frames project cached
  geometry using scroll offsets. The central scheduler distinguishes layout from scroll dirtiness.
- Intentional clipping corrections: partial cards no longer get artificial rounded slice edges;
  primary Extensions controls and side shadows are no longer cut off horizontally. Optical values,
  feature callbacks, presence timing, and scrolling/reorder behavior remain unchanged.

Live Tauri/WebView2 development checks at 1342 x 730:

- Inspected before/after Canvas Browser, primary Extensions, and Quick Extensions screenshots,
  including partial-card scrolling and active drag. Resumed checks used the user's current canvas
  content, so their captures are interaction evidence rather than pixel-identical baseline pairs.
- Canvas wheel scroll: **0 rectangle reads, 0 card rim redraws**, all seven cards remain 84px high.
- Thirty active drag frames: **0 card rectangle reads, 0 dragged-rim redraws**, same host parent and
  card subtree. Drag now reads only the shared viewport once per frame, not the panel as well.
- Main Extensions 140px native scroll and Quick Extensions 55px nested scroll: **0 rectangle reads**;
  mask positions changed correctly while original full card dimensions remained intact.
- Full/minimal (40px) and editor (215px)/cancel inspected; no content edits saved. Reduced-motion
  runtime override exercised drag/cancel: identical ancestry/subtree, immediate settlement, initial
  order restored. The override was restored; this was not a Windows preference toggle.
- Final frontend console: **no errors or warnings**. Tauri bridge version-report warning remains
  tooling-only; the existing development executable was used without changing bridge dependencies.

Validation:

- Focused final regressions: **51 passed across 8 files**, including reduced-motion cancellation.
- Full frontend suite before that final added test: **776 passed, 15 baseline failures**; unchanged
  failing test names from step 2. Existing LiquidTabs/jsdom `elementFromPoint` issue remains.
- Typecheck, lint, architecture, production build, and touched-file formatting pass. Full formatting
  still flags seven unrelated baseline files; the temporary test report is archived outside the repo.
- Rust formatting and CI's all-targets/all-features Clippy pass. All-feature tests: 66 passed, one
  ignored, process-tree termination failed under the sandbox; that exact test passed outside it.
  A default-feature Clippy attempt also found existing feature-gated dead code; use CI flags.
- No release-mode FPS, alternate-DPR, packaged-build, or whole-Phase-4.5 acceptance claim.

Artifacts: `C:\Users\Merk\AppData\Local\Temp\TaskMap-glass-step3-20260905`.
No commit or push. **Next step: Step 4 — Material parity and obsolete-path cleanup.**

### Step 4 implementation and verification — 2026-09-06

- `nativeGlassRecipe.css` owns the single permanent preblur/main optical formula for native
  standalone and batched glass, including presence interpolation and seed fill. Removed the batch's
  imperative filter construction and duplicated CSS formulas. Existing sampling geometry owners,
  tint/rim/shadow, rounded clips, and permanent drag topology remain unchanged.
- Removed the transform revision nudge. Real scene/style changes use native browser backdrop
  invalidation; settlement/canvas-switch requests refresh only the target sampling bounds through
  the central scheduler. No opacity/filter toggle, forced layout, or replacement repaint loop.
- App no longer prepares unused backdrop card collections, scene revision, projector closure, or
  presentation snapshots. Production composition creates neither cached registry nor presentation
  bridge. The existing provider is a compatibility composition boundary; parked source and the
  gated development Lab retain their reference APIs outside active production ownership.
- Removed parked-registry notifications from press springs, liquid indicators/toggles, toolbar
  transitions, and modal presence. Native geometry remains centrally size-observed; motion retains
  its own scheduler, DOM updates, timing, cancellation, and reduced-motion behavior.
- New Canvas now selects a frozen `frosted-popup` definition in the existing CSS material strategy.
  Its 4px blur, 0.94 fill, border, radius, shadow, placement, inputs, and presence are preserved.
  No feature-owned backdrop utilities, new rendering strategy, or broad App ownership refactor.
- Material architecture allowances moved from duplicated surface/batch filter declarations to the
  shared recipe; Canvas Manager's now-unused frosted/blur allowances were removed.

Layer audit decisions:

- Retained surface isolation and rounded clip promotion: these define the accepted two-pass
  backdrop/sampling and stacking behavior, not speculative per-card acceleration.
- Retained constant `translateZ(0)` on the shared recipe and outer clip planes, but no changing Z
  revision. Kept the documented single Large side-panel `will-change: backdrop-filter` stability
  hint; did not spread it to list cards. Slot-motion hints remain transient.
- Retained the 0.5px rim-softness filter and Opaque border mask: both are visible material optics.
  Native list cards' private preblur/main layers stay disabled at rest and during drag.
- No additional compositor, observers, clipping workaround, or feature-local repaint mechanism.

Live MCP Tauri/WebView2 checks (1342 x 1093):

- Fresh-process Canvas Browser, main/Quick Extensions, New Canvas, and Settings inspected;
  screenshots viewed. Current canvas content/camera changed across the interruption, so the final
  broad captures are not exact pixel-matched copies of the initial scene.
- Native standalone/batch filter values match exactly at presence 0, 0.5, and 1. At rest the Small
  passes are 5px and 23.5px with 0.78 saturation / 0.9 brightness / 1 contrast. Temporary inspection
  attributes/styles were restored afterward.
- Panel close/reopen and canvas switch/restore retain the 60px Large main pass without a revision
  property. Drag/cancel retains identical card subtree/parent and disabled private filter layers.
- Quick nested scroll remains measurement-free (55px scroll, zero rectangle reads). Settings
  enter/exit inspected; production contains no cached output plane.
- Simulated 20-frame pan/cancel moved the camera and restored it, with two bounded material reads
  across the whole gesture rather than per-frame work. Synthetic events required a temporary
  pointer-capture shim, restored afterward; the initial unshimmed attempt produced a capture error.
  This is controller/presentation evidence, not a physical-pointer or rendered-FPS benchmark.
- New Canvas computed filter/fill/border/shadow/radius exactly match baseline. A settled comparison
  temporarily reapplied the original CSS to the same DOM, captured it, then restored the new material;
  screenshots match apart from caret timing. Popup canceled without creating or editing a canvas.
- Intermediate HMR produced a stale-export error/blank page. Restarted Vite and the development app;
  final fresh-process console has no errors/warnings. Bridge version-report warning is tooling-only.

Validation: 264 focused tests across 37 files, plus 24 motion/Lab tests across 5 files, pass. Full
suite: **783 passed, the same 15 baseline failures**. Typecheck, lint, architecture, production build,
Rust formatting, all-feature Clippy, and Rust tests pass (67 passed, one ignored). Touched formatting
passes; six unrelated formatting failures remain. Existing large-bundle warning remains. No release
FPS, alternate-DPR, exhaustive media-under-glass, or packaged-build acceptance claim.

Artifacts: `C:\Users\Merk\AppData\Local\Temp\TaskMap-glass-step4-*.png` and
`TaskMap-glass-step4-tests.json` in that directory. No commit or push.

## Acceptance part 1 — Performance validation (paused for database integration)

On 2026-09-06 the user explicitly requested connecting the new database to the app first. Follow
`docs/DATABASE-INTEGRATION-PLAN.md` and ADR 004, then resume this acceptance work. Do not undo completed
glass changes or count database integration as release FPS/visual acceptance. Benchmark files remain
unloaded under the user's files-only restriction.

User-requested split on 2026-09-06. No new material implementation or ownership migration.

- [x] Confirm optimized production frontend build and development/MCP exclusion checks.
- [ ] Record machine, WebView2 version, display scale/refresh, viewport, build, and fixture identity.
- [x] Compare closed side chrome, Canvas Browser, and Canvas Browser + Quick Extensions under the
      same pan workload; separately record idle baseline and geometry work.
- [ ] Validate zoom, drag, and resize against the normal fixture using rendered frame evidence.
- [x] Separate browser callback pacing, application work, and actual presented frames. Development
      requestAnimationFrame measurements alone cannot close the release-mode 60 FPS gate.
- [x] Save reproducible measurements, limitations, and the next action. Do not change optical quality
      or replace the user's document to make the benchmark pass.

Development evidence and reproduction are in `docs/GLASS-PERFORMANCE-ACCEPTANCE.md`: three 300-sample
pan trials per chrome state and one idle trial each, with zero steady material rectangle reads/rim
redraws and camera restoration throughout. Seven probe cleanup tests and 33 hot-path tests pass.
Machine/UA/viewport metadata is recorded, but exact WebView runtime patch and normative fixture/release
identity remain unverified. Part 1 is **partial**, pending isolated full fixture and external release
presented-frame capture for pan/zoom/drag/resize. No production rendering changes in this pass.

Files-only continuation: `docs/GLASS-BENCHMARK-FILES.md` records a prepared 25-canvas/2,000-element
document and 582,508,631-byte WebP/GIF corpus, all decoded/hashed offline. User explicitly chose
**prepare benchmark files only** instead of providing an isolated Windows account/VM. No fixture
import or release launch. Actual loading and presented-frame acceptance remain pending; do not load
the current profile or bypass the legacy portable-size/keyring constraints to finish the benchmark.

## Acceptance part 2 — Broader visual and behavior acceptance (not started)

- [ ] Compare retained optics/clipping across normal and alternate DPI/viewport configurations.
- [ ] Exercise pan/zoom, scrolling, drag/snap/cancel, editor, modal/panel presence, reduced motion,
      and canvas switching with representative still images/GIFs behind glass.
- [ ] Inspect stable/development packaged builds, screenshots, logs, and layer/stacking behavior.
- [ ] Reconcile the baseline test backlog separately and decide which Phase 4.5 gates can actually
      close. No implicit Phase 5 migration or broad App refactor.

The four implementation steps are locally complete. Acceptance part 1 is paused for the database
integration intermission; part 2 remains
separate. Phase 4.5 stays open until its actual validation requirements are met.
