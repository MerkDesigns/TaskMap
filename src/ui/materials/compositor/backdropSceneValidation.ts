import type { CanvasPoint, CanvasRectangle } from "../../../canvas/geometry/canvasGeometry";
import {
  MAX_BACKDROP_COORDINATE_ABS,
  MAX_BACKDROP_DIMENSION,
  MAX_BACKDROP_PRIMITIVES,
  type BackdropGrid,
  type BackdropPrimitive,
  type BackdropScene,
  type BackdropStroke,
} from "./backdropScene";

const MAX_SCENE_KEY_LENGTH = 256;
const MAX_COLOR_LENGTH = 128;

/** Parses unknown worker-boundary data into a deeply frozen structured-clone-safe snapshot. */
export function parseBackdropScene(value: unknown): BackdropScene {
  const scene = record(value, "scene");
  const identity = record(scene.identity, "scene.identity");
  const background = record(scene.background, "scene.background");
  const worldBounds = rectangle(scene.worldBounds, "scene.worldBounds");
  const primitives = array(scene.primitives, "scene.primitives");
  if (primitives.length > MAX_BACKDROP_PRIMITIVES) {
    throw new RangeError(`scene.primitives exceeds ${MAX_BACKDROP_PRIMITIVES}`);
  }

  return Object.freeze({
    identity: Object.freeze({
      key: boundedString(identity.key, "scene.identity.key", MAX_SCENE_KEY_LENGTH),
      revision: nonNegativeInteger(identity.revision, "scene.identity.revision"),
    }),
    worldBounds,
    background: Object.freeze({
      cacheFill: color(background.cacheFill, "scene.background.cacheFill"),
      worldFill: color(background.worldFill, "scene.background.worldFill"),
      worldCornerRadius: boundedNonNegativeDimension(
        background.worldCornerRadius,
        "scene.background.worldCornerRadius",
      ),
    }),
    grid: parseGrid(scene.grid),
    primitives: Object.freeze(
      primitives.map((primitive, index) => parsePrimitive(primitive, index)),
    ),
  });
}

function parseGrid(value: unknown): BackdropGrid | null {
  if (value === null) return null;
  const grid = record(value, "scene.grid");
  const spacingWorld = boundedPositiveDimension(grid.spacingWorld, "scene.grid.spacingWorld");
  const offsetWorld = point(grid.offsetWorld, "scene.grid.offsetWorld");

  if (grid.kind === "dots") {
    return Object.freeze({
      kind: "dots",
      spacingWorld,
      offsetWorld,
      color: color(grid.color, "scene.grid.color"),
      radiusWorld: boundedNonNegativeDimension(grid.radiusWorld, "scene.grid.radiusWorld"),
    });
  }
  if (grid.kind === "lines") {
    return Object.freeze({
      kind: "lines",
      spacingWorld,
      offsetWorld,
      minorColor: color(grid.minorColor, "scene.grid.minorColor"),
      majorColor: color(grid.majorColor, "scene.grid.majorColor"),
      majorEvery: positiveInteger(grid.majorEvery, "scene.grid.majorEvery"),
      lineWidthWorld: boundedPositiveDimension(grid.lineWidthWorld, "scene.grid.lineWidthWorld"),
    });
  }
  throw new TypeError("scene.grid.kind must be dots or lines");
}

function parsePrimitive(value: unknown, index: number): BackdropPrimitive {
  const name = `scene.primitives[${index}]`;
  const primitive = record(value, name);
  const base = {
    bounds: rectangle(primitive.bounds, `${name}.bounds`),
    fill: color(primitive.fill, `${name}.fill`),
    stroke: parseStroke(primitive.stroke, `${name}.stroke`),
  };

  if (primitive.kind === "filled-rectangle") {
    return Object.freeze({ kind: primitive.kind, ...base });
  }
  if (primitive.kind === "filled-rounded-rectangle") {
    return Object.freeze({
      kind: primitive.kind,
      ...base,
      radiusWorld: boundedNonNegativeDimension(primitive.radiusWorld, `${name}.radiusWorld`),
    });
  }
  throw new TypeError(`${name}.kind is not a supported generic primitive`);
}

function parseStroke(value: unknown, name: string): BackdropStroke | null {
  if (value === null) return null;
  const stroke = record(value, name);
  return Object.freeze({
    color: color(stroke.color, `${name}.color`),
    widthWorld: boundedPositiveDimension(stroke.widthWorld, `${name}.widthWorld`),
  });
}

function rectangle(value: unknown, name: string): CanvasRectangle {
  const source = record(value, name);
  return Object.freeze({
    x: boundedCoordinate(source.x, `${name}.x`),
    y: boundedCoordinate(source.y, `${name}.y`),
    width: boundedDimension(source.width, `${name}.width`),
    height: boundedDimension(source.height, `${name}.height`),
  });
}

function point(value: unknown, name: string): CanvasPoint {
  const source = record(value, name);
  return Object.freeze({
    x: boundedCoordinate(source.x, `${name}.x`),
    y: boundedCoordinate(source.y, `${name}.y`),
  });
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be a record`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, name: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value;
}

function color(value: unknown, name: string): string {
  return boundedString(value, name, MAX_COLOR_LENGTH);
}

function boundedString(value: unknown, name: string, maximumLength: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximumLength) {
    throw new TypeError(`${name} must be a non-empty bounded string`);
  }
  return value;
}

function boundedCoordinate(value: unknown, name: string): number {
  const number = finite(value, name);
  if (Math.abs(number) > MAX_BACKDROP_COORDINATE_ABS) {
    throw new RangeError(`${name} exceeds the coordinate bound`);
  }
  return number;
}

function boundedDimension(value: unknown, name: string): number {
  return boundedPositiveDimension(value, name);
}

function boundedPositiveDimension(value: unknown, name: string): number {
  const number = positiveFinite(value, name);
  if (number > MAX_BACKDROP_DIMENSION) throw new RangeError(`${name} exceeds the dimension bound`);
  return number;
}

function boundedNonNegativeDimension(value: unknown, name: string): number {
  const number = nonNegativeFinite(value, name);
  if (number > MAX_BACKDROP_DIMENSION) throw new RangeError(`${name} exceeds the dimension bound`);
  return number;
}

function nonNegativeFinite(value: unknown, name: string): number {
  const number = finite(value, name);
  if (number < 0) throw new RangeError(`${name} must be non-negative`);
  return number;
}

function positiveFinite(value: unknown, name: string): number {
  const number = finite(value, name);
  if (number <= 0) throw new RangeError(`${name} must be positive`);
  return number;
}

function finite(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
  return value;
}
