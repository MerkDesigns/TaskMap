# TaskMap Refactor State

> Current snapshot only. History belongs in Git (commits, pull requests) and `CHANGELOG.md`.

## Branch and phase

- Branch: `architecture-v1`; pushed HEAD `b288950` (global test timeout for large-fixture suites).
  The 4.5H cleanup below is local and uncommitted until pushed.
- **Phase 4.5 (final UI + glass system) is complete.** 4.5A–F accepted earlier; 4.5G acceptance
  approved by the user on 2026-10-01; 4.5H cleanup done on 2026-10-01. One active UI/material
  architecture remains.
- **Next: Phase 5 — element renderer migration**, starting with the Text Card.
- Open PR: MerkDesigns/TaskMap#2 (`architecture-v1` → `main`), kept open for review; the user
  merges nothing into `main` yet.

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

## Verified status (2026-10-01)

- `npm run check` passes after 4.5H: 233 test files / 1,517 tests, typecheck, lint, formatting,
  architecture (539 target files), production build, production-exclusion/security checks.
  `cargo fmt --check` and Rust edition tests pass.
- Live dev app after cleanup: shared Major plane mounted, Canvas Browser Minor batch active with
  output masks (no clip/SVG), glass unchanged visually; workbench App/UI Lab switching works.
- CI: earlier failures on this branch were large-fixture tests hitting vitest's 5 s default on slow
  runners; fixed with a global 20 s `testTimeout`.

## Immediate next task / handoff

1. Commit/push the 4.5H cleanup when the user asks.
2. Start Phase 5 with the Text Card: transfer presentation ownership from retained `App.tsx` to the
   normalized architecture without reopening persistence ownership (see `REFACTOR-ROADMAP.md`).
3. Not yet wired by design (Phase 5–7 plumbing, unreachable today): `src/elements/*`. Unused
   future plumbing (typed Redux hooks, media/workflow client interfaces) was deleted; recreate it
   when its phase needs it.

## Remaining gates

- Phase 5 element renderer migration (Text Card, Container, Text Block, Image/GIF, Mind map).
- Phase 6 extensions, Phase 7 Workflow Runner, Phase 8 remaining features, Phase 9 migrator.
- Packaged stable/dev coexistence was approved with 4.5G by user direction; run the packaged check
  before the first release that ships both editions.

Current authority: `UI-SYSTEM-CONTRACT.md`, `GLASS-SYSTEM-CONTRACT.md`,
`UI-QUALITY-GUARDRAILS.md`, and validation gates in `TESTING.md`.
