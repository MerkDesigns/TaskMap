import type { AlertOffset, CalendarModule } from "./calendarSchema";
import {
  addLocalDays,
  localDateTimeOf,
  splitLocalDateTime,
  type LocalDate,
  type LocalDateTime,
} from "./localDateTime";
import type { ZoneResolver } from "./zoneResolver";

/** All-day events, and reminders without a time, alert at this time of their day. */
export const ALL_DAY_ALERT_TIME = "09:00";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/** One alert that falls due at an instant: the inbox entry it becomes and its ledger key. */
export interface AlertOccurrence {
  /** Unique per item, occurrence and offset, so an alert moved to a new time can fire again. */
  readonly key: string;
  readonly at: number;
  readonly kind: "event-alert" | "reminder-alert" | "reminder-due";
  readonly source: { readonly kind: "event" | "reminder"; readonly id: string };
  readonly occurrence: LocalDate | LocalDateTime;
}

/**
 * The instant an alert falls: minutes and hours are exact durations before the start, while days
 * and weeks keep the start's wall-clock time, so a 09:00 alert stays at 09:00 across a change to or
 * from daylight saving time.
 */
export function alertInstant(
  start: LocalDateTime,
  offset: AlertOffset,
  zone: ZoneResolver,
): number {
  if (offset.unit === "minute") return zone.toInstant(start) - offset.amount * MINUTE_MS;
  if (offset.unit === "hour") return zone.toInstant(start) - offset.amount * HOUR_MS;
  const days = offset.unit === "week" ? offset.amount * 7 : offset.amount;
  const { date, time } = splitLocalDateTime(start);
  return zone.toInstant(localDateTimeOf(addLocalDays(date, -days), time));
}

const offsetKey = (offset: AlertOffset) => `${offset.amount}${offset.unit}`;

/**
 * Every alert the calendar holds. Events alert at each of their offsets. A reminder with a time is
 * due at that time and may alert earlier; one with only a date alerts only if it has an alert, at
 * 09:00. Completed reminders never alert.
 */
export function alertOccurrences(calendar: CalendarModule, zone: ZoneResolver): AlertOccurrence[] {
  const occurrences: AlertOccurrence[] = [];
  for (const event of Object.values(calendar.events)) {
    const start =
      event.timing.kind === "all-day"
        ? localDateTimeOf(event.timing.startDate, ALL_DAY_ALERT_TIME)
        : event.timing.start;
    const occurrence =
      event.timing.kind === "all-day" ? event.timing.startDate : event.timing.start;
    for (const offset of event.alerts) {
      occurrences.push({
        key: `event:${event.id}:${start}:${offsetKey(offset)}`,
        at: alertInstant(start, offset, zone),
        kind: "event-alert",
        source: { kind: "event", id: event.id },
        occurrence,
      });
    }
  }
  for (const reminder of Object.values(calendar.reminders)) {
    if (reminder.completed || !reminder.due) continue;
    const { date, time } = reminder.due;
    const due = localDateTimeOf(date, time ?? ALL_DAY_ALERT_TIME);
    const occurrence = time ? due : date;
    const base = { source: { kind: "reminder" as const, id: reminder.id }, occurrence };
    if (time) {
      occurrences.push({
        ...base,
        key: `reminder:${reminder.id}:${due}:due`,
        at: zone.toInstant(due),
        kind: "reminder-due",
      });
    }
    const alert = reminder.alert;
    // An alert at the due time itself is the due alert, already listed for timed reminders.
    if (!alert || (time && alert.amount === 0)) continue;
    occurrences.push({
      ...base,
      key: `reminder:${reminder.id}:${due}:${offsetKey(alert)}`,
      at: alertInstant(due, alert, zone),
      kind: alert.amount === 0 ? "reminder-due" : "reminder-alert",
    });
  }
  return occurrences;
}
