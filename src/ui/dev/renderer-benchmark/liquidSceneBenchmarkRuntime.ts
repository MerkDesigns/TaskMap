import { Container, Glass, Group, Html, Renderer, Scene } from "@liquid-dom/core";
import type { CanvasViewport } from "../../../canvas/geometry/viewportMath";
import { LIQUID_MATERIAL_OPTICS } from "../../materials/liquid-dom/materialRoles";
import { installLiquidCaptureProbe, type LiquidCaptureProbe } from "./liquidCaptureProbe";
import {
  BENCHMARK_LIQUID_MAX_DPR,
  BENCHMARK_WORLD_HEIGHT,
  BENCHMARK_WORLD_WIDTH,
} from "./benchmarkWorld";
import type { BenchmarkLiquidCounts } from "./benchmarkPresentation";
import type {
  BenchmarkElementModel,
  BenchmarkGlassModel,
  BenchmarkSceneModel,
} from "./benchmarkTypes";

type LiquidMode = "B" | "C";

interface ElementRecord {
  host: HTMLDivElement;
  node: Html;
}

interface GlassRecord {
  role: BenchmarkGlassModel["role"];
  container: Container;
  glass: Glass;
  content: Html;
  host: HTMLDivElement;
}

export class LiquidSceneBenchmarkRuntime {
  readonly canvas: HTMLCanvasElement;
  readonly coarseHost: HTMLDivElement | null;
  readonly backgroundHost: HTMLDivElement | null;
  private readonly scene = new Scene();
  private readonly renderer: Renderer;
  private readonly worldGroup: Group | null;
  private readonly backdropNode: Html;
  private readonly elements = new Map<string, ElementRecord>();
  private readonly glasses = new Map<string, GlassRecord>();
  private readonly reportCapture: (width: number | null, height: number | null) => void;
  private probe: LiquidCaptureProbe | null = null;
  private cardsWereAnimating = false;
  private lastGridZoom: number | null = null;

  constructor(
    private readonly mode: LiquidMode,
    reportCapture: (width: number | null, height: number | null) => void,
  ) {
    this.reportCapture = reportCapture;
    const host = document.createElement("div");
    host.className =
      mode === "B"
        ? "renderer-benchmark__coarse-host"
        : "renderer-benchmark__liquid-background-host";
    this.worldGroup = mode === "C" ? this.scene.add(new Group()) : null;
    const backdrop = new Html({ element: host, zIndex: mode === "B" ? 0 : -10_000 });
    this.backdropNode = this.worldGroup ? this.worldGroup.add(backdrop) : this.scene.add(backdrop);
    this.coarseHost = mode === "B" ? host : null;
    this.backgroundHost = mode === "C" ? host : null;
    this.renderer = new Renderer({ scene: this.scene, maxDpr: BENCHMARK_LIQUID_MAX_DPR });
    this.canvas = this.renderer.canvas;
    this.canvas.className = "renderer-benchmark__liquid-canvas";
  }

  resize(width: number, height: number) {
    this.backdropNode.width = this.mode === "C" ? BENCHMARK_WORLD_WIDTH : width;
    this.backdropNode.height = this.mode === "C" ? BENCHMARK_WORLD_HEIGHT : height;
  }

  reconcile(scene: BenchmarkSceneModel, visibleElements = scene.elements) {
    if (this.mode === "C") this.reconcileElements(visibleElements);
    this.reconcileGlasses(scene.glasses);
  }

  presentCamera(viewport: CanvasViewport) {
    if (this.worldGroup) {
      this.worldGroup.x = viewport.pan.x;
      this.worldGroup.y = viewport.pan.y;
      this.worldGroup.scaleX = viewport.zoom;
      this.worldGroup.scaleY = viewport.zoom;
    }
    if (this.backgroundHost && this.lastGridZoom !== viewport.zoom) {
      this.backgroundHost.style.setProperty(
        "--renderer-benchmark-dot-size",
        `${1.25 / viewport.zoom}px`,
      );
      this.lastGridZoom = viewport.zoom;
    }
  }

  setCaptureInstrumentation(enabled: boolean) {
    if (enabled && !this.probe) {
      this.probe = installLiquidCaptureProbe(this.reportCapture);
    } else if (!enabled && this.probe) {
      this.probe.dispose();
      this.probe = null;
    }
  }

  syncElement(element: BenchmarkElementModel) {
    const node = this.elements.get(element.id)?.node;
    if (!node) return;
    node.x = element.x;
    node.y = element.y;
    node.width = element.width;
    node.height = element.height;
    node.zIndex = element.z;
  }

  syncGlass(model: BenchmarkGlassModel) {
    const record = this.glasses.get(model.id);
    if (!record) return;
    record.container.zIndex = model.z;
    record.glass.x = model.x;
    record.glass.y = model.y;
    record.glass.width = model.width;
    record.glass.height = model.height;
    record.glass.cornerRadius = 18;
    record.content.width = model.width;
    record.content.height = model.height;
  }

  animate(now: number, scene: BenchmarkSceneModel) {
    if (this.mode !== "C") return;
    const active = scene.animations.moveCards;
    if (!active && !this.cardsWereAnimating) return;
    for (const element of scene.elements) {
      const node = this.elements.get(element.id)?.node;
      if (!node) continue;
      const offset =
        active && element.ordinal % 5 === 0 ? Math.sin(now / 520 + element.ordinal) * 34 : 0;
      node.x = element.x + offset;
    }
    this.cardsWereAnimating = active;
  }

  render() {
    this.renderer.render();
  }

  getElementHost(id: string) {
    return this.elements.get(id)?.host ?? null;
  }

  getGlassHost(id: string) {
    return this.glasses.get(id)?.host ?? null;
  }

  getCounts(): BenchmarkLiquidCounts {
    return {
      html: 1 + this.elements.size + this.glasses.size,
      containers: this.glasses.size,
      captureAvailable: this.probe?.available ?? false,
    };
  }

  destroy() {
    this.elements.forEach(({ node }) => node.remove());
    this.glasses.forEach((record) => {
      record.content.remove();
      record.glass.remove();
      record.container.remove();
    });
    this.renderer.destroy();
    this.probe?.dispose();
    this.probe = null;
  }

  private reconcileElements(models: BenchmarkElementModel[]) {
    const ids = new Set(models.map(({ id }) => id));
    for (const [id, record] of this.elements) {
      if (ids.has(id)) continue;
      record.node.remove();
      this.elements.delete(id);
    }
    for (const model of models) {
      if (!this.elements.has(model.id)) {
        const host = document.createElement("div");
        host.className = "renderer-benchmark__liquid-element-host";
        const node = this.worldGroup?.add(new Html({ element: host }));
        if (node) this.elements.set(model.id, { host, node });
      }
      this.syncElement(model);
    }
  }

  private reconcileGlasses(models: BenchmarkGlassModel[]) {
    const ids = new Set(models.map(({ id }) => id));
    for (const [id, record] of this.glasses) {
      const model = models.find((item) => item.id === id);
      if (model && model.role === record.role) continue;
      record.content.remove();
      record.glass.remove();
      record.container.remove();
      this.glasses.delete(id);
    }
    for (const model of models) {
      if (!ids.has(model.id)) continue;
      if (!this.glasses.has(model.id)) {
        const container = this.scene.add(
          new Container({ ...LIQUID_MATERIAL_OPTICS[model.role], zIndex: model.z }),
        );
        const glass = container.add(new Glass({ cornerSmoothing: 0, pointerEvents: false }));
        const host = document.createElement("div");
        host.className = "renderer-benchmark__liquid-glass-host";
        const content = glass.add(new Html({ element: host }));
        this.glasses.set(model.id, { role: model.role, container, glass, content, host });
      }
      this.syncGlass(model);
    }
  }
}
