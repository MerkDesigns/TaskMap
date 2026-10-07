import { useMemo, useRef } from "react";
import type { GeometryPreview } from "../app/interactions/canvasInteractionTypes";
import type { ContainerElement, ImageElement, TextBlockElement, TextCardElement } from "../types";
import { projectLegacyGeometry } from "./interactions/legacyCanvasGeometry";

/** Loose cards are culled by a fixed box rather than their measured size. */
const LOOSE_CARD_CULL_WIDTH = 540;
const LOOSE_CARD_CULL_HEIGHT = 320;

type Layered = { id: string; layer?: number };

/**
 * The items with `layer` set from the layer map. An item keeps its identity while its layer is
 * unchanged, so memoized element renderers skip it.
 */
function useWithLayers<T extends Layered>(items: T[], layerMap: ReadonlyMap<string, number>): T[] {
  const cache = useRef(new Map<string, { source: T; layer?: number; result: T }>());

  return useMemo(() => {
    const activeIds = new Set(items.map((item) => item.id));
    cache.current.forEach((_, id) => {
      if (!activeIds.has(id)) cache.current.delete(id);
    });
    return items.map((item) => {
      const layer = layerMap.get(item.id) ?? item.layer;
      if (layer === item.layer) {
        cache.current.delete(item.id);
        return item;
      }
      const cached = cache.current.get(item.id);
      if (cached?.source === item && cached.layer === layer) return cached.result;
      const result = { ...item, layer };
      cache.current.set(item.id, { source: item, layer, result });
      return result;
    });
  }, [items, layerMap]);
}

export interface CanvasLayerInput {
  readonly containers: ContainerElement[];
  readonly textBlocks: TextBlockElement[];
  readonly textCards: readonly TextCardElement[];
  readonly images: readonly ImageElement[];
  /** The loose cards and images the canvas renders at the top level. */
  readonly looseCards: TextCardElement[];
  readonly looseImages: ImageElement[];
  /** The running gesture's previewed geometry. */
  readonly previews: readonly GeometryPreview[];
}

/**
 * The canvas's top-level elements in paint order, at their previewed geometry during a gesture,
 * plus the boxes the viewport culling tests. Contained cards and images are not top level.
 */
export function useLayeredCanvasElements({
  containers,
  textBlocks,
  textCards,
  images,
  looseCards,
  looseImages,
  previews,
}: CanvasLayerInput) {
  const layerMap = useMemo(() => {
    const ordered = [
      ...containers,
      ...textBlocks,
      ...textCards.filter((card) => !card.containerId),
      ...images.filter((image) => !image.containerId),
    ].sort(
      (left, right) =>
        (left.layer ?? Number.MAX_SAFE_INTEGER) - (right.layer ?? Number.MAX_SAFE_INTEGER),
    );
    return new Map(ordered.map((item, index) => [item.id, index]));
  }, [containers, images, textBlocks, textCards]);

  const settledContainers = useWithLayers(containers, layerMap);
  const settledTextBlocks = useWithLayers(textBlocks, layerMap);
  const settledCards = useWithLayers(looseCards, layerMap);
  const settledImages = useWithLayers(looseImages, layerMap);
  const layeredContainers = useMemo(
    () => projectLegacyGeometry(settledContainers, previews),
    [previews, settledContainers],
  );
  const layeredTextBlocks = useMemo(
    () => projectLegacyGeometry(settledTextBlocks, previews),
    [previews, settledTextBlocks],
  );
  const layeredCards = useMemo(
    () => projectLegacyGeometry(settledCards, previews),
    [previews, settledCards],
  );
  const layeredImages = useMemo(
    () => projectLegacyGeometry(settledImages, previews),
    [previews, settledImages],
  );
  const cullable = useMemo(
    () => [
      ...layeredContainers.map((element) => ({ id: element.id, geometry: element })),
      ...layeredTextBlocks.map((element) => ({ id: element.id, geometry: element })),
      ...layeredCards.map((card) => ({
        id: card.id,
        geometry: {
          x: card.x,
          y: card.y,
          width: LOOSE_CARD_CULL_WIDTH,
          height: LOOSE_CARD_CULL_HEIGHT,
        },
      })),
      ...layeredImages.map((image) => ({ id: image.id, geometry: image })),
    ],
    [layeredContainers, layeredImages, layeredCards, layeredTextBlocks],
  );

  return {
    /** Whether an element is at the top level, where layer commands apply. */
    isTopLevel: (id: string) => layerMap.has(id),
    containers: layeredContainers,
    textBlocks: layeredTextBlocks,
    looseCards: layeredCards,
    images: layeredImages,
    cullable,
  };
}
