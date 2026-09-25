# Glass rendering proof observations

Non-normative evidence for Phase 4.5C. Requirements remain in `GLASS-SYSTEM-CONTRACT.md`.
The current backend **fails the gate**. These fixture observations do not accept production glass.

## Environment and reproduction

2026-09-24, Windows, TaskMap Dev with MCP, native WebView2; renderer reports Edge/Chromium 153,
1103 × 746 CSS pixels, DPR 1. Baseline HEAD `1cd89a4` plus the uncommitted documentation/workbench/proof
changes. Existing canonical optics: Major blur 60px, Minor blur 23.5px; workbench overrides reset.

Launch `npm run app:dev:mcp`, admit a development database, select **UI Lab → Rendering proof**.
Use **Reset proof** before comparisons. The synthetic scene does not edit the database or use user
media. Other Lab fixtures unmount while the proof is selected. The initial baseline used unchanged
native material code; the 2026-09-25 clipping follow-up below changes local filter-output masking.

The scene contains a grid, movable red rectangle, changing canvas media, two overlapping persistent
Majors, an optional higher overlay, two shared-batch Minors and one optional promoted local Minor.
Layer labels express intended sampling, not an implemented logical isolation mechanism.

## Results

| Core check                                     | Observation in this scene                                                                    | Status                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------ |
| Same-layer Major isolation                     | Toggling only A's colored foreground changes B's filtered body.                              | **Fail**                       |
| Higher overlay sampling                        | Mounted overlay responds to changes in completed lower UI.                                   | Observed pass                  |
| Promoted Minor ordering                        | Upper Minor blurs the colored stripes/content of the lower Minor.                            | Observed pass                  |
| Moving backdrop freshness                      | User dragged the real pointer handle and reported that blur follows while held.              | Manual pass, this fixture only |
| Animated backdrop freshness                    | Alternating cyan/yellow and magenta/blue canvas frames remain live through stationary glass. | Observed pass                  |
| Overscan / silhouette / cross-layer boundaries | Rounded clipping is fixed; same-layer contamination still violates sampling boundaries.      | **Fail**                       |

Four of six core checks have positive fixture evidence. Phase 4.5C remains open; no production
scroll/drag parity, promotion-pop acceptance or performance acceptance follows from these results.
The full App's previously reported stale-backdrop behavior still needs separate reproduction.

## Saved evidence

All PNGs are native Tauri screenshots, not DOM reconstructions.

- Major isolation: [ink off](evidence/glass-proof/major-ink-off.png) /
  [ink on](evidence/glass-proof/major-ink-on.png). Only A foreground changes. A region wholly inside
  B's lower-left body (x 430–559, y 425–449) changes by a mean absolute RGB-channel value of 63.24/255.
  This is a direct contamination measurement, not a blur-quality metric.
- Higher overlay: [ink off](evidence/glass-proof/overlay-ink-off.png) /
  [ink on](evidence/glass-proof/overlay-ink-on.png).
- Promoted Minor: [lower ink off](evidence/glass-proof/minor-ink-off.png) /
  [lower ink on](evidence/glass-proof/minor-ink-on.png). The same upper surface remains mounted;
  promotion removes its shape from the settled batch and uses its local production material.
- Changing media: [even frame](evidence/glass-proof/media-even.png) /
  [odd frame](evidence/glass-proof/media-odd.png). Samples followed canvas frame transitions 76/77;
  stationary Major and Minor bodies visibly change with the media.

The MCP swipe action did not move this pointer-driven handle; its output was not treated as drag
evidence. The user performed the real-pointer test and also identified the rounded-corner defect.

## Rounded clipping investigation

At baseline, Major A's material clip has `overflow: hidden`, `border-radius: 20px` and
`transform: translateZ(0)`. The visible blur extends into square corners outside the rounded rim;
see the top-left corner in the Major ink-off image. Minor clips similarly have their configured radius.

Two temporary, Major-A-only DOM experiments were reverted:

1. Removing the clip owner's transform did not resolve the corner mismatch.
2. Adding `clip-path: inset(0 round 20px)` to that clip removed the desired backdrop blur rather
   than preserving it with correct corners. [Failed clipping trial](evidence/glass-proof/corner-clip-path-trial.png).

No such style change was added to production or fixture CSS. The experiment demonstrates that a
straightforward extra clip is insufficient in this topology; it does not establish a complete browser
root-cause diagnosis.

### 2026-09-25: rounded output fix

The shared material backend now masks each local preblur/backdrop filter output with a rounded SVG.
Its mask uses the unexpanded surface size and existing overscan offsets. Expanded filter geometry and
optical values stay unchanged; content, rim, shadow and shared shape-union batches are not masked by
this rule. The SVG clamps both radius axes together for narrow surfaces, matching CSS border-radius.
No additional geometry observer, scheduler or pointer-frame work was introduced.

[Fixed rounded output](evidence/glass-proof/rounded-output-mask.png), same viewport/DPR as baseline.
Before/after native screenshot comparison: Major A interior (x150–369, y390–439) has zero RGB delta;
the formerly square corner (x115–121, y331–337) changes by mean 53.31/255, restoring visible red workspace
outside the curve. This proves the sampled interior stayed unchanged, not universal optical parity.

Inspected real Tauri App toolbar/window controls, opened Canvas Browser and Settings, and inspected
their rounded surfaces and small controls. In the proof, inspected promoted Minor and higher overlay
states with animated media. The user repeated the pointer drag after the fix and confirmed both
rounded clipping and live blur. Screenshots were inspected; console errors/warnings were empty.
Full `npm run check` passed: 251 files / 1,709 tests, architecture, build and production exclusions.
No full performance or production scrolling acceptance is claimed.

## Next bounded task

Revise the private backend candidate for explicit logical backdrop-source ownership, retaining the
fixed rounded output, canonical recipe and ambient sampling range. First rerun the
A/B isolation and corner comparisons, then the other four checks. Do not proceed to scroll morphing,
final presence or broad production migration while either blocker remains.

Keep the current failing scene as the comparison baseline. A renderer experiment must not hide these
failures by reducing blur/overscan, changing intrinsic optics or clipping away required lower content.
