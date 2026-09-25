# ADR 004: Database activation intermission

- Status: Implemented; packaged stable/dev coexistence acceptance pending
- Date: 2026-09-06

## Current implementation status

The production `DatabaseApplication`/session/workspace cutover is active.

The original staged plan and statements that the product composition was still unmounted were true
during implementation but are no longer current status.

Remaining release validation:

- packaged/live stable + development coexistence.

## Context

Phase 2 proved the database/session backend and Phase 3 supplied normalized command/history/
persistence. The project intentionally brought database activation forward before broad Phase 5
renderer migration so the real product could stop depending on the old persistence path.

## Decision

Use one active database/session/workspace/persistence architecture.

Rules:

- one active normalized workspace/document;
- one persistence owner;
- no legacy/new dual writes;
- no old-format conversion inside the main app;
- persistent edits go through named commands;
- pointer/transient interaction remains outside persistent document work;
- media uses the bounded session-owned resource path;
- device/view resources remain separate from document history;
- stable/development identities and resources remain isolated.

Retained presentation adapters may bridge the normalized workspace to legacy visual structures during
renderer migration, but they are not a second persistent model/store.

Legacy conversion remains standalone migrator work.

## Consequences

The database activation work intentionally advanced later roadmap responsibilities without declaring
Phase 5 renderer migration complete.

The final product route now uses the normalized database/runtime architecture.

Historical implementation detail remains available in Git/WORK-LOG rather than in an active
multi-step integration plan.

This ADR does not define the final UI/glass architecture; that is governed by ADR 006 and the current
UI/glass contracts.
