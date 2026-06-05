# TaskMap Project Notes

## Stack

- Tauri desktop app.
- Rust backend under `src-tauri`.
- React + TypeScript frontend.
- Tailwind + DaisyUI for styling.
- Tabler icons from `@tabler/icons-react`.

## Icon Rules

- Use Tabler icons for app UI icons.
- All Tabler icons should use `stroke={2}` unless a specific local design reason overrides it.

## Product Direction

- TaskMap is a premium-feeling dark-mode canvas app.
- The main screen should stay focused on the canvas, with minimal floating UI.
- Avoid browser/PWA-looking native web behavior. Suppress browser context menus.
- UI should feel like a normal desktop/Tauri app.

## Canvas

- Current canvas dimensions are `3000 x 3000`.
- Canvas dimensions are represented separately as `CANVAS_WIDTH` and `CANVAS_HEIGHT` so rectangular canvases can work later.
- Canvas is pan-able with middle-mouse drag only.
- Panning should work universally, including when the pointer starts over a container.
- Mouse wheel zooms the canvas around the pointer.
- Zoom uses 5% increments.
- The minimap reset icon returns zoom to 100%.
- Right-clicking an empty canvas spot opens an in-app context menu, anchored bottom-right from the pointer.
- Canvas context menu options currently include create container, conditional paste, and clear canvas.
- Clear canvas must show a confirmation modal before deleting containers.

## Containers

- Containers have a topbar/header with the container name.
- Containers are dragged by the topbar using a hand/grab cursor, not a four-way move cursor.
- Containers resize from a bottom-right handle using a small Tabler bottom-right arrow icon.
- Resize handle gets a subtle rounded hover/active highlight.
- Container body stays dark.
- Container border and topbar use the same per-container accent color.
- Container topbar and border should visually blend as one shell; avoid visible divider/seam between the topbar and border.
- `Edit Container` enters inline name edit mode in the topbar.
- Name edit mode should preselect all text for immediate overwrite.
- Container menu copy stores a copied template; paste happens later from the canvas context menu.

## Color

- Container accent colors are chosen from 8 presets.
- Preset swatches in the menu use normal-saturation display colors.
- Applying a preset uses a muted/dark accent color for the actual container topbar and border.
- Selected color indicator is a solid white rounded rectangle inside the swatch.

## Minimap

- Minimap appears only while panning/zooming, lingers briefly, then fades out.
- Minimap uses a frosted-glass style panel.
- Minimap should not show the canvas dot background.
- Minimap dimensions derive from canvas aspect ratio with a max size cap, so rectangular canvases do not look comically stretched.
- Minimap displays containers using their accent outline and a 15% opacity accent fill.
- Viewport rectangle keeps its true window-scaled size and is clipped by the minimap bounds when the camera moves out of canvas bounds. It should not shrink because of clipping.

## Context Menus

- Use in-app context menus, not native browser context menus.
- Context menu background is dark (`#1b1b1e` currently).
- Context menu outline should be subtle, about 15% white opacity.
- Context menus should have dividers between options and hover highlights on every option.
- Context menu panel padding is intentionally tight.
- Container context menu currently includes edit container, color presets, copy, and remove.
- Canvas context menu currently includes paste when something is copied, create container, and clear canvas.

## Current Floating UI

- Top-left floating icon-only bar exists.
- It currently has a settings button.
- Settings button opens a centered settings window/modal.

## Branding

- Source logo is `src-tauri/icons/Assets/TaskMapLogo.png`.
- Derived app icons are generated into `src-tauri/icons`.
- Web icons are generated into `public`.
- `src-tauri/tauri.conf.json` references the generated app icons.
- `index.html` references favicon and Apple touch icon.
