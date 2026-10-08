import type { RefObject } from "react";
import type {
  CanvasInteractionController,
  GeometryPreview,
  InteractionElement,
} from "../app/interactions/canvasInteractionTypes";
import { rectanglesIntersect } from "../canvas/geometry/canvasGeometry";
import { viewportWorldRectangle } from "../canvas/geometry/viewportMath";
import { clamp } from "../canvasMath";
import type { ContainerElement, TextBlockElement, TextCardElement } from "../types";
import {
  clipToContainer,
  connectableBounds,
  connectableElementBounds,
  containerRowSize,
  looseCardBounds,
  measureRenderedCard,
} from "./canvasElementBounds";
import {
  CONTAINER_TEXT_CARD_ROW_HEIGHT,
  type ContainerCardLayoutModel,
} from "./containerCardLayout";
import type { DropBounds } from "./extensionDropTarget";
import type { useCanvasScene } from "./useCanvasScene";

type Size = { readonly width: number; readonly height: number };

export interface CanvasGeometryInput {
  readonly worldRef: RefObject<HTMLDivElement | null>;
  readonly controller: CanvasInteractionController;
  readonly canvas: Size;
  readonly scene: ReturnType<typeof useCanvasScene>;
  readonly cardLayout: ContainerCardLayoutModel;
  /** Where a card sits at rest: its container row, or its own position when loose. */
  readonly restingPosition: (card: TextCardElement) => { x: number; y: number };
  readonly measuredCardSizes: ReadonlyMap<string, Size>;
  /** Top-level elements as the interaction controller moves and resizes them. */
  readonly interactionElements: readonly InteractionElement[];
  readonly previews: readonly GeometryPreview[];
  readonly isLocked: (id: string) => boolean;
}

/**
 * Where things are on the canvas for this render: pointer positions in canvas units, previewed
 * gesture geometry, card positions and bounds (measured where rendered, estimated otherwise),
 * connection anchors and the elements gestures act on.
 */
export function createCanvasGeometry({
  worldRef,
  controller,
  canvas,
  scene,
  cardLayout,
  restingPosition,
  measuredCardSizes,
  interactionElements,
  previews,
  isLocked,
}: CanvasGeometryInput) {
  const previewById = new Map(previews.map((preview) => [preview.id, preview.geometry]));
  const looseCard = (card: TextCardElement) =>
    looseCardBounds(card, measuredCardSizes.get(card.id));
  const renderPosition = (card: TextCardElement) => {
    const preview = previewById.get(card.id);
    if (preview) return { x: preview.x, y: preview.y };
    if (!card.containerId) return undefined;
    const container = scene.containersById.get(card.containerId);
    return container ? cardLayout.cardPosition(container, card) : { x: card.x, y: card.y };
  };

  /** A card's shown bounds, clipped to its container; null when scrolled out of view. */
  const cardRippleBounds = (card: TextCardElement): DropBounds | null => {
    const measured = measureRenderedCard(
      worldRef.current,
      controller.getSnapshot().viewport.zoom,
      card.id,
    );
    if (!card.containerId) return measured ?? { ...looseCard(card), borderRadius: 8 };
    const container = scene.containersById.get(card.containerId);
    const position = renderPosition(card);
    if (!container || !position) return null;
    if (!cardLayout.visible(container).some(({ id }) => id === card.id)) return null;
    return clipToContainer(
      container,
      measured ?? { left: position.x, top: position.y, ...containerRowSize(container) },
    );
  };

  return {
    preview: (id: string) => previewById.get(id),
    /** A pointer position in canvas units, kept inside the canvas. */
    canvasPoint(event: { clientX: number; clientY: number }) {
      const { zoom } = controller.getSnapshot().viewport;
      const worldRect = worldRef.current?.getBoundingClientRect();
      if (!worldRect) return { x: 0, y: 0 };
      return {
        x: clamp((event.clientX - worldRect.left) / zoom, 0, canvas.width),
        y: clamp((event.clientY - worldRect.top) / zoom, 0, canvas.height),
      };
    },
    isFrameVisible: (element: ContainerElement | TextBlockElement) =>
      rectanglesIntersect(viewportWorldRectangle(controller.getSnapshot().viewport), element),
    /** A card's shown position: previewed while it moves, its row when contained. */
    renderPosition,
    looseCard,
    connectableBoundsOf: (id: string) =>
      connectableElementBounds(
        id,
        {
          element: (elementId) =>
            scene.find.container(elementId) ??
            scene.find.textBlock(elementId) ??
            scene.find.image(elementId),
          card: scene.find.card,
        },
        looseCard,
      ),
    connectableBounds: () =>
      connectableBounds(
        {
          containers: [...scene.containersById.values()],
          textBlocks: [...scene.textBlocksById.values()],
          images: scene.looseImages,
          mindmapNodes: scene.looseCards.filter((card) => card.kind === "mindmap"),
        },
        looseCard,
        (id) => previewById.get(id),
      ),
    cardRippleBounds,
    /** A container's shown cards as move targets, at their on-screen bounds. */
    containerCardCandidates(container: ContainerElement): InteractionElement[] {
      return cardLayout.visible(container).flatMap((card) => {
        const bounds = cardRippleBounds(card);
        return bounds
          ? [
              {
                id: card.id,
                geometry: {
                  x: bounds.left,
                  y: bounds.top,
                  width: bounds.width,
                  height: bounds.height,
                },
                locked: isLocked(card.id),
                movable: true,
                resizable: false,
              },
            ]
          : [];
      });
    },
    /** The element a gesture acts on; contained cards only when the gesture can move them. */
    gestureElement(id: string, includeContainedCard = false): InteractionElement | null {
      const generic = interactionElements.find((element) => element.id === id);
      if (generic) return generic;
      const card = scene.textCardsById.get(id);
      if (!card || !includeContainedCard) return null;
      const position = restingPosition(card);
      const measuredSize = measuredCardSizes.get(id);
      return {
        id,
        geometry: {
          x: position.x,
          y: position.y,
          width: measuredSize?.width ?? CONTAINER_TEXT_CARD_ROW_HEIGHT * 5,
          height: measuredSize?.height ?? CONTAINER_TEXT_CARD_ROW_HEIGHT,
        },
        locked: isLocked(id),
        movable: true,
        resizable: false,
        centerSnapping: card.kind === "mindmap",
      };
    },
  };
}
