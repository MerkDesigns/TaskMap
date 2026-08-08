import { rectanglesIntersect, type CanvasRectangle } from "../../../canvas/geometry/canvasGeometry";
import { screenRectangleToWorld } from "../../../canvas/geometry/viewportMath";
import { MAX_BACKDROP_GRID_MARKS } from "./backdropScene";
import type {
  BackdropGrid,
  BackdropPrimitive,
  BackdropScene,
  LineBackdropGrid,
} from "./backdropScene";
import type { AcrylicCanvasSurface, AcrylicCanvas2DContext } from "./acrylicCanvas";
import type { CacheBuildDescriptor } from "./compositorTypes";

/** Shared worker/fallback rasterizer. Coordinates supplied by the scene remain in canvas world space. */
export function rasterizeBackdropScene(
  surface: AcrylicCanvasSurface,
  descriptor: CacheBuildDescriptor,
  scene: BackdropScene,
): void {
  assertRasterInputs(surface, descriptor, scene);
  const context = surface.context;
  const { cacheScale, marginCssPx, viewport, cacheCssSize } = descriptor.anchor;
  const cacheWorldBounds = screenRectangleToWorld(
    { x: -marginCssPx, y: -marginCssPx, ...cacheCssSize },
    viewport,
  );

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, surface.width, surface.height);
  context.fillStyle = scene.background.cacheFill;
  context.fillRect(0, 0, surface.width, surface.height);

  const worldScale = cacheScale * viewport.zoom;
  context.save();
  context.setTransform(
    worldScale,
    0,
    0,
    worldScale,
    cacheScale * (marginCssPx + viewport.pan.x),
    cacheScale * (marginCssPx + viewport.pan.y),
  );
  roundedRectanglePath(context, scene.worldBounds, scene.background.worldCornerRadius);
  context.fillStyle = scene.background.worldFill;
  context.fill();
  roundedRectanglePath(context, scene.worldBounds, scene.background.worldCornerRadius);
  context.clip();

  const gridBounds = intersectRectangles(cacheWorldBounds, scene.worldBounds);
  if (scene.grid && gridBounds) drawGrid(context, scene.grid, gridBounds);
  for (const primitive of scene.primitives) {
    if (rectanglesIntersect(primitive.bounds, cacheWorldBounds)) {
      drawPrimitive(context, primitive);
    }
  }
  context.restore();
}

export function roundedRectanglePath(
  context: AcrylicCanvas2DContext,
  bounds: CanvasRectangle,
  requestedRadius: number,
): void {
  const radius = Math.max(0, Math.min(requestedRadius, bounds.width / 2, bounds.height / 2));
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  context.beginPath();
  context.moveTo(bounds.x + radius, bounds.y);
  context.lineTo(right - radius, bounds.y);
  context.quadraticCurveTo(right, bounds.y, right, bounds.y + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(bounds.x + radius, bottom);
  context.quadraticCurveTo(bounds.x, bottom, bounds.x, bottom - radius);
  context.lineTo(bounds.x, bounds.y + radius);
  context.quadraticCurveTo(bounds.x, bounds.y, bounds.x + radius, bounds.y);
  context.closePath();
}

function drawPrimitive(context: AcrylicCanvas2DContext, primitive: BackdropPrimitive): void {
  if (primitive.kind === "filled-rounded-rectangle") {
    roundedRectanglePath(context, primitive.bounds, primitive.radiusWorld);
  } else {
    rectanglePath(context, primitive.bounds);
  }
  context.fillStyle = primitive.fill;
  context.fill();
  if (primitive.stroke) {
    context.strokeStyle = primitive.stroke.color;
    context.lineWidth = primitive.stroke.widthWorld;
    context.stroke();
  }
}

function drawGrid(
  context: AcrylicCanvas2DContext,
  grid: BackdropGrid,
  bounds: CanvasRectangle,
): void {
  const columns = gridCoordinateCount(
    bounds.x,
    bounds.width,
    grid.spacingWorld,
    grid.offsetWorld.x,
  );
  const rows = gridCoordinateCount(bounds.y, bounds.height, grid.spacingWorld, grid.offsetWorld.y);
  if (grid.kind === "dots") {
    if (columns * rows > MAX_BACKDROP_GRID_MARKS) {
      throw new RangeError(`cache grid exceeds ${MAX_BACKDROP_GRID_MARKS} marks`);
    }
    context.fillStyle = grid.color;
    forEachGridCoordinate(bounds.x, bounds.width, grid.spacingWorld, grid.offsetWorld.x, (x) => {
      forEachGridCoordinate(bounds.y, bounds.height, grid.spacingWorld, grid.offsetWorld.y, (y) => {
        context.beginPath();
        context.arc(x, y, grid.radiusWorld, 0, Math.PI * 2);
        context.fill();
      });
    });
    return;
  }
  if (columns + rows > MAX_BACKDROP_GRID_MARKS) {
    throw new RangeError(`cache grid exceeds ${MAX_BACKDROP_GRID_MARKS} marks`);
  }
  drawLineGrid(context, grid, bounds);
}

function drawLineGrid(
  context: AcrylicCanvas2DContext,
  grid: LineBackdropGrid,
  bounds: CanvasRectangle,
): void {
  context.lineWidth = grid.lineWidthWorld;
  drawLineGridPass(context, grid, bounds, false);
  drawLineGridPass(context, grid, bounds, true);
}

function drawLineGridPass(
  context: AcrylicCanvas2DContext,
  grid: LineBackdropGrid,
  bounds: CanvasRectangle,
  major: boolean,
): void {
  context.strokeStyle = major ? grid.majorColor : grid.minorColor;
  context.beginPath();
  forEachGridCoordinate(bounds.x, bounds.width, grid.spacingWorld, grid.offsetWorld.x, (x) => {
    if (isMajorCoordinate(x, grid.offsetWorld.x, grid.spacingWorld, grid.majorEvery) === major) {
      context.moveTo(x, bounds.y);
      context.lineTo(x, bounds.y + bounds.height);
    }
  });
  forEachGridCoordinate(bounds.y, bounds.height, grid.spacingWorld, grid.offsetWorld.y, (y) => {
    if (isMajorCoordinate(y, grid.offsetWorld.y, grid.spacingWorld, grid.majorEvery) === major) {
      context.moveTo(bounds.x, y);
      context.lineTo(bounds.x + bounds.width, y);
    }
  });
  context.stroke();
}

function forEachGridCoordinate(
  start: number,
  length: number,
  spacing: number,
  offset: number,
  visit: (coordinate: number) => void,
): void {
  const firstIndex = Math.ceil((start - offset) / spacing);
  const count = gridCoordinateCount(start, length, spacing, offset);
  for (let index = 0; index < count; index += 1) {
    visit(offset + (firstIndex + index) * spacing);
  }
}

function gridCoordinateCount(
  start: number,
  length: number,
  spacing: number,
  offset: number,
): number {
  const end = start + length;
  const firstIndex = Math.ceil((start - offset) / spacing);
  const lastIndex = Math.floor((end - offset) / spacing);
  if (!Number.isFinite(firstIndex) || !Number.isFinite(lastIndex)) return Number.POSITIVE_INFINITY;
  return Math.max(0, lastIndex - firstIndex + 1);
}

function isMajorCoordinate(
  coordinate: number,
  offset: number,
  spacing: number,
  majorEvery: number,
): boolean {
  const index = Math.round((coordinate - offset) / spacing);
  return ((index % majorEvery) + majorEvery) % majorEvery === 0;
}

function rectanglePath(context: AcrylicCanvas2DContext, bounds: CanvasRectangle): void {
  context.beginPath();
  context.moveTo(bounds.x, bounds.y);
  context.lineTo(bounds.x + bounds.width, bounds.y);
  context.lineTo(bounds.x + bounds.width, bounds.y + bounds.height);
  context.lineTo(bounds.x, bounds.y + bounds.height);
  context.closePath();
}

function intersectRectangles(
  left: CanvasRectangle,
  right: CanvasRectangle,
): CanvasRectangle | null {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  if (rightEdge <= x || bottomEdge <= y) return null;
  return { x, y, width: rightEdge - x, height: bottomEdge - y };
}

function assertRasterInputs(
  surface: AcrylicCanvasSurface,
  descriptor: CacheBuildDescriptor,
  scene: BackdropScene,
): void {
  if (
    surface.width !== descriptor.anchor.cacheBackingSize.width ||
    surface.height !== descriptor.anchor.cacheBackingSize.height
  ) {
    throw new RangeError("Raster surface must match descriptor cache backing dimensions");
  }
  if (
    scene.identity.key !== descriptor.scene.key ||
    scene.identity.revision !== descriptor.scene.revision
  ) {
    throw new Error("Backdrop scene identity must match the cache build descriptor");
  }
}
