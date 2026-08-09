import type { CanvasRectangle } from "../../canvas/geometry/canvasGeometry";
import type { CanvasViewport } from "../../canvas/geometry/viewportMath";
import type { BackdropScene } from "./compositor/backdropScene";

export interface MaterialBackdropPresentation {
  readonly sceneKey: string;
  readonly sceneRevision: number;
  readonly viewport: CanvasViewport;
  readonly interactionActive: boolean;
  readonly buildScene: (cacheWorldBounds: CanvasRectangle, anchorZoom: number) => BackdropScene;
}

export interface MaterialCompositorPresentationSource {
  getSnapshot(): MaterialBackdropPresentation | null;
  subscribe(listener: () => void): () => void;
}

export interface MaterialCompositorPresentationPublisher extends MaterialCompositorPresentationSource {
  publish(snapshot: MaterialBackdropPresentation): void;
  clear(): void;
}

export function createMaterialCompositorPresentationBridge(): MaterialCompositorPresentationPublisher {
  let snapshot: MaterialBackdropPresentation | null = null;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());

  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish(next: MaterialBackdropPresentation) {
      if (snapshot === next) return;
      snapshot = next;
      notify();
    },
    clear() {
      if (!snapshot) return;
      snapshot = null;
      notify();
    },
  });
}
