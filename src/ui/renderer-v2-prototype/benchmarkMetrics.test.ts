// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { BenchmarkMetricsSampler, calculateFrameStatistics } from "./benchmarkMetrics";

describe("renderer benchmark metrics", () => {
  it("calculates frame percentiles and missed 120/60 Hz frame budgets", () => {
    const statistics = calculateFrameStatistics([10, 20, 30, 40, 100]);
    expect(statistics).toMatchObject({
      fps: 10,
      averageFps: 25,
      frameTime: 100,
      averageFrameTime: 40,
      p95FrameTime: 100,
      p99FrameTime: 100,
      worstFrameTime: 100,
      framesOver8Point33Ms: 5,
      framesOver16Point67Ms: 4,
      samples: 5,
    });
  });

  it("freezes a ten-second result with capture and scene context", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);
    const sampler = new BenchmarkMetricsSampler();
    sampler.startTimedSample({ textCards: 2, containers: 1, canvasCards: 5, elements: 3 }, true, 0);
    sampler.recordCapture(100, 50);
    for (let now = 16; now < 10_000; now += 16) sampler.recordFrame(now);
    sampler.recordFrame(10_000);

    const result = sampler.snapshot(true, 10_000).timedResult;
    expect(result).toMatchObject({
      captureCalls: 1,
      copiedTexels: 5000,
      counts: { elements: 3, canvasCards: 5 },
    });
    expect(result?.samples).toBeGreaterThan(600);
  });

  it("reports capture metrics as unavailable when safe instrumentation is absent", () => {
    const sampler = new BenchmarkMetricsSampler();
    sampler.startTimedSample(
      { textCards: 0, containers: 0, canvasCards: 1, elements: 0 },
      false,
      0,
    );
    sampler.recordFrame(10_000);
    expect(sampler.snapshot(false, 10_000).timedResult).toMatchObject({
      captureCalls: null,
      copiedTexels: null,
    });
  });
});
