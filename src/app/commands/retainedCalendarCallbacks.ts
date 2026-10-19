import {
  CALENDAR_MODULE_ID,
  type CalendarEvent,
  type Reminder,
} from "../../domain/calendar/calendarSchema";
import { findDocumentModuleInstallation } from "../../domain/document-modules/documentModules";
import { INBOX_MODULE_ID } from "../../domain/notifications/inboxSchema";
import type { AlertBatch } from "../calendar/createAlertScheduler";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import { createEntityId } from "../../domain/ids/entityIds";
import type { createRetainedCompletionOwner } from "./retainedCompletionOwner";

/** One edit of the calendar, as the calendar's dialogs and menus express it. */
export type CalendarEdit =
  | { readonly kind: "create-event"; readonly event: CalendarEvent }
  | { readonly kind: "update-event"; readonly event: CalendarEvent }
  | { readonly kind: "delete-event"; readonly eventId: string }
  | { readonly kind: "create-reminder"; readonly reminder: Reminder }
  | { readonly kind: "update-reminder"; readonly reminder: Reminder }
  | {
      readonly kind: "set-reminder-completed";
      readonly reminderId: string;
      readonly completed: boolean;
    }
  | { readonly kind: "delete-reminder"; readonly reminderId: string };

/** One change to the notification inbox; none of these are undoable. */
export type InboxEdit =
  | { readonly kind: "mark-read"; readonly entryIds: readonly string[] }
  | { readonly kind: "dismiss"; readonly entryIds: readonly string[] }
  | { readonly kind: "clear-all" }
  | { readonly kind: "snooze"; readonly entryId: string; readonly until: number }
  | ({ readonly kind: "record" } & AlertBatch)
  | { readonly kind: "advance-watermark"; readonly scannedThrough: number };

export function retainedCalendarCallbacks(owner: ReturnType<typeof createRetainedCompletionOwner>) {
  return {
    /** Captured when an edit is made, so it lands only in the session it was made in. */
    captureCalendarEdit() {
      if (!owner.readDocument()) return null;
      return owner.capture("calendar", null, (_, edit: CalendarEdit) =>
        calendarCommand(owner.readDocument(), edit),
      );
    },
    captureInboxEdit() {
      if (!owner.readDocument()) return null;
      return owner.capture("inbox", null, (_, edit: InboxEdit) =>
        inboxCommand(owner.readDocument(), edit),
      );
    },
  };
}

function calendarCommand(document: TaskMapDocument | null, edit: CalendarEdit) {
  if (!document) throw new Error("No document");
  // Used only when this edit is the first to need the calendar's record.
  const instanceId =
    findDocumentModuleInstallation(document.extensionInstallations, CALENDAR_MODULE_ID)?.id ??
    createEntityId("extension-instance", { nextUuid: () => globalThis.crypto.randomUUID() });
  switch (edit.kind) {
    case "create-event":
      return { type: "calendar.event.create", payload: { instanceId, event: edit.event } };
    case "update-event":
      return { type: "calendar.event.update", payload: { event: edit.event } };
    case "delete-event":
      return { type: "calendar.event.delete", payload: { eventId: edit.eventId } };
    case "create-reminder":
      return { type: "calendar.reminder.create", payload: { instanceId, reminder: edit.reminder } };
    case "update-reminder":
      return { type: "calendar.reminder.update", payload: { reminder: edit.reminder } };
    case "set-reminder-completed":
      return {
        type: "calendar.reminder.set-completed",
        payload: { reminderId: edit.reminderId, completed: edit.completed },
      };
    case "delete-reminder":
      return { type: "calendar.reminder.delete", payload: { reminderId: edit.reminderId } };
  }
}

function inboxCommand(document: TaskMapDocument | null, edit: InboxEdit) {
  switch (edit.kind) {
    case "record":
      return {
        type: "inbox.alerts.record",
        payload: {
          instanceId: inboxInstanceId(document),
          entries: edit.entries,
          fired: edit.fired,
          scannedThrough: edit.scannedThrough,
          now: edit.now,
        },
      };
    case "advance-watermark":
      return {
        type: "inbox.watermark.advance",
        payload: { instanceId: inboxInstanceId(document), scannedThrough: edit.scannedThrough },
      };
    case "mark-read":
      return edit.entryIds.length
        ? { type: "inbox.entries.mark-read", payload: { ids: edit.entryIds } }
        : null;
    case "dismiss":
      return edit.entryIds.length
        ? { type: "inbox.entries.dismiss", payload: { ids: edit.entryIds } }
        : null;
    case "clear-all":
      return { type: "inbox.clear-all", payload: {} };
    case "snooze":
      return { type: "inbox.entry.snooze", payload: { id: edit.entryId, until: edit.until } };
  }
}

/** The inbox's record, or a new id for the first change that needs one. */
function inboxInstanceId(document: TaskMapDocument | null) {
  if (!document) throw new Error("No document");
  return (
    findDocumentModuleInstallation(document.extensionInstallations, INBOX_MODULE_ID)?.id ??
    createEntityId("extension-instance", { nextUuid: () => globalThis.crypto.randomUUID() })
  );
}
