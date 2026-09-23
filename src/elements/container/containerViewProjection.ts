import type { DocumentElement } from "../../domain/document/documentTypes";
import type { ContainerElement } from "../../types";
import { containerElementSchema } from "./containerModel";

export function projectContainer(
  element: DocumentElement,
  layer: number,
): Readonly<ContainerElement> {
  const { id, geometry, data } = containerElementSchema.parse(element);
  return Object.freeze({ id, layer, ...geometry, ...data });
}
