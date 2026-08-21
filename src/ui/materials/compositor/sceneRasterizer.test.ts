// @vitest-environment node
import { describe, expect, it } from "vitest";
import { LEGACY_ACRYLIC_LARGE, LEGACY_ACRYLIC_SMALL } from "../legacyCachedAcrylicDefinitions";
import { MAX_BACKDROP_GRID_MARKS } from "./backdropScene";
import { parseBackdropScene } from "./backdropSceneValidation";
import {
  createTestDescriptor,
  createTestScene,
  FakeBitmap,
  recordingSurface,
} from "./compositorTestFixtures";
import { rasterizeBackdropScene } from "./sceneRasterizer";
import { buildSharedAcrylicCache } from "./sharedAcrylicCacheBuilder";
import { sharedAcrylicFilter, SHARED_ACRYLIC_RUNTIME_PROFILE } from "./sharedAcrylicProfile";

describe("generic backdrop scene rasterizer", () => {
  it("clears, fills, transforms, clips, grids, draws primitives, and restores in order", () => {
    const descriptor = createTestDescriptor(1);
    const surface = recordingSurface(
      descriptor.anchor.cacheBackingSize.width,
      descriptor.anchor.cacheBackingSize.height,
    );
    rasterizeBackdropScene(surface, descriptor, createTestScene());
    const names = surface.context.operations.map((operation) => operation[0]);
    expect(names.slice(0, 5)).toEqual([
      "setTransform",
      "clearRect",
      "fillStyle",
      "fillRect",
      "save",
    ]);
    expect(names.indexOf("clip")).toBeLessThan(names.indexOf("arc"));
    expect(names[names.length - 1]).toBe("restore");
  });

  it("establishes cache margin and non-1 anchor zoom in one canonical world transform", () => {
    const descriptor = createTestDescriptor(1, { panX: 70, panY: -35, zoom: 1.75 });
    const surface = recordingSurface(
      descriptor.anchor.cacheBackingSize.width,
      descriptor.anchor.cacheBackingSize.height,
    );
    rasterizeBackdropScene(surface, descriptor, createTestScene());
    const scale = descriptor.anchor.cacheScale;
    expect(surface.context.operations[5]).toEqual([
      "setTransform",
      scale * descriptor.anchor.viewport.zoom,
      0,
      0,
      scale * descriptor.anchor.viewport.zoom,
      scale * (descriptor.anchor.marginCssPx + 70),
      scale * (descriptor.anchor.marginCssPx - 35),
    ]);
  });

  it("uses deterministic quadratic rounded-rectangle paths", () => {
    const descriptor = createTestDescriptor(1);
    const surface = recordingSurface(
      descriptor.anchor.cacheBackingSize.width,
      descriptor.anchor.cacheBackingSize.height,
    );
    rasterizeBackdropScene(surface, descriptor, createTestScene({ grid: null }));
    const curves = surface.context.operations.filter(
      (operation) => operation[0] === "quadraticCurveTo",
    );
    expect(curves).toHaveLength(12);
  });

  it("renders line grid minor and major passes", () => {
    const descriptor = createTestDescriptor(1);
    const surface = recordingSurface(
      descriptor.anchor.cacheBackingSize.width,
      descriptor.anchor.cacheBackingSize.height,
    );
    rasterizeBackdropScene(surface, descriptor, createTestScene({ grid: "lines" }));
    expect(surface.context.operations).toContainEqual(["strokeStyle", "#222"]);
    expect(surface.context.operations).toContainEqual(["strokeStyle", "#444"]);
  });

  it("bounds an ordinary grid by the cache intersection, not a very large logical world", () => {
    const descriptor = createTestDescriptor(1);
    const base = createTestScene();
    const scene = parseBackdropScene({
      ...base,
      worldBounds: {
        x: -500_000_000,
        y: -500_000_000,
        width: 1_000_000_000,
        height: 1_000_000_000,
      },
      grid: { ...base.grid, spacingWorld: 24 },
    });
    const surface = recordingSurface(
      descriptor.anchor.cacheBackingSize.width,
      descriptor.anchor.cacheBackingSize.height,
    );
    rasterizeBackdropScene(surface, descriptor, scene);
    const dots = surface.context.operations.filter((operation) => operation[0] === "arc");
    expect(dots).toHaveLength(2_214);
    expect(dots.length).toBeLessThan(MAX_BACKDROP_GRID_MARKS);
  });

  it("rejects excessive dot work in the actual cache region before iterating dots", () => {
    const descriptor = createTestDescriptor(1);
    const base = createTestScene();
    const scene = parseBackdropScene({
      ...base,
      grid: { ...base.grid, spacingWorld: 4 },
    });
    const surface = recordingSurface(
      descriptor.anchor.cacheBackingSize.width,
      descriptor.anchor.cacheBackingSize.height,
    );
    expect(() => rasterizeBackdropScene(surface, descriptor, scene)).toThrow(
      `exceeds ${MAX_BACKDROP_GRID_MARKS} marks`,
    );
    expect(surface.context.operations.some((operation) => operation[0] === "arc")).toBe(false);
  });

  it("rejects excessive line work in the actual cache region before iterating lines", () => {
    const descriptor = createTestDescriptor(1);
    const base = createTestScene({ grid: "lines" });
    const scene = parseBackdropScene({
      ...base,
      grid: { ...base.grid, spacingWorld: 0.04 },
    });
    const surface = recordingSurface(
      descriptor.anchor.cacheBackingSize.width,
      descriptor.anchor.cacheBackingSize.height,
    );
    expect(() => rasterizeBackdropScene(surface, descriptor, scene)).toThrow(
      `exceeds ${MAX_BACKDROP_GRID_MARKS} marks`,
    );
    expect(surface.context.operations.some((operation) => operation[0] === "lineWidth")).toBe(
      false,
    );
  });

  it("culls primitives outside the cache world rectangle", () => {
    const descriptor = createTestDescriptor(1);
    const scene = createTestScene({ grid: null });
    const surface = recordingSurface(
      descriptor.anchor.cacheBackingSize.width,
      descriptor.anchor.cacheBackingSize.height,
    );
    rasterizeBackdropScene(surface, descriptor, {
      ...scene,
      primitives: [
        {
          ...scene.primitives[0],
          bounds: { x: 1_000_000, y: 1_000_000, width: 10, height: 10 },
        },
      ],
    });
    expect(surface.context.operations).not.toContainEqual(["fillStyle", "#334455"]);
  });

  it("rejects mismatched scene identity or backing dimensions", () => {
    const descriptor = createTestDescriptor(1);
    const valid = recordingSurface(
      descriptor.anchor.cacheBackingSize.width,
      descriptor.anchor.cacheBackingSize.height,
    );
    expect(() =>
      rasterizeBackdropScene(valid, descriptor, createTestScene({ revision: 2 })),
    ).toThrow("identity");
    expect(() =>
      rasterizeBackdropScene(
        recordingSurface(valid.width + 1, valid.height),
        descriptor,
        createTestScene(),
      ),
    ).toThrow("backing dimensions");
  });
});

describe("one shared acrylic cache pass", () => {
  it("locks the exact shared 45px, saturation-1, brightness-1 profile", () => {
    expect(SHARED_ACRYLIC_RUNTIME_PROFILE).toEqual({
      id: "shared-acrylic",
      revision: 1,
      blurRadiusCssPx: 45,
      saturation: 1,
      brightness: 1,
    });
    expect(LEGACY_ACRYLIC_LARGE.cacheProfileId).toBe(SHARED_ACRYLIC_RUNTIME_PROFILE.id);
    expect(LEGACY_ACRYLIC_SMALL.cacheProfileId).toBe(SHARED_ACRYLIC_RUNTIME_PROFILE.id);
  });

  it("converts logical CSS blur to reduced backing scale without tuning it", () => {
    expect(sharedAcrylicFilter(0.5)).toEqual({
      logicalBlurRadiusCssPx: 45,
      backingBlurRadiusPx: 22.5,
      saturation: 1,
      brightness: 1,
      canvasFilter: "blur(22.5px) saturate(1) brightness(1)",
    });
    expect(sharedAcrylicFilter(0.16).backingBlurRadiusPx).toBeCloseTo(7.2);
  });

  it("shares one rasterizer between source rendering and the filtered bitmap backend", async () => {
    const descriptor = createTestDescriptor(1);
    const surfaces: ReturnType<typeof recordingSurface>[] = [];
    const bitmap = new FakeBitmap(
      descriptor.anchor.cacheBackingSize.width,
      descriptor.anchor.cacheBackingSize.height,
    );
    const result = await buildSharedAcrylicCache(descriptor, createTestScene(), {
      canvases: {
        create(width, height) {
          const surface = recordingSurface(width, height);
          surfaces.push(surface);
          return surface;
        },
      },
      bitmaps: { create: () => bitmap },
    });
    expect(result).toBe(bitmap);
    expect(surfaces).toHaveLength(2);
    expect(surfaces[0].context.operations.some((operation) => operation[0] === "arc")).toBe(true);
    expect(surfaces[1].context.operations).toContainEqual([
      "filter",
      sharedAcrylicFilter(descriptor.anchor.cacheScale).canvasFilter,
    ]);
    const filteredOperations = surfaces[1].context.operations;
    expect(filteredOperations[filteredOperations.length - 1]).toEqual(["filter", "none"]);
  });

  it("closes and rejects a bitmap with unexpected dimensions", async () => {
    const descriptor = createTestDescriptor(1);
    const bitmap = new FakeBitmap(1, 1);
    await expect(
      buildSharedAcrylicCache(descriptor, createTestScene(), {
        canvases: { create: (width, height) => recordingSurface(width, height) },
        bitmaps: { create: () => bitmap },
      }),
    ).rejects.toThrow("dimensions");
    expect(bitmap.closes).toBe(1);
  });

  it("has no separate Small blur profile", () => {
    expect(SHARED_ACRYLIC_RUNTIME_PROFILE.blurRadiusCssPx).not.toBe(32);
    expect(LEGACY_ACRYLIC_SMALL).not.toHaveProperty("blurRadiusPx");
  });
});
