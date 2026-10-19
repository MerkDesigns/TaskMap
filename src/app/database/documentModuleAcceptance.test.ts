// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "../../domain/calendar/calendarSchema";
import {
  calendarDocumentModule,
  inboxDocumentModule,
  readDocumentModule,
} from "../../domain/document-modules/documentModules";
import { createCardContainerInput } from "../../elements/cardContainerTestFixtures";
import { FakePersistenceScheduler, savedDocument } from "../workspace/workspaceTestSupport";
import { acceptRetainedDocument } from "./acceptRetainedDocument";
import { createDatabaseWorkspace } from "./createDatabaseWorkspace";

const CALENDAR_INSTANCE = "extension-instance-00000000-0000-4000-8000-0000000000c1";
const INBOX_INSTANCE = "extension-instance-00000000-0000-4000-8000-0000000000d1";
const EVENT_ID = "calendar-event-00000000-0000-4000-8000-0000000000e1";
const NOW = 1_800_000_000_000;

const event: CalendarEvent = {
  id: EVENT_ID,
  title: "Dentist",
  timing: { kind: "timed", start: "2026-10-21T09:30", end: "2026-10-21T10:15" },
  location: "",
  accent: "#476FA8",
  alerts: [],
};

function loadedStore() {
  const { store } = createDatabaseWorkspace({
    expectedPurpose: "development",
    databaseClient: { saveDocument: vi.fn(async () => savedDocument(5)) },
    scheduler: new FakePersistenceScheduler(),
    acceptDocument: acceptRetainedDocument,
  });
  expect(store.workspace.load(createCardContainerInput(), 4).ok).toBe(true);
  return store;
}

function dispatch(store: ReturnType<typeof loadedStore>, type: string, payload: unknown) {
  const result = store.workspace.dispatchCommand({ type, payload });
  expect(result).toMatchObject({ ok: true });
}

const current = (store: ReturnType<typeof loadedStore>) =>
  store.getState().documentWorkspace.document!;

describe("document modules at the workspace boundary", () => {
  it("accepts calendar and inbox modules and keeps undo exact while alerts are recorded", () => {
    const store = loadedStore();
    dispatch(store, "calendar.event.create", { instanceId: CALENDAR_INSTANCE, event });
    dispatch(store, "inbox.alerts.record", {
      instanceId: INBOX_INSTANCE,
      entries: [],
      fired: { "event:dentist": NOW },
      scannedThrough: NOW,
      now: NOW,
    });
    dispatch(store, "calendar.event.update", { event: { ...event, title: "Dentist (moved)" } });
    expect(store.getState().documentWorkspace.history.past).toHaveLength(2);

    store.workspace.undo();
    expect(readDocumentModule(current(store), calendarDocumentModule)?.events[EVENT_ID].title).toBe(
      "Dentist",
    );
    store.workspace.undo();
    // Undoing the first event also removes the module record that command created.
    expect(readDocumentModule(current(store), calendarDocumentModule)).toBeNull();
    store.workspace.redo();
    store.workspace.redo();
    expect(readDocumentModule(current(store), calendarDocumentModule)?.events[EVENT_ID].title).toBe(
      "Dentist (moved)",
    );
    // The inbox record is untouched by undo and redo.
    expect(readDocumentModule(current(store), inboxDocumentModule)?.fired).toEqual({
      "event:dentist": NOW,
    });
    store.disposeWorkspace();
  });

  it("rejects documents with an invalid or unknown document module", () => {
    const store = loadedStore();
    const withModule = (extensionId: string, configuration: unknown) => {
      const input = createCardContainerInput() as unknown as {
        id: string;
        extensionInstallations: Record<string, unknown>;
      };
      input.extensionInstallations[CALENDAR_INSTANCE] = {
        id: CALENDAR_INSTANCE,
        extensionId,
        enabled: true,
        target: { kind: "document", documentId: input.id },
        configuration,
      };
      return input;
    };
    const valid = { version: 1, events: { [EVENT_ID]: event }, reminders: {} };
    expect(store.workspace.load(withModule("calendar", valid), 4).ok).toBe(true);
    expect(
      store.workspace.load(withModule("calendar", { ...valid, events: { [EVENT_ID]: {} } }), 4).ok,
    ).toBe(false);
    expect(store.workspace.load(withModule("weather", {}), 4).ok).toBe(false);
    store.disposeWorkspace();
  });
});
