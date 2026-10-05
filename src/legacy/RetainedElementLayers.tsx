import type { ElementId } from "../domain/ids/entityIds";
import {
  ImageRenderer,
  type ImageActions,
  type ImageMediaLeases,
} from "../elements/image/ImageRenderer";
import { asImageDocumentElement, retainedImageMedia } from "../elements/image/imageViewProjection";
import { TextBlockRenderer } from "../elements/text-block/TextBlockRenderer";
import type { TextBlockActions } from "../elements/text-block/textBlockView";
import { asTextBlockDocumentElement } from "../elements/text-block/textBlockViewProjection";
import { TextCardRenderer, type TextCardActions } from "../elements/text-card/TextCardRenderer";
import { asTextCardRendererElement } from "../elements/text-card/textCardViewProjection";
import type { ExtensionCommands } from "../extensions/extensionCommands";
import type { ImageElement, TextBlockElement, TextCardElement } from "../types";
import { useRetainedDocumentElements } from "./RetainedCanvasContext";
import { editDraft, isMultiSelected, type LayerProps } from "./retainedElementPresentation";

export interface ElementShadowRectangle {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly strength: "shell" | "card";
}

/** The shared shadow layer below elements, used when shadows sit under rather than on them. */
export function ElementShadowLayer({
  shadows,
  draggedIds,
  visibleIds,
}: {
  readonly shadows: readonly ElementShadowRectangle[];
  readonly draggedIds: readonly string[];
  readonly visibleIds: ReadonlySet<string>;
}) {
  const shown = shadows.filter((shadow) => visibleIds.has(shadow.id));
  const box = ({ left, top, width, height, radius }: ElementShadowRectangle) => ({
    left,
    top,
    width,
    height,
    borderRadius: radius,
  });
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {shown.map((shadow) => (
        <div
          key={`canvas-shadow-${shadow.id}`}
          className={`canvas-element-shadow canvas-element-shadow-${shadow.strength} absolute`}
          style={box(shadow)}
        />
      ))}
      {shown
        .filter((shadow) => draggedIds.includes(shadow.id))
        .map((shadow) => (
          <div
            key={`canvas-drag-shadow-${shadow.id}`}
            className="canvas-drag-shadow absolute"
            style={box(shadow)}
          />
        ))}
    </div>
  );
}

export function TextBlockLayer({
  elements,
  visibleIds,
  presentation,
  actions,
  extensionCommands,
}: LayerProps<TextBlockElement> & {
  readonly actions: TextBlockActions;
  readonly extensionCommands: ExtensionCommands;
}) {
  const documentElements = useRetainedDocumentElements();
  return elements
    .filter((element) => visibleIds.has(element.id))
    .map((element) => {
      const textBlockElement = asTextBlockDocumentElement(
        documentElements[element.id as ElementId],
      );
      if (!textBlockElement) return null;
      return (
        <TextBlockRenderer
          key={element.id}
          element={textBlockElement}
          actions={actions}
          extensionCommands={extensionCommands}
          view={{
            layer: element.layer ?? 0,
            geometry: { x: element.x, y: element.y, width: element.width, height: element.height },
            extensions: element.extensions,
            selected: presentation.outlinedIds.includes(element.id),
            multiSelected: isMultiSelected(presentation, element.id),
            entering: presentation.entering.textBlocks.includes(element.id),
            deleting: presentation.deleting.textBlocks.includes(element.id),
            pulsing: presentation.pulsing.textBlocks.includes(element.id),
            moving: presentation.draggedIds.includes(element.id),
            shadowsUnderElements: presentation.shadowsUnderElements,
            recentColors: presentation.recentColors,
            editing: presentation.textBlockEdit.id === element.id,
            draft: editDraft(presentation.textBlockEdit, element.id),
            renaming: presentation.rename.id === element.id,
            renameDraft: editDraft(presentation.rename, element.id),
          }}
        />
      );
    });
}

export function LooseTextCardLayer({
  elements,
  visibleIds,
  presentation,
  hiddenIds,
  positionOf,
  actions,
  extensionCommands,
}: LayerProps<TextCardElement> & {
  /** Cards drawn by an overlay instead (held or flying back after a drop). */
  readonly hiddenIds: readonly string[];
  readonly positionOf: (card: TextCardElement) => { x: number; y: number } | undefined;
  readonly actions: TextCardActions;
  readonly extensionCommands: ExtensionCommands;
}) {
  const documentElements = useRetainedDocumentElements();
  const { textCardEdit, entering, deleting, pulsing, draggedIds } = presentation;
  return elements
    .filter((card) => visibleIds.has(card.id) && !hiddenIds.includes(card.id))
    .map((card) => {
      const cardElement = asTextCardRendererElement(documentElements[card.id as ElementId]);
      if (!cardElement) return null;
      const dragged = draggedIds.includes(card.id);
      return (
        <TextCardRenderer
          key={card.id}
          element={cardElement}
          actions={actions}
          extensionCommands={extensionCommands}
          view={{
            layer: card.layer ?? 0,
            extensions: card.extensions,
            editing: textCardEdit.id === card.id,
            draft: editDraft(textCardEdit, card.id),
            position: positionOf(card),
            entering: entering.textCards.includes(card.id),
            deleting: deleting.textCards.includes(card.id),
            pulsing: pulsing.textCards.includes(card.id),
            drag: dragged
              ? {
                  primary: presentation.primaryMoveId === card.id,
                  atTrueSize: false,
                  bundleIndex: draggedIds.indexOf(card.id),
                  pickupX: 0,
                  pickupY: 0,
                  swayX: 0,
                  swayY: 0,
                }
              : undefined,
            motion: dragged ? "moving" : undefined,
            selected: presentation.outlinedIds.includes(card.id),
            linksDisabled: presentation.selectedIds.length > 1,
            shadowsUnderElements: presentation.shadowsUnderElements,
          }}
        />
      );
    });
}

export function ImageLayer({
  elements,
  visibleIds,
  presentation,
  actions,
  leases,
}: LayerProps<ImageElement> & {
  readonly actions: ImageActions;
  readonly leases: ImageMediaLeases;
}) {
  const documentElements = useRetainedDocumentElements();
  return elements
    .filter((image) => visibleIds.has(image.id))
    .map((image) => {
      const imageElement = asImageDocumentElement(documentElements[image.id as ElementId]);
      if (!imageElement) return null;
      const dragged = presentation.draggedIds.includes(image.id);
      return (
        <ImageRenderer
          key={image.id}
          element={imageElement}
          actions={actions}
          leases={leases}
          view={{
            layer: image.layer ?? 0,
            geometry: { x: image.x, y: image.y, width: image.width, height: image.height },
            media: retainedImageMedia(image),
            importing: presentation.importingImageIds.includes(image.id),
            selected: presentation.outlinedIds.includes(image.id),
            entering: presentation.entering.images.includes(image.id),
            deleting: presentation.deleting.images.includes(image.id),
            dragging: dragged,
            // Only moves and resizes drag elements, so a dragged image is mid-gesture.
            gesture: dragged,
            shadowsUnderElements: presentation.shadowsUnderElements,
          }}
        />
      );
    });
}
