import type { DocumentElement } from "../../domain/document/documentTypes";
import type { TextCardElement } from "../../types";
import { textCardElementSchema } from "./textCardModel";

// Presentation-only: never serialize this shape or use it as a mutable document.
export function projectTextCard(
  element: DocumentElement,
  layer: number,
): Readonly<TextCardElement> {
  const { id, geometry, data } = textCardElementSchema.parse(element);
  return Object.freeze({
    id,
    layer,
    text: data.text,
    accent: data.accent,
    x: geometry.x,
    y: geometry.y,
    ...(data.link === null ? {} : { link: data.link }),
    ...(data.placement === null ? {} : data.placement),
  });
  // Canonical width/height must not force the retained content-sized card's layout.
}
