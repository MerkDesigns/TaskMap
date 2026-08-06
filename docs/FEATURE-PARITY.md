# Feature Parity Checklist

The refactor preserves the user-facing appearance and behavior of every retained feature unless this document explicitly approves a change. Internal implementation parity is not required.

Before porting a feature, attach screenshots or short recordings from the legacy application and document exact input behavior.

## Status values

- `Not documented`
- `Documented`
- `In progress`
- `Implemented`
- `Accepted`
- `Removed by decision`

## Application shell and navigation

| Feature | Decision | Required behavior | Status |
|---|---|---|---|
| Main window layout | Keep | Preserve current layout and visual identity | Not documented |
| Canvas manager | Keep | Preserve current canvas selection and management workflow | Not documented |
| Settings | Keep and rewire | Preserve retained settings; remove obsolete feature settings | Not documented |
| Recent databases | New | Select default, recent, or existing `.tmapdb` | Not documented |
| Stable/dev coexistence | New | Both editions run simultaneously with isolated data | Not documented |
| Tray session | New | Close, reopen, lock, and quit behave per security spec | Not documented |
| Discord Rich Presence | Remove | No code, settings, schema, or UI remains | Removed by decision |
| Automatic updater | Keep | Preserve normal update workflow; implement after core | Not documented |

## Canvas

| Feature | Decision | Required behavior | Status |
|---|---|---|---|
| Multiple canvases | Keep | Preserve creation, switching, editing, deletion, and previews | Not documented |
| Pan and zoom | Keep | Preserve feel, limits, centering, and shortcuts | Not documented |
| Selection rectangle | Keep | Preserve additive and multi-selection behavior | Not documented |
| Move and resize | Keep | Preserve interaction feel and constraints | Not documented |
| Snapping and guides | Keep | Preserve activation, guide appearance, and placement results | Not documented |
| Layers | Keep | Preserve send back/backward/forward/front behavior | Not documented |
| Minimap | Keep and rewire | Preserve appearance and useful navigation behavior | Not documented |
| Grid styles | Keep | Preserve retained grid appearance and settings | Not documented |
| Shadows | Keep | Preserve retained visual setting | Not documented |
| Undo and redo | Keep and redesign | Equivalent user-visible results using transaction history | Not documented |

## Elements

| Feature | Decision | Required behavior | Status |
|---|---|---|---|
| Containers | Keep | Preserve rendering, header, card content, scrolling, resizing, and menus | Not documented |
| Text cards | Keep | Preserve inline editing, links, drag behavior, contained/loose states, and menus | Not documented |
| Text blocks | Keep | Preserve editing, resizing, titles, colors, and menus | Not documented |
| Images | Keep | Preserve import, display, move, resize, background option, and menus | Not documented |
| GIF playback | Keep | Visible GIFs animate without blocking interaction | Not documented |
| Mind-map nodes | Keep and redesign internally | Preserve current user workflow and appearance | Not documented |
| Mind-map connections | Keep and redesign internally | Preserve creation, ports, deletion, and rendering | Not documented |

## Extensions

| Extension | Decision | Required behavior | Status |
|---|---|---|---|
| Lock | Keep | Preserve move/resize protection and deletion preference | Not documented |
| Checkbox | Keep | Preserve check state and control appearance | Not documented |
| Search | Keep | Preserve container filtering behavior and UI | Not documented |
| Privacy | Keep | Preserve current blur/hide behavior | Not documented |
| Color picker/tools | Keep | Preserve retained color controls and recent colors | Not documented |
| AI JSON copy/paste | Keep | Preserve copy, paste, editor, validation, and visible results | Not documented |
| Daily reset | Remove | No code, schema, or menu contribution remains | Removed by decision |
| Sorting | Remove | No code, schema, or menu contribution remains | Removed by decision |
| Pick-a-card | Remove | No code, schema, or menu contribution remains | Removed by decision |

## Workflow Runner

| Feature | Decision | Required behavior | Status |
|---|---|---|---|
| Start development tools | Preserve purpose | Represent through structured executable and arguments | Not documented |
| Working directory | Keep | Per-step working directory | Not documented |
| Sequential execution | Keep | Explicit sequence groups | Not documented |
| Parallel execution | Keep | Explicit parallel groups | Not documented |
| Visible terminal | Keep | Launch visibly when configured | Not documented |
| Background process | Keep with restrictions | No hidden elevation; logs and ownership tracking | Not documented |
| Stop launched process | Keep and redesign | Stop only TaskMap-owned processes | Not documented |
| Raw shell string | Remove | Not supported in first version | Removed by decision |
| Administrator elevation | Remove | Not supported | Removed by decision |

## Visual system

| Feature | Decision | Required behavior | Status |
|---|---|---|---|
| Existing frosted-glass appearance | Keep | Centralize current effect without visual redesign | Not documented |
| Frosted-glass tuner | Remove | No production or development tuner remains | Removed by decision |
| Menus and modals | Keep | Preserve current appearance, motion, and placement where retained | Not documented |
| Element animations | Keep | Preserve useful entry, delete, drag, and settle behavior | Not documented |
| Toasts and feedback | Keep | Preserve clear operation and error feedback | Not documented |

## Persistence and configuration

| Feature | Decision | Required behavior | Status |
|---|---|---|---|
| User-selected database | New | Create default or chosen `.tmapdb` | Not documented |
| Password encryption | New | Password required; background session remembers derived key | Not documented |
| Explicit lock | New | Purge key and decrypted state | Not documented |
| Autosave | Keep and redesign | Non-blocking debounced save | Not documented |
| Backups | New | Five rotating consistent database backups | Not documented |
| Config export/import | New | Export/import app preferences without secrets | Not documented |
| Legacy import in app | Remove | Main app rejects old format and points to migrator | Removed by decision |
| Old import/export workflow | Remove | Database and config replace it | Removed by decision |

## Acceptance procedure

For each retained feature:

1. Record the legacy appearance and interaction.
2. Describe input, output, edge cases, history behavior, and persistence behavior.
3. Implement through the new module contract.
4. Add automated domain and integration tests.
5. Compare visually and behaviorally against evidence.
6. Mark `Accepted` only after direct manual verification.

Compilation or unit tests alone are insufficient for parity acceptance.