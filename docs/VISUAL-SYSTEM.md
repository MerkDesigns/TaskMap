# TaskMap Renderer v2 Visual System

This document is the normative source for renderer-v2 theme, UI-component, material, and visual
performance behavior. `docs/FEATURE-PARITY.md` remains the behavioral reference. Legacy captures and
the architecture-v1 acrylic reference remain useful visual evidence, but their frontend structure
and compositor implementation are not production requirements.

ADR 004 supersedes ADR 003 for renderer v2. The application-owned cached Canvas2D acrylic
compositor, projected `BackdropScene`, worker/cache runtime, output masks, material planes, and
compositor invalidation constants are historical and must not be rebuilt into the new frontend.

## Responsibilities

Renderer v2 separates three presentation concerns:

```text
ordinary React/DOM canvas content
  -> live backdrop seen by application chrome

Mantine components
  -> controls, menus, dialogs, inputs, focus, and accessibility behavior

shared material surface
  -> Large Panel or Small Panel
  -> @liquid-dom/core glass rendering
```

Mantine and Liquid DOM do not own product state, domain validation, named commands, history,
persistence, canvas geometry, or pointer interaction. Feature code must not instantiate Liquid DOM
directly. A shared adapter owns library integration, role configuration, lifecycle, and controlled
fallback behavior.

Neither dependency is added during the documentation phase. Exact library version selection and
the initial optical parameter values require an implementation proof in packaged Tauri/WebView2
builds before they become frozen constants here.

## Target theme

The starting renderer-v2 theme values remain:

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

Implementation tokens use the `--taskmap-` prefix. `#e36b55` is the application-chrome accent for
focus, active state, selection chrome, enabled switches, active tabs, sliders, and ordinary
controls. Teal values left in prototypes or legacy code are not the target chrome accent.

User-selected element colors and color presets are document content, not theme tokens. Danger,
warning, success, info, link, and spatial minimap colors remain semantic tokens and are not recolored
merely to match chrome.

Mantine theme configuration maps to TaskMap tokens. Features should select semantic Mantine variants
or shared TaskMap wrappers rather than hardcoding library-internal class names or duplicating theme
values.

## Canvas presentation

Canvas elements are ordinary React/DOM content. This includes containers, cards, text blocks,
images, static GIF posters/frames, mind-map nodes, and connection presentation. Canvas elements do not use
Liquid DOM materials, including when selected, edited, dragged, resized, or animated.

The live DOM canvas must remain visible to Liquid DOM chrome so glass can blur and refract actual
text, images, and static GIF posters/frames. Do not replace this with a simplified scene projection,
thumbnail-only backdrop, DOM-to-canvas capture loop, or application-owned acrylic compositor.

The established canvas appearance remains the starting target:

- Radius: `24px`
- Dot grid: `24px` spacing, `1.25px` dot radius, `0.50` opacity
- Line grid minor: `24px` spacing, `rgba(88,101,124,0.093)`
- Line grid major: `120px` spacing, `rgba(118,136,164,0.072)`
- Shadow: `0 22px 60px rgb(0 0 0 / 0.30)`

Retained element appearance and animation are accepted against feature-parity evidence. Intentional
changes must be documented here or in a later ADR before implementation.

### Coarse-canvas animation policy

Continuous autonomous animation must not run inside the coarse canvas DOM because any repaint can
require recapturing the coarse Liquid `Html` surface in WebView2. Static SVGs and icons, discrete
state changes, and user-driven dragging, resizing, and panning are fine. Do not use perpetual CSS
spinners, pulses, or morphing gradients inside Canvas Elements. GIFs display a static poster/frame
on the canvas; animated GIF and video playback belongs in a separate preview or UI surface. A
running-command button uses discrete states such as `Run` -> `Running...` -> `Done`.

The coarse canvas remains one coarse Liquid `Html` capture and relies on Liquid DOM's normal full
capture behavior for DOM changes. Partial dirty-region capture was investigated and intentionally
abandoned because WebView2 did not provide useful `changedElements` metadata and its planner,
partial-copy, fallback, and diagnostic complexity was not justified by measured benefit.

## Liquid DOM material boundary

There are exactly two application-glass roles:

| Role        | Intended use                                                    |
| ----------- | --------------------------------------------------------------- |
| Large Panel | Primary chrome shells, major panels, toolbars, and modal shells |
| Small Panel | Compact cards, nested islands, selection surfaces, and controls |

The names describe optical roles, not physical size. A Large Panel may be physically small, and a
Small Panel may stretch to available space when its visual hierarchy calls for it.

Material roles may define only optical treatment owned by the Liquid DOM adapter, such as the
library's blur, refraction, tint, highlight, and related glass parameters. They do not define:

- width or height;
- minimum or maximum dimensions;
- padding, gap, or margin;
- position or responsive behavior;
- border radius tied to component geometry;
- feature state or interaction behavior; or
- z-index chosen by an individual feature.

Geometry belongs to layout/pattern components. Theme and semantic state overlays belong to the
TaskMap/Mantine styling layer. Features select a role and supply content; they do not receive Liquid
DOM tuning props.

### Required live-backdrop behavior

Both roles must be verified over the real renderer-v2 canvas in packaged development and stable
Tauri/WebView2 builds. Acceptance scenes include:

- crisp and antialiased text at multiple zoom levels;
- user-colored DOM elements and grid lines;
- still images with high-frequency detail;
- static GIF posters/frames;
- overlapping and moving canvas content;
- base chrome, portals, menus, and modals; and
- common Windows display-scale and viewport combinations.

A successful static screenshot is insufficient for interaction acceptance.

### Fallback

If Liquid DOM cannot initialize or the runtime cannot provide its full effect, the shared adapter
may render one controlled non-glass surface using TaskMap tint, border, shadow, and contrast tokens.
Fallback must keep content legible and controls operable. It must not activate the old Canvas2D
compositor, add per-feature material code, or silently replace application glass with unbounded
direct backdrop filters.

## Privacy exception

The Privacy extension intentionally retains ordinary CSS `backdrop-filter` blur as a cheap
content-obscuring effect. It is not an application-glass surface and does not use Large Panel or
Small Panel.

This exception is limited to the Privacy-owned obscuring layer. It may not spread to toolbars,
panels, menus, dialogs, cards, canvas elements, or generic primitives. Architecture checks should
reject new direct backdrop filters outside the reviewed Privacy path.

## Mantine component boundary

Mantine is the default for standard React UI behavior:

- buttons, icon buttons, toggles, checkboxes, radios, and sliders;
- menus, popovers, tooltips, and context-menu building blocks;
- dialogs, focus traps, overlays, and portal behavior;
- text inputs, text areas, selects, validation, and form affordances;
- tabs, navigation controls, and accessible status feedback.

TaskMap wrappers may constrain variants, tokens, motion, or product-specific composition. A wrapper
must not hide domain mutation, persistence, platform calls, or feature orchestration. Custom
controls are reserved for interactions Mantine cannot express without breaking TaskMap behavior;
the reason and accessibility contract must be documented with the component.

Liquid DOM may wrap a Mantine component or a group of components when glass is required. Mantine
does not implement glass, and Liquid DOM does not replace the semantic control.

## Layout reference

Dimensions below are layout targets, never material-role definitions.

### Floating toolbar

- Position: `16px` from top and `16px` from left
- Group gap: `8px`
- Group height: `40px`
- Group horizontal padding: `6px`
- Group radius: `12px`
- Buttons: `28px` square with `6px` radius
- Material role: Large Panel

### Side panels

- Position: `16px` from left and `64px` from top
- Width: `290px`
- Maximum height: viewport height minus `80px`
- Padding: `12px`
- Radius: `12px`
- Material role: Large Panel

### Canvas browser

- Full card: `84px` minimum height and `12px` radius
- Minimal card: `40px` height and `8px` radius
- Canvas preview: `96px × 64px` with `6px` radius
- Primary card role: Small Panel when glass is visually required

### Extensions browser

- Extension card: `58px` minimum height and `8px` radius
- Extension icon box: `32px` square with `6px` radius
- Search/filter controls: `36px` height with `8px` radius
- Primary card role: Small Panel when glass is visually required

### Minimap

- Position: `16px` from right and `16px` from bottom
- Shell: `192px` outer width, `8px` padding, `12px` radius
- Interior radius: `6px`
- Shell role: Large Panel

### Settings

- Reference maximum layout: `528px × 632px`
- Padding: `20px`
- Modal radius: `12px`
- Tabs: `36px` height with `8px` target radius
- Settings island radius: `8px`
- Scrim: `rgb(0 0 0 / 0.36)`
- Shell role: Large Panel; meaningful nested glass islands may use Small Panel

## Motion and accessibility

The established starting motion tokens remain:

| Token             | Value                           |
| ----------------- | ------------------------------- |
| Instant           | `0ms`                           |
| Fast              | `120ms`                         |
| Normal            | `180ms`                         |
| Slow              | `280ms`                         |
| Standard easing   | `cubic-bezier(0.2, 0, 0, 1)`    |
| Emphasized easing | `cubic-bezier(0.16, 1, 0.3, 1)` |

`prefers-reduced-motion: reduce` removes decorative travel, deformation, and overshoot while
preserving clear state changes. Mantine semantics, focus management, keyboard operation, ARIA, and
disabled behavior are verified at the TaskMap composition boundary, including menus and dialogs
rendered through portals.

## High-frequency performance contract

Pan, zoom, drag, and resize target 60 FPS. On pointer samples:

- update only bounded transient interaction/presentation state;
- avoid persistent Redux dispatch and document cloning;
- do not serialize, encrypt, save, write history, or call the database;
- do not measure or reconcile the complete element set;
- do not create/destroy Liquid DOM surfaces; and
- do not retune materials or run application-owned backdrop capture/blur.

Liquid DOM panels live in application chrome outside the transformed element scene. Renderer-v2
acceptance must measure interaction with representative Large and Small panels visible over the
normal fixture. Deterministic CI gates protect ownership and call counts; final FPS is measured in a
release-mode packaged Windows build.

## Adding or changing a glass surface

1. Confirm the surface is application chrome rather than canvas content or Privacy obscuring UI.
2. Select Large Panel or Small Panel based on visual hierarchy.
3. Define dimensions, radius, placement, and responsive behavior in the owning layout pattern.
4. Compose Mantine/semantic content inside the shared material adapter.
5. Add accessibility, fallback, live-backdrop, stacking, and interaction-performance coverage.
6. Update this document and add an ADR before introducing a third role or changing material
   technology or dependency direction.

Do not add feature-local Liquid DOM instances, role variants that encode dimensions, a custom
acrylic compositor, or direct backdrop blur outside Privacy.
