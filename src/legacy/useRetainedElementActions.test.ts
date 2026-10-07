import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import type { ContainerElement, ImageElement } from "../types";
import type { useCanvasGestures } from "./useCanvasGestures";
import type { useCanvasMenus } from "./useCanvasMenus";
import {
  useRetainedElementActions,
  type RetainedElementActionPorts,
} from "./useRetainedElementActions";
import type { RetainedInlineEdit } from "./useRetainedInlineEdit";

const box: ContainerElement = {
  id: "box",
  name: "Box",
  x: 0,
  y: 0,
  width: 300,
  height: 200,
  accent: "#fff",
};
const image: ImageElement = { id: "image", x: 0, y: 0, width: 10, height: 10, accent: "#fff" };

const edit = (editingId: string | null = null): RetainedInlineEdit => ({
  editingId,
  draft: "",
  setDraft: vi.fn(),
  begin: vi.fn(),
  complete: vi.fn(),
  end: vi.fn(),
});

function setup(overrides: Partial<RetainedElementActionPorts> = {}) {
  const complete = vi.fn();
  const ports: RetainedElementActionPorts = {
    callbacks: {
      captureContent: vi.fn(() => ({ complete })),
    } as unknown as RetainedActionCallbacks,
    find: {
      container: (id) => (id === box.id ? box : undefined),
      textBlock: () => undefined,
      image: (id) => (id === image.id ? image : undefined),
      card: () => undefined,
    },
    menus: {
      closeAll: vi.fn(),
      toggleBeside: vi.fn(),
    } as unknown as ReturnType<typeof useCanvasMenus>,
    gestures: { moveFrame: vi.fn() } as unknown as ReturnType<typeof useCanvasGestures>,
    rename: edit(),
    cardEdit: edit("card"),
    blockEdit: edit(),
    select: vi.fn(),
    pulse: vi.fn(),
    context: {
      updateAccent: vi.fn(),
      cut: vi.fn(),
      copy: vi.fn(),
      moveLayer: vi.fn(),
      remove: vi.fn(),
    },
    pickImage: vi.fn(),
    wheelContainer: vi.fn(),
    rememberCardSize: vi.fn(),
    ...overrides,
  };
  const hook = renderHook(() => useRetainedElementActions(ports));
  return { ...hook, ports, complete };
}

describe("useRetainedElementActions", () => {
  it("keeps every action object's identity across renders", () => {
    const { result, rerender } = setup();
    const first = result.current;

    rerender();

    expect(result.current.container).toBe(first.container);
    expect(result.current.textCardMenu).toBe(first.textCardMenu);
  });

  it("renames a frame from its menu and saves the name as one edit", () => {
    const { result, ports } = setup();

    result.current.containerMenu.onStartRename("box");
    result.current.container.onSaveRename("box");

    expect(ports.rename.begin).toHaveBeenCalledWith("box", "Box");
    expect(ports.rename.complete).toHaveBeenCalledOnce();
    expect(ports.menus.closeAll).toHaveBeenCalledTimes(2);
  });

  it("pulses the card whose edit was cancelled or saved", () => {
    const { result, ports } = setup();

    result.current.textCard.onCancel();
    result.current.textCard.onSave("other");

    expect(ports.cardEdit.end).toHaveBeenCalledOnce();
    expect(ports.cardEdit.complete).toHaveBeenCalledOnce();
    expect(ports.pulse).toHaveBeenNthCalledWith(1, "textCards", "card");
    expect(ports.pulse).toHaveBeenNthCalledWith(2, "textCards", "other");
  });

  it("flips an image's background and closes the menu", () => {
    const { result, ports, complete } = setup();

    result.current.imageMenu.onToggleBackground("image");

    expect(complete).toHaveBeenCalledWith([{ elementId: "image", to: { background: false } }]);
    expect(ports.menus.closeAll).toHaveBeenCalled();
  });

  it("ignores controls of an element that no longer exists", () => {
    const { result, ports } = setup();

    result.current.container.onSelect("gone", true);
    result.current.container.onToggleMenu({} as never, "gone");

    expect(ports.select).not.toHaveBeenCalled();
    expect(ports.menus.toggleBeside).not.toHaveBeenCalled();
  });

  it("applies context menu commands through the shared selection commands", () => {
    const { result, ports } = setup();

    result.current.imageMenu.onMoveLayer("image", "front");
    result.current.containerMenu.onDelete("box");

    expect(ports.context.moveLayer).toHaveBeenCalledWith("image", "front");
    expect(ports.context.remove).toHaveBeenCalledWith("box");
  });
});
