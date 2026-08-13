# Renderer V2 Prototype

The `renderer-v2` branch is a UI, design, and interaction prototype. It has one canonical Renderer
V2 UI under `src/ui/renderer-v2-prototype/`; do not create separate benchmark and production
implementations.

Performance metrics, capture instrumentation, and other renderer diagnostics belong inside this
prototype. Synthetic canvases, canvas elements, selection, camera state, and controls remain the
prototype's state model; do not connect them to persistence yet.

After the UI is finalized, it will be ported into architecture-v1. Until then, `main` remains the
behavioral and performance reference for the old TaskMap application.
