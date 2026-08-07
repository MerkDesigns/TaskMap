# TaskMap Code Map

This file is the high-level navigation entrypoint for Codex and human contributors. Read it before opening broad parts of the repository. Update it whenever files or subsystem ownership change.

## Governing documents

- `AGENTS.md` — Mandatory implementation, dependency, security, performance, and file-size rules.
- `ARCHITECTURE.md` — Normative target architecture and runtime boundaries.
- `docs/REFACTOR-ROADMAP.md` — Ordered implementation phases and exit criteria.
- `docs/FEATURE-PARITY.md` — Retained, redesigned, and removed user-facing behavior.
- `docs/FEATURE-WIRING.md` — Exact process for adding elements, extensions, features, and platform operations.
- `docs/DATA-FORMAT.md` — New `.tmapdb` SQLite envelope and encrypted document model.
- `docs/SECURITY.md` — Password, key, lock, media privacy, logging, and workflow security.
- `docs/TESTING.md` — Test layers, fixtures, performance budgets, and phase gates.
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

Viewport rendering, geometry, snapping, culling, layers, and transient interaction controllers.

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

Shared presentation primitives. `src/ui/materials/FrostedSurface.tsx` fixes the current production material tokens behind one reusable root class. Legacy surfaces remain unchanged until later parity-covered ports.

## Phase 1 architecture foundation

- `src/app/interactions/` - read-only transient interaction snapshot/subscription contract, idle default, provider, and typed hooks; no legacy pointer behavior is moved.
- `src/app/errors/` - typed new-architecture render-failure reporting and deterministic error boundary; legacy errors remain outside it.

- `src/app/AppShell.tsx`, `AppProviders.tsx`, `store.ts`, and `hooks.ts` — composition-only shell and typed Redux access.
- `src/app/commands/` and `src/app/selectors/` — named command dispatch and selector boundaries.
- `src/domain/document/`, `commands/`, `history/`, and `ids/` — pure current-version contracts, schema entrypoint, invariants, and transaction types.
- `src/platform/database/`, `media/`, `settings/`, and `workflow/` — dependency-injected frontend client contracts without implementations.
- `src/elements/registry.ts` and `src/extensions/architectureRegistry.ts` — explicit target registries, initially empty.
- `src/legacy/LegacyApplication.tsx` — temporary behavior-preserving adapter to the existing `App.tsx`.
- `src/ui/materials/FrostedSurface.tsx` — shared retained frosted-glass primitive; not yet substituted into legacy panels.
- `docs/decisions/001-application-state-and-boundaries.md` — application-state and boundary rationale.

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

| File                                                              | Lines | Responsibility                                                                  |
| ----------------------------------------------------------------- | ----: | ------------------------------------------------------------------------------- |
| `scripts/check-architecture.mjs`                                  |   236 | Repository maintenance script                                                   |
| `scripts/check-phase2-production-exclusion.mjs`                   |    62 | Repository maintenance script                                                   |
| `scripts/check-version.mjs`                                       |    56 | Repository maintenance script                                                   |
| `scripts/generate-baseline-fixtures.mjs`                          |   115 | Repository maintenance script                                                   |
| `scripts/generate-codemap.mjs`                                    |   103 | Repository maintenance script                                                   |
| `scripts/report-file-sizes.mjs`                                   |    46 | Repository maintenance script                                                   |
| `src-tauri/src/commands.rs`                                       |   566 | Rust backend module                                                             |
| `src-tauri/src/commands/database_command_types.rs`                |    65 | Rust backend module                                                             |
| `src-tauri/src/commands/database_commands.rs`                     |   302 | Rust backend module                                                             |
| `src-tauri/src/commands/database_window_commands.rs`              |   179 | Rust backend module                                                             |
| `src-tauri/src/commands/phase2_ipc.rs`                            |    51 | Rust backend module                                                             |
| `src-tauri/src/crypto/document_cipher.rs`                         |   140 | Rust backend module                                                             |
| `src-tauri/src/crypto/key_derivation.rs`                          |   106 | Rust backend module                                                             |
| `src-tauri/src/crypto/mod.rs`                                     |     4 | Rust backend module                                                             |
| `src-tauri/src/crypto/secret_key.rs`                              |    43 | Rust backend module                                                             |
| `src-tauri/src/database/backup_repository.rs`                     |    94 | Rust backend module                                                             |
| `src-tauri/src/database/connection.rs`                            |   124 | Rust backend module                                                             |
| `src-tauri/src/database/document_repository.rs`                   |   182 | Rust backend module                                                             |
| `src-tauri/src/database/envelope_validation.rs`                   |   254 | Rust backend module                                                             |
| `src-tauri/src/database/limits.rs`                                |   101 | Rust backend module                                                             |
| `src-tauri/src/database/media_repository.rs`                      |   152 | Rust backend module                                                             |
| `src-tauri/src/database/mod.rs`                                   |    10 | The repository is exercised now; its streaming platform adapter is Phase 5.     |
| `src-tauri/src/database/schema.rs`                                |   138 | Rust backend module                                                             |
| `src-tauri/src/discord.rs`                                        |   170 | / Holds the live Discord IPC connection. `None` when RPC is disabled or         |
| `src-tauri/src/error.rs`                                          |   125 | Rust backend module                                                             |
| `src-tauri/src/files/database_lock.rs`                            |   324 | Diagnostic metadata is deliberately best-effort. Only the OS lock               |
| `src-tauri/src/files/database_path_authorization.rs`              |   330 | Rust backend module                                                             |
| `src-tauri/src/files/mod.rs`                                      |     3 | Rust backend module                                                             |
| `src-tauri/src/images.rs`                                         |   691 | / Longest edge (px) a raster image is downscaled to on import. Matches the      |
| `src-tauri/src/main.rs`                                           |   160 | Register first so a duplicate process exits before other plugins                |
| `src-tauri/src/model.rs`                                          |  1105 | Rust backend module                                                             |
| `src-tauri/src/phase2_error.rs`                                   |   184 | Rust backend module                                                             |
| `src-tauri/src/portable.rs`                                       |   309 | / The decrypted body of an export. Images are bundled so the file is portable   |
| `src-tauri/src/session/database_session.rs`                       |   269 | Rust backend module                                                             |
| `src-tauri/src/session/mod.rs`                                    |    23 | Rust backend module                                                             |
| `src-tauri/src/session/phase2_concurrency_recovery_tests.rs`      |   242 | Rust backend module                                                             |
| `src-tauri/src/session/phase2_tests.rs`                           |   368 | Rust backend module                                                             |
| `src-tauri/src/session/session_key_state.rs`                      |    96 | Rust backend module                                                             |
| `src-tauri/src/session/session_lifecycle.rs`                      |    93 | Rust backend module                                                             |
| `src-tauri/src/session/session_opening.rs`                        |   245 | Rust backend module                                                             |
| `src-tauri/src/session/session_state_access.rs`                   |    52 | Rust backend module                                                             |
| `src-tauri/src/session/session_support.rs`                        |    82 | Rust backend module                                                             |
| `src-tauri/src/session/session_types.rs`                          |   104 | Rust backend module                                                             |
| `src-tauri/src/settings/mod.rs`                                   |     2 | Rust backend module                                                             |
| `src-tauri/src/settings/recent_databases.rs`                      |   193 | Rust backend module                                                             |
| `src-tauri/src/storage.rs`                                        |   722 | Rust backend module                                                             |
| `src-tauri/src/window_state.rs`                                   |   105 | Clamp the saved geometry so the window can never restore off-screen or          |
| `src/App.tsx`                                                     |  9012 | Latest image drop/paste handlers, refreshed each render so the once-mounted     |
| `src/app/appData.test.ts`                                         |   355 | Tests for the adjacent module                                                   |
| `src/app/appData.ts`                                              |   299 | TypeScript application module                                                   |
| `src/app/appDataSchema.ts`                                        |   274 | TypeScript application module                                                   |
| `src/app/AppProviders.tsx`                                        |    28 | React component or typed UI module                                              |
| `src/app/AppShell.test.tsx`                                       |    65 | Tests for the adjacent module                                                   |
| `src/app/AppShell.tsx`                                            |    32 | React component or typed UI module                                              |
| `src/app/canvasDocument.test.ts`                                  |   122 | Tests for the adjacent module                                                   |
| `src/app/canvasDocument.ts`                                       |    80 | TypeScript application module                                                   |
| `src/app/commandError.test.ts`                                    |    24 | Tests for the adjacent module                                                   |
| `src/app/commandError.ts`                                         |    74 | Compatibility with pre-structured backend errors while older builds or          |
| `src/app/commands/commandDispatcher.test.ts`                      |    28 | @vitest-environment node                                                        |
| `src/app/commands/commandDispatcher.ts`                           |    18 | TypeScript application module                                                   |
| `src/app/commands/commandTypes.ts`                                |    12 | TypeScript application module                                                   |
| `src/app/defaultData.ts`                                          |    36 | TypeScript application module                                                   |
| `src/app/errors/ApplicationErrorBoundary.test.tsx`                |    62 | Tests for the adjacent module                                                   |
| `src/app/errors/ApplicationErrorBoundary.tsx`                     |    44 | React component or typed UI module                                              |
| `src/app/errors/applicationErrorReporter.test.ts`                 |    27 | Tests for the adjacent module                                                   |
| `src/app/errors/applicationErrorReporter.ts`                      |    27 | Deliberately omit the error message, stack, and component data: they may        |
| `src/app/history.test.ts`                                         |   161 | Tests for the adjacent module                                                   |
| `src/app/history.ts`                                              |    88 | TypeScript application module                                                   |
| `src/app/hooks.ts`                                                |     6 | TypeScript application module                                                   |
| `src/app/interactions/TransientInteractionProvider.test.tsx`      |    68 | Tests for the adjacent module                                                   |
| `src/app/interactions/TransientInteractionProvider.tsx`           |    26 | React component or typed UI module                                              |
| `src/app/interactions/transientInteractionService.ts`             |    32 | TypeScript application module                                                   |
| `src/app/interactions/useTransientInteraction.ts`                 |    20 | TypeScript application module                                                   |
| `src/app/persistence/documentPersistenceCoordinator.test.ts`      |   162 | @vitest-environment node                                                        |
| `src/app/persistence/documentPersistenceCoordinator.ts`           |   207 | TypeScript application module                                                   |
| `src/app/persistence/documentPersistenceFailures.test.ts`         |   201 | @vitest-environment node                                                        |
| `src/app/persistence/persistenceErrors.ts`                        |    36 | TypeScript application module                                                   |
| `src/app/persistence/persistenceScheduler.ts`                     |    16 | TypeScript application module                                                   |
| `src/app/selectors/applicationSelectors.ts`                       |     5 | TypeScript application module                                                   |
| `src/app/selectors/workspaceSelectors.test.ts`                    |    68 | @vitest-environment node                                                        |
| `src/app/selectors/workspaceSelectors.ts`                         |    35 | TypeScript application module                                                   |
| `src/app/store.ts`                                                |    67 | TypeScript application module                                                   |
| `src/app/windowCloseCoordinator.ts`                               |    15 | TypeScript application module                                                   |
| `src/app/workspace/workspaceCommandsHistory.test.ts`              |   199 | @vitest-environment node                                                        |
| `src/app/workspace/workspaceInitialization.test.ts`               |   100 | @vitest-environment node                                                        |
| `src/app/workspace/workspaceOperations.ts`                        |   146 | TypeScript application module                                                   |
| `src/app/workspace/workspaceSlice.ts`                             |   157 | TypeScript application module                                                   |
| `src/app/workspace/workspaceTestSupport.ts`                       |    96 | TypeScript application module                                                   |
| `src/app/workspace/workspaceTypes.ts`                             |    67 | TypeScript application module                                                   |
| `src/canvasMath.test.ts`                                          |   159 | Tests for the adjacent module                                                   |
| `src/canvasMath.ts`                                               |   128 | TypeScript application module                                                   |
| `src/components/CanvasManager.tsx`                                |  1089 | Pointer capture is best-effort; document listeners still clean up the drag.     |
| `src/components/ColorPickerMenu.tsx`                              |   338 | React component or typed UI module                                              |
| `src/components/CommandRunnerModals.test.tsx`                     |   141 | Tests for the adjacent module                                                   |
| `src/components/CommandRunnerModals.tsx`                          |   612 | React component or typed UI module                                              |
| `src/components/ContainerJsonEditorWindow.test.tsx`               |    34 | Tests for the adjacent module                                                   |
| `src/components/ContainerJsonEditorWindow.tsx`                    |   257 | React component or typed UI module                                              |
| `src/components/ContainerNode.tsx`                                |   877 | React component or typed UI module                                              |
| `src/components/ContextMenus.test.tsx`                            |   224 | Tests for the adjacent module                                                   |
| `src/components/ContextMenus.tsx`                                 |  1144 | React component or typed UI module                                              |
| `src/components/ExtensionDropEffect.tsx`                          |   203 | React component or typed UI module                                              |
| `src/components/ExtensionsPanel.test.tsx`                         |    34 | Tests for the adjacent module                                                   |
| `src/components/ExtensionsPanel.tsx`                              |   587 | React component or typed UI module                                              |
| `src/components/FloatingToolbar.tsx`                              |   131 | React component or typed UI module                                              |
| `src/components/FpsCounter.tsx`                                   |    17 | React component or typed UI module                                              |
| `src/components/FrostedGlassTuner.tsx`                            |   179 | React component or typed UI module                                              |
| `src/components/ImageNode.tsx`                                    |   142 | Background extension off: only show the image, no frame/border/shell, so a      |
| `src/components/MarkdownContent.tsx`                              |    92 | React component or typed UI module                                              |
| `src/components/MindmapConnections.test.tsx`                      |    44 | Tests for the adjacent module                                                   |
| `src/components/MindmapConnections.tsx`                           |   109 | React component or typed UI module                                              |
| `src/components/MindmapConnectors.test.tsx`                       |    30 | Tests for the adjacent module                                                   |
| `src/components/MindmapConnectors.tsx`                            |    56 | React component or typed UI module                                              |
| `src/components/Minimap.tsx`                                      |   209 | React component or typed UI module                                              |
| `src/components/Modals.test.tsx`                                  |    99 | Tests for the adjacent module                                                   |
| `src/components/Modals.tsx`                                       |   941 | React component or typed UI module                                              |
| `src/components/TextBlockNode.tsx`                                |   561 | React component or typed UI module                                              |
| `src/components/TextCardNode.test.tsx`                            |   246 | Tests for the adjacent module                                                   |
| `src/components/TextCardNode.tsx`                                 |   482 | React component or typed UI module                                              |
| `src/components/ToastStack.tsx`                                   |    53 | React component or typed UI module                                              |
| `src/constants.ts`                                                |    58 | TypeScript application module                                                   |
| `src/domain/commands/commandExecution.stress.test.ts`             |    44 | @vitest-environment node                                                        |
| `src/domain/commands/commandExecution.test.ts`                    |   204 | @vitest-environment node                                                        |
| `src/domain/commands/commandHandler.ts`                           |    43 | TypeScript application module                                                   |
| `src/domain/commands/commandRegistry.ts`                          |    29 | TypeScript application module                                                   |
| `src/domain/commands/commandResult.ts`                            |    32 | TypeScript application module                                                   |
| `src/domain/commands/commandTestSupport.ts`                       |    38 | TypeScript application module                                                   |
| `src/domain/commands/core/canvasCommands.test.ts`                 |   121 | @vitest-environment node                                                        |
| `src/domain/commands/core/canvasCommands.ts`                      |   132 | TypeScript application module                                                   |
| `src/domain/commands/core/connectionCommands.test.ts`             |   110 | @vitest-environment node                                                        |
| `src/domain/commands/core/connectionCommands.ts`                  |    72 | TypeScript application module                                                   |
| `src/domain/commands/core/coreDocumentCommandHandlers.test.ts`    |    33 | @vitest-environment node                                                        |
| `src/domain/commands/core/coreDocumentCommandHandlers.ts`         |    17 | TypeScript application module                                                   |
| `src/domain/commands/core/documentSettingsCommands.ts`            |    51 | TypeScript application module                                                   |
| `src/domain/commands/core/elementCommands.test.ts`                |   131 | @vitest-environment node                                                        |
| `src/domain/commands/core/elementCommands.ts`                     |   125 | TypeScript application module                                                   |
| `src/domain/commands/core/extensionCommands.ts`                   |   104 | TypeScript application module                                                   |
| `src/domain/commands/core/mediaCommands.ts`                       |    59 | TypeScript application module                                                   |
| `src/domain/commands/core/mediaExtensionSettingsCommands.test.ts` |   169 | @vitest-environment node                                                        |
| `src/domain/commands/currentDocumentValidation.test.ts`           |   146 | @vitest-environment node                                                        |
| `src/domain/commands/domainCommand.ts`                            |     5 | TypeScript application module                                                   |
| `src/domain/commands/executeDocumentCommand.ts`                   |   121 | TypeScript application module                                                   |
| `src/domain/document/createDocument.test.ts`                      |    29 | @vitest-environment node                                                        |
| `src/domain/document/createDocument.ts`                           |    43 | TypeScript application module                                                   |
| `src/domain/document/documentInvariants.test.ts`                  |   160 | @vitest-environment node                                                        |
| `src/domain/document/documentInvariants.ts`                       |    44 | TypeScript application module                                                   |
| `src/domain/document/documentLimits.ts`                           |    20 | TypeScript application module                                                   |
| `src/domain/document/documentSchema.test.ts`                      |   201 | @vitest-environment node                                                        |
| `src/domain/document/documentSchema.ts`                           |   226 | TypeScript application module                                                   |
| `src/domain/document/documentTestFixtures.ts`                     |   129 | TypeScript application module                                                   |
| `src/domain/document/documentTypes.ts`                            |   108 | TypeScript application module                                                   |
| `src/domain/document/documentVersion.ts`                          |     3 | The decrypted document version is independent from the SQLite envelope version. |
| `src/domain/document/invariants/canvasInvariants.ts`              |   130 | TypeScript application module                                                   |
| `src/domain/document/invariants/connectionInvariants.ts`          |    55 | TypeScript application module                                                   |
| `src/domain/document/invariants/entityRecordInvariants.ts`        |    56 | TypeScript application module                                                   |
| `src/domain/document/invariants/extensionInvariants.ts`           |    52 | TypeScript application module                                                   |
| `src/domain/document/jsonDeepEqual.test.ts`                       |    75 | @vitest-environment node                                                        |
| `src/domain/document/jsonDeepEqual.ts`                            |    84 | TypeScript application module                                                   |
| `src/domain/document/jsonSafety.ts`                               |   172 | TypeScript application module                                                   |
| `src/domain/document/validateDocument.ts`                         |    36 | TypeScript application module                                                   |
| `src/domain/history/historyCompatibility.test.ts`                 |    91 | @vitest-environment node                                                        |
| `src/domain/history/historyEngine.test.ts`                        |   187 | @vitest-environment node                                                        |
| `src/domain/history/historyEngine.ts`                             |   131 | TypeScript application module                                                   |
| `src/domain/history/historyTypes.ts`                              |    20 | TypeScript application module                                                   |
| `src/domain/history/immerPatchSupport.ts`                         |    10 | TypeScript application module                                                   |
| `src/domain/history/transactionTypes.ts`                          |    11 | TypeScript application module                                                   |
| `src/domain/ids/entityIds.test.ts`                                |    29 | @vitest-environment node                                                        |
| `src/domain/ids/entityIds.ts`                                     |    74 | TypeScript application module                                                   |
| `src/elements/architectureRegistries.test.ts`                     |    21 | Tests for the adjacent module                                                   |
| `src/elements/elementDefinition.ts`                               |    31 | TypeScript application module                                                   |
| `src/elements/registry.ts`                                        |    12 | TypeScript application module                                                   |
| `src/extensions/architectureRegistry.ts`                          |    12 | TypeScript application module                                                   |
| `src/extensions/copyPasteJson.test.ts`                            |   216 | Tests for the adjacent module                                                   |
| `src/extensions/copyPasteJson.ts`                                 |   171 | TypeScript application module                                                   |
| `src/extensions/extensionDefinition.ts`                           |    20 | TypeScript application module                                                   |
| `src/extensions/registry.test.ts`                                 |    55 | Tests for the adjacent module                                                   |
| `src/extensions/registry.ts`                                      |   203 | TypeScript application module                                                   |
| `src/extensions/useExtensionDrag.ts`                              |   117 | TypeScript application module                                                   |
| `src/features/phase2-database/DevelopmentPhase2Entry.test.tsx`    |    14 | Tests for the adjacent module                                                   |
| `src/features/phase2-database/DevelopmentPhase2Entry.tsx`         |    35 | React component or typed UI module                                              |
| `src/features/phase2-database/Phase2DatabaseHarness.tsx`          |   236 | React component or typed UI module                                              |
| `src/features/phase2-database/Phase2DatabasePathControls.tsx`     |    74 | React component or typed UI module                                              |
| `src/features/phase2-database/phase2Document.ts`                  |    74 | TypeScript application module                                                   |
| `src/features/phase2-database/Phase2HarnessHeader.tsx`            |    20 | React component or typed UI module                                              |
| `src/features/phase2-database/phase2HarnessState.test.ts`         |    59 | Tests for the adjacent module                                                   |
| `src/features/phase2-database/phase2HarnessState.ts`              |    58 | TypeScript application module                                                   |
| `src/features/phase2-database/Phase2HarnessStatus.tsx`            |    22 | React component or typed UI module                                              |
| `src/features/phase2-database/phase2HarnessTypes.ts`              |     9 | TypeScript application module                                                   |
| `src/features/phase2-database/phase2LockOperation.test.ts`        |    68 | Tests for the adjacent module                                                   |
| `src/features/phase2-database/phase2LockOperation.ts`             |    23 | TypeScript application module                                                   |
| `src/features/phase2-database/Phase2SessionActions.tsx`           |   145 | React component or typed UI module                                              |
| `src/hooks/useAppUpdates.ts`                                      |   183 | TypeScript application module                                                   |
| `src/hooks/useAutosave.test.tsx`                                  |    77 | Tests for the adjacent module                                                   |
| `src/hooks/useAutosave.ts`                                        |    79 | This hook deliberately accepts the caller's dependency list, matching           |
| `src/hooks/useCanvasDocument.test.tsx`                            |    64 | Tests for the adjacent module                                                   |
| `src/hooks/useCanvasDocument.ts`                                  |   195 | TypeScript application module                                                   |
| `src/hooks/useDiscordRpc.ts`                                      |    35 | TypeScript application module                                                   |
| `src/hooks/useFrameStats.ts`                                      |    65 | TypeScript application module                                                   |
| `src/hooks/useImageCache.test.tsx`                                |   216 | Tests for the adjacent module                                                   |
| `src/hooks/useImageCache.ts`                                      |   264 | TypeScript application module                                                   |
| `src/legacy/LegacyApplication.tsx`                                |    10 | React component or typed UI module                                              |
| `src/main.tsx`                                                    |    11 | TypeScript application module                                                   |
| `src/mindmapMath.test.ts`                                         |    42 | Tests for the adjacent module                                                   |
| `src/mindmapMath.ts`                                              |    83 | TypeScript application module                                                   |
| `src/platform/database/databaseClient.ts`                         |    25 | TypeScript application module                                                   |
| `src/platform/database/databaseDocumentCodec.ts`                  |    37 | TypeScript application module                                                   |
| `src/platform/database/databaseTypes.ts`                          |    55 | TypeScript application module                                                   |
| `src/platform/database/tauriDatabaseClient.test.ts`               |   160 | Tests for the adjacent module                                                   |
| `src/platform/database/tauriDatabaseClient.ts`                    |   178 | TypeScript application module                                                   |
| `src/platform/media/mediaClient.ts`                               |    10 | TypeScript application module                                                   |
| `src/platform/media/mediaTypes.ts`                                |    17 | TypeScript application module                                                   |
| `src/platform/platformErrors.ts`                                  |    30 | TypeScript application module                                                   |
| `src/platform/settings/settingsClient.ts`                         |    14 | TypeScript application module                                                   |
| `src/platform/settings/settingsTypes.ts`                          |    14 | TypeScript application module                                                   |
| `src/platform/settings/tauriSettingsClient.ts`                    |    16 | TypeScript application module                                                   |
| `src/platform/tauriInvoke.ts`                                     |    72 | TypeScript application module                                                   |
| `src/platform/workflow/workflowClient.ts`                         |    10 | TypeScript application module                                                   |
| `src/platform/workflow/workflowTypes.ts`                          |    20 | TypeScript application module                                                   |
| `src/test/setup.ts`                                               |     2 | TypeScript application module                                                   |
| `src/types.ts`                                                    |   418 | TypeScript application module                                                   |
| `src/ui/materials/FrostedSurface.test.tsx`                        |    22 | Tests for the adjacent module                                                   |
| `src/ui/materials/FrostedSurface.tsx`                             |    15 | React component or typed UI module                                              |
| `src/ui/materials/frostedSurfaceTypes.ts`                         |     6 | TypeScript application module                                                   |
| `src/useClampedFixedPosition.ts`                                  |    36 | TypeScript application module                                                   |
| `src/utils/date.ts`                                               |     5 | TypeScript application module                                                   |

<!-- GENERATED-INVENTORY:END -->
