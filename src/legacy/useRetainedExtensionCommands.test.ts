import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import {
  contextActionIds,
  useRetainedExtensionCommands,
  type RetainedExtensionCommandPorts,
} from "./useRetainedExtensionCommands";

function setup(selection: string[] = []) {
  const completion = { complete: vi.fn(() => ({ ok: true })), cancel: vi.fn() };
  const callbacks = {
    captureExtensionToggle: vi.fn(() => completion),
    captureExtensionRemove: vi.fn(() => completion),
    captureExtensionConfiguration: vi.fn(() => completion),
    captureContent: vi.fn(() => completion),
  } as unknown as RetainedActionCallbacks;
  const ports: RetainedExtensionCommandPorts = {
    callbacks,
    selection: () => selection,
    rememberRecentColor: vi.fn(),
    resetContainerScroll: vi.fn(),
    closeContextMenus: vi.fn(),
    copyPasteJson: {
      copyJsonForAi: vi.fn(),
      pasteJsonFromAi: vi.fn(),
      openJsonEditor: vi.fn(),
      closeEditorFor: vi.fn(),
    },
    openWorkflowEditor: vi.fn(),
    workflowRuns: {
      runWorkflow: vi.fn(),
      stopWorkflow: vi.fn(),
      subscribeWorkflowRuns: vi.fn(),
      getWorkflowRun: vi.fn(),
    },
  };
  const { result, rerender } = renderHook(() => useRetainedExtensionCommands(ports));
  return { commands: () => result.current, rerender, callbacks, completion, ports };
}

describe("contextActionIds", () => {
  it("acts on the whole selection only when the element is part of a multi-selection", () => {
    expect(contextActionIds(["a", "b"], "a")).toEqual(["a", "b"]);
    expect(contextActionIds(["a", "b"], "c")).toEqual(["c"]);
    expect(contextActionIds(["a"], "a")).toEqual(["a"]);
  });
});

describe("useRetainedExtensionCommands", () => {
  it("locks with the current selection, and toggles privacy per element", () => {
    const { commands, callbacks } = setup(["box", "block"]);

    commands().toggle("lock", "box");
    commands().toggle("privacy", "box");

    expect(callbacks.captureExtensionToggle).toHaveBeenNthCalledWith(1, "lock", "box", [
      "box",
      "block",
    ]);
    expect(callbacks.captureExtensionToggle).toHaveBeenNthCalledWith(
      2,
      "privacy",
      "box",
      undefined,
    );
  });

  it("removes search from the selection and starts its containers' lists at the top", () => {
    const { commands, callbacks, ports } = setup(["box", "other"]);

    commands().remove("search", "box");

    expect(callbacks.captureExtensionRemove).toHaveBeenCalledWith(expect.anything(), [
      "box",
      "other",
    ]);
    expect(ports.resetContainerScroll).toHaveBeenCalledWith(["box", "other"]);
    expect(ports.closeContextMenus).toHaveBeenCalled();
  });

  it("recolours the selection the element is in as one edit", () => {
    const { commands, completion } = setup(["box", "card"]);

    commands().updateSelectionAccent("card", "#476FA8");

    expect(completion.complete).toHaveBeenCalledOnce();
    expect(completion.complete).toHaveBeenCalledWith([
      { elementId: "box", to: { accent: "#476FA8" } },
      { elementId: "card", to: { accent: "#476FA8" } },
    ]);
  });

  it("stays the same object across renders", () => {
    const { commands, rerender } = setup();
    const first = commands();

    rerender();

    expect(commands()).toBe(first);
  });
});
