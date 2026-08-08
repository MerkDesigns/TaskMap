import type { TransferableCacheBitmap } from "./acrylicCanvas";
import type { BackdropScene } from "./backdropScene";
import { parseBackdropScene } from "./backdropSceneValidation";
import {
  createCacheBuildDescriptor,
  type CacheBuildDescriptor,
  type CacheBuildRequestIdentity,
} from "./compositorTypes";
import {
  isSharedAcrylicRuntimeProfile,
  SHARED_ACRYLIC_RUNTIME_PROFILE,
  type SharedAcrylicRuntimeProfile,
} from "./sharedAcrylicProfile";

export interface AcrylicWorkerBuildRequest {
  readonly type: "build";
  readonly descriptor: CacheBuildDescriptor;
  readonly scene: BackdropScene;
  readonly profile: SharedAcrylicRuntimeProfile;
}

export interface AcrylicWorkerSuccess<Bitmap extends TransferableCacheBitmap> {
  readonly type: "success";
  readonly descriptor: CacheBuildDescriptor;
  readonly bitmap: Bitmap;
}

export type AcrylicWorkerFailureCode = "invalid-request" | "render-failed" | "bitmap-failed";

export interface AcrylicWorkerFailure {
  readonly type: "failure";
  readonly request: CacheBuildRequestIdentity;
  readonly code: AcrylicWorkerFailureCode;
}

export type AcrylicWorkerResponse<Bitmap extends TransferableCacheBitmap> =
  AcrylicWorkerSuccess<Bitmap> | AcrylicWorkerFailure;

export function createAcrylicWorkerBuildRequest(
  descriptor: CacheBuildDescriptor,
  scene: BackdropScene,
): AcrylicWorkerBuildRequest {
  return Object.freeze({
    type: "build",
    descriptor,
    scene,
    profile: SHARED_ACRYLIC_RUNTIME_PROFILE,
  });
}

export function parseAcrylicWorkerBuildRequest(value: unknown): AcrylicWorkerBuildRequest {
  const request = record(value, "worker request");
  if (request.type !== "build") throw new TypeError("Worker request type must be build");
  const descriptor = parseDescriptor(request.descriptor);
  const scene = parseBackdropScene(request.scene);
  if (
    descriptor.scene.key !== scene.identity.key ||
    descriptor.scene.revision !== scene.identity.revision
  ) {
    throw new Error("Worker request scene identity does not match its descriptor");
  }
  if (!isSharedAcrylicRuntimeProfile(request.profile)) {
    throw new Error("Worker request must use the one shared acrylic profile");
  }
  if (descriptor.sharedProfileRevision !== SHARED_ACRYLIC_RUNTIME_PROFILE.revision) {
    throw new Error("Worker request profile revision does not match its descriptor");
  }
  return Object.freeze({
    type: "build",
    descriptor,
    scene,
    profile: SHARED_ACRYLIC_RUNTIME_PROFILE,
  });
}

export function parseAcrylicWorkerResponse(
  value: unknown,
  isBitmap: (candidate: unknown) => candidate is TransferableCacheBitmap,
): AcrylicWorkerResponse<TransferableCacheBitmap> {
  const response = record(value, "worker response");
  if (response.type === "success") {
    if (!isBitmap(response.bitmap)) throw new TypeError("Worker success bitmap is malformed");
    return Object.freeze({
      type: "success",
      descriptor: parseDescriptor(response.descriptor),
      bitmap: response.bitmap,
    });
  }
  if (response.type === "failure") {
    const code = response.code;
    if (code !== "invalid-request" && code !== "render-failed" && code !== "bitmap-failed") {
      throw new TypeError("Worker failure code is malformed");
    }
    const request = parseRequestIdentity(response.request);
    return Object.freeze({ type: "failure", request, code });
  }
  throw new TypeError("Worker response type is malformed");
}

export function readWorkerRequestIdentity(value: unknown): CacheBuildRequestIdentity | null {
  try {
    const request = record(value, "worker request");
    const descriptor = record(request.descriptor, "worker request descriptor");
    return parseRequestIdentity(descriptor.request);
  } catch {
    return null;
  }
}

export function isTransferableCacheBitmap(value: unknown): value is TransferableCacheBitmap {
  if (typeof value !== "object" || value === null) return false;
  const bitmap = value as Record<string, unknown>;
  return (
    typeof bitmap.width === "number" &&
    Number.isInteger(bitmap.width) &&
    bitmap.width > 0 &&
    typeof bitmap.height === "number" &&
    Number.isInteger(bitmap.height) &&
    bitmap.height > 0 &&
    typeof bitmap.close === "function"
  );
}

export function readBitmapFromMalformedResponse(value: unknown): TransferableCacheBitmap | null {
  if (typeof value !== "object" || value === null) return null;
  const bitmap = (value as Record<string, unknown>).bitmap;
  return isTransferableCacheBitmap(bitmap) ? bitmap : null;
}

function parseDescriptor(value: unknown): CacheBuildDescriptor {
  const descriptor = record(value, "descriptor");
  const request = record(descriptor.request, "descriptor.request");
  const scene = record(descriptor.scene, "descriptor.scene");
  const anchor = record(descriptor.anchor, "descriptor.anchor");
  const viewport = record(anchor.viewport, "descriptor.anchor.viewport");
  const pan = record(viewport.pan, "descriptor.anchor.viewport.pan");
  const screen = record(viewport.screen, "descriptor.anchor.viewport.screen");
  const cacheCssSize = record(anchor.cacheCssSize, "descriptor.anchor.cacheCssSize");
  const cacheBackingSize = record(anchor.cacheBackingSize, "descriptor.anchor.cacheBackingSize");
  const outputBackingSize = record(descriptor.outputBackingSize, "descriptor.outputBackingSize");
  return createCacheBuildDescriptor({
    lifecycleEpoch: number(request.lifecycleEpoch, "descriptor.request.lifecycleEpoch"),
    buildSerial: number(request.buildSerial, "descriptor.request.buildSerial"),
    sceneKey: string(scene.key, "descriptor.scene.key"),
    sceneRevision: number(scene.revision, "descriptor.scene.revision"),
    sharedProfileRevision: number(
      descriptor.sharedProfileRevision,
      "descriptor.sharedProfileRevision",
    ),
    anchorViewport: {
      pan: {
        x: number(pan.x, "descriptor.anchor.viewport.pan.x"),
        y: number(pan.y, "descriptor.anchor.viewport.pan.y"),
      },
      zoom: number(viewport.zoom, "descriptor.anchor.viewport.zoom"),
      screen: {
        width: number(screen.width, "descriptor.anchor.viewport.screen.width"),
        height: number(screen.height, "descriptor.anchor.viewport.screen.height"),
      },
    },
    marginCssPx: number(anchor.marginCssPx, "descriptor.anchor.marginCssPx"),
    cacheScale: number(anchor.cacheScale, "descriptor.anchor.cacheScale"),
    cacheCssSize: {
      width: number(cacheCssSize.width, "descriptor.anchor.cacheCssSize.width"),
      height: number(cacheCssSize.height, "descriptor.anchor.cacheCssSize.height"),
    },
    cacheBackingSize: {
      width: number(cacheBackingSize.width, "descriptor.anchor.cacheBackingSize.width"),
      height: number(cacheBackingSize.height, "descriptor.anchor.cacheBackingSize.height"),
    },
    outputBackingSize: {
      width: number(outputBackingSize.width, "descriptor.outputBackingSize.width"),
      height: number(outputBackingSize.height, "descriptor.outputBackingSize.height"),
    },
  });
}

function parseRequestIdentity(value: unknown): CacheBuildRequestIdentity {
  const request = record(value, "request identity");
  const lifecycleEpoch = number(request.lifecycleEpoch, "request identity.lifecycleEpoch");
  const buildSerial = number(request.buildSerial, "request identity.buildSerial");
  if (
    !Number.isSafeInteger(lifecycleEpoch) ||
    lifecycleEpoch < 0 ||
    !Number.isSafeInteger(buildSerial) ||
    buildSerial < 0
  ) {
    throw new RangeError("Worker request identity must contain non-negative safe integers");
  }
  return Object.freeze({ lifecycleEpoch, buildSerial });
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be a record`);
  }
  return value as Record<string, unknown>;
}

function number(value: unknown, name: string): number {
  if (typeof value !== "number") throw new TypeError(`${name} must be a number`);
  return value;
}

function string(value: unknown, name: string): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  return value;
}
