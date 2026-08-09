// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createCoordinatorHarness as createHarness } from "./materialCompositorCoordinatorTestHarness";

describe("production material compositor coordination", () => {
  it("stays inert without surfaces, then coalesces 120 covered viewport samples", () => {
    const harness = createHarness("worker-offscreen");
    harness.coordinator.updatePresentation(harness.present(1));
    expect(harness.executor.starts).toHaveLength(0);
    harness.register("surface", "base");
    expect(harness.executor.starts).toHaveLength(1);
    harness.executor.succeed(0);
    harness.frames.flush();
    const initialMasks = harness.outputs.rebuildMask.mock.calls.length;
    const initialComposes = harness.outputs.compose.mock.calls.length;

    for (let sample = 1; sample <= 120; sample += 1) {
      harness.coordinator.updatePresentation(
        harness.present(1, { pan: { x: sample / 10, y: -sample / 20 } }),
      );
    }

    expect(harness.executor.starts).toHaveLength(1);
    expect(harness.frames.pending()).toBe(1);
    harness.frames.flush();
    expect(harness.outputs.compose).toHaveBeenCalledTimes(initialComposes + 1);
    expect(harness.outputs.rebuildMask).toHaveBeenCalledTimes(initialMasks);
    harness.dispose();
  });

  it("ignores transient drag samples and requests one build for a settled visual revision", () => {
    const harness = createHarness("worker-offscreen");
    harness.coordinator.updatePresentation(harness.present(1));
    harness.register("surface", "base");
    harness.executor.succeed(0);
    harness.frames.flush();
    for (let sample = 0; sample < 120; sample += 1) {
      harness.coordinator.updatePresentation(harness.present(1, { interactionActive: true }));
    }
    expect(harness.executor.starts).toHaveLength(1);
    harness.coordinator.updatePresentation(harness.present(2));
    expect(harness.executor.starts).toHaveLength(2);
    expect(harness.sceneBuilds).toHaveBeenCalledTimes(2);
    harness.dispose();
  });

  it("rebuilds only masks for surface resize, radius, and explicit plane changes", () => {
    const harness = createHarness("worker-offscreen");
    harness.coordinator.updatePresentation(harness.present(1));
    const surface = harness.register("surface", "base");
    harness.executor.succeed(0);
    harness.frames.flush();
    const initialBuilds = harness.executor.starts.length;
    const initialMasks = harness.outputs.rebuildMask.mock.calls.length;

    surface.rectangle = { left: 20, top: 30, width: 180, height: 70 };
    harness.registry.refreshMeasurements();
    harness.frames.flush();
    expect(harness.outputs.rebuildMask).toHaveBeenCalledTimes(initialMasks + 1);
    expect(harness.executor.starts).toHaveLength(initialBuilds);

    harness.registry.update({
      id: "surface",
      element: surface,
      material: "acrylic-large",
      plane: "modal",
      radiusPx: 20,
    });
    harness.frames.flush();
    const latest = harness.outputs.rebuildMask.mock.calls.slice(-2);
    expect(latest.map(([plane]) => plane)).toEqual(["base", "modal"]);
    expect(harness.executor.starts).toHaveLength(initialBuilds);
    harness.dispose();
  });

  it("requests coverage-required Worker work during an active long pan", () => {
    const harness = createHarness("worker-offscreen");
    harness.coordinator.updatePresentation(harness.present(1));
    harness.register("surface", "base");
    harness.executor.succeed(0);
    harness.frames.flush();
    harness.coordinator.updatePresentation(
      harness.present(1, { pan: { x: 250, y: 0 }, interactionActive: true }),
    );
    expect(harness.executor.starts).toHaveLength(2);
    expect(harness.executor.starts[1].payload.descriptor.anchor.viewport.pan.x).toBe(250);
    harness.dispose();
  });

  it("wires interaction-active state so main-thread fallback waits for settlement", () => {
    const harness = createHarness("main-thread-fallback");
    harness.coordinator.updatePresentation(harness.present(1, { interactionActive: true }));
    harness.register("surface", "base");
    expect(harness.executor.starts).toHaveLength(0);
    expect(harness.runtime.getSnapshot().deferred).toBe(true);
    harness.coordinator.updatePresentation(harness.present(1, { interactionActive: false }));
    expect(harness.executor.starts).toHaveLength(1);
    harness.dispose();
  });

  it("resizes output buffers and requests a dimension-compatible cache", () => {
    const harness = createHarness("worker-offscreen");
    harness.coordinator.updatePresentation(harness.present(1));
    harness.register("surface", "base");
    harness.executor.succeed(0);
    harness.frames.flush();
    harness.coordinator.updatePresentation(
      harness.present(1, { screen: { width: 900, height: 500 } }),
    );
    expect(harness.outputs.resize).toHaveBeenCalledTimes(2);
    expect(harness.executor.starts).toHaveLength(2);
    expect(harness.executor.starts[1].payload.descriptor.outputBackingSize).not.toEqual(
      harness.executor.starts[0].payload.descriptor.outputBackingSize,
    );
    harness.dispose();
  });

  it("never composes an accepted cache from a different canvas", () => {
    const harness = createHarness("worker-offscreen");
    harness.coordinator.updatePresentation(harness.present(1, { sceneKey: "canvas-a" }));
    harness.register("surface", "base");
    harness.executor.succeed(0);
    harness.frames.flush();

    harness.coordinator.updatePresentation(harness.present(1, { sceneKey: "canvas-b" }));
    expect(harness.executor.starts).toHaveLength(2);
    harness.frames.flush();
    expect(last(harness.outputs.compose.mock.calls)?.[0]).toBeNull();

    harness.executor.succeed(1);
    harness.frames.flush();
    expect(last(harness.outputs.compose.mock.calls)?.[0]?.descriptor.scene.key).toBe("canvas-b");
    harness.dispose();
  });

  it("retains an accepted cache while a newer revision of the same scene is pending", () => {
    const harness = createHarness("worker-offscreen");
    harness.coordinator.updatePresentation(harness.present(1));
    harness.register("surface", "base");
    harness.executor.succeed(0);
    harness.frames.flush();

    harness.coordinator.updatePresentation(harness.present(2));
    harness.frames.flush();

    const accepted = last(harness.outputs.compose.mock.calls)?.[0];
    expect(accepted?.descriptor.scene).toEqual({ key: "scene-a", revision: 1 });
    expect(harness.executor.starts).toHaveLength(2);
    harness.dispose();
  });

  it("turns explicit position-only surface movement into mask-only work", () => {
    const harness = createHarness("worker-offscreen");
    harness.coordinator.updatePresentation(harness.present(1));
    const surface = harness.register("surface", "base");
    harness.executor.succeed(0);
    harness.frames.flush();
    const initialMasks = harness.outputs.rebuildMask.mock.calls.length;

    surface.rectangle = { ...surface.rectangle, left: 90 };
    harness.coordinator.notifySurfaceGeometryChanged();
    expect(harness.frames.pending()).toBe(1);
    harness.frames.flush();

    expect(harness.outputs.rebuildMask).toHaveBeenCalledTimes(initialMasks + 1);
    expect(last(harness.outputs.rebuildMask.mock.calls)?.[1][0].bounds.x).toBe(90);
    expect(harness.executor.starts).toHaveLength(1);
    harness.dispose();
  });

  it("coalesces 120 explicit geometry invalidations and consumes the latest rect", () => {
    const harness = createHarness("worker-offscreen");
    harness.coordinator.updatePresentation(harness.present(1));
    const surface = harness.register("surface", "base");
    harness.executor.succeed(0);
    harness.frames.flush();
    const initialMasks = harness.outputs.rebuildMask.mock.calls.length;

    for (let sample = 0; sample < 120; sample += 1) {
      surface.rectangle = { ...surface.rectangle, left: sample };
      harness.coordinator.notifySurfaceGeometryChanged();
    }

    expect(harness.frames.pending()).toBe(1);
    harness.frames.flush();
    expect(harness.outputs.rebuildMask).toHaveBeenCalledTimes(initialMasks + 1);
    expect(last(harness.outputs.rebuildMask.mock.calls)?.[1][0].bounds.x).toBe(119);
    expect(harness.executor.starts).toHaveLength(1);
    harness.dispose();
  });

  it("drives base and modal planes through one compositor frame", () => {
    const harness = createHarness("worker-offscreen");
    harness.coordinator.updatePresentation(harness.present(1));
    harness.register("base-surface", "base");
    harness.register("modal-surface", "modal");
    harness.executor.succeed(0);

    expect(harness.frames.pending()).toBe(1);
    harness.frames.flush();

    expect(harness.outputs.rebuildMask.mock.calls.map(([plane]) => plane)).toEqual([
      "base",
      "modal",
    ]);
    expect(harness.outputs.compose).toHaveBeenCalledTimes(1);
    harness.dispose();
  });

  it("cancels logical frame work and disposes output resources", () => {
    const harness = createHarness("worker-offscreen");
    harness.coordinator.updatePresentation(harness.present(1));
    harness.register("surface", "base");
    expect(harness.frames.pending()).toBe(1);

    harness.coordinator.dispose();

    expect(harness.frames.pending()).toBe(0);
    expect(harness.outputs.dispose).toHaveBeenCalledTimes(1);
    harness.registry.dispose();
    harness.runtime.dispose();
  });
});

function last<Value>(values: readonly Value[]): Value | undefined {
  return values[values.length - 1];
}
