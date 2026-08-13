// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { PrototypeFrameSchedulerMetrics } from "./prototypeFrameSchedulerMetrics";

describe("prototype frame scheduler metrics", () => {
  it("coalesces repeated requests while one RAF is pending", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);
    const metrics = new PrototypeFrameSchedulerMetrics();

    expect(metrics.recordRequest(false)).toBe(true);
    expect(metrics.recordRequest(true)).toBe(false);
    expect(metrics.recordRequest(true)).toBe(false);
    expect(metrics.snapshot(1_000)).toMatchObject({
      rafRequestTotal: 1,
      coalescedRafRequestTotal: 2,
      rafRequestsPerSecond: 1,
      coalescedRafRequestsPerSecond: 2,
    });
  });
});
