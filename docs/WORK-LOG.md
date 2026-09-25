# TaskMap Refactor Work Log

> Chronological working memory for the refactor.
> This file is intentionally more detailed and less polished than `docs/REFACTOR-STATE.md`.
> It records experiments, problems, measurements, reversions, and decisions that may matter later.
> It is not an authority over `AGENTS.md`, `ARCHITECTURE.md`, ADRs, or `docs/REFACTOR-ROADMAP.md`.

## How to use this log

Append one entry after a meaningful implementation/review cycle.

Useful fields:

- date;
- phase/slice;
- commit(s);
- goal;
- what actually changed;
- manual observations;
- failed/reverted approaches;
- measurements;
- decisions;
- follow-ups;
- documentation changed.

Do not clean old entries into a false success narrative. If an experiment failed, preserve why it failed.

Hypotheses must be labelled as hypotheses until verified.

---

## 2026-08-29 — Documentation workflow bootstrap and state audit

**Branch:** `architecture-v1`  
**Audited HEAD:** `b21fea6069cc031bb0c4700266aed19f98914502` — `Refine Quick Extensions UI`  
**Roadmap position:** Phase 4.5C active

### Why this audit was done

Long refactor conversations were beginning to depend too much on chat memory. The goal was to make the repository itself carry enough current context that a fresh ChatGPT/Codex session can determine:

- where the refactor is;
- what rules are authoritative;
- what was just attempted;
- what remains;
- what documentation must be updated after a task.

### Existing documentation structure confirmed

The repository already has strong authoritative documents, so the workflow should adapt to them instead of creating competing replacements:

- `AGENTS.md` already defines mandatory agent/repository rules.
- `ARCHITECTURE.md` already defines the normative target architecture.
- `docs/REFACTOR-ROADMAP.md` already owns phase ordering and gates.
- `docs/FEATURE-WIRING.md` already includes per-feature documentation/performance/review requirements.
- foundational decisions already live under `docs/decisions/`; a new generic `DECISIONS.md` would duplicate the ADR system.
- `docs/CODEMAP.md` already owns structural mapping.

Decision: add only the missing operational/session layer:

- `docs/AI-WORKFLOW.md` — stable process for AI-assisted sessions;
- `docs/REFACTOR-STATE.md` — clean current snapshot;
- `docs/WORK-LOG.md` — chronological dirty/history layer.

### Roadmap status confirmed

Phases 1–4 have their core implementation accepted according to the roadmap.

Phase 4 intentionally leaves the release-mode rendered FPS checkbox open until the final Phase 4.5 rendering path is accepted.

Current work remains in Phase 4.5:

- 4.5A complete;
- 4.5B core complete with image/GIF fidelity acceptance still open;
- 4.5C active;
- 4.5D cleanup/acceptance still open.

General Phase 5 element ownership migration should not begin accidentally while 4.5 is still open.

### Database clarification

The Phase 2 secure database/session infrastructure exists, but the finished production database-management UI is intentionally later.

The roadmap explicitly places database picker/recent-files product integration in Phase 8. Other production shell items such as tray UX and config import/export are also deferred.

This distinction should be preserved in future explanations so "no database picker UI yet" is not mistaken for "the database refactor disappeared."

### Recent implementation checked

HEAD `b21fea6` modernizes Quick Extensions:

- real acrylic shell;
- shared small/minor glass list plane;
- shared SearchField and Tooltip;
- production extension-card language;
- menu presence handling.

It remains an active 4.5C refinement area rather than a fully accepted slice.

### Quick Extensions issues discovered during refinement

Known follow-ups:

- scroll bounds can cut material geometry/shadows in ways that expose incomplete material/content separation;
- desired extension drag representation has not yet been completed as the compact glass-token interaction;
- keep source cards reusable and avoid turning the drag effect into a generic global morph framework.

### Performance investigation

Manual development-build observations recorded during canvas panning:

- with most side chrome hidden: roughly 360 FPS;
- Canvas Browser visible: roughly 154 FPS;
- Canvas Browser + Shift+E visible: roughly 107 FPS.

Additional isolation:

- a large animated GIF can update beneath translucent glass without causing the same slowdown when the canvas is stationary;
- Major blur-radius changes from approximately 0 to 100 px did not materially change the pan result.

Interpretation:

- evidence does not currently support "blur radius alone is the bottleneck";
- the expensive condition is strongly associated with viewport/canvas movement while more application/material UI is present.

Code inspection identified likely contributors that require proper profiling rather than assumption:

- high-level `App.tsx` subscription/rerender work on viewport changes;
- Canvas Browser receiving/recomputing camera-dependent data;
- transient camera updates touching unrelated legacy orchestration;
- floating/static UI potentially rerendering because the root rerenders;
- WebView2 recomposition of a moving large canvas beneath fixed acrylic.

The current FPS overlay is development-only, so final acceptance must be repeated in an appropriate production-performance build before making visual compromises.

### Workflow decision

From this point forward, a normal task cycle is:

1. read the workflow/state/roadmap;
2. inspect relevant current code;
3. choose one roadmap-safe task;
4. implement;
5. inspect the actual diff/commit;
6. validate;
7. append this log;
8. rewrite `REFACTOR-STATE.md`;
9. update roadmap/CODEMAP/parity/ADR/normative docs only when their actual responsibility changed.

This is now the intended anti-drift loop.

---

## 2026-08-29 — Native-glass documentation reconciliation

**Phase/slice:** Phase 4.5C documentation reconciliation  
**Repository/docs baseline HEAD:** `71c5a93ae56ab054031bd85a9802d44945826953` — `Add refactor workflow and state tracking docs`  
**Implementation audited through:** `b21fea6069cc031bb0c4700266aed19f98914502` — `Refine Quick Extensions UI`  
**Goal:** Reconcile lower-level migration/wiring/state docs with the accepted ADR 003 native CSS
glass production decision without rewriting the historical Phase 4.5B cached-compositor work.

### What changed

- Reworded Phase 4/4.5 acceptance language so current production acceptance targets the active
  `MaterialSurface`/native-glass path rather than the superseded cached compositor.
- Preserved 4.5B as the completed proof of the cached Canvas2D compositor, worker/fallback,
  `BackdropScene`, cache scheduling, and associated deterministic coverage.
- Marked the incomplete cached-compositor image/GIF fidelity follow-up as historical and no longer a
  production gate unless that strategy is deliberately reconsidered.
- Updated `FEATURE-WIRING.md` so new production features target native `MaterialSurface` sampling,
  overscan/rim geometry, and shared Small batching instead of the parked cache/worker interfaces.
- Updated `REFACTOR-STATE.md` to distinguish repository/docs baseline HEAD from the implementation
  commit actually audited.

### Reconciliation basis

ADR 003 and `docs/VISUAL-SYSTEM.md` already agree on the authoritative current decision:

- Acrylic Large/Small use live native CSS glass through `MaterialSurface`;
- the cached Canvas2D compositor is superseded for production and parked for rollback/reference;
- native production surfaces do not register with or rebuild the cached compositor.

No contradiction was found between those two authoritative documents, so neither was changed.

### Status / scope

- No code changed.
- No roadmap phase ordering changed.
- No roadmap completion checkbox changed except wording around the superseded cached-compositor
  production gate; the historical unchecked media-fidelity follow-up remains unchecked.
- No CODEMAP update is required because no source file, subsystem, or ownership boundary moved.

### Follow-up

Continue Phase 4.5C from the reconciled native-glass production boundary. The smallest implementation
task remains the local Quick Extensions material-backed scrolling correction before unrelated
migration work is opened.

---

## 2026-09-05 — Glass plan steps 1–2: camera isolation and geometry ownership

**Phase/slice:** Local Phase 4.5C performance follow-up; no Phase 5 ownership migration.

**Commit(s):** Uncommitted work on `architecture-v1`, HEAD `21599ec92551ed4605dc8737353f1cd9dad3a839`.

**Goal:** Preserve optics/behavior while removing frame-frequency App and duplicate geometry work.

### Implementation and measurements

- Step 1 isolates camera-only React snapshots, presents stage/minimap camera values directly from
  the interaction controller, and keeps Canvas Browser/persisted inputs out of pointer frames.
- Step 2 shares native geometry observation and read/write scheduling. Native surfaces use local
  dimensions for rim keys. Canvas Browser supplies known card sizes; Extensions supplies dimensions
  from its one list read pass. Scroll/drag no longer trigger duplicate card material measurement.
- The runtime reads panel/viewport drag spaces once before writes and caches viewport height.
- Tauri development baseline/after screenshots at 1326 x 721 retained Canvas Browser and Extensions
  appearance. Across 30 wheel frames: zero rectangle reads, computed-style reads, or rim-size
  mismatches. Across 30 card-drag frames: zero card reads/rim redraws, one panel and one viewport
  read per frame. Cancellation restored order and the same host.
- Extensions scroll read each of 13 cards once and shared its viewport rectangle. Full/minimal
  cards and editor/cancel were exercised. After the interruption, the existing MCP build was
  restarted; the editor at 1342 x 730 had matching 215px DOM/rim height. No edits were saved.
- These are development hot-path counts, not release-mode FPS acceptance or alternate-DPR parity.

### Problems resolved and validation

- Parent sampling refs can attach after a child layout effect; resolve them when geometry runs.
- Deferring an owner-supplied clipped size to the next frame caused a rim-size lag. Returning a
  measurement-free write using cached optics fixes it in the owner's existing write phase.
- Intermediate HMR API edits caused transient errors/stale subscriptions. Fresh-launch final checks
  had no frontend errors or warnings; no production error remained in the exercised states.
- Existing component tests assuming synchronous geometry were changed to await a shared frame.
- Focused camera/material tests: 88 passed across 15 files. Final full frontend run: **771 passed,
  15 failed**. The remaining failures match step 1's unchanged Extensions/toolbar/window contracts,
  Settings/Modals, UI Lab material/controls, LiquidTabs, and visual contracts; no unrelated fix was
  attempted. Full report is archived with the screenshots.
- Typecheck, lint, architecture checks, production build, and diff whitespace checks passed.
  Build retains the existing >500kB chunk warning.
- Rust formatting and all-feature/all-target Clippy passed. Rust tests: **67 passed, 1 ignored**
  (the child-process harness entry); no Rust source changes.
- Whole-repo formatting initially reports 10 existing files. Touched documents are formatted on
  handoff; unrelated formatting in AI-WORKFLOW, roadmap, ContextMenus, QuickExtensions CSS, UI Lab,
  MaterialSurface CSS, FloatingCanvasToolbar, and forms CSS is not swept into this task.

### Handoff

- Updated GLASS-IMPROVEMENT-PLAN, REFACTOR-STATE, CODEMAP geometry entries, and VISUAL-SYSTEM's
  geometry ownership wording. No foundational decision or roadmap acceptance gate changed.
- Screenshots/test report: `C:\Users\Merk\AppData\Local\Temp\TaskMap-glass-step2-20260905`.
- Step 3 remains: stable list ancestry and separated material/content/effect clipping. Step 4
  remains: recipe consolidation, repaint nudge removal, motion/cached-path cleanup. Current sliced
  geometry and drag reparenting intentionally remain unchanged in step 2.
- No commit/push. Full Phase 4.5 acceptance remains open, including baseline failures and packaged
  release-mode visual/FPS validation.

---

## 2026-09-05 — Glass step 3: stable topology and full-card clipping

**Phase/slice:** Local Phase 4.5C follow-up, user glass plan step 3.

**Commit(s):** Uncommitted, on `architecture-v1` at `21599ec`; steps 1–2 preserved.

### What changed

- Shared `GlassListFrame`, full rounded-shape intersections, content masks, and external shadow
  gutters now frame Canvas Browser, main Extensions, and Quick Extensions without a new renderer.
- Canvas drag no longer reparents hosts or creates a temporary wrapper. Permanent existing batch
  planes stay in one viewport; host translation uses one CSS variable and the same material subtree.
- Material dimensions stay full during partial scrolling. Nested SVG viewport clips preserve true
  round corners; native Extensions scrolling projects cached layout using offsets without measuring.
- Central geometry dirtiness distinguishes layout/scroll; layout wins when both arrive together.
- Extracted the Canvas runtime test fixture to keep the test below the architecture size limit.

### Problems / observations

- Zero default effect insets initially clipped each card's own shadow; corrected to signed viewport
  insets. Native scroll gutters prevent horizontal clipping of primary Extensions actions/shadows.
- Preserved both existing Small batches for drag layering. Recipe consolidation and repaint hacks
  intentionally remain step 4; there is no motion-dependent material topology change in this slice.
- Default-feature Clippy reports pre-existing gated dead code. CI all-feature Clippy passes.
  Rust process-tree termination failed under sandbox restrictions and passed on an exact unsandboxed
  rerun. Validation-generated capability schema changes were reverted; no Rust source changed.

### Verification / measurements

- Tauri UI skill used for real before/after inspection, scrolling, drag, compact/editor/cancel, and
  final screenshots. At 1342 x 730, Canvas scroll recorded zero rectangle reads and zero rim draws;
  main 140px and Quick nested 55px scrolls recorded zero rectangle reads with masks moving correctly.
- Thirty drag frames retained parent/subtree, with zero card measurements/rim draws. Only one shared
  viewport read remains per drag frame. Reduced-motion runtime override/cancel restored initial order
  and retained ancestry; restored override afterward. No user content edits saved.
- Inspected final screenshots; final console has no errors/warnings. Later captures use current user
  canvas content, so are not exact content-matched baseline comparisons. No release FPS/DPR claim.
- Focused final set: 51 tests / 8 files pass. Full frontend suite: 776 pass / same 15 baseline failures
  before the last added reduced-motion test (which passes in the focused run). Baseline jsdom
  LiquidTabs `elementFromPoint` error remains. Typecheck/lint/architecture/build/touched format pass.
- Rust fmt/all-feature Clippy pass; 66 tests passed, one ignored, one sandbox taskkill failure that
  passes outside the sandbox. Full format retains seven unrelated existing file failures.
- Screenshots/report: `C:\Users\Merk\AppData\Local\Temp\TaskMap-glass-step3-20260905`.

### Decision / follow-up

Step 3 is implemented and locally verified. Continue with step 4 (exact standalone/batched recipe,
bounded explicit repaint, motion/parked-path cleanup, layer audit), not Phase 5 or broad App splitting.
Updated GLASS-IMPROVEMENT-PLAN, REFACTOR-STATE, CODEMAP, and the list topology/clipping contract in
VISUAL-SYSTEM. Roadmap phase gates and retained feature behavior were not changed.

---

## 2026-09-06 — Glass step 4: one optical recipe and production parked-path exclusion

**Phase/slice:** Local Phase 4.5C follow-up; user glass plan step 4. No commit/push.

- Consolidated native preblur/main filter and presence formulas in `nativeGlassRecipe.css`, removing
  batch inline filter assembly. Static material values and geometry owners remain unchanged.
- Removed the Z-revision repaint nudge, not replaced by an opacity/filter toggle or forced layout.
  Browser scene/style changes invalidate native backdrops; explicit settlement requests are bounded
  sampling-geometry refreshes. Retained documented fixed clip promotion and one side-panel stability
  hint, plus optically necessary isolation, rim softness, and Opaque border masks.
- Removed App's unused BackdropScene preparation and production registry/bridge allocation. Existing
  compatibility provider now passes children through. Only the gated Lab creates the parked bridge.
  Motion/press/liquid/toolbar/modal code no longer calls the parked geometry registry.
- Frozen New Canvas 4px/0.94 finish moved to `frosted-popup` in the existing CSS material strategy.
  This preserves pixels and behavior without introducing a new renderer or feature-owned blur path.
  Architecture allowlists were narrowed/moved to the material recipe's actual ownership.
- Added production exclusion, shared-recipe, and popup regression tests; updated only assertions
  whose registry calls/CSS locations were deliberately changed. Baseline failures left untouched.

Verification: 264 focused tests / 37 files plus 24 motion/Lab tests / 5 files pass; full frontend
783 pass / same 15 baseline failures. Typecheck/lint/architecture/build/Rust fmt/all-feature Clippy
pass. Rust tests: 67 passed, one ignored. Touched formatting passes; six unrelated files still fail
full format. Large-bundle warning remains; production main JS reduced from approximately 637kB to
625kB before final minuscule diagnostic cleanup (build-size evidence, not a runtime FPS claim).

Tauri skill used for actual app checks at 1342 x 1093: panel reopening, canvas switch/restore,
drag/cancel, main/Quick lists, Quick nested scroll (zero rectangle reads), popup cancel, and Settings
presence. Standalone/batch computed filters match at presence 0/.5/1. Drag retains parent/subtree and
private filters stay disabled. Popup finish matches exact baseline computed values; settled original
CSS was temporarily reapplied to the same DOM for visual comparison, then restored. Screenshots
inspected. No document content edited or canvas created. Active canvas restored after switch check.

Additional simulated 20-frame pan/cancel moved/restored the camera with two material reads over the
whole gesture. An initial synthetic-event pointer capture failed; a temporary capture shim allowed
the controller test and was restored afterward. This does not replace physical-pointer/FPS testing.

HMR during shared-module edits produced stale-export/blank-page errors. On interruption, the app and
server stopped; restarted only the task's dev server/app and verified a fresh process with no frontend
errors/warnings. The old bridge version-report warning is tooling-only. Do not count intermediate
blank screenshots as visual evidence. Current canvas/camera changed across interruption, so broad
before/final scenes are not pixel-identical. Final artifacts are `TaskMap-glass-step4-*.png` and
`TaskMap-glass-step4-tests.json` under `C:\Users\Merk\AppData\Local\Temp`.

Updated GLASS-IMPROVEMENT-PLAN, REFACTOR-STATE, CODEMAP, VISUAL-SYSTEM. All four local implementation
steps are complete, but release FPS, alternate-DPR/packaged/media acceptance, and Phase 4.5 remain
open. Next is combined acceptance/performance measurement, not broad App refactoring or Phase 5.

---

## 2026-09-06 — Split glass acceptance; part 1 development performance evidence

**Phase/slice:** Phase 4.5, glass acceptance part 1 (partial). No Phase 5 work.
**Commit(s):** Uncommitted on `21599ec92551ed4605dc8737353f1cd9dad3a839`.
**Goal:** User requested splitting the next step into two and resuming the first.

Separated performance validation from broader visual/behavior acceptance in the glass plan. Added
`scripts/glass-pan-probe.mjs` and seven tests for bounded samples, idle, pan cancellation, and cleanup
on failure. This is an explicit development diagnostic, not app instrumentation or a renderer.
No production source, appearance, saved document content or material constants changed in this pass.

Connected to actual MCP Tauri development app with the required UI skill. Compared closed chrome,
Canvas Browser, and Browser + Quick Extensions: three 300-callback pan trials and one idle trial per
state. All had zero steady `[data-material]` rectangle reads/native rim clears. All pans moved and
restored the camera. Mean callback intervals ranged 8.787–10.287ms during pan, versus ~2.778ms idle;
dispatch means 0.046–0.053ms. These are short synthetic **debug callback/dispatch** measurements,
not presented frames, total CPU cost, or release FPS. Focus was false, document visible, DPR 1,
1342 × 1093 viewport, existing seven-canvas document. Hardware, per-trial results and limitations
are saved in `docs/GLASS-PERFORMANCE-ACCEPTANCE.md`.

The awaited bridge timed out while the first async probe continued. Early timing samples overlapping
formatting/lint were discarded. HMR cleared globals once; reimported after edits settled and reran
the retained comparison without concurrent tooling. Scoped synthetic pointer-capture shim and all
global wrappers restored; cancellation does not commit the gesture. Contrary to an initial reading
of outside-click handling, middle-button pan retains Quick Extensions (left-button outside press
dismisses it). Verified this in the live DOM and included the three-state comparison. Restored original
Browser-open/Extensions-closed/Quick-closed UI and removed temporary result globals. Screenshots
before/after/restored inspected; final console error/warning checks empty. Tool bridge version-report
warning only. Local screenshots are `TaskMap-glass-acceptance1-*.png` under the user Temp directory.

Optimized frontend build/typecheck, production/MCP exclusion, lint and architecture checks pass;
33 focused hot-path tests and seven diagnostic tests pass. Existing large-bundle warning remains.
Prior step-4 full matrix (783 pass / 15 baseline failures; Rust 67 pass / one ignored) not rerun here;
no phase gate closed. Targeted formatting checked separately from known unrelated baseline failures.

Release acceptance remains open: normal fixture contract requires 25 canvases/2,000 elements/500 MB
mixed media; existing generator produces one canvas and image placeholders. Did not load a substitute
fixture over user data. Release lacks MCP intentionally (`debug_assertions` gate); no release exe in
checked default path and no presented-frame capture performed. Next smallest work is an isolated
normative fixture plus external release capture workflow, not another material rewrite. Part 2 has
not started. Updated plan, performance report, REFACTOR-STATE, CODEMAP and this log. No commit/push.

---

## 2026-09-06 — Offline full-media benchmark preparation (files only)

**Phase/slice:** Glass acceptance part 1, preparation only; part 2 not started.
**Commit(s):** Uncommitted on `21599ec92551ed4605dc8737353f1cd9dad3a839`.

Resumed after verifying that the app's history reader was stale relative to the saved repository work.
Reran the previously interrupted 40-test hot-path/probe set successfully. Investigated full-fixture
loading before touching app state: active legacy storage still shares a constant keyring service/user
across editions; portable import caps encoded payloads at 512 MiB, less than a 500 MB corpus after
double base64 expansion. Did not change the keyring, encryption, importer limits or debug-only bridge.
Asked about an isolated account/VM; user explicitly chose **prepare benchmark files only for now**.

Added offline `scripts/generate-glass-benchmark.py` with seeded, lossless WebP stills and actual
multi-frame GIFs, no padding or external media. Prepared Git-ignored `fixtures/glass-normal-v1/`:
25 canvases, 2,000 elements (80 per canvas), 450 WebP stills, 50 GIFs, **582,508,631 media bytes**.
All assets have unique SHA-256 IDs referenced by the document, with a versioned manifest. Required
search/checkbox/privacy/lock/color extensions are represented; no executable commands. Tiny smoke
fixture is separate. Existing single-canvas baseline generator remains untouched. Document schema is
the active v2 compatibility schema; required removed-feature booleans remain disabled, not new features.

Generator refuses existing output directories; verifier hashes/decodes all assets and all 1,050 frames,
checks metadata, byte budget, exact document layout and references. Six Python tests cover deterministic
codecs, real changing GIF frames/timing, layout, overwrite protection, undersized-corpus rejection and
tampering. Four generated-fixture tests check the actual production TypeScript schema and references;
initial jsdom URL/path mismatch caused them to skip, then fixed filesystem paths and confirmed all four
pass with zero skips. Temporary-folder sandbox restrictions required a test-only escalation. A tuple/
JSON-list comparison in the manifest test was corrected; final six Python tests pass.

Full corpus offline verification passes; TypeScript, lint and architecture pass. Combined targeted
frontend validation includes the existing 40 tests plus four artifact tests. No full-suite/Rust rerun
or phase closure: no production or Rust source changed in this files-only pass. The prior 15 baseline
frontend failures remain separate. Targeted formatting and regenerated CODEMAP checked.

Producer versions: Python 3.12.14, Pillow 12.3.0, libwebp 1.6.0. Checksums, workload distribution,
commands and isolation/loading constraints are in `docs/GLASS-BENCHMARK-FILES.md`. Synthetic high-entropy
media is repeatable workload, not natural-media visual acceptance. Corpus has not been loaded through
Rust or rendered in TaskMap; manifest acceptance flags remain false. Tauri bridge status was disconnected;
did not launch or modify the app, inspect new screenshots, or claim new live visual verification.

Next requires explicit availability of isolated Windows-account/VM storage and a bounded Rust-owned
loading workflow that respects per-image validation without the monolithic portable-size issue. Only
then package and capture release presented frames externally. User's current restriction is files-only;
do not infer permission to load their current profile on the next resume. Updated plan, performance
report, REFACTOR-STATE, CODEMAP, this log, and generated-output ignore rules. No commit/push.

---

## 2026-09-06 — Database activation intermission, step 1

**Phase/slice:** User-requested database integration intermission; glass acceptance paused.
**Commit(s):** Uncommitted on `21599ec92551ed4605dc8737353f1cd9dad3a839`.

User explicitly requested connecting the new database system to the real app, with an intermission
plan followed in steps, then returning to glass. Created `DATABASE-INTEGRATION-PLAN.md` (six steps)
and ADR 004, and revised the roadmap/state to authorize this narrow reprioritization rather than
silently starting all of Phase 5. Existing legacy database/keyring are not to be converted, reset or
overwritten; fresh current-version databases first. Old-data conversion remains standalone migrator
work. Benchmark permission remains files-only.

Audit confirms the new backend, normalized store, commands/history and autosave coordinator already
exist, but production AppShell mounts legacy App outside the normalized provider; default store has
no persistence dependency. Development client/harness commands are deliberately development-only.
The current renderer consumes legacy arrays/hash image IDs, while new schema uses normalized entities
and opaque media IDs. Activation therefore needs explicit view/command, lifecycle and media wiring,
not an IPC name swap or opaque legacy AppData in the new payload. AppShell stays composition-only.

Step 1 adds `src/app/database/createDatabaseWorkspace.ts`: injects the existing client save method
into the existing store/coordinator and admits confirmed current documents. Checks session phase,
presence of session identity, matching database/schema/revision, edition purpose and recovery metadata;
rejects occupied workspaces without cancelling their pending save. Load is clean with no history/save;
named commands use existing history and expected-revision autosave. Recovery content keeps the active
backend revision and is not auto-written merely by admission. Errors are sanitized.

This is supporting code **not imported by AppShell or activated in production**. No new IPC, crypto,
schema format, Rust storage changes, second persistence engine or live user-data writes. The step-2
lifecycle owner must handle pending operations/epochs, busy/edit guards, dirty flush, cleanup after
admission failure, lock/close/quit and scoped application capabilities before activation. Plan's
later cutover removes old startup/load/save/media wiring together; no dual writers.

Validation: 24 new tests; 71 combined database/workspace/persistence/platform/camera tests pass.
Initial mock function lacked an argument type and caused a typecheck error; fixed its DatabaseClient
signature. Full frontend: **818 pass / 15 baseline failures**, with 14 known jsdom elementFromPoint
uncaught errors in old controls/Settings tests. No new database test failures. Typecheck, lint,
architecture (364 target files), optimized build and production exclusion checks pass; production
bundle retains the prior index hash because support is unmounted. Existing large-bundle warning.
Rust fmt, all-target/all-feature Clippy and all-feature tests pass (67 pass / one ignored). No Rust
source or generated-schema diff after checks. Full phase/parity/security closure is not claimed.

Formatting also found the earlier Python-generated benchmark manifests (changing their formatting
would invalidate recorded checksums). Added only the two generated fixture directories to the formatter
ignore list, consistent with their Git exclusion; source generators/tests remain checked. The unrelated
AI-WORKFLOW, ContextMenus, UiLabApp, FloatingCanvasToolbar and forms.css style failures remain untouched.

Read the Tauri UI skill for subsequent visible work; this step changes no UI, and no new live Tauri
interaction, screenshot or console verification was performed. Existing visuals/data left untouched.
Updated plan, ADR, roadmap, REFACTOR-STATE, glass pause marker, CODEMAP and this log. Next: database
intermission step 2, not glass performance or old-data migration. No commit/push.

---

## 2026-09-07 — Database intermission step 2a: session lifecycle support

**Phase/slice:** Database activation intermission; glass remains paused.
**Commit(s):** Uncommitted on `21599ec92551ed4605dc8737353f1cd9dad3a839`.

Resumed from the saved plan and current implementation. Split step 2 into lifecycle support (2a)
and scoped platform activation (2b). Keeping permissions unchanged while proving transition guards
is intentional; this is not a completed production database switch.

Added `createDatabaseSessionController` above the step-1 workspace seam. It reconciles startup status,
creates canonical documents with existing factories, opens locked candidates, admits confirmed unlocks
and resumes keeper sessions. One lifecycle owner serializes transitions and carries cancellation
epochs; commands/undo/redo in the existing workspace now accept an optional edit guard (default true
for unchanged callers). Existing autosave performs flush/retry, with post-flush dirty/error checks.
Ordinary failed saves or revision conflicts prevent lock/close/quit and retain unsaved edits. Window
close preparation only flushes; native close delivery remains unwired. No second store/save engine.

Cancellation/disposal immediately clear workspace/history and invoke a required synchronous resource
purge hook, then drain pending lifecycle work and confirm backend close before reopening. Admission
rejection and uncertain lock cleanup close the candidate. Failed cleanup leaves the controller blocked.
Idle autosave session-locked/not-open errors revoke stale access without waiting for a user transition.
Review caught reentrant cancellation during workspace admission; added an epoch check after load and
a regression test so a subscriber cannot cancel then receive a republished unlocked state. Throwing
snapshot observers cannot interrupt cleanup. Passwords are transient call arguments, not state/logs;
operation errors retain safe codes, not raw backend details. JS cache revocation is not a claim of
byte-level memory zeroization. Rust key lifecycle remains unchanged.

The controller keeps related transition invariants in one cohesive module (~280 nonblank lines), with
fresh-document request construction separate; no generic state engine or new rendering abstraction.
27 new mock-only tests cover successful flows, failed saves/locks/close/purge, retry, pending/mismatched
resume, double actions, transition edit guards, late unlock, disposal, observer exceptions and autosave
session loss. Combined database/workspace/persistence/platform/camera suite: **98 pass**. Full frontend:
**845 pass / 15 previously recorded baseline failures**, plus the same 14 jsdom elementFromPoint errors.
Typecheck, lint, architecture (370 target files), optimized build and production exclusion checks pass.
Build still reports the existing large-chunk warning; index-BYWNeLiE.js is 625.30 kB (the optional edit
guard changes shared store code, though the lifecycle controller is not mounted).

Rust fmt and all-target/all-feature Clippy pass. Initial sandbox Rust suite: 66 pass / one failure /
one ignored; existing process-tree test could not taskkill its own child. Approved isolated rerun
passed, followed by full approved suite **67 pass / one ignored**. No Rust source/schema changes.
Touched formatting, diff whitespace and generated CODEMAP checks pass. Full formatting still flags
the same five unrelated files (AI-WORKFLOW, ContextMenus, UiLabApp, FloatingCanvasToolbar, forms.css).

No actual app launch, user database/keyring access, benchmark import, UI or crypto change. All database
responses in new tests are mocks. The resource hook still needs real view/interaction/media wiring;
automatic OS/inactivity lock delivery and production UX remain steps 4/5. No live visual, security or
feature-parity closure claimed. Existing dirty glass work preserved. Updated plan/state/roadmap/CODEMAP
and this log. Next: step 2b scoped application capabilities/client; do not expose all Phase 2 commands
or mount the new workspace beside an active legacy writer. No commit/push.

---

## 2026-09-07 — Database intermission step 2b: scoped native connection

**Phase/slice:** Database activation intermission, step 2b complete locally; app cutover pending.
**Commit(s):** Uncommitted on `21599ec92551ed4605dc8737353f1cd9dad3a839`.

Resumed the saved step-2b task. Promoted the existing native database implementation to explicit
`app_*` handlers and added the local-main-window `application-database` capability with exactly 15
operations: current-format lifecycle/read/save/full backup, tokenized picker/recent list and native
edition metadata. Both product configs select it; UI Lab does not, and its builds are independently
denied at runtime. Unknown identifiers fail closed. Stable maps to production purpose and development
maps to development purpose. Existing `phase2_*` aliases moved to a development-feature-only module,
retain their development-identifier guard and delegate to the same implementation. No parallel
storage engine, broad permission, media byte-array command or release MCP grant. Existing hidden
content-free keeper/edition-local recent settings are reused under their historical names, not migrated.

Extracted the existing frontend validation/confirmation logic into `createValidatedDatabaseClient`,
shared by harness and application transports. Confirmation now checks phase/session/revision/envelope
identity and recovery metadata, not just schema/purpose. The application factory reads native edition
before constructing clients. `createTauriDatabaseSessionController` connects those clients to the
existing lifecycle/workspace/persistence owner on explicit construction; **AppShell does not import
or mount it**. Importing the module performs no IPC or file open. Tokenized settings are returned for
later picker UX. Existing App startup/load/save/media/keyring calls are intentionally not switched yet.

Review identified a pre-existing save identity check outside the backend session mutex. Moved the
check into the write operation and bound requests to both database ID and the confirmed/read session
ID. Password unlock rotates session identity; tests prove stale requests cannot write a reopened or
re-unlocked database at the same revision. Revision checks, Rust-owned encryption/envelope validation
and TypeScript-owned domain schema remain unchanged. Requests reject unknown fields; raw size checks
and one-use process/edition/kind-bound path tokens are preserved. The unchecked internal save helper
is now test-only; renderer save commands use the checked path.

During iteration, fixed a mechanical guard rename missed at call sites, a test using unsupported
Array.at, and an architecture check that caught a Tauri import in an application test. Moved that
transport integration test under platform rather than relaxing the dependency rule. No production
architecture allowlist was expanded.

Verification: **16 new frontend tests**, with **110 focused** database/workspace/persistence/platform/
harness tests passing. Full frontend **861 pass / the same 15 baseline failures**, plus the same 14
jsdom elementFromPoint errors. **Five new Rust tests**; default and all-feature suites each **72 pass /
one ignored**. Rust formatting and Clippy pass for default, all features and ordinary phase2-development.
Typecheck, lint, architecture (376 target files), stable and harness frontend builds, and production
inspection pass. Added explicit application capability/handler scope checks to production inspection;
old harness/MCP exclusion checks remain enabled. Stable output restored after testing the harness;
index-BYWNeLiE.js remains 625.30 kB with the existing chunk warning because new app composition is unused.
Generated permissions/schemas reflect ordinary development build support, not a new MCP permission.
Full formatting still has five unrelated baseline failures; touched formatting and CODEMAP checked.

Only mock frontend transport and disposable Rust test databases/processes were used. No app launch,
user database/keyring access, benchmark import, new visual verification or packaged security/parity
acceptance. Automatic native lock events, real view/media purge wiring, picker UX and atomic legacy
startup disconnection remain later activation work. Updated plan, state, roadmap, CODEMAP, SECURITY,
TESTING, ADR 004 and this log. **Next: step 3 retained-payload/command inventory and current-view
integration**; glass remains paused. Existing dirty glass changes preserved. No commit/push.

---

## 2026-09-07 — Database intermission step 3a: view inventory and atomic geometry

**Phase/slice:** Database intermission, step 3a supporting work; full step 3 open.
**Commit(s):** Uncommitted on `21599ec92551ed4605dc8737353f1cd9dad3a839`.

Audited current types, generic document/command schemas, empty element/extension registries, legacy
collection setters, extension registry and gesture completion adapter against FEATURE-PARITY/ADR 004.
Created `DATABASE-VIEW-INTEGRATION.md` with retained field/action/ownership mappings and concrete gaps:
content-measured text-card sizes versus canonical geometry, root layers versus child order, container
placement transactions, image hashes versus opaque media IDs, typed extension compatibility and
removed raw workflows. The schema accepting arbitrary JSON data does not imply it can render every
payload. No benchmark fixture is treated as the definitive feature schema. Companion container
features are recorded rather than silently dropped. No old-data migration or view adapter was added.

Split step 3 into inventory/geometry (3a), typed payloads/read-only view projection (3b), completed
feature routing (3c), and cross-feature checks (3d). Existing generic geometry commands handled one
element at a time, so mapping a group gesture through a loop would create multiple history/save
operations. Added the named `document.elements.update-geometry` command to the same explicit registry.
It validates every target, same canvas, duplicate IDs and expected canonical starting geometry before
any draft mutation. Stale/invalid groups fail atomically. Equal-value replacement is skipped so it
produces no patch/save; payloads cannot change element data, layers, camera or relationships.

This is a generic completed-edit primitive, not a second command engine or feature-specific domain
switch. It does not yet interpret lock extensions, text-card placement, child relationships or measured
bounds. Future production completion routing must capture workspace epoch/document/canvas at gesture
start and reject replacements independently of geometry equality. Test-only completion wiring uses
the real interaction controller with canonical fixture geometry; no production adapter was mounted.

Added nine domain and three workspace tests; extended the existing 10,000-element test with a group
case (13 additional test cases). Tests cover atomic failures, input/document immutability, localized
patches, no-op suppression, 100 preview frames without JSON/history/persistence, one completion/save,
whole-group undo/redo and cancellation. Full frontend: **874 pass / the same 15 baseline failures**
and 14 known jsdom elementFromPoint errors. Typecheck, lint, architecture (379 target files), production
build and capability/harness/MCP inspection pass. Rust fmt, all-target/all-feature Clippy and tests pass
(72 / one ignored); no Rust source change in this slice. Existing large-bundle warning; shared command
registry adds the handler to the bundle (index-BIFTxKvS.js, 626.14 kB), but no new visible path is active.
Full formatting retains the same five unrelated failures. Generated CODEMAP and touched formatting
checked; no baseline UI tests or unrelated dirty work were modified to make validation green.

Read the Tauri UI skill to establish the later visible-work gate; this slice edits no renderer, CSS,
UI interaction implementation or application startup. No native launch, screenshots, console inspection
or visual acceptance claim. No user database/keyring access or benchmark load; Rust tests use disposable
test data. Updated plan, inventory, state, roadmap, TESTING, CODEMAP and log. Next: **3b typed retained
payloads/read-only projection, beginning with text cards/containers**, not an immediate production
cutover. Glass remains paused. No commit/push.

---

## 2026-09-07 — Database intermission 3b1: typed card/container projection support

Continued from the saved 3a inventory on `architecture-v1`, HEAD
`21599ec92551ed4605dc8737353f1cd9dad3a839`, preserving the existing dirty worktree. This bounded slice
starts 3b with strict module-local `text-card` and `container` schemas and read-only retained-view
projectors. No legacy file conversion, new persistent store, rendering strategy, or placeholder
element registrations. Generic document/Rust envelopes are unchanged. DATA-FORMAT and ADR 004 now
record explicit nulls, child-owned placement, unique bounded integer child order (gaps allowed),
same-canvas container parents and independent canonical layer order. No removed extension or raw
shell workflow payload is promoted into typed data.

The unmounted `createCardContainerProjection` composes frozen detached retained props across all
canvases, returning only sanitized issue codes/IDs and no partial view for invalid or unsupported
content. Connections, media references and all extension installations are deliberately unsupported
by this first slice, including disabled installations. Models alone do not guard generic workspace
commands or pending confirmation; full feature admission/transaction validation remains required.
Card props omit width/height so content-measured visuals do not gain forced dimensions. No DOM,
React subscription, material, media bytes, callback or camera fields are involved.

Memoization uses immutable document identity and weak entity keys plus derived layer, with an explicit
clear operation. Unchanged pointer-frame inputs return the identical whole result without schema
parsing/serialization; changed entities are reprojected and unchanged entities retain view identity.
Relationship checks rerun even for cached children when the parent changes. Clearing drops references
owned by this adapter, not consumer-held values; it is not yet connected to the lifecycle purge hook.
Consumers must be unmounted/cleared on lock before this path can activate. Shared test fixtures live
under elements, not in the higher-level application owner.

Added 36 tests across four files for strict payloads/unknown fields/string and order limits, Unicode
and empty fields, frozen projections, canonical layer vs child ordering, missing/self/cross-canvas
parents, duplicate child order, unsupported content on inactive canvases, cache clearing and same-ID
replacement. Real interaction-controller tests run 100 pan and 100 zoom samples without parsing or
JSON serialization, then separately test localized completed edits and layer/parent invalidation.
These are deterministic operation/identity checks, not a release FPS measurement.

Validation: focused 36 pass; full frontend **910 pass / the same 15 baseline failures**, with 14 known
jsdom elementFromPoint errors (171 files). Typecheck, lint, architecture (390 target files), optimized
build and production capability/harness/MCP checks pass. Stable bundle remains index-BIFTxKvS.js,
626.14 kB, with its existing large-chunk warning. Rust fmt/all-target-all-feature Clippy/tests pass
(72 / one ignored). Full formatting retains the same five unrelated failures; new/touched formatting
and generated CODEMAP (530 files) checked. Initial Vitest startup needed approved subprocess access;
one test-only Immer recursive-type assignment was rewritten as a shallow immutable replacement to
avoid TypeScript's excessive-depth error. No production type workaround or baseline-test modification.

No live app launch, screenshot, console inspection or visual acceptance; the visible app still uses
legacy storage. No user database/keyring access or benchmark load. Updated integration plan/inventory,
state, roadmap, DATA-FORMAT, ADR 004, TESTING, CODEMAP and this log. **Next: remaining 3b contracts and
projections, beginning with text blocks/mind-map/typed connections, then image metadata/extensions.**
Completed callback routing (3c), media transport and startup cutover remain later; glass stays paused.
No commit/push.

---

## 2026-09-08 — Database intermission 3b2: text blocks, mind-map nodes and connections

Resumed from repository state rather than the stale app history reader. Stayed on `architecture-v1`
and preserved all existing dirty work. Added strict `text-block/` and `mind-map/` schemas and frozen
retained-view projectors without modifying renderers, App startup, material or interaction owners.
Blocks retain title/Markdown/header/dimensions; explicit `mind-map-node` data contains only text/accent
and maps to root, content-sized retained card props. No accidental link/placement/legacy-kind payload.

Audited App's getConnectableElementBounds/getAvailableMindmapEndpoint and appDataSchema: connections
support containers, blocks, images and mind-map nodes, not ordinary cards; no self edge and no duplicate
unordered pair regardless of direction/ports. Added typed `mind-map` edge schema with strict empty data
and four named non-null ports, plus capability/relationship validation. This slice supports valid
container/block/node endpoints only; images join after their payload/media support, not by coercing
old image hashes. Unknown edge type/data and invalid node/block payloads fail with sanitized IDs/codes
and no partial view, including on inactive canvases.

Extended and renamed the existing unmounted adapter/types to `createRetainedCanvasProjection` and
`retainedCanvasProjectionTypes`; no compatibility wrapper, second store or second renderer registry.
`createMindMapConnectionsProjection` is its bounded cache/index helper: one document-wide edge pass,
not one edge scan per canvas. Immutable edge identity caches parsed shape/props, but endpoint capabilities
and pair uniqueness are rechecked on changed documents. Moving a connected node preserves edge and
untouched-block props. Clearing drops node/block/edge caches together; real session purge wiring,
feature admission and completed command validation still precede later activation.

Added 46 tests across four files; replaced the old blanket-connections-unsupported case with explicit
edge coverage (net +45). Tests cover strict fields/limits/geometry/ports, frozen Unicode/Markdown props,
capability locality, normal-card rejection, self/duplicate edges, inactive-canvas failures, unchanged
document zero parsing/serialization, moved nodes, edited ports, cached-edge capability invalidation and
cache clearing. Existing actual-controller card/container pan/zoom tests still pass. Focused elements/
projections: **82 pass / 9 files**. Full frontend: **955 pass / same 15 baseline failures**, 14 known
jsdom elementFromPoint errors / 175 files. Typecheck, lint, architecture (402 target files), optimized
build and production capability/harness/MCP checks pass. Rust fmt/all-target-all-feature Clippy/tests
pass (72 / one ignored). Stable bundle remains index-BIFTxKvS.js (626.14 kB), with its existing warning.
Full formatting retains the five unrelated baseline files; touched formatting and generated CODEMAP
are checked separately. No unrelated tests changed to make the suite green.

No native app launch, screenshots, console inspection or visual acceptance; no user database/keyring
or benchmark access. Rust tests used their disposable fixtures. Generic TypeScript envelope/Rust
schema and empty production element registry are unchanged. Updated DATA-FORMAT, ADR 004, integration
plan/inventory, state/roadmap, TESTING, CODEMAP and log. Next: **3b3 image/GIF payloads and opaque-media
metadata projections**, then explicit extensions. Byte transport remains step 4; callback routing,
admission/purge wiring and coherent startup cutover remain open. Glass stays paused. No commit/push.

---

## 2026-09-08 — Database intermission 3b3: image/GIF data and opaque-media metadata

Continued the saved plan on `architecture-v1`, preserving existing dirty work. Audited ImageNode,
legacy useImageCache, native image import normalization, generic media references and the platform
media contract. Current ImageNode uses externally supplied URLs but still interprets imageId as
presence; the old loader addresses hashes. No new opaque ID is passed through either legacy path.
The new view intentionally exposes a separate `media` record/null, not imageId/format/URL/bytes.
Future renderer presence/loading/failure binding must change coherently with real media transport.

Added strict image payload/schema/projection in `elements/image/`: opaque mediaId or explicit empty
placeholder, accent, explicit background and nullable child placement. Moved the unchanged shared
card placement schema to `domain/document/elementPlacement.ts`; no new generic envelope field or
feature import into domain. Images/cards validate one child-order namespace and same-canvas container
parents. Valid images, including empty placeholders, join existing connection capabilities.

Typed references support retained stored WebP/GIF/SVG MIME representations, positive byte lengths,
paired known/unknown intrinsic dimensions and encrypted alt text. Unknown/unsupported metadata,
including unused references, fails explicitly; valid unused references remain in the read-only result.
This is metadata validation, not actual byte sniffing, SVG security/resource validation, GIF decoding
or animation acceptance. Legacy raster import currently normalizes to WebP; new Rust transport/import
must deliberately preserve that behavior rather than assume arbitrary generic MIME values are ready.

`createImageMediaProjection` caches the immutable reference collection/entities. The same retained-view
adapter keys image cache entries on referenced metadata identity too, so metadata-only changes update
natural size/alt text without stale props; unrelated reference edits retain image identity. Missing or
invalid media invalidates cached images instead of silently producing placeholders. Shared metadata is
frozen once and reused; camera reads do not rebuild it. Explicit clear drops all owned references,
image/element/edge caches. Actual lifecycle purge, feature admission/commands and mounted UI remain open.

Added 39 tests in three files, replacing the old blanket unsupported-media case (net +38). Coverage:
strict fields/IDs/limits/formats, placeholders vs missing references, unknown dimensions, unused media,
mixed child order, parent locality, empty-image endpoints, reference/geometry changes, shared metadata,
cache clearing and 100 actual-controller pan plus 100 zoom samples with zero schema parsing/JSON
serialization. A malformed-length ID in the new test fixture initially prevented three suites from
loading; corrected the fixture, not validation. Focused document/element/projection suite: **155 pass /
16 files**. Full frontend: **993 pass / same 15 failures / 14 known jsdom errors**, 178 files.
Typecheck, lint, architecture (410 target files), production build and capability/harness/MCP checks
pass. Rust fmt/all-target-all-feature Clippy/tests pass (72 / one ignored). Stable frontend bundle is
unchanged (index-BIFTxKvS.js, 626.14 kB; existing large-chunk warning). Five unrelated full-format
baseline files remain; touched formatting/generated CODEMAP checked separately.

No user profile/keyring or benchmark access, media-byte I/O, native launch, screenshots or console
inspection. No live visual/security/media parity claim. Visible app remains on legacy storage. Updated
DATA-FORMAT, ADR 004, integration plan/inventory, state/roadmap, TESTING, CODEMAP and log. Next: **3b4
explicit retained-extension payloads, target compatibility and read-only projections**, including
retained container companions; then admission/completed commands and real media/startup cutover.
Glass remains paused. No commit/push.

---

## 2026-09-08 — Database intermission 3b4: retained extension data and projection

Continued from repository state after the user's resume request. Audited the retained legacy registry
and control consumers, then added nine explicit data-only definitions to the existing architecture
registry: privacy, lock, color picker, checkbox, search, auto-checkbox, counter, inherited card color
and JSON copy/paste. Strict schemas/defaults/target lists live in their own modules. The optional-Control
contract avoids dummy UI or a second renderer registry; active legacy registrations remain untouched.

The unmounted retained adapter now validates all extension installations and joins frozen effective
props by target. Installation activation remains separate from configured flags; disabled entries
retain validated configuration, while active installed-but-off flags retain controls. Unknown,
removed/raw-workflow, invalid or incompatible records fail with sanitized IDs/codes and no partial
view. One ID per target is checked defensively in addition to generic invariants. No conflicts exist
among the nine retained definitions; the later structured Workflow Runner is not supplied by this work.

Configuration and per-target group identity caching prevents parsing on camera samples, reuses props
on geometry edits and invalidates only affected element views on extension-only updates/removal.
Changed target capabilities are rechecked outside the cached parse. Clear drops all owned caches;
real lifecycle purge, full feature admission and typed command guards remain explicitly deferred.
No extra store, material abstraction, rendering strategy, native authority or file-format bump.

47 new tests. Focused schema/element/projection suite: **202 pass / 19 files**. Full frontend:
**1040 pass / same 15 baseline failures / 14 known jsdom errors**, 181 files. Typecheck/lint/architecture
(424 target files), production build and capability/harness/MCP checks pass. Rust fmt, all-target/
all-feature Clippy and all-feature tests pass (72 / one ignored). Stable frontend remains
index-BIFTxKvS.js, 626.14 kB with the existing chunk warning. Full formatting still flags only the same
five unrelated files; touched formatting and generated CODEMAP checked separately.

During test development, corrected an Immer recursive-JSON inference issue by using a shallow
immutable test update. Duplicate fixtures were correctly rejected by generic validation before
reaching the adapter, so the defensive adapter test now constructs that invalid state explicitly.
Neither correction weakened production validation. No app launch, real user profile/keyring access,
benchmark loading, media-byte access or live parity claim. Current visible app/storage remain legacy.

Updated integration plan/inventory, state/roadmap, DATA-FORMAT, ADR 004, TESTING and CODEMAP. Read-only
3b is complete locally; next **3c: feature admission and typed transaction guards**, followed by
completed callbacks/epoch guards. Real media/startup cutover and glass acceptance remain open.
No commit/push.

---

## 2026-09-08 — Database intermission 3c1: feature-data acceptance boundaries

Continued from the saved 3b4 completion after the user's request. Added a neutral domain acceptance
callback contract with fail-closed exception handling. The generic workspace optionally checks loaded
documents and command/undo/redo results before state/history/persistence publication. Rejected work
preserves identity/history/revisions and any scheduled valid save. Generic domain commands and the
Phase 2 harness remain generic; this is not an element-module import into the domain or platform.

The unmounted product session factory now explicitly supplies `acceptRetainedDocument` to both
workspace and native-client seams. The platform application factory requires a policy. The retained
policy reuses the existing projection's module schemas/relationships, clears it in finally and discards
it without publishing view props or keeping a validation cache. No competing schema/renderer registry.
Create input fails before token consumption/native invocation; pending data fails before confirmation
with existing cancel/close cleanup; invalid resume relocks/closes; invalid save never invokes native
save. Confirmed workspace rejection still closes/purges through the existing lifecycle.

This is payload/relationship admissibility, not action authorization. Atomic parent deletion/reparenting,
lock rules, named feature callbacks and epoch/canvas guards remain open. Full-document validation at
completed/lifecycle boundaries is intentional for this staged seam; large-document completed-edit
latency needs later acceptance. Camera frames never invoke the gate.

28 new tests; **235 focused pass / 25 files**. Full frontend **1068 pass / same 15 baseline failures /
14 known jsdom errors**, 184 files. Typecheck, lint, architecture (429 target files), production build
and capability/harness/MCP checks pass. Rust fmt, all-target/all-feature Clippy and all-feature tests
pass (72 / one ignored). Full format check has the same five unrelated failures; touched files and
generated CODEMAP checked separately. Stable index is now index-NBOn-qya.js, 626.61 kB: the shared
store includes the optional generic guard, not an active retained policy/database cutover.

During iteration moved the native-mocking test under src/platform as required by the architecture
check. Corrected a test beforeEach that accidentally returned the mock as a Vitest cleanup callback;
no runtime behavior was weakened. The existing product-transport fixture now contains retained
card/container data instead of generic test-card JSON. No native app launch, real user profile/keyring,
benchmark loading, media bytes or live visual/security acceptance. No commit/push.

Updated plan/inventory, state/roadmap, ADR 004, DATA-FORMAT, SECURITY, TESTING and CODEMAP. Next:
remaining **3c named feature edits/atomic placement/deletion/lock rules**, then callback/epoch guards.
Visible app/storage stay legacy and glass remains paused pending the actual media/startup cutover.

---

## 2026-09-09 — Database intermission 3c2a: atomic retained selection deletion

Audited legacy `planCanvasDeletion`, `isElementDeletionLocked` and parent removal before selecting
this bounded command slice. The retained behavior skips protected targets rather than rejecting the
entire selection: a locked child protects its container, but selected unlocked siblings remain
deletable. A locked parent alone does not protect an independently selected unlocked child. Preserved
that policy, including the document preference and separate installation/configured lock flags.

Added `document.selection.delete` and a product `document.element.remove` replacement sharing one
authority. One transaction removes permitted elements, contained cards/images, connected edges,
targeted installations and layer entries. Media metadata/bytes remain for undo; survivor geometry and
ordering remain unchanged. Duplicate/missing/wrong-canvas/malformed targets reject atomically and no
force field is accepted. Empty/all-protected groups do not create history or schedule saves.

The existing store/workspace dispatcher now accepts an optional explicit handler list; only the
unmounted product composition supplies the retained list. Generic/harness defaults remain unchanged.
Application-level deletion coordination uses the existing read-only projection and immutable Immer
transaction input, then clears its cache. Corrected recursive Draft/JSON TypeScript inference by
reading `original`, not weakening schemas. No new command engine, renderer/material strategy or
legacy snapshot owner. Move/resize lock policy, placement/content/group layer commands, callback
epochs and animation/selection cleanup remain open.

18 new tests; **133 focused pass / 16 files**. Full frontend **1086 pass / same 15 baseline failures /
14 known jsdom errors**, 186 files. Typecheck, lint, architecture (433 target files), production build
and capability/harness/MCP checks pass. Rust fmt, all-target/all-feature Clippy and tests pass
(72 / one ignored). Full formatting still flags the same five unrelated files; touched formatting
and generated CODEMAP checked separately. Stable index-DG64oq3j.js is 626.63 kB due to the shared
optional handler-selection parameter, not mounted retained commands. Existing chunk warning remains.

Performance regression deletes 1,000 added children in one transaction without command serialization,
verifies full undo and zero deletion work in 100 pan/100 zoom samples. No release latency/FPS claim.
Product transport mock confirms its single-remove path cascades retained children. No native app
launch, user database/keyring/benchmark access, real media deletion or live visual/parity claim.
Visible app/storage remain legacy. No commit/push. Updated state/plan/inventory/roadmap, ADR004,
TESTING and CODEMAP. Next: completed geometry/placement and move/resize locks, then remaining typed
content/layer commands and completed callback/epoch guards. Glass remains paused.

---

## 2026-09-09 — Database intermission 3c2b: completed geometry policy

Audited the legacy geometry/commit adapter, controller move/resize eligibility and text-card drop
code. Split completed geometry from the next placement transaction because placement additionally
owns parent/sibling order and filtered/scroll-aware drop decisions. Added product single/group geometry
replacements sharing lock/resize-capability checks. Kept generic group writes/from/locality/duplicate/
no-op authority intact and exported its existing payload schema for reuse. Generic/harness behavior
and the active legacy interaction path remain unchanged.

Containers/blocks/images remain resizable; cards/mind-map nodes reject attempts to persist measured
preview extents. No automatic parent/child geometry rewriting. Effective lock state is checked against
the immutable transaction input; a changed target locked since gesture start rejects the whole group.
Initial lock filtering remains in the controller, unchanged locked geometry is a no-op, and deletion
permission cannot bypass move/resize locks. Both product geometry entry points use the same authority.
The single-item API lacks caller-supplied expected-from values; future gesture callbacks must use the
captured canonical group API plus the still-pending session/canvas guards.

31 new tests; **173 focused pass / 19 files**. Full frontend **1117 pass / same 15 baseline failures /
14 known jsdom errors**, 188 files. Typecheck/lint/architecture (437 target files), build and production
boundary checks pass. Rust fmt/all-target-all-feature Clippy/tests pass (72 / one ignored). Full format
check still flags only the five known unrelated files. Stable bundle unchanged: index-DG64oq3j.js,
626.63 kB, existing chunk warning (this run also reported CSS plugin timing). Touched formatting and
generated CODEMAP checked separately.

Actual controller tests validate 100 previews with no document/history/save/serialization, differing
measured card dimensions without canonical extent writes, initial-lock exclusion, one group commit/save,
undo/redo, cancellation, constrained resize and mid-drag lock rejection preserving state/pending saves.
The product transport test now verifies its geometry lock guard as well as deletion wiring. No new
renderer/material abstraction, native app launch, user database/keyring/benchmark access or live parity
claim. No commit/push. Updated plan/state/roadmap/inventory/TESTING/CODEMAP. **Next: 3c2c atomic placement,
reparent/detach and sibling order**, then typed content/group layer commands and callback epoch guards.
The visible app/storage remain legacy and glass acceptance stays paused.

---

## 2026-09-09 — Database intermission 3c2c: atomic placement command support

Resumed from the repository state after the user reported missing chat messages. Completed the saved
next command slice, without investigating Codex UI or launching TaskMap. Re-audited retained text-card
drop/commit behavior and the normalized shared card/image placement contract. Added the bounded
`document.elements.place` command to the existing product handler list: canonical group geometry,
caller-ordered moving bundle, target/full-list index after removal, expected moving placement and
complete affected sibling ID/order snapshots. No new engine, renderer, persistent mirror or DB format.

All placement preconditions are planned before mutation; the existing geometry authority supplies
canonical-from/lock/resize checks. Changed sibling sequences alone are renumbered; no-op drops preserve
numeric gaps and immutable identities. Direct moved locks reject, but locked parents and indirectly
shifted siblings remain allowed. Generic product data replacement cannot change placement; generic
core/harness defaults and other staged content policies are unchanged. Source reads use Immer's
immutable transaction input to avoid recursive Draft<JsonObject> TypeScript instantiation; writes
preserve unrelated current content. Temporary projections are cleared, never retained between frames.

42 new tests; **215 focused pass / 22 files**. Full frontend **1159 pass / same 15 failures / 14 known
jsdom errors**, 191 files. Typecheck/lint/architecture (444 target files), optimized build and production
exclusion/boundary checks pass. Rust fmt/all-target-all-feature Clippy/tests pass (72 / one ignored).
Full format check retains only the five known unrelated failures. Stable bundle unchanged:
index-DG64oq3j.js, 626.63 kB, with existing chunk and plugin-timing warnings. Focused cases cover mixed
ordering, detach/reorder/multiple sources, locks, malformed/stale inputs, no-ops, undo/redo/one save and
unrelated content preservation. Actual controller tests keep 100 previews/cancel transient, then one
completion; a 1,000-sibling case checks localized patches/no serialization. Mocked native product
composition exercises placement/undo. These do not establish release timing or live placement parity.

Updated plan/state/roadmap/view inventory/TESTING/ADR004 and generated CODEMAP. No active profile,
database/keyring or benchmark access; no native launch, commit or push. **Next: 3c2d typed content edits
and lock/action policies**, then group layers and completed epoch/document/canvas callback guards.
Full-list search/scroll drop binding remains later work. Visible app/storage remain legacy; intermission
step 3c is open and glass acceptance remains paused.

---

## 2026-09-09 — Database intermission 3c2d/e: combined content and layer commands

The user explicitly combined the next content-edit and layer-order slices, leaving completed callback
wiring afterward. Re-read workflow/state/roadmap/parity and audited App's text/title/link/color/header/
image-background handlers, context menus, controller layer completion and legacy ordered-group logic.
Confirmed that locks protect motion/resize/deletion but allow retained content and layer controls.
No change to the active App/renderers/controller or storage ownership.

Added `document.elements.edit-content` using module-owned strict scalar field schemas and an explicit
application discriminated union. Captured `from`/`to` keys/values, type/canvas/unique targets validate
before any write. Unrelated fields survive; empty/equal fields are no-ops. Writes now produce field-local
patches rather than copying full text records for a color edit. Product full-data replacement delegates
through the same typed/no-op rules, retaining placement protection and rejecting media-ID replacement
until session-bound media work. Canonical strings stay exact; UI trim/nonblank-save/link normalization
and color-preset mapping remain required in callback binding, not silently supplied by these commands.

Added `document.elements.reorder-layers` with captured root order and the four retained directions.
Selection order comes from existing stacking; only root slots in the complete layer array change.
Child records/slots/placement, geometry and media are untouched. Stale/invalid/child/duplicate input
rejects atomically; unchanged/empty actions are no-ops. Product single reorder retains absolute canvas
indices but restricts both endpoints to roots. Both immediate single APIs lack caller-captured snapshots
and must not be used as deferred callbacks. Generic core/harness semantics remain unchanged.

60 new tests; **275 focused pass / 26 files**. Full frontend **1219 pass / same 15 baseline failures /
14 known jsdom errors**, 195 files. Typecheck/lint/architecture (451 target files), build and production
checks pass. Rust fmt/all-target-all-feature Clippy/tests pass (72 / one ignored). Touched formatting
and CODEMAP checked; full formatting retains the five unrelated baseline files. Actual controller
tests exercise 100 pan/zoom samples with no content/layer commands or save, then separate completed
actions with undo/redo and one existing debounced save. A 1,000-element fixture asserts field-local
content and root-slot layer patches/no serialization. Mocked native product factory exercises both.

During iteration, direct recursive Draft<JsonObject> access exceeded TypeScript's instantiation bound;
a validated shallow draft view permits field-local assignment without changing runtime ownership.
The CSS scanner also interpreted a word in a new test description as a utility class; renaming that
description restored byte-identical stable output (index-DG64oq3j.js, 626.63 kB; existing chunk warning).
No CSS pipeline/visual behavior was changed to work around it.

Updated plan/state/roadmap/view inventory/TESTING/ADR004 and generated CODEMAP. No native launch,
active user database/keyring/benchmark access, commit or push. **Next: completed callback binding with
epoch/document/canvas guards**, then step 3d cross-feature routing/acceptance. Visible app/storage
remain legacy; new support is unmounted and glass acceptance stays paused. No live parity or FPS claim.

---

## 2026-09-09 — Database intermission 3c3: revocable completed-action callbacks

Resumed the saved callback step. Read workflow/state/current roadmap and the Tauri UI-development skill;
kept the change unmounted with no visible UI/native launch, as required by the staged cutover. Inspected
workspace epochs, session busy/purge/dispose delivery, the actual controller completion types and the
legacy editor/link/placement behavior. Added `createRetainedActionCallbacks` to the product factory,
not AppShell/LegacyApplication. No controller, renderer/material, database format or save-loop changes.

One store/session subscription pair checks epoch/document/database/active-canvas identity and editability.
Four superseding slots retain only action-specific captured values; returned handles retain keys only.
Clear/purge/dispose drop values, and the product factory's controller disposal unsubscribes the callback
owner. Handles are consumed before command dispatch, including error/no-op/reentrant paths. A/B/A
canvas transitions, same-ID reload and failed save-before-lock cannot revive old callbacks. Existing
workspace guards and named command preconditions remain authoritative, not a new command engine.

Added capture/completion for canonical move/resize, explicit placement with sibling snapshots, typed
field edits, root-layer actions and deletion. Move ignores measured extents; resize preserves canonical
position. Initial controller eligibility must precede capture; preview/cancel/start failure stays with
the interaction owner. Placement requires a resolved full-list target or explicit root null; absent
decisions reject. Actual scroll/search drop-result/loose-position mapping remains a 3d routing check.
Text/title finalizers trim/ignore blank writes; module-owned link normalization preserves retained
protocol/Windows-path rules without opening resources. Draft/focus/pulse/blank-rename UI stays local.

41 new tests; **316 focused pass / 30 files**. Full frontend **1260 pass / same 15 failures / 14 known
jsdom errors**, 199 files. Typecheck/lint/architecture (461 target files), build/production checks and
Rust fmt/all-target-all-feature Clippy/tests pass (72 / one ignored). Five unrelated formatting failures
remain. Stable output unchanged: index-DG64oq3j.js, 626.63 kB; existing chunk warning. Tests cover actual
mocked session failure/reopen transitions, single-use/reentrant/superseded callbacks, stale snapshots,
editor normalization, explicit placement and canonical geometry. Real-controller 100-preview tests
invoke no dispatch/history/save/serialization/session reads, then one completed save. Repeated captures
keep one observer pair; disposal unsubscribes once. Product transport test checks post-lock revocation.

An initial editor case accidentally submitted the fixture's existing value; corrected the test to use
a changed value after confirming the expected no-op behavior. Resolved nullable active-canvas typing
and prefer-const initialization without changing lifecycle semantics. No active user profile/database/
keyring or benchmark access, commit/push, native screenshot/console inspection or live parity claim.
Updated plan/state/roadmap/view inventory/TESTING/ADR004/CODEMAP. **Next: step 3d cross-feature routing/
gap checks**, including eligibility/drop mapping, remaining extension/connection/clipboard routes,
settings/history and failure cleanup. Full step 3 is still open. Visible app/storage remain legacy;
glass acceptance stays paused until coherent media/startup/security activation.

---

## 2026-09-09 — Database intermission 3d1: controller completion/lifetime composition

Continued the saved cross-feature routing checks after reading workflow/state/roadmap, the UI skill
and actual normalized callbacks, controller, projection and legacy geometry/drop implementations.
Found that callback revocation blocked writes but had no connection to controller preview/selection
cleanup. Added an unmounted composition of the existing controller and callbacks, not another engine,
rendering abstraction, store, dispatcher or persistence owner. No active App/renderer/controller change.

Successful translation start captures the controller's eligible IDs after filtering locked targets;
resize uses its capability/constraint checks. Canonical card sizes stay out of persisted measurements.
Layer actions reuse root-only commands. Failed starts and unrelated pointers cannot supersede captures;
cancel/no-op/threshold/replacement/disposal release them. Reentrant starts during completion/revocation
reject. The callback owner's existing subscription pair now delivers identity invalidation to clear
active gestures, previews/guides and selection, restoring pan on cancellation. Ordinary edits do not
invalidate that identity. Stale command failures are sanitized, with no retry from a refreshed snapshot.
Lock-start revokes previews even when save-before-lock fails and returns to the editable document.

28 new tests; **363 focused pass / 38 files**. Full frontend **1288 pass / same 15 failures / 14 known
jsdom errors**, 202 files. Typecheck/lint/architecture (466 target files), build/production inspection,
Rust fmt/all-target-all-feature Clippy/tests pass (72 / one ignored). Touched formatting and CODEMAP
check pass (606 files); full formatting retains the same five unrelated failures. Tests exercise the
real mocked lifecycle/workspace/controller, projected effective locks and canonical-vs-measured geometry.
200 samples each of translation/resize/pan do no workspace/session reads, dispatch, subscriptions,
serialization, history or saves; completed edits use one transaction/save. No release timing claim.

Build inspection initially found a 32-byte CSS addition: Tailwind scanned the TypeScript `!resize`
local-variable check into an important resize utility. Compared utility generation with/without the
new files and renamed the variable; stable output returned to index-DG64oq3j.js (626.63 kB) and
index-Dci71JB_.css (108.96 kB). Existing chunk warning remains. No broad Tailwind/config change.

**Next: 3d2 normalized geometry eligibility and drop-result mapping**, then 3d3 remaining action/settings
routes. The partial binding deliberately rejects placement gestures. Production root/child hit-testing,
measured sizes, search/scroll decisions, loose positions and card-only-to-shared-card/image indices remain
open; tests supplying resolved bounds do not close them. Keep full step 3 open and do not mount this
partial composition. Updated plan/state/roadmap/view inventory/TESTING/CODEMAP; no foundational ADR change.
The UI skill kept visible acceptance separate: no native launch, screenshot/console inspection, active
profile/keyring/benchmark access, live parity claim, commit or push. Visible app/storage remain legacy;
glass work stays paused until coherent database/media/startup acceptance.

---

## 2026-09-09 — Database intermission 3d2 and 3d3a: geometry/drop mapping, then connection actions

Resumed 3d2 after reading workflow/state/roadmap/UI skill and auditing actual App pickup/release,
geometry, search/scroll placement and callback code. The usage limit interrupted validation; no writes
were lost. The user then requested resumption plus the next step, so completed 3d2 and the next bounded
retained-action route, 3d3a connections. Full 3d still includes extensions, clipboard and settings/history.

Added the unmounted `legacy/interactions/retainedInteractionGeometry` compatibility bridge, reusing
existing geometry/stack/bundle/snap functions with readonly normalized retained props. Only the shared
legacy function parameter types changed; their runtime behavior and the active App remain unchanged.
Direct contained-card pickup uses displayed filtered/scrolled coordinates and measured/fallback size;
root selection/snapping still excludes contained cards/images. Bundle source order, initial locks,
parent-lock non-cascade, primary pickup bounds and root-group versus card-placement selection are covered.

The existing unmounted controller now accepts explicit resolved text-card placement, with a three-pixel
minimum and decision read only at completion. Captures include child type/placement; callbacks validate
exact moving order and finite loose positions, preserve canonical extents and map card-only insertion
into captured shared card/image slots after removing movers. Before-card anchors use that card's shared
slot; end appends after all remaining children. No refreshed siblings or implicit detachment. Existing
commands own atomic geometry/order/history/save. As in the actual App, the caller must update placement
with the release sample before completing and owns pickup/settle/cancel/purge presentation. No removed
sorting/pick-a-card admission, new gesture engine, material strategy, active storage or renderer switch.

32 new tests; 431 focused passed before continuing. Two test expectations were corrected against actual
behavior: a locked surviving sibling can be renumbered indirectly by the existing placement policy, and
the directional-insertion fixture needed an unscrolled target to cross its midpoint while still inside
the container hit area. The code behavior was not altered to satisfy those mistaken expectations.
Actual placement-service/controller tests cover filtered/scrolled drops, nonprimary bundle pickup,
loose offsets, detach, blocked/topmost containers, directional insertion, stale siblings and resolver
errors/cancellation/lock/threshold cleanup. 200 previews perform no workspace/session reads, dispatch,
serialization, history/save or completion-decision reads; one completion uses the existing transaction.

Then added typed connection callbacks to the existing completion owner (fifth bounded slot, no extra
observers). `document.connection.complete` invokes existing node/edge insertion handlers within one
transaction. Existing endpoints get an edge; only mind-map sources can grow a root node plus opposite-
port edge. Shared retained admission remains the capability/pair authority. Rejected node/edge inputs
roll back together, including duplicate edge IDs after a tentative node insertion. Captured deletion
checks the original edge endpoints/ports. Locks allow edge creation/deletion, matching current behavior.
New IDs, canonical node geometry, default values and clamped coordinates remain caller inputs; view
focus/animation/port hit-testing/connection previews remain unmounted acceptance work, not new ownership.

28 connection tests cover four endpoint types/ports, atomically undoable node+edge creation, one save,
locks, invalid/self/duplicate/reversed/missing edges, invalid node inputs, retargeted deletion, null/
cancel/supersession and both connection/deletion revocation. Repeated captures add no observers or
persistent work. Replaced an unsupported test-only Array.at use after typecheck; no product behavior change.

Combined validation: **60 new tests; 459 focused pass / 53 files**. Full frontend **1348 pass / same 15
failures / 14 known jsdom errors**, 207 files. Typecheck/lint/architecture (477 target files), production
build/isolation and Rust fmt/all-target-all-feature Clippy/tests pass (72 / one ignored). Cargo briefly
waited on its build-directory lock during parallel validation. Full format check retains the same five
unrelated failures; touched formatting and CODEMAP check pass (617 files). Stable output unchanged:
index-DG64oq3j.js (626.63 kB), index-Dci71JB_.css (108.96 kB); existing chunk warning. No live FPS claim.

Updated plan/state/roadmap/view inventory/TESTING/CODEMAP. No foundational schema/security/material
decision changed, so no ADR change. The Tauri UI skill kept visible acceptance separate: no native launch,
screenshots/console inspection, active database/profile/keyring/benchmark access, commit or push. Visible
app/storage remain legacy. **Next: 3d3b extension actions**, then 3d3c clipboard/duplication and 3d3d
settings/history/view-state routes. Full step 3 remains open; media and atomic startup cutover still follow.

---

## 2026-09-09 — Database intermission 3d3b: retained extension actions

**Phase/slice:** Database integration step 3d3b, unmounted support. Continued from the saved 3d2/3d3a
handoff on architecture-v1 / HEAD 21599ec92551ed4605dc8737353f1cd9dad3a839. Preserved unrelated dirty work.

Audited actual App install/drop/remove/toggle/search callbacks and the nine retained definitions. Existing
installation activation and configured enabled flags are distinct; turning a lock off must keep its control.
Group lock toggles follow the primary rather than independently inverting each member. Reinstall does not
reset configuration/activation. Search stores raw text. There are no retained-definition conflicts currently;
removed sorting/pick-card/raw Command Runner are not added to the new extension path.

Added `retainedExtensionCommand`, `retainedExtensionSnapshot` and `retainedExtensionCallbacks` to the existing
handler/callback composition. One sixth bounded slot uses the existing subscription pair. Snapshots retain
only selected element types/installations; completion IDs cover exactly missing compatible installations.
`document.extensions.edit` preflights identity/current values/canvas and ID collisions before one atomic
mutation, preserving unchanged references. Current product admission remains strict config/conflict authority.
Existing core extension APIs remain available for immediate commands, not used as multiple group dispatches.

70 tests in four files cover all nine defaults/compatible targets, mixed install preservation and unrelated
edits, config/activation distinction, search fidelity, primary/group toggles, no-ops, undo/redo/save, malformed
and stale rejection, single-use/reentrant completion and all session/canvas revocations including failed lock.
A 1,000-target install emits only installation patches in one transaction with deferred saving. Two hundred
cancelled captures add no observers, dispatch or serialization. No wall-clock/FPS threshold or claim.

Validation: 529 focused pass / 57 files. Full frontend 1418 pass / same 15 failures / 14 known jsdom errors,
211 files. Typecheck, lint, architecture (485 files), production build/inspection, Rust fmt/all-target/all-feature
Clippy and Rust tests pass (72 / one ignored). Formatting still flags only the five recorded unrelated files;
touched-file formatting and diff checks pass. Stable index-DG64oq3j.js / index-Dci71JB_.css unchanged; existing
chunk-size warning remains. CODEMAP regenerated (625 files).

Updated plan/state/roadmap/view inventory/TESTING/CODEMAP and log. No foundational schema/security/material
decision changed; no ADR/parity acceptance change. The Tauri UI skill kept this support unmounted: no native
launch, screenshots/console inspection, user profile/database/keyring/benchmark access, commit or push.
Visible app/storage remain legacy. Next is **3d3c clipboard/duplication**, including creation/paste-time
auto-checkbox and inherited color (not retroactive extension installation). Search scroll reset, removed-
extension editor cleanup, selection and drop/presence effects remain view-owned cutover work; preferences
follow in 3d3d. Full step 3, media and atomic visible startup remain open.

---

## 2026-09-10 — Database intermission 3d3c1: internal copy/paste transactions

**Phase/slice:** Database integration 3d3c1, unmounted support. Reconfirmed architecture-v1 /
21599ec92551ed4605dc8737353f1cd9dad3a839 and saved 3d3b completion. Preserved all unrelated dirty work.
Split 3d3c into internal copy/duplicate insertion first and container-target/new-card/AI JSON next.

Audited App copyContextSelection/single copies/pasteCopiedItem/createTextCardInContainer and the AI JSON
module. Internal copy is single-use and cross-canvas. Current container copies expand only text cards;
contained images, even selected alongside their parent, are omitted. Preserved/documented that existing
limitation rather than changing retained behavior. Only edges between explicitly selected included
endpoints copy. Geometry clamping, displayed child coordinates, selection/focus and entry animations remain
view responsibilities. Fresh cards inherit container color; pasted cards and AI JSON retain supplied colors.
Automatic checkbox applies at creation/paste boundaries, not retroactively on extension installation.

Added typed copy contracts/snapshot, ID-remapping completion builder and one atomic paste handler to the
existing application composition. No new document format, rendering/geometry service, store or observer
pair. Copy values are detached and stored in one seventh completion-owner slot; opaque handles contain no
plaintext. Only this slot survives canvas changes, while existing gesture/edit invalidation still fires.
All session/workspace transitions, failed lock-save, explicit clear/disposal, cancel and supersession revoke.

Paste preflights fresh IDs, internal-only relationships, active destination and exact existing image metadata.
One transaction inserts elements, remapped parents/edges/extensions and layers; product acceptance retains
schema/configuration/relationship authority. Invalid candidates roll back together. Canonical dimensions,
copy-time content/config/activation and media IDs are preserved, container/block names gain ` copy`, individual
children detach. No media registration/byte decoding/copying or OS clipboard access. Root-copy insertion
cannot attach to existing containers; that requires 3d3c2 sibling/extension guards. Used field-local edge
assignment to avoid TypeScript's known recursive JsonObject/Immer type-instantiation limit.

43 tests / four files cover all five element types, mixed graphs, metadata/placeholders, source edits/deletion,
cross-canvas lifetime and revoked captures, identity/malformed/foreign-target failures, reentrant single-use,
undo/redo and one deferred save. Two hundred cancelled copies add no observers/dispatch/serialization. A
1,000-member paste records 2,000 localized element/layer insertion patches in one transaction. No FPS claim.

Validation: 572 focused pass / 61 files. Full frontend 1461 pass / same 15 failures / 14 known jsdom errors,
215 files. Typecheck/lint/architecture (495 files), production build/inspection, Rust fmt/all-target/all-feature
Clippy and Rust tests pass (72 / one ignored). Same five unrelated formatting failures remain; touched files
and diff checks pass. Stable index-DG64oq3j.js / index-Dci71JB_.css unchanged; existing chunk warning remains.
CODEMAP regenerated: 635 files. Updated plan/state/roadmap/view inventory/TESTING/ADR004/CODEMAP and log.

The Tauri UI skill kept support and visible acceptance separate: no native launch, screenshots/console
inspection, active user database/keyring/profile/benchmark/OS clipboard access, commit or push. Visible
app/storage remain legacy. **Next: 3d3c2 container-target paste, new-card companion rules and AI JSON
replacement**, then 3d3d settings/history/view-state. Reuse AI JSON validation without removed pick-card/raw
workflow logic; keep search scroll/editor/focus/selection cleanup local. Full step 3 and media/startup stay open.

---

## 2026-09-10 — Database intermission 3d3c2: container insertion and AI JSON

**Phase/slice:** Database integration 3d3c2, unmounted support. Reconfirmed architecture-v1 /
21599ec92551ed4605dc8737353f1cd9dad3a839, saved 3d3c1 handoff and current commands. Preserved unrelated work.

Added a shared captured-container precondition, companion helper, two atomic commands and callbacks for
fresh creation, single-card target paste and AI JSON replacement/export. Targets capture typed container,
children and installations; stale content/geometry/membership/order/extension values reject before writes.
New-card/AI actions use an eighth bounded canvas-scoped slot in the same owner. Internal Copy remains
cross-canvas, capturing its resolved target only at the synchronous Paste action. No new observer pair,
document/schema/renderer/geometry/persistence service or App ownership change.

Preserved retained presence semantics: active configured-off auto-checkbox/inherit controls still count;
inactive installations do not. Fresh cards inherit color; pasted cards/AI keep supplied colors. Copies keep
existing checkbox activation/check state; automatic defaults only fill an absent checkbox. Parent locks do
not prohibit content insertion/replacement. Commands require explicit fresh element/installation IDs and
canonical geometry; insertion index uses the full shared list, with visible callers responsible for existing
card-only drop mapping and displayed positions.

AI export/parser reuse the existing module; the serializer's parameter types now accept only readonly
structural fields, with identical runtime behavior. No legacy replacement helper, pick-card remapping or
raw workflow action was imported into execution. Replacement removes old cards and their installations,
preserves images/media/container controls and uses supplied colors/HTTP(S)/null links. New cards fill old
card slots then append surplus; images retain relative order and geometry. Changed lists renumber once to
respect the existing unique card/image namespace. Empty equal replacement retains references/order gaps.
Worked around the known recursive JsonObject/Immer type-instantiation limit using field-local Object.assign
and immutable read contracts; no data serialization workaround or unchecked input path was introduced.

50 new tests / four files. 627 focused pass / 66 files including five existing AI JSON compatibility tests.
Full frontend 1511 pass / same 15 failures / 14 known jsdom errors, 219 files. Typecheck/lint/architecture
(506 files), production build/inspection and Rust fmt/all-target/all-feature Clippy/tests pass (72 / one ignored).
Same five unrelated formatting failures remain; touched-file formatting/diff checks pass. Stable
index-DG64oq3j.js / index-Dci71JB_.css unchanged; existing chunk warning remains. CODEMAP: 646 files.
Tests cover companion cases, copying, atomic undo/redo/save, image preservation, strict/stale rejection and
lifetime/replay. Two hundred cancelled captures do no parsing/serialization/dispatch/additional observation;
a 1,000-card replacement records one transaction/deferred save and leaves media references untouched.

Updated plan/state/roadmap/view inventory/TESTING/CODEMAP and log. No foundational schema/security/material
decision or parity acceptance changed. The Tauri UI skill kept support separate from visible acceptance:
no native launch, screenshots/console inspection, active user database/profile/keyring/benchmark/OS clipboard
access, commit or push. Clipboard I/O and exported-string/local-draft purge, scroll reset/reveal, focus/
selection, editor/menu/toast and animation wiring remain visible work. **Next: 3d3d settings/history/view-state
routing.** Full step 3 stays open; media and atomic startup follow. Visible app/storage remain legacy.

---

## 2026-09-10 — Database intermission 3d3d1: captured settings and guarded history

**Phase/slice:** Phase 4.5 database intermission, step 3d3d1 (unmounted support).
**Commit(s):** No commit/push; preserved the dirty architecture-v1 worktree, HEAD
`21599ec92551ed4605dc8737353f1cd9dad3a839`.

Resumed from the repository handoff after 3d3c2. Split settings/history/view state into 3d3d1 document
settings/history and 3d3d2 device preferences/remembered camera plus remaining canvas-action gap audit.
The existing native settings client only chooses database paths/lists recents. No general preferences
transport exists yet; introducing one requires explicit edition/retention/privacy audit in the next part.

Added captured settings callbacks and one named command reusing the existing core schema/mutation inside
one transaction. The exact six existing leaves remain document-owned. Matching from/to leaf sets reject
stale/invalid edits while preserving unrelated concurrent fields, elements, canvases and media references.
Equal/cancelled completion is a no-op. A ninth bounded slot uses the existing observer pair and revocation
policy; no per-control subscriptions or new settings/persistence/geometry owner. Slider previews stay local.

Added undo/redo routes on that same callback owner through existing document transaction history. Available
history revokes all captures (including copy), cancels controller previews/selection before application,
blocks synchronous reentrant history/captures and aborts if invalidation changes workspace/session state.
Empty history preserves pending edits and performs no write. Failures are sanitized. Navigation stays
history-ignore; document-level undo can affect an earlier canvas without switching the current canvas.
Did not recreate legacy per-canvas snapshot arrays or commit an unfinished gesture before undo.

48 new tests / three files. 675 focused pass / 69 files. Coverage includes all settings leaves/groups,
stale/shape/bounds/device-field rejection, no-op/lifetime, real move/resize/pan/selection cancellation,
undo/redo/save, cross-canvas history, reentrant notifications and failed history/invalidation. A local
1,000-sample slider draft performs no dispatch/serialization/save; one completion uses the existing
transaction/deferred save. This is an API/ownership regression check, not a mounted slider/FPS benchmark.
Initial test failures were fixture issues (default flag values, parameterized array spreading and the
existing resize-controller input shape); corrected the fixtures without changing product behavior.

Full frontend: 1559 pass / same 15 failures / 14 known jsdom errors, 222 files. Typecheck, lint, architecture
(511 files), build/production exclusion and Rust fmt/all-target/all-feature Clippy/tests pass (72 / one
ignored). Stable index-DG64oq3j.js / index-Dci71JB_.css hashes unchanged; existing chunk warning remains.
Full formatting still reports only the five known unrelated files: AI-WORKFLOW.md, ContextMenus.tsx,
UiLabApp.tsx, FloatingCanvasToolbar.tsx and forms.css. Touched-file formatting/diff checks pass.
CODEMAP regenerated: 651 files. Sandbox test-worker startup was denied; reran authorized fixture tests
with subprocess permission. No active profile/database/keyring or benchmark data was used.

Updated plan/state/roadmap/view inventory/TESTING/CODEMAP/log. No foundational schema/security/material
decision changed. The Tauri UI skill kept unmounted support separate from live acceptance: no native
launch, screenshot/console inspection, active user data/OS clipboard access or production switch.
Visible app/storage remain legacy. Keyboard/modal/focus/menu/editor/copy-draft cleanup and visible settings
binding remain acceptance work; device preferences/camera persistence is not implemented by these callbacks.
**Next: 3d3d2.** Full step 3 stays open; media and atomic startup follow, then return to glass acceptance.

---

## 2026-09-12 — Consolidate remaining intermission work into outcome-based batches

User requested larger steps to reduce usage spent on repeated small handoffs. Documentation-only change;
implementation remains through 3d3d1, with visible app/storage still legacy. Preserved historical step
records but superseded their use as individual session boundaries in DATABASE-INTEGRATION-PLAN.

Next Batch A combines remaining step 3 (preferences/view state/canvas routing) and step 4 (real media and
cleanup). Batch B combines visible binding/atomic startup with database acceptance and disconnected-path
cleanup. Batch C returns to glass acceptance. Continue across internal checklist items without asking
for another resume; stop early only for actual authority/safety/decision/external constraints. Use focused
tests while iterating and consolidated full validation/docs at batch boundaries; preserve compact exact
checkpoints if interrupted. No waived phase gates, broader App refactor, new rendering authority or
permission to access user databases/load benchmark data. No code changes or new test/visual claims.

Updated plan, state, roadmap and log; validation is touched-document formatting and diff hygiene only.

---

## 2026-09-12 — Batch A: assembled database resources and canvas/media integration

**Phase/slice:** Phase 4.5 database intermission, remaining step-3 support + step-4 transport/resources.
**HEAD:** `21599ec92551ed4605dc8737353f1cd9dad3a839`; existing dirty worktree preserved, no commit.

Completed one grouped batch rather than stopping at callback microsteps. New edition-local device
preferences use a strict retained-field allowlist, CAS revision and atomic native replacement. Remembered
cameras are an opaque encrypted device-local cache using the existing session key/AEAD and a separate AAD
domain. No document schema/history/backup changes; no legacy preferences or keyring fallback. Factory
initialization restores pan/zoom with current screen dimensions; settled-only updates and ordinary
save-before-lock/close flush reuse existing lifecycle ownership. Forced purge rejects late resources.

Canvas callbacks now cover create/activate, order, name/size, confirmed clear/remove and root creation.
Product commands preserve last-canvas protection, previous-survivor activation, canvas resize clamping
and explicit clear semantics. Captures revoke through the existing owner, not new per-feature listeners.
Image import registers metadata and inserts through one transaction; stale completion cannot mutate the
replacement canvas/session. View-owned geometry/aspect defaults, focus and presence stay cutover work.

Extracted the existing pure SVG/GIF/raster validation/normalization recipe into Rust image_processing;
legacy imports and portable validation share it unchanged. New local-main resource capabilities support
session-bound 256 KiB chunk transport, one bounded 50 MiB upload and native-owned picker input. No raw
renderer file paths. Lazy loads verify media integrity/format once and read chunks; native buffers and
decode remain bounded, not zero-copy. Shared application URL leases limit reads to two and cancel/revoke
on release/session transition. Media never enters Redux or ordinary document saves; undo retains bytes.
No speculative media GC; failed/stale insertions may leave unreferenced media. Native path-only drag/drop
intake still requires authorized binding in Batch B, alongside picker/Blob/clipboard/UI integration.

Usage-limit interruption occurred before broad validation; resumed from implemented code/focused tests,
not a new audit. Final review reused zeroizing/redacted responses for decrypted cameras and aligned
TypeScript UTF-8/control-character preference checks with Rust. Suspected >256-camera overflow was not
reachable: document admission already caps canvases at 256. Reverted unnecessary eviction and added an
exact-limit fixture instead. An initial oversized fixture failed correctly; corrected fixture passes.

Validation: 32 new frontend tests; full suite **1591 pass / same 15 baseline failures / 14 known jsdom
errors**, 228 files. Failures remain in ExtensionsPanelContracts (2), FloatingToolbarContracts, Modals,
SettingsModal (4), WindowChromeContracts, FormControlsPrototype, InteractiveControlsPrototype,
SurfaceMaterialPrototype, AcrylicCompositorPlayground, Tabs and visualContracts. Existing focused set
passed 705 tests before final two boundary tests; final full suite includes both. Rust default and
all-feature suites each **77 pass / one ignored**, including five new resource tests. Rust fmt and
all-target/all-feature Clippy pass. Typecheck, lint, architecture (530 files), production build/exclusion
and explicit resource capability/guard checks pass. Stable index-DG64oq3j.js / index-Dci71JB_.css hashes
unchanged; existing large-chunk warning remains. Full formatting has only the same five unrelated files:
AI-WORKFLOW.md, ContextMenus.tsx, UiLabApp.tsx, FloatingCanvasToolbar.tsx and forms.css. CODEMAP: 679 files.

Updated plan/state/roadmap, view cutover checklist, CODEMAP, TESTING, DATA-FORMAT, SECURITY and ADR 005.
The Tauri UI skill kept unmounted support separate from visual acceptance: no native launch, screenshots
or console inspection. Tests used mocks/test-owned temporary databases only; no active user database,
profile/keyring, OS clipboard or benchmark access. No production startup switch or live parity claim.

**Next: Batch B**, the visible bindings and atomic legacy-storage exclusion together with native
database/security/retained-feature acceptance. Use the concrete DATABASE-VIEW-INTEGRATION checklist.
The new services are assembled but the visible app still uses legacy storage. Benchmark permission
remains files only. Resume glass acceptance as Batch C after actual database cutover acceptance.

---

## 2026-09-12 — Batch B startup safety check; live baseline unavailable

Resumed from the completed Batch A handoff and reread the cutover checklist/current implementation.
No TaskMap process was running; Tauri MCP status was disconnected and connection attempt found no app
at localhost:9223. Existing MCP build registration is already debug-feature-gated and loopback-bound;
no plugin or capability change is needed merely to fix the absent process.

Read-only startup audit confirms normal stable/dev setup still invokes `initialize_storage` and legacy
image GC. `initialize_storage` opens the edition's legacy SQLite file and calls shared keyring lookup/
creation; App mounts `load_app_data` immediately. Launching this before cutover would violate the saved
no-existing-data/keyring boundary. UI Lab's separate identifier/setup early return avoids legacy startup,
but native application guards deny database IPC there and it does not mount the full retained canvas.
No existing storage-free full-app launch option was found. Do not broaden UI Lab database permissions.

The Tauri UI skill requires a real before/after baseline for visible changes. Paused visible cutover
pending an isolated Windows account/VM or an agreed storage-free baseline arrangement; did not launch
normal dev, access user data/keyring, load a benchmark, or implement an unverified partial switch.
Only checkpoint documentation changed; no new test, screenshot, console or parity claim. Batch A stays
complete locally; Batch B is not complete. Resume from this prerequisite, not another callback audit.

---

## 2026-09-12 — Protect old installation with a storage-free UI baseline

User clarified that old main-branch data matters and the refactor development content is disposable,
then explicitly required preserving the old data. Implemented a separate `app:preview:mcp` launch;
did not reset the dev database or touch/export the shared keyring credential. This is the Batch B
baseline safety prerequisite, not a smaller replacement for its grouped visible/database cutover.

`storage-free-preview` requires `com.merkdesigns.taskmap.storage-preview` before plugin/single-instance
setup and refuses release compilation. Dedicated config uses loopback port 6971 and its own WebView
identity, no updater/bundling, and minimal local-main capability. Rust skips legacy startup/image GC/
window-state access; native session/path/keyring, image and portable command guards deny before I/O.
The only legacy data grant returns null, so App uses its built-in defaults (Canvas 1 / Container 1),
not data from either installation. Autosave/RPC/automatic updates are preview-only disabled; other
save/reset/import routes fail rather than faking successful persistence. A permanent no-save notice
identifies the disposable view. No new rendering/store/crypto abstraction or product cutover.

Live Tauri verification: backend identity was the dedicated preview, debug Windows x86_64, Tauri 2.11.2,
1280x820 viewport. Inspected initial canvas and opened Canvas Browser via the actual button; inspected
native screenshots and accessibility snapshots. Console error query was empty before and after.
Confirmed null baseline load and permission denial for nine commands: reset_local_database,
save_app_data_incremental, import_app_data, export_app_data, store_image_path, app_load_preferences,
app_create_database, run_saved_commands and updater check. No sensitive arguments were supplied.
Closed through the real Close window button; launch process exited successfully. Screenshot artifact:
`C:/Users/Merk/.codex/visualizations/2026/09/05/01a06fcc-a1b3-7233-a5e5-82537e34fa71/storage-preview-baseline.png`.
MCP reported the existing 0.12/0.13 version warning; connection/inspection worked, no plugin upgrade made.

Two new native policy tests pass. Full default and all-feature Rust suites each pass: 79 pass / one
ignored. Rust fmt/Clippy, TypeScript, lint, architecture (530 files), build
and production inspection pass. The new storage-preview static safety check is part of production
inspection. Frontend full suite: 1591 pass / same 15 baseline failures / 14 known jsdom errors. An initial
concurrent Rust/frontend run additionally timed out the thousand-member copy test; it passed isolated
and on the final full rerun without Rust contention. Updated the UI Lab source-contract assertion for
the expanded updater exclusion (Lab OR preview); no unrelated test behavior was changed.
An initial boolean condition changed emitted JS coercion; equivalent preview ternaries compile away
exactly, restoring index-DG64oq3j.js / index-Dci71JB_.css. Five pre-existing formatting failures remain.
CODEMAP regenerated: 681 files. Normal dev/stable scripts and installed binaries are unchanged.

No old app/profile/database/credential was read, copied, renamed, overwritten or deleted. No backups
were made or claimed; no old-data health/recovery guarantee, benchmark load or database parity claim.
Updated state/plan, ADR 004, SECURITY, TESTING and CODEMAP. The Tauri skill enabled verified baseline
inspection rather than requiring access to real data. **Next remains Batch B's coherent visible binding
and database cutover**, starting from this baseline. Do not use ordinary app:dev/app:dev:mcp/app:stable
for our testing until legacy startup is removed. Preview grants no database authority and must not be
broadened to bypass that next cutover. User's old installation and shared credential remain protected.

---

## 2026-09-13 — Finish interrupted protection checkpoint

Confirmed the saved preview guards/config and unchanged branch/HEAD after the usage interruption.
The last default Rust run had completed successfully (79 pass / one ignored), as had final Rust fmt,
lint, CODEMAP consistency and diff hygiene. Recorded that result instead of repeating completed suites.
Reran the storage-preview static safety check and checked documentation formatting/diff hygiene.
No app launch or data/credential access in this resume. Safety setup is complete; full Batch B visible
binding/new-database cutover is not implemented or accepted. Continue from the verified preview baseline.

---

## 2026-09-13 — Batch B entry-flow implementation checkpoint (not cutover)

Implemented `features/database-entry` around the existing controller: closed/create/open/recent/unlock,
sanitized errors, confirmation/UTF-8 password validation with immediate DOM clearing, guarded async
picker/submission/cancellation, resource readiness/retry and acknowledged recovered revisions before
mounting children. One stable injected runtime; no new document/render/material ownership. Bootstrap
survives StrictMode without a second resume. Resource/epoch changes revoke readiness and late results.

Created the separate storage-free entry-flow HTML/fixture with real application lifecycle and in-memory
transport, explicitly showing an admitted placeholder rather than pretending to bind the existing canvas.
Moved the fixture under its feature instead of weakening `ui/dev`'s no-domain/persistence rule. The first
mock recovery revision equalled the active revision and was correctly rejected; fixed the fixture and
added direct create/reopen/recovery tests. No actual database, media bytes, keyring or benchmark involved.

Live Tauri skill checks: connected to dedicated preview identity/port 9223; baseline screenshot first.
Inspected entry start/create/confirmation-error/wrong-password/recovery screenshots, exercised create,
lock, rejected/successful unlock, Back, recents and recovery acknowledgement, and verified cleared
password DOM and empty final reloaded console warnings/errors. On closing the preview, the terminal's
historical log showed an intermediate React hook-order warning during hot edits; the later clean page
loads and final lifecycle tests were clear. Closed the preview through its UI; process exited 0.
Initial preview chrome lacked theme scope; corrected
the preview composition. Existing Button discarded explicit `tabIndex`, fixed while preserving its
canvas default. New form opts into native tab navigation; RTL tests verify Tab/Shift+Tab. The Tauri key
tool did not advance native Tab focus, so no native Tab-traversal claim is made. Returned to the actual
built-in canvas and inspected unchanged chrome/Canvases default tab index. Screenshot artifact:
`C:/Users/Merk/.codex/visualizations/2026/09/05/01a06fcc-a1b3-7233-a5e5-82537e34fa71/database-entry-wrong-password.png`.

Validation: 23 new tests; 30 focused pass. Full frontend 1614 pass / identical 15 baseline failures /
14 known jsdom errors (231 files, 33.33s). Initial sandbox test worker spawn EPERM resolved by approved
fixture-only rerun. Typecheck/lint/architecture (541 files), build/production exclusion and touched
formatting pass. Full formatting has the same five unrelated failures. CODEMAP 692 files. Stable main
`index-BBsK-CJY.js` (~626.73 kB), unchanged `index-Dci71JB_.css`; JavaScript change is the shared keyboard
support, and simulated entry code stays excluded. Rust unchanged; prior native result 79 pass / one
ignored, no new Rust phase-completion claim. No user app/profile/file/credential access or mutation.

Batch B remains incomplete. Next is actual retained-view callbacks, preferences/cameras/media leases,
boot/disposal/native close and OS/inactivity lock, then atomic old storage disconnection and live
disposable-file acceptance. Do not reimplement completed supporting callbacks or label the preview
placeholder production integration. Normal startup remains legacy; do not launch it for testing yet.
Updated STATE, integration plan, TESTING and CODEMAP; no roadmap/feature parity gate closed.

## 2026-09-13 — Batch B retained canvas lifetime binding

Continued the database intermission by connecting the retained projection and existing interaction
controller to the same admitted workspace/session lifetime. `createRetainedCanvasBinding` publishes
immutable view/settings snapshots only for completed workspace changes and session editability changes.
The factory now exposes singleton `bindCanvas` in place of standalone `createInteraction`, requiring
initialized resources and a UI revocation callback. Canvas switches restore per-canvas settled cameras
using current screen dimensions. No document/camera mirror, rendering strategy or pointer subscription
was introduced. Named action callbacks and history stay with their existing owners.

Lock/cancellation/workspace replacement/disposal permanently revoke the binding, clear projection
caches and interaction state, unsubscribe observers and invoke the UI cleanup boundary. Reentrant
camera observers cannot restore cleared views. Review caught two cleanup hazards: a failed UI hook
must remain retryable, and interaction observer exceptions must not skip controller disposal. Both
are covered. The actual retained UI must still mount this binding and clear its own drafts/clipboard/
JSON/menu/media elements through the required callback; production startup remains legacy.

Validation: fourteen new tests pass, including camera-switch/undo/save-failure/revocation/transport
ownership cases and 200 real-controller camera samples without view notifications, serialization,
document/history mutation or database saves. Initial focused integration set: 42 pass; final binding
and entry-race set: 23 pass. Final full frontend: 1628 pass / the same 15 baseline failures / 14 known
jsdom errors (234 files, 42.78s). A concurrent validation run had one additional entry resource/reunlock
test failure; it passed isolated and on the final full run without the concurrent build. Vite worker
spawn EPERM required approved fixture-test/build reruns. No unrelated baseline tests were changed.

Typecheck, lint, architecture (546 files), production build/guards and touched formatting pass.
CODEMAP is current at 697 files. Five pre-existing full-format failures remain. Main stable assets
remain index-BBsK-CJY.js / index-Dci71JB_.css; the binding is not in the mounted production path.
Rust was unchanged and not rerun; prior 79 pass / one ignored remains historical validation.
No application was launched, no screenshots or visual acceptance claimed, and no user database,
profile, credential or benchmark was accessed. The Tauri skill's before/after requirement applies
when the binding is mounted and visible behavior changes; this checkpoint changes supporting owners.

Updated STATE, integration plan/inventory, TESTING and generated CODEMAP. Batch B remains open:
connect the actual retained canvas/control/media consumers, boot/disposal/native close and OS/inactivity
lock, then atomically disconnect old storage and run disposable-file Tauri parity/restart acceptance.
Do not restart completed action plumbing or treat this lifetime binding as the visible cutover.

## Entry template

## YYYY-MM-DD — Short task name

**Phase/slice:**  
**Commit(s):**  
**Goal:**

### What changed

### Problems / observations

### Experiments or reverted approaches

### Verification / measurements

### Decision

### Follow-ups

### Documentation updated

## 2026-09-15 — Batch B canvas integration in progress after usage interruptions

Mounted the actual App presentation only in the isolated in-memory entry preview. Added
RetainedCanvasApplication/Context and newly-authored element mapping; extracted shared application
runtime composition so preview/native factories share admission, callbacks, preferences, views and
media services. Production AppShell still mounts LegacyApplication. Named branches now cover initial
creation/content/deletion/canvas routing/card drop/connection completion/history. Rejected old collection
setters expose remaining wiring. This is not a completed cutover or complete feature parity.

Native storage-free Tauri identity/viewport: com.merkdesigns.taskmap.storage-preview, 1280x820, port 9223.
Inspected unchanged built-in baseline and real retained renderer screenshots. Verified canvas creation
and undo/redo, container creation/movement, contained-card creation, detach to canvas and undo back into
container, lock/unlock with visible content removal/restoration. MCP swipe emitted no PointerEvents;
injected pointerdown/move/up through the actual WebView event handlers for movement/drop verification.
Final console error queries were empty. Fixed duplicate chrome and overlapping preview controls.
Creation initially proposed a checkbox companion when none was installed; corrected to presence-based
Auto Checkbox semantics, including an active installation configured off. Mounted UI test covers it.

Actual Canvas Manager test revealed non-history navigation invalidated create undo's round-trip check.
History now reconciles selection when its canvas disappears or navigation differs from the captured
selection. All content fields still round-trip; nonexistent selection patches remain rejected. Added
regression tests. The in-memory preview preserves its saved revision across close/open.

Core validation: 129 focused integration/entry/projection/contract cases and 20 history/UI/routing cases
passed; full final run with maxWorkers=2: 1632 pass / 15 known baseline failures / 14 known jsdom errors,
235 files, 88.46s. A resource-reunlock timing failure recurred under concurrent lint/format contention;
it passed focused and in the final reduced-contention run. Updated the clear source-contract check for
both command/legacy ownership and the preview guard for the additional retained autosave exclusion.
Typecheck, lint, architecture (552 files), build and production isolation passed. Stable JS
index-RAhlV93C.js 635.32 kB, CSS index-Dci71JB_.css unchanged. Five existing formatting failures remain.
Rust unchanged; no new Rust/phase-completion claim. Vite spawn EPERM required approved fixture-only
worker/build launches. No old user storage, keyring, installed app, media bytes or benchmark access.

Continuing extension controls: added retainedViewExtensions aliases and registry-compatible atomic
installation, App removal/lock/privacy/checkbox/search routes, and injectable extension lists for the
main/Quick browsers. Removed extensions are excluded only from the retained route. 74 focused tests
pass; this newest extension portion still needs native inspection and consolidated checks. Settings,
copy/AI JSON, media, native forced-lock/close, synchronous UI purge and production disconnection remain.

### 2026-09-19 — Batch B settings/JSON binding and window-close correction

Resumed the in-progress settings hook work. Document settings use captured commands; device
preferences use queued functional updates. Mounted tests cover 100 local opacity samples, one release
transaction, cancellation (including continued samples after Escape), preference composition, and
lock/unlock. The retained Settings route now exposes session Lock/Close and hides legacy data and
Discord actions. Added captured AI JSON view completion, editor/async clipboard routing, and draft
cleanup on invalidation; invalid JSON can be corrected before consuming the capture. Fixture tests
cover canonical fresh card IDs/checkbox companions, atomic undo, and expired clipboard completion.

User reported X doing nothing but could not recall the screen. Basic and unlocked-preview close worked;
native hit testing with Settings open then reproduced the modal scrim covering X. Selector-based MCP
clicks bypass this occlusion, so used elementFromPoint and actual coordinate clicks for acceptance.
Portaled the existing WindowChrome above modal layers without changing control geometry/material.
Added a platform close-event adapter and application close coordinator; the database preview awaits
its memory session's close/save/purge before window destruction, deduplicates requests, allows failure
retry, and ignores disposed completions. Production close-to-keeper/Windows-lock wiring remains open.

Native isolated preview: baseline and database windows both closed from coordinate X with Settings
open; final hit testing reached the button. Also drag-installed Copy/Paste JSON, applied two disposable
cards in the editor, and verified undo removed/restored the whole replacement. Screenshots inspected;
final console errors empty. Preview still uses simulated files, no real persistence/crypto acceptance.

Full frontend: 1642 pass / 15 unchanged baseline failures / 14 known jsdom errors, 239 files, 100.62s
with two workers. Typecheck/lint/architecture/build/production isolation pass; CODEMAP now 715 files.
An initial new close test supplied an incomplete canvas record; corrected the fixture and asserted
creation success before save/reopen verification. Rust untouched, no native phase-gate claim. Existing
user storage/keyring/benchmarks untouched. Continue the same Batch B with remaining internal clipboard,
media, screenshot privacy, forced lifecycle/purge, and atomic production cutover acceptance.

### 2026-09-19 — Batch B internal clipboard binding

Connected retained App Copy/Cut/Paste menus and Ctrl+C/Ctrl+V to the existing captured-copy and paste
commands. `retainedViewClipboard` maps fresh identities and canonical paste positions, including
container children and copied extension/connection identities; the UI retains placement metadata only.
Added callback-handle activity inspection so navigation preserves the copy while history, cancellation,
session loss, and disposal discard it. Retained the existing consume-after-one-paste behavior.
No OS clipboard write/read was needed for these internal-copy checks.

Tests exercise copy-time content preservation after source edits, cross-canvas paste, one history
transaction, checkbox preservation, shared card/image insertion, 100 non-serializing transient copies,
and mounted menus/keyboard/history invalidation without legacy IPC. Initial fixture checks exposed the
difference between sparse stored order values and sibling insertion indices; paste now resolves the
actual sorted sibling index. The keyboard fixture uses a DOM event target matching native input.

Actual storage-free Tauri preview: menu container copy, Ctrl+C/Ctrl+V, paste into a second canvas,
card paste into a container, cut a contained card onto the canvas, undo/redo, then copy/lock/unlock and
confirm Paste is unavailable. Screenshots inspected; final console errors empty. Disposable fixture
content only; no existing database, keyring, benchmark, or media access.

Full frontend 1646 pass / same 15 baseline failures / 14 known jsdom errors, 240 files, 84.64s with
two workers. Typecheck/lint/architecture pass (565 target files); CODEMAP refreshed (717 files).
Continue Batch B with visible image/GIF loading/intake, screenshot privacy, native lifecycle/purge,
and production storage cutover. This internal clipboard binding does not close the batch.

## 2026-09-21 — Batch B visible media, captured replacement and authorized native drops

User requested a progress bar and expected/achieved percentage changes for each step. Established
a scope-weighted estimate for the database intermission only: 60% before media, 72% after this
implementation/fixture cycle (+12 points). The estimated media milestone totals 15 points; its
remaining 3 cover real Windows/native-database media acceptance. Remaining weights and the reporting
rule are recorded in REFACTOR-STATE. This is not an effort/time estimate or full-project percentage.

RetainedImageNode now mounts inside existing culling and acquires the shared session URL lease only
while visible. It releases on culling/replacement/unmount; session transitions revoke the service's
URLs. The retained App bypasses legacy cache reads. ImageNode accepts explicit media presence rather
than treating an opaque ID as an old image hash, preserves the existing presentation, displays missing
media explicitly and shows the loading state while filling a placeholder. Background shadow decisions
also use retained media presence.

Picker and clipboard intake capture before async work. A dedicated image replacement command checks
expected media, placement and geometry, retains unrelated content and connections, follows geometry
lock rules for placeholder sizing, and keeps an existing image's box on replacement. Registration plus
replacement is one reversible transaction. New clipboard imports insert once after successful storage;
they do not create an intermediate persistent placeholder/history entry. Media bytes never enter Redux.
Cancelled/stale imports may leave unreferenced stored bytes; destructive media GC remains deferred.

Native main-window drops now issue bounded one-use tokens with 60-second expiry. Pending source paths
belong to OpenSession and are discarded on lock/close/OS-lock service calls, avoiding a separate native
cache that could outlive the session. Redemption takes only token/session IDs and reuses the existing
Rust image import and authority checks. Renderer drop handling processes files sequentially and stops
when the captured workspace/canvas changes. The legacy path listener is bypassed for retained views.
The new capability remains unavailable in storage-free preview and UI Lab. ADR 005 records the intake.

Actual dedicated storage-free Tauri preview: captured before/after screenshots for placeholder fill;
injected a generated 359-byte two-frame GIF through the real clipboard event handler; verified display,
undo removing the image and redo restoring it; replaced it with the built-in SVG and confirmed its
80x80 box stayed unchanged; undid replacement; locked and confirmed all image DOM was removed, then
unlocked. No OS clipboard contents were read or changed. Preview picker returns a built-in SVG;
preview byte import supports small GIF/WebP fixtures only. This does not validate native picker/drop,
raster normalization, animated-frame fidelity under glass, real persistence, or production lifecycle.
Screenshots inspected and final console errors empty. No existing databases/keyring/benchmark access.

Validation: full frontend 1659 pass / unchanged 15 baseline failures / 14 known jsdom errors, 243 files,
95.43s with two workers. Thirteen new frontend cases include stale replacement/navigation/lock,
one-transaction history, placeholder sizing, missing media and 100 pointer rerenders with one lease.
Native default and storage-preview/MCP configurations: fmt/Clippy pass; 82 tests pass / one ignored.
The first sandboxed native run hit the known test-owned process-tree termination restriction; the
authorized rerun passed. Typecheck/lint/architecture (572 target files), build/production isolation and
CODEMAP pass (728 files). CSS unchanged at index-OxTBdBL4.css, main JS index-BEDkmGPl.js 652.05 kB.
Unrelated baseline failures are preserved. Production startup is still legacy; Batch B remains open.

Continue with native screenshot privacy, forced-session lifecycle and synchronous UI purge, then the
atomic production switch and real disposable-database/media/recovery/isolation acceptance. Expected
next lifecycle/purge step: +10 points, from approximately 72% to 82% when verified.

## 2026-09-22 — Batch B native revocation, privacy and synchronous view purge

Database-integration estimate advances from 72% to 80% (+8 of the planned +10 points).
Two points remain for real Windows lock/capture acceptance. This is scope estimation, not a phase
completion claim. Production remains legacy; no user databases or keyring were accessed.

Added native WTS notifications to main/recreated/session-keeper windows, with owning-thread subclass
registration and destruction cleanup. Native lock clears keys and media authority before emitting a
content-free revocation event. The native runtime subscribes before admission. Forced frontend
revocation clears plaintext immediately, rejects late admission, avoids saving, and preserves a
confirmed locked candidate; explicit cancel/disposal still closes it. Retained view revocation uses
synchronous unmount to remove editors and portals; callback references are cleared on unmount.

Window privacy is serialized before preference publication and applied after preference load before
document admission. Native or preference failure revokes the view. The native factory and preview use
the actual window adapter. Preview forced-lock remains a memory fixture; WTS is disabled there.

Validation: seven added frontend cases cover forced revocation/cancel races, privacy sequencing,
failure/disposal, and synchronous removal of an unsaved editor. Full frontend: 1666 passed, unchanged
15 baseline failures and 14 known errors, 245 files, 125.54 seconds. Default and storage-preview Rust:
82 passed, one ignored each; fmt/Clippy passed. Typecheck, lint, architecture (578 targets), production
build and storage-preview isolation passed; CODEMAP contains 734 files. Preview constructor guard
was updated to account for the explicit native privacy adapter. Build assets: index-DSp57KUh.css
109.17 kB and index-0Q5wMJtP.js 652.28 kB.

Actual Tauri preview inspected at 1280x820: privacy on/off native calls completed and toggle updated;
forced lock with settings open removed both settings portal and canvas in the same JS callback;
unlock screen screenshot inspected, then fixture unlock restored the canvas. Console warnings/errors
were empty. Privacy was restored off. The MCP native screenshot still captured the protected window:
this is not proof of screenshot exclusion. Real Windows session lock, capture-tool exclusion,
native media acceptance and atomic production activation remain open. No OS lock was triggered.

The usage interruption preserved the worktree. Resumption confirmed completed validation logs before
recording this checkpoint. Next coherent step is the atomic production switch (+5 estimated points),
with real disposable-database/media/recovery/isolation and Windows lifecycle acceptance still required.

## 2026-09-22 — Batch B product startup switch and native X-close

Database integration advances from approximately 80% to 85% (+5 points, as estimated). This is not
full Batch B acceptance: 3 media, 2 Windows lock/privacy and 10 database/recovery/isolation/parity
points remain. Next work is actual fresh disposable-database operation and restart/keeper/recovery
acceptance. Existing user files/keyring/benchmark data were not opened or converted.

AppShell now composes DatabaseApplication. Its single renderer-lifetime native runtime survives
StrictMode; entry admission mounts the existing retained canvas. Window controls sit outside the
canvas error boundary. Closing an unlocked window flushes the coordinator/resources before destroy,
leaving native keeper ownership; closing during admission cancels. Boot failure still permits X.
The retained App's competing legacy close/privacy listeners and Discord hook are disabled. Updater
save preparation uses the database flush. Dev configs boot the product entry rather than the harness,
and use empty updater endpoints so they cannot inherit stable updates; a Dev update channel is not
configured yet. Stable update configuration is retained.

Removed legacy modules from native compilation/startup, including keyring storage, old media access,
portable format conversion/migrations and Discord. Removed raw runner implementation and legacy IPC
handlers/default grants. Retired storage/media/conversion source remains unreferenced for later cleanup;
legacy Cargo dependencies have not yet been pruned. The storage preview retains only an empty-load
stub with no filesystem access; product calls to that stub are denied. A cutover boundary script checks
startup/module/permissions/config separation. Updated AppShell/isolation tests for the intentional new
composition and CODEMAP (737 files). No renderer/visual redesign.

Validation: three new boot/close tests; focused mounted suite 8 pass and updated startup/isolation
suite 19 pass. Final full frontend: 1669 pass / unchanged 15 baseline failures / 14 known jsdom errors,
246 files, 86.26s. The first full run exposed four stale startup assertions, corrected and rerun.
Typecheck, lint, architecture (580 targets), build, production/preview/cutover boundaries and touched
formatting pass. Rust fmt, default and Dev/MCP Clippy pass; each native suite 61 pass / one ignored.
The count dropped from 82 because legacy modules/raw runner tests no longer compile, not because new
storage tests were skipped. Main JS index-DZpdOiAP.js 743.04 kB; main CSS index-CunSRUrI.css 110.49 kB.

Automatic approval review initially denied ordinary Dev launch pending cutover validation. After the
above evidence, a reviewed retry was approved. Actual com.merkdesigns.taskmap.dev launched the new
empty entry screen on port 6969, with native MCP 9223. DOM and screenshot inspected: New/Open/Refresh
and window controls present, no simulated-data notice or old workspace. Console errors/warnings empty.
Clicked the real X through its DOM button; the launcher/app exited with code 0. No database picker,
create/open, old document, keyring, clipboard or benchmark content was accessed. This verifies empty
entry startup and close, not save-before-close/keeper reopening with an actual database, real OS-lock
or screenshot exclusion. The initial review rejection is resolved; no approval remains pending.

### 2026-09-22 live acceptance in progress (resume checkpoint)

Test-owned file: workspace `.tmp-acceptance-sept22.tmapdb`; throwaway password fixture-only.
Created through real Windows Save As; edited container/card through retained UI. Native revisions
advanced to 5. X immediately after a card completion removed the main window; launching the same
Dev executable recreated it with both texts and the same unlocked native session. Explicit Settings
lock removed canvas/text, wrong password was rejected and field cleared, correct unlock restored it.
Native picker imported `.tmp-acceptance-animated.gif` (generated two-frame 64x64 fixture, 6251 bytes).
Database read-only query confirms image/gif bytes at revision 7; native screenshots show both red/blue
frames. Full process restart, backup/recovery, save failure and remaining parity are next. Existing
user databases/keyring/benchmark content untouched. Current source unchanged since cutover.

### 2026-09-22 acceptance continuation and interrupted save-retry check

Progress estimate 85% -> 92% (+7): native fresh-file creation, text saves, X/keeper reopen,
explicit lock/wrong-password retry, full process restart/password-gated restoration, GIF native picker
and exact-byte persistence/reload, two animation frames seen, native full backup revision 7 with media.
The plaintext test strings were absent from the database bytes. Native backup was tested through the
existing authorized native picker/IPC, not a new settings UI. Prepared `.tmp-acceptance-recovery.tmapdb`
from the backup with one ciphertext byte flipped; it has not yet been opened. No existing user data.

Injected a SQLite update-abort trigger only into `.tmp-acceptance-sept22.tmapdb`. Failed close correctly
kept the window, but exposed no retry of failed persistence and premature media URL revocation on busy.
Fixed controller explicit lifecycle retries for failed save state (conflicts remain blocked), and media
read/lease lifetime while unlocked regardless of busy; new imports stay blocked while busy. Five new
regression cases; focused 24 passed. Live fixed retest: save-failure alert plus canvas retained and GIF
blob still fetchable. Trigger removed before retrying X. Readback after that retry is still pending.
Hot reload during development reset only the disposable fixture; no real user document was present.

Computer Use was stopped by physical Escape before final window/process verification. No more Computer
Use calls were issued. Approval review then rejected launching the same Dev executable because it saw
an existing taskmap process; unlike the earlier full-restart rejection (resolved by confirming no
process/windows), this block remains unresolved. Inspect current session first on resume. Do not kill
or duplicate an ambiguous process. Recovery acknowledgment, backup restore, native drop/raster, actual
Windows lock/capture privacy and remaining retained parity remain open. Current launcher session 66303,
MCP port 9223; main may be destroyed with only the hidden keeper alive. The test save-fault trigger is
removed. Resume exact native state rather than rebuilding earlier fixtures.

### 2026-09-23 — Batch B native recovery and media acceptance resumed

- Resumed after the user authorized continuation. Fresh process/window inspection found the Dev
  process with only its hidden session keeper; the approved single-instance reopen restored the
  failed-save retry result. Original test database was revision 8, with no fault trigger remaining,
  and Text block 1 persisted. This closes the prior pending save-retry readback.
- Opened the native full backup: revision-7 text and animated GIF restored. Opened the intentionally
  damaged workspace-owned copy: recovery correctly offered revision 6, withheld the canvas until
  acknowledgement, and left revision 7 untouched on open/acknowledgement.
- Added Recovered and saved Sept23, imported the repository icon PNG through the actual Windows
  picker, and observed a loaded 512 x 512 image. Read-only SQL confirmed WebP normalization
  (10,478 bytes) and save revision 10. Closed/reopened the database: text and image restored, with
  no recovery warning or alert. Inspected the native screenshot and empty console errors/warnings.
- Validation after the preceding fixes: build, production inspection, architecture check (580
  targets), and CODEMAP (737 files) passed. Main bundle 743.11 kB, CSS 110.49 kB. Latest full frontend
  result remains 1,674 passing / 15 baseline failures / 14 known jsdom errors; focused regressions
  24 passing, typecheck/lint passed. Rust unchanged since 61 pass / one ignored plus fmt/Clippy.
- Database integration estimate advances 92% -> 95% (+3 points for retry readback, backup restore,
  and recovery/save/reopen). Remaining: native-drop/media acceptance (1), Windows lock/privacy (2),
  and remaining isolation/parity (2). No overall phase completion claimed.
- Observed recreated main window at 800 x 600 rather than its former size; investigate geometry
  preservation under destroy/keeper reopen before shell parity acceptance. No fix claimed.
- Current Dev canvas is the test-owned .tmp-acceptance-recovery.tmapdb, valid revision 10.
  No existing user database, keyring, stable app identity, or benchmark was accessed.

### 2026-09-23 — Batch B window geometry preservation

- Found two missing links: custom X bypassed CloseRequested geometry saving, and the keeper's
  replacement window never called restore_window_state. Added main-window-only app_destroy_main_window
  under the existing local product capability. After the frontend save guard completes, native code
  saves geometry and destroys the window; geometry-write failure remains best effort so it cannot
  trap users. Storage-free preview/UI Lab retain their original destruction path.
- Keeper recreation now restores saved geometry. Saved client dimensions replace outer dimensions,
  matching Tauri set_size and avoiding growth by frame borders on repeated reopen.
- Native Dev acceptance on the workspace-owned recovered database: resized client to 1100 x 760,
  pressed X, verified only hidden keeper remained and edition-local JSON stored matching dimensions.
  Single-instance reopen restored client 1100 x 760 and outer position (631, 200), with text/image
  intact. Clean app quit and full Dev restart preserved the same geometry and returned to entry UI.
  Inspected screenshots; console warning/error logs empty. Maximized/multi-display checks remain open.
- Validation: 10 focused frontend tests pass including four new platform cases; Rust Dev/MCP suite
  61 pass / one ignored; Clippy all targets with Dev/MCP features passes. Typecheck, lint, touched
  formatting, Rust fmt, production boundary checks, architecture (581 files), CODEMAP (738 files)
  and diff whitespace checks pass. Full frontend baseline results from prior checkpoint unchanged;
  this local fix does not close a phase gate. Initial sandbox Vite EPERM resolved by approved launch.
- Progress: database integration 95% -> 96% (+1). Remaining: native-drop/media (1), Windows
  lock/privacy (2), remaining isolation/parity (1). Native Dev is left at the database entry screen.

### 2026-09-23 — Batch B automated validation and manual handoff

- User preferred other checks first, then explicitly requested manual tests where that saves usage.
  Completed the already-running production build/boundary checks and default Rust tests (61 pass,
  one ignored). Full frontend: 1,678 pass / same 15 baseline failures / 14 known jsdom errors, 247
  files, 36.50 seconds. No new implementation change or acceptance percentage credited (still 96%).
- Opened/unlocked only .tmp-acceptance-recovery.tmapdb, verified fixture text and one image present.
  Left canvas ready for user native-drop, Windows lock and screenshot privacy checks. Test password
  is fixture-only. Test GIF is .tmp-acceptance-animated.gif in the workspace.
- Requested manual results for GIF drop/persistence, Windows session-lock revocation, privacy capture
  exclusion and maximized/multi-display geometry. These remain unverified; no simulated drop event
  or synthetic Windows lock was substituted for native acceptance. Do not rerun full suites without
  new changes or failures that justify it.

### 2026-09-23 — User manual acceptance report

- User reported "everything works" following the manual checklist covering Explorer GIF drop and
  persistence, Windows lock, screenshot privacy and maximized window reopening. Record as user-reported
  acceptance; multi-monitor coverage was optional and not individually confirmed.
- User does not personally need Windows+L locking but explicitly chose to leave the implemented
  behavior in place. No removal or additional locking feature work is requested.
- Database integration estimate 96% -> 99% (+3 for native media and Windows lock/privacy checks).
  Core implementation is present and active; final integration-wide parity/isolation review and
  acceptance-document reconciliation remain before formal Batch B closure. Known baseline failures
  are not silently reclassified as passing. Do not repeat the user's completed manual checks.

### 2026-09-23 — Final integration review: accepted flows and remaining limits

- Reconciled integration checkboxes for visible entry, confirmed canvas admission, real media lifecycle,
  safe legacy exclusion, current-format persistence/recovery and native session locking using prior
  source inspection and recorded native/manual evidence. Updated SECURITY's obsolete claim that WTS
  delivery was absent and added narrow database evidence to FEATURE-PARITY without accepting unrelated
  features or Phase 5 ownership. No code changes or redundant test run.
- Found configurable inactivity locking absent despite inclusion in the activation checklist. User
  explicitly chose to defer it. Keep the implemented Windows+L behavior. No timer implementation is
  authorized/required for this activation scope now.
- Corrected earlier implication that the final 1% was merely paperwork: native retained-feature
  round-trip parity and packaged/live edition coexistence remain unproven. The user's earlier four
  manual checks do not establish all retained features. Progress stays 99%, +0 this review.
- Core database implementation is active and its main flows accepted. Formal Batch B/all-green phase
  closure is not claimed. Known 15 frontend baseline failures/14 jsdom errors remain explicit.
- Prefer a short user-led retained-feature round-trip check over costly UI automation, per request.
  Keep stable installed app/data untouched; no automatic stable launch for coexistence testing.

### 2026-09-23 — User retained-feature round-trip acceptance

- In response to the requested retained-feature round-trip checklist, user reported "everything seems
  to work and be fine." Accept that manual integration check as user-reported evidence; do not repeat
  it or characterize it as an agent-observed exhaustive test.
- Core database implementation and requested manual acceptance checks are complete. Packaged-build
  and live stable/development coexistence validation remain open, alongside recorded baseline test
  failures. No release/phase completion claim and no new implementation required by this report.
- Integration estimate remains 99% pending the outstanding packaging/isolation gate.

### 2026-09-23 — Database session wrapped at user request

- Final handoff: core database implementation active and accepted through recorded native checks and
  user manual reports. No remaining binding/cutover feature work is planned. Leave Windows lock in
  place; inactivity lock deferred. Do not repeat completed user checks.
- Integration validation remains 99% (+0): packaged-build and live stable/Dev coexistence unverified;
  known baseline frontend failures remain explicit. No full phase/release completion claimed.
- Reconciled stale handoff text that still instructed implementation of already completed bindings.
  Next work is isolated packaging/coexistence validation, then the paused glass acceptance plan.
  No additional test reruns, commits, pushes, migration or stable user-data access in this wrap-up.

### 2026-09-23 — Pre-push repository hygiene

- Audited tracked/untracked changes: 39 root .tmp-* acceptance fixtures, databases, writer locks,
  scripts and validation logs (about 1.34 MB) were untracked and not ignored. Added root-only /.tmp-*
  to .gitignore and matching formatter exclusion. Files remain locally available; none deleted.
- Confirmed no root temporary artifacts remain offered by Git and no tracked .log/.tmapdb/.sqlite3/
  .writer.lock artifacts were found. Common private-key/GitHub/AWS/OpenAI credential-pattern scan of
  changed/new text files found no matches; this is a bounded check, not a security certification.
- Existing glass/UI work remains mixed with database changes. Preserve it and review commit scope;
  do not blanket-stage under a database-only description. Generated Tauri permissions/schemas follow
  existing tracking convention and include the new command contracts, so were not discarded.
- No staging, commit, push, destructive cleanup, or implementation change. Diff whitespace check passed.

### 2026-09-23 — Review follow-up to ee562109: cleanup and hardening

- Evaluated the supplied review against code. Accepted bounded ownership, error containment, media
  read and validation improvements. CI already existed, but only main pushes/PRs triggered it; extended
  it to architecture-v1/manual dispatch and default/Dev/all-feature Rust jobs, retaining prior coverage.
- Replaced the historical REFACTOR-STATE accumulation with a short current snapshot. The detailed
  database steps already live above in this log; prior snapshots remain in Git. Corrected mounted
  production status in SECURITY and ADR 005 and regenerated CODEMAP. No phase gate was advanced.
- AppShell now contains production rendering/chrome in its outer error boundary. Its minimal fallback
  uses the existing guarded close controller and preserves failed-save retry without rendering the
  failing material/chrome tree. Isolated development entries retain their ordinary fallback.
- Explicitly attached runtime resource ownership replaces callbacks closing over uninitialized locals.
  Purge/disposal attempt every resource even if one throws, then report sanitized failure. Kept the
  session controller and retained App ownership unchanged; future independent lifecycle work belongs
  in collaborators, with feature migration still through the planned vertical slices.
- Native media describe validates within one SQLite snapshot and stores immutable bytes behind an
  opaque session token. Two reads of at most 64 MiB each are bounded; final chunk/release/lock clears
  them, and 60-second idle expiry runs on the next media request. Frontend cancellation/mismatch
  releases tokens. Regression tests change the database row between describe/read and verify original
  validated bytes, fresh-read corruption rejection, bounds, expiry and revoked authority.
- Cleared the prior 15 frontend failures/14 jsdom errors by updating stale presentation assertions and
  supplying an event-target-only jsdom hit-test fallback. Coordinate tests retain explicit geometry
  mocks. Fixed five formatting baselines without behavior changes. No frontend tests were skipped.
  Bounded Vitest to four workers after an overlapping build run caused timeouts; corrected real-time
  menu exit and asynchronous form-focus assertions without widening timeouts or weakening behavior.
- Final frontend suite: 248 files / 1,697 tests pass, no jsdom errors (49.18 s). Formatting, typecheck,
  lint and architecture pass. Rust fmt and Clippy pass for default/Dev/all features; each Rust suite
  reports 63 passed / one ignored child-process entry, which the parent lock test invokes explicitly.
- Production build, capability/production-exclusion checks and code-map freshness passed. Vite still
  reports the existing large main bundle (744.48 kB) and plugin-time advisory; neither is a test failure.
  Broad legacy presentation splitting remains deferred to the planned vertical slices. All-feature
  builds rewrote generated capability schemas; restored those build-only changes to the checked-in
  configuration rather than including unrelated feature-set churn.
- Rebuilt the MCP-enabled Tauri Dev app. Opened only the workspace disposable backup fixture, unlocked,
  inspected the canvas screenshot and verified its GIF decoded at 64×64. Normal console errors/warnings
  were empty. A temporary in-WebView boundary probe rendered the real fallback with an injected render
  error; inspected its screenshot and clicked Close TaskMap. Native window listing confirmed main was
  removed and the keeper retained. Only the expected injected React error was logged. The probe left
  no source/debug hooks. Save-failure retry was tested in the focused component regression.
- Database integration remains 99% (+0 acceptance gates): packaging/live stable-Dev coexistence and
  glass/performance gates remain open. User-accepted checks need not be repeated without regression;
  inactivity lock remains deferred. No installed stable database/keyring/benchmark was accessed.
  No commit, push or successful GitHub workflow run is claimed; temporary fixtures/logs stay ignored.

### 2026-09-23 — CI follow-up to 6c9c914

- Read GitHub Actions run 35903807853: default, Dev and all-feature Rust jobs passed; frontend failed
  four tests. Two entry failures were at the first unlock (lines 29/143), not subsequent recovery or
  resource reloading. Their DOM stayed locked; cleanup retry stayed blocked. Phase publication precedes
  busy/view-operation settlement, so `findBy` could observe a disabled form/button and synthetic input
  was intentionally ignored. Local initial focused reproduction passed all 11 tests.
- Inspected controller serialization, epoch publication, resource-effect cleanup/generation and view
  operation guards. Kept those production semantics unchanged. Entry helpers now wait for enabled
  password input and cleanup retry waits for an enabled button. Two controlled delayed-open tests
  expose locked/blocked while the view operation is still pending, prove actions are rejected, then
  settle and prove successful admission/cleanup. No evidence required a lifecycle ownership rewrite.
- CI's 1,000-member structural copy test took 5.97 seconds against the default five-second timeout.
  Kept all count/locality/no-serialization/undo/redo/save assertions and gave only this case a documented
  15-second ceiling; no global timeout change. This is not release-performance acceptance.
- Fallback close now uses only an existing boot promise; absent runtime means direct guarded renderer
  close. Tests cover no construction before boot, existing-runtime flush/retry, and pending admission.
  Added fake-timer Tab exit assertions before/at expiry while retaining ordinary focus navigation.
  The event-target-only jsdom shim now rejects nonzero coordinate queries without an explicit mock.
- Considered constructor rollback. Current collaborators allocate local state/subscriptions, and no
  concrete constructor failure explains CI; transactional construction remains a small future hardening
  candidate rather than expanding this fix into a lifecycle framework. Native subscription failure
  already disposes the successfully constructed runtime in createTauriDatabaseSessionController.
- Focused regressions: 40 passed. Full frontend: 249 files / 1,702 tests passed, zero jsdom errors.
  Formatting/typecheck/lint/architecture passed. No Rust changes; the actual three successful GitHub
  Rust jobs on this HEAD remain applicable. Full `npm run check` passed, including production build
  and capability/exclusion checks; code-map freshness and diff whitespace checks passed. The existing
  Vite large-bundle advisory remains outside this bounded CI correction.
- Reopened the existing Dev process on its workspace-owned acceptance fixture. Inspected its canvas
  screenshot, then mounted the actual fallback from a fresh unstarted module in a temporary WebView
  probe. Inspected fallback screenshot, observed no console warnings/errors, clicked Close TaskMap;
  window listing confirmed only the keeper remained. The no-runtime-construction assertion is in the
  unit regression; no test hooks were left in production source.
- Current remote commit still has failed frontend CI. No commit/push was performed; user must publish
  the fix and obtain a fresh successful run before claiming green GitHub CI. Database estimate remains
  99% (+0 acceptance gates); isolated packaging/coexistence follows green CI, then glass acceptance.

### 2026-09-24 — Final UI/glass documentation reset installed

- Adopted the user's UI-SYSTEM-CONTRACT, GLASS-SYSTEM-CONTRACT, UI-QUALITY-GUARDRAILS and ADR 006
  as the current scoped UI/material authority. Preserved the user's removals and redesigned roadmap.
  Intentional list/presence/reduced-motion changes are documented policy, not yet implemented behavior.
- Fixed the documentation-dependent Surface test to read the new contracts and verify the three core
  concepts, public ownership references and glass fade constraint. The old version failed with ENOENT
  after deletion of SIMPLE-UI-SYSTEM. No production behavior was changed; the sole production-source
  edit is a stale theme-token comment.
- Replaced CODEMAP's chronological/manual overview with concise current module ownership and navigation,
  including the mounted database runtime and parked renderer boundary. Regenerated its source inventory.
  Updated BASELINE-CAPTURE and marked ADR 003's previous topology explicitly historical. Clarified that
  ADR 001's Phase 1 boot/error-boundary details are historical while its state/platform rules remain.
  Remaining deleted-document mentions are supersession/history evidence, not active reading guidance.
- Normalized the three documents flagged by Prettier. Kept the existing benchmark files-only constraint
  in TESTING/STATE; the legacy 25-canvas fixture is not a current database import or 2,000 simultaneously
  visible elements. No fixture was loaded, user database touched or rendering strategy changed.
- Independently verified GitHub CI run 35936566796 succeeded for HEAD
  1cd89a4fe0add04d34e2425ad81db10f687dbd80. That supersedes the previous log entry's pending CI status;
  this uncommitted documentation reset still requires its own remote run when published.
- Validation: full `npm run check` passed, including 249 files / 1,702 frontend tests, formatting,
  typecheck, lint, architecture, production build and capability/exclusion checks. CODEMAP freshness
  and diff whitespace checks passed. The existing large-bundle advisory remains. Rust and runtime
  behavior are unchanged, so native suites/visual acceptance were not repeated for this docs slice.
- Phase 4.5A documentation reset complete locally. Next is the minimal shared database-backed App/UI Lab
  workbench (4.5B), then the small WebView2 rendering proof (4.5C). Broad scroll/motion migration waits
  for that proof. Packaging/coexistence remains a separate acceptance gate. No commit or push performed.

## 2026-09-24 — Phase 4.5B database-backed development workbench

- Added DEV-only, development-edition `DevelopmentVisualWorkbench` inside `DatabaseSessionGate`.
  App/Lab switching unmounts the retained presentation/binding (including global input handlers),
  while the existing database runtime, workspace, history, media and preferences remain owned above it.
- Reused `UiLabApp` fixtures in embedded mode without duplicate window chrome/providers. Shared
  motion ownership and in-memory Major/Minor blur overrides survive view switches; reset/unmount
  restores prior root values. No document settings or persistence were added for tooling.
- Added opt-in material/effect bounds, hit-target outlines, frame-interval percentiles and existing
  native-material counters. Sampling runs only while enabled. These are diagnostic observations,
  not GPU/rendered-FPS or glass-topology acceptance.
- Live verification caught retained App's local blur defaults shadowing the workbench. The admitted
  view now inherits blur, including list planes; its old local tuner is disconnected. Existing
  production defaults remain 60px Major / 23.5px Minor.
- `app:ui-lab` now launches the ordinary MCP-enabled Dev runtime; `app:ui-lab:isolated` preserves
  the old storage-free harness as reference until final cleanup. The old AppShell opt-in Lab route
  is disconnected. Production inspection checks the new DEV/edition gate and excludes its CSS/JS.
- Real-runtime tests cover repeated App/Lab round trips, nonempty undo history, remembered camera,
  session/workspace identity, detached canvas input listeners and lock-time override/Lab cleanup.
  Embedded-fixture tests verify a single window-control owner.
- Live Tauri/WebView2 screenshots inspected at 1100x760: App/Lab switching, shared 35px Major and
  31px Minor blur, shared Minor list overscan 108px, diagnostic outlines/counters and reset. Read-only
  UI inspection only; no benchmark loading or stable database access. No frontend console warnings
  or errors in the inspected window. Native locking was covered by integration tests rather than
  interrupting the user's active database. Existing glass correctness defects remain Phase 4.5C work.
- Validation: full `npm run check` passed, 250 files / 1,705 tests, architecture, production build and
  capability/exclusion checks. Existing bundle-size advisory remains. Rust/capabilities unchanged;
  native baseline remains the accepted HEAD CI. CODEMAP regenerated; formatting/diff checks passed.
- Next: build the smallest logical-layer/backdrop rendering proof in the embedded Lab before broad
  material or motion migration.

## 2026-09-24 — Phase 4.5C current-backend rendering proof

- Added UI Lab scene selection; only the selected proof/baseline mounts. The new scene uses production
  MaterialSurface, shared Minor planes and canonical recipes, with explicit intended layer labels,
  independently switchable foreground ink, overlay and promotion, a pointer-driven red object,
  optional automatic translation and changing canvas media. No runtime/document ownership changes.
- Synthetic backdrop updates write transforms/pixels directly; they do not dispatch, measure geometry
  or rerender React per frame. Animation is opt-in and cancelled on unmount. Autoplay disables manual
  red controls so its automatic motion cannot be mistaken for a mouse-release material correction.
- Real WebView2 proof rejected the current native topology: Major A foreground changes contaminate
  same-layer Major B. Saved A/B screenshots give a 63.24/255 mean absolute RGB-channel difference in
  a body-only region of B. Overlay sampling, promoted-Minor lower-content blur and changing-media
  freshness were observed working in this controlled scene. These are not production acceptance.
- The user manually dragged the real pointer handle and confirmed blur follows while held, but
  reported square blur corners outside the rounded rim. MCP swipe did not actually move the handle;
  its success output was rejected as drag evidence and the redundant captures were removed.
- Inspected clip styles: rounded radius and overflow:hidden already present. Removing Major A clip
  transform in a temporary DOM experiment did not fix corners. Adding explicit rounded clip-path
  removed the desired backdrop blur. Both experiments were reverted; no production material CSS or
  geometry was changed. Do not ship the clip-path trial as a fix.
- Evidence, environment, reproduction steps and limitations are in GLASS-RENDERING-PROOF.md and nine
  native screenshots under docs/evidence/glass-proof/. The active Dev database was only used to admit
  the workbench; no document edits, imports, benchmarks or stable-data access were performed.
- Validation: full npm run check passes (251 files / 1,707 tests), architecture, production build and
  production/capability exclusions. Two proof tests cover batch promotion/reset identity and animation
  lifetime. CODEMAP and formatting/diff checks pass. No frontend console warnings/errors were observed.
  Existing Vite bundle-size advisory remains; Rust/native services are unchanged.
- Phase 4.5C remains open: 4/6 checks have positive fixture evidence, 2 fail. Next is a bounded private
  backend experiment for logical source isolation plus rounded material clipping without reducing
  overscan or changing optics, then rerun the complete proof before any broad UI migration.

### 2026-09-25 — Rounded native glass output clipping

- Fixed the reported square blur outside rounded rims in the shared MaterialSurface backend. A
  radius-aware SVG masks each local filter output using existing overscan offsets and the unexpanded
  surface size. Sampling geometry/optics, content, rim, shadow and shared shape-union clips stay intact.
  SVG radius axes clamp together for short/narrow surfaces; verified using a decoded SVG canvas probe.
- Ancestor clip-path removed blur; removing transforms, contain:paint and filter clip-path trials did
  not fix the defect. All temporary trial styles were removed. Direct output masking retained blur.
- Native before/after screenshot comparison at 1103x746/DPR1: Major interior RGB delta was zero in
  x150-369/y390-439; previously square corner mean channel delta was 53.31/255 in x115-121/y331-337.
  Saved docs/evidence/glass-proof/rounded-output-mask.png and updated the proof report.
- Inspected live App toolbar/window controls, Canvas Browser opening and Settings opening/closing,
  plus proof promotion/overlay/animated-media states. Screenshots were inspected. The user repeated
  the real-pointer drag and confirmed rounded corners and live blur both work. No console errors or
  warnings were observed. No document edits, media imports or stable-data access were performed.
- Added regression coverage for radius changes retaining material/content identity and local-only
  masking that leaves the geometry hot path unchanged. Full npm run check passed: 251 files / 1,709
  tests, typecheck, formatting, lint, architecture, build and production/capability exclusions.
  CODEMAP regenerated. Existing Vite bundle-size advisory remains; Rust/services are unchanged.
- Clipping subtask complete. Phase 4.5C remains 4/6 positive fixture checks: logical Major isolation and
  cross-layer overscan contamination are still open. Next is source isolation, then the complete proof;
  this does not claim production scrolling or final performance acceptance.
