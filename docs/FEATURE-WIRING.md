# Feature Wiring Guide

This guide defines how new features enter TaskMap without recreating a central god component.

## General rule

A feature is complete only when its domain behavior, history behavior, persistence behavior, rendering, tests, parity documentation, and code-map entry are wired intentionally.

Do not begin by editing `AppShell.tsx`.

## Adding an element type

Create a dedicated module:

```text
src/elements/<element-name>/
├── definition.ts
├── model.ts
├── schema.ts
├── commands.ts
├── selectors.ts
├── <ElementName>View.tsx
├── <ElementName>Menu.tsx
└── <elementName>.test.ts
```

### Required responsibilities

`model.ts`

- Element-specific fields and discriminant
- No React or Tauri imports

`schema.ts`

- Runtime validation fragment
- Defaults and current-version constraints

`commands.ts`

- Element-specific document mutations
- No component state or DOM access

`selectors.ts`

- Narrow selectors for rendering and derived behavior

`definition.ts`

- Registry metadata
- Default creation
- Schema reference
- Renderer and optional menu contribution
- Geometry adapter and capability declarations

`View.tsx`

- Rendering and local presentation behavior only
- Dispatches named commands or interaction intents
- Does not directly mutate document collections

`Menu.tsx`

- Element-specific menu contributions only
- Shared actions such as delete, layer movement, lock, and copy remain generic

`test.ts`

- Creation defaults
- Validation
- Commands
- History transaction behavior
- Registry integration

### Registration

Add one explicit entry to `src/elements/registry.ts`. Do not add new element-specific switches to the application shell or generic canvas scene.

### Shared behavior checklist

Confirm how the element participates in:

- Selection
- Movement
- Resize
- Layers
- Locking
- Deletion
- Copy/paste
- Undo/redo
- Serialization
- Viewport culling
- Minimap
- Mind-map connection endpoints, when applicable
- Privacy behavior, when applicable

Use capabilities in the element definition rather than scattered type checks.

## Adding an extension

Create:

```text
src/extensions/<extension-name>/
├── definition.ts
├── model.ts
├── schema.ts
├── commands.ts
├── selectors.ts
├── controls.tsx
└── <extensionName>.test.ts
```

### Required responsibilities

`definition.ts`

- ID, label, description
- Compatible element types
- Conflicts
- Default state
- Control and menu contributions

`model.ts`

- Extension state type

`schema.ts`

- Runtime validation

`commands.ts`

- Extension-specific mutations beyond generic install/remove

`selectors.ts`

- Derived extension behavior

`controls.tsx`

- Header, inline, context-menu, or settings contribution

### Registration

Add one explicit entry to `src/extensions/registry.ts`.

Generic extension infrastructure owns:

- Installation
- Removal
- Compatibility checks
- Conflict handling
- Serialization
- Menu grouping
- History labels

Do not add one removal callback per extension to a generic context menu.

## Adding an application feature

Features such as minimap, database picker, settings, updates, or Workflow Runner live under `src/features/<feature>/`.

A feature may depend on application commands, selectors, UI primitives, and platform interfaces. It may not bypass the platform layer or mutate the document outside the command pipeline.

## Selecting and adding materials

Feature UI selects an existing internal material with `MaterialSurface`:

```tsx
<MaterialSurface material="acrylic-large">...</MaterialSurface>
<MaterialSurface material="acrylic-small" radius={8}>...</MaterialSurface>
<MaterialSurface material="cutout" radius={6}>...</MaterialSurface>
```

The surface defaults to the inherited `base` plane. Modal roots establish `modal` through
`MaterialPlaneProvider`, including when content renders through a portal. Use `elevation="none"` only
for a geometry whose contract suppresses the material's external shadow, such as the toolbar. Keep
accessibility roles, labels, events, and content in the feature; keep blur, cache, worker, tint,
border, shadow, mask, and compositor implementation in `src/ui/materials/`.

To add an internal material using an existing strategy:

1. Add one typed definition to the static registry boundary.
2. Add exact definition, registry, presentation, and visual tests.
3. Update `docs/VISUAL-SYSTEM.md` and the code map.
4. Update generic material implementation only when the existing strategy cannot render the new
   definition; never branch on the requesting feature or element type.

Add an ADR when changing compositor strategy, dependency direction, plane semantics, shared cache
behavior, or performance invariants. A routine variant using an established strategy does not need
an ADR.

The future compositor receives a generic, culled `BackdropScene` from presentation assembly. Do not
query the whole DOM, import feature models into the compositor, or add element-type switches. Phase
4.5A intentionally leaves the normalized element scene-contribution API unspecified; it will be
finalized against the proven contract during Phase 4.5B/Phase 5.

Material work preserves the interaction contract: no persistent dispatch, scene scan/build, blur,
serialization, history, persistence, or database access once per pointer sample. A long pan/zoom may
coalesce a cache rebuild when coverage requires it. See `docs/VISUAL-SYSTEM.md` for the normative
quality and invalidation contract.

## Adding a platform operation

1. Define or extend a typed TypeScript client under `src/platform/`.
2. Add the narrow Tauri command under `src-tauri/src/commands/`.
3. Delegate immediately to a Rust service module.
4. Return structured errors.
5. Add TypeScript contract tests or mocks and Rust service tests.

React components must not call `invoke()` directly.

## History wiring

Every persistent command declares:

- Human-readable history label
- Whether it joins an existing transaction
- Whether it creates a new transaction
- Patch and inverse-patch generation

Pointer interactions begin a transient preview and emit one semantic completion through
`CanvasInteractionCommitPort`. Normalized production implementations dispatch one named command on
completion. While `LegacyApplication` still owns production element/document state, the temporary
adapter under `src/legacy/interactions/` performs one legacy canvas replacement instead. Generic
controllers never import that adapter or legacy types.

Legacy camera, selection-setter, element-geometry, and text-card placement/presentation bridges are
kept beside that adapter. They correlate or translate existing production state at the boundary;
they are not generic feature APIs and may not be imported by new domain or feature modules. The
text-card bridge stores only the active bundle's bounded presentation/placement data, never a
mutable `TaskCanvas` shadow, and its final decision is consumed by the one completion-port call.

Text editing should use an explicit edit session so one meaningful edit becomes one undo step rather than one step per keystroke.

## Persistence wiring

The persistence coordinator observes committed document transactions. Feature modules do not call save directly.

Phase 3C owns this dormant wiring under `src/app/workspace/` and `src/app/persistence/`. Future
feature UI dispatches the narrow workspace operations and reads selectors; it must not dispatch the
slice's internal lifecycle actions. Revision-conflict resolution remains a future application
workflow that replaces or explicitly reconciles the workspace before automatic saves can resume.

Media import is the exception because bytes are persisted by the backend before the document receives a media reference. The media service owns rollback/cleanup if the reference is never committed.

## Security wiring

Before adding a field, determine whether it is:

- Encrypted document data
- Unencrypted media transport data
- External application configuration
- Ephemeral session state

Do not place user text, filenames, links, workflow definitions, or document relationships in unencrypted tables.

## Performance wiring

For rendering or interaction features:

- Define the subscription granularity.
- Define viewport-culling behavior.
- Avoid document-wide selectors inside individual element components.
- Ensure pointer frames do not dispatch persistent actions.
- Add or update performance fixtures.

## Documentation checklist

For every feature:

- Update `docs/CODEMAP.md`.
- Update `docs/FEATURE-PARITY.md` when replacing legacy behavior.
- Update `ARCHITECTURE.md` only for structural changes.
- Add an ADR for foundational trade-offs.
- Document user-visible configuration.

## Review checklist

Reject the implementation when any answer is yes:

- Does `AppShell.tsx` gain feature logic?
- Does a component call Tauri directly?
- Does domain code import React or DOM APIs?
- Does pointer movement save or create history?
- Does a generic menu gain one callback specifically for this feature?
- Does the feature duplicate validation in TypeScript and Rust?
- Does the feature bypass `MaterialSurface` or introduce blur/compositor/material implementation?
- Does a file exceed 400 lines without a clear subsystem reason?
- Does the feature add legacy compatibility to the main app?
- Can imported workflow data execute before trust?

The Phase 4 adapter does not relax the legacy-compatibility rule. It lives in the existing legacy
production boundary, implements a generic new-architecture contract, and must not be imported by new
feature, application-domain, or domain modules. It is not a database migration/conversion layer and
must be deleted progressively with Phase 5 ownership migration.
