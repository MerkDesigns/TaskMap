import { Html, Renderer, Scene } from "@liquid-dom/core";
import { installLiquidCaptureProbe, type LiquidCaptureProbe } from "./liquidCaptureProbe";
import { BENCHMARK_LIQUID_MAX_DPR } from "./benchmarkWorld";
import { LiquidCanvasBrowserRuntime } from "./liquidCanvasBrowserRuntime";
import type { BenchmarkLiquidCounts } from "./benchmarkPresentation";
import type { BenchmarkSceneModel } from "./benchmarkTypes";

export class LiquidSceneBenchmarkRuntime {
  readonly canvas: HTMLCanvasElement;
  readonly coarseHost = document.createElement("div");
  readonly canvasBrowserHost: HTMLDivElement;
  private readonly scene = new Scene();
  private readonly renderer: Renderer;
  private readonly backdropNode: Html;
  private readonly browser: LiquidCanvasBrowserRuntime;
  private probe: LiquidCaptureProbe | null = null;

  constructor(
    private readonly reportCapture: (width: number | null, height: number | null) => void,
  ) {
    this.coarseHost.className = "renderer-benchmark__coarse-host";
    this.backdropNode = this.scene.add(new Html({ element: this.coarseHost, zIndex: 0 }));
    this.browser = new LiquidCanvasBrowserRuntime(this.scene);
    this.canvasBrowserHost = this.browser.browserHost;
    this.renderer = new Renderer({ scene: this.scene, maxDpr: BENCHMARK_LIQUID_MAX_DPR });
    this.canvas = this.renderer.canvas;
    this.canvas.className = "renderer-benchmark__liquid-canvas";
  }

  resize(width: number, height: number) {
    this.backdropNode.width = width;
    this.backdropNode.height = height;
    this.browser.resize(height);
  }

  reconcile(scene: BenchmarkSceneModel) {
    this.browser.reconcile(scene.canvasCardOrder);
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

  setCaptureInstrumentation(enabled: boolean) {
    if (enabled && !this.probe) this.probe = installLiquidCaptureProbe(this.reportCapture);
    else if (!enabled && this.probe) {
      this.probe.dispose();
      this.probe = null;
    }
  }

  tick(now: number) {
    this.browser.tick(now);
    this.renderer.render();
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
    return {
      html: 1 + counts.html,
      containers: counts.containers,
      glassShapes: counts.glassShapes,
      cardGeometrySyncs: counts.cardGeometrySyncs,
      scrollGroupTransformUpdates: counts.scrollGroupTransformUpdates,
      dragTransformUpdates: counts.dragTransformUpdates,
      captureAvailable: this.probe?.available ?? false,
    };
  }

  resetCounters() {
    this.browser.resetCounters();
  }

  destroy() {
    this.browser.destroy();
    this.backdropNode.remove();
    this.renderer.destroy();
    this.probe?.dispose();
    this.probe = null;
  }
}
