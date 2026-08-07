export interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

export interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

export interface CanvasRectangle extends CanvasPoint, CanvasSize {}

export interface ElementGeometry extends CanvasPoint, CanvasSize {}

export function normalizeRectangle(start: CanvasPoint, end: CanvasPoint): CanvasRectangle {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function rectanglesIntersect(left: CanvasRectangle, right: CanvasRectangle): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

export function geometryEquals(left: ElementGeometry, right: ElementGeometry): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}
