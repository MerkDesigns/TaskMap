# TaskMap UI System Part Reference

## Purpose

This document expands the [TaskMap Simple UI System](TaskMap-Simple-UI-System.md). It catalogs core parts, optional variants, supporting helpers, and renderer invariants without changing the four-concept architecture.

## Classification

| Classification | Meaning |
| --- | --- |
| **Core** | Used to describe the architecture itself |
| **Default** | Normal implementation used by most UI |
| **Optional** | Used only by compositions that need the capability |
| **Supporting** | Reusable behavior that controls core parts but is not a new layer |
| **Private** | Renderer implementation hidden from feature code |
| **Provisional** | Contract is known but internal technique is not selected |

## Index

| Category | Part | Classification |
| --- | --- | --- |
| Core | [Surface](#surface) | Core |
| Core | [Material](#material) | Core |
| Core | [Content](#content) | Core |
| Core | [VisualGroup](#visualgroup) | Core / provisional backend |
| Materials | [Major Glass](#major-glass) | Default recipe |
| Materials | [Minor Glass](#minor-glass) | Default recipe |
| Materials | [Opaque](#opaque) | Default recipe |
| Materials | [Cutout](#cutout) | Default recipe |
| Geometry | [Surface geometry contract](#surface-geometry-contract) | Private invariant |
| Surface types | [Standard Surface](#standard-surface) | Default |
| Surface types | [Viewport Surface](#viewport-surface) | Optional |
| Surface types | [Slice Viewport Surface](#slice-viewport-surface) | Optional / provisional renderer |
| Behaviors | [Behavior helpers](#behavior-helpers) | Supporting |
| Rendering | [Material ordering and sampling](#material-ordering-and-sampling) | Private invariant |
| Rendering | [Batching boundaries](#batching-boundaries) | Private invariant |
| Rendering | [Group alpha contract](#group-alpha-contract) | Provisional backend |
| Integration | [Overlays, portals, and dragging](#overlays-portals-and-dragging) | Supporting contract |
| Quality | [Performance and accessibility](#performance-and-accessibility) | Required invariant |
| Decisions | [Decision status](#decision-status) | Index |

## Core parts

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

A Surface may have zero or one base Material. Nested Surfaces are used when a composition needs multiple material regions.

### Material

A Material consumes a Surface geometry snapshot and produces decorative visual output.

Glass recipe responsibilities:

- preblur and main blur
- blur-derived overscan
- saturation, brightness, contrast, tint, and tone
- rim geometry and appearance
- shadow geometry and appearance
- renderer stability behavior

The Material does not measure feature DOM independently. It consumes the Surface system's geometry snapshot so its body, rim, shadow, and Content alignment cannot disagree within one frame.

### Content

Content is normal DOM associated with a Surface. It retains native browser behavior for layout, focus, selection, scrolling, pointer input, images, and text.

Content is not required to use a universal wrapper. Specialized Surface implementations may introduce private slots only when necessary to separate native Content clipping from decorative material effects.

Menus, tooltips, and dialogs that intentionally escape a Surface are not treated as overflowing Content. They enter an appropriate overlay host with their own Surface and VisualGroup ownership.

### VisualGroup

A VisualGroup provides a stable owner for group compositing.

Responsibilities:

- group membership
- stable root bounds large enough for owned visual effects
- group alpha
- group transform
- composition with parent VisualGroups

Non-responsibilities:

- scheduler or easing choice
- presence and unmount timing
- focus trapping
- pointer blocking
- feature state
- scrolling, layout, dragging, or resizing

Supporting behavior helpers may control these concerns and imperatively write alpha or transform without React rendering every motion frame.

Nested group alpha is multiplicative and is applied exactly once for each group. Child Surface and Material implementations must not manually reapply inherited group alpha.

## Material recipes

### Major Glass

`major-glass` is the stronger primary glass recipe normally used for outer panels and primary shells.

The name describes its optical role. It does not require the Surface to be physically large, first in the DOM, or at a fixed nesting depth.

### Minor Glass

`minor-glass` is the lighter secondary glass recipe normally used for nested cards, controls, and islands.

The name describes its optical role. It may be used wherever its optics are appropriate, provided material ordering and sampling remain correct.

### Shared glass construction

Major and Minor Glass share the same construction model with different values:

- preblur
- main blur
- overscan derived from total sampling needs
- tint and tone
- rim
- shadow

Preblur and main blur exist to reduce shimmering and temporal artifacts. Overscan is sampling geometry, not visible effect overflow, and must remain distinct from shadow overflow.

The current accepted production values remain the initial recipes during migration.

### Opaque

`opaque` is a non-transparent recipe for surfaces that should neither reveal nor blur their backdrop.

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
- owning VisualGroup
- material-parent relationship
- visibility and culling state

Rules:

- Content layout remains the DOM source of truth.
- DOM measurement is coalesced into one geometry snapshot per affected frame.
- Body, overscan, rim, shadow, and batching read the same snapshot.
- VisualGroup transforms operate in group space and should not require every child to remeasure when the complete group moves.
- Resize, scroll, and layout invalidations are local and frame-coalesced.
- Fully invisible material output is culled.
- Geometry work must not dispatch persistent state, create history, save, or render React for every frame.

Initial shape support is deliberately limited to axis-aligned rounded rectangles, circles, and axis-aligned clip rectangles. More complex geometry is added only for a demonstrated feature.

## Surface types

### Standard Surface

Classification: **Default**.

The normal Surface has no specialized viewport tracking or escaped effect hosts. It is used for most panels, cards, controls, modal shells, and material-free geometry.

### Viewport Surface

Classification: **Optional**.

A Viewport Surface provides native HTML clipping or scrolling and publishes its clip geometry to descendant Surfaces.

It does not automatically change descendant Material silhouettes. Normal browser clipping remains the default behavior: Content and decorative output disappear under the viewport boundary.

The Viewport Surface uses native scrolling and accessibility behavior. It does not implement scrolling through React state.

### Slice Viewport Surface

Classification: **Optional with a provisional private renderer**.

This Surface type exists only for designs that intentionally want a partially visible glass item to become a newly cut glass shape.

It is not the default for every scrolling list.

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

Blur overscan remains hidden behind the visible silhouette. It must not be mistaken for visible shadow overflow.

When the visible silhouette is effectively empty, body, rim, and shadow disappear together. An orphaned shadow or rim must never remain after the body is culled.

#### Minimal effect boundary

The rule is automatic and has no common-case property:

1. A Slice Viewport clips descendant Content and material bodies to the visible silhouette.
2. A descendant rim and shadow may escape that local Slice Viewport edge.
3. Those escaped descendant effects stop at the inner shape of the nearest ancestor material-bearing Surface.
4. If no such Surface exists, they stop at the owning VisualGroup bounds.
5. If neither exists, they stop at the application viewport.

A Surface's own outer shadow is not clipped by its own shape. The rule applies to escaped effects from descendants.

Renderer-owned effect hosts are `pointer-events: none` and accessibility-hidden. Descendant shadows render above the ancestor Material but below the corresponding descendant body and interactive Content. Rims remain part of the descendant Material's top chrome.

Nested clip chains are intersected from nearest to farthest. Initial implementation is limited to axis-aligned cases.

## Supporting behavior kit

### Behavior helpers

Classification: **Supporting, not architectural layers**.

Behavior helpers control Surfaces or VisualGroups while keeping their responsibilities narrow.

Expected categories:

- **Layout helpers:** rows, stacks, grids, anchors, and sizing.
- **Scroll helpers:** native scroll state, wheel behavior, and optional smoothing.
- **Motion helpers:** shared scheduling, easing, springs, and interruption.
- **Presence helpers:** mount retention, enter/exit state, and completion callbacks.
- **Interaction helpers:** pointer blocking, drag ownership, and focus behavior.
- **Resize helpers:** user-driven or content-driven resizing.

Helpers may be components, hooks, or controllers. They do not become Materials, Surfaces, Content, or VisualGroups merely because they coordinate those parts.

The same helper should be reusable across glass and non-glass compositions whenever its behavior is material-independent.

## Rendering invariants

### Material ordering and sampling

- Recipe names do not define fixed renderer depth.
- Sampling order follows the actual visual ownership and stacking order.
- A nested Material samples the completed visual result beneath it, including appropriate ancestor Materials.
- Moving a renderer node to an effects host must preserve its intended backdrop source.
- Decorative shadows do not become new backdrop-sampling sources unless the accepted visual recipe explicitly requires it.
- Overscan is clamped to the correct sampling boundary and never used as a substitute for visible effect overflow.

### Batching boundaries

Batching is private and optional.

- A batch may not cross VisualGroup boundaries if the groups can have different alpha or transforms.
- A batch may not cross backdrop-sampling boundaries.
- A batch may not mix incompatible material recipes or material ordering.
- Every shape in a batch retains independent visible geometry, rim geometry, and culling state.
- Dragged or independently animated items may temporarily leave a settled batch without changing their accepted optics.
- Features never select, register, or invalidate batches directly.

### Group alpha contract

The internal implementation is provisional, but any accepted implementation must satisfy all of these requirements:

- Alpha `1` is visually equivalent to having no group compositor.
- Alpha `0` produces no visible body, rim, shadow, or Content.
- Intermediate alpha changes all owned visual output coherently.
- Native glass blur does not disappear before the rest of the group.
- The material topology remains stable while alpha changes.
- Group alpha is applied once, including through nested groups.
- Interruption and reversal continue from the current value.
- No React render, persistence, history, or material rebuild occurs per animation frame.
- Shared batches never prevent one VisualGroup from changing independently.

Ordinary ancestor CSS opacity and unverified generic masks are not accepted implementations for native glass.

## Integration contracts

### Overlays, portals, and dragging

- Menus, tooltips, popovers, and dialogs that escape local bounds use an overlay host with explicit Surface and VisualGroup ownership.
- Overlay Materials preserve correct backdrop sampling and stacking order.
- A dragged Surface uses a drag presentation owner rather than allowing a clipped ancestor to cut it incorrectly.
- Transfer into and out of drag presentation preserves stable feature identity and accepted Material optics.
- A portal does not inherit accidental clipping, alpha, or batching from the physical DOM location it left.

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

The architecture must eventually support these without adding feature-specific rendering paths:

- Canvas Browser cards, scrolling, reordering, and dragging
- Extensions Browser cards
- Settings shell, islands, and nested dialogs
- minimap visibility
- context menus, tooltips, and popovers
- liquid switches and moving selection indicators
- content switching inside one retained panel shell
- modal stacking and portals
- resizing, DPI changes, and interruption/reversal

## Decision status

### Accepted architectural contracts

- Four concepts: Surface, Material, Content, and VisualGroup.
- Surface is the geometry authority.
- One optional base Material per Surface.
- Content remains native DOM.
- VisualGroup owns group alpha and transform, not motion or presence behavior.
- Supporting helpers are not additional layers.
- Major and Minor are optical roles rather than enforced sizes or depths.
- Batches do not cross independently controlled VisualGroups or sampling boundaries.
- Clip-aware slicing is an optional Surface variant, not universal scroll behavior.
- Escaped descendant effects use the automatic nearest-ancestor boundary rule.

### Provisional private implementation choices

- WebView2-safe group-alpha technique
- CSS, SVG, Canvas, or mixed rendering for sliced silhouettes
- exact internal host topology for escaped rims and shadows
- exact geometry threshold for suppressing effectively empty slices

Private implementation choices may change without altering feature-facing architecture or accepted visual output.

