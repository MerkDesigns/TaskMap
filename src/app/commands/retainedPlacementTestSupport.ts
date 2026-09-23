import type { TaskMapDocument } from "../../domain/document/documentTypes";
import { asEntityId, type ElementId } from "../../domain/ids/entityIds";
import { containerPlacementSchema } from "../../domain/document/elementPlacement";
import { TEST_IDS } from "../../elements/cardContainerTestFixtures";
import { geometryIds, geometryInput, geometrySetup } from "./retainedGeometryTestSupport";

export const placementIds = {
  ...geometryIds,
  target: asEntityId("element", "element-00000000-0000-4000-8000-000000000091"),
  sibling: asEntityId("element", "element-00000000-0000-4000-8000-000000000092"),
};

export function placementInput() {
  const input = geometryInput();
  const { target, sibling, container, card } = placementIds;
  input.elements[target] = { ...input.elements[container], id: target };
  input.elements[sibling] = {
    ...input.elements[card],
    id: sibling,
    data: { ...input.elements[card].data, placement: { containerId: target, order: 7 } },
  };
  input.canvases[TEST_IDS.canvasA].elementOrder.push(target, sibling);
  return input;
}

export function placementSetup(input = placementInput()) {
  return geometrySetup(input);
}

// Test-only completion binding. Production hit testing/callback epochs are a later slice.
export function placementCommand(
  document: TaskMapDocument,
  moving: ElementId[] = [placementIds.card],
  target: { containerId: ElementId; index: number } | null = {
    containerId: placementIds.target,
    index: 0,
  },
) {
  const entries = moving.map((elementId) => ({
    elementId,
    from: containerPlacementSchema.parse(document.elements[elementId].data.placement),
  }));
  const affected = new Set(entries.flatMap(({ from }) => (from ? [from.containerId] : [])));
  if (target) affected.add(target.containerId);
  return {
    type: "document.elements.place",
    payload: {
      canvasId: TEST_IDS.canvasA,
      moving: entries,
      target,
      updates: moving.map((elementId) => {
        const from = document.elements[elementId].geometry;
        return { elementId, from: { ...from }, to: { ...from } };
      }),
      expectedSiblings: Object.values(document.elements).flatMap((element) => {
        if (element.canvasId !== TEST_IDS.canvasA || !["text-card", "image"].includes(element.type))
          return [];
        const placement = containerPlacementSchema.parse(element.data.placement);
        return placement && affected.has(placement.containerId)
          ? [{ elementId: element.id, placement }]
          : [];
      }),
    },
  };
}
