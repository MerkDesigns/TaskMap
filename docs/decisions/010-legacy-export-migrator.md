# ADR 010: One-time legacy migrator from the 0.3 export file

- Status: Accepted
- Date: 2026-10-08

## Context

The legacy TaskMap (0.3, `main`) keeps its data in a local SQLite database whose JSON values are
encrypted with a key held in Windows Credential Manager. It can also export everything, images
included, into a `.tmap` file protected by a password the user chooses. The new architecture opens
only its own `.tmapdb` databases and, by contract, contains no legacy data handling. Only one person
has legacy data, and they migrate once.

## Decision

**Input is the export file.** The migrator reads a `.tmap` export and its password, never the legacy
database or Credential Manager, so it cannot affect the legacy app's data. The legacy app migrates
its data to its schema version 2 before every export, so only that version is converted.

**A separate developer tool, not a product feature.** It lives in `tools/legacy-migrator/` and runs
with `npm run migrate-legacy`; nothing ships in the app or the installer.

**Conversion in TypeScript, validated by the app.** `convertLegacyExport.ts` maps the legacy data to
a `TaskMapDocument` and checks it with the app's own `validateTaskMapDocument` and canvas projection
(the same acceptance an unlock applies), so a document the app would refuse is never written.
Legacy extensions keep their settings; the Command Runner's commands become workflow lines through
the workflow editor's command-line parser, and run like any other workflow (trusted on first run).
What cannot come across (removed features, shell-only commands, device preferences, per-canvas
camera) is listed in a report rather than dropped silently.

**The database is written by the app's own Rust code.** `tools/legacy-migrator/writer` compiles in
`src-tauri`'s crypto, schema, document repository and limits modules, mirrors the app's database
creation, stores the media under the ids the document references, and then reads the database back
the way unlocking does before reporting success. No key derivation or encryption is reimplemented.

The tool asks whether TaskMap Beta (development purpose) or a stable release (production purpose)
will open the result, because each edition only opens its own databases.

## Consequences

- Phase 9 needs no migrator inside the product, the installer or the release flow.
- The writer must be rebuilt (it is, by the npm script) whenever the shared Rust modules change; a
  module that starts to depend on Tauri or other app state would stop it compiling, which is the
  intended signal.
- The tool can be deleted once the migration is done.
