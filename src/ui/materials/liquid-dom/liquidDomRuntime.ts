import { Container, Glass, Html, Renderer, Scene } from "@liquid-dom/core";
import { LIQUID_MATERIAL_OPTICS, type LiquidMaterialRole } from "./materialRoles";

export interface LiquidSurfaceRegistration {
  readonly contentHost: HTMLDivElement;
  sync(anchor: HTMLElement, root: HTMLElement): void;
  dispose(): void;
}

export interface LiquidDomRuntime {
  readonly backdropHost: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  registerSurface(role: LiquidMaterialRole): LiquidSurfaceRegistration;
  syncBackdrop(root: HTMLElement): void;
  render(): void;
  destroy(): void;
}

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

export function createLiquidDomRuntime(): LiquidDomRuntime {
  const scene = new Scene();
  const backdropElement = document.createElement("div");
  backdropElement.className = "taskmap-liquid-dom-backdrop-content";
  const backdrop = scene.add(new Html({ zIndex: -1, element: backdropElement }));
  const renderer = new Renderer({ scene, maxDpr: 2 });

  renderer.canvas.className = "taskmap-liquid-dom-canvas";

  return {
    backdropHost: backdropElement,
    canvas: renderer.canvas,
    registerSurface(role) {
      const container = scene.add(new Container(LIQUID_MATERIAL_OPTICS[role]));
      // The Html host owns interaction when a surface contains normal DOM controls.
      // Renderer-side SDF pointer events are reserved for content-free glass shapes.
      const glass = container.add(new Glass({ cornerSmoothing: 0, pointerEvents: false }));
      const contentElement = document.createElement("div");
      contentElement.className = "taskmap-liquid-material-content";
      const content = glass.add(new Html({ element: contentElement }));

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
        },
        dispose() {
          content.remove();
          glass.remove();
          container.remove();
        },
      };
    },
    syncBackdrop(root) {
      const rect = root.getBoundingClientRect();
      backdrop.width = rect.width;
      backdrop.height = rect.height;
    },
    render() {
      renderer.render();
    },
    destroy() {
      renderer.destroy();
    },
  };
}
