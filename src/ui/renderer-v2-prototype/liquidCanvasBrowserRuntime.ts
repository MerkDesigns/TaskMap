import { Container, Glass, Group, Html, type Scene } from "@liquid-dom/core";
import { LIQUID_MATERIAL_OPTICS } from "../materials/liquid-dom/materialRoles";
import {
  BENCHMARK_CARD_DRAG_THRESHOLD,
  BENCHMARK_CARD_SLOT_TRANSITION_MS,
  calculateCanvasCardInteractionCenter,
  calculateCanvasCardInsertionIndex,
  calculateCanvasCardAutoScroll,
  haveSameCanvasCardIds,
  reorderCanvasCardToIndex,
} from "./benchmarkCanvasCardInteraction";
import {
  BENCHMARK_CANVAS_BROWSER,
  canvasBrowserBodyBottom,
  canvasBrowserScrollHeight,
  calculateCanvasBrowserLayout,
} from "./benchmarkCanvasBrowserLayout";
import * as BrowserScroll from "./canvasBrowserScrollState";
import { CanvasCardPointerSession } from "./canvasCardPointerSession";
import * as CardGeometry from "./liquidCanvasCardGeometry";
import type * as BrowserTypes from "./liquidCanvasBrowserTypes";

const cardStep = BENCHMARK_CANVAS_BROWSER.cardHeight + BENCHMARK_CANVAS_BROWSER.cardGap;
const cardWidth = BENCHMARK_CANVAS_BROWSER.width - BENCHMARK_CANVAS_BROWSER.cardInset * 2;
const bodyTop = BENCHMARK_CANVAS_BROWSER.y + BENCHMARK_CANVAS_BROWSER.headerHeight;
const easeOutQuart = (progress: number) => 1 - (1 - progress) ** 4;
export class LiquidCanvasBrowserRuntime {
  readonly browserHost = document.createElement("div");
  private readonly browserContainer: Container;
  private readonly browserGlass: Glass;
  private readonly browserContent: Html;
  private readonly cardsContainer: Container;
  private readonly scrollGroup: Group;
  private readonly cards = new Map<number, CardGeometry.LiquidCanvasCardRecord>();
  private readonly geometry = new CardGeometry.LiquidCanvasCardGeometry();
  private readonly pointerSession = new CanvasCardPointerSession();
  private readonly scroll = new BrowserScroll.CanvasBrowserScrollState();
  private viewportHeight = 0;
  private commitOrder: ((order: readonly number[]) => void) | null = null;
  private displayOrder: readonly number[] = [];
  private drag: BrowserTypes.CanvasCardDragState | null = null;
  private dragContainer: Container | null = null;
  private suppressedClickId: number | null = null;
  private scrollGroupTransformUpdates = 0;
  private dragTransformUpdates = 0;
  private previousTickAt: number | null = null;

  constructor(private readonly scene: Scene) {
    this.browserHost.className = "renderer-benchmark__canvas-browser-host";
    this.browserContainer = scene.add(
      new Container({ ...LIQUID_MATERIAL_OPTICS["large-panel"], zIndex: 40 }),
    );
    this.browserGlass = this.browserContainer.add(
      new Glass({ cornerSmoothing: 0, pointerEvents: false }),
    );
    this.browserContent = this.browserGlass.add(new Html({ element: this.browserHost }));
    this.cardsContainer = scene.add(
      new Container({ ...LIQUID_MATERIAL_OPTICS["small-panel"], spacing: 0, zIndex: 60 }),
    );
    this.scrollGroup = this.cardsContainer.add(new Group());
  }
  resize(viewportHeight: number) {
    this.viewportHeight = viewportHeight;
    const layout = calculateCanvasBrowserLayout(viewportHeight, this.cards.size, 0);
    Object.assign(this.browserGlass, {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
      cornerRadius: BENCHMARK_CANVAS_BROWSER.cornerRadius,
    });
    this.browserContent.width = layout.width;
    this.browserContent.height = layout.height;
    this.commitScrollFrame(this.updateScrollRange());
    this.syncCardVisibility();
  }
  reconcile(order: readonly number[]) {
    if (this.drag && !haveSameCanvasCardIds(order, this.drag.initialOrder)) {
      this.finishDragImmediately();
    }
    const ids = new Set(order);
    for (const [id, record] of this.cards) {
      if (ids.has(id)) continue;
      record.content.remove();
      record.glass.remove();
      record.group.remove();
      this.cards.delete(id);
    }
    for (const id of order) {
      if (this.cards.has(id)) continue;
      const group = this.scrollGroup.add(new Group());
      const glass = group.add(
        new Glass({
          width: cardWidth,
          height: BENCHMARK_CANVAS_BROWSER.cardHeight,
          cornerRadius: BENCHMARK_CANVAS_BROWSER.cardCornerRadius,
          cornerSmoothing: 0,
          pointerEvents: false,
        }),
      );
      const host = document.createElement("div");
      host.className = "renderer-benchmark__canvas-card-host";
      host.style.width = `${cardWidth}px`;
      host.style.height = `${BENCHMARK_CANVAS_BROWSER.cardHeight}px`;
      const content = glass.add(new Html({ element: host }));
      content.width = cardWidth;
      content.height = BENCHMARK_CANVAS_BROWSER.cardHeight;
      this.cards.set(id, { id, group, glass, content, host });
    }
    this.displayOrder = this.drag?.order ?? [...order];
    this.commitScrollFrame(this.updateScrollRange());
    this.positionCards(this.displayOrder, 0, false);
    this.syncCardVisibility();
  }
  attachOrderCommit(commitOrder: (order: readonly number[]) => void) {
    this.commitOrder = commitOrder;
    return () => {
      if (this.commitOrder === commitOrder) this.commitOrder = null;
    };
  }
  scrollByWheel(deltaY: number, deltaMode: number) {
    const pixels =
      deltaMode === 1
        ? deltaY * 16
        : deltaMode === 2
          ? deltaY * this.scrollViewportHeight()
          : deltaY;
    this.scroll.requestWheelDelta(pixels);
  }
  tick(now: number) {
    const deltaTime =
      this.previousTickAt === null ? 16 : Math.max(0, Math.min(64, now - this.previousTickAt));
    this.previousTickAt = now;
    this.prepareDragForFrame();
    const dragScrollDelta = this.calculateDragAutoScroll();
    this.commitScrollFrame(this.scroll.tick(deltaTime, dragScrollDelta));
    if (this.geometry.tick(now, this.cards)) this.syncCardVisibility();
    this.tickDrag(now);
  }
  getScrollState() {
    return { ...this.scroll.snapshot(), scrollGroupY: this.scrollGroup.y };
  }
  getCardHost(id: number) {
    return this.cards.get(id)?.host ?? null;
  }
  beginCardDrag(id: number, event: PointerEvent, element: HTMLElement) {
    if (event.button !== 0 || this.drag) return false;
    const index = this.displayOrder.indexOf(id);
    if (index < 0) return false;
    this.suppressedClickId = null;
    event.preventDefault();
    const top = bodyTop + index * cardStep - this.scroll.currentScrollY;
    this.drag = {
      id,
      pointerId: event.pointerId,
      startY: event.clientY,
      pointerY: event.clientY,
      pointerOffsetY: event.clientY - top,
      initialOrder: [...this.displayOrder],
      order: [...this.displayOrder],
      active: false,
      finish: null,
      snapStartedAt: null,
      snapFromY: top,
    };
    this.pointerSession.begin(
      element,
      event.pointerId,
      (pointerEvent) => {
        if (!this.drag || this.drag.pointerId !== pointerEvent.pointerId) return;
        pointerEvent.preventDefault();
        this.drag.pointerY = pointerEvent.clientY;
      },
      (pointerEvent, finish) => {
        if (!this.drag || this.drag.pointerId !== pointerEvent.pointerId) return;
        this.drag.pointerY = pointerEvent.clientY;
        if (this.drag.active) this.drag.finish = finish;
        else this.drag = null;
        this.pointerSession.release(pointerEvent.pointerId);
      },
    );
    return true;
  }
  consumeSuppressedClick(id: number) {
    const suppressed = this.suppressedClickId === id;
    if (suppressed) this.suppressedClickId = null;
    return suppressed;
  }
  getCounts(): BrowserTypes.CanvasBrowserRuntimeCounts {
    return {
      html: 1 + this.cards.size,
      containers: 2 + (this.dragContainer ? 1 : 0),
      glassShapes: 1 + this.cards.size,
      cardGeometrySyncs: this.geometry.syncCount,
      scrollGroupTransformUpdates: this.scrollGroupTransformUpdates,
      dragTransformUpdates: this.dragTransformUpdates,
    };
  }
  resetCounters() {
    this.geometry.resetSyncCount();
    this.scrollGroupTransformUpdates = 0;
    this.dragTransformUpdates = 0;
  }
  destroy() {
    this.finishDragImmediately();
    this.cards.forEach(({ content, glass, group }) => {
      content.remove();
      glass.remove();
      group.remove();
    });
    this.scrollGroup.remove();
    this.browserContent.remove();
    this.browserGlass.remove();
    this.browserContainer.remove();
    this.cardsContainer.remove();
  }
  private updateScrollRange() {
    return this.scroll.setRange(this.scrollViewportHeight(), this.scrollContentHeight());
  }

  private commitScrollFrame(frame: BrowserScroll.CanvasBrowserScrollFrame) {
    if (!frame.changed) return;
    this.scrollGroup.y = -frame.currentScrollY;
    this.scrollGroupTransformUpdates += 1;
    this.syncCardVisibility();
  }

  private scrollViewportHeight() {
    return Math.max(0, canvasBrowserBodyBottom(this.viewportHeight) - bodyTop);
  }

  private scrollContentHeight() {
    return canvasBrowserScrollHeight(this.cards.size);
  }

  private positionCards(order: readonly number[], now: number, animate: boolean) {
    this.geometry.position(
      order,
      this.cards,
      bodyTop,
      now,
      animate,
      this.drag?.active ? this.drag.id : null,
    );
  }

  private syncCardVisibility() {
    this.geometry.syncVisibility(
      this.displayOrder,
      this.cards,
      bodyTop,
      canvasBrowserBodyBottom(this.viewportHeight),
      this.scroll.currentScrollY,
      cardWidth,
      this.drag?.active ? this.drag.id : null,
    );
  }

  private activateDrag() {
    const drag = this.drag;
    if (!drag || drag.active) return;
    const record = this.cards.get(drag.id);
    if (!record) return;
    this.geometry.cancel(drag.id);
    this.dragContainer = this.scene.add(
      new Container({ ...LIQUID_MATERIAL_OPTICS["small-panel"], spacing: 0, zIndex: 80 }),
    );
    const currentTop =
      bodyTop + this.displayOrder.indexOf(drag.id) * cardStep - this.scroll.currentScrollY;
    record.glass.x = BENCHMARK_CANVAS_BROWSER.x + BENCHMARK_CANVAS_BROWSER.cardInset;
    record.glass.y = currentTop;
    this.geometry.resetFullCardViewport(record, cardWidth);
    this.dragContainer.add(record.glass);
    drag.active = true;
    this.scroll.synchronizeTarget();
    this.suppressedClickId = drag.id;
    drag.snapFromY = currentTop;
  }

  private prepareDragForFrame() {
    const drag = this.drag;
    if (!drag) return;
    if (!drag.active && Math.abs(drag.pointerY - drag.startY) >= BENCHMARK_CARD_DRAG_THRESHOLD) {
      this.activateDrag();
    }
  }

  private tickDrag(now: number) {
    const drag = this.drag;
    if (!drag) return;
    if (!drag.active) return;
    if (drag.snapStartedAt !== null) {
      this.tickSnap(now);
      return;
    }

    const record = this.cards.get(drag.id);
    if (!record) return;
    const top = drag.pointerY - drag.pointerOffsetY;
    if (record.glass.y !== top) {
      record.glass.y = top;
      this.dragTransformUpdates += 1;
    }
    if (drag.finish) {
      if (drag.finish === "cancel") {
        drag.order = drag.initialOrder;
        this.displayOrder = drag.initialOrder;
        this.positionCards(drag.initialOrder, now, true);
      }
      this.scroll.synchronizeTarget();
      drag.snapFromY = record.glass.y;
      drag.snapStartedAt = now;
      return;
    }

    const interactionCenter = calculateCanvasCardInteractionCenter(
      drag.pointerY,
      drag.pointerOffsetY,
      bodyTop,
      canvasBrowserBodyBottom(this.viewportHeight),
      BENCHMARK_CANVAS_BROWSER.cardHeight,
    );
    const targetIndex = calculateCanvasCardInsertionIndex(
      drag.order,
      drag.id,
      interactionCenter,
      bodyTop,
      this.scroll.currentScrollY,
      cardStep,
    );
    const nextOrder = reorderCanvasCardToIndex(drag.order, drag.id, targetIndex);
    if (nextOrder !== drag.order) {
      drag.order = nextOrder;
      this.displayOrder = nextOrder;
      this.positionCards(nextOrder, now, true);
      this.syncCardVisibility();
    }
  }

  private calculateDragAutoScroll() {
    if (!this.drag?.active || this.drag.finish || this.drag.snapStartedAt !== null)
      return undefined;
    return calculateCanvasCardAutoScroll(
      this.drag.pointerY,
      bodyTop,
      canvasBrowserBodyBottom(this.viewportHeight),
    );
  }

  private tickSnap(now: number) {
    const drag = this.drag;
    const record = drag ? this.cards.get(drag.id) : null;
    if (!drag || !record || drag.snapStartedAt === null) return;
    const target = bodyTop + drag.order.indexOf(drag.id) * cardStep - this.scroll.currentScrollY;
    const progress = Math.min(1, (now - drag.snapStartedAt) / BENCHMARK_CARD_SLOT_TRANSITION_MS);
    record.glass.y = drag.snapFromY + (target - drag.snapFromY) * easeOutQuart(progress);
    this.dragTransformUpdates += 1;
    if (progress < 1) return;
    const finalOrder = drag.order;
    const shouldCommit = drag.finish === "commit";
    this.displayOrder = finalOrder;
    this.geometry.settle(finalOrder, this.cards, bodyTop);
    record.glass.x = 0;
    record.glass.y = 0;
    this.geometry.resetFullCardViewport(record, cardWidth);
    record.group.add(record.glass);
    this.dragContainer?.remove();
    this.dragContainer = null;
    this.scroll.synchronizeTarget();
    this.drag = null;
    this.suppressedClickId = null;
    this.pointerSession.release(drag.pointerId);
    this.syncCardVisibility();
    if (shouldCommit) this.commitOrder?.(finalOrder);
  }

  private finishDragImmediately() {
    const drag = this.drag;
    if (!drag) return;
    const record = this.cards.get(drag.id);
    this.geometry.settle(this.displayOrder, this.cards, bodyTop);
    if (record && this.dragContainer) {
      record.glass.x = 0;
      record.glass.y = 0;
      this.geometry.resetFullCardViewport(record, cardWidth);
      record.group.add(record.glass);
    }
    this.dragContainer?.remove();
    this.dragContainer = null;
    this.drag = null;
    this.scroll.synchronizeTarget();
    this.suppressedClickId = null;
    this.pointerSession.release(drag.pointerId);
  }
}
