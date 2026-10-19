import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarModule } from "../../domain/calendar/calendarSchema";
import type { CalendarEditing, CalendarIslandBinding } from "./calendarEditing";
import { formatDateText } from "./calendarFormParts";
import { CalendarIsland } from "./CalendarIsland";

const EVENT_ID = "calendar-event-00000000-0000-4000-8000-0000000000e1";
const calendarWithDentist: CalendarModule = {
  version: 1,
  events: {
    [EVENT_ID]: {
      id: EVENT_ID,
      title: "Dentist",
      timing: { kind: "timed", start: "2026-10-22T09:30", end: "2026-10-22T10:00" },
      location: "",
      accent: "#476FA8",
      alerts: [],
    },
  },
  reminders: {},
};

function binding(
  calendar: CalendarModule | null = calendarWithDentist,
  editing: CalendarEditing | null = null,
): CalendarIslandBinding {
  return {
    calendar,
    openNewEvent: vi.fn(),
    openNewReminder: vi.fn(),
    openEvent: vi.fn(),
    openReminder: vi.fn(),
    editing,
    saveEvent: vi.fn(),
    deleteEvent: vi.fn(),
    saveReminder: vi.fn(),
    deleteReminder: vi.fn(),
    closeEditor: vi.fn(),
    setReminderCompleted: vi.fn(),
  };
}

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
    const calendar = binding(null);
    render(<CalendarIsland open calendar={calendar} />);
    await user.click(screen.getByRole("button", { name: "Expand calendar" }));

    await user.pointer({ keys: "[MouseRight]", target: day("Thursday, 22 October 2026") });
    expect(day("Thursday, 22 October 2026")).toHaveAttribute("aria-pressed", "true");
    const menu = await screen.findByRole("menu", { name: "Thursday, 22 October 2026" });
    expect(menu).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "New event…" }));
    expect(calendar.openNewEvent).toHaveBeenCalledWith("2026-10-22");
    expect(screen.getByRole("button", { name: "Collapse calendar" })).toBeInTheDocument();

    // Escape closes the menu first; only the next Escape collapses the calendar.
    await user.pointer({ keys: "[MouseRight]", target: day("Thursday, 22 October 2026") });
    await screen.findByRole("menu", { name: "Thursday, 22 October 2026" });
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Collapse calendar" })).toBeInTheDocument();
  });
  it("stays expanded through clicks elsewhere and Escape when asked to", async () => {
    const user = userEvent.setup();
    render(
      <>
        <CalendarIsland open staysOpen />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Expand calendar" }));
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Collapse calendar" })).toBeInTheDocument();
  });

  it("marks days with events and lists a clicked day's events below the month", async () => {
    const user = userEvent.setup();
    const calendar = binding();
    render(<CalendarIsland open calendar={calendar} />);
    await user.click(screen.getByRole("button", { name: "Expand calendar" }));
    expect(day("Thursday, 22 October 2026")).toHaveAttribute("data-marked");
    expect(day("Wednesday, 21 October 2026")).not.toHaveAttribute("data-marked");
    expect(screen.queryByRole("region", { name: /events and reminders/ })).toBeNull();

    await user.click(day("Wednesday, 21 October 2026"));
    expect(screen.getByText("No events for that day")).toBeInTheDocument();
    await user.click(day("Thursday, 22 October 2026"));
    const panel = screen.getByRole("region", { name: /22 October 2026: events and reminders/ });
    await user.click(within(panel).getByRole("button", { name: /Dentist/ }));
    expect(calendar.openEvent).toHaveBeenCalledWith(EVENT_ID);

    // Clicking the selected day again hides its items.
    await user.click(day("Thursday, 22 October 2026"));
    expect(screen.queryByRole("region", { name: /events and reminders/ })).toBeNull();
  });

  it("offers only new items in a day's menu", async () => {
    const user = userEvent.setup();
    render(<CalendarIsland open calendar={binding()} />);
    await user.click(screen.getByRole("button", { name: "Expand calendar" }));
    await user.pointer({ keys: "[MouseRight]", target: day("Thursday, 22 October 2026") });
    const menu = await screen.findByRole("menu", { name: "Thursday, 22 October 2026" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["New event…", "New reminder…"]);
  });

  it("edits a reminder in place of the month and goes back to it", async () => {
    const user = userEvent.setup();
    const editing: CalendarEditing = {
      kind: "reminder",
      reminder: {
        id: "reminder-00000000-0000-4000-8000-0000000000a1",
        title: "",
        notes: "",
        accent: "#476FA8",
        completed: false,
        due: { date: "2026-10-22", time: null },
        alert: null,
      },
      isNew: true,
      fallbackDate: "2026-10-22",
      session: 1,
      failed: false,
    };
    const calendar = binding(calendarWithDentist, editing);
    render(<CalendarIsland open calendar={calendar} />);
    const form = await screen.findByRole("group", { name: "New reminder" });
    expect(screen.getByRole("button", { name: "Collapse calendar" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "October 2026" })).toBeNull();

    await user.type(within(form).getByLabelText("Title"), "Buy milk");
    await user.type(within(form).getByLabelText("Notes / URL"), "https://shop.example");
    await user.click(within(form).getByRole("radio", { name: "#E85D61" }));
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(calendar.saveReminder).toHaveBeenCalledWith({
      ...editing.reminder,
      title: "Buy milk",
      notes: "https://shop.example",
      accent: "#A74144",
    });

    await user.click(within(form).getByRole("button", { name: "Back" }));
    expect(calendar.closeEditor).toHaveBeenCalled();
  });

  it("picks a reminder's day on the month and its time in the time picker", async () => {
    const user = userEvent.setup();
    const reminder = {
      id: "reminder-00000000-0000-4000-8000-0000000000a2",
      title: "Call back",
      notes: "",
      accent: "#476FA8",
      completed: false,
      due: { date: "2026-10-22", time: "09:00" },
      alert: null,
    };
    const calendar = binding(calendarWithDentist, {
      kind: "reminder",
      reminder,
      isNew: false,
      fallbackDate: "2026-10-22",
      session: 1,
      failed: false,
    });
    render(<CalendarIsland open calendar={calendar} />);
    const form = await screen.findByRole("group", { name: "Edit reminder" });

    await user.click(within(form).getByRole("button", { name: "Pick day" }));
    expect(screen.getByText("Choose a day")).toBeInTheDocument();
    await user.click(day("Tuesday, 27 October 2026"));
    expect(within(form).getByLabelText("Day")).toHaveValue(formatDateText("2026-10-27"));

    await user.click(within(form).getByRole("button", { name: "Pick time of day" }));
    const picker = screen.getByRole("group", { name: "Choose a time" });
    await user.click(
      within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "14" }),
    );
    await user.click(
      within(screen.getByRole("listbox", { name: "Minutes" })).getByRole("option", { name: "45" }),
    );
    await user.click(within(picker).getByRole("button", { name: "Set time" }));

    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(calendar.saveReminder).toHaveBeenCalledWith({
      ...reminder,
      due: { date: "2026-10-27", time: "14:45" },
    });
  });

  it("creates an event in place of the month, moving the end along with the start", async () => {
    const user = userEvent.setup();
    const event = {
      id: "calendar-event-00000000-0000-4000-8000-0000000000e2",
      title: "",
      timing: { kind: "timed" as const, start: "2026-10-22T09:00", end: "2026-10-22T10:00" },
      location: "",
      accent: "#476FA8",
      alerts: [],
    };
    const calendar = binding(calendarWithDentist, {
      kind: "event",
      event,
      isNew: true,
      session: 1,
      failed: false,
    });
    render(<CalendarIsland open calendar={calendar} />);
    const form = await screen.findByRole("group", { name: "New event" });
    await user.type(within(form).getByLabelText("Title"), "Workshop");
    await user.type(within(form).getByLabelText("Location"), "Hall B");

    await user.click(within(form).getByRole("button", { name: "Pick start time" }));
    await user.click(
      within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "11" }),
    );
    await user.click(screen.getByRole("button", { name: "Set time" }));

    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(calendar.saveEvent).toHaveBeenCalledWith({
      ...event,
      title: "Workshop",
      location: "Hall B",
      timing: { kind: "timed", start: "2026-10-22T11:00", end: "2026-10-22T12:00" },
    });
  });

  it("takes a typed day and time, and puts back text that is not one", async () => {
    const user = userEvent.setup();
    const reminder = {
      id: "reminder-00000000-0000-4000-8000-0000000000a3",
      title: "Renew passport",
      notes: "",
      accent: "#476FA8",
      completed: false,
      due: { date: "2026-10-22", time: "09:00" },
      alert: null,
    };
    const calendar = binding(calendarWithDentist, {
      kind: "reminder",
      reminder,
      isNew: false,
      fallbackDate: "2026-10-22",
      session: 1,
      failed: false,
    });
    render(<CalendarIsland open calendar={calendar} />);
    const form = await screen.findByRole("group", { name: "Edit reminder" });
    const dayField = within(form).getByLabelText("Day");
    const timeField = within(form).getByLabelText("Time of day");

    await user.clear(dayField);
    await user.type(dayField, "2026-11-03{Enter}");
    expect(dayField).toHaveValue(formatDateText("2026-11-03"));
    await user.clear(timeField);
    await user.type(timeField, "1745{Enter}");
    expect(timeField).toHaveValue("17:45");
    await user.clear(timeField);
    await user.type(timeField, "25:00{Enter}");
    expect(timeField).toHaveValue("17:45");

    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(calendar.saveReminder).toHaveBeenCalledWith({
      ...reminder,
      due: { date: "2026-11-03", time: "17:45" },
    });
  });
});
