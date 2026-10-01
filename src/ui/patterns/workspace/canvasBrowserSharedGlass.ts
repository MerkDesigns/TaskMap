import {
  writeSharedSmallGlassShapes,
  type SharedSmallGlassShape,
} from "../../materials/SharedSmallGlassPlane";
import { CANVAS_BROWSER_LAYOUT } from "./canvasBrowserLayout";
import { readCanvasBrowserCardSlice } from "./canvasBrowserDom";
import type { CanvasBrowserCardRecord } from "./canvasBrowserRuntimeTypes";
import { glassListShape } from "./glassListGeometry";

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
  const x = finiteStyleNumber(record.host, "left");
  const y = finiteStyleNumber(record.host, "--taskmap-canvas-card-y");
  const width = finiteStyleNumber(record.host, "width") || CANVAS_BROWSER_LAYOUT.cardWidth;
  // Held glass follows the liquid pickup/drop slice and the held lift scale written on the host.
  const { offset, visible } = readCanvasBrowserCardSlice(record);
  const scale = finiteStyleNumber(record.host, "--taskmap-canvas-card-scale") || 1;
  const centerX = x + width / 2;
  const centerY = y + record.height / 2;
  // Whole-pixel sizes keep the cached mask images bounded while the lift animates.
  const scaled = (start: number, size: number, center: number) => {
    const next = Math.round(size * scale);
    return { start: center + (start + size / 2 - center) * scale - next / 2, size: next };
  };
  const shapeX = scaled(x, width, centerX);
  const shapeY = scaled(y, record.height, centerY);
  const clipY = scaled(y + offset, visible, centerY);
  writeSharedSmallGlassShapes(plane, [
    {
      x: shapeX.start,
      y: shapeY.start,
      width: shapeX.size,
      height: shapeY.size,
      radius: Math.round(radius * scale * 2) / 2,
      clip: { left: shapeX.start, top: clipY.start, width: shapeX.size, height: clipY.size },
      morph: true,
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
    const shape = glassListShape(
      {
        x: CANVAS_BROWSER_LAYOUT.cardInset,
        y: record.y - scrollY,
        width: CANVAS_BROWSER_LAYOUT.cardWidth,
        height: record.height,
        radius,
      },
      {
        left: CANVAS_BROWSER_LAYOUT.cardInset,
        top: record.y - scrollY + clipOffset,
        width: CANVAS_BROWSER_LAYOUT.cardWidth,
        height: visibleHeight,
      },
    );
    if (shape) shapes.push({ ...shape, morph: true });
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
