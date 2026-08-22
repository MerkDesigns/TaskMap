export interface CanvasBrowserCardRecord<Id extends string> {
  readonly id: Id;
  readonly host: HTMLDivElement;
  card: HTMLElement;
  height: number;
  y: number;
}

export interface CanvasCardDragState<Id extends string> {
  readonly id: Id;
  readonly pointerId: number;
  readonly startY: number;
  readonly pointerOffsetY: number;
  readonly initialOrder: readonly Id[];
  readonly cardHeight: number;
  pointerY: number;
  order: readonly Id[];
  active: boolean;
  finish: "commit" | "cancel" | null;
  snapStartedAt: number | null;
  snapFromY: number;
}

export interface CanvasBrowserFrameDriver {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface CanvasBrowserRuntimeOptions<Id extends string> {
  readonly panel: HTMLElement;
  readonly viewport: HTMLElement;
  readonly cardsLayer: HTMLElement;
  readonly sharedSmallGlassPlane?: HTMLElement | null;
  readonly commitOrder: (order: readonly Id[]) => void;
  readonly invalidateMaterialGeometry: () => void;
  readonly frameDriver?: CanvasBrowserFrameDriver;
  readonly reducedMotion?: boolean;
}

export const browserAnimationFrameDriver: CanvasBrowserFrameDriver = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};
