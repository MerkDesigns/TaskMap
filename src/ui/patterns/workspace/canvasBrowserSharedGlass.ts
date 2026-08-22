import {
  writeSharedSmallGlassShapes,
  type SharedSmallGlassShape,
} from "../../materials/SharedSmallGlassPlane";
import { CANVAS_BROWSER_LAYOUT } from "./canvasBrowserLayout";
import type { CanvasBrowserCardRecord } from "./canvasBrowserRuntimeTypes";

export class CanvasBrowserSharedGlass<Id extends string> {
  private dragShape: (SharedSmallGlassShape & { readonly id: Id }) | null = null;

  constructor(
    private readonly plane: HTMLElement | null | undefined,
    private readonly records: ReadonlyMap<Id, CanvasBrowserCardRecord<Id>>,
    private readonly viewport: HTMLElement,
  ) {}

  sync(scrollY: number): void {
    syncCanvasBrowserSharedGlass(
      this.plane,
      this.records,
      scrollY,
      this.viewport.offsetTop,
      this.dragShape,
    );
  }

  beginDrag(
    id: Id,
    record: CanvasBrowserCardRecord<Id>,
    rectangle: DOMRect,
    panelRectangle: DOMRect,
  ): void {
    this.dragShape = {
      id,
      x: rectangle.left - panelRectangle.left,
      y: rectangle.top - panelRectangle.top,
      width: rectangle.width || CANVAS_BROWSER_LAYOUT.cardWidth,
      height: record.height,
      radius:
        Number.parseFloat(record.card.style.getPropertyValue("--taskmap-material-radius")) ||
        CANVAS_BROWSER_LAYOUT.smallRadius,
    };
    this.plane?.setAttribute("data-glass-drag-region-active", "true");
  }

  moveDrag(y: number): void {
    if (this.dragShape) this.dragShape = { ...this.dragShape, y };
  }

  endDrag(): void {
    this.dragShape = null;
    this.plane?.removeAttribute("data-glass-drag-region-active");
  }

  clear(): void {
    this.endDrag();
    clearCanvasBrowserSharedGlass(this.plane);
  }
}

export function syncCanvasBrowserSharedGlass<Id extends string>(
  plane: HTMLElement | null | undefined,
  records: ReadonlyMap<Id, CanvasBrowserCardRecord<Id>>,
  scrollY: number,
  viewportTop: number,
  dragShape: (SharedSmallGlassShape & { readonly id: Id }) | null,
): void {
  if (!plane) return;
  const shapes: SharedSmallGlassShape[] = [];
  for (const [id, record] of records) {
    if (id === dragShape?.id || record.card.dataset.materialBackdropSource !== "shared") continue;
    const visibleHeight = finiteStyleNumber(record.host, "--taskmap-canvas-card-visible-height");
    if (visibleHeight <= 0 || record.host.dataset.canvasCardVisible === "false") continue;
    const clipOffset = finiteStyleNumber(record.host, "--taskmap-canvas-card-clip-offset");
    const radius =
      finiteStyleNumber(record.card, "--taskmap-material-radius") ||
      CANVAS_BROWSER_LAYOUT.smallRadius;
    shapes.push({
      x: CANVAS_BROWSER_LAYOUT.cardInset,
      y: viewportTop + record.y - scrollY + clipOffset,
      width: CANVAS_BROWSER_LAYOUT.cardWidth,
      height: visibleHeight,
      radius,
    });
  }
  if (dragShape) shapes.push(dragShape);
  writeSharedSmallGlassShapes(plane, shapes);
}

export function clearCanvasBrowserSharedGlass(plane: HTMLElement | null | undefined): void {
  if (plane) writeSharedSmallGlassShapes(plane, []);
}

function finiteStyleNumber(element: HTMLElement, property: string): number {
  const value = Number.parseFloat(element.style.getPropertyValue(property));
  return Number.isFinite(value) ? value : 0;
}
