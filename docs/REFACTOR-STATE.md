# TaskMap Refactor State

> Current snapshot only. History belongs in Git (commits, pull requests) and `CHANGELOG.md`.

## Branch and phase

- Branch: `architecture-v1`, pushed.
- **Phase 4.5 (final UI + glass system) is complete** (approved 2026-10-01).
- **Phase 5 (element renderer migration) is complete**, signed off by the user on 2026-10-03. Every
  canvas element renders from `src/elements/`: Text Card (and mind-map nodes), Container, Text
  Block, Image and mind-map connections, each with its own CSS, reading the normalized element plus
  typed view state, with its menu next to it.
- **Phase 6 (extensions) is complete**, signed off by the user on 2026-10-04. Extensions contribute
  their UI through typed contribution points (ADR 008) and own their rules and flows; the extension
  definitions are the one registry.
- **Next: Phase 7 — Workflow Runner.**
- No open pull request; the user merges nothing into `main` yet.

## Active ownership and accepted behavior

- DatabaseApplication and the normalized workspace/commands/history/persistence system own product
  data. Rust owns database/session security. Retained `App.tsx` is presentation only.
- MaterialSurface and the materials subsystem own glass; features never own private filters.
  - Workspace Majors share one native plane (`WorkspaceMajorGlass`, layered output masks); window
    controls join it through `WorkspaceMajorGlassBridge`. Majors outside a workspace (dialogs on
    the modal plane, the unlock panel) keep their local native material.
  - Minor lists share `SharedSmallGlassPlane` batches with layered masks on the two filter outputs
    (never a root clip: a clipped root becomes a WebView2 backdrop root). Settled scroll-edge morph
    in Canvas Browser, Extensions, Quick Extensions and Settings.
  - Presence (fade/slide/scale/lift, material vs content fade) runs through
    `createPresenceMotion`; glass never fades through ancestor opacity.
- Database entry: unlock step for the last database at startup, recent list via "Change database",
  iPhone-style unlock reveal and reverse lock animation (`workspaceIntro.ts`), Caps Lock indicator,
  own password reveal toggle, WebView2 autofill/password saving off.
- Sleep mode hides toolbars/window controls and closes the side panel after a configurable delay.
- Settings → Visual → Interface: per-device corner radii and the sleep delay.
- Dedicated release benchmarks remain deferred by user direction (subjective acceptance only).

## Verified status (2026-10-04)

- `npm run check` passes: 232 test files / 1,513 tests, typecheck, lint, formatting, architecture,
  production build, production-exclusion/security checks.
- Phase 5 elements verified live in the dev app with trusted input (`npm run app:dev:devtools` +
  `scripts/drive-dev-window.mjs`): computed-style parity against the pre-migration components in
  idle/hover/gesture states, mid-drag positions, and screenshot diffs showing no shimmer while
  dragging, no 1px shift on drop, and sharp redraws after zooming.
- Development hot updates keep the database unlocked (the session owner is renderer-global).
- Phase 6 extension contributions verified live the same way: computed-style parity of headers,
  menus and the search row, and lock, search, privacy, Copy/Paste JSON, install and removal flows.

## Immediate next task / handoff

1. Installer bootstrapper (ADR 007, started early by user direction): `installer/` crate +
   `src/installer/` UI; dev run `npm run installer:dev` simulates installing (no payload). Not yet
   done: a real `npm run installer:build` validated on a clean machine (never run a real install
   over the user's installed stable TaskMap), code signing, WebView2 fallback, uninstaller UI.
2. Phase 7, Workflow Runner (ADR 009: a text-card extension, structured steps, per-device trust).
   First slice done: `src-tauri/src/workflow/` launches structured steps without a shell, tracks them
   in jobs and keeps per-device trust; `src/extensions/workflow/` has the definition, editor
   (a floating window: typed command lines parsed by `commandLine.ts`, folder picker), run/stop button
   (a leading card adornment), run store and trust review. Next: keeping a terminal open after
   exit, and output capture, if wanted.
3. Phase 6 extensions, for reference: contribution points in `src/extensions/` (header controls,
   header rows, card adornments, menu items, content states; ADR 008), rules in
   `lock/lockRule.ts` and `search/searchRule.ts`, Copy/Paste JSON's flow in
   `copy-paste-json/useCopyPasteJsonFlow.tsx`, and the definitions in `architectureRegistry.ts` as
   the one registry (`extensionCatalog.ts` derives the Extensions panel from them). `App.tsx`
   requires the retained canvas runtime and has no local-state fallbacks.
   Phase 6 leftovers, not blocking: elements still receive installed extensions in their view
   state from the retained projection (what the contribution points need). The `ExtensionCommands`
   port is built by `src/legacy/useRetainedExtensionCommands.ts`, which reads the selection from
   the interaction controller when a command runs.
   Phase 5 leftovers, not blocking: element registration in `src/elements/registry.ts` waits until
   rendering dispatches through the registry. Presentation state is moving out of `App.tsx` into
   `src/legacy/` hooks: in-place editing (`useRetainedInlineEdit`), enter/delete/pulse marks
   (`useElementPresenceMarks`), context menus (`useClosingMenu`), extension commands, the left
   side panel (`useLeftPanel`), toasts (`src/components/useToastQueue.ts`) and keyboard shortcuts
   (`useCanvasShortcuts`), the clipboard (`useRetainedClipboard`), menus and their openers
   (`useCanvasMenus`), image picking/drops/paste (`useRetainedImageImport`), connection drawing
   (`useConnectionDrawing`), new-element builders (`newCanvasElements.ts`) and creating elements from
   the menus (`useCanvasElementCreation`) are done, with the
   extension drop hit test in `extensionDropTarget.ts`. Rendering moved to `RetainedCanvasMenus`,
   `RetainedContainerLayer`/`RetainedElementLayers` (sharing `retainedElementPresentation.ts`) and
   `RetainedCanvasOverlays`. Pointer gestures live in `useCanvasGestures` (routing, pan, box
   selection, wheel) and `canvasElementGestures.ts` (moves, resizes, card drags), container card
   rows in `containerCardLayout.ts`, and creating, switching and Ctrl+Tab cycling canvases in
   `useCanvasManagement`, and measured card sizes, connection bounds and drop-ripple clipping in
   `canvasElementBounds.ts`. The Settings dialog, update prompt and settings error banner render
   through `RetainedSettingsDialog`; the side panel, minimap, toolbar and quick extensions menu
   through `RetainedWorkspaceChrome` (minimap timing in `useMinimapPresence`), and snap guides
   through `CanvasSnapGuides`. Still in `App.tsx`: the canvas stage markup and the element
   derivations and action wiring it feeds. Text cards and mind-map nodes place with `translate` like the
   other elements.
4. Not yet wired by design: `src/elements/registry.ts` (no element definitions). Unused
   future plumbing (typed Redux hooks, media/workflow client interfaces) was deleted; recreate it
   when its phase needs it.

## Legacy app protection

The legacy TaskMap from `main` (identity `com.taskmap.prototype`, product name "TaskMap", 0.3.x)
holds the user's real data and must keep working:

- Run the new architecture as **TaskMap Beta** (development identity `com.merkdesigns.taskmap.dev`,
  `npm run installer:build -- --beta` → `TaskMap_Beta_Installer.exe`); it shares nothing with the
  legacy app. Beta databases are development-purpose and the stable edition rejects them.
- The stable installer refuses to replace an installed "TaskMap" below 1.0.0 (the legacy app).
- No new-architecture GitHub release before the legacy migrator (Phase 9): the legacy updater would
  install it. `release.yml` fails on purpose until then; the first stable release is 1.0.0+.

## Remaining gates

- Phase 6 extensions, Phase 7 Workflow Runner, Phase 8 remaining features, Phase 9 migrator.
- Packaged stable/dev coexistence was approved with 4.5G by user direction; run the packaged check
  before the first release that ships both editions.

Current authority: `UI-SYSTEM-CONTRACT.md`, `GLASS-SYSTEM-CONTRACT.md`,
`UI-QUALITY-GUARDRAILS.md`, and validation gates in `TESTING.md`.
