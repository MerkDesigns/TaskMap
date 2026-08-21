import { syncCanvasBrowserCardViewport } from "./canvasBrowserDom";
import type { CanvasBrowserCardRecord } from "./canvasBrowserRuntimeTypes";
import type { CanvasBrowserScrollState } from "./canvasBrowserScrollState";
import { canvasCardSlotTop } from "./canvasBrowserSlotGeometry";

export class CanvasBrowserViewportController<Id extends string> {
  constructor(
    private readonly viewport: HTMLElement,
    private readonly records: ReadonlyMap<Id, CanvasBrowserCardRecord<Id>>,
    private readonly scroll: CanvasBrowserScrollState,
  ) {}

  attachWheel(onWheel: (deltaY: number, deltaMode: number) => void) {
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onWheel(event.deltaY, event.deltaMode);
    };
    this.viewport.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    return () => this.viewport.removeEventListener("wheel", handleWheel, true);
  }

  height() {
    return this.viewport.clientHeight || this.viewport.getBoundingClientRect().height;
  }

  applyScroll(cardsLayer: HTMLElement, excludedId: Id | null) {
    cardsLayer.style.transform = `translate3d(0, ${-this.scroll.currentScrollY}px, 0)`;
    this.sync(excludedId);
  }

  sync(excludedId: Id | null = null) {
    const viewportHeight = this.height();
    for (const [id, record] of this.records) {
      if (id === excludedId) continue;
      if (viewportHeight <= 0) syncCanvasBrowserCardViewport(record, 0, record.height);
      else syncCanvasBrowserCardViewport(record, this.scroll.currentScrollY, viewportHeight);
    }
  }

  scrollCardIntoView(id: Id, order: readonly Id[]) {
    const index = order.indexOf(id);
    const record = this.records.get(id);
    const viewportHeight = this.height();
    if (index < 0 || !record || viewportHeight <= 0) return false;
    const top = canvasCardSlotTop(order, index, this.records);
    const bottom = top + record.height;
    const previousTarget = this.scroll.targetScrollY;
    if (top < this.scroll.currentScrollY) this.scroll.requestScrollPosition(top);
    else if (bottom > this.scroll.currentScrollY + viewportHeight) {
      this.scroll.requestScrollPosition(bottom - viewportHeight);
    }
    return this.scroll.targetScrollY !== previousTarget;
  }
}
