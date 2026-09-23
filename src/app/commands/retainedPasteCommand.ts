import { castDraft, original } from "immer";
import { commandRejected, defineCommandHandler } from "../../domain/commands/commandHandler";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import { containerPlacementSchema } from "../../domain/document/elementPlacement";
import { areJsonValuesDeepEqual } from "../../domain/document/jsonDeepEqual";
import { retainedPastePayloadSchema } from "./retainedCopyContract";

const reject = () => [
  commandRejected("command.payload", "Invalid copied graph or changed paste destination."),
];

// One insertion transaction, with product candidate admission owning retained schemas/relationships.
// This root-copy path cannot attach to existing parents or introduce/register media bytes/metadata.
export const pasteRetainedElementsCommand = defineCommandHandler({
  type: "document.elements.paste",
  label: "Paste elements",
  history: "record",
  payloadSchema: retainedPastePayloadSchema,
  apply(document, { canvasId, elements, connections, installations, media }) {
    const source = original(document as object) as TaskMapDocument;
    if (source.activeCanvasId !== canvasId || !source.canvases[canvasId]) return reject();
    const elementIds = new Set(elements.map(({ id }) => id));
    const edgeIds = new Set(connections.map(({ id }) => id));
    const installationIds = new Set(installations.map(({ id }) => id));
    const mediaIds = new Set(media.map(({ id }) => id));
    if (
      elementIds.size !== elements.length ||
      edgeIds.size !== connections.length ||
      installationIds.size !== installations.length ||
      mediaIds.size !== media.length
    )
      return reject();
    const requiredMedia = new Set<string>();
    for (const element of elements) {
      if (element.canvasId !== canvasId || source.elements[element.id]) return reject();
      if (element.type === "text-card" || element.type === "image") {
        const placement = containerPlacementSchema.safeParse(element.data.placement);
        if (!placement.success || (placement.data && !elementIds.has(placement.data.containerId)))
          return reject();
      }
      if (element.type === "image" && typeof element.data.mediaId === "string")
        requiredMedia.add(element.data.mediaId);
    }
    if (
      requiredMedia.size !== mediaIds.size ||
      media.some(
        (entry) =>
          !requiredMedia.has(entry.id) ||
          !areJsonValuesDeepEqual(source.mediaReferences[entry.id], entry),
      )
    )
      return reject();
    for (const edge of connections)
      if (
        source.connections[edge.id] ||
        edge.canvasId !== canvasId ||
        !elementIds.has(edge.source.elementId) ||
        !elementIds.has(edge.target.elementId)
      )
        return reject();
    for (const entry of installations)
      if (
        source.extensionInstallations[entry.id] ||
        entry.target.kind !== "element" ||
        !elementIds.has(entry.target.elementId)
      )
        return reject();
    for (const element of elements) document.elements[element.id] = castDraft(element);
    // Push individually: a legal 20,000-element copy must not depend on JS argument-count limits.
    for (const element of elements) document.canvases[canvasId].elementOrder.push(element.id);
    for (const edge of connections) Object.assign(document.connections, { [edge.id]: edge });
    for (const entry of installations) document.extensionInstallations[entry.id] = castDraft(entry);
  },
});
