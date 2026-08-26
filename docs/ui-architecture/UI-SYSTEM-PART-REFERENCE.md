# TaskMap UI System Part Reference

## Purpose

This document expands the [TaskMap Simple UI System](SIMPLE-UI-SYSTEM.md). It catalogs the three
core concepts, optional Surface variants, supporting behaviors, and renderer invariants without
adding architectural layers.

## Classification

| Classification | Meaning                                                           |
| -------------- | ----------------------------------------------------------------- |
| **Core**       | Used to describe the architecture itself                          |
| **Default**    | Normal implementation used by most UI                             |
| **Optional**   | Used only by compositions that need the capability                |
| **Supporting** | Reusable behavior that controls core parts but is not a new layer |
| **Private**    | Renderer implementation hidden from feature code                  |

## Index

| Category      | Part                                                              | Classification     |
| ------------- | ----------------------------------------------------------------- | ------------------ |
| Core          | [Surface](#surface)                                               | Core               |
| Core          | [Material](#material)                                             | Core               |
| Core          | [Content](#content)                                               | Core               |
| Materials     | [Major Glass](#major-glass)                                       | Default recipe     |
| Materials     | [Minor Glass](#minor-glass)                                       | Default recipe     |
| Materials     | [Opaque](#opaque)                                                 | Default recipe     |
| Materials     | [Cutout](#cutout)                                                 | Default recipe     |
| Geometry      | [Surface geometry contract](#surface-geometry-contract)           | Private invariant  |
| Surface types | [Standard Surface](#standard-surface)                             | Default            |
| Surface types | [Viewport Surface](#viewport-surface)                             | Optional           |
| Surface types | [Slice Viewport Surface](#slice-viewport-surface)                 | Optional           |
| Behaviors     | [Behavior helpers](#behavior-helpers)                             | Supporting         |
| Rendering     | [Material ordering and sampling](#material-ordering-and-sampling) | Private invariant  |
| Animation     | [Material-aware presence](#material-aware-presence)               | UI Lab experiment  |
| Quality       | [Performance and accessibility](#performance-and-accessibility)   | Required invariant |
| Decisions     | [Decision status](#decision-status)                               | Index              |

## Core concepts

### Surface

A Surface describes geometry and a local interaction area.

Responsibilities:

- stable identity
- local bounds
- supported shape
- corner radii or circle geometry
- optional local clip geometry
- hit-test area
- publication of one authoritative geometry snapshot

Non-responsibilities:

- material optics
- layout algorithms
- animation timing
- scrolling mechanics
- presence and mounting
- dragging or resizing controllers
- feature state

A Surface may have zero or one base Material. Nested Surfaces are used when a composition needs
multiple material regions.

### Material

A Material consumes Surface geometry and produces decorative visual output.

Glass recipe responsibilities:

- preblur and main blur
- blur-derived overscan
- saturation, brightness, contrast, tint, and tone
- rim geometry and appearance
- shadow geometry and appearance
- renderer stability behavior

The Material does not measure feature DOM independently. It consumes Surface geometry so its body,
rim, shadow, and Content alignment cannot disagree within one frame.

### Content

Content is ordinary DOM associated with a Surface. It retains native browser behavior for layout,
focus, selection, scrolling, pointer input, images, and text.

Content does not require a universal component or wrapper. An optional behavior may use a private,
explicit marker or ref for the ordinary DOM it controls. Nested material-bearing Surfaces remain
outside any ordinary-content opacity target so their Materials can respond independently.

Menus, tooltips, dialogs, and other UI that intentionally escape a Surface use the application's
existing portal or overlay facilities. Those facilities are integration mechanisms, not core UI
system concepts.

## Material recipes

### Major Glass

`major-glass` is the stronger primary glass recipe normally used for outer panels and primary
shells.

The name describes its optical role. It does not require the Surface to be physically large, first
in the DOM, or at a fixed nesting depth.

### Minor Glass

`minor-glass` is the lighter secondary glass recipe normally used for nested cards, controls, and
islands.

The name describes its optical role. It may be used wherever its optics are appropriate, provided
material ordering and sampling remain correct.

### Shared glass construction

Major and Minor Glass share the same construction model with different values:

- preblur
- main blur
- overscan derived from total sampling needs
- tint and tone
- rim
- shadow

Preblur and main blur exist to reduce shimmering and temporal artifacts. Overscan is sampling
geometry, not visible effect overflow, and must remain distinct from shadow overflow.

The current accepted production values remain the initial recipes during migration.

### Opaque

`opaque` is a non-transparent recipe for Surfaces that should neither reveal nor blur their
backdrop.

### Cutout

`cutout` is a recessed recipe for previews, wells, and inset regions.

## Geometry

### Surface geometry contract

The Surface system is the only geometry authority for material rendering.

A geometry snapshot conceptually contains:

- stable Surface ID
- local bounds
- supported shape and radii
- current clip chain
- current visible geometry when requested by a specialized Surface
- material-parent relationship
- visibility and culling state

Rules:

- Content layout remains the DOM source of truth.
- DOM measurement is coalesced into one geometry snapshot per affected frame.
- Body, overscan, rim, and shadow read the same snapshot.
- Resize, scroll, and layout invalidations are local and frame-coalesced.
- Fully invisible material output is culled.
- Geometry work must not dispatch persistent state, create history, save, or render React for every
  frame.

Initial shape support is deliberately limited to axis-aligned rounded rectangles, circles, and
axis-aligned clip rectangles. More complex geometry is added only for a demonstrated feature.

## Surface types

### Standard Surface

Classification: **Default**.

The normal Surface has no specialized viewport tracking. It is used for most panels, cards,
controls, modal shells, and material-free geometry.

### Viewport Surface

Classification: **Optional**.

A Viewport Surface provides native HTML clipping or scrolling and publishes its clip geometry to
descendant Surfaces.

It does not automatically change descendant Material silhouettes. Normal browser clipping remains
the default behavior: Content and decorative output disappear under the viewport boundary.

The Viewport Surface uses native scrolling and accessibility behavior. It does not implement
scrolling through React state.

### Slice Viewport Surface

Classification: **Optional**.

This Surface type exists only for designs that intentionally want a partially visible glass item to
become a newly cut glass shape. It is not the default for every scrolling list.

#### Visible-shape contract

```text
original child shape
intersected with the Slice Viewport bounds
= visible material silhouette
```

For a partially clipped circle or rounded rectangle:

- original visible curves remain curved
- intersection edges become flat
- the rim follows the complete visible silhouette, including new flat edges
- the shadow is generated from the visible silhouette
- invisible geometry produces no material output
- Content continues to use native HTML clipping

The Surface system publishes three related geometries:

1. **Original shape** — complete child geometry.
2. **Visible silhouette** — original geometry intersected with the active clip chain.
3. **Effect area** — visible silhouette expanded for material sampling and visible shadow needs.

Blur overscan remains hidden behind the visible silhouette. It must not be mistaken for visible
shadow overflow. When the visible silhouette is effectively empty, body, rim, and shadow disappear
together. Initial implementation is limited to axis-aligned cases.

## Supporting behavior kit

### Behavior helpers

Classification: **Supporting, not architectural layers**.

Behavior helpers may coordinate Surfaces, Materials, or Content while keeping their responsibilities
narrow.

Expected categories:

- **Layout helpers:** rows, stacks, grids, anchors, and sizing.
- **Scroll helpers:** native scroll state, wheel behavior, and optional smoothing.
- **Motion helpers:** shared scheduling, easing, springs, and interruption.
- **Presence helpers:** mount retention, enter/exit state, and completion callbacks.
- **Interaction helpers:** pointer blocking, drag ownership, and focus behavior.
- **Resize helpers:** user-driven or content-driven resizing.

Helpers may be components, hooks, or controllers. They do not become Materials, Surfaces, Content,
or renderer layers merely because they coordinate those parts.

Layout, presence, motion, scrolling, dragging, and resizing remain optional behaviors. A feature
uses only the helpers it needs.

## Rendering invariants

### Material ordering and sampling

- Recipe names do not define fixed renderer depth.
- Sampling order follows the actual visual ownership and stacking order.
- A nested Material samples the completed visual result beneath it, including appropriate ancestor
  Materials.
- Moving a renderer node must preserve its intended backdrop source.
- Decorative shadows do not become new backdrop-sampling sources unless the accepted visual recipe
  explicitly requires it.
- Overscan is clamped to the correct sampling boundary and never used as a substitute for visible
  effect overflow.

## Material-aware presence

Native glass must never be faded using ancestor opacity, masks, or `filter: opacity()`.

The current isolated UI Lab experiment attaches an optional controller directly to the outer
Surface ref. It owns one normalized timeline, direction, interruption, reversal, reduced-motion
settling, completion, and endpoint interaction state. It writes imperatively through TaskMap's
shared frame scheduler without rendering React on every frame.

Fade is material-aware:

- the outer Surface publishes one inherited progress custom property during the transition
- each glass Material interpolates preblur and main blur from zero to its recipe values
- saturation, brightness, and contrast interpolate from neutral to their recipe values
- tint, highlight, rim, and shadow fade through their existing Material implementation
- full overscan and Material DOM identity remain stable
- explicitly marked ordinary Content uses opacity
- nested glass Surfaces remain outside ordinary-content opacity targets and use their own Material
  parts

Lift contributes only a small vertical movement. Slide contributes only directional horizontal
movement. Fade, Lift, and Slide may be composed on one timeline, and one transform composer writes
the Surface transform. Lift and Slide alone do not change Material or Content visibility.

At progress `1`, the experiment follows the unchanged Material endpoint. At progress `0`, no
Material or marked Content output remains over the bare backdrop. Intermediate progress retains
live backdrop sampling while blur decreases toward zero.

The UI Lab result does not finalize a production API and has not migrated any production feature.

## Quality invariants

### Performance and accessibility

- Native DOM remains responsible for text, controls, focus, selection, scrolling, and hit testing.
- Renderer-owned nodes are decorative, `pointer-events: none`, and accessibility-hidden.
- High-frequency geometry and presentation changes use imperative, frame-coalesced updates.
- React does not render on every scroll, drag, resize, or animation sample.
- Only visible or imminently visible repeated Surfaces retain expensive material work.
- Fully off-screen material geometry is culled.
- Large lists may virtualize Content and material geometry together.
- Geometry changes must not touch persistence, history, encryption, or database work.
- Window resizing and device-pixel-ratio changes refresh geometry, overscan, and rims coherently.

## Required TaskMap coverage

The architecture must eventually support these without adding feature-specific material rendering
paths:

- Canvas Browser cards, scrolling, reordering, and dragging
- Extensions Browser cards
- Settings shell, islands, and nested dialogs
- minimap visibility
- context menus, tooltips, and popovers
- liquid switches and moving selection indicators
- content switching inside one retained panel shell
- modal stacking and portals
- resizing and device-pixel-ratio changes

## Decision status

### Accepted architectural contracts

- Three core concepts: Surface, Material, and Content.
- Surface is the geometry and interaction-area authority.
- One optional base Material may be applied to a Surface.
- Content remains ordinary DOM and requires no universal wrapper.
- Layout, scrolling, motion, presence, dragging, and resizing are optional behavior helpers.
- Supporting helpers are not additional layers.
- Major and Minor are optical roles rather than enforced sizes or depths.
- Clip-aware slicing is an optional Surface variant, not universal scroll behavior.

### Private implementation choices

- CSS, SVG, Canvas, or mixed rendering for specialized material silhouettes
- internal renderer organization for rims and shadows
- geometry thresholds for suppressing effectively empty slices
- any eventual production presence API

Private implementation choices may change without altering feature-facing architecture or accepted
visual output.
