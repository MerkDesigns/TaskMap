export interface PrototypeFrameSchedulerSnapshot {
  readonly rafRequestTotal: number;
  readonly coalescedRafRequestTotal: number;
  readonly rafRequestsPerSecond: number;
  readonly coalescedRafRequestsPerSecond: number;
}

export class PrototypeFrameSchedulerMetrics {
  private scheduled = 0;
  private coalesced = 0;
  private sample = { at: performance.now(), scheduled: 0, coalesced: 0 };
  private rates = { scheduled: 0, coalesced: 0 };

  recordRequest(framePending: boolean) {
    if (framePending) this.coalesced += 1;
    else this.scheduled += 1;
    return !framePending;
  }

  snapshot(now = performance.now()): PrototypeFrameSchedulerSnapshot {
    const elapsed = now - this.sample.at;
    if (elapsed >= 100) {
      const scale = 1_000 / elapsed;
      this.rates = {
        scheduled: (this.scheduled - this.sample.scheduled) * scale,
        coalesced: (this.coalesced - this.sample.coalesced) * scale,
      };
      this.sample = { at: now, scheduled: this.scheduled, coalesced: this.coalesced };
    }
    return {
      rafRequestTotal: this.scheduled,
      coalescedRafRequestTotal: this.coalesced,
      rafRequestsPerSecond: this.rates.scheduled,
      coalescedRafRequestsPerSecond: this.rates.coalesced,
    };
  }

  reset(now = performance.now()) {
    this.scheduled = 0;
    this.coalesced = 0;
    this.rates = { scheduled: 0, coalesced: 0 };
    this.sample = { at: now, scheduled: 0, coalesced: 0 };
  }
}
