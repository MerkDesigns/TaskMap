import {
  retainedPasteCompletionSchema,
  type RetainedCopyGraph,
  type RetainedPasteCompletion,
} from "./retainedCopyContract";

function exactMapping<Id extends string, Entry extends { sourceId: Id; id: Id }>(
  sources: readonly { id: Id }[],
  entries: readonly Entry[],
) {
  const mapping = new Map(entries.map((entry) => [entry.sourceId, entry]));
  const newIds = new Set(entries.map(({ id }) => id));
  if (
    mapping.size !== entries.length ||
    newIds.size !== entries.length ||
    sources.length !== entries.length ||
    sources.some(({ id }) => !mapping.has(id) || newIds.has(id))
  )
    throw new Error("Invalid copy ID mapping");
  return mapping;
}

export function buildRetainedPaste(snapshot: RetainedCopyGraph, input: RetainedPasteCompletion) {
  const completion = retainedPasteCompletionSchema.parse(input);
  const elements = exactMapping(snapshot.elements, completion.elements);
  const connections = exactMapping(snapshot.connections, completion.connections);
  const installations = exactMapping(snapshot.installations, completion.installations);
  return {
    type: "document.elements.paste",
    payload: {
      canvasId: completion.canvasId,
      elements: snapshot.elements.map((source) => {
        const mapped = elements.get(source.id)!;
        let data = source.data;
        if (source.type === "text-card" || source.type === "image") {
          const placement = source.data.placement;
          data = {
            ...source.data,
            placement:
              placement && elements.has(placement.containerId)
                ? { ...placement, containerId: elements.get(placement.containerId)!.id }
                : null,
          };
        } else if (source.type === "container" || source.type === "text-block") {
          data = { ...source.data, name: `${source.data.name} copy` };
        }
        return {
          ...source,
          id: mapped.id,
          canvasId: completion.canvasId,
          geometry: { ...source.geometry, ...mapped.position },
          data,
        };
      }),
      connections: snapshot.connections.map((source) => ({
        ...source,
        id: connections.get(source.id)!.id,
        canvasId: completion.canvasId,
        source: { ...source.source, elementId: elements.get(source.source.elementId)!.id },
        target: { ...source.target, elementId: elements.get(source.target.elementId)!.id },
      })),
      installations: snapshot.installations.map((source) => {
        if (source.target.kind !== "element") throw new Error("Invalid copied extension target");
        return {
          ...source,
          id: installations.get(source.id)!.id,
          target: {
            kind: "element" as const,
            elementId: elements.get(source.target.elementId)!.id,
          },
        };
      }),
      media: snapshot.media,
    },
  };
}
