import { clamp } from "../canvasMath";
import type {
  ContainerElement,
  DefaultElementColors,
  ImageElement,
  TextBlockElement,
  TextCardElement,
} from "../types";

type Point = { readonly x: number; readonly y: number };
type Size = { readonly width: number; readonly height: number };

/** Where on the canvas, and in which canvas, a new element is created. */
export interface NewElementPlacement {
  readonly id: string;
  /** The canvas point the user pointed at. */
  readonly point: Point;
  readonly canvas: Size;
  readonly colors: DefaultElementColors;
}

const CONTAINER_SIZE: Size = { width: 360, height: 240 };
const TEXT_BLOCK_SIZE: Size = { width: 320, height: 220 };
const IMAGE_SIZE: Size = { width: 280, height: 200 };
/** Framed elements open with their header just under the pointer. */
const HEADER_GRAB_OFFSET = 28;

/** Centres `size` horizontally on the point, `top` above it, inside the canvas. */
function placeBox(point: Point, size: Size, canvas: Size, top: number) {
  return {
    x: clamp(point.x - size.width / 2, 0, canvas.width - size.width),
    y: clamp(point.y - top, 0, canvas.height - size.height),
    ...size,
  };
}

/** A new container, named after how many the canvas has. */
export function newContainer(
  { id, point, canvas, colors }: NewElementPlacement,
  existingCount: number,
): ContainerElement {
  return {
    id,
    name: `Container ${existingCount + 1}`,
    ...placeBox(point, CONTAINER_SIZE, canvas, HEADER_GRAB_OFFSET),
    accent: colors.container,
  };
}

/** A new text block, named after how many the canvas has. */
export function newTextBlock(
  { id, point, canvas, colors }: NewElementPlacement,
  existingCount: number,
): TextBlockElement {
  return {
    id,
    name: `Text block ${existingCount + 1}`,
    text: "Text block",
    ...placeBox(point, TEXT_BLOCK_SIZE, canvas, HEADER_GRAB_OFFSET),
    accent: colors.textBlock,
  };
}

/** An empty image placeholder, centred on the point; a picked or dropped image fills it later. */
export function newImagePlaceholder({
  id,
  point,
  canvas,
  colors,
}: NewElementPlacement): ImageElement {
  return {
    id,
    ...placeBox(point, IMAGE_SIZE, canvas, IMAGE_SIZE.height / 2),
    accent: colors.image,
  };
}

/** A loose text card, or a mind-map node, starting at the point. */
export function newLooseTextCard(
  { id, point, canvas, colors }: NewElementPlacement,
  text: string,
  kind?: TextCardElement["kind"],
): TextCardElement {
  return {
    id,
    kind,
    text,
    x: clamp(point.x, 0, canvas.width),
    y: clamp(point.y, 0, canvas.height),
    accent: kind === "mindmap" ? colors.mindmap : colors.textCard,
  };
}
