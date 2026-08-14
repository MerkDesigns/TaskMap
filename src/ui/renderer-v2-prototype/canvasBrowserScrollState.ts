export interface CanvasBrowserScrollFrame {
  readonly previousScrollY: number;
  readonly currentScrollY: number;
  readonly appliedDeltaY: number;
  readonly changed: boolean;
}

const WHEEL_SCROLL_TIME_CONSTANT_MS = 45;
const WHEEL_SCROLL_SETTLE_EPSILON = 0.01;

export class CanvasBrowserScrollState {
  private maximumScrollY = 0;
  currentScrollY = 0;
  targetScrollY = 0;

  setRange(viewportHeight: number, contentHeight: number) {
    const previousScrollY = this.currentScrollY;
    this.maximumScrollY = Math.max(0, contentHeight - viewportHeight);
    this.currentScrollY = this.clamp(this.currentScrollY);
    this.targetScrollY = this.clamp(this.targetScrollY);
    return this.frame(previousScrollY);
  }

  requestWheelDelta(deltaY: number) {
    if (Number.isFinite(deltaY)) this.targetScrollY = this.clamp(this.targetScrollY + deltaY);
  }

  tick(deltaTimeMs: number, directDeltaY?: number) {
    const previousScrollY = this.currentScrollY;
    if (directDeltaY !== undefined) {
      this.currentScrollY = this.clamp(this.currentScrollY + directDeltaY);
      this.targetScrollY = this.currentScrollY;
      return this.frame(previousScrollY);
    }

    const remaining = this.targetScrollY - this.currentScrollY;
    if (Math.abs(remaining) <= WHEEL_SCROLL_SETTLE_EPSILON) {
      this.currentScrollY = this.targetScrollY;
      return this.frame(previousScrollY);
    }
    const elapsed = Math.max(0, deltaTimeMs);
    const progress = 1 - Math.exp(-elapsed / WHEEL_SCROLL_TIME_CONSTANT_MS);
    this.currentScrollY = this.clamp(this.currentScrollY + remaining * progress);
    if (Math.abs(this.targetScrollY - this.currentScrollY) <= WHEEL_SCROLL_SETTLE_EPSILON) {
      this.currentScrollY = this.targetScrollY;
    }
    return this.frame(previousScrollY);
  }

  synchronizeTarget() {
    this.targetScrollY = this.currentScrollY;
  }

  snapshot() {
    return {
      currentScrollY: this.currentScrollY,
      targetScrollY: this.targetScrollY,
      maximumScrollY: this.maximumScrollY,
    };
  }

  private clamp(scrollY: number) {
    return Math.min(this.maximumScrollY, Math.max(0, scrollY));
  }

  private frame(previousScrollY: number) {
    return {
      previousScrollY,
      currentScrollY: this.currentScrollY,
      appliedDeltaY: this.currentScrollY - previousScrollY,
      changed: this.currentScrollY !== previousScrollY,
    } satisfies CanvasBrowserScrollFrame;
  }
}
export class CanvasBrowserFrameClock {
  private previousTickAt: number | null = null;

  tick(now: number) {
    const deltaTime =
      this.previousTickAt === null ? 16 : Math.max(0, Math.min(64, now - this.previousTickAt));
    this.previousTickAt = now;
    return deltaTime;
  }
}
