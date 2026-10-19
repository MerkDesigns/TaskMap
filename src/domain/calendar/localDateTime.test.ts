// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  addLocalDays,
  isLocalDate,
  isLocalDateTime,
  isLocalTime,
  localDateTimeOf,
} from "./localDateTime";
import { systemZoneResolver } from "./zoneResolver";

describe("local dates and times", () => {
  it("accepts only real calendar dates and 24-hour times", () => {
    expect(isLocalDate("2028-02-29")).toBe(true);
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("26-10-19")).toBe(false);
    expect(isLocalTime("23:59")).toBe(true);
    expect(isLocalTime("24:00")).toBe(false);
    expect(isLocalDateTime(localDateTimeOf("2026-10-19", "09:30"))).toBe(true);
    expect(isLocalDateTime("2026-10-19 09:30")).toBe(false);
  });

  it("counts days on calendar dates across months, years and leap days", () => {
    expect(addLocalDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addLocalDays("2028-03-01", -1)).toBe("2028-02-29");
    // The clocks change on 25 October 2026 in Europe; the date arithmetic does not notice.
    expect(addLocalDays("2026-10-24", 2)).toBe("2026-10-26");
  });

  it("round-trips an ordinary local time through the system time zone", () => {
    const local = "2026-07-15T14:05";
    expect(systemZoneResolver.toLocal(systemZoneResolver.toInstant(local))).toBe(local);
  });
});
