// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CANVAS_BROWSER_DIAGNOSTIC_MODES,
  canvasBrowserNeedsContinuousFrames,
  DEFAULT_CANVAS_BROWSER_DIAGNOSTIC_MODE,
} from "./canvasBrowserDiagnostics";

describe("Canvas Browser render scheduling diagnostics", () => {
  it("exposes only the retained diagnostic modes", () => {
    expect(CANVAS_BROWSER_DIAGNOSTIC_MODES).toEqual([
      "full",
      "no-card-html",
      "no-card-glass-or-html",
      "render-on-demand",
    ]);
  });

  it("promotes render-on-demand to the prototype default", () => {
    expect(DEFAULT_CANVAS_BROWSER_DIAGNOSTIC_MODE).toBe("render-on-demand");
    expect(
      canvasBrowserNeedsContinuousFrames(DEFAULT_CANVAS_BROWSER_DIAGNOSTIC_MODE, false, false),
    ).toBe(false);
  });

  it("keeps frames alive for animations and explicit metric samples", () => {
    expect(canvasBrowserNeedsContinuousFrames("render-on-demand", true, false)).toBe(true);
    expect(canvasBrowserNeedsContinuousFrames("render-on-demand", false, true)).toBe(true);
    expect(canvasBrowserNeedsContinuousFrames("render-on-demand", false, false)).toBe(false);
  });

  it("retains FULL as the continuous-render comparison", () => {
    expect(canvasBrowserNeedsContinuousFrames("full", false, false)).toBe(true);
  });
});
