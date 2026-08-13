import type { BenchmarkSceneCounts } from "./benchmarkTypes";

const ROLLING_FRAME_LIMIT = 600;

export interface FrameStatistics {
  fps: number;
  averageFps: number;
  frameTime: number;
  averageFrameTime: number;
  p95FrameTime: number;
  worstFrameTime: number;
  samples: number;
}

export interface TimedBenchmarkResult extends FrameStatistics {
  counts: BenchmarkSceneCounts;
  captureCalls: number | null;
  copiedTexels: number | null;
}

export function calculateFrameStatistics(samples: readonly number[]): FrameStatistics {
  if (samples.length === 0) {
    return {
      fps: 0,
      averageFps: 0,
      frameTime: 0,
      averageFrameTime: 0,
      p95FrameTime: 0,
      worstFrameTime: 0,
      samples: 0,
    };
  }
  const latest = samples[samples.length - 1] ?? 0;
  const total = samples.reduce((sum, value) => sum + value, 0);
  const average = total / samples.length;
  const sorted = [...samples].sort((left, right) => left - right);
  const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
  return {
    fps: latest > 0 ? 1000 / latest : 0,
    averageFps: average > 0 ? 1000 / average : 0,
    frameTime: latest,
    averageFrameTime: average,
    p95FrameTime: p95,
    worstFrameTime: sorted[sorted.length - 1] ?? 0,
    samples: samples.length,
  };
}

export class BenchmarkMetricsSampler {
  private frames: number[] = [];
  private lastFrame: number | null = null;
  private captureCalls = 0;
  private captureTexels = 0;
  private intervalCalls = 0;
  private intervalTexels = 0;
  private intervalStarted = performance.now();
  private timedStart: number | null = null;
  private timedFrames: number[] = [];
  private timedCaptureStart = { calls: 0, texels: 0 };
  private timedCaptureAvailable = false;
  private timedContext: {
    counts: BenchmarkSceneCounts;
  } | null = null;
  timedResult: TimedBenchmarkResult | null = null;

  recordFrame(now: number) {
    if (this.lastFrame !== null) {
      const duration = now - this.lastFrame;
      this.frames.push(duration);
      if (this.frames.length > ROLLING_FRAME_LIMIT) this.frames.shift();
      if (this.timedStart !== null) this.timedFrames.push(duration);
    }
    this.lastFrame = now;
    if (this.timedStart !== null && now - this.timedStart >= 10_000) this.finishTimedSample();
  }

  recordCapture(width: number | null, height: number | null) {
    const texels = width !== null && height !== null ? width * height : 0;
    this.captureCalls += 1;
    this.captureTexels += texels;
    this.intervalCalls += 1;
    this.intervalTexels += texels;
  }

  reset(now = performance.now()) {
    this.frames = [];
    this.lastFrame = null;
    this.captureCalls = 0;
    this.captureTexels = 0;
    this.intervalCalls = 0;
    this.intervalTexels = 0;
    this.intervalStarted = now;
    this.timedStart = null;
    this.timedFrames = [];
    this.timedContext = null;
    this.timedResult = null;
  }

  startTimedSample(
    counts: BenchmarkSceneCounts,
    captureAvailable: boolean,
    now = performance.now(),
  ) {
    this.timedStart = now;
    this.timedFrames = [];
    this.timedCaptureStart = { calls: this.captureCalls, texels: this.captureTexels };
    this.timedContext = { counts };
    this.timedCaptureAvailable = captureAvailable;
    this.timedResult = null;
    this.lastFrame = now;
  }

  snapshot(captureAvailable: boolean, now = performance.now()) {
    const elapsed = Math.max(1, now - this.intervalStarted);
    const snapshot = {
      frames: calculateFrameStatistics(this.frames),
      captureCalls: captureAvailable ? this.captureCalls : null,
      copiedTexels: captureAvailable ? this.captureTexels : null,
      recentCaptureCalls: captureAvailable ? this.intervalCalls : null,
      recentCopiedTexels: captureAvailable ? this.intervalTexels : null,
      captureCallsPerSecond: captureAvailable ? (this.intervalCalls * 1000) / elapsed : null,
      timedRunning: this.timedStart !== null,
      timedResult: this.timedResult,
    };
    this.intervalCalls = 0;
    this.intervalTexels = 0;
    this.intervalStarted = now;
    return snapshot;
  }

  private finishTimedSample() {
    const context = this.timedContext;
    if (!context) return;
    this.timedResult = {
      ...calculateFrameStatistics(this.timedFrames),
      counts: context.counts,
      captureCalls: this.timedCaptureAvailable
        ? this.captureCalls - this.timedCaptureStart.calls
        : null,
      copiedTexels: this.timedCaptureAvailable
        ? this.captureTexels - this.timedCaptureStart.texels
        : null,
    };
    this.timedStart = null;
    this.timedContext = null;
  }
}
