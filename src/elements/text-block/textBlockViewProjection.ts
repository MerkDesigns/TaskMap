import type { DocumentElement } from "../../domain/document/documentTypes";
import type { TextBlockElement } from "../../types";
import { textBlockElementSchema, type TextBlockDocumentElement } from "./textBlockModel";

export function projectTextBlock(
  element: DocumentElement,
  layer: number,
): Readonly<TextBlockElement> {
  const { id, geometry, data } = textBlockElementSchema.parse(element);
  return Object.freeze({ id, layer, ...geometry, ...data });
}

/**
 * The element as a text block, or null for any other type. The canvas binding only admits documents
 * whose text blocks passed their schema in the projection.
 */
export function asTextBlockDocumentElement(
  element: DocumentElement | undefined,
): TextBlockDocumentElement | null {
  return element?.type === "text-block" ? (element as TextBlockDocumentElement) : null;
}
