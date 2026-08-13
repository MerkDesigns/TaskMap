import {
  canvasBrowserDiagnosticFeatures,
  type CanvasBrowserDiagnosticMode,
} from "./canvasBrowserDiagnostics";
import { BENCHMARK_CANVAS_BROWSER } from "./benchmarkCanvasBrowserLayout";
import type { LiquidCanvasCardRecord } from "./liquidCanvasCardGeometry";
import type { CanvasBrowserRuntimeCounts } from "./liquidCanvasBrowserTypes";

export class CanvasCardDiagnosticPresentation {
  readonly placeholderOverlay = document.createElement("div");
  private readonly placeholders = new Map<number, HTMLDivElement>();
  private readonly captureHosts = new Set<Element>();
  private readonly initializedCaptureHosts = new Set<Element>();
  mode: CanvasBrowserDiagnosticMode = "full";

  constructor() {
    this.placeholderOverlay.className = "renderer-benchmark__canvas-card-placeholder-overlay";
  }

  add(id: number) {
    const placeholder = document.createElement("div");
    placeholder.className = "renderer-benchmark__canvas-card-placeholder";
    placeholder.dataset.canvasCardId = String(id);
    this.placeholders.set(id, placeholder);
  }

  remove(id: number) {
    this.placeholders.get(id)?.remove();
    this.placeholders.delete(id);
  }

  setMode(mode: CanvasBrowserDiagnosticMode, cards: ReadonlyMap<number, LiquidCanvasCardRecord>) {
    this.mode = mode;
    const features = this.features();
    this.captureHosts.clear();
    for (const [id, record] of cards) {
      this.captureHosts.add(record.content.host);
      record.content.remove();
      record.glass.remove();
      if (features.cardGlass) record.group.add(record.glass);
      if (features.cardHtml) {
        record.contentDirect = !features.cardGlass;
        if (features.cardGlass) record.glass.add(record.content);
        else record.group.add(record.content);
      } else {
        record.contentDirect = false;
      }
      const placeholder = this.placeholders.get(id);
      if (!placeholder) continue;
      if (features.placeholder) this.placeholderOverlay.append(placeholder);
      else placeholder.remove();
    }
    for (const host of this.initializedCaptureHosts) {
      if (!this.captureHosts.has(host)) this.initializedCaptureHosts.delete(host);
    }
  }

  syncPlaceholders(
    order: readonly number[],
    cards: ReadonlyMap<number, LiquidCanvasCardRecord>,
    scrollY: number,
    bodyTop: number,
    bodyBottom: number,
    cardWidth: number,
    draggedId: number | null,
  ) {
    let visible = 0;
    for (const id of order) {
      const record = cards.get(id);
      const placeholder = this.placeholders.get(id);
      if (!record || !placeholder) continue;
      const top = record.group.y - scrollY;
      const clippedTop = Math.max(top, bodyTop);
      const clippedBottom = Math.min(top + BENCHMARK_CANVAS_BROWSER.cardHeight, bodyBottom);
      const height = Math.max(0, clippedBottom - clippedTop);
      if (height > 0 && id !== draggedId) visible += 1;
      Object.assign(placeholder.style, {
        display: height > 0 && id !== draggedId ? "block" : "none",
        left: `${BENCHMARK_CANVAS_BROWSER.x + BENCHMARK_CANVAS_BROWSER.cardInset}px`,
        top: `${clippedTop}px`,
        width: `${cardWidth}px`,
        height: `${height}px`,
      });
    }
    return visible + (draggedId === null ? 0 : 1);
  }

  features() {
    return canvasBrowserDiagnosticFeatures(this.mode);
  }

  ownsCaptureHost(source: unknown) {
    return source instanceof Element && this.captureHosts.has(source);
  }

  classifyCaptureSource(source: unknown, browserHost: Element) {
    if (source === browserHost) return "browser" as const;
    if (this.ownsCaptureHost(source)) return "card" as const;
    return null;
  }

  paintTouchesManagedCapture(event: Event, browserHost: Element) {
    const changedElements = (event as Event & { changedElements?: unknown }).changedElements;
    if (!Array.isArray(changedElements)) return true;
    return changedElements.some(
      (element) =>
        element instanceof Element &&
        (element === browserHost ||
          browserHost.contains(element) ||
          [...this.captureHosts].some((host) => element === host || host.contains(element))),
    );
  }

  isCardCaptureHostOnlyPaint(event: Event) {
    const changedElements = (event as Event & { changedElements?: unknown }).changedElements;
    const cardCaptureHostsOnly =
      Array.isArray(changedElements) &&
      changedElements.length > 0 &&
      changedElements.every((element) => this.captureHosts.has(element));
    if (!cardCaptureHostsOnly) return false;

    // The first host paint supplies the initial texture; only later host-only paints can be the
    // transform mirrors produced by scene movement. Real card content paints identify descendants.
    const initialized = changedElements.every((element) =>
      this.initializedCaptureHosts.has(element),
    );
    changedElements.forEach((element) => this.initializedCaptureHosts.add(element));
    return initialized;
  }

  destroy() {
    this.placeholders.forEach((placeholder) => placeholder.remove());
    this.placeholders.clear();
    this.captureHosts.clear();
    this.initializedCaptureHosts.clear();
    this.placeholderOverlay.remove();
  }
}

export class CanvasBrowserRuntimeMetrics {
  scrollUpdates = 0;
  dragUpdates = 0;
  ticks = 0;
  visibilitySyncs = 0;
  visibleCards = 0;

  snapshot(
    features: ReturnType<typeof canvasBrowserDiagnosticFeatures>,
    totalCards: number,
    containers: number,
    geometrySyncs: number,
  ): CanvasBrowserRuntimeCounts {
    return {
      html: 1 + (features.cardHtml ? totalCards : 0),
      containers,
      glassShapes: 1 + (features.cardGlass ? totalCards : 0),
      cardGeometrySyncs: geometrySyncs,
      scrollGroupTransformUpdates: this.scrollUpdates,
      dragTransformUpdates: this.dragUpdates,
      browserRuntimeTicks: this.ticks,
      cardVisibilitySyncs: this.visibilitySyncs,
      visibleCardCount: this.visibleCards,
      totalCardCount: totalCards,
    };
  }

  reset() {
    this.scrollUpdates = 0;
    this.dragUpdates = 0;
    this.ticks = 0;
    this.visibilitySyncs = 0;
  }
}
