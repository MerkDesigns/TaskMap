# Database intermission: retained-view integration inventory

Audited 2026-09-07 against the current source on `architecture-v1`. This is the step-3 working map,
not a new document format, legacy-data importer, rendering abstraction or claim of visual parity.
The visible app still uses the legacy document owner. See `DATABASE-INTEGRATION-PLAN.md` and ADR 004.

## What is actually connected

The normalized workspace, named generic commands, patch history, autosave and guarded database
lifecycle exist. The new element registry remains empty (`src/elements/registry.ts`); step 3b4 adds
nine data-only definitions to `src/extensions/architectureRegistry.ts`, without placeholder controls.
Generic `DocumentElement.data` and extension
`configuration` accept JSON objects; structural validation alone does not establish renderable feature
payloads. Benchmark/harness payloads are test inputs, not authoritative retained-feature contracts.

`App.tsx` still owns feature callbacks and uses `useCanvasDocument` collection/value setters.
`createLegacyCanvasInteractionCommitAdapter` commits whole in-memory `TaskCanvas` replacements;
that is the existing compatibility boundary, not an interface to copy into the new persistence path.
No schema-valid document should be presented as editable merely because its unknown payload is JSON.

## Field and relationship map

The target ownership column describes required integration. The staged codecs implemented so far
are listed at the end; it does not imply live feature wiring.

| Current view data                                                | Normalized owner / required treatment                                    | Main gap or hazard                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Canvas `id`, `name`, `width`, `height`                           | `CanvasRecord.id/name/settings`, document `canvasOrder`                  | Stable per-canvas selectors; no `TaskCanvas[]` persistent mirror                               |
| Containers: name, accent, header controls, rectangle             | Element geometry plus container-owned typed data                         | Container children must be validated and ordered, not hidden in an opaque legacy blob          |
| Text cards: text, accent, optional link                          | Text-card-owned typed data; geometry remains separate                    | Current cards have content/measured dimensions, not persisted width/height fields              |
| Card `kind: mindmap`                                             | Explicit mind-map type/definition reusing retained presentation          | Do not scatter `kind` switches across unrelated services                                       |
| Text blocks: name, text, accent, header controls, rectangle      | Text-block-owned typed data and geometry                                 | Preserve title/editor behavior and optional defaults                                           |
| Images/GIFs: `imageId`, format, natural size, accent, background | Opaque media ID and `mediaReferences`; image-owned display data/geometry | Current ID is a hash; never reinterpret it as a new media ID or fetch via legacy media storage |
| Card/image `containerId`, `order`                                | Explicit typed same-canvas parent/child relationship and child order     | Validate parent type, membership, detach/reparent and cascading deletion atomically            |
| Optional root `layer` across separate arrays                     | Canvas `elementOrder`, projected for retained views                      | Root stacking and container child order are different relationships                            |
| Mind-map connection endpoints and ports                          | `DocumentConnection` endpoints, type and typed data                      | Validate endpoint types and left/right/top/bottom ports, not only same-canvas existence        |
| Element `extensions` object                                      | Explicit registered `ExtensionInstallation` records                      | Installation/enabled state/configuration and target compatibility need feature validation      |

Do not persist transient measured text-card bounds simply because the generic geometry record has
width/height. The adapter must distinguish canonical geometry from content-derived presentation.
When committing translation, preserve canonical extents unless the completed edit actually resizes
them. Capture canonical `from` values at gesture start, not guessed culling dimensions.

## Extension inventory

Source: `src/types.ts`, `src/extensions/registry.ts`, `src/app/appDataSchema.ts`, FEATURE-PARITY.

- Retained: privacy (`enabled`), lock (`enabled`), color tools (`enabled`), checkbox (`checked`),
  search (`query`) and AI JSON copy/paste (`enabled`). Preserve retained target restrictions and
  behavior while giving each definition its typed configuration and named commands.
- Existing companion behavior: auto-checkbox, counter and inherited card color on containers.
  These are not listed among removals; do not silently drop them during projection. Their payloads
  and behavior need explicit coverage when container definitions are connected.
- Removed by contract: daily reset, sorting and pick-a-card. They must not enter the new production
  registry. Reject unsupported current payloads with a clear error; legacy conversion stays separate.
- Raw `commandRunner.commands[].command`, `runAsAdmin` and old run modes are not a Workflow Runner
  payload. Never convert them into executable actions implicitly. The structured runner needs
  executable/arguments/directory/sequencing/display mode and explicit imported-workflow trust.

The generic command layer remains feature-agnostic. Product acceptance checks extension targets;
step 3c2a adds deletion lock policy and 3c2b adds geometry lock/resize-capability checks in its application
command list. Steps 3c2c and 3c2d/e add placement and typed content/layer rules below; full callback and
cross-feature routing remain open. Command support alone is not feature parity.

## Settings and transient ownership

| Existing field / state                                                              | Owner                                                                                               |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Grid style/opacities, element shadows, locked deletion preference, minimap enabled  | Existing `documentSettings`, updated through named commands                                         |
| Pan, zoom, pointer previews, selection, hover, menus, editor focus                  | Existing interaction/local presentation owners; never geometry command payloads or history          |
| Remembered per-canvas camera and preview viewport                                   | Explicit view-state owner keyed by database/canvas; restoration and retention still need wiring     |
| Default element colors, recent colors, toolbar visibility, dismissed update version | Device/preferences integration, not new fields in `TaskMapDocument`; preserve behavior deliberately |
| Global privacy toggle                                                               | Presentation/session policy; distinguish it from persisted per-element privacy installation         |
| Discord settings                                                                    | Removed by contract; no new-schema fields or startup integration                                    |

No new device/view persistence mechanism is implemented in this slice. Cross-session remembered
settings and camera behavior remain acceptance items, not permission to serialize the legacy AppData.

## Completed-edit action map

| User action                                       | Existing named domain support                          | Integration still required                                                                  |
| ------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Create/rename/resize/switch/reorder/remove canvas | `document.canvas.*`                                    | Wire callbacks/selectors; switching is history-ignore but may persist active canvas         |
| Insert/remove/edit one element                    | `document.element.*`                                   | Typed feature commands/validation and renderer callback mapping                             |
| Group translation / geometry completion           | `document.elements.update-geometry` (added in 3a)      | One canonical, same-canvas payload per completion; not one dispatch per target              |
| Container placement, bundle detach/reparent       | Not a geometry-only action                             | One transaction for geometry, parent and child order; preserve scroll-offset/layout rules   |
| Raise/lower selected group                        | `document.elements.reorder-layers` (3c2d/e)            | Bind captured root order and selected IDs; preserve root/child distinction                  |
| Connect/delete mind-map edge                      | `document.connection.*`                                | Typed ports/endpoints and existing rendered connection callbacks                            |
| Install/toggle/configure extension                | `document.extension.*`                                 | Registry IDs, compatibility/conflicts, feature state and commands                           |
| Paste/duplicate/delete selection or AI JSON edit  | Individual generic operations exist                    | One validated transaction with fresh IDs and relationship remapping; no partial application |
| Undo/redo                                         | Existing workspace history; guarded callbacks in 3d3d1 | Keyboard/menu/focus binding; callbacks already cancel incompatible controller previews      |

The new group geometry command validates every target first, rejects duplicates/wrong canvas/stale
canonical `from` geometry and changes all targets together. Equal geometry produces no patch, history
or save. It does not interpret placement, enforce feature-specific locks, or modify layers/data.
There is no production interaction adapter in 3a. Test-only wiring exercises the real interaction
controller against the existing workspace: 100 preview frames do no serialization/history/save,
one completion schedules one transaction/save, and undo/redo restores the entire group.

## Integration sequence and acceptance

1. **3a — This inventory and atomic geometry foundation:** complete locally. No visible changes.
2. **3b — Typed payloads and read-only current-view projection:** card/container substep 3b1 and
   text-block/mind-map/connection substep 3b2, image/media-reference substep 3b3 and explicit-extension
   substep 3b4 are complete locally (see below). Keep models/validators with their module;
   retain renderer reuse and fail clearly for unsupported payloads. Do not mount an empty/partial view
   that silently hides unsupported content. Memoize from document revisions, never camera frames.
3. **3c — Completed feature commands and callback routing:** placement, group layers and selection
   edits are atomic. Capture workspace epoch/document/canvas identity at gesture start; reject stale
   completions after clear/reopen/switch even if element IDs and geometry happen to match. Preserve
   existing controller and direct camera presentation. No extra persistent store or save coordinator.
4. **3d — Cross-feature integration checks:** undo/redo, JSON copy/paste, settings/view state and
   failure reporting. Wire the accepted view only with coherent media/session lifecycle in steps 4/5.

3c2a now supplies atomic `document.selection.delete` and a retained single-remove replacement through
the existing dispatcher. It skips deletion-protected targets, protects containers with locked children,
cascades permitted parents, and preserves media for undo. Invalid targets fail as a group; policy-skipped
locked items do not prevent deletion of other selected items, matching retained behavior. Numeric child
order gaps remain valid; survivor order/geometry is not rewritten. Product handlers are unmounted.
3c2b now routes both product geometry entry points through effective-lock and resize-capability checks,
then delegates to the existing generic group transaction. Canonical expected-from validation and no-op
semantics remain there. Cards/mind-map nodes are not resizable; caller-supplied measured dimensions
cannot replace canonical extents. Initial lock filtering stays in the controller; a newly locked changed
target rejects the whole completion. Constraints remain in the controller, and no placement is inferred
from x/y edits. Single-item geometry has no caller-supplied expected-from snapshot and is not a safe
gesture-completion binding by itself.
3c2c adds `document.elements.place` to that same unmounted handler list. Its strict payload combines
canonical geometry updates, an ordered moving card/image bundle with expected placement, nullable
target container/full-list index (after removing the bundle), and complete expected affected sibling
ID/placement snapshots. Missing/stale/duplicate/wrong-canvas/type input rejects atomically. Geometry
and child order commit together; only changed sibling sequences are renumbered. Layers/media/other
groups stay unchanged. Identical drops preserve numeric gaps and create no patches. Locked moved
targets reject changes, while locked parents and indirectly shifted siblings remain allowed.
Product `document.element.replace-data` now forbids placement changes, so it cannot bypass this command;
its other content policies remain staged. Generic core/harness behavior is unchanged.

Pointer hit-testing, threshold/hysteresis, scroll/search filtering and visible-to-full index mapping
stay with interaction/presentation. Future binding must capture canonical geometry/sibling snapshots
before the gesture and retain epoch/document/canvas guards; do not snapshot current state at completion
to defeat stale checks. These unmounted commands do not establish live placement parity or callback
safety. Step 3c2d/e below supplies typed content and layer command support.

3c2d/e adds `document.elements.edit-content`: discriminated retained types with module-owned scalar
fields, equal-key field-scoped `from`/`to` groups, current-value checks and atomic failure/no-op handling.
Content edits keep unrelated fields/placement/geometry/media intact and use field-local history patches.
Editable fields cover container/block titles, card/block/node text, card links, accents, header controls
and image background; placement, media IDs and extensions have separate action ownership. The product
full-data replacement API shares these typed rules and disallows media-reference replacement. Generic
core/harness behavior remains unchanged. Locks allow these content controls, matching retained behavior.

The same product list adds `document.elements.reorder-layers`: expected root order, selected root IDs and
back/backward/forward/front direction. Selected elements retain stacking order even when selection IDs
arrive reversed/noncontiguously. Only existing root slots in `canvas.elementOrder` change; child slots,
placement and element records do not. Locks allow layers. The product single reorder accepts absolute
canvas indices only when both source and destination are root slots. Its immediate API has no expected
order snapshot, just as full data replacement has no captured field snapshot; defer neither across edits.

Step 3c3 supplies captured callback epoch/document/canvas guards; next is 3d cross-feature checks. Editor drafts
remain transient and callbacks must preserve legacy trim/nonblank-save/link normalization before sending
canonical fields. Per-type color-preset mapping also stays with existing presentation policy. Layer
callbacks filter child selections before the strict command. No UI/renderer, media transport or active
database cutover is implemented by this slice.

### Step 3c3 callback boundary

The unmounted product factory now returns `callbacks` from `createRetainedActionCallbacks`. Capture once
when an action starts; complete/cancel once. Call `captureMove` after eligibility filtering, supplying
the exact controller target IDs and the ordered placement IDs when applicable. Completion maps only
final x/y or width/height onto captured canonical geometry. A placement target is explicit (null=root);
the caller still resolves scroll/search/hit-testing and loose-position overrides. Missing decisions reject.
Content capture lists exact fields, so unrelated edits survive; layer capture filters child selections
and retains the expected root stack. Deletion uses the existing command's current lock/cascade policy.

One store/session observer pair tracks only identity/editability. Every observed canvas transition,
workspace replacement/clear, non-editable lifecycle transition, explicit purge or disposal revokes all
captured values. Each bounded slot supersedes its prior action; returned closures retain opaque keys,
not plaintext snapshots. Completion consumes before dispatch, including failed/no-op/reentrant attempts.
The factory clears captures before external purge and disposes their subscriptions with its controller.
Session failure recovery never restores old callback authority. This is callback lifetime ownership,
not a second document/interaction/command engine.

`retainedEditorCallbacks` implements trimmed nonblank text/title writes and module-owned link
normalization; no link/path is opened. Focus, pulses, draft state and blank-rename staying open remain
view concerns. Invalid capture returns null; expired/invalid/command-failed completion is sanitized.
Consumers must report failure/clear previews without retrying from refreshed snapshots. Step 3d1 now
composes the existing controller and callbacks in `createRetainedCanvasInteractionController` (unmounted):
capture follows successful controller eligibility filtering, rejected starts preserve active captures,
and cancelled/no-op/threshold/replaced/disposed gestures release them. Callback identity invalidation
also clears previews/guides/selection, using the same subscription pair. Only completion dispatches;
reentrant starts during completion/invalidation reject. Sanitized command failure does not retry.

Step 3d2 adds `legacy/interactions/retainedInteractionGeometry`: reuse the existing readonly root geometry,
measured/fallback size, contained-card stack/search/scroll and snap calculations with normalized retained
props. Prepare at gesture setup, not during pan. Source-order bundles exclude initial locks. The controller
now accepts `place` with a decision resolver and a three-pixel minimum. Update the placement service with
the release sample before completion; retain view-owned pickup/settle/cancel and purge reset.

`retainedTextCardDrop` validates exact ordered moving IDs and finite loose offsets, then maps the service's
card-only insertion index to the captured shared child list after removing movers: before-card anchors
use that card's shared slot, end appends after all remaining children. No refreshed sibling snapshot,
implicit detachment or per-pointer command work. Runtime legacy calculations and production bundle are
unchanged. No second geometry/rendering strategy or admission of removed sorting/pick-a-card data.

Step 3d3a adds `captureConnection` / `captureConnectionDelete` to the same owner (fifth bounded slot).
`document.connection.complete` inserts an edge or a root node+opposite-port edge atomically using existing
handlers; only a mind-map source may grow a node. Shared admission still validates endpoints and pairs.
`document.connection.delete-captured` checks the original edge endpoints/ports. IDs, new-node canonical
geometry/default values and clamped coordinates remain caller inputs; drafts/previews/focus stay local.

Step 3d3b adds extension install/remove/configuration/activation/toggle captures in one sixth bounded slot.
`document.extensions.edit` validates captured target types/installations before one atomic group update;
the same definitions/admission own compatibility, strict configuration and conflict validation. Install
completion supplies IDs only for missing compatible targets; reinstall preserves existing activation/config.
No-op remove/configuration changes preserve references/history/save state. Primary lock config determines
the selected group's value, skipping uninstalled targets; privacy and checkbox remain primary-only. Top-level
installation activation is not the configured enabled flag, and search stores the exact query. Selection,
extension-drop motion, search scroll reset and removal/editor cleanup stay outside persistent callbacks.
New-card auto-checkbox/inherited color belong to 3d3c creation/paste transactions, not retroactive install
effects. These bindings stay unmounted.

Step 3d3c1 adds session-local `captureCopy` and atomic `document.elements.paste`. The seventh owner slot is
cross-canvas within one workspace, unlike gesture/edit slots; all session/workspace revocations still clear
it. Single-use handles do not retain plaintext. Strict completion maps allocate fresh IDs and provide final
canonical positions; copied dimensions/content/extension values remain copy-time values. Child parents and
included internal edges/extensions remap together. Images reuse matching opaque metadata, never bytes.
Container Copy preserves current text-card-only expansion (contained-image omission is a known legacy gap).
The caller owns copy/paste coordinate resolution, layer/presentation acceptance, selection, focus, animation
and clipboard/menu UI. This root-copy command cannot attach to an existing parent.

Step 3d3c2 adds `captureNewContainerCard`, `captureContainerJsonReplace` and explicit `getContainerJsonForAi`.
The new eighth owner slot is canvas-scoped; the clipboard slot retains its cross-canvas scope. A copied single
text card can supply a target to `captureCopy.complete`; the destination snapshot is taken at that synchronous
Paste boundary. Two named container commands validate captured container, full children and installations.
Fresh cards apply inherited color/automatic checkbox presence rules; copies retain color and any existing
checkbox activation/check state. Index inputs are full shared-list indices: visible callers reuse the existing
card-only drop mapping. IDs/defaults/canonical geometry remain explicit caller inputs.

AI JSON reuses existing serializer/validation, exports only on explicit request and rejects stale async/editor
completion. Replacement removes old text cards and their installations, preserves images/media and container
controls, uses supplied colors/HTTP(S) or null links, and adds default unchecked boxes when appropriate. New
cards occupy old card slots then append; changed lists are renumbered once in the shared unique order namespace.
Empty equal replacement is a true no-op. Clipboard I/O, exported-string/draft purge, scroll reset/reveal, focus,
selection, toasts and animations remain visible binding work. Step 3d3d1 adds settings/history support below.

Step 3d3d1 adds `captureDocumentSettings` for explicit existing leaf paths (grid style/dots opacity/lines
opacity, shadows, locked deletion and minimap). Capture on edit start, keep previews local, then complete
once or cancel. Matching leaf sets and expected values guard field-local mutation; unrelated concurrent
settings are retained. It reuses the core settings schema/command and existing callback subscriptions,
not a preference store. Device defaults/recent colors/toolbars/dismissed updates and remembered cameras
are deliberately absent; the native settings client currently provides database path/recent APIs only.

The callback owner also exposes `undo`/`redo` through the existing document transaction history. Available
history revokes all captured edits/copies and cancels controller move/resize/pan/selection before applying;
empty history leaves drafts untouched. A reentrancy guard prevents callbacks or history from starting
during that operation, and changed session/workspace identity aborts before history application. Errors
are sanitized, history is not duplicated, and saves use the existing debounce. Cross-canvas transaction
undo leaves the currently active canvas unchanged; navigation/camera are not history entries. Visible
keyboard focus/modal guards, menu/editor/draft/copy cleanup still require live binding/purge hooks.
Batch A now supplies edition-scoped device preferences, encrypted remembered cameras, canvas callbacks
and session media support. Full visible step-3/4 acceptance remains open and app/storage are still legacy.

### Batch B cutover checklist — supporting services assembled in Batch A

Use the existing unmounted `createTauriDatabaseSessionController` factory, not another store/controller.
Its `preferences`, `views`, `media`, `callbacks`, `importImage` and `bindCanvas` are ready for binding:

1. After confirmed create/open/unlock/resume, call `initializeResources()` and handle failures visibly.
   Call `bindCanvas` only after resources are ready; it owns the projection and existing interaction
   controller together, follows active-canvas changes, and restores remembered pan/zoom with
   the current viewport extent; connect only its settled notification to camera persistence. Canvas
   navigation must retain each camera without moving pointer frames into React/document snapshots.
2. Bind device controls to preference snapshots/updates, separately from named document-setting edits.
   Preserve color defaults/recent-color behavior, toolbar/privacy toggles and dismissed update version.
   Keep failed preference/view writes actionable; ordinary save-before-close may not discard errors.
3. Route Canvas Browser create/order/details/confirmed clear/remove through captured canvas callbacks.
   Preserve default sizes/name trimming, popup/focus/presence behavior and previous-canvas selection.
   Route fresh elements through creation callbacks; view-owned ID/default geometry decisions stay local.
4. Bind visible/imminent image renderers to shared `media.acquire` leases and release them on exit.
   Opaque media IDs are not legacy hashes. Preserve placeholder/loading/error/background/GIF behavior;
   do not call legacy image cache or native hash readers. Picker uses session-bound `media.import(null)`;
   Blob inputs use bounded chunk transport. Capture the command callback before awaiting import. Preserve
   aspect/default placement using returned metadata when needed; `importImage` takes caller-supplied
   geometry. Native Tauri path-only drop events still need an authorized native intake, not raw-path IPC.
5. Mount the factory's single `bindCanvas` view and connect its required `onRevoke` to editors/drafts, internal copy/JSON buffers,
   menus, selections, gestures and image elements to the factory's required purge hook. Resource services
   already clear their own captures/camera maps/URLs, but cannot clear plaintext held by retained UI.
   The binding now subscribes to completed workspace/session changes, preserves its snapshot during
   pointer frames, and permanently clears its projection/controller on workspace/session revocation.
   Its `subscribe`/`getSnapshot` pair is ready for the retained UI; production mounting is still open.
6. Implement visible create/open/recent/unlock/error UI, native forced-lock/inactivity/window-close
   delivery and atomic exclusion of all legacy startup/load/save/media entry points. Keep AppShell
   composition-only. Preserve user files/keyring; use fresh disposable fixtures, not implicit conversion.
7. Inspect before/after in real Tauri, exercise retained features and media, restart/save/recovery,
   cancellation, lock/late-response cleanup and edition/capability isolation. Record screenshots/console
   and failures. New transport registration and unit tests alone do not close these live gates.

ADR 005 records device-local cache/backup semantics and bounded media decisions. No benchmark load is
authorized. No media garbage collection was introduced; undo and failed/stale imports can retain bytes.

Visible renderer/control changes require before/after inspection of the actual Tauri app using the
UI development skill. No live visual verification is claimed by this source inventory or command tests.
No actual document, keyring or benchmark data was opened or converted.

### Step 3b1 implementation boundary

`text-card/textCardModel.ts` and `container/containerModel.ts` now own strict typed payloads and full
element schemas; their adjacent view projectors produce detached frozen retained-renderer props.
The precise payload/placement contract is recorded in DATA-FORMAT. The temporary application
adapter (now `view-projection/createRetainedCanvasProjection.ts`) initially composed only these views.
It scans all
canvases and fails closed for unknown/invalid elements, missing/wrong-type/cross-canvas parents,
duplicate child order, or any still-unsupported connections/extensions/media references. It neither
converts legacy documents nor silently strips removed features. The production element registry
remains empty until complete definitions can be registered without placeholder renderers.

It accepts only an already validated immutable workspace document. It does not replace generic
document parsing or yet enforce feature schemas in the session/command boundary. No React, DOM reads,
material strategy, callback execution, media bytes, camera state or persistent TaskCanvas mirror.
Cached results/entities are reused during pan/zoom; a completed geometry edit only reprojects changed
entities (layer changes also invalidate their derived layer). Relationship checks still rerun when a
parent changes. `clear()` releases the adapter's owned references but cannot revoke references held
by consumers; real lifecycle purge wiring and unmounting remain required later.

36 new tests cover the schema, projection, relationship, unsupported-content and cache boundaries,
including 100 real-controller pan samples and 100 zoom samples with no parsing or serialization.
No retained feature is marked visually accepted. Step 3b2 below extends this same adapter, not a
parallel view path; image metadata and explicit extensions still precede completed callbacks in 3c.

### Step 3b2 implementation boundary

`text-block/` owns strict block payloads and frozen retained props including geometry, title, text,
accent and explicit header state. `mind-map/` owns explicit root node payloads, content-sized retained
card props, four-port edge schema, relationship checks and edge props. Node data does not accept link,
placement or legacy `kind`. Connection data is strictly empty rather than silently ignoring fields.

The existing adapter/types were renamed to `createRetainedCanvasProjection`/`retainedCanvasProjectionTypes`;
there is no compatibility wrapper or second active adapter. `createMindMapConnectionsProjection` is
its connection-cache/index helper. One pass over connections groups by canvas; immutable edge identity
reuses parsing/props while every changed document rechecks current endpoint capabilities and duplicate
pairs. Moving a connected node preserves unchanged edge/block prop identity. Clearing drops all caches.

Source audit of App's endpoint logic and appDataSchema confirms containers, blocks, images and mind-map
nodes are connectable, while ordinary cards are not; self/duplicate unordered pairs are rejected.
3b2 covers supported containers/blocks/nodes only; images will join after typed image support. Generic
document validation already checks missing/cross-canvas references; module relationship checks also
enforce the supplied same-canvas capability map. Invalid/off-canvas/unsupported content never produces
a partial success. No geometry measurement, React/DOM/material work, byte decoding or serialization.

82 focused tests pass; full frontend 955 pass / 15 unchanged failures / 14 known jsdom errors.
No renderer/startup/lifecycle hook is mounted and no new live parity claim. Step 3b3 below adds image
metadata; explicit extensions, feature admission and completed commands remain. Real transport is step 4.

### Step 3b3 implementation boundary

`image/imageModel.ts` owns strict opaque-ID/background/accent/placement data and typed media-reference
validation; adjacent `imageViewProjection.ts` produces frozen metadata-only image views. The common
nullable placement schema moved to `domain/document/elementPlacement.ts` with no change to card data.
Card/image child order is checked together, and valid images (including placeholders) are connectable.

`createImageMediaProjection.ts` caches references by immutable identity and the reference collection;
the existing retained adapter additionally keys image views on their referenced metadata identity.
Referenced size/alt-text updates invalidate the image without element edits; unrelated metadata edits
leave the image unchanged. Removed/invalid references invalidate cached images and return no partial
view. Unused references are still validated/retained. Clearing drops image/reference/edge caches.

Accepted metadata MIME values match retained storage representations: WebP/GIF/SVG; unknown or other
unprocessed representations fail explicitly. Nullable dimensions are paired and never guessed. This
does not establish safe bytes/decoding/animation: Rust validation and bounded transport remain step 4.
The adapter exposes a `media` record, never a legacy hash in `imageId`, URL, or inline byte array.
Current `ImageNode` consumes externally supplied URLs but uses `imageId` to distinguish empty content;
that presence/callback binding must be adjusted in the later coherent renderer cutover, not bypassed
by loading opaque IDs through `useImageCache`. Empty/loading/failure/chromeless/GIF behavior still needs
actual Tauri acceptance then. No visible UI change or direct legacy media call in this slice.

155 focused tests pass; full frontend 993 pass / same 15 failures / 14 known jsdom errors. Added schema,
placeholder/reference, mixed child-order, image-endpoint, cache dependency/clear and real-controller
100-pan/100-zoom checks. Step 3b4 below adds explicit extensions before feature admission/callbacks.

### Step 3b4 implementation boundary

The existing architecture extension registry now explicitly lists nine definitions, each owning a
strict configuration schema, defaults and compatible canonical element types. They cover privacy,
lock, color picker, checkbox, search, auto-checkbox, counter, inherited card color and JSON copy/paste.
No dummy Control, new rendering registry or changes to the active legacy registry are introduced.
The structured Workflow Runner remains separate future work; raw Command Runner and removed features
are rejected, including disabled installations. DATA-FORMAT records the exact staged contracts.

`createRetainedExtensionsProjection` validates every installation, including inactive canvases and
disabled entries, and joins frozen effective props to the existing retained element views. Installation
activation and configured flag state remain distinct: disabled installations contribute no effective
props, while an active installation with `{ enabled: false }` retains an installed-but-off control.
All validated installations/configuration remain in the result. Unsupported ID/scope/target/configuration,
duplicates or declared conflicts yield sanitized issues and no partial canvas result. Generic envelope
validation already rejects duplicate installation identities per target; the adapter checks defensively.

Parsed configurations and per-target groups are cached by immutable identity. Extension-only edits
invalidate the affected element without touching unrelated views; geometry-only edits reuse extension
props, and camera samples do no parsing/serialization. Compatibility is rechecked on changed documents,
even for cached installations. `clear()` releases owned extension caches alongside other projections.
Actual session purge, admission and feature-command guards remain unmounted/unimplemented integration
work, not behavior supplied by this read-only adapter. Current generic commands still accept JSON.

202 focused tests pass; full frontend 1040 pass / same 15 baseline failures / 14 known jsdom errors.
No native app launch, data access or live visual parity claim. Step 3c1 below connects acceptance;
completed feature actions/callbacks remain. Visible storage stays legacy.

### Step 3c1 implementation boundary

`app/database/acceptRetainedDocument.ts` reuses the existing retained projection as the temporary
feature-data acceptance authority. Its local projection is cleared in `finally` and discarded, so
validation holds no long-lived plaintext cache. It does not publish renderer props. This deliberately
reuses one set of module schemas/relationship checks rather than adding a parallel validation registry.
Validation currently traverses the document at completed/lifecycle boundaries; completion-cost profiling
is still needed. Camera/pointer previews never call it.

The unmounted Tauri session composition supplies this policy to both the platform client and workspace.
The platform factory requires a policy, but imports only its neutral domain contract. Create preflight,
pending confirmation, resumed reads and save IPC are guarded. Pending rejection cancels/closes;
invalid resumed data relocks/closes. Workspace load and command/undo/redo candidate publication also
use the policy, preserving current state/history/scheduled saves on failure. Generic core/harness
workspaces remain feature-agnostic unless configured. Internal Redux reducer actions are still an
implementation detail, not a permitted component mutation API.

235 focused tests pass; 28 new regressions include cleanup, fresh creation, invalid relational payloads,
history corruption, policy exceptions and 100-pan/100-zoom isolation. Full frontend 1068 pass / unchanged
15 baseline failures and 14 jsdom errors. This is data admissibility, not action authorization: lock
rules, parent deletion/reparenting semantics, named feature edits and stale completed callback guards
remain the next 3c work. No visible app/storage switch, native launch, user data or live parity claim.
