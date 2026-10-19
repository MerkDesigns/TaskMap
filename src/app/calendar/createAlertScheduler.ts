import { alertOccurrences, type AlertOccurrence } from "../../domain/calendar/alertSchedule";
import type { CalendarModule } from "../../domain/calendar/calendarSchema";
import type { ZoneResolver } from "../../domain/calendar/zoneResolver";
import type { InboxEntry, InboxModule } from "../../domain/notifications/inboxSchema";

/** Alerts later than this when noticed (after a lock, sleep or a closed app) count as missed. */
export const MISSED_AFTER_MS = 5 * 60_000;
/**
 * The longest the scheduler sleeps between checks, even with no alert due sooner, so a clock
 * change or a resume from sleep is noticed within a minute. A check that finds nothing writes
 * nothing.
 */
export const MAX_SLEEP_MS = 60_000;
/** How stale the document's scan watermark may become before an idle check saves it. */
export const WATERMARK_REFRESH_MS = 30 * 60_000;

/** Fired alerts recorded in one unrecorded (not undoable) inbox change. */
export interface AlertBatch {
  readonly entries: readonly InboxEntry[];
  readonly fired: Readonly<Record<string, number>>;
  readonly scannedThrough: number;
  readonly now: number;
}

export interface AlertSchedulerPorts {
  readonly now: () => number;
  readonly setTimer: (run: () => void, delayMs: number) => unknown;
  readonly clearTimer: (timer: unknown) => void;
  readonly zone: ZoneResolver;
  /** The open document's calendar and inbox; null while no document can be changed. */
  readonly read: () => {
    readonly calendar: CalendarModule | null;
    readonly inbox: InboxModule | null;
  } | null;
  /** Document changes; the scheduler reacts only when the calendar or inbox itself changed. */
  readonly subscribe: (listener: () => void) => () => void;
  /** False when the change could not be applied now; the scheduler tries again later. */
  readonly record: (batch: AlertBatch) => boolean;
  readonly advanceWatermark: (scannedThrough: number) => boolean;
  readonly newEntryId: () => string;
  /** Alerts that fired on time (not missed ones), as they reach the inbox. */
  readonly onAlerts?: (entries: readonly InboxEntry[]) => void;
}

/**
 * Turns the calendar's alerts into inbox entries while the database is unlocked. One timer waits
 * for the next due alert; it is re-armed when the calendar or inbox changes, never by canvas edits.
 * The first check after unlocking catches up from the document's scan watermark, and the fired
 * ledger keeps every alert from firing twice, across sessions too. Alerts noticed late are summed
 * into one missed entry.
 */
export function createAlertScheduler(ports: AlertSchedulerPorts) {
  /** Alerts after this instant are still to come; null until the document was first read. */
  let scannedThrough: number | null = null;
  let timer: unknown = null;
  let disposed = false;
  /** Recording dispatches synchronously; the store change it causes must not re-enter `check`. */
  let checking = false;
  let seen: { calendar: CalendarModule | null; inbox: InboxModule | null } | null = null;

  const arm = (delayMs: number) => {
    if (timer !== null) ports.clearTimer(timer);
    timer = disposed ? null : ports.setTimer(check, Math.max(0, Math.min(MAX_SLEEP_MS, delayMs)));
  };

  const entryFor = (occurrence: AlertOccurrence, now: number): InboxEntry => ({
    id: ports.newEntryId(),
    kind: occurrence.kind,
    source: occurrence.source,
    occurrence: occurrence.occurrence,
    firedAt: now,
    read: false,
    snoozedUntil: null,
    missedCount: 0,
  });

  function check() {
    if (checking) return;
    checking = true;
    try {
      run();
    } finally {
      checking = false;
      seen = ports.read() ?? seen;
    }
  }

  function run() {
    // A check started by a document change or focus replaces the pending timer.
    if (timer !== null) ports.clearTimer(timer);
    timer = null;
    if (disposed) return;
    const data = ports.read();
    if (!data) {
      arm(MAX_SLEEP_MS);
      return;
    }
    const now = ports.now();
    // Catches up from where the last session stopped; a document without an inbox starts now.
    const from = scannedThrough ?? Math.min(data.inbox?.scannedThrough ?? now, now);
    const fired = data.inbox?.fired ?? {};
    const occurrences = data.calendar ? alertOccurrences(data.calendar, ports.zone) : [];
    const due = occurrences.filter(
      (occurrence) => occurrence.at > from && occurrence.at <= now && !(occurrence.key in fired),
    );

    if (due.length > 0) {
      const onTime = due.filter((occurrence) => now - occurrence.at <= MISSED_AFTER_MS);
      const missed = due.filter((occurrence) => now - occurrence.at > MISSED_AFTER_MS);
      const onTimeEntries = onTime.map((occurrence) => entryFor(occurrence, now));
      const missedEntries =
        missed.length === 1
          ? [entryFor(missed[0], now)]
          : missed.length > 1
            ? [
                {
                  ...entryFor(missed[0], now),
                  kind: "missed-alerts" as const,
                  source: null,
                  occurrence: null,
                  missedCount: missed.length,
                },
              ]
            : [];
      const recorded = ports.record({
        entries: [...missedEntries, ...onTimeEntries],
        fired: Object.fromEntries(due.map((occurrence) => [occurrence.key, now])),
        scannedThrough: now,
        now,
      });
      if (!recorded) {
        arm(MAX_SLEEP_MS);
        return;
      }
      if (onTimeEntries.length > 0) ports.onAlerts?.(onTimeEntries);
    } else if (
      occurrences.length > 0 &&
      now - (data.inbox?.scannedThrough ?? 0) > WATERMARK_REFRESH_MS
    ) {
      // Keeps the saved watermark near the present, so the next unlock does not report alerts of
      // items created after their alert time as missed. Failing here costs nothing.
      ports.advanceWatermark(now);
    }
    // Alerts set to a time already past while unlocked are not reported.
    scannedThrough = now;

    const next = occurrences.reduce(
      (soonest, occurrence) =>
        occurrence.at > now && !(occurrence.key in fired)
          ? Math.min(soonest, occurrence.at)
          : soonest,
      Number.POSITIVE_INFINITY,
    );
    arm(next - now);
  }

  const unsubscribe = ports.subscribe(() => {
    if (disposed || checking) return;
    const data = ports.read();
    if (data && (data.calendar !== seen?.calendar || data.inbox !== seen?.inbox)) check();
  });

  check();

  return {
    /** Checks now, e.g. when the window comes back after sleep or the clock may have changed. */
    check,
    dispose() {
      disposed = true;
      unsubscribe();
      if (timer !== null) ports.clearTimer(timer);
      timer = null;
    },
  };
}
