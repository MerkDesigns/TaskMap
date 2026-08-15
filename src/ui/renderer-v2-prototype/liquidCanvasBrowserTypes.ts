export type CanvasBrowserItemId = string;

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

export interface CanvasCardDragState {
  readonly id: CanvasBrowserItemId;
  readonly pointerId: number;
  readonly startY: number;
  readonly pointerOffsetY: number;
  readonly initialOrder: readonly CanvasBrowserItemId[];
  pointerY: number;
  order: readonly CanvasBrowserItemId[];
  active: boolean;
  finish: "commit" | "cancel" | null;
  snapStartedAt: number | null;
  snapFromY: number;
}
