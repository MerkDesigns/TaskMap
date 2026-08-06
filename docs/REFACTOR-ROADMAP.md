# TaskMap Refactor Roadmap

## Operating rules

- `main` remains the usable legacy application.
- `architecture-v1` contains the replacement architecture.
- Only critical legacy fixes are made on `main` during the refactor.
- Retained behavior is accepted against `docs/FEATURE-PARITY.md`.
- Every phase must leave the branch buildable and testable.
- Do not port a feature by copying its old orchestration code.

## Phase 0 — Baseline and evidence

### Goals

- Record current behavior before changing implementation.
- Establish architecture enforcement and performance fixtures.

### Work

- Capture screenshots and short recordings for retained UI and interactions.
- Create representative legacy documents: small, normal, and stress.
- Record current keyboard shortcuts and context-menu behavior.
- Add dependency-boundary checks.
- Add file-size reporting and generated code-map tooling.
- Add stable and development build configurations.

### Exit criteria

- Every retained feature has a parity entry.
- Removed features are explicitly listed.
- Stable and development editions install and run independently.
- Architecture checks fail on forbidden imports.

## Phase 1 — New application skeleton

### Goals

- Establish the final module boundaries without porting broad behavior.

### Work

- Create `AppShell`, typed platform clients, Redux store, command pipeline, selector conventions, interaction service interface, and shared UI foundations.
- Implement `FrostedSurface` using the existing visual treatment.
- Create explicit element and extension registries.
- Add error boundaries and structured application errors.

### Exit criteria

- Shell contains no business logic.
- Domain packages have no React or Tauri imports.
- Only `src/platform/` imports Tauri APIs.
- Empty application starts under stable and development identities.

## Phase 2 — Database, encryption, and session vertical slice

### Goals

Prove the complete secure persistence lifecycle before porting features.

### Work

- Implement SQLite `.tmapdb` schema.
- Implement Argon2id key derivation and authenticated document encryption.
- Implement create, open, save, backup, lock, and quit.
- Implement file locking and wrong-password/corruption distinctions.
- Implement recent-database configuration.
- Implement tray session and Windows lock integration.
- Implement config export/import.

### Vertical slice

```text
Create database
-> enter password
-> create one canvas
-> create one text card
-> edit text
-> undo and redo
-> autosave
-> close window
-> reopen without password during session
-> lock
-> reopen with password
-> quit and require password next launch
```

### Exit criteria

- Raw passwords are never stored or logged.
- Explicit lock purges key and decrypted document state.
- Media table exists but contains no required ported behavior yet.
- Atomic save and backup recovery tests pass.

## Phase 3 — Document core and history

### Goals

- Establish the normalized document model and transaction semantics.

### Work

- Implement canvases, normalized element entities, connections, media references, and document settings.
- Implement named application commands.
- Implement Immer patch history.
- Implement dirty tracking and debounced persistence.
- Implement document validation and current-version schema.

### Exit criteria

- Domain tests cover invariants and command behavior.
- One interaction creates one history entry.
- Pan, zoom, selection, and menus do not enter history.
- Saving does not block synthetic interaction tests.

## Phase 4 — Canvas and interaction engine

### Goals

- Replace the god-component interaction logic with explicit controllers.

### Work

- Implement viewport transforms, pan, zoom, selection, movement, resize, layers, snapping, and viewport culling.
- Commit persistent changes only at interaction completion.
- Add minimap data pipeline after viewport behavior is stable.

### Exit criteria

- 60 FPS target passes normal performance fixture.
- Pointer frames perform no serialization, encryption, database calls, or history commits.
- Multi-selection and locked-element rules match parity evidence.

## Phase 5 — Element modules

Port one complete element at a time:

1. Text card
2. Container
3. Text block
4. Image/GIF
5. Mind-map node and connections

Each port includes model, schema, commands, selectors, renderer, context menu, tests, history behavior, persistence behavior, and parity acceptance.

### Exit criteria

- Every retained element is independently registered.
- No element-specific branches accumulate in `AppShell` or generic canvas orchestration.
- Images and GIFs are lazy-loaded and media bytes never enter Redux.

## Phase 6 — Extension modules

Port retained extensions:

1. Lock
2. Checkbox
3. Search
4. Privacy
5. Color tools
6. AI JSON copy/paste

Do not port daily reset, sorting, or pick-a-card.

### Exit criteria

- Generic installation/removal commands work for every extension.
- Extension menus are generated from module contributions.
- Extension conflicts and target compatibility are schema-validated.
- No unrelated file contains one callback per extension.

## Phase 7 — Workflow Runner

### Goals

Preserve the useful Command Runner workflow without its unsafe raw-shell architecture.

### Work

- Define versioned structured workflow schema.
- Support executable, argument array, working directory, sequential/parallel groups, visible/background mode, wait behavior, and process stop.
- Track only TaskMap-launched processes.
- Disable imported workflows until trusted.
- Add execution logs without recording secrets.

### Exit criteria

- No raw shell string, admin elevation, hidden elevated execution, or `taskkill` orchestration exists.
- Existing user workflows can be represented through structured steps or are documented as unsupported.
- Security and process-lifecycle tests pass.

## Phase 8 — Remaining product features

- Canvas manager
- Minimap final parity
- Settings
- Update flow
- AI JSON editor workflow
- Tray UX
- Config import/export
- Database picker and recent files
- Error recovery and backup restoration

### Exit criteria

- Feature parity checklist is complete for retained behavior.
- Removed features have no dead code, schema fields, settings, or migration branches.

## Phase 9 — Legacy migrator

### Goals

- Convert existing user data without putting legacy code in the main app.

### Work

- Build standalone graphical migrator.
- Read old database and keyring format.
- Convert supported elements and retained extensions.
- Report removed features and unsupported records.
- Write new `.tmapdb` with user-selected password.

### Exit criteria

- Migration fixtures cover real legacy versions.
- Conversion report lists converted, transformed, removed, and skipped data.
- Main TaskMap binary contains no legacy migration implementation.

## Phase 10 — Hardening and release

- Full parity regression pass
- Stress tests at 10,000 elements and 2 GB media
- Recovery tests for crash, full disk, corrupted backup, wrong password, and lock contention
- Windows Defender submission/testing
- Installer and updater signing work
- Documentation review
- Stable-release migration guide

## Definition of done

The refactor is complete only when:

- All retained features pass parity acceptance.
- Removed features and legacy branches are absent.
- Architecture checks pass.
- Stable and development editions run simultaneously with separate data.
- Database security and recovery tests pass.
- Performance targets pass on the documented reference hardware.
- The standalone migrator successfully converts the user's production legacy database.