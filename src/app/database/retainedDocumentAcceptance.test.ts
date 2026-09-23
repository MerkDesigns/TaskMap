// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createDatabaseWorkspace } from "./createDatabaseWorkspace";
import { acceptRetainedDocument } from "./acceptRetainedDocument";
import {
  createCardContainerInput,
  TEST_IDS as ids,
  validated,
} from "../../elements/cardContainerTestFixtures";
import { createImageInput, IMAGE_TEST_IDS } from "../../elements/image/imageTestFixtures";
import {
  FakePersistenceScheduler,
  savedDocument,
  unlockedSession,
} from "../workspace/workspaceTestSupport";
import { workspaceActions } from "../workspace/workspaceSlice";
import { COMMAND_TEST_IDS } from "../../domain/commands/commandTestSupport";
import { createAppStore } from "../store";

function setup(acceptDocument = acceptRetainedDocument) {
  const scheduler = new FakePersistenceScheduler();
  const saveDocument = vi.fn(async () => savedDocument(5));
  const database = createDatabaseWorkspace({
    expectedPurpose: "development",
    databaseClient: { saveDocument },
    scheduler,
    acceptDocument,
  });
  return { ...database, scheduler, saveDocument };
}
const replaceCard = (data: unknown) => ({
  type: "document.element.replace-data",
  payload: { elementId: ids.elementB, data },
});

describe("retained document acceptance at workspace boundaries", () => {
  it("admits a retained confirmed document cleanly; invalid confirmed content cannot load", () => {
    const { store, admitLoadedDocument, scheduler } = setup();
    const input = createCardContainerInput();
    input.elements[ids.elementB].data.secret = "private content";
    const before = store.getState().documentWorkspace;
    const load = (document: unknown) =>
      admitLoadedDocument({
        serializedDocument: JSON.stringify(document),
        revision: 4,
        session: unlockedSession,
      });
    expect(load(input)).toMatchObject({ ok: false, error: { code: "invalid_document_payload" } });
    expect(store.getState().documentWorkspace).toBe(before);
    delete input.elements[ids.elementB].data.secret;
    expect(load(input).ok).toBe(true);
    expect(store.getState().documentWorkspace).toMatchObject({
      localChangeSequence: 0,
      history: { past: [], future: [] },
    });
    expect(scheduler.size).toBe(0);
    store.disposeWorkspace();
  });

  it.each(["element", "placement", "extension", "connection", "media"])(
    "rejects invalid %s data without replacing the current workspace",
    (kind) => {
      const { store } = setup();
      expect(store.workspace.load(createCardContainerInput(), 4).ok).toBe(true);
      const before = store.getState().documentWorkspace;
      const input = createImageInput();
      if (kind === "element") input.elements[ids.elementB].type = "unknown";
      if (kind === "placement")
        input.elements[ids.elementB].data.placement = { containerId: ids.elementB, order: 1 };
      if (kind === "media") delete input.mediaReferences[ids.media];
      if (kind === "extension")
        input.extensionInstallations[ids.extensionA] = {
          id: ids.extensionA,
          extensionId: "command-runner",
          enabled: false,
          target: { kind: "element", elementId: ids.elementB },
          configuration: { command: "secret" },
        };
      if (kind === "connection")
        input.connections[ids.connection] = {
          id: ids.connection,
          canvasId: ids.canvasA,
          type: "mind-map",
          data: {},
          source: { elementId: ids.elementB, portId: "left" },
          target: { elementId: IMAGE_TEST_IDS.image, portId: "right" },
        };
      expect(store.workspace.load(input, 5).ok).toBe(false);
      expect(store.getState().documentWorkspace).toBe(before);
      store.disposeWorkspace();
    },
  );

  it.each([
    replaceCard({ text: "secret" }),
    replaceCard({
      ...createCardContainerInput().elements[ids.elementB].data,
      placement: { containerId: ids.elementB, order: 0 },
    }),
    { type: "document.element.remove", payload: { elementId: ids.elementA } },
    {
      type: "document.extension.install",
      payload: {
        installation: {
          id: ids.extensionA,
          extensionId: "checkbox",
          enabled: false,
          configuration: { checked: false },
          target: { kind: "element", elementId: ids.elementA },
        },
      },
    },
  ])("rejects invalid completed edits before state/history/save publication: $type", (command) => {
    const { store, scheduler, saveDocument } = setup();
    store.workspace.load(createCardContainerInput(), 4);
    const before = store.getState().documentWorkspace;
    const result = store.workspace.dispatchCommand(command);
    expect(result).toMatchObject({
      ok: false,
      code: "command-failed",
      issues: [{ code: "command-rejected", path: "document" }],
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(store.getState().documentWorkspace).toBe(before);
    expect(scheduler.size).toBe(0);
    expect(saveDocument).not.toHaveBeenCalled();
    store.disposeWorkspace();
  });

  it("keeps valid edits, undo/redo, one dirty save and immutable source identity", async () => {
    const { store, saveDocument } = setup();
    const document = validated(createCardContainerInput());
    store.workspace.load(document, 4);
    expect(
      store.workspace.dispatchCommand(
        replaceCard({ ...document.elements[ids.elementB].data, text: "Edited" }),
      ).ok,
    ).toBe(true);
    expect(store.getState().documentWorkspace.history.past).toHaveLength(1);
    expect(store.workspace.undo().ok).toBe(true);
    expect(store.getState().documentWorkspace.document?.elements[ids.elementB].data.text).toBe(
      document.elements[ids.elementB].data.text,
    );
    expect(store.workspace.redo().ok).toBe(true);
    await store.workspace.flushSave();
    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(store.getState().documentWorkspace.savePhase).toBe("clean");
    store.disposeWorkspace();
  });

  it("preserves an already scheduled valid save when a later edit or load is rejected", async () => {
    const { store, scheduler, saveDocument } = setup();
    const input = createCardContainerInput();
    store.workspace.load(input, 4);
    store.workspace.dispatchCommand(
      replaceCard({ ...input.elements[ids.elementB].data, text: "Valid edit" }),
    );
    const before = store.getState().documentWorkspace;
    const pending = scheduler.size;
    expect(pending).toBe(1);
    expect(store.workspace.dispatchCommand(replaceCard({ text: "invalid" })).ok).toBe(false);
    input.elements[ids.elementB].data = { text: "invalid" };
    expect(store.workspace.load(input, 9).ok).toBe(false);
    expect(store.getState().documentWorkspace).toBe(before);
    expect(scheduler.size).toBe(pending);
    await store.workspace.flushSave();
    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(store.getState().documentWorkspace.document?.elements[ids.elementB].data.text).toBe(
      "Valid edit",
    );
    store.disposeWorkspace();
  });

  it.each(["undo", "redo"] as const)(
    "rejects structurally valid but feature-invalid %s patches atomically",
    (operation) => {
      const { store, scheduler } = setup();
      store.workspace.load(createCardContainerInput(), 4);
      const current = store.getState().documentWorkspace;
      const path = ["elements", ids.elementB, "data", "text"];
      const bad = [{ op: "replace" as const, path, value: 42 }];
      const original = [
        { op: "replace" as const, path, value: current.document!.elements[ids.elementB].data.text },
      ];
      const transaction = {
        id: COMMAND_TEST_IDS.transaction,
        label: "Test incompatible history",
        committedAt: 1,
        patches: operation === "redo" ? bad : original,
        inversePatches: operation === "undo" ? bad : original,
      };
      // Deliberate internal history corruption: no public command should be able to create this entry.
      store.dispatch(
        workspaceActions.workspaceDocumentChanged({
          document: current.document!,
          history: {
            past: operation === "undo" ? [transaction] : [],
            future: operation === "redo" ? [transaction] : [],
          },
        }),
      );
      const before = store.getState().documentWorkspace;
      expect(store.workspace[operation]()).toMatchObject({ ok: false, code: "history-failed" });
      expect(store.getState().documentWorkspace).toBe(before);
      expect(scheduler.size).toBe(0);
      store.disposeWorkspace();
    },
  );

  it("fails closed on policy exceptions without logging or replacing state", () => {
    let fail = false;
    const { store } = setup((document) => {
      if (fail) throw new Error("private exception");
      return acceptRetainedDocument(document);
    });
    store.workspace.load(createCardContainerInput(), 4);
    const before = store.getState().documentWorkspace;
    fail = true;
    expect(store.workspace.load(createCardContainerInput(), 4).ok).toBe(false);
    expect(
      store.workspace.dispatchCommand(
        replaceCard(createCardContainerInput().elements[ids.elementB].data),
      ).ok,
    ).toBe(false);
    expect(store.workspace.undo().ok).toBe(false);
    expect(store.getState().documentWorkspace).toBe(before);
    store.disposeWorkspace();
  });

  it("leaves generic domain/harness workspaces feature-agnostic when no policy is supplied", () => {
    const store = createAppStore();
    const input = createCardContainerInput();
    input.elements[ids.elementB].type = "test-card";
    expect(store.workspace.load(input, 0).ok).toBe(true);
    store.disposeWorkspace();
  });
});
