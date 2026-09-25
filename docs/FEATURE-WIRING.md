# TaskMap Feature Wiring Guide

## Purpose

This guide describes how new/refactored features enter the current architecture without recreating
central god components or bypassing subsystem contracts.

## 1. General rule

A feature owns its feature-specific behavior and composes shared infrastructure.

It does not own:

- database/session internals;
- history infrastructure;
- generic interaction engines;
- UI primitive identity;
- glass renderer internals.

## 2. Adding an element type

Create a dedicated element module with the responsibilities it actually needs, typically:

```text
src/elements/<type>/
├─ definition/model/schema
├─ commands/selectors
├─ renderer
├─ menu/control contributions
└─ tests
```

Domain/model/schema code remains React/Tauri independent.

Register the type explicitly.

Do not add unrelated `switch(type)` branches across the application when the registry/module can own
the behavior.

## 3. Adding an extension

An extension module owns:

- definition/compatibility;
- configuration/state schema;
- commands/selectors;
- UI contributions;
- tests.

Register explicitly.

Do not add one extension-specific callback to unrelated central UI for every extension.

## 4. Adding an application feature

Determine first whether state is:

- persistent document state;
- device preference;
- session/runtime state;
- transient interaction state;
- local component presentation state.

Put it in the correct owner before wiring UI.

## 5. Persistent mutation

Persistent document changes go through named application/domain commands.

Components do not:

- mutate normalized collections directly;
- create history entries directly;
- call persistence directly.

A successful completed interaction normally creates one semantic transaction.

## 6. Transient interaction

Pointer-frame state remains in interaction controllers/services.

Do not dispatch persistent document actions, serialize or save on every pointer sample.

Completion crosses the narrow semantic command/completion boundary once.

## 7. Platform/native work

1. define/extend a typed client under `src/platform/`;
2. add the narrow Tauri command;
3. delegate immediately to a Rust service;
4. preserve capability/session/edition checks;
5. add frontend contract mocks/tests and Rust service tests.

React components do not call `invoke()` directly.

## 8. UI selection

Before creating UI, read:

- `UI-SYSTEM-CONTRACT.md`
- `UI-QUALITY-GUARDRAILS.md`
- `GLASS-SYSTEM-CONTRACT.md` when glass is involved.

Compose an existing primitive/pattern when one fits.

Do not reproduce its appearance with local CSS.

## 9. Materials

Feature code chooses semantic surface/material roles.

It may request:

- Major Glass;
- Minor Glass;
- Minor Shell;
- Opaque;
- Cutout;
- radius/elevation when the pattern intentionally exposes them.

Feature code does not implement:

- backdrop-filter strings;
- overscan;
- rim rendering;
- batch/promotion;
- logical backdrop construction;
- WebView2 refresh workarounds.

Foundational material-renderer changes require an ADR.

## 10. Motion/presence

Use the shared motion/presence system.

Compose channels such as:

- Fade;
- Material Fade;
- Slide;
- Lift;
- Scale;
- Geometry Morph.

Do not create an independent `requestAnimationFrame` loop inside a feature when the shared scheduler
can own it.

Do not fade native glass through ancestor opacity.

## 11. Scrollable UI

Use the shared ScrollArea/pattern.

Do not solve scrollbar behavior with feature-local magic padding/gutters.

For glass lists, use the material/content/effect behavior defined by the Glass System Contract.

## 12. Dialogs/overlays

Use the shared dialog/overlay structure.

Choose the correct surface role and logical glass layer.

Feature code owns dialog content/workflow, not a bespoke shell.

## 13. History

History records completed persistent transactions.

Do not put:

- camera;
- selection;
- hover;
- menus;
- animation;
- in-progress gesture state

into document history.

## 14. Persistence

The persistence coordinator observes committed workspace changes.

Feature code never performs ordinary document saves directly.

Media import is a separate resource operation because bytes must enter native storage before the
document can reference them; the media service owns rollback/cleanup.

## 15. Security classification

Before persisting a field, classify it as:

- encrypted document data;
- unencrypted bounded media transport;
- device-local configuration;
- encrypted device-local remembered view;
- ephemeral session/transient state.

Follow `SECURITY.md` and `DATA-FORMAT.md`.

## 16. Performance

For rendering/interaction features define:

- subscription granularity;
- culling/visibility behavior;
- hot-path operations;
- material depth/batching implications;
- applicable benchmark/diagnostics.

Avoid document-wide selectors inside repeated element renderers.

## 17. Documentation

After meaningful work:

- update `REFACTOR-STATE.md`;
- append durable history/measurements to `WORK-LOG.md`;
- update CODEMAP when subsystem ownership changes;
- update parity when retained behavior changes/is accepted;
- update subsystem contracts only for real contract changes;
- add ADR for foundational decisions.

## 18. Review checklist

Reject the implementation if any answer is yes:

- Does AppShell gain feature logic?
- Does a component call Tauri directly?
- Does domain code import React/DOM/Tauri?
- Does pointer movement persist/history/serialize?
- Does the feature bypass shared primitives for a common control?
- Does the feature implement raw glass/material behavior?
- Does a local style recreate a primitive variant?
- Does a scroll panel invent a scrollbar workaround?
- Does a dialog invent a bespoke shell without need?
- Does a click target become smaller than the UI guardrail?
- Does new code import legacy persistence/data formats?
