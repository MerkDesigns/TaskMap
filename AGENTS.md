# TaskMap Agent Rules

These rules apply to all automated and human changes in this repository.

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

Element renderers live in `src/elements/` and extensions contribute their UI through the typed
contribution points in `src/extensions/` (ADR 008). Legacy `App.tsx` still composes the canvas and
holds remaining presentation state (selection, editing, menus) over the retained canvas runtime;
move that state out in focused steps as features migrate. Do not use UI/glass work as an excuse for
a broad `App.tsx` rewrite.

## Code organisation

- One cohesive responsibility per module. Cohesion decides file boundaries, not line counts.
- Keep one-use helpers, types and constants in the file that owns them. A new file needs a reason:
  it is shared, it forms an ownership/dependency boundary, or it is a public entry point.
- Avoid files under ~30 lines unless they are entry points, re-export barrels or type-only modules.
- New files over ~400 lines need a real subsystem reason; split along responsibilities, never just
  to get under a number.
- No generic `utils.ts`, `helpers.ts` or `common.ts` dumping grounds.
- When ownership moves, update the "Repository structure" section of `ARCHITECTURE.md`.

## Naming

- Names describe the domain or behavior: `CommandFailure`, `DatabaseEntryRuntime`,
  `useCanvasBrowserDrag`. Never name code, files, folders, features, tests or flags after project
  phases, dates, tickets or slices (`Phase2…`, `C3B`, `4.5H`, `trial`).
- Test titles state the behavior under test ("locks the session when the window closes"), not the
  slice that introduced it.
- Temporary migration code says what it bridges (`legacy/`, `retained…`), and is deleted when the
  migration ends.

## Comments

- Comments explain non-obvious _why_ in terms of the code: constraints, invariants, platform quirks
  (e.g. "WebView2 ignores a zero-size mask layer").
- No dates, "user direction/choice", chat or session references, phase codes, or contract section
  numbers in code. Decisions belong in commit messages, pull requests, ADRs or the contracts; link a
  doc by name when a comment truly depends on it.
- Do not narrate what the next line obviously does.

## Styling

- Styles live in CSS next to their component/pattern and use theme tokens.
- Do not add new Tailwind utility classes; existing ones in retained legacy code are removed as that
  code migrates.

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

## Workflow

Before substantial work:

1. read `docs/REFACTOR-STATE.md`;
2. read the active section of `docs/REFACTOR-ROADMAP.md`;
3. read `docs/AI-WORKFLOW.md`;
4. read the relevant subsystem contract;
5. inspect the current implementation/diff.

Conversation memory is not the repository source of truth.

After meaningful work:

- keep commits small and focused, one coherent change each, with a message that explains what and
  why (history lives in Git, not in a diary file);
- add user-visible changes to `CHANGELOG.md` under "Unreleased";
- update `docs/REFACTOR-STATE.md` only when phase/gate status, ownership or the next task changes;
- record foundational decisions as an ADR; update normative docs only when their contract changed.

## Tests

- Test behavior through public interfaces; follow the test style rules in `docs/TESTING.md`.
- Do not assert on source text in unit tests. Architecture/security boundaries are enforced by the
  boundary scripts in `scripts/`.

## Validation

Run the validation appropriate to the task during iteration.

Before declaring work complete, satisfy the relevant gates in `docs/TESTING.md`
(`npm run check` locally mirrors CI).

Compilation alone is never visual, interaction, security or performance acceptance.
