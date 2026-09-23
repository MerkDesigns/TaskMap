import type { ElementId } from "../../domain/ids/entityIds";
import type { LayerDirection, ResizeCommit } from "../interactions/canvasInteractionTypes";
import { retainedContentSchema } from "./retainedContentContract";
import { retainedConnectionCallbacks } from "./retainedConnectionCallbacks";
import { retainedCopyCallbacks } from "./retainedCopyCallbacks";
import { retainedContainerCardCallbacks } from "./retainedContainerCardCallbacks";
import { retainedExtensionCallbacks } from "./retainedExtensionCallbacks";
import { retainedSettingsCallbacks } from "./retainedSettingsCallbacks";
import { retainedCanvasCallbacks } from "./retainedCanvasCallbacks";
import { retainedCreationCallbacks } from "./retainedCreationCallbacks";
import {
  createRetainedCompletionOwner,
  type RetainedCallbackSession,
} from "./retainedCompletionOwner";
import {
  buildMoveCommand,
  captureCanvasPlacement,
  captureGeometry,
  type MoveCompletion,
} from "./retainedCallbackSnapshots";

export function createRetainedActionCallbacks(session: RetainedCallbackSession) {
  const owner = createRetainedCompletionOwner(session);
  return {
    ...retainedConnectionCallbacks(owner),
    ...retainedCopyCallbacks(owner),
    ...retainedContainerCardCallbacks(owner),
    ...retainedExtensionCallbacks(owner),
    ...retainedSettingsCallbacks(owner),
    ...retainedCanvasCallbacks(owner),
    ...retainedCreationCallbacks(owner),
    undo: () => owner.runHistory("undo"),
    redo: () => owner.runHistory("redo"),
    canInteract(canvasId: string) {
      return owner.readDocument()?.activeCanvasId === canvasId;
    },
    subscribeInvalidation: owner.subscribeInvalidation,
    // Call once at gesture start, after controller eligibility filtering. Never per pointer sample.
    captureMove(
      primaryId: ElementId,
      elementIds: readonly ElementId[],
      placementIds: readonly ElementId[] = [],
      placementType?: "text-card",
    ) {
      const document = owner.readDocument();
      if (!document?.activeCanvasId) return null;
      try {
        const updates = captureGeometry(document, elementIds);
        if (!elementIds.includes(primaryId) || new Set(placementIds).size !== placementIds.length)
          return null;
        const { children } = placementIds.length
          ? captureCanvasPlacement(document)
          : { children: [] };
        const placements = new Map(children.map((child) => [child.elementId, child]));
        if (placementType && placementIds.some((id) => placements.get(id)?.type !== placementType))
          return null;
        const targets = new Set(elementIds);
        const moving = placementIds.map((elementId) => {
          if (!targets.has(elementId) || !placements.has(elementId))
            throw new Error("Invalid placement member");
          return { elementId, from: placements.get(elementId)!.placement };
        });
        return owner.capture(
          "geometry",
          { canvasId: document.activeCanvasId, primaryId, updates, children, moving },
          buildMoveCommand,
        );
      } catch {
        return null;
      }
    },
    captureResize(elementId: ElementId) {
      const document = owner.readDocument();
      if (!document?.activeCanvasId) return null;
      try {
        const [update] = captureGeometry(document, [elementId]);
        return owner.capture(
          "geometry",
          { canvasId: document.activeCanvasId, ...update },
          buildResizeCommand,
        );
      } catch {
        return null;
      }
    },
    captureContent(requests: readonly { elementId: ElementId; fields: readonly string[] }[]) {
      const document = owner.readDocument();
      if (!document?.activeCanvasId) return null;
      try {
        const seen = new Set<ElementId>();
        const updates = requests.map(({ elementId, fields }) => {
          const element = document.elements[elementId];
          if (
            !element ||
            element.canvasId !== document.activeCanvasId ||
            seen.has(elementId) ||
            !fields.length ||
            new Set(fields).size !== fields.length
          )
            throw new Error("Invalid content capture");
          seen.add(elementId);
          const from = Object.fromEntries(fields.map((field) => [field, element.data[field]]));
          return { elementId, type: element.type, from, to: from };
        });
        const parsed = retainedContentSchema.safeParse({
          canvasId: document.activeCanvasId,
          updates,
        });
        if (!parsed.success) return null;
        return owner.capture("content", parsed.data, buildContentCommand);
      } catch {
        return null;
      }
    },
    captureLayers(elementIds: readonly ElementId[], direction: LayerDirection) {
      const document = owner.readDocument();
      if (!document?.activeCanvasId) return null;
      const { roots } = captureCanvasPlacement(document);
      const rootIds = new Set(roots);
      // The retained context action filters contained selections. Commands remain strict.
      if (
        new Set(elementIds).size !== elementIds.length ||
        elementIds.some(
          (id) =>
            !document.elements[id] || document.elements[id].canvasId !== document.activeCanvasId,
        )
      )
        return null;
      const payload = {
        canvasId: document.activeCanvasId,
        elementIds: elementIds.filter((id) => rootIds.has(id)),
        expectedRootOrder: roots,
        direction,
      };
      return owner.capture("layers", payload, (captured, _input: void) => ({
        type: "document.elements.reorder-layers",
        payload: captured,
      }));
    },
    captureDelete(elementIds: readonly ElementId[]) {
      const document = owner.readDocument();
      if (
        !document?.activeCanvasId ||
        new Set(elementIds).size !== elementIds.length ||
        elementIds.some(
          (id) =>
            !document.elements[id] || document.elements[id].canvasId !== document.activeCanvasId,
        )
      )
        return null;
      return owner.capture(
        "delete",
        { canvasId: document.activeCanvasId, elementIds: [...elementIds] },
        (payload, _input: void) => ({ type: "document.selection.delete", payload }),
      );
    },
    clear: owner.clear,
    dispose: owner.dispose,
  };
}

function buildResizeCommand(
  snapshot: { canvasId: string; elementId: ElementId; from: ResizeCommit["from"] },
  operation: ResizeCommit,
) {
  if (operation.id !== snapshot.elementId || operation.handle !== "bottom-right")
    throw new Error("Invalid resize completion");
  return {
    type: "document.elements.update-geometry",
    payload: {
      canvasId: snapshot.canvasId,
      updates: [
        {
          elementId: snapshot.elementId,
          from: snapshot.from,
          to: { ...snapshot.from, width: operation.to.width, height: operation.to.height },
        },
      ],
    },
  };
}

function buildContentCommand(
  snapshot: ReturnType<typeof retainedContentSchema.parse>,
  edits: readonly { elementId: ElementId; to: Record<string, unknown> }[] | null,
) {
  if (edits === null) return null;
  const final = new Map(edits.map(({ elementId, to }) => [elementId, to]));
  if (final.size !== edits.length || final.size !== snapshot.updates.length)
    throw new Error("Invalid content completion");
  return {
    type: "document.elements.edit-content",
    payload: {
      canvasId: snapshot.canvasId,
      updates: snapshot.updates.map(({ elementId, type, from }) => {
        if (!final.has(elementId)) throw new Error("Invalid content member");
        return { elementId, type, from, to: final.get(elementId) };
      }),
    },
  };
}

export type RetainedActionCallbacks = ReturnType<typeof createRetainedActionCallbacks>;
export type { MoveCompletion };
