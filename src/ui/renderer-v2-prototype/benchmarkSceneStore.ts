import { createViewport } from "../../canvas/geometry/viewportMath";
import type { CanvasPoint } from "../../canvas/geometry/canvasGeometry";
import type {
  BenchmarkElementKind,
  BenchmarkElementModel,
  BenchmarkSceneCounts,
  BenchmarkSceneModel,
} from "./benchmarkTypes";
import { benchmarkCanvasId, benchmarkCanvasIndex } from "./benchmarkCanvasIds";
import type { CanvasBrowserItemId } from "./liquidCanvasBrowserTypes";

export interface BenchmarkGeometryCommit {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const ELEMENT_GEOMETRY = {
  "text-card": { width: 248, height: 164 },
  container: { width: 368, height: 244 },
} as const;

export const BENCHMARK_CANVAS_CARD_COUNT = Object.freeze({ minimum: 1, maximum: 20 });
export const BENCHMARK_CANVAS_ELEMENT_COUNT = Object.freeze({ minimum: 1, maximum: 100 });

export function clampCanvasCardCount(value: number) {
  return clampInteger(value, BENCHMARK_CANVAS_CARD_COUNT);
}

export function clampCanvasElementCount(value: number) {
  return clampInteger(value, BENCHMARK_CANVAS_ELEMENT_COUNT);
}

export function deterministicElementPosition(ordinal: number): CanvasPoint {
  return {
    x: 120 + (ordinal % 10) * 292,
    y: 120 + Math.floor(ordinal / 10) * 216 + (ordinal % 3) * 18,
  };
}

export function countBenchmarkScene(scene: BenchmarkSceneModel): BenchmarkSceneCounts {
  const textCards = scene.elements.filter((item) => item.kind === "text-card").length;
  const containers = scene.elements.length - textCards;
  return {
    textCards,
    containers,
    canvasCards: scene.canvasCardCount,
    elements: scene.elements.length,
  };
}

export class BenchmarkSceneStore {
  private readonly listeners = new Set<() => void>();
  private version = 0;
  private nextElementOrdinal = 0;
  readonly scene: BenchmarkSceneModel;

  constructor() {
    this.scene = {
      elements: [],
      canvasCardCount: 5,
      canvasCardOrder: Array.from({ length: 5 }, (_, index) => benchmarkCanvasId(index)),
      activeCanvasCardId: benchmarkCanvasId(0),
      camera: createViewport({ x: 80, y: 64 }, 1, { width: 0, height: 0 }),
      animations: { moveCards: false, moveImage: false, showGif: false },
    };
    this.addBulk("text-card", 6, false);
    this.addBulk("container", 2, false);
  }

  setCanvasCardCount(count: number) {
    const target = clampCanvasCardCount(count);
    const retained = this.scene.canvasCardOrder.filter((id) => benchmarkCanvasIndex(id) < target);
    const retainedIds = new Set(retained);
    for (let index = 0; index < target; index += 1) {
      const id = benchmarkCanvasId(index);
      if (!retainedIds.has(id)) retained.push(id);
    }
    this.scene.canvasCardCount = target;
    this.scene.canvasCardOrder = retained;
    if (!retained.includes(this.scene.activeCanvasCardId)) {
      this.scene.activeCanvasCardId = retained[0] ?? benchmarkCanvasId(0);
    }
    this.commit();
  }

  selectCanvasCard(id: CanvasBrowserItemId, camera = this.scene.camera) {
    if (!this.scene.canvasCardOrder.includes(id)) return false;
    this.scene.activeCanvasCardId = id;
    this.scene.camera = camera;
    this.commit();
    return true;
  }

  commitCanvasCardOrder(order: readonly CanvasBrowserItemId[]) {
    if (!isCanvasCardPermutation(order, this.scene.canvasCardCount)) return false;
    this.scene.canvasCardOrder = [...order];
    this.commit();
    return true;
  }

  setCanvasElementCount(count: number) {
    const target = clampCanvasElementCount(count);
    if (target < this.scene.elements.length) {
      this.scene.elements = this.scene.elements.slice(0, target);
      this.nextElementOrdinal = target;
    } else {
      while (this.scene.elements.length < target) {
        this.addElement(elementKindForOrdinal(this.nextElementOrdinal), undefined, false);
      }
    }
    this.commit();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  commit() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  addElement(kind: BenchmarkElementKind, point?: CanvasPoint, commit = true) {
    const ordinal = this.nextElementOrdinal++;
    const geometry = ELEMENT_GEOMETRY[kind];
    const position = point ?? deterministicElementPosition(ordinal);
    const element: BenchmarkElementModel = {
      id: `${kind}-${ordinal + 1}`,
      kind,
      x: position.x,
      y: position.y,
      width: geometry.width,
      height: geometry.height,
      z: 10 + ordinal,
      ordinal,
    };
    this.scene.elements.push(element);
    if (commit) this.commit();
    return element;
  }

  addBulk(kind: BenchmarkElementKind, count: number, commit = true) {
    for (let index = 0; index < count; index += 1) this.addElement(kind, undefined, false);
    if (commit) this.commit();
  }

  adjustElementZ(id: string, delta: number) {
    this.scene.elements = this.scene.elements.map((element) =>
      element.id === id ? { ...element, z: element.z + delta } : element,
    );
    this.commit();
  }

  commitElementGeometry(id: string, geometry: BenchmarkGeometryCommit) {
    this.scene.elements = this.scene.elements.map((element) =>
      element.id === id ? { ...element, ...geometry } : element,
    );
    this.commit();
  }

  setAnimation(name: keyof BenchmarkSceneModel["animations"], enabled: boolean) {
    this.scene.animations[name] = enabled;
    this.commit();
  }

  clearCanvas() {
    this.scene.elements.length = 0;
    this.nextElementOrdinal = 0;
    this.commit();
  }
}

function isCanvasCardPermutation(order: readonly CanvasBrowserItemId[], count: number) {
  const expected = new Set(Array.from({ length: count }, (_, index) => benchmarkCanvasId(index)));
  return (
    order.length === count && new Set(order).size === count && order.every((id) => expected.has(id))
  );
}

function elementKindForOrdinal(ordinal: number): BenchmarkElementKind {
  if (ordinal < 6) return "text-card";
  if (ordinal < 8) return "container";
  return ordinal % 5 === 4 ? "container" : "text-card";
}

function clampInteger(
  value: number,
  range: { readonly minimum: number; readonly maximum: number },
) {
  const finite = Number.isFinite(value) ? Math.round(value) : range.minimum;
  return Math.min(range.maximum, Math.max(range.minimum, finite));
}
