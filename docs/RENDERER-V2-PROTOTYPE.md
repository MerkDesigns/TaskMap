# Renderer V2 Prototype

The `renderer-v2` branch is a UI, design, and interaction prototype. It has one canonical Renderer
V2 UI under `src/ui/renderer-v2-prototype/`; do not create separate benchmark and production
implementations.

The normal prototype canvas has one presentation path: one coarse Liquid `Html` layer containing
the ordinary React/DOM canvas. Render On Demand is the default Canvas Browser diagnostic scheduler.

Development-only controls, tuning UI, diagnostics, metrics, and capture instrumentation live under
`src/ui/renderer-v2-prototype/dev/`. That directory is benchmark scaffolding and must not be ported
into the final application. Reusable renderer runtime, materials, panel geometry, Canvas Browser
behavior, and modular Canvas Elements remain outside that boundary.

Synthetic canvases, canvas elements, selection, camera state, and controls remain the prototype's
state model; do not connect them to persistence yet.

After the UI is finalized, it will be ported into architecture-v1. Until then, `main` remains the
behavioral and performance reference for the old TaskMap application.
