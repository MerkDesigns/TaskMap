# Baseline Behavior Capture

This checklist records the legacy application's retained user-facing behavior before implementation changes. Screenshots and recordings should be stored outside the production bundle under `docs/baseline-assets/` or attached to the tracking pull request.

The Phase 0 captures remain historical evidence of legacy behavior and appearance. ADR 003 later
approved an intentional Phase 4.5 visual redesign, so existing frosted-glass captures are not the
future material acceptance target. Phase 4.5 acceptance uses `docs/VISUAL-SYSTEM.md` and the approved
local/reference capture without rewriting or deleting this historical record.

## Capture rules

- Use the current stable build from `main`, not a partially refactored build.
- Record the application version, Windows version, display scaling, monitor resolution, and database used.
- Capture both the starting state and completed interaction.
- Record keyboard modifiers and mouse buttons.
- Do not use private production data in committed screenshots or fixtures.

## Application shell

- [ ] Startup appearance
- [ ] Main canvas framing and background
- [ ] Floating toolbar
- [ ] Left-side panels
- [ ] Settings modal
- [ ] Canvas manager
- [ ] Update modal
- [ ] Toast notifications
- [ ] Existing frosted-glass surfaces at rest and while content moves beneath them

## Canvas interactions

- [ ] Pan with mouse
- [ ] Wheel zoom around pointer
- [ ] Reset zoom
- [ ] Selection rectangle
- [ ] Additive multi-selection
- [ ] Move one element
- [ ] Move multiple element types together
- [ ] Resize container
- [ ] Resize text block
- [ ] Resize image with aspect ratio
- [ ] Shift snapping and visible guides
- [ ] Layer movement
- [ ] Delete and animated removal
- [ ] Undo and redo after each persistent action
- [ ] Verify pan, zoom, menus, and selection do not create history entries

## Containers and cards

- [ ] Create container
- [ ] Rename container
- [ ] Create card inside container
- [ ] Create loose card
- [ ] Drag card into container
- [ ] Drag card out of container
- [ ] Reorder cards inside container
- [ ] Drag several cards as a bundle
- [ ] Container scrolling and card virtualization
- [ ] Search extension filtering
- [ ] Checkbox extension interaction
- [ ] Lock behavior
- [ ] Privacy blur behavior
- [ ] Color tools and recent colors
- [ ] AI JSON copy, paste, and editor

## Other elements

- [ ] Create and edit text block
- [ ] Import image by picker
- [ ] Import image by drag and drop
- [ ] Paste image from clipboard
- [ ] Transparent image background behavior
- [ ] Animated GIF playback
- [ ] Mind-map node creation
- [ ] Connection creation from each port
- [ ] Connection deletion
- [ ] Create a connected node by dropping into empty space

## Canvases and persistence

- [ ] Create canvas
- [ ] Rename canvas
- [ ] Resize canvas
- [ ] Switch canvases without losing edits
- [ ] Delete canvas
- [ ] Minimap behavior
- [ ] Close and reopen application
- [ ] Autosave timing
- [ ] Storage error presentation
- [ ] Current database backup/recovery behavior

## Keyboard and context menus

- [ ] Record every keyboard shortcut
- [ ] Canvas context menu
- [ ] Container context menu
- [ ] Container-content context menu
- [ ] Text-card context menu
- [ ] Text-block context menu
- [ ] Image context menu
- [ ] Mind-map connection context menu
- [ ] Menu positioning at every screen edge

## Removed behavior evidence

Capture enough evidence to support legacy migration reporting, but do not port these features:

- [ ] Daily reset
- [ ] Sorting
- [ ] Pick-a-card
- [ ] Discord Rich Presence
- [ ] Current raw Command Runner
- [ ] Frosted-glass development tuner

## Performance baseline

For each generated fixture, record cold startup, canvas switch, pan, zoom, drag, selection, and memory use.

| Fixture | Elements | Expected use                           |
| ------- | -------: | -------------------------------------- |
| Small   |       40 | Functional tests and visual inspection |
| Normal  |    2,000 | Required 60 FPS interaction target     |
| Stress  |   10,000 | Target maximum document behavior       |

Run `npm run fixtures:baseline` to generate deterministic fixture documents under `fixtures/baseline/`.

## Completion record

Phase 0 evidence is complete only when every retained item above has either:

- a screenshot or recording reference,
- a written behavior specification, or
- an automated test that fully captures the behavior.
