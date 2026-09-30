# TaskMap Refactor State

> Current snapshot only. History belongs in `WORK-LOG.md`.

## Branch and phase

- Branch: `architecture-v1`; HEAD: `5fc2be2` (`Fix stale main-app glass and add isolated renderer diagnostics`).
- Subsequent chrome/Settings fixes, Lab occlusion work, shared Major default and Minor masking trial
  are local/uncommitted. Do not discard this work or assume HEAD includes it.
- Phase 4.5C/D is active. Shared workspace Major glass is accepted; full Minor/depth migration and
  the final rendering gate remain open. No general Phase 5 renderer migration is claimed.
- Last verified GitHub CI remains run `35936566796` for `1cd89a4`; local validation is newer.

## Active ownership and accepted behavior

- DatabaseApplication and the normalized workspace/commands/history/persistence system own product
  data. Rust owns database/session security. Retained App.tsx is presentation only.
- MaterialSurface and the materials subsystem own glass; features must not own private filters.
- Shared workspace Major glass is now the default in normal and Dev builds. User accepted the real
  App held-drag test on 2026-09-29: no frozen edge, distant brightening or broken corners noticed.
- Dev retains `Shared workspace Major glass` for comparison. Window controls now join the plane via
  `WorkspaceMajorGlassBridge` (local on entry/unlock screens); measured zero contamination from an
  adjacent foreground (local path: 3.54/255). Settings islands now share one Minor batch (`SettingsIslandList`); knobs on islands render as
  shells (new `shell` source, automatic Minor-on-Minor policy); the tab indicator keeps its blur.
  User accepted the look on 2026-09-29.
  General overlapping App panels are not yet accepted.
- Toolbar hitboxes are clear of the window drag strip. Settings uses the shared hidden scrollbar.
- Dedicated performance benchmarks are deferred at the user's request; this is subjective acceptance,
  not measured parity. Keep hot-path constraints; revisit if slowdown or significant new work arises.
- Darker candidate Minor glass is allowed for evaluation. No final Minor appearance choice exists.

## Current local slice: output-masked Minor (default)

- Default ON since 2026-09-29 (user accepted). Dev checkbox `Output-masked Minor glass` switches
  back to the legacy root-clip path for comparison only.
- SharedSmallGlassPlane retains existing settled/drag batch owners and recipes. The trial replaces
  the batch-root clip with masks on the two filter outputs. Existing card geometry and rectangular
  viewport intersections remain; this does not implement rounded scroll-edge shrinking.
- `sharedSmallOutputMask.ts` caches shapes and uses the existing geometry scheduler for bounds.
  Shape/scroll updates use cached dimensions; hidden zero-size batches do not reschedule endlessly.
- Masks are layered: one cached rounded-rectangle image per shape size, positioned/sized per layer,
  plus one intersecting viewport layer when every clip is shape ∩ one shared rectangle. Moving shapes
  only change mask position/size values. Other shape sets fall back to the single-SVG encoder.
- Legacy (trial OFF) held-card glass is structurally transparent: any `clip-path` on the batch root
  makes it a WebView2 backdrop root, so its filters cannot sample the cards beneath. Not fixable
  within the root-clip design; the trial's output masks are the correct direction.
- NativeGlassPlane's mask encoder now supports per-shape viewport clips and an overscan origin.
- Toggling back restores the latest legacy clip geometry without replacing the filter nodes.
- This is NOT the final Lab Minor topology or a complete promotion/occlusion migration.

## Verified status

- Full `npm run check` passed on 2026-09-29 after the layered-mask change: 254 files / 1,727 tests,
  typecheck, lint, formatting, architecture (595 files), production build and
  production-exclusion/security-boundary checks. CODEMAP regenerated.
- Mask tests cover overscan-aligned layer positions, viewport intersection, image reuse while
  shapes move, exact fallback for non-shared clips, no geometry reads on shape updates,
  hidden-batch scheduling and toggle restoration with stable filter identity.
- Earlier shared Major native verification passed: three registered workspace shapes, no local
  workspace Major filters, isolated toolbar foreground probe, live backdrop response, aligned
  close motion, real toolbar hits and clean console. Evidence is in `docs/evidence/glass-proof/`.
- Minor trial passed native acceptance on 2026-09-29: computed masks, clip removal, identical look,
  scroll, toggle restoration with stable filter nodes, clean console; user drag looked good. User
  accepted it as the default on 2026-09-29.
- Held-card drag with the trial ON, synthetic harness, 360 Hz display: ~80 fps before (per-frame
  SVG mask re-encoding on both planes) → ~355 fps after layered masks (p99 5.5 ms, normal and fast
  sweeps; one 188 fps warm-up outlier). Held card still blurs the cards beneath; scroll-edge clip,
  toggle restore and console verified live. User confirmed real-mouse dragging feels good.
- Fixed 2026-09-29: resize no longer blurs the whole canvas (Major mask reset by React re-render +
  WebView2 ignoring empty SVG masks) and side panels fit their content instead of keeping resize/
  overscan-inflated height. Verified live across window sizes, trial ON and OFF.
- Rust unchanged. No commit/push performed for this slice.

- Settled scroll-edge morph (4.5E) implemented for Canvas Browser on 2026-09-29: visible-slice shell,
  rim, shadow, rounded content mask and cap-built glass; held cards stay full. Scroll A/B showed no
  regression. Extensions panel and Quick Extensions morph too (native-scroll slice insets);
  Settings intentionally excluded until its redesign. User accepted the list morph look; Quick
  Extensions got a reusable `ScrollIndicator`, a 4-card scroll cap and a fading hover highlight.
- Held-item exemption (§13) verified. Liquid pickup/drop (§14) implemented for Canvas Browser:
  edge cards expand from their settled slice over 150 ms and drops morph toward the destination
  slice during the snap; pickup now positions by the logical card (fixed a content jump equal to
  the clip offset). Awaiting user feel check.

## Immediate next task / handoff

1. Composable presence motion (4.5E): `src/ui/motion/presenceMotion.ts` owns independent channels
   (content Fade, Material Fade, Slide X/Y, Lift, Scale) with separate enter/exit timing; the shared
   Major plane projects translate X/Y + scale + opacity. UI Lab uses it via an adapter. Quick
   Extensions migrated: user picked "Material fade + Scale", 264 ms emphasized enter / 192 ms
   standard exit (original timing, 20% slower). Glass-list layout now measures in local
   coordinates during ancestor scale (fixed misplaced card glass). DEV "Quick Extensions motion"
   still previews presets. Side panel migrated: default material fade + off-screen slide +
   scale 0.94, 300 ms ease-in-out; Quick Extensions: fade + slide up with side-panel shadow; shared Major plane now uses layered cached masks (open/close p50 2.8 ms). Quick Extensions owns
   its outside-click close so the exit animation runs. Minimap migrated (2026-09-30): material fade, 250 ms enter / 500 ms exit smoothstep, no
   ancestor opacity. Dialogs migrated (2026-09-30): `ModalPresence` runs on `createPresenceMotion`
   (preset "Material fade + Settle", 180 ms ease-out / 120 ms smoothstep); the group only moves,
   glass fades through the presence variable, glass-free content through
   `markMaterialPresenceContent`, nested dialogs compose root x nested in `ModalLayer.css`. DEV
   selectors: Minimap motion, Dialog motion. Blur timing (4.5E): the native glass recipe's blur presence
   is `pow(clamp((p - delay) / (1 - delay)), curve)` with defaults delay 0.3 / curve 1; DEV "Blur
   delay" / "Blur curve" sliders tune it live. Shared-plane Majors fade output as a unit (one filter
   per plane), so the delay applies to recipe-rendered glass. Awaiting user tuning values (defaults kept).
   4.5F dialog shell (2026-09-30): `ModalDialogHeader` / `ModalDialogBody` / `ModalDialogActions`
   in `ui/patterns/overlays/ModalDialog.tsx`; Update, Clear Canvas, Password and the new Create
   Canvas dialog use them. Create Canvas is now a root Major Glass modal (`CanvasCreateDialog`)
   sharing `CanvasDraftFields` with the inline editor; the frosted popup is gone.
   `useDialogFocus` gives initial focus to the first non-header control and owns the whole Tab
   order (primitives default to tabIndex -1). Canvas Browser active preview follows pan/zoom
   live again (camera subscription, no rerender). JSON editor is a non-modal Major Glass window
   (2026-09-30). Settings header now uses `ModalDialogHeader`
   ("Close settings" via `closeLabel`); the dialog-shell item is done. Scrollbar policy standardized (hidden for
   glass panels, thin translucent elsewhere). Button audit and hit targets done. Next 4.5F:
   local visual forks (legacy context menus/filter menu/colour picker onto primitives).
2. Keep the legacy root-clip Minor path only as a Dev comparison; remove it in 4.5H cleanup.
   Preserve the accepted Major and output-masked Minor defaults and the user's uncommitted work.

## Remaining gates

- final glass rendering/architecture acceptance and general overlap;
- Minor batching/promotion migration and scroll/presence/motion;
- UI primitive/dialog/scrollbar cleanup and final visual acceptance;
- packaged stable/Dev coexistence;
- Phase 4.5 cleanup.

Current authority: `UI-SYSTEM-CONTRACT.md`, `GLASS-SYSTEM-CONTRACT.md`,
`UI-QUALITY-GUARDRAILS.md`, and validation gates in `TESTING.md`.
