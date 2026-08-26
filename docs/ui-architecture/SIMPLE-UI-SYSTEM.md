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

These are architectural roles, not necessarily three DOM elements or physical renderer layers.

### 1. Surface

A Surface describes visible geometry and a local interaction area:

- position and size
- shape and corner radius
- local clipping boundary when required
- pointer hit area
- stable identity for geometry tracking

A Surface can exist without a Material. A Surface can have at most one base Material. More complex
visuals are built from nested Surfaces instead of stacking unrelated Materials on one Surface.

Layout, scrolling, dragging, resizing, motion, and presence behaviors may change or contain a
Surface, but they are not responsibilities of the Surface itself.

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
timing.

Major and Minor describe different optical roles. They do not enforce a specific physical size or
exact nesting depth.

### 3. Content

Content is ordinary HTML associated with a Surface:

- text
- buttons
- icons
- inputs
- images
- previews
- custom feature UI

Content is a conceptual role, not necessarily a required React component or wrapper. A specialized
Surface may introduce private internal slots when rendering requires them, but ordinary feature
Content remains normal DOM.

## How the concepts relate

```text
Surface
├── optional Material
├── Content
└── optional nested Surfaces
```

The Surface is the authoritative geometry source. The Material renders that geometry. Content is
placed in the same local coordinate space.

## Optional behavior helpers

Reusable behaviors are tools used with the three core concepts, not additional architectural
layers or compositor abstractions.

Expected behavior categories include:

- layout
- scrolling
- motion
- presence and exit retention
- dragging
- resizing
- pointer and focus control

Behaviors may coordinate core concepts while keeping feature state and rendering ownership in their
appropriate modules.

## Composition contract

- Content layout remains the DOM source of truth.
- A Surface is the authoritative source for its Material geometry and hit area.
- Feature code never implements backdrop filters, blur, tint, rim, shadow, overscan, or renderer
  refresh workarounds.
- Material geometry, Content geometry, rims, and shadows use one authoritative Surface geometry
  snapshot per frame.
- Material renderer nodes remain stable during ordinary state changes.
- Optional behaviors do not become new material or content layers.

## Future presence-animation direction

No accepted presence-animation implementation exists yet.

Native glass must never be faded using ancestor opacity, masks, or `filter: opacity()`.

A future material-aware presence behavior may coordinate Material parts and Content separately.
This is a direction for later investigation, not a specified API or an implemented capability.

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

- a presence-animation API or implementation
- CSS, SVG, Canvas, or another private material renderer
- feature-specific compositions such as Canvas Browser or Settings
- development tooling and workflow

Those choices must obey this architecture rather than redefine it.
