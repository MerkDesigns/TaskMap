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
const clockFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

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

/** "Saturday, 17 October", with the comma the Windows calendar shows (ICU versions differ). */
export function formatCompactDate(day: CalendarDay): string {
  const date = toDate(day);
  return `${weekdayFormat.format(date)}, ${dayMonthFormat.format(date)}`;
}

/** "October 2026". */
export function formatMonthTitle(view: CalendarMonth): string {
  return monthTitleFormat.format(new Date(view.year, view.month, 1));
}

/** "14:05", the 24-hour clock. */
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
