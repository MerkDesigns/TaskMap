# ADR 004: Renderer v2 presentation stack

- Status: Accepted
- Date: 2026-08-11
- Supersedes: ADR 003 for renderer-v2 presentation and materials, and ADR 001's transitional
  `LegacyApplication` presentation strategy

## Context

Architecture-v1 proved the normalized document, named-command, history, Redux persistence,
interaction, and Tauri/Rust boundaries. It also built an application-owned cached Canvas2D acrylic
compositor. That compositor reconstructs a simplified canvas scene and therefore cannot reliably
produce glass over the actual rendered DOM content, especially text and detailed images.

ADR 001's domain, state-ownership, failure-reporting, and platform-boundary decisions remain in
force. Its temporary plan to keep `App.tsx` active behind `LegacyApplication` described the
architecture-v1 migration and is not the renderer-v2 composition strategy.

Renderer v2 needs near-complete end-user parity without inheriting the old frontend's component and
presentation structure. Canvas interaction must remain cheap, while application chrome needs glass
that can blur and refract the live canvas.

## Decision

Renderer v2 is a new React presentation implementation. The main-branch frontend, old `App.tsx`,
and remaining architecture-v1/legacy frontend are reference material only. Renderer v2 retains and
reuses the normalized TypeScript document/domain model, named commands, transaction history,
Redux workspace and persistence coordination, Tauri/Rust database/encryption/session backend,
media/settings/workflow boundaries, and suitable framework-independent canvas geometry,
interaction, and virtualization.

Canvas elements render as ordinary React/DOM content. They do not use Liquid DOM materials. Pan,
zoom, drag, and resize keep a bounded transient path outside persistent Redux; pointer samples do
not serialize, save, encrypt, create history, invoke the database, or cause document-wide React
updates. A completed persistent gesture emits one named command.

Application UI glass uses `@liquid-dom/core` through one shared feature-facing material adapter.
There are exactly two Liquid DOM roles:

- Large Panel
- Small Panel

A role selects optical treatment. Width, height, padding, radius, position, and responsive layout
belong to the consuming component or layout pattern and are not material properties. Features do
not instantiate or tune Liquid DOM independently.

The Liquid DOM integration must blur and refract the live canvas DOM beneath UI surfaces, including
text, images, and static GIF posters/frames. The architecture-v1 cached Canvas2D compositor, its projected
`BackdropScene`, worker/fallback cache, output planes, masks, and invalidation protocol are not used
by renderer v2.

The coarse canvas remains one coarse Liquid `Html` capture and uses Liquid DOM's normal full-capture
behavior for DOM changes. Partial coarse capture was investigated and intentionally abandoned.
WebView2 did not expose useful `changedElements` metadata, and the complexity of dirty rectangles,
planner bridges, partial GPU copies, fallbacks, and diagnostics was not justified by the measured
benefit.

Continuous autonomous animation does not run inside the coarse canvas DOM because any repaint can
require recapturing the coarse `Html` surface. Static SVGs/icons, discrete state changes, and
user-driven dragging, resizing, and panning are supported. Perpetual CSS spinners, pulses, and
morphing gradients are not used inside Canvas Elements. GIFs render a static poster/frame on the
canvas; animated GIF and video playback occurs in a separate preview or UI surface. Running-command
controls use discrete states such as `Run` -> `Running...` -> `Done`.

Mantine is the standard React UI component library for controls, menus, dialogs, inputs, and related
interaction primitives. Mantine owns component behavior and accessibility; Liquid DOM owns the
glass/material layer. App-specific components may compose and theme Mantine but should not recreate
equivalent primitives without a documented need.

The Privacy extension retains ordinary CSS `backdrop-filter` blur for its cheap content-obscuring
effect. This is an explicit exception and must remain semantically and structurally separate from
application glass.

Neither Mantine nor Liquid DOM is installed as part of this documentation decision. Dependency
installation and compatibility proof belong to the renderer-v2 implementation roadmap.

## Consequences

- Near-complete feature parity remains a user-visible acceptance requirement; old frontend
  implementation structure does not.
- UI chrome can sample the actual DOM canvas instead of a reconstructed presentation scene.
- Canvas elements remain normal DOM; continuously animated media plays outside the coarse canvas.
- The material boundary has only two optical roles and cannot become a layout system.
- Mantine becomes the default control vocabulary, reducing bespoke control ownership while leaving
  TaskMap domain and feature behavior outside the library.
- Renderer-v2 performance acceptance must cover both the interaction hot path and Liquid DOM over
  live text, image, and static GIF-poster content in packaged Windows builds.
- ADR 003 remains historical documentation of architecture-v1. Its implementation-specific
  requirements are not renderer-v2 requirements.

## Alternatives considered

- Incrementally refactor the legacy or architecture-v1 frontend. Rejected because presentation
  coupling would constrain the new renderer and prolong parallel UI architectures.
- Continue the custom cached Canvas2D compositor. Rejected because it duplicates the scene and does
  not naturally refract the real DOM, particularly detailed media.
- Add partial dirty-region capture for the coarse Liquid `Html`. Rejected because WebView2 did not
  provide useful changed-element metadata and the integration complexity outweighed measured gains.
- Put Liquid DOM materials on canvas elements. Rejected because element count and high-frequency
  transforms would make glass part of the canvas hot path.
- Use Liquid DOM as the control library. Rejected because its responsibility is material rendering;
  Mantine supplies the standard React control and accessibility layer.
- Use ordinary CSS backdrop blur for all glass. Rejected as the application material strategy;
  ordinary CSS blur remains only for Privacy's deliberately cheap obscuring effect.
