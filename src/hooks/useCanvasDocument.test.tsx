import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_CANVAS } from "../app/defaultData";
import type { TaskCanvas } from "../types";
import { useCanvasDocument } from "./useCanvasDocument";

const secondCanvas: TaskCanvas = {
  ...DEFAULT_CANVAS,
  id: "canvas-2",
  name: "Canvas 2",
  containers: [],
};

describe("useCanvasDocument", () => {
  it("stores active element updates in the canonical canvas list", () => {
    const { result } = renderHook(() => useCanvasDocument());

    act(() => result.current.setElements([]));

    expect(result.current.activeCanvas.containers).toEqual([]);
    expect(result.current.canvases[0].containers).toEqual([]);
  });

  it("switches canvases without losing edits to the previous canvas", () => {
    const { result } = renderHook(() => useCanvasDocument());

    act(() => {
      result.current.setElements([]);
      result.current.setCanvases((current) => [...current, secondCanvas]);
      result.current.setActiveCanvas(secondCanvas);
    });

    expect(result.current.activeCanvas.id).toBe("canvas-2");
    expect(result.current.canvases.find(({ id }) => id === DEFAULT_CANVAS.id)?.containers).toEqual(
      [],
    );
  });

  it("updates an inactive canvas without changing the active canvas", () => {
    const { result } = renderHook(() => useCanvasDocument());

    act(() => {
      result.current.setCanvases((current) => [...current, secondCanvas]);
      result.current.setCanvases((current) =>
        current.map((canvas) =>
          canvas.id === secondCanvas.id ? { ...canvas, name: "Updated" } : canvas,
        ),
      );
    });

    expect(result.current.activeCanvas.id).toBe(DEFAULT_CANVAS.id);
    expect(result.current.canvases.find(({ id }) => id === secondCanvas.id)?.name).toBe("Updated");
  });
});
