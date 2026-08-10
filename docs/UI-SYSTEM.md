# TaskMap UI System

This document is the permanent capability catalog and ownership map for reusable TaskMap UI. It
tracks when a capability should be implemented; it is not a claim that the production UI has been
migrated. `docs/VISUAL-SYSTEM.md` remains normative for exact theme, material, geometry, and motion
values.

## Status key

- **Foundation implemented** — reusable C1 code or tokens exist and are covered by tests/Lab use.
- **Implement during C2** — production chrome/settings migration should supply the real contract.
- **Implement during C3** — overlays and advanced application presentation need production usage.
- **Feature-specific Phase 5+** — belongs with an element/feature module, using shared primitives.
- **Capability only** — implement only when a concrete retained workflow requires it.

## Ownership and dependency direction

```text
feature or TaskMap pattern
  -> src/ui/primitives
  -> src/ui/materials + src/ui/motion
  -> compositor public boundary
```

- `theme/` owns scoped target tokens. C2A applies them only to the production workspace root.
- `materials/` owns surface strategies and compositor integration. Component states are not material
  IDs.
- `motion/` owns deterministic calculations, reduced-motion preference, and the shared UI frame
  scheduler. It does not import application state, persistence, Redux, domain, or Tauri.
- `primitives/` owns generic semantic controls, form elements, navigation, layout, and status.
- `patterns/` owns TaskMap-specific compositions as production needs are migrated in C2/C3. Its
  first production boundary is the C2A workspace root, backdrop/chrome layers, and canvas-frame
  foundation. C2B adds only `FloatingCanvasToolbar` and `ToolbarGroup`, leaving panels, minimap,
  Settings, and overlays with their existing production owners. C2C adds the shared production
  `WorkspaceSidePanel`/`WorkspacePanelHeader` shell. C2D adds the presentation-only
  `CanvasBrowserCard`/`CanvasPreview` patterns and composes the inline editor from C1 form/button
  primitives while leaving Canvas Manager behavior, preview projection, and portal ownership in
  the feature. C2E adds `ExtensionBrowserCard`/`ExtensionIconBox` and composes the primary
  Extensions panel search/filter/favorite controls from C1 primitives. Quick Extensions, the shared
  info tooltip, and the legacy filter portal shell remain unmigrated. C2F adds the reset-only
  `MinimapSurface`/`MinimapViewport` production pattern while leaving projection and visibility
  lifecycle ownership in the feature/App. C3A adds the modal-plane `ModalLayer` stacking boundary
  and the presentation-only `SettingsShell`/`SettingsIsland`/`SettingsRow` patterns for primary
  Settings. Password/update/color-picker and all other overlay shells remain unmigrated.
- `dev/` owns the opt-in development UI Lab and no production behavior.

Feature code may compose `MaterialSurface + material + radius + elevation + behavior`. It must not
import compositor internals or create a material ID for a button, tab, pill, toolbar, or card.

The `Text` primitive exposes body, body-small, label, caption, heading, section-heading, muted, and
monospace roles using the scoped typography tokens.

## A. Material and visual surfaces

| Capability                         | Status                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------- |
| Acrylic Large                      | Foundation implemented                                                 |
| Acrylic Small                      | Foundation implemented                                                 |
| Cutout                             | Foundation implemented                                                 |
| Solid/opaque surface               | Foundation implemented (`opaque` MaterialSurface and plain containers) |
| Transparent layout surface         | Foundation implemented (`Stack`/`Inline`)                              |
| Modal scrim                        | C3A foundation implemented for the primary Settings modal              |
| Accent wash                        | Foundation implemented as a scoped effect token                        |
| Selection state                    | Foundation implemented as shared state styling/token                   |
| Bright glass selection             | Foundation implemented as a reusable `MaterialSurface` effect          |
| Hover state                        | Foundation implemented as shared state styling/token                   |
| Pressed state                      | Foundation implemented as shared state styling/token                   |
| Disabled state                     | Foundation implemented as shared state styling/token                   |
| Focus ring                         | Foundation implemented with `:focus-visible`                           |
| Selection ring                     | Foundation implemented as a reusable token                             |
| Danger/warning/success/info states | Foundation implemented as semantic tones/tokens                        |
| Gradient rim                       | Foundation implemented as an effect token                              |
| Radial highlight                   | Foundation implemented by the material boundary                        |
| Inner shadow                       | Foundation implemented as an effect token                              |
| Outer shadow                       | Foundation implemented as an effect token                              |
| Accent glow                        | Foundation implemented as an effect token; use only where appropriate  |
| Scroll/fade mask                   | Implement during C2                                                    |

These effects are state layers and tokens, not additional material strategies.

## B. Buttons and controls

| Capability               | Status                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| Button                   | Foundation implemented                                              |
| Primary button           | Foundation implemented                                              |
| Secondary button         | Foundation implemented                                              |
| Danger button            | Foundation implemented                                              |
| Ghost button             | Foundation implemented                                              |
| IconButton               | Foundation implemented                                              |
| ToggleButton             | Foundation implemented                                              |
| Acrylic ToggleButton     | Foundation implemented with Acrylic Small and shared press motion   |
| IconToggleButton         | Foundation implemented by composing `ToggleButton` with an icon     |
| ButtonGroup              | Foundation implemented                                              |
| SegmentedControl         | Foundation implemented                                              |
| Checkbox                 | Foundation implemented with native input semantics                  |
| Radio / RadioGroup       | Foundation implemented with native input semantics                  |
| Switch                   | Foundation implemented with native checkbox and `role="switch"`     |
| Slider                   | Foundation implemented with native range input                      |
| Range control capability | Capability only                                                     |
| Number stepper           | Implement during C2                                                 |
| Color swatch control     | Implement during C2                                                 |
| Reset/clear action       | Foundation implemented through `Button`/`IconButton`; pattern in C2 |
| Close action             | Foundation implemented through `IconButton`; pattern in C3          |
| Overflow action          | Foundation implemented through `IconButton`; menu behavior in C3    |

## C. Input and form

| Capability                        | Status                                                              |
| --------------------------------- | ------------------------------------------------------------------- |
| Field                             | Foundation implemented                                              |
| Label                             | Foundation implemented through `Field` association                  |
| Description                       | Foundation implemented through `aria-describedby`                   |
| Validation/error                  | Foundation implemented through shared invalid state and association |
| TextField                         | Foundation implemented                                              |
| SearchField                       | Foundation implemented                                              |
| PasswordField capability          | Capability only; native input when required                         |
| NumberField capability            | Implement during C2                                                 |
| TextArea                          | Foundation implemented                                              |
| Select                            | Foundation implemented with native select                           |
| Searchable combobox capability    | Implement during C3                                                 |
| Multi-select capability           | Implement during C3                                                 |
| File/folder/path field capability | Implement during C2                                                 |
| URL field capability              | Capability only; native URL input when required                     |
| Prefix/suffix slots               | Foundation implemented                                              |
| Read-only field                   | Foundation implemented through native properties; pattern in C2     |
| Copyable value field              | Implement during C2                                                 |

Normal C1 input focus uses a thin low-opacity white border without the application accent or a
strong glow. Invalid/error presentation remains semantic danger red.

## D. Navigation

| Capability                 | Status                                            |
| -------------------------- | ------------------------------------------------- |
| Tabs                       | Foundation implemented                            |
| LiquidTabs                 | Foundation implemented                            |
| Segmented navigation       | Foundation implemented through `SegmentedControl` |
| Sidebar navigation         | Implement during C2                               |
| Navigation row             | Implement during C2                               |
| Breadcrumb capability      | Capability only                                   |
| Back/forward controls      | Implement during C2                               |
| Canvas switcher capability | Implement during C2                               |
| Pagination capability      | Capability only                                   |
| Step/progress navigation   | Capability only                                   |
| Command palette capability | Implement during C3                               |

## E. Layout and containers

| Capability                 | Status                                              |
| -------------------------- | --------------------------------------------------- |
| Panel                      | Foundation implemented                              |
| FloatingPanel              | C2C foundation implemented as `WorkspaceSidePanel`  |
| DockedPanel capability     | Implement during C2                                 |
| Resizable panel capability | Implement during C2 using the interaction subsystem |
| Split pane capability      | Capability only                                     |
| PanelHeader                | C2C foundation implemented                          |
| PanelFooter                | Implement during C2                                 |
| Section                    | Implement during C2                                 |
| Card                       | Foundation implemented                              |
| CompactCard                | Implement during C2                                 |
| ListRow                    | Implement during C2                                 |
| Stack                      | Foundation implemented                              |
| Inline                     | Foundation implemented                              |
| Grid                       | Implement during C2                                 |
| Divider                    | Foundation implemented                              |
| ScrollArea                 | C2C foundation implemented                          |
| ScrollFade                 | Implement during C2                                 |
| StickyHeader capability    | Implement during C2                                 |
| CollapsibleSection         | Implement during C2                                 |
| Accordion capability       | Capability only                                     |

## F. Overlays

| Capability               | Status                                                           |
| ------------------------ | ---------------------------------------------------------------- |
| Tooltip                  | Implement during C3                                              |
| Popover                  | Implement during C3                                              |
| Dropdown                 | Implement during C3                                              |
| ContextMenu              | Foundation implemented; production behavior migration remains C3 |
| Nested submenu           | Implement during C3                                              |
| SelectMenu               | Implement during C3                                              |
| Modal/Dialog             | C3A modal-plane/shell foundation; remaining dialogs during C3    |
| ConfirmDialog            | Implement during C3                                              |
| AlertDialog              | Implement during C3                                              |
| Drawer/Sheet             | Implement during C3                                              |
| Inspector                | Implement during C3                                              |
| Toast                    | Implement during C3                                              |
| Snackbar                 | Capability only                                                  |
| CommandPalette overlay   | Implement during C3                                              |
| Loading overlay          | Implement during C3                                              |
| Blocking progress dialog | Implement during C3                                              |

C1 provides only the concrete coordinate-positioned ContextMenu shell, items, divider, section
label, compact icon-action group, roving menu-item focus, ArrowUp/Down and Home/End navigation,
Tab/Escape/outside dismissal, focus return, and entry/exit presence required by the Lab review.
Callers own placement and collision policy; the Lab's anchored example is a development-side adapter.
Nested menus, portals, generalized collision systems, and production menu migration remain C3 work.

## G. Display and status

| Capability              | Status                                          |
| ----------------------- | ----------------------------------------------- |
| Badge                   | Foundation implemented                          |
| Pill/Tag                | Foundation implemented through `Badge` geometry |
| StatusDot               | Foundation implemented                          |
| Counter                 | C2C foundation implemented                      |
| Keycap                  | Foundation implemented                          |
| EmptyState              | Implement during C2                             |
| Spinner                 | Foundation implemented                          |
| Progress                | Foundation implemented                          |
| Indeterminate progress  | Foundation implemented                          |
| Skeleton                | Implement during C3                             |
| ErrorState              | Implement during C3                             |
| WarningBanner           | Implement during C3                             |
| InfoBanner              | Implement during C3                             |
| SuccessBanner           | Implement during C3                             |
| InlineHelp              | Implement during C2                             |
| Thumbnail               | Feature-specific Phase 5+                       |
| Media indicators        | Feature-specific Phase 5+                       |
| Unsaved indicator       | Implement during C2                             |
| Lock/private indicators | Feature-specific Phase 5+                       |

## H. TaskMap canvas patterns

These were cataloged in C1. C2A implements the production canvas frame/grid foundation and C2D
implements only Canvas Browser card/preview/editor presentation; minimap and canvas-world element
presentation remain later work.

| Capability              | Status                     |
| ----------------------- | -------------------------- |
| Canvas surface/frame    | C2A foundation implemented |
| Canvas browser card     | C2D foundation implemented |
| Compact canvas card     | C2D foundation implemented |
| Canvas preview          | C2D foundation implemented |
| Text-card shell         | Feature-specific Phase 5+  |
| Container shell         | Feature-specific Phase 5+  |
| Container header/body   | Feature-specific Phase 5+  |
| Text-block shell        | Feature-specific Phase 5+  |
| Image/GIF shell         | Feature-specific Phase 5+  |
| Mind-map node shell     | Feature-specific Phase 5+  |
| Connections             | Feature-specific Phase 5+  |
| Selection outline       | Feature-specific Phase 5+  |
| Multi-selection outline | Feature-specific Phase 5+  |
| Resize handles          | Feature-specific Phase 5+  |
| Snap guides             | Feature-specific Phase 5+  |
| Alignment guides        | Feature-specific Phase 5+  |
| Distance indicators     | Feature-specific Phase 5+  |
| Marquee selection       | Feature-specific Phase 5+  |
| Drag ghost              | Feature-specific Phase 5+  |
| Drop target             | Feature-specific Phase 5+  |
| Insertion indicator     | Feature-specific Phase 5+  |
| Reparent highlight      | Feature-specific Phase 5+  |
| Locked indicator        | Feature-specific Phase 5+  |
| Grid                    | C2A foundation implemented |
| Minimap                 | C2F foundation implemented |
| Minimap viewport        | C2F foundation implemented |
| Zoom indicator          | C2F foundation implemented |
| Floating canvas toolbar | C2B foundation implemented |
| Creation menu           | Implement during C3        |

The C2E Extensions Browser pattern maps primary non-embedded extension cards to Acrylic Small and
embedded cards to Opaque, with Cutout icon boxes in both modes. It owns presentation only; registry
ordering, filtering, favorites/localStorage, drag/drop callbacks, and overlay lifecycles remain in
their existing feature owners. The body drag preview remains a plain unregistered representation.

The C2F Minimap pattern maps the floating production shell to one base-plane Acrylic Large surface
and its interior to non-registering Cutout. Its opacity-only visibility motion synchronizes DOM and
compositor mask opacity through the shared scheduler; App retains enable/mount/unmount timing, and
the feature retains the pure projection plus reset-only interaction contract.

## I. Settings patterns

The C3A primary Settings migration implements only capabilities exercised by the retained production
Settings screen. Deferred nested overlays keep their existing presentation until later C3 slices.

| Capability                 | Status                                                         |
| -------------------------- | -------------------------------------------------------------- |
| SettingsShell              | C3A foundation implemented                                     |
| SettingsNavigation         | C3A composition implemented with `LiquidTabs`                  |
| Liquid category selector   | C3A production composition implemented                         |
| SettingsPage               | C3A primary production composition implemented                 |
| SettingsSection            | C3A primary section presentation implemented                   |
| SettingsIsland             | C3A foundation implemented with modal-plane Acrylic Small      |
| SettingsRow                | C3A foundation implemented                                     |
| SettingsLabel/Description  | C3A foundation implemented                                     |
| Control slot               | C3A foundation implemented through `SettingsRow`               |
| Reset-to-default           | Capability only                                                |
| Restart-required indicator | Capability only                                                |
| DangerSection              | Capability only                                                |
| Version/about row          | Capability only; C3A retains the existing version footer       |
| Shortcut row               | C3A production presentation implemented                        |
| Path/file row              | Capability only                                                |
| Appearance preview         | Capability only                                                |
| Accent/color selector      | C3A trigger composition; `ColorPickerMenu` shell remains later |

## J. Motion

### General motion

| Capability                 | Status                                                                   |
| -------------------------- | ------------------------------------------------------------------------ |
| Fade                       | Foundation implemented through tokens; production use in C2/C3           |
| Scale                      | Foundation implemented through tokens; production use in C2/C3           |
| Fade + scale               | Foundation implemented through tokens; production use in C2/C3           |
| Slide                      | Foundation implemented through tokens; production use in C2/C3           |
| Slide + fade               | Foundation implemented through tokens; production use in C2/C3           |
| Pop                        | Foundation implemented through tokens; production use in C3              |
| Press/compress             | Foundation implemented in shared control state                           |
| Hover lift                 | Foundation implemented through tokens; apply during C2 where appropriate |
| Crossfade                  | Implement during C2                                                      |
| Expand/collapse            | Implement during C2                                                      |
| Height reveal              | Implement during C2                                                      |
| Width reveal               | Capability only                                                          |
| Rotate                     | Foundation implemented through tokens; production use in C2/C3           |
| Icon morph capability      | Capability only                                                          |
| Chevron rotation           | Implement during C2                                                      |
| Count/number interpolation | Capability only                                                          |

### Layout motion

| Capability              | Status                                             |
| ----------------------- | -------------------------------------------------- |
| FLIP position           | C2D shared-scheduler production use                |
| FLIP resize             | Foundation implemented with local measurement math |
| Reorder                 | C2D Canvas Browser production use                  |
| Shared-element movement | Capability only                                    |
| Insert/remove           | Implement during C2                                |
| Drag lift               | Feature-specific Phase 5+                          |
| Drop settle             | Feature-specific Phase 5+                          |
| Reparent transition     | Feature-specific Phase 5+                          |

FLIP is restricted to local participating components and is not suitable for the canvas-world element
population. C2D drives local card transforms from the shared UI scheduler and refreshes registered
material geometry through the cheap public invalidation seam on active frames only.

### Liquid motion

| Capability                     | Status                                                   |
| ------------------------------ | -------------------------------------------------------- |
| Liquid rounded-selection slide | Foundation implemented                                   |
| Stretch-on-travel              | Foundation implemented                                   |
| Compression-on-arrival         | Foundation implemented                                   |
| Velocity-dependent deformation | Foundation implemented through independent edge velocity |
| Spring overshoot               | Foundation implemented; removed for reduced motion       |
| Trailing-edge catch-up         | Foundation implemented                                   |
| Width morph                    | Foundation implemented                                   |
| Retarget while already moving  | Foundation implemented from current state/velocity       |

### Overlay motion

| Capability             | Status                                                         |
| ---------------------- | -------------------------------------------------------------- |
| Modal entry/exit       | Implement during C3                                            |
| Anchored popover entry | Implement during C3                                            |
| Context-menu pop       | Foundation implemented with shared tokens on an opaque surface |
| Tooltip fade           | Implement during C3                                            |
| Toast slide            | Implement during C3                                            |
| Drawer slide           | Implement during C3                                            |
| Scrim fade             | Implement during C3                                            |

### State motion

| Capability               | Status                                              |
| ------------------------ | --------------------------------------------------- |
| Toggle spring            | Foundation implemented for the acrylic toggle       |
| Checkbox transition      | Foundation implemented with shared state timing     |
| Radio transition         | Foundation implemented with shared state timing     |
| Focus ring               | Foundation implemented with reduced-motion-safe CSS |
| Error shake capability   | Capability only                                     |
| Success pulse capability | Capability only                                     |
| Selection pulse/glow     | Capability only                                     |
| Progress interpolation   | Foundation implemented with shared timing           |

## C1 motion implementation

`motionTokens.ts` is the single TypeScript source for semantic duration, easing, spring, frame-clamp,
and settle values. `theme.css` mirrors CSS-consumable duration/easing tokens within the scoped target
theme. `motionMath.ts` analytically integrates damped scalar springs, avoiding frame-rate-dependent
Euler instability. Retargeting supplies the current position and velocity to the next integration.

`motionFrameScheduler.ts` owns one pending `requestAnimationFrame` for all active UI-motion
subscribers. A subscriber returns whether it remains active; unsubscribe is idempotent, the frame is
cancelled when the final subscriber leaves, and large background/debugger deltas are clamped. This
scheduler is separate from the compositor scheduler.

`reducedMotionPreference.ts` owns the one `matchMedia` boundary. CSS and JavaScript motion honor
`prefers-reduced-motion: reduce`; spring-driven state settles immediately and CSS motion duration is
near-immediate while state changes remain visible.

`LiquidSelectionIndicator` uses an absolute `MaterialSurface` with `material="acrylic-small"`, no
elevation, the reusable bright-selection effect, and a bounded dynamic rounded-rectangle radius
(`7px` rest, `14px` maximum stretch). Its moving Acrylic Small gradient rim, white wash, and
compositor mask share that geometry. Its
independent leading/trailing edge springs support stretch, width morph, direction changes, and
mid-flight retargeting. Each moving/radius frame calls the public cheap surface-geometry invalidation
seam; it does not request cache rebuilds.

`LiquidTabs` is controlled and exposes values/items rather than physics. It uses native buttons,
tablist/tab ARIA, disabled skipping, arrows, Home/End, roving tabindex, and local resize measurement.
Labels remain at unit scale; the shared moving glass surface alone expresses selection.

`AcrylicToggleButton` composes a native `aria-pressed` button over Acrylic Small. Its local on-state
now shares the normal confirm's accent wash and bright rim without changing the material strategy.
It has no hover highlight. Its transform-only press/release motion shares the C1 scheduler and cheap
surface-geometry invalidation seam.

`AcrylicConfirmButton` reuses that press foundation without toggle semantics. Normal and disabled
confirm flows keep the Acrylic Small surface without a hover highlight, and the disabled treatment
stays subdued. The opt-in glowing treatment adds an opaque accent wash, restrained glow, and black
foreground.

`LiquidToggleSwitch` is a larger native switch whose dark/off and accent/on track contains one real
Acrylic Small knob. The knob uses the central liquid spring: velocity makes it longer and thinner
during travel, bounded overshoot preserves track containment, and settlement restores its exact
circular geometry. Its compact revised geometry centers the knob vertically and transitions between
a brighter off contrast wash and a stronger dark-tinted glass knob over a bright, subtly glowing
orange on track. Pointer
focus does not retain selection-like chrome; keyboard focus uses a thin neutral-white indication.
`AnimatedCheckbox` keeps a native checkbox input and draws two SVG tick strokes from an initial dot
using shared CSS motion tokens.

The reusable ContextMenu foundation keeps its `opaque` MaterialSurface mounted through tokenized
exit motion and supports roving keyboard focus plus outside-pointer, Tab, and Escape dismissal.
Opaque uses a slightly brighter dark tint while reusing Acrylic Small's radial highlight, gradient
rim, shadow, and radius system with a fully opaque tint and no compositor registration. Feature
actions and production coordinate placement remain outside the primitive.

`Field` derives its label target from an explicit child-control ID when present and otherwise supplies
its generated ID through context. Explicit `aria-describedby` references are de-duplicated and merged
with Field-owned description/error references rather than replacing either source.

## Development UI Lab

The Lab is dynamically reachable only when Vite replaces `import.meta.env.DEV` with true and the
explicit flag equals `1`. It applies `.taskmap-target-theme` to the Lab root only and uses the real
material provider, primitives, shared motion scheduler, and LiquidTabs.

While active, the Lab replaces the hidden legacy UI and temporarily publishes a synthetic generic
BackdropScene through the existing compositor presentation bridge. The visible SVG fixture and the
Worker/fallback projection consume the same frozen scene model. Its fixed MaterialSurface preview
can compare Acrylic Large, Acrylic Small, compact Small, liquid-selection geometry, and Cutout while
local pan/zoom moves high-contrast stress geometry behind it. No second provider, runtime, cache, or
blur implementation exists.

The Lab separately reports the real system reduced-motion preference and offers an in-memory scoped
simulation override. Without that provider, production motion continues to use only
`prefers-reduced-motion`.

The Lab's left-column Button material tests show the reusable acrylic toggle, four-option LiquidTabs,
normal accessible ghost icon button, liquid toggle switch, three confirm flows, and animated
checkbox. Its development-only container context-menu fixture mirrors the current production menu's
compact presentation ordering using inert local state. The trigger remains embedded over the
synthetic playground, while the opaque material intentionally prevents that arbitrary content from
showing through; it does not import or migrate production menu behavior.

```powershell
$env:VITE_TASKMAP_UI_LAB="1"
npm run app:dev
Remove-Item Env:VITE_TASKMAP_UI_LAB
```

There are no compositor tuning controls, persistence connections, Redux state, schema fields, or
local-storage writes in the Lab.
