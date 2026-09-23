import type { z } from "zod";
import type { ElementId } from "../../domain/ids/entityIds";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { findArchitectureExtensionDefinition } from "../../extensions/architectureRegistry";
import { retainedExtensionChangeSchema } from "./retainedExtensionCommand";

export type RetainedExtensionChange = z.infer<typeof retainedExtensionChangeSchema>;

// Read/index once per action start, not per member or pointer sample. Parsed entries are detached
// from Redux; the completion owner retains only these targets until completion/cancel/revocation.
export function captureRetainedExtensions(
  document: TaskMapDocument | null,
  extensionId: string,
  elementIds: readonly ElementId[],
) {
  const definition = findArchitectureExtensionDefinition(extensionId);
  if (
    !document?.activeCanvasId ||
    !definition ||
    !elementIds.length ||
    elementIds.length > DOCUMENT_LIMITS.elementCount
  )
    return null;
  const ids = [...new Set(elementIds)];
  if (ids.some((id) => document.elements[id]?.canvasId !== document.activeCanvasId)) return null;
  const installed = new Map(
    Object.values(document.extensionInstallations)
      .filter((entry) => entry.extensionId === extensionId && entry.target.kind === "element")
      .map((entry) => [entry.target.kind === "element" ? entry.target.elementId : "", entry]),
  );
  const updates = ids
    .filter((id) => definition.compatibleElementTypes.includes(document.elements[id].type))
    .map((elementId) =>
      retainedExtensionChangeSchema.parse({
        elementId,
        elementType: document.elements[elementId].type,
        extensionId,
        from: installed.get(elementId) ?? null,
        to: null,
      }),
    );
  return updates.length ? { canvasId: document.activeCanvasId, definition, updates } : null;
}

export function extensionEditCommand(
  canvasId: TaskMapDocument["activeCanvasId"],
  updates: readonly RetainedExtensionChange[],
) {
  return { type: "document.extensions.edit", payload: { canvasId, updates } };
}
