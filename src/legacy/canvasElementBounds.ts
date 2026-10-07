import { useCallback, useMemo, useRef, useState } from "react";
import type { MindmapBounds } from "../mindmapMath";
import type { ContainerElement, ImageElement, TextBlockElement, TextCardElement } from "../types";
import {
  CONTAINER_TEXT_CARD_PADDING,
  CONTAINER_TEXT_CARD_ROW_HEIGHT,
  containerCardStackTop,
} from "./containerCardLayout";
import type { DropBounds } from "./extensionDropTarget";

type Size = { readonly width: number; readonly height: number };
type Rect = Size & { readonly x: number; readonly y: number };
type Box = Size & { readonly left: number; readonly top: number };

const CARD_RADIUS = 8;

/**
 * The text card sizes the canvas has rendered, for the open canvas. Cards report their size as
 * they lay out; a size measured on another canvas is ignored until the card reports again.
 */
export function useMeasuredTextCardSizes(activeCanvasId: string) {
  const [measured, setMeasured] = useState<Record<string, Size & { canvasId: string }>>({});
  const activeCanvas = useRef(activeCanvasId);
  activeCanvas.current = activeCanvasId;

  const remember = useCallback((id: string, size: Size) => {
    const canvasId = activeCanvas.current;
    setMeasured((current) => {
      const previous = current[id];
      if (
        previous?.canvasId === canvasId &&
        previous.width === size.width &&
        previous.height === size.height
      )
        return current;
      return { ...current, [id]: { canvasId, ...size } };
    });
  }, []);

  const sizes = useMemo<ReadonlyMap<string, Size>>(
    () =>
      new Map(
        Object.entries(measured).flatMap(([id, size]) =>
          size.canvasId === activeCanvasId ? [[id, size] as const] : [],
        ),
      ),
    [activeCanvasId, measured],
  );

  return { sizes, remember };
}

/**
 * A loose card's bounds: its measured size, or before it has rendered an estimate from its text
 * (mind-map nodes wrap and grow; plain cards stay one row high).
 */
export function looseCardBounds(card: TextCardElement, measured?: Size): Box {
  const lines = card.text.split("\n");
  const longestLine = Math.max(1, ...lines.map((line) => line.length));
  const estimatedWidth = Math.max(44, Math.min(520, longestLine * 9 + 48));
  const wrappedLines = lines.reduce(
    (count, line) => count + Math.max(1, Math.ceil((line.length * 9) / 472)),
    0,
  );
  const estimatedHeight =
    card.kind === "mindmap"
      ? CONTAINER_TEXT_CARD_ROW_HEIGHT + (wrappedLines - 1) * 24
      : CONTAINER_TEXT_CARD_ROW_HEIGHT;
  return {
    left: card.x,
    top: card.y,
    width: measured?.width || estimatedWidth,
    height: measured?.height || estimatedHeight,
  };
}

const rectOf = ({ left, top, width, height }: Box): Rect => ({ x: left, y: top, width, height });
const withPreview = (rect: Rect, preview?: Partial<Rect>): Rect => ({
  x: preview?.x ?? rect.x,
  y: preview?.y ?? rect.y,
  width: preview?.width ?? rect.width,
  height: preview?.height ?? rect.height,
});

export interface ConnectableScene {
  readonly containers: readonly ContainerElement[];
  readonly textBlocks: readonly TextBlockElement[];
  readonly images: readonly ImageElement[];
  /** Mind-map nodes; other cards cannot connect. */
  readonly mindmapNodes: readonly TextCardElement[];
}

/**
 * The bounds connections attach to, by element id, following a gesture's previewed geometry so
 * connections stay attached while elements move or resize.
 */
export function connectableBounds(
  scene: ConnectableScene,
  cardBounds: (card: TextCardElement) => Box,
  preview: (id: string) => Partial<Rect> | undefined = () => undefined,
): Map<string, MindmapBounds> {
  const bounds = new Map<string, MindmapBounds>();
  for (const element of [...scene.containers, ...scene.textBlocks, ...scene.images])
    bounds.set(element.id, withPreview(element, preview(element.id)));
  for (const card of scene.mindmapNodes)
    bounds.set(card.id, withPreview(rectOf(cardBounds(card)), preview(card.id)));
  return bounds;
}

/** One element's connection bounds at rest, or null when it cannot connect. */
export function connectableElementBounds(
  id: string,
  find: {
    readonly element: (
      id: string,
    ) => ContainerElement | TextBlockElement | ImageElement | undefined;
    readonly card: (id: string) => TextCardElement | undefined;
  },
  cardBounds: (card: TextCardElement) => Box,
): MindmapBounds | null {
  const element = find.element(id);
  if (element) return { x: element.x, y: element.y, width: element.width, height: element.height };
  const card = find.card(id);
  return card?.kind === "mindmap" ? rectOf(cardBounds(card)) : null;
}

/** A rendered card's bounds in canvas units, read from the DOM; null when it is not rendered. */
export function measureRenderedCard(
  world: HTMLElement | null,
  zoom: number,
  id: string,
): DropBounds | null {
  const node = world?.querySelector<HTMLElement>(`[data-text-card-id="${id}"]`);
  if (!world || !node || zoom <= 0) return null;
  const worldRect = world.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  return {
    left: (rect.left - worldRect.left) / zoom,
    top: (rect.top - worldRect.top) / zoom,
    width: rect.width / zoom,
    height: rect.height / zoom,
    borderRadius: CARD_RADIUS,
  };
}

/**
 * The part of a contained card's row that its container shows: rows scrolled under the header
 * are clipped and lose the rounding on the clipped edge. Null when the row is scrolled out.
 */
export function clipToContainer(
  container: ContainerElement,
  row: Box,
  contentTop = containerCardStackTop(container) - CONTAINER_TEXT_CARD_PADDING,
): DropBounds | null {
  const top = Math.max(row.top, contentTop);
  const rowBottom = row.top + row.height;
  const bottom = Math.min(rowBottom, container.y + container.height);
  if (bottom - top <= 0) return null;
  const topRadius = top === row.top ? CARD_RADIUS : 0;
  const bottomRadius = bottom === rowBottom ? CARD_RADIUS : 0;
  return {
    left: row.left,
    top,
    width: row.width,
    height: bottom - top,
    borderTopLeftRadius: topRadius,
    borderTopRightRadius: topRadius,
    borderBottomRightRadius: bottomRadius,
    borderBottomLeftRadius: bottomRadius,
  };
}

/** A contained card's row size before it has been measured: the container's inner width. */
export const containerRowSize = (container: ContainerElement): Size => ({
  width: Math.max(120, container.width - CONTAINER_TEXT_CARD_PADDING * 2),
  height: CONTAINER_TEXT_CARD_ROW_HEIGHT,
});
