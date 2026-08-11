# ADR 003: Adaptive Cached Canvas2D Acrylic Compositor

- Status: Superseded by ADR 004 for renderer v2; retained as architecture-v1 history
- Date: 2026-08-08

## Context

TaskMap's legacy frosted surfaces combine direct CSS `backdrop-filter`, Tailwind backdrop-blur
utilities, shared `.frosted-glass` classes, and a lightly adopted `FrostedSurface` component. Nested
and independently composed backdrop filters make the browser/WebView compositor responsible for
many large blur layers while the canvas moves. That architecture does not provide a bounded cost or
a single extensible material boundary for the Phase 5 UI and element migration.

An approved adaptive-acrylic reference proves a different split: build one blurred representation
of a culled visual scene, cache it, and cheaply reproject that cache beneath registered UI surfaces.
The redesign also establishes the application-chrome theme specified in `docs/VISUAL-SYSTEM.md`.

## Decision

`MaterialSurface` and the static material registry are the only feature-facing material boundary.
Direct and nested `backdrop-filter` implementations are superseded and will be removed after the
production migration. Large and Small acrylic use one shared expensive cache with 45 px blur, 1.0
saturation, and 1.0 brightness. Their tint, highlight, gradient border, shadow, and radius remain
separate cheap overlay definitions.

The expensive cached path is:

```text
culled generic BackdropScene
  -> scene rasterization
  -> one blur/saturation operation
  -> transferable ImageBitmap cache
```

Pan and zoom ordinarily reproject the accepted bitmap and compose registered surface masks and
static overlays. Cache coverage, not pointer-up, controls whether a long gesture needs a coalesced
background rebuild. Scene collection and blur never run once per pointer sample, and pointer frames
never enter persistence, history, serialization, encryption, or database work.

The cache and compositor resolutions are adaptive to pixel work. The initial budgets, scale bounds,
margin formula, coverage thresholds, invalidation categories, and exact material values are
normative in `docs/VISUAL-SYSTEM.md`; later tuning requires measured evidence and an explicit
documented decision.

A real TypeScript/Vite worker module using `OffscreenCanvas` is preferred. Production acceptance
must verify worker, Canvas2D filter, transferable `ImageBitmap`, disposal, and CSP behavior in stable
and development Tauri/WebView2 builds. The controlled fallback remains cache-based: deferred
main-thread rebuilding with one build active and one newest request queued. If full acrylic cannot
run safely, TaskMap retains the cheap tint, highlight, gradient border, shadow, and radius rather
than falling back to per-surface CSS blur.

The compositor consumes a generic, cullable `BackdropScene` presentation contract. It does not
import element modules, legacy `TaskCanvas` types, domain or persistence code, and it contains no
element-type switches. Phase 4.5A does not add a permanent contribution API to `ElementDefinition`;
the normalized Phase 5 assembly contract will be finalized after Phase 4.5B proves the scene
boundary. Transitional legacy translation stays outside the compositor. If media fidelity beneath
acrylic requires raster input, it must use a generic raster/thumbnail primitive rather than
Image/GIF-specific compositor branches.

There are two compositor planes, `base` and `modal`. Surface geometry, overlay, viewport transform,
backdrop scene, and shared-blur invalidations remain distinct. Asynchronous output is accepted only
when its lifecycle/build identity and coverage are still relevant; stale and replaced bitmaps are
closed, and disposal terminates the worker and releases owned resources.

## Alternatives considered

- Keep direct or nested CSS backdrop filters. Rejected because cost and compositor behavior are not
  bounded across many surfaces and features can accidentally create additional blur layers.
- Give Large and Small separate cached blurs. Rejected because the second expensive raster provides
  insufficient value; the approved distinction comes from cheap overlays.
- Rebuild the scene and blur on every camera frame. Rejected because it violates TaskMap's 60 FPS
  interaction and high-frequency state contracts.
- Couple the compositor to element definitions or scan the whole DOM. Rejected because it would
  bind presentation infrastructure to feature types and cause layout measurement during rebuilds.
- Use WebGL. Rejected for this phase because Canvas2D satisfies the reference design with a smaller
  implementation and compatibility surface.

## Consequences

The compositor adds cache scheduling, worker/fallback capability checks, culling integration,
surface registration, explicit invalidation, and stale-result lifecycle work. During drag/resize,
acrylic may briefly show last-settled scene geometry until a coalesced or settled rebuild completes.
Media beneath acrylic requires explicit visual acceptance and may require a generic raster
primitive. Development diagnostics are necessary but must remain outside persistent Redux state.

The benefit is one enforceable, extensible presentation boundary with bounded expensive work and a
cheap pan/zoom path. Future panels select a material definition instead of owning blur, border,
shadow, or compositor code.

Phase 4.5D release acceptance must measure rendered 60 FPS pan, zoom, drag, and resize on the normal
fixture against the final compositor in a release-mode Windows build. Deterministic CI gates prevent
hot-path regressions but do not claim wall-clock or FPS acceptance.
