# TaskMap Development Workflow

## Purpose

This is the operational workflow for human and AI-assisted work in this repository.

It tells a new contributor or session what to read, how to resolve documentation conflicts and how
to land changes cleanly, without requiring old chat history.

## Authority model

Authority is **scope-based**, not a single naive global ranking.

### Global rules

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. accepted current ADRs under `docs/decisions/`

### Subsystem contracts

Inside their scope, an accepted subsystem contract is authoritative:

- `docs/UI-SYSTEM-CONTRACT.md` — public UI architecture
- `docs/GLASS-SYSTEM-CONTRACT.md` — glass/material behavior and proof/acceptance
- `docs/UI-QUALITY-GUARDRAILS.md` — UI quality/reuse/hit-target rules
- `docs/SECURITY.md` — security
- `docs/DATA-FORMAT.md` — persistent data format

A current subsystem contract may intentionally supersede older feature-parity visuals or historical
implementation plans. That supersession must be explicit.

### Planning/status documents

- `docs/REFACTOR-ROADMAP.md` — sequence and phase gates; it does not redefine subsystem design.
- `docs/FEATURE-PARITY.md` — retained behavior unless intentionally superseded.
- `docs/FEATURE-WIRING.md` — implementation wiring guidance.
- `docs/TESTING.md` — validation strategy/gates.
- `docs/REFACTOR-STATE.md` — concise current snapshot only.
- `CHANGELOG.md` — user-visible changes, newest first.
- `ARCHITECTURE.md` → "Repository structure" — where things live.

### Historical material

A document explicitly marked superseded/historical has no normative authority.

Git history, pull requests and the frozen `docs/archive/WORK-LOG.md` (history up to 2026-10-01)
preserve old implementation context; old temporary plans do not stay authoritative merely because
they remain readable.

## Session startup

Before recommending or changing substantial work:

1. confirm branch/HEAD when repository access exists;
2. read `AGENTS.md`;
3. read `docs/REFACTOR-STATE.md`;
4. read the active roadmap section;
5. read the relevant subsystem contract(s);
6. inspect the actual current implementation/diff;
7. reconcile code vs intended contract explicitly.

Do not infer current implementation solely from old chat context.

## Work loop

### 1. Select one outcome

Tie work to:

- the active roadmap gate;
- a blocker to that gate;
- a local correction to already-migrated work;
- an explicit user side task.

Avoid opening unrelated migration fronts.

### 2. Establish the contract

Identify:

- owner/subsystem;
- behavior that must remain;
- intentional policy changes;
- performance/security/material constraints;
- proof/acceptance needed.

If the contract is unclear, resolve it before implementation.

### 3. Implement the smallest coherent change

Do not use a local task to justify a broad unrelated rewrite.

Side improvements are acceptable when they simplify the touched subsystem without creating a second
architecture.

### 4. Review the actual diff

Inspect what changed rather than trusting an implementation summary.

Check:

- ownership;
- dependency direction;
- duplicated infrastructure;
- contract compliance;
- stale compatibility paths;
- new follow-up issues.

### 5. Validate

Use focused validation while iterating, then the full gate required by `docs/TESTING.md`.

For UI/glass work, automated tests do not replace live WebView2 visual acceptance.

### 6. Commit and document

- Commit each coherent change separately; do not batch unrelated work into one commit.
- Commit message: an imperative summary line (≤ 72 characters, no phase codes), a blank line, then
  what changed and why, including measurements or failed approaches worth keeping.
- Larger slices go through a pull request whose description records context, verification and
  follow-ups.
- Add user-visible changes to `CHANGELOG.md` under "Unreleased".
- Refresh `REFACTOR-STATE.md` when phase/gate status, ownership or the next task changes.

Update other docs only when their responsibility actually changed.

Do not bulk-edit normative docs to rationalize an implementation accident.

## History vs current truth

### Git history and pull requests

The durable record of attempts, measurements, failures, reversions and why a decision changed.
Write commit messages and PR descriptions for a reader who has no chat context.

### `REFACTOR-STATE.md`

Short current snapshot:

- branch/HEAD;
- current phase/gate;
- current ownership boundary;
- blockers;
- immediate next task.

Do not accumulate old completed history here.

## Performance/debugging

Distinguish:

- interaction-controller cost;
- React/render cost;
- material/compositor/GPU cost;
- browser/WebView2 behavior;
- persistence/history/database work;
- development-build overhead.

Record the exact environment/workload with performance claims.

Do not degrade accepted visual quality based on an unisolated hypothesis.

## End-of-task check

A finished task should answer from the repository:

- what phase/gate are we in?
- what changed (see the commits)?
- what was verified?
- what remains?
- which contract governs it?
- what is the next smallest task?

If that cannot be answered from current docs, documentation maintenance is incomplete.

## New-chat bootstrap

> Read `AGENTS.md`, `docs/AI-WORKFLOW.md`, `docs/REFACTOR-STATE.md`, the active roadmap section and
> the relevant subsystem contract before recommending or changing anything.
