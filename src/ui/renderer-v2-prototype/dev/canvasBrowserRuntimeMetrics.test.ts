import { describe, expect, it } from "vitest";
import { CanvasBrowserRuntimeMetrics } from "./canvasBrowserRuntimeMetrics";

describe("Canvas Browser benchmark metrics", () => {
  it("aggregates optional runtime observations outside the reusable runtime", () => {
    const metrics = new CanvasBrowserRuntimeMetrics();
    metrics.recordBrowserTick();
    metrics.recordScrollGroupTransformUpdate();
    metrics.recordDragTransformUpdate();
    metrics.recordCardGeometrySync();
    metrics.recordCardVisibilitySync(2, 3);
    metrics.recordDragContainerChange(true);

    expect(metrics.snapshot({ cardGlass: true, cardHtml: false })).toEqual({
      html: 1,
      containers: 3,
      glassShapes: 4,
      cardGeometrySyncs: 1,
      scrollGroupTransformUpdates: 1,
      dragTransformUpdates: 1,
      browserRuntimeTicks: 1,
      cardVisibilitySyncs: 1,
      visibleCardCount: 2,
      totalCardCount: 3,
    });
  });
});
