import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarModule } from "../../domain/calendar/calendarSchema";
import { ReducedMotionProvider } from "../../ui/motion/reducedMotionPreference";
import { requestNotificationPanelToggle, type NotificationCenter } from "./notificationCenter";
import type { NotificationItem } from "./notificationItems";
import { formatNotificationTime } from "./NotificationCard";
import { NotificationIsland } from "./NotificationIsland";

const REMINDER_ID = "reminder-00000000-0000-4000-8000-0000000000a1";
const calendar: CalendarModule = {
  version: 1,
  events: {},
  reminders: {
    [REMINDER_ID]: {
      id: REMINDER_ID,
      title: "Pay rent",
      notes: "",
      accent: "#476FA8",
      completed: false,
      due: { date: "2026-10-18", time: "12:00" },
      alert: null,
    },
  },
};
const NOW = new Date(2026, 9, 19, 9).getTime();
const reminderItem: NotificationItem = {
  id: "inbox-entry-00000000-0000-4000-8000-000000000001",
  origin: "document",
  kind: "reminder-due",
  title: "Pay rent",
  detail: "Due Sunday, 18 October, 12:00",
  at: NOW - 5 * 60_000,
  read: false,
  accent: null,
  target: { kind: "reminder", id: REMINDER_ID },
  completable: true,
};
const updateItem: NotificationItem = {
  id: "app-update-1.2.0",
  origin: "app",
  kind: "update-available",
  title: "Update available",
  detail: "TaskMap 1.2.0 is ready to install.",
  at: NOW - 2 * 3_600_000,
  read: true,
  accent: null,
  target: null,
  completable: false,
};

function center(items: readonly NotificationItem[] = [reminderItem, updateItem]) {
  return {
    calendar: {
      calendar,
      openNewEvent: vi.fn(),
      openNewReminder: vi.fn(),
      openEvent: vi.fn(),
      openReminder: vi.fn(),
      editing: null,
      saveEvent: vi.fn(),
      deleteEvent: vi.fn(),
      saveReminder: vi.fn(),
      deleteReminder: vi.fn(),
      closeEditor: vi.fn(),
      setReminderCompleted: vi.fn(),
    },
    items,
    unreadCount: items.filter((item) => !item.read).length,
    now: NOW,
    markAllRead: vi.fn(),
    dismiss: vi.fn(),
    snooze: vi.fn(),
    clearAll: vi.fn(),
    open: vi.fn(),
    complete: vi.fn(),
    setReminderCompleted: vi.fn(),
    installUpdate: vi.fn(),
    newEvent: vi.fn(),
    newReminder: vi.fn(),
  } satisfies NotificationCenter;
}

function renderIsland(value = center()) {
  render(
    <ReducedMotionProvider override>
      <NotificationIsland center={value} />
    </ReducedMotionProvider>,
  );
  return value;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("notification times", () => {
  it("reads as a short age, then as a date after a week", () => {
    expect(formatNotificationTime(NOW - 30_000, NOW)).toBe("now");
    expect(formatNotificationTime(NOW - 60_000, NOW)).toBe("1m ago");
    expect(formatNotificationTime(NOW - 3 * 3_600_000, NOW)).toBe("3h ago");
    expect(formatNotificationTime(NOW - 2 * 86_400_000, NOW)).toBe("2d ago");
    expect(formatNotificationTime(NOW - 9 * 86_400_000, NOW)).toMatch(/10/);
  });
});

describe("NotificationIsland", () => {
  it("shows the unread count and expands into the notifications", async () => {
    const user = userEvent.setup();
    const value = renderIsland();
    const strip = screen.getByRole("button", { name: "Notifications, 1 unread" });
    expect(strip).toHaveAttribute("aria-expanded", "false");

    await user.click(strip);
    expect(strip).toHaveAttribute("aria-expanded", "true");
    expect(strip).toHaveAttribute("title", "Close notifications");
    const card = screen.getByRole("article", { name: "Pay rent" });
    expect(within(card).getByText("5m ago")).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Mark done" }));
    expect(value.complete).toHaveBeenCalledWith(reminderItem);
    await user.click(within(card).getByRole("button", { name: "Open" }));
    expect(value.open).toHaveBeenCalledWith(reminderItem);
    const update = screen.getByRole("article", { name: "Update available" });
    await user.click(within(update).getByRole("button", { name: "Install" }));
    expect(value.installUpdate).toHaveBeenCalled();
  });

  it("dismisses one card with its X and every card with Clear all", async () => {
    const user = userEvent.setup();
    const value = renderIsland();
    await user.click(screen.getByRole("button", { name: /^Notifications,/ }));
    await user.click(screen.getByRole("button", { name: 'Dismiss "Update available"' }));
    expect(value.dismiss).toHaveBeenCalledWith(updateItem);
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(value.clearAll).toHaveBeenCalled();
  });

  it("marks what it showed as read when it collapses", async () => {
    const user = userEvent.setup();
    const value = renderIsland();
    const strip = screen.getByRole("button", { name: /^Notifications,/ });
    await user.click(strip);
    expect(value.markAllRead).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(strip).toHaveAttribute("aria-expanded", "false");
    expect(value.markAllRead).toHaveBeenCalledTimes(1);
  });

  it("lists what is coming up and completes reminders in place", async () => {
    const user = userEvent.setup();
    const value = renderIsland(center([]));
    await user.click(screen.getByRole("button", { name: /^Notifications,/ }));
    expect(screen.getByText("No notifications")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Upcoming" }));
    const overdue = screen.getByRole("region", { name: "Overdue" });
    await user.click(within(overdue).getByRole("button", { name: 'Mark "Pay rent" done' }));
    expect(value.setReminderCompleted).toHaveBeenCalledWith(REMINDER_ID, true);
    await user.click(within(overdue).getByText("Pay rent"));
    expect(value.calendar.openReminder).toHaveBeenCalledWith(REMINDER_ID);
    await user.click(screen.getByRole("button", { name: "New event" }));
    expect(value.newEvent).toHaveBeenCalled();
  });

  it("toggles from the toolbar's Notifications button", () => {
    renderIsland();
    const strip = screen.getByRole("button", { name: /^Notifications,/ });
    act(() => requestNotificationPanelToggle());
    expect(strip).toHaveAttribute("aria-expanded", "true");
    act(() => requestNotificationPanelToggle());
    expect(strip).toHaveAttribute("aria-expanded", "false");
  });

  it("snoozes an alert from its card for the chosen time, keeping the inbox open", async () => {
    const user = userEvent.setup();
    const value = renderIsland();
    const strip = screen.getByRole("button", { name: /^Notifications,/ });
    await user.click(strip);
    const card = screen.getByRole("article", { name: "Pay rent" });
    await user.click(within(card).getByRole("button", { name: "Snooze" }));
    await user.click(await screen.findByRole("menuitem", { name: "1 hour" }));
    expect(value.snooze).toHaveBeenCalledWith(reminderItem, NOW + 3_600_000);
    expect(strip).toHaveAttribute("aria-expanded", "true");
    // Updates cannot be snoozed.
    const update = screen.getByRole("article", { name: "Update available" });
    expect(within(update).queryByRole("button", { name: "Snooze" })).toBeNull();
  });
});
