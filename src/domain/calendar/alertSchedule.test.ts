import { describe, expect, it } from "vitest";
import { alertInstant, alertOccurrences } from "./alertSchedule";
import type { CalendarModule } from "./calendarSchema";
import type { LocalDateTime } from "./localDateTime";
import type { ZoneResolver } from "./zoneResolver";

const HOUR = 3_600_000;
/** UTC+1, moving to UTC+2 at 03:00 local on 29 March 2026, like central Europe. */
const zone: ZoneResolver = {
  toInstant(local: LocalDateTime) {
    const [date, time] = local.split("T");
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    const offset = local >= "2026-03-29T03:00" ? 2 : 1;
    return Date.UTC(year, month - 1, day, hours, minutes) - offset * HOUR;
  },
  toLocal() {
    throw new Error("Not needed");
  },
};

const EVENT = "calendar-event-00000000-0000-4000-8000-0000000000e1";
const ALL_DAY = "calendar-event-00000000-0000-4000-8000-0000000000e2";
const TIMED_REMINDER = "reminder-00000000-0000-4000-8000-0000000000a1";
const DATED_REMINDER = "reminder-00000000-0000-4000-8000-0000000000a2";
const DONE = "reminder-00000000-0000-4000-8000-0000000000a3";

const calendar: CalendarModule = {
  version: 1,
  events: {
    [EVENT]: {
      id: EVENT,
      title: "Dentist",
      timing: { kind: "timed", start: "2026-03-30T09:00", end: "2026-03-30T10:00" },
      location: "",
      accent: "#476FA8",
      alerts: [
        { amount: 15, unit: "minute" },
        { amount: 1, unit: "day" },
      ],
    },
    [ALL_DAY]: {
      id: ALL_DAY,
      title: "Holiday",
      timing: { kind: "all-day", startDate: "2026-04-02", endDate: "2026-04-03" },
      location: "",
      accent: "#476FA8",
      alerts: [{ amount: 0, unit: "day" }],
    },
  },
  reminders: {
    [TIMED_REMINDER]: {
      id: TIMED_REMINDER,
      title: "Call back",
      notes: "",
      accent: "#476FA8",
      completed: false,
      due: { date: "2026-03-31", time: "16:00" },
      alert: { amount: 0, unit: "minute" },
    },
    [DATED_REMINDER]: {
      id: DATED_REMINDER,
      title: "Pay rent",
      notes: "",
      accent: "#476FA8",
      completed: false,
      due: { date: "2026-04-01", time: null },
      alert: { amount: 1, unit: "day" },
    },
    [DONE]: {
      id: DONE,
      title: "Done already",
      notes: "",
      accent: "#476FA8",
      completed: true,
      due: { date: "2026-03-31", time: "08:00" },
      alert: null,
    },
  },
};

describe("alert schedule", () => {
  it("keeps the wall-clock time for day offsets across a daylight saving change", () => {
    // 30 March 09:00 is UTC+2; the day before is still UTC+1, yet the alert stays at 09:00.
    expect(alertInstant("2026-03-30T09:00", { amount: 1, unit: "day" }, zone)).toBe(
      Date.UTC(2026, 2, 29, 7, 0),
    );
    expect(alertInstant("2026-03-29T09:00", { amount: 1, unit: "day" }, zone)).toBe(
      Date.UTC(2026, 2, 28, 8, 0),
    );
  });

  it("counts minutes and hours as exact durations across the change", () => {
    expect(alertInstant("2026-03-29T04:00", { amount: 2, unit: "hour" }, zone)).toBe(
      Date.UTC(2026, 2, 29, 0, 0),
    );
  });

  it("lists event alerts, all-day alerts at 09:00 and reminders, but not completed ones", () => {
    const occurrences = alertOccurrences(calendar, zone).map(({ kind, at, source }) => ({
      kind,
      at: new Date(at).toISOString(),
      id: source.id,
    }));
    expect(occurrences).toEqual([
      { kind: "event-alert", at: "2026-03-30T06:45:00.000Z", id: EVENT },
      { kind: "event-alert", at: "2026-03-29T07:00:00.000Z", id: EVENT },
      { kind: "event-alert", at: "2026-04-02T07:00:00.000Z", id: ALL_DAY },
      // A timed reminder is due at its time; its alert "at the time" is that same alert.
      { kind: "reminder-due", at: "2026-03-31T14:00:00.000Z", id: TIMED_REMINDER },
      // A reminder with only a date alerts only through its alert, at 09:00.
      { kind: "reminder-alert", at: "2026-03-31T07:00:00.000Z", id: DATED_REMINDER },
    ]);
  });

  it("keys each alert by its item, time and offset, so moving an item makes a new alert", () => {
    const moved: CalendarModule = {
      ...calendar,
      events: {
        [EVENT]: {
          ...calendar.events[EVENT],
          timing: { kind: "timed", start: "2026-03-30T11:00", end: "2026-03-30T12:00" },
        },
      },
    };
    const keys = (module: CalendarModule) =>
      alertOccurrences(module, zone)
        .filter(({ source }) => source.id === EVENT)
        .map(({ key }) => key);
    expect(new Set(keys(calendar)).size).toBe(2);
    expect(keys(moved).some((key) => keys(calendar).includes(key))).toBe(false);
  });
});
