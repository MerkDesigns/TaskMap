export interface LiquidFrameWakeSnapshot {
  readonly invalidationTotal: number;
  readonly coalescedInvalidationTotal: number;
  readonly captureCompletionWakeupTotal: number;
  readonly captureOnlyFrameTotal: number;
  readonly multiCaptureCompletionFrameTotal: number;
  readonly filteredTransformPaintTotal: number;
  readonly invalidationsPerSecond: number;
  readonly coalescedInvalidationsPerSecond: number;
  readonly captureCompletionWakeupsPerSecond: number;
  readonly captureOnlyFramesPerSecond: number;
  readonly filteredTransformPaintsPerSecond: number;
}

const empty = () => ({
  invalidations: 0,
  coalesced: 0,
  captureWakeups: 0,
  captureOnlyFrames: 0,
  multiCaptureFrames: 0,
  filteredPaints: 0,
});

export class LiquidFrameWakeMetrics {
  private totals = empty();
  private rates = empty();
  private sample = { at: performance.now(), totals: empty() };
  private pendingCaptureCompletions = 0;
  private captureScheduledFrame = false;
  private pendingNonCaptureInvalidation = false;

  recordInvalidation(reason: "capture-completion" | "mutation", scheduled: boolean | null) {
    this.totals.invalidations += 1;
    if (scheduled === false) this.totals.coalesced += 1;
    if (reason === "capture-completion") {
      this.totals.captureWakeups += 1;
      this.pendingCaptureCompletions += 1;
      if (scheduled === true) this.captureScheduledFrame = true;
    } else {
      this.pendingNonCaptureInvalidation = true;
    }
  }

  recordFilteredTransformPaint() {
    this.totals.filteredPaints += 1;
  }

  beginFrame() {
    if (this.pendingCaptureCompletions > 1) this.totals.multiCaptureFrames += 1;
    if (this.captureScheduledFrame && !this.pendingNonCaptureInvalidation) {
      this.totals.captureOnlyFrames += 1;
    }
    this.pendingCaptureCompletions = 0;
    this.captureScheduledFrame = false;
    this.pendingNonCaptureInvalidation = false;
  }

  snapshot(now = performance.now()): LiquidFrameWakeSnapshot {
    const elapsed = now - this.sample.at;
    if (elapsed >= 100) {
      const scale = 1_000 / elapsed;
      for (const key of Object.keys(this.totals) as (keyof ReturnType<typeof empty>)[]) {
        this.rates[key] = (this.totals[key] - this.sample.totals[key]) * scale;
      }
      this.sample = { at: now, totals: { ...this.totals } };
    }
    return {
      invalidationTotal: this.totals.invalidations,
      coalescedInvalidationTotal: this.totals.coalesced,
      captureCompletionWakeupTotal: this.totals.captureWakeups,
      captureOnlyFrameTotal: this.totals.captureOnlyFrames,
      multiCaptureCompletionFrameTotal: this.totals.multiCaptureFrames,
      filteredTransformPaintTotal: this.totals.filteredPaints,
      invalidationsPerSecond: this.rates.invalidations,
      coalescedInvalidationsPerSecond: this.rates.coalesced,
      captureCompletionWakeupsPerSecond: this.rates.captureWakeups,
      captureOnlyFramesPerSecond: this.rates.captureOnlyFrames,
      filteredTransformPaintsPerSecond: this.rates.filteredPaints,
    };
  }

  reset(now = performance.now()) {
    this.totals = empty();
    this.rates = empty();
    this.sample = { at: now, totals: empty() };
    this.pendingCaptureCompletions = 0;
    this.captureScheduledFrame = false;
    this.pendingNonCaptureInvalidation = false;
  }
}
