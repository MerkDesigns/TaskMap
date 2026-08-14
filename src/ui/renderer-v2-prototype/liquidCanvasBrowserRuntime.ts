import { Container, Glass, Group, Html, type Scene } from "@liquid-dom/core";
import {
  BENCHMARK_CARD_DRAG_THRESHOLD,
  BENCHMARK_CARD_SLOT_TRANSITION_MS,
  calculateCanvasCardInteractionCenter,
  calculateCanvasCardInsertionIndex,
  calculateCanvasCardAutoScroll,
  haveSameCanvasCardIds,
  reorderCanvasCardToIndex,
} from "./benchmarkCanvasCardInteraction";
import { BENCHMARK_CANVAS_BROWSER } from "./benchmarkCanvasBrowserLayout";
import { beginCanvasCardDragSession } from "./canvasCardDragSession";
import * as BrowserScroll from "./canvasBrowserScrollState";
import type { CanvasBrowserDiagnosticMode } from "./dev/canvasBrowserDiagnostics";
import { convertCanvasBrowserWheelDelta } from "./canvasBrowserWheelDelta";
import {
  CanvasBrowserRuntimeMetrics,
  CanvasCardDiagnosticPresentation,
} from "./dev/canvasCardDiagnosticPresentation";
import { CanvasCardPointerSession } from "./canvasCardPointerSession";
import * as CardGeometry from "./liquidCanvasCardGeometry";
import {
  reconcileLiquidCanvasCardRecords,
  removeLiquidCanvasCardRecords,
} from "./liquidCanvasCardFactory";
import type * as BrowserTypes from "./liquidCanvasBrowserTypes";
import { LiquidCanvasBrowserAppearance } from "./liquidCanvasBrowserAppearance";
import type { RendererV2MaterialControls } from "./rendererV2PanelMaterials";
import type { RendererV2PanelGeometry } from "./rendererV2PanelGeometry";
const cardWidth = BENCHMARK_CANVAS_BROWSER.width - BENCHMARK_CANVAS_BROWSER.cardInset * 2;
const bodyTop = BENCHMARK_CANVAS_BROWSER.y + BENCHMARK_CANVAS_BROWSER.headerHeight;
const cardFactories = {
  createGroup: () => new Group(),
  createGlass: (options: Record<string, number | boolean>) => new Glass(options),
  createHtml: (host: HTMLDivElement) => new Html({ element: host }),
};
export class LiquidCanvasBrowserRuntime {
  readonly browserHost = document.createElement("div");
  private readonly diagnostic = new CanvasCardDiagnosticPresentation();
  private readonly metrics = new CanvasBrowserRuntimeMetrics();
  readonly placeholderOverlay = this.diagnostic.placeholderOverlay;
  private readonly browserContainer: Container;
  private readonly browserGlass: Glass;
  private readonly browserContent: Html;
  private readonly cardsContainer: Container;
  private readonly scrollGroup: Group;
  private readonly cards = new Map<number, CardGeometry.LiquidCanvasCardRecord>();
  private readonly geometry = new CardGeometry.LiquidCanvasCardGeometry();
  private readonly pointerSession = new CanvasCardPointerSession();
  private readonly scroll = new BrowserScroll.CanvasBrowserScrollState();
  private readonly frameClock = new BrowserScroll.CanvasBrowserFrameClock();
  private readonly appearance = new LiquidCanvasBrowserAppearance();
  private viewportHeight = 0;
  private commitOrder: ((order: readonly number[]) => void) | null = null;
  private displayOrder: readonly number[] = [];
  private drag: BrowserTypes.CanvasCardDragState | null = null;
  private dragContainer: Container | null = null;
  private suppressedClickId: number | null = null;
  constructor(
    private readonly scene: Scene,
    private readonly invalidate: () => void,
  ) {
    this.browserHost.className = "renderer-benchmark__canvas-browser-host";
    this.browserContainer = scene.add(new Container(this.appearance.largePanelOptions(40)));
    this.browserGlass = this.browserContainer.add(
      new Glass({ cornerSmoothing: 0, pointerEvents: false }),
    );
    this.browserContent = this.browserGlass.add(new Html({ element: this.browserHost }));
    this.cardsContainer = scene.add(new Container(this.appearance.smallPanelOptions(60)));
    this.scrollGroup = this.cardsContainer.add(new Group());
  }
  resize(viewportHeight: number) {
    this.viewportHeight = viewportHeight;
    this.appearance.resizeSurface(
      this.browserGlass,
      this.browserContent,
      viewportHeight,
      this.cards.size,
    );
    this.commitScrollFrame(this.updateScrollRange());
    this.syncCardVisibility();
    this.invalidate();
  }
  reconcile(order: readonly number[]) {
    if (this.drag && !haveSameCanvasCardIds(order, this.drag.initialOrder)) {
      this.finishDragImmediately();
    }
    const cardSetChanged = reconcileLiquidCanvasCardRecords(
      this.cards,
      order,
      this.scrollGroup,
      cardWidth,
      this.diagnostic,
      cardFactories,
    );
    if (cardSetChanged) this.diagnostic.setMode(this.diagnostic.mode, this.cards);
    if (cardSetChanged) {
      this.appearance.resizeSurface(
        this.browserGlass,
        this.browserContent,
        this.viewportHeight,
        this.cards.size,
      );
      this.appearance.applyCardCornerRadius([...this.cards.values()].map(({ glass }) => glass));
    }
    this.displayOrder = this.drag?.order ?? [...order];
    this.commitScrollFrame(this.updateScrollRange());
    this.positionCards(this.displayOrder, 0, false);
    this.syncCardVisibility();
    this.invalidate();
  }
  setCanvasBrowserAppearance(
    materials: RendererV2MaterialControls,
    panelGeometry: RendererV2PanelGeometry,
    cardGap: number,
  ) {
    this.appearance.apply(materials, panelGeometry, cardGap, {
      browserContainer: this.browserContainer,
      cardsContainer: this.cardsContainer,
      dragContainer: this.dragContainer,
      browserGlass: this.browserGlass,
      cardGlasses: [...this.cards.values()].map(({ glass }) => glass),
      browserContent: this.browserContent,
      geometry: this.geometry,
      viewportHeight: this.viewportHeight,
      cardCount: this.cards.size,
    });
    this.commitScrollFrame(this.updateScrollRange());
    this.positionCards(this.displayOrder, 0, false);
    this.syncCardVisibility();
    this.invalidate();
  }
  setDiagnosticMode(mode: CanvasBrowserDiagnosticMode) {
    if (this.diagnostic.mode === mode) return;
    this.finishDragImmediately();
    this.diagnostic.setMode(mode, this.cards);
    this.syncCardVisibility();
    this.invalidate();
  }
  attachOrderCommit(commitOrder: (order: readonly number[]) => void) {
    this.commitOrder = commitOrder;
    return () => {
      if (this.commitOrder === commitOrder) this.commitOrder = null;
    };
  }
  scrollByWheel(deltaY: number, deltaMode: number) {
    this.scroll.requestWheelDelta(
      convertCanvasBrowserWheelDelta(deltaY, deltaMode, this.scrollViewportHeight()),
    );
    this.invalidate();
  }
  tick(now: number) {
    this.metrics.ticks += 1;
    const deltaTime = this.frameClock.tick(now);
    this.prepareDragForFrame();
    const dragScrollDelta = this.calculateDragAutoScroll();
    this.commitScrollFrame(this.scroll.tick(deltaTime, dragScrollDelta));
    if (this.geometry.tick(now, this.cards)) this.syncCardVisibility();
    this.tickDrag(now);
  }
  getScrollState() {
    return { ...this.scroll.snapshot(), scrollGroupY: this.scrollGroup.y };
  }
  isCardCaptureHostOnlyPaint = (event: Event) => this.diagnostic.isCardCaptureHostOnlyPaint(event);
  classifyCaptureSource = (source: unknown) =>
    this.diagnostic.classifyCaptureSource(source, this.browserContent.host);
  paintTouchesManagedCapture = (event: Event) =>
    this.diagnostic.paintTouchesManagedCapture(event, this.browserContent.host);
  getCardHost = (id: number) => this.cards.get(id)?.host ?? null;
  beginCardDrag(id: number, event: PointerEvent, element: HTMLElement) {
    const index = this.displayOrder.indexOf(id);
    if (event.button !== 0 || this.drag || index < 0) return false;
    this.suppressedClickId = null;
    const top = bodyTop + index * this.appearance.cardStep() - this.scroll.currentScrollY;
    return beginCanvasCardDragSession({
      id,
      event,
      element,
      displayOrder: this.displayOrder,
      cardTop: top,
      currentDrag: this.drag,
      pointerSession: this.pointerSession,
      getDrag: () => this.drag,
      setDrag: (drag) => (this.drag = drag),
      invalidate: this.invalidate,
    });
  }
  consumeSuppressedClick(id: number) {
    return this.suppressedClickId === id && ((this.suppressedClickId = null), true);
  }
  getCounts(): BrowserTypes.CanvasBrowserRuntimeCounts {
    return this.metrics.snapshot(
      this.diagnostic.features(),
      this.cards.size,
      2 + (this.dragContainer ? 1 : 0),
      this.geometry.syncCount,
    );
  }
  needsFrame() {
    return (
      this.scroll.currentScrollY !== this.scroll.targetScrollY ||
      this.drag !== null ||
      this.geometry.isAnimating()
    );
  }
  resetCounters() {
    this.geometry.resetSyncCount();
    this.metrics.reset();
  }
  destroy() {
    this.finishDragImmediately();
    removeLiquidCanvasCardRecords(this.cards);
    this.scrollGroup.remove();
    this.browserContent.remove();
    this.browserGlass.remove();
    this.browserContainer.remove();
    this.cardsContainer.remove();
    this.diagnostic.destroy();
  }
  private updateScrollRange() {
    return this.scroll.setRange(
      this.scrollViewportHeight(),
      this.appearance.scrollHeight(this.cards.size),
    );
  }
  private commitScrollFrame(frame: BrowserScroll.CanvasBrowserScrollFrame) {
    if (!frame.changed) return;
    this.scrollGroup.y = -frame.currentScrollY;
    this.metrics.scrollUpdates += 1;
    this.syncCardVisibility();
  }
  private scrollViewportHeight() {
    return Math.max(0, this.appearance.bodyBottom(this.viewportHeight, this.cards.size) - bodyTop);
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
    this.metrics.visibilitySyncs += 1;
    this.geometry.syncVisibility(
      this.displayOrder,
      this.cards,
      bodyTop,
      this.appearance.bodyBottom(this.viewportHeight, this.cards.size),
      this.scroll.currentScrollY,
      cardWidth,
      this.drag?.active ? this.drag.id : null,
    );
    this.metrics.visibleCards = this.diagnostic.syncPlaceholders(
      this.displayOrder,
      this.cards,
      this.scroll.currentScrollY,
      bodyTop,
      this.appearance.bodyBottom(this.viewportHeight, this.cards.size),
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
    this.dragContainer = this.scene.add(new Container(this.appearance.smallPanelOptions(80)));
    const currentTop =
      bodyTop +
      this.displayOrder.indexOf(drag.id) * this.appearance.cardStep() -
      this.scroll.currentScrollY;
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
      this.metrics.dragUpdates += 1;
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
      this.appearance.bodyBottom(this.viewportHeight, this.cards.size),
      BENCHMARK_CANVAS_BROWSER.cardHeight,
    );
    const targetIndex = calculateCanvasCardInsertionIndex(
      drag.order,
      drag.id,
      interactionCenter,
      bodyTop,
      this.scroll.currentScrollY,
      this.appearance.cardStep(),
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
      this.appearance.bodyBottom(this.viewportHeight, this.cards.size),
    );
  }
  private tickSnap(now: number) {
    const drag = this.drag;
    const record = drag ? this.cards.get(drag.id) : null;
    if (!drag || !record || drag.snapStartedAt === null) return;
    const target =
      bodyTop +
      drag.order.indexOf(drag.id) * this.appearance.cardStep() -
      this.scroll.currentScrollY;
    const progress = Math.min(1, (now - drag.snapStartedAt) / BENCHMARK_CARD_SLOT_TRANSITION_MS);
    record.glass.y =
      drag.snapFromY + (target - drag.snapFromY) * CardGeometry.easeOutQuart(progress);
    this.metrics.dragUpdates += 1;
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
