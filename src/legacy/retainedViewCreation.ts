import type { RetainedActionCallbacks } from "../app/commands/createRetainedActionCallbacks";
import type { CanvasId, ElementId } from "../domain/ids/entityIds";
import { containerElementSchema } from "../elements/container/containerModel";
import { imageElementSchema } from "../elements/image/imageModel";
import { mindMapNodeElementSchema } from "../elements/mind-map/mindMapModel";
import { textBlockElementSchema } from "../elements/text-block/textBlockModel";
import { textCardElementSchema } from "../elements/text-card/textCardModel";
import type { ContainerElement, ImageElement, TextBlockElement, TextCardElement } from "../types";

/** Maps a newly authored view element, never a stored legacy document, into its module contract. */
export function createRetainedViewElement(
  actions: RetainedActionCallbacks,
  canvasId: CanvasId,
  input:
    | { type: "container"; value: ContainerElement }
    | { type: "text-card"; value: TextCardElement }
    | { type: "text-block"; value: TextBlockElement }
    | { type: "image"; value: ImageElement },
) {
  const capture = actions.captureCreateElement();
  if (!capture) return { ok: false as const, code: "expired-action" as const };
  const { value } = input;
  const base = {
    id: value.id as ElementId,
    canvasId,
    geometry: {
      x: value.x,
      y: value.y,
      width: "width" in value ? value.width : 1,
      height: "height" in value ? value.height : 1,
    },
  };
  try {
    switch (input.type) {
      case "container":
        return capture.complete(
          containerElementSchema.parse({
            ...base,
            type: "container",
            data: {
              name: input.value.name,
              accent: input.value.accent,
              headerButtonsVisible: input.value.headerButtonsVisible ?? true,
            },
          }),
        );
      case "text-block":
        return capture.complete(
          textBlockElementSchema.parse({
            ...base,
            type: "text-block",
            data: {
              name: input.value.name,
              text: input.value.text,
              accent: input.value.accent,
              headerButtonsVisible: input.value.headerButtonsVisible ?? true,
            },
          }),
        );
      case "text-card":
        return capture.complete(
          input.value.kind === "mindmap"
            ? mindMapNodeElementSchema.parse({
                ...base,
                type: "mind-map-node",
                data: {
                  text: input.value.text,
                  accent: input.value.accent,
                },
              })
            : textCardElementSchema.parse({
                ...base,
                type: "text-card",
                data: {
                  text: input.value.text,
                  accent: input.value.accent,
                  link: input.value.link ?? null,
                  placement: null,
                },
              }),
        );
      case "image":
        return capture.complete(
          imageElementSchema.parse({
            ...base,
            type: "image",
            data: {
              accent: input.value.accent,
              background: input.value.background ?? true,
              mediaId: null,
              placement: null,
            },
          }),
        );
    }
  } catch {
    capture.cancel();
    return { ok: false as const, code: "invalid-action" as const };
  }
}
