import { z } from "zod";
import { containerElementSchema } from "../../elements/container/containerModel";
import { textCardElementSchema } from "../../elements/text-card/textCardModel";
import { textBlockElementSchema } from "../../elements/text-block/textBlockModel";
import { mindMapNodeElementSchema } from "../../elements/mind-map/mindMapModel";
import {
  imageElementSchema,
  type ImageMediaMetadata,
  type ImageDocumentElement,
} from "../../elements/image/imageModel";
import type { createRetainedCompletionOwner } from "./retainedCompletionOwner";
import type { ElementId } from "../../domain/ids/entityIds";

const creationSchema = z.union([
  containerElementSchema,
  textCardElementSchema,
  textBlockElementSchema,
  mindMapNodeElementSchema,
  imageElementSchema,
]);
export function retainedCreationCallbacks(owner: ReturnType<typeof createRetainedCompletionOwner>) {
  return {
    captureImageReplacement(elementId: ElementId) {
      const document = owner.readDocument();
      const parsed = imageElementSchema.safeParse(document?.elements[elementId]);
      if (!parsed.success || parsed.data.canvasId !== document?.activeCanvasId) return null;
      const { id, canvasId, geometry, data } = parsed.data;
      const expected = {
        id,
        canvasId,
        geometry,
        data: { mediaId: data.mediaId, placement: data.placement },
      };
      return owner.capture(
        "image-import",
        expected,
        (
          expected,
          input: { media: ImageMediaMetadata; geometry: ImageDocumentElement["geometry"] } | null,
        ) =>
          input === null
            ? null
            : { type: "document.image.replace", payload: { expected, ...input } },
      );
    },
    captureCreateElement() {
      const canvasId = owner.readDocument()?.activeCanvasId;
      if (!canvasId) return null;
      return owner.capture(
        "creation",
        canvasId,
        (id, input: z.infer<typeof creationSchema> | null) => {
          if (input === null) return null;
          const element = creationSchema.parse(input);
          if (
            element.canvasId !== id ||
            ("placement" in element.data && element.data.placement !== null) ||
            (element.type === "image" && element.data.mediaId !== null)
          )
            throw new Error("Invalid root creation");
          return { type: "document.element.insert", payload: { element } };
        },
      );
    },
    captureImageImport() {
      const canvasId = owner.readDocument()?.activeCanvasId;
      if (!canvasId) return null;
      return owner.capture(
        "image-import",
        canvasId,
        (id, input: { element: ImageDocumentElement; media: ImageMediaMetadata } | null) => {
          if (input === null) return null;
          if (input.element.canvasId !== id) throw new Error("Canvas changed during import");
          return { type: "document.image.import", payload: input };
        },
      );
    },
  };
}
