import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarIsland } from "./CalendarIsland";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 17, 12));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const day = (name: string) => screen.getByRole("button", { name });

describe("CalendarIsland", () => {
  it("shows today's date while compact and the month once expanded", async () => {
    const user = userEvent.setup();
    render(<CalendarIsland open />);
    expect(screen.getByText("Saturday, 17 October")).toBeInTheDocument();
    const chevron = screen.getByRole("button", { name: "Expand calendar" });
    expect(chevron).toHaveAttribute("aria-expanded", "false");

    await user.click(chevron);
    expect(screen.getByRole("button", { name: "Collapse calendar" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("group", { name: "October 2026" })).toBeInTheDocument();
    expect(day("Saturday, 17 October 2026")).toHaveAttribute("aria-current", "date");
    expect(day("Saturday, 17 October 2026")).toHaveAttribute("aria-pressed", "true");
  });

  it("browses months with the arrows", async () => {
    const user = userEvent.setup();
    render(<CalendarIsland open />);
    await user.click(screen.getByRole("button", { name: "Expand calendar" }));
    await user.click(screen.getByRole("button", { name: "Next month" }));
    await user.click(screen.getByRole("button", { name: "Next month" }));
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("group", { name: "January 2027" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("group", { name: "December 2026" })).toBeInTheDocument();
  });

  it("selects a clicked day, and a day of a neighbouring month opens that month", async () => {
    const user = userEvent.setup();
    render(<CalendarIsland open />);
    await user.click(screen.getByRole("button", { name: "Expand calendar" }));

    await user.click(day("Tuesday, 6 October 2026"));
    expect(day("Tuesday, 6 October 2026")).toHaveAttribute("aria-pressed", "true");
    expect(day("Saturday, 17 October 2026")).toHaveAttribute("aria-pressed", "false");

    await user.click(day("Monday, 2 November 2026"));
    expect(screen.getByRole("group", { name: "November 2026" })).toBeInTheDocument();
    expect(day("Monday, 2 November 2026")).toHaveAttribute("aria-pressed", "true");
  });

  it("moves the selection with the arrow keys across months", async () => {
    const user = userEvent.setup();
    render(<CalendarIsland open />);
    await user.click(screen.getByRole("button", { name: "Expand calendar" }));
    const grid = screen.getByRole("group", { name: "October 2026" });

    fireEvent.keyDown(grid, { key: "ArrowDown" });
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    expect(day("Saturday, 31 October 2026")).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(screen.getByRole("group", { name: "October 2026" }), { key: "ArrowRight" });
    expect(screen.getByRole("group", { name: "November 2026" })).toBeInTheDocument();
    expect(day("Sunday, 1 November 2026")).toHaveAttribute("aria-pressed", "true");
    expect(day("Sunday, 1 November 2026")).toHaveFocus();
  });
  it("collapses on Escape and on a click outside it, but not on a click inside", async () => {
    const user = userEvent.setup();
    render(
      <>
        <CalendarIsland open />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Expand calendar" }));
    await user.click(day("Tuesday, 6 October 2026"));
    expect(screen.getByRole("button", { name: "Collapse calendar" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.getByRole("button", { name: "Expand calendar" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand calendar" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Expand calendar" })).toBeInTheDocument();
  });
  it("opens a day menu on right-click, selecting that day, without collapsing", async () => {
    const user = userEvent.setup();
    render(<CalendarIsland open />);
    await user.click(screen.getByRole("button", { name: "Expand calendar" }));

    await user.pointer({ keys: "[MouseRight]", target: day("Thursday, 22 October 2026") });
    expect(day("Thursday, 22 October 2026")).toHaveAttribute("aria-pressed", "true");
    const menu = await screen.findByRole("menu", { name: "Thursday, 22 October 2026" });
    expect(menu).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Placeholder" }));
    expect(screen.getByRole("button", { name: "Collapse calendar" })).toBeInTheDocument();

    // Escape closes the menu first; only the next Escape collapses the calendar.
    await user.pointer({ keys: "[MouseRight]", target: day("Thursday, 22 October 2026") });
    await screen.findByRole("menu", { name: "Thursday, 22 October 2026" });
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Collapse calendar" })).toBeInTheDocument();
  });
});
