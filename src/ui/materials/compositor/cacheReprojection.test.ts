// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createViewport } from "../../../canvas/geometry/viewportMath";
import { calculateCacheReprojection } from "./cacheReprojection";
import { createTestDescriptor } from "./compositorTestFixtures";

describe("accepted cache reprojection", () => {
  it("maps pan and non-1 current/anchor zoom through canonical viewport math", () => {
    const descriptor = createTestDescriptor(1, { panX: 70, panY: -35, zoom: 1.75 });
    const current = createViewport({ x: 110, y: 20 }, 1.25, descriptor.anchor.viewport.screen);
    const output = { width: 600, height: 375 };
    const projection = calculateCacheReprojection(descriptor, current, output);
    const anchor = descriptor.anchor.viewport;
    const scale = descriptor.anchor.cacheScale;
    expect(projection.source.x).toBeCloseTo(
      (descriptor.anchor.marginCssPx + anchor.pan.x - (110 / 1.25) * anchor.zoom) * scale,
    );
    expect(projection.source.y).toBeCloseTo(
      (descriptor.anchor.marginCssPx + anchor.pan.y - (20 / 1.25) * anchor.zoom) * scale,
    );
    expect(projection.source.width).toBeCloseTo(
      current.screen.width * (anchor.zoom / current.zoom) * scale,
    );
    expect(projection.source.height).toBeCloseTo(
      current.screen.height * (anchor.zoom / current.zoom) * scale,
    );
    expect(projection.destination).toEqual({ x: 0, y: 0, ...output });
  });

  it("uses cache scale only for source pixels and compositor backing size for destination", () => {
    const descriptor = createTestDescriptor(1);
    const projection = calculateCacheReprojection(
      descriptor,
      descriptor.anchor.viewport,
      descriptor.outputBackingSize,
    );
    expect(projection.source).toEqual({
      x: descriptor.anchor.marginCssPx * descriptor.anchor.cacheScale,
      y: descriptor.anchor.marginCssPx * descriptor.anchor.cacheScale,
      width: descriptor.anchor.viewport.screen.width * descriptor.anchor.cacheScale,
      height: descriptor.anchor.viewport.screen.height * descriptor.anchor.cacheScale,
    });
    expect(projection.destination.width).toBe(descriptor.outputBackingSize.width);
  });
});
