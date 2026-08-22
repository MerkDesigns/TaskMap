import {
  writeSharedSmallGlassShapes,
  type SharedSmallGlassShape,
} from "../../materials/SharedSmallGlassPlane";
import { CANVAS_BROWSER_LAYOUT } from "./canvasBrowserLayout";
import type { CanvasBrowserCardRecord } from "./canvasBrowserRuntimeTypes";

export class CanvasBrowserSharedGlass<Id extends string> {
  constructor(
    private readonly settledPlane: HTMLElement | null | undefined,
    private readonly dragPlane: HTMLElement | null | undefined,
    private readonly records: ReadonlyMap<Id, CanvasBrowserCardRecord<Id>>,
  ) {}

  sync(scrollY: number, draggedId: Id | null): void {
    syncCanvasBrowserSharedGlass(this.settledPlane, this.records, scrollY, draggedId);
    syncCanvasBrowserDragGlass(this.dragPlane, draggedId ? this.records.get(draggedId) : null);
  }

  clear(): void {
    clearCanvasBrowserSharedGlass(this.settledPlane);
    clearCanvasBrowserSharedGlass(this.dragPlane);
  }
}

export function syncCanvasBrowserDragGlass<Id extends string>(
  plane: HTMLElement | null | undefined,
  record: CanvasBrowserCardRecord<Id> | null | undefined,
): void {
  if (!plane) return;
  if (!record || record.host.dataset.dragging !== "true") {
    writeSharedSmallGlassShapes(plane, []);
    return;
  }
  const radius =
    finiteStyleNumber(record.card, "--taskmap-material-radius") ||
    CANVAS_BROWSER_LAYOUT.smallRadius;
  writeSharedSmallGlassShapes(plane, [
    {
      x: finiteStyleNumber(record.host, "left"),
      y: finiteStyleNumber(record.host, "top"),
      width: finiteStyleNumber(record.host, "width") || CANVAS_BROWSER_LAYOUT.cardWidth,
      height: record.height,
      radius,
    },
  ]);
}

export function syncCanvasBrowserSharedGlass<Id extends string>(
  plane: HTMLElement | null | undefined,
  records: ReadonlyMap<Id, CanvasBrowserCardRecord<Id>>,
  scrollY: number,
  excludedId: Id | null,
): void {
  if (!plane) return;
  const shapes: SharedSmallGlassShape[] = [];
  for (const [id, record] of records) {
    if (id === excludedId || record.card.dataset.materialBackdropSource !== "shared") continue;
    const visibleHeight = finiteStyleNumber(record.host, "--taskmap-canvas-card-visible-height");
    if (visibleHeight <= 0 || record.host.dataset.canvasCardVisible === "false") continue;
    const clipOffset = finiteStyleNumber(record.host, "--taskmap-canvas-card-clip-offset");
    const radius =
      finiteStyleNumber(record.card, "--taskmap-material-radius") ||
      CANVAS_BROWSER_LAYOUT.smallRadius;
    shapes.push({
      x: CANVAS_BROWSER_LAYOUT.cardInset,
      y: record.y - scrollY + clipOffset,
      width: CANVAS_BROWSER_LAYOUT.cardWidth,
      height: visibleHeight,
      radius,
    });
  }
  writeSharedSmallGlassShapes(plane, shapes);
}

export function clearCanvasBrowserSharedGlass(plane: HTMLElement | null | undefined): void {
  if (plane) writeSharedSmallGlassShapes(plane, []);
}

function finiteStyleNumber(element: HTMLElement, property: string): number {
  const value = Number.parseFloat(element.style.getPropertyValue(property));
  return Number.isFinite(value) ? value : 0;
}
