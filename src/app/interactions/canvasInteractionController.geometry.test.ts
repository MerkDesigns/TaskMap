// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createViewport } from "../../canvas/geometry/viewportMath";
import { createCanvasInteractionController } from "./canvasInteractionController";
import type { CanvasInteractionCommitPort, InteractionElement } from "./canvasInteractionTypes";

function element(
  id: string,
  geometry = { x: 10, y: 20, width: 100, height: 80 },
  locked = false,
): InteractionElement {
  return { id, geometry, locked, movable: true, resizable: true };
}

function setup(zoom = 1) {
  const commits = {
    commitMove: vi.fn(),
    commitResize: vi.fn(),
    commitLayerOrder: vi.fn(),
  } satisfies CanvasInteractionCommitPort;
  return {
    commits,
    controller: createCanvasInteractionController({
      canvasKey: "a",
      viewport: createViewport({ x: 0, y: 0 }, zoom, { width: 1000, height: 800 }),
      commitPort: commits,
    }),
  };
}

describe("move gesture", () => {
  it("previews many frames and commits one zoom-correct move", () => {
    const { controller, commits } = setup(2);
    const source = element("a");
    expect(
      controller.beginMove({
        pointerId: 1,
        screen: { x: 100, y: 100 },
        primaryId: "a",
        targets: [source],
        snapTargets: [],
      }),
    ).toBe(true);
    controller.updatePointer({ pointerId: 1, screen: { x: 120, y: 110 }, snapping: false });
    controller.updatePointer({ pointerId: 1, screen: { x: 140, y: 120 }, snapping: false });
    expect(source.geometry).toEqual({ x: 10, y: 20, width: 100, height: 80 });
    expect(commits.commitMove).not.toHaveBeenCalled();
    expect(controller.getSnapshot().geometryPreviews[0].geometry).toEqual({
      x: 30,
      y: 30,
      width: 100,
      height: 80,
    });
    controller.completePointer({ pointerId: 1, screen: { x: 140, y: 120 }, snapping: false });
    expect(commits.commitMove).toHaveBeenCalledOnce();
    expect(commits.commitMove).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryId: "a",
        targets: [{ id: "a", from: source.geometry, to: { x: 30, y: 30, width: 100, height: 80 } }],
      }),
    );
  });

  it("moves an unlocked group atomically and excludes locked members", () => {
    const { controller, commits } = setup();
    const first = element("a");
    const second = element("b", { x: 200, y: 300, width: 50, height: 40 });
    const locked = element("locked", { x: 500, y: 500, width: 50, height: 50 }, true);
    controller.beginMove({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      primaryId: "a",
      targets: [first, second, locked],
      snapTargets: [],
    });
    controller.completePointer({ pointerId: 1, screen: { x: 10, y: 15 }, snapping: false });
    expect(commits.commitMove).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [
          { id: "a", from: first.geometry, to: { ...first.geometry, x: 20, y: 35 } },
          { id: "b", from: second.geometry, to: { ...second.geometry, x: 210, y: 315 } },
        ],
      }),
    );
  });

  it("blocks direct locked movement and preserves interaction arbitration", () => {
    const { controller, commits } = setup();
    expect(
      controller.beginMove({
        pointerId: 1,
        screen: { x: 0, y: 0 },
        primaryId: "locked",
        targets: [element("locked", undefined, true)],
        snapTargets: [],
      }),
    ).toBe(false);
    expect(controller.getSnapshot().activeInteraction).toBeNull();
    expect(commits.commitMove).not.toHaveBeenCalled();
  });

  it("snaps only when Shift semantics enable it and preserves coincident guides", () => {
    const { controller, commits } = setup();
    const moving = element("moving", { x: 0, y: 0, width: 50, height: 50 });
    const targets = [
      element("target-a", { x: 100, y: 100, width: 50, height: 50 }),
      element("target-b", { x: 100, y: 100, width: 60, height: 60 }),
    ];
    controller.beginMove({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      primaryId: "moving",
      targets: [moving],
      snapTargets: targets,
    });
    controller.updatePointer({ pointerId: 1, screen: { x: 94, y: 94 }, snapping: true });
    expect(controller.getSnapshot().geometryPreviews[0].geometry).toMatchObject({ x: 100, y: 100 });
    expect(controller.getSnapshot().snapGuides).toHaveLength(4);
    controller.completePointer({ pointerId: 1, screen: { x: 94, y: 94 }, snapping: true });
    expect(commits.commitMove).toHaveBeenCalledOnce();
  });

  it("does not commit cancelled, no-op, or below-threshold movement", () => {
    const { controller, commits } = setup();
    const source = element("a");
    controller.beginMove({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      primaryId: "a",
      targets: [source],
      snapTargets: [],
    });
    controller.updatePointer({ pointerId: 1, screen: { x: 20, y: 20 }, snapping: false });
    controller.cancelPointer(1);
    controller.beginMove({
      pointerId: 2,
      screen: { x: 0, y: 0 },
      primaryId: "a",
      targets: [source],
      snapTargets: [],
    });
    controller.completePointer({ pointerId: 2, screen: { x: 0, y: 0 }, snapping: false });
    controller.beginMove({
      pointerId: 3,
      screen: { x: 0, y: 0 },
      primaryId: "a",
      targets: [source],
      snapTargets: [],
      commitThresholdScreen: 3,
    });
    controller.completePointer({ pointerId: 3, screen: { x: 2, y: 0 }, snapping: false });
    expect(commits.commitMove).not.toHaveBeenCalled();
  });

  it("treats pointercancel as discard rather than completion", () => {
    const { controller, commits } = setup();
    controller.beginMove({
      pointerId: 9,
      screen: { x: 0, y: 0 },
      primaryId: "a",
      targets: [element("a")],
      snapTargets: [],
    });
    controller.updatePointer({ pointerId: 9, screen: { x: 100, y: 100 }, snapping: false });
    controller.cancelPointer(9);
    expect(controller.getSnapshot().geometryPreviews).toEqual([]);
    expect(commits.commitMove).not.toHaveBeenCalled();
  });
});

describe("resize and layers", () => {
  it("previews bottom-right resize, clamps constraints, then commits once", () => {
    const { controller, commits } = setup(2);
    const source = element("a");
    controller.beginResize({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      target: source,
      constraints: { minimum: { width: 80, height: 60 }, maximum: { width: 130, height: 100 } },
      snapTargets: [],
    });
    controller.updatePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
    expect(commits.commitResize).not.toHaveBeenCalled();
    expect(controller.getSnapshot().geometryPreviews[0].geometry).toEqual({
      x: 10,
      y: 20,
      width: 130,
      height: 100,
    });
    controller.completePointer({ pointerId: 1, screen: { x: 100, y: 100 }, snapping: false });
    expect(commits.commitResize).toHaveBeenCalledOnce();
  });

  it("retains image aspect ratio and blocks locked resize", () => {
    const { controller, commits } = setup();
    const image = element("image", { x: 0, y: 0, width: 160, height: 80 });
    controller.beginResize({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      target: image,
      constraints: {
        minimum: { width: 80, height: 40 },
        maximum: { width: 300, height: 150 },
        aspectRatio: 2,
      },
      snapTargets: [],
    });
    controller.completePointer({ pointerId: 1, screen: { x: 40, y: 30 }, snapping: false });
    expect(commits.commitResize).toHaveBeenCalledWith(
      expect.objectContaining({ to: { x: 0, y: 0, width: 220, height: 110 } }),
    );
    expect(
      controller.beginResize({
        pointerId: 2,
        screen: { x: 0, y: 0 },
        target: element("locked", undefined, true),
        constraints: { minimum: { width: 1, height: 1 }, maximum: { width: 500, height: 500 } },
        snapTargets: [],
      }),
    ).toBe(false);
  });

  it("cancels/no-ops resize and sends one semantic layer action regardless of locks", () => {
    const { controller, commits } = setup();
    const source = element("a");
    const input = {
      pointerId: 1,
      screen: { x: 0, y: 0 },
      target: source,
      constraints: { minimum: { width: 1, height: 1 }, maximum: { width: 500, height: 500 } },
      snapTargets: [],
    };
    controller.beginResize(input);
    controller.cancelPointer(1);
    controller.beginResize({ ...input, pointerId: 2 });
    controller.completePointer({ pointerId: 2, screen: { x: 0, y: 0 }, snapping: false });
    expect(commits.commitResize).not.toHaveBeenCalled();
    controller.select("kept", false);
    controller.reorder(["locked"], "front");
    expect(commits.commitLayerOrder).toHaveBeenCalledWith({
      selectedIds: ["locked"],
      direction: "front",
    });
    expect(controller.getSnapshot().selectedIds).toEqual(["kept"]);
  });
});

describe("pointer-frame architecture fixture", () => {
  it("uses bounded previews without commit, serialization, cloning, or source mutation", () => {
    const { controller, commits } = setup();
    const stringify = vi.spyOn(JSON, "stringify");
    const parse = vi.spyOn(JSON, "parse");
    const structuredCloneSpy = vi.spyOn(globalThis, "structuredClone");
    const source = element("moving");
    const candidates = Array.from({ length: 5_000 }, (_, index) =>
      element(`target-${index}`, { x: index * 100, y: index * 80, width: 50, height: 50 }),
    );
    controller.beginMove({
      pointerId: 1,
      screen: { x: 0, y: 0 },
      primaryId: source.id,
      targets: [source],
      snapTargets: candidates,
    });
    for (let frame = 1; frame <= 120; frame += 1) {
      controller.updatePointer({
        pointerId: 1,
        screen: { x: frame, y: frame / 2 },
        snapping: frame % 2 === 0,
      });
    }
    expect(controller.getSnapshot().geometryPreviews).toHaveLength(1);
    expect(source.geometry).toEqual({ x: 10, y: 20, width: 100, height: 80 });
    expect(commits.commitMove).not.toHaveBeenCalled();
    expect(stringify).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
    expect(structuredCloneSpy).not.toHaveBeenCalled();
    stringify.mockRestore();
    parse.mockRestore();
    structuredCloneSpy.mockRestore();
  });
});
