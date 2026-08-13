import { calculateBoundedCanvasCardScrollTop } from "./benchmarkCanvasCardInteraction";

export interface CanvasBrowserScrollFrame {
  readonly previousScrollY: number;
  readonly currentScrollY: number;
  readonly appliedDeltaY: number;
  readonly changed: boolean;
}

export class CanvasBrowserScrollState {
  private pendingDeltaY = 0;
  private maximumScrollY = 0;
  currentScrollY = 0;

  setRange(viewportHeight: number, contentHeight: number) {
    this.maximumScrollY = Math.max(0, contentHeight - viewportHeight);
    this.pendingDeltaY = 0;
    return this.apply(0, viewportHeight, contentHeight);
  }

  requestDelta(deltaY: number) {
    if (Number.isFinite(deltaY)) this.pendingDeltaY += deltaY;
  }

  flush(viewportHeight: number, contentHeight: number) {
    const requestedDeltaY = this.pendingDeltaY;
    this.pendingDeltaY = 0;
    return this.apply(requestedDeltaY, viewportHeight, contentHeight);
  }

  clearPending() {
    this.pendingDeltaY = 0;
  }

  snapshot() {
    return {
      currentScrollY: this.currentScrollY,
      pendingDeltaY: this.pendingDeltaY,
      maximumScrollY: this.maximumScrollY,
    };
  }

  private apply(deltaY: number, viewportHeight: number, contentHeight: number) {
    const previousScrollY = this.currentScrollY;
    this.currentScrollY = calculateBoundedCanvasCardScrollTop(
      previousScrollY,
      deltaY,
      viewportHeight,
      contentHeight,
    );
    return {
      previousScrollY,
      currentScrollY: this.currentScrollY,
      appliedDeltaY: this.currentScrollY - previousScrollY,
      changed: this.currentScrollY !== previousScrollY,
    } satisfies CanvasBrowserScrollFrame;
  }
}
