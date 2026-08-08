import { createViewport } from "../../../canvas/geometry/viewportMath";
import { calculateAdaptiveQuality } from "./adaptiveQuality";
import type { AcrylicCanvas2DContext, AcrylicCanvasSurface } from "./acrylicCanvas";
import { createAcrylicBitmapResource } from "./acrylicBitmapResource";
import type {
  AcrylicBuildResult,
  AcrylicCacheBuildExecutor,
  AcrylicCacheBuildPayload,
} from "./acrylicBuildExecutor";
import type { BackdropScene } from "./backdropScene";
import { parseBackdropScene } from "./backdropSceneValidation";
import { createCacheBuildDescriptor, type CacheBuildDescriptor } from "./compositorTypes";
import { SHARED_ACRYLIC_PROFILE_REVISION } from "./sharedAcrylicProfile";

export function createTestDescriptor(
  buildSerial: number,
  overrides: Partial<{
    lifecycleEpoch: number;
    sceneKey: string;
    sceneRevision: number;
    panX: number;
    panY: number;
    zoom: number;
    viewportWidth: number;
    viewportHeight: number;
  }> = {},
): CacheBuildDescriptor {
  const quality = calculateAdaptiveQuality({
    viewportWidthCssPx: overrides.viewportWidth ?? 800,
    viewportHeightCssPx: overrides.viewportHeight ?? 500,
  });
  return createCacheBuildDescriptor({
    lifecycleEpoch: overrides.lifecycleEpoch ?? 1,
    buildSerial,
    sceneKey: overrides.sceneKey ?? "scene-a",
    sceneRevision: overrides.sceneRevision ?? 1,
    sharedProfileRevision: SHARED_ACRYLIC_PROFILE_REVISION,
    anchorViewport: createViewport(
      { x: overrides.panX ?? 0, y: overrides.panY ?? 0 },
      overrides.zoom ?? 1,
      quality.viewportCssSize,
    ),
    marginCssPx: quality.marginCssPx,
    cacheScale: quality.cacheScale,
    cacheCssSize: quality.cacheCssSize,
    cacheBackingSize: quality.cacheBackingSize,
    outputBackingSize: quality.compositorBackingSize,
  });
}

export function createTestScene(
  overrides: Partial<{ key: string; revision: number; grid: "dots" | "lines" | null }> = {},
): BackdropScene {
  const grid =
    overrides.grid === null
      ? null
      : overrides.grid === "lines"
        ? {
            kind: "lines",
            spacingWorld: 40,
            offsetWorld: { x: 0, y: 0 },
            minorColor: "#222",
            majorColor: "#444",
            majorEvery: 5,
            lineWidthWorld: 1,
          }
        : {
            kind: "dots",
            spacingWorld: 40,
            offsetWorld: { x: 0, y: 0 },
            color: "#333",
            radiusWorld: 1.25,
          };
  return parseBackdropScene({
    identity: { key: overrides.key ?? "scene-a", revision: overrides.revision ?? 1 },
    worldBounds: { x: -500, y: -400, width: 2000, height: 1600 },
    background: { cacheFill: "#08090a", worldFill: "#101214", worldCornerRadius: 24 },
    grid,
    primitives: [
      {
        kind: "filled-rectangle",
        bounds: { x: 10, y: 20, width: 80, height: 40 },
        fill: "#334455",
        stroke: null,
      },
      {
        kind: "filled-rounded-rectangle",
        bounds: { x: 120, y: 80, width: 100, height: 60 },
        radiusWorld: 12,
        fill: "#556677",
        stroke: { color: "#ffffff", widthWorld: 2 },
      },
    ],
  });
}

export class FakeBitmap {
  closes = 0;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}
  close(): void {
    this.closes += 1;
  }
}

export class RecordingCanvasContext implements AcrylicCanvas2DContext {
  readonly operations: unknown[][] = [];
  private fillValue = "";
  private strokeValue = "";
  private width = 1;
  private currentFilter = "none";
  set fillStyle(value: string) {
    this.fillValue = value;
    this.operations.push(["fillStyle", value]);
  }
  get fillStyle(): string {
    return this.fillValue;
  }
  set strokeStyle(value: string) {
    this.strokeValue = value;
    this.operations.push(["strokeStyle", value]);
  }
  get strokeStyle(): string {
    return this.strokeValue;
  }
  set lineWidth(value: number) {
    this.width = value;
    this.operations.push(["lineWidth", value]);
  }
  get lineWidth(): number {
    return this.width;
  }
  set filter(value: string) {
    this.currentFilter = value;
    this.operations.push(["filter", value]);
  }
  get filter(): string {
    return this.currentFilter;
  }
  setTransform(...values: [number, number, number, number, number, number]): void {
    this.operations.push(["setTransform", ...values]);
  }
  clearRect(...values: [number, number, number, number]): void {
    this.operations.push(["clearRect", ...values]);
  }
  fillRect(...values: [number, number, number, number]): void {
    this.operations.push(["fillRect", ...values]);
  }
  save(): void {
    this.operations.push(["save"]);
  }
  restore(): void {
    this.operations.push(["restore"]);
  }
  beginPath(): void {
    this.operations.push(["beginPath"]);
  }
  closePath(): void {
    this.operations.push(["closePath"]);
  }
  moveTo(x: number, y: number): void {
    this.operations.push(["moveTo", x, y]);
  }
  lineTo(x: number, y: number): void {
    this.operations.push(["lineTo", x, y]);
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.operations.push(["quadraticCurveTo", cpx, cpy, x, y]);
  }
  arc(x: number, y: number, radius: number, start: number, end: number): void {
    this.operations.push(["arc", x, y, radius, start, end]);
  }
  clip(): void {
    this.operations.push(["clip"]);
  }
  fill(): void {
    this.operations.push(["fill"]);
  }
  stroke(): void {
    this.operations.push(["stroke"]);
  }
  drawImage(source: object, x: number, y: number): void {
    this.operations.push(["drawImage", source, x, y]);
  }
}

export function recordingSurface(
  width: number,
  height: number,
): AcrylicCanvasSurface & { readonly context: RecordingCanvasContext } {
  const context = new RecordingCanvasContext();
  return { width, height, context, imageSource: { width, height } };
}

interface PendingFakeBuild {
  readonly payload: AcrylicCacheBuildPayload;
  readonly complete: (result: AcrylicBuildResult<FakeBitmap>) => void;
}

export class ControlledAcrylicExecutor implements AcrylicCacheBuildExecutor<FakeBitmap> {
  readonly starts: PendingFakeBuild[] = [];
  disposeCount = 0;
  constructor(readonly kind: "worker-offscreen" | "main-thread-fallback") {}
  start(payload: AcrylicCacheBuildPayload, complete: PendingFakeBuild["complete"]): void {
    this.starts.push({ payload, complete });
  }
  succeed(index: number, bitmap = this.bitmapFor(index)): FakeBitmap {
    const pending = this.starts[index];
    pending.complete({
      kind: "success",
      descriptor: pending.payload.descriptor,
      resource: createAcrylicBitmapResource(bitmap),
    });
    return bitmap;
  }
  fail(index: number, fatal = this.kind === "worker-offscreen"): void {
    const pending = this.starts[index];
    pending.complete({
      kind: "failure",
      descriptor: pending.payload.descriptor,
      code: this.kind === "worker-offscreen" ? "worker-error" : "render-failed",
      fatal,
    });
  }
  dispose(): void {
    this.disposeCount += 1;
  }
  private bitmapFor(index: number): FakeBitmap {
    const size = this.starts[index].payload.descriptor.anchor.cacheBackingSize;
    return new FakeBitmap(size.width, size.height);
  }
}
