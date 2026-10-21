import { IconCircle, IconCircleCheckFilled } from "@tabler/icons-react";
import type { CalendarModule } from "../../domain/calendar/calendarSchema";
import { splitLocalDateTime, type LocalDate } from "../../domain/calendar/localDateTime";
import { IconButton } from "../../ui/primitives/Button";
import { itemsOnDate } from "./calendarItems";

/** Rows in the day panel; more scroll inside it. */
export const DAY_PANEL_ROW = 44;
export const DAY_PANEL_VISIBLE_ROWS = 4;
/** The rule above the rows and the space below them. */
export const DAY_PANEL_CHROME = 15;

/** How tall the day panel is for a day with `count` events and reminders. */
export function dayPanelHeight(count: number): number {
  return DAY_PANEL_CHROME + Math.min(Math.max(count, 1), DAY_PANEL_VISIBLE_ROWS) * DAY_PANEL_ROW;
}

export function dayItemCount(calendar: CalendarModule | null, date: LocalDate): number {
  const { events, reminders } = itemsOnDate(calendar, date);
  return events.length + reminders.length;
}

export interface CalendarDayPanelProps {
  readonly calendar: CalendarModule | null;
  readonly date: LocalDate;
  readonly label: string;
  readonly onOpenEvent: (eventId: string) => void;
  readonly onOpenReminder: (reminderId: string) => void;
  readonly onSetReminderCompleted: (reminderId: string, completed: boolean) => void;
}

/** The selected day's events and reminders, under the month; each opens its editor. */
export function CalendarDayPanel({
  calendar,
  date,
  label,
  onOpenEvent,
  onOpenReminder,
  onSetReminderCompleted,
}: CalendarDayPanelProps) {
  const { events, reminders } = itemsOnDate(calendar, date);
  const timeOf = (value: string) => splitLocalDateTime(value).time;
  return (
    <div className="taskmap-calendar-day" role="region" aria-label={label}>
      {events.length + reminders.length === 0 ? (
        <p className="taskmap-calendar-day__empty">No events for that day</p>
      ) : (
        <div className="taskmap-calendar-day__list">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              className="taskmap-calendar-day__row"
              onClick={() => onOpenEvent(event.id)}
            >
              <span
                className="taskmap-calendar-day__accent"
                style={{ background: event.accent }}
                aria-hidden="true"
              />
              <span className="taskmap-calendar-day__text">
                <span className="taskmap-calendar-day__title">{event.title}</span>
                <span className="taskmap-calendar-day__detail">
                  {event.timing.kind === "all-day"
                    ? "All day"
                    : `${timeOf(event.timing.start)} – ${timeOf(event.timing.end)}`}
                </span>
              </span>
            </button>
          ))}
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              className="taskmap-calendar-day__row"
              data-completed={reminder.completed || undefined}
            >
              <IconButton
                variant="ghost"
                size="compact"
                className="taskmap-calendar-day__check"
                style={{ color: reminder.accent }}
                aria-label={
                  reminder.completed
                    ? `Mark "${reminder.title}" not done`
                    : `Mark "${reminder.title}" done`
                }
                aria-pressed={reminder.completed}
                icon={
                  reminder.completed ? (
                    <IconCircleCheckFilled size={18} />
                  ) : (
                    <IconCircle size={18} stroke={2} />
                  )
                }
                onClick={() => onSetReminderCompleted(reminder.id, !reminder.completed)}
              />
              <button
                type="button"
                className="taskmap-calendar-day__text"
                onClick={() => onOpenReminder(reminder.id)}
              >
                <span className="taskmap-calendar-day__title">{reminder.title}</span>
                <span className="taskmap-calendar-day__detail">
                  {[reminder.due?.time ?? "Reminder", reminder.notes.trim()]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
