import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import type { CapturedCompletion } from "../app/commands/retainedCompletionOwner";
import {
  captureRetainedContainer,
  containerHasExtension,
} from "../app/commands/retainedContainerSnapshot";
import type { TaskMapDocument } from "../domain/document/documentTypes";
import { createEntityId, type ElementId, type UuidSource } from "../domain/ids/entityIds";
import { parseCopyPasteJson } from "../extensions/copyPasteJson";

/** Capture before opening the editor/reading the clipboard; no document content lives in this handle. */
export function captureRetainedViewJsonEdit(
  actions: RetainedActionCallbacks,
  document: TaskMapDocument | null,
  containerId: ElementId,
  ids: UuidSource,
): CapturedCompletion<string> | null {
  const snapshot = captureRetainedContainer(document, containerId);
  const captured = actions.captureContainerJsonReplace(containerId);
  if (!snapshot || !captured) return null;
  const { x, y } = snapshot.container.geometry;
  const checkbox = containerHasExtension(snapshot, "auto-checkbox");
  return {
    cancel: captured.cancel,
    complete(json) {
      const parsed = parseCopyPasteJson(json);
      if (!parsed.success) return { ok: false, code: "invalid-action" };
      return captured.complete({
        json,
        cards: parsed.data.cards.map(() => ({
          id: createEntityId("element", ids),
          geometry: { x, y, width: 1, height: 1 },
          checkboxInstallationId: checkbox ? createEntityId("extension-instance", ids) : null,
        })),
      });
    },
  };
}
