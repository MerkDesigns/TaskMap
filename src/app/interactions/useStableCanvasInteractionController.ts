import { useRef } from "react";
import type { CanvasInteractionController } from "./canvasInteractionController";

/**
 * Owns one controller for a mounted React instance. The controller itself has
 * no external resources, so StrictMode-probed effects must not dispose it.
 */
export function useStableCanvasInteractionController(
  create: () => CanvasInteractionController,
): CanvasInteractionController {
  const controllerRef = useRef<CanvasInteractionController | null>(null);
  if (!controllerRef.current) controllerRef.current = create();
  return controllerRef.current;
}
