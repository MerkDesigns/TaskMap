# TaskMap UI System Contract

> Status: normative public UI architecture for the refactor.
>
> This document defines how TaskMap UI is composed. It intentionally avoids duplicating exact visual
> constants from source code and avoids prescribing private WebView2 rendering tricks.

## 1. Authority

This is the highest-authority document for general TaskMap UI architecture.

- `GLASS-SYSTEM-CONTRACT.md` owns glass-specific behavior and material acceptance.
- `UI-QUALITY-GUARDRAILS.md` owns reusable-control, hit-target, dialog, scrollbar and consistency
  rules.
- Source tokens/material definitions own exact numeric visual constants.
- Historical UI plans and experiments do not override these contracts.

## 2. Goal

TaskMap UI should be understandable from a small set of concepts.

Feature code describes what a surface is and what content/behavior it needs.
The UI system owns common presentation, motion, material rendering and reusable interaction patterns.

The public model stays simple even when WebView2 requires complicated private rendering work.

## 3. The three core concepts

### Surface

A Surface owns visible/local geometry and interaction bounds.

Responsibilities may include:

- stable identity;
- position/size;
- supported shape/radius;
- local hit area;
- current visible material silhouette when specialized behavior requires it;
- publication of one authoritative geometry state.

A Surface does not own material optics, feature state, persistence or database behavior.

### Material

A Material is a visual recipe applied to Surface geometry.

Registered roles include:

- Major Glass;
- Minor Glass;
- Opaque;
- Cutout.

Glass implementation details are governed by `GLASS-SYSTEM-CONTRACT.md`.

Feature code never owns raw backdrop-filter strings, overscan math, rim rasterization, browser
refresh hacks or batching.

### Content

Content is ordinary semantic DOM associated with a Surface:

- text;
- icons;
- buttons;
- inputs;
- images;
- previews;
- custom feature UI.

Content keeps normal DOM semantics for focus, accessibility, selection and pointer interaction.

Material geometry may morph independently from Content layout. A specialized behavior may apply a
rounded content mask without scaling/distorting the Content.

## 4. Composition

Conceptually:

```text
Surface
├─ optional Material
├─ Content
├─ external effects owned by the Surface/Material
└─ optional nested Surfaces
```

Surface, Material and Content are roles, not mandatory wrapper layers.

Nested Surfaces are used when a composition genuinely contains another material object.

## 5. Geometry authority

For a given frame, one owner supplies the geometry used by:

- material body;
- rim;
- shadow/effects;
- content mask where required;
- hit testing where applicable.

Do not let separate systems independently reconstruct the same moving geometry.

Translation should use cached numeric geometry/transform updates.
DOM measurement is reserved for real layout/size invalidation.

## 6. Behavior helpers

Layout, scrolling, motion, presence, dragging and resizing are **behaviors**, not new architectural
layers.

Reusable behavior families may include:

- Stack/Inline/Grid layout;
- ScrollArea/list behavior;
- shared motion scheduling;
- composable presence;
- geometry morphing;
- drag ownership/promotion;
- resize behavior;
- focus/pointer control.

A helper may coordinate Surface, Material and Content while preserving their ownership boundaries.

## 7. Motion

TaskMap uses one shared UI motion scheduling model for JavaScript-driven animation.

Components must not create independent animation loops when a shared scheduler can own the work.

Motion is composed from channels rather than monolithic named effects:

- Fade;
- Material Fade;
- Slide;
- Lift;
- Scale;
- Geometry Morph.

Channels may share a controller/timeline and may have different curves/delays.

Geometry motion is opt-in, not automatic for every layout change.

## 8. No separate reduced-motion architecture

The final UI system does not maintain a separate reduced-motion motion/material mode.

Existing `prefers-reduced-motion` immediate-settle branches are legacy behavior and may be removed as
components migrate to the final motion system.

This is an intentional product decision. Reintroducing reduced-motion behavior later requires an
explicit product/system decision rather than scattered local branches.

## 9. Reusable primitives

Generic controls live under the reusable UI layer and are composed by features.

Examples:

- Button;
- IconButton;
- ToggleButton;
- Switch;
- Checkbox/Radio;
- Slider;
- TextField/TextArea/SearchField;
- Tabs/LiquidTabs;
- Stack/Inline/Grid;
- Dialog/overlay structure;
- ScrollArea;
- menu primitives;
- status/display primitives.

If a primitive exists, a feature should not rebuild its visual identity with local CSS.

Core quality constraints are in `UI-QUALITY-GUARDRAILS.md`.

## 10. TaskMap patterns

TaskMap-specific UI compositions sit above primitives.

Examples:

- Workspace chrome;
- Canvas Browser;
- Minimap;
- Settings;
- Quick Extensions;
- dialogs/overlays;
- Canvas Browser cards;
- settings islands.

Patterns may compose primitives, Surfaces, Materials and behaviors.

Patterns do not implement a second material system or fork generic control identity.

## 11. Surface roles

Every intentional visible surface has an explicit role:

- Major Glass;
- Minor Glass;
- Minor Shell;
- Opaque;
- Cutout;
- transparent/layout-only.

Glass logical layers/depth are defined by `GLASS-SYSTEM-CONTRACT.md`.

## 12. Dialogs and overlays

Reusable dialog structure should be standardized:

```text
Overlay/Dialog Surface
├─ Header
├─ Body
└─ Actions/Footer
```

The surface material role, scrolling strategy, padding/alignment and close/action primitives are
explicit.

Feature-specific dialogs provide content/behavior; they do not independently invent the shell.

## 13. Scrollable UI

Native scrolling remains preferred for semantic/content scrolling.

A reusable ScrollArea owns the chosen scrollbar presentation and content viewport behavior.

Glass-list material behavior is a specialized pattern governed by `GLASS-SYSTEM-CONTRACT.md`.

Scrollbar presentation must not accidentally alter the material recipe or reserve unexplained dead
space.

## 14. Hit testing and interactive targets

Visible icon size and hit-target size are separate concepts.

Interactive controls use reusable primitives with a comfortable minimum target as defined by
`UI-QUALITY-GUARDRAILS.md`.

A tiny glyph may still have a larger invisible/transparent interactive box.

## 15. Styling ownership

Source theme tokens own shared visual values such as:

- accent;
- typography;
- spacing;
- radii;
- control heights;
- semantic colors;
- common chrome dimensions.

Do not duplicate exact token values across architecture docs unless a value is itself an acceptance
requirement.

Feature CSS may lay out a composition but should not redefine primitive identity or material optics.

## 16. Development App/UI-Lab workbench

UI Lab becomes a development view of the real application runtime.

Target composition:

```text
one DatabaseApplication/session/workspace
└─ DevelopmentVisualWorkbench
   ├─ App
   └─ UI Lab
```

The switch changes the rendered view, not the database/session owner.

The App and Lab share:

- current database session;
- normalized workspace;
- media/runtime resources;
- UI/material code;
- theme;
- motion system;
- development tuning overrides.

The Lab may use synthetic fixtures in addition to the real workspace, but it may not create a
parallel persistence architecture.

## 17. Development tuning

A development-only tuning layer is allowed and expected.

It may expose:

- material optical values;
- rim/shadow;
- overscan;
- motion timings/curves;
- material-fade timing;
- geometry-morph timing.

Tuning state is not document data.

The removed legacy **production** frosted-glass tuner does not prohibit a development UI-Lab tuner.

## 18. Diagnostics

Development UI may expose diagnostic overlays/counters for:

- geometry bounds;
- content masks;
- material/effect bounds;
- logical glass context;
- hit targets;
- frame timing;
- material work.

Diagnostics never become production styling or persistent document data.

## 19. Feature-facing dependency direction

Preferred UI dependency:

```text
feature
→ TaskMap pattern
→ primitive/behavior
→ Surface/Material/Motion
→ private renderer backend
```

Features do not import private material-renderer internals.

The broader application/domain/platform dependency direction remains defined by `ARCHITECTURE.md`.

## 20. Quality rule

UI implementation is not accepted merely because it compiles.

A feature must satisfy:

- correct surface role;
- correct primitive ownership;
- correct hit targets;
- intentional scroll treatment;
- consistent layout;
- material contract where applicable;
- interaction behavior;
- applicable visual/manual acceptance.

See `UI-QUALITY-GUARDRAILS.md`.

## 21. What this contract intentionally does not define

This document does not freeze:

- the private WebView2 glass renderer topology;
- exact blur/tint/rim numeric constants;
- every primitive that may ever exist;
- feature-specific domain behavior;
- exact motion tuning values.

Those are owned by the glass contract, source definitions, feature modules or later concrete product
requirements.

## 22. Adding new UI capability

Before adding a new primitive/pattern/material behavior:

1. identify whether the capability already exists;
2. determine the correct Surface/Material/Content ownership;
3. avoid local visual forks;
4. define interaction and hit-target behavior;
5. define scroll/presence/motion behavior if relevant;
6. add focused tests;
7. validate in UI Lab and, where applicable, the real App view;
8. update this contract only if the public architecture actually changes.
