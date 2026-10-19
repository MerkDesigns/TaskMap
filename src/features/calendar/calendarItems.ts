import type {
  AlertOffset,
  CalendarEvent,
  CalendarModule,
  Reminder,
} from "../../domain/calendar/calendarSchema";
import {
  addLocalDays,
  splitLocalDateTime,
  type LocalDate,
} from "../../domain/calendar/localDateTime";
import type { CalendarDay } from "./calendarMonth";

/** Long all-day events mark at most this many days, so one event cannot flood the grid. */
const MAX_MARKED_SPAN = 366;

export function localDateOf({ year, month, day }: CalendarDay): LocalDate {
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function calendarDayOfLocal(date: LocalDate): CalendarDay {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: month - 1, day };
}

/** The first and last day an event covers. */
export function eventSpan(event: CalendarEvent): {
  readonly first: LocalDate;
  readonly last: LocalDate;
} {
  return event.timing.kind === "all-day"
    ? { first: event.timing.startDate, last: event.timing.endDate }
    : {
        first: splitLocalDateTime(event.timing.start).date,
        last: splitLocalDateTime(event.timing.end).date,
      };
}

/** Days with an event, or with a reminder still open, for the grid's markers. */
export function markedDates(calendar: CalendarModule | null): ReadonlySet<LocalDate> {
  const dates = new Set<LocalDate>();
  if (!calendar) return dates;
  for (const event of Object.values(calendar.events)) {
    const { first, last } = eventSpan(event);
    for (let day = first, count = 0; day <= last && count < MAX_MARKED_SPAN; count++) {
      dates.add(day);
      day = addLocalDays(day, 1);
    }
  }
  for (const reminder of Object.values(calendar.reminders)) {
    if (reminder.due && !reminder.completed) dates.add(reminder.due.date);
  }
  return dates;
}

/** A day's events (all-day first, then by start) and its reminders (by time, untimed first). */
export function itemsOnDate(
  calendar: CalendarModule | null,
  date: LocalDate,
): { readonly events: readonly CalendarEvent[]; readonly reminders: readonly Reminder[] } {
  if (!calendar) return { events: [], reminders: [] };
  const startKey = (event: CalendarEvent) =>
    event.timing.kind === "all-day" ? "" : event.timing.start;
  const events = Object.values(calendar.events)
    .filter((event) => {
      const { first, last } = eventSpan(event);
      return first <= date && date <= last;
    })
    .sort((left, right) => startKey(left).localeCompare(startKey(right)));
  const reminders = Object.values(calendar.reminders)
    .filter((reminder) => reminder.due?.date === date)
    .sort((left, right) => (left.due?.time ?? "").localeCompare(right.due?.time ?? ""));
  return { events, reminders };
}

/** The alert choices offered for timed items, as stored offsets. */
export const TIMED_ALERTS: readonly { readonly label: string; readonly offset: AlertOffset }[] = [
  { label: "At time of event", offset: { amount: 0, unit: "minute" } },
  { label: "5 minutes before", offset: { amount: 5, unit: "minute" } },
  { label: "15 minutes before", offset: { amount: 15, unit: "minute" } },
  { label: "30 minutes before", offset: { amount: 30, unit: "minute" } },
  { label: "1 hour before", offset: { amount: 1, unit: "hour" } },
  { label: "2 hours before", offset: { amount: 2, unit: "hour" } },
  { label: "1 day before", offset: { amount: 1, unit: "day" } },
  { label: "2 days before", offset: { amount: 2, unit: "day" } },
  { label: "1 week before", offset: { amount: 1, unit: "week" } },
];

/** For all-day items an alert falls at 09:00 on the day, or days before. */
export const ALL_DAY_ALERTS: readonly { readonly label: string; readonly offset: AlertOffset }[] = [
  { label: "On the day (09:00)", offset: { amount: 0, unit: "day" } },
  { label: "1 day before (09:00)", offset: { amount: 1, unit: "day" } },
  { label: "2 days before (09:00)", offset: { amount: 2, unit: "day" } },
  { label: "1 week before (09:00)", offset: { amount: 1, unit: "week" } },
];

export function alertKey(offset: AlertOffset | null): string {
  return offset ? `${offset.amount}${offset.unit}` : "none";
}

export function alertFromKey(
  key: string,
  choices: readonly { readonly offset: AlertOffset }[],
): AlertOffset | null {
  return choices.find(({ offset }) => alertKey(offset) === key)?.offset ?? null;
}
