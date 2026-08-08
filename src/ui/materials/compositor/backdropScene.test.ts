// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MAX_BACKDROP_COORDINATE_ABS, MAX_BACKDROP_PRIMITIVES } from "./backdropScene";
import { parseBackdropScene } from "./backdropSceneValidation";
import { createTestScene } from "./compositorTestFixtures";

describe("BackdropScene worker payload", () => {
  it("parses generic presentation data into a deeply frozen snapshot", () => {
    const scene = createTestScene();
    expect(Object.isFrozen(scene)).toBe(true);
    expect(Object.isFrozen(scene.identity)).toBe(true);
    expect(Object.isFrozen(scene.worldBounds)).toBe(true);
    expect(Object.isFrozen(scene.background)).toBe(true);
    expect(Object.isFrozen(scene.grid)).toBe(true);
    expect(Object.isFrozen(scene.primitives)).toBe(true);
    expect(Object.isFrozen(scene.primitives[0])).toBe(true);
  });

  it("has a structured-clone-safe plain-data shape", () => {
    const scene = createTestScene({ grid: "lines" });
    expect(structuredClone(scene)).toEqual(scene);
    expect(scene).not.toHaveProperty("document");
    expect(scene).not.toHaveProperty("media");
  });

  it("exposes only generic primitive and grid discriminants", () => {
    const scene = createTestScene();
    expect(scene.primitives.map((primitive) => primitive.kind)).toEqual([
      "filled-rectangle",
      "filled-rounded-rectangle",
    ]);
    expect(scene.grid?.kind).toBe("dots");
  });

  it.each(["text-card", "container", "image", "gif", "mind-map"])(
    "rejects the element-specific discriminant %s",
    (kind) => {
      const scene = createTestScene();
      expect(() =>
        parseBackdropScene({
          ...scene,
          primitives: [{ ...scene.primitives[0], kind }],
        }),
      ).toThrow("not a supported generic primitive");
    },
  );

  it("bounds primitive payload count", () => {
    const scene = createTestScene();
    const primitive = scene.primitives[0];
    expect(() =>
      parseBackdropScene({
        ...scene,
        primitives: Array.from({ length: MAX_BACKDROP_PRIMITIVES + 1 }, () => primitive),
      }),
    ).toThrow(`exceeds ${MAX_BACKDROP_PRIMITIVES}`);
  });

  it("bounds transform coordinates and dimensions", () => {
    const scene = createTestScene();
    expect(() =>
      parseBackdropScene({
        ...scene,
        worldBounds: { ...scene.worldBounds, x: MAX_BACKDROP_COORDINATE_ABS + 1 },
      }),
    ).toThrow("coordinate bound");
    expect(() =>
      parseBackdropScene({
        ...scene,
        primitives: [
          { ...scene.primitives[0], bounds: { x: 0, y: 0, width: Number.NaN, height: 1 } },
        ],
      }),
    ).toThrow("must be finite");
  });

  it("accepts a bounded grid definition over a very large logical world", () => {
    const scene = createTestScene();
    const parsed = parseBackdropScene({
      ...scene,
      worldBounds: {
        x: -500_000_000,
        y: -500_000_000,
        width: 1_000_000_000,
        height: 1_000_000_000,
      },
      grid: { ...scene.grid, spacingWorld: 24 },
    });
    expect(parsed.grid?.spacingWorld).toBe(24);
  });

  it("rejects invalid scene identity, colors, and geometry", () => {
    const scene = createTestScene();
    expect(() => parseBackdropScene({ ...scene, identity: { key: "", revision: 1 } })).toThrow();
    expect(() =>
      parseBackdropScene({
        ...scene,
        background: { ...scene.background, cacheFill: "" },
      }),
    ).toThrow();
    expect(() =>
      parseBackdropScene({
        ...scene,
        primitives: [{ ...scene.primitives[0], bounds: { x: 0, y: 0, width: 0, height: 1 } }],
      }),
    ).toThrow();
  });
});
