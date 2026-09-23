import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { ElementId } from "../../domain/ids/entityIds";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { containerPlacementSchema } from "../../domain/document/elementPlacement";
import { retainedCopyGraphSchema } from "./retainedCopyContract";

// Mirrors retained internal-copy membership: containers expand to their ordered text cards;
// individually copied children detach unless their parent is copied too. No media reads/serialization.
export function captureRetainedCopy(
  document: TaskMapDocument | null,
  elementIds: readonly ElementId[],
) {
  if (
    !document?.activeCanvasId ||
    !elementIds.length ||
    elementIds.length > DOCUMENT_LIMITS.elementCount
  )
    return null;
  const selected = new Set(elementIds);
  if (elementIds.some((id) => document.elements[id]?.canvasId !== document.activeCanvasId))
    return null;
  const canvas = document.canvases[document.activeCanvasId];
  const containers = new Set(elementIds.filter((id) => document.elements[id].type === "container"));
  const elements = canvas.elementOrder
    .map((id) => document.elements[id])
    .filter((element) => {
      if (element.type !== "text-card" && element.type !== "image") return selected.has(element.id);
      const placement = containerPlacementSchema.parse(element.data.placement);
      if (placement && containers.has(placement.containerId)) return element.type === "text-card";
      return selected.has(element.id);
    });
  if (!elements.length) return null;
  const included = new Set(elements.map(({ id }) => id));
  const mediaIds = new Set(
    elements.flatMap((element) =>
      element.type === "image" && typeof element.data.mediaId === "string"
        ? [element.data.mediaId]
        : [],
    ),
  );
  return retainedCopyGraphSchema.parse({
    elements,
    connections: Object.values(document.connections).filter(
      (edge) =>
        selected.has(edge.source.elementId) &&
        selected.has(edge.target.elementId) &&
        included.has(edge.source.elementId) &&
        included.has(edge.target.elementId),
    ),
    installations: Object.values(document.extensionInstallations).filter(
      (entry) => entry.target.kind === "element" && included.has(entry.target.elementId),
    ),
    media: Object.values(document.mediaReferences).filter(({ id }) => mediaIds.has(id)),
  });
}
