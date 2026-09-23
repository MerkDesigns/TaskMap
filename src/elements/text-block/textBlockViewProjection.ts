import type { DocumentElement } from "../../domain/document/documentTypes";
import type { TextBlockElement } from "../../types";
import { textBlockElementSchema } from "./textBlockModel";

export function projectTextBlock(
  element: DocumentElement,
  layer: number,
): Readonly<TextBlockElement> {
  const { id, geometry, data } = textBlockElementSchema.parse(element);
  return Object.freeze({ id, layer, ...geometry, ...data });
}
