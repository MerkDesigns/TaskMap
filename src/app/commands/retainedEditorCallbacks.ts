import type { ElementId } from "../../domain/ids/entityIds";
import { normalizeTextCardLink } from "../../elements/text-card/normalizeTextCardLink";
import type { RetainedActionCallbacks } from "./createRetainedActionCallbacks";
import type { CapturedCompletion } from "./retainedCompletionOwner";

// Local draft/focus/pulse ownership stays in the view. Only final editor values cross this boundary.
export function captureRetainedTextEdit(
  actions: RetainedActionCallbacks,
  elementId: ElementId,
  field: "text" | "name",
): CapturedCompletion<string> | null {
  const captured = actions.captureContent([{ elementId, fields: [field] }]);
  if (!captured) return null;
  return {
    complete(draft) {
      const text = draft.trim();
      return captured.complete(text ? [{ elementId, to: { [field]: text } }] : null);
    },
    cancel: captured.cancel,
  };
}

export function captureRetainedLinkEdit(
  actions: RetainedActionCallbacks,
  elementId: ElementId,
): CapturedCompletion<string> | null {
  const captured = actions.captureContent([{ elementId, fields: ["link"] }]);
  if (!captured) return null;
  return {
    complete: (draft) =>
      captured.complete([{ elementId, to: { link: normalizeTextCardLink(draft) } }]),
    cancel: captured.cancel,
  };
}
