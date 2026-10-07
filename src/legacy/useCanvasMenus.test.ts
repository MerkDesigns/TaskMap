import { act, renderHook } from "@testing-library/react";
import type { MouseEvent, PointerEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { useCanvasMenus, type CanvasMenuPorts } from "./useCanvasMenus";

function setup(selection: string[] = [], connectionMode = false) {
  const ports: CanvasMenuPorts = {
    selection: () => selection,
    select: vi.fn(),
    endRename: vi.fn(),
    endTextCardEdit: vi.fn(),
    connectionMode: () => connectionMode,
  };
  const { result } = renderHook(() => useCanvasMenus(ports));
  return { menus: () => result.current, ports };
}

const pointer = (clientX: number, clientY: number) =>
  ({
    clientX,
    clientY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }) as unknown as MouseEvent<HTMLElement> & PointerEvent<SVGPathElement>;

const button = (right: number, top: number) =>
  ({
    stopPropagation: vi.fn(),
    currentTarget: { getBoundingClientRect: () => ({ right, top }) },
  }) as unknown as MouseEvent<HTMLButtonElement>;

describe("useCanvasMenus", () => {
  it("opens a right-click menu at the pointer and selects the element unless it is selected", () => {
    const { menus, ports } = setup(["card"]);

    act(() => menus().openAtPointer("textCard", pointer(100, 50), "card"));
    expect(menus().pairs.textCard.menu).toEqual({ id: "card", left: 108, top: 58 });
    expect(ports.select).not.toHaveBeenCalled();
    expect(ports.endTextCardEdit).toHaveBeenCalled();

    act(() => menus().openAtPointer("image", pointer(10, 10), "image"));
    expect(ports.select).toHaveBeenCalledWith(["image"]);
    expect(menus().pairs.textCard.menu).toBeNull();
  });

  it("opens a header menu beside its button and closes it on a second press", () => {
    const { menus } = setup();

    act(() => menus().toggleBeside("container", button(300, 40), "box"));
    expect(menus().pairs.container.menu).toEqual({ id: "box", left: 308, top: 40 });

    act(() => menus().toggleBeside("container", button(300, 40), "box"));
    expect(menus().pairs.container.menu).toBeNull();
    expect(menus().pairs.container.closing).toEqual({ id: "box", left: 308, top: 40 });
  });

  it("switches a header menu to another element in one press", () => {
    const { menus } = setup();
    act(() => menus().toggleBeside("container", button(300, 40), "box"));

    act(() => menus().toggleBeside("textBlock", button(500, 60), "block"));

    expect(menus().pairs.container.menu).toBeNull();
    expect(menus().pairs.textBlock.menu).toEqual({ id: "block", left: 508, top: 60 });
  });

  it("opens the canvas menu with nothing selected", () => {
    const { menus, ports } = setup(["box"]);

    act(() => menus().openCanvas(400, 300));

    expect(ports.select).toHaveBeenCalledWith([]);
    expect(menus().pairs.canvas.menu).toEqual({ clientX: 400, clientY: 300 });
  });

  it("opens a connection menu only in connection mode", () => {
    const off = setup();
    act(() => off.menus().openConnection(pointer(20, 20), "link"));
    expect(off.menus().connection).toBeNull();

    const on = setup([], true);
    act(() => on.menus().openConnection(pointer(20, 20), "link"));
    expect(on.menus().connection).toEqual({ id: "link", left: 28, top: 28 });
    act(() => on.menus().closeAll());
    expect(on.menus().connection).toBeNull();
  });
});
