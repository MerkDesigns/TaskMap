import type { ElementGeometry, TaskMapDocument } from "../../domain/document/documentTypes";
import {
  containerPlacementSchema,
  type ContainerPlacement,
} from "../../domain/document/elementPlacement";
import type { ElementId } from "../../domain/ids/entityIds";
import type { MoveCommit } from "../interactions/canvasInteractionTypes";
import {
  resolveRetainedTextCardDrop,
  type CapturedPlacementChild,
  type ResolvedTextCardDrop,
} from "./retainedTextCardDrop";

export function captureGeometry(document: TaskMapDocument, elementIds: readonly ElementId[]) {
  if (!elementIds.length || new Set(elementIds).size !== elementIds.length)
    throw new Error("Invalid targets");
  return elementIds.map((elementId) => {
    const element = document.elements[elementId];
    if (!element || element.canvasId !== document.activeCanvasId) throw new Error("Invalid target");
    return { elementId, from: { ...element.geometry } };
  });
}

export function captureCanvasPlacement(document: TaskMapDocument) {
  if (!document.activeCanvasId) throw new Error("No active canvas");
  const children: CapturedPlacementChild[] = [];
  const roots: ElementId[] = [];
  for (const id of document.canvases[document.activeCanvasId].elementOrder) {
    const element = document.elements[id];
    if (element.type === "text-card" || element.type === "image") {
      const placement = containerPlacementSchema.parse(element.data.placement);
      children.push({ elementId: id, type: element.type, placement });
      if (placement === null) roots.push(id);
    } else roots.push(id);
  }
  return { children, roots };
}

export interface MoveCompletion {
  readonly operation: MoveCommit;
  // The existing interaction owner resolves hit-testing/search/scroll to a full-list index.
  // Absence is NOT detachment: a placement completion must explicitly supply null for root.
  readonly target?: { readonly containerId: ElementId; readonly index: number } | null;
  readonly textCardDrop?: ResolvedTextCardDrop | null;
}
export function buildMoveCommand(
  snapshot: {
    canvasId: TaskMapDocument["activeCanvasId"];
    primaryId: ElementId;
    updates: { elementId: ElementId; from: ElementGeometry }[];
    moving: { elementId: ElementId; from: ContainerPlacement }[];
    children: ReturnType<typeof captureCanvasPlacement>["children"];
  },
  { operation, target, textCardDrop }: MoveCompletion,
) {
  const targets = new Map(operation.targets.map((entry) => [entry.id, entry.to]));
  if (
    operation.primaryId !== snapshot.primaryId ||
    targets.size !== operation.targets.length ||
    targets.size !== snapshot.updates.length ||
    !Number.isFinite(operation.screenDistance) ||
    operation.screenDistance < 0 ||
    !["translate", "place"].includes(operation.completionBehavior)
  )
    throw new Error("Invalid move");
  const drop =
    textCardDrop == null
      ? null
      : resolveRetainedTextCardDrop(
          snapshot.children,
          snapshot.moving.map((item) => item.elementId),
          textCardDrop,
        );
  if (
    textCardDrop !== undefined &&
    (target !== undefined ||
      operation.completionBehavior !== "place" ||
      operation.screenDistance < 3 ||
      !drop)
  )
    throw new Error("Invalid placement decision");
  const updates = snapshot.updates.map(({ elementId, from }) => {
    const to = targets.get(elementId);
    if (!to) throw new Error("Invalid move member");
    const position = drop?.positions.get(elementId) ?? to;
    return { elementId, from, to: { ...from, x: position.x, y: position.y } };
  });
  if (operation.completionBehavior === "translate" || operation.screenDistance < 3) {
    return {
      type: "document.elements.update-geometry",
      payload: { canvasId: snapshot.canvasId, updates },
    };
  }
  const destination = drop ? drop.target : target;
  if (
    operation.completionBehavior !== "place" ||
    destination === undefined ||
    !snapshot.moving.length
  )
    throw new Error("Missing placement decision");
  const parents = new Set(snapshot.moving.flatMap(({ from }) => (from ? [from.containerId] : [])));
  if (destination) parents.add(destination.containerId);
  return {
    type: "document.elements.place",
    payload: {
      canvasId: snapshot.canvasId,
      updates,
      moving: snapshot.moving,
      target: destination,
      expectedSiblings: snapshot.children.flatMap(({ elementId, placement }) =>
        placement && parents.has(placement.containerId) ? [{ elementId, placement }] : [],
      ),
    },
  };
}
