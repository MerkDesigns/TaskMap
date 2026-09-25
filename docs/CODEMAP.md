# TaskMap Code Map

Current ownership and navigation only. Source-level inventory is generated below; implementation
history is preserved in Git and WORK-LOG.md. This map does not override subsystem contracts.

## Governing documents

- `AGENTS.md` and `ARCHITECTURE.md` — global boundaries and implementation rules.
- `docs/AI-WORKFLOW.md` — scoped authority and cross-session workflow.
- `docs/REFACTOR-STATE.md` and `docs/REFACTOR-ROADMAP.md` — current status and next gates.
- `docs/UI-SYSTEM-CONTRACT.md` — Surface/Material/Content architecture and development workbench.
- `docs/GLASS-SYSTEM-CONTRACT.md` — material behavior, rendering proof and acceptance.
- `docs/UI-QUALITY-GUARDRAILS.md` — shared controls, dialogs, scrollbars and hit targets.
- `docs/decisions/006-final-ui-glass-contract-reset.md` — explicit UI/glass supersession.
- `docs/FEATURE-PARITY.md` and `docs/FEATURE-WIRING.md` — retained behavior and feature integration.
- `docs/SECURITY.md` and `docs/DATA-FORMAT.md` — security and persisted format.
- `docs/TESTING.md` — automated/native/visual/performance gates.
- `docs/BASELINE-CAPTURE.md` and `docs/WORK-LOG.md` — baseline evidence and chronological history.

## Production application ownership

- `src/app/AppShell.tsx` — composition, error boundaries and current development-entry gates.
- `src/app/database/DatabaseApplication.tsx` — one renderer-lifetime runtime, session gate and
  guarded window close/fallback.
- `src/app/database/createTauriDatabaseSessionController.ts` — native factory and revocation wiring.
- `src/app/database/createApplicationDatabaseRuntime.ts` and `databaseRuntimeResources.ts` —
  workspace/session, callbacks, preferences, remembered views, privacy and media resource ownership.
- `src/app/database/createDatabaseSessionController.ts` — serialized lifecycle operations, epoch
  cancellation, admission, save flushing, revocation and disposal. Keep independent future
  responsibilities in collaborators.
- `src/app/database/createDatabaseWorkspace.ts` and `acceptRetainedDocument.ts` — confirmed-load
  composition and fail-closed feature-data admission.
- `src/app/workspace/`, `src/app/commands/`, `src/app/selectors/` and `src/app/persistence/` —
  normalized store, named transactions/history, selectors and revision-aware deferred saves.
- `src/domain/` — pure document/schema/invariant/command/history/ID contracts.
- `src/app/preferences/` — separate device preferences, encrypted remembered views and privacy.
- `src/app/media/createSessionMediaResources.ts` — bounded lazy loads, URL leases, cancellation
  and session cleanup; media bytes never enter Redux.

The database runtime is mounted in production. ADRs 004/005 document current ownership, not a pending
cutover. Packaged stable/Dev coexistence remains an acceptance gate.

## Interaction and retained presentation

- `src/app/interactions/` — transient pointer/camera controllers and semantic completion ports.
- `src/canvas/` — pure geometry and viewport/culling calculations.
- `src/app/view-projection/createRetainedCanvasBinding.ts` — mounted retained-view/interaction binding.
- `src/app/view-projection/createRetainedCanvasProjection.ts` and adjacent projectors — cached
  immutable projections, cleared by the runtime on revocation.
- `src/legacy/RetainedCanvasApplication.tsx`, `src/App.tsx` and `src/components/` — retained
  presentation bridge and current feature views. They are not the production persistence owner.
- `src/elements/` — typed models, schemas and retained projections. Full renderer ownership moves
  in Phase 5: Text Card, Container, Text Block, Image/GIF, Mind-map.
- `src/extensions/architectureRegistry.ts` and adjacent extension modules — explicit retained
  definitions/configuration/compatibility. Legacy `src/extensions/registry.ts` is reference code.

## UI/material implementation and next boundary

- `src/ui/materials/MaterialSurface.tsx` — current public material boundary.
- `materialDefinitions.ts`, `materialRegistry.ts`, `nativeGlassRecipe.css` — current shared recipes.
- `nativeGlassGeometry.ts`, `materialGeometryScheduler.ts`, `materialGeometryInvalidation.ts` —
  current geometry/rim measurement and scheduling.
- `SharedSmallGlassPlane.tsx` and `src/ui/patterns/workspace/` — current shared Minor batches,
  list geometry and chrome patterns. Existing flat clipping is not the final shrinking-material rule.
- `src/ui/motion/` — shared frame scheduling and current motion controllers.
- `src/ui/primitives/`, `src/ui/patterns/`, `src/ui/theme/` — reusable controls, compositions and tokens.
- `src/app/development/` — DEV-only App/UI Lab view switch inside the admitted database runtime;
  session-local blur tuning, diagnostic outlines and opt-in frame/material counters.
- `src/ui-lab/` — synthetic UI fixtures embedded by the workbench without a second window chrome
  or database owner. The isolated entry and `src/ui/dev/` remain reference tooling pending cleanup.
- `src/ui-lab/glass-proof/` — isolated current-backend proof composition and synthetic changing
  backdrop; native screenshots/results are recorded in `docs/GLASS-RENDERING-PROOF.md`.
- `src/ui/materials/compositor/` and related cached-compositor/provider code — parked/reference
  implementation. ADR 003 is historical; it does not freeze the final rendering topology.
- `src/ui/materials/FrostedSurface.tsx` — compatibility/reference material, pending final cleanup.

The active native CSS implementation must pass the new WebView2 proof before its topology is accepted.
Logical Major isolation, higher overlays, promoted Minor overlap and continuously live backdrops are
proof gates. Existing batching, overscan and motion mechanisms are implementation candidates.
Do not remove rollback/reference code before acceptance or leak renderer internals into features.

## Platform and Rust

- `src/platform/` — the only TypeScript Tauri imports; typed database/media/settings/window/workflow clients.
- `src-tauri/src/commands/` — narrow commands and capabilities; application commands use session authority.
- `src-tauri/src/session/` — native session/key ownership, lock/revocation, media read tokens and uploads.
- `src-tauri/src/database/` — SQLite envelope, generations, media and backup/recovery.
- `src-tauri/src/crypto/` — password derivation and authenticated encryption.
- `src-tauri/src/files/` — writer/file ownership and atomic filesystem operations.
- `src-tauri/src/settings/` — edition-local configuration and remembered resources.
- Legacy storage/model/raw-runner files remain historical source; production boot excludes their
  authority. Structured Workflow Runner completion and standalone migration remain roadmap work.

## Development and validation tooling

- `src/features/database-entry/` — product entry/admission/resource UI.
- `src/features/phase2-database/` — gated development database harness.
- `src-tauri/tauri.dev.conf.json` and adjacent development/preview/Lab configs — current isolated entries.
- `scripts/check-architecture.mjs` — dependency/material boundaries, including transitional allowances.
- `scripts/check-*-exclusion.mjs` and other production-inspection scripts — build/capability isolation.
- `scripts/generate-codemap.mjs` — regenerates only the inventory below, not this overview.
- `scripts/report-file-sizes.mjs` — module-size review support.
- `scripts/generate-baseline-fixtures.mjs` and `fixtures/baseline/` — deterministic baseline fixtures.
- `scripts/generate-glass-benchmark.py` — offline synthetic-media fixture generation/verification;
  `scripts/test_glass_benchmark.py` and `scripts/glass-benchmark.test.mjs` validate artifacts.
- `scripts/glass-pan-probe.mjs` — manual development pan/idle diagnostic, never product code.
  Callback pacing is not rendered FPS. Current methodology and fixture boundaries are in TESTING.md.

## Navigation

Start with current state and the governing subsystem contract. Locate the ownership boundary above,
then use the inventory and adjacent tests to inspect implementation. Generated summaries come from
source comments and may retain historical phase wording; they are navigation hints, not status gates.

<!-- GENERATED-INVENTORY:START -->

## Generated repository inventory

> Generated by `npm run codemap`. Do not edit this section manually.

| File                                                                       | Lines | Responsibility                                                                                     |
| -------------------------------------------------------------------------- | ----: | -------------------------------------------------------------------------------------------------- |
| `scripts/check-application-database-boundary.mjs`                          |    92 | Repository maintenance script                                                                      |
| `scripts/check-architecture.mjs`                                           |   270 | Repository maintenance script                                                                      |
| `scripts/check-database-cutover.mjs`                                       |    28 | Repository maintenance script                                                                      |
| `scripts/check-mcp-development-exclusion.mjs`                              |    89 | Repository maintenance script                                                                      |
| `scripts/check-phase2-production-exclusion.mjs`                            |    81 | Repository maintenance script                                                                      |
| `scripts/check-storage-preview.mjs`                                        |    69 | Repository maintenance script                                                                      |
| `scripts/check-version.mjs`                                                |    56 | Repository maintenance script                                                                      |
| `scripts/generate-baseline-fixtures.mjs`                                   |   115 | Repository maintenance script                                                                      |
| `scripts/generate-codemap.mjs`                                             |   103 | Repository maintenance script                                                                      |
| `scripts/glass-benchmark.test.mjs`                                         |    53 | Offline generated-fixture contract: run the Python generator first to exercise each profile.       |
| `scripts/glass-pan-probe.mjs`                                              |   107 | Synthetic events have no OS pointer capture. Scope the shim to this stage only.                    |
| `scripts/glass-pan-probe.test.mjs`                                         |    97 | Tests for the adjacent module                                                                      |
| `scripts/material-architecture-rules.mjs`                                  |   143 | Repository maintenance script                                                                      |
| `scripts/material-architecture-rules.test.mjs`                             |   158 | Tests for the adjacent module                                                                      |
| `scripts/report-file-sizes.mjs`                                            |    46 | Repository maintenance script                                                                      |
| `src-tauri/src/commands.rs`                                                |    11 | Rust backend module                                                                                |
| `src-tauri/src/commands/application_image_drop.rs`                         |    81 | Rust backend module                                                                                |
| `src-tauri/src/commands/application_image_picker.rs`                       |    50 | Rust backend module                                                                                |
| `src-tauri/src/commands/application_resources.rs`                          |   118 | Rust backend module                                                                                |
| `src-tauri/src/commands/database_command_types.rs`                         |    95 | Rust backend module                                                                                |
| `src-tauri/src/commands/database_commands.rs`                              |   307 | Rust backend module                                                                                |
| `src-tauri/src/commands/database_edition.rs`                               |    43 | Rust backend module                                                                                |
| `src-tauri/src/commands/database_window_commands.rs`                       |   203 | / Called only after the frontend has completed its save-before-close guard.                        |
| `src-tauri/src/commands/phase2_database_commands.rs`                       |   149 | Development harness aliases only; application handlers own the bounded IPC implementation.         |
| `src-tauri/src/commands/phase2_ipc.rs`                                     |    50 | Rust backend module                                                                                |
| `src-tauri/src/crypto/document_cipher.rs`                                  |   140 | Rust backend module                                                                                |
| `src-tauri/src/crypto/key_derivation.rs`                                   |   106 | Rust backend module                                                                                |
| `src-tauri/src/crypto/mod.rs`                                              |     4 | Rust backend module                                                                                |
| `src-tauri/src/crypto/secret_key.rs`                                       |    43 | Rust backend module                                                                                |
| `src-tauri/src/database/backup_repository.rs`                              |    94 | Rust backend module                                                                                |
| `src-tauri/src/database/connection.rs`                                     |   124 | Rust backend module                                                                                |
| `src-tauri/src/database/document_repository.rs`                            |   182 | Rust backend module                                                                                |
| `src-tauri/src/database/envelope_validation.rs`                            |   254 | Rust backend module                                                                                |
| `src-tauri/src/database/limits.rs`                                         |   101 | Rust backend module                                                                                |
| `src-tauri/src/database/media_repository.rs`                               |   152 | Rust backend module                                                                                |
| `src-tauri/src/database/mod.rs`                                            |    10 | The repository is exercised now; its streaming platform adapter is Phase 5.                        |
| `src-tauri/src/database/schema.rs`                                         |   138 | Rust backend module                                                                                |
| `src-tauri/src/discord.rs`                                                 |   170 | / Holds the live Discord IPC connection. `None` when RPC is disabled or                            |
| `src-tauri/src/error.rs`                                                   |   125 | Rust backend module                                                                                |
| `src-tauri/src/files/database_lock.rs`                                     |   324 | Diagnostic metadata is deliberately best-effort. Only the OS lock                                  |
| `src-tauri/src/files/database_path_authorization.rs`                       |   330 | Rust backend module                                                                                |
| `src-tauri/src/files/mod.rs`                                               |     3 | Rust backend module                                                                                |
| `src-tauri/src/image_processing.rs`                                        |   231 | / Longest edge (px) a raster image is downscaled to on import. Matches the                         |
| `src-tauri/src/images.rs`                                                  |   458 | / Metadata returned to the frontend after an image is stored. The frontend                         |
| `src-tauri/src/main.rs`                                                    |   174 | Check before single-instance/plugin setup: a misconfigured preview must not contact the old app.   |
| `src-tauri/src/model.rs`                                                   |  1105 | Rust backend module                                                                                |
| `src-tauri/src/phase2_error.rs`                                            |   178 | Rust backend module                                                                                |
| `src-tauri/src/portable.rs`                                                |   312 | / The decrypted body of an export. Images are bundled so the file is portable                      |
| `src-tauri/src/session/application_resource_tests.rs`                      |   315 | Check the pending path was erased, not merely protected by a rotated session ID.                   |
| `src-tauri/src/session/database_session.rs`                                |   304 | Each unlocked key lifetime gets a new identity; old pre-lock requests stay stale.                  |
| `src-tauri/src/session/image_drop_authorizations.rs`                       |    84 | Only called from a native main-window drop, never from renderer-supplied paths.                    |
| `src-tauri/src/session/mod.rs`                                             |    34 | Rust backend module                                                                                |
| `src-tauri/src/session/phase2_concurrency_recovery_tests.rs`               |   242 | Rust backend module                                                                                |
| `src-tauri/src/session/phase2_tests.rs`                                    |   368 | Rust backend module                                                                                |
| `src-tauri/src/session/session_authorization_tests.rs`                     |    64 | Rust backend module                                                                                |
| `src-tauri/src/session/session_image_drop.rs`                              |    35 | File intake rechecks this authority before and after processing off the renderer thread.           |
| `src-tauri/src/session/session_key_state.rs`                               |    96 | Rust backend module                                                                                |
| `src-tauri/src/session/session_lifecycle.rs`                               |    96 | Rust backend module                                                                                |
| `src-tauri/src/session/session_media_file.rs`                              |    58 | Path comes only from the native user picker, never renderer input or document content.             |
| `src-tauri/src/session/session_media_reads_tests.rs`                       |    89 | Multiple chunks with valid SVG syntax, without a large decoded raster allocation.                  |
| `src-tauri/src/session/session_media_reads.rs`                             |   113 | / At most two validated objects (64 MiB each), matching the frontend load concurrency.             |
| `src-tauri/src/session/session_media_transfer.rs`                          |   185 | Rust backend module                                                                                |
| `src-tauri/src/session/session_opening.rs`                                 |   251 | Rust backend module                                                                                |
| `src-tauri/src/session/session_state_access.rs`                            |    64 | Rust backend module                                                                                |
| `src-tauri/src/session/session_support.rs`                                 |    82 | Rust backend module                                                                                |
| `src-tauri/src/session/session_types.rs`                                   |   103 | Rust backend module                                                                                |
| `src-tauri/src/session/session_view_state.rs`                              |    57 | Opaque, encrypted device-local view cache. No canvas IDs/coordinates in filenames or plaintext     |
| `src-tauri/src/settings/device_preferences.rs`                             |   130 | Rust backend module                                                                                |
| `src-tauri/src/settings/mod.rs`                                            |     4 | Rust backend module                                                                                |
| `src-tauri/src/settings/recent_databases.rs`                               |   193 | Rust backend module                                                                                |
| `src-tauri/src/settings/settings_file.rs`                                  |    46 | Rust backend module                                                                                |
| `src-tauri/src/storage_preview.rs`                                         |    64 | Disposable UI baseline only. Never a product storage mode or a legacy migration path.              |
| `src-tauri/src/storage.rs`                                                 |   730 | Only the built-in empty UI baseline. This is not a successful load from any database.              |
| `src-tauri/src/window_state.rs`                                            |   107 | Clamp the saved geometry so the window can never restore off-screen or                             |
| `src-tauri/src/windows_session_notifications.rs`                           |    99 | WTS notifications belong to native window lifetime, including the hidden session keeper.           |
| `src/App.tsx`                                                              |  8336 | Latest image drop/paste handlers, refreshed each render so the once-mounted                        |
| `src/app/appData.test.ts`                                                  |   355 | Tests for the adjacent module                                                                      |
| `src/app/appData.ts`                                                       |   299 | TypeScript application module                                                                      |
| `src/app/appDataSchema.ts`                                                 |   274 | TypeScript application module                                                                      |
| `src/app/AppProviders.tsx`                                                 |    28 | React component or typed UI module                                                                 |
| `src/app/AppShell.test.tsx`                                                |    71 | Tests for the adjacent module                                                                      |
| `src/app/AppShell.tsx`                                                     |    37 | React component or typed UI module                                                                 |
| `src/app/canvasDocument.test.ts`                                           |   122 | Tests for the adjacent module                                                                      |
| `src/app/canvasDocument.ts`                                                |    80 | TypeScript application module                                                                      |
| `src/app/canvasElementConstraints.ts`                                      |    16 | The retained canvas-details operation clamps stored coordinates, including locked elements.        |
| `src/app/commandError.test.ts`                                             |    24 | Tests for the adjacent module                                                                      |
| `src/app/commandError.ts`                                                  |    74 | Compatibility with pre-structured backend errors while older builds or                             |
| `src/app/commands/commandDispatcher.test.ts`                               |    28 | @vitest-environment node                                                                           |
| `src/app/commands/commandDispatcher.ts`                                    |    18 | TypeScript application module                                                                      |
| `src/app/commands/commandTypes.ts`                                         |    12 | TypeScript application module                                                                      |
| `src/app/commands/createRetainedActionCallbacks.ts`                        |   205 | Call once at gesture start, after controller eligibility filtering. Never per pointer sample.      |
| `src/app/commands/retainedCallbackCompletion.test.ts`                      |   121 | @vitest-environment node                                                                           |
| `src/app/commands/retainedCallbackLifetime.test.ts`                        |   111 | @vitest-environment node                                                                           |
| `src/app/commands/retainedCallbacks.performance.test.ts`                   |   107 | @vitest-environment node                                                                           |
| `src/app/commands/retainedCallbackSnapshots.ts`                            |   116 | The existing interaction owner resolves hit-testing/search/scroll to a full-list index.            |
| `src/app/commands/retainedCallbackTestSupport.ts`                          |    58 | TypeScript application module                                                                      |
| `src/app/commands/retainedCanvasCallbacks.ts`                              |   135 | TypeScript application module                                                                      |
| `src/app/commands/retainedCanvasCommands.ts`                               |   112 | Removing the first canvas chooses the first survivor; otherwise choose the previous canvas.        |
| `src/app/commands/retainedCanvasRouting.test.ts`                           |   105 | @vitest-environment node                                                                           |
| `src/app/commands/retainedCardCompanions.ts`                               |    31 | Preserve copied checked state AND activation; never add a duplicate over an inactive checkbox.     |
| `src/app/commands/retainedCompletionOwner.ts`                              |   168 | One subscription pair per application binding, never one observer per callback or pointer frame.   |
| `src/app/commands/retainedConnectionCallbacks.ts`                          |    96 | Same bounded callback owner, no additional document/session observers or pointer-state owner.      |
| `src/app/commands/retainedConnectionCommands.ts`                           |    84 | Invoke existing handlers inside one transaction. Never dispatch node insertion and edge insertion  |
| `src/app/commands/retainedConnectionCompletion.test.ts`                    |   153 | @vitest-environment node                                                                           |
| `src/app/commands/retainedConnectionRejection.test.ts`                     |    94 | @vitest-environment node                                                                           |
| `src/app/commands/retainedConnectionTestSupport.ts`                        |    22 | TypeScript application module                                                                      |
| `src/app/commands/retainedContainerCardCallbacks.ts`                       |    89 | Capture before an asynchronous clipboard read or opening the JSON editor. Draft/clipboard text     |
| `src/app/commands/retainedContainerCardCommands.ts`                        |   167 | Read through the immutable contract; Object.assign below still writes to the Immer proxy.          |
| `src/app/commands/retainedContainerCardCompletion.test.ts`                 |   179 | @vitest-environment node                                                                           |
| `src/app/commands/retainedContainerCardContract.ts`                        |    48 | TypeScript application module                                                                      |
| `src/app/commands/retainedContainerCardLifetime.test.ts`                   |   124 | @vitest-environment node                                                                           |
| `src/app/commands/retainedContainerCardRejection.test.ts`                  |   148 | @vitest-environment node                                                                           |
| `src/app/commands/retainedContainerCards.performance.test.ts`              |    61 | @vitest-environment node                                                                           |
| `src/app/commands/retainedContainerCardTestSupport.ts`                     |    58 | TypeScript application module                                                                      |
| `src/app/commands/retainedContainerPaste.ts`                               |    50 | TypeScript application module                                                                      |
| `src/app/commands/retainedContainerSnapshot.ts`                            |    76 | Presence semantics match the retained view: inactive installations emit no control, while an       |
| `src/app/commands/retainedContentCommand.test.ts`                          |   140 | @vitest-environment node                                                                           |
| `src/app/commands/retainedContentCommand.ts`                               |    51 | Retained locks protect movement/resize/deletion, not text, color or display controls.              |
| `src/app/commands/retainedContentContract.ts`                              |    45 | Module-owned scalar fields, explicitly composed here; placement/media/geometry/extensions are      |
| `src/app/commands/retainedContentLayers.performance.test.ts`               |   152 | @vitest-environment node                                                                           |
| `src/app/commands/retainedContentRejection.test.ts`                        |    91 | @vitest-environment node                                                                           |
| `src/app/commands/retainedCopy.performance.test.ts`                        |    83 | @vitest-environment node                                                                           |
| `src/app/commands/retainedCopyCallbacks.ts`                                |    37 | Call on explicit Copy, not pointer samples. The opaque handle owns no copied plaintext.            |
| `src/app/commands/retainedCopyCompletion.test.ts`                          |   126 | @vitest-environment node                                                                           |
| `src/app/commands/retainedCopyContract.ts`                                 |    60 | Internal, session-local copy data; not a portable/import format or a second document schema.       |
| `src/app/commands/retainedCopyLifetime.test.ts`                            |    84 | @vitest-environment node                                                                           |
| `src/app/commands/retainedCopyRejection.test.ts`                           |   111 | @vitest-environment node                                                                           |
| `src/app/commands/retainedCopySnapshot.ts`                                 |    56 | Mirrors retained internal-copy membership: containers expand to their ordered text cards;          |
| `src/app/commands/retainedCopyTestSupport.ts`                              |    72 | TypeScript application module                                                                      |
| `src/app/commands/retainedCreationCallbacks.ts`                            |    80 | TypeScript application module                                                                      |
| `src/app/commands/retainedDataReplacementCommand.ts`                       |    67 | Immediate compatibility API, not a stale-safe editor callback. Share typed content rules and       |
| `src/app/commands/retainedDocumentCommandHandlers.ts`                      |    62 | One explicit handler list for the existing dispatcher, not a second registry or command engine.    |
| `src/app/commands/retainedEditorCallbacks.test.ts`                         |   113 | @vitest-environment node                                                                           |
| `src/app/commands/retainedEditorCallbacks.ts`                              |    35 | Local draft/focus/pulse ownership stays in the view. Only final editor values cross this boundary. |
| `src/app/commands/retainedExtensionCallbacks.ts`                           |   117 | Activation is deliberately separate from a retained control's configuration.enabled.               |
| `src/app/commands/retainedExtensionCommand.ts`                             |    98 | One completed group transaction. Product admission remains the shared retained-definition,         |
| `src/app/commands/retainedExtensionCompletion.test.ts`                     |   168 | @vitest-environment node                                                                           |
| `src/app/commands/retainedExtensionLifetime.test.ts`                       |    92 | @vitest-environment node                                                                           |
| `src/app/commands/retainedExtensionRejection.test.ts`                      |   132 | @vitest-environment node                                                                           |
| `src/app/commands/retainedExtensions.performance.test.ts`                  |    83 | @vitest-environment node                                                                           |
| `src/app/commands/retainedExtensionSnapshot.ts`                            |    52 | Read/index once per action start, not per member or pointer sample. Parsed entries are detached    |
| `src/app/commands/retainedExtensionTestSupport.ts`                         |    41 | TypeScript application module                                                                      |
| `src/app/commands/retainedGeometryCommands.test.ts`                        |   169 | @vitest-environment node                                                                           |
| `src/app/commands/retainedGeometryCommands.ts`                             |    82 | The generic transaction still owns canonical-from checks, duplicate detection, atomic writes and   |
| `src/app/commands/retainedGeometryCompletion.performance.test.ts`          |   181 | @vitest-environment node                                                                           |
| `src/app/commands/retainedGeometryTestSupport.ts`                          |    64 | TypeScript application module                                                                      |
| `src/app/commands/retainedHistoryCallbacks.test.ts`                        |   222 | @vitest-environment node                                                                           |
| `src/app/commands/retainedImageImportCommand.ts`                           |    28 | TypeScript application module                                                                      |
| `src/app/commands/retainedImageReplaceCommand.ts`                          |    59 | Replacing existing media retains the user's box; placeholder sizing obeys geometry locks.          |
| `src/app/commands/retainedImageReplacement.test.ts`                        |   123 | @vitest-environment node                                                                           |
| `src/app/commands/retainedLayerCommands.test.ts`                           |   176 | @vitest-environment node                                                                           |
| `src/app/commands/retainedLayerCommands.ts`                                |   128 | Retained group order comes from existing stacking, never selection/click order. Locks allow        |
| `src/app/commands/retainedPasteCommand.ts`                                 |    75 | One insertion transaction, with product candidate admission owning retained schemas/relationships. |
| `src/app/commands/retainedPasteCompletion.ts`                              |    77 | TypeScript application module                                                                      |
| `src/app/commands/retainedPlacementCommand.test.ts`                        |   193 | @vitest-environment node                                                                           |
| `src/app/commands/retainedPlacementCommand.ts`                             |   115 | An unchanged drop is a true no-op even when historical deletion left numeric gaps.                 |
| `src/app/commands/retainedPlacementCompletion.performance.test.ts`         |   133 | @vitest-environment node                                                                           |
| `src/app/commands/retainedPlacementContract.ts`                            |    45 | Capture canonical geometry/placement and all affected siblings before the gesture. The UI          |
| `src/app/commands/retainedPlacementRejection.test.ts`                      |   226 | @vitest-environment node                                                                           |
| `src/app/commands/retainedPlacementTestSupport.ts`                         |    66 | Test-only completion binding. Production hit testing/callback epochs are a later slice.            |
| `src/app/commands/retainedSelectionDeletion.performance.test.ts`           |    70 | @vitest-environment node                                                                           |
| `src/app/commands/retainedSelectionDeletion.test.ts`                       |   173 | @vitest-environment node                                                                           |
| `src/app/commands/retainedSelectionDeletion.ts`                            |    99 | Application-level coordination of retained feature relationships; no legacy collection setters,    |
| `src/app/commands/retainedSettingsCallbacks.ts`                            |    76 | Capture once when a control edit starts; commit only on completed change. Local previews           |
| `src/app/commands/retainedSettingsCommand.ts`                              |    48 | Reuse the existing field-local command inside one transaction. Device/view preferences are         |
| `src/app/commands/retainedSettingsCompletion.test.ts`                      |   109 | @vitest-environment node                                                                           |
| `src/app/commands/retainedSettingsRejection.test.ts`                       |    85 | @vitest-environment node                                                                           |
| `src/app/commands/retainedTextCardDrop.test.ts`                            |   112 | @vitest-environment node                                                                           |
| `src/app/commands/retainedTextCardDrop.ts`                                 |    69 | Structural output of the existing text-card placement service. No DOM or legacy model dependency.  |
| `src/app/createWindowCloseController.test.ts`                              |   104 | @vitest-environment node                                                                           |
| `src/app/createWindowCloseController.ts`                                   |    59 | TypeScript application module                                                                      |
| `src/app/database/acceptRetainedDocument.ts`                               |    15 | Reuse the staged adapter's module schemas and relationship checks as one acceptance authority.     |
| `src/app/database/createApplicationDatabaseRuntime.ts`                     |   132 | TypeScript application module                                                                      |
| `src/app/database/createDatabaseSessionController.ts`                      |   310 | Required ownership hook for view/interaction/media caches; synchronous revocation before awaits.   |
| `src/app/database/createDatabaseWorkspace.test.ts`                         |   210 | @vitest-environment node                                                                           |
| `src/app/database/createDatabaseWorkspace.ts`                              |    85 | Supplied by application edition composition, never by a document or picker response.               |
| `src/app/database/createTauriDatabaseSessionController.ts`                 |    40 | TypeScript application module                                                                      |
| `src/app/database/DatabaseApplication.test.tsx`                            |   121 | Tests for the adjacent module                                                                      |
| `src/app/database/DatabaseApplication.tsx`                                 |   124 | One runtime per renderer lifetime. React StrictMode must not create two native session owners.     |
| `src/app/database/databaseNativeRevocation.test.ts`                        |    40 | Tests for the adjacent module                                                                      |
| `src/app/database/databaseResourceFlush.test.ts`                           |    44 | @vitest-environment node                                                                           |
| `src/app/database/databaseRuntimeResources.test.ts`                        |    34 | Tests for the adjacent module                                                                      |
| `src/app/database/databaseRuntimeResources.ts`                             |    39 | TypeScript application module                                                                      |
| `src/app/database/databaseSessionLifecycle.test.ts`                        |   164 | @vitest-environment node                                                                           |
| `src/app/database/databaseSessionRaces.test.ts`                            |   116 | @vitest-environment node                                                                           |
| `src/app/database/databaseSessionRecovery.test.ts`                         |   109 | @vitest-environment node                                                                           |
| `src/app/database/databaseSessionRequests.ts`                              |    44 | Preserve safe categories, never backend details, paths, passwords, or document text.               |
| `src/app/database/databaseSessionTestSupport.ts`                           |    83 | TypeScript application module                                                                      |
| `src/app/database/retainedAcceptanceLifecycle.performance.test.ts`         |    60 | @vitest-environment node                                                                           |
| `src/app/database/retainedDocumentAcceptance.test.ts`                      |   238 | @vitest-environment node                                                                           |
| `src/app/defaultData.ts`                                                   |    36 | TypeScript application module                                                                      |
| `src/app/development/DevelopmentVisualWorkbench.test.tsx`                  |   119 | Keep the real session, gate and canvas-binding lifetime; only replace the large presentation tree. |
| `src/app/development/DevelopmentVisualWorkbench.tsx`                       |    43 | React component or typed UI module                                                                 |
| `src/app/development/WorkbenchDiagnostics.tsx`                             |    46 | React component or typed UI module                                                                 |
| `src/app/development/WorkbenchTools.tsx`                                   |   101 | Root ownership includes portals and window chrome. Restore inherited values on lock/unmount.       |
| `src/app/errors/ApplicationErrorBoundary.test.tsx`                         |    62 | Tests for the adjacent module                                                                      |
| `src/app/errors/ApplicationErrorBoundary.tsx`                              |    46 | React component or typed UI module                                                                 |
| `src/app/errors/applicationErrorReporter.test.ts`                          |    27 | Tests for the adjacent module                                                                      |
| `src/app/errors/applicationErrorReporter.ts`                               |    27 | Deliberately omit the error message, stack, and component data: they may                           |
| `src/app/history.test.ts`                                                  |   161 | Tests for the adjacent module                                                                      |
| `src/app/history.ts`                                                       |    88 | TypeScript application module                                                                      |
| `src/app/hooks.ts`                                                         |     6 | TypeScript application module                                                                      |
| `src/app/interactions/canvasInteractionController.geometry.test.ts`        |   283 | @vitest-environment node                                                                           |
| `src/app/interactions/canvasInteractionController.ts`                      |   394 | TypeScript application module                                                                      |
| `src/app/interactions/canvasInteractionController.viewport.test.ts`        |   263 | @vitest-environment node                                                                           |
| `src/app/interactions/canvasInteractionSnapshot.ts`                        |    19 | TypeScript application module                                                                      |
| `src/app/interactions/canvasInteractionTypes.ts`                           |   152 | TypeScript application module                                                                      |
| `src/app/interactions/createRetainedCanvasInteractionController.ts`        |   173 | As in the current UI, update the placement service with the release sample before completing.      |
| `src/app/interactions/panGestureFrameQueue.ts`                             |    70 | TypeScript application module                                                                      |
| `src/app/interactions/resizeGeometry.test.ts`                              |    36 | @vitest-environment node                                                                           |
| `src/app/interactions/resizeGeometry.ts`                                   |    37 | TypeScript application module                                                                      |
| `src/app/interactions/retainedInteraction.performance.test.ts`             |    52 | @vitest-environment node                                                                           |
| `src/app/interactions/retainedInteractionCompletion.test.ts`               |   163 | @vitest-environment node                                                                           |
| `src/app/interactions/retainedInteractionLifetime.test.ts`                 |   179 | @vitest-environment node                                                                           |
| `src/app/interactions/retainedInteractionTestSupport.ts`                   |    75 | Test fixtures supply already-resolved view bounds. Production hit-testing/size resolution is       |
| `src/app/interactions/selectionEngine.ts`                                  |    39 | TypeScript application module                                                                      |
| `src/app/interactions/snappingEngine.test.ts`                              |    80 | @vitest-environment node                                                                           |
| `src/app/interactions/snappingEngine.ts`                                   |    91 | TypeScript application module                                                                      |
| `src/app/interactions/TransientInteractionProvider.test.tsx`               |    68 | Tests for the adjacent module                                                                      |
| `src/app/interactions/TransientInteractionProvider.tsx`                    |    26 | React component or typed UI module                                                                 |
| `src/app/interactions/transientInteractionService.ts`                      |    35 | TypeScript application module                                                                      |
| `src/app/interactions/useStableCanvasInteractionController.test.tsx`       |    45 | Tests for the adjacent module                                                                      |
| `src/app/interactions/useStableCanvasInteractionController.ts`             |    15 | TypeScript application module                                                                      |
| `src/app/interactions/useTransientInteraction.ts`                          |    20 | TypeScript application module                                                                      |
| `src/app/media/createSessionMediaResources.ts`                             |   151 | Saving before close can fail. Keep existing leases while authority is still unlocked;              |
| `src/app/media/importRetainedImage.ts`                                     |    33 | Rejected insertion can leave unreferenced bytes. Do not remove bytes needed by history or          |
| `src/app/media/sessionMediaResources.test.ts`                              |   184 | @vitest-environment node                                                                           |
| `src/app/persistence/documentPersistenceCoordinator.test.ts`               |   261 | @vitest-environment node                                                                           |
| `src/app/persistence/documentPersistenceCoordinator.ts`                    |   265 | TypeScript application module                                                                      |
| `src/app/persistence/documentPersistenceFailures.test.ts`                  |   348 | @vitest-environment node                                                                           |
| `src/app/persistence/persistenceErrors.ts`                                 |    36 | TypeScript application module                                                                      |
| `src/app/persistence/persistenceScheduler.ts`                              |    16 | TypeScript application module                                                                      |
| `src/app/preferences/applicationPreferences.test.ts`                       |   177 | @vitest-environment node                                                                           |
| `src/app/preferences/createDevicePreferences.ts`                           |    90 | Copy object patches now; evaluate functional edits against the latest queued revision.             |
| `src/app/preferences/createRememberedViews.ts`                             |   170 | Connect only to the existing controller's onViewportSettled, never its frame subscription.         |
| `src/app/preferences/createWindowPrivacy.ts`                               |    49 | TypeScript application module                                                                      |
| `src/app/preferences/preferencesTestSupport.ts`                            |    37 | TypeScript application module                                                                      |
| `src/app/preferences/windowPrivacy.test.ts`                                |    74 | Tests for the adjacent module                                                                      |
| `src/app/selectors/applicationSelectors.ts`                                |     5 | TypeScript application module                                                                      |
| `src/app/selectors/workspaceSelectors.test.ts`                             |    68 | @vitest-environment node                                                                           |
| `src/app/selectors/workspaceSelectors.ts`                                  |    35 | TypeScript application module                                                                      |
| `src/app/store.ts`                                                         |    75 | TypeScript application module                                                                      |
| `src/app/view-projection/cardContainerProjection.performance.test.ts`      |   139 | @vitest-environment node                                                                           |
| `src/app/view-projection/cardContainerProjection.test.ts`                  |   209 | @vitest-environment node                                                                           |
| `src/app/view-projection/createImageMediaProjection.ts`                    |    46 | TypeScript application module                                                                      |
| `src/app/view-projection/createMindMapConnectionsProjection.ts`            |    64 | One traversal for the entire document, not one connection scan per canvas.                         |
| `src/app/view-projection/createRetainedCanvasBinding.ts`                   |   176 | The UI must synchronously discard drafts, clipboard/JSON buffers and rendered media on revoke.     |
| `src/app/view-projection/createRetainedCanvasProjection.ts`                |   208 | Transitional, unmounted read-only adapter, not a renderer/element registry. Only call with the     |
| `src/app/view-projection/createRetainedExtensionsProjection.ts`            |   113 | TypeScript application module                                                                      |
| `src/app/view-projection/imageProjection.performance.test.ts`              |   138 | @vitest-environment node                                                                           |
| `src/app/view-projection/imageProjection.test.ts`                          |   135 | @vitest-environment node                                                                           |
| `src/app/view-projection/mindMapProjection.performance.test.ts`            |   108 | @vitest-environment node                                                                           |
| `src/app/view-projection/mindMapProjection.test.ts`                        |   173 | @vitest-environment node                                                                           |
| `src/app/view-projection/retainedCanvasBinding.performance.test.ts`        |    34 | Tests for the adjacent module                                                                      |
| `src/app/view-projection/retainedCanvasBinding.test.ts`                    |   195 | Tests for the adjacent module                                                                      |
| `src/app/view-projection/retainedCanvasBindingTestSupport.ts`              |    36 | TypeScript application module                                                                      |
| `src/app/view-projection/retainedCanvasProjectionTypes.ts`                 |    64 | TypeScript application module                                                                      |
| `src/app/view-projection/retainedExtensionsProjection.performance.test.ts` |   149 | @vitest-environment node                                                                           |
| `src/app/view-projection/retainedExtensionsProjection.test.ts`             |   129 | @vitest-environment node                                                                           |
| `src/app/windowChrome.ts`                                                  |     9 | TypeScript application module                                                                      |
| `src/app/windowCloseCoordinator.ts`                                        |    15 | TypeScript application module                                                                      |
| `src/app/workspace/workspaceCommandsHistory.test.ts`                       |   199 | @vitest-environment node                                                                           |
| `src/app/workspace/workspaceGroupGeometry.test.ts`                         |   108 | @vitest-environment node                                                                           |
| `src/app/workspace/workspaceInitialization.test.ts`                        |   100 | @vitest-environment node                                                                           |
| `src/app/workspace/workspaceOperations.ts`                                 |   196 | TypeScript application module                                                                      |
| `src/app/workspace/workspaceSlice.ts`                                      |   157 | TypeScript application module                                                                      |
| `src/app/workspace/workspaceTestSupport.ts`                                |   112 | TypeScript application module                                                                      |
| `src/app/workspace/workspaceTypes.ts`                                      |    67 | TypeScript application module                                                                      |
| `src/canvas/geometry/canvasGeometry.ts`                                    |    41 | TypeScript application module                                                                      |
| `src/canvas/geometry/viewportMath.test.ts`                                 |    78 | @vitest-environment node                                                                           |
| `src/canvas/geometry/viewportMath.ts`                                      |   108 | TypeScript application module                                                                      |
| `src/canvas/virtualization/viewportCulling.test.ts`                        |    85 | @vitest-environment node                                                                           |
| `src/canvas/virtualization/viewportCulling.ts`                             |    69 | TypeScript application module                                                                      |
| `src/canvasMath.test.ts`                                                   |   159 | Tests for the adjacent module                                                                      |
| `src/canvasMath.ts`                                                        |   128 | TypeScript application module                                                                      |
| `src/components/CanvasManager.tsx`                                         |   940 | React component or typed UI module                                                                 |
| `src/components/CanvasManagerCards.test.tsx`                               |   536 | Tests for the adjacent module                                                                      |
| `src/components/ColorPickerMenu.tsx`                                       |   340 | React component or typed UI module                                                                 |
| `src/components/CommandRunnerModals.test.tsx`                              |   141 | Tests for the adjacent module                                                                      |
| `src/components/CommandRunnerModals.tsx`                                   |   612 | React component or typed UI module                                                                 |
| `src/components/ContainerJsonEditorWindow.test.tsx`                        |    34 | Tests for the adjacent module                                                                      |
| `src/components/ContainerJsonEditorWindow.tsx`                             |   257 | React component or typed UI module                                                                 |
| `src/components/ContainerNode.tsx`                                         |   877 | React component or typed UI module                                                                 |
| `src/components/ContextMenus.test.tsx`                                     |   224 | Tests for the adjacent module                                                                      |
| `src/components/ContextMenus.tsx`                                          |  1143 | React component or typed UI module                                                                 |
| `src/components/DatabaseSettingsActions.tsx`                               |    60 | React component or typed UI module                                                                 |
| `src/components/ExtensionDropEffect.tsx`                                   |   203 | React component or typed UI module                                                                 |
| `src/components/ExtensionsPanel.test.tsx`                                  |   352 | Tests for the adjacent module                                                                      |
| `src/components/ExtensionsPanel.tsx`                                       |   648 | React component or typed UI module                                                                 |
| `src/components/FloatingToolbar.test.tsx`                                  |   167 | Tests for the adjacent module                                                                      |
| `src/components/FloatingToolbar.tsx`                                       |   176 | React component or typed UI module                                                                 |
| `src/components/FpsCounter.tsx`                                            |    34 | React component or typed UI module                                                                 |
| `src/components/FrostedGlassTuner.test.tsx`                                |   139 | Tests for the adjacent module                                                                      |
| `src/components/FrostedGlassTuner.tsx`                                     |   196 | React component or typed UI module                                                                 |
| `src/components/FrostedGlassTunerControls.tsx`                             |    96 | React component or typed UI module                                                                 |
| `src/components/FrostedGlassTunerPanels.tsx`                               |   167 | React component or typed UI module                                                                 |
| `src/components/FrostedGlassTunerState.ts`                                 |   105 | React component or typed UI module                                                                 |
| `src/components/ImageNode.tsx`                                             |   153 | Background extension off: only show the image, no frame/border/shell, so a                         |
| `src/components/MarkdownContent.tsx`                                       |    92 | React component or typed UI module                                                                 |
| `src/components/MindmapConnections.test.tsx`                               |    44 | Tests for the adjacent module                                                                      |
| `src/components/MindmapConnections.tsx`                                    |   109 | React component or typed UI module                                                                 |
| `src/components/MindmapConnectors.test.tsx`                                |    30 | Tests for the adjacent module                                                                      |
| `src/components/MindmapConnectors.tsx`                                     |    56 | React component or typed UI module                                                                 |
| `src/components/Minimap.test.tsx`                                          |   191 | Tests for the adjacent module                                                                      |
| `src/components/Minimap.tsx`                                               |   244 | React component or typed UI module                                                                 |
| `src/components/Modals.test.tsx`                                           |   111 | Tests for the adjacent module                                                                      |
| `src/components/Modals.tsx`                                                |   606 | React component or typed UI module                                                                 |
| `src/components/ProductionDialogs.test.tsx`                                |   204 | Shared scheduler drains the retained modal presence.                                               |
| `src/components/ProductionDialogs.tsx`                                     |   241 | React component or typed UI module                                                                 |
| `src/components/SettingsModal.test.tsx`                                    |   354 | One pending shared frame advances all active UI motion subscribers.                                |
| `src/components/TextBlockNode.tsx`                                         |   561 | React component or typed UI module                                                                 |
| `src/components/TextCardNode.test.tsx`                                     |   246 | Tests for the adjacent module                                                                      |
| `src/components/TextCardNode.tsx`                                          |   482 | React component or typed UI module                                                                 |
| `src/components/ToastStack.tsx`                                            |    53 | React component or typed UI module                                                                 |
| `src/components/WindowChrome.test.tsx`                                     |    88 | Tests for the adjacent module                                                                      |
| `src/components/WindowChrome.tsx`                                          |   114 | React component or typed UI module                                                                 |
| `src/components/WorkspacePanels.test.tsx`                                  |   220 | Tests for the adjacent module                                                                      |
| `src/constants.ts`                                                         |    58 | TypeScript application module                                                                      |
| `src/domain/commands/commandExecution.stress.test.ts`                      |    64 | @vitest-environment node                                                                           |
| `src/domain/commands/commandExecution.test.ts`                             |   204 | @vitest-environment node                                                                           |
| `src/domain/commands/commandHandler.ts`                                    |    43 | TypeScript application module                                                                      |
| `src/domain/commands/commandRegistry.ts`                                   |    29 | TypeScript application module                                                                      |
| `src/domain/commands/commandResult.ts`                                     |    32 | TypeScript application module                                                                      |
| `src/domain/commands/commandTestSupport.ts`                                |    38 | TypeScript application module                                                                      |
| `src/domain/commands/core/canvasCommands.test.ts`                          |   121 | @vitest-environment node                                                                           |
| `src/domain/commands/core/canvasCommands.ts`                               |   132 | TypeScript application module                                                                      |
| `src/domain/commands/core/connectionCommands.test.ts`                      |   110 | @vitest-environment node                                                                           |
| `src/domain/commands/core/connectionCommands.ts`                           |    72 | TypeScript application module                                                                      |
| `src/domain/commands/core/coreDocumentCommandHandlers.test.ts`             |    34 | @vitest-environment node                                                                           |
| `src/domain/commands/core/coreDocumentCommandHandlers.ts`                  |    19 | TypeScript application module                                                                      |
| `src/domain/commands/core/documentSettingsCommands.ts`                     |    51 | TypeScript application module                                                                      |
| `src/domain/commands/core/elementCommands.test.ts`                         |   131 | @vitest-environment node                                                                           |
| `src/domain/commands/core/elementCommands.ts`                              |   125 | TypeScript application module                                                                      |
| `src/domain/commands/core/elementGeometryCommands.test.ts`                 |    79 | @vitest-environment node                                                                           |
| `src/domain/commands/core/elementGeometryCommands.ts`                      |    66 | Equal-value replacement would otherwise create a patch and schedule an unnecessary save.           |
| `src/domain/commands/core/extensionCommands.ts`                            |   104 | TypeScript application module                                                                      |
| `src/domain/commands/core/mediaCommands.ts`                                |    59 | TypeScript application module                                                                      |
| `src/domain/commands/core/mediaExtensionSettingsCommands.test.ts`          |   169 | @vitest-environment node                                                                           |
| `src/domain/commands/currentDocumentValidation.test.ts`                    |   146 | @vitest-environment node                                                                           |
| `src/domain/commands/domainCommand.ts`                                     |     5 | TypeScript application module                                                                      |
| `src/domain/commands/executeDocumentCommand.ts`                            |   121 | TypeScript application module                                                                      |
| `src/domain/document/createDocument.test.ts`                               |    29 | @vitest-environment node                                                                           |
| `src/domain/document/createDocument.ts`                                    |    43 | TypeScript application module                                                                      |
| `src/domain/document/documentAcceptance.ts`                                |    18 | Application-supplied feature policy. The generic document core never imports feature modules.      |
| `src/domain/document/documentInvariants.test.ts`                           |   160 | @vitest-environment node                                                                           |
| `src/domain/document/documentInvariants.ts`                                |    44 | TypeScript application module                                                                      |
| `src/domain/document/documentLimits.ts`                                    |    20 | TypeScript application module                                                                      |
| `src/domain/document/documentSchema.test.ts`                               |   201 | @vitest-environment node                                                                           |
| `src/domain/document/documentSchema.ts`                                    |   226 | TypeScript application module                                                                      |
| `src/domain/document/documentTestFixtures.ts`                              |   129 | TypeScript application module                                                                      |
| `src/domain/document/documentTypes.ts`                                     |   108 | TypeScript application module                                                                      |
| `src/domain/document/documentVersion.ts`                                   |     3 | The decrypted document version is independent from the SQLite envelope version.                    |
| `src/domain/document/elementPlacement.ts`                                  |    19 | Shared child-owned placement for cards and images; null denotes a root element.                    |
| `src/domain/document/invariants/canvasInvariants.ts`                       |   130 | TypeScript application module                                                                      |
| `src/domain/document/invariants/connectionInvariants.ts`                   |    55 | TypeScript application module                                                                      |
| `src/domain/document/invariants/entityRecordInvariants.ts`                 |    56 | TypeScript application module                                                                      |
| `src/domain/document/invariants/extensionInvariants.ts`                    |    52 | TypeScript application module                                                                      |
| `src/domain/document/jsonDeepEqual.test.ts`                                |    75 | @vitest-environment node                                                                           |
| `src/domain/document/jsonDeepEqual.ts`                                     |    84 | TypeScript application module                                                                      |
| `src/domain/document/jsonSafety.ts`                                        |   172 | TypeScript application module                                                                      |
| `src/domain/document/validateDocument.ts`                                  |    36 | TypeScript application module                                                                      |
| `src/domain/history/historyCompatibility.test.ts`                          |    91 | @vitest-environment node                                                                           |
| `src/domain/history/historyEngine.test.ts`                                 |   234 | @vitest-environment node                                                                           |
| `src/domain/history/historyEngine.ts`                                      |   159 | Canvas navigation is a non-history command. Compare every persistent content field while           |
| `src/domain/history/historyTypes.ts`                                       |    20 | TypeScript application module                                                                      |
| `src/domain/history/immerPatchSupport.ts`                                  |    10 | TypeScript application module                                                                      |
| `src/domain/history/transactionTypes.ts`                                   |    11 | TypeScript application module                                                                      |
| `src/domain/ids/entityIds.test.ts`                                         |    29 | @vitest-environment node                                                                           |
| `src/domain/ids/entityIds.ts`                                              |    74 | TypeScript application module                                                                      |
| `src/elements/architectureRegistries.test.ts`                              |    32 | Tests for the adjacent module                                                                      |
| `src/elements/cardContainerTestFixtures.ts`                                |    33 | TypeScript application module                                                                      |
| `src/elements/container/containerModel.test.ts`                            |    38 | @vitest-environment node                                                                           |
| `src/elements/container/containerModel.ts`                                 |    21 | TypeScript application module                                                                      |
| `src/elements/container/containerViewProjection.ts`                        |    12 | TypeScript application module                                                                      |
| `src/elements/elementDefinition.ts`                                        |    31 | TypeScript application module                                                                      |
| `src/elements/image/imageModel.test.ts`                                    |    84 | @vitest-environment node                                                                           |
| `src/elements/image/imageModel.ts`                                         |    40 | Current retained storage representations: raster imports become WebP; GIF/SVG remain native.       |
| `src/elements/image/imageTestFixtures.ts`                                  |    36 | TypeScript application module                                                                      |
| `src/elements/image/imageViewProjection.ts`                                |    40 | Deliberately no legacy imageId/hash, format or URL. The future renderer binding must use the       |
| `src/elements/mind-map/mindMapConnectionModel.ts`                          |    45 | The application supplies validated connectable capabilities, not feature type switches here.       |
| `src/elements/mind-map/mindMapConnectionViewProjection.ts`                 |    15 | TypeScript application module                                                                      |
| `src/elements/mind-map/mindMapModel.test.ts`                               |   102 | @vitest-environment node                                                                           |
| `src/elements/mind-map/mindMapModel.ts`                                    |    21 | Mind-map nodes are root, content-sized cards, with no text-card link/placement fields.             |
| `src/elements/mind-map/mindMapNodeViewProjection.ts`                       |    13 | The discriminant is only a retained-renderer prop, not the persisted type.                         |
| `src/elements/mind-map/mindMapTestFixtures.ts`                             |    43 | TypeScript application module                                                                      |
| `src/elements/registry.ts`                                                 |    12 | TypeScript application module                                                                      |
| `src/elements/text-block/textBlockModel.test.ts`                           |    50 | @vitest-environment node                                                                           |
| `src/elements/text-block/textBlockModel.ts`                                |    22 | TypeScript application module                                                                      |
| `src/elements/text-block/textBlockViewProjection.ts`                       |    12 | TypeScript application module                                                                      |
| `src/elements/text-card/normalizeTextCardLink.ts`                          |    21 | Retained link-entry policy. Normalization does not open a URL/path or grant workflow execution.    |
| `src/elements/text-card/textCardModel.test.ts`                             |    39 | @vitest-environment node                                                                           |
| `src/elements/text-card/textCardModel.ts`                                  |    24 | Placement is child-owned. Null means a root card; no redundant container child list.               |
| `src/elements/text-card/textCardViewProjection.ts`                         |    23 | Presentation-only: never serialize this shape or use it as a mutable document.                     |
| `src/extensions/architectureRegistry.ts`                                   |    33 | TypeScript application module                                                                      |
| `src/extensions/auto-checkbox/autoCheckboxDefinition.ts`                   |    20 | TypeScript application module                                                                      |
| `src/extensions/checkbox/checkboxDefinition.ts`                            |    20 | TypeScript application module                                                                      |
| `src/extensions/color-picker/colorPickerDefinition.ts`                     |    20 | TypeScript application module                                                                      |
| `src/extensions/copy-paste-json/copyPasteJsonDefinition.ts`                |    20 | TypeScript application module                                                                      |
| `src/extensions/copyPasteJson.test.ts`                                     |   216 | Tests for the adjacent module                                                                      |
| `src/extensions/copyPasteJson.ts`                                          |   171 | TypeScript application module                                                                      |
| `src/extensions/counter/counterDefinition.ts`                              |    20 | TypeScript application module                                                                      |
| `src/extensions/extensionDefinition.ts`                                    |    20 | TypeScript application module                                                                      |
| `src/extensions/inherit-card-color/inheritCardColorDefinition.ts`          |    20 | TypeScript application module                                                                      |
| `src/extensions/lock/lockDefinition.ts`                                    |    20 | TypeScript application module                                                                      |
| `src/extensions/privacy/privacyDefinition.ts`                              |    20 | TypeScript application module                                                                      |
| `src/extensions/registry.test.ts`                                          |    55 | Tests for the adjacent module                                                                      |
| `src/extensions/registry.ts`                                               |   203 | TypeScript application module                                                                      |
| `src/extensions/retainedDefinitions.test.ts`                               |    75 | @vitest-environment node                                                                           |
| `src/extensions/retainedExtensionDefinition.ts`                            |    54 | A typed compatibility projection attached to the existing registry definition, not a renderer.     |
| `src/extensions/search/searchDefinition.ts`                                |    21 | TypeScript application module                                                                      |
| `src/extensions/useExtensionDrag.ts`                                       |   117 | TypeScript application module                                                                      |
| `src/features/database-entry/databaseEntryErrors.ts`                       |    32 | TypeScript application module                                                                      |
| `src/features/database-entry/DatabaseEntryRaces.test.tsx`                  |   217 | Tests for the adjacent module                                                                      |
| `src/features/database-entry/databaseEntryTestSupport.tsx`                 |    77 | TypeScript application module                                                                      |
| `src/features/database-entry/databaseEntryTypes.ts`                        |     9 | TypeScript application module                                                                      |
| `src/features/database-entry/DatabasePasswordForm.tsx`                     |    88 | React component or typed UI module                                                                 |
| `src/features/database-entry/DatabaseSessionGate.test.tsx`                 |   168 | Tests for the adjacent module                                                                      |
| `src/features/database-entry/DatabaseSessionGate.tsx`                      |   181 | React component or typed UI module                                                                 |
| `src/features/database-entry/DatabaseWindowChrome.tsx`                     |    51 | React component or typed UI module                                                                 |
| `src/features/database-entry/preview/createDatabaseEntryPreview.ts`        |   163 | In-memory transport only: this fixture cannot invoke native databases, preferences or keyring.     |
| `src/features/database-entry/preview/createPreviewMediaClient.ts`          |    79 | The simulated picker returns an obvious built-in fixture, never a user file.                       |
| `src/features/database-entry/preview/createPreviewPreferencesClient.ts`    |    47 | TypeScript application module                                                                      |
| `src/features/database-entry/preview/databaseEntryPreview.test.ts`         |    34 | Tests for the adjacent module                                                                      |
| `src/features/database-entry/preview/main.tsx`                             |    42 | TypeScript application module                                                                      |
| `src/features/database-entry/useDatabaseEntry.ts`                          |   191 | View flow only. The injected application controller remains the sole session/workspace owner.      |
| `src/features/minimap/minimapProjection.test.ts`                           |    25 | @vitest-environment node                                                                           |
| `src/features/minimap/minimapProjection.ts`                                |    52 | TypeScript application module                                                                      |
| `src/features/phase2-database/DevelopmentPhase2Entry.test.tsx`             |    14 | Tests for the adjacent module                                                                      |
| `src/features/phase2-database/DevelopmentPhase2Entry.tsx`                  |    35 | React component or typed UI module                                                                 |
| `src/features/phase2-database/Phase2DatabaseHarness.tsx`                   |   236 | React component or typed UI module                                                                 |
| `src/features/phase2-database/Phase2DatabasePathControls.tsx`              |    74 | React component or typed UI module                                                                 |
| `src/features/phase2-database/phase2Document.ts`                           |    74 | TypeScript application module                                                                      |
| `src/features/phase2-database/Phase2HarnessHeader.tsx`                     |    20 | React component or typed UI module                                                                 |
| `src/features/phase2-database/phase2HarnessState.test.ts`                  |    59 | Tests for the adjacent module                                                                      |
| `src/features/phase2-database/phase2HarnessState.ts`                       |    58 | TypeScript application module                                                                      |
| `src/features/phase2-database/Phase2HarnessStatus.tsx`                     |    22 | React component or typed UI module                                                                 |
| `src/features/phase2-database/phase2HarnessTypes.ts`                       |     9 | TypeScript application module                                                                      |
| `src/features/phase2-database/phase2LockOperation.test.ts`                 |    68 | Tests for the adjacent module                                                                      |
| `src/features/phase2-database/phase2LockOperation.ts`                      |    23 | TypeScript application module                                                                      |
| `src/features/phase2-database/Phase2SessionActions.tsx`                    |   145 | React component or typed UI module                                                                 |
| `src/hooks/useAppUpdates.ts`                                               |   183 | TypeScript application module                                                                      |
| `src/hooks/useAutosave.test.tsx`                                           |    77 | Tests for the adjacent module                                                                      |
| `src/hooks/useAutosave.ts`                                                 |    79 | This hook deliberately accepts the caller's dependency list, matching                              |
| `src/hooks/useCanvasDocument.test.tsx`                                     |    64 | Tests for the adjacent module                                                                      |
| `src/hooks/useCanvasDocument.ts`                                           |   195 | TypeScript application module                                                                      |
| `src/hooks/useDiscordRpc.ts`                                               |    35 | TypeScript application module                                                                      |
| `src/hooks/useFrameStats.ts`                                               |    65 | TypeScript application module                                                                      |
| `src/hooks/useImageCache.test.tsx`                                         |   216 | Tests for the adjacent module                                                                      |
| `src/hooks/useImageCache.ts`                                               |   264 | TypeScript application module                                                                      |
| `src/legacy/importRetainedViewImage.test.ts`                               |    85 | Tests for the adjacent module                                                                      |
| `src/legacy/importRetainedViewImage.ts`                                    |    85 | TypeScript application module                                                                      |
| `src/legacy/interactions/legacyCameraPresentation.test.tsx`                |   149 | Tests for the adjacent module                                                                      |
| `src/legacy/interactions/legacyCameraSynchronization.test.ts`              |   100 | @vitest-environment node                                                                           |
| `src/legacy/interactions/legacyCameraSynchronization.ts`                   |    83 | TypeScript application module                                                                      |
| `src/legacy/interactions/legacyCanvasGeometry.test.ts`                     |    93 | @vitest-environment node                                                                           |
| `src/legacy/interactions/legacyCanvasGeometry.ts`                          |   120 | TypeScript application module                                                                      |
| `src/legacy/interactions/legacyCanvasInteractionCommitAdapter.test.ts`     |   197 | @vitest-environment node                                                                           |
| `src/legacy/interactions/legacyCanvasInteractionCommitAdapter.ts`          |   170 | TypeScript application module                                                                      |
| `src/legacy/interactions/legacyCanvasInteractionIntegration.test.ts`       |   146 | @vitest-environment node                                                                           |
| `src/legacy/interactions/LegacyCanvasVisibility.tsx`                       |    44 | React component or typed UI module                                                                 |
| `src/legacy/interactions/legacySelectionCompatibility.test.ts`             |    32 | @vitest-environment node                                                                           |
| `src/legacy/interactions/legacySelectionCompatibility.ts`                  |    12 | TypeScript application module                                                                      |
| `src/legacy/interactions/legacyTextCardDragPresentation.test.ts`           |    39 | @vitest-environment node                                                                           |
| `src/legacy/interactions/legacyTextCardDragPresentation.ts`                |    19 | TypeScript application module                                                                      |
| `src/legacy/interactions/legacyTextCardDrop.ts`                            |   183 | TypeScript application module                                                                      |
| `src/legacy/interactions/legacyTextCardInteraction.test.ts`                |   351 | @vitest-environment node                                                                           |
| `src/legacy/interactions/legacyTextCardInteraction.ts`                     |   257 | TypeScript application module                                                                      |
| `src/legacy/interactions/legacyTextCardModifierTransition.test.ts`         |   118 | @vitest-environment node                                                                           |
| `src/legacy/interactions/legacyTextCardModifierTransition.ts`              |    38 | TypeScript application module                                                                      |
| `src/legacy/interactions/legacyTextCardPlacement.test.ts`                  |    53 | @vitest-environment node                                                                           |
| `src/legacy/interactions/legacyTextCardPlacement.ts`                       |   312 | TypeScript application module                                                                      |
| `src/legacy/interactions/retainedDropIntegration.test.ts`                  |   210 | @vitest-environment node                                                                           |
| `src/legacy/interactions/retainedDropTestSupport.ts`                       |   140 | TypeScript application module                                                                      |
| `src/legacy/interactions/retainedInteractionGeometry.test.ts`              |   111 | @vitest-environment node                                                                           |
| `src/legacy/interactions/retainedInteractionGeometry.ts`                   |   110 | Unmounted compatibility boundary. Reuse retained geometry/placement calculations rather than       |
| `src/legacy/interactions/useLegacyCameraPresentation.ts`                   |    52 | A selection overlay can mount after the controller publication that created it.                    |
| `src/legacy/interactions/useLegacyInteractionSnapshot.ts`                  |    26 | TypeScript application module                                                                      |
| `src/legacy/LegacyApplication.tsx`                                         |    10 | React component or typed UI module                                                                 |
| `src/legacy/materials/legacyBackdropPanelPrimitives.ts`                    |    80 | TypeScript application module                                                                      |
| `src/legacy/materials/legacyBackdropScene.test.ts`                         |   262 | Tests for the adjacent module                                                                      |
| `src/legacy/materials/legacyBackdropScene.ts`                              |   250 | TypeScript application module                                                                      |
| `src/legacy/materials/legacyBackdropSceneRevision.ts`                      |    35 | TypeScript application module                                                                      |
| `src/legacy/RetainedCanvasApplication.test.tsx`                            |   244 | Tests for the adjacent module                                                                      |
| `src/legacy/RetainedCanvasApplication.tsx`                                 |    77 | Native/session revocation must remove editors and portals before returning.                        |
| `src/legacy/RetainedCanvasContext.tsx`                                     |    70 | React component or typed UI module                                                                 |
| `src/legacy/RetainedImageNode.test.tsx`                                    |   124 | Tests for the adjacent module                                                                      |
| `src/legacy/RetainedImageNode.tsx`                                         |    38 | React component or typed UI module                                                                 |
| `src/legacy/retainedViewClipboard.test.ts`                                 |   116 | @vitest-environment node                                                                           |
| `src/legacy/retainedViewClipboard.ts`                                      |   145 | TypeScript application module                                                                      |
| `src/legacy/retainedViewCreation.ts`                                       |   101 | TypeScript application module                                                                      |
| `src/legacy/retainedViewExtensions.test.ts`                                |    67 | @vitest-environment node                                                                           |
| `src/legacy/retainedViewExtensions.ts`                                     |    60 | TypeScript application module                                                                      |
| `src/legacy/retainedViewJsonEdit.test.ts`                                  |    59 | @vitest-environment node                                                                           |
| `src/legacy/retainedViewJsonEdit.ts`                                       |    39 | TypeScript application module                                                                      |
| `src/legacy/useLegacyCanvasSettings.ts`                                    |    59 | TypeScript application module                                                                      |
| `src/legacy/useRetainedCanvasSettings.test.tsx`                            |    86 | Tests for the adjacent module                                                                      |
| `src/legacy/useRetainedCanvasSettings.ts`                                  |   171 | TypeScript application module                                                                      |
| `src/main.tsx`                                                             |    14 | TypeScript application module                                                                      |
| `src/mindmapMath.test.ts`                                                  |    42 | Tests for the adjacent module                                                                      |
| `src/mindmapMath.ts`                                                       |    83 | TypeScript application module                                                                      |
| `src/platform/database/applicationDatabaseTestSupport.ts`                  |    24 | TypeScript application module                                                                      |
| `src/platform/database/createValidatedDatabaseClient.ts`                   |   259 | TypeScript application module                                                                      |
| `src/platform/database/databaseClient.ts`                                  |    25 | TypeScript application module                                                                      |
| `src/platform/database/databaseDocumentCodec.ts`                           |    37 | TypeScript application module                                                                      |
| `src/platform/database/databaseSessionTransport.test.ts`                   |   148 | @vitest-environment node                                                                           |
| `src/platform/database/databaseTypes.ts`                                   |    55 | TypeScript application module                                                                      |
| `src/platform/database/nativeSessionEvents.ts`                             |     5 | TypeScript application module                                                                      |
| `src/platform/database/retainedCanvasBindingTransport.test.ts`             |    84 | @vitest-environment node                                                                           |
| `src/platform/database/retainedDatabaseTransport.test.ts`                  |   178 | @vitest-environment node                                                                           |
| `src/platform/database/tauriApplicationDatabase.test.ts`                   |   170 | @vitest-environment node                                                                           |
| `src/platform/database/tauriApplicationDatabase.ts`                        |    55 | TypeScript application module                                                                      |
| `src/platform/database/tauriDatabaseClient.test.ts`                        |   160 | Tests for the adjacent module                                                                      |
| `src/platform/database/tauriDatabaseClient.ts`                             |     5 | Development harness only. Production composition uses the edition-checked application factory.     |
| `src/platform/media/applicationMediaClient.test.ts`                        |   188 | @vitest-environment node                                                                           |
| `src/platform/media/applicationMediaClient.ts`                             |   205 | Also release on mismatch, cancellation and malformed chunks. Native lock already                   |
| `src/platform/media/imageDropClient.ts`                                    |    17 | TypeScript application module                                                                      |
| `src/platform/media/mediaClient.ts`                                        |    10 | TypeScript application module                                                                      |
| `src/platform/media/mediaTypes.ts`                                         |    17 | TypeScript application module                                                                      |
| `src/platform/platformErrors.ts`                                           |    30 | TypeScript application module                                                                      |
| `src/platform/settings/applicationPreferencesClient.test.ts`               |    55 | @vitest-environment node                                                                           |
| `src/platform/settings/applicationPreferencesClient.ts`                    |    90 | TypeScript application module                                                                      |
| `src/platform/settings/preferenceContracts.ts`                             |    58 | TypeScript application module                                                                      |
| `src/platform/settings/settingsClient.ts`                                  |    14 | TypeScript application module                                                                      |
| `src/platform/settings/settingsTypes.ts`                                   |    14 | TypeScript application module                                                                      |
| `src/platform/settings/tauriSettingsClient.ts`                             |    16 | TypeScript application module                                                                      |
| `src/platform/tauriInvoke.ts`                                              |    72 | TypeScript application module                                                                      |
| `src/platform/window/tauriWindowChromeClient.ts`                           |    26 | TypeScript application module                                                                      |
| `src/platform/window/tauriWindowCloseClient.test.ts`                       |    35 | Tests for the adjacent module                                                                      |
| `src/platform/window/tauriWindowCloseClient.ts`                            |    26 | TypeScript application module                                                                      |
| `src/platform/window/windowPrivacyClient.ts`                               |    23 | TypeScript application module                                                                      |
| `src/platform/workflow/workflowClient.ts`                                  |    10 | TypeScript application module                                                                      |
| `src/platform/workflow/workflowTypes.ts`                                   |    20 | TypeScript application module                                                                      |
| `src/test/domHitTesting.test.ts`                                           |     6 | Tests for the adjacent module                                                                      |
| `src/test/setup.ts`                                                        |    33 | jsdom has no layout/hit testing. For ordinary dispatched clicks, the event target is the           |
| `src/types.ts`                                                             |   418 | TypeScript application module                                                                      |
| `src/ui-lab/ContextMenuPlayground.tsx`                                     |   197 | React component or typed UI module                                                                 |
| `src/ui-lab/DraggableTextBlockFixture.test.tsx`                            |    90 | Tests for the adjacent module                                                                      |
| `src/ui-lab/DraggableTextBlockFixture.tsx`                                 |   207 | React component or typed UI module                                                                 |
| `src/ui-lab/FormControlsPrototype.test.tsx`                                |    64 | Tests for the adjacent module                                                                      |
| `src/ui-lab/FormControlsPrototype.tsx`                                     |    98 | React component or typed UI module                                                                 |
| `src/ui-lab/glass-proof/GlassRenderingProof.test.tsx`                      |    69 | Geometry/pixels are verified in WebView2, not simulated by this structural test.                   |
| `src/ui-lab/glass-proof/GlassRenderingProof.tsx`                           |   185 | React component or typed UI module                                                                 |
| `src/ui-lab/glass-proof/useProofBackdrop.ts`                               |    84 | TypeScript application module                                                                      |
| `src/ui-lab/InteractiveControlsPrototype.test.tsx`                         |    61 | Tests for the adjacent module                                                                      |
| `src/ui-lab/InteractiveControlsPrototype.tsx`                              |   236 | React component or typed UI module                                                                 |
| `src/ui-lab/main.tsx`                                                      |    15 | TypeScript application module                                                                      |
| `src/ui-lab/MaterialAwarePresencePrototype.tsx`                            |   280 | React component or typed UI module                                                                 |
| `src/ui-lab/QuickExtensionsMenuPlayground.tsx`                             |   148 | React component or typed UI module                                                                 |
| `src/ui-lab/SurfaceMaterialPrototype.test.tsx`                             |    57 | Tests for the adjacent module                                                                      |
| `src/ui-lab/SurfaceMaterialPrototype.tsx`                                  |   150 | React component or typed UI module                                                                 |
| `src/ui-lab/system/Material.test.ts`                                       |    18 | Tests for the adjacent module                                                                      |
| `src/ui-lab/system/Material.ts`                                            |    15 | React component or typed UI module                                                                 |
| `src/ui-lab/system/presenceController.ts`                                  |   209 | TypeScript application module                                                                      |
| `src/ui-lab/system/PresenceSystem.test.tsx`                                |   206 | Tests for the adjacent module                                                                      |
| `src/ui-lab/system/Surface.test.tsx`                                       |    98 | Tests for the adjacent module                                                                      |
| `src/ui-lab/system/Surface.tsx`                                            |    39 | React component or typed UI module                                                                 |
| `src/ui-lab/system/useSurfacePresence.ts`                                  |    70 | TypeScript application module                                                                      |
| `src/ui-lab/TopBarControlsPrototype.tsx`                                   |    45 | React component or typed UI module                                                                 |
| `src/ui-lab/UiLabApp.test.tsx`                                             |    74 | Tests for the adjacent module                                                                      |
| `src/ui-lab/UiLabApp.tsx`                                                  |   122 | React component or typed UI module                                                                 |
| `src/ui/dev/AcrylicCompositorPlayground.test.tsx`                          |   108 | Tests for the adjacent module                                                                      |
| `src/ui/dev/AcrylicCompositorPlayground.tsx`                               |   246 | React component or typed UI module                                                                 |
| `src/ui/dev/acrylicPlaygroundModel.test.ts`                                |    95 | Tests for the adjacent module                                                                      |
| `src/ui/dev/acrylicPlaygroundModel.ts`                                     |   202 | TypeScript application module                                                                      |
| `src/ui/dev/ButtonMaterialTests.tsx`                                       |   163 | React component or typed UI module                                                                 |
| `src/ui/dev/containerContextMenuFixture.ts`                                |    34 | TypeScript application module                                                                      |
| `src/ui/dev/ContextMenuDemo.tsx`                                           |   198 | React component or typed UI module                                                                 |
| `src/ui/dev/contextMenuMaterialIntegration.test.tsx`                       |    47 | Tests for the adjacent module                                                                      |
| `src/ui/dev/DevelopmentUiLab.test.tsx`                                     |   121 | Tests for the adjacent module                                                                      |
| `src/ui/dev/DevelopmentUiLab.tsx`                                          |   277 | React component or typed UI module                                                                 |
| `src/ui/keyboard/blockTabKeyNavigation.test.ts`                            |    23 | Tests for the adjacent module                                                                      |
| `src/ui/keyboard/blockTabKeyNavigation.ts`                                 |    13 | Forms can opt into native traversal; the canvas keeps its existing shortcut behavior.              |
| `src/ui/materials/compositor/acrylicBitmapResource.ts`                     |    30 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/acrylicBuildExecutor.ts`                      |    40 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/acrylicCache.worker.ts`                       |    23 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/acrylicCacheRuntime.test.ts`                  |   289 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/acrylicCacheRuntime.ts`                       |   245 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/acrylicCanvas.ts`                             |    43 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/acrylicWorkerExecutor.test.ts`                |   263 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/acrylicWorkerExecutor.ts`                     |   176 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/acrylicWorkerFactory.ts`                      |     7 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/acrylicWorkerProtocol.test.ts`                |   107 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/acrylicWorkerProtocol.ts`                     |   209 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/acrylicWorkerRuntime.test.ts`                 |    98 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/acrylicWorkerRuntime.ts`                      |    63 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/adaptiveQuality.test.ts`                      |   125 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/adaptiveQuality.ts`                           |    83 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/backdropScene.test.ts`                        |   109 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/backdropScene.ts`                             |    71 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/backdropSceneValidation.ts`                   |   204 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/browserAcrylicRuntime.test.ts`                |   101 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/browserAcrylicRuntime.ts`                     |    71 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/cacheCoverage.test.ts`                        |   192 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/cacheCoverage.ts`                             |   143 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/cacheReprojection.test.ts`                    |    46 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/cacheReprojection.ts`                         |    37 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/cacheResourceOwner.test.ts`                   |   108 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/cacheResourceOwner.ts`                        |    67 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/cacheScheduler.test.ts`                       |   246 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/cacheScheduler.ts`                            |   116 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/compositorCapabilities.test.ts`               |   105 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/compositorCapabilities.ts`                    |   121 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/compositorInvalidation.test.ts`               |    78 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/compositorInvalidation.ts`                    |    71 | Explicit output-buffer resize work for B2.                                                         |
| `src/ui/materials/compositor/compositorOutputPlanes.test.ts`               |   133 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/compositorOutputPlanes.ts`                    |   181 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/compositorTestFixtures.ts`                    |   235 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/compositorTypes.ts`                           |   175 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/frameCoalescing.test.ts`                      |    59 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/frameCoalescing.ts`                           |    59 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/mainThreadAcrylicBackend.ts`                  |    52 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/mainThreadAcrylicExecutor.test.ts`            |    83 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/mainThreadAcrylicExecutor.ts`                 |    54 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/offscreenAcrylicBackend.ts`                   |    51 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/sceneRasterizer.test.ts`                      |   245 | @vitest-environment node                                                                           |
| `src/ui/materials/compositor/sceneRasterizer.ts`                           |   235 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/sharedAcrylicCacheBuilder.ts`                 |    66 | TypeScript application module                                                                      |
| `src/ui/materials/compositor/sharedAcrylicProfile.ts`                      |    56 | TypeScript application module                                                                      |
| `src/ui/materials/FrostedSurface.test.tsx`                                 |    22 | Tests for the adjacent module                                                                      |
| `src/ui/materials/FrostedSurface.tsx`                                      |    15 | React component or typed UI module                                                                 |
| `src/ui/materials/frostedSurfaceTypes.ts`                                  |     6 | TypeScript application module                                                                      |
| `src/ui/materials/legacyCachedAcrylicDefinitions.ts`                       |    71 | TypeScript application module                                                                      |
| `src/ui/materials/MaterialAcrylicProof.tsx`                                |    16 | React component or typed UI module                                                                 |
| `src/ui/materials/materialCompositorCachePolicy.ts`                        |    80 | TypeScript application module                                                                      |
| `src/ui/materials/materialCompositorCoordinator.test.ts`                   |   299 | @vitest-environment node                                                                           |
| `src/ui/materials/materialCompositorCoordinator.ts`                        |   248 | TypeScript application module                                                                      |
| `src/ui/materials/materialCompositorCoordinatorTestHarness.ts`             |   128 | TypeScript application module                                                                      |
| `src/ui/materials/materialCompositorDiagnostics.ts`                        |    72 | TypeScript application module                                                                      |
| `src/ui/materials/materialCompositorPresentation.ts`                       |    47 | TypeScript application module                                                                      |
| `src/ui/materials/MaterialCompositorProvider.tsx`                          |    17 | React component or typed UI module                                                                 |
| `src/ui/materials/materialDefinitions.ts`                                  |   125 | TypeScript application module                                                                      |
| `src/ui/materials/materialGeometryInvalidation.test.ts`                    |    25 | Tests for the adjacent module                                                                      |
| `src/ui/materials/materialGeometryInvalidation.ts`                         |    74 | Native backdrop invalidation follows real scene/style changes. This bounded settlement             |
| `src/ui/materials/materialGeometryScheduler.test.ts`                       |   240 | Tests for the adjacent module                                                                      |
| `src/ui/materials/materialGeometryScheduler.ts`                            |   185 | TypeScript application module                                                                      |
| `src/ui/materials/materialPerformanceDiagnostics.ts`                       |    23 | TypeScript application module                                                                      |
| `src/ui/materials/MaterialPlane.tsx`                                       |    18 | React component or typed UI module                                                                 |
| `src/ui/materials/materialPresence.test.ts`                                |    27 | Tests for the adjacent module                                                                      |
| `src/ui/materials/materialPresence.ts`                                     |    15 | TypeScript application module                                                                      |
| `src/ui/materials/materialRegistry.test.ts`                                |   144 | Tests for the adjacent module                                                                      |
| `src/ui/materials/materialRegistry.ts`                                     |    38 | TypeScript application module                                                                      |
| `src/ui/materials/materialSamplingBoundary.test.ts`                        |    27 | @vitest-environment node                                                                           |
| `src/ui/materials/materialSamplingBoundary.tsx`                            |    84 | TypeScript application module                                                                      |
| `src/ui/materials/MaterialSurface.test.tsx`                                |   331 | Tests for the adjacent module                                                                      |
| `src/ui/materials/MaterialSurface.tsx`                                     |   189 | React component or typed UI module                                                                 |
| `src/ui/materials/MaterialSurfaceRegistration.tsx`                         |   131 | React component or typed UI module                                                                 |
| `src/ui/materials/materialSurfaceRegistry.test.ts`                         |   151 | @vitest-environment node                                                                           |
| `src/ui/materials/materialSurfaceRegistry.ts`                              |   260 | TypeScript application module                                                                      |
| `src/ui/materials/materialSurfaceStyle.ts`                                 |    98 | A filter-output mask avoids making an ancestor a new backdrop root. The SVG viewport               |
| `src/ui/materials/materialTypes.ts`                                        |   112 | TypeScript application module                                                                      |
| `src/ui/materials/nativeGlassGeometry.ts`                                  |    93 | TypeScript application module                                                                      |
| `src/ui/materials/nativeGlassProduction.test.tsx`                          |    75 | Tests for the adjacent module                                                                      |
| `src/ui/materials/nativeGlassRim.test.ts`                                  |    41 | @vitest-environment node                                                                           |
| `src/ui/materials/nativeGlassRim.ts`                                       |   162 | TypeScript application module                                                                      |
| `src/ui/materials/SharedSmallGlassPlane.test.tsx`                          |   123 | Tests for the adjacent module                                                                      |
| `src/ui/materials/SharedSmallGlassPlane.tsx`                               |   257 | React component or typed UI module                                                                 |
| `src/ui/motion/layoutMotion.test.ts`                                       |   104 | One shared frame remains pending only while motion subscribers are active.                         |
| `src/ui/motion/layoutMotion.ts`                                            |    89 | TypeScript application module                                                                      |
| `src/ui/motion/liquidIndicatorMotion.test.ts`                              |   144 | Tests for the adjacent module                                                                      |
| `src/ui/motion/liquidIndicatorMotion.ts`                                   |   124 | TypeScript application module                                                                      |
| `src/ui/motion/liquidMaterialIntegration.test.ts`                          |    39 | @vitest-environment node                                                                           |
| `src/ui/motion/liquidToggleMotion.test.ts`                                 |    58 | Tests for the adjacent module                                                                      |
| `src/ui/motion/liquidToggleMotion.ts`                                      |    79 | TypeScript application module                                                                      |
| `src/ui/motion/motionFrameScheduler.test.ts`                               |    86 | Tests for the adjacent module                                                                      |
| `src/ui/motion/motionFrameScheduler.ts`                                    |    91 | TypeScript application module                                                                      |
| `src/ui/motion/motionMath.test.ts`                                         |    53 | Tests for the adjacent module                                                                      |
| `src/ui/motion/motionMath.ts`                                              |   103 | TypeScript application module                                                                      |
| `src/ui/motion/MotionProvider.tsx`                                         |    22 | React component or typed UI module                                                                 |
| `src/ui/motion/motionTokens.ts`                                            |    41 | Central Phase 4.5C motion values; these are UI-motion values, not compositor constants.            |
| `src/ui/motion/reducedMotionPreference.test.ts`                            |    55 | Tests for the adjacent module                                                                      |
| `src/ui/motion/reducedMotionPreference.ts`                                 |    65 | TypeScript application module                                                                      |
| `src/ui/patterns/overlays/index.ts`                                        |     6 | TypeScript application module                                                                      |
| `src/ui/patterns/overlays/ModalDialog.tsx`                                 |    24 | React component or typed UI module                                                                 |
| `src/ui/patterns/overlays/ModalLayer.tsx`                                  |    58 | React component or typed UI module                                                                 |
| `src/ui/patterns/overlays/modalMotion.ts`                                  |    54 | TypeScript application module                                                                      |
| `src/ui/patterns/overlays/ModalPresence.test.tsx`                          |   333 | Tests for the adjacent module                                                                      |
| `src/ui/patterns/overlays/ModalPresence.tsx`                               |   135 | React component or typed UI module                                                                 |
| `src/ui/patterns/overlays/modalPresenceTestHarness.tsx`                    |   121 | One shared pending frame advances every active modal subscriber.                                   |
| `src/ui/patterns/overlays/useDialogFocus.ts`                               |    59 | TypeScript application module                                                                      |
| `src/ui/patterns/settings/index.ts`                                        |     2 | TypeScript application module                                                                      |
| `src/ui/patterns/settings/SettingsPatterns.tsx`                            |   121 | React component or typed UI module                                                                 |
| `src/ui/patterns/workspace/CanvasBrowserCard.tsx`                          |    78 | React component or typed UI module                                                                 |
| `src/ui/patterns/workspace/canvasBrowserDom.ts`                            |   132 | Read shared coordinate spaces before presentation writes, including activation's card rect.        |
| `src/ui/patterns/workspace/canvasBrowserInteraction.test.ts`               |    62 | @vitest-environment node                                                                           |
| `src/ui/patterns/workspace/canvasBrowserInteraction.ts`                    |   115 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/canvasBrowserLayout.ts`                         |    35 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/CanvasBrowserRuntime.test.ts`                   |   291 | Tests for the adjacent module                                                                      |
| `src/ui/patterns/workspace/CanvasBrowserRuntime.ts`                        |   383 | React component or typed UI module                                                                 |
| `src/ui/patterns/workspace/canvasBrowserRuntimeState.ts`                   |    38 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/canvasBrowserRuntimeTestFixture.ts`             |   144 | The production runtime owns one pending frame at a time.                                           |
| `src/ui/patterns/workspace/canvasBrowserRuntimeTypes.ts`                   |    44 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/canvasBrowserScrollState.test.ts`               |    41 | @vitest-environment node                                                                           |
| `src/ui/patterns/workspace/canvasBrowserScrollState.ts`                    |    89 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/canvasBrowserSharedGlass.ts`                    |    94 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/canvasBrowserSlotGeometry.ts`                   |   106 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/canvasBrowserViewport.ts`                       |    82 | Every host keeps the same untransformed ancestor; scroll is part of its own translation.           |
| `src/ui/patterns/workspace/canvasBrowserWheelDelta.ts`                     |    11 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/canvasCardPointerSession.ts`                    |    59 | Document listeners remain authoritative when pointer capture is unavailable.                       |
| `src/ui/patterns/workspace/CanvasFrame.tsx`                                |    15 | React component or typed UI module                                                                 |
| `src/ui/patterns/workspace/ExtensionBrowserCard.tsx`                       |    53 | React component or typed UI module                                                                 |
| `src/ui/patterns/workspace/FloatingCanvasToolbar.tsx`                      |    46 | React component or typed UI module                                                                 |
| `src/ui/patterns/workspace/GlassListFrame.tsx`                             |    36 | React component or typed UI module                                                                 |
| `src/ui/patterns/workspace/glassListGeometry.test.ts`                      |    30 | Tests for the adjacent module                                                                      |
| `src/ui/patterns/workspace/glassListGeometry.ts`                           |    33 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/glassListScrollGeometry.test.ts`                |    59 | Tests for the adjacent module                                                                      |
| `src/ui/patterns/workspace/glassListScrollGeometry.ts`                     |   120 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/index.ts`                                       |     9 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/MinimapSurface.test.tsx`                        |   148 | One pending shared frame advances all active subscribers.                                          |
| `src/ui/patterns/workspace/MinimapSurface.tsx`                             |    56 | React component or typed UI module                                                                 |
| `src/ui/patterns/workspace/useMinimapVisibilityMotion.ts`                  |    57 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/useSettledPanelWork.ts`                         |    28 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/useSharedSmallGlassList.ts`                     |    73 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/useWorkspaceSidePanelMotion.ts`                 |    95 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/workspaceFoundation.test.tsx`                   |   105 | Tests for the adjacent module                                                                      |
| `src/ui/patterns/workspace/workspacePanelContentSize.ts`                   |    17 | TypeScript application module                                                                      |
| `src/ui/patterns/workspace/WorkspaceRoot.tsx`                              |    42 | React component or typed UI module                                                                 |
| `src/ui/patterns/workspace/WorkspaceSidePanel.test.tsx`                    |   215 | The shared scheduler queues at most one next frame while subscribers remain active.                |
| `src/ui/patterns/workspace/WorkspaceSidePanel.tsx`                         |   219 | React component or typed UI module                                                                 |
| `src/ui/primitives/AcrylicConfirmButton.tsx`                               |   103 | React component or typed UI module                                                                 |
| `src/ui/primitives/AcrylicToggleButton.test.tsx`                           |   114 | Tests for the adjacent module                                                                      |
| `src/ui/primitives/AcrylicToggleButton.tsx`                                |   103 | React component or typed UI module                                                                 |
| `src/ui/primitives/AnimatedCheckbox.tsx`                                   |    34 | React component or typed UI module                                                                 |
| `src/ui/primitives/Button.tsx`                                             |   107 | React component or typed UI module                                                                 |
| `src/ui/primitives/buttonMaterialControls.test.tsx`                        |   145 | Tests for the adjacent module                                                                      |
| `src/ui/primitives/ContextMenu.test.tsx`                                   |   167 | Real user-event timers may finish the exit before this assertion on a busy runner.                 |
| `src/ui/primitives/ContextMenu.tsx`                                        |   210 | React component or typed UI module                                                                 |
| `src/ui/primitives/ContextMenuParts.tsx`                                   |   108 | React component or typed UI module                                                                 |
| `src/ui/primitives/Field.tsx`                                              |    87 | React component or typed UI module                                                                 |
| `src/ui/primitives/FloatingPanel.tsx`                                      |   122 | React component or typed UI module                                                                 |
| `src/ui/primitives/FormControls.tsx`                                       |   170 | React component or typed UI module                                                                 |
| `src/ui/primitives/index.ts`                                               |    19 | TypeScript application module                                                                      |
| `src/ui/primitives/Layout.tsx`                                             |   119 | React component or typed UI module                                                                 |
| `src/ui/primitives/LiquidSelectionIndicator.tsx`                           |   121 | React component or typed UI module                                                                 |
| `src/ui/primitives/LiquidTabs.motion.test.tsx`                             |   235 | A shared scheduler may enqueue the next frame while processing this one.                           |
| `src/ui/primitives/LiquidTabs.tsx`                                         |   264 | React component or typed UI module                                                                 |
| `src/ui/primitives/LiquidToggleSwitch.tsx`                                 |   118 | React component or typed UI module                                                                 |
| `src/ui/primitives/primitiveClassNames.ts`                                 |     6 | TypeScript application module                                                                      |
| `src/ui/primitives/primitives.test.tsx`                                    |   147 | Tests for the adjacent module                                                                      |
| `src/ui/primitives/SelectionControls.tsx`                                  |   187 | React component or typed UI module                                                                 |
| `src/ui/primitives/Status.tsx`                                             |   108 | React component or typed UI module                                                                 |
| `src/ui/primitives/tabListBehavior.ts`                                     |    52 | TypeScript application module                                                                      |
| `src/ui/primitives/Tabs.test.tsx`                                          |   104 | Tests for the adjacent module                                                                      |
| `src/ui/primitives/Tabs.tsx`                                               |    58 | React component or typed UI module                                                                 |
| `src/ui/primitives/Tooltip.tsx`                                            |   127 | React component or typed UI module                                                                 |
| `src/ui/primitives/Typography.tsx`                                         |    26 | React component or typed UI module                                                                 |
| `src/ui/primitives/usePressSpringScale.ts`                                 |    71 | TypeScript application module                                                                      |
| `src/ui/theme/theme.test.tsx`                                              |    72 | Tests for the adjacent module                                                                      |
| `src/ui/theme/workspaceVisualValues.ts`                                    |    27 | TypeScript application module                                                                      |
| `src/useClampedFixedPosition.ts`                                           |    36 | TypeScript application module                                                                      |
| `src/utils/date.ts`                                                        |     5 | TypeScript application module                                                                      |

<!-- GENERATED-INVENTORY:END -->
