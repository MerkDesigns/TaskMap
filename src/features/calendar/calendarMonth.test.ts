// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  calendarWeekOf,
  daysOfWeeks,
  formatClockTime,
  formatCompactDate,
  formatFullDate,
  formatMonthTitle,
  monthGrid,
} from "./calendarMonth";

describe("calendar month", () => {
  it("shows six weeks starting on the Monday on or before the first", () => {
    const grid = monthGrid({ year: 2026, month: 9 });
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ year: 2026, month: 8, day: 28, inMonth: false });
    expect(grid[3]).toEqual({ year: 2026, month: 9, day: 1, inMonth: true });
    expect(grid[41]).toEqual({ year: 2026, month: 10, day: 8, inMonth: false });
  });

  it("starts on the first itself when the month begins on a Monday", () => {
    expect(monthGrid({ year: 2026, month: 5 })[0]).toEqual({
      year: 2026,
      month: 5,
      day: 1,
      inMonth: true,
    });
  });

  it("counts leap Februaries", () => {
    const inMonth = (year: number) =>
      monthGrid({ year, month: 1 }).filter((day) => day.inMonth).length;
    expect(inMonth(2028)).toBe(29);
    expect(inMonth(2026)).toBe(28);
  });

  it("moves across year boundaries", () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(addDays({ year: 2026, month: 11, day: 31 }, 1)).toEqual({
      year: 2027,
      month: 0,
      day: 1,
    });
  });

  it("formats the compact date, the month title and the full date", () => {
    const day = { year: 2026, month: 9, day: 17 };
    expect(formatCompactDate(day)).toBe("Saturday, 17 October");
    expect(formatMonthTitle(day)).toBe("October 2026");
    expect(formatFullDate(day)).toBe("Saturday, 17 October 2026");
    expect(formatClockTime(new Date(2026, 9, 17, 9, 5, 7))).toBe("09:05:07");
  });

  it("counts weeks continuously across months, years and daylight saving changes", () => {
    const grid = monthGrid({ year: 2026, month: 9 });
    const first = calendarWeekOf(grid[0]);
    expect(calendarWeekOf(grid[41])).toBe(first + 5);
    // November's grid starts four weeks into October's.
    expect(calendarWeekOf(monthGrid({ year: 2026, month: 10 })[0])).toBe(first + 4);
    // The clocks go back on Sunday 25 October 2026 in Europe; the week still ends that day.
    expect(calendarWeekOf({ year: 2026, month: 9, day: 25 })).toBe(
      calendarWeekOf({ year: 2026, month: 9, day: 19 }),
    );
    expect(
      daysOfWeeks(first, first + 5).map(({ year, month, day }) => ({ year, month, day })),
    ).toEqual(grid.map(({ year, month, day }) => ({ year, month, day })));
  });
});
