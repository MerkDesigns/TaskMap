import { useLayoutEffect, type RefObject } from "react";
import type { CanvasInteractionController } from "../../app/interactions/canvasInteractionTypes";

/** How long the zoom must stay unchanged before element layers are recreated at its scale. */
const ZOOM_SETTLE_MS = 150;

/** The stage variables are inherited by the world and every camera-aligned overlay. */
export function useLegacyCameraPresentation(
  controller: CanvasInteractionController,
  stageRef: RefObject<HTMLElement | null>,
  selectionRef: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    let previousViewport: ReturnType<typeof controller.getSnapshot>["viewport"] | null = null;
    let settleTimer: number | undefined;
    let zoomingStage: HTMLElement | null = null;
    // Element layers keep the raster scale they were created at, so a zoom change marks the stage
    // as zooming (dropping them, see elementPlacement.css) until the zoom settles.
    const markZooming = (stage: HTMLElement) => {
      zoomingStage = stage;
      stage.dataset.cameraZooming = "";
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        delete stage.dataset.cameraZooming;
      }, ZOOM_SETTLE_MS);
    };
    const present = () => {
      const { viewport, selectionRectangle } = controller.getSnapshot();
      const stage = stageRef.current;
      if (!stage) return;
      const { pan, zoom } = viewport;
      if (viewport !== previousViewport) {
        if (previousViewport && previousViewport.zoom !== zoom) markZooming(stage);
        previousViewport = viewport;
        stage.style.setProperty(
          "--taskmap-camera-transform",
          `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
        );
        stage.style.setProperty("--taskmap-camera-inverse-zoom", `${1 / zoom}`);
        stage.style.setProperty(
          "--taskmap-canvas-dot-opacity-scale",
          `${Math.min(1, Math.max(0, (zoom - 0.55) / 0.45))}`,
        );
      }
      const selection = selectionRef.current;
      if (selection && selectionRectangle) {
        selection.style.left = `${pan.x + selectionRectangle.x * zoom}px`;
        selection.style.top = `${pan.y + selectionRectangle.y * zoom}px`;
        selection.style.width = `${selectionRectangle.width * zoom}px`;
        selection.style.height = `${selectionRectangle.height * zoom}px`;
      }
    };
    present();
    const unsubscribe = controller.subscribe(present);
    return () => {
      unsubscribe();
      window.clearTimeout(settleTimer);
      if (zoomingStage) delete zoomingStage.dataset.cameraZooming;
    };
  }, [controller, stageRef, selectionRef]);

  // A selection overlay can mount after the controller publication that created it.
  useLayoutEffect(() => {
    const selection = selectionRef.current;
    const { viewport, selectionRectangle } = controller.getSnapshot();
    if (!selection || !selectionRectangle) return;
    selection.style.left = `${viewport.pan.x + selectionRectangle.x * viewport.zoom}px`;
    selection.style.top = `${viewport.pan.y + selectionRectangle.y * viewport.zoom}px`;
    selection.style.width = `${selectionRectangle.width * viewport.zoom}px`;
    selection.style.height = `${selectionRectangle.height * viewport.zoom}px`;
  });
}
