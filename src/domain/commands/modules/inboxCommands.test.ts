// @vitest-environment node
import { describe, expect, it } from "vitest";
import { inboxDocumentModule, readDocumentModule } from "../../document-modules/documentModules";
import type { TaskMapDocument } from "../../document/documentTypes";
import type { InboxEntry } from "../../notifications/inboxSchema";
import { createCommandTestDocument, executeTestCommand } from "../commandTestSupport";

const INSTANCE = "extension-instance-00000000-0000-4000-8000-0000000000d1";
const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

const entry = (index: number, firedAt = NOW): InboxEntry => ({
  id: `inbox-entry-00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  kind: "event-alert",
  source: { kind: "event", id: "calendar-event-00000000-0000-4000-8000-0000000000e1" },
  occurrence: "2026-10-21T09:30",
  firedAt,
  read: false,
  snoozedUntil: null,
  missedCount: 0,
});

function succeed(document: TaskMapDocument, type: string, payload: unknown) {
  const result = executeTestCommand(document, { type, payload });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result;
}

const inboxOf = (document: TaskMapDocument) => readDocumentModule(document, inboxDocumentModule);

describe("inbox commands", () => {
  it("records alerts without undo history and remembers which alerts fired", () => {
    const result = succeed(createCommandTestDocument(), "inbox.alerts.record", {
      instanceId: INSTANCE,
      entries: [entry(1)],
      fired: { "event:a:2026-10-21T09:30:15minute": NOW },
      scannedThrough: NOW,
      now: NOW,
    });
    expect(result.transaction).toBeNull();
    expect(inboxOf(result.document)).toMatchObject({
      scannedThrough: NOW,
      fired: { "event:a:2026-10-21T09:30:15minute": NOW },
    });
    expect(Object.keys(inboxOf(result.document)!.entries)).toEqual([entry(1).id]);
  });

  it("forgets fired alerts after 30 days and keeps only the newest 200 entries", () => {
    const old = succeed(createCommandTestDocument(), "inbox.alerts.record", {
      instanceId: INSTANCE,
      entries: Array.from({ length: 200 }, (_, index) => entry(index + 1, NOW - DAY + index)),
      fired: { old: NOW - 31 * DAY, recent: NOW - DAY },
      scannedThrough: NOW,
      now: NOW,
    });
    const next = succeed(old.document, "inbox.alerts.record", {
      instanceId: INSTANCE,
      entries: [entry(500)],
      fired: {},
      scannedThrough: NOW + 1,
      now: NOW,
    });
    const inbox = inboxOf(next.document)!;
    expect(Object.keys(inbox.fired)).toEqual(["recent"]);
    expect(Object.keys(inbox.entries)).toHaveLength(200);
    expect(inbox.entries[entry(1).id]).toBeUndefined();
    expect(inbox.entries[entry(500).id]).toBeDefined();
  });

  it("marks read, snoozes, dismisses and clears entries", () => {
    let document = succeed(createCommandTestDocument(), "inbox.alerts.record", {
      instanceId: INSTANCE,
      entries: [entry(1), entry(2), entry(3)],
      fired: {},
      scannedThrough: NOW,
      now: NOW,
    }).document;
    document = succeed(document, "inbox.entries.mark-read", { ids: [entry(1).id] }).document;
    expect(inboxOf(document)!.entries[entry(1).id].read).toBe(true);
    document = succeed(document, "inbox.entry.snooze", {
      id: entry(1).id,
      until: NOW + 600_000,
    }).document;
    expect(inboxOf(document)!.entries[entry(1).id]).toMatchObject({
      read: false,
      snoozedUntil: NOW + 600_000,
    });
    document = succeed(document, "inbox.entries.dismiss", { ids: [entry(2).id] }).document;
    expect(Object.keys(inboxOf(document)!.entries)).toEqual([entry(1).id, entry(3).id]);
    document = succeed(document, "inbox.clear-all", {}).document;
    expect(inboxOf(document)!.entries).toEqual({});
  });
});
