import { describe, expect, it, vi } from "vitest";
import type { CalendarModule } from "../../domain/calendar/calendarSchema";
import type { LocalDateTime } from "../../domain/calendar/localDateTime";
import type { ZoneResolver } from "../../domain/calendar/zoneResolver";
import type { InboxModule } from "../../domain/notifications/inboxSchema";
import {
  createAlertScheduler,
  MAX_SLEEP_MS,
  MISSED_AFTER_MS,
  WATERMARK_REFRESH_MS,
  type AlertBatch,
} from "./createAlertScheduler";

const MINUTE = 60_000;
/** Local time is UTC in these tests. */
const utc: ZoneResolver = {
  toInstant(local: LocalDateTime) {
    return Date.parse(`${local}:00Z`);
  },
  toLocal() {
    throw new Error("Not needed");
  },
};
const at = (local: string) => Date.parse(`${local}:00Z`);

function event(id: string, start: string, alertMinutes: number[]) {
  return {
    id,
    title: id,
    timing: { kind: "timed" as const, start, end: start },
    location: "",
    accent: "#476FA8",
    alerts: alertMinutes.map((amount) => ({ amount, unit: "minute" as const })),
  };
}
const eventId = (n: number) => `calendar-event-00000000-0000-4000-8000-00000000000${n}`;

/** A document holding a calendar and an inbox, a clock and a timer queue, all under test control. */
function harness(calendar: CalendarModule | null, inbox: InboxModule | null, now: number) {
  const state = { calendar, inbox, now };
  const listeners = new Set<() => void>();
  const timers = new Map<number, { run: () => void; due: number }>();
  let nextTimer = 1;
  let entryCount = 0;
  const notify = () => listeners.forEach((listener) => listener());
  const record = vi.fn((batch: AlertBatch) => {
    const current = state.inbox ?? {
      version: 1 as const,
      entries: {},
      fired: {},
      scannedThrough: 0,
    };
    state.inbox = {
      ...current,
      entries: {
        ...current.entries,
        ...Object.fromEntries(batch.entries.map((entry) => [entry.id, entry])),
      },
      fired: { ...current.fired, ...batch.fired },
      scannedThrough: Math.max(current.scannedThrough, batch.scannedThrough),
    };
    notify();
    return true;
  });
  const advanceWatermark = vi.fn((scannedThrough: number) => {
    state.inbox = state.inbox && { ...state.inbox, scannedThrough };
    notify();
    return true;
  });
  const onAlerts = vi.fn();
  const scheduler = createAlertScheduler({
    now: () => state.now,
    setTimer: (run, delayMs) => {
      const id = nextTimer++;
      timers.set(id, { run, due: state.now + delayMs });
      return id;
    },
    clearTimer: (id) => timers.delete(id as number),
    zone: utc,
    read: () => ({ calendar: state.calendar, inbox: state.inbox }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    record,
    advanceWatermark,
    newEntryId: () =>
      `inbox-entry-00000000-0000-4000-8000-${String(++entryCount).padStart(12, "0")}`,
    onAlerts,
  });
  return {
    state,
    record,
    advanceWatermark,
    onAlerts,
    scheduler,
    timers,
    /** Advances the clock to `time`, running each timer that falls due on the way. */
    runUntil(time: number) {
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].due - b[1].due)[0];
        if (!next || next[1].due > time) break;
        timers.delete(next[0]);
        state.now = next[1].due;
        next[1].run();
      }
      state.now = time;
    },
    change(next: Partial<Pick<typeof state, "calendar" | "inbox">>) {
      Object.assign(state, next);
      notify();
    },
  };
}

function calendarOf(...events: ReturnType<typeof event>[]): CalendarModule {
  return {
    version: 1,
    events: Object.fromEntries(events.map((item) => [item.id, item])),
    reminders: {},
  };
}

describe("alert scheduler", () => {
  it("waits on a single timer and fires an alert into the inbox when it falls due", () => {
    const start = at("2026-10-19T09:00");
    const test = harness(calendarOf(event(eventId(1), "2026-10-19T09:30", [15])), null, start);
    expect(test.timers.size).toBe(1);
    expect(test.record).not.toHaveBeenCalled();

    test.runUntil(at("2026-10-19T09:15"));
    expect(test.record).toHaveBeenCalledTimes(1);
    const entries = Object.values(test.state.inbox!.entries);
    expect(entries).toEqual([
      expect.objectContaining({
        kind: "event-alert",
        source: { kind: "event", id: eventId(1) },
        occurrence: "2026-10-19T09:30",
        read: false,
      }),
    ]);
    expect(test.onAlerts).toHaveBeenCalledWith(entries);
    expect(test.timers.size).toBe(1);
  });

  it("never fires an alert twice, even when a new session starts", () => {
    const calendar = calendarOf(event(eventId(1), "2026-10-19T09:30", [0]));
    const first = harness(calendar, null, at("2026-10-19T09:00"));
    first.runUntil(at("2026-10-19T09:31"));
    first.scheduler.dispose();
    expect(first.record).toHaveBeenCalledTimes(1);

    const second = harness(calendar, first.state.inbox, at("2026-10-19T09:40"));
    second.runUntil(at("2026-10-19T10:00"));
    expect(second.record).not.toHaveBeenCalled();
  });

  it("catches up after unlocking, summing alerts that are long overdue into one missed entry", () => {
    const calendar = calendarOf(
      event(eventId(1), "2026-10-19T08:00", [0]),
      event(eventId(2), "2026-10-19T08:30", [0]),
      event(eventId(3), "2026-10-19T09:58", [0]),
    );
    const inbox: InboxModule = {
      version: 1,
      entries: {},
      fired: {},
      scannedThrough: at("2026-10-19T07:00"),
    };
    const test = harness(calendar, inbox, at("2026-10-19T10:00"));
    const entries = Object.values(test.state.inbox!.entries);
    expect(entries.map(({ kind, missedCount }) => [kind, missedCount])).toEqual([
      ["missed-alerts", 2],
      ["event-alert", 0],
    ]);
    // Only the one that was not late announces itself.
    expect(test.onAlerts).toHaveBeenCalledWith([
      expect.objectContaining({ source: { kind: "event", id: eventId(3) } }),
    ]);
    expect(MISSED_AFTER_MS).toBe(5 * MINUTE);
  });

  it("does not report alerts of items created after their alert time while unlocked", () => {
    const test = harness(calendarOf(), null, at("2026-10-19T10:00"));
    test.change({ calendar: calendarOf(event(eventId(1), "2026-10-19T09:00", [0])) });
    test.runUntil(at("2026-10-19T10:05"));
    expect(test.record).not.toHaveBeenCalled();
  });

  it("re-arms when the calendar changes, but not for other document changes", () => {
    const test = harness(calendarOf(), null, at("2026-10-19T09:00"));
    test.runUntil(at("2026-10-19T09:00"));
    const calendar = calendarOf(event(eventId(1), "2026-10-19T09:10", [5]));
    test.change({ calendar });
    const [timer] = [...test.timers.values()];
    expect(timer.due).toBe(at("2026-10-19T09:01"));

    // A canvas edit leaves the calendar and inbox objects as they were.
    test.change({});
    expect([...test.timers.values()]).toEqual([timer]);
    test.runUntil(at("2026-10-19T09:05"));
    expect(test.record).toHaveBeenCalledTimes(1);
  });

  it("sleeps at most a minute, so clock changes and resumes from sleep are noticed", () => {
    const test = harness(
      calendarOf(event(eventId(1), "2026-10-20T09:00", [0])),
      null,
      at("2026-10-19T09:00"),
    );
    expect([...test.timers.values()][0].due - at("2026-10-19T09:00")).toBe(MAX_SLEEP_MS);
  });

  it("keeps the saved watermark near the present while idle, without firing anything", () => {
    const inbox: InboxModule = {
      version: 1,
      entries: {},
      fired: {},
      scannedThrough: at("2026-10-19T08:00"),
    };
    const test = harness(
      calendarOf(event(eventId(1), "2026-10-20T09:00", [0])),
      inbox,
      at("2026-10-19T09:00"),
    );
    expect(test.advanceWatermark).toHaveBeenCalledWith(at("2026-10-19T09:00"));
    test.runUntil(at("2026-10-19T09:00") + WATERMARK_REFRESH_MS / 2);
    expect(test.advanceWatermark).toHaveBeenCalledTimes(1);
    expect(test.record).not.toHaveBeenCalled();
  });

  it("tries again when the inbox cannot be changed, and stops when disposed", () => {
    const test = harness(
      calendarOf(event(eventId(1), "2026-10-19T09:01", [0])),
      null,
      at("2026-10-19T09:00"),
    );
    test.record.mockImplementationOnce(() => false);
    test.runUntil(at("2026-10-19T09:01"));
    expect(test.state.inbox).toBeNull();
    test.runUntil(at("2026-10-19T09:02"));
    expect(Object.keys(test.state.inbox!.entries)).toHaveLength(1);

    test.scheduler.dispose();
    expect(test.timers.size).toBe(0);
  });
});
