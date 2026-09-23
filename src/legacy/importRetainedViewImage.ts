import type { RetainedApplicationRuntime } from "./RetainedCanvasContext";
import { imageElementSchema } from "../elements/image/imageModel";
import { asEntityId, type ElementId } from "../domain/ids/entityIds";
import { MIN_IMAGE_SIZE } from "../constants";
import type { MediaImportSource } from "../app/media/createSessionMediaResources";

type Destination = { elementId: ElementId } | { x: number; y: number; accent: string };
/** Capture before picker/blob work; only completed metadata and geometry enter the document. */
export async function importRetainedViewImage(
  runtime: RetainedApplicationRuntime,
  source: MediaImportSource,
  destination: Destination,
) {
  const { canvas, existing } = (() => {
    const document = runtime.controller.store.getState().documentWorkspace.document;
    const active = document?.activeCanvasId ? document.canvases[document.activeCanvasId] : null;
    return {
      canvas: active
        ? {
            id: active.id,
            settings: { width: active.settings.width, height: active.settings.height },
          }
        : null,
      existing:
        "elementId" in destination
          ? imageElementSchema.safeParse(document?.elements[destination.elementId])
          : null,
    };
  })();
  if (!canvas) return { ok: false as const, code: "expired-action" as const };
  if (existing && !existing.success) return { ok: false as const, code: "invalid-action" as const };
  const replacement = existing?.success
    ? runtime.callbacks.captureImageReplacement(existing.data.id)
    : null;
  const insertion = existing ? null : runtime.callbacks.captureImageImport();
  if (!replacement && !insertion) return { ok: false as const, code: "expired-action" as const };
  try {
    const stored = await runtime.media.import(source);
    if (!stored.ok) return stored;
    const media = stored.value;
    const scale =
      media.pixelWidth && media.pixelHeight
        ? Math.min(1, 360 / Math.max(media.pixelWidth, media.pixelHeight))
        : null;
    const width =
      scale === null ? 280 : Math.max(MIN_IMAGE_SIZE, Math.round(media.pixelWidth! * scale));
    const height =
      scale === null ? 200 : Math.max(MIN_IMAGE_SIZE, Math.round(media.pixelHeight! * scale));
    const clamp = (value: number, maximum: number) => Math.max(0, Math.min(value, maximum));
    if (replacement && existing?.success) {
      const image = existing.data;
      const geometry = image.data.mediaId
        ? image.geometry
        : {
            x: clamp(image.geometry.x, canvas.settings.width - width),
            y: clamp(image.geometry.y, canvas.settings.height - height),
            width,
            height,
          };
      return replacement.complete({ media, geometry });
    }
    if (!("x" in destination)) return { ok: false as const, code: "invalid-action" as const };
    return insertion!.complete({
      media,
      element: {
        id: asEntityId("element", `element-${crypto.randomUUID()}`),
        canvasId: canvas.id,
        type: "image",
        geometry: {
          x: clamp(destination.x - width / 2, canvas.settings.width - width),
          y: clamp(destination.y - height / 2, canvas.settings.height - height),
          width,
          height,
        },
        data: { mediaId: media.id, placement: null, accent: destination.accent, background: true },
      },
    });
  } catch {
    return { ok: false as const, code: "invalid-action" as const };
  } finally {
    replacement?.cancel();
    insertion?.cancel();
  }
}
