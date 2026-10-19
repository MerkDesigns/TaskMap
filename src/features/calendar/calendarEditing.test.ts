import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CalendarEdit } from "../../app/commands/retainedCalendarCallbacks";
import type { CalendarModule } from "../../domain/calendar/calendarSchema";
import { useCalendarEditors } from "./calendarEditing";
import { itemsOnDate, markedDates } from "./calendarItems";

const EVENT_ID = "calendar-event-00000000-0000-4000-8000-0000000000e1";
const REMINDER_ID = "reminder-00000000-0000-4000-8000-0000000000a1";
const calendar: CalendarModule = {
  version: 1,
  events: {
    [EVENT_ID]: {
      id: EVENT_ID,
      title: "Holiday",
      timing: { kind: "all-day", startDate: "2026-10-30", endDate: "2026-11-02" },
      location: "",
      accent: "#476FA8",
      alerts: [],
    },
  },
  reminders: {
    [REMINDER_ID]: {
      id: REMINDER_ID,
      title: "Pack",
      notes: "",
      accent: "#476FA8",
      completed: false,
      due: { date: "2026-10-29", time: "18:00" },
      alert: null,
    },
  },
};

function renderEditors(edit = vi.fn<(change: CalendarEdit) => boolean>(() => true)) {
  const { result } = renderHook(() => useCalendarEditors({ calendar, edit }));
  return { edit, binding: () => result.current };
}

describe("calendar editing", () => {
  it("marks every day of a multi-day event and the days of open reminders", () => {
    const marked = markedDates(calendar);
    expect([...marked].sort()).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(itemsOnDate(calendar, "2026-11-01").events.map(({ title }) => title)).toEqual([
      "Holiday",
    ]);
  });

  it("opens events for the calendar island, timed 09:00 to 10:00 by default", () => {
    const { edit, binding } = renderEditors();
    act(() => binding().openNewEvent("2026-10-21"));
    const editing = binding().editing;
    expect(editing).toMatchObject({
      kind: "event",
      isNew: true,
      event: { timing: { kind: "timed", start: "2026-10-21T09:00", end: "2026-10-21T10:00" } },
    });
    if (editing?.kind !== "event") throw new Error("Expected an event");
    act(() => binding().saveEvent({ ...editing.event, title: "Dentist" }));
    expect(edit).toHaveBeenLastCalledWith({
      kind: "create-event",
      event: expect.objectContaining({ title: "Dentist" }),
    });
    expect(binding().editing).toBeNull();

    act(() => binding().openEvent(EVENT_ID));
    act(() => binding().deleteEvent(EVENT_ID));
    expect(edit).toHaveBeenLastCalledWith({ kind: "delete-event", eventId: EVENT_ID });
  });

  it("opens reminders for the calendar island, creating or updating them on save", () => {
    const { edit, binding } = renderEditors();
    act(() => binding().openNewReminder("2026-10-21"));
    const created = binding().editing;
    expect(created).toMatchObject({ kind: "reminder", reminder: { due: { date: "2026-10-21" } } });
    if (created?.kind !== "reminder") throw new Error("Expected a reminder");
    act(() => binding().saveReminder({ ...created.reminder, title: "Water plants" }));
    expect(edit).toHaveBeenLastCalledWith({
      kind: "create-reminder",
      reminder: expect.objectContaining({ title: "Water plants", accent: "#476FA8" }),
    });

    act(() => binding().openReminder(REMINDER_ID));
    act(() => binding().saveReminder({ ...calendar.reminders[REMINDER_ID], title: "Pack bags" }));
    expect(edit).toHaveBeenLastCalledWith({
      kind: "update-reminder",
      reminder: expect.objectContaining({ id: REMINDER_ID, title: "Pack bags" }),
    });

    act(() => binding().openReminder(REMINDER_ID));
    act(() => binding().deleteReminder(REMINDER_ID));
    expect(edit).toHaveBeenLastCalledWith({ kind: "delete-reminder", reminderId: REMINDER_ID });
  });

  it("keeps an item open, marked failed, when saving it cannot be applied", () => {
    const { binding } = renderEditors(vi.fn(() => false));
    act(() => binding().openReminder(REMINDER_ID));
    act(() => binding().saveReminder(calendar.reminders[REMINDER_ID]));
    expect(binding().editing).toMatchObject({ failed: true });
  });
});
