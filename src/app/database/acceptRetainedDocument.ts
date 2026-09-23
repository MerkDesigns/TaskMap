import type { DocumentAcceptance } from "../../domain/document/documentAcceptance";
import { createRetainedCanvasProjection } from "../view-projection/createRetainedCanvasProjection";

// Reuse the staged adapter's module schemas and relationship checks as one acceptance authority.
// This temporary bridge constructs no DOM and publishes no view. A fresh, short-lived projection
// avoids retaining rejected/plaintext candidates in a validation cache across sessions.
export const acceptRetainedDocument: DocumentAcceptance = (document) => {
  const projection = createRetainedCanvasProjection();
  try {
    return projection.project(document).ok;
  } finally {
    projection.clear();
  }
};
