import type { DocumentElement } from "../../domain/document/documentTypes";
import type { ContainerElement } from "../../types";
import { containerElementSchema, type ContainerDocumentElement } from "./containerModel";

export function projectContainer(
  element: DocumentElement,
  layer: number,
): Readonly<ContainerElement> {
  const { id, geometry, data } = containerElementSchema.parse(element);
  return Object.freeze({ id, layer, ...geometry, ...data });
}

/**
 * The element as a container, or null for any other type. The canvas binding only admits documents
 * whose containers passed their schema in the projection.
 */
export function asContainerDocumentElement(
  element: DocumentElement | undefined,
): ContainerDocumentElement | null {
  return element?.type === "container" ? (element as ContainerDocumentElement) : null;
}
