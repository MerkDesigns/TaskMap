# TaskMap Refactor Work Log

> Chronological working memory for the refactor.
> This file is intentionally more detailed and less polished than `docs/REFACTOR-STATE.md`.
> It records experiments, problems, measurements, reversions, and decisions that may matter later.
> It is not an authority over `AGENTS.md`, `ARCHITECTURE.md`, ADRs, or `docs/REFACTOR-ROADMAP.md`.

## How to use this log

Append one entry after a meaningful implementation/review cycle.

Useful fields:
- date;
- phase/slice;
- commit(s);
- goal;
- what actually changed;
- manual observations;
- failed/reverted approaches;
- measurements;
- decisions;
- follow-ups;
- documentation changed.

Do not clean old entries into a false success narrative. If an experiment failed, preserve why it failed.

Hypotheses must be labelled as hypotheses until verified.

---

## 2026-08-29 — Documentation workflow bootstrap and state audit

**Branch:** `architecture-v1`  
**Audited HEAD:** `b21fea6069cc031bb0c4700266aed19f98914502` — `Refine Quick Extensions UI`  
**Roadmap position:** Phase 4.5C active

### Why this audit was done

Long refactor conversations were beginning to depend too much on chat memory. The goal was to make the repository itself carry enough current context that a fresh ChatGPT/Codex session can determine:
- where the refactor is;
- what rules are authoritative;
- what was just attempted;
- what remains;
- what documentation must be updated after a task.

### Existing documentation structure confirmed

The repository already has strong authoritative documents, so the workflow should adapt to them instead of creating competing replacements:

- `AGENTS.md` already defines mandatory agent/repository rules.
- `ARCHITECTURE.md` already defines the normative target architecture.
- `docs/REFACTOR-ROADMAP.md` already owns phase ordering and gates.
- `docs/FEATURE-WIRING.md` already includes per-feature documentation/performance/review requirements.
- foundational decisions already live under `docs/decisions/`; a new generic `DECISIONS.md` would duplicate the ADR system.
- `docs/CODEMAP.md` already owns structural mapping.

Decision: add only the missing operational/session layer:
- `docs/AI-WORKFLOW.md` — stable process for AI-assisted sessions;
- `docs/REFACTOR-STATE.md` — clean current snapshot;
- `docs/WORK-LOG.md` — chronological dirty/history layer.

### Roadmap status confirmed

Phases 1–4 have their core implementation accepted according to the roadmap.

Phase 4 intentionally leaves the release-mode rendered FPS checkbox open until the final Phase 4.5 rendering path is accepted.

Current work remains in Phase 4.5:
- 4.5A complete;
- 4.5B core complete with image/GIF fidelity acceptance still open;
- 4.5C active;
- 4.5D cleanup/acceptance still open.

General Phase 5 element ownership migration should not begin accidentally while 4.5 is still open.

### Database clarification

The Phase 2 secure database/session infrastructure exists, but the finished production database-management UI is intentionally later.

The roadmap explicitly places database picker/recent-files product integration in Phase 8. Other production shell items such as tray UX and config import/export are also deferred.

This distinction should be preserved in future explanations so "no database picker UI yet" is not mistaken for "the database refactor disappeared."

### Recent implementation checked

HEAD `b21fea6` modernizes Quick Extensions:
- real acrylic shell;
- shared small/minor glass list plane;
- shared SearchField and Tooltip;
- production extension-card language;
- menu presence handling.

It remains an active 4.5C refinement area rather than a fully accepted slice.

### Quick Extensions issues discovered during refinement

Known follow-ups:
- scroll bounds can cut material geometry/shadows in ways that expose incomplete material/content separation;
- desired extension drag representation has not yet been completed as the compact glass-token interaction;
- keep source cards reusable and avoid turning the drag effect into a generic global morph framework.

### Performance investigation

Manual development-build observations recorded during canvas panning:

- with most side chrome hidden: roughly 360 FPS;
- Canvas Browser visible: roughly 154 FPS;
- Canvas Browser + Shift+E visible: roughly 107 FPS.

Additional isolation:
- a large animated GIF can update beneath translucent glass without causing the same slowdown when the canvas is stationary;
- Major blur-radius changes from approximately 0 to 100 px did not materially change the pan result.

Interpretation:
- evidence does not currently support "blur radius alone is the bottleneck";
- the expensive condition is strongly associated with viewport/canvas movement while more application/material UI is present.

Code inspection identified likely contributors that require proper profiling rather than assumption:
- high-level `App.tsx` subscription/rerender work on viewport changes;
- Canvas Browser receiving/recomputing camera-dependent data;
- transient camera updates touching unrelated legacy orchestration;
- floating/static UI potentially rerendering because the root rerenders;
- WebView2 recomposition of a moving large canvas beneath fixed acrylic.

The current FPS overlay is development-only, so final acceptance must be repeated in an appropriate production-performance build before making visual compromises.

### Workflow decision

From this point forward, a normal task cycle is:

1. read the workflow/state/roadmap;
2. inspect relevant current code;
3. choose one roadmap-safe task;
4. implement;
5. inspect the actual diff/commit;
6. validate;
7. append this log;
8. rewrite `REFACTOR-STATE.md`;
9. update roadmap/CODEMAP/parity/ADR/normative docs only when their actual responsibility changed.

This is now the intended anti-drift loop.

---

## Entry template

## YYYY-MM-DD — Short task name

**Phase/slice:**  
**Commit(s):**  
**Goal:**  

### What changed

### Problems / observations

### Experiments or reverted approaches

### Verification / measurements

### Decision

### Follow-ups

### Documentation updated
