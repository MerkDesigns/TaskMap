import { createViewport } from "../../../canvas/geometry/viewportMath";
import type { CanvasPoint } from "../../../canvas/geometry/canvasGeometry";
import type {
  BenchmarkArchitecture,
  BenchmarkElementKind,
  BenchmarkElementModel,
  BenchmarkGlassModel,
  BenchmarkSceneCounts,
  BenchmarkSceneModel,
} from "./benchmarkTypes";

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
    glasses: scene.glasses.length,
    elements: scene.elements.length,
  };
}

export function clampBenchmarkGlassSize(width: number, height: number) {
  return { width: Math.max(190, width), height: Math.max(120, height) };
}

export class BenchmarkSceneStore {
  private readonly listeners = new Set<() => void>();
  private version = 0;
  private nextElementOrdinal = 0;
  private nextGlassOrdinal = 0;
  readonly scene: BenchmarkSceneModel;

  constructor() {
    this.scene = {
      architecture: "A",
      elements: [],
      glasses: [],
      camera: createViewport({ x: 80, y: 64 }, 1, { width: 0, height: 0 }),
      animations: { moveCards: false, moveImage: false, showGif: false },
    };
    this.addBulk("text-card", 6, false);
    this.addBulk("container", 2, false);
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

  setArchitecture(architecture: BenchmarkArchitecture) {
    this.scene.architecture = architecture;
    this.commit();
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

  addGlass(commit = true) {
    const ordinal = this.nextGlassOrdinal++;
    const glass: BenchmarkGlassModel = {
      id: `glass-${ordinal + 1}`,
      x: 360 + (ordinal % 4) * 54,
      y: 170 + (ordinal % 5) * 46,
      width: 280,
      height: 176,
      z: 40 + ordinal,
      role: "small-panel",
    };
    this.scene.glasses.push(glass);
    if (commit) this.commit();
    return glass;
  }

  adjustElementZ(id: string, delta: number) {
    this.scene.elements = this.scene.elements.map((element) =>
      element.id === id ? { ...element, z: element.z + delta } : element,
    );
    this.commit();
  }

  adjustGlassZ(id: string, delta: number) {
    this.scene.glasses = this.scene.glasses.map((glass) =>
      glass.id === id ? { ...glass, z: glass.z + delta } : glass,
    );
    this.commit();
  }

  toggleGlassRole(id: string) {
    this.scene.glasses = this.scene.glasses.map((glass) =>
      glass.id === id
        ? {
            ...glass,
            role: glass.role === "small-panel" ? "large-panel" : "small-panel",
          }
        : glass,
    );
    this.commit();
  }

  commitElementGeometry(id: string, geometry: BenchmarkGeometryCommit) {
    this.scene.elements = this.scene.elements.map((element) =>
      element.id === id ? { ...element, ...geometry } : element,
    );
    this.commit();
  }

  commitGlassGeometry(id: string, geometry: BenchmarkGeometryCommit) {
    this.scene.glasses = this.scene.glasses.map((glass) =>
      glass.id === id ? { ...glass, ...geometry } : glass,
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

  clearGlass() {
    this.scene.glasses.length = 0;
    this.nextGlassOrdinal = 0;
    this.commit();
  }
}
