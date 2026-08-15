import type { LiquidCanvasCardRecord } from "./liquidCanvasCardGeometry";
import type { CanvasBrowserItemId } from "./liquidCanvasBrowserTypes";

export interface CanvasBrowserCardFeatures {
  readonly cardGlass: boolean;
  readonly cardHtml: boolean;
}

export interface CanvasBrowserCardPresentation {
  add(id: CanvasBrowserItemId): void;
  remove(id: CanvasBrowserItemId): void;
  apply(cards: ReadonlyMap<CanvasBrowserItemId, LiquidCanvasCardRecord>): void;
  sync(
    order: readonly CanvasBrowserItemId[],
    cards: ReadonlyMap<CanvasBrowserItemId, LiquidCanvasCardRecord>,
    scrollY: number,
    bodyTop: number,
    bodyBottom: number,
    cardWidth: number,
    draggedId: CanvasBrowserItemId | null,
  ): void;
  features(): CanvasBrowserCardFeatures;
  destroy(): void;
}

const FULL_CARD_FEATURES: CanvasBrowserCardFeatures = Object.freeze({
  cardGlass: true,
  cardHtml: true,
});

export class DefaultCanvasBrowserCardPresentation implements CanvasBrowserCardPresentation {
  add() {}
  remove() {}
  apply() {}
  sync() {}

  features() {
    return FULL_CARD_FEATURES;
  }

  destroy() {}
}

export class CanvasCardCaptureRegistry {
  private readonly hosts = new Set<Element>();
  private readonly initializedHosts = new Set<Element>();

  add(host: Element) {
    this.hosts.add(host);
  }

  remove(host: Element) {
    this.hosts.delete(host);
    this.initializedHosts.delete(host);
  }

  classify(source: unknown, browserHost: Element) {
    if (source === browserHost) return "browser" as const;
    if (source instanceof Element && this.hosts.has(source)) return "card" as const;
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
          [...this.hosts].some((host) => element === host || host.contains(element))),
    );
  }

  isCardCaptureHostOnlyPaint(event: Event) {
    const changedElements = (event as Event & { changedElements?: unknown }).changedElements;
    const hostsOnly =
      Array.isArray(changedElements) &&
      changedElements.length > 0 &&
      changedElements.every((element) => this.hosts.has(element));
    if (!hostsOnly) return false;

    const initialized = changedElements.every((element) => this.initializedHosts.has(element));
    changedElements.forEach((element) => this.initializedHosts.add(element));
    return initialized;
  }

  clear() {
    this.hosts.clear();
    this.initializedHosts.clear();
  }
}

export class CanvasBrowserPresentationController {
  private readonly captureRegistry = new CanvasCardCaptureRegistry();

  constructor(private readonly presentation: CanvasBrowserCardPresentation) {}

  added = (record: LiquidCanvasCardRecord) => {
    this.captureRegistry.add(record.content.host);
    this.presentation.add(record.id);
  };

  removing = (record: LiquidCanvasCardRecord) => {
    this.captureRegistry.remove(record.content.host);
    this.presentation.remove(record.id);
  };

  apply(cards: ReadonlyMap<CanvasBrowserItemId, LiquidCanvasCardRecord>) {
    this.presentation.apply(cards);
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
    this.presentation.sync(order, cards, scrollY, bodyTop, bodyBottom, cardWidth, draggedId);
  }

  features() {
    return this.presentation.features();
  }

  isCardCaptureHostOnlyPaint(event: Event) {
    return this.captureRegistry.isCardCaptureHostOnlyPaint(event);
  }

  classifyCaptureSource(source: unknown, browserHost: Element) {
    return this.captureRegistry.classify(source, browserHost);
  }

  paintTouchesManagedCapture(event: Event, browserHost: Element) {
    return this.captureRegistry.paintTouchesManagedCapture(event, browserHost);
  }

  destroy() {
    this.captureRegistry.clear();
    this.presentation.destroy();
  }
}
