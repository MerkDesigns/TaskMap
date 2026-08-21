/** Optional observation hooks. The reusable runtime never owns or aggregates benchmark counters. */
export interface CanvasBrowserRuntimeInstrumentation {
  recordBrowserTick(): void;
  recordScrollGroupTransformUpdate(): void;
  recordDragTransformUpdate(): void;
  recordCardGeometrySync(): void;
  recordCardVisibilitySync(visibleCards: number, totalCards: number): void;
  recordDragContainerChange(active: boolean): void;
}
