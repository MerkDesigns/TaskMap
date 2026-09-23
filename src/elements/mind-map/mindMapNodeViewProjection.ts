import type { DocumentElement } from "../../domain/document/documentTypes";
import type { TextCardElement } from "../../types";
import { mindMapNodeElementSchema } from "./mindMapModel";

export function projectMindMapNode(
  element: DocumentElement,
  layer: number,
): Readonly<TextCardElement> {
  const { id, geometry, data } = mindMapNodeElementSchema.parse(element);
  // The discriminant is only a retained-renderer prop, not the persisted type.
  return Object.freeze({ id, kind: "mindmap", layer, x: geometry.x, y: geometry.y, ...data });
}
