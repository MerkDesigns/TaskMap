import {
  CANVAS_CARD_DRAG_THRESHOLD,
  CANVAS_CARD_SLOT_TRANSITION_MS,
  calculateCanvasCardAutoScroll,
  calculateCanvasCardInsertionIndex,
  calculateCanvasCardInteractionCenter,
  easeOutQuart,
  haveSameCanvasCardIds,
  reorderCanvasCardToIndex,
} from "./canvasBrowserInteraction";
import { CANVAS_BROWSER_LAYOUT } from "./canvasBrowserLayout";
import { CanvasBrowserFrameClock, CanvasBrowserScrollState } from "./canvasBrowserScrollState";
import {
  createCanvasBrowserDragLayer,
  measureCanvasBrowserCard,
  reorderCanvasBrowserHosts,
  restoreSettledCardHost,
  writeCanvasBrowserContentHeight,
  writeDraggingCardHost,
  writeDraggingCardTop,
} from "./canvasBrowserDom";
import { CanvasCardPointerSession } from "./canvasCardPointerSession";
import {
  canvasCardContentHeight,
  canvasCardSlotTop,
  CanvasBrowserSlotGeometry,
} from "./canvasBrowserSlotGeometry";
import type {
  CanvasBrowserCardRecord,
  CanvasBrowserFrameDriver,
  CanvasBrowserRuntimeOptions,
  CanvasCardDragState,
} from "./canvasBrowserRuntimeTypes";
import { browserAnimationFrameDriver } from "./canvasBrowserRuntimeTypes";
import { convertCanvasBrowserWheelDelta } from "./canvasBrowserWheelDelta";
import { CanvasBrowserSharedGlass } from "./canvasBrowserSharedGlass";
import { CanvasBrowserViewportController } from "./canvasBrowserViewport";

export class CanvasBrowserRuntime<Id extends string> {
  private readonly records = new Map<Id, CanvasBrowserCardRecord<Id>>();
  private readonly pointerSession = new CanvasCardPointerSession();
  private readonly scroll = new CanvasBrowserScrollState();
  private readonly frameClock = new CanvasBrowserFrameClock();
  private readonly geometry = new CanvasBrowserSlotGeometry<Id>();
  private readonly viewport: CanvasBrowserViewportController<Id>;
  private readonly sharedGlass: CanvasBrowserSharedGlass<Id>;
  private readonly frameDriver: CanvasBrowserFrameDriver;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly detachWheelRouter: () => void;
  private displayOrder: readonly Id[] = [];
  private drag: CanvasCardDragState<Id> | null = null;
  private dragLayer: HTMLDivElement | null = null;
  private suppressedClickId: Id | null = null;
  private frameHandle: number | null = null;
  private reducedMotion: boolean;
  private commitOrder: (order: readonly Id[]) => void;

  constructor(private readonly options: CanvasBrowserRuntimeOptions<Id>) {
    this.frameDriver = options.frameDriver ?? browserAnimationFrameDriver;
    this.reducedMotion = options.reducedMotion ?? false;
    this.commitOrder = options.commitOrder;
    this.viewport = new CanvasBrowserViewportController(
      options.viewport,
      this.records,
      this.scroll,
    );
    this.sharedGlass = new CanvasBrowserSharedGlass(options.sharedSmallGlassPlane, this.records);
    this.resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => this.resize());
    this.resizeObserver?.observe(options.viewport);
    window.addEventListener("resize", this.resize);
    this.detachWheelRouter = this.viewport.attachWheel((deltaY, deltaMode) =>
      this.scrollByWheel(deltaY, deltaMode),
    );
  }

  setCommitOrder(commitOrder: (order: readonly Id[]) => void) {
    this.commitOrder = commitOrder;
  }

  setReducedMotion(reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
  }

  register(id: Id, host: HTMLDivElement, card: HTMLElement) {
    if (host.parentElement !== this.options.cardsLayer && this.drag?.id !== id) {
      this.options.cardsLayer.append(host);
    }
    const existing = this.records.get(id);
    const record = existing ?? { id, host, card, height: 0, y: 0 };
    record.card = card;
    measureCanvasBrowserCard(record);
    this.records.set(id, record);
  }

  reconcile(order: readonly Id[]) {
    if (this.drag && !haveSameCanvasCardIds(order, this.drag.initialOrder)) {
      this.finishDragImmediately();
    }
    for (const [id, record] of this.records) {
      if (!order.includes(id)) {
        record.host.remove();
        this.records.delete(id);
      }
    }
    this.records.forEach(measureCanvasBrowserCard);
    this.displayOrder = this.drag?.order ?? [...order];
    this.updateScrollRange();
    this.geometry.position(
      this.displayOrder,
      this.records,
      performance.now(),
      false,
      this.drag?.active ? this.drag.id : null,
    );
    if (!this.drag?.active) {
      reorderCanvasBrowserHosts(this.displayOrder, this.records, this.options.cardsLayer);
    }
    this.applyScroll();
    this.sharedGlass.sync(this.scroll.currentScrollY, this.drag?.active ? this.drag.id : null);
    this.options.invalidateMaterialGeometry();
  }

  resize = () => {
    this.records.forEach(measureCanvasBrowserCard);
    this.updateScrollRange();
    this.applyScroll();
    this.sharedGlass.sync(this.scroll.currentScrollY, this.drag?.active ? this.drag.id : null);
    this.options.invalidateMaterialGeometry();
  };

  scrollByWheel(deltaY: number, deltaMode: number) {
    this.scroll.requestWheelDelta(
      convertCanvasBrowserWheelDelta(deltaY, deltaMode, this.viewport.height()),
    );
    this.requestFrame();
  }

  scrollCardIntoView(id: Id) {
    if (this.viewport.scrollCardIntoView(id, this.displayOrder)) this.requestFrame();
  }

  beginDrag(id: Id, event: PointerEvent, element: HTMLElement) {
    const index = this.displayOrder.indexOf(id);
    const record = this.records.get(id);
    if (event.button !== 0 || this.drag || index < 0 || !record) return false;
    event.preventDefault();
    this.suppressedClickId = null;
    const rectangle = measureCanvasBrowserCard(record);
    this.drag = {
      id,
      pointerId: event.pointerId,
      startY: event.clientY,
      pointerY: event.clientY,
      pointerOffsetY: event.clientY - rectangle.top,
      initialOrder: [...this.displayOrder],
      order: [...this.displayOrder],
      cardHeight: record.height,
      active: false,
      finish: null,
      snapStartedAt: null,
      snapFromY: rectangle.top,
    };
    this.pointerSession.begin(
      element,
      event.pointerId,
      (pointerEvent) => this.updatePointer(pointerEvent),
      (pointerEvent, finish) => this.finishPointer(pointerEvent, finish),
    );
    this.requestFrame();
    return true;
  }

  consumeSuppressedClick(id: Id) {
    return this.suppressedClickId === id && ((this.suppressedClickId = null), true);
  }

  getSnapshot() {
    return {
      order: [...this.displayOrder],
      dragActive: this.drag?.active ?? false,
      scroll: this.scroll.snapshot(),
    };
  }

  destroy() {
    if (this.frameHandle !== null) this.frameDriver.cancel(this.frameHandle);
    this.frameHandle = null;
    this.finishDragImmediately();
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.resize);
    this.detachWheelRouter();
    this.sharedGlass.clear();
  }

  private updatePointer(event: PointerEvent) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    this.drag.pointerY = event.clientY;
    this.requestFrame();
  }

  private finishPointer(event: PointerEvent, finish: "commit" | "cancel") {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    this.drag.pointerY = event.clientY;
    if (this.drag.active) this.drag.finish = finish;
    else this.drag = null;
    this.pointerSession.release(event.pointerId);
    this.requestFrame();
  }

  private requestFrame() {
    if (this.frameHandle !== null) return;
    this.frameHandle = this.frameDriver.request(this.tick);
  }

  private readonly tick = (now: number) => {
    this.frameHandle = null;
    const deltaTime = this.frameClock.tick(now);
    this.prepareDrag();
    const autoScroll = this.dragAutoScroll();
    const scrollFrame = this.scroll.tick(deltaTime, autoScroll);
    let changed = scrollFrame.changed;
    if (scrollFrame.changed) this.applyScroll();
    if (this.geometry.tick(now, this.records, this.reducedMotion)) {
      this.viewport.sync();
      changed = true;
    }
    changed = this.tickDrag(now) || changed;
    if (changed) {
      this.sharedGlass.sync(this.scroll.currentScrollY, this.drag?.active ? this.drag.id : null);
      this.options.invalidateMaterialGeometry();
    }
    if (this.needsFrame()) this.requestFrame();
  };

  private prepareDrag() {
    if (
      this.drag &&
      !this.drag.active &&
      Math.abs(this.drag.pointerY - this.drag.startY) >= CANVAS_CARD_DRAG_THRESHOLD
    ) {
      this.activateDrag();
    }
  }

  private activateDrag() {
    const drag = this.drag;
    const record = drag ? this.records.get(drag.id) : null;
    if (!drag || !record || drag.active) return;
    const rectangle = record.card.getBoundingClientRect();
    this.geometry.cancel(drag.id);
    const panelRectangle = this.options.panel.getBoundingClientRect();
    this.dragLayer = createCanvasBrowserDragLayer(this.options.panel);
    this.dragLayer.append(record.host);
    writeDraggingCardHost(record, rectangle, panelRectangle);
    this.viewport.sync(drag.id);
    this.sharedGlass.sync(this.scroll.currentScrollY, drag.id);
    drag.active = true;
    drag.snapFromY = rectangle.top;
    this.scroll.synchronizeTarget();
    this.suppressedClickId = drag.id;
  }

  private tickDrag(now: number) {
    const drag = this.drag;
    const record = drag ? this.records.get(drag.id) : null;
    if (!drag?.active || !record) return false;
    if (drag.snapStartedAt !== null) return this.tickSnap(now, drag, record);

    const top =
      drag.pointerY - drag.pointerOffsetY - this.options.panel.getBoundingClientRect().top;
    writeDraggingCardTop(record, top);
    if (drag.finish) {
      if (drag.finish === "cancel") {
        drag.order = drag.initialOrder;
        this.displayOrder = drag.initialOrder;
        this.geometry.position(drag.initialOrder, this.records, now, true, drag.id);
      }
      this.scroll.synchronizeTarget();
      drag.snapFromY = top;
      drag.snapStartedAt = now;
      return true;
    }

    const { top: listTop, bottom: listBottom } = this.options.viewport.getBoundingClientRect();
    const center = calculateCanvasCardInteractionCenter(
      drag.pointerY,
      drag.pointerOffsetY,
      listTop,
      listBottom,
      drag.cardHeight,
    );
    const targetIndex = calculateCanvasCardInsertionIndex(
      drag.order,
      drag.id,
      center,
      listTop,
      this.scroll.currentScrollY,
      drag.cardHeight + CANVAS_BROWSER_LAYOUT.cardGap,
    );
    const nextOrder = reorderCanvasCardToIndex(drag.order, drag.id, targetIndex);
    if (nextOrder !== drag.order) {
      drag.order = nextOrder;
      this.displayOrder = nextOrder;
      this.geometry.position(nextOrder, this.records, now, true, drag.id);
    }
    return true;
  }

  private tickSnap(
    now: number,
    drag: CanvasCardDragState<Id>,
    record: CanvasBrowserCardRecord<Id>,
  ) {
    const index = drag.order.indexOf(drag.id);
    const target =
      this.options.viewport.getBoundingClientRect().top +
      canvasCardSlotTop(drag.order, index, this.records) -
      this.scroll.currentScrollY -
      this.options.panel.getBoundingClientRect().top;
    const progress = this.reducedMotion
      ? 1
      : Math.min(1, (now - (drag.snapStartedAt ?? now)) / CANVAS_CARD_SLOT_TRANSITION_MS);
    writeDraggingCardTop(
      record,
      drag.snapFromY + (target - drag.snapFromY) * easeOutQuart(progress),
    );
    if (progress < 1) return true;
    this.completeDrag(drag, record);
    return true;
  }

  private completeDrag(drag: CanvasCardDragState<Id>, record: CanvasBrowserCardRecord<Id>) {
    const finalOrder = drag.order;
    const changed = finalOrder.some((id, index) => id !== drag.initialOrder[index]);
    const shouldCommit = drag.finish === "commit" && changed;
    this.displayOrder = finalOrder;
    this.geometry.settle(finalOrder, this.records);
    this.options.cardsLayer.append(record.host);
    restoreSettledCardHost(record);
    reorderCanvasBrowserHosts(finalOrder, this.records, this.options.cardsLayer);
    this.dragLayer?.remove();
    this.dragLayer = null;
    this.scroll.synchronizeTarget();
    this.drag = null;
    this.suppressedClickId = null;
    this.pointerSession.release(drag.pointerId);
    this.updateScrollRange();
    this.viewport.sync();
    this.sharedGlass.sync(this.scroll.currentScrollY, null);
    if (shouldCommit) this.commitOrder(finalOrder);
  }

  private finishDragImmediately() {
    const drag = this.drag;
    const record = drag ? this.records.get(drag.id) : null;
    if (!drag) return;
    this.geometry.settle(this.displayOrder, this.records);
    if (record) {
      this.options.cardsLayer.append(record.host);
      restoreSettledCardHost(record);
    }
    this.dragLayer?.remove();
    this.dragLayer = null;
    this.drag = null;
    this.suppressedClickId = null;
    this.scroll.synchronizeTarget();
    this.pointerSession.release(drag.pointerId);
    this.viewport.sync();
    this.sharedGlass.sync(this.scroll.currentScrollY, null);
  }

  private dragAutoScroll() {
    if (!this.drag?.active || this.drag.finish || this.drag.snapStartedAt !== null)
      return undefined;
    const { top, bottom } = this.options.viewport.getBoundingClientRect();
    return calculateCanvasCardAutoScroll(this.drag.pointerY, top, bottom);
  }

  private needsFrame() {
    return (
      this.scroll.currentScrollY !== this.scroll.targetScrollY ||
      this.drag !== null ||
      this.geometry.isAnimating()
    );
  }

  private updateScrollRange() {
    const contentHeight = canvasCardContentHeight(this.displayOrder, this.records);
    writeCanvasBrowserContentHeight(this.options.panel, this.options.cardsLayer, contentHeight);
    this.scroll.setRange(this.viewport.height(), contentHeight);
  }

  private applyScroll() {
    this.viewport.applyScroll(this.options.cardsLayer, this.drag?.active ? this.drag.id : null);
  }
}
