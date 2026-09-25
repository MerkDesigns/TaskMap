# ADR 006: Final UI and Glass Contract Reset

- Status: Accepted design direction; rendering topology pending proof
- Date: 2026-09-24

## Context

TaskMap accumulated several generations of UI/material documentation and implementation:

- legacy frosted presentation;
- cached Canvas2D acrylic compositor experiments;
- native CSS Major/Minor glass;
- UI-system C1/C2/C3 migration plans;
- isolated UI Lab experiments;
- later Surface/Material/Content proposals.

The current native path exposed unresolved correctness problems, including stale backdrop updates,
same-depth glass limitations and unclear logical sampling isolation. At the same time, multiple old
documents still described incompatible behavior as normative.

Continuing implementation without resetting the contract would let future changes optimize for an
obsolete document instead of the intended product.

## Decision

Adopt three current UI contracts:

- `docs/UI-SYSTEM-CONTRACT.md`
- `docs/GLASS-SYSTEM-CONTRACT.md`
- `docs/UI-QUALITY-GUARDRAILS.md`

The public UI model is Surface + Material + Content with optional reusable behaviors/patterns.

Major/Minor glass behavior follows an explicit logical layer model. Same-layer Major isolation,
higher-layer sampling, promoted Minor overlap and continuous backdrop freshness are required results.

The private rendering topology is **not** accepted merely because the current native CSS path exists.
A small WebView2 rendering proof must pass before the final backend topology is committed.

Canonical material recipes remain fixed; animation modulates material presence rather than creating
new material recipes.

Scrollable glass lists will intentionally move away from the old full-shape-plus-flat-clip policy:
settled material silhouettes may vertically shrink at viewport boundaries while ordinary content
remains unscaled and rounded-masked. Held items are exempt and restore toward full geometry.

Motion becomes composable (Fade, Material Fade, Slide, Lift, Scale, Geometry Morph) instead of
component-specific hard-coded presence policies.

The final UI does not maintain a separate reduced-motion behavior architecture. Existing
`prefers-reduced-motion` immediate-settle behavior is intentionally superseded as components migrate.

The development UI Lab becomes a view inside the real database-backed application runtime rather
than a separate application/session entry. It shares the active workspace/material/motion system and
may expose development-only visual tuning/diagnostics.

## Supersession

Within UI/material scope this ADR supersedes conflicting active guidance in:

- `docs/VISUAL-SYSTEM.md`;
- `docs/UI-SYSTEM.md`;
- `docs/ui-architecture/SIMPLE-UI-SYSTEM.md`;
- `docs/ui-architecture/UI-SYSTEM-PART-REFERENCE.md`;
- `docs/GLASS-IMPROVEMENT-PLAN.md`;
- `docs/GLASS-PERFORMANCE-ACCEPTANCE.md`.

ADR 003 remains historical evidence of the cached compositor and later native-CSS decision, but its
implementation-specific production topology does not override this ADR or the new contracts.

## Consequences

- old UI/material documents should be removed after useful current information is extracted;
- the current native CSS implementation is a candidate to evolve, not something that must be
  replaced wholesale;
- same-layer isolation must be proven rather than assumed from logical naming/z-index;
- exact visual constants remain source-owned/tunable instead of duplicated across large docs;
- new UI work must use shared primitives/patterns and quality guardrails;
- the roadmap/testing strategy must be rewritten around proof → implementation → acceptance rather
  than the old compositor migration chronology.
