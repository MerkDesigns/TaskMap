import { describe, expect, it } from "vitest";
import { createCanvasCameraSession } from "./canvasCameraSession";

describe("canvasCameraSession", () => {
  it("keeps independent transient camera values per canvas", () => {
    const session = createCanvasCameraSession();
    session.set("canvas-a", { pan: { x: 12, y: -4 }, zoom: 1.4 });
    session.set("canvas-b", { pan: { x: -9, y: 31 }, zoom: 0.8 });

    expect(session.get("canvas-a")).toEqual({ pan: { x: 12, y: -4 }, zoom: 1.4 });
    expect(session.get("canvas-b")).toEqual({ pan: { x: -9, y: 31 }, zoom: 0.8 });

    session.delete("canvas-a");
    expect(session.get("canvas-a")).toBeUndefined();

    session.retain(new Set());
    expect(session.get("canvas-b")).toBeUndefined();
  });
});
