# TaskMap Architecture v1

## Purpose

TaskMap is a local-first Windows desktop application for arranging modular content on large visual canvases. Users work with containers, text cards, text blocks, media, mind-map connections, and optional element extensions. The application must remain responsive with large documents and must preserve the visual identity and behavior of all retained features from the legacy application.

This document defines the target architecture for the complete refactor. It is normative: new code must fit this structure unless an architecture decision record explicitly changes it.

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
  -> application commands and selectors
  -> normalized document store
  -> history middleware
  -> persistence coordinator
  -> typed platform client
  -> Tauri commands
  -> Rust database, crypto, file lock, backup, and session services
```

A separate interaction controller handles pointer movement, drag previews, snapping, selection rectangles, and resize previews. It commits one application command when the interaction completes.

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
│   ├── materials/FrostedSurface.tsx
│   ├── menus/
│   ├── dialogs/
│   ├── controls/
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
- Undo/redo availability
- Trusted workflow definitions and execution summaries
- Stable UI state that must survive view changes

### Transient interaction state

The interaction subsystem owns:

- Active pointer and gesture
- Drag and resize preview
- Selection rectangle
- Snap guides
- Drop targets
- High-frequency pointer samples
- Temporary animation state directly tied to the gesture

It does not write Redux on every pointer frame. It publishes an interaction preview through a narrow subscription API and dispatches one domain command at completion.

The application-facing transient interaction service is read-only: consumers call `getSnapshot` and `subscribe`. The interaction controller introduced in Phase 4 will own writes. The Phase 1 default always returns an idle snapshot and exists only to establish provider and dependency boundaries; it contains no document state and does not replace legacy interaction behavior.

### Local component state

Components may own ephemeral presentation details such as an open local submenu or an input draft when no other subsystem needs it. Component state must not become the source of truth for document content.

## Application failure boundary

New providers and feature architecture render inside an application error boundary with a typed reporting contract and a deterministic, non-sensitive fallback. The default reporter logs only a failure classification, never the error message, stack, component stack, or document content.

While the legacy application remains active, `LegacyApplication` is a sibling outside this boundary. Errors thrown inside its component tree therefore continue to propagate according to the existing legacy behavior. The boundary moves outward only as a feature is deliberately ported into the new architecture.

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

A command handler validates invariants, produces the next document state, emits Immer patches and inverse patches, marks the document dirty, and exposes a user-facing history label.

React components dispatch commands; they do not directly update arrays or entity maps.

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

## Frosted glass

The current blur appearance is retained through one shared `FrostedSurface` component. The refactor does not introduce WebGL blur or change the product's visual material.

Rules:

- No nested backdrop filters
- No separate blur implementations in feature modules
- Fixed production tokens replace the removed development tuner
- Compositor fixes may improve artifacts but must preserve the existing appearance

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

## Migration strategy

The current application remains usable on `main`. The new architecture is developed on `architecture-v1` with critical legacy fixes only.

The main application does not read legacy data. A separate graphical migrator converts old data into the new format and emits a detailed conversion report.

Implementation proceeds through vertical slices. The first slice proves database creation/opening, unlocking, one canvas, one element, editing, history, autosave, close, and reopen before broader feature porting begins.
