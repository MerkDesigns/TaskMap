// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createCanvasInteractionController } from "../../app/interactions/canvasInteractionController";
import type { InteractionElement } from "../../app/interactions/canvasInteractionTypes";
import { createViewport } from "../../canvas/geometry/viewportMath";
import type { TextCardElement } from "../../types";
import { createLegacyTextCardInteractionService } from "./legacyTextCardInteraction";
import { applyLegacyTextCardShiftTransition } from "./legacyTextCardModifierTransition";

describe("legacy text-card Shift transitions", () => {
  it("snaps immediately, clears only guides on release, then resumes raw movement", () => {
    const commits = {
      commitMove: vi.fn(),
      commitResize: vi.fn(),
      commitLayerOrder: vi.fn(),
    };
    const controller = createCanvasInteractionController({
      canvasKey: "canvas",
      viewport: createViewport({ x: 0, y: 0 }, 1, { width: 800, height: 600 }),
      commitPort: commits,
    });
    const interaction = createLegacyTextCardInteractionService({
      requestFrame: vi.fn(() => 1),
      cancelFrame: vi.fn(),
      setTimer: vi.fn(() => 1),
      clearTimer: vi.fn(),
    });
    const card: TextCardElement = {
      id: "card",
      text: "Card",
      x: 10,
      y: 10,
      accent: "#fff",
    };
    const moving: InteractionElement = {
      id: card.id,
      geometry: { x: 10, y: 10, width: 20, height: 20 },
      locked: false,
      movable: true,
      resizable: false,
    };
    const snapTarget: InteractionElement = {
      id: "target",
      geometry: { x: 24, y: 100, width: 20, height: 20 },
      locked: false,
      movable: true,
      resizable: false,
    };

    controller.beginMove({
      pointerId: 7,
      screen: { x: 10, y: 10 },
      primaryId: card.id,
      targets: [moving],
      snapTargets: [snapTarget],
      completionBehavior: "place",
    });
    interaction.begin({
      pointerId: 7,
      primaryId: card.id,
      draggedIds: [card.id],
      cards: [card],
      containers: [],
      textBlocks: [],
      geometries: new Map([[card.id, moving.geometry]]),
      startScreen: { x: 10, y: 10 },
      startWorld: { x: 10, y: 10 },
      scrollOffsets: {},
    });
    controller.updatePointer({ pointerId: 7, screen: { x: 18, y: 10 }, snapping: false });
    interaction.update({
      pointerId: 7,
      screen: { x: 18, y: 10 },
      world: { x: 18, y: 10 },
      primaryGeometry: controller.getSnapshot().geometryPreviews[0].geometry,
      shiftKey: false,
    });
    expect(controller.getSnapshot().geometryPreviews[0].geometry.x).toBe(18);

    controller.setMoveSnapping(99, true);
    expect(controller.getSnapshot().geometryPreviews[0].geometry.x).toBe(18);
    expect(controller.getSnapshot().snapGuides).toEqual([]);

    applyLegacyTextCardShiftTransition(controller, interaction, true);
    expect(controller.getSnapshot().geometryPreviews[0].geometry.x).toBe(24);
    expect(controller.getSnapshot().snapGuides).toEqual([
      { axis: "x", position: 24, pointerPosition: 10 },
      { axis: "x", position: 44, pointerPosition: 10 },
    ]);
    expect(interaction.getSnapshot().active).toMatchObject({
      current: { x: 24, y: 10 },
      trueSize: true,
    });
    expect(commits.commitMove).not.toHaveBeenCalled();

    applyLegacyTextCardShiftTransition(controller, interaction, false);
    expect(controller.getSnapshot().snapGuides).toEqual([]);
    expect(controller.getSnapshot().geometryPreviews[0].geometry.x).toBe(24);
    expect(interaction.getSnapshot().active?.trueSize).toBe(true);
    expect(commits.commitMove).not.toHaveBeenCalled();

    controller.updatePointer({ pointerId: 7, screen: { x: 19, y: 10 }, snapping: false });
    interaction.update({
      pointerId: 7,
      screen: { x: 19, y: 10 },
      world: { x: 19, y: 10 },
      primaryGeometry: controller.getSnapshot().geometryPreviews[0].geometry,
      shiftKey: false,
    });
    expect(controller.getSnapshot().geometryPreviews[0].geometry.x).toBe(19);
    expect(interaction.getSnapshot().active).toMatchObject({
      current: { x: 19, y: 10 },
      trueSize: true,
    });
    expect(commits.commitMove).not.toHaveBeenCalled();
  });
});
