# Stable-depth glass candidate — bounded proof

## Current status — shared workspace Majors accepted as default

On 2026-09-29, after confirming the App trial had no visible drag artifacts, the user requested the
shared Major glass as the main material. `WorkspaceMajorGlass` now mounts by default in
`WorkspaceChromeLayer`, including normal builds. `NativeGlassPlane` is the shared production/Lab
filter implementation; the experimental Lab shell stays separate. The Dev checkbox is now
`Shared workspace Major glass`, enabled by default, and allows local-backend comparison.
Translation and opacity projection now run in normal builds as required by the shared renderer.
Window controls joined the plane on 2026-09-29 (see WORK-LOG); Minor cards and unrelated overlays
are not migrated by this change. General
overlap/Minor migration remains open. Earlier trial-only/default-off notes below are historical.

## 2026-09-28 follow-up

## 2026-09-29 — Optional main-App Major trial

DEV now exposes `Trial shared workspace Major glass` (off by default). `WorkspaceChromeLayer`
installs the optional owner; `MaterialSurface` registers base Major shells and omits their local
filters. The renderer reuses `StableGlassPlane` and its output mask, with one cached shape per shell.
Existing motion writers supply translation/opacity without layout reads; this bookkeeping is DEV-only.
Minimap can register when mounted. Minor rendering and window-control portals stay on the old path.
The workbench's trial owner and renderer remain excluded from stable bundles.

After a clean Dev start, the toolbar contributes two shapes and opening Canvas Browser adds the
third. A temporary200x30 red foreground patch at16/71 in Canvas Browser produces zero channel
change in toolbar patch20-209/20-51. Earlier local-backend measurement was8.13/255.
[Clean crop](evidence/glass-proof/workspace-trial-isolation-clean.png),
[foreground probe](evidence/glass-proof/workspace-trial-isolation-red.png).
Closing-panel sampling (83 callbacks) found maximum shell/mask x difference0.000016px and returns
to two registered shapes. This is geometry correctness evidence, not a performance benchmark.
The live backdrop positive control visibly colors toolbar/panel glass when the temporary red patch
is placed behind them, rather than inside their foreground:
[backdrop response](evidence/glass-proof/workspace-trial-live-backdrop.png).
All eight toolbar top hit probes pass. Toggling the trial off removes the shared plane and restores
local filters; toggling on restores three shapes without replacing the Canvas Browser shell.
All temporary probes were removed. Full validation passes (253 files/1,718 tests), including stable
bundle exclusion. The trial is enabled in the current Dev session for the user's held-drag check;
its default on a fresh workbench is still off. No fresh-session console errors/warnings were found.
The user subsequently repeated the held-drag trigger in the App and reported "No artifacts noticed"
for frozen edge color, distant brightening and broken corners. This accepts that bounded trigger,
not all remaining overlapping-panel/Minor behavior.

The trial does not yet apply multi-sibling foreground clipping to main-App shells: their retained
Minor filters cannot safely sit beneath such ancestor clips. Non-overlapping toolbar/side-panel
isolation is the bounded result; arbitrary overlap requires the subsequent Minor/depth migration.
No release acceptance or held-drag freshness claim follows from these checks.
Hot module replacement interrupted the retained canvas during edits; verify renderer/context changes
from a clean start rather than treating a stale HMR instance as evidence.

### Ambient edge check and first real-App trial

With the candidate reset (A/B visible, no ink/promotion/overlay), moving red from x950 to x740
places it50px beyond B's right edge and120px beyond A's. At viewport1278x946/DPR1, scene50/337,
mean absolute channel changes are3.45/255 at B's right edge (720-734/445-504),0.63 at A's right
edge (650-664/550-629), and0 at A's opposite edge (145-159/550-629). Ambient response is retained
outside the silhouettes. Returning red to950 restores all467,500 scene pixels exactly.
Screenshots inspected: [far](evidence/glass-proof/ambient-far.png),
[near](evidence/glass-proof/ambient-near.png). This discrete WebView capture check does not replace
displayed-window held-drag acceptance in the real App.

The first integration should be a development-only, reversible trial of workspace Major surfaces
together, starting with toolbar groups and the Canvas/Extensions side panel (and accounting for
Minimap when visible). Production remains on the existing backend until the real-App checks pass.

- `WorkspaceChromeLayer` is the existing common owner above `WorkspaceBackdropLayer`; mount the
  shared Major filter plane before chrome foreground within this owner, not inside each panel.
- `MaterialSurface` remains the public renderer boundary. Register explicit surfaces with that
  owner; do not scan the DOM every frame or import experimental internals into feature components.
  Preserve existing refs, content DOM, radii, elevations and hit behavior.
- `ToolbarGroup`, `WorkspaceSidePanel` and `MinimapSurface` already compose `MaterialSurface`.
  Their current motion/geometry owners must supply the same geometry to shell and filter mask.
  In particular, `useWorkspaceSidePanelMotion.writePanel` knows the translation every frame:
  project cached bounds with it, rather than polling `getBoundingClientRect` during motion.
- Reuse existing geometry invalidation/supplied-size boundaries for actual layout changes. One
  registration lifetime removes shapes when surfaces unmount or the workbench/session is disposed.
- Keep local Minor rendering initially; migrating its batching and promotion is a separate slice.
  Do not claim the Lab's darker Minor appearance is integrated by changing only Major filtering.
- Window-control portals and higher overlays require explicit layer ownership; do not silently
  include them in the workspace's base plane. Preserve their close, focus and drag-strip behavior.
- Trial acceptance: open/close/resize the side panel, toggle Canvas/Extensions, test toolbar hit
  targets, repeat the Canvas foreground-to-toolbar contamination probe, then repeat the user's
  held-image exit/return trigger using displayed-window capture. No performance benchmark required.

This is an implementation boundary/sequence, not a claim that production wiring exists. It avoids
a broad `App.tsx` rewrite and preserves the accepted main-App clipping fix during comparison.

### Multiple overlapping siblings

Foreground clips now accept multiple occluders. Each SVG clip contains one inverse rounded
silhouette and intersects the previous clip, so intersections cannot re-expose lower content as
multiple even-odd holes in one path would. Filter nodes remain outside all foreground clips.
Minor filter-output masks already subtract the union of occluders. No new dependency or renderer
is introduced. The proof's `Third Major` toggle adds C at480/155,260x145 on both backends.

Native WebView2 viewport1278x946/DPR1, scene50/337: A ink on/off produces zero RGB-channel
change in B patch450-689/450-484, C patch550-729/565-614 and B/C overlap550-699/500-524.
[Ink on](evidence/glass-proof/three-majors-ink-on.png),
[ink off](evidence/glass-proof/three-majors-ink-off.png).
Scene-relative hit probes reach C at500/175 and500/240, B at450/190, and exposed Minor at400/240.
Expanding/separating B keeps C covering its overlap; removing C restores the Minor hit at500/240
and B at700/240. This extends the bounded proof; production ownership registration is still absent.

### Minor appearance and promotion

User direction: retain the darker candidate Minor appearance for evaluation; stronger contrast against
Majors may be desirable. Matching the old backend is not automatically the intended visual outcome.
Dedicated performance benchmarks are deferred per the roadmap.

`Promote in place` now keeps the upper Minor at the same coordinates on either backend while
`Promote Minor` changes its depth. Ordinary promotion still moves it over the lower card by default.
With separated Majors, static media and ink off, candidate settled/promoted screenshots at
viewport1278x946/DPR1 have identical pixels in interior patch x450-619/y565-589 (mean difference0).
The shell remains at x430/y494, 210x110. This is a bounded consistency check, not all-backdrop parity.
Evidence: [settled](evidence/glass-proof/minor-in-place-settled.png),
[promoted](evidence/glass-proof/minor-in-place-promoted.png).

Live computed styles confirm both backends and both candidate depths use preblur5, blur23.5,
saturation0.78, brightness0.9, contrast1, and transparent tint/tone. The candidate has no added opaque
Minor fill. The backends differ in sampling topology: the old shared Minor plane sits inside Major A
with a clip on the filter ancestor; the candidate samples completed lower layers from a sibling plane
and masks filter outputs. This points to compositing/sampling rather than a changed opacity recipe;
the exact contribution of each topology difference has not been isolated. Keep the candidate recipe
unchanged. General occlusion/ambient correctness remains the next structural gate.

The Lab candidate now subtracts upper sibling silhouettes from lower foreground/effect shells and
owned Minor filter outputs. The shared Major filter source remains unmasked by foreground ownership.
Only covered portions are occluded; exposed A content remains visible. Numeric shape updates retain
filter/content identity and do not redraw unchanged rims. This is not yet a general ownership registry.

At viewport 1278x946/DPR1 with the proof scene at x50/y309, changing only Major A ink produced zero
RGB-channel change in overlapping B (x440-729/y394-493). Exposed A ink changed by mean 136.40/255,
and the higher overlay patch changed by 22.35/255. Separately turning off lower-card ink changed the
promoted Minor patch by 37.30/255. Native screenshots:
[inks on](evidence/glass-proof/occlusion-inks-on.png),
[Major ink off](evidence/glass-proof/occlusion-major-ink-off.png),
[both inks off](evidence/glass-proof/occlusion-both-inks-off.png).

Normal main-App layout independently fails isolation: a temporary 200x30 red foreground patch at
x16/y71 inside Canvas Browser changed toolbar pixels at x20-209/y20-51 by mean 8.13/255, without
visible panel overlap. Cropped evidence:
[baseline](evidence/glass-proof/main-app-isolation-before.png),
[foreground probe](evidence/glass-proof/main-app-isolation-red.png). The probe was removed.

The foreground alpha mask was subsequently replaced with a rounded clip path on the filter-free
shell. Native hit testing at (460,500) now reaches Major B instead of the visually covered Minor;
(460,519) still reaches the exposed Minor. This bounded proof supports one upper occluder per shell;
this initial limit is superseded by the intersected clips above. Minor filter-output
masks remain separate. [Updated native screenshot](evidence/glass-proof/hit-aware-occlusion.png).

The proof now exposes `Expand Major B` on both backends, using the same 390x240 target geometry.
Native discrete geometry checks at scene-relative (400,230) hit the exposed upper Minor initially,
Major B after expansion, and the Minor again after moving B to x660 with `Separate Majors`.
The moved B hit target at (680,230) followed its shell. Filter-plane and rim-canvas identities survived;
the rim canvas resized to width390. [Expanded scene](evidence/glass-proof/occlusion-expanded.png).
These checks do not establish continuous drag/resize performance or general occluder unions.

An isolated B comparison (A hidden, separated, normal size, animation off, red at x0) retains
the same visible bounds on both backends. At viewport1278x946/DPR1, interior patch
x730-999/y455-489 differs by mean absolute RGB-channel value 1.70/255, with maximum per-pixel
channel-sum difference15. Exact optical parity is not established; investigate this difference before
migration. Screenshots: [local](evidence/glass-proof/optics-isolated-local.png),
[candidate](evidence/glass-proof/optics-isolated-candidate.png). The local expanded filter bounds also
produce fixture viewport scrollbars absent with fixed candidate planes; this is a fixture/layout
difference, not proof of optical or performance superiority.

The candidate remains Lab-only. Optical/ambient parity, continuous geometry, rounded occlusion edges,
shadow behavior, general multi-sibling hit testing and release/GPU performance remain open.
No production renderer switch is justified yet. The report below records
the earlier 2026-09-27 checkpoint; its overlap failure is superseded by this bounded static result.

## 2026-09-27 checkpoint

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
