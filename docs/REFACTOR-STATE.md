# TaskMap Refactor State

> Current snapshot only. History belongs in Git (commits, pull requests) and `CHANGELOG.md`.

## Branch and phase

- Branch: `architecture-v1`, pushed.
- **Phase 4.5 (final UI + glass system) is complete** (approved 2026-10-01).
- **Phase 5 (element renderer migration) is complete**, signed off by the user on 2026-10-03. Every
  canvas element renders from `src/elements/`: Text Card (and mind-map nodes), Container, Text
  Block, Image and mind-map connections, each with its own CSS, reading the normalized element plus
  typed view state, with its menu next to it.
- **Next: Phase 6 — extensions.**
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

## Verified status (2026-10-03)

- `npm run check` passes: 230 test files / 1,514 tests, typecheck, lint, formatting, architecture,
  production build, production-exclusion/security checks.
- Phase 5 elements verified live in the dev app with trusted input (`npm run app:dev:devtools` +
  `scripts/drive-dev-window.mjs`): computed-style parity against the pre-migration components in
  idle/hover/gesture states, mid-drag positions, and screenshot diffs showing no shimmer while
  dragging, no 1px shift on drop, and sharp redraws after zooming.
- Development hot updates keep the database unlocked (the session owner is renderer-global).

## Immediate next task / handoff

1. Installer bootstrapper (ADR 007, started early by user direction): `installer/` crate +
   `src/installer/` UI; dev run `npm run installer:dev` simulates installing (no payload). Not yet
   done: a real `npm run installer:build` validated on a clean machine (never run a real install
   over the user's installed stable TaskMap), code signing, WebView2 fallback, uninstaller UI.
2. Phase 6, extensions (ADR 008: extensions contribute UI through typed contribution points):
   the definitions are registered in `src/extensions/architectureRegistry.ts`. Header controls are
   migrated: Lock, Privacy, Extra colors, Counter and Copy/Paste JSON own their header control in
   their module (`headerControlRegistry.ts`), the container and text-block headers host them through
   `useElementHeaderExtensions`, and commands go through one `ExtensionCommands` port. The
   Checkbox is a text-card adornment (`cardAdornmentRegistry.ts`): it draws its tick box and marks
   the card's text state; the Text Card only hosts adornments. Next: extension menu items, then
   behavior (lock, search, privacy, auto checkboxes, inherit card color, JSON copy/paste) out of
   `App.tsx`.
   Phase 5 leftovers, not blocking: Text Card editing state (draft, editing id) is still in
   `App.tsx`; element registration in `src/elements/registry.ts` waits until rendering dispatches
   through the registry; loose text cards and mind-map nodes still position with left/top rather
   than `placementStyle`.
3. Not yet wired by design: `src/elements/registry.ts` (no element definitions). Unused
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
