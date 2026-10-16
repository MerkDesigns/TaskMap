import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  CanvasInteractionController,
  CanvasInteractionSnapshot,
} from "../../app/interactions/canvasInteractionTypes";
import { useLegacyInteractionSnapshot } from "./useLegacyInteractionSnapshot";

function fakeController() {
  let snapshot = {
    canvasKey: "canvas",
    activeInteraction: { kind: "move", pointerId: 1, targetIds: ["card"] },
    selectedIds: [],
    selectionPreviewIds: [],
    selectionRectangle: null,
    geometryPreviews: [],
    snapGuides: [],
  } as unknown as CanvasInteractionSnapshot;
  const listeners = new Set<() => void>();
  const controller = {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as CanvasInteractionController;
  const publish = (change: Partial<CanvasInteractionSnapshot>) =>
    act(() => {
      snapshot = { ...snapshot, ...change };
      listeners.forEach((listener) => listener());
    });
  return { controller, publish };
}

const preview = (x: number) =>
  [
    { id: "card", geometry: { x, y: 0, width: 100, height: 40 } },
  ] as unknown as CanvasInteractionSnapshot["geometryPreviews"];

describe("legacy interaction snapshot", () => {
  it("does not re-render for previews of elements an overlay draws, but for anything else", () => {
    const { controller, publish } = fakeController();
    let drawnElsewhere = true;
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useLegacyInteractionSnapshot(controller, () => drawnElsewhere);
    });
    const held = result.current;

    publish({ geometryPreviews: preview(10) });
    publish({ geometryPreviews: preview(20) });
    expect(result.current).toBe(held);
    expect(renders).toBe(1);

    publish({ selectedIds: ["card"] });
    expect(result.current.selectedIds).toEqual(["card"]);

    drawnElsewhere = false;
    publish({ geometryPreviews: preview(30) });
    expect(result.current.geometryPreviews).toEqual(preview(30));
  });
});
