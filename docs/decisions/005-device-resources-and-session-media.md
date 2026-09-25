# ADR 005: Device preferences, encrypted camera cache and session media

- Status: Implemented
- Date: 2026-09-12

## Current implementation status

Device preferences, encrypted remembered views and session-bound media resources are integrated into
the product database runtime.

Historical "visible binding pending" wording from the implementation stage is no longer current.

## Context

Some retained data is device/session state rather than document history.

Canvas IDs/coordinates reveal document structure and must not become plaintext portable settings.
Media import/read also needs bounded native/session transport without placing raw bytes in Redux.

## Decision

Use separate resource classes.

### Device preferences

`device-preferences-v1.json` stores a strict allowlist of device-local preferences.

It must not contain document text, canvas identities, local document paths or document snapshots.

### Remembered views

Per-database remembered camera state is encrypted device-local data.

It:

- is bound to the active database/session/edition;
- is not portable document content;
- is not included in ordinary document history;
- updates on settled view changes rather than every pointer frame.

### Session media

Media bytes remain outside Redux and the encrypted document payload.

Use session-authorized bounded imports/reads and opaque media identifiers.

Media transport must enforce:

- session/database authority;
- size/concurrency bounds;
- validation before renderer delivery;
- explicit/revoked lifetime;
- cleanup on lock/session transition.

Native file/drop intake never exposes arbitrary renderer-supplied filesystem paths.

## Consequences

These resources do not change the document schema or create another persistence architecture.

The application owns one preference service, one remembered-view resource and session-bound media
lifetime for the active workspace.

Their implementation must remain independent from the UI/glass renderer.

Historical implementation detail remains in Git/WORK-LOG; the active architecture is summarized in
`ARCHITECTURE.md`.
