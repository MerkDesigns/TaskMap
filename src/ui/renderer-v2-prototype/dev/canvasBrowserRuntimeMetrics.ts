// DEV/PROTOTYPE ONLY — benchmark aggregation for optional Canvas Browser instrumentation.
import type { CanvasBrowserRuntimeInstrumentation } from "../liquidCanvasBrowserInstrumentation";
import type { CanvasBrowserCardFeatures } from "../liquidCanvasBrowserPresentation";

export interface CanvasBrowserRuntimeCounts {
  readonly html: number;
  readonly containers: number;
  readonly glassShapes: number;
  readonly cardGeometrySyncs: number;
  readonly scrollGroupTransformUpdates: number;
  readonly dragTransformUpdates: number;
  readonly browserRuntimeTicks: number;
  readonly cardVisibilitySyncs: number;
  readonly visibleCardCount: number;
  readonly totalCardCount: number;
}

export class CanvasBrowserRuntimeMetrics implements CanvasBrowserRuntimeInstrumentation {
  private scrollUpdates = 0;
  private dragUpdates = 0;
  private geometrySyncs = 0;
  private ticks = 0;
  private visibilitySyncs = 0;
  private visibleCards = 0;
  private totalCards = 0;
  private dragContainerActive = false;

  recordBrowserTick() {
    this.ticks += 1;
  }

  recordScrollGroupTransformUpdate() {
    this.scrollUpdates += 1;
  }

  recordDragTransformUpdate() {
    this.dragUpdates += 1;
  }

  recordCardGeometrySync() {
    this.geometrySyncs += 1;
  }

  recordCardVisibilitySync(visibleCards: number, totalCards: number) {
    this.visibilitySyncs += 1;
    this.visibleCards = visibleCards;
    this.totalCards = totalCards;
  }

  recordDragContainerChange(active: boolean) {
    this.dragContainerActive = active;
  }

  snapshot(features: CanvasBrowserCardFeatures): CanvasBrowserRuntimeCounts {
    return {
      html: 1 + (features.cardHtml ? this.totalCards : 0),
      containers: 2 + (this.dragContainerActive ? 1 : 0),
      glassShapes: 1 + (features.cardGlass ? this.totalCards : 0),
      cardGeometrySyncs: this.geometrySyncs,
      scrollGroupTransformUpdates: this.scrollUpdates,
      dragTransformUpdates: this.dragUpdates,
      browserRuntimeTicks: this.ticks,
      cardVisibilitySyncs: this.visibilitySyncs,
      visibleCardCount: this.visibleCards,
      totalCardCount: this.totalCards,
    };
  }

  reset() {
    this.scrollUpdates = 0;
    this.dragUpdates = 0;
    this.geometrySyncs = 0;
    this.ticks = 0;
    this.visibilitySyncs = 0;
  }
}
