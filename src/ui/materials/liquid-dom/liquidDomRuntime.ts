import { Container, Glass, Html, Renderer, Scene, StackingContext } from "@liquid-dom/core";
import { LIQUID_MATERIAL_OPTICS, type LiquidMaterialRole } from "./materialRoles";

export interface LiquidSurfaceRegistration {
  readonly contentHost: HTMLDivElement;
  sync(anchor: HTMLElement, root: HTMLElement): void;
  dispose(): void;
}

export interface LiquidDomRuntime {
  readonly backdropHost: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  registerSurface(
    role: LiquidMaterialRole,
    sceneOrder?: number,
    plane?: LiquidScenePlane,
  ): LiquidSurfaceRegistration;
  syncBackdrop(root: HTMLElement): void;
  invalidate(): void;
  destroy(): void;
}

interface LiquidRoleBatch {
  readonly container: Container;
}

export type LiquidScenePlane = "base" | "overlay";

const LIQUID_BATCH_ORDER = {
  "base:large-panel": 0,
  "base:small-panel": 1,
  "overlay:large-panel": 2,
  "overlay:small-panel": 3,
} as const satisfies Record<`${LiquidScenePlane}:${LiquidMaterialRole}`, number>;

function readCornerRadius(element: HTMLElement): number {
  const value = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
  return Number.isFinite(value) ? value : 0;
}

export function supportsLiquidDomRuntime(): boolean {
  const webGpuGlobals = globalThis as typeof globalThis & {
    GPUQueue?: { prototype?: { copyElementImageToTexture?: unknown } };
  };
  return (
    typeof navigator !== "undefined" &&
    "gpu" in navigator &&
    typeof webGpuGlobals.GPUQueue?.prototype?.copyElementImageToTexture === "function"
  );
}

export function createLiquidDomRuntime(
  onRenderError: () => void = () => undefined,
): LiquidDomRuntime {
  const scene = new Scene();
  const backdropElement = document.createElement("div");
  backdropElement.className = "taskmap-liquid-dom-backdrop-content";
  const backdrop = scene.add(new Html({ zIndex: -1, element: backdropElement }));
  const renderer = new Renderer({ scene, maxDpr: 2 });
  const roleBatches = new Map<`${LiquidScenePlane}:${LiquidMaterialRole}`, LiquidRoleBatch>();
  let frame: number | null = null;
  let destroyed = false;

  const invalidate = () => {
    if (destroyed || frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (destroyed) return;
      try {
        renderer.render();
      } catch {
        onRenderError();
      }
    });
  };
  const handlePaint = () => invalidate();

  const roleBatch = (plane: LiquidScenePlane, role: LiquidMaterialRole) => {
    const key = `${plane}:${role}` as const;
    const existing = roleBatches.get(key);
    if (existing) return existing;
    const container = scene.add(
      new Container({
        ...LIQUID_MATERIAL_OPTICS[role],
        zIndex: LIQUID_BATCH_ORDER[key],
      }),
    );
    const batch = { container };
    roleBatches.set(key, batch);
    return batch;
  };

  renderer.canvas.className = "taskmap-liquid-dom-canvas";
  renderer.canvas.addEventListener("paint", handlePaint, true);
  invalidate();

  return {
    backdropHost: backdropElement,
    canvas: renderer.canvas,
    registerSurface(role, sceneOrder = 0, plane = "base") {
      const { container } = roleBatch(plane, role);
      const layer = container.add(new StackingContext({ zIndex: sceneOrder }));
      // The Html host owns interaction when a surface contains normal DOM controls.
      // Renderer-side SDF pointer events are reserved for content-free glass shapes.
      const glass = layer.add(new Glass({ cornerSmoothing: 0, pointerEvents: false }));
      const contentElement = document.createElement("div");
      contentElement.className = "taskmap-liquid-material-content";
      const content = glass.add(new Html({ element: contentElement }));
      invalidate();

      return {
        contentHost: contentElement,
        sync(anchor, root) {
          const anchorRect = anchor.getBoundingClientRect();
          const rootRect = root.getBoundingClientRect();
          glass.x = anchorRect.left - rootRect.left;
          glass.y = anchorRect.top - rootRect.top;
          glass.width = anchorRect.width;
          glass.height = anchorRect.height;
          glass.cornerRadius = readCornerRadius(anchor);
          content.width = anchorRect.width;
          content.height = anchorRect.height;
          invalidate();
        },
        dispose() {
          content.remove();
          glass.remove();
          layer.remove();
          invalidate();
        },
      };
    },
    syncBackdrop(root) {
      const rect = root.getBoundingClientRect();
      backdrop.width = rect.width;
      backdrop.height = rect.height;
      invalidate();
    },
    invalidate,
    destroy() {
      destroyed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      renderer.canvas.removeEventListener("paint", handlePaint, true);
      backdrop.remove();
      roleBatches.forEach(({ container }) => container.remove());
      roleBatches.clear();
      renderer.destroy();
    },
  };
}
