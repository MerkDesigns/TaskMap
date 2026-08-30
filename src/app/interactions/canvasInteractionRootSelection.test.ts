import { describe, expect, it } from "vitest";
import { createViewport } from "../../canvas/geometry/viewportMath";
import { CANVAS_CULLING_REFRESH_SCREEN_PX } from "../../canvas/virtualization/viewportCulling";
import type { CanvasInteractionSnapshot } from "./canvasInteractionTypes";
import { canvasInteractionRootSnapshotsEqual } from "./canvasInteractionRootSelection";

describe("canvasInteractionRootSnapshotsEqual", () => {
  it("suppresses short viewport-only pan samples but admits the culling threshold", () => {
    const previous = snapshot();
    const withinGuard = {
      ...previous,
      viewport: createViewport(
        { x: CANVAS_CULLING_REFRESH_SCREEN_PX - 1, y: 0 },
        1,
        previous.viewport.screen,
      ),
    };
    const acrossGuard = {
      ...previous,
      viewport: createViewport(
        { x: CANVAS_CULLING_REFRESH_SCREEN_PX, y: 0 },
        1,
        previous.viewport.screen,
      ),
    };

    expect(canvasInteractionRootSnapshotsEqual(previous, withinGuard)).toBe(true);
    expect(canvasInteractionRootSnapshotsEqual(previous, acrossGuard)).toBe(false);
  });

  it("admits pan lifecycle and non-viewport interaction changes", () => {
    const previous = snapshot();

    expect(
      canvasInteractionRootSnapshotsEqual(previous, { ...previous, activeInteraction: null }),
    ).toBe(false);
    expect(
      canvasInteractionRootSnapshotsEqual(previous, {
        ...previous,
        selectedIds: ["selected"],
      }),
    ).toBe(false);
  });
});

function snapshot(): CanvasInteractionSnapshot {
  return {
    canvasKey: "canvas",
    viewport: createViewport({ x: 0, y: 0 }, 1, { width: 1280, height: 820 }),
    activeInteraction: { kind: "pan", pointerId: 1 },
    selectedIds: [],
    selectionPreviewIds: [],
    selectionRectangle: null,
    geometryPreviews: [],
    snapGuides: [],
  };
}
