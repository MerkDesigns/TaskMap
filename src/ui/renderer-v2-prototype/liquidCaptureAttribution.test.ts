// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { LiquidCaptureAttribution } from "./liquidCaptureAttribution";

describe("Liquid capture attribution", () => {
  it("reports cumulative and per-second captures by Html owner", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);
    const attribution = new LiquidCaptureAttribution();
    attribution.record("card");
    attribution.record("card");
    attribution.record("browser");
    attribution.record("coarse");
    attribution.record("other");

    expect(attribution.snapshot(1_000)).toEqual({
      cardCaptureTotal: 2,
      browserCaptureTotal: 1,
      coarseCaptureTotal: 1,
      unknownCaptureTotal: 1,
      cardCapturesPerSecond: 2,
      browserCapturesPerSecond: 1,
      coarseCapturesPerSecond: 1,
      unknownCapturesPerSecond: 1,
    });
  });
});
