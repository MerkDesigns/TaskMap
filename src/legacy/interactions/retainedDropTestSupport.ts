import { vi } from "vitest";
import { placementInput, placementIds } from "../../app/commands/retainedPlacementTestSupport";
import { IMAGE_TEST_IDS } from "../../elements/image/imageTestFixtures";
import { asEntityId } from "../../domain/ids/entityIds";
import { TEST_IDS, validated } from "../../elements/cardContainerTestFixtures";
import { createRetainedCanvasProjection } from "../../app/view-projection/createRetainedCanvasProjection";
import { callbackSetup } from "../../app/commands/retainedCallbackTestSupport";
import { createRetainedCanvasInteractionController } from "../../app/interactions/createRetainedCanvasInteractionController";
import { createViewport } from "../../canvas/geometry/viewportMath";
import { createRetainedInteractionGeometry } from "./retainedInteractionGeometry";
import { createLegacyTextCardInteractionService } from "./legacyTextCardInteraction";

export const dropIds = {
  ...placementIds,
  trailingImage: IMAGE_TEST_IDS.secondImage,
  bundle: asEntityId("element", "element-00000000-0000-4000-8000-000000000101"),
  hidden: asEntityId("element", "element-00000000-0000-4000-8000-000000000102"),
};
export function dropInput() {
  const input = placementInput();
  const { container, target, block, image, trailingImage, card, sibling, bundle, hidden } = dropIds;
  input.elements[container].geometry = { x: 0, y: 0, width: 320, height: 400 };
  input.elements[target].geometry = { x: 500, y: 0, width: 320, height: 400 };
  input.elements[block].geometry.x = 1200;
  input.elements[sibling].data = { ...input.elements[sibling].data, text: "Keep this" };
  for (const [id, originalId, parent, order, text] of [
    [bundle, card, container, 9, "Bundle"],
    [hidden, card, target, 11, "Hidden"],
    [trailingImage, image, target, 15, null],
  ] as const) {
    input.elements[id] = {
      ...input.elements[originalId],
      id,
      data: {
        ...input.elements[originalId].data,
        ...(text === null ? {} : { text }),
        placement: { containerId: parent, order },
      },
    };
    input.canvases[TEST_IDS.canvasA].elementOrder.push(id);
  }
  input.elements[image].data = {
    ...input.elements[image].data,
    placement: { containerId: target, order: 2 },
  };
  input.extensionInstallations[TEST_IDS.extensionB] = {
    id: TEST_IDS.extensionB,
    extensionId: "search",
    enabled: true,
    target: { kind: "element", elementId: target },
    configuration: { query: "keep" },
  };
  return input;
}
export function dropView(input = dropInput()) {
  const result = createRetainedCanvasProjection().project(validated(input));
  if (!result.ok) throw new Error("Invalid drop fixture");
  return result.canvases[0];
}
export async function retainedDropSetup(
  input = dropInput(),
  primary = dropIds.bundle,
  scroll: Readonly<Record<string, number>> = { [dropIds.target]: 30, [dropIds.container]: 10 },
) {
  const setup = await callbackSetup(input);
  const view = dropView(input);
  const geometry = createRetainedInteractionGeometry(view, new Map(), scroll);
  const plan = geometry.prepareMove(primary, [dropIds.bundle, dropIds.card]);
  const onCompletion = vi.fn();
  const interaction = createRetainedCanvasInteractionController({
    actions: setup.actions,
    canvasKey: TEST_IDS.canvasA,
    viewport: createViewport({ x: 0, y: 0 }, 1, { width: 1600, height: 900 }),
    onCompletion,
  });
  const placement = createLegacyTextCardInteractionService({
    requestFrame: vi.fn(() => 1),
    cancelFrame: vi.fn(),
    setTimer: vi.fn(() => 1),
    clearTimer: vi.fn(),
  });
  const primaryBounds = plan.targets.find((item) => item.id === primary)!.geometry;
  const start = { x: primaryBounds.x, y: primaryBounds.y + 10 };
  const begin = () => {
    const started = interaction.beginMove({
      ...plan,
      pointerId: 1,
      screen: start,
      resolveTextCardDrop: () => placement.getDecision(),
    });
    if (started)
      placement.begin({
        pointerId: 1,
        primaryId: primary,
        draggedIds: plan.targets.filter((item) => !item.locked).map((item) => item.id),
        cards: view.textCards,
        containers: view.containers,
        textBlocks: view.textBlocks,
        geometries: new Map(plan.targets.map((item) => [item.id, item.geometry])),
        startScreen: start,
        startWorld: start,
        scrollOffsets: scroll,
      });
    return started;
  };
  function update(x: number, y: number) {
    const sample = { pointerId: 1, screen: { x, y }, snapping: false };
    interaction.updatePointer(sample);
    const bounds = interaction
      .getSnapshot()
      .geometryPreviews.find((item) => item.id === primary)!.geometry;
    placement.update({
      pointerId: 1,
      screen: sample.screen,
      world: sample.screen,
      primaryGeometry: bounds,
      shiftKey: false,
    });
    return sample;
  }
  const stop = setup.actions.subscribeInvalidation(placement.reset);
  return {
    ...setup,
    view,
    geometry,
    plan,
    placement,
    interaction,
    onCompletion,
    begin,
    update,
    dispose: async () => {
      stop();
      placement.reset();
      interaction.dispose();
      await setup.dispose();
    },
  };
}
