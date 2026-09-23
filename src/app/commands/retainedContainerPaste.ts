import { z } from "zod";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { entityIdSchema } from "../../domain/document/documentSchema";
import { captureRetainedContainer } from "./retainedContainerSnapshot";
import { checkboxInstallationIdSchema } from "./retainedContainerCardContract";
import { retainedPasteCompletionSchema } from "./retainedCopyContract";
import type { buildRetainedPaste } from "./retainedPasteCompletion";

export const retainedContainerPasteSchema = retainedPasteCompletionSchema
  .extend({
    target: z
      .object({
        containerId: entityIdSchema("element"),
        index: z.number().int().min(0).max(DOCUMENT_LIMITS.elementCount),
        checkboxInstallationId: checkboxInstallationIdSchema,
      })
      .strict(),
  })
  .strict();
export type RetainedContainerPaste = z.infer<typeof retainedContainerPasteSchema>;

export function buildContainerPaste(
  document: TaskMapDocument | null,
  copied: ReturnType<typeof buildRetainedPaste>["payload"],
  target: RetainedContainerPaste["target"],
) {
  const expected = captureRetainedContainer(document, target.containerId);
  if (
    !expected ||
    expected.container.canvasId !== copied.canvasId ||
    copied.elements.length !== 1 ||
    copied.elements[0].type !== "text-card" ||
    copied.connections.length ||
    copied.media.length
  )
    throw new Error("Invalid container paste");
  return {
    type: "document.container.insert-card",
    payload: {
      expected,
      origin: "paste",
      card: copied.elements[0],
      index: target.index,
      installations: copied.installations,
      checkboxInstallationId: target.checkboxInstallationId,
    },
  };
}
