import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { InboxEdit } from "../../app/commands/retainedCalendarCallbacks";
import type { InboxModule } from "../../domain/notifications/inboxSchema";
import type { AppUpdateInfo } from "../../types";
import type { CalendarIslandBinding, CalendarSource } from "../calendar/calendarEditing";
import { localDateOf } from "../calendar/calendarItems";
import { calendarDayOf } from "../calendar/calendarMonth";
import {
  notificationItems,
  type AppNotification,
  type NotificationItem,
} from "./notificationItems";

/** The calendar and inbox of the open document, and the ways to change them. */
export interface NotificationSource extends CalendarSource {
  readonly inbox: InboxModule | null;
  readonly editInbox: (change: InboxEdit) => boolean;
}

/** The update check, whose available update becomes a notification. */
export interface UpdateNotificationSource {
  readonly availableUpdate: AppUpdateInfo | null;
  readonly installAppUpdate: () => Promise<void>;
}

/** Everything the notification island shows and does. */
export interface NotificationCenter {
  readonly calendar: CalendarIslandBinding;
  readonly items: readonly NotificationItem[];
  readonly unreadCount: number;
  /** The instant the items were last worked out; snoozed entries reappear as it advances. */
  readonly now: number;
  readonly markAllRead: () => void;
  readonly dismiss: (item: NotificationItem) => void;
  /** Hides an alert until `until`, when it returns unread. */
  readonly snooze: (item: NotificationItem, until: number) => void;
  readonly clearAll: () => void;
  readonly open: (item: NotificationItem) => void;
  /** Marks the card's reminder done (undoable) and clears the card. */
  readonly complete: (item: NotificationItem) => void;
  readonly setReminderCompleted: (reminderId: string, completed: boolean) => void;
  readonly installUpdate: () => void;
  readonly newEvent: () => void;
  readonly newReminder: () => void;
}

/**
 * The notification centre: the document's inbox entries merged with notifications from the app.
 * App notifications live only as long as the workspace, so they are cleared on lock.
 */
export function useNotificationCenter(
  source: NotificationSource,
  updates: UpdateNotificationSource,
  calendar: CalendarIslandBinding,
): NotificationCenter {
  const now = useMinuteClock();
  const app = useAppNotifications(updates.availableUpdate);
  const items = useMemo(
    () => notificationItems(source.inbox, source.calendar, app.notifications, app.read, now),
    [source.inbox, source.calendar, app.notifications, app.read, now],
  );
  const { editInbox, edit } = source;

  const markAllRead = useCallback(() => {
    const unread = (origin: NotificationItem["origin"]) =>
      items.filter((item) => !item.read && item.origin === origin).map((item) => item.id);
    const appIds = unread("app");
    const entryIds = unread("document");
    if (appIds.length) app.markRead(appIds);
    if (entryIds.length) editInbox({ kind: "mark-read", entryIds });
  }, [app, editInbox, items]);

  const dismiss = useCallback(
    (item: NotificationItem) => {
      if (item.origin === "app") app.dismiss([item.id]);
      else editInbox({ kind: "dismiss", entryIds: [item.id] });
    },
    [app, editInbox],
  );

  return useMemo(() => {
    const today = () => localDateOf(calendarDayOf(new Date()));
    return {
      calendar,
      items,
      unreadCount: items.filter((item) => !item.read).length,
      now,
      markAllRead,
      dismiss,
      snooze(item, until) {
        if (item.origin === "document") editInbox({ kind: "snooze", entryId: item.id, until });
      },
      clearAll() {
        app.dismiss(app.notifications.map(({ id }) => id));
        editInbox({ kind: "clear-all" });
      },
      open(item) {
        if (item.origin === "document" && !item.read) {
          editInbox({ kind: "mark-read", entryIds: [item.id] });
        }
        if (item.target?.kind === "event") calendar.openEvent(item.target.id);
        else if (item.target?.kind === "reminder") calendar.openReminder(item.target.id);
      },
      complete(item) {
        if (item.target?.kind !== "reminder") return;
        if (edit({ kind: "set-reminder-completed", reminderId: item.target.id, completed: true })) {
          dismiss(item);
        }
      },
      setReminderCompleted(reminderId, completed) {
        edit({ kind: "set-reminder-completed", reminderId, completed });
      },
      installUpdate() {
        // The update flow reports its own progress and failures as toasts.
        updates.installAppUpdate().catch(() => undefined);
      },
      newEvent: () => calendar.openNewEvent(today()),
      newReminder: () => calendar.openNewReminder(today()),
    } satisfies NotificationCenter;
  }, [app, calendar, dismiss, edit, editInbox, items, markAllRead, now, updates]);
}

/** App notifications with their read and dismissed state, kept in memory. */
function useAppNotifications(availableUpdate: AppUpdateInfo | null) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [read, setRead] = useState<ReadonlySet<string>>(() => new Set());
  const [firstSeen, setFirstSeen] = useState<ReadonlyMap<string, number>>(() => new Map());
  const updateId = availableUpdate ? `app-update-${availableUpdate.version}` : null;
  if (updateId && !firstSeen.has(updateId)) {
    setFirstSeen(new Map(firstSeen).set(updateId, Date.now()));
  }

  const notifications = useMemo<AppNotification[]>(
    () =>
      availableUpdate && updateId && !dismissed.has(updateId)
        ? [
            {
              id: updateId,
              kind: "update-available",
              title: "Update available",
              detail: `TaskMap ${availableUpdate.version} is ready to install.`,
              at: firstSeen.get(updateId) ?? 0,
            },
          ]
        : [],
    [availableUpdate, dismissed, firstSeen, updateId],
  );
  const add = (set: ReadonlySet<string>, ids: readonly string[]) =>
    ids.every((id) => set.has(id)) ? set : new Set([...set, ...ids]);
  const dismiss = useCallback((ids: readonly string[]) => setDismissed((set) => add(set, ids)), []);
  const markRead = useCallback((ids: readonly string[]) => setRead((set) => add(set, ids)), []);
  return useMemo(
    () => ({ notifications, read, dismiss, markRead }),
    [notifications, read, dismiss, markRead],
  );
}

/** The current instant, refreshed on each new minute and whenever the window comes back. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, 60_000 - (current % 60_000) + 50);
    };
    tick();
    window.addEventListener("focus", tick);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", tick);
    };
  }, []);
  return now;
}

/**
 * Whether the notification island is expanded, shared with the toolbar's Notifications button,
 * which asks the island to toggle and shows as pressed while it is open.
 */
const panel = {
  expanded: false,
  listeners: new Set<() => void>(),
  toggleListeners: new Set<() => void>(),
};

export function publishNotificationPanelExpanded(expanded: boolean) {
  if (panel.expanded === expanded) return;
  panel.expanded = expanded;
  panel.listeners.forEach((listener) => listener());
}

export function useNotificationPanelExpanded(): boolean {
  return useSyncExternalStore(
    (listener) => {
      panel.listeners.add(listener);
      return () => panel.listeners.delete(listener);
    },
    () => panel.expanded,
  );
}

export function requestNotificationPanelToggle() {
  panel.toggleListeners.forEach((listener) => listener());
}

export function useNotificationPanelToggleRequests(onToggle: () => void) {
  useEffect(() => {
    panel.toggleListeners.add(onToggle);
    return () => {
      panel.toggleListeners.delete(onToggle);
    };
  }, [onToggle]);
}

/** Toolbar controls carrying this attribute toggle the island instead of counting as outside. */
export const NOTIFICATION_PANEL_TOGGLE = "data-notification-panel-toggle";
