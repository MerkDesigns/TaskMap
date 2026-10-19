import { useMemo, useRef, useState } from "react";
import type { CalendarEdit } from "../../app/commands/retainedCalendarCallbacks";
import type { CalendarEvent, CalendarModule, Reminder } from "../../domain/calendar/calendarSchema";
import { localDateTimeOf, type LocalDate } from "../../domain/calendar/localDateTime";
import { localDateOf } from "./calendarItems";
import { calendarDayOf } from "./calendarMonth";

/** The open document's calendar and the one way the calendar UI changes it. */
export interface CalendarSource {
  readonly calendar: CalendarModule | null;
  /** False when the edit could not be applied, e.g. the session ended meanwhile. */
  readonly edit: (change: CalendarEdit) => boolean;
}

interface EditingBase {
  readonly isNew: boolean;
  /** Changes for every item opened, so its form starts fresh. */
  readonly session: number;
  /** The last save or delete could not be applied. */
  readonly failed: boolean;
}

/** The event or reminder the calendar island is editing in place of its month. */
export type CalendarEditing =
  | (EditingBase & { readonly kind: "event"; readonly event: CalendarEvent })
  | (EditingBase & {
      readonly kind: "reminder";
      readonly reminder: Reminder;
      /** The day the reminder gets when its date is switched on. */
      readonly fallbackDate: LocalDate;
    });

/** What the calendar island needs: the data to show and the editors it can open. */
export interface CalendarIslandBinding {
  readonly calendar: CalendarModule | null;
  readonly openNewEvent: (date: LocalDate) => void;
  readonly openNewReminder: (date: LocalDate) => void;
  readonly openEvent: (eventId: string) => void;
  readonly openReminder: (reminderId: string) => void;
  readonly editing: CalendarEditing | null;
  readonly saveEvent: (event: CalendarEvent) => void;
  readonly deleteEvent: (eventId: string) => void;
  readonly saveReminder: (reminder: Reminder) => void;
  readonly deleteReminder: (reminderId: string) => void;
  readonly closeEditor: () => void;
  readonly setReminderCompleted: (reminderId: string, completed: boolean) => void;
}

/** New events and reminders start blue, the calendar's own colour. */
export const DEFAULT_CALENDAR_ACCENT = "#476FA8";

function newEvent(date: LocalDate): CalendarEvent {
  return {
    id: `calendar-event-${globalThis.crypto.randomUUID()}`,
    title: "",
    timing: {
      kind: "timed",
      start: localDateTimeOf(date, "09:00"),
      end: localDateTimeOf(date, "10:00"),
    },
    location: "",
    accent: DEFAULT_CALENDAR_ACCENT,
    alerts: [],
  };
}

function newReminder(date: LocalDate): Reminder {
  return {
    id: `reminder-${globalThis.crypto.randomUUID()}`,
    title: "",
    notes: "",
    accent: DEFAULT_CALENDAR_ACCENT,
    completed: false,
    due: { date, time: null },
    alert: null,
  };
}

/** The calendar's editing state: events and reminders are both edited inside the island. */
export function useCalendarEditors(source: CalendarSource): CalendarIslandBinding {
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const [editing, setEditing] = useState<CalendarEditing | null>(null);
  const sessions = useRef(0);

  return useMemo<CalendarIslandBinding>(() => {
    const today = () => localDateOf(calendarDayOf(new Date()));
    const showEvent = (event: CalendarEvent, isNew: boolean) =>
      setEditing({ kind: "event", event, isNew, session: ++sessions.current, failed: false });
    const showReminder = (reminder: Reminder, isNew: boolean, fallbackDate: LocalDate) =>
      setEditing({
        kind: "reminder",
        reminder,
        isNew,
        fallbackDate,
        session: ++sessions.current,
        failed: false,
      });
    const apply = (change: CalendarEdit) => {
      const applied = sourceRef.current.edit(change);
      setEditing((current) => (applied ? null : current && { ...current, failed: true }));
    };
    const calendar = () => sourceRef.current.calendar;
    return {
      calendar: source.calendar,
      openNewEvent: (date) => showEvent(newEvent(date), true),
      openNewReminder: (date) => showReminder(newReminder(date), true, date),
      openEvent: (eventId) => {
        const event = calendar()?.events[eventId];
        if (event) showEvent(event, false);
      },
      openReminder: (reminderId) => {
        const reminder = calendar()?.reminders[reminderId];
        if (reminder) showReminder(reminder, false, reminder.due?.date ?? today());
      },
      editing,
      saveEvent: (event) =>
        apply({ kind: calendar()?.events[event.id] ? "update-event" : "create-event", event }),
      deleteEvent: (eventId) => apply({ kind: "delete-event", eventId }),
      saveReminder: (reminder) =>
        apply({
          kind: calendar()?.reminders[reminder.id] ? "update-reminder" : "create-reminder",
          reminder,
        }),
      deleteReminder: (reminderId) => apply({ kind: "delete-reminder", reminderId }),
      closeEditor: () => setEditing(null),
      setReminderCompleted: (reminderId, completed) => {
        sourceRef.current.edit({ kind: "set-reminder-completed", reminderId, completed });
      },
    };
  }, [editing, source.calendar]);
}
