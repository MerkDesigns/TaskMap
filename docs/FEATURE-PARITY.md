# Feature Parity Checklist

The refactor preserves retained user-facing behavior unless a newer accepted contract explicitly
approves a change. Internal implementation parity is not required.

Before porting a feature, use existing evidence or capture the relevant interaction where necessary.

## Status values

- `Not documented`
- `Documented`
- `In progress`
- `Implemented`
- `Accepted`
- `Removed by decision`

## Application shell and navigation

| Feature                | Decision        | Required behavior                                                        | Status                           |
| ---------------------- | --------------- | ------------------------------------------------------------------------ | -------------------------------- |
| Main window layout     | Keep            | Preserve product workflow while allowing the approved UI-system redesign | In progress                      |
| Canvas manager         | Keep            | Preserve canvas selection and management workflow                        | In progress                      |
| Settings               | Keep and rewire | Preserve retained settings; remove obsolete settings                     | In progress                      |
| Recent databases       | New             | Select default, recent, or existing `.tmapdb`                            | Implemented                      |
| Stable/dev coexistence | New             | Both editions run simultaneously with isolated data                      | Packaged/live acceptance pending |
| Tray session           | New             | Close, reopen, lock, and quit follow the session/security contract       | Implemented                      |
| Discord Rich Presence  | Remove          | No code, settings, schema, or UI remains                                 | Removed by decision              |
| Automatic updater      | Keep            | Preserve normal update workflow                                          | Not documented                   |

## Canvas

| Feature             | Decision                     | Required behavior                                                    | Status                               |
| ------------------- | ---------------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| Multiple canvases   | Keep                         | Preserve creation, switching, editing, deletion and previews         | Implemented; final UI polish pending |
| Pan and zoom        | Keep                         | Middle/Ctrl-left pan; 0.5–2.5 anchored wheel zoom; centered reset    | Accepted                             |
| Selection rectangle | Keep                         | Shift adds; retained intersection/clear/lock rules                   | Accepted                             |
| Move and resize     | Keep                         | Preview-only frames; one persistent completion; retained constraints | Accepted                             |
| Snapping and guides | Keep                         | Retained Shift/snapping behavior                                     | Accepted                             |
| Layers              | Keep                         | Preserve retained layer operations and drag behavior                 | Accepted                             |
| Minimap             | Keep and rewire              | Preserve projection/reset workflow under the new UI system           | UI/glass acceptance pending          |
| Grid styles         | Keep                         | Preserve retained grid choices/settings                              | Implemented                          |
| Shadows             | Keep                         | Preserve retained setting semantics                                  | Implemented                          |
| Undo and redo       | Keep and redesign internally | Equivalent visible results through transaction history               | Implemented                          |

## Elements

| Feature              | Decision                     | Required behavior                                                                   | Status                                                            |
| -------------------- | ---------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Containers           | Keep                         | Preserve rendering, header, child content, scrolling, resizing and menus            | Retained presentation; Phase 5 ownership migration pending        |
| Text cards           | Keep                         | Preserve editing, links, bundle pickup, insertion/reparent/detach, settle and menus | Retained behavior accepted; Phase 5 ownership migration pending   |
| Text blocks          | Keep                         | Preserve editing, resizing, titles, colors and menus                                | Retained presentation; Phase 5 ownership migration pending        |
| Images               | Keep                         | Preserve import, display, move, resize, background option and menus                 | Database/media integration accepted; Phase 5 presentation pending |
| GIF playback         | Keep                         | Visible GIFs animate without blocking interaction                                   | Accepted for database/media integration                           |
| Mind-map nodes       | Keep and redesign internally | Preserve user workflow and visible semantics                                        | Phase 5 ownership migration pending                               |
| Mind-map connections | Keep and redesign internally | Preserve creation, ports, deletion and rendering                                    | Phase 5 ownership migration pending                               |

## Extensions

| Extension          | Decision | Required behavior                                       | Status                           |
| ------------------ | -------- | ------------------------------------------------------- | -------------------------------- |
| Lock               | Keep     | Preserve move/resize protection and deletion preference | Retained integration accepted    |
| Checkbox           | Keep     | Preserve check state/control behavior                   | Retained integration accepted    |
| Search             | Keep     | Preserve container filtering behavior/UI                | Retained integration accepted    |
| Privacy            | Keep     | Preserve capture/privacy behavior                       | Accepted for current integration |
| Color picker/tools | Keep     | Preserve retained color controls/recent colors          | Retained integration accepted    |
| AI JSON copy/paste | Keep     | Preserve copy/paste/editor/validation/visible results   | Retained integration accepted    |
| Daily reset        | Remove   | No code/schema/menu contribution remains                | Removed by decision              |
| Sorting            | Remove   | No code/schema/menu contribution remains                | Removed by decision              |
| Pick-a-card        | Remove   | No code/schema/menu contribution remains                | Removed by decision              |

## Workflow Runner

| Feature                 | Decision               | Required behavior                      | Status              |
| ----------------------- | ---------------------- | -------------------------------------- | ------------------- |
| Start development tools | Preserve purpose       | Structured executable + arguments      | Not documented      |
| Working directory       | Keep                   | Per-step working directory             | Not documented      |
| Sequential execution    | Keep                   | Explicit sequence groups               | Not documented      |
| Parallel execution      | Keep                   | Explicit parallel groups               | Not documented      |
| Visible terminal        | Keep                   | Launch visibly when configured         | Not documented      |
| Background process      | Keep with restrictions | No hidden elevation; tracked ownership | Not documented      |
| Stop launched process   | Keep and redesign      | Stop only TaskMap-owned processes      | Not documented      |
| Raw shell string        | Remove                 | Not supported in first version         | Removed by decision |
| Administrator elevation | Remove                 | Not supported                          | Removed by decision |

## Final UI and glass system

The current UI/material authority is:

- `docs/UI-SYSTEM-CONTRACT.md`
- `docs/GLASS-SYSTEM-CONTRACT.md`
- `docs/UI-QUALITY-GUARDRAILS.md`

These contracts intentionally supersede conflicting visual/presence/list/material rules from older
UI/glass plans.

| Feature                                        | Decision                                     | Required behavior                                                                                               | Status              |
| ---------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------- |
| Final UI/glass system                          | Redesign approved                            | Follow the current UI/glass/quality contracts while preserving non-superseded workflows                         | Phase 4.5 active    |
| Historical frosted/native-glass implementation | Superseded as design authority               | Keep only as implementation/history evidence until obsolete code is removed                                     | Historical          |
| Production visual tuner                        | Remove                                       | No material/visual tuner ships as product UI                                                                    | Removed by decision |
| Development UI-Lab tuning                      | Development tooling                          | Live development-only material/motion tuning shared between UI Lab and real App; never document data/product UI | Phase 4.5 planned   |
| Menus/modals/dialogs                           | Keep workflow; redesign presentation allowed | Preserve semantics/workflow while using current surface/material/layout contracts                               | Phase 4.5 active    |
| Scrollable glass lists                         | Intentional redesign                         | Settled material can shrink at viewport edge; content remains unscaled/rounded-masked; held item stays full     | Phase 4.5 planned   |
| Glass presence/motion                          | Intentional redesign                         | Composable Fade/Material Fade/Slide/Lift/Scale/Geometry Morph; no ancestor-opacity glass fade                   | Phase 4.5 planned   |
| Element animations                             | Keep concept                                 | Preserve useful entry/delete/drag/settle behavior through the final motion system                               | Phase 4.5/5         |
| Toasts and feedback                            | Keep                                         | Preserve clear operation/error feedback                                                                         | Not documented      |

## Persistence and configuration

| Feature                      | Decision          | Required behavior                                               | Status               |
| ---------------------------- | ----------------- | --------------------------------------------------------------- | -------------------- |
| User-selected database       | New               | Create/open chosen `.tmapdb`                                    | Implemented          |
| Password encryption          | New               | Password required; unlocked process retains derived session key | Implemented          |
| Explicit lock                | New               | Purge sensitive session/workspace state                         | Implemented          |
| Windows session lock         | New               | Revoke/purge according to security contract                     | Accepted             |
| Configurable inactivity lock | Deferred          | Not required for current database activation                    | Deferred by decision |
| Autosave                     | Keep and redesign | Non-blocking revision-aware deferred save                       | Implemented          |
| Backups/recovery             | New               | Preserve current generation/full-backup behavior                | Implemented          |
| Config export/import         | New               | Export/import app preferences without secrets                   | Later product work   |
| Legacy import in app         | Remove            | Main app does not convert old format                            | Removed by decision  |
| Old import/export workflow   | Remove            | Database/config workflows replace it                            | Removed by decision  |

## Database integration evidence

The product route uses the encrypted database runtime and normalized workspace/command/history/
persistence system.

Recorded native/user acceptance covers create/open/unlock, wrong-password rejection, save/restart,
explicit lock, save-failure retry, generation recovery, full-backup restore, image/GIF import and
reload, Windows lock, screenshot privacy, window reopen behavior and the requested retained-feature
round trip.

This does not imply Phase 5 renderer ownership migration is complete.

Remaining database/release gate:

- packaged/live stable + development coexistence validation.

## Acceptance procedure

For a retained feature:

1. identify the relevant retained behavior;
2. define intentional changes from current subsystem contracts;
3. implement through the current ownership boundary;
4. add appropriate automated tests;
5. validate real UI/interaction where automated tests cannot prove it;
6. mark accepted only after the applicable direct/manual gate.

Compilation alone is not visual, performance or parity acceptance.

Final UI/material acceptance uses the current UI/glass contracts, not removed historical visual docs.
