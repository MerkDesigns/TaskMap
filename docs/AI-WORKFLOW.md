# TaskMap Refactor Session Workflow

## Purpose

This document defines the repeatable workflow for AI-assisted work on the `architecture-v1` refactor.

It exists so a new ChatGPT/Codex session does not need the project history explained from memory. It is an operational guide only. It does not replace the architecture, roadmap, ADRs, parity contract, or testing contract.

## Authority order

When documents disagree, use this order to determine intent:

1. `AGENTS.md` — mandatory repository and agent rules.
2. `ARCHITECTURE.md` — normative target architecture.
3. `docs/decisions/*.md` — accepted foundational decisions and exceptions.
4. `docs/REFACTOR-ROADMAP.md` — migration order, phase boundaries, and phase exit criteria.
5. `docs/FEATURE-PARITY.md` — retained/removed behavior and parity requirements.
6. Specialized normative docs for the subsystem being changed:
   - `docs/VISUAL-SYSTEM.md`
   - `docs/UI-SYSTEM.md`
   - `docs/FEATURE-WIRING.md`
   - `docs/TESTING.md`
   - `docs/DATA-FORMAT.md`
   - `docs/SECURITY.md`
7. `docs/REFACTOR-STATE.md` — concise current implementation/status snapshot.
8. `docs/WORK-LOG.md` — chronological working context, experiments, problems, and follow-ups.
9. `docs/CODEMAP.md` — generated/current structural map of the codebase.

`REFACTOR-STATE.md` and `WORK-LOG.md` may describe what currently exists, but they must never silently override a normative document.

If implementation and documentation disagree:
- code and tests establish what is actually implemented;
- normative docs establish what is intended;
- record the discrepancy explicitly and resolve it instead of guessing.

## Session startup protocol

Before answering questions such as "what should we do next?", proposing a refactor task, or preparing an implementation prompt:

1. Confirm the active branch/commit when repository access is available.
2. Read:
   - `AGENTS.md`
   - `docs/REFACTOR-STATE.md`
   - the current section of `docs/REFACTOR-ROADMAP.md`
3. Read the relevant architecture/ADR/specialized docs for the subsystem being discussed.
4. Inspect the relevant implementation or the latest commit/diff. Do not infer current implementation only from old chat context.
5. Reconcile code with the docs.
6. State the current phase/slice before recommending work.
7. Recommend the smallest next task that advances the current roadmap gate unless the user explicitly chooses a side task.

Do not use conversation memory as the source of truth when repository documentation or code can answer the question.

## Work loop

### 1. Select one task

Tie the task to one of:
- a current roadmap checklist item;
- a blocker preventing the current phase from closing;
- a local correction/refinement to already migrated work;
- a user-requested side task that does not violate the roadmap.

Avoid opening several unrelated migration fronts at once.

### 2. Establish constraints

Before implementation:
- identify the ownership boundary that must remain unchanged;
- identify behavior/parity that must be preserved;
- identify the relevant performance/security/material constraints;
- identify whether the task is migration, cleanup, bug fix, experiment, or design refinement.

Do not jump into a later phase merely because its target architecture looks cleaner.

### 3. Implement

Implementation may be done by the user, Codex, ChatGPT, or another agent.

Prefer the smallest coherent change. Do not use a local task as an excuse for an unrelated rewrite.

Side improvements are allowed when they:
- make the touched subsystem simpler or more modular;
- stay within the current architecture contract;
- do not silently move ownership ahead of the roadmap;
- do not create a second competing abstraction.

### 4. Review the actual result

After implementation, inspect the real diff/commit instead of relying on the implementation report.

Check:
- what files actually changed;
- whether behavior/ownership remained within the intended slice;
- whether new coupling or duplicated infrastructure was introduced;
- whether the roadmap task is actually complete;
- whether follow-up issues were discovered.

### 5. Validate

Run only the validation appropriate to the task during iteration, then satisfy the required phase gates before declaring the slice/phase complete.

Compilation alone is not parity acceptance.

Manual visual/interaction checks should be recorded when they are part of acceptance.

### 6. Update documentation

Documentation is part of the task's definition of done.

After a completed or materially changed task:

**Always**
- append a concise entry to `docs/WORK-LOG.md`;
- refresh `docs/REFACTOR-STATE.md`.

**When applicable**
- `docs/REFACTOR-ROADMAP.md` — only when a roadmap checkbox/gate is actually completed, deferred, split, or intentionally changed;
- `docs/CODEMAP.md` — when files/subsystems/responsibilities move or are added;
- `docs/FEATURE-PARITY.md` — when retained behavior is replaced, intentionally changed, accepted, or removed;
- `ARCHITECTURE.md` — only for structural architecture changes;
- `docs/decisions/*.md` — add/update an ADR for foundational trade-offs or changed architecture decisions;
- `docs/VISUAL-SYSTEM.md` / `docs/UI-SYSTEM.md` — when their normative contracts change;
- `docs/TESTING.md` — when acceptance/fixtures/validation requirements change;
- `docs/DATA-FORMAT.md` / `docs/SECURITY.md` — when their contracts change.

Do not bulk-edit normative docs merely to make them match an implementation accident. Resolve the architectural question first.

## Dirty log vs clean state

### `docs/WORK-LOG.md` — dirty/history layer

Use it to preserve useful development context:
- what was attempted;
- problems found;
- failed approaches;
- measurements;
- manual observations;
- why an approach was reverted;
- decisions made during back-and-forth;
- commit hashes;
- known follow-ups.

It is chronological and append-oriented. It may contain hypotheses, but label them as hypotheses.

### `docs/REFACTOR-STATE.md` — clean/current layer

Keep it short and current:
- branch and last audited commit;
- current roadmap phase/slice;
- completed major foundations;
- current migration boundary;
- active blockers;
- immediate next task;
- deferred items that are easy to misunderstand.

When something is completed, remove it from "active blockers" instead of accumulating history here. History belongs in `WORK-LOG.md`.

## Side-task rule

A side task is acceptable when it does not undermine the current migration boundary.

For a side task:
1. determine whether it is local to already migrated code or requires future-phase ownership;
2. keep future-phase ownership changes deferred unless the roadmap is intentionally revised;
3. record significant findings in `WORK-LOG.md`;
4. update `REFACTOR-STATE.md` only if the side task changes current status or blockers;
5. do not mark roadmap progress unless the official acceptance condition was actually advanced.

If a side task reveals that the roadmap itself is wrong, change the roadmap deliberately and document the reason. Do not drift from it silently.

## Performance/debugging rule

Performance work must distinguish:
- interaction-controller cost;
- React/subscription/render cost;
- compositor/material cost;
- browser/WebView2 cost;
- persistence/history work;
- development-build overhead.

Record measurements and the exact test conditions in `WORK-LOG.md`.

Do not degrade accepted visual quality based on an unisolated hypothesis.

## End-of-task response

When a task is finished, the session should be able to answer:

- What roadmap phase/slice are we in?
- What changed?
- What was verified?
- What problems or failed approaches matter later?
- Which docs were updated?
- What is the next smallest roadmap-safe task?

If these cannot be answered from the repository, documentation maintenance is incomplete.

## New-chat bootstrap

A new AI session should be instructed simply:

> Read `AGENTS.md` and `docs/AI-WORKFLOW.md`, then follow the startup protocol before recommending or changing anything on the refactor.

After that, the repository—not old chat memory—should provide the working context.
