# TaskMap Agent Rules

These rules apply to all automated and human changes on the `renderer-v2` branch.

## Product contract

TaskMap is a fast, local-first Windows canvas application. The refactor must preserve the
user-facing behavior of every retained feature while replacing the existing internal architecture.
Intentional visual changes are governed by `docs/VISUAL-SYSTEM.md` and
`docs/FEATURE-PARITY.md`.

Renderer v2 is a new presentation implementation over the retained domain, application, and
platform architecture. Do not incrementally refactor or extend the main-branch frontend, old
`App.tsx`, or remaining architecture-v1/legacy presentation code. Those sources are behavior and
visual references only. Reuse framework-independent domain, command, history, persistence, canvas
geometry, interaction, and virtualization modules when they fit these rules.

Retained features include canvases, containers, text cards, text blocks, images and GIFs, mind-map
connections, minimap, search, checkbox, lock, privacy, color tools, AI JSON copy/paste, updater
support, and the approved TaskMap visual/material system.

Removed features are Discord Rich Presence, daily reset, sorting, pick-a-card, the frosted-glass tuner, legacy migrations inside the main app, keyring-based encryption, and the old raw Command Runner.

The old Command Runner is replaced by a structured Workflow Runner that stores executable, arguments, working directory, sequencing, and display mode separately. Do not reintroduce arbitrary hidden shell execution or administrator elevation.

## Mandatory architecture

1. `AppShell.tsx` is composition only. It may connect top-level providers, routes, and windows. It must not contain document mutation, pointer interaction, history, persistence, encryption, or feature logic.
2. Persistent document changes go through named domain commands. React components must not directly mutate document collections.
3. Transient pointer state belongs to the interaction subsystem, not the persistent document store.
4. Domain modules must not import React, Tauri, DOM APIs, or presentation components.
5. Only files under `src/platform/` may import Tauri APIs.
6. Only the Rust storage layer may perform database, encryption, file locking, or atomic file operations.
7. TypeScript owns the decrypted document schema and domain invariants. Rust validates the database envelope and treats the encrypted document payload as opaque bytes.
8. Media bytes never enter Redux. Media is addressed by opaque IDs and loaded lazily through the media service.
9. History records completed domain transactions. Pan, zoom, hover, selection, menus, and in-progress pointer frames are not history entries.
10. Extensions and element types are registered explicitly. Do not add feature-specific switches throughout unrelated files.
11. Stable and development builds use separate application identifiers, config directories, recent-file lists, default databases, tray sessions, and update channels.
12. The main application contains no legacy data migrations. Legacy conversion belongs in `tools/taskmap-migrator/`.
13. Canvas elements render as ordinary React/DOM content. They must not use Liquid DOM materials.
14. Application glass is implemented behind the shared material boundary with `@liquid-dom/core`.
    It must be capable of blurring and refracting the live canvas DOM, including text, images, and
    static GIF posters/frames. Animated GIF and video playback belongs in a separate preview or UI
    surface. Do not add another application-owned acrylic compositor.
15. Mantine is the standard React component library for controls, menus, dialogs, inputs, and
    related UI. Mantine owns control behavior and accessibility; Liquid DOM owns glass/material
    rendering. Keep both dependencies behind intentional UI boundaries.

## File and module rules

- Prefer one clear responsibility per file.
- Target fewer than 250 lines per file.
- Files above 400 lines require an architectural justification in the pull request and should normally be split.
- Do not create large barrel files that export the entire application.
- Use small local `index.ts` files only at intentional public module boundaries.
- Update `docs/CODEMAP.md` whenever a subsystem, element type, extension, or platform service is added or moved.
- Add or update an ADR under `docs/decisions/` when changing a foundational decision.
- Do not create generic `utils.ts`, `helpers.ts`, or `common.ts` dumping grounds. Name modules after their responsibility.

## Dependency direction

Allowed direction:

```text
UI -> application commands/selectors -> domain
UI -> interaction -> application commands
application -> domain
application -> platform interfaces
platform adapters -> Tauri
Rust commands -> storage services -> database/crypto/filesystem
```

Forbidden direction:

```text
domain -> React or Tauri
platform -> UI
extension module -> another extension's UI
component -> direct database invocation
component -> direct history mutation
component -> direct encryption or filesystem logic
```

## Element modules

Each element type owns its model, schema fragment, commands, selectors, renderer, context menu contribution, tests, and registry definition. Element modules interact through shared domain contracts rather than importing each other's views.

## Extension modules

Each extension owns its definition, state schema, commands, selectors, controls/menu contributions, and tests. Extension availability and conflicts are declared in the extension definition. Installation and removal go through generic extension commands.

## Performance rules

- Pan, zoom, drag, and resize target 60 FPS.
- Pointer movement must not serialize, encrypt, save, or create history entries.
- Complete one persistent transaction when an interaction ends.
- Subscribe components to the smallest practical state slice.
- Cull or virtualize elements outside the viewport.
- Load images and GIFs only when visible or imminently visible.
- Do not decode large media on the main interaction path.
- The shared Liquid DOM material wrapper is the feature-facing material boundary. Features may not
  instantiate Liquid DOM directly or implement independent glass/material strategies.
- The only Liquid DOM roles are Large Panel and Small Panel. A role selects optical treatment, not
  width, height, padding, radius, position, or layout.
- Privacy is the sole intentional exception to the no-direct-backdrop rule: it keeps ordinary CSS
  `backdrop-filter` blur as a cheap content-obscuring effect and is not application glass.
- Liquid DOM surfaces belong to application UI chrome, never canvas elements or high-frequency
  interaction previews. No material work may add persistent dispatch, serialization, history,
  persistence, database work, or document-wide React updates per pointer sample.
- Add performance tests for changes affecting rendering, selectors, interaction, serialization, or media.

## Security rules

- Never store the raw database password.
- Derive a key with Argon2id and keep only the derived key in the active session process.
- Zeroize key material on lock, Windows session lock, timeout, or quit.
- Use authenticated encryption for the document payload.
- Media is intentionally unencrypted; filenames, relationships, canvas content, and metadata that reveal document structure remain encrypted.
- Never log plaintext document content, passwords, derived keys, nonces, or decrypted payloads.
- Imported workflows are disabled until explicitly trusted.

## Required validation

Every completed phase must pass formatting, TypeScript type checking, linting, unit tests, Rust formatting, Clippy, Rust tests, architecture dependency checks, and the phase-specific acceptance tests in `docs/TESTING.md`.

Do not claim parity from compilation alone. Validate retained behavior against `docs/FEATURE-PARITY.md`.
