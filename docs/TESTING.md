# TaskMap Testing Strategy

## Test layers

### Domain unit tests

Cover document commands, schemas, invariants, extension compatibility, element capabilities, history patches, workflow validation, and configuration validation without React or Tauri.

### Phase 3A implemented coverage

Pure Node-environment tests cover minimal current-version creation through an injected UUID source,
strict structural parsing, JSON round trips, input immutability, multiple-canvas order, normalized
element layer order, same-canvas connections, missing canvas and element references, cross-canvas
connection rejection, duplicate and missing order entries, active-canvas rules, malformed IDs,
unsupported schema versions, unknown fields, media filename/path exclusion, JSON safety, conservative
string/collection limits, extension target references, and the separation between structural and
semantic validation. Existing Phase 2 codec and lifecycle tests continue to exercise the same domain
boundary with canonical Phase 3A fixture documents.

### Phase 3B implemented coverage

Pure Node-environment tests cover explicit handler registration and duplicate rejection, unknown
commands, strict runtime payload validation, JSON safety without getter invocation, atomic handler
and invariant failures, input and payload immutability, injected transaction identity/time, static
non-sensitive labels, forward/inverse Immer patches, no-ops, and explicit history-ignore behavior.

The generic current-version command suite covers canvas creation/rename/settings/activation/order
and deterministic removal; element insertion/geometry/data/order/removal; same-canvas connection
insertion/data/removal; media-reference registration/allowed metadata/removal; extension
installation/enabled state/configuration/removal; and supported document settings. Destructive tests
verify that canvas removal cascades only to its normalized elements, connections, and canvas/element
extension targets, while element removal cascades only to endpoint connections and element-targeted
extension installations.

History tests cover empty state, recording, multi-step undo/redo, future invalidation, no-op and
ignored-command behavior, optional injected capacity, clearing, unrelated ignored-field
preservation, empty/mismatched transactions, bidirectional round-trip compatibility, and fail-closed
corrupt/incompatible patches without serialization. A deterministic 10,000-element test
updates one element, asserts there is no JSON serialization, and verifies that the transaction
contains localized patches rather than document snapshots; it deliberately has no fragile
wall-clock threshold.

### Phase 3C implemented coverage

Node-environment application integration tests cover atomic validated workspace load/replacement/
clear, revision bounds, epoch advancement, clean sequence initialization, command no-op/failure
preservation, recordable and ignored-history changes, injected transaction identity/time, input
immutability, and atomic undo/redo including fail-closed history application and preservation of
unrelated ignored fields.

A controllable scheduler proves the named 350 ms default, one-timer debounce coalescing, no save or
encoding before timeout, latest-document capture, cancellation, and explicit flush without
wall-clock assertions. Controllable promises cover one in-flight save, synchronous commands during
unresolved database work, sequence-specific acknowledgment, revision 4 -> 5 -> 6 follow-up saves,
and final cleanliness only after the newest sequence is persisted.

Failure tests cover encoder rejection without a database call, retryable save/session failures,
explicit retry against the latest document and acknowledged revision, mutation after a non-conflict
failure, sanitized error state, and revision conflicts that preserve edits/history while blocking
automatic and ordinary retry saves. Workspace replacement, clear, and coordinator disposal tests
prove obsolete success/failure completions cannot dispatch into the current epoch. The existing
deterministic 10,000-element Phase 3B test remains part of the full frontend suite.

### Component tests

Cover element renderers, extension controls, menus, edit sessions, focus behavior, and accessibility with platform clients mocked.

### Application integration tests

Cover command dispatch, history, autosave coordination, database lifecycle, media references, canvas switching, and stable/dev isolation.

### Rust service tests

Cover database schema, encryption envelope, password verification, key zeroization boundaries, backups, file locking, media streaming, process ownership, and structured workflow launching.

### End-to-end tests

Cover complete user workflows in packaged or near-packaged Tauri builds.

### Visual and performance tests

Use fixed fixtures and recorded legacy references. Performance results must include hardware and build mode.

## Required fixtures

### Small

- 3 canvases
- 50 elements
- 10 small images

### Normal

- 25 canvases
- 2,000 elements
- 500 MB mixed media
- Search, checkbox, privacy, lock, and color extensions

### Stress

- 100 canvases
- 10,000 elements
- 2 GB mixed images and GIFs
- Dense mind-map connections

Fixtures must be deterministic and generated by scripts rather than committed as enormous binaries.

## Performance acceptance

Release builds target:

- 60 FPS during pan, zoom, drag, and resize on the normal fixture
- No persistent dispatch, serialization, encryption, database write, or history entry during pointer frames
- One history transaction per completed drag or resize
- Database opening time independent of total media byte size, excluding visible media decode
- Autosave without visible interaction stalls
- Element rerenders limited to affected entities and overlays
- Lazy media loading based on viewport visibility

Automated performance checks should record frame duration, long tasks, selector execution, render counts, serialization time, encryption time, database transaction time, and media decode scheduling.

## Database tests

Test:

- Create in default and selected locations
- Open correct password
- Reject incorrect password
- Detect corrupted document
- Detect invalid envelope
- Save and reopen
- Backup rotation
- Restore backup
- Disk-full and interrupted-save simulation
- Concurrent writer rejection
- Stable/dev database protections
- Large media insertion and streaming
- Orphan media cleanup
- Database compaction as explicit maintenance

## Session tests

Test:

- Close window retains unlocked background session
- Reopen window without password during session
- Explicit lock requires password
- Windows session lock triggers TaskMap lock (deferred until native event integration)
- Inactivity timeout triggers lock (deferred until timeout integration)
- Quit clears session
- Application restart requires password
- Save pending during lock

### Phase 2 implemented coverage

Rust tests use temporary directories exclusively and cover strict version-1 envelope preflight, malicious Argon2 values, malformed SQLite types, missing/duplicate singleton rows, wrong fixed-field lengths, maximum password/document/media/MIME/ID limits, empty and Unicode passwords, wrong-password and corruption behavior, every authenticated metadata field, rapid nonce uniqueness, zeroizing ownership and explicit clear paths, pending-unlock denial/cancel/timeout/bad confirmation, invalid identity confirmation, concurrent saves, save versus lock/close, transaction rollback, five-generation rotation and recovery, explicit online-backup restore/failure, media length/hash verification, plaintext artifact scans, keeper-failure closure, and edition-specific settings.

Windows-specific Rust tests cover relative/absolute paths, case variants, hard links, symlinks when permitted, a database handle that prevents replacement, stable/development contention, non-contention lock errors, real child-process contention, forced child termination, and stale diagnostic metadata. The routine-save test installs media mutation guards and an 8 MiB media row to prove a document-only save neither copies nor changes media.

TypeScript tests cover typed raw-transport error mapping, validation before save and after read, validation-failure relocking, database-ID and purpose confirmation, password exclusion from Redux, decrypted-document removal on lock/close, secure save-then-lock coordination, valid harness transitions, and production entry exclusion. `npm run production:inspect` builds stable and fails if the stable identifier, capability, Rust registration, bundle, or assets expose Phase 2 command/harness strings.

The Phase 2 manual lifecycle was completed successfully on 2026-08-06 using `Ctrl+Shift+F2` in TaskMap Dev and a disposable `.tmapdb`. The pass covered database creation with a temporary password; document edit, save, revision advance, and readback; explicit lock closing the document-bearing harness; reopening in a locked state without plaintext; password unlock restoring the saved document; closing the visible window while the unlocked process remained alive; single-instance relaunch recreating the window and restoring the unlocked document without another password; explicit full backup without changing the active revision; quit terminating the background process; and a new process starting closed, then opening the recent database with its password and restoring the saved document.

Native Windows session-lock delivery, inactivity locking, final tray UX, scheduled full-backup policy, and streaming/chunked media transport are not Phase 2 claims and remain deferred.

## History tests

Test every persistent command for forward and inverse patches.

Special cases:

- Multi-element move is one entry
- Resize is one entry
- Text edit is one entry per edit session
- Attach/detach cards preserves ordering
- Delete restores dependent connections on undo
- Extension installation/removal is reversible
- Undo/redo triggers persistence
- Pan, zoom, selection, hover, and menus are excluded

## Media tests

- Media bytes never enter Redux state
- Invisible media is not fetched
- Newly visible media is requested
- GIF decoding does not block pointer interaction
- Removing the final reference permits cleanup
- Original filenames and relationships do not appear in plaintext SQLite fields

## Workflow Runner tests

- Executable and argument array remain distinct
- Working directory validation
- Sequential and parallel groups
- Visible and allowed background execution
- Imported workflow starts untrusted and disabled
- No administrator elevation
- No raw shell field
- Stop affects only TaskMap-launched processes
- Process completion and logs update correctly
- Secrets are not written to default logs

## Architecture tests

CI must fail when:

- Domain imports React, Tauri, or DOM-specific modules
- A component imports Tauri directly
- Platform imports UI
- `AppShell.tsx` gains prohibited dependencies
- A feature imports another feature's internal file instead of its public contract
- A file exceeds the configured review threshold without allow-list documentation
- A direct `backdrop-filter`, Tailwind `backdrop-blur-*`, legacy frosted class/consumer, or independent
  acrylic Canvas2D implementation grows beyond the exact Phase 4.5A frozen legacy allowlist

The Phase 4.5A material rule freezes path-specific occurrence counts rather than exempting broad
directories. Removing a legacy occurrence is allowed; adding one in the same or another file fails.
Phase 4.5D removes this transitional allowlist entirely. Acrylic Canvas2D implementation is owned
specifically by `src/ui/materials/compositor/`; ordinary non-acrylic Canvas2D rendering remains valid
elsewhere.

### Phase 1 skeleton coverage

TypeScript component tests cover the transient interaction provider's idle default, injected service, and external-store subscription updates. Error-boundary tests cover unchanged successful rendering, deterministic fallback rendering, typed failure reporting, omission of error internals from the default console report, and propagation of errors thrown inside `LegacyApplication` outside the new-architecture boundary.

### Phase 4 canvas interaction coverage

Pure viewport tests cover screen/world round trips, current zoom bounds and quantization, wheel
direction/magnitude, anchored zoom, translation, reset-at-center, world rectangles, and non-finite
input protection. Controller tests cover subscriptions, pointer identity, pan lifecycle, disposal,
canvas replacement, selection/additive/partial-intersection/tiny-box semantics, single and atomic
multi-move, zoom-correct deltas, locked/mixed groups, resize constraints/aspect ratio, snapping,
layer completion, cancellation, no-op completion, and the corrected `pointercancel` discard path.

Legacy-boundary integration tests drive many transient samples through the generic controller and
prove that persistent `TaskCanvas` state, history stand-ins, and autosave spies are untouched until
one completion-port call. Cancellation and no-op completion call the adapter zero times. Adapter
tests cover atomic collection movement, text-card reparenting, resize, ordered-group layers, lock
capabilities, and bounded render-only projection. StrictMode coverage proves the production-owned
controller remains subscribed after React's development effect probe, and selection compatibility
tests prove consecutive functional updates read the live controller snapshot. Camera-correlation
tests cover queued-write invalidation across canvas replacement, same-ID stored-camera replacement,
controller-write acknowledgement, and pan-cancel rollback without a legacy write.

Legacy text-card placement characterization covers the three-screen-pixel commit threshold,
directional same-container insertion, cross-container reparenting, detach-to-loose behavior,
filtered-to-real insertion mapping, stable bundle order, locked-member exclusion, current preview
projection, cancellation, frame-time immutability, and one final canvas replacement.

The deterministic performance fixture prepares 5,000 snap candidates and executes 120 pointer
updates while spying on JSON serialization/parsing, `structuredClone`, commit calls, and source
geometry. All forbidden boundaries remain at zero and only one preview geometry is published. A
separate 10,000-element culling fixture proves the visible candidate set remains below 40 for the
chosen viewport while pinned off-screen elements remain present. These are architectural CI gates,
not a machine-dependent `<16.67 ms` assertion and not a claim of measured release-mode FPS.

The minimap projection tests cover landscape/portrait sizing, element minimum pixels, and viewport
projection. Production minimap interaction remains reset-only; click/drag navigation is intentionally
absent. The user completed the Phase 4 production manual parity checklist after commit `9a34a23` and
accepted the retained interaction behavior. The release-mode rendered 60 FPS measurement was not
performed. Because Phase 4.5 replaces the rendering/material path, that measurement is performed once
after Phase 4.5D against the final compositor.

### Phase 4.5A visual-system foundation coverage

TypeScript tests lock the exact material IDs, Large, Small, and Opaque definitions, shared acrylic
cache profile identity and values, Cutout definition, highlight stops, duplicate registration rejection,
and safe unknown-ID behavior. Component tests cover registered material selection, ordinary DOM
props, bounded semantic elements, ref forwarding, default/inherited/overridden plane, default and
geometry-specific radius, explicit no-shadow elevation, Cutout inset presentation, and the absence
of feature-facing blur/cache/worker/tint props.

Architecture-rule fixtures prove the exact frozen legacy occurrences remain temporarily accepted,
new direct backdrop-filter declarations and Tailwind backdrop-blur utilities fail, and even a frozen
file cannot grow beyond its recorded count. There are no compositor runtime tests in Phase 4.5A.

### Phase 4.5B1 pure compositor-core coverage

Six Node-environment suites contain 60 deterministic cases for the pure B1 boundary. They lock the
normative quality constants, formulas, clamps, margin cases, explicit invalid-input rejection, and
ceil-rounded backing dimensions. Coverage cases reuse the canonical Phase 4 viewport transforms and
exercise inclusive `0.68`/`1.47` zoom bounds, just-outside ratios, all four 30%-margin safety edges,
dimension changes, non-1 anchors, extreme aspect ratios, and rebuild discovery during 120 active
gesture samples.

Invalidation cases classify the five normative categories and the explicit output-size category by
expensive build, cheap compose, mask, overlay, and buffer-resize consequences. Scheduler and generic
resource fakes prove one active/one newest queued build, chronological lifecycle/build-serial
ordering, duplicate and stale request suppression, conflicting-identity rejection, queued
replacement, stale result rejection, next-build start, lifecycle/scene/profile supersession,
disposal, close-on-reject/replacement, no double close, and prevention of obsolete resource
replacement. A pure frame state machine proves that 120 transform notifications create one logical
pending frame, consumption uses the latest state, and a subsequent frame can be scheduled; spies
keep JSON serialization/parsing and `structuredClone` at zero.

This B1 coverage does not claim a Worker, `OffscreenCanvas`, Canvas2D renderer, `ImageBitmap`, surface
registry, observer, React provider, fallback runtime, production integration, visual acceptance, or
release FPS proof. Those Phase 4.5B/4.5D gates remain open below.

### Phase 4.5B2 compositor-runtime proof coverage

Nine Node-environment B2 suites contain 84 deterministic runtime cases, with five additional
material-architecture cases. Generic scene tests prove deeply frozen structured-clone-safe data,
bounded primitive/grid/transform inputs, and rejection of feature-specific discriminants. Grid work
limits apply to the cache/world intersection, allowing large logical worlds while failing before
pathological cache-local dot or line iteration. Recording Canvas2D fakes lock
clear/background/grid/primitive order, canonical anchor pan/zoom plus cache-margin transform, rounded
paths, cache culling, and the one shared 45 CSS-pixel blur converted to backing pixels by cache scale
with saturation and brightness both fixed at `1`.

Protocol, worker-side, and client cases preserve exact descriptor/request identity, send the scene
separately from document data, transfer the successful bitmap as the sole transferable, close on
failed transfer/malformed/stale/replaced/disposed results, require exact bitmap dimensions, and
prevent stale failures or obsolete successes from disturbing newer work. Runtime cases retain B1's
one-active/one-newest queue and prove one fatal Worker downgrade automatically continues the current
desired build, or the newest queued build, through fallback without Worker recreation. They also
show 120 active-interaction fallback requests invoke no expensive build until settlement, at which
point only the newest request starts. Capability cases cover Worker/OffscreenCanvas/main-thread/
overlay-only selection and constructor failure. Hot-path spies keep JSON serialization/parsing and
`structuredClone` at zero; import rules reject Blob workers and feature/domain/platform/React/Redux/
Tauri compositor dependencies.

The production Vite graph reaches the B2 runtime through the B3 provider and must emit a distinct
`acrylicCache.worker-*.js` module-worker asset. Tauri packaging proves that asset survives bundling,
but neither compilation nor packaging claims successful WebView2 execution. An actual Worker to
OffscreenCanvas to transferable ImageBitmap run remains a manual acceptance item when no
controllable Chromium/WebView2 session is available.

### Phase 4.5B3 production-integration infrastructure coverage

The B3 slice adds 32 deterministic cases across registry, component-registration, output-plane,
reprojection, coordination, legacy projection, and architecture-rule coverage. They prove one shared
surface observer, StrictMode-safe cached-acrylic registration, explicit base/modal membership,
independent rounded mask revisions, and no duplicate mask work across 120 unchanged measurements.
Surface resize, radius, mount, and plane changes rebuild only affected masks and cause zero expensive
scene-cache requests.

Canonical reprojection cases cover pan, adaptive cache/compositor scales, cache margin, and non-1
anchor/current zoom. Coordination cases prove zero work with no surfaces, 120 covered viewport
samples produce zero expensive builds and at most one pending compositor frame, both planes compose
from that one frame, a settled scene revision requests one asynchronous build, and unsafe coverage
may request Worker work during an active gesture. Main-thread fallback receives the authoritative
interaction-active state and remains deferred until settlement. Resize requests a
dimension-compatible cache, while disposal cancels pending frame work and releases output resources.

The legacy adapter cases lock the production neutral panel body, accent header, border, and current
container/text-block header heights and radii. Loose cards, mind-map nodes, and contained cards use
generic body geometry; contained placement reuses the existing read-only filter/order/scroll helper.
Resolved settled layers change primitive order and presentation revision, while 120 transient samples
do not. The 10,000-element fixture retains only expanded-cache intersections and performs zero
world-element DOM measurements.

Coordinator cases also reject cross-canvas accepted caches while allowing an older revision from the
same scene during replacement. Explicit transform-motion invalidations coalesce 120 notifications
into one mask-only frame using the latest registered rectangle. Focused architecture fixtures reject
compositor DOM discovery and legacy world-element measurement. These automated cases do not claim
production visual migration, real media fidelity, WebView2 Worker execution, or release FPS.

### Phase 4.5B deterministic compositor gates

Phase 4.5B must add deterministic tests proving:

- 120 pan samples within accepted coverage cause zero expensive blur rebuilds.
- 120 zoom samples within the `0.68`–`1.47` tolerance reuse the cache; crossing a zoom or 30%
  margin-safety coverage threshold coalesces the required rebuild even during an active gesture.
- Expensive scene rasterization/blur never runs once per animation frame or pointer sample.
- At most one compositor `requestAnimationFrame` callback is queued and at most one expensive build
  is active; the queue retains only the newest relevant request.
- Newer queued state supersedes obsolete output, rejected/replaced `ImageBitmap` objects are closed,
  and lifecycle/canvas/viewport identity prevents stale acceptance.
- Surface mount, visibility, animation, and resize dirty masks/overlays without automatically dirtying
  the backdrop scene or rebuilding its cache each frame.
- Drag and resize pointer samples do not rebuild the expensive cache; one relevant settled mutation
  invalidates once. Coverage-required camera rebuilds remain allowed and coalesced.
- Worker failure selects the controlled cache-based main-thread fallback; inability to produce full
  acrylic selects overlay-only degradation and never per-surface backdrop-filter.
- Disposal cancels owned frames, terminates the worker, disconnects observers, and closes bitmaps.
- The 10,000-element fixture culls before worker transfer so primitive count is bounded to viewport,
  cache margin, and necessary pinned presentation.
- Spies keep JSON serialization/parsing, `structuredClone`, document cloning, persistent Redux
  dispatch, history, persistence, encryption, and database calls at zero in the compositor hot path.

These are state/count/invariant CI gates, not fragile wall-clock assertions. Real media beneath
acrylic is a required visual acceptance case; if needed, tests cover a generic raster/thumbnail
primitive rather than an Image/GIF-specific compositor branch.

### Phase 4.5C1 UI-system foundation coverage

Twenty-one focused C1 suites contain 89 deterministic cases. Motion math covers analytical scalar-spring
convergence, frame-interval variance, current-state retargeting, interpolation/clamping, and local
FLIP position/resize. Scheduler cases prove 120 subscribers share one pending frame, idle work stops,
repeat unsubscribe is safe, StrictMode effects retain one subscriber, and debugger/background deltas
clamp. The central reduced-motion store
is subscription-safe and immediate liquid settlement removes travel/overshoot.

Liquid edge-model cases cover both directions, travel stretch, positive width, variable-width exact
settlement, mid-flight and rapid repeated retargeting, and reduced motion. Component cases cover
local variable-width tab measurement, ResizeObserver remeasurement, real `acrylic-small`
MaterialSurface composition, and geometry invalidation during motion. The coordinator integration
feeds 120 liquid frames through the B3 public geometry seam and proves one coalesced mask refresh
with zero additional expensive acrylic builds.

Primitive cases cover native disabled/click behavior across button variants, accessible icon/toggle
buttons, checkbox/switch/radio/range semantics, focus, explicit Field control-ID association, and
merged explicit plus Field-owned description/error references. ContextMenu cases cover external
coordinate placement, roving focus, ArrowUp/Down, Home/End, Tab/Escape/outside dismissal, action
focus return, disabled skipping, and exit presence.
Tabs and LiquidTabs share click, arrow, Home/End, disabled-skip, ARIA, and roving-tabindex tests. UI
Lab source gates prove the dynamic entry requires both `DEV` and `VITE_TASKMAP_UI_LAB=1`, remains an
eager-import-free production boundary, and scopes the target theme to the Lab root. Stable-bundle
inspection rejects UI Lab markers.

Lab cases mount the real catalog, lock local-only theme scope, verify Tab/Shift+Tab traversal and the
pseudo-class-only focus architecture, distinguish system reduced motion from the non-persistent
scoped simulation, and verify explicit Cutout geometry. Playground cases prove pan, cursor-anchored
zoom, deterministic reset, existing-material preset mapping, shared visible/BackdropScene model
identity, high-contrast thin geometry, one existing presentation publisher, and absence of a second
provider, backdrop-filter, persistence, Redux, or history.

Lab stacking-contract cases lock the synthetic playground scene below the base compositor plane and
the Lab's material surfaces above it. They also reject a Lab-root stacking context that would trap
surface content below the provider-owned canvas or require per-component inline z-index repairs.

Liquid cases additionally lock the `7px` resting radius, bounded `14px` deformation radius, exact
radius return on settlement, unit-scale labels, the clear `7.5%` white selection wash, inherited
moving rim, radius propagation into the real material registry, and zero new expensive cache builds
across moving and radius-changing samples. Input contracts require a `1px` neutral-white focus border
without accent glow while retaining danger validation.

Acrylic-toggle cases cover native pressed semantics, unchanged Acrylic Small material identity,
orange translucent on-state treatment, hover suppression, shared-scheduler compression/settlement,
reduced motion, and cheap geometry invalidation. Liquid-toggle cases cover travel deformation,
current-state retargeting, bounded positive geometry, exact circular settlement, native switch
semantics, shared scheduling, cheap invalidation, and reduced motion. Confirm/animated-checkbox cases
cover momentary native action semantics, unchanged Acrylic Small identity, glowing treatment, and
separately drawable native-checkbox tick strokes. Context-menu cases cover Opaque composition with no
compositor registration or geometry invalidation, item/danger semantics, outside and Escape dismissal,
retained exit presence, reduced motion, and the Lab fixture's exact
section/extension ordering against the current production source. The Lab context trigger is asserted
inside the compositor-backed synthetic viewport, and CSS contracts lock the legacy-compact `165px` /
`29px` geometry without pretending jsdom proves pixels. Existing exact material-definition tests
require Large highlight opacity `0.028`, Small `0.026`, and Opaque tint opacity `1.00`.

These tests do not claim production visual migration, WebView2 visual acceptance, production overlay
migration, or Phase 5 canvas-element presentation.

### Phase 4.5D visual and performance acceptance

Run stable and development packaged Tauri/WebView2 builds across representative viewport sizes and
display scaling. Compare target theme, typography, exact material overlays, geometry, base/modal
stacking, animated surfaces, worker/fallback/degraded modes, and real media under acrylic against
`docs/VISUAL-SYSTEM.md` and the approved reference capture.

Measure release-mode rendered pan, zoom, drag, and resize on the normal fixture and record hardware,
Windows/WebView2 versions, display scaling, refresh rate, window size, build/commit, traces, and
compositor diagnostics. The acceptance target remains 60 FPS. Stress-fixture behavior is recorded
separately. CI deterministic tests do not claim FPS or a `<16.67 ms` wall-clock threshold.

## Phase gates

Every roadmap phase has explicit exit criteria. A phase is not complete until:

- Required automated tests pass
- Architecture checks pass
- Relevant parity entries are documented and manually verified
- Performance changes are measured in release mode
- `docs/CODEMAP.md` is current
- No obsolete legacy fields or dead feature branches were introduced

## Release checklist

Before stable release:

- Full retained-feature parity accepted
- Stress fixture tested
- Database recovery scenarios tested
- Production and development editions run concurrently
- Standalone migrator tested against the user's real legacy database copy
- Installer and updater validated
- Windows Defender results documented
- Password and media privacy wording reviewed
- No plaintext document fragments found in database, config, logs, or temporary files
