import { clamp } from "../../canvasMath";
import type {
  CanvasRectangle,
  CanvasSize,
  ElementGeometry,
} from "../../canvas/geometry/canvasGeometry";

export interface MinimapElementInput {
  readonly id: string;
  readonly geometry: ElementGeometry;
  readonly minimumPixels?: number;
}

export interface MinimapProjection {
  readonly size: CanvasSize;
  readonly elements: ReadonlyMap<string, CanvasRectangle>;
  readonly viewport: CanvasRectangle;
}

export function createMinimapProjection(
  canvas: CanvasSize,
  viewportWorld: CanvasRectangle,
  elements: readonly MinimapElementInput[],
  maximumSize: number,
): MinimapProjection {
  const canvasWidth = Math.max(1, canvas.width);
  const canvasHeight = Math.max(1, canvas.height);
  const aspect = canvasWidth / canvasHeight;
  const size = {
    width: aspect >= 1 ? maximumSize : Math.max(72, Math.round(maximumSize * aspect)),
    height: aspect >= 1 ? Math.max(72, Math.round(maximumSize / aspect)) : maximumSize,
  };
  const project = (geometry: ElementGeometry, minimumPixels = 0): CanvasRectangle => ({
    x: (geometry.x / canvasWidth) * size.width,
    y: (geometry.y / canvasHeight) * size.height,
    width: Math.max((geometry.width / canvasWidth) * size.width, minimumPixels),
    height: Math.max((geometry.height / canvasHeight) * size.height, minimumPixels),
  });
  return {
    size,
    elements: new Map(
      elements.map(({ id, geometry, minimumPixels }) => [id, project(geometry, minimumPixels)]),
    ),
    viewport: {
      x: (viewportWorld.x / canvasWidth) * size.width,
      y: (viewportWorld.y / canvasHeight) * size.height,
      width: clamp((viewportWorld.width / canvasWidth) * size.width, 0, size.width),
      height: clamp((viewportWorld.height / canvasHeight) * size.height, 0, size.height),
    },
  };
}
