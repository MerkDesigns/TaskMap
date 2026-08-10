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

- [x] Create the composition-only `AppShell` around a temporary legacy adapter.
- [x] Create typed database, media, settings, and workflow platform client contracts without backend adapters.
- [x] Create the Redux store, typed provider/hooks, command-dispatch contract, and selector convention.
- [x] Create the pure current-version domain document, command, history, transaction, and ID foundations.
- [x] Implement `FrostedSurface` using fixed values from the existing production visual treatment.
- [x] Create explicit, initially empty element and architecture extension registries.
- [x] Add structured platform errors.
- [x] Add the transient interaction service interface; no pointer behavior is moved in this skeleton change.
- [x] Add application error boundaries without changing the active legacy error behavior.

### Exit criteria

- [x] Shell contains no business logic.
- [x] Domain packages have no React, Tauri, UI, element, extension, platform, DOM, or browser dependencies.
- [x] Architecture checks prevent new Tauri imports outside `src/platform/`; named legacy imports remain temporarily allow-listed.
- [x] The new shell builds under the existing stable and development identities while rendering the unchanged legacy application boundary.

Phase 1 is complete. The skeleton establishes the provider, command, selector, domain, platform, registry, transient-interaction, presentation, and error-reporting boundaries without porting features or replacing the legacy UI. Focused tests prove the new error boundary does not deliberately intercept errors inside `LegacyApplication`.

## Phase 2 — Database, encryption, and session vertical slice

### Goals

Prove the complete secure persistence lifecycle before porting features.

### Work

- [x] Implement the current-version SQLite `.tmapdb` envelope and unencrypted media table.
- [x] Implement Argon2id key derivation and XChaCha20-Poly1305 document encryption.
- [x] Implement pending create/unlock, TypeScript confirmation, read, transactional save with encrypted generations, explicit full backup, lock, close, and quit.
- [x] Implement Windows file-identity writer ownership and pre-derivation structural-corruption versus non-oracular authentication-failure handling.
- [x] Implement edition-specific recent/default-database configuration storage.
- [x] Preserve an unlocked process session when the visible legacy window closes, with single-instance reopen behavior.
- [x] Exclude the Phase 2 harness, command registration, and sensitive capability from stable production builds.
- [x] Replace renderer-supplied database paths with expiring, one-use backend authorization tokens.
- [ ] Add the production tray controls and Windows session-lock event integration. Only an internal Rust lock method exists; no renderer command or Windows event source is wired in Phase 2.
- [ ] Add config import/export UI. Phase 2 keeps the versioned settings schema and edition isolation only.

### Vertical slice

```text
Create database
-> enter password
-> create one canvas
-> create one text card
-> edit text
-> save encrypted document
-> close window
-> reopen without password during session
-> lock
-> reopen with password
-> quit and require password next launch
```

### Exit criteria

- [x] Version-1 algorithms, KDF parameters, singleton counts, storage classes, fixed lengths, and conservative input sizes are rejected before expensive work or large reads.
- [x] Raw passwords are never persisted or logged; application-controlled password, derivation, key, and decrypted Rust buffers use zeroizing ownership where practical and documented limitations remain explicit.
- [x] A candidate session cannot become unlocked until the TypeScript document, database ID, schema version, and development purpose are confirmed.
- [x] Explicit lock, close, quit, pending rejection/timeout, and keeper failure purge backend keys, release writer ownership, and remove the harness plaintext.
- [x] Media bytes remain outside Redux and are stored unencrypted under opaque IDs without original filenames.
- [x] Routine save transactionally retains five encrypted document generations and remains independent of total media size; full SQLite backup is explicit only.
- [x] Stable production builds contain no Phase 2 plaintext IPC commands or harness chunk.
- [x] Real Windows path-alias and child-process tests prove file-identity writer exclusion and stale-metadata recovery.
- [x] The full Phase 2 automated validation matrix passes after the final implementation changes.
- [x] The disposable-database native window/keeper lifecycle is manually exercised and recorded.

Phase 2 exit criteria are complete. Production tray UX, native Windows session-lock event delivery, inactivity locking, config import/export UI, streaming media transport, scheduled full backups, and production autosave remain accurately deferred.

## Phase 3 — Document core and history

### Goals

- Establish the normalized document model and transaction semantics.

### Work

- [x] Implement canvases, normalized element entities, connections, media references, extension
      installations, document settings, conservative limits, and current-version validation (Phase
      3A).
- [x] Implement named application commands (Phase 3B).
- [x] Implement atomic Immer patch transactions, undo, and redo (Phase 3B).
- [x] Implement Redux workspace orchestration, sequence-based dirty tracking, and revision-aware
      debounced persistence (Phase 3C).

Phases 3A, 3B, and 3C are complete. Phase 3C activates the normalized document, command, history,
dirty, revision, and save lifecycle only through dependency-injected application operations used by
tests and future features. Production feature UI remains on `LegacyApplication` until Phase 4 and
later parity slices; the Phase 2 development harness and legacy autosave remain unchanged.

### Exit criteria

- [x] Domain tests cover current-version invariants and Phase 3B generic command behavior.
- [x] One committed geometry command creates one history entry; interaction wiring remains Phase 4.
- [x] Pan, zoom, selection, and menus are excluded from the document command/history API.
- [x] Saving does not block synthetic rapid-command tests; debounce, encoding, and unresolved
      database work remain outside synchronous command execution.

## Phase 4 — Canvas and interaction engine

### Goals

- Replace the god-component interaction logic with explicit controllers.
- Keep controllers document-model agnostic behind a narrow semantic commit port.

### Work

- [x] Implement canonical viewport transforms, pan, anchored wheel zoom, and reset zoom.
- [x] Implement click/additive/box selection and single-primary interaction arbitration.
- [x] Implement transient single/multi movement, bottom-right resize, lock rules, and Shift-enabled snapping.
- [x] Commit changed move/resize/layer operations only once at interaction completion.
- [x] Fix `pointercancel` so it discards preview and makes no persistent commit.
- [x] Implement 480-screen-pixel overscan culling with selected/edited/active pinning.
- [x] Add a pure minimap data pipeline; preserve reset-only behavior without inventing navigation.
- [x] Integrate production through the temporary legacy commit adapter and delete superseded pointer algorithms from `App.tsx`.

Production document ownership is still legacy during Phase 4. The narrow adapter may replace the
active `TaskCanvas` once per completed operation, allowing current legacy history/autosave to observe
one mutation. This does not require normalized production workspace activation and does not create a
legacy-format conversion or shadow `TaskMapDocument`. The controller architecture and commit port
are final; the legacy adapter is temporary. Canvas-correlated camera writeback and bounded legacy
text-card placement presentation live beside the adapter. They preserve current production parity
without frame-time collection mutation and are deleted progressively as Phase 5 transfers the
corresponding ownership to normalized feature slices.

### Exit criteria

- [ ] 60 FPS target receives a release-mode visual/manual measurement. Deterministic hot-path and
      10,000-element culling fixtures pass, but they do not by themselves prove rendered FPS. Phase
      4.5 changes the rendering path, so the final measurement is intentionally performed once after
      Phase 4.5D against the accepted compositor.
- [x] Pointer frames perform no serialization, cloning, persistence, database calls, or history commits.
- [x] Multi-selection and locked-element rules match characterized parity in deterministic tests.
- [x] Production manual parity checklist passed after commit `9a34a23`; the user directly verified
      retained Phase 4 interaction behavior.

Phase 4 implementation and manual interaction parity are accepted. Formal release performance
acceptance remains open and is deferred to the final Phase 4.5 rendering path rather than measured
twice.

## Phase 4.5 — Visual System + Adaptive Acrylic Compositor

This phase establishes the final application material/theme boundary before element migration so
Phase 5 renderers target it once. Exact values and runtime invariants live in
`docs/VISUAL-SYSTEM.md`; ADR 003 records the foundational decision.

### 4.5A — Contract / foundation

- [x] Add the normative visual specification and adaptive-compositor ADR.
- [x] Define inactive target theme tokens, typed material definitions, shared acrylic profile, and
      explicit static registry.
- [x] Add `MaterialSurface` with `base`/`modal` plane inheritance and no compositor tuning API.
- [x] Freeze exact legacy blur/frosted occurrences in transitional architecture checks.
- [x] Update agent, architecture, wiring, parity, testing, baseline, and code-map guidance.

This slice does not activate the target theme, migrate a production consumer, or implement a
Canvas2D compositor, worker, or `OffscreenCanvas` runtime.

### 4.5B — Adaptive compositor

- [x] Prove the generic `BackdropScene`, adaptive-quality, invalidation, culling, cache-scheduler,
      surface-registry, `base`/`modal` compositor, worker, fallback, and stale-result contracts.
- [x] Integrate with the authoritative Phase 4 interaction controller without per-sample scene
      building, blur, or persistent work; coalesce coverage-required rebuilds during long gestures.
- [ ] Validate real image/GIF fidelity beneath acrylic and add a generic raster/thumbnail primitive
      only if visual acceptance requires it.
- [x] Add deterministic compositor tests and development-only diagnostics.

### 4.5C — Production visual migration

- [x] **C1 foundation:** add scoped semantic geometry/state/typography tokens, reusable semantic UI
      primitives, deterministic shared motion/spring/FLIP infrastructure, accessible LiquidTabs,
      the permanent UI capability catalog, and a doubly gated development UI Lab.
- [x] Apply the first C1 visual-review correction: keyboard-focus demonstration, Lab-only motion
      simulation, real shared-compositor playground, bounded rounded-rectangle liquid selection,
      and reduced acrylic radial highlights.
- [ ] Activate the target theme and global orange application-chrome accent.
- [ ] Migrate toolbar, panels, cards, settings, minimap, menus, dialogs, toasts, cutouts, and every
      frozen legacy frosted consumer through `MaterialSurface` without changing feature behavior.
- [ ] Preserve user-selected element colors and semantic/spatial colors.
- [ ] Complete production visual, worker/fallback, media-under-acrylic, animation, and stacking
      acceptance.

C1 deliberately leaves the production root, toolbar, panels, Settings, minimap, menus, dialogs,
toasts, and canvas elements unchanged. C2/C3 own production composition and behavior-driven overlay
APIs; completion and visual acceptance for 4.5C remain open.

### 4.5D — Cleanup / acceptance

- [ ] Delete `FrostedSurface`, legacy frosted CSS/tuner paths, and the transitional allowlist.
- [ ] Run the full automated matrix and final architecture/material scan.
- [ ] Complete manual visual acceptance and the release-mode rendered 60 FPS measurement on the
      normal fixture against the final compositor.
- [ ] Regenerate the final code map and close Phase 4.5 documentation gates.

### Exit criteria

- All production chrome surfaces use the static material system; no direct/nested backdrop-filter
  or second acrylic compositor remains.
- Pan, zoom, drag, and resize preserve the Phase 4 high-frequency contract and pass deterministic
  cache/culling tests.
- Stable and development Tauri/WebView2 builds pass worker, fallback, visual, and disposal checks.
- Manual visual acceptance and documented release-mode performance measurement pass.

## Phase 5 — Element modules

Port one complete element at a time:

1. Text card
2. Container
3. Text block
4. Image/GIF
5. Mind-map node and connections

Each port includes model, schema, commands, selectors, renderer, context menu, tests, history behavior, persistence behavior, and parity acceptance.

Each Phase 5 slice also replaces its corresponding legacy geometry mapping/commit behavior with a
normalized command/workspace-backed implementation of the Phase 4 commit contract. Text-card
ownership removes legacy bundle/reparent adaptation; container/text-block/image ownership removes
their geometry/resize mapping; the final element slice removes the adapter itself. No new persistent
feature may be added to legacy collections.

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
- Remaining product-shell production activation after element/document ownership has migrated

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

Phase 9 exclusively owns old database-format conversion. The temporary Phase 4 production commit
adapter neither reads old formats nor belongs to the migrator.

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
