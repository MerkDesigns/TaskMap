// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CalendarEvent, Reminder } from "../../calendar/calendarSchema";
import { calendarDocumentModule, readDocumentModule } from "../../document-modules/documentModules";
import type { TaskMapDocument } from "../../document/documentTypes";
import { asEntityId } from "../../ids/entityIds";
import { createCommandTestDocument, executeTestCommand } from "../commandTestSupport";

const INSTANCE = asEntityId(
  "extension-instance",
  "extension-instance-00000000-0000-4000-8000-0000000000c1",
);
const EVENT_ID = "calendar-event-00000000-0000-4000-8000-0000000000e1";
const REMINDER_ID = "reminder-00000000-0000-4000-8000-0000000000a1";

const event: CalendarEvent = {
  id: EVENT_ID,
  title: "Dentist",
  timing: { kind: "timed", start: "2026-10-21T09:30", end: "2026-10-21T10:15" },
  location: "",
  accent: "#476FA8",
  alerts: [{ amount: 15, unit: "minute" }],
};
const reminder: Reminder = {
  id: REMINDER_ID,
  title: "Pay rent",
  notes: "",
  accent: "#476FA8",
  completed: false,
  due: { date: "2026-11-01", time: null },
  alert: null,
};

function run(document: TaskMapDocument, type: string, payload: unknown) {
  return executeTestCommand(document, { type, payload });
}

function succeed(document: TaskMapDocument, type: string, payload: unknown) {
  const result = run(document, type, payload);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result;
}

describe("calendar commands", () => {
  it("creates the calendar module on first use and records every edit as undoable", () => {
    const created = succeed(createCommandTestDocument(), "calendar.event.create", {
      instanceId: INSTANCE,
      event,
    });
    expect(created.transaction?.label).toBe("Add event");
    expect(created.document.extensionInstallations[INSTANCE]).toMatchObject({
      extensionId: "calendar",
      target: { kind: "document" },
    });
    expect(readDocumentModule(created.document, calendarDocumentModule)?.events[EVENT_ID]).toEqual(
      event,
    );

    const edited = succeed(created.document, "calendar.event.update", {
      event: { ...event, title: "Dentist (moved)" },
    });
    expect(
      readDocumentModule(edited.document, calendarDocumentModule)?.events[EVENT_ID].title,
    ).toBe("Dentist (moved)");
    const deleted = succeed(edited.document, "calendar.event.delete", { eventId: EVENT_ID });
    expect(readDocumentModule(deleted.document, calendarDocumentModule)?.events).toEqual({});
    expect(deleted.transaction).not.toBeNull();
  });

  it("keeps one module record and rejects duplicates, unknown items and invalid timing", () => {
    const { document } = succeed(createCommandTestDocument(), "calendar.event.create", {
      instanceId: INSTANCE,
      event,
    });
    const second = succeed(document, "calendar.reminder.create", {
      instanceId: "extension-instance-00000000-0000-4000-8000-0000000000c2",
      reminder,
    });
    const records = Object.values(second.document.extensionInstallations).filter(
      ({ extensionId }) => extensionId === "calendar",
    );
    expect(records).toHaveLength(1);

    expect(run(document, "calendar.event.create", { instanceId: INSTANCE, event }).ok).toBe(false);
    expect(run(document, "calendar.reminder.update", { reminder }).ok).toBe(false);
    const backwards = {
      ...event,
      timing: { kind: "timed", start: "2026-10-21T10:00", end: "2026-10-21T09:00" },
    };
    expect(run(document, "calendar.event.update", { event: backwards }).ok).toBe(false);
  });

  it("completes and reopens a reminder", () => {
    const { document } = succeed(createCommandTestDocument(), "calendar.reminder.create", {
      instanceId: INSTANCE,
      reminder,
    });
    const done = succeed(document, "calendar.reminder.set-completed", {
      reminderId: REMINDER_ID,
      completed: true,
    });
    expect(
      readDocumentModule(done.document, calendarDocumentModule)?.reminders[REMINDER_ID].completed,
    ).toBe(true);
  });
});
