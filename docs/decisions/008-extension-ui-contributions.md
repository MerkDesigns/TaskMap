# ADR 008: Extensions contribute their own UI through typed contribution points

- Status: Accepted
- Date: 2026-10-03

## Context

Phase 6 moves the retained extensions (Lock, Privacy, Extra colors, Checkbox, Search, Auto
checkboxes, Counter, Inherit Card Color, Copy/Paste JSON) into the new architecture. Their
definitions (schema, default state, compatibility) are already registered in
`src/extensions/architectureRegistry.ts`, but their controls were written into the element
renderers and `App.tsx`: the container and text-block headers each switched over the extensions,
and `App.tsx` passed one callback per extension into every renderer. The architecture contract
forbids exactly that ("unrelated central components must not accumulate one callback/switch per
extension").

## Decision

An extension owns its UI and reaches the application through a command port. Elements host
**contribution points**; they never name individual extensions.

- A contribution point is a small typed contract in `src/extensions/` plus an ordered,
  statically built registry of the extension modules that contribute to it. The registry order is
  the display order.
- The first point is the **element header control** (`headerControl.tsx`,
  `headerControlRegistry.ts`): a button (with its width for the header's fit-beside-the-title
  layout) and an optional panel such as a popover. The container and text-block headers render the
  registered controls whose extension is installed on the element and whose host type matches.
- The host owns layout and chrome (header button styles, the overflow popover, which control's
  panel is open); the extension owns its button's content, its panel and what its commands do.
  Panels are kept by the host, so a panel opened from the overflow popover survives that popover
  closing.
- Commands go through one `ExtensionCommands` port supplied by the application (today `App.tsx`
  over the retained callbacks). Elements forward the port without inspecting it.
- The second point is the **text-card adornment** (`cardAdornment.ts`,
  `cardAdornmentRegistry.ts`): content drawn before the card's text, plus a named text state
  (`done`) that the card styles. Mind-map nodes, which share the Text Card renderer, take none.
- The third point is the **element menu item** (`menuItem.ts`, `menuItemRegistry.ts`): an item in
  an element's context menu, plus an optional panel beside the menu. Items are offered while their
  extension is installed on any menu target; an item that acts on the element itself (the Lock
  toggle) renders only when the element has the extension. The menus host the items and the
  "Remove Extensions" section, labelled by the extension definitions; removal and the menu's
  selection-wide recolour are port commands.
- The fourth point is the **header row** (`headerRow.ts`, `headerRowRegistry.ts`): a full-width
  row below an element's header with a fixed height, such as Search's query field. The container
  hosts the rows and sizes its header and content from their total height.
- The fifth point is the **content state** (`contentState.ts`): a named state an element styles its
  content in, like the card text state. Privacy contributes `hidden`; containers, text blocks and
  the cards a hidden container holds blur their content without naming Privacy.
- An extension whose behavior is a flow with its own window keeps the flow in its module behind a
  small port: Copy/Paste JSON's `useCopyPasteJsonFlow` owns copying, pasting and the editor window,
  and the application supplies only document access (read the JSON, capture a replacement) and the
  presentation reset after a replacement.
- Further contribution points (behavioral effects such as lock, search filtering and privacy)
  follow the same pattern as their extensions migrate.

## Consequences

- Adding or removing a header extension changes only its module and the registry, not the hosts.
- The command port still lists the commands the current extensions need; commands move behind
  extension-owned application commands as each extension's behavior migrates.
- Hosts and controls share the header button class from `elementHeader.css` through
  `HeaderControlButton`, so extension buttons keep the host's look.
