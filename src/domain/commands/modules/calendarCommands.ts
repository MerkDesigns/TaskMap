import { z } from "zod";
import {
  calendarEventIdSchema,
  calendarEventSchema,
  CALENDAR_LIMITS,
  emptyCalendarModule,
  reminderIdSchema,
  reminderSchema,
} from "../../calendar/calendarSchema";
import { calendarDocumentModule } from "../../document-modules/documentModules";
import type { DomainCommandHandler } from "../commandHandler";
import { commandRejected, defineCommandHandler } from "../commandHandler";
import {
  ensureModuleDraft,
  isCommandIssue,
  moduleDraft,
  moduleInstanceIdSchema,
} from "./moduleDraft";

/** Events and reminders: every change is an undoable edit of the calendar module (ADR 011). */
export const calendarCommandHandlers = [
  defineCommandHandler({
    type: "calendar.event.create",
    label: "Add event",
    history: "record",
    payloadSchema: z
      .object({ instanceId: moduleInstanceIdSchema, event: calendarEventSchema })
      .strict(),
    apply(document, { instanceId, event }) {
      const calendar = ensureModuleDraft(
        document,
        calendarDocumentModule,
        instanceId,
        emptyCalendarModule,
      );
      if (isCommandIssue(calendar)) return [calendar];
      if (calendar.events[event.id])
        return [commandRejected("payload.event.id", "The event exists")];
      if (Object.keys(calendar.events).length >= CALENDAR_LIMITS.events) {
        return [commandRejected("payload.event", "The calendar is full")];
      }
      calendar.events[event.id] = event;
    },
  }),
  defineCommandHandler({
    type: "calendar.event.update",
    label: "Edit event",
    history: "record",
    payloadSchema: z.object({ event: calendarEventSchema }).strict(),
    apply(document, { event }) {
      const calendar = moduleDraft(document, calendarDocumentModule);
      if (!calendar?.events[event.id])
        return [commandRejected("payload.event.id", "No such event")];
      calendar.events[event.id] = event;
    },
  }),
  defineCommandHandler({
    type: "calendar.event.delete",
    label: "Delete event",
    history: "record",
    payloadSchema: z.object({ eventId: calendarEventIdSchema }).strict(),
    apply(document, { eventId }) {
      const calendar = moduleDraft(document, calendarDocumentModule);
      if (!calendar?.events[eventId]) return [commandRejected("payload.eventId", "No such event")];
      delete calendar.events[eventId];
    },
  }),
  defineCommandHandler({
    type: "calendar.reminder.create",
    label: "Add reminder",
    history: "record",
    payloadSchema: z
      .object({ instanceId: moduleInstanceIdSchema, reminder: reminderSchema })
      .strict(),
    apply(document, { instanceId, reminder }) {
      const calendar = ensureModuleDraft(
        document,
        calendarDocumentModule,
        instanceId,
        emptyCalendarModule,
      );
      if (isCommandIssue(calendar)) return [calendar];
      if (calendar.reminders[reminder.id]) {
        return [commandRejected("payload.reminder.id", "The reminder exists")];
      }
      if (Object.keys(calendar.reminders).length >= CALENDAR_LIMITS.reminders) {
        return [commandRejected("payload.reminder", "The reminder list is full")];
      }
      calendar.reminders[reminder.id] = reminder;
    },
  }),
  defineCommandHandler({
    type: "calendar.reminder.update",
    label: "Edit reminder",
    history: "record",
    payloadSchema: z.object({ reminder: reminderSchema }).strict(),
    apply(document, { reminder }) {
      const calendar = moduleDraft(document, calendarDocumentModule);
      if (!calendar?.reminders[reminder.id]) {
        return [commandRejected("payload.reminder.id", "No such reminder")];
      }
      calendar.reminders[reminder.id] = reminder;
    },
  }),
  defineCommandHandler({
    type: "calendar.reminder.set-completed",
    label: "Complete reminder",
    history: "record",
    payloadSchema: z.object({ reminderId: reminderIdSchema, completed: z.boolean() }).strict(),
    apply(document, { reminderId, completed }) {
      const reminder = moduleDraft(document, calendarDocumentModule)?.reminders[reminderId];
      if (!reminder) return [commandRejected("payload.reminderId", "No such reminder")];
      reminder.completed = completed;
    },
  }),
  defineCommandHandler({
    type: "calendar.reminder.delete",
    label: "Delete reminder",
    history: "record",
    payloadSchema: z.object({ reminderId: reminderIdSchema }).strict(),
    apply(document, { reminderId }) {
      const calendar = moduleDraft(document, calendarDocumentModule);
      if (!calendar?.reminders[reminderId]) {
        return [commandRejected("payload.reminderId", "No such reminder")];
      }
      delete calendar.reminders[reminderId];
    },
  }),
] as const satisfies readonly DomainCommandHandler[];
