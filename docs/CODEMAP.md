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

Application composition, Redux store setup, command dispatch, selectors, and lifecycle coordination. `AppShell.tsx` remains thin.

### `src/domain/`

Pure TypeScript document model, schemas, invariants, commands, history types, and workflow model. No React, Tauri, or DOM imports.

### `src/canvas/`

Viewport rendering, geometry, snapping, culling, layers, and transient interaction controllers.

### `src/elements/`

One self-contained module per element type. Explicit registry at `src/elements/registry.ts`.

### `src/extensions/`

One self-contained module per retained extension. Explicit registry at `src/extensions/registry.ts`.

### `src/features/`

Product features not represented as element or extension modules: canvas manager, minimap, database picker, Workflow Runner, settings, and updates.

### `src/platform/`

Typed frontend boundary for Tauri commands. This is the only frontend area allowed to import Tauri APIs.

### `src/ui/`

Shared presentation primitives. `src/ui/materials/FrostedSurface.tsx` is the only implementation of the retained frosted blur material.

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

The detailed inventory has not been generated in the connector environment yet. Run `npm run codemap` in a local checkout.

<!-- GENERATED-INVENTORY:END -->
