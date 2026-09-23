import { z } from "zod";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { ElementId } from "../../domain/ids/entityIds";
import { DOCUMENT_LIMITS } from "../../domain/document/documentLimits";
import { extensionInstallationSchema } from "../../domain/document/documentSchema";
import { containerElementSchema } from "../../elements/container/containerModel";
import { textCardElementSchema } from "../../elements/text-card/textCardModel";
import { imageElementSchema } from "../../elements/image/imageModel";
import { areJsonValuesDeepEqual } from "../../domain/document/jsonDeepEqual";

export const retainedContainerSnapshotSchema = z
  .object({
    container: containerElementSchema,
    children: z
      .array(z.discriminatedUnion("type", [textCardElementSchema, imageElementSchema]))
      .max(DOCUMENT_LIMITS.elementCount),
    installations: z.array(extensionInstallationSchema).max(DOCUMENT_LIMITS.extensionInstanceCount),
  })
  .strict();
export type RetainedContainerSnapshot = z.infer<typeof retainedContainerSnapshotSchema>;

export function captureRetainedContainer(document: TaskMapDocument | null, containerId: ElementId) {
  const container = document?.elements[containerId];
  if (
    !document?.activeCanvasId ||
    container?.canvasId !== document.activeCanvasId ||
    container.type !== "container"
  )
    return null;
  const children = Object.values(document.elements).filter((element) => {
    if (
      element.canvasId !== container.canvasId ||
      (element.type !== "text-card" && element.type !== "image")
    )
      return false;
    const placement = element.data.placement;
    return (
      placement &&
      typeof placement === "object" &&
      "containerId" in placement &&
      placement.containerId === containerId
    );
  });
  const ids = new Set([containerId, ...children.map(({ id }) => id)]);
  const snapshot = retainedContainerSnapshotSchema.parse({
    container,
    children,
    installations: Object.values(document.extensionInstallations).filter(
      (entry) => entry.target.kind === "element" && ids.has(entry.target.elementId),
    ),
  });
  snapshot.children.sort((left, right) => left.data.placement!.order - right.data.placement!.order);
  snapshot.installations.sort((left, right) => left.id.localeCompare(right.id));
  return snapshot;
}
export function matchesRetainedContainer(
  document: TaskMapDocument,
  expected: RetainedContainerSnapshot,
) {
  return areJsonValuesDeepEqual(
    captureRetainedContainer(document, expected.container.id),
    expected,
  );
}
// Presence semantics match the retained view: inactive installations emit no control, while an
// active installed-but-configured-off flag still emits the feature and its companion behavior.
export function containerHasExtension(snapshot: RetainedContainerSnapshot, extensionId: string) {
  return snapshot.installations.some(
    (entry) =>
      entry.enabled &&
      entry.extensionId === extensionId &&
      entry.target.kind === "element" &&
      entry.target.elementId === snapshot.container.id,
  );
}
