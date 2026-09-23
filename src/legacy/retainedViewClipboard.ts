import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import { captureRetainedCopy } from "../app/commands/retainedCopySnapshot";
import {
  captureRetainedContainer,
  containerHasExtension,
} from "../app/commands/retainedContainerSnapshot";
import type { TaskMapDocument } from "../domain/document/documentTypes";
import { createEntityId, type ElementId, type UuidSource } from "../domain/ids/entityIds";

type Point = { x: number; y: number };

/** UI keeps only placement/identity metadata. Copied content stays in the revocable callback owner. */
export function captureRetainedViewCopy(
  actions: RetainedActionCallbacks,
  document: TaskMapDocument | null,
  selected: readonly ElementId[],
  renderPosition: (id: ElementId) => Point | undefined,
) {
  const graph = captureRetainedCopy(document, selected);
  if (!graph) return null;
  const captured = actions.captureCopy(selected);
  if (!captured) return null;
  const included = new Set(graph.elements.map((element) => element.id));
  const checkboxes = new Set(
    graph.installations.flatMap((entry) =>
      entry.extensionId === "checkbox" && entry.target.kind === "element"
        ? [entry.target.elementId]
        : [],
    ),
  );
  return {
    captured,
    single: selected.length === 1,
    elements: graph.elements.map((element) => {
      const placement =
        element.type === "text-card" || element.type === "image" ? element.data.placement : null;
      return {
        sourceId: element.id,
        type: element.type,
        geometry: { ...element.geometry, ...renderPosition(element.id) },
        parentId: placement && included.has(placement.containerId) ? placement.containerId : null,
        checkbox: checkboxes.has(element.id),
      };
    }),
    connections: graph.connections.map((entry) => entry.id),
    installations: graph.installations.map((entry) => entry.id),
  };
}
export type RetainedViewCopy = NonNullable<ReturnType<typeof captureRetainedViewCopy>>;

export function pasteRetainedViewCopy(
  copy: RetainedViewCopy,
  document: TaskMapDocument,
  point: Point,
  ids: UuidSource,
  destination?: { containerId: ElementId; cardIndex: number },
) {
  const canvasId = document.activeCanvasId!;
  const bounds = document.canvases[canvasId].settings;
  const roots = copy.elements.filter((element) => !element.parentId);
  const origin = {
    x: Math.min(...roots.map((entry) => entry.geometry.x)),
    y: Math.min(...roots.map((entry) => entry.geometry.y)),
  };
  const primary = roots[0];
  let offset = { x: point.x - origin.x, y: point.y - origin.y };
  if (copy.single && primary) {
    const { width, height, x, y } = primary.geometry;
    offset = {
      x:
        point.x -
        x -
        (primary.type === "container" || primary.type === "text-block" || primary.type === "image"
          ? width / 2
          : 0),
      y:
        point.y -
        y -
        (primary.type === "image"
          ? height / 2
          : primary.type === "container" || primary.type === "text-block"
            ? 28
            : 0),
    };
  }
  const clamp = (value: number, maximum: number) => Math.max(0, Math.min(value, maximum));
  const elements = copy.elements.map((entry) => ({
    sourceId: entry.sourceId,
    id: createEntityId("element", ids),
    position: {
      x:
        copy.single && (entry.type === "text-card" || entry.type === "mind-map-node")
          ? entry.geometry.x + offset.x
          : clamp(entry.geometry.x + offset.x, bounds.width - entry.geometry.width),
      y:
        copy.single && (entry.type === "text-card" || entry.type === "mind-map-node")
          ? entry.geometry.y + offset.y
          : clamp(entry.geometry.y + offset.y, bounds.height - entry.geometry.height),
    },
  }));
  const completion = {
    canvasId,
    elements,
    connections: copy.connections.map((sourceId) => ({
      sourceId,
      id: createEntityId("connection", ids),
    })),
    installations: copy.installations.map((sourceId) => ({
      sourceId,
      id: createEntityId("extension-instance", ids),
    })),
  };
  const container =
    destination && copy.elements.length === 1 && primary.type === "text-card"
      ? captureRetainedContainer(document, destination.containerId)
      : null;
  const cards = container?.children.filter((child) => child.type === "text-card") ?? [];
  const result =
    container && destination
      ? copy.captured.complete({
          ...completion,
          target: {
            containerId: destination.containerId,
            index: cards[destination.cardIndex]
              ? container.children.findIndex(
                  (child) => child.id === cards[destination.cardIndex].id,
                )
              : container.children.length,
            checkboxInstallationId:
              containerHasExtension(container, "auto-checkbox") && !primary.checkbox
                ? createEntityId("extension-instance", ids)
                : null,
          },
        })
      : copy.captured.complete(completion);
  return {
    result,
    inserted: elements.map((entry, index) => ({
      id: entry.id,
      type: copy.elements[index].type,
      root: !copy.elements[index].parentId,
    })),
  };
}
