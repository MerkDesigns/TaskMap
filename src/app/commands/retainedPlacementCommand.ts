import { original } from "immer";
import { commandRejected, defineCommandHandler } from "../../domain/commands/commandHandler";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { ContainerPlacement } from "../../domain/document/elementPlacement";
import type { ElementId } from "../../domain/ids/entityIds";
import { createRetainedCanvasProjection } from "../view-projection/createRetainedCanvasProjection";
import { updateRetainedGeometriesCommand } from "./retainedGeometryCommands";
import { retainedPlacementSchema, samePlacement } from "./retainedPlacementContract";

export const placeRetainedElementsCommand = defineCommandHandler({
  type: "document.elements.place",
  label: "Place elements",
  history: "record",
  payloadSchema: retainedPlacementSchema,
  apply(document, payload) {
    const reject = () => [
      commandRejected("command.payload", "Placement is invalid or changed before completion."),
    ];
    const source = original(document as object) as TaskMapDocument;
    const projection = createRetainedCanvasProjection();
    try {
      const result = projection.project(source);
      if (!result.ok) return reject();
      const canvas = result.canvases.find(({ id }) => id === payload.canvasId);
      if (!canvas) return reject();
      const containers = new Set(canvas.containers.map(({ id }) => id));
      if (payload.target && !containers.has(payload.target.containerId)) return reject();
      const children = new Map<ElementId, { placement: ContainerPlacement; locked: boolean }>();
      for (const view of [...canvas.textCards, ...canvas.images]) {
        const id = view.id as ElementId;
        if (source.elements[id].type === "mind-map-node") continue;
        children.set(id, {
          placement: view.containerId
            ? { containerId: view.containerId as ElementId, order: view.order! }
            : null,
          locked: view.extensions?.lock?.enabled === true,
        });
      }
      const moving = new Set<ElementId>();
      const affected = new Set<ElementId>();
      const geometryIds = new Set(payload.updates.map(({ elementId }) => elementId));
      if (payload.target) affected.add(payload.target.containerId);
      for (const entry of payload.moving) {
        const child = children.get(entry.elementId);
        if (
          !child ||
          moving.has(entry.elementId) ||
          !geometryIds.has(entry.elementId) ||
          !samePlacement(child.placement, entry.from)
        )
          return reject();
        moving.add(entry.elementId);
        if (entry.from) affected.add(entry.from.containerId);
      }
      const groups = new Map<ElementId, { elementId: ElementId; order: number }[]>(
        [...affected].map((id) => [id, []]),
      );
      const expected = new Map(
        payload.expectedSiblings.map((entry) => [entry.elementId, entry.placement]),
      );
      if (expected.size !== payload.expectedSiblings.length) return reject();
      let siblingCount = 0;
      for (const [elementId, { placement }] of children) {
        const group = placement && groups.get(placement.containerId);
        if (!group || !placement) continue;
        const snapshot = expected.get(elementId);
        if (!snapshot || !samePlacement(snapshot, placement)) return reject();
        siblingCount++;
        group.push({ elementId, order: placement.order });
      }
      if (siblingCount !== expected.size) return reject();
      const planned = new Map<ElementId, ContainerPlacement>();
      for (const id of moving) planned.set(id, null);
      for (const [containerId, entries] of groups) {
        entries.sort((a, b) => a.order - b.order);
        const before = entries.map(({ elementId }) => elementId);
        const after = before.filter((id) => !moving.has(id));
        if (payload.target?.containerId === containerId) {
          if (payload.target.index > after.length) return reject();
          after.splice(payload.target.index, 0, ...moving);
        }
        // An unchanged drop is a true no-op even when historical deletion left numeric gaps.
        const unchanged =
          before.length === after.length && before.every((id, i) => id === after[i]);
        after.forEach((id, index) =>
          planned.set(id, {
            containerId,
            order: unchanged ? entries[index].order : index,
          }),
        );
      }
      for (const id of moving) {
        const child = children.get(id)!;
        if (child.locked && !samePlacement(child.placement, planned.get(id)!)) return reject();
      }
      // A locked parent can receive children; locked siblings may shift order, but are not moved
      // geometrically. Only directly moved targets use the lock rule, as in the retained behavior.
      const issues = updateRetainedGeometriesCommand.apply(document, {
        canvasId: payload.canvasId,
        updates: payload.updates,
      });
      if (issues?.length) return issues;
      for (const [id, placement] of planned) {
        if (!samePlacement(children.get(id)!.placement, placement)) {
          Object.assign(document.elements[id], {
            data: { ...source.elements[id].data, placement },
          });
        }
      }
    } finally {
      projection.clear();
    }
  },
});
