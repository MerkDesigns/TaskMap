# TaskMap Visual System

This document is the normative source for TaskMap application theme and material behavior. The
approved `phase4.5-acrylic-reference.html` is the visual and compositor provenance reference; it
remains a local review artifact rather than production code. If another document summarizes a value
differently, this document wins.

Phase 4.5A defines the contract only. The target theme is intentionally scoped by
`.taskmap-target-theme` and is not applied to the production root. Phase 4.5B implements the
compositor, Phase 4.5C activates the theme and migrates surfaces, and Phase 4.5D removes the legacy
frosted implementation and performs acceptance.

## Target theme

The exact starting production values are:

```css
--void-bg: #0b0b0c;
--canvas-bg: #0f1011;
--canvas-dot-rgb: 70 79 96;
--canvas-border: rgb(255 255 255 / 0.15);
--container-bg: #1b1b1e;
--accent: #d87a2d;
--text: rgb(255 255 255 / 0.88);
--muted: rgb(255 255 255 / 0.45);
font-family: "Segoe UI", Inter, system-ui, sans-serif;
```

The implementation names these with the `--taskmap-` prefix in `src/ui/theme/theme.css` to make
ownership explicit. `#d87a2d` is the global application-chrome accent for focus, active states,
selection chrome, enabled switches, active tabs, sliders, and ordinary controls. Teal values left in
the prototype lab or legacy application are not normative application accents.

User-selected element colors and `ACCENT_PRESETS` are element content data, not theme tokens. They
must not be replaced with the application accent. Danger, warning, success, info, link, and spatial
minimap colors remain semantic tokens and must not be recolored merely to match chrome.

The target tokens are fixed CSS tokens for the current single theme, not Redux or document state.
Phase 4.5C owns their production activation and the audit-driven replacement of legacy hardcoded
chrome colors.

## Material contract

Feature UI selects an internal material through `MaterialSurface`; it never chooses blur, cache,
worker, tint implementation, or Canvas2D behavior. The static registry currently contains:

- `acrylic-large`, strategy `cached-acrylic`
- `acrylic-small`, strategy `cached-acrylic`
- `cutout`, strategy `css`

Large and Small share one expensive cache profile. Their different tint, highlight, border, and
shadow definitions are cheap overlays. Cutout is a recessed CSS material. Materials are internal
and statically registered; this is not a runtime plugin API.

### Shared acrylic cache profile

| Property    | Exact value |
| ----------- | ----------: |
| Blur radius |       45 px |
| Saturation  |         1.0 |
| Brightness  |         1.0 |

The reference Small CSS values of 32 px blur and 0.50 saturation record prototype provenance only.
Production must not create a second expensive Small cache. Both acrylic definitions identify the
same `shared-acrylic` cache profile.

### Acrylic Large

| Property                    | Exact value                   |
| --------------------------- | ----------------------------- |
| Tint RGB                    | `27 27 27`                    |
| Tint opacity                | `0.40`                        |
| Highlight opacity           | `0.040`                       |
| Highlight radius multiplier | `1.00`                        |
| Border width                | `1px`                         |
| Border top                  | white `32 / 255`              |
| Border bottom               | white `18 / 255`              |
| Shadow                      | `0 7px 20px rgb(0 0 0 / .55)` |
| Default radius              | `12px`                        |

### Acrylic Small

| Property                    | Exact value                   |
| --------------------------- | ----------------------------- |
| Tint RGB                    | `19 20 22`                    |
| Tint opacity                | `0.40`                        |
| Highlight opacity           | `0.038`                       |
| Highlight radius multiplier | `2.00`                        |
| Border width                | `1px`                         |
| Border top                  | white `30 / 255`              |
| Border bottom               | white `16 / 255`              |
| Shadow                      | `0 5px 12px rgb(0 0 0 / .44)` |
| Default radius              | `12px`                        |

For both acrylic overlays, the radial highlight begins at the surface's top-left. Its exact stops
are 0% at the material highlight opacity, 38% at `highlight * 0.40`, and 72% transparent. The border
is a top-to-bottom white gradient using the exact alpha values above and an inside mask. Border,
shadow, radius, tint, and highlight remain cheap DOM/CSS presentation around the compositor-provided
acrylic interior.

The toolbar group uses Acrylic Large at 12 px radius with explicit `elevation="none"`; this suppresses
only its external shadow. Other Large surfaces retain the material shadow.

### Cutout

| Property     | Exact value                                 |
| ------------ | ------------------------------------------- |
| Background   | `rgb(14 15 17)`                             |
| Border       | `1.5px solid rgb(255 255 255 / (17 / 255))` |
| Inner shadow | `inset 0 8px 30px rgb(0 0 0 / 0.10)`        |

Cutout has no universal default radius. A surface must provide its geometry-specific radius. The
reference geometry uses 6 px for canvas previews, minimap interiors, extension icon boxes, tiny icon
controls, and settings recessed fields; it uses 8 px for search shells and filter controls. Phase
4.5C must verify every production mapping rather than inventing a fallback radius.

Other approved reference radii are 12 px for toolbar groups, side panels, minimap shells, settings
modal, and full canvas cards; 8 px for minimal canvas cards, extension cards, and settings islands.
Element-specific canvas surfaces retain their own geometry and material unless explicitly migrated.

## Reference application geometry

These are the approved reference visual targets. They preserve the important exact starting
geometry after the local HTML reference is removed.

### Canvas

- Radius: `24px`
- Dot grid: `24px` spacing, `1.25px` dot radius, `0.50` dot opacity
- Line grid minor: `24px` spacing, `rgba(88,101,124,0.093)`
- Line grid major: `120px` spacing, `rgba(118,136,164,0.072)`
- Shadow: `0 22px 60px rgb(0 0 0 / 0.30)`

### Toolbar

- Position: `16px` from top and `16px` from left
- Group gap: `8px`
- Group: `40px` height, `6px` horizontal padding, `12px` radius
- Buttons: `28px` square with `6px` radius
- Toolbar material external shadow: suppressed

### Side panels

- Position: `16px` from left and `64px` from top
- Width: `290px`
- Padding: `12px`
- Radius: `12px`

### Canvas Browser

- Full card: `84px` minimum height and `12px` radius
- Minimal card: `40px` height and `8px` radius
- Canvas preview: `96px × 64px` with `6px` radius

### Extensions

- Extension card: `58px` minimum height and `8px` radius
- Extension icon box: `32px` square with `6px` radius
- Search/filter controls: `36px` height with `8px` radius

### Minimap

- Position: `16px` from right and `16px` from bottom
- Shell: `188px` width, `8px` padding, `12px` radius
- Interior radius: `6px`

### Settings

- Reference maximum layout: `528px × 632px`
- Padding: `20px`
- Modal radius: `12px`
- Tabs: `36px` height with `8px` top radius
- Settings island radius: `8px`
- Scrim: `rgb(0 0 0 / 0.36)`

Phase 4.5C must reconcile real component behavior with these targets. It must not transplant
prototype application logic or blindly replace functional/dynamic TaskMap geometry where retained
behavior requires dynamic sizing, aspect projection, viewport adaptation, or an equivalent runtime
calculation.

## Material planes

There are exactly two semantic planes: `base` and `modal`. `MaterialSurface` inherits a plane from
`MaterialPlaneProvider` and defaults to `base`; an instance may override it. React context inheritance
continues through portals. The future compositor owns the canvases and stacking implementation, so
features must not hardcode compositor canvas z-index behavior. A third plane requires a new
architecture decision.

## Backdrop scene boundary

Phase 4.5B will define the proven runtime `BackdropScene` contract at the material compositor public
boundary. It is presentation data made of generic, cullable visual primitives such as flat or
rounded filled/bordered geometry, grid state, world bounds, and viewport state. The compositor must
not import element modules, legacy `TaskCanvas` types, domain business logic, persistence, or Redux,
and it must never switch on element type.

Phase 4.5A deliberately does not add a final scene-contribution method to `ElementDefinition`. The
eventual dependency remains:

```text
element/canvas presentation assembly
  -> generic BackdropScene contract
  -> material compositor public boundary
```

The normalized Phase 5 contribution API will be finalized only after the Phase 4.5B contract is
proven. During the mixed legacy state, any element-aware translation stays in a transitional legacy
presentation adapter outside the compositor. Real images and GIFs beneath acrylic are an explicit
4.5B/4.5C acceptance concern. If fidelity requires media, use a generic raster/thumbnail primitive
or equivalent presentation contract—never image/GIF branches in the compositor.

## Adaptive quality contract for Phase 4.5B

The first production implementation must preserve these constants without silent tuning:

| Constant                | Exact value |
| ----------------------- | ----------: |
| Cache pixel budget      |   1,000,000 |
| Compositor pixel budget |     600,000 |
| Minimum cache scale     |        0.16 |
| Maximum cache scale     |        0.70 |
| Minimum composite scale |        0.20 |
| Maximum composite scale |        0.72 |
| Manual/reference scale  |        0.50 |
| Margin multiplier       |        1.00 |

For viewport width `w` and height `h`:

```text
baseMargin = clamp(min(w, h) * 0.35, 240, 900)
margin = baseMargin * marginMultiplier
cacheWidth = w + 2 * margin
cacheHeight = h + 2 * margin
cacheScale = clamp(sqrt(1_000_000 / (cacheWidth * cacheHeight)), 0.16, 0.70)
compositeScale = clamp(sqrt(600_000 / (w * h)), 0.20, 0.72)
```

The cached raster is rebuilt when the viewport size changes, the current/anchor zoom ratio falls
below `0.68` or rises above `1.47`, or transformed viewport coverage enters the 30% cache-margin
safety region. A long active pan or zoom may therefore coalesce and schedule a required rebuild
before pointer-up. "No rebuild per pointer frame" forbids scanning, scene construction, blur,
serialization, and persistence once per pointer sample; it does not permit empty cache coverage
until a gesture ends.

## Invalidation contract for Phase 4.5B

Invalidations are explicit and independently testable:

- `BACKDROP_SCENE_DIRTY`: an asynchronous expensive cache rebuild after a relevant settled scene
  mutation, create/delete, canvas switch, color change, or grid appearance change.
- `VIEWPORT_TRANSFORM_DIRTY`: cheap cached-bitmap reprojection; it may coalesce a coverage-required
  rebuild while interaction continues.
- `SURFACE_GEOMETRY_DIRTY`: cheap mask/overlay work for mount, unmount, resize, visibility, or panel
  motion; it does not dirty the scene cache.
- `MATERIAL_OVERLAY_DIRTY`: cheap tint, highlight, border, shadow, or radius presentation work.
- `SHARED_BLUR_PARAMETERS_DIRTY`: an expensive cache rebuild. These fixed parameters are not a
  feature-facing control.

The expensive path is scene rasterization, one shared blur/saturation operation, and ImageBitmap
creation. The interaction path reprojects the accepted cached bitmap and composes bounded surface
masks and static overlays. It must not dispatch persistent Redux commands, clone or serialize the
document, write history, call the database, or blur once per pointer sample. At most one compositor
animation frame and one expensive build may be active; queued work keeps only the newest relevant
request, and stale/replaced bitmaps are closed.

Worker plus `OffscreenCanvas` is preferred, with a deferred cache-based main-thread fallback. If full
acrylic is unsafe, the controlled degradation is tint, highlight, gradient border, shadow, and
radius. Per-surface `backdrop-filter` is never a fallback.

## Adding a material

1. Decide whether the material is a `cached-acrylic` overlay using an approved shared profile or a
   `css` material.
2. Add one typed definition to the static material definitions list and exact-value tests.
3. Add or reuse internal material rendering behavior only under `src/ui/materials/`; acrylic
   Canvas2D runtime belongs specifically under `src/ui/materials/compositor/`. Feature code
   continues to select an ID through `MaterialSurface`.
4. Update this normative document. Add an ADR when changing compositor strategy, planes, shared
   cache behavior, dependency direction, or performance invariants—not for a routine variant using
   an existing strategy.
5. Add visual, fallback, invalidation, and performance coverage appropriate to the strategy.

Do not add runtime material loading, feature-specific compositor branches, another blur cache, or
direct panel background/border/shadow implementations in a feature module.

## Phase 4.5D reference cleanup

Once the accepted visual/reference capture is permanent, remove the temporary
`phase4.5-acrylic-reference.html` entry from `config/prettierignore` if it is no longer needed. Remove
the local untracked reference artifact from the working tree when appropriate; do not commit it as a
substitute for the permanent acceptance evidence.
