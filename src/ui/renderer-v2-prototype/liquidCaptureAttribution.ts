export const LIQUID_CAPTURE_OWNERS = ["card", "browser", "coarse", "other"] as const;
export type LiquidCaptureOwner = (typeof LIQUID_CAPTURE_OWNERS)[number];

export interface LiquidCaptureAttributionSnapshot {
  readonly cardCaptureTotal: number;
  readonly browserCaptureTotal: number;
  readonly coarseCaptureTotal: number;
  readonly unknownCaptureTotal: number;
  readonly cardCapturesPerSecond: number;
  readonly browserCapturesPerSecond: number;
  readonly coarseCapturesPerSecond: number;
  readonly unknownCapturesPerSecond: number;
}

const emptyCounts = () => ({ card: 0, browser: 0, coarse: 0, other: 0 });

export class LiquidCaptureAttribution {
  private totals = emptyCounts();
  private sample = { at: performance.now(), counts: emptyCounts() };
  private rates = emptyCounts();

  record(owner: LiquidCaptureOwner) {
    this.totals[owner] += 1;
  }

  snapshot(now = performance.now()): LiquidCaptureAttributionSnapshot {
    const elapsed = now - this.sample.at;
    if (elapsed >= 100) {
      const scale = 1_000 / elapsed;
      for (const owner of LIQUID_CAPTURE_OWNERS) {
        this.rates[owner] = (this.totals[owner] - this.sample.counts[owner]) * scale;
      }
      this.sample = { at: now, counts: { ...this.totals } };
    }
    return {
      cardCaptureTotal: this.totals.card,
      browserCaptureTotal: this.totals.browser,
      coarseCaptureTotal: this.totals.coarse,
      unknownCaptureTotal: this.totals.other,
      cardCapturesPerSecond: this.rates.card,
      browserCapturesPerSecond: this.rates.browser,
      coarseCapturesPerSecond: this.rates.coarse,
      unknownCapturesPerSecond: this.rates.other,
    };
  }

  reset(now = performance.now()) {
    this.totals = emptyCounts();
    this.rates = emptyCounts();
    this.sample = { at: now, counts: emptyCounts() };
  }
}
