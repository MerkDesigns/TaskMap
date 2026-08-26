# TaskMap Code Map

This file is the high-level navigation entrypoint for Codex and human contributors. Read it before opening broad parts of the repository. Update it whenever files or subsystem ownership change.

## Governing documents

`docs/VISUAL-SYSTEM.md` is the normative target theme, material-definition, compositor-constant,
invalidation, fallback, and performance contract. Read it before changing application chrome or
materials.

- `AGENTS.md` — Mandatory implementation, dependency, security, performance, and file-size rules.
- `ARCHITECTURE.md` — Normative target architecture and runtime boundaries.
- `docs/REFACTOR-ROADMAP.md` — Ordered implementation phases and exit criteria.
- `docs/FEATURE-PARITY.md` — Retained, redesigned, and removed user-facing behavior.
- `docs/FEATURE-WIRING.md` — Exact process for adding elements, extensions, features, and platform operations.
- `docs/DATA-FORMAT.md` — New `.tmapdb` SQLite envelope and encrypted document model.
- `docs/SECURITY.md` — Password, key, lock, media privacy, logging, and workflow security.
- `docs/TESTING.md` — Test layers, fixtures, performance budgets, and phase gates.
- `docs/UI-SYSTEM.md` — Reusable UI capability catalog, status, ownership, motion, and UI Lab guide.
- `docs/BASELINE-CAPTURE.md` — Required screenshots, recordings, behavior descriptions, and performance evidence for retained legacy behavior.

## Current legacy implementation

These paths describe the existing app on the starting branch. They are reference material for parity, not the target architecture.

- `src/App.tsx` — Legacy god component containing application state, interactions, history coordination, persistence, feature orchestration, and rendering. Do not extend it on `architecture-v1`.
- `src/types.ts` — Legacy shared domain and interaction types.
- `src/hooks/useCanvasDocument.ts` — Legacy canonical active-canvas reducer; useful behavior reference.
- `src/app/history.ts` — Legacy snapshot history algorithms; behavior reference only.
- `src/app/appData.ts` — Legacy frontend migration and normalization.
- `src/app/appDataSchema.ts` — Legacy Zod document validation.
- `src/extensions/registry.ts` — Legacy extension metadata registry; concept reference.
- `src/components/ContainerNode.tsx` — Legacy container rendering and extension controls.
- `src/components/TextCardNode.tsx` — Legacy text-card rendering, links, checkbox, and Command Runner controls.
- `src/components/ContextMenus.tsx` — Legacy centralized menus and extension-specific removal branches.
- `src-tauri/src/storage.rs` — Legacy SQLite, encryption, keyring, migration, and split-persistence implementation.
- `src-tauri/src/model.rs` — Legacy duplicated Rust document validation and migrations.
- `src-tauri/src/commands.rs` — Legacy raw Command Runner implementation.

## Target frontend ownership

These paths are created during the roadmap and become the only approved ownership locations.

### `src/app/`

Application composition, Redux store setup, transient interaction access, command dispatch, selectors, error reporting, and lifecycle coordination. `AppShell.tsx` remains thin. Phase 1 keeps the temporary `src/legacy/LegacyApplication.tsx` adapter outside the new-architecture error boundary, while `AppProviders.tsx` composes Redux and transient interaction providers for new features; the older files already under `src/app/` remain legacy behavior references.

### `src/domain/`

Pure TypeScript document model, schemas, invariants, commands, history types, and workflow model. No React, Tauri, or DOM imports.

### `src/canvas/`

Pure canvas geometry and viewport-culling calculations. Phase 4 interaction controllers live at the
application boundary under `src/app/interactions/`.

### `src/elements/`

One self-contained module per element type. Phase 1 defines the module contract in `elementDefinition.ts` and an explicit, initially empty registry in `registry.ts`; no element types are ported yet.

### `src/extensions/`

One self-contained module per retained extension. The target contract is in `extensionDefinition.ts`, and the initially empty target registry is `architectureRegistry.ts`. The existing `registry.ts` remains the legacy registry until extension porting.

### `src/features/`

Product features not represented as element or extension modules: canvas manager, minimap, database picker, Workflow Runner, settings, and updates.

Phase 2 adds `src/features/phase2-database/`, a development-only persistence harness. It owns only ephemeral manual-test state and a minimal test document editor; it is not a production database picker and does not connect the legacy application to the new database.

### `src/platform/`

Typed frontend boundary for database, media, settings, and structured workflow operations. Phase 2 implements development-only database and recent-database adapters here. TypeScript validates the decrypted document before save, before pending-unlock confirmation, and after read. The Rust media repository is tested directly; streaming frontend media transport is deferred to Phase 5. This remains the only frontend area where new Tauri imports are allowed.

### `src/ui/`

Shared presentation primitives. `src/ui/theme/` owns scoped target theme tokens;
`src/ui/materials/` owns `MaterialSurface`, the static typed material registry, exact native-glass
definitions, logical sampling boundaries, and the parked compositor boundary; `src/ui/motion/` owns deterministic math, the one shared UI animation
frame, reduced-motion state, and local FLIP utilities; `src/ui/primitives/` owns generic semantic
controls; and `src/ui/dev/` owns the doubly gated UI Lab. The old `FrostedSurface` remains frozen
migration debt until Phase 4.5C/4.5D.

### `src/ui-lab/`

Permanent isolated development entry for material and UI-system baselines. It composes only shared
UI presentation boundaries and never mounts product application, state, persistence, or platform
modules. `ui-lab.html` and `src-tauri/tauri.ui-lab.conf.json` are its dedicated web and Tauri
entrypoints; `src/ui-lab/system/` owns the experimental Surface primitive and typed target-to-current
material aliases. The older `src/ui/dev/DevelopmentUiLab.tsx` remains unchanged.

## Phase 1 architecture foundation

- `src/app/interactions/` - read-only transient interaction consumer contract, idle default, provider,
  typed hooks, and the document-model-agnostic Phase 4 controller/selection/snapping implementation.
- `src/app/errors/` - typed new-architecture render-failure reporting and deterministic error boundary; legacy errors remain outside it.

- `src/app/AppShell.tsx`, `AppProviders.tsx`, `store.ts`, and `hooks.ts` — composition-only shell and typed Redux access.
- `src/app/commands/` and `src/app/selectors/` — named command dispatch and selector boundaries.
- `src/domain/document/`, `commands/`, `history/`, and `ids/` — pure current-version contracts, schema entrypoint, invariants, and transaction types.
- `src/platform/database/`, `media/`, `settings/`, and `workflow/` — dependency-injected frontend client contracts without implementations.
- `src/elements/registry.ts` and `src/extensions/architectureRegistry.ts` — explicit target registries, initially empty.
- `src/legacy/LegacyApplication.tsx` — temporary behavior-preserving adapter to the existing `App.tsx`.
- `src/ui/materials/FrostedSurface.tsx` — historical Phase 1 primitive, superseded by ADR 003 and
  retained temporarily for its existing development-harness consumer.
- `docs/decisions/001-application-state-and-boundaries.md` — application-state and boundary rationale.

## Phase 4 canvas and interaction engine

- `src/canvas/geometry/` — canonical typed screen/world transforms, anchored zoom, translation, and
  rectangle geometry.
- `src/app/interactions/canvasInteractionController.ts` — single-primary-gesture arbitration and
  transient pan/selection/move/resize ownership behind `CanvasInteractionCommitPort`.
- `src/app/interactions/panGestureFrameQueue.ts` — injected requestAnimationFrame-compatible
  latest-pan coalescing and exact viewport projection; raw samples never schedule more than one
  pending frame.
- `src/app/interactions/selectionEngine.ts` and `snappingEngine.ts` — pure box-selection and retained
  eight-world-unit alignment behavior.
- `src/canvas/virtualization/viewportCulling.ts` — pure 480-screen-pixel overscan and pinned-element
  candidate selection plus the half-overscan active-pan refresh guard.
- `src/features/minimap/minimapProjection.ts` — pure canvas/element/world-viewport minimap data.
- `src/legacy/interactions/` — temporary production-only TaskCanvas geometry mapping, render preview,
  and semantic commit adapter. New feature/domain modules must not import it; Phase 5 deletes it as
  normalized element ownership migrates.
- `src/components/Minimap.tsx` — retained reset-only minimap feature presentation consuming the
  unchanged projection and the C2F workspace pattern.
- `src/App.tsx` — still the legacy feature/render composition boundary, but no longer owns generic
  pan, zoom, box selection, movement, resize, snapping, layer, culling, or minimap projection
  algorithms.

## Phase 4.5 visual-system foundation and compositor runtime proof

- `src/ui/theme/theme.css` — exact target foundation, application-chrome, semantic, and spatial
  tokens, scoped and intentionally inactive until Phase 4.5C.
- `src/ui/motion/` — C1 semantic motion tokens, analytical springs/interpolation, shared frame
  scheduler, reduced-motion preference, liquid-edge model, and local FLIP utilities.
- `src/ui/primitives/` — C1 semantic button, selection, form, navigation, layout, status, and liquid
  indicator/tab primitives with scoped shared styling.
- `src/ui/patterns/workspace/MinimapSurface.tsx` and `useMinimapVisibilityMotion.ts` — C2F native
  Acrylic Large/Cutout presentation plus shared-scheduler DOM-opacity fidelity; no
  projection, persistence, or navigation ownership.
- `src/ui/patterns/workspace/CanvasBrowserRuntime.ts` and adjacent `canvasBrowser*` modules —
  generic `Id extends string` Renderer V2-derived layout, wheel/scroll, actual-card portal drag,
  reorder, slot/snap, and auto-scroll runtime. It owns transient DOM motion only; Canvas Manager
  retains production callbacks and commits final order once. `canvasBrowserSharedGlass.ts` maps its
  visible/clipped card geometry to the bounded Small material plane without React frame updates.
- `src/ui/patterns/overlays/ModalLayer.tsx`, `ModalPresence.tsx`, and `ModalDialog.tsx` — C3A/C3B
  semantic root/nested modal stacking, shared-scheduler retained presence, DOM-group opacity,
  and Acrylic Large dialog presentation over the existing modal plane; feature state remains in its
  production owner.
- `src/components/ProductionDialogs.tsx` — C3B presentation/behavior adapters for standalone or
  nested Update Available, Clear Canvas, and the Settings password dialog.
- `src/ui/patterns/settings/` — C3A presentation-only primary Settings shell, island, row, and
  single-action toggle-row patterns. Settings behavior remains in `src/components/Modals.tsx`.
- `src/ui/dev/DevelopmentUiLab.tsx` — opt-in development catalog using real materials and motion;
  dynamically excluded unless both the development build and explicit environment flag are active.
- `src/ui/materials/materialTypes.ts` and `materialDefinitions.ts` — minimal discriminated material
  contract and exact native Large/Small plus Opaque/Cutout surfaces.
- `src/ui/materials/materialRegistry.ts` — explicit internal registry with duplicate rejection and
  safe unknown lookup/require behavior.
- `src/ui/materials/MaterialSurface.tsx`, `MaterialSurface.css`, and `MaterialPlane.tsx` —
  feature-facing material, live native backdrop layers, geometry/elevation, semantic element, ref,
  and base/modal inheritance boundary.
- `src/ui/materials/SharedSmallGlassPlane.tsx` — bounded shared settled-card backdrop, rounded SVG
  clip writer, and DEV depth/filter/drag diagnostics.
- `src/ui/materials/materialGeometryInvalidation.ts` — local element-scoped geometry refresh seam
  used by the one moving Small surface without global material fan-out.
- `src/ui/patterns/workspace/useSharedSmallGlassList.ts` and `useSettledPanelWork.ts` — local
  Extensions mask synchronization and post-transition inactive-view workload suspension.
- `src/ui/materials/materialSamplingBoundary.tsx`, `materialSurfaceStyle.ts`, and
  `nativeGlassRim.ts` — logical Large-to-Small backdrop ownership, centralized accepted optics, and
  geometry/DPR-driven rounded-perimeter rim drawing without a permanent animation loop.
- `src/ui/materials/legacyCachedAcrylicDefinitions.ts` and `src/ui/materials/compositor/` — the
  superseded cached Canvas2D candidate retained temporarily for rollback/reference; production does
  not instantiate its runtime, output canvases, or surface registration.
- `scripts/material-architecture-rules.mjs` — narrow count-sensitive frozen allowlist for exact
  legacy blur/frosted occurrences and ownership check for future acrylic Canvas2D code.
- `src/ui/materials/compositor/adaptiveQuality.ts` and `cacheCoverage.ts` — pure normative quality
  sizing and canonical Phase 4 viewport-to-accepted-cache coverage math.
- `src/ui/materials/compositor/compositorTypes.ts`, `cacheScheduler.ts`, and
  `cacheResourceOwner.ts` — immutable build identity, one-active/one-newest scheduling, stale-result
  acceptance, and generic disposable-resource ownership without browser resource types.
- `src/ui/materials/compositor/compositorInvalidation.ts` and `frameCoalescing.ts` — pure semantic
  work classification and one-pending-frame/latest-state coalescing for the later runtime.
- `src/ui/materials/compositor/backdropScene.ts`, `backdropSceneValidation.ts`, and
  `sceneRasterizer.ts` — bounded structured-clone-safe generic presentation snapshots, deliberate
  worker-boundary validation, cache-rectangle culling, and the shared world-space Canvas2D
  rasterizer.
- `src/ui/materials/compositor/sharedAcrylicProfile.ts`, `sharedAcrylicCacheBuilder.ts`, and the
  Canvas backends — retained legacy 45 CSS-pixel blur/saturation-1/brightness-1 cache pass, with
  scale conversion shared by OffscreenCanvas and deferred main-thread execution.
- `src/ui/materials/compositor/acrylicCache.worker.ts`, `acrylicWorkerProtocol.ts`,
  `acrylicWorkerRuntime.ts`, and `acrylicWorkerExecutor.ts` — Vite module worker, plain bounded
  protocol, transferable bitmap handoff, fail-closed message execution, and one-active B1 scheduler
  bridge.
- `src/ui/materials/compositor/compositorCapabilities.ts`, `browserAcrylicRuntime.ts`, and
  `acrylicCacheRuntime.ts` — injected capability probes, lazy browser construction, Worker failure
  downgrade, interaction-aware fallback deferral, overlay-only availability, and deterministic
  bitmap ownership. Phase 4.5B2 does not register surfaces or activate a production compositor.
- `docs/VISUAL-SYSTEM.md` and `docs/decisions/003-adaptive-acrylic-compositor.md` — normative values
  and decision rationale.

## Phase 2 encrypted database vertical slice

- `src/features/phase2-database/` - development-only create/open/unlock/read/edit/save/lock/close/quit harness and local session-state reducer.
- `src/platform/tauriInvoke.ts` and database/settings adapters - the only Phase 2 frontend Tauri transport implementation; raw request limits and structured Rust failures become discriminated platform errors.
- `src-tauri/src/commands/` - development-feature-only Phase 2 transport, backend-authorized database picker, and window/session-keeper commands.
- `src-tauri/src/crypto/` - Argon2id derivation, XChaCha20-Poly1305 document encryption, and zeroizing key ownership.
- `src-tauri/src/database/` - strict format preflight, SQLite connections, encrypted active/recovery document repositories, explicit online backup, and plaintext media repository.
- `src-tauri/src/session/` - process-local pending/unlocked/locked/closed lifecycle. It retains candidate and active keys but no document plaintext after response serialization.
- `src-tauri/src/files/database_lock.rs` - Windows file-identity writer ownership plus an authoritative OS lock and non-authoritative diagnostic metadata.
- `src-tauri/src/files/database_path_authorization.rs` - process-, edition-, operation-, and time-scoped one-use `.tmapdb` path authorization.
- `src-tauri/src/settings/recent_databases.rs` - edition-specific recent/default database settings.
- `src-tauri/build.rs`, `src-tauri/capabilities/phase2-development.json`, and generated command permissions - Phase 2 commands exist only for development-feature builds; the stable default capability excludes them.
- `public/phase2-keeper.html` - empty hidden webview that keeps an unlocked development session alive after the legacy main window is destroyed.
- `docs/decisions/002-encrypted-database-and-session.md` - exact format, cryptography, session, writer-lock, backup, dependency, and deferral decisions.

## Opt-in development tooling

- `ui-lab.html`, `src/ui-lab/`, and `src-tauri/tauri.ui-lab.conf.json` — isolated baseline Lab on
  Vite port 6970 with its own application identifier, the development MCP capability, and no
  product storage/session startup or updater behavior. Only `npm run app:ui-lab` enables the
  `ui-lab-development` Cargo feature.
- `src-tauri/capabilities/mcp-development/mcp-development.json` and
  `src-tauri/tauri.mcp.dev.conf.json` — isolated localhost-only Tauri MCP Bridge capability and
  global-Tauri configuration. `src-tauri/build.rs` excludes the nested capability unless the MCP
  feature is active. Only `npm run app:dev:mcp` enables the optional `mcp-development` Cargo
  feature; stable, ordinary development, and packaged commands exclude the bridge.
- `scripts/check-mcp-development-exclusion.mjs` — static contract that keeps the optional bridge,
  its capability, and `withGlobalTauri` out of ordinary stable/development configurations and
  commands.

## Phase 3A normalized document foundation

- `src/domain/document/documentTypes.ts`, `documentVersion.ts`, and `documentLimits.ts` - the single
  current-version normalized JSON document contract, exact version, and conservative bounds.
- `src/domain/document/documentSchema.ts` and `jsonSafety.ts` - strict structural parsing, branded ID
  boundary validation, and rejection of non-JSON values.
- `src/domain/document/documentInvariants.ts` and `invariants/` - composed semantic checks for entity
  keys, canvas and layer order, ownership, connection locality, and extension targets.
- `src/domain/document/validateDocument.ts` - combined current-version boundary with distinct
  structural and semantic failure stages.
- `src/domain/document/createDocument.ts` - minimal valid document creation with an injected UUID
  source; it does not own commands or persistence.

## Phase 3B command and history foundation

- `src/domain/commands/commandHandler.ts`, `commandRegistry.ts`, and
  `executeDocumentCommand.ts` own typed handler definitions, duplicate-safe explicit registration,
  runtime command/payload validation, atomic Immer patch capture, invariant validation, and injected
  transaction construction.
- `src/domain/commands/core/` owns the generic current-version canvas, element, connection, media,
  extension-installation, and document-settings command handlers. It contains no concrete element
  or extension feature behavior.
- `src/domain/history/historyEngine.ts` owns session-only record, undo, redo, clear, optional
  capacity, branch invalidation, and fail-closed patch application. History remains separate from
  the serialized document and Redux.
- `src/app/commands/commandDispatcher.ts` is the narrow composition adapter from explicit handlers
  and deterministic transaction dependencies to the pure domain executor. It is not activated in
  the production UI during Phase 3B.
- `src/domain/ids/entityIds.ts` - opaque branded IDs, canonical external formats, and injectable
  prefixed-ID creation.

## Phase 3C Redux workspace and persistence orchestration

- `src/app/workspace/workspaceSlice.ts` and `workspaceTypes.ts` own the serializable normalized
  document, session-only history, revision, epoch, local/persisted sequences, save phase, sanitized
  error, conflict, scheduling, and in-flight state.
- `src/app/workspace/workspaceOperations.ts` is the narrow synchronous load/clear/command/undo/redo
  boundary. It composes the Phase 3B dispatcher and history engine and notifies persistence only for
  actual document changes.
- `src/app/persistence/documentPersistenceCoordinator.ts` owns the dependency-injected debounce,
  just-in-time codec call, one-current-workspace-save rule, expected revisions, follow-up saves,
  retry, conflict blocking, epoch correlation, and disposal.
- `src/app/persistence/persistenceScheduler.ts` owns the named 350 ms parity default and injectable
  timer contract; timers never enter Redux.
- `src/app/selectors/workspaceSelectors.ts` exposes document, history, dirty/sequence, revision,
  conflict, and save lifecycle state without serialization or deep comparison.
- `src/app/store.ts` composes these pieces. Its exported singleton has no database dependency, so
  production remains on the unchanged legacy boundary and importing the store starts no save work.

## Target Rust ownership

### `src-tauri/src/commands/`

Thin Tauri command adapters. Validate transport shape and delegate immediately.

### `src-tauri/src/database/`

SQLite schema, document repository, media repository, backups, and database connection behavior.

### `src-tauri/src/crypto/`

Argon2id derivation, authenticated envelope encryption, secure random values, and zeroizing key storage helpers.

### `src-tauri/src/session/`

Derived-key session lifetime, explicit lock, inactivity behavior, tray persistence, and Windows lock integration.

### `src-tauri/src/workflow/`

Structured workflow validation, process launching, ownership tracking, stopping, and safe logs.

### `src-tauri/src/files/`

Database writer locks and transactionally safe file operations.

### `src-tauri/src/settings/`

Edition-specific external application configuration import/export and persistence.

## Phase 0 tooling

- `src-tauri/tauri.dev.conf.json` — Development-edition identity override for running beside the stable app.
- `scripts/check-architecture.mjs` — Enforces dependency boundaries for new architecture directories.
- `scripts/report-file-sizes.mjs` — Reports source files above the 250-line target and 400-line review threshold.
- `scripts/generate-codemap.mjs` — Generates the detailed repository inventory below.
- `scripts/generate-baseline-fixtures.mjs` — Produces deterministic 40, 2,000, and 10,000-element documents.
- `fixtures/baseline/` — Generated performance and behavior fixtures; regenerate rather than editing manually.

## Tools

### `tools/taskmap-migrator/`

Standalone graphical converter from the legacy database/keyring format to the new `.tmapdb`. Legacy migrations must stay here and out of the main application.

## Navigation procedure for Codex

1. Read `AGENTS.md`.
2. Read the relevant section of `ARCHITECTURE.md`.
3. Read the current roadmap phase.
4. Use this code map to open only the owning subsystem.
5. Read that subsystem's local public entrypoints and tests.
6. Do not scan all components or all domain files unless the task genuinely crosses their contracts.
7. Update this file when ownership or paths change.

## Generated inventory

Run `npm run codemap` after adding, moving, or deleting source files. CI can verify the generated section with `npm run codemap:check` after the first inventory has been committed.

<!-- GENERATED-INVENTORY:START -->

## Generated repository inventory

> Generated by `npm run codemap`. Do not edit this section manually.

| File                                                                   | Lines | Responsibility                                                                          |
| ---------------------------------------------------------------------- | ----: | --------------------------------------------------------------------------------------- |
| `scripts/check-architecture.mjs`                                       |   270 | Repository maintenance script                                                           |
| `scripts/check-mcp-development-exclusion.mjs`                          |    89 | Repository maintenance script                                                           |
| `scripts/check-phase2-production-exclusion.mjs`                        |    72 | Repository maintenance script                                                           |
| `scripts/check-version.mjs`                                            |    56 | Repository maintenance script                                                           |
| `scripts/generate-baseline-fixtures.mjs`                               |   115 | Repository maintenance script                                                           |
| `scripts/generate-codemap.mjs`                                         |   103 | Repository maintenance script                                                           |
| `scripts/material-architecture-rules.mjs`                              |   140 | Repository maintenance script                                                           |
| `scripts/material-architecture-rules.test.mjs`                         |   158 | Tests for the adjacent module                                                           |
| `scripts/report-file-sizes.mjs`                                        |    46 | Repository maintenance script                                                           |
| `src-tauri/src/commands.rs`                                            |   566 | Rust backend module                                                                     |
| `src-tauri/src/commands/database_command_types.rs`                     |    65 | Rust backend module                                                                     |
| `src-tauri/src/commands/database_commands.rs`                          |   302 | Rust backend module                                                                     |
| `src-tauri/src/commands/database_window_commands.rs`                   |   179 | Rust backend module                                                                     |
| `src-tauri/src/commands/phase2_ipc.rs`                                 |    51 | Rust backend module                                                                     |
| `src-tauri/src/crypto/document_cipher.rs`                              |   140 | Rust backend module                                                                     |
| `src-tauri/src/crypto/key_derivation.rs`                               |   106 | Rust backend module                                                                     |
| `src-tauri/src/crypto/mod.rs`                                          |     4 | Rust backend module                                                                     |
| `src-tauri/src/crypto/secret_key.rs`                                   |    43 | Rust backend module                                                                     |
| `src-tauri/src/database/backup_repository.rs`                          |    94 | Rust backend module                                                                     |
| `src-tauri/src/database/connection.rs`                                 |   124 | Rust backend module                                                                     |
| `src-tauri/src/database/document_repository.rs`                        |   182 | Rust backend module                                                                     |
| `src-tauri/src/database/envelope_validation.rs`                        |   254 | Rust backend module                                                                     |
| `src-tauri/src/database/limits.rs`                                     |   101 | Rust backend module                                                                     |
| `src-tauri/src/database/media_repository.rs`                           |   152 | Rust backend module                                                                     |
| `src-tauri/src/database/mod.rs`                                        |    10 | The repository is exercised now; its streaming platform adapter is Phase 5.             |
| `src-tauri/src/database/schema.rs`                                     |   138 | Rust backend module                                                                     |
| `src-tauri/src/discord.rs`                                             |   170 | / Holds the live Discord IPC connection. `None` when RPC is disabled or                 |
| `src-tauri/src/error.rs`                                               |   125 | Rust backend module                                                                     |
| `src-tauri/src/files/database_lock.rs`                                 |   324 | Diagnostic metadata is deliberately best-effort. Only the OS lock                       |
| `src-tauri/src/files/database_path_authorization.rs`                   |   330 | Rust backend module                                                                     |
| `src-tauri/src/files/mod.rs`                                           |     3 | Rust backend module                                                                     |
| `src-tauri/src/images.rs`                                              |   691 | / Longest edge (px) a raster image is downscaled to on import. Matches the              |
| `src-tauri/src/main.rs`                                                |   180 | Register first so a duplicate process exits before other plugins                        |
| `src-tauri/src/model.rs`                                               |  1105 | Rust backend module                                                                     |
| `src-tauri/src/phase2_error.rs`                                        |   184 | Rust backend module                                                                     |
| `src-tauri/src/portable.rs`                                            |   309 | / The decrypted body of an export. Images are bundled so the file is portable           |
| `src-tauri/src/session/database_session.rs`                            |   269 | Rust backend module                                                                     |
| `src-tauri/src/session/mod.rs`                                         |    23 | Rust backend module                                                                     |
| `src-tauri/src/session/phase2_concurrency_recovery_tests.rs`           |   242 | Rust backend module                                                                     |
| `src-tauri/src/session/phase2_tests.rs`                                |   368 | Rust backend module                                                                     |
| `src-tauri/src/session/session_key_state.rs`                           |    96 | Rust backend module                                                                     |
| `src-tauri/src/session/session_lifecycle.rs`                           |    93 | Rust backend module                                                                     |
| `src-tauri/src/session/session_opening.rs`                             |   245 | Rust backend module                                                                     |
| `src-tauri/src/session/session_state_access.rs`                        |    52 | Rust backend module                                                                     |
| `src-tauri/src/session/session_support.rs`                             |    82 | Rust backend module                                                                     |
| `src-tauri/src/session/session_types.rs`                               |   104 | Rust backend module                                                                     |
| `src-tauri/src/settings/mod.rs`                                        |     2 | Rust backend module                                                                     |
| `src-tauri/src/settings/recent_databases.rs`                           |   193 | Rust backend module                                                                     |
| `src-tauri/src/storage.rs`                                             |   722 | Rust backend module                                                                     |
| `src-tauri/src/window_state.rs`                                        |   105 | Clamp the saved geometry so the window can never restore off-screen or                  |
| `src/App.tsx`                                                          |  7628 | Latest image drop/paste handlers, refreshed each render so the once-mounted             |
| `src/app/appData.test.ts`                                              |   355 | Tests for the adjacent module                                                           |
| `src/app/appData.ts`                                                   |   299 | TypeScript application module                                                           |
| `src/app/appDataSchema.ts`                                             |   274 | TypeScript application module                                                           |
| `src/app/AppProviders.tsx`                                             |    28 | React component or typed UI module                                                      |
| `src/app/AppShell.test.tsx`                                            |    69 | Tests for the adjacent module                                                           |
| `src/app/AppShell.tsx`                                                 |    48 | React component or typed UI module                                                      |
| `src/app/canvasDocument.test.ts`                                       |   122 | Tests for the adjacent module                                                           |
| `src/app/canvasDocument.ts`                                            |    80 | TypeScript application module                                                           |
| `src/app/commandError.test.ts`                                         |    24 | Tests for the adjacent module                                                           |
| `src/app/commandError.ts`                                              |    74 | Compatibility with pre-structured backend errors while older builds or                  |
| `src/app/commands/commandDispatcher.test.ts`                           |    28 | @vitest-environment node                                                                |
| `src/app/commands/commandDispatcher.ts`                                |    18 | TypeScript application module                                                           |
| `src/app/commands/commandTypes.ts`                                     |    12 | TypeScript application module                                                           |
| `src/app/defaultData.ts`                                               |    36 | TypeScript application module                                                           |
| `src/app/errors/ApplicationErrorBoundary.test.tsx`                     |    62 | Tests for the adjacent module                                                           |
| `src/app/errors/ApplicationErrorBoundary.tsx`                          |    44 | React component or typed UI module                                                      |
| `src/app/errors/applicationErrorReporter.test.ts`                      |    27 | Tests for the adjacent module                                                           |
| `src/app/errors/applicationErrorReporter.ts`                           |    27 | Deliberately omit the error message, stack, and component data: they may                |
| `src/app/history.test.ts`                                              |   161 | Tests for the adjacent module                                                           |
| `src/app/history.ts`                                                   |    88 | TypeScript application module                                                           |
| `src/app/hooks.ts`                                                     |     6 | TypeScript application module                                                           |
| `src/app/interactions/canvasInteractionController.geometry.test.ts`    |   283 | @vitest-environment node                                                                |
| `src/app/interactions/canvasInteractionController.ts`                  |   394 | TypeScript application module                                                           |
| `src/app/interactions/canvasInteractionController.viewport.test.ts`    |   263 | @vitest-environment node                                                                |
| `src/app/interactions/canvasInteractionSnapshot.ts`                    |    19 | TypeScript application module                                                           |
| `src/app/interactions/canvasInteractionTypes.ts`                       |   152 | TypeScript application module                                                           |
| `src/app/interactions/panGestureFrameQueue.ts`                         |    70 | TypeScript application module                                                           |
| `src/app/interactions/resizeGeometry.test.ts`                          |    36 | @vitest-environment node                                                                |
| `src/app/interactions/resizeGeometry.ts`                               |    37 | TypeScript application module                                                           |
| `src/app/interactions/selectionEngine.ts`                              |    39 | TypeScript application module                                                           |
| `src/app/interactions/snappingEngine.test.ts`                          |    80 | @vitest-environment node                                                                |
| `src/app/interactions/snappingEngine.ts`                               |    91 | TypeScript application module                                                           |
| `src/app/interactions/TransientInteractionProvider.test.tsx`           |    68 | Tests for the adjacent module                                                           |
| `src/app/interactions/TransientInteractionProvider.tsx`                |    26 | React component or typed UI module                                                      |
| `src/app/interactions/transientInteractionService.ts`                  |    35 | TypeScript application module                                                           |
| `src/app/interactions/useStableCanvasInteractionController.test.tsx`   |    45 | Tests for the adjacent module                                                           |
| `src/app/interactions/useStableCanvasInteractionController.ts`         |    15 | TypeScript application module                                                           |
| `src/app/interactions/useTransientInteraction.ts`                      |    20 | TypeScript application module                                                           |
| `src/app/persistence/documentPersistenceCoordinator.test.ts`           |   261 | @vitest-environment node                                                                |
| `src/app/persistence/documentPersistenceCoordinator.ts`                |   265 | TypeScript application module                                                           |
| `src/app/persistence/documentPersistenceFailures.test.ts`              |   348 | @vitest-environment node                                                                |
| `src/app/persistence/persistenceErrors.ts`                             |    36 | TypeScript application module                                                           |
| `src/app/persistence/persistenceScheduler.ts`                          |    16 | TypeScript application module                                                           |
| `src/app/selectors/applicationSelectors.ts`                            |     5 | TypeScript application module                                                           |
| `src/app/selectors/workspaceSelectors.test.ts`                         |    68 | @vitest-environment node                                                                |
| `src/app/selectors/workspaceSelectors.ts`                              |    35 | TypeScript application module                                                           |
| `src/app/store.ts`                                                     |    67 | TypeScript application module                                                           |
| `src/app/windowChrome.ts`                                              |     9 | TypeScript application module                                                           |
| `src/app/windowCloseCoordinator.ts`                                    |    15 | TypeScript application module                                                           |
| `src/app/workspace/workspaceCommandsHistory.test.ts`                   |   199 | @vitest-environment node                                                                |
| `src/app/workspace/workspaceInitialization.test.ts`                    |   100 | @vitest-environment node                                                                |
| `src/app/workspace/workspaceOperations.ts`                             |   146 | TypeScript application module                                                           |
| `src/app/workspace/workspaceSlice.ts`                                  |   157 | TypeScript application module                                                           |
| `src/app/workspace/workspaceTestSupport.ts`                            |   112 | TypeScript application module                                                           |
| `src/app/workspace/workspaceTypes.ts`                                  |    67 | TypeScript application module                                                           |
| `src/canvas/geometry/canvasGeometry.ts`                                |    41 | TypeScript application module                                                           |
| `src/canvas/geometry/viewportMath.test.ts`                             |    78 | @vitest-environment node                                                                |
| `src/canvas/geometry/viewportMath.ts`                                  |   108 | TypeScript application module                                                           |
| `src/canvas/virtualization/viewportCulling.test.ts`                    |    85 | @vitest-environment node                                                                |
| `src/canvas/virtualization/viewportCulling.ts`                         |    69 | TypeScript application module                                                           |
| `src/canvasMath.test.ts`                                               |   159 | Tests for the adjacent module                                                           |
| `src/canvasMath.ts`                                                    |   128 | TypeScript application module                                                           |
| `src/components/CanvasManager.tsx`                                     |   940 | React component or typed UI module                                                      |
| `src/components/CanvasManagerCards.test.tsx`                           |   536 | Tests for the adjacent module                                                           |
| `src/components/ColorPickerMenu.tsx`                                   |   340 | React component or typed UI module                                                      |
| `src/components/CommandRunnerModals.test.tsx`                          |   141 | Tests for the adjacent module                                                           |
| `src/components/CommandRunnerModals.tsx`                               |   612 | React component or typed UI module                                                      |
| `src/components/ContainerJsonEditorWindow.test.tsx`                    |    34 | Tests for the adjacent module                                                           |
| `src/components/ContainerJsonEditorWindow.tsx`                         |   257 | React component or typed UI module                                                      |
| `src/components/ContainerNode.tsx`                                     |   877 | React component or typed UI module                                                      |
| `src/components/ContextMenus.test.tsx`                                 |   224 | Tests for the adjacent module                                                           |
| `src/components/ContextMenus.tsx`                                      |  1144 | React component or typed UI module                                                      |
| `src/components/ExtensionDropEffect.tsx`                               |   203 | React component or typed UI module                                                      |
| `src/components/ExtensionsPanel.test.tsx`                              |   350 | Tests for the adjacent module                                                           |
| `src/components/ExtensionsPanel.tsx`                                   |   619 | React component or typed UI module                                                      |
| `src/components/FloatingToolbar.test.tsx`                              |   164 | Tests for the adjacent module                                                           |
| `src/components/FloatingToolbar.tsx`                                   |   197 | The material registry's shared ResizeObserver follows intermediate width frames. These  |
| `src/components/FpsCounter.tsx`                                        |    34 | React component or typed UI module                                                      |
| `src/components/FrostedGlassTuner.test.tsx`                            |   139 | Tests for the adjacent module                                                           |
| `src/components/FrostedGlassTuner.tsx`                                 |   196 | React component or typed UI module                                                      |
| `src/components/FrostedGlassTunerControls.tsx`                         |    96 | React component or typed UI module                                                      |
| `src/components/FrostedGlassTunerPanels.tsx`                           |   167 | React component or typed UI module                                                      |
| `src/components/FrostedGlassTunerState.ts`                             |   105 | React component or typed UI module                                                      |
| `src/components/ImageNode.tsx`                                         |   142 | Background extension off: only show the image, no frame/border/shell, so a              |
| `src/components/MarkdownContent.tsx`                                   |    92 | React component or typed UI module                                                      |
| `src/components/MindmapConnections.test.tsx`                           |    44 | Tests for the adjacent module                                                           |
| `src/components/MindmapConnections.tsx`                                |   109 | React component or typed UI module                                                      |
| `src/components/MindmapConnectors.test.tsx`                            |    30 | Tests for the adjacent module                                                           |
| `src/components/MindmapConnectors.tsx`                                 |    56 | React component or typed UI module                                                      |
| `src/components/Minimap.test.tsx`                                      |   155 | Tests for the adjacent module                                                           |
| `src/components/Minimap.tsx`                                           |   209 | React component or typed UI module                                                      |
| `src/components/Modals.test.tsx`                                       |   111 | Tests for the adjacent module                                                           |
| `src/components/Modals.tsx`                                            |   556 | React component or typed UI module                                                      |
| `src/components/ProductionDialogs.test.tsx`                            |   204 | Shared scheduler drains the retained modal presence.                                    |
| `src/components/ProductionDialogs.tsx`                                 |   241 | React component or typed UI module                                                      |
| `src/components/SettingsModal.test.tsx`                                |   354 | One pending shared frame advances all active UI motion subscribers.                     |
| `src/components/TextBlockNode.tsx`                                     |   561 | React component or typed UI module                                                      |
| `src/components/TextCardNode.test.tsx`                                 |   246 | Tests for the adjacent module                                                           |
| `src/components/TextCardNode.tsx`                                      |   482 | React component or typed UI module                                                      |
| `src/components/ToastStack.tsx`                                        |    53 | React component or typed UI module                                                      |
| `src/components/WindowChrome.test.tsx`                                 |    87 | Tests for the adjacent module                                                           |
| `src/components/WindowChrome.tsx`                                      |   111 | React component or typed UI module                                                      |
| `src/components/WorkspacePanels.test.tsx`                              |   220 | Tests for the adjacent module                                                           |
| `src/constants.ts`                                                     |    58 | TypeScript application module                                                           |
| `src/domain/commands/commandExecution.stress.test.ts`                  |    44 | @vitest-environment node                                                                |
| `src/domain/commands/commandExecution.test.ts`                         |   204 | @vitest-environment node                                                                |
| `src/domain/commands/commandHandler.ts`                                |    43 | TypeScript application module                                                           |
| `src/domain/commands/commandRegistry.ts`                               |    29 | TypeScript application module                                                           |
| `src/domain/commands/commandResult.ts`                                 |    32 | TypeScript application module                                                           |
| `src/domain/commands/commandTestSupport.ts`                            |    38 | TypeScript application module                                                           |
| `src/domain/commands/core/canvasCommands.test.ts`                      |   121 | @vitest-environment node                                                                |
| `src/domain/commands/core/canvasCommands.ts`                           |   132 | TypeScript application module                                                           |
| `src/domain/commands/core/connectionCommands.test.ts`                  |   110 | @vitest-environment node                                                                |
| `src/domain/commands/core/connectionCommands.ts`                       |    72 | TypeScript application module                                                           |
| `src/domain/commands/core/coreDocumentCommandHandlers.test.ts`         |    33 | @vitest-environment node                                                                |
| `src/domain/commands/core/coreDocumentCommandHandlers.ts`              |    17 | TypeScript application module                                                           |
| `src/domain/commands/core/documentSettingsCommands.ts`                 |    51 | TypeScript application module                                                           |
| `src/domain/commands/core/elementCommands.test.ts`                     |   131 | @vitest-environment node                                                                |
| `src/domain/commands/core/elementCommands.ts`                          |   125 | TypeScript application module                                                           |
| `src/domain/commands/core/extensionCommands.ts`                        |   104 | TypeScript application module                                                           |
| `src/domain/commands/core/mediaCommands.ts`                            |    59 | TypeScript application module                                                           |
| `src/domain/commands/core/mediaExtensionSettingsCommands.test.ts`      |   169 | @vitest-environment node                                                                |
| `src/domain/commands/currentDocumentValidation.test.ts`                |   146 | @vitest-environment node                                                                |
| `src/domain/commands/domainCommand.ts`                                 |     5 | TypeScript application module                                                           |
| `src/domain/commands/executeDocumentCommand.ts`                        |   121 | TypeScript application module                                                           |
| `src/domain/document/createDocument.test.ts`                           |    29 | @vitest-environment node                                                                |
| `src/domain/document/createDocument.ts`                                |    43 | TypeScript application module                                                           |
| `src/domain/document/documentInvariants.test.ts`                       |   160 | @vitest-environment node                                                                |
| `src/domain/document/documentInvariants.ts`                            |    44 | TypeScript application module                                                           |
| `src/domain/document/documentLimits.ts`                                |    20 | TypeScript application module                                                           |
| `src/domain/document/documentSchema.test.ts`                           |   201 | @vitest-environment node                                                                |
| `src/domain/document/documentSchema.ts`                                |   226 | TypeScript application module                                                           |
| `src/domain/document/documentTestFixtures.ts`                          |   129 | TypeScript application module                                                           |
| `src/domain/document/documentTypes.ts`                                 |   108 | TypeScript application module                                                           |
| `src/domain/document/documentVersion.ts`                               |     3 | The decrypted document version is independent from the SQLite envelope version.         |
| `src/domain/document/invariants/canvasInvariants.ts`                   |   130 | TypeScript application module                                                           |
| `src/domain/document/invariants/connectionInvariants.ts`               |    55 | TypeScript application module                                                           |
| `src/domain/document/invariants/entityRecordInvariants.ts`             |    56 | TypeScript application module                                                           |
| `src/domain/document/invariants/extensionInvariants.ts`                |    52 | TypeScript application module                                                           |
| `src/domain/document/jsonDeepEqual.test.ts`                            |    75 | @vitest-environment node                                                                |
| `src/domain/document/jsonDeepEqual.ts`                                 |    84 | TypeScript application module                                                           |
| `src/domain/document/jsonSafety.ts`                                    |   172 | TypeScript application module                                                           |
| `src/domain/document/validateDocument.ts`                              |    36 | TypeScript application module                                                           |
| `src/domain/history/historyCompatibility.test.ts`                      |    91 | @vitest-environment node                                                                |
| `src/domain/history/historyEngine.test.ts`                             |   187 | @vitest-environment node                                                                |
| `src/domain/history/historyEngine.ts`                                  |   131 | TypeScript application module                                                           |
| `src/domain/history/historyTypes.ts`                                   |    20 | TypeScript application module                                                           |
| `src/domain/history/immerPatchSupport.ts`                              |    10 | TypeScript application module                                                           |
| `src/domain/history/transactionTypes.ts`                               |    11 | TypeScript application module                                                           |
| `src/domain/ids/entityIds.test.ts`                                     |    29 | @vitest-environment node                                                                |
| `src/domain/ids/entityIds.ts`                                          |    74 | TypeScript application module                                                           |
| `src/elements/architectureRegistries.test.ts`                          |    21 | Tests for the adjacent module                                                           |
| `src/elements/elementDefinition.ts`                                    |    31 | TypeScript application module                                                           |
| `src/elements/registry.ts`                                             |    12 | TypeScript application module                                                           |
| `src/extensions/architectureRegistry.ts`                               |    12 | TypeScript application module                                                           |
| `src/extensions/copyPasteJson.test.ts`                                 |   216 | Tests for the adjacent module                                                           |
| `src/extensions/copyPasteJson.ts`                                      |   171 | TypeScript application module                                                           |
| `src/extensions/extensionDefinition.ts`                                |    20 | TypeScript application module                                                           |
| `src/extensions/registry.test.ts`                                      |    55 | Tests for the adjacent module                                                           |
| `src/extensions/registry.ts`                                           |   203 | TypeScript application module                                                           |
| `src/extensions/useExtensionDrag.ts`                                   |   117 | TypeScript application module                                                           |
| `src/features/minimap/minimapProjection.test.ts`                       |    25 | @vitest-environment node                                                                |
| `src/features/minimap/minimapProjection.ts`                            |    52 | TypeScript application module                                                           |
| `src/features/phase2-database/DevelopmentPhase2Entry.test.tsx`         |    14 | Tests for the adjacent module                                                           |
| `src/features/phase2-database/DevelopmentPhase2Entry.tsx`              |    35 | React component or typed UI module                                                      |
| `src/features/phase2-database/Phase2DatabaseHarness.tsx`               |   236 | React component or typed UI module                                                      |
| `src/features/phase2-database/Phase2DatabasePathControls.tsx`          |    74 | React component or typed UI module                                                      |
| `src/features/phase2-database/phase2Document.ts`                       |    74 | TypeScript application module                                                           |
| `src/features/phase2-database/Phase2HarnessHeader.tsx`                 |    20 | React component or typed UI module                                                      |
| `src/features/phase2-database/phase2HarnessState.test.ts`              |    59 | Tests for the adjacent module                                                           |
| `src/features/phase2-database/phase2HarnessState.ts`                   |    58 | TypeScript application module                                                           |
| `src/features/phase2-database/Phase2HarnessStatus.tsx`                 |    22 | React component or typed UI module                                                      |
| `src/features/phase2-database/phase2HarnessTypes.ts`                   |     9 | TypeScript application module                                                           |
| `src/features/phase2-database/phase2LockOperation.test.ts`             |    68 | Tests for the adjacent module                                                           |
| `src/features/phase2-database/phase2LockOperation.ts`                  |    23 | TypeScript application module                                                           |
| `src/features/phase2-database/Phase2SessionActions.tsx`                |   145 | React component or typed UI module                                                      |
| `src/hooks/useAppUpdates.ts`                                           |   183 | TypeScript application module                                                           |
| `src/hooks/useAutosave.test.tsx`                                       |    77 | Tests for the adjacent module                                                           |
| `src/hooks/useAutosave.ts`                                             |    79 | This hook deliberately accepts the caller's dependency list, matching                   |
| `src/hooks/useCanvasDocument.test.tsx`                                 |    64 | Tests for the adjacent module                                                           |
| `src/hooks/useCanvasDocument.ts`                                       |   195 | TypeScript application module                                                           |
| `src/hooks/useDiscordRpc.ts`                                           |    35 | TypeScript application module                                                           |
| `src/hooks/useFrameStats.ts`                                           |    65 | TypeScript application module                                                           |
| `src/hooks/useImageCache.test.tsx`                                     |   216 | Tests for the adjacent module                                                           |
| `src/hooks/useImageCache.ts`                                           |   264 | TypeScript application module                                                           |
| `src/legacy/interactions/legacyCameraSynchronization.test.ts`          |    77 | @vitest-environment node                                                                |
| `src/legacy/interactions/legacyCameraSynchronization.ts`               |    79 | TypeScript application module                                                           |
| `src/legacy/interactions/legacyCanvasGeometry.test.ts`                 |    93 | @vitest-environment node                                                                |
| `src/legacy/interactions/legacyCanvasGeometry.ts`                      |   111 | TypeScript application module                                                           |
| `src/legacy/interactions/legacyCanvasInteractionCommitAdapter.test.ts` |   197 | @vitest-environment node                                                                |
| `src/legacy/interactions/legacyCanvasInteractionCommitAdapter.ts`      |   170 | TypeScript application module                                                           |
| `src/legacy/interactions/legacyCanvasInteractionIntegration.test.ts`   |   146 | @vitest-environment node                                                                |
| `src/legacy/interactions/legacySelectionCompatibility.test.ts`         |    32 | @vitest-environment node                                                                |
| `src/legacy/interactions/legacySelectionCompatibility.ts`              |    12 | TypeScript application module                                                           |
| `src/legacy/interactions/legacyTextCardDragPresentation.test.ts`       |    39 | @vitest-environment node                                                                |
| `src/legacy/interactions/legacyTextCardDragPresentation.ts`            |    19 | TypeScript application module                                                           |
| `src/legacy/interactions/legacyTextCardDrop.ts`                        |   183 | TypeScript application module                                                           |
| `src/legacy/interactions/legacyTextCardInteraction.test.ts`            |   351 | @vitest-environment node                                                                |
| `src/legacy/interactions/legacyTextCardInteraction.ts`                 |   257 | TypeScript application module                                                           |
| `src/legacy/interactions/legacyTextCardModifierTransition.test.ts`     |   118 | @vitest-environment node                                                                |
| `src/legacy/interactions/legacyTextCardModifierTransition.ts`          |    38 | TypeScript application module                                                           |
| `src/legacy/interactions/legacyTextCardPlacement.test.ts`              |    53 | @vitest-environment node                                                                |
| `src/legacy/interactions/legacyTextCardPlacement.ts`                   |   309 | TypeScript application module                                                           |
| `src/legacy/LegacyApplication.tsx`                                     |    12 | React component or typed UI module                                                      |
| `src/legacy/materials/legacyBackdropPanelPrimitives.ts`                |    80 | TypeScript application module                                                           |
| `src/legacy/materials/legacyBackdropScene.test.ts`                     |   262 | Tests for the adjacent module                                                           |
| `src/legacy/materials/legacyBackdropScene.ts`                          |   250 | TypeScript application module                                                           |
| `src/legacy/materials/legacyBackdropSceneRevision.ts`                  |    35 | TypeScript application module                                                           |
| `src/main.tsx`                                                         |    11 | TypeScript application module                                                           |
| `src/mindmapMath.test.ts`                                              |    42 | Tests for the adjacent module                                                           |
| `src/mindmapMath.ts`                                                   |    83 | TypeScript application module                                                           |
| `src/platform/database/databaseClient.ts`                              |    25 | TypeScript application module                                                           |
| `src/platform/database/databaseDocumentCodec.ts`                       |    37 | TypeScript application module                                                           |
| `src/platform/database/databaseTypes.ts`                               |    55 | TypeScript application module                                                           |
| `src/platform/database/tauriDatabaseClient.test.ts`                    |   160 | Tests for the adjacent module                                                           |
| `src/platform/database/tauriDatabaseClient.ts`                         |   178 | TypeScript application module                                                           |
| `src/platform/media/mediaClient.ts`                                    |    10 | TypeScript application module                                                           |
| `src/platform/media/mediaTypes.ts`                                     |    17 | TypeScript application module                                                           |
| `src/platform/platformErrors.ts`                                       |    30 | TypeScript application module                                                           |
| `src/platform/settings/settingsClient.ts`                              |    14 | TypeScript application module                                                           |
| `src/platform/settings/settingsTypes.ts`                               |    14 | TypeScript application module                                                           |
| `src/platform/settings/tauriSettingsClient.ts`                         |    16 | TypeScript application module                                                           |
| `src/platform/tauriInvoke.ts`                                          |    72 | TypeScript application module                                                           |
| `src/platform/window/tauriWindowChromeClient.ts`                       |    26 | TypeScript application module                                                           |
| `src/platform/workflow/workflowClient.ts`                              |    10 | TypeScript application module                                                           |
| `src/platform/workflow/workflowTypes.ts`                               |    20 | TypeScript application module                                                           |
| `src/test/setup.ts`                                                    |     2 | TypeScript application module                                                           |
| `src/types.ts`                                                         |   418 | TypeScript application module                                                           |
| `src/ui-lab/main.tsx`                                                  |    11 | TypeScript application module                                                           |
| `src/ui-lab/SurfaceMaterialPrototype.test.tsx`                         |    54 | Tests for the adjacent module                                                           |
| `src/ui-lab/SurfaceMaterialPrototype.tsx`                              |   150 | React component or typed UI module                                                      |
| `src/ui-lab/system/Material.test.ts`                                   |    18 | Tests for the adjacent module                                                           |
| `src/ui-lab/system/Material.ts`                                        |    15 | React component or typed UI module                                                      |
| `src/ui-lab/system/Surface.test.tsx`                                   |    98 | Tests for the adjacent module                                                           |
| `src/ui-lab/system/Surface.tsx`                                        |    39 | React component or typed UI module                                                      |
| `src/ui-lab/UiLabApp.test.tsx`                                         |    46 | Tests for the adjacent module                                                           |
| `src/ui-lab/UiLabApp.tsx`                                              |    68 | React component or typed UI module                                                      |
| `src/ui/dev/AcrylicCompositorPlayground.test.tsx`                      |   110 | Tests for the adjacent module                                                           |
| `src/ui/dev/AcrylicCompositorPlayground.tsx`                           |   246 | React component or typed UI module                                                      |
| `src/ui/dev/acrylicPlaygroundModel.test.ts`                            |    95 | Tests for the adjacent module                                                           |
| `src/ui/dev/acrylicPlaygroundModel.ts`                                 |   202 | TypeScript application module                                                           |
| `src/ui/dev/ButtonMaterialTests.tsx`                                   |   163 | React component or typed UI module                                                      |
| `src/ui/dev/containerContextMenuFixture.ts`                            |    34 | TypeScript application module                                                           |
| `src/ui/dev/ContextMenuDemo.tsx`                                       |   198 | React component or typed UI module                                                      |
| `src/ui/dev/contextMenuMaterialIntegration.test.tsx`                   |    47 | Tests for the adjacent module                                                           |
| `src/ui/dev/DevelopmentUiLab.test.tsx`                                 |   126 | Tests for the adjacent module                                                           |
| `src/ui/dev/DevelopmentUiLab.tsx`                                      |   276 | React component or typed UI module                                                      |
| `src/ui/materials/compositor/acrylicBitmapResource.ts`                 |    30 | TypeScript application module                                                           |
| `src/ui/materials/compositor/acrylicBuildExecutor.ts`                  |    40 | TypeScript application module                                                           |
| `src/ui/materials/compositor/acrylicCache.worker.ts`                   |    23 | TypeScript application module                                                           |
| `src/ui/materials/compositor/acrylicCacheRuntime.test.ts`              |   289 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/acrylicCacheRuntime.ts`                   |   245 | TypeScript application module                                                           |
| `src/ui/materials/compositor/acrylicCanvas.ts`                         |    43 | TypeScript application module                                                           |
| `src/ui/materials/compositor/acrylicWorkerExecutor.test.ts`            |   263 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/acrylicWorkerExecutor.ts`                 |   176 | TypeScript application module                                                           |
| `src/ui/materials/compositor/acrylicWorkerFactory.ts`                  |     7 | TypeScript application module                                                           |
| `src/ui/materials/compositor/acrylicWorkerProtocol.test.ts`            |   107 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/acrylicWorkerProtocol.ts`                 |   209 | TypeScript application module                                                           |
| `src/ui/materials/compositor/acrylicWorkerRuntime.test.ts`             |    98 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/acrylicWorkerRuntime.ts`                  |    63 | TypeScript application module                                                           |
| `src/ui/materials/compositor/adaptiveQuality.test.ts`                  |   125 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/adaptiveQuality.ts`                       |    83 | TypeScript application module                                                           |
| `src/ui/materials/compositor/backdropScene.test.ts`                    |   109 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/backdropScene.ts`                         |    71 | TypeScript application module                                                           |
| `src/ui/materials/compositor/backdropSceneValidation.ts`               |   204 | TypeScript application module                                                           |
| `src/ui/materials/compositor/browserAcrylicRuntime.test.ts`            |   101 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/browserAcrylicRuntime.ts`                 |    71 | TypeScript application module                                                           |
| `src/ui/materials/compositor/cacheCoverage.test.ts`                    |   192 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/cacheCoverage.ts`                         |   143 | TypeScript application module                                                           |
| `src/ui/materials/compositor/cacheReprojection.test.ts`                |    46 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/cacheReprojection.ts`                     |    37 | TypeScript application module                                                           |
| `src/ui/materials/compositor/cacheResourceOwner.test.ts`               |   108 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/cacheResourceOwner.ts`                    |    67 | TypeScript application module                                                           |
| `src/ui/materials/compositor/cacheScheduler.test.ts`                   |   246 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/cacheScheduler.ts`                        |   116 | TypeScript application module                                                           |
| `src/ui/materials/compositor/compositorCapabilities.test.ts`           |   105 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/compositorCapabilities.ts`                |   121 | TypeScript application module                                                           |
| `src/ui/materials/compositor/compositorInvalidation.test.ts`           |    78 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/compositorInvalidation.ts`                |    71 | Explicit output-buffer resize work for B2.                                              |
| `src/ui/materials/compositor/compositorOutputPlanes.test.ts`           |   133 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/compositorOutputPlanes.ts`                |   181 | TypeScript application module                                                           |
| `src/ui/materials/compositor/compositorTestFixtures.ts`                |   235 | TypeScript application module                                                           |
| `src/ui/materials/compositor/compositorTypes.ts`                       |   175 | TypeScript application module                                                           |
| `src/ui/materials/compositor/frameCoalescing.test.ts`                  |    59 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/frameCoalescing.ts`                       |    59 | TypeScript application module                                                           |
| `src/ui/materials/compositor/mainThreadAcrylicBackend.ts`              |    52 | TypeScript application module                                                           |
| `src/ui/materials/compositor/mainThreadAcrylicExecutor.test.ts`        |    83 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/mainThreadAcrylicExecutor.ts`             |    54 | TypeScript application module                                                           |
| `src/ui/materials/compositor/offscreenAcrylicBackend.ts`               |    51 | TypeScript application module                                                           |
| `src/ui/materials/compositor/sceneRasterizer.test.ts`                  |   245 | @vitest-environment node                                                                |
| `src/ui/materials/compositor/sceneRasterizer.ts`                       |   235 | TypeScript application module                                                           |
| `src/ui/materials/compositor/sharedAcrylicCacheBuilder.ts`             |    66 | TypeScript application module                                                           |
| `src/ui/materials/compositor/sharedAcrylicProfile.ts`                  |    56 | TypeScript application module                                                           |
| `src/ui/materials/FrostedSurface.test.tsx`                             |    22 | Tests for the adjacent module                                                           |
| `src/ui/materials/FrostedSurface.tsx`                                  |    15 | React component or typed UI module                                                      |
| `src/ui/materials/frostedSurfaceTypes.ts`                              |     6 | TypeScript application module                                                           |
| `src/ui/materials/legacyCachedAcrylicDefinitions.ts`                   |    71 | TypeScript application module                                                           |
| `src/ui/materials/MaterialAcrylicProof.tsx`                            |    16 | React component or typed UI module                                                      |
| `src/ui/materials/materialCompositorCachePolicy.ts`                    |    80 | TypeScript application module                                                           |
| `src/ui/materials/materialCompositorCoordinator.test.ts`               |   299 | @vitest-environment node                                                                |
| `src/ui/materials/materialCompositorCoordinator.ts`                    |   248 | TypeScript application module                                                           |
| `src/ui/materials/materialCompositorCoordinatorTestHarness.ts`         |   128 | TypeScript application module                                                           |
| `src/ui/materials/materialCompositorDiagnostics.ts`                    |    72 | TypeScript application module                                                           |
| `src/ui/materials/materialCompositorPresentation.ts`                   |    47 | TypeScript application module                                                           |
| `src/ui/materials/MaterialCompositorProvider.tsx`                      |    43 | React component or typed UI module                                                      |
| `src/ui/materials/materialDefinitions.ts`                              |   111 | TypeScript application module                                                           |
| `src/ui/materials/materialGeometryInvalidation.test.ts`                |    25 | Tests for the adjacent module                                                           |
| `src/ui/materials/materialGeometryInvalidation.ts`                     |    36 | TypeScript application module                                                           |
| `src/ui/materials/materialPerformanceDiagnostics.ts`                   |    23 | TypeScript application module                                                           |
| `src/ui/materials/MaterialPlane.tsx`                                   |    18 | React component or typed UI module                                                      |
| `src/ui/materials/materialRegistry.test.ts`                            |   131 | Tests for the adjacent module                                                           |
| `src/ui/materials/materialRegistry.ts`                                 |    38 | TypeScript application module                                                           |
| `src/ui/materials/materialSamplingBoundary.test.ts`                    |    27 | @vitest-environment node                                                                |
| `src/ui/materials/materialSamplingBoundary.tsx`                        |    89 | TypeScript application module                                                           |
| `src/ui/materials/MaterialSurface.test.tsx`                            |   245 | Tests for the adjacent module                                                           |
| `src/ui/materials/MaterialSurface.tsx`                                 |   256 | React component or typed UI module                                                      |
| `src/ui/materials/MaterialSurfaceRegistration.tsx`                     |   131 | React component or typed UI module                                                      |
| `src/ui/materials/materialSurfaceRegistry.test.ts`                     |   151 | @vitest-environment node                                                                |
| `src/ui/materials/materialSurfaceRegistry.ts`                          |   260 | TypeScript application module                                                           |
| `src/ui/materials/materialSurfaceStyle.ts`                             |    84 | TypeScript application module                                                           |
| `src/ui/materials/materialTypes.ts`                                    |   109 | TypeScript application module                                                           |
| `src/ui/materials/nativeGlassRim.test.ts`                              |    41 | @vitest-environment node                                                                |
| `src/ui/materials/nativeGlassRim.ts`                                   |   162 | TypeScript application module                                                           |
| `src/ui/materials/SharedSmallGlassPlane.test.tsx`                      |    95 | Tests for the adjacent module                                                           |
| `src/ui/materials/SharedSmallGlassPlane.tsx`                           |   223 | React component or typed UI module                                                      |
| `src/ui/motion/layoutMotion.test.ts`                                   |   104 | One shared frame remains pending only while motion subscribers are active.              |
| `src/ui/motion/layoutMotion.ts`                                        |    89 | TypeScript application module                                                           |
| `src/ui/motion/liquidIndicatorMotion.test.ts`                          |   144 | Tests for the adjacent module                                                           |
| `src/ui/motion/liquidIndicatorMotion.ts`                               |   112 | TypeScript application module                                                           |
| `src/ui/motion/liquidMaterialIntegration.test.ts`                      |    39 | @vitest-environment node                                                                |
| `src/ui/motion/liquidToggleMotion.test.ts`                             |    58 | Tests for the adjacent module                                                           |
| `src/ui/motion/liquidToggleMotion.ts`                                  |    79 | TypeScript application module                                                           |
| `src/ui/motion/motionFrameScheduler.test.ts`                           |    86 | Tests for the adjacent module                                                           |
| `src/ui/motion/motionFrameScheduler.ts`                                |    91 | TypeScript application module                                                           |
| `src/ui/motion/motionMath.test.ts`                                     |    53 | Tests for the adjacent module                                                           |
| `src/ui/motion/motionMath.ts`                                          |   103 | TypeScript application module                                                           |
| `src/ui/motion/MotionProvider.tsx`                                     |    22 | React component or typed UI module                                                      |
| `src/ui/motion/motionTokens.ts`                                        |    41 | Central Phase 4.5C motion values; these are UI-motion values, not compositor constants. |
| `src/ui/motion/reducedMotionPreference.test.ts`                        |    55 | Tests for the adjacent module                                                           |
| `src/ui/motion/reducedMotionPreference.ts`                             |    65 | TypeScript application module                                                           |
| `src/ui/patterns/overlays/index.ts`                                    |     6 | TypeScript application module                                                           |
| `src/ui/patterns/overlays/ModalDialog.tsx`                             |    24 | React component or typed UI module                                                      |
| `src/ui/patterns/overlays/ModalLayer.tsx`                              |    58 | React component or typed UI module                                                      |
| `src/ui/patterns/overlays/modalMotion.ts`                              |    54 | TypeScript application module                                                           |
| `src/ui/patterns/overlays/ModalPresence.test.tsx`                      |   334 | Tests for the adjacent module                                                           |
| `src/ui/patterns/overlays/ModalPresence.tsx`                           |   141 | React component or typed UI module                                                      |
| `src/ui/patterns/overlays/modalPresenceTestHarness.tsx`                |   121 | One shared pending frame advances every active modal subscriber.                        |
| `src/ui/patterns/overlays/useDialogFocus.ts`                           |    59 | TypeScript application module                                                           |
| `src/ui/patterns/settings/index.ts`                                    |     2 | TypeScript application module                                                           |
| `src/ui/patterns/settings/SettingsPatterns.tsx`                        |   121 | React component or typed UI module                                                      |
| `src/ui/patterns/workspace/CanvasBrowserCard.tsx`                      |    77 | React component or typed UI module                                                      |
| `src/ui/patterns/workspace/canvasBrowserDom.ts`                        |   128 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/canvasBrowserInteraction.test.ts`           |    62 | @vitest-environment node                                                                |
| `src/ui/patterns/workspace/canvasBrowserInteraction.ts`                |   115 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/canvasBrowserLayout.ts`                     |    35 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/CanvasBrowserRuntime.test.ts`               |   355 | The production runtime owns one pending frame at a time.                                |
| `src/ui/patterns/workspace/CanvasBrowserRuntime.ts`                    |   393 | React component or typed UI module                                                      |
| `src/ui/patterns/workspace/canvasBrowserRuntimeState.ts`               |    35 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/canvasBrowserRuntimeTypes.ts`               |    44 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/canvasBrowserScrollState.test.ts`           |    41 | @vitest-environment node                                                                |
| `src/ui/patterns/workspace/canvasBrowserScrollState.ts`                |    89 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/canvasBrowserSharedGlass.ts`                |    84 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/canvasBrowserSlotGeometry.ts`               |   107 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/canvasBrowserViewport.ts`                   |    56 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/canvasBrowserWheelDelta.ts`                 |    11 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/canvasCardPointerSession.ts`                |    59 | Document listeners remain authoritative when pointer capture is unavailable.            |
| `src/ui/patterns/workspace/CanvasFrame.tsx`                            |    15 | React component or typed UI module                                                      |
| `src/ui/patterns/workspace/ExtensionBrowserCard.tsx`                   |    40 | React component or typed UI module                                                      |
| `src/ui/patterns/workspace/FloatingCanvasToolbar.tsx`                  |    39 | React component or typed UI module                                                      |
| `src/ui/patterns/workspace/index.ts`                                   |     9 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/MinimapSurface.test.tsx`                    |   148 | One pending shared frame advances all active subscribers.                               |
| `src/ui/patterns/workspace/MinimapSurface.tsx`                         |    56 | React component or typed UI module                                                      |
| `src/ui/patterns/workspace/useMinimapVisibilityMotion.ts`              |    57 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/useSettledPanelWork.ts`                     |    28 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/useSharedSmallGlassList.ts`                 |    81 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/useWorkspaceSidePanelMotion.ts`             |    95 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/workspaceFoundation.test.tsx`               |   105 | Tests for the adjacent module                                                           |
| `src/ui/patterns/workspace/workspacePanelContentSize.ts`               |    17 | TypeScript application module                                                           |
| `src/ui/patterns/workspace/WorkspaceRoot.tsx`                          |    42 | React component or typed UI module                                                      |
| `src/ui/patterns/workspace/WorkspaceSidePanel.test.tsx`                |   215 | The shared scheduler queues at most one next frame while subscribers remain active.     |
| `src/ui/patterns/workspace/WorkspaceSidePanel.tsx`                     |   219 | React component or typed UI module                                                      |
| `src/ui/primitives/AcrylicConfirmButton.tsx`                           |   103 | React component or typed UI module                                                      |
| `src/ui/primitives/AcrylicToggleButton.test.tsx`                       |   114 | Tests for the adjacent module                                                           |
| `src/ui/primitives/AcrylicToggleButton.tsx`                            |   103 | React component or typed UI module                                                      |
| `src/ui/primitives/AnimatedCheckbox.tsx`                               |    34 | React component or typed UI module                                                      |
| `src/ui/primitives/Button.tsx`                                         |   105 | React component or typed UI module                                                      |
| `src/ui/primitives/buttonMaterialControls.test.tsx`                    |   145 | Tests for the adjacent module                                                           |
| `src/ui/primitives/ContextMenu.test.tsx`                               |   152 | Tests for the adjacent module                                                           |
| `src/ui/primitives/ContextMenu.tsx`                                    |   210 | React component or typed UI module                                                      |
| `src/ui/primitives/ContextMenuParts.tsx`                               |   108 | React component or typed UI module                                                      |
| `src/ui/primitives/Field.tsx`                                          |    87 | React component or typed UI module                                                      |
| `src/ui/primitives/FormControls.tsx`                                   |   119 | React component or typed UI module                                                      |
| `src/ui/primitives/index.ts`                                           |    17 | TypeScript application module                                                           |
| `src/ui/primitives/Layout.tsx`                                         |   119 | React component or typed UI module                                                      |
| `src/ui/primitives/LiquidSelectionIndicator.tsx`                       |    89 | React component or typed UI module                                                      |
| `src/ui/primitives/LiquidTabs.motion.test.tsx`                         |   178 | A shared scheduler may enqueue the next frame while processing this one.                |
| `src/ui/primitives/LiquidTabs.tsx`                                     |    85 | React component or typed UI module                                                      |
| `src/ui/primitives/LiquidToggleSwitch.tsx`                             |   103 | React component or typed UI module                                                      |
| `src/ui/primitives/primitiveClassNames.ts`                             |     6 | TypeScript application module                                                           |
| `src/ui/primitives/primitives.test.tsx`                                |   137 | Tests for the adjacent module                                                           |
| `src/ui/primitives/SelectionControls.tsx`                              |   182 | React component or typed UI module                                                      |
| `src/ui/primitives/Status.tsx`                                         |   108 | React component or typed UI module                                                      |
| `src/ui/primitives/tabListBehavior.ts`                                 |    55 | TypeScript application module                                                           |
| `src/ui/primitives/Tabs.test.tsx`                                      |    69 | Tests for the adjacent module                                                           |
| `src/ui/primitives/Tabs.tsx`                                           |    58 | React component or typed UI module                                                      |
| `src/ui/primitives/Typography.tsx`                                     |    26 | React component or typed UI module                                                      |
| `src/ui/primitives/usePressSpringScale.ts`                             |    74 | TypeScript application module                                                           |
| `src/ui/theme/theme.test.tsx`                                          |    72 | Tests for the adjacent module                                                           |
| `src/ui/theme/workspaceVisualValues.ts`                                |    27 | TypeScript application module                                                           |
| `src/useClampedFixedPosition.ts`                                       |    36 | TypeScript application module                                                           |
| `src/utils/date.ts`                                                    |     5 | TypeScript application module                                                           |

<!-- GENERATED-INVENTORY:END -->
