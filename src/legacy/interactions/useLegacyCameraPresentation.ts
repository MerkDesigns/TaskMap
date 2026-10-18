import { useLayoutEffect, type RefObject } from "react";
import type { CanvasInteractionController } from "../../app/interactions/canvasInteractionTypes";
import type { CanvasRectangle } from "../../canvas/geometry/canvasGeometry";
import type { CanvasViewport } from "../../canvas/geometry/viewportMath";
import "./legacyCameraPresentation.css";

/** How long the zoom must stay unchanged before element layers are recreated at its scale. */
const ZOOM_SETTLE_MS = 150;

/**
 * Writes the camera to stage variables. The transform reaches only the camera layers (the world
 * and camera-aligned overlays, marked `data-camera-layer`); the zoom variables are inherited by
 * everything that scales with zoom, so they are written only when the zoom changes.
 */
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
      const { viewport, selectionRectangle, selectionClip } = controller.getSnapshot();
      const stage = stageRef.current;
      if (!stage) return;
      const { pan, zoom } = viewport;
      if (viewport !== previousViewport) {
        const zoomChanged = previousViewport?.zoom !== zoom;
        if (previousViewport && zoomChanged) markZooming(stage);
        previousViewport = viewport;
        stage.style.setProperty(
          "--taskmap-camera-transform",
          `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
        );
        if (zoomChanged) {
          stage.style.setProperty("--taskmap-camera-inverse-zoom", `${1 / zoom}`);
          stage.style.setProperty(
            "--taskmap-canvas-dot-opacity-scale",
            `${Math.min(1, Math.max(0, (zoom - 0.55) / 0.45))}`,
          );
        }
      }
      const selection = selectionRef.current;
      if (selection && selectionRectangle)
        presentSelection(selection, viewport, selectionRectangle, selectionClip);
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
    const { viewport, selectionRectangle, selectionClip } = controller.getSnapshot();
    if (selection && selectionRectangle)
      presentSelection(selection, viewport, selectionRectangle, selectionClip);
  });
}

/** Places the box on screen and hides whatever part of it lies outside `clip`. */
function presentSelection(
  selection: HTMLElement,
  { pan, zoom }: CanvasViewport,
  rectangle: CanvasRectangle,
  clip: CanvasRectangle | null,
) {
  selection.style.left = `${pan.x + rectangle.x * zoom}px`;
  selection.style.top = `${pan.y + rectangle.y * zoom}px`;
  selection.style.width = `${rectangle.width * zoom}px`;
  selection.style.height = `${rectangle.height * zoom}px`;
  if (!clip) {
    selection.style.clipPath = "";
    return;
  }
  const inset = (amount: number) => `${Math.max(0, amount) * zoom}px`;
  const right = rectangle.x + rectangle.width - (clip.x + clip.width);
  const bottom = rectangle.y + rectangle.height - (clip.y + clip.height);
  selection.style.clipPath = `inset(${inset(clip.y - rectangle.y)} ${inset(right)} ${inset(
    bottom,
  )} ${inset(clip.x - rectangle.x)})`;
}
