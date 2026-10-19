import { z } from "zod";

/**
 * Floating local wall-clock values, as plain strings. An event at "2026-10-19T09:30" stays at
 * 09:30 local time whatever the clocks do; only a `ZoneResolver` turns it into an instant.
 */
export type LocalDate = string;
/** "09:30", 24-hour. */
export type LocalTime = string;
/** "2026-10-19T09:30". */
export type LocalDateTime = string;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

/** A real calendar date in years 1000-9999 (so plain string order is date order). */
export function isLocalDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1000) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isLocalTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function isLocalDateTime(value: string): boolean {
  const [date, time, rest] = value.split("T");
  return rest === undefined && time !== undefined && isLocalDate(date) && isLocalTime(time);
}

export const localDateSchema = z.string().refine(isLocalDate, "Expected a date like 2026-10-19");
export const localTimeSchema = z.string().refine(isLocalTime, "Expected a time like 09:30");
export const localDateTimeSchema = z
  .string()
  .refine(isLocalDateTime, "Expected a date and time like 2026-10-19T09:30");

export function localDateTimeOf(date: LocalDate, time: LocalTime): LocalDateTime {
  return `${date}T${time}`;
}

export function splitLocalDateTime(value: LocalDateTime): {
  readonly date: LocalDate;
  readonly time: LocalTime;
} {
  const [date, time] = value.split("T");
  return { date, time };
}

/** The date `days` later (or earlier), counted on calendar dates so daylight saving never shifts it. */
export function addLocalDays(date: LocalDate, days: number): LocalDate {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
