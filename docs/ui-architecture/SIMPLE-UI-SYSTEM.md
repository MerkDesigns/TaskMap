# TaskMap Simple UI System

## Status and scope

This document defines the proposed public architecture for TaskMap UI. It describes four concepts and the contracts between them. It does not define development tooling, feature recipes, or a specific WebView2 rendering technique.

The current production glass appearance remains the visual baseline.

Detailed definitions and optional capabilities are indexed in the [TaskMap UI System Part Reference](TaskMap-UI-System-Part-Reference.md).

## Goal

TaskMap UI should be assembled from a small number of predictable concepts. Feature code describes shapes and content. The UI system privately handles material rendering, composition, and WebView2 workarounds.

The public architecture must remain simple even when its renderer needs private optimizations.

## The four concepts

These are architectural roles, not necessarily four DOM elements or four physical renderer layers.

### 1. Surface

A Surface describes visible geometry and a local interaction area:

- position and size
- shape and corner radius
- local clipping boundary when required
- pointer hit area
- stable identity for geometry tracking

A Surface can exist without a Material. A Surface can have at most one base Material. More complex visuals are built from nested Surfaces instead of stacking unrelated Materials on one Surface.

Layout, scrolling, dragging, resizing, and animation controllers may change a Surface, but they are not responsibilities of the Surface itself.

### 2. Material

A Material is one visual recipe applied to Surface geometry.

Initial recipes:

- `major-glass`
- `minor-glass`
- `opaque`
- `cutout`

Materials own their complete visual construction. For glass this includes preblur, main blur, overscan, tint, rim, shadow, and WebView2-specific stability behavior.

Materials do not own layout, feature state, scrolling, interaction, Content, or animation timing.

Major and Minor describe different optical roles. They do not enforce a specific physical size or exact nesting depth.

### 3. Content

Content is ordinary HTML associated with a Surface:

- text
- buttons
- icons
- inputs
- images
- previews
- custom feature UI

Content is a conceptual role, not necessarily a required React component or wrapper. A specialized Surface may introduce private internal slots when rendering requires them, but ordinary feature Content remains normal DOM.

### 4. VisualGroup

A VisualGroup is a stable compositing boundary containing complete Surfaces, Materials, and Content.

It provides only group-level presentation values:

- alpha
- group transform
- stable group ownership and bounds

A VisualGroup does not own animation timing, mounting, focus, pointer blocking, scrolling, dragging, or feature state. Reusable behavior helpers control those concerns and write presentation values to the group.

At alpha `1` and an identity transform, adding a VisualGroup must not change the appearance of its children.

## How the concepts relate

```text
VisualGroup
└── Surface
    ├── optional Material
    ├── Content
    └── optional nested Surfaces
```

The Surface is the authoritative geometry source. The Material renders that geometry. Content is placed in the same local coordinate space. VisualGroup controls the finished composition without requiring feature code to understand the renderer.

## Supporting behavior kit

TaskMap will also have reusable behavior components and hooks. They are tools used with the four concepts, not additional architectural layers.

Examples:

- layout and scrolling
- presence and exit retention
- motion timing and easing
- dragging and resizing
- pointer and focus control

This separation prevents Surface and VisualGroup from becoming general-purpose god components.

## Composition contract

- Local Surface layout is resolved before a VisualGroup transform is applied.
- Group alpha is conceptually applied after the group's owned visual planes are composed.
- Nested VisualGroup alpha multiplies once per group.
- A Surface belongs to one nearest VisualGroup.
- Material batching may not cross VisualGroup boundaries when group presentation can differ.
- Feature code never applies `backdrop-filter`, material masks, blur, rim rendering, or renderer refresh hacks.
- Feature code never implements group fading with ordinary ancestor opacity around native glass.
- Material geometry, Content geometry, rims, and shadows must use one authoritative Surface geometry snapshot per frame.
- Material renderer nodes remain stable during ordinary state changes.

## Minimal example

```tsx
<VisualGroup alpha={groupAlpha} transform={groupTransform}>
  <Surface material="major-glass">
    <Header />

    <Surface material="minor-glass">
      <Controls />
    </Surface>
  </Surface>
</VisualGroup>
```

Exact component names and JSX remain provisional. The example documents ownership only.

## Core rules

- Keep the public model limited to Surface, Material, Content, and VisualGroup.
- Add capability through specialized parts and reusable behavior helpers, not new fundamental layers.
- Preserve native DOM semantics for Content, focus, hit testing, and scrolling.
- Keep renderer-owned nodes decorative, inaccessible to pointer input, and hidden from accessibility APIs.
- Preserve accepted glass optics unless an intentional visual change is requested.
- Keep renderer topology stable while state changes.
- Prefer automatic behavior with a small number of explicit variants over many configuration flags.
- Optimize only behind the public boundary and never expose batching or WebView2 workarounds to features.
- Add complexity only after an actual TaskMap use case requires it.

## Non-goals

This document does not choose:

- CSS, SVG, Canvas, or another private rendering backend
- the exact WebView2-safe alpha implementation
- feature-specific compositions such as Canvas Browser or Settings
- development tooling and workflow

Those choices must obey this architecture rather than redefine it.
