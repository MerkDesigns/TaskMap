import { useContext, useEffect, useRef } from "react";
import { createAlertScheduler } from "../app/calendar/createAlertScheduler";
import { systemZoneResolver } from "../domain/calendar/zoneResolver";
import {
  calendarDocumentModule,
  inboxDocumentModule,
  readDocumentModule,
} from "../domain/document-modules/documentModules";
import type { InboxEntry } from "../domain/notifications/inboxSchema";
import { RetainedCanvasContext } from "./RetainedCanvasContext";

/**
 * Fires the open document's calendar alerts into its inbox for as long as the workspace is
 * unlocked; locking unmounts the workspace and stops it. Coming back to the window checks at once,
 * which also catches alerts that fell due while the PC slept.
 */
export function useAlertScheduler(onAlerts: (entries: readonly InboxEntry[]) => void) {
  const context = useContext(RetainedCanvasContext);
  if (!context) throw new Error("Alerts require their session owner.");
  const { runtime } = context;
  const onAlertsRef = useRef(onAlerts);
  onAlertsRef.current = onAlerts;

  useEffect(() => {
    const store = runtime.controller.store;
    const scheduler = createAlertScheduler({
      now: () => Date.now(),
      setTimer: (run, delayMs) => window.setTimeout(run, delayMs),
      clearTimer: (timer) => window.clearTimeout(timer as number),
      zone: systemZoneResolver,
      read: () => {
        const document = store.getState().documentWorkspace.document;
        return document
          ? {
              calendar: readDocumentModule(document, calendarDocumentModule),
              inbox: readDocumentModule(document, inboxDocumentModule),
            }
          : null;
      },
      subscribe: store.subscribe,
      record: (batch) =>
        runtime.callbacks.captureInboxEdit()?.complete({ kind: "record", ...batch }).ok ?? false,
      advanceWatermark: (scannedThrough) =>
        runtime.callbacks
          .captureInboxEdit()
          ?.complete({ kind: "advance-watermark", scannedThrough }).ok ?? false,
      newEntryId: () => `inbox-entry-${globalThis.crypto.randomUUID()}`,
      onAlerts: (entries) => onAlertsRef.current(entries),
    });
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") scheduler.check();
    };
    window.addEventListener("focus", scheduler.check);
    document.addEventListener("visibilitychange", checkWhenVisible);
    return () => {
      window.removeEventListener("focus", scheduler.check);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      scheduler.dispose();
    };
  }, [runtime]);
}
