# Glass acceptance part 1 — Performance

2026-09-06, `architecture-v1`, HEAD `21599ec92551ed4605dc8737353f1cd9dad3a839`
plus the uncommitted glass steps 1–4. This is a development diagnostic/readiness report,
**not release rendered-FPS acceptance**. Part 1 remains open; part 2 is separate.

## Environment and workload

- Windows 11 Enterprise 10.0.26200, build 26200.
- AMD Ryzen 7 7800X3D; CIM reports 8 cores / 8 logical processors; 33,997,570,048 bytes RAM.
- NVIDIA GeForce RTX 5070 Ti, driver 32.0.15.9649; reported display 2560 × 1440 at 360 Hz.
  A Parsec Virtual Display Adapter is also installed; the active presentation route was not traced.
- WebView UA reports Chrome/Edge 152.0.0.0; exact installed WebView2 patch is unverified.
- Viewport 1342 × 1093, devicePixelRatio 1. Visible document, `document.hasFocus() === false`.
  No alternate display scaling tested.
- Running MCP-enabled debug Tauri application with Vite development frontend. The separately
  successful optimized frontend build was **not** the application being profiled.
- Existing seven-canvas user document; names/content intentionally omitted. Not a deterministic
  benchmark fixture; element/media totals were not inventoried. No fixture loaded or document edited.
- Main Extensions panel closed. Compared side chrome closed, Canvas Browser open, and Canvas Browser
  plus Quick Extensions open. Camera and viewport unchanged between trials. Canvas Browser was open
  originally and restored afterward; Quick Extensions closed afterward.

## Method

`scripts/glass-pan-probe.mjs` is an explicitly invoked development-only diagnostic, not imported by
application code. Each trial uses 300 requestAnimationFrame samples, with 12 warm-up and 12 settlement
callbacks. A synthetic middle-pointer gesture sends a horizontal sinusoid of ±90px around x=900,
y=100, one sample per callback. The same spatial samples are used, but duration follows callback
pacing rather than a fixed wall-clock duration. Each gesture ends with `pointercancel`, never
`pointerup`; every recorded trial moved and restored the camera.

Synthetic events require a temporary, stage-scoped pointer-capture shim. The probe restores the
stage's original property descriptors and global measurement wrappers in `finally`. This does not
validate physical input capture. It counts rectangle reads only on `[data-material]` elements and
`clearRect` calls only on native rim canvases, after activation settles. Zero counts do not mean zero
browser layout, total geometry work, React renders, GPU work, or persistence operations.

One idle trial and three pan trials were recorded per state, sequentially in the order below.
No build, formatter, or test commands ran during these retained samples. Earlier exploratory samples
overlapping tooling were discarded; an extra closed-chrome warm-up pan was also not tabulated.
Other system load was not controlled, state order was not randomized, and samples are short.

Quick Extensions stayed open before/after idle and all middle-button pan trials. The outside-click
handler dismisses it for left-button input, not middle-button pan. No behavior override was needed.

## Observations

All times are milliseconds. Callback intervals are **not presented frame times or rendered FPS**.
Input dispatch measures only synchronous event dispatch, not subsequent controller-frame, React,
browser rendering, or GPU cost. Each pan row contains 300 samples.

| State / trial       | Callback mean | Callback p95 | Callback max | Intervals >16.67ms | Dispatch mean | Dispatch p95 | Dispatch max |
| ------------------- | ------------: | -----------: | -----------: | -----------------: | ------------: | -----------: | -----------: |
| Closed / 1          |         9.147 |         11.2 |         16.7 |                  1 |         0.051 |          0.1 |          0.5 |
| Closed / 2          |         8.787 |         11.2 |         16.7 |                  1 |         0.051 |          0.2 |          0.4 |
| Closed / 3          |         8.962 |         11.2 |         19.5 |                  5 |         0.051 |          0.1 |          0.3 |
| Canvas Browser / 1  |         9.694 |         13.9 |         27.9 |                  5 |         0.050 |          0.1 |          0.6 |
| Canvas Browser / 2  |         9.462 |         11.2 |         22.3 |                  2 |         0.046 |          0.1 |          0.4 |
| Canvas Browser / 3  |         9.342 |         11.2 |         25.0 |                  3 |         0.053 |          0.1 |          0.4 |
| Browser + Quick / 1 |        10.203 |         13.9 |         33.3 |                  7 |         0.049 |          0.1 |          0.2 |
| Browser + Quick / 2 |        10.287 |         14.0 |         36.1 |                  6 |         0.053 |          0.1 |          0.7 |
| Browser + Quick / 3 |         9.814 |         13.9 |         30.6 |                  7 |         0.048 |          0.1 |          0.7 |

Idle callback means were 2.778 / 2.777 / 2.778ms respectively, p95 2.9ms in each state,
maxima 2.9 / 3.0 / 2.9ms, with no interval exceeding 16.67ms. Idle dispatch timings were
effectively timer overhead (no pointer dispatch): means 0 / 0.001 / 0ms, maxima 0.1ms.

All 12 recorded trials had **zero steady material rectangle reads and zero native rim redraws**.
All pan dispatch maxima were below 1ms. Callback pacing was modestly slower with more glass open,
with occasional longer intervals, but this uncontrolled debug comparison cannot attribute that
difference to compositing or establish a regression. Do not reduce optical quality from these data.

## Verification and evidence

- Optimized frontend build/typecheck, production exclusion checks, lint, and architecture checks pass.
  Existing >500kB bundle warning remains.
- 33 focused tests across seven camera, material geometry/recipe, snapshot and scroll-geometry files
  pass. Seven new diagnostic tests verify sample bounds, idle, cancellation and restoration on failure.
- No production source or optical constants changed in this acceptance pass. The prior step-4 full
  matrix remains 783 passed / 15 known baseline frontend failures; Rust 67 passed / one ignored.
  This pass is not a rerun or closure of the full phase matrix.
- Actual Tauri UI inspected using the `tauri-ui-development` skill. Before, Browser + Quick after-pan,
  and restored Browser-only screenshots inspected. No console errors or warnings from the final checks.
  The bridge's version-report warning is tooling-only.
- Screenshots: `C:\Users\Merk\AppData\Local\Temp\TaskMap-glass-acceptance1-before.png`,
  `TaskMap-glass-acceptance1-after.png`, and `TaskMap-glass-acceptance1-restored.png` in the same folder.
  They contain the local user scene and are not committed. Still captures do not prove motion parity.

## Reproduce the development diagnostic

Connect to the existing MCP-enabled development application; leave saved document content untouched.
Wait for panels to settle, then execute this in its WebView (not the shell):

```js
void (async () => {
  const { profileGlassPan } = await import("/scripts/glass-pan-probe.mjs");
  window.__glassProbeResult = await profileGlassPan({ frames: 300, pan: true });
})();
```

Read `window.__glassProbeResult` afterward; do not start another probe until it resolves. Use
`pan: false` for idle. Record focus, viewport, document identity without content, and panel state;
repeat three times per state. Delete the result global and restore panels afterward. The bridge's
awaited-script timeout may expire while WebView work continues, so launch asynchronously and collect
later. Reloading/HMR loses temporary globals; do not edit imported files or run other tooling during
capture. Run `npm test -- scripts/glass-pan-probe.test.mjs` to verify diagnostic cleanup.

## Remaining release gate and next action

Files-only continuation on 2026-09-06: the offline document/media preparation in item 1 is now available
and verified; see `docs/GLASS-BENCHMARK-FILES.md`. The user chose not to load or launch a benchmark yet.
The full fixture has 25 canvases, 2,000 elements and 582,508,631 bytes of real WebP/GIF assets. These
are separate from the older baseline generator and are **not** a portable `.tmap` import. Isolated
loading and items 2–4 remain open; no new presented-frame or production visual evidence.

1. Load and validate the prepared fixture in an **isolated** environment: 25 canvases, 2,000 elements,
   500 MB mixed media and the required extensions. The current baseline generator only creates a
   single-canvas synthetic 2,000-element document with image placeholders, not that media corpus.
   Do not substitute it for the normative fixture or import over the user's current document.
2. Build/run the packaged release in that isolated environment and record exact runtime, scale,
   refresh, focus, fixture manifest and edition. No release executable was available in the checked
   default target path. `npm run build` is frontend optimization, not a packaged Rust release.
3. Capture **presented-frame** evidence for pan, zoom, drag and resize, plus controller/React/material/
   persistence attribution. No rendered-frame capture was performed here; PresentMon/WPA were not
   available on PATH. A suitable external capture workflow must be set up and verified first.
4. Preserve the deliberate `debug_assertions && mcp-development` bridge gate in Rust. Release builds
   must not gain the development bridge just to automate acceptance. Use manual input/external
   instrumentation for release. Reconcile results against `docs/TESTING.md` before closing part 1.

Part 2 (broader visual/behavior acceptance) has not started. Phase 4.5 and the release 60 FPS gate stay
open; no Phase 5 ownership work or additional rendering strategy is authorized by these findings.
