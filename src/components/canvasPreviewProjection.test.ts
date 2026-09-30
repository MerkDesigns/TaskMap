import { describe, expect, it } from "vitest";
import {
  canvasPreviewProjection,
  presentCanvasPreview,
  PREVIEW_HEADER_ATTRIBUTE,
  PREVIEW_WORLD_ATTRIBUTE,
} from "./canvasPreviewProjection";

describe("canvas preview projection", () => {
  it("maps the live camera into card preview coordinates", () => {
    // 100 px preview of a 1000 px viewport at zoom 2 panned by (-200, -100).
    const projection = canvasPreviewProjection({ pan: { x: -200, y: -100 }, zoom: 2 }, 100, 1000);
    expect(projection).toEqual({ left: 100, top: 50, scale: 0.2 });
    expect(canvasPreviewProjection({ pan: { x: 0, y: 0 }, zoom: 0 }, 100, 1000).scale).toBe(0.1);
  });

  it("presents pan/zoom frames by writing item geometry without rerendering", () => {
    const preview = document.createElement("div");
    const item = document.createElement("div");
    item.setAttribute(PREVIEW_WORLD_ATTRIBUTE, "150 100 50 5");
    const header = document.createElement("div");
    header.setAttribute(PREVIEW_HEADER_ATTRIBUTE, "48");
    item.append(header);
    preview.append(item);

    presentCanvasPreview(preview, { left: 100, top: 50, scale: 0.2 });
    expect(item.style.left).toBe("10px");
    expect(item.style.top).toBe("10px");
    expect(item.style.width).toBe("10px");
    // Tiny items keep a visible minimum size.
    expect(item.style.height).toBe("3px");
    expect(Number.parseFloat(header.style.height)).toBeCloseTo(9.6, 6);
  });
});
