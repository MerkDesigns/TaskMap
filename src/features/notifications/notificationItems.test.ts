import { describe, expect, it } from "vitest";
import type { CalendarModule } from "../../domain/calendar/calendarSchema";
import type { InboxEntry, InboxModule } from "../../domain/notifications/inboxSchema";
import { alertToast, notificationItems, upcomingSections } from "./notificationItems";

const EVENT = "calendar-event-00000000-0000-4000-8000-0000000000e1";
const TRIP = "calendar-event-00000000-0000-4000-8000-0000000000e2";
const PAST = "calendar-event-00000000-0000-4000-8000-0000000000e3";
const OVERDUE = "reminder-00000000-0000-4000-8000-0000000000a1";
const LATER = "reminder-00000000-0000-4000-8000-0000000000a2";
const UNDATED = "reminder-00000000-0000-4000-8000-0000000000a3";
const DONE = "reminder-00000000-0000-4000-8000-0000000000a4";

const event = (id: string, title: string, timing: CalendarModule["events"][string]["timing"]) => ({
  id,
  title,
  timing,
  location: "",
  accent: "#476FA8",
  alerts: [],
});
const reminder = (
  id: string,
  title: string,
  due: CalendarModule["reminders"][string]["due"],
  completed = false,
) => ({ id, title, notes: "", accent: "#476FA8", completed, due, alert: null });

const calendar: CalendarModule = {
  version: 1,
  events: {
    [EVENT]: event(EVENT, "Dentist", {
      kind: "timed",
      start: "2026-10-19T18:00",
      end: "2026-10-19T19:00",
    }),
    [TRIP]: event(TRIP, "Trip", {
      kind: "all-day",
      startDate: "2026-10-17",
      endDate: "2026-10-21",
    }),
    [PAST]: event(PAST, "Standup", {
      kind: "timed",
      start: "2026-10-19T08:00",
      end: "2026-10-19T08:15",
    }),
  },
  reminders: {
    [OVERDUE]: reminder(OVERDUE, "Pay rent", { date: "2026-10-18", time: "12:00" }),
    [LATER]: reminder(LATER, "Call back", { date: "2026-10-21", time: null }),
    [UNDATED]: reminder(UNDATED, "Read book", null),
    [DONE]: reminder(DONE, "Done already", { date: "2026-10-20", time: null }, true),
  },
};

const entry = (id: string, overrides: Partial<InboxEntry>): InboxEntry => ({
  id,
  kind: "event-alert",
  source: null,
  occurrence: null,
  firedAt: 0,
  read: false,
  snoozedUntil: null,
  missedCount: 0,
  ...overrides,
});
const ENTRY = (n: number) => `inbox-entry-00000000-0000-4000-8000-00000000000${n}`;

describe("notification items", () => {
  const inbox: InboxModule = {
    version: 1,
    scannedThrough: 0,
    fired: {},
    entries: {
      [ENTRY(1)]: entry(ENTRY(1), { source: { kind: "event", id: EVENT }, firedAt: 1_000 }),
      [ENTRY(2)]: entry(ENTRY(2), {
        kind: "reminder-due",
        source: { kind: "reminder", id: OVERDUE },
        firedAt: 3_000,
        read: true,
      }),
      [ENTRY(3)]: entry(ENTRY(3), {
        source: { kind: "event", id: "calendar-event-00000000-0000-4000-8000-0000000000ff" },
        firedAt: 4_000,
      }),
      [ENTRY(4)]: entry(ENTRY(4), { kind: "missed-alerts", missedCount: 3, firedAt: 2_000 }),
      [ENTRY(5)]: entry(ENTRY(5), {
        source: { kind: "event", id: EVENT },
        firedAt: 500,
        snoozedUntil: 10_000,
      }),
    },
  };

  it("lists entries newest first with titles from the calendar, leaving out deleted sources", () => {
    const items = notificationItems(inbox, calendar, [], new Set(), 5_000);
    expect(items.map(({ title }) => title)).toEqual(["Pay rent", "3 missed alerts", "Dentist"]);
    expect(items[0]).toMatchObject({ completable: true, read: true, detail: expect.any(String) });
    expect(items[2]).toMatchObject({
      detail: "18:00 – 19:00",
      target: { kind: "event", id: EVENT },
    });
  });

  it("brings a snoozed entry back once its snooze has passed", () => {
    const items = notificationItems(inbox, calendar, [], new Set(), 10_000);
    expect(items.filter(({ id }) => id === ENTRY(5))).toEqual([
      expect.objectContaining({ title: "Dentist", at: 10_000 }),
    ]);
  });

  it("merges app notifications with their in-memory read state", () => {
    const update = {
      id: "app-update-1.2.0",
      kind: "update-available" as const,
      title: "Update available",
      detail: "TaskMap 1.2.0 is ready to install.",
      at: 6_000,
    };
    const items = notificationItems(null, null, [update], new Set([update.id]), 7_000);
    expect(items).toEqual([expect.objectContaining({ origin: "app", read: true, target: null })]);
  });
});

describe("upcoming sections", () => {
  it("shows overdue reminders, the days ahead and undated reminders, skipping what has ended", () => {
    const sections = upcomingSections(calendar, "2026-10-19T09:00");
    expect(sections.map(({ key, title }) => [key, title])).toEqual([
      ["overdue", "Overdue"],
      ["2026-10-19", "Today"],
      ["2026-10-21", expect.stringContaining("21")],
      ["undated", "No date"],
    ]);
    const titles = sections.map(({ items }) =>
      items.map((item) => (item.kind === "event" ? item.event.title : item.reminder.title)),
    );
    // The trip began before today and still runs, so it shows under today, all-day first.
    expect(titles).toEqual([["Pay rent"], ["Trip", "Dentist"], ["Call back"], ["Read book"]]);
    expect(sections[1].items[0]).toMatchObject({ when: expect.stringMatching(/^All day, until /) });
  });

  it("treats a reminder due earlier today as overdue", () => {
    const sections = upcomingSections(
      {
        ...calendar,
        reminders: {
          [OVERDUE]: reminder(OVERDUE, "Pay rent", { date: "2026-10-19", time: "08:30" }),
        },
      },
      "2026-10-19T09:00",
    );
    expect(sections[0]).toMatchObject({ key: "overdue" });
  });
});

describe("alert toasts", () => {
  const alert = entry(ENTRY(1), { source: { kind: "event", id: EVENT } });

  it("names the event and when it is", () => {
    expect(alertToast(alert, calendar, false)).toEqual({
      tone: "info",
      title: "Dentist",
      message: "18:00 – 19:00",
    });
  });

  it("says only what kind of alert it is in privacy mode", () => {
    expect(alertToast(alert, calendar, true)).toEqual({
      tone: "info",
      title: "Event alert",
      message: "Open the inbox to see it.",
    });
  });
});
