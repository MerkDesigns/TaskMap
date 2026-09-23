import type { ElementId } from "../../domain/ids/entityIds";
import type { createRetainedCompletionOwner } from "./retainedCompletionOwner";
import type { RetainedPasteCompletion } from "./retainedCopyContract";
import { captureRetainedCopy } from "./retainedCopySnapshot";
import { buildRetainedPaste } from "./retainedPasteCompletion";
import {
  buildContainerPaste,
  retainedContainerPasteSchema,
  type RetainedContainerPaste,
} from "./retainedContainerPaste";

export function retainedCopyCallbacks(owner: ReturnType<typeof createRetainedCompletionOwner>) {
  return {
    // Call on explicit Copy, not pointer samples. The opaque handle owns no copied plaintext.
    // The caller supplies new IDs and resolved/clamped canonical positions for every copied member.
    captureCopy(elementIds: readonly ElementId[]) {
      const snapshot = captureRetainedCopy(owner.readDocument(), elementIds);
      if (!snapshot) return null;
      return owner.capture(
        "clipboard",
        snapshot,
        (saved, completion: RetainedPasteCompletion | RetainedContainerPaste | null) => {
          if (completion === null) return null;
          if (!("target" in completion)) return buildRetainedPaste(saved, completion);
          const { target, ...mapping } = retainedContainerPasteSchema.parse(completion);
          // Destination is resolved and captured at this synchronous Paste action, not at Copy.
          return buildContainerPaste(
            owner.readDocument(),
            buildRetainedPaste(saved, mapping).payload,
            target,
          );
        },
      );
    },
  };
}
