# ADR 011: Calendar and notification data as document modules

- Status: Accepted
- Date: 2026-10-19

## Context

TaskMap gains calendar events and reminders with alerts, and a notification inbox that collects
lasting notifications (alerts, updates, workflow results). Events, reminders and inbox entries
are user content, so they belong in the encrypted document. Three constraints shape where and how:

- The decrypted document is strict at schema version 1 and the main app performs no migrations
  (`DATA-FORMAT.md`). A version bump would change the encrypted envelope and need a conversion the
  rules forbid.
- Undo requires every recorded transaction's patches to round-trip exactly (`historyEngine.ts`).
  Changes that are recorded and changes that are not must never touch the same object.
- Closing the window locks the database into the tray (`SECURITY.md`), so most of the time nothing
  can read events when an alert falls due.

## Decision

**Document modules.** Feature data that belongs to the whole document is stored as a built-in
_document module_: an `extensionInstallations` record with `target: { kind: "document" }`, an
`extensionId` naming the module, and the module's data as its strict configuration. Modules are
registered in `src/domain/document-modules/`, separate from the element extension catalog, so they
never appear in the Extensions panel. Acceptance parses each module record with its schema and
rejects unknown or invalid ones; at most one record per module exists (the existing duplicate
installation invariant). A module record is created by the first command that needs it, so a
document that never uses the calendar keeps no record.

**Two modules, split by history.** `calendar` holds events and reminders; only recorded (undoable)
commands change it. `notification-inbox` holds inbox entries, the fired-alert ledger and the scan
watermark; only unrecorded commands change it. The split is what keeps undo exact while alerts fire
between edits. Inbox entries reference their event or reminder and never copy its title.

**Time.** Event and reminder times are floating local wall-clock values (`"2026-10-19"`,
`"2026-10-19T09:30"`), not instants, so an event stays at 09:30 when the clocks change. Conversion
to instants happens only through a `ZoneResolver` port. The inbox stores epoch-millisecond instants
for when alerts fired; this is a deliberate exception to "no document timestamps", limited to
notification bookkeeping.

**Budget.** The document's JSON node limit applies to the whole document. The calendar is capped
(1,000 events, 1,000 reminders, bounded text), the inbox at 200 entries and its ledger is pruned
after 30 days, so the modules stay within a fixed share of the budget.

**Notifications stay in the app.** Alerts appear only in the in-app notification inbox while the
database is unlocked; TaskMap shows no Windows notifications. Alerts that fall due while the
database is locked are caught up after unlocking, from the document alone, so nothing about the
calendar is kept outside the encrypted database. Windows notifications, and any alert while
locked, need their own decision on what may leave the database and how it is shown.

## Consequences

- Builds without module support reject documents that contain module records. Module support ships
  before any build that writes calendar data, and records are created only on first use.
- A future first-class document field (schema version 2) remains possible; it would need its own
  decision and a standalone conversion, as for legacy data (ADR 010).
- A reminder due while TaskMap is locked or closed is noticed only after the next unlock.
