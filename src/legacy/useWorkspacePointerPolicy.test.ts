import { renderHook } from "@testing-library/react";
import type { MouseEvent, PointerEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWorkspacePointerPolicy, type WorkspacePointerPorts } from "./useWorkspacePointerPolicy";

afterEach(() => {
  document.body.replaceChildren();
});

function setup(renaming: string | null = null) {
  const world = document.createElement("div");
  const ports: WorkspacePointerPorts = {
    worldRef: { current: world },
    renamingId: () => renaming,
    saveRename: vi.fn(),
    closeContextMenus: vi.fn(),
    openCanvasMenu: vi.fn(),
  };
  const { result } = renderHook(() => useWorkspacePointerPolicy(ports));
  return { policy: result.current, ports, world };
}

const press = (target: Element, button = 0) =>
  ({ button, target }) as unknown as PointerEvent<HTMLElement>;

describe("useWorkspacePointerPolicy", () => {
  it("saves an open rename and closes menus on a press elsewhere", () => {
    const { policy, ports } = setup("box");

    policy.onPointerDownCapture(press(document.body));

    expect(ports.saveRename).toHaveBeenCalled();
    expect(ports.closeContextMenus).toHaveBeenCalled();
  });

  it("leaves menus to their own trigger so the trigger's toggle does not reopen them", () => {
    const { policy, ports } = setup();
    const trigger = document.createElement("button");
    trigger.setAttribute("data-context-menu-trigger", "");
    document.body.append(trigger);

    policy.onPointerDownCapture(press(trigger));
    policy.onPointerDownCapture(press(document.body, 2));

    expect(ports.closeContextMenus).not.toHaveBeenCalled();
  });

  it("opens the canvas menu only for a right-click on empty canvas", () => {
    const { policy, ports, world } = setup();
    const event = (target: Element) =>
      ({
        target,
        clientX: 5,
        clientY: 6,
        preventDefault: vi.fn(),
      }) as unknown as MouseEvent<HTMLDivElement>;

    policy.onCanvasContextMenu(event(document.body));
    policy.onCanvasContextMenu(event(world));

    expect(ports.openCanvasMenu).toHaveBeenCalledTimes(1);
    expect(ports.openCanvasMenu).toHaveBeenCalledWith(5, 6);
  });

  it("turns spellcheck off while the workspace is mounted", () => {
    setup();

    expect(document.body.getAttribute("spellcheck")).toBe("false");
  });
});
