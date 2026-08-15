import type { CanvasBrowserCardFeatures } from "./liquidCanvasBrowserPresentation";
import type { CanvasBrowserRuntimeCounts } from "./liquidCanvasBrowserTypes";

export class CanvasBrowserRuntimeMetrics {
  scrollUpdates = 0;
  dragUpdates = 0;
  ticks = 0;
  visibilitySyncs = 0;
  visibleCards = 0;

  snapshot(
    features: CanvasBrowserCardFeatures,
    totalCards: number,
    containers: number,
    geometrySyncs: number,
  ): CanvasBrowserRuntimeCounts {
    return {
      html: 1 + (features.cardHtml ? totalCards : 0),
      containers,
      glassShapes: 1 + (features.cardGlass ? totalCards : 0),
      cardGeometrySyncs: geometrySyncs,
      scrollGroupTransformUpdates: this.scrollUpdates,
      dragTransformUpdates: this.dragUpdates,
      browserRuntimeTicks: this.ticks,
      cardVisibilitySyncs: this.visibilitySyncs,
      visibleCardCount: this.visibleCards,
      totalCardCount: totalCards,
    };
  }

  reset() {
    this.scrollUpdates = 0;
    this.dragUpdates = 0;
    this.ticks = 0;
    this.visibilitySyncs = 0;
  }
}
