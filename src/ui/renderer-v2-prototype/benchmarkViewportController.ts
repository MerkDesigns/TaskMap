import {
  createViewport,
  screenToWorld,
  translateViewport,
  wheelZoomViewport,
} from "../../canvas/geometry/viewportMath";
import type { CanvasPoint, CanvasSize } from "../../canvas/geometry/canvasGeometry";
import type { BenchmarkSceneStore } from "./benchmarkSceneStore";
import { benchmarkCanvasIndex } from "./benchmarkCanvasIds";
import type { CanvasBrowserItemId } from "./liquidCanvasBrowserTypes";

interface PanGesture {
  pointerId: number;
  last: CanvasPoint;
}

export class BenchmarkViewportController {
  private pan: PanGesture | null = null;
  private frame: number | null = null;
  private presenter: (() => void) | null = null;
  private visibilityPublisher: (() => void) | null = null;
  private readonly canvasViewports = new Map<
    CanvasBrowserItemId,
    ReturnType<typeof createViewport>
  >();

  constructor(private readonly store: BenchmarkSceneStore) {}

  bindPresenter(presenter: (() => void) | null) {
    this.presenter = presenter;
    presenter?.();
  }

  bindVisibilityPublisher(publisher: (() => void) | null) {
    this.visibilityPublisher = publisher;
    publisher?.();
  }

  resize(screen: CanvasSize) {
    const viewport = this.store.scene.camera;
    this.store.scene.camera = createViewport(viewport.pan, viewport.zoom, screen);
    this.schedule();
  }

  beginPan(pointerId: number, point: CanvasPoint) {
    if (this.pan) return false;
    this.pan = { pointerId, last: point };
    return true;
  }

  updatePan(pointerId: number, point: CanvasPoint) {
    if (this.pan?.pointerId !== pointerId) return;
    const delta = { x: point.x - this.pan.last.x, y: point.y - this.pan.last.y };
    this.pan.last = point;
    this.store.scene.camera = translateViewport(this.store.scene.camera, delta);
    this.schedule();
  }

  endPan(pointerId: number) {
    if (this.pan?.pointerId !== pointerId) return;
    this.pan = null;
    this.schedule();
    this.publishVisibilityNow();
  }

  wheel(point: CanvasPoint, deltaY: number) {
    this.store.scene.camera = wheelZoomViewport(this.store.scene.camera, point, deltaY);
    this.schedule();
  }

  worldAt(point: CanvasPoint) {
    return screenToWorld(point, this.store.scene.camera);
  }

  reset() {
    const screen = this.store.scene.camera.screen;
    this.store.scene.camera = createViewport({ x: 80, y: 64 }, 1, screen);
    this.store.commit();
    this.schedule();
  }

  selectCanvas(id: CanvasBrowserItemId) {
    const currentId = this.store.scene.activeCanvasCardId;
    if (currentId === id || !this.store.scene.canvasCardOrder.includes(id)) return;
    this.canvasViewports.set(currentId, this.store.scene.camera);
    const screen = this.store.scene.camera.screen;
    const canvasIndex = benchmarkCanvasIndex(id);
    const next =
      this.canvasViewports.get(id) ??
      createViewport({ x: 80 - canvasIndex * 28, y: 64 - canvasIndex * 18 }, 1, screen);
    this.store.selectCanvasCard(id, next);
    this.schedule();
    this.publishVisibilityNow();
  }

  flush() {
    this.presenter?.();
  }

  dispose() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.pan = null;
    this.presenter = null;
    this.visibilityPublisher = null;
  }

  private schedule() {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.presenter?.();
      this.visibilityPublisher?.();
    });
  }

  private publishVisibilityNow() {
    this.visibilityPublisher?.();
  }
}
