import { describe, expect, it } from "vitest";
import {
  getMindmapConnectionPath,
  getMindmapConnectionPreviewPath,
  getMindmapPortPoint,
} from "./mindmapMath";

describe("mindmap geometry", () => {
  it("anchors ports to card edges and creates a cubic path", () => {
    const card = { x: 100, y: 200, width: 160, height: 80 };
    expect(getMindmapPortPoint(card, "left")).toEqual({ x: 100, y: 240 });
    expect(getMindmapPortPoint(card, "right")).toEqual({ x: 260, y: 240 });
    expect(getMindmapPortPoint(card, "top")).toEqual({ x: 180, y: 200 });
    expect(getMindmapPortPoint(card, "bottom")).toEqual({ x: 180, y: 280 });

    expect(
      getMindmapConnectionPath({ x: 260, y: 240 }, "right", { x: 500, y: 300 }, "left"),
    ).toMatch(/^M 260 240 C .+, .+, 500 300$/);
  });

  it("keeps close opposing ports from overshooting into an S curve", () => {
    const path = getMindmapConnectionPath({ x: 0, y: 0 }, "right", { x: 20, y: 10 }, "left");
    const values = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];

    expect(values).toHaveLength(8);
    expect(values[2]).toBeGreaterThan(0);
    expect(values[2]).toBeLessThan(10);
    expect(values[4]).toBeGreaterThan(10);
    expect(values[4]).toBeLessThan(20);
  });

  it("does not bend the live preview past the pointer", () => {
    const leftPreview = getMindmapConnectionPreviewPath({ x: 0, y: 0 }, "left", { x: -100, y: 0 });
    const topPreview = getMindmapConnectionPreviewPath({ x: 0, y: 0 }, "top", { x: 0, y: -100 });

    expect(leftPreview).not.toContain("-136 0");
    expect(topPreview).not.toContain("0 -136");
    expect(leftPreview).toMatch(/, -100 0$/);
    expect(topPreview).toMatch(/, 0 -100$/);
  });
});
