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

Application composition, Redux store setup, command dispatch, selectors, and lifecycle coordination. `AppShell.tsx` remains thin. Phase 1 wires `AppShell.tsx` and `AppProviders.tsx` to the temporary `src/legacy/LegacyApplication.tsx` boundary; the older files already under `src/app/` remain legacy behavior references.

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

### `src/platform/`

Typed frontend boundary for database, media, settings, and structured workflow operations. Phase 1 provides interfaces and transport types only; no adapters call Tauri or the legacy backend yet. This is the only frontend area where new Tauri imports are allowed.

### `src/ui/`

Shared presentation primitives. `src/ui/materials/FrostedSurface.tsx` fixes the current production material tokens behind one reusable root class. Legacy surfaces remain unchanged until later parity-covered ports.

## Phase 1 architecture foundation

- `src/app/AppShell.tsx`, `AppProviders.tsx`, `store.ts`, and `hooks.ts` — composition-only shell and typed Redux access.
- `src/app/commands/` and `src/app/selectors/` — named command dispatch and selector boundaries.
- `src/domain/document/`, `commands/`, `history/`, and `ids/` — pure current-version contracts, schema entrypoint, invariants, and transaction types.
- `src/platform/database/`, `media/`, `settings/`, and `workflow/` — dependency-injected frontend client contracts without implementations.
- `src/elements/registry.ts` and `src/extensions/architectureRegistry.ts` — explicit target registries, initially empty.
- `src/legacy/LegacyApplication.tsx` — temporary behavior-preserving adapter to the existing `App.tsx`.
- `src/ui/materials/FrostedSurface.tsx` — shared retained frosted-glass primitive; not yet substituted into legacy panels.
- `docs/decisions/001-application-state-and-boundaries.md` — application-state and boundary rationale.

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

| File                                                | Lines | Responsibility                                                                |
| --------------------------------------------------- | ----: | ----------------------------------------------------------------------------- |
| `scripts/check-architecture.mjs`                    |   180 | Repository maintenance script                                                 |
| `scripts/check-version.mjs`                         |    56 | Repository maintenance script                                                 |
| `scripts/generate-baseline-fixtures.mjs`            |   115 | Repository maintenance script                                                 |
| `scripts/generate-codemap.mjs`                      |   103 | Repository maintenance script                                                 |
| `scripts/report-file-sizes.mjs`                     |    46 | Repository maintenance script                                                 |
| `src-tauri/src/commands.rs`                         |   558 | Rust backend module                                                           |
| `src-tauri/src/discord.rs`                          |   170 | / Holds the live Discord IPC connection. `None` when RPC is disabled or       |
| `src-tauri/src/error.rs`                            |   125 | Rust backend module                                                           |
| `src-tauri/src/images.rs`                           |   691 | / Longest edge (px) a raster image is downscaled to on import. Matches the    |
| `src-tauri/src/main.rs`                             |    98 | Register first so a duplicate process exits before other plugins              |
| `src-tauri/src/model.rs`                            |  1105 | Rust backend module                                                           |
| `src-tauri/src/portable.rs`                         |   309 | / The decrypted body of an export. Images are bundled so the file is portable |
| `src-tauri/src/storage.rs`                          |   722 | Rust backend module                                                           |
| `src-tauri/src/window_state.rs`                     |   105 | Clamp the saved geometry so the window can never restore off-screen or        |
| `src/App.tsx`                                       |  9007 | Latest image drop/paste handlers, refreshed each render so the once-mounted   |
| `src/app/appData.test.ts`                           |   355 | Tests for the adjacent module                                                 |
| `src/app/appData.ts`                                |   299 | TypeScript application module                                                 |
| `src/app/appDataSchema.ts`                          |   274 | TypeScript application module                                                 |
| `src/app/AppProviders.tsx`                          |    13 | React component or typed UI module                                            |
| `src/app/AppShell.test.tsx`                         |    39 | Tests for the adjacent module                                                 |
| `src/app/AppShell.tsx`                              |    11 | React component or typed UI module                                            |
| `src/app/canvasDocument.test.ts`                    |   122 | Tests for the adjacent module                                                 |
| `src/app/canvasDocument.ts`                         |    80 | TypeScript application module                                                 |
| `src/app/commandError.test.ts`                      |    24 | Tests for the adjacent module                                                 |
| `src/app/commandError.ts`                           |    74 | Compatibility with pre-structured backend errors while older builds or        |
| `src/app/commands/commandDispatcher.ts`             |    31 | TypeScript application module                                                 |
| `src/app/commands/commandTypes.ts`                  |    14 | TypeScript application module                                                 |
| `src/app/defaultData.ts`                            |    36 | TypeScript application module                                                 |
| `src/app/history.test.ts`                           |   161 | Tests for the adjacent module                                                 |
| `src/app/history.ts`                                |    88 | TypeScript application module                                                 |
| `src/app/hooks.ts`                                  |     6 | TypeScript application module                                                 |
| `src/app/selectors/applicationSelectors.ts`         |     5 | TypeScript application module                                                 |
| `src/app/store.ts`                                  |    30 | TypeScript application module                                                 |
| `src/canvasMath.test.ts`                            |   159 | Tests for the adjacent module                                                 |
| `src/canvasMath.ts`                                 |   128 | TypeScript application module                                                 |
| `src/components/CanvasManager.tsx`                  |  1089 | Pointer capture is best-effort; document listeners still clean up the drag.   |
| `src/components/ColorPickerMenu.tsx`                |   338 | React component or typed UI module                                            |
| `src/components/CommandRunnerModals.test.tsx`       |   141 | Tests for the adjacent module                                                 |
| `src/components/CommandRunnerModals.tsx`            |   612 | React component or typed UI module                                            |
| `src/components/ContainerJsonEditorWindow.test.tsx` |    34 | Tests for the adjacent module                                                 |
| `src/components/ContainerJsonEditorWindow.tsx`      |   257 | React component or typed UI module                                            |
| `src/components/ContainerNode.tsx`                  |   877 | React component or typed UI module                                            |
| `src/components/ContextMenus.test.tsx`              |   224 | Tests for the adjacent module                                                 |
| `src/components/ContextMenus.tsx`                   |  1144 | React component or typed UI module                                            |
| `src/components/ExtensionDropEffect.tsx`            |   203 | React component or typed UI module                                            |
| `src/components/ExtensionsPanel.test.tsx`           |    34 | Tests for the adjacent module                                                 |
| `src/components/ExtensionsPanel.tsx`                |   587 | React component or typed UI module                                            |
| `src/components/FloatingToolbar.tsx`                |   131 | React component or typed UI module                                            |
| `src/components/FpsCounter.tsx`                     |    17 | React component or typed UI module                                            |
| `src/components/FrostedGlassTuner.tsx`              |   179 | React component or typed UI module                                            |
| `src/components/ImageNode.tsx`                      |   142 | Background extension off: only show the image, no frame/border/shell, so a    |
| `src/components/MarkdownContent.tsx`                |    92 | React component or typed UI module                                            |
| `src/components/MindmapConnections.test.tsx`        |    44 | Tests for the adjacent module                                                 |
| `src/components/MindmapConnections.tsx`             |   109 | React component or typed UI module                                            |
| `src/components/MindmapConnectors.test.tsx`         |    30 | Tests for the adjacent module                                                 |
| `src/components/MindmapConnectors.tsx`              |    56 | React component or typed UI module                                            |
| `src/components/Minimap.tsx`                        |   209 | React component or typed UI module                                            |
| `src/components/Modals.test.tsx`                    |    99 | Tests for the adjacent module                                                 |
| `src/components/Modals.tsx`                         |   941 | React component or typed UI module                                            |
| `src/components/TextBlockNode.tsx`                  |   561 | React component or typed UI module                                            |
| `src/components/TextCardNode.test.tsx`              |   246 | Tests for the adjacent module                                                 |
| `src/components/TextCardNode.tsx`                   |   482 | React component or typed UI module                                            |
| `src/components/ToastStack.tsx`                     |    53 | React component or typed UI module                                            |
| `src/constants.ts`                                  |    58 | TypeScript application module                                                 |
| `src/domain/commands/commandResult.ts`              |    22 | TypeScript application module                                                 |
| `src/domain/commands/domainCommand.ts`              |     5 | TypeScript application module                                                 |
| `src/domain/document/documentInvariants.ts`         |    82 | TypeScript application module                                                 |
| `src/domain/document/documentSchema.ts`             |    66 | TypeScript application module                                                 |
| `src/domain/document/documentTypes.ts`              |    48 | TypeScript application module                                                 |
| `src/domain/document/domainFoundation.test.ts`      |    27 | @vitest-environment node                                                      |
| `src/domain/history/historyTypes.ts`                |     9 | TypeScript application module                                                 |
| `src/domain/history/transactionTypes.ts`            |    11 | TypeScript application module                                                 |
| `src/domain/ids/entityIds.ts`                       |    25 | TypeScript application module                                                 |
| `src/elements/architectureRegistries.test.ts`       |    21 | Tests for the adjacent module                                                 |
| `src/elements/elementDefinition.ts`                 |    31 | TypeScript application module                                                 |
| `src/elements/registry.ts`                          |    12 | TypeScript application module                                                 |
| `src/extensions/architectureRegistry.ts`            |    12 | TypeScript application module                                                 |
| `src/extensions/copyPasteJson.test.ts`              |   216 | Tests for the adjacent module                                                 |
| `src/extensions/copyPasteJson.ts`                   |   171 | TypeScript application module                                                 |
| `src/extensions/extensionDefinition.ts`             |    20 | TypeScript application module                                                 |
| `src/extensions/registry.test.ts`                   |    55 | Tests for the adjacent module                                                 |
| `src/extensions/registry.ts`                        |   203 | TypeScript application module                                                 |
| `src/extensions/useExtensionDrag.ts`                |   117 | TypeScript application module                                                 |
| `src/hooks/useAppUpdates.ts`                        |   183 | TypeScript application module                                                 |
| `src/hooks/useAutosave.test.tsx`                    |    77 | Tests for the adjacent module                                                 |
| `src/hooks/useAutosave.ts`                          |    79 | This hook deliberately accepts the caller's dependency list, matching         |
| `src/hooks/useCanvasDocument.test.tsx`              |    64 | Tests for the adjacent module                                                 |
| `src/hooks/useCanvasDocument.ts`                    |   195 | TypeScript application module                                                 |
| `src/hooks/useDiscordRpc.ts`                        |    35 | TypeScript application module                                                 |
| `src/hooks/useFrameStats.ts`                        |    65 | TypeScript application module                                                 |
| `src/hooks/useImageCache.test.tsx`                  |   216 | Tests for the adjacent module                                                 |
| `src/hooks/useImageCache.ts`                        |   264 | TypeScript application module                                                 |
| `src/legacy/LegacyApplication.tsx`                  |     6 | React component or typed UI module                                            |
| `src/main.tsx`                                      |    11 | TypeScript application module                                                 |
| `src/mindmapMath.test.ts`                           |    42 | Tests for the adjacent module                                                 |
| `src/mindmapMath.ts`                                |    83 | TypeScript application module                                                 |
| `src/platform/database/databaseClient.ts`           |    19 | TypeScript application module                                                 |
| `src/platform/database/databaseTypes.ts`            |    35 | TypeScript application module                                                 |
| `src/platform/media/mediaClient.ts`                 |    10 | TypeScript application module                                                 |
| `src/platform/media/mediaTypes.ts`                  |    17 | TypeScript application module                                                 |
| `src/platform/platformErrors.ts`                    |    20 | TypeScript application module                                                 |
| `src/platform/settings/settingsClient.ts`           |     8 | TypeScript application module                                                 |
| `src/platform/settings/settingsTypes.ts`            |    19 | TypeScript application module                                                 |
| `src/platform/workflow/workflowClient.ts`           |    10 | TypeScript application module                                                 |
| `src/platform/workflow/workflowTypes.ts`            |    20 | TypeScript application module                                                 |
| `src/test/setup.ts`                                 |     2 | TypeScript application module                                                 |
| `src/types.ts`                                      |   418 | TypeScript application module                                                 |
| `src/ui/materials/FrostedSurface.test.tsx`          |    22 | Tests for the adjacent module                                                 |
| `src/ui/materials/FrostedSurface.tsx`               |    15 | React component or typed UI module                                            |
| `src/ui/materials/frostedSurfaceTypes.ts`           |     6 | TypeScript application module                                                 |
| `src/useClampedFixedPosition.ts`                    |    36 | TypeScript application module                                                 |
| `src/utils/date.ts`                                 |     5 | TypeScript application module                                                 |

<!-- GENERATED-INVENTORY:END -->
