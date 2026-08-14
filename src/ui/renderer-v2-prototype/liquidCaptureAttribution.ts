export const LIQUID_CAPTURE_OWNERS = ["card", "browser", "coarse", "dynamic", "other"] as const;
export type LiquidCaptureOwner = (typeof LIQUID_CAPTURE_OWNERS)[number];

export interface LiquidCaptureAttributionSnapshot {
  readonly cardCaptureTotal: number;
  readonly browserCaptureTotal: number;
  readonly coarseCaptureTotal: number;
  readonly dynamicCaptureTotal: number;
  readonly unknownCaptureTotal: number;
  readonly cardCapturesPerSecond: number;
  readonly browserCapturesPerSecond: number;
  readonly coarseCapturesPerSecond: number;
  readonly dynamicCapturesPerSecond: number;
  readonly unknownCapturesPerSecond: number;
  readonly coarseCopiedTexelsPerSecond: number;
  readonly dynamicCopiedTexelsPerSecond: number;
  readonly positionOnlyPromotedCapturesPerSecond: number;
  readonly totalCopiedTexelsPerSecond: number;
}

const emptyCounts = () => ({ card: 0, browser: 0, coarse: 0, dynamic: 0, other: 0 });

export class LiquidCaptureAttribution {
  private totals = emptyCounts();
  private sample = { at: performance.now(), counts: emptyCounts() };
  private rates = emptyCounts();
  private texels = emptyCounts();
  private texelSample = { counts: emptyCounts(), positionOnly: 0 };
  private texelRates = emptyCounts();
  private positionOnly = 0;
  private positionOnlyRate = 0;

  record(
    owner: LiquidCaptureOwner,
    width: number | null = null,
    height: number | null = null,
    positionOnly = false,
  ) {
    this.totals[owner] += 1;
    this.texels[owner] += width !== null && height !== null ? width * height : 0;
    if (positionOnly) this.positionOnly += 1;
  }

  snapshot(now = performance.now()): LiquidCaptureAttributionSnapshot {
    const elapsed = now - this.sample.at;
    if (elapsed >= 100) {
      const scale = 1_000 / elapsed;
      for (const owner of LIQUID_CAPTURE_OWNERS) {
        this.rates[owner] = (this.totals[owner] - this.sample.counts[owner]) * scale;
        this.texelRates[owner] = (this.texels[owner] - this.texelSample.counts[owner]) * scale;
      }
      this.positionOnlyRate = (this.positionOnly - this.texelSample.positionOnly) * scale;
      this.sample = { at: now, counts: { ...this.totals } };
      this.texelSample = { counts: { ...this.texels }, positionOnly: this.positionOnly };
    }
    return {
      cardCaptureTotal: this.totals.card,
      browserCaptureTotal: this.totals.browser,
      coarseCaptureTotal: this.totals.coarse,
      dynamicCaptureTotal: this.totals.dynamic,
      unknownCaptureTotal: this.totals.other,
      cardCapturesPerSecond: this.rates.card,
      browserCapturesPerSecond: this.rates.browser,
      coarseCapturesPerSecond: this.rates.coarse,
      dynamicCapturesPerSecond: this.rates.dynamic,
      unknownCapturesPerSecond: this.rates.other,
      coarseCopiedTexelsPerSecond: this.texelRates.coarse,
      dynamicCopiedTexelsPerSecond: this.texelRates.dynamic,
      positionOnlyPromotedCapturesPerSecond: this.positionOnlyRate,
      totalCopiedTexelsPerSecond: Object.values(this.texelRates).reduce(
        (total, value) => total + value,
        0,
      ),
    };
  }

  reset(now = performance.now()) {
    this.totals = emptyCounts();
    this.rates = emptyCounts();
    this.texels = emptyCounts();
    this.texelRates = emptyCounts();
    this.positionOnly = 0;
    this.positionOnlyRate = 0;
    this.sample = { at: now, counts: emptyCounts() };
    this.texelSample = { counts: emptyCounts(), positionOnly: 0 };
  }
}
