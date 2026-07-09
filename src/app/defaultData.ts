import { CANVAS_HEIGHT, CANVAS_WIDTH, DEFAULT_CONTAINER_ACCENT } from "../constants";
import { CanvasGridStyle, ContainerElement, TaskCanvas } from "../types";

export const DEFAULT_PAN = { x: -520, y: -420 };

export const DEFAULT_GRID_OPACITY: Record<CanvasGridStyle, number> = {
  dots: 50,
  lines: 15,
};

export const DEFAULT_ELEMENTS: ContainerElement[] = [
  {
    id: "container-1",
    name: "Container 1",
    x: 520,
    y: 460,
    width: 380,
    height: 260,
    accent: DEFAULT_CONTAINER_ACCENT,
  },
];

export const DEFAULT_CANVAS: TaskCanvas = {
  id: "canvas-1",
  name: "Canvas 1",
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  containers: DEFAULT_ELEMENTS,
  textCards: [],
  textBlocks: [],
  images: [],
  pan: DEFAULT_PAN,
  zoom: 1,
};
