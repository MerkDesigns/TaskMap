// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createCanvasInteractionController } from "../../app/interactions/canvasInteractionController";
import { createViewport } from "../../canvas/geometry/viewportMath";
import { applyLegacySelectionAction } from "./legacySelectionCompatibility";

describe("legacy selection compatibility", () => {
  it("composes synchronous functional actions from the current controller snapshot", () => {
    const controller = createCanvasInteractionController({
      canvasKey: "canvas",
      viewport: createViewport({ x: 0, y: 0 }, 1, { width: 100, height: 100 }),
      commitPort: { commitMove: vi.fn(), commitResize: vi.fn(), commitLayerOrder: vi.fn() },
    });
    controller.setSelection(["a", "b"]);
    applyLegacySelectionAction(controller, (current) => current.filter((id) => id !== "a"));
    applyLegacySelectionAction(controller, (current) => [...current, "c"]);
    expect(controller.getSnapshot().selectedIds).toEqual(["b", "c"]);
  });

  it("cannot resurrect an ID removed by an earlier synchronous update", () => {
    const controller = createCanvasInteractionController({
      canvasKey: "canvas",
      viewport: createViewport({ x: 0, y: 0 }, 1, { width: 100, height: 100 }),
      commitPort: { commitMove: vi.fn(), commitResize: vi.fn(), commitLayerOrder: vi.fn() },
    });
    controller.setSelection(["removed", "kept"]);
    applyLegacySelectionAction(controller, (current) => current.slice(1));
    applyLegacySelectionAction(controller, (current) => [...current, "new"]);
    expect(controller.getSnapshot().selectedIds).toEqual(["kept", "new"]);
  });
});
