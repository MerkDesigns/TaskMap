import { useMemo } from "react";
import { getTextCardAccent } from "../constants";
import type {
  ContainerElement,
  ImageElement,
  MindmapConnection,
  TextBlockElement,
  TextCardElement,
} from "../types";

export interface CanvasSceneInput {
  readonly containers: ContainerElement[];
  readonly textBlocks: TextBlockElement[];
  readonly textCards: TextCardElement[];
  readonly images: ImageElement[];
  readonly connections: MindmapConnection[];
}

/**
 * The open canvas's elements indexed by id, the cards and images not inside a container, and
 * lookups by id that the canvas hooks share.
 */
export function useCanvasScene({
  containers,
  textBlocks,
  textCards,
  images,
  connections,
}: CanvasSceneInput) {
  const containersById = useMemo(
    () => new Map(containers.map((element) => [element.id, element])),
    [containers],
  );
  const textBlocksById = useMemo(
    () => new Map(textBlocks.map((element) => [element.id, element])),
    [textBlocks],
  );
  const textCardsById = useMemo(
    () => new Map(textCards.map((card) => [card.id, card])),
    [textCards],
  );
  const imagesById = useMemo(() => new Map(images.map((image) => [image.id, image])), [images]);
  const connectionsById = useMemo(
    () => new Map(connections.map((connection) => [connection.id, connection])),
    [connections],
  );
  const looseCards = useMemo(() => textCards.filter((card) => !card.containerId), [textCards]);
  const looseImages = useMemo(() => images.filter((image) => !image.containerId), [images]);

  const find = {
    container: (id: string) => containersById.get(id),
    textBlock: (id: string) => textBlocksById.get(id),
    image: (id: string) => imagesById.get(id),
    card: (id: string) => textCardsById.get(id),
  };
  return {
    containersById,
    textBlocksById,
    textCardsById,
    imagesById,
    connectionsById,
    looseCards,
    looseImages,
    find,
    /** The accent of an element's connection ports; undefined for cards that cannot connect. */
    portAccent(id: string): string | undefined {
      const card = textCardsById.get(id);
      return (
        containersById.get(id)?.accent ??
        textBlocksById.get(id)?.accent ??
        imagesById.get(id)?.accent ??
        (card?.kind === "mindmap" ? getTextCardAccent(card.accent) : undefined)
      );
    },
    /** Any element on the canvas by id. */
    element: (id: string) =>
      containersById.get(id) ??
      textCardsById.get(id) ??
      textBlocksById.get(id) ??
      imagesById.get(id),
  };
}
