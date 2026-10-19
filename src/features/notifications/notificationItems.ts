import type { CalendarEvent, CalendarModule, Reminder } from "../../domain/calendar/calendarSchema";
import {
  addLocalDays,
  splitLocalDateTime,
  type LocalDate,
  type LocalDateTime,
} from "../../domain/calendar/localDateTime";
import type { InboxEntry, InboxModule } from "../../domain/notifications/inboxSchema";
import { calendarDayOfLocal, eventSpan } from "../calendar/calendarItems";
import { formatCompactDate } from "../calendar/calendarMonth";

/** How far ahead the Upcoming tab looks, today included. */
export const UPCOMING_DAYS = 14;

/** What a notification is about, for its Open action. */
export type NotificationTarget =
  | { readonly kind: "event"; readonly id: string }
  | { readonly kind: "reminder"; readonly id: string };

/** One card in the Notifications tab: a document inbox entry or a notification from the app. */
export interface NotificationItem {
  readonly id: string;
  readonly origin: "document" | "app";
  readonly kind: InboxEntry["kind"] | "update-available";
  readonly title: string;
  readonly detail: string;
  readonly at: number;
  readonly read: boolean;
  readonly accent: string | null;
  readonly target: NotificationTarget | null;
  /** The reminder can still be marked done from the card. */
  readonly completable: boolean;
}

/** A notification the app raises outside the document, such as an available update. */
export interface AppNotification {
  readonly id: string;
  readonly kind: "update-available";
  readonly title: string;
  readonly detail: string;
  readonly at: number;
}

/**
 * The Notifications tab, newest first. Entries take their titles from the calendar, so an entry
 * whose event or reminder has since been deleted is left out; snoozed entries wait until due.
 */
export function notificationItems(
  inbox: InboxModule | null,
  calendar: CalendarModule | null,
  app: readonly AppNotification[],
  appRead: ReadonlySet<string>,
  now: number,
): NotificationItem[] {
  const items: NotificationItem[] = app.map((notification) => ({
    ...notification,
    origin: "app",
    read: appRead.has(notification.id),
    accent: null,
    target: null,
    completable: false,
  }));
  for (const entry of Object.values(inbox?.entries ?? {})) {
    if (entry.snoozedUntil !== null && entry.snoozedUntil > now) continue;
    const item = documentItem(entry, calendar);
    if (item) items.push(item);
  }
  return items.sort((left, right) => right.at - left.at);
}

/**
 * The in-app toast for an alert that just fired. In privacy mode it names only the kind of alert,
 * never its title or details.
 */
export function alertToast(
  entry: InboxEntry,
  calendar: CalendarModule | null,
  privacyMode: boolean,
): { readonly tone: "info"; readonly title: string; readonly message: string } | null {
  const item = documentItem(entry, calendar);
  if (!item) return null;
  if (privacyMode) {
    return {
      tone: "info",
      title: entry.source?.kind === "event" ? "Event alert" : "Reminder",
      message: "Open the inbox to see it.",
    };
  }
  return { tone: "info", title: item.title, message: item.detail };
}

function documentItem(entry: InboxEntry, calendar: CalendarModule | null): NotificationItem | null {
  const base = {
    id: entry.id,
    origin: "document" as const,
    kind: entry.kind,
    at: entry.snoozedUntil ?? entry.firedAt,
    read: entry.read,
  };
  if (entry.kind === "missed-alerts") {
    return {
      ...base,
      title: entry.missedCount === 1 ? "1 missed alert" : `${entry.missedCount} missed alerts`,
      detail: "While TaskMap was closed or locked",
      accent: null,
      target: null,
      completable: false,
    };
  }
  if (entry.source?.kind === "event") {
    const event = calendar?.events[entry.source.id];
    if (!event) return null;
    return {
      ...base,
      title: event.title,
      detail: [eventWhen(event), event.location].filter(Boolean).join(" · "),
      accent: event.accent,
      target: { kind: "event", id: event.id },
      completable: false,
    };
  }
  if (entry.source?.kind === "reminder") {
    const reminder = calendar?.reminders[entry.source.id];
    if (!reminder) return null;
    return {
      ...base,
      title: reminder.title,
      detail: reminder.due ? `Due ${reminderWhen(reminder.due)}` : "Reminder",
      accent: reminder.accent,
      target: { kind: "reminder", id: reminder.id },
      completable: !reminder.completed,
    };
  }
  return null;
}

/** One row of the Upcoming tab. */
export type UpcomingItem =
  | { readonly kind: "event"; readonly event: CalendarEvent; readonly when: string }
  | { readonly kind: "reminder"; readonly reminder: Reminder; readonly when: string };

export interface UpcomingSection {
  readonly key: string;
  readonly title: string;
  readonly items: readonly UpcomingItem[];
}

/**
 * The Upcoming tab: overdue reminders, then each of the next `UPCOMING_DAYS` days that has
 * something on it, then open reminders without a date. Events that already ended are left out;
 * one that began earlier and is still going shows under today.
 */
export function upcomingSections(
  calendar: CalendarModule | null,
  now: LocalDateTime,
): UpcomingSection[] {
  if (!calendar) return [];
  const today = splitLocalDateTime(now).date;
  const end = addLocalDays(today, UPCOMING_DAYS - 1);
  const days = new Map<LocalDate, { sort: string; item: UpcomingItem }[]>();
  const addTo = (date: LocalDate, sort: string, item: UpcomingItem) => {
    const list = days.get(date) ?? [];
    list.push({ sort, item });
    days.set(date, list);
  };

  for (const event of Object.values(calendar.events)) {
    const { first, last } = eventSpan(event);
    if (first > end || last < today) continue;
    if (event.timing.kind === "timed" && event.timing.end <= now) continue;
    const date = first < today ? today : first;
    const sort = event.timing.kind === "all-day" ? "" : event.timing.start;
    addTo(date, sort, { kind: "event", event, when: eventWhen(event, date) });
  }

  const overdue: { sort: string; item: UpcomingItem }[] = [];
  const undated: UpcomingItem[] = [];
  for (const reminder of Object.values(calendar.reminders)) {
    if (reminder.completed) continue;
    const due = reminder.due;
    if (!due) {
      undated.push({ kind: "reminder", reminder, when: "" });
      continue;
    }
    const dueAt = `${due.date}T${due.time ?? "23:59"}`;
    const item: UpcomingItem = { kind: "reminder", reminder, when: due.time ?? "" };
    if (due.date < today || dueAt < now) {
      overdue.push({ sort: dueAt, item: { ...item, when: reminderWhen(due) } });
    } else if (due.date <= end) {
      addTo(due.date, `${due.date}T${due.time ?? "￿"}`, item);
    }
  }

  const bySort = (left: { sort: string }, right: { sort: string }) =>
    left.sort.localeCompare(right.sort);
  const sections: UpcomingSection[] = [];
  if (overdue.length) {
    sections.push({ key: "overdue", title: "Overdue", items: overdue.sort(bySort).map(pick) });
  }
  for (const date of [...days.keys()].sort()) {
    sections.push({
      key: date,
      title: dayTitle(date, today),
      items: (days.get(date) ?? []).sort(bySort).map(pick),
    });
  }
  if (undated.length) {
    undated.sort((left, right) => title(left).localeCompare(title(right)));
    sections.push({ key: "undated", title: "No date", items: undated });
  }
  return sections;
}

function pick({ item }: { item: UpcomingItem }) {
  return item;
}

function title(item: UpcomingItem) {
  return item.kind === "event" ? item.event.title : item.reminder.title;
}

/** "Today", "Tomorrow" or "Wednesday, 21 October". */
function dayTitle(date: LocalDate, today: LocalDate): string {
  if (date === today) return "Today";
  if (date === addLocalDays(today, 1)) return "Tomorrow";
  return formatCompactDate(calendarDayOfLocal(date));
}

/** When an event happens, as seen from `on` (its first day by default). */
function eventWhen(event: CalendarEvent, on?: LocalDate): string {
  const { first, last } = eventSpan(event);
  const shownOn = on ?? first;
  const lastDay = formatCompactDate(calendarDayOfLocal(last));
  if (event.timing.kind === "all-day") {
    return last === shownOn ? "All day" : `All day, until ${lastDay}`;
  }
  const start = splitLocalDateTime(event.timing.start);
  const end = splitLocalDateTime(event.timing.end);
  if (shownOn !== first) return end.date === shownOn ? `Until ${end.time}` : `Until ${lastDay}`;
  return start.date === end.date
    ? `${start.time} – ${end.time}`
    : `${start.time}, until ${lastDay}`;
}

/** "21 October, 18:00" style wording for a reminder's due date. */
function reminderWhen(due: NonNullable<Reminder["due"]>): string {
  const day = formatCompactDate(calendarDayOfLocal(due.date));
  return due.time ? `${day}, ${due.time}` : day;
}
