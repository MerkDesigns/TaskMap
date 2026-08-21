export type CanvasBrowserItemId = string;

export interface CanvasCardDragState<Id extends string = CanvasBrowserItemId> {
  readonly id: Id;
  readonly pointerId: number;
  readonly startY: number;
  readonly pointerOffsetY: number;
  readonly initialOrder: readonly Id[];
  pointerY: number;
  order: readonly Id[];
  active: boolean;
  finish: "commit" | "cancel" | null;
  snapStartedAt: number | null;
  snapFromY: number;
}
