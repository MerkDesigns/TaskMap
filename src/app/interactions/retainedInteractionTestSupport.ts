import { vi } from "vitest";
import { callbackSetup } from "../commands/retainedCallbackTestSupport";
import { geometryInput } from "../commands/retainedGeometryTestSupport";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import type { ElementId } from "../../domain/ids/entityIds";
import { createViewport } from "../../canvas/geometry/viewportMath";
import { createRetainedCanvasProjection } from "../view-projection/createRetainedCanvasProjection";
import { createRetainedCanvasInteractionController } from "./createRetainedCanvasInteractionController";
import type { InteractionElement } from "./canvasInteractionTypes";

export async function retainedInteractionSetup(input = geometryInput()) {
  const setup = await callbackSetup(input);
  const onCompletion = vi.fn();
  const viewport = createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 800 });
  const interaction = createRetainedCanvasInteractionController({
    actions: setup.actions,
    canvasKey: TEST_IDS.canvasA,
    viewport,
    onCompletion,
  });
  // Test fixtures supply already-resolved view bounds. Production hit-testing/size resolution is
  // deliberately not introduced here; canonical persisted card extents differ from measured ones.
  function target(id: ElementId): InteractionElement {
    const projected = createRetainedCanvasProjection().project(
      setup.store.getState().documentWorkspace.document!,
    );
    if (!projected.ok) throw new Error("Invalid test projection");
    const canvas = projected.canvases[0];
    const element = [
      ...canvas.containers,
      ...canvas.textBlocks,
      ...canvas.textCards,
      ...canvas.images,
    ].find((item) => item.id === id)!;
    const resizable = "width" in element && "height" in element;
    return {
      id,
      geometry: {
        x: element.x,
        y: element.y,
        width: resizable ? element.width : 77,
        height: resizable ? element.height : 33,
      },
      locked: element.extensions?.lock?.enabled ?? false,
      movable: true,
      resizable,
      centerSnapping: "kind" in element && element.kind === "mindmap",
    };
  }
  const moveInput = (ids: readonly ElementId[]) => ({
    pointerId: 1,
    screen: { x: 0, y: 0 },
    primaryId: ids[0],
    targets: ids.map(target),
    snapTargets: [],
  });
  return {
    ...setup,
    interaction,
    onCompletion,
    viewport,
    target,
    moveInput,
    dispose: async () => {
      interaction.dispose();
      await setup.dispose();
    },
  };
}
export const pointer = (x = 20, pointerId = 1) => ({
  pointerId,
  screen: { x, y: x },
  snapping: false,
});
