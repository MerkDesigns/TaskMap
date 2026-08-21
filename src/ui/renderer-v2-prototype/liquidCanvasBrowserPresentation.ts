import type { LiquidCanvasCardRecord } from "./liquidCanvasCardGeometry";
import type { CanvasBrowserItemId } from "./liquidCanvasBrowserTypes";

export interface CanvasBrowserCardFeatures {
  readonly cardGlass: boolean;
  readonly cardHtml: boolean;
}

export interface CanvasBrowserCardPresentation<Id extends string = CanvasBrowserItemId> {
  add(id: Id): void;
  remove(id: Id): void;
  apply(cards: ReadonlyMap<Id, LiquidCanvasCardRecord<Id>>): void;
  sync(
    order: readonly Id[],
    cards: ReadonlyMap<Id, LiquidCanvasCardRecord<Id>>,
    scrollY: number,
    bodyTop: number,
    bodyBottom: number,
    cardWidth: number,
    draggedId: Id | null,
  ): void;
  features(): CanvasBrowserCardFeatures;
  destroy(): void;
}

const FULL_CARD_FEATURES: CanvasBrowserCardFeatures = Object.freeze({
  cardGlass: true,
  cardHtml: true,
});

export class DefaultCanvasBrowserCardPresentation<
  Id extends string = CanvasBrowserItemId,
> implements CanvasBrowserCardPresentation<Id> {
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

export class CanvasBrowserPresentationController<Id extends string = CanvasBrowserItemId> {
  private readonly captureRegistry = new CanvasCardCaptureRegistry();

  constructor(private readonly presentation: CanvasBrowserCardPresentation<Id>) {}

  added = (record: LiquidCanvasCardRecord<Id>) => {
    this.captureRegistry.add(record.content.host);
    this.presentation.add(record.id);
  };

  removing = (record: LiquidCanvasCardRecord<Id>) => {
    this.captureRegistry.remove(record.content.host);
    this.presentation.remove(record.id);
  };

  apply(cards: ReadonlyMap<Id, LiquidCanvasCardRecord<Id>>) {
    this.presentation.apply(cards);
  }

  sync(
    order: readonly Id[],
    cards: ReadonlyMap<Id, LiquidCanvasCardRecord<Id>>,
    scrollY: number,
    bodyTop: number,
    bodyBottom: number,
    cardWidth: number,
    draggedId: Id | null,
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
