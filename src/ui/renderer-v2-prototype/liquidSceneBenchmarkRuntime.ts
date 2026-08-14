import { Group, Html, Renderer, Scene, StackingContext } from "@liquid-dom/core";
import { LiquidCaptureAttribution, type LiquidCaptureOwner } from "./liquidCaptureAttribution";
import { installLiquidCaptureProbe, type LiquidCaptureProbe } from "./liquidCaptureProbe";
import { LiquidFrameWakeMetrics } from "./liquidFrameWakeMetrics";
import { BENCHMARK_LIQUID_MAX_DPR } from "./benchmarkWorld";
import { LiquidCanvasBrowserRuntime } from "./liquidCanvasBrowserRuntime";
import { LiquidDynamicCanvasRuntime, type DynamicGroupNode } from "./liquidDynamicCanvasRuntime";
import type { BenchmarkLiquidCounts } from "./benchmarkPresentation";
import type { BenchmarkSceneModel } from "./benchmarkTypes";
import type { DynamicElementClassification } from "./dynamicCanvasIslands";
import type { RendererV2MaterialControls } from "./rendererV2PanelMaterials";

function createDynamicCanvasFactories(scene: Scene) {
  return {
    createGroup: (parent: DynamicGroupNode, options: { x: number; y: number }) =>
      (parent as Group).add(new Group(options)),
    createHtml: (parent: DynamicGroupNode, host: HTMLDivElement, zIndex: number) =>
      (parent as Group).add(new Html({ element: host, zIndex })),
    createStackingContext: (options: {
      zIndex: number;
      x: number;
      y: number;
      scaleX: number;
      scaleY: number;
    }) => scene.add(new StackingContext(options)),
  };
}

export class LiquidSceneBenchmarkRuntime {
  readonly canvas: HTMLCanvasElement;
  readonly coarseHost = document.createElement("div");
  readonly canvasBrowserHost: HTMLDivElement;
  readonly canvasBrowserPlaceholderOverlay: HTMLDivElement;
  private readonly scene = new Scene();
  private readonly renderer: Renderer;
  private readonly backdropNode: Html;
  private readonly browser: LiquidCanvasBrowserRuntime;
  private readonly dynamicCanvas: LiquidDynamicCanvasRuntime;
  private probe: LiquidCaptureProbe | null = null;
  private frameRequestListener: ((reason: "capture-completion" | "mutation") => boolean) | null =
    null;
  private dirty = true;
  private readonly captureAttribution = new LiquidCaptureAttribution();
  private readonly frameWakes = new LiquidFrameWakeMetrics();
  private rendererRenderCalls = 0;
  private rateSample = createRateSample();
  private rates = emptyRates();
  private readonly handleLiquidPaint = (event: Event) => {
    // Liquid mirrors scene transforms onto its capture hosts. Host-only paint events do not mean
    // the card DOM changed, so retain the already-copied texture instead of recapturing it.
    if (
      this.browser.isCardCaptureHostOnlyPaint(event) ||
      this.dynamicCanvas.isCaptureHostOnlyPaint(event)
    ) {
      this.frameWakes.recordFilteredTransformPaint();
      event.stopImmediatePropagation();
      return;
    }
    if (!this.paintTouchesManagedCapture(event)) return;
    // DOM capture completes asynchronously. Its texture copy needs a following Liquid render even
    // when the on-demand loop had already become idle after the scene geometry was submitted.
    this.requestFrame("capture-completion");
  };

  constructor(
    private readonly reportCapture: (width: number | null, height: number | null) => void,
  ) {
    this.coarseHost.className = "renderer-benchmark__coarse-host";
    this.backdropNode = this.scene.add(new Html({ element: this.coarseHost, zIndex: 0 }));
    this.browser = new LiquidCanvasBrowserRuntime(this.scene, () => this.requestFrame());
    this.dynamicCanvas = new LiquidDynamicCanvasRuntime(
      () => this.requestFrame(),
      createDynamicCanvasFactories(this.scene),
    );
    this.canvasBrowserHost = this.browser.browserHost;
    this.canvasBrowserPlaceholderOverlay = this.browser.placeholderOverlay;
    this.renderer = new Renderer({ scene: this.scene, maxDpr: BENCHMARK_LIQUID_MAX_DPR });
    this.canvas = this.renderer.canvas;
    this.canvas.className = "renderer-benchmark__liquid-canvas";
    this.canvas.addEventListener("paint", this.handleLiquidPaint, true);
  }

  resize(width: number, height: number) {
    this.backdropNode.width = width;
    this.backdropNode.height = height;
    this.browser.resize(height);
    this.requestFrame();
  }

  reconcile(scene: BenchmarkSceneModel) {
    this.browser.reconcile(scene.canvasCardOrder);
    this.requestFrame();
  }

  reconcileDynamicElements(classifications: readonly DynamicElementClassification[]) {
    return this.dynamicCanvas.reconcile(classifications);
  }

  presentDynamicCamera(camera: BenchmarkSceneModel["camera"]) {
    this.dynamicCanvas.presentCamera(camera);
  }

  presentDynamicElementPosition(id: string, x: number, y: number) {
    this.dynamicCanvas.presentElementPosition(id, x, y);
  }

  syncDynamicElement(element: BenchmarkSceneModel["elements"][number]) {
    this.dynamicCanvas.syncElement(element);
  }

  hasDynamicElement(id: string) {
    return this.dynamicCanvas.hasElement(id);
  }

  getDynamicElementHost(id: string) {
    return this.dynamicCanvas.getHost(id);
  }

  setCanvasBrowserDiagnosticMode(
    mode: import("./canvasBrowserDiagnostics").CanvasBrowserDiagnosticMode,
  ) {
    this.browser.setDiagnosticMode(mode);
  }

  setCanvasBrowserAppearance(materials: RendererV2MaterialControls, cardGap: number) {
    this.browser.setCanvasBrowserAppearance(materials, cardGap);
    this.requestFrame();
  }

  attachCanvasBrowserOrderCommit(commitOrder: (order: readonly number[]) => void) {
    return this.browser.attachOrderCommit(commitOrder);
  }

  scrollCanvasBrowserByWheel(deltaY: number, deltaMode: number) {
    this.browser.scrollByWheel(deltaY, deltaMode);
  }

  getCanvasBrowserScrollState() {
    return this.browser.getScrollState();
  }

  setFrameRequestListener(
    listener: ((reason: "capture-completion" | "mutation") => boolean) | null,
  ) {
    this.frameRequestListener = listener;
    if (listener && this.dirty) listener("mutation");
  }

  needsFrame() {
    return this.dirty || this.browser.needsFrame();
  }

  invalidateFrame() {
    this.requestFrame();
  }

  setCaptureInstrumentation(enabled: boolean) {
    if (enabled && !this.probe) {
      this.probe = installLiquidCaptureProbe(({ width, height, source }) => {
        this.reportCapture(width, height);
        const classification = this.classifyCaptureSource(source);
        this.captureAttribution.record(
          classification.owner,
          width,
          height,
          classification.positionOnly,
        );
      });
    } else if (!enabled && this.probe) {
      this.probe.dispose();
      this.probe = null;
    }
  }

  tick(now: number) {
    this.frameWakes.beginFrame();
    this.browser.tick(now);
    // Work submitted by this tick is covered by the render below. Invalidation raised from inside
    // render (including synchronous paint/capture work) must survive for a follow-up frame.
    this.dirty = false;
    this.renderer.render();
    this.rendererRenderCalls += 1;
  }

  getCanvasCardHost(id: number) {
    return this.browser.getCardHost(id);
  }

  beginCanvasCardDrag(id: number, event: PointerEvent, element: HTMLElement) {
    return this.browser.beginCardDrag(id, event, element);
  }

  consumeSuppressedCanvasCardClick(id: number) {
    return this.browser.consumeSuppressedClick(id);
  }

  getCounts(): BenchmarkLiquidCounts {
    const counts = this.browser.getCounts();
    const dynamicCounts = this.dynamicCanvas.getCounts();
    this.updateRates(counts);
    return {
      html: 1 + counts.html + dynamicCounts.promotedElementCount,
      containers: counts.containers,
      glassShapes: counts.glassShapes,
      cardGeometrySyncs: counts.cardGeometrySyncs,
      scrollGroupTransformUpdates: counts.scrollGroupTransformUpdates,
      dragTransformUpdates: counts.dragTransformUpdates,
      visibleCanvasCards: counts.visibleCardCount,
      totalCanvasCards: counts.totalCardCount,
      rendererRenderCallsPerSecond: this.rates.renderer,
      browserRuntimeTicksPerSecond: this.rates.browserTicks,
      scrollGroupTransformUpdatesPerSecond: this.rates.scrollUpdates,
      cardVisibilitySyncsPerSecond: this.rates.visibilitySyncs,
      ...dynamicCounts,
      ...this.captureAttribution.snapshot(),
      ...this.frameWakes.snapshot(),
      rafRequestTotal: 0,
      coalescedRafRequestTotal: 0,
      rafRequestsPerSecond: 0,
      coalescedRafRequestsPerSecond: 0,
      captureAvailable: this.probe?.available ?? false,
    };
  }

  resetCounters() {
    this.browser.resetCounters();
    this.dynamicCanvas.resetCounters();
    this.rendererRenderCalls = 0;
    this.rateSample = createRateSample();
    this.rates = emptyRates();
    this.captureAttribution.reset();
    this.frameWakes.reset();
  }

  destroy() {
    this.browser.destroy();
    this.dynamicCanvas.destroy();
    this.canvas.removeEventListener("paint", this.handleLiquidPaint, true);
    this.backdropNode.remove();
    this.renderer.destroy();
    this.probe?.dispose();
    this.probe = null;
    this.frameRequestListener = null;
  }

  private requestFrame(reason: "capture-completion" | "mutation" = "mutation") {
    this.dirty = true;
    const scheduled = this.frameRequestListener?.(reason) ?? null;
    this.frameWakes.recordInvalidation(reason, scheduled);
  }

  private classifyCaptureSource(source: unknown): {
    owner: LiquidCaptureOwner;
    positionOnly: boolean;
  } {
    if (source === this.backdropNode.host) return { owner: "coarse", positionOnly: false };
    const dynamic = this.dynamicCanvas.classifyCaptureSource(source);
    if (dynamic) return { owner: "dynamic", positionOnly: dynamic.positionOnly };
    return {
      owner: this.browser.classifyCaptureSource(source) ?? "other",
      positionOnly: false,
    };
  }

  private paintTouchesManagedCapture(event: Event) {
    const changedElements = (event as Event & { changedElements?: unknown }).changedElements;
    if (!Array.isArray(changedElements)) return true;
    const backdropHost = this.backdropNode.host;
    return (
      changedElements.some(
        (element) =>
          element instanceof Element &&
          (element === backdropHost || backdropHost.contains(element)),
      ) ||
      this.dynamicCanvas.paintTouchesCapture(event) ||
      this.browser.paintTouchesManagedCapture(event)
    );
  }

  private updateRates(counts: ReturnType<LiquidCanvasBrowserRuntime["getCounts"]>) {
    const now = performance.now();
    const elapsed = now - this.rateSample.at;
    if (elapsed < 100) return;
    const scale = 1_000 / elapsed;
    this.rates = {
      renderer: (this.rendererRenderCalls - this.rateSample.renderer) * scale,
      browserTicks: (counts.browserRuntimeTicks - this.rateSample.browserTicks) * scale,
      scrollUpdates: (counts.scrollGroupTransformUpdates - this.rateSample.scrollUpdates) * scale,
      visibilitySyncs: (counts.cardVisibilitySyncs - this.rateSample.visibilitySyncs) * scale,
    };
    this.rateSample = {
      at: now,
      renderer: this.rendererRenderCalls,
      browserTicks: counts.browserRuntimeTicks,
      scrollUpdates: counts.scrollGroupTransformUpdates,
      visibilitySyncs: counts.cardVisibilitySyncs,
    };
  }
}

function createRateSample() {
  return {
    at: performance.now(),
    renderer: 0,
    browserTicks: 0,
    scrollUpdates: 0,
    visibilitySyncs: 0,
  };
}

function emptyRates() {
  return { renderer: 0, browserTicks: 0, scrollUpdates: 0, visibilitySyncs: 0 };
}
