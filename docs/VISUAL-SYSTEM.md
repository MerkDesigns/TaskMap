# TaskMap Visual System

This document is the normative source for TaskMap application theme and material behavior. The
approved `phase4.5-acrylic-reference.html` is the visual and compositor provenance reference; it
remains a local review artifact rather than production code. If another document summarizes a value
differently, this document wins.

Phase 4.5A defines the contract, Phase 4.5B implements the compositor, and Phase 4.5C migrates the
production presentation in reviewed slices. C2A activates `.taskmap-target-theme` on the production
workspace root only; it is never placed on `documentElement` or `body`. Phase 4.5D removes the
legacy frosted implementation and performs acceptance.

## Target theme

The exact starting production values are:

```css
--void-bg: #0b0b0c;
--canvas-bg: #0f1011;
--canvas-dot-rgb: 70 79 96;
--canvas-border: rgb(255 255 255 / 0.15);
--container-bg: #1b1b1e;
--accent: #e36b55;
--text: rgb(255 255 255 / 0.88);
--muted: rgb(255 255 255 / 0.45);
font-family: "Segoe UI", Inter, system-ui, sans-serif;
```

The implementation names these with the `--taskmap-` prefix in `src/ui/theme/theme.css` to make
ownership explicit. `#e36b55` is the global application-chrome accent for focus, active states,
selection chrome, enabled switches, active tabs, sliders, and ordinary controls. Teal values left in
the prototype lab or legacy application are not normative application accents.

User-selected element colors and `ACCENT_PRESETS` are element content data, not theme tokens. They
must not be replaced with the application accent. Danger, warning, success, info, link, and spatial
minimap colors remain semantic tokens and must not be recolored merely to match chrome.

The target tokens are fixed CSS tokens for the current single theme, not Redux or document state.
Phase 4.5C owns their production activation and the audit-driven replacement of legacy hardcoded
chrome colors.

### Semantic geometry and typography ownership

Reusable spacing, control/row heights, radii, pill geometry, chrome inset/gap, shared panel width,
toolbar height, panel/modal padding, icon sizes, and text roles are scoped semantic tokens in
`src/ui/theme/theme.css`. Production toolbar, panels, and Settings will consume these shared owners
during their C2 slices rather than defining independent dimensions. C2A activates them on the
workspace root without migrating those consumers. The target type family is
`"Segoe UI", Inter, system-ui, sans-serif`; value/monospace roles use the scoped monospace token.

### Initial Phase 4.5C motion system

These are initial UI-motion values for C1 visual tuning. They are separate from the acrylic
compositor constants and may change only through Phase 4.5C visual acceptance.

| Semantic token                 |             Exact initial value |
| ------------------------------ | ------------------------------: |
| Instant                        |                            0 ms |
| Fast                           |                          120 ms |
| Context-menu exit              |                           90 ms |
| Normal                         |                          180 ms |
| Slow                           |                          280 ms |
| Standard easing                |    `cubic-bezier(0.2, 0, 0, 1)` |
| Emphasized easing              | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Maximum JavaScript frame delta |                           48 ms |
| Spring settle position epsilon |                            0.08 |
| Spring settle velocity epsilon |                            0.08 |

| Spring | Stiffness | Damping | Mass |
| ------ | --------: | ------: | ---: |
| Snappy |       560 |      38 |    1 |
| Soft   |       240 |      28 |    1 |
| Liquid |       300 |      28 |    1 |

All JavaScript UI motion shares one scheduler, distinct from the compositor scheduler. Scalar
springs use deterministic damped-oscillator integration and retain current position/velocity during
retargeting. `prefers-reduced-motion: reduce` removes travel and spring overshoot, settles indicators
immediately, and reduces CSS durations while preserving readable state changes.

### Liquid selection geometry

The reusable LiquidTabs selection surface is an Acrylic Small rounded rectangle, not a pill. Its
resting radius is `7px`; travel stretch may continuously increase the radius to at most `14px`, and
settlement returns it exactly to `7px`. The reusable `bright-selection` effect removes the generic
dark material tint for this surface and applies a cheap `7.5%` white wash while retaining the shared
Acrylic Small cache. The moving surface keeps the normal Acrylic Small gradient rim, so its bitmap
mask, wash, radius, and rim deform together. LiquidTabs labels remain at unit scale. Individual
options have no hover or pressed fill; the track retains one subtle outer border and keyboard focus
remains visibly indicated.

### C1 control and overlay states

Normal reusable input focus uses its existing `1px` border with `23%` white and no glow or accent
border. Invalid controls remain danger-colored. The acrylic toggle uses Acrylic Small at `8px`
radius; its on state adds a `27%` translucent accent wash and a low-opacity accent rim without
changing the material or cache. Acrylic toggle hover does not add a highlight or alter that resting
treatment. Pointer/keyboard press targets `0.965` scale and returns through the shared snappy spring;
reduced motion settles each state immediately.

The C1 context-menu foundation uses Opaque at `8px` radius. Entry is `120ms` from `0.96` scale,
zero opacity, and a `-3px` vertical offset; exit is `90ms` to `0.97` scale, zero opacity, and a `-2px`
offset. Its compact initial geometry is a `165px` shell with `29px` rows, `5px` horizontal shell
padding, `17px` row icons, `20px` layer icons, and an eight-column swatch grid. Opaque prevents
arbitrary underlying UI from visibly showing through and performs no compositor registration.
Reduced motion uses a near-immediate duration and no independently-owned animation frame.

The revised liquid toggle geometry is a `52px` by `30px` track with a vertically centered, settled
`22px` Acrylic Small knob. Velocity deformation may lengthen the knob to `30px` and thin it to
`18px`; bounded positional overshoot is at most `2px`. The off track is near-black and its knob gets
a `20%` white contrast wash. The on track uses the bright `#e36b55` accent with a restrained accent
glow, while the on knob uses a `42%` black tint over the real acrylic.
Settlement restores the exact circle. Confirm buttons share the `0.965` acrylic press scale. Normal
confirms use a `27%` accent wash and brighter accent rim without a hover highlight. Their disabled
state retains the earlier subdued `12%` wash. The glowing confirm uses an opaque accent wash, black
text, and a static restrained accent glow. Animated-checkbox stroke timing uses the central
fast/normal motion tokens.

## Material contract

Feature UI selects an internal material through `MaterialSurface`; it never chooses blur, cache,
worker, tint implementation, or Canvas2D behavior. The static registry currently contains:

- `acrylic-large`, strategy `cached-acrylic`
- `acrylic-small`, strategy `cached-acrylic`
- `opaque`, strategy `opaque`
- `cutout`, strategy `css`

Large and Small share one expensive cache profile. Their different tint, highlight, border, and
shadow definitions are cheap overlays. Opaque reuses Small's general glass treatment with no blur or
compositor registration. Cutout is a recessed CSS material. Materials are internal and statically
registered; this is not a runtime plugin API.

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
| Highlight opacity           | `0.028`                       |
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
| Highlight opacity           | `0.026`                       |
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

The `0.028` Large and `0.026` Small highlight opacities are the first Phase 4.5C visual-review
revision. Highlight geometry, stops, radius multipliers, tint, borders, shadows, and shared blur are
unchanged.

The toolbar group uses Acrylic Large at 12 px radius with explicit `elevation="none"`; this suppresses
only its external shadow. Other Large surfaces retain the material shadow.

Phase 4.5C2B mounts only the production `FloatingToolbar` in the C2A `WorkspaceChromeLayer` at
layer 41. Its two groups compose the `FloatingCanvasToolbar`/`ToolbarGroup` pattern with Acrylic
Large and shared `IconButton`/`ToggleButton` states. The expandable privacy/minimap region uses the
shared fast motion tokens; the material registry's shared ResizeObserver tracks intermediate width
changes and the public cheap geometry seam covers transition boundaries. No toolbar-local layer,
blur, cache, provider, or animation frame loop is permitted.

### Opaque

Opaque uses a slightly brighter `24 25 27` tint RGB with Acrylic Small's `0.026` radial-highlight
opacity and stops, `2.00` highlight radius multiplier, `1px` gradient rim with white `30 / 255` top
and `16 / 255` bottom, `0 5px 12px rgb(0 0 0 / .44)` shadow, and `12px` default radius. Its tint
opacity is `1.00`. It has no cache profile, compositor surface registration, or backdrop visibility.

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

`src/ui/theme/theme.css` is the normative owner for visible workspace theme values. The DOM-free
BackdropScene projector cannot read computed CSS, so `workspaceVisualValues.ts` contains its typed
mirror. Phase 4.5C2A parity tests lock the colors, grid geometry/formulas, and canvas radius across
the two representations.

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
- Maximum height: viewport height minus `80px` (`64px` top plus `16px` bottom inset)
- Padding: `12px`
- Radius: `12px`
- Material/elevation: Acrylic Large with its default elevation

Phase 4.5C2C mounts the non-embedded Canvas Manager and Extensions panel beside the toolbar in the
single layer-41 `WorkspaceChromeLayer`. `WorkspaceSidePanel` owns only this shared geometry and
material presentation. Embedded variants remain plain unregistered layout containers, and menus,
filter popovers, tooltips, creation UI, and drag previews retain their existing portals.

Panel entry runs for the shared normal `180ms` duration from `translate(-10px, 2px)` and zero
opacity; exit runs for the shared fast `120ms` duration toward `translate(-8px, 1px)` and zero
opacity. The shared UI frame scheduler drives both. Each active transform frame calls the cheap
surface-geometry invalidation seam, then stops invalidating after exact settlement. Reduced motion
settles immediately. App-owned closing flags and `120ms` unmount/switch timers remain authoritative.

### Canvas Browser

- Full card: `84px` minimum height and `12px` radius
- Minimal card: `40px` height and `8px` radius
- Canvas preview: `96px × 64px` with `6px` radius

Phase 4.5C2D maps non-embedded full, minimal, and inline-editor cards to Acrylic Small. Embedded
Canvas Manager cards use the non-registering Opaque strategy so embedded mode creates no cached-
acrylic surfaces. The preview shell uses Cutout; its miniature containers, text blocks, and images
remain cheap projected geometry and retain user-selected colors and the existing projection math.
Active/cycle application state uses the scoped target accent tokens.

Canvas Browser reorder FLIP transforms run on the shared UI scheduler. Active frames use only the
public cheap surface-geometry invalidation seam, settle exactly, and do no further geometry work;
reduced motion settles immediately. During pointer drag, the registered source card's compositor
mask opacity follows its hidden DOM state and is restored on completion/cancel. The body-owned drag
preview is an explicitly unregistered opaque representation derived from the card visual rather
than a canonical Opaque MaterialSurface. It carries the scoped target theme, removes cloned FLIP
presentation before fixed positioning, and does not claim a registered material ID. Neither path
requests a shared backdrop-cache rebuild.

### Extensions

- Extension card: `58px` minimum height and `8px` radius
- Extension icon box: `32px` square with `6px` radius
- Search/filter controls: `36px` height with `8px` radius

Phase 4.5C2E maps primary non-embedded Extensions Browser cards to Acrylic Small and embedded cards
to the non-registering Opaque strategy. Icon boxes use Cutout in both modes; text, icons, actions,
section headings, and empty presentation do not create additional material surfaces. Search uses
the C1 SearchField and the filter/favorite triggers use existing button primitives. Active filter
application state consumes the scoped target accent; the purpose-specific amber favorite state is
retained.

The shared info tooltip, coordinate-positioned filter portal shell, Quick Extensions menu, and
body-owned drag preview remain on their existing overlay/presentation paths. The filter portal gets
only a local target-theme scope for its token-based selected checks and is not migrated to
MaterialSurface. Extension drag does not add compositor mask updates or visual-motion scheduling.

### Minimap

- Position: `16px` from right and `16px` from bottom
- Shell: `192px` outer width, `8px` padding, `12px` radius
- Interior radius: `6px`

Phase 4.5C2F maps the floating shell to one base-plane Acrylic Large surface inside the existing
layer-41 `WorkspaceChromeLayer`; the projected-map interior is a non-registering Cutout surface.
The existing `176px` maximum projection size, aspect math, minimum projected pixels, element order,
content-owned accent colors, and reset-only interaction remain unchanged. The viewport indicator
uses `--taskmap-minimap-viewport` for its border and `--taskmap-minimap-element` for its wash.

The retained `500ms` visibility duration is driven by the shared UI scheduler. DOM opacity and the
registered surface's compositor mask opacity use the same normalized progress and settle exactly;
reduced motion settles immediately. Opacity-only updates revise the cheap base-plane mask output
without geometry invalidation or shared backdrop-cache rebuilds. App remains authoritative for the
matching mount/unmount timeout.

### Settings

- Reference maximum layout: `528px × 632px`
- Padding: `20px`
- Modal radius: `12px`
- Tabs: `36px` height with `8px` target radius
- Settings island radius: `8px`
- Scrim: `rgb(0 0 0 / 0.36)`

C3A maps the primary Settings shell to modal-plane Acrylic Large and meaningful Settings islands to
modal-plane Acrylic Small. Navigation composes the shared `LiquidTabs`; grid style, opacity,
booleans, data actions, close, and update-check controls compose existing C1 primitives. Text,
headings, shortcut keycaps, and internal rows remain normal DOM. The password dialog,
`UpdateAvailableModal`, and `ColorPickerMenu` shells retain their legacy presentation for later C3
slices.

## Material planes

There are exactly two semantic planes: `base` and `modal`. `MaterialSurface` inherits a plane from
`MaterialPlaneProvider` and defaults to `base`; an instance may override it. React context inheritance
continues through portals. The compositor owns the output canvases and stacking implementation, so
features must not hardcode compositor canvas z-index behavior. A third plane requires a new
architecture decision.

C3A gives production modal DOM the shared semantic layer order: scrim `9999`, the existing modal
compositor output `10000`, modal content `10001`, and body-owned modal overlay adapters `10002`.
The Settings scrim is plain DOM below the compositor; `MaterialPlaneProvider` makes its Acrylic
Large shell, Acrylic Small islands, liquid indicator, and liquid-toggle knobs register on the
existing modal plane. The layer contract changes no base-plane or workspace-chrome stacking.

For the production workspace, all canvas/backdrop DOM is contained by the intentional backdrop
layer at `0`, the base compositor output remains at layer `40`, and the shared
`--taskmap-layer-workspace-chrome: 41` contract is the only base-plane content layer above it. The
workspace root deliberately has no `z-index`, isolation, transform, filter, opacity, or containment
that would trap canvas or chrome. Later C2 workspace patterns consume the shared chrome layer rather
than declaring feature-specific compositor-relative values.

## Backdrop scene boundary

Phase 4.5B defines the proven runtime `BackdropScene` contract at the material compositor public
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
- `SURFACE_GEOMETRY_DIRTY`: cheap mask/overlay work for mount, unmount, resize, visibility, panel
  motion, or per-surface mask-opacity presentation; it does not dirty the scene cache.
- `MATERIAL_OVERLAY_DIRTY`: cheap tint, highlight, border, shadow, or radius presentation work.
- `SHARED_BLUR_PARAMETERS_DIRTY`: an expensive cache rebuild. These fixed parameters are not a
  feature-facing control.

The expensive path is scene rasterization, one shared blur/saturation operation, and ImageBitmap
creation. The interaction path reprojects the accepted cached bitmap and composes bounded surface
masks and static overlays. It must not dispatch persistent Redux commands, clone or serialize the
document, write history, call the database, or blur once per pointer sample. At most one compositor
animation frame and one expensive build may be active; queued work keeps only the newest relevant
request, and stale/replaced bitmaps are closed.

Each registered cached-acrylic surface carries a finite mask opacity clamped to `0..1`, defaulting
to `1`. The public material boundary may update that value imperatively for compositor-aware fades.
An opacity-only update advances only the affected plane's mask revision and schedules the existing
cheap compositor output frame; it never requests the shared backdrop cache. DOM opacity and mask
opacity must be driven from the same normalized motion state when an entire acrylic surface fades.
Opaque and Cutout surfaces do not register and therefore never enter this path.

Worker plus `OffscreenCanvas` is preferred, with a deferred cache-based main-thread fallback. If full
acrylic is unsafe, the controlled degradation is tint, highlight, gradient border, shadow, and
radius. Per-surface `backdrop-filter` is never a fallback.

## Adding a material

1. Decide whether the material is a `cached-acrylic` overlay using an approved shared profile, an
   `opaque` glass-treatment surface, or a `css` material.
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
