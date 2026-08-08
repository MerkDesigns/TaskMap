import type { CanvasSize } from "../../../canvas/geometry/canvasGeometry";
import type { CanvasViewport } from "../../../canvas/geometry/viewportMath";

export interface BackdropSceneIdentity {
  readonly key: string;
  readonly revision: number;
}

/** Unique identity of one requested asynchronous build, independent of its scene payload. */
export interface CacheBuildRequestIdentity {
  readonly lifecycleEpoch: number;
  readonly buildSerial: number;
}

export interface CacheBuildAnchor {
  readonly viewport: CanvasViewport;
  readonly marginCssPx: number;
  readonly cacheScale: number;
  readonly cacheCssSize: CanvasSize;
  readonly cacheBackingSize: CanvasSize;
}

/**
 * Bounded immutable metadata for an expensive build. Scene primitives travel separately in B2;
 * document models, user content, and media bytes never belong in this descriptor.
 */
export interface CacheBuildDescriptor {
  readonly request: CacheBuildRequestIdentity;
  readonly scene: BackdropSceneIdentity;
  readonly sharedProfileRevision: number;
  readonly anchor: CacheBuildAnchor;
  readonly outputBackingSize: CanvasSize;
}

export interface CacheBuildDescriptorInput {
  readonly lifecycleEpoch: number;
  readonly buildSerial: number;
  readonly sceneKey: string;
  readonly sceneRevision: number;
  readonly sharedProfileRevision: number;
  readonly anchorViewport: CanvasViewport;
  readonly marginCssPx: number;
  readonly cacheScale: number;
  readonly cacheCssSize: CanvasSize;
  readonly cacheBackingSize: CanvasSize;
  readonly outputBackingSize: CanvasSize;
}

export interface DisposableCacheResource {
  close(): void;
}

export type CacheBuildRequestOrder = -1 | 0 | 1;

export function createCacheBuildDescriptor(input: CacheBuildDescriptorInput): CacheBuildDescriptor {
  const sceneKey = input.sceneKey;
  if (!sceneKey.trim()) throw new RangeError("sceneKey must not be empty");

  const descriptor: CacheBuildDescriptor = {
    request: Object.freeze({
      lifecycleEpoch: requireNonNegativeInteger(input.lifecycleEpoch, "lifecycleEpoch"),
      buildSerial: requireNonNegativeInteger(input.buildSerial, "buildSerial"),
    }),
    scene: Object.freeze({
      key: sceneKey,
      revision: requireNonNegativeInteger(input.sceneRevision, "sceneRevision"),
    }),
    sharedProfileRevision: requireNonNegativeInteger(
      input.sharedProfileRevision,
      "sharedProfileRevision",
    ),
    anchor: Object.freeze({
      viewport: freezeViewport(input.anchorViewport),
      marginCssPx: requirePositiveFinite(input.marginCssPx, "marginCssPx"),
      cacheScale: requirePositiveFinite(input.cacheScale, "cacheScale"),
      cacheCssSize: freezePositiveSize(input.cacheCssSize, "cacheCssSize", false),
      cacheBackingSize: freezePositiveSize(input.cacheBackingSize, "cacheBackingSize", true),
    }),
    outputBackingSize: freezePositiveSize(input.outputBackingSize, "outputBackingSize", true),
  };
  return Object.freeze(descriptor);
}

export function sameCacheBuildRequestIdentity(
  left: CacheBuildDescriptor,
  right: CacheBuildDescriptor,
): boolean {
  return compareCacheBuildRequestIdentity(left.request, right.request) === 0;
}

/** Chronological ordering uses lifecycle first and build serial second. */
export function compareCacheBuildRequestIdentity(
  left: CacheBuildRequestIdentity,
  right: CacheBuildRequestIdentity,
): CacheBuildRequestOrder {
  if (left.lifecycleEpoch !== right.lifecycleEpoch) {
    return left.lifecycleEpoch < right.lifecycleEpoch ? -1 : 1;
  }
  if (left.buildSerial === right.buildSerial) return 0;
  return left.buildSerial < right.buildSerial ? -1 : 1;
}

/** Result acceptance compares every assumption, not only a caller-provided serial. */
export function cacheBuildDescriptorsEqual(
  left: CacheBuildDescriptor,
  right: CacheBuildDescriptor,
): boolean {
  return (
    sameCacheBuildRequestIdentity(left, right) &&
    left.scene.key === right.scene.key &&
    left.scene.revision === right.scene.revision &&
    left.sharedProfileRevision === right.sharedProfileRevision &&
    viewportsEqual(left.anchor.viewport, right.anchor.viewport) &&
    left.anchor.marginCssPx === right.anchor.marginCssPx &&
    left.anchor.cacheScale === right.anchor.cacheScale &&
    sizesEqual(left.anchor.cacheCssSize, right.anchor.cacheCssSize) &&
    sizesEqual(left.anchor.cacheBackingSize, right.anchor.cacheBackingSize) &&
    sizesEqual(left.outputBackingSize, right.outputBackingSize)
  );
}

function freezeViewport(viewport: CanvasViewport): CanvasViewport {
  const zoom = requirePositiveFinite(viewport.zoom, "anchorViewport.zoom");
  const pan = Object.freeze({
    x: requireFinite(viewport.pan.x, "anchorViewport.pan.x"),
    y: requireFinite(viewport.pan.y, "anchorViewport.pan.y"),
  });
  return Object.freeze({
    pan,
    zoom,
    screen: freezePositiveSize(viewport.screen, "anchorViewport.screen", false),
  });
}

function freezePositiveSize(size: CanvasSize, name: string, integer: boolean): CanvasSize {
  const width = requirePositiveFinite(size.width, `${name}.width`);
  const height = requirePositiveFinite(size.height, `${name}.height`);
  if (integer && (!Number.isInteger(width) || !Number.isInteger(height))) {
    throw new RangeError(`${name} dimensions must be integers`);
  }
  return Object.freeze({ width, height });
}

function viewportsEqual(left: CanvasViewport, right: CanvasViewport): boolean {
  return (
    left.pan.x === right.pan.x &&
    left.pan.y === right.pan.y &&
    left.zoom === right.zoom &&
    sizesEqual(left.screen, right.screen)
  );
}

function sizesEqual(left: CanvasSize, right: CanvasSize): boolean {
  return left.width === right.width && left.height === right.height;
}

function requireNonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function requirePositiveFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
  return value;
}

function requireFinite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}
