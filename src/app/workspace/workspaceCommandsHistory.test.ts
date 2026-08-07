// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { COMMAND_TEST_IDS } from "../../domain/commands/commandTestSupport";
import { asEntityId } from "../../domain/ids/entityIds";
import { workspaceActions } from "./workspaceSlice";
import {
  createWorkspaceTestStore,
  FakePersistenceScheduler,
  loadTestWorkspace,
  renameCommand,
  savedDocument,
} from "./workspaceTestSupport";

function configuredStore() {
  const scheduler = new FakePersistenceScheduler();
  const store = createWorkspaceTestStore({
    databaseClient: { saveDocument: vi.fn(async () => savedDocument(5)) },
    scheduler,
  });
  loadTestWorkspace(store);
  return { store, scheduler };
}

describe("workspace command orchestration", () => {
  it("records one injected transaction and increments sequence for a recordable command", () => {
    const { store, scheduler } = configuredStore();
    const command = renameCommand("Application rename");
    const commandBefore = structuredClone(command);
    const source = store.getState().documentWorkspace.document!;

    const result = store.workspace.dispatchCommand(command);
    const state = store.getState().documentWorkspace;

    expect(result).toMatchObject({ ok: true, changed: true });
    expect(state.document!.canvases[COMMAND_TEST_IDS.canvasA].name).toBe("Application rename");
    expect(state.history.past).toHaveLength(1);
    expect(state.history.past[0]).toMatchObject({
      id: "transaction-00000000-0000-4000-8000-000000000020",
      committedAt: 100,
      label: "Rename canvas",
    });
    expect(state.localChangeSequence).toBe(1);
    expect(state.savePhase).toBe("scheduled");
    expect(scheduler.size).toBe(1);
    expect(command).toEqual(commandBefore);
    expect(source.canvases[COMMAND_TEST_IDS.canvasA].name).toBe("First canvas");
  });

  it("updates ignored document state without recording history", () => {
    const { store } = configuredStore();
    store.workspace.dispatchCommand({
      type: "document.canvas.create",
      payload: {
        canvas: {
          id: COMMAND_TEST_IDS.canvasB,
          name: "Second",
          settings: { width: 2_000, height: 2_000 },
        },
      },
    });
    const history = store.getState().documentWorkspace.history;

    const result = store.workspace.dispatchCommand({
      type: "document.canvas.set-active",
      payload: { canvasId: COMMAND_TEST_IDS.canvasB },
    });

    expect(result).toMatchObject({ ok: true, changed: true });
    expect(store.getState().documentWorkspace.document!.activeCanvasId).toBe(
      COMMAND_TEST_IDS.canvasB,
    );
    expect(store.getState().documentWorkspace.history).toBe(history);
    expect(store.getState().documentWorkspace.history.past).toHaveLength(1);
    expect(store.getState().documentWorkspace.localChangeSequence).toBe(2);
  });

  it("leaves document, history, dirty state, sequence, and scheduling unchanged for no-ops", () => {
    const { store, scheduler } = configuredStore();
    const before = store.getState().documentWorkspace;

    const result = store.workspace.dispatchCommand(renameCommand("First canvas"));

    expect(result).toMatchObject({ ok: true, changed: false });
    expect(store.getState().documentWorkspace).toBe(before);
    expect(scheduler.size).toBe(0);
  });

  it("fails commands atomically", () => {
    const { store, scheduler } = configuredStore();
    const before = store.getState().documentWorkspace;

    const result = store.workspace.dispatchCommand({
      type: "document.canvas.rename",
      payload: { canvasId: COMMAND_TEST_IDS.canvasB, name: "Missing" },
    });

    expect(result).toMatchObject({ ok: false, code: "command-failed" });
    expect(store.getState().documentWorkspace).toBe(before);
    expect(scheduler.size).toBe(0);
  });
});

describe("workspace undo and redo orchestration", () => {
  it("updates document, history, sequence, and scheduling atomically", () => {
    const { store, scheduler } = configuredStore();
    store.workspace.dispatchCommand(renameCommand("Changed"));
    store.workspace.cancelScheduledPersistence();

    const undone = store.workspace.undo();

    expect(undone).toMatchObject({ ok: true, changed: true });
    expect(
      store.getState().documentWorkspace.document!.canvases[COMMAND_TEST_IDS.canvasA].name,
    ).toBe("First canvas");
    expect(store.getState().documentWorkspace.history).toMatchObject({
      past: [],
      future: [expect.anything()],
    });
    expect(store.getState().documentWorkspace.localChangeSequence).toBe(2);
    expect(scheduler.size).toBe(1);

    store.workspace.cancelScheduledPersistence();
    const redone = store.workspace.redo();

    expect(redone).toMatchObject({ ok: true, changed: true });
    expect(
      store.getState().documentWorkspace.document!.canvases[COMMAND_TEST_IDS.canvasA].name,
    ).toBe("Changed");
    expect(store.getState().documentWorkspace.history.past).toHaveLength(1);
    expect(store.getState().documentWorkspace.localChangeSequence).toBe(3);
    expect(scheduler.size).toBe(1);
  });

  it("preserves ignored fields through unrelated history operations", () => {
    const { store } = configuredStore();
    store.workspace.dispatchCommand({
      type: "document.canvas.create",
      payload: {
        canvas: {
          id: COMMAND_TEST_IDS.canvasB,
          name: "Second",
          settings: { width: 2_000, height: 2_000 },
        },
      },
    });
    store.workspace.dispatchCommand({
      type: "document.canvas.set-active",
      payload: { canvasId: COMMAND_TEST_IDS.canvasB },
    });
    store.workspace.dispatchCommand(renameCommand("Changed"));

    expect(store.workspace.undo()).toMatchObject({ ok: true, changed: true });
    expect(store.getState().documentWorkspace.document!.activeCanvasId).toBe(
      COMMAND_TEST_IDS.canvasB,
    );
  });

  it("preserves the exact application state when history application fails", () => {
    const { store } = configuredStore();
    const state = store.getState().documentWorkspace;
    store.dispatch(
      workspaceActions.workspaceDocumentChanged({
        document: state.document!,
        history: {
          past: [
            {
              id: asEntityId("transaction", "transaction-00000000-0000-4000-8000-000000000099"),
              label: "Corrupt",
              committedAt: 1,
              patches: [{ op: "replace", path: ["missing"], value: true }],
              inversePatches: [{ op: "replace", path: ["missing"], value: false }],
            },
          ],
          future: [],
        },
      }),
    );
    const before = store.getState().documentWorkspace;

    expect(store.workspace.undo()).toMatchObject({ ok: false, code: "history-failed" });
    expect(store.getState().documentWorkspace).toBe(before);

    const redoStore = configuredStore().store;
    const redoState = redoStore.getState().documentWorkspace;
    redoStore.dispatch(
      workspaceActions.workspaceDocumentChanged({
        document: redoState.document!,
        history: {
          past: [],
          future: before.history.past,
        },
      }),
    );
    const beforeRedo = redoStore.getState().documentWorkspace;
    expect(redoStore.workspace.redo()).toMatchObject({ ok: false, code: "history-failed" });
    expect(redoStore.getState().documentWorkspace).toBe(beforeRedo);
  });
});
