// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createCoordinatorHarness } from "../materials/materialCompositorCoordinatorTestHarness";
import { advanceLiquidIndicator, createLiquidIndicatorState } from "./liquidIndicatorMotion";

describe("liquid motion and acrylic compositor integration", () => {
  it("coalesces moving indicator geometry without requesting expensive acrylic work", () => {
    const harness = createCoordinatorHarness("worker-offscreen");
    harness.coordinator.updatePresentation(harness.present(1));
    const surface = harness.register("liquid-indicator", "base");
    harness.executor.succeed(0);
    harness.frames.flush();
    const initialBuilds = harness.executor.starts.length;
    const initialMasks = harness.outputs.rebuildMask.mock.calls.length;
    let state = createLiquidIndicatorState({ left: 10, width: 72 });

    for (let sample = 0; sample < 120; sample += 1) {
      const frame = advanceLiquidIndicator(state, { left: 220, width: 160 }, 1000 / 60);
      state = frame.state;
      surface.rectangle = { left: frame.left, top: 20, width: frame.width, height: 32 };
      harness.registry.update({
        id: "liquid-indicator",
        element: surface,
        material: "acrylic-small",
        plane: "base",
        radiusPx: frame.radius,
      });
      harness.coordinator.notifySurfaceGeometryChanged();
    }

    expect(harness.executor.starts).toHaveLength(initialBuilds);
    expect(harness.frames.pending()).toBe(1);
    harness.frames.flush();
    expect(harness.outputs.rebuildMask).toHaveBeenCalledTimes(initialMasks + 1);
    expect(harness.executor.starts).toHaveLength(initialBuilds);
    harness.dispose();
  });
});
