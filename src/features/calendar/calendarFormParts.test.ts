import { describe, expect, it } from "vitest";
import { formatDateText, parseDateText, parseTimeText } from "./calendarFormParts";

describe("typed dates and times", () => {
  it("reads a date in the system's order or year first, and only real days", () => {
    expect(parseDateText(formatDateText("2026-02-28"))).toBe("2026-02-28");
    expect(parseDateText("2026-10-21")).toBe("2026-10-21");
    expect(parseDateText("2026.1.5")).toBe("2026-01-05");
    expect(parseDateText("2026-02-30")).toBeNull();
    expect(parseDateText("31/31/2026")).toBeNull();
    expect(parseDateText("soon")).toBeNull();
  });

  it("gives a date typed without a year this year", () => {
    const withoutYear = formatDateText("2026-12-24").replace(/\D?2026\D?/, "");
    expect(parseDateText(withoutYear, 2027)).toBe("2027-12-24");
  });

  it("reads hours alone, digits run together or separated, and only times of day", () => {
    expect(parseTimeText("9")).toBe("09:00");
    expect(parseTimeText("930")).toBe("09:30");
    expect(parseTimeText("0930")).toBe("09:30");
    expect(parseTimeText("9:05")).toBe("09:05");
    expect(parseTimeText("21.45")).toBe("21:45");
    expect(parseTimeText("24:00")).toBeNull();
    expect(parseTimeText("12:60")).toBeNull();
    expect(parseTimeText("noon")).toBeNull();
  });
});
