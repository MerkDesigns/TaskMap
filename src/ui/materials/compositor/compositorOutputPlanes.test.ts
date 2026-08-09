// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createAcrylicBitmapResource } from "./acrylicBitmapResource";
import { createCompositorOutputPlaneSet } from "./compositorOutputPlanes";
import { createTestDescriptor, FakeBitmap } from "./compositorTestFixtures";

describe("base and modal compositor output planes", () => {
  it("keeps base and modal masks independent and rounded", () => {
    const base = new FakeCanvas();
    const modal = new FakeCanvas();
    const masks: FakeCanvas[] = [];
    const outputs = createCompositorOutputPlaneSet(
      { base: base as unknown as HTMLCanvasElement, modal: modal as unknown as HTMLCanvasElement },
      {
        create() {
          const canvas = new FakeCanvas();
          masks.push(canvas);
          return canvas as unknown as HTMLCanvasElement;
        },
      },
    );
    outputs.resize({ width: 800, height: 500 }, { width: 600, height: 375 });
    outputs.rebuildMask(
      "base",
      [{ bounds: { x: 10, y: 20, width: 100, height: 60 }, radiusPx: 12, visible: true }],
      0.75,
    );
    expect(masks[0].context.operations.some(([name]) => name === "quadraticCurveTo")).toBe(true);
    expect(masks[0].context.operations.filter(([name]) => name === "fill")).toHaveLength(1);
    expect(masks[1].context.operations.filter(([name]) => name === "fill")).toHaveLength(0);
  });

  it("reprojects one accepted cache into both planes in one compose call", () => {
    const base = new FakeCanvas();
    const modal = new FakeCanvas();
    const outputs = createCompositorOutputPlaneSet(
      { base: base as unknown as HTMLCanvasElement, modal: modal as unknown as HTMLCanvasElement },
      { create: () => new FakeCanvas() as unknown as HTMLCanvasElement },
    );
    const descriptor = createTestDescriptor(1);
    outputs.resize(descriptor.anchor.viewport.screen, descriptor.outputBackingSize);
    const bitmap = new FakeBitmap(
      descriptor.anchor.cacheBackingSize.width,
      descriptor.anchor.cacheBackingSize.height,
    );
    outputs.compose(
      { descriptor, resource: createAcrylicBitmapResource(bitmap) },
      descriptor.anchor.viewport,
    );
    for (const canvas of [base, modal]) {
      expect(canvas.context.operations.filter(([name]) => name === "drawImage")).toHaveLength(2);
      expect(canvas.context.globalCompositeOperation).toBe("destination-in");
    }
  });

  it("keeps masked output empty when no compatible acrylic cache is available", () => {
    const base = new FakeCanvas();
    const modal = new FakeCanvas();
    const outputs = createCompositorOutputPlaneSet(
      { base: base as unknown as HTMLCanvasElement, modal: modal as unknown as HTMLCanvasElement },
      { create: () => new FakeCanvas() as unknown as HTMLCanvasElement },
    );
    const descriptor = createTestDescriptor(1);
    outputs.resize(descriptor.anchor.viewport.screen, descriptor.outputBackingSize);

    outputs.compose(null, descriptor.anchor.viewport);

    for (const canvas of [base, modal]) {
      expect(canvas.context.operations.some(([name]) => name === "clearRect")).toBe(true);
      expect(canvas.context.operations.some(([name]) => name === "drawImage")).toBe(false);
    }
  });
});

class FakeCanvas {
  width = 1;
  height = 1;
  style = { width: "", height: "" };
  readonly context = new FakeContext();
  getContext() {
    return this.context;
  }
}

class FakeContext {
  fillStyle = "";
  globalCompositeOperation = "source-over";
  readonly operations: unknown[][] = [];
  setTransform(...values: number[]) {
    this.operations.push(["setTransform", ...values]);
  }
  clearRect(...values: number[]) {
    this.operations.push(["clearRect", ...values]);
  }
  beginPath() {
    this.operations.push(["beginPath"]);
  }
  moveTo(...values: number[]) {
    this.operations.push(["moveTo", ...values]);
  }
  lineTo(...values: number[]) {
    this.operations.push(["lineTo", ...values]);
  }
  quadraticCurveTo(...values: number[]) {
    this.operations.push(["quadraticCurveTo", ...values]);
  }
  closePath() {
    this.operations.push(["closePath"]);
  }
  fill() {
    this.operations.push(["fill"]);
  }
  save() {
    this.operations.push(["save"]);
  }
  drawImage(...values: unknown[]) {
    this.operations.push(["drawImage", ...values]);
  }
  restore() {
    this.operations.push(["restore"]);
  }
}
