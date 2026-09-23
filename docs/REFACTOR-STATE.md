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

**Active work: database integration intermission**, explicitly requested 2026-09-06. Follow
`docs/DATABASE-INTEGRATION-PLAN.md` / ADR 004 before resuming glass acceptance. The current visible
source now boots the database runtime; native startup, X-close, save retry, backup restore and
damaged-generation recovery are verified with test-owned databases. Remaining cutover acceptance
is still pending. No existing-data
conversion has happened.

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
- its narrowly scoped activation is now brought forward by the user-requested database intermission;
- tray UX, config import/export, and other deferred production shell work remain later roadmap items.

Therefore, lack of a user-facing database picker/location UI at this point does not by itself mean Phase 2 was lost; it means the backend vertical slice exists ahead of final product-shell activation.

## Recently confirmed implementation

### Database integration intermission — steps 1–2 complete locally

Added `src/app/database/createDatabaseWorkspace.ts`: composes the existing app store with the
existing database client/persistence coordinator and admits only confirmed, identity/schema/purpose/
revision-checked current documents. Occupied workspaces cannot be replaced. Loading creates no save
or history entry; named commands use the existing revision-aware autosave path. This is supporting
code tested with mock transport, **not mounted production integration**. Step 1 did not change startup,
capabilities, crypto, legacy storage, media or user data. No benchmark load or implicit old-data migration.

Step 1 validation: 24 new tests, 71 focused tests; full frontend 818 pass / 15 baseline failures plus
known jsdom elementFromPoint errors. Typecheck/lint/architecture/build/production-exclusion and Rust
fmt/Clippy/tests pass (67 pass / one ignored). Supporting step complete locally; activation remains open.

Step 2a adds an unmounted application session controller for create/open/unlock/resume, save-before-
lock/close/quit, cancellation, backend-loss cleanup and resource revocation. Existing command/history
operations reject edits during transitions. Epochs prevent late loads from restoring cancelled state;
ordinary save errors/conflicts retain unsaved edits, uncertain cleanup blocks new opens. Idle autosave
session-loss errors revoke the workspace too. Required view/media purge hook is not yet connected to
real owners. Native automatic-lock delivery and window-close wiring remain later activation work.

Step 2a: 27 new tests, 98 focused pass; full frontend 845 pass / the same 15 baseline failures and 14
known jsdom errors. Typecheck/lint/architecture/build/exclusion, Rust fmt/Clippy and Rust tests pass
(67 / one ignored; process-tree test required approved rerun). Touched formatting passes; five
unrelated baseline formatting failures remain.

Step 2b now registers 15 explicit `app_*` database/picker/edition operations under the local-main-window
`application-database` capability in product builds. Development-only `phase2_*` aliases share the same
implementation while retaining their separate guard. The platform client obtains the native edition,
validates purpose/pending documents, and connects to the lifecycle owner through the unmounted
`createTauriDatabaseSessionController` factory. Saves check captured database/session identity under the
write mutex; each password unlock rotates that identity. No raw paths, media-byte IPC or new MCP grant.

Step 2b validation: 16 new frontend and five new Rust tests; 110 focused tests pass. Full frontend:
861 pass / the same 15 baseline failures and 14 known jsdom errors. Stable/harness builds, typecheck,
lint, architecture, capability/exclusion checks, Rust fmt/Clippy and default/all-feature Rust tests pass
(72 / one ignored each). Five unrelated formatting failures remain. The visible app still uses legacy storage; no live
cutover, automatic native lock delivery, user database/keyring access or benchmark load was performed.

### Database integration intermission — step 3a

`docs/DATABASE-VIEW-INTEGRATION.md` records the field/action/ownership inventory and remaining adapter
hazards. Step 3a adds `document.elements.update-geometry` to the existing generic command registry:
one group transaction, canonical starting-geometry validation, atomic rejection, and no-op suppression.
Tests exercise real controller previews against the normalized workspace, one completed save and
whole-group undo/redo; the 10,000-element test now covers a two-element group as well.
No renderer, feature payload codec or production completion adapter is connected in this slice.
Step 3b1 now implements the card/container contracts and read-only projection described below.
Full step 3 remains open; preserve media, parent/child order and measured-versus-canonical geometry
semantics rather than copying the legacy AppData shape into the new database.

3a validation: 13 additional cases; full frontend 874 pass / the same 15 baseline failures and 14
known jsdom errors. Typecheck/lint/architecture/build/production checks and Rust fmt/Clippy/tests pass
(72 / one ignored). Five unrelated formatting failures remain. No new live UI acceptance claimed.

### Database integration intermission — step 3b1

Strict module-owned card/container schemas and frozen retained-view projections are implemented but
unmounted. Child-owned placement checks same-canvas container parents and unique child order, separate
from layers. The whole-document adapter fails explicitly for unsupported content rather than returning
a partially hidden view. It has no camera inputs, material rendering, callbacks or persistent mirror;
unchanged documents/entities reuse projections and `clear()` releases its owned cache references.

36 new tests pass. Full frontend: 910 pass / the same 15 baseline failures and 14 known jsdom errors.
Typecheck/lint/architecture/build/production checks and Rust fmt/Clippy/tests pass (72 / one ignored).
Five unrelated full-repo formatting failures remain. Stable bundle is unchanged; the visible app
still uses legacy storage. No real profile/keyring or benchmark access, app launch or visual acceptance.
Full feature admission/transaction validation,
registry registration and lifecycle purge wiring are not implemented by these supporting codecs.
Step 3b2 below completes the next supporting slice. Step 3c callbacks, media transport and startup
cutover remain open.

### Database integration intermission — step 3b2

Typed text-block/root mind-map node and four-port connection schemas/projections are implemented in
their modules. The same unmounted adapter is renamed `createRetainedCanvasProjection`, not duplicated.
It preserves block dimensions/header/text and content-sized node props; edges validate supported
same-canvas endpoint capabilities, no self connections and one unordered pair regardless of ports.
Containers/blocks/nodes are connectable; ordinary cards are not. Images remain a pending capability.
Edge identity caching preserves props on node moves; changed documents recheck endpoint capabilities;
one `clear()` drops all adapter caches. Generic admission/commands and real purge-hook wiring are open.

82 focused tests pass. Full frontend: 955 pass / the same 15 baseline failures and 14 known jsdom errors.
Typecheck/lint/architecture/build/production checks and Rust fmt/Clippy/tests pass (72 / one ignored).
Stable bundle unchanged; no visible app changes, user profile/keyring access, benchmark load or live
UI acceptance. Step 3b3 below implements the image/metadata slice. The visible app still uses legacy storage.

### Database integration intermission — step 3b3

Typed image/background/opaque-media data and frozen metadata-only views are added to the same unmounted
projection. Shared card/image placement lives in `domain/document/elementPlacement.ts`; child order
is validated across both types. Images, including empty placeholders, support connections. Missing or
invalid references fail clearly. All media references are validated/retained with WebP/GIF/SVG stored
MIME and paired known/unknown intrinsic dimensions, not guessed formats or legacy hashes.
Image caches depend on referenced metadata identity; unrelated metadata/camera changes preserve props.
Explicit clearing drops all owned metadata/image/edge caches, but real lifecycle purge wiring is pending.

155 focused document/element/projection tests pass. Full frontend: 993 pass / same 15 baseline failures
and 14 known jsdom errors. Typecheck/lint/architecture/build/production checks and Rust fmt/Clippy/tests
pass (72 / one ignored). Stable bundle unchanged. No real byte transport/decoding, ImageNode binding,
native launch/visual acceptance, user profile/keyring or benchmark access. The visible app still uses
legacy storage. Step 3b4 below adds explicit retained-extension support;
completed commands, admission/purge wiring, actual media and startup cutover remain open.

### Database integration intermission — step 3b4

Nine module-owned strict extension definitions now populate the existing architecture registry,
without placeholder controls. The same unmounted retained-view adapter validates configurations,
canonical target compatibility, activation and duplicate/conflict rules. Disabled installations retain
validated metadata but emit no effective props; active installed-but-off flags keep their props.
Removed/raw-workflow/unknown entries fail explicitly with no partial view. Per-target identity caches
refresh extension-only changes locally and do no parsing/serialization on camera samples.

47 new tests; 202 focused tests pass. Full frontend: 1040 pass / same 15 baseline failures and 14 known
jsdom errors. Typecheck/lint/architecture/build/production checks and Rust fmt/Clippy/tests pass
(72 / one ignored); stable bundle unchanged. Full formatting still has five unrelated baseline files.
No live UI change, native launch or user database/keyring/benchmark access. Visible storage stays legacy.
Step 3c1 below wires feature-data acceptance into the unmounted application composition. Real purge,
media transport, startup cutover and live parity remain required before mounting; glass stays paused.

### Database integration intermission — step 3c1

The unmounted product session composition supplies retained-feature acceptance to native-client and
workspace boundaries. Invalid create/pending/read/save payloads cannot proceed; rejection uses existing
cancel/relock/close cleanup. Invalid workspace loads and command/history candidates cannot publish state,
history or schedule saves, and preserve any pending valid save. One temporary projection reuses the
existing module schemas/relationships and is cleared/discarded each validation; no new renderer/store.
The generic core/harness remain generic via an optional neutral policy, while the platform application
factory requires one and the product composition supplies the retained policy explicitly.

28 new tests; 235 focused pass. Full frontend: 1068 pass / same 15 baseline failures and 14 jsdom errors.
Typecheck/lint/architecture/build/production checks and Rust fmt/Clippy/tests pass (72 / one ignored).
Five unrelated formatting failures remain. Shared optional guard changes the stable store bundle to
index-NBOn-qya.js, 626.61 kB; it does not activate the retained database path. No native launch, user
profile/keyring/benchmark access or live parity claim. Visible app/storage still legacy.
Step 3c2a below adds the first action-specific command policy. Data validation is not action authorization.
Whole-document completion cost and real media/cache-purge/startup acceptance remain open; no camera work.

### Database integration intermission — step 3c2a

Atomic retained selection deletion is registered in the existing dispatcher via a product handler list.
Single-element removal uses the same rules. Locked deletion preference protects locked targets and
containers with locked children, while other explicitly selected unlocked items remain deletable.
Permitted container deletion cascades cards/images, endpoint edges and targeted installations together;
media metadata/bytes are retained for undo. Invalid target groups reject; all-protected/empty selections
are no-ops. Planning reads the immutable transaction input; it neither runs timers nor changes visuals.

18 new tests; 133 focused pass. Full frontend 1086 pass / same 15 failures / 14 known jsdom errors.
Typecheck/lint/architecture/build/production checks and Rust fmt/Clippy/tests pass (72 / one ignored).
Five unrelated format failures remain. A 1,000-child cascade is one non-serialized transaction;
100 pan/100 zoom frames invoke no deletion. Stable index-DG64oq3j.js is 626.63 kB due to the shared
optional handler-selection seam, not a mounted retained action path. No real user data/keyring or
benchmark access, native launch, visible storage switch or live parity acceptance.
Step 3c2b below implements geometry guards. General step 3c and the database cutover remain open.

### Database integration intermission — step 3c2b

Product single/group geometry commands share effective-lock and resize-capability policy. Text cards
and mind-map nodes cannot persist measured dimensions as resize edits; containers/blocks/images remain
resizable. The generic group implementation/schema still owns atomic writes, canonical-from validation,
duplicate/locality checks and no-op suppression. A changed target locked before completion rejects the
entire group; the controller already excludes initial locks. Deletion permission does not bypass this.
Checks use immutable transaction input and cleared temporary projections; no new interaction owner.

31 new tests; 173 focused pass. Full frontend 1117 pass / same 15 failures / 14 jsdom errors. Typecheck,
lint, architecture, build/production checks and Rust fmt/Clippy/tests pass (72 / one ignored). Five
baseline format failures remain. Stable bundle unchanged (index-DG64oq3j.js, 626.63 kB). Actual controller
tests cover canonical-vs-measured card geometry, transient previews, one transaction/save, undo/redo,
cancel, constrained resize and mid-drag locks. No native launch, user profile/keyring/benchmark access,
live parity or production storage switch. Visible app remains legacy; geometry wiring is unmounted.
Step 3c2c below supplies atomic placement command support. Geometry checks alone do not establish
placement or stale-session safety.

### Database integration intermission — step 3c2c

The unmounted product handler list now includes `document.elements.place`: one transaction for group
geometry plus card/image reparent/detach and joint sibling ordering. It checks captured canonical
geometry, moving placement and complete affected sibling ID/order snapshots. Stale/invalid inputs
reject atomically; only changed groups are renumbered, and unchanged drops preserve gaps/state identity.
Directly moved locks are enforced; locked parents and indirectly shifted siblings remain valid. Generic
data replacement cannot bypass placement. No new dispatcher/store/rendering strategy or schema format.

42 new tests; 215 focused pass. Full frontend 1159 pass / same 15 failures / 14 jsdom errors. Typecheck,
lint, architecture (444 files), build/production checks and Rust fmt/Clippy/tests pass (72 / one ignored).
The same five baseline formatting failures remain. Stable bundle unchanged (index-DG64oq3j.js,
626.63 kB). Actual controller tests cover 100 transient previews, cancel and one completed transaction;
other tests cover mixed ordering, locks/stale groups, undo/redo/save and a 1,000-sibling list.

Step 3c2d/e below combines typed content edits and group layers before completed callback
epoch/document/canvas guards. Full-list search/scroll drop mapping still needs production callback
binding; this command is not a mounted gesture adapter or stale-session guard. Visible app/storage
remain legacy. No native launch, active profile/keyring/benchmark access or live parity claim.

### Database integration intermission — combined step 3c2d/e

Completed the user's combined content/layer command slice. Typed `document.elements.edit-content`
uses module-owned allowed fields and field-scoped expected values; invalid/stale groups reject and
unrelated edits survive. Content writes are field-local patches and equal/empty field edits are no-ops.
Product full-data replacement shares those rules and cannot bypass placement or media operations.
`document.elements.reorder-layers` validates captured root order, preserves selected stacking order,
and permutes root slots only. The single reorder API protects child targets/slots. Retained locks allow
content/layer changes; movement/resize/deletion policy is unchanged. No new renderer/store/dispatcher.

60 new tests; 275 focused pass. Full frontend 1219 pass / same 15 failures / 14 jsdom errors. Typecheck,
lint, architecture (451 files), build/production checks and Rust fmt/Clippy/tests pass (72 / one ignored).
Five unrelated formatting failures remain. Stable output unchanged: index-DG64oq3j.js, 626.63 kB.
Controller tests cover 100 pan/zoom samples without commands/history/save, completed edits/undo/redo/
one debounced save, plus localized 1,000-element content/layer transactions. No live parity claim.

Step 3c3 below implements captured callback support, before step 3d cross-feature
routing/acceptance. Canonical content APIs do not finalize editor drafts: preserve trimming, blank-save
behavior, link normalization and search/scroll drop mapping in that binding. Immediate single APIs are
not stale-safe callbacks. These commands remain unmounted; visible app/storage stay legacy. No native
launch, active user database/keyring/benchmark access or storage activation occurred.

### Database integration intermission — step 3c3

The unmounted application factory now exposes revocable action callbacks for geometry/placement,
content, layers and deletion. They capture action-specific canonical values once; one workspace/session
subscription pair clears captures on epoch/document/database/canvas changes and non-editable lifecycle
transitions. Canvas A → B → A and failed save-before-lock cannot revive old callbacks. Single-use handles
are consumed before dispatch, and four superseding slots bound captured state. Purge/dispose clear it;
factory controller disposal also unsubscribes callback ownership. No whole-document callback snapshots.

Move/resize preserve canonical geometry components; explicit placement decisions use captured siblings.
Text/title/link finalizers preserve retained value rules, while view drafts/focus/pulses and scroll/search
hit-testing stay outside commands. 41 new tests; 316 focused pass. Full frontend 1260 pass / same 15 failures /
14 jsdom errors. Typecheck/lint/architecture (461 files), build/production checks and Rust fmt/Clippy/tests
pass (72 / one ignored). Five baseline format failures remain; stable index-DG64oq3j.js unchanged.

Step 3d below checks cross-feature routing. Full step 3 remains open; core callbacks alone do not prove
all feature wiring. No visible UI
changes or native launch/visual acceptance, active database/keyring/benchmark access or storage cutover.
The real app still uses legacy storage; callback support is not mounted in its renderer.

### Database integration intermission — step 3d1

Added an unmounted composition of the existing interaction controller and captured callbacks. Successful
translation starts capture only controller-eligible IDs; resize/layers reuse current constraints and
commands. Cancel/no-op/threshold/replacement/dispose release captures, and rejected starts or unrelated
pointers cannot supersede an active gesture. Callback identity invalidation now also clears transient
previews/guides/selection via the existing observer pair. Failed lock-save recovery cannot revive gestures;
stale completion reports failure without another transaction. No changes to the active controller engine.

28 new tests; 363 focused pass. Full frontend 1288 pass / same 15 failures / 14 known jsdom errors.
Typecheck/lint/architecture (466 files), build/production and Rust fmt/Clippy/tests pass (72 / one ignored).
Five baseline format failures remain; stable JS/CSS hashes unchanged. 200 samples each of move/resize/pan
perform no workspace/session reads, dispatch, serialization, history or save work. CODEMAP: 606 files.

Step 3d2 below supplies geometry/drop mapping; 3d1 alone rejected placement gestures. Full step 3 stays
open. No visible UI changes/native launch,
live parity, user database/keyring/benchmark access or storage cutover. Visible app/storage remain legacy.

### Database integration intermission — steps 3d2 and 3d3a

Completed normalized geometry/drop support, then connection actions at the user's request. The unmounted
compatibility bridge reuses current measured/fallback root geometry and displayed contained-card search/
scroll positions, source-order bundles, locks and snap filtering. The controller now accepts explicit
resolved text-card placement, preserves canonical extents and loose bundle offsets, and maps card-only
slots into captured shared card/image order. Missing/stale decisions fail atomically. The view still owns
release-sample updates and pickup/settle/cancel/purge presentation; no new rendering or gesture engine.

Connection callbacks share the existing lifetime owner (five bounded slots/one observer pair). Named
completion creates an edge or, from a mind-map node only, a new root node plus opposite-port edge in one
transaction. Typed admission guards endpoints/pairs; invalid completion rolls back both. Captured edge
deletion rejects retargeting. Element locks do not prohibit edges. View defaults/clamping/focus/previews
remain caller-owned; these commands/callbacks are not the final visible release/port binding.

60 new tests; 459 focused pass. Full frontend 1348 pass / same 15 failures / 14 known jsdom errors.
Typecheck/lint/architecture (477 files), build/production and Rust fmt/Clippy/tests pass (72 / one ignored).
Five baseline format failures remain; CODEMAP 617 files. Stable JS/CSS hashes unchanged. Real placement-
service/controller tests cover search/scroll/bundles/cancellation/stale drops and 200 transient samples;
connection tests cover atomic undo/redo/save, rejection and revocation. No live UI or FPS acceptance.

### Database integration intermission — step 3d3b

Extension actions now use one atomic captured group command and the existing callback owner (six bounded
slots, one observer pair). Existing definitions supply compatibility/defaults and product admission validates
configuration/conflicts. Reinstall preserves settings/activation; absent removal/equal values are no-ops.
Lock toggles use the primary value across installed selected members; privacy/checkbox remain single-target.
Configured flags remain separate from installation activation. Search queries are not trimmed. Stale, invalid
and revoked actions cannot partially edit, create history or save. No new rendering or App ownership layer.

70 new tests; 529 focused pass. Full frontend 1418 pass / same 15 failures / 14 known jsdom errors.
Typecheck/lint/architecture (485 files), build/production and Rust fmt/Clippy/tests pass (72 / one ignored).
Five baseline format failures remain; CODEMAP 625 files. Stable JS/CSS hashes unchanged. A 1,000-target
install uses one localized transaction/deferred save; 200 cancelled captures add no observers or writes.

### Database integration intermission — step 3d3c1

Completed internal copy/duplicate command support. One seventh callback slot retains typed copy-time values
across canvas switches, but revokes on session/workspace changes, failed lock-save, clear/dispose/cancel or
supersession. Other action slots still expire on canvas changes and transient previews are invalidated.
One paste transaction remaps elements/child parents/internal edges/extensions and reuses matching existing
opaque media references. IDs/positions are explicit; no bytes/clipboard I/O or extra observer pair. Existing
container-copy text-card-only membership is preserved, including its known contained-image omission.

43 new tests; 572 focused pass / 61 files. Full frontend 1461 pass / same 15 failures / 14 known jsdom errors.
Typecheck/lint/architecture (495 files), build/production and Rust fmt/Clippy/tests pass (72 / one ignored).
Five baseline formatting failures remain; CODEMAP 635 files. Stable JS/CSS hashes unchanged. A 1,000-member
paste uses one localized transaction/deferred save; 200 cancelled copies add no observers or writes.

### Database integration intermission — step 3d3c2

Completed unmounted container-target insertion and AI JSON command/callback support. Shared captured
container/children/extension preconditions reject stale edits. Fresh cards apply inherited color/automatic
checkbox defaults; copied cards preserve their supplied color and checkbox state/activation. AI replacement
uses existing strict validation/serialization, replaces cards/extensions atomically, and keeps images/media
and container controls. New cards fill old card slots then append; affected shared child order stays unique.
Geometry, copy/drop index resolution, selection/focus/scroll/animation and clipboard I/O remain view-owned.
One eighth canvas-scoped slot shares the existing observer pair and revokes across session/canvas transitions.

50 new tests; 627 focused pass / 66 files including existing AI JSON compatibility tests. Full frontend
1511 pass / same 15 failures / 14 known jsdom errors. Typecheck/lint/architecture (506 files), build/production
and Rust fmt/Clippy/tests pass (72 / one ignored). Five unrelated format failures remain; CODEMAP 646 files.
Stable JS/CSS hashes unchanged. A 1,000-card replacement has one transaction/deferred save and no media
rewrite; 200 cancelled captures do no parsing/serialization/dispatch or additional observer work.

Next at this handoff was 3d3d, split below. Full step 3 stays open. Clipboard/menu/editor cleanup
and live UI acceptance remain required; exported strings/drafts must join the visible purge hook. Media and
atomic startup follow in steps 4–5. The UI skill kept support unmounted: no native launch, screenshot/console
inspection, user profile/keyring/benchmark/OS clipboard access or production switch. Visible app/storage remain legacy.

### Database integration intermission — step 3d3d1

Completed unmounted captured document-settings and undo/redo routes. Six existing settings leaves keep
document ownership and reuse the existing field-local command; matching captured leaves reject stale
edits without overwriting unrelated settings. One ninth slot reuses the existing observer pair. Previews
stay local, cancellation/equal values are no-ops, and session/canvas/reload transitions revoke old captures.
Undo/redo use existing document transaction history, cancel pending controller motion/selection and all
captures before application, block reentrancy and abort if invalidation changes the workspace/session.
Empty history is a no-op. Cross-canvas undo does not switch the active canvas or record camera/navigation.

48 new tests; 675 focused pass / 69 files. Full frontend 1559 pass / same 15 failures / 14 known jsdom
errors. Typecheck/lint/architecture (511 files), build/production inspection and Rust fmt/Clippy/tests
pass (72 / one ignored). Same five unrelated format failures remain; CODEMAP 651 files.
Production JS/CSS hashes remain unchanged. No visible App,
keyboard/menu/editor, material, native transport or database startup activation changed. The UI skill kept
support separate from live acceptance: no native inspection/screenshots/console, active user profile/
database/keyring/benchmark/OS clipboard access. Visible app/storage remain legacy; full step 3 is open.

### Database integration intermission — Batch A complete locally (2026-09-12)

Assembled remaining step-3 support and step-4 transport/resources as one batch: strict revisioned
edition-local preferences; session-encrypted device-local remembered cameras; captured canvas create,
order/details/clear/remove and element/image creation; bounded native picker/chunk import and lazy
media reads with shared URL leases. The existing session factory owns flush/purge integration and
restores controller pan/zoom only after resources load. Settled cameras stay outside document/history
and pointer frames. ADR 005 records cache encryption/backup semantics and the shared image recipe.

32 new frontend and five new Rust tests. Full frontend: 1591 pass / same 15 failures / 14 known jsdom
errors (228 files). Typecheck/lint/architecture (530 files), build/production checks, Rust fmt/Clippy
and default/all-feature tests pass (77 / one ignored each). Five unrelated formatting failures remain;
CODEMAP 679 files. Production main JS/CSS hashes unchanged. No active user data/keyring/benchmark import
or native app launch; no screenshots/console inspection or live visual/security acceptance claimed.

**Next: Batch B — visible binding + atomic cutover + database acceptance/cleanup** (step 5 + database
parts of step 6). Supporting integration is ready; the visible app and storage are still legacy.
Follow the concrete `DATABASE-VIEW-INTEGRATION.md` checklist: initialize resources, bind preferences/
cameras/canvas controls and visible image leases, preserve caller geometry/focus/presence, implement
authorized native path-drop intake where needed, connect UI plaintext purge/native locks and disable
all old storage entry points atomically. Validate actual Tauri behavior on disposable data. Do not
equate transport registration with activation or claim complete step-3/4 live feature acceptance.

**Batch B checkpoint — entry UI implemented, no cutover (2026-09-13):**
`features/database-entry/DatabaseSessionGate` now supplies create/open/recent/password/error,
resource-loading/retry/cancel and recovered-revision acknowledgement around the existing session
controller. Password fields clear before async work and on unmount; cancelled/late operations cannot
mount children. The gate does not construct a controller/store or render an alternate canvas.
Native Tab traversal is opt-in for this form; shared Button retains its `-1` canvas default but now
honors explicit `tabIndex`. No material recipe, motion/geometry owner or production startup changed.

An additional `database-entry-preview.html` entry runs only in the same protected storage-free Tauri
preview, with an in-memory transport and an explicitly labelled admitted-view placeholder. Inspected
real screenshots for start/create/mismatched-password/wrong-password/recovery, exercised create/lock/
unlock/back/recent/recovery acknowledgement, checked password clearing and a clear final reloaded console.
An intermediate hot-reload hook-order warning during edits cleared on reload; final mount tests pass.
Revisited the unchanged built-in canvas after the shared-button fix. No native database, media, keyring,
installed app, benchmark or user-data access. This is entry-flow verification, not native crypto/parity.

23 new tests; 30 focused pass. Full frontend 1614 pass / same 15 baseline failures / 14 known jsdom
errors (231 files). Typecheck/lint/architecture (541 files), production build/exclusion and touched
formatting pass; same five unrelated formatting failures. CODEMAP 692 files. Stable CSS unchanged;
JS changed only for the shared explicit-tab support; preview code is excluded. Rust untouched in this
checkpoint; prior 79 pass / one ignored remains the last native result, not a newly run phase gate.
**Batch B checkpoint — canvas binding lifetime (2026-09-13):** The existing session factory now exposes
one `bindCanvas` owner over the retained projection and existing interaction controller. It follows
completed document/settings and active-canvas changes, restores settled cameras with current viewport
dimensions, and revokes projections/selection/gestures on lock, cancellation, replacement or disposal.
Its required view-purge callback remains to be connected to actual retained UI buffers. Resource-ready
admission and singleton ownership are enforced; revoked handles cannot revive after reopening.
This replaces the factory's standalone `createInteraction` entry, without another store or renderer.
Fourteen new binding cases pass. Full frontend: 1628 pass / the same 15 baseline failures / 14 known
jsdom errors. Typecheck/lint/architecture/build/production guards, touched formatting and CODEMAP pass;
the same five unrelated full-format failures remain. No production mounting, native app/data access
or live acceptance. Rust is unchanged; its prior validation is not a new phase-completion claim.

**Batch B in-progress integration (2026-09-15):** The isolated database-entry preview now mounts
the actual retained App presentation through `RetainedCanvasApplication`, using the session binding
and read-only compatibility props. The shared runtime composition was extracted from the native
factory so this preview uses the same services with in-memory transports. Production startup remains
legacy. Creation/content/header/accent/deletion, canvas routing, card placement, connection completion
and history have command branches; this is an unfinished integration, not complete retained parity.
Real Tauri checks verified container creation/movement, contained-card creation/detach/undo, canvas
creation/undo/redo and lock/unlock with screenshots and no final console errors. Pointer checks used
injected PointerEvents in the actual webview; MCP swipe did not deliver pointer events. A navigation
then undo incompatibility was fixed in history while preserving content round-trip validation and
rejection of nonexistent canvas selections. Mounted StrictMode/UI and history regression tests pass.
The core integration full run passed 1632 tests with the same 15 baseline failures / 14 known jsdom
errors; the resource-load timing case failed under contention and passed in the final two-worker run.
Typecheck/lint/architecture/build/exclusion pass; the five baseline formatting failures remain. Rust
was untouched and was not revalidated. Additional extension-control wiring is now in progress:
retained aliases/install/remove/toggle/search actions and filtered nine-extension browser lists are
implemented; 74 focused tests pass, but live extension verification and full revalidation are pending.
Settings/preferences and AI JSON received further binding below. Internal copy, media, synchronous UI
purge, native lifecycle and atomic legacy disconnection remain open. Do not run normal development/stable startup or infer disk/crypto
acceptance from the memory preview. No user databases, keyring or benchmark data were accessed.

**Batch B continuation (2026-09-19):** Settings now reads document settings and edition-local device
preferences from their owners. Opacity pointer previews remain local, release commits once, and
Escape/tab/close cancellation discards the draft. Functional preference updates serialize against the
latest revision. The retained Settings route replaces legacy import/export with session Lock/Close
and excludes Discord controls. AI JSON captures precede editor/clipboard work; replacement creates
fresh card/companion IDs in one transaction and rejects expired responses. Native preview verified
extension drag-install, editor replacement, and whole-change undo/redo with disposable text.

Investigating the reported unresponsive X reproduced a hit-testing defect with Settings open: its
scrim intercepted real mouse clicks on window controls. WindowChrome now portals above modal layers,
preserving its geometry/material. Real coordinate clicks closed both baseline and database previews
with Settings open. The database preview also mounts a shared button/native-close coordinator that
awaits session close/save/purge before native destruction, rejects duplicate requests, reports failure,
and revokes late completion on disposal. This is preview wiring, not the production keeper/OS-lock
cutover. Native console errors were empty in the final inspected state.

Validation: full frontend 1642 pass / the same 15 baseline failures and 14 known jsdom errors (239
files); focused close/JSON/retained-controls pass. Typecheck, lint, architecture (563 files), build and
production isolation pass. CODEMAP refreshed (715 files). Rust is unchanged and was not revalidated.
Screenshot privacy still needs its native binding; general clipboard, media, forced lock, full
synchronous purge, production disconnection and real disposable-database acceptance remain open.

**Batch B clipboard continuation (2026-09-19):** Internal Copy/Cut/Paste menus and Ctrl+C/Ctrl+V now
use captured document commands in the retained route. The view keeps only copy placement/identity
metadata and a revocable handle, not a second plaintext clipboard. Copy survives canvas navigation,
is consumed after one paste as in the retained UI, and expires on history/session invalidation.
Container paste resolves shared card/image positions even with sparse stored order values and retains
copied checkbox state without duplicate companions. Existing one-transaction paste/history ownership
is unchanged. Native preview verified menu/keyboard copy, cross-canvas paste, card insertion into a
container, cut to the canvas, undo/redo, and clipboard removal after lock/unlock; screenshots inspected
and final console errors empty. Full frontend: 1646 pass / unchanged 15 failures and 14 jsdom errors,
240 files. Typecheck/lint/architecture pass; CODEMAP now 717 files. Image byte intake/loading,
screenshot privacy, forced lifecycle/purge and production cutover remain open within Batch B.

**Batch B media continuation (2026-09-21):** The retained renderer now leases visible image/GIF
URLs from the session media service and bypasses legacy cache reads. Missing media has an explicit
state. Picker replacement and clipboard Blob intake capture before asynchronous work; placeholder
sizing and replacement preserve the retained geometry rules and commit one reversible transaction.
Native file drops issue bounded, one-use, session-owned tokens (60-second expiry), never renderer
path arguments. Lock/close discard pending paths. The new intake reuses Rust's image recipe and
checks session authority before and after processing. The preview uses disposable built-in SVG and
small GIF/WebP fixtures, not native file access or the production normalization codec.

Native preview verified placeholder fill, clipboard GIF display, replacement preserving the box,
undo/redo and media lifecycle; screenshots inspected. Real Windows picker/drop, animated-frame
fidelity under glass and actual database media acceptance remain outstanding. Full frontend:
1659 pass / unchanged 15 baseline failures / 14 known jsdom errors (243 files). Typecheck, lint,
architecture (572 files), build and production isolation pass; CODEMAP 728 files. Native preview
configuration Rust fmt/Clippy/tests pass (82 pass / one ignored); ordinary-build verification is
recorded in WORK-LOG. Production startup remains legacy; no user data/keyring/benchmark access.

**Batch B lifecycle continuation (2026-09-22):** Windows WTS lock hooks now cover the main,
recreated and hidden keeper windows. Native revocation clears session authority before emitting a
content-free event; the frontend synchronously removes the retained canvas and portals, cancels late
work and reconciles locked status without saving. Native privacy is serialized before preference
publication and applied before document admission. Privacy failures revoke the view. The preview
simulates forced lock only; its native WTS hook is disabled. Live privacy on/off, immediate settings
and canvas removal on forced lock, and return to unlock were inspected through Tauri MCP. Actual
Windows lock delivery and screenshot exclusion remain unverified; MCP still captured the protected
window. Full frontend: 1666 pass / unchanged 15 failures and 14 errors; Rust default and preview:
82 pass / one ignored each. Production activation remains pending.

**Batch B cutover source checkpoint (2026-09-22):** `AppShell` composes `DatabaseApplication`,
which creates one native runtime across StrictMode and keeps window controls outside the canvas error
boundary. The retained App no longer registers legacy close/privacy listeners or Discord delivery;
updater saves use the database coordinator. Native startup no longer compiles legacy storage, media,
portable conversion, model migration or Discord modules; the raw runner implementation and all legacy
command grants/handlers are removed. Only a storage-free empty-load stub remains for the old preview.
Dev configs boot the product entry and explicitly disable inherited stable update endpoints. Source
cutover checks, build, focused tests and native tests pass. After completing source validation, the
reviewed Dev launch succeeded: the new empty entry rendered, console errors/warnings were empty,
and clicking X exited the app successfully. No database was opened. Frontend: 1669 pass / the same
15 baseline failures and 14 errors; default and Dev/MCP Rust: 61 pass / one ignored each. The native
count is lower because obsolete legacy modules/raw runner no longer compile. CODEMAP: 737 files.
Do not infer that this source checkpoint proves real database parity or disk persistence.

**Batch B live acceptance checkpoint (2026-09-22):** Fresh workspace-owned
`.tmp-acceptance-sept22.tmapdb` was created through the native picker. Container/card edits persisted;
X removed the main window and a single-instance relaunch restored the same unlocked keeper session.
Explicit lock removed plaintext UI; wrong password was rejected/cleared. Clean process restart required
the password and restored text plus the native-picker GIF (two frames inspected, exact stored bytes).
Native full backup produced revision 7 with media. On September 23, the backup reopened with text
and GIF intact. A damaged copy recovered revision 6, kept the canvas hidden until acknowledgement,
and did not overwrite revision 7 merely by opening or acknowledging it. Only test-owned databases
were accessed.

Save-failure injection exposed two bugs, now fixed with five regression cases: repeated lifecycle
requests retry failed saves without overriding conflicts; media leases survive busy/failed close and
clear on actual revocation. Focused tests: 24 pass. Live retest confirmed failed close keeps the view
and GIF URL usable. The injected trigger was removed and X retried. September 23 readback confirmed
revision 8 and the saved text block. The previous Computer Use/launch interruption is resolved:
fresh inspection found only the hidden keeper before an approved single-instance reopen.
The recovered fixture accepted new text and native-picker PNG import (512 x 512, stored as WebP),
saved revision 10, and closed/reopened with both intact and no recovery warning. Screenshots were
inspected; console warnings/errors were empty. User subsequently reported the manual drop,
Windows lock, screenshot privacy and window checks working. Remaining integration-wide
isolation/parity acceptance stays open. Window geometry was fixed on September 23: the guarded
product close now saves geometry before native destruction, and keeper recreation restores it.
Client dimensions avoid accumulating frame borders. Native X/keeper reopen and full process restart
both restored 1100 x 760 at the same position; screenshots and empty console logs were inspected.
Ten focused frontend tests and 61 Rust tests passed (one ignored), with Clippy, formatting of touched
files, typecheck, lint, architecture and production-boundary checks passing. User reported the
manual window check working; specific multi-display coverage was not separately stated.

September 23 follow-up validation: production build and boundary inspection passed; default Rust
suite passed 61 / one ignored. Full frontend now passes 1,678 with the same 15 baseline failures
and 14 known jsdom errors. User requested manual handoff for tests that are faster by hand.
User reported "everything works" for the manual checklist: native Explorer GIF drop/persistence,
Windows lock, screenshot exclusion and window reopening. These are user-reported acceptance, not
additional agent-observed tests. User explicitly chose to retain the already implemented Windows
lock behavior, although it is not a personal requirement. No code change requested for it.

**Progress reporting requested by the user:** estimate completed scope within database integration,
not elapsed time or the entire refactor. Baseline before media: ~60%; media advanced to ~72%;
Lifecycle reached ~80%, production switch ~85%, initial live acceptance ~92%; current: **~99%**
(September 23: +3 for save-retry readback, backup restore and recovery/save/reopen; +1 for window
geometry persistence and native reopen/restart acceptance; +3 from user-reported native drop
and Windows lock/privacy acceptance). Reserve the final 1 point for integration-wide isolation/parity
review. Acceptance documents were reconciled on September 23. Core database implementation is in place; formal
Batch B closure is not yet claimed, and the known baseline test failures remain recorded.

**Database work-session wrap-up (2026-09-23):** Core implementation is complete and active.
Agent-verified database flows and user-reported media, lock/privacy, window and retained-feature
round-trip checks are accepted. Inactivity locking is explicitly deferred; Windows WTS locking stays.
Do not repeat completed manual checks or reopen finished binding/cutover implementation work.

Formal Batch B validation remains at 99%: packaged-build and live stable/Dev coexistence checks are
unverified. Keep the known 15 frontend baseline failures and 14 jsdom errors visible; this is not an
all-green phase/release sign-off. Next work is that remaining packaging/isolation validation in an
isolated environment that preserves the installed stable app and its data. No commits/pushes or
existing-data migration were requested or performed. The user requested wrapping up this session.

Then **Batch C** resumes glass acceptance. Old step labels remain internal checklists, not separate
handoff boundaries. Benchmark permission stays files only; no broad App/render/store refactor.

**Batch B safe baseline now available (2026-09-12):** User clarified that the old main-branch app/data
must be preserved and the refactor development data is disposable. Use **`npm run app:preview:mcp`**
for baseline inspection, not ordinary dev/stable launches. The debug-only storage-free preview requires
its dedicated `com.merkdesigns.taskmap.storage-preview` identity before plugins/single-instance setup.
It skips legacy initialization/GC/window-state I/O, denies native legacy storage/keyring access and
has no save/reset/import/export/media/database/command/updater capability. `load_app_data` returns only
the built-in default UI baseline; autosave/RPC/automatic updates are disabled. A permanent notice says
that nothing is saved. This is an inspection fixture, not a database mode or completed cutover.

Verified real Tauri identity, initial canvas and opened Canvas Browser, inspected screenshots/console
(no console errors), and confirmed nine sensitive IPC operations are denied. Closed the preview through
its UI. No installed app, existing database or credential was read/copied/modified/deleted; no backup,
migration or benchmark import was performed. Ordinary app/dev paths still retain legacy behavior until
Batch B's atomic switch and must not be used for our testing yet. This resolves the old-data-safe visual
baseline prerequisite; editable new-database binding and full Batch B acceptance remain next.

Protection checkpoint finalized 2026-09-13 after usage interruption: default/all-feature Rust tests
each pass (79 / one ignored); frontend remains 1591 pass / the same 15 failures and 14 known jsdom
errors. Build/typecheck/lint/architecture/production guards, Rust fmt/Clippy and CODEMAP checks pass;
five unrelated formatting failures remain. No additional app/data access was needed to finish the log.

### Glass performance follow-up — 2026-09-06

Uncommitted steps 1–4 of `docs/GLASS-IMPROVEMENT-PLAN.md` are implemented on
`architecture-v1` (HEAD `21599ec92551ed4605dc8737353f1cd9dad3a839`). Camera presentation bypasses
legacy App/chrome renders; Canvas Browser snapshot inputs remain stable during gestures. Native
glass geometry now shares observation/frame reads, while list owners supply card dimensions and
translation does not redraw card rims. Glass lists now share full-card/viewport clipping; Canvas
Browser drag keeps the same DOM ancestry, and native nested scrolling uses cached layout geometry.
Live Tauri checks and deterministic tests are recorded in
the plan and WORK-LOG. These are local Phase 4.5C improvements, not closure of Phase 4.5D.

Standalone/batched native glass now share one filter recipe. Transform repaint nudges, motion calls
into the parked registry, unused App BackdropScene preparation, and empty production registry/bridge
allocation are removed. New Canvas uses a frozen finish through the existing CSS material strategy.

Glass acceptance is paused for the database intermission. It is split at the user's request:
part 1 performance, part 2 broader visual/behavior
acceptance. Part 1 has development three-state pan/idle measurements, zero steady material rectangle
reads/rim redraws, restored camera, 33 passing hot-path tests and seven passing probe tests. See
`docs/GLASS-PERFORMANCE-ACCEPTANCE.md` for conditions and limitations. It does **not** establish release
FPS. A separate offline generator now prepares the multi-canvas/media fixture: 25 canvases, 2,000
elements and 582,508,631 bytes of unique WebP/GIF assets, verified against hashes/codecs and the active
document schema. See `docs/GLASS-BENCHMARK-FILES.md`. User chose **benchmark files only**; no import or
release launch. Next requires isolated Windows account/VM storage, a bounded Rust-owned loading
workflow and external presented-frame capture. The active legacy keyring entry is shared across
editions and portable base64 wrapping exceeds the 512 MiB limit for this corpus. Do not bypass these
constraints or weaken the debug-only MCP gate. Existing baseline generator remains unchanged.
Part 2 is not started. No new rendering abstraction or Phase 5 migration. Prior full frontend suite:
783 pass / 15 baseline failures; Rust: 67 pass / one ignored. No full-matrix closure in this pass.

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

### 2. Glass-list acceptance follow-up

Step 3 fixes partial-card rounded geometry and separates content/material/effect clipping in Canvas
Browser and both Extensions lists. Nested native scrolling was verified without rectangle reads.
Cross-display scaling and release-mode visual/performance acceptance remain open; these local fixes
do not close Phase 4.5 or authorize Phase 5 ownership migration.

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

The September 5 follow-up isolated and corrected camera-driven React/bookkeeping and duplicate
native/list geometry work (see the glass plan). Remaining high-priority areas to isolate in release mode:

- remaining active preview/compositor cost after camera and snapshot isolation;
- WebView2 recomposition when a large transformed canvas moves beneath fixed material surfaces.

Do not reduce accepted glass quality until these paths are isolated in a production-performance build.

## Immediate progression

Current working order:

0. Complete the explicit database integration intermission and its activation/security/parity checks;
   then return to the existing glass acceptance plan. Do not infer that step-1/2 support changes the
   active production persistence path.
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

Pre-push hygiene (September 23): root .tmp-* acceptance artifacts are now ignored by Git and
formatting. They remain local. Database and earlier glass/UI changes are mixed in the working tree;
review commit scope before staging. No commit or push has been performed.
