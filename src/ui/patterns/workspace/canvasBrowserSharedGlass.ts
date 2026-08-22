import {
  writeSharedSmallGlassShapes,
  type SharedSmallGlassShape,
} from "../../materials/SharedSmallGlassPlane";
import { CANVAS_BROWSER_LAYOUT } from "./canvasBrowserLayout";
import type { CanvasBrowserCardRecord } from "./canvasBrowserRuntimeTypes";

export class CanvasBrowserSharedGlass<Id extends string> {
  constructor(
    private readonly plane: HTMLElement | null | undefined,
    private readonly records: ReadonlyMap<Id, CanvasBrowserCardRecord<Id>>,
  ) {}

  sync(scrollY: number, excludedId: Id | null): void {
    syncCanvasBrowserSharedGlass(this.plane, this.records, scrollY, excludedId);
  }

  clear(): void {
    clearCanvasBrowserSharedGlass(this.plane);
  }
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
