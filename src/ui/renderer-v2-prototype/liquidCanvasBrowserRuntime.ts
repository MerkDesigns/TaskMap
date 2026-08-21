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
import { convertCanvasBrowserWheelDelta } from "./canvasBrowserWheelDelta";
import { CanvasCardPointerSession } from "./canvasCardPointerSession";
import * as CardGeometry from "./liquidCanvasCardGeometry";
import type { CanvasBrowserRuntimeInstrumentation } from "./liquidCanvasBrowserInstrumentation";
import {
  CanvasBrowserPresentationController,
  DefaultCanvasBrowserCardPresentation,
  type CanvasBrowserCardPresentation,
} from "./liquidCanvasBrowserPresentation";
import { reconcileLiquidCanvasCardRecords } from "./liquidCanvasCardFactory";
import type * as BrowserTypes from "./liquidCanvasBrowserTypes";
import { LiquidCanvasBrowserAppearance } from "./liquidCanvasBrowserAppearance";
import {
  createLiquidCanvasBrowserDragContainer,
  createLiquidCanvasBrowserScene,
  destroyLiquidCanvasBrowserScene,
  LIQUID_CANVAS_CARD_FACTORIES,
  type LiquidCanvasBrowserContainer,
  type LiquidCanvasBrowserScene,
  type LiquidCanvasBrowserSceneNodes,
} from "./liquidCanvasBrowserScene";
import type { RendererV2MaterialControls } from "./rendererV2PanelMaterials";
import type { RendererV2PanelGeometry } from "./rendererV2PanelGeometry";
const cardWidth = BENCHMARK_CANVAS_BROWSER.width - BENCHMARK_CANVAS_BROWSER.cardInset * 2;
const bodyTop = BENCHMARK_CANVAS_BROWSER.y + BENCHMARK_CANVAS_BROWSER.headerHeight;
export class LiquidCanvasBrowserRuntime<Id extends string = BrowserTypes.CanvasBrowserItemId> {
  readonly browserHost: HTMLDivElement;
  private readonly presentationController: CanvasBrowserPresentationController<Id>;
  private readonly nodes: LiquidCanvasBrowserSceneNodes;
  private readonly cards = new Map<Id, CardGeometry.LiquidCanvasCardRecord<Id>>();
  private readonly geometry: CardGeometry.LiquidCanvasCardGeometry<Id>;
  private readonly pointerSession = new CanvasCardPointerSession();
  private readonly scroll = new BrowserScroll.CanvasBrowserScrollState();
  private readonly frameClock = new BrowserScroll.CanvasBrowserFrameClock();
  private readonly appearance = new LiquidCanvasBrowserAppearance();
  private viewportHeight = 0;
  private commitOrder: ((order: readonly Id[]) => void) | null = null;
  private displayOrder: readonly Id[] = [];
  private drag: BrowserTypes.CanvasCardDragState<Id> | null = null;
  private dragContainer: LiquidCanvasBrowserContainer | null = null;
  private suppressedClickId: Id | null = null;
  constructor(
    private readonly scene: LiquidCanvasBrowserScene,
    private readonly invalidate: () => void,
    presentation: CanvasBrowserCardPresentation<Id> = new DefaultCanvasBrowserCardPresentation<Id>(),
    private readonly instrumentation?: CanvasBrowserRuntimeInstrumentation,
  ) {
    this.presentationController = new CanvasBrowserPresentationController(presentation);
    this.geometry = new CardGeometry.LiquidCanvasCardGeometry(instrumentation);
    this.nodes = createLiquidCanvasBrowserScene(scene, this.appearance);
    this.browserHost = this.nodes.browserHost;
  }
  resize(viewportHeight: number) {
    this.viewportHeight = viewportHeight;
    this.appearance.resizeSurface(
      this.nodes.browserGlass,
      this.nodes.browserContent,
      viewportHeight,
      this.cards.size,
    );
    this.commitScrollFrame(this.updateScrollRange());
    this.syncCardVisibility();
    this.invalidate();
  }
  reconcile(order: readonly Id[]) {
    if (this.drag && !haveSameCanvasCardIds(order, this.drag.initialOrder)) {
      this.finishDragImmediately();
    }
    const cardSetChanged = reconcileLiquidCanvasCardRecords(
      this.cards,
      order,
      this.nodes.scrollGroup,
      cardWidth,
      this.presentationController,
      LIQUID_CANVAS_CARD_FACTORIES,
    );
    if (cardSetChanged) this.presentationController.apply(this.cards);
    if (cardSetChanged) {
      this.appearance.resizeSurface(
        this.nodes.browserGlass,
        this.nodes.browserContent,
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
      browserContainer: this.nodes.browserContainer,
      cardsContainer: this.nodes.cardsContainer,
      dragContainer: this.dragContainer,
      browserGlass: this.nodes.browserGlass,
      cardGlasses: [...this.cards.values()].map(({ glass }) => glass),
      browserContent: this.nodes.browserContent,
      geometry: this.geometry,
      viewportHeight: this.viewportHeight,
      cardCount: this.cards.size,
    });
    this.commitScrollFrame(this.updateScrollRange());
    this.positionCards(this.displayOrder, 0, false);
    this.syncCardVisibility();
    this.invalidate();
  }
  refreshCardPresentation() {
    this.finishDragImmediately();
    this.presentationController.apply(this.cards);
    this.syncCardVisibility();
    this.invalidate();
  }
  attachOrderCommit(commitOrder: (order: readonly Id[]) => void) {
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
    this.instrumentation?.recordBrowserTick();
    const deltaTime = this.frameClock.tick(now);
    this.prepareDragForFrame();
    const dragScrollDelta = this.calculateDragAutoScroll();
    this.commitScrollFrame(this.scroll.tick(deltaTime, dragScrollDelta));
    if (this.geometry.tick(now, this.cards)) this.syncCardVisibility();
    this.tickDrag(now);
  }
  getScrollState() {
    return { ...this.scroll.snapshot(), scrollGroupY: this.nodes.scrollGroup.y };
  }
  isCardCaptureHostOnlyPaint = (event: Event) =>
    this.presentationController.isCardCaptureHostOnlyPaint(event);
  classifyCaptureSource = (source: unknown) =>
    this.presentationController.classifyCaptureSource(source, this.nodes.browserContent.host);
  paintTouchesManagedCapture = (event: Event) =>
    this.presentationController.paintTouchesManagedCapture(event, this.nodes.browserContent.host);
  getCardHost = (id: Id) => this.cards.get(id)?.host ?? null;
  beginCardDrag(id: Id, event: PointerEvent, element: HTMLElement) {
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
  consumeSuppressedClick(id: Id) {
    return this.suppressedClickId === id && ((this.suppressedClickId = null), true);
  }
  needsFrame() {
    return (
      this.scroll.currentScrollY !== this.scroll.targetScrollY ||
      this.drag !== null ||
      this.geometry.isAnimating()
    );
  }
  destroy() {
    this.finishDragImmediately();
    destroyLiquidCanvasBrowserScene(this.nodes, this.cards, this.presentationController);
  }
  private updateScrollRange() {
    return this.scroll.setRange(
      this.scrollViewportHeight(),
      this.appearance.scrollHeight(this.cards.size),
    );
  }
  private commitScrollFrame(frame: BrowserScroll.CanvasBrowserScrollFrame) {
    if (!frame.changed) return;
    this.nodes.scrollGroup.y = -frame.currentScrollY;
    this.instrumentation?.recordScrollGroupTransformUpdate();
    this.syncCardVisibility();
  }
  private scrollViewportHeight() {
    return Math.max(0, this.appearance.bodyBottom(this.viewportHeight, this.cards.size) - bodyTop);
  }
  private positionCards(order: readonly Id[], now: number, animate: boolean) {
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
    const visibleCards = this.geometry.syncVisibility(
      this.displayOrder,
      this.cards,
      bodyTop,
      this.appearance.bodyBottom(this.viewportHeight, this.cards.size),
      this.scroll.currentScrollY,
      cardWidth,
      this.drag?.active ? this.drag.id : null,
    );
    this.instrumentation?.recordCardVisibilitySync(visibleCards, this.cards.size);
    this.presentationController.sync(
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
    this.dragContainer = createLiquidCanvasBrowserDragContainer(this.scene, this.appearance);
    this.instrumentation?.recordDragContainerChange(true);
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
      this.instrumentation?.recordDragTransformUpdate();
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
    this.instrumentation?.recordDragTransformUpdate();
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
    this.instrumentation?.recordDragContainerChange(false);
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
    this.instrumentation?.recordDragContainerChange(false);
    this.drag = null;
    this.scroll.synchronizeTarget();
    this.suppressedClickId = null;
    this.pointerSession.release(drag.pointerId);
  }
}
