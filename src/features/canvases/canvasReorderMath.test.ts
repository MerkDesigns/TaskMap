import { describe, expect, it } from "vitest";
import { reorderAtPointerMidpoint } from "./canvasReorderMath";

const rows = [
  { id: "a", top: 0, height: 80 },
  { id: "b", top: 90, height: 80 },
  { id: "c", top: 180, height: 80 },
] as const;

describe("reorderAtPointerMidpoint", () => {
  it("moves down only after crossing the next midpoint", () => {
    expect(reorderAtPointerMidpoint(["a", "b", "c"], rows, "a", 120, 100)).toEqual(["a", "b", "c"]);
    expect(reorderAtPointerMidpoint(["a", "b", "c"], rows, "a", 140, 120)).toEqual(["b", "a", "c"]);
  });

  it("uses the previous pointer position to select the upward neighbor", () => {
    expect(reorderAtPointerMidpoint(["a", "b", "c"], rows, "c", 120, 170)).toEqual(["a", "c", "b"]);
  });
});
