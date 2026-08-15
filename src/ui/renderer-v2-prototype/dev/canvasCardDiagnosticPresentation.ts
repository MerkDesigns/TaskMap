// DEV/PROTOTYPE ONLY — do not port with Renderer V2 production implementation.
import {
  canvasBrowserDiagnosticFeatures,
  type CanvasBrowserDiagnosticMode,
} from "./canvasBrowserDiagnostics";
import { BENCHMARK_CANVAS_BROWSER } from "../benchmarkCanvasBrowserLayout";
import type { LiquidCanvasCardRecord } from "../liquidCanvasCardGeometry";
import type { CanvasBrowserCardPresentation } from "../liquidCanvasBrowserPresentation";
import type { CanvasBrowserItemId } from "../liquidCanvasBrowserTypes";

export class CanvasCardDiagnosticPresentation implements CanvasBrowserCardPresentation {
  readonly placeholderOverlay = document.createElement("div");
  private readonly placeholders = new Map<CanvasBrowserItemId, HTMLDivElement>();
  mode: CanvasBrowserDiagnosticMode = "full";

  constructor() {
    this.placeholderOverlay.className = "renderer-benchmark__canvas-card-placeholder-overlay";
  }

  add(id: CanvasBrowserItemId) {
    const placeholder = document.createElement("div");
    placeholder.className = "renderer-benchmark__canvas-card-placeholder";
    placeholder.dataset.canvasCardId = String(id);
    this.placeholders.set(id, placeholder);
  }

  remove(id: CanvasBrowserItemId) {
    this.placeholders.get(id)?.remove();
    this.placeholders.delete(id);
  }

  setMode(mode: CanvasBrowserDiagnosticMode) {
    this.mode = mode;
  }

  apply(cards: ReadonlyMap<CanvasBrowserItemId, LiquidCanvasCardRecord>) {
    const features = this.features();
    for (const [id, record] of cards) {
      record.content.remove();
      record.glass.remove();
      if (features.cardGlass) {
        record.group.add(record.glass);
      }
      if (features.cardHtml) {
        record.glass.add(record.content);
      }
      const placeholder = this.placeholders.get(id);
      if (!placeholder) continue;
      if (features.placeholder) this.placeholderOverlay.append(placeholder);
      else placeholder.remove();
    }
  }

  sync(
    order: readonly CanvasBrowserItemId[],
    cards: ReadonlyMap<CanvasBrowserItemId, LiquidCanvasCardRecord>,
    scrollY: number,
    bodyTop: number,
    bodyBottom: number,
    cardWidth: number,
    draggedId: CanvasBrowserItemId | null,
  ) {
    for (const id of order) {
      const record = cards.get(id);
      const placeholder = this.placeholders.get(id);
      if (!record || !placeholder) continue;
      const top = record.group.y - scrollY;
      const clippedTop = Math.max(top, bodyTop);
      const clippedBottom = Math.min(top + BENCHMARK_CANVAS_BROWSER.cardHeight, bodyBottom);
      const height = Math.max(0, clippedBottom - clippedTop);
      Object.assign(placeholder.style, {
        display: height > 0 && id !== draggedId ? "block" : "none",
        left: `${BENCHMARK_CANVAS_BROWSER.x + BENCHMARK_CANVAS_BROWSER.cardInset}px`,
        top: `${clippedTop}px`,
        width: `${cardWidth}px`,
        height: `${height}px`,
      });
    }
  }

  features() {
    return canvasBrowserDiagnosticFeatures(this.mode);
  }

  destroy() {
    this.placeholders.forEach((placeholder) => placeholder.remove());
    this.placeholders.clear();
    this.placeholderOverlay.remove();
  }
}
