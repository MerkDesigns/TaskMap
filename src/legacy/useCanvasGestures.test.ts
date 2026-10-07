import { renderHook } from "@testing-library/react";
import type { PointerEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CanvasInteractionController } from "../app/interactions/canvasInteractionController";
import type { InteractionElement } from "../app/interactions/canvasInteractionTypes";
import type { ContainerElement, ImageElement } from "../types";
import type { LegacyTextCardInteractionService } from "./interactions/legacyTextCardInteraction";
import type { RetainedCanvasContextValue } from "./RetainedCanvasContext";
import { useCanvasGestures, type CanvasGesturePorts } from "./useCanvasGestures";

const box: ContainerElement = {
  id: "box",
  name: "Box",
  x: 100,
  y: 50,
  width: 300,
  height: 200,
  accent: "#fff",
};
const image: ImageElement = { id: "image", x: 0, y: 0, width: 200, height: 100, accent: "#fff" };
const target = (id: string): InteractionElement => ({
  id,
  geometry: { x: 0, y: 0, width: 10, height: 10 },
  locked: false,
  movable: true,
  resizable: true,
});

function setup({ locked = [] as string[], selection = [] as string[] } = {}) {
  const controller = {
    beginPan: vi.fn(),
    beginResize: vi.fn(),
    select: vi.fn(),
    setSelection: vi.fn(),
    getSnapshot: () => ({ viewport: { zoom: 1 }, geometryPreviews: [] }),
  } as unknown as CanvasInteractionController;
  const beginMove = vi.fn(() => true);
  const ports: CanvasGesturePorts = {
    retained: { binding: { interaction: { beginMove } } } as unknown as RetainedCanvasContextValue,
    controller,
    cardDrags: { getDecision: vi.fn() } as unknown as LegacyTextCardInteractionService,
    connections: { move: () => false, finish: () => false, cancelPointer: vi.fn() },
    world: () => null,
    selection: () => selection,
    interactionElements: () => [target("box"), target("image")],
    gestureElement: (id) => target(id),
    scene: () => ({ containers: [box], textBlocks: [], textCards: [] }),
    isLocked: (id) => locked.includes(id),
    isFrameVisible: () => true,
    canvasPoint: () => ({ x: 0, y: 0 }),
    canvasSize: () => ({ width: 1000, height: 600 }),
    cardPosition: () => ({ x: 0, y: 0 }),
    containerCardCandidates: () => [],
    containerScrollOffsets: () => ({}),
    camera: () => ({ pan: { x: 0, y: 0 }, zoom: 1 }),
    editingCardId: () => null,
    saveOpenEdits: vi.fn(),
    saveTextBlockEdit: vi.fn(),
    endEditing: vi.fn(),
    endRename: vi.fn(),
    closeContextMenus: vi.fn(),
    showMinimap: vi.fn(),
  };
  const { result } = renderHook(() => useCanvasGestures(ports));
  return { gestures: result.current, controller, beginMove, ports };
}

const press = (init: Partial<{ button: number; ctrlKey: boolean; shiftKey: boolean }> = {}) =>
  ({
    button: 0,
    ctrlKey: false,
    shiftKey: false,
    pointerId: 1,
    clientX: 5,
    clientY: 5,
    target: document.body,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    currentTarget: { setPointerCapture: vi.fn(), closest: () => null },
    ...init,
  }) as unknown as PointerEvent<HTMLDivElement & HTMLButtonElement>;

describe("useCanvasGestures", () => {
  it("pans with the middle button or Ctrl+drag, not with a plain press", () => {
    const { gestures, controller } = setup();

    gestures.stagePointerDown(press());
    gestures.stagePointerDown(press({ button: 1 }));
    gestures.stagePointerDownCapture(press({ ctrlKey: true }));

    expect(controller.beginPan).toHaveBeenCalledTimes(2);
  });

  it("moves an element with the selection it is in", () => {
    const { gestures, beginMove } = setup({ selection: ["box", "image"] });

    gestures.moveFrame(press(), box);

    expect(beginMove).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryId: "box",
        targets: [target("box"), target("image")],
        completionBehavior: "translate",
      }),
    );
  });

  it("only selects a locked element, and Shift adds to the selection instead of moving", () => {
    const { gestures, beginMove, controller } = setup({ locked: ["box"] });

    gestures.moveFrame(press(), box);
    gestures.moveImage(press({ shiftKey: true }), image);

    expect(beginMove).not.toHaveBeenCalled();
    expect(controller.setSelection).toHaveBeenCalledWith(["box"]);
    expect(controller.select).toHaveBeenCalledWith("image", true);
  });

  it("resizes frames up to the canvas edge and images at their aspect ratio", () => {
    const { gestures, controller } = setup();

    gestures.resizeFrame(press(), box);
    gestures.resizeImage(press(), image);

    const [frame, picture] = vi
      .mocked(controller.beginResize)
      .mock.calls.map(([input]) => input.constraints);
    expect(frame.maximum).toEqual({ width: 900, height: 550 });
    expect(picture.aspectRatio).toBe(2);
    expect(picture.maximum).toEqual({ width: 1000, height: 600 });
  });

  it("does not resize a locked element", () => {
    const { gestures, controller } = setup({ locked: ["image"] });

    gestures.resizeImage(press(), image);

    expect(controller.beginResize).not.toHaveBeenCalled();
  });
});
