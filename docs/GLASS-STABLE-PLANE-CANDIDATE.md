# Stable-depth glass candidate — bounded proof

2026-09-27, `architecture-v1`, baseline `abd4000` plus local changes. No production migration,
branch, commit or push. The original native backend remains the default in the proof and the App.

## Conclusion

**Partially confirmed topology hypothesis; damage-tracking root cause unconfirmed.** Code inspection
confirms local Major filters expand by up to (60 + 6) × 3 = 198px, output masks select their rounded
silhouettes, transform/backface hints are present, and WorkspaceSidePanel sets permanent
`will-change: backdrop-filter`. `refreshMaterialSurfaceBackdrop()` only requests geometry work.
None of this proves a Chromium damage-tracking defect. No compositor trace was collected.

The user reports that moving an object beyond overscan while holding it leaves frozen edge color,
cleared by returning or dropping, plus intermittent distant brightening affecting browser and toolbar.
They explicitly report the current proof does not reproduce these App failures. Consequently a clean
synthetic run cannot establish a freshness fix. The main App backend has not changed.

The [CSS Filter Effects draft](https://drafts.csswg.org/filter-effects-2/#BackdropRoot) describes
paint-order backdrop input and ancestor mask/filter/opacity boundaries. This supports separating
sampling from foreground, but is not evidence of this WebView2 build's invalidation behavior.

## Implemented architecture

Select **UI Lab → Rendering proof → Backend**:

- Current local native backend (preserved).
- Stable logical-depth plane candidate (experimental, excluded from stable bundles).

The candidate uses fixed 1100 × 425 scene-sized planes. One L1 Major plane reveals both Major
silhouettes; explicit settled-Minor, promoted-Minor and overlay-Major planes follow in paint order.
Each plane has the canonical preblur/main pair, with rounded SVG masks on filter outputs only.
No per-Major filter rectangles, transform nudges, permanent compositor hints, geometry observers or
per-backdrop-frame style changes are added. Shapes are numeric owner-supplied geometry. Shape changes
retain the plane/filter DOM; translation does not measure geometry or redraw the rim.

Foreground shells reuse canonical tint, shadow and rim implementation, outside the masked filter
outputs. Major 60/6px and Minor 23.5/5px values and saturation/brightness/contrast remain canonical.
Mask-union preblur composition and changed sampling bounds still require optical-parity acceptance;
sharing numeric recipes alone does not prove identical pixels. This fixed-DPR proof is not a general
window/DPR lifecycle implementation.

The scene now allows **Separate Majors** without hiding A's content and **Red far away** at x950.
Default overlap is preserved and exposes the unresolved foreground problem. Travel is 0–950 rather
than 0–740 on both backends, so the object can leave A's former expanded sampling region. Reset
restores overlap and scene state while retaining the selected backend.

## Acceptance evidence

Native screenshots were inspected at 1200 × 960 CSS pixels, DPR1:

- [Overlapping foreground failure](evidence/glass-proof/stable-plane-overlap.png).
- [Separated, lower inks on](evidence/glass-proof/stable-plane-depths-ink-on.png).
- [Separated, lower inks off](evidence/glass-proof/stable-plane-depths-ink-off.png).

The two ink screenshots toggle Major A and lower-card ink together. A patch of separated B has zero
RGB change; overlay and promoted-Minor patches change. This establishes response to lower content,
not attribution of every pixel to a particular lower object. No screenshot regression tests were added.

| Case                              | Current evidence / limit                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A — distant flicker               | Unresolved in App; synthetic proof is not the user's reproducer.                                                                  |
| B — freshness / held-pointer exit | Unresolved in App. Autoplay changes pixels without geometry work; this is not real-drag acceptance.                               |
| C — animated backdrop             | Cyan/yellow and magenta/blue phases visibly change candidate glass in native screenshots.                                         |
| D — same-layer isolation          | Separated B patch x710–979/y430–469 has zero RGB delta. **Overlapping result fails:** lower foreground remains visible through B. |
| E — overlay sampling              | Overlay patch x475–714/y625–659 changes by mean absolute RGB-channel delta 11.75/255.                                             |
| F — promoted Minor                | Promoted patch x260–429/y610–624 changes by 26.85/255; lower stripes are visibly blurred. Promotion optical parity remains open.  |
| G — rounded silhouette            | Rounded output observed on native Major/Minor screenshots; full geometry-range acceptance pending.                                |
| H — ambient edge sampling         | Red outside A's visible left edge contributes inside A. Optical parity across positions/scene edges is not established.           |
| I — performance                   | Short development diagnostic below; release/GPU acceptance remains open.                                                          |

The overlap failure is deliberately visible. No ancestor masking, content hiding or reduced blur was
used to manufacture an isolation pass. The shared sampling plane is useful as a candidate, not an
accepted replacement. Foreground/effect occlusion and nested sampling still need a coherent solution.

## Performance sample

Windows, Ryzen 7 7800X3D, RTX 5070 Ti, reported display 2560 × 1440 at 360Hz (a Parsec virtual display
adapter is also installed). WebView2 reports Edge/Chromium153. Dev/MCP build, viewport1200 × 960,
DPR1, in-memory synthetic scene; no user media. Two Majors, two settled Minors, overlay/promotion off,
red movement and animated checker on. Ten seconds per backend, after validation completed.

| Backend          | rAF intervals | Median / p95 / p99 ms | Active filter nodes | Shared planes | Filter nodes added/removed | Peak geometry refreshes/s |
| ---------------- | ------------- | --------------------- | ------------------- | ------------- | -------------------------- | ------------------------- |
| Local baseline   | 3566          | 2.80 / 2.90 / 2.90    | 6                   | 1             | 0                          | 0                         |
| Stable candidate | 3600          | 2.80 / 2.90 / 2.90    | 4                   | 2             | 0                          | 0                         |

`Measure 10 seconds` is opt-in, cancels on unmount, and reports scene-local DOM filter/plane counts.
The geometry counter is the existing global rolling counter. Keep geometry controls unchanged during
a sample. Measurements include diagnostic overhead and are rAF scheduling intervals, **not presented
FPS or GPU render time**. One short sample does not prove a performance win or non-regression.
Full-scene filtering can increase pixel bandwidth despite fewer filters. Release measurements,
repeated runs, resource stability and the real-App reproducer are required before migration.

## Validation and next gate

Full `npm run check`: 252 files / 1,714 tests passed; formatting, typecheck, lint, architecture, build
and production/capability exclusion passed. Final reset/Small-padding adjustments were followed by
the focused suite. No frontend console errors or warnings were observed in the final inspection.
Vite's existing bundle-size advisory remains. Rust is unchanged.

Automated tests establish shared plane ownership, filter identity through shape edits, no per-Major
filters, separate foreground/rim, unchanged Small recipe across depth promotion, no rim redraw on
translation and no geometry measurement/filter-mask changes from backdrop animation. They cannot
prove native pixels, brightness continuity, real pointer behavior or GPU performance.

Next: reproduce the actual App element-transform/camera path in a bounded development fixture before
claiming a freshness solution; the user will not repeat the non-reproducing synthetic drag test.
Resolve overlap/optical parity independently. Keep production unchanged until these blockers close.
The evidence does not establish that all native CSS approaches are unsuitable, and does not authorize
reactivating the parked compositor.

## Exact changed files

- `src/ui/materials/experimental/StableGlassPlane.tsx` — candidate planes and foreground shells.
- `src/ui/materials/experimental/stableGlassPlane.css` — fixed filter bounds/output masks.
- `src/ui/materials/experimental/StableGlassPlane.test.tsx` — ownership/geometry/recipe tests.
- `src/ui-lab/glass-proof/StableProofSurfaces.tsx` — explicit proof depths and shape layout.
- `src/ui-lab/glass-proof/ProofPerformance.tsx` — opt-in comparison diagnostics.
- `src/ui-lab/glass-proof/GlassRenderingProof.tsx` — selectable candidate and baseline controls.
- `src/ui-lab/glass-proof/GlassRenderingProof.test.tsx` — candidate selection/backdrop invariants.
- `src/ui-lab/glass-proof/glassRenderingProof.css` — selector/readout and extended scene.
- `src/ui-lab/glass-proof/useProofBackdrop.ts` — extended backdrop travel.
- `scripts/check-phase2-production-exclusion.mjs` — reject candidate CSS marker in stable bundle.
- `docs/CODEMAP.md` — regenerated ownership map.
- `docs/REFACTOR-STATE.md`, `docs/WORK-LOG.md`, `docs/GLASS-RENDERING-PROOF.md` — current status/history.
- `docs/GLASS-STABLE-PLANE-CANDIDATE.md` — this report.
- `docs/evidence/glass-proof/stable-plane-overlap.png`, `stable-plane-depths-ink-on.png`,
  `stable-plane-depths-ink-off.png` — native evidence listed above.
