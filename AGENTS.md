# TaskMap Agent Rules

These rules apply to work on TaskMap.

## Working style

Inspect the relevant current implementation before editing.

For small or local tasks:

- Read only the code directly relevant to the task.
- Make the smallest change that solves the requested problem.
- Do not perform unrelated cleanup or refactoring.
- Do not read architecture/refactor documentation unless the task actually depends on it.
- Do not update documentation unless explicitly requested or the change alters an architectural contract.
- Do not add tests unless they are necessary for the requested task or explicitly requested.
- Do not commit or push unless explicitly requested.

For architecture-level work:

- Consult only the architecture documents and ADRs relevant to the affected system.
- Preserve existing architectural boundaries unless the task explicitly changes them.
- Record a new ADR only for a genuinely foundational architectural decision.

Do not turn a local implementation task into a general framework, abstraction, or architecture project without a concrete need.

## Product contract

TaskMap is a fast, local-first Windows canvas application.

The refactor must preserve the user-facing behavior of retained features while replacing the existing internal architecture.

Retained features include canvases, containers, text cards, text blocks, images and GIFs, mind-map connections, minimap, search, checkbox, lock, privacy, color tools, AI JSON copy/paste, updater support, and the approved TaskMap visual/material system.

Removed features are Discord Rich Presence, daily reset, sorting, pick-a-card, the frosted-glass tuner, legacy migrations inside the main app, keyring-based encryption, and the old raw Command Runner.

The old Command Runner is replaced by a structured Workflow Runner that stores executable, arguments, working directory, sequencing, and display mode separately. Do not reintroduce arbitrary hidden shell execution or administrator elevation.

## Architecture

1. `AppShell.tsx` is composition only. It may connect top-level providers, routes, and windows. It must not contain document mutation, pointer interaction, history, persistence, encryption, or feature logic.
2. Persistent document changes go through named domain commands. React components must not directly mutate document collections.
3. Transient pointer state belongs to the interaction subsystem, not the persistent document store.
4. Domain modules must not import React, Tauri, DOM APIs, or presentation components.
5. Only files under `src/platform/` may import Tauri APIs.
6. Only the Rust storage layer may perform database, encryption, file locking, or atomic file operations.
7. TypeScript owns the decrypted document schema and domain invariants. Rust validates the database envelope and treats the encrypted document payload as opaque bytes.
8. Media bytes never enter Redux. Media is addressed by opaque IDs and loaded lazily through the media service.
9. History records completed domain transactions. Pan, zoom, hover, selection, menus, and in-progress pointer frames are not history entries.
10. Extensions and element types are registered explicitly. Do not spread feature-specific switches throughout unrelated files.
11. Stable and development builds use separate application identifiers, config directories, recent-file lists, default databases, tray sessions, and update channels.
12. The main application contains no legacy data migrations. Legacy conversion belongs in `tools/taskmap-migrator/`.

## Dependency direction

Allowed:

```text
UI -> application commands/selectors -> domain
UI -> interaction -> application commands
application -> domain
application -> platform interfaces
platform adapters -> Tauri
Rust commands -> storage services -> database/crypto/filesystem