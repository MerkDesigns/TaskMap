# Database integration intermission

Requested 2026-09-06. This temporarily pauses `GLASS-IMPROVEMENT-PLAN.md`; resume its unfinished
performance acceptance after this intermission. Glass implementation steps 1–4 remain preserved.

## Outcome and scope

The real canvas app must create/open/unlock a current `.tmapdb`, edit through the existing normalized
workspace/command/history core, persist through the existing Rust database/session backend, and clear
plaintext/media access on lock. It must no longer initialize or save through legacy keyring storage.
Merely showing the Phase 2 harness beside the legacy app does not count as integration.

This is an explicit, narrow reprioritization of database activation portions of Phases 5/8, not a
declaration that Phase 4.5 or all feature migrations are complete. Do not redesign glass, rewrite
cryptography, migrate every component's ownership, or implement unrelated tray/updater/workflow work.

Safety boundaries:

- Fresh, explicitly chosen `.tmapdb` files first. Never auto-open, convert, reset, copy over, or delete
  the existing `taskmap.sqlite3` or shared keyring entry. Old-format conversion stays in the separate
  `tools/taskmap-migrator/` workstream; it is not silently added to the main application.
- One active workspace/document, one persistence coordinator, one backend session. No legacy/new
  dual writes, whole legacy AppData blob inside the new schema, or save-time schema migration.
- Keep the canonical normalized schema and generic domain contracts. A narrow current-view adapter
  may reuse retained renderers and map completed edits to named commands; it must not become a second
  persistent store or import old database formats. Validate each retained payload/relationship.
- Keep pointer previews in the interaction controller. No document serialization, history entries,
  media bytes, or persistence per pointer frame. Reuse the completed glass hot-path protections.
- Production IPC promotion needs separate explicit capabilities, edition-purpose checks, path tokens,
  size limits and pending-unlock validation. Do not simply expose all Phase 2 commands to stable.
- Keep `AppShell` composition-only; lifecycle and feature state belong in their existing boundaries.
- Benchmark permission remains **files only**. This intermission does not authorize loading the
  benchmark or the user's old document into any database.

## Remaining execution batches — regrouped 2026-09-12

At the user's request, stop treating the small numbered substeps below as separate work sessions.
They remain historical records and acceptance checklists, not mandatory stopping points. Completed
work through 3d3d1 is preserved. Execute the remaining work in these larger outcome-based batches:

1. **Batch A — Finish integration plumbing (remaining step 3 + step 4).** Complete device preferences,
   remembered per-database/canvas view state, remaining canvas-action routing and real image/GIF
   import/lazy loading/session cleanup together. Audit relevant retention/privacy/transport decisions
   as part of implementation, not a separate handoff. Exercise the assembled command, preferences,
   media and session paths with disposable fixtures. Exit with the supporting integration ready for
   visible binding and a concrete remaining cutover checklist, not another isolated callback milestone.
2. **Batch B — Connect the visible app and verify the database cutover (step 5 + database portions
   of step 6).** Wire retained controls/renderers, create/open/unlock/recent/error UI, native lock and
   cleanup; disable legacy initialization/load/save/media paths atomically. Validate retained features,
   restart/save/recovery, edition isolation and security in the actual Tauri app using disposable data.
   Include in-scope cutover fixes and disconnected-path cleanup in this batch. Exit only with tested
   new-database operation; report unmet gates explicitly instead of declaring partial activation done.
3. **Batch C — Resume glass acceptance.** Return to the paused glass plan on the resulting production
   rendering/storage path, including remaining performance/visual checks and in-scope fixes. Benchmark
   loading still requires fresh permission; the existing authorization remains files only.

**Batch A support is complete locally (2026-09-12); active: Batch B.** Preferences, remembered cameras,
canvas routing and session media are assembled and fixture-tested. As of 2026-09-22 the product source
boots the retained database runtime and excludes native legacy storage/commands. Live startup/close, disposable-database persistence, backup/recovery, native media and Windows
lock/privacy have since passed the recorded agent/user checks. Final parity and scope review remains open. The historical
records below describe the earlier unmounted state; REFACTOR-STATE holds the current checkpoint.

2026-09-13 canvas binding checkpoint: `bindCanvas` now composes one retained projection and the existing
interaction controller over the admitted workspace, with resource-ready/singleton guards, active-canvas
camera restoration and permanent session revocation. Its required UI purge callback is retryable on
failure. This replaces the factory's standalone interaction entry; it is not mounted in the visible
app yet. Continue the same Batch B renderer/control/media/lifecycle binding and atomic cutover.
Do not stop merely because one old substep is done. Use focused tests while iterating, then one full
required validation pass and consolidated documentation/handoff at each batch boundary. Rerun affected
checks after subsequent edits; full phase acceptance requirements and live UI verification are not waived.
Keep interruption notes compact so usage limits do not require repeating completed audits or tests.
Pause earlier only for a real safety/authority blocker, required user decision or external constraint;
record the exact completed work and next action. Larger batches do not expand architectural scope,
authorize user-data access or require another rendering/store abstraction or broad App ownership refactor.

## Audit of existing implementation

### Protected-data baseline launch — 2026-09-12

User's old main-branch installation/data/shared credential must stay untouched; refactor development
content is disposable. Use `npm run app:preview:mcp` to inspect the retained UI before cutover. This
dedicated debug-only preview starts from built-in defaults and cannot save, reset, import/export or
access either database system. Its own application identity is required before plugin/single-instance
initialization. Native legacy filesystem/keyring guards plus a minimal capability enforce the boundary;
the frontend's disabled autosave is not the security boundary. It displays a permanent no-save notice.

Do not treat ordinary `app:dev`, `app:dev:mcp`, `app:stable` or an old already-built executable as isolated:
their legacy startup is still present until the atomic cutover. Do not reset/delete the shared Windows
credential, migrate/open old data, or make unrequested copies/exports. The preview needs no access to
the old installation. It does not authorize benchmark loading or prove new-database persistence.

Live preview initial canvas/Canvas Browser, console and capability denials were checked. Continue Batch B
binding from that safe visual baseline; don't restart the small historical callback audits.

### Original activation audit

- `AppShell` mounts `LegacyApplication` outside the normalized provider. The Phase 2 entry is a
  separately gated development harness, not the canvas's database owner.
- `App.tsx` directly invokes legacy load/incremental-save. Rust startup initializes legacy storage
  even when the development database harness is compiled in.
- `createAppStore` already accepts a persistence client and creates the normalized workspace,
  command/history operations and revision-aware autosave coordinator. The default store has no
  persistence dependency. Reuse it rather than build another store/save loop.
- `tauriDatabaseClient` validates/acknowledges pending loads but is wired to development-purpose
  `phase2_*` commands. Stable capability/command exclusion is deliberate today.
- Rust `.tmapdb` repositories, crypto, writer ownership, generations and sessions already exist.
  Production streaming media transport and native automatic-lock delivery are not yet wired.
- The current canvas view expects legacy-shaped arrays and hash-based image references, while the
  new document is normalized and has opaque media IDs. This needs explicit view/command/media
  integration, not just swapping an IPC command name.
- Camera and device preferences are outside `TaskMapDocument`; preserving remembered cameras and
  settings needs explicit non-document ownership, not extra legacy fields in the encrypted schema.

## Step 1 — Connect confirmed loads to the existing workspace (complete locally)

- [x] Add an application-owned composition seam that supplies `DatabaseClient.saveDocument` to the
      existing persistence coordinator and admits confirmed current-version loads into its workspace.
- [x] Reject pending/locked sessions, identity/schema/purpose/revision mismatch, invalid recovery
      metadata and replacement of an occupied workspace. No untrusted payload/error text in messages.
- [x] Test load → named command → save/revision progression and failure/replacement behavior.
- [x] Record the activation decision/limits. Do not change startup, capabilities or the live document.

This first step is supporting code, not a claim that the visible app has switched databases.

Implemented in `src/app/database/createDatabaseWorkspace.ts`, with 24 new tests. Combined focused
workspace/persistence/platform/camera suite: 71 pass. Full frontend: 818 pass / 15 baseline failures,
plus the known jsdom `document.elementFromPoint` errors. Typecheck, lint, architecture, production
build/exclusion checks, Rust formatting, all-feature Clippy and Rust tests pass (67 pass / one ignored).
No real database/keyring access or live UI activation in this step; no new visual verification claim.
The production bundle remains unchanged because the new composition seam is not mounted yet.
Touched formatting passes; five unrelated source/doc formatting failures remain. Generated benchmark
directories are excluded from formatting to preserve their checksum manifests, not counted as source.

## Step 2 — Application session lifecycle and scoped platform activation

Split into **2a lifecycle support** and **2b scoped platform activation** so lifecycle guards can be
tested before changing production permissions. Parts 2a and 2b are complete locally; visible
application cutover and native/UI acceptance remain later steps.

### Step 2a — Lifecycle support (complete locally)

- [x] Wire create/open/unlock/resume to the workspace seam, using existing factories and path tokens.
- [x] One lifecycle owner coordinates operation epochs, busy state, blocked edits during transitions,
      dirty flush, revision conflicts, close/reopen, lock and quit. Stale async results cannot repopulate
      a closed or different workspace. Failed saves prevent ordinary destructive transitions.
- [x] Test pending rejection/cancellation, failed close/lock/save, double actions and backend session
      loss. Do not expose an editable workspace until lifecycle guards are proven.
- [x] On admission failure after backend confirmation, the lifecycle owner must close/relock the
      candidate session. Step 1 only admits/rejects a supplied result; it does not own backend cleanup.

Implemented in `src/app/database/createDatabaseSessionController.ts`, with 27 mock-only lifecycle
tests. Reuses the existing store/autosave path; commands and undo/redo honor a session edit guard.
Cancellation immediately revokes local state, drains in-flight lifecycle work and confirms backend
close before allowing another open. Idle autosave session-loss errors also trigger cleanup. Failed
cleanup leaves the controller blocked. Passwords are request arguments, never controller/Redux state.
The required synchronous resource-purge hook must be wired to real view/media owners in later steps.
Window-close preparation only flushes for the keeper-session policy; native close delivery and
automatic OS/inactivity locking are not implemented here. No new polling or per-pointer work.

Validation: 98 focused database/workspace/persistence/platform/camera tests pass. Full frontend:
845 pass / the same 15 baseline failures, plus 14 known jsdom elementFromPoint errors. Typecheck,
lint, architecture, optimized build and production-exclusion checks pass. No startup, capabilities,
Rust storage, crypto, user-data or visual changes. The optional workspace edit guard reaches the
shared store bundle, but the session controller remains unmounted. No live Tauri acceptance claimed.
Rust fmt/all-feature Clippy pass; Rust tests pass (67 / one ignored) on the approved rerun after the
sandbox blocked an existing process-tree test's cleanup. Touched formatting and CODEMAP pass; the same
five unrelated full-repo formatting failures remain.

### Step 2b — Scoped platform activation (complete locally)

- [x] Promote only required database operations behind explicit application capabilities and
      stable/development purpose policy; retain harness separation and debug-only MCP.
- [x] Connect the lifecycle client to those scoped commands; verify path-token, pending-validation,
      payload-limit and edition-purpose enforcement without activating the legacy canvas's new path
      prematurely. Production startup/canvas/media cutover stays in steps 3–5.

`createTauriDatabaseSessionController` now explicitly composes the guarded workspace with the native
edition-checked application client and tokenized settings client; it is **not imported by AppShell**.
The `application-database` capability grants exactly 15 local-main-window operations, with no remote,
keeper, UI Lab or MCP grant. `phase2_*` aliases retain development compile/identity guards and delegate
to the same `app_*` implementation. Both clients share pending/schema/purpose validation; stable
accepts production-purpose documents and development accepts development-purpose documents.

Raw input limits, one-use edition/process/path tokens, existing Rust crypto and writer ownership are
preserved. Request DTOs reject unknown fields. Save database/session identity is checked atomically
with the backend write; each password unlock rotates session identity to reject delayed pre-lock saves.
The existing content-free keeper and edition-local recent settings are reused without migrating files.

Validation: 16 new frontend tests and five new Rust tests. Focused database/workspace/persistence/
platform/harness suite: 110 pass. Full frontend: 861 pass / the same 15 baseline failures and 14 known
jsdom errors. Rust tests pass with default and all features (72 / one ignored in each). Typecheck,
lint, architecture and scoped capability/harness/MCP production checks pass; full formatting still has
the same five unrelated failures. Real native UI/picker/lock-event acceptance is deferred to cutover;
no app launch, user database/keyring access or benchmark load occurred. **Next: step 3 current-view
and completed-command integration**, beginning with retained payload/command inventory.

## Step 3 — Current canvas view and completed-command integration

Working map: `docs/DATABASE-VIEW-INTEGRATION.md`. Step 3 is split into bounded substeps; full view
integration is still open.

- [x] **3a:** Audit retained fields/actions and add one atomic completed group-geometry command.
- [x] **3b:** Define typed retained payloads and read-only normalized-to-current-view projections,
      starting with text cards/containers; reject unsupported data explicitly. **3b1 card/container
      support and 3b2 text-block/mind-map/connection support are complete locally**;
      **3b3 image/media-reference and 3b4 retained-extension support are complete locally**.
      These remain unmounted read-only support, not editable feature ownership or live parity.
- [ ] **3c:** Map completed feature edits, placement, group layers and selection operations to named
      transactions, with workspace-epoch/canvas guards and no per-pointer document work.
      **3c1 acceptance guards are complete locally**; feature-action commands and callback guards remain.
      **3c2a selection deletion/deletion-lock policy is complete locally**; other actions remain.
      **3c2b geometry/resize capability and lock guards and 3c2c atomic placement command support
      are complete locally**. **3c2d/e content and group-layer command support is complete locally**
      (combined at the user's request). **3c3 captured callback support is complete locally**;
      cross-feature routing/gap checks remain before closing full step 3.
- [ ] **3d:** Verify cross-feature routing, history, settings/view state and failures before the later
      coherent media/startup cutover. Visible changes require actual Tauri inspection.
      **3d1 controller completion/lifetime and 3d2 geometry/drop mapping are complete locally**.
      **3d3a connection and 3d3b extension actions are complete locally**. **3d3c1** internal
      copy/duplicate transactions and session lifetime are complete locally. **3d3c2**
      container-target paste, new-card companions and AI JSON replacement are complete locally.
      **3d3d1** captured document settings and guarded undo/redo are complete locally.
      **3d3d2 and remaining canvas routes** are complete locally in Batch A, alongside media support.
      Full 3d remains open for Batch B visible binding and live acceptance.

3a adds `document.elements.update-geometry` to the existing command registry. It validates every
same-canvas target and expected canonical starting geometry, rejects duplicates/stale/invalid groups,
and makes one transaction; equal-value updates create no patch. Test-only wiring exercises the actual
interaction controller, not a newly introduced production adapter. Step 3a itself introduced no
view/payload projection, renderer or active storage switch. Placement commands, lock policies and
session-replacement guards remain explicit integration gaps in the working map.

3b1 adds strict card/container payload schemas and frozen retained-view projectors in their element
modules, composed by the unmounted projection (renamed `createRetainedCanvasProjection` in 3b2).
Child-owned placement validates
same-canvas container parents and unique child order separately from layers. Unsupported content
anywhere in the document returns sanitized issues with no partial canvas view. All connections,
extensions (even disabled) and media references were unsupported at that intermediate stage;
3b2 below adds supported typed connections.
This is not a legacy importer, feature admission gate or production rendering registry.

Projection memoization uses immutable document/entity identity, not camera state. Unchanged entities
retain view identities; card views do not receive canonical width/height as forced layout dimensions.
An explicit `clear()` drops owned cached references; wiring it into the session purge hook remains
required before mounting. No TaskCanvas/persisted snapshot or second document store is introduced.

Validation: 36 new tests pass; full frontend 910 pass / the same 15 baseline failures and 14 known
jsdom errors. Typecheck, lint, architecture, production build/exclusion checks and Rust fmt/Clippy/tests
pass (72 / one ignored). The stable bundle remains index-BIFTxKvS.js, 626.14 kB. No visible change,
live UI acceptance, user database/keyring access or benchmark load. **Next: remaining step 3b payloads
and projections**, then completed-command routing; the visible app still uses legacy storage.

3b2 extends that same unmounted adapter with typed text blocks, explicit `mind-map-node` elements and
`mind-map` connections. Block geometry/title/header/Markdown and node content-sized presentation are
preserved in frozen props. Connections validate four named ports, same-canvas connectable endpoints,
no self edges and one unordered pair regardless of ports/direction. Containers/text blocks remain
connectable, as in the retained app; ordinary text cards do not. Unknown types/data fail with sanitized
issues and no partial view. Images and extensions remain explicitly unsupported.

Connections are indexed in one document-wide pass, memoized by immutable edge identity, and rechecked
against endpoint capabilities on document changes. `clear()` releases node/block/edge caches together;
actual session purge/feature admission/command wiring remains deferred. No live view or storage switch.
Validation: 82 focused element/projection tests pass; full frontend 955 pass / the same 15 baseline
failures and 14 known jsdom errors. Typecheck/lint/architecture/build/production checks and Rust
fmt/Clippy/tests pass (72 / one ignored). Stable bundle unchanged. **Next: 3b3 image/GIF payloads and
opaque-media metadata projections, then explicit extensions.** No media-byte transport or profile
access occurred in this slice; actual transport remains step 4.

3b3 adds typed image data and metadata-only views, extending the same unmounted adapter. Opaque IDs
never become legacy image hashes or source URLs. Empty placeholders are explicit; missing media is
an error. Intrinsic size/alt text/MIME come from shared frozen media references; canonical geometry,
background setting and shared card/image child order are preserved. Images join the connectable set.
All references, including unused ones, are validated against retained WebP/GIF/SVG representations.
No bytes are read, decoded, stored or imported by these adapters.

Media metadata is cached independently; changing referenced metadata invalidates affected image
props even if elements are unchanged, while unrelated metadata and camera motion preserve identity.
One clear operation drops all owned caches; real session purge and renderer/media-service wiring remain
later work. `ImageNode` still tests legacy `imageId` for presence and cannot simply be handed this shape.
Validation: 155 focused document/element/projection tests pass; full frontend 993 pass / same 15 baseline
failures and 14 known jsdom errors. Typecheck/lint/architecture/build/production checks and Rust
fmt/Clippy/tests pass (72 / one ignored); stable bundle unchanged. No app launch or user profile access.
3b4 below adds explicit extensions before feature admission/completed callbacks and the later real
media/startup cutover.

3b4 adds nine strict module-owned configuration schemas, defaults and canonical target lists through
the existing architecture extension registry. No placeholder controls or active legacy registry edits.
One retained-extension projector validates all installations and supplies frozen metadata/effective
props to the same cached canvas adapter. Activation is distinct from configured flag state; disabled
entries retain validated data, while active installed-but-off controls keep their props. Unsupported,
removed/raw-workflow or incompatible installations fail without partial views. There are no mutual
conflicts among these nine; future structured Workflow Runner integration remains separate work.

Configuration-only changes invalidate target props; unrelated views and geometry-only extension
props reuse identities. Camera samples do no parsing/serialization. Clearing releases extension caches,
but the real session purge remains to be wired. Generic envelope/commands are still feature-agnostic.
Validation: 47 new tests, 202 focused pass; full frontend 1040 pass / same 15 baseline failures and
14 known jsdom errors. Typecheck/lint/architecture/build/production checks and Rust fmt/Clippy/tests
pass (72 / one ignored); stable bundle unchanged. Five unrelated format-check failures remain.
No native launch, profile/keyring access, benchmark load or new live parity claim. Visible app stays
legacy. Step 3c1 below connects data acceptance; remaining completed-edit routing needs
workspace-epoch/canvas guards. Read-only 3b completion does not close full step 3.

### Step 3c1 — Feature-data acceptance guards (complete locally)

The unmounted product composition now supplies `acceptRetainedDocument` to both native-client and
workspace boundaries. It reuses the existing retained adapter's module schemas/relationship checks,
then clears/discards its short-lived projection; it never publishes props or retains a validation cache.
The domain exposes only a feature-agnostic acceptance callback contract, not imports of feature modules.
The platform application factory requires an application-supplied policy; generic core and Phase 2
harness paths remain generic. Policy exceptions fail closed without returning exception/content text.

Native-client guards reject invalid create input before consuming a path token, reject pending
content before confirmation with cancel/close cleanup, relock invalid resumed content, and reject
invalid saves before native invocation. Workspace guards check loaded documents and command/history
candidate results before state/history/persistence publication. Invalid replacements/edits preserve
the current state and any scheduled valid save. Confirmed-load rejection still closes/purges through
the existing lifecycle. Fresh empty documents and valid edit/undo/redo/save remain supported.

Validation: 28 new tests; 235 focused pass. Full frontend 1068 pass / same 15 baseline failures and
14 known jsdom errors. Typecheck/lint/architecture/build/production checks and Rust fmt/Clippy/tests
pass (72 / one ignored); five unrelated formatting failures remain. The small optional guard reaches
the shared store bundle (index-NBOn-qya.js, 626.61 kB), but the retained policy and database composition
remain unmounted. No native launch, user profile/keyring/benchmark access or new live parity claim.

This guards valid feature data, not all permitted feature actions: lock/deletion policy, atomic
reparent/group edits and stale callback epochs are still required. Whole-document validation is on
completed/lifecycle boundaries only; 100 pan + 100 zoom samples invoke no acceptance or serialization.
Large-document completed-edit latency and real renderer/cache-purge/media acceptance remain open.
**Next: remaining 3c, starting with named feature edits and atomic placement/deletion/lock rules,
then completed callback wiring and workspace-epoch/canvas guards.** Visible storage remains legacy.

- [ ] Inventory retained element/connection/extension payloads; implement a narrow normalized-to-view
      boundary and named completed-edit commands. No generic opaque legacy snapshot replacement.
- [ ] Reuse existing renderers and controller presentation; cover create/edit/delete, canvas switching,
      layer/reparent operations, undo/redo, JSON copy/paste and preserved appearance/behavior.
- [ ] Keep document settings, device preferences and per-canvas view state in their declared owners.
- [ ] Fail clearly for unsupported current payloads; never silently discard data. Removed features
      stay removed. Old raw workflows must not become executable in the new document path.

### Step 3c2a — Atomic selection deletion (complete locally)

Adds `document.selection.delete` through the existing command dispatcher. The unmounted product
composition supplies an explicit retained handler list; generic/harness defaults stay unchanged.
The product's `document.element.remove` is routed through the same deletion authority, so single-item
deletion cannot bypass the preference or orphan children. No second command engine/renderer registry.

Matches retained behavior: when locked deletion is disallowed, skip locked selections and protect
containers that own locked card/image children. Other selected unlocked items may still be removed,
including explicitly selected unlocked children of a protected container. With the preference enabled,
locks do not prevent deletion. Disabled lock installations and configured-off locks do not protect.
Duplicate/missing/wrong-canvas/malformed targets reject atomically; there is no force bypass.

One transaction removes permitted targets, contained cards/images, endpoint connections, targeted
extension installations and layer-order entries. It retains media metadata/bytes for undo, and leaves
survivor geometry and relative child order unchanged (valid numeric order gaps need no compaction).
Empty/all-protected selections are no-ops. Deletion planning uses the immutable transaction input and
a short-lived cleared projection; no persistent snapshot, animation timer or media I/O is introduced.

18 new tests; 133 focused pass across command/database/workspace/transport suites. Full frontend:
1086 pass / same 15 baseline failures / 14 known jsdom errors. Typecheck/lint/architecture/build/
production checks and Rust fmt/Clippy/tests pass (72 / one ignored); five baseline format failures
remain. A 1,000-child fixture confirms one transaction without command serialization; 100 pan plus
100 zoom frames perform no deletion work. Stable bundle index-DG64oq3j.js is 626.63 kB; only the shared
optional handler-selection seam changes that bundle. Product deletion remains unmounted.

**Next: remaining 3c, starting with completed geometry/placement commands and move/resize lock rules,
then typed content edits/group layers and callback epoch/canvas guards.** No live UI/storage switch,
user database/keyring/benchmark access or deletion animation/parity acceptance in this slice.

### Step 3c2b — Completed geometry safeguards (complete locally)

Separated geometry policy from the following placement transaction, which must also account for
parent changes, sibling order and the existing filtered/scroll-aware drop decision. Product single
and group geometry commands now share retained lock and resize-capability checks. Containers, blocks
and images can resize; text cards and mind-map nodes retain content-sized presentation and cannot
persist measured preview dimensions as geometry edits. Translation preserves extents when supplied
the canonical completion payload. The existing controller still owns constraints and preview geometry.

The generic group command retains ownership of canonical `from` checks, duplicate/locality validation,
atomic writes and no-op suppression; its schema is exported for reuse, not duplicated. Generic/harness
behavior remains unchanged. The product command checks current effective lock state using a short-lived
cleared projection of immutable transaction input. A newly locked changed target rejects the entire
completion; initially locked targets remain filtered out by the controller. Unchanged locked geometry
is a no-op, and the deletion preference does not authorize moving/resizing locked elements. A child's
lock does not lock its parent or require rewriting the child's canonical geometry on parent motion.

31 new tests; 173 focused pass. Full frontend 1117 pass / same 15 baseline failures / 14 known jsdom
errors. Typecheck/lint/architecture/build/production checks and Rust fmt/Clippy/tests pass (72 / one
ignored); five baseline format failures remain. Stable bundle unchanged (index-DG64oq3j.js, 626.63 kB).
Real controller tests cover 100 preview samples without document/history/save/serialization, canonical
vs measured card dimensions, one completed group transaction/save, undo/redo, cancellation, constrained
resize and mid-drag locking. This is not release timing, native UI parity or mounted callback wiring.

Step 3c2c below adds atomic placement/reparent/detach and sibling ordering, before typed content/group
layers and completed callback epoch/canvas guards. Gesture callbacks must use captured canonical `from`
values through the group command; the single-item command has no caller-supplied stale snapshot.
No native launch, user database/keyring/benchmark access or active storage change in this slice.

### Step 3c2c — Atomic placement command support (complete locally)

`document.elements.place` joins canonical group geometry and card/image child placement in one existing
transaction/history/save path. Caller order defines the moving bundle; the target is a same-canvas
container plus a full-list insertion index after removing the moving IDs, or null for root detachment.
The bounded payload carries captured canonical geometry, moving placements and every sibling's ID/order
in the affected source/target groups. Missing, duplicate, stale, wrong-canvas/type and invalid-index
inputs reject without publishing any geometry/order/history/save changes. Search/scroll/hit-testing and
gesture thresholds remain presentation/controller decisions, not command-owned measurements.

Cards and images use their already-established shared child-order namespace. Only changed sibling
sequences are renumbered; unrelated groups/layers/media/content remain untouched. An unchanged drop
preserves numeric gaps and creates no transaction. Effective locks protect directly moved elements,
including placement-only changes. Locked parents can receive children and indirectly shifted locked
siblings retain their geometry, matching the retained policy. Group geometry still owns its existing
canonical-from/resize/lock checks. Generic data replacement cannot change card/image placement in the
product handler list; other typed content policies remain staged. Generic/harness defaults are unchanged.

42 new tests; 215 focused pass / 22 files. Full frontend 1159 pass / same 15 baseline failures / 14 known
jsdom errors. Typecheck/lint/architecture (444 target files), build/production checks and Rust
fmt/all-feature Clippy/tests pass (72 / one ignored). Five unrelated format failures remain. Stable
bundle unchanged (index-DG64oq3j.js, 626.63 kB). Tests cover 100 real-controller previews/cancel with no
document/history/save/serialization, one completed placement, mixed siblings, captured stale order,
mid-gesture locking, full undo/redo, one save and localized 1,000-sibling edits. The mocked native factory
also exercises the new command. No native launch, user database/keyring access or benchmark load.

Step 3c2d/e below combines typed content edits and group layers at the user's request, before completed
callback epoch/document/canvas guards. Placement command support is unmounted; production drop-decision
binding and session/canvas stale-callback safety are not supplied by these tests. Visible app/storage
remain legacy. Step 3c and the intermission remain open; glass acceptance stays paused.

### Step 3c2d/e — Content and layer commands (combined; complete locally)

The user requested these next two command slices together. `document.elements.edit-content` now
accepts a bounded, explicitly typed group of field-scoped `from`/`to` edits. Each element module owns
its allowed scalar fields: titles/text, card links, accents, header visibility and image background.
Expected keys must match changed keys and current canonical values; stale/missing/wrong-type/canvas
or duplicate groups reject atomically. Unrelated fields survive edits completed later. Writes produce
field-local history patches, not copies of full text payloads for a color change. Equal/empty field
sets are no-ops. Canonical content is preserved exactly; UI draft trimming, blank-save behavior and link
normalization still belong in the upcoming callback binding. Raw media references and placement are
not content edits. Product full-data replacement delegates through the same typed/no-op rules, protects
placement and now rejects media-reference replacement until its dedicated session-bound operation.

`document.elements.reorder-layers` captures the expected root order and applies back/backward/forward/
front to the selected group in its existing stacking order, not click order. Only root slots in the
canonical full element order are permuted; children, placement, geometry, media and content are untouched.
Malformed/stale/duplicate/child targets reject; unchanged/empty actions are no-ops. The product single
reorder API retains absolute canvas indices but permits only root-to-root slots through the same write
authority. Immediate single APIs lack captured field/order preconditions; deferred callbacks must use
the group commands. Locks intentionally permit content and layer changes, as confirmed in legacy code
and the parity contract; movement/resize/deletion rules remain unchanged.

60 new tests; 275 focused pass / 26 files. Full frontend 1219 pass / same 15 failures / 14 known jsdom
errors. Typecheck/lint/architecture (451 target files), build/production checks and Rust fmt/all-feature
Clippy/tests pass (72 / one ignored). Five unrelated formatting failures remain. Stable frontend output
is unchanged (index-DG64oq3j.js, 626.63 kB). Mocked native composition exercises both commands. Actual
controller tests prove 100 pan/zoom samples invoke neither command, then complete layer/content edits
with separate undoable actions and one existing debounced save. A 1,000-element test checks field-local
content and root-slot layer patches without serialization; no release timing claim.

Step 3c3 below adds captured callback support with epoch/document/canvas guards, before step 3d cross-feature
routing/acceptance. Preserve editor finalization and full-list drop decisions during binding; do not
mount the visible app before coherent media/session/startup cutover. No UI/native launch, real user
database/keyring/benchmark access or live parity claim. The visible app still uses legacy storage.

### Step 3c3 — Revocable completed-action callbacks (complete locally)

`createRetainedActionCallbacks` now captures canonical move/resize, placement, field-scoped content,
root-layer and deletion inputs once at action start. One workspace/session subscription pair invalidates
all captures on epoch/document/database/active-canvas changes or any non-editable session transition.
Switching A → B → A cannot revive an old callback. Starting lock/close invalidates synchronously even
if a save failure returns to the same unlocked workspace. Completion consumes its handle before dispatch,
including failures/no-ops, so repeated, cancelled, superseded and reentrant completions cannot replay.

Four bounded action slots hold action-specific values, not full document snapshots; returned handles
retain opaque keys only. Clear/dispose drop captured values; dispose unsubscribes. The existing unmounted
Tauri application factory exposes callbacks, clears them in its purge hook and disposes them with its
controller. No new command dispatcher/store/persistence owner or active App/controller changes.

Move callbacks retain canonical extents; resize retains canonical position. Placement requires an
explicit resolved full-list target/index or null for root, plus the captured moving order and affected
sibling snapshots. Missing decisions fail instead of silently detaching. Capture must follow initial
controller eligibility filtering and be cancelled when a gesture fails to start/cancels. The current
controller still owns previews, constraints and thresholds; no reads/subscriptions run per pointer frame.
Text/title finalizers trim and ignore blank writes; link normalization preserves the retained protocol/
Windows-path behavior without opening anything. Draft/focus/pulse and blank-rename UI behavior stay local.

41 new tests; 316 focused pass / 30 files. Full frontend 1260 pass / same 15 failures / 14 known jsdom
errors. Typecheck/lint/architecture (461 target files), build/production checks and Rust fmt/all-feature
Clippy/tests pass (72 / one ignored). Five unrelated formatting failures remain. Stable bundle unchanged:
index-DG64oq3j.js, 626.63 kB. Tests cover replacement with identical IDs, canvas round trips, lock/unlock,
failed lock save, stale fields/siblings, repeated/reentrant/cancelled actions, editor/link rules and
100 actual controller previews without dispatch/history/save/serialization/lifecycle reads. One completion
uses the existing transaction/save path. Repeated captures keep one subscription pair with disposal checks.

Step 3d below checks normalized view-to-controller eligibility, scroll/search drop decisions and loose
positions, extension/connection/clipboard actions, settings and failure cleanup. Core callback support
does not prove every retained callback is bound. Keep full step 3
open until those gaps are resolved. Real visible binding/media/startup remain steps 4–5. The UI skill was
read to preserve the verification boundary; no visible UI was changed, launched or visually accepted.
No active user database/keyring or benchmark access. Visible app/storage remain legacy.

### Step 3d1 — Controller completion and lifetime binding (complete locally)

`createRetainedCanvasInteractionController` composes the existing gesture engine with the existing
captured callbacks. Translation captures the controller's eligible target IDs after successful start,
so excluded locked members do not invalidate an otherwise valid group. Resize uses the same engine's
capability/constraint checks. Canonical dimensions/positions remain command-owned; layer actions use
the existing root-only command. This is unmounted support, not a second gesture/rendering engine.

Cancellation, no-op/below-threshold completion, canvas replacement and disposal release captures.
Rejected starts and unrelated pointer IDs cannot supersede the active capture. Reentrant starts during
completion/invalidation are blocked. The callback owner's existing subscription pair now notifies
identity/session invalidation, clearing controller previews, snap guides, selection and active gestures.
Pan cancellation restores its starting viewport. Failed save-before-lock cannot revive the old gesture;
stale command failure clears previews and reports a sanitized result without retrying a new snapshot.

28 new tests; 363 focused pass / 38 files. Full frontend 1288 pass / same 15 failures / 14 known jsdom
errors. Typecheck/lint/architecture (466 files), build/production checks and Rust fmt/Clippy/tests pass
(72 / one ignored). Five baseline formatting failures remain. Stable JS/CSS hashes unchanged:
index-DG64oq3j.js / index-Dci71JB_.css. 200 samples each of move/resize/pan perform no workspace/session
reads, dispatch, serialization, history or save work; completed edits use one transaction/save. No FPS claim.

Step 3d2 below adds geometry/drop mapping; 3d1 alone rejected placement gestures and supplied test-only
view bounds. Do not mount partial support. Step 3d3 checks remaining connection/extension/clipboard
and settings/history routes. Full step 3 remains open; real media/startup
remain steps 4–5. The UI skill kept visible acceptance separate: no native launch, screenshot/console
inspection, active profile/keyring/benchmark access or live parity claim. Visible app/storage remain legacy.

### Step 3d2 — Normalized geometry and resolved drops (complete locally)

`legacy/interactions/retainedInteractionGeometry` prepares root/contained gesture targets from the
normalized retained view, reusing the existing geometry/stack/filter functions. Their signatures now
accept readonly structural inputs, including opaque-media image views; runtime legacy behavior is
unchanged. Root selection/snapping excludes contained cards/images; direct contained-card pickup uses
displayed search/scroll position, measured size or the existing fallback. Bundle IDs keep source order,
initial locks are filtered, parent locks do not cascade, and visibility/type-specific snapping is reused.
Loose groups translate; single root mind-map nodes translate with the retained three-pixel threshold.

The unmounted controller accepts text-card placement only with an explicit decision resolver and enforces
the three-pixel minimum. Captures retain card/image type plus geometry/placement, not a new canvas mirror.
Completion validates exact ordered bundle IDs and one finite loose position per member, preserves canonical
extents, and maps the resolved card-only index into the captured shared child list after removing the bundle.
A slot before a card anchors to that card's full-list position; card-list end appends after all remaining
children (including trailing images). Root drops require explicit null. Missing/ambiguous/malformed or stale
decisions reject without a partial write. The existing placement command owns one geometry/order transaction.

The view must update the existing placement service with the release sample before completing, just as
the current App does; it still owns pickup/sway/settle, pointer capture/focus and cancel/purge reset. No
material/motion strategy changes. The compatibility bridge uses admitted retained props only, not removed
sorting/pick-a-card features. This is ready supporting code, not mounted renderer/native acceptance.

32 new tests; 431 focused pass / 51 files before the next slice. Real placement-service/controller tests
cover scrolled/filtered insertion, nonprimary bundle pickup, loose offsets, detachment, text-block blocking,
topmost containers, directional insertion, lock rules, cancellation, stale siblings, undo/redo and one save.
200 placement previews do no workspace/session reads, dispatch, serialization, history or save work; only
completion reads the decision. Combined full validation with 3d3a is recorded below. Stable bundle unchanged.

### Step 3d3a — Connection actions (complete locally)

At the user's request, continued into the next retained action route after 3d2. The same callback owner
now has a fifth bounded slot for connection creation/deletion, without another subscription pair. Typed
ports and source/canvas identity are captured once; null/cancel/superseded/revoked releases cannot write.
`document.connection.complete` invokes existing insertion handlers inside one transaction. Connecting to
an existing endpoint inserts one edge; only a mind-map source may create a new root node plus its opposite-
port edge. Rejected node/edge/duplicate IDs roll back together. Current feature admission remains the shared
endpoint-capability, same-canvas and unordered-pair authority. Locks protect movement/deletion of elements,
not creation/deletion of edges. Captured edge deletion checks the original endpoints/ports before removal.

Node IDs, canonical geometry, default accent/text and clamped release coordinates remain caller inputs;
view selection/focus/entry animation and connection drag previews remain outside persistent callbacks.
No active App callback or pointer-state ownership changed. 28 new tests cover four endpoint types/ports,
atomic node+edge undo/redo/save, lock semantics, invalid/self/duplicate/reversed/missing endpoints, invalid
node inputs, retargeted deletion, null/cancel/supersession and session/canvas revocation. Repeated captures
use no new observers, dispatch or serialization. Real visual port/empty-space release wiring is not accepted.

Combined validation: 60 new tests; 459 focused pass / 53 files. Full frontend 1348 pass / same 15 failures /
14 known jsdom errors, 207 files. Typecheck/lint/architecture (477 files), build/production checks and Rust
fmt/Clippy/tests pass (72 / one ignored). Five unrelated formatting failures remain; CODEMAP 617 files.
Stable index-DG64oq3j.js / index-Dci71JB_.css unchanged. No native launch, user profile/keyring/benchmark
access or live parity/FPS claim. **Next: 3d3b extension actions**, then clipboard/duplication and settings/
history/view-state routes. Full steps 3 and the database cutover remain open; visible app/storage are legacy.

### Step 3d3b — Extension actions (complete locally)

Audited retained App install/drop/remove, privacy/lock/checkbox toggles and search updates. The existing
callback owner now has one sixth bounded extension slot, not additional workspace/session observers.
Install/remove/configuration/activation and retained toggle callbacks capture only selected target types
and installations. Compatibility/defaults come from the existing nine data-only definitions. Installation
IDs are explicit completion inputs for exactly the missing compatible targets. Reinstall preserves existing
IDs, activation and configuration; absent removal and equal values produce no history or save.

`document.extensions.edit` applies one atomic group transaction with captured installation/type/canvas
preconditions. It indexes current installations once, rejects duplicates, collisions, retargeting and stale
values, and preserves untouched references. Product candidate admission remains the configuration/conflict
authority. There are no conflicts among the nine currently retained definitions; removed features are not
reintroduced. Primary lock configuration determines the uniform selected-group toggle; uninstalled members
are skipped and locks do not block their controls. Privacy/checkbox toggle only the primary. Configuration
flags are separate from installation activation, and search preserves the exact untrimmed query.

70 new tests / four files; 529 focused tests pass / 57 files. Coverage includes all nine definitions and
compatible target types, mixed existing/new installation, undo/redo/save, stale/malformed/atomic rejection,
single-use completion and lock/failed-lock/reload/canvas/clear/disposal revocation. Two hundred cancelled
captures add no observers, dispatch or serialization; a 1,000-target install produces one transaction with
only installation patches and one deferred save. These are deterministic contracts, not an FPS claim.

Full frontend validation: 1418 pass / same 15 failures / 14 known jsdom errors. Typecheck/lint/architecture
(485 files), production build/inspection and Rust fmt/Clippy/tests pass (72 / one ignored). Five unrelated
formatting failures remain. Stable index-DG64oq3j.js / index-Dci71JB_.css unchanged; CODEMAP 625 files.

Next: **3d3c clipboard/duplication**, including new-card auto-checkbox/inherit-color companions at creation
or paste, not retroactive changes on extension installation. Search scroll reset, extension-removal editor
cleanup, selection, ripples and presence remain view-owned wiring for cutover; palette/preferences are 3d3d.
The UI skill kept this unmounted slice separate from live acceptance: no native launch, screenshot/console
inspection or user profile/keyring/benchmark access. Visible app/storage remain legacy; full step 3 is open.

### Step 3d3c1 — Internal copy/duplicate transactions (complete locally)

Split 3d3c into internal copy transactions first, then container-target paste/new-card companions/AI JSON.
`captureCopy` adds one seventh bounded slot to the existing completion owner. It retains detached typed
copy-time values, not a document snapshot or media bytes; the returned handle owns only an opaque key.
Internal Copy survives canvas switches within the same workspace. Session transitions (including failed
lock-save), workspace replacement, explicit clear, disposal, supersession and cancel revoke it. All other
captures remain canvas-scoped and the existing transient-controller invalidation notifications still fire.

`document.elements.paste` inserts the copied elements, remapped internal edges and extension installations
in one transaction. Strict ID mappings require exactly one fresh ID/position per captured member and fresh
edge/installation IDs. Canonical dimensions, content, placement order gaps, extension activation/config and
opaque media IDs are preserved; copied container/block names gain the retained ` copy` suffix. Copied child
parents are remapped, otherwise individual card/image copies detach. Existing shared media metadata must
still match; no registration, byte access, decode or corpus copying occurs. Invalid/colliding/foreign-target
or inadmissible candidates roll back together. Copy-time content survives later edits/deletion of sources.

Membership follows current App behavior: container Copy expands text cards only; the existing omission of
contained images (also when selected with their parent) is recorded, not silently redesigned. Only edges
between explicitly selected included endpoints copy. The caller still supplies resolved/clamped paste
positions, measured/displayed child coordinates, ID allocation, selection/focus and entry animations. This
is supporting command/callback wiring, not final keyboard/context-menu, layout or visible parity acceptance.
The root-copy command deliberately rejects attachment to an existing container; that needs 3d3c2's captured
sibling/extension preconditions. OS clipboard and AI-JSON serialization/replacement are not connected here.

43 new tests / four files; 572 focused pass / 61 files. Full frontend 1461 pass / same 15 failures / 14 known
jsdom errors, 215 files. Typecheck/lint/architecture (495 files), production build/inspection and Rust
fmt/Clippy/tests pass (72 / one ignored). Five unrelated formatting failures remain; CODEMAP 635 files.
Stable index-DG64oq3j.js / index-Dci71JB_.css unchanged. Two hundred cancelled copies add no observers,
dispatch or serialization. A 1,000-member paste produces one localized transaction and one deferred save.

Next: **3d3c2**. Preserve fresh-card inherited color versus pasted/AI-supplied colors; apply auto-checkbox
at the appropriate creation boundary, preserving copied checkbox state. Reuse existing AI JSON validation
without reintroducing removed pick-card/raw workflow handling. Keep search scroll/focus/selection cleanup
view-owned. The Tauri UI skill kept this slice unmounted: no native launch, screenshots/console inspection,
active profile/database/keyring/benchmark or OS clipboard access. Visible app/storage remain legacy.

### Step 3d3c2 — Container insertion and AI JSON (complete locally)

Added one shared captured-container precondition and two atomic named commands: `document.container.insert-card`
and `document.container.replace-cards-from-json`. Captures include typed container/children and their extension
installations, ordered deterministically; stale content, geometry, membership/order or installation values
reject before mutation. Locks do not prohibit these retained content actions. Commands reuse existing typed
schemas, checkbox definitions and product admission; no new rendering/geometry/store/persistence authority.

Fresh-card insertion applies inherited container color and automatic checkbox presence rules. A configured-
off active installation still emits its retained feature; an inactive installation does not. Single copied
text-card paste retains copied color and checkbox state/activation, adding only a missing automatic checkbox.
`captureCopy` resolves/captures the destination at the synchronous Paste action (not at Copy); fresh creation
captures at action start. Index inputs use the full shared card/image order, not a filtered/card-only index.
Use the existing resolved-drop mapping at visible binding. Sibling order changes do not move their geometry.

AI export/replacement reuse the existing serializer and strict JSON validation (including HTTP(S)/null links
and six-digit hex colors). Serializer parameter types were narrowed to readonly structural fields only;
its runtime output and active consumers are unchanged. Replacement captures before an asynchronous read or
editor session and uses an eighth bounded canvas-scoped owner slot, with the existing observer pair. It
replaces text cards and their installations in one transaction, retains container controls and images/media,
and applies supplied colors/links plus default unchecked boxes when applicable. New cards fill previous card
slots, then append any surplus; images retain relative order and geometry. Changed lists are renumbered in
the existing unique shared order namespace, preventing card/image collisions. Equal empty-to-empty content
is a true no-op preserving image order gaps. Removed pick-card/raw workflow handling is not reintroduced.

IDs, canonical geometry/default text/colors, resolved insertion index and view cleanup remain caller inputs.
The caller must clear exported JSON/local drafts through the existing purge hook and perform clipboard I/O
only from explicit user actions. No clipboard transport/listener, DOM, App startup or native media code was
changed. Scroll reset/reveal, focus/selection cleanup, menus/toasts and entry animation still need live binding.

50 new tests / four files. 627 focused pass / 66 files (includes five existing AI JSON compatibility tests).
Full frontend 1511 pass / same 15 failures / 14 known jsdom errors, 219 files. Typecheck/lint/architecture
(506 files), production build/inspection and Rust fmt/Clippy/tests pass (72 / one ignored). Five unrelated
formatting failures remain; CODEMAP 646 files. Stable index-DG64oq3j.js / index-Dci71JB_.css unchanged.
Two hundred cancelled JSON captures add no parsing, serialization, observers or dispatch. A 1,000-card
replacement produces one history transaction/deferred save and preserves media references. No FPS claim.

Next at this handoff was 3d3d, split below. Full step 3 and actual visible cutover remain open.
The Tauri UI skill kept support separate from live acceptance: no native launch, screenshot/console
inspection or active user profile/database/keyring/benchmark/OS clipboard access. Visible app/storage remain legacy.

### Step 3d3d1 — Document settings and history routing (complete locally)

Split 3d3d into document settings/history first, then device preferences/remembered view state. The existing
settings client currently handles database paths/recent databases only; it is not a general preferences
transport. Do not route device preferences or remembered cameras into document payloads or legacy AppData.

`captureDocumentSettings` captures only the selected existing settings leaves in a ninth bounded slot on
the same completion owner. `document.settings.edit-captured` validates matching expected/proposed leaves,
rejects stale or malformed values and delegates field-local mutation to the existing settings command
inside one transaction. Grid style/opacities, shadows, locked-deletion policy and minimap retain their
existing document ownership. Unrelated concurrent settings survive; cancellation/equal values are no-ops.
Slider previews remain caller-local; only completed edits dispatch. Session/canvas/reload/cancel/dispose/
supersession invalidate captures, with no additional observer or persistence owner.

The same callbacks expose undo/redo through the existing document transaction history. Available history
first revokes all captures (including internal copy) and cancels active controller previews/selection.
It never commits unfinished motion or replays old drafts when values happen to match again. A synchronous
guard blocks reentrant history/captures; workspace/session changes during invalidation abort the operation.
Empty history is a true no-op retaining pending edits. Failed history is reported without leaking issues.
Navigation remains history-ignore: undo can affect an earlier canvas without changing the active canvas.
This uses the accepted document history, not a second copy of legacy per-canvas snapshot history.

48 new tests / three files; 675 focused pass / 69 files. Settings tests cover all six leaves, grouped edits,
stale/invalid rejection, no-op/lifetime and deferred save. Real move/resize/pan/selection cancellation,
redo revocation, history failure/reentrancy and cross-canvas history are covered. Local preview samples
do not dispatch/serialize/save; completion and history reuse the existing debounce. No FPS claim.
Full frontend 1559 pass / same 15 failures / 14 known jsdom errors, 222 files. Typecheck/lint/architecture
(511 files), build/production inspection and Rust fmt/all-target/all-feature Clippy/tests pass (72 / one
ignored). Same five unrelated format failures remain; touched-file formatting/diff checks pass.
CODEMAP 651 files. Stable index-DG64oq3j.js / index-Dci71JB_.css remain unchanged.

**Next at that handoff was 3d3d2 — edition-scoped device preferences and remembered view state**, beginning with current
field/retention/privacy/transport audit and remaining canvas callback gaps. Keep database/canvas camera
identity explicit, no pointer-frame persistence or legacy preference fallback. Native keyboard/modal/editor/
clipboard cleanup and visible settings controls remain step-5 binding/acceptance work. Full step 3 is open.
The Tauri UI skill kept this support unmounted: no native launch, screenshot/console inspection, active user
profile/database/keyring/benchmark/OS clipboard access or production switch. Visible app/storage remain legacy.

## Batch A — Integration plumbing (complete locally, visible binding pending)

Completed remaining 3d3d2/canvas-action support and step-4 transport/resource ownership together:

- Edition-scoped, strict revisioned device preferences preserve retained defaults with no legacy fallback.
  Remembered cameras use an encrypted device-local cache, separate from document/history/backup content
  (ADR 005). The existing controller emits settled updates; 100 pan samples perform no serialization or
  document save. The exact 256-canvas document limit is covered. Ordinary close/lock flushes resources;
  failures retain the workspace and forced purge rejects late results.
- Captured canvas create/activate, reorder, rename/resize, clear and remove routes reuse named commands.
  Creation activates, final-canvas removal is blocked, active removal selects the previous survivor,
  resize retains canvas clamping, and explicitly confirmed clear preserves retained lock behavior.
  Root element creation and image metadata/insertion use the same bounded callback owner and transaction
  engine. Stale async completions reject without partial document changes.
- Native picker and chunked Blob import write opaque-ID `.tmapdb` media; lazy reads validate integrity
  and format. Shared image processing was extracted without changing retained SVG/GIF/raster recipes.
  Session identity guards every media operation. Shared URL leases limit reads to two, cancel pending
  work and revoke URLs on release/lock/replacement/dispose. Media stays outside Redux and routine saves.
  Native raw-path drop intake and visible renderer/picker/clipboard binding remain Batch B, not silently
  accepted by a generic path command. Unreferenced-media garbage collection is intentionally deferred.

The unmounted factory assembles these services and interaction restoration; no second document store,
render/material strategy, geometry observer or broad App refactor. Existing legacy storage remains active
until Batch B's coherent cutover. No user database/keyring, benchmark import, OS clipboard or native app
launch occurred. No screenshot/console inspection or live visual/security acceptance is claimed.

Validation: 32 new frontend tests and five new Rust tests. Full frontend 1591 pass / same 15 baseline
failures / 14 known jsdom errors (228 files). Rust default/all-feature suites: 77 pass / one ignored each.
Typecheck, lint, architecture, production build/exclusion, Rust fmt and all-target/all-feature Clippy pass.
Five unrelated full-repo formatting failures remain. Production main JS/CSS hashes are unchanged.
See WORK-LOG for exact checks and the Batch B checklist in DATABASE-VIEW-INTEGRATION.

## Step 4 — Real media transport and session cleanup

- [x] Connect image/GIF import and lazy reads to Rust-owned `.tmapdb` media storage with opaque IDs,
      bounded/chunked transport, validation and session-bound access. No bytes in Redux or documents.
- [x] Connect real image/GIF rendering/previews and revoke/dispose handles, URLs and caches on lock,
      session replacement and quit. Saves must not reread or copy the media corpus.
- [x] Fixture-test import, bounded load scheduling/cancellation, malformed media and pending/unlocked
      authorization. Native visible decode/visibility/missing-media behavior remains Batch B acceptance.

## Step 5 — Visible startup and atomic storage cutover

2026-09-13 Batch B checkpoint: create/open/recent/unlock/error, resource readiness/cancellation and
recovery acknowledgement UI now exists in `features/database-entry`, using the real session controller
with an injected stable runtime. It has 23 new regressions including the shared keyboard fix. The
storage-free Tauri entry-flow preview was inspected with simulated files; no actual database cutover
or retained-canvas binding is claimed. Keep the activation boxes below open. Continue this same batch
with concrete canvas bindings/native lifecycle and the atomic switch, not another microstep.

- [x] Add production create/open/recent/unlock/error UI using existing materials; disclose that media
      is unencrypted. Use the Tauri UI development skill and inspect the actual running application.
- [x] Mount the existing canvas only after confirmed load. Gate old initialization/load/save/media
      calls out of the new application route as one coherent cutover; no background legacy writer.
- [x] Preserve old files/keyring without using them. Confirm startup with no file and wrong password,
      create/save/restart/unlock, lock/plaintext cleanup and revision-recovery UI on disposable files.
- [x] Wire native session-lock behavior required for the activated product and validate
      forced-lock versus ordinary save-before-close failure policy; do not claim deferred security.
      Windows WTS delivery and forced-lock/save-failure policy are implemented and verified.
      User explicitly deferred configurable inactivity locking on September 23; it is outside this
      activation gate and remains a later optional feature.

## Step 6 — Acceptance, legacy-path disconnection, return to glass

- [ ] Validate every retained feature against FEATURE-PARITY, including real media and cancelled
      interactions, with one authoritative persistence path and no legacy keyring calls at startup.
- [ ] Pass formatting, TypeScript, lint, unit/integration tests, Rust fmt/Clippy/tests, architecture,
      edition/capability/security tests, packaged/live checks and new hot-path regression tests.
      Track baseline failures separately; compilation does not establish parity/security.
- [ ] Remove disconnected production storage wiring within this scope; keep old-format conversion
      out of the main app. Update state, CODEMAP, security/data docs and actual roadmap checkboxes.
- [ ] Resume glass acceptance part 1 on the resulting rendering/storage path, with new explicit
      permission before benchmark loading. Do not count old debug callback timings as release FPS.

## September 23 acceptance review

Completed evidence is recorded in REFACTOR-STATE and WORK-LOG: current-format entry/admission,
create/save/restart/unlock, wrong-password rejection, recovery acknowledgement/save/reopen,
full-backup restore, save-failure retry, native media import/reload, user-reported drop and privacy,
Windows lock, and window geometry preservation. Source inspection confirms DatabaseApplication
startup and exclusion of legacy storage modules/handlers; no existing user data was converted.

Core implementation and the requested manual database/retained-feature round-trip checks are
accepted, including the subsequent user report on the broader feature checklist. The user explicitly
deferred inactivity locking. Formal Batch B closure remains open for packaged-build/live edition
coexistence validation; remaining phase/release acceptance has not been performed. Latest full frontend run has
1,678 passing tests plus 15 baseline failures and 14 known jsdom errors; do not mark an all-green
phase gate. These limitations must remain explicit even if core database activation is accepted.

## Handoff rule

Complete and record one outcome-based execution batch at a time, using the smaller steps as internal
checklists rather than stopping points. Each handoff states whether the visible app is still on legacy
storage or has actually cut over. Never label supporting infrastructure as final activation. If interrupted,
record a compact checkpoint and resume the same batch instead of creating another numbered microstep.
