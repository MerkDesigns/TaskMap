/**
 * A calendar date as plain local numbers. Dates never pass through UTC, so a time zone can never
 * shift the day a cell shows.
 */
export interface CalendarDay {
  readonly year: number;
  /** 0 = January, as in `Date`. */
  readonly month: number;
  readonly day: number;
}

export interface CalendarMonth {
  readonly year: number;
  readonly month: number;
}

export interface CalendarGridDay extends CalendarDay {
  /** The day belongs to the month on show rather than a neighbouring one. */
  readonly inMonth: boolean;
}

/** Monday first, as in the Windows calendar for European locales. */
export const WEEKDAY_LABELS = Object.freeze(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);
/** Six weeks always fit any month and keep the grid from changing height between months. */
export const CALENDAR_GRID_DAYS = 42;

const weekdayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long" });
const dayMonthFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });
const monthTitleFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const clockFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const DAY_MS = 86_400_000;
/** Monday 5 January 1970: week 0 of `calendarWeekOf`. */
const FIRST_MONDAY_UTC = Date.UTC(1970, 0, 5);

export function calendarDayOf(date: Date): CalendarDay {
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

export function monthOf(day: CalendarDay): CalendarMonth {
  return { year: day.year, month: day.month };
}

export function sameDay(a: CalendarDay, b: CalendarDay): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function sameMonth(a: CalendarMonth, b: CalendarMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

export function addMonths(view: CalendarMonth, delta: number): CalendarMonth {
  const date = new Date(view.year, view.month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function addDays(day: CalendarDay, delta: number): CalendarDay {
  return calendarDayOf(new Date(day.year, day.month, day.day + delta));
}

/** The 42 days shown for a month, starting on the Monday on or before its first day. */
export function monthGrid(view: CalendarMonth): CalendarGridDay[] {
  const first = new Date(view.year, view.month, 1);
  const leading = (first.getDay() + 6) % 7;
  return Array.from({ length: CALENDAR_GRID_DAYS }, (_, index) => {
    const day = calendarDayOf(new Date(view.year, view.month, 1 - leading + index));
    return { ...day, inMonth: day.month === view.month };
  });
}

/**
 * A continuous count of Monday-first weeks. Counted on UTC calendar dates, so daylight saving
 * changes (23- or 25-hour days) never shift a day into another week.
 */
export function calendarWeekOf(day: CalendarDay): number {
  return Math.floor((Date.UTC(day.year, day.month, day.day) - FIRST_MONDAY_UTC) / (7 * DAY_MS));
}

/** Every day of the weeks `first` to `last`, Monday first, with its weekday column. */
export function daysOfWeeks(
  first: number,
  last: number,
): (CalendarDay & { readonly week: number; readonly column: number })[] {
  const days = [];
  for (let week = first; week <= last; week++) {
    for (let column = 0; column < 7; column++) {
      const date = new Date(FIRST_MONDAY_UTC + (week * 7 + column) * DAY_MS);
      days.push({
        year: date.getUTCFullYear(),
        month: date.getUTCMonth(),
        day: date.getUTCDate(),
        week,
        column,
      });
    }
  }
  return days;
}

/** "Saturday, 17 October", with the comma the Windows calendar shows (ICU versions differ). */
export function formatCompactDate(day: CalendarDay): string {
  const date = toDate(day);
  return `${weekdayFormat.format(date)}, ${dayMonthFormat.format(date)}`;
}

/** "October 2026". */
export function formatMonthTitle(view: CalendarMonth): string {
  return monthTitleFormat.format(new Date(view.year, view.month, 1));
}

/** "14:05:09", the 24-hour clock. */
export function formatClockTime(date: Date): string {
  return clockFormat.format(date);
}

/** "Saturday, 17 October 2026", for assistive technology. */
export function formatFullDate(day: CalendarDay): string {
  return `${formatCompactDate(day)} ${day.year}`;
}

function toDate(day: CalendarDay): Date {
  return new Date(day.year, day.month, day.day);
}
