# TaskMap Agent Rules

These rules apply to all automated and human changes on `architecture-v1`.

## Product contract

TaskMap is a fast, local-first Windows canvas application.

Retain the product behavior recorded in `docs/FEATURE-PARITY.md` unless a newer accepted contract
explicitly approves a change.

The current UI redesign is governed by:

- `docs/UI-SYSTEM-CONTRACT.md`
- `docs/GLASS-SYSTEM-CONTRACT.md`
- `docs/UI-QUALITY-GUARDRAILS.md`

The old visual/UI plans they supersede are historical only and must not be used as current authority.

Removed product features remain removed: Discord Rich Presence, daily reset, sorting, pick-a-card,
production frosted-glass tuner, legacy migrations inside the main app, keyring-based encryption, and
the old raw Command Runner.

The structured Workflow Runner remains the replacement for the old raw runner.

## Mandatory architecture

1. `AppShell.tsx` is composition only.
2. Persistent document changes go through named domain/application commands.
3. Transient pointer state belongs to interaction controllers, not the persistent document store.
4. Domain code must not import React, Tauri, DOM APIs or presentation components.
5. Only `src/platform/` may import Tauri APIs.
6. Rust storage/session services own database, encryption, file locking and atomic file operations.
7. TypeScript owns the decrypted document schema and domain invariants.
8. Media bytes never enter Redux; use opaque IDs and lazy/session-bound media services.
9. History records completed domain transactions, not pointer/UI samples.
10. Element and extension types are registered explicitly.
11. Stable and development editions remain isolated by identity/config/session/update resources.
12. Main-product code contains no legacy data migrations.

## Current migration boundary

The normalized database/workspace/command/history/persistence system is the production data owner.

Retained presentation may still pass through legacy `App.tsx` while Phase 5 migrates feature
renderers. Do not use UI/glass work as an excuse for a broad `App.tsx` rewrite.

## File/module rules

- Prefer one clear responsibility per file.
- Target fewer than 250 lines where practical.
- Files over 400 lines require a real subsystem reason.
- Do not create generic `utils.ts`, `helpers.ts` or `common.ts` dumping grounds.
- Do not split files merely to reduce line count.
- Keep tiny one-use helpers/types with their owner unless separation establishes a meaningful
  dependency/ownership boundary.
- Update `docs/CODEMAP.md` when subsystem ownership changes.

## Dependency direction

Allowed:

```text
UI -> application commands/selectors -> domain
UI -> interaction -> application completion ports
application -> domain
application -> platform interfaces
platform adapters -> Tauri
Rust commands -> services -> database/crypto/filesystem
```

Forbidden:

```text
domain -> React/Tauri/DOM
platform -> UI
component -> direct database/history/encryption/filesystem mutation
feature -> private material renderer internals
```

## UI rules

- `MaterialSurface`/the final Surface+Material boundary owns material implementation.
- Features must not create raw backdrop filters, overscan math, repaint hacks or competing material
  renderers.
- Reusable controls follow `UI-QUALITY-GUARDRAILS.md`.
- Glass behavior follows `GLASS-SYSTEM-CONTRACT.md`.
- The development UI Lab/workbench may expose material tuning; no production visual tuner is shipped.
- Existing old visual docs do not override the current contracts.

## Performance rules

Optimize interaction for maximum practical throughput and low frame-time variance.

Do not treat 60 FPS as the design ceiling.

Pointer/camera/scroll frames must not:

- serialize/encrypt/save;
- create history entries;
- perform database work;
- broadly rerender application state.

Pure translation should avoid geometry measurement and material reconstruction.

Final performance acceptance is defined in `docs/TESTING.md` and
`docs/GLASS-SYSTEM-CONTRACT.md`.

## Security rules

- Never persist or log raw database passwords/derived keys/plaintext document content.
- Use Argon2id + authenticated encryption according to `docs/SECURITY.md`.
- Purge session-sensitive resources on the established lock/quit/session-revocation boundaries.
- Imported workflows remain disabled until explicitly trusted.

## Refactor workflow

Before substantial work:

1. read `docs/REFACTOR-STATE.md`;
2. read the active section of `docs/REFACTOR-ROADMAP.md`;
3. read `docs/AI-WORKFLOW.md`;
4. read the relevant subsystem contract;
5. inspect the current implementation/diff.

Conversation memory is not the repository source of truth.

After meaningful work:

- update `docs/REFACTOR-STATE.md`;
- append useful history/measurements to `docs/WORK-LOG.md`;
- update normative docs only when their actual contract changed.

## Validation

Run the validation appropriate to the task during iteration.

Before declaring a slice complete, satisfy the relevant gates in `docs/TESTING.md`.

Compilation alone is never visual, interaction, security or performance acceptance.
