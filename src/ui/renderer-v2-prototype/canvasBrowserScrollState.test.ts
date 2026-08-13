// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CanvasBrowserScrollState } from "./canvasBrowserScrollState";

describe("Canvas Browser authoritative scroll state", () => {
  it("coalesces arbitrary pixel deltas without quantizing them", () => {
    const scroll = new CanvasBrowserScrollState();
    scroll.setRange(798, 1_844);
    scroll.requestDelta(2.25);
    scroll.requestDelta(1.5);

    expect(scroll.flush(798, 1_844)).toMatchObject({
      currentScrollY: 3.75,
      appliedDeltaY: 3.75,
      changed: true,
    });
    expect(scroll.snapshot()).toEqual({
      currentScrollY: 3.75,
      pendingDeltaY: 0,
      maximumScrollY: 1_046,
    });
  });

  it("clamps at both bounds and clears pending work when requested", () => {
    const scroll = new CanvasBrowserScrollState();
    scroll.setRange(798, 1_844);
    scroll.requestDelta(2_000);
    expect(scroll.flush(798, 1_844).currentScrollY).toBe(1_046);
    scroll.requestDelta(-2_000);
    expect(scroll.flush(798, 1_844).currentScrollY).toBe(0);
    scroll.requestDelta(40);
    scroll.clearPending();
    expect(scroll.flush(798, 1_844).currentScrollY).toBe(0);
  });
});
