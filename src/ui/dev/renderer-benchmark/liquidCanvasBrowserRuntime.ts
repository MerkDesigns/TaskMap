import { Container, Glass, Group, Html, type Scene } from "@liquid-dom/core";
import { LIQUID_MATERIAL_OPTICS } from "../../materials/liquid-dom/materialRoles";
import {
  BENCHMARK_CARD_DRAG_THRESHOLD,
  BENCHMARK_CARD_SLOT_TRANSITION_MS,
  calculateCanvasCardAutoScroll,
  haveSameCanvasCardIds,
  reorderThroughCrossedCanvasCardSlots,
} from "./benchmarkCanvasCardInteraction";
import {
  BENCHMARK_CANVAS_BROWSER,
  canvasBrowserBodyBottom,
  calculateCanvasBrowserLayout,
} from "./benchmarkCanvasBrowserLayout";
import { LiquidCanvasCardGeometry } from "./liquidCanvasCardGeometry";
import type { CanvasBrowserRuntimeCounts, CanvasCardDragState } from "./liquidCanvasBrowserTypes";

interface CardRecord {
  readonly id: number;
  readonly group: Group;
  readonly glass: Glass;
  readonly content: Html;
  readonly host: HTMLDivElement;
}

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
  private readonly cards = new Map<number, CardRecord>();
  private readonly geometry = new LiquidCanvasCardGeometry();
  private viewportHeight = 0;
  private scrollTop = 0;
  private pendingScrollTop: number | null = null;
  private scrollElement: HTMLDivElement | null = null;
  private commitOrder: ((order: readonly number[]) => void) | null = null;
  private displayOrder: readonly number[] = [];
  private drag: CanvasCardDragState | null = null;
  private dragContainer: Container | null = null;
  private capturedElement: HTMLElement | null = null;
  private suppressedClickId: number | null = null;
  private scrollGroupTransformUpdates = 0;
  private dragTransformUpdates = 0;

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
      const content = glass.add(new Html({ element: host }));
      content.width = cardWidth;
      content.height = BENCHMARK_CANVAS_BROWSER.cardHeight;
      this.cards.set(id, { id, group, glass, content, host });
    }
    this.displayOrder = this.drag?.order ?? [...order];
    this.positionCards(this.displayOrder, 0, false);
    this.syncCardVisibility();
  }

  attachScrollElement(element: HTMLDivElement, commitOrder: (order: readonly number[]) => void) {
    this.scrollElement = element;
    this.commitOrder = commitOrder;
    this.queueScroll(element.scrollTop);
    return () => {
      if (this.scrollElement === element) this.scrollElement = null;
      if (this.commitOrder === commitOrder) this.commitOrder = null;
    };
  }

  queueScroll(scrollTop: number) {
    this.pendingScrollTop = Math.max(0, scrollTop);
  }

  scrollByWheel(deltaY: number, deltaMode: number) {
    const element = this.scrollElement;
    if (!element) return;
    const pixels =
      deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * element.clientHeight : deltaY;
    element.scrollTop += pixels;
    this.queueScroll(element.scrollTop);
  }

  tick(now: number) {
    this.flushScroll();
    this.geometry.tick(now, this.cards);
    this.tickDrag(now);
  }

  getCardHost(id: number) {
    return this.cards.get(id)?.host ?? null;
  }

  beginCardDrag(id: number, event: PointerEvent, element: HTMLElement) {
    if (event.button !== 0 || this.drag) return;
    const index = this.displayOrder.indexOf(id);
    if (index < 0) return;
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    this.capturedElement = element;
    const top = bodyTop + index * cardStep - this.scrollTop;
    this.drag = {
      id,
      pointerId: event.pointerId,
      startY: event.clientY,
      pointerY: event.clientY,
      pointerOffsetY: event.clientY - top,
      previousCenterY: top + BENCHMARK_CANVAS_BROWSER.cardHeight / 2,
      initialOrder: [...this.displayOrder],
      order: [...this.displayOrder],
      active: false,
      finish: null,
      snapStartedAt: null,
      snapFromY: top,
    };
    document.addEventListener("pointermove", this.onDocumentPointerMove);
    document.addEventListener("pointerup", this.onDocumentPointerUp);
    document.addEventListener("pointercancel", this.onDocumentPointerCancel);
  }

  consumeSuppressedClick(id: number) {
    const suppressed = this.suppressedClickId === id;
    if (suppressed) this.suppressedClickId = null;
    return suppressed;
  }

  getCounts(): CanvasBrowserRuntimeCounts {
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

  private flushScroll() {
    if (this.pendingScrollTop === null || this.pendingScrollTop === this.scrollTop) return;
    this.scrollTop = this.pendingScrollTop;
    this.pendingScrollTop = null;
    this.scrollGroup.y = -this.scrollTop;
    this.scrollGroupTransformUpdates += 1;
    this.syncCardVisibility();
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
      this.scrollTop,
      cardWidth,
      this.drag?.active ? this.drag.id : null,
    );
  }

  private readonly onDocumentPointerMove = (event: PointerEvent) => {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    this.drag.pointerY = event.clientY;
  };

  private endPointer(event: PointerEvent, finish: "commit" | "cancel") {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    this.drag.pointerY = event.clientY;
    this.drag.finish = finish;
    if (this.capturedElement?.hasPointerCapture(event.pointerId)) {
      this.capturedElement.releasePointerCapture(event.pointerId);
    }
    this.removeDocumentPointerListeners();
  }

  private readonly onDocumentPointerUp = (event: PointerEvent) => this.endPointer(event, "commit");
  private readonly onDocumentPointerCancel = (event: PointerEvent) =>
    this.endPointer(event, "cancel");

  private removeDocumentPointerListeners() {
    document.removeEventListener("pointermove", this.onDocumentPointerMove);
    document.removeEventListener("pointerup", this.onDocumentPointerUp);
    document.removeEventListener("pointercancel", this.onDocumentPointerCancel);
    this.capturedElement = null;
  }

  private activateDrag() {
    const drag = this.drag;
    if (!drag || drag.active) return;
    const record = this.cards.get(drag.id);
    if (!record) return;
    this.dragContainer = this.scene.add(
      new Container({ ...LIQUID_MATERIAL_OPTICS["small-panel"], spacing: 0, zIndex: 80 }),
    );
    const currentTop = bodyTop + this.displayOrder.indexOf(drag.id) * cardStep - this.scrollTop;
    record.glass.x = BENCHMARK_CANVAS_BROWSER.x + BENCHMARK_CANVAS_BROWSER.cardInset;
    record.glass.y = currentTop;
    record.glass.width = cardWidth;
    this.dragContainer.add(record.glass);
    drag.active = true;
    this.suppressedClickId = drag.id;
    drag.snapFromY = currentTop;
  }

  private tickDrag(now: number) {
    const drag = this.drag;
    if (!drag) return;
    if (!drag.active && Math.abs(drag.pointerY - drag.startY) >= BENCHMARK_CARD_DRAG_THRESHOLD) {
      this.activateDrag();
    }
    if (!drag.active) {
      if (drag.finish) this.drag = null;
      return;
    }
    if (drag.snapStartedAt !== null) {
      this.tickSnap(now);
      return;
    }

    const previousScrollTop = this.scrollTop;
    this.applyAutoScroll();
    this.flushScroll();
    const scrollDelta = this.scrollTop - previousScrollTop;
    const record = this.cards.get(drag.id);
    if (!record) return;
    const top = Math.min(
      Math.max(drag.pointerY - drag.pointerOffsetY, bodyTop),
      canvasBrowserBodyBottom(this.viewportHeight) - BENCHMARK_CANVAS_BROWSER.cardHeight,
    );
    if (record.glass.y !== top) {
      record.glass.y = top;
      this.dragTransformUpdates += 1;
    }
    const center = top + BENCHMARK_CANVAS_BROWSER.cardHeight / 2;
    const nextOrder = reorderThroughCrossedCanvasCardSlots(
      drag.order,
      drag.id,
      center,
      drag.previousCenterY - scrollDelta,
      bodyTop,
      this.scrollTop,
      cardStep,
    );
    drag.previousCenterY = center;
    if (nextOrder !== drag.order) {
      drag.order = nextOrder;
      this.displayOrder = nextOrder;
      this.positionCards(nextOrder, now, true);
      this.syncCardVisibility();
    }
    if (drag.finish) {
      if (drag.finish === "cancel") {
        drag.order = drag.initialOrder;
        this.displayOrder = drag.initialOrder;
        this.positionCards(drag.initialOrder, now, true);
      }
      drag.snapFromY = record.glass.y;
      drag.snapStartedAt = now;
    }
  }

  private applyAutoScroll() {
    if (!this.drag || !this.scrollElement) return;
    const delta = calculateCanvasCardAutoScroll(
      this.drag.pointerY,
      bodyTop,
      canvasBrowserBodyBottom(this.viewportHeight),
    );
    if (delta === 0) return;
    const previous = this.scrollElement.scrollTop;
    this.scrollElement.scrollTop += delta;
    if (this.scrollElement.scrollTop !== previous) this.queueScroll(this.scrollElement.scrollTop);
  }

  private tickSnap(now: number) {
    const drag = this.drag;
    const record = drag ? this.cards.get(drag.id) : null;
    if (!drag || !record || drag.snapStartedAt === null) return;
    const target = bodyTop + drag.order.indexOf(drag.id) * cardStep - this.scrollTop;
    const progress = Math.min(1, (now - drag.snapStartedAt) / BENCHMARK_CARD_SLOT_TRANSITION_MS);
    record.glass.y = drag.snapFromY + (target - drag.snapFromY) * easeOutQuart(progress);
    this.dragTransformUpdates += 1;
    if (progress < 1) return;
    const finalOrder = drag.order;
    const shouldCommit = drag.finish === "commit";
    record.glass.x = 0;
    record.glass.y = 0;
    record.group.y = bodyTop + finalOrder.indexOf(drag.id) * cardStep;
    record.group.add(record.glass);
    this.dragContainer?.remove();
    this.dragContainer = null;
    this.drag = null;
    this.syncCardVisibility();
    if (shouldCommit) this.commitOrder?.(finalOrder);
  }

  private finishDragImmediately() {
    const drag = this.drag;
    if (!drag) return;
    const record = this.cards.get(drag.id);
    if (record && this.dragContainer) {
      record.glass.x = 0;
      record.glass.y = 0;
      record.group.add(record.glass);
    }
    this.dragContainer?.remove();
    this.dragContainer = null;
    this.drag = null;
    this.removeDocumentPointerListeners();
  }
}
