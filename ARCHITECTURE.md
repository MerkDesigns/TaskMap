# TaskMap Architecture v1

## Purpose

TaskMap is a local-first Windows desktop canvas application. The architecture separates persistent
document/domain state, transient interaction, presentation/UI, native platform services and secure
storage so each can evolve without recreating a god component.

This document defines global structural boundaries. Subsystem behavior belongs to the corresponding
contract.

## Runtime overview

```text
AppShell
└─ DatabaseApplication / application lifecycle
   ├─ normalized workspace
   ├─ named commands + history
   ├─ persistence coordinator
   ├─ device/session resources
   └─ presentation
      ├─ interaction controllers
      ├─ retained presentation boundary during migration
      └─ final UI system

TypeScript platform clients
→ Tauri commands
→ Rust session/storage/media/settings/workflow services
```

## Core principles

1. Domain logic is independent from React/Tauri/DOM.
2. Persistent document state is separate from transient interaction state.
3. Completed semantic operations create document transactions; pointer samples do not.
4. Storage/encryption remain behind narrow platform/native boundaries.
5. Media bytes remain outside Redux/document payloads.
6. UI presentation uses reusable subsystem contracts rather than feature-local infrastructure.
7. Stable/dev application identities remain isolated.
8. Legacy file conversion stays outside the main app.
9. Prefer simple inspectable ownership over clever cross-layer abstractions.

## Application composition

`AppShell.tsx` is composition only.

It may assemble:

- error boundaries;
- material/UI providers;
- database application lifecycle;
- application providers;
- development-only workbench gates.

It must not own feature/domain mutation, interaction algorithms, persistence, encryption or
feature-specific presentation logic.

## Database/session lifecycle

One application database runtime owns the active product session.

It composes:

- session lifecycle/controller;
- normalized workspace;
- persistence;
- device preferences;
- remembered encrypted view state;
- session-bound media;
- privacy/session resources.

There is never a legacy/new dual persistence owner for the same active document.

Security and storage details are governed by `docs/SECURITY.md`, `docs/DATA-FORMAT.md` and current
accepted database ADRs.

## Persistent document ownership

TypeScript owns the decrypted normalized document schema and invariants.

Persistent document content includes:

- canvases/order/settings;
- normalized elements/order;
- connections;
- media references;
- extension installations;
- document settings.

Device/session/transient UI state does not belong in the document.

## Commands and history

Persistent changes use named commands.

The command layer:

- validates payloads;
- applies one atomic mutation;
- validates the resulting document;
- produces localized forward/inverse history patches when applicable.

History records completed document transactions.

Pan, zoom, selection, hover, menu state and in-progress pointer samples do not enter document history.

## Persistence

The persistence coordinator observes successful document changes and owns revision-aware deferred
save behavior.

Feature components do not call database save directly.

Persistence is epoch/session/revision guarded so obsolete async completions cannot mutate a new
workspace.

## Transient interaction

Interaction controllers own:

- active gesture/pointer;
- pan/zoom preview;
- selection;
- drag/resize preview;
- snap/drop calculations;
- high-frequency transient geometry.

Pointer frames do not mutate the persistent document.

Completed interactions cross a narrow semantic completion/command boundary once.

## Current presentation migration boundary

The database/workspace/command/history system is already the product data owner.

Some production presentation still passes through retained `App.tsx`/legacy view structures while
later phases migrate renderers.

This retained presentation boundary is temporary.

Do not broadly dissect `App.tsx` as part of unrelated UI/glass work. Transfer ownership through
planned vertical feature slices.

## UI architecture

General UI architecture is governed by:

- `docs/UI-SYSTEM-CONTRACT.md`
- `docs/UI-QUALITY-GUARDRAILS.md`

The public concepts are Surface, Material and Content plus reusable behavior helpers/patterns.

Feature UI depends downward on reusable UI infrastructure; private renderers do not leak upward.

## Glass/material architecture

Glass behavior is governed by `docs/GLASS-SYSTEM-CONTRACT.md`.

`MaterialSurface`/the final Surface+Material boundary remains the feature-facing material boundary.

Features do not implement:

- backdrop filters;
- overscan;
- material repaint tricks;
- batching/promotion internals;
- rim rendering;
- browser-specific refresh behavior.

The private rendering backend is not frozen until the final WebView2 proof gate passes.

Historical cached-compositor/native-CSS experiments are implementation history, not global
architecture authority.

## Development visual workbench

Development mode may provide a workbench that switches between:

- the real App view;
- UI Lab.

Both views sit inside one database/session/workspace runtime and share the real UI/material/motion
implementation.

The workbench is development tooling, not a second product application architecture.

## Platform boundary

Only `src/platform/` imports Tauri APIs.

React/features depend on typed platform interfaces.

Tauri commands delegate quickly to Rust service modules.

## Rust ownership

Rust owns:

- SQLite access;
- encryption/key derivation/session key lifetime;
- file locking/atomic writes/backups;
- native session authority;
- bounded media transport/validated reads;
- native settings/filesystem integration;
- workflow process ownership.

TypeScript owns document semantics; Rust treats the encrypted document payload as opaque bytes except
for bounded envelope/session validation.

## Media

Media bytes remain outside Redux.

The document stores opaque media references/metadata.

The application uses session-bound media clients and lazy loading/leases.

Import/cleanup/transport remain explicit resource operations.

## Device preferences and remembered views

Device-local preferences are separate from document history.

Remembered per-database/canvas camera state is encrypted device-local session data and is not portable
document content.

Settled camera persistence must not serialize/write on every pointer sample.

## Element modules

Each final element type owns its feature-specific:

- model/schema;
- commands/selectors;
- renderer;
- menu/control contributions;
- tests;
- registry definition.

Shared behavior such as movement/selection/layering goes through common contracts rather than
cross-importing feature implementations.

## Extension modules

Extensions are statically registered built-in modules.

Each owns:

- definition/compatibility;
- configuration/state schema;
- commands/selectors;
- UI contributions;
- tests.

Unrelated central components must not accumulate one callback/switch per extension.

## Workflow Runner

The Workflow Runner uses structured executable/arguments/working-directory/sequencing/display fields.

Do not reintroduce hidden arbitrary shell strings or administrator-elevation behavior.

Imported workflow definitions remain disabled until explicitly trusted.

## Performance architecture

High-frequency interaction aims for maximum practical throughput and low frame-time variance.

Pointer/camera/scroll hot paths avoid:

- persistence/history/database;
- serialization;
- broad React renders;
- unnecessary DOM measurement;
- unnecessary material rebuilds.

UI/glass benchmark methodology is defined by `docs/TESTING.md` and
`docs/GLASS-SYSTEM-CONTRACT.md`.

## Repository structure

The exact tree may evolve, but responsibilities remain approximately:

```text
src/
├─ app/          application lifecycle/workspace/commands/persistence
├─ domain/       pure document/history/command rules
├─ canvas/       geometry/interaction/virtualization
├─ elements/     element modules
├─ extensions/   extension modules
├─ features/     product features
├─ platform/     typed native adapters
├─ ui/           theme/materials/motion/primitives/patterns/dev
└─ legacy/       temporary retained-presentation bridges only

src-tauri/src/
├─ commands/
├─ database/
├─ crypto/
├─ session/
├─ settings/
├─ workflow/
└─ files/
```

## Dependency direction

Allowed:

```text
feature/pattern -> primitive/behavior -> material/motion
UI -> application commands/selectors
UI -> transient interaction
application -> domain
application -> platform interfaces
platform -> Tauri
Rust commands -> Rust services
```

Forbidden:

```text
domain -> UI/React/Tauri/DOM
platform -> UI
feature -> private material renderer
component -> direct database/encryption/filesystem/history mutation
new architecture -> legacy persistence formats
```

## Architecture change rule

A foundational ownership/rendering/security decision requires an ADR.

Routine implementation detail inside an accepted contract does not require a new ADR.

If code and contract disagree:

- code tells us what currently exists;
- contract tells us what should exist;
- record and resolve the discrepancy instead of silently rewriting the contract around the code.
