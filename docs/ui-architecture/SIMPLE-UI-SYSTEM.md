# TaskMap Simple UI System

## Status and scope

This document defines the proposed public architecture for TaskMap UI. It describes three core
concepts and the contracts between them. It does not define development tooling, feature recipes,
or a specific WebView2 rendering technique.

The current production glass appearance remains the visual baseline.

Detailed definitions and optional capabilities are indexed in the
[TaskMap UI System Part Reference](UI-SYSTEM-PART-REFERENCE.md).

## Goal

TaskMap UI should be assembled from a small number of predictable concepts. Feature code describes
geometry and content. The UI system privately handles material rendering and WebView2 workarounds.

The public architecture must remain simple even when a Material needs private rendering details.

## The three core concepts

These are architectural roles, not three required renderer layers.

### 1. Surface

A Surface describes visible geometry and a local interaction area:

- position and size
- shape and corner radius
- local clipping boundary when required
- pointer hit area
- stable identity for geometry tracking

A Surface can exist without a Material. A Surface can have at most one base Material. More complex
visuals use nested Surfaces instead of stacking unrelated Materials on one Surface.

Layout, scrolling, dragging, resizing, motion, and presence behaviors may act on a Surface, but they
are not responsibilities of the Surface itself.

### 2. Material

A Material is one visual recipe applied to Surface geometry.

Initial recipes:

- `major-glass`
- `minor-glass`
- `opaque`
- `cutout`

Materials own their complete visual construction. For glass this includes preblur, main blur,
overscan, tint, rim, shadow, and WebView2-specific stability behavior.

Materials do not own layout, feature state, scrolling, interaction, Content, presence, or animation
timing. Major and Minor describe optical roles, not enforced physical sizes or nesting depths.

### 3. Content

Content is ordinary HTML associated with a Surface:

- text
- buttons
- icons
- inputs
- images
- previews
- custom feature UI

Content retains normal DOM layout, accessibility, focus, selection, and interaction. It is a
conceptual role and does not require a universal component or wrapper.

## How the concepts relate

```text
Surface
├── optional Material
├── Content
└── optional nested Surfaces
```

The Surface is the authoritative geometry source. The Material renders that geometry. Content uses
ordinary DOM in the same local coordinate space.

## Optional behavior helpers

Reusable behaviors are tools used with the three core concepts, not additional architectural
layers.

Expected behavior categories include:

- layout
- scrolling
- motion
- presence and exit retention
- dragging
- resizing
- pointer and focus control

Behaviors may coordinate Surface, Material, and Content while keeping feature state and rendering
ownership in their appropriate modules.

## Composition contract

- Content layout remains the DOM source of truth.
- A Surface is the authoritative source for its Material geometry and hit area.
- Feature code never implements backdrop filters, blur, tint, rim, shadow, overscan, or renderer
  refresh workarounds.
- Material geometry, Content geometry, rims, and shadows use one authoritative Surface geometry
  snapshot per frame.
- Material renderer nodes remain stable during ordinary state changes.
- Optional behaviors do not become new material or content layers.

## Experimental material-aware presence

Native glass must never be faded using ancestor opacity, masks, or `filter: opacity()`.

The isolated UI Lab validates an experimental optional presence behavior attached directly to a
Surface. It uses one progress timeline. Fade asks each glass Material to interpolate its existing
parts toward neutral and fades only explicitly marked ordinary Content. Nested glass Surfaces
inherit progress and respond through their own Materials. Full overscan and Material node identity
remain stable.

Lift and Slide are independent movement effects. They may share the same timeline with Fade, and
their numerical movement channels are combined into one Surface transform write. Presence timing,
interruption, reduced-motion settling, and endpoint interaction state remain behavior concerns.

This experiment does not finalize a production API or migrate production features.

## Minimal example

```tsx
<Surface material="major-glass">
  <Header />

  <Surface material="minor-glass">
    <Controls />
  </Surface>
</Surface>
```

Exact component names and JSX remain provisional. The example documents ownership only.

## Core rules

- Keep the public model limited to Surface, Material, and Content.
- Add capability through specialized parts and optional behavior helpers, not new fundamental
  layers.
- Preserve native DOM semantics for Content, focus, hit testing, and scrolling.
- Keep renderer-owned nodes decorative, inaccessible to pointer input, and hidden from
  accessibility APIs.
- Preserve accepted glass optics unless an intentional visual change is requested.
- Keep renderer topology stable while state changes.
- Prefer automatic behavior with a small number of explicit variants over many configuration flags.
- Add complexity only after an actual TaskMap use case requires it.

## Non-goals

This document does not choose:

- production adoption or a public API for the UI Lab presence experiment
- CSS, SVG, Canvas, or another private material renderer
- feature-specific compositions such as Canvas Browser or Settings
- development tooling and workflow

Those choices must obey this architecture rather than redefine it.
