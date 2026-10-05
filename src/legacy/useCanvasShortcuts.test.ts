import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCanvasShortcuts, type CanvasShortcutPorts } from "./useCanvasShortcuts";
import type { LeftPanelState } from "./useLeftPanel";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function setup(overrides: Partial<CanvasShortcutPorts> = {}, panel: LeftPanelState = "closed") {
  const ports = {
    modalOpen: () => false,
    setConnectionMode: vi.fn(),
    setShiftHeld: vi.fn(),
    openQuickExtensionsAtPointer: vi.fn(),
    closeQuickExtensions: vi.fn(),
    leftPanel: { current: () => panel, show: vi.fn(), close: vi.fn() },
    closeContextMenus: vi.fn(),
    endRename: vi.fn(),
    deleteSelection: vi.fn(),
    copySelection: vi.fn(() => true),
    canPaste: () => true,
    pasteAtPointer: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    cycleCanvases: vi.fn(),
    cyclingCanvases: () => false,
    finishCanvasCycle: vi.fn(),
    ...overrides,
  } satisfies CanvasShortcutPorts;
  const hook = renderHook((current: CanvasShortcutPorts) => useCanvasShortcuts(current), {
    initialProps: ports,
  });
  return { ports, rerender: hook.rerender };
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

const release = (key: string, init: KeyboardEventInit = {}) =>
  document.body.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, ...init }));

function textField() {
  const input = document.createElement("input");
  document.body.append(input);
  return input;
}

describe("useCanvasShortcuts", () => {
  it("shows connection ports while C is held, but not while typing", () => {
    const { ports } = setup();

    press("c", { code: "KeyC" });
    release("c", { code: "KeyC" });
    press("c", { code: "KeyC" }, textField());

    expect(vi.mocked(ports.setConnectionMode).mock.calls).toEqual([[true], [false]]);
  });

  it("toggles the Canvas Browser with Tab and switches panels with Shift+Tab", () => {
    const closed = setup();
    press("Tab");
    expect(closed.ports.leftPanel.show).toHaveBeenCalledWith("canvases");
    cleanup();

    const browsing = setup({}, "canvases");
    press("Tab");
    press("Tab", { shiftKey: true });
    expect(browsing.ports.leftPanel.close).toHaveBeenCalledWith("canvases");
    expect(browsing.ports.leftPanel.show).toHaveBeenCalledWith("extensions");
  });

  it("closes menus and panels on Escape, unless a context menu has focus", () => {
    const { ports } = setup();
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.setAttribute("data-context-menu", "");
    document.body.append(menu);

    press("Escape", {}, menu);
    expect(ports.closeContextMenus).not.toHaveBeenCalled();

    press("Escape");
    expect(ports.closeContextMenus).toHaveBeenCalled();
    expect(ports.leftPanel.close).toHaveBeenCalledWith("canvases");
    expect(ports.leftPanel.close).toHaveBeenCalledWith("extensions");
  });

  it("deletes the selection with Delete, except in a text field or a dialog", () => {
    const { ports } = setup();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);

    press("Delete", {}, textField());
    press("Delete", {}, dialog);
    press("Delete");

    expect(ports.deleteSelection).toHaveBeenCalledOnce();
  });

  it("claims Ctrl+C only when something was copied, and pastes only a copy", () => {
    const { ports } = setup({ copySelection: vi.fn(() => false), canPaste: () => false });

    expect(press("c", { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(press("v", { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(ports.pasteAtPointer).not.toHaveBeenCalled();
  });

  it("undoes and redoes, but not while a modal is open", () => {
    let modal = false;
    const { ports } = setup({ modalOpen: () => modal });

    press("z", { ctrlKey: true });
    press("z", { ctrlKey: true, shiftKey: true });
    press("y", { ctrlKey: true });
    modal = true;
    press("z", { ctrlKey: true });

    expect(ports.undo).toHaveBeenCalledOnce();
    expect(ports.redo).toHaveBeenCalledTimes(2);
  });

  it("cycles canvases with Ctrl+Tab and finishes when Ctrl is released", () => {
    const { ports } = setup({ cyclingCanvases: () => true });

    press("Tab", { ctrlKey: true, shiftKey: true });
    release("Control");

    expect(ports.cycleCanvases).toHaveBeenCalledWith(-1);
    expect(ports.finishCanvasCycle).toHaveBeenCalledOnce();
    expect(ports.leftPanel.show).not.toHaveBeenCalled();
  });

  it("uses the latest ports without registering again", () => {
    const { ports, rerender } = setup();
    const deleteSelection = vi.fn();
    const add = vi.spyOn(window, "addEventListener");

    rerender({ ...ports, deleteSelection });
    press("Delete");

    expect(deleteSelection).toHaveBeenCalledOnce();
    expect(ports.deleteSelection).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    add.mockRestore();
  });
});
