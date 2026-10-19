import { useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { CalendarEdit, InboxEdit } from "../app/commands/retainedCalendarCallbacks";
import {
  calendarDocumentModule,
  inboxDocumentModule,
  readDocumentModule,
} from "../domain/document-modules/documentModules";
import type { InboxModule } from "../domain/notifications/inboxSchema";
import type { CalendarSource } from "../features/calendar/calendarEditing";
import { RetainedCanvasContext } from "./RetainedCanvasContext";

export interface RetainedCalendarSource extends CalendarSource {
  readonly inbox: InboxModule | null;
  readonly editInbox: (change: InboxEdit) => boolean;
}

/**
 * The open document's calendar and notification inbox for their UI, and the ways to change them.
 * Each parsed module keeps its identity until that module changes, so other edits never re-render
 * the calendar or the inbox.
 */
export function useRetainedCalendar(): RetainedCalendarSource {
  const context = useContext(RetainedCanvasContext);
  if (!context) throw new Error("The calendar requires its session owner.");
  const { runtime } = context;
  const store = runtime.controller.store;
  const read = useCallback(() => {
    const document = store.getState().documentWorkspace.document;
    return document ? readDocumentModule(document, calendarDocumentModule) : null;
  }, [store]);
  const readInbox = useCallback(() => {
    const document = store.getState().documentWorkspace.document;
    return document ? readDocumentModule(document, inboxDocumentModule) : null;
  }, [store]);
  const calendar = useSyncExternalStore(store.subscribe, read, read);
  const inbox = useSyncExternalStore(store.subscribe, readInbox, readInbox);
  const edit = useCallback(
    (change: CalendarEdit) => runtime.callbacks.captureCalendarEdit()?.complete(change).ok ?? false,
    [runtime],
  );
  const editInbox = useCallback(
    (change: InboxEdit) => runtime.callbacks.captureInboxEdit()?.complete(change).ok ?? false,
    [runtime],
  );
  return useMemo(() => ({ calendar, edit, inbox, editInbox }), [calendar, edit, inbox, editInbox]);
}
