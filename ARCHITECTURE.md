# TaskMap Architecture for Renderer v2

## Purpose

TaskMap is a local-first Windows desktop application for arranging modular content on large visual
canvases. Users work with containers, text cards, text blocks, media, mind-map connections, and
optional element extensions. The application must remain responsive with large documents, preserve
retained behavior, and implement intentional visual changes through the normative visual contract.

This document defines the retained application architecture and the renderer-v2 target. Renderer v2
rebuilds the presentation layer rather than incrementally refactoring the architecture-v1 or legacy
frontend. New code must fit this structure unless an architecture decision record explicitly changes
it.

## Core principles

1. Preserve the product; replace the internals.
2. Keep domain logic independent from React and Tauri.
3. Separate persistent document state from transient interaction state.
4. Record domain transactions, not UI events.
5. Keep storage and encryption behind a narrow platform boundary.
6. Make element and extension modules self-contained and explicitly registered.
7. Prefer simple, inspectable control flow over clever abstraction.
8. Design for 10,000 elements and 2 GB of media without blocking interaction.

## Runtime overview

```text
React UI
  -> Mantine controls and shared Liquid DOM material boundary
  -> application commands and selectors
  -> normalized document store
  -> history middleware
  -> persistence coordinator
  -> typed platform client
  -> Tauri commands
  -> Rust database, crypto, file lock, backup, and session services
```

A separate interaction controller handles pointer movement, drag previews, snapping, selection
rectangles, and resize previews. It emits one semantic operation through
`CanvasInteractionCommitPort` when an interaction completes; the persistent document owner decides
how that operation is committed.

## Target repository structure

```text
src/
├── app/
│   ├── AppShell.tsx
│   ├── providers/
│   ├── store/
│   ├── commands/
│   ├── selectors/
│   └── lifecycle/
├── domain/
│   ├── document/
│   ├── canvas/
│   ├── elements/
│   ├── extensions/
│   ├── history/
│   └── workflow/
├── canvas/
│   ├── CanvasViewport.tsx
│   ├── CanvasScene.tsx
│   ├── layers/
│   ├── interaction/
│   ├── geometry/
│   └── virtualization/
├── elements/
│   ├── registry.ts
│   ├── container/
│   ├── text-card/
│   ├── text-block/
│   ├── image/
│   └── mindmap/
├── extensions/
│   ├── registry.ts
│   ├── checkbox/
│   ├── search/
│   ├── lock/
│   ├── privacy/
│   ├── color-picker/
│   └── copy-paste-json/
├── features/
│   ├── canvases/
│   ├── minimap/
│   ├── workflow-runner/
│   ├── settings/
│   ├── database-picker/
│   └── updates/
├── platform/
│   ├── databaseClient.ts
│   ├── mediaClient.ts
│   ├── workflowClient.ts
│   ├── sessionClient.ts
│   ├── settingsClient.ts
│   └── updaterClient.ts
├── ui/
│   ├── theme/
│   ├── materials/
│   │   ├── MaterialSurface.tsx
│   │   ├── materialRoles.ts
│   │   └── liquid-dom/
│   ├── menus/
│   ├── dialogs/
│   ├── controls/ (Mantine composition)
│   └── feedback/
└── test/

src-tauri/src/
├── commands/
├── database/
│   ├── connection.rs
│   ├── schema.rs
│   ├── document_repository.rs
│   ├── media_repository.rs
│   └── backup.rs
├── crypto/
│   ├── derivation.rs
│   ├── envelope.rs
│   └── memory.rs
├── session/
│   ├── manager.rs
│   └── windows_lock.rs
├── workflow/
│   ├── model.rs
│   ├── launcher.rs
│   └── process_registry.rs
├── files/
│   ├── lock.rs
│   └── atomic.rs
├── settings/
└── error.rs

tools/
└── taskmap-migrator/
```

The structure may evolve through ADRs, but dependency direction must remain intact.

## Document model

The decrypted TaskMap document is owned by TypeScript and validated at the application boundary. It uses normalized entity collections.

```ts
type TaskMapDocument = {
  schemaVersion: 1;
  id: DocumentId;
  databaseId: DatabaseId;
  databasePurpose: "production" | "development";
  activeCanvasId: CanvasId | null;
  canvasOrder: CanvasId[];
  canvases: Record<CanvasId, CanvasRecord>;
  elements: Record<ElementId, DocumentElement>;
  connections: Record<ConnectionId, DocumentConnection>;
  mediaReferences: Record<MediaId, MediaReference>;
  extensionInstallations: Record<ExtensionInstanceId, ExtensionInstallation>;
  documentSettings: DocumentSettings;
};
```

Canvas and element entity order is represented separately from entity records: `canvasOrder` is the
stable canvas order and each canvas owns a complete back-to-front `elementOrder`. Element and
connection module data and extension configuration are bounded JSON objects; concrete modules own
their later schema fragments, and the generic document model does not import their registries.

Media references contain opaque media IDs and presentation metadata. They do not contain raw bytes,
original filenames, or local paths. The media table is outside the encrypted payload. Viewport,
selection, pointer, window, device, and session state is not part of this model. See
`docs/DATA-FORMAT.md` for the exact current-version structure, limits, and validation stages.

Application preferences such as window state, recent database paths, UI theme, update preferences, and inactivity-lock preference are stored separately in the edition-specific configuration directory and can be exported or imported.

## State ownership

### Persistent Redux state

Redux Toolkit owns:

- Decrypted document state
- Active database identity and status
- Document-level settings
- Session-only transaction history and undo/redo availability
- Backend revision, workspace epoch, local-change sequence, acknowledged-persisted sequence, and
  serializable save status
- Trusted workflow definitions and execution summaries
- Stable UI state that must survive view changes

Renderer v2 uses the established `documentWorkspace` as its persistent document owner. Loading a
workspace validates the complete current-version document before Redux receives it, records its
backend revision, clears history, and starts with matching local and persisted sequences. Replacing
or clearing a workspace advances its epoch so obsolete asynchronous results cannot affect the new
session. Serialized documents, clients, timers, promises, credentials, and key material are never
Redux state.

### Transient interaction state

The Phase 4 interaction subsystem owns:

- Active pointer and gesture
- Drag and resize preview
- Selection rectangle
- Snap guides
- Drop targets
- High-frequency pointer samples
- Temporary animation state directly tied to the gesture

It does not write Redux or legacy document collections on pointer frames. It publishes bounded
geometry and viewport previews through a narrow subscription API. Pan, zoom, selection, hover, and
snap guides never call the persistent commit port. Changed move and resize gestures call the port
once at completion; cancellation and canonical no-ops do not call it.

The application-facing transient interaction service remains read-only: consumers call
`getSnapshot` and `subscribe`. `canvasInteractionController.ts` is its mutable implementation and
uses a discriminated primary-gesture state so pan, selection box, move, and resize cannot overlap.
The snapshot contains only the current canvas key, viewport, selected IDs, active pointer/targets,
selection rectangle, bounded geometry overrides, and snap guides. It never contains a document,
history, backend client, promise, timer, or persistence metadata.

Pure viewport math under `src/canvas/geometry/` is the source of truth for screen/world conversion,
anchored zoom, translation, viewport rectangles, and finite-number protection. Selection hit
testing, move/resize calculations, and snapping are framework-independent interaction modules.
`src/canvas/virtualization/` owns the 480-screen-pixel overscan conversion and pinned-element
culling. `src/features/minimap/minimapProjection.ts` projects canvas, element, and world-viewport
bounds; the minimap has no independent camera or navigation state.

### Renderer-v2 interaction commits

The framework-independent controllers, geometry, snapping, culling, and minimap projection from
architecture-v1 are eligible for reuse after their contracts are verified. The
`CanvasInteractionCommitPort` exposes only named move, resize, and layer-order operations; it is not
an arbitrary patch API. Renderer v2 connects completed operations to named commands backed by the
normalized workspace. It does not route new work through `LegacyApplication`, `TaskCanvas`, or the
legacy commit adapter.

Legacy camera correlation, selection compatibility, and text-card placement code may be studied to
characterize retained behavior, but is not a renderer-v2 dependency. Equivalent transient behavior
belongs in the new interaction/presentation boundary, and only its settled semantic result reaches a
named command. Camera state remains session/UI state and is not added to `TaskMapDocument`.

### Local component state

Components may own ephemeral presentation details such as an open local submenu or an input draft when no other subsystem needs it. Component state must not become the source of truth for document content.

## Application failure boundary

Renderer-v2 providers and features render inside an application error boundary with a typed
reporting contract and a deterministic, non-sensitive fallback. The default reporter logs only a
failure classification, never the error message, stack, component stack, or document content. The
legacy application's former sibling-boundary arrangement is reference history, not the renderer-v2
composition target.

## Application commands

All persistent mutations use named commands. Examples:

```text
CreateElement
DeleteElements
MoveElements
ResizeElement
UpdateTextCard
AttachCardsToContainer
ReorderContainerCards
InstallExtension
RemoveExtension
UpdateExtensionState
CreateConnection
DeleteConnection
CreateCanvas
DeleteCanvas
UpdateCanvas
```

A command handler declares a runtime payload schema, a static non-sensitive label, and an explicit
history policy, then describes one mutation against an Immer draft. An explicitly composed handler
registry rejects duplicate stable command identifiers and remains extensible without a central
feature-command union or global registration side effects.

The central domain executor validates the plain-data command, captures forward and inverse Immer
patches, validates the complete candidate document, and constructs at most one transaction using an
injected transaction-ID source and clock. Expected failures return typed issues and the original
document; zero-patch commands return no transaction. Dirty tracking belongs to Phase 3C application
orchestration, not handlers or the Phase 3B domain executor.

React components dispatch commands; they do not directly update arrays or entity maps.
Command execution is only for committed persistent operations. Pointer-frame pan, zoom, drag,
resize, hover, and selection previews stay in the transient interaction subsystem; a future
completed drag or resize dispatches one final geometry command and therefore creates one history
entry.

Phase 3C application orchestration composes the core handler registry through
`createCommandDispatcher`. A successful changed command commits its document and optional history
transaction in one Redux action; ignored-history commands still count as persistent changes. Undo
and redo likewise commit document and history together. Each successful document change increments
one monotonic local sequence for the current workspace. Failed and no-op operations dispatch
nothing.

## History

History stores completed document transactions as Immer patches and inverse patches.

```ts
type HistoryEntry = {
  id: string;
  label: string;
  timestamp: number;
  patches: Patch[];
  inversePatches: Patch[];
};
```

Rules:

- One drag or resize equals one history entry.
- Text editing commits according to an explicit edit transaction, not each keystroke.
- Pan, zoom, selection, hover, menus, and visibility changes are excluded.
- History is in memory for the active session unless a later ADR explicitly adds durable history.
- Undo applies inverse patches and moves one entry from past to future; redo applies forward patches
  and moves it back. Both fail closed if patches cannot produce a valid current-version document.
- A recorded branch clears redo history. Zero-patch and explicitly ignored commands do not alter
  history.
- Autosave follows undo and redo like any other document transaction.

## Persistence and database

TaskMap uses one SQLite-based `.tmapdb` file.

The database contains:

- Plaintext format and encryption parameters
- One authenticated encrypted document payload
- Unencrypted media BLOBs addressed by random opaque IDs
- Minimal non-sensitive media transport fields

The encrypted document includes all media relationships, card text, links, canvas names, positions,
alt text, extension states, and document settings. Original media filenames and local paths are not
persisted.

Normal document saves update only the encrypted document row. Existing media BLOBs remain untouched. Large GIFs and images are loaded lazily when visible.

Rust owns SQLite access, file locking, backups, encryption, password derivation, and key lifetime. TypeScript owns the decrypted schema and domain validation.

Phase 3C persistence is owned by one dependency-injected application coordinator outside Redux
reducers and domain code. It schedules the existing 350 ms parity delay through an injected timer
abstraction, maintains at most one timer and one save request in flight for the current workspace,
and calls `encodeDatabaseDocument` only when a save begins. A save captures the workspace epoch,
document reference, local sequence, and current acknowledged backend revision. The database request
uses that revision as `expectedRevision`.

Success acknowledges only the captured local sequence. If a newer command committed while the save
was running, the returned backend revision is accepted, the newer document remains dirty, and a
follow-up save uses the new revision. Epoch checks discard success or failure completions from a
replaced, cleared, or disposed workspace. Revision conflicts preserve document and history, block
automatic and ordinary retry saves, and wait for a later explicit conflict-resolution workflow;
Phase 3C does not guess a revision, reload, or add resolution UI. Other failures remain dirty and
may be retried explicitly against the latest document and last acknowledged revision.

## Encryption and session lifecycle

- The raw password is never stored.
- Argon2id derives the document key using per-database parameters and salt.
- The document payload uses authenticated encryption.
- Only the derived key remains in the session process.
- Closing the visible window leaves the background session unlocked.
- Explicit Lock, Windows session lock, configured inactivity timeout, or Quit erases key material and decrypted document state.
- Reopening the window during the same unlocked session does not request the password again.
- Application restart or Windows restart requires the password.

See `docs/SECURITY.md` and `docs/DATA-FORMAT.md`.

## Media

Media bytes are intentionally unencrypted for performance and direct playback. Security-sensitive associations remain encrypted.

Rules:

- Media uses random IDs unrelated to filenames or content descriptions.
- Media bytes never enter Redux.
- The application loads media only when visible or imminently visible.
- Large GIF decoding must not block pointer interaction.
- Unreferenced media cleanup is an explicit repository operation.
- Database compaction is maintenance, not part of normal autosave.

## Elements

Each element type provides an explicit module definition:

```ts
type ElementDefinition = {
  type: ElementType;
  schema: ZodType;
  createDefault(context: CreateContext): CanvasElement;
  Renderer: ComponentType<ElementRendererProps>;
  ContextMenu?: ComponentType<ElementMenuProps>;
  getBounds(element: CanvasElement): Rect;
  validate(document: TaskMapDocument, element: CanvasElement): Issue[];
};
```

Business commands remain testable without rendering components. Shared behavior such as movement, selection, layers, lock checks, deletion, and history integration is implemented once against common element contracts.

## Extensions

Extensions are static built-in modules. TaskMap does not execute third-party extension code.

Each extension definition declares:

- ID and label
- Compatible element types
- Conflicts
- State schema and default state
- Commands and selectors
- Optional renderer controls
- Optional menu contributions
- Tests

Installation and removal are generic commands. Unrelated UI files must not contain one callback per extension.

## Workflow Runner

The Workflow Runner replaces the raw Command Runner while preserving its purpose.

A workflow contains structured steps such as:

- Run executable with an argument array
- Open application
- Open folder
- Open URL
- Run sequentially or in parallel
- Wait for a process

First-version restrictions:

- No arbitrary shell string
- No hidden administrator execution
- No UAC elevation
- Program and arguments are distinct fields
- Imported workflows are disabled until trusted
- TaskMap stops only processes it launched and tracks

## UI component and material boundary

`docs/VISUAL-SYSTEM.md` is the normative source for theme tokens, Liquid DOM roles, material usage,
and visual acceptance. Mantine is the standard React component library for controls, menus,
dialogs, inputs, and related accessible interaction. Liquid DOM is responsible only for application
glass/material rendering.

```text
feature UI
  -> Mantine component or semantic React content
  -> shared MaterialSurface role (Large Panel or Small Panel)
  -> @liquid-dom/core
  -> live canvas DOM backdrop
```

The shared material adapter is the only feature-facing Liquid DOM boundary. Material role does not
own dimensions, layout, padding, radius, position, or feature behavior. Canvas elements remain
ordinary React/DOM content and never become Liquid DOM surfaces. Because Liquid DOM operates over
the live DOM backdrop, acceptance must prove that UI glass blurs/refracts canvas text, images, and
static GIF posters/frames in packaged Tauri/WebView2 builds. Animated GIF/video playback is hosted
in a separate preview or UI surface outside the coarse canvas.

The custom cached Canvas2D acrylic compositor, `BackdropScene` projection for glass, worker/cache
runtime, mask planes, and compositor invalidation protocol from ADR 003 are superseded. They are
reference implementation history and are not dependencies of renderer v2. The Privacy extension is
the narrow exception: it retains ordinary CSS backdrop blur for cheap content obscuring and is not
an application-glass material.

Persistent and transient ownership rules remain unchanged. Liquid DOM integration must not move
document state into presentation code or add Redux dispatch, serialization, history, persistence,
database work, or document-wide React reconciliation per pointer sample.

## Stable and development editions

Stable and development builds are separate applications.

```text
Stable:      com.merkdesigns.taskmap
Development: com.merkdesigns.taskmap.dev
```

They have separate configuration, default database, recent files, session process, tray icon, update channel, window identity, and file-association behavior. Both may run simultaneously.

A database file is locked against simultaneous writing. A development build opening a production-marked database requires an explicit read-only or override decision.

## Performance targets

- 60 FPS for pan, zoom, drag, and resize
- No save, serialization, encryption, or history write during pointer frames
- Normal target: 10,000 elements and 2 GB of media
- Media is lazy-loaded and viewport-cullable
- Autosave is non-blocking from the UI's perspective
- Selectors minimize rerenders to affected entities
- Context-menu changes do not rerender the complete canvas

See `docs/TESTING.md` for measurable scenarios.

## Renderer-v2 strategy

The current application on `main`, old `App.tsx`, and architecture-v1/legacy frontend remain
reference sources for behavior and visual evidence. Renderer v2 is developed on `renderer-v2` as a
new presentation implementation over the retained normalized domain, commands, history, Redux
workspace/persistence, platform boundaries, and Tauri/Rust backend. It is not an incremental port of
the old component tree.

The main application does not read legacy data. A separate graphical migrator converts old data into the new format and emits a detailed conversion report.

Implementation proceeds through parity-tested vertical slices defined in
`docs/RENDERER-V2-ROADMAP.md`. The first executable slice proves the retained workspace/backend path
through the new shell before broader feature presentation is rebuilt.
