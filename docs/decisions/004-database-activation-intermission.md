# ADR 004: Database activation intermission

- Status: Accepted for staged implementation; production cutover pending
- Date: 2026-09-06

## Context

The user explicitly requested connecting the Phase 2 database system to the real application before
resuming glass acceptance. Phase 2 proved a development-only backend/harness; Phase 3 supplied a
normalized command/history/persistence core. The production canvas still uses legacy AppData/keyring
storage. A wholesale element ownership migration or a second document/save architecture is not needed
to authorize the narrow integration, but merely renaming old save commands would violate the schema.

## Decision

Follow `docs/DATABASE-INTEGRATION-PLAN.md` as an explicit intermission in Phase 4.5. Reuse the existing
database/session backend, canonical current document, application workspace and persistence coordinator.
First admit validated confirmed database loads to that workspace; then integrate lifecycle, current
view/command adapters, media and startup. Only the later atomic cutover disables legacy storage in the
production route. There must never be two simultaneous persistence owners for the same document.

View adapters adapt current in-memory presentation, not legacy on-disk formats. Persistent edits go
through named commands; transient controller frames and device/view preferences do not enter the
document payload. Do not embed an opaque AppData snapshot or removed executable workflows in generic
document data to evade normalization. Broad element ownership migration remains a separate roadmap task.

The original Phase 2 development-only IPC exclusion remains in effect until separately reviewed scoped
application commands/capabilities and edition-purpose validation are implemented. Argon2id, AEAD,
pending confirmation, one-use path tokens, input limits and writer ownership are unchanged. Step 1
does not grant new IPC authority or introduce a new database format.

Step 2b implements that promotion with an explicit local-main-window `application-database`
capability and `app_*` command family. Development-only `phase2_*` aliases delegate to the same
bounded implementation after their original edition/feature guard. Stable/development purpose
mapping comes from the native application identifier; UI Lab and unknown identities are denied.
The existing tokenized picker/recent-list and content-free keeper are reused, with no new storage
format or keyring dependency. Native saves additionally bind to the captured database/session identity
inside the write mutex, and successful password unlock rotates that session identity.

The native commands are now registered and permitted in product builds, but the new application
composition remains unmounted: exposing the narrow transport is not the later atomic UI/storage
cutover. Existing legacy startup is intentionally removed only when view/media/lifecycle wiring is
coherent. Production native event delivery, packaged security/parity acceptance and the full glass
acceptance gate remain open. No broad capability, raw path/media command or MCP release grant is added.

Fresh databases are the activation target. Existing databases/keyring entries remain untouched;
conversion is standalone migrator work. Benchmark permission is still files-only. This decision does
not authorize implicit legacy conversion or benchmark loading.

## Consequences

The user's 2026-09-12 preservation clarification authorizes a separate storage-free baseline, not old
data access. `storage-free-preview` is debug-only and requires its dedicated application identity before
plugin setup. It reuses the retained UI with built-in defaults, disables autosave/automatic RPC/update
work, exposes only the default-load/window permissions, and denies legacy native filesystem/keyring
access as defense in depth. It cannot enter the application database path. The permanent no-save notice
is preview-only. This resolves baseline inspection without changing normal storage ownership, adding
a rendering abstraction, importing old data or disguising no-op saves as successful persistence.
Ordinary product/dev launches are not yet isolated; their coherent cutover remains Batch B work.

Step 3b1 establishes child-owned nullable placement for typed cards, with same-canvas container and
unique child-order checks, separate from canonical canvas layer order. Module schemas and retained-view
projectors remain with their element modules. The application adapter is a temporary read-only
composition of those projectors, not a new render strategy, persistent mirror, or second registry.
Incomplete modules are not registered with dummy renderers. Generic envelope validation stays generic;
full feature validation must be connected to admission and transactions before any editable cutover.
The staged adapter returns no partial view when any canvas contains unsupported content, including
connections, media references or extension installations not implemented by this slice.

Step 3b2 extends the same adapter to text blocks and explicit root mind-map nodes, and supports typed
connections with four named ports. Connectability is not restricted to mind-map nodes: retained
containers/blocks are supported, images follow their own payload/media slice. Self connections and
duplicate unordered pairs stay invalid. Endpoint capabilities are revalidated even when cached edge
props are reused. No generic domain import of element modules or schema envelope change is introduced.

Step 3b3 shares child-placement validation across images/cards and adds image endpoint capability.
Image views refer to separate validated metadata, never masquerading as legacy hashes/URLs. Cached
views depend on both element and referenced metadata identity; missing media fails instead of becoming
an empty placeholder. Metadata-only admission supports retained stored representations, not unverified
media-byte execution/decoding. Real ImageNode presence binding and session-bound transport stay deferred.

Step 3b4 registers real data-only extension definitions using the existing optional-Control contract,
without placeholder UI. Installation activation is separate from configured flag state; disabled
installations retain validated data but emit no effective props. Active installed-but-off flags retain
their controls. Typed configuration/compatibility and immutable group projections remain module-owned
and unmounted. Unsupported/removed/raw-workflow installations fail closed, even when disabled. Feature
admission and command enforcement must still be connected before any editable activation.

Step 3c1 injects a neutral acceptance callback into the generic workspace and database transport.
The unmounted product composition explicitly supplies retained-feature acceptance to both. This uses
the existing projection's schemas/relationship checks as a temporary authority, then clears/discards
the short-lived projection. It adds no validation registry or persistent view mirror. Candidate
publication and pre-confirmation/create/read/save checks fail closed, including policy exceptions.
Generic/harness paths remain generic. This is data admissibility only: named action semantics, lock
rules and stale completed callbacks still require command-level enforcement before editable cutover.
Full-document validation cost is accepted at these staged completed/lifecycle boundaries, never pointer
frames; production large-document completion latency remains an explicit later acceptance requirement.

Step 3c2a supplies an explicit application handler list to the existing dispatcher, preserving generic
core/harness defaults. Shared selection deletion and the product single-remove replacement use one
retained deletion authority: skip protected targets, cascade permitted parents, retain media for undo.
No new command engine or placeholder element registry. Other action policies remain staged, so the
handler list is not permission to mount the editable app or claim full lock/feature parity.

Step 3c2c extends the same product list with atomic geometry/placement and sibling-order completion.
Captured moving geometry/placement and affected sibling snapshots reject stale drops. The existing
shared card/image order namespace stays distinct from canvas layers. Only changed sibling sequences
are renumbered; unchanged drops preserve gaps. Generic product data replacement cannot bypass placement.
Search/scroll/hit-testing stays outside the transaction; actual callback epoch/canvas binding remains
required. This is bounded unmounted command support, not another model/store or editable activation.

Step 3c2d/e combines typed field-scoped content and atomic root-layer commands without new dispatchers.
Modules own editable scalar schemas; the product composes them and protects placement/media ownership.
Content patches stay field-local. Layer writes permute root slots in the existing complete layer array,
leaving child slots and child-owned order intact. Locks permit content/layer controls, as in retained
behavior. Generic single product APIs share the guards but are immediate-only; captured callbacks need
the group expected-field/root-order APIs plus the pending session/canvas binding. No schema change.

Step 3c3 adds bounded callback lifetime ownership at that same unmounted application boundary. One
subscription pair revokes action-specific captures on session/workspace/canvas transitions; single-use
opaque-key handles cannot restore old snapshots after purge. No whole-document callback cache or
per-pointer subscriber is introduced. Existing commands still own mutations and action policies.
Editor-value finalization remains separate from local view focus/draft/presence behavior. Full retained
callback routing and real visible/native acceptance remain required before cutover.

Step 3d3c1 keeps internal Copy in that same bounded completion owner, not a second clipboard/store service.
Its one slot survives canvas changes within the same workspace to preserve cross-canvas paste. Every
session/workspace/explicit purge still revokes it, including failed save-before-lock. Gesture/edit slots
remain canvas-scoped; transient invalidation notifications are unchanged. Copied values contain only typed
selected data/opaque media metadata and are retained by owner entries, never returned handles. This is not
an OS clipboard format, media transport, cross-database copy or visible activation decision.

- Database activation parts of later roadmap phases are intentionally brought forward, without
  claiming those phases or the glass acceptance gates are complete.
- The main application is not switched until media, edit/save and lock/close behavior are coherent.
- Each handoff distinguishes built/tested support from active production wiring.
- Actual retained-feature, security and rendering validation is required before cutover acceptance;
  no compilation-only parity or security claim.
